import React from "react";
import { imagenPersonajeRol } from "../lib/personajesRol";
import { imagenConNivel } from "../lib/personajesNivel";
import { NIVELES_PERSONAJE } from "../lib/mejorasPersonaje";
import { asegurarEstilosNivel } from "./NivelPersonaje";

// El personaje (uno de los 14) con todo lo que lo hace crecer a medida que compra
// piezas: brillo detrás (bronce, plata, oro según el nivel), íconos del equipo que
// tiene puesto a un costado, y su compañero al otro lado.
//   equipo    -> [{ emoji, nombre }]
//   companero -> emoji (o null)
// Si no hay personaje (rolKey vacío) se muestra un 🎓, pero igual con el brillo y el equipo.
export default function PersonajeConMejoras({ rolKey, genero = "masculino", size = 92, nivel = 1, equipo = [], companero = null }) {
  asegurarEstilosNivel();
  const colorAura = NIVELES_PERSONAJE.find((n) => n.nivel === nivel)?.color || null;
  // Si hay una variante dibujada para este nivel se usa; si no, el dibujo base.
  const src = rolKey ? (imagenConNivel(rolKey, genero, nivel) || imagenPersonajeRol(rolKey, genero)) : null;
  const icono = Math.max(12, Math.round(size * 0.16));
  const chip = icono + 8;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {colorAura && (
        <div aria-hidden className="codice-anim absolute rounded-full" style={{
          top: "-14%", left: "-14%", right: "-14%", bottom: "-14%",
          background: `radial-gradient(circle, ${colorAura}B3 0%, ${colorAura}4D 42%, transparent 70%)`,
          animation: "codicePulso 3s ease-in-out infinite",
        }} />
      )}
      {src ? (
        <img src={src} alt="" width={size} height={size} style={{ imageRendering: "pixelated", width: size, height: size, position: "relative" }} />
      ) : (
        <span style={{ fontSize: size * 0.55, position: "relative", lineHeight: 1 }}>🎓</span>
      )}
      {equipo.length > 0 && (
        <div className="absolute flex flex-col flex-wrap justify-center" style={{ right: "100%", top: 0, height: size, marginRight: 6, gap: 3, alignContent: "flex-end" }}>
          {equipo.slice(0, 6).map((p, i) => (
            <span key={i} title={p.nombre} style={{
              width: chip, height: chip, fontSize: icono, borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(255,255,255,0.9)", boxShadow: "0 1px 3px rgba(0,0,0,0.35)", lineHeight: 1,
            }}>{p.emoji}</span>
          ))}
        </div>
      )}
      {companero && (
        <span className="codice-anim absolute" style={{ left: "100%", bottom: 0, marginLeft: 2, fontSize: Math.round(size * 0.34), lineHeight: 1, animation: "codiceFlota 2.2s ease-in-out infinite", filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.4))" }}>{companero}</span>
      )}
    </div>
  );
}
