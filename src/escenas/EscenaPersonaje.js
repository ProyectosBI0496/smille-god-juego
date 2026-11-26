// =============================================================
// Ficha del personaje (v0.1.2)
//   Izquierda: quién es, su nivel, su RANGO y coronas (v0.1.5), las monedas
//              y el botón SUBIR DE NIVEL (cuesta FICHAS; cada nivel da puntos).
//   Derecha:   las 6 estadísticas. v0.1.5: crecen solas con el nivel (Excel)
//              y además se reparten puntos. v0.1.14: en CUALQUIER estadística
//              (balance.json → estadisticas → puntosLibres). El equipo suma (en celeste).
// Cada cambio se guarda al instante y se vuelve a dibujar la escena.
// =============================================================

import { crearTexturas } from '../graficos/Texturas.js';
import { crearVineta, reiniciarAlCambiarTamano } from '../ui/Pantalla.js';
import { color } from '../graficos/TexturasMundo.js';
import { FUENTE_TITULO } from './EscenaArena.js';
import {
  personaje, guardarPersonaje, monedas, sumarMonedas, coronasJugador,
} from '../datos/Progreso.js';
import {
  personajeValido, calcularHeroe, estadisticasDeRol, costoNivel, nombrePersonaje, bonosEquipo, poderesDe,
  rangoDe, estadisticasBase, textoEstadistica, esPorcentaje,
} from '../datos/Personaje.js';
import { redActual, seguirPareja } from '../red/Red.js';
import { mostrarTutorial } from '../ui/Tutorial.js'; // v0.1.16: guía con flechas

const TEXTO = { fontFamily: 'Arial, sans-serif', color: '#ffffff' };

export default class EscenaPersonaje extends Phaser.Scene {
  constructor() {
    super('EscenaPersonaje');
  }

  init(datos) {
    this.volverA = (datos && datos.volverA) || 'EscenaMundos';
    this.datosVolver = (datos && datos.datosVolver) || {};
  }

  create() {
    const guardado = personaje();
    if (!guardado) { // todavía no hay héroe: a elegir uno
      this.scene.start('EscenaHeroe', { volverA: this.volverA, datosVolver: this.datosVolver });
      return;
    }
    crearTexturas(this);
    const W = this.scale.baseSize.width;
    const H = this.scale.baseSize.height;
    this.balance = this.cache.json.get('balance');
    this.p = personajeValido(this.balance, guardado);
    this.cameras.main.fadeIn(200);
    this.add.tileSprite(0, 0, W, H, 'baldosa-2').setOrigin(0).setTint(0x6a6a80);
    crearVineta(this);
    reiniciarAlCambiarTamano(this);

    // Dos paneles que no se tocan: izquierda (460 de ancho) y derecha (el resto)
    this.crearIzquierda(30 + 230, H);
    this.anchoDerecha = Math.min(640, W - 460 - 90);
    this.crearEstadisticas(W - 30 - this.anchoDerecha / 2, H);

    // Abajo: volver y jugar
    const volver = this.add.text(24, H - 14, '← Título', {
      fontFamily: FUENTE_TITULO, fontSize: '26px', color: '#f5c542', stroke: '#05070d', strokeThickness: 4,
    }).setOrigin(0, 1).setInteractive();
    volver.on('pointerdown', () => this.scene.start(this.volverA === 'EscenaSala' ? 'EscenaSala' : 'EscenaTitulo', this.datosVolver));
    this.boton(W - 160, H - 50, 260, 'Jugar →', true, () => this.scene.start(this.volverA, this.datosVolver));
    // v0.1.3: la tienda de equipo (se le pasa a dónde volver para que la ficha lo recuerde)
    this.boton(W - 450, H - 50, 260, '🛒 Tienda', false, () => this.scene.start('EscenaTienda', { volverA: this.volverA, datosVolver: this.datosVolver }));
    seguirPareja(this);

    // v0.1.16: guía con flechas (la primera vez)
    const pasos = [
      { texto: 'Esta es la FICHA de tu héroe: su nivel y su rol.', objetivo: { texto: 'Nivel ' } },
      { texto: 'RANGO y CORONAS 👑: ganas coronas al vencer mazmorras (al perder, pierdes algunas). Subir de rango abre héroes nuevos.', objetivo: { texto: 'Rango' } },
      { texto: 'Tus MONEDAS: ☀️ intys y 💎 rubís (para la tienda), 🎟️ fichas (para subir de nivel) y 🔰 fichas de facción (para abrir héroes).', objetivo: { texto: '🎟️' } },
      { texto: `SUBIR DE NIVEL cuesta fichas 🎟️ (salen de los cofres). Cada nivel te da ${this.balance.progreso.puntosPorNivel} PUNTOS y abre poderes nuevos.`, objetivo: { texto: 'Subir a Nv' } },
      { texto: 'Tu PASIVA y tus 3 PODERES. Los que tienen 🔒 se abren al subir de nivel.', objetivo: { texto: 'Pasiva:' } },
      { texto: 'Tus 6 ESTADÍSTICAS. Blanco = lo que da tu nivel · verde = tus puntos · celeste = tu equipo.', objetivo: { texto: 'Estadísticas' } },
      { texto: 'Con el botón + pones un punto en la estadística que quieras.', objetivo: () => this.children.list.find((t) => t.type === 'Text' && t.text === '+') },
      { texto: 'En la TIENDA compras equipo y pociones.', objetivo: { texto: 'Tienda' } },
      { texto: 'Aquí cambias de héroe o creas otro.', objetivo: { texto: 'Cambiar héroe' } },
      { texto: '¡Listo! Toca JUGAR para elegir tu mundo.', objetivo: { texto: 'Jugar →' } },
    ];
    mostrarTutorial(this, 'personaje', pasos);
  }

