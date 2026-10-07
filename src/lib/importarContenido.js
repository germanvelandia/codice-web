// =====================================================================================
//  IMPORTAR ACERTIJOS Y SECRETOS DESDE EXCEL
//  Igual que con las misiones: todo lo importante (leer, validar, decidir qué se crea) es lógica pura, sin Excel de por medio,
//  y la librería xlsx se le pasa de afuera. A diferencia de las misiones, aquí SOLO se crea: si ya existe uno igual
//  (mismo tipo/escena, mismo título y mismo curso) se omite, así volver a subir el mismo archivo no duplica nada.
// =====================================================================================
import { sinTildes, interpretarPara, nivelesDe, nombreNivel } from "./gradosMundo";
import { TIPOS_ACERTIJO, CLAVES_TIPO, validarContenido } from "../game/acertijos";
import { ESCENAS_SECRETO, OBJETOS_SECRETO, validarSecreto } from "../game/secretos";

const txt = (v) => (v == null ? "" : String(v).trim());
const claveCabecera = (t) => sinTildes(t).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const sinPuntuacion = (t) => sinTildes(t).replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
const aEntero = (v) => { const t = txt(v).replace(",", "."); if (t === "") return null; const n = Number(t); return Number.isInteger(n) ? n : NaN; };
const SI = ["si", "s", "1", "true", "verdadero", "x", "yes", "visible"], NO = ["no", "n", "0", "false", "falso", "oculta", "oculto"];
const PARA = ["para_quien", "paraquien", "para", "curso", "grado", "nivel", "grupo", "cursos"];
const VISIBLE = ["visible", "visibles", "activa", "activo", "mostrar"];

// De una tabla (filas de celdas) a objetos. La fila de encabezados puede no ser la primera; tiene que traer las columnas `requeridas`.
export function tablaAObjetos(aoa, alias, requeridas, mensaje) {
  const por = {}; for (const [k, lista] of Object.entries(alias)) lista.forEach((a) => (por[a] = k));
  let cab = -1;
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    const claves = (aoa[i] || []).map((c) => por[claveCabecera(c)]).filter(Boolean);
    if (requeridas.every((r) => claves.includes(r))) { cab = i; break; }
  }
  if (cab < 0) return { error: mensaje };
  const cols = (aoa[cab] || []).map((c) => por[claveCabecera(c)] || null), objetos = [];
  for (let i = cab + 1; i < aoa.length; i++) {
    const celdas = aoa[i] || [], o = { __fila: i + 1 };
    cols.forEach((k, j) => { if (k && o[k] === undefined) o[k] = celdas[j]; });
    if (celdas.every((c) => txt(c) === "")) continue;
    objetos.push(o);
  }
  return { objetos, cabeceras: cols.filter(Boolean) };
}

// "visible": SI / NO / vacío (= SI)
function leerVisible(v, err) {
  const t = sinTildes(v); if (t === "") return true;
  if (SI.includes(t)) return true; if (NO.includes(t)) return false;
  err('"visible" tiene que ser SI o NO.'); return true;
}
function numero(o, campo, porDefecto, max, err) {
  const n = aEntero(o[campo]); if (n === null) return porDefecto;
  if (!Number.isInteger(n) || n < 0 || n > max) { err(`${campo} tiene que ser un número entero entre 0 y ${max}; escribiste "${txt(o[campo])}".`); return porDefecto; }
  return n;
}

// =====================================================================================
//  ACERTIJOS
// =====================================================================================
export const CABECERAS_ACERTIJOS = ["para_quien", "tipo", "titulo", "contenido", "pista", "tamano", "xp", "oro", "visible"];
export const ANCHOS_ACERTIJOS = [14, 16, 30, 60, 36, 9, 6, 6, 9];
const ALIAS_ACERTIJOS = {
  para_quien: PARA, tipo: ["tipo", "juego", "clase", "tipo_de_acertijo"], titulo: ["titulo", "nombre", "title"],
  contenido: ["contenido", "palabras", "frase", "palabra", "imagen", "enlace", "url", "texto", "palabras_o_frase"],
  pista: ["pista", "ayuda"], tamano: ["tamano", "tam", "tamano_cuadricula", "cuadricula"], xp: ["xp", "experiencia", "puntos"], oro: ["oro", "monedas"], visible: VISIBLE,
};
export const MENSAJE_SIN_COLUMNAS_ACERTIJOS = 'No encontré las columnas "tipo" y "titulo". Revisa que la primera fila del Excel tenga los encabezados de la plantilla.';
export const objetosDeAcertijos = (aoa) => tablaAObjetos(aoa, ALIAS_ACERTIJOS, ["tipo", "titulo"], MENSAJE_SIN_COLUMNAS_ACERTIJOS);

