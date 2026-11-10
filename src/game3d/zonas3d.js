// Códice Craft · Diez zonas de exploración (aldeas, ciudad del Ágora, ruinas, isla, pantano, cañón, jardín, volcán, bosque de cristal, cumbre).
// Todo se genera igual en cada mundo (sin azar propio: solo el ruido de la semilla), así que no cambia lo que ya construyeron los estudiantes fuera de estas zonas.
// Ninguna de estas zonas está protegida: se puede picar y construir. La única zona protegida es la Aldea del Códice (centro del mapa).

export const ZONAS = [
  { k: "valle", nombre: "Valle de la Gratitud", emoji: "🌾", cx: 132, cz: 56, r: 15, f: 6, hab: "campo", aldea: true, desc: "Aldea de agricultores en un valle verde. Los aldeanos cuentan por qué dar las gracias importa." },
  { k: "agora", nombre: "Ciudad del Ágora", emoji: "🏛️", cx: 28, cz: 140, r: 28, f: 6, hab: "campo", ciudad: true, desc: "Ciudad restaurada con Iglesia, Universidad, Mercado y Casa política: todos con puerta y por dentro se puede entrar." },
  { k: "faro", nombre: "Isla del Faro", emoji: "🗼", cx: 194, cz: 232, r: 17, f: 4, hab: "lago", aldea: true, desc: "Aldea de pescadores en una isla con faro y muelle de madera." },
  { k: "pantano", nombre: "Pantano de la Duda", emoji: "🪷", cx: 64, cz: 236, r: 16, f: 6, hab: "lago", desc: "Agua turbia, árboles secos y una cabaña sobre pilotes. Aquí se aprende a dudar bien." },
  { k: "canon", nombre: "Cañón de las Brújulas", emoji: "🧭", cx: 232, cz: 170, r: 13, f: 6, hab: "desierto", desc: "Cañón de arena roja con un río, un puente natural y una gran rosa de los vientos." },
  { k: "jardin", nombre: "Jardín de Confucio", emoji: "🏮", cx: 182, cz: 112, r: 13, f: 5, hab: "campo", desc: "Jardín sereno con estanque, puente, pabellón y farolillos." },
  { k: "volcan", nombre: "Volcán Dormido", emoji: "🌋", cx: 234, cz: 230, r: 14, f: 6, hab: "monte", desc: "Cono de basalto con un lago de agua tibia en el cráter. Duerme, pero no está muerto." },
  { k: "cristal", nombre: "Bosque de Cristal", emoji: "💎", cx: 16, cz: 232, r: 14, f: 6, hab: "bosque", desc: "Espigas de cristal y árboles de hielo que brillan con luz propia." },
  { k: "minera", nombre: "Aldea Minera", emoji: "⛏️", cx: 70, cz: 170, r: 16, f: 5, hab: "monte", aldea: true, desc: "Aldea al pie de una colina con mina, herrería y vetas de mineral." },
  { k: "cumbre", nombre: "Cumbre de la Sabiduría", emoji: "🏔️", cx: 134, cz: 16, r: 11, f: 11, hab: "monte", desc: "Meseta alta con un templo de columnas. Se sube por una escalera de piedra." },
];
// Cursos que ya tenían construcciones de estudiantes dentro de estas zonas: para ellos esa zona no se remodela (así su obra no queda enterrada).
export const APAGADAS = { "902": ["cumbre", "valle", "cristal", "pantano"] };
export const POR_NOMBRE = Object.fromEntries(ZONAS.map((z) => [z.nombre, z]));

const sm = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
// ¿en qué zona nueva está (x, z)? Devuelve [zona, peso 0..1]; peso 1 dentro del núcleo y baja hasta 0 en el borde exterior (para fundir el terreno)
export function zonaPeso(x, z, R, off) {
  let mejor = null, mw = 0;
  for (const zn of ZONAS) {
    if (off && off.includes(zn.k)) continue;
    const dx = x - zn.cx, dz = z - zn.cz;
    if (Math.abs(dx) > zn.r + zn.f + 6 || Math.abs(dz) > zn.r + zn.f + 6) continue;
    const d = Math.hypot(dx, dz) + (R ? (R(401, x * .09, z * .09) - .5) * 3 : 0);
    const w = d <= zn.r ? 1 : sm(1 - (d - zn.r) / zn.f);
    if (w > mw) { mw = w; mejor = zn; }
  }
  return mejor ? [mejor, mw] : null;
}
// zona (nombre) para el chip de zona y las criaturas: solo el núcleo
export function zonaNuevaDe(x, z) {
  for (const zn of ZONAS) { const dx = x - zn.cx, dz = z - zn.cz; if (dx * dx + dz * dz <= zn.r * zn.r) return zn; }
  return null;
}

// altura que "quiere" la zona en (x, z); h0 es la altura original del terreno
export function objetivo(zn, x, z, h0, R) {
  const dx = x - zn.cx, dz = z - zn.cz, d = Math.hypot(dx, dz), n = R(55, x * .13, z * .13);
  switch (zn.k) {
    case "valle": return d < 11 ? 13 : 13 + Math.pow(Math.min(1, (d - 11) / 10), 1.6) * 6 + (n - .5) * 1.5;
    case "agora": return 12;
    case "faro": return d < 11 ? 13 + (1 - d / 11) * 3.4 : d < 13.2 ? 13 - sm((d - 11) / 2.2) * 5 : 8;
    case "pantano": { if (d < 6) return 12; const p = R(61, x * .11, z * .11); return p > .56 ? 9 : p > .5 ? 11 : 12 + Math.round(n * 1.4); }
    case "canon": {
      const xc = zn.cx + 4 * Math.sin(z * .22), u = Math.abs(x - xc), W = 4 + Math.sin(z * .5) * 1.2, meseta = 21 + (n - .5) * 2;
      if (u < 1.8) return 9; if (u < W) return 12; return 12 + (meseta - 12) * sm((u - W) / 2.2);
    }
    case "jardin": return 13 + (n - .5) * .8;
    case "volcan": { const cono = (dd) => 13 + 18 * Math.pow(Math.max(0, 1 - dd / 20), 1.2); return d < 3.8 ? 22 : d < 5.5 ? 22 + (cono(5.5) - 22) * sm((d - 3.8) / 1.7) : cono(d); }
    case "cristal": return 13 + Math.round((n - .5) * 5);
    case "minera": { const n2 = Math.max(0, 1 - Math.hypot(dx, dz + 15) / 13); return d < 11 && dz > -6 ? 14 : 14 + n2 * n2 * 14; }
    case "cumbre": return d < 11 ? 27 : 27 - (d - 11) / (zn.f) * 14;
  }
  return h0;
}
// bloques de la superficie y del subsuelo de la zona: [arriba, debajo]
export function superficie(zn, x, z, h, R) {
  switch (zn.k) {
    case "pantano": return [R(71, x * .2, z * .2) > .55 ? 31 : 2, 2];
    case "canon": return [27, 27];
    case "volcan": return [h >= 27 ? 33 : 112, h >= 27 ? 33 : 3];
    case "cumbre": return [h >= 25 ? (R(73, x * .3, z * .3) > .5 ? 28 : 3) : 3, 3];
    case "faro": return h <= 12 ? [9, 9] : [1, 2];
    case "minera": return h >= 17 ? [3, 3] : [1, 2];
    case "cristal": return [1, 2];
    case "agora": return [1, 2];
  }
  return [1, 2];
}

