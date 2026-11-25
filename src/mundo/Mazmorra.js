// =============================================================
// Mazmorra (Etapa 6 de la Fase 0, rehecha en la Fase 1, Etapa 6 — D-039)
// Construye el recorrido de un mundo: salas unidas por pasillos, con
// muros que CHOCAN y puertas (rejas) que se abren al vencer salas.
//
// v0.1.6: las salas ya no van solo en fila. Se ubican en una CUADRÍCULA
// (columnas y filas) y cada mundo elige una FORMA en balance.json → mundos[i].forma:
//
//   linea      E─1─2─3─J                     (todo hacia la derecha)
//   escalera   sube en diagonal: derecha, arriba, derecha, arriba...
//   serpiente  va y vuelve: derecha → baja → izquierda → baja...
//   espiral    se enrolla hacia el centro; el último jefe está al medio
//   laberinto  un camino al azar (con semilla) que se retuerce en un cuadrado
//   cruz       una PLAZA central con dos brazos opuestos (izquierda y derecha),
//              cada uno con su jefe; la puerta de arriba, hacia el último jefe,
//              se abre solo cuando caen los DOS jefes de los brazos.
//
// Cada sala sabe quién es su "padre" (la sala de la que viene su pasillo) y
// qué salas hay que vencer para que se abra SU puerta ("requiere").
// Los pasillos siempre son rectos (horizontales o verticales): los choques de
// Phaser (Arcade) usan rectángulos. Lo diagonal o curvo sale de cómo se ubican las salas.
//
// La escena le pregunta: ¿en qué sala está el héroe?, ¿este punto está libre?,
// y le avisa: "vencí la sala N" (vencerSala) para que abra las puertas que tocan.
// =============================================================

