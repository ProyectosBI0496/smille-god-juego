// =============================================================
// Escena de la arena (Etapa 1)
// Una arena más grande que la pantalla, con muros. El héroe se
// mueve con el joystick táctil o con el teclado, y la cámara lo sigue.
// =============================================================

import Heroe from '../entidades/Heroe.js';
import Joystick from '../controles/Joystick.js';

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
    const balance = this.cache.json.get('balance');
    const { ancho, alto, grosorMuro, tamanoCuadricula } = balance.arena;

    this.dibujarArena(ancho, alto, grosorMuro, tamanoCuadricula);

    // Límites del mundo físico = el interior de la arena (sin los muros)
    this.physics.world.setBounds(
      grosorMuro, grosorMuro,
      ancho - grosorMuro * 2, alto - grosorMuro * 2
    );

    // El héroe aparece en el centro de la arena
    this.heroe = new Heroe(this, ancho / 2, alto / 2, balance.heroe);

    // La cámara sigue al héroe sin salirse de la arena.
    // 0.1 = la sigue con suavidad (no de golpe).
    this.cameras.main.setBounds(0, 0, ancho, alto);
    this.cameras.main.startFollow(this.heroe.cuerpo, true, 0.1, 0.1);

    // Controles: teclado (para el PC) y joystick (para el celular)
    this.teclas = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
    this.joystick = new Joystick(this, balance.joystick);

    // Vector reutilizable para la dirección (evita crear uno nuevo en cada frame)
    this.direccion = new Phaser.Math.Vector2();

    this.crearTextos();
  }

  update() {
    if (this.joystick.activo) {
      // El joystick manda: su dirección ya viene entre 0 y 1
      this.direccion.copy(this.joystick.direccion);
    } else {
      // Teclado: sumamos -1 / +1 según las teclas apretadas
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

    this.heroe.mover(this.direccion);
  }

  /** Dibuja el suelo con cuadrícula y los cuatro muros */
  dibujarArena(ancho, alto, grosorMuro, tamanoCuadricula) {
    const g = this.add.graphics();

    // Suelo
    g.fillStyle(0x111827);
    g.fillRect(0, 0, ancho, alto);

    // Cuadrícula: sirve para notar el movimiento cuando la cámara sigue al héroe
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

    this.add.text(20, 16, 'Smille God · Etapa 1 — Arena y movimiento', estilo)
      .setScrollFactor(0)
      .setDepth(100);

    this.add.text(this.scale.width / 2, this.scale.height - 36,
      'Mueve con el pulgar izquierdo (o con WASD / flechas)', { ...estilo, color: '#ffffff' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);
  }
}
