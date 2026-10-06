// =====================================================================================
//  JUEGOS DE INGENIO DE LA CASA DE LOS ACERTIJOS (lógica pura, sin pantalla: se puede probar sola)
//  Sopa de letras · Criptograma · Ahorcado · Rompecabezas deslizante
// =====================================================================================

export const TIPOS_ACERTIJO = {
  sopa: { nombre: "Sopa de letras", emoji: "🔤", ayuda: "Escribe las palabras a buscar, separadas por comas o una por línea (de 3 a 14 letras). Ejemplo: PAZ, RESPETO, JUSTICIA" },
  cripto: { nombre: "Criptograma", emoji: "🔐", ayuda: "Escribe la frase secreta (mínimo 8 letras). El estudiante la descifra: cada letra se oculta detrás de un número." },
  ahorcado: { nombre: "Ahorcado", emoji: "🪢", ayuda: "Escribe la palabra o frase que hay que adivinar (mínimo 3 letras). Usa la pista para orientar." },
  rompe: { nombre: "Rompecabezas", emoji: "🧩", ayuda: "Opcional: el enlace (URL) de una imagen para armar. Si lo dejas vacío, las fichas llevan números." },
};
export const CLAVES_TIPO = Object.keys(TIPOS_ACERTIJO);

const rng = (seed) => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
export const crearRng = rng;
function barajar(lista, rand) { const a = [...lista]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------- letras ----------
// Mayúsculas, sin tildes (la Ñ se conserva). Todo lo que no sea letra se quita.
export function soloLetras(texto) {
  return String(texto ?? "").toUpperCase().replace(/Ñ/g, "\u0001").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\u0001/g, "Ñ").replace(/[^A-ZÑ]/g, "");
}
// Una letra "de juego" de un texto (para frases): igual que soloLetras pero carácter por carácter; devuelve "" si no es letra.
export const letraDe = (ch) => soloLetras(ch).slice(0, 1);

// =====================================================================================
//  SOPA DE LETRAS
// =====================================================================================
export function parsearPalabras(texto) {
  const vistas = new Set(), lista = [];
  String(texto ?? "").split(/[,;\n]+/).forEach((t) => { const p = soloLetras(t); if (p.length >= 3 && p.length <= 14 && !vistas.has(p)) { vistas.add(p); lista.push(p); } });
  return lista.slice(0, 12);
}
const DIRS_SOPA = [[0, 1], [1, 0], [1, 1], [-1, 1]]; // → ↓ ↘ ↗

export function crearSopa(palabras, { tam, rand = Math.random } = {}) {
  const ps = [...new Set((palabras || []).map(soloLetras).filter((p) => p.length >= 3 && p.length <= 14))].slice(0, 12);
  if (!ps.length) return { imposible: true, motivo: "sin_palabras" };
  const mayor = Math.max(...ps.map((p) => p.length));
  let n = Math.max(8, Math.min(16, tam || 0, 16)); n = Math.max(n, mayor);
  const ordenadas = [...ps].sort((a, b) => b.length - a.length);
  for (let intento = 0; intento < 40; intento++, n = Math.min(16, n + (intento % 6 === 5 ? 1 : 0))) {
    const g = Array.from({ length: n }, () => Array(n).fill("")), colocadas = []; let falla = false;
    for (const p of ordenadas) {
      let puesta = false;
      for (let k = 0; k < 300 && !puesta; k++) {
        const [dr, dc] = DIRS_SOPA[Math.floor(rand() * DIRS_SOPA.length)], L = p.length;
        const r0 = Math.floor(rand() * n), c0 = Math.floor(rand() * n), r1 = r0 + dr * (L - 1), c1 = c0 + dc * (L - 1);
        if (r1 < 0 || r1 >= n || c1 < 0 || c1 >= n) continue;
        let cabe = true; for (let i = 0; i < L && cabe; i++) { const v = g[r0 + dr * i][c0 + dc * i]; if (v && v !== p[i]) cabe = false; }
        if (!cabe) continue;
        const celdas = []; for (let i = 0; i < L; i++) { g[r0 + dr * i][c0 + dc * i] = p[i]; celdas.push([r0 + dr * i, c0 + dc * i]); }
        colocadas.push({ palabra: p, celdas }); puesta = true;
      }
      if (!puesta) { falla = true; break; }
    }
    if (falla) continue;
    const abc = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!g[r][c]) g[r][c] = abc[Math.floor(rand() * abc.length)];
    return { imposible: false, tam: n, grid: g, colocadas, palabras: ps };
  }
  return { imposible: true, motivo: "no_caben" };
}

