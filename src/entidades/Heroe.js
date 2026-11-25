// =============================================================
// El héroe (un Goruk)
// Etapa 5: separamos la FÍSICA del DIBUJO.
//   - "cuerpo": un círculo invisible que se mueve y choca (la física).
//   - "sprite" y "alas": las imágenes que vemos, que siguen al cuerpo.
// Así podemos cambiar el arte sin tocar cómo se mueve o choca.
// Etapa 8: el dibujo depende de la RAZA (config.textura: "orco", "elfo"...).
//   Algunas razas tienen una parte extra animada: alas (aletean) o cola (se menea).
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

    // FÍSICA: círculo invisible (velocidad y choque con los muros)
    this.cuerpo = escena.add.circle(x, y, config.radio, 0xffffff).setVisible(false);
    escena.physics.add.existing(this.cuerpo);
    this.cuerpo.body.setCircle(config.radio);
    this.cuerpo.body.setCollideWorldBounds(true);

    // DIBUJO: sombra en el suelo, parte extra (alas o cola) y cuerpo. "depth" = capa
    const textura = config.textura || 'goruk';
    this.tipoExtra = config.extra; // 'alas', 'cola' o null
    this.sombra = escena.add.image(x, y + 8, 'sombra').setAlpha(0.35).setScale(1.1, 0.8).setDepth(9);
    // v0.1.7: AURA DORADA (8 piezas del set God): un brillo que late debajo del héroe
    this.aura = config.aura
      ? escena.add.image(x, y, 'brillo').setTint(0xf5c542).setBlendMode(Phaser.BlendModes.ADD).setDepth(9).setScale(2.4)
      : null;
    this.alas = this.tipoExtra ? escena.add.image(x, y, `${textura}-${this.tipoExtra}`).setDepth(10) : null;
    this.sprite = escena.add.image(x, y, `${textura}-cuerpo`).setDepth(11);

    // Dirección en la que mira (vector de largo 1). Empieza mirando a la derecha.
    this.mirando = new Phaser.Math.Vector2(1, 0);

    this.barra = new BarraVida(escena, config.radio * 2.4, 0x66bb6a);
  }

  get vivo() {
    return this.vida > 0;
  }

  /**
   * Mueve al héroe y actualiza su dibujo.
   * @param {Phaser.Math.Vector2} direccion  vector con largo entre 0 y 1
   */
  mover(direccion) {
    // velocidad final = dirección × velocidad máxima (píxeles por segundo).
    // El motor de física se encarga de multiplicar por el tiempo (delta).
    this.cuerpo.body.setVelocity(direccion.x * this.velocidad, direccion.y * this.velocidad);

    if (direccion.lengthSq() > 0) {
      this.mirando.copy(direccion).normalize();
    }
    this.actualizarDibujo(direccion.lengthSq() > 0);
  }

  /**
   * Etapa 9 (cooperativo): coloca al héroe del OTRO jugador donde dice la red.
   * No usa física: solo lo pone en (x, y) mirando hacia (mx, my).
   */
  colocarRemoto(x, y, mx, my, moviendose) {
    this.cuerpo.body.reset(x, y); // reset: mueve el cuerpo y deja su velocidad en 0
    if (mx || my) this.mirando.set(mx, my).normalize();
    this.actualizarDibujo(moviendose);
  }

  /** Mueve el dibujo (cuerpo, alas o cola, sombra y barra) a donde está el cuerpo físico */
  actualizarDibujo(moviendose) {
    const { x, y } = this.cuerpo;
    const t = this.escena.time.now;

    // Giro suave hacia donde mira: RotateTo avanza un poco cada frame
    const objetivo = Math.atan2(this.mirando.y, this.mirando.x);
    const giro = Phaser.Math.Angle.RotateTo(this.sprite.rotation, objetivo, 0.25);

    // "Respirar" al moverse y aletear siempre (Math.sin da una onda de -1 a 1)
    const paso = moviendose ? 1 + Math.sin(t * 0.025) * 0.05 : 1;
    const aleteo = 0.8 + Math.sin(t * (moviendose ? 0.02 : 0.008)) * 0.2;

    this.sprite.setPosition(x, y).setRotation(giro).setScale(paso);
    if (this.tipoExtra === 'alas') this.alas.setPosition(x, y).setRotation(giro).setScale(1, aleteo);
    if (this.tipoExtra === 'cola') this.alas.setPosition(x, y).setRotation(giro + Math.sin(t * 0.012) * 0.25);
    this.sombra.setPosition(x, y + 10);
    if (this.aura) this.aura.setPosition(x, y).setAlpha(0.45 + Math.sin(t * 0.006) * 0.2);

    this.barra.dibujar(x, y - this.radio - 22, this.vida / this.config.vidaMax);

    // Caído (cooperativo): se ve como un fantasma hasta que lo reviven
    const alfa = this.vivo ? 1 : 0.3;
    if (this.sprite.alpha !== alfa && !this.escena.tweens.isTweening(this.sprite)) {
      this.sprite.setAlpha(alfa);
      if (this.alas) this.alas.setAlpha(alfa);
    }
    if (this.etiqueta) this.etiqueta.setPosition(x, y - this.radio - 44);
  }

  /** Nombre flotante sobre el héroe (para distinguir al compañero) */
  ponerEtiqueta(texto) {
    this.etiqueta = this.escena.add.text(0, 0, texto, {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#05070d', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(55);
  }

  /** Quita al héroe de la escena (si el compañero se desconecta) */
  destruir() {
    for (const objeto of [this.cuerpo, this.sprite, this.alas, this.sombra, this.etiqueta, this.aura]) {
      if (objeto) objeto.destroy();
    }
    this.barra.destruir();
  }

  /** Gira al héroe para que mire hacia el punto (x, y) — usado por el auto-apuntado */
  apuntarA(x, y) {
    this.mirando.set(x - this.cuerpo.x, y - this.cuerpo.y).normalize();
    this.sprite.setRotation(Math.atan2(this.mirando.y, this.mirando.x)); // gira al instante
  }

  /**
   * Ataque básico: un golpe en un círculo justo delante del héroe.
   * Devuelve la zona de impacto { x, y, radio } para que la escena
   * revise a qué enemigos alcanza.
   * @param {object} ataque  datos de balance.json → "ataqueBasico" (o los del rol)
   * @param {number} tinte   color del tajo (Fase 1: cada rol tiene el suyo)
   * @param {boolean} alReves  el tajo barre en sentido contrario (2.ª cuchillada del Asesino)
   */
  atacar(ataque, tinte = 0xffe082, alReves = false) {
    const distancia = this.radio + ataque.alcance / 2;
    const zona = {
      x: this.cuerpo.x + this.mirando.x * distancia,
      y: this.cuerpo.y + this.mirando.y * distancia,
      radio: ataque.alcance / 2,
    };

    // Efecto visual: un "tajo" dorado en media luna que barre de un lado al otro
    const angulo = Phaser.Math.RadToDeg(Math.atan2(this.mirando.y, this.mirando.x));
    const tajo = this.escena.add.image(this.cuerpo.x, this.cuerpo.y, 'tajo')
      .setTint(tinte).setScale(distancia / 36).setAngle(alReves ? angulo + 35 : angulo - 35)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(40);
    if (alReves) tajo.setFlipY(true); // espejo: la media luna mira al otro lado
    this.escena.tweens.add({
      targets: tajo, angle: alReves ? angulo - 35 : angulo + 35, alpha: 0, duration: 160,
      onComplete: () => tajo.destroy(),
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
      targets: [this.sprite, this.alas].filter(Boolean), alpha: 0.3, duration: 100, yoyo: true, repeat: 2,
    });
    return true;
  }
}
