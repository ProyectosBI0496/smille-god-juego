// =============================================================
// Tienda de equipo (v0.1.3)
//   Tres columnas, una por RANURA: Arma, Armadura y Accesorio.
//   Cada objeto se COMPRA una vez (con intys o rubís) y queda en el
//   inventario de la cuenta. Después se EQUIPA o se QUITA gratis.
//   Solo se lleva un objeto por ranura.
//   El equipo regala puntos de estadísticas (balance.json → "equipo").
// Igual que la ficha: cada cambio se guarda y se vuelve a dibujar la escena.
// =============================================================

import { crearTexturas } from '../graficos/Texturas.js';
import { crearVineta, reiniciarAlCambiarTamano } from '../ui/Pantalla.js';
import { FUENTE_TITULO } from './EscenaArena.js';
import {
  personaje, guardarPersonaje, monedas, inventario, comprarObjeto,
} from '../datos/Progreso.js';
import {
  personajeValido, bonosEquipo, textoBonos, textoPrecio, nombrePersonaje,
} from '../datos/Personaje.js';
import { redActual, seguirPareja } from '../red/Red.js';

const TEXTO = { fontFamily: 'Arial, sans-serif', color: '#ffffff' };
const VERDE = 0x66bb6a;
const DORADO = 0xf5c542;

export default class EscenaTienda extends Phaser.Scene {
  constructor() {
    super('EscenaTienda');
  }

  init(datos) {
    // Guardamos a dónde volvía la ficha, para devolvérselo al salir
    this.datos = datos || {};
  }

  create() {
    const guardado = personaje();
    if (!guardado) { // sin personaje no hay a quién equipar
      this.scene.start('EscenaPersonaje', this.datos);
      return;
    }
    crearTexturas(this);
    const W = this.scale.baseSize.width;
    const H = this.scale.baseSize.height;
    this.balance = this.cache.json.get('balance');
    this.p = personajeValido(this.balance, guardado);
    this.comprados = inventario();
    this.monedas = monedas();
    this.cameras.main.fadeIn(200);
    this.add.tileSprite(0, 0, W, H, 'baldosa-2').setOrigin(0).setTint(0x6a6a80);
    crearVineta(this);
    reiniciarAlCambiarTamano(this);

    // Arriba: título y monedas
    this.add.text(W / 2, 40, 'Tienda de equipo', {
      fontFamily: FUENTE_TITULO, fontSize: '36px', fontStyle: 'bold', color: '#f5c542', stroke: '#05070d', strokeThickness: 6,
    }).setOrigin(0.5);
    const m = this.monedas;
    this.add.text(W / 2, 82, `${nombrePersonaje(this.balance, this.p)} · Nv ${this.p.nivel}      ☀️ ${m.intys} intys    💎 ${m.rubis} rubís`, {
      ...TEXTO, fontSize: '19px', stroke: '#05070d', strokeThickness: 3,
    }).setOrigin(0.5);

    // Una columna por ranura, repartidas a lo ancho
    const ranuras = Object.entries(this.balance.equipo.ranuras);
    const anchoCol = Math.min(400, (W - 60) / ranuras.length - 16);
    const paso = (W - 60) / ranuras.length;
    ranuras.forEach(([id, ranura], i) => this.crearColumna(30 + paso * (i + 0.5), anchoCol, id, ranura, H));

    // Abajo: volver a la ficha y el total que da el equipo puesto
    const volver = this.add.text(24, H - 14, '← Personaje', {
      fontFamily: FUENTE_TITULO, fontSize: '26px', color: '#f5c542', stroke: '#05070d', strokeThickness: 4,
    }).setOrigin(0, 1).setInteractive();
    volver.on('pointerdown', () => this.scene.start('EscenaPersonaje', this.datos));

    const bonos = Object.fromEntries(Object.entries(bonosEquipo(this.balance, this.p)).filter(([, n]) => n > 0));
    const total = Object.keys(bonos).length ? `Tu equipo da: ${textoBonos(this.balance, bonos)}` : 'No llevas equipo puesto';
    this.add.text(W - 24, H - 18, total, {
      ...TEXTO, fontSize: '17px', color: '#a5d6a7', stroke: '#05070d', strokeThickness: 3,
    }).setOrigin(1, 1);
    seguirPareja(this);
  }

