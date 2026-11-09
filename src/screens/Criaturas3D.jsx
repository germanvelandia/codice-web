// Criaturas del Códice (Mundo 3D): panel de batalla/captura y colección. Todo lo importante lo decide el servidor (SQL 148).
import { useEffect, useRef, useState } from "react";
import * as api from "../lib/mundo3dApi";
import { ELEMENTOS } from "../game3d/criaturas3d";

const CSS = `
.cr-fondo{position:absolute;inset:0;z-index:45;background:#0b0420e6;display:flex;align-items:center;justify-content:center;padding:10px;color:#fff;font:13px system-ui,sans-serif}
.cr-caja{width:min(460px,100%);max-height:100%;overflow:auto;background:#1e1b4b;border:2px solid #a78bfa;border-radius:16px;padding:14px}
.cr-barra{height:12px;border-radius:9px;background:#0007;overflow:hidden}.cr-barra i{display:block;height:100%;transition:width .25s}
.cr-grande{font-size:84px;text-align:center;line-height:1.1;margin:6px 0}
.cr-sacude{animation:crsac .25s}@keyframes crsac{0%{transform:translateX(0)}25%{transform:translateX(-9px) rotate(-4deg)}75%{transform:translateX(9px) rotate(4deg)}100%{transform:translateX(0)}}
.cr-btns{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}
.cr-btns button,.cr-op{border:1px solid #fff5;background:#4c1d95;color:#fff;border-radius:10px;padding:9px 6px;font:700 13px system-ui,sans-serif;cursor:pointer}
.cr-btns button:disabled,.cr-op:disabled{opacity:.45;cursor:default}.cr-btns .gr{grid-column:1/3;background:#b45309;font-size:15px}
.cr-op{display:block;width:100%;text-align:left;margin-top:6px;background:#312e81}.cr-op.ok{background:#15803d}.cr-op.mal{background:#b91c1c}
.cr-log{margin-top:8px;min-height:34px;font-weight:600;text-align:center;color:#fde68a}
.cr-tarj{display:flex;gap:8px;align-items:center;border:1px solid #fff4;border-radius:10px;padding:6px 8px;margin-top:6px;background:#0003}.cr-tarj.eq{border-color:#fbbf24;background:#78350f55}
`;
const pct = (a, b) => Math.max(0, Math.min(100, Math.round((a / b) * 100)));
const colorHp = (p) => (p > 50 ? "#22c55e" : p > 25 ? "#eab308" : "#ef4444");
const MSG_ERR = {
  sin_capsula: "No tienes cápsulas de captura. Fabrícalas en la mesa: 2 hierro + 1 carbón → 2 cápsulas.", sin_comida: "No tienes manzanas ni leche para curarte.",
  tope_capturas_dia: "Ya llegaste al tope de capturas de hoy. ¡Vuelve mañana!", coleccion_llena: "Tu colección está llena (60).", ya_tienes_tres: "Ya tienes 3 de esta criatura: ¡busca otra!",
  muy_rapido: "", demasiado_rapido: "Más despacio…", sin_batalla: "La batalla terminó.", criatura_bloqueada: "Esa criatura aún es demasiado fuerte: vence a un guardián de zona primero.",
  fuera_de_su_mundo: "Esa criatura solo vive en su mundo.", desmayado: "Estás sin vida: espera a recuperarte.",
};
const msgErr = (er) => { const m = String((er && er.message) || ""); const k = Object.keys(MSG_ERR).find((x) => m.includes(x)); return k ? MSG_ERR[k] : "No se pudo completar la acción."; };

