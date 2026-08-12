import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

export function VistaSalonHonor() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => { api.fetchSalonDeHonor().then((d) => { setDatos(d); setCargando(false); }); }, []);

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;

  const medalla = (i) => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">🏆 Salón de Honor</h2>
      <p className="text-sm text-slate-400 mb-4">Ranking institucional — cruza todos los grados a la vez.</p>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="font-bold text-slate-800 mb-3">⭐ Más XP acumulada</div>
          {datos.topXp.length === 0 ? (
            <p className="text-xs text-slate-400">Todavía no hay datos.</p>
          ) : (
            <div className="space-y-1.5">
              {datos.topXp.map((e, i) => (
                <div key={e.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm w-6 text-center shrink-0">{medalla(i)}</span>
                    <span className="text-xs font-semibold text-slate-700 truncate">{e.nombre}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">Grado {e.grado_id}</span>
                  </div>
                  <span className="text-xs font-bold text-violet-600 shrink-0">{e.xp} XP</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="font-bold text-slate-800 mb-3">🏅 Más insignias</div>
          {datos.topInsignias.length === 0 ? (
            <p className="text-xs text-slate-400">Todavía no hay insignias desbloqueadas.</p>
          ) : (
            <div className="space-y-1.5">
              {datos.topInsignias.map((e, i) => (
                <div key={e.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm w-6 text-center shrink-0">{medalla(i)}</span>
                    <span className="text-xs font-semibold text-slate-700 truncate">{e.nombre}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">Grado {e.grado_id}</span>
                  </div>
                  <span className="text-xs font-bold text-amber-600 shrink-0">{e.cantidad} 🏅</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="font-bold text-slate-800 mb-3">📜 Muro de logros recientes</div>
        {datos.muroReciente.length === 0 ? (
          <p className="text-xs text-slate-400">Todavía no se desbloqueó ningún logro.</p>
        ) : (
          <div className="space-y-1.5">
            {datos.muroReciente.map((l) => (
              <div key={l.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-lg shrink-0">{l.logro_emoji}</span>
                <div className="text-xs min-w-0">
                  <span className="font-semibold text-slate-700">{l.estudiante_nombre}</span>
                  <span className="text-slate-400"> (Grado {l.grado_id}) desbloqueó </span>
                  <span className="font-semibold text-violet-600">{l.logro_nombre}</span>
                </div>
                <span className="text-[10px] text-slate-400 ml-auto shrink-0">{new Date(l.desbloqueado_en).toLocaleDateString("es-CO")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 
