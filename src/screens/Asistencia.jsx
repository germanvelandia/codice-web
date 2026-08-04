import React, { useEffect, useMemo, useState } from "react";
import * as api from "../lib/api";

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

export function VistaAsistencia({ grados }) {
  const [gradoId, setGradoId] = useState(grados[0]?.id || "");
  const [reinoFiltro, setReinoFiltro] = useState("Todos");
  const [fecha, setFecha] = useState(hoyISO());
  const [estudiantes, setEstudiantes] = useState([]);
  const [asistencia, setAsistencia] = useState({});
  const [cargando, setCargando] = useState(true);
  const [notaAbiertaId, setNotaAbiertaId] = useState(null);
  const [notaTexto, setNotaTexto] = useState("");

  useEffect(() => { if (grados.length && !gradoId) setGradoId(grados[0].id); }, [grados]);

  const cargar = async () => {
    if (!gradoId) return;
    setCargando(true);
    const est = await api.fetchEstudiantesPorGrado(gradoId);
    setEstudiantes(est);
    const mapa = await api.fetchAsistenciaFecha(est.map((s) => s.id), fecha);
    setAsistencia(mapa);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, [gradoId, fecha]);

  const reinos = useMemo(() => {
    const set = new Set(estudiantes.map((s) => s.reino_actual || s.reino_original || "Sin grupo"));
    return ["Todos", ...Array.from(set)];
  }, [estudiantes]);

  const visibles = estudiantes.filter((s) => reinoFiltro === "Todos" || (s.reino_actual || s.reino_original) === reinoFiltro);

  const marcar = async (estudianteId, codigo) => {
    const actual = asistencia[estudianteId];
    if (actual && actual.codigo === codigo) {
      await api.quitarAsistencia(estudianteId, fecha);
      setAsistencia((prev) => { const n = { ...prev }; delete n[estudianteId]; return n; });
    } else {
      await api.marcarAsistencia(estudianteId, fecha, codigo, actual?.observacion);
      setAsistencia((prev) => ({ ...prev, [estudianteId]: { ...(prev[estudianteId] || {}), codigo, estudiante_id: estudianteId, fecha } }));
    }
  };

  const guardarNota = async (estudianteId) => {
    const actual = asistencia[estudianteId];
    await api.marcarAsistencia(estudianteId, fecha, actual?.codigo || "P", notaTexto);
    setAsistencia((prev) => ({ ...prev, [estudianteId]: { ...(prev[estudianteId] || {}), codigo: actual?.codigo || "P", observacion: notaTexto } }));
    setNotaAbiertaId(null);
    setNotaTexto("");
  };

  const marcarTodos = async () => {
    await api.marcarTodosPresentes(visibles.map((s) => s.id), fecha);
    cargar();
  };

  const conteoDia = { P: 0, R: 0, FI: 0, FJ: 0 };
  Object.values(asistencia).forEach((f) => { if (conteoDia[f.codigo] !== undefined) conteoDia[f.codigo]++; });

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">Control de Asistencia</h2>
      <p className="text-xs text-slate-400 mb-4">P = Presente · R = Retardo · FI = Falta injustificada · FJ = Falta justificada. Un segundo clic sobre el mismo código lo quita.</p>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <select value={gradoId} onChange={(e) => { setGradoId(e.target.value); setReinoFiltro("Todos"); }} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {grados.map((g) => <option key={g.id} value={g.id}>Grado {g.id}</option>)}
        </select>
        <select value={reinoFiltro} onChange={(e) => setReinoFiltro(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {reinos.map((r) => <option key={r} value={r}>{r === "Todos" ? "Todos los grupos" : r}</option>)}
        </select>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white" />
        <button onClick={marcarTodos} className="text-xs font-semibold px-3 py-2 rounded-full bg-violet-500 text-white">Marcar todos Presentes</button>
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
                    <div className="text-sm font-medium text-slate-800">{s.nombre}</div>
                    <div className="text-xs text-slate-400">{s.reino_actual || s.reino_original}{registro?.observacion ? ` · 📝 ${registro.observacion}` : ""}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {CODIGOS.map((c) => {
                      const activo = registro?.codigo === c.code;
                      return (
                        <button key={c.code} onClick={() => marcar(s.id, c.code)}
                          className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${activo ? c.color + " text-white border-transparent" : "bg-white text-slate-500 border-slate-200"}`}>
                          {c.code}
                        </button>
                      );
                    })}
                    <button onClick={() => { setNotaAbiertaId(notaAbiertaId === s.id ? null : s.id); setNotaTexto(registro?.observacion || ""); }}
                      className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 text-slate-500">📝</button>
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
    </div>
  );
}
