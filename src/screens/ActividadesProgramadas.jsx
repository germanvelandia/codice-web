import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

// Selector de cursos duplicados: por cada grado que el docente marque, se
// puede elegir a qué actividad de SU Planilla de calificaciones se vincula
// (cada curso tiene sus propias actividades).
function SelectorCursos({ grados, materiaId, periodo, cursos, onCambiar }) {
  const [actividadesPorGrado, setActividadesPorGrado] = useState({});

  const toggleGrado = (gradoId) => {
    const yaEsta = cursos.some((c) => c.grado_id === gradoId);
    if (yaEsta) {
      onCambiar(cursos.filter((c) => c.grado_id !== gradoId));
    } else {
      onCambiar([...cursos, { grado_id: gradoId, actividad_notas_id: null }]);
      if (!actividadesPorGrado[gradoId] && materiaId) {
        api.fetchActividades(materiaId, gradoId, periodo).then((d) => setActividadesPorGrado((prev) => ({ ...prev, [gradoId]: d })));
      }
    }
  };

  const cambiarActividad = (gradoId, actividadId) => {
    onCambiar(cursos.map((c) => (c.grado_id === gradoId ? { ...c, actividad_notas_id: actividadId || null } : c)));
  };

  return (
    <div>
      <label className="text-[10px] text-slate-500 block mb-1">Duplicar a estos cursos</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {grados.map((g) => (
          <button key={g.id} onClick={() => toggleGrado(g.id)}
            className={`text-xs px-3 py-1.5 rounded-full border ${cursos.some((c) => c.grado_id === g.id) ? "bg-violet-500 text-white border-violet-500" : "bg-white text-slate-600 border-slate-200"}`}>
            Curso {g.id}
          </button>
        ))}
      </div>
      {cursos.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {cursos.map((c) => (
            <div key={c.grado_id} className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 w-16 shrink-0">Curso {c.grado_id}:</span>
              <select value={c.actividad_notas_id || ""} onChange={(e) => cambiarActividad(c.grado_id, e.target.value ? parseInt(e.target.value, 10) : null)}
                className="flex-1 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
                <option value="">— Sin vincular a la Planilla (sin recompensa automática en este curso) —</option>
                {(actividadesPorGrado[c.grado_id] || []).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActividadForm({ materias, grados, actividad, onCancelar, onGuardado }) {
  const [fecha, setFecha] = useState(actividad?.fecha || "");
  const [nombre, setNombre] = useState(actividad?.nombre || "");
  const [materiaId, setMateriaId] = useState(actividad?.materia_id || materias[0]?.id || "");
  const [periodo, setPeriodo] = useState("1");
  const [xp, setXp] = useState(actividad?.recompensa_xp || 0);
  const [vida, setVida] = useState(actividad?.recompensa_vida || 0);
  const [monedas, setMonedas] = useState(actividad?.recompensa_monedas || 0);
  const [notaMinima, setNotaMinima] = useState(actividad?.nota_minima ?? 3.5);
  const [cursos, setCursos] = useState(
    actividad?.actividades_programadas_cursos?.map((c) => ({ grado_id: c.grado_id, actividad_notas_id: c.actividad_notas_id })) || []
  );
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!nombre.trim()) { alert("Ponele un nombre a la actividad."); return; }
    setGuardando(true);
    try {
      const campos = {
        fecha: fecha || null, nombre: nombre.trim(), materia_id: materiaId || null,
        recompensa_xp: parseInt(xp, 10) || 0, recompensa_vida: parseInt(vida, 10) || 0,
        recompensa_monedas: parseInt(monedas, 10) || 0, nota_minima: parseFloat(notaMinima) || 3.5,
      };
      if (actividad) {
        await api.editarActividadProgramada(actividad.id, campos);
        await api.actualizarCursosActividadProgramada(actividad.id, cursos);
      } else {
        await api.crearActividadProgramada(campos, cursos);
      }
      onGuardado();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-2xl p-4 mb-4 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        <select value={materiaId} onChange={(e) => setMateriaId(parseInt(e.target.value, 10))} className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white">
          {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
      </div>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la actividad (ej: Taller de fracciones)"
        className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
      <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white">
        {["1", "2", "3", "4"].map((p) => <option key={p} value={p}>Periodo {p}</option>)}
      </select>

      <SelectorCursos grados={grados} materiaId={materiaId} periodo={periodo} cursos={cursos} onCambiar={setCursos} />

      <div className="grid grid-cols-4 gap-1.5">
        <div>
          <label className="text-[9px] text-slate-500 block">⭐ XP</label>
          <input type="number" value={xp} onChange={(e) => setXp(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
        </div>
        <div>
          <label className="text-[9px] text-slate-500 block">🩸 Sangre (Vida)</label>
          <input type="number" value={vida} onChange={(e) => setVida(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
        </div>
        <div>
          <label className="text-[9px] text-slate-500 block">🪙 Oro</label>
          <input type="number" value={monedas} onChange={(e) => setMonedas(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
        </div>
        <div>
          <label className="text-[9px] text-slate-500 block">Nota mín.</label>
          <input type="number" step="0.1" value={notaMinima} onChange={(e) => setNotaMinima(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : actividad ? "Guardar cambios" : "Agregar"}
        </button>
      </div>
    </div>
  );
}

export function VistaActividadesProgramadas({ grados }) {
  const [materias, setMaterias] = useState([]);
  const [actividades, setActividades] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);

  const cargar = () => { setCargando(true); api.fetchActividadesProgramadas().then((d) => { setActividades(d); setCargando(false); }); };
  useEffect(() => { api.fetchMaterias().then(setMaterias); cargar(); }, []);

  const eliminar = async (a) => { if (!confirm(`¿Eliminar la actividad "${a.nombre}"?`)) return; await api.eliminarActividadProgramada(a.id); cargar(); };

  const [aplicandoRetroactivo, setAplicandoRetroactivo] = useState(null);
  const aplicarRetroactivo = async (a) => {
    setAplicandoRetroactivo(a.id);
    try {
      const otorgadas = await api.aplicarRecompensasRetroactivas(a.id);
      alert(otorgadas > 0 ? `Se le dio la recompensa a ${otorgadas} estudiante(s) que ya tenían la nota puesta.` : "No había estudiantes pendientes — todos los que aprueban ya la habían recibido.");
    } catch (e) {
      alert("Error: " + e.message);
    }
    setAplicandoRetroactivo(null);
  };

  if (materias.length === 0) {
    return <p className="text-sm text-slate-400">Primero creá al menos una materia (en Calificaciones) para poder programar actividades.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-xl font-bold text-slate-800">📅 Actividades Programadas</h2>
          <p className="text-sm text-slate-400">Programá una actividad, vinculala a la Planilla de uno o varios cursos, y definí qué recompensa le da al estudiante si aprueba.</p>
        </div>
        <button onClick={() => { setEditando(null); setFormAbierto((v) => !v); }} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white shrink-0">
          {formAbierto ? "Cerrar" : "+ Nueva actividad"}
        </button>
      </div>

      {formAbierto && (
        <ActividadForm materias={materias} grados={grados} actividad={editando}
          onCancelar={() => { setFormAbierto(false); setEditando(null); }}
          onGuardado={() => { setFormAbierto(false); setEditando(null); cargar(); }} />
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : actividades.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">Todavía no hay actividades programadas.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-left">
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Actividad</th>
                <th className="px-3 py-2">Grado(s)</th>
                <th className="px-3 py-2">Relación con la Planilla</th>
                <th className="px-3 py-2">⭐ XP</th>
                <th className="px-3 py-2">🪙 Oro</th>
                <th className="px-3 py-2">🩸 Sangre</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {actividades.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 whitespace-nowrap">{a.fecha || "—"}</td>
                  <td className="px-3 py-2 font-medium text-slate-700">{a.nombre}<div className="text-[10px] text-slate-400">{a.materias?.nombre}</div></td>
                  <td className="px-3 py-2">{a.actividades_programadas_cursos?.map((c) => c.grado_id).join(", ") || "—"}</td>
                  <td className="px-3 py-2">
                    {a.actividades_programadas_cursos?.length > 0 ? (
                      <div className="space-y-0.5">
                        {a.actividades_programadas_cursos.map((c) => (
                          <div key={c.grado_id} className="text-[10px]">
                            {c.grado_id}: {c.notas_actividades?.nombre || <span className="text-rose-400">sin vincular</span>}
                          </div>
                        ))}
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2">{a.recompensa_xp || "—"}</td>
                  <td className="px-3 py-2">{a.recompensa_monedas || "—"}</td>
                  <td className="px-3 py-2">{a.recompensa_vida || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button disabled={aplicandoRetroactivo === a.id} onClick={() => aplicarRetroactivo(a)} title="Dar la recompensa a quienes ya tenían la nota puesta antes de vincular"
                      className="text-slate-400 hover:text-emerald-600 mr-2 disabled:opacity-50">{aplicandoRetroactivo === a.id ? "…" : "🔁"}</button>
                    <button onClick={() => { setEditando(a); setFormAbierto(true); }} className="text-slate-400 hover:text-violet-600 mr-2">✏️</button>
                    <button onClick={() => eliminar(a)} className="text-slate-400 hover:text-rose-500">🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
