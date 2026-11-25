// =============================================================
// Personaje: las CUENTAS de un héroe, sin dibujar nada.
//   - Qué estadísticas puede subir (según su ROL, v0.1.4).
//   - Qué poderes tiene (clase + rol → balance.json → "poderes", v0.1.4).
//   - v0.1.5: estadísticas que crecen solas con el NIVEL (Excel), equipo
//     de 8 espacios, armas según raza + clase + rol, coronas y RANGO,
//     y qué pide abrir cada héroe de la escala.
//   - Los números finales del héroe en la partida (vida, velocidad, daño...).
// Todos los números salen de balance.json. Tenerlo aparte sirve para usarlo
// igual con MI héroe y con el del compañero.
// =============================================================

/** Identificador de un héroe: "humano.guerrero" (cada raza + clase es un héroe distinto) */
export function idHeroe(raza, clase) {
  return `${raza}.${clase}`;
}

/**
 * v0.1.4: las estadísticas que se pueden subir con puntos son las del ROL elegido
 * (un Paladín Tanque sube Fuerza y Vida; un Paladín Sanador, Inteligencia y Armadura).
 */
export function estadisticasDeRol(balance, idRol) {
  return Object.entries(balance.estadisticas.lista)
    .filter(([, est]) => est.rol === idRol)
    .map(([id]) => id);
}

/** v0.1.4: el set de poderes de una clase con un rol (balance.json → poderes) */
export function poderesDe(balance, idClase, idRol) {
  return balance.poderes[idClase][idRol];
}

/** v0.1.5: fichas para pasar del nivel "nivel" al siguiente (Excel Escala_Fichas_Nivel_25) */
export function costoNivel(balance, nivel) {
  return balance.progreso.fichasPorNivel[nivel] ?? Infinity;
}

/** "Humano Guerrero" (con conRol: "Humano Guerrero · Tanque") */
export function nombrePersonaje(balance, p, conRol = false) {
  const nombre = `${balance.razas[p.raza].nombre} ${balance.clases[p.clase].nombre}`;
  return conRol && p.rol ? `${nombre} · ${balance.nombresRol[p.rol]}` : nombre;
}

// =============================================================
// v0.1.5 — CORONAS Y RANGO
// Cada héroe junta sus propias coronas (ganando y perdiendo mazmorras).
// Su RANGO (1 a 20) depende de esas coronas (Excel Escala_Rangos_Heroes).
// =============================================================

/** El rango de un héroe con "coronas": { rango, insignia, color, desde, siguiente } */
export function rangoDe(balance, coronas) {
  const lista = balance.rangos.lista;
  let i = 0;
  while (i + 1 < lista.length && coronas >= lista[i + 1].desde) i += 1;
  // siguiente = coronas que faltan para el próximo rango (null si ya es el máximo)
  return { ...lista[i], siguiente: lista[i + 1] ? lista[i + 1].desde : null };
}

/**
 * v0.1.5: cómo está cada héroe de la ESCALA para este jugador.
 *   cuenta = { heroes, abiertos, coronas, fichasFaccion } (lo da Progreso.js)
 * Devuelve la lista en el orden del Excel, cada uno con:
 *   creado (ya lo tiene), abierto (gratis o pagado), y si cumple cada requisito.
 */
export function estadoEscala(balance, cuenta) {
  // El rango más alto entre todos sus héroes (algunos héroes piden "Rango 7")
  const rangoMax = Math.max(1, ...Object.values(cuenta.heroes).map((h) => rangoDe(balance, h.coronas || 0).rango));
  return balance.escala.lista.map((e) => {
    const id = idHeroe(e.raza, e.clase);
    const gratis = e.coronas === 0 && e.fichasFaccion === 0;
    const okCoronas = cuenta.coronas >= e.coronas;
    const okRango = rangoMax >= e.rango;
    const okFichas = cuenta.fichasFaccion >= e.fichasFaccion;
    const abierto = gratis || cuenta.abiertos.includes(id);
    return {
      ...e, id, gratis, abierto,
      creado: !!cuenta.heroes[id],
      okCoronas, okRango, okFichas,
      puedeAbrir: !abierto && okCoronas && okRango && okFichas,
    };
  });
}

