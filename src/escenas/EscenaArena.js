// =============================================================
// Escena de la arena
// Etapa 1: arena con muros, héroe con joystick/teclado, cámara.
// Etapa 2: botón de ataque, enemigo que persigue, vida y daño.
// Etapa 3: auto-apuntado, Botón 2 "Onda", Botón 3 "Torbellino",
//          varios enemigos a la vez.
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
    // Teclado (PC): mover con WASD/flechas; ESPACIO/J ataque, K Onda, L Torbellino
    this.teclas = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J,K,L');
    // Joystick (celular): mitad izquierda
    this.joystick = new Joystick(this, this.balance.joystick);
    this.crearBotones();

    // Vector reutilizable para la dirección (evita crear uno nuevo en cada frame)
    this.direccion = new Phaser.Math.Vector2();

    // ---- Enemigos ----
    this.enemigos = [];
    this.derrotados = 0;
    for (let i = 0; i < this.balance.enemigo.simultaneos; i++) this.crearEnemigo();

    this.crearTextos();
  }

  update() {
    if (!this.heroe.vivo) return;

    this.leerMovimiento();
    this.heroe.mover(this.direccion);

    // Habilidades con teclado (JustDown = solo en el instante en que se aprieta)
    const recienApretada = Phaser.Input.Keyboard.JustDown;
    if (recienApretada(this.teclas.SPACE) || recienApretada(this.teclas.J)) this.botonAtaque.usar();
    if (recienApretada(this.teclas.K)) this.botonOnda.usar();
    if (recienApretada(this.teclas.L)) this.botonTorbellino.usar();

    this.botonAtaque.actualizar();
    this.botonOnda.actualizar();
    this.botonTorbellino.actualizar();

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

  /** Crea los 3 botones de habilidades en la esquina inferior derecha */
  crearBotones() {
    const { radio, radioPequeno, margen } = this.balance.botones;
    const xAtq = this.scale.width - margen - radio;
    const yAtq = this.scale.height - margen - radio;

    // Botón 1 — ataque básico (el más grande, bajo el pulgar)
    this.botonAtaque = new BotonHabilidad(this, {
      x: xAtq, y: yAtq, radio,
      etiqueta: 'ATQ',
      recargaMs: this.balance.ataqueBasico.recargaMs,
      color: 0xf5c542,
      alPulsar: () => this.atacar(),
    });

    // Botón 2 — habilidad "Onda": a la izquierda del ataque
    this.botonOnda = new BotonHabilidad(this, {
      x: xAtq - 150, y: yAtq + 25, radio: radioPequeno,
      etiqueta: 'ONDA',
      recargaMs: this.balance.habilidad.recargaMs,
      color: 0x4fc3f7,
      alPulsar: () => this.usarOnda(),
    });

    // Botón 3 — especial "Torbellino": encima del ataque
    this.botonTorbellino = new BotonHabilidad(this, {
      x: xAtq - 35, y: yAtq - 150, radio: radioPequeno,
      etiqueta: 'ESP',
      recargaMs: this.balance.especial.recargaMs,
      color: 0xab47bc,
      alPulsar: () => this.usarTorbellino(),
    });
  }

  /**
   * Daña a todos los enemigos dentro de un círculo.
   * El empuje los aleja del punto (origenX, origenY).
   * Lo usan las tres habilidades: así la lógica de daño vive en un solo lugar.
   */
  golpearArea(x, y, radio, danio, empuje, origenX, origenY) {
    const direccion = new Phaser.Math.Vector2();
    for (const enemigo of [...this.enemigos]) {
      const distancia = Phaser.Math.Distance.Between(x, y, enemigo.cuerpo.x, enemigo.cuerpo.y);
      if (distancia > radio + enemigo.radio) continue;

      direccion.set(enemigo.cuerpo.x - origenX, enemigo.cuerpo.y - origenY);
      if (direccion.lengthSq() === 0) direccion.set(1, 0); // por si están en el mismo punto
      direccion.normalize();

      enemigo.recibirDanio(danio, direccion, empuje);
      this.mostrarNumero(enemigo.cuerpo.x, enemigo.cuerpo.y - enemigo.radio, danio);
      if (!enemigo.vivo) this.eliminarEnemigo(enemigo);
    }
  }

  /** Devuelve el enemigo más cercano al héroe dentro de un rango (o null) */
  enemigoMasCercano(rango) {
    let elegido = null;
    let mejor = rango;
    for (const enemigo of this.enemigos) {
      const d = Phaser.Math.Distance.Between(
        this.heroe.cuerpo.x, this.heroe.cuerpo.y, enemigo.cuerpo.x, enemigo.cuerpo.y
      );
      if (d <= mejor) {
        mejor = d;
        elegido = enemigo;
      }
    }
    return elegido;
  }

  /** Botón 1 — ataque básico con AUTO-APUNTADO al enemigo más cercano */
  atacar() {
    if (!this.heroe.vivo) return;
    const ataque = this.balance.ataqueBasico;

    // Si hay un enemigo cerca, el héroe se gira hacia él antes de golpear.
    // Si no hay ninguno, golpea hacia donde está mirando.
    const objetivo = this.enemigoMasCercano(ataque.rangoAutoApuntado);
    if (objetivo) this.heroe.apuntarA(objetivo.cuerpo.x, objetivo.cuerpo.y);

    const zona = this.heroe.atacar(ataque);
    this.golpearArea(zona.x, zona.y, zona.radio, ataque.danio, ataque.empuje,
      this.heroe.cuerpo.x, this.heroe.cuerpo.y);
  }

  /** Botón 2 — "Onda": empujón en área alrededor del héroe */
  usarOnda() {
    if (!this.heroe.vivo) return;
    const h = this.balance.habilidad;
    const { x, y } = this.heroe.cuerpo;

    // Efecto visual: un anillo que se expande
    const anillo = this.add.circle(x, y, 10).setStrokeStyle(6, 0x4fc3f7).setDepth(40);
    this.tweens.add({
      targets: anillo, radius: h.radio, alpha: 0, duration: 250,
      onComplete: () => anillo.destroy(),
    });
    this.cameras.main.shake(120, 0.004);

    this.golpearArea(x, y, h.radio, h.danio, h.empuje, x, y);
  }

  /** Botón 3 — "Torbellino": varios golpes giratorios seguidos alrededor del héroe */
  usarTorbellino() {
    if (!this.heroe.vivo) return;
    const e = this.balance.especial;

    // Efecto visual: un anillo morado que gira y sigue al héroe
    const anillo = this.add.circle(this.heroe.cuerpo.x, this.heroe.cuerpo.y, e.radio)
      .setStrokeStyle(5, 0xab47bc, 0.8).setDepth(40);
    const duracion = e.golpes * e.intervaloMs;
    this.tweens.add({ targets: anillo, angle: 360 * 3, duration: duracion });

    // Un temporizador que se repite: un golpe cada "intervaloMs"
    let golpesDados = 0;
    this.time.addEvent({
      delay: e.intervaloMs,
      repeat: e.golpes - 1,
      callback: () => {
        golpesDados += 1;
        if (!this.heroe.vivo) return;
        const { x, y } = this.heroe.cuerpo;
        anillo.setPosition(x, y);
        anillo.setAlpha(0.5 + (golpesDados % 2) * 0.5); // parpadeo en cada golpe
        this.golpearArea(x, y, e.radio, e.danio, e.empuje, x, y);
        if (golpesDados >= e.golpes) anillo.destroy();
      },
    });
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

    this.add.text(20, 16, 'Smille God · Etapa 3 — Habilidades', estilo)
      .setScrollFactor(0).setDepth(100);

    this.textoDerrotados = this.add.text(20, 46, 'Enemigos derrotados: 0', { ...estilo, color: '#ffffff' })
      .setScrollFactor(0).setDepth(100);

    this.add.text(20, this.scale.height - 36,
      'PC: WASD mover · ESPACIO atacar · K Onda · L Torbellino', { ...estilo, fontSize: '18px' })
      .setScrollFactor(0).setDepth(100);
  }
}
