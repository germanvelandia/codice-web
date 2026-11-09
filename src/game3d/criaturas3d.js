// Criaturas del Códice (Mundo 3D): modelos de bloques ORIGINALES. Cada una se arma con un cuerpo, ojos y un rasgo propio.
// El frente mira a +z. Cajas: [ancho, alto, fondo, x, y, z, color]. Las estadísticas reales (vida, daño, captura) las decide el servidor.
const h = (s) => [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];
const NEGRO = h("#141414"), BLANCO = h("#fafafa");
const ojos = (y, z, sep = .2, t = .1) => [[t, t * 1.2, .04, -sep, y, z, BLANCO], [t, t * 1.2, .04, sep, y, z, BLANCO], [t * .5, t * .7, .05, -sep, y, z + .01, NEGRO], [t * .5, t * .7, .05, sep, y, z + .01, NEGRO]];
function modelo(c1, c2, w, alto, rasgo) {
  const A = h(c1), B = h(c2), cajas = [[w, alto, w * .9, 0, alto / 2 + .15, 0, A], [w * .6, alto * .45, .05, 0, alto * .35 + .15, w * .46, B], ...ojos(alto * .72 + .15, w * .46)];
  const pies = [{ tipo: "pata", fase: 0, p: [-w * .25, .18, 0], cajas: [[.2, .18, .22, 0, -.09, .02, B]] }, { tipo: "pata", fase: 1, p: [w * .25, .18, 0], cajas: [[.2, .18, .22, 0, -.09, .02, B]] }];
  const top = alto + .15; const r = [];
  if (rasgo === "luz") r.push([.1, .22, .1, 0, top + .12, 0, h("#fff3a0")], [.3, .06, .06, 0, top + .1, 0, h("#fff3a0")]);
  if (rasgo === "hojas") r.push([.34, .08, .22, -.14, top + .08, 0, h("#2f9e44")], [.34, .08, .22, .14, top + .1, 0, h("#51cf66")], [.08, .18, .08, 0, top + .1, 0, h("#5c940d")]);
  if (rasgo === "aleta") r.push([.06, alto * .5, .34, 0, alto * .7 + .15, -w * .5, B], [.34, .08, .2, -w * .55, alto * .45 + .15, 0, B], [.34, .08, .2, w * .55, alto * .45 + .15, 0, B]);
  if (rasgo === "rocas") r.push([.22, .2, .22, -.2, top + .08, 0, h("#868e96")], [.2, .28, .2, .16, top + .1, -.05, h("#adb5bd")]);
  if (rasgo === "llama") r.push([.22, .26, .22, 0, top + .13, 0, h("#ff922b")], [.12, .2, .12, 0, top + .3, 0, h("#ffe066")]);
  if (rasgo === "gota") r.push([.16, .2, .16, 0, top + .1, 0, h("#74c0fc")], [.08, .14, .08, 0, top + .26, 0, h("#a5d8ff")]);
  if (rasgo === "cuernos") r.push([.1, .3, .1, -w * .3, top + .15, 0, h("#e9ecef")], [.1, .3, .1, w * .3, top + .15, 0, h("#e9ecef")]);
  if (rasgo === "sol") r.push([.5, .08, .08, 0, top + .1, 0, h("#ffd43b")], [.08, .5, .08, 0, top + .1, 0, h("#ffd43b")], [.3, .3, .06, 0, top + .1, -.02, h("#fff3bf")]);
  if (rasgo === "lava") r.push([.14, .3, .14, -w * .3, top + .15, 0, h("#ff6b1a")], [.14, .3, .14, w * .3, top + .15, 0, h("#ff6b1a")], [.2, .12, .2, 0, top + .06, 0, h("#ffd43b")]);
  return [{ tipo: "cuerpo", p: [0, 0, 0], cajas: [...cajas, ...r] }, ...pies];
}
// id → datos de dibujo. flota: se mueve en el aire.
export const CRIATURAS = {
  1: { nombre: "Lumo", emoji: "✨", flota: true, vel: 1.1, partes: modelo("#f4d35e", "#fff3a0", .5, .5, "luz") },
  2: { nombre: "Musgol", emoji: "🌿", vel: .8, partes: modelo("#4c9a2a", "#a9d18e", .75, .7, "hojas") },
  3: { nombre: "Pezal", emoji: "🐟", flota: true, vel: 1.2, partes: modelo("#339af0", "#a5d8ff", .55, .55, "aleta") },
  4: { nombre: "Arenito", emoji: "🪨", vel: .7, partes: modelo("#c9a66b", "#e8d5a8", .8, .65, "rocas") },
  5: { nombre: "Brasín", emoji: "🔥", vel: 1.4, partes: modelo("#e8590c", "#ffc078", .6, .7, "llama") },
  6: { nombre: "Aquor", emoji: "💧", vel: 1.3, partes: modelo("#1c7ed6", "#74c0fc", .65, .65, "gota") },
  7: { nombre: "Folín", emoji: "🍃", vel: 1.8, partes: modelo("#2f9e44", "#b2f2bb", .55, .75, "hojas") },
  8: { nombre: "Pétreo", emoji: "⛰️", vel: .6, partes: modelo("#6c757d", "#adb5bd", .95, .85, "rocas") },
  9: { nombre: "Umbra", emoji: "🌑", flota: true, vel: 1.5, partes: modelo("#3b2f5c", "#7048e8", .7, .8, "cuernos") },
  10: { nombre: "Solaris", emoji: "☀️", flota: true, vel: 1.4, partes: modelo("#ffd43b", "#fff9db", .7, .8, "sol") },
  11: { nombre: "Magmor", emoji: "🌋", vel: 1.0, partes: modelo("#7a1f12", "#ff6b1a", 1.05, 1.0, "lava") },
};
export const ELEMENTOS = { fuego: "🔥 Fuego", agua: "💧 Agua", planta: "🌿 Planta", tierra: "⛰️ Tierra", luz: "☀️ Luz", sombra: "🌑 Sombra" };
