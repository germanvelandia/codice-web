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

// Ordena estudiantes por Apellidos y Nombres (alfabético), aunque el nombre esté
// guardado como un solo texto. Asume que las últimas 2 palabras son los apellidos
// (el patrón más común en Colombia: Nombre1 [Nombre2] Apellido1 Apellido2).
// Con nombres de 2 palabras, asume Nombre Apellido.
export function claveApellidoNombre(nombreCompleto) {
  const partes = (nombreCompleto || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return nombreCompleto || "";
  if (partes.length === 2) return `${partes[1]} ${partes[0]}`;
  const apellidos = partes.slice(-2).join(" ");
  const nombres = partes.slice(0, -2).join(" ");
  return `${apellidos} ${nombres}`;
}

export function ordenarPorApellido(estudiantes) {
  return [...estudiantes].sort((a, b) =>
    claveApellidoNombre(a.nombre).localeCompare(claveApellidoNombre(b.nombre), "es", { sensitivity: "base" })
  );
}

// "Firma" de un nombre para poder comparar dos formatos distintos del mismo nombre
// (ej. "Pérez García, Juan" vs "Juan Pérez García") sin importar el orden de las palabras.
export function firmaNombre(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/).filter(Boolean).sort().join(" ");
}

// Busca, dentro de una lista de estudiantes, el que mejor coincide con un nombre dado
// (usado al importar notas de Moodle, donde el formato del nombre puede variar).
export function buscarEstudiantePorNombre(nombre, estudiantes) {
  const firma = firmaNombre(nombre);
  if (!firma) return null;
  let match = estudiantes.find((e) => firmaNombre(e.nombre) === firma);
  if (match) return match;
  // coincidencia parcial: todas las palabras del nombre buscado están en el nombre del estudiante
  const palabras = firma.split(" ");
  match = estudiantes.find((e) => {
    const palabrasEst = firmaNombre(e.nombre).split(" ");
    return palabras.every((p) => palabrasEst.includes(p));
  });
  return match || null;
}

// Acciones rápidas de gamificación (positivas y negativas), con su categoría.
// Set reducido usado como botones de acceso directo (⚡ Puntos rápidos).
export const ACCIONES_RAPIDAS = [
  { key: "participacion", label: "Participación", xp: 10, vida: 2, categoria: "academico", tipo: "positiva" },
  { key: "ayuda", label: "Ayuda a un compañero", xp: 15, vida: 3, categoria: "academico", tipo: "positiva" },
  { key: "actitud_buena", label: "Buena actitud", xp: 10, vida: 3, categoria: "convivencial", tipo: "positiva" },
  { key: "trabajo_equipo", label: "Trabajo en equipo", xp: 20, vida: 4, categoria: "academico", tipo: "positiva" },
  { key: "celular", label: "Uso del celular", xp: -10, vida: -3, categoria: "convivencial", tipo: "negativa" },
  { key: "tarea_no_entregada", label: "Tarea no entregada", xp: -10, vida: -5, categoria: "academico", tipo: "negativa" },
  { key: "actitud_negativa", label: "Actitud negativa", xp: -10, vida: -5, categoria: "convivencial", tipo: "negativa" },
  { key: "llamado_atencion", label: "Llamado de atención", xp: -10, vida: -8, categoria: "convivencial", tipo: "negativa" },
];

// Catálogo completo académico (positivo y negativo)
export const ACADEMICO_POS = [
  { label: "Participación en clase", xp: 10, vida: 2 },
  { label: "Tarea entregada a tiempo", xp: 15, vida: 3 },
  { label: "Trabajo en equipo destacado", xp: 20, vida: 4 },
  { label: "Evaluación sobresaliente", xp: 25, vida: 5 },
  { label: "Ayuda a un compañero", xp: 15, vida: 3 },
  { label: "Proyecto sobresaliente", xp: 30, vida: 5 },
  { label: "Liderazgo en el trabajo de equipo", xp: 20, vida: 4 },
  { label: "Creatividad al resolver un problema", xp: 20, vida: 4 },
  { label: "Puntualidad constante", xp: 10, vida: 2 },
  { label: "Excelente argumentación o redacción", xp: 15, vida: 3 },
];
export const ACADEMICO_NEG = [
  { label: "Tarea no entregada", xp: -10, vida: -5 },
  { label: "Evaluación insuficiente", xp: -15, vida: -5 },
  { label: "Impuntualidad", xp: -5, vida: -2 },
  { label: "Copia o fraude académico", xp: -25, vida: -10 },
];

// Pilares de carácter (Character Counts)
export const PILARES = [
  { key: "respeto", label: "Respeto", xp: 10, vida: 3 },
  { key: "responsabilidad", label: "Responsabilidad", xp: 10, vida: 3 },
  { key: "confiabilidad", label: "Confiabilidad", xp: 10, vida: 3 },
  { key: "justicia", label: "Justicia", xp: 10, vida: 3 },
  { key: "solidaridad", label: "Solidaridad", xp: 10, vida: 3 },
  { key: "ciudadania", label: "Ciudadanía", xp: 10, vida: 3 },
];

// Catálogo completo convivencial (positivo extra y negativo)
export const CONVIVENCIAL_POS_EXTRA = [
  { label: "Compromiso cumplido", xp: 10, vida: 8 },
  { label: "Mediación pacífica de un conflicto", xp: 15, vida: 6 },
  { label: "Actitud propositiva", xp: 10, vida: 3 },
  { label: "Reconocimiento especial", xp: 20, vida: 5 },
];
export const CONVIVENCIAL_NEG = [
  { label: "Llamado de atención", xp: -10, vida: -8 },
  { label: "Uso del celular sin autorización", xp: -10, vida: -3 },
  { label: "Conflicto con compañeros", xp: -15, vida: -10 },
  { label: "Inasistencia sin excusa", xp: -10, vida: -5 },
  { label: "Consumir alimentos en clase sin permiso", xp: -5, vida: -2 },
  { label: "Incumplimiento del manual de convivencia", xp: -15, vida: -10 },
  { label: "Falta grave / compromiso incumplido", xp: -20, vida: -15 },
];

export const REINO_COLORS = ["#8B5CF6", "#F43F5E", "#F59E0B", "#22C55E", "#3B82F6", "#EC4899", "#14B8A6", "#FB923C"];
export function reinoColor(nombre) {
  let hash = 0;
  for (let i = 0; i < (nombre || "").length; i++) hash = (hash * 31 + nombre.charCodeAt(i)) % REINO_COLORS.length;
  return REINO_COLORS[Math.abs(hash) % REINO_COLORS.length];
}

// Busca el reino por nombre en el catálogo (con color/logo personalizados);
// si no existe todavía en el catálogo, cae al color automático de siempre.
export function reinoInfo(nombre, catalogoReinos) {
  const enCatalogo = (catalogoReinos || []).find((r) => r.nombre === nombre);
  return {
    color: enCatalogo?.color || reinoColor(nombre),
    logo_url: enCatalogo?.logo_url || null,
  };
}
