// Constantes y helpers de gamificación — mismas reglas que el prototipo de Claude.

export const GRADOS_BASE = ["801", "802", "803", "804", "901", "902", "903", "904", "1001", "1002", "1003"];

export const LEVELS = [
  { name: "Novato", min: 0 },
  { name: "Aprendiz", min: 150 },
  { name: "Experto", min: 400 },
  { name: "Maestro", min: 800 },
  { name: "Sabio", min: 1400 },
  { name: "Leyenda", min: 2200 },
];

export function nextLevel(xp) {
  let level = LEVELS[0];
  let next = LEVELS[1];
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].min) { level = LEVELS[i]; next = LEVELS[i + 1] || null; }
  }
  const pct = next ? Math.min(100, Math.round(((xp - level.min) / (next.min - level.min)) * 100)) : 100;
  return { level, next, pct };
}

export function initials(nombre) {
  return nombre.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export const ACCIONES_RAPIDAS = [
  { key: "participacion", label: "Participación", xp: 10, vida: 3, categoria: "academico", tipo: "positiva" },
  { key: "ayuda", label: "Ayuda a un compañero", xp: 15, vida: 3, categoria: "convivencial", tipo: "positiva" },
  { key: "actitud_buena", label: "Buena actitud", xp: 10, vida: 3, categoria: "convivencial", tipo: "positiva" },
  { key: "trabajo_equipo", label: "Trabajo en equipo", xp: 10, vida: 3, categoria: "convivencial", tipo: "positiva" },
  { key: "tarea_no_entregada", label: "Tarea no entregada", xp: -10, vida: -5, categoria: "academico", tipo: "negativa" },
  { key: "actitud_negativa", label: "Actitud negativa", xp: -10, vida: -5, categoria: "convivencial", tipo: "negativa" },
  { key: "celular", label: "Celular en clase", xp: -5, vida: -3, categoria: "convivencial", tipo: "negativa" },
  { key: "llamado_atencion", label: "Llamado de atención", xp: -15, vida: -8, categoria: "convivencial", tipo: "negativa" },
];

export const REINO_COLORS = ["#8B5CF6", "#F43F5E", "#F59E0B", "#22C55E", "#3B82F6", "#EC4899", "#14B8A6", "#FB923C"];
export function reinoColor(nombre) {
  let hash = 0;
  for (let i = 0; i < (nombre || "").length; i++) hash = (hash * 31 + nombre.charCodeAt(i)) % REINO_COLORS.length;
  return REINO_COLORS[Math.abs(hash) % REINO_COLORS.length];
}
