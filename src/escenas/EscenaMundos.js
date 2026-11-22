// =============================================================
// Mapa de mundos (Etapa 6)
// Una tarjeta por mundo de balance.json. Los mundos superados
// tienen ✓, el siguiente está abierto y los demás tienen candado.
// =============================================================

import { crearTexturas } from '../graficos/Texturas.js';
import { crearVineta, reiniciarAlCambiarTamano } from '../ui/Pantalla.js';
import { crearTexturasMundo, color } from '../graficos/TexturasMundo.js';
import { FUENTE_TITULO } from './EscenaArena.js';
import { mundosSuperados, razaElegida } from '../datos/Progreso.js';
import { redActual } from '../red/Red.js';

export default class EscenaMundos extends Phaser.Scene {
  constructor() {
    super('EscenaMundos');
  }

  create() {
    crearTexturas(this);
    const W = this.scale.baseSize.width;
    const H = this.scale.baseSize.height;
    const mundos = this.cache.json.get('balance').mundos;
    const superados = mundosSuperados();

    this.cameras.main.fadeIn(300);
    this.add.tileSprite(0, 0, W, H, 'baldosa-0').setOrigin(0).setTint(0x6a6a80);
    crearVineta(this);
    reiniciarAlCambiarTamano(this); // si cambia el tamaño de la pantalla, se rearma

    // En pareja (Etapa 9): solo el anfitrión elige; se le avisa al invitado
    const red = redActual();
    this.enPareja = !!(red && red.esAnfitrion && red.conectado);
    if (this.enPareja) {
      this.add.text(W / 2, 128, 'Modo pareja ✓ — tu compañero entrará contigo', {
        fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#a5d6a7', stroke: '#05070d', strokeThickness: 4,
      }).setOrigin(0.5);
      red.escuchar(this, 'desconectado', () => { red.cerrar(); this.scene.restart(); });
    }

    this.add.text(W / 2, 70, 'Elige tu mundo', {
      fontFamily: FUENTE_TITULO, fontSize: '60px', color: '#f5c542', fontStyle: 'bold',
      stroke: '#3a1500', strokeThickness: 8,
    }).setOrigin(0.5);

    // Tarjetas en fila, centradas
    const anchoTarjeta = 250;
    const separacion = 30;
    const total = mundos.length * anchoTarjeta + (mundos.length - 1) * separacion;
    const x0 = (W - total) / 2 + anchoTarjeta / 2;

    mundos.forEach((mundo, i) => {
      crearTexturasMundo(this, mundo);
      const estado = i < superados ? 'superado' : i === superados ? 'abierto' : 'bloqueado';
      this.crearTarjeta(x0 + i * (anchoTarjeta + separacion), 370, anchoTarjeta, mundo, i, estado);
    });

    // Héroe elegido (abajo a la derecha) y botón para cambiarlo
    const razas = this.cache.json.get('balance').razas;
    const id = razas[razaElegida()] ? razaElegida() : 'humano';
    // El texto se alinea al borde derecho (origen 1) y el dibujo va a su izquierda:
    // así nunca se sale de la pantalla, sea cual sea el largo del nombre.
    const cambiar = this.add.text(W - 24, H - 60, `${razas[id].nombre} · Cambiar`, {
      fontFamily: FUENTE_TITULO, fontSize: '26px', color: '#f5c542', stroke: '#05070d', strokeThickness: 4,
    }).setOrigin(1, 0.5).setInteractive();
    const xHeroe = cambiar.x - cambiar.width - 45;
    if (razas[id].extra) this.add.image(xHeroe, H - 60, `${id}-${razas[id].extra}`).setAngle(-90).setScale(0.8);
    this.add.image(xHeroe, H - 60, `${id}-cuerpo`).setAngle(-90).setScale(0.8);
    cambiar.on('pointerdown', () => this.scene.start('EscenaHeroe'));

    // Botón para volver (a la elección de héroe)
    const volver = this.add.text(30, H - 30, '← Volver', {
      fontFamily: FUENTE_TITULO, fontSize: '28px', color: '#f5c542', stroke: '#05070d', strokeThickness: 4,
    }).setOrigin(0, 1).setInteractive();
    volver.on('pointerdown', () => this.scene.start('EscenaHeroe'));
  }

  /** Una tarjeta: vista del suelo del mundo, nombre, jefes y su estado */
  crearTarjeta(x, y, ancho, mundo, indice, estado) {
    const alto = 340;
    const bloqueado = estado === 'bloqueado';

    // Vista previa: el suelo real del mundo, repetido
    const vista = this.add.tileSprite(x, y - 40, ancho - 20, 200, `suelo-${mundo.id}-1`);
    const deco = mundo.decoracionPorSala[0];
    const adorno = this.add.image(x, y - 40, `deco-${mundo.id}-${deco.tipo}`).setScale(1.2);
    const jefe = this.add.image(x + 60, y - 60, 'jefe').setScale(0.5).setTint(color(mundo.colores.jefe));
    this.add.rectangle(x, y, ancho, alto).setStrokeStyle(4, bloqueado ? 0x555555 : 0xf5c542);

    this.add.text(x, y + 90, mundo.nombre, {
      fontFamily: FUENTE_TITULO, fontSize: '34px', fontStyle: 'bold',
      color: bloqueado ? '#777777' : '#f5c542', stroke: '#05070d', strokeThickness: 5,
    }).setOrigin(0.5);
    const jefes = Math.floor(mundo.oleadas / mundo.oleadasPorJefe);
    const curas = mundo.curas;
    this.add.text(x, y + 132, `${mundo.oleadas} oleadas · ${jefes} ${jefes === 1 ? 'jefe' : 'jefes'} · ${curas} ${curas === 1 ? 'cura' : 'curas'}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '20px', color: bloqueado ? '#777777' : '#ffffff',
      stroke: '#05070d', strokeThickness: 3,
    }).setOrigin(0.5);

    if (bloqueado) {
      // Oscurecemos la vista y dibujamos un candado
      for (const objeto of [vista, adorno, jefe]) objeto.setTint(0x333333);
      const g = this.add.graphics();
      g.lineStyle(8, 0xbbbbbb).strokeCircle(x, y - 62, 22);
      g.fillStyle(0xbbbbbb).fillRoundedRect(x - 34, y - 58, 68, 52, 8);
      g.fillStyle(0x333333).fillCircle(x, y - 36, 7);
      return;
    }

    if (estado === 'superado') {
      this.add.text(x + ancho / 2 - 18, y - alto / 2 + 14, '✓', {
        fontFamily: 'Arial, sans-serif', fontSize: '40px', color: '#66bb6a', fontStyle: 'bold',
        stroke: '#05070d', strokeThickness: 5,
      }).setOrigin(1, 0);
    } else {
      // El mundo nuevo "brilla" para invitar a entrar
      const marco = this.add.rectangle(x, y, ancho + 10, alto + 10).setStrokeStyle(3, 0xfff3c4, 0.8);
      this.tweens.add({ targets: marco, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });
    }

    // Toda la tarjeta es un botón
    const zona = this.add.zone(x, y, ancho, alto).setInteractive();
    zona.on('pointerdown', () => {
      this.cameras.main.fadeOut(300);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        if (this.enPareja) redActual().enviar({ t: 'iniciar', mundo: indice });
        this.scene.start('EscenaArena', { mundo: indice, coop: this.enPareja });
      });
    });
  }
}
