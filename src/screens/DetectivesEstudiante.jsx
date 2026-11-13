import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "../lib/detectivesApi";
import { Rostro, Jefa, Escena, MapaFondo, Cartel, Globo, asignarPuntos, rangoDe, sonido, fijarSilencio, estaSilenciado } from "./detectivesArte";

// Detectives del Códice — pantalla del estudiante (versión ilustrada).
// Todo lo importante (respuesta correcta, destino correcto, culpable) lo decide el servidor.
// El arte es original y se dibuja con SVG; los rostros salen de los rasgos del caso.

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
@keyframes dtDash{0%{stroke-dashoffset:60}100%{stroke-dashoffset:0}}
@keyframes dtPin{0%,100%{transform:translate(-50%,-100%) translateY(0)}50%{transform:translate(-50%,-100%) translateY(-4px)}}
@keyframes dtSpot{0%,100%{opacity:.55}50%{opacity:.95}}
.dt-ruta{stroke-dasharray:6 5;animation:dtDash 1.9s linear both}
.dt-pin{position:absolute;transform:translate(-50%,-100%);animation:dtPin 1.8s ease-in-out infinite;border:0;background:none;padding:0;cursor:pointer;text-align:center}
.dt-pin:disabled{opacity:.4;cursor:default;animation:none}
.dt-pin:not(:disabled):hover .dt-chip{background:#fde047;color:#1e293b}
.dt-chip{display:block;margin-top:1px;background:#0f172ae6;color:#fff;border-radius:8px;padding:1px 6px;font:700 10px system-ui,sans-serif;max-width:110px;line-height:1.2;box-shadow:0 2px 6px #0006}
.dt-spot{animation:dtSpot .5s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.dt-pop,.dt-slide,.dt-shake,.dt-flash,.dt-float,.dt-bounce,.dt-lose,.dt-stamp,.dt-glow,.dt-swing,.dt-spark,.dt-walker,.dt-walker span,.dt-ground,.dt-cloud,.dt-siren,.dt-car,.dt-conf,.dt-ruta,.dt-pin,.dt-spot{animation:none!important}.dt-detective{transition:none}}
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

const marco = { background: "linear-gradient(160deg,#0f172a,#1e1b4b)", borderRadius: 18, padding: 12, color: "#fff" };

export default function DetectivesEstudiante(props) { return <><style>{CSS}</style><Juego {...props} /></>; }

function Juego({ estudianteInfo }) {
  const est = estudianteInfo?.id;
  const [lista, setLista] = useState(null);
  const [vista, setVista] = useState(null);
  const [caso, setCaso] = useState(null);
  const [err, setErr] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(null);       // solo errores: { texto }
  const [testimonio, setTestimonio] = useState(null); // tras acertar: { retro, pista, rasgo }
  const [malas, setMalas] = useState([]);
  const [intro, setIntro] = useState(false);
  const [final, setFinal] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [expediente, setExpediente] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const [fx, setFx] = useState("");
  const [viaje, setViaje] = useState(null);
  const [sirena, setSirena] = useState(null);
  const [mudo, setMudo] = useState(estaSilenciado());
  const [antes, setAntes] = useState(0);
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

  const resueltos = (lista || []).filter((c) => c.resuelto).length;
  const abrir = (id) => accion(async () => {
    const v = await api.iniciarDetectives(est, id);
    setAntes(resueltos);
    setCaso(id); setVista(v); setAviso(null); setTestimonio(null); setMalas([]); setFinal(null); setConfirmar(null); setExpediente(false);
    const ult = (v.pistas || [])[v.pistas.length - 1];
    if (v.fase !== "pregunta" && ult) setTestimonio({ retro: "", pista: { testigo: ult.testigo, texto: ult.texto }, rasgo: null });
    setIntro(v.parada === 1 && v.fase === "pregunta" && !(v.pistas || []).length);
  });
  const salir = () => { setCaso(null); setVista(null); setFinal(null); setAviso(null); setTestimonio(null); cargar(); };

  const responder = (op) => accion(async () => {
    sonido.click();
    const r = await api.responderDetectives(est, caso, op);
    setVista(r.vista);
    if (r.ok) { sonido.ok(); setAviso(null); setTestimonio({ retro: r.retro, pista: r.pista, rasgo: r.rasgo }); setMalas([]); }
    else { sonido.mal(); setAviso({ texto: r.retro || "Respuesta incorrecta.", costo: 1 }); setMalas((m) => [...m, op]); efecto("mal"); if (r.vista.estado === "fallido") setFinal({ ganado: false }); }
  });
  const viajar = (d, desde, hasta) => accion(async () => {
    const r = await api.viajarDetectives(est, caso, d);
    setVista(r.vista);
    if (r.ok) {
      sonido.viaje();
      setAviso(null); setMalas([]); setTestimonio(null);
      const fin = r.vista.fase === "arresto";
      setViaje({ nombre: fin ? "el escondite del culpable" : r.vista.lugar?.lugar, desde, hasta });
      await esperar(2100); setViaje(null);
      const ult = r.vista.pistas[r.vista.pistas.length - 1];
      if (fin && ult) setTestimonio({ retro: "", pista: { testigo: ult.testigo, texto: ult.texto }, rasgo: null });
    } else { sonido.mal(); setAviso({ texto: "Aquí no hay rastro del culpable.", costo: 1 }); setMalas((m) => [...m, d]); efecto("mal"); if (r.vista.estado === "fallido") setFinal({ ganado: false }); }
  });
  const arrestar = (s) => accion(async () => {
    setConfirmar(null); setSirena(s); sonido.sirena();
    const [r] = await Promise.all([api.arrestarDetectives(est, caso, s.id).catch((e) => { setSirena(null); throw e; }), esperar(2000)]);
    setSirena(null); setVista(r.vista);
    if (r.ok) { sonido.victoria(); setFinal({ ganado: true, ...r }); api.rankingDetectives(est, caso).then(setRanking).catch(() => {}); }
    else {
      sonido.mal(); setAviso({ texto: `${s.nombre} era inocente.`, costo: (vista.dificultad === "experto" ? 3 : 2) }); setMalas((m) => [...m, `s${s.id}`]); efecto("mal");
      if (r.vista.estado === "fallido") { sonido.derrota(); setFinal({ ganado: false, culpable: r.culpable }); }
    }
  });

  const puntos = useMemo(() => (vista?.lugar ? asignarPuntos([vista.lugar.lugar, ...(vista.destinos || [])]) : {}), [vista?.parada, vista?.fase === "destino"]); // eslint-disable-line

  if (!est) return <p className="text-sm text-slate-400">Inicia sesión para jugar.</p>;

  const alternarSonido = () => { fijarSilencio(!mudo); setMudo(!mudo); };
  const rango = rangoDe(resueltos);

  // ---------- LISTA ----------
  if (!vista) {
    return (
      <div className="space-y-4">
        <div style={{ ...marco, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flexShrink: 0 }}><Jefa ancho={96} /></div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, letterSpacing: 3, opacity: 0.7, fontWeight: 800 }}>AGENCIA CÓDICE · DIVISIÓN DE DETECTIVES</div>
            <h2 className="text-xl font-extrabold">🕵️ Detectives del Códice</h2>
            <p className="text-sm opacity-90">Cada caso te lleva por varios lugares: responde bien a los testigos, arma el retrato hablado y arresta al culpable antes de que se acaben tus horas.</p>
            <div style={{ marginTop: 8, background: "#ffffff1f", borderRadius: 12, padding: "6px 10px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 26 }}>{rango.emoji}</span>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div className="font-extrabold text-sm">Rango: {rango.nombre}</div>
                <div style={{ height: 6, background: "#0006", borderRadius: 6, overflow: "hidden", marginTop: 3 }}><div style={{ height: "100%", width: `${rango.siguiente ? Math.min(100, ((resueltos - rango.min) / (rango.siguiente.min - rango.min)) * 100) : 100}%`, background: "#fbbf24", transition: "width .8s" }} /></div>
                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{rango.siguiente ? `${rango.falta} caso(s) resuelto(s) para ser ${rango.siguiente.nombre}` : "¡Has llegado al máximo rango!"} · Casos resueltos: {resueltos}</div>
              </div>
              <button onClick={alternarSonido} className="dt-btn" style={{ background: "#ffffff22", borderRadius: 10, padding: "4px 9px", fontSize: 14 }} aria-label={mudo ? "Activar sonido" : "Silenciar"}>{mudo ? "🔇" : "🔊"}</button>
            </div>
          </div>
        </div>
        {err && <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm p-2.5">{err}</div>}
        {lista === null && <p className="text-sm text-slate-400">Cargando casos…</p>}
        {lista && !lista.length && <p className="text-sm text-slate-500">Todavía no hay casos abiertos para tu curso. ¡Pronto llegará uno!</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {(lista || []).map((c) => {
            const amb = api.AMBIENTES[c.ambientacion] || api.AMBIENTES.oakhaven;
            return (
              <div key={c.id} className="dt-pop" style={{ borderRadius: 18, overflow: "hidden", background: "#fff", boxShadow: "0 3px 12px #0002", border: "1px solid #e2e8f0" }}>
                <div style={{ position: "relative" }}>
                  <Escena lugar={c.ambientacion === "mundo" ? "aeropuerto" : c.ambientacion === "valores" ? "colegio" : "torre del reloj"} ambientacion={c.ambientacion} testigo={null} />
                  <div style={{ position: "absolute", left: 8, top: 8, background: "#0f172acc", color: "#fff", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>{amb.emoji} {amb.label}</div>
                  {c.resuelto && <div className="dt-stamp" style={{ position: "absolute", right: 10, bottom: 14, border: "3px solid #16a34a", color: "#16a34a", background: "#ffffffd9", borderRadius: 6, padding: "1px 8px", fontWeight: 900, letterSpacing: 2 }}>RESUELTO</div>}
                </div>
                <div style={{ padding: 12 }}>
                  <div className="font-extrabold leading-tight">{c.titulo}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{c.paradas} paradas · recompensa +{c.xp} XP · +{c.oro} 🪙{c.dificultad && c.dificultad !== "normal" ? ` · ${((api.DIFICULTADES || {})[c.dificultad] || {}).emoji} ${((api.DIFICULTADES || {})[c.dificultad] || {}).label}` : ""}</div>
                  <button disabled={ocupado} onClick={() => abrir(c.id)} className="dt-btn mt-2 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2 font-extrabold disabled:opacity-50">
                    {c.en_curso ? "▶ Continuar el caso" : c.resuelto ? "↻ Jugar otra vez" : "📂 Abrir expediente"}
                  </button>
                  {c.resuelto && <p className="text-[11px] text-slate-500 mt-1">El premio se entrega una sola vez; jugar de nuevo solo mejora tu puntaje.</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const amb = api.AMBIENTES[vista.ambientacion] || api.AMBIENTES.oakhaven;
  const terminado = vista.estado !== "en_curso";
  const meta = (lista || []).find((c) => c.id === caso) || {};

  // ---------- ANIMACIONES DE ESCENA ----------
  if (sirena) {
    return (
      <div className="dt-siren" role="status" aria-live="polite" style={{ position: "relative", overflow: "hidden", borderRadius: 18, height: 340, color: "#fff", textAlign: "center" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 14, fontSize: 19, fontWeight: 800 }}>🚨 ¡Alto en nombre del Códice! 🚨</div>
        <div className="dt-spot" style={{ position: "absolute", left: "50%", top: 48, width: 180, height: 250, transform: "translateX(-50%)", background: "radial-gradient(ellipse at 50% 0%, #fff9 0%, #fff0 70%)", clipPath: "polygon(35% 0,65% 0,100% 100%,0 100%)" }} />
        <div style={{ position: "absolute", left: "50%", top: 78, transform: "translateX(-50%)" }} className="dt-shake"><Rostro nombre={sirena.nombre} rasgos={sirena.rasgos} ancho={140} /></div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 52, fontSize: 38 }}><span className="dt-bounce">⛓️</span></div>
        <div className="dt-car" style={{ fontSize: 46, bottom: 8 }}>🚔</div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 10, fontSize: 13, opacity: 0.9 }}>Arrestando a {sirena.nombre}…</div>
      </div>
    );
  }
  if (viaje) {
    const d = viaje.desde || [20, 50], h = viaje.hasta || [80, 50];
    const [x1, y1, x2, y2] = [d[0] * 3.6, d[1] * 2, h[0] * 3.6, h[1] * 2];
    const ruta = `M${x1} ${y1} Q${(x1 + x2) / 2} ${Math.min(y1, y2) - 50} ${x2} ${y2}`;
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <MapaFondo ambientacion={vista.ambientacion}>
          <svg viewBox="0 0 360 200" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden="true">
            <path d={ruta} fill="none" stroke="#fff" strokeWidth="2.4" className="dt-ruta" />
            <circle cx={x1} cy={y1} r="5" fill="#fbbf24" stroke="#fff" strokeWidth="2" /><circle cx={x2} cy={y2} r="5" fill="#ef4444" stroke="#fff" strokeWidth="2" />
            <g><path d="M-8 -5 L12 0 L-8 5 L-4 0 Z" fill="#fff" stroke="#1e293b" strokeWidth="1" /><animateMotion dur="1.9s" fill="freeze" rotate="auto" path={ruta} /></g>
          </svg>
        </MapaFondo>
        <p className="text-center font-extrabold text-slate-700">✈️ Viajando hacia {viaje.nombre}…</p>
      </div>
    );
  }

  // ---------- BRIEFING (la jefa te da el caso) ----------
  if (intro && !terminado) {
    return (
      <div style={{ ...marco, padding: 14 }} className="space-y-3">
        <div style={{ fontSize: 11, letterSpacing: 3, opacity: 0.7, fontWeight: 800 }}>AGENCIA CÓDICE · CASO CONFIDENCIAL</div>
        <h2 className="text-xl font-extrabold dt-slide">{amb.emoji} {vista.titulo}</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 260px", minWidth: 240 }}>
            <Globo quien="Comisaria Alba Ferrer" texto={`Agente, te necesito ahora mismo.\n\n${vista.historia}\n\nTienes ${vista.vidas_max} horas y ${vista.total} paradas para seguir el rastro. Cada error cuesta una hora; arrestar a un inocente cuesta dos. ¡Confío en ti!`}>
              <button onClick={() => { sonido.click(); setIntro(false); }} className="dt-btn dt-glow rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 font-extrabold">🔎 Aceptar el caso</button>
            </Globo>
            <div style={{ marginTop: 14 }}><Jefa ancho={92} /></div>
          </div>
          <div style={{ flex: "0 0 auto", margin: "0 auto" }} className="dt-pop"><Cartel titulo={vista.titulo} recompensa={`+${meta.xp ?? "?"} XP · +${meta.oro ?? "?"} 🪙`} silueta ancho={176} /></div>
        </div>
        <button onClick={salir} className="rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-sm font-bold">← Volver a los casos</button>
      </div>
    );
  }

  // ---------- RESULTADO ----------
  if (terminado || final) {
    const gano = vista.estado === "resuelto";
    const culpable = (vista.sospechosos || []).find((s) => s.nombre === final?.culpable);
    const nuevoRango = gano && final?.premio ? rangoDe(antes + 1) : null;
    const subio = nuevoRango && nuevoRango.i > rangoDe(antes).i;
    return (
      <div style={{ borderRadius: 18, overflow: "hidden", background: "#fff", boxShadow: "0 3px 12px #0002", border: "1px solid #e2e8f0" }}>
        {gano && CONFETI.map((c, i) => <span key={i} className="dt-conf" style={{ left: `${c.l}%`, animationDelay: `${c.d}s`, fontSize: c.s }} aria-hidden="true">{c.e}</span>)}
        <div style={{ background: gano ? "linear-gradient(135deg,#065f46,#047857)" : "linear-gradient(135deg,#7f1d1d,#b91c1c)", color: "#fff", textAlign: "center", padding: 16 }}>
          <div className={`text-5xl ${gano ? "dt-bounce" : "dt-swing"}`}>{gano ? "🏆" : "⌛"}</div>
          <h2 className="text-2xl font-extrabold mt-1">{gano ? "¡Caso resuelto!" : "Se acabó el tiempo"}</h2>
          <p className="opacity-90 text-sm">{vista.titulo}</p>
        </div>
        <div className="p-4 space-y-3" style={{ textAlign: "center" }}>
          {gano ? (
            <>
              <div style={{ display: "flex", justifyContent: "center" }} className="dt-pop"><Cartel titulo={vista.titulo} nombre={final?.culpable} rasgos={culpable?.rasgos || []} silueta={false} capturado ancho={170} /></div>
              <div className="flex justify-center gap-2 flex-wrap text-sm font-extrabold">
                {final?.premio ? <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1">+{final.xp} XP · +{final.oro} 🪙</span> : <span className="rounded-full bg-slate-100 text-slate-600 px-3 py-1">Premio ya recibido antes</span>}
                <span className="rounded-full bg-indigo-100 text-indigo-700 px-3 py-1">Puntaje {final?.puntos ?? 0}</span>
              </div>
              {subio && <div className="dt-pop rounded-xl bg-violet-100 text-violet-800 font-extrabold p-2">{nuevoRango.emoji} ¡Ascendiste a {nuevoRango.nombre}!</div>}
              {!!ranking.length && (
                <div className="text-left max-w-sm mx-auto">
                  <div className="text-xs font-bold text-slate-500 mb-1">🏆 Mejores detectives del curso</div>
                  {ranking.map((r, i) => <div key={i} className={`flex justify-between text-sm px-2 py-1 rounded ${r.yo ? "bg-indigo-50 font-bold" : ""}`}><span>{["🥇", "🥈", "🥉"][i] || `${i + 1}.`} {r.nombre}</span><span>{r.puntos}</span></div>)}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "center" }}><Cartel titulo="Escapó" nombre="" silueta ancho={150} /></div>
              <p className="text-slate-700">{final?.culpable ? <>El culpable era <b>{final.culpable}</b> y escapó. </> : "El culpable escapó. "}Repasa el tema y vuelve a intentarlo: puedes reabrir el caso cuando quieras.</p>
            </>
          )}
          <div className="flex justify-center gap-2">
            <button onClick={() => abrir(caso)} disabled={ocupado} className="dt-btn rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 font-extrabold disabled:opacity-50">{gano ? "Jugar otra vez" : "Reintentar"}</button>
            <button onClick={salir} className="dt-btn rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2 font-bold">Volver a los casos</button>
          </div>
          {err && <div role="alert" className="text-sm text-rose-600">{err}</div>}
        </div>
      </div>
    );
  }

  // ---------- JUEGO ----------
  const lugar = vista.lugar || {};
  const encontrados = vista.rasgos || [];
  const bloqueado = !!vista.retrato_bloqueado;
  const dificultad = vista.dificultad || "normal";
  const ayuda = dificultad === "normal"; // solo en normal se marcan las coincidencias con el retrato
  const faltan = Math.max(0, vista.total - (bloqueado ? vista.rasgos_n || 0 : encontrados.length));
  const ultimo = vista.pistas[vista.pistas.length - 1];

  const Retrato = (
    <div style={{ ...marco, padding: 10 }} aria-label="Retrato hablado">
      <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 800, opacity: 0.75 }}>🖼️ RETRATO HABLADO</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
        <div style={{ background: "#e2e8f0", borderRadius: 12, padding: 4, flexShrink: 0 }}><Rostro nombre="culpable" rasgos={encontrados} silueta={!encontrados.length} parcial ancho={92} />{bloqueado && <div style={{ textAlign: "center", fontSize: 18, marginTop: -4 }} aria-hidden>🔒</div>}</div>
        <ul style={{ fontSize: 12.5, lineHeight: 1.4, margin: 0, padding: 0, listStyle: "none", flex: 1 }}>
          {bloqueado && <li style={{ fontWeight: 800 }}>🔒 Retrato bloqueado <span style={{ fontWeight: 400, opacity: 0.8 }}>· {vista.rasgos_n || 0} de {vista.total} pistas guardadas</span></li>}
          {bloqueado && <li style={{ opacity: 0.75, fontSize: 11.5 }}>{dificultad === "experto" ? "Nunca se desbloquea: deduce al culpable con lo que dijeron los testigos." : "Se desbloquea al llegar a la rueda de reconocimiento."}</li>}
          {!bloqueado && encontrados.map((r, i) => <li key={i} className="dt-pop" style={{ animationDelay: `${i * 60}ms` }}>🔍 {r}</li>)}
          {!bloqueado && Array.from({ length: faltan }).map((_, i) => <li key={`f${i}`} style={{ opacity: 0.45 }}>❓ Rasgo por descubrir</li>)}
        </ul>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div style={{ ...marco, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button onClick={salir} className="rounded-lg bg-white/20 hover:bg-white/30 px-2 py-1 text-xs font-bold" aria-label="Salir del caso">←</button>
        <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 10, letterSpacing: 2, opacity: 0.7, fontWeight: 800 }}>AGENCIA CÓDICE</div><div className="font-extrabold leading-tight truncate">{vista.titulo}</div></div>
        <div className="text-lg"><Horas n={vista.vidas} max={vista.vidas_max} /></div>
        <button onClick={alternarSonido} className="rounded-lg bg-white/20 hover:bg-white/30 px-2 py-1 text-sm" aria-label={mudo ? "Activar sonido" : "Silenciar"}>{mudo ? "🔇" : "🔊"}</button>
        <button onClick={() => setExpediente((x) => !x)} className="rounded-lg bg-white/20 hover:bg-white/30 px-2.5 py-1 text-sm font-bold">📁</button>
      </div>

      <div className="px-3" aria-label={`Parada ${vista.parada} de ${vista.total}`}>
        <div className="dt-track">
          <div style={{ position: "absolute", left: 0, right: 0, top: 12, height: 4, borderRadius: 4, background: "#cbd5e1" }} />
          {Array.from({ length: vista.total + 1 }).map((_, i) => <span key={i} style={{ position: "absolute", top: 7, width: 14, height: 14, borderRadius: 999, borderWidth: 2, borderStyle: "solid", left: `${(i / vista.total) * 100}%`, transform: "translateX(-50%)" }} className={i < vista.parada - 1 + (vista.fase === "arresto" ? 1 : 0) ? "bg-emerald-500 border-emerald-600" : "bg-white border-slate-400"}>{i === vista.total && <span style={{ position: "absolute", top: -4, left: 12, fontSize: 12 }}>🚨</span>}</span>)}
          <span className="dt-detective" style={{ left: `${(Math.min(vista.fase === "arresto" ? vista.total : vista.parada - 1, vista.total) / vista.total) * 100}%` }}>🕵️</span>
        </div>
      </div>

      {expediente && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm space-y-1">
          <div className="font-extrabold text-amber-900">📁 Testimonios recogidos</div>
          {!vista.pistas.length && <p className="text-amber-800/80">Aún no tienes testimonios.</p>}
          {vista.pistas.map((p, i) => <p key={i}><i>{p.testigo} ({p.lugar}):</i> «{p.texto}»</p>)}
        </div>
      )}
      {err && <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm p-2.5">{err}</div>}

      <div key={`${vista.parada}-${vista.fase === "arresto" ? "a" : "p"}`} className={`dt-slide ${fx === "mal" ? "dt-shake dt-flash" : ""}`} style={{ borderRadius: 18 }}>
        <div style={{ position: "relative" }}>
          <Escena lugar={lugar.lugar} ambientacion={vista.ambientacion} testigo={lugar.testigo || "Testigo"} />
          <div style={{ position: "absolute", left: 8, top: 8, background: "#0f172acc", color: "#fff", borderRadius: 10, padding: "3px 10px", fontWeight: 800, fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}><span className="dt-float">{lugar.emoji}</span>{lugar.lugar}</div>
          <div style={{ position: "absolute", right: 8, bottom: 6, background: "#0f172acc", color: "#fff", borderRadius: 8, padding: "1px 8px", fontSize: 11, fontWeight: 800 }}>{lugar.testigo}</div>
          <div style={{ position: "absolute", left: 8, bottom: 6, background: "#0f172acc", color: "#fff", borderRadius: 8, padding: "1px 8px", fontSize: 11, fontWeight: 800 }}>Parada {vista.parada}/{vista.total}</div>
        </div>
        {lugar.escena && <p className="text-xs text-slate-600 italic mt-1.5 px-1">{lugar.escena}</p>}
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", alignItems: "start" }}>
        <div className="space-y-3">
          {vista.fase === "pregunta" && vista.pregunta && (
            <div key={`q${vista.parada}`} className="space-y-3">
              <Globo quien={lugar.testigo} texto="Tengo información sobre el culpable… pero antes demuéstrame que eres un buen detective." />
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm space-y-2" style={{ marginTop: 14 }}>
                <p className="font-bold text-slate-800">{vista.pregunta.texto}</p>
                <OpcionesPregunta opciones={vista.pregunta.opciones} malas={malas} ocupado={ocupado} onElegir={responder} clave={vista.parada} />
              </div>
            </div>
          )}

          {vista.fase !== "pregunta" && (
            <div className="space-y-3">
              {testimonio?.retro && <div className="dt-pop rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm p-2.5 relative"><b>✅ ¡Correcto!</b> {testimonio.retro}{CHISPAS.map((c, i) => <span key={i} className="dt-spark" style={{ "--dx": `${c.dx}px`, "--dy": `${c.dy}px`, animationDelay: `${c.t}ms` }} aria-hidden="true">{c.e}</span>)}</div>}
              {(testimonio?.pista || ultimo) && <Globo quien={testimonio?.pista?.testigo || ultimo?.testigo} texto={`«${testimonio?.pista?.texto || ultimo?.texto}»`} color="#fffbeb" />}
              {testimonio?.rasgo && <div className="dt-pop rounded-xl bg-amber-50 border border-amber-200 p-2 text-sm" style={{ marginTop: 14, animationDelay: ".4s" }}>🔍 Nuevo rasgo del culpable: <b className="dt-glow rounded px-1">{testimonio.rasgo}</b> <span className="text-xs text-slate-500">(ya está en tu retrato hablado)</span></div>}
            </div>
          )}

          {aviso && <div role="status" className="dt-pop rounded-xl p-3 text-sm border bg-rose-50 border-rose-200 text-rose-800"><b>⏳ −{aviso.costo > 1 ? `${aviso.costo} horas` : "1 hora"}.</b> {aviso.texto}</div>}
        </div>
        <div className="space-y-3">{Retrato}</div>
      </div>

      {vista.fase === "destino" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm space-y-2">
          <div className="text-xs font-bold text-slate-500">🧭 Con la pista del testigo, ¿a dónde viajas?</div>
          <MapaFondo ambientacion={vista.ambientacion}>
            <div style={{ position: "absolute", left: `${puntos[lugar.lugar]?.[0]}%`, top: `${puntos[lugar.lugar]?.[1]}%`, transform: "translate(-50%,-100%)", textAlign: "center" }} aria-label="Estás aquí">
              <div style={{ fontSize: 24 }}>🕵️</div><span className="dt-chip" style={{ background: "#fbbf24", color: "#1e293b" }}>Estás aquí</span>
            </div>
            {(vista.destinos || []).map((d, k) => (
              <button key={d} className="dt-pin" disabled={ocupado || malas.includes(d)} onClick={() => viajar(d, puntos[lugar.lugar], puntos[d])}
                style={{ left: `${puntos[d]?.[0]}%`, top: `${puntos[d]?.[1]}%`, animationDelay: `${k * 200}ms` }} aria-label={`Viajar a ${d}`}>
                <span style={{ fontSize: 26, filter: "drop-shadow(0 2px 2px #0008)" }}>{malas.includes(d) ? "❌" : "📍"}</span><span className="dt-chip">{d}</span>
              </button>
            ))}
          </MapaFondo>
        </div>
      )}

      {vista.fase === "arresto" && (
        <div style={{ ...marco, padding: 10 }}>
          <div className="font-extrabold">🚨 ¡Lo encontraste! Rueda de reconocimiento</div>
          <p className="text-xs opacity-85 mb-2">{dificultad === "experto" ? "Tu retrato sigue bloqueado: usa las pistas de los testigos. Arrestar a un inocente cuesta 3 horas." : dificultad === "dificil" ? "Tu retrato se desbloqueó, pero ahora te toca comparar a ti. Arrestar a un inocente cuesta 2 horas." : "Compara a cada sospechoso con tu retrato hablado. Arrestar a un inocente cuesta 2 horas."}</p>
          {!ayuda && (vista.pistas || []).length > 0 && (
            <details open className="mb-2" style={{ background: "#ffffff14", borderRadius: 10, padding: "6px 10px" }}>
              <summary className="cursor-pointer font-bold text-sm">📓 Cuaderno de pistas ({vista.pistas.length})</summary>
              <ol style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5, lineHeight: 1.45 }}>{vista.pistas.map((pi, i) => <li key={i}><b>{pi.testigo}:</b> «{pi.texto}»</li>)}</ol>
            </details>
          )}
          {dificultad === "dificil" && encontrados.length > 0 && <p className="text-xs mb-2" style={{ background: "#ffffff14", borderRadius: 10, padding: "6px 10px" }}>🖼️ <b>Retrato desbloqueado:</b> {encontrados.join(" · ")}</p>}
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", backgroundImage: "repeating-linear-gradient(0deg,#ffffff14 0 1px,transparent 1px 28px)", borderRadius: 12, padding: 8 }}>
            {(vista.sospechosos || []).map((s, k) => {
              const coinc = ayuda ? encontrados.filter((r) => s.rasgos.includes(r)).length : 0;
              const descartado = malas.includes(`s${s.id}`);
              return (
                <div key={s.id} className={`dt-pop ${descartado ? "dt-shake" : ""}`} style={{ background: descartado ? "#1e293b99" : "#f8fafc", color: "#0f172a", borderRadius: 14, padding: 8, textAlign: "center", opacity: descartado ? 0.5 : 1, animationDelay: `${k * 120}ms` }}>
                  <div style={{ background: "#e2e8f0", borderRadius: 10, display: "flex", justifyContent: "center" }}><Rostro nombre={s.nombre} rasgos={s.rasgos} ancho={96} /></div>
                  <div className="font-extrabold text-sm mt-1">{s.nombre}</div>
                  <ul style={{ textAlign: "left", fontSize: 11.5, margin: "4px 0", padding: 0, listStyle: "none" }}>
                    {s.rasgos.map((r, i) => <li key={i} style={{ color: ayuda && encontrados.includes(r) ? "#047857" : "#475569", fontWeight: ayuda && encontrados.includes(r) ? 800 : 400 }}>{ayuda && encontrados.includes(r) ? "✔" : "•"} {r}</li>)}
                  </ul>
                  {ayuda && <div style={{ fontSize: 10.5, color: "#64748b" }}>Coincide en {coinc} de {encontrados.length}</div>}
                  {confirmar === s.id
                    ? <div style={{ display: "flex", gap: 6, marginTop: 6 }}><button disabled={ocupado} onClick={() => arrestar(s)} className="dt-btn" style={{ flex: 1, background: "#e11d48", color: "#fff", borderRadius: 8, padding: "5px 0", fontWeight: 800, fontSize: 12 }}>¡Sí, arrestar!</button><button onClick={() => setConfirmar(null)} style={{ background: "#e2e8f0", borderRadius: 8, padding: "5px 10px", fontWeight: 700, fontSize: 12 }}>No</button></div>
                    : <button disabled={ocupado || descartado} onClick={() => { sonido.click(); setConfirmar(s.id); }} className="dt-btn" style={{ marginTop: 6, width: "100%", background: "#0f172a", color: "#fff", borderRadius: 8, padding: "5px 0", fontWeight: 800, fontSize: 12, opacity: descartado ? 0.5 : 1 }}>🚔 Arrestar</button>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function OpcionesPregunta({ opciones, malas, ocupado, onElegir, clave }) {
  const ops = useMemo(() => mezclar(opciones), [clave]); // eslint-disable-line
  return (
    <div className="grid gap-2">
      {ops.map((o, j) => (
        <button key={o} disabled={ocupado || malas.includes(o)} onClick={() => onElegir(o)}
          className="dt-btn dt-pop text-left rounded-xl text-white px-3 py-2.5 font-semibold disabled:opacity-40 flex gap-2" style={{ background: COL_OP[j % COL_OP.length], animationDelay: `${j * 90}ms` }}>
          <b>{LETRAS[j]}.</b><span>{o}</span>
        </button>
      ))}
    </div>
  );
}
