// =====================================================================================
//  MONSTRUOS Y DUELOS DE MONSTRUOS (lógica pura, sin pantalla: se puede probar sola)
//  Cada estudiante tiene monstruos con nivel, tipo y estadísticas. Pelean por turnos:
//  para atacar hay que acertar una pregunta (o en "pelea rápida", una pregunta clave cada 3 rondas).
//  El nivel pesa: las estadísticas crecen con cada nivel, así que un monstruo más fuerte gana más seguido.
// =====================================================================================

export const CONFIG_MONSTRUOS_DEFECTO = {
  monstruos_activo: 1,        // el Laboratorio y los salvajes existen
  monstruos_equipo_max: 3,    // monstruos que puede tener cada estudiante
  monstruos_puntos: 20,       // puntos para repartir al crear un monstruo
  monstruos_premios_dia: 6,   // victorias por día que dan premio (después se puede seguir peleando por diversión)
  monstruos_xp: 12,           // XP de CÓDICE por victoria (se ajusta por la diferencia de nivel)
  monstruos_oro: 6,           // monedas por victoria
  monstruos_captura_activo: 1, // se puede intentar capturar al salvaje que se derrota
  monstruos_capturas_dia: 3,   // capturas por día (las que salen bien)
  monstruos_pvp_activo: 1,     // la Arena: duelos contra la copia del monstruo de un compañero
  monstruos_pvp_dia: 5,        // victorias con premio por día en la Arena
  monstruos_pvp_pct: 60,       // % del premio normal que da ganar en la Arena
};

// Cada tipo es fuerte contra el siguiente: Fuego → Planta → Electricidad → Agua → Fuego
export const TIPOS = {
  fuego: { nombre: "Fuego", emoji: "🔥", lema: "Lógica", fuerteContra: "planta", color: "#e8643c" },
  planta: { nombre: "Planta", emoji: "🌿", lema: "Estructura", fuerteContra: "electricidad", color: "#4caf6a" },
  electricidad: { nombre: "Electricidad", emoji: "⚡", lema: "Innovación", fuerteContra: "agua", color: "#e9c23a" },
  agua: { nombre: "Agua", emoji: "💧", lema: "Fluidez", fuerteContra: "fuego", color: "#4a90d9" },
};
export const CLAVES_TIPO = Object.keys(TIPOS);
export const EMOJIS_MONSTRUO = ["🦊", "🐸", "🐛", "🐹", "🐉", "🦄", "🐙", "🦇"];

export const BASE = { hp: 60, atk: 10, def: 10, vel: 10 };            // estadísticas del nivel 1 sin puntos extra
export const POR_PUNTO = { hp: 4, atk: 1, def: 1, vel: 1 };           // lo que da cada punto repartido
export const POR_NIVEL = { hp: 8, atk: 2, def: 2, vel: 1 };           // lo que se gana al subir de nivel
export const MAX_PUNTOS_POR_ESTAT = 12;
export const NIVEL_MAX = 10;
export const ESTATS = ["hp", "atk", "def", "vel"];
export const NOMBRE_ESTAT = { hp: "Vida", atk: "Ataque", def: "Defensa", vel: "Velocidad" };

const ent = (v, def = 0) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? n : def; };
const txt = (v) => String(v ?? "").trim();

// ---------- creación ----------
export const puntosUsados = (p) => ESTATS.reduce((a, k) => a + Math.max(0, ent(p && p[k])), 0);

