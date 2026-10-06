// =====================================================================================
//  MUNDO CÓDICE — motor del juego
//  Un mundo en 2D visto desde arriba: el estudiante camina con su personaje, entra a los
//  edificios, habla con otros personajes y completa misiones. Se dibuja en un <canvas>
//  y no usa librerías externas.
//
//  Uso:  const mundo = await iniciarMundo(contenedor, opciones);   …   mundo.destruir();
// =====================================================================================

import { ZONAS, estadoZonas, misionesDisponibles, zonaDeMision } from "./zonas";

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
.mundo .m-mapa { position: absolute; inset: 0; background: rgba(8,14,32,.8); display: flex; align-items: center; justify-content: center; padding: 14px; overflow-y: auto; }
.mundo .m-zona { border: 2px solid var(--borde); border-radius: 14px; padding: 10px 12px; margin-bottom: 8px; background: var(--fondo); }
.mundo .m-zona.aqui { border-color: var(--acento); }
.mundo .m-zona .m-z-nombre { font-weight: 800; font-size: 14px; }
.mundo .m-zona .m-z-estado { font-size: 12px; margin-top: 2px; }
.mundo .m-viaje { margin-top: 8px; border: 0; border-radius: 99px; padding: 7px 14px; font-weight: 800; font-size: 12px; background: var(--acento); color: #fff; cursor: pointer; font-family: inherit; }
.mundo .m-barra { height: 9px; border-radius: 99px; background: var(--borde); overflow: hidden; margin: 6px 0 2px; }
.mundo .m-barra > i { display: block; height: 100%; background: var(--acento); }
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
  .mundo .m-lugar { left: 8px; transform: none; max-width: calc(100% - 118px); white-space: normal; font-size: 13px; padding: 6px 12px; }
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
      <button class="m-boton b-mapa" aria-label="Mapa del mundo">🗺️ Mapa</button>
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
  <div class="m-mapa oculto"></div>
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
  const ACORDES_BOSQUE = [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]]; // Re menor, Si bemol, Fa, Do: más suave y misteriosa
  const ACORDES_MONTANA = [[52, 55, 59], [48, 52, 55], [45, 48, 52], [47, 51, 54]]; // Mi menor, Do, La menor, Si: amplia y solemne
  const ACORDES_LAGO = [[48, 52, 55], [53, 57, 60], [45, 48, 52], [50, 53, 57]];    // Do, Fa, La menor, Re menor: calma y reflexión
  const TEMAS = { exterior: { dur: 0.36, ac: ACORDES }, bosque: { dur: 0.44, ac: ACORDES_BOSQUE }, montana: { dur: 0.55, ac: ACORDES_MONTANA }, lago: { dur: 0.6, ac: ACORDES_LAGO } };
  const ARP = [0, 1, 2, 1, 2, 1, 2, 1];
  let tema = "exterior", n = 0, prox = 0, reloj = null;
  function pasoMusica(i, t) {
    const T = TEMAS[tema] || { dur: 0.5, ac: ACORDES }, dur = T.dur, ac = T.ac[Math.floor(i / 8) % 4];
    if (i % 8 === 0) for (const m of ac) tono(musica, "triangle", hz(m - 12), t, dur * 8.2, 0.35);
    if (tema === "exterior") tono(musica, "sine", hz(ac[ARP[i % 8]] + 12), t, dur * 1.4, 0.5);
    else if (tema === "bosque") { if (i % 4 === 0) tono(musica, "sine", hz(ac[ARP[i % 8]] + 12), t, dur * 3, 0.4); }
    else if (tema === "montana") { if (i % 6 === 0) tono(musica, "triangle", hz(ac[ARP[i % 8]]), t, dur * 4, 0.3); }          // notas largas y graves
    else if (tema === "lago") { if (i % 8 === 4) tono(musica, "sine", hz(ac[ARP[i % 8]] + 12), t, dur * 5, 0.32); }          // una nota cristalina de vez en cuando
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
      const c = { pasto: [700, 0.1], tierra: [1100, 0.11], piedra: [2200, 0.13], madera: [1400, 0.15], nieve: [520, 0.09] }[piso] || [900, 0.1];
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
  { id: "posada", nombre: "Posada del Descanso", x: 13, y: 16, w: 7, h: 5, pared: "#e8d5b5", techo: "#2f7d6b", icono: "🛏️", interior: { cols: 16, filas: 11, tema: "posada" } },
];

// Los dibujos de árboles y rocas los comparten la aldea y el bosque (se arman una sola vez).
let _graficos = null;
function graficosBase() {
  if (_graficos) return _graficos;
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
  _graficos = { arbolImg, rocaImg };
  return _graficos;
}

