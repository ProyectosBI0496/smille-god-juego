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
// Etapa 7: salas con formas, bestias TIRADORAS con proyectiles,
//          ráfaga de los jefes y dificultad que sube sala a sala.
// Etapa 8: el héroe es de la RAZA elegida (vida, velocidad, fuerza,
//          recarga y un detalle propio de cada raza).
// Etapa 9: COOPERATIVO en línea. Hay un segundo héroe ("companero").
//          El anfitrión calcula todo; el invitado dibuja (ver red/Cooperativo.js).
//          Si un héroe cae, se levanta al vencer la sala; se pierde si caen los dos.
// =============================================================

// Tipografía de fantasía (Google Fonts, cargada en index.html).
// Si no carga, el navegador usa Georgia.
export const FUENTE_TITULO = '"Cinzel", Georgia, serif';

import Heroe from '../entidades/Heroe.js';
import Enemigo from '../entidades/Enemigo.js';
import Jefe from '../entidades/Jefe.js';
import Tirador from '../entidades/Tirador.js';
import Joystick from '../controles/Joystick.js';
import BotonHabilidad from '../controles/BotonHabilidad.js';
import Mazmorra from '../mundo/Mazmorra.js';
import { crearTexturas } from '../graficos/Texturas.js';
import { crearTexturasMundo, color } from '../graficos/TexturasMundo.js';
import { marcarSuperado, razaElegida, mundosSuperados } from '../datos/Progreso.js';
import { redActual } from '../red/Red.js';
import Cooperativo from '../red/Cooperativo.js';

// Qué clase usar para cada tipo de enemigo de balance.json (por defecto, Enemigo)
const CLASES = { tirador: Tirador };

export default class EscenaArena extends Phaser.Scene {
  constructor() {
    super('EscenaArena');
  }

  // init(): recibe los datos con los que se abrió la escena,
  // por ejemplo { mundo: 2 } desde el mapa de mundos.
  init(datos) {
    this.indiceMundo = (datos && datos.mundo) || 0;
    this.coop = !!(datos && datos.coop);           // ¿se juega en pareja?
    this.esInvitado = !!(datos && datos.invitado); // ¿somos el invitado?
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

    // La RAZA elegida cambia los números del héroe (si está bloqueada, se usa Humano)
    let idRaza = razaElegida();
    if (!this.balance.razas[idRaza] || this.balance.razas[idRaza].desbloqueo > mundosSuperados()) idRaza = 'humano';
    this.raza = this.balance.razas[idRaza];
    const configHeroe = {
      ...this.balance.heroe,
      vidaMax: this.raza.vidaMax,
      velocidad: this.raza.velocidad,
      textura: idRaza,
      extra: this.raza.extra,
    };

    // El héroe aparece en la sala de entrada
    const entrada = salas[0];
    this.heroe = new Heroe(this, entrada.x + 150, entrada.medio, configHeroe);
    this.heroe.raza = this.raza;
    this.physics.add.collider(this.heroe.cuerpo, this.mazmorra.muros);
    this.physics.add.collider(this.heroe.cuerpo, this.mazmorra.puertas.filter(Boolean));

    // COOPERATIVO: el héroe del otro jugador, con SU raza
    this.companero = null;
    this.cooperativo = null;
    const red = redActual();
    if (this.coop && red && red.conectado) {
      const idOtra = this.balance.razas[red.razaCompanero] ? red.razaCompanero : 'humano';
      const razaOtra = this.balance.razas[idOtra];
      this.companero = new Heroe(this, entrada.x + 150, entrada.medio + 70, {
        ...this.balance.heroe, vidaMax: razaOtra.vidaMax, velocidad: razaOtra.velocidad, textura: idOtra, extra: razaOtra.extra,
      });
      this.companero.raza = razaOtra;
      this.companero.ponerEtiqueta(`Compañero (${razaOtra.nombre})`);
      this.cooperativo = new Cooperativo(this, red);
    }

    // PROYECTILES (Etapa 7): un grupo con física que RECICLA sus objetos.
    // group.get() devuelve uno apagado si hay (object pooling) o crea uno nuevo.
    this.proyectiles = this.physics.add.group({ defaultKey: 'proyectil', maxSize: 120 });
    const apagar = (proyectil) => proyectil.disableBody(true, true); // inactivo e invisible
    this.physics.add.collider(this.proyectiles, this.mazmorra.muros, apagar);
    this.physics.add.collider(this.proyectiles, this.mazmorra.puertas.filter(Boolean), apagar);
    // Solo quien calcula el juego (solo o anfitrión) aplica el daño de los proyectiles
    if (!this.esInvitado) {
      for (const h of this.heroes()) {
        this.physics.add.overlap(h.cuerpo, this.proyectiles, (cuerpo, proyectil) => {
          if (!proyectil.active) return;
          apagar(proyectil);
          this.danarHeroe(proyectil.danio, h);
        });
      }
    }

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
    this.caido = false;          // true al perder (hay que reiniciarlo: restart reutiliza la escena)

    this.crearBotones();
    this.crearEfectos();
    this.crearTextos();
    this.crearBotonPausa();
    this.actualizarHud();
    this.mostrarAnuncio(this.mundo.nombre, true);
  }

