// =====================================================================================
//  EVENTOS TEMPORALES DEL MUNDO (lógica pura, sin base de datos ni pantalla: se puede probar sola)
//  Por ejemplo la "Semana de la Ética": durante unas fechas, para un curso (o todos), hay
//   · XP y/u oro multiplicados en todo lo que da premio,
//   · un jefe especial en una zona,
//   · y preguntas de un tema que un Heraldo hace en la plaza (cada una se premia una sola vez).
//  Las fechas se piensan en hora de Colombia (UTC−5): el evento empieza a las 00:00 del primer día y termina al final del último.
// =====================================================================================
import { misionVisiblePara } from "../lib/gradosMundo";
import { CLAVES_TIPO } from "./monstruos";

export const MULT_MIN = 1, MULT_MAX = 5;
export const MAX_PREGUNTAS_EVENTO = 10, MAX_DIAS_EVENTO = 60;
export const ZONAS_JEFE_EVENTO = [["bosque", "🌲 Bosque de la Curiosidad"], ["montana", "🏔️ Montaña del Esfuerzo"], ["lago", "🏞️ Lago de la Reflexión"]];
export const EMOJIS_EVENTO = ["🎉", "🌟", "📚", "🕊️", "⚖️", "🤝", "🌱", "🔥", "🏆", "🎭"];
export const EMOJIS_JEFE = ["👹", "🐉", "🦂", "🦅", "🐺", "🦑", "👻", "🤖"];
export const OFFSET_COLOMBIA_H = 5;                          // Colombia = UTC−5: medianoche allá = 05:00 UTC
const DIA_MS = 86400000;

const txt = (v) => String(v ?? "").trim();
const ent = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.floor(n) : d; };

