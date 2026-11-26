// =============================================================
// Sala para jugar en grupo (Etapa 9; v0.1.9: hasta 3 jugadores)
//   - "Crear sala": muestra un código de 4 números y espera al compañero.
//   - "Unirme": un teclado de números para escribir el código.
// Al conectarse, cada uno le cuenta al otro su raza ("hola").
// El anfitrión elige el mundo en el mapa; el invitado espera aquí.
// =============================================================

import { crearTexturas } from '../graficos/Texturas.js';
import { crearVineta, reiniciarAlCambiarTamano } from '../ui/Pantalla.js';
import { FUENTE_TITULO } from './EscenaArena.js';
import { personaje } from '../datos/Progreso.js';
import { crearEditorNick } from '../ui/EditorNick.js';
import { crearMiHeroe } from '../ui/MiHeroe.js';
import Red, { redActual, MAX_JUGADORES } from '../red/Red.js';

export default class EscenaSala extends Phaser.Scene {
  constructor() {
    super('EscenaSala');
  }

  init(datos) {
    this.esperando = !!(datos && datos.esperando); // el invitado vuelve aquí entre partidas
  }

  create() {
    crearTexturas(this);
    const W = this.scale.baseSize.width;
    const H = this.scale.baseSize.height;
    this.cx = W / 2;
    this.add.tileSprite(0, 0, W, H, 'baldosa-1').setOrigin(0).setTint(0x6a6a80);
    crearVineta(this);
    reiniciarAlCambiarTamano(this, () => !redActual()); // con una sala abierta no se rearma
    this.add.text(this.cx, 60, 'Jugar en grupo', {
      fontFamily: FUENTE_TITULO, fontSize: '56px', color: '#f5c542', fontStyle: 'bold',
      stroke: '#3a1500', strokeThickness: 8,
    }).setOrigin(0.5);
    this.mensaje = this.add.text(this.cx, 135, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#ffffff', align: 'center',
      stroke: '#05070d', strokeThickness: 4,
    }).setOrigin(0.5);
    this.capa = this.add.container(0, 0); // aquí va lo que cambia según el paso

    const volver = this.add.text(24, H - 20, '← Salir', {
      fontFamily: FUENTE_TITULO, fontSize: '26px', color: '#f5c542', stroke: '#05070d', strokeThickness: 4,
    }).setOrigin(0, 1).setInteractive();
    volver.on('pointerdown', () => {
      if (redActual()) redActual().cerrar();
      this.scene.start('EscenaTitulo');
    });

    this.crearMiHeroe(W, H);
    const red0 = redActual();
    crearEditorNick(this, W - 24, 24, { esperando: !!(red0 && red0.conectado && !red0.esAnfitrion) });

