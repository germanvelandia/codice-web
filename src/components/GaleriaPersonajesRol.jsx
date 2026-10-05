import React from "react";
import { PERSONAJES_ROL } from "../lib/personajesRol";

// Nombre corto de cada rol, para mostrar debajo de cada personaje.
const NOMBRES_ROL = {
  maestro_gremio: "Maestro del Gremio",
  heraldo: "Heraldo de la Alianza",
  peregrino: "Peregrino del Sentido",
  cronista: "Cronista del Reino",
  defensor: "Defensor del Pacto",
  consejero: "Consejero Real",
  guardian: "Guardián del Símbolo",
};

// Los 14 personajes en una lista plana. Se arma acá a partir de PERSONAJES_ROL
// para que esta galería funcione con cualquier versión de personajesRol.js.
const LISTA = Object.entries(PERSONAJES_ROL).flatMap(([rolKey, generos]) =>
  Object.entries(generos).map(([genero, src]) => ({ rolKey, genero, src, nombre: NOMBRES_ROL[rolKey] || rolKey }))
);

// Galería con los 14 personajes para elegir uno, sin importar el rol que le toque
// jugar en la Comarca — es una elección libre y cosmética.
export default function GaleriaPersonajesRol({ elegido, onElegir }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {LISTA.map((p) => {
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