// ---------- fechas (cadena "AAAA-MM-DD" ↔ instante) ----------
export const esFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !Number.isNaN(Date.parse(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
export const inicioDeFecha = (f) => `${f}T0${OFFSET_COLOMBIA_H}:00:00.000Z`;                                   // 00:00 en Colombia
export const finDeFecha = (f) => new Date(Date.parse(inicioDeFecha(f)) + DIA_MS).toISOString();                   // 00:00 del día siguiente (exclusivo)
export const fechaDeInicio = (iso) => new Date(Date.parse(iso) - OFFSET_COLOMBIA_H * 3600000).toISOString().slice(0, 10);
export const fechaDeFin = (iso) => new Date(Date.parse(iso) - OFFSET_COLOMBIA_H * 3600000 - 1).toISOString().slice(0, 10);   // el último día incluido
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const bonita = (f) => { const [, m, d] = f.split("-"); return `${Number(d)} de ${MESES[Number(m) - 1]}`; };
export function textoFechas(ev) {
  if (!ev || !ev.inicio || !ev.fin) return "";
  const a = fechaDeInicio(ev.inicio), b = fechaDeFin(ev.fin);
  return a === b ? `el ${bonita(a)}` : `del ${bonita(a)} al ${bonita(b)}`;
}
export const textoHasta = (ev) => (ev && ev.fin ? `hasta el ${bonita(fechaDeFin(ev.fin))}` : "");

// ---------- cuándo está en marcha ----------
export function estadoEvento(ev, ahora = Date.now()) {
  if (!ev) return "terminado";
  if (ev.activo === false) return "apagado";
  const i = Date.parse(ev.inicio), f = Date.parse(ev.fin);
  if (!Number.isFinite(i) || !Number.isFinite(f)) return "apagado";
  return ahora < i ? "proximo" : ahora >= f ? "terminado" : "en_curso";
}
export const eventoVigente = (ev, ahora = Date.now()) => estadoEvento(ev, ahora) === "en_curso";
// ¿Es para el estudiante de ese curso? (vacío = todos; "nivel:8" = todo octavo; "802" = ese curso)
export const aplicaA = (ev, gradoEstudiante) => !!ev && misionVisiblePara(ev.grado_id || "", gradoEstudiante == null ? "" : String(gradoEstudiante));
// Si por error hay varios a la vez, manda el más reciente (de id mayor)
export function elegirEvento(lista, ahora, grado) {
  return (Array.isArray(lista) ? lista : []).filter((e) => eventoVigente(e, ahora) && aplicaA(e, grado)).sort((a, b) => Number(b.id) - Number(a.id))[0] || null;
}

// ---------- los bonos ----------
export const multiplicar = (valor, mult) => Math.max(0, Math.round(ent(valor) * Math.max(MULT_MIN, Math.min(MULT_MAX, Number(mult) || 1))));
// Premio base → premio con el evento. Devuelve también lo que se añadió, para avisarlo.
export function aplicarBono(xp, oro, ev) {
  const bx = ent(xp), bo = ent(oro);
  if (!ev) return { xp: bx, oro: bo, extraXp: 0, extraOro: 0 };
  const x = multiplicar(bx, ev.xp_mult ?? ev.xpMult), o = multiplicar(bo, ev.oro_mult ?? ev.oroMult);
  return { xp: x, oro: o, extraXp: x - bx, extraOro: o - bo };
}

// ---------- validar lo que escribe la docente ----------
const multOk = (v) => { const n = Number(v); return Number.isFinite(n) && n >= MULT_MIN && n <= MULT_MAX && Math.round(n * 2) === n * 2; };
// Quita las respuestas vacías y recalcula cuál era la correcta
export function limpiarPregunta(p) {
  const todas = ((p && p.opciones) || []).map(txt), mapa = {}, ops = [];
  todas.forEach((o, i) => { if (o) { mapa[i] = ops.length; ops.push(o.slice(0, 120)); } });
  return { texto: txt(p && p.texto).slice(0, 300), opciones: ops, correcta: mapa[Number(p && p.correcta)] ?? -1, pista: txt(p && p.pista).slice(0, 160) };
}
export function validarPregunta(p) {
  if (!txt(p && p.texto)) return "escribe la pregunta";
  if (txt(p.texto).length > 300) return "la pregunta pasa de 300 letras";
  const ops = (p.opciones || []).map(txt);
  if (ops.filter(Boolean).length < 2) return "pon al menos 2 respuestas";
  if (ops.length > 5) return "máximo 5 respuestas";
  if (ops.some((o) => o.length > 120)) return "una respuesta pasa de 120 letras";
  if (new Set(ops.map((o) => o.toLowerCase())).size !== ops.length) return "hay respuestas repetidas";
  const c = Number(p.correcta); if (!Number.isInteger(c) || c < 0 || c >= ops.length) return "marca cuál es la correcta";
  if (txt(p.pista).length > 160) return "la pista pasa de 160 letras";
  return "";
}
export function validarJefe(j) {
  if (!j) return "";
  if (txt(j.nombre).length < 3 || txt(j.nombre).length > 30) return "El nombre del jefe va de 3 a 30 letras.";
  if (!txt(j.emoji) || [...txt(j.emoji)].length > 4) return "Elige cómo se ve el jefe.";
  if (!CLAVES_TIPO.includes(j.tipo)) return "Elige el tipo del jefe.";
  const n = Number(j.nivel); if (!Number.isInteger(n) || n < 1 || n > 10) return "El nivel del jefe va de 1 a 10.";
  if (!ZONAS_JEFE_EVENTO.some((z) => z[0] === j.zona)) return "Elige en qué zona aparece el jefe.";
  return "";
}
// c = { nombre, emoji, descripcion, desde:"AAAA-MM-DD", hasta:"AAAA-MM-DD", grado_id, xp_mult, oro_mult, jefe|null, preguntas:[], premio_xp, premio_oro, activo }
export function validarEvento(c) {
  const nombre = txt(c && c.nombre);
  if (nombre.length < 3) return "Ponle un nombre al evento (por ejemplo: Semana de la Ética).";
  if (nombre.length > 60) return "El nombre del evento pasa de 60 letras.";
  if (txt(c.descripcion).length > 240) return "La descripción pasa de 240 letras.";
  if (!esFecha(c.desde) || !esFecha(c.hasta)) return "Elige la fecha de inicio y la de cierre.";
  if (c.hasta < c.desde) return "La fecha de cierre no puede ser antes que la de inicio.";
  if ((Date.parse(c.hasta) - Date.parse(c.desde)) / DIA_MS + 1 > MAX_DIAS_EVENTO) return `Un evento puede durar como máximo ${MAX_DIAS_EVENTO} días.`;
  if (!multOk(c.xp_mult)) return `El multiplicador de XP va de ${MULT_MIN} a ${MULT_MAX} (de medio en medio: 1, 1.5, 2…).`;
  if (!multOk(c.oro_mult)) return `El multiplicador de oro va de ${MULT_MIN} a ${MULT_MAX} (de medio en medio: 1, 1.5, 2…).`;
  const eJ = validarJefe(c.jefe); if (eJ) return eJ;
  const ps = (Array.isArray(c.preguntas) ? c.preguntas : []).map(limpiarPregunta);
  if (ps.length > MAX_PREGUNTAS_EVENTO) return `Máximo ${MAX_PREGUNTAS_EVENTO} preguntas por evento.`;
  for (let i = 0; i < ps.length; i++) { const e = validarPregunta(ps[i]); if (e) return `Pregunta ${i + 1}: ${e}.`; }
  if (ps.length) for (const [k, n] of [["premio_xp", "El XP de cada pregunta"], ["premio_oro", "El oro de cada pregunta"]]) { const v = Number(c[k]); if (c[k] === "" || c[k] == null || !Number.isInteger(v) || v < 0 || v > 200) return `${n} tiene que ser un número entero entre 0 y 200.`; }
  if (Number(c.xp_mult) === 1 && Number(c.oro_mult) === 1 && !c.jefe && !ps.length) return "El evento no hace nada todavía: sube un multiplicador, agrega un jefe o escribe preguntas.";
  return "";
}
// Deja el evento listo para guardar en la base
export function limpiarEvento(c) {
  const ps = (Array.isArray(c.preguntas) ? c.preguntas : []).map(limpiarPregunta);
  const j = c.jefe ? { nombre: txt(c.jefe.nombre).slice(0, 30), emoji: txt(c.jefe.emoji), tipo: c.jefe.tipo, nivel: ent(c.jefe.nivel, 1), zona: c.jefe.zona } : null;
  return {
    nombre: txt(c.nombre).slice(0, 60), emoji: txt(c.emoji) || "🎉", descripcion: txt(c.descripcion).slice(0, 240) || null,
    inicio: inicioDeFecha(c.desde), fin: finDeFecha(c.hasta), grado_id: c.grado_id || "",
    xp_mult: Number(c.xp_mult), oro_mult: Number(c.oro_mult), jefe: j, preguntas: ps,
    premio_xp: ps.length ? ent(c.premio_xp) : 0, premio_oro: ps.length ? ent(c.premio_oro) : 0, activo: c.activo !== false,
  };
}
// Una fila de la base → el evento como lo usan el juego y el editor
export function normalizarEvento(f) {
  const json = (v, def) => { if (typeof v === "string") { try { return JSON.parse(v); } catch { return def; } } return v == null ? def : v; };
  return {
    id: f.id, nombre: f.nombre, emoji: f.emoji || "🎉", descripcion: f.descripcion || "", inicio: f.inicio, fin: f.fin, grado_id: f.grado_id || "",
    xp_mult: Number(f.xp_mult) || 1, oro_mult: Number(f.oro_mult) || 1, jefe: json(f.jefe, null), preguntas: json(f.preguntas, []) || [],
    premio_xp: ent(f.premio_xp), premio_oro: ent(f.premio_oro), activo: f.activo !== false,
  };
}
// Las preguntas que el juego puede usar (descarta las dañadas)
export const preguntasJugables = (ev) => (ev && Array.isArray(ev.preguntas) ? ev.preguntas.map((p, idx) => ({ ...p, idx })).filter((p) => !validarPregunta(p)) : []);
export const jefeJugable = (ev) => (ev && ev.jefe && !validarJefe(ev.jefe) ? ev.jefe : null);
// Texto corto del bono: "XP ×2 · oro ×1.5"
export function textoBono(ev) {
  const x = Number(ev && (ev.xp_mult ?? ev.xpMult)) || 1, o = Number(ev && (ev.oro_mult ?? ev.oroMult)) || 1, f = (n) => `×${n}`;
  return [x > 1 ? `XP ${f(x)}` : "", o > 1 ? `oro ${f(o)}` : ""].filter(Boolean).join(" · ");
}