  /** Botón rectangular reutilizable */
  boton(x, y, ancho, texto, principal, accion, activo = true) {
    const fondo = this.add.rectangle(x, y, ancho, 58, principal ? 0xf5c542 : 0x0b0f1a, activo ? 1 : 0.4)
      .setStrokeStyle(3, activo ? 0xf5c542 : 0x666666);
    this.add.text(x, y, texto, {
      fontFamily: FUENTE_TITULO, fontSize: '22px', fontStyle: 'bold',
      color: !activo ? '#777777' : principal ? '#1a0f00' : '#f5c542',
    }).setOrigin(0.5);
    if (activo) fondo.setInteractive().on('pointerdown', accion);
    return fondo;
  }

  /** Guarda, avisa al compañero y vuelve a dibujar */
  guardar() {
    guardarPersonaje(this.p);
    const red = redActual();
    if (red && red.conectado) red.presentarme();
    this.scene.restart({ volverA: this.volverA, datosVolver: this.datosVolver });
  }

  crearIzquierda(cx, H) {
    const b = this.balance;
    const p = this.p;
    const clase = b.clases[p.clase];
    const raza = b.razas[p.raza];
    this.add.rectangle(cx, H / 2 - 25, 460, H - 120, 0x0b0f1a, 0.75).setStrokeStyle(2, color(clase.color), 0.7);

    this.add.image(cx, 100, 'brillo').setTint(color(clase.color)).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
    if (raza.extra) this.add.image(cx, 100, `${p.raza}-${raza.extra}`).setScale(1.2).setAngle(-90);
    this.add.image(cx, 100, `${p.raza}-cuerpo`).setScale(1.2).setAngle(-90);
    this.add.text(cx, 176, nombrePersonaje(b, p), {
      fontFamily: FUENTE_TITULO, fontSize: '30px', fontStyle: 'bold', color: clase.color, stroke: '#05070d', strokeThickness: 5,
    }).setOrigin(0.5);
    this.add.text(cx, 214, `Nivel ${p.nivel} · ${b.nombresRol[p.rol]}`, { ...TEXTO, fontSize: '20px', color: '#ffe082' }).setOrigin(0.5);

    // v0.1.5: RANGO del héroe (según SUS coronas) con una barra hasta el siguiente
    const rango = rangoDe(b, p.coronas);
    this.add.circle(cx - 190, 250, 12, color(rango.color)).setStrokeStyle(3, 0x05070d);
    const falta = rango.siguiente === null ? 'rango máximo' : `faltan ${rango.siguiente - p.coronas} para R${rango.rango + 1}`;
    this.add.text(cx - 170, 250, `Rango ${rango.rango} · 👑 ${p.coronas} (${falta})`, {
      ...TEXTO, fontSize: '17px', fontStyle: 'bold', color: rango.color, stroke: '#05070d', strokeThickness: 3,
    }).setOrigin(0, 0.5);
    if (rango.siguiente !== null) {
      const parte = (p.coronas - rango.desde) / (rango.siguiente - rango.desde);
      this.add.rectangle(cx - 190, 272, 380, 6, 0x000000, 0.6).setOrigin(0, 0.5);
      this.add.rectangle(cx - 190, 272, Math.max(1, 380 * parte), 6, color(rango.color)).setOrigin(0, 0.5);
    }

    // Monedas de la cuenta y coronas del JUGADOR (la suma de todos sus héroes)
    const m = monedas();
    this.add.text(cx, 298, `☀️ ${m.intys}   🎟️ ${m.fichas}   💎 ${m.rubis}   🔰 ${m.fichasFaccion}   👑 ${coronasJugador()}`, {
      ...TEXTO, fontSize: '18px', stroke: '#05070d', strokeThickness: 3,
    }).setOrigin(0.5);

    // Subir de nivel: cuesta fichas (las fichas salen de los cofres)
    const maximo = p.nivel >= b.progreso.nivelMax;
    const costo = costoNivel(b, p.nivel);
    const alcanza = m.fichas >= costo;
    const texto = maximo ? 'Nivel máximo' : `Subir a Nv ${p.nivel + 1} (🎟️ ${costo})`;
    this.boton(cx, 346, 360, texto, true, () => this.subirNivel(costo), !maximo && alcanza);
    if (!maximo && !alcanza) {
      this.add.text(cx, 386, 'Gana fichas 🎟️ en los cofres de las mazmorras', { ...TEXTO, fontSize: '15px', color: '#b0bec5' }).setOrigin(0.5);
    }

    // v0.1.4: los poderes de clase + rol (los bloqueados dicen en qué nivel se abren)
    this.add.text(cx, 410, this.textoPoderes(), {
      ...TEXTO, fontSize: '16px', color: '#cfd8dc', align: 'center', wordWrap: { width: 440 }, lineSpacing: 4,
    }).setOrigin(0.5, 0);

    // v0.1.5: ya no se borra el personaje: se cambia de héroe (cada uno guarda su progreso)
    this.boton(cx, H - 122, 300, '👥 Cambiar héroe', false,
      () => this.scene.start('EscenaHeroe', { volverA: this.volverA, datosVolver: this.datosVolver }));
  }

