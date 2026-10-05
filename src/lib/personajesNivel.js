// Variantes DIBUJADAS de cada personaje según su nivel.
//
// Cada nivel vive en su propio archivo (variantesNivel2.js, variantesNivel3.js, …) con
// los 14 personajes. Para sumar un nivel nuevo: se crea su archivo, se importa acá
// y se agrega una línea en "agregarNivel". El número es el nivel de CÓDICE (Nv 2, 3 o 4),
// y el nivel 1 (sin piezas) siempre usa el dibujo base.
//
// Para un personaje en el nivel N se usa la variante del nivel más alto disponible que
// no lo supere; si no hay ninguna, se usa el dibujo base.
import { VARIANTES as NIVEL_2 } from "./variantesNivel2";

export const PERSONAJES_NIVEL = {};

function agregarNivel(nivel, datos) {
  Object.keys(datos).forEach((rolKey) => {
    Object.keys(datos[rolKey]).forEach((genero) => {
      if (!PERSONAJES_NIVEL[rolKey]) PERSONAJES_NIVEL[rolKey] = {};
      if (!PERSONAJES_NIVEL[rolKey][genero]) PERSONAJES_NIVEL[rolKey][genero] = {};
      PERSONAJES_NIVEL[rolKey][genero][nivel] = datos[rolKey][genero];
    });
  });
}

agregarNivel(2, NIVEL_2);

export function imagenConNivel(rolKey, genero, nivel) {
  const porNivel = PERSONAJES_NIVEL[rolKey]?.[genero];
  if (!porNivel) return null;
  const disponibles = Object.keys(porNivel).map(Number).filter((n) => n <= nivel).sort((a, b) => b - a);
  return disponibles.length ? porNivel[disponibles[0]] : null;
}
