// =============================================================
// Guía "Cómo se juega" (v0.1.15)
// Muestra las páginas de datos/guia.js una por una, con botones
// "◀ Anterior" y "Siguiente ▶" (o las flechas del teclado).
// Se abre desde la pantalla de título.
// =============================================================

import { crearTexturas } from '../graficos/Texturas.js';
import { crearVineta, reiniciarAlCambiarTamano } from '../ui/Pantalla.js';
import { FUENTE_TITULO } from './EscenaArena.js';
import { paginasGuia } from '../datos/guia.js';
import { seguirPareja } from '../red/Red.js';

export default class EscenaGuia extends Phaser.Scene {
  constructor() {
    super('EscenaGuia');
  }

  // pagina: la que se estaba viendo (por si la escena se rearma al cambiar el tamaño)
  init(datos) {
    this.pagina = (datos && datos.pagina) || 0;
  }

  create() {
    crearTexturas(this);
    const W = this.scale.baseSize.width;
    const H = this.scale.baseSize.height;
    const cx = W / 2;
    this.paginas = paginasGuia(this.cache.json.get('balance'));

    this.add.tileSprite(0, 0, W, H, 'baldosa-1').setOrigin(0).setTint(0x55556a);
    crearVineta(this);
    reiniciarAlCambiarTamano(this);

    this.add.text(cx, 50, 'CÓMO SE JUEGA', {
      fontFamily: FUENTE_TITULO, fontSize: '48px', color: '#f5c542', fontStyle: 'bold',
      stroke: '#3a1500', strokeThickness: 8,
    }).setOrigin(0.5);

    // El panel donde va el texto de la página
    const ancho = Math.min(1000, W - 60);
    this.add.rectangle(cx, H / 2 + 10, ancho, H - 200, 0x0b0f1a, 0.85).setStrokeStyle(2, 0xf5c542, 0.6);
    this.tituloPagina = this.add.text(cx, 125, '', {
      fontFamily: FUENTE_TITULO, fontSize: '34px', color: '#ffe082', fontStyle: 'bold',
      stroke: '#05070d', strokeThickness: 5,
    }).setOrigin(0.5, 0);
    this.textoPagina = this.add.text(cx - ancho / 2 + 30, 185, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '21px', color: '#eceff1', lineSpacing: 7,
      wordWrap: { width: ancho - 60 },
    });

    // Abajo: anterior, número de página, siguiente
    const estilo = { fontFamily: FUENTE_TITULO, fontSize: '28px', fontStyle: 'bold', color: '#f5c542', stroke: '#05070d', strokeThickness: 4 };
    this.anterior = this.add.text(cx - 220, H - 50, '◀ Anterior', estilo).setOrigin(0.5).setInteractive();
    this.siguiente = this.add.text(cx + 220, H - 50, 'Siguiente ▶', estilo).setOrigin(0.5).setInteractive();
    this.numero = this.add.text(cx, H - 50, '', { ...estilo, fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
    this.anterior.on('pointerdown', () => this.irA(this.pagina - 1));
    this.siguiente.on('pointerdown', () => this.irA(this.pagina + 1));
    this.input.keyboard.on('keydown-LEFT', () => this.irA(this.pagina - 1));
    this.input.keyboard.on('keydown-RIGHT', () => this.irA(this.pagina + 1));

    const volver = this.add.text(24, H - 14, '← Volver', {
      fontFamily: FUENTE_TITULO, fontSize: '26px', color: '#f5c542', stroke: '#05070d', strokeThickness: 4,
    }).setOrigin(0, 1).setInteractive();
    volver.on('pointerdown', () => this.scene.start('EscenaTitulo'));
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('EscenaTitulo'));
    seguirPareja(this); // en grupo: si el anfitrión empieza la partida, el invitado entra aunque esté leyendo

    this.irA(this.pagina);
  }

  /** Muestra la página n (si existe) */
  irA(n) {
    if (n < 0 || n >= this.paginas.length) return;
    this.pagina = n;
    this.sys.settings.data = { pagina: n }; // si la escena se rearma, vuelve a esta página
    const p = this.paginas[n];
    this.tituloPagina.setText(`${p.icono}  ${p.titulo}`);
    this.textoPagina.setText(p.texto);
    this.numero.setText(`${n + 1} / ${this.paginas.length}`);
    // En la primera página no hay "Anterior"; en la última, no hay "Siguiente"
    this.anterior.setAlpha(n > 0 ? 1 : 0.25);
    this.siguiente.setAlpha(n < this.paginas.length - 1 ? 1 : 0.25);
  }
}
