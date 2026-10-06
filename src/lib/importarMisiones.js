// =====================================================================================
//  IMPORTAR Y EXPORTAR LAS MISIONES DEL MUNDO EN EXCEL
//  Todo lo importante (leer las filas, validar, decidir qué se crea o se actualiza) es lógica pura, sin Excel de por medio,
//  para poder probarla sola. La librería de Excel (xlsx) se le pasa de afuera.
// =====================================================================================
import { ZONAS, LUGARES } from "../game/zonas";
import { MAX_POR_LUGAR, sinTildes, interpretarPara, textoParaExcel, cursoSaturado, etiquetaSaturado, etiquetaPara, nivelesDe, nombreNivel } from "./gradosMundo";

export const CABECERAS = ["id", "para_quien", "zona", "lugar", "personaje", "titulo", "pregunta", "respuesta_1", "respuesta_2", "respuesta_3", "respuesta_4", "respuesta_5", "correcta", "pista", "mensaje_al_acertar", "xp", "oro", "orden", "visible"];
const ANCHOS = [6, 14, 24, 24, 20, 28, 60, 28, 28, 28, 28, 28, 9, 30, 36, 6, 6, 7, 9];
const MAX_TITULO = 60, MAX_PREGUNTA = 500, MAX_RESPUESTA = 120, MAX_PISTA = 200, MAX_PERSONAJE = 40;

// ---- encabezados: se aceptan mayúsculas, tildes y nombres parecidos ----
const ALIAS = {
  id: ["id"], para_quien: ["para_quien", "paraquien", "para", "curso", "grado", "nivel", "grupo", "cursos"], zona: ["zona", "mapa"], lugar: ["lugar", "sitio", "edificio"],
  personaje: ["personaje", "npc", "npc_nombre", "quien_la_da", "nombre_del_personaje"], titulo: ["titulo", "title", "nombre_de_la_mision", "mision"], pregunta: ["pregunta", "texto", "enunciado", "planteamiento"],
  respuesta_1: ["respuesta_1", "respuesta1", "opcion_1", "opcion1", "r1"], respuesta_2: ["respuesta_2", "respuesta2", "opcion_2", "opcion2", "r2"], respuesta_3: ["respuesta_3", "respuesta3", "opcion_3", "opcion3", "r3"],
  respuesta_4: ["respuesta_4", "respuesta4", "opcion_4", "opcion4", "r4"], respuesta_5: ["respuesta_5", "respuesta5", "opcion_5", "opcion5", "r5"],
  correcta: ["correcta", "respuesta_correcta", "la_correcta", "correct"], pista: ["pista", "ayuda"], mensaje_al_acertar: ["mensaje_al_acertar", "retro", "retroalimentacion", "mensaje", "felicitacion", "al_acertar"],
  xp: ["xp", "experiencia", "puntos"], oro: ["oro", "monedas"], orden: ["orden", "posicion"], visible: ["visible", "visibles", "activa", "activo", "mostrar"],
};
export const claveCabecera = (t) => sinTildes(t).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const PORALIAS = {}; for (const [k, lista] of Object.entries(ALIAS)) lista.forEach((a) => (PORALIAS[a] = k));
const txt = (v) => (v == null ? "" : String(v).trim());
const nombreLugar = (key) => (LUGARES.find((l) => l.key === key) || { nombre: key }).nombre;
const nombreZona = (key) => (ZONAS.find((z) => z.key === key) || { nombre: key }).nombre;

// De una tabla (lista de filas de celdas) a objetos con cabeceras conocidas. Busca la fila de cabeceras (no tiene que ser la primera).
export function aObjetos(aoa) {
  let cab = -1;
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    const claves = (aoa[i] || []).map((c) => PORALIAS[claveCabecera(c)]).filter(Boolean);
    if (claves.includes("titulo") && claves.includes("pregunta")) { cab = i; break; }
  }
  if (cab < 0) return { error: 'No encontré las columnas "titulo" y "pregunta". Revisa que la primera fila del Excel tenga los encabezados de la plantilla.' };
  const cols = (aoa[cab] || []).map((c) => PORALIAS[claveCabecera(c)] || null);
  const objetos = [];
  for (let i = cab + 1; i < aoa.length; i++) {
    const celdas = aoa[i] || [], o = { __fila: i + 1 };
    cols.forEach((k, j) => { if (k && o[k] === undefined) o[k] = celdas[j]; });
    if (celdas.every((c) => txt(c) === "")) continue;           // fila vacía
    objetos.push(o);
  }
  return { objetos, cabeceras: cols.filter(Boolean) };
}

