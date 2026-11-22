// =============================================================
// Escena de la arena
// Etapa 1: arena con muros, héroe con joystick/teclado, cámara.
// Etapa 2: botón de ataque, enemigo que persigue, vida y daño.
// =============================================================

import Heroe from '../entidades/Heroe.js';
import Enemigo from '../entidades/Enemigo.js';
import Joystick from '../controles/Joystick.js';
import BotonHabilidad from '../controles/BotonHabilidad.js';

export default class EscenaArena extends Phaser.Scene {
  constructor() {
    super('EscenaArena');
  }

  // preload(): se ejecuta ANTES de create(). Aquí se cargan archivos.
  preload() {
    this.load.json('balance', 'src/datos/balance.json');
  }

  create() {
    // Todos los números del juego vienen de balance.json
    this.balance = this.cache.json.get('balance');
    const { ancho, alto, grosorMuro, tamanoCuadricula } = this.balance.arena;

    this.dibujarArena(ancho, alto, grosorMuro, tamanoCuadricula);

    // Límites del mundo físico = el interior de la arena (sin los muros)
    this.physics.world.setBounds(grosorMuro, grosorMuro, ancho - grosorMuro * 2, alto - grosorMuro * 2);

    // El héroe aparece en el centro de la arena
    this.heroe = new Heroe(this, ancho / 2, alto / 2, this.balance.heroe);

    // La cámara sigue al héroe con suavidad, sin salirse de la arena
    this.cameras.main.setBounds(0, 0, ancho, alto);
    this.cameras.main.startFollow(this.heroe.cuerpo, true, 0.1, 0.1);

    // ---- Controles ----
    // Teclado (PC): mover con WASD/flechas, atacar con ESPACIO o J
    this.teclas = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J');
    // Joystick (celular): mitad izquierda
    this.joystick = new Joystick(this, this.balance.joystick);
    // Botón 1 — ataque básico (celular): esquina inferior derecha
    const { radio, margen } = this.balance.botones;
    this.botonAtaque = new BotonHabilidad(this, {
      x: this.scale.width - margen - radio,
      y: this.scale.height - margen - radio,
      radio,
      etiqueta: 'ATQ',
      recargaMs: this.balance.ataqueBasico.recargaMs,
      color: 0xf5c542,
      alPulsar: () => this.atacar(),
    });

    // Vector reutilizable para la dirección (evita crear uno nuevo en cada frame)
    this.direccion = new Phaser.Math.Vector2();

    // ---- Enemigos ----
    this.enemigos = [];
    this.derrotados = 0;
    this.crearEnemigo();

    this.crearTextos();
  }

  update() {
    if (!this.heroe.vivo) return;

    this.leerMovimiento();
    this.heroe.mover(this.direccion);

    // Ataque con teclado (JustDown = solo en el instante en que se aprieta)
    if (Phaser.Input.Keyboard.JustDown(this.teclas.SPACE) || Phaser.Input.Keyboard.JustDown(this.teclas.J)) {
      this.botonAtaque.usar();
    }
    this.botonAtaque.actualizar();

    // Enemigos: perseguir y, si tocan al héroe, hacerle daño
    for (const enemigo of this.enemigos) {
      enemigo.actualizar(this.heroe);
      const distancia = Phaser.Math.Distance.Between(
        enemigo.cuerpo.x, enemigo.cuerpo.y, this.heroe.cuerpo.x, this.heroe.cuerpo.y
      );
      if (distancia < enemigo.radio + this.heroe.radio) {
        if (this.heroe.recibirDanio(enemigo.config.danioContacto)) {
          this.cameras.main.shake(100, 0.006); // sacudida de cámara
          if (!this.heroe.vivo) this.derrota();
        }
      }
    }
  }

  /** Arma la dirección de movimiento desde el joystick o el teclado */
  leerMovimiento() {
    if (this.joystick.activo) {
      this.direccion.copy(this.joystick.direccion); // ya viene con fuerza 0–1
      return;
    }
    const t = this.teclas;
    let x = 0;
    let y = 0;
    if (t.A.isDown || t.LEFT.isDown) x -= 1;
    if (t.D.isDown || t.RIGHT.isDown) x += 1;
    if (t.W.isDown || t.UP.isDown) y -= 1;
    if (t.S.isDown || t.DOWN.isDown) y += 1;
    this.direccion.set(x, y);
    // Normalizar: en diagonal el héroe no debe ir más rápido
    if (this.direccion.lengthSq() > 0) this.direccion.normalize();
  }

