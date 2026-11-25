// =============================================================
// Texturas dibujadas con código (arte provisional, Etapa 5 / D-020)
//
// Idea clave: dibujamos UNA vez con "Graphics" (círculos, triángulos,
// polígonos) y lo convertimos en una TEXTURA con generateTexture().
// Después, cada personaje usa esa textura como una imagen normal,
// igual que si fuera un archivo .png. Cuando tengamos arte de verdad,
// solo cambiamos este archivo: el resto del juego no se entera.
//
// Todas las texturas "miran a la derecha" (ángulo 0). El juego las gira.
// =============================================================

import { enemigosEtapa6 } from './TexturasMundo.js';
import { crearTexturasRazas } from './TexturasRazas.js';

/** Crea todas las texturas, solo si aún no existen (sirve al reiniciar la escena) */
export function crearTexturas(escena) {
  if (escena.textures.exists('goruk-cuerpo')) return;

  // Generador de números al azar con "semilla": siempre da los mismos números,
  // así el suelo se ve igual cada vez que se abre el juego.
  const azar = new Phaser.Math.RandomDataGenerator(['smille-god']);

  heroeGoruk(escena);
  enemigoSombra(escena);
  enemigosEtapa6(escena);
  crearTexturasRazas(escena);
  suelo(escena, azar);
  muro(escena);
  efectos(escena);
  iconos(escena);
}

/** Helper: crea un Graphics fuera de pantalla, deja dibujar y lo guarda como textura */
function dibujar(escena, clave, ancho, alto, funcionDibujo) {
  const g = escena.make.graphics({ add: false });
  funcionDibujo(g);
  g.generateTexture(clave, ancho, alto);
  g.destroy();
}

/** Helper: polígono relleno a partir de una lista de [x, y] */
function poligono(g, puntos) {
  g.fillPoints(puntos.map(([x, y]) => new Phaser.Geom.Point(x, y)), true);
}

// -------------------------------------------------------------
// Héroe Goruk (demonio rojo con cuernos y alas), visto desde arriba
// Las alas van en una textura aparte para poder "aletear".
// -------------------------------------------------------------
function heroeGoruk(escena) {
  const T = 112; // tamaño de la textura; el centro es (56, 56)

  dibujar(escena, 'goruk-alas', T, T, (g) => {
    // Ala de arriba; la de abajo es su reflejo (y → T - y)
    const ala = [[58, 44], [46, 4], [38, 14], [40, 24], [26, 20], [32, 34], [20, 36], [46, 48]];
    const reflejo = ala.map(([x, y]) => [x, T - y]);
    g.fillStyle(0x4a0f14);
    poligono(g, ala);
    poligono(g, reflejo);
    // "Huesos" de las alas
    g.lineStyle(3, 0x2a0508);
    for (const [x, y] of [[46, 4], [26, 20], [20, 36]]) {
      g.lineBetween(56, 46, x, y);
      g.lineBetween(56, T - 46, x, T - y);
    }
  });

  dibujar(escena, 'goruk-cuerpo', T, T, (g) => {
    // Espada en la mano derecha (abajo-adelante)
    g.fillStyle(0xdfe6ee);
    poligono(g, [[70, 72], [106, 76], [70, 80]]);
    g.fillStyle(0xf5c542);
    g.fillRect(66, 69, 6, 14); // guarda de la espada

    // Hombros y cuerpo
    g.fillStyle(0x7f1d1d);
    g.fillCircle(56, 56, 26);
    g.fillStyle(0xc62828);
    g.fillCircle(56, 56, 22);
    g.fillStyle(0xe57373, 0.5);
    g.fillCircle(60, 48, 9); // brillo: da sensación de volumen

    // Cuernos (color hueso), curvados hacia atrás
    g.fillStyle(0xf3e5c8);
    poligono(g, [[58, 46], [66, 50], [44, 34], [38, 30]]);
    poligono(g, [[58, 66], [66, 62], [44, 78], [38, 82]]);

    // Cabeza
    g.fillStyle(0xb71c1c);
    g.fillCircle(64, 56, 12);

    // Ojos amarillos que brillan, mirando hacia adelante
    g.fillStyle(0xffeb3b);
    g.fillCircle(72, 51, 3);
    g.fillCircle(72, 61, 3);
  });
}

