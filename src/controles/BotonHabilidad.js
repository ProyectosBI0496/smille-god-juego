// =============================================================
// Botón táctil de habilidad con tiempo de recarga
// Se reutilizará para el Botón 2 (habilidad) y el Botón 3 (especial)
// en la Etapa 3: solo cambian la posición, la etiqueta y la recarga.
// =============================================================

export default class BotonHabilidad {
  /**
   * @param {Phaser.Scene} escena
   * @param {object} opciones  { x, y, radio, etiqueta, recargaMs, color, alPulsar }
   */
  constructor(escena, { x, y, radio, etiqueta, recargaMs, color, alPulsar }) {
    this.escena = escena;
    this.x = x;
    this.y = y;
    this.radio = radio;
    this.recargaMs = recargaMs;
    this.alPulsar = alPulsar;      // función que se ejecuta al usar la habilidad
    this.listoEn = 0;              // momento (ms) en que vuelve a estar disponible

    // Círculo del botón, fijo en pantalla y sensible a los toques
    this.circulo = escena.add.circle(x, y, radio, color, 0.35)
      .setStrokeStyle(4, 0xffffff, 0.6)
      .setScrollFactor(0)
      .setDepth(100)
      .setInteractive();

    this.texto = escena.add.text(x, y, etiqueta, {
      fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102);

    // Capa que muestra la recarga como un "reloj" que se vacía
    this.capaRecarga = escena.add.graphics().setScrollFactor(0).setDepth(101);

    this.circulo.on('pointerdown', () => this.usar());
  }

  /** true si la habilidad se puede usar ahora */
  get listo() {
    return this.escena.time.now >= this.listoEn;
  }

  /** Intenta usar la habilidad (desde el toque o desde el teclado) */
  usar() {
    if (!this.listo) return false;
    this.listoEn = this.escena.time.now + this.recargaMs;
    this.alPulsar();
    // Pequeño "juice": el botón se encoge un instante
    this.escena.tweens.add({ targets: this.circulo, scale: 0.88, duration: 60, yoyo: true });
    return true;
  }

  /** Se llama en cada frame para dibujar la recarga */
  actualizar() {
    const g = this.capaRecarga;
    g.clear();
    const restante = this.listoEn - this.escena.time.now;
    if (restante <= 0) return;

    // Fracción de recarga pendiente (1 = recién usado, 0 = listo)
    const fraccion = restante / this.recargaMs;
    g.fillStyle(0x000000, 0.55);
    g.slice(this.x, this.y, this.radio, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraccion, false);
    g.fillPath();
  }
}
