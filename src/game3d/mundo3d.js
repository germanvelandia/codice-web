// =====================================================================================
//  MUNDO 3D DE CÓDICE — motor en primera persona (WebGL directo, sin librerías).
//  iniciarMundo3D(host, ctx) → { aplicar(filas), seleccionar(item), setCalidad(alta), cerrar() }
//    ctx: {
//      grado,            // grado cuyo mundo se muestra (semilla del terreno)
//      yo,               // id del estudiante (para saber qué bloques son suyos)
//      soloMirar,        // true al visitar otro grado: no se puede picar ni poner
//      vuelo,            // true para el docente observador: vuela sin chocar
//      puertas,          // { bosque: true, montana: false, lago: false } portones abiertos de las zonas
//      alPuerta(zona),   // el jugador llegó a un portón cerrado
//      sonido,           // { volumen, musica, silencio } iniciales
//      alApuntar(info),  // observador: { autor, x, y, z } del bloque que mira (o null)
//      portales,         // [{ id, nombre }] hacia otros mundos (máximo 8)
//      cambios,          // filas [{x,y,z,bloque,autor_id}] ya guardadas
//      cantidad(item),   // cuántos bloques de ese tipo tiene el estudiante
//      picar(x,y,z,b), poner(x,y,z,item)   // devuelven una promesa; si falla se deshace el cambio local
//      alSeleccion(item), alZona(nombre), alPortal(id), alError(texto)
//    }
//  Solo se guardan los cambios de los estudiantes; el terreno se genera igual cada vez con una semilla.
// =====================================================================================

import { crearAmbiente } from "./ambiente3d";
import { crearSonido } from "./sonido3d";
import { ESPECIES, POBLACION } from "./animales3d";

export const SX = 256, SY = 40, SZ = 256, CH = 16, NCX = SX / CH, NCZ = SZ / CH;
export const CENTRO = 128, RADIO_PLAZA = 34, RADIO_ADOQUIN = 12; // la aldea (69 × 69) está protegida; el empedrado de la plaza es de 25 × 25
const AIRE = 0, AGUA = 11, PORTAL = 12, ADOQUIN = 13;

export const NOMBRES = { 1: "Pasto", 2: "Tierra", 3: "Piedra", 4: "Tronco", 5: "Hojas", 6: "Tablones", 7: "Ladrillo", 8: "Cristal", 9: "Arena", 10: "Mineral", 11: "Agua", 12: "Portal", 13: "Adoquín", 14: "Muralla", 15: "Portón" };
export const COLOCABLES = [1, 2, 3, 4, 6, 7, 8, 9];
const DUREZA = { 1: .3, 2: .3, 3: .9, 4: .6, 5: .15, 6: .5, 7: .9, 8: .2, 9: .25, 10: 1.1 };
export const RECETAS = [
  { sale: 6, n: 4, cuesta: { 4: 1 }, txt: "1 tronco → 4 tablones" },
  { sale: 7, n: 2, cuesta: { 3: 2 }, txt: "2 piedra → 2 ladrillos" },
  { sale: 8, n: 2, cuesta: { 9: 2 }, txt: "2 arena → 2 cristales" },
];
// El Cruce de los Mundos (portales a otros cursos) está lejos de la aldea, al sureste.
export const CRUCE = { x: 216, z: 200 };
export const enPlazaProtegida = (x, z) => (Math.abs(x - CENTRO) <= RADIO_PLAZA && Math.abs(z - CENTRO) <= RADIO_PLAZA) || (Math.abs(x - CRUCE.x) <= 14 && Math.abs(z - CRUCE.z) <= 8);

// atlas: 0 pasto arriba, 1 pasto lado, 2 tierra, 3 piedra, 4 tronco lado, 5 tronco arriba, 6 hojas, 7 tablones, 8 ladrillo, 9 cristal, 10 arena, 11 mineral, 12 agua, 13 portal, 14 adoquín
const NT = 17;
function tileDe(b, cara) { // cara: 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z
  switch (b) {
    case 1: return cara === 2 ? 0 : cara === 3 ? 2 : 1;
    case 2: return 2; case 3: return 3;
    case 4: return cara === 2 || cara === 3 ? 5 : 4;
    case 5: return 6; case 6: return 7; case 7: return 8; case 8: return 9; case 9: return 10; case 10: return 11;
    case 11: return 12; case 12: return 13; case 13: return 14; case 14: return 15; case 15: return 16;
  }
  return 3;
}
let _atlas = null;
export function atlasCanvas() {
  if (_atlas) return _atlas;
  const a = document.createElement("canvas"); a.width = 16 * NT; a.height = 16;
  const g = a.getContext("2d"); let s = 11; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const pal = [["#5aa63c", "#6dbb4a", "#3f8a2c"], ["#5aa63c", "#6dbb4a", "#3f8a2c"], ["#8a5a35", "#9a6a42", "#734a2a"], ["#8b8f96", "#9ca0a7", "#767a82"],
    ["#6b4a2b", "#7b5836", "#58391f"], ["#a07a48", "#b08a56", "#8a6638"], ["#2f7d32", "#3f9440", "#256a29"], ["#c8964f", "#d6a661", "#b7843f"],
    ["#b5503c", "#c4604a", "#8f3c2c"], ["#9fd8e8", "#c3ecf7", "#7cc2d6"], ["#dcc58a", "#e8d49c", "#c9b177"], ["#8b8f96", "#9ca0a7", "#767a82"],
    ["#2f6fcf", "#3a7fe0", "#2a62b8"], ["#7a3fd0", "#9a5cf0", "#5b2aa8"], ["#a8a49a", "#b8b4aa", "#948f84"], ["#6a4a26", "#7d5a30", "#5a3d1e"], ["#a77b45", "#b98a52", "#946b39"]];
  for (let t = 0; t < NT; t++) {
    const ox = t * 16;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { g.fillStyle = pal[t][(r() * 3) | 0]; g.fillRect(ox + x, y, 1, 1); }
    if (t === 1) { for (let x = 0; x < 16; x++) { g.fillStyle = ["#8a5a35", "#9a6a42", "#734a2a"][(r() * 3) | 0]; g.fillRect(ox + x, 4, 1, 12); } g.fillStyle = "#6dbb4a"; g.fillRect(ox, 0, 16, 4); g.fillStyle = "#3f8a2c"; for (let x = 0; x < 16; x += 2) g.fillRect(ox + x, 4, 1, 1 + (r() * 2 | 0)); }
    if (t === 4) { g.fillStyle = "#0003"; for (let x = 3; x < 16; x += 5) g.fillRect(ox + x, 0, 1, 16); }
    if (t === 5) { g.strokeStyle = "#58391f"; g.strokeRect(ox + 3.5, 3.5, 9, 9); g.strokeRect(ox + 6.5, 6.5, 3, 3); }
    if (t === 7) { g.fillStyle = "#0003"; for (let y = 3; y < 16; y += 4) g.fillRect(ox, y, 16, 1); }
    if (t === 8) { g.fillStyle = "#e8d8c4"; for (let y = 3; y < 16; y += 4) g.fillRect(ox, y, 16, 1); for (let y = 0; y < 16; y += 4) for (let x = (y / 4 % 2) * 4 + 3; x < 16; x += 8) g.fillRect(ox + x, y, 1, 4); }
    if (t === 9) { g.strokeStyle = "#6fb9cf"; g.strokeRect(ox + .5, .5, 15, 15); g.fillStyle = "#fff"; g.fillRect(ox + 3, 3, 4, 1); g.fillRect(ox + 3, 3, 1, 4); }
    if (t === 11) { g.fillStyle = "#f2c14e"; for (let i = 0; i < 7; i++) g.fillRect(ox + ((r() * 13) | 0) + 1, ((r() * 13) | 0) + 1, 2, 2); }
    if (t === 12) { g.fillStyle = "#ffffff30"; for (let i = 0; i < 5; i++) g.fillRect(ox + ((r() * 12) | 0), ((r() * 14) | 0), 4, 1); }
    if (t === 13) { g.fillStyle = "#e9d8ff"; for (let i = 0; i < 9; i++) g.fillRect(ox + ((r() * 14) | 0), ((r() * 14) | 0), 1, 1); }
    if (t === 14) { g.fillStyle = "#0004"; g.fillRect(ox, 7, 16, 1); g.fillRect(ox + 7, 0, 1, 16); }
    if (t === 15) { g.fillStyle = "#2a1a0a"; for (let x = 3; x < 16; x += 4) g.fillRect(ox + x, 0, 1, 16); g.fillStyle = "#8f6a3a"; for (let x = 0; x < 16; x += 4) g.fillRect(ox + x, 0, 2, 16); g.fillStyle = "#3a3f46"; g.fillRect(ox, 3, 16, 2); g.fillRect(ox, 11, 16, 2); }
    if (t === 16) { g.fillStyle = "#0004"; for (let x = 4; x < 16; x += 4) g.fillRect(ox + x, 0, 1, 16); g.fillStyle = "#3a3f46"; g.fillRect(ox, 2, 16, 3); g.fillRect(ox, 11, 16, 3); g.fillStyle = "#9aa1ab"; for (let x = 2; x < 16; x += 5) { g.fillRect(ox + x, 3, 1, 1); g.fillRect(ox + x, 12, 1, 1); } g.fillStyle = "#d4af37"; g.fillRect(ox + 11, 7, 3, 3); }
  }
  return (_atlas = a);
}
export function dibujarIcono(canvas, item) {
  const c = canvas.getContext("2d"); c.imageSmoothingEnabled = false; c.clearRect(0, 0, canvas.width, canvas.height);
  c.drawImage(atlasCanvas(), (item === 1 ? 1 : tileDe(item, 0)) * 16, 0, 16, 16, 0, 0, canvas.width, canvas.height);
}

