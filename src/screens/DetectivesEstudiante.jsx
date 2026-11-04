import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "../lib/detectivesApi";

// Detectives del Códice — pantalla del estudiante.
// Todo lo importante (respuesta correcta, destino correcto, culpable) lo decide el servidor.

const mezclar = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const LETRAS = ["A", "B", "C", "D", "E"];
const COL_OP = ["#6366f1", "#0ea5e9", "#f59e0b", "#ec4899", "#10b981"];

function Horas({ n, max }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} de ${max} horas restantes`}>
      {Array.from({ length: max }).map((_, i) => <span key={i} className={i < n ? "" : "opacity-25 grayscale"}>⏳</span>)}
    </span>
  );
}

export default function DetectivesEstudiante({ estudianteInfo }) {
  const est = estudianteInfo?.id;
  const [lista, setLista] = useState(null);
  const [vista, setVista] = useState(null);       // estado seguro que devuelve el servidor
  const [caso, setCaso] = useState(null);         // id del caso abierto
  const [err, setErr] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(null);       // { tipo:'ok'|'mal', texto, pista, rasgo }
  const [malas, setMalas] = useState([]);         // opciones/destinos ya descartados en esta parada
  const [intro, setIntro] = useState(false);
  const [final, setFinal] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [expediente, setExpediente] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const bloqueo = useRef(false);

  const cargar = useCallback(async () => {
    if (!est) return;
    try { setLista(await api.listaDetectives(est)); setErr(""); } catch (e) { setErr(e.message); setLista([]); }
  }, [est]);
  useEffect(() => { cargar(); }, [cargar]);

  const accion = async (fn) => {
    if (bloqueo.current) return null;
    bloqueo.current = true; setOcupado(true); setErr("");
    try { return await fn(); } catch (e) { setErr(e.message); return null; } finally { bloqueo.current = false; setOcupado(false); }
  };

  const abrir = (id) => accion(async () => {
    const v = await api.iniciarDetectives(est, id);
    setCaso(id); setVista(v); setAviso(null); setMalas([]); setFinal(null); setConfirmar(null); setExpediente(false);
    setIntro(v.parada === 1 && v.fase === "pregunta" && !(v.pistas || []).length);
  });
  const salir = () => { setCaso(null); setVista(null); setFinal(null); setAviso(null); cargar(); };

  const responder = (op) => accion(async () => {
    const r = await api.responderDetectives(est, caso, op);
    setVista(r.vista);
    if (r.ok) { setAviso({ tipo: "ok", texto: r.retro, pista: r.pista, rasgo: r.rasgo }); setMalas([]); }
    else { setAviso({ tipo: "mal", texto: r.retro || "Respuesta incorrecta." }); setMalas((m) => [...m, op]); }
  });
  const viajar = (d) => accion(async () => {
    const r = await api.viajarDetectives(est, caso, d);
    setVista(r.vista);
    if (r.ok) { setAviso(null); setMalas([]); }
    else { setAviso({ tipo: "mal", texto: "Aquí no hay rastro del culpable. Perdiste una hora." }); setMalas((m) => [...m, d]); }
  });
  const arrestar = (s) => accion(async () => {
    const r = await api.arrestarDetectives(est, caso, s.id);
    setVista(r.vista); setConfirmar(null);
    if (r.ok) { setFinal({ ganado: true, ...r }); api.rankingDetectives(est, caso).then(setRanking).catch(() => {}); }
    else { setAviso({ tipo: "mal", texto: `${s.nombre} era inocente. Pierdes 2 horas.` }); setMalas((m) => [...m, `s${s.id}`]); if (r.vista.estado === "fallido") setFinal({ ganado: false, culpable: r.culpable }); }
  });

  const dest = useMemo(() => (vista?.destinos ? mezclar(vista.destinos) : []), [vista?.parada, vista?.fase === "destino"]); // eslint-disable-line
  const ops = useMemo(() => (vista?.pregunta ? mezclar(vista.pregunta.opciones) : []), [vista?.parada, vista?.fase === "pregunta"]); // eslint-disable-line

  if (!est) return <p className="text-sm text-slate-400">Inicia sesión para jugar.</p>;

  // ---------- LISTA ----------
  if (!vista) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl p-4 text-white" style={{ background: "linear-gradient(135deg,#0f172a,#312e81)" }}>
          <h2 className="text-xl font-extrabold">🕵️ Detectives del Códice</h2>
          <p className="text-sm opacity-90 mt-1">Investiga, responde a los testigos, sigue las pistas y arresta al culpable antes de que se acaben tus horas.</p>
        </div>
        {err && <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm p-2.5">{err}</div>}
        {lista === null && <p className="text-sm text-slate-400">Cargando casos…</p>}
        {lista && !lista.length && <p className="text-sm text-slate-500">Todavía no hay casos abiertos para tu curso. ¡Pronto llegará uno!</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {(lista || []).map((c) => {
            const amb = api.AMBIENTES[c.ambientacion] || api.AMBIENTES.oakhaven;
            return (
              <div key={c.id} className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                <div className="p-3 text-white flex items-center gap-2" style={{ background: amb.fondo }}>
                  <span className="text-3xl">{amb.emoji}</span>
                  <div className="min-w-0"><div className="font-extrabold leading-tight">{c.titulo}</div><div className="text-xs opacity-80">{amb.label} · {c.paradas} paradas</div></div>
                </div>
                <div className="p-3 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold rounded-full bg-amber-100 text-amber-800 px-2 py-0.5">+{c.xp} XP · +{c.oro} 🪙</span>
                  {c.resuelto && <span className="text-xs font-bold rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">✅ Resuelto</span>}
                  {c.en_curso && <span className="text-xs font-bold rounded-full bg-sky-100 text-sky-700 px-2 py-0.5">En curso</span>}
                  <button disabled={ocupado} onClick={() => abrir(c.id)} className="ml-auto rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-sm font-extrabold disabled:opacity-50">
                    {c.en_curso ? "Continuar" : c.resuelto ? "Jugar otra vez" : "Investigar"}
                  </button>
                </div>
                {c.resuelto && <p className="px-3 pb-2 text-[11px] text-slate-500">El premio se entrega una sola vez; jugar de nuevo solo mejora tu puntaje.</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const amb = api.AMBIENTES[vista.ambientacion] || api.AMBIENTES.oakhaven;
  const terminado = vista.estado !== "en_curso";

  // ---------- INTRODUCCIÓN ----------
  if (intro && !terminado) {
    return (
      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow">
        <div className="p-4 text-white" style={{ background: amb.fondo }}>
          <div className="text-4xl">{amb.emoji}</div>
          <h2 className="text-xl font-extrabold mt-1">{vista.titulo}</h2>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-slate-700 whitespace-pre-line leading-relaxed">{vista.historia}</p>
          <p className="text-sm text-slate-500">Tienes <b>{vista.vidas_max} horas</b>. Cada error cuesta una; arrestar a un inocente cuesta dos. {vista.total} paradas te separan del culpable.</p>
          <div className="flex gap-2">
            <button onClick={() => setIntro(false)} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 font-extrabold">🔎 Empezar la investigación</button>
            <button onClick={salir} className="rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-2 text-sm font-bold">Volver</button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- RESULTADO ----------
  if (terminado) {
    const gano = vista.estado === "resuelto";
    return (
      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow">
        <div className="p-5 text-white text-center" style={{ background: gano ? "linear-gradient(135deg,#065f46,#047857)" : "linear-gradient(135deg,#7f1d1d,#b91c1c)" }}>
          <div className="text-5xl">{gano ? "🎉" : "⌛"}</div>
          <h2 className="text-2xl font-extrabold mt-1">{gano ? "¡Caso resuelto!" : "Se acabó el tiempo"}</h2>
          <p className="opacity-90 text-sm mt-1">{vista.titulo}</p>
        </div>
        <div className="p-4 space-y-3 text-center">
          {gano ? (
            <>
              <p className="text-slate-700">El culpable era <b>{final?.culpable}</b>.</p>
              <div className="flex justify-center gap-2 flex-wrap text-sm font-extrabold">
                {final?.premio ? <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1">+{final.xp} XP · +{final.oro} 🪙</span> : <span className="rounded-full bg-slate-100 text-slate-600 px-3 py-1">Premio ya recibido antes</span>}
                <span className="rounded-full bg-indigo-100 text-indigo-700 px-3 py-1">Puntaje {final?.puntos ?? 0}</span>
              </div>
              {!!ranking.length && (
                <div className="text-left max-w-sm mx-auto">
                  <div className="text-xs font-bold text-slate-500 mb-1">🏆 Mejores detectives del curso</div>
                  {ranking.map((r, i) => <div key={i} className={`flex justify-between text-sm px-2 py-1 rounded ${r.yo ? "bg-indigo-50 font-bold" : ""}`}><span>{i + 1}. {r.nombre}</span><span>{r.puntos}</span></div>)}
                </div>
              )}
            </>
          ) : (
            <p className="text-slate-700">{final?.culpable ? <>El culpable era <b>{final.culpable}</b> y escapó. </> : "El culpable escapó. "}Repasa el tema y vuelve a intentarlo: puedes reabrir el caso cuando quieras.</p>
          )}
          <div className="flex justify-center gap-2">
            <button onClick={() => abrir(caso)} disabled={ocupado} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 font-extrabold disabled:opacity-50">{gano ? "Jugar otra vez" : "Reintentar"}</button>
            <button onClick={salir} className="rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2 font-bold">Volver a los casos</button>
          </div>
          {err && <div role="alert" className="text-sm text-rose-600">{err}</div>}
        </div>
      </div>
    );
  }

  // ---------- JUEGO ----------
  const lugar = vista.lugar || {};
  return (
    <div className="space-y-3">
      <div className="rounded-2xl p-3 text-white flex items-center gap-2 flex-wrap" style={{ background: amb.fondo }}>
        <button onClick={salir} className="rounded-lg bg-white/20 hover:bg-white/30 px-2 py-1 text-xs font-bold" aria-label="Salir del caso">←</button>
        <div className="min-w-0 flex-1"><div className="font-extrabold leading-tight truncate">{vista.titulo}</div><div className="text-xs opacity-80">Parada {vista.parada} de {vista.total}</div></div>
        <div className="text-lg"><Horas n={vista.vidas} max={vista.vidas_max} /></div>
        <button onClick={() => setExpediente((x) => !x)} className="rounded-lg bg-white/20 hover:bg-white/30 px-2.5 py-1 text-sm font-bold">📁 Expediente</button>
      </div>

      {expediente && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm space-y-2">
          <div className="font-extrabold text-amber-900">📁 Tu expediente</div>
          {!vista.rasgos.length && !vista.pistas.length && <p className="text-amber-800/80">Aún no tienes pistas.</p>}
          {!!vista.rasgos.length && <div><b>Rasgos del culpable:</b><ul className="list-disc ml-5">{vista.rasgos.map((r, i) => <li key={i}>{r}</li>)}</ul></div>}
          {!!vista.pistas.length && <div><b>Testimonios:</b>{vista.pistas.map((p, i) => <p key={i} className="mt-1"><i>{p.testigo} ({p.lugar}):</i> «{p.texto}»</p>)}</div>}
        </div>
      )}

      {err && <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm p-2.5">{err}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-start gap-3">
          <div className="text-4xl">{lugar.emoji}</div>
          <div><div className="font-extrabold text-lg leading-tight">{lugar.lugar}</div>{lugar.escena && <p className="text-sm text-slate-600 mt-0.5">{lugar.escena}</p>}</div>
        </div>

        {vista.fase === "pregunta" && vista.pregunta && (
          <>
            {aviso?.tipo === "ok" ? null : (
              <>
                <div className="text-xs font-bold text-slate-500">💬 Para que {lugar.testigo} hable, responde:</div>
                <p className="font-bold text-slate-800">{vista.pregunta.texto}</p>
                <div className="grid gap-2">
                  {ops.map((o, j) => (
                    <button key={o} disabled={ocupado || malas.includes(o)} onClick={() => responder(o)}
                      className="text-left rounded-xl text-white px-3 py-2.5 font-semibold disabled:opacity-40 flex gap-2" style={{ background: COL_OP[j % COL_OP.length] }}>
                      <b>{LETRAS[j]}.</b><span>{o}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {vista.fase === "destino" && (
          <>
            {aviso?.tipo === "ok" ? null : (
              <>
                <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-sm">
                  <b>{vista.pistas[vista.pistas.length - 1]?.testigo}:</b> «{vista.pistas[vista.pistas.length - 1]?.texto}»
                </div>
                <div className="text-xs font-bold text-slate-500">🧭 ¿A dónde viajas?</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {dest.map((d) => (
                    <button key={d} disabled={ocupado || malas.includes(d)} onClick={() => viajar(d)}
                      className="rounded-xl bg-slate-800 hover:bg-slate-700 text-white px-3 py-2.5 font-bold disabled:opacity-40">🚩 {d}</button>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {vista.fase === "arresto" && (
          <>
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-sm">
              <b>{vista.pistas[vista.pistas.length - 1]?.testigo}:</b> «{vista.pistas[vista.pistas.length - 1]?.texto}»
            </div>
            <div className="text-xs font-bold text-slate-500">🚨 ¡Lo encontraste! Compara los rasgos de tu expediente y arresta al sospechoso correcto.</div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-2 text-sm"><b>Buscas a alguien que:</b> {vista.rasgos.join(" · ") || "—"}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(vista.sospechosos || []).map((s) => {
                const coinc = vista.rasgos.filter((r) => s.rasgos.includes(r)).length;
                const descartado = malas.includes(`s${s.id}`);
                return (
                  <div key={s.id} className={`rounded-xl border p-3 ${descartado ? "opacity-40 border-slate-200" : "border-slate-300 bg-slate-50"}`}>
                    <div className="flex items-center gap-2"><span className="text-3xl">{s.emoji}</span><div className="font-extrabold">{s.nombre}</div></div>
                    <ul className="mt-1 text-sm space-y-0.5">{s.rasgos.map((r, i) => <li key={i} className={vista.rasgos.includes(r) ? "text-emerald-700 font-bold" : "text-slate-600"}>{vista.rasgos.includes(r) ? "✔" : "•"} {r}</li>)}</ul>
                    <div className="text-[11px] text-slate-500 mt-1">Coincide en {coinc} de {vista.rasgos.length}</div>
                    {confirmar === s.id
                      ? <div className="flex gap-2 mt-2"><button disabled={ocupado} onClick={() => arrestar(s)} className="flex-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white py-1.5 text-sm font-extrabold disabled:opacity-50">¡Sí, arrestar!</button><button onClick={() => setConfirmar(null)} className="rounded-lg bg-slate-200 px-3 text-sm font-bold">No</button></div>
                      : <button disabled={ocupado || descartado} onClick={() => setConfirmar(s.id)} className="mt-2 w-full rounded-lg bg-slate-800 hover:bg-slate-700 text-white py-1.5 text-sm font-bold disabled:opacity-50">🚔 Arrestar</button>}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {aviso && (
          <div role="status" className={`rounded-xl p-3 text-sm border ${aviso.tipo === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
            {aviso.tipo === "ok" ? (
              <div className="space-y-2">
                <div className="font-extrabold">✅ ¡Correcto!</div>
                {aviso.texto && <p>{aviso.texto}</p>}
                {aviso.pista && <p className="rounded-lg bg-white/70 p-2"><b>{aviso.pista.testigo}:</b> «{aviso.pista.texto}»</p>}
                {aviso.rasgo && <p>🔍 Nuevo rasgo del culpable: <b>{aviso.rasgo}</b></p>}
                <button onClick={() => setAviso(null)} className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 font-extrabold">Elegir destino →</button>
              </div>
            ) : (
              <div><b>⏳ −{aviso.texto.includes("2 horas") ? "2 horas" : "1 hora"}.</b> {aviso.texto}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
