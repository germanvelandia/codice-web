// Animales de bloques para el Mundo 3D: vaca, oveja, cerdo y gallina.
// Cada modelo es una lista de partes con su punto de giro; el motor las dibuja con el mismo sistema de los aldeanos.
// Cajas: [ancho, alto, fondo, x, y, z, color] (centro de la caja, relativo al punto de giro de su parte). El frente mira a +z.

const h = (s) => [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];
const pata = (x, y, z, alto, ancho, col, fase, pezuna) => ({ tipo: "pata", fase, p: [x, y, z], cajas: [[ancho, alto, ancho, 0, -alto / 2, 0, col], ...(pezuna ? [[ancho + .01, .1, ancho + .01, 0, -alto + .05, 0, pezuna]] : [])] });
const ojos = (x, y, z, sep) => [[.07, .08, .03, -sep, y, z, h("#1b1b1b")], [.07, .08, .03, sep, y, z, h("#1b1b1b")]];

const BLANCO = h("#f2f2ee"), NEGRO = h("#2a2523"), MARRON = h("#6b4429"), ROSA = h("#f1a6a6"), ROSA2 = h("#e48b8b"), CREMA = h("#e9dcc0");

export const ESPECIES = {
  vaca: {
    nombre: "Vaca", emoji: "🐄", vel: .75, radio: 5, k: 1,
    partes: [
      { tipo: "cuerpo", p: [0, 0, 0], cajas: [[.85, .75, 1.35, 0, 1.05, 0, BLANCO], [.87, .32, .46, 0, 1.2, -.3, MARRON], [.87, .28, .4, .0, 1.05, .35, NEGRO], [.3, .14, .3, 0, .66, -.32, ROSA]] },
      { tipo: "cabeza", p: [0, 1.28, .68], cajas: [[.55, .5, .5, 0, 0, .2, BLANCO], [.4, .22, .12, 0, -.12, .5, ROSA], [.08, .16, .08, -.3, .3, .1, CREMA], [.08, .16, .08, .3, .3, .1, CREMA], ...ojos(0, .08, .46, .17)] },
      pata(-.28, .7, .5, .7, .24, BLANCO, 0, NEGRO), pata(.28, .7, .5, .7, .24, BLANCO, 1, NEGRO), pata(-.28, .7, -.5, .7, .24, BLANCO, 1, NEGRO), pata(.28, .7, -.5, .7, .24, BLANCO, 0, NEGRO),
      { tipo: "cola", p: [0, 1.3, -.68], cajas: [[.07, .55, .07, 0, -.27, 0, MARRON]] },
    ],
  },
  oveja: {
    nombre: "Oveja", emoji: "🐑", vel: .65, radio: 5, k: 1,
    partes: [
      { tipo: "cuerpo", p: [0, 0, 0], cajas: [[1, .8, 1.1, 0, .98, 0, h("#efefea")], [.8, .2, .9, 0, 1.45, 0, h("#f7f7f3")]] },
      { tipo: "cabeza", p: [0, 1.15, .6], cajas: [[.42, .45, .42, 0, 0, .18, h("#5c4a3a")], [.46, .16, .46, 0, .24, .12, h("#f7f7f3")], ...ojos(0, .06, .4, .13)] },
      pata(-.26, .58, .38, .58, .2, h("#5c4a3a"), 0), pata(.26, .58, .38, .58, .2, h("#5c4a3a"), 1), pata(-.26, .58, -.38, .58, .2, h("#5c4a3a"), 1), pata(.26, .58, -.38, .58, .2, h("#5c4a3a"), 0),
    ],
  },
  cerdo: {
    nombre: "Cerdo", emoji: "🐖", vel: .8, radio: 4.5, k: 1,
    partes: [
      { tipo: "cuerpo", p: [0, 0, 0], cajas: [[.8, .62, 1.0, 0, .68, 0, ROSA]] },
      { tipo: "cabeza", p: [0, .82, .52], cajas: [[.52, .46, .46, 0, 0, .14, ROSA], [.3, .2, .14, 0, -.07, .42, ROSA2], [.07, .1, .05, -.1, -.07, .5, h("#8a4a4a")], [.07, .1, .05, .1, -.07, .5, h("#8a4a4a")], [.12, .1, .06, -.2, .24, .1, ROSA2], [.12, .1, .06, .2, .24, .1, ROSA2], ...ojos(0, .08, .38, .14)] },
      pata(-.22, .38, .33, .38, .2, ROSA, 0), pata(.22, .38, .33, .38, .2, ROSA, 1), pata(-.22, .38, -.33, .38, .2, ROSA, 1), pata(.22, .38, -.33, .38, .2, ROSA, 0),
      { tipo: "cola", p: [0, .9, -.52], cajas: [[.06, .12, .06, 0, 0, -.04, ROSA2]] },
    ],
  },
  gallina: {
    nombre: "Gallina", emoji: "🐔", vel: 1, radio: 3.5, k: 1,
    partes: [
      { tipo: "cuerpo", p: [0, 0, 0], cajas: [[.3, .28, .44, 0, .42, 0, BLANCO], [.1, .22, .14, 0, .54, -.26, BLANCO]] },
      { tipo: "cabeza", p: [0, .6, .2], cajas: [[.17, .2, .17, 0, .1, .04, BLANCO], [.09, .06, .1, 0, .08, .15, h("#e9a23a")], [.05, .09, .12, 0, .24, .03, h("#d23b3b")], [.04, .07, .04, 0, .0, .11, h("#d23b3b")], ...ojos(0, .13, .12, .06).map((c) => [c[0] * .7, c[1] * .7, c[2], c[3], c[4], c[5], c[6]])] },
      { tipo: "ala", fase: 0, p: [-.17, .5, 0], cajas: [[.05, .2, .32, -.01, -.06, 0, h("#e6e6e0")]] },
      { tipo: "ala", fase: 1, p: [.17, .5, 0], cajas: [[.05, .2, .32, .01, -.06, 0, h("#e6e6e0")]] },
      pata(-.07, .28, 0, .28, .05, h("#e9a23a"), 0), pata(.07, .28, 0, .28, .05, h("#e9a23a"), 1),
    ],
  },
};

// Cuántos de cada uno hay en un mundo, y en cuántos grupos se reparten.
export const POBLACION = [["vaca", 10], ["oveja", 12], ["cerdo", 8], ["gallina", 12]];
export const sonidoDe = (esp) => esp;