function resolverTipo(texto) {
  const t = sinPuntuacion(texto); if (!t) return { error: 'Falta el "tipo".' };
  const k = CLAVES_TIPO.find((c) => c === t || sinPuntuacion(TIPOS_ACERTIJO[c].nombre) === t || sinPuntuacion(TIPOS_ACERTIJO[c].nombre).startsWith(t) || (t.length >= 4 && sinPuntuacion(TIPOS_ACERTIJO[c].nombre).includes(t)) || (c === "cripto" && t.startsWith("cripto")) || (c === "rompe" && /^rompe|^puzzle|^puzle/.test(t)));
  return k ? { valor: k } : { error: `El tipo "${txt(texto)}" no existe. Usa: ${CLAVES_TIPO.map((c) => TIPOS_ACERTIJO[c].nombre).join(", ")}.` };
}

// ctx: { existentes: acertijos que ya hay, cursos: ids de cursos }
export function analizarAcertijos(objetos, ctx = {}) {
  const { existentes = [], cursos = [] } = ctx;
  const clave = (tipo, titulo, grado) => [tipo, sinTildes(titulo), String(grado || "")].join("|");
  const ya = new Set(existentes.map((a) => clave(a.tipo, a.titulo, a.grado_id))), vistas = new Map(), filas = [];
  let ejemplos = 0;
  for (const o of objetos) {
    if (/^ejemplo\b/i.test(txt(o.titulo))) { ejemplos++; continue; }
    const f = { fila: o.__fila, estado: "error", titulo: txt(o.titulo), errores: [], avisos: [], campos: null };
    const err = (m) => f.errores.push(m);
    const para = interpretarPara(o.para_quien, cursos); if (para.error) err(para.error);
    const t = resolverTipo(o.tipo); if (t.error) err(t.error);
    const titulo = txt(o.titulo); if (!titulo) err('Falta el "titulo".'); else if (titulo.length > 80) err(`El título pasa de 80 letras (tiene ${titulo.length}).`);
    const pista = txt(o.pista); if (pista.length > 200) err("La pista pasa de 200 letras.");
    let tam = null;
    if (t.valor === "sopa") { const n = aEntero(o.tamano); if (n === null) tam = 10; else if (!Number.isInteger(n) || n < 8 || n > 16) err('El "tamano" de la sopa tiene que ser un número entre 8 y 16.'); else tam = n; }
    if (t.valor === "rompe") { const m = txt(o.tamano).match(/^(\d)/); const n = m ? Number(m[1]) : null; if (txt(o.tamano) === "") tam = 3; else if (n === 3 || n === 4) tam = n; else err('El "tamano" del rompecabezas tiene que ser 3 (3×3) o 4 (4×4).'); }
    const contenido = txt(o.contenido);
    if (t.valor && !f.errores.length) { const e = validarContenido(t.valor, contenido, { tam }); if (e) err(e); }
    const xp = numero(o, "xp", 20, 500, err), oro = numero(o, "oro", 5, 500, err), activo = leerVisible(o.visible, err);
    if (f.errores.length) { filas.push(f); continue; }
    const k = clave(t.valor, titulo, para.valor);
    if (vistas.has(k)) { f.errores.push(`Está repetido: es igual a la fila ${vistas.get(k)} de este archivo.`); filas.push(f); continue; }
    vistas.set(k, f.fila);
    f.campos = { tipo: t.valor, titulo, contenido, pista, tam, grado_id: para.valor || "", xp, oro, activo };
    f.tipo = t.valor;
    if (ya.has(k)) { f.estado = "igual"; f.avisos.push("Ya existe un acertijo igual (mismo tipo, título y curso): se omite."); } else f.estado = "nueva";
    filas.push(f);
  }
  return { filas, ejemplosIgnorados: ejemplos, resumen: resumenDe(filas, ejemplos) };
}

