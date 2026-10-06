import React, { useEffect, useState } from "react";
import * as mundoApi from "../lib/mundoApi";

// Editor de las misiones del Mundo CÓDICE: acá se agregan, cambian, ocultan y borran las preguntas
// que los estudiantes encuentran al hablar con los personajes. Los cambios se ven en el mundo
// apenas se guardan (cada estudiante las carga al entrar).

const LUGARES = [
  { key: "biblioteca", emoji: "📚", nombre: "Biblioteca" },
  { key: "agora", emoji: "⚖️", nombre: "Ágora de la Ética" },
  { key: "templo", emoji: "🕊️", nombre: "Templo de la Gratitud" },
  { key: "mercado", emoji: "🛒", nombre: "Mercado del Códice" },
  { key: "plaza", emoji: "🌍", nombre: "Plaza (afuera)" },
];
const ROLES = [
  ["maestro_gremio", "👑", "Maestro del Gremio"], ["heraldo", "🕊️", "Heraldo de la Alianza"], ["peregrino", "📜", "Peregrino del Sentido"], ["cronista", "🖋️", "Cronista del Reino"],
  ["defensor", "⚖️", "Defensor del Pacto"], ["consejero", "🏦", "Consejero Real"], ["guardian", "🎨", "Guardián del Símbolo"],
];
const PERSONAJES = ROLES.flatMap(([k, e, n]) => [{ valor: `${k}_femenino`, texto: `${e} ${n} ♀` }, { valor: `${k}_masculino`, texto: `${e} ${n} ♂` }]);
const MAX_POR_LUGAR = 5; // más de 5 personajes en un mismo lugar no caben sin encimarse
const MIN_OPCIONES = 2, MAX_OPCIONES = 5;
const nombreLugar = (k) => LUGARES.find((l) => l.key === k) || { emoji: "📍", nombre: k };

const vacia = () => ({ lugar: "biblioteca", npc_nombre: "", npc_sprite: "", titulo: "", texto: "", opciones: ["", ""], correcta: 0, pista: "", retro: "", xp: 10, oro: 5, orden: 0, activo: true });
const aForm = (m) => ({ lugar: m.lugar || "plaza", npc_nombre: m.npc_nombre || "", npc_sprite: m.npc_sprite || "", titulo: m.titulo || "", texto: m.texto || "", opciones: m.opciones && m.opciones.length >= MIN_OPCIONES ? [...m.opciones] : ["", ""], correcta: Math.min(Number(m.correcta) || 0, Math.max(0, (m.opciones || []).length - 1)), pista: m.pista || "", retro: m.retro || "", xp: m.xp ?? 0, oro: m.oro ?? 0, orden: m.orden ?? 0, activo: m.activo !== false });