// ---------- portones entre zonas (siempre sobre el borde este del mapa) ----------
const _imgsPorton = {};
function imagenesPorton(etiqueta, emoji) {
  const clave = etiqueta + "|" + emoji; if (_imgsPorton[clave]) return _imgsPorton[clave];
  const W = 2 * TILE, H = 4 * TILE;
  const pintar = (abierto) => {
    const [c, g] = lienzo(W + 12, H + 44), ox = 6, oy = 44;
    const tronco = (x, y) => { g.fillStyle = "rgba(0,0,0,.22)"; g.beginPath(); g.ellipse(x + 2, y + 10, 11, 5, 0, 0, 7); g.fill(); g.fillStyle = "#6b4423"; g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill(); g.fillStyle = "#8a5a2f"; g.beginPath(); g.arc(x - 2, y - 2, 6, 0, 7); g.fill(); g.strokeStyle = "#4a2f17"; g.lineWidth = 1; g.beginPath(); g.arc(x - 2, y - 2, 3, 0, 7); g.stroke(); };
    for (let y = oy + 8; y < oy + H; y += 14) { if (abierto && y > oy + 26 && y < oy + H - 28) continue; tronco(ox + 34, y); } // la empalizada
    if (!abierto) { // las hojas del portón, cerradas
      g.fillStyle = "#8a5a2f"; g.fillRect(ox + 8, oy + 34, 52, 60); g.fillStyle = "#a8763e"; g.fillRect(ox + 8, oy + 34, 52, 6);
      g.strokeStyle = "#3d2614"; g.lineWidth = 2; g.strokeRect(ox + 8.5, oy + 34.5, 51, 59); g.beginPath(); g.moveTo(ox + 8, oy + 64); g.lineTo(ox + 60, oy + 64); g.moveTo(ox + 34, oy + 34); g.lineTo(ox + 34, oy + 94); g.stroke();
      g.fillStyle = "#c9a227"; g.fillRect(ox + 28, oy + 58, 12, 12); g.fillStyle = "#3d2614"; g.fillRect(ox + 32, oy + 62, 4, 6);
    } else { // abierto: las hojas quedan recogidas a los lados
      g.fillStyle = "#8a5a2f"; g.fillRect(ox + 10, oy + 28, 48, 6); g.fillRect(ox + 10, oy + 94, 48, 6); g.fillStyle = "#a8763e"; g.fillRect(ox + 10, oy + 28, 48, 2); g.fillRect(ox + 10, oy + 94, 48, 2);
    }
    g.fillStyle = "#5a3a22"; g.fillRect(ox + 2, oy - 36, 64, 26); g.strokeStyle = "#3d2614"; g.lineWidth = 2; g.strokeRect(ox + 2.5, oy - 35.5, 63, 25); // el cartel del camino
    g.fillStyle = "#e8d3a0"; g.fillRect(ox + 5, oy - 33, 58, 20);
    g.font = "13px " + FUENTE_EMOJI; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#000"; g.fillText(emoji, ox + 16, oy - 23);
    g.font = `bold ${etiqueta.length > 6 ? 8 : 9}px system-ui, sans-serif`; g.fillStyle = "#3d2614"; g.fillText(etiqueta, ox + 44, oy - 22);
    return c;
  };
  return (_imgsPorton[clave] = { cerrado: pintar(false), abierto: pintar(true) });
}
// Un portón en el borde este: 4 casillas de alto desde la fila "ty". Cerrado no se puede cruzar; abierto, al pisar la franja se viaja a la zona siguiente.
function crearPortonEste({ ty, zona, nombre, etiqueta, emoji }) {
  const x0 = 54 * TILE, y0 = ty * TILE;
  return {
    id: zona, zona, nombre, abierto: false, x: x0, y: y0, w: 2 * TILE, h: 4 * TILE, base: y0 + 4 * TILE, imgs: imagenesPorton(etiqueta, emoji),
    bloqueo: { x: x0 + 10, y: y0 + 8, w: 46, h: 4 * TILE - 16 },                       // mientras está cerrado, no se puede pasar
    disparador: { x: 55 * TILE + 8, y: y0 + 24, w: 32, h: 80 },                         // abierto: al pisar esta franja se viaja
    guardia: { x: 52 * TILE + 8, y: y0 + 6 },                                            // dónde está el guardia
    retorno: { x: 52 * TILE + 10, y: (ty + 2) * TILE + 8 },                              // dónde aparece quien vuelve de la zona siguiente
  };
}
const dibujarPorton = (ctx, p, camX, camY) => ctx.drawImage(p.abierto ? p.imgs.abierto : p.imgs.cerrado, p.x - 6 - camX, p.y - 44 - camY);

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
  // El camino hacia el Bosque: sale de la plaza hacia el este y termina en un portón de madera.
  camino(PLAZA.cx + 5, PLAZA.cy, 53, PLAZA.cy);
  const enPorton = (x, y) => x >= 52 && y >= 18 && y <= 23; // sin árboles alrededor del portón
  for (let y = 18; y <= 23; y++) for (let x = 52; x < MW; x++) ocupado[y][x] = 1;
  const spawn = { x: 28 * TILE + 16, y: 24 * TILE };
  const fuente = { x: PLAZA.cx * TILE, y: PLAZA.cy * TILE + 14 };
  obstaculos.push({ x: fuente.x - 26, y: fuente.y - 16, w: 52, h: 30 });

  const esLibre = (x, y) => dentro(x, y) && tipo[y][x] === T.PASTO && !ocupado[y][x];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const borde = Math.min(x, y, MW - 1 - x, MH - 1 - y);
    if (tipo[y][x] === T.AGUA || tipo[y][x] === T.ARENA || enPorton(x, y)) continue;
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
  const { arbolImg, rocaImg } = graficosBase();
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

  const porton = crearPortonEste({ ty: 19, zona: "bosque", nombre: "Camino al Bosque de la Curiosidad", etiqueta: "Bosque", emoji: "🌲" });

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
    npcs: [], puertas: edificios.map((e) => ({ tipo: "puerta", id: e.id, edificio: e, nombre: e.nombre, x: e.puerta.x, y: e.puerta.y, radio: 34 })), salidas: [], portones: [porton], zona: "aldea",
    bloqueado: esAgua,
    piso: (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); const t = dentro(tx, ty) ? tipo[ty][tx] : 0; return t === T.PLAZA ? "piedra" : t === T.CAMINO || t === T.ARENA ? "tierra" : "pasto"; },
    // puntos libres para colocar personajes (cerca de la plaza y los caminos)
    puntoLibre(r, chocaFn) { for (let i = 0; i < 400; i++) { const x = (8 + r() * 40) * TILE, y = (6 + r() * 28) * TILE; const t = tipo[Math.floor(y / TILE)][Math.floor(x / TILE)]; if ((t === T.PLAZA || t === T.CAMINO || t === T.PASTO) && !chocaFn(x, y) && Math.hypot(x - spawn.x, y - spawn.y) > 70) return { x, y }; } return { x: spawn.x + 60, y: spawn.y }; },
    objetos(lista, ctx, camX, camY, visible, t) {
      for (const a of arboles) if (visible(a.x, a.y)) lista.push({ y: a.y, d: () => ctx.drawImage(arbolImg[a.v], Math.round(a.x - 22 - camX), Math.round(a.y - 52 - camY)) });
      for (const r of rocas) if (visible(r.x, r.y)) lista.push({ y: r.y, d: () => ctx.drawImage(rocaImg, Math.round(r.x - 13 - camX), Math.round(r.y - 14 - camY)) });
      edificios.forEach((e, i) => { const by = (e.y + e.h) * TILE; if (visible(e.x * TILE + e.w * 16, by, 200)) lista.push({ y: by, d: () => ctx.drawImage(edificioImg[i], e.x * TILE - 6 - camX, e.y * TILE - camY) }); });
      lista.push({ y: fuente.y, d: () => dibujarFuente(ctx, camX, camY, t) });
      lista.push({ y: porton.base, d: () => dibujarPorton(ctx, porton, camX, camY) });
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
//  LAS ZONAS NATURALES (Bosque, Montaña, Lago…): se arman desde una descripción
//  Cada zona describe su terreno y dónde van sus lugares; el resto (árboles, rocas, estrellas,
//  dibujo, minimapa, portones, personajes) lo resuelve esta función igual para todas.
// =====================================================================================
const K = { PASTO: 0, CAMINO: 1, AGUA: 2, PIEDRA: 3, PUENTE: 4, NIEVE: 5, ARENA: 6, ACANTILADO: 7, ROCOSO: 8 };
const K_LIBRES = new Set([K.PASTO, K.ROCOSO, K.NIEVE, K.ARENA]);     // donde pueden crecer árboles o ponerse rocas
const K_CAMINABLES = new Set([K.PASTO, K.CAMINO, K.PIEDRA, K.PUENTE, K.NIEVE, K.ARENA, K.ROCOSO]);
const PALETA_BASE = {                                                  // [variantes del color base], claro, oscuro
  [K.PASTO]: [["#4c9a3f", "#4f9e42", "#478f3a"], "#62b052", "#37762f"], [K.CAMINO]: [["#9c7c4e"], "#b99b6b", "#7e633b"], [K.AGUA]: [["#3f86c9"], "#69a6dc", "#2f6ba8"],
  [K.PIEDRA]: [["#a4a4b2"], "#bcbcc8", "#8a8a98"], [K.PUENTE]: [["#9a6a35"], "#b8824a", "#6e4a24"], [K.NIEVE]: [["#eef3f8", "#e6edf5"], "#ffffff", "#cfd9e6"],
  [K.ARENA]: [["#eadba0"], "#f4e9bd", "#d1bf82"], [K.ACANTILADO]: [["#6f6a72"], "#8a858f", "#4f4a55"], [K.ROCOSO]: [["#8d8070", "#938676"], "#a99c8b", "#6f6457"],
};
const OFFSETS_BASE = [[74, 12], [-74, 22], [8, -60], [-34, 62], [62, 58]]; // dónde se ubican (en píxeles) las 5 posiciones alrededor del centro de un lugar

function crearZonaNatural(def) {
  const { arbolImg, rocaImg } = graficosBase();
  const rand = rng(def.seed);
  const dentro = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
  const tipo = Array.from({ length: MH }, () => new Uint8Array(MW));
  const ocupado = Array.from({ length: MH }, () => new Uint8Array(MW)); // 1 = no poner árboles ni rocas
  const obstaculos = [], arboles = [], rocas = [];
  const circulo = (cx, cy, r, fn) => { for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d <= r) fn(x, y, d); } };
  const reservar = (cx, cy, r) => circulo(cx, cy, r, (x, y) => (ocupado[y][x] = 1));
  const camino = (x1, y1, x2, y2) => {
    const pintar = (x, y) => { for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const a = x + dx, b = y + dy; if (!dentro(a, b)) continue; if (K_LIBRES.has(tipo[b][a])) tipo[b][a] = K.CAMINO; ocupado[b][a] = 1; } };
    const sx = Math.sign(x2 - x1) || 1, sy = Math.sign(y2 - y1) || 1;
    for (let x = x1; x !== x2; x += sx) pintar(x, y1);
    for (let y = y1; y !== y2; y += sy) pintar(x2, y);
  };
  const meta = def.terreno({ K, tipo, ocupado, dentro, rocas, circulo, reservar, camino });

  // entrada (borde oeste) y salida (portón en el borde este)
  const ey = def.entradaTy, sal = def.salida;
  const enEntrada = (x, y) => x <= 5 && y >= ey - 2 && y <= ey + 5;
  const enSalida = (x, y) => !!sal && x >= 52 && y >= sal.ty - 1 && y <= sal.ty + 4;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (enEntrada(x, y) || enSalida(x, y)) ocupado[y][x] = 1;
  const spawn = { x: 4 * TILE, y: (ey + 1) * TILE + 26 };

  // el bosque: árboles y rocas
  const esLibre = (x, y) => dentro(x, y) && K_LIBRES.has(tipo[y][x]) && !ocupado[y][x];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const borde = Math.min(x, y, MW - 1 - x, MH - 1 - y);
    if (!K_LIBRES.has(tipo[y][x]) || enEntrada(x, y) || enSalida(x, y)) continue;
    if ((borde === 0 && rand() < 0.95) || (borde === 1 && rand() < 0.75) || (borde === 2 && esLibre(x, y) && rand() < 0.45)) arboles.push({ x: x * TILE + 16 + (rand() * 8 - 4), y: y * TILE + 30 + (rand() * 4 - 2), v: rand() < 0.5 ? 0 : 1 });
  }
  for (let y = 3; y < MH - 3; y++) for (let x = 3; x < MW - 3; x++) {
    if (!esLibre(x, y)) continue;
    const r = rand();
    if (r < def.densidadArboles) arboles.push({ x: x * TILE + 16 + (rand() * 10 - 5), y: y * TILE + 30 + (rand() * 4 - 2), v: rand() < 0.5 ? 0 : 1 });
    else if (r < def.densidadArboles + def.densidadRocas) rocas.push({ x: x * TILE + 16, y: y * TILE + 26 });
  }
  for (const t of arboles) obstaculos.push({ x: t.x - 5, y: t.y - 8, w: 10, h: 8 });
  for (const r of rocas) obstaculos.push({ x: r.x - 9, y: r.y - 8, w: 18, h: 8 });
  const bloqueaTile = (t) => t === K.AGUA || t === K.ACANTILADO;
  const bloqueado = (px, py) => { const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE); return !dentro(tx, ty) || bloqueaTile(tipo[ty][tx]); };

  // dónde se ubican los personajes con misión de cada lugar
  const slotsPorLugar = {};
  for (const [lugar, sp] of Object.entries(meta.spots)) slotsPorLugar[lugar] = (sp.offsets || OFFSETS_BASE).map(([dx, dy]) => ({ x: sp.cx * TILE + 16 + dx, y: sp.cy * TILE + 16 + dy }));

  // estrellas para recoger
  const estrellas = []; { const r = rng(def.seed + 55); let n = 0; while (estrellas.length < 4 && n++ < 8000) { const x = 4 + Math.floor(r() * (MW - 8)), y = 4 + Math.floor(r() * (MH - 8)), t = tipo[y][x]; if (!K_CAMINABLES.has(t) || t === K.PUENTE) continue; const px = x * TILE + 16, py = y * TILE + 16; if (Math.hypot(px - spawn.x, py - spawn.y) < 9 * TILE) continue; if (obstaculos.some((o) => px > o.x - 14 && px < o.x + o.w + 14 && py > o.y - 14 && py < o.y + o.h + 14)) continue; if (estrellas.some((s) => Math.hypot(s.x - px, s.y - py) < 10 * TILE)) continue; estrellas.push({ x: px, y: py, tomada: false }); } }

  // ---------- dibujos pre-armados ----------
  const paleta = { ...PALETA_BASE, ...(def.paleta || {}) };
  const suelo = (() => {
    const [cv, g] = lienzo(PW, PH), r = rng(def.seed + 31);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const t = tipo[y][x], px = x * TILE, py = y * TILE, [variantes, claro, oscuro] = paleta[t];
      g.fillStyle = variantes[(x * 7 + y * 13) % variantes.length]; g.fillRect(px, py, TILE, TILE);
      for (let i = 0; i < 7; i++) { g.fillStyle = r() < 0.5 ? claro : oscuro; g.fillRect(px + Math.floor(r() * 30), py + Math.floor(r() * 30), 2, 2); }
      if (t === K.PUENTE) { g.fillStyle = oscuro; for (let k = 0; k < 4; k++) g.fillRect(px + k * 8, py, 1, TILE); g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(px, py + TILE - 2, TILE, 2); }
      if (t === K.ACANTILADO) { // la pared de roca: vetas horizontales y el borde de arriba más claro
        g.fillStyle = oscuro; for (let k = 0; k < 3; k++) g.fillRect(px, py + 8 + k * 9 + Math.floor(r() * 3), TILE, 2);
        if (!dentro(x, y - 1) || tipo[y - 1][x] !== K.ACANTILADO) { g.fillStyle = claro; g.fillRect(px, py, TILE, 4); }
        if (!dentro(x, y + 1) || tipo[y + 1][x] !== K.ACANTILADO) { g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(px, py + TILE - 5, TILE, 5); }
      }
      if (t === K.PASTO && def.flores) {
        const enZona = (def.flores.zonas || []).some((z) => Math.hypot(x + 0.5 - z.cx, y + 0.5 - z.cy) <= z.r);
        if (enZona ? r() < def.flores.probZona : !ocupado[y][x] && r() < def.flores.prob) {
          const col = ["#ffffff", "#ffd54f", "#f48fb1", "#ce93d8", "#90caf9"][Math.floor(r() * 5)];
          for (let k = 0; k < 2 + Math.floor(r() * 3); k++) { const fx = px + 4 + Math.floor(r() * 22), fy = py + 4 + Math.floor(r() * 22); g.fillStyle = col; g.fillRect(fx, fy, 3, 3); g.fillStyle = "#ffeb3b"; g.fillRect(fx + 1, fy + 1, 1, 1); }
        }
      }
    }
    if (meta.decor) meta.decor(g, r, tipo);
    return cv;
  })();
  const aguaTiles = []; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (tipo[y][x] === K.AGUA) aguaTiles.push([x, y]);
  const [miniBase, mg] = lienzo(MW * 3, MH * 3);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { mg.fillStyle = paleta[tipo[y][x]][0][0]; mg.fillRect(x * 3, y * 3, 3, 3); }
  for (const t of arboles) { mg.fillStyle = "#235f27"; mg.fillRect(Math.floor(t.x / TILE) * 3, Math.floor(t.y / TILE) * 3, 3, 3); }

  const portones = sal ? [crearPortonEste({ ty: sal.ty, zona: sal.zona, nombre: sal.nombre, etiqueta: sal.etiqueta, emoji: sal.emoji })] : [];
  const pisoDe = { [K.PUENTE]: "madera", [K.PIEDRA]: "piedra", [K.CAMINO]: "tierra", [K.ARENA]: "tierra", [K.ROCOSO]: "tierra", [K.NIEVE]: "nieve" };
  return {
    id: def.id, zona: def.id, nombre: def.nombre, icono: def.icono, exterior: true,
    ancho: PW, alto: PH, suelo, fondo: def.fondo, obstaculos, spawn, edificios: [], portones, estrellas, mini: { base: miniBase, k: (MW * 3) / PW },
    npcs: [], puertas: [], salidas: [{ x: 0, y: ey * TILE, w: 40, h: 4 * TILE, volver: true }], slotsPorLugar,
    bloqueado,
    piso: (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); return dentro(tx, ty) ? pisoDe[tipo[ty][tx]] || "pasto" : "pasto"; },
    puntoLibre(r, chocaFn) { for (let i = 0; i < 600; i++) { const x = (5 + r() * 44) * TILE, y = (5 + r() * 30) * TILE; if (K_CAMINABLES.has(tipo[Math.floor(y / TILE)][Math.floor(x / TILE)]) && !chocaFn(x, y) && Math.hypot(x - spawn.x, y - spawn.y) > 80) return { x, y }; } return { x: spawn.x + 100, y: spawn.y }; },
    objetos(lista, ctx, camX, camY, visible) {
      for (const a of arboles) if (visible(a.x, a.y)) lista.push({ y: a.y, d: () => ctx.drawImage(arbolImg[a.v], Math.round(a.x - 22 - camX), Math.round(a.y - 52 - camY)) });
      for (const r of rocas) if (visible(r.x, r.y)) lista.push({ y: r.y, d: () => ctx.drawImage(rocaImg, Math.round(r.x - 13 - camX), Math.round(r.y - 14 - camY)) });
      for (const p of portones) lista.push({ y: p.base, d: () => dibujarPorton(ctx, p, camX, camY) });
    },
    efectos(ctx, t, camX, camY, LW, LH) {
      ctx.fillStyle = "rgba(255,255,255,.35)";
      for (const [x, y] of aguaTiles) { const px = x * TILE - camX, py = y * TILE - camY; if (px < -TILE || py < -TILE || px > LW || py > LH) continue; const o = Math.sin(t * 1.6 + x * 0.9 + y * 0.6); ctx.fillRect(px + 6 + o * 3, py + 9, 10, 1); ctx.fillRect(px + 15 - o * 3, py + 22, 9, 1); }
    },
  };
}

