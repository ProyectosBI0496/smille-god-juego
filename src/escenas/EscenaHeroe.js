// =============================================================
// Elegir bando y raza (Etapa 8, D-023)
// Dos columnas: Pacto de Ceniza y Liga del Alba, con 3 razas cada una.
// Las razas con "desbloqueo" > 0 se abren al superar ese número de mundos.
// Todo sale de balance.json → "bandos" y "razas".
// =============================================================

import { crearTexturas } from '../graficos/Texturas.js';
import { color } from '../graficos/TexturasMundo.js';
import { FUENTE_TITULO } from './EscenaArena.js';
import { mundosSuperados, razaElegida, elegirRaza } from '../datos/Progreso.js';

export default class EscenaHeroe extends Phaser.Scene {
  constructor() {
    super('EscenaHeroe');
  }

  create() {
    crearTexturas(this);
    const W = this.scale.width;
    const H = this.scale.height;
    const balance = this.cache.json.get('balance');
    this.razas = balance.razas;
    this.superados = mundosSuperados();
    this.elegida = razaElegida();

    // Máximos de cada estadística, para dibujar las barras en proporción
    const lista = Object.values(this.razas);
    this.maximos = {
      vidaMax: Math.max(...lista.map((r) => r.vidaMax)),
      velocidad: Math.max(...lista.map((r) => r.velocidad)),
      danio: Math.max(...lista.map((r) => r.danio)),
    };

    this.cameras.main.fadeIn(300);
    this.add.tileSprite(0, 0, W, H, 'baldosa-2').setOrigin(0).setTint(0x6a6a80);
    this.add.image(W / 2, H / 2, 'vineta');
    this.add.text(W / 2, 46, 'Elige tu héroe', {
      fontFamily: FUENTE_TITULO, fontSize: '52px', color: '#f5c542', fontStyle: 'bold',
      stroke: '#3a1500', strokeThickness: 8,
    }).setOrigin(0.5);

    balance.bandos.forEach((bando, i) => this.crearBando(bando, i === 0 ? W * 0.25 : W * 0.75));

    const volver = this.add.text(24, H - 20, '← Volver', {
      fontFamily: FUENTE_TITULO, fontSize: '26px', color: '#f5c542', stroke: '#05070d', strokeThickness: 4,
    }).setOrigin(0, 1).setInteractive();
    volver.on('pointerdown', () => this.scene.start('EscenaTitulo'));
  }

  /** Encabezado del bando y sus 3 tarjetas de raza */
  crearBando(bando, cx) {
    const c = color(bando.color);
    this.add.rectangle(cx, 400, 610, 560, c, 0.08).setStrokeStyle(2, c, 0.5);
    this.add.text(cx, 140, bando.nombre, {
      fontFamily: FUENTE_TITULO, fontSize: '34px', fontStyle: 'bold', color: bando.color,
      stroke: '#05070d', strokeThickness: 6,
    }).setOrigin(0.5);
    this.add.text(cx, 174, bando.lema, {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#d0d8e0', fontStyle: 'italic',
    }).setOrigin(0.5);
    bando.razas.forEach((id, i) => this.crearTarjeta(cx + (i - 1) * 195, 440, id, c));
  }

  crearTarjeta(x, y, id, colorBando) {
    const raza = this.razas[id];
    const bloqueada = this.superados < raza.desbloqueo;
    const elegida = id === this.elegida && !bloqueada;
    const ancho = 180;
    const alto = 400;

    this.add.rectangle(x, y, ancho, alto, 0x0b0f1a, 0.75)
      .setStrokeStyle(elegida ? 5 : 2, elegida ? 0xf5c542 : colorBando, elegida ? 1 : 0.6);

    // El héroe mirando hacia arriba (ángulo -90), con su parte extra si tiene
    const extra = raza.extra ? this.add.image(x, y - 100, `${id}-${raza.extra}`).setScale(1.3).setAngle(-90) : null;
    const cuerpo = this.add.image(x, y - 100, `${id}-cuerpo`).setScale(1.3).setAngle(-90);

    this.add.text(x, y + 2, raza.nombre, {
      fontFamily: FUENTE_TITULO, fontSize: '28px', fontStyle: 'bold',
      color: bloqueada ? '#777777' : '#ffffff', stroke: '#05070d', strokeThickness: 5,
    }).setOrigin(0.5);

    if (bloqueada) {
      for (const objeto of [cuerpo, extra].filter(Boolean)) objeto.setTint(0x222222);
      const g = this.add.graphics();
      g.lineStyle(7, 0xbbbbbb).strokeCircle(x, y - 118, 18);
      g.fillStyle(0xbbbbbb).fillRoundedRect(x - 28, y - 114, 56, 42, 7);
      this.add.text(x, y + 70, `Supera ${raza.desbloqueo} mundos\npara desbloquear`, {
        fontFamily: 'Arial, sans-serif', fontSize: '17px', color: '#aaaaaa', align: 'center',
      }).setOrigin(0.5);
      return;
    }

    this.add.text(x, y + 40, raza.descripcion, {
      fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#cfd8dc', align: 'center',
      wordWrap: { width: ancho - 16 },
    }).setOrigin(0.5, 0);

    // Barras de estadísticas (en proporción a la mejor raza)
    const stats = [['Vida', raza.vidaMax / this.maximos.vidaMax, 0x66bb6a],
      ['Velocidad', raza.velocidad / this.maximos.velocidad, 0x4fc3f7],
      ['Fuerza', raza.danio / this.maximos.danio, 0xff7043]];
    stats.forEach(([nombre, valor, colorBarra], i) => {
      const by = y + 102 + i * 28;
      this.add.text(x - 78, by, nombre, { fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#ffffff' }).setOrigin(0, 0.5);
      this.add.rectangle(x + 10, by, 70, 10, 0x000000, 0.6).setOrigin(0, 0.5);
      this.add.rectangle(x + 10, by, 70 * valor, 10, colorBarra).setOrigin(0, 0.5);
    });

    // Toda la tarjeta es un botón: elige la raza y pasa al mapa de mundos
    const zona = this.add.zone(x, y, ancho, alto).setInteractive();
    zona.on('pointerdown', () => {
      elegirRaza(id);
      this.tweens.add({ targets: cuerpo, scale: 1.6, duration: 150, yoyo: true });
      this.cameras.main.fadeOut(350);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('EscenaMundos'));
    });
  }
}
