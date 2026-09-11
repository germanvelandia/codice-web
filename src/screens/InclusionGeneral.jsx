import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { InclusionModal } from "./Estudiantes";

// Vista imprimible con todos los datos del proceso de inclusión de cada
// estudiante: PIAR/DUA, ajustes acordados, y toda la bitácora de seguimiento.
function ReporteInclusionImprimible({ estudiantes, seguimientosPorEstudiante, institucion }) {
  return (
    <div className="print-only" style={{ maxWidth: 900, margin: "0 auto", padding: 28, fontFamily: "Georgia, serif", color: "#1e293b" }}>
      <div style={{ textAlign: "center", marginBottom: 24, borderBottom: "2px solid #7C3AED", paddingBottom: 12 }}>
        {institucion?.logo_url && <img src={institucion.logo_url} alt="" style={{ height: 56, margin: "0 auto 8px" }} />}
        <div style={{ fontSize: 18, fontWeight: "bold" }}>{institucion?.nombre || "Institución Educativa"}</div>
        <div style={{ fontSize: 14, color: "#7C3AED", fontWeight: "bold", marginTop: 4 }}>🧩 Reporte del Proceso de Inclusión</div>
        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{estudiantes.length} estudiante(s) · Generado el {new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}</div>
      </div>

      {estudiantes.map((e) => {
        const seguimientos = seguimientosPorEstudiante[e.id] || [];
        return (
          <div key={e.id} className="print-avoid-break" style={{ marginBottom: 26, border: "1px solid #E2E8F0", borderRadius: 8, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: "bold" }}>{e.nombre}</div>
                <div style={{ fontSize: 11, color: "#64748B" }}>Grado {e.grado_id}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {e.piar && <span style={{ fontSize: 10, fontWeight: "bold", padding: "2px 8px", borderRadius: 10, background: "#EDE9FE", color: "#7C3AED" }}>PIAR</span>}
                {e.dua && <span style={{ fontSize: 10, fontWeight: "bold", padding: "2px 8px", borderRadius: 10, background: "#DBEAFE", color: "#1D4ED8" }}>DUA</span>}
              </div>
            </div>

            {e.ajustes_inclusion && (
              <div style={{ fontSize: 11, background: "#F8FAFC", borderRadius: 6, padding: 8, marginBottom: 8 }}>
                <b>Ajustes razonables / apoyos acordados:</b> {e.ajustes_inclusion}
              </div>
            )}

            <div style={{ fontSize: 11, fontWeight: "bold", color: "#475569", marginBottom: 4 }}>Bitácora de seguimiento ({seguimientos.length})</div>
            {seguimientos.length === 0 ? (
              <div style={{ fontSize: 10, color: "#94A3B8" }}>Sin registros de seguimiento todavía.</div>
            ) : (
              <table style={{ width: "100%", fontSize: 10, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #E2E8F0" }}>
                    <th style={{ padding: "3px 4px" }}>Fecha</th>
                    <th style={{ padding: "3px 4px" }}>Tipo</th>
                    <th style={{ padding: "3px 4px" }}>Materia</th>
                    <th style={{ padding: "3px 4px" }}>Docente</th>
                    <th style={{ padding: "3px 4px" }}>Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {seguimientos.map((s) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "3px 4px", whiteSpace: "nowrap" }}>{s.fecha ? new Date(s.fecha).toLocaleDateString("es-CO") : "—"}</td>
                      <td style={{ padding: "3px 4px" }}>{s.tipo}</td>
                      <td style={{ padding: "3px 4px" }}>{s.materias?.nombre || "—"}</td>
                      <td style={{ padding: "3px 4px" }}>{s.profesores?.nombre || "—"}</td>
                      <td style={{ padding: "3px 4px" }}>{s.observacion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function VistaInclusionGeneral() {
  const [estudiantes, setEstudiantes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState("todos"); // "todos" | "piar" | "dua"
  const [query, setQuery] = useState("");
  const [abiertoPara, setAbiertoPara] = useState(null);
  const [institucion, setInstitucion] = useState(null);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [seguimientosImpresion, setSeguimientosImpresion] = useState({});
  const [preparandoImpresion, setPreparandoImpresion] = useState(false);

  const cargar = () => { setCargando(true); api.fetchEstudiantesEnInclusion().then((d) => { setEstudiantes(d); setCargando(false); }); };
  useEffect(() => { cargar(); api.fetchInstitucion().then(setInstitucion); }, []);

  useEffect(() => {
    if (!imprimiendo) return;
    const id = setTimeout(() => window.print(), 150);
    const onAfter = () => setImprimiendo(false);
    window.addEventListener("afterprint", onAfter);
    return () => { clearTimeout(id); window.removeEventListener("afterprint", onAfter); };
  }, [imprimiendo]);

  const visibles = estudiantes
    .filter((e) => filtro === "todos" || (filtro === "piar" && e.piar) || (filtro === "dua" && e.dua))
    .filter((e) => !query.trim() || e.nombre.toLowerCase().includes(query.trim().toLowerCase()));

  const imprimir = async () => {
    if (visibles.length === 0) { alert("No hay estudiantes para imprimir con el filtro actual."); return; }
    setPreparandoImpresion(true);
    try {
      const seguimientos = await api.fetchSeguimientosInclusionMultiples(visibles.map((e) => e.id));
      setSeguimientosImpresion(seguimientos);
      setImprimiendo(true);
    } catch (e) {
      alert("Error al preparar la impresión: " + e.message);
    }
    setPreparandoImpresion(false);
  };

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🧩 Inclusión — todos los cursos</h2>
          <p className="text-sm text-slate-400">Todos los estudiantes en proceso de inclusión (PIAR o DUA), sin importar el curso — tocá uno para ver o agregar su seguimiento.</p>
        </div>
        <button disabled={preparandoImpresion} onClick={imprimir} className="text-xs font-semibold px-3 py-2 rounded-full bg-violet-500 text-white disabled:opacity-60 shrink-0">
          {preparandoImpresion ? "Preparando…" : "🖨️ Imprimir todo (con el filtro actual)"}
        </button>
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

      {imprimiendo && (
        <ReporteInclusionImprimible estudiantes={visibles} seguimientosPorEstudiante={seguimientosImpresion} institucion={institucion} />
      )}
    </div>
  );
}
