// =====================================================================================
//  LECCIONES CON BLOQUES · lógica pura (sin pantalla ni base de datos)
//  Una lección = título + lista de bloques (texto, recuadro, imagen, video, tarjetas, toca-para-descubrir,
//  paso a paso, pregunta rápida, reflexión, botón de enlace, sopa de letras, crucigrama, criptograma).
//  Incluye: validación, el generador de crucigramas, el lector de la respuesta de una IA y las instrucciones que se le dan.
// =====================================================================================
import { soloLetras, parsearPalabras } from "../game/acertijos";

// ---------- enlaces ----------
// Solo http/https: evita "javascript:" escrito por error o a propósito
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

// ---------- catálogo de bloques ----------
export const TIPOS_BLOQUE = {
  texto: { nombre: "Texto", desc: "Párrafos, títulos y listas", emoji: "📝" },
  destacado: { nombre: "Recuadro destacado", desc: "Idea clave, cita bíblica u oración", emoji: "💡" },
  imagen: { nombre: "Imagen", desc: "Foto o gráfico con descripción", emoji: "🖼️" },
  video: { nombre: "Video", desc: "YouTube u otro enlace", emoji: "🎬" },
  tarjetas: { nombre: "Tarjetas que giran", desc: "Término por delante, significado por detrás", emoji: "🃏" },
  descubre: { nombre: "Toca para descubrir", desc: "Secciones que se abren al tocarlas", emoji: "👆" },
  pasos: { nombre: "Paso a paso", desc: "Se revela un paso a la vez", emoji: "🪜" },
  pregunta: { nombre: "Pregunta rápida", desc: "Con respuesta y explicación al instante", emoji: "❓" },
  reflexion: { nombre: "Reflexión personal", desc: "El estudiante escribe y la guarda", emoji: "✍️" },
  enlace: { nombre: "Botón de enlace", desc: "Lleva a una página o documento", emoji: "🔗" },
  sopa: { nombre: "Sopa de letras", desc: "Encontrar palabras escondidas", emoji: "🔤" },
  crucigrama: { nombre: "Crucigrama", desc: "Completar con las pistas", emoji: "🧩" },
  criptograma: { nombre: "Criptograma", desc: "Descifrar una frase secreta", emoji: "🔐" },
};
export const ESTILOS_DESTACADO = { idea: { nombre: "Idea clave", emoji: "💡" }, cita: { nombre: "Cita bíblica", emoji: "📖" }, oracion: { nombre: "Oración", emoji: "🙏" } };
export const MAX_BLOQUES = 60;
const L = { titulo: 120, texto: 4000, corto: 300, pregunta: 400, opcion: 150, explicacion: 600 };

const t = (v, max) => String(v ?? "").replace(/\r/g, "").trim().slice(0, max);
export const nuevoId = () => "b" + Math.random().toString(36).slice(2, 8);
export function bloqueVacio(tipo) {
  const id = nuevoId();
  switch (tipo) {
    case "texto": return { id, tipo, titulo: "", contenido: "" };
    case "destacado": return { id, tipo, estilo: "idea", titulo: "", contenido: "", fuente: "" };
    case "imagen": return { id, tipo, url: "", descripcion: "", pie: "" };
    case "video": return { id, tipo, url: "", titulo: "" };
    case "tarjetas": return { id, tipo, titulo: "", tarjetas: [{ frente: "", reverso: "" }, { frente: "", reverso: "" }] };
    case "descubre": return { id, tipo, titulo: "", items: [{ titulo: "", contenido: "" }, { titulo: "", contenido: "" }] };
    case "pasos": return { id, tipo, titulo: "", pasos: [{ titulo: "", contenido: "" }, { titulo: "", contenido: "" }] };
    case "pregunta": return { id, tipo, pregunta: "", opciones: ["", "", "", ""], correcta: 0, explicacion: "" };
    case "reflexion": return { id, tipo, consigna: "", ayuda: "" };
    case "enlace": return { id, tipo, texto: "", url: "", descripcion: "" };
    case "sopa": return { id, tipo, titulo: "", palabras: [] };
    case "crucigrama": return { id, tipo, titulo: "", entradas: [{ palabra: "", pista: "" }, { palabra: "", pista: "" }, { palabra: "", pista: "" }, { palabra: "", pista: "" }] };
    case "criptograma": return { id, tipo, titulo: "", frase: "", pista: "" };
    default: return null;
  }
}