// ---------------------------------------------------------------------------------------------------------------
// Construcciones. `A` = { set, get, alt, setAlt, hz, SX, SZ, SY, etiquetas, antorchas, npc }
// ---------------------------------------------------------------------------------------------------------------
const AIRE = 0, AGUA = 11;
const TABLON = 6, LADRILLO = 7, CRISTAL = 8, ARENA = 9, ADOQ = 13, PIEDRA = 3, TRONCO = 4, HOJAS = 5, LAMP = 36;
const LANA = { blanca: 19, roja: 20, azul: 21, verde: 22, amarilla: 23 };

function caja(A, x0, y0, z0, x1, y1, z1, b) { for (let y = y0; y <= y1; y++) for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) A.set(x, y, z, b); }
function nivelar(A, x0, z0, x1, z1, y, alto = 14) {
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    if (x < 2 || z < 2 || x >= A.SX - 2 || z >= A.SZ - 2) continue;
    const a = A.alt(x, z);
    for (let yy = Math.min(a, y) + 1; yy <= y; yy++) A.set(x, yy, z, 2);
    for (let yy = y + 1; yy <= y + alto && yy < A.SY; yy++) A.set(x, yy, z, AIRE);
    A.set(x, y, z, 1); A.setAlt(x, z, y);
  }
}
const ladoHacia = (dx, dz) => (Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? "O" : "E") : (dz > 0 ? "N" : "S")); // lado de la puerta para mirar al centro
const DIR = { N: [0, -1], S: [0, 1], E: [1, 0], O: [-1, 0] };

// casa pequeña de aldea: w × d (impares), puerta en `lado`, techo en pirámide
function casa(A, { x, z, w = 5, d = 5, alto = 4, pared = TABLON, techo = LADRILLO, lado = "S", y0, interior = true, nivel = true }) {
  const hx = (w - 1) >> 1, hz = (d - 1) >> 1; y0 = y0 ?? A.alt(x, z);
  if (nivel) nivelar(A, x - hx - 2, z - hz - 2, x + hx + 2, z + hz + 2, y0);
  for (let dz = -hz; dz <= hz; dz++) for (let dx = -hx; dx <= hx; dx++) {
    const borde = Math.abs(dx) === hx || Math.abs(dz) === hz;
    A.set(x + dx, y0, z + dz, TABLON);
    for (let y = y0 + 1; y <= y0 + alto; y++) A.set(x + dx, y, z + dz, borde ? (borde && (Math.abs(dx) === hx && Math.abs(dz) === hz) ? TRONCO : pared) : AIRE);
  }
  for (let k = 0; ; k++) {
    const a0 = x - hx - 1 + k, a1 = x + hx + 1 - k, b0 = z - hz - 1 + k, b1 = z + hz + 1 - k; if (a0 > a1 || b0 > b1) break;
    caja(A, a0, y0 + alto + 1 + k, b0, a1, y0 + alto + 1 + k, b1, techo);
  }
  const dir = DIR[lado]; const px = x + dir[0] * hx, pz = z + dir[1] * hz;
  A.set(px, y0 + 1, pz, AIRE); A.set(px, y0 + 2, pz, AIRE);
  const per = [-dir[1], dir[0]];
  for (const s of [-1, 1]) { // ventanas a los lados de la puerta y atrás
    const wx = px + per[0] * s * 2, wz = pz + per[1] * s * 2;
    if (Math.abs(wx - x) <= hx && Math.abs(wz - z) <= hz) A.set(wx, y0 + 2, wz, CRISTAL);
    const bx = x - dir[0] * hx + per[0] * s * 1, bz = z - dir[1] * hz + per[1] * s * 1; A.set(bx, y0 + 2, bz, CRISTAL);
  }
  if (interior) { A.set(x, y0 + alto, z, LAMP); A.set(x - per[0] * (hx - 1) - dir[0] * (hx - 1) * 0, y0 + 1, z - per[1] * (hz - 1), TABLON); }
  A.antorchas.push([px + dir[0] * 1 + per[0] * 1 + .5, y0 + 1.4, pz + dir[1] * 1 + per[1] * 1 + .5]);
  return { px, pz, y0, dir };
}
// camino de adoquín entre dos puntos siguiendo el terreno
function camino(A, x0, z0, x1, z1, b = ADOQ) {
  const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0));
  for (let i = 0; i <= n; i++) { const x = Math.round(x0 + (x1 - x0) * i / (n || 1)), z = Math.round(z0 + (z1 - z0) * i / (n || 1)); for (const [ox, oz] of [[0, 0], [1, 0]]) { const a = A.alt(x + ox, z + oz); if (A.get(x + ox, a, z + oz) !== AGUA && A.get(x + ox, a, z + oz) !== TABLON) A.set(x + ox, a, z + oz, b); } }
}
function pozo(A, x, z) {
  const a = A.alt(x, z);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { A.set(x + dx, a, z + dz, dx || dz ? PIEDRA : AGUA); if (dx || dz) A.set(x + dx, a + 1, z + dz, PIEDRA); }
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (let y = a + 2; y <= a + 4; y++) A.set(x + dx, y, z + dz, TRONCO);
  caja(A, x - 1, a + 5, z - 1, x + 1, a + 5, z + 1, TABLON);
}
function farol(A, x, y, z, h = 3) { A.set(x, y, z, PIEDRA); for (let k = 1; k <= h; k++) A.set(x, y + k, z, TRONCO); A.set(x, y + h + 1, z, LAMP); }
function arbol(A, x, z, t = 4, hoja = HOJAS, tr = TRONCO) {
  const a = A.alt(x, z); for (let k = 1; k <= t; k++) A.set(x, a + k, z, tr);
  for (let dy = -2; dy <= 1; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) <= 3 && !(dx === 0 && dz === 0 && dy < 0)) { if (A.get(x + dx, a + t + dy, z + dz) === AIRE) A.set(x + dx, a + t + dy, z + dz, hoja); }
}
const rotulo = (A, x, y, z, texto) => A.etiquetas.push({ x: x + .5, y, z: z + .5, texto, clase: "edif" });

// ---------- aldeas ----------
function aldea(A, zn, { casas, pozoEn, aldeanos, extra }) {
  const c = [zn.cx, zn.cz];
  nivelar(A, c[0] - 11, c[1] - 11, c[0] + 11, c[1] + 11, A.alt(c[0], c[1]), 3);
  if (pozoEn) pozo(A, c[0] + pozoEn[0], c[1] + pozoEn[1]);
  const puertas = [];
  for (const [dx, dz, w, d, pared, techo] of casas) {
    const p = casa(A, { x: c[0] + dx, z: c[1] + dz, w, d, pared, techo, lado: ladoHacia(dx, dz) });
    puertas.push(p); camino(A, p.px + p.dir[0] * 1, p.pz + p.dir[1] * 1, c[0] + (pozoEn ? pozoEn[0] : 0), c[1] + (pozoEn ? pozoEn[1] : 0) + (pozoEn ? 2 : 0));
  }
  if (extra) extra(A, zn, c);
  rotulo(A, c[0], A.alt(c[0], c[1]) + 9, c[1], zn.emoji + " " + zn.nombre);
  aldeanos.forEach((a, i) => { const ang = i / aldeanos.length * Math.PI * 2 + .5, r = a.r ?? 4; A.npc({ id: "L-" + zn.k + "-" + i, nombre: a.n, emoji: "🧑", x: Math.round(c[0] + Math.cos(ang) * r), z: Math.round(c[1] + Math.sin(ang) * r), frases: a.f, zona: zn.nombre, ...a.x }); });
}

