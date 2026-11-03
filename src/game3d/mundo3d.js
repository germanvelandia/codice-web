// =====================================================================================
//  MUNDO 3D DE CÓDICE — motor en primera persona (WebGL directo, sin librerías).
//  iniciarMundo3D(host, ctx) → { aplicar(filas), seleccionar(item), setCalidad(alta), cerrar() }
//    ctx: {
//      grado,            // grado cuyo mundo se muestra (semilla del terreno)
//      yo,               // id del estudiante (para saber qué bloques son suyos)
//      soloMirar,        // true al visitar otro grado: no se puede picar ni poner
//      portales,         // [{ id, nombre }] hacia otros mundos (máximo 8)
//      cambios,          // filas [{x,y,z,bloque,autor_id}] ya guardadas
//      cantidad(item),   // cuántos bloques de ese tipo tiene el estudiante
//      picar(x,y,z,b), poner(x,y,z,item)   // devuelven una promesa; si falla se deshace el cambio local
//      alSeleccion(item), alZona(nombre), alPortal(id), alError(texto)
//    }
//  Solo se guardan los cambios de los estudiantes; el terreno se genera igual cada vez con una semilla.
// =====================================================================================

export const SX = 128, SY = 40, SZ = 128, CH = 16, NCX = SX / CH, NCZ = SZ / CH;
export const CENTRO = 64, RADIO_PLAZA = 12; // plaza protegida: 25 × 25 alrededor del centro
const AIRE = 0, AGUA = 11, PORTAL = 12, ADOQUIN = 13;

export const NOMBRES = { 1: "Pasto", 2: "Tierra", 3: "Piedra", 4: "Tronco", 5: "Hojas", 6: "Tablones", 7: "Ladrillo", 8: "Cristal", 9: "Arena", 10: "Mineral", 11: "Agua", 12: "Portal", 13: "Adoquín" };
export const COLOCABLES = [1, 2, 3, 4, 6, 7, 8, 9];
const DUREZA = { 1: .3, 2: .3, 3: .9, 4: .6, 5: .15, 6: .5, 7: .9, 8: .2, 9: .25, 10: 1.1 };
export const RECETAS = [
  { sale: 6, n: 4, cuesta: { 4: 1 }, txt: "1 tronco → 4 tablones" },
  { sale: 7, n: 2, cuesta: { 3: 2 }, txt: "2 piedra → 2 ladrillos" },
  { sale: 8, n: 2, cuesta: { 9: 2 }, txt: "2 arena → 2 cristales" },
];
export const enPlazaProtegida = (x, z) => Math.abs(x - CENTRO) <= RADIO_PLAZA && Math.abs(z - CENTRO) <= RADIO_PLAZA;

