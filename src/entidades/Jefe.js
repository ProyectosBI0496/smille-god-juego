// =============================================================
// Jefe (Etapa 6)
// "extends Enemigo" = HERENCIA (como en Java): el jefe ES un enemigo
// (tiene vida, barra, recibe daño...) pero cambia cómo se comporta.
//
// Su comportamiento es una MÁQUINA DE ESTADOS: en cada momento está
// en UN estado, y ciertas condiciones lo hacen pasar a otro:
//
//   perseguir ──(héroe cerca y embestida lista)──▶ aviso
//   aviso ──(pasó el tiempo de aviso)──▶ embestir
//   embestir ──(terminó la embestida)──▶ perseguir
// =============================================================

import Enemigo from './Enemigo.js';

export default class Jefe extends Enemigo {
  constructor(escena, x, y, config) {
    super(escena, x, y, config); // "super" llama al constructor de Enemigo
    this.estado = 'perseguir';
    this.cambioEn = 0;                                        // cuándo cambia de estado
    this.embestidaListaEn = escena.time.now + config.recargaEmbestidaMs;
    this.direccionEmbestida = new Phaser.Math.Vector2();
    this.aviso = null;                                        // la flecha roja de advertencia
  }

  actualizar(heroe) {
    const ahora = this.escena.time.now;
    const { x, y } = this.cuerpo;

    if (this.estado === 'perseguir') {
      super.actualizar(heroe); // persigue como un enemigo normal
      const distancia = Phaser.Math.Distance.Between(x, y, heroe.cuerpo.x, heroe.cuerpo.y);
      if (ahora >= this.embestidaListaEn && distancia < this.config.distanciaEmbestida) {
        this.empezarAviso(heroe);
      }
      return;
    }

    if (this.estado === 'aviso') {
      // Quieto, temblando y con una flecha roja: ¡el jugador tiene tiempo de esquivar!
      this.cuerpo.body.setVelocity(0, 0);
      const temblor = Math.sin(ahora * 0.08) * 3;
      this.dibujar(x + temblor, y);
      if (ahora >= this.cambioEn) this.empezarEmbestida();
      return;
    }

    if (this.estado === 'embestir') {
      const v = this.config.velocidadEmbestida;
      this.cuerpo.body.setVelocity(this.direccionEmbestida.x * v, this.direccionEmbestida.y * v);
      this.dibujar(x, y);
      if (ahora >= this.cambioEn) {
        this.estado = 'perseguir';
        this.sprite.setTint(this.color);
        this.embestidaListaEn = ahora + this.config.recargaEmbestidaMs;
      }
    }
  }

  empezarAviso(heroe) {
    this.estado = 'aviso';
    this.cambioEn = this.escena.time.now + this.config.avisoMs;
    // La dirección se decide AHORA: si el jugador se mueve, puede esquivarla
    this.direccionEmbestida.set(heroe.cuerpo.x - this.cuerpo.x, heroe.cuerpo.y - this.cuerpo.y).normalize();
    this.sprite.setTint(0xff5252);

    // Flecha de aviso: un rectángulo rojo semitransparente en la dirección de la embestida
    const largo = this.config.velocidadEmbestida * (this.config.duracionEmbestidaMs / 1000);
    const angulo = Math.atan2(this.direccionEmbestida.y, this.direccionEmbestida.x);
    this.aviso = this.escena.add.rectangle(this.cuerpo.x, this.cuerpo.y, largo, this.radio * 1.6, 0xff1744, 0.25)
      .setOrigin(0, 0.5).setRotation(angulo).setDepth(7);
    this.escena.tweens.add({ targets: this.aviso, alpha: 0.5, duration: 150, yoyo: true, repeat: -1 });
  }

  empezarEmbestida() {
    this.estado = 'embestir';
    this.cambioEn = this.escena.time.now + this.config.duracionEmbestidaMs;
    this.quitarAviso();
    this.escena.cameras.main.shake(150, 0.004);
  }

  /** Coloca el dibujo (sin perseguir), mirando hacia la embestida */
  dibujar(x, y) {
    const angulo = Math.atan2(this.direccionEmbestida.y, this.direccionEmbestida.x);
    this.sprite.setPosition(x, y).setRotation(angulo);
    this.ojos.setPosition(x, y).setRotation(angulo);
    this.sombra.setPosition(this.cuerpo.x, this.cuerpo.y + 10);
    this.barra.dibujar(this.cuerpo.x, this.cuerpo.y - this.radio - 16, this.vida / this.config.vidaMax);
  }

  /** Durante la embestida, los golpes no lo frenan ni lo aturden */
  recibirDanio(danio, direccion, empuje) {
    if (this.estado === 'embestir') {
      this.vida -= danio;
      this.sprite.setTintFill(0xffffff);
      this.escena.time.delayedCall(80, () => { if (this.sprite.active) this.sprite.setTint(0xff5252); });
      return;
    }
    super.recibirDanio(danio, direccion, empuje);
    if (this.estado === 'aviso') this.escena.time.delayedCall(90, () => { if (this.sprite.active) this.sprite.setTint(0xff5252); });
  }

  quitarAviso() {
    if (this.aviso) {
      this.escena.tweens.killTweensOf(this.aviso);
      this.aviso.destroy();
      this.aviso = null;
    }
  }

  destruir() {
    this.quitarAviso();
    super.destruir();
  }
}
