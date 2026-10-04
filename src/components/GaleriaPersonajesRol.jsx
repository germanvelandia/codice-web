import React from "react";
import { LISTA_PERSONAJES } from "../lib/personajesRol";

// Galería con los 14 personajes para que el estudiante elija el que más le
// guste, sin importar el rol que le toque jugar en la Comarca — es una
// elección libre y cosmética.
export default function GaleriaPersonajesRol({ elegido, onElegir }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {LISTA_PERSONAJES.map((p) => {
        const esElegido = elegido && elegido.rolKey === p.rolKey && elegido.genero === p.genero;
        return (
          <button key={`${p.rolKey}-${p.genero}`} type="button" onClick={() => onElegir(p.rolKey, p.genero)}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-colors ${esElegido ? "border-violet-500 bg-violet-50" : "border-transparent bg-slate-50 hover:bg-slate-100"}`}>
            <img src={p.src} alt={p.nombre} width={48} height={48} style={{ imageRendering: "pixelated" }} />
            <span className="text-[9px] text-slate-600 text-center leading-tight">{p.nombre}</span>
            <span className="text-[8px] text-slate-400">{p.genero === "femenino" ? "♀" : "♂"}</span>
          </button>
        );
      })}
    </div>
  );
}
