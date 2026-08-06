import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import * as api from "../lib/api";
import { nextLevel } from "../lib/gamification";
import { bandaDesempeno } from "../lib/calificaciones";

export function VistaReportes({ grados }) {
  const [gradoId, setGradoId] = useState(grados[0]?.id || "");
  const [estudiantes, setEstudiantes] = useState([]);
  const [estudianteId, setEstudianteId] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [periodoTransversal, setPeriodoTransversal] = useState("");
  const [transversal, setTransversal] = useState(null);
  const [cargandoTransversal, setCargandoTransversal] = useState(false);

  useEffect(() => { if (grados.length && !gradoId) setGradoId(grados[0].id); }, [grados]);
  useEffect(() => {
    if (!gradoId) return;
    api.fetchEstudiantesPorGrado(gradoId).then((data) => {
      setEstudiantes(data);
      setEstudianteId(data[0]?.id || null);
    });
  }, [gradoId]);

  const cargarTransversal = async () => {
    if (!gradoId) return;
    setCargandoTransversal(true);
    try {
      const r = await api.fetchNotasFinalesTransversal(gradoId, periodoTransversal || null);
      setTransversal(r);
    } catch (e) {
      alert("Error al cargar el control transversal: " + e.message);
    }
    setCargandoTransversal(false);
  };
  useEffect(() => { cargarTransversal(); }, [gradoId, periodoTransversal]);

  const exportarTransversal = () => {
    if (!transversal) return;
    const filas = transversal.estudiantes.map((s) => {
      const fila = { Estudiante: s.nombre, Grupo: s.reino_actual || s.reino_original };
      transversal.materias.forEach((m) => { fila[m.nombre] = transversal.notas[s.id]?.[m.id] ?? ""; });
      return fila;
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), `Grado ${gradoId}`);
    XLSX.writeFile(wb, `Control_transversal_${gradoId}${periodoTransversal ? "_P" + periodoTransversal : ""}.xlsx`);
  };

  const exportarGrado = async () => {
    setCargando(true);
    try {
      const filas = [];
      for (const s of estudiantes) {
        const progreso = s.progreso?.[0] || s.progreso || { xp: 0, vida: 100, monedas: 0 };
        const asis = await api.fetchEstadisticasAsistencia(s.id);
        const { level } = nextLevel(progreso.xp || 0);
        filas.push({
          Nombre: s.nombre,
          Grupo: s.reino_actual || s.reino_original,
          Nivel: level.name,
          XP: progreso.xp || 0,
          Vida: progreso.vida ?? 100,
          Monedas: progreso.monedas || 0,
          "% Asistencia": asis.pct ?? "—",
          Presentes: asis.P,
          Retardos: asis.R,
          "Faltas injustificadas": asis.FI,
          "Faltas justificadas": asis.FJ,
        });
      }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), `Grado ${gradoId}`);
      XLSX.writeFile(wb, `Grado_${gradoId}.xlsx`);
    } catch (e) {
      alert("Error al exportar: " + e.message);
    }
    setCargando(false);
  };

  const exportarEstudiante = async () => {
    const s = estudiantes.find((e) => e.id === estudianteId);
    if (!s) return;
    setCargando(true);
    try {
      const progreso = s.progreso?.[0] || s.progreso || { xp: 0, vida: 100, monedas: 0 };
      const { level } = nextLevel(progreso.xp || 0);
      const asis = await api.fetchEstadisticasAsistencia(s.id);
      const actas = await api.fetchActasPorEstudiante(s.id);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
        Nombre: s.nombre, Grupo: s.reino_actual || s.reino_original, Grado: gradoId,
        Nivel: level.name, XP: progreso.xp || 0, Vida: progreso.vida ?? 100, Monedas: progreso.monedas || 0,
      }]), "Resumen");

      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
        Presentes: asis.P, Retardos: asis.R, "Faltas injustificadas": asis.FI, "Faltas justificadas": asis.FJ,
        Total: asis.total, "% Asistencia": asis.pct ?? "—",
      }]), "Asistencia");

      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        actas.length > 0
          ? actas.map((a) => ({
              Fecha: a.fecha, Tipo: a.tipo, "Falta (si aplica)": a.tipo_falta || "", Motivo: a.motivo,
              Descripcion: a.descripcion || "", Compromisos: a.compromisos || [a.compromisos_academicos, a.compromisos_convivenciales].filter(Boolean).join(" | "),
              "Registrado por": a.profesores?.nombre || "",
            }))
          : [{ Info: "Sin actas registradas" }]
      ), "Actas");

      XLSX.writeFile(wb, `Ficha_${s.nombre.replace(/\s+/g, "_")}.xlsx`);
    } catch (e) {
      alert("Error al exportar: " + e.message);
    }
    setCargando(false);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">Reportes</h2>
      <p className="text-sm text-slate-400 mb-4">Exporta los resultados a Excel — por grado completo o por estudiante.</p>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div>
            <div className="font-semibold text-slate-700">Control transversal — todas las materias</div>
            <p className="text-xs text-slate-400">Notas definitivas de cada estudiante en todas las materias registradas, de todos los docentes.</p>
          </div>
          <div className="flex gap-2 items-center">
            <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none">
              {grados.map((g) => <option key={g.id} value={g.id}>Grado {g.id}</option>)}
            </select>
            <select value={periodoTransversal} onChange={(e) => setPeriodoTransversal(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none">
              <option value="">Todos los periodos (promedio)</option>
              {["1", "2", "3", "4"].map((p) => <option key={p} value={p}>Periodo {p}</option>)}
            </select>
            <button disabled={!transversal} onClick={exportarTransversal} className="text-sm font-semibold px-4 py-2 rounded-full bg-violet-500 text-white disabled:opacity-60">
              📊 Exportar Excel
            </button>
          </div>
        </div>

        {cargandoTransversal ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : !transversal || transversal.materias.length === 0 ? (
          <div className="text-sm text-slate-400">Todavía no hay notas finales guardadas para este grado en ninguna materia.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th className="sticky left-0 bg-slate-50 text-left px-3 py-2 border-b border-slate-100">Estudiante</th>
                  {transversal.materias.map((m) => (
                    <th key={m.id} className="text-center px-3 py-2 border-b border-slate-100 bg-slate-50 whitespace-nowrap">
                      {m.nombre}{m.docente ? <div className="text-[9px] text-slate-400 font-normal">{m.docente}</div> : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transversal.estudiantes.map((s) => (
                  <tr key={s.id} className="odd:bg-white even:bg-slate-50">
                    <td className="sticky left-0 bg-inherit text-left px-3 py-2 font-medium text-slate-700 whitespace-nowrap">{s.nombre}</td>
                    {transversal.materias.map((m) => {
                      const n = transversal.notas[s.id]?.[m.id];
                      const banda = n !== undefined ? bandaDesempeno(n, { escala_min: 1, nota_minima: 3, nota_maxima: 5 }) : null;
                      return (
                        <td key={m.id} className="text-center px-3 py-2 font-semibold" style={{ color: banda?.color || "#CBD5E1" }}>
                          {n ?? "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-slate-400 mt-2">Los colores usan una escala de referencia general (mínima aprobatoria 3.0 / máxima 5.0); cada materia puede tener su propia escala configurada por su docente.</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
        <div className="font-semibold text-slate-700 mb-3">Reporte por grado</div>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none">
            {grados.map((g) => <option key={g.id} value={g.id}>Grado {g.id}</option>)}
          </select>
          <button disabled={cargando} onClick={exportarGrado} className="text-sm font-semibold px-4 py-2 rounded-full bg-violet-500 text-white disabled:opacity-60">
            {cargando ? "Generando…" : "📊 Exportar Excel"}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">Incluye: grupo, nivel, XP, vida, monedas y asistencia de cada estudiante.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="font-semibold text-slate-700 mb-3">Reporte por estudiante</div>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none">
            {grados.map((g) => <option key={g.id} value={g.id}>Grado {g.id}</option>)}
          </select>
          <select value={estudianteId || ""} onChange={(e) => setEstudianteId(parseInt(e.target.value, 10))} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none min-w-[200px]">
            {estudiantes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <button disabled={cargando || !estudianteId} onClick={exportarEstudiante} className="text-sm font-semibold px-4 py-2 rounded-full bg-violet-500 text-white disabled:opacity-60">
            {cargando ? "Generando…" : "📄 Exportar Excel"}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">Incluye 3 hojas: Resumen (gamificación), Asistencia y Actas de seguimiento.</p>
      </div>
    </div>
  );
}
