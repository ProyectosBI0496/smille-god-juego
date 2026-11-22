// =============================================================
// Pantalla de título (Etapa 5)
// Es la primera escena: muestra el nombre del juego, al héroe,
// el récord y el botón JUGAR, que abre la arena.
// =============================================================

import { crearTexturas } from '../graficos/Texturas.js';
import { FUENTE_TITULO } from './EscenaArena.js';
import { mundosSuperados } from '../datos/Progreso.js';

export default class EscenaTitulo extends Phaser.Scene {
  constructor() {
    super('EscenaTitulo');
  }

  // Cargamos balance.json aquí, en la primera escena; las demás lo leen de la caché de Phaser.
  // "?v=..." evita que el navegador use una copia vieja guardada.
  preload() {
    if (!this.cache.json.exists('balance')) {
      this.load.json('balance', 'src/datos/balance.json?v=' + Date.now());
    }
  }

  create() {
    crearTexturas(this);
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;

    // Fondo: baldosas oscurecidas, brasas que suben y viñeta
    this.add.tileSprite(0, 0, W, H, 'baldosa-1').setOrigin(0).setTint(0x8a8aa0);
    this.add.particles(0, 0, 'chispa', {
      x: { min: 0, max: W }, y: H + 10,
      speedY: { min: -120, max: -50 }, speedX: { min: -20, max: 20 },
      lifespan: 6000, scale: { start: 0.9, end: 0 }, alpha: { start: 0.8, end: 0 },
      tint: [0xff7043, 0xffb74d], frequency: 60, blendMode: 'ADD',
    });
    this.add.image(cx, H / 2, 'vineta');

    // Luz detrás del héroe y el héroe "flotando" (mirando hacia arriba)
    this.add.image(cx, 380, 'brillo').setTint(0xff5722).setScale(3.2).setAlpha(0.5)
      .setBlendMode(Phaser.BlendModes.ADD);
    const alas = this.add.image(cx, 380, 'goruk-alas').setScale(2).setAngle(-90);
    const heroe = this.add.image(cx, 380, 'goruk-cuerpo').setScale(2).setAngle(-90);
    this.tweens.add({ targets: [alas, heroe], y: 368, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: alas, scaleX: 1.7, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Título con borde y sombra
    this.add.text(cx, 130, 'SMILLE GOD', {
      fontFamily: FUENTE_TITULO, fontSize: '110px', color: '#f5c542', fontStyle: 'bold',
      stroke: '#3a1500', strokeThickness: 12,
      shadow: { offsetX: 0, offsetY: 6, color: '#000000', blur: 12, fill: true, stroke: true },
    }).setOrigin(0.5);
    this.add.text(cx, 215, 'Las Cavernas de Ceniza', {
      fontFamily: FUENTE_TITULO, fontSize: '30px', color: '#e0c9a6',
      stroke: '#05070d', strokeThickness: 5,
    }).setOrigin(0.5);

    // Progreso guardado: cuántos mundos superó
    const superados = mundosSuperados();
    const total = this.cache.json.get('balance').mundos.length;
    if (superados > 0) {
      this.add.text(cx, 520, `Mundos superados: ${Math.min(superados, total)} de ${total}`, {
        fontFamily: FUENTE_TITULO, fontSize: '26px', color: '#ffffff', stroke: '#05070d', strokeThickness: 4,
      }).setOrigin(0.5);
    }

    // Botón JUGAR que "late"
    const boton = this.add.rectangle(cx, 585, 320, 86, 0xf5c542).setStrokeStyle(4, 0xfff3c4).setInteractive();
    const texto = this.add.text(cx, 585, 'JUGAR', {
      fontFamily: FUENTE_TITULO, fontSize: '42px', color: '#1a0f00', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.tweens.add({ targets: [boton, texto], scale: 1.06, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add.text(W - 16, H - 12, 'v0.0.11 · prototipo', {
      fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#6b7a90',
    }).setOrigin(1, 1);

    // Al tocar: la cámara se funde a negro y empieza la arena
    const empezar = () => {
      boton.disableInteractive();
      this.cameras.main.fadeOut(350, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('EscenaHeroe'));
    };
    boton.on('pointerdown', empezar);

    // Etapa 9: jugar en pareja (otra persona, otro celular)
    const pareja = this.add.text(cx, 670, 'Jugar en pareja', {
      fontFamily: FUENTE_TITULO, fontSize: '30px', color: '#f5c542', fontStyle: 'bold',
      stroke: '#05070d', strokeThickness: 5,
    }).setOrigin(0.5).setInteractive();
    pareja.on('pointerdown', () => this.scene.start('EscenaSala'));
    this.input.keyboard.once('keydown-SPACE', empezar);
    this.input.keyboard.once('keydown-ENTER', empezar);
  }
}