export function filasPlantillaAcertijos() {
  const fila = (p) => Object.fromEntries(CABECERAS_ACERTIJOS.map((c) => [c, p[c] === undefined ? "" : p[c]]));
  return [
    fila({ para_quien: "Todos", tipo: "Sopa de letras", titulo: "EJEMPLO: Valores de la aldea", contenido: "PAZ, RESPETO, JUSTICIA, GRATITUD", pista: "Palabras que practicamos en clase", tamano: 10, xp: 20, oro: 5, visible: "SI" }),
    fila({ para_quien: "Octavo", tipo: "Criptograma", titulo: "EJEMPLO: Frase secreta", contenido: "El respeto abre todas las puertas", pista: "Una frase de nuestra clase" }),
    fila({ para_quien: "802", tipo: "Ahorcado", titulo: "EJEMPLO: Palabra del día", contenido: "SOLIDARIDAD", pista: "Ayudar sin esperar nada a cambio" }),
    fila({ tipo: "Rompecabezas", titulo: "EJEMPLO: Imagen para armar", contenido: "https://ejemplo.com/imagen.jpg", tamano: 3 }),
  ];
}
export function filasInstruccionesAcertijos(cursos = []) {
  const niveles = nivelesDe(cursos).map((n) => nombreNivel(n)), f = (columna, texto) => ({ Columna: columna, "Qué escribir": texto });
  return [
    f("CÓMO USAR ESTE ARCHIVO", 'Llena la hoja "Acertijos" (una fila por acertijo) y súbela con el botón "Importar desde Excel". Antes de guardar vas a ver una revisión de qué se crea y qué tiene errores.'),
    f("", 'Las filas cuyo título empieza con "EJEMPLO" se ignoran. Solo se CREAN acertijos nuevos: si ya existe uno igual (mismo tipo, título y curso) se omite, así que puedes volver a subir el mismo archivo sin duplicar.'),
    f("", ""),
    f("para_quien", `Quién lo ve: Todos${niveles.length ? ", " + niveles.join(", ") + " (todos los cursos de ese grado)" : ""}${cursos.length ? ", o un curso en particular (" + cursos.slice(0, 8).join(", ") + (cursos.length > 8 ? "…" : "") + ")" : ""}. Vacío = Todos.`),
    f("tipo", `Uno de: ${CLAVES_TIPO.map((c) => TIPOS_ACERTIJO[c].nombre).join(" · ")}.`),
    f("titulo", "El nombre del acertijo (hasta 80 letras). Obligatorio."),
    f("contenido", "Depende del tipo — Sopa de letras: de 3 a 12 palabras separadas por comas (3 a 14 letras cada una). Criptograma: la frase secreta (mínimo 8 letras). Ahorcado: la palabra o frase (mínimo 3 letras). Rompecabezas: el enlace (https://…) de una imagen, o vacío para fichas con números."),
    f("pista", "Una ayuda para el estudiante (opcional, hasta 200 letras)."),
    f("tamano", "Solo para Sopa de letras (8 a 16, por defecto 10) y Rompecabezas (3 o 4, por defecto 3)."),
    f("xp / oro", "El premio: números enteros de 0 a 500. Vacíos: 20 XP y 5 de oro."),
    f("visible", "SI o NO. Un acertijo en NO no lo ve ningún estudiante. Vacío = SI."),
  ];
}

// =====================================================================================
//  SECRETOS
// =====================================================================================
export const CABECERAS_SECRETOS = ["para_quien", "escena", "objeto", "nombre", "rumor", "pregunta", "respuesta_1", "respuesta_2", "respuesta_3", "respuesta_4", "respuesta_5", "correcta", "mensaje_al_acertar", "xp", "oro", "visible"];
export const ANCHOS_SECRETOS = [14, 24, 12, 28, 36, 60, 28, 28, 28, 28, 28, 9, 36, 6, 6, 9];
const ALIAS_SECRETOS = {
  para_quien: PARA, escena: ["escena", "donde", "lugar", "sitio", "donde_se_esconde", "zona"], objeto: ["objeto", "emoji", "icono", "aspecto", "como_se_ve"],
  nombre: ["nombre", "titulo", "nombre_del_objeto"], rumor: ["rumor", "pista", "pista_rumor"], pregunta: ["pregunta", "texto", "enunciado"],
  respuesta_1: ["respuesta_1", "respuesta1", "opcion_1", "opcion1", "r1"], respuesta_2: ["respuesta_2", "respuesta2", "opcion_2", "opcion2", "r2"], respuesta_3: ["respuesta_3", "respuesta3", "opcion_3", "opcion3", "r3"],
  respuesta_4: ["respuesta_4", "respuesta4", "opcion_4", "opcion4", "r4"], respuesta_5: ["respuesta_5", "respuesta5", "opcion_5", "opcion5", "r5"],
  correcta: ["correcta", "respuesta_correcta", "la_correcta", "correct"], mensaje_al_acertar: ["mensaje_al_acertar", "retro", "retroalimentacion", "mensaje", "al_acertar"],
  xp: ["xp", "experiencia", "puntos"], oro: ["oro", "monedas"], visible: VISIBLE,
};
export const MENSAJE_SIN_COLUMNAS_SECRETOS = 'No encontré las columnas "nombre" y "pregunta". Revisa que la primera fila del Excel tenga los encabezados de la plantilla.';
export const objetosDeSecretos = (aoa) => tablaAObjetos(aoa, ALIAS_SECRETOS, ["nombre", "pregunta"], MENSAJE_SIN_COLUMNAS_SECRETOS);

