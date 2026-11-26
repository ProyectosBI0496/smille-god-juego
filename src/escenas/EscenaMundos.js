// =============================================================
// Mapa de mundos (Etapa 6)
// Una tarjeta por mundo de balance.json. Los mundos superados
// tienen ✓, el siguiente está abierto y los demás tienen candado.
// =============================================================

import { crearTexturas } from '../graficos/Texturas.js';
import { crearVineta, reiniciarAlCambiarTamano } from '../ui/Pantalla.js';
import { crearTexturasMundo, color } from '../graficos/TexturasMundo.js';
import { crearMonstruos, texturaMonstruo } from '../graficos/TexturasMonstruos.js';
import { FUENTE_TITULO } from './EscenaArena.js';
import { mundosSuperados, personaje, dificultadSuperada } from '../datos/Progreso.js';
import { redActual } from '../red/Red.js';
import { crearMiHeroe } from '../ui/MiHeroe.js';
import { mostrarTutorial } from '../ui/Tutorial.js'; // v0.1.16: guía con flechas

export default class EscenaMundos extends Phaser.Scene {
  constructor() {
    super('EscenaMundos');
  }

  /** v0.1.6: "data.pagina" llega al cambiar de página; si no viene, se elige sola */
  init(data) {
    this.pagina = data ? data.pagina : undefined;
  }

