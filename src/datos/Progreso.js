// =============================================================
// Progreso del jugador, guardado en el navegador (localStorage)
// Etapa 6: cuántos mundos superó (y por lo tanto cuáles están abiertos).
// localStorage puede fallar (modo incógnito), por eso todo va con try/catch.
// =============================================================

const CLAVE_MUNDOS = 'smilleGod.mundosSuperados';

/** Cuántos mundos superó el jugador (0 = solo el primero está abierto) */
export function mundosSuperados() {
  try {
    return Number(localStorage.getItem(CLAVE_MUNDOS)) || 0;
  } catch (error) {
    return 0;
  }
}

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

/** La raza que eligió el jugador (Etapa 8); "humano" si todavía no eligió */
export function razaElegida() {
  try {
    return localStorage.getItem(CLAVE_RAZA) || 'humano';
  } catch (error) {
    return 'humano';
  }
}

export function elegirRaza(id) {
  try {
    localStorage.setItem(CLAVE_RAZA, id);
  } catch (error) {
    // sin memoria del navegador: la elección dura solo esta partida
  }
}

// =============================================================
// v0.1.2 — PERSONAJE FIJO, MONEDAS Y COFRES
// El jugador crea UN personaje (raza + clase). Ese personaje sube de nivel
// gastando FICHAS y en cada nivel reparte puntos de ESTADÍSTICAS.
// Para cambiar de raza o clase hay que borrarlo y crear otro (vuelve a nivel 1).
// Las monedas (intys, fichas, rubís) son de la CUENTA: no se pierden al borrar.
// =============================================================

const CLAVE_PERSONAJE = 'smilleGod.personaje';
const CLAVE_MONEDAS = 'smilleGod.monedas';
const CLAVE_NIVEL_MAX = 'smilleGod.nivelMaximo';

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

/** El personaje guardado, o null si todavía no creó uno */
export function personaje() {
  return leerJson(CLAVE_PERSONAJE, null);
}

export function guardarPersonaje(p) {
  guardarJson(CLAVE_PERSONAJE, p);
  if (p.nivel > nivelMaximo()) guardarJson(CLAVE_NIVEL_MAX, p.nivel); // abre clases nuevas
}

/**
 * Crea un personaje nuevo de nivel 1, sin puntos repartidos.
 * v0.1.4: también guarda el ROL y regala unas pociones para empezar (regalo = { vida: 3, mana: 2 }).
 */
export function crearPersonaje(raza, clase, rol, regalo = {}) {
  const p = {
    raza, clase, rol, nivel: 1, puntos: 0,
    est: { fuerza: 0, vida: 0, danio: 0, velocidad: 0, inteligencia: 0, armadura: 0 },
  };
  elegirRaza(raza);
  guardarPersonaje(p);
  sumarPociones(regalo);
  return p;
}

/** Borra el personaje. v0.1.4: las mazmorras y sus dificultades vuelven a empezar. */
export function borrarPersonaje() {
  try {
    localStorage.removeItem(CLAVE_PERSONAJE);
    localStorage.removeItem(CLAVE_MUNDOS);
    localStorage.removeItem(CLAVE_DIFICULTADES);
  } catch (error) {
    // nada que borrar
  }
}

/** El nivel más alto que alcanzó cualquiera de sus personajes (abre clases) */
export function nivelMaximo() {
  return Number(leerJson(CLAVE_NIVEL_MAX, 1)) || 1;
}

/** Intys, fichas y rubís de la cuenta */
export function monedas() {
  return { intys: 0, fichas: 0, rubis: 0, ...leerJson(CLAVE_MONEDAS, {}) };
}

/** Suma (o resta, con números negativos) monedas: sumarMonedas({ fichas: -2 }) */
export function sumarMonedas(cambio) {
  const m = monedas();
  for (const [clave, cantidad] of Object.entries(cambio)) m[clave] = Math.max(0, (m[clave] || 0) + cantidad);
  guardarJson(CLAVE_MONEDAS, m);
  return m;
}

// v0.1.4: DIFICULTADES. Por cada mundo se guarda la dificultad más alta superada
// (0 = ninguna, 1 = Iniciado ... 5 = Divino). Ejemplo: { "0": 2, "1": 1 }
const CLAVE_DIFICULTADES = 'smilleGod.dificultades';

/** La dificultad más alta superada en el mundo "indice" (0 si ninguna) */
export function dificultadSuperada(indice) {
  return Number(leerJson(CLAVE_DIFICULTADES, {})[indice]) || 0;
}

/**
 * Marca como superado el mundo número "indice" (0 = el primero) en la "dificultad" dada.
 * Superarlo en cualquier dificultad abre el mundo siguiente (en Iniciado).
 */
export function marcarSuperado(indice, dificultad = 1) {
  try {
    if (indice + 1 > mundosSuperados()) localStorage.setItem(CLAVE_MUNDOS, String(indice + 1));
  } catch (error) {
    // sin memoria del navegador: el progreso solo dura esta partida
  }
  const todas = leerJson(CLAVE_DIFICULTADES, {});
  if (dificultad > (Number(todas[indice]) || 0)) {
    todas[indice] = dificultad;
    guardarJson(CLAVE_DIFICULTADES, todas);
  }
}

// =============================================================
// v0.1.4 — POCIONES (reemplazan a la cura)
// Son de la CUENTA, como las monedas: { vida: 3, mana: 2 }
// =============================================================

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
  const m = monedas();
  const alcanza = Object.entries(precio).every(([moneda, cantidad]) => (m[moneda] || 0) >= cantidad);
  if (!alcanza) return false;
  const resta = {};
  for (const [moneda, cantidad] of Object.entries(precio)) resta[moneda] = -cantidad;
  sumarMonedas(resta);
  sumarPociones({ [id]: 1 }); // [id]: usa el VALOR de id como nombre de la clave
  return true;
}

// =============================================================
// v0.1.3 — TIENDA DE EQUIPO
// Lo que se COMPRA es de la cuenta (como las monedas): no se pierde al
// borrar el personaje. Lo que se EQUIPA es del personaje (p.equipo).
// =============================================================

const CLAVE_INVENTARIO = 'smilleGod.inventario';

/** Lista de los objetos comprados, por ejemplo ["espadaCorta", "amuletoVida"] */
export function inventario() {
  const lista = leerJson(CLAVE_INVENTARIO, []);
  return Array.isArray(lista) ? lista : [];
}

/** Compra un objeto: resta su precio y lo guarda. Devuelve true si se pudo. */
export function comprarObjeto(id, precio) {
  const m = monedas();
  // ¿alcanza cada moneda del precio? (every = "todas cumplen")
  const alcanza = Object.entries(precio).every(([moneda, cantidad]) => (m[moneda] || 0) >= cantidad);
  if (!alcanza || inventario().includes(id)) return false;
  const resta = {};
  for (const [moneda, cantidad] of Object.entries(precio)) resta[moneda] = -cantidad;
  sumarMonedas(resta);
  guardarJson(CLAVE_INVENTARIO, [...inventario(), id]);
  return true;
}