export function PanelBatalla({ est, inicial, capsulas, alFin, alInv }) {
  const [b, setB] = useState(inicial), [log, setLog] = useState("¡Una criatura salvaje apareció!"), [q, setQ] = useState(null), [res, setRes] = useState(null), [busy, setBusy] = useState(false), [sac, setSac] = useState(0);
  const [resp, setResp] = useState(null), ult = useRef(0);
  const rt = b.modo === "tiempo_real";
  const fin = (r, extra) => setRes({ r, ...extra });
  const accion = async (a, opcion = null) => {
    if (busy) return; if (a === "golpear") { const t = Date.now(); if (t - ult.current < 450) return; ult.current = t; }
    setBusy(true);
    try {
      const r = await api.accionCriaturaMundo3D(est, a, opcion);
      if (a === "capturar" || a === "curar") alInv && alInv();
      if (r.resultado === "capturada") { fin("capturada", { nombre: r.nombre, xp: r.xp, oro: r.oro, id: r.id }); alInv && alInv(true); }
      else if (r.resultado === "derrota") fin("derrota");
      else if (r.resultado === "escapo") fin("escapo");
      else if (r.resultado === "huiste") fin("huiste");
      else {
        setB(r.estado); setSac((n) => n + 1);
        const partes = [];
        if (a === "atacar") partes.push(r.acierto === true ? "¡Respuesta correcta! Golpe fuerte." : r.acierto === false ? "Respuesta incorrecta: golpe débil." : "Ataque básico.");
        if (a === "golpear") partes.push("¡Golpe!");
        if (a === "curar") partes.push("Te curas un poco.");
        if (a === "capturar") partes.push("¡La cápsula falló! Se resiste.");
        if (r.golpe > 0) partes.push(b.nombre + " te hace " + r.golpe + " de daño.");
        setLog(partes.join(" "));
      }
      setQ(null); setResp(null);
    } catch (er) { const m = msgErr(er); if (m) setLog(m); } finally { setBusy(false); }
  };
  const pedirPregunta = async () => {
    if (busy) return; setBusy(true);
    try { const r = await api.preguntaCriaturaMundo3D(est); if (r.sin_preguntas) { setLog("No hay preguntas disponibles: usa el ataque básico."); } else { setQ(r); setResp(null); } }
    catch (er) { setLog(msgErr(er)); } finally { setBusy(false); }
  };
  const responder = async (i) => { if (resp != null) return; setResp(i); setTimeout(() => accion("atacar", i), 650); };
  const cerrar = () => alFin(res ? res.r : "sigue", res);
  const pS = pct(b.hp_s, b.hp_s_max), pM = pct(b.hp_m, b.hp_m_max);
  return (<div className="cr-fondo"><style>{CSS}</style><div className="cr-caja">
    {res ? (<div style={{ textAlign: "center" }}>
      <div className="cr-grande">{res.r === "capturada" ? "🎉" : res.r === "derrota" ? "💫" : "💨"}</div>
      <h3 style={{ fontSize: 18, fontWeight: 800 }}>{res.r === "capturada" ? "¡Capturaste a " + res.nombre + "!" : res.r === "derrota" ? "Perdiste la batalla" : res.r === "escapo" ? b.nombre + " se escapó" : "Huiste de la batalla"}</h3>
      {res.r === "capturada" && <p style={{ marginTop: 6 }}>+{res.xp} XP · +{res.oro} 🪙 · Mira tu colección en 🐾 Criaturas.</p>}
      {res.r === "derrota" && <p style={{ marginTop: 6 }}>No perdiste vida real. ¡Fabrica un arma mejor o equipa una criatura e inténtalo de nuevo!</p>}
      <button className="cr-op" style={{ textAlign: "center", marginTop: 12 }} onClick={cerrar}>Seguir explorando</button>
    </div>) : (<>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800 }}><span>{b.emoji} {b.nombre} · nivel {b.nivel}</span><span style={{ opacity: .8 }}>{ELEMENTOS[b.elemento]}</span></div>
      <div className="cr-barra" style={{ marginTop: 4 }}><i style={{ width: pS + "%", background: colorHp(pS) }} /></div>
      <div className={"cr-grande" + (sac ? " cr-sacude" : "")} key={sac}>{b.emoji}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}><span>🧑 Tú{b.companero ? " + " + b.companero.emoji + " " + b.companero.nombre + " (nv " + b.companero.nivel + ")" : ""}</span><span>{b.hp_m}/{b.hp_m_max} ❤️</span></div>
      <div className="cr-barra" style={{ marginTop: 4 }}><i style={{ width: pM + "%", background: colorHp(pM) }} /></div>
      <div className="cr-log">{log}</div>
      {q ? (<div style={{ marginTop: 6 }}>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>📚 {q.pregunta}</div>
        {q.opciones.map((o, i) => <button key={i} className={"cr-op" + (resp === i ? " mal" : "")} disabled={busy || resp != null} onClick={() => responder(i)}>{String.fromCharCode(65 + i)}) {String(o)}</button>)}
        <button className="cr-op" style={{ textAlign: "center", opacity: .8 }} disabled={busy || resp != null} onClick={() => accion("atacar", null)}>Mejor ataque básico</button>
      </div>) : rt ? (<div className="cr-btns">
        <button className="gr" disabled={busy} onClick={() => accion("golpear")}>👊 ¡Golpear! (toca rápido)</button>
        <button disabled={busy || capsulas <= 0} onClick={() => accion("capturar")}>🥎 Capturar ({capsulas})</button>
        <button disabled={busy} onClick={() => accion("huir")}>🏃 Huir</button>
      </div>) : (<div className="cr-btns">
        <button className="gr" disabled={busy} onClick={pedirPregunta}>📚 Atacar con pregunta (golpe fuerte)</button>
        <button disabled={busy} onClick={() => accion("atacar", null)}>👊 Ataque básico</button>
        <button disabled={busy} onClick={() => accion("curar")}>🍎 Curarme</button>
        <button disabled={busy || capsulas <= 0} onClick={() => accion("capturar")}>🥎 Capturar ({capsulas})</button>
        <button disabled={busy} onClick={() => accion("huir")}>🏃 Huir</button>
      </div>)}
      <p style={{ marginTop: 8, fontSize: 11, opacity: .75 }}>Tip: la criatura nunca queda en 0: debilítala y lanza la cápsula. Cuanta menos vida tenga y más preguntas aciertes, más probabilidad de captura. Ventajas: 🔥&gt;🌿&gt;💧&gt;🔥 y ☀️&gt;🌑&gt;⛰️&gt;☀️.</p>
    </>)}
  </div></div>);
}

