// =============================================================
// Joystick táctil "dinámico"
// Aparece donde el jugador apoya el pulgar, en la MITAD IZQUIERDA
// de la pantalla. La mitad derecha queda libre para los botones de
// habilidades (Etapa 2 y 3).
// =============================================================

export default class Joystick {
  /**
   * @param {Phaser.Scene} escena  la escena donde vive el joystick
   * @param {object} config        datos de balance.json → "joystick"
   */
  constructor(escena, config) {
    this.escena = escena;
    this.radioBase = config.radioBase;
    this.zonaMuerta = config.zonaMuerta; // movimientos muy pequeños se ignoran
    this.seguirDedo = config.seguirDedo;  // true = la base se arrastra con el dedo

    // Dirección resultante: un vector con largo entre 0 (quieto) y 1 (a fondo)
    this.direccion = new Phaser.Math.Vector2(0, 0);

    // Qué dedo controla el joystick (null = ninguno)
    this.punteroId = null;

    // Parte visual: la base (círculo grande) y la palanca (círculo pequeño).
    // setScrollFactor(0) = no se mueven con la cámara: quedan fijos en pantalla.
    this.base = escena.add.circle(0, 0, config.radioBase, 0xffffff, 0.12)
      .setStrokeStyle(3, 0xffffff, 0.35)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    this.palanca = escena.add.circle(0, 0, config.radioPalanca, 0xffffff, 0.45)
      .setScrollFactor(0)
      .setDepth(101)
      .setVisible(false);

    // Escuchamos los toques. El último parámetro (this) indica que, dentro
    // de esas funciones, "this" sigue siendo este joystick.
    escena.input.on('pointerdown', this.alTocar, this);
    escena.input.on('pointermove', this.alMover, this);
    escena.input.on('pointerup', this.alSoltar, this);
    // Si el dedo (o el mouse) se suelta FUERA del área del juego, Phaser
    // emite otro evento. Sin esto, el joystick quedaría "pegado".
    escena.input.on('pointerupoutside', this.alSoltar, this);
  }

  /** true mientras un dedo está usando el joystick */
  get activo() {
    return this.punteroId !== null;
  }

  alTocar(puntero) {
    if (this.activo) return;                                  // ya hay un dedo en el joystick
    if (puntero.x > this.escena.scale.baseSize.width / 2) return;      // solo la mitad izquierda

    this.punteroId = puntero.id;
    this.base.setPosition(puntero.x, puntero.y).setVisible(true);
    this.palanca.setPosition(puntero.x, puntero.y).setVisible(true);
    this.direccion.set(0, 0);
  }

  alMover(puntero) {
    if (puntero.id !== this.punteroId) return; // es otro dedo: no es asunto nuestro

    // Distancia y ángulo entre el centro de la base y el dedo
    const dx = puntero.x - this.base.x;
    const dy = puntero.y - this.base.y;
    const distancia = Math.hypot(dx, dy);
    const angulo = Math.atan2(dy, dx);

    // JOYSTICK QUE SIGUE AL DEDO (observación de la prueba con un niño de 9 años):
    // si el dedo se sale de la base, la base se desplaza detrás de él.
    // Así el control nunca se "pierde" aunque el dedo se deslice por la pantalla.
    if (this.seguirDedo && distancia > this.radioBase) {
      this.base.setPosition(
        puntero.x - Math.cos(angulo) * this.radioBase,
        puntero.y - Math.sin(angulo) * this.radioBase
      );
    }

    // La palanca no puede salir de la base
    const limitada = Math.min(distancia, this.radioBase);
    this.palanca.setPosition(
      this.base.x + Math.cos(angulo) * limitada,
      this.base.y + Math.sin(angulo) * limitada
    );

    // Fuerza entre 0 y 1: cuanto más lejos del centro, más rápido
    const fuerza = limitada / this.radioBase;
    if (fuerza < this.zonaMuerta) {
      this.direccion.set(0, 0);
    } else {
      this.direccion.set(Math.cos(angulo) * fuerza, Math.sin(angulo) * fuerza);
    }
  }

  alSoltar(puntero) {
    if (puntero.id !== this.punteroId) return;
    this.soltar();
  }

  /** Suelta el joystick a la fuerza (por ejemplo, al poner pausa) */
  soltar() {
    this.punteroId = null;
    this.base.setVisible(false);
    this.palanca.setVisible(false);
    this.direccion.set(0, 0);
  }
}