// Devuelve "" si está bien o el mensaje del problema.
export function validarMonstruo(c, { puntos = CONFIG_MONSTRUOS_DEFECTO.monstruos_puntos } = {}) {
  const nombre = txt(c.nombre);
  if (nombre.length < 2) return "Ponle un nombre a tu monstruo (al menos 2 letras).";
  if (nombre.length > 20) return "El nombre es muy largo (máximo 20 letras).";
  if (!CLAVES_TIPO.includes(c.tipo)) return "Elige el tipo de tu monstruo.";
  if (!EMOJIS_MONSTRUO.includes(c.emoji)) return "Elige cómo se ve tu monstruo.";
  for (const k of ESTATS) { const v = Number(c.puntos && c.puntos[k]); if (!Number.isInteger(v) || v < 0 || v > MAX_PUNTOS_POR_ESTAT) return `${NOMBRE_ESTAT[k]}: pon un número entre 0 y ${MAX_PUNTOS_POR_ESTAT}.`; }
  const u = puntosUsados(c.puntos);
  if (u > puntos) return `Usaste ${u} puntos y solo tienes ${puntos}.`;
  if (u < puntos) return `Te faltan ${puntos - u} puntos por repartir.`;
  return "";
}
export function limpiarMonstruo(c) {
  const p = {}; ESTATS.forEach((k) => (p[k] = Math.max(0, Math.min(MAX_PUNTOS_POR_ESTAT, ent(c.puntos && c.puntos[k])))));
  return { nombre: txt(c.nombre).slice(0, 20), tipo: c.tipo, emoji: c.emoji, puntos: p };
}

// ---------- nivel y estadísticas ----------
// XP acumulada para llegar al nivel n: 20 para el 2, 60 para el 3, 120 para el 4… (10·n·(n−1))
export const xpParaNivel = (n) => 10 * n * (n - 1);
export function nivelDeXp(xp) {
  const x = Math.max(0, ent(xp)); let n = 1; while (n < NIVEL_MAX && x >= xpParaNivel(n + 1)) n++;
  const desde = xpParaNivel(n), hasta = n < NIVEL_MAX ? xpParaNivel(n + 1) : null;
  return { nivel: n, xpEnNivel: x - desde, xpParaSiguiente: hasta == null ? 0 : hasta - desde, maximo: n >= NIVEL_MAX };
}
// m = { puntos:{hp,atk,def,vel}, nivel } → estadísticas finales
export function statsDe(m) {
  const nv = Math.max(1, Math.min(NIVEL_MAX, ent(m.nivel, 1))), p = m.puntos || {}, s = {};
  ESTATS.forEach((k) => (s[k] = BASE[k] + Math.max(0, ent(p[k])) * POR_PUNTO[k] + (nv - 1) * POR_NIVEL[k]));
  return s;
}
export function multiplicadorTipo(atacante, defensor) {
  if (!TIPOS[atacante] || !TIPOS[defensor]) return 1;
  if (TIPOS[atacante].fuerteContra === defensor) return 1.5;
  if (TIPOS[defensor].fuerteContra === atacante) return 0.75;
  return 1;
}

// ---------- combate ----------
export const HABILIDADES = {
  basico: { nombre: "Ataque básico", emoji: "⚔️", poder: 20, textoFalla: "Si fallas la pregunta, golpeas con poca fuerza." },
  fuerte: { nombre: "Golpe fuerte", emoji: "💥", poder: 42, textoFalla: "Si fallas la pregunta, el golpe se pierde." },
  guardia: { nombre: "Guardia", emoji: "🛡️", poder: 0, textoFalla: "Sin pregunta: recibes la mitad del daño y recuperas un poco de vida." },
};
const FACTOR_FALLO = { basico: 0.4, fuerte: 0 };    // qué parte del daño queda si se falla la pregunta

// Daño de un golpe. acierto: true | false | null (null = sin pregunta, como el rival)
export function calcularDanio({ atacante, defensor, habilidad, acierto, rand = Math.random, defensaMitad = false }) {
  const hab = HABILIDADES[habilidad]; if (!hab || !hab.poder) return { danio: 0, tipo: null, fallo: false };
  const factor = acierto === false ? FACTOR_FALLO[habilidad] : 1;
  const tipo = multiplicadorTipo(atacante.tipo, defensor.tipo);
  const ratio = atacante.stats.atk / (atacante.stats.atk + defensor.stats.def);
  let d = hab.poder * ratio * 1.0 * tipo * (0.9 + 0.2 * rand()) * factor;
  if (defensaMitad) d *= 0.5;
  const danio = factor === 0 ? 0 : Math.max(1, Math.round(d));
  return { danio, tipo: tipo > 1 ? "super" : tipo < 1 ? "poco" : null, fallo: factor === 0 };
}

