// =============================================================
// Red (Etapa 9, D-024): conexión directa entre celulares
// v0.1.9: hasta 3 jugadores (el anfitrión + 2 invitados).
//
// Usamos PeerJS (cargado en index.html), que se apoya en WebRTC:
//   1. El ANFITRIÓN crea una "sala" con un código de 4 números.
//      Por dentro, su identificador es "smillegod-sala-XXXX".
//   2. Cada INVITADO escribe el código y se conecta a ese identificador.
//   3. Un servidor gratuito de PeerJS solo los PRESENTA; después los
//      datos viajan directo de un celular al otro.
//
// Forma de ESTRELLA: los invitados solo hablan con el anfitrión. Si un
// invitado necesita saber algo del otro (su héroe, su posición), se lo
// cuenta el anfitrión.
//
// Cada jugador tiene una "clave" (un texto al azar) que lo identifica,
// incluso si se reconecta después de apagar la pantalla.
//
// Los mensajes son objetos con un campo "t" (tipo), por ejemplo
//   { t: 'estado', ... }  o  { t: 'hab', h: 'atq' }
// Esta clase los reparte como eventos: red.on('estado', funcion).
// En el anfitrión, la función recibe además la CLAVE de quién lo mandó.
// =============================================================

import { personaje, nick } from '../datos/Progreso.js';
import { paraLaRed } from '../datos/Personaje.js';

const PREFIJO = 'smillegod-sala-';
export const MAX_JUGADORES = 3; // v0.1.9: el anfitrión + 2 invitados
let actual = null; // la conexión activa (solo hay una a la vez)

// Corrección (v0.1.2): cuando un celular apaga la pantalla, el navegador congela
// el juego y la conexión WebRTC puede morir SIN avisar. Por eso:
//   - cada segundo se manda un "latido" (ping) para saber si el otro sigue ahí;
//   - si hay silencio, el INVITADO vuelve a conectarse solo al código de la sala;
//   - el ANFITRIÓN reconoce su clave y acepta la conexión nueva en lugar de la vieja;
//   - solo se da por perdido a un jugador tras un silencio muy largo.
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
 * Si un INVITADO está en un menú cuando el anfitrión empieza la partida,
 * igual lo lleva a la partida.
 */
export function seguirPareja(escena) {
  const red = actual;
  if (!red || !red.yaConectado || red.esAnfitrion) return;
  red.escuchar(escena, 'iniciar', (m) => escena.scene.start('EscenaArena', { mundo: m.mundo, dificultad: m.dificultad, coop: true, invitado: true, partida: m.partida }));
}

/** Un texto al azar de 8 letras/números: la clave de este jugador */
function claveNueva() {
  return Math.random().toString(36).slice(2, 10);
}

export default class Red extends Phaser.Events.EventEmitter {
  constructor() {
    super();
    if (actual) actual.cerrar();
    actual = this;
    this.peer = null;
    this.con = null;              // INVITADO: su conexión con el anfitrión
    this.invitados = new Map();   // ANFITRIÓN: clave → { con, ultimoMensaje }
    this.perfiles = new Map();    // TODOS: clave → { clave, nick, pj } de cada jugador (yo incluido)
    this.clave = claveNueva();
    this.esAnfitrion = false;
    this.enPartida = false;       // ANFITRIÓN: durante la partida no entra nadie nuevo
    this.ultimoMensaje = 0;       // cuándo llegó el último mensaje (para saber si se cortó)
    this.codigo = null;           // el código de la sala (el invitado lo usa para reconectarse)
    this.yaConectado = false;
    this.ultimoIntento = 0;
    this.cerrada = false;
    this.alError = null;

    // Latido + vigilancia, una vez por segundo
    this.reloj = setInterval(() => this.vigilar(), LATIDO_MS);
    // Al volver a la app (pantalla encendida), revisamos la conexión enseguida.
    this.alVolver = () => {
      if (document.visibilityState !== 'visible' || !this.yaConectado) return;
      const margen = performance.now() - SILENCIO_RECONECTAR - 500;
      this.ultimoMensaje = Math.max(this.ultimoMensaje, margen);
      for (const inv of this.invitados.values()) inv.ultimoMensaje = Math.max(inv.ultimoMensaje, margen);
      this.vigilar();
    };
    document.addEventListener('visibilitychange', this.alVolver);
  }

  // ---------------- Quiénes están ----------------

  /** Los OTROS jugadores: [{ clave, nick, pj }, ...] */
  otros() {
    return [...this.perfiles.values()].filter((p) => p.clave !== this.clave);
  }

