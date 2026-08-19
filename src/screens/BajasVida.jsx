import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { HistorialGamificacionModal } from "./Estudiantes";

export function VistaBajasVida() {
  const [estudiantes, setEstudiantes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [query, setQuery] = useState("");
  const [abiertoPara, setAbiertoPara] = useState(null);

  useEffect(() => {
    api.fetchEstudiantesConBajasVida().then((d) => { setEstudiantes(d); setCargando(false); });
  }, []);

  const visibles = estudiantes.filter((e) => !query.trim() || e.nombre.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-800">📉 Bajas de vida por comportamiento</h2>
        <p className="text-sm text-slate-400">Todos los estudiantes que perdieron vida por alguna acción convivencial/académica negativa, de todos los cursos — tocá uno para ver el detalle completo.</p>
      </div>

      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="🔍 Buscar por nombre…"
        className="text-sm rounded-full px-4 py-2 border border-slate-200 outline-none w-full max-w-sm mb-4" />

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : visibles.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">
          {estudiantes.length === 0 ? "Ningún estudiante tiene bajas de vida registradas todavía." : "Ningún estudiante coincide con la búsqueda."}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibles.map((e) => (
            <button key={e.id} onClick={() => setAbiertoPara(e)} className="bg-white rounded-2xl border border-slate-100 p-3 text-left hover:border-rose-200 hover:shadow-sm">
              <div className="flex items-center gap-2 mb-1.5">
                {e.foto_url ? (
                  <img src={e.foto_url} alt={e.nombre} className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 text-xs font-bold">
                    {e.nombre.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-700 truncate">{e.nombre}</div>
                  <div className="text-[11px] text-slate-400">Grado {e.grado_id}</div>
                </div>
              </div>
              <div className="flex gap-1.5 mb-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-semibold">-{e.totalPerdida} vida en total</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{e.incidentes} incidente(s)</span>
              </div>
              {e.recientes[0] && <p className="text-[11px] text-slate-500">Última: "{e.recientes[0].etiqueta}"</p>}
            </button>
          ))}
        </div>
      )}

      {abiertoPara && <HistorialGamificacionModal estudiante={abiertoPara} onClose={() => setAbiertoPara(null)} />}
    </div>
  );
}
