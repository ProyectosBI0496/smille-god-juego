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
// Fase 1: ROLES. El rol elegido decide qué hacen los 3 botones
//          (Guerrero: Golpe/Onda/Torbellino; Asesino: Cuchilladas/Paso sombrío/Crítico).
// v0.1.2: PERSONAJE fijo (raza + CLASE + nivel + estadísticas, ver datos/Personaje.js).
//          10 clases; las nuevas usan habilidades comunes (Proyectil, Abanico, Sanar).
//          Los botones 2 y 3 se abren al subir de nivel. COFRES al terminar.
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
import { crearMonstruos, texturaMonstruo } from '../graficos/TexturasMonstruos.js';
import {
  marcarSuperado, personaje, nick, sumarMonedas, pociones, sumarPociones, sumarCoronas, darObjeto,
} from '../datos/Progreso.js';
import BarraVida from '../ui/BarraVida.js';
import { calcularHeroe, recargaPoder, rangoDe, objetoEquipo } from '../datos/Personaje.js';
import { redActual } from '../red/Red.js';
import Cooperativo from '../red/Cooperativo.js';

// Qué clase usar para cada tipo de enemigo de balance.json (por defecto, Enemigo)
const CLASES = { tirador: Tirador };

// Cada HABILIDAD que puede ir en un botón (v0.1.2; antes era una tabla por rol).
//   v0.1.4: cada poder de clase + rol (balance.json → poderes) dice qué
//   habilidad de esta tabla usa por ahora (su "accion", el molde).
//   icono:   textura del botón (graficos/Texturas.js)
//   color:   null = el color de la clase
//   recarga: función que lee la recarga en balance.json (b = balance, c = datos de la clase)
// El nombre corto (atq, onda...) también es lo que viaja por la red en pareja.
const HABILIDADES = {
  atq: { icono: 'icono-espada', color: 0xf5c542, recarga: (b) => b.ataqueBasico.recargaMs },
  onda: { icono: 'icono-onda', color: 0x4fc3f7, recarga: (b) => b.habilidad.recargaMs },
  torb: { icono: 'icono-torbellino', color: 0xab47bc, recarga: (b) => b.especial.recargaMs },
  cuch: { icono: 'icono-dagas', color: 0xef5350, recarga: (b, c) => c.cuchilladas.recargaMs },
  paso: { icono: 'icono-paso', color: 0x9575cd, recarga: (b, c) => c.pasoSombrio.recargaMs },
  crit: { icono: 'icono-critico', color: 0xff1744, recarga: (b, c) => c.critico.recargaMs },
  bola: { icono: 'icono-bola', color: null, recarga: (b) => b.magia.bola.recargaMs },
  abanico: { icono: 'icono-abanico', color: null, recarga: (b) => b.magia.abanico.recargaMs },
  sanar: { icono: 'icono-sanar', color: 0x81c784, recarga: (b) => b.magia.sanar.recargaMs },
};

/** El multiplicador de daño de un héroe: los de "a distancia" usan la magia (inteligencia) */
function multDanio(h) {
  return h.tipo === 'caster' ? h.mult.magia : h.mult.fisico; // v0.1.4: el tipo lo da el rol
}

export default class EscenaArena extends Phaser.Scene {
  constructor() {
    super('EscenaArena');
  }

