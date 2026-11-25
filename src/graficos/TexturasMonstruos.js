// =============================================================
// v0.1.7 — MONSTRUOS PROPIOS DE CADA MUNDO
// Cada mundo tiene 4 monstruos (normal, rápido, resistente, tirador) y su
// jefe, con NOMBRE y DIBUJO propios (balance.json → mundos[i].monstruos).
//
// En vez de dibujar 60 monstruos a mano, cada dibujo se ARMA con piezas:
//   - un CUERPO (bestia, insecto, ave, serpiente, gólem, espectro, pez,
//     pulpo, robot, baba, reptil, demonio, cristal)
//   - y ADORNOS encima (cuernos, alas, cola, púas, pinzas, llamas...).
// Ejemplo en balance.json:
//   "normal": { "nombre": "Lobo musgoso", "cuerpo": "bestia", "adornos": ["orejas", "cola"] }
//
// Igual que los otros enemigos, se dibujan en GRISES para teñirlos con el
// color del mundo, y los ojos van en una textura aparte (no se tiñen).
// Todos miran a la DERECHA (el juego los gira). La cuadrícula base es de
// 80 × 80 con el centro en (40, 40); el jefe usa la misma, al doble (160).
// =============================================================

/** Los 5 monstruos de un mundo, en el orden en que se guardan */
export const TIPOS_MONSTRUO = ['normal', 'rapido', 'resistente', 'tirador', 'jefe'];

/** Nombre de la textura de un monstruo: "m-bosque-rapido" (y "m-bosque-rapido-ojos") */
export function texturaMonstruo(idMundo, tipo) {
  return `m-${idMundo}-${tipo}`;
}

/** Crea las texturas de los 5 monstruos de un mundo (solo las que aún no existen) */
export function crearMonstruos(escena, mundo) {
  if (!mundo.monstruos) return;
  for (const tipo of TIPOS_MONSTRUO) {
    const datos = mundo.monstruos[tipo];
    const clave = texturaMonstruo(mundo.id, tipo);
    if (!datos || escena.textures.exists(clave)) continue;
    const s = tipo === 'jefe' ? 2 : 1; // el jefe se dibuja al doble
    const colorOjos = { normal: 0xfff176, rapido: 0xfff176, resistente: 0xff5252, tirador: 0x80deea, jefe: 0xff1744 }[tipo];
    let ojos = [];
    dibujarTextura(escena, clave, 80 * s, (g) => {
      const p = lapiz(g, s);
      const adornos = datos.adornos || [];
      // Algunos adornos van DEBAJO del cuerpo (alas, cola, aletas, tentáculos...)
      for (const a of adornos) if (DEBAJO[a]) DEBAJO[a](p);
      ojos = (CUERPOS[datos.cuerpo] || CUERPOS.bestia)(p);
      for (const a of adornos) if (ENCIMA[a]) ENCIMA[a](p);
      if (adornos.includes('ojoUnico')) { // un solo ojo grande, al centro de la cara
        ojos = [[ojos[0][0], 40, 7]];
        p.color(BRILLO).circulo(ojos[0][0], 40, 9);
      }
    });
    dibujarTextura(escena, `${clave}-ojos`, 80 * s, (g) => {
      for (const [x, y, r = 3.5] of ojos) {
        g.fillStyle(colorOjos).fillCircle(x * s, y * s, r * s);
        g.fillStyle(0xffffff, 0.9).fillCircle((x + r * 0.35) * s, (y - r * 0.35) * s, r * 0.35 * s);
      }
    });
  }
}

function dibujarTextura(escena, clave, tamano, funcionDibujo) {
  const g = escena.make.graphics({ add: false });
  funcionDibujo(g);
  g.generateTexture(clave, tamano, tamano);
  g.destroy();
}

/**
 * Un "lápiz" que multiplica todas las medidas por la escala s.
 * Así cada pieza se escribe UNA vez (en la cuadrícula de 80) y sirve
 * para los monstruos chicos y para el jefe.
 */