// Convierte la "correcta" venga como venga (número desde 0, letra A–D, o el texto de la opción) en un índice sobre la lista ORIGINAL de opciones
function indiceCorrecta(c, originales) {
  if (typeof c === "number" && Number.isInteger(c)) return c;
  const s = String(c ?? "").trim(); if (!s) return -1;
  const m = s.match(/^(?:opci[oó]n\s*)?([a-d])\s*[).:]?$/i); if (m) return "abcd".indexOf(m[1].toLowerCase());
  if (/^\d+$/.test(s)) return Number(s);
  const k = originales.findIndex((o) => String(o ?? "").trim().toLowerCase() === s.toLowerCase()); return k;
}
const lista = (v) => (Array.isArray(v) ? v : []);

// Limpia un bloque (recorta textos, corrige formatos). Devuelve null si el tipo no existe.
export function normalizarBloque(b, i = 0) {
  if (!b || typeof b !== "object") return null;
  const tipo = String(b.tipo || "").trim().toLowerCase(); if (!TIPOS_BLOQUE[tipo]) return null;
  const id = /^[\w-]{1,24}$/.test(String(b.id || "")) ? String(b.id) : `b${i + 1}${Math.random().toString(36).slice(2, 5)}`;
  const base = { id, tipo };
  switch (tipo) {
    case "texto": return { ...base, titulo: t(b.titulo, L.titulo), contenido: t(b.contenido, L.texto) };
    case "destacado": return { ...base, estilo: ESTILOS_DESTACADO[b.estilo] ? b.estilo : "idea", titulo: t(b.titulo, L.titulo), contenido: t(b.contenido, L.corto * 3), fuente: t(b.fuente, L.titulo) };
    case "imagen": return { ...base, url: urlSegura(b.url), descripcion: t(b.descripcion, L.corto), pie: t(b.pie, L.corto) };
    case "video": return { ...base, url: urlSegura(b.url), titulo: t(b.titulo, L.titulo) };
    case "tarjetas": return { ...base, titulo: t(b.titulo, L.titulo), tarjetas: lista(b.tarjetas).map((x) => ({ frente: t(x?.frente, 120), reverso: t(x?.reverso, L.corto) })).filter((x) => x.frente || x.reverso).slice(0, 12) };
    case "descubre": return { ...base, titulo: t(b.titulo, L.titulo), items: lista(b.items).map((x) => ({ titulo: t(x?.titulo, L.titulo), contenido: t(x?.contenido, 1500) })).filter((x) => x.titulo || x.contenido).slice(0, 10) };
    case "pasos": return { ...base, titulo: t(b.titulo, L.titulo), pasos: lista(b.pasos).map((x) => ({ titulo: t(x?.titulo, L.titulo), contenido: t(x?.contenido, 1000) })).filter((x) => x.titulo || x.contenido).slice(0, 10) };
    case "pregunta": {
      const orig = lista(b.opciones).slice(0, 4), k = indiceCorrecta(b.correcta, orig), ops = []; let nueva = -1;
      orig.forEach((o, j) => { const x = t(o, L.opcion); if (x) { if (j === k) nueva = ops.length; ops.push(x); } });
      return { ...base, pregunta: t(b.pregunta, L.pregunta), opciones: ops, correcta: nueva, explicacion: t(b.explicacion, L.explicacion) };
    }
    case "reflexion": return { ...base, consigna: t(b.consigna, L.corto * 2), ayuda: t(b.ayuda, L.corto) };
    case "enlace": return { ...base, texto: t(b.texto, 80), url: urlSegura(b.url), descripcion: t(b.descripcion, L.corto) };
    case "sopa": { const crudas = Array.isArray(b.palabras) ? b.palabras.join(",") : String(b.palabras ?? ""); return { ...base, titulo: t(b.titulo, L.titulo), palabras: parsearPalabras(crudas) }; }
    case "crucigrama": {
      const vistas = new Set(), entradas = [];
      lista(b.entradas).forEach((x) => { const p = soloLetras(x?.palabra); if (p && !vistas.has(p)) { vistas.add(p); entradas.push({ palabra: p, pista: t(x?.pista, 160) }); } });
      return { ...base, titulo: t(b.titulo, L.titulo), entradas: entradas.slice(0, 12) };
    }
    case "criptograma": return { ...base, titulo: t(b.titulo, L.titulo), frase: t(b.frase, 160), pista: t(b.pista, 160) };
    default: return null;
  }
}

