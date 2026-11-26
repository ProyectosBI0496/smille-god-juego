// =============================================================
// Crear personaje, paso 3: elegir el ROL (v0.1.4)
//   v0.1.5: la raza + clase se elige en "Mis héroes" (EscenaHeroe), en el
//   orden de la escala de desbloqueo. Aquí se elige el ROL:
//   qué hace en el grupo: DPS, Tanque o Sanador.
// Cada CLASE + ROL tiene su set de poderes (Excel del creador:
// pasiva + 3 botones), guardado en balance.json → "poderes".
// El rol también decide qué estadísticas se suben.
// Si la clase tiene un solo rol (Mago, Cazador...), igual se muestra
// para que el jugador vea sus poderes antes de crear el personaje.
// =============================================================

import { crearTexturas } from '../graficos/Texturas.js';
import { crearVineta, reiniciarAlCambiarTamano } from '../ui/Pantalla.js';
import { color } from '../graficos/TexturasMundo.js';
import { FUENTE_TITULO } from './EscenaArena.js';
import { crearPersonaje } from '../datos/Progreso.js';
import { estadisticasDeRol, poderesDe } from '../datos/Personaje.js';
import { redActual, seguirPareja } from '../red/Red.js';

const TEXTO = { fontFamily: 'Arial, sans-serif', color: '#ffffff' };

export default class EscenaRol extends Phaser.Scene {
  constructor() {
    super('EscenaRol');
  }

  init(datos) {
    this.raza = (datos && datos.raza) || 'humano';
    this.clase = (datos && datos.clase) || 'guerrero';
    this.volverA = (datos && datos.volverA) || 'EscenaMundos';
    this.datosVolver = (datos && datos.datosVolver) || {};
  }

  create() {
    crearTexturas(this);
    const W = this.scale.baseSize.width;
    const H = this.scale.baseSize.height;
    this.balance = this.cache.json.get('balance');
    const raza = this.balance.razas[this.raza];
    const clase = this.balance.clases[this.clase];

    this.cameras.main.fadeIn(300);
    this.add.tileSprite(0, 0, W, H, 'baldosa-2').setOrigin(0).setTint(0x6a6a80);
    crearVineta(this);
    reiniciarAlCambiarTamano(this);
    this.add.text(W / 2, 40, `${raza.nombre} ${clase.nombre}: elige tu rol`, {
      fontFamily: FUENTE_TITULO, fontSize: '42px', color: '#f5c542', fontStyle: 'bold',
      stroke: '#3a1500', strokeThickness: 7,
    }).setOrigin(0.5);
    this.add.text(W / 2, 84, 'El rol decide tus poderes y en qué estadísticas destacas', {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#d0d8e0', fontStyle: 'italic',
    }).setOrigin(0.5);

    // Una tarjeta por rol (1 a 3), repartidas a lo ancho
    const roles = clase.roles;
    const ancho = Math.min(400, (W - 40) / roles.length - 16);
    const alto = Math.min(570, H - 150);
    const y = 110 + alto / 2;
    roles.forEach((rol, i) => this.crearTarjeta(W / 2 + (i - (roles.length - 1) / 2) * (ancho + 16), y, ancho, alto, rol));

    const volver = this.add.text(24, H - 14, '← Volver', {
      fontFamily: FUENTE_TITULO, fontSize: '26px', color: '#f5c542', stroke: '#05070d', strokeThickness: 4,
    }).setOrigin(0, 1).setInteractive();
    volver.on('pointerdown', () => this.scene.start('EscenaHeroe', { volverA: this.volverA, datosVolver: this.datosVolver }));
    seguirPareja(this);
  }