  /** Texto con la pasiva y los 3 poderes (y su nivel si están bloqueados) */
  textoPoderes() {
    const b = this.balance;
    const p = this.p;
    const set = poderesDe(b, p.clase, p.rol);
    const niveles = b.progreso.nivelBotones;
    const lineas = [`Pasiva: ${set.pasiva.nombre}`];
    set.botones.forEach((poder, i) => {
      lineas.push(`${i + 1}. ${poder.nombre}${niveles[i] > p.nivel ? `  (🔒 Nv ${niveles[i]})` : ''}`);
    });
    return lineas.join('\n');
  }

  subirNivel(costo) {
    if (monedas().fichas < costo) return;
    sumarMonedas({ fichas: -costo });
    this.p.nivel += 1;
    this.p.puntos += this.balance.progreso.puntosPorNivel;
    this.guardar();
  }

  crearEstadisticas(cx, H) {
    const b = this.balance;
    const p = this.p;
    // v0.1.14: con "puntosLibres" (balance.json → estadisticas) los puntos van a CUALQUIER
    // estadística; si no, solo a las 2 del rol (como antes)
    const permitidas = b.estadisticas.puntosLibres ? Object.keys(b.estadisticas.lista) : estadisticasDeRol(b, p.rol);
    const bonos = bonosEquipo(b, p);                   // lo que suma el equipo puesto (en verde)
    const base = estadisticasBase(b, p.rol, p.nivel);  // v0.1.5: lo que da el nivel (Excel)
    const h = calcularHeroe(b, p);
    const ancho = this.anchoDerecha;
    this.add.rectangle(cx, H / 2 - 25, ancho, H - 120, 0x0b0f1a, 0.75).setStrokeStyle(2, 0xf5c542, 0.5);
    this.add.text(cx, 52, 'Estadísticas', {
      fontFamily: FUENTE_TITULO, fontSize: '32px', fontStyle: 'bold', color: '#f5c542', stroke: '#05070d', strokeThickness: 5,
    }).setOrigin(0.5);
    this.add.text(cx, 90, p.puntos > 0 ? `Tienes ${p.puntos} ${p.puntos === 1 ? 'punto' : 'puntos'} para repartir` : 'Base según tu nivel · verde = tus puntos · celeste = equipo', {
      ...TEXTO, fontSize: '18px', color: p.puntos > 0 ? '#a5d6a7' : '#b0bec5',
    }).setOrigin(0.5);

    const izq = cx - ancho / 2 + 24;
    Object.entries(b.estadisticas.lista).forEach(([id, est], i) => {
      const y = 138 + i * 62;
      const puede = permitidas.includes(id);
      this.add.text(izq, y, est.nombre, {
        fontFamily: FUENTE_TITULO, fontSize: '22px', fontStyle: 'bold', color: est.color,
      }).setOrigin(0, 0.5);
      this.add.text(izq, y + 22, est.texto, { ...TEXTO, fontSize: '14px', color: '#cfd8dc' }).setOrigin(0, 0.5);

      // Base del Excel (según nivel) y al lado lo que se suma: "20 + 1 + 3"
      //   verde = puntos repartidos · celeste = equipo. En las de %, 1 punto = 0,20%.
      const extra = (n) => textoEstadistica(id, esPorcentaje(id) ? n * b.estadisticas.porPunto[id] : n);
      const piezas = [[textoEstadistica(id, base[id]), '#ffffff', '26px']];
      if (p.est[id] > 0) piezas.push([` + ${extra(p.est[id])}`, '#66bb6a', '22px']);
      if (bonos[id] > 0) piezas.push([` + ${extra(bonos[id])}`, '#4fc3f7', '22px']);
      // Se dibujan de derecha a izquierda, cada una pegada a la anterior
      let xDerecha = cx + ancho / 2 - 85;
      for (const [texto, colorTexto, tamano] of piezas.reverse()) {
        const t = this.add.text(xDerecha, y + 6, texto, {
          fontFamily: FUENTE_TITULO, fontSize: tamano, fontStyle: 'bold', color: colorTexto,
        }).setOrigin(1, 0.5);
        xDerecha -= t.width;
      }
      if (!puede) return; // sin puntos libres: solo las estadísticas del rol

      // Botón "+": gasta un punto en esta estadística
      const activo = p.puntos > 0;
      const mas = this.add.circle(cx + ancho / 2 - 45, y + 6, 22, activo ? 0x66bb6a : 0x333333).setStrokeStyle(2, 0xffffff, activo ? 0.9 : 0.3);
      this.add.text(mas.x, mas.y, '+', { ...TEXTO, fontSize: '30px', fontStyle: 'bold', color: activo ? '#ffffff' : '#777777' }).setOrigin(0.5);
      if (activo) {
        mas.setInteractive().on('pointerdown', () => {
          this.p.est[id] += 1;
          this.p.puntos -= 1;
          this.guardar();
        });
      }
    });

    // Resumen: así queda el héroe en la partida
    const resumen = `Vida ${h.vidaMax} · Velocidad ${h.velocidad} · Daño ×${h.mult.fisico.toFixed(2)} · Magia ×${h.mult.magia.toFixed(2)}\n`
      + `Curación ×${h.mult.cura.toFixed(2)} · Recarga ×${h.mult.recarga.toFixed(2)} · Bloqueo ${Math.round(h.reduccion * 100)}%`;
    this.add.text(cx, H - 135, resumen, { ...TEXTO, fontSize: '15px', color: '#ffe082', align: 'center' }).setOrigin(0.5);
  }
}