const luchador = (m) => { const stats = statsDe(m); return { nombre: m.nombre, tipo: m.tipo, emoji: m.emoji, nivel: Math.max(1, Math.min(NIVEL_MAX, ent(m.nivel, 1))), stats, hp: stats.hp, hpMax: stats.hp }; };

// modo: "turnos" (se elige habilidad y se responde una pregunta) | "rapida" (pelean solos; cada 3 rondas hay una pregunta clave)
export function crearCombate({ yo, rival, modo = "turnos", rand = Math.random, maxRondas = 40 }) {
  const A = luchador(yo), R = luchador(rival), e = { ronda: 0, fin: null, log: [] };
  const decidirRival = () => (rand() < 0.35 ? "fuerte" : "basico");
  const golpeRival = (defMitad) => {
    const hab = decidirRival(), falla = hab === "fuerte" && rand() < 0.25;       // el golpe fuerte del rival falla a veces
    if (falla) return { quien: "rival", habilidad: hab, danio: 0, fallo: true, tipo: null };
    const r = calcularDanio({ atacante: R, defensor: A, habilidad: hab, acierto: null, rand, defensaMitad: defMitad });
    A.hp = Math.max(0, A.hp - r.danio); return { quien: "rival", habilidad: hab, ...r };
  };
  const golpeYo = (hab, acierto, extra = 1) => {
    const r = calcularDanio({ atacante: A, defensor: R, habilidad: hab, acierto, rand });
    const danio = r.fallo ? 0 : Math.max(r.danio ? 1 : 0, Math.round(r.danio * extra)); R.hp = Math.max(0, R.hp - danio);
    return { quien: "yo", habilidad: hab, ...r, danio };
  };
  const cerrar = () => {
    if (R.hp <= 0) e.fin = "gana"; else if (A.hp <= 0) e.fin = "pierde";
    else if (e.ronda >= maxRondas) e.fin = A.hp / A.hpMax >= R.hp / R.hpMax ? "gana" : "pierde";
  };
  const yoPrimero = () => A.stats.vel >= R.stats.vel;
  // Un turno completo. En "turnos": { habilidad, acierto }. En "rapida": { acierto } (acierto = null si esta ronda no tuvo pregunta).
  function turno(a = {}) {
    if (e.fin) return { eventos: [], fin: e.fin };
    const ev = []; let hab = a.habilidad, acierto = a.acierto, extra = 1, guardia = false;
    if (modo === "rapida") { hab = acierto === true ? "fuerte" : "basico"; if (acierto === false) extra = 0.6; }
    if (!HABILIDADES[hab]) hab = "basico";
    if (hab === "guardia") { guardia = true; const cura = Math.round(A.hpMax * 0.08); A.hp = Math.min(A.hpMax, A.hp + cura); ev.push({ quien: "yo", habilidad: "guardia", danio: 0, cura }); }
    const orden = yoPrimero() ? ["yo", "rival"] : ["rival", "yo"];
    for (const q of orden) {
      if (A.hp <= 0 || R.hp <= 0) break;
      if (q === "yo" && !guardia) ev.push(golpeYo(hab, modo === "rapida" ? (acierto === true ? null : acierto) : acierto, extra));
      if (q === "rival") ev.push(golpeRival(guardia));
    }
    e.ronda++; e.log.push(...ev); cerrar();
    return { eventos: ev, fin: e.fin };
  }
  // En "rapida" se pregunta en las rondas 0, 3, 6…; en "turnos", cada ataque pide pregunta (la guardia no).
  const necesitaPregunta = (hab) => (modo === "rapida" ? e.ronda % 3 === 0 : hab !== "guardia");
  return { yo: A, rival: R, modo, estado: e, turno, necesitaPregunta };
}

