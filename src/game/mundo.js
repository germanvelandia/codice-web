// =====================================================================================
//  MUNDO CÓDICE — motor del juego
//  Un mundo en 2D visto desde arriba: el estudiante camina con su personaje, entra a los
//  edificios, habla con otros personajes y completa misiones. Se dibuja en un <canvas>
//  y no usa librerías externas.
//
//  Uso:  const mundo = await iniciarMundo(contenedor, opciones);   …   mundo.destruir();
// =====================================================================================

const TILE = 32;
const DIRS8 = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];
const FUENTE_EMOJI = "system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

const rng = (seed) => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
function lienzo(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.imageSmoothingEnabled = false; return [c, g]; }
const direccionDe = (vx, vy) => DIRS8[(Math.round(Math.atan2(vy, vx) / (Math.PI / 4)) + 8) % 8];

// ---------- estilos (todo va dentro de ".mundo" para no chocar con el resto de la app) ----------
const CSS = `
.mundo { position: relative; width: 100%; height: 100%; overflow: hidden; background: #2d5a27; color: #1e293b; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none;
  --panel: #ffffff; --texto: #1e293b; --suave: #64748b; --borde: #e2e8f0; --fondo: #f4f6fb; --acento: #7c3aed; --ok: #059669; --ok-s: #d1fae5; --mal: #e11d48; --mal-s: #ffe4e6; --hud: rgba(23,38,77,.88); }
@media (prefers-color-scheme: dark) { .mundo { --panel: #172140; --texto: #e8edf8; --suave: #9fb0d0; --borde: #2a3a66; --fondo: #0e1526; --acento: #8b5cf6; --ok: #34d399; --ok-s: #0f3a2e; --mal: #fb7185; --mal-s: #4a1a26; --hud: rgba(8,14,32,.9); } }
.mundo * { box-sizing: border-box; }
.mundo button { font-family: inherit; cursor: pointer; }
.mundo .oculto { display: none !important; }
.mundo .m-canvas { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; touch-action: none; display: block; outline: none; }
.mundo .m-hud { position: absolute; top: 8px; left: 8px; right: 8px; display: flex; gap: 6px; align-items: flex-start; justify-content: space-between; pointer-events: none; flex-wrap: wrap; }
.mundo .m-chip { background: var(--hud); color: #fff; border-radius: 999px; padding: 5px 11px; font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
.mundo .m-izq { display: flex; align-items: center; gap: 8px; }
.mundo .m-der { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.mundo .m-foto { width: 30px; height: 30px; image-rendering: pixelated; object-fit: contain; background: rgba(255,255,255,.12); border-radius: 50%; }
.mundo .m-nv { background: #fbbf24; color: #3b2a00; border-radius: 999px; padding: 1px 7px; font-size: 11px; font-weight: 800; }
.mundo .m-boton { pointer-events: auto; background: var(--hud); color: #fff; border: 0; border-radius: 999px; padding: 6px 12px; font-size: 12px; font-weight: 700; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
.mundo .m-mini { position: absolute; right: 8px; top: 92px; border-radius: 10px; border: 2px solid rgba(255,255,255,.7); box-shadow: 0 2px 8px rgba(0,0,0,.3); width: 120px; height: auto; image-rendering: pixelated; pointer-events: none; }
.mundo .m-lugar { position: absolute; left: 50%; top: 96px; transform: translateX(-50%); background: var(--hud); color: #fff; border-radius: 12px; padding: 8px 18px; font-size: 15px; font-weight: 800; pointer-events: none; opacity: 0; transition: opacity .4s; white-space: nowrap; box-shadow: 0 4px 14px rgba(0,0,0,.35); }
.mundo .m-lugar.ver { opacity: 1; }
.mundo .m-aviso { position: absolute; left: 50%; bottom: 150px; transform: translateX(-50%); background: var(--hud); color: #fff; border-radius: 999px; padding: 8px 16px; font-size: 14px; font-weight: 700; pointer-events: none; white-space: nowrap; box-shadow: 0 2px 10px rgba(0,0,0,.3); }
.mundo .m-toast { position: absolute; left: 50%; bottom: 210px; transform: translateX(-50%); background: var(--panel); color: var(--texto); border: 1px solid var(--borde); border-radius: 12px; padding: 9px 14px; font-size: 13px; box-shadow: 0 6px 18px rgba(0,0,0,.3); max-width: 90%; text-align: center; }
.mundo .m-joy { position: absolute; left: 18px; bottom: 22px; width: 124px; height: 124px; border-radius: 50%; background: rgba(255,255,255,.22); border: 2px solid rgba(255,255,255,.55); touch-action: none; display: flex; align-items: center; justify-content: center; }
.mundo .m-knob { width: 54px; height: 54px; border-radius: 50%; background: rgba(255,255,255,.85); box-shadow: 0 2px 8px rgba(0,0,0,.35); pointer-events: none; }
.mundo .m-accion { position: absolute; right: 22px; bottom: 36px; width: 84px; height: 84px; border-radius: 50%; border: 3px solid rgba(255,255,255,.7); background: rgba(124,58,237,.75); color: #fff; font-size: 30px; touch-action: none; box-shadow: 0 3px 12px rgba(0,0,0,.35); }
.mundo .m-accion.listo { background: #f59e0b; animation: m-pulso 1s ease-in-out infinite; }
@keyframes m-pulso { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
@media (prefers-reduced-motion: reduce) { .mundo .m-accion.listo { animation: none; } }
.mundo .m-dialogo { position: absolute; left: 0; right: 0; bottom: 0; display: flex; justify-content: center; padding: 10px 10px 12px; background: linear-gradient(transparent, rgba(0,0,0,.35)); }
.mundo .m-tarjeta { width: 100%; max-width: 560px; background: var(--panel); color: var(--texto); border: 1px solid var(--borde); border-radius: 18px; padding: 14px 16px 16px; box-shadow: 0 10px 30px rgba(0,0,0,.4); max-height: 78%; overflow-y: auto; }
.mundo .m-cab { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.mundo .m-avatar { width: 44px; height: 44px; image-rendering: pixelated; object-fit: contain; flex-shrink: 0; }
.mundo .m-emo { font-size: 32px; line-height: 1; flex-shrink: 0; }
.mundo .m-quien { font-weight: 800; font-size: 15px; }
.mundo .m-titulo { font-size: 12px; color: var(--acento); font-weight: 700; }
.mundo .m-cerrar { margin-left: auto; background: none; border: 0; color: var(--suave); font-size: 20px; }
.mundo .m-texto { font-size: 14px; line-height: 1.5; margin: 6px 0 10px; }
.mundo .m-opcion { display: block; width: 100%; text-align: left; padding: 10px 12px; margin-bottom: 7px; border-radius: 12px; border: 2px solid var(--borde); background: var(--fondo); color: var(--texto); font-size: 14px; }
.mundo .m-opcion:hover:not(:disabled) { border-color: var(--acento); }
.mundo .m-opcion.mal { border-color: var(--mal); background: var(--mal-s); }
.mundo .m-opcion.bien { border-color: var(--ok); background: var(--ok-s); }
.mundo .m-retro { font-size: 13px; padding: 9px 11px; border-radius: 10px; margin-top: 4px; line-height: 1.45; }
.mundo .m-retro.bien { background: var(--ok-s); color: var(--ok); }
.mundo .m-retro.mal { background: var(--mal-s); color: var(--mal); }
.mundo .m-premio { font-weight: 800; margin-top: 6px; font-size: 14px; }
.mundo .m-ok { margin-top: 10px; width: 100%; padding: 11px; border-radius: 12px; border: 0; background: var(--acento); color: #fff; font-weight: 700; font-size: 14px; }
.mundo .m-fundido { position: absolute; inset: 0; background: #000; opacity: 0; pointer-events: none; transition: opacity .18s; }
.mundo .m-fundido.ver { opacity: 1; pointer-events: auto; }
.mundo .m-fin { position: absolute; inset: 0; background: rgba(8,14,32,.78); display: flex; align-items: center; justify-content: center; padding: 20px; }
.mundo .m-fin .m-tarjeta { text-align: center; max-width: 380px; padding: 26px 22px; }
.mundo .m-fin .m-grande { font-size: 56px; }
.mundo .m-fin h2 { margin: 6px 0 4px; font-size: 22px; }
.mundo .m-fin p { color: var(--suave); font-size: 14px; line-height: 1.5; margin: 6px 0 14px; }
.mundo .m-fin button { padding: 11px 20px; border-radius: 12px; border: 0; background: var(--acento); color: #fff; font-weight: 700; font-size: 14px; }
@media (max-width: 520px) {
  .mundo .m-chip { font-size: 12px; padding: 4px 9px; gap: 4px; }
  .mundo .m-boton { font-size: 11px; padding: 5px 10px; }
  .mundo .m-hud, .mundo .m-der { gap: 4px; }
  .mundo .m-foto { width: 26px; height: 26px; }
}`;
function asegurarCss() {
  if (document.getElementById("mundo-css")) return;
  const el = document.createElement("style"); el.id = "mundo-css"; el.textContent = CSS; document.head.appendChild(el);
}

const PLANTILLA = `
<div class="mundo">
  <canvas class="m-canvas" tabindex="0"></canvas>
  <div class="m-hud">
    <div class="m-izq"><span class="m-chip"><img class="m-foto" alt=""><span class="m-nombre">Estudiante</span><span class="m-nv oculto"></span></span></div>
    <div class="m-der">
      <span class="m-chip">✨ <span class="h-xp">0</span> XP</span>
      <span class="m-chip">🪙 <span class="h-oro">0</span></span>
      <span class="m-chip">🎯 <span class="h-mis">0/0</span></span>
      <span class="m-chip">⭐ <span class="h-est">0/6</span></span>
      <button class="m-boton b-sonido" aria-label="Sonido">🔊</button>
      <button class="m-boton b-salir">↩ Salir</button>
    </div>
  </div>
  <canvas class="m-mini" width="168" height="120"></canvas>
  <div class="m-lugar"></div>
  <div class="m-aviso oculto"></div>
  <div class="m-toast oculto"></div>
  <div class="m-joy oculto"><div class="m-knob"></div></div>
  <button class="m-accion oculto" aria-label="Interactuar">💬</button>
  <div class="m-dialogo oculto"></div>
  <div class="m-fundido"></div>
  <div class="m-fin oculto"><div class="m-tarjeta"><div class="m-grande">🏆</div><h2>¡Completaste todas las misiones!</h2><p class="m-fin-texto"></p><button class="b-seguir">Seguir explorando</button></div></div>
</div>`;

