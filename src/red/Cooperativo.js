// =============================================================
// Cooperativo (Etapa 9): la partida de a dos, dentro de la escena de juego
//
// ANFITRIÓN (el que creó la sala): es el "árbitro". Calcula TODO:
//   enemigos, daño, salas, jefes. Unas 15 veces por segundo le envía al
//   invitado una "foto" del juego (mensaje "estado").
// INVITADO: mueve a su propio héroe en su celular (así se siente rápido)
//   y envía su posición ("yo") y sus botones ("hab"). Lo demás solo lo
//   DIBUJA según lo que manda el anfitrión.
//
// Mensajes: estado, yo, hab, nace, muerte, efecto, disparo, aviso,
//           puerta, anuncio, fin, iniciar, esperar.
// =============================================================

import Enemigo from '../entidades/Enemigo.js';
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
    this.ultimoYo = null;     // anfitrión: última posición del invitado
    this.ultimoEstado = null; // invitado: última foto del anfitrión

    const oir = (tipo, funcion) => red.escuchar(escena, tipo, funcion);
    if (this.esAnfitrion) {
      oir('yo', (m) => { this.ultimoYo = m; });
      oir('hab', (m) => escena.ejecutarRemota(m.h));
    } else {
      oir('estado', (m) => { this.ultimoEstado = m; });
      oir('nace', (m) => this.crearRemoto(m));
      oir('muerte', (m) => this.morirRemoto(m));
      oir('efecto', (m) => escena.efectoRemoto(m));
      oir('disparo', (m) => escena.dispararProyectil(m.x, m.y, m.a, { velocidad: m.v, danio: 0, duracionMs: m.ms }, m.c));
      oir('aviso', (m) => this.dibujarAviso(m));
      oir('puerta', (m) => escena.mazmorra.abrirPuerta(m.i));
      oir('anuncio', (m) => escena.mostrarAnuncio(m.texto, true));
      oir('fin', (m) => this.fin(m));
      oir('iniciar', (m) => escena.scene.restart({ mundo: m.mundo, coop: true, invitado: true }));
      oir('esperar', () => escena.scene.start('EscenaSala', { esperando: true }));
    }
    oir('desconectado', () => escena.companeroDesconectado());
  }

  enviar(mensaje) {
    this.red.enviar(mensaje);
  }

  /** Cada frame */
  actualizar() {
    const e = this.escena;
    const ahora = e.time.now;
    if (this.esAnfitrion) {
      // Pone al héroe del invitado donde él dice que está
      const m = this.ultimoYo;
      if (m && e.companero) e.companero.colocarRemoto(m.x, m.y, m.mx, m.my, m.mov);
      if (ahora >= this.proximoEnvio) {
        this.proximoEnvio = ahora + ENVIO_ANFITRION_MS;
        this.enviar(this.foto());
      }
      return;
    }

    // INVITADO: envía su posición y aplica la última foto
    if (ahora >= this.proximoEnvio) {
      this.proximoEnvio = ahora + ENVIO_INVITADO_MS;
      const h = e.heroe;
      const mov = e.direccion.lengthSq() > 0;
      this.enviar({ t: 'yo', x: Math.round(h.cuerpo.x), y: Math.round(h.cuerpo.y), mx: +h.mirando.x.toFixed(2), my: +h.mirando.y.toFixed(2), mov });
    }
    if (this.ultimoEstado) this.aplicarFoto(this.ultimoEstado);
  }

  /** ANFITRIÓN: la "foto" del juego en este momento (números redondeados = mensaje más chico) */
  foto() {
    const e = this.escena;
    const h = e.heroe;
    return {
      t: 'estado',
      a: [Math.round(h.cuerpo.x), Math.round(h.cuerpo.y), +h.mirando.x.toFixed(2), +h.mirando.y.toFixed(2), Math.round(h.vida), h.cuerpo.body.velocity.lengthSq() > 0 ? 1 : 0],
      b: e.companero ? Math.round(e.companero.vida) : 0,
      e: e.enemigos.map((en) => [en.id, Math.round(en.cuerpo.x), Math.round(en.cuerpo.y), +en.sprite.rotation.toFixed(2), Math.round(en.vida)]),
      h: [e.oleadasVencidas, e.jefesVencidos, e.curas, e.derrotados],
    };
  }

  /** INVITADO: dibuja la foto recibida */
  aplicarFoto(m) {
    const e = this.escena;
    const [x, y, mx, my, vida, mov] = m.a;
    if (e.companero) {
      e.companero.vida = vida;
      e.companero.colocarRemoto(x, y, mx, my, mov === 1);
    }
    // Mi vida la decide el anfitrión
    if (m.b < e.heroe.vida) e.efectoDanioPropio();
    e.heroe.vida = m.b;

    for (const [id, ex, ey, ang, evida] of m.e) {
      const en = this.remotos.get(id);
      if (!en) continue;
      en.cuerpo.body.reset(ex, ey);
      en.vida = evida;
      en.colocarDibujo(ang);
    }
    [e.oleadasVencidas, e.jefesVencidos, e.curas, e.derrotados] = m.h;
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
    if (m.tipo === 'victoria') marcarSuperado(e.indiceMundo); // el invitado también avanza
    e.terminado = true;
    e.pantallaFinal(m.titulo, `${m.texto}\n\nEsperando a tu compañero...`, [
      { texto: 'Salir', accion: () => { this.red.cerrar(); e.scene.start('EscenaTitulo'); } },
    ]);
  }
}
