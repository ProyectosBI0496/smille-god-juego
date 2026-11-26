// =============================================================
// Tienda de equipo (v0.1.3; v0.1.5: 8 espacios)
//   Izquierda: una pestaña por ESPACIO del cuerpo (mano derecha, mano
//              izquierda, casco, pecho, capa, pantalón, anillo, amuleto)
//              y una de POCIONES. Cada pestaña dice qué lleva puesto.
//   Derecha:   los 5 objetos de ese espacio, uno por tier (nivel 1, 6, 11,
//              16 y 21). Sus nombres y estadísticas dependen del ROL y del
//              arma de la raza + clase + rol (Excel de armas).
// Cada objeto se COMPRA una vez para el héroe actual; después se EQUIPA
// o se QUITA gratis. Un objeto por espacio. Las cuentas están en Personaje.js.
// v0.1.7: arriba de la lista se elige el SET (Básico, Moderno o God). Cada
// pieza se paga con intys O con rubís (dos botones). 4 u 8 piezas del mismo
// set dan un bono extra (Excel Sets_Ropa_Accesorios).
// =============================================================

import { crearTexturas } from '../graficos/Texturas.js';
import { crearVineta, reiniciarAlCambiarTamano } from '../ui/Pantalla.js';
import { color } from '../graficos/TexturasMundo.js';
import { FUENTE_TITULO } from './EscenaArena.js';
import {
  personaje, guardarPersonaje, monedas, inventario, comprarObjeto, pociones, comprarPocion,
} from '../datos/Progreso.js';
import {
  personajeValido, bonosEquipo, textoBonos, textoPrecio, nombrePersonaje, objetoEquipo, armaDe,
  piezaPuesta, bonoSet,
} from '../datos/Personaje.js';
import { redActual, seguirPareja } from '../red/Red.js';
import { mostrarTutorial } from '../ui/Tutorial.js'; // v0.1.16: guía con flechas

const TEXTO = { fontFamily: 'Arial, sans-serif', color: '#ffffff' };
const VERDE = 0x66bb6a;
const DORADO = 0xf5c542;

export default class EscenaTienda extends Phaser.Scene {
  constructor() {
    super('EscenaTienda');
  }

  init(datos) {
    // Guardamos a dónde volvía la ficha (y la pestaña abierta) para devolverlo al salir
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
    this.pestana = this.datos.pestana || 'manoDerecha';
    this.set = this.datos.set || 'basico'; // v0.1.7: set que se está mirando
    this.cameras.main.fadeIn(200);
    this.add.tileSprite(0, 0, W, H, 'baldosa-2').setOrigin(0).setTint(0x6a6a80);
    crearVineta(this);
    reiniciarAlCambiarTamano(this);

    // Arriba: título, héroe y monedas
    this.add.text(W / 2, 34, 'Tienda: equipo y pociones', {
      fontFamily: FUENTE_TITULO, fontSize: '34px', fontStyle: 'bold', color: '#f5c542', stroke: '#05070d', strokeThickness: 6,
    }).setOrigin(0.5);
    const m = this.monedas;
    this.add.text(W / 2, 74, `${nombrePersonaje(this.balance, this.p, true)} · Nv ${this.p.nivel}      ☀️ ${m.intys} intys    💎 ${m.rubis} rubís`, {
      ...TEXTO, fontSize: '19px', stroke: '#05070d', strokeThickness: 3,
    }).setOrigin(0.5);

    // Izquierda: pestañas. Derecha: lo que hay en la pestaña elegida.
    const anchoPestanas = 330;
    this.crearPestanas(30 + anchoPestanas / 2, anchoPestanas, H);
    const anchoLista = Math.min(760, W - anchoPestanas - 90);
    const cxLista = 30 + anchoPestanas + 30 + anchoLista / 2;
    if (this.pestana === 'pociones') this.crearPociones(cxLista, anchoLista);
    else this.crearObjetos(cxLista, anchoLista, H);

    // Abajo: volver a la ficha y el total que da el equipo puesto
    const volver = this.add.text(24, H - 14, '← Personaje', {
      fontFamily: FUENTE_TITULO, fontSize: '26px', color: '#f5c542', stroke: '#05070d', strokeThickness: 4,
    }).setOrigin(0, 1).setInteractive();
    volver.on('pointerdown', () => this.scene.start('EscenaPersonaje', this.datosSinPestana()));
    const bonos = bonosEquipo(this.balance, this.p);
    const total = textoBonos(this.balance, bonos);
    const set = bonoSet(this.balance, this.p); // v0.1.7: bono por llevar varias piezas del mismo set
    let textoTotal = total ? `Tu equipo da: ${total}` : 'No llevas equipo puesto';
    if (set.texto) textoTotal += `\n${set.texto}`;
    this.add.text(W - 24, H - 16, textoTotal, {
      ...TEXTO, fontSize: '16px', color: '#a5d6a7', stroke: '#05070d', strokeThickness: 3, align: 'right',
      wordWrap: { width: W - 260 },
    }).setOrigin(1, 1);
    seguirPareja(this);

    // v0.1.16: guía con flechas (la primera vez)
    const primerEspacio = Object.values(this.balance.equipo.ranuras)[0].nombre;
    mostrarTutorial(this, 'tienda', [
      { texto: 'La TIENDA: equipo para tu héroe y pociones.', objetivo: { texto: 'Tienda: equipo' } },
      { texto: 'A la izquierda están tus ESPACIOS de equipo (y las pociones). Toca uno para ver qué puedes comprar y qué llevas puesto.', objetivo: { texto: primerEspacio } },
      { texto: 'Elige el SET: Básico, Moderno o God. Llevar 4 u 8 piezas del mismo set da un BONO extra.', objetivo: { texto: 'Set ' } },
      { texto: 'Compra POCIONES de vida y de maná para usarlas en las mazmorras.', objetivo: { texto: 'Pociones' } },
      { texto: 'Cuando termines, vuelve a la ficha de tu héroe.', objetivo: { texto: '← Personaje' } },
    ]);
  }