  // init(): recibe los datos con los que se abrió la escena,
  // por ejemplo { mundo: 2 } desde el mapa de mundos.
  init(datos) {
    this.indiceMundo = (datos && datos.mundo) || 0;
    this.dificultad = (datos && datos.dificultad) || 1; // v0.1.4: 1 Iniciado ... 5 Divino
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
    // v0.1.4: los multiplicadores de la dificultad elegida (vida, daño, velocidad, premios)
    const dificultades = this.balance.dificultades.lista;
    this.dificultad = Phaser.Math.Clamp(this.dificultad, 1, dificultades.length);
    this.dif = dificultades[this.dificultad - 1];

    crearTexturas(this);                  // texturas comunes (solo la primera vez)
    crearTexturasMundo(this, this.mundo); // suelo, muro y adornos de ESTE mundo
    crearMonstruos(this, this.mundo);     // v0.1.7: los monstruos y el jefe propios de ESTE mundo

    // La mazmorra: salas, pasillos, muros y puertas
    this.mazmorra = new Mazmorra(this, this.mundo, this.balance.mazmorra);
    const { ancho, alto, salas } = this.mazmorra;
    this.physics.world.setBounds(0, 0, ancho, alto);
    this.crearAmbiente();
    this.cameras.main.fadeIn(400);

    // v0.1.2: MI PERSONAJE (raza + clase + estadísticas) da los números del héroe
    this.datosHeroe = calcularHeroe(this.balance, personaje());
    this.raza = this.datosHeroe.raza;
    this.rol = this.datosHeroe.clase; // "rol" = la clase (nombre heredado de la Fase 1)
    const configHeroe = this.configDeHeroe(this.datosHeroe);

    // El héroe aparece en la sala de entrada
    const entrada = salas[0];
    this.heroe = new Heroe(this, entrada.cx, entrada.cy, configHeroe);
    this.prepararHeroe(this.heroe, this.datosHeroe);
    this.physics.add.collider(this.heroe.cuerpo, this.mazmorra.muros);
    this.physics.add.collider(this.heroe.cuerpo, this.mazmorra.puertas.filter(Boolean));

    // COOPERATIVO: el héroe del otro jugador, con SU raza
    this.companero = null;
    this.cooperativo = null;
    const red = redActual();
    if (this.coop && red && red.conectado) {
      // El compañero, con SU personaje (lo mandó al conectarse: mensaje "hola")
      const datosOtro = calcularHeroe(this.balance, red.personajeCompanero);
      this.companero = new Heroe(this, entrada.cx, entrada.cy + 70, this.configDeHeroe(datosOtro));
      this.prepararHeroe(this.companero, datosOtro);
      this.companero.nombre = red.nickCompanero || 'Compañero';
      this.companero.ponerEtiqueta(this.companero.nombre);
      this.heroe.nombre = nick() || 'Tú';
      this.heroe.ponerEtiqueta(this.heroe.nombre);
      this.cooperativo = new Cooperativo(this, red);
    } else if (nick()) {
      this.heroe.nombre = nick();
      this.heroe.ponerEtiqueta(nick()); // también jugando solo
    }

    // PROYECTILES (Etapa 7): un grupo con física que RECICLA sus objetos.
    // group.get() devuelve uno apagado si hay (object pooling) o crea uno nuevo.
    this.proyectiles = this.physics.add.group({ defaultKey: 'proyectil', maxSize: 120 });
    // Corrección (sesión 14): al chocar con una REJA, Phaser entrega los objetos en
    // orden inverso (reja, proyectil). Por eso buscamos cuál de los dos es el proyectil.
    // Antes se intentaba "apagar" la reja, fallaba en cada cuadro y el juego se congelaba.
    const apagar = (a, b) => {
      const proyectil = a.disableBody ? a : b;
      proyectil.disableBody(true, true); // inactivo e invisible
    };
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
    // Teclado (PC): WASD/flechas; ESPACIO/J botón 1, K botón 2, L botón 3, H poción de vida, M poción de maná
    this.teclas = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J,K,L,H,M');
    this.joystick = new Joystick(this, this.balance.joystick);
    this.direccion = new Phaser.Math.Vector2(); // reutilizable (no crear uno por frame)

    // ---- Estado de la partida ----
    this.enemigos = [];
    this.derrotados = 0;
    this.salaActiva = null;      // la sala donde se está peleando ahora
    this.oleadasVencidas = 0;
    this.jefesVencidos = 0;
    // v0.1.4: MANÁ. Cada jugador lleva el suyo en su celular (los poderes cuestan maná).
    // "ultimoDanio" sirve para saber si lo están atacando (si no, el maná se recupera).
    this.heroe.manaMax = Math.max(1, this.datosHeroe.manaMax); // v0.1.5: maná máximo = Inteligencia
    this.heroe.mana = this.heroe.manaMax;
    this.heroe.ultimoDanio = -Infinity;
    this.barraMana = new BarraVida(this, this.heroe.radio * 2.4, color(this.balance.mana.color));
    this.magias = [];             // v0.1.2: proyectiles de los héroes
    this.cofresAbiertos = false;
    this.coronasDadas = false; // v0.1.5: las coronas se dan una sola vez por partida
    this.numerosLibres = [];     // "pool": números de daño guardados para reutilizar
    this.terminado = false;      // true al ganar el mundo
    this.caido = false;          // true al perder (hay que reiniciarlo: restart reutiliza la escena)

    this.crearBotones();
    this.crearEfectos();
    this.crearTextos();
    this.crearBotonPausa();
    this.actualizarHud();
    this.mostrarAnuncio(this.mundo.nombre, true);

    // Etapa 10: si cambia el tamaño de la pantalla, los controles se reacomodan
    this.ubicarControles();
    this.scale.on('resize', this.ubicarControles, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.ubicarControles, this));
  }

  /**
   * Pone los botones, la pausa y los textos según el tamaño ACTUAL de la pantalla
   * (con el modo EXPAND, el ancho cambia de un celular a otro).
   */
  ubicarControles() {
    const W = this.scale.baseSize.width;
    const H = this.scale.baseSize.height;
    const { radio, margen } = this.balance.botones;
    const xAtq = W - margen - radio;
    const yAtq = H - margen - radio;
    this.boton1.mover(xAtq, yAtq);
    this.boton2.mover(xAtq - 150, yAtq + 25);
    this.boton3.mover(xAtq - 35, yAtq - 150);
    // v0.1.4: la pasiva va donde estaba la cura; las pociones, a la izquierda
    for (const [boton, textos, dx, dy] of this.botonesExtra) {
      boton.mover(xAtq + dx, yAtq + dy);
      for (const [texto, tx, ty] of textos) texto.setPosition(xAtq + dx + tx, yAtq + dy + ty);
    }
    for (const [objeto, dx] of this.partesPausa) objeto.setPosition(W - 55 + dx, 55);
    this.textoFps.setPosition(W - 110, 100);
    this.textoJefe.setPosition(W / 2, 22);
    this.textoAyuda.setPosition(20, H - 36);
    this.vineta.setPosition(W / 2, H / 2).setDisplaySize(W, H);
    this.cameras.main.setSize(W, H); // la cámara también toma el tamaño nuevo
  }

  /** Config para crear un Heroe a partir de los números del personaje */
  configDeHeroe(datos) {
    return {
      ...this.balance.heroe,
      vidaMax: datos.vidaMax,
      velocidad: datos.velocidad,
      textura: datos.idRaza,
      extra: datos.raza.extra,
      aura: datos.aura, // v0.1.7: set God completo
    };
  }

  /** Le guarda al héroe lo que necesitan las habilidades: raza, clase y multiplicadores */
  prepararHeroe(h, datos) {
    h.raza = datos.raza;
    h.clase = datos.clase;
    // Las habilidades molde del Asesino (cuchilladas, paso sombrío, crítico) leen sus
    // números de h.rol. v0.1.4: el Druida y el Mago también las usan, así que se
    // toman los del Asesino como base y encima los de la clase (si tiene propios).
    h.rol = { ...this.balance.clases.asesino, ...datos.clase };
    h.tipo = datos.tipo;
    h.mult = datos.mult;
    h.reduccion = datos.reduccion;
    h.aturdir = datos.aturdir; // v0.1.5: FUERZA = probabilidad de aturdir cada 3 golpes
    h.golpes = 0;
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

  update(tiempo, delta) {
    if (this.caido) return; // pantalla de derrota

    if (this.heroe.vivo && !this.terminado) {
      this.leerMovimiento();
      this.heroe.mover(this.direccion);
      // Habilidades con teclado (JustDown = solo en el instante en que se aprieta)
      const recienApretada = Phaser.Input.Keyboard.JustDown;
      if (recienApretada(this.teclas.SPACE) || recienApretada(this.teclas.J)) this.boton1.usar();
      if (recienApretada(this.teclas.K)) this.boton2.usar();
      if (recienApretada(this.teclas.L)) this.boton3.usar();
      if (recienApretada(this.teclas.H)) this.botonVida.usar();
      if (recienApretada(this.teclas.M)) this.botonMana.usar();
    } else {
      this.direccion.set(0, 0);
      this.heroe.mover(this.direccion); // caído: quieto (se ve como fantasma)
    }
    for (const boton of [this.boton1, this.boton2, this.boton3, this.botonVida, this.botonMana]) boton.actualizar();
    this.actualizarMana(delta);

    if (this.cooperativo) this.cooperativo.actualizar();
    this.actualizarMagias(delta); // v0.1.2: proyectiles de los héroes

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
          if (distancia < enemigo.radio + h.radio && !(this.time.now < enemigo.dormidoHasta)) this.danarHeroe(enemigo.config.danioContacto, h);
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
    danio = Math.max(1, Math.round(danio * (1 - (h.reduccion || 0)))); // v0.1.2: la ARMADURA quita una parte
    if (!h.recibirDanio(danio)) return;
    h.ultimoDanio = this.time.now; // v0.1.4: mientras lo atacan, el maná no se recupera
    if (h === this.heroe) {
      this.cameras.main.shake(100, 0.006);
      this.vibrar(60);
    }
    if (h.vivo) return;
    if (this.heroes().some((otro) => otro.vivo)) {
      // En pareja: el caído queda como fantasma hasta que se vence la sala
      // Cada uno ve el mensaje desde su lado
      const paraQuienCayo = '¡Caíste! Tu compañero puede salvarte';
      const paraElOtro = `¡${h.nombre || 'Tu compañero'} cayó! Vence la sala`;
      const yo = h === this.heroe;
      this.mostrarAnuncio(yo ? paraQuienCayo : paraElOtro, true);
      if (this.cooperativo) this.cooperativo.enviar({ t: 'anuncio', texto: yo ? paraElOtro : paraQuienCayo });
    } else {
      this.derrota();
    }
  }

  /** Invitado: mi vida bajó (lo dice el anfitrión): sacudida, vibración y parpadeo */
  efectoDanioPropio() {
    this.heroe.ultimoDanio = this.time.now; // el maná deja de recuperarse un rato
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
      // v0.1.6: se entra por cualquier lado, así que se pide estar un poco ADENTRO por los 4 lados
      const d = this.balance.mazmorra.distanciaActivar;
      if (sala.estado !== 'esperando') continue;
      if (x < sala.x + d || x > sala.x + sala.ancho - d || y < sala.y + d || y > sala.y + sala.alto - d) continue;
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
      const nombres = []; // v0.1.7: qué monstruos salen, para el anuncio
      for (const [tipo, cantidad] of Object.entries(this.composicionOleada(sala.numero))) {
        for (let i = 0; i < cantidad; i++) this.crearEnemigo(this.configEnemigo(tipo, nivel), sala, CLASES[tipo]);
        if (cantidad > 0 && this.mundo.monstruos) nombres.push(this.nombreMonstruo(tipo));
      }
      this.mostrarAnuncio(`Oleada ${sala.numero} de ${this.mundo.oleadas}${nombres.length ? `\n${nombres.join(' · ')}` : ''}`);
    } else {
      const total = this.mazmorra.totalJefes;
      // v0.1.7: el anuncio dice el NOMBRE del jefe de este mundo
      const nombre = this.nombreMonstruo('jefe');
      this.mostrarAnuncio(total === 1 ? `¡${nombre}!` : `¡${nombre} (${sala.numero} de ${total})!`);
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
      // En pareja hay más enemigos (balance.json → cooperativo)
      // v0.1.5: más dificultad = más enemigos (balance.json → dificultades → cantidad)
      const extra = (this.cooperativo ? this.balance.cooperativo.multCantidad : 1) * (this.dif.cantidad || 1);
      resultado[tipo] = Math.round((min + (max - min) * avance) * extra);
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
    const dif = this.dif; // v0.1.4: la dificultad elegida (Iniciado, Veterano...)
    const fuerza = this.mundo.fuerza;
    const f = this.factorVelocidad();
    const fd = this.factorDanio();
    return {
      ...base, // "..." copia todos los datos del tipo; luego cambiamos algunos
      vidaMax: Math.round(base.vidaMax * fuerza * dif.vida * (1 + nivel * d.vidaPorSala) * (this.cooperativo ? this.balance.cooperativo.multVida : 1)),
      velocidad: Math.round(base.velocidad * f * (1 + nivel * d.velocidadPorSala)),
      danioContacto: Math.round(base.danioContacto * fd * (1 + nivel * d.danioPorSala)),
      // el tirador también dispara más fuerte
      disparo: base.disparo ? this.disparoLento(base.disparo, fd, f) : undefined,
      color: this.mundo.colores[tipo],
      colorProyectil: color(this.mundo.colores[tipo]),
      ...this.dibujoMonstruo(tipo), // v0.1.7: el dibujo propio de este mundo
    };
  }

  /**
   * v0.1.7: cada mundo tiene sus propios monstruos (balance.json → mundos → monstruos).
   * Devuelve la textura que le toca al tipo ("m-bosque-rapido"). Todas se dibujan
   * para un radio de 24 (el jefe, de 50). Si el mundo no tiene, queda el dibujo común.
   */
  dibujoMonstruo(tipo) {
    if (!this.mundo.monstruos || !this.mundo.monstruos[tipo]) return {};
    return { textura: texturaMonstruo(this.mundo.id, tipo), radioTextura: tipo === 'jefe' ? 50 : 24 };
  }

  /** v0.1.7: el nombre del monstruo de este mundo ("Treant ancestral"); si no tiene, el genérico */
  nombreMonstruo(tipo) {
    const m = this.mundo.monstruos && this.mundo.monstruos[tipo];
    return m ? m.nombre : (tipo === 'jefe' ? 'El jefe' : tipo);
  }

  /**
   * v0.1.5: VELOCIDAD de los enemigos. Cada mundo dice a qué velocidad va el enemigo
   * NORMAL en cada dificultad (balance.json → mundos → velocidadEnemigos, ej. 40, 50, 60...).
   * Este factor = esa velocidad / la del normal (150): todos los demás enemigos, el jefe,
   * su embestida y los disparos se multiplican por él (así mantienen su proporción).
   */
  factorVelocidad() {
    const tabla = this.mundo.velocidadEnemigos;
    if (!tabla) return 1;
    return tabla[this.dificultad - 1] / this.balance.tiposEnemigo.normal.velocidad;
  }

  /**
   * v0.1.6: DAÑO de los enemigos. Cada mundo dice cuánto pega el enemigo NORMAL en cada
   * dificultad (Excel Mundos_Moustruos → balance.json → mundos → danioEnemigos, ej. 15, 30, 45...).
   * Igual que la velocidad: factor = ese daño / el del normal (10); los demás tipos y los
   * disparos se multiplican por él. Si el mundo no tiene tabla, se usa el de la dificultad.
   */
  factorDanio() {
    const tabla = this.mundo.danioEnemigos;
    if (!tabla) return this.dif.danio;
    return tabla[this.dificultad - 1] / this.balance.tiposEnemigo.normal.danioContacto;
  }

  /** Un disparo más lento que dura más tiempo (así llega igual de lejos) */
  disparoLento(disparo, multDanio, f) {
    return {
      ...disparo,
      danio: Math.round(disparo.danio * multDanio),
      velocidad: Math.round(disparo.velocidad * f),
      duracionMs: Math.round(disparo.duracionMs / f),
    };
  }

  /** El jefe número "n" del mundo: cada uno tiene un poco más de vida que el anterior */
  configJefe(n) {
    const comun = this.balance.jefe;
    const propio = this.mundo.jefe;
    const f = this.factorVelocidad();
    return {
      ...comun,  // comportamiento común (embestida, aviso...)
      ...propio, // tamaño, vida y velocidad de los jefes de ESTE mundo
      vidaMax: Math.round(propio.vidaMax * this.dif.vida * (1 + (n - 1) * comun.aumentoVidaPorJefe) * (this.cooperativo ? this.balance.cooperativo.multVidaJefe : 1)),
      // v0.1.4: con más dificultad, el jefe pega más fuerte; v0.1.5: su velocidad sigue la del mundo
      velocidad: Math.round(propio.velocidad * f),
      velocidadEmbestida: Math.round(comun.velocidadEmbestida * f),
      duracionEmbestidaMs: Math.round(comun.duracionEmbestidaMs / f), // recorre la misma distancia
      // v0.1.6: el golpe del jefe sale del Excel (danioJefes); su ráfaga sigue el daño del mundo
      danioContacto: this.mundo.danioJefes ? this.mundo.danioJefes[this.dificultad - 1] : Math.round(propio.danioContacto * this.dif.danio),
      rafaga: this.disparoLento(comun.rafaga, this.factorDanio(), f),
      radioTextura: 50,
      color: this.mundo.colores.jefe,
      ...this.dibujoMonstruo('jefe'), // v0.1.7: el jefe propio de este mundo
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

    // v0.1.6: la mazmorra abre las puertas que tocan (en la cruz, la del centro pide 2 jefes)
    const abiertas = this.mazmorra.vencerSala(sala.indice);
    if (this.cooperativo) this.cooperativo.enviar({ t: 'puerta', i: sala.indice });
    if (this.mazmorra.terminada) {
      this.terminado = true;
      this.time.delayedCall(900, () => this.victoria());
      return;
    }
    for (const h of this.heroes()) {
      if (!h.vivo) h.vida = Math.round(h.config.vidaMax / 2); // en pareja: el caído se levanta
      else h.vida = Math.min(h.vida + this.balance.oleadas.curacionPorSala, h.config.vidaMax);
    }
    // ¿Se abrió una puerta que pedía varias salas? (la del centro de la cruz)
    const grande = abiertas.some((i) => this.mazmorra.salas[i].requiere.length > 1);
    if (grande) this.mostrarAnuncio('¡Se abrió la puerta del centro!');
    else if (sala.tipo === 'jefe' && !abiertas.length) this.mostrarAnuncio('¡Jefe vencido! Busca el otro camino');
    else this.mostrarAnuncio(sala.tipo === 'jefe' ? '¡Jefe vencido!' : '¡Sigue adelante!');
  }

  // =============================================================
  // v0.1.4: MANÁ y POCIONES (reemplazan a la cura)
  // =============================================================

  /**
   * El maná se recupera solo (2% del máximo por segundo) si nadie me golpeó
   * en los últimos "sinDanioMs". También dibuja la barra azul sobre mi héroe.
   */
  actualizarMana(delta) {
    const h = this.heroe;
    const m = this.balance.mana;
    const tranquilo = this.time.now - h.ultimoDanio >= m.sinDanioMs;
    if (h.vivo && tranquilo && h.mana < h.manaMax) {
      h.mana = Math.min(h.manaMax, h.mana + h.manaMax * m.regenPorSegundo * (delta / 1000));
    }
    this.barraMana.dibujar(h.cuerpo.x, h.cuerpo.y - h.radio - 13, h.mana / h.manaMax);
    // Barra grande arriba a la izquierda, con el número
    const ancho = 240;
    this.barraManaHud.clear()
      .fillStyle(0x000000, 0.6).fillRect(18, 112, ancho + 4, 18)
      .fillStyle(color(m.color)).fillRect(20, 114, ancho * (h.mana / h.manaMax), 14);
    this.textoMana.setText(`Maná ${Math.floor(h.mana)}/${h.manaMax}`);
    // Los botones sin maná suficiente se ven apagados
    this.datosHeroe.poderes.botones.forEach((poder, i) => {
      const boton = [this.boton1, this.boton2, this.boton3][i];
      if (i < this.datosHeroe.botones) boton.circulo.setAlpha(h.mana >= poder.costo ? 1 : 0.4);
    });
  }

  /**
   * Usa el poder del botón i (0, 1, 2) si alcanza el maná.
   * Devuelve false si no alcanza: así el botón NO entra en recarga.
   */
  usarPoder(i) {
    const h = this.heroe;
    const poder = this.datosHeroe.poderes.botones[i];
    if (!h.vivo || this.caido || this.terminado) return false;
    if (h.mana < poder.costo) {
      this.mostrarNumero(h.cuerpo.x, h.cuerpo.y - 60, 'Sin maná', '#90caf9');
      return false;
    }
    h.mana -= poder.costo;
    this.accion(poder.accion);
    return true;
  }

  /**
   * Toma una poción ("vida" o "mana"). Las pociones son MÍAS (de mi cuenta):
   * aquí se resta una. En pareja, la vida la decide el anfitrión: el invitado
   * le pide que lo cure (como antes con la cura).
   */
  tomarPocion(tipo) {
    const h = this.heroe;
    if (!h.vivo || this.caido || this.terminado) return false;
    if (pociones()[tipo] <= 0) {
      this.mostrarNumero(h.cuerpo.x, h.cuerpo.y - 60, 'No tienes pociones', '#ef9a9a');
      return false;
    }
    if (tipo === 'vida') {
      if (h.vida >= h.config.vidaMax) return false; // con la vida llena no se gasta
      if (this.esInvitado) {
        this.cooperativo.enviar({ t: 'hab', h: 'pocionVida' });
        this.efectoCura(h, 0x66bb6a, null);
      } else {
        this.curarConPocion(h);
      }
    } else {
      if (h.mana >= h.manaMax) return false;
      const cantidad = Math.round(h.manaMax * this.balance.pociones.tipos.mana.mana);
      h.mana = Math.min(h.manaMax, h.mana + cantidad);
      this.efectoCura(h, color(this.balance.mana.color), `+${cantidad}`, '#90caf9');
    }
    sumarPociones({ [tipo]: -1 });
    this.actualizarHud();
    return true;
  }

  /** La poción de vida devuelve una parte de la vida máxima (la Inteligencia y el Derial curan más) */
  curarConPocion(h) {
    const max = h.config.vidaMax;
    if (!h.vivo || h.vida >= max) return;
    const cantidad = Math.round(max * this.balance.pociones.tipos.vida.vida * h.mult.cura);
    h.vida = Math.min(h.vida + cantidad, max);
    this.efectoCura(h, 0x66bb6a, `+${cantidad}`);
  }

  /** Destello de color y número sobre el héroe */
  efectoCura(h, tinte, texto, colorTexto = '#a5d6a7') {
    const { x, y } = h.cuerpo;
    const luz = this.add.image(x, y, 'brillo').setTint(tinte).setBlendMode(Phaser.BlendModes.ADD).setDepth(44);
    this.tweens.add({ targets: luz, scale: 2.5, alpha: 0, duration: 500, onComplete: () => luz.destroy() });
    if (texto) this.mostrarNumero(x, y - 40, texto, colorTexto);
  }

  /** Muestra la pasiva (siempre activa) con su descripción */
  mostrarPasiva() {
    const p = this.datosHeroe.poderes.pasiva;
    this.mostrarAnuncio(`✦ ${p.nombre}`, true);
    if (this.textoPasivaLarga) this.textoPasivaLarga.destroy();
    const W = this.scale.baseSize.width;
    this.textoPasivaLarga = this.add.text(W / 2, 150, p.texto, {
      fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#e1bee7', align: 'center',
      stroke: '#05070d', strokeThickness: 5, wordWrap: { width: Math.min(760, W - 80) },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(150);
    this.tweens.add({ targets: this.textoPasivaLarga, alpha: 0, delay: 3500, duration: 600 });
  }

  // =============================================================
  // Combate (igual que en etapas anteriores)
  // =============================================================

  /** Crea los 3 botones del ROL y el de cura */
  crearBotones() {
    const { radio, radioPequeno, margen } = this.balance.botones;
    const xAtq = this.scale.baseSize.width - margen - radio;
    const yAtq = this.scale.baseSize.height - margen - radio;
    const recarga = this.datosHeroe.mult.recarga; // < 1 = recarga más rápido (Humano, Velocidad)
    const colorClase = color(this.rol.color);
    const niveles = this.balance.progreso.nivelBotones;

    // Botón 1 (el más grande, bajo el pulgar), botón 2 a su izquierda, botón 3 encima
    const posiciones = [[xAtq, yAtq, radio], [xAtq - 150, yAtq + 25, radioPequeno], [xAtq - 35, yAtq - 150, radioPequeno]];
    // v0.1.4: los 3 poderes salen del set de CLASE + ROL; cada uno usa una habilidad "molde"
    const botones = this.datosHeroe.poderes.botones.map((poder, i) => {
      const tipo = poder.accion;
      const hab = HABILIDADES[tipo];
      const abierto = i < this.datosHeroe.botones; // v0.1.2: se abren al subir de nivel
      const recargaMs = recargaPoder(this.balance, poder, i, hab.recarga(this.balance, this.heroe.rol));
      const boton = new BotonHabilidad(this, {
        x: posiciones[i][0], y: posiciones[i][1], radio: posiciones[i][2], etiqueta: String(i + 1), icono: hab.icono,
        recargaMs: recargaMs * recarga, color: abierto ? (hab.color ?? colorClase) : 0x555555,
        alPulsar: () => (abierto ? this.usarPoder(i) : false), // v0.1.4: gasta maná
      });
      // v0.1.4: el costo de maná, en azul, abajo del botón
      if (abierto && poder.costo > 0) {
        const r = posiciones[i][2];
        const costo = this.add.text(posiciones[i][0], posiciones[i][1] + r - 4, `${poder.costo}`, {
          fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#90caf9', fontStyle: 'bold', stroke: '#05070d', strokeThickness: 4,
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(103);
        const moverOriginal = boton.mover.bind(boton);
        boton.mover = (x, y) => { moverOriginal(x, y); costo.setPosition(x, y + r - 4); };
      }
      if (!abierto) {
        // Bloqueado: gris y con el nivel que hace falta encima
        boton.circulo.setAlpha(0.4);
        boton.texto.setAlpha(0.3);
        const candado = this.add.text(posiciones[i][0], posiciones[i][1], 'Nv ' + niveles[i], {
          fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#ffffff', fontStyle: 'bold', stroke: '#05070d', strokeThickness: 4,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(103);
        const moverOriginal = boton.mover.bind(boton);
        boton.mover = (x, y) => { moverOriginal(x, y); candado.setPosition(x, y); };
      }
      return boton;
    });
    [this.boton1, this.boton2, this.boton3] = botones; // "desestructurar": reparte la lista en 3 variables
    // v0.1.4: la PASIVA va donde estaba la cura. Siempre está activa: tocarla
    // solo muestra qué hace. Debajo lleva su nombre.
    const estiloChico = {
      fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#e1bee7', fontStyle: 'bold', stroke: '#05070d', strokeThickness: 4,
    };
    const pasiva = this.datosHeroe.poderes.pasiva;
    this.botonPasiva = new BotonHabilidad(this, {
      x: 0, y: 0, radio: 42, etiqueta: '✦', icono: 'icono-pasiva', recargaMs: 0, color: 0xce93d8,
      alPulsar: () => this.mostrarPasiva(),
    });
    const nombrePasiva = this.add.text(0, 0, pasiva.nombre, { ...estiloChico, align: 'center', wordWrap: { width: 130 } })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(103);

    // v0.1.4: POCIONES de vida y de maná, con cuántas me quedan
    const crearPocion = (tipo) => {
      const datos = this.balance.pociones.tipos[tipo];
      const boton = new BotonHabilidad(this, {
        x: 0, y: 0, radio: 38, etiqueta: '', icono: 'icono-pocion', recargaMs: this.balance.pociones.recargaMs,
        color: color(datos.color), alPulsar: () => this.tomarPocion(tipo),
      });
      const cantidad = this.add.text(0, 0, '', { ...estiloChico, fontSize: '22px', color: '#ffffff' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(103);
      return [boton, cantidad];
    };
    const [botonVida, cantidadVida] = crearPocion('vida');
    const [botonMana, cantidadMana] = crearPocion('mana');
    this.botonVida = botonVida;
    this.botonMana = botonMana;
    this.textosPociones = { vida: cantidadVida, mana: cantidadMana };

    // [botón, [textos con su desplazamiento], dx, dy desde el botón 1] (lo usa ubicarControles)
    this.botonesExtra = [
      [this.botonPasiva, [[nombrePasiva, 0, 44]], -175, -120],
      [botonVida, [[cantidadVida, 28, 24]], -275, 45],
      [botonMana, [[cantidadMana, 28, 24]], -280, -60],
    ];
  }

  /**
   * Daña a todos los enemigos dentro de un círculo.
   * El empuje los aleja del punto (origenX, origenY).
   * Lo usan las tres habilidades: así la lógica de daño vive en un solo lugar.
   */
  golpearArea(x, y, radio, danioBase, empujeBase, origenX, origenY, h = this.heroe) {
    if (this.esInvitado) return; // el invitado solo dibuja: el daño lo calcula el anfitrión
    // La raza de quien golpea multiplica el daño (Orco, Goruk...) y el empuje (Toro)
    const danio = Math.round(danioBase * multDanio(h)); // raza + estadísticas
    const empuje = empujeBase * (h.raza.empuje || 1);
    const direccion = new Phaser.Math.Vector2();
    for (const enemigo of [...this.enemigos]) {
      const distancia = Phaser.Math.Distance.Between(x, y, enemigo.cuerpo.x, enemigo.cuerpo.y);
      if (distancia > radio + enemigo.radio) continue;

      direccion.set(enemigo.cuerpo.x - origenX, enemigo.cuerpo.y - origenY);
      if (direccion.lengthSq() === 0) direccion.set(1, 0); // por si están en el mismo punto
      direccion.normalize();

      this.danarEnemigo(enemigo, danio, direccion, empuje, undefined, h);
    }
  }

  /** Daña a UN enemigo, muestra el número y lo elimina si se queda sin vida */
  danarEnemigo(enemigo, danio, direccion, empuje, colorNumero = '#ffeb3b', h = this.heroe) {
    enemigo.recibirDanio(danio, direccion, empuje);
    this.mostrarNumero(enemigo.cuerpo.x, enemigo.cuerpo.y - enemigo.radio, `-${danio}`, colorNumero);
    // v0.1.5: FUERZA. Cada 3 golpes del héroe, una probabilidad (su % de Fuerza)
    // de dejar al enemigo aturdido 1 segundo (no se mueve ni ataca).
    const cv = this.balance.estadisticas.conversion;
    h.golpes = (h.golpes || 0) + 1;
    if (enemigo.vida > 0 && h.golpes % cv.aturdirCada === 0 && Math.random() < (h.aturdir || 0)) {
      enemigo.aturdidoHasta = this.time.now + cv.aturdirMs;
      enemigo.dormidoHasta = enemigo.aturdidoHasta; // dormido: tampoco hace daño al tocar
      this.mostrarNumero(enemigo.cuerpo.x, enemigo.cuerpo.y - enemigo.radio - 26, 'Aturdido', '#ffd54f');
    }
    if (enemigo.vida <= 0) this.eliminarEnemigo(enemigo);
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
    this.ejecutarHabilidad(tipo, h);
    if (!this.cooperativo) return;
    const ang = +Math.atan2(h.mirando.y, h.mirando.x).toFixed(3);
    this.cooperativo.enviar(this.esInvitado ? { t: 'hab', h: tipo } : { t: 'efecto', h: tipo, ang });
  }

  ejecutarHabilidad(tipo, h) {
    if (tipo === 'atq') this.atacar(h);
    else if (tipo === 'onda') this.usarOnda(h);
    else if (tipo === 'torb') this.usarTorbellino(h);
    else if (tipo === 'cuch') this.usarCuchilladas(h);
    else if (tipo === 'paso') this.usarPasoSombrio(h);
    else if (tipo === 'crit') this.usarCritico(h);
    else if (tipo === 'bola') this.usarBola(h);
    else if (tipo === 'abanico') this.usarAbanico(h);
    else if (tipo === 'sanar') this.usarSanar(h);
  }

  /** Anfitrión: el invitado usó una habilidad; se hace con SU héroe (aquí sí hace daño) */
  ejecutarRemota(tipo) {
    const h = this.companero;
    if (!h || !h.vivo || this.caido || this.terminado) return;
    // v0.1.4: el invitado tomó una poción de vida (la poción ya la restó él en su celular)
    if (tipo === 'pocionVida') this.curarConPocion(h);
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

  // =============================================================
  // ASESINO (Fase 1): rápido y letal, con poca vida
  // =============================================================

  /** Botón 1 — dos cuchilladas rápidas seguidas, con auto-apuntado */
  usarCuchilladas(h = this.heroe) {
    if (!h.vivo) return;
    const c = h.rol.cuchilladas;
    for (let i = 0; i < c.golpes; i++) {
      // delayedCall: ejecuta la función después de unos milisegundos (0 = ya)
      this.time.delayedCall(i * c.intervaloMs, () => {
        if (!h.vivo || !h.cuerpo.active) return;
        const objetivo = this.enemigoMasCercano(c.rangoAutoApuntado * (h.raza.autoApuntado || 1), h);
        if (objetivo) h.apuntarA(objetivo.cuerpo.x, objetivo.cuerpo.y);
        const zona = h.atacar(c, i % 2 === 0 ? 0xef9a9a : 0xffcdd2, i % 2 === 1); // la 2.ª va al revés
        if (objetivo && Phaser.Math.Distance.Between(h.cuerpo.x, h.cuerpo.y, objetivo.cuerpo.x, objetivo.cuerpo.y) < h.radio + c.alcance) {
          zona.x = objetivo.cuerpo.x; // muy pegado: el golpe se centra en él
          zona.y = objetivo.cuerpo.y;
        }
        this.golpearArea(zona.x, zona.y, zona.radio, c.danio, c.empuje, h.cuerpo.x, h.cuerpo.y, h);
      });
    }
  }

  /**
   * Botón 2 — "Paso sombrío": desaparece y aparece DETRÁS del enemigo más cercano,
   * dañando un poco a su alrededor. Sin enemigos cerca, da un salto hacia adelante.
   * Durante un instante es invulnerable (sirve también para escapar).
   */
  usarPasoSombrio(h = this.heroe) {
    if (!h.vivo) return;
    const p = h.rol.pasoSombrio;
    const desde = { x: h.cuerpo.x, y: h.cuerpo.y };
    const objetivo = this.enemigoMasCercano(p.rango, h);

    // Puntos a probar, en orden de preferencia: detrás del enemigo, a sus lados
    // y delante de él. Nos quedamos con el primero que no esté dentro de un muro.
    let candidatos;
    if (objetivo) {
      const ex = objetivo.cuerpo.x;
      const ey = objetivo.cuerpo.y;
      const angulo = Math.atan2(ey - desde.y, ex - desde.x); // de mí hacia el enemigo
      const d = objetivo.radio + p.distanciaDetras;
      candidatos = [0, 0.8, -0.8, 1.6, -1.6, Math.PI].map((giro) => ({
        x: ex + Math.cos(angulo + giro) * d,
        y: ey + Math.sin(angulo + giro) * d,
      }));
    } else {
      candidatos = [1, 0.6, 0.3].map((f) => ({
        x: desde.x + h.mirando.x * p.saltoSinEnemigo * f,
        y: desde.y + h.mirando.y * p.saltoSinEnemigo * f,
      }));
    }
    const destino = candidatos.find((punto) => this.puntoLibre(punto.x, punto.y, h.radio));
    if (!destino) return; // todo bloqueado: no se mueve

    // Humo violeta donde estaba y donde aparece
    for (const punto of [desde, destino]) {
      const humo = this.add.image(punto.x, punto.y, 'brillo').setTint(0x7e57c2)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(44).setScale(0.6);
      this.tweens.add({ targets: humo, scale: 1.8, alpha: 0, duration: 380, onComplete: () => humo.destroy() });
    }
    h.cuerpo.body.reset(destino.x, destino.y); // "teletransporta" el cuerpo físico
    h.invulnerableHasta = this.time.now + p.invulnerableMs;
    if (objetivo) h.apuntarA(objetivo.cuerpo.x, objetivo.cuerpo.y); // queda mirando su espalda
    h.actualizarDibujo(false);
    if (h === this.heroe) this.cameras.main.shake(90, 0.003);

    this.golpearArea(destino.x, destino.y, p.radio, p.danio, p.empuje, destino.x, destino.y, h);
  }

  // =============================================================
  // HABILIDADES COMUNES de las clases nuevas (v0.1.2)
  // Proyectil y Abanico (a distancia) y Sanar (cura al grupo).
  // Más adelante, cada clase tendrá sus propias habilidades.
  // =============================================================

  /** Botón 1 de los "a distancia": un proyectil mágico con auto-apuntado */
  usarBola(h = this.heroe) {
    if (!h.vivo) return;
    const cfg = this.balance.magia.bola;
    const objetivo = this.enemigoMasCercano(cfg.rangoAutoApuntado * (h.raza.autoApuntado || 1), h);
    if (objetivo) h.apuntarA(objetivo.cuerpo.x, objetivo.cuerpo.y);
    this.dispararMagia(h, Math.atan2(h.mirando.y, h.mirando.x), cfg);
  }

  /** Botón 3 de los "a distancia" DPS: varios proyectiles en abanico */
  usarAbanico(h = this.heroe) {
    if (!h.vivo) return;
    const cfg = this.balance.magia.abanico;
    const objetivo = this.enemigoMasCercano(this.balance.magia.bola.rangoAutoApuntado, h);
    if (objetivo) h.apuntarA(objetivo.cuerpo.x, objetivo.cuerpo.y);
    const centro = Math.atan2(h.mirando.y, h.mirando.x);
    for (let i = 0; i < cfg.cantidad; i++) {
      // reparte los proyectiles entre -apertura/2 y +apertura/2 alrededor del centro
      const desvio = cfg.cantidad === 1 ? 0 : (i / (cfg.cantidad - 1) - 0.5) * cfg.apertura;
      this.dispararMagia(h, centro + desvio, cfg);
    }
    if (h === this.heroe) this.cameras.main.shake(80, 0.003);
  }

  /** Sanar: cura a los héroes vivos que estén cerca (también al compañero) */
  usarSanar(h = this.heroe) {
    if (!h.vivo) return;
    const cfg = this.balance.magia.sanar;
    const { x, y } = h.cuerpo;
    const anillo = this.add.circle(x, y, 20).setStrokeStyle(6, 0x81c784).setDepth(40);
    this.tweens.add({ targets: anillo, radius: cfg.radio, alpha: 0, duration: 450, onComplete: () => anillo.destroy() });
    if (this.esInvitado) return; // la vida la decide el anfitrión
    const cantidad = Math.round(cfg.cura * h.mult.cura);
    for (const otro of this.heroes()) {
      if (!otro.vivo) continue;
      if (Phaser.Math.Distance.Between(x, y, otro.cuerpo.x, otro.cuerpo.y) > cfg.radio) continue;
      otro.vida = Math.min(otro.vida + cantidad, otro.config.vidaMax);
      const luz = this.add.image(otro.cuerpo.x, otro.cuerpo.y, 'brillo').setTint(0x81c784)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(44);
      this.tweens.add({ targets: luz, scale: 2, alpha: 0, duration: 450, onComplete: () => luz.destroy() });
      this.mostrarNumero(otro.cuerpo.x, otro.cuerpo.y - 40, `+${cantidad}`, '#a5d6a7');
    }
  }

  /**
   * Crea un proyectil del héroe. No usa el grupo de proyectiles de los enemigos:
   * lo movemos a mano en actualizarMagias() (cada frame) y revisamos si toca a alguien.
   */
  dispararMagia(h, angulo, cfg) {
    const bola = this.add.image(h.cuerpo.x, h.cuerpo.y, 'brillo').setTint(color(h.clase.color))
      .setBlendMode(Phaser.BlendModes.ADD).setScale((cfg.radio * 2.6) / 128).setDepth(45);
    bola.vx = Math.cos(angulo) * cfg.velocidad;
    bola.vy = Math.sin(angulo) * cfg.velocidad;
    bola.muereEn = this.time.now + cfg.duracionMs;
    bola.cfg = cfg;
    bola.duenio = h;
    this.magias.push(bola);
  }

  /** Cada frame: mueve los proyectiles de los héroes y revisa choques */
  actualizarMagias(delta) {
    const dt = delta / 1000; // milisegundos → segundos
    this.magias = this.magias.filter((bola) => {
      bola.x += bola.vx * dt;
      bola.y += bola.vy * dt;
      let muere = this.time.now >= bola.muereEn || !this.puntoLibre(bola.x, bola.y, 4); // tiempo o muro
      if (!muere) {
        for (const enemigo of this.enemigos) {
          if (Phaser.Math.Distance.Between(bola.x, bola.y, enemigo.cuerpo.x, enemigo.cuerpo.y) > enemigo.radio + bola.cfg.radio) continue;
          muere = true;
          if (!this.esInvitado) { // el daño lo calcula quien juega solo o el anfitrión
            const h = bola.duenio;
            const direccion = new Phaser.Math.Vector2(bola.vx, bola.vy).normalize();
            this.danarEnemigo(enemigo, Math.round(bola.cfg.danio * multDanio(h)), direccion, bola.cfg.empuje * (h.raza.empuje || 1), '#e1bee7', h);
          }
          break;
        }
      }
      if (!muere) return true; // sigue volando
      const chispa = this.add.image(bola.x, bola.y, 'brillo').setTint(bola.tintTopLeft)
        .setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setDepth(45);
      this.tweens.add({ targets: chispa, scale: 0.8, alpha: 0, duration: 200, onComplete: () => chispa.destroy() });
      bola.destroy();
      return false; // filter: lo saca de la lista
    });
  }

  // =============================================================
  // COFRES (v0.1.2; v0.1.7: Excel Cofres_Contenido y Probabilidades)
  //   - un cofre por cada jefe vencido;
  //   - al superar el mundo, uno más.
  // El TIPO de cada cofre (Pequeño ... Caja Smille) sale al azar con la tabla
  // del mundo y la dificultad (balance.json → cofres → porMundo).
  // Cada cofre da intys, fichas y fichas de facción; a veces rubís y a veces
  // una pieza de EQUIPO del nivel del héroe (de un set al azar: Básico, Moderno o God).
  // Cada jugador abre SUS cofres en su celular.
  // =============================================================
  abrirCofres(victoria) {
    if (this.cofresAbiertos) return '';
    this.cofresAbiertos = true;
    const cantidad = this.jefesVencidos + (victoria ? 1 : 0);
    if (!cantidad) return 'Sin cofres: vence a un jefe para ganar uno';
    const entre = ([min, max]) => Phaser.Math.Between(min, max);
    const total = { intys: 0, fichas: 0, rubis: 0, fichasFaccion: 0 };
    const lineas = [];
    for (let i = 0; i < cantidad; i++) {
      const cofre = this.balance.cofres.tipos[this.sortearCofre()];
      const premio = {
        intys: entre(cofre.intys),
        fichas: entre(cofre.fichas),
        fichasFaccion: entre(cofre.fichasFaccion),
        rubis: Math.random() < cofre.probRubi ? entre(cofre.rubis) : 0,
      };
      let texto = `${cofre.nombre}: +${premio.intys} ☀️  +${premio.fichas} 🎟️  +${premio.fichasFaccion} 🔰${premio.rubis ? `  +${premio.rubis} 💎` : ''}`;
      // ¿Trae equipo?
      if (Math.random() < cofre.probEquipo) {
        const pieza = this.sortearPieza(cofre);
        if (pieza && darObjeto(pieza.id)) texto += `  🎁 ${pieza.nombre} (${pieza.setNombre})`;
        else if (pieza) { // ya la tenía: se cambia por la mitad de su precio en intys
          const cambio = Math.round(pieza.precios[0].intys / 2);
          premio.intys += cambio;
          texto += `  🎁 repetido → +${cambio} ☀️`;
        }
      }
      for (const moneda of Object.keys(total)) total[moneda] += premio[moneda];
      lineas.push(texto);
    }
    sumarMonedas(total); // se guarda en el navegador
    return lineas.join('\n');
  }

  /** v0.1.7: elige el tipo de cofre con las probabilidades del mundo y la dificultad */
  sortearCofre() {
    const c = this.balance.cofres;
    const tabla = c.porMundo[this.mundo.id];
    const probs = tabla ? tabla[this.dificultad - 1] : [1];
    let azar = Math.random();
    for (let i = 0; i < probs.length; i++) {
      azar -= probs[i];
      if (azar < 0) return c.orden[i];
    }
    return c.orden[probs.findLastIndex((p) => p > 0)]; // por si las probabilidades no suman justo 1
  }

  /**
   * v0.1.7: una pieza de equipo "acorde al nivel del héroe": un espacio al azar
   * (de los que usa), el tier más alto que puede llevar y el set según el cofre.
   */
  sortearPieza(cofre) {
    const b = this.balance;
    const p = this.datosHeroe.personaje;
    const ranuras = Object.keys(b.equipo.ranuras).filter((r) => objetoEquipo(b, p, r, 0));
    const ranura = Phaser.Utils.Array.GetRandom(ranuras);
    let tier = 0;
    b.equipo.tiers.forEach((t, i) => { if (p.nivel >= t.nivel) tier = i; });
    let azar = Math.random();
    let set = 'basico';
    for (const [id, prob] of Object.entries(cofre.sets || { basico: 1 })) {
      azar -= prob;
      if (azar < 0) { set = id; break; }
    }
    return objetoEquipo(b, p, ranura, tier, set);
  }

  // =============================================================
  // CORONAS (v0.1.5): cada héroe gana coronas al superar una mazmorra y
  // pierde el 80% (sin decimales) de ese número al caer. Más dificultad,
  // más coronas (balance.json → dificultades). Cada jugador suma las suyas.
  // Devuelve el texto para la pantalla final.
  // =============================================================
  darCoronas(victoria) {
    if (this.coronasDadas) return '';
    this.coronasDadas = true;
    const ganar = this.dif.coronas || 0;
    const cambio = victoria ? ganar : -Math.floor(ganar * this.balance.dificultades.coronasPerder);
    const { antes, despues } = sumarCoronas(cambio);
    const rangoAntes = rangoDe(this.balance, antes).rango;
    const rango = rangoDe(this.balance, despues).rango;
    const real = despues - antes; // con 0 coronas no se puede perder más
    let texto = `👑 ${real >= 0 ? '+' : ''}${real} coronas (${despues} · Rango ${rango})`;
    if (rango > rangoAntes) texto += `  ¡Subiste a Rango ${rango}!`;
    if (rango < rangoAntes) texto += '  Bajaste de rango';
    return texto;
  }

  /** Coronas y cofres juntos, para la pantalla final */
  premiosFinales(victoria) {
    return [this.darCoronas(victoria), this.abrirCofres(victoria)].filter(Boolean).join('\n');
  }

  /** true si un círculo en (x, y) no toca muros ni rejas (para no aparecer dentro de una pared) */
  puntoLibre(x, y, radio) {
    const { ancho, alto } = this.mazmorra;
    if (x < radio || y < radio || x > ancho - radio || y > alto - radio) return false;
    // overlapCirc busca cuerpos físicos dentro del círculo; (false, true) = solo los fijos (muros, rejas)
    return this.physics.overlapCirc(x, y, radio, false, true).length === 0;
  }

  /** Botón 3 — "Golpe crítico": muchísimo daño a UN solo enemigo (el más cercano) */
  usarCritico(h = this.heroe) {
    if (!h.vivo) return;
    const c = h.rol.critico;
    const objetivo = this.enemigoMasCercano(c.rango, h);
    if (objetivo) h.apuntarA(objetivo.cuerpo.x, objetivo.cuerpo.y);

    // Dibujo: un tajo rojo grande y una cruz brillante sobre el objetivo
    h.atacar({ alcance: 90 }, 0xff1744);
    if (!objetivo) return; // sin nadie cerca, el golpe se pierde
    const { x, y } = objetivo.cuerpo;
    for (const angulo of [45, -45]) {
      const corte = this.add.rectangle(x, y, 10, objetivo.radio * 3.2, 0xffffff).setAngle(angulo)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(46);
      this.tweens.add({ targets: corte, scaleX: 0.2, alpha: 0, duration: 350, onComplete: () => corte.destroy() });
    }
    if (h === this.heroe) {
      this.cameras.main.shake(160, 0.008);
      this.vibrar(40);
    }
    if (this.esInvitado) return; // el daño lo calcula el anfitrión
    const direccion = new Phaser.Math.Vector2(x - h.cuerpo.x, y - h.cuerpo.y);
    if (direccion.lengthSq() === 0) direccion.set(1, 0);
    direccion.normalize();
    const danio = Math.round(c.danio * multDanio(h));
    this.danarEnemigo(objetivo, danio, direccion, c.empuje * (h.raza.empuje || 1), '#ff5252', h);
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
    const x = this.scale.baseSize.width - 55;
    const y = 55;
    const boton = this.add.circle(x, y, 34, 0x0b0f1a, 0.55).setStrokeStyle(3, 0xf5c542, 0.8)
      .setScrollFactor(0).setDepth(100).setInteractive();
    const barra1 = this.add.rectangle(x - 8, y, 8, 26, 0xf5c542).setScrollFactor(0).setDepth(101);
    const barra2 = this.add.rectangle(x + 8, y, 8, 26, 0xf5c542).setScrollFactor(0).setDepth(101);
    this.partesPausa = [[boton, 0], [barra1, -8], [barra2, 8]]; // [objeto, desplazamiento en x]
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
    this.pantallaFinal(titulo, texto, this.premiosFinales(false), [
      { texto: 'Reintentar', principal: true, accion: () => this.jugarMundo(this.indiceMundo, this.dificultad) },
      { texto: 'Mapa', accion: () => this.irAlMapa() },
    ]);
  }

  /** Empieza (o reinicia) un mundo. En pareja, el invitado entra también. */
  jugarMundo(indice, dificultad = 1) {
    if (this.cooperativo) this.cooperativo.enviar({ t: 'iniciar', mundo: indice, dificultad });
    this.scene.restart({ mundo: indice, dificultad, coop: !!this.cooperativo });
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
    marcarSuperado(this.indiceMundo, this.dificultad);

    // v0.1.4: se abre la dificultad siguiente de ESTE mundo (y, si es la primera vez, el mundo siguiente)
    const siguiente = this.balance.mundos[this.indiceMundo + 1];
    const otraDif = this.balance.dificultades.lista[this.dificultad]; // la siguiente (índice = número actual)
    const lineas = [];
    if (otraDif) lineas.push(`Nueva dificultad: ${otraDif.nombre}`);
    if (siguiente && this.dificultad === 1) lineas.push(`Desbloqueaste: ${siguiente.nombre}`);
    const mensaje = lineas.length ? lineas.join(' · ') : '¡Superaste la dificultad más alta!';
    const botones = [{ texto: 'Mapa', accion: () => this.irAlMapa() }];
    if (otraDif) {
      botones.unshift({ // unshift: lo agrega al PRINCIPIO de la lista
        texto: otraDif.nombre, principal: true,
        accion: () => this.jugarMundo(this.indiceMundo, this.dificultad + 1),
      });
    } else if (siguiente) {
      botones.unshift({ texto: 'Siguiente', principal: true, accion: () => this.jugarMundo(this.indiceMundo + 1) });
    }
    this.chispas.explode(80, this.heroe.cuerpo.x, this.heroe.cuerpo.y);
    const titulo = `¡${this.mundo.nombre} (${this.dif.nombre}) superado!`;
    const texto = `${mensaje}\nDerrotados: ${this.derrotados}`;
    if (this.cooperativo) this.cooperativo.enviar({ t: 'fin', tipo: 'victoria', titulo, texto });
    this.pantallaFinal(titulo, texto, this.premiosFinales(true), botones);
  }

  /**
   * Fondo oscuro, título, texto y 1 o 2 botones (lo usan la derrota y la victoria).
   * premios (v0.1.2): el texto de los cofres, debajo de los botones.
   */
  pantallaFinal(titulo, texto, premios, botones) {
    // Por seguridad: ningún menú de pausa encima, y esta escena funcionando
    this.scene.stop('EscenaPausa');
    if (this.scene.isPaused()) this.scene.resume();
    const cx = this.scale.baseSize.width / 2;
    const cy = this.scale.baseSize.height / 2;
    const fijo = (objeto) => objeto.setScrollFactor(0).setDepth(200);

    fijo(this.add.rectangle(cx, cy, this.scale.baseSize.width, this.scale.baseSize.height, 0x000000, 0.65)).setInteractive();
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
    if (premios) {
      // v0.1.7: con muchos cofres (mundos con 4-6 jefes) la letra se achica para que quepa
      const lineas = premios.split('\n').length;
      fijo(this.add.text(cx, cy + 140, premios, {
        fontFamily: 'Arial, sans-serif', fontSize: lineas > 5 ? '15px' : lineas > 3 ? '18px' : '22px',
        color: '#ffe082', align: 'center', wordWrap: { width: this.scale.baseSize.width - 40 },
        stroke: '#05070d', strokeThickness: 4, lineSpacing: 4,
      }).setOrigin(0.5, 0));
    }
    // En el PC: ENTER = primer botón (Reintentar o Siguiente)
    this.input.keyboard.once('keydown-ENTER', botones[0].accion);
  }

  // =============================================================
  // Ambiente y textos
  // =============================================================

  /** Clima (partículas que siguen a la cámara) y viñeta */
  crearAmbiente() {
    const W = this.scale.baseSize.width;
    const H = this.scale.baseSize.height;
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
      // v0.1.6: climas de los mundos nuevos
      estrellas: { textura: 'brillo', speedX: { min: -5, max: 5 }, speedY: { min: -5, max: 5 },
        tint: [0xffffff, 0xb388ff, 0x80d8ff], scale: { start: 0.08, end: 0.02 }, alpha: { start: 1, end: 0 }, lifespan: 2500, frequency: 90, blendMode: 'ADD' },
      burbujas: { textura: 'chispa', speedY: { min: -70, max: -30 }, speedX: { min: -8, max: 8 },
        tint: 0xb2ebf2, scale: { start: 0.5, end: 1.1 }, alpha: { start: 0.6, end: 0 }, lifespan: 4500, frequency: 110 },
    };
    // En celular, la mitad de partículas (optimización): "frequency" más alta = menos seguido
    const factor = this.sys.game.device.os.desktop ? 1 : 2;
    this.climas = this.mundo.clima.map((tipo) => {
      const { textura, ...config } = climas[tipo]; // separamos la textura del resto
      config.frequency *= factor;
      return this.add.particles(0, 0, textura, { ...zona, ...config }).setDepth(5);
    });

    // VIÑETA: fija en la pantalla, encima del mundo y debajo de los controles
    this.vineta = this.add.image(W / 2, H / 2, 'vineta').setDisplaySize(W, H).setScrollFactor(0).setDepth(90);
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
    const texto = this.add.text(this.scale.baseSize.width / 2, this.scale.baseSize.height / 2 - 120, mensaje, {
      // v0.1.7: los anuncios de 2 líneas (oleada + monstruos) o largos van más chicos
      fontFamily: FUENTE_TITULO, fontSize: mensaje.includes('\n') || mensaje.length > 22 ? '40px' : '60px',
      color: '#f5c542', fontStyle: 'bold', stroke: '#3a1500', strokeThickness: 8, align: 'center',
      wordWrap: { width: this.scale.baseSize.width - 60 },
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
    this.add.text(20, 14, `${this.mundo.nombre.toUpperCase()} ${this.dif.nombre.toUpperCase()} · ${this.raza.nombre.toUpperCase()} ${this.rol.nombre.toUpperCase()} ${this.balance.nombresRol[this.datosHeroe.idRol].toUpperCase()} NV ${this.datosHeroe.personaje.nivel}${this.cooperativo ? ' · EN PAREJA' : ''}`, { ...estilo, fontFamily: FUENTE_TITULO, color: '#c9a94a' })
      .setScrollFactor(0).setDepth(100);
    this.textoProgreso = this.add.text(20, 42, '', {
      ...estilo, fontFamily: FUENTE_TITULO, fontSize: '28px', color: '#f5c542', fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(100);
    this.textoDerrotados = this.add.text(20, 80, '', estilo).setScrollFactor(0).setDepth(100);
    // v0.1.4: barra de MANÁ (se dibuja en actualizarMana)
    this.barraManaHud = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.textoMana = this.add.text(270, 121, '', { ...estilo, fontSize: '16px', color: '#90caf9' })
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(100);
    this.textoAyuda = this.add.text(20, this.scale.baseSize.height - 36,
      'PC: WASD mover · ESPACIO botón 1 · K botón 2 · L botón 3 · H poción vida · M poción maná · P pausa', { ...estilo, fontSize: '18px', color: '#c8d3e0' })
      .setScrollFactor(0).setDepth(100);

    // FPS = cuadros por segundo. 60 es fluido; menos de 30 se siente lento.
    this.textoFps = this.add.text(this.scale.baseSize.width - 110, 100, '', { ...estilo, fontSize: '16px', color: '#9fb3c8' })
      .setScrollFactor(0).setDepth(100);

    // Barra grande de vida del jefe, arriba al centro (se dibuja en update)
    this.barraJefe = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.textoJefe = this.add.text(this.scale.baseSize.width / 2, 22, '', { ...estilo, fontFamily: FUENTE_TITULO, fontSize: '20px', color: '#ffccbc' })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);
  }

  /** Actualiza los textos de progreso, derrotados y pociones */
  actualizarHud() {
    this.textoProgreso.setText(`Oleadas ${this.oleadasVencidas}/${this.mundo.oleadas} · Jefes ${this.jefesVencidos}/${this.mazmorra.totalJefes}`);
    this.textoDerrotados.setText(`Derrotados: ${this.derrotados}`);
    // v0.1.4: cuántas pociones me quedan (las sin pociones se ven apagadas)
    const mias = pociones();
    for (const [tipo, boton] of [['vida', this.botonVida], ['mana', this.botonMana]]) {
      this.textosPociones[tipo].setText(`${mias[tipo]}`);
      boton.circulo.setAlpha(mias[tipo] > 0 ? 1 : 0.35);
      boton.texto.setAlpha(mias[tipo] > 0 ? 1 : 0.35);
    }
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
    const x = this.scale.baseSize.width / 2 - ancho / 2;
    g.fillStyle(0x000000, 0.6).fillRect(x - 3, 50, ancho + 6, 22);
    g.fillStyle(color(this.mundo.colores.jefe)).fillRect(x, 53, ancho * porcentaje, 16);
    g.lineStyle(2, 0xf5c542, 0.8).strokeRect(x - 3, 50, ancho + 6, 22);
    const total = this.mazmorra.totalJefes;
    // v0.1.7: con el nombre del jefe de este mundo
    const nombre = this.nombreMonstruo('jefe').toUpperCase();
    this.textoJefe.setText(total === 1 || !this.salaActiva ? nombre : `${nombre} · ${this.salaActiva.numero} DE ${total}`);
  }
}
