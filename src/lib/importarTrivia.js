// =====================================================================================
//  PREGUNTADOS · CARGA MASIVA POR EXCEL (lógica pura: sin Excel ni base de datos de por medio)
//  El libro trae tres hojas:
//    · "Preguntas"   → una fila por pregunta: categoría, pregunta, 4 opciones (A–D) y cuál es la correcta
//    · "Categorías"  → TODAS las categorías (nombre, emoji, color, materia). Sirve para crear categorías nuevas con su emoji y color
//    · "Instrucciones"
//  Solo CREA: si una pregunta ya existe en esa categoría (mismo enunciado) se omite, así volver a subir el mismo archivo no duplica nada.
//  Si una categoría del Excel no existe, se crea (si la docente lo permite en la revisión).
// =====================================================================================
import { sinTildes } from "./gradosMundo";
import { tablaAObjetos } from "./importarContenido";

export const MAX_FILAS_TRIVIA = 3000;
export const COLORES_TRIVIA = ["#0EA5E9", "#22C55E", "#EC4899", "#F59E0B", "#8B5CF6", "#EF4444", "#14B8A6", "#6366F1"];
export const LETRAS = ["A", "B", "C", "D"];
const txt = (v) => (v == null ? "" : String(v).trim());
const norm = (t) => sinTildes(String(t ?? "")).toLowerCase().replace(/\s+/g, " ").trim();
const SI = ["si", "s", "1", "true", "verdadero", "x", "yes", "activa", "activo", "visible"], NO = ["no", "n", "0", "false", "falso", "inactiva", "inactivo", "oculta", "oculto"];

export const CABECERAS_PREGUNTAS = ["categoria", "pregunta", "opcion_a", "opcion_b", "opcion_c", "opcion_d", "correcta", "activa"];
export const ANCHOS_PREGUNTAS = [22, 60, 28, 28, 28, 28, 10, 8];
export const CABECERAS_CATEGORIAS = ["categoria", "emoji", "color", "materia", "preguntas_actuales"];
export const ANCHOS_CATEGORIAS = [26, 8, 12, 24, 18];
const ALIAS_PREGUNTAS = {
  categoria: ["categoria", "categorias", "tema", "category"], pregunta: ["pregunta", "enunciado", "texto", "question"],
  a: ["opcion_a", "a", "opcion_1", "respuesta_a", "respuesta_1", "opcion1"], b: ["opcion_b", "b", "opcion_2", "respuesta_b", "respuesta_2", "opcion2"],
  c: ["opcion_c", "c", "opcion_3", "respuesta_c", "respuesta_3", "opcion3"], d: ["opcion_d", "d", "opcion_4", "respuesta_d", "respuesta_4", "opcion4"],
  correcta: ["correcta", "respuesta_correcta", "clave", "respuesta"], activa: ["activa", "activo", "visible"],
};
const ALIAS_CATEGORIAS = { categoria: ["categoria", "nombre", "categorias"], emoji: ["emoji", "icono"], color: ["color"], materia: ["materia", "asignatura"] };
export const MENSAJE_SIN_COLUMNAS_TRIVIA = 'No encontré las columnas "categoria" y "pregunta". Revisa que la primera fila de la hoja "Preguntas" tenga los encabezados de la plantilla.';

export const objetosDePreguntas = (aoa) => tablaAObjetos(aoa, ALIAS_PREGUNTAS, ["categoria", "pregunta"], MENSAJE_SIN_COLUMNAS_TRIVIA);
// La hoja de categorías es opcional: si no se entiende, simplemente no se usa
export function objetosDeCategorias(aoa) { const r = tablaAObjetos(aoa || [], ALIAS_CATEGORIAS, ["categoria"], "x"); return r.error ? { objetos: [] } : r; }

const primerEmoji = (t) => {
  const s = txt(t); if (!s) return "";
  try { if (typeof Intl !== "undefined" && Intl.Segmenter) { const seg = new Intl.Segmenter("es", { granularity: "grapheme" }); for (const x of seg.segment(s)) return x.segment.slice(0, 10); } } catch { /* sin Segmenter */ }
  return Array.from(s).slice(0, 2).join("");
};
const colorValido = (t) => /^#[0-9a-f]{6}$/i.test(txt(t));

