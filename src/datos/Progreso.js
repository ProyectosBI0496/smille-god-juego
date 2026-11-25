// =============================================================
// Progreso del jugador, guardado en el navegador (localStorage)
// localStorage puede fallar (modo incógnito), por eso todo va con try/catch.
//
// v0.1.5 — COLECCIÓN DE HÉROES
//   El jugador tiene VARIOS héroes (uno por raza + clase) y elige con cuál juega.
//   Cada héroe guarda lo suyo: rol, nivel, puntos, equipo, lo que compró,
//   sus CORONAS y hasta qué mundo/dificultad llegó.
//   Son de la CUENTA (compartido por todos): monedas, pociones, nombre y
//   los héroes que se pagaron con fichas de facción.
// =============================================================

/** Lee un objeto guardado como texto JSON; si no hay o está roto, devuelve "porDefecto" */
function leerJson(clave, porDefecto) {
  try {
    const texto = localStorage.getItem(clave);
    return texto ? JSON.parse(texto) : porDefecto;
  } catch (error) {
    return porDefecto;
  }
}

function guardarJson(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch (error) {
    // sin memoria del navegador: dura solo esta partida
  }
}

// ----------------- Nombre y raza del jugador -----------------

const CLAVE_RAZA = 'smilleGod.raza';
const CLAVE_NICK = 'smilleGod.nick';

/** El nombre del jugador (Etapa 9). Vacío si todavía no puso uno. */
export function nick() {
  try {
    return localStorage.getItem(CLAVE_NICK) || '';
  } catch (error) {
    return '';
  }
}

/** Guarda el nombre: sin espacios de más y con 12 letras como máximo */
export function guardarNick(texto) {
  const limpio = String(texto || '').trim().slice(0, 12);
  try {
    localStorage.setItem(CLAVE_NICK, limpio);
  } catch (error) {
    // sin memoria del navegador
  }
  return limpio;
}

/** La raza del héroe con el que juega (Etapa 8); "humano" si todavía no eligió */
export function razaElegida() {
  try {
    return localStorage.getItem(CLAVE_RAZA) || 'humano';
  } catch (error) {
    return 'humano';
  }
}

function elegirRaza(id) {
  try {
    localStorage.setItem(CLAVE_RAZA, id);
  } catch (error) {
    // sin memoria del navegador
  }
}

// ----------------- Héroes -----------------

const CLAVE_HEROES = 'smilleGod.heroes';        // { "humano.guerrero": { ...héroe } }
const CLAVE_ACTUAL = 'smilleGod.heroeActual';   // "humano.guerrero"
const CLAVE_ABIERTOS = 'smilleGod.heroesAbiertos'; // héroes pagados con fichas de facción

/**
 * Antes de v0.1.5 había UN personaje (smilleGod.personaje) y el progreso de
 * mundos era de la cuenta. Si existe, se pasa a la colección (una sola vez).
 */
function migrarVersionVieja() {
  const viejo = leerJson('smilleGod.personaje', null);
  if (!viejo) return;
  const heroes = leerJson(CLAVE_HEROES, {});
  const id = `${viejo.raza}.${viejo.clase}`;
  if (!heroes[id]) {
    heroes[id] = {
      ...viejo,
      equipo: {},       // el equipo de antes ya no existe en la tienda nueva
      inventario: [],
      coronas: 0,
      mundos: Number(leerJson('smilleGod.mundosSuperados', 0)) || 0,
      dificultades: leerJson('smilleGod.dificultades', {}),
    };
    guardarJson(CLAVE_HEROES, heroes);
    guardarJson(CLAVE_ACTUAL, id);
  }
  try {
    for (const clave of ['smilleGod.personaje', 'smilleGod.mundosSuperados', 'smilleGod.dificultades',
      'smilleGod.inventario', 'smilleGod.nivelMaximo']) localStorage.removeItem(clave);
  } catch (error) {
    // nada que borrar
  }
}