  crearTarjeta(x, y, ancho, alto, rol) {
    const b = this.balance;
    const set = poderesDe(b, this.clase, rol);
    const colorRol = b.coloresRol[rol];
    const arriba = y - alto / 2;
    const izq = x - ancho / 2 + 16;
    const anchoTexto = ancho - 32;

    this.add.rectangle(x, y, ancho, alto, 0x0b0f1a, 0.85).setStrokeStyle(3, color(colorRol), 0.8);

    // Nombre del rol, especialidad y tipo
    this.add.text(x, arriba + 30, b.nombresRol[rol], {
      fontFamily: FUENTE_TITULO, fontSize: '30px', fontStyle: 'bold', color: colorRol, stroke: '#05070d', strokeThickness: 5,
    }).setOrigin(0.5);
    const especialidad = set.especialidad.replace(/^.*\((.*)\)$/, '$1');
    const tipo = set.tipo === 'melee' ? 'Cuerpo a cuerpo' : 'A distancia';
    this.add.text(x, arriba + 62, `${especialidad} · ${tipo}`, {
      ...TEXTO, fontSize: '15px', color: '#ffe082', align: 'center', wordWrap: { width: anchoTexto },
    }).setOrigin(0.5, 0);

    // Pasiva (siempre activa)
    let cy = arriba + 100;
    const pasiva = this.add.text(izq, cy, `✦ ${set.pasiva.nombre} (pasiva)`, {
      ...TEXTO, fontSize: '16px', fontStyle: 'bold', color: '#b388ff', wordWrap: { width: anchoTexto },
    });
    cy += pasiva.height + 2;
    const textoPasiva = this.add.text(izq, cy, set.pasiva.texto, {
      ...TEXTO, fontSize: '14px', color: '#cfd8dc', wordWrap: { width: anchoTexto },
    });
    cy += textoPasiva.height + 12;

    // Los 3 poderes: nombre, qué hace (corto) y en qué nivel se abre
    const niveles = b.progreso.nivelBotones;
    set.botones.forEach((poder, i) => {
      const nivel = niveles[i] > 1 ? `  · Nv ${niveles[i]}` : '';
      const titulo = this.add.text(izq, cy, `${i + 1}. ${poder.nombre}${nivel}`, {
        ...TEXTO, fontSize: '18px', fontStyle: 'bold', wordWrap: { width: anchoTexto },
      });
      cy += titulo.height + 1;
      const detalle = this.add.text(izq + 18, cy, poder.mecanica, {
        ...TEXTO, fontSize: '14px', color: '#90a4ae', wordWrap: { width: anchoTexto - 18 },
      });
      cy += detalle.height + 8;
    });

    // Las estadísticas que más crecen con el nivel en este rol (Excel)
    const stats = estadisticasDeRol(b, rol).map((id) => b.estadisticas.lista[id].nombre).join(' y ');
    this.add.text(x, y + alto / 2 - 92, `Destaca en: ${stats}`, {
      ...TEXTO, fontSize: '15px', fontStyle: 'bold', color: '#c9a94a',
    }).setOrigin(0.5);

    // Botón Crear: toda la tarjeta lo es
    const yBoton = y + alto / 2 - 42;
    const boton = this.add.rectangle(x, yBoton, ancho - 40, 52, 0xf5c542).setStrokeStyle(3, 0xfff3c4);
    this.add.text(x, yBoton, 'Crear', {
      fontFamily: FUENTE_TITULO, fontSize: '24px', color: '#1a0f00', fontStyle: 'bold',
    }).setOrigin(0.5);

    const zona = this.add.zone(x, y, ancho, alto).setInteractive();
    zona.on('pointerdown', () => {
      crearPersonaje(this.raza, this.clase, rol, b.pociones.regaloAlCrear); // con unas pociones de regalo
      const red = redActual();
      if (red && red.conectado) red.presentarme(); // el compañero se entera
      this.tweens.add({ targets: boton, scale: 1.1, duration: 150, yoyo: true });
      this.cameras.main.fadeOut(350);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('EscenaPersonaje', {
        volverA: this.volverA, datosVolver: this.datosVolver,
      }));
    });
  }
}
