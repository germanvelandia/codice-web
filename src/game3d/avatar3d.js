// El avatar del estudiante en el mundo 3D: se arma con los colores y accesorios de SU personaje
// (el mismo que ve en su tarjeta y en el Mundo 2D), leyendo su dibujo de 48 × 48 píxeles.
import { imagenPersonajeRol } from "../lib/personajesRol";

const aHex = (r, g, b) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
const esPiel = (r, g, b) => { const [h, s, l] = hsl(r, g, b); return h >= 5 && h <= 50 && s >= .2 && s <= .8 && l >= .42 && l <= .88; };
const esPielCara = (r, g, b) => { const [h, s, l] = hsl(r, g, b); return h >= 8 && h <= 40 && s >= .2 && s <= .65 && l >= .5 && l <= .88; };
// los dibujos tienen sombras y brillos: se lleva el tono de piel a un rango natural
function suavizarPiel(hexa) {
  let r = parseInt(hexa.slice(1, 3), 16), g = parseInt(hexa.slice(3, 5), 16), b = parseInt(hexa.slice(5, 7), 16);
  const [h, s, l] = hsl(r, g, b), l2 = Math.max(.38, Math.min(.8, l)), s2 = Math.min(s, .55), c = (1 - Math.abs(2 * l2 - 1)) * s2, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l2 - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : [x, c, 0];
  return aHex((r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255);
}

// color que más se repite dentro de un rectángulo (agrupando colores parecidos), o null si no hay
function dominante(img, x0, y0, x1, y1, ok) {
  const W = img.width, H = img.height, d = img.data, cubos = new Map();
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++) {
    const i = (y * W + x) * 4; if (d[i + 3] < 128) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2]; if (!ok(r, g, b)) continue;
    const k = (r >> 4) * 256 + (g >> 4) * 16 + (b >> 4), c = cubos.get(k) || { n: 0, r: 0, g: 0, b: 0 }; c.n++; c.r += r; c.g += g; c.b += b; cubos.set(k, c);
  }
  let mejor = null; for (const c of cubos.values()) if (!mejor || c.n > mejor.n) mejor = c;
  return mejor ? aHex(mejor.r / mejor.n, mejor.g / mejor.n, mejor.b / mejor.n) : null;
}

const ACCESORIO = { guardian: "casco", defensor: "casco", heraldo: "corona", peregrino: "capucha", cronista: "gafas" };

function cargarImagen(src) {
  return new Promise((ok, mal) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => mal(new Error("sin imagen")); im.src = src; });
}

// { rolKey, genero, mejoras } → configuración para el motor: { piel, pelo, ropa, pant, largo, acc, accCol, capa }
export async function avatarDesdePersonaje({ rolKey, genero, mejoras = [] } = {}) {
  const base = { piel: "#e0ac84", pelo: "#4a2f1b", ropa: "#3b6fb6", pant: "#3b3f55", largo: genero === "femenino", acc: ACCESORIO[rolKey] || null, accCol: "#c9a227", capa: null };
  const tieneCapa = (mejoras || []).some((m) => /capa|🧥/i.test(`${m.nombre || ""} ${m.emoji || ""}`));
  if (tieneCapa) base.capa = "#8b1a1a";
  const src = rolKey ? imagenPersonajeRol(rolKey, genero) : null;
  if (!src || typeof document === "undefined") return base;
  try {
    const im = await cargarImagen(src), c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
    const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(im, 0, 0);
    const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return base;
    const w = x1 - x0 + 1, h = y1 - y0 + 1, cx = (x0 + x1) / 2;
    const claro = (min) => (r, gg, b) => hsl(r, gg, b)[2] > min && !esPiel(r, gg, b);
    const piel = dominante(img, cx - .13 * w, y0 + .1 * h, cx + .13 * w, y0 + .27 * h, esPielCara) || dominante(img, cx - .2 * w, y0 + .08 * h, cx + .2 * w, y0 + .3 * h, esPiel);
    const pelo = dominante(img, cx - .25 * w, y0, cx + .25 * w, y0 + .13 * h, claro(.14));
    const ropa = dominante(img, cx - .2 * w, y0 + .36 * h, cx + .2 * w, y0 + .56 * h, claro(.14));
    const pant = dominante(img, cx - .16 * w, y0 + .68 * h, cx + .16 * w, y0 + .88 * h, claro(.12));
    if (piel) base.piel = suavizarPiel(piel); if (pelo) base.pelo = pelo; if (ropa) base.ropa = ropa; if (pant) base.pant = pant;
    if (rolKey === "guardian") base.accCol = "#9aa5b1"; else if (rolKey === "defensor") base.accCol = ropa || "#3b6fb6"; else if (rolKey === "heraldo") base.accCol = "#d4af37";
  } catch (_) { /* si no se puede leer el dibujo, queda el aspecto base del rol */ }
  return base;
}
