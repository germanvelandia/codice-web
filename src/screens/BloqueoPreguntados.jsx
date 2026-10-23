import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

// ISO <-> valor de <input type="datetime-local"> (hora local del navegador)
const aLocal = (iso) => { if (!iso) return ""; const d = new Date(iso); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const aISO = (local) => (local ? new Date(local).toISOString() : null);

function estadoDe(f) {
  if (!f || !f.bloqueado) return { t: "🟢 Abierto", c: "#059669", bg: "#ECFDF5" };
  const ahora = Date.now();
  if (f.desde && ahora < new Date(f.desde).getTime()) return { t: "⏳ Bloqueo programado", c: "#B45309", bg: "#FFFBEB" };
  if (f.hasta && ahora > new Date(f.hasta).getTime()) return { t: "🟢 Abierto (el bloqueo ya venció)", c: "#059669", bg: "#ECFDF5" };
  return { t: "🔒 Bloqueado ahora", c: "#BE123C", bg: "#FFF1F2" };
}

export function BloqueoPreguntados({ grados = [] }) {
  const [filas, setFilas] = useState({}); // grado_id -> { bloqueado, desde, hasta, mensaje }
  const [cargando, setCargando] = useState(true);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(false);

  const cargar = async () => {
    try {
      const d = await api.fetchTriviaBloqueos();
      const m = {}; d.forEach((r) => { m[r.grado_id] = r; });
      setFilas(m); setError("");
    } catch (e) { setError("Falta correr el SQL 109_trivia_bloqueo.sql en Supabase."); }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const guardar = async (id, cambios) => {
    const actual = { grado_id: id, bloqueado: false, desde: null, hasta: null, mensaje: "", ...(filas[id] || {}), ...cambios };
    setFilas((p) => ({ ...p, [id]: actual }));
    try { await api.guardarTriviaBloqueo(actual); setMsg("✔ Guardado"); setTimeout(() => setMsg(""), 1500); }
    catch (e) { setError("No se pudo guardar: " + (e.message || e)); }
  };
  const todos = async (valor) => {
    for (const g of grados) await api.guardarTriviaBloqueo({ ...(filas[String(g.id)] || {}), grado_id: String(g.id), bloqueado: valor });
    await cargar(); setMsg(valor ? "🔒 Todos los cursos bloqueados" : "🟢 Todos los cursos abiertos");
  };

  if (cargando) return null;
  const global = filas["*"];
  const gEst = estadoDe(global);
  const nBloq = grados.filter((g) => estadoDe(filas[String(g.id)]).t.startsWith("🔒")).length;

  const renderFila = (id, titulo) => {
    const f = filas[id] || { bloqueado: false };
    const e = estadoDe(f);
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-2.5 mb-1.5">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => guardar(id, { bloqueado: !f.bloqueado })}
            className="relative w-11 h-6 rounded-full transition-colors shrink-0" style={{ background: f.bloqueado ? "#E11D48" : "#CBD5E1" }} title={f.bloqueado ? "Desbloquear" : "Bloquear"}>
            <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: f.bloqueado ? 22 : 2 }} />
          </button>
          <div className="font-bold text-sm text-slate-700 min-w-[110px]">{titulo}</div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: e.c, background: e.bg }}>{e.t}</span>
        </div>
        {f.bloqueado && (
          <div className="flex flex-wrap gap-2 mt-2 items-end">
            <label className="text-[10px] font-bold text-slate-500">Desde (opcional)
              <input type="datetime-local" value={aLocal(f.desde)} onChange={(ev) => guardar(id, { desde: aISO(ev.target.value) })} className="block text-xs rounded-lg px-2 py-1 border border-slate-200" />
            </label>
            <label className="text-[10px] font-bold text-slate-500">Hasta (opcional)
              <input type="datetime-local" value={aLocal(f.hasta)} onChange={(ev) => guardar(id, { hasta: aISO(ev.target.value) })} className="block text-xs rounded-lg px-2 py-1 border border-slate-200" />
            </label>
            <label className="text-[10px] font-bold text-slate-500 flex-1 min-w-[180px]">Mensaje para los estudiantes (opcional)
              <input defaultValue={f.mensaje || ""} onBlur={(ev) => { if ((f.mensaje || "") !== ev.target.value) guardar(id, { mensaje: ev.target.value }); }}
                placeholder="Preguntados está cerrado por ahora…" className="block w-full text-xs rounded-lg px-2 py-1 border border-slate-200" />
            </label>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-2xl p-3 mb-4" style={{ background: "#FFF1F2", border: "1px solid #FECDD3" }}>
      <button onClick={() => setAbierto((v) => !v)} className="w-full flex items-center justify-between gap-2 text-left">
        <div className="text-sm font-bold text-rose-800">🔒 Bloqueo de Preguntados
          <span className="font-normal text-xs ml-2" style={{ color: gEst.c }}>{global?.bloqueado ? gEst.t : nBloq ? `${nBloq} curso(s) bloqueado(s)` : "todo abierto"}</span>
        </div>
        <span className="text-xs text-rose-700">{abierto ? "▾ Ocultar" : "▸ Configurar"}</span>
      </button>
      {abierto && (
        <div className="mt-2">
          <p className="text-[11px] text-rose-900/80 mb-2">
            Un bloqueo cierra Preguntados: el estudiante ve un aviso, y además <b>la base de datos rechaza sus respuestas</b>. Puedes bloquear a todos o por curso. Con «Desde» y «Hasta» el bloqueo solo rige en esa franja; vacío = sin límite de tiempo.
          </p>
          {renderFila("*", "🌐 Todos los cursos")}
          <div className="flex items-center justify-between mt-2 mb-1">
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-rose-800">Por curso</div>
            <div className="flex gap-1.5">
              <button onClick={() => todos(true)} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-600 text-white">🔒 Bloquear todos</button>
              <button onClick={() => todos(false)} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-600 text-white">🟢 Abrir todos</button>
            </div>
          </div>
          {grados.map((g) => <React.Fragment key={g.id}>{renderFila(String(g.id), `Curso ${g.nombre || g.id}`)}</React.Fragment>)}
        </div>
      )}
      {msg && <div className="text-[11px] text-emerald-700 mt-1">{msg}</div>}
      {error && <div className="text-[11px] text-rose-700 mt-1">{error}</div>}
    </div>
  );
}
