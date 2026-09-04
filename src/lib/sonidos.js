// Efectos de sonido cortos, generados con la Web Audio API — sin archivos
// externos, funcionan en cualquier navegador.

let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function tono(frecuencia, inicio, duracion, tipo = "sine", volumenPico = 0.15) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(frecuencia, ctx.currentTime + inicio);
  gain.gain.setValueAtTime(0, ctx.currentTime + inicio);
  gain.gain.linearRampToValueAtTime(volumenPico, ctx.currentTime + inicio + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicio + duracion);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + inicio);
  osc.stop(ctx.currentTime + inicio + duracion);
}

// Un "tic-tic-tic" ascendente, como si la ruleta estuviera girando.
export function sonidoGirar() {
  try {
    for (let i = 0; i < 8; i++) tono(300 + i * 40, i * 0.12, 0.06, "square", 0.08);
  } catch (e) { /* el navegador puede bloquear audio sin interacción previa — no rompe nada */ }
}

// Un "ding-ding" alegre de acierto.
export function sonidoAcierto() {
  try {
    tono(523.25, 0, 0.15, "sine", 0.18);
    tono(659.25, 0.1, 0.2, "sine", 0.18);
    tono(783.99, 0.2, 0.3, "sine", 0.18);
  } catch (e) {}
}

// Un tono descendente y corto de error, sin ser desagradable.
export function sonidoError() {
  try {
    tono(300, 0, 0.15, "sine", 0.15);
    tono(220, 0.1, 0.25, "sine", 0.15);
  } catch (e) {}
}

// Una pequeña fanfarria para logros grandes (corona, nuevo logro, subir de nivel).
export function sonidoLogro() {
  try {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tono(f, i * 0.09, 0.25, "triangle", 0.16));
  } catch (e) {}
}

// Un "clic" cortito, para botones/acciones chicas.
export function sonidoClic() {
  try {
    tono(440, 0, 0.05, "square", 0.08);
  } catch (e) {}
}
