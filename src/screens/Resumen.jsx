import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import * as api from "../lib/api";

function ResumenPrintView({ datos, institucion, observaciones, onCerrado }) {
  useEffect(() => {
    const id = setTimeout(() => window.print(), 150);
    const onAfter = () => onCerrado();
    window.addEventListener("afterprint", onAfter);
    return () => { clearTimeout(id); window.removeEventListener("afterprint", onAfter); };
  }, []);

  const { estudiante, materias, periodos, notasPorMateriaPeriodo, anotaciones, asistencia, progreso, logros } = datos;

  const contenido = (
    <div className="print-only" style={{ maxWidth: 800, margin: "0 auto", padding: 24, fontFamily: "Arial, sans-serif", fontSize: 11, color: "#111" }}>
      <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 10 }}>
        <div style={{ fontWeight: "bold", fontSize: 14 }}>{institucion?.nombre || "INSTITUCIÓN EDUCATIVA"}</div>
        <div style={{ fontWeight: "bold", marginTop: 4 }}>RESUMEN INTEGRAL DEL ESTUDIANTE</div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: "1px solid #000", padding: 4, fontWeight: "bold", width: "20%" }}>Nombre</td>
            <td style={{ border: "1px solid #000", padding: 4 }} colSpan={3}>{estudiante.nombre}</td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #000", padding: 4, fontWeight: "bold" }}>Curso</td>
            <td style={{ border: "1px solid #000", padding: 4 }}>{estudiante.grado_id}</td>
            <td style={{ border: "1px solid #000", padding: 4, fontWeight: "bold" }}>Documento</td>
            <td style={{ border: "1px solid #000", padding: 4 }}>{estudiante.documento || "—"}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontWeight: "bold", marginBottom: 4 }}>NOTAS POR PERIODO</div>
      {materias.length === 0 ? (
        <p style={{ marginBottom: 10 }}>Sin notas registradas todavía.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #000", padding: 4, textAlign: "left" }}>Materia</th>
              {periodos.map((p) => <th key={p} style={{ border: "1px solid #000", padding: 4 }}>Periodo {p}</th>)}
            </tr>
          </thead>
          <tbody>
            {materias.map((m) => (
              <tr key={m.id}>
                <td style={{ border: "1px solid #000", padding: 4 }}>{m.nombre}</td>
                {periodos.map((p) => <td key={p} style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>{notasPorMateriaPeriodo[m.id]?.[p] ?? "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ fontWeight: "bold", marginBottom: 4 }}>ASISTENCIA</div>
      <p style={{ marginBottom: 12 }}>
        Presentes: {asistencia.P} · Retardos: {asistencia.R} · Faltas injustificadas: {asistencia.FI} · Faltas justificadas: {asistencia.FJ} · % Asistencia: {asistencia.pct !== null ? `${asistencia.pct}%` : "—"}
      </p>

      <div style={{ fontWeight: "bold", marginBottom: 4 }}>GAMIFICACIÓN</div>
      <p style={{ marginBottom: 12 }}>XP: {progreso.xp} · Vida: {progreso.vida} · Monedas: {progreso.monedas} · Insignias desbloqueadas: {logros.length}</p>

      <div style={{ fontWeight: "bold", marginBottom: 4 }}>ANOTACIONES ACADÉMICAS Y CONVIVENCIALES (del docente que genera este resumen)</div>
      {anotaciones.length === 0 ? (
        <p style={{ marginBottom: 12 }}>Sin anotaciones registradas.</p>
      ) : (
        <div style={{ marginBottom: 12 }}>
          {anotaciones.map((a) => (
            <div key={a.id} style={{ border: "1px solid #ccc", padding: 5, marginBottom: 4 }}>
              <div style={{ fontSize: 9, color: "#555" }}>{a.fecha} · {a.categoria === "academico" ? "Académico" : "Convivencial"}</div>
              <div style={{ whiteSpace: "pre-line" }}>{a.contenido}</div>
            </div>
          ))}
        </div>
      )}

      {observaciones && (
        <>
          <div style={{ fontWeight: "bold", marginBottom: 4 }}>OBSERVACIONES ADICIONALES</div>
          <div style={{ border: "1px solid #000", minHeight: 40, padding: 6, whiteSpace: "pre-line", marginBottom: 12 }}>{observaciones}</div>
        </>
      )}

      <div style={{ fontSize: 9, color: "#666", borderTop: "1px solid #999", paddingTop: 6, marginTop: 20 }}>
        Generado el {new Date().toLocaleDateString("es-CO")}
      </div>
    </div>
  );

  return createPortal(contenido, document.body);
}

export function ResumenEstudianteModal({ estudiante, onClose }) {
  const [datos, setDatos] = useState(null);
  const [institucion, setInstitucion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [observaciones, setObservaciones] = useState("");
  const [imprimiendo, setImprimiendo] = useState(false);

  useEffect(() => {
    Promise.all([api.fetchResumenEstudiante(estudiante.id), api.fetchInstitucion()]).then(([d, i]) => {
      setDatos(d); setInstitucion(i); setCargando(false);
    });
  }, [estudiante.id]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 no-print" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">📊 Resumen — {estudiante.nombre}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-xs font-semibold text-slate-500 mb-1">Asistencia</div>
                <div className="text-xs text-slate-600">P: {datos.asistencia.P} · R: {datos.asistencia.R} · FI: {datos.asistencia.FI} · FJ: {datos.asistencia.FJ}</div>
                <div className="text-sm font-bold text-violet-600 mt-1">{datos.asistencia.pct !== null ? `${datos.asistencia.pct}%` : "—"}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-xs font-semibold text-slate-500 mb-1">Gamificación</div>
                <div className="text-xs text-slate-600">XP: {datos.progreso.xp} · Vida: {datos.progreso.vida} · 🪙 {datos.progreso.monedas}</div>
                <div className="text-sm font-bold text-amber-600 mt-1">{datos.logros.length} insignias</div>
              </div>
            </div>

            <div className="text-xs font-semibold text-slate-600 mb-1">Notas por periodo</div>
            {datos.materias.length === 0 ? (
              <p className="text-xs text-slate-400 mb-3">Sin notas registradas.</p>
            ) : (
              <div className="overflow-x-auto mb-3">
                <table className="w-full text-xs border border-slate-100 rounded-lg">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left px-2 py-1">Materia</th>
                      {datos.periodos.map((p) => <th key={p} className="px-2 py-1">P{p}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {datos.materias.map((m) => (
                      <tr key={m.id} className="odd:bg-white even:bg-slate-50">
                        <td className="px-2 py-1">{m.nombre}</td>
                        {datos.periodos.map((p) => <td key={p} className="text-center px-2 py-1">{datos.notasPorMateriaPeriodo[m.id]?.[p] ?? "—"}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="text-xs font-semibold text-slate-600 mb-1">Tus anotaciones ({datos.anotaciones.length})</div>
            {datos.anotaciones.length === 0 ? (
              <p className="text-xs text-slate-400 mb-3">Sin anotaciones.</p>
            ) : (
              <div className="space-y-1.5 mb-3 max-h-32 overflow-y-auto">
                {datos.anotaciones.map((a) => (
                  <div key={a.id} className="bg-slate-50 rounded-lg p-2 text-xs">
                    <span className="text-slate-400">{a.fecha} · {a.categoria === "academico" ? "📘" : "🤝"}</span>
                    <p className="text-slate-600 mt-0.5">{a.contenido}</p>
                  </div>
                ))}
              </div>
            )}

            <label className="text-xs font-semibold text-slate-600 block mb-1">Observaciones adicionales (opcional, para incluir al imprimir)</label>
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3}
              className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />

            <button onClick={() => setImprimiendo(true)} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white">
              🖨️ Imprimir / Guardar como PDF
            </button>
          </>
        )}
      </div>

      {imprimiendo && (
        <ResumenPrintView datos={datos} institucion={institucion} observaciones={observaciones} onCerrado={() => setImprimiendo(false)} />
      )}
    </div>
  );
}
