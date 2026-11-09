// Monstruos del Mundo 3D: limo (de día y de noche), esqueleto y sombra (solo de noche). Viven fuera de la aldea.
// Cada modelo es una lista de partes con su punto de giro. Cajas: [ancho, alto, fondo, x, y, z, color]. El frente mira a +z.

const h = (s) => [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];
const NEGRO = h("#101010"), HUESO = h("#d9d6c8"), HUESO2 = h("#9a9788");

export const MONSTRUOS = {
  limo: {
    nombre: "Limo", emoji: "🟢", hp: 6, vel: 1.7, vision: 13, alcance: 1.25, noche: false,
    sangre: 1, // color de las partículas al vencerlo (bloque 1 = pasto)
    partes: [
      { tipo: "cuerpo", p: [0, 0, 0], cajas: [[.95, .8, .95, 0, .4, 0, h("#5fbf4a")], [.5, .5, .5, 0, .42, 0, h("#3f8f34")], [.11, .15, .04, -.2, .55, .48, NEGRO], [.11, .15, .04, .2, .55, .48, NEGRO], [.34, .06, .04, 0, .3, .48, NEGRO]] },
    ],
  },
  esqueleto: {
    nombre: "Esqueleto", emoji: "💀", hp: 8, vel: 2.4, vision: 16, alcance: 1.45, noche: true,
    sangre: 19,
    partes: [
      { tipo: "cuerpo", p: [0, 0, 0], cajas: [[.5, .72, .24, 0, 1.06, 0, HUESO], [.42, .07, .26, 0, 1.22, 0, HUESO2], [.42, .07, .26, 0, 1.06, 0, HUESO2], [.42, .07, .26, 0, .9, 0, HUESO2]] },
      { tipo: "cabeza", p: [0, 1.42, 0], cajas: [[.44, .44, .44, 0, .22, 0, HUESO], [.1, .1, .04, -.11, .26, .22, NEGRO], [.1, .1, .04, .11, .26, .22, NEGRO], [.2, .05, .04, 0, .08, .22, NEGRO]] },
      { tipo: "pata", fase: 0, p: [-.14, .7, 0], cajas: [[.18, .7, .18, 0, -.35, 0, HUESO]] },
      { tipo: "pata", fase: 1, p: [.14, .7, 0], cajas: [[.18, .7, .18, 0, -.35, 0, HUESO]] },
      { tipo: "brazo", fase: 0, p: [-.34, 1.36, 0], cajas: [[.14, .66, .14, 0, -.3, 0, HUESO]] },
      { tipo: "brazo", fase: 1, p: [.34, 1.36, 0], cajas: [[.14, .66, .14, 0, -.3, 0, HUESO]] },
    ],
  },
  sombra: {
    nombre: "Sombra", emoji: "👻", hp: 6, vel: 3.1, vision: 18, alcance: 1.35, noche: true, flota: true,
    sangre: 23,
    partes: [
      { tipo: "cuerpo", p: [0, 0, 0], cajas: [[.62, 1.1, .36, 0, .95, 0, h("#2a1f3d")], [.4, .5, .3, 0, .45, 0, h("#1d1530")]] },
      { tipo: "cabeza", p: [0, 1.5, 0], cajas: [[.5, .5, .5, 0, .25, 0, h("#3a2a52")], [.13, .08, .04, -.13, .3, .26, h("#ff3b3b")], [.13, .08, .04, .13, .3, .26, h("#ff3b3b")]] },
      { tipo: "brazo", fase: 0, p: [-.4, 1.35, 0], cajas: [[.12, .85, .12, 0, -.42, 0, h("#2a1f3d")]] },
      { tipo: "brazo", fase: 1, p: [.4, 1.35, 0], cajas: [[.12, .85, .12, 0, -.42, 0, h("#2a1f3d")]] },
    ],
  },
};

// Daño al golpear según la mejor herramienta que se tenga (ids 50..61: 3 clases × 4 niveles; la clase 1 es el hacha).
export function danioDeArma(tiene) {
  let mejor = 1;
  for (let id = 50; id <= 61; id++) if (tiene(id) > 0) { const k = Math.floor((id - 50) / 4), t = (id - 50) % 4; mejor = Math.max(mejor, 1 + (k === 1 ? 2 : 1) + t); }
  for (let id = 68; id <= 71; id++) if (tiene(id) > 0) mejor = Math.max(mejor, 4 + (id - 68));
  return mejor;
}
