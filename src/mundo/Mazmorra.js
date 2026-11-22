// =============================================================
// Mazmorra (Etapa 6, ajuste D-025)
// Construye el recorrido de un mundo: salas en fila, unidas por
// pasillos, con muros que CHOCAN y puertas (rejas) que se abren
// al vencer cada sala.
//
//   [Entrada]═══[Sala 1]═══[Sala 2]═══[Sala 3]═══[ SALÓN DEL JEFE ]═══ ...
//
// La escena le pregunta: ¿en qué sala está el héroe?, ¿abre la puerta N?
// =============================================================

export default class Mazmorra {
  /**
   * @param {Phaser.Scene} escena
   * @param {object} mundo  balance.json → mundos[i]
   * @param {object} cfg    balance.json → mazmorra (tamaños)
   */
  constructor(escena, mundo, cfg) {
    this.escena = escena;
    this.mundo = mundo;
    this.cfg = cfg;
    this.T = cfg.grosorMuro;
    this.azar = new Phaser.Math.RandomDataGenerator([mundo.id]); // semilla: siempre igual

    this.planificarSalas();
    // "Grupo estático": cuerpos físicos que no se mueven (muros y puertas)
    this.muros = escena.physics.add.staticGroup();
    this.puertas = [];
    this.salas.forEach((sala, i) => this.construirSala(sala, i));
  }

  /**
   * Decide el orden de las salas: entrada, oleadas, y un salón del jefe
   * cada "oleadasPorJefe" oleadas. También calcula dónde va cada una.
   */
  planificarSalas() {
    const { salaEntrada, sala, salaJefe, pasilloLargo } = this.cfg;
    const m = this.mundo;
    const lista = [{ tipo: 'entrada', tam: salaEntrada }];
    let jefe = 0;
    for (let n = 1; n <= m.oleadas; n++) {
      lista.push({ tipo: 'oleada', numero: n, tam: sala });
      if (n % m.oleadasPorJefe === 0) {
        jefe += 1;
        lista.push({ tipo: 'jefe', numero: jefe, tam: salaJefe });
      }
    }
    this.totalJefes = jefe;

    // Todas las salas comparten la misma línea central (y = medio)
    this.alto = salaJefe[1] + this.T * 2 + 200;
    const medio = this.alto / 2;
    let x = this.T + 100;
    this.salas = lista.map((s) => {
      const [ancho, alto] = s.tam;
      // La entrada no tiene enemigos: empieza "vencida"; las demás esperan al héroe
      const estado = s.tipo === 'entrada' ? 'vencida' : 'esperando';
      const resultado = { ...s, x, y: medio - alto / 2, ancho, alto, medio, estado };
      x += ancho + pasilloLargo;
      return resultado;
    });
    this.ancho = x - pasilloLargo + this.T + 100;
  }