  /** Ataque básico: golpea a todos los enemigos dentro de la zona de impacto */
  atacar() {
    if (!this.heroe.vivo) return;
    const ataque = this.balance.ataqueBasico;
    const zona = this.heroe.atacar(ataque);

    for (const enemigo of [...this.enemigos]) {
      const distancia = Phaser.Math.Distance.Between(zona.x, zona.y, enemigo.cuerpo.x, enemigo.cuerpo.y);
      if (distancia <= zona.radio + enemigo.radio) {
        enemigo.recibirDanio(ataque.danio, this.heroe.mirando, ataque.empuje);
        this.mostrarNumero(enemigo.cuerpo.x, enemigo.cuerpo.y - enemigo.radio, ataque.danio);
        if (!enemigo.vivo) this.eliminarEnemigo(enemigo);
      }
    }
  }

  /** Crea un enemigo en un punto al azar, lejos del héroe */
  crearEnemigo() {
    const { ancho, alto, grosorMuro } = this.balance.arena;
    const config = this.balance.enemigo;
    const margen = grosorMuro + config.radio;
    let x;
    let y;
    do {
      x = Phaser.Math.Between(margen, ancho - margen);
      y = Phaser.Math.Between(margen, alto - margen);
    } while (Phaser.Math.Distance.Between(x, y, this.heroe.cuerpo.x, this.heroe.cuerpo.y) < config.distanciaMinimaAparicion);

    this.enemigos.push(new Enemigo(this, x, y, config));
  }

  /** Quita un enemigo derrotado y programa la aparición de otro */
  eliminarEnemigo(enemigo) {
    enemigo.destruir();
    this.enemigos = this.enemigos.filter((e) => e !== enemigo);
    this.derrotados += 1;
    this.textoDerrotados.setText(`Enemigos derrotados: ${this.derrotados}`);
    this.time.delayedCall(this.balance.enemigo.reaparecerMs, () => {
      if (this.heroe.vivo) this.crearEnemigo();
    });
  }

  /** Número de daño que sube y se desvanece */
  mostrarNumero(x, y, valor) {
    const texto = this.add.text(x, y, `-${valor}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '24px', color: '#ffeb3b', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(60);
    this.tweens.add({
      targets: texto, y: y - 40, alpha: 0, duration: 600,
      onComplete: () => texto.destroy(),
    });
  }

  /** El héroe cayó: mensaje y reinicio automático */
  derrota() {
    this.heroe.cuerpo.body.setVelocity(0, 0);
    for (const enemigo of this.enemigos) enemigo.cuerpo.body.setVelocity(0, 0);
    this.add.text(this.scale.width / 2, this.scale.height / 2, 'Has caído', {
      fontFamily: 'Georgia, serif', fontSize: '64px', color: '#f5c542',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
    this.time.delayedCall(1800, () => this.scene.restart());
  }

  /** Dibuja el suelo con cuadrícula y los cuatro muros */
  dibujarArena(ancho, alto, grosorMuro, tamanoCuadricula) {
    const g = this.add.graphics();

    g.fillStyle(0x111827);
    g.fillRect(0, 0, ancho, alto);

    // Cuadrícula: ayuda a notar el movimiento cuando la cámara sigue al héroe
    g.lineStyle(1, 0x1f2a40);
    for (let x = 0; x <= ancho; x += tamanoCuadricula) g.lineBetween(x, 0, x, alto);
    for (let y = 0; y <= alto; y += tamanoCuadricula) g.lineBetween(0, y, ancho, y);

    // Muros (arriba, abajo, izquierda, derecha)
    g.fillStyle(0x4a3b5c);
    g.fillRect(0, 0, ancho, grosorMuro);
    g.fillRect(0, alto - grosorMuro, ancho, grosorMuro);
    g.fillRect(0, 0, grosorMuro, alto);
    g.fillRect(ancho - grosorMuro, 0, grosorMuro, alto);

    // Borde interior dorado
    g.lineStyle(3, 0xf5c542, 0.6);
    g.strokeRect(grosorMuro, grosorMuro, ancho - grosorMuro * 2, alto - grosorMuro * 2);
  }

  /** Textos fijos en pantalla (no se mueven con la cámara) */
  crearTextos() {
    const estilo = { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#9fb3c8' };

    this.add.text(20, 16, 'Smille God · Etapa 2 — Ataque y primer enemigo', estilo)
      .setScrollFactor(0).setDepth(100);

    this.textoDerrotados = this.add.text(20, 46, 'Enemigos derrotados: 0', { ...estilo, color: '#ffffff' })
      .setScrollFactor(0).setDepth(100);

    this.add.text(this.scale.width / 2, this.scale.height - 36,
      'Pulgar izquierdo: mover · Botón ATQ: atacar (PC: WASD + ESPACIO)', { ...estilo, color: '#ffffff' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(100);
  }
}
