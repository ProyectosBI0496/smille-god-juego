// =============================================================
// Personaje (v0.1.2): las CUENTAS del personaje, sin dibujar nada.
//   - Qué clases puede elegir cada raza (y cuáles están bloqueadas).
//   - Qué estadísticas puede subir cada clase (según sus ROLES).
//   - Cuánto cuesta subir de nivel.
//   - Los números finales del héroe en la partida (vida, velocidad, daño...).
// Todos los números salen de balance.json → "clases", "estadisticas", "progreso".
// Tenerlo aparte sirve para usarlo igual con MI héroe y con el del compañero.
// =============================================================

/** Las clases de una raza en orden, con el nivel que hace falta para abrir cada una */
export function clasesDeRaza(balance, idRaza, nivelMaximo) {
  const raza = balance.razas[idRaza];
  const niveles = balance.progreso.desbloqueoClases;
  return raza.clases.map((id, i) => {
    // Si la lista de niveles es más corta, las clases sobrantes usan el último + 2 por cada una
    const necesario = niveles[i] ?? niveles[niveles.length - 1] + 2 * (i - niveles.length + 1);
    return { id, necesario, abierta: nivelMaximo >= necesario };
  });
}

/** Las estadísticas que la clase puede subir: las de sus roles (tanque, dps, sanador) */
export function estadisticasDeClase(balance, idClase) {
  const roles = balance.clases[idClase].roles;
  return Object.entries(balance.estadisticas.lista)
    .filter(([, est]) => roles.includes(est.rol))
    .map(([id]) => id);
}

/** Fichas necesarias para pasar del nivel "nivel" al siguiente */
export function costoNivel(balance, nivel) {
  const p = balance.progreso;
  return p.fichasBase + nivel * p.fichasPorNivel;
}

/** "Humano Guerrero" */
export function nombrePersonaje(balance, p) {
  return `${balance.razas[p.raza].nombre} ${balance.clases[p.clase].nombre}`;
}

/** Corrige un personaje que llegó mal (por la red o de una versión vieja) */
export function personajeValido(balance, p) {
  const raza = p && balance.razas[p.raza] ? p.raza : 'humano';
  const clase = p && balance.clases[p.clase] ? p.clase : 'guerrero';
  const est = {};
  for (const id of Object.keys(balance.estadisticas.lista)) {
    est[id] = Math.max(0, Math.floor(Number(p && p.est && p.est[id]) || 0));
  }
  const nivel = Phaser.Math.Clamp(Math.floor(Number(p && p.nivel) || 1), 1, balance.progreso.nivelMax);
  return { raza, clase, nivel, puntos: Math.max(0, Number(p && p.puntos) || 0), est };
}

/**
 * Los números del héroe en la partida.
 * Raza × clase da la base; los puntos de estadísticas la mejoran.
 */
export function calcularHeroe(balance, entrada) {
  const p = personajeValido(balance, entrada);
  const raza = balance.razas[p.raza];
  const clase = balance.clases[p.clase];
  const pp = balance.estadisticas.porPunto;
  const lim = balance.estadisticas.limites;
  const e = p.est;
  // Cuántos botones tiene abiertos (botón 2 y 3 se abren al subir de nivel)
  const botones = balance.progreso.nivelBotones.filter((n) => p.nivel >= n).length;
  return {
    personaje: p,
    idRaza: p.raza,
    idClase: p.clase,
    raza,
    clase,
    botones,
    vidaMax: Math.round(raza.vidaMax * clase.vida + e.vida * pp.vida + e.fuerza * pp.fuerzaVida),
    velocidad: Math.round(raza.velocidad * clase.velocidad * (1 + e.velocidad * pp.velocidad)),
    mult: {
      // daño físico (golpes, cuchillas) y mágico (proyectiles); la raza también suma
      fisico: raza.danio * (1 + e.danio * pp.danio + e.fuerza * pp.fuerzaDanio),
      magia: raza.danio * (1 + e.danio * pp.danio + e.inteligencia * pp.inteligenciaMagia),
      cura: (raza.cura || 1) * (1 + e.inteligencia * pp.inteligenciaCura),
      recarga: raza.recarga * Math.max(lim.recargaMin, 1 - e.velocidad * pp.recarga),
    },
    // la armadura quita una parte del daño recibido (con un tope)
    reduccion: Math.min(lim.armaduraMax, e.armadura * pp.armadura),
  };
}

/** Lo que se le cuenta al compañero por la red: solo lo necesario */
export function paraLaRed(p) {
  return { raza: p.raza, clase: p.clase, nivel: p.nivel, est: p.est };
}

/** Nombre corto de cada habilidad (para mostrarlo en los menús) */
export const NOMBRE_HABILIDAD = {
  atq: 'Golpe', onda: 'Onda', torb: 'Torbellino',
  cuch: 'Cuchilladas', paso: 'Paso sombrío', crit: 'Golpe crítico',
  bola: 'Proyectil', abanico: 'Abanico', sanar: 'Sanar al grupo',
};