const PALABRAS_OBJETO = { "🗝️": ["llave"], "📜": ["pergamino", "papiro", "carta", "rollo"], "💎": ["gema", "joya", "diamante", "cristal"], "🏺": ["vasija", "jarron", "jarra", "urna"], "🕯️": ["vela", "candil"], "📖": ["libro", "diario", "cuaderno"], "🪙": ["moneda", "ficha"], "🔮": ["esfera", "bola", "orbe"], "🧭": ["brujula", "compas"], "🪶": ["pluma"] };
const sinVariacion = (s) => String(s ?? "").replace(/️/g, "").trim();
function resolverObjeto(texto) {
  const t = sinVariacion(texto); if (!t) return { valor: "📜" };
  const emoji = OBJETOS_SECRETO.find((e) => sinVariacion(e) === t); if (emoji) return { valor: emoji };
  const p = sinPuntuacion(t); for (const [e, nombres] of Object.entries(PALABRAS_OBJETO)) if (nombres.includes(p)) return { valor: e };
  return { error: `El objeto "${txt(texto)}" no está disponible. Usa un emoji de la lista (${OBJETOS_SECRETO.join(" ")}) o una de estas palabras: llave, pergamino, gema, vasija, vela, libro, moneda, esfera, brújula, pluma. Vacío = 📜.` };
}
function resolverEscena(texto) {
  const t = sinPuntuacion(texto); if (!t) return { error: 'Falta la "escena" (dónde se esconde).' };
  const exactas = ESCENAS_SECRETO.filter((e) => e.key === t || sinPuntuacion(e.nombre) === t);
  const lista = exactas.length ? exactas : ESCENAS_SECRETO.filter((e) => t.length >= 3 && (sinPuntuacion(e.nombre).startsWith(t) || sinPuntuacion(e.nombre).split(" ").includes(t) || sinPuntuacion(e.nombre).includes(` ${t}`)));
  if (lista.length === 1) return { valor: lista[0].key };
  if (lista.length > 1) return { error: `La escena "${txt(texto)}" puede ser varias (${lista.map((e) => e.nombre).join(", ")}). Escríbela completa.` };
  return { error: `La escena "${txt(texto)}" no existe. Usa: ${ESCENAS_SECRETO.map((e) => e.nombre).join(", ")}.` };
}

