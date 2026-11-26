// =============================================================
// Pantalla de título (Etapa 5)
// Es la primera escena: muestra el nombre del juego, al héroe,
// el récord y el botón JUGAR, que abre la arena.
// =============================================================

import { crearTexturas } from '../graficos/Texturas.js';
import { crearVineta, reiniciarAlCambiarTamano } from '../ui/Pantalla.js';
import { FUENTE_TITULO } from './EscenaArena.js';
import { mundosSuperados } from '../datos/Progreso.js';
import { crearEditorNick } from '../ui/EditorNick.js';
import { mostrarTutorial } from '../ui/Tutorial.js'; // v0.1.16: guía con flechas

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
    const W = this.scale.baseSize.width;
    const H = this.scale.baseSize.height;
    const cx = W / 2;

    // Fondo: baldosas oscurecidas, brasas que suben y viñeta
    this.add.tileSprite(0, 0, W, H, 'baldosa-1').setOrigin(0).setTint(0x8a8aa0);
    this.add.particles(0, 0, 'chispa', {
      x: { min: 0, max: W }, y: H + 10,
      speedY: { min: -120, max: -50 }, speedX: { min: -20, max: 20 },
      lifespan: 6000, scale: { start: 0.9, end: 0 }, alpha: { start: 0.8, end: 0 },
      tint: [0xff7043, 0xffb74d], frequency: 60, blendMode: 'ADD',
    });
    crearVineta(this);
    // Se rearma si cambia el tamaño, salvo si ya se está yendo a otra pantalla
    // (el primer toque activa la pantalla completa y eso cambia el tamaño)
    this.saliendo = false;
    reiniciarAlCambiarTamano(this, () => !this.saliendo);

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

    // v0.1.10: aviso si la última partida quedó a medias (se cobró como perdida)
    const abandonada = window.partidaAbandonada;
    if (abandonada) {
      this.add.text(cx, 470, `Tu última partida (${abandonada.mundo}) quedó a medias: cuenta como perdida  👑 -${abandonada.perdidas}`, {
        fontFamily: FUENTE_TITULO, fontSize: '22px', color: '#ff8a80', stroke: '#05070d', strokeThickness: 4,
        align: 'center', wordWrap: { width: W - 80 },
      }).setOrigin(0.5);
    }

    // Botón JUGAR que "late"
    const boton = this.add.rectangle(cx, 585, 320, 86, 0xf5c542).setStrokeStyle(4, 0xfff3c4).setInteractive();
    const texto = this.add.text(cx, 585, 'JUGAR', {
      fontFamily: FUENTE_TITULO, fontSize: '42px', color: '#1a0f00', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.tweens.add({ targets: [boton, texto], scale: 1.06, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add.text(W - 16, H - 12, 'v0.1.2 · prototipo', {
      fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#6b7a90',
    }).setOrigin(1, 1);

    // Nombre del jugador (arriba a la derecha), para los dos modos
    crearEditorNick(this, W - 24, 20);

    // Al tocar: la cámara se funde a negro y empieza la arena
    const empezar = () => {
      boton.disableInteractive();
      this.saliendo = true;
      window.partidaAbandonada = null; // el aviso ya se vio
      this.cameras.main.fadeOut(350, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('EscenaPersonaje')); // v0.1.2: sin personaje, lleva a crearlo
    };
    boton.on('pointerdown', empezar);

    // Etapa 9: jugar en pareja (otra persona, otro celular)
    const pareja = this.add.text(cx, 670, 'Jugar en grupo', {
      fontFamily: FUENTE_TITULO, fontSize: '30px', color: '#f5c542', fontStyle: 'bold',
      stroke: '#05070d', strokeThickness: 5,
    }).setOrigin(0.5).setInteractive();
    pareja.on('pointerdown', () => this.scene.start('EscenaSala'));

    // v0.1.15: la guía "Cómo se juega" (arriba a la izquierda)
    const guia = this.add.text(24, 20, '📖 Cómo se juega', {
      fontFamily: FUENTE_TITULO, fontSize: '28px', color: '#f5c542', fontStyle: 'bold',
      stroke: '#05070d', strokeThickness: 5,
    }).setInteractive();
    guia.on('pointerdown', () => { this.saliendo = true; this.scene.start('EscenaGuia'); });
    this.input.keyboard.once('keydown-SPACE', empezar);
    this.input.keyboard.once('keydown-ENTER', empezar);

    // v0.1.16: GUÍA CON FLECHAS (solo la primera vez que se abre el juego)
    this.time.delayedCall(400, () => mostrarTutorial(this, 'titulo', [
      { texto: '¡Bienvenido a Smille God!\n\nEsta guía te muestra qué hace cada cosa. Toca la pantalla para pasar al siguiente mensaje.' },
      { texto: 'JUGAR: entra con tu héroe. La primera vez, lo creas.', objetivo: boton },
      { texto: 'JUGAR EN GRUPO: juega con hasta 2 amigos, cada uno en su celular.', objetivo: pareja },
      { texto: 'CÓMO SE JUEGA: aquí puedes releer las reglas cuando quieras (y repetir esta guía).', objetivo: guia },
      { texto: 'Tu NOMBRE de jugador: tócalo para cambiarlo. Lo verán tus compañeros.', objetivo: { texto: 'Jugador:' } },
    ]));
  }
}
