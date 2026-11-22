// =============================================================
// Escena de la arena
// Etapa 1: arena con muros, héroe con joystick/teclado, cámara.
// Etapa 2: botón de ataque, enemigo que persigue, vida y daño.
// Etapa 3: auto-apuntado, Botón 2 "Onda", Botón 3 "Torbellino",
//          varios enemigos a la vez.
// Etapa 4: oleadas, pantalla de derrota con récord, partículas,
//          vibración y "object pooling" de los números de daño.
// =============================================================

const CLAVE_RECORD = 'smilleGod.mejorOleada';

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
    this.oleada = 0;
    this.numerosLibres = []; // "pool": números de daño guardados para reutilizar

    this.crearEfectos();
    this.crearTextos();
    this.iniciarSiguienteOleada();
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
          this.vibrar(60);                     // vibración del celular
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

  /** Empieza la siguiente oleada: más enemigos, más rápidos y resistentes */
  iniciarSiguienteOleada() {
    if (!this.heroe.vivo) return;
    this.oleada += 1;
    const o = this.balance.oleadas;
    const base = this.balance.enemigo;
    const n = this.oleada - 1; // cuántas oleadas se han superado

    // Entre oleadas, el héroe recupera un poco de vida
    if (n > 0) {
      this.heroe.vida = Math.min(this.heroe.vida + o.curacionEntreOleadas, this.balance.heroe.vidaMax);
    }

    // La configuración del enemigo crece con cada oleada.
    // { ...base } copia todos los datos y luego sobrescribimos los que cambian.
    const config = {
      ...base,
      velocidad: base.velocidad + n * o.aumentoVelocidad,
      vidaMax: base.vidaMax + n * o.aumentoVida,
    };
    const cantidad = o.enemigosIniciales + n * o.enemigosPorOleada;
    for (let i = 0; i < cantidad; i++) this.crearEnemigo(config);

    this.textoOleada.setText(`Oleada ${this.oleada}`);
    this.mostrarAnuncio(`Oleada ${this.oleada}`);
  }

  /** Texto grande en el centro que aparece y se desvanece */
  mostrarAnuncio(mensaje) {
    const texto = this.add.text(this.scale.width / 2, this.scale.height / 2 - 120, mensaje, {
      fontFamily: 'Georgia, serif', fontSize: '56px', color: '#f5c542',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(150);
    this.tweens.add({
      targets: texto, alpha: 0, y: texto.y - 30, delay: 700, duration: 600,
      onComplete: () => texto.destroy(),
    });
  }

  /** Crea un enemigo en un punto al azar, lejos del héroe */
  crearEnemigo(config) {
    const { ancho, alto, grosorMuro } = this.balance.arena;
    const margen = grosorMuro + config.radio;
    let x;
    let y;
    do {
      x = Phaser.Math.Between(margen, ancho - margen);
      y = Phaser.Math.Between(margen, alto - margen);
    } while (Phaser.Math.Distance.Between(x, y, this.heroe.cuerpo.x, this.heroe.cuerpo.y) < config.distanciaMinimaAparicion);

    this.enemigos.push(new Enemigo(this, x, y, config));
  }

  /** Quita un enemigo derrotado; si era el último, prepara la siguiente oleada */
  eliminarEnemigo(enemigo) {
    this.chispas.explode(16, enemigo.cuerpo.x, enemigo.cuerpo.y); // explosión de partículas
    this.vibrar(25);
    enemigo.destruir();
    this.enemigos = this.enemigos.filter((e) => e !== enemigo);
    this.derrotados += 1;
    this.textoDerrotados.setText(`Derrotados: ${this.derrotados}`);

    if (this.enemigos.length === 0 && this.heroe.vivo) {
      this.mostrarAnuncio('¡Oleada superada!');
      this.time.delayedCall(this.balance.oleadas.pausaMs, () => this.iniciarSiguienteOleada());
    }
  }

  /**
   * Número de daño que sube y se desvanece.
   * OBJECT POOLING: en vez de crear y destruir un texto en cada golpe
   * (cientos por partida), guardamos los textos usados en "numerosLibres"
   * y los reutilizamos. Así el celular no se traba.
   */
  mostrarNumero(x, y, valor) {
    let texto = this.numerosLibres.pop();
    if (!texto) {
      texto = this.add.text(0, 0, '', {
        fontFamily: 'Arial, sans-serif', fontSize: '24px', color: '#ffeb3b', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(60);
    }
    texto.setText(`-${valor}`).setPosition(x, y).setAlpha(1).setVisible(true);
    this.tweens.add({
      targets: texto, y: y - 40, alpha: 0, duration: 600,
      onComplete: () => {
        texto.setVisible(false);
        this.numerosLibres.push(texto); // vuelve al pool
      },
    });
  }

  /**
   * Vibra el celular. Solo si el navegador lo permite (en iPhone no existe)
   * y si el jugador ya tocó la pantalla: el navegador lo exige.
   */
  vibrar(ms) {
    const yaToco = !navigator.userActivation || navigator.userActivation.hasBeenActive;
    if (navigator.vibrate && yaToco) navigator.vibrate(ms);
  }

  /** Prepara las partículas: una textura pequeña dibujada por código */
  crearEfectos() {
    if (!this.textures.exists('chispa')) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffffff);
      g.fillCircle(4, 4, 4);
      g.generateTexture('chispa', 8, 8);
      g.destroy();
    }
    // Un solo emisor reutilizable: "explode" lanza N partículas donde se le diga
    this.chispas = this.add.particles(0, 0, 'chispa', {
      speed: { min: 80, max: 260 },
      lifespan: 450,
      scale: { start: 1.2, end: 0 },
      tint: [0xe53935, 0xff8a65, 0xffeb3b],
      emitting: false,
    }).setDepth(45);
  }

  /** El héroe cayó: pantalla de derrota con récord y botón Reintentar */
  derrota() {
    this.heroe.cuerpo.body.setVelocity(0, 0);
    for (const enemigo of this.enemigos) enemigo.cuerpo.body.setVelocity(0, 0);
    this.vibrar(300);

    // Récord guardado en el navegador (localStorage). Puede fallar en modo
    // incógnito, por eso va dentro de try/catch.
    let record = 0;
    try {
      record = Number(localStorage.getItem(CLAVE_RECORD)) || 0;
      if (this.oleada > record) {
        record = this.oleada;
        localStorage.setItem(CLAVE_RECORD, String(record));
      }
    } catch (error) {
      record = this.oleada;
    }

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const fijo = (objeto) => objeto.setScrollFactor(0).setDepth(200);

    fijo(this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x000000, 0.65));
    fijo(this.add.text(cx, cy - 140, 'Has caído', {
      fontFamily: 'Georgia, serif', fontSize: '72px', color: '#f5c542',
    }).setOrigin(0.5));
    fijo(this.add.text(cx, cy - 50,
      `Llegaste a la oleada ${this.oleada} · Derrotados: ${this.derrotados}\nRécord: oleada ${record}`, {
        fontFamily: 'Arial, sans-serif', fontSize: '28px', color: '#ffffff', align: 'center',
      }).setOrigin(0.5));

    const boton = fijo(this.add.rectangle(cx, cy + 70, 300, 80, 0xf5c542).setInteractive());
    fijo(this.add.text(cx, cy + 70, 'Reintentar', {
      fontFamily: 'Arial, sans-serif', fontSize: '32px', color: '#0b0f1a', fontStyle: 'bold',
    }).setOrigin(0.5));
    boton.on('pointerdown', () => this.scene.restart());
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

    this.add.text(20, 16, 'Smille God · Etapa 4 — Oleadas', estilo)
      .setScrollFactor(0).setDepth(100);

    this.textoOleada = this.add.text(20, 46, 'Oleada 1', { ...estilo, fontSize: '28px', color: '#f5c542' })
      .setScrollFactor(0).setDepth(100);

    this.textoDerrotados = this.add.text(20, 82, 'Derrotados: 0', { ...estilo, color: '#ffffff' })
      .setScrollFactor(0).setDepth(100);

    this.add.text(20, this.scale.height - 36,
      'PC: WASD mover · ESPACIO atacar · K Onda · L Torbellino', { ...estilo, fontSize: '18px' })
      .setScrollFactor(0).setDepth(100);
  }
}