  /** Cuántos jugadores hay en la sala (yo incluido) */
  get cantidad() {
    return Math.max(1, this.perfiles.size);
  }

  // Compatibilidad con el código de 2 jugadores: el primer "otro"
  get personajeCompanero() { const o = this.otros()[0]; return o ? o.pj : null; }
  get nickCompanero() { const o = this.otros()[0]; return o ? o.nick : ''; }
  get razaCompanero() { const pj = this.personajeCompanero; return (pj && pj.raza) || 'humano'; }

  /** Los nombres de los otros, para mostrar: "Ana y Luis" */
  nombresOtros() {
    const nombres = this.otros().map((o) => o.nick || 'Jugador');
    return nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}` : (nombres[0] || '');
  }

  // ---------------- Vigilancia ----------------

  /** Cada segundo: manda un ping y, si hay silencio largo, intenta arreglar la conexión */
  vigilar() {
    if (this.cerrada || !this.yaConectado) return;
    if (document.visibilityState !== 'visible') return; // dormidos no hacemos nada
    this.enviar({ t: 'p' });
    const ahora = performance.now();
    if (this.esAnfitrion) {
      // Cada invitado por separado: si uno calla mucho, se lo da por perdido
      let alguienCalla = false;
      for (const [clave, inv] of this.invitados) {
        const silencio = ahora - inv.ultimoMensaje;
        if (silencio > SILENCIO_PERDIDO) this.quitar(clave);
        else if (silencio > SILENCIO_RECONECTAR) alguienCalla = true;
      }
      if (alguienCalla && this.peer && this.peer.disconnected && !this.peer.destroyed) this.peer.reconnect();
      return;
    }
    const silencio = ahora - this.ultimoMensaje;
    if (silencio > SILENCIO_PERDIDO) {
      this.perder();
      return;
    }
    if (silencio < SILENCIO_RECONECTAR) return;
    // El peer pierde su enlace con el servidor de PeerJS al dormir: lo recuperamos
    if (this.peer && this.peer.disconnected && !this.peer.destroyed) this.peer.reconnect();
    this.reconectar(); // solo el invitado vuelve a llamar; el anfitrión espera
  }

  /** INVITADO: el anfitrión ya no está. Se avisa a la escena y se cierra todo */
  perder() {
    if (this.cerrada) return;
    this.emit('desconectado');
    this.cerrar();
  }

  /** ANFITRIÓN: un invitado se fue. Los demás siguen en la sala */
  quitar(clave) {
    const inv = this.invitados.get(clave);
    if (!inv) return;
    this.invitados.delete(clave);
    if (inv.con.open) inv.con.close();
    const perfil = this.perfiles.get(clave);
    this.perfiles.delete(clave);
    this.emit('desconectado', clave, perfil);
    this.difundirLista();
  }

  /** INVITADO: abre una conexión nueva al mismo código de sala (con su misma clave) */
  reconectar() {
    const ahora = performance.now();
    if (ahora - this.ultimoIntento < REINTENTO_MS) return;
    if (!this.peer || this.peer.destroyed || !this.peer.open || !this.codigo) return;
    this.ultimoIntento = ahora;
    this.prepararConexion(this.peer.connect(PREFIJO + this.codigo, { reliable: true, metadata: { clave: this.clave } }));
  }

  // ---------------- Crear y unirse ----------------

  /** ANFITRIÓN: crea la sala. alListo(codigo) se llama cuando ya se puede compartir el código */
  crearSala(alListo, alError, intentos = 0) {
    this.esAnfitrion = true;
    const codigo = String(Phaser.Math.Between(1000, 9999));
    this.codigo = codigo;
    this.peer = new Peer(PREFIJO + codigo);
    this.peer.on('open', () => {
      this.presentarme(); // yo también estoy en la lista de jugadores
      alListo(codigo);
    });
    this.peer.on('connection', (con) => {
      const clave = con.metadata && con.metadata.clave;
      const conocido = clave && this.invitados.has(clave); // ¿es alguien que se está RECONECTANDO?
      // Sala llena o ya jugando: se le avisa y se corta (salvo que vuelva alguien que ya estaba)
      if (!clave || (!conocido && (this.invitados.size >= MAX_JUGADORES - 1 || this.enPartida))) {
        con.on('open', () => { con.send({ t: 'llena' }); setTimeout(() => con.close(), 400); });
        return;
      }
      this.prepararConexion(con, clave);
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
    this.alError = alError;
    this.peer = new Peer();
    this.peer.on('open', () => {
      this.prepararConexion(this.peer.connect(PREFIJO + codigo, { reliable: true, metadata: { clave: this.clave } }));
    });
    this.peer.on('error', (error) => {
      if (!this.yaConectado) alError(error);
      // Reconectando: si la sala ya no existe, el anfitrión se fue de verdad
      else if (error.type === 'peer-unavailable') this.perder();
    });
  }

  /**
   * Prepara una conexión. En el anfitrión, "clave" dice de qué invitado es.
   */
  prepararConexion(con, clave = null) {
    con.on('open', () => {
      this.ultimoMensaje = performance.now();
      if (this.esAnfitrion) {
        const vieja = this.invitados.get(clave);
        this.invitados.set(clave, { con, ultimoMensaje: performance.now() });
        if (vieja && vieja.con !== con) vieja.con.close();
        this.yaConectado = true;
        this.emit(vieja ? 'reconectado' : 'conectado', clave);
        return;
      }
      const vieja = this.con;
      this.con = con; // la conexión nueva reemplaza a la vieja
      if (vieja && vieja !== con) vieja.close();
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
      if (this.esAnfitrion) {
        const inv = this.invitados.get(clave);
        if (!inv || inv.con !== con) return; // una conexión vieja que ya se reemplazó
        inv.ultimoMensaje = performance.now();
      }
      if (mensaje.t === 'p') return; // solo un latido
      if (mensaje.t === 'adios') { // salió a propósito
        if (this.esAnfitrion) this.quitar(clave);
        else this.perder();
        return;
      }
      if (mensaje.t === 'llena') { // INVITADO: no hay lugar
        const alError = this.alError;
        this.cerrar();
        if (alError) alError({ type: 'llena' });
        return;
      }
      // ANFITRIÓN: un invitado se presentó (o cambió de héroe): se guarda y se cuenta a todos
      if (this.esAnfitrion && (mensaje.t === 'hola' || mensaje.t === 'raza')) {
        this.perfiles.set(clave, { clave, nick: String(mensaje.nick || '').slice(0, 12), pj: mensaje.pj || null });
        this.difundirLista();
      }
      // INVITADO: la lista de todos los jugadores (la manda el anfitrión)
      if (!this.esAnfitrion && mensaje.t === 'lista') {
        this.perfiles = new Map(mensaje.j.map((p) => [p.clave, p]));
      }
      this.emit(mensaje.t, mensaje, clave);
    });
    // Si se cierra, NO avisamos enseguida: puede ser la pantalla apagada.
    // vigilar() intentará reconectar y, si no puede en mucho rato, avisará.
    con.on('close', () => {
      if (!this.esAnfitrion && !this.yaConectado) this.perder(); // falló antes de empezar
    });
  }

  /**
   * Les cuenta a los demás quién soy: mi personaje y mi nombre.
   * tipo 'hola' = al conectarse; 'raza' = cambié algo (subí de nivel, otro personaje...)
   */
  presentarme(tipo = 'raza') {
    const p = personaje();
    const perfil = { clave: this.clave, nick: nick(), pj: p ? paraLaRed(p) : null };
    if (this.esAnfitrion) {
      this.perfiles.set(this.clave, perfil);
      this.difundirLista();
    } else {
      this.enviar({ t: tipo, pj: perfil.pj, nick: perfil.nick });
    }
  }

  /** ANFITRIÓN: manda a todos la lista de jugadores (y avisa a sus propias pantallas) */
  difundirLista() {
    if (!this.esAnfitrion) return;
    this.enviar({ t: 'lista', j: [...this.perfiles.values()] });
    this.emit('lista');
  }

  // ---------------- Enviar y escuchar ----------------

  /** ¿Hay alguien conectado? (anfitrión: al menos un invitado) */
  get conectado() {
    if (this.esAnfitrion) return [...this.invitados.values()].some((inv) => inv.con.open);
    return !!(this.con && this.con.open);
  }

  /** Manda un mensaje: el invitado, al anfitrión; el anfitrión, a TODOS los invitados */
  enviar(mensaje) {
    if (this.esAnfitrion) {
      for (const inv of this.invitados.values()) if (inv.con.open) inv.con.send(mensaje);
    } else if (this.con && this.con.open) {
      this.con.send(mensaje);
    }
  }

  /** ANFITRIÓN: manda un mensaje a UN solo invitado */
  enviarA(clave, mensaje) {
    const inv = this.invitados.get(clave);
    if (inv && inv.con.open) inv.con.send(mensaje);
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
    this.enviar({ t: 'adios' }); // los demás se enteran al instante
    if (this.con) this.con.close();
    for (const inv of this.invitados.values()) inv.con.close();
    if (this.peer && !this.peer.destroyed) this.peer.destroy();
    this.removeAllListeners();
    if (actual === this) actual = null;
  }
}
