import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import * as api from "../lib/api";
import { nextLevel } from "../lib/gamification";
import { bandaDesempeno } from "../lib/calificaciones";
import { ActasModal } from "./Actas";

export function VistaReportes({ grados }) {
  const [gradoId, setGradoId] = useState(grados[0]?.id || "");
  const [estudiantes, setEstudiantes] = useState([]);
  const [estudianteId, setEstudianteId] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [periodoTransversal, setPeriodoTransversal] = useState("");
  const [transversal, setTransversal] = useState(null);
  const [cargandoTransversal, setCargandoTransversal] = useState(false);
  const [configsPorMateria, setConfigsPorMateria] = useState({});
  const [actaEstudiante, setActaEstudiante] = useState(null);
  const [generandoActas, setGenerandoActas] = useState(false);

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
      const configs = {};
      await Promise.all(r.materias.map(async (m) => { configs[m.id] = await api.fetchNotasConfig(m.id); }));
      setConfigsPorMateria(configs);
    } catch (e) {
      alert("Error al cargar el control transversal: " + e.message);
    }
    setCargandoTransversal(false);
  };
  useEffect(() => { cargarTransversal(); }, [gradoId, periodoTransversal]);

  const generarActasPendientes = async () => {
    if (!periodoTransversal) { alert("Elegí un periodo específico (no \"Todos los periodos\") para poder generar las actas."); return; }
    if (!transversal) return;
    setGenerandoActas(true);
    let creadas = 0;
    try {
      for (const s of transversal.estudiantes) {
        for (const m of transversal.materias) {
          const nota = transversal.notas[s.id]?.[m.id];
          const cfg = configsPorMateria[m.id];
          if (nota === undefined || !cfg) continue;
          if (nota < cfg.nota_minima) {
            await api.crearActaNivelacionSiReprobado(m.id, m.nombre, s.id, periodoTransversal, nota, cfg);
            creadas++;
          }
        }
      }
      alert(`Listo. Se revisaron todas las materias del grado — se crearon o actualizaron ${creadas} acta(s) de nivelación para el periodo ${periodoTransversal}.`);
    } catch (e) {
      alert("Error al generar actas: " + e.message);
    }
    setGenerandoActas(false);
  };

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
      const filasPorMateria = [];
      for (const s of estudiantes) {
        const progreso = s.progreso?.[0] || s.progreso || { xp: 0, vida: 100, monedas: 0 };
        const asisConsolidada = await api.fetchAsistenciaConsolidadaEstudiante(s.id);
        const { level } = nextLevel(progreso.xp || 0);
        filas.push({
          Nombre: s.nombre,
          Grupo: s.reino_actual || s.reino_original,
          Nivel: level.name,
          XP: progreso.xp || 0,
          Vida: progreso.vida ?? 100,
          Monedas: progreso.monedas || 0,
          Presentes: asisConsolidada.general.P || 0,
          Retardos: asisConsolidada.general.R || 0,
          "Faltas injustificadas": asisConsolidada.general.FI || 0,
          "Faltas justificadas": asisConsolidada.general.FJ || 0,
        });
        Object.entries(asisConsolidada.porMateria).forEach(([nombreMateria, m]) => {
          filasPorMateria.push({
            Nombre: s.nombre, Grupo: s.reino_actual || s.reino_original, Materia: nombreMateria, Docente: m.docente || "",
            Presentes: m.P || 0, Retardos: m.R || 0, "Faltas injustificadas": m.FI || 0, "Faltas justificadas": m.FJ || 0,
          });
        });
      }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), `Grado ${gradoId}`);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        filasPorMateria.length > 0 ? filasPorMateria : [{ Info: "Sin registros de asistencia" }]
      ), "Asistencia por materia");
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
      const asisConsolidada = await api.fetchAsistenciaConsolidadaEstudiante(s.id);
      const actas = await api.fetchActasPorEstudiante(s.id);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
        Nombre: s.nombre, Grupo: s.reino_actual || s.reino_original, Grado: gradoId,
        Nivel: level.name, XP: progreso.xp || 0, Vida: progreso.vida ?? 100, Monedas: progreso.monedas || 0,
      }]), "Resumen");

      // Resumen de asistencia por materia (retardos y faltas separados, con el nombre de cada materia)
      const resumenPorMateria = Object.entries(asisConsolidada.porMateria).map(([nombreMateria, m]) => ({
        Materia: nombreMateria, Docente: m.docente || "", Presentes: m.P || 0, Retardos: m.R || 0,
        "Faltas injustificadas": m.FI || 0, "Faltas justificadas": m.FJ || 0, Total: m.total,
      }));
      resumenPorMateria.push({
        Materia: "TOTAL (todas las materias)", Docente: "", Presentes: asisConsolidada.general.P || 0,
        Retardos: asisConsolidada.general.R || 0, "Faltas injustificadas": asisConsolidada.general.FI || 0,
        "Faltas justificadas": asisConsolidada.general.FJ || 0, Total: asisConsolidada.general.total,
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenPorMateria), "Asistencia (resumen)");

      // Listado detallado: cada registro con su materia, fecha y tipo
      const nombresCodigo = { P: "Presente", R: "Retardo", FI: "Falta injustificada", FJ: "Falta justificada" };
      const detalle = asisConsolidada.registros.map((r) => ({
        Fecha: r.fecha,
        Materia: r.materia_id ? (r.materias?.nombre || `Materia ${r.materia_id}`) : "General (sin materia asociada)",
        Docente: r.materias?.profesores?.nombre || "",
        Tipo: nombresCodigo[r.codigo] || r.codigo,
        Observación: r.observacion || "",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        detalle.length > 0 ? detalle : [{ Info: "Sin registros de asistencia" }]
      ), "Asistencia (detalle)");

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
            <button disabled={!transversal || generandoActas} onClick={generarActasPendientes} className="text-sm font-semibold px-4 py-2 rounded-full bg-rose-500 text-white disabled:opacity-60">
              {generandoActas ? "Generando…" : "📋 Generar actas pendientes"}
            </button>
          </div>
        </div>

        {cargandoTransversal ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : !transversal || transversal.materias.length === 0 ? (
          <div className="text-sm text-slate-400">Todavía no hay notas finales guardadas para este grado en ninguna materia.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs w-full" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-20 bg-slate-50 text-left px-3 py-2 border-b border-slate-100">Estudiante</th>
                  {transversal.materias.map((m) => (
                    <th key={m.id} className="sticky top-0 z-10 text-center px-3 py-2 border-b border-slate-100 bg-slate-50 whitespace-nowrap">
                      {m.nombre}{m.docente ? <div className="text-[9px] text-slate-400 font-normal">{m.docente}</div> : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transversal.estudiantes.map((s) => (
                  <tr key={s.id} className="odd:bg-white even:bg-slate-50">
                    <td className="sticky left-0 bg-inherit text-left px-3 py-2 font-medium text-slate-700 whitespace-nowrap">
                      <button onClick={() => setActaEstudiante(s)} className="hover:text-violet-600" title="Ver / crear actas de este estudiante">
                        📋 {s.nombre}
                      </button>
                    </td>
                    {transversal.materias.map((m) => {
                      const n = transversal.notas[s.id]?.[m.id];
                      const cfg = configsPorMateria[m.id] || { escala_min: 1, nota_minima: 3.5, nota_maxima: 5 };
                      const banda = n !== undefined ? bandaDesempeno(n, cfg) : null;
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
            <p className="text-[10px] text-slate-400 mt-2">Los colores usan la escala mínima aprobatoria real configurada en cada materia (no una genérica). Clic en el nombre de un estudiante para ver o crear sus actas. El botón "Generar actas pendientes" solo funciona con un periodo específico seleccionado (no con "Todos los periodos").</p>
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
        <p className="text-xs text-slate-400 mt-2">Incluye 4 hojas: Resumen (gamificación), Asistencia por materia (resumen), Asistencia detallada (fecha, materia y tipo) y Actas de seguimiento.</p>
      </div>

      {actaEstudiante && <ActasModal estudiante={actaEstudiante} onClose={() => setActaEstudiante(null)} />}
    </div>
  );
}
