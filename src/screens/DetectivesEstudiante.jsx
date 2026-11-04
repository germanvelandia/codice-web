import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "../lib/detectivesApi";

// Detectives del Códice — pantalla del estudiante.
// Todo lo importante (respuesta correcta, destino correcto, culpable) lo decide el servidor.

const mezclar = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const CSS = `
@keyframes dtPop{0%{opacity:0;transform:translateY(12px) scale(.92)}70%{transform:translateY(-2px) scale(1.02)}100%{opacity:1;transform:none}}
@keyframes dtSlide{0%{opacity:0;transform:translateX(40px)}100%{opacity:1;transform:none}}
@keyframes dtShake{0%,100%{transform:translateX(0)}15%{transform:translateX(-9px) rotate(-1deg)}35%{transform:translateX(8px) rotate(1deg)}55%{transform:translateX(-6px)}75%{transform:translateX(4px)}}
@keyframes dtFlash{0%{box-shadow:0 0 0 0 #ef444400}30%{box-shadow:0 0 0 6px #ef4444aa}100%{box-shadow:0 0 0 0 #ef444400}}
@keyframes dtFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes dtBounce{0%,100%{transform:translateY(0)}40%{transform:translateY(-14px)}60%{transform:translateY(-4px)}}
@keyframes dtLose{0%{transform:scale(1.4) rotate(0);opacity:1;filter:none}60%{transform:scale(1.7) rotate(200deg);opacity:.8}100%{transform:scale(1) rotate(360deg);opacity:.25;filter:grayscale(1)}}
@keyframes dtSpark{0%{opacity:1;transform:translate(0,0) scale(.4)}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(1.3) rotate(180deg)}}
@keyframes dtWalk{0%{left:-14%}100%{left:106%}}
@keyframes dtStep{0%,100%{transform:translateY(0) rotate(-6deg)}50%{transform:translateY(-8px) rotate(6deg)}}
@keyframes dtScroll{0%{background-position:0 0}100%{background-position:-240px 0}}
@keyframes dtCloud{0%{transform:translateX(120%)}100%{transform:translateX(-140%)}}
@keyframes dtSirenA{0%,100%{background:#7f1d1d}50%{background:#1e3a8a}}
@keyframes dtCar{0%{left:-20%}60%{left:38%}100%{left:38%}}
@keyframes dtFall{0%{transform:translateY(-20px) rotate(0);opacity:1}100%{transform:translateY(105vh) rotate(720deg);opacity:.9}}
@keyframes dtStamp{0%{opacity:0;transform:scale(3) rotate(-18deg)}60%{opacity:1;transform:scale(.9) rotate(-8deg)}100%{opacity:1;transform:scale(1) rotate(-8deg)}}
@keyframes dtSwing{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(14deg)}}
@keyframes dtGlow{0%,100%{box-shadow:0 0 0 0 #f59e0b00}50%{box-shadow:0 0 0 5px #f59e0b88}}
.dt-pop{animation:dtPop .45s both cubic-bezier(.2,.9,.3,1.2)}
.dt-slide{animation:dtSlide .45s both ease-out}
.dt-shake{animation:dtShake .55s}
.dt-flash{animation:dtFlash .8s}
.dt-float{display:inline-block;animation:dtFloat 2.4s ease-in-out infinite}
.dt-bounce{display:inline-block;animation:dtBounce 1.2s ease-in-out infinite}
.dt-lose{display:inline-block;animation:dtLose .9s both}
.dt-stamp{animation:dtStamp .5s both}
.dt-glow{animation:dtGlow 1.4s ease-in-out infinite}
.dt-swing{display:inline-block;transform-origin:50% 0;animation:dtSwing 1.1s ease-in-out infinite}
.dt-btn{transition:transform .12s, filter .12s}
.dt-btn:not(:disabled):hover{transform:translateY(-2px);filter:brightness(1.08)}
.dt-btn:not(:disabled):active{transform:scale(.96)}
.dt-spark{position:absolute;left:50%;top:50%;pointer-events:none;animation:dtSpark .9s both ease-out}
.dt-road{position:relative;height:170px;overflow:hidden;border-radius:16px;background:linear-gradient(#7dd3fc,#e0f2fe 60%)}
.dt-ground{position:absolute;left:0;right:0;bottom:0;height:56px;background:repeating-linear-gradient(90deg,#78716c 0 40px,#a8a29e 40px 80px);animation:dtScroll .6s linear infinite}
.dt-walker{position:absolute;bottom:40px;font-size:42px;animation:dtWalk 1.9s linear both}
.dt-walker span{display:inline-block;animation:dtStep .32s ease-in-out infinite}
.dt-cloud{position:absolute;top:14px;font-size:34px;opacity:.9;animation:dtCloud 6s linear infinite}
.dt-siren{animation:dtSirenA .35s steps(1) infinite}
.dt-car{position:absolute;bottom:34px;font-size:60px;animation:dtCar 1.2s both ease-out}
.dt-conf{position:fixed;top:-20px;z-index:60;pointer-events:none;animation:dtFall 3.2s linear both}
.dt-track{position:relative;height:30px}
.dt-detective{position:absolute;top:-6px;font-size:24px;transition:left .9s cubic-bezier(.4,.1,.2,1);transform:translateX(-50%)}
@media (prefers-reduced-motion: reduce){.dt-pop,.dt-slide,.dt-shake,.dt-flash,.dt-float,.dt-bounce,.dt-lose,.dt-stamp,.dt-glow,.dt-swing,.dt-spark,.dt-walker,.dt-walker span,.dt-ground,.dt-cloud,.dt-siren,.dt-car,.dt-conf{animation:none!important}.dt-detective{transition:none}}
`;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const CHISPAS = Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; const d = 50 + (i % 3) * 22; return { dx: Math.round(Math.cos(a) * d), dy: Math.round(Math.sin(a) * d), e: ["✨", "⭐", "💫"][i % 3], t: (i % 4) * 40 }; });
const CONFETI = Array.from({ length: 34 }, (_, i) => ({ l: (i * 29) % 100, d: (i % 9) * 0.22, e: ["🎉", "⭐", "✨", "🎊", "🏅"][i % 5], s: 16 + (i % 4) * 6 }));
const LETRAS = ["A", "B", "C", "D", "E"];
const COL_OP = ["#6366f1", "#0ea5e9", "#f59e0b", "#ec4899", "#10b981"];

