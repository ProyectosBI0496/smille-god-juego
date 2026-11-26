// =============================================================
// Cooperativo (Etapa 9): la partida en grupo, dentro de la escena de juego
// v0.1.9: hasta 3 jugadores (el anfitrión + 2 invitados).
//
// ANFITRIÓN (el que creó la sala): es el "árbitro". Calcula TODO:
//   enemigos, daño, salas, jefes. Unas 15 veces por segundo les envía a los
//   invitados una "foto" del juego (mensaje "estado") con TODOS los héroes.
// INVITADO: mueve a su propio héroe en su celular (así se siente rápido)
//   y envía su posición ("yo") y sus botones ("hab"). Lo demás solo lo
//   DIBUJA según lo que manda el anfitrión (también al otro invitado).
// Cada héroe se reconoce por la CLAVE de su jugador (ver Red.js).
//
// Mensajes: estado, yo, hab, nace, muerte, efecto, disparo, aviso,
//           puerta, anuncio, fin, iniciar, esperar.
// =============================================================

import Enemigo from '../entidades/Enemigo.js';
import Jefe from '../entidades/Jefe.js';
import { marcarSuperado } from '../datos/Progreso.js';

const ENVIO_ANFITRION_MS = 66; // ~15 fotos por segundo
const ENVIO_INVITADO_MS = 50;  // ~20 posiciones por segundo

export default class Cooperativo {
  constructor(escena, red) {
    this.escena = escena;
    this.red = red;
    this.esAnfitrion = !escena.esInvitado;
    this.proximoEnvio = 0;
    this.siguienteId = 1;
    this.remotos = new Map(); // invitado: id → enemigo dibujado
    this.ultimosYo = new Map(); // anfitrión: clave → última posición de cada invitado
    this.ultimoEstado = null; // invitado: última foto del anfitrión

    const oir = (tipo, funcion) => red.escuchar(escena, tipo, funcion);
    if (this.esAnfitrion) {
      oir('yo', (m, clave) => { this.ultimosYo.set(clave, m); });
      oir('hab', (m, clave) => {
        escena.ejecutarRemota(clave, m.h);
        // Los OTROS invitados también tienen que ver ese ataque (se manda a todos; cada uno ignora el suyo)
        if (m.h !== 'pocionVida') this.enviar({ t: 'efecto', h: m.h, ang: m.ang || 0, c: clave });
      });
      oir('reconectado', (clave) => this.sincronizar(clave)); // v0.1.2: volvió tras apagar la pantalla
    } else {
      oir('sync', (m) => this.recibirSincronia(m));
      oir('estado', (m) => { this.ultimoEstado = m; });
      oir('control', (m) => escena.aplicarControl(escena.heroe, m.tipo, m.ms)); // v0.1.9: me aturdieron o amarraron
      oir('nace', (m) => this.crearRemoto(m));
      oir('muerte', (m) => this.morirRemoto(m));
      oir('efecto', (m) => { if (m.c !== red.clave) escena.efectoRemoto(m); }); // el mío ya lo dibujé
      oir('disparo', (m) => escena.dispararProyectil(m.x, m.y, m.a, { velocidad: m.v, danio: 0, duracionMs: m.ms }, m.c));
      oir('aviso', (m) => this.dibujarAviso(m));
      oir('puerta', (m) => escena.mazmorra.vencerSala(m.i));
      oir('anuncio', (m) => escena.mostrarAnuncio(m.texto, true));
      oir('fin', (m) => this.fin(m));
      oir('iniciar', (m) => escena.scene.restart({ mundo: m.mundo, dificultad: m.dificultad, coop: true, invitado: true }));
      oir('esperar', () => escena.scene.start('EscenaSala', { esperando: true }));
    }
    oir('desconectado', (clave) => escena.companeroDesconectado(clave));
  }

  /** A todos (el anfitrión) o al anfitrión (el invitado) */
  enviar(mensaje) {
    this.red.enviar(mensaje);
  }

  /** v0.1.9: el anfitrión le manda algo a UN invitado (por su clave) */
  enviarA(clave, mensaje) {
    this.red.enviarA(clave, mensaje);
  }

