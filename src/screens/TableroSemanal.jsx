import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import * as api from "../lib/api";
import { agruparPorNivel } from "../lib/gamification";

const ESTADOS = {
  pendiente: { label: "Pendiente", color: "#94A3B8", bg: "#F1F5F9" },
  en_proceso: { label: "En proceso", color: "#D97706", bg: "#FFFBEB" },
  completado: { label: "Completado", color: "#059669", bg: "#ECFDF5" },
  recuperacion: { label: "Recuperación", color: "#E11D48", bg: "#FFF1F2" },
  exposicion_pendiente: { label: "Exposición pendiente", color: "#7C3AED", bg: "#F5F3FF" },
};

function CeldaEditor({ celda, gradoId, periodo, semana, onCerrar, onGuardado, onBorrado }) {
  const [mision, setMision] = useState(celda?.mision || "");
  const [estado, setEstado] = useState(celda?.estado || "pendiente");
  const [evidencia, setEvidencia] = useState(celda?.evidencia || "");
  const [notas, setNotas] = useState(celda?.notas || "");
  const [xpSugerido, setXpSugerido] = useState(celda?.xp_sugerido || 0);
  const [oroSugerido, setOroSugerido] = useState(celda?.oro_sugerido || 0);
  const [sangreSugerida, setSangreSugerida] = useState(celda?.sangre_sugerida || 0);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      await api.guardarCeldaTablero(gradoId, periodo, semana, {
        mision: mision.trim() || null, estado, evidencia: evidencia.trim() || null, notas: notas.trim() || null,
        xp_sugerido: parseInt(xpSugerido, 10) || 0, oro_sugerido: parseInt(oroSugerido, 10) || 0, sangre_sugerida: parseInt(sangreSugerida, 10) || 0,
      });
      onGuardado();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  const borrar = async () => {
    if (!confirm("¿Vaciar esta celda? Se borra la misión, el estado y las notas de esta semana para este curso.")) return;
    setGuardando(true);
    try {
      await api.eliminarCeldaTablero(gradoId, periodo, semana);
      onBorrado();
    } catch (e) {
      alert("Error al borrar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onCerrar}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-md max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-bold text-slate-800">Semana {semana} · Curso {gradoId} · Periodo {periodo}</h4>
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
        <label className="text-xs text-slate-500 block mb-1">Evidencia esperada (opcional)</label>
        <input value={evidencia} onChange={(e) => setEvidencia(e.target.value)} placeholder="Ej: Espada / Manual del Gobernante"
          className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />

        <label className="text-xs text-slate-500 block mb-1">Actividades realizadas / control de la clase</label>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={4} placeholder="Anotá acá qué se hizo realmente en esta semana, para llevar el control real de la clase…"
          className="w-full text-xs rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />

        <label className="text-xs text-slate-500 block mb-1">Qué se piensa dar en esta semana (sugerencia, no se aplica solo)</label>
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          <div>
            <label className="text-[9px] text-slate-400 block">⭐ XP</label>
            <input type="number" value={xpSugerido} onChange={(e) => setXpSugerido(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
          </div>
          <div>
            <label className="text-[9px] text-slate-400 block">🪙 Oro</label>
            <input type="number" value={oroSugerido} onChange={(e) => setOroSugerido(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
          </div>
          <div>
            <label className="text-[9px] text-slate-400 block">🩸 Sangre</label>
            <input type="number" value={sangreSugerida} onChange={(e) => setSangreSugerida(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mb-3">Esto es solo para planear/recordar cuánto pensás dar — no se lo otorga automáticamente al estudiante. Para eso, usá Acciones Masivas o Actividades Programadas.</p>

        <div className="flex gap-2">
          {celda && <button disabled={guardando} onClick={borrar} className="text-xs font-semibold px-3 py-2.5 rounded-lg border border-rose-200 text-rose-500">🗑 Vaciar</button>}
          <button disabled={guardando} onClick={guardar} className="flex-1 text-sm font-semibold py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MoverPeriodoModal({ cursosIds, periodoActual, onCerrar, onMovido }) {
  const [destino, setDestino] = useState(["1", "2", "3", "4"].find((p) => p !== periodoActual));
  const [moviendo, setMoviendo] = useState(false);

  const mover = async () => {
    const conteo = await api.fetchConteoTablero(cursosIds, periodoActual);
    if (conteo === 0) { alert("No hay nada cargado en el periodo actual para mover."); return; }
    const conteoDestino = await api.fetchConteoTablero(cursosIds, destino);
    const aviso = conteoDestino > 0
      ? `El Periodo ${destino} ya tiene ${conteoDestino} celda(s) cargada(s) para este grado — las que choquen en curso+semana se van a reemplazar. `
      : "";
    if (!confirm(`${aviso}¿Mover las ${conteo} celda(s) del Periodo ${periodoActual} al Periodo ${destino}? No se puede deshacer.`)) return;
    setMoviendo(true);
    try {
      await api.moverTableroAPeriodo(cursosIds, periodoActual, destino);
      onMovido();
    } catch (e) {
      alert("Error al mover: " + e.message);
    }
    setMoviendo(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onCerrar}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">🔀 Mover a otro periodo</h3>
          <button onClick={onCerrar} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">Mueve todo lo cargado en este grado, del Periodo {periodoActual} al periodo que elijas — para corregir cuando se completó en el periodo equivocado.</p>
        <label className="text-xs text-slate-500 block mb-1">Mover al periodo</label>
        <select value={destino} onChange={(e) => setDestino(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-4 border border-slate-200 outline-none">
          {["1", "2", "3", "4"].filter((p) => p !== periodoActual).map((p) => <option key={p} value={p}>Periodo {p}</option>)}
        </select>
        <button disabled={moviendo} onClick={mover} className="w-full text-sm font-semibold py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {moviendo ? "Moviendo…" : `Mover del Periodo ${periodoActual} al Periodo ${destino}`}
        </button>
      </div>
    </div>
  );
}

export function VistaTableroSemanal({ grados, periodoActivo }) {
  const niveles = agruparPorNivel(grados);
  const [nivelActual, setNivelActual] = useState(niveles[0]?.nivel || "");
  const [periodo, setPeriodo] = useState(periodoActivo || "1");
  const [celdas, setCeldas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [semanas, setSemanas] = useState([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const [editando, setEditando] = useState(null); // { gradoId, semana }
  const [moverAbierto, setMoverAbierto] = useState(false);

  useEffect(() => { if (periodoActivo) setPeriodo(periodoActivo); }, [periodoActivo]);

  const cursos = niveles.find((n) => n.nivel === nivelActual)?.cursos || [];
  const cursosIds = cursos.map((c) => c.id);

  const cargar = () => {
    if (cursosIds.length === 0) { setCargando(false); return; }
    setCargando(true);
    api.fetchTableroSemanal(cursosIds, periodo).then((d) => {
      setCeldas(d);
      const maxSemana = Math.max(10, ...d.map((c) => c.semana));
      setSemanas(Array.from({ length: maxSemana }, (_, i) => i + 1));
      setCargando(false);
    });
  };
  useEffect(() => { cargar(); }, [nivelActual, periodo]);

  const celdaDe = (gradoId, semana) => celdas.find((c) => c.grado_id === gradoId && c.semana === semana);
  const agregarSemana = () => setSemanas((prev) => [...prev, prev.length + 1]);

  const eliminarSemana = async (semana) => {
    if (!confirm(`¿Eliminar la semana ${semana} completa (todos los cursos de este grado, en este periodo)? No se puede deshacer.`)) return;
    await api.eliminarSemanaTablero(cursosIds, periodo, semana);
    cargar();
  };

  const exportarExcel = () => {
    const filas = [];
    semanas.forEach((semana) => {
      cursos.forEach((c) => {
        const celda = celdaDe(c.id, semana);
        if (!celda) return;
        filas.push({
          Semana: semana, Curso: c.id, Misión: celda.mision || "", Estado: ESTADOS[celda.estado]?.label || celda.estado,
          Evidencia: celda.evidencia || "", "Actividades realizadas": celda.notas || "",
          "XP sugerido": celda.xp_sugerido || 0, "Oro sugerido": celda.oro_sugerido || 0, "Sangre sugerida": celda.sangre_sugerida || 0,
        });
      });
    });
    if (filas.length === 0) { alert("Todavía no hay nada cargado para exportar en este grado/periodo."); return; }
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Tablero Semanal");
    XLSX.writeFile(libro, `tablero_semanal_grado${nivelActual}_periodo${periodo}.xlsx`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🗓️ Tablero Semanal por Curso</h2>
          <p className="text-sm text-slate-400">Los cursos de un mismo grado no tienen por qué ir al mismo ritmo — cada celda es independiente.</p>
        </div>
        <div className="flex gap-2">
          <select value={nivelActual} onChange={(e) => setNivelActual(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
            {niveles.map((n) => <option key={n.nivel} value={n.nivel}>Grado {n.nivel}°</option>)}
          </select>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
            {["1", "2", "3", "4"].map((p) => <option key={p} value={p}>Periodo {p}</option>)}
          </select>
          <button onClick={exportarExcel} className="text-xs font-semibold px-3 py-2 rounded-full border border-slate-200 text-slate-600">📤 Exportar</button>
          <button onClick={() => setMoverAbierto(true)} className="text-xs font-semibold px-3 py-2 rounded-full border border-slate-200 text-slate-600">🔀 Mover a otro periodo</button>
        </div>
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
                <th className="px-2 py-2"></th>
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
                      <td key={c.id} className="px-2 py-1.5">
                        <button onClick={() => setEditando({ gradoId: c.id, semana })}
                          className="w-full text-left rounded-lg px-2 py-1.5 min-h-[42px] relative group"
                          style={{ background: celda?.mision ? info.bg : "#FAFAFA", color: info.color }}>
                          {celda?.mision ? (
                            <>
                              <div className="font-semibold truncate" style={{ maxWidth: 110 }}>{celda.mision}</div>
                              <div className="text-[9px]">{info.label}</div>
                              {(celda.xp_sugerido > 0 || celda.oro_sugerido > 0 || celda.sangre_sugerida > 0) && (
                                <div className="text-[9px] mt-0.5 opacity-80">
                                  {celda.xp_sugerido > 0 && `⭐${celda.xp_sugerido} `}
                                  {celda.oro_sugerido > 0 && `🪙${celda.oro_sugerido} `}
                                  {celda.sangre_sugerida > 0 && `🩸${celda.sangre_sugerida}`}
                                </div>
                              )}
                              {celda.notas && <div className="text-[9px] mt-0.5">📝</div>}
                            </>
                          ) : (
                            <span className="text-slate-300">✏️ agregar</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5">
                    <button onClick={() => eliminarSemana(semana)} title="Eliminar esta semana completa" className="text-slate-300 hover:text-rose-500">🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={agregarSemana} className="text-xs text-violet-500 px-3 py-2">+ Agregar semana</button>
        </div>
      )}

      {editando && (
        <CeldaEditor celda={celdaDe(editando.gradoId, editando.semana)} gradoId={editando.gradoId} periodo={periodo} semana={editando.semana}
          onCerrar={() => setEditando(null)} onGuardado={() => { setEditando(null); cargar(); }} onBorrado={() => { setEditando(null); cargar(); }} />
      )}

      {moverAbierto && (
        <MoverPeriodoModal cursosIds={cursosIds} periodoActual={periodo}
          onCerrar={() => setMoverAbierto(false)} onMovido={() => { setMoverAbierto(false); cargar(); }} />
      )}
    </div>
  );
}
