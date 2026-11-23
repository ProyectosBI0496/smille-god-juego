// =============================================================
// Elegir el ROL (Fase 1, Etapa 1 — D-027 y D-029)
// Se muestra justo después de elegir la raza.
//   - La RAZA da el aspecto y pequeñas diferencias (vida, velocidad...).
//   - El ROL decide cómo se pelea: qué hacen los 3 botones.
// Todo sale de balance.json → "roles". Un rol con "disponible": false
// se ve, pero bloqueado ("próximamente").
// =============================================================

import { crearTexturas } from '../graficos/Texturas.js';
import { crearVineta, reiniciarAlCambiarTamano } from '../ui/Pantalla.js';
import { color } from '../graficos/TexturasMundo.js';
import { FUENTE_TITULO } from './EscenaArena.js';
import { razaElegida, rolElegido, elegirRol, nick } from '../datos/Progreso.js';
import { redActual } from '../red/Red.js';

// Lo que hace cada botón según el rol (solo para mostrarlo en la tarjeta)
const BOTONES = {
  guerrero: ['Golpe', 'Onda: empuja a todos', 'Torbellino: giro de cuchillas'],
  asesino: ['Dos cuchilladas rápidas', 'Paso sombrío: salta detrás del enemigo', 'Golpe crítico: mucho daño a uno'],
  sanador: ['Rayo de luz a distancia', 'Curar en área', 'Escudo de luz'],
};

export default class EscenaRol extends Phaser.Scene {
  constructor() {
    super('EscenaRol');
  }

  // Recibe a dónde ir después (igual que EscenaHeroe)
  init(datos) {
    this.volverA = (datos && datos.volverA) || 'EscenaMundos';
    this.datosVolver = (datos && datos.datosVolver) || {};
  }

  create() {
    crearTexturas(this);
    const W = this.scale.baseSize.width;
    const H = this.scale.baseSize.height;
    this.roles = this.cache.json.get('balance').roles;
    this.elegido = rolElegido();
    this.raza = razaElegida();

    this.cameras.main.fadeIn(300);
    this.add.tileSprite(0, 0, W, H, 'baldosa-2').setOrigin(0).setTint(0x6a6a80);
    crearVineta(this);
    reiniciarAlCambiarTamano(this);
    this.add.text(W / 2, 46, 'Elige tu rol', {
      fontFamily: FUENTE_TITULO, fontSize: '52px', color: '#f5c542', fontStyle: 'bold',
      stroke: '#3a1500', strokeThickness: 8,
    }).setOrigin(0.5);
    this.add.text(W / 2, 96, 'La raza es tu aspecto; el rol decide tus poderes', {
      fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#d0d8e0', fontStyle: 'italic',
    }).setOrigin(0.5);

    // Tres tarjetas, repartidas a lo ancho (el ancho cambia de un celular a otro)
    const ids = Object.keys(this.roles);
    const ancho = Math.min(300, (W - 80) / ids.length - 20);
    ids.forEach((id, i) => this.crearTarjeta(W / 2 + (i - (ids.length - 1) / 2) * (ancho + 24), 400, ancho, id));

    const volver = this.add.text(24, H - 20, '← Volver', {
      fontFamily: FUENTE_TITULO, fontSize: '26px', color: '#f5c542', stroke: '#05070d', strokeThickness: 4,
    }).setOrigin(0, 1).setInteractive();
    volver.on('pointerdown', () => this.scene.start('EscenaHeroe', { volverA: this.volverA, datosVolver: this.datosVolver }));
  }

  crearTarjeta(x, y, ancho, id) {
    const rol = this.roles[id];
    const bloqueado = !rol.disponible;
    const elegido = id === this.elegido && !bloqueado;
    const c = color(rol.color);
    const alto = 470;

    this.add.rectangle(x, y, ancho, alto, 0x0b0f1a, 0.78)
      .setStrokeStyle(elegido ? 5 : 2, elegido ? 0xf5c542 : c, elegido ? 1 : 0.6);

    // Mi héroe (con mi raza) y un aura del color del rol
    this.add.image(x, y - 150, 'brillo').setTint(c).setAlpha(bloqueado ? 0.15 : 0.5).setScale(1.2)
      .setBlendMode(Phaser.BlendModes.ADD);
    const cuerpo = this.add.image(x, y - 150, `${this.raza}-cuerpo`).setScale(1.3).setAngle(-90);
    if (bloqueado) cuerpo.setTint(0x333333);

    this.add.text(x, y - 70, rol.nombre, {
      fontFamily: FUENTE_TITULO, fontSize: '32px', fontStyle: 'bold',
      color: bloqueado ? '#777777' : rol.color, stroke: '#05070d', strokeThickness: 5,
    }).setOrigin(0.5);
    this.add.text(x, y - 38, rol.descripcion, {
      fontFamily: 'Arial, sans-serif', fontSize: '16px', color: bloqueado ? '#888888' : '#cfd8dc',
      align: 'center', wordWrap: { width: ancho - 20 },
    }).setOrigin(0.5, 0);

    // Los 3 botones del rol: número y qué hacen
    (BOTONES[id] || []).forEach((texto, i) => {
      this.add.text(x - ancho / 2 + 14, y + 30 + i * 52, `${i + 1}. ${texto}`, {
        fontFamily: 'Arial, sans-serif', fontSize: '16px', color: bloqueado ? '#777777' : '#ffffff',
        wordWrap: { width: ancho - 28 },
      });
    });

    // Vida y velocidad del rol (multiplican las de la raza)
    const extra = `Vida ×${rol.vida} · Velocidad ×${rol.velocidad}`;
    this.add.text(x, y + alto / 2 - 24, bloqueado ? 'Próximamente' : extra, {
      fontFamily: 'Arial, sans-serif', fontSize: '15px', color: bloqueado ? '#aaaaaa' : '#c9a94a', fontStyle: 'bold',
    }).setOrigin(0.5);
    if (bloqueado) return;

    // Toda la tarjeta es un botón: guarda el rol y sigue
    const zona = this.add.zone(x, y, ancho, alto).setInteractive();
    zona.on('pointerdown', () => {
      elegirRol(id);
      // En pareja: el compañero se entera de mi raza y mi rol
      const red = redActual();
      if (red && red.conectado) red.enviar({ t: 'raza', raza: this.raza, rol: id, nick: nick() });
      this.tweens.add({ targets: cuerpo, scale: 1.6, duration: 150, yoyo: true });
      this.cameras.main.fadeOut(350);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(this.volverA, this.datosVolver));
    });
  }
}
