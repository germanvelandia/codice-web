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
