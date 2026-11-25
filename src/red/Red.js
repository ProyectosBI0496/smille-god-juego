// =============================================================
// Red (Etapa 9, D-024): conexión directa entre dos celulares
//
// Usamos PeerJS (cargado en index.html), que se apoya en WebRTC:
//   1. El ANFITRIÓN crea una "sala" con un código de 4 números.
//      Por dentro, su identificador es "smillegod-sala-XXXX".
//   2. El INVITADO escribe el código y se conecta a ese identificador.
//   3. Un servidor gratuito de PeerJS solo los PRESENTA; después los
//      datos viajan directo de un celular al otro.
//
// Los mensajes son objetos con un campo "t" (tipo), por ejemplo
//   { t: 'estado', ... }  o  { t: 'hab', h: 'atq' }
// Esta clase los reparte como eventos: red.on('estado', funcion).
// =============================================================

import { personaje, nick } from '../datos/Progreso.js';
import { paraLaRed } from '../datos/Personaje.js';

const PREFIJO = 'smillegod-sala-';
let actual = null; // la conexión activa (solo hay una a la vez)

// Corrección (v0.1.2): cuando un celular apaga la pantalla, el navegador congela
// el juego y la conexión WebRTC puede morir SIN avisar. Antes, el otro jugador
// lo veía quieto para siempre. Ahora:
//   - cada segundo se manda un "latido" (ping) para saber si el otro sigue ahí;
//   - si hay silencio, el INVITADO vuelve a conectarse solo al código de la sala;
//   - el ANFITRIÓN acepta esa conexión nueva en lugar de la vieja (muerta);
//   - solo se da por perdido al compañero tras un silencio muy largo.
const LATIDO_MS = 1000;          // cada cuánto se manda un ping
const SILENCIO_RECONECTAR = 4000; // silencio para intentar reconectar
const REINTENTO_MS = 3000;        // espera entre intentos de reconexión
const SILENCIO_PERDIDO = 90000;   // silencio para rendirse (1,5 minutos)

/** La conexión activa, o null si se juega solo */
export function redActual() {
  return actual;
}

/**
 * v0.1.2 — Para las pantallas de menú (elegir raza, clase, estadísticas...).
 * Antes, si el INVITADO estaba cambiando de raza justo cuando el anfitrión
 * empezaba la partida, nadie escuchaba el aviso "iniciar": el anfitrión jugaba
 * con un compañero congelado. Ahora cualquier menú lo lleva a la partida.
 */
export function seguirPareja(escena) {
  const red = actual;
  if (!red || !red.yaConectado || red.esAnfitrion) return;
  red.escuchar(escena, 'iniciar', (m) => escena.scene.start('EscenaArena', { mundo: m.mundo, dificultad: m.dificultad, coop: true, invitado: true }));
}

export default class Red extends Phaser.Events.EventEmitter {
  constructor() {
    super();
    if (actual) actual.cerrar();
    actual = this;
    this.peer = null;
    this.con = null;
    this.esAnfitrion = false;
    this.razaCompanero = 'humano';
    this.personajeCompanero = null; // v0.1.2: raza, clase, nivel y estadísticas del otro
    this.nickCompanero = '';
    this.ultimoMensaje = 0; // cuándo llegó el último mensaje (para saber si se cortó)
    this.codigo = null;     // el código de la sala (el invitado lo usa para reconectarse)
    this.yaConectado = false;
    this.ultimoIntento = 0;
    this.cerrada = false;

    // Latido + vigilancia, una vez por segundo
    this.reloj = setInterval(() => this.vigilar(), LATIDO_MS);
    // Al volver a la app (pantalla encendida), revisamos la conexión enseguida.
    // Le damos margen al reloj del silencio para no "rendirnos" por el tiempo dormido.
    this.alVolver = () => {
      if (document.visibilityState !== 'visible' || !this.yaConectado) return;
      this.ultimoMensaje = Math.max(this.ultimoMensaje, performance.now() - SILENCIO_RECONECTAR - 500);
      this.vigilar();
    };
    document.addEventListener('visibilitychange', this.alVolver);
  }

  /** Cada segundo: manda un ping y, si hay silencio largo, intenta arreglar la conexión */
  vigilar() {
    if (this.cerrada || !this.yaConectado) return;
    if (document.visibilityState !== 'visible') return; // dormidos no hacemos nada
    this.enviar({ t: 'p' });
    const silencio = performance.now() - this.ultimoMensaje;
    if (silencio > SILENCIO_PERDIDO) {
      this.perder();
      return;
    }
    if (silencio < SILENCIO_RECONECTAR) return;
    // El peer pierde su enlace con el servidor de PeerJS al dormir: lo recuperamos
    if (this.peer && this.peer.disconnected && !this.peer.destroyed) this.peer.reconnect();
    // Solo el invitado vuelve a llamar; el anfitrión espera la llamada
    if (!this.esAnfitrion) this.reconectar();
  }

  /** El compañero ya no está: se avisa a la escena y se cierra todo */
  perder() {
    if (this.cerrada) return;
    this.emit('desconectado');
    this.cerrar();
  }

