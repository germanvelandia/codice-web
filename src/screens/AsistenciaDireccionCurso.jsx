import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { ordenarPorApellido } from "../lib/gamification";

const CODIGOS = [
  { code: "P", label: "Presente", color: "bg-emerald-500", light: "bg-emerald-50 text-emerald-700" },
  { code: "R", label: "Retardo", color: "bg-amber-500", light: "bg-amber-50 text-amber-700" },
  { code: "FI", label: "Falta injustificada", color: "bg-rose-500", light: "bg-rose-50 text-rose-700" },
  { code: "FJ", label: "Falta justificada", color: "bg-blue-500", light: "bg-blue-50 text-blue-700" },
];

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function imprimirReporteAsistencia(gradoId, fechaDesde, fechaHasta, totales, institucion) {
  const filas = totales.map((t) => {
    const pct = t.total > 0 ? Math.round((t.P / t.total) * 100) : 0;
    return `<tr><td style="border:1px solid #000;padding:4px;">${t.nombre}</td><td style="border:1px solid #000;padding:4px;text-align:center;">${t.P}</td><td style="border:1px solid #000;padding:4px;text-align:center;">${t.R}</td><td style="border:1px solid #000;padding:4px;text-align:center;">${t.FI}</td><td style="border:1px solid #000;padding:4px;text-align:center;">${t.FJ}</td><td style="border:1px solid #000;padding:4px;text-align:center;font-weight:bold;">${pct}%</td></tr>`;
  }).join("");
  const ventana = window.open("", "_blank");
  ventana.document.write(`
    <html><head><title>Asistencia institucional — Curso ${gradoId}</title></head>
    <body style="font-family: Arial, sans-serif; padding: 30px; font-size: 13px;">
      <div style="display:flex; align-items:center; gap:12px; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:16px;">
        ${institucion?.logo_url ? `<img src="${institucion.logo_url}" style="height:55px;" />` : ""}
        <div style="flex:1; text-align:center;">
          <div style="font-weight:bold; font-size:15px;">${institucion?.nombre || "INSTITUCIÓN EDUCATIVA"}</div>
          <div style="font-weight:bold; margin-top:4px; font-size:13px;">REPORTE DE ASISTENCIA — CURSO ${gradoId}</div>
          <div style="font-size:11px;">${fechaDesde || "…"} a ${fechaHasta || "…"}</div>
        </div>
      </div>
      <table style="width:100%; border-collapse:collapse;">
        <thead><tr>
          <th style="border:1px solid #000;padding:4px;text-align:left;">Estudiante</th>
          <th style="border:1px solid #000;padding:4px;">P</th>
          <th style="border:1px solid #000;padding:4px;">R</th>
          <th style="border:1px solid #000;padding:4px;">FI</th>
          <th style="border:1px solid #000;padding:4px;">FJ</th>
          <th style="border:1px solid #000;padding:4px;">% Asistencia</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <script>window.print();</script>
    </body></html>
  `);
  ventana.document.close();
}

