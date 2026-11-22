// =============================================================
// Etapa 6: texturas de los tipos de enemigo, del jefe y de los MUNDOS
// (Bosque, Desierto, Infierno, Nevado). Mismo método que Texturas.js:
// dibujar con Graphics y guardar como textura.
// =============================================================

function dibujar(escena, clave, ancho, alto, funcionDibujo) {
  const g = escena.make.graphics({ add: false });
  funcionDibujo(g);
  g.generateTexture(clave, ancho, alto);
  g.destroy();
}

function poligono(g, puntos) {
  g.fillPoints(puntos.map(([x, y]) => new Phaser.Geom.Point(x, y)), true);
}

/** Convierte "#rrggbb" en número (0xrrggbb), que es lo que usa Graphics */
export function color(texto) {
  return Phaser.Display.Color.HexStringToColor(texto).color;
}

/** Enemigo rápido (forma de flecha), resistente (caparazón) y el jefe. Se dibujan en grises para teñirlos. */
export function enemigosEtapa6(escena) {
  // RÁPIDO: mide 80 px para un radio de 24 (igual que el normal)
  dibujar(escena, 'enemigo-rapido', 80, 80, (g) => {
    g.fillStyle(0x8a8a8a);
    poligono(g, [[20, 22], [44, 36], [44, 44], [20, 58], [28, 40]]); // aletas
    g.fillStyle(0xd0d0d0);
    g.fillEllipse(44, 40, 40, 26);
    g.fillStyle(0xffffff, 0.6);
    g.fillEllipse(48, 35, 16, 8);
    g.fillStyle(0xffffff);
    poligono(g, [[62, 37], [72, 40], [62, 43]]); // pico
  });
  dibujar(escena, 'enemigo-rapido-ojos', 80, 80, (g) => {
    g.fillStyle(0xfff176);
    g.fillCircle(54, 35, 3);
    g.fillCircle(54, 45, 3);
  });

  // RESISTENTE: caparazón con placas, como un escarabajo acorazado
  dibujar(escena, 'enemigo-resistente', 80, 80, (g) => {
    g.fillStyle(0x5e5e5e);
    g.fillCircle(38, 40, 25);
    g.fillStyle(0xbdbdbd);
    g.fillCircle(36, 40, 21);
    g.lineStyle(3, 0x6e6e6e);
    g.lineBetween(15, 40, 57, 40); // línea central del caparazón
    g.strokeCircle(36, 40, 13);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(32, 30, 6);
    g.fillStyle(0x9e9e9e);
    g.fillCircle(60, 40, 10); // cabeza
  });
  dibujar(escena, 'enemigo-resistente-ojos', 80, 80, (g) => {
    g.fillStyle(0xff5252);
    g.fillCircle(64, 36, 3);
    g.fillCircle(64, 44, 3);
  });

  // JEFE: grande, con cuernos y corona de púas. Mide 160 px para un radio de 50.
  dibujar(escena, 'jefe', 160, 160, (g) => {
    g.fillStyle(0x707070);
    const puas = 14;
    for (let i = 0; i < puas; i++) {
      const a = (i / puas) * Math.PI * 2;
      poligono(g, [
        [80 + Math.cos(a) * 74, 80 + Math.sin(a) * 74],
        [80 + Math.cos(a + 0.2) * 46, 80 + Math.sin(a + 0.2) * 46],
        [80 + Math.cos(a - 0.2) * 46, 80 + Math.sin(a - 0.2) * 46],
      ]);
    }
    g.fillStyle(0x5a5a5a);
    g.fillCircle(80, 80, 52);
    g.fillStyle(0xcfcfcf);
    g.fillCircle(80, 80, 46);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(90, 64, 16);
    g.fillStyle(0xf3e5c8); // cuernos hacia adelante
    poligono(g, [[96, 56], [108, 64], [140, 36]]);
    poligono(g, [[96, 104], [108, 96], [140, 124]]);
    g.fillStyle(0x3a3a3a); // boca
    g.fillEllipse(116, 80, 14, 30);
    g.fillStyle(0xffffff); // colmillos
    poligono(g, [[112, 68], [124, 72], [112, 76]]);
    poligono(g, [[112, 84], [124, 88], [112, 92]]);
  });
  dibujar(escena, 'jefe-ojos', 160, 160, (g) => {
    g.fillStyle(0xff1744);
    g.fillCircle(100, 66, 6);
    g.fillCircle(100, 94, 6);
    g.fillStyle(0xffffff);
    g.fillCircle(102, 64, 2);
    g.fillCircle(102, 92, 2);
  });

  // Reja de las puertas entre salas (40 × 80; se repite si la puerta es más alta)
  dibujar(escena, 'reja', 40, 80, (g) => {
    g.fillStyle(0x2b2b2b);
    g.fillRect(0, 0, 40, 80);
    g.fillStyle(0x8d8d8d);
    for (const x of [4, 16, 28]) g.fillRect(x, 0, 8, 80); // barrotes
    g.fillRect(0, 20, 40, 6);                            // travesaños
    g.fillRect(0, 56, 40, 6);
    g.fillStyle(0xd0d0d0);
    for (const x of [4, 16, 28]) g.fillRect(x, 0, 2, 80); // brillo del metal
  });

  // Ícono de la cura: un corazón (dos círculos + un triángulo)
  dibujar(escena, 'icono-cura', 64, 64, (g) => {
    g.fillStyle(0xffffff);
    g.fillCircle(22, 24, 12);
    g.fillCircle(42, 24, 12);
    poligono(g, [[11, 29], [53, 29], [32, 54]]);
    g.fillStyle(0x000000, 0.35);
    g.fillRect(29, 18, 6, 22); // cruz de curación
    g.fillRect(21, 26, 22, 6);
  });

  // TIRADOR (Etapa 7): bestia con un gran ojo y tentáculos; dispara de lejos.
  dibujar(escena, 'enemigo-tirador', 80, 80, (g) => {
    g.fillStyle(0x7a7a7a);
    for (const a of [2.3, 2.8, 3.5, 4.0]) { // tentáculos hacia atrás
      poligono(g, [[40 + Math.cos(a - 0.15) * 16, 40 + Math.sin(a - 0.15) * 16],
        [40 + Math.cos(a) * 36, 40 + Math.sin(a) * 36],
        [40 + Math.cos(a + 0.15) * 16, 40 + Math.sin(a + 0.15) * 16]]);
    }
    g.fillStyle(0x6a6a6a);
    g.fillCircle(42, 40, 21);
    g.fillStyle(0xd6d6d6);
    g.fillCircle(42, 40, 17);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(38, 32, 5);
  });
  dibujar(escena, 'enemigo-tirador-ojos', 80, 80, (g) => {
    g.fillStyle(0xffffff); // un solo ojo grande, mirando al frente
    g.fillCircle(50, 40, 9);
    g.fillStyle(0x111111);
    g.fillCircle(54, 40, 5);
  });

  // Proyectil: esfera brillante (se tiñe con el color del mundo)
  dibujar(escena, 'proyectil', 24, 24, (g) => {
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(12, 12, 12);
    g.fillStyle(0xffffff);
    g.fillCircle(12, 12, 7);
  });

  // Hoja que cae (Bosque)
  dibujar(escena, 'hoja', 14, 8, (g) => {
    g.fillStyle(0xffffff);
    g.fillEllipse(7, 4, 14, 7);
  });
}

