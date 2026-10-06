// =====================================================================================
//  LAS ZONAS DEL MUNDO CÓDICE y cuándo se desbloquean.
//  Lo usan el juego, la pantalla del estudiante y el editor de la docente, para que los tres
//  hablen exactamente de lo mismo. No tiene imágenes ni nada pesado.
//
//  Una zona se desbloquea para un estudiante cuando se cumplen DOS cosas:
//    1) la docente la abrió para el curso del estudiante, y
//    2) el estudiante cumplió el requisito (completar N misiones de la zona anterior).
// =====================================================================================

export const ZONAS = [
  {
    key: "aldea", nombre: "Aldea del Códice", emoji: "🏘️", corto: "la Aldea", de: "de la Aldea", a: "a la Aldea",
    insignia: { nombre: "Insignia de la Comunidad", emoji: "🏅", color: "#f59e0b" },
    guardian: { nombre: "Maestra Aldana", titulo: "Guardiana de la Aldea", sprite: "maestro_gremio_femenino", reto: "Conoces bien nuestra aldea. ¿Conoces también sus valores? ¡Demuéstralo!" },
    lugares: [
      { key: "biblioteca", emoji: "📚", nombre: "Biblioteca" },
      { key: "agora", emoji: "⚖️", nombre: "Ágora de la Ética" },
      { key: "templo", emoji: "🕊️", nombre: "Templo de la Gratitud" },
      { key: "mercado", emoji: "🛒", nombre: "Mercado del Códice" },
      { key: "plaza", emoji: "🌍", nombre: "Plaza (afuera)" },
      { key: "acertijos", emoji: "🧩", nombre: "Casa de los Acertijos" },
      { key: "comarca", emoji: "🏰", nombre: "Sala de la Comarca" },
      { key: "posada", emoji: "🛏️", nombre: "Posada del Descanso" },
    ],
  },
  {
    key: "bosque", nombre: "Bosque de la Curiosidad", emoji: "🌲", corto: "el Bosque", de: "del Bosque", a: "al Bosque", guardia: "Guardia del Bosque", previa: "aldea", requisitoPorDefecto: 3,
    insignia: { nombre: "Insignia de la Curiosidad", emoji: "🌿", color: "#22c55e" },
    guardian: { nombre: "Silvano", titulo: "Guardián del Bosque", sprite: "cronista_masculino", reto: "El bosque premia a quien pregunta. ¿Tienes la curiosidad y el saber para vencerme?" },
    retadores: [
      { id: "bosque-1", nombre: "Garra Negra", sprite: "defensor_masculino", frase: "¡Alto ahí, viajero! Este sendero es mío. Respóndeme bien o pagarás el peaje con tu salud." },
      { id: "bosque-2", nombre: "La Sombra Hueca", sprite: "peregrino_femenino", frase: "Entre los árboles, quien no sabe se pierde… ¿Sabes tú lo suficiente?" },
      { id: "bosque-3", nombre: "El Acechador", sprite: "heraldo_masculino", frase: "Te seguía desde el claro. Veamos si tu cabeza vale tanto como tu mochila." },
      { id: "bosque-4", nombre: "Dama de las Espinas", sprite: "consejero_femenino", frase: "Las espinas hieren a quien se equivoca. ¡Responde con cuidado!" },
    ],
    lugares: [
      { key: "claro", emoji: "🌼", nombre: "Claro del Bosque" },
      { key: "arroyo", emoji: "💧", nombre: "Arroyo Cantarino" },
      { key: "mirador", emoji: "⛰️", nombre: "Mirador" },
      { key: "campamento", emoji: "🏕️", nombre: "Campamento del Ermitaño" },
      { key: "cascada", emoji: "💦", nombre: "Cascada Escondida" },
      { key: "roble", emoji: "🌳", nombre: "Gran Roble" },
      { key: "ruinas", emoji: "🏛️", nombre: "Ruinas Antiguas" },
    ],
  },
  {
    key: "montana", nombre: "Montaña del Esfuerzo", emoji: "🏔️", corto: "la Montaña", de: "de la Montaña", a: "a la Montaña", guardia: "Guardia de la Montaña", previa: "bosque", requisitoPorDefecto: 3,
    insignia: { nombre: "Insignia del Esfuerzo", emoji: "⛰️", color: "#64748b" },
    guardian: { nombre: "Roca", titulo: "Guardián de la Montaña", sprite: "guardian_masculino", reto: "Nadie llega a mi cumbre sin esfuerzo. ¡Veamos de qué estás hecho!" },
    retadores: [
      { id: "montana-1", nombre: "Gólem de Piedra", sprite: "guardian_femenino", frase: "La montaña no perdona a los que dudan. ¡Responde o siente su peso!" },
      { id: "montana-2", nombre: "Ladrón de Cumbres", sprite: "cronista_masculino", frase: "Aquí arriba solo sobrevive el que sabe. ¡Demuéstralo!" },
    ],
    lugares: [
      { key: "sendero", emoji: "🥾", nombre: "Sendero de Piedra" },
      { key: "cueva", emoji: "🕳️", nombre: "Cueva del Eco" },
      { key: "cumbre", emoji: "🚩", nombre: "Cumbre" },
    ],
  },
  {
    key: "lago", nombre: "Lago de la Reflexión", emoji: "🏞️", corto: "el Lago", de: "del Lago", a: "al Lago", guardia: "Guardia del Lago", previa: "montana", requisitoPorDefecto: 3,
    insignia: { nombre: "Insignia de la Reflexión", emoji: "💧", color: "#0ea5e9" },
    guardian: { nombre: "Marisol", titulo: "Guardiana del Lago", sprite: "consejero_femenino", reto: "Aquí se piensa antes de responder. ¿Estás listo para el último reto?" },
    retadores: [
      { id: "lago-1", nombre: "Espectro del Lago", sprite: "heraldo_femenino", frase: "Las aguas guardan a quienes no supieron responder… ¿serás el próximo?" },
      { id: "lago-2", nombre: "Corsario Mudo", sprite: "maestro_gremio_masculino", frase: "No hablo, pero mis preguntas hieren. ¡Contesta rápido!" },
    ],
    lugares: [
      { key: "orilla", emoji: "🏖️", nombre: "Orilla" },
      { key: "muelle", emoji: "🛶", nombre: "Muelle" },
      { key: "isla", emoji: "🌴", nombre: "Isla Serena" },
    ],
  },
];

