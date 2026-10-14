// =====================================================================================
//  MÓDULO → NOTA DE LA PLANILLA · lógica pura
//  La docente puede decir "el avance de este módulo cuenta como una nota": se crea una columna en la
//  Planilla (materia + curso + periodo + categoría) y cada estudiante recibe su nota.
//  Nunca se baja una nota que ya esté puesta: solo se crean notas nuevas o se suben las que quedaron cortas.
// =====================================================================================
import { misionVisiblePara } from "./gradosMundo";

export const MODOS_NOTA = {
  proporcional: { nombre: "Según lo que avanzó", desc: "Completó 3 de 6 actividades → la mitad de la escala. Quien no ha empezado no recibe nota todavía." },
  completo: { nombre: "Solo al terminar el módulo", desc: "Quien completa todas las actividades recibe la nota máxima; los demás no reciben nada todavía." },
};
const redondear = (n) => Math.round(n * 10) / 10;

// Nota de un estudiante, o null si todavía no le corresponde ninguna.
export function notaDeModulo({ total, hechas, modo = "proporcional", escalaMin = 1, notaMax = 5 }) {
  const t = Number(total), h = Number(hechas);
  if (!(t > 0) || !(h > 0)) return null;
  const mx = Number(notaMax) || 5, mn = Number.isFinite(Number(escalaMin)) ? Number(escalaMin) : 1;
  if (modo === "completo") return h >= t ? redondear(mx) : null;
  return redondear(mn + (mx - mn) * Math.min(1, h / t));
}

// Revisa la configuración de nota de un módulo → mensaje de error o ""
export function errorNotaModulo(m) {
  if (!m || !m.nota_activa) return "";
  if (!m.materia_id) return "Para guardar la nota en la planilla, el módulo debe tener una materia.";
  if (!m.nota_categoria_id) return "Elige la categoría de la planilla donde va la nota.";
  if (!String(m.nota_periodo ?? "").trim()) return "Elige el periodo de la planilla.";
  if (m.nota_modo && !MODOS_NOTA[m.nota_modo]) return "El modo de la nota no es válido.";
  return "";
}
export const nombreColumnaNota = (m) => (String(m.nota_nombre || "").trim() || `Módulo ${m.numero} — ${m.nombre}`).slice(0, 120);

/**
 * Calcula qué notas hay que escribir.
 *  modulo, actividades [{id, activa}], estudiantes [{id, grado_id, activo}], avance [{estudiante_id, actividad_id}],
 *  existentes: { [estudianteId]: nota ya puesta en la planilla }, config { escala_min, nota_maxima }
 * → { filas: [{ estudiante_id, grado_id, nota, accion: "crear" | "subir" }], resumen: { crear, subir, igual, sinAvance, estudiantes } }
 */
export function planNotas({ modulo, actividades, estudiantes, avance, existentes = {}, config = {} }) {
  const acts = new Set((actividades || []).filter((a) => a.activa !== false).map((a) => Number(a.id)));
  const hechas = new Map();
  (avance || []).forEach((r) => { if (acts.has(Number(r.actividad_id))) { const k = Number(r.estudiante_id); if (!hechas.has(k)) hechas.set(k, new Set()); hechas.get(k).add(Number(r.actividad_id)); } });
  const filas = [], resumen = { crear: 0, subir: 0, igual: 0, sinAvance: 0, estudiantes: 0 };
  for (const e of estudiantes || []) {
    if (e.activo === false || e.activo === 0) continue;
    if (!misionVisiblePara(modulo.grado_id || "", e.grado_id)) continue;
    resumen.estudiantes++;
    const nota = notaDeModulo({ total: acts.size, hechas: (hechas.get(Number(e.id)) || new Set()).size, modo: modulo.nota_modo || "proporcional", escalaMin: config.escala_min ?? 1, notaMax: config.nota_maxima ?? 5 });
    if (nota == null) { resumen.sinAvance++; continue; }
    const previa = existentes[e.id] ?? existentes[String(e.id)];
    if (previa == null || previa === "") { filas.push({ estudiante_id: e.id, grado_id: e.grado_id, nota, accion: "crear" }); resumen.crear++; }
    else if (nota > Number(previa) + 0.0001) { filas.push({ estudiante_id: e.id, grado_id: e.grado_id, nota, accion: "subir" }); resumen.subir++; }
    else resumen.igual++;
  }
  return { filas, resumen };
}
export const textoResumenNotas = (r) => !r ? "" : (r.crear + r.subir === 0 ? `Sin cambios (${r.igual} ya al día${r.sinAvance ? `, ${r.sinAvance} sin avance` : ""}).` : `${r.crear} ${r.crear === 1 ? "nota nueva" : "notas nuevas"}${r.subir ? `, ${r.subir} ${r.subir === 1 ? "mejorada" : "mejoradas"}` : ""}${r.igual ? `, ${r.igual} sin cambios` : ""}${r.sinAvance ? `, ${r.sinAvance} sin avance` : ""}.`);
