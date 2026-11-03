// Ambiente del Mundo 3D: hora del día, color del cielo y la luz, sol, luna y lluvia.
// Todo se calcula con el reloj, así que todos los estudiantes (y el docente) ven la misma hora y el mismo clima.

export const DIA_SEG = 720;            // un día completo dura 12 minutos reales
const FRAC_DIA = 0.65;                 // el día dura el 65 %; la noche, el resto
const mezcla = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (n) => { let h = (Math.imul(n | 0, 374761393) + 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

const CIELO_DIA = [.52, .74, .93], CIELO_NOCHE = [.02, .03, .09], CIELO_OCASO = [.97, .50, .28], CIELO_LLUVIA = [.42, .47, .53];
const LUZ_DIA = [1, 1, 1], LUZ_NOCHE = [.38, .43, .65], LUZ_OCASO = [1, .72, .58];

// Hay lluvia en cerca de uno de cada cuatro tramos de 6 minutos; entra y sale poco a poco.
export function lluviaEn(msAhora) {
  const s = msAhora / 360000, i = Math.floor(s), f = s - i;
  const r = (k) => (hash(k * 7919 + 13) < .24 ? 1 : 0);
  return r(i - 1) + (r(i) - r(i - 1)) * suave(0, .12, f);
}

// hora: 0..1 (0 = amanecer). Devuelve el estado del cielo.
export function estadoCielo(hora, lluvia = 0) {
  const ang = hora < FRAC_DIA ? (hora / FRAC_DIA) * Math.PI : Math.PI + ((hora - FRAC_DIA) / (1 - FRAC_DIA)) * Math.PI;
  const sol = [Math.cos(ang), Math.sin(ang), .25], n = Math.hypot(...sol); sol.forEach((_, i) => { sol[i] /= n; });
  const altura = sol[1];
  const dia = suave(-.08, .32, altura);                       // 0 de noche, 1 a pleno día
  // el color del cielo y de la luz cambia según la altura del sol: noche → púrpura → naranja → rosado → día
  const tramo = (stops, h) => { if (h <= stops[0][0]) return stops[0][1]; for (let i = 1; i < stops.length; i++) if (h <= stops[i][0]) { const t = (h - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]); return mezcla(stops[i - 1][1], stops[i][1], t); } return stops[stops.length - 1][1]; };
  let cielo = tramo([[-.25, CIELO_NOCHE], [-.05, [.24, .14, .30]], [.02, CIELO_OCASO], [.13, [.93, .70, .58]], [.34, CIELO_DIA]], altura);
  let luz = tramo([[-.25, LUZ_NOCHE], [-.02, [.55, .45, .6]], [.04, LUZ_OCASO], [.16, [1, .92, .84]], [.34, LUZ_DIA]], altura);
  const ocaso = Math.max(0, 1 - Math.abs(altura - .02) / .22);
  if (lluvia > 0) { const g = CIELO_LLUVIA.map((v) => v * (.25 + .75 * dia)); cielo = mezcla(cielo, g, lluvia * .85); luz = luz.map((v) => v * (1 - .22 * lluvia)); }
  return { hora, dia, noche: 1 - dia, ocaso, lluvia, cielo, luz, sol, luna: [-sol[0], -sol[1], sol[2] * -1], altura };
}

export function crearAmbiente() {
  let horaFija = null, climaFijo = null; // el docente puede fijar hora o clima (null = automático)
  const get = () => {
    const ahora = Date.now(), hora = horaFija != null ? horaFija : ((ahora / 1000) % DIA_SEG) / DIA_SEG;
    const lluvia = climaFijo != null ? (climaFijo === "lluvia" ? 1 : 0) : lluviaEn(ahora);
    return estadoCielo(hora, lluvia);
  };
  return { get, fijarHora: (h) => { horaFija = h == null ? null : ((h % 1) + 1) % 1; }, fijarClima: (c) => { climaFijo = c || null; } };
}