// -------------------------------------------------------------
// Enemigo "sombra": se dibuja en GRISES para teñirlo (tint) con el
// color de balance.json. Así un solo dibujo sirve para muchos enemigos.
// -------------------------------------------------------------
function enemigoSombra(escena) {
  const T = 80; // centro (40, 40)

  dibujar(escena, 'enemigo', T, T, (g) => {
    // Púas alrededor del cuerpo
    g.fillStyle(0x8a8a8a);
    const puas = 11;
    for (let i = 0; i < puas; i++) {
      const a = (i / puas) * Math.PI * 2;
      const b = a + 0.28;
      const c = a - 0.28;
      poligono(g, [
        [40 + Math.cos(a) * 36, 40 + Math.sin(a) * 36],
        [40 + Math.cos(b) * 20, 40 + Math.sin(b) * 20],
        [40 + Math.cos(c) * 20, 40 + Math.sin(c) * 20],
      ]);
    }
    g.fillStyle(0x6e6e6e);
    g.fillCircle(40, 40, 24);
    g.fillStyle(0xd0d0d0);
    g.fillCircle(40, 40, 20);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(44, 33, 7);
    // Colmillos al frente
    g.fillStyle(0xffffff);
    poligono(g, [[56, 34], [64, 37], [56, 39]]);
    poligono(g, [[56, 41], [64, 43], [56, 46]]);
  });

  // Los ojos van aparte para que NO se tiñan: siempre brillan en amarillo
  dibujar(escena, 'enemigo-ojos', T, T, (g) => {
    g.fillStyle(0xfff176);
    g.fillCircle(50, 34, 4);
    g.fillCircle(50, 46, 4);
  });

  // Sombra en el suelo (se usa para héroe y enemigos)
  dibujar(escena, 'sombra', 64, 64, (g) => {
    g.fillStyle(0x000000);
    g.fillCircle(32, 32, 30);
  });
}

// -------------------------------------------------------------
// Suelo de piedra: 4 variantes de baldosa para que no se note la repetición
// -------------------------------------------------------------
function suelo(escena, azar) {
  const T = 100;
  for (let v = 0; v < 4; v++) {
    dibujar(escena, `baldosa-${v}`, T, T, (g) => {
      g.fillStyle(0x141824);
      g.fillRect(0, 0, T, T); // la junta entre baldosas
      g.fillStyle(0x1f2433 + v * 0x020203);
      g.fillRect(3, 3, T - 6, T - 6);
      // Borde de luz arriba-izquierda y de sombra abajo-derecha: relieve
      g.fillStyle(0x2b3245);
      g.fillRect(3, 3, T - 6, 3);
      g.fillRect(3, 3, 3, T - 6);
      g.fillStyle(0x161a26);
      g.fillRect(3, T - 6, T - 6, 3);
      g.fillRect(T - 6, 3, 3, T - 6);
      // Manchas y piedritas
      for (let i = 0; i < 6; i++) {
        g.fillStyle(0x0f121b, 0.5);
        g.fillCircle(azar.between(10, 90), azar.between(10, 90), azar.between(1, 4));
      }
      // Grietas: líneas quebradas
      if (v > 0) {
        g.lineStyle(2, 0x0d1018, 0.9);
        let x = azar.between(15, 85);
        let y = azar.between(15, 85);
        for (let i = 0; i < 4; i++) {
          const nx = Phaser.Math.Clamp(x + azar.between(-22, 22), 6, 94);
          const ny = Phaser.Math.Clamp(y + azar.between(-22, 22), 6, 94);
          g.lineBetween(x, y, nx, ny);
          x = nx;
          y = ny;
        }
      }
    });
  }
}

