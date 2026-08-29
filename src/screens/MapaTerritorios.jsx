import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { nextLevel } from "../lib/gamification";
import { PersonajePreview } from "./Personaje";

const NOTA_MINIMA_DEFAULT = 3.5;

const statusStyles = {
  conquered: { box: "bg-emerald-50 border-emerald-400 text-emerald-900", label: "text-emerald-700", icon: "🏰" },
  available: { box: "bg-amber-50 border-amber-400 text-amber-900 animate-pulse", label: "text-amber-700", icon: "⚔️" },
  locked: { box: "bg-slate-100 border-slate-300 text-slate-400", label: "text-slate-400", icon: "🔒" },
};

function TerritoryBox({ territory, onSelect }) {
  const style = statusStyles[territory.status] ?? statusStyles.locked;
  const clickable = territory.status !== "locked";
  return (
    <button type="button" disabled={!clickable} onClick={() => clickable && onSelect?.(territory)}
      className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 px-3 py-6 w-28 h-28 shrink-0 transition-transform ${style.box} ${clickable ? "hover:scale-105 cursor-pointer" : "cursor-not-allowed"}`}>
      <span className="text-2xl" aria-hidden="true">{style.icon}</span>
      <span className={`text-xs font-medium text-center ${style.label}`}>{territory.name}</span>
      {territory.nota != null && <span className="text-[10px] text-slate-400">{territory.nota.toFixed(1)}</span>}
    </button>
  );
}

function XPBar({ xp, xpToNextLevel, xpDesdeNivel }) {
  const pct = xpToNextLevel ? Math.min(100, Math.round((xpDesdeNivel / xpToNextLevel) * 100)) : 100;
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>XP</span>
        <span>{xp}{xpToNextLevel ? ` (${xpDesdeNivel}/${xpToNextLevel} para subir)` : ""}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full rounded-full bg-violet-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TerritoryMap({ student, avatarConfig, territories, onSelectTerritory }) {
  const conqueredCount = territories.filter((t) => t.status === "conquered").length;
  return (
    <section className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center gap-3 mb-4">
        {avatarConfig ? (
          <div className="shrink-0"><PersonajePreview config={avatarConfig} size={48} /></div>
        ) : (
          <div className="w-12 h-12 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-semibold shrink-0">{student.avatarInitials}</div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900 truncate">{student.name}</p>
          <p className="text-sm text-slate-500">Nivel {student.level}</p>
        </div>
        <div className="w-40 shrink-0">
          <XPBar xp={student.xp} xpToNextLevel={student.xpToNextLevel} xpDesdeNivel={student.xpDesdeNivel} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500">Territorios</p>
          <p className="text-lg font-semibold text-slate-900">{conqueredCount} / {territories.length}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500">Insignias</p>
          <p className="text-lg font-semibold text-slate-900">{student.insignias}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500">Por conquistar</p>
          <p className="text-lg font-semibold text-slate-900">{territories.filter((t) => t.status === "available").length}</p>
        </div>
      </div>

      <p className="text-sm font-medium text-slate-700 mb-3">🗺️ Mapa de tu aventura</p>
      {territories.length === 0 ? (
        <p className="text-xs text-slate-400">Todavía no hay materias con datos para mostrar acá.</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {territories.map((t) => <TerritoryBox key={t.id} territory={t} onSelect={onSelectTerritory} />)}
        </div>
      )}
    </section>
  );
}

// Wrapper que trae los datos reales del estudiante (notas por materia,
// insignias, nivel/XP, personaje) y arma el mapa — nada de datos de ejemplo.
export function MapaTerritoriosEstudiante({ estudianteId, nombre, xp }) {
  const [territories, setTerritories] = useState([]);
  const [insignias, setInsignias] = useState(0);
  const [avatarConfig, setAvatarConfig] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState(null);

  useEffect(() => {
    Promise.all([
      api.fetchNotasEstudiante(estudianteId),
      api.fetchLogrosEstudiante(estudianteId),
      api.fetchAvatarConfigsMultiples([estudianteId]),
    ]).then(([notas, logros, avatares]) => {
      // Por materia, usa el periodo más reciente con nota final registrada
      // como "estado actual" de ese territorio.
      const porMateria = {};
      notas.finales.forEach((f) => {
        const nombreMateria = f.materias?.nombre || `Materia ${f.materia_id}`;
        const actual = porMateria[nombreMateria];
        if (!actual || f.periodo > actual.periodo) porMateria[nombreMateria] = { periodo: f.periodo, nota: f.nota, id: f.materia_id };
      });
      const territorios = Object.entries(porMateria).map(([nombreMateria, info]) => ({
        id: info.id, name: nombreMateria, nota: info.nota,
        status: info.nota >= NOTA_MINIMA_DEFAULT ? "conquered" : "available",
      }));
      setTerritories(territorios);
      setInsignias(logros.length);
      setAvatarConfig(avatares[estudianteId] || null);
      setCargando(false);
    });
  }, [estudianteId]);

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;

  const { level, next, pct } = nextLevel(xp || 0);
  const xpDesdeNivel = (xp || 0) - level.min;
  const xpParaSubir = next ? next.min - level.min : 0;

  return (
    <TerritoryMap
      student={{ name: nombre, avatarInitials: (nombre || "?").slice(0, 2).toUpperCase(), level: level.name, xp: xp || 0, xpDesdeNivel, xpToNextLevel: xpParaSubir, insignias }}
      avatarConfig={avatarConfig}
      territories={territories}
      onSelectTerritory={setSeleccionado}
    />
  );
}
