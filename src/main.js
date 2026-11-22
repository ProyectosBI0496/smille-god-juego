// =============================================================
// Smille God — Prototipo web
// Punto de entrada: configura y arranca el juego.
// Cada parte del juego vive en su propio archivo:
//   escenas/   → pantallas del juego
//   entidades/ → héroe, enemigos...
//   controles/ → joystick, botones
//   datos/     → balance.json (todos los números)
// =============================================================

// "import" trae una clase de otro archivo (como en Java).
import EscenaArena from './escenas/EscenaArena.js';
import EscenaTitulo from './escenas/EscenaTitulo.js';
import EscenaPausa from './escenas/EscenaPausa.js';

const config = {
  type: Phaser.AUTO,          // usa WebGL si el equipo lo soporta; si no, Canvas
  backgroundColor: '#05070d',
  scale: {
    mode: Phaser.Scale.FIT,   // se adapta a la pantalla sin deformarse
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,              // resolución "lógica" horizontal (celular acostado)
    height: 720,
  },
  physics: {
    default: 'arcade',        // física simple y rápida: velocidad y choques
    arcade: { debug: false }, // true = dibuja los cuerpos físicos (útil para depurar)
  },
  input: {
    activePointers: 3,        // hasta 3 dedos a la vez (joystick + botones)
  },
  scene: [EscenaTitulo, EscenaArena, EscenaPausa], // la primera de la lista es la que arranca
};

// Arranca el juego. Lo guardamos en window.juego para poder
// inspeccionarlo desde la consola del navegador (F12) mientras aprendemos.
// Antes de arrancar esperamos la tipografía "Cinzel" (máximo 2 segundos):
// si Phaser escribe un texto antes de que llegue, lo dibujaría con otra letra.
// Promise.race = "lo que termine primero": la fuente o el tiempo límite.
try {
  await Promise.race([
    document.fonts.load('700 40px "Cinzel"'),
    new Promise((resolver) => setTimeout(resolver, 2000)),
  ]);
} catch (error) {
  // sin la fuente, el juego usa Georgia
}
window.juego = new Phaser.Game(config);

// -------------------------------------------------------------
// Pantalla completa y orientación horizontal
// -------------------------------------------------------------
// Los navegadores solo permiten la pantalla completa como respuesta
// a un toque del jugador; por eso se pide desde un botón o un toque.
// "async" permite esperar (await) a que el navegador responda.
async function pedirPantallaCompleta() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
    // Fijar en horizontal: funciona en Android (Chrome), no en iPhone.
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape');
    }
  } catch (error) {
    // Si el navegador no lo permite, el juego sigue funcionando igual.
    console.log('Pantalla completa no disponible:', error.message);
  }
}

// Botón del aviso "Gira tu celular"
document.getElementById('boton-jugar').addEventListener('click', pedirPantallaCompleta);

// Si el jugador giró el celular a mano, el primer toque también activa la pantalla completa
document.addEventListener('pointerup', pedirPantallaCompleta, { once: true });
