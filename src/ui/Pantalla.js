// =============================================================
// Ayudas para que el juego LLENE TODA LA PANTALLA (Etapa 10)
//
// Antes el juego medía siempre 1280 × 720 y, en celulares más
// alargados, quedaban franjas negras a los lados. Ahora usamos el modo
// EXPAND de Phaser: el juego se "estira" (no se deforma) y gana ancho
// o alto según la pantalla. Por eso cada escena debe ubicar sus cosas
// según el tamaño REAL de la pantalla, y reacomodarse si
// ese tamaño cambia (por ejemplo, al entrar a pantalla completa).
// OJO: en modo EXPAND el tamaño real está en this.scale.baseSize
// (this.scale.width sigue diciendo 1280 aunque la pantalla mida 1600).
// =============================================================

/** La viñeta (bordes oscuros) estirada al tamaño actual de la pantalla */
export function crearVineta(escena) {
  const { width, height } = escena.scale.baseSize; // en EXPAND, el tamaño real está en baseSize
  // La cámara de cada escena nace con el tamaño "lógico" (1280 × 720): la ajustamos al real
  escena.cameras.main.setSize(width, height);
  return escena.add.image(width / 2, height / 2, 'vineta').setDisplaySize(width, height);
}

/**
 * Si cambia el tamaño de la pantalla, vuelve a armar la escena.
 * Sirve para menús (título, mapa...). La partida usa otra forma: mueve sus controles.
 * "Debounce": si llegan varios cambios seguidos, espera 200 ms y reinicia una sola vez.
 */
export function reiniciarAlCambiarTamano(escena, condicion = () => true) {
  let pendiente = null;
  const alCambiar = () => {
    if (pendiente) pendiente.remove();
    pendiente = escena.time.delayedCall(200, () => {
      if (condicion()) escena.scene.restart(escena.sys.settings.data);
    });
  };
  escena.scale.on('resize', alCambiar);
  escena.events.once('shutdown', () => escena.scale.off('resize', alCambiar));
}