/** Todos los héroes creados: { "humano.guerrero": {...}, "orco.cazador": {...} } */
export function heroes() {
  migrarVersionVieja();
  return leerJson(CLAVE_HEROES, {});
}

/** El héroe con el que juega ahora, o null si todavía no creó ninguno */
export function personaje() {
  const todos = heroes();
  return todos[leerJson(CLAVE_ACTUAL, '')] || Object.values(todos)[0] || null;
}

/** Cambia el héroe con el que juega */
export function elegirHeroe(id) {
  const elegido = heroes()[id];
  if (!elegido) return;
  guardarJson(CLAVE_ACTUAL, id);
  elegirRaza(elegido.raza);
}

/**
 * Guarda un héroe. Se MEZCLA con lo que ya tenía guardado ({ ...antes, ...p }),
 * así no se pierden datos que la escena no conocía (coronas, inventario, mundos...).
 */
export function guardarPersonaje(p) {
  const todos = heroes();
  const id = `${p.raza}.${p.clase}`;
  todos[id] = { ...(todos[id] || {}), ...p };
  guardarJson(CLAVE_HEROES, todos);
}

/** Cambia algo del héroe actual: cambiarActual((h) => { h.coronas += 5; }) */
function cambiarActual(cambio) {
  const h = personaje();
  if (!h) return null;
  cambio(h);
  guardarPersonaje(h);
  return h;
}

/**
 * Crea un héroe nuevo de nivel 1 y juega con él.
 * v0.1.4: con su ROL y unas pociones de regalo (regalo = { vida: 3, mana: 2 }).
 */
export function crearPersonaje(raza, clase, rol, regalo = {}) {
  const p = {
    raza, clase, rol, nivel: 1, puntos: 0,
    est: { fuerza: 0, vida: 0, danio: 0, velocidad: 0, inteligencia: 0, armadura: 0 },
    equipo: {}, inventario: [], coronas: 0, mundos: 0, dificultades: {},
  };
  guardarPersonaje(p);
  elegirHeroe(`${raza}.${clase}`);
  sumarPociones(regalo);
  return p;
}

/** Los héroes que se abrieron pagando fichas de facción: ["humano.paladin", ...] */
export function heroesAbiertos() {
  const lista = leerJson(CLAVE_ABIERTOS, []);
  return Array.isArray(lista) ? lista : [];
}

/** Abre un héroe de la escala pagando sus fichas de facción. Devuelve true si se pudo. */
export function abrirHeroe(id, fichasFaccion) {
  if (monedas().fichasFaccion < fichasFaccion || heroesAbiertos().includes(id)) return false;
  sumarMonedas({ fichasFaccion: -fichasFaccion });
  guardarJson(CLAVE_ABIERTOS, [...heroesAbiertos(), id]);
  return true;
}

// ----------------- Coronas (v0.1.5) -----------------

/** Coronas del JUGADOR: la suma de las de todos sus héroes */
export function coronasJugador() {
  return Object.values(heroes()).reduce((suma, h) => suma + (h.coronas || 0), 0);
}

/**
 * Suma (o resta) coronas al héroe actual; nunca baja de 0.
 * Devuelve { antes, despues } para mostrar el cambio.
 */
export function sumarCoronas(cantidad) {
  let antes = 0;
  const h = cambiarActual((heroe) => {
    antes = heroe.coronas || 0;
    heroe.coronas = Math.max(0, antes + cantidad);
  });
  return { antes, despues: h ? h.coronas : 0 };
}

/** Todo lo que necesita la pantalla de héroes para saber qué está abierto */
export function cuentaParaEscala() {
  return { heroes: heroes(), abiertos: heroesAbiertos(), coronas: coronasJugador(), fichasFaccion: monedas().fichasFaccion };
}

// ----------------- Mazmorras (por héroe desde v0.1.5) -----------------

/** Cuántos mundos superó el héroe actual (0 = solo el primero está abierto) */
export function mundosSuperados() {
  const h = personaje();
  return (h && h.mundos) || 0;
}

