import React, { useEffect, useMemo, useState } from "react";
import * as api from "../lib/api";
import { ActasModal } from "./Actas";
import { InclusionBadge } from "./Estudiantes";
import { agruparPorNivel, nivelYCurso } from "../lib/gamification";

const CODIGOS = [
  { code: "P", label: "Presente", color: "bg-emerald-500", light: "bg-emerald-50 text-emerald-700" },
  { code: "R", label: "Retardo", color: "bg-amber-500", light: "bg-amber-50 text-amber-700" },
  { code: "FI", label: "Falta injustificada", color: "bg-rose-500", light: "bg-rose-50 text-rose-700" },
  { code: "FJ", label: "Falta justificada", color: "bg-blue-500", light: "bg-blue-50 text-blue-700" },
];

function hoyISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function TotalesPorGrado({ grados }) {
  const [totales, setTotales] = useState([]);
  const [totalesEstudiante, setTotalesEstudiante] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [detalle, setDetalle] = useState("grado"); // "grado" | "estudiante"
  const [nivelFiltro, setNivelFiltro] = useState("Todos");
  const [cursoFiltro, setCursoFiltro] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");

  const niveles = useMemo(() => agruparPorNivel(grados), [grados]);
  const cursosDelNivel = nivelFiltro === "Todos" ? [] : (niveles.find((n) => n.nivel === nivelFiltro)?.cursos || []);

  const cargar = () => {
    setCargando(true);
    Promise.all([
      api.fetchTotalesAsistenciaPorGrado(fechaDesde || null, fechaHasta || null),
      api.fetchTotalesAsistenciaPorEstudiante(fechaDesde || null, fechaHasta || null),
    ]).then(([g, e]) => { setTotales(g); setTotalesEstudiante(e); setCargando(false); });
  };
  useEffect(() => { cargar(); }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <label className="text-xs text-slate-500">Desde</label>
        <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
        <label className="text-xs text-slate-500">Hasta</label>
        <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
        <button onClick={cargar} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">Aplicar</button>
        {(fechaDesde || fechaHasta) && (
          <button onClick={() => { setFechaDesde(""); setFechaHasta(""); setTimeout(cargar, 0); }} className="text-xs text-slate-400">Quitar filtro de fechas</button>
        )}
        <div className="flex gap-1 rounded-full bg-violet-50 p-1 ml-auto">
          <button onClick={() => setDetalle("grado")} className={`text-xs px-3 py-1.5 rounded-full ${detalle === "grado" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Por grado</button>
          <button onClick={() => setDetalle("estudiante")} className={`text-xs px-3 py-1.5 rounded-full ${detalle === "estudiante" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Por estudiante</button>
        </div>
      </div>

      {detalle === "estudiante" && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <select value={nivelFiltro} onChange={(e) => { setNivelFiltro(e.target.value); setCursoFiltro("Todos"); }} className="text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none">
            <option value="Todos">Todos los grados</option>
            {niveles.map((n) => <option key={n.nivel} value={n.nivel}>Grado {n.nivel}°</option>)}
          </select>
          {nivelFiltro !== "Todos" && (
            <select value={cursoFiltro} onChange={(e) => setCursoFiltro(e.target.value)} className="text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none">
              <option value="Todos">Todos los cursos de {nivelFiltro}°</option>
              {cursosDelNivel.map((c) => <option key={c.id} value={c.id}>Curso {c.id}</option>)}
            </select>
          )}
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="🔍 Buscar estudiante…"
            className="text-sm rounded-lg px-3 py-1.5 border border-slate-200 outline-none w-48" />
        </div>
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : detalle === "grado" ? (
        totales.length === 0 ? (
          <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">Todavía no hay registros de asistencia.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-3 py-2">Grado</th>
                  <th className="px-3 py-2">✅ Presentes</th>
                  <th className="px-3 py-2">🟡 Retardos</th>
                  <th className="px-3 py-2">🔴 Faltas injust.</th>
                  <th className="px-3 py-2">🔵 Faltas justif.</th>
                  <th className="px-3 py-2">Total registros</th>
                  <th className="px-3 py-2">% Asistencia</th>
                </tr>
              </thead>
              <tbody>
                {totales.map((t) => {
                  const pctAsistencia = t.total > 0 ? Math.round((t.P / t.total) * 100) : null;
                  return (
                    <tr key={t.grado} className="odd:bg-white even:bg-slate-50">
                      <td className="px-3 py-2 font-semibold text-slate-700">Grado {t.grado}</td>
                      <td className="text-center px-3 py-2 text-emerald-600 font-semibold">{t.P}</td>
                      <td className="text-center px-3 py-2 text-amber-600 font-semibold">{t.R}</td>
                      <td className="text-center px-3 py-2 text-rose-600 font-semibold">{t.FI}</td>
                      <td className="text-center px-3 py-2 text-blue-600 font-semibold">{t.FJ}</td>
                      <td className="text-center px-3 py-2 text-slate-400">{t.total}</td>
                      <td className="text-center px-3 py-2 font-bold text-violet-600">{pctAsistencia !== null ? `${pctAsistencia}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (() => {
        const totalesEstudianteFiltrados = totalesEstudiante
          .filter((t) => nivelFiltro === "Todos" || nivelYCurso(t.grado).nivel === nivelFiltro)
          .filter((t) => cursoFiltro === "Todos" || String(t.grado) === String(cursoFiltro))
          .filter((t) => !busqueda.trim() || t.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()));
        return totalesEstudianteFiltrados.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">No hay estudiantes que coincidan con el filtro.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-3 py-2">Grado</th>
                <th className="text-left px-3 py-2">Estudiante</th>
                <th className="px-3 py-2">✅ P</th>
                <th className="px-3 py-2">🟡 R</th>
                <th className="px-3 py-2">🔴 FI</th>
                <th className="px-3 py-2">🔵 FJ</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">% Asistencia</th>
              </tr>
            </thead>
            <tbody>
              {totalesEstudianteFiltrados.map((t) => {
                const pctAsistencia = t.total > 0 ? Math.round((t.P / t.total) * 100) : null;
                return (
                  <tr key={t.estudianteId} className="odd:bg-white even:bg-slate-50">
                    <td className="px-3 py-2 text-slate-400">{t.grado}</td>
                    <td className="px-3 py-2 font-semibold text-slate-700">{t.nombre}</td>
                    <td className="text-center px-3 py-2 text-emerald-600 font-semibold">{t.P}</td>
                    <td className="text-center px-3 py-2 text-amber-600 font-semibold">{t.R}</td>
                    <td className="text-center px-3 py-2 text-rose-600 font-semibold">{t.FI}</td>
                    <td className="text-center px-3 py-2 text-blue-600 font-semibold">{t.FJ}</td>
                    <td className="text-center px-3 py-2 text-slate-400">{t.total}</td>
                    <td className="text-center px-3 py-2 font-bold text-violet-600">{pctAsistencia !== null ? `${pctAsistencia}%` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
      })()}
    </div>
  );
}

export function VistaAsistencia({ grados }) {
  const [gradoId, setGradoId] = useState(grados[0]?.id || "");
  const [reinoFiltro, setReinoFiltro] = useState("Todos");
  const [fecha, setFecha] = useState(hoyISO());
  const [estudiantes, setEstudiantes] = useState([]);
  const [asistencia, setAsistencia] = useState({});
  const [cargando, setCargando] = useState(true);
  const [notaAbiertaId, setNotaAbiertaId] = useState(null);
  const [notaTexto, setNotaTexto] = useState("");
  const [materias, setMaterias] = useState([]);
  const [materiaId, setMateriaId] = useState(""); // "" = General (sin materia)
  const [usuarioId, setUsuarioId] = useState(null);
  const [consolidadoEstudiante, setConsolidadoEstudiante] = useState(null);
  const [vista, setVista] = useState("diaria"); // "diaria" | "totales"

  useEffect(() => { if (grados.length && !gradoId) setGradoId(grados[0].id); }, [grados]);
  useEffect(() => { api.fetchMaterias().then(setMaterias); api.fetchUsuarioActualId().then(setUsuarioId); }, []);

  const materiaActual = materias.find((m) => m.id === parseInt(materiaId, 10));
  const esMateriaPropia = materiaId === "" || (materiaActual && materiaActual.docente_id === usuarioId);
  const soloLectura = materiaId !== "" && !esMateriaPropia;

  const cargar = async () => {
    if (!gradoId) return;
    setCargando(true);
    const est = await api.fetchEstudiantesPorGrado(gradoId);
    setEstudiantes(est);
    const mIdNum = materiaId === "" ? null : parseInt(materiaId, 10);
    const mapa = await api.fetchAsistenciaFecha(est.map((s) => s.id), fecha, mIdNum);
    setAsistencia(mapa);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, [gradoId, fecha, materiaId]);

  const reinos = useMemo(() => {
    const set = new Set(estudiantes.map((s) => s.reino_actual || s.reino_original || "Sin grupo"));
    return ["Todos", ...Array.from(set)];
  }, [estudiantes]);

  const visibles = estudiantes.filter((s) => reinoFiltro === "Todos" || (s.reino_actual || s.reino_original) === reinoFiltro);

  const marcar = async (estudianteId, codigo) => {
    if (soloLectura) return;
    const mIdNum = materiaId === "" ? null : parseInt(materiaId, 10);
    const actual = asistencia[estudianteId];
    if (actual && actual.codigo === codigo) {
      await api.quitarAsistencia(estudianteId, fecha, mIdNum);
      setAsistencia((prev) => { const n = { ...prev }; delete n[estudianteId]; return n; });
    } else {
      await api.marcarAsistencia(estudianteId, fecha, codigo, actual?.observacion, mIdNum);
      setAsistencia((prev) => ({ ...prev, [estudianteId]: { ...(prev[estudianteId] || {}), codigo, estudiante_id: estudianteId, fecha } }));
    }
  };

  const guardarNota = async (estudianteId) => {
    if (soloLectura) return;
    const mIdNum = materiaId === "" ? null : parseInt(materiaId, 10);
    const actual = asistencia[estudianteId];
    await api.marcarAsistencia(estudianteId, fecha, actual?.codigo || "P", notaTexto, mIdNum);
    setAsistencia((prev) => ({ ...prev, [estudianteId]: { ...(prev[estudianteId] || {}), codigo: actual?.codigo || "P", observacion: notaTexto } }));
    setNotaAbiertaId(null);
    setNotaTexto("");
  };

  const marcarTodos = async () => {
    if (soloLectura) return;
    const mIdNum = materiaId === "" ? null : parseInt(materiaId, 10);
    await api.marcarTodosPresentes(visibles.map((s) => s.id), fecha, mIdNum);
    cargar();
  };

  const conteoDia = { P: 0, R: 0, FI: 0, FJ: 0 };
  Object.values(asistencia).forEach((f) => { if (conteoDia[f.codigo] !== undefined) conteoDia[f.codigo]++; });

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">Control de Asistencia</h2>
      <p className="text-xs text-slate-400 mb-3">P = Presente · R = Retardo · FI = Falta injustificada · FJ = Falta justificada. Un segundo clic sobre el mismo código lo quita.</p>

      <div className="flex gap-1 mb-4 rounded-full bg-white p-1 w-fit border border-slate-100 shadow-sm">
        <button onClick={() => setVista("diaria")} className={`text-xs px-4 py-2 rounded-full ${vista === "diaria" ? "bg-violet-500 text-white" : "text-slate-600"}`}>📋 Marcar asistencia</button>
        <button onClick={() => setVista("totales")} className={`text-xs px-4 py-2 rounded-full ${vista === "totales" ? "bg-violet-500 text-white" : "text-slate-600"}`}>📊 Totales por grado</button>
      </div>

      {vista === "totales" ? (
        <TotalesPorGrado grados={grados} />
      ) : (
        <>
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <select value={gradoId} onChange={(e) => { setGradoId(e.target.value); setReinoFiltro("Todos"); }} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {grados.map((g) => <option key={g.id} value={g.id}>Grado {g.id}</option>)}
        </select>
        <select value={reinoFiltro} onChange={(e) => setReinoFiltro(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {reinos.map((r) => <option key={r} value={r}>{r === "Todos" ? "Todos los grupos" : r}</option>)}
        </select>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white" />
        {!soloLectura && (
          <button onClick={marcarTodos} className="text-xs font-semibold px-3 py-2 rounded-full bg-violet-500 text-white">Marcar todos Presentes</button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <span className="text-xs uppercase tracking-wide text-slate-400">Materia:</span>
        <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          <option value="">General (sin materia asociada)</option>
          {materias.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}{m.docente_id !== usuarioId ? ` — ${m.profesores?.nombre || "otro docente"}` : " (mía)"}
            </option>
          ))}
        </select>
        {soloLectura && (
          <span className="text-xs px-3 py-1.5 rounded-full bg-amber-50 text-amber-700">
            👁️ Solo lectura — esta materia es de {materiaActual?.profesores?.nombre || "otro docente"}
          </span>
        )}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {CODIGOS.map((c) => (
          <div key={c.code} className={`text-xs px-3 py-1.5 rounded-full ${c.light}`}>{c.code} · {conteoDia[c.code]}</div>
        ))}
      </div>

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100">
          {visibles.map((s) => {
            const registro = asistencia[s.id];
            return (
              <div key={s.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800">{s.nombre} <InclusionBadge estudiante={s} size="text-xs" /></div>
                    <div className="text-xs text-slate-400">{s.reino_actual || s.reino_original}{registro?.observacion ? ` · 📝 ${registro.observacion}` : ""}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {CODIGOS.map((c) => {
                      const activo = registro?.codigo === c.code;
                      return (
                        <button key={c.code} disabled={soloLectura} onClick={() => marcar(s.id, c.code)}
                          className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed ${activo ? c.color + " text-white border-transparent" : "bg-white text-slate-500 border-slate-200"}`}>
                          {c.code}
                        </button>
                      );
                    })}
                    {!soloLectura && (
                      <button onClick={() => { setNotaAbiertaId(notaAbiertaId === s.id ? null : s.id); setNotaTexto(registro?.observacion || ""); }}
                        className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 text-slate-500">📝</button>
                    )}
                    <button onClick={() => setConsolidadoEstudiante(s)} title="Ver asistencia en todas las materias / procesos convivenciales"
                      className="text-xs px-2 py-1.5 rounded-lg bg-violet-100 text-violet-700">📊</button>
                  </div>
                </div>
                {notaAbiertaId === s.id && (
                  <div className="mt-2 flex gap-2">
                    <input value={notaTexto} onChange={(e) => setNotaTexto(e.target.value)} placeholder="Observación (motivo de la falta, etc.)"
                      className="flex-1 text-xs rounded-lg px-3 py-1.5 border border-slate-200 outline-none" />
                    <button onClick={() => guardarNota(s.id)} className="text-xs px-3 py-1.5 rounded-lg bg-violet-500 text-white">Guardar</button>
                  </div>
                )}
              </div>
            );
          })}
          {visibles.length === 0 && <div className="px-4 py-6 text-sm text-slate-400">No hay estudiantes en esta selección.</div>}
        </div>
      )}

      {consolidadoEstudiante && (
        <ConsolidadoAsistenciaModal estudiante={consolidadoEstudiante} onClose={() => setConsolidadoEstudiante(null)} />
      )}
        </>
      )}
    </div>
  );
}