// Hacia dónde se mueve cada paso en la cuadrícula: [columna, fila]
const DIR = { der: [1, 0], izq: [-1, 0], arr: [0, -1], aba: [0, 1] };

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
    this.puertas = []; // puertas[i] = la reja a la ENTRADA de la sala i (la entrada no tiene)
    this.salas.forEach((sala, i) => this.construirSala(sala, i));
    this.salas.forEach((sala, i) => { if (sala.padre >= 0) this.construirPasillo(sala, i); });
    this.actualizarPuertas(false); // abre (sin animación) la puerta de la primera sala
  }

  // =============================================================
  // 1. PLANO: qué salas hay y en qué celda va cada una
  // =============================================================

  planificarSalas() {
    const { salaEntrada, tamanosSala, formas, formasJefe, salaJefe, pasilloLargo } = this.cfg;
    const m = this.mundo;

    // La SECUENCIA: oleadas, y un salón del jefe cada "oleadasPorJefe" oleadas
    const secuencia = [];
    let jefe = 0;
    for (let n = 1; n <= m.oleadas; n++) {
      // azar.pick elige un elemento de la lista (siempre el mismo gracias a la semilla)
      secuencia.push({ tipo: 'oleada', numero: n, tam: this.azar.pick(tamanosSala), forma: this.azar.pick(formas) });
      if (n % m.oleadasPorJefe === 0) {
        jefe += 1;
        secuencia.push({ tipo: 'jefe', numero: jefe, tam: salaJefe, forma: this.azar.pick(formasJefe) });
      }
    }
    this.totalJefes = jefe;

    // La FORMA decide la celda de cada sala. Si algo falla, se usa la línea de siempre.
    const forma = m.forma || 'linea';
    const generador = this[`forma_${forma}`] ? `forma_${forma}` : 'forma_linea';
    let nodos = this[generador](secuencia);
    if (!nodos) nodos = this.forma_linea(secuencia);

    // Normalizamos: que la celda más a la izquierda/arriba sea la (0, 0)
    const minCol = Math.min(...nodos.map((n) => n.col));
    const minFila = Math.min(...nodos.map((n) => n.fila));
    const columnas = Math.max(...nodos.map((n) => n.col)) - minCol + 1;
    const filas = Math.max(...nodos.map((n) => n.fila)) - minFila + 1;

    // Todas las celdas miden lo mismo: la sala más grande + un pasillo
    const tamanos = [salaEntrada, salaJefe, ...tamanosSala];
    this.celdaAncho = Math.max(...tamanos.map((t) => t[0])) + pasilloLargo;
    this.celdaAlto = Math.max(...tamanos.map((t) => t[1])) + pasilloLargo;
    const margen = this.T + 100;
    this.ancho = margen * 2 + columnas * this.celdaAncho;
    this.alto = margen * 2 + filas * this.celdaAlto;

    this.salas = nodos.map((n) => {
      const [ancho, alto] = n.tam;
      // Centro de la celda = centro de la sala
      const cx = margen + (n.col - minCol + 0.5) * this.celdaAncho;
      const cy = margen + (n.fila - minFila + 0.5) * this.celdaAlto;
      // La entrada y la plaza no tienen enemigos: empiezan "vencidas"; las demás esperan al héroe
      const estado = n.tipo === 'entrada' || n.tipo === 'plaza' ? 'vencida' : 'esperando';
      return {
        ...n, x: cx - ancho / 2, y: cy - alto / 2, ancho, alto, cx, cy, medio: cy, estado,
        lados: new Set(), // por qué lados sale un pasillo (para dejar el hueco en el muro)
        requiere: n.requiere || (n.padre >= 0 ? [n.padre] : []),
      };
    });

    // Los lados con pasillo: el hijo mira hacia su padre y el padre hacia el hijo
    this.salas.forEach((s) => {
      if (s.padre < 0) return;
      const p = this.salas[s.padre];
      const lado = this.ladoHacia(p, s);
      p.lados.add(lado);
      s.lados.add(OPUESTO[lado]);
      s.ladoEntrada = OPUESTO[lado]; // por aquí entra el héroe a la sala
    });
  }

  /** De qué lado de "a" está "b" (son vecinas en la cuadrícula) */
  ladoHacia(a, b) {
    if (b.col > a.col) return 'der';
    if (b.col < a.col) return 'izq';
    return b.fila > a.fila ? 'aba' : 'arr';
  }

  /**
   * Ayuda común: pone las salas una tras otra siguiendo una lista de pasos.
   * Cada sala es "hija" de la anterior. Devuelve null si dos salas caen en la misma celda.
   */
  porPasos(secuencia, pasos) {
    const nodos = [{ tipo: 'entrada', tam: this.cfg.salaEntrada, forma: 'rect', col: 0, fila: 0, padre: -1 }];
    const ocupadas = new Set(['0,0']);
    for (let i = 0; i < secuencia.length; i++) {
      const anterior = nodos[nodos.length - 1];
      const [dc, df] = DIR[pasos[i]];
      const col = anterior.col + dc;
      const fila = anterior.fila + df;
      if (ocupadas.has(`${col},${fila}`)) return null;
      ocupadas.add(`${col},${fila}`);
      nodos.push({ ...secuencia[i], col, fila, padre: nodos.length - 1 });
    }
    return nodos;
  }

  /** linea: siempre a la derecha (la mazmorra de antes) */
  forma_linea(secuencia) {
    return this.porPasos(secuencia, secuencia.map(() => 'der'));
  }

  /** escalera: derecha, arriba, derecha, arriba... (avanza en diagonal) */
  forma_escalera(secuencia) {
    return this.porPasos(secuencia, secuencia.map((_, i) => (i % 2 === 0 ? 'der' : 'arr')));
  }

  /** serpiente: una fila hacia la derecha, baja, otra hacia la izquierda, baja... */
  forma_serpiente(secuencia) {
    const largo = Math.max(3, Math.ceil(Math.sqrt(secuencia.length + 1))); // salas por fila
    const pasos = [];
    let haciaDerecha = true;
    let enFila = 1; // la entrada ya ocupa el primer lugar de la fila
    for (let i = 0; i < secuencia.length; i++) {
      if (enFila === largo) { // fila llena: bajamos y damos la vuelta
        pasos.push('aba');
        haciaDerecha = !haciaDerecha;
        enFila = 1;
      } else {
        pasos.push(haciaDerecha ? 'der' : 'izq');
        enFila += 1;
      }
    }
    return this.porPasos(secuencia, pasos);
  }

  /**
   * espiral: se arma DESDE EL CENTRO hacia afuera (der 1, aba 1, izq 2, arr 2, der 3...)
   * y después se recorre al revés: así se entra por fuera y el último jefe queda al medio.
   */
  forma_espiral(secuencia) {
    const total = secuencia.length + 1; // + la entrada
    const celdas = [[0, 0]];
    const orden = ['der', 'aba', 'izq', 'arr'];
    let tramo = 1;
    let d = 0;
    while (celdas.length < total) {
      for (let repetir = 0; repetir < 2 && celdas.length < total; repetir++) {
        for (let k = 0; k < tramo && celdas.length < total; k++) {
          const [c, f] = celdas[celdas.length - 1];
          const [dc, df] = DIR[orden[d % 4]];
          celdas.push([c + dc, f + df]);
        }
        d += 1;
      }
      tramo += 1;
    }
    celdas.reverse(); // ahora la primera celda es la de afuera (la entrada)
    return celdas.map(([col, fila], i) => (i === 0
      ? { tipo: 'entrada', tam: this.cfg.salaEntrada, forma: 'rect', col, fila, padre: -1 }
      : { ...secuencia[i - 1], col, fila, padre: i - 1 }));
  }

  /**
   * laberinto: un camino al azar que no se cruza consigo mismo, dentro de un
   * cuadrado chico (así se retuerce mucho). Si se encierra, prueba otra vez.
   */
  forma_laberinto(secuencia) {
    const total = secuencia.length + 1;
    const lado = Math.ceil(Math.sqrt(total * 1.5)); // cuadrado de lado x lado celdas
    for (let intento = 0; intento < 300; intento++) {
      const pasos = [];
      const ocupadas = new Set(['0,0']);
      let c = 0;
      let f = 0;
      for (let i = 0; i < secuencia.length; i++) {
        const libres = Object.keys(DIR).filter((p) => {
          const nc = c + DIR[p][0];
          const nf = f + DIR[p][1];
          return nc >= 0 && nf >= 0 && nc < lado && nf < lado && !ocupadas.has(`${nc},${nf}`);
        });
        if (!libres.length) break; // se encerró: otro intento
        const paso = this.azar.pick(libres);
        pasos.push(paso);
        c += DIR[paso][0];
        f += DIR[paso][1];
        ocupadas.add(`${c},${f}`);
      }
      if (pasos.length === secuencia.length) return this.porPasos(secuencia, pasos);
    }
    return this.forma_serpiente(secuencia); // no encontró camino: plan B
  }

  /**
   * cruz: entrada abajo → (tramos previos hacia arriba) → PLAZA →
   *   brazo izquierdo con su jefe, brazo derecho con su jefe (en caminos opuestos)
   *   y arriba, el último tramo con el jefe final: su puerta se abre al vencer
   *   a los dos jefes de los brazos.
   * Necesita al menos 3 jefes; si hay menos, usa la serpiente.
   */
  forma_cruz(secuencia) {
    // Partimos la secuencia en "tramos": oleadas + su jefe
    const tramos = [];
    let actual = [];
    for (const s of secuencia) {
      actual.push(s);
      if (s.tipo === 'jefe') { tramos.push(actual); actual = []; }
    }
    if (actual.length) {
      if (!tramos.length) tramos.push([]);
      tramos[tramos.length - 1].push(...actual); // oleadas sobrantes: al último tramo
    }
    if (tramos.length < 3) return this.forma_serpiente(secuencia);

    const nodos = [{ tipo: 'entrada', tam: this.cfg.salaEntrada, forma: 'rect', col: 0, fila: 0, padre: -1 }];
    const agregar = (s, col, fila, padre, requiere) => {
      nodos.push({ ...s, col, fila, padre, requiere });
      return nodos.length - 1;
    };
    // 1) Tramos previos (si hay más de 3 jefes): suben en línea recta
    let fila = 0;
    let padre = 0;
    for (const tramo of tramos.slice(0, -3)) {
      for (const s of tramo) padre = agregar(s, 0, --fila, padre);
    }
    // 2) La plaza: una sala sin enemigos donde se cruzan los caminos
    const plaza = agregar({ tipo: 'plaza', tam: this.cfg.salaEntrada, forma: 'rect' }, 0, --fila, padre);
    const filaPlaza = fila;
    // 3) Los dos brazos opuestos
    const [izquierda, derecha, final] = tramos.slice(-3);
    const finDeBrazo = [];
    for (const [tramo, sentido] of [[izquierda, -1], [derecha, 1]]) {
      let p = plaza;
      tramo.forEach((s, k) => { p = agregar(s, sentido * (k + 1), filaPlaza, p); });
      finDeBrazo.push(p); // el jefe al final del brazo
    }
    // 4) Hacia arriba: el tramo final. Su primera puerta pide a los DOS jefes de los brazos.
    let p = plaza;
    final.forEach((s, k) => {
      p = agregar(s, 0, filaPlaza - (k + 1), p, k === 0 ? [plaza, ...finDeBrazo] : undefined);
    });
    return nodos;
  }

  // =============================================================
  // 2. CONSTRUCCIÓN: suelo, adornos, muros, pasillos y puertas
  // =============================================================

  /** Suelo, adornos, muros (con huecos donde sale un pasillo) y antorchas */
  construirSala(sala, i) {
    const { escena, T } = this;
    // Para el "recorte" (ver recortar): anotamos cuántos objetos había antes de esta sala
    const antes = escena.children.list.length;
    const id = this.mundo.id;
    const { x, y, ancho, alto, cx, cy, lados } = sala;

    // SUELO: una TileSprite repite la baldosa; encima, algunas baldosas distintas
    escena.add.tileSprite(x, y, ancho, alto, `suelo-${id}-0`).setOrigin(0).setDepth(0);
    const variantes = Math.round((ancho * alto) / 45000);
    for (let k = 0; k < variantes; k++) {
      const bx = x + this.azar.between(0, Math.floor(ancho / 100) - 1) * 100;
      const by = y + this.azar.between(0, Math.floor(alto / 100) - 1) * 100;
      escena.add.image(bx, by, `suelo-${id}-${this.azar.between(1, 3)}`).setOrigin(0).setDepth(0);
    }

    // FORMA: bloques de muro dentro de la sala
    sala.obstaculos = this.obstaculosDe(sala);
    for (const o of sala.obstaculos) this.muro(o.x, o.y, o.w, o.h);

    // ADORNOS (los del salón del jefe son el doble); no van encima de los bloques
    const factor = sala.tipo === 'jefe' ? 2 : sala.tipo === 'oleada' ? 1 : 0.5;
    for (const { tipo, cantidad } of this.mundo.decoracionPorSala) {
      for (let k = 0; k < Math.round(cantidad * factor); k++) {
        const dx = this.azar.between(x + 20, x + ancho - 150);
        const dy = this.azar.between(y + 20, y + alto - 110);
        if (!this.libre(dx + 50, dy + 40, 80, sala)) continue;
        escena.add.image(dx, dy, `deco-${id}-${tipo}`).setOrigin(0).setDepth(1);
        if (tipo === 'lava') {
          const halo = escena.add.image(dx + 70, dy + 50, 'brillo').setTint(0xff6d00).setScale(2.2)
            .setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
          escena.tweens.add({ targets: halo, alpha: 0.15, duration: Phaser.Math.Between(600, 1100), yoyo: true, repeat: -1 });
        }
      }
    }

    // MUROS de los 4 lados: con un hueco al medio donde sale un pasillo
    this.muroHorizontal(x - T, x + ancho + T, y - T, cx, lados.has('arr'));
    this.muroHorizontal(x - T, x + ancho + T, y + alto, cx, lados.has('aba'));
    this.muroVertical(x - T, y, y + alto, cy, lados.has('izq'));
    this.muroVertical(x + ancho, y, y + alto, cy, lados.has('der'));

    // ANTORCHAS en el muro de arriba y de abajo (lejos del hueco del medio)
    if (this.mundo.antorchas) {
      for (const ax of [x + ancho * 0.2, x + ancho * 0.8]) {
        escena.crearAntorcha(ax, y - T / 2);
        escena.crearAntorcha(ax, y + alto + T / 2);
      }
    }

    sala.objetos = escena.children.list.slice(antes);
    sala.visible = true;
  }

  /**
   * El pasillo entre la sala "i" y su padre: suelo, dos muros a los costados
   * y la PUERTA (reja) pegada a la sala "i" (se abre según sala.requiere).
   */
  construirPasillo(sala, i) {
    const { escena, T } = this;
    const antes = escena.children.list.length;
    const id = this.mundo.id;
    const pa = this.cfg.pasilloAncho;
    const padre = this.salas[this.padreDe(i)];
    const horizontal = sala.fila === padre.fila;
    let puerta;

    if (horizontal) {
      // "a" es la sala de la izquierda y "b" la de la derecha
      const [a, b] = sala.col > padre.col ? [padre, sala] : [sala, padre];
      const x0 = a.x + a.ancho;
      const largo = b.x - x0;
      escena.add.tileSprite(x0, a.cy - pa / 2, largo, pa, `suelo-${id}-0`).setOrigin(0).setDepth(0);
      this.muro(x0, a.cy - pa / 2 - T, largo, T);
      this.muro(x0, a.cy + pa / 2, largo, T);
      // La reja va en el hueco del muro de la sala "i"
      const px = sala === b ? b.x - T / 2 : a.x + a.ancho + T / 2;
      puerta = escena.add.tileSprite(px, a.cy, T, pa, 'reja').setDepth(3);
      puerta.vertical = true; // reja "de pie": al abrirse sube
    } else {
      // "a" es la sala de arriba y "b" la de abajo
      const [a, b] = sala.fila > padre.fila ? [padre, sala] : [sala, padre];
      const y0 = a.y + a.alto;
      const largo = b.y - y0;
      escena.add.tileSprite(a.cx - pa / 2, y0, pa, largo, `suelo-${id}-0`).setOrigin(0).setDepth(0);
      this.muro(a.cx - pa / 2 - T, y0, T, largo);
      this.muro(a.cx + pa / 2, y0, T, largo);
      const py = sala === b ? b.y - T / 2 : a.y + a.alto + T / 2;
      puerta = escena.add.tileSprite(a.cx, py, pa, T, 'reja').setDepth(3);
      puerta.vertical = false; // reja "acostada": al abrirse se corre a un lado
    }
    escena.physics.add.existing(puerta, true); // true = cuerpo estático
    this.puertas[i] = puerta;

    // El pasillo se dibuja junto con la sala "i" (menos la reja, que se maneja aparte)
    sala.objetos.push(...escena.children.list.slice(antes).filter((o) => o !== puerta));
  }

  padreDe(i) {
    return this.salas[i].padre;
  }

  /**
   * RECORTE (optimización, sesión 14): solo se dibujan las salas cerca de la cámara.
   * Ahora mira en las dos direcciones (x e y). El margen es una celda entera,
   * para que el pasillo de una sala se vea aunque la sala todavía no.
   */
  recortar(camara) {
    const v = camara.worldView;
    const mx = this.celdaAncho;
    const my = this.celdaAlto;
    for (const sala of this.salas) {
      const visible = sala.x - mx < v.right && sala.x + sala.ancho + mx > v.x
        && sala.y - my < v.bottom && sala.y + sala.alto + my > v.y;
      if (visible === sala.visible) continue; // no cambió: no hacemos nada
      sala.visible = visible;
      for (const objeto of sala.objetos) objeto.setVisible(visible);
    }
  }

  /**
   * Los bloques que le dan forma a la sala, como rectángulos { x, y, w, h }.
   * Siempre dejan libres las franjas del medio (vertical y horizontal),
   * por donde se entra y se sale, salvo "centro", que pone un bloque al medio que hay que rodear.
   */
  obstaculosDe(sala) {
    const { x, y, ancho, alto, cx, cy } = sala;
    const pa = this.cfg.pasilloAncho;
    const libreX = ancho / 2 - pa / 2 - 30; // ancho máximo de un bloque pegado a un costado
    const libreY = alto / 2 - pa / 2 - 30;  // alto máximo de un bloque pegado arriba o abajo
    const B = [];
    switch (sala.forma) {
      case 'columnas': {
        const lado = sala.tipo === 'jefe' ? 110 : 80;
        for (const fx of [0.28, 0.72]) {
          for (const fy of [0.28, 0.72]) B.push({ x: x + ancho * fx - lado / 2, y: y + alto * fy - lado / 2, w: lado, h: lado });
        }
        break;
      }
      case 'cruz': { // las 4 esquinas tapadas
        const w = Math.min(ancho * 0.28, libreX);
        const h = Math.min(alto * 0.32, libreY);
        B.push({ x, y, w, h }, { x: x + ancho - w, y, w, h }, { x, y: y + alto - h, w, h }, { x: x + ancho - w, y: y + alto - h, w, h });
        break;
      }
      case 'esquina': { // una esquina grande tapada: la sala queda en forma de L
        const w = Math.min(ancho * 0.45, libreX);
        const h = Math.min(alto * 0.45, libreY);
        const derecha = this.azar.frac() < 0.5;
        const arriba = this.azar.frac() < 0.5;
        B.push({ x: derecha ? x + ancho - w : x, y: arriba ? y : y + alto - h, w, h });
        break;
      }
      case 'centro': { // un bloque grande al medio: hay que rodearlo
        const w = ancho * 0.26;
        const h = alto * 0.3;
        B.push({ x: cx - w / 2, y: cy - h / 2, w, h });
        break;
      }
      default: // 'rect': sin bloques
        break;
    }
    return B;
  }

  /** true si un círculo (x, y, radio) dentro de la sala no toca ningún bloque */
  libre(x, y, radio, sala) {
    return (sala.obstaculos || []).every((o) =>
      x + radio < o.x || x - radio > o.x + o.w || y + radio < o.y || y - radio > o.y + o.h);
  }

  /** Un bloque de muro: se ve (TileSprite con la textura del muro) y choca (cuerpo estático) */
  muro(x, y, ancho, alto) {
    if (ancho <= 0 || alto <= 0) return;
    // El cuerpo estático se ubica según el CENTRO del objeto: usamos origen 0.5
    const bloque = this.escena.add.tileSprite(x + ancho / 2, y + alto / 2, ancho, alto, `muro-${this.mundo.id}`).setDepth(2);
    this.muros.add(bloque);
  }

  /** Muro horizontal de x0 a x1; si "conHueco", deja un espacio en "centro" para el pasillo */
  muroHorizontal(x0, x1, y, centro, conHueco) {
    const { T } = this;
    if (!conHueco) return this.muro(x0, y, x1 - x0, T);
    const pa = this.cfg.pasilloAncho;
    this.muro(x0, y, centro - pa / 2 - x0, T);  // parte izquierda
    this.muro(centro + pa / 2, y, x1 - (centro + pa / 2), T); // parte derecha
  }

  /** Muro vertical de y0 a y1 (sin las esquinas, que ya pone el horizontal) */
  muroVertical(x, y0, y1, centro, conHueco) {
    const { T } = this;
    if (!conHueco) return this.muro(x, y0, T, y1 - y0);
    const pa = this.cfg.pasilloAncho;
    this.muro(x, y0, T, centro - pa / 2 - y0);  // parte de arriba
    this.muro(x, centro + pa / 2, T, y1 - (centro + pa / 2)); // parte de abajo
  }

  // =============================================================
  // 3. DURANTE LA PARTIDA
  // =============================================================

  /**
   * La escena avisa que se venció la sala "i". Se abren las puertas cuyas
   * salas pedidas ("requiere") ya están todas vencidas.
   * Devuelve las salas cuyas puertas se abrieron recién.
   */
  vencerSala(i, conAnimacion = true) {
    if (this.salas[i]) this.salas[i].estado = 'vencida';
    return this.actualizarPuertas(conAnimacion);
  }

  actualizarPuertas(conAnimacion = true) {
    const abiertas = [];
    this.salas.forEach((sala, i) => {
      const puerta = this.puertas[i];
      if (!puerta || !puerta.body.enable) return; // no tiene o ya está abierta
      if (sala.requiere.every((r) => this.salas[r].estado === 'vencida')) {
        this.abrirPuerta(i, conAnimacion);
        abiertas.push(i);
      }
    });
    return abiertas;
  }

  /** true cuando ya no queda ninguna sala por vencer */
  get terminada() {
    return this.salas.every((s) => s.estado === 'vencida');
  }

  /** Abre la reja de la sala "i": se desliza a un lado y deja de chocar */
  abrirPuerta(i, conAnimacion = true) {
    const puerta = this.puertas[i];
    if (!puerta || !puerta.body.enable) return;
    puerta.body.enable = false;
    if (!conAnimacion) {
      puerta.setVisible(false);
      return;
    }
    const mitad = this.cfg.pasilloAncho / 2;
    const animacion = puerta.vertical
      ? { scaleY: 0.05, y: puerta.y - mitad }
      : { scaleX: 0.05, x: puerta.x - mitad };
    this.escena.tweens.add({ targets: puerta, alpha: 0.3, duration: 500, ...animacion });
  }

  /** Índice de la sala en la que está el punto (x, y), o -1 si está en un pasillo */
  salaEn(x, y) {
    return this.salas.findIndex((s) => x >= s.x && x <= s.x + s.ancho && y >= s.y && y <= s.y + s.alto);
  }
}

// El lado contrario (si el pasillo sale por la derecha del padre, entra por la izquierda del hijo)
const OPUESTO = { der: 'izq', izq: 'der', arr: 'aba', aba: 'arr' };