// ¿La línea recta de a a b (en cualquiera de los 8 sentidos) forma una de las palabras? Devuelve { palabra, celdas } o null.
export function palabraEnLinea(sopa, a, b) {
  const dr = b[0] - a[0], dc = b[1] - a[1], L = Math.max(Math.abs(dr), Math.abs(dc)) + 1;
  if (L < 2 || (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc))) return null;
  const sr = Math.sign(dr), sc = Math.sign(dc), celdas = []; let txt = "";
  for (let i = 0; i < L; i++) { const r = a[0] + sr * i, c = a[1] + sc * i; if (r < 0 || c < 0 || r >= sopa.tam || c >= sopa.tam) return null; celdas.push([r, c]); txt += sopa.grid[r][c]; }
  const inv = [...txt].reverse().join("");
  const p = sopa.palabras.find((w) => w === txt || w === inv);
  return p ? { palabra: p, celdas } : null;
}

// =====================================================================================
//  CRIPTOGRAMA: cada letra distinta de la frase es un número (1 a 26); se regalan algunas letras como ayuda
// =====================================================================================
export function crearCripto(frase, { rand = Math.random, pistas } = {}) {
  const texto = String(frase ?? "").trim();
  const letras = [...texto].map(letraDe), distintas = [...new Set(letras.filter(Boolean))];
  if (letras.filter(Boolean).length < 8 || distintas.length < 4 || distintas.length > 26) return { imposible: true, motivo: distintas.length > 26 ? "muchas" : "corta" };
  const numeros = barajar(Array.from({ length: 27 }, (_, i) => i + 1), rand), codigoDe = {};
  distintas.forEach((l, i) => (codigoDe[l] = numeros[i]));
  const celdas = [...texto].map((ch, i) => { const l = letras[i]; return l ? { ch, letra: l, codigo: codigoDe[l] } : { ch, letra: "", codigo: null }; });
  const nPistas = Math.max(1, Math.min(distintas.length - 2, pistas ?? Math.max(2, Math.round(distintas.length * 0.2))));
  const dadas = barajar(distintas, rand).slice(0, nPistas), dadasCodigos = {};
  dadas.forEach((l) => (dadasCodigos[codigoDe[l]] = l));
  const respuestaDe = {}; distintas.forEach((l) => (respuestaDe[codigoDe[l]] = l));
  return { imposible: false, texto, celdas, codigoDe, respuestaDe, pistas: dadasCodigos };
}
// "intentos" = { codigo: letra }. Devuelve cuántos códigos faltan, cuáles están mal y si ya está resuelto.
export function estadoCripto(cripto, intentos) {
  const todos = { ...(intentos || {}), ...cripto.pistas }; let faltan = 0; const mal = [];
  for (const [cod, letra] of Object.entries(cripto.respuestaDe)) { const v = todos[cod]; if (!v) faltan++; else if (v !== letra) mal.push(Number(cod)); }
  return { faltan, mal, resuelto: faltan === 0 && mal.length === 0 };
}

