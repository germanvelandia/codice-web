// =====================================================================================
//  MUNDOS ALTERNOS — 🎲 la Oca de CÓDICE y 🍄 las Plataformas (lógica pura, sin pantalla ni base de datos)
//  Aquí viven las reglas de los dos juegos, para poder probarlas solas:
//    · config y preguntas (banco de trivia + preguntas propias de la docente + preguntas de las misiones)
//    · la Oca: tablero, dado, casillas especiales, pruebas y pozo
//    · las Plataformas: niveles, física, enemigos, bloques "?" con pregunta y la puerta del saber
// =====================================================================================
import { barajar, normalizarPregunta, textoNorm } from "./duelo";
import { misionVisiblePara } from "../lib/gradosMundo";

export const JUEGOS_ALT = {
  oca: { clave: "oca", nombre: "La Oca de CÓDICE", emoji: "🎲", corto: "Oca" },
  plat: { clave: "plat", nombre: "Plataformas de CÓDICE", emoji: "🍄", corto: "Plataformas" },
};
export const MIN_PREGUNTAS = { oca: 8, plat: 6 };

// ---------- configuración (mundo_config solo guarda enteros) ----------
export const CONFIG_ALT_DEFECTO = {
  oca_activo: 1, oca_xp: 40, oca_oro: 15, oca_banco: 0, oca_penal: 3,
  plat_activo: 1, plat_xp: 25, plat_oro: 10, plat_banco: 0, plat_corazones: 3, plat_puerta: 3,
};
const entre = (v, min, max, def) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
export function configAlt(cfg = {}) {
  const c = { ...CONFIG_ALT_DEFECTO, ...cfg };
  return {
    oca: { activo: c.oca_activo === 1, xp: entre(c.oca_xp, 0, 1000, 40), oro: entre(c.oca_oro, 0, 1000, 15), banco: entre(c.oca_banco, 0, 1e9, 0), penal: entre(c.oca_penal, 1, 6, 3) },
    plat: { activo: c.plat_activo === 1, xp: entre(c.plat_xp, 0, 1000, 25), oro: entre(c.plat_oro, 0, 1000, 10), banco: entre(c.plat_banco, 0, 1e9, 0), corazones: entre(c.plat_corazones, 1, 5, 3), puerta: entre(c.plat_puerta, 1, 5, 3) },
  };
}

// ---------- preguntas propias de la docente ----------
const aLista = (o) => { if (Array.isArray(o)) return o; if (typeof o === "string") { try { const v = JSON.parse(o); return Array.isArray(v) ? v : []; } catch { return []; } } return []; };
export function validarPruebaAlt(p) {
  if (!p) return "Falta la pregunta.";
  if (!String(p.texto ?? "").trim()) return "Escribe el enunciado de la pregunta.";
  if (String(p.texto).trim().length > 300) return "El enunciado es muy largo (máximo 300 letras).";
  const ops = aLista(p.opciones).map((o) => String(o ?? "").trim());
  if (ops.length < 2) return "Pon al menos 2 opciones.";
  if (ops.length > 4) return "Pon máximo 4 opciones.";
  if (ops.some((o) => !o)) return "Hay una opción vacía.";
  if (ops.some((o) => o.length > 120)) return "Una opción es muy larga (máximo 120 letras).";
  if (new Set(ops.map(textoNorm)).size !== ops.length) return "Hay dos opciones iguales.";
  const c = Number(p.correcta);
  if (!Number.isInteger(c) || c < 0 || c >= ops.length) return "Marca cuál es la opción correcta.";
  if (p.juego != null && !["oca", "plat", "ambos"].includes(p.juego)) return "Elige para qué juego es.";
  return "";
}
export const limpiarPruebaAlt = (p) => ({
  juego: ["oca", "plat"].includes(p.juego) ? p.juego : "ambos",
  texto: String(p.texto).trim(), opciones: aLista(p.opciones).map((o) => String(o).trim()), correcta: Number(p.correcta),
  pista: String(p.pista ?? "").trim().slice(0, 200), retro: String(p.retro ?? "").trim().slice(0, 300),
  grado_id: p.grado_id ? String(p.grado_id) : "", activa: p.activa !== false,
});
export const normalizarPruebaAlt = (f) => ({
  id: f.id, juego: f.juego || "ambos", texto: f.texto || "", opciones: aLista(f.opciones), correcta: Number(f.correcta), pista: f.pista || "", retro: f.retro || "",
  grado_id: f.grado_id || "", activa: f.activa !== false,
});

