// =====================================================================================
//  MÓDULOS DE ESTUDIO · lógica pura (sin base de datos)
//  Un módulo = número + nombre + actividades (lectura, enlace, video, pregunta).
//  El módulo se completa cuando todas sus actividades activas están hechas; el siguiente se desbloquea (salvo módulos "libres").
// =====================================================================================
import { misionVisiblePara } from "./gradosMundo";

export const TIPOS_ACTIVIDAD = {
  lectura: { nombre: "Lectura", emoji: "📖" },
  enlace: { nombre: "Enlace", emoji: "🔗" },
  video: { nombre: "Video", emoji: "🎬" },
  pregunta: { nombre: "Pregunta", emoji: "❓" },
};
export const EMOJIS_MODULO = ["📘", "📗", "📙", "📕", "🕊️", "⚖️", "🙏", "🌱", "🧭", "🔥", "⭐", "🏛️"];

// Dirección válida (solo http/https): evita enlaces "javascript:" escritos por error o a propósito
export function urlSegura(t) {
  const s = String(t || "").trim(); if (!s) return "";
  const c = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : "https://" + s;
  try { const u = new URL(c); return u.protocol === "http:" || u.protocol === "https:" ? u.href : ""; } catch { return ""; }
}
// Para incrustar: solo YouTube y Vimeo (otras páginas se abren en una pestaña nueva)
export function videoIncrustable(t) {
  const u = urlSegura(t); if (!u) return "";
  let m = u.match(/^https?:\/\/(?:www\.|m\.)?youtube\.com\/watch\?(?:[^#]*&)?v=([\w-]{11})/i) || u.match(/^https?:\/\/youtu\.be\/([\w-]{11})/i) || u.match(/^https?:\/\/(?:www\.)?youtube\.com\/(?:embed|shorts)\/([\w-]{11})/i);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  m = u.match(/^https?:\/\/(?:www\.)?vimeo\.com\/(\d{6,12})/i); if (m) return `https://player.vimeo.com/video/${m[1]}`;
  return "";
}

// Valida lo que la docente escribe en el formulario de una actividad → mensaje de error o ""
export function errorActividad(a) {
  if (!String(a.titulo || "").trim()) return "Ponle un título a la actividad.";
  if (String(a.titulo).trim().length > 160) return "El título es muy largo (máximo 160 letras).";
  const c = String(a.contenido || "").trim();
  if (a.tipo === "lectura") { if (!c) return "Escribe el texto de la lectura."; if (c.length > 6000) return "La lectura es muy larga (máximo 6000 letras)."; }
  else if (a.tipo === "enlace" || a.tipo === "video") { if (!urlSegura(c)) return "Escribe una dirección web válida (que empiece con http:// o https://)."; }
  else if (a.tipo === "pregunta") {
    if (!c) return "Escribe la pregunta."; if (c.length > 400) return "La pregunta es muy larga (máximo 400 letras).";
    const ops = (a.opciones || []).map((o) => String(o || "").trim()).filter(Boolean);
    if (ops.length < 2) return "Una pregunta necesita al menos 2 opciones.";
    if (new Set(ops.map((o) => o.toLowerCase())).size !== ops.length) return "Hay opciones repetidas.";
    const k = Number(a.correcta); if (!Number.isInteger(k) || k < 0 || k >= (a.opciones || []).length || !String((a.opciones || [])[k] || "").trim()) return "Marca cuál es la opción correcta.";
  } else return "Elige el tipo de actividad.";
  return "";
}
// Quita las opciones vacías y recalcula cuál es la correcta
export function limpiarActividad(a) {
  const base = { ...a, titulo: String(a.titulo || "").trim(), contenido: String(a.contenido || "").trim() };
  if (a.tipo === "enlace" || a.tipo === "video") base.contenido = urlSegura(base.contenido);
  if (a.tipo === "pregunta") {
    const orig = a.opciones || [], ops = [], k0 = Number(a.correcta); let k = 0;
    orig.forEach((o, i) => { const t = String(o || "").trim(); if (t) { if (i === k0) k = ops.length; ops.push(t); } });
    base.opciones = ops; base.correcta = k;
  } else { base.opciones = null; base.correcta = null; }
  return base;
}
export const errorModulo = (m) => {
  if (!String(m.nombre || "").trim()) return "Ponle un nombre al módulo.";
  const n = Number(m.numero); if (!Number.isInteger(n) || n < 1 || n > 999) return "El número del módulo tiene que ser entero entre 1 y 999.";
  for (const [k, t] of [["xp", "El XP"], ["oro", "El oro"]]) { const v = Number(m[k]); if (m[k] === "" || !Number.isInteger(v) || v < 0 || v > 500) return `${t} tiene que ser un número entero entre 0 y 500.`; }
  return "";
};

// ¿Es correcta la respuesta? (idx = posición elegida)
export const esCorrecta = (act, idx) => act.tipo === "pregunta" && Number(idx) === Number(act.correcta);

// Orden de visualización: materia, número, id
export const ordenarModulos = (ms) => [...ms].sort((a, b) => (a.materia_id ?? 1e12) - (b.materia_id ?? 1e12) || a.numero - b.numero || a.id - b.id);

/**
 * Estado de cada módulo para un estudiante.
 * modulos = lista de módulos; acts = actividades (todas); hechas = Set/array de ids de actividad hechas; cierres = Set/array de ids de módulo cerrados
 * → [{ ...modulo, total, hechas, pct, estado: 'bloqueado'|'disponible'|'completo', bloqueadoPor }]  (solo los visibles para el curso)
 * Reglas: solo cuentan módulos activos y visibles; un módulo sin actividades no se puede completar (queda "vacio" y no bloquea a los siguientes);
 *         el módulo se bloquea si el anterior de su misma materia (no libre) no está completo.
 */
export function estadoModulos(modulos, acts, hechas, grado, cierres = []) {
  const H = new Set([...(hechas || [])].map(Number)), C = new Set([...(cierres || [])].map(Number));
  const vis = ordenarModulos(modulos.filter((m) => m.activo !== false && misionVisiblePara(m.grado_id || "", grado)));
  const porMod = new Map();
  acts.filter((a) => a.activa !== false).forEach((a) => { if (!porMod.has(a.modulo_id)) porMod.set(a.modulo_id, []); porMod.get(a.modulo_id).push(a); });
  const out = [], ultimoPorMateria = new Map();
  for (const m of vis) {
    const lista = porMod.get(m.id) || [], total = lista.length, h = lista.filter((a) => H.has(Number(a.id))).length;
    const completo = total > 0 && h === total;
    const previo = ultimoPorMateria.get(m.materia_id ?? 0);
    let estado = completo || C.has(m.id) ? "completo" : "disponible", bloqueadoPor = null;
    if (total === 0 && estado !== "completo") estado = "vacio";
    if (estado !== "completo" && !m.libre && previo && previo.estado !== "completo") { estado = "bloqueado"; bloqueadoPor = previo.id; }
    const e = { ...m, total, hechas: h, pct: total ? Math.round((h / total) * 100) : 0, estado, bloqueadoPor };
    out.push(e);
    if (estado !== "vacio") ultimoPorMateria.set(m.materia_id ?? 0, e);      // un módulo vacío no frena a los siguientes
  }
  return out;
}
// Resumen por materia: cuántos módulos completos hay y el avance general
export function resumenPorMateria(estados, materias = []) {
  const nom = new Map(materias.map((m) => [m.id, m.nombre])), por = new Map();
  estados.filter((e) => e.estado !== "vacio").forEach((e) => {
    const k = e.materia_id ?? 0; if (!por.has(k)) por.set(k, { materia_id: e.materia_id ?? null, nombre: e.materia_id ? nom.get(e.materia_id) || "Materia" : "General", modulos: 0, completos: 0, hechas: 0, total: 0 });
    const r = por.get(k); r.modulos++; if (e.estado === "completo") r.completos++; r.hechas += e.hechas; r.total += e.total;
  });
  return [...por.values()].map((r) => ({ ...r, pct: r.total ? Math.round((r.hechas / r.total) * 100) : 0 }));
}