    const red = redActual();
    if (this.esperando && red && red.conectado) {
      this.escucharPartida(red);
      this.decir('Conectado ✓\nEsperando que el anfitrión elija el mundo...');
      return;
    }
    this.decir('Los dos celulares necesitan internet.\nFunciona mejor si están en el mismo Wi-Fi.');
    this.mostrarOpciones();
  }

  decir(texto) {
    this.mensaje.setText(texto);
  }

  /** Abajo a la derecha: mi personaje y el botón para ver su ficha (o crearlo) */
  crearMiHeroe(W, H) {
    crearMiHeroe(this, W - 24, H - 55, () => {
      const red = redActual();
      const conectado = !!(red && red.conectado);
      // Si ya está conectado como invitado, vuelve a esperar; si no, vuelve a la sala desde cero
      const datos = { volverA: 'EscenaSala', datosVolver: { esperando: conectado && !red.esAnfitrion } };
      this.scene.start(personaje() ? 'EscenaPersonaje' : 'EscenaHeroe', datos);
    });
  }

  /** Botón grande reutilizable; lo agrega a la capa actual */
  boton(x, y, texto, accion, ancho = 360) {
    const fondo = this.add.rectangle(x, y, ancho, 90, 0xf5c542).setStrokeStyle(4, 0xfff3c4).setInteractive();
    const letras = this.add.text(x, y, texto, {
      fontFamily: FUENTE_TITULO, fontSize: '34px', color: '#1a0f00', fontStyle: 'bold',
    }).setOrigin(0.5);
    fondo.on('pointerdown', accion);
    this.capa.add([fondo, letras]);
    return fondo;
  }

  mostrarOpciones() {
    this.capa.removeAll(true);
    if (!personaje()) {
      this.decir('Primero crea tu personaje (abajo a la derecha).');
      return;
    }
    this.boton(this.cx, 330, 'Crear sala', () => this.crearSala());
    this.boton(this.cx, 460, 'Unirme', () => this.mostrarTeclado());
  }

  // ---------------- ANFITRIÓN ----------------
  crearSala() {
    this.capa.removeAll(true);
    this.decir('Creando la sala...');
    this.botonJugar = null;  // v0.1.9: aparece cuando entra el primer compañero
    this.textoEspera = null;
    const red = new Red();
    red.crearSala(
      (codigo) => {
        this.decir(`Pásales este código a tus compañeros (hasta ${MAX_JUGADORES - 1}):`);
        this.capa.add(this.add.text(this.cx, 330, codigo, {
          fontFamily: FUENTE_TITULO, fontSize: '140px', color: '#ffffff', fontStyle: 'bold',
          stroke: '#3a1500', strokeThickness: 10,
        }).setOrigin(0.5));
        const espera = this.add.text(this.cx, 470, 'Esperando jugadores...', {
          fontFamily: 'Arial, sans-serif', fontSize: '24px', color: '#c8d3e0',
        }).setOrigin(0.5);
        this.tweens.add({ targets: espera, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });
        this.capa.add(espera);
        this.textoEspera = espera;
      },
      (error) => this.fallo(error),
    );
    // v0.1.9: hasta 3 jugadores. Cada vez que alguien entra (o sale), se muestra la lista
    // y el botón "Jugar"; el anfitrión decide cuándo empezar.
    red.escuchar(this, 'conectado', () => red.difundirLista()); // el recién llegado recibe la lista
    red.escuchar(this, 'lista', () => this.mostrarGrupo(red));
    red.escuchar(this, 'desconectado', () => this.mostrarGrupo(red));
  }

  /** ANFITRIÓN: quiénes están y el botón para ir al mapa */
  mostrarGrupo(red) {
    const otros = red.otros();
    if (!otros.length) return;
    const faltan = MAX_JUGADORES - red.cantidad;
    this.decir(`Conectado con ${red.nombresOtros()} ✓  (${red.cantidad} de ${MAX_JUGADORES})`);
    if (this.textoEspera) {
      this.textoEspera.setText(faltan > 0 ? `Puede entrar ${faltan} más con el mismo código...` : '¡Sala llena!');
    }
    if (!this.botonJugar) {
      this.botonJugar = this.boton(this.cx, 560, 'Jugar', () => this.scene.start('EscenaMundos'));
    }
  }

  // ---------------- INVITADO ----------------
  mostrarTeclado() {
    this.capa.removeAll(true);
    this.decir('Escribe el código de la sala:');
    this.codigo = '';
    const pantalla = this.add.text(this.cx, 215, '_ _ _ _', {
      fontFamily: FUENTE_TITULO, fontSize: '64px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#05070d', strokeThickness: 6,
    }).setOrigin(0.5);
    this.capa.add(pantalla);
    const mostrar = () => pantalla.setText(this.codigo.padEnd(4, '_').split('').join(' '));

    // Teclado de 3 columnas: 1-9, borrar, 0, entrar
    const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];
    teclas.forEach((tecla, i) => {
      const x = this.cx + ((i % 3) - 1) * 130;
      const y = 320 + Math.floor(i / 3) * 95;
      const fondo = this.add.rectangle(x, y, 115, 80, tecla === '✓' ? 0x66bb6a : 0x0b0f1a, 0.9)
        .setStrokeStyle(3, 0xf5c542).setInteractive();
      const letra = this.add.text(x, y, tecla, {
        fontFamily: 'Arial, sans-serif', fontSize: '40px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      fondo.on('pointerdown', () => {
        if (tecla === '⌫') this.codigo = this.codigo.slice(0, -1);
        else if (tecla === '✓') { if (this.codigo.length === 4) this.unirse(this.codigo); return; }
        else if (this.codigo.length < 4) this.codigo += tecla;
        mostrar();
      });
      this.capa.add([fondo, letra]);
    });
  }

  unirse(codigo) {
    this.capa.removeAll(true);
    this.decir(`Conectando a la sala ${codigo}...`);
    const red = new Red();
    red.unirse(codigo, (error) => this.fallo(error));
    red.escuchar(this, 'conectado', () => red.presentarme('hola'));
    // v0.1.9: el anfitrión manda la lista de todos los jugadores
    red.escuchar(this, 'lista', () => {
      this.decir(`Conectado con ${red.nombresOtros() || 'el anfitrión'} ✓\nEsperando que el anfitrión elija el mundo...`);
    });
    this.escucharPartida(red);
  }

  /** El invitado espera a que el anfitrión empiece una partida */
  escucharPartida(red) {
    red.escuchar(this, 'iniciar', (m) => this.scene.start('EscenaArena', { mundo: m.mundo, dificultad: m.dificultad, coop: true, invitado: true }));
    red.escuchar(this, 'desconectado', () => this.fallo({ type: 'desconectado' }));
  }

  fallo(error) {
    const textos = {
      'peer-unavailable': 'No existe una sala con ese código.',
      'network': 'No hay conexión a internet.',
      'desconectado': 'El anfitrión se desconectó.',
      'llena': 'La sala está llena (máximo 3) o ya está jugando.',
    };
    this.decir(`${textos[error.type] || 'No se pudo conectar.'}\nPrueba de nuevo.`);
    if (redActual()) redActual().cerrar();
    this.mostrarOpciones();
  }
}