function Horas({ n, max }) {
  const prev = useRef(n);
  const perdidas = prev.current > n ? prev.current - n : 0;
  useEffect(() => { prev.current = n; }, [n]);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} de ${max} horas restantes`}>
      {Array.from({ length: max }).map((_, i) => (i >= n && i < n + perdidas)
        ? <span key={`p${i}`} className="dt-lose">⏳</span>
        : <span key={i} className={i < n ? "" : "opacity-25 grayscale"}>⏳</span>)}
    </span>
  );
}

export default function DetectivesEstudiante(props) { return <><style>{CSS}</style><Juego {...props} /></>; }

function Juego({ estudianteInfo }) {
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
  const [fx, setFx] = useState("");               // efecto breve: "mal"
  const [viaje, setViaje] = useState(null);       // animación de viaje entre paradas
  const [sirena, setSirena] = useState(null);      // animación del arresto
  const bloqueo = useRef(false);
  const efecto = (t) => { setFx(t); setTimeout(() => setFx(""), 900); };

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
    else { setAviso({ tipo: "mal", texto: r.retro || "Respuesta incorrecta." }); setMalas((m) => [...m, op]); efecto("mal"); }
  });
  const viajar = (d) => accion(async () => {
    const r = await api.viajarDetectives(est, caso, d);
    setVista(r.vista);
    if (r.ok) {
      setAviso(null); setMalas([]);
      const fin = r.vista.fase === "arresto";
      setViaje({ nombre: fin ? "el escondite del culpable" : r.vista.lugar?.lugar, emoji: fin ? "🚨" : r.vista.lugar?.emoji });
      await esperar(2000); setViaje(null);
    } else { setAviso({ tipo: "mal", texto: "Aquí no hay rastro del culpable. Perdiste una hora." }); setMalas((m) => [...m, d]); efecto("mal"); }
  });
  const arrestar = (s) => accion(async () => {
    setConfirmar(null); setSirena(s);
    const [r] = await Promise.all([api.arrestarDetectives(est, caso, s.id).catch((e) => { setSirena(null); throw e; }), esperar(1700)]);
    setSirena(null); setVista(r.vista);
    if (r.ok) { setFinal({ ganado: true, ...r }); api.rankingDetectives(est, caso).then(setRanking).catch(() => {}); }
    else { setAviso({ tipo: "mal", texto: `${s.nombre} era inocente. Pierdes 2 horas.` }); setMalas((m) => [...m, `s${s.id}`]); efecto("mal"); if (r.vista.estado === "fallido") setFinal({ ganado: false, culpable: r.culpable }); }
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

  // ---------- ANIMACIONES DE ESCENA ----------
  if (sirena) {
    return (
      <div className="dt-siren relative overflow-hidden rounded-2xl text-white text-center" style={{ height: 300 }} role="status" aria-live="polite">
        <div style={{ position: "absolute", left: 0, right: 0, top: 20, fontSize: 20, fontWeight: 800 }}>🚨 ¡Alto en nombre del Códice! 🚨</div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 64, fontSize: 60 }}><span className="dt-bounce">{sirena.emoji}</span></div>
        <div className="dt-car">🚔</div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 20, fontSize: 14, opacity: 0.9 }}>Arrestando a {sirena.nombre}…</div>
      </div>
    );
  }
  if (viaje) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <div className="dt-road">
          <span className="dt-cloud" style={{ animationDuration: "7s" }}>☁️</span>
          <span className="dt-cloud" style={{ animationDuration: "11s", animationDelay: "-4s", top: 44, fontSize: 24 }}>☁️</span>
          <div className="dt-ground" />
          <div className="dt-walker"><span>🕵️</span></div>
        </div>
        <p className="text-center font-extrabold text-slate-700">Viajando hacia {viaje.emoji} {viaje.nombre}…</p>
      </div>
    );
  }

  // ---------- INTRODUCCIÓN ----------
  if (intro && !terminado) {
    return (
      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow">
        <div className="p-4 text-white" style={{ background: amb.fondo }}>
          <div className="text-5xl dt-float">{amb.emoji}</div>
          <h2 className="text-xl font-extrabold mt-1 dt-slide">{vista.titulo}</h2>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-slate-700 whitespace-pre-line leading-relaxed dt-pop" style={{ animationDelay: ".25s" }}>{vista.historia}</p>
          <p className="text-sm text-slate-500">Tienes <b>{vista.vidas_max} horas</b>. Cada error cuesta una; arrestar a un inocente cuesta dos. {vista.total} paradas te separan del culpable.</p>
          <div className="flex gap-2">
            <button onClick={() => setIntro(false)} className="dt-btn dt-glow rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 font-extrabold">🔎 Empezar la investigación</button>
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
        {gano && CONFETI.map((c, i) => <span key={i} className="dt-conf" style={{ left: `${c.l}%`, animationDelay: `${c.d}s`, fontSize: c.s }} aria-hidden="true">{c.e}</span>)}
        <div className="p-5 text-white text-center" style={{ background: gano ? "linear-gradient(135deg,#065f46,#047857)" : "linear-gradient(135deg,#7f1d1d,#b91c1c)" }}>
          <div className={`text-5xl ${gano ? "dt-bounce" : "dt-swing"}`}>{gano ? "🏆" : "⌛"}</div>
          <h2 className="text-2xl font-extrabold mt-1">{gano ? "¡Caso resuelto!" : "Se acabó el tiempo"}</h2>
          <p className="opacity-90 text-sm mt-1">{vista.titulo}</p>
        </div>
        <div className="p-4 space-y-3 text-center">
          {gano ? (
            <>
              <p className="text-slate-700 dt-pop">El culpable era <b>{final?.culpable}</b>. <span className="inline-block dt-stamp font-extrabold text-rose-600 border-2 border-rose-500 rounded px-1.5">ARRESTADO</span></p>
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

      <div className="px-3" aria-label={`Parada ${vista.parada} de ${vista.total}`}>
        <div className="dt-track">
          <div style={{ position: "absolute", left: 0, right: 0, top: 12, height: 4, borderRadius: 4, background: "#cbd5e1" }} />
          {Array.from({ length: vista.total + 1 }).map((_, i) => <span key={i} style={{ position: "absolute", top: 7, width: 14, height: 14, borderRadius: 999, borderWidth: 2, borderStyle: "solid", left: `${(i / vista.total) * 100}%`, transform: "translateX(-50%)" }} className={`${i < vista.parada - 1 + (vista.fase === "arresto" ? 1 : 0) + (vista.fase === "destino" ? 0 : 0) ? "bg-emerald-500 border-emerald-600" : "bg-white border-slate-400"}`}>{i === vista.total && <span style={{ position: "absolute", top: -4, left: 12, fontSize: 12 }}>🚨</span>}</span>)}
          <span className="dt-detective" style={{ left: `${(Math.min(vista.fase === "arresto" ? vista.total : vista.parada - 1, vista.total) / vista.total) * 100}%` }}>🕵️</span>
        </div>
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

      <div key={`${vista.parada}-${vista.fase === "arresto" ? "a" : "p"}`} className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 dt-slide ${fx === "mal" ? "dt-shake dt-flash" : ""}`}>
        <div className="flex items-start gap-3">
          <div className="text-4xl dt-float">{lugar.emoji}</div>
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
                      className="dt-btn dt-pop text-left rounded-xl text-white px-3 py-2.5 font-semibold disabled:opacity-40 flex gap-2" style={{ background: COL_OP[j % COL_OP.length], animationDelay: `${j * 90}ms` }}>
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
                      className="dt-btn dt-pop rounded-xl bg-slate-800 hover:bg-slate-700 text-white px-3 py-2.5 font-bold disabled:opacity-40" style={{ animationDelay: `${dest.indexOf(d) * 90}ms` }}>🚩 {d}</button>
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
                  <div key={s.id} className={`dt-pop rounded-xl border p-3 transition-opacity ${descartado ? "opacity-40 border-slate-200 dt-shake" : "border-slate-300 bg-slate-50"}`} style={{ animationDelay: `${(vista.sospechosos || []).indexOf(s) * 120}ms` }}>
                    <div className="flex items-center gap-2"><span className="text-3xl dt-float">{s.emoji}</span><div className="font-extrabold">{s.nombre}</div></div>
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
              <div className="space-y-2 relative dt-pop">
                {CHISPAS.map((c, i) => <span key={i} className="dt-spark" style={{ "--dx": `${c.dx}px`, "--dy": `${c.dy}px`, animationDelay: `${c.t}ms` }} aria-hidden="true">{c.e}</span>)}
                <div className="font-extrabold">✅ ¡Correcto!</div>
                {aviso.texto && <p>{aviso.texto}</p>}
                {aviso.pista && <p className="rounded-lg bg-white/70 p-2 dt-slide" style={{ animationDelay: ".3s" }}><b>{aviso.pista.testigo}:</b> «{aviso.pista.texto}»</p>}
                {aviso.rasgo && <p className="dt-pop" style={{ animationDelay: ".6s" }}>🔍 Nuevo rasgo del culpable: <b className="dt-glow rounded px-1">{aviso.rasgo}</b></p>}
                <button onClick={() => setAviso(null)} className="dt-btn rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 font-extrabold">Elegir destino →</button>
              </div>
            ) : (
              <div className="dt-pop"><b>⏳ −{aviso.texto.includes("2 horas") ? "2 horas" : "1 hora"}.</b> {aviso.texto}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
