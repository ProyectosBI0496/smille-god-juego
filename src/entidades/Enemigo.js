// =============================================================
// Enemigo básico: persigue al héroe y lo daña al tocarlo
// Etapa 5: igual que el héroe, la física es un círculo invisible
// y lo que vemos es una imagen TEÑIDA (tint) con el color de balance.json.
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
    this.color = Phaser.Display.Color.HexStringToColor(config.color).color;
    this.fase = Math.random() * 1000; // para que no todos "palpiten" al mismo tiempo

    // FÍSICA (invisible)
    this.cuerpo = escena.add.circle(x, y, config.radio, 0xffffff).setVisible(false);
    escena.physics.add.existing(this.cuerpo);
    this.cuerpo.body.setCircle(config.radio);
    this.cuerpo.body.setCollideWorldBounds(true);

    // DIBUJO: la textura mide 80 px para un radio de 24 → la escalamos según el radio
    const escala = config.radio / 24;
    this.escalaBase = escala;
    this.sombra = escena.add.image(x, y, 'sombra').setAlpha(0.35).setScale(escala * 0.9, escala * 0.65).setDepth(8);
    this.sprite = escena.add.image(x, y, 'enemigo').setTint(this.color).setScale(escala).setDepth(10);
    this.ojos = escena.add.image(x, y, 'enemigo-ojos').setScale(escala).setDepth(10);

    // Aparece "creciendo" desde cero
    escena.tweens.add({ targets: [this.sprite, this.ojos], scale: { from: 0, to: escala }, duration: 300 });

    this.barra = new BarraVida(escena, config.radio * 2, 0xef5350);
  }

  get vivo() {
    return this.vida > 0;
  }

  /** Cada frame: perseguir al héroe (si no está aturdido) y redibujar */
  actualizar(heroe) {
    if (this.escena.time.now >= this.aturdidoHasta) {
      // moveToObject calcula la dirección hacia el héroe y le da esa velocidad
      this.escena.physics.moveToObject(this.cuerpo, heroe.cuerpo, this.config.velocidad);
    }

    const { x, y } = this.cuerpo;
    // Mira hacia donde se mueve (su velocidad)
    const vel = this.cuerpo.body.velocity;
    const angulo = Math.atan2(vel.y, vel.x);
    // Palpita un poco, como si respirara
    const pulso = this.escalaBase * (1 + Math.sin((this.escena.time.now + this.fase) * 0.012) * 0.06);
    if (!this.escena.tweens.isTweening(this.sprite)) {
      this.sprite.setScale(pulso);
      this.ojos.setScale(pulso);
    }
    this.sprite.setPosition(x, y).setRotation(angulo);
    this.ojos.setPosition(x, y).setRotation(angulo);
    this.sombra.setPosition(x, y + 10);

    this.barra.dibujar(x, y - this.radio - 16, this.vida / this.config.vidaMax);
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

    // Destello blanco al recibir el golpe: setTintFill pinta todo de un color
    this.sprite.setTintFill(0xffffff);
    this.escena.time.delayedCall(80, () => {
      if (this.sprite.active) this.sprite.setTint(this.color);
    });
  }

  destruir() {
    this.cuerpo.destroy();
    this.sprite.destroy();
    this.ojos.destroy();
    this.sombra.destroy();
    this.barra.destruir();
  }
}