  /** Los héroes en juego: el mío y, en pareja, el del compañero */
  heroes() {
    return [this.heroe, this.companero].filter(Boolean);
  }

  /** El héroe vivo más cercano a (x, y): a ese persiguen los enemigos */
  heroeMasCercano(x, y) {
    let elegido = null;
    let mejor = Infinity;
    for (const h of this.heroes()) {
      if (!h.vivo) continue;
      const d = Phaser.Math.Distance.Between(x, y, h.cuerpo.x, h.cuerpo.y);
      if (d < mejor) { mejor = d; elegido = h; }
    }
    return elegido;
  }

  update() {
    if (this.caido) return; // pantalla de derrota

    if (this.heroe.vivo && !this.terminado) {
      this.leerMovimiento();
      this.heroe.mover(this.direccion);
      // Habilidades con teclado (JustDown = solo en el instante en que se aprieta)
      const recienApretada = Phaser.Input.Keyboard.JustDown;
      if (recienApretada(this.teclas.SPACE) || recienApretada(this.teclas.J)) this.botonAtaque.usar();
      if (recienApretada(this.teclas.K)) this.botonOnda.usar();
      if (recienApretada(this.teclas.L)) this.botonTorbellino.usar();
      if (recienApretada(this.teclas.H)) this.botonCura.usar();
    } else {
      this.direccion.set(0, 0);
      this.heroe.mover(this.direccion); // caído: quieto (se ve como fantasma)
    }
    for (const boton of [this.botonAtaque, this.botonOnda, this.botonTorbellino, this.botonCura]) boton.actualizar();

    if (this.cooperativo) this.cooperativo.actualizar();

    // El juego en sí lo calcula quien juega solo o el anfitrión (el invitado solo dibuja)
    if (!this.esInvitado) {
      this.revisarEntradaASala();
      // Enemigos: persiguen al héroe más cercano y dañan a quien tocan
      for (const enemigo of this.enemigos) {
        const objetivo = this.heroeMasCercano(enemigo.cuerpo.x, enemigo.cuerpo.y);
        if (!objetivo) break;
        enemigo.actualizar(objetivo);
        for (const h of this.heroes()) {
          if (!h.vivo) continue;
          const distancia = Phaser.Math.Distance.Between(enemigo.cuerpo.x, enemigo.cuerpo.y, h.cuerpo.x, h.cuerpo.y);
          if (distancia < enemigo.radio + h.radio) this.danarHeroe(enemigo.config.danioContacto, h);
        }
      }
    }

    // Proyectiles que ya vivieron su tiempo se apagan (vuelven al "pool")
    const ahora = this.time.now;
    for (const p of this.proyectiles.getChildren()) {
      if (p.active && ahora >= p.muereEn) p.disableBody(true, true);
    }

    this.dibujarBarraJefe();

    // Cada 200 ms: ocultar salas lejanas y actualizar el contador de FPS
    if (this.time.now >= (this.proximoRecorte || 0)) {
      this.proximoRecorte = this.time.now + 200;
      this.mazmorra.recortar(this.cameras.main);
      this.textoFps.setText(`${Math.round(this.game.loop.actualFps)} FPS`);
    }
    // El clima sigue a la cámara: solo se generan partículas donde se ve
    for (const emisor of this.climas) emisor.setPosition(this.cameras.main.scrollX, this.cameras.main.scrollY);
  }

