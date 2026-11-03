import React, { useEffect, useMemo, useRef, useState } from "react";
import { montarJuego } from "../game/juegosUI";
import { TIPOS_ACERTIJO } from "../game/acertijos";
import { CSS_JUEGO } from "../game3d/juegoCss";
import * as mundoApi from "../lib/mundoApi";
import { ZONAS, zonaPorClave, zonaDeMision } from "../game/zonas";
import { armarPool, crearDuelo, esperaRestanteMin } from "../game/duelo";

// Ventanas que se abren al hablar con los personajes de la aldea 3D:
// misiones (las mismas del Mundo 2D), Casa de los Acertijos y Posada. Todo el premio lo entrega la base de datos.

const Marco = ({ titulo, sub, emoji, onCerrar, children }) => (
  <div className="absolute inset-0 z-30 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 overflow-y-auto" role="dialog" aria-modal="true" aria-label={titulo}>
    <div className="m3d-juego w-full max-w-[560px] max-h-full overflow-y-auto rounded-2xl bg-white text-slate-800 shadow-2xl p-4 border border-slate-200">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-4xl leading-none">{emoji}</span>
        <div className="min-w-0 flex-1"><div className="font-extrabold text-[15px] truncate">{titulo}</div>{sub && <div className="text-xs font-bold text-violet-600">{sub}</div>}</div>
        <button onClick={onCerrar} aria-label="Cerrar" className="rounded-full w-8 h-8 bg-slate-100 hover:bg-slate-200 font-bold">✕</button>
      </div>
      {children}
    </div>
  </div>
);

const Premio = ({ xp, oro }) => <span className="text-[11px] font-bold text-amber-600">+{xp || 0} XP · +{oro || 0} 🪙</span>;

// Mezcla las respuestas cada vez que se abre la misión (como en el Mundo 2D): así la correcta no queda siempre en la A.
// Devuelve la misión con las opciones en el nuevo orden y el índice de la correcta recalculado.
function mezclada(m) {
  const n = (m.opciones || []).length, orden = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [orden[i], orden[j]] = [orden[j], orden[i]]; }
  return { ...m, opciones: orden.map((i) => m.opciones[i]), correcta: orden.indexOf(Number(m.correcta)), _orig: m };
}

function Mision({ npc, mision: misionOriginal, hecha, est, alHecha, volver, cerrar }) {
  const mision = useMemo(() => mezclada(misionOriginal), [misionOriginal.id]); // eslint-disable-line
  const [elegida, setElegida] = useState(null);
  const [estado, setEstado] = useState(hecha ? "hecha" : "pregunta"); // pregunta | mal | guardando | bien | hecha | error
  const [res, setRes] = useState(null);
  const responder = async (i) => {
    if (estado === "guardando" || estado === "bien" || estado === "hecha") return;
    setElegida(i);
    if (i !== mision.correcta) { setEstado("mal"); return; }
    setEstado("guardando");
    let r; try { r = await mundoApi.completarMisionMundo(est, misionOriginal); } catch (e) { r = { ok: false, mensaje: e && e.message }; }
    if (!r.ok) { setRes(r); setEstado("error"); return; }
    setRes(r); setEstado(r.yaEstaba ? "hecha" : "bien"); alHecha(mision.id, r);
  };
  return (
    <>
      <div className="text-sm font-bold mb-1">{mision.titulo} <Premio xp={mision.xp} oro={mision.oro} /></div>
      <p className="m-texto">{mision.texto}</p>
      {estado !== "hecha" && <div className="space-y-2">
        {mision.opciones.map((o, i) => {
          const bien = (estado === "bien" || estado === "hecha") && i === mision.correcta, mal = estado === "mal" && i === elegida;
          return <button key={i} disabled={estado === "guardando" || estado === "bien" || estado === "hecha"} onClick={() => responder(i)}
            className={`block w-full text-left text-sm rounded-xl border-2 px-3 py-2.5 ${bien ? "border-emerald-500 bg-emerald-50" : mal ? "border-rose-400 bg-rose-50" : "border-slate-200 bg-slate-50 hover:border-violet-400"}`}>{o}</button>;
        })}
      </div>}
      {estado === "mal" && <div className="m-retro mal">{mision.pista ? "💡 " + mision.pista : "Esa no es. ¡Inténtalo de nuevo!"}</div>}
      {estado === "guardando" && <div className="m-retro bien">⏳ Guardando tu premio…</div>}
      {estado === "bien" && <div className="m-retro bien">{mision.retro || "¡Correcto!"}<br /><b>🎁 +{mision.xp} XP · +{mision.oro} 🪙</b>{res && res.evento ? " (con bono de evento)" : ""}{res && res.comarca && res.comarca.ok ? " · aportaste a tu Comarca 🏰" : ""}</div>}
      {estado === "hecha" && <div className="m-retro bien">Ya completaste esta misión ✅ (tu premio ya fue entregado). Por seguridad no se vuelve a mostrar la respuesta.</div>}
      {estado === "error" && <div className="m-retro mal">No se pudo guardar: {res && res.mensaje}. Intenta de nuevo.</div>}
      <div className="flex gap-2 mt-3">
        {volver && <button onClick={volver} className="flex-1 rounded-xl py-2 text-sm font-bold bg-slate-100 hover:bg-slate-200">← Otras misiones</button>}
        <button onClick={cerrar} className="flex-1 rounded-xl py-2 text-sm font-bold bg-violet-600 text-white">Seguir explorando</button>
      </div>
    </>
  );
}