export function analizarSecretos(objetos, ctx = {}) {
  const { existentes = [], cursos = [] } = ctx;
  const clave = (escena, nombre, grado) => [escena, sinTildes(nombre), String(grado || "")].join("|");
  const ya = new Set(existentes.map((s) => clave(s.escena, s.nombre, s.grado_id))), vistas = new Map(), filas = [];
  let ejemplos = 0;
  for (const o of objetos) {
    if (/^ejemplo\b/i.test(txt(o.nombre))) { ejemplos++; continue; }
    const f = { fila: o.__fila, estado: "error", titulo: txt(o.nombre), errores: [], avisos: [], campos: null };
    const err = (m) => f.errores.push(m);
    const para = interpretarPara(o.para_quien, cursos); if (para.error) err(para.error);
    const esc = resolverEscena(o.escena); if (esc.error) err(esc.error);
    const obj = resolverObjeto(o.objeto); if (obj.error) err(obj.error);
    const nombre = txt(o.nombre); if (!nombre) err('Falta el "nombre" del objeto.'); else if (nombre.length > 60) err(`El nombre pasa de 60 letras (tiene ${nombre.length}).`);
    const pregunta = txt(o.pregunta); if (!pregunta) err('Falta la "pregunta".'); else if (pregunta.length > 400) err(`La pregunta pasa de 400 letras (tiene ${pregunta.length}).`);
    const rumor = txt(o.rumor), retro = txt(o.mensaje_al_acertar); if (rumor.length > 160) err("El rumor pasa de 160 letras."); if (retro.length > 300) err("El mensaje al acertar pasa de 300 letras.");
    const rs = [1, 2, 3, 4, 5].map((i) => txt(o[`respuesta_${i}`])); let ultima = -1; rs.forEach((r, i) => { if (r) ultima = i; });
    const opciones = rs.slice(0, ultima + 1);
    if (opciones.length < 2) err("Hacen falta al menos 2 respuestas (respuesta_1 y respuesta_2).");
    else opciones.forEach((r, i) => { if (!r) err(`La respuesta_${i + 1} está vacía pero hay respuestas después. Llena los huecos o muévelas.`); else if (r.length > 120) err(`La respuesta_${i + 1} pasa de 120 letras.`); });
    if (new Set(opciones.filter(Boolean).map((r) => r.toLowerCase())).size !== opciones.filter(Boolean).length) err("Hay respuestas repetidas.");
    let correcta = null; const ct = txt(o.correcta);
    if (ct === "") err('Falta "correcta" (el número de la respuesta correcta, por ejemplo 2).');
    else { const letra = sinTildes(ct); const n = /^[a-e]$/.test(letra) ? letra.charCodeAt(0) - 96 : aEntero(ct); if (!Number.isInteger(n) || n < 1 || n > Math.max(opciones.length, 1)) err(`"correcta" tiene que ser un número entre 1 y ${Math.max(opciones.length, 2)} (hay ${opciones.length} respuestas); escribiste "${ct}".`); else correcta = n - 1; }
    const xp = numero(o, "xp", 30, 500, err), oro = numero(o, "oro", 10, 500, err), activo = leerVisible(o.visible, err);
    if (f.errores.length) { filas.push(f); continue; }
    const campos = { nombre, emoji: obj.valor, escena: esc.valor, pista: rumor, texto: pregunta, opciones, correcta, retro, grado_id: para.valor || "", xp, oro, activo };
    const e = validarSecreto(campos); if (e) { f.errores.push(e); filas.push(f); continue; }
    const k = clave(esc.valor, nombre, para.valor);
    if (vistas.has(k)) { f.errores.push(`Está repetido: es igual a la fila ${vistas.get(k)} de este archivo.`); filas.push(f); continue; }
    vistas.set(k, f.fila);
    f.campos = campos;
    if (ya.has(k)) { f.estado = "igual"; f.avisos.push("Ya existe un secreto igual (misma escena, nombre y curso): se omite."); } else f.estado = "nueva";
    filas.push(f);
  }
  return { filas, ejemplosIgnorados: ejemplos, resumen: resumenDe(filas, ejemplos) };
}

