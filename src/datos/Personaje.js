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
  // v0.1.3: el equipo puesto (una cosa por ranura). Si un objeto no existe o es de otra ranura, se quita.
  const equipo = {};
  for (const ranura of Object.keys(balance.equipo.ranuras)) {
    const id = p && p.equipo && p.equipo[ranura];
    const obj = balance.equipo.objetos[id];
    if (obj && obj.ranura === ranura) equipo[ranura] = id;
  }
  return { raza, clase, nivel, puntos: Math.max(0, Number(p && p.puntos) || 0), est, equipo };
}

/**
 * v0.1.3: los puntos de estadísticas que REGALA el equipo puesto.
 * El equipo puede dar cualquier estadística (aunque no sea de los roles de la clase):
 * así un Guerrero con un anillo veloz corre un poco más.
 */
export function bonosEquipo(balance, p) {
  const total = {};
  for (const id of Object.keys(balance.estadisticas.lista)) total[id] = 0;
  for (const idObjeto of Object.values(p.equipo || {})) {
    const obj = balance.equipo.objetos[idObjeto];
    if (!obj) continue;
    for (const [est, cantidad] of Object.entries(obj.bonos)) total[est] = (total[est] || 0) + cantidad;
  }
  return total;
}

/** Texto corto de los bonos de un objeto: "+2 Daño · +1 Vida" */
export function textoBonos(balance, bonos) {
  // Si da lo mismo a TODAS las estadísticas, se dice corto: "+1 a todas las estadísticas"
  const valores = Object.keys(balance.estadisticas.lista).map((id) => bonos[id]);
  if (valores.every((n) => n > 0 && n === valores[0])) return `+${valores[0]} a todas las estadísticas`;
  return Object.entries(bonos).map(([est, n]) => `+${n} ${balance.estadisticas.lista[est].nombre}`).join(' · ');
}

/** Texto del precio: "☀️ 60" o "💎 3" */
export function textoPrecio(precio) {
  const iconos = { intys: '☀️', fichas: '🎟️', rubis: '💎' };
  return Object.entries(precio).map(([moneda, n]) => `${iconos[moneda]} ${n}`).join(' + ');
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
  // Estadísticas finales = puntos repartidos + bonos del equipo
  const bonos = bonosEquipo(balance, p);
  const e = {};
  for (const id of Object.keys(p.est)) e[id] = p.est[id] + (bonos[id] || 0);
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
  return { raza: p.raza, clase: p.clase, nivel: p.nivel, est: p.est, equipo: p.equipo || {} };
}

/** Nombre corto de cada habilidad (para mostrarlo en los menús) */
export const NOMBRE_HABILIDAD = {
  atq: 'Golpe', onda: 'Onda', torb: 'Torbellino',
  cuch: 'Cuchilladas', paso: 'Paso sombrío', crit: 'Golpe crítico',
  bola: 'Proyectil', abanico: 'Abanico', sanar: 'Sanar al grupo',
};
