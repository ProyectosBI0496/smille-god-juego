// =============================================================
// Ficha del personaje (v0.1.2)
//   Izquierda: quién es, su nivel, las monedas y el botón SUBIR DE NIVEL
//              (cuesta FICHAS; cada nivel da puntos para repartir).
//   Derecha:   las 6 estadísticas. Solo se suben las de los ROLES de la clase:
//              Tanque → Fuerza y Vida · DPS → Daño y Velocidad ·
//              Sanador → Inteligencia y Armadura.
// Cada cambio se guarda al instante y se vuelve a dibujar la escena.
// =============================================================

import { crearTexturas } from '../graficos/Texturas.js';
import { crearVineta, reiniciarAlCambiarTamano } from '../ui/Pantalla.js';
import { color } from '../graficos/TexturasMundo.js';
import { FUENTE_TITULO } from './EscenaArena.js';
import {
  personaje, guardarPersonaje, borrarPersonaje, monedas, sumarMonedas, nivelMaximo,
} from '../datos/Progreso.js';
import {
  personajeValido, calcularHeroe, estadisticasDeClase, costoNivel, nombrePersonaje, clasesDeRaza,
} from '../datos/Personaje.js';
import { redActual, seguirPareja } from '../red/Red.js';

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
    if (!guardado) { // todavía no hay personaje: a crearlo
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
    seguirPareja(this);
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

    this.add.image(cx, 110, 'brillo').setTint(color(clase.color)).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
    if (raza.extra) this.add.image(cx, 110, `${p.raza}-${raza.extra}`).setScale(1.3).setAngle(-90);
    this.add.image(cx, 110, `${p.raza}-cuerpo`).setScale(1.3).setAngle(-90);
    this.add.text(cx, 190, nombrePersonaje(b, p), {
      fontFamily: FUENTE_TITULO, fontSize: '30px', fontStyle: 'bold', color: clase.color, stroke: '#05070d', strokeThickness: 5,
    }).setOrigin(0.5);
    const roles = clase.roles.map((r) => b.nombresRol[r]).join(' / ');
    this.add.text(cx, 228, `Nivel ${p.nivel} · ${roles}`, { ...TEXTO, fontSize: '20px', color: '#ffe082' }).setOrigin(0.5);

    // Monedas de la cuenta
    const m = monedas();
    this.add.text(cx, 272, `☀️ ${m.intys} intys    🎟️ ${m.fichas} fichas    💎 ${m.rubis} rubís`, {
      ...TEXTO, fontSize: '19px', stroke: '#05070d', strokeThickness: 3,
    }).setOrigin(0.5);

    // Subir de nivel: cuesta fichas (las fichas salen de los cofres)
    const maximo = p.nivel >= b.progreso.nivelMax;
    const costo = costoNivel(b, p.nivel);
    const alcanza = m.fichas >= costo;
    const texto = maximo ? 'Nivel máximo' : `Subir a Nv ${p.nivel + 1} (🎟️ ${costo})`;
    this.boton(cx, 330, 360, texto, true, () => this.subirNivel(costo), !maximo && alcanza);
    if (!maximo && !alcanza) {
      this.add.text(cx, 370, 'Gana fichas en los cofres de las mazmorras', { ...TEXTO, fontSize: '15px', color: '#b0bec5' }).setOrigin(0.5);
    }

    // Qué se abre después (botones de la clase y clases nuevas)
    this.add.text(cx, 420, this.proximosDesbloqueos(), {
      ...TEXTO, fontSize: '16px', color: '#cfd8dc', align: 'center', wordWrap: { width: 440 }, lineSpacing: 4,
    }).setOrigin(0.5, 0);

    // Borrar: hay que tocar dos veces (no se puede deshacer)
    let confirmar = false;
    const borrar = this.add.text(cx, H - 115, 'Borrar personaje', {
      ...TEXTO, fontSize: '18px', color: '#ef9a9a', stroke: '#05070d', strokeThickness: 3,
    }).setOrigin(0.5).setInteractive();
    borrar.on('pointerdown', () => {
      if (!confirmar) {
        confirmar = true;
        borrar.setText('¿Seguro? Vuelves a nivel 1. Toca otra vez').setColor('#ff5252');
        return;
      }
      borrarPersonaje();
      this.scene.start('EscenaHeroe', { volverA: this.volverA, datosVolver: this.datosVolver });
    });
  }

  /** Texto con lo que se abre en los próximos niveles */
  proximosDesbloqueos() {
    const b = this.balance;
    const p = this.p;
    const lineas = [];
    b.progreso.nivelBotones.forEach((nivel, i) => {
      if (nivel > p.nivel) lineas.push(`Nv ${nivel}: se abre el botón ${i + 1}`);
    });
    const siguiente = clasesDeRaza(b, p.raza, nivelMaximo()).find((c) => !c.abierta);
    if (siguiente) lineas.push(`Nv ${siguiente.necesario}: nueva clase de ${b.razas[p.raza].nombre}: ${b.clases[siguiente.id].nombre}`);
    return lineas.length ? `Próximo:\n${lineas.join('\n')}` : 'Tienes todo abierto';
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
    const permitidas = estadisticasDeClase(b, p.clase);
    const ancho = this.anchoDerecha;
    this.add.rectangle(cx, H / 2 - 25, ancho, H - 120, 0x0b0f1a, 0.75).setStrokeStyle(2, 0xf5c542, 0.5);
    this.add.text(cx, 52, 'Estadísticas', {
      fontFamily: FUENTE_TITULO, fontSize: '32px', fontStyle: 'bold', color: '#f5c542', stroke: '#05070d', strokeThickness: 5,
    }).setOrigin(0.5);
    this.add.text(cx, 90, p.puntos > 0 ? `Tienes ${p.puntos} ${p.puntos === 1 ? 'punto' : 'puntos'} para repartir` : 'Sube de nivel para ganar puntos', {
      ...TEXTO, fontSize: '18px', color: p.puntos > 0 ? '#a5d6a7' : '#b0bec5',
    }).setOrigin(0.5);

    const izq = cx - ancho / 2 + 24;
    Object.entries(b.estadisticas.lista).forEach(([id, est], i) => {
      const y = 138 + i * 62;
      const puede = permitidas.includes(id);
      const gris = '#666666';
      this.add.text(izq, y, est.nombre, {
        fontFamily: FUENTE_TITULO, fontSize: '22px', fontStyle: 'bold', color: puede ? est.color : gris,
      }).setOrigin(0, 0.5);
      this.add.text(izq, y + 22, puede ? est.texto : `Solo ${b.nombresRol[est.rol]}`, {
        ...TEXTO, fontSize: '14px', color: puede ? '#cfd8dc' : gris,
      }).setOrigin(0, 0.5);
      this.add.text(cx + ancho / 2 - 110, y + 6, String(p.est[id]), {
        fontFamily: FUENTE_TITULO, fontSize: '28px', fontStyle: 'bold', color: puede ? '#ffffff' : gris,
      }).setOrigin(0.5);
      if (!puede) return;
      // Botón "+": gasta un punto en esta estadística
      const activo = p.puntos > 0;
      const mas = this.add.circle(cx + ancho / 2 - 50, y + 6, 22, activo ? 0x66bb6a : 0x333333).setStrokeStyle(2, 0xffffff, activo ? 0.9 : 0.3);
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
    const h = calcularHeroe(b, p);
    const resumen = `Vida ${h.vidaMax} · Velocidad ${h.velocidad} · Daño ×${h.mult.fisico.toFixed(2)} · Magia ×${h.mult.magia.toFixed(2)}\n`
      + `Curación ×${h.mult.cura.toFixed(2)} · Recarga ×${h.mult.recarga.toFixed(2)} · Armadura ${Math.round(h.reduccion * 100)}%`;
    this.add.text(cx, H - 135, resumen, { ...TEXTO, fontSize: '15px', color: '#ffe082', align: 'center' }).setOrigin(0.5);
  }
}