  create() {
    // v0.1.2: sin personaje no se puede jugar: primero hay que crearlo
    if (!personaje()) {
      this.scene.start('EscenaHeroe');
      return;
    }
    crearTexturas(this);
    const W = this.scale.baseSize.width;
    const H = this.scale.baseSize.height;
    this.balance = this.cache.json.get('balance');
    const mundos = this.balance.mundos;
    const superados = mundosSuperados(this.balance.dificultades.lista.length); // v0.1.9: mundos con 5 ★

    this.cameras.main.fadeIn(300);
    this.add.tileSprite(0, 0, W, H, 'baldosa-0').setOrigin(0).setTint(0x6a6a80);
    crearVineta(this);
    reiniciarAlCambiarTamano(this); // si cambia el tamaño de la pantalla, se rearma

    // En grupo (Etapa 9; v0.1.9: hasta 3): solo el anfitrión elige; se les avisa a los invitados
    const red = redActual();
    this.enPareja = !!(red && red.esAnfitrion && red.conectado);
    if (red && red.esAnfitrion) {
      red.enPartida = false; // en el mapa todavía puede entrar alguien con el código
      const grupo = this.balance.grupo[String(red.cantidad)];
      const texto = this.enPareja
        ? `${grupo ? grupo.nombre : 'Grupo'} ✓ — entran contigo: ${red.nombresOtros()}`
        : `Sala ${red.codigo} abierta — esperando jugadores`;
      this.add.text(W / 2, 128, texto, {
        fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#a5d6a7', stroke: '#05070d', strokeThickness: 4,
      }).setOrigin(0.5);
      // Si alguien entra o sale, se rearma la pantalla (con la misma página)
      const rearmar = () => this.scene.restart({ pagina: this.pagina });
      red.escuchar(this, 'lista', rearmar);
      red.escuchar(this, 'desconectado', rearmar);
    }

    this.add.text(W / 2, 70, 'Elige tu mundo', {
      fontFamily: FUENTE_TITULO, fontSize: '60px', color: '#f5c542', fontStyle: 'bold',
      stroke: '#3a1500', strokeThickness: 8,
    }).setOrigin(0.5);

    // v0.1.6: 12 mundos no caben en fila: van en PÁGINAS de 4.
    // Se abre en la página del mundo que toca jugar (el primero sin superar).
    const porPagina = 4;
    const paginas = Math.ceil(mundos.length / porPagina);
    if (this.pagina === undefined) this.pagina = Math.min(Math.floor(superados / porPagina), paginas - 1);
    const visibles = mundos.slice(this.pagina * porPagina, (this.pagina + 1) * porPagina);

    // Tarjetas en fila, centradas
    const anchoTarjeta = 250;
    const separacion = 30;
    const total = visibles.length * anchoTarjeta + (visibles.length - 1) * separacion;
    const x0 = (W - total) / 2 + anchoTarjeta / 2;

    visibles.forEach((mundo, k) => {
      const i = this.pagina * porPagina + k; // índice real del mundo
      crearTexturasMundo(this, mundo);
      crearMonstruos(this, mundo); // v0.1.7: el jefe propio de cada mundo
      const estado = i < superados ? 'superado' : i === superados ? 'abierto' : 'bloqueado';
      this.crearTarjeta(x0 + k * (anchoTarjeta + separacion), 370, anchoTarjeta, mundo, i, estado);
    });

    // Flechas para cambiar de página y "1 / 3"
    if (paginas > 1) {
      const estilo = { fontFamily: FUENTE_TITULO, fontSize: '56px', fontStyle: 'bold', stroke: '#05070d', strokeThickness: 6 };
      this.add.text(W / 2, 580, `${this.pagina + 1} / ${paginas}`, { ...estilo, fontSize: '26px', color: '#ffffff' }).setOrigin(0.5);
      for (const [x, texto, cambio] of [[34, '‹', -1], [W - 34, '›', 1]]) {
        const destino = this.pagina + cambio;
        const activa = destino >= 0 && destino < paginas;
        const flecha = this.add.text(x, 370, texto, { ...estilo, color: activa ? '#f5c542' : '#444444' }).setOrigin(0.5);
        if (!activa) continue;
        flecha.setInteractive().on('pointerdown', () => {
          this.scene.restart({ pagina: destino }); // se rearma la pantalla con la otra página
        });
      }
    }

    // Mi personaje (abajo a la derecha): al tocarlo se abre su ficha (nivel, estadísticas)
    crearMiHeroe(this, W - 24, H - 60, () => this.scene.start('EscenaPersonaje'));

    // Botón para volver (a la ficha del personaje)
    const volver = this.add.text(30, H - 30, '← Volver', {
      fontFamily: FUENTE_TITULO, fontSize: '28px', color: '#f5c542', stroke: '#05070d', strokeThickness: 4,
    }).setOrigin(0, 1).setInteractive();
    volver.on('pointerdown', () => this.scene.start('EscenaPersonaje'));

    // v0.1.16: guía con flechas (la primera vez)
    mostrarTutorial(this, 'mundos', [
      { texto: 'El MAPA: cada mundo es una mazmorra con sus propios monstruos y su jefe.', objetivo: { texto: 'Elige tu mundo' } },
      { texto: `Las ESTRELLAS son las dificultades que superaste en ese mundo. Con las ${this.balance.dificultades.lista.length} ★ se abre el mundo siguiente.`, objetivo: () => this.children.list.find((o) => o.type === 'Text' && /[★☆]/.test(o.text)) },
      { texto: 'Aquí dice cuántas oleadas y cuántos jefes tiene. Toca el mundo para elegir la dificultad.', objetivo: { texto: 'oleadas ·' } },
    ]);
  }

