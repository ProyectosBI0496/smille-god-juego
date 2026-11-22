// =============================================================
// Barra de vida que flota sobre un personaje
// Optimización (sesión 14): antes se usaba "Graphics" y se BORRABA y
// redibujaba en cada frame (lento en celulares). Ahora son dos
// rectángulos que solo se mueven y cambian de ancho: mucho más liviano.
// =============================================================

export default class BarraVida {
  /**
   * @param {Phaser.Scene} escena
   * @param {number} ancho   ancho de la barra en píxeles
   * @param {number} color   color del relleno (ej. 0x66bb6a)
   */
  constructor(escena, ancho, color) {
    this.ancho = ancho;
    this.alto = 6;
    this.fondo = escena.add.rectangle(0, 0, ancho + 2, this.alto + 2, 0x000000, 0.6).setOrigin(0).setDepth(50);
    this.relleno = escena.add.rectangle(0, 0, ancho, this.alto, color).setOrigin(0).setDepth(50);
  }

  /** Coloca la barra encima de (x, y) con el porcentaje de vida (0 a 1) */
  dibujar(x, y, porcentaje) {
    const izquierda = x - this.ancho / 2;
    this.fondo.setPosition(izquierda - 1, y - 1);
    this.relleno.setPosition(izquierda, y);
    const nuevoAncho = this.ancho * Phaser.Math.Clamp(porcentaje, 0, 1);
    if (nuevoAncho !== this.relleno.width) this.relleno.setSize(nuevoAncho, this.alto); // solo si cambió
  }

  destruir() {
    this.fondo.destroy();
    this.relleno.destroy();
  }
}
