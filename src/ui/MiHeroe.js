// =============================================================
// Abajo a la derecha del mapa y de la sala de pareja: mi personaje
// (dibujo + "Humano Guerrero · Nv 3") y un botón para ver su ficha.
// v0.1.2: lo usan EscenaMundos y EscenaSala (antes cada una tenía su copia).
// =============================================================

import { FUENTE_TITULO } from '../escenas/EscenaArena.js';
import { personaje } from '../datos/Progreso.js';
import { nombrePersonaje, personajeValido } from '../datos/Personaje.js';

export function crearMiHeroe(escena, x, y, alPulsar) {
  const balance = escena.cache.json.get('balance');
  const guardado = personaje();
  const p = guardado ? personajeValido(balance, guardado) : null;
  const texto = p ? `${nombrePersonaje(balance, p)} · Nv ${p.nivel} · Ver` : 'Crear personaje';
  const boton = escena.add.text(x, y, texto, {
    fontFamily: FUENTE_TITULO, fontSize: '26px', color: '#f5c542', stroke: '#05070d', strokeThickness: 4,
  }).setOrigin(1, 0.5).setInteractive(); // alineado al borde derecho: nunca se sale
  if (p) {
    const raza = balance.razas[p.raza];
    const xHeroe = boton.x - boton.width - 45;
    if (raza.extra) escena.add.image(xHeroe, y, `${p.raza}-${raza.extra}`).setAngle(-90).setScale(0.8);
    escena.add.image(xHeroe, y, `${p.raza}-cuerpo`).setAngle(-90).setScale(0.8);
  }
  boton.on('pointerdown', alPulsar);
  return boton;
}