export function PanelColeccion({ est, cerrar }) {
  const [d, setD] = useState(null), [err, setErr] = useState("");
  const cargar = () => api.fetchCriaturasMundo3D(est).then(setD).catch((e) => setErr(e.message || "No se pudo cargar."));
  useEffect(() => { cargar(); }, []); // eslint-disable-line
  const ped = d ? Object.fromEntries(d.bestiario.map((x) => [x.id, x])) : {};
  const equipar = async (id) => { try { await api.equiparCriaturaMundo3D(est, id); cargar(); } catch (e) { setErr(msgErr(e)); } };
  const tiene = d ? new Set(d.mias.map((k) => k.tipo)) : new Set();
  return (<div className="cr-fondo"><style>{CSS}</style><div className="cr-caja">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h3 style={{ fontSize: 17, fontWeight: 800 }}>🐾 Mis criaturas</h3><button className="cr-op" style={{ width: "auto", marginTop: 0, padding: "4px 12px" }} onClick={cerrar}>✕</button></div>
    {err && <p style={{ color: "#fca5a5" }}>{err}</p>}{!d && !err && <p>Cargando…</p>}
    {d && (<>
      <p style={{ opacity: .8, marginTop: 4 }}>Equipa a una criatura para que te ayude en las batallas (más daño y ventaja de elemento). Tienes {d.mias.length} · descubiertas {tiene.size}/{d.bestiario.length}.</p>
      {d.mias.length === 0 && <p style={{ marginTop: 8 }}>Aún no has capturado ninguna. Busca criaturas salvajes fuera de la aldea, enfréntalas y lanza una 🥎 cápsula (2 hierro + 1 carbón).</p>}
      {d.mias.map((k) => { const t = ped[k.tipo] || {}; return (<div key={k.id} className={"cr-tarj" + (k.equipada ? " eq" : "")}>
        <span style={{ fontSize: 30 }}>{t.emoji}</span><div style={{ flex: 1 }}><b>{k.apodo || t.nombre}</b> · nv {k.nivel}<br /><span style={{ fontSize: 11, opacity: .8 }}>{ELEMENTOS[t.elemento]} · {"⭐".repeat(t.rareza || 1)}</span></div>
        <button className="cr-op" style={{ width: "auto", marginTop: 0, padding: "5px 10px" }} disabled={k.equipada} onClick={() => equipar(k.id)}>{k.equipada ? "Equipada" : "Equipar"}</button></div>); })}
      <h4 style={{ marginTop: 12, fontWeight: 800 }}>📖 Bestiario</h4>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(90px,1fr))", gap: 6, marginTop: 6 }}>{d.bestiario.map((x) => (<div key={x.id} className="cr-tarj" style={{ flexDirection: "column", textAlign: "center", opacity: tiene.has(x.id) ? 1 : .5 }}>
        <span style={{ fontSize: 26 }}>{tiene.has(x.id) ? x.emoji : "❔"}</span><b style={{ fontSize: 11 }}>{tiene.has(x.id) ? x.nombre : "???"}</b><span style={{ fontSize: 10 }}>{x.modo === "tiempo_real" ? "⚡ Tiempo real" : "📚 Por turnos"}</span></div>))}</div>
    </>)}
  </div></div>);
}