// ---------- terreno ----------
const hashTxt = (s) => { let h = 2166136261 >>> 0; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
function ruidoV(seed, x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const h = (a, b) => { let n = Math.imul((a * 374761393 + b * 668265263 + seed) | 0, 1274126177); n = (n ^ (n >>> 13)) >>> 0; n = Math.imul(n, 1274126177) >>> 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const sm = (t) => t * t * (3 - 2 * t);
  const a = h(xi, zi), b = h(xi + 1, zi), c = h(xi, zi + 1), d = h(xi + 1, zi + 1), u = sm(xf), v = sm(zf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const MONTE = { x: 208, z: 48, r: 52 }, LAGO = { x: 128, z: 214, r: 34 };
// Caminos de adoquín que salen de la plaza hacia cada terreno del reino: [nombre, puntos]
export const CAMINOS = [
  ["🌲 Bosque de la Curiosidad", [[116, 118], [116, 96], [96, 80], [70, 66], [58, 58]]],
  ["⛰️ Montaña del Esfuerzo", [[140, 118], [140, 96], [160, 80], [184, 68], [200, 62]]],
  ["🏞️ Lago y muelle", [[128, 141], [128, 166], [128, 184]]],
  ["🌀 Cruce de los Mundos", [[142, 142], [172, 150], [198, 176], [206, 196]]],
];
function distSeg(x, z, a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)); return Math.hypot(x - (a[0] + t * dx), z - (a[1] + t * dz)); }
function distCamino(x, z) { let d = 1e9; for (const [, pts] of CAMINOS) for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distSeg(x, z, pts[i], pts[i + 1])); return d; }
function altura(x, z, seed) {
  const n = ruidoV(seed, x * .06, z * .06) * .6 + ruidoV(seed + 1, x * .15, z * .15) * .3 + ruidoV(seed + 2, x * .4, z * .4) * .1;
  let h = 13 + (n - .5) * 5; // el campo queda siempre sobre el nivel del agua (solo hay agua en el lago)
  const md = Math.hypot(x - MONTE.x, z - MONTE.z), mt = Math.max(0, 1 - md / MONTE.r);
  h += mt * mt * (3 - 2 * mt) * 24 * (.75 + .5 * ruidoV(seed + 3, x * .09, z * .09));
  const ld = Math.hypot((x - LAGO.x) * .8, z - LAGO.z), lg = Math.max(0, 1 - ld / LAGO.r);
  h -= lg * lg * (3 - 2 * lg) * 8;
  const e = Math.max(Math.abs(x - CENTRO), Math.abs(z - CENTRO)), f = Math.min(1, Math.max(0, (e - RADIO_PLAZA) / 14)), ff = f * f * (3 - 2 * f);
  h = 12 + (h - 12) * ff;
  const ex = Math.max(0, Math.abs(x - CRUCE.x) - 16), ez = Math.max(0, Math.abs(z - CRUCE.z) - 10), pe = Math.max(ex, ez), pf = Math.min(1, pe / 8), pff = pf * pf * (3 - 2 * pf);
  h = 12 + (h - 12) * pff;
  const dr = distCamino(x, z), fr = Math.min(1, Math.max(0, (dr - 2) / 6)), frr = fr * fr * (3 - 2 * fr); // los caminos van parejos
  h = 12 + (h - 12) * frr;
  return Math.max(2, Math.min(SY - 8, Math.round(h)));
}
export function zonaDe(x, z) {
  if (Math.abs(x - CRUCE.x) <= 16 && Math.abs(z - CRUCE.z) <= 10) return "Cruce de los Mundos";
  if (Math.max(Math.abs(x - CENTRO), Math.abs(z - CENTRO)) <= RADIO_PLAZA + 3) return "Aldea del Códice";
  if (Math.hypot(x - MONTE.x, z - MONTE.z) < MONTE.r) return "Montaña del Esfuerzo";
  if (Math.hypot((x - LAGO.x) * .8, z - LAGO.z) < LAGO.r + 3) return "Lago";
  if (x < 110 && z < 110) return "Bosque de la Curiosidad";
  return "Campos de Oakhaven";
}


// ---------- la aldea: edificios con su lugar (las claves son las mismas del Mundo 2D) ----------
export const EDIFICIOS = [
  { key: "biblioteca", nombre: "Biblioteca", emoji: "📚", cx: 106, cz: 106, pared: 7 },
  { key: "agora", nombre: "Ágora de la Ética", emoji: "⚖️", cx: 128, cz: 102, pared: 3 },
  { key: "templo", nombre: "Templo de la Gratitud", emoji: "🕊️", cx: 150, cz: 106, pared: 9 },
  { key: "mercado", nombre: "Mercado del Códice", emoji: "🛒", cx: 102, cz: 128, pared: 6 },
  { key: "acertijos", nombre: "Casa de los Acertijos", emoji: "🧩", cx: 154, cz: 128, pared: 7 },
  { key: "comarca", nombre: "Sala de la Comarca", emoji: "🏰", cx: 106, cz: 152, pared: 3 },
  { key: "posada", nombre: "Posada del Descanso", emoji: "🛏️", cx: 150, cz: 152, pared: 6 },
];
// Puntos de interés al aire libre (mismas claves de lugar que el Mundo 2D): [x, z, nombre]
export const PUNTOS = {
  claro: [62, 62, "Claro del Bosque"], arroyo: [90, 84, "Arroyo Cantarino"], mirador: [40, 96, "Mirador"], campamento: [92, 40, "Campamento del Ermitaño"],
  cascada: [28, 70, "Cascada Escondida"], roble: [64, 26, "Gran Roble"], ruinas: [22, 22, "Ruinas Antiguas"],
  sendero: [184, 68, "Sendero de Piedra"], cueva: [232, 84, "Cueva del Eco"], cumbre: [208, 48, "Cumbre"],
  orilla: [100, 184, "Orilla"], muelle: [128, 188, "Muelle"], isla: [128, 214, "Isla Serena"],
  // guardianes de cada zona (duelo para ganar la insignia)
  guardia_aldea: [138, 122, "Guardiana de la Aldea"], guardia_bosque: [67, 72, "Guardia del Bosque"], guardia_montana: [188, 72, "Guardia de la Montaña"], guardia_lago: [124, 178, "Guardia del Lago"],
};
// De qué lado está la puerta (mirando a la plaza)
function ladoPuerta(e) { const dx = CENTRO - e.cx, dz = CENTRO - e.cz; return Math.abs(dx) > Math.abs(dz) ? { eje: "x", sg: Math.sign(dx) } : { eje: "z", sg: Math.sign(dz) }; }

// ---------- portales (en el Cruce de los Mundos, lejos de la aldea) ----------
// Marco de 4 de ancho × 5 de alto, hueco de 2 × 3. Dos filas sobre una plataforma de piedra.
export function posicionesPortales(n) {
  const xs = [-10, -4, 2, 8].map((o) => CRUCE.x + o), res = [];
  for (let i = 0; i < Math.min(8, n); i++) res.push({ x: xs[i % 4], z: CRUCE.z + (i < 4 ? -4 : 4), y: 13 });
  return res;
}

export function iniciarMundo3D(host, ctx) {
  let vivo = true;
  const mundo = new Uint8Array(SX * SY * SZ);
  let ultApuntado = "";
  const autores = new Map(); // "x,y,z" → autor_id de los bloques cambiados
  const idx = (x, y, z) => (y * SZ + z) * SX + x;
  const get = (x, y, z) => (x < 0 || x >= SX || z < 0 || z >= SZ || y < 0) ? (y < 0 ? 3 : 0) : (y >= SY ? 0 : mundo[idx(x, y, z)]);
  const esHueco = (b) => b === AIRE || b === AGUA || b === PORTAL;     // no choca
  const solido = (x, y, z) => { if (y < 0 || x < 0 || x >= SX || z < 0 || z >= SZ) return true; return !esHueco(get(x, y, z)); };
  const sucios = new Set(); const chunks = [];

  // ----- generar -----
  const semilla = hashTxt("codice-" + ctx.grado) | 0;
  let sem = (semilla >>> 0) || 1; const rnd = () => { sem = (Math.imul(sem, 1664525) + 1013904223) >>> 0; return sem / 4294967296; };
  const alt = new Int16Array(SX * SZ);
  for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
    const h = altura(x, z, semilla); alt[z * SX + x] = h;
    const enPlaza = Math.max(Math.abs(x - CENTRO), Math.abs(z - CENTRO)) <= RADIO_ADOQUIN, nearLago = Math.hypot((x - LAGO.x) * .8, z - LAGO.z) < LAGO.r + 3;
    const enCamino = distCamino(x, z) <= 1.5; // los caminos son de adoquín
    for (let y = 0; y <= h; y++) {
      let b;
      if (y === h) b = (enPlaza || enCamino) ? ADOQUIN : (nearLago && h <= 12) ? 9 : (h >= 30 ? 3 : 1);
      else if (y >= h - 3) b = (nearLago && h <= 12) ? 9 : (h >= 30 ? 3 : 2);
      else { b = 3; if (y > 1 && y < h - 5 && rnd() < .03) b = 10; }
      mundo[idx(x, y, z)] = b;
    }
    for (let y = h + 1; y <= 11; y++) mundo[idx(x, y, z)] = AGUA;
  }
  for (let i = 0; i < 50; i++) { // cuevas
    let cx = (rnd() * SX) | 0, cy = 4 + ((rnd() * 8) | 0), cz = (rnd() * SZ) | 0; const r = 2;
    for (let k = 0; k < 18; k++) {
      for (let dz = -r; dz <= r; dz++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy + dz * dz <= r * r) { const x = cx + dx, y = cy + dy, z = cz + dz; if (x > 0 && x < SX - 1 && z > 0 && z < SZ - 1 && y > 1 && y < alt[z * SX + x] - 3 && !enPlazaProtegida(x, z)) mundo[idx(x, y, z)] = AIRE; }
      }
      cx += ((rnd() * 3) | 0) - 1; cy += ((rnd() * 3) | 0) - 1; cz += ((rnd() * 3) | 0) - 1;
    }
  }
  for (let z = 3; z < SZ - 3; z++) for (let x = 3; x < SX - 3; x++) { // árboles (más densos en el bosque)
    const a = alt[z * SX + x]; if (mundo[idx(x, a, z)] !== 1) continue;
    if (Math.max(Math.abs(x - CENTRO), Math.abs(z - CENTRO)) < RADIO_PLAZA + 6) continue;
    if (Math.abs(x - CRUCE.x) < 20 && Math.abs(z - CRUCE.z) < 14) continue;
    if (distCamino(x, z) < 4) continue;
    const p = zonaDe(x, z) === "Bosque de la Curiosidad" ? .035 : .004;
    if (rnd() < p) {
      const t = 4 + ((rnd() * 2) | 0);
      for (let k = 1; k <= t; k++) mundo[idx(x, a + k, z)] = 4;
      for (let dy = -2; dy <= 1; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) <= 3) { const xx = x + dx, yy = a + t + dy, zz = z + dz; if (yy < SY && !mundo[idx(xx, yy, zz)]) mundo[idx(xx, yy, zz)] = 5; }
      }
    }
  }
  // el Cruce de los Mundos: plataforma de adoquín y un camino que sale de la aldea
  const portalesZona = []; const etiquetas = [];
  for (let dz = -6; dz <= 6; dz++) for (let dx = -12; dx <= 12; dx++) { const x = CRUCE.x + dx, z = CRUCE.z + dz; mundo[idx(x, 12, z)] = ADOQUIN; for (let y = 13; y <= 19; y++) mundo[idx(x, y, z)] = AIRE; }
  // letreros en cada camino (donde sale de la aldea) y el letrero del Cruce
  for (const [nombre, pts] of CAMINOS) {
    let px = pts[0][0], pz = pts[0][1];
    outer: for (let k = 0; k < pts.length - 1; k++) { const [x0, z0] = pts[k], [x1, z1] = pts[k + 1], n = Math.ceil(Math.hypot(x1 - x0, z1 - z0)); for (let i = 0; i <= n; i++) { px = Math.round(x0 + (x1 - x0) * i / n); pz = Math.round(z0 + (z1 - z0) * i / n); if (Math.max(Math.abs(px - CENTRO), Math.abs(pz - CENTRO)) >= RADIO_PLAZA + 3) break outer; } }
    const sx = px + 3, a0 = alt[pz * SX + sx]; for (let k = 1; k <= 3; k++) mundo[idx(sx, a0 + k, pz)] = 4; mundo[idx(sx, a0 + 4, pz)] = 6;
    etiquetas.push({ x: sx + .5, y: a0 + 5.6, z: pz + .5, texto: nombre, clase: "edif" });
  }
  etiquetas.push({ x: CRUCE.x + .5, y: 20.5, z: CRUCE.z + .5, texto: "🌀 Cruce de los Mundos", clase: "edif" });
  // portales
  posicionesPortales((ctx.portales || []).length).forEach((p, i) => {
    const info = ctx.portales[i];
    for (let dx = 0; dx < 4; dx++) for (let dy = 0; dy < 5; dy++) {
      const borde = dx === 0 || dx === 3 || dy === 0 || dy === 4;
      mundo[idx(p.x + dx, p.y + dy, p.z)] = borde ? 7 : PORTAL;
    }
    portalesZona.push({ ...p, id: info.id, nombre: info.nombre });
    etiquetas.push({ x: p.x + 2, y: p.y + 5.6, z: p.z + .5, texto: info.nombre });
  });

  // edificios de la aldea (9 × 9, paredes de 5 de alto, techo, puerta de 3 × 3 hacia la plaza, ventanas de cristal)
  for (const e of EDIFICIOS) {
    const d = ladoPuerta(e), y0 = 12;
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
      const x = e.cx + dx, z = e.cz + dz, borde = Math.abs(dx) === 4 || Math.abs(dz) === 4;
      mundo[idx(x, y0, z)] = 6;
      for (let y = y0 + 1; y <= y0 + 5; y++) mundo[idx(x, y, z)] = borde ? e.pared : AIRE;
      mundo[idx(x, y0 + 6, z)] = 6;
      if (Math.abs(dx) <= 3 && Math.abs(dz) <= 3) mundo[idx(x, y0 + 7, z)] = 6;
    }
    for (let o = -1; o <= 1; o++) for (let y = y0 + 1; y <= y0 + 3; y++) {
      const x = d.eje === "x" ? e.cx + d.sg * 4 : e.cx + o, z = d.eje === "x" ? e.cz + o : e.cz + d.sg * 4; mundo[idx(x, y, z)] = AIRE;
    }
    for (const o of [-2, 2]) for (const y of [y0 + 2, y0 + 3]) {
      if (d.eje === "x") { mundo[idx(e.cx - d.sg * 4, y, e.cz + o)] = 8; mundo[idx(e.cx + o, y, e.cz - 4)] = 8; mundo[idx(e.cx + o, y, e.cz + 4)] = 8; }
      else { mundo[idx(e.cx + o, y, e.cz - d.sg * 4)] = 8; mundo[idx(e.cx - 4, y, e.cz + o)] = 8; mundo[idx(e.cx + 4, y, e.cz + o)] = 8; }
    }
    mundo[idx(e.cx, y0 + 1, e.cz)] = 6; mundo[idx(e.cx + 1, y0 + 1, e.cz)] = 6; // una mesa al centro
    etiquetas.push({ x: e.cx + .5, y: y0 + 9.2, z: e.cz + .5, texto: e.emoji + " " + e.nombre, clase: "edif" });
  }
  for (let z = LAGO.z - 30; z <= LAGO.z - 12; z++) for (let x = LAGO.x - 1; x <= LAGO.x + 1; x++) { mundo[idx(x, 12, z)] = 6; for (let y = 13; y <= 16; y++) mundo[idx(x, y, z)] = AIRE; } // el muelle
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) if (dx * dx + dz * dz <= 10) { // la isla del lago
    const x = LAGO.x + dx, z = LAGO.z + dz; for (let y = 1; y <= 12; y++) if (!mundo[idx(x, y, z)] || mundo[idx(x, y, z)] === AGUA) mundo[idx(x, y, z)] = 9;
  }

  // ----- personajes (NPC) -----
  let npcs = [];
  // el suelo firme más cercano a un punto (nunca agua, árboles ni huecos): ahí se paran los personajes al aire libre
  function firme(x0, z0) {
    for (let r = 0; r <= 10; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const x = x0 + dx, z = z0 + dz; if (x < 2 || z < 2 || x >= SX - 2 || z >= SZ - 2) continue;
      let y = SY - 3; while (y > 0 && !mundo[idx(x, y, z)]) y--;
      if (y >= 12 && [1, 2, 3, 6, 9, 13].includes(mundo[idx(x, y, z)]) && !mundo[idx(x, y + 1, z)] && !mundo[idx(x, y + 2, z)]) return { x: x + .5, z: z + .5, y: y + 1 };
    }
    return { x: x0 + .5, z: z0 + .5, y: 13 };
  }
  function posNpc(lista) {
    const porLugar = {};
    for (const n of lista) (porLugar[n.lugar || "plaza"] = porLugar[n.lugar || "plaza"] || []).push(n);
    const res = [];
    for (const [lugar, ns] of Object.entries(porLugar)) {
      ns.forEach((n, i) => {
        let x, z, y = 13; const ed = EDIFICIOS.find((e) => e.key === lugar);
        if (ed) {
          const d = ladoPuerta(ed), o = ns.length === 1 ? 0 : -2.5 + (5 * i) / (ns.length - 1), fondo = -d.sg * 3;
          x = d.eje === "x" ? ed.cx + fondo + .5 : ed.cx + o + .5; z = d.eje === "x" ? ed.cz + o + .5 : ed.cz + fondo + .5;
        } else if (lugar === "plaza" || !PUNTOS[lugar]) { const a = (i / Math.max(1, ns.length)) * Math.PI * 2 + .6; x = CENTRO + .5 + Math.cos(a) * 6; z = CENTRO + .5 + Math.sin(a) * 6 - 1; }
        else {
          const pt = PUNTOS[lugar], f = firme(pt[0] + i * 2, pt[1]); x = f.x; z = f.z; y = f.y;
        }
        res.push({ ...n, x, y, z, r: ed ? (ns.length > 3 ? .8 : 1.5) : lugar === "plaza" || !PUNTOS[lugar] ? 2.5 : 2 });
      });
    }
    return res;
  }
  npcs = posNpc(ctx.npcs || []);
  // en lugares al aire libre, cada punto de interés lleva un letrero
  const lugaresConNpc = [...new Set(npcs.map((n) => n.lugar))].filter((l) => PUNTOS[l]);
  lugaresConNpc.forEach((l) => { const p = PUNTOS[l]; etiquetas.push({ x: p[0] + .5, y: (alt[p[1] * SX + p[0]] || 12) + 3.6, z: p[1] + .5, texto: "📍 " + p[2], clase: "edif" }); });

  // ----- cambios guardados -----
  // ----- murallas y portones de las zonas -----
  // Cada zona (Bosque, Montaña, Lago) está rodeada por una muralla de 3 bloques; solo se cruza por el portón del camino.
  // El portón se abre cuando la zona está desbloqueada para el estudiante. Nadie puede construir cerca de los muros.
  const CLAVE_ZONA = { "Bosque de la Curiosidad": "bosque", "Montaña del Esfuerzo": "montana", "Lago": "lago" };
  const NOMBRE_ZONA = { bosque: "Bosque de la Curiosidad", montana: "Montaña del Esfuerzo", lago: "Lago de la Reflexión" };
  const fijo = new Uint8Array(SX * SZ), veda = new Uint8Array(SX * SZ);
  const puertasZona = {}, antorchas = [], flores = [];
  {
    const zi = new Uint8Array(SX * SZ), CODIGOS = { bosque: 1, montana: 2, lago: 3 }, NOMBRES_Z = [null, "bosque", "montana", "lago"];
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) zi[z * SX + x] = CODIGOS[CLAVE_ZONA[zonaDe(x, z)]] || 0;
    const zAt = (x, z) => (x < 0 || x >= SX || z < 0 || z >= SZ ? -1 : zi[z * SX + x]);
    const bordes = [], puerta = new Set();
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      const k = zi[z * SX + x]; if (!k) continue; let borde = false;
      for (let dz = -1; dz <= 1 && !borde; dz++) for (let dx = -1; dx <= 1; dx++) { const o = zAt(x + dx, z + dz); if (o >= 0 && o !== k) { borde = true; break; } }
      if (borde) { bordes.push([x, z, k]); if (distCamino(x, z) <= 2.6) puerta.add(x + "," + z); }
    }
    const altMax = (x, z) => { let m = 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, zz = z + dz; if (xx >= 0 && xx < SX && zz >= 0 && zz < SZ) m = Math.max(m, alt[zz * SX + xx]); } return m; };
    for (const [x, z, k] of bordes) {
      const a = alt[z * SX + x], clave = NOMBRES_Z[k]; fijo[z * SX + x] = 1;
      if (puerta.has(x + "," + z)) {
        const p = puertasZona[clave] || (puertasZona[clave] = { celdas: [], sx: 0, sz: 0, sy: 0, abierta: false, init: false, nombre: NOMBRE_ZONA[clave], et: -1 });
        p.celdas.push([x, a + 1, z]); p.sx += x + .5; p.sz += z + .5; p.sy = Math.max(p.sy, a);
        for (let y = a + 1; y <= a + 3; y++) mundo[idx(x, y, z)] = 15;
        mundo[idx(x, a + 4, z)] = 6; mundo[idx(x, a + 5, z)] = 4;
      } else {
        let pilar = false; for (let dz = -1; dz <= 1 && !pilar; dz++) for (let dx = -1; dx <= 1; dx++) if (puerta.has((x + dx) + "," + (z + dz))) { pilar = true; break; }
        if (pilar) { for (let y = a + 1; y <= a + 7; y++) mundo[idx(x, y, z)] = 7; mundo[idx(x, a + 8, z)] = 3; antorchas.push([x + .5, a + 8.9, z + .5]); }
        else for (let y = a + 1; y <= altMax(x, z) + 3; y++) mundo[idx(x, y, z)] = 14;
      }
    }
    for (const k in puertasZona) { const p = puertasZona[k], n = p.celdas.length; p.cx = p.sx / n; p.cz = p.sz / n; etiquetas.push({ x: p.cx, y: p.sy + 8.2, z: p.cz, texto: "🔒 " + p.nombre, clase: "edif" }); p.et = etiquetas.length - 1; }
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) if (fijo[z * SX + x]) for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { const xx = x + dx, zz = z + dz; if (xx >= 0 && xx < SX && zz >= 0 && zz < SZ) veda[zz * SX + xx] = 1; }
    // antorchas en las esquinas de la plaza y junto a cada puerta de edificio
    for (const [dx, dz] of [[-13, -13], [13, -13], [-13, 13], [13, 13]]) { const x = CENTRO + dx, z = CENTRO + dz; antorchas.push([x + .5, alt[z * SX + x] + 1, z + .5]); }
    for (const e of EDIFICIOS) { const d = ladoPuerta(e), x = e.cx + (d.eje === "x" ? d.sg * 5 : 3), z = e.cz + (d.eje === "z" ? d.sg * 5 : 3); antorchas.push([x + .5, alt[z * SX + x] + 1, z + .5]); }
    // flores silvestres, en grupos, sobre el pasto
    let s4 = ((semilla ^ 0x2c1b3c6d) >>> 0) || 9; const r4 = () => { s4 = (Math.imul(s4, 1664525) + 1013904223) >>> 0; return s4 / 4294967296; };
    const COLS = [[.86, .15, .15], [.98, .82, .15], [.35, .45, .95], [.95, .5, .75], [.97, .97, .95], [.72, .3, .85]];
    for (let g = 0; g < 70; g++) {
      const gx = 6 + r4() * (SX - 12), gz = 6 + r4() * (SZ - 12), col = COLS[(r4() * COLS.length) | 0];
      for (let i = 0; i < 6; i++) {
        const x = Math.floor(gx + (r4() - .5) * 7), z = Math.floor(gz + (r4() - .5) * 7); if (x < 2 || z < 2 || x >= SX - 2 || z >= SZ - 2) continue;
        const a = alt[z * SX + x]; if (mundo[idx(x, a, z)] !== 1 || mundo[idx(x, a + 1, z)] !== AIRE || veda[z * SX + x] || distCamino(x, z) < 2.5) continue;
        flores.push({ x: x + .2 + r4() * .6, y: a + 1, z: z + .2 + r4() * .6, bx: x, bz: z, col: i % 4 === 3 ? COLS[(r4() * COLS.length) | 0] : col, ph: r4() * 6.28 });
      }
    }
  }
  function setPuertas(m) {
    for (const k in puertasZona) {
      const p = puertasZona[k], abre = !!(m && m[k]); if (p.init && abre === p.abierta) continue;
      const cambio = p.init && abre; p.abierta = abre; p.init = true;
      for (const [x, y0, z] of p.celdas) { for (let y = y0; y < y0 + 3; y++) mundo[idx(x, y, z)] = abre ? AIRE : 15; marcar(x, z); }
      const el = capaEt[p.et]; if (el) el.textContent = (abre ? "🔓 " : "🔒 ") + p.nombre;
      if (cambio && Math.hypot(p.cx - jug.x, p.cz - jug.z) < 40) sonido.abrirPuerta();
    }
  }
  let esperaPuerta = 0;
  function vigilarPuertas(dt) {
    esperaPuerta = Math.max(0, esperaPuerta - dt); if (esperaPuerta > 0 || ctx.vuelo) return;
    for (const k in puertasZona) { const p = puertasZona[k]; if (!p.abierta && Math.hypot(p.cx - jug.x, p.cz - jug.z) < 6.5 && Math.abs(p.sy + 1 - jug.y) < 6) { esperaPuerta = 6; sonido.puertaCerrada(); try { ctx.alPuerta && ctx.alPuerta(k); } catch (_) {} break; } }
  }

  function aplicar(filas, noMarcar) {
    for (const f of filas || []) {
      if (f.x < 0 || f.x >= SX || f.z < 0 || f.z >= SZ || f.y < 0 || f.y >= SY) continue;
      if (fijo[f.z * SX + f.x]) continue; // los muros y portones de las zonas no se pueden cambiar
      mundo[idx(f.x, f.y, f.z)] = f.bloque; autores.set(f.x + "," + f.y + "," + f.z, f.autor_id);
      if (!noMarcar) marcar(f.x, f.z);
    }
  }
  const marcar = (x, z) => {
    const cx = Math.floor(x / CH), cz = Math.floor(z / CH); sucios.add(cz * NCX + cx);
    if (x % CH === 0 && cx > 0) sucios.add(cz * NCX + cx - 1); if (x % CH === CH - 1 && cx < NCX - 1) sucios.add(cz * NCX + cx + 1);
    if (z % CH === 0 && cz > 0) sucios.add((cz - 1) * NCX + cx); if (z % CH === CH - 1 && cz < NCZ - 1) sucios.add((cz + 1) * NCX + cx);
  };
  aplicar(ctx.cambios, true);

  // ----- DOM -----
  const estilo = document.createElement("style");
  estilo.textContent = `.m3d{position:relative;width:100%;overflow:hidden;background:#000;touch-action:none;user-select:none;-webkit-user-select:none;border-radius:8px}
.m3d canvas{display:block;width:100%;aspect-ratio:16/9;cursor:crosshair;touch-action:none}
.m3d-full .m3d{height:100vh;height:100dvh;border-radius:0}.m3d-full .m3d canvas{height:100%;aspect-ratio:auto}
.m3d-mira{position:absolute;left:50%;top:50%;width:18px;height:18px;transform:translate(-50%,-50%);pointer-events:none}
.m3d-mira:before,.m3d-mira:after{content:"";position:absolute;background:#fff;mix-blend-mode:difference}
.m3d-mira:before{left:8px;top:0;width:2px;height:18px}.m3d-mira:after{top:8px;left:0;height:2px;width:18px}
.m3d-ayuda{position:absolute;left:0;right:0;bottom:10px;text-align:center;pointer-events:none;font:12px monospace;color:#fff;text-shadow:0 1px 3px #000}
.m3d-et{position:absolute;left:0;top:0;transform:translate(-50%,-100%);font:600 12px system-ui,sans-serif;color:#fff;background:#4b2a8fcc;padding:2px 8px;border-radius:10px;pointer-events:none;white-space:nowrap}
.m3d-joy{position:absolute;left:14px;bottom:14px;width:110px;height:110px;border-radius:50%;border:2px solid #fff5;background:#0003;display:none;pointer-events:none}
.m3d-joy i{position:absolute;left:35px;top:35px;width:40px;height:40px;border-radius:50%;background:#fff7}
.m3d-acc{position:absolute;right:12px;bottom:12px;display:none;gap:8px;flex-direction:column}
.m3d-acc button{width:64px;height:46px;border-radius:10px;border:2px solid #fff6;background:#0007;color:#fff;font:12px monospace;touch-action:none}
.m3d-et.edif{background:#14532dcc;font-size:13px}
.m3d-npc{position:absolute;left:0;top:0;transform:translate(-50%,-100%);font:600 12px system-ui,sans-serif;color:#fff;background:#92400ecc;padding:2px 8px;border-radius:10px;pointer-events:none;white-space:nowrap}
.m3d-npc.ok{background:#166534cc}
.m3d-hablar{position:absolute;left:50%;bottom:44px;transform:translateX(-50%);font:600 13px system-ui,sans-serif;color:#fff;background:#000a;border:1px solid #fff6;padding:6px 12px;border-radius:10px;pointer-events:none;display:none}
.m3d-acc button.hab{display:none;background:#b45309cc}
@media (pointer:coarse){.m3d-joy{display:block}.m3d-acc{display:flex}.m3d-hablar{display:none!important}}`;
  const raiz = document.createElement("div"); raiz.className = "m3d";
  const cv = document.createElement("canvas"); cv.width = 800; cv.height = 450; cv.setAttribute("aria-label", "Mundo 3D de bloques");
  const mira = document.createElement("div"); mira.className = "m3d-mira";
  const ayuda = document.createElement("div"); ayuda.className = "m3d-ayuda"; ayuda.textContent = "Haz clic para jugar";
  const joyEl = document.createElement("div"); joyEl.className = "m3d-joy"; joyEl.innerHTML = "<i></i>";
  const acc = document.createElement("div"); acc.className = "m3d-acc";
  acc.innerHTML = '<button data-k="salto">SALTAR</button><button data-k="picar">PICAR</button><button data-k="poner">PONER</button><button data-k="hablar" class="hab">HABLAR</button>';
  const hablarEl = document.createElement("div"); hablarEl.className = "m3d-hablar";
  raiz.append(estilo, cv, mira, ayuda, joyEl, acc, hablarEl);
  const btnHab = acc.querySelector(".hab");
  const capaEt = etiquetas.map((e) => { const d = document.createElement("div"); d.className = "m3d-et" + (e.clase ? " " + e.clase : ""); d.textContent = (e.clase ? "" : "🌀 ") + e.texto; d.style.display = "none"; raiz.append(d); return d; });
  host.append(raiz);

  // ----- WebGL -----
  const gl = cv.getContext("webgl", { antialias: false, alpha: false });
  if (!gl) { raiz.innerHTML = '<div style="padding:24px;text-align:center;color:#98a0ad">Tu navegador no permite gráficos 3D (WebGL). Prueba con otro navegador.</div>'; return { aplicar() {}, seleccionar() {}, setCalidad() {}, cerrar() { raiz.remove(); } }; }
  const prog = (vs, fs) => { const p = gl.createProgram(); for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); gl.attachShader(p, sh); } gl.linkProgram(p); return p; };
  const P = prog("attribute vec3 p;attribute vec2 u;attribute float s;uniform mat4 m;varying vec2 vu;varying float vs;varying float vd;void main(){vec4 q=m*vec4(p,1.0);gl_Position=q;vu=u;vs=s;vd=q.w;}",
    "precision mediump float;uniform sampler2D t;uniform vec3 cn;uniform vec3 lc;uniform vec2 fg;varying vec2 vu;varying float vs;varying float vd;void main(){vec4 c=texture2D(t,vu);float f=clamp((vd-fg.x)/fg.y,0.0,1.0);gl_FragColor=vec4(mix(c.rgb*vs*lc,cn,f),1.0);}");
  const PL = prog("attribute vec3 p;uniform mat4 m;void main(){gl_Position=m*vec4(p,1.0);}", "precision mediump float;void main(){gl_FragColor=vec4(1.0);}");
  const loc = { p: gl.getAttribLocation(P, "p"), u: gl.getAttribLocation(P, "u"), s: gl.getAttribLocation(P, "s"), m: gl.getUniformLocation(P, "m"), t: gl.getUniformLocation(P, "t"), cn: gl.getUniformLocation(P, "cn"), lc: gl.getUniformLocation(P, "lc"), fg: gl.getUniformLocation(P, "fg") };
  const locL = { p: gl.getAttribLocation(PL, "p"), m: gl.getUniformLocation(PL, "m") };
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas());
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
  gl.getExtension("OES_element_index_uint");
  const CARAS = [
    { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: .8 }, { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: .8 },
    { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1 }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: .5 },
    { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: .9 }, { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: .7 },
  ];
  const UVC = [[0, 1], [1, 1], [1, 0], [0, 0]];
  const transparente = (b) => b === AIRE || b === 8 || b === AGUA || b === PORTAL;
  function construir(cx, cz) {
    const pos = [], uv = [], sh = [], ind = []; let n = 0;
    for (let z = cz * CH; z < cz * CH + CH; z++) for (let x = cx * CH; x < cx * CH + CH; x++) for (let y = 0; y < SY; y++) {
      const b = mundo[idx(x, y, z)]; if (!b) continue;
      for (let f = 0; f < 6; f++) {
        const c = CARAS[f], nb = get(x + c.n[0], y + c.n[1], z + c.n[2]);
        if (!transparente(nb) || nb === b) continue;
        const t = tileDe(b, f), u0 = t / NT + .0005, u1 = (t + 1) / NT - .0005, dy = b === AGUA && f === 2 ? -.12 : 0;
        for (let k = 0; k < 4; k++) { pos.push(x + c.c[k][0], y + c.c[k][1] + (c.c[k][1] ? dy : 0), z + c.c[k][2]); uv.push(UVC[k][0] ? u1 : u0, UVC[k][1] ? .999 : .001); sh.push(c.s); }
        ind.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4;
      }
    }
    let ch = chunks[cz * NCX + cx]; if (!ch) ch = chunks[cz * NCX + cx] = { pb: gl.createBuffer(), ub: gl.createBuffer(), sb: gl.createBuffer(), ib: gl.createBuffer(), n: 0 };
    gl.bindBuffer(gl.ARRAY_BUFFER, ch.pb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, ch.ub); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, ch.sb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sh), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ch.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(ind), gl.STATIC_DRAW);
    ch.n = ind.length;
  }
  for (let cz = 0; cz < NCZ; cz++) for (let cx = 0; cx < NCX; cx++) construir(cx, cz);
  const cajaB = gl.createBuffer();
  { const e = .002, a = -e, b = 1 + e; const v = [[a, a, a], [b, a, a], [b, a, a], [b, a, b], [b, a, b], [a, a, b], [a, a, b], [a, a, a], [a, b, a], [b, b, a], [b, b, a], [b, b, b], [b, b, b], [a, b, b], [a, b, b], [a, b, a], [a, a, a], [a, b, a], [b, a, a], [b, b, a], [b, a, b], [b, b, b], [a, a, b], [a, b, b]];
    gl.bindBuffer(gl.ARRAY_BUFFER, cajaB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v.flat()), gl.STATIC_DRAW); }

  // ----- personajes: aldeanos de bloques, con cuerpo y movimiento -----
  const PC = prog("attribute vec3 p;attribute float s;uniform mat4 m;uniform vec3 c;varying vec3 vc;varying float vd;void main(){vec4 q=m*vec4(p,1.0);gl_Position=q;vc=c*s;vd=q.w;}",
    "precision mediump float;uniform vec3 cn;uniform vec3 lc;uniform vec2 fg;varying vec3 vc;varying float vd;void main(){float f=clamp((vd-fg.x)/fg.y,0.0,1.0);gl_FragColor=vec4(mix(vc*lc,cn,f),1.0);}");
  const locC = { p: gl.getAttribLocation(PC, "p"), s: gl.getAttribLocation(PC, "s"), m: gl.getUniformLocation(PC, "m"), c: gl.getUniformLocation(PC, "c"), cn: gl.getUniformLocation(PC, "cn"), lc: gl.getUniformLocation(PC, "lc"), fg: gl.getUniformLocation(PC, "fg") };
  const cuboB = gl.createBuffer();
  { const d = [], sh = [.8, .8, 1, .55, .9, .7], Q = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
    for (let a = 0; a < 3; a++) for (let sg = -1; sg <= 1; sg += 2) {
      const u = (a + 1) % 3, w = (a + 2) % 3, fs = a === 0 ? sh[sg > 0 ? 0 : 1] : a === 1 ? sh[sg > 0 ? 2 : 3] : sh[sg > 0 ? 4 : 5];
      for (const [qu, qw] of Q) { const v = [0, 0, 0]; v[a] = sg * .5; v[u] = qu * .5; v[w] = qw * .5; d.push(v[0], v[1], v[2], fs); }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, cuboB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(d), gl.STATIC_DRAW); }
  const T4 = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
  const S4 = (x, y, z) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
  const RY = (a) => { const c = Math.cos(a), s2 = Math.sin(a); return [c, 0, -s2, 0, 0, 1, 0, 0, s2, 0, c, 0, 0, 0, 0, 1]; };
  const RX = (a) => { const c = Math.cos(a), s2 = Math.sin(a); return [1, 0, 0, 0, 0, c, s2, 0, 0, -s2, c, 0, 0, 0, 0, 1]; };
  const hsl = (h, sa, l) => { const k = (n) => (n + h / 30) % 12, a = sa * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return [f(0), f(8), f(4)]; };
  const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const oscuro = (c, k) => c.map((v) => v * k);
  const PIELES = ["#f1c9a5", "#e0ac84", "#c68642", "#9a6a45", "#7a4a2b"].map(hex), PELOS = ["#2b1b12", "#4a2f1b", "#8a5a2b", "#d6b25e", "#b8b8b8", "#7a2f1b"].map(hex);
  function aspecto(n) {
    const h = hashTxt((n.id || "") + (n.nombre || ""));
    const piel = PIELES[h % 5], pelo = PELOS[(h >>> 3) % 6], ropa = hsl((h >>> 6) % 360, .5, .42), estilo = (h >>> 14) % 3;
    return { piel, pelo, ropa, manga: oscuro(ropa, .8), pant: hex("#3b3f55"), cinto: hex("#5a3b1e"), sombrero: oscuro(ropa, .7), estilo, k: .96 + ((h >>> 17) % 12) / 100, semilla: (h % 628) / 100 };
  }
  // la apariencia del jugador: viene de su avatar (colores y accesorio) y se arma con las mismas piezas
  function aspectoDesde(c) {
    const ropa = hex(c.ropa || "#3b6fb6");
    return { piel: hex(c.piel || "#e0ac84"), pelo: hex(c.pelo || "#4a2f1b"), ropa, manga: oscuro(ropa, .8), pant: hex(c.pant || "#3b3f55"), cinto: hex("#5a3b1e"), sombrero: oscuro(ropa, .7),
      estilo: 0, largo: !!c.largo, acc: c.acc || null, accCol: hex(c.accCol || "#c9a227"), capa: c.capa ? hex(c.capa) : null, k: 1, semilla: 0.5 };
  }
  const aspectoJugadorDefecto = () => { const h = hashTxt("jug" + (ctx.yo || 0)); return { piel: ["#f1c9a5", "#e0ac84", "#c68642", "#9a6a45"][h % 4], pelo: ["#2b1b12", "#4a2f1b", "#8a5a2b", "#d6b25e"][(h >>> 3) % 4], ropa: "#" + hsl((h >>> 6) % 360, .5, .42).map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join(""), pant: "#3b3f55" }; };
  // cada pieza: [ancho, alto, fondo, desplazamiento x, y, z, color]
  const cuerpo = (a) => ({
    capa: a.capa ? [[.5, .85, .05, 0, -.42, -.03, a.capa]] : null,
    piernaI: [[.25, .72, .27, 0, -.36, 0, a.pant]], piernaD: [[.25, .72, .27, 0, -.36, 0, a.pant]],
    torso: [[.56, .72, .32, 0, 1.08, 0, a.ropa], [.58, .08, .34, 0, .8, 0, a.cinto]],
    brazoI: [[.2, .4, .24, 0, -.2, 0, a.manga], [.18, .26, .22, 0, -.53, 0, a.piel]], brazoD: [[.2, .4, .24, 0, -.2, 0, a.manga], [.18, .26, .22, 0, -.53, 0, a.piel]],
    cabeza: [[.5, .5, .5, 0, .25, 0, a.piel], [.1, .14, .1, 0, .2, .3, oscuro(a.piel, .85)], [.08, .08, .03, -.12, .3, .26, [.1, .1, .12]], [.08, .08, .03, .12, .3, .26, [.1, .1, .12]], [.16, .03, .02, 0, .1, .255, [.45, .2, .2]],
      ...(a.largo ? [[.54, .72, .1, 0, .1, -.27, a.pelo], [.06, .4, .3, -.28, .2, -.08, a.pelo], [.06, .4, .3, .28, .2, -.08, a.pelo]] : [[.54, .4, .08, 0, .3, -.27, a.pelo]]),
      ...(a.acc === "casco" ? [[.6, .26, .6, 0, .5, 0, a.accCol], [.08, .22, .04, 0, .3, .27, a.accCol]]
        : a.acc === "capucha" ? [[.62, .12, .62, 0, .57, 0, a.sombrero], [.62, .56, .1, 0, .27, -.29, a.sombrero], [.08, .5, .5, -.29, .25, -.02, a.sombrero], [.08, .5, .5, .29, .25, -.02, a.sombrero]]
        : a.acc === "corona" ? [[.54, .14, .54, 0, .55, 0, a.pelo], [.5, .08, .5, 0, .62, 0, a.accCol], [.08, .14, .08, -.18, .72, 0, a.accCol], [.08, .16, .08, 0, .73, 0, a.accCol], [.08, .14, .08, .18, .72, 0, a.accCol]]
        : a.acc === "gafas" ? [[.54, .14, .54, 0, .55, 0, a.pelo], [.17, .13, .03, -.12, .3, .27, [.08, .08, .1]], [.17, .13, .03, .12, .3, .27, [.08, .08, .1]], [.08, .03, .03, 0, .31, .27, [.08, .08, .1]]]
        : a.estilo === 1 ? [[.88, .06, .88, 0, .52, 0, a.sombrero], [.42, .2, .42, 0, .65, 0, a.sombrero]] : [[.54, .14, .54, 0, .55, 0, a.pelo]]),
      ...(a.estilo === 2 ? [[.4, .22, .08, 0, .08, .27, a.pelo]] : [])],
  });
  const jugV = { n: { x: 0, y: 0, z: 0, hecha: true, tipo: "jugador" }, ap: null, partes: null, h: 0, fase: 0, amp: 0, cab: 0, nodFijo: 0, mover: false, habla: false, dist: 99 };
  const ponerAvatar = (c) => { jugV.ap = aspectoDesde(c || aspectoJugadorDefecto()); jugV.partes = cuerpo(jugV.ap); };
  ponerAvatar(ctx.avatar);
  let vis = [], hablandoCon = null;
  function limpiarNpcs() { vis.forEach((v) => v.el.remove()); vis = []; }
  function montarNpcs(lista) {
    const previos = new Map(vis.map((v) => [v.n.id, v])); vis.forEach((v) => v.el.remove()); vis = [];
    npcs = posNpc(lista || []);
    for (const n of npcs) {
      const viejo = previos.get(n.id), llave = JSON.stringify(n.look || null);
      const el = document.createElement("div");
      el.className = "m3d-npc" + (n.hecha ? " ok" : ""); el.textContent = (n.hecha ? "✅ " : (n.marca || "❗ ")) + n.nombre; el.style.display = "none"; raiz.append(el);
      if (viejo && viejo.llave === llave) { // el mismo personaje: conserva su lugar, su paso y su rumbo
        Object.assign(viejo.n, { nombre: n.nombre, hecha: n.hecha, marca: n.marca, tipo: n.tipo, emoji: n.emoji, zona: n.zona, misiones: n.misiones, r: n.r });
        if (hablandoCon === viejo.n || hablandoCon === n) hablandoCon = viejo.n;
        viejo.el = el; vis.push(viejo); continue;
      }
      const ap = n.look ? aspectoDesde(n.look) : aspecto(n);
      vis.push({ n, ap, el, llave, partes: cuerpo(ap), h: Math.atan2(CENTRO - n.x, CENTRO - n.z), x0: n.x, z0: n.z, obj: null, espera: 1 + Math.random() * 3, fase: ap.semilla, amp: 0, cab: 0, nod: 0 });
    }
    npcs = vis.map((v) => v.n);
  }
  const angDif = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  // dónde pisaría un personaje en (x, z): busca el suelo cerca de la altura de referencia y exige 2 bloques libres arriba
  function sueloPara(x, z, yRef) {
    const xi = Math.floor(x), zi = Math.floor(z);
    for (let y = Math.round(yRef) + 1; y >= Math.round(yRef) - 2; y--) if (solido(xi, y - 1, zi) && !solido(xi, y, zi) && !solido(xi, y + 1, zi) && get(xi, y - 1, zi) !== AGUA) return y;
    return null;
  }
  function moverNpcs(dt, t) {
    for (const v of vis) {
      const n = v.n, dx = jug.x - n.x, dz = jug.z - n.z, dist = Math.hypot(dx, dz), habla = hablandoCon === n, cerca = dist < 4.2;
      let objH = null, mover = false;
      if (habla || cerca) objH = Math.atan2(dx, dz);
      else if (v.obj) {
        const ox = v.obj[0] - n.x, oz = v.obj[1] - n.z, d = Math.hypot(ox, oz);
        if (d < .15) { v.obj = null; v.espera = 1.5 + Math.random() * 3.5; }
        else {
          objH = Math.atan2(ox, oz);
          if (Math.abs(angDif(objH, v.h)) < .5) {
            const paso = Math.min(d, .85 * dt), nx = n.x + ox / d * paso, nz = n.z + oz / d * paso, sy = sueloPara(nx, nz, n.y);
            if (sy != null && Math.abs(sy - n.y) <= 1.01) { n.x = nx; n.z = nz; n.y += (sy - n.y) * Math.min(1, 10 * dt); mover = true; } else { v.obj = null; v.espera = 1; }
          }
        }
      } else {
        v.espera -= dt;
        if (v.espera <= 0) {
          v.espera = .6; const a = Math.random() * Math.PI * 2, r = (.4 + Math.random() * .6) * (n.r || 1.5), px = v.x0 + Math.cos(a) * r, pz = v.z0 + Math.sin(a) * r;
          if (sueloPara(px, pz, n.y) != null) v.obj = [px, pz];
        }
      }
      if (objH != null) v.h += Math.max(-4 * dt, Math.min(4 * dt, angDif(objH, v.h)));
      const mirada = dist < 10 ? Math.max(-1, Math.min(1, angDif(Math.atan2(dx, dz), v.h))) : 0;
      v.cab += (mirada - v.cab) * Math.min(1, 6 * dt);
      v.amp += ((mover ? 1 : 0) - v.amp) * Math.min(1, 8 * dt); if (mover) v.fase += dt * 8;
      v.mover = mover; v.habla = habla; v.dist = dist;
    }
  }
  function dibujarAldeano(v, t) {
    const n = v.n, a = v.ap, sw = Math.sin(v.fase) * .7 * v.amp, sue = Math.sin(t * 1.3 + a.semilla) * .04;
    let bI = -sw * .8 + sue, bD = sw * .8 - sue, nod = v.nodFijo || 0;
    if (v.habla) { bD = -.7 + Math.sin(t * 4 + a.semilla) * .4; bI = -.25 + Math.sin(t * 3.1) * .2; nod = Math.sin(t * 5) * .1; }
    else if (!v.mover && !n.hecha && n.tipo !== "posada" && v.dist < 9) bD = -2.7 + Math.sin(t * 7) * .4; // saluda con la mano
    const resp = 1 + Math.sin(t * 1.8 + a.semilla) * .012;
    const base = mul(M, mul(mul(T4(n.x, n.y, n.z), RY(v.h)), S4(a.k, a.k * resp, a.k)));
    const grupo = (g, boxes) => { for (const [w, h, d, ox, oy, oz, col] of boxes) { gl.uniformMatrix4fv(locC.m, false, new Float32Array(mul(g, mul(T4(ox, oy, oz), S4(w, h, d))))); gl.uniform3f(locC.c, col[0], col[1], col[2]); gl.drawArrays(gl.TRIANGLES, 0, 36); } };
    const P = v.partes;
    grupo(mul(base, mul(T4(-.14, .72, 0), RX(sw))), P.piernaI); grupo(mul(base, mul(T4(.14, .72, 0), RX(-sw))), P.piernaD);
    grupo(base, P.torso);
    grupo(mul(base, mul(T4(-.4, 1.38, 0), RX(bI))), P.brazoI); grupo(mul(base, mul(T4(.4, 1.38, 0), RX(bD))), P.brazoD);
    if (P.capa) grupo(mul(base, mul(T4(0, 1.4, -.17), RX(.12 + Math.abs(sw) * .5))), P.capa);
    grupo(mul(base, mul(T4(0, 1.44, 0), mul(RY(v.cab), RX(nod)))), P.cabeza);
  }
  montarNpcs(ctx.npcs);

  // ----- cámara -----
  const perspectiva = (fov, asp, n, f) => { const t = 1 / Math.tan(fov / 2); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]; };
  const mul = (a, b) => { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
  const jug = { x: CENTRO + .5, y: 13.1, z: CENTRO + 6.5, vx: 0, vy: 0, vz: 0, suelo: false, yaw: 0, pitch: 0 };
  const ojo = () => jug.y + 1.6;
  // cámara: 0 = primera persona, 1 = tercera (detrás del personaje), 2 = de frente (para ver cómo se ve tu avatar)
  const cam = { modo: ctx.camara || 0, dist: 4.5, fov: 1.2, sens: 1 };
  function camaraActual() {
    if (cam.modo === 0) return { ex: jug.x, ey: ojo(), ez: jug.z, yaw: jug.yaw, pitch: jug.pitch };
    const f = adelante(), dir = cam.modo === 1 ? -1 : 1, ey0 = ojo(); let t = .3;
    while (t < cam.dist) { const px = jug.x + f[0] * dir * (t + .25), py = ey0 + f[1] * dir * (t + .25), pz = jug.z + f[2] * dir * (t + .25); if (solido(Math.floor(px), Math.floor(py), Math.floor(pz))) break; t += .2; }
    const d = Math.max(.5, Math.min(cam.dist, t - .1));
    const ex = jug.x + f[0] * dir * d, ey = ey0 + f[1] * dir * d, ez = jug.z + f[2] * dir * d;
    return cam.modo === 1 ? { ex, ey, ez, yaw: jug.yaw, pitch: jug.pitch } : { ex, ey, ez, yaw: jug.yaw + Math.PI, pitch: -jug.pitch };
  }
  function vista(c) {
    const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const ex = c.ex, ey = c.ey, ez = c.ez, rx = cy, rz = -sy, ux = -sp * sy, uy = cp, uz = -sp * cy, bx = sy * cp, by = sp, bz = cy * cp;
    return [rx, ux, bx, 0, 0, uy, by, 0, rz, uz, bz, 0, -(rx * ex + rz * ez), -(ux * ex + uy * ey + uz * ez), -(bx * ex + by * ey + bz * ez), 1];
  }
  const adelante = () => { const cy = Math.cos(jug.yaw), sy = Math.sin(jug.yaw), cp = Math.cos(jug.pitch), sp = Math.sin(jug.pitch); return [-sy * cp, -sp, -cy * cp]; };

  // ----- física -----
  const RAD = .3, ALTO = 1.75;
  const choca = (x, y, z) => { for (let yy = Math.floor(y); yy <= Math.floor(y + ALTO - .001); yy++) for (let zz = Math.floor(z - RAD); zz <= Math.floor(z + RAD); zz++) for (let xx = Math.floor(x - RAD); xx <= Math.floor(x + RAD); xx++) if (solido(xx, yy, zz)) return true; return false; };
  const tec = {}; const joy = { x: 0, y: 0 };
  let enAgua = false;
  function actualizar(dt) {
    if (ctx.vuelo) { // modo observador (docente): vuela sin chocar; W A S D siguen la mirada, espacio sube, mayúscula baja, Ctrl acelera
      const f = adelante(), cy = Math.cos(jug.yaw), sy = Math.sin(jug.yaw), v = tec.control ? 45 : 16;
      let ax = (tec.d ? 1 : 0) - (tec.a ? 1 : 0) + joy.x, af = (tec.w ? 1 : 0) - (tec.s ? 1 : 0) - joy.y;
      const l = Math.hypot(ax, af); if (l > 1) { ax /= l; af /= l; }
      jug.x += (f[0] * af + cy * ax) * v * dt; jug.z += (f[2] * af - sy * ax) * v * dt; jug.y += (f[1] * af + (tec[" "] ? 1 : 0) - (tec.shift ? 1 : 0)) * v * dt;
      jug.vx = jug.vy = jug.vz = 0; jug.suelo = false; enAgua = false;
      jug.x = Math.max(.5, Math.min(SX - .5, jug.x)); jug.z = Math.max(.5, Math.min(SZ - .5, jug.z)); jug.y = Math.max(1, Math.min(SY + 40, jug.y));
      return;
    }
    let ax = (tec.d ? 1 : 0) - (tec.a ? 1 : 0) + joy.x, az = (tec.s ? 1 : 0) - (tec.w ? 1 : 0) + joy.y;
    const l = Math.hypot(ax, az); if (l > 1) { ax /= l; az /= l; }
    enAgua = get(Math.floor(jug.x), Math.floor(jug.y + .9), Math.floor(jug.z)) === AGUA;
    const cy = Math.cos(jug.yaw), sy = Math.sin(jug.yaw), v = enAgua ? 2.4 : 4.3;
    jug.vx = (ax * cy + az * sy) * v; jug.vz = (-ax * sy + az * cy) * v;
    if (enAgua) { jug.vy = Math.max(jug.vy - 8 * dt, -2.5); if (tec[" "]) jug.vy = 3.2; }
    else { if (tec[" "] && jug.suelo) { jug.vy = 8.6; jug.suelo = false; sonido.salto(); } jug.vy = Math.max(jug.vy - 26 * dt, -30); }
    let nx = jug.x + jug.vx * dt; if (!choca(nx, jug.y, jug.z)) jug.x = nx;
    let nz = jug.z + jug.vz * dt; if (!choca(jug.x, jug.y, nz)) jug.z = nz;
    let ny = jug.y + jug.vy * dt; jug.suelo = false;
    if (!choca(jug.x, ny, jug.z)) jug.y = ny; else { if (jug.vy < 0) { jug.y = Math.floor(ny) + 1.001; jug.suelo = true; } jug.vy = 0; }
    jug.x = Math.max(.5, Math.min(SX - .5, jug.x)); jug.z = Math.max(.5, Math.min(SZ - .5, jug.z));
    if (jug.y < -10) { jug.x = CENTRO + .5; jug.z = CENTRO + 6.5; jug.y = 14; jug.vy = 0; }
  }

  // ----- apuntar (recorrido por la cuadrícula) -----
  function apuntar() {
    const d = adelante(), x = jug.x, y = ojo(), z = jug.z;
    let ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const sx = Math.sign(d[0]), sy = Math.sign(d[1]), sz = Math.sign(d[2]);
    const tdx = d[0] ? Math.abs(1 / d[0]) : 1e9, tdy = d[1] ? Math.abs(1 / d[1]) : 1e9, tdz = d[2] ? Math.abs(1 / d[2]) : 1e9;
    let tx = d[0] ? (sx > 0 ? ix + 1 - x : x - ix) * tdx : 1e9, ty = d[1] ? (sy > 0 ? iy + 1 - y : y - iy) * tdy : 1e9, tz = d[2] ? (sz > 0 ? iz + 1 - z : z - iz) * tdz : 1e9;
    let px = ix, py = iy, pz = iz, t = 0;
    while (t <= (ctx.vuelo ? 60 : 5.5)) {
      const b = get(ix, iy, iz);
      if (b !== AIRE && b !== AGUA && b !== PORTAL && iy >= 0 && iy < SY) return { x: ix, y: iy, z: iz, px, py, pz, b };
      px = ix; py = iy; pz = iz;
      if (tx < ty && tx < tz) { ix += sx; t = tx; tx += tdx; } else if (ty < tz) { iy += sy; t = ty; ty += tdy; } else { iz += sz; t = tz; tz += tdz; }
    }
    return null;
  }

  // ----- acciones -----
  let sel = 1, picar = false, picando = null, ocupado = false, pausado = false, cercano = null;
  function limpiarEntrada() { for (const k in tec) tec[k] = false; picar = false; joy.x = joy.y = 0; }
  let animalCer = null;
  function hablar() {
    if (pausado) return;
    if (!cercano) { // sin personaje cerca: si hay un animal delante, se le saluda
      if (animalCer) { const a = animalCer; sonido.animal(a.tipo); a.pasta = 0; a.espera = 2; a.susto = 0; aviso(FRASES[a.tipo] || "🐾"); }
      return;
    }
    pausado = true; hablandoCon = cercano; limpiarEntrada(); if (document.pointerLockElement === cv) document.exitPointerLock();
    try { ctx.alNpc && ctx.alNpc(cercano); } catch (_) {}
  }
  const clave = (x, y, z) => x + "," + y + "," + z;
  const aviso = (t) => { try { ctx.alError && ctx.alError(t); } catch (_) {} };
  function puedeEditar(x, y, z) {
    if (ctx.soloMirar) { aviso("Estás de visita: aquí solo se puede mirar."); return false; }
    if (veda[z * SX + x]) { aviso("Los muros y portones de las zonas están protegidos."); return false; }
    if (enPlazaProtegida(x, z)) { aviso("La plaza está protegida: construye fuera de ella."); return false; }
    if (y < 1 || y >= SY - 1) return false;
    return true;
  }
  function quePicar(dt) {
    if (!picar) { picando = null; return; }
    const h = apuntar(); if (!h || h.b === ADOQUIN || h.y <= 0) { picando = null; return; }
    if (!picando || picando.x !== h.x || picando.y !== h.y || picando.z !== h.z) { picando = { x: h.x, y: h.y, z: h.z, t: 0, b: h.b }; }
    picando.t += dt; picando.s = (picando.s || 0) + dt; if (picando.s > .28) { picando.s = 0; sonido.picar(h.b); }
    if (picando.t >= (DUREZA[h.b] || 1)) {
      const { x, y, z, b } = picando; picando = null;
      if (ocupado) return;
      if (!puedeEditar(x, y, z)) { picar = false; return; }
      const dueno = autores.get(clave(x, y, z));
      if (dueno != null && dueno !== ctx.yo && b > 0 && mundo[idx(x, y, z)] > 0) { aviso("Ese bloque lo puso otro compañero."); picar = false; return; }
      mundo[idx(x, y, z)] = AIRE; marcar(x, z); ocupado = true; sonido.romper(b);
      Promise.resolve(ctx.picar(x, y, z, b)).then(() => { autores.set(clave(x, y, z), ctx.yo); }).catch((e) => {
        if (!vivo) return; mundo[idx(x, y, z)] = b; marcar(x, z); aviso(mensajeError(e));
      }).finally(() => { ocupado = false; });
    }
  }
  function poner() {
    const h = apuntar(); if (!h || ocupado) return;
    const { px: x, py: y, pz: z } = h; if (!puedeEditar(x, y, z)) return;
    const c = get(x, y, z); if (c !== AIRE && c !== AGUA) return;
    if (!(ctx.cantidad(sel) > 0)) { aviso("No tienes " + NOMBRES[sel].toLowerCase() + ". Pica o fabrica más."); return; }
    if (x + 1 > jug.x - RAD && x < jug.x + RAD && z + 1 > jug.z - RAD && z < jug.z + RAD && y + 1 > jug.y && y < jug.y + ALTO) return;
    const antes = c; mundo[idx(x, y, z)] = sel; marcar(x, z); ocupado = true; sonido.poner(sel);
    Promise.resolve(ctx.poner(x, y, z, sel)).then(() => { autores.set(clave(x, y, z), ctx.yo); }).catch((e) => {
      if (!vivo) return; mundo[idx(x, y, z)] = antes; marcar(x, z); aviso(mensajeError(e));
    }).finally(() => { ocupado = false; });
  }
  function mensajeError(e) {
    const m = String((e && e.message) || e || "");
    if (/demasiado_rapido/.test(m)) return "Vas muy rápido. Espera un momento.";
    if (/bloque_ajeno/.test(m)) return "Ese bloque lo puso otro compañero.";
    if (/sin_material/.test(m)) return "No tienes suficiente material.";
    if (/limite_de_bloques/.test(m)) return "Llegaste al máximo de bloques puestos.";
    if (/zona_protegida/.test(m)) return "La plaza está protegida.";
    if (/construccion_cerrada/.test(m)) return "Tu docente cerró la construcción por ahora: puedes explorar.";
    if (/ocupado/.test(m)) return "Ese lugar ya está ocupado.";
    return "No se pudo guardar el cambio. Intenta de nuevo.";
  }

  // ----- entrada -----
  const bloqueado = () => document.pointerLockElement === cv;
  let jugando = false, sinBloqueo = false, arrastraRaton = false;
  const mapaTecla = (k) => (k === "arrowup" ? "w" : k === "arrowdown" ? "s" : k === "arrowleft" ? "a" : k === "arrowright" ? "d" : k);
  const mirar = (dx, dy, k) => { jug.yaw -= dx * k * cam.sens; jug.pitch = Math.max(-1.55, Math.min(1.55, jug.pitch + dy * k * cam.sens)); };
  const seleccionar = (item) => { sel = item; ctx.alSeleccion && ctx.alSeleccion(item); };
  const escuchas = [];
  const on = (obj, ev, fn, op) => { obj.addEventListener(ev, fn, op); escuchas.push([obj, ev, fn, op]); };
  on(window, "keydown", (e) => {
    if (pausado || (!jugando && !bloqueado())) return;
    const k = e.key.toLowerCase(); if (k === "e") { hablar(); return; } if (k === "v") { cam.modo = (cam.modo + 1) % 3; try { ctx.alCamara && ctx.alCamara(cam.modo); } catch (_) {} return; } if ([" ", "arrowup", "arrowdown"].includes(k)) e.preventDefault();
    tec[mapaTecla(k)] = true; if (k === "f" && sinBloqueo) picar = true;
    const n = +e.key; if (n >= 1 && n <= 8) seleccionar(COLOCABLES[n - 1]);
  });
  on(window, "keyup", (e) => { const k = e.key.toLowerCase(); tec[mapaTecla(k)] = false; if (k === "f" && sinBloqueo) picar = false; });
  on(window, "blur", () => { for (const k in tec) tec[k] = false; picar = false; });
  on(cv, "contextmenu", (e) => e.preventDefault());
  const toques = {};
  on(cv, "pointerdown", (e) => {
    if (pausado) return;
    if (e.pointerType === "touch") {
      cv.setPointerCapture(e.pointerId); ayuda.textContent = ""; jugando = true;
      const r = cv.getBoundingClientRect(); toques[e.pointerId] = { izq: (e.clientX - r.left) < r.width * .4, x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY }; return;
    }
    if (!bloqueado() && !sinBloqueo) { try { cv.requestPointerLock(); } catch (_) { sinBloqueo = true; } jugando = true; ayuda.textContent = ""; }
    if (e.button === 2) { poner(); return; }
    if (e.button === 0) { if (sinBloqueo) arrastraRaton = true; else picar = true; }
  });
  on(document, "pointerlockerror", () => { sinBloqueo = true; ayuda.textContent = "Arrastra para mirar · mantén F para picar · clic derecho para poner"; });
  on(window, "pointerup", (e) => { if (e.pointerType !== "touch") { arrastraRaton = false; if (e.button === 0 && !sinBloqueo) picar = false; } });
  on(window, "mousemove", (e) => { if (bloqueado()) mirar(e.movementX, e.movementY, .0024); else if (arrastraRaton) mirar(e.movementX, e.movementY, .004); });
  on(document, "pointerlockchange", () => { if (!bloqueado()) { picar = false; if (jugando && !sinBloqueo) ayuda.textContent = "Haz clic para seguir jugando"; } });
  on(cv, "wheel", (e) => { e.preventDefault(); const i = COLOCABLES.indexOf(sel); seleccionar(COLOCABLES[(i + (e.deltaY > 0 ? 1 : -1) + COLOCABLES.length) % COLOCABLES.length]); }, { passive: false });
  on(cv, "pointermove", (e) => {
    const t = toques[e.pointerId]; if (!t) return;
    if (t.izq) { const dx = e.clientX - t.ox, dy = e.clientY - t.oy, m = Math.min(1, Math.hypot(dx, dy) / 45), a = Math.atan2(dy, dx); joy.x = Math.cos(a) * m; joy.y = Math.sin(a) * m; joyEl.firstChild.style.transform = `translate(${joy.x * 30}px,${joy.y * 30}px)`; }
    else { mirar(e.clientX - t.x, e.clientY - t.y, .006); t.x = e.clientX; t.y = e.clientY; }
  });
  const finT = (e) => { const t = toques[e.pointerId]; if (!t) return; if (t.izq) { joy.x = joy.y = 0; joyEl.firstChild.style.transform = ""; } delete toques[e.pointerId]; };
  on(cv, "pointerup", finT); on(cv, "pointercancel", finT);
  acc.querySelectorAll("button").forEach((b) => {
    const k = b.dataset.k;
    on(b, "pointerdown", (e) => { e.preventDefault(); if (k === "hablar") { hablar(); return; } if (pausado) return; jugando = true; ayuda.textContent = ""; if (k === "salto") tec[" "] = true; else if (k === "picar") picar = true; else poner(); });
    const up = () => { if (k === "salto") tec[" "] = false; else if (k === "picar") picar = false; };
    on(b, "pointerup", up); on(b, "pointerleave", up); on(b, "pointercancel", up);
  });

  // ----- tamaño y bucle -----
  let alta = true;
  const tamano = () => { const r = cv.getBoundingClientRect(); const k = alta ? Math.min(devicePixelRatio || 1, 1.5) : .6; const w = Math.max(320, Math.round(r.width * k)), h = Math.max(180, Math.round(r.height * k)); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } };
  const ro = new ResizeObserver(tamano); ro.observe(cv);
  let zonaAct = "", cooldownPortal = 0, M = null;
  // ----- ambiente: hora del día, sol, luna, estrellas, nubes y lluvia -----
  const ambiente = crearAmbiente(), sonido = crearSonido(ctx.sonido || {});
  let amb = ambiente.get();
  const mezclar = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const RZ = (a) => { const c = Math.cos(a), s2 = Math.sin(a); return [c, s2, 0, 0, -s2, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; };
  const nubes = [], estrellas = [], gotas = [];
  { let s2 = 12345; const r2 = () => { s2 = (Math.imul(s2, 1664525) + 1013904223) >>> 0; return s2 / 4294967296; };
    for (let i = 0; i < 18; i++) nubes.push({ x: r2() * 280, z: r2() * 280, w: 12 + r2() * 20, d: 8 + r2() * 10, v: .8 + r2() * .8, y: 66 + r2() * 8 });
    for (let i = 0; i < 110; i++) { const a = r2() * Math.PI * 2, e = .08 + r2() * 1.3; estrellas.push([Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e), r2()]); }
    for (let i = 0; i < 170; i++) gotas.push({ dx: (r2() - .5) * 26, dz: (r2() - .5) * 26, y: r2() * 16, tope: -1 }); }
  const topeColumna = (x, z) => { for (let y = SY - 1; y >= 0; y--) if (solido(x, y, z) && get(x, y, z) !== 8) return y + 1; return 0; };
  const orientar = (d) => mul(RY(Math.atan2(d[0], d[2])), RX(-Math.asin(Math.max(-1, Math.min(1, d[1])))));
  function prepararPC(cielo, flat) {
    gl.useProgram(PC); gl.uniform3f(locC.cn, cielo[0], cielo[1], cielo[2]);
    if (flat) { gl.uniform3f(locC.lc, 1, 1, 1); gl.uniform2f(locC.fg, 0, .001); } else { gl.uniform3f(locC.lc, amb.luz[0], amb.luz[1], amb.luz[2]); gl.uniform2f(locC.fg, 40 - 14 * amb.lluvia, 45 - 15 * amb.lluvia); }
    gl.bindBuffer(gl.ARRAY_BUFFER, cuboB); gl.enableVertexAttribArray(locC.p); gl.vertexAttribPointer(locC.p, 3, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(locC.s); gl.vertexAttribPointer(locC.s, 1, gl.FLOAT, false, 16, 12);
    gl.disable(gl.CULL_FACE);
  }
  function cerrarPC() { gl.disableVertexAttribArray(locC.p); gl.disableVertexAttribArray(locC.s); gl.enable(gl.CULL_FACE); }
  const pieza = (pos, mat, col) => { gl.uniform3f(locC.cn, col[0], col[1], col[2]); gl.uniformMatrix4fv(locC.m, false, new Float32Array(mul(M, mul(T4(pos[0], pos[1], pos[2]), mat)))); gl.drawArrays(gl.TRIANGLES, 0, 36); };
  // sol, luna y estrellas: van detrás de todo
  function dibujarCielo(c, cielo, tt) {
    prepararPC(cielo, true); gl.depthMask(false);
    const eye = [c.ex, c.ey, c.ez], en = (d, r) => [eye[0] + d[0] * r, eye[1] + d[1] * r, eye[2] + d[2] * r], ll = amb.lluvia;
    if (amb.altura > -.14) pieza(en(amb.sol, 100), mul(orientar(amb.sol), S4(16, 16, 1)), mezclar(mezclar([1, .97, .76], [1, .6, .28], amb.ocaso), cielo, ll * .9));
    if (amb.altura < .14) pieza(en(amb.luna, 100), mul(orientar(amb.luna), S4(12, 12, 1)), mezclar([.88, .92, 1], cielo, ll * .9));
    if (amb.noche > .35 && ll < .7) { const k = Math.min(1, (amb.noche - .35) * 1.6) * (1 - ll);
      for (const st of estrellas) pieza(en(st, 105), S4(.9, .9, .9), mezclar(cielo, [1, 1, 1], k * (.55 + .45 * Math.sin(tt * 2 + st[3] * 40)))); }
    gl.depthMask(true); cerrarPC();
  }
  // nubes y lluvia: van delante del terreno, con su profundidad
  function dibujarAtmosfera(c, cielo, tt, dt) {
    prepararPC(cielo, true); gl.depthMask(false);
    const base = amb.luz.map((v) => Math.min(1, v * 1.08)), gris = [.55, .58, .62].map((v, i) => v * Math.max(.3, amb.luz[i]));
    const colNube = mezclar(base, gris, amb.lluvia * .7);
    for (const n of nubes) {
      const rx = (((n.x + tt * n.v - c.ex) % 280) + 280) % 280 - 140, rz = (((n.z - c.ez) % 280) + 280) % 280 - 140;
      pieza([c.ex + rx, n.y, c.ez + rz], S4(n.w, 2.5, n.d), colNube);
    }
    if (amb.lluvia > .12 && !ctx.vuelo) {
      const activas = Math.floor(gotas.length * amb.lluvia), col = mezclar(cielo, [.7, .8, .96], .75);
      for (let i = 0; i < activas; i++) {
        const g = gotas[i]; g.y -= 17 * dt;
        if (g.y < -7 || g.tope < 0) { g.dx = (Math.random() - .5) * 26; g.dz = (Math.random() - .5) * 26; g.y = 8 + Math.random() * 8; g.tope = topeColumna(Math.floor(c.ex + g.dx), Math.floor(c.ez + g.dz)); }
        const yy = c.ey + g.y; if (yy < g.tope) continue;
        pieza([c.ex + g.dx, yy, c.ez + g.dz], S4(.03, .55, .03), col);
      }
    }
    gl.depthMask(true); cerrarPC();
  }

  // ----- animales -----
  const animales = [];
  { let s3 = ((semilla ^ 0x5bd1e995) >>> 0) || 7; const r3 = () => { s3 = (Math.imul(s3, 1664525) + 1013904223) >>> 0; return s3 / 4294967296; };
    const valido = (x, z) => {
      const xi = Math.floor(x), zi = Math.floor(z); if (xi < 4 || zi < 4 || xi > SX - 5 || zi > SZ - 5) return false;
      if (Math.hypot(x - CENTRO, z - CENTRO) < 46 || Math.hypot(x - CRUCE.x, z - CRUCE.z) < 24 || Math.hypot(x - MONTE.x, z - MONTE.z) < MONTE.r + 2 || Math.hypot((x - LAGO.x) * .8, z - LAGO.z) < LAGO.r + 6) return false;
      if (distCamino(xi, zi) <= 3) return false;
      const h = alt[zi * SX + xi]; return get(xi, h, zi) === 1 && sueloPara(x, z, h + 1) != null;
    };
    for (const [tipo, n] of POBLACION) {
      let puestos = 0, intentos = 0;
      while (puestos < n && intentos < 500) {
        intentos++; const cx = 10 + r3() * (SX - 20), cz = 10 + r3() * (SZ - 20); if (!valido(cx, cz)) continue;
        const tam = Math.min(n - puestos, 2 + Math.floor(r3() * 3));
        for (let i = 0; i < tam; i++) {
          const x = cx + (r3() - .5) * 8, z = cz + (r3() - .5) * 8; if (!valido(x, z)) continue;
          const y = sueloPara(x, z, alt[Math.floor(z) * SX + Math.floor(x)] + 1);
          animales.push({ tipo, esp: ESPECIES[tipo], x, y, z, x0: x, z0: z, h: r3() * 6.28, obj: null, espera: r3() * 4, pasta: 0, susto: 0, fase: r3() * 6, fase0: r3() * 6, amp: 0, snd: 5 + r3() * 25 });
          puestos++;
        }
      }
    }
  }
  const FRASES = { vaca: "🐄 ¡Muuu!", oveja: "🐑 ¡Beee!", cerdo: "🐖 ¡Oinc, oinc!", gallina: "🐔 ¡Coc, coc, coc!" };
  function moverAnimales(dt) {
    for (const a of animales) {
      const dxp = jug.x - a.x, dzp = jug.z - a.z, dp = Math.hypot(dxp, dzp); if (dp > 90) continue;
      const e = a.esp; let mover = false;
      if (a.susto > 0) a.susto -= dt;
      if (dp < 2.4 && Math.hypot(jug.vx, jug.vz) > 3 && a.susto <= 0 && !ctx.vuelo) { // se asusta si corres hacia ella
        const ang = Math.atan2(-dxp, -dzp) + (Math.random() - .5) * 1.2; a.obj = [a.x + Math.sin(ang) * 4, a.z + Math.cos(ang) * 4]; a.susto = 2.2; a.pasta = 0;
      }
      if (a.pasta > 0) a.pasta -= dt;
      else if (a.obj) {
        const ox = a.obj[0] - a.x, oz = a.obj[1] - a.z, d = Math.hypot(ox, oz);
        if (d < .2) { a.obj = null; a.espera = 1 + Math.random() * 4; }
        else {
          const objH = Math.atan2(ox, oz); a.h += Math.max(-5 * dt, Math.min(5 * dt, angDif(objH, a.h)));
          if (Math.abs(angDif(objH, a.h)) < .6) {
            const paso = Math.min(d, e.vel * (a.susto > 0 ? 2.6 : 1) * dt), nx = a.x + ox / d * paso, nz = a.z + oz / d * paso, sy = sueloPara(nx, nz, a.y);
            if (sy != null && Math.abs(sy - a.y) <= 1.01) { a.x = nx; a.z = nz; a.y += (sy - a.y) * Math.min(1, 10 * dt); mover = true; } else { a.obj = null; a.espera = 1; }
          }
        }
      } else {
        a.espera -= dt;
        if (a.espera <= 0) {
          a.espera = .5;
          if (Math.random() < .45) a.pasta = 2 + Math.random() * 3;
          else { const ang = Math.random() * 6.28, r = (.4 + Math.random() * .6) * e.radio, px = a.x0 + Math.cos(ang) * r, pz = a.z0 + Math.sin(ang) * r; if (sueloPara(px, pz, a.y) != null) a.obj = [px, pz]; }
        }
      }
      a.amp += ((mover ? 1 : 0) - a.amp) * Math.min(1, 8 * dt); if (mover) a.fase += dt * (a.susto > 0 ? 14 : 7);
      if (dp < 16) { a.snd -= dt; if (a.snd <= 0) { a.snd = 14 + Math.random() * 30; sonido.animal(a.tipo); } }
    }
  }
  function dibujarAnimales(cielo, tt) {
    prepararPC(cielo, false);
    for (const a of animales) {
      if (Math.hypot(a.x - jug.x, a.z - jug.z) > 70) continue;
      const sw = Math.sin(a.fase) * .65 * a.amp, base = mul(M, mul(T4(a.x, a.y, a.z), RY(a.h)));
      for (const p of a.esp.partes) {
        let g = mul(base, T4(p.p[0], p.p[1], p.p[2]));
        if (p.tipo === "pata") g = mul(g, RX(p.fase ? -sw : sw));
        else if (p.tipo === "cabeza") g = mul(g, RX(a.pasta > 0 ? (a.tipo === "gallina" ? .8 + Math.sin(tt * 14) * .3 : .95 + Math.sin(tt * 6) * .08) : Math.sin(tt * 1.2 + a.fase0) * .05 + (a.tipo === "gallina" ? Math.sin(a.fase * 2) * .25 * a.amp : 0)));
        else if (p.tipo === "ala") g = mul(g, RZ((p.fase ? 1 : -1) * (a.susto > 0 ? 1.1 + Math.sin(tt * 30) * .5 : .08)));
        else if (p.tipo === "cola") g = mul(g, RX(.25 + Math.sin(tt * 2.5 + a.fase0) * .2));
        for (const [w, hh, d, ox, oy, oz, col] of p.cajas) {
          gl.uniformMatrix4fv(locC.m, false, new Float32Array(mul(g, mul(T4(ox, oy, oz), S4(w, hh, d))))); gl.uniform3f(locC.c, col[0], col[1], col[2]); gl.drawArrays(gl.TRIANGLES, 0, 36);
        }
      }
    }
    cerrarPC();
  }

  // ----- flores y antorchas -----
  function dibujarDecor(cielo, tt) {
    prepararPC(cielo, false);
    const col = (c) => gl.uniform3f(locC.c, c[0], c[1], c[2]);
    const caja = (g, w, h, d, ox, oy, oz, c) => { gl.uniformMatrix4fv(locC.m, false, new Float32Array(mul(g, mul(T4(ox, oy, oz), S4(w, h, d))))); col(c); gl.drawArrays(gl.TRIANGLES, 0, 36); };
    for (const f of flores) {
      const dx = f.x - jug.x, dz = f.z - jug.z; if (dx * dx + dz * dz > 2500) continue;
      if (get(f.bx, f.y, f.bz) !== AIRE || get(f.bx, f.y - 1, f.bz) !== 1) continue;
      const g = mul(M, mul(T4(f.x, f.y, f.z), RZ(Math.sin(tt * 1.6 + f.ph) * .07)));
      caja(g, .06, .4, .06, 0, .2, 0, [.2, .55, .2]); caja(g, .22, .12, .22, 0, .44, 0, f.col); caja(g, .08, .08, .08, 0, .52, 0, [1, .85, .2]);
    }
    for (const a of antorchas) {
      const dx = a[0] - jug.x, dz = a[2] - jug.z; if (dx * dx + dz * dz > 3600) continue;
      const g = mul(M, T4(a[0], a[1], a[2]));
      caja(g, .14, .7, .14, 0, .35, 0, [.4, .27, .14]);
      gl.uniform3f(locC.lc, 1, 1, 1); // la llama brilla aunque sea de noche
      const fl = .85 + .15 * Math.sin(tt * 9 + a[0] * 3);
      caja(g, .26, .26, .26, 0, .82, 0, [1, .62 * fl, .12]); caja(g, .14, .16, .14, 0, 1.02 + .04 * Math.sin(tt * 11 + a[2]), 0, [1, .9, .35]);
      gl.uniform3f(locC.lc, amb.luz[0], amb.luz[1], amb.luz[2]);
    }
    cerrarPC();
  }

  function dibujar() {
    gl.viewport(0, 0, cv.width, cv.height);
    amb = ambiente.get(); const tt0 = performance.now() / 1000, dt0 = Math.min(.05, Math.max(0, tt0 - (dibujar.t || tt0))); dibujar.t = tt0;
    const kAg = .3 + .7 * amb.dia, cielo = enAgua ? [.2 * kAg, .4 * kAg, .7 * kAg] : amb.cielo; gl.clearColor(cielo[0], cielo[1], cielo[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const cc = camaraActual(); M = mul(perspectiva(cam.fov, cv.width / cv.height, .05, 140), vista(cc));
    if (!enAgua) dibujarCielo(cc, cielo, tt0);
    gl.useProgram(P); gl.uniformMatrix4fv(loc.m, false, new Float32Array(M)); gl.uniform1i(loc.t, 0); gl.uniform3f(loc.cn, cielo[0], cielo[1], cielo[2]);
    gl.uniform3f(loc.lc, amb.luz[0], amb.luz[1], amb.luz[2]); gl.uniform2f(loc.fg, 40 - 14 * amb.lluvia, 45 - 15 * amb.lluvia);
    gl.enableVertexAttribArray(loc.p); gl.enableVertexAttribArray(loc.u); gl.enableVertexAttribArray(loc.s);
    for (let cz = 0; cz < NCZ; cz++) for (let cx = 0; cx < NCX; cx++) {
      const ch = chunks[cz * NCX + cx]; if (!ch || !ch.n) continue;
      const dx = cx * CH + CH / 2 - jug.x, dz = cz * CH + CH / 2 - jug.z; if (dx * dx + dz * dz > 100 * 100) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, ch.pb); gl.vertexAttribPointer(loc.p, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, ch.ub); gl.vertexAttribPointer(loc.u, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, ch.sb); gl.vertexAttribPointer(loc.s, 1, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ch.ib); gl.drawElements(gl.TRIANGLES, ch.n, gl.UNSIGNED_INT, 0);
    }
    gl.disableVertexAttribArray(loc.u); gl.disableVertexAttribArray(loc.s);
    if (vis.length) {
      const tt = performance.now() / 1000;
      gl.useProgram(PC); gl.uniform3f(locC.cn, cielo[0], cielo[1], cielo[2]); gl.uniform3f(locC.lc, amb.luz[0], amb.luz[1], amb.luz[2]); gl.uniform2f(locC.fg, 40 - 14 * amb.lluvia, 45 - 15 * amb.lluvia);
      gl.bindBuffer(gl.ARRAY_BUFFER, cuboB); gl.enableVertexAttribArray(locC.p); gl.vertexAttribPointer(locC.p, 3, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(locC.s); gl.vertexAttribPointer(locC.s, 1, gl.FLOAT, false, 16, 12);
      gl.disable(gl.CULL_FACE);
      for (const v of vis) if (Math.hypot(v.n.x - jug.x, v.n.z - jug.z) < 64) dibujarAldeano(v, tt);
      if (cam.modo !== 0) { // tu personaje, con tu avatar
        const hv = Math.hypot(jug.vx, jug.vz); jugV.n.x = jug.x; jugV.n.y = jug.y; jugV.n.z = jug.z; jugV.h = jug.yaw + Math.PI;
        jugV.mover = hv > .3 && jug.suelo; jugV.amp += ((jugV.mover ? 1 : 0) - jugV.amp) * .2; if (jugV.mover) jugV.fase += hv * .03; jugV.nodFijo = Math.max(-.8, Math.min(.8, jug.pitch * .7));
        dibujarAldeano(jugV, tt);
      }
      gl.enable(gl.CULL_FACE); gl.disableVertexAttribArray(locC.p); gl.disableVertexAttribArray(locC.s);
    }
    dibujarDecor(cielo, tt0); dibujarAnimales(cielo, tt0); dibujarAtmosfera(cc, cielo, tt0, dt0);
    const h = apuntar();
    if (ctx.alApuntar) { // el docente ve quién puso el bloque que mira
      const au = h ? autores.get(clave(h.x, h.y, h.z)) : undefined, k = h ? (au === undefined ? "base" : String(au)) : "";
      if (k !== ultApuntado) { ultApuntado = k; try { ctx.alApuntar(h ? { autor: au === undefined ? null : au, x: h.x, y: h.y, z: h.z } : null); } catch (_) {} }
    }
    if (h) {
      gl.useProgram(PL); gl.uniformMatrix4fv(locL.m, false, new Float32Array(mul(M, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, h.x, h.y, h.z, 1])));
      gl.bindBuffer(gl.ARRAY_BUFFER, cajaB); gl.enableVertexAttribArray(locL.p); gl.vertexAttribPointer(locL.p, 3, gl.FLOAT, false, 0, 0);
      gl.disable(gl.CULL_FACE); gl.drawArrays(gl.LINES, 0, 24); gl.enable(gl.CULL_FACE);
    }
    // etiquetas de los portales
    const w = cv.clientWidth, hh = cv.clientHeight;
    etiquetas.forEach((e, i) => {
      const dx = e.x - jug.x, dz = e.z - jug.z, dist = Math.hypot(dx, dz), el = capaEt[i];
      if (dist > (e.clase ? 22 : 30)) { el.style.display = "none"; return; }
      const q = [M[0] * e.x + M[4] * e.y + M[8] * e.z + M[12], M[1] * e.x + M[5] * e.y + M[9] * e.z + M[13], M[3] * e.x + M[7] * e.y + M[11] * e.z + M[15]];
      if (q[2] <= .1) { el.style.display = "none"; return; }
      el.style.display = ""; el.style.left = ((q[0] / q[2] * .5 + .5) * w) + "px"; el.style.top = ((1 - (q[1] / q[2] * .5 + .5)) * hh) + "px";
    });
    // etiquetas de los personajes y el más cercano al que se puede hablar
    const fw = adelante(), fl = Math.hypot(fw[0], fw[2]) || 1; let cerca = null, mejor = 3.4;
    for (const v of vis) {
      const n = v.n, dx = n.x - jug.x, dz = n.z - jug.z, dist = Math.hypot(dx, dz), el = v.el, ey = n.y + 2.45;
      const q = [M[0] * n.x + M[4] * ey + M[8] * n.z + M[12], M[1] * n.x + M[5] * ey + M[9] * n.z + M[13], M[3] * n.x + M[7] * ey + M[11] * n.z + M[15]];
      if (dist > 24 || q[2] <= .1) el.style.display = "none";
      else { el.style.display = ""; el.style.left = ((q[0] / q[2] * .5 + .5) * w) + "px"; el.style.top = ((1 - (q[1] / q[2] * .5 + .5)) * hh) + "px"; }
      if (dist < mejor && Math.abs(n.y - jug.y) < 3 && (dx * fw[0] + dz * fw[2]) / (dist * fl + 1e-6) > .3) { mejor = dist; cerca = n; }
    }
    cercano = pausado ? null : cerca;
    animalCer = null;
    if (!cercano && !pausado && !ctx.vuelo) { let mj = 3; for (const a of animales) { const dx = a.x - jug.x, dz = a.z - jug.z, dist = Math.hypot(dx, dz); if (dist < mj && Math.abs(a.y - jug.y) < 2.5 && (dx * fw[0] + dz * fw[2]) / (dist * fl + 1e-6) > .45) { mj = dist; animalCer = a; } } }
    const algo = cercano || animalCer;
    hablarEl.style.display = algo ? "block" : "none"; if (algo) hablarEl.textContent = cercano ? "E · Hablar con " + cercano.nombre : "E · Acariciar " + animalCer.esp.nombre.toLowerCase();
    btnHab.style.display = algo ? "block" : "none";
  }
  let ult = performance.now(), raf = 0;
  // sonidos del entorno: pasos, agua, viento, pájaros, grillos, lluvia y música
  let pasoAcc = 0, enAguaAntes = false;
  function bajoTecho() { const x = Math.floor(jug.x), z = Math.floor(jug.z); for (let y = Math.floor(jug.y + 2); y < Math.floor(jug.y + 10) && y < SY; y++) { const b = get(x, y, z); if (b !== AIRE && b !== AGUA && b !== PORTAL && b !== 5) return true; } return false; }
  function ambienteSonoro(dt) {
    if (!ctx.vuelo) {
      const hv = Math.hypot(jug.vx, jug.vz);
      if (enAgua && !enAguaAntes) sonido.agua();
      if (jug.suelo && hv > .5 && !enAgua) { pasoAcc += hv * dt; if (pasoAcc >= (hv > 5 ? 1.5 : 2)) { pasoAcc = 0; sonido.paso(get(Math.floor(jug.x), Math.floor(jug.y - .05), Math.floor(jug.z)), hv > 5); } }
      else if (enAgua && hv > .5) { pasoAcc += hv * dt; if (pasoAcc >= 1.4) { pasoAcc = 0; sonido.agua(); } }
      else pasoAcc = Math.min(pasoAcc, 1.2);
      enAguaAntes = enAgua;
    }
    sonido.actualizar(dt, { dia: amb.dia, noche: amb.noche, lluvia: amb.lluvia, bajoTecho: ctx.vuelo ? false : bajoTecho(), enAgua, altura: jug.y });
  }
  const activarSonido = () => sonido.activar();
  on(window, "pointerdown", activarSonido, true); on(window, "keydown", activarSonido, true);

  function bucle(t) {
    if (!vivo) return;
    const dt = Math.min(.05, (t - ult) / 1000); ult = t;
    for (const k of sucios) construir(k % NCX, (k / NCX) | 0); sucios.clear();
    if (pausado) limpiarEntrada();
    actualizar(dt); quePicar(dt); moverNpcs(dt, performance.now() / 1000); moverAnimales(dt); vigilarPuertas(dt); dibujar(); ambienteSonoro(dt);
    const z = zonaDe(Math.floor(jug.x), Math.floor(jug.z)); if (z !== zonaAct) { zonaAct = z; ctx.alZona && ctx.alZona(z); }
    cooldownPortal = Math.max(0, cooldownPortal - dt);
    if (!cooldownPortal) for (const p of portalesZona) {
      if (jug.x > p.x + 1 && jug.x < p.x + 3 && Math.abs(jug.z - (p.z + .5)) < .6 && jug.y + .9 > p.y + 1 && jug.y < p.y + 4) { cooldownPortal = 3; sonido.portal(); ctx.alPortal && ctx.alPortal(p.id); break; }
    }
    raf = requestAnimationFrame(bucle);
  }
  setPuertas(ctx.puertas || {});
  jug.y = alt[(CENTRO + 6) * SX + CENTRO] + 1.1;
  raf = requestAnimationFrame(bucle);

  return {
    aplicar: (filas) => aplicar(filas),
    seleccionar: (i) => { sel = i; },
    setCalidad: (v) => { alta = !!v; tamano(); },
    setCamara: (o) => { Object.assign(cam, o); },
    getCamara: () => ({ ...cam }),
    ir: (x, y, z, yaw, pitch) => { jug.x = x; jug.y = y; jug.z = z; if (yaw != null) jug.yaw = yaw; if (pitch != null) jug.pitch = pitch; jug.vx = jug.vy = jug.vz = 0; },
    setAvatar: (c) => ponerAvatar(c),
    setPuertas: (m) => setPuertas(m),
    setSonido: (o) => sonido.ajustar(o || {}), getSonido: () => sonido.estado(),
    setAmbiente: (o) => { if (!o) return; if ("hora" in o) ambiente.fijarHora(o.hora); if ("clima" in o) ambiente.fijarClima(o.clima); },
    getAmbiente: () => ({ hora: amb.hora, lluvia: amb.lluvia, dia: amb.dia }),
    pausar: (v) => { pausado = !!v; if (!pausado) hablandoCon = null; if (pausado) { limpiarEntrada(); if (bloqueado()) document.exitPointerLock(); } else if (jugando && !sinBloqueo) ayuda.textContent = "Haz clic para seguir jugando"; },
    actualizarNpcs: (lista) => montarNpcs(lista),
    posicion: () => ({ x: jug.x, y: jug.y, z: jug.z }),
    _debug: { jug, apuntar, get, picarAhora: (v) => { picar = v; }, poner, animales, ambiente, sonido },
    cerrar: () => {
      vivo = false; cancelAnimationFrame(raf); ro.disconnect();
      escuchas.forEach(([o, e, f, op]) => o.removeEventListener(e, f, op));
      if (bloqueado()) document.exitPointerLock();
      chunks.forEach((c) => { if (c) { gl.deleteBuffer(c.pb); gl.deleteBuffer(c.ub); gl.deleteBuffer(c.sb); gl.deleteBuffer(c.ib); } });
      sonido.cerrar(); limpiarNpcs(); gl.deleteTexture(tex); const ex = gl.getExtension("WEBGL_lose_context"); if (ex) ex.loseContext();
      raiz.remove();
    },
  };
}