// atlas: 0 pasto arriba, 1 pasto lado, 2 tierra, 3 piedra, 4 tronco lado, 5 tronco arriba, 6 hojas, 7 tablones, 8 ladrillo, 9 cristal, 10 arena, 11 mineral, 12 agua, 13 portal, 14 adoquín
const NT = 15;
function tileDe(b, cara) { // cara: 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z
  switch (b) {
    case 1: return cara === 2 ? 0 : cara === 3 ? 2 : 1;
    case 2: return 2; case 3: return 3;
    case 4: return cara === 2 || cara === 3 ? 5 : 4;
    case 5: return 6; case 6: return 7; case 7: return 8; case 8: return 9; case 9: return 10; case 10: return 11;
    case 11: return 12; case 12: return 13; case 13: return 14;
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
    ["#2f6fcf", "#3a7fe0", "#2a62b8"], ["#7a3fd0", "#9a5cf0", "#5b2aa8"], ["#a8a49a", "#b8b4aa", "#948f84"]];
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
  const h = (a, b) => { let n = Math.imul((a * 374761393 + b * 668265263 + seed) | 0, 1274126177); n = (n ^ (n >>> 13)) >>> 0; n = Math.imul(n, 1274126177) >>> 0; return (n ^ (n >>> 16)) / 4294967296; };
  const sm = (t) => t * t * (3 - 2 * t);
  const a = h(xi, zi), b = h(xi + 1, zi), c = h(xi, zi + 1), d = h(xi + 1, zi + 1), u = sm(xf), v = sm(zf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const MONTE = { x: 100, z: 26, r: 34 }, LAGO = { x: 64, z: 106, r: 22 };
function altura(x, z, seed) {
  const n = ruidoV(seed, x * .06, z * .06) * .6 + ruidoV(seed + 1, x * .15, z * .15) * .3 + ruidoV(seed + 2, x * .4, z * .4) * .1;
  let h = 12 + (n - .5) * 5;
  const md = Math.hypot(x - MONTE.x, z - MONTE.z), mt = Math.max(0, 1 - md / MONTE.r);
  h += mt * mt * (3 - 2 * mt) * 24 * (.75 + .5 * ruidoV(seed + 3, x * .09, z * .09));
  const ld = Math.hypot((x - LAGO.x) * .8, z - LAGO.z), lg = Math.max(0, 1 - ld / LAGO.r);
  h -= lg * lg * (3 - 2 * lg) * 8;
  const e = Math.max(Math.abs(x - CENTRO), Math.abs(z - CENTRO)), f = Math.min(1, Math.max(0, (e - 14) / 10)), ff = f * f * (3 - 2 * f);
  h = 12 + (h - 12) * ff;
  return Math.max(2, Math.min(SY - 8, Math.round(h)));
}
export function zonaDe(x, z) {
  if (Math.max(Math.abs(x - CENTRO), Math.abs(z - CENTRO)) <= 16) return "Aldea del Códice";
  if (Math.hypot(x - MONTE.x, z - MONTE.z) < MONTE.r) return "Montaña del Esfuerzo";
  if (Math.hypot((x - LAGO.x) * .8, z - LAGO.z) < LAGO.r + 3) return "Lago";
  if (x < 60 && z < 60) return "Bosque de la Curiosidad";
  return "Campos de Oakhaven";
}

// ---------- portales (en la plaza) ----------
// Marco de 4 de ancho × 5 de alto, hueco de 2 × 3. Filas al norte (z=54) y al sur (z=74) de la plaza.
export function posicionesPortales(n) {
  const xs = [53, 59, 65, 71], res = [];
  for (let i = 0; i < Math.min(8, n); i++) res.push({ x: xs[i % 4], z: i < 4 ? 54 : 74, y: 13 });
  return res;
}

export function iniciarMundo3D(host, ctx) {
  let vivo = true;
  const mundo = new Uint8Array(SX * SY * SZ);
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
    const enPlaza = enPlazaProtegida(x, z), nearLago = Math.hypot((x - LAGO.x) * .8, z - LAGO.z) < LAGO.r + 3;
    for (let y = 0; y <= h; y++) {
      let b;
      if (y === h) b = enPlaza ? ADOQUIN : (h <= 11 || (h === 12 && nearLago)) ? 9 : (h >= 30 ? 3 : 1);
      else if (y >= h - 3) b = (h <= 11 || nearLago && h <= 12) ? 9 : (h >= 30 ? 3 : 2);
      else { b = 3; if (y > 1 && y < h - 5 && rnd() < .03) b = 10; }
      mundo[idx(x, y, z)] = b;
    }
    for (let y = h + 1; y <= 11; y++) mundo[idx(x, y, z)] = AGUA;
  }
  for (let i = 0; i < 18; i++) { // cuevas
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
    if (Math.max(Math.abs(x - CENTRO), Math.abs(z - CENTRO)) < 18) continue;
    const p = zonaDe(x, z) === "Bosque de la Curiosidad" ? .035 : .004;
    if (rnd() < p) {
      const t = 4 + ((rnd() * 2) | 0);
      for (let k = 1; k <= t; k++) mundo[idx(x, a + k, z)] = 4;
      for (let dy = -2; dy <= 1; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) <= 3) { const xx = x + dx, yy = a + t + dy, zz = z + dz; if (yy < SY && !mundo[idx(xx, yy, zz)]) mundo[idx(xx, yy, zz)] = 5; }
      }
    }
  }
  // portales
  const portalesZona = []; const etiquetas = [];
  posicionesPortales((ctx.portales || []).length).forEach((p, i) => {
    const info = ctx.portales[i];
    for (let dx = 0; dx < 4; dx++) for (let dy = 0; dy < 5; dy++) {
      const borde = dx === 0 || dx === 3 || dy === 0 || dy === 4;
      mundo[idx(p.x + dx, p.y + dy, p.z)] = borde ? 7 : PORTAL;
    }
    portalesZona.push({ ...p, id: info.id, nombre: info.nombre });
    etiquetas.push({ x: p.x + 2, y: p.y + 5.6, z: p.z + .5, texto: info.nombre });
  });

  // ----- cambios guardados -----
  function aplicar(filas, noMarcar) {
    for (const f of filas || []) {
      if (f.x < 0 || f.x >= SX || f.z < 0 || f.z >= SZ || f.y < 0 || f.y >= SY) continue;
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
.m3d-mira{position:absolute;left:50%;top:50%;width:18px;height:18px;transform:translate(-50%,-50%);pointer-events:none}
.m3d-mira:before,.m3d-mira:after{content:"";position:absolute;background:#fff;mix-blend-mode:difference}
.m3d-mira:before{left:8px;top:0;width:2px;height:18px}.m3d-mira:after{top:8px;left:0;height:2px;width:18px}
.m3d-ayuda{position:absolute;left:0;right:0;bottom:10px;text-align:center;pointer-events:none;font:12px monospace;color:#fff;text-shadow:0 1px 3px #000}
.m3d-et{position:absolute;left:0;top:0;transform:translate(-50%,-100%);font:600 12px system-ui,sans-serif;color:#fff;background:#4b2a8fcc;padding:2px 8px;border-radius:10px;pointer-events:none;white-space:nowrap}
.m3d-joy{position:absolute;left:14px;bottom:14px;width:110px;height:110px;border-radius:50%;border:2px solid #fff5;background:#0003;display:none;pointer-events:none}
.m3d-joy i{position:absolute;left:35px;top:35px;width:40px;height:40px;border-radius:50%;background:#fff7}
.m3d-acc{position:absolute;right:12px;bottom:12px;display:none;gap:8px;flex-direction:column}
.m3d-acc button{width:64px;height:46px;border-radius:10px;border:2px solid #fff6;background:#0007;color:#fff;font:12px monospace;touch-action:none}
@media (pointer:coarse){.m3d-joy{display:block}.m3d-acc{display:flex}}`;
  const raiz = document.createElement("div"); raiz.className = "m3d";
  const cv = document.createElement("canvas"); cv.width = 800; cv.height = 450; cv.setAttribute("aria-label", "Mundo 3D de bloques");
  const mira = document.createElement("div"); mira.className = "m3d-mira";
  const ayuda = document.createElement("div"); ayuda.className = "m3d-ayuda"; ayuda.textContent = "Haz clic para jugar";
  const joyEl = document.createElement("div"); joyEl.className = "m3d-joy"; joyEl.innerHTML = "<i></i>";
  const acc = document.createElement("div"); acc.className = "m3d-acc";
  acc.innerHTML = '<button data-k="salto">SALTAR</button><button data-k="picar">PICAR</button><button data-k="poner">PONER</button>';
  raiz.append(estilo, cv, mira, ayuda, joyEl, acc);
  const capaEt = etiquetas.map((e) => { const d = document.createElement("div"); d.className = "m3d-et"; d.textContent = "🌀 " + e.texto; d.style.display = "none"; raiz.append(d); return d; });
  host.append(raiz);

  // ----- WebGL -----
  const gl = cv.getContext("webgl", { antialias: false, alpha: false });
  if (!gl) { raiz.innerHTML = '<div style="padding:24px;text-align:center;color:#98a0ad">Tu navegador no permite gráficos 3D (WebGL). Prueba con otro navegador.</div>'; return { aplicar() {}, seleccionar() {}, setCalidad() {}, cerrar() { raiz.remove(); } }; }
  const prog = (vs, fs) => { const p = gl.createProgram(); for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); gl.attachShader(p, sh); } gl.linkProgram(p); return p; };
  const P = prog("attribute vec3 p;attribute vec2 u;attribute float s;uniform mat4 m;varying vec2 vu;varying float vs;varying float vd;void main(){vec4 q=m*vec4(p,1.0);gl_Position=q;vu=u;vs=s;vd=q.w;}",
    "precision mediump float;uniform sampler2D t;uniform vec3 cn;varying vec2 vu;varying float vs;varying float vd;void main(){vec4 c=texture2D(t,vu);float f=clamp((vd-40.0)/45.0,0.0,1.0);gl_FragColor=vec4(mix(c.rgb*vs,cn,f),1.0);}");
  const PL = prog("attribute vec3 p;uniform mat4 m;void main(){gl_Position=m*vec4(p,1.0);}", "precision mediump float;void main(){gl_FragColor=vec4(1.0);}");
  const loc = { p: gl.getAttribLocation(P, "p"), u: gl.getAttribLocation(P, "u"), s: gl.getAttribLocation(P, "s"), m: gl.getUniformLocation(P, "m"), t: gl.getUniformLocation(P, "t"), cn: gl.getUniformLocation(P, "cn") };
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

  // ----- cámara -----
  const perspectiva = (fov, asp, n, f) => { const t = 1 / Math.tan(fov / 2); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]; };
  const mul = (a, b) => { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
  const jug = { x: CENTRO + .5, y: 13.1, z: CENTRO + 6.5, vx: 0, vy: 0, vz: 0, suelo: false, yaw: 0, pitch: 0 };
  const ojo = () => jug.y + 1.6;
  function vista() {
    const cy = Math.cos(jug.yaw), sy = Math.sin(jug.yaw), cp = Math.cos(jug.pitch), sp = Math.sin(jug.pitch);
    const ex = jug.x, ey = ojo(), ez = jug.z, rx = cy, rz = -sy, ux = -sp * sy, uy = cp, uz = -sp * cy, bx = sy * cp, by = sp, bz = cy * cp;
    return [rx, ux, bx, 0, 0, uy, by, 0, rz, uz, bz, 0, -(rx * ex + rz * ez), -(ux * ex + uy * ey + uz * ez), -(bx * ex + by * ey + bz * ez), 1];
  }
  const adelante = () => { const cy = Math.cos(jug.yaw), sy = Math.sin(jug.yaw), cp = Math.cos(jug.pitch), sp = Math.sin(jug.pitch); return [-sy * cp, -sp, -cy * cp]; };

  // ----- física -----
  const RAD = .3, ALTO = 1.75;
  const choca = (x, y, z) => { for (let yy = Math.floor(y); yy <= Math.floor(y + ALTO - .001); yy++) for (let zz = Math.floor(z - RAD); zz <= Math.floor(z + RAD); zz++) for (let xx = Math.floor(x - RAD); xx <= Math.floor(x + RAD); xx++) if (solido(xx, yy, zz)) return true; return false; };
  const tec = {}; const joy = { x: 0, y: 0 };
  let enAgua = false;
  function actualizar(dt) {
    let ax = (tec.d ? 1 : 0) - (tec.a ? 1 : 0) + joy.x, az = (tec.s ? 1 : 0) - (tec.w ? 1 : 0) + joy.y;
    const l = Math.hypot(ax, az); if (l > 1) { ax /= l; az /= l; }
    enAgua = get(Math.floor(jug.x), Math.floor(jug.y + .9), Math.floor(jug.z)) === AGUA;
    const cy = Math.cos(jug.yaw), sy = Math.sin(jug.yaw), v = enAgua ? 2.4 : 4.3;
    jug.vx = (ax * cy + az * sy) * v; jug.vz = (-ax * sy + az * cy) * v;
    if (enAgua) { jug.vy = Math.max(jug.vy - 8 * dt, -2.5); if (tec[" "]) jug.vy = 3.2; }
    else { if (tec[" "] && jug.suelo) { jug.vy = 8.6; jug.suelo = false; } jug.vy = Math.max(jug.vy - 26 * dt, -30); }
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
    while (t <= 5.5) {
      const b = get(ix, iy, iz);
      if (b !== AIRE && b !== AGUA && b !== PORTAL && iy >= 0 && iy < SY) return { x: ix, y: iy, z: iz, px, py, pz, b };
      px = ix; py = iy; pz = iz;
      if (tx < ty && tx < tz) { ix += sx; t = tx; tx += tdx; } else if (ty < tz) { iy += sy; t = ty; ty += tdy; } else { iz += sz; t = tz; tz += tdz; }
    }
    return null;
  }

  // ----- acciones -----
  let sel = 1, picar = false, picando = null, ocupado = false;
  const clave = (x, y, z) => x + "," + y + "," + z;
  const aviso = (t) => { try { ctx.alError && ctx.alError(t); } catch (_) {} };
  function puedeEditar(x, y, z) {
    if (ctx.soloMirar) { aviso("Estás de visita: aquí solo se puede mirar."); return false; }
    if (enPlazaProtegida(x, z)) { aviso("La plaza está protegida: construye fuera de ella."); return false; }
    if (y < 1 || y >= SY - 1) return false;
    return true;
  }
  function quePicar(dt) {
    if (!picar) { picando = null; return; }
    const h = apuntar(); if (!h || h.b === ADOQUIN || h.y <= 0) { picando = null; return; }
    if (!picando || picando.x !== h.x || picando.y !== h.y || picando.z !== h.z) { picando = { x: h.x, y: h.y, z: h.z, t: 0, b: h.b }; }
    picando.t += dt;
    if (picando.t >= (DUREZA[h.b] || 1)) {
      const { x, y, z, b } = picando; picando = null;
      if (ocupado) return;
      if (!puedeEditar(x, y, z)) { picar = false; return; }
      const dueno = autores.get(clave(x, y, z));
      if (dueno != null && dueno !== ctx.yo && b > 0 && mundo[idx(x, y, z)] > 0) { aviso("Ese bloque lo puso otro compañero."); picar = false; return; }
      mundo[idx(x, y, z)] = AIRE; marcar(x, z); ocupado = true;
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
    const antes = c; mundo[idx(x, y, z)] = sel; marcar(x, z); ocupado = true;
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
    if (/ocupado/.test(m)) return "Ese lugar ya está ocupado.";
    return "No se pudo guardar el cambio. Intenta de nuevo.";
  }

  // ----- entrada -----
  const bloqueado = () => document.pointerLockElement === cv;
  let jugando = false, sinBloqueo = false, arrastraRaton = false;
  const mapaTecla = (k) => (k === "arrowup" ? "w" : k === "arrowdown" ? "s" : k === "arrowleft" ? "a" : k === "arrowright" ? "d" : k);
  const mirar = (dx, dy, k) => { jug.yaw -= dx * k; jug.pitch = Math.max(-1.55, Math.min(1.55, jug.pitch + dy * k)); };
  const seleccionar = (item) => { sel = item; ctx.alSeleccion && ctx.alSeleccion(item); };
  const escuchas = [];
  const on = (obj, ev, fn, op) => { obj.addEventListener(ev, fn, op); escuchas.push([obj, ev, fn, op]); };
  on(window, "keydown", (e) => {
    if (!jugando && !bloqueado()) return;
    const k = e.key.toLowerCase(); if ([" ", "arrowup", "arrowdown"].includes(k)) e.preventDefault();
    tec[mapaTecla(k)] = true; if (k === "f" && sinBloqueo) picar = true;
    const n = +e.key; if (n >= 1 && n <= 8) seleccionar(COLOCABLES[n - 1]);
  });
  on(window, "keyup", (e) => { const k = e.key.toLowerCase(); tec[mapaTecla(k)] = false; if (k === "f" && sinBloqueo) picar = false; });
  on(window, "blur", () => { for (const k in tec) tec[k] = false; picar = false; });
  on(cv, "contextmenu", (e) => e.preventDefault());
  const toques = {};
  on(cv, "pointerdown", (e) => {
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
    on(b, "pointerdown", (e) => { e.preventDefault(); jugando = true; ayuda.textContent = ""; if (k === "salto") tec[" "] = true; else if (k === "picar") picar = true; else poner(); });
    const up = () => { if (k === "salto") tec[" "] = false; else if (k === "picar") picar = false; };
    on(b, "pointerup", up); on(b, "pointerleave", up); on(b, "pointercancel", up);
  });

  // ----- tamaño y bucle -----
  let alta = true;
  const tamano = () => { const r = cv.getBoundingClientRect(); const k = alta ? Math.min(devicePixelRatio || 1, 1.5) : .6; const w = Math.max(320, Math.round(r.width * k)); if (cv.width !== w) { cv.width = w; cv.height = Math.round(w * 9 / 16); } };
  const ro = new ResizeObserver(tamano); ro.observe(cv);
  let zonaAct = "", cooldownPortal = 0, M = null;
  function dibujar() {
    gl.viewport(0, 0, cv.width, cv.height);
    const cielo = enAgua ? [.2, .4, .7] : [.52, .74, .93]; gl.clearColor(cielo[0], cielo[1], cielo[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    M = mul(perspectiva(1.2, cv.width / cv.height, .05, 140), vista());
    gl.useProgram(P); gl.uniformMatrix4fv(loc.m, false, new Float32Array(M)); gl.uniform1i(loc.t, 0); gl.uniform3f(loc.cn, cielo[0], cielo[1], cielo[2]);
    gl.enableVertexAttribArray(loc.p); gl.enableVertexAttribArray(loc.u); gl.enableVertexAttribArray(loc.s);
    for (let cz = 0; cz < NCZ; cz++) for (let cx = 0; cx < NCX; cx++) {
      const ch = chunks[cz * NCX + cx]; if (!ch || !ch.n) continue;
      const dx = cx * CH + CH / 2 - jug.x, dz = cz * CH + CH / 2 - jug.z; if (dx * dx + dz * dz > 110 * 110) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, ch.pb); gl.vertexAttribPointer(loc.p, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, ch.ub); gl.vertexAttribPointer(loc.u, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, ch.sb); gl.vertexAttribPointer(loc.s, 1, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ch.ib); gl.drawElements(gl.TRIANGLES, ch.n, gl.UNSIGNED_INT, 0);
    }
    gl.disableVertexAttribArray(loc.u); gl.disableVertexAttribArray(loc.s);
    const h = apuntar();
    if (h) {
      gl.useProgram(PL); gl.uniformMatrix4fv(locL.m, false, new Float32Array(mul(M, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, h.x, h.y, h.z, 1])));
      gl.bindBuffer(gl.ARRAY_BUFFER, cajaB); gl.enableVertexAttribArray(locL.p); gl.vertexAttribPointer(locL.p, 3, gl.FLOAT, false, 0, 0);
      gl.disable(gl.CULL_FACE); gl.drawArrays(gl.LINES, 0, 24); gl.enable(gl.CULL_FACE);
    }
    // etiquetas de los portales
    const w = cv.clientWidth, hh = cv.clientHeight;
    etiquetas.forEach((e, i) => {
      const dx = e.x - jug.x, dz = e.z - jug.z, dist = Math.hypot(dx, dz), el = capaEt[i];
      if (dist > 30) { el.style.display = "none"; return; }
      const q = [M[0] * e.x + M[4] * e.y + M[8] * e.z + M[12], M[1] * e.x + M[5] * e.y + M[9] * e.z + M[13], M[3] * e.x + M[7] * e.y + M[11] * e.z + M[15]];
      if (q[2] <= .1) { el.style.display = "none"; return; }
      el.style.display = ""; el.style.left = ((q[0] / q[2] * .5 + .5) * w) + "px"; el.style.top = ((1 - (q[1] / q[2] * .5 + .5)) * hh) + "px";
    });
  }
  let ult = performance.now(), raf = 0;
  function bucle(t) {
    if (!vivo) return;
    const dt = Math.min(.05, (t - ult) / 1000); ult = t;
    for (const k of sucios) construir(k % NCX, (k / NCX) | 0); sucios.clear();
    actualizar(dt); quePicar(dt); dibujar();
    const z = zonaDe(Math.floor(jug.x), Math.floor(jug.z)); if (z !== zonaAct) { zonaAct = z; ctx.alZona && ctx.alZona(z); }
    cooldownPortal = Math.max(0, cooldownPortal - dt);
    if (!cooldownPortal) for (const p of portalesZona) {
      if (jug.x > p.x + 1 && jug.x < p.x + 3 && Math.abs(jug.z - (p.z + .5)) < .6 && jug.y + .9 > p.y + 1 && jug.y < p.y + 4) { cooldownPortal = 3; ctx.alPortal && ctx.alPortal(p.id); break; }
    }
    raf = requestAnimationFrame(bucle);
  }
  jug.y = alt[(CENTRO + 6) * SX + CENTRO] + 1.1;
  raf = requestAnimationFrame(bucle);

  return {
    aplicar: (filas) => aplicar(filas),
    seleccionar: (i) => { sel = i; },
    setCalidad: (v) => { alta = !!v; tamano(); },
    posicion: () => ({ x: jug.x, y: jug.y, z: jug.z }),
    _debug: { jug, apuntar, get, picarAhora: (v) => { picar = v; }, poner },
    cerrar: () => {
      vivo = false; cancelAnimationFrame(raf); ro.disconnect();
      escuchas.forEach(([o, e, f, op]) => o.removeEventListener(e, f, op));
      if (bloqueado()) document.exitPointerLock();
      chunks.forEach((c) => { if (c) { gl.deleteBuffer(c.pb); gl.deleteBuffer(c.ub); gl.deleteBuffer(c.sb); gl.deleteBuffer(c.ib); } });
      gl.deleteTexture(tex); const ex = gl.getExtension("WEBGL_lose_context"); if (ex) ex.loseContext();
      raiz.remove();
    },
  };
}