function lapiz(g, s) {
  return {
    color(c, alfa = 1) { g.fillStyle(c, alfa); return this; },
    circulo(x, y, r) { g.fillCircle(x * s, y * s, r * s); return this; },
    elipse(x, y, ancho, alto) { g.fillEllipse(x * s, y * s, ancho * s, alto * s); return this; },
    rect(x, y, ancho, alto, radio = 0) {
      if (radio) g.fillRoundedRect(x * s, y * s, ancho * s, alto * s, radio * s);
      else g.fillRect(x * s, y * s, ancho * s, alto * s);
      return this;
    },
    poligono(puntos) {
      g.fillPoints(puntos.map(([x, y]) => new Phaser.Geom.Point(x * s, y * s)), true);
      return this;
    },
    linea(ancho, c, x1, y1, x2, y2) { g.lineStyle(ancho * s, c).lineBetween(x1 * s, y1 * s, x2 * s, y2 * s); return this; },
  };
}

// Tonos de gris (después se tiñen con el color del mundo)
const OSCURO = 0x5e5e5e;
const MEDIO = 0x8a8a8a;
const CLARO = 0xd0d0d0;
const BRILLO = 0xffffff;

// -------------------------------------------------------------
// CUERPOS: cada uno se dibuja y DEVUELVE dónde van los ojos [[x, y, radio]]
// -------------------------------------------------------------
const CUERPOS = {
  /** Cuadrúpedo visto desde arriba: 4 patas, lomo y cabeza */
  bestia(p) {
    p.color(OSCURO);
    for (const [x, y] of [[26, 22], [26, 58], [48, 24], [48, 56]]) p.elipse(x, y, 10, 14);
    p.color(MEDIO).elipse(36, 40, 40, 28);
    p.color(CLARO).elipse(36, 40, 32, 22);
    p.color(MEDIO).circulo(58, 40, 12);
    p.color(CLARO).elipse(66, 40, 12, 10); // hocico
    p.color(BRILLO, 0.5).elipse(32, 34, 14, 6);
    return [[60, 35], [60, 45]];
  },
  /** Tres partes (cabeza, tórax, abdomen) y 6 patas */
  insecto(p) {
    for (const x of [30, 40, 50]) p.linea(3, OSCURO, x, 40, x - 6, 14).linea(3, OSCURO, x, 40, x - 6, 66);
    p.color(MEDIO).elipse(26, 40, 28, 24);
    p.color(CLARO).elipse(44, 40, 18, 18);
    p.color(MEDIO).circulo(58, 40, 9);
    p.color(BRILLO, 0.5).elipse(24, 35, 12, 5);
    return [[61, 36], [61, 44]];
  },
  /** Pájaro: cuerpo en gota, pico y plumas de la cola */
  ave(p) {
    p.color(OSCURO).poligono([[12, 32], [26, 40], [12, 48]]);
    p.color(MEDIO).elipse(38, 40, 36, 24);
    p.color(CLARO).elipse(40, 40, 26, 16);
    p.color(MEDIO).circulo(56, 40, 10);
    p.color(BRILLO).poligono([[64, 36], [74, 40], [64, 44]]);
    return [[58, 36], [58, 44]];
  },
  /** Cuerpo en segmentos que ondulan */
  serpiente(p) {
    const puntos = [[14, 46, 7], [22, 36, 8], [32, 44, 9], [42, 36, 10]];
    for (const [x, y, r] of puntos) p.color(MEDIO).circulo(x, y, r).color(CLARO).circulo(x, y - 1, r - 3);
    p.color(MEDIO).elipse(56, 40, 24, 18);
    p.color(CLARO).elipse(58, 40, 16, 12);
    return [[60, 35], [60, 45]];
  },
  /** Bloques de piedra: hombros anchos y cabeza cuadrada */
  golem(p) {
    p.color(OSCURO).rect(30, 8, 18, 16, 4).rect(30, 56, 18, 16, 4); // puños
    p.color(MEDIO).rect(18, 18, 34, 44, 6);
    p.color(CLARO).rect(22, 22, 26, 36, 5);
    p.color(MEDIO).rect(50, 30, 16, 20, 4);
    p.color(BRILLO, 0.4).rect(24, 24, 10, 8, 3);
    return [[60, 36], [60, 44]];
  },
  /** Fantasma: cabeza redonda y cola que se deshace en ondas */
  espectro(p) {
    p.color(MEDIO, 0.7);
    for (const [x, y, r] of [[12, 32, 6], [12, 48, 6], [20, 40, 8]]) p.circulo(x, y, r);
    p.poligono([[18, 26], [44, 22], [44, 58], [18, 54]]);
    p.color(CLARO, 0.9).circulo(46, 40, 20);
    p.color(BRILLO, 0.5).circulo(52, 33, 7);
    return [[56, 35], [56, 45]];
  },
  /** Pez: cuerpo ovalado y aleta de cola */
  pez(p) {
    p.color(OSCURO).poligono([[8, 26], [24, 40], [8, 54]]);
    p.color(MEDIO).elipse(42, 40, 44, 30);
    p.color(CLARO).elipse(44, 42, 34, 18);
    p.color(OSCURO).poligono([[36, 26], [48, 18], [52, 28]]); // aleta de arriba
    return [[56, 36], [56, 44]];
  },
  /** Pulpo / medusa: cabeza grande y 6 tentáculos hacia atrás */
  pulpo(p) {
    for (let i = 0; i < 6; i++) {
      const y = 22 + i * 7.2;
      p.linea(4, OSCURO, 40, 40, 10, y).color(OSCURO).circulo(10, y, 3);
    }
    p.color(MEDIO).circulo(46, 40, 20);
    p.color(CLARO).circulo(48, 38, 15);
    p.color(BRILLO, 0.5).circulo(54, 32, 5);
    return [[58, 34], [58, 46]];
  },
  /** Máquina: caja con ruedas o patas y un visor */
  robot(p) {
    p.color(OSCURO).rect(18, 12, 30, 8, 3).rect(18, 60, 30, 8, 3); // orugas
    p.color(MEDIO).rect(16, 18, 40, 44, 5);
    p.color(CLARO).rect(20, 22, 32, 36, 4);
    p.color(OSCURO).rect(54, 30, 10, 20, 3); // visor
    p.color(BRILLO, 0.4).rect(22, 24, 10, 6, 2);
    return [[59, 35, 3], [59, 45, 3]];
  },
  /** Baba / limo: gota blanda con brillo */
  baba(p) {
    p.color(MEDIO, 0.85).elipse(38, 40, 50, 42);
    p.color(CLARO, 0.9).elipse(40, 40, 40, 32);
    p.color(BRILLO, 0.6).elipse(34, 30, 14, 8);
    p.color(MEDIO, 0.85).circulo(14, 30, 4).circulo(12, 52, 3);
    return [[52, 34], [52, 46]];
  },
  /** Reptil / dinosaurio: cola larga, patas y cabeza grande */
  reptil(p) {
    p.color(OSCURO).poligono([[4, 40], [24, 32], [24, 48]]); // cola
    for (const [x, y] of [[30, 24], [30, 56], [46, 26], [46, 54]]) p.color(OSCURO).elipse(x, y, 8, 12);
    p.color(MEDIO).elipse(38, 40, 36, 26);
    p.color(CLARO).elipse(38, 40, 26, 16);
    p.color(MEDIO).elipse(60, 40, 22, 18);
    p.color(CLARO).elipse(64, 40, 14, 10);
    return [[60, 34], [60, 46]];
  },
  /** Humanoide visto desde arriba: hombros, brazos y cabeza */
  demonio(p) {
    p.color(OSCURO).circulo(46, 16, 7).circulo(46, 64, 7); // manos
    p.color(MEDIO).elipse(34, 40, 26, 50); // hombros
    p.color(CLARO).elipse(36, 40, 18, 36);
    p.color(MEDIO).circulo(50, 40, 13);
    p.color(CLARO).circulo(52, 40, 10);
    return [[57, 35], [57, 45]];
  },
  /** Cristal: rombo facetado */
  cristal(p) {
    p.color(MEDIO).poligono([[10, 40], [36, 12], [68, 40], [36, 68]]);
    p.color(CLARO).poligono([[18, 40], [36, 20], [58, 40], [36, 60]]);
    p.color(BRILLO, 0.6).poligono([[26, 38], [36, 24], [40, 36]]);
    return [[50, 36], [50, 44]];
  },
};

