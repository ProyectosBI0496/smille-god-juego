// =============================================================
// Escena de juego
// Etapa 1: arena con muros, héroe con joystick/teclado, cámara.
// Etapa 2: botón de ataque, enemigo que persigue, vida y daño.
// Etapa 3: auto-apuntado, Botón 2 "Onda", Botón 3 "Torbellino".
// Etapa 4: oleadas, derrota, partículas, vibración, "object pooling".
// Etapa 5: arte provisional, ambiente con antorchas y viñeta.
// Etapa 6: MUNDOS-MAZMORRA (D-025): el héroe camina de sala en sala;
//          cada sala tiene una oleada y cada cierto número hay un
//          salón del jefe. Curas (pociones), victoria y desbloqueo.
// =============================================================

// Tipografía de fantasía (Google Fonts, cargada en index.html).
// Si no carga, el navegador usa Georgia.
export const FUENTE_TITULO = '"Cinzel", Georgia, serif';

import Heroe from '../entidades/Heroe.js';
import Enemigo from '../entidades/Enemigo.js';
import Jefe from '../entidades/Jefe.js';
import Joystick from '../controles/Joystick.js';
import BotonHabilidad from '../controles/BotonHabilidad.js';
import Mazmorra from '../mundo/Mazmorra.js';
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

    crearTexturas(this);                  // texturas comunes (solo la primera vez)
    crearTexturasMundo(this, this.mundo); // suelo, muro y adornos de ESTE mundo

    // La mazmorra: salas, pasillos, muros y puertas
    this.mazmorra = new Mazmorra(this, this.mundo, this.balance.mazmorra);
    const { ancho, alto, salas } = this.mazmorra;
    this.physics.world.setBounds(0, 0, ancho, alto);
    this.crearAmbiente();
    this.cameras.main.fadeIn(400);

    // El héroe aparece en la sala de entrada
    const entrada = salas[0];
    this.heroe = new Heroe(this, entrada.x + 150, entrada.medio, this.balance.heroe);
    this.physics.add.collider(this.heroe.cuerpo, this.mazmorra.muros);
    this.physics.add.collider(this.heroe.cuerpo, this.mazmorra.puertas.filter(Boolean));

    // La cámara sigue al héroe con suavidad, sin salirse de la mazmorra
    this.cameras.main.setBounds(0, 0, ancho, alto);
    this.cameras.main.startFollow(this.heroe.cuerpo, true, 0.1, 0.1);

    // ---- Controles ----
    // Teclado (PC): WASD/flechas; ESPACIO/J ataque, K Onda, L Torbellino, H cura
    this.teclas = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J,K,L,H');
    this.joystick = new Joystick(this, this.balance.joystick);
    this.direccion = new Phaser.Math.Vector2(); // reutilizable (no crear uno por frame)

    // ---- Estado de la partida ----
    this.enemigos = [];
    this.derrotados = 0;
    this.salaActiva = null;      // la sala donde se está peleando ahora
    this.oleadasVencidas = 0;
    this.jefesVencidos = 0;
    this.curas = this.mundo.curas;
    this.numerosLibres = [];     // "pool": números de daño guardados para reutilizar
    this.terminado = false;      // true al ganar el mundo

    this.crearBotones();
    this.crearEfectos();
    this.crearTextos();
    this.crearBotonPausa();
    this.actualizarHud();
    this.mostrarAnuncio(this.mundo.nombre);
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
    if (recienApretada(this.teclas.H)) this.botonCura.usar();
    for (const boton of [this.botonAtaque, this.botonOnda, this.botonTorbellino, this.botonCura]) boton.actualizar();

    this.revisarEntradaASala();

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

    this.dibujarBarraJefe();
    // El clima sigue a la cámara: solo se generan partículas donde se ve
    for (const emisor of this.climas) emisor.setPosition(this.cameras.main.scrollX, this.cameras.main.scrollY);
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

  // =============================================================
  // Salas: entrar, pelear, vencer
  // =============================================================

  /** Si el héroe entra (un poco) a una sala que espera, empieza su combate */
  revisarEntradaASala() {
    if (this.salaActiva) return;
    const { x, y } = this.heroe.cuerpo;
    const i = this.mazmorra.salaEn(x, y);
    if (i < 0) return;
    const sala = this.mazmorra.salas[i];
    if (sala.estado !== 'esperando' || x < sala.x + this.balance.mazmorra.distanciaActivar) return;
    this.activarSala(sala, i);
  }

  activarSala(sala, indice) {
    sala.estado = 'combate';
    sala.indice = indice;
    this.salaActiva = sala;

    if (sala.tipo === 'oleada') {
      for (const [tipo, cantidad] of Object.entries(this.composicionOleada(sala.numero))) {
        for (let i = 0; i < cantidad; i++) this.crearEnemigo(this.configEnemigo(tipo), sala);
      }
      this.mostrarAnuncio(`Oleada ${sala.numero} de ${this.mundo.oleadas}`);
    } else {
      const total = this.mazmorra.totalJefes;
      this.mostrarAnuncio(total === 1 ? '¡El jefe!' : `¡Jefe ${sala.numero} de ${total}!`);
      this.cameras.main.shake(400, 0.006);
      this.time.delayedCall(this.balance.oleadas.retrasoJefeMs, () => {
        if (this.heroe.vivo) this.crearEnemigo(this.configJefe(sala.numero), sala, Jefe);
      });
    }
    this.actualizarHud();
  }

  /**
   * Cuántos enemigos de cada tipo salen en la oleada "n".
   * balance.json da [mínimo, máximo] por tipo: la primera oleada usa el mínimo,
   * la última el máximo, y las del medio van creciendo de a poco.
   */
  composicionOleada(n) {
    const total = this.mundo.oleadas;
    const avance = total > 1 ? (n - 1) / (total - 1) : 1; // de 0 a 1
    const resultado = {};
    for (const [tipo, [min, max]] of Object.entries(this.mundo.enemigos)) {
      resultado[tipo] = Math.round(min + (max - min) * avance);
    }
    return resultado;
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

  /** El jefe número "n" del mundo: cada uno tiene un poco más de vida que el anterior */
  configJefe(n) {
    const comun = this.balance.jefe;
    const propio = this.mundo.jefe;
    return {
      ...comun,  // comportamiento común (embestida, aviso...)
      ...propio, // tamaño, vida y velocidad de los jefes de ESTE mundo
      vidaMax: Math.round(propio.vidaMax * (1 + (n - 1) * comun.aumentoVidaPorJefe)),
      radioTextura: 50,
      color: this.mundo.colores.jefe,
    };
  }

  /**
   * Crea un enemigo (o un jefe) dentro de la sala, lejos del héroe.
   * "Clase" permite elegir qué crear: Enemigo por defecto, o Jefe.
   */
  crearEnemigo(config, sala, Clase = Enemigo) {
    const margen = config.radio + 20;
    const minima = this.balance.mazmorra.distanciaMinimaAparicion;
    let x;
    let y;
    let intentos = 0;
    do {
      x = Phaser.Math.Between(sala.x + margen, sala.x + sala.ancho - margen);
      y = Phaser.Math.Between(sala.y + margen, sala.y + sala.alto - margen);
      intentos += 1;
    } while (intentos < 30 && Phaser.Math.Distance.Between(x, y, this.heroe.cuerpo.x, this.heroe.cuerpo.y) < minima);

    const enemigo = new Clase(this, x, y, config);
    // Los enemigos también chocan con los muros y las puertas
    this.physics.add.collider(enemigo.cuerpo, this.mazmorra.muros);
    this.physics.add.collider(enemigo.cuerpo, this.mazmorra.puertas.filter(Boolean));
    this.enemigos.push(enemigo);
  }

  /** Quita un enemigo derrotado; si la sala quedó vacía, la da por vencida */
  eliminarEnemigo(enemigo) {
    const esJefe = enemigo instanceof Jefe; // instanceof: ¿este objeto es de la clase Jefe?
    this.chispas.explode(esJefe ? 50 : 16, enemigo.cuerpo.x, enemigo.cuerpo.y);
    const luz = this.add.image(enemigo.cuerpo.x, enemigo.cuerpo.y, 'brillo').setTint(0xff7043)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(44);
    this.tweens.add({ targets: luz, scale: esJefe ? 4 : 1.6, alpha: 0, duration: esJefe ? 600 : 300, onComplete: () => luz.destroy() });
    if (esJefe) this.cameras.main.shake(250, 0.01);
    this.vibrar(esJefe ? 120 : 25);
    enemigo.destruir();
    this.enemigos = this.enemigos.filter((e) => e !== enemigo);
    this.derrotados += 1;

    if (this.enemigos.length === 0 && this.salaActiva && this.heroe.vivo) this.salaVencida();
    this.actualizarHud();
  }

  /** Sala vencida: un poco de vida, se abre la reja y se sigue caminando */
  salaVencida() {
    const sala = this.salaActiva;
    sala.estado = 'vencida';
    this.salaActiva = null;
    if (sala.tipo === 'oleada') this.oleadasVencidas += 1;
    else this.jefesVencidos += 1;

    const ultima = sala.indice === this.mazmorra.salas.length - 1;
    if (ultima) {
      this.terminado = true;
      this.time.delayedCall(900, () => this.victoria());
      return;
    }
    this.heroe.vida = Math.min(this.heroe.vida + this.balance.oleadas.curacionPorSala, this.balance.heroe.vidaMax);
    this.mazmorra.abrirPuerta(sala.indice);
    this.mostrarAnuncio(sala.tipo === 'jefe' ? '¡Jefe vencido! →' : '¡Sigue adelante! →');
  }

  // =============================================================
  // Cura (pociones)
  // =============================================================

  /** Usa una cura si quedan y si el héroe no tiene la vida llena */
  usarCura() {
    const max = this.balance.heroe.vidaMax;
    if (this.curas <= 0 || this.heroe.vida >= max || !this.heroe.vivo) return;
    this.curas -= 1;
    this.heroe.vida = Math.min(this.heroe.vida + this.balance.cura.cantidad, max);
    // Efecto: destello verde y números de curación
    const { x, y } = this.heroe.cuerpo;
    const luz = this.add.image(x, y, 'brillo').setTint(0x66bb6a).setBlendMode(Phaser.BlendModes.ADD).setDepth(44);
    this.tweens.add({ targets: luz, scale: 2.5, alpha: 0, duration: 500, onComplete: () => luz.destroy() });
    this.mostrarNumero(x, y - 40, `+${this.balance.cura.cantidad}`, '#a5d6a7');
    this.actualizarHud();
  }

  // =============================================================
  // Combate (igual que en etapas anteriores)
  // =============================================================

  /** Crea los botones: ataque, Onda, Torbellino y cura */
  crearBotones() {
    const { radio, radioPequeno, margen } = this.balance.botones;
    const xAtq = this.scale.width - margen - radio;
    const yAtq = this.scale.height - margen - radio;

    // Botón 1 — ataque básico (el más grande, bajo el pulgar)
    this.botonAtaque = new BotonHabilidad(this, {
      x: xAtq, y: yAtq, radio, etiqueta: 'ATQ', icono: 'icono-espada',
      recargaMs: this.balance.ataqueBasico.recargaMs, color: 0xf5c542,
      alPulsar: () => this.atacar(),
    });
    // Botón 2 — "Onda": a la izquierda del ataque
    this.botonOnda = new BotonHabilidad(this, {
      x: xAtq - 150, y: yAtq + 25, radio: radioPequeno, etiqueta: 'ONDA', icono: 'icono-onda',
      recargaMs: this.balance.habilidad.recargaMs, color: 0x4fc3f7,
      alPulsar: () => this.usarOnda(),
    });
    // Botón 3 — "Torbellino": encima del ataque
    this.botonTorbellino = new BotonHabilidad(this, {
      x: xAtq - 35, y: yAtq - 150, radio: radioPequeno, etiqueta: 'ESP', icono: 'icono-torbellino',
      recargaMs: this.balance.especial.recargaMs, color: 0xab47bc,
      alPulsar: () => this.usarTorbellino(),
    });
    // Botón 4 — cura: más arriba, con el número de curas que quedan
    const xCura = xAtq - 175;
    const yCura = yAtq - 120;
    this.botonCura = new BotonHabilidad(this, {
      x: xCura, y: yCura, radio: 42, etiqueta: 'CURA', icono: 'icono-cura',
      recargaMs: this.balance.cura.recargaMs, color: 0x66bb6a,
      alPulsar: () => this.usarCura(),
    });
    this.textoCuras = this.add.text(xCura + 30, yCura + 26, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#05070d', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(103);
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
      this.mostrarNumero(enemigo.cuerpo.x, enemigo.cuerpo.y - enemigo.radio, `-${danio}`);
      if (enemigo.vida <= 0) this.eliminarEnemigo(enemigo);
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

    // Anillo que se expande + destello azul (BlendMode ADD = suma luz, como un foco)
    const anillo = this.add.circle(x, y, 10).setStrokeStyle(8, 0x4fc3f7).setDepth(40);
    this.tweens.add({ targets: anillo, radius: h.radio, alpha: 0, duration: 250, onComplete: () => anillo.destroy() });
    const luz = this.add.image(x, y, 'brillo').setTint(0x4fc3f7)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(39).setScale(0.5);
    this.tweens.add({ targets: luz, scale: (h.radio * 2.4) / 128, alpha: 0, duration: 350, onComplete: () => luz.destroy() });
    this.cameras.main.shake(120, 0.004);

    this.golpearArea(x, y, h.radio, h.danio, h.empuje, x, y);
  }

  /** Botón 3 — "Torbellino": varios golpes giratorios seguidos alrededor del héroe */
  usarTorbellino() {
    if (!this.heroe.vivo) return;
    const e = this.balance.especial;

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
   * Número que sube y se desvanece (daño o curación).
   * OBJECT POOLING: reutilizamos los textos guardados en "numerosLibres".
   */
  mostrarNumero(x, y, texto, colorTexto = '#ffeb3b') {
    let numero = this.numerosLibres.pop();
    if (!numero) {
      numero = this.add.text(0, 0, '', {
        fontFamily: 'Arial, sans-serif', fontSize: '26px', fontStyle: 'bold',
        stroke: '#3e1a00', strokeThickness: 5, // borde oscuro: se lee sobre cualquier fondo
      }).setOrigin(0.5).setDepth(60);
    }
    numero.setText(texto).setColor(colorTexto).setPosition(x, y).setAlpha(1).setVisible(true);
    this.tweens.add({
      targets: numero, y: y - 40, alpha: 0, duration: 600,
      onComplete: () => {
        numero.setVisible(false);
        this.numerosLibres.push(numero); // vuelve al pool
      },
    });
  }

  /** Vibra el celular (si el navegador lo permite y el jugador ya tocó la pantalla) */
  vibrar(ms) {
    const yaToco = !navigator.userActivation || navigator.userActivation.hasBeenActive;
    if (navigator.vibrate && yaToco) navigator.vibrate(ms);
  }

  /** Un solo emisor de chispas reutilizable: "explode" lanza N partículas donde se le diga */
  crearEfectos() {
    this.chispas = this.add.particles(0, 0, 'chispa', {
      speed: { min: 80, max: 260 },
      lifespan: 450,
      scale: { start: 1.2, end: 0 },
      tint: [0xe53935, 0xff8a65, 0xffeb3b],
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(45);
  }

  // =============================================================
  // Pausa, derrota y victoria
  // =============================================================

  /**
   * Botón de pausa (arriba a la derecha) + teclas P y ESC.
   * También pausa solo si el jugador sale de la app o cambia de pestaña.
   */
  crearBotonPausa() {
    const x = this.scale.width - 55;
    const y = 55;
    const boton = this.add.circle(x, y, 34, 0x0b0f1a, 0.55).setStrokeStyle(3, 0xf5c542, 0.8)
      .setScrollFactor(0).setDepth(100).setInteractive();
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

  /** Congela la escena y abre el menú de pausa encima */
  pausar() {
    if (!this.heroe.vivo || this.terminado || !this.scene.isActive()) return;
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

    const detalle = `${this.mundo.nombre} · oleadas ${this.oleadasVencidas}/${this.mundo.oleadas} · jefes ${this.jefesVencidos}/${this.mazmorra.totalJefes}`;
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
    const mensaje = siguiente ? `Desbloqueaste: ${siguiente.nombre}` : '¡Venciste todos los mundos del prototipo!';
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

    fijo(this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x000000, 0.65)).setInteractive();
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

  // =============================================================
  // Ambiente y textos
  // =============================================================

  /** Clima (partículas que siguen a la cámara) y viñeta */
  crearAmbiente() {
    const W = this.scale.width;
    const H = this.scale.height;
    // Las partículas nacen en un rectángulo del tamaño de la pantalla,
    // que en update() movemos junto con la cámara.
    const zona = { x: { min: 0, max: W }, y: { min: 0, max: H } };
    const climas = {
      hojas: { textura: 'hoja', speedY: { min: 20, max: 50 }, speedX: { min: -30, max: 30 }, rotate: { min: 0, max: 360 },
        tint: [0x9ccc65, 0xffb300, 0xe65100], scale: 1, alpha: { start: 0.9, end: 0 }, lifespan: 5000, frequency: 160 },
      luciernagas: { textura: 'brillo', speedY: { min: -15, max: 15 }, speedX: { min: -15, max: 15 },
        tint: 0xd4e157, scale: { start: 0.12, end: 0.04 }, alpha: { start: 0.9, end: 0 }, lifespan: 3000, frequency: 220, blendMode: 'ADD' },
      polvo: { textura: 'chispa', speedX: { min: 60, max: 140 }, speedY: { min: -10, max: 10 },
        tint: 0xfff3d6, scale: { start: 0.8, end: 0.2 }, alpha: { start: 0.5, end: 0 }, lifespan: 3500, frequency: 70 },
      brasas: { textura: 'chispa', speedY: { min: -40, max: -15 }, speedX: { min: -10, max: 10 },
        tint: [0xff7043, 0xffb74d], scale: { start: 0.6, end: 0 }, alpha: { start: 0.7, end: 0 }, lifespan: 4000, frequency: 120, blendMode: 'ADD' },
      nieve: { textura: 'chispa', speedY: { min: 40, max: 90 }, speedX: { min: 10, max: 40 },
        tint: 0xffffff, scale: { start: 0.9, end: 0.5 }, alpha: { start: 0.9, end: 0 }, lifespan: 5000, frequency: 40 },
    };
    this.climas = this.mundo.clima.map((tipo) => {
      const { textura, ...config } = climas[tipo]; // separamos la textura del resto
      return this.add.particles(0, 0, textura, { ...zona, ...config }).setDepth(5);
    });

    // VIÑETA: fija en la pantalla, encima del mundo y debajo de los controles
    this.add.image(W / 2, H / 2, 'vineta').setScrollFactor(0).setDepth(90);
  }

  /** Una antorcha: llama que tiembla y un halo de luz que parpadea (la usa la Mazmorra) */
  crearAntorcha(x, y) {
    const halo = this.add.image(x, y, 'brillo').setTint(0xff8a3d).setAlpha(0.35)
      .setScale(2.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(4);
    const llama = this.add.image(x, y - 6, 'llama').setDepth(4);
    this.tweens.add({
      targets: halo, alpha: 0.2, scale: 2.3, duration: Phaser.Math.Between(180, 320),
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: llama, scaleY: 1.2, scaleX: 0.85, duration: Phaser.Math.Between(120, 220),
      yoyo: true, repeat: -1,
    });
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

  /** Textos fijos en pantalla (no se mueven con la cámara) */
  crearTextos() {
    const estilo = {
      fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#ffffff',
      stroke: '#05070d', strokeThickness: 4,
    };
    this.add.text(20, 14, `SMILLE GOD · ${this.mundo.nombre.toUpperCase()}`, { ...estilo, fontFamily: FUENTE_TITULO, color: '#c9a94a' })
      .setScrollFactor(0).setDepth(100);
    this.textoProgreso = this.add.text(20, 42, '', {
      ...estilo, fontFamily: FUENTE_TITULO, fontSize: '28px', color: '#f5c542', fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(100);
    this.textoDerrotados = this.add.text(20, 80, '', estilo).setScrollFactor(0).setDepth(100);
    this.add.text(20, this.scale.height - 36,
      'PC: WASD mover · ESPACIO atacar · K Onda · L Torbellino · H cura · P pausa', { ...estilo, fontSize: '18px', color: '#c8d3e0' })
      .setScrollFactor(0).setDepth(100);

    // Barra grande de vida del jefe, arriba al centro (se dibuja en update)
    this.barraJefe = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.textoJefe = this.add.text(this.scale.width / 2, 22, '', { ...estilo, fontFamily: FUENTE_TITULO, fontSize: '20px', color: '#ffccbc' })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);
  }

  /** Actualiza los textos de progreso, derrotados y curas */
  actualizarHud() {
    this.textoProgreso.setText(`Oleadas ${this.oleadasVencidas}/${this.mundo.oleadas} · Jefes ${this.jefesVencidos}/${this.mazmorra.totalJefes}`);
    this.textoDerrotados.setText(`Derrotados: ${this.derrotados}`);
    this.textoCuras.setText(`${this.curas}`);
    this.botonCura.circulo.setAlpha(this.curas > 0 ? 1 : 0.35);
    this.botonCura.texto.setAlpha(this.curas > 0 ? 1 : 0.35);
  }

  /** Barra con la vida del jefe que se está enfrentando */
  dibujarBarraJefe() {
    const g = this.barraJefe;
    g.clear();
    const jefe = this.enemigos.find((e) => e instanceof Jefe);
    if (!jefe) {
      this.textoJefe.setText('');
      return;
    }
    const porcentaje = Phaser.Math.Clamp(jefe.vida / jefe.config.vidaMax, 0, 1);
    const ancho = 480;
    const x = this.scale.width / 2 - ancho / 2;
    g.fillStyle(0x000000, 0.6).fillRect(x - 3, 50, ancho + 6, 22);
    g.fillStyle(color(this.mundo.colores.jefe)).fillRect(x, 53, ancho * porcentaje, 16);
    g.lineStyle(2, 0xf5c542, 0.8).strokeRect(x - 3, 50, ancho + 6, 22);
    const total = this.mazmorra.totalJefes;
    this.textoJefe.setText(total === 1 ? 'JEFE' : `JEFE ${this.salaActiva ? this.salaActiva.numero : ''} DE ${total}`);
  }
}