function VistaNpc({ npc, datos, est, alHecha, cerrar }) {
  const [sel, setSel] = useState(npc.misiones.length === 1 ? npc.misiones[0] : null);
  const pend = npc.misiones.filter((m) => !datos.hechas.has(m.id)).length;
  return (
    <Marco titulo={npc.nombre} emoji={npc.emoji || "🧑"} sub={sel ? sel.titulo : pend ? pend + " misión(es) por hacer" : "Todas las misiones hechas ✅"} onCerrar={cerrar}>
      {sel ? <Mision key={sel.id} npc={npc} mision={sel} hecha={datos.hechas.has(sel.id)} est={est} alHecha={alHecha} volver={npc.misiones.length > 1 ? () => setSel(null) : null} cerrar={cerrar} />
        : <div className="space-y-2">
          <p className="m-texto">¡Hola! Tengo estos retos para ti:</p>
          {npc.misiones.map((m) => {
            const h = datos.hechas.has(m.id);
            return <button key={m.id} onClick={() => setSel(m)} className="w-full flex items-center justify-between gap-2 text-left rounded-xl border-2 border-slate-200 bg-slate-50 hover:border-violet-400 px-3 py-2.5">
              <span className="text-sm font-semibold">{h ? "✅ " : "❗ "}{m.titulo}</span><Premio xp={m.xp} oro={m.oro} /></button>;
          })}
        </div>}
    </Marco>
  );
}

function Juego({ a, hecho, est, alHecho, volver }) {
  const ref = useRef(null);
  const [nota, setNota] = useState(null);
  const yaRef = useRef(hecho);
  useEffect(() => {
    if (!ref.current) return; let vivo = true;
    const j = montarJuego(ref.current, a, { rand: Math.random, alGanar: async () => {
      if (yaRef.current) { setNota({ bien: true, t: "¡Bien hecho! Ya habías ganado el premio de este acertijo." }); return; }
      setNota({ bien: true, t: "⏳ Guardando tu premio…" });
      let r; try { r = await mundoApi.completarAcertijoMundo(est, { id: a.id }); } catch (e) { r = { ok: false, mensaje: e && e.message }; }
      if (!vivo) return;
      if (!r.ok) { setNota({ bien: false, t: "Lo resolviste, pero no se pudo guardar el premio: " + (r.mensaje || "error") + ". Pulsa «Otra vez» para reintentar." }); return; }
      yaRef.current = true; alHecho(a.id);
      setNota({ bien: true, t: r.yaEstaba ? "¡Bien hecho! Ya tenías este premio." : `🎁 ¡Premio! +${a.xp || 0} XP · +${a.oro || 0} 🪙` + (r.evento ? " (con bono de evento)" : "") });
    } });
    return () => { vivo = false; try { j && j.destruir && j.destruir(); } catch (_) { /* nada */ } };
  }, [a.id]); // eslint-disable-line
  return <><div ref={ref} />{nota && <div className={`m-retro ${nota.bien ? "bien" : "mal"}`}>{nota.t}</div>}
    <button onClick={volver} className="mt-3 w-full rounded-xl py-2 text-sm font-bold bg-slate-100 hover:bg-slate-200">← Volver a la mesa</button></>;
}

