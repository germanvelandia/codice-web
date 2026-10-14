// =====================================================================================
//  MÓDULOS DE ESTUDIO · lógica pura (sin base de datos)
//  Un módulo = número + nombre + actividades (lectura, enlace, video, pregunta).
//  El módulo se completa cuando todas sus actividades activas están hechas; el siguiente se desbloquea (salvo módulos "libres").
// =====================================================================================
import { misionVisiblePara } from "./gradosMundo";
import { errorNotaModulo } from "./notasModulo";
import { urlSegura, videoIncrustable, errorLeccion, normalizarLeccion, ESPECIFICACION_BLOQUES } from "./leccion";

export const TIPOS_ACTIVIDAD = {
  lectura: { nombre: "Lectura", emoji: "📖" },
  enlace: { nombre: "Enlace", emoji: "🔗" },
  video: { nombre: "Video", emoji: "🎬" },
  pregunta: { nombre: "Pregunta", emoji: "❓" },
  leccion: { nombre: "Lección interactiva", emoji: "🎓" },
};
export const EMOJIS_MODULO = ["📘", "📗", "📙", "📕", "🕊️", "⚖️", "🙏", "🌱", "🧭", "🔥", "⭐", "🏛️"];

// urlSegura y videoIncrustable viven en leccion.js (las usan también los bloques de las lecciones)
export { urlSegura, videoIncrustable };

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
  } else if (a.tipo === "leccion") { return errorLeccion({ titulo: a.titulo, bloques: a.bloques }); }
  else return "Elige el tipo de actividad.";
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
  if (a.tipo === "leccion") { base.bloques = normalizarLeccion({ titulo: base.titulo, bloques: a.bloques }).leccion.bloques; base.contenido = ""; } else base.bloques = null;
  return base;
}
export const errorModulo = (m) => {
  if (!String(m.nombre || "").trim()) return "Ponle un nombre al módulo.";
  const n = Number(m.numero); if (!Number.isInteger(n) || n < 1 || n > 999) return "El número del módulo tiene que ser entero entre 1 y 999.";
  for (const [k, t] of [["xp", "El XP"], ["oro", "El oro"]]) { const v = Number(m[k]); if (m[k] === "" || !Number.isInteger(v) || v < 0 || v > 500) return `${t} tiene que ser un número entero entre 0 y 500.`; }
  return errorNotaModulo(m);
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

// =====================================================================================
//  CREAR EL MÓDULO CON AYUDA DE UNA IA: instrucciones para copiar y lectura de la respuesta
// =====================================================================================
export const MAX_ACTIVIDADES_IA = 30;
export function instruccionesIA({ materia = "", curso = "", tema = "" } = {}) {
  const para = [materia && `la materia «${materia}»`, curso && `estudiantes de ${curso}`].filter(Boolean).join(", para ");
  return `Eres un docente experto que prepara un MÓDULO DE ESTUDIO interactivo para una plataforma educativa${para ? ` (${para})` : ""}. Con el material que aparece al final, en «MATERIAL DEL MÓDULO», arma el módulo: una o varias LECCIONES interactivas (hechas con bloques) y, al final, algunas preguntas sueltas de repaso.

DEVUELVE ÚNICAMENTE un bloque de código JSON (sin explicaciones antes ni después) con exactamente esta estructura:

\`\`\`json
{
  "modulo": {
    "nombre": "Nombre corto del módulo",
    "descripcion": "Una o dos frases sobre qué aprenderá el estudiante",
    "emoji": "📘",
    "xp": 30,
    "oro": 10
  },
  "actividades": [
    { "tipo": "leccion", "titulo": "Título de la lección", "bloques": [ ...bloques... ] },
    { "tipo": "pregunta", "titulo": "Título corto", "contenido": "Enunciado de la pregunta", "opciones": ["Opción A", "Opción B", "Opción C", "Opción D"], "correcta": "B" }
  ]
}
\`\`\`

Cada actividad "leccion" lleva su lista de "bloques". ESTOS son los tipos de bloque que puedes usar dentro de una lección:

${ESPECIFICACION_BLOQUES.replace(/^TIPOS DE BLOQUE[^\n]*\n/, "")}
REGLAS:
1. En "actividades" el "tipo" es "leccion" (con "bloques") o "pregunta" (suelta, con "correcta" como LETRA: "A", "B", "C" o "D"). Usa de 1 a 3 lecciones y de 1 a 3 preguntas sueltas de repaso al final. NO uses "lectura": el texto va en bloques "texto" dentro de la lección.
2. Cada lección tiene entre 8 y 20 bloques. Empieza presentando el tema (bloque "texto" o "destacado") y termina con una "reflexion". Alterna explicación e interacción: después de cada 2 o 3 bloques de contenido pon una "pregunta" o una actividad (tarjetas, descubre, pasos). Incluye de 2 a 4 bloques "pregunta" y, si el tema lo permite, una sopa, un crucigrama o un criptograma.
3. No inventes direcciones web: deja "url" vacío en imágenes, videos y botones de enlace, salvo que el material traiga la dirección exacta.
4. Usa un lenguaje claro y adecuado para la edad de los estudiantes, en español. Usa SOLO información del material (puedes agregar ejemplos sencillos que ayuden a entenderlo); no inventes datos, fechas ni citas.
5. Reparte las respuestas correctas entre las posiciones: que no sean siempre la misma.
6. Responde SOLO con el bloque JSON válido: comillas dobles rectas, sin comas sobrantes y sin comentarios.
${tema ? `\nTema del módulo: ${tema}\n` : ""}
MATERIAL DEL MÓDULO:
(pega aquí tus apuntes, un resumen o el contenido del módulo)
`;
}

const TIPOS_ALIAS = { lectura: "lectura", texto: "lectura", leccion: "leccion", lección: "leccion", "lección interactiva": "leccion", enlace: "enlace", link: "enlace", recurso: "enlace", video: "video", vídeo: "video", pregunta: "pregunta", quiz: "pregunta", trivia: "pregunta", "opcion multiple": "pregunta", "opción múltiple": "pregunta" };
const sinTildesLocal = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const quitarLetraInicial = (o) => String(o ?? "").replace(/^\s*(?:\(?[A-Da-d]\)|[A-Da-d][.):])\s+/, "").trim();
const primerGrafema = (t) => { const s = String(t || "").trim(); if (!s) return ""; try { if (typeof Intl !== "undefined" && Intl.Segmenter) for (const x of new Intl.Segmenter("es", { granularity: "grapheme" }).segment(s)) return x.segment.slice(0, 10); } catch { /* sin Segmenter */ } return Array.from(s).slice(0, 2).join(""); };
export function indiceCorrectaIA(valor, opciones) {
  const t = sinTildesLocal(valor).toLowerCase().trim();
  let m = t.match(/^(?:opcion|respuesta)?\s*([a-d])\s*[).:\-]?$/); if (m) return "abcd".indexOf(m[1]);
  m = t.match(/^(?:opcion|respuesta)?\s*([1-4])\s*[).:\-]?$/); if (m) return Number(m[1]) - 1;
  const k = opciones.findIndex((o) => sinTildesLocal(o).toLowerCase().trim() === t); return k;       // -1 si no se entiende
}
// Saca el JSON de lo que la IA respondió (con o sin ```json, con texto alrededor, comillas "inteligentes" o comas sobrantes)
export function extraerJSON(texto) {
  let t = String(texto || "").trim(); if (!t) return { error: "Pega aquí la respuesta completa de la IA." };
  const cerca = t.match(/```(?:json|JSON)?\s*([\s\S]*?)```/); if (cerca && /[{[]/.test(cerca[1])) t = cerca[1].trim();
  const a = t.search(/[{[]/); if (a < 0) return { error: "No encontré el bloque JSON en lo que pegaste. Copia la respuesta completa de la IA, desde la primera llave { hasta la última }." };
  const cierre = t[a] === "{" ? "}" : "]", b = t.lastIndexOf(cierre); if (b <= a) return { error: "El texto parece cortado: falta el final del bloque JSON. Pídele a la IA que lo entregue completo." };
  const crudo = t.slice(a, b + 1);
  const intentos = [crudo, crudo.replace(/,\s*([}\]])/g, "$1"), crudo.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/,\s*([}\]])/g, "$1")];
  for (const i of intentos) { try { return { json: JSON.parse(i) }; } catch { /* siguiente intento */ } }
  return { error: "La respuesta no es un JSON válido (revisa que no esté cortada y que use comillas dobles). Pídele a la IA: «Entrégame solo el bloque JSON válido, completo»." };
}
const entero = (v, por, max = 500) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n))) : por; };

