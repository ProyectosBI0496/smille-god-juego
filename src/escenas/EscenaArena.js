// =============================================================
// Escena de la arena
// Etapa 1: arena con muros, héroe con joystick/teclado, cámara.
// Etapa 2: botón de ataque, enemigo que persigue, vida y daño.
// Etapa 3: auto-apuntado, Botón 2 "Onda", Botón 3 "Torbellino",
//          varios enemigos a la vez.
// Etapa 4: oleadas, pantalla de derrota con récord, partículas,
//          vibración y "object pooling" de los números de daño.
// Etapa 5: arte provisional (texturas dibujadas por código), ambiente
//          con antorchas, brasas y viñeta; efectos de habilidades.
// Etapa 6: MUNDOS (Bosque, Desierto...) con oleadas fijas, tipos de
//          enemigo, JEFES al final, victoria y desbloqueo.
// =============================================================

// Tipografía de fantasía (Google Fonts, cargada en index.html).
// Si no carga, el navegador usa Georgia.
export const FUENTE_TITULO = '"Cinzel", Georgia, serif';

import Heroe from '../entidades/Heroe.js';
import Enemigo from '../entidades/Enemigo.js';
import Joystick from '../controles/Joystick.js';
import BotonHabilidad from '../controles/BotonHabilidad.js';
import Jefe from '../entidades/Jefe.js';
import { crearTexturas } from '../graficos/Texturas.js';
import { crearTexturasMundo, color } from '../graficos/TexturasMundo.js';
import { marcarSuperado } from '../datos/Progreso.js';

export default class EscenaArena extends Phaser.Scene {
  constructor() {
    super('EscenaArena');
  }

  // init(): recibe los datos con los que se abrió la escena,
  // por ejemplo { mundo: 2 } desde el mapa de mundos.
  init(datos) {
    this.indiceMundo = (datos && datos.mundo) || 0;
  }

  // preload(): se ejecuta ANTES de create(). Aquí se cargan archivos.
  preload() {
    // Normalmente ya lo cargó la pantalla de título; si no, lo cargamos aquí.
    // "?v=..." evita que el navegador use una copia vieja guardada (caché).
    if (!this.cache.json.exists('balance')) {
      this.load.json('balance', 'src/datos/balance.json?v=' + Date.now());
    }
  }

