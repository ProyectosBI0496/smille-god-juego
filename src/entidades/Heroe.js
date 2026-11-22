// =============================================================
// El héroe
// Por ahora: un círculo con física y un "ojo" que indica hacia
// dónde mira. Esa dirección servirá para apuntar los ataques
// en la Etapa 2.
// =============================================================

export default class Heroe {
  /**
   * @param {Phaser.Scene} escena
   * @param {number} x       posición inicial
   * @param {number} y
   * @param {object} config  datos de balance.json → "heroe"
   */
  constructor(escena, x, y, config) {
    this.radio = config.radio;
    this.velocidad = config.velocidad;

    // El color viene como texto ("#4fc3f7") y Phaser lo necesita como número
    const color = Phaser.Display.Color.HexStringToColor(config.color).color;

    // Cuerpo visible
    this.cuerpo = escena.add.circle(x, y, config.radio, color);

    // Le damos FÍSICA: así puede tener velocidad y chocar con los muros
    escena.physics.add.existing(this.cuerpo);
    this.cuerpo.body.setCircle(config.radio);
    this.cuerpo.body.setCollideWorldBounds(true); // no puede salir de la arena

    // El "ojo": muestra hacia dónde mira el héroe
    this.ojo = escena.add.circle(x, y, config.radio * 0.3, 0x0b0f1a);

    // Dirección en la que mira (vector de largo 1). Empieza mirando a la derecha.
    this.mirando = new Phaser.Math.Vector2(1, 0);
  }

  /**
   * Mueve al héroe.
   * @param {Phaser.Math.Vector2} direccion  vector con largo entre 0 y 1
   */
  mover(direccion) {
    // velocidad final = dirección × velocidad máxima (píxeles por segundo).
    // Ya no multiplicamos por delta: el motor de física lo hace por nosotros.
    this.cuerpo.body.setVelocity(
      direccion.x * this.velocidad,
      direccion.y * this.velocidad
    );

    // Si se está moviendo, actualizamos hacia dónde mira
    if (direccion.lengthSq() > 0) {
      this.mirando.copy(direccion).normalize();
    }

    // Colocamos el ojo en el borde del cuerpo, del lado al que mira
    this.ojo.setPosition(
      this.cuerpo.x + this.mirando.x * this.radio * 0.55,
      this.cuerpo.y + this.mirando.y * this.radio * 0.55
    );
  }
}