// -------------------------------------------------------------
// ADORNOS que van DEBAJO del cuerpo
// -------------------------------------------------------------
const DEBAJO = {
  alas(p) {
    p.color(OSCURO, 0.9).poligono([[44, 30], [20, 2], [10, 18], [26, 34]]);
    p.poligono([[44, 50], [20, 78], [10, 62], [26, 46]]);
    p.color(MEDIO, 0.6).poligono([[40, 30], [22, 10], [18, 20]]).poligono([[40, 50], [22, 70], [18, 60]]);
  },
  cola(p) {
    p.linea(4, OSCURO, 20, 40, 6, 32).linea(4, OSCURO, 6, 32, 2, 42);
    p.color(OSCURO).poligono([[0, 36], [6, 44], [0, 48]]);
  },
  aletas(p) {
    p.color(OSCURO).poligono([[34, 26], [26, 8], [46, 24]]).poligono([[34, 54], [26, 72], [46, 56]]);
  },
  tentaculos(p) {
    for (const y of [16, 64]) p.linea(4, OSCURO, 36, 40, 14, y).color(OSCURO).circulo(14, y, 3);
  },
  llamas(p) {
    p.color(MEDIO, 0.55);
    for (let i = 0; i < 7; i++) {
      const y = 12 + i * 9;
      p.poligono([[24, y - 5], [2, y + 1], [24, y + 6]]);
    }
  },
  hojas(p) {
    p.color(OSCURO, 0.9);
    for (const [x, y] of [[16, 18], [14, 62], [34, 8], [34, 72], [8, 40]]) p.elipse(x, y, 14, 9);
  },
};