// Vista de solo lectura con la asistencia de un estudiante en TODAS sus materias
// (de todos los docentes), pensada para sustentar la apertura de un acta convivencial
// por inasistencia reiterada.
function ConsolidadoAsistenciaModal({ estudiante, onClose }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [actasAbiertas, setActasAbiertas] = useState(false);

  useEffect(() => {
    setCargando(true);
    api.fetchAsistenciaConsolidadaEstudiante(estudiante.id).then((d) => { setDatos(d); setCargando(false); });
  }, [estudiante.id]);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">Asistencia consolidada — {estudiante.nombre}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">Incluye la asistencia registrada por todos los docentes en todas las materias de este estudiante.</p>

        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {CODIGOS.map((c) => (
                <div key={c.code} className={`rounded-xl p-2 text-center ${c.light}`}>
                  <div className="text-lg font-bold">{datos.general[c.code] || 0}</div>
                  <div className="text-[10px] uppercase tracking-wide">{c.code}</div>
                </div>
              ))}
            </div>

            <div className="text-xs font-semibold text-slate-600 mb-2">Por materia</div>
            <div className="space-y-2 mb-4">
              {Object.entries(datos.porMateria).length === 0 && (
                <div className="text-xs text-slate-400">Sin registros de asistencia todavía.</div>
              )}
              {Object.entries(datos.porMateria).map(([nombreMateria, m]) => (
                <div key={nombreMateria} className="border border-slate-100 rounded-lg p-2">
                  <div className="text-xs font-semibold text-slate-700">{nombreMateria}{m.docente ? ` — ${m.docente}` : ""}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    P:{m.P || 0} · R:{m.R || 0} · FI:{m.FI || 0} · FJ:{m.FJ || 0} · Total: {m.total}
                  </div>
                </div>
              ))}
            </div>

            {datos.general.FI >= 3 && (
              <div className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mb-3">
                ⚠️ Este estudiante acumula {datos.general.FI} faltas injustificadas entre todas sus materias — puede ameritar un acta convivencial por inasistencia reiterada.
              </div>
            )}

            <button onClick={() => setActasAbiertas(true)} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white">
              📋 Ver / crear acta de seguimiento
            </button>
          </>
        )}
      </div>

      {actasAbiertas && <ActasModal estudiante={estudiante} onClose={() => setActasAbiertas(false)} />}
    </div>
  );
}