// ---- EL BOSQUE DE LA CURIOSIDAD: un arroyo con puente, un claro, un rincón junto al agua y un mirador ----
const DEF_BOSQUE = {
  id: "bosque", nombre: "Bosque de la Curiosidad", icono: "🌲", seed: 777, fondo: "#17391c", entradaTy: 19,
  salida: { ty: 19, zona: "montana", nombre: "Camino a la Montaña del Esfuerzo", etiqueta: "Montaña", emoji: "🏔️" },
  densidadArboles: 0.17, densidadRocas: 0.015,
  paleta: { [K.PASTO]: [["#3f8a3c", "#438f40", "#3a8137"], "#58a64f", "#2f6e2e"] },
  flores: { prob: 0.05, probZona: 0.28, zonas: [{ cx: 26, cy: 20, r: 5 }] },
  terreno({ K, tipo, ocupado, dentro, rocas, circulo, reservar, camino }) {
    const cxArroyo = (y) => 40 + Math.round(3 * Math.sin(y / 5));
    for (let y = 0; y < MH; y++) { for (let dx = -1; dx <= 1; dx++) if (dentro(cxArroyo(y) + dx, y)) tipo[y][cxArroyo(y) + dx] = K.AGUA; for (let k = -3; k <= 3; k++) if (dentro(cxArroyo(y) + k, y)) ocupado[y][cxArroyo(y) + k] = 1; }
    for (const y of [20, 21]) for (let x = cxArroyo(y) - 2; x <= cxArroyo(y) + 2; x++) if (dentro(x, y)) tipo[y][x] = K.PUENTE;
    const MIRADOR = { cx: 12, cy: 9, r: 3.6 };
    reservar(26, 20, 8); reservar(46, 25, 5.2); reservar(MIRADOR.cx, MIRADOR.cy, MIRADOR.r + 3);
    circulo(MIRADOR.cx, MIRADOR.cy, MIRADOR.r, (x, y) => { if (tipo[y][x] === K.PASTO) tipo[y][x] = K.PIEDRA; });
    camino(1, 20, 21, 20); camino(31, 20, 53, 20); camino(46, 20, 46, 25); camino(21, 19, 12, 13);
    for (let a = 0; a < 6.283; a += 0.62) { if (Math.abs(a - Math.PI / 2) < 0.7) continue; rocas.push({ x: (MIRADOR.cx + Math.cos(a) * (MIRADOR.r + 1.1)) * TILE, y: (MIRADOR.cy + Math.sin(a) * (MIRADOR.r + 1.1)) * TILE }); } // un anillo de rocas alrededor del mirador, menos por donde sube el sendero
    return { spots: {
      claro: { cx: 26, cy: 20, offsets: [[74, 12], [-74, 22], [8, -70], [-36, 84], [64, 76]] },
      arroyo: { cx: 46, cy: 25, offsets: [[54, -30], [-40, 14], [14, 58], [-20, -56], [62, 34]] },
      mirador: { cx: MIRADOR.cx, cy: MIRADOR.cy, offsets: [[52, 22], [-52, 22], [2, -36], [34, 62], [-34, 62]] },
    } };
  },
};