/**
 * El banco de un juego: preguntas propias (primero) + banco de trivia + preguntas de las misiones. Sin repetidas.
 *  propias: filas normalizadas · banco: [{pregunta/texto, opciones, correcta}] · misiones: las que ya ve el estudiante
 */
export function armarPoolAlt({ juego, propias = [], banco = [], misiones = [], grado = "" } = {}) {
  const vistas = new Set(), pool = [];
  const agregar = (p, fuente) => { const n = normalizarPregunta(p, fuente); if (!n) return; const k = textoNorm(n.texto); if (vistas.has(k)) return; vistas.add(k); pool.push(n); };
  propias.filter((p) => p && p.activa !== false && (p.juego === "ambos" || !p.juego || p.juego === juego) && misionVisiblePara(p.grado_id || "", grado)).forEach((p) => agregar(p, "propia"));
  banco.forEach((p) => agregar(p, "banco"));
  misiones.forEach((m) => agregar({ texto: m.texto, opciones: m.opciones, correcta: m.correcta, pista: m.pista, retro: m.retro }, "mision"));
  return pool;
}

// Estado de la puerta de un juego para el portal: { ok, motivo: ''|'apagado'|'pocas', hoy }
export function estadoJuegoAlt(juego, cfgJuego, pool, hechosHoy) {
  const hoy = (claves) => claves.every((k) => hechosHoy && hechosHoy.has(`${juego}:${k}`));
  const claves = juego === "oca" ? ["tablero"] : ["n1", "n2", "n3"];
  if (!cfgJuego || !cfgJuego.activo) return { ok: false, motivo: "apagado", hoy: hoy(claves) };
  if (!pool || pool.length < MIN_PREGUNTAS[juego]) return { ok: false, motivo: "pocas", hoy: hoy(claves), faltan: MIN_PREGUNTAS[juego] - (pool ? pool.length : 0) };
  return { ok: true, motivo: "", hoy: hoy(claves) };
}

// Cola de preguntas: sale una por una, mezcladas, y vuelve a empezar al agotarse (sin repetir seguidas).
function crearCola(pool, rng) { return { orden: barajar(pool.map((_, i) => i), rng), i: 0, pool, rng }; }
function sacar(cola) {
  if (cola.i >= cola.orden.length) { const ult = cola.orden[cola.orden.length - 1]; cola.orden = barajar(cola.pool.map((_, i) => i), cola.rng); if (cola.orden.length > 1 && cola.orden[0] === ult) cola.orden.push(cola.orden.shift()); cola.i = 0; }
  return cola.pool[cola.orden[cola.i++]];
}