  /** INVITADO: abre una conexión nueva al mismo código de sala */
  reconectar() {
    const ahora = performance.now();
    if (ahora - this.ultimoIntento < REINTENTO_MS) return;
    if (!this.peer || this.peer.destroyed || !this.peer.open || !this.codigo) return;
    this.ultimoIntento = ahora;
    this.prepararConexion(this.peer.connect(PREFIJO + this.codigo, { reliable: true }));
  }

  /** ANFITRIÓN: crea la sala. alListo(codigo) se llama cuando ya se puede compartir el código */
  crearSala(alListo, alError, intentos = 0) {
    this.esAnfitrion = true;
    const codigo = String(Phaser.Math.Between(1000, 9999));
    this.codigo = codigo;
    this.peer = new Peer(PREFIJO + codigo);
    this.peer.on('open', () => alListo(codigo));
    this.peer.on('connection', (con) => {
      // La sala es solo para 2... salvo que la conexión vieja esté muerta
      // (el compañero se está RECONECTANDO después de apagar la pantalla)
      const viejaViva = this.con && this.con.open && performance.now() - this.ultimoMensaje < SILENCIO_RECONECTAR;
      if (viejaViva) { con.close(); return; }
      this.prepararConexion(con);
    });
    this.peer.on('error', (error) => {
      if (this.yaConectado) return; // ya jugando: los cortes los maneja vigilar()
      // Si ese código ya lo usa otra sala, probamos con otro número
      if (error.type === 'unavailable-id' && intentos < 5) {
        this.peer.destroy();
        this.crearSala(alListo, alError, intentos + 1);
      } else {
        alError(error);
      }
    });
  }

  /** INVITADO: se une a la sala del código */
  unirse(codigo, alError) {
    this.esAnfitrion = false;
    this.codigo = codigo;
    this.peer = new Peer();
    this.peer.on('open', () => {
      this.prepararConexion(this.peer.connect(PREFIJO + codigo, { reliable: true }));
    });
    this.peer.on('error', (error) => {
      if (!this.yaConectado) alError(error);
      // Reconectando: si la sala ya no existe, el anfitrión se fue de verdad
      else if (error.type === 'peer-unavailable') this.perder();
    });
  }

  prepararConexion(con) {
    con.on('open', () => {
      const vieja = this.con;
      this.con = con; // la conexión nueva reemplaza a la vieja
      if (vieja && vieja !== con) vieja.close();
      this.ultimoMensaje = performance.now();
      if (this.yaConectado) {
        this.emit('reconectado'); // volvimos: el juego se re-sincroniza
      } else {
        this.yaConectado = true;
        this.emit('conectado');
      }
    });
    con.on('data', (mensaje) => {
      if (!mensaje || !mensaje.t) return;
      this.ultimoMensaje = performance.now();
      if (mensaje.t === 'p') return; // solo un latido
      if (mensaje.t === 'adios') { this.perder(); return; } // salió a propósito
      // La raza del compañero se guarda siempre, esté en la escena que esté
      if (mensaje.t === 'hola' || mensaje.t === 'raza') {
        this.personajeCompanero = mensaje.pj || null;
        this.razaCompanero = (mensaje.pj && mensaje.pj.raza) || 'humano';
        this.nickCompanero = String(mensaje.nick || '').slice(0, 12);
      }
      this.emit(mensaje.t, mensaje);
    });
    // Si se cierra, NO avisamos enseguida: puede ser la pantalla apagada.
    // vigilar() intentará reconectar y, si no puede en mucho rato, avisará.
    con.on('close', () => {
      if (!this.yaConectado) this.perder(); // falló antes de empezar
    });
  }

  /**
   * Le cuenta al compañero quién soy: mi personaje y mi nombre.
   * tipo 'hola' = al conectarse; 'raza' = cambié algo (subí de nivel, otro personaje...)
   */
  presentarme(tipo = 'raza') {
    const p = personaje();
    this.enviar({ t: tipo, pj: p ? paraLaRed(p) : null, nick: nick() });
  }

  get conectado() {
    return !!(this.con && this.con.open);
  }

  enviar(mensaje) {
    if (this.conectado) this.con.send(mensaje);
  }

  /**
   * Escucha un tipo de mensaje mientras la escena esté abierta.
   * Al cerrarse la escena, se deja de escuchar solo (evita avisos repetidos).
   */
  escuchar(escena, tipo, funcion) {
    this.on(tipo, funcion, escena);
    escena.events.once('shutdown', () => this.off(tipo, funcion, escena));
  }

  cerrar() {
    if (this.cerrada) return;
    this.cerrada = true;
    clearInterval(this.reloj);
    document.removeEventListener('visibilitychange', this.alVolver);
    if (this.conectado) this.con.send({ t: 'adios' }); // el otro se entera al instante
    if (this.con) this.con.close();
    if (this.peer && !this.peer.destroyed) this.peer.destroy();
    this.removeAllListeners();
    if (actual === this) actual = null;
  }
}