export default function MisionesMundoModal({ onClose }) {
  const [misiones, setMisiones] = useState([]);
  const [conteo, setConteo] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [editando, setEditando] = useState(null); // null | "nueva" | id
  const [form, setForm] = useState(vacia());
  const [errForm, setErrForm] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");

  const cargar = async () => {
    try {
      const [m, c] = await Promise.all([mundoApi.fetchMisionesMundoAdmin(), mundoApi.fetchConteoHechasMundo().catch(() => ({}))]);
      setMisiones(m); setConteo(c); setError("");
    } catch (e) { setError(e.message || "No se pudieron cargar las misiones."); }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);
  const mostrarAviso = (t) => { setAviso(t); setTimeout(() => setAviso(""), 2600); };

  const visiblesEn = (lugar, exceptoId) => misiones.filter((m) => m.lugar === lugar && m.activo && m.id !== exceptoId).length;
  const abrirNueva = (base) => { setForm(base ? aForm(base) : vacia()); setEditando("nueva"); setErrForm(""); };
  const abrirEditar = (m) => { setForm(aForm(m)); setEditando(m.id); setErrForm(""); };
  const cambiar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));
  const cambiarOpcion = (i, v) => setForm((f) => ({ ...f, opciones: f.opciones.map((o, k) => (k === i ? v : o)) }));
  const agregarOpcion = () => setForm((f) => (f.opciones.length < MAX_OPCIONES ? { ...f, opciones: [...f.opciones, ""] } : f));
  const quitarOpcion = (i) => setForm((f) => {
    if (f.opciones.length <= MIN_OPCIONES) return f;
    const opciones = f.opciones.filter((_, k) => k !== i);
    // si se quita la correcta, queda la primera; si se quita una anterior, la correcta se corre un lugar
    const correcta = i === f.correcta ? 0 : i < f.correcta ? f.correcta - 1 : f.correcta;
    return { ...f, opciones, correcta };
  });

  const validar = () => {
    if (!form.titulo.trim()) return "Escribe un título para la misión.";
    if (!form.texto.trim()) return "Escribe lo que pregunta o plantea la misión.";
    if (form.opciones.length < MIN_OPCIONES) return `Tiene que haber al menos ${MIN_OPCIONES} respuestas.`;
    if (form.opciones.some((o) => !o.trim())) return "Ninguna respuesta puede quedar vacía (escríbela o quítala con la ✕).";
    const nums = { XP: form.xp, "Oro": form.oro, "Orden": form.orden };
    for (const [n, v] of Object.entries(nums)) { const x = Number(v); if (v === "" || !Number.isInteger(x) || x < 0 || x > 1000) return `${n} tiene que ser un número entero entre 0 y 1000.`; }
    if (form.activo && visiblesEn(form.lugar, editando === "nueva" ? null : editando) >= MAX_POR_LUGAR) {
      return `${nombreLugar(form.lugar).nombre} ya tiene ${MAX_POR_LUGAR} misiones visibles (el máximo para que los personajes quepan). Oculta una o elige otro lugar.`;
    }
    return "";
  };

  const guardar = async () => {
    const e = validar(); if (e) { setErrForm(e); return; }
    setGuardando(true); setErrForm("");
    const campos = {
      lugar: form.lugar, npc_nombre: form.npc_nombre.trim() || "Aldeano", npc_sprite: form.npc_sprite || null, titulo: form.titulo.trim(), texto: form.texto.trim(),
      opciones: form.opciones.map((o) => o.trim()), correcta: form.correcta, pista: form.pista.trim(), retro: form.retro.trim(), xp: Number(form.xp), oro: Number(form.oro), orden: Number(form.orden), activo: form.activo,
    };
    try {
      if (editando === "nueva") await mundoApi.crearMisionMundo(campos); else await mundoApi.editarMisionMundo(editando, campos);
      await cargar(); setEditando(null); mostrarAviso("Guardada ✓");
    } catch (er) { setErrForm("No se pudo guardar: " + (er.message || "error desconocido")); }
    setGuardando(false);
  };

  const alternarVisible = async (m) => {
    if (!m.activo && visiblesEn(m.lugar, m.id) >= MAX_POR_LUGAR) { setError(`${nombreLugar(m.lugar).nombre} ya tiene ${MAX_POR_LUGAR} misiones visibles. Oculta otra antes de mostrar esta.`); return; }
    setError("");
    try { await mundoApi.editarMisionMundo(m.id, { activo: !m.activo }); await cargar(); } catch (er) { setError("No se pudo cambiar: " + er.message); }
  };
  const borrar = async (m) => {
    const n = conteo[m.id] || 0;
    if (!confirm(`¿Borrar la misión "${m.titulo}"?${n ? `\n\n${n} estudiante${n === 1 ? "" : "s"} la completó; se borra ese registro (los premios ya entregados no se tocan).` : ""}\n\nSi solo quieres que deje de aparecer, mejor ocúltala.`)) return;
    setError("");
    try { await mundoApi.eliminarMisionMundo(m.id); await cargar(); mostrarAviso("Borrada"); } catch (er) { setError("No se pudo borrar: " + er.message); }
  };

  const lista = misiones.filter((m) => filtro === "todos" || m.lugar === filtro);
  const input = "w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white";
  const sinTabla = /does not exist|relation|schema cache/i.test(error);

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-3" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-bold text-slate-800">🌍 Misiones del Mundo</h3>
          <button onClick={onClose} className="text-slate-400 text-xl" aria-label="Cerrar">×</button>
        </div>
        <p className="text-xs text-slate-400 mb-3">Son las preguntas que tus estudiantes encuentran al hablar con los personajes del mundo. Cada una la da un personaje, en un lugar, y premia con XP y oro. Los cambios se ven apenas se guardan.</p>

        {sinTabla ? (
          <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3">Todavía no se crearon las tablas de las misiones. Corre <b>62_mundo.sql</b> en el editor SQL de Supabase y vuelve a abrir esto.</div>
        ) : cargando ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : editando ? (
          <div>
            <h4 className="text-sm font-bold text-slate-800 mb-3">{editando === "nueva" ? "➕ Nueva misión" : "✏️ Editar misión"}</h4>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div><label className="text-[11px] text-slate-500 block mb-1">¿Dónde está?</label>
                <select value={form.lugar} onChange={(e) => cambiar("lugar", e.target.value)} className={input}>{LUGARES.map((l) => <option key={l.key} value={l.key}>{l.emoji} {l.nombre}</option>)}</select></div>
              <div><label className="text-[11px] text-slate-500 block mb-1">Personaje que la da</label>
                <select value={form.npc_sprite} onChange={(e) => cambiar("npc_sprite", e.target.value)} className={input}><option value="">Automático (según el lugar)</option>{PERSONAJES.map((p) => <option key={p.valor} value={p.valor}>{p.texto}</option>)}</select></div>
              <div className="sm:col-span-2"><label className="text-[11px] text-slate-500 block mb-1">Nombre del personaje (ej: "La bibliotecaria")</label>
                <input value={form.npc_nombre} onChange={(e) => cambiar("npc_nombre", e.target.value)} maxLength={40} className={input} placeholder="Aldeano" /></div>
              <div className="sm:col-span-2"><label className="text-[11px] text-slate-500 block mb-1">Título de la misión</label>
                <input value={form.titulo} onChange={(e) => cambiar("titulo", e.target.value)} maxLength={60} className={input} placeholder="Ej: La regla de oro" /></div>
              <div className="sm:col-span-2"><label className="text-[11px] text-slate-500 block mb-1">Lo que pregunta o plantea</label>
                <textarea value={form.texto} onChange={(e) => cambiar("texto", e.target.value)} rows={3} maxLength={500} className={input} placeholder="Escribe la pregunta o la situación…" /></div>
            </div>

            <div className="mb-3">
              <label className="text-[11px] text-slate-500 block mb-1">Respuestas posibles — marca con el círculo la <b>correcta</b></label>
              {form.opciones.map((o, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <input type="radio" name="correcta" checked={form.correcta === i} onChange={() => cambiar("correcta", i)} aria-label={`La respuesta ${i + 1} es la correcta`} />
                  <input value={o} onChange={(e) => cambiarOpcion(i, e.target.value)} maxLength={120} className={input} placeholder={`Respuesta ${i + 1}`} />
                  <button type="button" onClick={() => quitarOpcion(i)} disabled={form.opciones.length <= MIN_OPCIONES} className="text-slate-400 disabled:opacity-30 text-lg px-1" aria-label="Quitar respuesta">✕</button>
                </div>
              ))}
              {form.opciones.length < MAX_OPCIONES && <button type="button" onClick={agregarOpcion} className="text-xs font-semibold text-violet-600 mt-1">+ Agregar respuesta</button>}
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div><label className="text-[11px] text-slate-500 block mb-1">Pista (si se equivoca)</label><input value={form.pista} onChange={(e) => cambiar("pista", e.target.value)} maxLength={200} className={input} /></div>
              <div><label className="text-[11px] text-slate-500 block mb-1">Mensaje al acertar</label><input value={form.retro} onChange={(e) => cambiar("retro", e.target.value)} maxLength={200} className={input} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div><label className="text-[11px] text-slate-500 block mb-1">✨ XP</label><input type="number" min="0" value={form.xp} onChange={(e) => cambiar("xp", e.target.value)} className={input} /></div>
              <div><label className="text-[11px] text-slate-500 block mb-1">🪙 Oro</label><input type="number" min="0" value={form.oro} onChange={(e) => cambiar("oro", e.target.value)} className={input} /></div>
              <div><label className="text-[11px] text-slate-500 block mb-1">Orden</label><input type="number" min="0" value={form.orden} onChange={(e) => cambiar("orden", e.target.value)} className={input} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 mb-3"><input type="checkbox" checked={form.activo} onChange={(e) => cambiar("activo", e.target.checked)} /> Visible para los estudiantes</label>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 mb-3">
              <div className="text-[10px] font-bold text-slate-400 mb-1.5">VISTA PREVIA — así la ve el estudiante</div>
              <div className="rounded-xl bg-white border border-slate-200 p-3">
                <div className="text-sm font-bold text-slate-800">{form.npc_nombre.trim() || "Aldeano"}</div>
                <div className="text-[11px] font-bold text-violet-600 mb-1">🎯 {form.titulo.trim() || "Título de la misión"}</div>
                <p className="text-sm text-slate-700 mb-2">{form.texto.trim() || "Aquí va lo que pregunta o plantea…"}</p>
                {form.opciones.map((o, i) => (
                  <div key={i} className={`text-sm rounded-lg px-3 py-1.5 mb-1 border-2 ${form.correcta === i ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>{i + 1}. {o.trim() || "…"}{form.correcta === i && <span className="text-[10px] text-emerald-600 font-bold ml-2">✓ correcta</span>}</div>
                ))}
                <div className="text-xs font-bold text-slate-600 mt-2">🎁 +{Number(form.xp) || 0} XP · +{Number(form.oro) || 0} 🪙</div>
              </div>
            </div>

            {errForm && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-2.5 mb-3">{errForm}</div>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setEditando(null); setErrForm(""); }} className="text-sm text-slate-500 px-4 py-2">Cancelar</button>
              <button type="button" onClick={guardar} disabled={guardando} className="text-sm font-bold px-5 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar misión"}</button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <button type="button" onClick={() => setFiltro("todos")} className={`text-xs px-3 py-1.5 rounded-full ${filtro === "todos" ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-600"}`}>Todas ({misiones.length})</button>
              {LUGARES.map((l) => (
                <button key={l.key} type="button" onClick={() => setFiltro(l.key)} className={`text-xs px-3 py-1.5 rounded-full ${filtro === l.key ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-600"}`}>{l.emoji} {l.nombre.split(" ")[0]} ({misiones.filter((m) => m.lugar === l.key).length})</button>
              ))}
              <div className="flex-1" />
              {aviso && <span className="text-xs font-semibold text-emerald-600">{aviso}</span>}
              <button type="button" onClick={() => abrirNueva()} className="text-xs font-bold px-4 py-2 rounded-full bg-violet-500 text-white">+ Nueva misión</button>
            </div>
            {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-2.5 mb-3">{error}</div>}
            {lista.length === 0 && <p className="text-sm text-slate-400 py-6 text-center">No hay misiones {filtro === "todos" ? "todavía" : "en este lugar"}. Crea la primera con "+ Nueva misión".</p>}
            <div className="space-y-2">
              {lista.map((m) => {
                const l = nombreLugar(m.lugar), n = conteo[m.id] || 0;
                return (
                  <div key={m.id} className={`rounded-xl border p-3 ${m.activo ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-70"}`}>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-slate-800 truncate">{m.titulo}{!m.activo && <span className="ml-2 text-[10px] font-bold text-slate-500 bg-slate-200 rounded-full px-2 py-0.5">OCULTA</span>}</div>
                        <div className="text-[11px] text-slate-500">{l.emoji} {l.nombre} · {m.npc_nombre} · ✨ {m.xp} XP · 🪙 {m.oro}</div>
                        <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">✅ {n} estudiante{n === 1 ? "" : "s"} {n === 1 ? "la completó" : "la completaron"}</div>
                      </div>
                      <div className="flex flex-wrap gap-1 justify-end shrink-0">
                        <button type="button" onClick={() => abrirEditar(m)} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-50 text-violet-700">Editar</button>
                        <button type="button" onClick={() => abrirNueva({ ...m, titulo: m.titulo + " (copia)", orden: m.orden + 1 })} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">Duplicar</button>
                        <button type="button" onClick={() => alternarVisible(m)} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{m.activo ? "Ocultar" : "Mostrar"}</button>
                        <button type="button" onClick={() => borrar(m)} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-600">Borrar</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