// ---------- premios ----------
// El premio depende de la diferencia de nivel: ganarle a alguien más fuerte da más; ganarle a alguien mucho más débil, menos.
export function calcularPremioMonstruo({ ganado, nivelYo, nivelRival, jefe = false, modo = "turnos", premiosHoy = 0, cfg = CONFIG_MONSTRUOS_DEFECTO }) {
  if (!ganado) return { xpMonstruo: 0, xp: 0, oro: 0, tope: false };
  if (premiosHoy >= ent(cfg.monstruos_premios_dia)) return { xpMonstruo: 0, xp: 0, oro: 0, tope: true };
  const factor = Math.max(0.5, Math.min(2, 1 + 0.25 * (ent(nivelRival, 1) - ent(nivelYo, 1)))) * (jefe ? 2 : 1) * (modo === "rapida" ? 0.7 : 1);
  return { xpMonstruo: Math.max(1, Math.round(10 * factor)), xp: Math.round(ent(cfg.monstruos_xp) * factor), oro: Math.round(ent(cfg.monstruos_oro) * factor), tope: false };
}

// ---------- monstruos salvajes ----------
export const NIVELES_ZONA = { bosque: [1, 3], montana: [3, 6], lago: [5, 8] };
export const NOMBRES_SALVAJES = { fuego: ["Llamarín", "Brasilla", "Chispón"], agua: ["Gotín", "Burbujo", "Marejilla"], planta: ["Hojarín", "Raicilla", "Musgón"], electricidad: ["Chispín", "Voltín", "Rayito"] };
export const JEFES = { bosque: { nombre: "Rey del Bosque", nivel: 4, tipo: "planta", emoji: "🐉" }, montana: { nombre: "Titán de la Montaña", nivel: 7, tipo: "fuego", emoji: "🐉" }, lago: { nombre: "Leviatán del Lago", nivel: 10, tipo: "agua", emoji: "🐉" } };