// =====================================================================================
//  SONIDO — todo se genera por código (no hay archivos de audio)
// =====================================================================================
function crearSonido() {
  const mudoTotal = { activo: false, mudo: true, reanudar() {}, alternar() { return true; }, musica() {}, paso() {}, estrella() {}, bien() {}, mal() {}, hablar() {}, puerta() {}, destruir() {} };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return mudoTotal;
  let ctx; try { ctx = new AC(); } catch (e) { return mudoTotal; }
  const master = ctx.createGain(), musica = ctx.createGain(), fx = ctx.createGain();
  musica.gain.value = 0.16; fx.gain.value = 0.55; musica.connect(master); fx.connect(master); master.connect(ctx.destination);
  let mudo = false; try { mudo = localStorage.getItem("mundo_mudo") === "1"; } catch (e) { /* sin almacenamiento */ }
  master.gain.value = mudo ? 0 : 0.9;
  const ruidoBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.3), ctx.sampleRate);
  { const d = ruidoBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const ahora = () => ctx.currentTime;
  const tono = (dest, tipo, f, t0, dur, vol, f2) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = tipo; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
  };
  const ruido = (dest, t0, dur, vol, frec, tipo) => {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = ruidoBuf; f.type = tipo || "bandpass"; f.frequency.value = frec;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(f); f.connect(g); g.connect(dest); s.start(t0); s.stop(t0 + dur + 0.02);
  };
  // música: acordes lentos (La menor, Fa, Do, Sol) con un arpegio suave encima
  const ACORDES = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const ARP = [0, 1, 2, 1, 2, 1, 2, 1];
  let tema = "exterior", n = 0, prox = 0, reloj = null;
  function pasoMusica(i, t) {
    const dur = tema === "exterior" ? 0.36 : 0.5, ac = ACORDES[Math.floor(i / 8) % 4];
    if (i % 8 === 0) for (const m of ac) tono(musica, "triangle", hz(m - 12), t, dur * 8.2, 0.35);
    if (tema === "exterior") tono(musica, "sine", hz(ac[ARP[i % 8]] + 12), t, dur * 1.4, 0.5);
    else if (i % 2 === 0) tono(musica, "sine", hz(ac[ARP[i % 8]] + 12), t, dur * 2.2, 0.35);
    return dur;
  }
  function programar() {
    if (mudo || ctx.state !== "running") return;
    const limite = ahora() + 0.8; if (prox < ahora()) prox = ahora() + 0.05;
    while (prox < limite) prox += pasoMusica(n++, prox);
  }
  const S = {
    activo: true,
    get mudo() { return mudo; },
    reanudar() { if (ctx.state === "suspended") ctx.resume().catch(() => {}); },
    alternar() {
      mudo = !mudo; try { localStorage.setItem("mundo_mudo", mudo ? "1" : "0"); } catch (e) { /* sin almacenamiento */ }
      master.gain.setTargetAtTime(mudo ? 0 : 0.9, ahora(), 0.05); if (!mudo) S.reanudar();
      return mudo;
    },
    musica(t) { tema = t; if (!reloj) reloj = setInterval(programar, 250); programar(); },
    paso(piso) {
      if (mudo) return;
      const c = { pasto: [700, 0.1], tierra: [1100, 0.11], piedra: [2200, 0.13], madera: [1400, 0.15] }[piso] || [900, 0.1];
      ruido(fx, ahora(), 0.05, c[1], c[0]);
    },
    estrella() { if (mudo) return; const t = ahora(); tono(fx, "sine", 880, t, 0.14, 0.5); tono(fx, "sine", 1320, t + 0.09, 0.22, 0.5); },
    bien() { if (mudo) return; const t = ahora(); [72, 76, 79, 84].forEach((m, i) => tono(fx, "triangle", hz(m), t + i * 0.09, 0.3, 0.5)); },
    mal() { if (mudo) return; tono(fx, "sawtooth", 170, ahora(), 0.22, 0.35, 110); },
    hablar() { if (mudo) return; const t = ahora(); tono(fx, "square", 520, t, 0.06, 0.18); tono(fx, "square", 660, t + 0.06, 0.07, 0.18); },
    puerta() { if (mudo) return; const t = ahora(); ruido(fx, t, 0.35, 0.5, 500, "lowpass"); tono(fx, "sine", 90, t, 0.3, 0.6, 60); },
    destruir() { clearInterval(reloj); reloj = null; try { ctx.close(); } catch (e) { /* ya cerrado */ } },
  };
  return S;
}

// =====================================================================================
//  EL MUNDO: la aldea por fuera
// =====================================================================================
const MW = 56, MH = 40, PW = MW * TILE, PH = MH * TILE;
const T = { PASTO: 0, CAMINO: 1, AGUA: 2, ARENA: 3, PLAZA: 4 };

// Cada edificio tiene su interior (cols × filas en casillas) y un tema de decoración.
const EDIFICIOS_DEF = [
  { id: "biblioteca", nombre: "Biblioteca", x: 8, y: 5, w: 7, h: 5, pared: "#c9a46a", techo: "#8b3a3a", icono: "📚", interior: { cols: 16, filas: 11, tema: "biblioteca" } },
  { id: "agora", nombre: "Ágora de la Ética", x: 38, y: 26, w: 8, h: 5, pared: "#d8d3c4", techo: "#3b5b92", icono: "⚖️", interior: { cols: 16, filas: 11, tema: "agora" } },
  { id: "templo", nombre: "Templo de la Gratitud", x: 8, y: 27, w: 7, h: 5, pared: "#efe6d2", techo: "#7b4fa3", icono: "🕊️", interior: { cols: 14, filas: 11, tema: "templo" } },
  { id: "mercado", nombre: "Mercado del Códice", x: 24, y: 4, w: 8, h: 4, pared: "#e0b36a", techo: "#c0562b", icono: "🛒", interior: { cols: 16, filas: 11, tema: "mercado" } },
];

