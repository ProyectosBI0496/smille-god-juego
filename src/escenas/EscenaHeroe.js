// =============================================================
// Mis héroes (v0.1.5; antes aquí se elegía la raza y luego la clase)
// Todos los héroes (raza + clase) en el ORDEN DE LA ESCALA del creador
// (balance.json → escala). Cada tarjeta muestra su estado:
//   - Creado:     nivel y RANGO (según sus coronas). Tocar = jugar con él.
//   - Abierto:    gratis o ya pagado, pero sin crear. Tocar = elegir el rol.
//   - Bloqueado:  pide coronas del jugador, un rango y fichas de facción.
//                 Si cumple todo, tocar = pagar y abrirlo.
// Son muchos héroes: se muestran por páginas (18 por página).
// =============================================================

import { crearTexturas } from '../graficos/Texturas.js';
import { crearVineta, reiniciarAlCambiarTamano } from '../ui/Pantalla.js';
import { color } from '../graficos/TexturasMundo.js';
import { FUENTE_TITULO } from './EscenaArena.js';
import { cuentaParaEscala, elegirHeroe, abrirHeroe, personaje } from '../datos/Progreso.js';
import { estadoEscala, rangoDe, idHeroe } from '../datos/Personaje.js';
import { redActual, seguirPareja } from '../red/Red.js';
import { mostrarTutorial } from '../ui/Tutorial.js'; // v0.1.16: guía con flechas

const TEXTO = { fontFamily: 'Arial, sans-serif', color: '#ffffff' };
const COLUMNAS = 6;
const FILAS = 3;

export default class EscenaHeroe extends Phaser.Scene {
  constructor() {
    super('EscenaHeroe');
  }

  // volverA: a dónde ir al terminar (mapa o sala de pareja). pagina: la que se estaba viendo.
  init(datos) {
    this.volverA = (datos && datos.volverA) || 'EscenaMundos';
    this.datosVolver = (datos && datos.datosVolver) || {};
    this.pagina = datos && Number.isInteger(datos.pagina) ? datos.pagina : null;
  }

  create() {
    crearTexturas(this);
    const W = this.scale.baseSize.width;
    const H = this.scale.baseSize.height;
    this.balance = this.cache.json.get('balance');
    this.cuenta = cuentaParaEscala();
    this.lista = estadoEscala(this.balance, this.cuenta);
    const actual = personaje();
    this.idActual = actual ? idHeroe(actual.raza, actual.clase) : '';

    // Al entrar, se abre la página donde está el héroe con el que juega
    const porPagina = COLUMNAS * FILAS;
    this.paginas = Math.ceil(this.lista.length / porPagina);
    if (this.pagina === null) this.pagina = Math.max(0, Math.floor(this.lista.findIndex((e) => e.id === this.idActual) / porPagina));

    this.cameras.main.fadeIn(250);
    this.add.tileSprite(0, 0, W, H, 'baldosa-2').setOrigin(0).setTint(0x6a6a80);
    crearVineta(this);
    reiniciarAlCambiarTamano(this);
    this.add.text(W / 2, 32, 'Mis héroes', {
      fontFamily: FUENTE_TITULO, fontSize: '40px', color: '#f5c542', fontStyle: 'bold', stroke: '#3a1500', strokeThickness: 7,
    }).setOrigin(0.5);
    const creados = this.lista.filter((e) => e.creado).length;
    this.add.text(W / 2, 74, `👑 ${this.cuenta.coronas} coronas del jugador    🔰 ${this.cuenta.fichasFaccion} fichas de facción    Héroes: ${creados} de ${this.lista.length}`, {
      ...TEXTO, fontSize: '19px', stroke: '#05070d', strokeThickness: 3,
    }).setOrigin(0.5);

    // Tarjetas de esta página
    const ancho = Math.min(200, (W - 40) / COLUMNAS - 10);
    const alto = Math.min(178, (H - 100 - 70) / FILAS - 10);
    const pagina = this.lista.slice(this.pagina * porPagina, (this.pagina + 1) * porPagina);
    pagina.forEach((e, i) => {
      const col = i % COLUMNAS;
      const fila = Math.floor(i / COLUMNAS);
      const x = W / 2 + (col - (COLUMNAS - 1) / 2) * (ancho + 10);
      const y = 100 + alto / 2 + fila * (alto + 10);
      this.crearTarjeta(x, y, ancho, alto, e, this.pagina * porPagina + i + 1);
    });

    // Abajo: páginas, mensaje y volver
    this.crearPaginas(W / 2, H - 34);
    this.mensaje = this.add.text(W - 24, H - 34, '', { ...TEXTO, fontSize: '16px', color: '#ef9a9a', align: 'right' }).setOrigin(1, 0.5);
    const volver = this.add.text(24, H - 14, '← Volver', {
      fontFamily: FUENTE_TITULO, fontSize: '26px', color: '#f5c542', stroke: '#05070d', strokeThickness: 4,
    }).setOrigin(0, 1).setInteractive();
    volver.on('pointerdown', () => {
      if (actual) this.scene.start('EscenaPersonaje', { volverA: this.volverA, datosVolver: this.datosVolver });
      else this.scene.start(this.volverA === 'EscenaSala' ? 'EscenaSala' : 'EscenaTitulo', this.datosVolver);
    });
    seguirPareja(this); // si el anfitrión empieza la partida, el invitado entra aunque esté aquí

    // v0.1.16: guía con flechas (la primera vez)
    mostrarTutorial(this, 'heroes', [
      { texto: 'MIS HÉROES: aquí están todos los héroes del juego. Cada uno es una RAZA + una CLASE.', objetivo: { texto: 'Mis héroes' } },
      { texto: 'Las CORONAS 👑 se ganan en las mazmorras. Con coronas, rango y fichas de facción 🔰 se abren héroes nuevos.', objetivo: { texto: 'coronas del jugador' } },
      { texto: 'Toca un héroe que diga ✚ Crear para crearlo. Cada héroe guarda su propio nivel y equipo.', objetivo: { texto: '✚ Crear' } },
      { texto: 'Con ◀ y ▶ ves más héroes.', objetivo: { texto: ` / ${this.paginas}` } },
    ]);
  }