// ---- LA MONTAÑA DEL ESFUERZO: un sendero en zigzag que sube entre acantilados hasta una cumbre nevada ----
const DEF_MONTANA = {
  id: "montana", nombre: "Montaña del Esfuerzo", icono: "🏔️", seed: 888, fondo: "#2a2f3a", entradaTy: 31,
  salida: { ty: 7, zona: "lago", nombre: "Camino al Lago de la Reflexión", etiqueta: "Lago", emoji: "🏞️" },
  densidadArboles: 0.03, densidadRocas: 0.05,
  paleta: { [K.PASTO]: [["#5a8f45", "#5e944a", "#547f3f"], "#6fa65a", "#3f6b33"] },
  terreno({ K, tipo, reservar, camino }) {
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      let t = K.ROCOSO;
      if (y <= 11) t = K.NIEVE; else if (y <= 13 && (x * 7 + y * 3) % 3 === 0) t = K.NIEVE;
      if (y >= 28 && x <= 21) t = K.PASTO;
      tipo[y][x] = t;
    }
    for (let x = 0; x < MW; x++) { // dos paredes de acantilado con un paso en cada una (en zigzag)
      for (const y of [14, 15]) if (!(x >= 8 && x <= 11)) tipo[y][x] = K.ACANTILADO;
      for (const y of [26, 27]) if (!(x >= 46 && x <= 49)) tipo[y][x] = K.ACANTILADO;
    }
    reservar(24, 35, 4.5); reservar(23, 18, 4.5); reservar(30, 6, 4.5);
    camino(1, 32, 47, 32); camino(47, 32, 47, 22); camino(47, 22, 9, 22); camino(9, 22, 9, 9); camino(9, 9, 53, 9);
    return { spots: {
      sendero: { cx: 24, cy: 35, offsets: [[74, 10], [-74, 18], [8, -34], [-30, 52], [60, 50]] },
      cueva: { cx: 23, cy: 18, offsets: [[64, 8], [-64, 14], [0, -14], [34, 46], [-34, 50]] },
      cumbre: { cx: 30, cy: 6, offsets: [[70, 6], [-70, 14], [0, -50], [-28, 46], [34, 46]] },
    },
    decor(g) { // la boca de la cueva en la pared y la bandera de la cumbre
      const cx = 23 * TILE, cy = 14 * TILE; g.fillStyle = "#15121a"; g.beginPath(); g.moveTo(cx - 38, cy + 2 * TILE - 2); g.quadraticCurveTo(cx - 38, cy + 4, cx, cy + 4); g.quadraticCurveTo(cx + 38, cy + 4, cx + 38, cy + 2 * TILE - 2); g.closePath(); g.fill();
      g.fillStyle = "#2a2430"; g.beginPath(); g.ellipse(cx, cy + 2 * TILE - 2, 30, 8, 0, 0, 7); g.fill(); g.strokeStyle = "#8a858f"; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 38, cy + 2 * TILE - 2); g.quadraticCurveTo(cx - 38, cy + 4, cx, cy + 4); g.quadraticCurveTo(cx + 38, cy + 4, cx + 38, cy + 2 * TILE - 2); g.stroke();
      g.font = "26px " + FUENTE_EMOJI; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#000"; g.fillText("🚩", 30 * TILE + 16, 4 * TILE + 8);
    } };
  },
};

// ---- EL LAGO DE LA REFLEXIÓN: un gran lago con un muelle de madera que lleva a una isla ----
const DEF_LAGO = {
  id: "lago", nombre: "Lago de la Reflexión", icono: "🏞️", seed: 999, fondo: "#1b4a3a", entradaTy: 19, salida: null,
  densidadArboles: 0.06, densidadRocas: 0.012,
  paleta: { [K.PASTO]: [["#58a64a", "#5cab4e", "#519c44"], "#70bd60", "#3f8636"], [K.AGUA]: [["#3b8fd1"], "#74b6e8", "#2a74b3"] },
  flores: { prob: 0.06, probZona: 0.2, zonas: [{ cx: 8, cy: 26, r: 4 }] },
  terreno({ K, tipo, dentro, reservar, circulo, camino }) {
    const LAGO = { cx: 31, cy: 21, rx: 19, ry: 12 }, ISLA = { cx: 39, cy: 20, r: 4.3 };
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const d = ((x + 0.5 - LAGO.cx) / LAGO.rx) ** 2 + ((y + 0.5 - LAGO.cy) / LAGO.ry) ** 2; if (d < 1) tipo[y][x] = K.AGUA; else if (d < 1.22 && tipo[y][x] === K.PASTO) tipo[y][x] = K.ARENA; }
    circulo(ISLA.cx, ISLA.cy, ISLA.r + 1, (x, y, d) => { tipo[y][x] = d <= ISLA.r ? K.PASTO : K.ARENA; });                // la isla, con su playa
    for (let x = 10; x <= 34; x++) { tipo[20][x] = K.PUENTE; tipo[21][x] = K.PUENTE; }                                       // el muelle hasta la isla
    for (let x = 20; x <= 25; x++) for (let y = 19; y <= 22; y++) tipo[y][x] = K.PUENTE;                                     // la plataforma del muelle
    reservar(8, 26, 4.5); reservar(ISLA.cx, ISLA.cy, ISLA.r + 2);
    camino(1, 20, 9, 20); camino(6, 20, 6, 26);
    return { spots: {
      orilla: { cx: 8, cy: 26 },
      muelle: { cx: 23, cy: 21, offsets: [[-64, -54], [16, -54], [-64, 36], [16, 36], [-24, -54]] },
      isla: { cx: 39, cy: 20 },
    },
    decor(g, r, tipoG) { // nenúfares sobre el agua
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (tipoG[y][x] === K.AGUA && r() < 0.025) { const px = x * TILE + 6 + r() * 20, py = y * TILE + 6 + r() * 20; g.fillStyle = "#3f9b4a"; g.beginPath(); g.ellipse(px, py, 7, 4, 0, 0, 7); g.fill(); if (r() < 0.4) { g.fillStyle = "#f8bbd0"; g.fillRect(px - 1, py - 1, 3, 3); } }
    } };
  },
};

