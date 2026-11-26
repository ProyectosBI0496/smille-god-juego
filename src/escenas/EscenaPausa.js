// =============================================================
// Menú de pausa
// Es una escena que se dibuja ENCIMA de la arena. Mientras está
// abierta, la arena está en pausa: su física, temporizadores,
// animaciones y partículas se congelan.
// =============================================================

import { FUENTE_TITULO } from './EscenaArena.js';

export default class EscenaPausa extends Phaser.Scene {
  constructor() {
    super('EscenaPausa');
  }

  create() {
    const W = this.scale.baseSize.width;
    const H = this.scale.baseSize.height;
    const cx = W / 2;
    this.cameras.main.setSize(W, H); // tamaño real de la pantalla (modo EXPAND)
    const cy = H / 2;

    // Fondo oscuro semitransparente: se ve la arena congelada detrás
    this.add.rectangle(cx, cy, W, H, 0x000000, 0.6).setInteractive(); // bloquea toques al juego

    this.add.text(cx, cy - 150, 'Pausa', {
      fontFamily: FUENTE_TITULO, fontSize: '80px', color: '#f5c542', fontStyle: 'bold',
      stroke: '#3a1500', strokeThickness: 8,
    }).setOrigin(0.5);

    this.crearBoton(cx, cy - 10, 'Continuar', true, () => this.continuar());
    this.crearBoton(cx, cy + 100, 'Reiniciar', false, () => this.irA('reiniciar'));
    this.crearBoton(cx, cy + 210, 'Mapa', false, () => this.irA('mapa'));

    // En el PC: P o ESC también continúan
    this.input.keyboard.once('keydown-P', () => this.continuar());
    this.input.keyboard.once('keydown-ESC', () => this.continuar());
  }

  /** Botón rectangular: relleno dorado (principal) o solo borde */
  crearBoton(x, y, texto, principal, alPulsar) {
    const fondo = this.add.rectangle(x, y, 320, 80, principal ? 0xf5c542 : 0x0b0f1a)
      .setStrokeStyle(3, 0xf5c542).setInteractive();
    this.add.text(x, y, texto, {
      fontFamily: FUENTE_TITULO, fontSize: '32px', fontStyle: 'bold',
      color: principal ? '#1a0f00' : '#f5c542',
    }).setOrigin(0.5);
    fondo.on('pointerdown', alPulsar);
  }

  /** Cierra la pausa y la arena sigue donde quedó */
  continuar() {
    this.scene.resume('EscenaArena');
    this.scene.stop();
  }

  /**
   * Reiniciar el mismo mundo o volver al mapa de mundos.
   * v0.1.10: salir en plena partida cuenta como PARTIDA PERDIDA (se pierden coronas).
   * Si la partida ya había terminado, darCoronas no hace nada (solo cobra una vez).
   */
  irA(destino) {
    const arena = this.scene.get('EscenaArena'); // para reiniciar el MISMO mundo y dificultad
    const mundo = arena.indiceMundo;
    const dificultad = arena.dificultad;
    arena.darCoronas(false);
    this.scene.stop('EscenaArena');
    if (destino === 'mapa') this.scene.start('EscenaMundos');
    else this.scene.start('EscenaArena', { mundo, dificultad });
  }
}