// =====================================================================================
//  AHORCADO
// =====================================================================================
export const ERRORES_AHORCADO = 6;
export function crearAhorcado(frase, { errores = ERRORES_AHORCADO } = {}) {
  const texto = String(frase ?? "").trim(), letras = [...texto].map(letraDe), distintas = [...new Set(letras.filter(Boolean))];
  if (distintas.length < 2 || letras.filter(Boolean).length < 3) return { imposible: true, motivo: "corta" };
  return { imposible: false, texto, letras, distintas, maxErrores: errores };
}
// "probadas" = lista de letras ya elegidas. Devuelve lo que se ve, los errores y si ganó o perdió.
export function estadoAhorcado(a, probadas) {
  const p = new Set((probadas || []).map(letraDe).filter(Boolean));
  const errores = [...p].filter((l) => !a.distintas.includes(l)).length, gano = a.distintas.every((l) => p.has(l)), perdio = !gano && errores >= a.maxErrores;
  const visible = [...a.texto].map((ch, i) => (!a.letras[i] ? ch : p.has(a.letras[i]) || perdio ? ch : "_"));
  return { visible, errores, gano, perdio, probadas: [...p] };
}

// =====================================================================================
//  ROMPECABEZAS DESLIZANTE (3×3 o 4×4): siempre se puede resolver porque se baraja con movimientos válidos
// =====================================================================================
export function crearRompe(n = 3, { rand = Math.random } = {}) {
  const t = n >= 4 ? 4 : 3, total = t * t;
  let piezas = Array.from({ length: total }, (_, i) => (i + 1) % total);             // [1,2,…,0]: el 0 es el hueco
  for (let intento = 0; intento < 20; intento++) {
    let hueco = total - 1, anterior = -1;
    for (let k = 0; k < total * 30; k++) {
      const vec = vecinos(hueco, t).filter((v) => v !== anterior), v = vec[Math.floor(rand() * vec.length)];
      [piezas[hueco], piezas[v]] = [piezas[v], piezas[hueco]]; anterior = hueco; hueco = v;
    }
    if (!rompeResuelto(piezas)) break;
  }
  return { n: t, piezas, movimientos: 0 };
}
export function vecinos(i, n) { const r = Math.floor(i / n), c = i % n, v = []; if (r > 0) v.push(i - n); if (r < n - 1) v.push(i + n); if (c > 0) v.push(i - 1); if (c < n - 1) v.push(i + 1); return v; }
export const rompeResuelto = (piezas) => piezas.every((p, i) => p === (i + 1) % piezas.length);
// Toca la ficha en la posición i: si está junto al hueco, se desliza. Devuelve el estado nuevo (o el mismo si no se puede mover).
export function moverRompe(est, i) {
  const hueco = est.piezas.indexOf(0);
  if (!vecinos(hueco, est.n).includes(i)) return est;
  const piezas = [...est.piezas]; [piezas[hueco], piezas[i]] = [piezas[i], piezas[hueco]];
  return { ...est, piezas, movimientos: est.movimientos + 1 };
}

// ¿El contenido que escribió la docente sirve para ese tipo? Devuelve "" si está bien o el mensaje de error.
export function validarContenido(tipo, contenido, { tam } = {}) {
  if (tipo === "sopa") { const p = parsearPalabras(contenido); if (p.length < 3) return "Escribe al menos 3 palabras válidas (de 3 a 14 letras, separadas por comas)."; const s = crearSopa(p, { tam, rand: rng(7) }); return s.imposible ? "Las palabras no caben en la sopa; usa menos o más cortas." : ""; }
  if (tipo === "cripto") { const c = crearCripto(contenido, { rand: rng(7) }); return c.imposible ? (c.motivo === "muchas" ? "La frase tiene demasiadas letras distintas." : "La frase es muy corta (mínimo 8 letras y 4 letras distintas).") : ""; }
  if (tipo === "ahorcado") return crearAhorcado(contenido).imposible ? "Escribe una palabra o frase de al menos 3 letras (2 distintas)." : "";
  if (tipo === "rompe") { const u = String(contenido || "").trim(); return u && !/^https?:\/\/\S+$/i.test(u) ? "La imagen debe ser un enlace que empiece por http:// o https://" : ""; }
  return "Tipo de acertijo desconocido.";
}
