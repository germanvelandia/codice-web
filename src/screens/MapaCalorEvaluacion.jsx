import React, { useEffect, useMemo, useState } from "react";
import * as api from "../lib/api";

const hsl = (pct) => `hsl(${Math.round(pct * 1.2)}, 68%, 46%)`;
const CELDA = {
  ok: { bg: "#16a34a", txt: "✓", titulo: "Correcta" },
  mal: { bg: "#dc2626", txt: "✕", titulo: "Incorrecta" },
  vacia: { bg: "#94a3b8", txt: "–", titulo: "Sin responder" },
  pend: { bg: "#f59e0b", txt: "⏳", titulo: "Por calificar" },
  parcial: { bg: "#84cc16", txt: "◐", titulo: "Parcial" },
};

export function MapaCalorEvaluacion({ evaluacion, onCerrar }) {
  const [datos, setDatos] = useState(null); const [error, setError] = useState("");
  const [orden, setOrden] = useState("nota"); const [colAbierta, setColAbierta] = useState(null);

  useEffect(() => { api.fetchMapaCalor(evaluacion).then(setDatos).catch((e) => setError(e.message || String(e))); }, [evaluacion.id]);

  const m = useMemo(() => {
    if (!datos) return null;
    const { preguntas, estudiantes, mejor, respuestas } = datos;
    const porIntento = {}; respuestas.forEach((r) => { (porIntento[r.intento_id] = porIntento[r.intento_id] || {})[r.pregunta_id] = r; });
    const estado = (p, r) => {
      if (!r) return null; // no le tocó esta pregunta
      if (p.tipo === "respuesta_corta") {
        if (r.puntos_obtenidos === null || r.puntos_obtenidos === undefined) return String(r.respuesta || "").trim() ? "pend" : "vacia";
        const max = Number(p.puntos) || 1; const o = Number(r.puntos_obtenidos) || 0;
        return o >= max ? "ok" : o > 0 ? "parcial" : "mal";
      }
      if (!String(r.respuesta || "").trim()) return "vacia";
      return r.correcta ? "ok" : "mal";
    };
    const filas = estudiantes.map((e) => {
      const i = mejor[String(e.id)]; if (!i) return { e, presento: false, celdas: [], pct: null };
      const rs = porIntento[i.id] || {}; const celdas = preguntas.map((p) => estado(p, rs[p.id]));
      const max = Number(i.puntaje_maximo) || 0;
      return { e, presento: true, i, celdas, pct: max > 0 ? Math.round(((Number(i.puntaje_obtenido) || 0) / max) * 100) : 0, salidas: i.salidas || 0, cerrado: !!i.cerrado_por_salida };
    });
    const colStats = preguntas.map((p, j) => {
      const c = filas.filter((f) => f.presento && f.celdas[j]);
      const ok = c.filter((f) => f.celdas[j] === "ok").length;
      return { n: c.length, ok, pct: c.length ? Math.round((ok / c.length) * 100) : null };
    });
    const presentaron = filas.filter((f) => f.presento);
    const promedio = presentaron.length ? Math.round(presentaron.reduce((a, f) => a + f.pct, 0) / presentaron.length) : null;
    return { preguntas, filas, colStats, promedio, presentaron: presentaron.length, total: filas.length, porIntento };
  }, [datos]);

  const filasOrdenadas = useMemo(() => {
    if (!m) return [];
    const a = [...m.filas.filter((f) => f.presento)];
    a.sort(orden === "nota" ? (x, y) => y.pct - x.pct || x.e.nombre.localeCompare(y.e.nombre, "es") : (x, y) => x.e.nombre.localeCompare(y.e.nombre, "es"));
    return [...a, ...m.filas.filter((f) => !f.presento).sort((x, y) => x.e.nombre.localeCompare(y.e.nombre, "es"))];
  }, [m, orden]);

  const detalle = useMemo(() => {
    if (!m || colAbierta === null) return null;
    const p = m.preguntas[colAbierta]; const cuenta = {}; let sin = 0;
    m.filas.forEach((f) => { if (!f.presento) return; const r = m.porIntento[f.i.id]?.[p.id]; if (!r) return; const t = String(r.respuesta || "").trim(); if (!t) sin++; else cuenta[t] = (cuenta[t] || 0) + 1; });
    const total = Object.values(cuenta).reduce((a, b) => a + b, 0) + sin;
    const opciones = (p.opciones || []).map((o) => ({ texto: o.texto, correcta: !!o.correcta, n: cuenta[o.texto] || 0 }));
    return { p, opciones, sin, total, otras: p.tipo === "respuesta_corta" ? Object.entries(cuenta).map(([texto, n]) => ({ texto, n })) : [] };
  }, [m, colAbierta]);

  const dificiles = m ? m.preguntas.map((p, j) => ({ j, pct: m.colStats[j].pct })).filter((x) => x.pct !== null).sort((a, b) => a.pct - b.pct).slice(0, 3) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4" style={{ background: "rgba(15,23,42,0.6)" }} onClick={onCerrar}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-100">
          <div>
            <h3 className="font-extrabold text-slate-800">🔥 Mapa de calor — {evaluacion.titulo}</h3>
            <p className="text-[11px] text-slate-400">Se toma el mejor intento de cada estudiante. Haz clic en el encabezado de una pregunta para ver cómo respondió el grupo.</p>
          </div>
          <button onClick={onCerrar} className="text-slate-400 text-lg leading-none">✕</button>
        </div>
        {error ? <div className="p-4 text-sm text-rose-600">{error}</div> : !m ? <div className="p-6 text-sm text-slate-400">Cargando…</div> : m.presentaron === 0 ? (
          <div className="p-6 text-sm text-slate-500">Todavía nadie ha entregado esta evaluación.</div>
        ) : (
          <div className="overflow-auto p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-2xl font-extrabold" style={{ color: hsl(m.promedio) }}>{m.promedio}%</div><div className="text-[11px] text-slate-500">promedio del grupo</div></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-2xl font-extrabold text-slate-700">{m.presentaron}/{m.total}</div><div className="text-[11px] text-slate-500">presentaron</div></div>
              <div className="rounded-xl bg-rose-50 p-3 col-span-2 text-left"><div className="text-[11px] font-semibold text-rose-700 mb-0.5">Preguntas más difíciles</div>
                <div className="flex flex-wrap gap-1">{dificiles.map((d) => <button key={d.j} onClick={() => setColAbierta(d.j)} className="text-[11px] px-2 py-0.5 rounded-full text-white font-semibold" style={{ background: hsl(d.pct) }}>P{d.j + 1} · {d.pct}%</button>)}</div></div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
              {Object.entries(CELDA).map(([k, c]) => <span key={k} className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded text-white text-[10px] text-center leading-4" style={{ background: c.bg }}>{c.txt}</span>{c.titulo}</span>)}
              <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded border border-slate-200" style={{ background: "repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9 3px,#e2e8f0 3px,#e2e8f0 6px)" }} />No le tocó</span>
              <span className="ml-auto">Ordenar: <button onClick={() => setOrden("nota")} className={`px-2 py-0.5 rounded-full ${orden === "nota" ? "bg-violet-500 text-white" : "bg-slate-100"}`}>por nota</button> <button onClick={() => setOrden("nombre")} className={`px-2 py-0.5 rounded-full ${orden === "nombre" ? "bg-violet-500 text-white" : "bg-slate-100"}`}>A–Z</button></span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="text-xs border-separate" style={{ borderSpacing: 2 }}>
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-white z-10 text-left px-2 py-1 min-w-[190px] text-slate-500">Estudiante</th>
                    <th className="px-1 text-slate-500">Nota</th>
                    {m.preguntas.map((p, j) => (
                      <th key={p.id} className="p-0">
                        <button onClick={() => setColAbierta(colAbierta === j ? null : j)} title={p.enunciado}
                          className={`w-9 rounded-md text-white font-bold py-1 ${colAbierta === j ? "ring-2 ring-slate-800" : ""}`} style={{ background: m.colStats[j].pct === null ? "#94a3b8" : hsl(m.colStats[j].pct) }}>
                          <div className="text-[10px]">P{j + 1}</div><div className="text-[10px] font-extrabold">{m.colStats[j].pct === null ? "–" : `${m.colStats[j].pct}%`}</div>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filasOrdenadas.map((f) => (
                    <tr key={f.e.id} className={f.presento ? "" : "opacity-60"}>
                      <td className="sticky left-0 bg-white z-10 px-2 py-0.5 whitespace-nowrap text-slate-700">
                        {f.e.nombre}{f.salidas > 0 && <span title={`Salió de la pantalla ${f.salidas} vez(veces)${f.cerrado ? " — evaluación cerrada por salir" : ""}`} className="ml-1 text-[10px] text-rose-600">🚪{f.salidas}</span>}
                      </td>
                      {f.presento ? <td className="px-1 text-center font-bold text-white rounded" style={{ background: hsl(f.pct) }}>{f.pct}%</td> : <td className="px-1 text-center text-[10px] text-slate-400" colSpan={1}>No presentó</td>}
                      {m.preguntas.map((p, j) => {
                        const c = f.presento ? f.celdas[j] : undefined;
                        if (!f.presento) return <td key={p.id} className="w-9 h-6 rounded bg-slate-50" />;
                        if (c === null) return <td key={p.id} title="No le tocó esta pregunta" className="w-9 h-6 rounded" style={{ background: "repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9 3px,#e2e8f0 3px,#e2e8f0 6px)" }} />;
                        const cc = CELDA[c];
                        return <td key={p.id} title={`${CELDA[c].titulo}: ${m.porIntento[f.i.id]?.[p.id]?.respuesta || "(vacía)"}`} className="w-9 h-6 rounded text-center text-white font-bold cursor-help" style={{ background: cc.bg }}>{cc.txt}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {detalle && (
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div className="text-sm font-bold text-slate-800">P{colAbierta + 1}. {detalle.p.enunciado}</div>
                  <button onClick={() => setColAbierta(null)} className="text-slate-400 text-xs">cerrar</button>
                </div>
                {detalle.p.tipo === "respuesta_corta" ? (
                  <div className="space-y-1 text-xs">{detalle.otras.length === 0 ? <span className="text-slate-400">Sin respuestas.</span> : detalle.otras.map((o, i) => <div key={i} className="bg-slate-50 rounded-lg px-3 py-1.5 text-slate-700">“{o.texto}” {o.n > 1 && <b>×{o.n}</b>}</div>)}</div>
                ) : (
                  <div className="space-y-1.5">
                    {detalle.opciones.map((o, i) => {
                      const pct = detalle.total ? Math.round((o.n / detalle.total) * 100) : 0;
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <div className="w-1/2 sm:w-2/5 truncate" title={o.texto}>{o.correcta ? "✅ " : ""}{o.texto}</div>
                          <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden"><div className="h-4 rounded-full" style={{ width: `${pct}%`, background: o.correcta ? "#16a34a" : "#ef4444" }} /></div>
                          <div className="w-16 text-right text-slate-600">{o.n} ({pct}%)</div>
                        </div>
                      );
                    })}
                    {detalle.sin > 0 && <div className="text-[11px] text-slate-400">Sin responder: {detalle.sin}</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