  /** Daño a un héroe (por contacto o proyectil). Si caen todos, se pierde. */
  danarHeroe(danio, h = this.heroe) {
    if (!h.vivo || this.terminado || this.caido) return;
    if (!h.recibirDanio(danio)) return;
    if (h === this.heroe) {
      this.cameras.main.shake(100, 0.006);
      this.vibrar(60);
    }
    if (h.vivo) return;
    if (this.heroes().some((otro) => otro.vivo)) {
      // En pareja: el caído queda como fantasma hasta que se vence la sala
      // Cada uno ve el mensaje desde su lado
      const paraQuienCayo = '¡Caíste! Tu compañero puede salvarte';
      const paraElOtro = '¡Tu compañero cayó! Vence la sala';
      const yo = h === this.heroe;
      this.mostrarAnuncio(yo ? paraQuienCayo : paraElOtro, true);
      if (this.cooperativo) this.cooperativo.enviar({ t: 'anuncio', texto: yo ? paraElOtro : paraQuienCayo });
    } else {
      this.derrota();
    }
  }

  /** Invitado: mi vida bajó (lo dice el anfitrión): sacudida, vibración y parpadeo */
  efectoDanioPropio() {
    this.cameras.main.shake(100, 0.006);
    this.vibrar(60);
    this.tweens.add({ targets: [this.heroe.sprite, this.heroe.alas].filter(Boolean), alpha: 0.3, duration: 100, yoyo: true, repeat: 2 });
  }