// -------------------------------------------------------------
// ADORNOS que van ENCIMA del cuerpo
// -------------------------------------------------------------
const ENCIMA = {
  cuernos(p) {
    p.color(0xf3e5c8).poligono([[56, 30], [62, 31], [72, 16]]).poligono([[56, 50], [62, 49], [72, 64]]);
  },
  orejas(p) {
    p.color(OSCURO).poligono([[52, 30], [58, 28], [50, 18]]).poligono([[52, 50], [58, 52], [50, 62]]);
  },
  colmillos(p) {
    p.color(BRILLO).poligono([[66, 34], [76, 37], [66, 39]]).poligono([[66, 41], [76, 43], [66, 46]]);
  },
  puas(p) {
    p.color(BRILLO, 0.85);
    for (const x of [22, 30, 38, 46]) p.poligono([[x - 3, 36], [x, 28], [x + 3, 36]]).poligono([[x - 3, 44], [x, 52], [x + 3, 44]]);
  },
  antenas(p) {
    p.linea(2, OSCURO, 60, 36, 74, 20).linea(2, OSCURO, 60, 44, 74, 60);
    p.color(CLARO).circulo(74, 20, 3).circulo(74, 60, 3);
  },
  pinzas(p) {
    p.color(MEDIO).poligono([[58, 30], [76, 22], [72, 30], [64, 32]]).poligono([[58, 50], [76, 58], [72, 50], [64, 48]]);
    p.color(OSCURO).circulo(70, 26, 3).circulo(70, 54, 3);
  },
  caparazon(p) {
    p.color(OSCURO, 0.9).elipse(32, 40, 30, 30);
    p.color(MEDIO).elipse(32, 40, 24, 24);
    p.linea(2, OSCURO, 20, 40, 44, 40).linea(2, OSCURO, 32, 28, 32, 52);
  },
  corona(p) {
    p.color(BRILLO).poligono([[40, 28], [44, 22], [46, 30], [50, 20], [52, 30], [56, 22], [58, 30], [58, 50], [40, 50]]);
    p.color(MEDIO).rect(40, 46, 18, 4);
  },
};
