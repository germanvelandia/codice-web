// Criaturas del Códice (Mundo 3D): modelos de bloques ORIGINALES. Cada una se arma con un cuerpo, ojos y un rasgo propio.
// El frente mira a +z. Cajas: [ancho, alto, fondo, x, y, z, color]. Las estadísticas reales (vida, daño, captura) las decide el servidor.
const h = (s) => [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];
const NEGRO = h("#141414"), BLANCO = h("#fafafa");
const ojos = (y, z, sep = .2, t = .1) => [[t, t * 1.2, .04, -sep, y, z, BLANCO], [t, t * 1.2, .04, sep, y, z, BLANCO], [t * .5, t * .7, .05, -sep, y, z + .01, NEGRO], [t * .5, t * .7, .05, sep, y, z + .01, NEGRO]];
function modelo(c1, c2, w, alto, rasgo) {
  const A = h(c1), B = h(c2), cajas = [[w, alto, w * .9, 0, alto / 2 + .15, 0, A], [w * .6, alto * .45, .05, 0, alto * .35 + .15, w * .46, B], ...ojos(alto * .72 + .15, w * .46)];
  const pies = [{ tipo: "pata", fase: 0, p: [-w * .25, .18, 0], cajas: [[.2, .18, .22, 0, -.09, .02, B]] }, { tipo: "pata", fase: 1, p: [w * .25, .18, 0], cajas: [[.2, .18, .22, 0, -.09, .02, B]] }];
  const top = alto + .15; const r = [];
  if (typeof rasgo === "function") r.push(...rasgo({ t: top, w, a: alto, f: w * .46, b: -w * .46, A, B }));
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
// ---- criaturas 12–50: cada una con su propio rasgo (accesorios de bloques) ----
const lado = (fn) => [fn(-1), fn(1)].flat();                       // el mismo accesorio en ambos lados
const alas = (col, ancho = .42, alto = .5) => (p) => lado((s) => [[.05, p.a * alto, ancho, s * (p.w * .5 + .03), p.a * .62 + .15, -.05, h(col)], [.05, p.a * alto * .5, ancho * .6, s * (p.w * .5 + .03), p.a * .35 + .15, -.05, h(col)]]);
const orejas = (col, alto = .3, sep = .2) => (p) => lado((s) => [[.13, alto, .1, s * sep, p.t + alto / 2, 0, h(col)]]);
const cola = (col, largo = .6, y = .5, ancho = .16) => (p) => [[ancho, ancho, largo, 0, y, p.b - largo / 2, h(col)]];
const antenas = (col, alto = .5) => (p) => lado((s) => [[.03, alto, .03, s * .1, p.t + alto / 2, p.f * .5, h(col)], [.07, .07, .07, s * .1, p.t + alto, p.f * .5, h(col)]]);
const pico = (col, y = .55) => (p) => [[.12, .1, .2, 0, p.a * y + .15, p.f + .1, h(col)]];
const mix = (...fs) => (p) => fs.flatMap((f) => f(p));
const caja = (...c) => () => [c.map((v, i) => (i === 6 ? h(v) : v))];
Object.assign(CRIATURAS, {
  12: { nombre: "Brújulo", emoji: "🧭", vel: 1.0, partes: modelo("#c9a227", "#fff3bf", .55, .55, (p) => [[.62, .07, .62, 0, p.t + .06, 0, h("#8d6e1a")], [.07, .05, .25, 0, p.t + .12, .14, h("#e03131")], [.07, .05, .25, 0, p.t + .12, -.14, h("#4dabf7")]]) },
  13: { nombre: "Tintilla", emoji: "🖋️", flota: true, vel: 1.1, partes: modelo("#1b2a6b", "#4c6ef5", .5, .6, (p) => [[.2, .26, .2, 0, p.t + .13, 0, h("#1b2a6b")], [.12, .5, .04, .2, p.t + .25, -.05, h("#f8f9fa")], [.08, .08, .08, .26, p.t + .5, -.05, h("#f8f9fa")]]) },
  14: { nombre: "Hongüelo", emoji: "🍄", vel: .7, partes: modelo("#f1e4d3", "#ffffff", .5, .5, (p) => [[p.w * 1.3, .2, p.w * 1.2, 0, p.t + .1, 0, h("#e03131")], [.12, .05, .12, -.2, p.t + .22, .1, h("#fff")], [.12, .05, .12, .2, p.t + .22, -.1, h("#fff")], [.1, .05, .1, 0, p.t + .22, .2, h("#fff")]]) },
  15: { nombre: "Polvito", emoji: "🌪️", flota: true, vel: 1.3, partes: modelo("#d9b26f", "#f3e0b5", .6, .6, (p) => [[.7, .1, .7, 0, p.t + .05, 0, h("#e8d5a8")], [.5, .1, .5, 0, p.t + .15, 0, h("#d9b26f")], [.3, .1, .3, 0, p.t + .25, 0, h("#c9a66b")]]) },
  16: { nombre: "Cuervín", emoji: "🐦‍⬛", vel: 1.6, partes: modelo("#1c1c24", "#4a4a5a", .5, .55, mix(alas("#2b2b38"), pico("#fcc419"), caja(.09, .09, .09, .22, .42, .3, "#22b8cf"))) },
  17: { nombre: "Cascajo", emoji: "🐚", vel: .7, partes: modelo("#e8b4b8", "#fff0f0", .7, .45, (p) => [[p.w * .9, .14, p.w * .8, 0, p.t + .07, -.05, h("#f783ac")], [p.w * .6, .14, p.w * .6, 0, p.t + .2, -.05, h("#fcc2d7")], [.1, .1, .1, 0, p.t + .32, -.05, h("#fff")]]) },
  18: { nombre: "Faroleo", emoji: "🏮", vel: 1.0, partes: modelo("#343a40", "#ffd43b", .5, .8, (p) => [[.32, .32, .32, 0, p.t + .2, 0, h("#ffe066")], [.42, .06, .42, 0, p.t + .4, 0, h("#343a40")], [.3, .08, .04, 0, p.t + .5, 0, h("#495057")]]) },
  19: { nombre: "Pergamín", emoji: "📜", vel: 1.1, partes: modelo("#f1e0b0", "#fff9db", .6, .8, (p) => [[.7, .14, .14, 0, p.t + .07, 0, h("#c9a66b")], [.7, .14, .14, 0, .22, 0, h("#c9a66b")], [.14, .14, .05, 0, p.a * .3 + .15, p.f + .02, h("#e03131")]]) },
  20: { nombre: "Raizón", emoji: "🌳", vel: .7, partes: modelo("#6b4a2b", "#8a6a42", .75, .8, (p) => [[.55, .1, .35, 0, p.t + .1, 0, h("#2f9e44")], [.1, .3, .1, 0, p.t + .2, 0, h("#5c940d")], [.3, .1, .3, 0, p.t + .36, 0, h("#51cf66")]]) },
  21: { nombre: "Cristalón", emoji: "💎", vel: .7, partes: modelo("#3bc9db", "#c5f6fa", .8, .9, (p) => [[.2, .4, .2, -.22, p.t + .2, 0, h("#66d9e8")], [.2, .55, .2, .08, p.t + .27, .05, h("#99e9f2")], [.15, .3, .15, .28, p.t + .15, -.1, h("#66d9e8")]]) },
  22: { nombre: "Nubel", emoji: "☁️", flota: true, vel: 1.0, partes: modelo("#e9ecef", "#ced4da", .8, .5, (p) => [[.4, .3, .4, -.25, p.t + .15, 0, h("#f8f9fa")], [.4, .35, .4, .2, p.t + .17, .05, h("#f8f9fa")], [.06, .16, .06, -.15, .12, .1, h("#74c0fc")], [.06, .16, .06, .2, .1, -.1, h("#74c0fc")]]) },
  23: { nombre: "Chispún", emoji: "🎇", vel: 2.0, partes: modelo("#f08c00", "#ffe066", .45, .55, mix((p) => lado((s) => [[.1, .3, .1, s * .15, p.t + .15, 0, h("#ffd43b")]]), caja(.1, .45, .1, 0, 1.0, 0, "#fff3bf"), cola("#ffd43b", .4, .45, .1))) },
  24: { nombre: "Penumbro", emoji: "🦇", flota: true, vel: 1.5, partes: modelo("#2b2147", "#5f3dc4", .55, .5, mix(alas("#3b2f5c", .55, .7), orejas("#2b2147", .22, .14), (p) => lado((s) => [[.05, .1, .04, s * .08, p.a * .35 + .15, p.f + .02, h("#fff")]]))) },
  25: { nombre: "Sofos", emoji: "🦉", flota: true, vel: 1.2, partes: modelo("#e6d5b8", "#fff8e1", .8, .9, mix(alas("#c9a66b", .5, .55), pico("#f59f00", .55), orejas("#8d6e63", .25, .28), caja(.5, .06, .5, 0, 1.08, 0, "#212529"), caja(.04, .2, .04, .22, .95, .22, "#ffd43b"))) },
  26: { nombre: "Leviatín", emoji: "🐋", flota: true, vel: .9, partes: modelo("#1864ab", "#a5d8ff", 1.1, .8, (p) => [[.3, .3, .5, 0, .5, p.b - .2, h("#1864ab")], [.7, .1, .3, 0, .62, p.b - .5, h("#a5d8ff")], [.1, .3, .4, 0, p.t + .15, 0, h("#1864ab")], [.06, .3, .06, 0, p.t + .3, .1, h("#a5d8ff")]]) },
  27: { nombre: "Arbóreo", emoji: "🌲", vel: .6, partes: modelo("#5c3d1e", "#8a6a42", .95, 1.1, (p) => [[1.1, .4, 1.1, 0, p.t + .2, 0, h("#2b8a3e")], [.8, .35, .8, 0, p.t + .5, 0, h("#37b24d")], [.4, .3, .4, 0, p.t + .78, 0, h("#69db7c")], [.12, .12, .12, .4, p.t + .2, .56, h("#e03131")]]) },
  28: { nombre: "Obsidor", emoji: "🪨", vel: .6, partes: modelo("#1a1625", "#4c2a85", 1.1, 1.1, (p) => [[.22, .5, .22, -.3, p.t + .25, 0, h("#7048e8")], [.26, .65, .26, .05, p.t + .32, .05, h("#9775fa")], [.2, .4, .2, .35, p.t + .2, -.05, h("#7048e8")], [.04, .6, .04, 0, p.a * .5 + .15, p.f + .02, h("#ff6b1a")]]) },
  29: { nombre: "Mariposín", emoji: "🦋", flota: true, vel: 1.2, partes: modelo("#fff3bf", "#ffe066", .3, .45, (p) => lado((s) => [[.04, .55, .5, s * .4, p.a * .6 + .15, 0, h("#e599f7")], [.04, .3, .35, s * .36, p.a * .25 + .15, -.05, h("#ffa94d")]]).concat(antenas("#6741d9", .3)(p))) },
  30: { nombre: "Grillito", emoji: "🦗", vel: 1.8, partes: modelo("#2f9e44", "#b2f2bb", .4, .45, mix(antenas("#212529", .55), (p) => lado((s) => [[.12, .3, .16, s * .2, .3, p.b - .1, h("#2b8a3e")]]))) },
  31: { nombre: "Gusanín", emoji: "🪱", vel: .8, partes: modelo("#c08457", "#f1c9a5", .4, .4, (p) => [[.34, .34, .34, 0, .32, p.b - .25, h("#b5744a")], [.28, .28, .28, 0, .28, p.b - .55, h("#a8673e")], [.22, .22, .22, 0, .25, p.b - .8, h("#9a5a35")]]) },
  32: { nombre: "Cangrejín", emoji: "🦀", vel: 1.2, partes: modelo("#e8590c", "#ffc078", .7, .4, (p) => lado((s) => [[.26, .2, .24, s * .5, .3, p.f + .1, h("#e03131")], [.12, .12, .16, s * .5, .45, p.f + .26, h("#ffc9c9")], [.05, .22, .05, s * .15, p.t + .1, p.f - .05, h("#212529")]])) },
  33: { nombre: "Copito", emoji: "❄️", flota: true, vel: 1.0, partes: modelo("#e7f5ff", "#a5d8ff", .5, .5, (p) => [[.75, .06, .06, 0, p.t + .22, 0, h("#fff")], [.06, .75, .06, 0, p.t + .22, 0, h("#fff")], [.06, .06, .75, 0, p.t + .22, 0, h("#a5d8ff")]]) },
  34: { nombre: "Cactín", emoji: "🌵", vel: .8, partes: modelo("#2f9e44", "#8ce99a", .5, .85, mix((p) => lado((s) => [[.14, .3, .14, s * .33, p.a * .55 + .15, 0, h("#2f9e44")], [.14, .14, .14, s * .33, p.a * .75 + .15, 0, h("#2f9e44")]]), caja(.16, .12, .16, 0, 1.06, 0, "#f783ac"))) },
  35: { nombre: "Escarbo", emoji: "🪲", vel: 1.3, partes: modelo("#2b6f6f", "#66a6a6", .6, .4, mix(caja(.1, .12, .3, 0, .5, .45, "#f1c40f"), caja(.05, .04, .5, 0, .6, -.05, "#0b3d3d"))) },
  36: { nombre: "Velita", emoji: "🕯️", vel: .9, partes: modelo("#f8f0e3", "#ffffff", .35, .6, (p) => [[.12, .18, .12, 0, p.t + .1, 0, h("#ff922b")], [.07, .12, .07, 0, p.t + .22, 0, h("#ffe066")], [.1, .2, .04, .12, p.a * .7, p.f, h("#fff")]]) },
  37: { nombre: "Trinar", emoji: "🐤", vel: 1.6, partes: modelo("#fcc419", "#fff9db", .4, .45, mix(alas("#f59f00", .28, .4), pico("#ff922b", .5), caja(.06, .15, .06, 0, .85, 0, "#f59f00"))) },
  38: { nombre: "Tejedor", emoji: "🕷️", vel: 1.5, partes: modelo("#343a40", "#845ef7", .5, .35, (p) => lado((s) => [[.4, .05, .05, s * .4, .3, .15, h("#212529")], [.4, .05, .05, s * .4, .3, 0, h("#212529")], [.4, .05, .05, s * .4, .3, -.15, h("#212529")], [.4, .05, .05, s * .4, .3, -.3, h("#212529")], [.1, .1, .1, s * .12, .35, p.f, h("#f03e3e")]])) },
  39: { nombre: "Ventisco", emoji: "🌨️", vel: 1.0, partes: modelo("#a5d8ff", "#e7f5ff", .8, .85, mix(orejas("#e7f5ff", .35, .25), (p) => [[p.w * 1.1, .14, p.w, 0, p.a * .7 + .15, 0, h("#fff")]])) },
  40: { nombre: "Zarpín", emoji: "🦊", vel: 1.8, partes: modelo("#e8590c", "#fff4e6", .6, .6, mix(orejas("#e8590c", .3, .2), cola("#f76707", .6, .5, .2), (p) => [[.2, .2, .2, 0, .5, p.b - .7, h("#fff")]])) },
  41: { nombre: "Coralín", emoji: "🪸", vel: .8, partes: modelo("#f06595", "#ffc9de", .6, .6, (p) => [[.12, .4, .12, -.18, p.t + .2, 0, h("#ff8787")], [.12, .55, .12, 0, p.t + .27, 0, h("#f06595")], [.12, .4, .12, .18, p.t + .2, 0, h("#ff8787")], [.3, .08, .08, 0, p.t + .3, 0, h("#f06595")]]) },
  42: { nombre: "Hiedra", emoji: "🌿", vel: 1.1, partes: modelo("#2b8a3e", "#8ce99a", .5, .7, mix((p) => lado((s) => [[.06, .5, .06, s * .3, p.a * .5 + .15, .1, h("#51cf66")], [.12, .08, .08, s * .3, p.a * .3 + .15, .1, h("#2f9e44")]]), caja(.18, .08, .18, 0, .98, 0, "#da77f2"))) },
  43: { nombre: "Geodín", emoji: "🥚", vel: .8, partes: modelo("#868e96", "#e5dbff", .7, .6, (p) => [[.35, .3, .05, 0, p.a * .5 + .15, p.f + .02, h("#b197fc")], [.2, .2, .06, 0, p.a * .5 + .15, p.f + .03, h("#e5dbff")]]) },
  44: { nombre: "Eclipse", emoji: "🌘", flota: true, vel: 1.2, partes: modelo("#0b0b1a", "#ffd43b", .7, .7, (p) => [[.95, .1, .06, 0, p.a * .55 + .15, -.45, h("#ffd43b")], [.1, .95, .06, 0, p.a * .55 + .15, -.45, h("#ffd43b")], [.6, .6, .06, 0, p.a * .55 + .15, -.43, h("#0b0b1a")]]) },
  45: { nombre: "Aurora", emoji: "🌈", flota: true, vel: 1.3, partes: modelo("#c5f6fa", "#ffffff", .6, .7, (p) => ["#ff6b6b", "#ffa94d", "#ffd43b", "#69db7c", "#4dabf7"].map((c, i) => [.5, .07, .08, 0, p.a * .25 + .15 + i * .09, p.b - .1, h(c)])) },
  46: { nombre: "Magmín", emoji: "🌋", vel: 1.2, partes: modelo("#5a1a12", "#ff6b1a", .6, .55, mix(orejas("#ff6b1a", .2, .18), caja(.05, .4, .05, .1, .45, .3, "#ffd43b"))) },
  47: { nombre: "Fantasmín", emoji: "👻", flota: true, vel: 1.1, partes: modelo("#f1f3f5", "#dee2e6", .6, .8, (p) => [[.15, .15, .15, -.22, .1, 0, h("#f1f3f5")], [.15, .15, .15, 0, .1, 0, h("#f1f3f5")], [.15, .15, .15, .22, .1, 0, h("#f1f3f5")], [.15, .15, .15, -.4, p.a * .5 + .15, p.f, h("#f1f3f5")], [.15, .15, .15, .4, p.a * .5 + .15, p.f, h("#f1f3f5")]]) },
  48: { nombre: "Alebrije", emoji: "🦎", vel: 1.2, partes: modelo("#f06595", "#ffd43b", .75, .75, mix(orejas("#4dabf7", .35, .22), cola("#69db7c", .7, .5, .16), (p) => ["#ffd43b", "#4dabf7", "#69db7c", "#ff922b"].map((c, i) => [.12, .06, .5, 0, p.t + .03, -.2 + i * .12, h(c)]))) },
  49: { nombre: "Yaguar", emoji: "🐆", vel: 2.0, partes: modelo("#e0a526", "#fff3bf", .85, .65, mix(orejas("#e0a526", .14, .22), cola("#e0a526", .8, .5, .14), (p) => [[.1, .1, .05, -.2, p.a * .5 + .15, p.f + .02, h("#2b2b2b")], [.1, .1, .05, .22, p.a * .3 + .15, p.f + .02, h("#2b2b2b")], [.1, .1, .05, 0, p.a * .75 + .15, p.f + .02, h("#2b2b2b")]])) },
  50: { nombre: "Pirofénix", emoji: "🐦‍🔥", flota: true, vel: 1.4, partes: modelo("#e8590c", "#ffe066", .8, .85, mix(alas("#ff922b", .6, .75), pico("#ffd43b", .6), (p) => [[.12, .4, .12, 0, p.t + .2, 0, h("#ffd43b")], [.1, .3, .1, .12, p.t + .15, 0, h("#ff922b")], [.14, .14, .5, 0, .5, p.b - .3, h("#ff922b")], [.1, .1, .4, 0, .7, p.b - .6, h("#ffd43b")]])) },
});
// ¿Dónde aparece cada una? z: zonas (campo, bosque, lago, monte, desierto, tundra, cruce o "*" = todas) · noche: true solo de noche, false solo de día · dim: mundos (0 principal, 1 Reino de Brasas) · p: peso
export const HABITAT = {
  1: { z: "*", p: 5 }, 2: { z: "*", p: 5 }, 3: { z: ["lago"], p: 8 }, 4: { z: "*", p: 4 }, 5: { z: "*", p: 2, dim: [0, 1] }, 6: { z: "*", p: 2 }, 7: { z: "*", p: 2 }, 8: { z: "*", p: 2 },
  9: { z: "*", p: 2, noche: true }, 10: { z: "*", p: 2, noche: false }, 11: { z: "*", p: 6, dim: [1] },
  12: { z: ["campo", "cruce"], p: 4, noche: false }, 13: { z: ["lago"], p: 4 }, 14: { z: ["bosque"], p: 5 }, 15: { z: ["desierto"], p: 5 }, 16: { z: ["campo", "bosque"], p: 4, noche: true }, 17: { z: ["lago"], p: 4 },
  18: { z: ["monte"], p: 2, noche: true }, 19: { z: ["campo", "cruce"], p: 2, noche: true }, 20: { z: ["bosque"], p: 2 }, 21: { z: ["monte"], p: 3 }, 22: { z: ["monte", "lago"], p: 2 }, 23: { z: ["desierto"], p: 3 }, 24: { z: ["bosque", "monte"], p: 2, noche: true },
  25: { z: ["monte", "campo"], p: 1, noche: false }, 26: { z: ["lago"], p: 1 }, 27: { z: ["bosque"], p: 1 }, 28: { z: "*", p: 1, dim: [1] },
  29: { z: ["campo", "bosque"], p: 5, noche: false }, 30: { z: ["campo"], p: 4, noche: true }, 31: { z: ["campo", "bosque", "tundra"], p: 4 }, 32: { z: ["lago"], p: 4 }, 33: { z: ["tundra"], p: 6 }, 34: { z: ["desierto"], p: 5 }, 35: { z: ["desierto"], p: 4 },
  36: { z: ["monte", "cruce"], p: 3, noche: true }, 37: { z: ["campo", "cruce"], p: 4, noche: false }, 38: { z: ["bosque"], p: 4, noche: true },
  39: { z: ["tundra"], p: 4 }, 40: { z: ["campo", "bosque"], p: 2 }, 41: { z: ["lago"], p: 2 }, 42: { z: ["bosque"], p: 2 }, 43: { z: ["monte", "desierto"], p: 2 }, 44: { z: "*", p: 2, noche: true }, 45: { z: ["monte", "tundra"], p: 2, noche: false },
  46: { z: "*", p: 3, dim: [1] }, 47: { z: ["bosque", "tundra"], p: 2, noche: true },
  48: { z: ["campo", "cruce"], p: 1, noche: false }, 49: { z: ["bosque"], p: 1, noche: true }, 50: { z: "*", p: 1, dim: [1] },
};
export const ELEMENTOS = { fuego: "🔥 Fuego", agua: "💧 Agua", planta: "🌿 Planta", tierra: "⛰️ Tierra", luz: "☀️ Luz", sombra: "🌑 Sombra" };
