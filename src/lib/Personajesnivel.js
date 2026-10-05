// Variantes DIBUJADAS de cada personaje según su nivel (opcional).
//
// Mientras este objeto esté vacío, todos los niveles usan el dibujo base y la mejora
// se nota con el brillo, el fondo, los íconos de equipo y el compañero. Si más
// adelante se generan imágenes mejoradas (por ejemplo en PixelLab), se agregan acá:
//
//   PERSONAJES_NIVEL = {
//     defensor: { femenino: { 3: "data:image/png;base64,...", 4: "data:image/png;base64,..." } },
//   }
//
// y se usan solas: para el nivel N se toma la variante del nivel más alto
// disponible que no lo supere; si no hay ninguna, se usa el dibujo base.
export const PERSONAJES_NIVEL = {};

export function imagenConNivel(rolKey, genero, nivel) {
  const porNivel = PERSONAJES_NIVEL[rolKey]?.[genero];
  if (!porNivel) return null;
  const disponibles = Object.keys(porNivel).map(Number).filter((n) => n <= nivel).sort((a, b) => b - a);
  return disponibles.length ? porNivel[disponibles[0]] : null;
}
