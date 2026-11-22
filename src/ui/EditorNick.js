// =============================================================
// Editor del nombre del jugador (nick)
// Un texto "Jugador: Victor ✎" que, al tocarlo, abre un cuadro para escribir.
// Se usa en el título (modo de un jugador) y en la sala de pareja.
// =============================================================

import { FUENTE_TITULO } from '../escenas/EscenaArena.js';
import { nick, guardarNick, razaElegida } from '../datos/Progreso.js';
import { redActual } from '../red/Red.js';

/**
 * @param {Phaser.Scene} escena
 * @param {number} x, y      posición (esquina superior derecha del texto)
 */
export function crearEditorNick(escena, x, y) {
  const texto = escena.add.text(x, y, '', {
    fontFamily: FUENTE_TITULO, fontSize: '24px', color: '#ffffff', stroke: '#05070d', strokeThickness: 4,
  }).setOrigin(1, 0).setInteractive().setDepth(100);
  const mostrar = () => texto.setText(`Jugador: ${nick() || '(toca para poner tu nombre)'} ✎`);
  mostrar();
  texto.on('pointerdown', () => {
    // prompt = cuadro de texto del navegador (simple; en el juego final será un teclado propio)
    const nuevo = window.prompt('Escribe tu nombre (máximo 12 letras):', nick());
    if (nuevo === null) return; // canceló
    guardarNick(nuevo);
    mostrar();
    const red = redActual();
    if (red && red.conectado) red.enviar({ t: 'raza', raza: razaElegida(), nick: nick() });
  });
  return texto;
}