// =============================================================
// v0.1.5 — ESTADÍSTICAS
// Valor de cada estadística = base del Excel (según ROL y NIVEL)
//                           + (puntos repartidos + puntos del equipo) × porPunto
// Velocidad y Armadura son porcentajes (0.2 = 20%).
// =============================================================

/** Base del Excel para un rol en un nivel: { fuerza, vida, danio, ... } */
export function estadisticasBase(balance, rol, nivel) {
  const tabla = balance.estadisticas.porNivel[rol];
  return tabla[Phaser.Math.Clamp(nivel, 1, tabla.length) - 1];
}

/** Las 6 estadísticas finales del héroe (base + puntos + equipo) */
export function estadisticasFinales(balance, p) {
  const base = estadisticasBase(balance, p.rol, p.nivel);
  const porPunto = balance.estadisticas.porPunto;
  const bonos = bonosEquipo(balance, p);
  const total = {};
  for (const id of Object.keys(balance.estadisticas.lista)) {
    total[id] = base[id] + ((p.est[id] || 0) + (bonos[id] || 0)) * porPunto[id];
  }
  return total;
}

/** Fuerza, Velocidad y Armadura son porcentajes (0.2 = 20%); las demás, puntos */
export function esPorcentaje(id) {
  return id === 'fuerza' || id === 'velocidad' || id === 'armadura';
}

/** Cómo se muestra una estadística: "240" o "15%" o "0,6%" (hasta 1 decimal) */
export function textoEstadistica(id, valor) {
  if (!esPorcentaje(id)) return String(Math.round(valor));
  return `${String(Math.round(valor * 1000) / 10).replace('.', ',')}%`;
}

// =============================================================
// v0.1.5 — EQUIPO: 8 espacios
//   manoDerecha (arma) · manoIzquierda (escudo, 2ª arma o foco, según el Excel
//   de armas; nada si el arma es a 2 manos) · casco · pecho · capa · pantalón ·
//   anillo · amuleto.
// Cada espacio tiene 5 "tiers" (nivel 1, 6, 11, 16, 21). El equipo puesto
// se guarda así: p.equipo = { casco: 2, manoDerecha: 0 } (número = tier).
// =============================================================

/** El arma de una raza + clase + rol (si el Excel no la trae, la general de la clase) */
export function armaDe(balance, raza, clase, rol) {
  const a = balance.armas;
  return a.lista[`${raza}.${clase}.${rol}`] || a.porClase[`${clase}.${rol}`]
    || { principal: 'Arma', secundaria: 'Escudo', mano: 'escudo', estilo: '', alcanceM: 3, velAtaque: 1 };
}

/**
 * El objeto del espacio "ranura" en el tier "tier" PARA ESTE HÉROE
 * (el nombre y las estadísticas cambian según su rol y su arma).
 * Devuelve null si ese espacio no se usa (mano izquierda con arma a 2 manos).
 */
export function objetoEquipo(balance, p, ranura, tier) {
  const eq = balance.equipo;
  const datos = eq.ranuras[ranura];
  const t = eq.tiers[tier];
  if (!datos || !t) return null;
  const arma = armaDe(balance, p.raza, p.clase, p.rol);
  let nombre;
  let stats;
  let multiplicador = 1;
  if (ranura === 'manoDerecha') {
    nombre = arma.principal;
    stats = datos.bonos[p.rol];
    if (arma.mano === 'ninguno') multiplicador = eq.dosManos; // a 2 manos: suma más
  } else if (ranura === 'manoIzquierda') {
    if (arma.mano === 'ninguno') return null;
    nombre = arma.secundaria.replace(/\s*\(.*\)$/, ''); // "Ninguno (Doble Arma)" → sin paréntesis
    if (arma.mano === 'arma' && /^ninguno/i.test(nombre)) nombre = `${arma.principal} (2ª)`;
    stats = datos.porTipo[arma.mano];
  } else {
    nombre = datos.nombres[p.rol];
    stats = datos.bonos[p.rol];
  }
  // La 1ª estadística suma el máximo del tier y la 2ª, el mínimo (Excel Ropa_Accesorios)
  const [minimo, maximo] = t.bono;
  const bonos = { [stats[0]]: Math.round(maximo * multiplicador), [stats[1]]: Math.round(minimo * multiplicador) };
  // El precio se multiplica por el del espacio (el arma cuesta más)
  const precio = {};
  for (const [moneda, n] of Object.entries(t.precio)) precio[moneda] = moneda === 'intys' ? Math.round(n * (datos.precio || 1)) : n;
  return {
    id: `${ranura}:${tier}`, ranura, tier, nombre, bonos, precio,
    nivel: t.nivel, tierNombre: t.nombre, color: t.color,
  };
}