function crearExterior() {
  const rand = rng(20261005);
  const dentro = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
  const tipo = Array.from({ length: MH }, () => new Uint8Array(MW));
  const ocupado = Array.from({ length: MH }, () => new Uint8Array(MW)); // 1 = no poner árboles ni rocas
  const obstaculos = [], arboles = [], rocas = [];
  const edificios = EDIFICIOS_DEF.map((e) => ({ ...e }));

  const LAGO = { cx: 47, cy: 9, rx: 8, ry: 5 };
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const d = ((x + 0.5 - LAGO.cx) / LAGO.rx) ** 2 + ((y + 0.5 - LAGO.cy) / LAGO.ry) ** 2;
    if (d < 1) tipo[y][x] = T.AGUA; else if (d < 1.4) tipo[y][x] = T.ARENA;
    if (d < 1.9) ocupado[y][x] = 1;
  }
  const PLAZA = { cx: 28, cy: 20, r: 6 };
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const dd = Math.hypot(x + 0.5 - PLAZA.cx, y + 0.5 - PLAZA.cy);
    if (dd <= PLAZA.r && tipo[y][x] !== T.AGUA) tipo[y][x] = T.PLAZA;
    if (dd <= PLAZA.r + 2) ocupado[y][x] = 1;
  }
  function camino(x1, y1, x2, y2) {
    const pintar = (x, y) => {
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const a = x + dx, b = y + dy; if (!dentro(a, b)) continue;
        if (tipo[b][a] === T.PASTO) tipo[b][a] = T.CAMINO; ocupado[b][a] = 1;
      }
    };
    const sx = Math.sign(x2 - x1) || 1, sy = Math.sign(y2 - y1) || 1;
    for (let x = x1; x !== x2; x += sx) pintar(x, y1);
    for (let y = y1; y !== y2; y += sy) pintar(x2, y);
  }
  for (const e of edificios) {
    e.puertaX = e.x + Math.floor(e.w / 2); e.puertaY = e.y + e.h;
    e.puerta = { x: e.x * TILE + (e.w * TILE) / 2, y: (e.y + e.h) * TILE + 8 }; // donde está la puerta que se ve dibujada
    obstaculos.push({ x: e.x * TILE, y: e.y * TILE, w: e.w * TILE, h: e.h * TILE });
    for (let y = e.y - 2; y < e.y + e.h + 2; y++) for (let x = e.x - 2; x < e.x + e.w + 2; x++) if (dentro(x, y)) ocupado[y][x] = 1;
    camino(e.puertaX, e.puertaY, PLAZA.cx - 1, PLAZA.cy - 1);
  }
  const spawn = { x: 28 * TILE + 16, y: 24 * TILE };
  const fuente = { x: PLAZA.cx * TILE, y: PLAZA.cy * TILE + 14 };
  obstaculos.push({ x: fuente.x - 26, y: fuente.y - 16, w: 52, h: 30 });

  const esLibre = (x, y) => dentro(x, y) && tipo[y][x] === T.PASTO && !ocupado[y][x];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const borde = Math.min(x, y, MW - 1 - x, MH - 1 - y);
    if (tipo[y][x] === T.AGUA || tipo[y][x] === T.ARENA) continue;
    if ((borde === 0 && rand() < 0.95) || (borde === 1 && rand() < 0.7) || (borde === 2 && esLibre(x, y) && rand() < 0.3)) {
      arboles.push({ x: x * TILE + 16 + (rand() * 8 - 4), y: y * TILE + 30 + (rand() * 4 - 2), v: rand() < 0.55 ? 0 : 1 });
    }
  }
  for (let y = 3; y < MH - 3; y++) for (let x = 3; x < MW - 3; x++) {
    if (!esLibre(x, y)) continue;
    if (Math.hypot(x * TILE - spawn.x, y * TILE - spawn.y) < 5 * TILE) continue;
    const r = rand();
    if (r < 0.07) arboles.push({ x: x * TILE + 16 + (rand() * 10 - 5), y: y * TILE + 30 + (rand() * 4 - 2), v: rand() < 0.55 ? 0 : 1 });
    else if (r < 0.085) rocas.push({ x: x * TILE + 16, y: y * TILE + 26 });
  }
  for (const t of arboles) obstaculos.push({ x: t.x - 5, y: t.y - 8, w: 10, h: 8 });
  for (const r of rocas) obstaculos.push({ x: r.x - 9, y: r.y - 8, w: 18, h: 8 });

  const esAgua = (px, py) => { const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE); return !dentro(tx, ty) || tipo[ty][tx] === T.AGUA; };

  // estrellas para recoger
  const estrellas = []; {
    const r = rng(99); let intentos = 0;
    while (estrellas.length < 6 && intentos++ < 5000) {
      const x = 3 + Math.floor(r() * (MW - 6)), y = 3 + Math.floor(r() * (MH - 6)), t = tipo[y][x];
      if (t === T.AGUA || t === T.PLAZA) continue;
      const px = x * TILE + 16, py = y * TILE + 16;
      if (Math.hypot(px - spawn.x, py - spawn.y) < 8 * TILE) continue;
      if (obstaculos.some((o) => px > o.x - 14 && px < o.x + o.w + 14 && py > o.y - 14 && py < o.y + o.h + 14)) continue;
      if (estrellas.some((s) => Math.hypot(s.x - px, s.y - py) < 9 * TILE)) continue;
      estrellas.push({ x: px, y: py, tomada: false });
    }
  }

  // ---------- dibujos pre-armados ----------
  const suelo = (() => {
    const [c, g] = lienzo(PW, PH), r = rng(77), pasto = ["#5aa845", "#5eae48", "#56a142"];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const t = tipo[y][x], px = x * TILE, py = y * TILE; let base, claro, oscuro;
      if (t === T.PASTO) { base = pasto[(x * 7 + y * 13) % 3]; claro = "#74c05c"; oscuro = "#478a37"; }
      else if (t === T.CAMINO) { base = "#d6b676"; claro = "#e6cc94"; oscuro = "#b9965a"; }
      else if (t === T.ARENA) { base = "#eadba0"; claro = "#f4e9bd"; oscuro = "#d1bf82"; }
      else if (t === T.PLAZA) { base = "#bcbcc8"; claro = "#cdcdd8"; oscuro = "#a1a1b0"; }
      else { base = "#3f86c9"; claro = "#69a6dc"; oscuro = "#2f6ba8"; }
      g.fillStyle = base; g.fillRect(px, py, TILE, TILE);
      for (let i = 0; i < 7; i++) { g.fillStyle = r() < 0.5 ? claro : oscuro; g.fillRect(px + Math.floor(r() * 30), py + Math.floor(r() * 30), 2, 2); }
      if (t === T.PLAZA) { g.strokeStyle = oscuro; g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1); }
      if (t === T.PASTO && !ocupado[y][x] && r() < 0.07) {
        const col = ["#ffffff", "#ffd54f", "#f48fb1", "#ce93d8"][Math.floor(r() * 4)];
        for (let k = 0; k < 2 + Math.floor(r() * 2); k++) { const fx = px + 4 + Math.floor(r() * 22), fy = py + 4 + Math.floor(r() * 22); g.fillStyle = col; g.fillRect(fx, fy, 3, 3); g.fillStyle = "#ffeb3b"; g.fillRect(fx + 1, fy + 1, 1, 1); }
      }
    }
    return c;
  })();
  const crearArbol = (v) => {
    const [c, g] = lienzo(44, 54);
    g.fillStyle = "#6b4423"; g.fillRect(18, 36, 8, 16); g.fillStyle = "#8a5a2f"; g.fillRect(18, 36, 3, 16);
    g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.ellipse(22, 52, 14, 4, 0, 0, 7); g.fill();
    const circ = (x, y, rr, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); };
    if (v === 0) { circ(22, 24, 15, "#2f7d32"); circ(14, 29, 10, "#388e3c"); circ(31, 29, 10, "#388e3c"); circ(22, 17, 11, "#43a047"); circ(17, 15, 4, "#66bb6a"); circ(27, 21, 3, "#66bb6a"); }
    else { const tri = (cy, a, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(22, cy - 17); g.lineTo(22 + a, cy + 8); g.lineTo(22 - a, cy + 8); g.fill(); }; tri(38, 15, "#1f6b3a"); tri(28, 13, "#2a8247"); tri(18, 10, "#37a05a"); }
    return c;
  };
  const arbolImg = [crearArbol(0), crearArbol(1)];
  const rocaImg = (() => { const [c, g] = lienzo(26, 18); g.fillStyle = "rgba(0,0,0,.2)"; g.beginPath(); g.ellipse(13, 15, 11, 3, 0, 0, 7); g.fill(); g.fillStyle = "#8d8d99"; g.beginPath(); g.ellipse(13, 10, 11, 7, 0, 0, 7); g.fill(); g.fillStyle = "#a9a9b6"; g.beginPath(); g.ellipse(10, 8, 6, 4, 0, 0, 7); g.fill(); return c; })();
  const crearEdificio = (e) => {
    const W = e.w * TILE, H = e.h * TILE, [c, g] = lienzo(W + 12, H + 4), mx = 6, techoH = Math.round(H * 0.46);
    g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(mx + 4, H - 2, W - 4, 6);
    g.fillStyle = e.pared; g.fillRect(mx + 6, techoH - 4, W - 12, H - techoH + 4);
    g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(mx + 6, H - 8, W - 12, 8);
    g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 2; g.strokeRect(mx + 7, techoH - 3, W - 14, H - techoH + 2);
    g.fillStyle = e.techo; g.beginPath(); g.moveTo(mx - 4, techoH); g.lineTo(mx + W + 4, techoH); g.lineTo(mx + W - 16, 4); g.lineTo(mx + 16, 4); g.closePath(); g.fill();
    g.strokeStyle = "rgba(0,0,0,.22)"; g.lineWidth = 1; for (let y = 12; y < techoH; y += 8) { g.beginPath(); g.moveTo(mx + 10, y); g.lineTo(mx + W - 10, y); g.stroke(); }
    g.fillStyle = "rgba(255,255,255,.18)"; g.beginPath(); g.moveTo(mx + 16, 4); g.lineTo(mx + 60, 4); g.lineTo(mx + 36, techoH); g.lineTo(mx - 4, techoH); g.closePath(); g.fill();
    g.font = "26px " + FUENTE_EMOJI; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff"; g.fillText(e.icono, mx + W / 2, techoH / 2 + 4);
    const dx = mx + W / 2 - 12; g.fillStyle = "#5a3a22"; g.fillRect(dx, H - 32, 24, 32); g.fillStyle = "#3d2614"; g.fillRect(dx + 2, H - 30, 20, 4); g.fillStyle = "#f2c94c"; g.fillRect(dx + 18, H - 16, 3, 3);
    const vent = (x) => { g.fillStyle = "#6a4a2c"; g.fillRect(x - 1, techoH + 10, 22, 22); g.fillStyle = "#a8d8f0"; g.fillRect(x + 1, techoH + 12, 18, 18); g.fillStyle = "rgba(255,255,255,.6)"; g.fillRect(x + 3, techoH + 14, 5, 8); };
    vent(mx + 24); vent(mx + W - 46);
    g.font = "bold 10px system-ui, sans-serif"; const ancho = Math.min(W - 28, g.measureText(e.nombre).width + 14);
    g.fillStyle = "#7a5230"; g.fillRect(mx + W / 2 - ancho / 2, techoH - 2, ancho, 13); g.strokeStyle = "#4a3018"; g.strokeRect(mx + W / 2 - ancho / 2 + 0.5, techoH - 1.5, ancho - 1, 12);
    g.fillStyle = "#fff4d6"; g.textBaseline = "middle"; g.fillText(e.nombre, mx + W / 2, techoH + 5);
    return c;
  };
  const edificioImg = edificios.map(crearEdificio);
  const aguaTiles = []; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (tipo[y][x] === T.AGUA) aguaTiles.push([x, y]);
  const [miniBase, mg] = lienzo(MW * 3, MH * 3);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const t = tipo[y][x]; mg.fillStyle = t === T.AGUA ? "#3f86c9" : t === T.CAMINO ? "#d6b676" : t === T.ARENA ? "#eadba0" : t === T.PLAZA ? "#bcbcc8" : "#5aa845"; mg.fillRect(x * 3, y * 3, 3, 3); }
  for (const t of arboles) { mg.fillStyle = "#2f7d32"; mg.fillRect(Math.floor(t.x / TILE) * 3, Math.floor(t.y / TILE) * 3, 3, 3); }
  for (const e of edificios) { mg.fillStyle = e.techo; mg.fillRect(e.x * 3, e.y * 3, e.w * 3, e.h * 3); }

  const dibujarFuente = (ctx, camX, camY, t) => {
    const x = fuente.x - camX, y = fuente.y - camY;
    ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(x, y + 6, 30, 11, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#8f8fa0"; ctx.beginPath(); ctx.ellipse(x, y, 28, 12, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#a9a9ba"; ctx.beginPath(); ctx.ellipse(x, y - 3, 28, 11, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#5fb0e8"; ctx.beginPath(); ctx.ellipse(x, y - 3, 22, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#8f8fa0"; ctx.fillRect(x - 4, y - 24, 8, 20); ctx.fillStyle = "#a9a9ba"; ctx.fillRect(x - 4, y - 24, 3, 20);
    ctx.fillStyle = "rgba(255,255,255,.9)";
    for (let i = 0; i < 6; i++) { const f = (t * 1.4 + i / 6) % 1; ctx.fillRect(Math.round(x + (i - 2.5) * 4 * f), Math.round(y - 28 + 26 * f * f), 2, 2); }
  };

  return {
    id: "exterior", nombre: "Aldea del Códice", icono: "🌍", exterior: true,
    ancho: PW, alto: PH, suelo, fondo: "#2d5a27", obstaculos, spawn, edificios, plaza: PLAZA, estrellas, mini: { base: miniBase, k: (MW * 3) / PW },
    npcs: [], puertas: edificios.map((e) => ({ tipo: "puerta", id: e.id, edificio: e, nombre: e.nombre, x: e.puerta.x, y: e.puerta.y, radio: 34 })), salidas: [],
    bloqueado: esAgua,
    piso: (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); const t = dentro(tx, ty) ? tipo[ty][tx] : 0; return t === T.PLAZA ? "piedra" : t === T.CAMINO || t === T.ARENA ? "tierra" : "pasto"; },
    // puntos libres para colocar personajes (cerca de la plaza y los caminos)
    puntoLibre(r, chocaFn) { for (let i = 0; i < 400; i++) { const x = (8 + r() * 40) * TILE, y = (6 + r() * 28) * TILE; const t = tipo[Math.floor(y / TILE)][Math.floor(x / TILE)]; if ((t === T.PLAZA || t === T.CAMINO || t === T.PASTO) && !chocaFn(x, y) && Math.hypot(x - spawn.x, y - spawn.y) > 70) return { x, y }; } return { x: spawn.x + 60, y: spawn.y }; },
    objetos(lista, ctx, camX, camY, visible, t) {
      for (const a of arboles) if (visible(a.x, a.y)) lista.push({ y: a.y, d: () => ctx.drawImage(arbolImg[a.v], Math.round(a.x - 22 - camX), Math.round(a.y - 52 - camY)) });
      for (const r of rocas) if (visible(r.x, r.y)) lista.push({ y: r.y, d: () => ctx.drawImage(rocaImg, Math.round(r.x - 13 - camX), Math.round(r.y - 14 - camY)) });
      edificios.forEach((e, i) => { const by = (e.y + e.h) * TILE; if (visible(e.x * TILE + e.w * 16, by, 200)) lista.push({ y: by, d: () => ctx.drawImage(edificioImg[i], e.x * TILE - 6 - camX, e.y * TILE - camY) }); });
      lista.push({ y: fuente.y, d: () => dibujarFuente(ctx, camX, camY, t) });
    },
    efectos(ctx, t, camX, camY, LW, LH) {
      ctx.fillStyle = "rgba(255,255,255,.35)";
      for (const [x, y] of aguaTiles) {
        const px = x * TILE - camX, py = y * TILE - camY; if (px < -TILE || py < -TILE || px > LW || py > LH) continue;
        const o = Math.sin(t * 1.6 + x * 0.9 + y * 0.6); ctx.fillRect(px + 6 + o * 3, py + 9, 10, 1); ctx.fillRect(px + 15 - o * 3, py + 22, 9, 1);
      }
    },
  };
}