  /** Suelo, adornos, muros (con huecos para las puertas), pasillo y antorchas */
  construirSala(sala, i) {
    const { escena, T } = this;
    const id = this.mundo.id;
    const ultima = i === this.salas.length - 1;
    const pa = this.cfg.pasilloAncho;
    const { x, y, ancho, alto, medio } = sala;

    // SUELO: una TileSprite repite la baldosa; encima, algunas baldosas distintas
    escena.add.tileSprite(x, y, ancho, alto, `suelo-${id}-0`).setOrigin(0).setDepth(0);
    const variantes = Math.round((ancho * alto) / 45000);
    for (let k = 0; k < variantes; k++) {
      const bx = x + this.azar.between(0, Math.floor(ancho / 100) - 1) * 100;
      const by = y + this.azar.between(0, Math.floor(alto / 100) - 1) * 100;
      escena.add.image(bx, by, `suelo-${id}-${this.azar.between(1, 3)}`).setOrigin(0).setDepth(0);
    }

    // ADORNOS (los del salón del jefe son el doble)
    const factor = sala.tipo === 'jefe' ? 2 : sala.tipo === 'entrada' ? 0.5 : 1;
    for (const { tipo, cantidad } of this.mundo.decoracionPorSala) {
      for (let k = 0; k < Math.round(cantidad * factor); k++) {
        const dx = this.azar.between(x + 20, x + ancho - 150);
        const dy = this.azar.between(y + 20, y + alto - 110);
        escena.add.image(dx, dy, `deco-${id}-${tipo}`).setOrigin(0).setDepth(1);
        if (tipo === 'lava') {
          const halo = escena.add.image(dx + 70, dy + 50, 'brillo').setTint(0xff6d00).setScale(2.2)
            .setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
          escena.tweens.add({ targets: halo, alpha: 0.15, duration: Phaser.Math.Between(600, 1100), yoyo: true, repeat: -1 });
        }
      }
    }

    // MUROS de arriba y abajo
    this.muro(x - T, y - T, ancho + T * 2, T);
    this.muro(x - T, y + alto, ancho + T * 2, T);
    // Muro izquierdo: entero en la primera sala; con hueco (de donde viene el pasillo) en las demás
    this.muroLateral(x - T, y, alto, medio, i > 0);
    // Muro derecho: entero en la última sala; con hueco hacia el pasillo en las demás
    this.muroLateral(x + ancho, y, alto, medio, !ultima);

    if (!ultima) {
      // PASILLO hacia la sala siguiente: suelo + muros de arriba y abajo
      const largo = this.cfg.pasilloLargo;
      escena.add.tileSprite(x + ancho, medio - pa / 2, largo, pa, `suelo-${id}-0`).setOrigin(0).setDepth(0);
      this.muro(x + ancho, medio - pa / 2 - T, largo, T);
      this.muro(x + ancho, medio + pa / 2, largo, T);

      // PUERTA (reja) a la salida de la sala. La entrada empieza abierta.
      const puerta = escena.add.tileSprite(x + ancho + T / 2, medio, T, pa, 'reja').setDepth(3);
      escena.physics.add.existing(puerta, true); // true = cuerpo estático
      this.puertas[i] = puerta;
      if (sala.tipo === 'entrada') this.abrirPuerta(i, false);
    }

    // ANTORCHAS en el muro de arriba y de abajo
    if (this.mundo.antorchas) {
      for (const ax of [x + ancho * 0.25, x + ancho * 0.75]) {
        escena.crearAntorcha(ax, y - T / 2);
        escena.crearAntorcha(ax, y + alto + T / 2);
      }
    }
  }

  /** Un bloque de muro: se ve (TileSprite con la textura del muro) y choca (cuerpo estático) */
  muro(x, y, ancho, alto) {
    // El cuerpo estático se ubica según el CENTRO del objeto: usamos origen 0.5
    const bloque = this.escena.add.tileSprite(x + ancho / 2, y + alto / 2, ancho, alto, `muro-${this.mundo.id}`).setDepth(2);
    this.muros.add(bloque);
  }

  /** Muro vertical; si "conHueco", deja un espacio en el medio para el pasillo */
  muroLateral(x, y, alto, medio, conHueco) {
    const { T } = this;
    if (!conHueco) {
      this.muro(x, y - T, T, alto + T * 2);
      return;
    }
    const pa = this.cfg.pasilloAncho;
    this.muro(x, y - T, T, medio - pa / 2 - (y - T));          // parte de arriba
    this.muro(x, medio + pa / 2, T, y + alto + T - (medio + pa / 2)); // parte de abajo
  }

  /** Abre la reja de la sala "i": se desliza hacia arriba y deja de chocar */
  abrirPuerta(i, conAnimacion = true) {
    const puerta = this.puertas[i];
    if (!puerta || !puerta.body.enable) return;
    puerta.body.enable = false;
    if (!conAnimacion) {
      puerta.setVisible(false);
      return;
    }
    this.escena.tweens.add({ targets: puerta, scaleY: 0.05, alpha: 0.3, y: puerta.y - this.cfg.pasilloAncho / 2, duration: 500 });
  }

  /** Índice de la sala en la que está el punto (x, y), o -1 si está en un pasillo */
  salaEn(x, y) {
    return this.salas.findIndex((s) => x >= s.x && x <= s.x + s.ancho && y >= s.y && y <= s.y + s.alto);
  }
}
