// Prestigio: reconoce a quienes sobrepasan el nivel máximo de XP.
// Cada PRESTIGIO_PASO de XP extra = 1 estrella; la docente puede premiar cada estrella nueva con monedas.
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import * as api from "../lib/api";
import { useEstadoPersistente } from "../lib/api";
import { LEVELS, PRESTIGIO_PASO, estrellasPrestigio, textoEstrellas } from "../lib/gamification";

async function fetchPagos() {
  const { data, error } = await supabase.from("prestigio_pagos").select("*");
  if (error) throw error;
  const m = {}; (data || []).forEach((r) => { m[r.estudiante_id] = r.estrellas_pagadas; }); return m;
}

export function PanelPrestigio() {
  const [niveles, setNiveles] = useState(null);
  const [estudiantes, setEstudiantes] = useState([]);
  const [pagos, setPagos] = useState({});
  const [sinTabla, setSinTabla] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [monedasPorEstrella, setMonedasPorEstrella] = useEstadoPersistente("prestigio_monedas", 50);
  const [pagando, setPagando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const [n, est] = await Promise.all([api.fetchNivelesParaJuego().catch(() => null), api.fetchTodosEstudiantes()]);
    setNiveles(n && n.length ? n : LEVELS); setEstudiantes(est);
    try { setPagos(await fetchPagos()); setSinTabla(false); } catch (e) { setSinTabla(true); }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const filas = useMemo(() => {
    if (!niveles) return [];
    return estudiantes.map((e) => {
      const xp = (Array.isArray(e.progreso) ? e.progreso[0] : e.progreso)?.xp || 0;
      const estrellas = estrellasPrestigio(xp, niveles);
      const pagadas = Math.min(pagos[e.id] || 0, estrellas);
      return { id: e.id, nombre: e.nombre, grado: e.grado_id, xp, estrellas, pagadas, pendientes: estrellas - pagadas };
    }).filter((f) => f.estrellas > 0).sort((a, b) => b.xp - a.xp);
  }, [niveles, estudiantes, pagos]);
  const porPagar = filas.filter((f) => f.pendientes > 0);
  const totalMonedas = porPagar.reduce((t, f) => t + f.pendientes * (Number(monedasPorEstrella) || 0), 0);
  const ultimo = (niveles || LEVELS)[(niveles || LEVELS).length - 1];

  const pagar = async () => {
    const m = Number(monedasPorEstrella) || 0;
    if (!porPagar.length || m <= 0) return;
    if (!confirm(`Se darán ${totalMonedas} monedas en total a ${porPagar.length} estudiante(s) (${m} por cada estrella nueva). ¿Continuar?`)) return;
    setPagando(true);
    try {
      for (const f of porPagar) {
        const monedas = f.pendientes * m;
        await api.ajustarMonedas(f.id, monedas);
        try { await api.registrarHistorialPunto(f.id, "monedas", monedas, `Prestigio: ${f.pendientes} estrella(s) por superar el nivel máximo`); } catch (e) { /* historial opcional */ }
        const { error } = await supabase.from("prestigio_pagos").upsert({ estudiante_id: f.id, estrellas_pagadas: f.estrellas }, { onConflict: "estudiante_id" });
        if (error) throw error;
      }
      await cargar();
    } catch (e) { alert("Error al pagar: " + e.message); }
    setPagando(false);
  };

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">🌟 Prestigio</h2>
      <p className="text-sm text-slate-400 mb-4">
        Al llegar a <b>{ultimo.name}</b> ({ultimo.min} XP) la experiencia sigue contando: cada <b>{PRESTIGIO_PASO} XP</b> extra da una estrella
        ({ultimo.name}{textoEstrellas(1)}, {ultimo.name}{textoEstrellas(2)}…). Se ve en el nombre de su nivel en toda la app.
      </p>
      {sinTabla && <div className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-3">Falta ejecutar el SQL 89 en Supabase para poder pagar las estrellas (las estrellas ya se ven igual).</div>}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">Monedas por cada estrella nueva:</label>
        <input type="number" min="0" value={monedasPorEstrella} onChange={(e) => setMonedasPorEstrella(e.target.value)} className="w-20 text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
        <button disabled={pagando || sinTabla || !porPagar.length || !(Number(monedasPorEstrella) > 0)} onClick={pagar}
          className="ml-auto text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-40">
          {pagando ? "Pagando…" : porPagar.length ? `Premiar ${porPagar.length} estudiante(s) · ${totalMonedas} 🪙` : "Todo al día"}
        </button>
      </div>
      {filas.length === 0 ? (
        <p className="text-sm text-slate-400">Nadie ha superado todavía el nivel máximo + {PRESTIGIO_PASO} XP.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500"><tr>
              <th className="text-left px-3 py-2">Estudiante</th><th className="px-2">Curso</th><th className="px-2">XP</th><th className="px-2">Rango</th><th className="px-2">Por premiar</th></tr></thead>
            <tbody>{filas.map((f) => (
              <tr key={f.id} className="odd:bg-white even:bg-slate-50">
                <td className="px-3 py-1.5 font-medium text-slate-700">{f.nombre}</td>
                <td className="text-center text-slate-500">{f.grado}</td>
                <td className="text-center">{f.xp}</td>
                <td className="text-center text-amber-600 font-semibold">{ultimo.name}{textoEstrellas(f.estrellas)}</td>
                <td className="text-center">{f.pendientes > 0 ? <span className="text-emerald-600 font-semibold">+{f.pendientes * (Number(monedasPorEstrella) || 0)} 🪙</span> : <span className="text-slate-300">✓</span>}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