function VistaAcertijos({ datos, est, alHecho, cerrar }) {
  const [a, setA] = useState(null);
  const ac = datos.acertijos;
  return (
    <Marco titulo="Casa de los Acertijos" emoji="🧩" sub={a ? a.titulo : "Resuelve y gana premios"} onCerrar={cerrar}>
      <style>{CSS_JUEGO}</style>
      {!ac || !ac.lista.length ? <p className="m-texto">Todavía no hay acertijos disponibles para tu curso. ¡Vuelve pronto!</p>
        : a ? <Juego key={a.id} a={a} hecho={ac.hechos.includes(a.id)} est={est} alHecho={alHecho} volver={() => setA(null)} />
          : <div className="space-y-2">
            {ac.lista.map((x) => {
              const T = TIPOS_ACERTIJO[x.tipo] || { emoji: "🧩", nombre: x.tipo }, h = ac.hechos.includes(x.id);
              return <button key={x.id} onClick={() => setA(x)} className="w-full flex items-center gap-3 text-left rounded-xl border-2 border-slate-200 bg-slate-50 hover:border-violet-400 px-3 py-2.5">
                <span className="text-2xl">{T.emoji}</span>
                <span className="flex-1 min-w-0"><span className="block text-sm font-semibold truncate">{x.titulo || T.nombre}</span><span className="block text-[11px] text-slate-500">{T.nombre}</span></span>
                {h ? <span className="text-xs font-bold text-emerald-600">✅ Resuelto</span> : <Premio xp={x.xp} oro={x.oro} />}
              </button>;
            })}
          </div>}
    </Marco>
  );
}

function VistaPosada({ est, cerrar }) {
  const [cfg, setCfg] = useState(null), [r, setR] = useState(null), [ocupado, setOcupado] = useState(false);
  useEffect(() => { let v = true; mundoApi.fetchPosadaMundo().then((c) => v && setCfg(c)).catch(() => v && setCfg({ activa: false })); return () => { v = false; }; }, []);
  const descansar = async () => {
    setOcupado(true);
    try { setR(await mundoApi.descansarEnPosada(est)); } catch (e) { setR({ ok: false, mensaje: (e && e.message) || "No se pudo descansar." }); }
    setOcupado(false);
  };
  return (
    <Marco titulo="Posada del Descanso" emoji="🛏️" sub="Recupera tu vida" onCerrar={cerrar}>
      {!cfg ? <p className="m-texto">Un momento…</p>
        : !cfg.activa ? <p className="m-texto">La posada está cerrada por ahora. ¡Vuelve pronto!</p>
          : <>
            <p className="m-texto">Aquí puedes descansar y recuperar vida. Cada descanso recupera hasta <b>{cfg.vida} ❤️</b> y cuesta hasta <b>{cfg.costo} 🪙</b> (si te falta poco, pagas proporcional).</p>
            <button disabled={ocupado || (r && r.ok)} onClick={descansar} className="w-full rounded-xl py-2.5 text-sm font-bold bg-violet-600 text-white disabled:opacity-50">{ocupado ? "Descansando…" : "😴 Descansar"}</button>
          </>}
      {r && <div className={`m-retro ${r.ok ? "bien" : "mal"}`}>{r.ok ? `¡Descansaste! Recuperaste ${r.restaurado} ❤️ por ${r.costo} 🪙. Ahora tienes ${r.monedas} 🪙.` : r.mensaje}</div>}
      <button onClick={cerrar} className="mt-3 w-full rounded-xl py-2 text-sm font-bold bg-slate-100 hover:bg-slate-200">Seguir explorando</button>
    </Marco>
  );
}

