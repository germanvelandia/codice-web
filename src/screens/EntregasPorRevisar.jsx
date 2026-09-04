import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

const ICONO_TIPO = { proyecto: "📜", forja: "🔨" };

export function VistaEntregasPorRevisar({ onIrAGrado }) {
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = () => { setCargando(true); api.fetchResumenEntregasPorRevisar().then((d) => { setResumen(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  if (cargando || !resumen) return <div className="text-sm text-slate-400">Cargando…</div>;

  const totalEval = resumen.evaluaciones.reduce((a, e) => a + e.cantidad, 0);
  const totalTareas = resumen.tareas.reduce((a, t) => a + t.cantidad, 0);
  const total = totalEval + totalTareas;

  // Agrupa ambas listas por grado, para mostrar una tarjeta por curso.
  const porGrado = {};
  resumen.evaluaciones.forEach((e) => {
    porGrado[e.grado_id] = porGrado[e.grado_id] || { evaluaciones: [], tareas: [] };
    porGrado[e.grado_id].evaluaciones.push(e);
  });
  resumen.tareas.forEach((t) => {
    porGrado[t.grado_id] = porGrado[t.grado_id] || { evaluaciones: [], tareas: [] };
    porGrado[t.grado_id].tareas.push(t);
  });
  const gradosOrdenados = Object.keys(porGrado).sort();

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">📝 Entregas por revisar {total > 0 && <span className="text-violet-500">({total})</span>}</h2>
      <p className="text-sm text-slate-400 mb-1">Cruza Misiones y Proyectos/Forja de todas tus materias y cursos, para no tener que ir uno por uno a buscar qué falta.</p>
      <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4">
        ⚠️ Ojo con la diferencia: en <b>Misiones</b>, "pendiente" significa que el estudiante ya entregó y falta que publiques la nota. En <b>Proyectos/Forja</b>, significa que ese estudiante todavía no tiene nota — puede que ni haya entregado nada, la app no distingue eso.
      </p>

      {total === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">🎉 No hay nada pendiente por revisar en este momento.</div>
      ) : (
        <div className="space-y-3">
          {gradosOrdenados.map((gradoId) => {
            const g = porGrado[gradoId];
            const totalGrado = g.evaluaciones.reduce((a, e) => a + e.cantidad, 0) + g.tareas.reduce((a, t) => a + t.cantidad, 0);
            return (
              <div key={gradoId} className="bg-white rounded-2xl border border-slate-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-800">🎓 Curso {gradoId}</h3>
                  <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full">{totalGrado} pendiente{totalGrado !== 1 ? "s" : ""}</span>
                </div>
                <div className="space-y-1.5">
                  {g.evaluaciones.map((e, i) => (
                    <button key={`ev-${i}`} onClick={() => onIrAGrado(gradoId, e.materia_id, e.periodo, "evaluaciones")}
                      className="w-full flex items-center justify-between text-left text-xs bg-slate-50 hover:bg-violet-50 rounded-lg px-3 py-2">
                      <span>⚔️ <b>{e.titulo}</b> {e.materia_nombre && <span className="text-slate-400">— {e.materia_nombre}</span>}</span>
                      <span className="font-semibold text-violet-600 shrink-0">{e.cantidad} sin publicar →</span>
                    </button>
                  ))}
                  {g.tareas.map((t, i) => (
                    <button key={`ta-${i}`} onClick={() => onIrAGrado(gradoId, t.materia_id, t.periodo, "proyectosforja")}
                      className="w-full flex items-center justify-between text-left text-xs bg-slate-50 hover:bg-violet-50 rounded-lg px-3 py-2">
                      <span>{ICONO_TIPO[t.tipo] || "📄"} <b>{t.titulo}</b> {t.materia_nombre && <span className="text-slate-400">— {t.materia_nombre}</span>}</span>
                      <span className="font-semibold text-violet-600 shrink-0">{t.cantidad} sin nota →</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
