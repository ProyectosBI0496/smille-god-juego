// =============================================================
// Enemigo básico: persigue al héroe y lo daña al tocarlo
// =============================================================

import BarraVida from '../ui/BarraVida.js';

export default class Enemigo {
  /**
   * @param {Phaser.Scene} escena
   * @param {number} x
   * @param {number} y
   * @param {object} config  datos de balance.json → "enemigo"
   */
  constructor(escena, x, y, config) {
    this.escena = escena;
    this.config = config;
    this.radio = config.radio;
    this.vida = config.vidaMax;
    this.aturdidoHasta = 0;  // mientras esté aturdido, no persigue

    const color = Phaser.Display.Color.HexStringToColor(config.color).color;
    this.cuerpo = escena.add.circle(x, y, config.radio, color);
    escena.physics.add.existing(this.cuerpo);
    this.cuerpo.body.setCircle(config.radio);
    this.cuerpo.body.setCollideWorldBounds(true);

    this.barra = new BarraVida(escena, config.radio * 2, 0xef5350);
  }

  get vivo() {
    return this.vida > 0;
  }

  /** Cada frame: perseguir al héroe (si no está aturdido) y redibujar su barra */
  actualizar(heroe) {
    if (this.escena.time.now >= this.aturdidoHasta) {
      // moveToObject calcula la dirección hacia el héroe y le da esa velocidad
      this.escena.physics.moveToObject(this.cuerpo, heroe.cuerpo, this.config.velocidad);
    }
    this.barra.dibujar(this.cuerpo.x, this.cuerpo.y - this.radio - 12, this.vida / this.config.vidaMax);
  }

  /**
   * Recibe un golpe.
   * @param {number} danio
   * @param {Phaser.Math.Vector2} direccion  hacia dónde lo empuja el golpe
   * @param {number} empuje                  fuerza del empuje
   */
  recibirDanio(danio, direccion, empuje) {
    this.vida -= danio;

    // Empuje: lo lanzamos hacia atrás y lo "aturdimos" un momento
    this.cuerpo.body.setVelocity(direccion.x * empuje, direccion.y * empuje);
    this.aturdidoHasta = this.escena.time.now + this.config.aturdidoMs;

    // Destello blanco al recibir el golpe
    this.cuerpo.setFillStyle(0xffffff);
    this.escena.time.delayedCall(80, () => {
      if (this.cuerpo.active) {
        this.cuerpo.setFillStyle(Phaser.Display.Color.HexStringToColor(this.config.color).color);
      }
    });
  }

  destruir() {
    this.cuerpo.destroy();
    this.barra.destruir();
  }
}