// =====================================================================================
//  EL MUNDO POR DENTRO: los interiores de los edificios
// =====================================================================================
const TEMAS = {
  biblioteca: { piso: ["#b98a55", "#b0814d"], linea: "#8f6838", pared: "#7a4f2d", zocalo: "#5a3a1e", sonido: "madera", fondo: "#150f0a" },
  agora: { piso: ["#ebe7dc", "#ddd8c8"], linea: "#c4bda8", pared: "#cfc8b4", zocalo: "#a99f86", sonido: "piedra", fondo: "#14161c" },
  templo: { piso: ["#cfc8dc", "#c4bdd2"], linea: "#a79fba", pared: "#9b8fb5", zocalo: "#6f6390", sonido: "piedra", fondo: "#120f1a" },
  mercado: { piso: ["#a77b4a", "#9d7243"], linea: "#7e5a33", pared: "#c98f4a", zocalo: "#8a5a2b", sonido: "madera", fondo: "#150f0a" },
  posada: { piso: ["#c49a6c", "#bb9163"], linea: "#8f6d44", pared: "#e3cfa6", zocalo: "#8a5a2b", sonido: "madera", fondo: "#150f0a" },
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
  if (tipo === "cama") {
    const [c, g] = lienzo(46, 60); g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(3, 56, 40, 4);
    rr(g, 2, 4, 42, 52, "#6e4a24"); rr(g, 2, 4, 42, 5, "#8a5a2b"); rr(g, 5, 9, 36, 44, "#efe7d6"); rr(g, 8, 12, 30, 10, "#ffffff"); rr(g, 8, 20, 30, 2, "#d9d0bd");
    const manta = pick(); rr(g, 5, 26, 36, 27, manta); rr(g, 5, 26, 36, 4, "rgba(255,255,255,.25)"); rr(g, 5, 49, 36, 4, "rgba(0,0,0,.18)");
    return { img: c, w: 46, h: 60, pared: true };
  }
  if (tipo === "chimenea") {
    const [c, g] = lienzo(80, 76); rr(g, 0, 70, 80, 6, "rgba(0,0,0,.2)"); rr(g, 2, 8, 76, 64, "#8a8a98"); rr(g, 2, 8, 76, 6, "#b4b4c2"); rr(g, 2, 8, 6, 64, "#a0a0ae");
    for (let y = 18; y < 70; y += 11) rr(g, 2, y, 76, 1, "rgba(0,0,0,.15)"); rr(g, 18, 26, 44, 46, "#1a1214"); rr(g, 14, 22, 52, 6, "#6f6f7d");
    rr(g, 24, 62, 32, 7, "#4a2f17"); rr(g, 28, 58, 24, 6, "#6b4423"); g.fillStyle = "#ff9d2e"; g.beginPath(); g.ellipse(40, 54, 11, 12, 0, 0, 7); g.fill(); g.fillStyle = "#ffd94a"; g.beginPath(); g.ellipse(40, 56, 6, 8, 0, 0, 7); g.fill();
    g.fillStyle = "#d9822b"; g.beginPath(); g.ellipse(31, 59, 5, 6, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(50, 59, 5, 6, 0, 0, 7); g.fill();
    return { img: c, w: 80, h: 76, pared: true };
  }
  if (tipo === "mostrador") {
    const [c, g] = lienzo(124, 50); g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(4, 46, 116, 4);
    rr(g, 2, 14, 120, 32, "#8a5a2b"); for (let x = 8; x < 118; x += 22) rr(g, x, 18, 1, 26, "rgba(0,0,0,.2)"); rr(g, 0, 8, 124, 10, "#c98d4d"); rr(g, 0, 8, 124, 3, "#e0a866"); rr(g, 2, 38, 120, 5, "#6e4a24");
    g.fillStyle = "#e8d3a0"; g.fillRect(14, 2, 8, 8); g.fillRect(16, 0, 4, 3); g.fillStyle = "#c9a227"; g.fillRect(52, 3, 9, 6); g.fillRect(55, 0, 3, 4); g.fillStyle = "#b23a48"; g.fillRect(92, 3, 9, 7); g.fillRect(100, 5, 3, 3);
    return { img: c, w: 124, h: 50, ob: 22, anchoOb: 130 };
  }
  if (tipo === "taburete") { const [c, g] = lienzo(24, 28); g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.ellipse(12, 25, 9, 3, 0, 0, 7); g.fill(); rr(g, 5, 14, 3, 11, "#5a3a1e"); rr(g, 16, 14, 3, 11, "#5a3a1e"); g.fillStyle = "#a8763e"; g.beginPath(); g.ellipse(12, 12, 10, 6, 0, 0, 7); g.fill(); g.fillStyle = "#c98d4d"; g.beginPath(); g.ellipse(12, 10, 10, 5, 0, 0, 7); g.fill(); return { img: c, w: 24, h: 28, ob: 8 }; }
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
  } else if (tema === "posada") {
    base.muebles = [["cama", 70, 134], ["cama", 130, 134], ["chimenea", cx, 124], ["cama", W - 130, 134], ["cama", W - 70, 134], ["mesa", 150, 262], ["taburete", 118, 284], ["taburete", 184, 284], ["mostrador", W - 106, 262], ["barril", 50, 232], ["planta", 52, 324], ["planta", W - 50, 324]];
    base.slots = [{ x: 222, y: 214 }, { x: 300, y: 214 }, { x: 250, y: 300 }, { x: 330, y: 304 }, { x: 112, y: 210 }];
    base.posadero = { x: W - 106, y: 236 };
    base.llamas = [{ x: cx, y: 120 }];
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
    if (def.tema === "biblioteca" || def.tema === "mercado" || def.tema === "posada") { g.beginPath(); g.moveTo(px, py + 0.5); g.lineTo(px + TILE, py + 0.5); g.moveTo(px + (y % 2 ? 11 : 21), py); g.lineTo(px + (y % 2 ? 11 : 21), py + TILE); g.stroke(); }
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
  if (def.tema === "posada") { g.fillStyle = "#8c2f48"; g.beginPath(); g.ellipse(W / 2 - 70, 268, 96, 40, 0, 0, 7); g.fill(); g.strokeStyle = "#e8c36a"; g.lineWidth = 3; g.beginPath(); g.ellipse(W / 2 - 70, 268, 88, 34, 0, 0, 7); g.stroke(); }

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
    npcs: [], puertas: [], salidas, slots: dis.slots, velas: dis.velas, posadero: dis.posadero || null, bloqueado: () => false, piso: () => tm.sonido,
    puntoLibre(rand, chocaFn) { for (let i = 0; i < 300; i++) { const x = TILE * 2 + rand() * (W - TILE * 4), y = TILE * 4 + rand() * (H - TILE * 6); if (!chocaFn(x, y)) return { x, y }; } return { x: W / 2, y: H - 80 }; },
    objetos(lista, ctx, camX, camY, visible, t) {
      for (const m of muebles) lista.push({ y: m.y, d: () => ctx.drawImage(m.img, Math.round(m.x - m.w / 2 - camX), Math.round(m.y - m.h - camY)) });
      for (const l of dis.llamas || []) lista.push({ y: l.y + 2, d: () => { // las llamas de la chimenea parpadean
        const x = Math.round(l.x - camX), y = Math.round(l.y - camY), f = Math.sin(t * 11 + 1.3) * 2, f2 = Math.sin(t * 7) * 1.5;
        ctx.fillStyle = "rgba(255,170,60,.16)"; ctx.beginPath(); ctx.arc(x, y - 8, 46 + f, 0, 7); ctx.fill();
        ctx.fillStyle = "#ff8a1f"; ctx.beginPath(); ctx.ellipse(x - 5, y - 4 + f2 * 0.3, 5, 8 + f * 0.6, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(x + 6, y - 3 - f2 * 0.3, 4, 6 + f2, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#ffd94a"; ctx.beginPath(); ctx.ellipse(x, y - 2, 4, 6 + f * 0.5, 0, 0, 7); ctx.fill();
      } });
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
const SPRITE_POR_LUGAR = { biblioteca: "cronista_femenino", agora: "defensor_masculino", templo: "peregrino_femenino", mercado: "consejero_masculino", plaza: "maestro_gremio_masculino", guardia: "defensor_masculino" };
// ---------- caminata por código ----------
// A partir de la pose quieta de cada dirección se arman 4 cuadros de caminata: se levanta una pierna
// (la mitad izquierda o derecha de la parte de abajo), contacto con el cuerpo 1 px más abajo, se levanta
// la otra pierna y otra vez contacto. Así los personajes caminan sin tener que dibujar nada más.
function fabricarPasos(im) {
  const W = im.naturalWidth || im.width, H = im.naturalHeight || im.height;
  if (!W || !H) return null;
  const [, g0] = lienzo(W, H); g0.drawImage(im, 0, 0);
  const d = g0.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  x1++; y1++; // los bordes de la caja son exclusivos
  const cx = (x0 + x1) >> 1, alto = Math.max(6, Math.round(0.3 * (y1 - y0))), tope = y1 - alto;
  const hacer = (lado, lev, rebote) => {
    const [c, g] = lienzo(W, H), out = g.createImageData(W, H), o = out.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4; if (d[i + 3] === 0) continue;
      let ny = y;
      if (y < tope) ny = y + rebote;                                                           // el cuerpo baja un poco en el contacto (los pies quedan quietos)
      else if ((lado === 1 && x < cx) || (lado === 2 && x >= cx)) ny = y - lev;                // la pierna que da el paso se levanta
      if (ny < 0 || ny >= H) continue;
      const j = (ny * W + x) * 4;
      if (ny !== y || o[j + 3] === 0) { o[j] = d[i]; o[j + 1] = d[i + 1]; o[j + 2] = d[i + 2]; o[j + 3] = d[i + 3]; }
    }
    g.putImageData(out, 0, 0); return c;
  };
  return [hacer(1, 2, 0), hacer(0, 0, 1), hacer(2, 2, 0), hacer(0, 0, 1)];
}
const LARGO_PASO = 10.5; // píxeles que hay que avanzar para pasar al siguiente cuadro de la caminata

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

  // ---- cuadros de caminata de todos los personajes y direcciones ----
  const pasos = {};
  claves.forEach((k) => { pasos[k] = {}; DIRS8.forEach((dd) => { pasos[k][dd] = fabricarPasos(imgs[k][dd]); }); });

  // ---- escenas ----
  const exterior = crearExterior();
  const interiores = {}; for (const e of exterior.edificios) interiores[e.id] = crearInterior(e.interior, e);
  const naturales = [crearZonaNatural(DEF_BOSQUE), crearZonaNatural(DEF_MONTANA), crearZonaNatural(DEF_LAGO)];
  const escenaDeZona = { aldea: exterior }; naturales.forEach((n) => (escenaDeZona[n.zona] = n));
  const conPortones = [exterior, ...naturales];                    // las escenas que tienen un portón hacia la zona siguiente
  const escenas = { exterior }; naturales.forEach((n) => (escenas[n.id] = n)); Object.values(interiores).forEach((s) => (escenas[s.id] = s));
  const rand = rng(4242);

  // ---- colisiones (sirven para el jugador y para los aldeanos) ----
  function chocaEn(esc, x, y) {
    const bx = x - 6, by = y - 8, bw = 12, bh = 8;
    if (esc.bloqueado(bx, by) || esc.bloqueado(bx + bw, by) || esc.bloqueado(bx, by + bh) || esc.bloqueado(bx + bw, by + bh)) return true;
    for (const o of esc.obstaculos) if (bx < o.x + o.w && bx + bw > o.x && by < o.y + o.h && by + bh > o.y) return true;
    for (const p of esc.portones || []) if (!p.abierto && bx < p.bloqueo.x + p.bloqueo.w && bx + bw > p.bloqueo.x && by < p.bloqueo.y + p.bloqueo.h && by + bh > p.bloqueo.y) return true; // portón cerrado
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
    let lugar, esc, slots;
    const zm = zonaDeMision(m);
    if (zm !== "aldea" && escenaDeZona[zm]) { esc = escenaDeZona[zm]; lugar = esc.slotsPorLugar[m.lugar] ? m.lugar : Object.keys(esc.slotsPorLugar)[0]; slots = esc.slotsPorLugar[lugar]; }
    else { lugar = interiores[m.lugar] ? m.lugar : "plaza"; esc = lugar === "plaza" ? exterior : interiores[lugar]; slots = lugar === "plaza" ? SLOTS_PLAZA : esc.slots; }
    const n = (cuenta[lugar] = (cuenta[lugar] ?? -1) + 1), s = slots[n % slots.length];
    esc.npcs.push({ tipo: "mision", mision: m, lugar, zona: zonaDeMision(m), nombre: m.npc_nombre || "Aldeano", emoji: m.npc_emoji || "💬", clave: spriteParaMision(m, i), x: s.x, y: s.y, dir: "south", solido: true });
  });

  // la posadera de la Posada del Descanso
  if (interiores.posada && interiores.posada.posadero) {
    const spritePosadera = sprites.heraldo_femenino && claveJugador !== "heraldo_femenino" ? "heraldo_femenino" : otras[1 % otras.length], pn = interiores.posada.posadero;
    interiores.posada.npcs.push({ tipo: "posadero", nombre: "La posadera", clave: spritePosadera, x: pn.x, y: pn.y, dir: "south", solido: true });
  }

  // ---- zonas: la docente abre la zona para el curso, y el estudiante cumple el requisito ----
  const zonasAbiertas = new Set(op.zonasAbiertas || []);
  let zonas = estadoZonas({ misiones, hechas, abiertas: zonasAbiertas, requisitos: op.zonasRequisitos || {} });
  const disponibles = () => misionesDisponibles(misiones, zonas);
  // el guardia del portón: explica qué falta para pasar
  const spriteGuardia = sprites[SPRITE_POR_LUGAR.guardia] && SPRITE_POR_LUGAR.guardia !== claveJugador ? SPRITE_POR_LUGAR.guardia : otras[0];
  conPortones.forEach((esc) => esc.portones.forEach((p) => {
    p.abierto = !!(zonas[p.zona] && zonas[p.zona].desbloqueada);
    esc.npcs.push({ tipo: "guardia", porton: p, nombre: "El guardia del portón", clave: spriteGuardia, x: p.guardia.x, y: p.guardia.y, dir: "east", solido: true });
  }));

  // ---- aldeanos: muchos personajes caminando por ahí ----
  let contadorAldeanos = 0;
  function poblar(esc, cantidad) {
    for (let i = 0; i < cantidad; i++) {
      const p = esc.puntoLibre(rand, (x, y) => chocaEn(esc, x, y)), k = contadorAldeanos++;
      esc.npcs.push({ tipo: "aldeano", nombre: NOMBRES_ALDEANOS[k % NOMBRES_ALDEANOS.length], clave: otras[k % otras.length], frase: FRASES[(k * 5 + 1) % FRASES.length], x: p.x, y: p.y, dir: "south", meta: null, pausa: rand() * 2, caminando: false });
    }
  }
  poblar(exterior, op.aldeanos ?? 9); Object.values(interiores).forEach((s) => poblar(s, op.aldeanosDentro ?? 2)); naturales.forEach((n) => poblar(n, op.aldeanosZonas ?? op.aldeanosBosque ?? 5));

  // ---- sonido ----
  const snd = op.sonido === false ? crearSonido.apagado || { reanudar() {}, alternar() { return true; }, musica() {}, paso() {}, estrella() {}, bien() {}, mal() {}, hablar() {}, puerta() {}, destruir() {}, mudo: true } : crearSonido();

  // ---- estado ----
  const estado = {
    activo: true, escena: exterior, clave: claveJugador, nombre: J.nombre || "Estudiante", x: exterior.spawn.x, y: exterior.spawn.y, dir: "south", caminando: false,
    xp: J.xp || 0, oro: J.oro || 0, vida: typeof J.vida === "number" ? J.vida : null, descansando: false, ganado: { xp: 0, oro: 0 }, est: 0, cercano: null, dialogo: null, avisos: [], fase: 0, terminado: false, cambiando: false, pasoT: 0.3,
    comp: { x: exterior.spawn.x, y: exterior.spawn.y }, hechas, fasePaso: 0, movio: false, mapaAbierto: false,
  };
  const teclas = new Set(), joy = { x: 0, y: 0 };

  // ---- HUD ----
  const pendientesEn = (lugar) => misiones.filter((m) => (interiores[m.lugar] ? m.lugar : "plaza") === lugar && !hechas.has(m.id)).length;
  function toast(texto, ms = 2800) { const t = q(".m-toast"); t.textContent = texto; t.classList.remove("oculto"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add("oculto"), ms); temporizadores.add(toast.h); }
  function mostrarLugar(esc) { const l = q(".m-lugar"); l.textContent = `${esc.icono} ${esc.nombre}`; l.classList.add("ver"); clearTimeout(mostrarLugar.h); mostrarLugar.h = setTimeout(() => l.classList.remove("ver"), 2400); temporizadores.add(mostrarLugar.h); }
  function posicionarMini() { const h = q(".m-hud").getBoundingClientRect(); mini.style.top = Math.round(h.bottom - raiz.getBoundingClientRect().top + 6) + "px"; q(".m-lugar").style.top = Math.round(h.bottom - raiz.getBoundingClientRect().top + (estado.escena.exterior ? 6 : 6)) + "px"; }
  const totalEstrellas = () => exterior.estrellas.length + naturales.filter((n) => zonas[n.zona] && zonas[n.zona].desbloqueada).reduce((a, n) => a + n.estrellas.length, 0);
  function actualizarHud() {
    q(".h-xp").textContent = estado.xp; q(".h-oro").textContent = estado.oro; const disp = disponibles(); q(".h-mis").textContent = `${disp.filter((m) => hechas.has(m.id)).length}/${disp.length}`; q(".h-est").textContent = `${estado.est}/${totalEstrellas()}`;
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
      mini.classList.toggle("oculto", !esc.exterior); mostrarLugar(esc); snd.musica(naturales.includes(esc) ? esc.id : esc.exterior ? "exterior" : "interior"); posicionarMini();
      f.classList.remove("ver"); espera(() => { estado.cambiando = false; }, 200);
    }, 200);
  }
  const entrarEdificio = (e) => { snd.puerta(); cambiarEscena(interiores[e.id], interiores[e.id].spawn.x, interiores[e.id].spawn.y); };
  const irAZona = (esc) => { snd.puerta(); cambiarEscena(esc, esc.spawn.x, esc.spawn.y); };
  // cada zona se conecta con la anterior: el portón de la anterior lleva a esta, y la salida oeste de esta vuelve al portón
  naturales.forEach((nat) => {
    const previa = escenaDeZona[ZONAS.find((z) => z.key === nat.zona).previa], p = previa.portones.find((g) => g.zona === nat.zona);
    previa.salidas.push({ x: p.disparador.x, y: p.disparador.y, w: p.disparador.w, h: p.disparador.h, activa: () => p.abierto, accion: () => irAZona(nat) });
    nat.salidas.find((s) => s.volver).accion = () => { snd.puerta(); cambiarEscena(previa, p.retorno.x, p.retorno.y); };
  });
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
    if (disponibles().length && disponibles().every((m) => hechas.has(m.id)) && !estado.terminado) {
      estado.terminado = true; q(".m-fin-texto").textContent = (Object.values(zonas).some((z) => !z.desbloqueada) ? "Completaste todas las misiones disponibles por ahora; irán apareciendo más cuando se abran nuevas zonas. " : "") + `En esta visita ganaste ${estado.ganado.xp} XP y ${estado.ganado.oro} monedas.` + (op.modoPrueba ? " (Modo prueba: no se guardó nada.)" : " Todo ya quedó sumado a tu progreso de CÓDICE."); q(".m-fin").classList.remove("oculto"); snd.bien();
    }
  }
  function abrirCharla(n) {
    estado.dialogo = n; n.hablando = true; snd.hablar();
    const d = abrirTarjeta(`${cabecera(n, "Vecino de la aldea")}<p class="m-texto">${html(n.frase)}</p><button class="m-ok" data-a="cerrar">¡Gracias!</button>`);
    d.querySelectorAll('[data-a="cerrar"]').forEach((b) => (b.onclick = cerrarDialogo));
  }
  // ---- la posada: se recupera vida a cambio de oro (la docente decide si está abierta, cuánto cuesta y cuánta vida da) ----
  const VIDA_MAX = op.vidaMax ?? 100;
  function planDescanso() {
    const cfg = op.posada || {};
    if (!cfg.activa) return { estado: "cerrada" };
    if (estado.vida == null) return { estado: "sin_datos" };
    const falta = Math.max(0, VIDA_MAX - estado.vida);
    if (falta === 0) return { estado: "completa" };
    const porUso = Math.max(1, cfg.vida || 1), restaura = Math.min(porUso, falta), costo = Math.ceil(((cfg.costo || 0) * restaura) / porUso); // si le falta poco, paga proporcional
    return { estado: estado.oro >= costo ? "puede" : "sin_oro", falta, restaura, costo };
  }
  function abrirPosada(n, resultado) {
    estado.dialogo = n; n.hablando = true; if (!resultado) snd.hablar();
    const pl = planDescanso(), vidaTxt = estado.vida != null ? `❤️ ${estado.vida}/${VIDA_MAX} · ` : "";
    let cuerpo, boton = "";
    if (pl.estado === "cerrada") cuerpo = "La posada está cerrada por ahora. ¡Vuelve pronto, viajero!";
    else if (pl.estado === "completa") cuerpo = `¡Te ves en plena forma! (❤️ ${estado.vida}/${VIDA_MAX}). No necesitas descansar.`;
    else if (pl.estado === "sin_oro") cuerpo = `${vidaTxt}🪙 ${estado.oro}<br>Descansar cuesta <b>${pl.costo} 🪙</b> y te devuelve <b>+${pl.restaura} ❤️</b>, pero no te alcanza el oro. ¡Completa misiones para ganar más!`;
    else if (pl.estado === "sin_datos") { cuerpo = `🪙 ${estado.oro}<br>Aquí se recupera la vida a cambio de oro. ¿Quieres descansar un rato?`; boton = '<button class="m-ok" data-a="descansar">🛏️ Descansar</button>'; }
    else { cuerpo = `${vidaTxt}🪙 ${estado.oro}<br>Descansar te devuelve <b>+${pl.restaura} ❤️</b> ${pl.costo ? `por <b>${pl.costo} 🪙</b>` : "<b>¡gratis!</b>"}.`; boton = `<button class="m-ok" data-a="descansar">🛏️ Descansar (+${pl.restaura} ❤️${pl.costo ? ` · −${pl.costo} 🪙` : " · gratis"})</button>`; }
    const res = resultado ? `<div class="m-retro ${resultado.ok ? "bien" : "mal"}">${html(resultado.texto)}</div>` : "";
    const d = abrirTarjeta(`${cabecera(n, "Posadera")}<p class="m-texto">${resultado ? "" : "¡Bienvenido a la Posada del Descanso! "}${cuerpo}</p>${res}${boton}<button class="m-ok" data-a="cerrar" style="${boton ? "background:var(--borde);color:inherit;margin-top:6px" : ""}">${boton ? "Ahora no" : "Entendido"}</button>`);
    d.querySelectorAll('[data-a="cerrar"]').forEach((b) => (b.onclick = cerrarDialogo));
    const bd = d.querySelector('[data-a="descansar"]'); if (bd) bd.onclick = () => descansar(n, bd);
  }
  async function descansar(n, boton) {
    if (estado.descansando) return;
    estado.descansando = true; boton.disabled = true; boton.textContent = "Descansando…";
    let resultado;
    try {
      let r;
      if (op.modoPrueba || !op.alDescansar) { const pl = planDescanso(); r = { ok: true, prueba: true, restaurado: pl.restaura || 0, costo: pl.costo || 0, vida: Math.min(VIDA_MAX, (estado.vida ?? 0) + (pl.restaura || 0)), monedas: estado.oro - (pl.costo || 0) }; }
      else r = await op.alDescansar();
      if (typeof r.vida === "number") estado.vida = r.vida;
      if (typeof r.monedas === "number") estado.oro = r.monedas;
      actualizarHud();
      if (r.ok) { snd.bien(); resultado = { ok: true, texto: `😴 ¡Descansaste! Recuperaste ${r.restaurado} ❤️ ${r.costo ? `(−${r.costo} 🪙)` : "(gratis)"}. Ahora tienes ${r.vida}/${VIDA_MAX}.${r.prueba ? " · 🧪 modo prueba (no se guarda)" : ""}` }; }
      else { snd.mal(); resultado = { ok: false, texto: r.mensaje || "No se pudo descansar ahora." }; }
    } catch (e) { snd.mal(); resultado = { ok: false, texto: "No se pudo guardar el descanso. Inténtalo de nuevo en un momento." }; }
    estado.descansando = false;
    if (estado.dialogo === n) abrirPosada(n, resultado); else toast(resultado.texto, 3600); // si cerró la ventana mientras tanto, solo se avisa
  }
  function abrirGuardia(n) {
    estado.dialogo = n; n.hablando = true; snd.hablar();
    const z = zonas[n.porton.zona], zd = ZONAS.find((x) => x.key === n.porton.zona), zp = ZONAS.find((x) => x.key === zd.previa), lineas = [];
    const FRASE_PASO = { bosque: "Cuidado con las ramas bajas… y no pierdas la curiosidad.", montana: "El sendero es empinado: ve con calma y no te rindas.", lago: "Allá el agua está en calma… respira y reflexiona." };
    if (z.desbloqueada) lineas.push(`¡Adelante! El ${n.porton.nombre.charAt(0).toLowerCase() + n.porton.nombre.slice(1)} está abierto. ${FRASE_PASO[zd.key] || ""}`.trim());
    else {
      if (!z.abierta) lineas.push("Tu docente todavía no abrió este camino para tu curso.");
      if (!z.cumplido) lineas.push(`Para pasar necesitas completar ${z.requeridas} ${z.requeridas === 1 ? "misión" : "misiones"} ${zp.de}. Llevas ${z.hechasPrevia} de ${z.requeridas}.`);
      else if (!z.abierta) lineas.push("¡Ya cumpliste lo que se pide! Solo falta que tu docente abra el camino.");
    }
    const barra = !z.desbloqueada && !z.cumplido && z.requeridas > 0 ? `<div class="m-barra"><i style="width:${Math.round((z.hechasPrevia / z.requeridas) * 100)}%"></i></div>` : "";
    const d = abrirTarjeta(`${cabecera(n, zd.guardia)}<p class="m-texto">${lineas.map(html).join(" ")}</p>${barra}<button class="m-ok" data-a="cerrar">Entendido</button>`);
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
    hechas.add(m.id); recalcularZonas();
    if (!r.yaEstaba) {
      if (r.xp != null) estado.xp = r.xp; else estado.xp += m.xp || 0;
      if (r.oro != null) estado.oro = r.oro; else estado.oro += m.oro || 0;
      estado.ganado.xp += m.xp || 0; estado.ganado.oro += m.oro || 0; aviso(`+${m.xp || 0} XP`, "#fde68a");
    }
    actualizarHud(); snd.bien();
    caja.innerHTML = `<div class="m-retro bien">${html(m.retro || "¡Muy bien!")}</div><div class="m-premio">${r.yaEstaba ? "Ya tenías esta misión registrada ✅" : `🎁 +${m.xp || 0} XP · +${m.oro || 0} 🪙`}${op.modoPrueba ? " · 🧪 modo prueba (no se guarda)" : ""}</div><button class="m-ok" data-a="cerrar">¡Genial!</button>`;
    caja.querySelector('[data-a="cerrar"]').onclick = cerrarDialogo;
  }
  // Si al completar una misión se cumple el requisito (y la docente ya abrió la zona), el portón se abre en el acto.
  function recalcularZonas() {
    zonas = estadoZonas({ misiones, hechas, abiertas: zonasAbiertas, requisitos: op.zonasRequisitos || {} });
    conPortones.forEach((esc) => esc.portones.forEach((p) => {
      const estaba = p.abierto; p.abierto = !!zonas[p.zona].desbloqueada;
      if (!estaba && p.abierto) { estado.terminado = false; espera(() => { aviso("🔓", "#bbf7d0"); toast(`🔓 ¡Se abrió el ${p.nombre.charAt(0).toLowerCase() + p.nombre.slice(1)}!`, 4600); snd.estrella(); }, 350); }
    }));
  }
  // ---- el mapa del mundo: las zonas, cuáles están abiertas y qué falta para entrar ----
  function abrirMapa() {
    if (estado.dialogo || estado.cambiando) return;
    estado.mapaAbierto = true; teclas.clear(); joy.x = joy.y = 0;
    const aqui = estado.escena.zona || "aldea", mapa = q(".m-mapa");
    const tarjetas = ZONAS.map((z) => {
      const e = zonas[z.key], pv = ZONAS.find((x) => x.key === z.previa) || z, total = misiones.filter((m) => zonaDeMision(m) === z.key).length, hechasZ = misiones.filter((m) => zonaDeMision(m) === z.key && hechas.has(m.id)).length;
      let estadoTxt;
      if (e.desbloqueada) estadoTxt = `🔓 Abierta · ${total ? `🎯 ${hechasZ}/${total} misiones` : "sin misiones todavía"}`;
      else if (z.previa && !zonas[z.previa].desbloqueada) estadoTxt = `🔒 Se desbloquea después de llegar ${pv.a}`;
      else if (!e.abierta && e.cumplido) estadoTxt = "🔒 Ya cumpliste el requisito · falta que tu docente abra el camino";
      else if (!e.abierta) estadoTxt = `🔒 Tu docente todavía no la abrió${e.requeridas ? ` · además, completa ${e.requeridas} misiones ${pv.de} (llevas ${e.hechasPrevia})` : ""}`;
      else estadoTxt = `🔒 Completa ${e.requeridas} ${e.requeridas === 1 ? "misión" : "misiones"} ${pv.de} para entrar (llevas ${e.hechasPrevia})`;
      const barra = !e.desbloqueada && e.abierta && !e.cumplido && e.requeridas > 0 ? `<div class="m-barra"><i style="width:${Math.round((e.hechasPrevia / e.requeridas) * 100)}%"></i></div>` : "";
      const viaje = e.desbloqueada && (z.key !== aqui || (z.key === "aldea" && estado.escena.edificioId)) ? `<button class="m-viaje" data-viaje="${z.key}">🧭 Viajar aquí</button>` : "";
      return `<div class="m-zona ${z.key === aqui ? "aqui" : ""}"><div class="m-z-nombre">${z.emoji} ${html(z.nombre)}${z.key === aqui ? ' <span style="color:var(--acento)">· 📍 estás aquí</span>' : ""}</div><div class="m-z-estado">${html(estadoTxt)}</div>${barra}${viaje}</div>`;
    }).join("");
    mapa.innerHTML = `<div class="m-tarjeta"><div class="m-cab"><span class="m-emo">🗺️</span><div><div class="m-quien">Mapa del mundo</div><div class="m-titulo">Las zonas que puedes explorar</div></div><button class="m-cerrar" data-a="cerrar" aria-label="Cerrar">✕</button></div>${tarjetas}<button class="m-ok" data-a="cerrar">Volver al juego</button></div>`;
    mapa.classList.remove("oculto"); mapa.querySelectorAll('[data-a="cerrar"]').forEach((b) => (b.onclick = cerrarMapa));
    mapa.querySelectorAll("[data-viaje]").forEach((b) => (b.onclick = () => viajarRapido(b.dataset.viaje)));
  }
  // Viaje rápido: a cualquier zona que ya esté desbloqueada (aparece en la entrada de la zona, o en la plaza si es la aldea)
  function viajarRapido(clave) {
    if (estado.cambiando || !zonas[clave] || !zonas[clave].desbloqueada) return;
    const esc = escenaDeZona[clave]; cerrarMapa(); snd.puerta(); cambiarEscena(esc, esc.spawn.x, esc.spawn.y);
  }
  function cerrarMapa() { estado.mapaAbierto = false; q(".m-mapa").classList.add("oculto"); cv.focus(); }
  function interactuar() {
    if (estado.dialogo || estado.mapaAbierto || estado.cambiando || !estado.activo || !estado.cercano) return;
    const n = estado.cercano;
    if (n.tipo === "puerta") entrarEdificio(n.edificio); else if (n.tipo === "guardia") abrirGuardia(n); else if (n.tipo === "posadero") abrirPosada(n); else if (n.tipo === "mision") abrirMision(n); else if (n.tipo === "aldeano") abrirCharla(n);
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
    const paso = 38 * dt, dx = (vx / dist) * paso, dy = (vy / dist) * paso, px = v.x, py = v.y; let movio = false;
    if (!chocaEn(esc, v.x + dx, v.y)) { v.x += dx; movio = true; }
    if (!chocaEn(esc, v.x, v.y + dy)) { v.y += dy; movio = true; }
    v.caminando = movio; v.dir = direccionDe(vx, vy); v.fasePaso = (v.fasePaso || 0) + Math.hypot(v.x - px, v.y - py) / LARGO_PASO;
    if (!movio) { v.meta = null; v.pausa = 0.4 + rand(); }
  }

  function actualizar(dt) {
    estado.fase += dt;
    const esc = estado.escena;
    const bloqueada = estado.dialogo || estado.mapaAbierto || estado.cambiando || !q(".m-fin").classList.contains("oculto");
    const [ax, ay] = bloqueada ? [0, 0] : leerEntrada();
    estado.caminando = !!(ax || ay);
    if (estado.caminando) {
      const px = estado.x, py = estado.y;
      mover(ax * 96 * dt, ay * 96 * dt); estado.dir = direccionDe(ax, ay);
      const recorrido = Math.hypot(estado.x - px, estado.y - py);       // si choca contra algo, no avanza: no mueve las piernas ni suena
      estado.movio = recorrido > 0.01; estado.fasePaso += recorrido / LARGO_PASO;
      if (estado.movio) { estado.pasoT += dt; if (estado.pasoT > 0.34) { estado.pasoT = 0; snd.paso(esc.piso(estado.x, estado.y)); } } else estado.pasoT = 0.3;
    } else { estado.movio = false; estado.pasoT = 0.3; }
    // el compañero (si tiene uno) camina detrás
    const ox = estado.x - { east: 22, "south-east": 16, south: 0, "south-west": -16, west: -22, "north-west": -16, north: 0, "north-east": 16 }[estado.dir], oy = estado.y - { east: 0, "south-east": 12, south: 22, "south-west": 12, west: 0, "north-west": -12, north: -22, "north-east": -12 }[estado.dir] + 6;
    estado.comp.x += (ox - estado.comp.x) * Math.min(1, dt * 5); estado.comp.y += (oy - estado.comp.y) * Math.min(1, dt * 5);
    // estrellas
    for (const s of esc.estrellas) if (!s.tomada && Math.hypot(s.x - estado.x, s.y - 6 - estado.y) < 16) { s.tomada = true; estado.est++; actualizarHud(); aviso("⭐", "#fde68a"); snd.estrella(); }
    // salida de los edificios (caminar hacia la puerta)
    if (!estado.cambiando) { const sal = esc.salidas.find((s) => estado.x > s.x && estado.x < s.x + s.w && estado.y > s.y && estado.y < s.y + s.h && (!s.activa || s.activa())); if (sal) (sal.accion || salirDeEdificio)(); }
    // personajes
    for (const n of esc.npcs) if (n.tipo === "aldeano") moverAldeano(n, esc, dt);
    for (const n of esc.npcs) if ((n.hablando || Math.hypot(n.x - estado.x, n.y - estado.y) < 90) && n.tipo !== "puerta") { if (n.tipo === "mision" || n.tipo === "guardia" || n.tipo === "posadero" || n.hablando) n.dir = direccionDe(estado.x - n.x, estado.y - n.y); }
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
  function dibujarPersonaje(clave, dir, x, y, caminando, fase) {
    const an = sprites[clave].ancla, cuadros = pasos[clave] && pasos[clave][dir];
    const im = caminando && cuadros ? cuadros[Math.floor(fase) % 4] : (imgs[clave][dir] || imgs[clave].south); // en movimiento: cuadros de caminata; quieto: la pose de siempre
    ctx.drawImage(im, Math.round(x - an.cx - camX), Math.round(y - an.by - camY));
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
      sombra(n.x, n.y, 9, 3.5); dibujarPersonaje(n.clave, n.dir, n.x, n.y, n.caminando, n.fasePaso || 0);
      if (n.tipo === "mision") { const hecha = hechas.has(n.mision.id), b = hecha ? 0 : Math.sin(t * 5 + n.x) * 3, an = sprites[n.clave].ancla; emoji(hecha ? "✅" : "❗", n.x, n.y - an.by - 4 + b, 18); }
      else if (n.tipo === "guardia") emoji(n.porton.abierto ? "🔓" : "🔒", n.x, n.y - sprites[n.clave].ancla.by - 4, 18);
      else if (n.tipo === "posadero") emoji("🛏️", n.x, n.y - sprites[n.clave].ancla.by - 4, 18);
      else if (Math.hypot(n.x - estado.x, n.y - estado.y) < 60) etiqueta(n.nombre, Math.round(n.x - camX), Math.round(n.y - sprites[n.clave].ancla.by - camY - 3), "#e8edf8");
    } });
    if (esc.exterior) for (const e of esc.edificios) { const p = pendientesEn(e.id); if (p > 0 && visible(e.puerta.x, e.puerta.y)) lista.push({ y: e.puerta.y + 40, d: () => emoji("❗", e.puerta.x, e.puerta.y - 58 + Math.sin(t * 5 + e.x) * 3, 20) }); }
    if (J.companero) lista.push({ y: estado.comp.y, d: () => { sombra(estado.comp.x, estado.comp.y, 6, 2.5); emoji(J.companero, estado.comp.x, estado.comp.y - 2 - Math.abs(Math.sin(t * 9)) * (estado.caminando ? 2 : 0), 18); } });
    lista.push({ y: estado.y, d: () => {
      const an = sprites[estado.clave].ancla;
      if (J.nivel && J.nivel.color) { const a = 0.35 + Math.sin(t * 3) * 0.08, gx = Math.round(estado.x - camX), gy = Math.round(estado.y - camY), gr = ctx.createRadialGradient(gx, gy, 2, gx, gy, 24); gr.addColorStop(0, J.nivel.color + "cc"); gr.addColorStop(1, J.nivel.color + "00"); ctx.globalAlpha = a + 0.4; ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(gx, gy, 26, 11, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      sombra(estado.x, estado.y, 10, 4); dibujarPersonaje(estado.clave, estado.dir, estado.x, estado.y, estado.movio, estado.fasePaso);
      etiqueta(estado.nombre, Math.round(estado.x - camX), Math.round(estado.y - an.by - camY - 3));
    } });
    lista.sort((a, b) => a.y - b.y); for (const o of lista) o.d();
    ctx.font = "bold 11px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    for (const a of estado.avisos) { const yy = estado.y - 56 - a.t * 22 - camY, xx = estado.x - camX; ctx.globalAlpha = Math.max(0, 1 - a.t / 1.3); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.7)"; ctx.strokeText(a.texto, xx, yy); ctx.fillStyle = a.color; ctx.fillText(a.texto, xx, yy); ctx.globalAlpha = 1; }
    if (esc.exterior) dibujarMini(esc);
  }
  function dibujarMini(esc) {
    const m = esc.mini, k = m.k * (mini.width / (MW * 3));
    mctx.clearRect(0, 0, mini.width, mini.height); mctx.drawImage(m.base, 0, 0, mini.width, mini.height);
    const punto = (x, y, col, r) => { mctx.fillStyle = col; mctx.beginPath(); mctx.arc(x * k, y * k, r, 0, 7); mctx.fill(); mctx.strokeStyle = "#000"; mctx.lineWidth = 0.8; mctx.stroke(); };
    for (const e of esc.edificios) { const total = misiones.filter((mm) => mm.lugar === e.id).length; if (total) punto(e.puerta.x, e.puerta.y, pendientesEn(e.id) ? "#fbbf24" : "#34d399", 3.4); }
    for (const n of esc.npcs) if (n.tipo === "mision") punto(n.x, n.y, hechas.has(n.mision.id) ? "#34d399" : "#fbbf24", 3.2);
    for (const p of esc.portones) punto(p.disparador.x, p.disparador.y + 40, p.abierto ? "#34d399" : "#ef4444", 3.4); // el portón: rojo cerrado, verde abierto
    { const v = esc.salidas.find((s) => s.volver); if (v) punto(v.x + 20, v.y + 64, "#34d399", 3.4); }                // la vuelta a la zona anterior
    for (const s of esc.estrellas) if (!s.tomada) { mctx.fillStyle = "#fff"; mctx.fillRect(s.x * k - 1, s.y * k - 1, 2, 2); }
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
    if (k === "p") { if (estado.mapaAbierto) cerrarMapa(); else abrirMapa(); return; }
    if (estado.mapaAbierto) { if (e.key === "Escape") cerrarMapa(); return; }
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
  q(".b-mapa").onclick = () => (estado.mapaAbierto ? cerrarMapa() : abrirMapa());
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
    estado, escenas, exterior, interiores, misiones, hechas, snd, chocaEn, interactuar, cambiarEscena, pasos, bosque: escenaDeZona.bosque, naturales, escenaDeZona, zonas: () => zonas, recalcularZonas, abrirMapa, cerrarMapa, viajarRapido,
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
