// =============================================================
// Barra de vida que flota sobre un personaje
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
    this.color = color;
    this.grafico = escena.add.graphics().setDepth(50);
  }

  /** Redibuja la barra encima de (x, y) con el porcentaje de vida (0 a 1) */
  dibujar(x, y, porcentaje) {
    const g = this.grafico;
    const izquierda = x - this.ancho / 2;
    g.clear();
    g.fillStyle(0x000000, 0.6);                       // fondo oscuro
    g.fillRect(izquierda - 1, y - 1, this.ancho + 2, this.alto + 2);
    g.fillStyle(this.color);                          // vida restante
    g.fillRect(izquierda, y, this.ancho * Math.max(porcentaje, 0), this.alto);
  }

  destruir() {
    this.grafico.destroy();
  }
}