// La opción correcta puede venir como letra (A, b, "C)", "Opción D"), número (1–4) o el texto de la respuesta
export function resolverCorrecta(valor, opciones) {
  const t = norm(valor); if (!t) return { error: "Falta indicar cuál es la correcta (A, B, C o D)." };
  let m = t.match(/^(?:opcion|respuesta)?\s*([a-d])\s*[).:\-]?$/); if (m) return { idx: "abcd".indexOf(m[1]) };
  m = t.match(/^(?:opcion|respuesta)?\s*([1-4])(?:\.0)?\s*[).:\-]?$/); if (m) return { idx: Number(m[1]) - 1 };
  const k = opciones.findIndex((o) => norm(o) === t); if (k >= 0) return { idx: k };
  return { error: `No entendí la correcta "${txt(valor)}": escribe A, B, C o D (o el texto exacto de la respuesta).` };
}

/**
 * objetos = filas de la hoja "Preguntas" · objetosCat = filas de la hoja "Categorías" (opcional)
 * ctx.existentes = [{ id, nombre, textos: [enunciados que ya tiene] }] · ctx.materias = [{ id, nombre }]
 * → { filas, categorias (las que se van a crear), resumen, porCategoria }
 */
export function analizarTrivia(objetos, objetosCat = [], ctx = {}) {
  const existentes = ctx.existentes || [], materias = ctx.materias || [];
  if (objetos.length > MAX_FILAS_TRIVIA) return { error: `El archivo tiene ${objetos.length} preguntas; el máximo por carga es ${MAX_FILAS_TRIVIA}. Divídelo en varios archivos.` };
  const porNombre = new Map(existentes.map((c) => [norm(c.nombre), c]));
  const vistos = new Set(); existentes.forEach((c) => (c.textos || []).forEach((t) => vistos.add(`${norm(c.nombre)}|${norm(t)}`)));
  const nuevas = new Map(), avisos = [];
  let colorIdx = existentes.length;
  const siguienteColor = () => COLORES_TRIVIA[colorIdx++ % COLORES_TRIVIA.length];
  const crearCategoria = (nombre, hoja) => {
    const clave = norm(nombre); if (nuevas.has(clave)) return nuevas.get(clave);
    let materia_id = null, aviso = "";
    if (hoja && txt(hoja.materia)) { const m = materias.find((x) => norm(x.nombre) === norm(hoja.materia)); if (m) materia_id = m.id; else aviso = `La materia "${txt(hoja.materia)}" no existe: la categoría queda general.`; }
    const c = { nombre: txt(nombre).replace(/\s+/g, " "), emoji: (hoja && primerEmoji(hoja.emoji)) || "❓", color: hoja && colorValido(hoja.color) ? txt(hoja.color).toUpperCase() : siguienteColor(), materia_id, aviso, enHoja: !!hoja, conPreguntas: 0 };
    nuevas.set(clave, c); return c;
  };
  // 1) las categorías de la hoja "Categorías" que no existen todavía
  const deHoja = new Map(); (objetosCat || []).forEach((o) => { const n = txt(o.categoria); if (n && !deHoja.has(norm(n))) deHoja.set(norm(n), o); });
  deHoja.forEach((o, clave) => {
    const nombre = txt(o.categoria);
    if (nombre.length > 60) { avisos.push(`La categoría "${nombre.slice(0, 30)}…" tiene un nombre muy largo (máximo 60 letras) y no se creará.`); return; }
    if (!porNombre.has(clave)) crearCategoria(nombre, o);
  });
  // 2) las preguntas
  const filas = [], resumenCat = new Map();
  const cuenta = (nombre, nueva, campo) => { const k = norm(nombre); if (!resumenCat.has(k)) resumenCat.set(k, { nombre, nueva, nuevas: 0, iguales: 0, errores: 0 }); resumenCat.get(k)[campo]++; };
  for (const o of objetos) {
    const pregunta = txt(o.pregunta);
    if (/^ejemplo\b/i.test(norm(pregunta))) continue;                                    // las filas de ejemplo de la plantilla se ignoran
    const errores = [], err = (m) => errores.push(m);
    const catTexto = txt(o.categoria).replace(/\s+/g, " ");
    if (!catTexto) err("Falta la categoría."); else if (catTexto.length > 60) err("El nombre de la categoría es muy largo (máximo 60 letras).");
    if (!pregunta) err("Falta la pregunta."); else if (pregunta.length > 400) err("La pregunta es muy larga (máximo 400 letras).");
    const ops = [o.a, o.b, o.c, o.d].map(txt), vacias = ops.map((x, i) => (x ? "" : LETRAS[i])).filter(Boolean);
    if (vacias.length) err(`Faltan las opciones ${vacias.join(", ")}: Preguntados usa 4 opciones.`);
    else {
      if (new Set(ops.map(norm)).size !== 4) err("Hay dos opciones iguales.");
      if (ops.some((x) => x.length > 150)) err("Una opción es muy larga (máximo 150 letras).");
    }
    let correcta = 0;
    if (!vacias.length) { const r = resolverCorrecta(o.correcta, ops); if (r.error) err(r.error); else correcta = r.idx; }
    else if (!txt(o.correcta)) err("Falta indicar cuál es la correcta (A, B, C o D).");
    let activa = true; const ta = norm(o.activa); if (ta && !SI.includes(ta)) { if (NO.includes(ta)) activa = false; else err('"activa" tiene que ser SI o NO.'); }
    const fila = { fila: o.__fila, estado: "error", errores, categoria: catTexto, categoriaNueva: false, campos: null };
    if (errores.length) { filas.push(fila); if (catTexto) cuenta(catTexto, !porNombre.has(norm(catTexto)), "errores"); continue; }
    const clave = norm(catTexto), existente = porNombre.get(clave), nombreCat = existente ? existente.nombre : catTexto;
    fila.categoria = nombreCat;
    const k = `${clave}|${norm(pregunta)}`;
    if (vistos.has(k)) { fila.estado = "igual"; filas.push(fila); cuenta(nombreCat, !existente, "iguales"); continue; }
    vistos.add(k);
    let c = null; if (!existente) { c = nuevas.get(clave) || crearCategoria(catTexto, null); c.conPreguntas++; fila.categoriaNueva = true; fila.categoria = c.nombre; }
    fila.estado = "nueva"; fila.campos = { pregunta, opciones: ops, correcta, activa };
    filas.push(fila); cuenta(fila.categoria, !existente, "nuevas");
  }
  const categorias = [...nuevas.values()];
  const c = (e) => filas.filter((f) => f.estado === e).length;
  // las categorías de la hoja que no traen preguntas también aparecen en el resumen
  categorias.forEach((x) => { const k = norm(x.nombre); if (!resumenCat.has(k)) resumenCat.set(k, { nombre: x.nombre, nueva: true, nuevas: 0, iguales: 0, errores: 0 }); });
  return { filas, categorias, avisos: [...avisos, ...categorias.filter((x) => x.aviso).map((x) => x.aviso)], porCategoria: [...resumenCat.values()], resumen: { nuevas: c("nueva"), iguales: c("igual"), errores: c("error"), categoriasNuevas: categorias.length, total: filas.length } };
}