  /** "◀  2 / 4  ▶" */
  crearPaginas(x, y) {
    const estilo = { fontFamily: FUENTE_TITULO, fontSize: '30px', fontStyle: 'bold', color: '#f5c542', stroke: '#05070d', strokeThickness: 4 };
    this.add.text(x, y, `${this.pagina + 1} / ${this.paginas}`, { ...estilo, fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
    const flecha = (dx, texto, nueva) => {
      const activa = nueva >= 0 && nueva < this.paginas;
      const t = this.add.text(x + dx, y, texto, { ...estilo, color: activa ? '#f5c542' : '#555555' }).setOrigin(0.5);
      if (activa) t.setPadding(18, 6).setInteractive().on('pointerdown', () => this.irAPagina(nueva));
    };
    flecha(-90, '◀', this.pagina - 1);
    flecha(90, '▶', this.pagina + 1);
  }

  irAPagina(pagina) {
    this.scene.restart({ volverA: this.volverA, datosVolver: this.datosVolver, pagina });
  }

  crearTarjeta(x, y, ancho, alto, e, numero) {
    const b = this.balance;
    const raza = b.razas[e.raza];
    const clase = b.clases[e.clase];
    const bando = b.bandos.find((bd) => bd.razas.includes(e.raza));
    const actual = e.id === this.idActual;
    const apagada = !e.abierto && !e.creado;
    const arriba = y - alto / 2;

    const marco = actual ? 0xf5c542 : color(bando ? bando.color : '#ffffff');
    this.add.rectangle(x, y, ancho, alto, 0x0b0f1a, 0.8).setStrokeStyle(actual ? 4 : 2, marco, apagada ? 0.35 : 0.85);
    this.add.text(x - ancho / 2 + 6, arriba + 4, `#${numero}`, { ...TEXTO, fontSize: '11px', color: '#78909c' });

    // El héroe con un aura del color de su clase
    const yCuerpo = arriba + 38;
    this.add.image(x, yCuerpo, 'brillo').setTint(color(clase.color)).setAlpha(apagada ? 0.1 : 0.45).setScale(0.7)
      .setBlendMode(Phaser.BlendModes.ADD);
    const partes = [];
    if (raza.extra) partes.push(this.add.image(x, yCuerpo, `${e.raza}-${raza.extra}`).setScale(0.75).setAngle(-90));
    partes.push(this.add.image(x, yCuerpo, `${e.raza}-cuerpo`).setScale(0.75).setAngle(-90));
    if (apagada) partes.forEach((p) => p.setTint(0x333333));

    this.add.text(x, arriba + 74, `${raza.nombre}\n${clase.nombre}`, {
      fontFamily: FUENTE_TITULO, fontSize: '16px', fontStyle: 'bold', align: 'center', lineSpacing: -2,
      color: apagada ? '#8a8a8a' : clase.color, stroke: '#05070d', strokeThickness: 3,
    }).setOrigin(0.5, 0);

    const yEstado = y + alto / 2 - 24;
    if (e.creado) {
      // Nivel y rango (con la insignia de su color)
      const h = this.cuenta.heroes[e.id];
      const rango = rangoDe(b, h.coronas || 0);
      this.add.circle(x - ancho / 2 + 22, yEstado, 9, color(rango.color)).setStrokeStyle(2, 0x05070d);
      this.add.text(x - ancho / 2 + 38, yEstado, `Nv ${h.nivel} · R${rango.rango} · 👑${h.coronas || 0}`, {
        ...TEXTO, fontSize: '14px', fontStyle: 'bold', color: '#ffffff',
      }).setOrigin(0, 0.5);
      if (actual) this.add.text(x + ancho / 2 - 6, arriba + 4, '▶ Jugando', { ...TEXTO, fontSize: '12px', color: '#f5c542', fontStyle: 'bold' }).setOrigin(1, 0);
    } else if (e.abierto) {
      this.add.text(x, yEstado, '✚ Crear', { ...TEXTO, fontSize: '16px', fontStyle: 'bold', color: '#a5d6a7' }).setOrigin(0.5);
    } else {
      // Requisitos: verde si ya lo cumple, rojo si falta
      const req = (ok) => (ok ? '#a5d6a7' : '#ef9a9a');
      const linea = this.add.text(x, yEstado - 9, `🔒 👑 ${e.coronas}  ·  Rango ${e.rango}`, {
        ...TEXTO, fontSize: '13px', color: e.okCoronas && e.okRango ? '#a5d6a7' : '#ef9a9a',
      }).setOrigin(0.5);
      if (e.okCoronas !== e.okRango) linea.setColor('#ffcc80'); // cumple una de las dos
      this.add.text(x, yEstado + 10, e.puedeAbrir ? `Abrir: 🔰 ${e.fichasFaccion}` : `🔰 ${e.fichasFaccion}`, {
        ...TEXTO, fontSize: e.puedeAbrir ? '15px' : '13px', fontStyle: e.puedeAbrir ? 'bold' : 'normal',
        color: e.puedeAbrir ? '#f5c542' : req(e.okFichas),
      }).setOrigin(0.5);
    }

    // Toda la tarjeta es un botón
    const zona = this.add.zone(x, y, ancho, alto).setInteractive();
    zona.on('pointerdown', () => this.tocar(e, partes));
  }

  /** Qué pasa al tocar una tarjeta, según su estado */
  tocar(e, partes) {
    const datos = { volverA: this.volverA, datosVolver: this.datosVolver };
    if (e.creado) {
      elegirHeroe(e.id);
      const red = redActual();
      if (red && red.conectado) red.presentarme(); // el compañero ve el héroe nuevo
      this.salirA('EscenaPersonaje', datos, partes);
    } else if (e.abierto) {
      this.salirA('EscenaRol', { ...datos, raza: e.raza, clase: e.clase }, partes);
    } else if (e.puedeAbrir) {
      if (abrirHeroe(e.id, e.fichasFaccion)) this.salirA('EscenaRol', { ...datos, raza: e.raza, clase: e.clase }, partes);
    } else {
      // Explica qué falta
      const faltan = [];
      if (!e.okCoronas) faltan.push(`${e.coronas - this.cuenta.coronas} coronas más`);
      if (!e.okRango) faltan.push(`un héroe en Rango ${e.rango}`);
      if (!e.okFichas) faltan.push(`${e.fichasFaccion - this.cuenta.fichasFaccion} fichas de facción`);
      this.mensaje.setText(`Para abrirlo te falta:\n${faltan.join(', ')}`);
      this.tweens.add({ targets: partes, x: '+=6', duration: 50, yoyo: true, repeat: 2 });
    }
  }

  salirA(escena, datos, partes) {
    this.tweens.add({ targets: partes, scale: 1.1, duration: 150, yoyo: true });
    this.cameras.main.fadeOut(250);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(escena, datos));
  }
}
