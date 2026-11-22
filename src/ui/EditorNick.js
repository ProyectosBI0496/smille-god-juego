// =============================================================
// Editor del nombre del jugador (nick)
// Un texto "Jugador: Victor ✎" que, al tocarlo, abre el teclado propio
// del juego (EscenaNick) y después vuelve a esta misma pantalla.
// Se usa en el título (modo de un jugador) y en la sala de pareja.
// =============================================================

import { FUENTE_TITULO } from '../escenas/EscenaArena.js';
import { nick } from '../datos/Progreso.js';
import { redActual } from '../red/Red.js';

/**
 * @param {Phaser.Scene} escena
 * @param {number} x, y         posición (esquina superior derecha del texto)
 * @param {object} datosVolver  datos para reabrir esta escena al terminar
 */
export function crearEditorNick(escena, x, y, datosVolver = {}) {
  const texto = escena.add.text(x, y, `Jugador: ${nick() || '(toca para poner tu nombre)'} ✎`, {
    fontFamily: FUENTE_TITULO, fontSize: '24px', color: '#ffffff', stroke: '#05070d', strokeThickness: 4,
  }).setOrigin(1, 0).setInteractive().setDepth(100);
  texto.on('pointerdown', () => {
    // Si había una sala creada que nadie usó todavía, se cierra (al volver se crea otra)
    const red = redActual();
    if (red && !red.conectado) red.cerrar();
    escena.scene.start('EscenaNick', { volverA: escena.scene.key, datosVolver });
  });
  return texto;
}