// ---------- crucigrama ----------
export const semilla = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rngDe = (seed) => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
export const crearRngLeccion = (seed) => rngDe(typeof seed === "number" ? seed : semilla(seed));

/**
 * entradas = [{ palabra, pista }] (3 a 14 letras). Coloca las palabras cruzándolas.
 * → { imposible } o { filas, columnas, celdas: [[letra|""]], entradas: [{ num, dir: "H"|"V", fila, col, palabra, pista }], sinColocar: [palabras] }
 */
export function crearCrucigrama(entradas, { rand = Math.random, intentos = 30 } = {}) {
  const ents = []; const vistas = new Set();
  lista(entradas).forEach((e) => { const p = soloLetras(e?.palabra); if (p.length >= 3 && p.length <= 14 && !vistas.has(p)) { vistas.add(p); ents.push({ palabra: p, pista: String(e?.pista || "") }); } });
  if (ents.length < 3) return { imposible: true, motivo: "pocas" };
  let mejor = null;
  for (let it = 0; it < intentos; it++) {
    const orden = [...ents].sort((a, b) => b.palabra.length - a.palabra.length + (it ? (rand() - 0.5) * 3 : 0));
    const g = new Map(), puestas = [], sin = [];
    const get = (r, c) => g.get(r + "," + c) || "";
    const cabe = (p, r, c, dir) => {
      const dr = dir === "V" ? 1 : 0, dc = dir === "H" ? 1 : 0; let cruces = 0;
      if (get(r - dr, c - dc) || get(r + dr * p.length, c + dc * p.length)) return -1;           // antes y después deben estar libres
      for (let i = 0; i < p.length; i++) {
        const rr = r + dr * i, cc = c + dc * i, v = get(rr, cc);
        if (v) { if (v !== p[i]) return -1; cruces++; }
        else if (get(rr + dc, cc + dr) || get(rr - dc, cc - dr)) return -1;                       // no pegarse a otra palabra en paralelo
      }
      return cruces;
    };
    orden.forEach((e, idx) => {
      const p = e.palabra;
      if (!idx) { for (let i = 0; i < p.length; i++) g.set(`0,${i}`, p[i]); puestas.push({ ...e, fila: 0, col: 0, dir: "H" }); return; }
      let mejorPos = null;
      for (const q of puestas) for (let i = 0; i < p.length; i++) for (let j = 0; j < q.palabra.length; j++) {
        if (p[i] !== q.palabra[j]) continue;
        const dir = q.dir === "H" ? "V" : "H";                                                   // cruza en perpendicular
        const rr = q.dir === "H" ? q.fila - i : q.fila + j, cc = q.dir === "H" ? q.col + j : q.col - i;
        const k = cabe(p, rr, cc, dir); if (k < 1) continue;
        const score = k * 10 + rand();
        if (!mejorPos || score > mejorPos.score) mejorPos = { fila: rr, col: cc, dir, score };
      }
      if (!mejorPos) { sin.push(p); return; }
      const dr = mejorPos.dir === "V" ? 1 : 0, dc = mejorPos.dir === "H" ? 1 : 0;
      for (let i = 0; i < p.length; i++) g.set(`${mejorPos.fila + dr * i},${mejorPos.col + dc * i}`, p[i]);
      puestas.push({ ...e, fila: mejorPos.fila, col: mejorPos.col, dir: mejorPos.dir });
    });
    if (!mejor || puestas.length > mejor.puestas.length) mejor = { puestas, sin, g };
    if (!sin.length) break;
  }
  if (mejor.puestas.length < 3) return { imposible: true, motivo: "no_cruzan" };
  // normalizar coordenadas a 0
  const minF = Math.min(...mejor.puestas.map((e) => e.fila)), minC = Math.min(...mejor.puestas.map((e) => e.col));
  const ps = mejor.puestas.map((e) => ({ ...e, fila: e.fila - minF, col: e.col - minC }));
  const filas = Math.max(...ps.map((e) => e.fila + (e.dir === "V" ? e.palabra.length : 1))), columnas = Math.max(...ps.map((e) => e.col + (e.dir === "H" ? e.palabra.length : 1)));
  const celdas = Array.from({ length: filas }, () => Array(columnas).fill(""));
  ps.forEach((e) => { for (let i = 0; i < e.palabra.length; i++) celdas[e.fila + (e.dir === "V" ? i : 0)][e.col + (e.dir === "H" ? i : 0)] = e.palabra[i]; });
  // numerar en orden de lectura (las palabras que empiezan en la misma celda comparten número)
  const inicios = [...new Set(ps.map((e) => e.fila + "," + e.col))].map((k) => k.split(",").map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const num = new Map(inicios.map((k, i) => [k.join(","), i + 1]));
  const out = ps.map((e) => ({ num: num.get(e.fila + "," + e.col), dir: e.dir, fila: e.fila, col: e.col, palabra: e.palabra, pista: e.pista })).sort((a, b) => a.num - b.num || (a.dir < b.dir ? -1 : 1));
  return { imposible: false, filas, columnas, celdas, entradas: out, sinColocar: mejor.sin };
}

// ---------- validación ----------
const N = (b) => TIPOS_BLOQUE[b.tipo].nombre;
// b ya normalizado → mensaje de error ("" si está bien)
export function errorBloque(b) {
  switch (b.tipo) {
    case "texto": return b.contenido ? "" : "El texto está vacío.";
    case "destacado": return b.contenido ? "" : "El recuadro destacado está vacío.";
    case "imagen": case "video": return "";                                     // sin dirección se avisa, pero no es error
    case "tarjetas": return b.tarjetas.length < 2 ? "Las tarjetas necesitan al menos 2 (frente y reverso)." : b.tarjetas.some((x) => !x.frente || !x.reverso) ? "Cada tarjeta necesita frente y reverso." : "";
    case "descubre": return b.items.length < 2 ? "«Toca para descubrir» necesita al menos 2 secciones." : b.items.some((x) => !x.titulo || !x.contenido) ? "Cada sección necesita título y contenido." : "";
    case "pasos": return b.pasos.length < 2 ? "El paso a paso necesita al menos 2 pasos." : b.pasos.some((x) => !x.contenido && !x.titulo) ? "Hay pasos vacíos." : "";
    case "pregunta":
      if (!b.pregunta) return "Falta el enunciado de la pregunta.";
      if (b.opciones.length < 2) return "La pregunta necesita al menos 2 opciones.";
      if (new Set(b.opciones.map((o) => o.toLowerCase())).size !== b.opciones.length) return "La pregunta tiene opciones repetidas.";
      if (!(b.correcta >= 0 && b.correcta < b.opciones.length)) return "No se sabe cuál es la opción correcta.";
      return "";
    case "reflexion": return b.consigna ? "" : "Falta la consigna de la reflexión.";
    case "enlace": return !b.texto ? "Falta el texto del botón." : !b.url ? "El botón necesita una dirección web válida (http:// o https://)." : "";
    case "sopa": return b.palabras.length < 3 ? "La sopa de letras necesita al menos 3 palabras (de 3 a 14 letras)." : "";
    case "crucigrama": {
      if (b.entradas.length < 3) return "El crucigrama necesita al menos 3 palabras (de 3 a 14 letras).";
      if (b.entradas.some((e) => !e.pista)) return "Cada palabra del crucigrama necesita su pista.";
      const c = crearCrucigrama(b.entradas, { rand: crearRngLeccion(b.id) });
      return c.imposible ? "Las palabras del crucigrama no se pueden cruzar entre sí: usa palabras que compartan letras." : "";
    }
    case "criptograma": { const l = [...new Set([...b.frase].map((c) => soloLetras(c)).filter(Boolean))]; return soloLetras(b.frase).length < 8 || l.length < 4 ? "La frase del criptograma es muy corta (mínimo 8 letras y 4 letras distintas)." : l.length > 26 ? "La frase tiene demasiadas letras distintas." : ""; }
    default: return "Bloque desconocido.";
  }
}
// Cosas que no impiden guardar pero conviene decir
export function avisoBloque(b) {
  if (b.tipo === "imagen" && !b.url) return "Imagen sin dirección: agrega el enlace de la imagen o el bloque no se mostrará.";
  if (b.tipo === "video" && !b.url) return "Video sin dirección: agrega el enlace o el bloque no se mostrará.";
  if (b.tipo === "crucigrama") { const c = crearCrucigrama(b.entradas, { rand: crearRngLeccion(b.id) }); if (!c.imposible && c.sinColocar.length) return `Del crucigrama no se pudo colocar: ${c.sinColocar.join(", ")}.`; }
  return "";
}

/**
 * Limpia y valida una lección completa. obj = { titulo, bloques }.
 * → { leccion: { titulo, bloques (solo los válidos) }, errores: [{ n, tipo, mensaje }], avisos: [string], omitidos }
 */
export function normalizarLeccion(obj) {
  const titulo = t(obj?.titulo, 160), errores = [], avisos = [], bloques = [], ids = new Set();
  lista(obj?.bloques).forEach((crudo, i) => {
    const b = normalizarBloque(crudo, i);
    if (!b) { errores.push({ n: i + 1, tipo: String(crudo?.tipo || "?"), mensaje: `El tipo de bloque «${String(crudo?.tipo || "(vacío)").slice(0, 30)}» no existe.` }); return; }
    const e = errorBloque(b); if (e) { errores.push({ n: i + 1, tipo: b.tipo, mensaje: e }); return; }
    const a = avisoBloque(b); if (a) avisos.push(`Bloque ${i + 1} (${N(b)}): ${a}`);
    while (ids.has(b.id)) b.id = nuevoId(); ids.add(b.id);
    bloques.push(b);
  });
  if (bloques.length > MAX_BLOQUES) { errores.push({ n: MAX_BLOQUES + 1, tipo: "?", mensaje: `Una lección admite máximo ${MAX_BLOQUES} bloques; se descartaron los demás.` }); bloques.length = MAX_BLOQUES; }
  return { leccion: { titulo, bloques }, errores, avisos, omitidos: errores.length };
}
export function errorLeccion(l) {
  if (!l || !t(l.titulo, 200)) return "Ponle un título a la lección.";
  if (!lista(l.bloques).length) return "La lección está vacía: agrega al menos un bloque.";
  for (let i = 0; i < l.bloques.length; i++) { const b = normalizarBloque(l.bloques[i], i); if (!b) return `El bloque ${i + 1} no es válido.`; const e = errorBloque(b); if (e) return `Bloque ${i + 1} (${N(b)}): ${e}`; }
  return "";
}
// Lo que el estudiante debe hacer para dar la lección por terminada
export function requeridos(bloques) {
  const l = lista(bloques);
  return { preguntas: l.filter((b) => b.tipo === "pregunta").map((b) => b.id), reflexiones: l.filter((b) => b.tipo === "reflexion").map((b) => b.id) };
}
export const resumenLeccion = (bloques) => { const c = {}; lista(bloques).forEach((b) => (c[b.tipo] = (c[b.tipo] || 0) + 1)); return c; };

// ---------- texto con formato sencillo ----------
// "## Subtítulo", "- elemento" / "1. elemento" (listas), "**negrita**". Se devuelve una estructura (nunca HTML) para pintarla de forma segura.
function segmentos(linea) {
  const out = []; let resto = String(linea), m;
  while ((m = resto.match(/\*\*([^*]+)\*\*/))) { if (m.index > 0) out.push({ b: false, texto: resto.slice(0, m.index) }); out.push({ b: true, texto: m[1] }); resto = resto.slice(m.index + m[0].length); }
  if (resto) out.push({ b: false, texto: resto }); return out;
}
export function parsearTexto(contenido) {
  const out = []; let par = [], lis = null;
  const cierraPar = () => { if (par.length) { out.push({ t: "p", segs: segmentos(par.join(" ")) }); par = []; } };
  const cierraLis = () => { if (lis) { out.push(lis); lis = null; } };
  String(contenido ?? "").split("\n").forEach((raw) => {
    const l = raw.trim(); let m;
    if (!l) { cierraPar(); cierraLis(); return; }
    if ((m = l.match(/^#{1,3}\s+(.+)$/))) { cierraPar(); cierraLis(); out.push({ t: "h", texto: m[1] }); return; }
    if ((m = l.match(/^[-*•]\s+(.+)$/))) { cierraPar(); if (!lis || lis.t !== "ul") { cierraLis(); lis = { t: "ul", items: [] }; } lis.items.push(segmentos(m[1])); return; }
    if ((m = l.match(/^\d+[.)]\s+(.+)$/))) { cierraPar(); if (!lis || lis.t !== "ol") { cierraLis(); lis = { t: "ol", items: [] }; } lis.items.push(segmentos(m[1])); return; }
    cierraLis(); par.push(l);
  });
  cierraPar(); cierraLis(); return out;
}

// ---------- lo que devuelve la IA ----------
// Acepta la respuesta tal cual la pega la docente: con ```json, con texto antes o después, comillas "curvas", comas sobrantes…
export function leerRespuestaIA(texto) {
  let s = String(texto ?? "").replace(/^﻿/, "").trim();
  if (!s) return { error: "Pega aquí la respuesta completa de la IA." };
  const cerca = s.match(/```(?:json|JSON)?\s*([\s\S]*?)```/); if (cerca && /[{[]/.test(cerca[1])) s = cerca[1].trim();
  const a = s.search(/[{[]/); if (a < 0) return { error: "No encontré el formato en la respuesta. Pídele a la IA que responda solo con el JSON de las instrucciones." };
  const cierre = s[a] === "{" ? "}" : "]", z = s.lastIndexOf(cierre);
  if (z < a) return { error: "La respuesta parece cortada: falta el final. Pídele a la IA que la continúe o que la envíe completa." };
  s = s.slice(a, z + 1);
  const intentos = [s, s.replace(/,\s*([}\]])/g, "$1"), s.replace(/[“”„]/g, '"').replace(/,\s*([}\]])/g, "$1")];
  let ultimo = "";
  for (const x of intentos) { try { let d = JSON.parse(x); if (Array.isArray(d)) d = { bloques: d }; if (d && d.leccion && typeof d.leccion === "object") d = d.leccion; if (!d || typeof d !== "object" || !Array.isArray(d.bloques)) return { error: 'La respuesta no trae la lista "bloques". Revisa que la IA haya seguido las instrucciones.' }; return { ok: true, datos: d }; } catch (e) { ultimo = e.message || ""; } }
  return { error: "No pude leer la respuesta de la IA: el formato JSON tiene un error (" + ultimo.replace(/^JSON\.parse: ?/, "").slice(0, 90) + "). Pídele a la IA que corrija el JSON y vuelve a pegarlo." };
}

// ---------- instrucciones para la IA ----------
// Descripción de los bloques que se le da a la IA (también la usa la creación de módulos completos, en modulos.js)
export const ESPECIFICACION_BLOQUES = `TIPOS DE BLOQUE (cada bloque lleva "tipo" y sus campos; usa solo estos):
1. {"tipo":"texto","titulo":"(opcional)","contenido":"Párrafos separados por una línea en blanco. Subtítulo: línea que empieza con '## '. Listas: líneas que empiezan con '- ' o '1. '. Negrita: **así**."}
2. {"tipo":"destacado","estilo":"idea" | "cita" | "oracion","titulo":"(opcional)","contenido":"...","fuente":"(opcional, por ejemplo: Mateo 5,3-12)"}
3. {"tipo":"imagen","url":"","descripcion":"Qué imagen conviene poner aquí","pie":"(opcional)"}  → deja "url" vacío: la docente la agrega.
4. {"tipo":"video","url":"","titulo":"Qué video conviene poner"}  → deja "url" vacío.
5. {"tipo":"tarjetas","titulo":"(opcional)","tarjetas":[{"frente":"Término","reverso":"Significado"}]}  → de 3 a 8 tarjetas.
6. {"tipo":"descubre","titulo":"(opcional)","items":[{"titulo":"Sección","contenido":"Texto que se muestra al tocar"}]}  → de 2 a 6.
7. {"tipo":"pasos","titulo":"(opcional)","pasos":[{"titulo":"Paso 1","contenido":"..."}]}  → de 2 a 8.
8. {"tipo":"pregunta","pregunta":"...","opciones":["A","B","C","D"],"correcta":0,"explicacion":"Por qué es la correcta"}  → de 2 a 4 opciones; "correcta" es el número de la opción correcta empezando en 0 (0 = primera opción).
9. {"tipo":"reflexion","consigna":"Pregunta personal para que el estudiante escriba","ayuda":"(opcional) una pista para empezar"}
10. {"tipo":"enlace","texto":"Texto del botón","url":"","descripcion":"(opcional)"}  → deja "url" vacío salvo que el material traiga una dirección.
11. {"tipo":"sopa","titulo":"(opcional)","palabras":["PAZ","RESPETO","JUSTICIA"]}  → de 5 a 10 palabras de 3 a 14 letras, sin espacios.
12. {"tipo":"crucigrama","titulo":"(opcional)","entradas":[{"palabra":"RESPETO","pista":"Valor de tratar bien a los demás"}]}  → de 5 a 10 palabras de 3 a 14 letras, sin espacios ni tildes, que compartan letras entre sí para poder cruzarse.
13. {"tipo":"criptograma","titulo":"(opcional)","frase":"Frase corta y clave de la lección","pista":"(opcional)"}  → la frase debe tener entre 8 y 100 letras.
`;

export function instruccionesIA({ para = "" } = {}) {
  const publico = String(para || "").trim() ? `El público son estudiantes de: ${String(para).trim().slice(0, 100)}.` : "El público son estudiantes de colegio (adapta el lenguaje a su edad).";
  return `Eres una docente-diseñadora de lecciones interactivas para la plataforma CÓDICE. Vas a convertir el material que está al final en UNA lección de estudio, escrita en español sencillo y cercano. ${publico}

FORMATO DE LA RESPUESTA
Responde SOLO con un bloque de código JSON (sin explicaciones antes ni después) con esta forma:
{ "titulo": "Título de la lección", "bloques": [ ...bloques... ] }

${ESPECIFICACION_BLOQUES}REGLAS
- Empieza con un bloque "texto" o "destacado" que presente el tema, y termina con una "reflexion".
- Alterna explicación e interacción: después de cada 2 o 3 bloques de contenido, pon una "pregunta" o una actividad (tarjetas, descubre, pasos).
- Incluye de 2 a 4 "pregunta", al menos 1 "reflexion" y, si el tema lo permite, una sopa, un crucigrama o un criptograma.
- Usa SOLO información del material; no inventes datos, fechas ni citas. Si el material trae una cita bíblica, úsala tal cual.
- La lección debe tener entre 8 y 20 bloques.
- Todo el JSON debe ser válido: comillas dobles rectas, sin comas sobrantes, sin comentarios.

MATERIAL DEL MÓDULO:
`;
}
