import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { agruparPorNivel, nivelYCurso } from "../lib/gamification";

export function VistaSalonHonor({ grados }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState("individual"); // "individual" | "reinos"

  useEffect(() => { api.fetchSalonDeHonor().then((d) => { setDatos(d); setCargando(false); }); }, []);

  return (
    <div>
      <div className="flex gap-1 rounded-full bg-slate-100 p-1 mb-4 w-fit">
        <button onClick={() => setTab("individual")} className={`text-xs font-semibold px-3 py-1.5 rounded-full ${tab === "individual" ? "bg-white shadow-sm" : "text-slate-500"}`}>🏆 Individual</button>
        <button onClick={() => setTab("reinos")} className={`text-xs font-semibold px-3 py-1.5 rounded-full ${tab === "reinos" ? "bg-white shadow-sm" : "text-slate-500"}`}>🏰 Por Reinos</button>
      </div>
      {tab === "reinos" ? <RankingReinosPanel grados={grados} /> : <SalonHonorIndividual datos={datos} cargando={cargando} />}
    </div>
  );
}

function SalonHonorIndividual({ datos, cargando }) {
  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;

  const medalla = (i) => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">🏆 Salón de Honor</h2>
      <p className="text-sm text-slate-400 mb-4">Ranking institucional — cruza todos los grados a la vez.</p>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="font-bold text-slate-800 mb-3">⭐ Más XP acumulada</div>
          {datos.topXp.length === 0 ? (
            <p className="text-xs text-slate-400">Todavía no hay datos.</p>
          ) : (
            <div className="space-y-1.5">
              {datos.topXp.map((e, i) => (
                <div key={e.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm w-6 text-center shrink-0">{medalla(i)}</span>
                    <span className="text-xs font-semibold text-slate-700 truncate">{e.nombre}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">Grado {e.grado_id}</span>
                  </div>
                  <span className="text-xs font-bold text-violet-600 shrink-0">{e.xp} XP</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="font-bold text-slate-800 mb-3">🏅 Más insignias</div>
          {datos.topInsignias.length === 0 ? (
            <p className="text-xs text-slate-400">Todavía no hay insignias desbloqueadas.</p>
          ) : (
            <div className="space-y-1.5">
              {datos.topInsignias.map((e, i) => (
                <div key={e.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm w-6 text-center shrink-0">{medalla(i)}</span>
                    <span className="text-xs font-semibold text-slate-700 truncate">{e.nombre}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">Grado {e.grado_id}</span>
                  </div>
                  <span className="text-xs font-bold text-amber-600 shrink-0">{e.cantidad} 🏅</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="font-bold text-slate-800 mb-3">📜 Muro de logros recientes</div>
        {datos.muroReciente.length === 0 ? (
          <p className="text-xs text-slate-400">Todavía no se desbloqueó ningún logro.</p>
        ) : (
          <div className="space-y-1.5">
            {datos.muroReciente.map((l) => (
              <div key={l.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-lg shrink-0">{l.logro_emoji}</span>
                <div className="text-xs min-w-0">
                  <span className="font-semibold text-slate-700">{l.estudiante_nombre}</span>
                  <span className="text-slate-400"> (Grado {l.grado_id}) desbloqueó </span>
                  <span className="font-semibold text-violet-600">{l.logro_nombre}</span>
                </div>
                <span className="text-[10px] text-slate-400 ml-auto shrink-0">{new Date(l.desbloqueado_en).toLocaleDateString("es-CO")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== 🏰 Ranking de Reinos ====================
// Combina % de asistencia (calculado solo) con puntos de compañerismo y
// trabajo en equipo (que el docente otorga a mano, permanentes por
// Reino) — el peso de cada uno lo elige el docente en el momento.
function RankingReinosPanel({ grados }) {
  const niveles = agruparPorNivel(grados || []);
  const [gradoId, setGradoId] = useState(grados?.[0]?.id || "");
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [pesoAsistencia, setPesoAsistencia] = useState(50);
  const [ajustando, setAjustando] = useState(null); // reino elegido para sumar/restar puntos
  const [pasandoAPlanilla, setPasandoAPlanilla] = useState(false);

  const cargar = () => {
    if (!gradoId) return;
    setCargando(true);
    api.fetchDatosRankingReinos(gradoId).then((d) => { setDatos(d); setCargando(false); });
  };
  useEffect(() => { cargar(); }, [gradoId]);

  const pesoCompania = 100 - pesoAsistencia;

  // Normaliza los puntos de compañerismo a una escala de 0 a 100 relativa
  // a los Reinos de ESTE curso — así siempre es comparable con el % de
  // asistencia, sin importar si los puntos absolutos son 5 o 500.
  const ranking = (() => {
    if (!datos || datos.length === 0) return [];
    const puntos = datos.map((r) => r.puntosCompania);
    const min = Math.min(...puntos), max = Math.max(...puntos);
    return datos
      .map((r) => {
        const companiaNorm = max === min ? 100 : ((r.puntosCompania - min) / (max - min)) * 100;
        const asistenciaNorm = r.asistenciaPct ?? 0;
        const puntaje = (asistenciaNorm * pesoAsistencia + companiaNorm * pesoCompania) / 100;
        return { ...r, puntaje: Math.round(puntaje * 10) / 10 };
      })
      .sort((a, b) => b.puntaje - a.puntaje);
  })();

  const medalla = (i) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {niveles.map((n) => (
          <button key={n.nivel} onClick={() => setGradoId(n.cursos[0]?.id)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full ${nivelYCurso(gradoId).nivel === n.nivel ? "bg-violet-500 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
            Grado {n.nivel}°
          </button>
        ))}
        <span className="w-px h-5 bg-slate-200 mx-1" />
        {(niveles.find((n) => n.nivel === nivelYCurso(gradoId).nivel)?.cursos || []).map((c) => (
          <button key={c.id} onClick={() => setGradoId(c.id)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full ${gradoId === c.id ? "bg-violet-500 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
            Curso {c.id}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Cómo se pondera el ranking</div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 w-28 shrink-0">📋 Asistencia</span>
          <input type="range" min={0} max={100} value={pesoAsistencia} onChange={(e) => setPesoAsistencia(parseInt(e.target.value, 10))} className="flex-1" />
          <span className="text-xs font-bold text-violet-600 w-10 text-right shrink-0">{pesoAsistencia}%</span>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-slate-500 w-28 shrink-0">🤝 Compañerismo</span>
          <div className="flex-1" />
          <span className="text-xs font-bold text-amber-600 w-10 text-right shrink-0">{pesoCompania}%</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">El % de compañerismo se calcula solo, relativo entre los Reinos de este curso — no depende de un puntaje fijo.</p>
      </div>

      {cargando ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : ranking.length === 0 ? (
        <p className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">Todavía no hay Reinos con estudiantes en este curso.</p>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-3">
            <div className="space-y-1.5">
              {ranking.map((r, i) => (
                <div key={r.nombre} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base w-7 text-center shrink-0">{medalla(i)}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate">{r.nombre}</div>
                      <div className="text-[11px] text-slate-400">
                        📋 {r.asistenciaPct !== null ? `${r.asistenciaPct}%` : "sin datos"} · 🤝 {r.puntosCompania} pts · {r.estudiantes.length} estudiante{r.estudiantes.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-lg font-bold text-violet-600">{r.puntaje}</span>
                    <button onClick={() => setAjustando(r)} disabled={!r.reinoId} title={r.reinoId ? "Ajustar puntos de compañerismo" : "Este nombre no está en el catálogo de Reinos"} className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30">🏦</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => setPasandoAPlanilla(true)} className="text-sm font-semibold px-4 py-2.5 rounded-xl bg-violet-500 text-white">📋 Pasar este ranking a la Planilla</button>
        </>
      )}

      {ajustando && <AjustarPuntosCompaniaModal reino={ajustando} onClose={() => setAjustando(null)} onGuardado={() => { setAjustando(null); cargar(); }} />}
      {pasandoAPlanilla && <PasarRankingAPlanillaModal ranking={ranking} gradoId={gradoId} onClose={() => setPasandoAPlanilla(false)} />}
    </div>
  );
}

function AjustarPuntosCompaniaModal({ reino, onClose, onGuardado }) {
  const [delta, setDelta] = useState(5);
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  const aplicar = async (signo) => {
    const valor = parseInt(delta, 10) || 0;
    if (valor === 0) return;
    setGuardando(true);
    try {
      await api.ajustarPuntosCompania(reino.reinoId, valor * signo, motivo.trim() || null);
      onGuardado();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">🏦 {reino.nombre} — Compañerismo</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-400 mb-3">Tiene <b>{reino.puntosCompania}</b> puntos permanentes de compañerismo y trabajo en equipo.</p>
        <label className="text-xs text-slate-500 block mb-1">Cantidad</label>
        <input type="number" min={1} value={delta} onChange={(e) => setDelta(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none" />
        <label className="text-xs text-slate-500 block mb-1">Motivo (opcional)</label>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: ayudaron a otro Reino en el reto de hoy" className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />
        <div className="flex gap-2">
          <button disabled={guardando} onClick={() => aplicar(-1)} className="flex-1 text-sm font-semibold px-3 py-2 rounded-lg bg-rose-50 text-rose-600 disabled:opacity-50">− Restar</button>
          <button disabled={guardando} onClick={() => aplicar(1)} className="flex-1 text-sm font-semibold px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 disabled:opacity-50">+ Sumar</button>
        </div>
      </div>
    </div>
  );
}

// Convierte el ranking en una actividad calificable — con las dos formas
// que se pidieron: aplicarla a TODOS los estudiantes del Reino por igual,
// o desmarcar puntualmente a quien el docente considere que no participó.
function PasarRankingAPlanillaModal({ ranking, gradoId, onClose }) {
  const [materias, setMaterias] = useState([]);
  const [materiaId, setMateriaId] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [categoriaId, setCategoriaId] = useState(null);
  const [periodo, setPeriodo] = useState("1");
  const [nombreActividad, setNombreActividad] = useState("Ranking de Reinos — compañerismo y asistencia");
  const [escala, setEscala] = useState({ escala_min: 1, nota_maxima: 5 });
  const [excluidos, setExcluidos] = useState(new Set()); // ids de estudiantes desmarcados a mano
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { api.fetchMisMaterias().then(setMaterias); }, []);
  useEffect(() => {
    if (!materiaId) return;
    api.fetchCategorias(materiaId).then(setCategorias);
    api.fetchNotasConfig(materiaId).then((c) => setEscala({ escala_min: c?.escala_min ?? 1, nota_maxima: c?.nota_maxima ?? 5 }));
  }, [materiaId]);

  // El puntaje del ranking (0 a 100) escalado a la escala de notas de la materia.
  const notaDeReino = (r) => Math.round((escala.escala_min + (r.puntaje / 100) * (escala.nota_maxima - escala.escala_min)) * 10) / 10;

  const toggleEstudiante = (id) => setExcluidos((prev) => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });

  const totalIncluidos = ranking.reduce((a, r) => a + r.estudiantes.filter((e) => !excluidos.has(e.id)).length, 0);

  const aplicar = async () => {
    if (!materiaId || !categoriaId) { alert("Elegí la materia y la categoría de la Planilla."); return; }
    setGuardando(true);
    try {
      const notasPorEstudiante = {};
      ranking.forEach((r) => {
        const nota = notaDeReino(r);
        r.estudiantes.forEach((e) => { if (!excluidos.has(e.id)) notasPorEstudiante[e.id] = nota; });
      });
      await api.aplicarRankingReinosAPlanilla(materiaId, categoriaId, periodo, nombreActividad.trim() || "Ranking de Reinos", notasPorEstudiante);
      alert(`Listo — se creó la actividad "${nombreActividad}" con nota a ${Object.keys(notasPorEstudiante).length} estudiante(s).`);
      onClose();
    } catch (e) {
      alert("Error al aplicar: " + e.message);
    }
    setGuardando(false);
  };

  const inputCls = "w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[88vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">📋 Pasar el ranking a la Planilla</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        <label className="text-xs text-slate-500 block mb-1">Nombre de la actividad</label>
        <input value={nombreActividad} onChange={(e) => setNombreActividad(e.target.value)} className={`${inputCls} mb-2`} />

        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Materia</label>
            <select value={materiaId || ""} onChange={(e) => setMateriaId(parseInt(e.target.value, 10) || null)} className={inputCls}>
              <option value="">Elegí una materia</option>
              {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Periodo</label>
            <input value={periodo} onChange={(e) => setPeriodo(e.target.value)} className={inputCls} />
          </div>
        </div>

        <label className="text-xs text-slate-500 block mb-1">Categoría de la Planilla</label>
        <select value={categoriaId || ""} onChange={(e) => setCategoriaId(parseInt(e.target.value, 10) || null)} disabled={!materiaId} className={`${inputCls} mb-3 disabled:opacity-50`}>
          <option value="">{materiaId ? "Elegí una categoría" : "Elegí primero la materia"}</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({c.porcentaje}%)</option>)}
        </select>

        <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Nota por Reino (escala {escala.escala_min} a {escala.nota_maxima})</div>
        <div className="space-y-2 mb-3">
          {ranking.map((r) => (
            <div key={r.nombre} className="bg-slate-50 rounded-xl p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold text-slate-800">{r.nombre}</span>
                <span className="text-sm font-bold text-violet-600">Nota: {notaDeReino(r)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.estudiantes.map((e) => (
                  <label key={e.id} className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full cursor-pointer ${excluidos.has(e.id) ? "bg-slate-200 text-slate-400 line-through" : "bg-white border border-slate-200 text-slate-600"}`}>
                    <input type="checkbox" checked={!excluidos.has(e.id)} onChange={() => toggleEstudiante(e.id)} className="w-3 h-3" />
                    {e.nombre}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mb-3">Todos empiezan marcados (reciben la nota de su Reino) — desmarcá a quien no corresponda incluir.</p>

        <button disabled={guardando || totalIncluidos === 0} onClick={aplicar} className="w-full text-sm font-semibold px-4 py-2.5 rounded-xl bg-violet-500 text-white disabled:opacity-50">
          {guardando ? "Aplicando…" : `Aplicar a ${totalIncluidos} estudiante(s)`}
        </button>
      </div>
    </div>
  );
}
