// Temporal: agrega LISTA_PERSONAJES sin tocar el archivo grande de imágenes.
// Vite busca "personajesRol.mjs" antes que "personajesRol.js", así que todos los
// que importan "../lib/personajesRol" pasan por acá y reciben todo lo de siempre
// (PERSONAJES_ROL, imagenPersonajeRol…) más LISTA_PERSONAJES.
export * from "./personajesRol.js";
import { PERSONAJES_ROL } from "./personajesRol.js";

const NOMBRES_PARA_GALERIA = {
  maestro_gremio: "Maestro del Gremio",
  heraldo: "Heraldo de la Alianza",
  peregrino: "Peregrino del Sentido",
  cronista: "Cronista del Reino",
  defensor: "Defensor del Pacto",
  consejero: "Consejero Real",
  guardian: "Guardián del Símbolo",
};

export const LISTA_PERSONAJES = Object.entries(PERSONAJES_ROL).flatMap(([rolKey, generos]) =>
  Object.entries(generos).map(([genero, src]) => ({ rolKey, genero, src, nombre: NOMBRES_PARA_GALERIA[rolKey] || rolKey }))
);