  datosSinPestana() {
    const { pestana, set, ...resto } = this.datos; // "...resto" = todo menos la pestaña y el set
    return resto;
  }

  /** 8 espacios del cuerpo + pociones, uno debajo del otro */
  crearPestanas(cx, ancho, H) {
    const lista = [...Object.entries(this.balance.equipo.ranuras), ['pociones', { nombre: 'Pociones', icono: '🧪' }]];
    const alto = Math.min(58, (H - 105 - 70) / lista.length - 6);
    lista.forEach(([id, ranura], i) => {
      const y = 105 + alto / 2 + i * (alto + 6);
      const elegida = id === this.pestana;
      const fondo = this.add.rectangle(cx, y, ancho, alto, elegida ? 0x3a2a05 : 0x0b0f1a, 0.85)
        .setStrokeStyle(elegida ? 3 : 2, elegida ? DORADO : 0x546e7a, elegida ? 1 : 0.6);
      this.add.text(cx - ancho / 2 + 12, y - 9, `${ranura.icono} ${ranura.nombre}`, {
        fontFamily: FUENTE_TITULO, fontSize: '18px', fontStyle: 'bold', color: elegida ? '#f5c542' : '#ffe082',
      }).setOrigin(0, 0.5);
      // Debajo: lo que lleva puesto en ese espacio
      let detalle = '';
      let colorDetalle = '#78909c';
      if (id === 'pociones') {
        const mias = pociones();
        detalle = `Vida ${mias.vida} · Maná ${mias.mana}`;
      } else {
        const pieza = piezaPuesta(this.p, id);
        const obj = pieza ? objetoEquipo(this.balance, this.p, id, pieza.tier, pieza.set) : null;
        if (obj) {
          detalle = `${obj.nombre} (${obj.tierNombre} · ${obj.setNombre})`;
          colorDetalle = obj.color;
        } else if (!objetoEquipo(this.balance, this.p, id, 0)) detalle = 'Arma a 2 manos';
        else detalle = '— vacío —';
      }
      this.add.text(cx - ancho / 2 + 34, y + 12, detalle, {
        ...TEXTO, fontSize: '13px', color: colorDetalle, fixedWidth: ancho - 44,
      }).setOrigin(0, 0.5);
      fondo.setInteractive().on('pointerdown', () => this.scene.restart({ ...this.datos, pestana: id }));
    });
  }