// =====================================================================================
//  🎲 LA OCA
// =====================================================================================
export const META_OCA = 35;
const OCAS = [5, 9, 14, 18, 23, 27, 32];
const ESPECIALES = { 6: { tipo: "puente", destino: 12 }, 12: { tipo: "libre" }, 15: { tipo: "dragon", atras: 6 }, 19: { tipo: "pozo" }, 24: { tipo: "dados" }, 29: { tipo: "laberinto", atras: 8 }, 1: { tipo: "libre" }, 4: { tipo: "libre" }, 10: { tipo: "libre" }, 21: { tipo: "libre" }, 26: { tipo: "libre" }, 31: { tipo: "libre" } };
export const TIPOS_CASILLA = {
  salida: { emoji: "🏁", nombre: "Salida" }, libre: { emoji: "🌿", nombre: "Camino libre" }, prueba: { emoji: "❓", nombre: "Prueba" }, oca: { emoji: "🪿", nombre: "Oca: saltas a la siguiente oca y tiras otra vez" },
  puente: { emoji: "🌉", nombre: "Puente: cruzas a la casilla 12" }, dragon: { emoji: "🐉", nombre: "Dragón: retrocedes 6 casillas" }, pozo: { emoji: "🕳️", nombre: "Pozo: sales respondiendo bien una pregunta" },
  dados: { emoji: "🎲", nombre: "Dados: avanzas otra vez lo que sacaste" }, laberinto: { emoji: "🌀", nombre: "Laberinto: retrocedes 8 casillas" }, meta: { emoji: "🏆", nombre: "Meta" },
};
// El tablero: 36 casillas (0 = salida, 35 = meta)
export function tableroOca() {
  return Array.from({ length: META_OCA + 1 }, (_, n) => {
    if (n === 0) return { n, tipo: "salida" };
    if (n === META_OCA) return { n, tipo: "meta" };
    if (OCAS.includes(n)) return { n, tipo: "oca" };
    const e = ESPECIALES[n]; if (e) return { n, ...e };
    return { n, tipo: "prueba" };
  });
}
const TABLERO = tableroOca();
export const casillaOca = (n) => TABLERO[Math.max(0, Math.min(META_OCA, n))];
export const tirarDado = (rng = Math.random) => 1 + Math.floor(rng() * 6);

