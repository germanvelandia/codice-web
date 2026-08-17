import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { InclusionModal } from "./Estudiantes";

export function VistaInclusionGeneral() {
  const [estudiantes, setEstudiantes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState("todos"); // "todos" | "piar" | "dua"
  const [query, setQuery] = useState("");
  const [abiertoPara, setAbiertoPara] = useState(null);

  const cargar = () => { setCargando(true); api.fetchEstudiantesEnInclusion().then((d) => { setEstudiantes(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  const visibles = estudiantes
    .filter((e) => filtro === "todos" || (filtro === "piar" && e.piar) || (filtro === "dua" && e.dua))
    .filter((e) => !query.trim() || e.nombre.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-800">🧩 Inclusión — todos los cursos</h2>
        <p className="text-sm text-slate-400">Todos los estudiantes en proceso de inclusión (PIAR o DUA), sin importar el curso — tocá uno para ver o agregar su seguimiento.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="🔍 Buscar por nombre…"
          className="text-sm rounded-full px-4 py-2 border border-slate-200 outline-none flex-1 min-w-[200px]" />
        <div className="flex gap-1 rounded-full bg-white p-1 border border-slate-200">
          <button onClick={() => setFiltro("todos")} className={`text-xs px-3 py-1.5 rounded-full ${filtro === "todos" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Todos ({estudiantes.length})</button>
          <button onClick={() => setFiltro("piar")} className={`text-xs px-3 py-1.5 rounded-full ${filtro === "piar" ? "bg-violet-500 text-white" : "text-slate-600"}`}>PIAR ({estudiantes.filter((e) => e.piar).length})</button>
          <button onClick={() => setFiltro("dua")} className={`text-xs px-3 py-1.5 rounded-full ${filtro === "dua" ? "bg-violet-500 text-white" : "text-slate-600"}`}>DUA ({estudiantes.filter((e) => e.dua).length})</button>
        </div>
      </div>

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : visibles.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">
          {estudiantes.length === 0 ? "Todavía no hay ningún estudiante marcado con PIAR o DUA." : "Ningún estudiante coincide con el filtro."}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibles.map((e) => (
            <button key={e.id} onClick={() => setAbiertoPara(e)} className="bg-white rounded-2xl border border-slate-100 p-3 text-left hover:border-violet-200 hover:shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                {e.foto_url ? (
                  <img src={e.foto_url} alt={e.nombre} className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-xs font-bold">
                    {e.nombre.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-700 truncate">{e.nombre}</div>
                  <div className="text-[11px] text-slate-400">Grado {e.grado_id}</div>
                </div>
              </div>
              <div className="flex gap-1 mt-1.5">
                {e.piar && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">PIAR</span>}
                {e.dua && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">DUA</span>}
              </div>
              {e.ajustes_inclusion && <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2">{e.ajustes_inclusion}</p>}
            </button>
          ))}
        </div>
      )}

      {abiertoPara && (
        <InclusionModal estudiante={abiertoPara} onClose={() => setAbiertoPara(null)} onGuardado={cargar} />
      )}
    </div>
  );
}
