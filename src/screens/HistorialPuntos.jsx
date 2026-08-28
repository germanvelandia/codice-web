import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

export function HistorialPuntosEstudiante({ estudianteId }) {
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState("todos"); // "todos" | "buenos" | "malos"

  useEffect(() => { api.fetchHistorialGamificacion(estudianteId).then((d) => { setHistorial(d); setCargando(false); }); }, [estudianteId]);

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;

  // "Bueno" si suma algo positivo en algún aspecto; "malo" si resta algo,
  // sin contar como malo un simple gasto de monedas en la tienda.
  const esBueno = (h) => (h.xp || 0) > 0 || (h.vida || 0) > 0 || (h.monedas || 0) > 0;
  const esMalo = (h) => (h.xp || 0) < 0 || (h.vida || 0) < 0;

  const visibles = historial.filter((h) => {
    if (filtro === "buenos") return esBueno(h) && !esMalo(h);
    if (filtro === "malos") return esMalo(h);
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
            const malo = esMalo(h);
            return (
              <div key={h.id} className={`rounded-xl px-3 py-2.5 border ${malo ? "bg-rose-50 border-rose-100" : "bg-emerald-50 border-emerald-100"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    {!!h.xp && <span className={`text-xs font-bold shrink-0 ${h.xp > 0 ? "text-emerald-600" : "text-rose-600"}`}>⭐ {h.xp > 0 ? "+" : ""}{h.xp} XP</span>}
                    {!!h.vida && <span className={`text-xs font-bold shrink-0 ${h.vida > 0 ? "text-emerald-600" : "text-rose-600"}`}>❤️ {h.vida > 0 ? "+" : ""}{h.vida} Vida</span>}
                    {!!h.monedas && <span className={`text-xs font-bold shrink-0 ${h.monedas > 0 ? "text-emerald-600" : "text-rose-600"}`}>🪙 {h.monedas > 0 ? "+" : ""}{h.monedas} Monedas</span>}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">{new Date(h.ts).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</span>
                </div>
                {h.etiqueta && <p className="text-xs text-slate-600 mt-1">{h.etiqueta}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
