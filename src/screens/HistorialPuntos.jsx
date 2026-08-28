import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

const INFO_TIPO = {
  xp: { icono: "⭐", label: "Experiencia" },
  monedas: { icono: "🪙", label: "Monedas" },
  vida: { icono: "❤️", label: "Vida" },
};

export function HistorialPuntosEstudiante({ estudianteId }) {
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState("todos"); // "todos" | "buenos" | "malos"

  useEffect(() => { api.fetchHistorialPuntos(estudianteId).then((d) => { setHistorial(d); setCargando(false); }); }, [estudianteId]);

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;

  const visibles = historial.filter((h) => {
    if (filtro === "buenos") return h.delta > 0;
    if (filtro === "malos") return h.delta < 0;
    return true;
  });

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">📖 Historial de Puntos</h3>
      <p className="text-xs text-slate-400 mb-3">Acá vas a ver cada vez que te dieron o te quitaron puntos en clase, y por qué.</p>

      <div className="flex gap-1 rounded-full bg-slate-100 p-1 mb-3 w-fit">
        <button onClick={() => setFiltro("todos")} className={`text-xs px-3 py-1.5 rounded-full ${filtro === "todos" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Todos</button>
        <button onClick={() => setFiltro("buenos")} className={`text-xs px-3 py-1.5 rounded-full ${filtro === "buenos" ? "bg-emerald-500 text-white" : "text-slate-600"}`}>✅ Buenos</button>
        <button onClick={() => setFiltro("malos")} className={`text-xs px-3 py-1.5 rounded-full ${filtro === "malos" ? "bg-rose-500 text-white" : "text-slate-600"}`}>⚠️ Para mejorar</button>
      </div>

      {visibles.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">
          {filtro === "todos" ? "Todavía no hay nada registrado acá." : filtro === "buenos" ? "Todavía no hay puntos buenos registrados." : "No tenés puntos negativos registrados — ¡seguí así!"}
        </div>
      ) : (
        <div className="space-y-1.5">
          {visibles.map((h) => {
            const info = INFO_TIPO[h.tipo] || { icono: "•", label: h.tipo };
            const esBueno = h.delta > 0;
            return (
              <div key={h.id} className={`rounded-xl px-3 py-2.5 border ${esBueno ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-base shrink-0">{info.icono}</span>
                    <span className={`text-sm font-bold shrink-0 ${esBueno ? "text-emerald-600" : "text-rose-600"}`}>{esBueno ? "+" : ""}{h.delta} {info.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">{new Date(h.creado_en).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</span>
                </div>
                {h.motivo && <p className="text-xs text-slate-600 mt-1">{h.motivo}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