/** Ladrillos para los muros */
function muro(escena) {
  dibujar(escena, 'muro', 80, 40, (g) => {
    g.fillStyle(0x221a2e);
    g.fillRect(0, 0, 80, 40);
    g.fillStyle(0x3d3052);
    g.fillRect(2, 2, 36, 16);
    g.fillRect(42, 2, 36, 16);
    g.fillRect(0, 22, 18, 16);
    g.fillRect(22, 22, 36, 16);
    g.fillRect(62, 22, 18, 16);
    g.fillStyle(0x53436b);
    g.fillRect(2, 2, 36, 3);
    g.fillRect(42, 2, 36, 3);
    g.fillRect(22, 22, 36, 3);
  });
}

// -------------------------------------------------------------
// Efectos: luz, llama, tajo del ataque y viñeta
// -------------------------------------------------------------
function efectos(escena) {
  // "Brillo": un círculo con degradado radial. Para degradados usamos un
  // CANVAS (el dibujo 2D del navegador), que Phaser también acepta como textura.
  const brillo = escena.textures.createCanvas('brillo', 128, 128);
  const ctx = brillo.getContext();
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  brillo.refresh();

  // Viñeta: bordes de la pantalla oscuros, centro transparente
  const vineta = escena.textures.createCanvas('vineta', 1280, 720);
  const v = vineta.getContext();
  const gv = v.createRadialGradient(640, 360, 220, 640, 360, 760);
  gv.addColorStop(0, 'rgba(0,0,0,0)');
  gv.addColorStop(1, 'rgba(0,0,0,0.75)');
  v.fillStyle = gv;
  v.fillRect(0, 0, 1280, 720);
  vineta.refresh();

  // Llama de antorcha (forma de gota)
  dibujar(escena, 'llama', 24, 36, (g) => {
    g.fillStyle(0xff7043);
    g.fillCircle(12, 24, 10);
    poligono(g, [[2, 24], [12, 0], [22, 24]]);
    g.fillStyle(0xffeb3b);
    g.fillCircle(12, 26, 5);
  });

  // Tajo: media luna blanca (se tiñe de dorado al atacar)
  dibujar(escena, 'tajo', 96, 96, (g) => {
    g.lineStyle(10, 0xffffff, 1);
    g.beginPath();
    g.arc(48, 48, 36, -1.0, 1.0);
    g.strokePath();
    g.lineStyle(4, 0xffffff, 0.5);
    g.beginPath();
    g.arc(48, 48, 44, -0.8, 0.8);
    g.strokePath();
  });

  // Chispa para partículas
  dibujar(escena, 'chispa', 8, 8, (g) => {
    g.fillStyle(0xffffff);
    g.fillCircle(4, 4, 4);
  });
}