  /**
   * Dispara un proyectil desde (x, y) en la dirección "angulo" (en radianes).
   * cfg = { velocidad, danio, duracionMs } de balance.json
   */
  dispararProyectil(x, y, angulo, cfg, tinte = 0xffffff) {
    const p = this.proyectiles.get(x, y);
    if (!p) return; // se llegó al máximo: no dispara
    p.enableBody(true, x, y, true, true); // lo "revive" en ese punto
    p.setTint(tinte).setBlendMode(Phaser.BlendModes.ADD).setDepth(30);
    p.body.setCircle(8, 4, 4); // círculo de choque más chico que el dibujo
    // velocityFromRotation convierte ángulo + rapidez en velocidad (x, y)
    this.physics.velocityFromRotation(angulo, cfg.velocidad, p.body.velocity);
    p.danio = cfg.danio;
    p.muereEn = this.time.now + cfg.duracionMs;
    // Anfitrión: el invitado dibuja el mismo proyectil en su celular
    if (this.cooperativo && !this.esInvitado) {
      this.cooperativo.enviar({ t: 'disparo', x: Math.round(x), y: Math.round(y), a: +angulo.toFixed(3), v: cfg.velocidad, ms: cfg.duracionMs, c: tinte });
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

  // =============================================================
  // Salas: entrar, pelear, vencer
  // =============================================================

  /** Si el héroe entra (un poco) a una sala que espera, empieza su combate */
  revisarEntradaASala() {
    if (this.salaActiva) return;
    for (const h of this.heroes()) { // en pareja, basta con que entre uno
      if (!h.vivo) continue;
      const { x, y } = h.cuerpo;
      const i = this.mazmorra.salaEn(x, y);
      if (i < 0) continue;
      const sala = this.mazmorra.salas[i];
      if (sala.estado !== 'esperando' || x < sala.x + this.balance.mazmorra.distanciaActivar) continue;
      this.activarSala(sala, i);
      return;
    }
  }

  activarSala(sala, indice) {
    sala.estado = 'combate';
    sala.indice = indice;
    this.salaActiva = sala;

    if (sala.tipo === 'oleada') {
      const nivel = sala.numero - 1; // 0 en la primera sala: cada sala es un poco más dura
      for (const [tipo, cantidad] of Object.entries(this.composicionOleada(sala.numero))) {
        for (let i = 0; i < cantidad; i++) this.crearEnemigo(this.configEnemigo(tipo, nivel), sala, CLASES[tipo]);
      }
      this.mostrarAnuncio(`Oleada ${sala.numero} de ${this.mundo.oleadas}`);
    } else {
      const total = this.mazmorra.totalJefes;
      this.mostrarAnuncio(total === 1 ? '¡El jefe!' : `¡Jefe ${sala.numero} de ${total}!`);
      this.cameras.main.shake(400, 0.006);
      this.time.delayedCall(this.balance.oleadas.retrasoJefeMs, () => {
        if (!this.caido) this.crearEnemigo(this.configJefe(sala.numero), sala, Jefe);
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

  /**
   * Arma la configuración de un enemigo: su tipo + la fuerza del mundo
   * + la DIFICULTAD de la sala ("nivel" = cuántas salas van antes).
   */
  configEnemigo(tipo, nivel = 0) {
    const base = this.balance.tiposEnemigo[tipo];
    const d = this.balance.dificultad;
    const fuerza = this.mundo.fuerza;
    return {
      ...base, // "..." copia todos los datos del tipo; luego cambiamos algunos
      vidaMax: Math.round(base.vidaMax * fuerza * (1 + nivel * d.vidaPorSala)),
      velocidad: Math.round(base.velocidad * (1 + (fuerza - 1) / 2) * (1 + nivel * d.velocidadPorSala)),
      danioContacto: Math.round(base.danioContacto * (1 + nivel * d.danioPorSala)),
      color: this.mundo.colores[tipo],
      colorProyectil: color(this.mundo.colores[tipo]),
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
    Clase = Clase || Enemigo; // si el tipo no tiene clase propia, es un Enemigo normal
    const margen = config.radio + 20;
    const minima = this.balance.mazmorra.distanciaMinimaAparicion;
    let x;
    let y;
    let intentos = 0;
    do {
      x = Phaser.Math.Between(sala.x + margen, sala.x + sala.ancho - margen);
      y = Phaser.Math.Between(sala.y + margen, sala.y + sala.alto - margen);
      intentos += 1;
    } while (intentos < 40 && (
      Phaser.Math.Distance.Between(x, y, this.heroe.cuerpo.x, this.heroe.cuerpo.y) < minima ||
      !this.mazmorra.libre(x, y, config.radio + 10, sala))); // no aparecer dentro de un bloque

    const enemigo = new Clase(this, x, y, config);
    // Los enemigos también chocan con los muros y las puertas
    this.physics.add.collider(enemigo.cuerpo, this.mazmorra.muros);
    this.physics.add.collider(enemigo.cuerpo, this.mazmorra.puertas.filter(Boolean));
    this.enemigos.push(enemigo);
    if (this.cooperativo) this.cooperativo.nace(enemigo, Clase === Jefe); // se lo cuenta al invitado
  }

  /** Quita un enemigo derrotado; si la sala quedó vacía, la da por vencida */
  eliminarEnemigo(enemigo) {
    const esJefe = enemigo instanceof Jefe; // instanceof: ¿este objeto es de la clase Jefe?
    this.efectoMuerte(enemigo.cuerpo.x, enemigo.cuerpo.y, esJefe);
    if (this.cooperativo) this.cooperativo.enviar({ t: 'muerte', id: enemigo.id });
    enemigo.destruir();
    this.enemigos = this.enemigos.filter((e) => e !== enemigo);
    this.derrotados += 1;

    if (this.enemigos.length === 0 && this.salaActiva && !this.caido) this.salaVencida();
    this.actualizarHud();
  }

  /** Explosión de chispas y luz donde cae un enemigo (la usan anfitrión e invitado) */
  efectoMuerte(x, y, esJefe) {
    this.chispas.explode(esJefe ? 50 : 16, x, y);
    const luz = this.add.image(x, y, 'brillo').setTint(0xff7043).setBlendMode(Phaser.BlendModes.ADD).setDepth(44);
    this.tweens.add({ targets: luz, scale: esJefe ? 4 : 1.6, alpha: 0, duration: esJefe ? 600 : 300, onComplete: () => luz.destroy() });
    if (esJefe) this.cameras.main.shake(250, 0.01);
    this.vibrar(esJefe ? 120 : 25);
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
    for (const h of this.heroes()) {
      if (!h.vivo) h.vida = Math.round(h.config.vidaMax / 2); // en pareja: el caído se levanta
      else h.vida = Math.min(h.vida + this.balance.oleadas.curacionPorSala, h.config.vidaMax);
    }
    this.mazmorra.abrirPuerta(sala.indice);
    if (this.cooperativo) this.cooperativo.enviar({ t: 'puerta', i: sala.indice });
    this.mostrarAnuncio(sala.tipo === 'jefe' ? '¡Jefe vencido! →' : '¡Sigue adelante! →');
  }

  // =============================================================
  // Cura (pociones)
  // =============================================================

  /** Usa una cura si quedan y si el héroe no tiene la vida llena */
  usarCura(h = this.heroe) {
    const max = h.config.vidaMax;
    if (this.curas <= 0 || h.vida >= max || !h.vivo) return;
    this.curas -= 1; // en pareja, las curas se comparten
    const cantidad = Math.round(this.balance.cura.cantidad * (h.raza.cura || 1)); // los Derial curan más
    h.vida = Math.min(h.vida + cantidad, max);
    // Efecto: destello verde y números de curación
    const { x, y } = h.cuerpo;
    const luz = this.add.image(x, y, 'brillo').setTint(0x66bb6a).setBlendMode(Phaser.BlendModes.ADD).setDepth(44);
    this.tweens.add({ targets: luz, scale: 2.5, alpha: 0, duration: 500, onComplete: () => luz.destroy() });
    this.mostrarNumero(x, y - 40, `+${cantidad}`, '#a5d6a7');
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
    const recarga = this.raza.recarga; // < 1 = la raza recarga más rápido (Humano)

    // Botón 1 — ataque básico (el más grande, bajo el pulgar)
    this.botonAtaque = new BotonHabilidad(this, {
      x: xAtq, y: yAtq, radio, etiqueta: 'ATQ', icono: 'icono-espada',
      recargaMs: this.balance.ataqueBasico.recargaMs * recarga, color: 0xf5c542,
      alPulsar: () => this.accion('atq'),
    });
    // Botón 2 — "Onda": a la izquierda del ataque
    this.botonOnda = new BotonHabilidad(this, {
      x: xAtq - 150, y: yAtq + 25, radio: radioPequeno, etiqueta: 'ONDA', icono: 'icono-onda',
      recargaMs: this.balance.habilidad.recargaMs * recarga, color: 0x4fc3f7,
      alPulsar: () => this.accion('onda'),
    });
    // Botón 3 — "Torbellino": encima del ataque
    this.botonTorbellino = new BotonHabilidad(this, {
      x: xAtq - 35, y: yAtq - 150, radio: radioPequeno, etiqueta: 'ESP', icono: 'icono-torbellino',
      recargaMs: this.balance.especial.recargaMs * recarga, color: 0xab47bc,
      alPulsar: () => this.accion('torb'),
    });
    // Botón 4 — cura: más arriba, con el número de curas que quedan
    const xCura = xAtq - 175;
    const yCura = yAtq - 120;
    this.botonCura = new BotonHabilidad(this, {
      x: xCura, y: yCura, radio: 42, etiqueta: 'CURA', icono: 'icono-cura',
      recargaMs: this.balance.cura.recargaMs, color: 0x66bb6a,
      alPulsar: () => this.accion('cura'),
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
  golpearArea(x, y, radio, danioBase, empujeBase, origenX, origenY, h = this.heroe) {
    if (this.esInvitado) return; // el invitado solo dibuja: el daño lo calcula el anfitrión
    // La raza de quien golpea multiplica el daño (Orco, Goruk...) y el empuje (Toro)
    const danio = Math.round(danioBase * h.raza.danio);
    const empuje = empujeBase * (h.raza.empuje || 1);
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
  enemigoMasCercano(rango, h = this.heroe) {
    let elegido = null;
    let mejor = rango;
    for (const enemigo of this.enemigos) {
      const d = Phaser.Math.Distance.Between(
        h.cuerpo.x, h.cuerpo.y, enemigo.cuerpo.x, enemigo.cuerpo.y
      );
      if (d <= mejor) {
        mejor = d;
        elegido = enemigo;
      }
    }
    return elegido;
  }

  /**
   * Un botón (o tecla) de MI héroe. En pareja, además se avisa al otro:
   *   - el invitado dibuja su ataque y le pide al anfitrión que lo haga "de verdad" (hab);
   *   - el anfitrión lo hace y le cuenta al invitado para que lo dibuje (efecto).
   */
  accion(tipo) {
    const h = this.heroe;
    if (!h.vivo || this.caido || this.terminado) return;
    if (tipo === 'cura') {
      if (this.esInvitado) this.cooperativo.enviar({ t: 'hab', h: 'cura' }); // las curas las cuenta el anfitrión
      else this.usarCura(h);
      return;
    }
    this.ejecutarHabilidad(tipo, h);
    if (!this.cooperativo) return;
    const ang = +Math.atan2(h.mirando.y, h.mirando.x).toFixed(3);
    this.cooperativo.enviar(this.esInvitado ? { t: 'hab', h: tipo } : { t: 'efecto', h: tipo, ang });
  }

  ejecutarHabilidad(tipo, h) {
    if (tipo === 'atq') this.atacar(h);
    else if (tipo === 'onda') this.usarOnda(h);
    else if (tipo === 'torb') this.usarTorbellino(h);
  }

  /** Anfitrión: el invitado usó una habilidad; se hace con SU héroe (aquí sí hace daño) */
  ejecutarRemota(tipo) {
    const h = this.companero;
    if (!h || !h.vivo || this.caido || this.terminado) return;
    if (tipo === 'cura') this.usarCura(h);
    else this.ejecutarHabilidad(tipo, h);
  }

  /** Invitado: el anfitrión usó una habilidad; solo se dibuja */
  efectoRemoto(m) {
    const h = this.companero;
    if (!h) return;
    if (m.h === 'atq') {
      h.mirando.set(Math.cos(m.ang), Math.sin(m.ang));
      h.atacar(this.balance.ataqueBasico); // solo el dibujo del tajo
    } else {
      this.ejecutarHabilidad(m.h, h);
    }
  }

  /** Botón 1 — ataque básico con AUTO-APUNTADO al enemigo más cercano */
  atacar(h = this.heroe) {
    if (!h.vivo) return;
    const ataque = this.balance.ataqueBasico;
    const objetivo = this.enemigoMasCercano(ataque.rangoAutoApuntado * (h.raza.autoApuntado || 1), h); // el Elfo apunta más lejos
    if (objetivo) h.apuntarA(objetivo.cuerpo.x, objetivo.cuerpo.y);

    const zona = h.atacar(ataque);
    // Corrección (sesión 14): si el enemigo está muy pegado (incluso encima del héroe),
    // el golpe se centra en él; antes salía por delante y no lo tocaba.
    if (objetivo && Phaser.Math.Distance.Between(h.cuerpo.x, h.cuerpo.y, objetivo.cuerpo.x, objetivo.cuerpo.y) < h.radio + ataque.alcance) {
      zona.x = objetivo.cuerpo.x;
      zona.y = objetivo.cuerpo.y;
    }
    this.golpearArea(zona.x, zona.y, zona.radio, ataque.danio, ataque.empuje, h.cuerpo.x, h.cuerpo.y, h);
  }

  /** Botón 2 — "Onda": empujón en área alrededor del héroe */
  usarOnda(heroe = this.heroe) {
    if (!heroe.vivo) return;
    const h = this.balance.habilidad;
    const { x, y } = heroe.cuerpo;

    // Anillo que se expande + destello azul (BlendMode ADD = suma luz, como un foco)
    const anillo = this.add.circle(x, y, 10).setStrokeStyle(8, 0x4fc3f7).setDepth(40);
    this.tweens.add({ targets: anillo, radius: h.radio, alpha: 0, duration: 250, onComplete: () => anillo.destroy() });
    const luz = this.add.image(x, y, 'brillo').setTint(0x4fc3f7)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(39).setScale(0.5);
    this.tweens.add({ targets: luz, scale: (h.radio * 2.4) / 128, alpha: 0, duration: 350, onComplete: () => luz.destroy() });
    if (heroe === this.heroe) this.cameras.main.shake(120, 0.004);

    this.golpearArea(x, y, h.radio, h.danio, h.empuje, x, y, heroe);
  }

  /** Botón 3 — "Torbellino": varios golpes giratorios seguidos alrededor del héroe */
  usarTorbellino(heroe = this.heroe) {
    if (!heroe.vivo) return;
    const e = this.balance.especial;

    const anillo = this.add.circle(heroe.cuerpo.x, heroe.cuerpo.y, e.radio)
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
      if (!heroe.cuerpo.active) return; // el compañero pudo desconectarse
      for (const objeto of [anillo, ...cuchillas]) {
        if (objeto.active) objeto.setPosition(heroe.cuerpo.x, heroe.cuerpo.y);
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
        if (golpesDados >= e.golpes) anillo.destroy();
        if (!heroe.vivo || !heroe.cuerpo.active) return;
        const { x, y } = heroe.cuerpo;
        anillo.setAlpha(0.5 + (golpesDados % 2) * 0.5); // parpadeo en cada golpe
        this.golpearArea(x, y, e.radio, e.danio, e.empuje, x, y, heroe);
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
    this.events.once('shutdown', () => {
      this.game.events.off('hidden', this.pausar, this);
      // Corrección (sesión 12): si el menú de pausa quedó abierto, se cierra
      // al salir de esta escena. Si no, quedaba encima y bloqueaba los toques.
      this.scene.stop('EscenaPausa');
    });
  }

  /** Congela la escena y abre el menú de pausa encima */
  pausar() {
    if (this.cooperativo) return; // en pareja no se pausa: el otro sigue jugando
    if (!this.heroe.vivo || this.terminado || this.caido || !this.scene.isActive()) return;
    this.joystick.soltar();             // al volver, el héroe no debe seguir caminando solo
    this.heroe.cuerpo.body.setVelocity(0, 0);
    this.scene.pause();                 // congela update, física, tiempo y animaciones
    this.scene.launch('EscenaPausa');   // "launch" abre otra escena SIN cerrar esta
  }

  /** El héroe cayó: pantalla de derrota con botones Reintentar y Mapa */
  derrota() {
    if (this.caido) return; // solo una vez, aunque lleguen dos golpes juntos
    this.caido = true;
    this.joystick.soltar();
    this.heroe.cuerpo.body.setVelocity(0, 0);
    for (const enemigo of this.enemigos) {
      if (enemigo.cuerpo.body) enemigo.cuerpo.body.setVelocity(0, 0);
    }
    this.vibrar(300);

    const detalle = `${this.mundo.nombre} · oleadas ${this.oleadasVencidas}/${this.mundo.oleadas} · jefes ${this.jefesVencidos}/${this.mazmorra.totalJefes}`;
    const titulo = this.cooperativo ? 'Han caído' : 'Has caído';
    const texto = `${detalle}\nDerrotados: ${this.derrotados}`;
    if (this.cooperativo) this.cooperativo.enviar({ t: 'fin', tipo: 'derrota', titulo, texto });
    this.pantallaFinal(titulo, texto, [
      { texto: 'Reintentar', principal: true, accion: () => this.jugarMundo(this.indiceMundo) },
      { texto: 'Mapa', accion: () => this.irAlMapa() },
    ]);
  }

  /** Empieza (o reinicia) un mundo. En pareja, el invitado entra también. */
  jugarMundo(indice) {
    if (this.cooperativo) this.cooperativo.enviar({ t: 'iniciar', mundo: indice });
    this.scene.restart({ mundo: indice, coop: !!this.cooperativo });
  }

  /** Vuelve al mapa. En pareja, el invitado queda esperando en la sala. */
  irAlMapa() {
    if (this.cooperativo) this.cooperativo.enviar({ t: 'esperar' });
    this.scene.start('EscenaMundos');
  }

  /** Se cortó la conexión con el compañero */
  companeroDesconectado() {
    const red = this.cooperativo && this.cooperativo.red;
    this.cooperativo = null;
    if (red) red.cerrar();
    if (this.esInvitado) {
      // Sin anfitrión no hay juego: volver al título
      this.mostrarAnuncio('Se cortó la conexión', true);
      this.time.delayedCall(1800, () => this.scene.start('EscenaTitulo'));
      return;
    }
    // Anfitrión: sigue solo
    if (this.companero) {
      this.companero.destruir();
      this.companero = null;
    }
    this.mostrarAnuncio('Tu compañero se desconectó', true);
    if (!this.heroe.vivo && !this.terminado) this.derrota();
  }

  /** ¡Ganaste el mundo! Se guarda el progreso y se abre el siguiente */
  victoria() {
    if (this.caido) return;
    for (const h of this.heroes()) {
      h.cuerpo.body.setVelocity(0, 0);
      h.invulnerableHasta = Infinity; // ya nada puede dañarlo
    }
    marcarSuperado(this.indiceMundo);

    const siguiente = this.balance.mundos[this.indiceMundo + 1];
    const mensaje = siguiente ? `Desbloqueaste: ${siguiente.nombre}` : '¡Venciste todos los mundos del prototipo!';
    const botones = [{ texto: 'Mapa', accion: () => this.irAlMapa() }];
    if (siguiente) {
      botones.unshift({ // unshift: lo agrega al PRINCIPIO de la lista
        texto: 'Siguiente', principal: true,
        accion: () => this.jugarMundo(this.indiceMundo + 1),
      });
    }
    this.chispas.explode(80, this.heroe.cuerpo.x, this.heroe.cuerpo.y);
    const titulo = `¡${this.mundo.nombre} superado!`;
    const texto = `${mensaje}\nDerrotados: ${this.derrotados}`;
    if (this.cooperativo) this.cooperativo.enviar({ t: 'fin', tipo: 'victoria', titulo, texto });
    this.pantallaFinal(titulo, texto, botones);
  }

  /** Fondo oscuro, título, texto y 1 o 2 botones (lo usan la derrota y la victoria) */
  pantallaFinal(titulo, texto, botones) {
    // Por seguridad: ningún menú de pausa encima, y esta escena funcionando
    this.scene.stop('EscenaPausa');
    if (this.scene.isPaused()) this.scene.resume();
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
    // En el PC: ENTER = primer botón (Reintentar o Siguiente)
    this.input.keyboard.once('keydown-ENTER', botones[0].accion);
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
    // En celular, la mitad de partículas (optimización): "frequency" más alta = menos seguido
    const factor = this.sys.game.device.os.desktop ? 1 : 2;
    this.climas = this.mundo.clima.map((tipo) => {
      const { textura, ...config } = climas[tipo]; // separamos la textura del resto
      config.frequency *= factor;
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

  /**
   * Texto grande en el centro que aparece y se desvanece.
   * En pareja, el anfitrión también se lo muestra al invitado (salvo "soloAqui").
   */
  mostrarAnuncio(mensaje, soloAqui = false) {
    if (this.cooperativo && !this.esInvitado && !soloAqui) this.cooperativo.enviar({ t: 'anuncio', texto: mensaje });
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
    this.add.text(20, 14, `${this.mundo.nombre.toUpperCase()} · ${this.raza.nombre.toUpperCase()}${this.cooperativo ? ' · EN PAREJA' : ''}`, { ...estilo, fontFamily: FUENTE_TITULO, color: '#c9a94a' })
      .setScrollFactor(0).setDepth(100);
    this.textoProgreso = this.add.text(20, 42, '', {
      ...estilo, fontFamily: FUENTE_TITULO, fontSize: '28px', color: '#f5c542', fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(100);
    this.textoDerrotados = this.add.text(20, 80, '', estilo).setScrollFactor(0).setDepth(100);
    this.add.text(20, this.scale.height - 36,
      'PC: WASD mover · ESPACIO atacar · K Onda · L Torbellino · H cura · P pausa', { ...estilo, fontSize: '18px', color: '#c8d3e0' })
      .setScrollFactor(0).setDepth(100);

    // FPS = cuadros por segundo. 60 es fluido; menos de 30 se siente lento.
    this.textoFps = this.add.text(this.scale.width - 110, 100, '', { ...estilo, fontSize: '16px', color: '#9fb3c8' })
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
    const jefe = this.enemigos.find((e) => e instanceof Jefe || e.esJefe); // esJefe: dibujado por el invitado
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
    this.textoJefe.setText(total === 1 || !this.salaActiva ? 'JEFE' : `JEFE ${this.salaActiva.numero} DE ${total}`);
  }
}
