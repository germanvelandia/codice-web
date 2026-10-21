import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { fetchHistorialGamificacion } from "../lib/api";
import { descargarArchivo } from "../lib/informeImpacto";

// Lo que Preguntados da por acierto y por corona
const XP_ACIERTO = 5, MON_ACIERTO = 2, MON_CORONA = 15;

export function VistaRankingGanancias({ grados = [] }) {
  const [gradoId, setGradoId] = useState("todos");
  const [filas, setFilas] = useState(null);
  const [orden, setOrden] = useState("xp");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(null);
  const [det, setDet] = useState(null);

  const cargar = async () => {
    setCargando(true); setError(""); setAbierto(null);
    try {
      let ests = [];
      for (let d = 0; ; d += 1000) {
        let q = supabase.from("estudiantes").select("id, nombre, grado_id, activo").order("id").range(d, d + 999);
        if (gradoId !== "todos") q = q.eq("grado_id", gradoId);
        const r = await q; if (r.error) throw r.error;
        ests.push(...(r.data || []));
        if (!r.data || r.data.length < 1000) break;
      }
      const gr = await supabase.from("grados").select("id, nombre");
      const nom = new Map((gr.data || grados).map((g) => [String(g.id), g.nombre || g.id]));
      const info = new Map(ests.map((e) => [String(e.id), e]));
      const rp = await supabase.rpc("ranking_ganancias", { p_estudiantes: ests.map((e) => e.id) });
      if (rp.error) throw new Error("Falta correr el SQL 103 en Supabase (" + rp.error.message + ")");
      setFilas((rp.data || []).map((r) => {
        const e = info.get(String(r.estudiante_id)) || {};
        const xpTrivia = Number(r.aciertos_trivia) * XP_ACIERTO;
        const monTrivia = Number(r.aciertos_trivia) * MON_ACIERTO + Number(r.coronas) * MON_CORONA;
        return {
          id: r.estudiante_id, nombre: e.nombre || "?", curso: (nom.get(String(e.grado_id)) || "Sin curso") + (e.activo === false ? " (inactivo)" : ""),
          xp: Number(r.xp), monedas: Number(r.monedas), xpBit: Number(r.xp_bitacora), monBit: Number(r.monedas_bitacora),
          aciertos: Number(r.aciertos_trivia), respuestas: Number(r.respuestas_trivia), repetidos: Number(r.aciertos_repetidos), maxDia: Number(r.max_aciertos_dia),
          xpTrivia, monTrivia,
          // lo que tiene y no se explica ni por la bitácora ni por Preguntados
          xpSin: Number(r.xp) - Number(r.xp_bitacora) - xpTrivia,
          monSin: Number(r.monedas) - Number(r.monedas_bitacora) - monTrivia,
        };
      }));
    } catch (e) { setError(e.message || "No se pudo cargar."); }
    setCargando(false);
  };
  useEffect(() => { setFilas(null); }, [gradoId]);

  const lista = useMemo(() => [...(filas || [])].sort((a, b) => (b[orden] ?? 0) - (a[orden] ?? 0)), [filas, orden]);
  const abrir = async (f) => {
    if (abierto === f.id) { setAbierto(null); return; }
    setAbierto(f.id); setDet(null);
    try {
      const h = await fetchHistorialGamificacion(f.id);
      const por = {};
      h.forEach((x) => { const k = x.etiqueta || x.categoria || "(sin etiqueta)"; const p = (por[k] = por[k] || { n: 0, xp: 0, mon: 0 }); p.n++; p.xp += x.xp || 0; p.mon += x.monedas || 0; });
      setDet(Object.entries(por).sort((a, b) => b[1].xp - a[1].xp).slice(0, 8));
    } catch { setDet([]); }
  };
  const csv = () => {
    const rows = ["Curso;Estudiante;XP actual;XP bitácora;XP Preguntados (est.);XP sin explicar;Monedas actuales;Monedas bitácora;Monedas Preguntados (est.);Monedas sin explicar;Aciertos Preguntados;Aciertos repetidos;Máx. aciertos en un día"];
    lista.forEach((f) => rows.push([f.curso, f.nombre, f.xp, f.xpBit, f.xpTrivia, f.xpSin, f.monedas, f.monBit, f.monTrivia, f.monSin, f.aciertos, f.repetidos, f.maxDia].join(";")));
    descargarArchivo("ranking_ganancias.csv", "﻿" + rows.join("\r\n"));
  };
  const Num = ({ v, alerta }) => <b className={alerta ? "text-rose-600" : "text-slate-700"}>{v}</b>;

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">🏅 Ranking de ganancias: ¿de dónde sale el XP y el oro?</h3>
      <p className="text-xs text-slate-400 mb-3">Para cada estudiante compara lo que <b>tiene ahora</b> con lo que está <b>registrado en la bitácora</b> (misiones, acciones tuyas, etc.) y con lo que <b>dio Preguntados</b>. Lo que queda <b className="text-rose-600">sin explicar</b> vino de otra vía (clics repetidos, trampa o un fallo): ahí hay que mirar.</p>
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-lg px-3 py-2 border border-slate-200 bg-white outline-none">
          <option value="todos">Todos los cursos</option>
          {grados.map((g) => <option key={g.id} value={g.id}>{g.nombre || g.id}</option>)}
        </select>
        <button onClick={cargar} disabled={cargando} className="text-sm font-semibold px-4 py-2 rounded-xl bg-violet-500 text-white disabled:opacity-50">{cargando ? "Calculando…" : "📊 Calcular ranking"}</button>
        {filas && <select value={orden} onChange={(e) => setOrden(e.target.value)} className="text-sm rounded-lg px-3 py-2 border border-slate-200 bg-white outline-none">
          <option value="xp">Más XP</option><option value="monedas">Más monedas</option><option value="xpSin">Más XP sin explicar</option><option value="monSin">Más monedas sin explicar</option><option value="aciertos">Más aciertos en Preguntados</option><option value="maxDia">Más aciertos en un día</option>
        </select>}
        {filas && <button onClick={csv} className="text-xs font-semibold text-emerald-600">⬇ CSV</button>}
      </div>
      {error && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2 mb-2">{error}</div>}
      {filas && (
        <div className="space-y-1">
          {lista.slice(0, 60).map((f, i) => {
            const sospechoso = f.xpSin > 100 || f.monSin > 60 || f.repetidos > 3 || f.maxDia > 40;
            return (
              <div key={f.id} className={`rounded-xl border ${sospechoso ? "border-rose-300 bg-rose-50/50" : "border-slate-100 bg-white"}`}>
                <button onClick={() => abrir(f)} className="w-full text-left px-3 py-2">
                  <div className="flex justify-between gap-2 items-center">
                    <span className="text-sm text-slate-700 truncate"><span className="text-slate-400">{i + 1}.</span> {f.nombre} <span className="text-slate-400 text-xs">· {f.curso}</span> {sospechoso && "🚩"}</span>
                    <span className="text-xs shrink-0">⭐ <Num v={f.xp} /> · 🪙 <Num v={f.monedas} /></span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    XP: bitácora {f.xpBit} · Preguntados ~{f.xpTrivia} · <Num v={`sin explicar ${f.xpSin}`} alerta={f.xpSin > 100} />
                    {"  |  "}Oro: bitácora {f.monBit} · Preguntados ~{f.monTrivia} · <Num v={`sin explicar ${f.monSin}`} alerta={f.monSin > 60} />
                  </div>
                  <div className="text-[11px] text-slate-400">Preguntados: {f.aciertos} aciertos de {f.respuestas} · {f.repetidos} repetidos · máx. {f.maxDia} aciertos en un día</div>
                </button>
                {abierto === f.id && (
                  <div className="px-3 pb-2 border-t border-slate-100 text-xs">
                    <div className="mt-2 font-semibold text-slate-600">Lo que más le sumó la bitácora</div>
                    {det === null ? <p className="text-slate-400">Cargando…</p> : det.length === 0 ? <p className="text-slate-400">Sin registros en la bitácora.</p> : det.map(([k, v]) => (
                      <div key={k} className="flex justify-between text-slate-500 py-0.5"><span className="truncate">{k} <span className="text-slate-400">×{v.n}</span></span><span className="shrink-0">⭐{v.xp} · 🪙{v.mon}</span></div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {lista.length > 60 && <p className="text-[11px] text-slate-400">Mostrando los 60 primeros de {lista.length}; el CSV trae a todos.</p>}
        </div>
      )}
    </div>
  );
}