/** v0.1.4: la dificultad más alta superada en el mundo "indice" (0 si ninguna) */
export function dificultadSuperada(indice) {
  const h = personaje();
  return Number(h && h.dificultades && h.dificultades[indice]) || 0;
}

/**
 * Marca como superado el mundo número "indice" (0 = el primero) en la "dificultad" dada.
 * Superarlo en cualquier dificultad abre el mundo siguiente (en Iniciado).
 */
export function marcarSuperado(indice, dificultad = 1) {
  cambiarActual((h) => {
    h.mundos = Math.max(h.mundos || 0, indice + 1);
    h.dificultades = h.dificultades || {};
    if (dificultad > (Number(h.dificultades[indice]) || 0)) h.dificultades[indice] = dificultad;
  });
}

// ----------------- Monedas (de la cuenta) -----------------

const CLAVE_MONEDAS = 'smilleGod.monedas';

/** Intys, fichas, rubís y fichas de facción (v0.1.5) de la cuenta */
export function monedas() {
  return { intys: 0, fichas: 0, rubis: 0, fichasFaccion: 0, ...leerJson(CLAVE_MONEDAS, {}) };
}

/** Suma (o resta, con números negativos) monedas: sumarMonedas({ fichas: -2 }) */
export function sumarMonedas(cambio) {
  const m = monedas();
  for (const [clave, cantidad] of Object.entries(cambio)) m[clave] = Math.max(0, (m[clave] || 0) + cantidad);
  guardarJson(CLAVE_MONEDAS, m);
  return m;
}

/** ¿Alcanza la plata para este precio? */
function alcanza(precio) {
  const m = monedas();
  return Object.entries(precio).every(([moneda, cantidad]) => (m[moneda] || 0) >= cantidad);
}

/** Resta un precio de las monedas */
function pagar(precio) {
  const resta = {};
  for (const [moneda, cantidad] of Object.entries(precio)) resta[moneda] = -cantidad;
  sumarMonedas(resta);
}

// ----------------- Pociones (v0.1.4, de la cuenta) -----------------

const CLAVE_POCIONES = 'smilleGod.pociones';

export function pociones() {
  return { vida: 0, mana: 0, ...leerJson(CLAVE_POCIONES, {}) };
}

/** Suma (o resta) pociones: sumarPociones({ vida: -1 }) */
export function sumarPociones(cambio) {
  const p = pociones();
  for (const [clave, cantidad] of Object.entries(cambio)) p[clave] = Math.max(0, (p[clave] || 0) + cantidad);
  guardarJson(CLAVE_POCIONES, p);
  return p;
}

/** Compra UNA poción: resta su precio. Devuelve true si alcanzó. */
export function comprarPocion(id, precio) {
  if (!alcanza(precio)) return false;
  pagar(precio);
  sumarPociones({ [id]: 1 }); // [id]: usa el VALOR de id como nombre de la clave
  return true;
}

// ----------------- Equipo (v0.1.5: de cada héroe) -----------------

/**
 * Lo que tiene el héroe actual: ["casco:0:basico", "manoDerecha:1:god"] (espacio:tier:set).
 * v0.1.7: lo guardado antes de los sets ("casco:0") se lee como set Básico.
 */
export function inventario() {
  const h = personaje();
  const lista = (h && Array.isArray(h.inventario)) ? h.inventario : [];
  return lista.map((id) => (id.split(':').length === 2 ? `${id}:basico` : id));
}

/**
 * v0.1.7: un cofre regala una pieza de equipo al héroe actual.
 * Devuelve false si ya la tenía (entonces el cofre da intys en su lugar).
 */
export function darObjeto(id) {
  if (inventario().includes(id)) return false;
  cambiarActual((h) => { h.inventario = [...inventario(), id]; });
  return true;
}

/** Compra un objeto para el héroe actual: resta su precio y lo guarda. Devuelve true si se pudo. */
export function comprarObjeto(id, precio) {
  if (!alcanza(precio) || inventario().includes(id)) return false;
  pagar(precio);
  cambiarActual((h) => { h.inventario = [...inventario(), id]; });
  return true;
}
