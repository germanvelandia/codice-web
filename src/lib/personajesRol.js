import React from "react";
import { imagenPersonajeRol } from "../lib/personajesRol";

// Ilustración de personaje (estilo RPG pixel art) para un rol de la Comarca,
// en vez del simple emoji — por ahora solo en pose quieta (sin caminar).
export function PersonajeRol({ rolKey, genero = "masculino", size = 48, className = "" }) {
  const src = imagenPersonajeRol(rolKey, genero);
  if (!src) return null;
  return (
    <img src={src} alt="" width={size} height={size}
      style={{ imageRendering: "pixelated", width: size, height: size }}
      className={className} />
  );
}

// React.lazy() exige que el componente venga como export "default" — se
// mantiene también el export con nombre de arriba, por si algo más lo
// importa de la forma de siempre (sin carga diferida).
export default PersonajeRol;