/** Corrige un personaje que llegó mal (por la red o de una versión vieja) */
export function personajeValido(balance, p) {
  const raza = p && balance.razas[p.raza] ? p.raza : 'humano';
  const clase = p && balance.clases[p.clase] ? p.clase : 'guerrero';
  // v0.1.4: el ROL tiene que ser uno de los de la clase (si no, el primero)
  const rolesClase = balance.clases[clase].roles;
  const rol = p && rolesClase.includes(p.rol) ? p.rol : rolesClase[0];
  const est = {};
  for (const id of Object.keys(balance.estadisticas.lista)) {
    est[id] = Math.max(0, Math.floor(Number(p && p.est && p.est[id]) || 0));
  }
  const nivel = Phaser.Math.Clamp(Math.floor(Number(p && p.nivel) || 1), 1, balance.progreso.nivelMax);
  const valido = { raza, clase, rol, nivel, puntos: Math.max(0, Number(p && p.puntos) || 0), est, equipo: {} };
  valido.coronas = Math.max(0, Math.floor(Number(p && p.coronas) || 0));
  // v0.1.5: el equipo puesto es { ranura: tier }. Lo que no existe se quita.
  for (const ranura of Object.keys(balance.equipo.ranuras)) {
    const tier = p && p.equipo ? p.equipo[ranura] : undefined;
    if (Number.isInteger(tier) && objetoEquipo(balance, valido, ranura, tier)) valido.equipo[ranura] = tier;
  }
  return valido;
}

/**
 * Los puntos de estadísticas que REGALA el equipo puesto.
 * El equipo puede dar cualquier estadística (aunque no sea del rol).
 */
export function bonosEquipo(balance, p) {
  const total = {};
  for (const id of Object.keys(balance.estadisticas.lista)) total[id] = 0;
  for (const [ranura, tier] of Object.entries(p.equipo || {})) {
    const obj = objetoEquipo(balance, p, ranura, tier);
    if (!obj) continue;
    for (const [est, cantidad] of Object.entries(obj.bonos)) total[est] += cantidad;
  }
  return total;
}

/** Texto corto de los bonos de un objeto: "+8 Daño · +0,8% Velocidad" (cada punto de % vale 0,20%) */
export function textoBonos(balance, bonos) {
  const porPunto = balance.estadisticas.porPunto;
  return Object.entries(bonos).filter(([, n]) => n > 0)
    .map(([est, n]) => `+${esPorcentaje(est) ? textoEstadistica(est, n * porPunto[est]) : n} ${balance.estadisticas.lista[est].nombre}`)
    .join(' · ');
}

/** Texto del precio: "☀️ 60" o "☀️ 3500 + 💎 3" */
export function textoPrecio(precio) {
  const iconos = { intys: '☀️', fichas: '🎟️', rubis: '💎', fichasFaccion: '🔰' };
  return Object.entries(precio).map(([moneda, n]) => `${iconos[moneda]} ${n}`).join(' + ');
}

/**
 * Los números del héroe en la partida (v0.1.5).
 * Las estadísticas (en las unidades del Excel) se convierten con
 * balance.json → estadisticas.conversion. La raza y la clase también influyen.
 */