  create() {
    // Todos los números del juego vienen de balance.json
    this.balance = this.cache.json.get('balance');
    this.mundo = this.balance.mundos[this.indiceMundo];
    const { ancho, alto, grosorMuro, tamanoCuadricula } = this.balance.arena;

    crearTexturas(this);                 // texturas comunes (solo la primera vez)
    crearTexturasMundo(this, this.mundo); // suelo, muro y adornos de ESTE mundo
    this.dibujarArena(ancho, alto, grosorMuro, tamanoCuadricula);
    this.cameras.main.fadeIn(400); // la escena aparece desde negro

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
    this.oleada = 0;           // oleada actual (1, 2, 3...)
    this.fase = 'oleadas';     // 'oleadas' → 'jefes' → 'victoria'
    this.jefesPorAparecer = 0; // los jefes aparecen de a uno, con un intervalo
    this.numerosLibres = [];   // "pool": números de daño guardados para reutilizar

    this.crearEfectos();
    this.crearTextos();
    this.crearBotonPausa();
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

    this.dibujarBarraJefes();
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
      etiqueta: 'ATQ', icono: 'icono-espada',
      recargaMs: this.balance.ataqueBasico.recargaMs,
      color: 0xf5c542,
      alPulsar: () => this.atacar(),
    });

    // Botón 2 — habilidad "Onda": a la izquierda del ataque
    this.botonOnda = new BotonHabilidad(this, {
      x: xAtq - 150, y: yAtq + 25, radio: radioPequeno,
      etiqueta: 'ONDA', icono: 'icono-onda',
      recargaMs: this.balance.habilidad.recargaMs,
      color: 0x4fc3f7,
      alPulsar: () => this.usarOnda(),
    });

    // Botón 3 — especial "Torbellino": encima del ataque
    this.botonTorbellino = new BotonHabilidad(this, {
      x: xAtq - 35, y: yAtq - 150, radio: radioPequeno,
      etiqueta: 'ESP', icono: 'icono-torbellino',
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

    // Efecto visual: un anillo que se expande + un destello de luz azul.
    // BlendMode ADD = "mezcla aditiva": suma luz a lo que hay debajo, como un foco.
    const anillo = this.add.circle(x, y, 10).setStrokeStyle(8, 0x4fc3f7).setDepth(40);
    this.tweens.add({
      targets: anillo, radius: h.radio, alpha: 0, duration: 250,
      onComplete: () => anillo.destroy(),
    });
    const luz = this.add.image(x, y, 'brillo').setTint(0x4fc3f7)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(39).setScale(0.5);
    this.tweens.add({
      targets: luz, scale: (h.radio * 2.4) / 128, alpha: 0, duration: 350,
      onComplete: () => luz.destroy(),
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

    // Dos "cuchillas" (la textura del tajo) que giran alrededor del héroe
    const cuchillas = [0, 180].map((inicio) => this.add.image(0, 0, 'tajo')
      .setTint(0xce93d8).setScale(e.radio / 44).setAngle(inicio)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(41));
    this.tweens.add({ targets: cuchillas, angle: '+=1080', duration: duracion });
    // Cada frame, las cuchillas y el anillo siguen al héroe ("update" es un evento de la escena)
    const seguir = () => {
      for (const objeto of [anillo, ...cuchillas]) {
        if (objeto.active) objeto.setPosition(this.heroe.cuerpo.x, this.heroe.cuerpo.y);
      }
    };
    this.events.on('update', seguir);
    this.time.delayedCall(duracion, () => {
      this.events.off('update', seguir);
      cuchillas.forEach((c) => c.destroy());
    });

    // Un temporizador que se repite: un golpe cada "intervaloMs"
    let golpesDados = 0;
    this.time.addEvent({
      delay: e.intervaloMs,
      repeat: e.golpes - 1,
      callback: () => {
        golpesDados += 1;
        if (!this.heroe.vivo) return;
        const { x, y } = this.heroe.cuerpo;
        anillo.setAlpha(0.5 + (golpesDados % 2) * 0.5); // parpadeo en cada golpe
        this.golpearArea(x, y, e.radio, e.danio, e.empuje, x, y);
        if (golpesDados >= e.golpes) anillo.destroy();
      },
    });
  }

  /**
   * Empieza la siguiente oleada del mundo. Cada oleada de balance.json dice
   * cuántos enemigos de cada tipo salen, por ejemplo { "normal": 3, "rapido": 1 }.
   */
  iniciarSiguienteOleada() {
    if (!this.heroe.vivo || this.fase !== 'oleadas') return;
    if (this.oleada >= this.mundo.oleadas.length) return this.iniciarJefes(); // protección: no hay más oleadas
    this.oleada += 1;
    this.curarEntreOleadas();

    const oleada = this.mundo.oleadas[this.oleada - 1];
    // Object.entries convierte { normal: 3, rapido: 1 } en [["normal", 3], ["rapido", 1]]
    for (const [tipo, cantidad] of Object.entries(oleada)) {
      for (let i = 0; i < cantidad; i++) this.crearEnemigo(this.configEnemigo(tipo));
    }

    const total = this.mundo.oleadas.length;
    this.actualizarHud();
    this.mostrarAnuncio(`Oleada ${this.oleada} de ${total}`);
  }

  /** Arma la configuración de un enemigo: su tipo + la fuerza y el color del mundo */
  configEnemigo(tipo) {
    const base = this.balance.tiposEnemigo[tipo];
    const fuerza = this.mundo.fuerza;
    return {
      ...base, // "..." copia todos los datos del tipo; luego cambiamos algunos
      vidaMax: Math.round(base.vidaMax * fuerza),
      velocidad: Math.round(base.velocidad * (1 + (fuerza - 1) / 2)),
      color: this.mundo.colores[tipo],
    };
  }

  /** Terminaron las oleadas: llegan los jefes, uno tras otro */
  iniciarJefes() {
    if (!this.heroe.vivo || this.fase !== 'oleadas') return; // solo una vez
    this.fase = 'jefes';
    this.curarEntreOleadas();
    const j = this.mundo.jefes;
    const config = {
      ...this.balance.jefe, // comportamiento común (embestida, aviso...)
      ...j,                 // tamaño, vida y velocidad de los jefes de ESTE mundo
      radioTextura: 50,
      color: this.mundo.colores.jefe,
    };
    this.jefesTotal = j.cantidad;
    this.jefesPorAparecer = j.cantidad;
    this.actualizarHud();
    this.mostrarAnuncio(j.cantidad === 1 ? '¡Llega el jefe!' : `¡Llegan ${j.cantidad} jefes!`);
    this.cameras.main.shake(400, 0.006);

    // time.addEvent con "repeat": un jefe cada intervaloJefesMs
    this.time.addEvent({
      delay: this.balance.oleadas.intervaloJefesMs,
      repeat: j.cantidad - 1,
      callback: () => {
        if (!this.heroe.vivo) return;
        this.jefesPorAparecer -= 1;
        this.crearEnemigo(config, Jefe);
      },
    });
  }

  curarEntreOleadas() {
    if (this.oleada > 1 || this.fase === 'jefes') {
      const o = this.balance.oleadas;
      this.heroe.vida = Math.min(this.heroe.vida + o.curacionEntreOleadas, this.balance.heroe.vidaMax);
    }
  }

  /** Texto grande en el centro que aparece y se desvanece */
  mostrarAnuncio(mensaje) {
    const texto = this.add.text(this.scale.width / 2, this.scale.height / 2 - 120, mensaje, {
      fontFamily: FUENTE_TITULO, fontSize: '60px', color: '#f5c542', fontStyle: 'bold',
      stroke: '#3a1500', strokeThickness: 8,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(150);
    this.tweens.add({
      targets: texto, alpha: 0, y: texto.y - 30, delay: 900, duration: 600,
      onComplete: () => texto.destroy(),
    });
  }

  /**
   * Crea un enemigo (o un jefe) en un punto al azar, lejos del héroe.
   * "Clase" permite elegir qué crear: Enemigo por defecto, o Jefe.
   */
  crearEnemigo(config, Clase = Enemigo) {
    const { ancho, alto, grosorMuro } = this.balance.arena;
    const margen = grosorMuro + config.radio;
    const distanciaMinima = this.balance.oleadas.distanciaMinimaAparicion;
    let x;
    let y;
    do {
      x = Phaser.Math.Between(margen, ancho - margen);
      y = Phaser.Math.Between(margen, alto - margen);
    } while (Phaser.Math.Distance.Between(x, y, this.heroe.cuerpo.x, this.heroe.cuerpo.y) < distanciaMinima);

    this.enemigos.push(new Clase(this, x, y, config));
  }

  /** Quita un enemigo derrotado y decide qué sigue: otra oleada, los jefes o la victoria */
  eliminarEnemigo(enemigo) {
    const esJefe = enemigo instanceof Jefe; // instanceof: ¿este objeto es de la clase Jefe?
    this.chispas.explode(esJefe ? 50 : 16, enemigo.cuerpo.x, enemigo.cuerpo.y); // explosión de partículas
    const luz = this.add.image(enemigo.cuerpo.x, enemigo.cuerpo.y, 'brillo').setTint(0xff7043)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(44);
    this.tweens.add({ targets: luz, scale: esJefe ? 4 : 1.6, alpha: 0, duration: esJefe ? 600 : 300, onComplete: () => luz.destroy() });
    if (esJefe) this.cameras.main.shake(250, 0.01);
    this.vibrar(esJefe ? 120 : 25);
    enemigo.destruir();
    this.enemigos = this.enemigos.filter((e) => e !== enemigo);
    this.derrotados += 1;
    this.actualizarHud();

    if (this.enemigos.length > 0 || !this.heroe.vivo) return;

    if (this.fase === 'oleadas') {
      const quedanOleadas = this.oleada < this.mundo.oleadas.length;
      this.mostrarAnuncio('¡Oleada superada!');
      this.time.delayedCall(this.balance.oleadas.pausaMs,
        () => (quedanOleadas ? this.iniciarSiguienteOleada() : this.iniciarJefes()));
    } else if (this.fase === 'jefes' && this.jefesPorAparecer === 0) {
      this.fase = 'victoria';
      this.time.delayedCall(900, () => this.victoria());
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
        fontFamily: 'Arial, sans-serif', fontSize: '26px', color: '#ffeb3b', fontStyle: 'bold',
        stroke: '#3e1a00', strokeThickness: 5, // borde oscuro: se lee sobre cualquier fondo
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
    // (La textura 'chispa' ahora se crea en graficos/Texturas.js)
    // Un solo emisor reutilizable: "explode" lanza N partículas donde se le diga
    this.chispas = this.add.particles(0, 0, 'chispa', {
      speed: { min: 80, max: 260 },
      lifespan: 450,
      scale: { start: 1.2, end: 0 },
      tint: [0xe53935, 0xff8a65, 0xffeb3b],
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(45);
  }

  /**
   * Botón de pausa (arriba a la derecha) + teclas P y ESC.
   * También pausa solo si el jugador sale de la app o cambia de pestaña.
   */
  crearBotonPausa() {
    const x = this.scale.width - 55;
    const y = 55;
    const boton = this.add.circle(x, y, 34, 0x0b0f1a, 0.55).setStrokeStyle(3, 0xf5c542, 0.8)
      .setScrollFactor(0).setDepth(100).setInteractive();
    // Ícono: dos barras verticales
    this.add.rectangle(x - 8, y, 8, 26, 0xf5c542).setScrollFactor(0).setDepth(101);
    this.add.rectangle(x + 8, y, 8, 26, 0xf5c542).setScrollFactor(0).setDepth(101);
    boton.on('pointerdown', () => this.pausar());

    this.input.keyboard.on('keydown-P', () => this.pausar());
    this.input.keyboard.on('keydown-ESC', () => this.pausar());

    // "hidden" lo avisa Phaser cuando la página deja de verse.
    // Al cerrar la escena quitamos el aviso para no acumularlo en cada reinicio.
    this.game.events.on('hidden', this.pausar, this);
    this.events.once('shutdown', () => this.game.events.off('hidden', this.pausar, this));
  }

  /** Congela la arena y abre el menú de pausa encima */
  pausar() {
    if (!this.heroe.vivo || !this.scene.isActive()) return; // ya en pausa o en derrota
    this.joystick.soltar();             // al volver, el héroe no debe seguir caminando solo
    this.heroe.cuerpo.body.setVelocity(0, 0);
    this.scene.pause();                 // congela update, física, tiempo y animaciones
    this.scene.launch('EscenaPausa');   // "launch" abre otra escena SIN cerrar esta
  }

  /** El héroe cayó: pantalla de derrota con botones Reintentar y Mapa */
  derrota() {
    this.heroe.cuerpo.body.setVelocity(0, 0);
    for (const enemigo of this.enemigos) enemigo.cuerpo.body.setVelocity(0, 0);
    this.vibrar(300);

    const detalle = this.fase === 'jefes'
      ? `${this.mundo.nombre} · caíste ante los jefes`
      : `${this.mundo.nombre} · oleada ${this.oleada} de ${this.mundo.oleadas.length}`;
    this.pantallaFinal('Has caído', `${detalle}\nDerrotados: ${this.derrotados}`, [
      { texto: 'Reintentar', principal: true, accion: () => this.scene.restart({ mundo: this.indiceMundo }) },
      { texto: 'Mapa', accion: () => this.scene.start('EscenaMundos') },
    ]);
  }

  /** ¡Ganaste el mundo! Se guarda el progreso y se abre el siguiente */
  victoria() {
    if (!this.heroe.vivo) return;
    this.heroe.cuerpo.body.setVelocity(0, 0);
    this.heroe.invulnerableHasta = Infinity; // ya nada puede dañarlo
    marcarSuperado(this.indiceMundo);

    const siguiente = this.balance.mundos[this.indiceMundo + 1];
    const mensaje = siguiente
      ? `Desbloqueaste: ${siguiente.nombre}`
      : '¡Venciste todos los mundos del prototipo!';
    const botones = [{ texto: 'Mapa', accion: () => this.scene.start('EscenaMundos') }];
    if (siguiente) {
      botones.unshift({ // unshift: lo agrega al PRINCIPIO de la lista
        texto: 'Siguiente', principal: true,
        accion: () => this.scene.restart({ mundo: this.indiceMundo + 1 }),
      });
    }
    this.chispas.explode(80, this.heroe.cuerpo.x, this.heroe.cuerpo.y);
    this.pantallaFinal(`¡${this.mundo.nombre} superado!`, `${mensaje}\nDerrotados: ${this.derrotados}`, botones);
  }

  /** Fondo oscuro, título, texto y 1 o 2 botones (lo usan la derrota y la victoria) */
  pantallaFinal(titulo, texto, botones) {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const fijo = (objeto) => objeto.setScrollFactor(0).setDepth(200);

    fijo(this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x000000, 0.65));
    fijo(this.add.text(cx, cy - 140, titulo, {
      fontFamily: FUENTE_TITULO, fontSize: '70px', color: '#f5c542', fontStyle: 'bold',
      stroke: '#3a1500', strokeThickness: 8,
    }).setOrigin(0.5));
    fijo(this.add.text(cx, cy - 40, texto, {
      fontFamily: 'Arial, sans-serif', fontSize: '28px', color: '#ffffff', align: 'center',
    }).setOrigin(0.5));

    botones.forEach((b, i) => {
      const x = botones.length === 1 ? cx : cx + (i === 0 ? -170 : 170);
      const fondo = fijo(this.add.rectangle(x, cy + 90, 300, 80, b.principal ? 0xf5c542 : 0x0b0f1a)
        .setStrokeStyle(3, 0xf5c542).setInteractive());
      fijo(this.add.text(x, cy + 90, b.texto, {
        fontFamily: FUENTE_TITULO, fontSize: '30px', fontStyle: 'bold',
        color: b.principal ? '#0b0f1a' : '#f5c542',
      }).setOrigin(0.5));
      fondo.on('pointerdown', b.accion);
    });
  }

  /**
   * Dibuja el mundo: suelo, adornos, muros, antorchas, clima y viñeta.
   * Todo sale de balance.json → mundos[i] (colores, decoracion, clima...).
   */
  dibujarArena(ancho, alto, grosorMuro, tamanoCuadricula) {
    const id = this.mundo.id;

    // SUELO: lo "pintamos" una sola vez sobre una RenderTexture (una imagen
    // grande en la memoria). Es mucho más liviano que cientos de imágenes.
    const suelo = this.add.renderTexture(0, 0, ancho, alto).setOrigin(0).setDepth(0);
    const azar = new Phaser.Math.RandomDataGenerator([id]); // semilla: siempre igual
    for (let x = 0; x < ancho; x += tamanoCuadricula) {
      for (let y = 0; y < alto; y += tamanoCuadricula) {
        const variante = azar.frac() < 0.55 ? 0 : azar.between(1, 3);
        suelo.draw(`suelo-${id}-${variante}`, x, y);
      }
    }

    // ADORNOS sobre el suelo (arbustos, cactus, lava...). La lava además brilla.
    for (const { tipo, cantidad } of this.mundo.decoracion) {
      for (let i = 0; i < cantidad; i++) {
        const x = azar.between(grosorMuro + 20, ancho - grosorMuro - 140);
        const y = azar.between(grosorMuro + 20, alto - grosorMuro - 100);
        suelo.draw(`deco-${id}-${tipo}`, x, y);
        if (tipo === 'lava') {
          const halo = this.add.image(x + 70, y + 50, 'brillo').setTint(0xff6d00).setScale(2.2)
            .setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
          this.tweens.add({ targets: halo, alpha: 0.15, duration: Phaser.Math.Between(600, 1100), yoyo: true, repeat: -1 });
        }
      }
    }

    // MUROS: TileSprite repite una textura para llenar un rectángulo
    const muro = (x, y, w, h) => this.add.tileSprite(x, y, w, h, `muro-${id}`).setOrigin(0).setDepth(2);
    muro(0, 0, ancho, grosorMuro);
    muro(0, alto - grosorMuro, ancho, grosorMuro);
    muro(0, 0, grosorMuro, alto);
    muro(ancho - grosorMuro, 0, grosorMuro, alto);

    // ANTORCHAS (solo en los mundos que las tienen)
    if (this.mundo.antorchas) {
      for (let x = 300; x < ancho; x += 600) {
        this.crearAntorcha(x, grosorMuro / 2);
        this.crearAntorcha(x, alto - grosorMuro / 2);
      }
      for (let y = 400; y < alto; y += 800) {
        this.crearAntorcha(grosorMuro / 2, y);
        this.crearAntorcha(ancho - grosorMuro / 2, y);
      }
    }

    for (const tipo of this.mundo.clima) this.crearClima(tipo, ancho, alto);

    // VIÑETA: fija en la pantalla, encima del mundo y debajo de los controles
    this.add.image(this.scale.width / 2, this.scale.height / 2, 'vineta')
      .setScrollFactor(0).setDepth(90);
  }

  /**
   * Partículas de ambiente según el mundo. Todas cubren la arena entera;
   * solo cambian la textura, el color, la dirección y la velocidad.
   */
  crearClima(tipo, ancho, alto) {
    const zona = { x: { min: 0, max: ancho }, y: { min: 0, max: alto } };
    const climas = {
      hojas: { textura: 'hoja', speedY: { min: 20, max: 50 }, speedX: { min: -30, max: 30 }, rotate: { min: 0, max: 360 },
        tint: [0x9ccc65, 0xffb300, 0xe65100], scale: 1, alpha: { start: 0.9, end: 0 }, lifespan: 5000, frequency: 120 },
      luciernagas: { textura: 'brillo', speedY: { min: -15, max: 15 }, speedX: { min: -15, max: 15 },
        tint: 0xd4e157, scale: { start: 0.12, end: 0.04 }, alpha: { start: 0.9, end: 0 }, lifespan: 3000, frequency: 160, blendMode: 'ADD' },
      polvo: { textura: 'chispa', speedX: { min: 60, max: 140 }, speedY: { min: -10, max: 10 },
        tint: 0xfff3d6, scale: { start: 0.8, end: 0.2 }, alpha: { start: 0.5, end: 0 }, lifespan: 3500, frequency: 50 },
      brasas: { textura: 'chispa', speedY: { min: -40, max: -15 }, speedX: { min: -10, max: 10 },
        tint: [0xff7043, 0xffb74d], scale: { start: 0.6, end: 0 }, alpha: { start: 0.7, end: 0 }, lifespan: 4000, frequency: 90, blendMode: 'ADD' },
      nieve: { textura: 'chispa', speedY: { min: 40, max: 90 }, speedX: { min: 10, max: 40 },
        tint: 0xffffff, scale: { start: 0.9, end: 0.5 }, alpha: { start: 0.9, end: 0 }, lifespan: 5000, frequency: 25 },
    };
    const { textura, ...config } = climas[tipo]; // separamos la textura del resto de la configuración
    this.add.particles(0, 0, textura, { ...zona, ...config }).setDepth(5);
  }

  /** Una antorcha: llama que tiembla y un halo de luz que parpadea */
  crearAntorcha(x, y) {
    const halo = this.add.image(x, y, 'brillo').setTint(0xff8a3d).setAlpha(0.35)
      .setScale(2.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(4);
    const llama = this.add.image(x, y - 6, 'llama').setDepth(4);
    // Duraciones al azar para que cada antorcha parpadee distinto
    this.tweens.add({
      targets: halo, alpha: 0.2, scale: 2.3, duration: Phaser.Math.Between(180, 320),
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: llama, scaleY: 1.2, scaleX: 0.85, duration: Phaser.Math.Between(120, 220),
      yoyo: true, repeat: -1,
    });
  }

  /** Textos fijos en pantalla (no se mueven con la cámara) */
  crearTextos() {
    const estilo = {
      fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#ffffff',
      stroke: '#05070d', strokeThickness: 4,
    };

    this.add.text(20, 14, `SMILLE GOD · ${this.mundo.nombre.toUpperCase()}`, { ...estilo, fontFamily: FUENTE_TITULO, color: '#c9a94a' })
      .setScrollFactor(0).setDepth(100);

    this.textoOleada = this.add.text(20, 42, '', {
      ...estilo, fontFamily: FUENTE_TITULO, fontSize: '32px', color: '#f5c542', fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(100);

    this.textoDerrotados = this.add.text(20, 82, '', estilo).setScrollFactor(0).setDepth(100);

    this.add.text(20, this.scale.height - 36,
      'PC: WASD mover · ESPACIO atacar · K Onda · L Torbellino · P pausa', { ...estilo, fontSize: '18px', color: '#c8d3e0' })
      .setScrollFactor(0).setDepth(100);

    // Barra grande de vida de los jefes, arriba al centro (se dibuja en update)
    this.barraJefes = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.textoJefes = this.add.text(this.scale.width / 2, 22, '', { ...estilo, fontFamily: FUENTE_TITULO, fontSize: '20px', color: '#ffccbc' })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);
  }

  /** Actualiza los textos de oleada y derrotados */
  actualizarHud() {
    const texto = this.fase === 'oleadas'
      ? `Oleada ${this.oleada}/${this.mundo.oleadas.length}`
      : '¡Jefes!';
    this.textoOleada.setText(texto);
    this.textoDerrotados.setText(`Derrotados: ${this.derrotados}`);
  }

  /** Barra con la vida SUMADA de todos los jefes, y cuántos quedan */
  dibujarBarraJefes() {
    const g = this.barraJefes;
    g.clear();
    if (this.fase !== 'jefes') {
      this.textoJefes.setText('');
      return;
    }
    const jefes = this.enemigos.filter((e) => e instanceof Jefe);
    const vidaMaxJefe = this.mundo.jefes.vidaMax * this.mundo.fuerza;
    // reduce: recorre la lista sumando la vida de cada jefe
    const vida = jefes.reduce((suma, j) => suma + Math.max(j.vida, 0), 0) + this.jefesPorAparecer * vidaMaxJefe;
    const porcentaje = Phaser.Math.Clamp(vida / (this.jefesTotal * vidaMaxJefe), 0, 1);
    const ancho = 480;
    const x = this.scale.width / 2 - ancho / 2;
    g.fillStyle(0x000000, 0.6).fillRect(x - 3, 50, ancho + 6, 22);
    g.fillStyle(color(this.mundo.colores.jefe)).fillRect(x, 53, ancho * porcentaje, 16);
    g.lineStyle(2, 0xf5c542, 0.8).strokeRect(x - 3, 50, ancho + 6, 22);
    const quedan = jefes.length + this.jefesPorAparecer;
    this.textoJefes.setText(this.jefesTotal === 1 ? 'JEFE' : `JEFES: ${quedan} de ${this.jefesTotal}`);
  }
}