/**
 * Texturas de UN mundo: 4 baldosas de suelo, el muro y la decoración.
 * Se llaman "suelo-bosque-0", "muro-bosque", "deco-bosque-arbusto"...
 * Los colores vienen de balance.json → mundos[i].colores
 */
export function crearTexturasMundo(escena, mundo) {
  const id = mundo.id;
  if (escena.textures.exists(`muro-${id}`)) return; // ya existen
  const c = mundo.colores;
  const azar = new Phaser.Math.RandomDataGenerator([id]);
  const T = 100;

  for (let v = 0; v < 4; v++) {
    dibujar(escena, `suelo-${id}-${v}`, T, T, (g) => {
      if (c.estilo === 'baldosa') {
        // Baldosas de piedra con juntas
        g.fillStyle(color(c.manchas[0]));
        g.fillRect(0, 0, T, T);
        g.fillStyle(color(c.suelo));
        g.fillRect(3, 3, T - 6, T - 6);
        g.fillStyle(color(c.manchas[1]));
        g.fillRect(3, 3, T - 6, 3);
        g.fillRect(3, 3, 3, T - 6);
      } else {
        // Suelo "natural" sin juntas: pasto, arena o nieve
        g.fillStyle(color(c.suelo));
        g.fillRect(0, 0, T, T);
      }
      // Manchas suaves de dos tonos
      for (let i = 0; i < 7; i++) {
        g.fillStyle(color(c.manchas[i % 2]), 0.6);
        g.fillCircle(azar.between(12, 88), azar.between(12, 88), azar.between(4, 11));
      }
      // Detalle: briznas de pasto / ondas de arena / cristales, o grietas brillantes en baldosa
      g.lineStyle(2, color(c.detalle), 0.9);
      const cantidad = c.estilo === 'baldosa' ? (v > 1 ? 2 : 0) : 6;
      for (let i = 0; i < cantidad; i++) {
        const x = azar.between(12, 88);
        const y = azar.between(12, 88);
        if (c.estilo === 'baldosa') {
          g.lineBetween(x, y, x + azar.between(-18, 18), y + azar.between(-18, 18));
        } else {
          g.lineBetween(x, y, x - 3, y - 7); // forma de "V"
          g.lineBetween(x, y, x + 3, y - 7);
        }
      }
    });
  }

  // Muro: bloques de piedra con los colores del mundo
  dibujar(escena, `muro-${id}`, 80, 40, (g) => {
    g.fillStyle(color(c.muro));
    g.fillRect(0, 0, 80, 40);
    g.fillStyle(color(c.piedra));
    g.fillRect(2, 2, 36, 16);
    g.fillRect(42, 2, 36, 16);
    g.fillRect(0, 22, 18, 16);
    g.fillRect(22, 22, 36, 16);
    g.fillRect(62, 22, 18, 16);
  });

  for (const deco of mundo.decoracionPorSala) decoracion(escena, id, deco.tipo, c);
}