const sinPuntuacion = (t) => sinTildes(t).replace(/[^a-z0-9 ]/g, "").trim();
function resolverZona(texto) {
  const t = sinPuntuacion(texto); if (!t) return { valor: null };
  const z = ZONAS.find((x) => x.key === t || sinPuntuacion(x.nombre) === t || sinPuntuacion(x.nombre).startsWith(t + " ") || sinPuntuacion(x.nombre.split(" ")[0]) === t);
  return z ? { valor: z.key } : { error: `La zona "${txt(texto)}" no existe. Usa: ${ZONAS.map((x) => x.nombre).join(", ")}.` };
}
function resolverLugar(texto, zona) {
  const t = sinPuntuacion(texto); if (!t) return { error: 'Falta el "lugar".' };
  const pool = LUGARES.filter((l) => !zona || l.zona === zona);
  const exactos = pool.filter((l) => l.key === t || sinPuntuacion(l.nombre) === t);
  const lista = exactos.length ? exactos : pool.filter((l) => t.length >= 3 && (sinPuntuacion(l.nombre).startsWith(t) || sinPuntuacion(l.nombre).includes(` ${t}`)));
  if (lista.length === 1) return { valor: lista[0].key, zona: lista[0].zona };
  if (lista.length > 1) return { error: `El lugar "${txt(texto)}" puede ser varios (${lista.map((l) => l.nombre).join(", ")}). Escríbelo completo.` };
  return { error: `El lugar "${txt(texto)}" no existe${zona ? ` en ${nombreZona(zona)}` : ""}. Usa: ${pool.map((l) => l.nombre).join(", ")}.` };
}
const aEntero = (v) => { const t = txt(v).replace(",", "."); if (t === "") return null; const n = Number(t); return Number.isInteger(n) ? n : NaN; };

