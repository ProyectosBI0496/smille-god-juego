// =============================================================
// Crear personaje, paso 2: elegir la CLASE (v0.1.2; reemplaza a EscenaRol)
//   - La RAZA da el aspecto y pequeñas diferencias (vida, velocidad...).
//   - La CLASE decide cómo se pelea (qué hacen los 3 botones) y qué
//     ROLES tiene (tanque, DPS, sanador), que deciden qué estadísticas sube.
// Cada raza tiene sus clases (Excel del creador). Las 2 primeras salen
// al empezar; las demás se abren poco a poco al alcanzar cierto NIVEL
// (balance.json → progreso.desbloqueoClases).
// v0.1.4: después de la clase viene el paso 3, elegir el ROL (EscenaRol).
// =============================================================

import { crearTexturas } from '../graficos/Texturas.js';
import { crearVineta, reiniciarAlCambiarTamano } from '../ui/Pantalla.js';
import { color } from '../graficos/TexturasMundo.js';
import { FUENTE_TITULO } from './EscenaArena.js';
import { nivelMaximo } from '../datos/Progreso.js';
import { clasesDeRaza } from '../datos/Personaje.js';
import { seguirPareja } from '../red/Red.js';

export default class EscenaClase extends Phaser.Scene {
  constructor() {
    super('EscenaClase');
  }

  init(datos) {
    this.raza = (datos && datos.raza) || 'humano';
    this.volverA = (datos && datos.volverA) || 'EscenaMundos';
    this.datosVolver = (datos && datos.datosVolver) || {};
  }

  create() {
    crearTexturas(this);
    const W = this.scale.baseSize.width;
    const H = this.scale.baseSize.height;
    this.balance = this.cache.json.get('balance');
    const raza = this.balance.razas[this.raza];

    this.cameras.main.fadeIn(300);
    this.add.tileSprite(0, 0, W, H, 'baldosa-2').setOrigin(0).setTint(0x6a6a80);
    crearVineta(this);
    reiniciarAlCambiarTamano(this);
    this.add.text(W / 2, 40, `${raza.nombre}: elige tu clase`, {
      fontFamily: FUENTE_TITULO, fontSize: '44px', color: '#f5c542', fontStyle: 'bold',
      stroke: '#3a1500', strokeThickness: 7,
    }).setOrigin(0.5);
    this.add.text(W / 2, 86, 'Las clases bloqueadas se abren al subir de nivel a cualquier personaje', {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#d0d8e0', fontStyle: 'italic',
    }).setOrigin(0.5);

    // Tarjetas repartidas a lo ancho (hasta 7 clases)
    const clases = clasesDeRaza(this.balance, this.raza, nivelMaximo());
    const ancho = Math.min(200, (W - 40) / clases.length - 10);
    clases.forEach((c, i) => this.crearTarjeta(W / 2 + (i - (clases.length - 1) / 2) * (ancho + 10), 380, ancho, c));

    const volver = this.add.text(24, H - 14, '← Volver', {
      fontFamily: FUENTE_TITULO, fontSize: '26px', color: '#f5c542', stroke: '#05070d', strokeThickness: 4,
    }).setOrigin(0, 1).setInteractive();
    volver.on('pointerdown', () => this.scene.start('EscenaHeroe', { volverA: this.volverA, datosVolver: this.datosVolver }));
    seguirPareja(this);
  }

  crearTarjeta(x, y, ancho, { id, necesario, abierta }) {
    const clase = this.balance.clases[id];
    const c = color(clase.color);
    const alto = 520;
    const gris = '#777777';

    this.add.rectangle(x, y, ancho, alto, 0x0b0f1a, 0.8).setStrokeStyle(2, c, abierta ? 0.8 : 0.3);

    // Mi raza con un aura del color de la clase
    this.add.image(x, y - 190, 'brillo').setTint(c).setAlpha(abierta ? 0.5 : 0.12).setScale(1)
      .setBlendMode(Phaser.BlendModes.ADD);
    const cuerpo = this.add.image(x, y - 190, `${this.raza}-cuerpo`).setScale(1.1).setAngle(-90);
    if (!abierta) cuerpo.setTint(0x333333);

    this.add.text(x, y - 118, clase.nombre, {
      fontFamily: FUENTE_TITULO, fontSize: '24px', fontStyle: 'bold',
      color: abierta ? clase.color : gris, stroke: '#05070d', strokeThickness: 5,
    }).setOrigin(0.5);

    // Tipo y roles: "A distancia · DPS / Sanador"
    const tipo = clase.tipo === 'melee' ? 'Cuerpo a cuerpo' : 'A distancia';
    const roles = clase.roles.map((r) => this.balance.nombresRol[r]).join(' / ');
    this.add.text(x, y - 90, `${tipo}\n${roles}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', color: abierta ? '#ffe082' : gris, align: 'center',
    }).setOrigin(0.5, 0);
    this.add.text(x, y - 44, clase.descripcion, {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', color: abierta ? '#cfd8dc' : gris,
      align: 'center', wordWrap: { width: ancho - 16 },
    }).setOrigin(0.5, 0);

    // v0.1.4: los roles que puede tener, con su especialidad (el rol se elige en el paso 3)
    clase.roles.forEach((rol, i) => {
      const set = this.balance.poderes[id][rol];
      const especialidad = set.especialidad.replace(/^.*\((.*)\)$/, '$1'); // "Tanque Melee (Coloso de Acero)" → "Coloso de Acero"
      this.add.text(x - ancho / 2 + 12, y + 20 + i * 44, `• ${this.balance.nombresRol[rol]}\n  ${especialidad}`, {
        fontFamily: 'Arial, sans-serif', fontSize: '14px', color: abierta ? '#ffffff' : gris,
        wordWrap: { width: ancho - 20 },
      });
    });

    this.add.text(x, y + 160, `Vida ×${clase.vida} · Veloc. ×${clase.velocidad}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', color: abierta ? '#c9a94a' : gris, fontStyle: 'bold',
    }).setOrigin(0.5);

    if (!abierta) {
      this.add.text(x, y + alto / 2 - 40, `🔒 Nivel ${necesario}`, {
        fontFamily: FUENTE_TITULO, fontSize: '22px', color: '#aaaaaa', fontStyle: 'bold',
      }).setOrigin(0.5);
      return;
    }

    const boton = this.add.rectangle(x, y + alto / 2 - 40, ancho - 30, 52, 0xf5c542).setStrokeStyle(3, 0xfff3c4);
    this.add.text(x, y + alto / 2 - 40, 'Elegir', {
      fontFamily: FUENTE_TITULO, fontSize: '24px', color: '#1a0f00', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Toda la tarjeta es un botón: pasa al paso 3, elegir el ROL (v0.1.4)
    const zona = this.add.zone(x, y, ancho, alto).setInteractive();
    zona.on('pointerdown', () => {
      this.tweens.add({ targets: [cuerpo, boton], scale: 1.3, duration: 150, yoyo: true });
      this.cameras.main.fadeOut(300);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('EscenaRol', {
        raza: this.raza, clase: id, volverA: this.volverA, datosVolver: this.datosVolver,
      }));
    });
  }
}