  /** Los 5 objetos (tiers) del espacio elegido */
  crearObjetos(cx, ancho, H) {
    const b = this.balance;
    const ranura = b.equipo.ranuras[this.pestana];
    const arma = armaDe(b, this.p.raza, this.p.clase, this.p.rol);
    // Una línea arriba que explica el espacio
    let explicacion = '';
    if (this.pestana === 'manoDerecha') {
      explicacion = `${arma.estilo} · alcance ${arma.alcanceM} m · vel. de ataque ${arma.velAtaque}`;
      if (arma.mano === 'ninguno') explicacion += ` · a 2 manos: suma ×${b.equipo.dosManos}`;
    } else if (this.pestana === 'manoIzquierda') {
      const tipos = { escudo: 'Escudo', arma: 'Segunda arma', foco: 'Foco u objeto de apoyo', ninguno: '' };
      explicacion = `${tipos[arma.mano]} (según tu raza, clase y rol)`;
    } else {
      explicacion = `Para ${b.nombresRol[this.p.rol]}`;
    }
    this.add.text(cx, 108, `${ranura.icono} ${ranura.nombre}: ${explicacion}`, {
      ...TEXTO, fontSize: '16px', color: '#ffe082', align: 'center', wordWrap: { width: ancho },
    }).setOrigin(0.5);
    this.crearSelectorSet(cx, 142, ancho);

    const tiers = b.equipo.tiers;
    if (!objetoEquipo(b, this.p, this.pestana, 0)) {
      this.add.text(cx, H / 2, `Tu arma (${arma.principal}) es a 2 manos:\nno usas la mano izquierda, pero el arma suma ×${b.equipo.dosManos}.`, {
        ...TEXTO, fontSize: '20px', color: '#cfd8dc', align: 'center',
      }).setOrigin(0.5);
      return;
    }
    const arriba = 200;
    const alto = Math.min(90, (H - arriba - 70) / tiers.length - 8);
    tiers.forEach((t, tier) => {
      const obj = objetoEquipo(b, this.p, this.pestana, tier, this.set);
      this.crearTarjeta(cx, arriba + alto / 2 + tier * (alto + 8), ancho, alto, obj);
    });
  }

  /** v0.1.7: 3 botones para elegir el set (Básico, Moderno, God) y el bono que da */
  crearSelectorSet(cx, y, ancho) {
    const sets = Object.entries(this.balance.equipo.sets).filter(([id]) => id !== '_nota');
    const anchoBoton = (ancho - 20) / sets.length;
    sets.forEach(([id, s], i) => {
      const x = cx - ancho / 2 + anchoBoton / 2 + i * (anchoBoton + 10);
      const elegido = id === this.set;
      const fondo = this.add.rectangle(x, y, anchoBoton, 40, elegido ? color(s.color) : 0x0b0f1a, elegido ? 0.9 : 0.85)
        .setStrokeStyle(2, color(s.color), elegido ? 1 : 0.6);
      this.add.text(x, y, `Set ${s.nombre} ×${String(s.multiplicador).replace('.', ',')}`, {
        fontFamily: FUENTE_TITULO, fontSize: '17px', fontStyle: 'bold', color: elegido ? '#0b0f1a' : s.color,
      }).setOrigin(0.5);
      fondo.setInteractive().on('pointerdown', () => this.scene.restart({ ...this.datos, set: id }));
    });
    const s = this.balance.equipo.sets[this.set];
    this.add.text(cx, y + 34, `4 piezas: ${s.texto4}   ·   8 piezas: ${s.texto8}`, {
      ...TEXTO, fontSize: '13px', color: '#cfd8dc', align: 'center', wordWrap: { width: ancho },
    }).setOrigin(0.5);
  }