  /** Cada frame */
  actualizar() {
    const e = this.escena;
    const ahora = e.time.now;
    if (this.esAnfitrion) {
      // Pone al héroe de cada invitado donde él dice que está
      for (const [clave, m] of this.ultimosYo) {
        const h = e.companeros.get(clave);
        if (h) h.colocarRemoto(m.x, m.y, m.mx, m.my, m.mov);
      }
      if (ahora >= this.proximoEnvio) {
        this.proximoEnvio = ahora + ENVIO_ANFITRION_MS;
        this.enviar(this.foto());
      }
      return;
    }

    // INVITADO: si hace rato no llega nada del anfitrión, se avisa en pantalla
    const silencio = performance.now() - this.red.ultimoMensaje;
    this.mostrarEspera(silencio > 1500);

    // INVITADO: envía su posición y aplica la última foto
    if (ahora >= this.proximoEnvio) {
      this.proximoEnvio = ahora + ENVIO_INVITADO_MS;
      const h = e.heroe;
      const mov = e.direccion.lengthSq() > 0;
      this.enviar({ t: 'yo', x: Math.round(h.cuerpo.x), y: Math.round(h.cuerpo.y), mx: +h.mirando.x.toFixed(2), my: +h.mirando.y.toFixed(2), mov });
    }
    if (this.ultimoEstado) this.aplicarFoto(this.ultimoEstado);
  }

  /**
   * Cartel "Esperando a tu compañero": aparece si el juego del anfitrión se detuvo
   * (por ejemplo, porque apagó la pantalla o cambió de app: el navegador lo pausa).
   */
  mostrarEspera(visible) {
    const e = this.escena;
    if (!this.cartel) {
      this.cartel = e.add.text(e.scale.baseSize.width / 2, e.scale.baseSize.height / 2 + 40,
        'Esperando a tu compañero...\nSu pantalla debe estar encendida y con el juego abierto', {
          fontFamily: 'Arial, sans-serif', fontSize: '26px', color: '#ffffff', align: 'center',
          backgroundColor: '#000000aa', padding: { x: 16, y: 10 },
        }).setOrigin(0.5).setScrollFactor(0).setDepth(180).setVisible(false);
    }
    if (this.cartel.visible !== visible && !e.terminado) this.cartel.setVisible(visible);
  }

  /** ANFITRIÓN: la "foto" del juego en este momento (números redondeados = mensaje más chico) */
  foto() {
    const e = this.escena;
    // v0.1.9: un renglón por héroe: [clave, x, y, mira x, mira y, vida, ¿se mueve?]
    const fila = (h, clave) => [clave, Math.round(h.cuerpo.x), Math.round(h.cuerpo.y), +h.mirando.x.toFixed(2), +h.mirando.y.toFixed(2),
      Math.round(h.vida), h.cuerpo.body.velocity.lengthSq() > 0 || this.ultimosYo.get(clave)?.mov ? 1 : 0];
    return {
      t: 'estado',
      j: [fila(e.heroe, this.red.clave), ...[...e.companeros].map(([clave, h]) => fila(h, clave))],
      e: e.enemigos.map((en) => [en.id, Math.round(en.cuerpo.x), Math.round(en.cuerpo.y), +en.sprite.rotation.toFixed(2), Math.round(en.vida)]),
      h: [e.oleadasVencidas, e.jefesVencidos, e.derrotados], // v0.1.4: sin curas (ahora hay pociones)
    };
  }

  /** INVITADO: dibuja la foto recibida */
  aplicarFoto(m) {
    const e = this.escena;
    for (const [clave, x, y, mx, my, vida, mov] of m.j) {
      if (clave === this.red.clave) {
        // Mi vida la decide el anfitrión (mi posición la decido yo)
        if (vida < e.heroe.vida - 0.5) e.efectoDanioPropio();
        e.heroe.vida = vida;
        continue;
      }
      const h = e.companeros.get(clave);
      if (!h) continue;
      h.vida = vida;
      h.colocarRemoto(x, y, mx, my, mov === 1);
    }

    for (const [id, ex, ey, ang, evida] of m.e) {
      const en = this.remotos.get(id);
      if (!en) continue;
      en.cuerpo.body.reset(ex, ey);
      en.vida = evida;
      en.colocarDibujo(ang);
    }
    [e.oleadasVencidas, e.jefesVencidos, e.derrotados] = m.h;
    e.actualizarHud();
    this.ultimoEstado = null; // ya aplicada
  }

