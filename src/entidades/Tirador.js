// =============================================================
// Tirador (Etapa 7): bestia que ataca DE LEJOS
// También hereda de Enemigo, pero en vez de perseguir:
//   - si el héroe está lejos, se acerca;
//   - si está muy cerca, retrocede;
//   - a la distancia justa, se mueve de costado (como rodeándolo).
// Cada cierto tiempo "carga" (brilla) y dispara un proyectil.
// =============================================================

import Enemigo from './Enemigo.js';

export default class Tirador extends Enemigo {
  constructor(escena, x, y, config) {
    super(escena, x, y, config);
    const d = config.disparo;
    // El primer disparo llega en un momento al azar, para que no disparen todos juntos
    this.proximoDisparo = escena.time.now + Phaser.Math.Between(800, d.recargaMs);
    this.cargando = false;
    this.sentido = Math.random() < 0.5 ? 1 : -1; // hacia qué lado rodea al héroe
    this.direccion = new Phaser.Math.Vector2();
  }

  actualizar(heroe) {
    const ahora = this.escena.time.now;
    const [cerca, lejos] = this.config.distanciaIdeal;
    const distancia = Phaser.Math.Distance.Between(this.cuerpo.x, this.cuerpo.y, heroe.cuerpo.x, heroe.cuerpo.y);
    this.direccion.set(heroe.cuerpo.x - this.cuerpo.x, heroe.cuerpo.y - this.cuerpo.y).normalize();

    // Movimiento (si no está aturdido ni cargando el disparo)
    if (ahora >= this.aturdidoHasta) {
      const v = this.config.velocidad;
      if (this.cargando) {
        this.cuerpo.body.setVelocity(0, 0);
      } else if (distancia > lejos) {
        this.cuerpo.body.setVelocity(this.direccion.x * v, this.direccion.y * v);   // acercarse
      } else if (distancia < cerca) {
        this.cuerpo.body.setVelocity(-this.direccion.x * v, -this.direccion.y * v); // alejarse
      } else {
        // De costado: el vector perpendicular a (x, y) es (-y, x)
        this.cuerpo.body.setVelocity(-this.direccion.y * v * 0.6 * this.sentido, this.direccion.x * v * 0.6 * this.sentido);
      }
    }

    // Disparo: primero un aviso (brilla), después dispara
    const d = this.config.disparo;
    if (!this.cargando && ahora >= this.proximoDisparo && distancia < lejos + 150) {
      this.cargando = true;
      this.disparoEn = ahora + d.avisoMs;
      this.sprite.setTintFill(0xffffff);
    } else if (this.cargando && ahora >= this.disparoEn) {
      this.cargando = false;
      this.proximoDisparo = ahora + d.recargaMs;
      this.sprite.setTint(this.color);
      const angulo = Math.atan2(this.direccion.y, this.direccion.x);
      this.escena.dispararProyectil(this.cuerpo.x, this.cuerpo.y, angulo, d, this.config.colorProyectil);
      if (Math.random() < 0.5) this.sentido *= -1; // a veces cambia de lado
    }

    // Siempre mira al héroe
    this.colocarDibujo(Math.atan2(this.direccion.y, this.direccion.x));
  }
}
