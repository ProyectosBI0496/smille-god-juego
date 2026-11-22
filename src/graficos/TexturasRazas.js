// =============================================================
// Razas jugables (Etapa 8), dibujadas con código, vistas desde arriba
// y mirando a la derecha. Cada una se llama "<raza>-cuerpo"; algunas
// tienen una parte extra que se anima aparte ("goruk-alas", "derial-cola").
// El Goruk ya está en Texturas.js.
// Tamaño 112 × 112: el centro es (56, 56).
// =============================================================

function dibujar(escena, clave, funcionDibujo) {
  const g = escena.make.graphics({ add: false });
  funcionDibujo(g);
  g.generateTexture(clave, 112, 112);
  g.destroy();
}

function poligono(g, puntos) {
  g.fillPoints(puntos.map(([x, y]) => new Phaser.Geom.Point(x, y)), true);
}

/** Estrella de 5 puntas (para los ojos de los Derial) */
function estrella(g, cx, cy, radio) {
  const puntos = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radio : radio * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    puntos.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  poligono(g, puntos);
}

export function crearTexturasRazas(escena) {
  // ORCO: piel verde, colmillos, hombreras de cuero y un hacha
  dibujar(escena, 'orco-cuerpo', (g) => {
    g.lineStyle(5, 0x5d4037);
    g.lineBetween(62, 76, 100, 80);              // mango del hacha
    g.fillStyle(0xb0bec5);
    poligono(g, [[92, 70], [104, 66], [106, 92], [94, 88]]); // hoja del hacha
    g.fillStyle(0x1b5e20);
    g.fillCircle(56, 56, 27);
    g.fillStyle(0x558b2f);
    g.fillCircle(56, 56, 23);
    g.fillStyle(0x6d4c41);                         // hombreras
    g.fillCircle(52, 34, 10);
    g.fillCircle(52, 78, 10);
    g.fillStyle(0x7cb342);
    g.fillCircle(66, 56, 13);                      // cabeza
    g.fillStyle(0xfff8e1);                         // colmillos
    poligono(g, [[74, 49], [82, 47], [76, 53]]);
    poligono(g, [[74, 63], [82, 65], [76, 59]]);
    g.fillStyle(0xffeb3b);
    g.fillCircle(72, 52, 2.5);
    g.fillCircle(72, 60, 2.5);
  });

  // TORO: pelaje marrón, cuernos grandes, hocico con argolla y un mazo
  dibujar(escena, 'toro-cuerpo', (g) => {
    g.lineStyle(5, 0x4e342e);
    g.lineBetween(60, 80, 96, 84);                 // mango del mazo
    g.fillStyle(0x616161);
    g.fillRoundedRect(90, 74, 16, 22, 4);          // cabeza del mazo
    g.fillStyle(0x3e2723);
    g.fillCircle(54, 56, 28);
    g.fillStyle(0x795548);
    g.fillCircle(54, 56, 24);
    g.fillStyle(0xf5f5dc);                         // cuernos hacia los costados y adelante
    poligono(g, [[62, 46], [70, 48], [84, 18], [78, 20]]);
    poligono(g, [[62, 66], [70, 64], [84, 94], [78, 92]]);
    g.fillStyle(0x8d6e63);
    g.fillCircle(66, 56, 14);                      // cabeza
    g.fillStyle(0xbcaaa4);
    g.fillEllipse(78, 56, 12, 16);                 // hocico
    g.lineStyle(3, 0xffc107);
    g.strokeCircle(84, 56, 4);                     // argolla
    g.fillStyle(0xff5252);
    g.fillCircle(70, 49, 2.5);
    g.fillCircle(70, 63, 2.5);
  });

  // HUMANO: armadura de acero, tabardo azul, escudo y espada
  dibujar(escena, 'humano-cuerpo', (g) => {
    g.fillStyle(0xdfe6ee);
    poligono(g, [[68, 74], [104, 78], [68, 82]]);  // espada
    g.fillStyle(0xf5c542);
    g.fillRect(64, 71, 6, 14);
    g.fillStyle(0x546e7a);
    g.fillCircle(56, 56, 25);
    g.fillStyle(0x90a4ae);
    g.fillCircle(56, 56, 21);
    g.fillStyle(0x1e88e5);
    g.fillRect(40, 50, 26, 12);                    // tabardo
    g.fillStyle(0x1565c0);                         // escudo (a la izquierda del héroe)
    g.fillEllipse(62, 28, 30, 16);
    g.fillStyle(0xf5c542);
    g.fillCircle(62, 28, 4);
    g.fillStyle(0xb0bec5);
    g.fillCircle(64, 56, 12);                      // casco
    g.fillStyle(0xffcc80);
    g.fillRect(68, 51, 6, 10);                     // cara bajo el casco
  });

  // ELFO: capa turquesa, cabello rubio, orejas puntiagudas y un arco
  dibujar(escena, 'elfo-cuerpo', (g) => {
    g.lineStyle(4, 0x8d6e63);
    g.beginPath();
    g.arc(70, 56, 30, -0.9, 0.9);                  // arco
    g.strokePath();
    g.lineStyle(1, 0xffffff, 0.8);
    g.lineBetween(70 + Math.cos(-0.9) * 30, 56 + Math.sin(-0.9) * 30, 70 + Math.cos(0.9) * 30, 56 + Math.sin(0.9) * 30); // cuerda
    g.fillStyle(0x00695c);
    g.fillCircle(54, 56, 23);
    g.fillStyle(0x00897b);
    g.fillCircle(54, 56, 19);
    g.fillStyle(0xffe0b2);                         // orejas
    poligono(g, [[62, 46], [66, 48], [54, 32]]);
    poligono(g, [[62, 66], [66, 64], [54, 80]]);
    g.fillStyle(0xfff176);
    g.fillCircle(62, 56, 12);                      // cabello
    g.fillStyle(0xffe0b2);
    g.fillCircle(67, 56, 8);                       // cara
    g.fillStyle(0x2e7d32);
    g.fillCircle(71, 53, 2);
    g.fillCircle(71, 59, 2);
  });

  // DERIAL: piel gris con escamas, cabello suelto, ojos rojos de estrella y tridente
  dibujar(escena, 'derial-cuerpo', (g) => {
    g.lineStyle(3, 0xb0bec5);
    g.lineBetween(58, 78, 104, 78);                // asta del tridente
    for (const dy of [-6, 0, 6]) g.lineBetween(98, 78 + dy, 108, 78 + dy); // puntas
    g.lineBetween(98, 72, 98, 84);
    g.fillStyle(0x455a64);
    g.fillCircle(54, 56, 24);
    g.fillStyle(0x78909c);
    g.fillCircle(54, 56, 20);
    g.fillStyle(0x90a4ae, 0.9);                    // escamas en los hombros
    for (const [x, y] of [[48, 40], [56, 38], [48, 72], [56, 74]]) g.fillCircle(x, y, 4);
    g.lineStyle(3, 0x263238);                      // cabello suelto hacia atrás
    for (const dy of [-8, -3, 2, 7]) g.lineBetween(58, 56 + dy, 40, 56 + dy * 1.6);
    g.fillStyle(0x8fa1ab);
    g.fillCircle(64, 56, 11);                      // cabeza
    g.fillStyle(0xff1744);
    estrella(g, 70, 51, 4);
    estrella(g, 70, 61, 4);
  });

  // Cola de anguila de los Derial (va detrás y se menea)
  dibujar(escena, 'derial-cola', (g) => {
    g.fillStyle(0x546e7a);
    poligono(g, [[44, 50], [30, 46], [16, 52], [6, 58], [18, 60], [30, 64], [44, 62]]);
    g.fillStyle(0x37474f);
    poligono(g, [[16, 52], [4, 46], [6, 58]]);     // aleta del final
  });
}