export function calcularHeroe(balance, entrada) {
  const p = personajeValido(balance, entrada);
  const raza = balance.razas[p.raza];
  const clase = balance.clases[p.clase];
  const poderes = poderesDe(balance, p.clase, p.rol);
  const s = estadisticasFinales(balance, p);
  const cv = balance.estadisticas.conversion;
  // Cuántos botones tiene abiertos (botón 2 y 3 se abren al subir de nivel)
  const botones = balance.progreso.nivelBotones.filter((n) => p.nivel >= n).length;
  // DAÑO: el botón 1 pega exactamente "Daño" (Sanador nivel 1 = 20). Su habilidad molde
  // (Golpe 25, Proyectil 20...) se multiplica por Daño / daño del molde, y los demás
  // poderes en la misma proporción.
  const multDanio = s.danio / danioMolde(balance, poderes.botones[0].accion);
  return {
    personaje: p,
    idRaza: p.raza,
    idClase: p.clase,
    idRol: p.rol,
    raza,
    clase,
    poderes,               // v0.1.4: pasiva y 3 poderes de clase + rol
    tipo: poderes.tipo,    // melee o caster: lo decide el rol (el Paladín Sanador es caster)
    botones,
    estadisticas: s,
    // v0.1.5: lo que dice la ficha es lo que pasa en la mazmorra (la raza ya no cambia los números)
    vidaMax: Math.round(s.vida),                              // VIDA = puntos de vida
    manaMax: Math.round(s.inteligencia),                      // INTELIGENCIA = puntos de maná
    velocidad: Math.ceil(cv.velocidadRef * s.velocidad),      // VELOCIDAD: 300 × 50% = 150
    mult: {
      fisico: multDanio,
      magia: multDanio,
      // la curación (y las pociones) rinden más con Inteligencia; nunca menos de ×1
      cura: Math.max(1, s.inteligencia / cv.curaRef),
      // VELOCIDAD de ataque: con más % se recarga más rápido (50% = normal)
      recarga: Phaser.Math.Clamp((1 + cv.ataqueRef) / (1 + s.velocidad), cv.recargaMin, 1),
    },
    // ARMADURA = "% de bloqueo": quita esa parte del daño recibido (con un tope)
    reduccion: Phaser.Math.Clamp(s.armadura, 0, cv.armaduraMax),
    // FUERZA = probabilidad de aturdir al enemigo cada "aturdirCada" golpes
    aturdir: Phaser.Math.Clamp(s.fuerza, 0, 1),
  };
}

/** Daño de la habilidad "molde" del botón 1 (Golpe 25, Cuchilladas 16, Proyectil 20) */
function danioMolde(balance, accion) {
  const moldes = {
    atq: balance.ataqueBasico.danio,
    cuch: balance.clases.asesino.cuchilladas.danio,
    bola: balance.magia.bola.danio,
  };
  return moldes[accion] || balance.ataqueBasico.danio;
}

/** Lo que se le cuenta al compañero por la red: solo lo necesario */
export function paraLaRed(p) {
  return { raza: p.raza, clase: p.clase, rol: p.rol, nivel: p.nivel, est: p.est, equipo: p.equipo || {}, coronas: p.coronas || 0 };
}

/**
 * v0.1.4: recarga (ms) del botón i (0, 1, 2) de un set de poderes.
 * Botón 1: la de la habilidad "molde" (el ataque básico tiene que ser rápido).
 * Botones 2 y 3: el CD del Excel × escalaRecarga (un poder de 30 s tarda ~10 s).
 */
export function recargaPoder(balance, poder, i, recargaMolde) {
  const escala = balance.poderes.escalaRecarga[i];
  return escala ? Math.round(poder.cdSeg * 1000 * escala) : recargaMolde;
}

/** Nombre de la habilidad del prototipo que usa cada poder por ahora (su "molde") */
export const NOMBRE_HABILIDAD = {
  atq: 'Golpe', onda: 'Onda', torb: 'Torbellino',
  cuch: 'Cuchilladas', paso: 'Paso sombrío', crit: 'Golpe crítico',
  bola: 'Proyectil', abanico: 'Abanico', sanar: 'Sanar al grupo',
};