export function nuevaPartidaOca({ pool = [], rng = Math.random, penal = 3 } = {}) {
  if (!pool.length) return { imposible: true };
  const cola = crearCola(pool, rng);
  return { pos: 0, turnos: 0, aciertos: 0, errores: 0, fase: "tirar", pregunta: null, dado: 0, penal: entre(penal, 1, 6, 3), cola, log: ["¡Empieza la aventura! Tira el dado."], ultimo: null, ganado: false, pasos: [] };
}
const copiar = (e) => ({ ...e, log: [...e.log], pasos: [] });
const nota = (e, t) => { e.log.push(t); if (e.log.length > 30) e.log.shift(); };
function rebotar(pos) { return pos > META_OCA ? Math.max(0, META_OCA - (pos - META_OCA)) : pos; }
// Llega a una casilla y aplica su efecto. e.pasos guarda los saltos (para animar): [{de, a, motivo}]
function caer(e, dado) {
  const c = casillaOca(e.pos);
  switch (c.tipo) {
    case "meta": e.fase = "fin"; e.ganado = true; nota(e, "🏆 ¡Llegaste a la meta!"); return;
    case "oca": {
      const sig = OCAS.find((n) => n > e.pos);
      if (sig) { e.pasos.push({ de: e.pos, a: sig, motivo: "oca" }); nota(e, `🪿 ¡Oca! Saltas a la oca de la casilla ${sig} y tiras otra vez.`); e.pos = sig; }
      else nota(e, "🪿 ¡Oca! Tiras otra vez.");
      e.fase = "tirar"; return;
    }
    case "puente": e.pasos.push({ de: e.pos, a: c.destino, motivo: "puente" }); nota(e, `🌉 Cruzas el puente hasta la casilla ${c.destino}.`); e.pos = c.destino; e.fase = "tirar"; return;
    case "dragon": { const a = Math.max(0, e.pos - c.atras); e.pasos.push({ de: e.pos, a, motivo: "dragon" }); nota(e, `🐉 ¡Un dragón! Retrocedes a la casilla ${a}.`); e.pos = a; e.fase = "tirar"; return; }
    case "laberinto": { const a = Math.max(0, e.pos - c.atras); e.pasos.push({ de: e.pos, a, motivo: "laberinto" }); nota(e, `🌀 Te pierdes en el laberinto y vuelves a la casilla ${a}.`); e.pos = a; e.fase = "tirar"; return; }
    case "dados": { const a = rebotar(e.pos + dado); e.pasos.push({ de: e.pos, a, motivo: "dados" }); nota(e, `🎲 ¡Dados! Avanzas otras ${dado} casillas.`); e.pos = a; if (e.pos === META_OCA) { e.fase = "fin"; e.ganado = true; nota(e, "🏆 ¡Llegaste a la meta!"); } else e.fase = "tirar"; return; }
    case "pozo": e.fase = "pozo"; e.pregunta = sacar(e.cola); nota(e, "🕳️ ¡Caíste en el pozo! Responde bien para salir."); return;
    case "prueba": e.fase = "prueba"; e.pregunta = sacar(e.cola); nota(e, `❓ Prueba en la casilla ${e.pos}.`); return;
    default: e.fase = "tirar"; nota(e, "🌿 Camino libre."); return;
  }
}
// Tira el dado (el dado se pasa de afuera para poder probar). Devuelve un estado nuevo.
export function tirarOca(estado, dado) {
  if (!estado || estado.fase !== "tirar") return estado;
  const e = copiar(estado); e.dado = dado; e.turnos++; e.ultimo = null;
  const de = e.pos, a = rebotar(e.pos + dado);
  e.pasos.push({ de, a, motivo: "dado" }); e.pos = a;
  nota(e, a !== de + dado ? `Sacaste ${dado}: te pasas de la meta y rebotas a la casilla ${a}.` : `Sacaste ${dado}: avanzas a la casilla ${a}.`);
  caer(e, dado);
  return e;
}
// Responde una prueba o el pozo
export function responderOca(estado, idx) {
  if (!estado || (estado.fase !== "prueba" && estado.fase !== "pozo")) return estado;
  const e = copiar(estado), p = e.pregunta, ok = Number(idx) === p.correcta, enPozo = e.fase === "pozo";
  e.ultimo = { ok, correcta: p.correcta, retro: p.retro || "", pista: p.pista || "", pozo: enPozo };
  if (ok) {
    e.aciertos++;
    if (enPozo) { e.fase = "tirar"; e.pregunta = null; nota(e, "✅ ¡Sales del pozo!"); }
    else {
      const a = Math.min(META_OCA, e.pos + 2); e.pasos.push({ de: e.pos, a, motivo: "acierto" }); e.pos = a; e.pregunta = null;
      if (a === META_OCA) { e.fase = "fin"; e.ganado = true; nota(e, "✅ ¡Correcto! Y con el impulso llegas a la meta. 🏆"); } else { e.fase = "tirar"; nota(e, "✅ ¡Correcto! Avanzas 2 casillas de bonificación."); }
    }
  } else {
    e.errores++;
    if (enPozo) { e.pregunta = sacar(e.cola); nota(e, "❌ Todavía estás en el pozo. Intenta con otra pregunta."); }
    else { const a = Math.max(0, e.pos - e.penal); e.pasos.push({ de: e.pos, a, motivo: "error" }); nota(e, `❌ Incorrecto. Retrocedes ${e.pos - a} ${e.pos - a === 1 ? "casilla" : "casillas"}.`); e.pos = a; e.fase = "tirar"; e.pregunta = null; }
  }
  return e;
}
export const estrellasOca = (e) => (e.errores <= 1 ? 3 : e.errores <= 4 ? 2 : 1);
export const resultadoOca = (e) => ({ juego: "oca", clave: "tablero", aciertos: e.aciertos, errores: e.errores, turnos: e.turnos, estrellas: estrellasOca(e), puntos: Math.max(0, e.aciertos * 10 - e.errores * 3) });

// =====================================================================================
//  🍄 LAS PLATAFORMAS
// =====================================================================================
export const T = 32, FILAS = 12, PW = 20, PH = 28, ANCHO_VISTA = 640, ALTO_VISTA = FILAS * T;
const GRAV = 1900, SALTO = 650, VMAX = 190, ACEL = 1300, FRIC = 1600, VCAIDA = 900;
export const NIVELES_PLAT = 3;
export const NOMBRES_NIVEL = ["La pradera", "Las cuevas", "El castillo del saber"];
const SOLIDOS = new Set(["#", "=", "?", "u", "G"]);