// Sin permiso para crear categorías: las filas de categorías inexistentes pasan a "sin categoría" y se omiten
export function sinCrearCategorias(analisis) {
  const filas = analisis.filas.map((f) => (f.estado === "nueva" && f.categoriaNueva ? { ...f, estado: "error", errores: [`La categoría "${f.categoria}" no existe y elegiste no crear categorías nuevas.`], campos: null } : f));
  const c = (e) => filas.filter((f) => f.estado === e).length;
  return { ...analisis, filas, categorias: [], resumen: { ...analisis.resumen, nuevas: c("nueva"), errores: c("error"), categoriasNuevas: 0 } };
}

// =====================================================================================
//  Excel: plantilla (con TODAS las categorías), exportación y lectura
// =====================================================================================
export function filasPlantillaTrivia(categorias = []) {
  const base = (cat) => ({ categoria: cat, pregunta: "EJEMPLO: escribe aquí tu pregunta (las filas que empiezan con EJEMPLO se ignoran)", opcion_a: "La respuesta correcta", opcion_b: "Otra opción", opcion_c: "Otra opción", opcion_d: "Otra opción", correcta: "A", activa: "SI" });
  return categorias.length ? categorias.map((c) => base(c.nombre)) : [base("Cultura General")];
}
export const filasCategoriasTrivia = (categorias = []) => categorias.map((c) => ({ categoria: c.nombre, emoji: c.emoji || "❓", color: c.color || "", materia: c.materia_nombre || "", preguntas_actuales: c.total ?? "" }));
export function filasExportarTrivia(categorias = [], preguntas = []) {
  const nom = new Map(categorias.map((c) => [c.id, c.nombre])), orden = new Map(categorias.map((c, i) => [c.id, i]));
  return [...preguntas].sort((a, b) => (orden.get(a.categoria_id) ?? 1e9) - (orden.get(b.categoria_id) ?? 1e9) || a.id - b.id).map((p) => {
    const o = Array.isArray(p.opciones) ? p.opciones : [];
    return { categoria: nom.get(p.categoria_id) || "", pregunta: p.pregunta, opcion_a: o[0] ?? "", opcion_b: o[1] ?? "", opcion_c: o[2] ?? "", opcion_d: o[3] ?? "", correcta: LETRAS[p.correcta] || "A", activa: p.activa === false ? "NO" : "SI" };
  });
}
export function filasInstruccionesTrivia() {
  return [
    { Columna: "Cómo funciona", "Qué escribir": 'Llena la hoja "Preguntas" (una fila por pregunta) y súbela con «Importar desde Excel». Antes de guardar te muestro una revisión: qué se va a crear, qué ya existe y qué filas tienen errores.' },
    { Columna: "categoria", "Qué escribir": 'El nombre de la categoría de Preguntados (la hoja "Categorías" trae todas las que ya existen). Si escribes una que no existe, se crea nueva (la revisión te lo avisa). No importan mayúsculas ni tildes: "etica" es lo mismo que "Ética".' },
    { Columna: "pregunta", "Qué escribir": "El enunciado (máximo 400 letras). Las filas cuya pregunta empieza con EJEMPLO se ignoran." },
    { Columna: "opcion_a … opcion_d", "Qué escribir": "Las 4 opciones de respuesta. Preguntados siempre usa 4, no pueden quedar vacías ni repetirse." },
    { Columna: "correcta", "Qué escribir": 'Cuál es la correcta: la letra A, B, C o D (también sirve 1, 2, 3 o 4, o el texto exacto de la respuesta).' },
    { Columna: "activa", "Qué escribir": "SI (por defecto) o NO. Con NO la pregunta se guarda pero no sale en el juego." },
    { Columna: 'Hoja "Categorías"', "Qué escribir": "Opcional. Para crear categorías nuevas con su emoji, color (formato #22C55E) y materia (el nombre exacto de una materia de CÓDICE). Si la categoría ya existe, esta hoja no la cambia. La columna preguntas_actuales es solo informativa." },
    { Columna: "Si repites el archivo", "Qué escribir": "No se duplica nada: una pregunta con el mismo enunciado en la misma categoría se omite. Esto solo crea; para editar o borrar preguntas usa las pantallas de siempre." },
  ];
}
export function crearLibroTrivia(XLSX, { categorias = [], preguntas = [], instrucciones = filasInstruccionesTrivia() } = {}) {
  const wb = XLSX.utils.book_new();
  const hoja = (filas, cabeceras, anchos) => { const h = XLSX.utils.json_to_sheet(filas.length ? filas : [Object.fromEntries(cabeceras.map((c) => [c, ""]))], { header: cabeceras }); h["!cols"] = anchos.map((w) => ({ wch: w })); return h; };
  XLSX.utils.book_append_sheet(wb, hoja(preguntas, CABECERAS_PREGUNTAS, ANCHOS_PREGUNTAS), "Preguntas");
  XLSX.utils.book_append_sheet(wb, hoja(filasCategoriasTrivia(categorias), CABECERAS_CATEGORIAS, ANCHOS_CATEGORIAS), "Categorías");
  const ins = XLSX.utils.json_to_sheet(instrucciones, { header: ["Columna", "Qué escribir"] }); ins["!cols"] = [{ wch: 24 }, { wch: 120 }];
  XLSX.utils.book_append_sheet(wb, ins, "Instrucciones");
  return wb;
}
// → { preguntas: filas de celdas, categorias: filas de celdas }
export function leerLibroTrivia(XLSX, datos) {
  const wb = XLSX.read(datos, { type: "binary" }), nombres = wb.SheetNames || [];
  const por = (n) => nombres.find((x) => norm(x) === n);
  const hojaP = por("preguntas") || nombres.find((x) => !["instrucciones", "categorias"].includes(norm(x))) || nombres[0], hojaC = por("categorias");
  const aoa = (n) => (n ? XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: "" }) : []);
  return { preguntas: aoa(hojaP), categorias: aoa(hojaC) };
}
