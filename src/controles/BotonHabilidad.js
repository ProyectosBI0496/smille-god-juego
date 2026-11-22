// =============================================================
// Botón táctil de habilidad con tiempo de recarga
// Se reutilizará para el Botón 2 (habilidad) y el Botón 3 (especial)
// en la Etapa 3: solo cambian la posición, la etiqueta y la recarga.
// =============================================================

export default class BotonHabilidad {
  /**
   * @param {Phaser.Scene} escena
   * @param {object} opciones  { x, y, radio, etiqueta, icono, recargaMs, color, alPulsar }
   *   icono (opcional): clave de una textura; si existe, se muestra en vez del texto
   */
  constructor(escena, { x, y, radio, etiqueta, icono, recargaMs, color, alPulsar }) {
    this.escena = escena;
    this.x = x;
    this.y = y;
    this.radio = radio;
    this.recargaMs = recargaMs;
    this.alPulsar = alPulsar;      // función que se ejecuta al usar la habilidad
    this.listoEn = 0;              // momento (ms) en que vuelve a estar disponible

    // Círculo del botón: fondo oscuro con borde del color de la habilidad
    this.circulo = escena.add.circle(x, y, radio, 0x0b0f1a, 0.55)
      .setStrokeStyle(5, color, 0.9)
      .setScrollFactor(0)
      .setDepth(100)
      .setInteractive();

    // Ícono dibujado (Etapa 5) o, si no hay, el texto de la etiqueta
    if (icono && escena.textures.exists(icono)) {
      this.texto = escena.add.image(x, y, icono).setTint(color)
        .setScale((radio * 1.1) / 64).setScrollFactor(0).setDepth(102);
    } else {
      this.texto = escena.add.text(x, y, etiqueta, {
        fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
    }

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