  // ---------------- Avisos del anfitrión (solo los manda él) ----------------

  /** Un enemigo nuevo: le da un número (id) y se lo cuenta al invitado */
  nace(enemigo, esJefe) {
    enemigo.id = this.siguienteId++;
    const c = enemigo.config;
    this.enviar({
      t: 'nace', id: enemigo.id, x: Math.round(enemigo.cuerpo.x), y: Math.round(enemigo.cuerpo.y), jefe: esJefe,
      cfg: { textura: c.textura, radio: c.radio, color: c.color, vidaMax: c.vidaMax, radioTextura: c.radioTextura },
    });
  }

  /**
   * v0.1.2 — Un invitado se RECONECTÓ (por ejemplo, apagó la pantalla un rato).
   * Mientras no estaba se perdió avisos de enemigos nuevos o muertos, así que le
   * mandamos la lista COMPLETA: enemigos vivos y salas ya vencidas (rejas abiertas).
   */
  sincronizar(clave) {
    const e = this.escena;
    const enemigos = e.enemigos.filter((en) => en.id).map((en) => {
      const c = en.config;
      return {
        id: en.id, x: Math.round(en.cuerpo.x), y: Math.round(en.cuerpo.y), jefe: en instanceof Jefe,
        cfg: { textura: c.textura, radio: c.radio, color: c.color, vidaMax: c.vidaMax, radioTextura: c.radioTextura },
      };
    });
    const vencidas = e.mazmorra.salas.map((sala, i) => (sala.estado === 'vencida' ? i : -1)).filter((i) => i >= 0);
    this.enviarA(clave, { t: 'sync', en: enemigos, v: vencidas }); // solo al que volvió
  }

  /** INVITADO: borra lo que tenía dibujado y lo arma de nuevo con la lista del anfitrión */
  recibirSincronia(m) {
    const e = this.escena;
    for (const en of this.remotos.values()) en.destruir();
    e.enemigos = [];
    this.remotos.clear();
    for (const datos of m.en) this.crearRemoto(datos);
    for (const i of m.v) e.mazmorra.vencerSala(i);
  }

  aviso(x, y, angulo, largo, ancho, ms) {
    this.enviar({ t: 'aviso', x: Math.round(x), y: Math.round(y), a: +angulo.toFixed(3), l: Math.round(largo), w: Math.round(ancho), ms });
  }

  // ---------------- Lo que el invitado dibuja ----------------

  crearRemoto(m) {
    const e = this.escena;
    const en = new Enemigo(e, m.x, m.y, { ...m.cfg, velocidad: 0, aturdidoMs: 0, danioContacto: 0 });
    en.id = m.id;
    en.esJefe = m.jefe;
    e.enemigos.push(en);
    this.remotos.set(m.id, en);
  }

  morirRemoto(m) {
    const e = this.escena;
    const en = this.remotos.get(m.id);
    if (!en) return;
    e.efectoMuerte(en.cuerpo.x, en.cuerpo.y, en.esJefe);
    en.destruir();
    e.enemigos = e.enemigos.filter((x) => x !== en);
    this.remotos.delete(m.id);
  }

  /** La franja roja de la embestida del jefe */
  dibujarAviso(m) {
    const franja = this.escena.add.rectangle(m.x, m.y, m.l, m.w, 0xff1744, 0.3)
      .setOrigin(0, 0.5).setRotation(m.a).setDepth(7);
    this.escena.tweens.add({ targets: franja, alpha: 0.55, duration: 150, yoyo: true, repeat: -1 });
    this.escena.time.delayedCall(m.ms, () => franja.destroy());
  }

  /** Fin de la partida (victoria o derrota), decidido por el anfitrión */
  fin(m) {
    const e = this.escena;
    if (m.tipo === 'victoria') marcarSuperado(e.indiceMundo, e.dificultad); // el invitado también avanza
    e.terminado = true;
    // Mis cofres los abro yo, en mi celular (los jefes vencidos llegan en cada "foto")
    e.pantallaFinal(m.titulo, `${m.texto}\nEsperando al anfitrión...`, e.premiosFinales(m.tipo === 'victoria'), [
      { texto: 'Salir', accion: () => { this.red.cerrar(); e.scene.start('EscenaTitulo'); } },
    ]);
  }
}
