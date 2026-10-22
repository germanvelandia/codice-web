import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

export function VistaPuntosConducta() {
  const [valores, setValores] = useState({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.fetchConductaPuntos(true).then((d) => {
      const v = {};
      api.CLAVES_CONDUCTA.forEach((c) => { v[c.clave] = { xp: String(d[c.clave]?.xp ?? 0), vida: String(d[c.clave]?.vida ?? 0) }; });
      setValores(v); setCargando(false);
    }).catch((e) => { setError(e.message); setCargando(false); });
  }, []);

  const cambiar = (clave, campo, texto) => setValores((p) => ({ ...p, [clave]: { ...p[clave], [campo]: texto } }));

  const guardar = async () => {
    setGuardando(true); setMsg(""); setError("");
    try {
      for (const c of api.CLAVES_CONDUCTA) {
        const v = valores[c.clave];
        const xp = parseInt(String(v.xp).replace(",", "."), 10); const vida = parseInt(String(v.vida).replace(",", "."), 10);
        if (Number.isNaN(xp) || Number.isNaN(vida)) throw new Error(`Revisa los números de «${c.label}».`);
        await api.guardarConductaPuntos(c.clave, xp, vida);
      }
      setMsg("✔ Guardado. Se aplica a los registros nuevos desde ahora.");
    } catch (e) {
      setError(e.message?.includes("conducta_puntos") ? "Falta correr el SQL 107_conducta_puntos.sql en Supabase." : (e.message || String(e)));
    }
    setGuardando(false);
  };

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;
  const grupos = [...new Set(api.CLAVES_CONDUCTA.map((c) => c.grupo))];

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">⚖️ Puntos por conducta</h3>
      <p className="text-xs text-slate-500 mb-3">
        Define cuánta experiencia (XP) y vida se quita o se da en cada caso. Para <b>quitar</b>, escribe un número negativo (por ejemplo <b>-5</b>); 0 significa que solo queda constancia en el Historial.
        Se aplica a los registros nuevos, no cambia lo ya registrado. Cada caso queda en el Historial del estudiante, con su fecha. De las anotaciones privadas solo se muestra el hecho y la fecha, nunca su texto.
      </p>
      {grupos.map((g) => (
        <div key={g} className="mb-4">
          <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500 mb-1.5">{g}</div>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            {api.CLAVES_CONDUCTA.filter((c) => c.grupo === g).map((c) => (
              <div key={c.clave} className="flex items-center gap-3 px-3 py-2 odd:bg-white even:bg-slate-50 border-t first:border-t-0 border-slate-100">
                <div className="flex-1 text-sm font-semibold text-slate-700">{c.label}</div>
                <label className="text-[11px] text-slate-500 flex items-center gap-1">⭐ XP
                  <input value={valores[c.clave]?.xp} onChange={(e) => cambiar(c.clave, "xp", e.target.value)} inputMode="numeric" className="w-16 text-center text-sm rounded-lg px-1.5 py-1 border border-slate-300" />
                </label>
                <label className="text-[11px] text-slate-500 flex items-center gap-1">❤️ Vida
                  <input value={valores[c.clave]?.vida} onChange={(e) => cambiar(c.clave, "vida", e.target.value)} inputMode="numeric" className="w-16 text-center text-sm rounded-lg px-1.5 py-1 border border-slate-300" />
                </label>
              </div>
            ))}
          </div>
        </div>
      ))}
      {msg && <div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mb-2">{msg}</div>}
      {error && <div className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2 mb-2">{error}</div>}
      <button onClick={guardar} disabled={guardando} className="text-sm font-bold px-5 py-2 rounded-full text-white disabled:opacity-50" style={{ background: "#2F55A4" }}>
        {guardando ? "Guardando…" : "💾 Guardar valores"}
      </button>
    </div>
  );
}