// =====================================================================================
//  EL MUNDO POR DENTRO: los interiores de los edificios
// =====================================================================================
const TEMAS = {
  biblioteca: { piso: ["#b98a55", "#b0814d"], linea: "#8f6838", pared: "#7a4f2d", zocalo: "#5a3a1e", sonido: "madera", fondo: "#150f0a" },
  agora: { piso: ["#ebe7dc", "#ddd8c8"], linea: "#c4bda8", pared: "#cfc8b4", zocalo: "#a99f86", sonido: "piedra", fondo: "#14161c" },
  templo: { piso: ["#cfc8dc", "#c4bdd2"], linea: "#a79fba", pared: "#9b8fb5", zocalo: "#6f6390", sonido: "piedra", fondo: "#120f1a" },
  mercado: { piso: ["#a77b4a", "#9d7243"], linea: "#7e5a33", pared: "#c98f4a", zocalo: "#8a5a2b", sonido: "madera", fondo: "#150f0a" },
};
const rr = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

// Muebles: cada uno se dibuja una sola vez en un lienzo chico.
function fabricarMueble(tipo, r) {
  const colores = ["#b23a48", "#3a6ea5", "#4f8a4b", "#c9a227", "#7b4fa3", "#d9822b", "#2f6f73"];
  const pick = () => colores[Math.floor(r() * colores.length)];
  if (tipo === "estante") {
    const [c, g] = lienzo(64, 72); rr(g, 0, 4, 64, 68, "#4a2f17"); rr(g, 3, 7, 58, 62, "#7a5230");
    for (let f = 0; f < 3; f++) { const y = 10 + f * 20; rr(g, 3, y + 16, 58, 4, "#3f2712"); let x = 5; while (x < 56) { const w = 3 + Math.floor(r() * 4), h = 10 + Math.floor(r() * 6); rr(g, x, y + 16 - h, w, h, pick()); x += w + 1; } }
    return { img: c, w: 64, h: 72, pared: true };
  }
  if (tipo === "mesa") {
    const [c, g] = lienzo(72, 46); g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(6, 38, 62, 6);
    rr(g, 6, 24, 6, 18, "#5a3a1e"); rr(g, 60, 24, 6, 18, "#5a3a1e"); rr(g, 2, 10, 68, 18, "#b0773c"); rr(g, 2, 10, 68, 4, "#c98d4d"); rr(g, 2, 26, 68, 3, "#8a5a2b");
    rr(g, 12, 6, 12, 5, pick()); rr(g, 14, 3, 12, 4, pick()); rr(g, 40, 7, 14, 4, pick()); g.fillStyle = "#fff4d6"; g.fillRect(52, 4, 10, 7);
    return { img: c, w: 72, h: 46, ob: 16 };
  }
  if (tipo === "banco") {
    const [c, g] = lienzo(60, 28); g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(4, 24, 54, 4);
    rr(g, 4, 14, 5, 12, "#5a3a1e"); rr(g, 51, 14, 5, 12, "#5a3a1e"); rr(g, 2, 8, 56, 9, "#9a6a35"); rr(g, 2, 8, 56, 3, "#b8824a"); rr(g, 2, 0, 56, 6, "#8a5a2b");
    return { img: c, w: 60, h: 28, ob: 12 };
  }
  if (tipo === "columna") {
    const [c, g] = lienzo(26, 76); g.fillStyle = "rgba(0,0,0,.2)"; g.beginPath(); g.ellipse(13, 72, 12, 4, 0, 0, 7); g.fill();
    rr(g, 2, 62, 22, 10, "#cfcabb"); rr(g, 5, 8, 16, 56, "#e8e4d8"); rr(g, 5, 8, 5, 56, "#f6f3ea"); rr(g, 18, 8, 3, 56, "#c9c3b0"); rr(g, 2, 0, 22, 10, "#d8d3c4"); rr(g, 2, 8, 22, 3, "#b9b3a0");
    for (let y = 14; y < 60; y += 12) rr(g, 5, y, 16, 1, "rgba(0,0,0,.08)");
    return { img: c, w: 26, h: 76, ob: 10, anchoOb: 18 };
  }
  if (tipo === "altar") {
    const [c, g] = lienzo(76, 56); g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(4, 50, 68, 5);
    rr(g, 4, 26, 68, 26, "#b9b2cc"); rr(g, 4, 26, 68, 5, "#d4cee4"); rr(g, 10, 12, 56, 16, "#8c2f48"); rr(g, 10, 12, 56, 3, "#b4445f");
    g.fillStyle = "#ffe08a"; g.beginPath(); g.arc(38, 8, 6, 0, 7); g.fill(); g.fillStyle = "rgba(255,224,138,.35)"; g.beginPath(); g.arc(38, 8, 11, 0, 7); g.fill();
    return { img: c, w: 76, h: 56, ob: 18 };
  }
  if (tipo === "atril") {
    const [c, g] = lienzo(30, 46); g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(3, 42, 24, 4);
    rr(g, 12, 18, 6, 26, "#5a3a1e"); rr(g, 4, 40, 22, 5, "#4a2f17"); rr(g, 2, 6, 26, 14, "#a8763e"); rr(g, 2, 6, 26, 4, "#c98d4d"); rr(g, 6, 3, 18, 5, "#fff4d6");
    return { img: c, w: 30, h: 46, ob: 10 };
  }
  if (tipo === "puesto") {
    const [c, g] = lienzo(84, 70); g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(6, 64, 74, 5);
    rr(g, 8, 24, 5, 42, "#5a3a1e"); rr(g, 71, 24, 5, 42, "#5a3a1e"); rr(g, 6, 40, 72, 22, "#b0773c"); rr(g, 6, 40, 72, 4, "#c98d4d");
    const a = pick(), b = "#fff4d6"; for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(2 + i * 13, 6, 13, 22); g.beginPath(); g.arc(8.5 + i * 13, 28, 6.5, 0, Math.PI); g.fill(); }
    g.font = "16px " + FUENTE_EMOJI; g.textBaseline = "alphabetic"; g.textAlign = "center"; const bienes = ["🍎", "🧥", "⚔️", "🛡️", "📜", "🎒", "🪙", "🧪"]; for (let i = 0; i < 4; i++) g.fillText(bienes[Math.floor(r() * bienes.length)], 16 + i * 17, 40);
    return { img: c, w: 84, h: 70, ob: 22 };
  }
  if (tipo === "caja") { const [c, g] = lienzo(28, 28); g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(2, 24, 24, 4); rr(g, 2, 6, 24, 20, "#9a6a35"); rr(g, 2, 6, 24, 4, "#b8824a"); rr(g, 2, 14, 24, 2, "#6e4a24"); rr(g, 12, 6, 4, 20, "#6e4a24"); return { img: c, w: 28, h: 28, ob: 12 }; }
  if (tipo === "barril") { const [c, g] = lienzo(24, 32); g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.ellipse(12, 29, 10, 3, 0, 0, 7); g.fill(); rr(g, 3, 4, 18, 24, "#8a5a2b"); rr(g, 3, 4, 5, 24, "#a8763e"); rr(g, 3, 9, 18, 2, "#3f2712"); rr(g, 3, 21, 18, 2, "#3f2712"); g.fillStyle = "#6e4a24"; g.beginPath(); g.ellipse(12, 5, 9, 3, 0, 0, 7); g.fill(); return { img: c, w: 24, h: 32, ob: 10 }; }
  // planta
  const [c, g] = lienzo(26, 36); g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.ellipse(13, 33, 9, 3, 0, 0, 7); g.fill();
  rr(g, 6, 22, 14, 11, "#b5653a"); rr(g, 5, 20, 16, 4, "#c97a4a");
  [["#3f8f43", 13, 12, 9], ["#4fae55", 8, 15, 7], ["#4fae55", 18, 15, 7], ["#66bb6a", 13, 7, 6]].forEach(([col, x, y, rad]) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rad, rad + 2, 0, 0, 7); g.fill(); });
  return { img: c, w: 26, h: 36, ob: 8 };
}

// La disposición de cada interior: muebles, huecos para personajes de misión y decorado del suelo/paredes.
function disenoInterior(tema, W, H) {
  const cx = W / 2;
  const base = { muebles: [], velas: [], slots: [] };
  if (tema === "biblioteca") {
    base.muebles = [["estante", 80, 86], ["estante", 160, 86], ["estante", W - 160, 86], ["estante", W - 80, 86], ["mesa", cx, 214], ["planta", 52, 300], ["planta", W - 52, 300], ["banco", 110, 262], ["banco", W - 110, 262]];
    base.slots = [{ x: cx + 58, y: 222 }, { x: cx - 66, y: 232 }, { x: cx, y: 150 }, { x: 150, y: 302 }, { x: W - 150, y: 302 }];
  } else if (tema === "agora") {
    base.muebles = [["columna", 96, 150], ["columna", W - 96, 150], ["columna", 96, 270], ["columna", W - 96, 270], ["atril", cx, 118], ["banco", cx - 100, 214], ["banco", cx + 100, 214], ["banco", cx - 100, 256], ["banco", cx + 100, 256]];
    base.slots = [{ x: cx + 38, y: 126 }, { x: cx, y: 188 }, { x: cx - 40, y: 296 }, { x: cx + 40, y: 296 }, { x: 170, y: 150 }];
  } else if (tema === "templo") {
    base.muebles = [["altar", cx, 118], ["banco", 92, 190], ["banco", 92, 236], ["banco", W - 92, 190], ["banco", W - 92, 236], ["planta", 50, 120], ["planta", W - 50, 120]];
    base.velas = [{ x: cx - 66, y: 124 }, { x: cx + 66, y: 124 }, { x: 54, y: 290 }, { x: W - 54, y: 290 }];
    base.slots = [{ x: cx + 62, y: 150 }, { x: cx - 62, y: 150 }, { x: cx, y: 200 }, { x: 130, y: 290 }, { x: W - 130, y: 290 }];
  } else { // mercado
    base.muebles = [["puesto", 100, 128], ["puesto", cx, 128], ["puesto", W - 100, 128], ["caja", W - 52, 236], ["caja", W - 52, 266], ["barril", 52, 240], ["barril", 52, 274], ["planta", W - 50, 306]];
    base.slots = [{ x: (100 + cx) / 2, y: 156 }, { x: (cx + W - 100) / 2, y: 156 }, { x: cx, y: 230 }, { x: 150, y: 290 }, { x: W - 150, y: 290 }];
  }
  return base;
}