// ---------- edificios grandes de la ciudad ----------
// dir = hacia dónde mira la puerta (hacia la plaza); coordenadas locales: u a lo ancho, v a lo hondo (v = +D es la fachada)
function salon(A, { cx, cz, dir, W, D, alto = 7, pared = LADRILLO, piso = TABLON, y0 = 12 }) {
  const pa = [-dir[1], dir[0]]; const X = (u, v) => cx + u * pa[0] + v * dir[0], Z = (u, v) => cz + u * pa[1] + v * dir[1];
  const L = (u, v, y, b) => A.set(X(u, v), y, Z(u, v), b);
  for (let v = -D - 2; v <= D + 3; v++) for (let u = -W - 2; u <= W + 2; u++) { for (let y = y0 + 1; y <= y0 + alto + 4; y++) L(u, v, y, AIRE); }
  for (let v = -D; v <= D; v++) for (let u = -W; u <= W; u++) {
    const borde = Math.abs(u) === W || Math.abs(v) === D;
    L(u, v, y0, piso);
    for (let y = y0 + 1; y <= y0 + alto; y++) L(u, v, y, borde ? pared : AIRE);
    L(u, v, y0 + alto + 1, TABLON);
    if (borde) L(u, v, y0 + alto + 2, PIEDRA); // pretil
  }
  for (let u = -1; u <= 1; u++) for (let y = y0 + 1; y <= y0 + 4; y++) L(u, D, y, AIRE); // puerta de 3 × 4
  for (let u = -2; u <= 2; u += 4) for (let y = y0 + 1; y <= y0 + 4; y++) L(u, D, y, PIEDRA);
  for (let v = D + 1; v <= D + 2; v++) for (let u = -3; u <= 3; u++) { L(u, v, y0, ADOQ); } // escalón
  return { L, X, Z, pa };
}
// ---------- la Iglesia: planta de cruz con 4 naves, cúpula, altar, ambón y sede ----------
// (cx, cz) = centro del crucero. Nave de entrada al oeste (puerta hacia la plaza), presbiterio al este, transeptos al norte y al sur.
function iglesia(A, cx, cz) {
  const y0 = 12, L = 13, S = (a, b, y, bl) => A.set(cx + a, y, cz + b, bl);
  nivelar(A, cx - L - 4, cz - L - 4, cx + L + 4, cz + L + 4, y0, 30);
  const dentro = (a, b) => (Math.abs(a) <= 4 && Math.abs(b) <= L) || (Math.abs(b) <= 4 && Math.abs(a) <= L);
  const pared = (a, b) => { if (dentro(a, b)) return false; for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) if (dentro(a + da, b + db)) return true; return false; };
  const dist = (a, b) => Math.hypot(a, b);
  const vit = [LANA.roja, LANA.azul, LANA.amarilla, LANA.verde];
  for (let b = -L - 1; b <= L + 1; b++) for (let a = -L - 1; a <= L + 1; a++) {
    const d = dentro(a, b), w = pared(a, b); if (!d && !w) continue;
    S(a, b, y0, ((a + b) & 1) ? PIEDRA : 34);
    for (let y = y0 + 1; y <= y0 + 9; y++) S(a, b, y, w ? ((Math.abs(a) === 5 && Math.abs(b) === 5) ? PIEDRA : 34) : AIRE);
    if (!(d && dist(a, b) <= 4.3)) S(a, b, y0 + 10, w ? PIEDRA : TABLON); // techo (el crucero queda abierto bajo la cúpula)
    else S(a, b, y0 + 10, AIRE);
    if (w) S(a, b, y0 + 11, PIEDRA); // pretil
  }
  // alfombra roja por la nave central y el crucero
  for (let a = -L; a <= L; a++) for (let b = -1; b <= 1; b++) S(a, b, y0, LANA.roja);
  for (let b = -L; b <= L; b++) for (let a = -1; a <= 1; a++) if (Math.abs(b) <= 4 || Math.abs(a) <= 1) S(a, b, y0, a === 0 && Math.abs(b) <= 1 ? LANA.amarilla : LANA.roja);
  // ----- cúpula: tambor con ventanas, bóveda de ladrillo, linterna y cruz -----
  for (let b = -6; b <= 6; b++) for (let a = -6; a <= 6; a++) {
    const d = dist(a, b);
    for (let y = y0 + 10; y <= y0 + 13; y++) if (d > 4.3 && d <= 5.4) {
      const ventana = y >= y0 + 11 && y <= y0 + 12 && d > 4.8 && (a === 0 || b === 0 || Math.abs(a) === Math.abs(b));
      S(a, b, y, ventana ? CRISTAL : PIEDRA);
    }
    for (let dy = 0; dy <= 6; dy++) { const d3 = Math.hypot(a, b, dy); if (d3 >= 4.3 && d3 <= 5.4) S(a, b, y0 + 14 + dy, LADRILLO); }
  }
  S(0, 0, y0 + 19, LAMP); S(0, 0, y0 + 20, CRISTAL);
  for (let y = y0 + 21; y <= y0 + 25; y++) S(0, 0, y, 17); S(-1, 0, y0 + 23, 17); S(1, 0, y0 + 23, 17); S(0, -1, y0 + 23, 17); S(0, 1, y0 + 23, 17);
  // ----- torre-campanario sobre la fachada -----
  for (let y = y0 + 11; y <= y0 + 19; y++) for (let b = -2; b <= 2; b++) for (let a = -L - 1; a <= -L + 3; a++) {
    const borde = b === -2 || b === 2 || a === -L - 1 || a === -L + 3;
    S(a, b, y, borde ? ((y >= y0 + 16 && y <= y0 + 18 && (b === 0 || a === -L + 1) ) ? CRISTAL : 34) : AIRE);
  }
  for (let b = -2; b <= 2; b++) for (let a = -L - 1; a <= -L + 3; a++) S(a, b, y0 + 20, PIEDRA);
  for (let y = y0 + 21; y <= y0 + 25; y++) S(-L + 1, 0, y, 17); S(-L, 0, y0 + 23, 17); S(-L + 2, 0, y0 + 23, 17);
  // ----- fachada: puerta grande y rosetón; escalinata -----
  for (let b = -1; b <= 1; b++) for (let y = y0 + 1; y <= y0 + 5; y++) S(-L - 1, b, y, AIRE);
  for (let b = -1; b <= 1; b++) for (let y = y0 + 7; y <= y0 + 8; y++) S(-L - 1, b, y, CRISTAL);
  for (let b = -3; b <= 3; b++) for (let a = -L - 3; a <= -L - 2; a++) S(a, b, y0, ADOQ);
  for (const b of [-3, 3]) { farol(A, cx - L - 3, y0 + 1, cz + b, 3); A.antorchas.push([cx - L - 3 + .5, y0 + 5.2, cz + b + .5]); }
  // ----- vitrales de las naves -----
  const tira = (a, b, eje) => { for (let y = y0 + 3; y <= y0 + 7; y++) S(a, b, y, vit[(a + b + y + 16) % 4]); };
  for (const a of [-11, -8, 8, 11]) for (const sg of [-1, 1]) tira(a, sg * 5);
  for (const b of [-11, -8, 8, 11]) for (const sg of [-1, 1]) tira(sg * 5, b);
  for (let b = -3; b <= 3; b++) for (let y = y0 + 3; y <= y0 + 8; y++) S(L + 1, b, y, vit[(b + y + 12) % 4]);   // gran vitral del presbiterio
  for (let a = -2; a <= 2; a++) for (let y = y0 + 3; y <= y0 + 7; y++) { S(a, -L - 1, y, vit[(a + y + 12) % 4]); S(a, L + 1, y, vit[(a + y + 13) % 4]); }
  // ----- sillas en cada una de las 4 naves (asiento rojo + respaldo de madera) -----
  const silla = (a, b, da, db) => { S(a, b, y0 + 1, LANA.roja); S(a + da, b + db, y0 + 1, TABLON); S(a + da, b + db, y0 + 2, TABLON); };
  let sillas = 0;
  for (const a of [-12, -10, -8, -6]) for (const b of [-4, -3, 3, 4]) { silla(a, b, -1, 0); sillas++; }   // nave de entrada (mira al altar)
  for (const b of [-12, -10, -8, -6]) for (const a of [-4, -3, 3, 4]) { silla(a, b, 0, -1); sillas++; }   // nave norte
  for (const b of [12, 10, 8, 6]) for (const a of [-4, -3, 3, 4]) { silla(a, b, 0, 1); sillas++; }        // nave sur
  // ----- presbiterio (nave este): tarima, altar, ambón, sede y cruz -----
  for (let b = -4; b <= 4; b++) for (let a = 7; a <= L; a++) S(a, b, y0 + 1, PIEDRA);
  for (let b = -4; b <= 4; b++) S(6, b, y0 + 1, PIEDRA);
  for (let b = -1; b <= 1; b++) { S(10, b, y0 + 2, PIEDRA); S(10, b, y0 + 3, LANA.blanca); }            // altar con mantel
  for (const b of [-2, 2]) { S(10, b, y0 + 2, PIEDRA); S(10, b, y0 + 3, LAMP); }                           // velas
  S(10, 0, y0 + 4, 17);                                                                                    // cáliz dorado
  S(8, -3, y0 + 2, PIEDRA); S(8, -3, y0 + 3, PIEDRA); S(8, -3, y0 + 4, TABLON); S(8, -3, y0 + 5, LANA.roja); // ambón con el libro
  S(12, 0, y0 + 2, LANA.roja); S(12, -1, y0 + 2, TABLON); S(12, 1, y0 + 2, TABLON);                      // sede (silla del sacerdote)
  for (let y = y0 + 2; y <= y0 + 4; y++) S(13, 0, y, TABLON); S(13, -1, y0 + 3, TABLON); S(13, 1, y0 + 3, TABLON);
  for (let y = y0 + 5; y <= y0 + 8; y++) S(13, 0, y, 17); S(13, -1, y0 + 7, 17); S(13, 1, y0 + 7, 17);   // cruz dorada
  for (const b of [-3, 3]) { S(12, b, y0 + 2, LANA.roja); S(13, b, y0 + 2, TABLON); }                      // sillas de los acólitos
  // ----- luces -----
  for (const [a, b] of [[-11, 0], [-7, 0], [0, -11], [0, -7], [0, 7], [0, 11], [8, -3], [8, 3], [12, 0], [-4, -4], [4, -4], [-4, 4], [4, 4]]) S(a, b, y0 + 9, LAMP);
  for (const [a, b] of [[-9, -4], [-9, 4], [-9, 0]]) S(a, b, y0 + 9, LAMP);
  // ----- rótulos y personas -----
  const rot = (a, b, y, t) => A.etiquetas.push({ x: cx + a + .5, y, z: cz + b + .5, texto: t, clase: "edif" });
  rot(-L - 3, 0, y0 + 13, "⛪ Iglesia de la Esperanza"); rot(10, 0, y0 + 7, "Altar"); rot(8, -3, y0 + 7, "Ambón"); rot(12, 0, y0 + 6, "Sede");
  A.npc({ id: "L-igl-0", nombre: "Padre Anselmo", emoji: "✝️", x: cx + 9, z: cz + 1, y: y0 + 2, r: 1.2, zona: "Ciudad del Ágora",
    look: { ropa: "#15151a", pant: "#15151a", piel: "#e6b999", pelo: "#d9d9d9", largo: true, capa: "#6a1b9a" },
    frases: ["Bienvenido a la Iglesia de la Esperanza. Aquí todos son recibidos en paz, sin importar lo que crean.", "Este es el altar, donde se celebra la misa. A su lado está el ambón, desde donde se leen las lecturas, y la sede, el asiento de quien preside.", "Tiene cuatro naves: la de entrada, la del presbiterio y los dos brazos de la cruz. Bajo la cúpula se cruzan todas.", "La esperanza no es esperar sentado: es trabajar hoy por algo mejor.", "Dar las gracias es el primer paso para cuidar a quien nos cuida."] });
  A.npc({ id: "L-igl-1", nombre: "Hermana Lucía", emoji: "🕯️", x: cx - 9, z: cz + 1, y: y0 + 1, r: 1.5, zona: "Ciudad del Ágora",
    look: { ropa: "#1d2433", pant: "#1d2433", piel: "#d9a47c", pelo: "#2b1b12", largo: true, acc: "capucha" },
    frases: ["Estos vitrales los armaron entre muchos vecinos, pieza por pieza.", "Una comunidad se construye como una iglesia: bloque a bloque, entre todos.", "Si alguien está triste, acompañarlo ya es una buena obra.", "Hay " + sillas + " sillas en las cuatro naves. ¡Siéntate a descansar un momento!"] });
}
function ciudad(A, zn) {
  const [cx, cz] = [zn.cx, zn.cz], y0 = 12;
  nivelar(A, cx - 27, cz - 27, cx + 27, cz + 27, y0, 22);
  // calles y plaza
  caja(A, cx - 9, y0, cz - 9, cx + 9, y0, cz + 9, ADOQ);
  caja(A, cx - 2, y0, cz - 27, cx + 2, y0, cz + 27, ADOQ); caja(A, cx - 27, y0, cz - 2, cx + 27, y0, cz + 2, ADOQ);
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { const borde = Math.max(Math.abs(dx), Math.abs(dz)) === 3; A.set(cx + dx, y0, cz + dz, borde ? PIEDRA : AGUA); if (borde) A.set(cx + dx, y0 + 1, cz + dz, PIEDRA); }
  for (let y = y0 + 1; y <= y0 + 4; y++) A.set(cx, y, cz, PIEDRA); A.set(cx, y0 + 5, cz, AGUA); A.set(cx, y0 + 6, cz, LAMP);
  for (const [dx, dz] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) { farol(A, cx + dx, y0 + 1, cz + dz, 3); A.antorchas.push([cx + dx + .5, y0 + 5.2, cz + dz + .5]); }
  const edif = [
    { k: "universidad", nombre: "Universidad del Ágora", emoji: "🎓", dir: [0, 1], W: 6, D: 6 },
    { k: "mercado", nombre: "Mercado Central", emoji: "🛒", dir: [0, -1], W: 6, D: 6 },
    { k: "politica", nombre: "Casa política · Cabildo", emoji: "🏛️", dir: [1, 0], W: 6, D: 5 },
  ];
  iglesia(A, cx + 24, cz); // la Iglesia grande va al este de la plaza, con la puerta hacia ella

  // la puerta mira a la plaza: el edificio queda detrás de la fachada v=+D, que está a 10 de la plaza
  for (const e of edif) {
    const fach = 10; // distancia del centro de la ciudad a la fachada
    const bx = cx - e.dir[0] * (fach + e.D) , bz = cz - e.dir[1] * (fach + e.D);
    const s = salon(A, { cx: bx, cz: bz, dir: e.dir, W: e.W, D: e.D, alto: e.k === "iglesia" ? 8 : 6, pared: e.k === "iglesia" ? PIEDRA : e.k === "politica" ? LADRILLO : e.k === "mercado" ? TABLON : LADRILLO, piso: e.k === "mercado" ? ADOQ : e.k === "iglesia" ? PIEDRA : TABLON });
    const { L, X, Z } = s, W = e.W, D = e.D;
    // lámparas del techo
    for (let v = -D + 2; v <= D - 2; v += 4) for (let u = -W + 3; u <= W - 3; u += 6) L(u, v, y0 + (e.k === "iglesia" ? 8 : 6), LAMP);
    A.antorchas.push([X(-3, D + 1) + .5, y0 + 1.6, Z(-3, D + 1) + .5], [X(3, D + 1) + .5, y0 + 1.6, Z(3, D + 1) + .5]);
    rotulo(A, X(0, D + 1), y0 + (e.k === "iglesia" ? 14 : 11), Z(0, D + 1), e.emoji + " " + e.nombre);
    if (e.k === "universidad") {
      for (let u = -4; u <= 4; u++) for (let y = y0 + 2; y <= y0 + 4; y++) L(u, -D + 1, y, 35); // pizarra
      L(-5, -D + 1, y0 + 3, LANA.amarilla); L(5, -D + 1, y0 + 3, LANA.amarilla);
      for (let v = -1; v <= 4; v += 2) for (const u of [-5, -4, -3, 3, 4, 5]) L(u, v, y0 + 1, TABLON); // pupitres
      for (let u = -1; u <= 1; u++) L(u, -D + 3, y0 + 1, TABLON); // escritorio del profesor
      for (const sg of [-1, 1]) for (let v = -D + 2; v <= D - 3; v++) for (let y = y0 + 1; y <= y0 + 3; y++) L(sg * (W - 1), v, y, [LANA.roja, LANA.azul, LANA.verde, LANA.amarilla][(v + y) & 3]); // libros
      for (let u = -2; u <= 2; u++) L(u, D, y0 + 5, LANA.azul);
      A.npc({ id: "L-uni-0", nombre: "Rectora Valentina", emoji: "🎓", x: X(0, -D + 5), z: Z(0, -D + 5), r: 1.5, zona: "Ciudad del Ágora", frases: ["Bienvenido a la Universidad del Ágora: aquí se aprende a preguntar mejor, no solo a responder.", "Un buen estudiante lee, practica y se atreve a equivocarse.", "Universidad viene de universo: aprender de todo, con todos."] });
      A.npc({ id: "L-uni-1", nombre: "Profesor Matías", emoji: "📐", x: X(-4, 3), z: Z(-4, 3), r: 1.2, zona: "Ciudad del Ágora", frases: ["Mira la pizarra: dos más dos son cuatro, pero ¿sabes por qué?", "El método es simple: observar, preguntar, probar y volver a probar.", "Los errores son datos. Un científico los celebra."] });
      A.npc({ id: "L-uni-2", nombre: "Bibliotecaria Inés", emoji: "📚", x: X(5, -2), z: Z(5, -2), r: 1.2, zona: "Ciudad del Ágora", frases: ["Cada libro es una conversación con alguien que no conocerás.", "Leer 15 minutos al día son más de 90 horas al año. ¡Haz la cuenta!", "Shhh… aquí se piensa en voz baja."] });
    } else if (e.k === "mercado") {
      for (const sg of [-1, 1]) for (let v = -D + 2; v <= D - 3; v += 3) {
        const toldo = ((v + 20) % 2) ? LANA.roja : LANA.amarilla;
        for (let u = 3; u <= 5; u++) { L(sg * u, v, y0 + 1, TABLON); for (let dv = -1; dv <= 1; dv++) L(sg * u, v + dv, y0 + 4, toldo); }
        L(sg * 5, v, y0 + 2, 31);
        for (const u of [3, 5]) for (let y = y0 + 1; y <= y0 + 3; y++) L(sg * u, v - 1, y, TRONCO);
      }
      A.npc({ id: "L-mer-0", nombre: "Doña Cecilia · Mercader", emoji: "🛒", x: X(4, 0), z: Z(4, 0), r: 0.6, zona: "Ciudad del Ágora", mercader: true, frases: ["¡Pasen, pasen! Cambio lo que cosechas por esmeraldas… digo, por monedas del Códice."] });
      A.npc({ id: "L-mer-1", nombre: "Don Efraín · Panadero", emoji: "🥖", x: X(-4, 0), z: Z(-4, 0), r: 0.6, zona: "Ciudad del Ágora", frases: ["El pan se hace con trigo, agua, fuego y paciencia. Como casi todo lo bueno.", "¿Tienes trigo? En el horno de la aldea lo vuelves pan y te sirve de comida."] });
      A.npc({ id: "L-mer-2", nombre: "Mateo · Aprendiz", emoji: "🧺", x: X(0, -3), z: Z(0, -3), r: 1.5, zona: "Ciudad del Ágora", frases: ["Aprendo a vender: precio justo, trato amable y nunca engañar al cliente.", "Un buen comerciante cuenta bien, pero también escucha bien."] });
    } else {
      for (let u = -4; u <= 4; u++) { L(u, -D + 3, y0 + 1, TABLON); if (Math.abs(u) === 4) { L(u, -D + 2, y0 + 1, TABLON); L(u, -D + 1, y0 + 1, TABLON); } } // mesa en U
      for (let u = -3; u <= 3; u += 2) L(u, -D + 5, y0 + 1, TABLON); for (let u = -3; u <= 3; u += 2) L(u, 0, y0 + 1, TABLON); // asientos
      const bandera = (u0) => { for (const u of [u0 - 1, u0, u0 + 1]) { L(u, -D + 1, y0 + 5, LANA.amarilla); L(u, -D + 1, y0 + 4, LANA.amarilla); L(u, -D + 1, y0 + 3, LANA.azul); L(u, -D + 1, y0 + 2, LANA.roja); } };
      bandera(0); L(-4, -D + 1, y0 + 3, LANA.blanca); L(4, -D + 1, y0 + 3, LANA.blanca);
      L(-5, D - 2, y0 + 1, TABLON); L(-5, D - 2, y0 + 2, CRISTAL); // urna de votación
      A.npc({ id: "L-pol-0", nombre: "Alcaldesa Camila", emoji: "🏛️", x: X(0, -D + 5), z: Z(0, -D + 5), r: 1.2, zona: "Ciudad del Ágora", frases: ["Esta es la Casa del Cabildo: aquí se decide entre todos lo que nos afecta a todos.", "Gobernar es servir. Un buen líder escucha antes de mandar.", "Los derechos vienen con deberes: cuidar lo público es cuidar lo de todos."] });
      A.npc({ id: "L-pol-1", nombre: "Personero Santiago", emoji: "⚖️", x: X(-4, 1), z: Z(-4, 1), r: 1.2, zona: "Ciudad del Ágora", frases: ["Soy el personero: defiendo los derechos de los estudiantes. ¿Tienes algún reclamo justo?", "Votar es poner tu voz en la urna. Hazlo informado, no por moda.", "Un acuerdo bueno es el que cada parte puede respetar."] });
      A.npc({ id: "L-pol-2", nombre: "Secretario Julián", emoji: "📜", x: X(5, 0), z: Z(5, 0), r: 1.2, zona: "Ciudad del Ágora", frases: ["Cada decisión queda escrita en el acta, para que nadie la olvide ni la cambie a su gusto.", "Transparencia: lo público se muestra, no se esconde."] });
    }
  }
  // fachada con árboles y vecinos en la plaza
  for (const [dx, dz] of [[-16, -15], [16, -15], [-16, 15], [16, 15], [-22, -8], [22, 8]]) arbol(A, cx + dx, cz + dz, 4);
  A.npc({ id: "L-agora-0", nombre: "Doña Marta", emoji: "🧑", x: cx - 5, z: cz + 5, r: 4, zona: "Ciudad del Ágora", frases: ["Esta ciudad estuvo en ruinas muchos años. Entre todos la levantamos otra vez.", "En el Ágora se hablaba con respeto: primero escuchar, después opinar."] });
  A.npc({ id: "L-agora-1", nombre: "Don Tomás", emoji: "🧓", x: cx + 5, z: cz - 5, r: 4, zona: "Ciudad del Ágora", frases: ["Entra a la Iglesia, la Universidad, el Mercado o el Cabildo: ¡todas tienen puerta!", "Cuida la fuente: es el corazón de la plaza."] });
  A.npc({ id: "L-agora-2", nombre: "Niña Sofía", emoji: "👧", x: cx + 4, z: cz + 6, r: 5, zona: "Ciudad del Ágora", frases: ["¿Viste la bandera en el Cabildo? Amarillo, azul y rojo.", "¡Juguemos a las escondidas detrás de la fuente!"] });
  rotulo(A, cx, y0 + 9, cz, zn.emoji + " " + zn.nombre);
}