  /** Una tarjeta: vista del suelo del mundo, nombre, jefes y su estado */
  crearTarjeta(x, y, ancho, mundo, indice, estado) {
    const alto = 340;
    const bloqueado = estado === 'bloqueado';

    // Vista previa: el suelo real del mundo, repetido
    const vista = this.add.tileSprite(x, y - 40, ancho - 20, 200, `suelo-${mundo.id}-1`);
    const deco = mundo.decoracionPorSala[0];
    const adorno = this.add.image(x, y - 40, `deco-${mundo.id}-${deco.tipo}`).setScale(1.2);
    // v0.1.7: el dibujo del jefe propio del mundo (con sus ojos)
    const datosJefe = mundo.monstruos && mundo.monstruos.jefe;
    const texJefe = datosJefe ? texturaMonstruo(mundo.id, 'jefe') : 'jefe';
    const jefe = this.add.image(x + 60, y - 60, texJefe).setScale(0.5).setTint(color(mundo.colores.jefe));
    const ojosJefe = this.add.image(x + 60, y - 60, `${texJefe}-ojos`).setScale(0.5);
    this.add.rectangle(x, y, ancho, alto).setStrokeStyle(4, bloqueado ? 0x555555 : 0xf5c542);

    this.add.text(x, y + 90, mundo.nombre, {
      // v0.1.6: los nombres largos ("Trono de Smille") con letra más chica para que quepan
      fontFamily: FUENTE_TITULO, fontSize: mundo.nombre.length > 10 ? '24px' : '34px', fontStyle: 'bold',
      color: bloqueado ? '#777777' : '#f5c542', stroke: '#05070d', strokeThickness: 5,
    }).setOrigin(0.5);
    const jefes = Math.floor(mundo.oleadas / mundo.oleadasPorJefe);
    // v0.1.4: estrellas = dificultades superadas (★★☆☆☆ = Veterano superado)
    const total = this.balance.dificultades.lista.length;
    const superada = dificultadSuperada(indice);
    this.add.text(x, y - alto / 2 + 22, '★'.repeat(superada) + '☆'.repeat(total - superada), {
      fontFamily: 'Arial, sans-serif', fontSize: '24px', color: bloqueado ? '#777777' : '#f5c542',
      stroke: '#05070d', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(5);
    this.add.text(x, y + 132, `${mundo.oleadas} oleadas · ${jefes} ${jefes === 1 ? 'jefe' : 'jefes'}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '20px', color: bloqueado ? '#777777' : '#ffffff',
      stroke: '#05070d', strokeThickness: 3,
    }).setOrigin(0.5);
    // v0.1.7: el nombre del jefe del mundo (antes decía el cofre; ahora el cofre sale al azar)
    if (datosJefe) {
      this.add.text(x, y + 160, `Jefe: ${datosJefe.nombre}`, {
        fontFamily: 'Arial, sans-serif', fontSize: datosJefe.nombre.length > 18 ? '15px' : '18px',
        color: bloqueado ? '#777777' : '#ffab91', stroke: '#05070d', strokeThickness: 3,
      }).setOrigin(0.5);
    }

    if (bloqueado) {
      // Oscurecemos la vista y dibujamos un candado
      for (const objeto of [vista, adorno, jefe, ojosJefe]) objeto.setTint(0x333333);
      const g = this.add.graphics();
      g.lineStyle(8, 0xbbbbbb).strokeCircle(x, y - 62, 22);
      g.fillStyle(0xbbbbbb).fillRoundedRect(x - 34, y - 58, 68, 52, 8);
      g.fillStyle(0x333333).fillCircle(x, y - 36, 7);
      // v0.1.9: se abre solo con las 5 estrellas del mundo anterior
      const anterior = this.balance.mundos[indice - 1];
      if (anterior) {
        this.add.text(x, y + 10, `Completa las ${total} ★\nde ${anterior.nombre}`, {
          fontFamily: 'Arial, sans-serif', fontSize: '17px', color: '#ffe082', align: 'center',
          stroke: '#05070d', strokeThickness: 4,
        }).setOrigin(0.5);
      }
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

    // Toda la tarjeta es un botón: abre el panel para elegir la DIFICULTAD (v0.1.4)
    const zona = this.add.zone(x, y, ancho, alto).setInteractive();
    zona.on('pointerdown', () => this.elegirDificultad(mundo, indice));
  }

  /**
   * v0.1.4: panel con las 5 dificultades del mundo. Mismas oleadas y mismo jefe,
   * pero más fuertes (y con mejores premios). Se abren de a una: para jugar
   * "Campeón" hay que superar antes "Veterano" en ESE mundo.
   */
  elegirDificultad(mundo, indice) {
    const W = this.scale.baseSize.width;
    const H = this.scale.baseSize.height;
    const lista = this.balance.dificultades.lista;
    const superada = dificultadSuperada(indice);
    const panel = this.add.container(0, 0).setDepth(200); // un "contenedor" agrupa todo para borrarlo junto

    // Fondo oscuro que tapa el mapa (tocarlo cierra el panel)
    const fondo = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75).setInteractive();
    fondo.on('pointerdown', () => panel.destroy());
    panel.add(fondo);
    panel.add(this.add.text(W / 2, 60, `${mundo.nombre}: elige la dificultad`, {
      fontFamily: FUENTE_TITULO, fontSize: '44px', color: '#f5c542', fontStyle: 'bold', stroke: '#3a1500', strokeThickness: 7,
    }).setOrigin(0.5));
    panel.add(this.add.text(W / 2, 104, 'Mismas oleadas y mismo jefe, pero más fuertes. Mejores premios.', {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#d0d8e0', fontStyle: 'italic',
    }).setOrigin(0.5));

    const anchoBoton = Math.min(560, W - 80);
    const altoBoton = Math.min(84, (H - 220) / lista.length - 12);
    lista.forEach((d, i) => {
      const nivel = i + 1;
      const abierta = nivel <= superada + 1;
      const y = 150 + i * (altoBoton + 12) + altoBoton / 2;
      const boton = this.add.rectangle(W / 2, y, anchoBoton, altoBoton, 0x0b0f1a, abierta ? 0.95 : 0.6)
        .setStrokeStyle(3, abierta ? color(d.color) : 0x555555);
      const hecha = nivel <= superada ? '  ✓' : '';
      const titulo = this.add.text(W / 2 - anchoBoton / 2 + 24, y - 14, `${nivel}. ${d.nombre}${hecha}`, {
        fontFamily: FUENTE_TITULO, fontSize: '28px', fontStyle: 'bold', color: abierta ? d.color : '#777777',
      }).setOrigin(0, 0.5);
      // v0.1.9: si el mundo trae sus números del Excel, se muestran (❤️ vida, ⚔️ daño)
      const k = i;
      const multJefe = this.balance.jefe.multDanio || 1;
      const conExcel = mundo.vidaEnemigos && mundo.vidaJefes;
      const detalle = abierta
        ? (conExcel
          ? `Monstruos ❤️${mundo.vidaEnemigos[k]} ⚔️${mundo.danioEnemigos[k]} · Jefe ❤️${mundo.vidaJefes[k]} ⚔️${Math.round(mundo.danioJefes[k] * multJefe)}`
          : `Vida ×${d.vida} · Daño ×${d.danio} · Premios ×${d.premios}`)
        : `🔒 Supera ${lista[i - 1].nombre} para abrirla`;
      const texto = this.add.text(W / 2 - anchoBoton / 2 + 24, y + 18, detalle, {
        fontFamily: 'Arial, sans-serif', fontSize: '16px', color: abierta ? '#cfd8dc' : '#777777',
      }).setOrigin(0, 0.5);
      panel.add([boton, titulo, texto]);
      if (!abierta) return;
      boton.setInteractive().on('pointerdown', () => this.jugar(indice, nivel));
    });

    // v0.1.16: guía con flechas (la primera vez que se abre este panel)
    mostrarTutorial(this, 'dificultad', [
      { texto: 'Empieza por la PRIMERA dificultad. Aquí ves la vida ❤️ y el daño ⚔️ de los monstruos y del jefe.', objetivo: { texto: '1. ' } },
      { texto: 'Las siguientes se abren al superar la anterior: más difíciles, pero con mejores premios. Toca una para entrar.', objetivo: { texto: '2. ' } },
    ]);
  }

  /** Entra a la mazmorra. En pareja, el invitado entra también (con la misma dificultad) */
  jugar(indice, dificultad) {
    this.cameras.main.fadeOut(300);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (this.enPareja) redActual().enviar({ t: 'iniciar', mundo: indice, dificultad });
      this.scene.start('EscenaArena', { mundo: indice, dificultad, coop: this.enPareja });
    });
  }
}