export const LUGARES = ZONAS.flatMap((z) => z.lugares.map((l) => ({ ...l, zona: z.key })));
export const zonaPorClave = (k) => ZONAS.find((z) => z.key === k) || null;
export const zonaDeLugar = (lugar) => (LUGARES.find((l) => l.key === lugar) || { zona: "aldea" }).zona;
// La zona de una misión: la que trae, o (si todavía no existe esa columna) la que corresponde a su lugar.
export const zonaDeMision = (m) => (m && m.zona && zonaPorClave(m.zona) ? m.zona : zonaDeLugar(m && m.lugar));

// Estado de todas las zonas para UN estudiante.
//   misiones  : las misiones que ve (de su curso + generales)
//   hechas    : ids de las que ya completó
//   abiertas  : claves de las zonas que la docente abrió para su curso
//   requisitos: { zona: cantidad } que pidió la docente (si falta, se usa el valor por defecto)
//   insignias : claves de las zonas cuya insignia ya ganó (venciendo al Guardián)
//   exigen    : { zona: true } si la docente exige la insignia de ESA zona para pasar a la siguiente
export function estadoZonas({ misiones = [], hechas = [], abiertas = [], requisitos = {}, insignias = [], exigen = {} } = {}) {
  const hs = hechas instanceof Set ? hechas : new Set(hechas);
  const ab = abiertas instanceof Set ? abiertas : new Set(abiertas);
  const ins = insignias instanceof Set ? insignias : new Set(insignias);
  const out = {};
  for (const z of ZONAS) {
    const tieneInsignia = ins.has(z.key);
    if (!z.previa) { out[z.key] = { zona: z.key, abierta: true, requeridas: 0, pedidas: 0, hechasPrevia: 0, totalPrevia: 0, cumplido: true, exigeInsignia: false, insigniaOk: true, tieneInsignia, desbloqueada: true }; continue; }
    const previas = misiones.filter((m) => zonaDeMision(m) === z.previa);
    const total = previas.length, hechasPrevia = previas.filter((m) => hs.has(m.id)).length;
    const pedidasCfg = requisitos && requisitos[z.key] != null ? Number(requisitos[z.key]) : NaN;
    const pedidas = Number.isFinite(pedidasCfg) ? Math.max(0, Math.floor(pedidasCfg)) : z.requisitoPorDefecto;
    const requeridas = Math.min(pedidas, total); // si hay menos misiones que las pedidas, alcanza con completarlas todas: nadie queda trabado
    const cumplido = hechasPrevia >= requeridas, abierta = ab.has(z.key);
    const exigeInsignia = !!(exigen && exigen[z.previa]), insigniaOk = !exigeInsignia || ins.has(z.previa);
    out[z.key] = { zona: z.key, previa: z.previa, abierta, pedidas, requeridas, hechasPrevia, totalPrevia: total, cumplido, exigeInsignia, insigniaOk, tieneInsignia, desbloqueada: abierta && out[z.previa].desbloqueada && cumplido && insigniaOk };
  }
  return out;
}

// Las misiones que el estudiante puede encontrar ahora (las de zonas ya desbloqueadas).
export function misionesDisponibles(misiones, estado) {
  return misiones.filter((m) => (estado[zonaDeMision(m)] || {}).desbloqueada);
}

// Todos los retadores del mundo, con la zona a la que pertenecen.
export const RETADORES = ZONAS.flatMap((z) => (z.retadores || []).map((r) => ({ ...r, zona: z.key })));