// ---------- zonas de exploración ----------
function exploracion(A, zn) {
  const { cx, cz } = zn, a0 = A.alt(cx, cz);
  const hz = A.hz;
  rotulo(A, cx, a0 + 9, cz, zn.emoji + " " + zn.nombre);
  switch (zn.k) {
    case "pantano": {
      for (let i = 0; i < 26; i++) { const x = cx + Math.round((hz(i, 1, 5, 41) - .5) * 28), z = cz + Math.round((hz(i, 2, 5, 42) - .5) * 28); if (Math.hypot(x - cx, z - cz) > zn.r || A.alt(x, z) < 12) continue; const a = A.alt(x, z); if (A.get(x, a, z) === AGUA) continue; const t = 3 + ((hz(i, 3, 5, 43) * 3) | 0); for (let k = 1; k <= t; k++) A.set(x, a + k, z, TRONCO); A.set(x + 1, a + t - 1, z, TRONCO); A.set(x - 1, a + t - 2, z, TRONCO); }
      // cabaña sobre pilotes en la isla del centro
      const y = 13, hx = cx, hz0 = cz - 1;
      for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) for (let yy = A.alt(hx + dx, hz0 + dz); yy < y; yy++) A.set(hx + dx, yy + 1, hz0 + dz, TRONCO);
      casa(A, { x: hx, z: hz0, w: 5, d: 5, alto: 3, pared: TABLON, techo: TABLON, lado: "S", y0: y, nivel: false });
      for (let dx = -2; dx <= 2; dx++) A.set(hx + dx, y, hz0 + 3, TABLON);
      A.npc({ id: "L-pan-0", nombre: "La Sabia del Pantano", emoji: "🧙", x: hx, z: hz0 + 5, r: 1.5, zona: zn.nombre, frases: ["Duda, pero con método: pregunta qué sabes, cómo lo sabes y quién te lo dijo.", "Descartes dudó de todo para encontrar algo seguro: «pienso, luego existo».", "Dudar no es ser terco: es buscar mejores razones.", "Cuidado con el agua turbia: no todo lo que parece firme lo es."] });
      break;
    }
    case "canon": {
      // arco natural sobre el cañón y rosa de los vientos
      const z = cz, xc = cx + 4 * Math.sin(z * .22), ya = 21;
      for (let x = Math.round(xc) - 7; x <= Math.round(xc) + 7; x++) for (let dz = -1; dz <= 1; dz++) { A.set(x, ya + 1, z + dz, 27); if (Math.abs(x - xc) < 5) A.set(x, ya + 2, z + dz, 27); }
      for (let x = Math.round(xc) - 7; x <= Math.round(xc) + 7; x++) for (let dz = -1; dz <= 1; dz++) for (let y = 19; y <= ya; y++) if (Math.abs(x - xc) >= 3 + (21 - y) * .6 && A.get(x, y, z + dz) === AIRE) A.set(x, y, z + dz, 27);
      const rx = cx - 8, rz = cz + 6, ra = A.alt(rx, rz);
      for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) { const d = Math.hypot(dx, dz); if (d <= 4.2) { const b = d < 1 ? 17 : Math.abs(dx) <= 0 || Math.abs(dz) <= 0 ? 32 : (Math.abs(Math.abs(dx) - Math.abs(dz)) <= 0 ? 34 : 33); A.set(rx + dx, A.alt(rx + dx, rz + dz), rz + dz, b); } }
      A.set(rx, ra + 1, rz - 4, 17); A.set(rx, ra + 1, rz - 3, 17); farol(A, rx + 5, ra + 1, rz + 5, 2);
      A.npc({ id: "L-can-0", nombre: "Cartógrafa Brújula", emoji: "🧭", x: rx + 2, z: rz + 2, r: 2, zona: zn.nombre, frases: ["La aguja siempre apunta al norte magnético. Para no perderte: mira, mide y anota.", "Un mapa es una promesa: «si sigues esto, llegarás». Hazlos con cuidado.", "Mira el suelo: el oro marca el norte."] });
      break;
    }
    case "jardin": {
      const y = a0;
      // estanque con puente
      for (let dz = -4; dz <= 4; dz++) for (let dx = -6; dx <= 6; dx++) if ((dx * dx) / 36 + (dz * dz) / 16 <= 1) { A.set(cx + dx, y, cz + dz, AGUA); A.set(cx + dx, y - 1, cz + dz, 9); }
      for (let x = cx - 7; x <= cx + 7; x++) for (const dz of [-1, 0, 1]) { A.set(x, y + 1, cz + dz, TABLON); } for (const x of [cx - 7, cx + 7, cx - 2, cx + 2]) for (const dz of [-1, 1]) { A.set(x, y + 2, cz + dz, TRONCO); if (x === cx - 7 || x === cx + 7) A.set(x, y + 3, cz + dz, LAMP); }
      // pabellón de dos pisos al norte
      const px = cx, pz = cz - 9; nivelar(A, px - 4, pz - 4, px + 4, pz + 4, y, 10);
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { A.set(px + dx, y, pz + dz, 13); }
      for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) for (let k = 1; k <= 4; k++) A.set(px + dx, y + k, pz + dz, LANA.roja);
      for (let k = 0; k <= 3; k++) caja(A, px - 4 + k, y + 5 + k, pz - 4 + k, px + 4 - k, y + 5 + k, pz + 4 - k, LANA.roja);
      A.set(px, y + 9, pz, LAMP); A.set(px, y + 1, pz, 36);
      for (const sg of [-1, 1]) for (let i = 0; i < 4; i++) { const x = cx + sg * (4 + i * 2), z = cz + 7; farol(A, x, y, z, 2); }
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, x = Math.round(cx + Math.cos(a) * 10.5), z = Math.round(cz + Math.sin(a) * 9); if (z >= pz - 4 && z <= pz + 4 && Math.abs(x - px) <= 4) continue; arbol(A, x, z, 3, HOJAS); }
      A.npc({ id: "L-jar-0", nombre: "Maestro Kong", emoji: "🏮", x: px + 0, z: pz + 2, r: 1.5, zona: zn.nombre, frases: ["«Aprender sin pensar es inútil; pensar sin aprender es peligroso.» — Confucio", "«No hagas a otros lo que no quieras que te hagan a ti.» — Confucio", "«Cuando veas a una persona virtuosa, trata de igualarla; cuando veas a una que no lo es, examínate a ti mismo.» — Confucio", "El jardín enseña paciencia: ninguna flor crece más rápido por mirarla."] });
      break;
    }
    case "volcan": {
      // lago del cráter, camino en espiral y mirador
      for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) { const d = Math.hypot(dx, dz); if (d < 3.6) { A.set(cx + dx, 22, cz + dz, AGUA); A.set(cx + dx, 21, cz + dz, 3); } }
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, x = Math.round(cx + Math.cos(a) * 3.5), z = Math.round(cz + Math.sin(a) * 3.5); A.set(x, 23, z, LAMP); }
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + .4, x = Math.round(cx + Math.cos(a) * 11), z = Math.round(cz + Math.sin(a) * 11), h = A.alt(x, z); A.set(x, h, z, 113); }
      A.npc({ id: "L-vol-0", nombre: "Geóloga Aura", emoji: "🌋", x: cx + 6, z: cz + 1, r: 2, zona: zn.nombre, frases: ["Un volcán dormido es un volcán que descansa, no uno que murió.", "El basalto negro es lava enfriada. La Tierra construye con fuego y paciencia.", "Mira el lago del cráter: agua tibia calentada desde abajo."] });
      break;
    }
    case "cristal": {
      for (let i = 0; i < 38; i++) {
        const a = hz(i, 7, 9, 61) * Math.PI * 2, d = Math.sqrt(hz(i, 8, 9, 62)) * (zn.r - 1), x = Math.round(cx + Math.cos(a) * d), z = Math.round(cz + Math.sin(a) * d);
        const ya = A.alt(x, z); if (A.get(x, ya, z) === AGUA) continue;
        if (hz(i, 9, 9, 63) < .6) { const t = 4 + ((hz(i, 10, 9, 64) * 7) | 0); for (let k = 1; k <= t; k++) { A.set(x, ya + k, z, CRISTAL); if (k <= 2) { A.set(x + 1, ya + k, z, CRISTAL); } } A.set(x, ya + t + 1, z, LAMP); if (t > 7) A.set(x - 1, ya + 3, z, CRISTAL); }
        else { const t = 4 + ((hz(i, 11, 9, 65) * 2) | 0); arbol(A, x, z, t, 29, CRISTAL); }
      }
      A.npc({ id: "L-cri-0", nombre: "Tallador Cuarzo", emoji: "💎", x: cx + 3, z: cz + 2, r: 2, zona: zn.nombre, frases: ["Estos cristales crecieron durante miles de años. Aprender también es así: poco a poco.", "El cristal deja pasar la luz, igual que la honestidad deja pasar la verdad.", "De noche brillan las lámparas de cristal: ¡ven a verlo!"] });
      break;
    }
    case "cumbre": {
      const y = 27, x0 = cx, z0 = cz;
      nivelar(A, x0 - 7, z0 - 7, x0 + 7, z0 + 7, y, 10);
      for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) A.set(x0 + dx, y, z0 + dz, 34);
      for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) A.set(x0 + dx, y + 1, z0 + dz, 13);
      for (const [dx, dz] of [[-5, -5], [0, -5], [5, -5], [-5, 5], [5, 5], [-5, 0], [5, 0], [0, 5]]) { if (dx === 0 && dz === 5) continue; for (let k = 2; k <= 7; k++) A.set(x0 + dx, y + k, z0 + dz, 34); }
      for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) if (Math.abs(dx) <= 6 && Math.abs(dz) <= 6) A.set(x0 + dx, y + 8, z0 + dz, 7);
      for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) A.set(x0 + dx, y + 9, z0 + dz, 7); A.set(x0, y + 8, z0, LAMP);
      A.set(x0, y + 2, z0 - 2, 17); A.set(x0, y + 3, z0 - 2, LAMP);
      // escalera de piedra por el sur (cada escalón sube 1)
      for (let i = 0; i < 16; i++) { const z = z0 + 7 + i, h = y - i; if (h < 12) break; for (let dx = -2; dx <= 2; dx++) { for (let yy = A.alt(x0 + dx, z); yy < h; yy++) A.set(x0 + dx, yy + 1, z, 3); A.set(x0 + dx, h, z, 3); for (let yy = h + 1; yy <= h + 4; yy++) A.set(x0 + dx, yy, z, AIRE); A.setAlt(x0 + dx, z, h); } if (i % 4 === 0) { A.set(x0 - 3, h + 1, z, TRONCO); A.set(x0 - 3, h + 2, z, LAMP); A.set(x0 + 3, h + 1, z, TRONCO); A.set(x0 + 3, h + 2, z, LAMP); } }
      A.npc({ id: "L-cum-0", nombre: "Anciana Sofía", emoji: "🏔️", x: x0, z: z0 + 1, y: y + 2, r: 2, zona: zn.nombre, frases: ["Subiste hasta aquí escalón por escalón: así se llega a toda cumbre.", "Sabio no es quien sabe más cosas, sino quien sabe cuánto le falta por aprender.", "Desde aquí arriba todo se ve pequeño… menos las personas que quieres.", "Sócrates decía: «Solo sé que no sé nada». Y por eso nunca dejó de preguntar."] });
      break;
    }
  }
}

