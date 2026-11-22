// =============================================================
// El héroe
// Un círculo con física, un "ojo" que indica hacia dónde mira,
// vida con barra, y un ataque básico que golpea hacia donde mira.
// =============================================================

import BarraVida from '../ui/BarraVida.js';

export default class Heroe {
  /**
   * @param {Phaser.Scene} escena
   * @param {number} x       posición inicial
   * @param {number} y
   * @param {object} config  datos de balance.json → "heroe"
   */
  constructor(escena, x, y, config) {
    this.escena = escena;
    this.config = config;
    this.radio = config.radio;
    this.velocidad = config.velocidad;
    this.vida = config.vidaMax;
    this.invulnerableHasta = 0; // tras un golpe, unos instantes sin recibir daño

    // El color viene como texto ("#4fc3f7") y Phaser lo necesita como número
    const color = Phaser.Display.Color.HexStringToColor(config.color).color;

    // Cuerpo visible + FÍSICA (velocidad y choque con los muros)
    this.cuerpo = escena.add.circle(x, y, config.radio, color);
    escena.physics.add.existing(this.cuerpo);
    this.cuerpo.body.setCircle(config.radio);
    this.cuerpo.body.setCollideWorldBounds(true);

    // El "ojo": muestra hacia dónde mira el héroe
    this.ojo = escena.add.circle(x, y, config.radio * 0.3, 0x0b0f1a);

    // Dirección en la que mira (vector de largo 1). Empieza mirando a la derecha.
    this.mirando = new Phaser.Math.Vector2(1, 0);

    this.barra = new BarraVida(escena, config.radio * 2.4, 0x66bb6a);
  }

  get vivo() {
    return this.vida > 0;
  }

  /**
   * Mueve al héroe.
   * @param {Phaser.Math.Vector2} direccion  vector con largo entre 0 y 1
   */
  mover(direccion) {
    // velocidad final = dirección × velocidad máxima (píxeles por segundo).
    // El motor de física se encarga de multiplicar por el tiempo (delta).
    this.cuerpo.body.setVelocity(direccion.x * this.velocidad, direccion.y * this.velocidad);

    if (direccion.lengthSq() > 0) {
      this.mirando.copy(direccion).normalize();
    }

    // Colocamos el ojo en el borde del cuerpo, del lado al que mira
    this.ojo.setPosition(
      this.cuerpo.x + this.mirando.x * this.radio * 0.55,
      this.cuerpo.y + this.mirando.y * this.radio * 0.55
    );

    this.barra.dibujar(this.cuerpo.x, this.cuerpo.y - this.radio - 14, this.vida / this.config.vidaMax);
  }

  /** Gira al héroe para que mire hacia el punto (x, y) — usado por el auto-apuntado */
  apuntarA(x, y) {
    this.mirando.set(x - this.cuerpo.x, y - this.cuerpo.y).normalize();
  }

  /**
   * Ataque básico: un golpe en un círculo justo delante del héroe.
   * Devuelve la zona de impacto { x, y, radio } para que la escena
   * revise a qué enemigos alcanza.
   * @param {object} ataque  datos de balance.json → "ataqueBasico"
   */
  atacar(ataque) {
    const distancia = this.radio + ataque.alcance / 2;
    const zona = {
      x: this.cuerpo.x + this.mirando.x * distancia,
      y: this.cuerpo.y + this.mirando.y * distancia,
      radio: ataque.alcance / 2,
    };

    // Efecto visual del golpe: un círculo que aparece y se desvanece
    const efecto = this.escena.add.circle(zona.x, zona.y, zona.radio, 0xffffff, 0.45).setDepth(40);
    this.escena.tweens.add({
      targets: efecto, alpha: 0, scale: 1.3, duration: 150,
      onComplete: () => efecto.destroy(),
    });

    return zona;
  }

  /** Recibe daño, salvo que esté en su breve tiempo de invulnerabilidad */
  recibirDanio(danio) {
    const ahora = this.escena.time.now;
    if (ahora < this.invulnerableHasta || !this.vivo) return false;

    this.vida = Math.max(this.vida - danio, 0);
    this.invulnerableHasta = ahora + this.config.invulnerableMs;

    // Parpadeo mientras es invulnerable
    this.escena.tweens.add({
      targets: this.cuerpo, alpha: 0.3, duration: 100, yoyo: true, repeat: 2,
    });
    return true;
  }
}