/** Adornos del suelo (vistos desde arriba). No chocan: solo decoran. */
function decoracion(escena, id, tipo, c) {
  const clave = `deco-${id}-${tipo}`;
  if (tipo === 'arbusto') {
    dibujar(escena, clave, 80, 80, (g) => {
      g.fillStyle(0x1b3d1a, 0.6);
      g.fillCircle(42, 46, 30); // sombra
      const hojas = [[30, 34, 18, 0x2e7d32], [50, 30, 16, 0x388e3c], [44, 48, 20, 0x2e7d32], [28, 50, 14, 0x43a047], [46, 36, 10, 0x66bb6a]];
      for (const [x, y, r, col] of hojas) {
        g.fillStyle(col);
        g.fillCircle(x, y, r);
      }
    });
  } else if (tipo === 'flores') {
    dibujar(escena, clave, 40, 40, (g) => {
      for (const [x, y, col] of [[10, 12, 0xffeb3b], [26, 8, 0xf06292], [18, 24, 0xffffff], [32, 28, 0xba68c8]]) {
        g.fillStyle(col);
        g.fillCircle(x, y, 4);
        g.fillStyle(0xffa000);
        g.fillCircle(x, y, 1.5);
      }
    });
  } else if (tipo === 'roca') {
    dibujar(escena, clave, 60, 50, (g) => {
      g.fillStyle(0x000000, 0.3);
      g.fillEllipse(32, 32, 52, 30);
      g.fillStyle(color(c.piedra));
      poligono(g, [[8, 28], [16, 10], [38, 6], [52, 20], [48, 36], [20, 38]]);
      g.fillStyle(0xffffff, 0.25);
      poligono(g, [[16, 12], [38, 8], [32, 20], [18, 22]]);
    });
  } else if (tipo === 'cactus') {
    dibujar(escena, clave, 60, 60, (g) => {
      g.fillStyle(0x000000, 0.25);
      g.fillCircle(32, 34, 20);
      g.fillStyle(0x558b2f);
      g.fillCircle(30, 30, 16);
      g.fillCircle(12, 22, 7); // brazos
      g.fillCircle(48, 40, 7);
      g.fillStyle(0x7cb342);
      g.fillCircle(30, 30, 9);
      g.lineStyle(1, 0xf1f8e9);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.lineBetween(30 + Math.cos(a) * 14, 30 + Math.sin(a) * 14, 30 + Math.cos(a) * 19, 30 + Math.sin(a) * 19);
      }
    });
  } else if (tipo === 'lava') {
    dibujar(escena, clave, 140, 100, (g) => {
      g.fillStyle(0x3e0a00);
      g.fillEllipse(70, 50, 136, 94);
      g.fillStyle(0xff3d00);
      g.fillEllipse(70, 50, 116, 76);
      g.fillStyle(0xff9100);
      g.fillEllipse(64, 46, 80, 46);
      g.fillStyle(0xffd54f);
      g.fillEllipse(58, 42, 34, 16);
    });
  } else if (tipo === 'hielo') {
    dibujar(escena, clave, 130, 90, (g) => {
      g.fillStyle(0x90caf9, 0.55);
      g.fillEllipse(65, 45, 126, 84);
      g.fillStyle(0xe3f2fd, 0.7);
      g.fillEllipse(55, 38, 70, 34);
      g.lineStyle(2, 0xffffff, 0.8);
      g.lineBetween(30, 30, 60, 50);
      g.lineBetween(70, 30, 95, 55);
    });
  }
}
