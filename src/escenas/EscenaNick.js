// =============================================================
// Escribir el nombre del jugador con un TECLADO PROPIO (sesión 14)
// Antes se usaba el teclado del celular, pero al abrirse achicaba la
// pantalla, el juego creía que el celular estaba vertical y salía el
// aviso "Gira tu celular". Este teclado está dibujado dentro del juego.
// =============================================================

import { crearTexturas } from '../graficos/Texturas.js';
import { crearVineta, reiniciarAlCambiarTamano } from '../ui/Pantalla.js';
import { FUENTE_TITULO } from './EscenaArena.js';
import { nick, guardarNick, razaElegida } from '../datos/Progreso.js';
import { redActual } from '../red/Red.js';

const MAXIMO = 12;
const FILAS = ['1234567890', 'QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM'];

export default class EscenaNick extends Phaser.Scene {
  constructor() {
    super('EscenaNick');
  }

  init(datos) {
    this.volverA = (datos && datos.volverA) || 'EscenaTitulo';
    this.datosVolver = (datos && datos.datosVolver) || {};
  }

  create() {
    crearTexturas(this);
    const W = this.scale.baseSize.width;
    const H = this.scale.baseSize.height;
    this.texto = nick();

    this.add.tileSprite(0, 0, W, H, 'baldosa-0').setOrigin(0).setTint(0x6a6a80);
    crearVineta(this);
    reiniciarAlCambiarTamano(this); // si cambia el tamaño de la pantalla, se rearma
    this.add.text(W / 2, 50, 'Tu nombre', {
      fontFamily: FUENTE_TITULO, fontSize: '48px', color: '#f5c542', fontStyle: 'bold',
      stroke: '#3a1500', strokeThickness: 7,
    }).setOrigin(0.5);
    this.add.rectangle(W / 2, 130, 520, 76, 0x000000, 0.6).setStrokeStyle(3, 0xf5c542);
    this.pantalla = this.add.text(W / 2, 130, '', {
      fontFamily: FUENTE_TITULO, fontSize: '44px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.mostrar();

    // Teclas: filas centradas; cada tecla mide 92 × 70
    FILAS.forEach((fila, f) => {
      const ancho = fila.length * 100;
      fila.split('').forEach((letra, i) => {
        this.tecla(W / 2 - ancho / 2 + 50 + i * 100, 225 + f * 85, letra, 92, () => this.escribir(letra));
      });
    });
    // Última fila: borrar, espacio y listo
    const y = 225 + FILAS.length * 85;
    this.tecla(W / 2 - 330, y, '⌫ Borrar', 200, () => { this.texto = this.texto.slice(0, -1); this.mostrar(); });
    this.tecla(W / 2, y, 'Espacio', 380, () => this.escribir(' '));
    this.tecla(W / 2 + 330, y, '✓ Listo', 200, () => this.terminar(), 0x66bb6a);
  }

  tecla(x, y, etiqueta, ancho, accion, color = 0x0b0f1a) {
    const fondo = this.add.rectangle(x, y, ancho, 70, color, 0.9).setStrokeStyle(2, 0xf5c542).setInteractive();
    this.add.text(x, y, etiqueta, {
      fontFamily: 'Arial, sans-serif', fontSize: etiqueta.length > 1 ? '26px' : '34px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    fondo.on('pointerdown', () => {
      fondo.setScale(0.92);
      this.time.delayedCall(80, () => fondo.setScale(1));
      accion();
    });
  }

  /** La primera letra en mayúscula y las demás en minúscula: "Victor" */
  escribir(letra) {
    if (this.texto.length >= MAXIMO) return;
    const minuscula = this.texto.length > 0 && this.texto.slice(-1) !== ' ';
    this.texto += minuscula ? letra.toLowerCase() : letra;
    this.mostrar();
  }

  mostrar() {
    this.pantalla.setText(this.texto.length ? `${this.texto}_` : '_');
  }

  terminar() {
    guardarNick(this.texto);
    const red = redActual();
    if (red && red.conectado) red.enviar({ t: 'raza', raza: razaElegida(), nick: nick() });
    this.scene.start(this.volverA, this.datosVolver);
  }
}