// -------------------------------------------------------------
// Íconos de los botones (blancos, 64×64)
// -------------------------------------------------------------
function iconos(escena) {
  dibujar(escena, 'icono-espada', 64, 64, (g) => {
    g.lineStyle(8, 0xffffff);
    g.lineBetween(22, 42, 50, 14);  // hoja en diagonal
    g.fillStyle(0xffffff);
    poligono(g, [[46, 12], [56, 8], [52, 18]]); // punta
    g.lineStyle(5, 0xffffff);
    g.lineBetween(14, 34, 30, 50);  // guarda
    g.lineStyle(6, 0xffffff);
    g.lineBetween(20, 44, 10, 54);  // mango
  });

  dibujar(escena, 'icono-onda', 64, 64, (g) => {
    g.fillStyle(0xffffff);
    g.fillCircle(32, 32, 7);
    g.lineStyle(4, 0xffffff, 1);
    g.strokeCircle(32, 32, 16);
    g.lineStyle(3, 0xffffff, 0.6);
    g.strokeCircle(32, 32, 26);
  });

  dibujar(escena, 'icono-torbellino', 64, 64, (g) => {
    g.lineStyle(5, 0xffffff);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      g.beginPath();
      g.arc(32, 32, 22, a, a + 1.4);
      g.strokePath();
      g.fillStyle(0xffffff);
      // punta de flecha al final de cada arco
      const fin = a + 1.4;
      g.fillCircle(32 + Math.cos(fin) * 22, 32 + Math.sin(fin) * 22, 5);
    }
    g.fillCircle(32, 32, 6);
  });

  // Fase 1 — íconos del Asesino
  dibujar(escena, 'icono-dagas', 64, 64, (g) => {
    // Dos dagas cruzadas
    g.lineStyle(6, 0xffffff);
    g.lineBetween(14, 50, 46, 12);
    g.lineBetween(50, 50, 18, 12);
    g.lineStyle(4, 0xffffff);
    g.lineBetween(12, 40, 24, 52); // guardas
    g.lineBetween(52, 40, 40, 52);
  });

  dibujar(escena, 'icono-paso', 64, 64, (g) => {
    // Una silueta que se desvanece hacia atrás (tres círculos) y una flecha
    g.fillStyle(0xffffff, 0.3);
    g.fillCircle(16, 34, 8);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(28, 32, 9);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(42, 30, 10);
    poligono(g, [[50, 18], [60, 30], [50, 42]]);
  });

  dibujar(escena, 'icono-critico', 64, 64, (g) => {
    // Una estrella de 4 puntas (golpe certero)
    g.fillStyle(0xffffff);
    poligono(g, [[32, 4], [38, 26], [60, 32], [38, 38], [32, 60], [26, 38], [4, 32], [26, 26]]);
  });

  // v0.1.2 — íconos de las habilidades comunes de las clases nuevas
  dibujar(escena, 'icono-bola', 64, 64, (g) => {
    // Una esfera con estela
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(18, 44, 7);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(28, 36, 9);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(42, 24, 13);
  });

  dibujar(escena, 'icono-abanico', 64, 64, (g) => {
    // Cinco rayos que se abren
    g.lineStyle(5, 0xffffff);
    for (const a of [-0.8, -0.4, 0, 0.4, 0.8]) {
      g.lineBetween(10, 32, 10 + Math.cos(a) * 46, 32 + Math.sin(a) * 46);
    }
    g.fillStyle(0xffffff);
    g.fillCircle(10, 32, 6);
  });

  dibujar(escena, 'icono-sanar', 64, 64, (g) => {
    // Una cruz dentro de un anillo
    g.lineStyle(4, 0xffffff, 0.7);
    g.strokeCircle(32, 32, 26);
    g.fillStyle(0xffffff);
    g.fillRect(26, 14, 12, 36);
    g.fillRect(14, 26, 36, 12);
  });

  // v0.1.4 — pasiva y pociones
  dibujar(escena, 'icono-pasiva', 64, 64, (g) => {
    // Una estrella de 8 puntas (algo que está siempre encendido)
    g.fillStyle(0xffffff);
    const puntos = [];
    for (let i = 0; i < 16; i++) {
      const r = i % 2 === 0 ? 28 : 12; // puntas largas y cortas, alternadas
      const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
      puntos.push([32 + Math.cos(a) * r, 32 + Math.sin(a) * r]);
    }
    poligono(g, puntos);
  });

  dibujar(escena, 'icono-pocion', 64, 64, (g) => {
    // Un frasco redondo con cuello y tapón
    g.fillStyle(0xffffff);
    g.fillCircle(32, 40, 18);
    g.fillRect(26, 12, 12, 16);
    g.fillStyle(0xffffff, 0.6);
    g.fillRect(22, 6, 20, 7);
  });
}
