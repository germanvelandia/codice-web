import React, { useCallback, useEffect, useState } from "react";
import * as api from "../lib/detectivesApi";

// Detectives del Códice — panel del docente: crear el caso con ayuda de una IA (sin API), revisar, publicar y ver resultados.
// Las tablas solo dejan ver y editar los casos del propio docente (RLS); los estudiantes nunca las leen directamente.

const inp = "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm";
const btn = "rounded-lg px-3 py-1.5 text-sm font-bold";

function Editor({ id, volver }) {
  const [c, setC] = useState(null);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [res, setRes] = useState(null);
  const cargar = useCallback(async () => { try { setC(await api.casoCompleto(id)); } catch (e) { setErr(e.message); } }, [id]);
  useEffect(() => { cargar(); }, [cargar]);
  const ok = (t) => { setMsg(t); setErr(""); setTimeout(() => setMsg(""), 2500); };
  const guardarCaso = async (cambios) => { try { await api.actualizarCaso(id, cambios); setC((x) => ({ ...x, ...cambios })); ok("Guardado ✔"); } catch (e) { setErr(e.message); } };
  const campoP = (p, k, max, area) => (
    area
      ? <textarea className={inp} rows={2} maxLength={max} defaultValue={p[k]} onBlur={async (e) => { if (e.target.value !== p[k]) { try { await api.actualizarParada(p.id, { [k]: e.target.value }); p[k] = e.target.value; ok("Guardado ✔"); } catch (x) { setErr(x.message); } } }} />
      : <input className={inp} maxLength={max} defaultValue={p[k]} onBlur={async (e) => { if (e.target.value !== p[k]) { try { await api.actualizarParada(p.id, { [k]: e.target.value }); p[k] = e.target.value; ok("Guardado ✔"); } catch (x) { setErr(x.message); } } }} />
  );
  const publicar = async () => {
    const culp = c.sospechosos.filter((s) => s.culpable).length;
    if (!c.publicado && (c.paradas.length < 2 || culp !== 1)) { setErr("Para publicar necesita al menos 2 paradas y exactamente 1 culpable."); return; }
    await guardarCaso({ publicado: !c.publicado });
  };
  const verRes = async () => { try { setRes(await api.resumenDetectives(id)); } catch (e) { setErr(e.message); } };

  if (!c) return <p className="text-sm text-slate-400">{err || "Cargando…"}</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={volver} className={`${btn} bg-slate-100 hover:bg-slate-200`}>← Casos</button>
        <h3 className="font-extrabold text-lg flex-1 min-w-0 truncate">{c.titulo}</h3>
        <button onClick={publicar} className={`${btn} text-white ${c.publicado ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>{c.publicado ? "Retirar del curso" : "Publicar para el curso"}</button>
      </div>
      {err && <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm p-2.5">{err}</div>}
      {msg && <div role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm p-2">{msg}</div>}
      <div className="rounded-xl border border-slate-200 bg-white p-3 grid gap-2 sm:grid-cols-4">
        <label className="sm:col-span-4 text-xs font-bold">Título<input className={inp} maxLength={120} defaultValue={c.titulo} onBlur={(e) => e.target.value.trim().length >= 3 && e.target.value !== c.titulo && guardarCaso({ titulo: e.target.value.trim() })} /></label>
        <label className="sm:col-span-4 text-xs font-bold">Historia de inicio<textarea className={inp} rows={4} maxLength={2500} defaultValue={c.historia} onBlur={(e) => e.target.value !== c.historia && guardarCaso({ historia: e.target.value })} /></label>
        <label className="text-xs font-bold">Ambientación
          <select className={inp} value={c.ambientacion} onChange={(e) => guardarCaso({ ambientacion: e.target.value })}>{Object.entries(api.AMBIENTES).map(([k, a]) => <option key={k} value={k}>{a.emoji} {a.label}</option>)}</select></label>
        <label className="text-xs font-bold">Horas (vidas) 2–10<input type="number" min={2} max={10} className={inp} defaultValue={c.vidas} onBlur={(e) => { const v = Math.max(2, Math.min(10, Math.floor(Number(e.target.value)) || 5)); if (v !== c.vidas) guardarCaso({ vidas: v }); }} /></label>
        <label className="text-xs font-bold">XP de premio 0–100<input type="number" min={0} max={100} className={inp} defaultValue={c.xp} onBlur={(e) => { const v = Math.max(0, Math.min(100, Math.floor(Number(e.target.value)) || 0)); if (v !== c.xp) guardarCaso({ xp: v }); }} /></label>
        <label className="text-xs font-bold">Monedas de premio 0–50<input type="number" min={0} max={50} className={inp} defaultValue={c.oro} onBlur={(e) => { const v = Math.max(0, Math.min(50, Math.floor(Number(e.target.value)) || 0)); if (v !== c.oro) guardarCaso({ oro: v }); }} /></label>
      </div>
      <p className="text-xs text-slate-500">El premio completo se entrega si resuelve con todas las horas; con menos horas recibe una parte (mínimo la mitad). Se cobra una sola vez por estudiante.</p>

      <h4 className="font-extrabold">Paradas</h4>
      {c.paradas.map((p) => (
        <details key={p.id} className="rounded-xl border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer font-bold">{p.orden}. {p.emoji} {p.lugar}</summary>
          <div className="grid gap-2 mt-2 sm:grid-cols-2">
            <label className="text-xs font-bold">Lugar{campoP(p, "lugar", 80)}</label>
            <label className="text-xs font-bold">Testigo{campoP(p, "testigo", 80)}</label>
            <label className="text-xs font-bold sm:col-span-2">Escena{campoP(p, "escena", 700, true)}</label>
            <label className="text-xs font-bold sm:col-span-2">Pregunta{campoP(p, "pregunta", 500, true)}</label>
            <div className="sm:col-span-2 text-xs"><b>Opciones:</b> {p.opciones.map((o, i) => <span key={i} className={`inline-block mr-1 mt-1 rounded-full px-2 py-0.5 ${o === p.correcta ? "bg-emerald-100 text-emerald-800 font-bold" : "bg-slate-100"}`}>{o}</span>)}</div>
            <label className="text-xs font-bold sm:col-span-2">Retroalimentación{campoP(p, "retro", 400, true)}</label>
            <label className="text-xs font-bold sm:col-span-2">Pista del testigo{campoP(p, "pista", 600, true)}</label>
            <label className="text-xs font-bold">Rasgo del culpable{campoP(p, "rasgo", 120)}</label>
            <div className="text-xs"><b>Destinos:</b> {p.destinos.map((d, i) => <span key={i} className={`inline-block mr-1 mt-1 rounded-full px-2 py-0.5 ${d === p.destino_ok ? "bg-emerald-100 text-emerald-800 font-bold" : "bg-slate-100"}`}>{d}</span>)}</div>
          </div>
        </details>
      ))}

      <h4 className="font-extrabold">Sospechosos</h4>
      <div className="grid gap-2 sm:grid-cols-2">
        {c.sospechosos.map((s) => (
          <div key={s.id} className={`rounded-xl border p-3 text-sm ${s.culpable ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"}`}>
            <div className="font-extrabold">{s.emoji} {s.nombre} {s.culpable && <span className="text-xs text-rose-700">· culpable</span>}</div>
            <ul className="list-disc ml-5 text-slate-700">{s.rasgos.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">Para cambiar preguntas, opciones o sospechosos, genera el caso de nuevo con la IA: es rápido y evita incoherencias entre pistas y rasgos.</p>

      <div className="flex items-center gap-2"><button onClick={verRes} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}>📊 Ver resultados del curso</button></div>
      {res && (res.length ? (
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500"><th className="p-1">Estudiante</th><th>Estado</th><th>Parada</th><th>Horas</th><th>Puntaje</th></tr></thead>
          <tbody>{res.map((r, i) => <tr key={i} className="border-t border-slate-100"><td className="p-1">{r.estudiante}</td><td>{r.estado === "resuelto" ? "✅ Resuelto" : r.estado === "fallido" ? "❌ Fallido" : "🔎 En curso"}</td><td>{r.parada}</td><td>{r.vidas}</td><td>{r.puntos ?? "—"}</td></tr>)}</tbody></table></div>
      ) : <p className="text-sm text-slate-500">Nadie ha jugado este caso todavía.</p>)}
    </div>
  );
}

function Crear({ grados, gradoActivo, materiaActiva, listo, cancelar }) {
  const [grado, setGrado] = useState(String(gradoActivo || grados[0]?.id || ""));
  const [amb, setAmb] = useState("oakhaven");
  const [tema, setTema] = useState(""); const [n, setN] = useState(4);
  const [texto, setTexto] = useState("");
  const [rev, setRev] = useState(null);
  const [err, setErr] = useState(""); const [copiado, setCopiado] = useState(false); const [bus, setBus] = useState(false);
  const g = grados.find((x) => String(x.id) === grado);
  const instr = api.instruccionesIA({ tema, grado: g?.nombre || grado, ambientacion: amb, paradas: n });
  const copiar = async () => { try { await navigator.clipboard.writeText(instr); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { setErr("No pude copiar. Selecciona el texto y cópialo a mano."); } };
  const leer = () => { const r = api.leerCasoIA(texto, amb); setRev(r); setErr(""); };
  const guardar = async (caso) => {
    if (!grado) { setErr("Elige el curso."); return; }
    setBus(true); setErr("");
    try { const c = await api.crearCaso(caso, { grado_id: grado, materia_id: materiaActiva || null }); listo(c.id); } catch (e) { setErr(e.message); } finally { setBus(false); }
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><button onClick={cancelar} className={`${btn} bg-slate-100 hover:bg-slate-200`}>← Casos</button><h3 className="font-extrabold text-lg">Nuevo caso</h3></div>
      {err && <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm p-2.5">{err}</div>}
      <div className="rounded-xl border border-slate-200 bg-white p-3 grid gap-2 sm:grid-cols-4">
        <label className="text-xs font-bold">Curso<select className={inp} value={grado} onChange={(e) => setGrado(e.target.value)}>{grados.map((x) => <option key={x.id} value={x.id}>{x.nombre || x.id}</option>)}</select></label>
        <label className="text-xs font-bold">Ambientación<select className={inp} value={amb} onChange={(e) => setAmb(e.target.value)}>{Object.entries(api.AMBIENTES).map(([k, a]) => <option key={k} value={k}>{a.emoji} {a.label}</option>)}</select></label>
        <label className="text-xs font-bold sm:col-span-2">Tema que deben aprender<input className={inp} value={tema} maxLength={200} placeholder="Ej.: valores éticos: honestidad, responsabilidad, empatía, respeto" onChange={(e) => setTema(e.target.value)} /></label>
        <label className="text-xs font-bold">Número de paradas<select className={inp} value={n} onChange={(e) => setN(Number(e.target.value))}>{[3, 4, 5, 6].map((x) => <option key={x}>{x}</option>)}</select></label>
      </div>

      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 space-y-2">
        <div className="font-extrabold text-indigo-900">1) Copia las instrucciones y pégalas en tu IA favorita</div>
        <textarea readOnly className={`${inp} font-mono text-xs`} rows={6} value={instr} onFocus={(e) => e.target.select()} />
        <button onClick={copiar} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}>{copiado ? "✔ Copiado" : "📋 Copiar instrucciones"}</button>
        <div className="font-extrabold text-indigo-900 pt-1">2) Pega aquí lo que te responda</div>
        <textarea className={`${inp} font-mono text-xs`} rows={6} value={texto} placeholder='{ "titulo": "…", "paradas": [ … ], "sospechosos": [ … ] }' onChange={(e) => { setTexto(e.target.value); setRev(null); }} />
        <button onClick={leer} disabled={!texto.trim()} className={`${btn} bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50`}>🔍 Revisar caso</button>
      </div>

      {rev && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          {rev.errores.map((e, i) => <div key={i} className="text-sm text-rose-700">⛔ {e}</div>)}
          {rev.avisos.map((e, i) => <div key={i} className="text-sm text-amber-700">⚠️ {e}</div>)}
          {rev.caso && !rev.errores.length && (
            <>
              <div className="font-extrabold">{rev.caso.titulo}</div>
              <p className="text-sm text-slate-600 whitespace-pre-line">{rev.caso.historia}</p>
              <ol className="list-decimal ml-5 text-sm">{rev.caso.paradas.map((p, i) => <li key={i}>{p.emoji} {p.lugar} — <i>{p.pregunta}</i></li>)}</ol>
              <p className="text-sm">Sospechosos: {rev.caso.sospechosos.map((s) => `${s.emoji} ${s.nombre}${s.culpable ? " (culpable)" : ""}`).join(" · ")}</p>
              <button disabled={bus} onClick={() => guardar(rev.caso)} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50`}>💾 Guardar como borrador</button>
              <span className="text-xs text-slate-500 ml-2">Quedará sin publicar hasta que tú lo decidas.</span>
            </>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
        <div className="font-extrabold">¿Prefieres probar primero?</div>
        <p className="text-sm text-slate-600">Crea el caso de ejemplo «El robo de la Campana de la Honestidad» (ética, valores de convivencia) para ver cómo funciona.</p>
        <button disabled={bus} onClick={() => guardar({ ...api.CASO_EJEMPLO, ambientacion: amb })} className={`${btn} bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50`}>🕵️ Usar el caso de ejemplo</button>
      </div>
    </div>
  );
}

export function VistaDetectives({ grados = [], gradoActivo, materiaActiva }) {
  const [modo, setModo] = useState("lista"); // lista | crear | editar
  const [casos, setCasos] = useState(null); const [abierto, setAbierto] = useState(null); const [err, setErr] = useState("");
  const cargar = useCallback(async () => { try { setCasos(await api.casosDelDocente()); setErr(""); } catch (e) { setErr(e.message); setCasos([]); } }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const nombreGrado = (id) => grados.find((g) => String(g.id) === String(id))?.nombre || id;

  if (modo === "crear") return <Crear grados={grados} gradoActivo={gradoActivo} materiaActiva={materiaActiva} cancelar={() => setModo("lista")} listo={(id) => { setAbierto(id); setModo("editar"); cargar(); }} />;
  if (modo === "editar") return <Editor id={abierto} volver={() => { setModo("lista"); cargar(); }} />;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-lg font-extrabold flex-1">🕵️ Detectives del Códice</h2>
        <button onClick={() => setModo("crear")} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}>＋ Nuevo caso</button>
      </div>
      <p className="text-sm text-slate-600">Casos de investigación para que tus estudiantes repasen un tema: cada parada es una pregunta, y las respuestas correctas llevan al culpable.</p>
      {err && <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm p-2.5">{err}{/relation|does not exist|permission/i.test(err) ? " — ¿ya ejecutaste el SQL 142 en Supabase?" : ""}</div>}
      {casos === null && <p className="text-sm text-slate-400">Cargando…</p>}
      {casos && !casos.length && !err && <p className="text-sm text-slate-500">Aún no has creado casos.</p>}
      <div className="grid gap-2">
        {(casos || []).map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-3 flex-wrap">
            <span className="text-2xl">{(api.AMBIENTES[c.ambientacion] || api.AMBIENTES.oakhaven).emoji}</span>
            <div className="flex-1 min-w-0"><div className="font-extrabold truncate">{c.titulo}</div><div className="text-xs text-slate-500">{nombreGrado(c.grado_id)} · {c.detectives_paradas?.[0]?.count ?? 0} paradas</div></div>
            <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${c.publicado ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{c.publicado ? "Publicado" : "Borrador"}</span>
            <button onClick={() => { setAbierto(c.id); setModo("editar"); }} className={`${btn} bg-slate-100 hover:bg-slate-200`}>Abrir</button>
            <button onClick={async () => { if (window.confirm(`¿Borrar «${c.titulo}» y todos sus resultados?`)) { try { await api.borrarCaso(c.id); cargar(); } catch (e) { setErr(e.message); } } }} className={`${btn} bg-rose-50 text-rose-700 hover:bg-rose-100`} aria-label="Borrar caso">🗑️</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default VistaDetectives;
