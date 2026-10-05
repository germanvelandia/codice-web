
// Lista plana de los 14 personajes, para la galería de selección.
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
