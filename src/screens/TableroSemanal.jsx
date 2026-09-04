import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { agruparPorNivel } from "../lib/gamification";

const ESTADOS = {
  pendiente: { label: "Pendiente", color: "#94A3B8", bg: "#F1F5F9" },
  en_proceso: { label: "En proceso", color: "#D97706", bg: "#FFFBEB" },
  completado: { label: "Completado", color: "#059669", bg: "#ECFDF5" },
  recuperacion: { label: "Recuperación", color: "#E11D48", bg: "#FFF1F2" },
  exposicion_pendiente: { label: "Exposición pendiente", color: "#7C3AED", bg: "#F5F3FF" },
};

function CeldaEditor({ celda, gradoId, semana, onCerrar, onGuardado }) {
  const [mision, setMision] = useState(celda?.mision || "");
  const [estado, setEstado] = useState(celda?.estado || "pendiente");
  const [evidencia, setEvidencia] = useState(celda?.evidencia || "");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      await api.guardarCeldaTablero(gradoId, semana, { mision: mision.trim() || null, estado, evidencia: evidencia.trim() || null });
      onGuardado();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onCerrar}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-sm shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-bold text-slate-800">Semana {semana} · Curso {gradoId}</h4>
          <button onClick={onCerrar} className="text-slate-400">✕</button>
        </div>
        <label className="text-xs text-slate-500 block mb-1">Misión</label>
        <input value={mision} onChange={(e) => setMision(e.target.value)} placeholder="Ej: M01 · El Gobernante Ético"
          className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />
        <label className="text-xs text-slate-500 block mb-1">Estado</label>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {Object.entries(ESTADOS).map(([key, info]) => (
            <button key={key} onClick={() => setEstado(key)}
              className="text-xs px-2.5 py-1.5 rounded-full border"
              style={estado === key ? { background: info.bg, color: info.color, borderColor: info.color } : { color: "#64748B", borderColor: "#E2E8F0" }}>
              {info.label}
            </button>
          ))}
        </div>
        <label className="text-xs text-slate-500 block mb-1">Evidencia (opcional)</label>
        <input value={evidencia} onChange={(e) => setEvidencia(e.target.value)} placeholder="Ej: Espada / Manual del Gobernante"
          className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />
        <button disabled={guardando} onClick={guardar} className="w-full text-sm font-semibold py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

export function VistaTableroSemanal({ grados }) {
  const niveles = agruparPorNivel(grados);
  const [nivelActual, setNivelActual] = useState(niveles[0]?.nivel || "");
  const [celdas, setCeldas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [semanas, setSemanas] = useState([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const [editando, setEditando] = useState(null); // { gradoId, semana }

  const cursos = niveles.find((n) => n.nivel === nivelActual)?.cursos || [];
  const cursosIds = cursos.map((c) => c.id);

  const cargar = () => {
    if (cursosIds.length === 0) { setCargando(false); return; }
    setCargando(true);
    api.fetchTableroSemanal(cursosIds).then((d) => {
      setCeldas(d);
      const maxSemana = Math.max(10, ...d.map((c) => c.semana));
      setSemanas(Array.from({ length: maxSemana }, (_, i) => i + 1));
      setCargando(false);
    });
  };
  useEffect(() => { cargar(); }, [nivelActual]);

  const celdaDe = (gradoId, semana) => celdas.find((c) => c.grado_id === gradoId && c.semana === semana);
  const agregarSemana = () => setSemanas((prev) => [...prev, prev.length + 1]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🗓️ Tablero Semanal por Curso</h2>
          <p className="text-sm text-slate-400">Los cursos de un mismo grado no tienen por qué ir al mismo ritmo — cada celda es independiente.</p>
        </div>
        <select value={nivelActual} onChange={(e) => setNivelActual(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {niveles.map((n) => <option key={n.nivel} value={n.nivel}>Grado {n.nivel}°</option>)}
        </select>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(ESTADOS).map(([key, info]) => (
          <span key={key} className="text-[10px] px-2 py-1 rounded-full" style={{ background: info.bg, color: info.color }}>{info.label}</span>
        ))}
      </div>

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : cursos.length === 0 ? (
        <p className="text-sm text-slate-400">No hay cursos en este grado todavía.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-left">
                <th className="px-3 py-2 sticky left-0 bg-slate-50">Semana</th>
                {cursos.map((c) => <th key={c.id} className="px-3 py-2 text-center">Curso {c.id}</th>)}
              </tr>
            </thead>
            <tbody>
              {semanas.map((semana) => (
                <tr key={semana} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold text-slate-600 sticky left-0 bg-white">{semana}</td>
                  {cursos.map((c) => {
                    const celda = celdaDe(c.id, semana);
                    const info = ESTADOS[celda?.estado || "pendiente"];
                    return (
                      <td key={c.id} className="px-2 py-1.5 text-center">
                        <button onClick={() => setEditando({ gradoId: c.id, semana })}
                          className="w-full text-left rounded-lg px-2 py-1.5 min-h-[42px]"
                          style={{ background: celda?.mision ? info.bg : "#FAFAFA", color: info.color }}>
                          {celda?.mision ? (
                            <>
                              <div className="font-semibold truncate" style={{ maxWidth: 110 }}>{celda.mision}</div>
                              <div className="text-[9px]">{info.label}</div>
                            </>
                          ) : (
                            <span className="text-slate-300">+ agregar</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={agregarSemana} className="text-xs text-violet-500 px-3 py-2">+ Agregar semana</button>
        </div>
      )}

      {editando && (
        <CeldaEditor celda={celdaDe(editando.gradoId, editando.semana)} gradoId={editando.gradoId} semana={editando.semana}
          onCerrar={() => setEditando(null)} onGuardado={() => { setEditando(null); cargar(); }} />
      )}
    </div>
  );
}