// Un salvaje de la zona a partir de una semilla (siempre sale el mismo para la misma semilla)
export function salvajeDe(zona, semilla) {
  const [lo, hi] = NIVELES_ZONA[zona] || [1, 3]; const r = (k) => { const x = Math.sin(semilla * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  const tipo = CLAVES_TIPO[Math.floor(r(1) * CLAVES_TIPO.length)], nivel = lo + Math.floor(r(2) * (hi - lo + 1));
  const nombre = NOMBRES_SALVAJES[tipo][Math.floor(r(3) * NOMBRES_SALVAJES[tipo].length)], emoji = EMOJIS_MONSTRUO.slice(0, 4)[Math.floor(r(4) * 4)];
  let resto = ent(CONFIG_MONSTRUOS_DEFECTO.monstruos_puntos); const puntos = { hp: 0, atk: 0, def: 0, vel: 0 };
  while (resto > 0) { const k = ESTATS[Math.floor(r(10 + resto) * 4)]; if (puntos[k] < MAX_PUNTOS_POR_ESTAT) { puntos[k]++; resto--; } }
  return { nombre, tipo, emoji, nivel, puntos, jefe: false };
}
export function jefeDe(zona) { const j = JEFES[zona]; return j ? { ...j, puntos: { hp: 8, atk: 6, def: 3, vel: 3 }, jefe: true } : null; }

// ---- Fase E2: catálogo de la docente y captura de salvajes ----
export const CATALOGO_NIVEL_MAX = 5;   // los monstruos del catálogo empiezan entre el nivel 1 y este
// Un monstruo del catálogo: igual que uno creado, más el nivel con el que empieza.
export function validarCatalogo(c, { puntos = CONFIG_MONSTRUOS_DEFECTO.monstruos_puntos } = {}) {
  const e = validarMonstruo(c, { puntos }); if (e) return e;
  const n = Number(c.nivel);
  if (!Number.isInteger(n) || n < 1 || n > CATALOGO_NIVEL_MAX) return `El nivel inicial va de 1 a ${CATALOGO_NIVEL_MAX}.`;
  return "";
}
// Probabilidad de capturar al salvaje (después de ganarle y de acertar la pregunta). Los jefes no se capturan.
export function probCaptura({ nivelYo, nivelRival, jefe = false }) {
  if (jefe) return 0;
  const p = 0.5 + 0.08 * (ent(nivelYo, 1) - ent(nivelRival, 1));
  return Math.max(0.15, Math.min(0.9, p));
}
// El capturado nace con la mitad del nivel del salvaje (mínimo 1)
export const nivelCapturado = (nivelRival) => Math.max(1, Math.floor(ent(nivelRival, 1) / 2));
// Valida lo que el juego dice haber capturado (nombre, tipo, emoji y puntos; el nivel lo pone el servidor)
export function validarCaptura(c) {
  const nombre = txt(c && c.nombre);
  if (nombre.length < 2 || nombre.length > 20) return "Nombre inválido.";
  if (!CLAVES_TIPO.includes(c.tipo)) return "Tipo inválido.";
  if (!EMOJIS_MONSTRUO.includes(c.emoji)) return "Aspecto inválido.";
  let u = 0;
  for (const k of ESTATS) { const v = Number(c.puntos && c.puntos[k]); if (!Number.isInteger(v) || v < 0 || v > MAX_PUNTOS_POR_ESTAT) return "Puntos inválidos."; u += v; }
  if (u < 1 || u > 40) return "Puntos inválidos.";
  return "";
}

// ---- Fase E3/E4: Arena (duelo contra la copia del monstruo de un compañero) y ligas ----
export const PUNTOS_LIGA = { victoria: 3, derrota: 1 };
// Solo cuenta el primer duelo del día contra cada rival (así nadie suma puntos repitiendo el mismo duelo)
export const puntosLiga = ({ ganado, primeraDelDia }) => (!primeraDelDia ? 0 : ganado ? PUNTOS_LIGA.victoria : PUNTOS_LIGA.derrota);
// La configuración con la que se calcula el premio de la Arena: un porcentaje del premio normal y su propio tope diario
export function cfgArena(cfg) {
  const pct = Math.max(0, Math.min(100, ent(cfg.monstruos_pvp_pct, CONFIG_MONSTRUOS_DEFECTO.monstruos_pvp_pct)));
  return { ...cfg, monstruos_xp: Math.round(ent(cfg.monstruos_xp) * pct / 100), monstruos_oro: Math.round(ent(cfg.monstruos_oro) * pct / 100), monstruos_premios_dia: ent(cfg.monstruos_pvp_dia, CONFIG_MONSTRUOS_DEFECTO.monstruos_pvp_dia) };
}
// Tabla de posiciones: más puntos, luego más victorias, luego menos duelos jugados, luego nombre
export function ordenarTabla(filas) {
  return [...filas].sort((a, b) => b.puntos - a.puntos || b.victorias - a.victorias || a.duelos - b.duelos || String(a.nombre).localeCompare(String(b.nombre), "es")).map((f, i) => ({ ...f, puesto: i + 1 }));
}
// Premio del 1.º, 2.º y 3.º puesto (100 %, 60 % y 40 % del premio base de la liga)
export const PORCENTAJE_PUESTO = { 1: 100, 2: 60, 3: 40 };
export const premioPuesto = (base, puesto) => { const pc = PORCENTAJE_PUESTO[puesto] || 0; return { xp: Math.round(ent(base.xp) * pc / 100), oro: Math.round(ent(base.oro) * pc / 100) }; };
export function validarLiga(c) {
  const nombre = txt(c && c.nombre);
  if (nombre.length < 3) return "Ponle un nombre a la liga (al menos 3 letras).";
  if (nombre.length > 40) return "El nombre es muy largo (máximo 40 letras).";
  if (!txt(c.grado_id)) return "Elige el curso de la liga.";
  for (const [k, t] of [["premio_xp", "El premio de XP"], ["premio_oro", "El premio de oro"]]) { const v = Number(c[k]); if (!Number.isInteger(v) || v < 0 || v > 1000) return `${t} va de 0 a 1000.`; }
  if (c.fin) { const d = new Date(c.fin); if (Number.isNaN(d.getTime())) return "La fecha de cierre no es válida."; }
  return "";
}