export function filasPlantillaSecretos() {
  const fila = (p) => Object.fromEntries(CABECERAS_SECRETOS.map((c) => [c, p[c] === undefined ? "" : p[c]]));
  return [
    fila({ para_quien: "Todos", escena: "Biblioteca", objeto: "pergamino", nombre: "EJEMPLO: Pergamino antiguo", rumor: "Dicen que entre los libros hay algo que brilla", pregunta: "¿Qué significa ser solidario?", respuesta_1: "Ayudar a otros sin esperar nada", respuesta_2: "Pensar solo en uno mismo", respuesta_3: "Ignorar a los demás", correcta: 1, mensaje_al_acertar: "¡Exacto! La solidaridad nos une.", xp: 30, oro: 10, visible: "SI" }),
    fila({ para_quien: "Octavo", escena: "Bosque de la Curiosidad", objeto: "💎", nombre: "EJEMPLO: Gema del bosque", pregunta: "Una pregunta solo para octavo.", respuesta_1: "Sí", respuesta_2: "No", correcta: "A" }),
  ];
}
export function filasInstruccionesSecretos(cursos = []) {
  const niveles = nivelesDe(cursos).map((n) => nombreNivel(n)), f = (columna, texto) => ({ Columna: columna, "Qué escribir": texto });
  return [
    f("CÓMO USAR ESTE ARCHIVO", 'Llena la hoja "Secretos" (una fila por objeto escondido) y súbela con el botón "Importar desde Excel". Antes de guardar vas a ver una revisión de qué se crea y qué tiene errores.'),
    f("", 'Las filas cuyo nombre empieza con "EJEMPLO" se ignoran. Solo se CREAN secretos nuevos: si ya existe uno igual (misma escena, nombre y curso) se omite, así que puedes volver a subir el mismo archivo sin duplicar.'),
    f("", ""),
    f("para_quien", `Quién lo ve: Todos${niveles.length ? ", " + niveles.join(", ") : ""}${cursos.length ? ", o un curso (" + cursos.slice(0, 8).join(", ") + (cursos.length > 8 ? "…" : "") + ")" : ""}. Vacío = Todos.`),
    f("escena", `Dónde se esconde: ${ESCENAS_SECRETO.map((e) => e.nombre).join(" · ")}.`),
    f("objeto", `Cómo se ve: un emoji (${OBJETOS_SECRETO.join(" ")}) o una palabra (llave, pergamino, gema, vasija, vela, libro, moneda, esfera, brújula, pluma). Vacío = 📜.`),
    f("nombre", "El nombre del objeto (hasta 60 letras). Obligatorio."),
    f("rumor", "Lo que cuentan los vecinos mientras no lo encuentren (opcional, hasta 160 letras)."),
    f("pregunta", "La pregunta que aparece al examinarlo (hasta 400 letras). Obligatoria."),
    f("respuesta_1 … respuesta_5", "Entre 2 y 5 respuestas, sin dejar huecos ni repetir."),
    f("correcta", "El NÚMERO de la respuesta correcta (1 a 5). También se acepta la letra A a E."),
    f("mensaje_al_acertar", "El mensaje cuando acierta (opcional)."),
    f("xp / oro", "El premio: números enteros de 0 a 500. Vacíos: 30 XP y 10 de oro."),
    f("visible", "SI o NO. Vacío = SI."),
  ];
}

// =====================================================================================
//  Comunes: resumen, libro de Excel
// =====================================================================================
function resumenDe(filas, ejemplos) {
  const c = (e) => filas.filter((f) => f.estado === e).length;
  return { nuevas: c("nueva"), actualizadas: 0, iguales: c("igual"), errores: c("error"), ocultas: 0, ejemplos };
}
// plantilla = { hoja, cabeceras, anchos, filas, instrucciones }
export function crearLibroContenido(XLSX, { hoja, cabeceras, anchos, filas, instrucciones }) {
  const wb = XLSX.utils.book_new();
  const h = XLSX.utils.json_to_sheet(filas.length ? filas : [Object.fromEntries(cabeceras.map((c) => [c, ""]))], { header: cabeceras });
  h["!cols"] = anchos.map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, h, hoja);
  const ins = XLSX.utils.json_to_sheet(instrucciones, { header: ["Columna", "Qué escribir"] }); ins["!cols"] = [{ wch: 26 }, { wch: 110 }];
  XLSX.utils.book_append_sheet(wb, ins, "Instrucciones");
  return wb;
}
export const LIBRO_ACERTIJOS = (cursos) => ({ hoja: "Acertijos", cabeceras: CABECERAS_ACERTIJOS, anchos: ANCHOS_ACERTIJOS, filas: filasPlantillaAcertijos(), instrucciones: filasInstruccionesAcertijos(cursos) });
export const LIBRO_SECRETOS = (cursos) => ({ hoja: "Secretos", cabeceras: CABECERAS_SECRETOS, anchos: ANCHOS_SECRETOS, filas: filasPlantillaSecretos(), instrucciones: filasInstruccionesSecretos(cursos) });
// Lee la hoja con ese nombre (o la primera que no sea "Instrucciones")
export function leerHoja(XLSX, datos, nombreHoja) {
  const wb = XLSX.read(datos, { type: "binary" });
  const n = wb.SheetNames.find((x) => sinTildes(x) === sinTildes(nombreHoja)) || wb.SheetNames.find((x) => sinTildes(x) !== "instrucciones") || wb.SheetNames[0];
  if (!n) return [];
  return XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: "" });
}