  /** Una columna: el nombre de la ranura y debajo una tarjeta por objeto */
  crearColumna(cx, ancho, idRanura, ranura, H) {
    this.add.text(cx, 132, `${ranura.icono} ${ranura.nombre}`, {
      fontFamily: FUENTE_TITULO, fontSize: '26px', fontStyle: 'bold', color: '#ffe082', stroke: '#05070d', strokeThickness: 4,
    }).setOrigin(0.5);
    const objetos = Object.entries(this.balance.equipo.objetos).filter(([, o]) => o.ranura === idRanura);
    // Alto de cada tarjeta: lo que quepa entre el título y la barra de abajo (máximo 110)
    const alto = Math.min(110, (H - 175 - 70) / objetos.length - 10);
    objetos.forEach(([id, obj], i) => this.crearTarjeta(cx, 175 + i * (alto + 10) + alto / 2, ancho, alto, id, obj, idRanura));
  }

  crearTarjeta(cx, cy, ancho, alto, id, obj, idRanura) {
    const puesto = this.p.equipo[idRanura] === id;
    const comprado = this.comprados.includes(id);
    const nivelOk = this.p.nivel >= obj.nivel;
    const alcanza = Object.entries(obj.precio).every(([moneda, n]) => (this.monedas[moneda] || 0) >= n);

    this.add.rectangle(cx, cy, ancho, alto, 0x0b0f1a, 0.8)
      .setStrokeStyle(puesto ? 3 : 2, puesto ? VERDE : obj.especial ? DORADO : 0x546e7a, puesto ? 1 : 0.7);
    const izq = cx - ancho / 2 + 16;
    this.add.text(izq, cy - alto / 2 + 12, obj.nombre, {
      fontFamily: FUENTE_TITULO, fontSize: '21px', fontStyle: 'bold', color: obj.especial ? '#f5c542' : '#ffffff',
    });
    this.add.text(izq, cy - alto / 2 + 42, textoBonos(this.balance, obj.bonos), {
      ...TEXTO, fontSize: '14px', color: '#a5d6a7', wordWrap: { width: ancho - 160 },
    });
    let estado = comprado ? 'Comprado' : `Nivel ${obj.nivel}`;
    if (puesto) estado = '✔ Equipado';
    this.add.text(izq, cy + alto / 2 - 10, estado, {
      ...TEXTO, fontSize: '13px', color: puesto ? '#66bb6a' : !nivelOk ? '#ef9a9a' : '#90a4ae',
    }).setOrigin(0, 1);

    // El botón de la derecha cambia según el caso
    const bx = cx + ancho / 2 - 72;
    if (puesto) this.boton(bx, cy, 'Quitar', false, true, () => this.equipar(idRanura, null));
    else if (comprado) this.boton(bx, cy, 'Equipar', true, true, () => this.equipar(idRanura, id));
    else if (!nivelOk) this.boton(bx, cy, `Nv ${obj.nivel}`, false, false);
    else this.boton(bx, cy, textoPrecio(obj.precio), true, alcanza, () => this.comprar(id, obj, idRanura));
  }

  /** Botón pequeño (como el de la ficha, pero más angosto) */
  boton(x, y, texto, principal, activo, accion) {
    const fondo = this.add.rectangle(x, y, 120, 46, principal ? DORADO : 0x0b0f1a, activo ? 1 : 0.4)
      .setStrokeStyle(2, activo ? DORADO : 0x666666);
    this.add.text(x, y, texto, {
      fontFamily: FUENTE_TITULO, fontSize: '18px', fontStyle: 'bold',
      color: !activo ? '#777777' : principal ? '#1a0f00' : '#f5c542',
    }).setOrigin(0.5);
    if (activo) fondo.setInteractive().on('pointerdown', accion);
  }

  /** Comprar y ponérselo de una vez (lo normal es querer usarlo) */
  comprar(id, obj, idRanura) {
    if (!comprarObjeto(id, obj.precio)) return;
    this.equipar(idRanura, id);
  }

  /** Pone (o quita, con id = null) el objeto de una ranura, guarda y avisa al compañero */
  equipar(idRanura, id) {
    if (id) this.p.equipo[idRanura] = id;
    else delete this.p.equipo[idRanura];
    guardarPersonaje(this.p);
    const red = redActual();
    if (red && red.conectado) red.presentarme();
    this.scene.restart(this.datos);
  }
}
