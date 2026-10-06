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
    lugares: [
      { key: "biblioteca", emoji: "📚", nombre: "Biblioteca" },
      { key: "agora", emoji: "⚖️", nombre: "Ágora de la Ética" },
      { key: "templo", emoji: "🕊️", nombre: "Templo de la Gratitud" },
      { key: "mercado", emoji: "🛒", nombre: "Mercado del Códice" },
      { key: "plaza", emoji: "🌍", nombre: "Plaza (afuera)" },
      { key: "posada", emoji: "🛏️", nombre: "Posada del Descanso" },
    ],
  },
  {
    key: "bosque", nombre: "Bosque de la Curiosidad", emoji: "🌲", corto: "el Bosque", de: "del Bosque", a: "al Bosque", guardia: "Guardia del Bosque", previa: "aldea", requisitoPorDefecto: 3,
    lugares: [
      { key: "claro", emoji: "🌼", nombre: "Claro del Bosque" },
      { key: "arroyo", emoji: "💧", nombre: "Arroyo Cantarino" },
      { key: "mirador", emoji: "⛰️", nombre: "Mirador" },
    ],
  },
  {
    key: "montana", nombre: "Montaña del Esfuerzo", emoji: "🏔️", corto: "la Montaña", de: "de la Montaña", a: "a la Montaña", guardia: "Guardia de la Montaña", previa: "bosque", requisitoPorDefecto: 3,
    lugares: [
      { key: "sendero", emoji: "🥾", nombre: "Sendero de Piedra" },
      { key: "cueva", emoji: "🕳️", nombre: "Cueva del Eco" },
      { key: "cumbre", emoji: "🚩", nombre: "Cumbre" },
    ],
  },
  {
    key: "lago", nombre: "Lago de la Reflexión", emoji: "🏞️", corto: "el Lago", de: "del Lago", a: "al Lago", guardia: "Guardia del Lago", previa: "montana", requisitoPorDefecto: 3,
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
export function estadoZonas({ misiones = [], hechas = [], abiertas = [], requisitos = {} } = {}) {
  const hs = hechas instanceof Set ? hechas : new Set(hechas);
  const ab = abiertas instanceof Set ? abiertas : new Set(abiertas);
  const out = {};
  for (const z of ZONAS) {
    if (!z.previa) { out[z.key] = { zona: z.key, abierta: true, requeridas: 0, pedidas: 0, hechasPrevia: 0, totalPrevia: 0, cumplido: true, desbloqueada: true }; continue; }
    const previas = misiones.filter((m) => zonaDeMision(m) === z.previa);
    const total = previas.length, hechasPrevia = previas.filter((m) => hs.has(m.id)).length;
    const pedidasCfg = requisitos && requisitos[z.key] != null ? Number(requisitos[z.key]) : NaN;
    const pedidas = Number.isFinite(pedidasCfg) ? Math.max(0, Math.floor(pedidasCfg)) : z.requisitoPorDefecto;
    const requeridas = Math.min(pedidas, total); // si hay menos misiones que las pedidas, alcanza con completarlas todas: nadie queda trabado
    const cumplido = hechasPrevia >= requeridas, abierta = ab.has(z.key);
    out[z.key] = { zona: z.key, previa: z.previa, abierta, pedidas, requeridas, hechasPrevia, totalPrevia: total, cumplido, desbloqueada: abierta && out[z.previa].desbloqueada && cumplido };
  }
  return out;
}

// Las misiones que el estudiante puede encontrar ahora (las de zonas ya desbloqueadas).
export function misionesDisponibles(misiones, estado) {
  return misiones.filter((m) => (estado[zonaDeMision(m)] || {}).desbloqueada);
}