// Constructor de niveles: se dibuja sobre una cuadrícula FILAS × ancho. El suelo está en las filas 10 y 11.
function lienzo(ancho) { const g = Array.from({ length: FILAS }, () => Array(ancho).fill(" ")); for (let c = 0; c < ancho; c++) { g[10][c] = "#"; g[11][c] = "#"; } return g; }
const pozoP = (g, c, w) => { for (let i = 0; i < w; i++) { g[10][c + i] = " "; g[11][c + i] = " "; } };
const platP = (g, c, r, w) => { for (let i = 0; i < w; i++) g[r][c + i] = "="; };
const monedasP = (g, c, r, n) => { for (let i = 0; i < n; i++) if (g[r][c + i] === " ") g[r][c + i] = "o"; };
const bloqueP = (g, c, r = 7) => { g[r][c] = "?"; };
const enemigoP = (g, c, r = 9) => { g[r][c] = "e"; };
const picosP = (g, c, n = 1) => { for (let i = 0; i < n; i++) g[9][c + i] = "^"; };
const murete = (g, c, alto) => { for (let i = 0; i < alto; i++) g[10 - 1 - i][c] = "#"; };
const puertaP = (g, c) => { for (let r = 5; r <= 9; r++) g[r][c] = "G"; };
const metaP = (g, c) => { for (let r = 6; r <= 9; r++) g[r][c] = "F"; };

export function construirNivel(n) {
  let g;
  if (n === 1) {
    g = lienzo(64); g[9][2] = "P";
    [9, 13, 24, 31, 40, 47].forEach((c) => bloqueP(g, c));
    pozoP(g, 17, 2); pozoP(g, 35, 2);
    [21, 29, 43].forEach((c) => enemigoP(g, c));
    platP(g, 26, 7, 3); monedasP(g, 26, 6, 3); monedasP(g, 4, 8, 3); monedasP(g, 15, 6, 5); monedasP(g, 36, 6, 3); monedasP(g, 44, 8, 3);
    murete(g, 38, 1); murete(g, 39, 2);
    puertaP(g, 54); metaP(g, 61);
  } else if (n === 2) {
    g = lienzo(80); g[9][2] = "P";
    [8, 12, 22, 30, 41, 50, 58].forEach((c) => bloqueP(g, c));
    pozoP(g, 15, 3); pozoP(g, 34, 3); pozoP(g, 46, 2);
    monedasP(g, 15, 7, 3); monedasP(g, 34, 7, 3); platP(g, 40, 6, 3); monedasP(g, 40, 5, 3);
    [19, 26, 38, 52, 55].forEach((c) => enemigoP(g, c));
    picosP(g, 28, 2); picosP(g, 43, 1); picosP(g, 62, 2);
    platP(g, 66, 7, 4); monedasP(g, 66, 6, 4); monedasP(g, 4, 8, 4); monedasP(g, 23, 6, 4); monedasP(g, 53, 7, 3);
    murete(g, 36, 1); murete(g, 37, 2);
    puertaP(g, 70); metaP(g, 77);
  } else {
    g = lienzo(96); g[9][2] = "P";
    [8, 12, 19, 27, 37, 46, 55, 66].forEach((c) => bloqueP(g, c));
    pozoP(g, 15, 3); pozoP(g, 31, 3); pozoP(g, 42, 3); pozoP(g, 60, 2);
    monedasP(g, 15, 7, 3); monedasP(g, 31, 7, 3); monedasP(g, 42, 7, 3); platP(g, 36, 6, 3); monedasP(g, 36, 5, 3);
    [22, 25, 49, 64, 70].forEach((c) => enemigoP(g, c));
    picosP(g, 20, 1); picosP(g, 47, 1); picosP(g, 68, 2);
    murete(g, 24, 1); murete(g, 25, 2); murete(g, 26, 3); murete(g, 51, 1); murete(g, 52, 2);
    platP(g, 75, 7, 3); platP(g, 80, 6, 3); monedasP(g, 75, 6, 3); monedasP(g, 80, 5, 3); monedasP(g, 4, 8, 3); monedasP(g, 31, 7, 3);
    puertaP(g, 86); metaP(g, 93);
  }
  return g.map((fila) => fila.join(""));
}
export const bloquesDeNivel = (n) => construirNivel(n).reduce((s, f) => s + [...f].filter((ch) => ch === "?").length, 0);

