// =============================================================
// Crear personaje, paso 1: elegir bando y RAZA (Etapa 8, D-023)
// v0.1.2: 12 razas (6 por bando, del Excel del creador), en 2 filas de 3.
// Las razas con "desbloqueo" > 0 se abren al superar ese número de mundos.
// Después se elige la CLASE (EscenaClase). Todo sale de balance.json.
// =============================================================

import { crearTexturas } from '../graficos/Texturas.js';
import { crearVineta, reiniciarAlCambiarTamano } from '../ui/Pantalla.js';
import { color } from '../graficos/TexturasMundo.js';
import { FUENTE_TITULO } from './EscenaArena.js';
import { mundosSuperados, nivelMaximo } from '../datos/Progreso.js';
import { clasesDeRaza } from '../datos/Personaje.js';
import { seguirPareja } from '../red/Red.js';

export default class EscenaHeroe extends Phaser.Scene {
  constructor() {
    super('EscenaHeroe');
  }

  // volverA: a dónde ir al terminar de crear el personaje (mapa o sala de pareja)
  init(datos) {
    this.volverA = (datos && datos.volverA) || 'EscenaMundos';
    this.datosVolver = (datos && datos.datosVolver) || {};
  }

  create() {
    crearTexturas(this);
    const W = this.scale.baseSize.width;
    const H = this.scale.baseSize.height;
    this.balance = this.cache.json.get('balance');
    this.razas = this.balance.razas;
    this.superados = mundosSuperados();

    // Máximos de cada estadística, para dibujar las barras en proporción
    const lista = Object.values(this.razas);
    this.maximos = {
      vidaMax: Math.max(...lista.map((r) => r.vidaMax)),
      velocidad: Math.max(...lista.map((r) => r.velocidad)),
      danio: Math.max(...lista.map((r) => r.danio)),
    };

    this.cameras.main.fadeIn(300);
    this.add.tileSprite(0, 0, W, H, 'baldosa-2').setOrigin(0).setTint(0x6a6a80);
    crearVineta(this);
    reiniciarAlCambiarTamano(this);
    this.add.text(W / 2, 36, 'Crea tu personaje: elige la raza', {
      fontFamily: FUENTE_TITULO, fontSize: '40px', color: '#f5c542', fontStyle: 'bold',
      stroke: '#3a1500', strokeThickness: 7,
    }).setOrigin(0.5);

    this.balance.bandos.forEach((bando, i) => this.crearBando(bando, i === 0 ? W * 0.25 : W * 0.75, W / 2 - 20));

    const volver = this.add.text(24, H - 12, '← Volver', {
      fontFamily: FUENTE_TITULO, fontSize: '26px', color: '#f5c542', stroke: '#05070d', strokeThickness: 4,
    }).setOrigin(0, 1).setInteractive();
    volver.on('pointerdown', () => this.scene.start(this.volverA === 'EscenaSala' ? 'EscenaSala' : 'EscenaTitulo', this.datosVolver));
    seguirPareja(this); // si el anfitrión empieza la partida, el invitado entra aunque esté aquí
  }

  /** Encabezado del bando y sus 6 tarjetas de raza (2 filas de 3) */
  crearBando(bando, cx, anchoPanel) {
    const c = color(bando.color);
    this.add.rectangle(cx, 390, anchoPanel, 640, c, 0.08).setStrokeStyle(2, c, 0.5);
    this.add.text(cx, 92, bando.nombre, {
      fontFamily: FUENTE_TITULO, fontSize: '28px', fontStyle: 'bold', color: bando.color,
      stroke: '#05070d', strokeThickness: 5,
    }).setOrigin(0.5);
    const ancho = Math.min(185, (anchoPanel - 40) / 3);
    bando.razas.forEach((id, i) => {
      const columna = i % 3;
      const fila = Math.floor(i / 3);
      this.crearTarjeta(cx + (columna - 1) * (ancho + 10), 245 + fila * 285, ancho, id, c);
    });
  }

  crearTarjeta(x, y, ancho, id, colorBando) {
    const raza = this.razas[id];
    const bloqueada = this.superados < raza.desbloqueo;
    const alto = 270;

    this.add.rectangle(x, y, ancho, alto, 0x0b0f1a, 0.75).setStrokeStyle(2, colorBando, 0.6);

    // El héroe mirando hacia arriba (ángulo -90), con su parte extra si tiene
    const extra = raza.extra ? this.add.image(x, y - 78, `${id}-${raza.extra}`).setScale(1.05).setAngle(-90) : null;
    const cuerpo = this.add.image(x, y - 78, `${id}-cuerpo`).setScale(1.05).setAngle(-90);

    this.add.text(x, y - 10, raza.nombre, {
      fontFamily: FUENTE_TITULO, fontSize: '21px', fontStyle: 'bold',
      color: bloqueada ? '#777777' : '#ffffff', stroke: '#05070d', strokeThickness: 4,
    }).setOrigin(0.5);

    if (bloqueada) {
      for (const objeto of [cuerpo, extra].filter(Boolean)) objeto.setTint(0x222222);
      this.add.text(x, y + 50, `🔒 Supera ${raza.desbloqueo}\nmundos`, {
        fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#aaaaaa', align: 'center',
      }).setOrigin(0.5);
      return;
    }

    this.add.text(x, y + 10, raza.descripcion, {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#cfd8dc', align: 'center',
      wordWrap: { width: ancho - 12 },
    }).setOrigin(0.5, 0);

    // Barras de estadísticas (en proporción a la mejor raza)
    const stats = [['Vida', raza.vidaMax / this.maximos.vidaMax, 0x66bb6a],
      ['Veloc.', raza.velocidad / this.maximos.velocidad, 0x4fc3f7],
      ['Fuerza', raza.danio / this.maximos.danio, 0xff7043]];
    stats.forEach(([nombre, valor, colorBarra], i) => {
      const by = y + 56 + i * 18;
      this.add.text(x - ancho / 2 + 10, by, nombre, { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#ffffff' }).setOrigin(0, 0.5);
      this.add.rectangle(x - 10, by, ancho / 2, 8, 0x000000, 0.6).setOrigin(0, 0.5);
      this.add.rectangle(x - 10, by, (ancho / 2) * valor, 8, colorBarra).setOrigin(0, 0.5);
    });

    // Cuántas clases tiene y cuántas están abiertas ya
    const clases = clasesDeRaza(this.balance, id, nivelMaximo());
    const abiertas = clases.filter((c) => c.abierta).length;
    this.add.text(x, y + alto / 2 - 16, `Clases: ${abiertas} de ${clases.length}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#c9a94a', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Toda la tarjeta es un botón: pasa a elegir la clase de esta raza
    const zona = this.add.zone(x, y, ancho, alto).setInteractive();
    zona.on('pointerdown', () => {
      this.tweens.add({ targets: cuerpo, scale: 1.4, duration: 150, yoyo: true });
      this.cameras.main.fadeOut(300);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('EscenaClase', {
        raza: id, volverA: this.volverA, datosVolver: this.datosVolver,
      }));
    });
  }
}
