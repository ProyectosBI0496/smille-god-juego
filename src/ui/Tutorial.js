// =============================================================
// Tutorial guiado (v0.1.16)
// Muestra mensajes, uno tras otro, con una FLECHA y un RECUADRO dorado
// que señalan la parte de la pantalla de la que se habla. El resto de la
// pantalla se oscurece. Tocar en cualquier lugar pasa al siguiente mensaje.
//
// Cada grupo de mensajes tiene un "id" (ej. 'titulo'). Cuando el jugador lo
// termina (o toca "Saltar"), se guarda en el navegador y no se vuelve a mostrar.
// En la guía "Cómo se juega" hay un botón para verlo todo otra vez.
//
// Uso:
//   mostrarTutorial(escena, 'titulo', [
//     { texto: '¡Hola!' },                               // sin flecha (al centro)
//     { texto: 'Este es el botón JUGAR', objetivo: boton }, // señala un objeto
//     { texto: 'Tu nombre', objetivo: { texto: 'Jugador:' } }, // busca un texto en pantalla
//   ], { alTerminar: () => {...} });
//
// "objetivo" puede ser: un objeto del juego (botón, texto, rectángulo), un
// { texto: '...' } para buscarlo en la escena, un rectángulo { x, y, ancho, alto }
// (en coordenadas de PANTALLA) o una función que devuelva cualquiera de esos.
// =============================================================

import { FUENTE_TITULO } from '../escenas/EscenaArena.js';
import { heroes, personaje } from '../datos/Progreso.js';

const CLAVE = 'smilleGod.tutorial';
const CLAVE_DUENO = 'smilleGod.heroeDeLaGuia'; // v0.1.19: el héroe que recibe la guía (el primero)
const PROFUNDIDAD = 1000; // por encima de todo
const DORADO = 0xf5c542;

function leer() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE)) || {};
  } catch (error) {
    return {};
  }
}

/** ¿Ya vio este grupo de mensajes? */
export function tutorialVisto(id) {
  return !!leer()[id];
}

/** Lo marca como visto */
export function marcarTutorial(id) {
  const vistos = leer();
  vistos[id] = true;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(vistos));
  } catch (error) {
    // sin memoria del navegador: se mostrará otra vez, no pasa nada
  }
}

/** El id ("raza.clase") del héroe con el que se juega ahora, o null si no hay ninguno */
function idActual() {
  const p = personaje();
  return p ? `${p.raza}.${p.clase}` : null;
}

/**
 * v0.1.19: la guía es SOLO para el PRIMER héroe del jugador.
 * - Sin héroes todavía (está creando el primero): sí.
 * - Con héroes: solo si el que juega ahora es el "dueño" de la guía.
 *   El dueño se guarda la primera vez; en partidas viejas se toma el primer héroe creado.
 */
export function guiaParaEsteHeroe() {
  const ids = Object.keys(heroes());
  if (ids.length === 0) return true;
  let dueno = null;
  try {
    dueno = localStorage.getItem(CLAVE_DUENO);
    if (!dueno || !ids.includes(dueno)) {
      dueno = ids[0];
      localStorage.setItem(CLAVE_DUENO, dueno);
    }
  } catch (error) {
    dueno = ids[0];
  }
  return idActual() === dueno;
}

/** Borra todo: el tutorial se verá de nuevo desde el principio (con el héroe de ahora) */
export function reiniciarTutorial() {
  try {
    localStorage.removeItem(CLAVE);
    const id = idActual();
    if (id) localStorage.setItem(CLAVE_DUENO, id); // "Repetir la guía" la da al héroe actual
  } catch (error) {
    // nada que borrar
  }
}

/** ¿Hay un tutorial abierto en esta escena? (la partida lo usa para quedarse quieta) */
export function tutorialAbierto(escena) {
  return !!escena.tutorialActual;
}

/**
 * Busca un texto en la escena (el primero visible que lo contenga)
 * y devuelve el objeto, o null si no está.
 */
function buscarTexto(escena, buscado, lista = escena.children.list) {
  for (const o of lista) {
    if (o.type === 'Text' && o.visible && o.text && o.text.includes(buscado)) return o;
    // Los paneles (contenedores) tienen sus propios objetos adentro: se busca también ahí
    if (o.type === 'Container') {
      const dentro = buscarTexto(escena, buscado, o.list);
      if (dentro) return dentro;
    }
  }
  return null;
}

