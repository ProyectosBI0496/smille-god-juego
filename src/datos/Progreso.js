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

/** Marca como superado el mundo número "indice" (0 = el primero) */
export function marcarSuperado(indice) {
  try {
    if (indice + 1 > mundosSuperados()) localStorage.setItem(CLAVE_MUNDOS, String(indice + 1));
  } catch (error) {
    // sin memoria del navegador: el progreso solo dura esta partida
  }
}