// El guardián de cada zona: un duelo de preguntas. Al vencerlo se gana la insignia de la zona (una sola vez) y un premio.
function VistaGuardian({ npc, datos, estado, est, alInsignia, alDerrota, cerrar }) {
  const z = ZONAS.find((x) => x.key === npc.zona), e = estado[z.key] || {}, du = datos.duelos;
  const [fase, setFase] = useState("intro"); // intro | duelo | fin
  const duelo = useRef(null);
  const [resp, setResp] = useState(null), [fin, setFin] = useState(null), [motivo, setMotivo] = useState(""), [q, setQ] = useState(null);
  const tiene = du.insignias.includes(z.key), espera = esperaRestanteMin(du.esperaHasta && du.esperaHasta[z.key]);
  const previa = e.previa ? zonaPorClave(e.previa) : null;
  const razon = e.desbloqueada ? "" : !e.abierta ? "Tu docente todavía no ha abierto esta zona." : !e.cumplido ? `Completa ${e.requeridas} misión(es) de ${previa ? previa.nombre : "la zona anterior"} (llevas ${e.hechasPrevia}).` : `Necesitas la insignia de ${previa ? previa.nombre : "la zona anterior"}: véncelo a su guardián.`;

  const empezar = () => {
    const pool = armarPool(datos.misiones.filter((m) => zonaDeMision(m) === z.key), du.bancos[z.key] || []);
    const d = crearDuelo({ pool, aciertos: du.aciertos, vidas: du.vidas });
    if (d.imposible) { setMotivo(`Todavía no hay preguntas suficientes en esta zona (hay ${d.disponibles} y se necesitan ${d.necesarios}). Avísale a tu docente.`); return; }
    duelo.current = d; setResp(null); setQ(d.actual()); setFase("duelo");
  };
  const terminar = async (resultado) => {
    const pr = duelo.current.progreso(), ganado = resultado === "gana"; setFase("fin"); setFin({ ganado, guardando: true });
    try {
      const r = await mundoApi.registrarDuelo(est, z.key, { ganado, aciertos: pr.aciertos, errores: pr.errores });
      if (ganado) alInsignia(z.key, r); else alDerrota(z.key);
      setFin({ ganado, r });
    } catch (er) { setFin({ ganado, error: (er && er.message) || "No se pudo guardar el resultado." }); }
  };
  const responder = (i) => { if (resp) return; const r = duelo.current.responder(i); setResp({ i, r }); };
  const siguiente = () => { if (resp && resp.r.fin) terminar(resp.r.fin); else { setResp(null); setQ(duelo.current.actual()); } };
  const rendirse = () => { const f = duelo.current.rendirse(); terminar(f); };

  const pr = duelo.current ? duelo.current.progreso() : null;

  return (
    <Marco titulo={npc.nombre} emoji="🛡️" sub={z.guardian.titulo} onCerrar={cerrar}>
      <style>{CSS_JUEGO}</style>
      {fase === "intro" && (
        <>
          <p className="m-texto">{z.guardian.reto}</p>
          <div className="text-xs text-slate-500 mb-2">{z.insignia.emoji} <b>{z.insignia.nombre}</b> · Premio: +{du.premio.xp} XP · +{du.premio.oro} 🪙 (solo la primera vez)</div>
          {!du.activo ? <div className="m-retro mal">Los duelos con guardianes no están disponibles por ahora.</div>
            : razon ? <div className="m-retro mal">🔒 {razon}</div>
              : tiene ? <div className="m-retro bien">Ya tienes la {z.insignia.nombre} {z.insignia.emoji}. ¡Puedes seguir explorando!</div>
                : espera > 0 ? <div className="m-retro mal">Descansa un poco: podrás volver a retarme en {espera} min.</div>
                  : <>
                    <p className="text-sm">Para vencerme debes acertar <b>{du.aciertos}</b> preguntas antes de perder tus <b>{du.vidas}</b> ❤️.</p>
                    {motivo && <div className="m-retro mal">{motivo}</div>}
                    <button onClick={empezar} className="mt-3 w-full rounded-xl py-2.5 text-sm font-bold bg-violet-600 text-white">⚔️ ¡Aceptar el duelo!</button>
                  </>}
          <button onClick={cerrar} className="mt-3 w-full rounded-xl py-2 text-sm font-bold bg-slate-100 hover:bg-slate-200">Seguir explorando</button>
        </>
      )}
      {fase === "duelo" && pr && (
        <>
          <div className="flex items-center justify-between text-sm font-bold mb-2"><span>{"❤️".repeat(pr.vidasRestantes)}{"🖤".repeat(Math.max(0, pr.corazones - pr.vidasRestantes))}</span><span>Aciertos {pr.aciertos}/{pr.necesarios}</span></div>
          {q && (() => {
            return <>
              <p className="m-texto font-semibold">{q.texto}</p>
              <div className="space-y-2">{q.opciones.map((o, i) => {
                const mostrada = !!resp, bien = mostrada && i === resp.r.correcta, mal = mostrada && i === resp.i && !resp.r.acierto;
                return <button key={i} disabled={mostrada} onClick={() => responder(i)} className={`block w-full text-left text-sm rounded-xl border-2 px-3 py-2.5 ${bien ? "border-emerald-500 bg-emerald-50" : mal ? "border-rose-400 bg-rose-50" : "border-slate-200 bg-slate-50 hover:border-violet-400"}`}>{o}</button>;
              })}</div>
              {resp && <div className={`m-retro ${resp.r.acierto ? "bien" : "mal"}`}>{resp.r.acierto ? "¡Acertaste! " : "Esa no era. "}{resp.r.retro || (!resp.r.acierto && resp.r.pista) || ""}</div>}
              {resp ? <button onClick={siguiente} className="mt-3 w-full rounded-xl py-2.5 text-sm font-bold bg-violet-600 text-white">{resp.r.fin ? "Ver el resultado" : "Siguiente pregunta"}</button>
                : <button onClick={rendirse} className="mt-3 w-full rounded-xl py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200">Rendirme</button>}
            </>;
          })()}
        </>
      )}
      {fase === "fin" && fin && (
        <>
          {fin.guardando ? <p className="m-texto">⏳ Guardando el resultado…</p>
            : fin.error ? <div className="m-retro mal">No se pudo guardar: {fin.error}</div>
              : fin.ganado ? <div className="m-retro bien"><b>¡Me venciste!</b> {z.insignia.emoji} Ganaste la {z.insignia.nombre}.{fin.r && !fin.r.yaTenia ? <><br />🎁 +{fin.r.xp || 0} XP · +{fin.r.oro || 0} 🪙</> : " (Ya la tenías, sin premio doble.)"}{fin.r && fin.r.comarca && fin.r.comarca.ok ? " · aportaste a tu Comarca 🏰" : ""}</div>
                : <div className="m-retro mal">No esta vez. Estudia un poco y vuelve a retarme{du.esperaMin > 0 ? ` (en ${du.esperaMin} min)` : ""}.</div>}
          <button onClick={cerrar} className="mt-3 w-full rounded-xl py-2.5 text-sm font-bold bg-violet-600 text-white">Seguir explorando</button>
        </>
      )}
    </Marco>
  );
}

export default function PanelAldea({ dialogo, datos, estado, est, alHecha, alHechoAcertijo, alInsignia, alDerrota, cerrar }) {
  if (!dialogo) return null;
  if (dialogo.tipo === "guardian") return <VistaGuardian key={dialogo.id} npc={dialogo} datos={datos} estado={estado} est={est} alInsignia={alInsignia} alDerrota={alDerrota} cerrar={cerrar} />;
  if (dialogo.tipo === "acertijos") return <VistaAcertijos datos={datos} est={est} alHecho={alHechoAcertijo} cerrar={cerrar} />;
  if (dialogo.tipo === "posada") return <VistaPosada est={est} cerrar={cerrar} />;
  return <VistaNpc key={dialogo.id} npc={dialogo} datos={datos} est={est} alHecha={alHecha} cerrar={cerrar} />;
}
