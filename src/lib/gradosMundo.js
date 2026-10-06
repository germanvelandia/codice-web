// =====================================================================================
//  GRADOS Y NIVELES DEL MUNDO
//  Los cursos son 801, 802…, 901…, 1001… El NIVEL es el grado: 801 y 802 son de octavo, 901 de noveno, 1001 de décimo.
//  Una misión puede ser para: todos los cursos, TODO un nivel (por ejemplo todo octavo) o un curso en particular.
//  Se guarda en la misma columna que antes (grado_id): vacío = todos; "nivel:8" = todo octavo; "802" = solo ese curso.
// =====================================================================================

export const NIVELES = { 6: "Sexto", 7: "Séptimo", 8: "Octavo", 9: "Noveno", 10: "Décimo", 11: "Undécimo" };
export const MAX_POR_LUGAR = 5;

// "801" → "8", "1001" → "10"; cualquier otra cosa (un curso personalizado) → null
export function nivelDeGrado(id) {
  const m = String(id ?? "").trim().match(/^(\d{1,2})(\d{2})$/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 13 ? String(n) : null;
}
export const claveNivel = (n) => `nivel:${Number(n)}`;
export const esNivel = (v) => typeof v === "string" && /^nivel:\d{1,2}$/.test(v);
export const nivelDeClave = (v) => String(Number(v.slice(6)));
export const nombreNivel = (n) => NIVELES[Number(n)] || `Grado ${n}`;

// ¿La ve un estudiante de ese curso?
export function misionVisiblePara(gradoMision, gradoEstudiante) {
  if (!gradoMision) return true;
  if (esNivel(gradoMision)) return nivelDeGrado(gradoEstudiante) === nivelDeClave(gradoMision);
  return String(gradoMision) === String(gradoEstudiante);
}
export function etiquetaPara(gradoMision) {
  if (!gradoMision) return "Todos los cursos";
  return esNivel(gradoMision) ? `Todo ${nombreNivel(nivelDeClave(gradoMision)).toLowerCase()}` : `Curso ${gradoMision}`;
}
export const cursosDelNivel = (cursos, n) => cursos.filter((c) => nivelDeGrado(c) === String(Number(n)));
// Los niveles que existen entre estos cursos, de menor a mayor: ["8", "9", "10"]
export const nivelesDe = (cursos) => [...new Set(cursos.map(nivelDeGrado).filter(Boolean))].sort((a, b) => Number(a) - Number(b));

// ---- el máximo de misiones visibles por lugar (cuentan las de cada curso + las generales + las de su nivel) ----
export function visiblesParaCurso(misiones, lugar, curso, exceptoId) {
  return misiones.filter((m) => m.lugar === lugar && m.activo && m.id !== exceptoId && misionVisiblePara(m.grado_id, curso)).length;
}
// ¿A qué cursos afecta una misión con este "para quién"?
export function cursosAfectados(gradoSel, cursos) {
  if (!gradoSel) return cursos;
  if (esNivel(gradoSel)) return cursosDelNivel(cursos, nivelDeClave(gradoSel));
  return [String(gradoSel)];
}
// Si poner una misión VISIBLE en ese lugar haría pasar de 5 a algún curso, devuelve cuál (curso, "todos" o un nivel); si cabe, null.
export function cursoSaturado(misiones, lugar, gradoSel, exceptoId, cursos) {
  for (const c of cursosAfectados(gradoSel, cursos)) if (visiblesParaCurso(misiones, lugar, c, exceptoId) >= MAX_POR_LUGAR) return c;
  const iguales = misiones.filter((m) => m.lugar === lugar && m.activo && m.id !== exceptoId && String(m.grado_id || "") === String(gradoSel || "")).length;
  return iguales >= MAX_POR_LUGAR ? (gradoSel ? String(gradoSel) : "todos") : null;
}
export const etiquetaSaturado = (c) => (c === "todos" ? "todos los cursos" : esNivel(c) ? `todo ${nombreNivel(nivelDeClave(c)).toLowerCase()}` : `el curso ${c}`);

// ---- para el Excel: entender lo que escribe la docente ----
export const sinTildes = (t) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const PALABRAS_NIVEL = { sexto: 6, "6to": 6, septimo: 7, "7mo": 7, octavo: 8, "8vo": 8, noveno: 9, "9no": 9, decimo: 10, "10mo": 10, undecimo: 11, "11": 11 };
// Devuelve { valor } (null = todos, "nivel:8" o "802") o { error }
export function interpretarPara(texto, cursos) {
  let t = sinTildes(texto).replace(/[°º]/g, "");
  if (t === "" || ["todos", "todo", "todas", "todos los cursos", "general", "generales", "*"].includes(t)) return { valor: null };
  for (let previo = ""; previo !== t;) { previo = t; t = t.replace(/^(todo|todos|todas|el|la|los|las|de|del|grado|curso|nivel)\s+/, "").trim(); } // "todo el octavo", "grado 8", "curso 802"…
  if (PALABRAS_NIVEL[t]) return { valor: claveNivel(PALABRAS_NIVEL[t]) };
  if (/^\d{1,2}$/.test(t) && Number(t) >= 1 && Number(t) <= 13) return { valor: claveNivel(t) };
  const id = t.replace(/\s+/g, "");
  if (cursos.map(String).includes(id)) return { valor: id };
  const niveles = nivelesDe(cursos).map((n) => nombreNivel(n)).join(", ");
  return { error: `No entiendo "${String(texto).trim()}" en "para_quien". Usa: Todos${niveles ? `, ${niveles}` : ""}${cursos.length ? ` o un curso (${cursos.slice(0, 6).join(", ")}${cursos.length > 6 ? "…" : ""})` : ""}.` };
}
export const textoParaExcel = (gradoMision) => (!gradoMision ? "Todos" : esNivel(gradoMision) ? nombreNivel(nivelDeClave(gradoMision)) : String(gradoMision));