// ---------- puntos de entrada ----------
export function construirZonas(A, off = []) {
  for (const zn of ZONAS) {
    if (off.includes(zn.k)) continue;
    if (zn.k === "agora") ciudad(A, zn);
    else if (zn.k === "valle") aldea(A, zn, {
      pozoEn: [0, 0], casas: [[-9, -4, 5, 5, TABLON, LADRILLO], [9, -4, 5, 5, TABLON, LANA.roja], [-8, 7, 5, 5, TABLON, LADRILLO], [8, 7, 5, 7, TABLON, LANA.roja], [0, -10, 7, 5, LADRILLO, LADRILLO]],
      aldeanos: [
        { n: "Don Aurelio · Agricultor", f: ["Cada semilla es una forma de agradecer a la tierra. ¡Siembra una!", "La gratitud se cultiva como el trigo: todos los días un poquito.", "Si recoges, devuelve: una parte de la cosecha se comparte."] },
        { n: "Doña Rosa", f: ["¡Bienvenido al Valle de la Gratitud! Aquí damos las gracias por todo.", "Mi abuela decía: «El bien recibido se devuelve con un bien hecho».", "Hoy agradecí al sol, a la lluvia y a ti por pasar."] },
        { n: "Pedrito", f: ["¡Mira el pozo! Es el más fresco de todo el mapa.", "Quiero ser agricultor como Don Aurelio.", "¿Sabías que una gallina pone un huevo casi cada día?"] },
        { n: "Tía Eulalia · Tejedora", f: ["Con la lana de las ovejas tejo mantas para quien las necesita.", "Un gracias dicho a tiempo abriga más que una manta."] },
        { n: "Señor Bernardo · Panadero", f: ["Mi pan lleva trigo, agua y mucho agradecimiento.", "Si tienes hambre, un pan compartido sabe el doble."] },
        { n: "Abuelo Nicolás", f: ["Llevo 70 años en este valle y nunca me cansé de dar las gracias.", "Escribe cada noche tres cosas buenas del día: cambia cómo duermes.", "Los vecinos de verdad se reconocen en la cosecha y en la lluvia."], r: 6 },
      ],
      extra: (A2, zn2, c) => { for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, x = Math.round(c[0] + Math.cos(a) * 15), z = Math.round(c[1] + Math.sin(a) * 15); if (A2.alt(x, z) > 12) arbol(A2, x, z, 4); } for (let dz = 0; dz < 3; dz++) for (let dx = 0; dx < 6; dx++) { const x = c[0] + 3 + dx, z = c[1] - 8 + dz, a = A2.alt(x, z); A2.set(x, a, z, 37); } },
    });
    else if (zn.k === "faro") {
      const c = [zn.cx, zn.cz], base = A.alt(c[0], c[1]);
      // faro: torre redonda de 5 × 5 con franjas rojas y blancas
      const fy = base;
      for (let y = fy + 1; y <= fy + 17; y++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const esq = Math.abs(dx) === 2 && Math.abs(dz) === 2; if (esq) continue; const borde = Math.abs(dx) === 2 || Math.abs(dz) === 2; A.set(c[0] + dx, y, c[1] + dz, borde ? ((((y - fy) >> 2) & 1) ? LANA.roja : LANA.blanca) : AIRE); }
      A.set(c[0], fy + 1, c[1] + 2, AIRE); A.set(c[0], fy + 2, c[1] + 2, AIRE);
      for (let y = fy + 1; y <= fy + 16; y++) A.set(c[0] - 1, y, c[1] - 1, y === fy + 1 ? TABLON : TABLON), A.set(c[0] - 1, y, c[1], y % 2 ? TABLON : AIRE);
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { A.set(c[0] + dx, fy + 18, c[1] + dz, PIEDRA); }
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const b = Math.abs(dx) === 2 || Math.abs(dz) === 2; for (let y = fy + 19; y <= fy + 21; y++) A.set(c[0] + dx, y, c[1] + dz, b ? CRISTAL : (y === fy + 20 ? LAMP : AIRE)); A.set(c[0] + dx, fy + 22, c[1] + dz, PIEDRA); }
      A.set(c[0], fy + 23, c[1], LAMP);
      // tres cabañas y muelle hacia el oeste
      const lugares = [[-7, -2], [6, -5], [5, 6]];
      for (const [dx, dz] of lugares) { const cx2 = c[0] + dx, cz2 = c[1] + dz; casa(A, { x: cx2, z: cz2, w: 5, d: 5, pared: TABLON, techo: LANA.azul, lado: ladoHacia(dx, dz) }); }
      for (let x = c[0] - 22; x <= c[0] - 9; x++) for (const dz of [0, 1]) { A.set(x, 12, c[1] + dz, TABLON); }
      for (let x = c[0] - 21; x <= c[0] - 10; x += 3) for (const dz of [0, 1]) for (let y = 8; y <= 11; y++) A.set(x, y, c[1] + dz * 1, TRONCO);
      farol(A, c[0] - 22, 13, c[1], 2); farol(A, c[0] - 9, 13, c[1], 2);
      rotulo(A, c[0], fy + 26, c[1], zn.emoji + " " + zn.nombre);
      [["Capitán Anselmo", ["El faro guía a los barcos aunque nadie lo mire. Hacer bien las cosas sin público también es valentía.", "Antes de navegar se mira el cielo, el viento y la brújula."]], ["Marina · Pescadora", ["Pesco solo lo que necesito. El mar da para todos si lo cuidamos.", "¿Viste el muelle? Lo armamos entre cuatro vecinos."]], ["Niño Tomasito", ["¡Subí al faro dos veces! Se ve el Cruce de los Mundos desde arriba.", "Quiero ser capitán."]], ["Doña Gloria · Cocinera", ["Sopa de pescado para quien llega con hambre.", "Cuenta una leyenda que la luz del faro cuida los sueños."]]].forEach((a, i) => A.npc({ id: "L-faro-" + i, nombre: a[0], emoji: "🧑", x: c[0] + Math.round(Math.cos(i * 1.7 + 1) * 5), z: c[1] + Math.round(Math.sin(i * 1.7 + 1) * 5), r: 4, zona: zn.nombre, frases: a[1] }));
    }
    else if (zn.k === "minera") aldea(A, zn, {
      pozoEn: [0, 3], casas: [[-8, 3, 5, 5, PIEDRA, TABLON], [8, 3, 5, 5, PIEDRA, TABLON], [-6, -3, 5, 5, TABLON, PIEDRA], [7, 9, 7, 5, LADRILLO, PIEDRA]],
      aldeanos: [
        { n: "Capataz Ernesto", f: ["¡Bienvenido a la Aldea Minera! Cuidado con la cabeza dentro del túnel.", "La mina es segura si nadie se salta las reglas: casco, luz y compañero.", "Del hierro salen picos; de los picos, casas; de las casas, ciudades."] },
        { n: "Herrera Josefa", f: ["Con carbón y mineral en el horno sale el lingote. Después, a golpear.", "Un buen pico dura más si cuidas el filo."] },
        { n: "Minero Cándido", f: ["En el fondo de la mina hay vetas de oro. Lleva antorchas y no te pierdas.", "Pica con paciencia: la montaña no se apura."] },
        { n: "Pequeña Nubia", f: ["Mi papá trabaja en la mina. Dice que el esfuerzo se nota en las manos.", "¿Me regalas una piedrita brillante?"] },
        { n: "Don Hilario · Geólogo", f: ["Granito, diorita, andesita… cada piedra cuenta cómo se enfrió la Tierra.", "Los minerales se forman bajo presión y mucho tiempo. Como los buenos estudiantes."] },
      ],
      extra: (A2, zn2, c) => {
        // mina: túnel de 3 × 3 hacia el norte, dentro de la colina
        const zf = c[1] - 12, ey = A2.alt(c[0], c[1] - 11);
        for (let z = zf - 8; z <= zf; z++) for (let dx = -1; dx <= 1; dx++) for (let y = ey + 1; y <= ey + 3; y++) A2.set(c[0] + dx, y, z, AIRE);
        for (let z = zf - 8; z <= zf; z++) {
          A2.set(c[0], ey, z, 26);
          if (z % 3 === 0) { A2.set(c[0] - 2, ey + 2, z, 10); } if (z % 4 === 0) { A2.set(c[0] + 2, ey + 1, z, 10); }
          if ((z + 40) % 4 === 0) { A2.set(c[0] - 1, ey + 1, z, TRONCO); A2.set(c[0] - 1, ey + 2, z, LAMP); }
        }
        for (const dx of [-2, 2]) for (let y = ey + 1; y <= ey + 4; y++) A2.set(c[0] + dx, y, zf, TRONCO);
        for (let dx = -2; dx <= 2; dx++) A2.set(c[0] + dx, ey + 4, zf, TRONCO);
        A2.set(c[0] - 1, ey + 1, zf - 9, 16); A2.set(c[0], ey + 1, zf - 9, 17); A2.set(c[0] + 1, ey + 1, zf - 9, 18);
        for (let dx = -1; dx <= 1; dx++) for (let y = ey + 2; y <= ey + 3; y++) A2.set(c[0] + dx, y, zf - 9, 10);
        rotulo(A2, c[0], ey + 6, zf, "⛏️ Entrada a la mina");
        // herrería: horno y yunque junto a la casa del este
        A2.set(c[0] + 12, A2.alt(c[0] + 12, c[1] + 3) + 1, c[1] + 3, 24);
      },
    });
    else exploracion(A, zn);
  }
}
