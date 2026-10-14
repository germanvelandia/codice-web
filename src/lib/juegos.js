// =====================================================================================
//  JUEGOS DE LAS LECCIONES · lógica pura (sin pantalla)
//  Mezclas, comparación de respuestas, huecos de texto, laberinto y puntaje de la trivia.
// =====================================================================================

// Comparar respuestas sin importar mayúsculas, tildes, espacios ni signos
export const clave = (s) => String(s ?? "").toLowerCase().replace(/ñ/g, "\u0001").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\u0001/g, "ñ").replace(/[^a-z0-9ñ]/g, "");

// Fisher-Yates con generador propio (rand() → [0,1)) para que la mezcla sea repetible
export function mezclar(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// Igual, pero garantiza que el resultado NO quede en el orden original (si hay algo que desordenar)
export function mezclarDistinto(arr, rand = Math.random) {
  const a = [...arr]; if (new Set(a.map((x) => JSON.stringify(x))).size < 2) return a;
  for (let k = 0; k < 20; k++) { const m = mezclar(a, rand); if (m.some((x, i) => x !== a[i])) return m; }
  return [...a.slice(1), a[0]];
}

// ---------- completar los espacios ----------
// "Dios es [[amor]] y [[justicia|equidad]]" → partes: texto y huecos (cada hueco con sus respuestas válidas)
export function parsearHuecos(texto) {
  const partes = []; let huecos = 0, resto = String(texto ?? ""), m;
  while ((m = resto.match(/\[\[([^\[\]]{1,60})\]\]/))) {
    if (m.index > 0) partes.push({ t: "txt", texto: resto.slice(0, m.index) });
    const validas = m[1].split("|").map((x) => x.trim()).filter(Boolean);
    if (validas.length) partes.push({ t: "hueco", i: huecos++, validas }); else partes.push({ t: "txt", texto: "" });
    resto = resto.slice(m.index + m[0].length);
  }
  if (resto) partes.push({ t: "txt", texto: resto });
  return { partes, huecos };
}
export const huecoCorrecto = (hueco, valor) => { const v = clave(valor); return !!v && hueco.validas.some((x) => clave(x) === v); };

// ---------- anagramas ----------
// Piezas de un anagrama: letras de una palabra, o palabras de una oración
export function piezasAnagrama(texto, modo) {
  const s = String(texto ?? "").trim();
  return modo === "frase" ? s.split(/\s+/).filter(Boolean) : [...s.replace(/\s+/g, "")];
}
export const anagramaCorrecto = (texto, modo, armado) => {
  const orig = piezasAnagrama(texto, modo); if (orig.length !== armado.length) return false;
  return modo === "frase" ? orig.every((p, i) => clave(p) === clave(armado[i])) : clave(orig.join("")) === clave(armado.join(""));
};

// ---------- trivia con tiempo ----------
// Respuesta correcta: de 50 a 100 puntos según lo rápido que fue. Incorrecta o sin tiempo: 0.
export function puntosTrivia(correcta, msUsados, segundos) {
  if (!correcta) return 0;
  const limite = Math.max(1, Number(segundos) || 20) * 1000, f = Math.min(1, Math.max(0, Number(msUsados) / limite));
  return Math.round(100 - 50 * f);
}

// ---------- ordenar (línea de tiempo / jerarquía) ----------
// orden = lista de índices en el orden que puso el estudiante → cuántos están en su sitio
export const posicionesCorrectas = (orden) => orden.reduce((n, v, i) => n + (v === i ? 1 : 0), 0);

// ---------- laberinto ----------
const rngDe = (seed) => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
const VECINOS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
/**
 * Laberinto tipo "Pac-Man" por turnos. tam impar (9, 11…). 1 = muro, 0 = camino.
 * → { tam, mapa, inicio: [f,c], respuestas: [[f,c]…] (una por opción), enemigos: [[f,c]…] }
 * Siempre se puede llegar a todas las respuestas (laberinto perfecto).
 */
export function crearLaberinto({ seed = 1, opciones = 3, enemigos = 1, tam = 9 } = {}) {
  const rand = typeof seed === "function" ? seed : rngDe(Number(seed) || 1);
  const n = tam % 2 ? tam : tam + 1, mapa = Array.from({ length: n }, () => Array(n).fill(1));
  const pila = [[1, 1]]; mapa[1][1] = 0;
  while (pila.length) {
    const [f, c] = pila[pila.length - 1];
    const libres = mezclar([[-2, 0], [2, 0], [0, -2], [0, 2]], rand).filter(([df, dc]) => { const a = f + df, b = c + dc; return a > 0 && b > 0 && a < n - 1 && b < n - 1 && mapa[a][b] === 1; });
    if (!libres.length) { pila.pop(); continue; }
    const [df, dc] = libres[0]; mapa[f + df / 2][c + dc / 2] = 0; mapa[f + df][c + dc] = 0; pila.push([f + df, c + dc]);
  }
  // un par de pasillos extra para que no sea un único camino y se pueda esquivar a los enemigos
  for (let k = 0; k < Math.floor(n / 3); k++) { const f = 1 + Math.floor(rand() * (n - 2)), c = 1 + Math.floor(rand() * (n - 2)); if (mapa[f][c] === 1 && ((mapa[f - 1][c] === 0 && mapa[f + 1][c] === 0) || (mapa[f][c - 1] === 0 && mapa[f][c + 1] === 0))) mapa[f][c] = 0; }
  const inicio = [1, 1], dist = distancias(mapa, inicio);
  // respuestas: celdas lejanas y separadas entre sí
  const cand = []; for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) if (mapa[f][c] === 0 && dist[f][c] >= 4) cand.push([f, c, dist[f][c]]);
  cand.sort((a, b) => b[2] - a[2] || a[0] - b[0] || a[1] - b[1]);
  const respuestas = [];
  for (const sep of [5, 4, 3, 2, 1, 0]) { for (const p of cand) { if (respuestas.length >= opciones) break; if (respuestas.every((q) => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) >= sep)) respuestas.push([p[0], p[1]]); } if (respuestas.length >= opciones) break; }
  const ocupadas = new Set(respuestas.map((p) => p.join(",")));
  const lejos = []; for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) if (mapa[f][c] === 0 && dist[f][c] >= 5 && !ocupadas.has(f + "," + c)) lejos.push([f, c]);
  const ene = mezclar(lejos, rand).slice(0, Math.max(0, Math.min(3, enemigos)));
  return { tam: n, mapa, inicio, respuestas, enemigos: ene };
}
// distancias (pasos) desde un punto a cada celda de camino; -1 si es muro o no se alcanza
export function distancias(mapa, desde) {
  const n = mapa.length, d = Array.from({ length: n }, () => Array(n).fill(-1)); d[desde[0]][desde[1]] = 0; const cola = [desde];
  for (let i = 0; i < cola.length; i++) { const [f, c] = cola[i]; for (const [df, dc] of VECINOS) { const a = f + df, b = c + dc; if (a >= 0 && b >= 0 && a < n && b < n && mapa[a][b] === 0 && d[a][b] < 0) { d[a][b] = d[f][c] + 1; cola.push([a, b]); } } }
  return d;
}
// Mueve al jugador un paso (df, dc). Devuelve la nueva posición, o la misma si hay muro.
export function moverJugador(lab, pos, df, dc) {
  const f = pos[0] + df, c = pos[1] + dc;
  return f >= 0 && c >= 0 && f < lab.tam && c < lab.tam && lab.mapa[f][c] === 0 ? [f, c] : pos;
}
// Un paso de cada enemigo: la mitad de las veces persigue (camino más corto), si no, deambula.
export function moverEnemigos(lab, enemigos, jugador, rand = Math.random) {
  const d = distancias(lab.mapa, jugador);
  return enemigos.map(([f, c]) => {
    const opts = VECINOS.map(([df, dc]) => [f + df, c + dc]).filter(([a, b]) => a >= 0 && b >= 0 && a < lab.tam && b < lab.tam && lab.mapa[a][b] === 0);
    if (!opts.length) return [f, c];
    if (rand() < 0.5) { const mejor = Math.min(...opts.map(([a, b]) => d[a][b])); const m = opts.filter(([a, b]) => d[a][b] === mejor); return m[Math.floor(rand() * m.length)]; }
    return opts[Math.floor(rand() * opts.length)];
  });
}
export const mismaCelda = (a, b) => a[0] === b[0] && a[1] === b[1];