export function nuevaPartidaPlat({ nivel = 1, pool = [], rng = Math.random, corazones = 3, puerta = 3 } = {}) {
  if (!pool.length) return { imposible: true };
  const filas = construirNivel(nivel), grid = filas.map((f) => f.split("")), ancho = grid[0].length;
  const enemigos = []; let inicio = { c: 2, r: 9 };
  for (let r = 0; r < FILAS; r++) for (let c = 0; c < ancho; c++) {
    if (grid[r][c] === "e") { enemigos.push({ x: c * T + 4, y: r * T + (T - 24), w: 24, h: 24, vx: -50, vivo: true }); grid[r][c] = " "; }
    else if (grid[r][c] === "P") { inicio = { c, r }; grid[r][c] = " "; }
  }
  const x0 = inicio.c * T + (T - PW) / 2, y0 = (inicio.r + 1) * T - PH;
  return {
    nivel, ancho, grid, enemigos, cola: crearCola(pool, rng), puertaNecesita: Math.max(1, Math.floor(puerta)), puertaAbierta: false,
    x: x0, y: y0, vx: 0, vy: 0, dir: 1, enSuelo: false, coyote: 0, buffer: 0, saltoPrev: false, corazones: Math.max(1, Math.floor(corazones)), corazonesMax: Math.max(1, Math.floor(corazones)), inv: 0,
    monedas: 0, aciertos: 0, errores: 0, pisotones: 0, t: 0, fase: "jugando", pregunta: null, pend: null, espera: 0, seguro: { x: x0, y: y0 }, tSeguro: 0,
    golpe: null, aviso: "", avisoT: 0, ev: [],
  };
}
const tile = (e, c, r) => { if (c < 0 || c >= e.ancho || r < 0) return "#"; if (r >= FILAS) return " "; return e.grid[r][c]; };
// casillas sólidas que toca una caja
function toca(e, x, y, w, h) {
  const out = [], c0 = Math.floor(x / T), c1 = Math.floor((x + w - 0.001) / T), r0 = Math.floor(y / T), r1 = Math.floor((y + h - 0.001) / T);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const ch = tile(e, c, r); if (SOLIDOS.has(ch)) out.push({ c, r, ch }); }
  return out;
}
function hacerDanio(e, empuje = 0) {
  if (e.inv > 0 || e.fase !== "jugando") return;
  e.corazones--; e.inv = 1.6; e.vy = -300; e.vx = empuje * 170; e.enSuelo = false; e.ev.push("danio");
  if (e.corazones <= 0) { e.fase = "perdido"; e.ev.push("perdido"); }
}
function reaparecer(e) { e.x = e.seguro.x; e.y = e.seguro.y; e.vx = 0; e.vy = 0; e.inv = 1.2; }