  crearTarjeta(cx, cy, ancho, alto, obj) {
    const pieza = piezaPuesta(this.p, obj.ranura);
    const puesto = !!pieza && pieza.tier === obj.tier && pieza.set === obj.set;
    const comprado = this.comprados.includes(obj.id);
    const nivelOk = this.p.nivel >= obj.nivel;
    const alcanza = (precio) => Object.entries(precio).every(([moneda, n]) => (this.monedas[moneda] || 0) >= n);
    const colorTier = color(obj.color);

    this.add.rectangle(cx, cy, ancho, alto, 0x0b0f1a, 0.85)
      .setStrokeStyle(puesto ? 3 : 2, puesto ? VERDE : colorTier, puesto ? 1 : 0.6);
    this.add.rectangle(cx - ancho / 2 + 4, cy, 6, alto - 8, colorTier); // franja del color del tier
    const izq = cx - ancho / 2 + 20;
    this.add.text(izq, cy - alto / 2 + 10, obj.nombre, {
      fontFamily: FUENTE_TITULO, fontSize: '19px', fontStyle: 'bold', color: obj.color,
      fixedWidth: ancho - 350,
    });
    this.add.text(izq, cy - 2, `${obj.tierNombre} · Nivel ${obj.nivel} · Set ${obj.setNombre}`, {
      ...TEXTO, fontSize: '13px', color: nivelOk ? '#90a4ae' : '#ef9a9a',
    }).setOrigin(0, 0.5);
    this.add.text(izq, cy + alto / 2 - 10, textoBonos(this.balance, obj.bonos), {
      ...TEXTO, fontSize: '15px', color: '#a5d6a7', fontStyle: 'bold',
    }).setOrigin(0, 1);

    // El botón de la derecha cambia según el caso
    const bx = cx + ancho / 2 - 85;
    if (puesto) this.boton(bx, cy, '✔ Quitar', false, true, () => this.equipar(obj.ranura, null));
    else if (comprado) this.boton(bx, cy, 'Equipar', true, true, () => this.equipar(obj.ranura, obj));
    else if (!nivelOk) this.boton(bx, cy, `🔒 Nv ${obj.nivel}`, false, false);
    else {
      // v0.1.7: dos formas de pagar, con intys o con rubís
      const [enIntys, enRubis] = obj.precios;
      this.boton(bx - 160, cy, textoPrecio(enIntys), true, alcanza(enIntys), () => this.comprar(obj, enIntys));
      this.boton(bx, cy, textoPrecio(enRubis), true, alcanza(enRubis), () => this.comprar(obj, enRubis));
    }
  }

  /**
   * v0.1.4: POCIONES. Se compran de a una, sin límite, y son de la cuenta.
   * En la partida reemplazan a la cura: vida y maná.
   */
  crearPociones(cx, ancho) {
    const mias = pociones();
    Object.entries(this.balance.pociones.tipos).forEach(([id, pocion], i) => {
      const alto = 110;
      const cy = 120 + i * (alto + 12) + alto / 2;
      const alcanza = Object.entries(pocion.precio).every(([moneda, n]) => (this.monedas[moneda] || 0) >= n);
      this.add.rectangle(cx, cy, ancho, alto, 0x0b0f1a, 0.85).setStrokeStyle(2, color(pocion.color), 0.9);
      const izq = cx - ancho / 2 + 16;
      this.add.text(izq, cy - alto / 2 + 12, pocion.nombre, {
        fontFamily: FUENTE_TITULO, fontSize: '21px', fontStyle: 'bold', color: pocion.color,
      });
      this.add.text(izq, cy - alto / 2 + 42, pocion.texto, { ...TEXTO, fontSize: '15px', color: '#cfd8dc' });
      this.add.text(izq, cy + alto / 2 - 10, `Tienes ${mias[id]}`, { ...TEXTO, fontSize: '15px', fontStyle: 'bold' }).setOrigin(0, 1);
      this.boton(cx + ancho / 2 - 85, cy, textoPrecio(pocion.precio), true, alcanza, () => {
        if (comprarPocion(id, pocion.precio)) this.scene.restart(this.datos);
      });
    });
  }

  /** Botón pequeño (como el de la ficha, pero más angosto) */
  boton(x, y, texto, principal, activo, accion) {
    const fondo = this.add.rectangle(x, y, 150, 46, principal ? DORADO : 0x0b0f1a, activo ? 1 : 0.4)
      .setStrokeStyle(2, activo ? DORADO : 0x666666);
    this.add.text(x, y, texto, {
      fontFamily: FUENTE_TITULO, fontSize: texto.length > 12 ? '14px' : '18px', fontStyle: 'bold',
      color: !activo ? '#777777' : principal ? '#1a0f00' : '#f5c542',
    }).setOrigin(0.5);
    if (activo) fondo.setInteractive().on('pointerdown', accion);
  }

  /** Comprar y ponérselo de una vez (lo normal es querer usarlo) */
  comprar(obj, precio) {
    if (!comprarObjeto(obj.id, precio)) return;
    this.equipar(obj.ranura, obj);
  }

  /** Pone (o quita, con obj = null) el objeto de un espacio, guarda y avisa al compañero */
  equipar(ranura, obj) {
    if (obj) this.p.equipo[ranura] = { tier: obj.tier, set: obj.set };
    else delete this.p.equipo[ranura];
    guardarPersonaje(this.p);
    const red = redActual();
    if (red && red.conectado) red.presentarme();
    this.scene.restart(this.datos);
  }
}