// ---- la validación de cada fila + decidir qué es: nueva, actualiza, igual o error ----
//   ctx: { misiones: las que ya existen, cursos: ids de cursos, columnaCurso, columnaZona }
export function analizarImportacion(objetos, ctx) {
  const { misiones = [], cursos = [], columnaCurso = true, columnaZona = true } = ctx;
  const porId = new Map(misiones.map((m) => [String(m.id), m]));
  const clave = (zona, lugar, titulo, grado) => [zona, lugar, sinTildes(titulo), String(grado || "")].join("|");
  const porClave = new Map(misiones.map((m) => [clave(m.zona || "aldea", m.lugar, m.titulo, m.grado_id), m]));
  const vistas = new Map();  // dentro del archivo
  const filas = [];
  let ejemplos = 0;
  for (const o of objetos) {
    const f = { fila: o.__fila, estado: "error", id: null, campos: null, titulo: txt(o.titulo), errores: [], avisos: [], oculta: false };
    if (/^ejemplo\b/i.test(txt(o.titulo))) { ejemplos++; continue; }          // las filas de ejemplo de la plantilla se ignoran
    const err = (m) => f.errores.push(m);
    // id (si trae, es una actualización)
    let existente = null;
    if (txt(o.id) !== "") {
      const n = aEntero(o.id);
      if (!Number.isInteger(n) || !porId.has(String(n))) err(`El id "${txt(o.id)}" no corresponde a ninguna misión (déjalo vacío si es nueva).`); else existente = porId.get(String(n));
    }
    // para quién
    const para = interpretarPara(o.para_quien, cursos); let grado = null;
    if (para.error) err(para.error); else { grado = para.valor; if (grado && !columnaCurso) err('Para separar por curso o grado falta correr el SQL 63 en Supabase. Mientras tanto usa "Todos".'); }
    // zona y lugar
    const z = resolverZona(o.zona); let zona = z.valor, lugar = null;
    if (z.error) err(z.error);
    const l = resolverLugar(o.lugar, z.error ? null : zona);
    if (l.error) err(l.error); else { lugar = l.valor; if (!zona) zona = l.zona; }
    if (zona && zona !== "aldea" && !columnaZona) err("Para usar zonas distintas a la Aldea falta correr el SQL 64 en Supabase.");
    // título, pregunta
    const titulo = txt(o.titulo), pregunta = txt(o.pregunta);
    if (!titulo) err('Falta el "titulo".'); else if (titulo.length > MAX_TITULO) err(`El título pasa de ${MAX_TITULO} letras (tiene ${titulo.length}).`);
    if (!pregunta) err('Falta la "pregunta".'); else if (pregunta.length > MAX_PREGUNTA) err(`La pregunta pasa de ${MAX_PREGUNTA} letras (tiene ${pregunta.length}).`);
    // ¿ya existía? Sin id, se reconoce por zona + lugar + título + grado (así no se duplica y se heredan sus valores si hay celdas vacías)
    let porClaveEncontrada = false;
    if (!existente && zona && lugar && titulo && !para.error) { const igual = porClave.get(clave(zona, lugar, titulo, grado)); if (igual) { existente = igual; porClaveEncontrada = true; } }
    // respuestas
    const rs = [1, 2, 3, 4, 5].map((i) => txt(o[`respuesta_${i}`])); let ultima = -1; rs.forEach((r, i) => { if (r) ultima = i; });
    const opciones = rs.slice(0, ultima + 1);
    if (opciones.length < 2) err("Hacen falta al menos 2 respuestas (respuesta_1 y respuesta_2).");
    else { opciones.forEach((r, i) => { if (!r) err(`La respuesta_${i + 1} está vacía pero hay respuestas después. Llena los huecos o muévelas.`); else if (r.length > MAX_RESPUESTA) err(`La respuesta_${i + 1} pasa de ${MAX_RESPUESTA} letras.`); }); }
    // correcta (número 1-5 o letra A-E)
    let correcta = null; const ct = txt(o.correcta);
    if (ct === "") err('Falta "correcta" (el número de la respuesta correcta, por ejemplo 2).');
    else { const letra = sinTildes(ct); const n = /^[a-e]$/.test(letra) ? letra.charCodeAt(0) - 96 : aEntero(ct); if (!Number.isInteger(n) || n < 1 || n > Math.max(opciones.length, 1)) err(`"correcta" tiene que ser un número entre 1 y ${Math.max(opciones.length, 2)} (hay ${opciones.length} respuestas); escribiste "${ct}".`); else if (!opciones[n - 1]) err(`La respuesta correcta (${n}) está vacía.`); else correcta = n - 1; }
    // opcionales
    const pista = txt(o.pista), retro = txt(o.mensaje_al_acertar), personaje = txt(o.personaje);
    if (pista.length > MAX_PISTA) err(`La pista pasa de ${MAX_PISTA} letras.`); if (retro.length > MAX_PISTA) err(`El mensaje al acertar pasa de ${MAX_PISTA} letras.`); if (personaje.length > MAX_PERSONAJE) err(`El nombre del personaje pasa de ${MAX_PERSONAJE} letras.`);
    const num = (campo, nombre, porDefecto, max) => { const n = aEntero(o[campo]); if (n === null) return existente ? existente[campo] ?? porDefecto : porDefecto; if (!Number.isInteger(n) || n < 0 || n > max) { err(`${nombre} tiene que ser un número entero entre 0 y ${max}; escribiste "${txt(o[campo])}".`); return porDefecto; } return n; };
    const xp = num("xp", "xp", 10, 1000), oro = num("oro", "oro", 5, 1000), orden = num("orden", "orden", 0, 1000);
    // visible
    let activo = existente ? existente.activo !== false : true; const vt = sinTildes(o.visible);
    if (vt !== "") { if (["si", "s", "1", "true", "verdadero", "x", "yes", "visible"].includes(vt)) activo = true; else if (["no", "n", "0", "false", "falso", "oculta", "oculto"].includes(vt)) activo = false; else err('"visible" tiene que ser SI o NO.'); }
    if (f.errores.length) { f.estado = "error"; filas.push(f); continue; }
    if (porClaveEncontrada) f.avisos.push("Ya existía una misión igual: se actualiza en vez de duplicarla.");
    const k = clave(zona, lugar, titulo, grado);
    if (vistas.has(k)) { f.errores.push(`Está repetida: es igual a la fila ${vistas.get(k)} de este archivo.`); filas.push(f); continue; }
    vistas.set(k, f.fila);
    f.campos = { lugar, npc_nombre: personaje || (existente ? existente.npc_nombre : "") || "Aldeano", titulo, texto: pregunta, opciones, correcta, pista, retro, xp, oro, orden, activo };
    if (columnaCurso) f.campos.grado_id = grado; if (columnaZona) f.campos.zona = zona;
    f.id = existente ? existente.id : null; f.zona = zona; f.estado = existente ? "actualiza" : "nueva"; f._existente = existente;
    filas.push(f);
  }
  // el máximo de 5 visibles por lugar: se simula en el orden del archivo. Las que no caben se importan OCULTAS (no se pierde nada).
  const sim = misiones.map((m) => ({ id: m.id, lugar: m.lugar, grado_id: m.grado_id || null, activo: m.activo !== false }));
  let temp = 0;
  for (const f of filas) {
    if (f.estado !== "nueva" && f.estado !== "actualiza") { continue; }
    const grado = columnaCurso ? f.campos.grado_id : null;
    if (f.campos.activo) { const c = cursoSaturado(sim, f.campos.lugar, grado, f.id, cursos); if (c) { f.campos.activo = false; f.oculta = true; f.avisos.push(`Se importa OCULTA: ${nombreLugar(f.campos.lugar)} ya tiene ${MAX_POR_LUGAR} misiones visibles para ${etiquetaSaturado(c)}${String(grado || "") !== c ? ` (esta misión es para ${etiquetaPara(grado).toLowerCase()})` : ""}.`); } }
    const reg = { id: f.id ?? `n${++temp}`, lugar: f.campos.lugar, grado_id: grado, activo: f.campos.activo };
    const i = sim.findIndex((s) => String(s.id) === String(reg.id)); if (i >= 0) sim[i] = reg; else sim.push(reg);
  }
  // ¿no cambió nada? Se compara con el resultado FINAL (ya con el máximo aplicado), así volver a importar lo mismo no hace nada.
  for (const f of filas) {
    if (f.estado !== "actualiza") continue; const e = f._existente, c = f.campos;
    const igual = e.lugar === c.lugar && (e.npc_nombre || "") === c.npc_nombre && e.titulo === c.titulo && e.texto === c.texto && JSON.stringify(e.opciones) === JSON.stringify(c.opciones) && e.correcta === c.correcta && (e.pista || "") === c.pista && (e.retro || "") === c.retro && e.xp === c.xp && e.oro === c.oro && (e.orden || 0) === c.orden && (e.activo !== false) === c.activo && (!columnaCurso || (e.grado_id || null) === (c.grado_id || null)) && (!columnaZona || (e.zona || "aldea") === c.zona);
    if (igual) f.estado = "igual";
  }
  const cuenta = (e) => filas.filter((f) => f.estado === e).length;
  return { filas, ejemplosIgnorados: ejemplos, resumen: { nuevas: cuenta("nueva"), actualizadas: cuenta("actualiza"), iguales: cuenta("igual"), errores: cuenta("error"), ocultas: filas.filter((f) => f.oculta).length, ejemplos } };
}

