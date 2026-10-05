import React, { useState } from "react";
import PersonajeConMejoras from "./PersonajeConMejoras";
import { InsigniaNivel, CapaEstrellasBanner } from "./NivelPersonaje";
import { NIVELES_PERSONAJE } from "../lib/mejorasPersonaje";
import { PERSONAJES_NIVEL } from "../lib/personajesNivel";

// Vista previa de los 14 personajes en cada uno de los 4 niveles, sin tener que comprar
// nada. Se carga aparte (trae las imágenes de todos los niveles), solo cuando se abre.

const ROLES = [
  { key: "maestro_gremio", emoji: "👑", nombre: "Maestro del Gremio" },
  { key: "heraldo", emoji: "🕊️", nombre: "Heraldo de la Alianza" },
  { key: "peregrino", emoji: "📜", nombre: "Peregrino del Sentido" },
  { key: "cronista", emoji: "🖋️", nombre: "Cronista del Reino" },
  { key: "defensor", emoji: "⚖️", nombre: "Defensor del Pacto" },
  { key: "consejero", emoji: "🏦", nombre: "Consejero Real" },
  { key: "guardian", emoji: "🎨", nombre: "Guardián del Símbolo" },
];
const GENEROS = [{ key: "femenino", etiqueta: "♀ Femenino" }, { key: "masculino", etiqueta: "♂ Masculino" }];

// De dónde sale el dibujo en un nivel: uno propio de ese nivel, uno heredado de un nivel
// menor (mientras no exista el propio), o el dibujo base.
function origenDibujo(rolKey, genero, nivel) {
  const propios = PERSONAJES_NIVEL[rolKey]?.[genero] || {};
  const disponibles = Object.keys(propios).map(Number).filter((n) => n <= nivel).sort((a, b) => b - a);
  if (!disponibles.length) return { tipo: "base" };
  return disponibles[0] === nivel ? { tipo: "propia" } : { tipo: "heredada", de: disponibles[0] };
}

function Celda({ rolKey, genero, nivelInfo, piezas }) {
  // Como ejemplo, se le "ponen" las primeras N piezas del catálogo (N = las que pide ese nivel).
  const elegidas = piezas.slice(0, nivelInfo.desde);
  const equipo = elegidas.filter((p) => p.slot !== "companero").map((p) => ({ emoji: p.emoji, nombre: p.nombre }));
  const companero = elegidas.find((p) => p.slot === "companero")?.emoji || null;
  const origen = origenDibujo(rolKey, genero, nivelInfo.nivel);
  const etiqueta = origen.tipo === "base" ? "dibujo base" : origen.tipo === "propia" ? "variante propia" : `usa la de Nv ${origen.de}`;
  const colorEtiqueta = origen.tipo === "propia" ? "#059669" : origen.tipo === "heredada" ? "#D97706" : "#94A3B8";

  return (
    <div className="min-w-0">
      <div className="relative rounded-xl overflow-hidden flex items-center justify-center"
        style={{ height: 150, background: "linear-gradient(160deg, #223b74 0%, #17264D 55%, #0f1932 100%)" }}>
        <CapaEstrellasBanner nivel={nivelInfo.nivel} />
        {nivelInfo.nivel > 1 && <div className="absolute top-1.5 right-1.5 z-10"><InsigniaNivel nivel={nivelInfo.nivel} nombre={nivelInfo.nombre} color={nivelInfo.color} /></div>}
        <div className="relative z-10">
          <PersonajeConMejoras rolKey={rolKey} genero={genero} size={76} nivel={nivelInfo.nivel} equipo={equipo} companero={companero} />
        </div>
      </div>
      <div className="text-[11px] font-bold text-slate-700 mt-1">Nv {nivelInfo.nivel} · {nivelInfo.nombre}</div>
      <div className="text-[10px] text-slate-400">{nivelInfo.desde === 0 ? "sin piezas" : `${nivelInfo.desde} ${nivelInfo.desde === 1 ? "pieza" : "piezas"}`}</div>
      <div className="text-[10px] font-semibold" style={{ color: colorEtiqueta }}>● {etiqueta}</div>
    </div>
  );
}

export default function VistaNivelesPersonaje({ piezas = [] }) {
  const [rolKey, setRolKey] = useState(ROLES[0].key);
  const rol = ROLES.find((r) => r.key === rolKey);

  // Cuántos de los 14 personajes ya tienen dibujo propio en cada nivel de mejora.
  const avance = NIVELES_PERSONAJE.slice(1).map((n) => ({
    nivel: n.nivel,
    cargados: ROLES.reduce((a, r) => a + GENEROS.filter((g) => PERSONAJES_NIVEL[r.key]?.[g.key]?.[n.nivel]).length, 0),
  }));

  return (
    <div>
      <p className="text-xs text-slate-400 mb-2">
        Así se ve cada personaje en cada nivel. {piezas.length > 0
          ? "Como ejemplo, se le ponen las primeras piezas de tu catálogo."
          : "Todavía no hay piezas en el catálogo, así que solo se ven el brillo y los dibujos."}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {avance.map((a) => (
          <span key={a.nivel} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${a.cargados === 14 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
            Nv {a.nivel}: {a.cargados}/14 dibujos propios
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {ROLES.map((r) => (
          <button key={r.key} type="button" onClick={() => setRolKey(r.key)} title={r.nombre}
            className={`text-xs px-2.5 py-1.5 rounded-full ${r.key === rolKey ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-600"}`}>
            {r.emoji} {r.nombre.split(" ")[0]}
          </button>
        ))}
      </div>

      <h4 className="text-sm font-bold text-slate-800 mb-2">{rol.emoji} {rol.nombre}</h4>
      {GENEROS.map((g) => (
        <div key={g.key} className="mb-4">
          <div className="text-[11px] font-semibold text-slate-500 mb-1">{g.etiqueta}</div>
          <div className="grid grid-cols-4 gap-2">
            {NIVELES_PERSONAJE.map((n) => (
              <Celda key={n.nivel} rolKey={rol.key} genero={g.key} nivelInfo={n} piezas={piezas} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
