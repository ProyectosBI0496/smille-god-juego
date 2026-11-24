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

  // ===== v0.1.2: las 6 razas nuevas del Excel del creador =====

  // ENANO: ancho y bajo, barba larga trenzada, casco con cuernitos y un martillo
  dibujar(escena, 'enano-cuerpo', (g) => {
    g.lineStyle(5, 0x5d4037);
    g.lineBetween(58, 78, 94, 82);                 // mango del martillo
    g.fillStyle(0x9e9e9e);
    g.fillRect(88, 70, 14, 24);                    // cabeza del martillo
    g.fillStyle(0x4e342e);
    g.fillCircle(54, 56, 28);                      // cuerpo muy ancho
    g.fillStyle(0x8d6e63);
    g.fillCircle(54, 56, 24);
    g.fillStyle(0xbf6b2c);                         // barba (hacia adelante)
    poligono(g, [[66, 46], [88, 52], [92, 56], [88, 60], [66, 66]]);
    g.fillStyle(0x9e9e9e);
    g.fillCircle(62, 56, 12);                      // casco
    g.fillStyle(0xfff8e1);                         // cuernitos del casco
    poligono(g, [[58, 46], [62, 44], [56, 34]]);
    poligono(g, [[58, 66], [62, 68], [56, 78]]);
    g.fillStyle(0x263238);
    g.fillCircle(70, 52, 2);
    g.fillCircle(70, 60, 2);
  });

  // LYCAN: lobo gris, hocico largo, orejas de punta y garras
  dibujar(escena, 'lycan-cuerpo', (g) => {
    g.fillStyle(0xeceff1);                         // garras
    for (const [x, y] of [[74, 30], [78, 34], [74, 82], [78, 78]]) poligono(g, [[x, y], [x + 10, y + (y < 56 ? -2 : 2)], [x + 2, y + (y < 56 ? 4 : -4)]]);
    g.fillStyle(0x37474f);
    g.fillCircle(52, 56, 27);
    g.fillStyle(0x607d8b);
    g.fillCircle(52, 56, 23);
    g.fillStyle(0x546e7a);                         // orejas
    poligono(g, [[58, 44], [64, 46], [52, 30]]);
    poligono(g, [[58, 68], [64, 66], [52, 82]]);
    g.fillStyle(0x78909c);
    g.fillCircle(62, 56, 12);                      // cabeza
    g.fillStyle(0x90a4ae);
    g.fillEllipse(78, 56, 18, 12);                 // hocico largo
    g.fillStyle(0x212121);
    g.fillCircle(86, 56, 3);                       // nariz
    g.fillStyle(0xffd54f);
    g.fillCircle(68, 50, 2.5);
    g.fillCircle(68, 62, 2.5);
  });

  // GNOMO: muy pequeño, gorro rojo puntiagudo, gafas y una llave inglesa
  dibujar(escena, 'gnomo-cuerpo', (g) => {
    g.lineStyle(4, 0x90a4ae);
    g.lineBetween(56, 72, 82, 78);                 // llave inglesa
    g.strokeCircle(86, 79, 5);
    g.fillStyle(0x1565c0);
    g.fillCircle(52, 56, 18);                      // cuerpo pequeño
    g.fillStyle(0x1e88e5);
    g.fillCircle(52, 56, 15);
    g.fillStyle(0xe53935);                         // gorro: un triángulo hacia atrás
    poligono(g, [[62, 46], [62, 66], [30, 56]]);
    g.fillStyle(0xffccbc);
    g.fillCircle(62, 56, 9);                       // cara
    g.lineStyle(2, 0x5d4037);
    g.strokeCircle(66, 52, 3);                     // gafas
    g.strokeCircle(66, 60, 3);
  });

  // MUERTO: no-muerto pálido, capucha negra, costillas a la vista y una guadaña
  dibujar(escena, 'muerto-cuerpo', (g) => {
    g.lineStyle(4, 0x6d4c41);
    g.lineBetween(56, 80, 100, 80);                // asta de la guadaña
    g.fillStyle(0xcfd8dc);
    poligono(g, [[96, 80], [108, 64], [104, 82]]); // hoja
    g.fillStyle(0x212121);
    g.fillCircle(54, 56, 25);                      // capucha / capa
    g.fillStyle(0x37474f);
    g.fillCircle(54, 56, 21);
    g.lineStyle(2, 0xb0bec5, 0.9);                 // costillas
    for (const dx of [-8, -2, 4]) g.lineBetween(50 + dx, 46, 50 + dx, 66);
    g.fillStyle(0xc5cae9);
    g.fillCircle(64, 56, 11);                      // cráneo
    g.fillStyle(0x00e5ff);                         // ojos que brillan
    g.fillCircle(69, 52, 2.5);
    g.fillCircle(69, 60, 2.5);
  });

  // ELFO DE SANGRE: capa roja y dorada, cabello blanco, orejas largas y un orbe
  dibujar(escena, 'elfosangre-cuerpo', (g) => {
    g.fillStyle(0xff7043, 0.5);
    g.fillCircle(90, 76, 10);                      // brillo del orbe
    g.fillStyle(0xffab40);
    g.fillCircle(90, 76, 6);                       // orbe
    g.fillStyle(0x8e0000);
    g.fillCircle(54, 56, 23);
    g.fillStyle(0xc62828);
    g.fillCircle(54, 56, 19);
    g.lineStyle(3, 0xffc107);
    g.strokeCircle(54, 56, 19);                    // borde dorado
    g.fillStyle(0xffe0b2);                         // orejas largas
    poligono(g, [[62, 46], [66, 48], [50, 26]]);
    poligono(g, [[62, 66], [66, 64], [50, 86]]);
    g.fillStyle(0xfafafa);
    g.fillCircle(62, 56, 12);                      // cabello blanco
    g.fillStyle(0xffe0b2);
    g.fillCircle(67, 56, 8);                       // cara
    g.fillStyle(0x76ff03);
    g.fillCircle(71, 53, 2);
    g.fillCircle(71, 59, 2);
  });

  // TROLL: piel azul, colmillos hacia arriba, cresta roja y una lanza
  dibujar(escena, 'troll-cuerpo', (g) => {
    g.lineStyle(3, 0x8d6e63);
    g.lineBetween(58, 80, 106, 80);                // lanza
    g.fillStyle(0xcfd8dc);
    poligono(g, [[104, 75], [112, 80], [104, 85]]);
    g.fillStyle(0x00838f);
    g.fillCircle(52, 56, 24);
    g.fillStyle(0x26a69a);
    g.fillCircle(52, 56, 20);
    g.fillStyle(0xd32f2f);                         // cresta de pelo
    poligono(g, [[60, 52], [60, 60], [34, 58], [36, 54]]);
    g.fillStyle(0x4db6ac);
    g.fillCircle(64, 56, 12);                      // cabeza
    g.fillStyle(0xfff8e1);                         // colmillos largos
    poligono(g, [[72, 48], [84, 42], [76, 52]]);
    poligono(g, [[72, 64], [84, 70], [76, 60]]);
    g.fillStyle(0xffeb3b);
    g.fillCircle(70, 52, 2.5);
    g.fillCircle(70, 60, 2.5);
  });
}