function crearInterior(def, edificio) {
  const tm = TEMAS[def.tema], cols = def.cols, filas = def.filas, W = cols * TILE, H = filas * TILE, r = rng(1000 + cols * 7 + def.tema.length * 31);
  const [suelo, g] = lienzo(W, H);
  rr(g, 0, 0, W, H, tm.fondo);
  // piso
  for (let y = 2; y < filas; y++) for (let x = 1; x < cols - 1; x++) {
    const px = x * TILE, py = y * TILE; rr(g, px, py, TILE, TILE, tm.piso[(x + y) % 2]);
    g.strokeStyle = tm.linea; g.lineWidth = 1;
    if (def.tema === "biblioteca" || def.tema === "mercado") { g.beginPath(); g.moveTo(px, py + 0.5); g.lineTo(px + TILE, py + 0.5); g.moveTo(px + (y % 2 ? 11 : 21), py); g.lineTo(px + (y % 2 ? 11 : 21), py + TILE); g.stroke(); }
    else g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
    for (let i = 0; i < 3; i++) { g.fillStyle = "rgba(0,0,0,.05)"; g.fillRect(px + Math.floor(r() * 28), py + Math.floor(r() * 28), 2, 2); }
  }
  // pared de arriba (2 casillas) + paredes de los costados + pared de abajo con la puerta
  rr(g, 0, 0, W, 2 * TILE, tm.pared); rr(g, 0, 2 * TILE - 14, W, 14, tm.zocalo);
  for (let x = 0; x < W; x += 16) rr(g, x, 0, 1, 2 * TILE - 14, "rgba(0,0,0,.08)");
  rr(g, 0, 2 * TILE, TILE, H - 2 * TILE, tm.pared); rr(g, W - TILE, 2 * TILE, TILE, H - 2 * TILE, tm.pared);
  rr(g, 0, H - TILE, W / 2 - TILE, TILE, tm.pared); rr(g, W / 2 + TILE, H - TILE, W / 2 - TILE, TILE, tm.pared);
  rr(g, TILE - 4, 2 * TILE, 4, H - 3 * TILE, "rgba(0,0,0,.18)"); rr(g, W - TILE, 2 * TILE, 4, H - 3 * TILE, "rgba(0,0,0,.18)");
  rr(g, 0, H - TILE, W / 2 - TILE, 5, tm.zocalo); rr(g, W / 2 + TILE, H - TILE, W / 2 - TILE, 5, tm.zocalo);
  // alfombrilla de la puerta
  rr(g, W / 2 - TILE, H - TILE, 2 * TILE, TILE, "#6e4a24"); rr(g, W / 2 - TILE + 4, H - TILE + 4, 2 * TILE - 8, TILE - 4, "#8c2f48"); rr(g, W / 2 - TILE + 8, H - TILE + 8, 2 * TILE - 16, TILE - 12, "#a63a56");
  // ventanas
  const vent = (x, col) => { rr(g, x - 1, 10, 26, 30, "#4a3018"); rr(g, x + 2, 13, 20, 24, col || "#a8d8f0"); rr(g, x + 11, 13, 2, 24, "#4a3018"); rr(g, x + 2, 24, 20, 2, "#4a3018"); rr(g, x + 4, 15, 5, 8, "rgba(255,255,255,.55)"); };
  const xs = def.tema === "mercado" || def.tema === "biblioteca" ? [W / 2 - 13] : [96, W - 96 - 22];
  xs.forEach((x, i) => vent(x, def.tema === "templo" ? ["#e08aa0", "#8ab4e0", "#e0c88a"][i % 3] : null));
  if (def.tema === "agora") { [W / 2 - 60, W / 2 + 36].forEach((x) => { rr(g, x, 8, 24, 34, "#27508a"); rr(g, x + 2, 10, 20, 30, "#3b6cb0"); g.font = "14px " + FUENTE_EMOJI; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff"; g.fillText("⚖️", x + 12, 26); }); }
  if (def.tema === "templo") { g.font = "22px " + FUENTE_EMOJI; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff"; g.fillText("🕊️", W / 2, 26); }
  // alfombras decorativas
  if (def.tema === "biblioteca") { g.fillStyle = "#7a2230"; g.beginPath(); g.ellipse(W / 2, 236, 112, 52, 0, 0, 7); g.fill(); g.strokeStyle = "#e8c36a"; g.lineWidth = 3; g.beginPath(); g.ellipse(W / 2, 236, 104, 46, 0, 0, 7); g.stroke(); }
  if (def.tema === "templo") { rr(g, W / 2 - 34, 2 * TILE, 68, H - 3 * TILE, "#8c2f48"); rr(g, W / 2 - 30, 2 * TILE, 4, H - 3 * TILE, "#e8c36a"); rr(g, W / 2 + 26, 2 * TILE, 4, H - 3 * TILE, "#e8c36a"); }
  if (def.tema === "agora") { g.fillStyle = "#27508a"; g.fillRect(W / 2 - 70, 2 * TILE + 8, 140, 6); g.fillStyle = "#e8c36a"; g.fillRect(W / 2 - 70, 2 * TILE + 14, 140, 2); }
  if (def.tema === "mercado") { rr(g, W / 2 - 60, 190, 120, 70, "#c0562b"); rr(g, W / 2 - 54, 196, 108, 58, "#e0b36a"); }

  const dis = disenoInterior(def.tema, W, H), muebles = [], obstaculos = [];
  const wallBottom = 2 * TILE - 6;
  obstaculos.push({ x: 0, y: 0, w: W, h: wallBottom }, { x: 0, y: 0, w: TILE - 4, h: H }, { x: W - TILE + 4, y: 0, w: TILE - 4, h: H });
  obstaculos.push({ x: 0, y: H - TILE + 6, w: W / 2 - TILE, h: TILE }, { x: W / 2 + TILE, y: H - TILE + 6, w: W / 2 - TILE, h: TILE }, { x: 0, y: H + 2, w: W, h: TILE * 2 });
  for (const [t, x, y] of dis.muebles) {
    const m = fabricarMueble(t, r); muebles.push({ ...m, x, y });
    const ancho = (m.anchoOb || m.w) - 6, alto = m.pared ? Math.max(8, y - wallBottom) : m.ob;
    obstaculos.push({ x: x - ancho / 2, y: y - alto, w: ancho, h: alto });
  }
  const salidas = [{ x: W / 2 - TILE + 6, y: H - TILE + 12, w: 2 * TILE - 12, h: TILE + 20 }];
  return {
    id: "int_" + edificio.id, nombre: edificio.nombre, icono: edificio.icono, exterior: false, edificioId: edificio.id,
    ancho: W, alto: H, suelo, fondo: tm.fondo, obstaculos, spawn: { x: W / 2, y: H - TILE - 6 }, mini: null, estrellas: [],
    npcs: [], puertas: [], salidas, slots: dis.slots, velas: dis.velas, bloqueado: () => false, piso: () => tm.sonido,
    puntoLibre(rand, chocaFn) { for (let i = 0; i < 300; i++) { const x = TILE * 2 + rand() * (W - TILE * 4), y = TILE * 4 + rand() * (H - TILE * 6); if (!chocaFn(x, y)) return { x, y }; } return { x: W / 2, y: H - 80 }; },
    objetos(lista, ctx, camX, camY, visible, t) {
      for (const m of muebles) lista.push({ y: m.y, d: () => ctx.drawImage(m.img, Math.round(m.x - m.w / 2 - camX), Math.round(m.y - m.h - camY)) });
      for (const v of dis.velas) lista.push({ y: v.y, d: () => {
        const x = Math.round(v.x - camX), y = Math.round(v.y - camY), f = Math.sin(t * 9 + v.x) * 1.5;
        ctx.fillStyle = "rgba(255,200,80,.18)"; ctx.beginPath(); ctx.arc(x, y - 22, 16 + f, 0, 7); ctx.fill();
        ctx.fillStyle = "#e8e0c8"; ctx.fillRect(x - 3, y - 14, 6, 14); ctx.fillStyle = "#ffb83d"; ctx.beginPath(); ctx.ellipse(x, y - 19 + f * 0.3, 3, 5 + f * 0.4, 0, 0, 7); ctx.fill(); ctx.fillStyle = "#fff2a8"; ctx.fillRect(x - 1, y - 20, 2, 4);
      } });
    },
    efectos: null,
  };
}

// =====================================================================================
//  EL MOTOR
// =====================================================================================
const NOMBRES_ALDEANOS = ["Mara", "Tomás", "Lucía", "Bruno", "Inés", "Mateo", "Elena", "Pablo", "Rosa", "Hugo", "Clara", "Andrés", "Sofía", "Julián"];
const FRASES = [
  "¡Buen día! Dicen que ayudar a un compañero vale más que cualquier XP.",
  "Ayer vi una estrella ⭐ brillando cerca del lago. ¡Corre a buscarla!",
  "La Biblioteca guarda más secretos de los que parece.",
  "En el Mercado puedes ver las piezas que mejoran a tu personaje.",
  "El sabio de la fuente adora los acertijos. ¡Habla con él!",
  "Si te pierdes, mira el mapa en la esquina de la pantalla.",
  "La gratitud es la única moneda que nunca se acaba.",
  "Por aquí todos nos conocemos. ¿Ya conociste al Guardián del Ágora?",
  "Me encanta venir a la plaza: siempre pasa algo nuevo.",
  "Dicen que en la Comarca los reinos compiten por ser los mejores. ¡Qué emoción!",
  "Hoy no he aprendido nada nuevo… ¡todavía! El día es largo.",
  "El respeto empieza con escuchar. Es un buen consejo, ¿verdad?",
  "¿Entraste a los edificios? Cada uno tiene a alguien esperándote.",
  "Camina con calma: la aldea es grande y hay mucho por descubrir.",
];
const SPRITE_POR_LUGAR = { biblioteca: "cronista_femenino", agora: "defensor_masculino", templo: "peregrino_femenino", mercado: "consejero_masculino", plaza: "maestro_gremio_masculino" };
const html = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function iniciarMundo(raiz, op) {
  asegurarCss();
  raiz.innerHTML = PLANTILLA;
  const q = (s) => raiz.querySelector(s);
  const cv = q(".m-canvas"), ctx = cv.getContext("2d"), mini = q(".m-mini"), mctx = mini.getContext("2d");
  const sprites = op.sprites, claves = Object.keys(sprites), J = op.jugador;
  const claveJugador = sprites[J.clave] ? J.clave : claves[0];
  const otras = claves.filter((k) => k !== claveJugador);
  const temporizadores = new Set(); const espera = (fn, ms) => { const t = setTimeout(() => { temporizadores.delete(t); fn(); }, ms); temporizadores.add(t); };
  let vivo = true, rafId = 0, ultimo = 0, SCALE = 2, LW = 320, LH = 200, camX = 0, camY = 0;

  // ---- imágenes de todos los personajes (8 direcciones cada uno) ----
  const imgs = {};
  await Promise.all(claves.map((k) => { imgs[k] = {}; return Promise.all(DIRS8.map((d) => new Promise((ok) => { const im = new Image(); im.onload = ok; im.onerror = ok; im.src = sprites[k].dirs[d]; imgs[k][d] = im; }))); }));

  // ---- escenas ----
  const exterior = crearExterior();
  const interiores = {}; for (const e of exterior.edificios) interiores[e.id] = crearInterior(e.interior, e);
  const escenas = { exterior }; Object.values(interiores).forEach((s) => (escenas[s.id] = s));
  const rand = rng(4242);

  // ---- colisiones (sirven para el jugador y para los aldeanos) ----
  function chocaEn(esc, x, y) {
    const bx = x - 6, by = y - 8, bw = 12, bh = 8;
    if (esc.bloqueado(bx, by) || esc.bloqueado(bx + bw, by) || esc.bloqueado(bx, by + bh) || esc.bloqueado(bx + bw, by + bh)) return true;
    for (const o of esc.obstaculos) if (bx < o.x + o.w && bx + bw > o.x && by < o.y + o.h && by + bh > o.y) return true;
    for (const n of esc.npcs) if (n.solido && bx < n.x + 13 && bx + bw > n.x - 13 && by < n.y + 3 && by + bh > n.y - 12) return true; // zona sólida de los personajes de misión: los vecinos no se les encimen
    return false;
  }

  // ---- misiones: cada una la da un personaje, dentro de un edificio o en la plaza ----
  const misiones = op.misiones || [];
  const hechas = new Set(op.hechas || []);
  const SLOTS_PLAZA = [{ x: exterior.plaza.cx * TILE + 74, y: exterior.plaza.cy * TILE + 18 }, { x: exterior.plaza.cx * TILE - 74, y: exterior.plaza.cy * TILE + 34 }, { x: exterior.plaza.cx * TILE + 14, y: exterior.plaza.cy * TILE - 70 }, { x: exterior.plaza.cx * TILE - 40, y: exterior.plaza.cy * TILE + 90 }, { x: exterior.plaza.cx * TILE + 96, y: exterior.plaza.cy * TILE + 80 }];
  function spriteParaMision(m, i) { let k = m.npc_sprite && sprites[m.npc_sprite] ? m.npc_sprite : SPRITE_POR_LUGAR[m.lugar] || SPRITE_POR_LUGAR.plaza; if (!sprites[k] || k === claveJugador) k = otras[i % otras.length]; return k; }
  const cuenta = {};
  misiones.forEach((m, i) => {
    const lugar = interiores[m.lugar] ? m.lugar : "plaza", esc = lugar === "plaza" ? exterior : interiores[lugar];
    const n = (cuenta[lugar] = (cuenta[lugar] ?? -1) + 1), slots = lugar === "plaza" ? SLOTS_PLAZA : esc.slots, s = slots[n % slots.length];
    esc.npcs.push({ tipo: "mision", mision: m, lugar, nombre: m.npc_nombre || "Aldeano", emoji: m.npc_emoji || "💬", clave: spriteParaMision(m, i), x: s.x, y: s.y, dir: "south", solido: true });
  });

  // ---- aldeanos: muchos personajes caminando por ahí ----
  let contadorAldeanos = 0;
  function poblar(esc, cantidad) {
    for (let i = 0; i < cantidad; i++) {
      const p = esc.puntoLibre(rand, (x, y) => chocaEn(esc, x, y)), k = contadorAldeanos++;
      esc.npcs.push({ tipo: "aldeano", nombre: NOMBRES_ALDEANOS[k % NOMBRES_ALDEANOS.length], clave: otras[k % otras.length], frase: FRASES[(k * 5 + 1) % FRASES.length], x: p.x, y: p.y, dir: "south", meta: null, pausa: rand() * 2, caminando: false });
    }
  }
  poblar(exterior, op.aldeanos ?? 9); Object.values(interiores).forEach((s) => poblar(s, op.aldeanosDentro ?? 2));

  // ---- sonido ----
  const snd = op.sonido === false ? crearSonido.apagado || { reanudar() {}, alternar() { return true; }, musica() {}, paso() {}, estrella() {}, bien() {}, mal() {}, hablar() {}, puerta() {}, destruir() {}, mudo: true } : crearSonido();

  // ---- estado ----
  const estado = {
    activo: true, escena: exterior, clave: claveJugador, nombre: J.nombre || "Estudiante", x: exterior.spawn.x, y: exterior.spawn.y, dir: "south", caminando: false,
    xp: J.xp || 0, oro: J.oro || 0, ganado: { xp: 0, oro: 0 }, est: 0, cercano: null, dialogo: null, avisos: [], fase: 0, terminado: false, cambiando: false, pasoT: 0.3,
    comp: { x: exterior.spawn.x, y: exterior.spawn.y }, hechas,
  };
  const teclas = new Set(), joy = { x: 0, y: 0 };

  // ---- HUD ----
  const pendientesEn = (lugar) => misiones.filter((m) => (interiores[m.lugar] ? m.lugar : "plaza") === lugar && !hechas.has(m.id)).length;
  function toast(texto, ms = 2800) { const t = q(".m-toast"); t.textContent = texto; t.classList.remove("oculto"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add("oculto"), ms); temporizadores.add(toast.h); }
  function mostrarLugar(esc) { const l = q(".m-lugar"); l.textContent = `${esc.icono} ${esc.nombre}`; l.classList.add("ver"); clearTimeout(mostrarLugar.h); mostrarLugar.h = setTimeout(() => l.classList.remove("ver"), 2400); temporizadores.add(mostrarLugar.h); }
  function posicionarMini() { const h = q(".m-hud").getBoundingClientRect(); mini.style.top = Math.round(h.bottom - raiz.getBoundingClientRect().top + 6) + "px"; q(".m-lugar").style.top = Math.round(h.bottom - raiz.getBoundingClientRect().top + (estado.escena.exterior ? 6 : 6)) + "px"; }
  function actualizarHud() {
    q(".h-xp").textContent = estado.xp; q(".h-oro").textContent = estado.oro; q(".h-mis").textContent = `${[...hechas].filter((id) => misiones.some((m) => m.id === id)).length}/${misiones.length}`; q(".h-est").textContent = `${estado.est}/${exterior.estrellas.length}`;
    posicionarMini();
  }
  function ajustarLienzo() {
    const r = raiz.getBoundingClientRect();
    SCALE = Math.max(1, Math.round(Math.min(r.width, r.height) / 360)); LW = Math.max(160, Math.ceil(r.width / SCALE)); LH = Math.max(120, Math.ceil(r.height / SCALE));
    cv.width = LW; cv.height = LH; ctx.imageSmoothingEnabled = false; mini.style.width = r.width < 520 ? "92px" : "128px"; posicionarMini();
  }
  const aviso = (texto, color) => estado.avisos.push({ texto, color: color || "#fff", t: 0 });

  // ---- cambio de escena (entrar y salir de los edificios) ----
  function cambiarEscena(esc, x, y) {
    if (estado.cambiando) return; estado.cambiando = true; teclas.clear(); joy.x = joy.y = 0;
    const f = q(".m-fundido"); f.classList.add("ver");
    espera(() => {
      estado.escena = esc; estado.x = x; estado.y = y; estado.comp = { x, y };
      mini.classList.toggle("oculto", !esc.exterior); mostrarLugar(esc); snd.musica(esc.exterior ? "exterior" : "interior"); posicionarMini();
      f.classList.remove("ver"); espera(() => { estado.cambiando = false; }, 200);
    }, 200);
  }
  const entrarEdificio = (e) => { snd.puerta(); cambiarEscena(interiores[e.id], interiores[e.id].spawn.x, interiores[e.id].spawn.y); };
  const salirDeEdificio = () => { const e = exterior.edificios.find((b) => b.id === estado.escena.edificioId); snd.puerta(); cambiarEscena(exterior, e.puerta.x, e.puerta.y + 26); };

  // ---- diálogos ----
  function cabecera(n, titulo) {
    const foto = n.clave && sprites[n.clave] ? `<img class="m-avatar" src="${sprites[n.clave].dirs.south}" alt="">` : `<span class="m-emo">${html(n.emoji || "💬")}</span>`;
    return `<div class="m-cab">${foto}<div><div class="m-quien">${html(n.nombre)}</div>${titulo ? `<div class="m-titulo">${html(titulo)}</div>` : ""}</div><button class="m-cerrar" data-a="cerrar" aria-label="Cerrar">✕</button></div>`;
  }
  function abrirTarjeta(htmlInterno) {
    const d = q(".m-dialogo"); d.classList.remove("oculto"); teclas.clear(); joy.x = joy.y = 0;
    d.innerHTML = `<div class="m-tarjeta">${htmlInterno}</div>`;
    d.querySelectorAll('[data-a="cerrar"]').forEach((b) => (b.onclick = cerrarDialogo));
    return d;
  }
  function cerrarDialogo() {
    if (estado.dialogo && estado.dialogo.hablando) estado.dialogo.hablando = false;
    estado.dialogo = null; estado.respondiendo = false; q(".m-dialogo").classList.add("oculto"); cv.focus();
    if (misiones.length && misiones.every((m) => hechas.has(m.id)) && !estado.terminado) {
      estado.terminado = true; q(".m-fin-texto").textContent = `En esta visita ganaste ${estado.ganado.xp} XP y ${estado.ganado.oro} monedas.` + (op.modoPrueba ? " (Modo prueba: no se guardó nada.)" : " Todo ya quedó sumado a tu progreso de CÓDICE."); q(".m-fin").classList.remove("oculto"); snd.bien();
    }
  }
  function abrirCharla(n) {
    estado.dialogo = n; n.hablando = true; snd.hablar();
    const d = abrirTarjeta(`${cabecera(n, "Vecino de la aldea")}<p class="m-texto">${html(n.frase)}</p><button class="m-ok" data-a="cerrar">¡Gracias!</button>`);
    d.querySelectorAll('[data-a="cerrar"]').forEach((b) => (b.onclick = cerrarDialogo));
  }
  function abrirMision(n) {
    const m = n.mision, hecha = hechas.has(m.id); estado.dialogo = n; n.hablando = true; snd.hablar();
    if (hecha) {
      abrirTarjeta(`${cabecera(n, m.titulo + " · ✅ completada")}<p class="m-texto">¡Ya completaste esta misión! Gracias por tu ayuda. Sigue explorando: todavía hay más por descubrir.</p><button class="m-ok" data-a="cerrar">Seguir</button>`);
      return;
    }
    const d = abrirTarjeta(`${cabecera(n, "🎯 " + m.titulo)}<p class="m-texto">${html(m.texto)}</p><div class="m-ops">${(m.opciones || []).map((o, i) => `<button class="m-opcion" data-i="${i}">${i + 1}. ${html(o)}</button>`).join("")}</div><div class="m-retro-caja"></div>`);
    d.querySelectorAll(".m-opcion").forEach((b) => (b.onclick = () => responder(n, Number(b.dataset.i), b)));
  }
  async function responder(n, i, boton) {
    const m = n.mision, caja = q(".m-retro-caja"); if (estado.respondiendo) return;
    if (i !== m.correcta) { boton.classList.add("mal"); boton.disabled = true; caja.innerHTML = `<div class="m-retro mal">No es esa 🤔 ${html(m.pista || "Piénsalo otra vez.")}</div>`; snd.mal(); return; }
    estado.respondiendo = true; q(".m-ops").querySelectorAll(".m-opcion").forEach((b) => (b.disabled = true)); boton.classList.add("bien");
    caja.innerHTML = `<div class="m-retro bien">⏳ Guardando tu respuesta…</div>`;
    let r; try { r = await op.alCompletar(m); } catch (e) { r = { ok: false, mensaje: e && e.message }; }
    estado.respondiendo = false; if (!vivo) return;
    if (!r || r.ok === false) { // no se pudo guardar: se puede intentar de nuevo, y NO se marca como hecha
      q(".m-ops").querySelectorAll(".m-opcion").forEach((b) => { b.disabled = false; b.classList.remove("bien"); });
      caja.innerHTML = `<div class="m-retro mal">No se pudo guardar tu premio: ${html((r && r.mensaje) || "intenta de nuevo")}. Puedes volver a tocar la respuesta.</div>`; snd.mal(); return;
    }
    hechas.add(m.id);
    if (!r.yaEstaba) {
      if (r.xp != null) estado.xp = r.xp; else estado.xp += m.xp || 0;
      if (r.oro != null) estado.oro = r.oro; else estado.oro += m.oro || 0;
      estado.ganado.xp += m.xp || 0; estado.ganado.oro += m.oro || 0; aviso(`+${m.xp || 0} XP`, "#fde68a");
    }
    actualizarHud(); snd.bien();
    caja.innerHTML = `<div class="m-retro bien">${html(m.retro || "¡Muy bien!")}</div><div class="m-premio">${r.yaEstaba ? "Ya tenías esta misión registrada ✅" : `🎁 +${m.xp || 0} XP · +${m.oro || 0} 🪙`}${op.modoPrueba ? " · 🧪 modo prueba (no se guarda)" : ""}</div><button class="m-ok" data-a="cerrar">¡Genial!</button>`;
    caja.querySelector('[data-a="cerrar"]').onclick = cerrarDialogo;
  }
  function interactuar() {
    if (estado.dialogo || estado.cambiando || !estado.activo || !estado.cercano) return;
    const n = estado.cercano;
    if (n.tipo === "puerta") entrarEdificio(n.edificio); else if (n.tipo === "mision") abrirMision(n); else if (n.tipo === "aldeano") abrirCharla(n);
  }

  // ---- movimiento ----
  function leerEntrada() {
    let ax = (teclas.has("ArrowRight") || teclas.has("d") ? 1 : 0) - (teclas.has("ArrowLeft") || teclas.has("a") ? 1 : 0);
    let ay = (teclas.has("ArrowDown") || teclas.has("s") ? 1 : 0) - (teclas.has("ArrowUp") || teclas.has("w") ? 1 : 0);
    if (!ax && !ay) { const m = Math.hypot(joy.x, joy.y); if (m > 0.22) { ax = joy.x; ay = joy.y; } }
    const m = Math.hypot(ax, ay); if (m > 1) { ax /= m; ay /= m; }
    return [ax, ay];
  }
  function mover(dx, dy) {
    if (dx && !chocaEn(estado.escena, estado.x + dx, estado.y)) estado.x += dx;
    if (dy && !chocaEn(estado.escena, estado.x, estado.y + dy)) estado.y += dy;
  }
  function moverAldeano(v, esc, dt) {
    if (v.hablando) { v.caminando = false; return; }
    if (v.pausa > 0) { v.pausa -= dt; v.caminando = false; return; }
    if (!v.meta) { const a = rand() * 6.283, d = 40 + rand() * 120; v.meta = { x: v.x + Math.cos(a) * d, y: v.y + Math.sin(a) * d }; }
    const vx = v.meta.x - v.x, vy = v.meta.y - v.y, dist = Math.hypot(vx, vy);
    if (dist < 4) { v.meta = null; v.pausa = 1 + rand() * 3; v.caminando = false; return; }
    const paso = 38 * dt, dx = (vx / dist) * paso, dy = (vy / dist) * paso; let movio = false;
    if (!chocaEn(esc, v.x + dx, v.y)) { v.x += dx; movio = true; }
    if (!chocaEn(esc, v.x, v.y + dy)) { v.y += dy; movio = true; }
    v.caminando = movio; v.dir = direccionDe(vx, vy);
    if (!movio) { v.meta = null; v.pausa = 0.4 + rand(); }
  }

  function actualizar(dt) {
    estado.fase += dt;
    const esc = estado.escena;
    const bloqueada = estado.dialogo || estado.cambiando || !q(".m-fin").classList.contains("oculto");
    const [ax, ay] = bloqueada ? [0, 0] : leerEntrada();
    estado.caminando = !!(ax || ay);
    if (estado.caminando) {
      mover(ax * 96 * dt, ay * 96 * dt); estado.dir = direccionDe(ax, ay); estado.pasoT += dt;
      if (estado.pasoT > 0.34) { estado.pasoT = 0; snd.paso(esc.piso(estado.x, estado.y)); }
    } else estado.pasoT = 0.3;
    // el compañero (si tiene uno) camina detrás
    const ox = estado.x - { east: 22, "south-east": 16, south: 0, "south-west": -16, west: -22, "north-west": -16, north: 0, "north-east": 16 }[estado.dir], oy = estado.y - { east: 0, "south-east": 12, south: 22, "south-west": 12, west: 0, "north-west": -12, north: -22, "north-east": -12 }[estado.dir] + 6;
    estado.comp.x += (ox - estado.comp.x) * Math.min(1, dt * 5); estado.comp.y += (oy - estado.comp.y) * Math.min(1, dt * 5);
    // estrellas
    for (const s of esc.estrellas) if (!s.tomada && Math.hypot(s.x - estado.x, s.y - 6 - estado.y) < 16) { s.tomada = true; estado.est++; actualizarHud(); aviso("⭐", "#fde68a"); snd.estrella(); }
    // salida de los edificios (caminar hacia la puerta)
    if (!esc.exterior && !estado.cambiando && esc.salidas.some((s) => estado.x > s.x && estado.x < s.x + s.w && estado.y > s.y && estado.y < s.y + s.h)) salirDeEdificio();
    // personajes
    for (const n of esc.npcs) if (n.tipo === "aldeano") moverAldeano(n, esc, dt);
    for (const n of esc.npcs) if ((n.hablando || Math.hypot(n.x - estado.x, n.y - estado.y) < 90) && n.tipo !== "puerta") { if (n.tipo === "mision" || n.hablando) n.dir = direccionDe(estado.x - n.x, estado.y - n.y); }
    // el más cercano con quien se puede interactuar
    let mejor = null, md = 1e9;
    for (const n of [...esc.npcs, ...esc.puertas]) { const rad = n.radio || 40, d = Math.hypot(n.x - estado.x, n.y - estado.y); if (d < rad && d < md) { md = d; mejor = n; } }
    estado.cercano = mejor;
    const av = q(".m-aviso"), ba = q(".m-accion");
    if (mejor && !estado.dialogo && !estado.cambiando) {
      av.textContent = (mejor.tipo === "puerta" ? `🚪 Entrar a ${mejor.nombre}` : `💬 Hablar con ${mejor.nombre}`) + (tactil ? "" : " (E)"); av.classList.remove("oculto"); ba.classList.add("listo"); ba.textContent = mejor.tipo === "puerta" ? "🚪" : "💬";
    } else { av.classList.add("oculto"); ba.classList.remove("listo"); }
    for (const a of estado.avisos) a.t += dt; estado.avisos = estado.avisos.filter((a) => a.t < 1.3);
  }

  // ---- dibujo ----
  const sombra = (x, y, rx, ry) => { ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(x - camX, y - camY, rx, ry, 0, 0, 7); ctx.fill(); };
  function dibujarPersonaje(clave, dir, x, y, caminando, t, salto) {
    const an = sprites[clave].ancla, im = imgs[clave][dir] || imgs[clave].south, b = caminando ? -Math.abs(Math.sin(t * 11 + x)) * 2 : 0;
    ctx.drawImage(im, Math.round(x - an.cx - camX), Math.round(y - an.by - camY + b + (salto || 0)));
  }
  function etiqueta(texto, x, y, color) { ctx.font = "bold 9px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.75)"; ctx.strokeText(texto, x, y); ctx.fillStyle = color || "#fff"; ctx.fillText(texto, x, y); }
  const emoji = (txt, x, y, px) => { ctx.globalAlpha = 1; ctx.fillStyle = "#000"; ctx.font = px + "px " + FUENTE_EMOJI; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText(txt, Math.round(x - camX), Math.round(y - camY)); };
  function dibujar() {
    const esc = estado.escena, t = estado.fase;
    camX = Math.round(Math.min(Math.max(estado.x - LW / 2, 0), Math.max(0, esc.ancho - LW))); camY = Math.round(Math.min(Math.max(estado.y - 12 - LH / 2, 0), Math.max(0, esc.alto - LH)));
    if (esc.ancho < LW) camX = -Math.round((LW - esc.ancho) / 2); if (esc.alto < LH) camY = -Math.round((LH - esc.alto) / 2);
    ctx.globalAlpha = 1; ctx.fillStyle = esc.fondo; ctx.fillRect(0, 0, LW, LH);
    const sx = Math.max(0, camX), sy = Math.max(0, camY), dx = sx - camX, dy = sy - camY, sw = Math.min(LW - dx, esc.ancho - sx), sh = Math.min(LH - dy, esc.alto - sy);
    if (sw > 0 && sh > 0) ctx.drawImage(esc.suelo, sx, sy, sw, sh, dx, dy, sw, sh);
    if (esc.efectos) esc.efectos(ctx, t, camX, camY, LW, LH);
    const lista = [], visible = (x, y, m = 70) => x - camX > -m && x - camX < LW + m && y - camY > -m && y - camY < LH + m;
    esc.objetos(lista, ctx, camX, camY, visible, t);
    for (const s of esc.estrellas) if (!s.tomada && visible(s.x, s.y)) lista.push({ y: s.y, d: () => emoji("⭐", s.x, s.y - 8 + Math.sin(t * 4 + s.x) * 2, 16) });
    for (const n of esc.npcs) lista.push({ y: n.y, d: () => {
      sombra(n.x, n.y, 9, 3.5); dibujarPersonaje(n.clave, n.dir, n.x, n.y, n.caminando, t);
      if (n.tipo === "mision") { const hecha = hechas.has(n.mision.id), b = hecha ? 0 : Math.sin(t * 5 + n.x) * 3, an = sprites[n.clave].ancla; emoji(hecha ? "✅" : "❗", n.x, n.y - an.by - 4 + b, 18); }
      else if (Math.hypot(n.x - estado.x, n.y - estado.y) < 60) etiqueta(n.nombre, Math.round(n.x - camX), Math.round(n.y - sprites[n.clave].ancla.by - camY - 3), "#e8edf8");
    } });
    if (esc.exterior) for (const e of esc.edificios) { const p = pendientesEn(e.id); if (p > 0 && visible(e.puerta.x, e.puerta.y)) lista.push({ y: e.puerta.y + 40, d: () => emoji("❗", e.puerta.x, e.puerta.y - 58 + Math.sin(t * 5 + e.x) * 3, 20) }); }
    if (J.companero) lista.push({ y: estado.comp.y, d: () => { sombra(estado.comp.x, estado.comp.y, 6, 2.5); emoji(J.companero, estado.comp.x, estado.comp.y - 2 - Math.abs(Math.sin(t * 9)) * (estado.caminando ? 2 : 0), 18); } });
    lista.push({ y: estado.y, d: () => {
      const an = sprites[estado.clave].ancla;
      if (J.nivel && J.nivel.color) { const a = 0.35 + Math.sin(t * 3) * 0.08, gx = Math.round(estado.x - camX), gy = Math.round(estado.y - camY), gr = ctx.createRadialGradient(gx, gy, 2, gx, gy, 24); gr.addColorStop(0, J.nivel.color + "cc"); gr.addColorStop(1, J.nivel.color + "00"); ctx.globalAlpha = a + 0.4; ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(gx, gy, 26, 11, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      sombra(estado.x, estado.y, 10, 4); dibujarPersonaje(estado.clave, estado.dir, estado.x, estado.y, estado.caminando, t);
      etiqueta(estado.nombre, Math.round(estado.x - camX), Math.round(estado.y - an.by - camY - 3));
    } });
    lista.sort((a, b) => a.y - b.y); for (const o of lista) o.d();
    ctx.font = "bold 11px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    for (const a of estado.avisos) { const yy = estado.y - 56 - a.t * 22 - camY, xx = estado.x - camX; ctx.globalAlpha = Math.max(0, 1 - a.t / 1.3); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.7)"; ctx.strokeText(a.texto, xx, yy); ctx.fillStyle = a.color; ctx.fillText(a.texto, xx, yy); ctx.globalAlpha = 1; }
    if (esc.exterior) dibujarMini();
  }
  function dibujarMini() {
    const m = exterior.mini, k = m.k * (mini.width / (MW * 3));
    mctx.clearRect(0, 0, mini.width, mini.height); mctx.drawImage(m.base, 0, 0, mini.width, mini.height);
    const punto = (x, y, col, r) => { mctx.fillStyle = col; mctx.beginPath(); mctx.arc(x * k, y * k, r, 0, 7); mctx.fill(); mctx.strokeStyle = "#000"; mctx.lineWidth = 0.8; mctx.stroke(); };
    for (const e of exterior.edificios) { const total = misiones.filter((mm) => mm.lugar === e.id).length; if (total) punto(e.puerta.x, e.puerta.y, pendientesEn(e.id) ? "#fbbf24" : "#34d399", 3.4); }
    for (const n of exterior.npcs) if (n.tipo === "mision") punto(n.x, n.y, hechas.has(n.mision.id) ? "#34d399" : "#fbbf24", 3.2);
    for (const s of exterior.estrellas) if (!s.tomada) { mctx.fillStyle = "#fff"; mctx.fillRect(s.x * k - 1, s.y * k - 1, 2, 2); }
    mctx.fillStyle = "#7c3aed"; mctx.beginPath(); mctx.arc(estado.x * k, estado.y * k, 3.8, 0, 7); mctx.fill(); mctx.strokeStyle = "#fff"; mctx.lineWidth = 1.5; mctx.stroke();
  }
  function cuadro(ahora) {
    if (!vivo) return;
    const dt = Math.min(0.05, (ahora - ultimo) / 1000 || 0); ultimo = ahora;
    actualizar(dt); dibujar(); rafId = requestAnimationFrame(cuadro);
  }

  // ---- entrada: teclado, círculo táctil y botón de acción ----
  const tactil = "ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0 || op.forzarTactil === true;
  function alTeclaAbajo(e) {
    snd.reanudar(); const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
    if (k === "m") { alternarSonido(); return; }
    if (estado.dialogo) {
      if (e.key === "Escape") cerrarDialogo();
      const n = Number(k), btn = n >= 1 && n <= 6 ? raiz.querySelector(`.m-opcion[data-i="${n - 1}"]`) : null; if (btn && !btn.disabled) btn.click(); return;
    }
    teclas.add(k); if (k === "e" || k === " " || k === "Enter") interactuar();
  }
  const alTeclaArriba = (e) => teclas.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  const alPerderFoco = () => teclas.clear();
  const alRedimensionar = () => ajustarLienzo();
  window.addEventListener("keydown", alTeclaAbajo); window.addEventListener("keyup", alTeclaArriba); window.addEventListener("blur", alPerderFoco); window.addEventListener("resize", alRedimensionar);
  const jb = q(".m-joy"), jk = q(".m-knob"); let joyActivo = false;
  function joyMover(e) { const r = jb.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const d = Math.hypot(dx, dy), R = 46; if (d > R) { dx = dx / d * R; dy = dy / d * R; } joy.x = dx / R; joy.y = dy / R; jk.style.transform = `translate(${dx}px, ${dy}px)`; }
  const joyFin = () => { joyActivo = false; joy.x = joy.y = 0; jk.style.transform = "translate(0,0)"; };
  jb.addEventListener("pointerdown", (e) => { snd.reanudar(); jb.setPointerCapture(e.pointerId); joyActivo = true; joyMover(e); e.preventDefault(); });
  jb.addEventListener("pointermove", (e) => { if (joyActivo) joyMover(e); });
  jb.addEventListener("pointerup", joyFin); jb.addEventListener("pointercancel", joyFin);
  q(".m-accion").addEventListener("pointerdown", (e) => { e.preventDefault(); snd.reanudar(); interactuar(); });
  cv.addEventListener("pointerdown", () => { snd.reanudar(); cv.focus(); });
  function alternarSonido() { const mudo = snd.alternar(); q(".b-sonido").textContent = mudo ? "🔇" : "🔊"; toast(mudo ? "Sonido apagado" : "Sonido encendido", 1200); }
  q(".b-sonido").onclick = alternarSonido;
  q(".b-salir").onclick = () => op.alSalir && op.alSalir();
  q(".b-seguir").onclick = () => { q(".m-fin").classList.add("oculto"); cv.focus(); };

  // ---- arranque ----
  q(".m-foto").src = sprites[claveJugador].dirs.south; q(".m-nombre").textContent = estado.nombre;
  if (J.nivel) { const nv = q(".m-nv"); nv.textContent = `Nv ${J.nivel.nivel}`; nv.classList.remove("oculto"); nv.title = J.nivel.nombre || ""; }
  if (snd.mudo) q(".b-sonido").textContent = "🔇";
  const mostrarControles = tactil || raiz.getBoundingClientRect().width < 700; q(".m-joy").classList.toggle("oculto", !mostrarControles); q(".m-accion").classList.toggle("oculto", !mostrarControles);
  ajustarLienzo(); actualizarHud(); mostrarLugar(exterior); snd.musica("exterior"); cv.focus();
  toast(op.modoPrueba ? "🧪 Modo prueba: las misiones NO se guardan" : (tactil ? "Mueve el círculo para caminar · busca los ❗ y las 🚪" : "Flechas o WASD para caminar · E para hablar o entrar · M silencia"), 4200);
  ultimo = performance.now(); rafId = requestAnimationFrame(cuadro);

  const api = {
    estado, escenas, exterior, interiores, misiones, hechas, snd, chocaEn, interactuar, cambiarEscena,
    destruir() {
      if (!vivo) return; // por si se llama dos veces
      vivo = false; estado.activo = false; cancelAnimationFrame(rafId); temporizadores.forEach(clearTimeout); temporizadores.clear();
      window.removeEventListener("keydown", alTeclaAbajo); window.removeEventListener("keyup", alTeclaArriba); window.removeEventListener("blur", alPerderFoco); window.removeEventListener("resize", alRedimensionar);
      try { snd.destruir(); } catch (e) { /* ya cerrado */ } raiz.innerHTML = "";
    },
  };
  raiz.__mundo = api;
  return api;
}