/**
 * → { error } | { modulos: [{ nombre, descripcion, emoji, xp, oro, actividades: [{...actividad limpia, fila, error}], buenas, malas }], avisos }
 * Cada actividad trae `error` ("" si está bien). Las malas no se guardan, pero se muestran para que la docente decida.
 */
export function leerRespuestaIA(texto) {
  const r = extraerJSON(texto); if (r.error) return r;
  const raiz = r.json, avisos = [];
  let lista = Array.isArray(raiz) ? raiz : Array.isArray(raiz.modulos) ? raiz.modulos : [raiz];
  lista = lista.filter((x) => x && typeof x === "object");
  if (!lista.length) return { error: "No encontré ningún módulo en la respuesta." };
  const modulos = lista.map((x, i) => {
    const mo = x.modulo && typeof x.modulo === "object" ? x.modulo : x;
    const acts = Array.isArray(x.actividades) ? x.actividades : Array.isArray(mo.actividades) ? mo.actividades : [];
    const nombre = String(mo.nombre || mo.titulo || "").trim().slice(0, 120);
    if (!nombre) avisos.push(`El módulo ${i + 1} no trae nombre: ponle uno antes de crearlo.`);
    if (acts.length > MAX_ACTIVIDADES_IA) avisos.push(`El módulo "${nombre || i + 1}" trae ${acts.length} actividades: solo se toman las primeras ${MAX_ACTIVIDADES_IA}.`);
    const actividades = acts.slice(0, MAX_ACTIVIDADES_IA).map((a, k) => {
      a = a && typeof a === "object" ? a : {};
      const tipo = TIPOS_ALIAS[sinTildesLocal(a.tipo).toLowerCase().trim()] || TIPOS_ALIAS[String(a.tipo || "").toLowerCase().trim()] || "";
      const base = { fila: k + 1, tipo, titulo: String(a.titulo || a.nombre || "").trim().slice(0, 160), contenido: String(a.contenido ?? a.texto ?? a.enunciado ?? a.url ?? "").replace(/\\n/g, "\n").trim(), activa: true };
      if (tipo === "leccion") {
        const l = normalizarLeccion({ titulo: base.titulo, bloques: a.bloques });
        if (!Array.isArray(a.bloques)) { base.error = 'La lección no trae la lista "bloques".'; return base; }
        base.bloques = l.leccion.bloques; base.contenido = ""; base.omitidos = l.omitidos; base.detalle = l.errores.map((e) => `Bloque ${e.n}: ${e.mensaje}`).concat(l.avisos);
        if (!base.titulo) base.titulo = "Lección " + (k + 1);
        if (!base.bloques.length) { base.error = "Ningún bloque de la lección se pudo leer: " + (base.detalle[0] || "está vacía") + "."; return base; }
        return base;
      }
      if (tipo === "pregunta") {
        const ops = (Array.isArray(a.opciones) ? a.opciones : []).map(quitarLetraInicial).filter(Boolean).slice(0, 4);
        base.opciones = ops; base.correcta = indiceCorrectaIA(a.correcta ?? a.respuesta, ops);
        if (!base.titulo) base.titulo = "Pregunta " + (k + 1);
        if (base.correcta < 0 && ops.length) { base.error = 'No entendí cuál es la correcta (la IA debía escribir "A", "B", "C" o "D").'; return base; }
      } else if (!base.titulo && tipo) base.titulo = (tipo === "lectura" ? "Lectura " : tipo === "video" ? "Video " : "Enlace ") + (k + 1);
      if (!tipo) { base.error = 'El tipo de actividad no es "leccion", "lectura", "pregunta", "enlace" o "video".'; return base; }
      base.error = errorActividad(base);
      return base;
    });
    const buenas = actividades.filter((a) => !a.error).length;
    return { nombre, descripcion: String(mo.descripcion || "").trim().slice(0, 600), emoji: primerGrafema(mo.emoji) || "📘", xp: entero(mo.xp, 30), oro: entero(mo.oro, 10), actividades, buenas, malas: actividades.length - buenas };
  });
  return { modulos, avisos };
}