/** Convierte el "objetivo" de un paso en un rectángulo de PANTALLA { x, y, ancho, alto } (x, y = esquina) */
function rectanguloDe(escena, objetivo) {
  if (typeof objetivo === 'function') objetivo = objetivo();
  if (!objetivo) return null;
  if (objetivo.texto !== undefined && !objetivo.getBounds) objetivo = buscarTexto(escena, objetivo.texto);
  if (!objetivo) return null;
  if (objetivo.getBounds) {
    const r = objetivo.getBounds();
    // Los objetos que se mueven con la cámara (el héroe, un monstruo) se pasan a coordenadas de pantalla
    const camara = escena.cameras.main;
    const fijo = objetivo.scrollFactorX === 0 || (objetivo.parentContainer && objetivo.parentContainer.scrollFactorX === 0);
    const dx = fijo ? 0 : camara.worldView.x;
    const dy = fijo ? 0 : camara.worldView.y;
    return { x: r.x - dx, y: r.y - dy, ancho: r.width, alto: r.height };
  }
  return objetivo; // ya era un rectángulo
}

/**
 * Muestra los pasos de un tutorial (si no se vio antes).
 * opciones: { alTerminar, forzar (mostrarlo aunque ya se haya visto),
 *            soloPrimerHeroe (true: no sale si ya existe algún héroe, p. ej. al crear el segundo) }
 * Devuelve true si se mostró.
 */