export function AsistenciaDireccionCurso({ gradoId, institucion }) {
  const [vista, setVista] = useState("marcar"); // "marcar" | "reporte"
  const [estudiantes, setEstudiantes] = useState([]);
  const [fecha, setFecha] = useState(hoyISO());
  const [registrosDia, setRegistrosDia] = useState({});
  const [cargando, setCargando] = useState(true);
  const [guardandoId, setGuardandoId] = useState(null);

  const [fechaDesde, setFechaDesde] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
  const [fechaHasta, setFechaHasta] = useState(hoyISO());
  const [totales, setTotales] = useState([]);
  const [cargandoReporte, setCargandoReporte] = useState(false);

  useEffect(() => {
    if (!gradoId) return;
    api.fetchEstudiantesPorGrado(gradoId).then((data) => setEstudiantes(ordenarPorApellido(data)));
  }, [gradoId]);

  const cargarDia = () => {
    if (estudiantes.length === 0) return;
    setCargando(true);
    api.fetchAsistenciaFecha(estudiantes.map((e) => e.id), fecha, null).then((data) => {
      const mapa = {}; (data || []).forEach((r) => { mapa[r.estudiante_id] = r; });
      setRegistrosDia(mapa);
      setCargando(false);
    });
  };
  useEffect(() => { if (vista === "marcar") cargarDia(); }, [estudiantes, fecha, vista]);

  const marcar = async (estudianteId, codigo) => {
    setGuardandoId(estudianteId);
    const actual = registrosDia[estudianteId];
    try {
      if (actual && actual.codigo === codigo) await api.quitarAsistencia(estudianteId, fecha, null);
      else await api.marcarAsistencia(estudianteId, fecha, codigo, null, null);
      cargarDia();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setGuardandoId(null);
  };

  const marcarTodosPresentes = async () => {
    await api.marcarTodosPresentes(estudiantes.map((e) => e.id), fecha, null);
    cargarDia();
  };

  const cargarReporte = () => {
    setCargandoReporte(true);
    api.fetchTotalesAsistenciaInstitucionalCurso(gradoId, fechaDesde, fechaHasta).then((d) => { setTotales(d); setCargandoReporte(false); });
  };
  useEffect(() => { if (vista === "reporte") cargarReporte(); }, [gradoId, vista]);

  return (
    <div>
      <p className="text-sm text-slate-500 mb-3">
        Asistencia al colegio en general (no de una materia puntual) — útil para llevar el control con los padres de familia, aunque el estudiante no tenga clase con vos.
      </p>

      <div className="flex gap-1 rounded-full bg-slate-100 p-1 w-fit mb-4">
        <button onClick={() => setVista("marcar")} className={`text-xs px-3 py-1.5 rounded-full ${vista === "marcar" ? "bg-violet-500 text-white" : "text-slate-600"}`}>✅ Marcar el día</button>
        <button onClick={() => setVista("reporte")} className={`text-xs px-3 py-1.5 rounded-full ${vista === "reporte" ? "bg-violet-500 text-white" : "text-slate-600"}`}>📊 Reporte</button>
      </div>

      {vista === "marcar" ? (
        <div>
          <div className="flex flex-wrap gap-2 items-center mb-3">
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none" />
            <button onClick={marcarTodosPresentes} className="text-xs font-semibold px-3 py-2 rounded-full bg-emerald-500 text-white">✅ Marcar todos Presentes</button>
          </div>
          {cargando ? (
            <div className="text-sm text-slate-400">Cargando…</div>
          ) : (
            <div className="space-y-1.5">
              {estudiantes.map((e) => {
                const reg = registrosDia[e.id];
                return (
                  <div key={e.id} className="flex items-center justify-between bg-white rounded-xl border border-slate-100 px-3 py-2">
                    <span className="text-sm font-medium text-slate-700">{e.nombre}</span>
                    <div className="flex gap-1.5">
                      {CODIGOS.map((c) => (
                        <button key={c.code} disabled={guardandoId === e.id} onClick={() => marcar(e.id, c.code)}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${reg?.codigo === c.code ? `${c.color} text-white` : `${c.light}`}`}>
                          {c.code}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap gap-2 items-center mb-3">
            <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none" />
            <span className="text-xs text-slate-400">a</span>
            <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none" />
            <button onClick={cargarReporte} className="text-xs font-semibold px-3 py-2 rounded-full bg-violet-500 text-white">Actualizar</button>
            <button onClick={() => imprimirReporteAsistencia(gradoId, fechaDesde, fechaHasta, totales, institucion)} className="text-xs font-semibold px-3 py-2 rounded-full border border-slate-200 text-slate-600">🖨️ Imprimir reporte</button>
          </div>
          {cargandoReporte ? (
            <div className="text-sm text-slate-400">Cargando…</div>
          ) : (
            <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-3 py-2">Estudiante</th>
                    <th className="px-3 py-2">P</th>
                    <th className="px-3 py-2">R</th>
                    <th className="px-3 py-2">FI</th>
                    <th className="px-3 py-2">FJ</th>
                    <th className="px-3 py-2">% Asistencia</th>
                  </tr>
                </thead>
                <tbody>
                  {totales.map((t) => {
                    const pct = t.total > 0 ? Math.round((t.P / t.total) * 100) : 0;
                    return (
                      <tr key={t.estudianteId} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-700">{t.nombre}</td>
                        <td className="text-center px-3 py-2">{t.P}</td>
                        <td className="text-center px-3 py-2">{t.R}</td>
                        <td className="text-center px-3 py-2 text-rose-600">{t.FI}</td>
                        <td className="text-center px-3 py-2">{t.FJ}</td>
                        <td className={`text-center px-3 py-2 font-semibold ${pct < 80 ? "text-rose-600" : "text-emerald-600"}`}>{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