// Un paso de la simulación. entrada: { izq, der, salto } (booleanos). Devuelve el mismo estado (se modifica).
export function pasoPlat(e, entrada = {}, dt = 1 / 60) {
  if (!e || e.fase !== "jugando") { if (e && e.golpe) e.golpe = null; return e; }
  e.t += dt; if (e.inv > 0) e.inv = Math.max(0, e.inv - dt); if (e.espera > 0) e.espera = Math.max(0, e.espera - dt); if (e.avisoT > 0) { e.avisoT -= dt; if (e.avisoT <= 0) e.aviso = ""; }
  if (e.golpe) { e.golpe.t -= dt; if (e.golpe.t <= 0) e.golpe = null; }
  // --- horizontal ---
  const m = (entrada.der ? 1 : 0) - (entrada.izq ? 1 : 0);
  if (m) { e.dir = m; e.vx += m * ACEL * dt; if (Math.abs(e.vx) > VMAX) e.vx = Math.sign(e.vx) * Math.max(VMAX, Math.abs(e.vx) - 2500 * dt); }
  else if (e.vx) { const f = FRIC * dt; e.vx = Math.abs(e.vx) <= f ? 0 : e.vx - Math.sign(e.vx) * f; }
  // --- salto (con "coyote" y "buffer" para que sea indulgente) ---
  const pulsado = !!entrada.salto && !e.saltoPrev; e.saltoPrev = !!entrada.salto;
  e.coyote = e.enSuelo ? 0.1 : Math.max(0, e.coyote - dt); e.buffer = pulsado ? 0.12 : Math.max(0, e.buffer - dt);
  if (e.buffer > 0 && e.coyote > 0) { e.vy = -SALTO; e.buffer = 0; e.coyote = 0; e.enSuelo = false; e.ev.push("salto"); }
  if (!entrada.salto && e.vy < -260) e.vy = -260;
  e.vy = Math.min(VCAIDA, e.vy + GRAV * dt);
  // --- mover en X ---
  e.x += e.vx * dt;
  if (e.x < 0) { e.x = 0; e.vx = 0; }
  let ch = toca(e, e.x, e.y, PW, PH);
  if (ch.length) {
    if (e.vx > 0) e.x = Math.min(...ch.map((t) => t.c)) * T - PW; else if (e.vx < 0) e.x = (Math.max(...ch.map((t) => t.c)) + 1) * T; else e.x -= 0;
    if (ch.some((t) => t.ch === "G") && !e.puertaAbierta && e.avisoT <= 0) { e.aviso = `🚪 La puerta del saber se abre con ${e.puertaNecesita} ${e.puertaNecesita === 1 ? "respuesta correcta" : "respuestas correctas"} (llevas ${Math.min(e.aciertos, e.puertaNecesita)}). ¡Golpea los bloques ❓ desde abajo!`; e.avisoT = 3.2; e.ev.push("puerta_cerrada"); }
    e.vx = 0;
  }
  // --- mover en Y ---
  e.y += e.vy * dt; e.enSuelo = false;
  ch = toca(e, e.x, e.y, PW, PH);
  if (ch.length) {
    if (e.vy > 0) { e.y = Math.min(...ch.map((t) => t.r)) * T - PH; e.enSuelo = true; e.vy = 0; }
    else {
      e.y = (Math.max(...ch.map((t) => t.r)) + 1) * T; e.vy = Math.max(0, e.vy) ; if (e.vy < 40) e.vy = 40;
      const cx = e.x + PW / 2, arriba = ch.filter((t) => t.ch === "?" || t.ch === "u").sort((a, b) => Math.abs(a.c * T + T / 2 - cx) - Math.abs(b.c * T + T / 2 - cx))[0];
      if (arriba) { e.golpe = { c: arriba.c, r: arriba.r, t: 0.18 }; e.ev.push("golpe"); if (arriba.ch === "?" && e.espera <= 0) { e.fase = "pregunta"; e.pend = { c: arriba.c, r: arriba.r }; e.pregunta = sacar(e.cola); e.ev.push("pregunta"); return e; } }
    }
  }
  // un pie firme para reaparecer: si está en el suelo con tierra a ambos lados
  if (e.enSuelo) {
    const pc = Math.floor((e.x + PW / 2) / T), pr = Math.floor((e.y + PH + 1) / T);
    if (SOLIDOS.has(tile(e, pc, pr)) && SOLIDOS.has(tile(e, pc - 1, pr)) && SOLIDOS.has(tile(e, pc + 1, pr)) && !SOLIDOS.has(tile(e, pc, pr - 1))) e.seguro = { x: e.x, y: e.y };
  }
  // --- objetos del mapa: monedas, picos, bandera ---
  const c0 = Math.floor(e.x / T), c1 = Math.floor((e.x + PW - 0.001) / T), r0 = Math.floor(e.y / T), r1 = Math.floor((e.y + PH - 0.001) / T);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const t = tile(e, c, r);
    if (t === "o") { e.grid[r][c] = " "; e.monedas++; e.ev.push("moneda"); }
    else if (t === "^") { const bx = c * T + 4, by = r * T + 16; if (e.x < bx + 24 && e.x + PW > bx && e.y < by + 16 && e.y + PH > by) hacerDanio(e, -e.dir || -1); }
    else if (t === "F") { e.fase = "ganado"; e.ev.push("ganado"); return e; }
  }
  // --- enemigos ---
  for (const n of e.enemigos) {
    if (!n.vivo) continue;
    const adelante = n.vx > 0 ? n.x + n.w + 1 : n.x - 1, fila = Math.floor((n.y + n.h / 2) / T), c = Math.floor(adelante / T), abajo = Math.floor((n.y + n.h + 2) / T);
    if (SOLIDOS.has(tile(e, c, fila)) || !SOLIDOS.has(tile(e, c, abajo))) n.vx = -n.vx; else n.x += n.vx * dt;
    if (e.x < n.x + n.w && e.x + PW > n.x && e.y < n.y + n.h && e.y + PH > n.y) {
      if (e.vy > 0 && e.y + PH - n.y < 16) { n.vivo = false; e.vy = -430; e.pisotones++; e.monedas++; e.ev.push("pisoton"); }
      else hacerDanio(e, n.x > e.x ? -1 : 1);
    }
  }
  // --- la puerta del saber ---
  if (!e.puertaAbierta && e.aciertos >= e.puertaNecesita) {
    e.puertaAbierta = true; for (let r = 0; r < FILAS; r++) for (let c = 0; c < e.ancho; c++) if (e.grid[r][c] === "G") e.grid[r][c] = " "; e.ev.push("puerta_abierta");
  }
  // --- caer al vacío ---
  if (e.y > FILAS * T + 40) { e.corazones--; e.ev.push("danio"); if (e.corazones <= 0) { e.fase = "perdido"; e.ev.push("perdido"); } else reaparecer(e); }
  return e;
}
// Responder la pregunta de un bloque. Acierto: el bloque se gasta y da premio. Error: el bloque sigue ahí para intentarlo de nuevo.
export function responderPlat(e, idx) {
  if (!e || e.fase !== "pregunta" || !e.pregunta) return { ok: false };
  const p = e.pregunta, ok = Number(idx) === p.correcta, b = e.pend;
  const res = { ok, correcta: p.correcta, retro: p.retro || "", pista: p.pista || "" };
  if (ok) { e.aciertos++; e.monedas += 3; if (b) e.grid[b.r][b.c] = "u"; e.ev.push("acierto"); }
  else { e.errores++; e.espera = 1.2; e.ev.push("error"); }
  e.pregunta = null; e.pend = null; e.fase = "jugando"; e.vy = Math.max(e.vy, 60);
  return res;
}
export const resultadoPlat = (e) => ({ juego: "plat", clave: `n${e.nivel}`, aciertos: e.aciertos, errores: e.errores, monedas: e.monedas, corazones: e.corazones, pisotones: e.pisotones, puntos: e.aciertos * 10 + e.monedas + e.pisotones * 2 });
export const estrellasPlat = (e) => (e.errores === 0 && e.corazones === e.corazonesMax ? 3 : e.errores <= 2 && e.corazones >= 2 ? 2 : 1);

// Los premios que se pueden ganar hoy en un juego: [{ clave, nombre }]
export function clavesDeJuego(juego) { return juego === "oca" ? [{ clave: "tablero", nombre: "Llegar a la meta" }] : NOMBRES_NIVEL.map((nombre, i) => ({ clave: `n${i + 1}`, nombre })); }
export const claveValida = (juego, clave) => clavesDeJuego(juego).some((c) => c.clave === clave);