export function mostrarTutorial(escena, id, pasos, opciones = {}) {
  const { alTerminar = null, forzar = false, soloPrimerHeroe = false } = opciones;
  // v0.1.19: con un segundo héroe (o creándolo) la guía ya no sale
  const noToca = !forzar && (tutorialVisto(id) || !guiaParaEsteHeroe()
    || (soloPrimerHeroe && Object.keys(heroes()).length > 0));
  if (noToca || escena.tutorialActual) {
    // Ya visto (o ya hay otro abierto): no se muestra
    if (alTerminar && !escena.tutorialActual) alTerminar();
    return false;
  }
  // El paso en que iba se guarda en el "registry" del juego (sobrevive si la escena se rearma,
  // por ejemplo al entrar a pantalla completa con el primer toque)
  const pasoGuardado = `tutorial.${id}`;
  const tutorial = { capa: null, indice: Math.min(escena.registry.get(pasoGuardado) || 0, pasos.length - 1) };
  escena.tutorialActual = tutorial;

  const terminar = () => {
    marcarTutorial(id);
    escena.registry.remove(pasoGuardado);
    if (tutorial.capa) tutorial.capa.destroy();
    escena.tutorialActual = null;
    if (alTerminar) alTerminar();
  };
  // Si la escena se cierra con el tutorial abierto, se olvida (se mostrará otra vez)
  escena.events.once('shutdown', () => { escena.tutorialActual = null; });

  const mostrarPaso = () => {
    if (tutorial.capa) tutorial.capa.destroy();
    const paso = pasos[tutorial.indice];
    const W = escena.scale.baseSize.width;
    const H = escena.scale.baseSize.height;
    const capa = escena.add.container(0, 0).setDepth(PROFUNDIDAD).setScrollFactor(0);
    tutorial.capa = capa;
    const r = rectanguloDe(escena, paso.objetivo);

    // 1) OSCURECER todo menos el objetivo: 4 rectángulos alrededor del "hueco"
    const sombra = (x, y, ancho, alto) => {
      if (ancho <= 0 || alto <= 0) return;
      capa.add(escena.add.rectangle(x, y, ancho, alto, 0x000000, 0.6).setOrigin(0));
    };
    if (r) {
      const m = 8; // margen alrededor del objetivo
      const hx = Math.max(0, r.x - m);
      const hy = Math.max(0, r.y - m);
      const hx2 = Math.min(W, r.x + r.ancho + m);
      const hy2 = Math.min(H, r.y + r.alto + m);
      sombra(0, 0, W, hy);              // arriba
      sombra(0, hy2, W, H - hy2);       // abajo
      sombra(0, hy, hx, hy2 - hy);      // izquierda
      sombra(hx2, hy, W - hx2, hy2 - hy); // derecha
      // Recuadro dorado que "late" alrededor del objetivo
      const marco = escena.add.rectangle(hx, hy, hx2 - hx, hy2 - hy).setOrigin(0).setStrokeStyle(4, DORADO);
      capa.add(marco);
      escena.tweens.add({ targets: marco, alpha: 0.35, duration: 500, yoyo: true, repeat: -1 });
    } else {
      sombra(0, 0, W, H);
    }

    // 2) Toda la pantalla es "tocar para seguir" (y así nada de abajo recibe el toque)
    const tapa = escena.add.zone(0, 0, W, H).setOrigin(0).setInteractive();
    capa.add(tapa);
    const mostradoEn = performance.now(); // reloj del navegador (el de la partida puede estar en pausa)
    tapa.on('pointerdown', () => {
      // Medio segundo de espera: evita pasar dos mensajes con un solo toque
      if (performance.now() - mostradoEn < 450) return;
      tutorial.indice += 1;
      escena.registry.set(pasoGuardado, tutorial.indice);
      if (tutorial.indice >= pasos.length) terminar();
      else mostrarPaso();
    });

    // 3) El GLOBO con el texto: arriba o abajo del objetivo (donde haya más espacio)
    const anchoGlobo = Math.min(640, W - 40);
    const texto = escena.add.text(0, 0, paso.texto, {
      fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#ffffff', lineSpacing: 5,
      wordWrap: { width: anchoGlobo - 40 },
    });
    const pie = escena.add.text(0, 0, `Toca para seguir  ·  ${tutorial.indice + 1} / ${pasos.length}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#ffe082',
    });
    const altoGlobo = texto.height + pie.height + 44;
    const ESPACIO_FLECHA = 70;
    let gx = W / 2 - anchoGlobo / 2;
    let gy = H / 2 - altoGlobo / 2;
    let flechaArriba = null; // true = la flecha apunta hacia ARRIBA (globo debajo del objetivo)
    if (r) {
      const cx = r.x + r.ancho / 2;
      gx = Phaser.Math.Clamp(cx - anchoGlobo / 2, 20, W - anchoGlobo - 20);
      const espacioArriba = r.y;
      const espacioAbajo = H - (r.y + r.alto);
      if (espacioAbajo >= espacioArriba) {
        gy = Math.min(r.y + r.alto + ESPACIO_FLECHA, H - altoGlobo - 10);
        flechaArriba = true;
      } else {
        gy = Math.max(r.y - ESPACIO_FLECHA - altoGlobo, 10);
        flechaArriba = false;
      }
    }
    const globo = escena.add.rectangle(gx, gy, anchoGlobo, altoGlobo, 0x0b0f1a, 0.96).setOrigin(0).setStrokeStyle(3, DORADO);
    texto.setPosition(gx + 20, gy + 18);
    pie.setPosition(gx + 20, gy + altoGlobo - pie.height - 12);
    capa.add([globo, texto, pie]);

    // Botón "Saltar": cierra este grupo de mensajes (y lo marca como visto)
    const saltar = escena.add.text(gx + anchoGlobo - 14, gy + altoGlobo - 10, 'Saltar ✕', {
      fontFamily: FUENTE_TITULO, fontSize: '18px', fontStyle: 'bold', color: '#ef9a9a',
    }).setOrigin(1, 1).setPadding(10, 6).setInteractive();
    saltar.on('pointerdown', terminar);
    capa.add(saltar);

    // 4) La FLECHA que señala el objetivo (sube y baja para llamar la atención)
    if (r) {
      const fx = Phaser.Math.Clamp(r.x + r.ancho / 2, 30, W - 30);
      const fy = flechaArriba ? Math.max(gy - 34, r.y + r.alto + 30) : Math.min(gy + altoGlobo + 34, r.y - 30);
      const flecha = escena.add.text(fx, fy, flechaArriba ? '▲' : '▼', {
        fontFamily: 'Arial, sans-serif', fontSize: '52px', color: '#f5c542', stroke: '#3a1500', strokeThickness: 6,
      }).setOrigin(0.5);
      capa.add(flecha);
      escena.tweens.add({ targets: flecha, y: fy + (flechaArriba ? -12 : 12), duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // v0.1.19 ARREGLO "guía congelada": cada objeto de la capa también debe quedar fijo en
    // la pantalla. Phaser dibuja los hijos con el scrollFactor del contenedor, pero para
    // saber si los TOCASTE usa el de cada hijo. En la mazmorra la cámara se mueve con el
    // héroe, así que los toques no "caían" sobre la tapa ni sobre "Saltar".
    capa.each((objeto) => objeto.setScrollFactor(0));
  };

  mostrarPaso();
  return true;
}