// ---- exportar ----
export function filasParaExportar(misiones) {
  const ordenZona = (z) => ZONAS.findIndex((x) => x.key === z), ordenLugar = (l) => LUGARES.findIndex((x) => x.key === l);
  return [...misiones].sort((a, b) => ordenZona(a.zona || "aldea") - ordenZona(b.zona || "aldea") || ordenLugar(a.lugar) - ordenLugar(b.lugar) || (a.orden || 0) - (b.orden || 0) || a.id - b.id).map((m) => {
    const o = { id: m.id, para_quien: textoParaExcel(m.grado_id), zona: nombreZona(m.zona || "aldea"), lugar: nombreLugar(m.lugar), personaje: m.npc_nombre || "", titulo: m.titulo, pregunta: m.texto };
    [1, 2, 3, 4, 5].forEach((i) => { o[`respuesta_${i}`] = (m.opciones || [])[i - 1] || ""; });
    return Object.assign(o, { correcta: (m.correcta || 0) + 1, pista: m.pista || "", mensaje_al_acertar: m.retro || "", xp: m.xp ?? 0, oro: m.oro ?? 0, orden: m.orden ?? 0, visible: m.activo === false ? "NO" : "SI" });
  });
}
export function filasPlantilla() {
  const fila = (p) => Object.fromEntries(CABECERAS.map((c) => [c, p[c] === undefined ? "" : p[c]]));   // en el orden exacto de los encabezados
  return [
    fila({ para_quien: "Todos", zona: "Aldea del Códice", lugar: "Biblioteca", personaje: "La bibliotecaria", titulo: "EJEMPLO: La regla de oro", pregunta: "¿Cuál de estas acciones practica la regla de oro?", respuesta_1: "Burlarme de quien se equivoca", respuesta_2: "Ayudar a quien no entendió", respuesta_3: "Copiarme de otro", correcta: 2, pista: "Piensa en cómo te gustaría que te trataran.", mensaje_al_acertar: "¡Exacto! Ayudar es poner en práctica la regla de oro.", xp: 20, oro: 5, orden: 1, visible: "SI" }),
    fila({ para_quien: "Octavo", zona: "Bosque de la Curiosidad", lugar: "Cascada Escondida", personaje: "El eco del agua", titulo: "EJEMPLO: Una prueba solo para octavo", pregunta: "Aquí va la pregunta para todos los cursos de octavo.", respuesta_1: "Respuesta A", respuesta_2: "Respuesta B", respuesta_3: "Respuesta C", respuesta_4: "Respuesta D", correcta: 3, xp: 30, oro: 10, visible: "SI" }),
    fila({ para_quien: "802", zona: "Lago de la Reflexión", lugar: "Muelle", titulo: "EJEMPLO: Una prueba solo para el curso 802", pregunta: "Esta pregunta solo la ve el curso 802.", respuesta_1: "Sí", respuesta_2: "No", correcta: 1 }),
  ];
}
export function filasInstrucciones(cursos = []) {
  const niveles = nivelesDe(cursos).map((n) => nombreNivel(n));
  const f = (columna, texto) => ({ Columna: columna, "Qué escribir": texto });
  return [
    f("CÓMO USAR ESTE ARCHIVO", "Llena la hoja \"Misiones\" (una fila por misión) y súbela con el botón \"Importar desde Excel\". Antes de guardar nada vas a ver una revisión de qué se crea, qué se actualiza y qué tiene errores."),
    f("", 'Las filas cuyo título empieza con "EJEMPLO" se ignoran: puedes dejarlas o borrarlas.'),
    f("", "Si exportas tus misiones, puedes editarlas aquí y volver a importarlas: las que tienen id se actualizan (no se duplican)."),
    f("", ""),
    f("id", "Déjalo VACÍO para una misión nueva. Si la exportaste de CÓDICE, no lo cambies: sirve para actualizarla."),
    f("para_quien", `Quién la ve: Todos${niveles.length ? ", " + niveles.join(", ") + " (todos los cursos de ese grado)" : ""}${cursos.length ? ", o un curso en particular (" + cursos.slice(0, 8).join(", ") + (cursos.length > 8 ? "…" : "") + ")" : ""}. Vacío = Todos.`),
    f("zona", `Una de: ${ZONAS.map((z) => z.nombre).join(" · ")}. Si lo dejas vacío se deduce del lugar.`),
    f("lugar", "El lugar dentro de la zona (mira la lista de abajo). Máximo 5 misiones visibles por lugar para cada curso; las que no quepan se importan OCULTAS."),
    f("personaje", "El nombre del personaje que da la misión (opcional; si lo dejas vacío será \"Aldeano\")."),
    f("titulo", `El título de la misión (hasta ${MAX_TITULO} letras). Obligatorio.`),
    f("pregunta", `Lo que pregunta o plantea la misión (hasta ${MAX_PREGUNTA} letras). Obligatorio.`),
    f("respuesta_1 … respuesta_5", "Entre 2 y 5 respuestas. Llénalas en orden, sin dejar huecos."),
    f("correcta", "El NÚMERO de la respuesta correcta (1 a 5). También se acepta la letra A a E."),
    f("pista", "Lo que ve el estudiante si se equivoca (opcional)."),
    f("mensaje_al_acertar", "El mensaje cuando acierta (opcional)."),
    f("xp / oro", "El premio: números enteros de 0 a 1000. Si los dejas vacíos en una misión nueva: 10 XP y 5 de oro."),
    f("orden", "Para ordenar las misiones (número entero; opcional)."),
    f("visible", "SI o NO. Una misión en NO no la ve ningún estudiante. Vacío = SI."),
    f("", ""),
    f("LUGARES VÁLIDOS", ""),
    ...ZONAS.map((z) => f(z.nombre, z.lugares.map((l) => l.nombre).join(" · "))),
  ];
}

// ---- el libro de Excel (la librería se le pasa: así no se carga hasta que se necesita) ----
export function crearLibro(XLSX, { filas, cursos = [] }) {
  const wb = XLSX.utils.book_new();
  const hoja = filas.length ? XLSX.utils.json_to_sheet(filas, { header: CABECERAS }) : XLSX.utils.json_to_sheet([Object.fromEntries(CABECERAS.map((c) => [c, ""]))], { header: CABECERAS });
  hoja["!cols"] = ANCHOS.map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, hoja, "Misiones");
  const ins = XLSX.utils.json_to_sheet(filasInstrucciones(cursos), { header: ["Columna", "Qué escribir"] }); ins["!cols"] = [{ wch: 26 }, { wch: 110 }];
  XLSX.utils.book_append_sheet(wb, ins, "Instrucciones");
  return wb;
}
// Lee la hoja "Misiones" (o la primera) como filas de celdas.
export function leerLibro(XLSX, datos) {
  const wb = XLSX.read(datos, { type: "binary" });
  const nombre = wb.SheetNames.find((n) => sinTildes(n) === "misiones") || wb.SheetNames[0];
  if (!nombre) return [];
  return XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, defval: "" });
}
