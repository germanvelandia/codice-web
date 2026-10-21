import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { fetchEstudiantesPorGrado, fetchHistorialGamificacion } from "../lib/api";
import { descargarArchivo } from "../lib/informeImpacto";

const prog = (s) => (Array.isArray(s.progreso) ? s.progreso[0] : s.progreso) || {};

export function VistaRecompensasDocente({ grados = [] }) {
  const [gradoId, setGradoId] = useState(grados[0]?.id ?? "");
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [orden, setOrden] = useState("nombre");
  const [abierto, setAbierto] = useState(null);
  const [detalle, setDetalle] = useState([]);
  useEffect(() => { if (!gradoId && grados[0]) setGradoId(grados[0].id); }, [grados]);

  useEffect(() => {
    if (!gradoId) return;
    let vivo = true;
    (async () => {
      setCargando(true); setError(""); setAbierto(null);
      try {
        const ests = await fetchEstudiantesPorGrado(gradoId);
        const ids = ests.map((e) => e.id);
        let inv = [];
        if (ids.length) {
          const r = await supabase.from("estudiante_objetos").select("estudiante_id, cantidad, objetos_catalogo(nombre, emoji)").in("estudiante_id", ids).gt("cantidad", 0);
          if (r.error) throw r.error;
          inv = r.data || [];
        }
        const porEst = new Map();
        inv.forEach((i) => { const a = porEst.get(String(i.estudiante_id)) || []; a.push(i); porEst.set(String(i.estudiante_id), a); });
        const f = ests.map((e) => {
          const p = prog(e), objs = porEst.get(String(e.id)) || [];
          return { id: e.id, nombre: e.nombre, monedas: p.monedas || 0, xp: p.xp || 0, vida: p.vida ?? 100, objetos: objs, nObjetos: objs.reduce((a, o) => a + o.cantidad, 0) };
        });
        if (vivo) setFilas(f);
      } catch (e) { if (vivo) setError(e.message || "No se pudo cargar."); }
      if (vivo) setCargando(false);
    })();
    return () => { vivo = false; };
  }, [gradoId]);

  const lista = useMemo(() => {
    const l = [...filas];
    if (orden === "nombre") l.sort((a, b) => a.nombre.localeCompare(b.nombre));
    else l.sort((a, b) => b[orden] - a[orden]);
    return l;
  }, [filas, orden]);
  const tot = useMemo(() => ({ monedas: filas.reduce((a, f) => a + f.monedas, 0), xp: filas.reduce((a, f) => a + f.xp, 0), obj: filas.reduce((a, f) => a + f.nObjetos, 0) }), [filas]);

  const abrir = async (f) => {
    if (abierto === f.id) { setAbierto(null); return; }
    setAbierto(f.id); setDetalle(null);
    try { setDetalle((await fetchHistorialGamificacion(f.id)).slice(0, 15)); } catch { setDetalle([]); }
  };
  const csv = () => {
    const g = grados.find((x) => String(x.id) === String(gradoId));
    const rows = ["Estudiante;Monedas;XP;Vida;Objetos"];
    lista.forEach((f) => rows.push([f.nombre, f.monedas, f.xp, f.vida, f.objetos.map((o) => `${o.objetos_catalogo?.nombre} x${o.cantidad}`).join(" | ")].join(";")));
    descargarArchivo(`recompensas_${String(g?.nombre || gradoId).replace(/\W+/g, "_")}.csv`, "﻿" + rows.join("\r\n"));
  };

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">🎁 Recompensas de los estudiantes</h3>
      <p className="text-xs text-slate-400 mb-3">Lo que cada estudiante tiene ahora: monedas, XP, vida y objetos. Toca un nombre para ver sus últimos movimientos.</p>
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-lg px-3 py-2 border border-slate-200 bg-white outline-none">
          {grados.map((g) => <option key={g.id} value={g.id}>{g.nombre || g.id}</option>)}
        </select>
        <select value={orden} onChange={(e) => setOrden(e.target.value)} className="text-sm rounded-lg px-3 py-2 border border-slate-200 bg-white outline-none">
          <option value="nombre">Orden: nombre</option><option value="monedas">Más monedas</option><option value="xp">Más XP</option><option value="nObjetos">Más objetos</option>
        </select>
        <button onClick={csv} disabled={!filas.length} className="text-xs font-semibold text-emerald-600 disabled:opacity-40">⬇ CSV</button>
      </div>
      {error && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2 mb-2">{error}</div>}
      {cargando ? <p className="text-xs text-slate-400">Cargando…</p> : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <div className="bg-amber-50 rounded-xl p-2"><div className="text-[10px] text-amber-600">🪙 Monedas del curso</div><div className="text-lg font-black text-amber-700">{tot.monedas}</div></div>
            <div className="bg-violet-50 rounded-xl p-2"><div className="text-[10px] text-violet-600">⭐ XP del curso</div><div className="text-lg font-black text-violet-700">{tot.xp}</div></div>
            <div className="bg-emerald-50 rounded-xl p-2"><div className="text-[10px] text-emerald-600">🎒 Objetos</div><div className="text-lg font-black text-emerald-700">{tot.obj}</div></div>
          </div>
          <div className="space-y-1">
            {lista.map((f) => (
              <div key={f.id} className="bg-white border border-slate-100 rounded-xl">
                <button onClick={() => abrir(f)} className="w-full text-left px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-700 truncate">{f.nombre}</span>
                  <span className="text-xs text-slate-500 shrink-0">🪙 {f.monedas} · ⭐ {f.xp} · ❤️ {f.vida} · 🎒 {f.nObjetos}</span>
                </button>
                {abierto === f.id && (
                  <div className="px-3 pb-2 border-t border-slate-100 text-xs">
                    <div className="mt-2 text-slate-600"><b>Objetos:</b> {f.objetos.length ? f.objetos.map((o) => `${o.objetos_catalogo?.emoji || "🎒"} ${o.objetos_catalogo?.nombre || "?"} ×${o.cantidad}`).join("  ·  ") : "ninguno"}</div>
                    <div className="mt-2 font-semibold text-slate-600">Últimos movimientos</div>
                    {detalle === null ? <p className="text-slate-400">Cargando…</p> : detalle.length === 0 ? <p className="text-slate-400">Sin movimientos.</p> : detalle.map((h, i) => (
                      <div key={i} className="flex justify-between text-slate-500 py-0.5"><span className="truncate">{h.etiqueta || h.categoria || "—"}</span><span className="shrink-0">{h.xp ? `⭐${h.xp > 0 ? "+" : ""}${h.xp} ` : ""}{h.monedas ? `🪙${h.monedas > 0 ? "+" : ""}${h.monedas} ` : ""}{h.vida ? `❤️${h.vida > 0 ? "+" : ""}${h.vida}` : ""}</span></div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!lista.length && <p className="text-xs text-slate-400">No hay estudiantes en este curso.</p>}
          </div>
        </>
      )}
    </div>
  );
}
