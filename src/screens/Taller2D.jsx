// Taller del Mundo 2D: lleva al mundo 2D las funciones del Códice Craft (3D) usando el MISMO inventario del servidor.
// Mercado, horno, encantamientos, pociones, fabricación, granja y criaturas. Todo lo decide el servidor (RPC con RLS):
// el navegador solo muestra y pide; no puede inventar cantidades ni saltarse los límites diarios.
import React, { useEffect, useRef, useState } from "react";
import { dibujarIcono, NOMBRES, RECETAS, FUNDICION, COMBUSTIBLES, MERCADO, ARMADURAS, HERRAMIENTAS, POCIONES, ENCANTOS, COMIDA, MATERIALES } from "../game3d/mundo3d";
import { HABITAT, CRIATURAS } from "../game3d/criaturas3d";
import * as api from "../lib/mundo3dApi";
import { PanelBatalla, PanelColeccion } from "./Criaturas3D";

function Icono({ item }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) dibujarIcono(ref.current, item); }, [item]);
  return <canvas ref={ref} width={16} height={16} style={{ width: 30, height: 30, imageRendering: "pixelated" }} />;
}


const GRUPOS_REC = ["Bloques básicos", "Materiales", "Herramientas", "Armas", "Armaduras", "Granja", "Comida", "Hornos y cobre", "Criaturas", "Dimensiones", "Circuitos", "Pociones", "Bloques valiosos", "Lanas"];
// Mercado de la aldea: se venden cosechas y minerales por oro (el servidor limita cuánto se gana por día)
function PanelMercado({ inv, visitando, restante, alVender }) {
  const lista = MERCADO.filter((m) => (inv[m.item] || 0) > 0);
  return (<div>
    <div style={{ fontSize: 12, marginBottom: 6 }}>🛒 Hoy aún puedes ganar <b>{restante == null ? "…" : restante} 🪙</b> aquí.</div>
    {lista.length === 0 && <div style={{ fontSize: 12, opacity: .8 }}>No tienes nada que vender todavía: siembra, cosecha, cocina o pica minerales.</div>}
    {lista.map((m) => (<div key={m.item} className="m3d-rec"><Icono item={m.item} /><b>{NOMBRES[m.item]}<br /><span style={{ fontWeight: 500, fontSize: 11, opacity: .75 }}>{m.precio} 🪙 cada uno · tienes {inv[m.item]}</span></b>
      <button disabled={visitando || restante === 0} onClick={() => alVender(m.item, 1)}>1</button><button disabled={visitando || restante === 0} onClick={() => alVender(m.item, Math.min(inv[m.item], 64))}>Todo</button></div>))}
  </div>);
}
// Horno: elige qué fundir y con qué combustible; el servidor descuenta todo en una sola operación
function PanelHorno({ inv, visitando, alFundir }) {
  const [comb, setComb] = useState(41);
  const rinde = (COMBUSTIBLES.find((c) => c.item === comb) || { rinde: 1 }).rinde;
  if (!(inv[24] > 0)) return (<div style={{ padding: 8, fontSize: 12, opacity: .85 }}>Necesitas un <b>horno</b>. Fabrícalo en la pestaña 🔨 con 8 piedras.</div>);
  const hayComb = COMBUSTIBLES.filter((c) => (inv[c.item] || 0) > 0);
  return (<div>
    <h4>🔥 Combustible</h4>
    <div className="m3d-celdas">{COMBUSTIBLES.map((c) => (<button key={c.item} className={"m3d-celda" + (comb === c.item ? " sel" : "")} onClick={() => setComb(c.item)} title={NOMBRES[c.item]}><Icono item={c.item} /><span>{inv[c.item] || 0}</span><small>{NOMBRES[c.item]} · {c.rinde}</small></button>))}</div>
    <div style={{ fontSize: 11, opacity: .75 }}>1 {NOMBRES[comb].toLowerCase()} funde {rinde} {rinde === 1 ? "pieza" : "piezas"}.</div>
    <h4>Fundir</h4>
    {FUNDICION.map((f) => { const tengo = inv[f.entrada] || 0, n = Math.min(tengo, 32), puede = n > 0 && hayComb.some((c) => c.item === comb) && Math.ceil(n / rinde) <= (inv[comb] || 0) - (comb === f.entrada ? n : 0);
      return (<div key={f.entrada} className="m3d-rec"><Icono item={f.sale} /><b>{NOMBRES[f.entrada]} → {NOMBRES[f.sale]}<br /><span style={{ fontWeight: 500, fontSize: 11, opacity: .75 }}>Tienes {tengo}{tengo > 0 ? " · fundir " + n + " gasta " + Math.ceil(n / rinde) + " de combustible" : ""}</span></b><button disabled={!puede || visitando} onClick={() => alFundir(f, n, comb)}>Fundir</button></div>); })}
  </div>);
}
const NIV = ["", "I", "II", "III"];
function PanelEncantar({ inv, encantos, visitando, alEncantar }) {
  const piezas = Object.keys(ENCANTOS).length ? [...HERRAMIENTAS, ...ARMADURAS].filter((id) => (inv[id] || 0) > 0) : [];
  return (<div>
    <div style={{ fontSize: 12, opacity: .9 }}>📚 Mesa de encantamientos · Tienes <b>{inv[121] || 0}</b> runas y <b>{inv[43] || 0}</b> de oro. Cada nivel cuesta tantas runas y tantas monedas de oro como su número (I: 1 + 1 · II: 2 + 2 · III: 3 + 3). Máximo 2 encantamientos por objeto. Las runas salen de 1 diamante (en 🧪 Pociones) o al capturar criaturas 🐾.</div>
    {piezas.length === 0 && <p style={{ marginTop: 8, opacity: .8 }}>Aún no tienes herramientas, armas ni armaduras para encantar.</p>}
    {piezas.map((id) => { const mios = encantos[id] || {}, ranuras = Object.keys(mios).length;
      return (<div key={id} className="m3d-rec" style={{ display: "block" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Icono item={id} /><b>{NOMBRES[id]}</b><span style={{ fontSize: 11, opacity: .75 }}>{Object.entries(mios).map(([k, n]) => ENCANTOS[k].emoji + " " + ENCANTOS[k].nombre + " " + NIV[n]).join(" · ") || "sin encantar"}</span></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 5 }}>{Object.entries(ENCANTOS).filter(([, e]) => e.vale(id)).map(([k, e]) => { const cur = mios[k] || 0, t = cur + 1, falta = cur >= 3 ? "Máximo" : (cur === 0 && ranuras >= 2) ? "Sin ranuras" : null, puede = !falta && (inv[121] || 0) >= t && (inv[43] || 0) >= t && !visitando;
          return (<button key={k} disabled={!puede} title={e.txt} onClick={() => alEncantar(id, k)} style={{ border: "1px solid #fff5", background: "#4c1d95", color: "#fff", borderRadius: 8, padding: "5px 8px", fontSize: 11, fontWeight: 700, opacity: puede ? 1 : .5 }}>{e.emoji} {e.nombre} {cur ? NIV[cur] + " → " : ""}{falta ? falta : NIV[t] + " · " + t + "🔮+" + t + "🪙"}</button>); })}</div></div>); })}
  </div>);
}
function PanelPociones({ inv, visitando, alFabricar, alBeber }) {
  const mias = Object.keys(POCIONES).map(Number).filter((i) => (inv[i] || 0) > 0);
  return (<div>
    <div style={{ fontSize: 12, opacity: .9 }}>🧪 Soporte de pociones · Mezcla ingredientes con una runa. Bebe con clic derecho (o toca) teniéndola en la mano, o desde aquí. Los efectos duran 3 minutos.</div>
    {mias.length > 0 && <><h4>Mis pociones</h4><div className="m3d-celdas">{mias.map((id) => (<button key={id} className="m3d-celda" disabled={visitando} onClick={() => alBeber(id)} title={"Beber " + NOMBRES[id].toLowerCase()}><Icono item={id} /><span>{inv[id]}</span><small>Beber</small></button>))}</div></>}
    <ListaRecetas inv={inv} visitando={visitando} alFabricar={alFabricar} grupos={["Pociones"]} />
  </div>);
}
function ListaRecetas({ inv, visitando, alFabricar, grupos }) {
  return (grupos || GRUPOS_REC.filter((g) => g !== "Pociones")).map((g) => { const rs = RECETAS.filter((r) => (r.g || "Bloques básicos") === g); if (!rs.length) return null;
    return (<div key={g}><h4>{g}</h4>{rs.map((r) => { const puede = Object.entries(r.cuesta).every(([k, v]) => (inv[k] || 0) >= v);
      return (<div key={r.sale} className="m3d-rec"><Icono item={r.sale} /><b>{NOMBRES[r.sale]}{r.n > 1 ? " ×" + r.n : ""}<br /><span style={{ fontWeight: 500, fontSize: 11, opacity: .75 }}>{r.txt}</span></b><button disabled={!puede || visitando} onClick={() => alFabricar(r)}>Fabricar</button></div>); })}</div>); });
}


const CSS = `
.t2d-fondo{position:fixed;inset:0;z-index:70;background:#0b0420e6;display:flex;align-items:center;justify-content:center;padding:8px;color:#fff;font:13px system-ui,sans-serif}
.t2d-box{position:relative;width:min(620px,100%);max-height:calc(100dvh - 16px);overflow:auto;background:#111827f5;border:1px solid #fff4;border-radius:16px;padding:12px}
.t2d-aviso{position:sticky;top:0;z-index:2;background:#7c3aedee;border-radius:10px;padding:6px 10px;margin-bottom:8px;font-weight:700;font-size:12px}
.t2d-tabs{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px}
.m3d-seg{display:flex;gap:4px;margin-top:4px}.m3d-seg button{flex:1;border:1px solid #fff5;background:#0006;color:#fff;border-radius:8px;padding:5px 2px;font:700 11px system-ui,sans-serif;cursor:pointer}.m3d-seg button.on{background:#7c3aed;border-color:#c4b5fd}
.m3d-inv h4{margin:10px 0 6px;font:800 12px system-ui,sans-serif;color:#c4b5fd;text-transform:uppercase;letter-spacing:.04em}
.m3d-celdas{display:flex;flex-wrap:wrap;gap:6px}
.m3d-celda{position:relative;width:54px;height:58px;border-radius:10px;border:2px solid #fff3;background:#0006;display:flex;flex-direction:column;align-items:center;justify-content:center;font:700 11px system-ui,sans-serif;color:#fff;cursor:default}
.m3d-celda.sel{border-color:#fbbf24;background:#78350f66}.m3d-celda small{font-size:9px;font-weight:600;color:#cbd5e1;max-width:50px;text-align:center;line-height:1.05;overflow:hidden;max-height:22px}
.m3d-rec{display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid #fff2}.m3d-rec:first-of-type{border-top:0}
.m3d-rec b{flex:1}.m3d-rec button{border:0;border-radius:8px;padding:6px 12px;background:#7c3aed;color:#fff;font:800 12px system-ui,sans-serif}.m3d-rec button:disabled{opacity:.35}
.t2d-fondo .cr-fondo{position:fixed}
`;

const num = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [Number(k), v]));
const GRANJA = [
  { tipo: "oveja", emoji: "🐑", txt: "Esquilar la oveja (lana)" }, { tipo: "gallina", emoji: "🐔", txt: "Recoger huevos" },
  { tipo: "vaca", emoji: "🐄", txt: "Ordeñar la vaca (leche)" }, { tipo: "cerdo", emoji: "🐖", txt: "Buscar papas con el cerdo" },
  { tipo: "conejo", emoji: "🐇", txt: "Pedir una zanahoria al conejo" },
];
// criaturas que aparecen en cualquier lugar (sin hábitat especial ni dimensión), ponderadas por su frecuencia
const EXPLORABLES = Object.entries(HABITAT).filter(([id, h]) => h.z === "*" && !h.dim && h.noche == null && CRIATURAS[Number(id)]).map(([id, h]) => ({ id: Number(id), p: h.p || 1 }));
const sortearCriatura = (excluir = []) => {
  const l = EXPLORABLES.filter((c) => !excluir.includes(c.id)); if (!l.length) return null;
  let r = Math.random() * l.reduce((a, c) => a + c.p, 0);
  for (const c of l) { r -= c.p; if (r <= 0) return c.id; }
  return l[l.length - 1].id;
};
const TABS = [["mochila", "🎒 Mochila"], ["granja", "🐑 Granja"], ["fabricar", "🔨 Fabricar"], ["horno", "🔥 Horno"], ["encantar", "✨ Encantar"], ["pociones", "🧪 Pociones"], ["mercado", "🛒 Mercado"], ["criaturas", "🐾 Criaturas"]];

export default function Taller2D({ estudianteInfo, onCerrar }) {
  const est = estudianteInfo?.id;
  const [inv, setInv] = useState(null), [encantos, setEncantos] = useState({}), [restante, setRestante] = useState(null);
  const [tab, setTab] = useState("mochila"), [aviso, setAviso] = useState(""), [error, setError] = useState("");
  const [batalla, setBatalla] = useState(null), [colec, setColec] = useState(false), [ocupado, setOcupado] = useState(false);
  const avisoT = useRef(null);
  const avisar = (t) => { setAviso(t); clearTimeout(avisoT.current); avisoT.current = setTimeout(() => setAviso(""), 3500); };
  useEffect(() => () => clearTimeout(avisoT.current), []);

  const refrescar = () => api.fetchEstadoMundo3D(est).then((e) => { if (e && e.inventario) setInv(num(e.inventario)); }).catch(() => {});
  useEffect(() => {
    if (!est) return;
    api.fetchEstadoMundo3D(est).then((e) => setInv(num(e && e.inventario))).catch((er) => setError(er.message || "No se pudo abrir el Taller."));
    api.fetchEncantosMundo3D(est).then((e) => setEncantos(e || {})).catch(() => {});
    api.fetchMercadoHoyMundo3D && api.fetchMercadoHoyMundo3D(est).then((r) => { if (r && typeof r.restante === "number") setRestante(r.restante); }).catch(() => {});
  }, [est]);
  useEffect(() => { const k = (e) => { if (e.key === "Escape" && !batalla && !colec) onCerrar(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [batalla, colec]); // eslint-disable-line

  const iv = inv || {};
  const pedir = async (fn) => { if (ocupado) return; setOcupado(true); try { await fn(); } finally { setOcupado(false); } };

  const vender = (item, n) => pedir(async () => {
    try { const r = await api.venderMundo3D(est, item, n); setInv(num(r.inventario)); setRestante(r.restante); avisar("🛒 Vendiste " + r.vendido + " " + NOMBRES[item].toLowerCase() + ": +" + r.oro + " 🪙"); }
    catch (er) { avisar(/tope_diario/.test(er.message) ? "Hoy ya ganaste el máximo en el Mercado. ¡Vuelve mañana!" : /sin_material/.test(er.message) ? "No tienes tantos." : /demasiado_rapido/.test(er.message) ? "Vas muy rápido." : "No se pudo vender."); }
  });
  const fundir = (f, n, comb) => pedir(async () => {
    try { const r = await api.fundirMundo3D(est, f.entrada, n, comb); setInv(num(r.inventario)); avisar("🔥 Fundiste " + n + " → " + NOMBRES[f.sale].toLowerCase() + "."); }
    catch (er) { avisar(/sin_horno/.test(er.message) ? "Necesitas un horno." : /sin_combustible/.test(er.message) ? "No tienes suficiente combustible." : /sin_material/.test(er.message) ? "No tienes suficiente material." : /demasiado_rapido/.test(er.message) ? "Vas muy rápido." : "No se pudo fundir."); }
  });
  const encantar = (item, enc) => pedir(async () => {
    try { const r = await api.encantarMundo3D(est, item, enc); setInv(num(r.inventario)); setEncantos((o) => ({ ...o, [item]: { ...(o[item] || {}), [enc]: r.nivel } })); avisar("✨ " + NOMBRES[item] + ": " + ENCANTOS[enc].nombre + " " + NIV[r.nivel]); }
    catch (er) { const m = String(er.message || ""); avisar(/sin_material/.test(m) ? "Te faltan runas u oro." : /nivel_maximo/.test(m) ? "Ya está al nivel máximo." : /sin_ranuras/.test(m) ? "Ese objeto ya tiene 2 encantamientos." : /demasiado_rapido/.test(m) ? "Vas muy rápido." : "No se pudo encantar."); }
  });
  const beber = (item) => pedir(async () => {
    try { const r = await api.beberMundo3D(est, item); setInv((o) => ({ ...o, [item]: Math.max(0, (o[item] || 1) - 1) })); avisar(item === 123 ? "🧪 ¡Te sientes mucho mejor! Vida: " + r.vida : "🧪 Efecto activo por 3 minutos."); }
    catch (er) { const m = String(er.message || ""); avisar(/sin_pocion/.test(m) ? "No tienes esa poción." : /desmayado/.test(m) ? "Estás desmayado." : /demasiado_rapido/.test(m) ? "Vas muy rápido." : "No se pudo beber."); }
  });
  const fabricar = (r) => pedir(async () => {
    try { const res = await api.fabricarMundo3D(est, r.sale); setInv(num(res.inventario)); avisar("Fabricaste " + (r.n > 1 ? r.n + " de " : "") + NOMBRES[r.sale].toLowerCase() + "."); }
    catch (er) { avisar(/sin_material/.test(er.message) ? "No tienes suficiente material." : /demasiado_rapido/.test(er.message) ? "Vas muy rápido." : "No se pudo fabricar."); }
  });
  const comer = (item) => pedir(async () => {
    try { const r = await api.comerMundo3D(est, item); setInv((o) => ({ ...o, [item]: r.cantidad })); avisar("😋 Comiste " + NOMBRES[item].toLowerCase() + ": +" + r.cura + " ❤️"); }
    catch (er) { avisar(/vida_llena/.test(er.message) ? "Tu vida ya está llena." : /demasiado_rapido/.test(er.message) ? "Mastica con calma…" : /desmayado/.test(er.message) ? "Estás desmayado." : "No se pudo comer."); }
  });
  const recolectar = (tipo) => pedir(async () => {
    try { const r = await api.recolectarMundo3D(est, tipo); if (r && r.item) { setInv((o) => ({ ...o, [r.item]: Math.min(999, (o[r.item] || 0) + (r.n || 1)) })); avisar("🎁 Conseguiste " + (r.n || 1) + " " + NOMBRES[r.item].toLowerCase() + "."); } }
    catch (er) { const m = String((er && er.message) || ""), t = /todavia_no:(\d+)/.exec(m); avisar(t ? "Todavía no tiene más. Vuelve en " + t[1] + " s." : /demasiado_rapido/.test(m) ? "Vas muy rápido." : "No se pudo recoger ahora."); }
  });
  const explorar = () => pedir(async () => {
    const probados = [];
    for (let i = 0; i < 5; i++) {
      const id = sortearCriatura(probados); if (id == null) break; probados.push(id);
      try { const r = await api.encontrarCriaturaMundo3D(est, id); setBatalla(r); return; }
      catch (er) { const m = String((er && er.message) || ""); if (/desmayado/.test(m)) { avisar("Estás desmayado: descansa antes de explorar."); return; } if (/demasiado_rapido/.test(m)) { avisar("Vas muy rápido."); return; } }
    }
    avisar("No apareció ninguna criatura ahora. Intenta de nuevo.");
  });
  const finBatalla = () => { setBatalla(null); refrescar(); };

  if (!est) return null;
  const tengo = (lista) => lista.filter((id) => (iv[id] || 0) > 0);

  return (
    <div className="t2d-fondo" role="dialog" aria-label="Taller" onClick={(e) => { if (e.target === e.currentTarget && !batalla && !colec) onCerrar(); }}>
      <style>{CSS}</style>
      <div className="t2d-box">
        {aviso && <div className="t2d-aviso" role="status">{aviso}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <b style={{ fontSize: 16 }}>🧰 Taller del mundo</b>
          <button onClick={onCerrar} style={{ border: 0, background: "#fff2", color: "#fff", borderRadius: 8, padding: "4px 10px", fontWeight: 800 }}>✕</button>
        </div>
        <div className="t2d-tabs">{TABS.map(([k, t]) => <div key={k} className="m3d-seg" style={{ margin: 0 }}><button className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{t}</button></div>)}</div>
        {error ? <div style={{ color: "#fca5a5" }}>{error} Si es la primera vez, la docente debe ejecutar los SQL del Mundo 3D (133 y siguientes).</div>
          : inv === null ? <div>Cargando…</div>
          : tab === "mochila" ? (() => {
              const celda = (id) => (<div key={id} className="m3d-celda" title={NOMBRES[id]}><Icono item={id} /><span>{iv[id]}</span><small>{NOMBRES[id]}</small></div>);
              const co = Object.keys(COMIDA).map(Number).filter((i) => (iv[i] || 0) > 0);
              const hr = tengo(HERRAMIENTAS), ar = tengo(ARMADURAS), ma = tengo(MATERIALES).filter((id) => !co.includes(id));
              const otros = Object.keys(iv).map(Number).filter((id) => iv[id] > 0 && NOMBRES[id] && ![...hr, ...ar, ...ma, ...co].includes(id));
              return (<>
                {co.length > 0 && <><h4>🍽️ Comida (toca para comer)</h4><div className="m3d-celdas">{co.map((id) => (<button key={id} className="m3d-celda" disabled={ocupado} onClick={() => comer(id)} title={NOMBRES[id] + " · +" + COMIDA[id] + " vida"}><Icono item={id} /><span>{iv[id]}</span><small>{NOMBRES[id]} +{COMIDA[id]}❤️</small></button>))}</div></>}
                {hr.length > 0 && <><h4>Herramientas y armas</h4><div className="m3d-celdas">{hr.map(celda)}</div></>}
                {ar.length > 0 && <><h4>🛡️ Armadura</h4><div className="m3d-celdas">{ar.map(celda)}</div></>}
                {ma.length > 0 && <><h4>Materiales</h4><div className="m3d-celdas">{ma.map(celda)}</div></>}
                {otros.length > 0 && <><h4>Otros</h4><div className="m3d-celdas">{otros.map(celda)}</div></>}
                {Object.keys(iv).filter((k) => iv[k] > 0).length === 0 && <p style={{ opacity: .8 }}>Tu mochila está vacía. Visita la 🐑 Granja para conseguir recursos.</p>}
                <p style={{ marginTop: 10, fontSize: 11, color: "#cbd5e1" }}>Este es el mismo inventario de Códice Craft (3D): lo que consigues aquí lo tienes allá, y al revés. Picar minerales, labrar y construir se hace en el mundo 3D.</p>
              </>);
            })()
          : tab === "granja" ? (<div>
              <div style={{ fontSize: 12, opacity: .9, marginBottom: 6 }}>🐑 Cuida a los animales de la granja y recoge lo que dan. Cada animal tarda un rato en tener más.</div>
              {GRANJA.map((g) => (<div key={g.tipo} className="m3d-rec"><span style={{ fontSize: 26 }}>{g.emoji}</span><b>{g.txt}</b><button disabled={ocupado} onClick={() => recolectar(g.tipo)}>Recoger</button></div>))}
            </div>)
          : tab === "fabricar" ? <ListaRecetas inv={iv} visitando={ocupado} alFabricar={fabricar} />
          : tab === "horno" ? <PanelHorno inv={iv} visitando={ocupado} alFundir={fundir} />
          : tab === "encantar" ? <PanelEncantar inv={iv} encantos={encantos} visitando={ocupado} alEncantar={encantar} />
          : tab === "pociones" ? <PanelPociones inv={iv} visitando={ocupado} alFabricar={fabricar} alBeber={beber} />
          : tab === "mercado" ? <PanelMercado inv={iv} visitando={ocupado} restante={restante} alVender={vender} />
          : (<div>
              <div style={{ fontSize: 12, opacity: .9, marginBottom: 8 }}>🐾 Explora para encontrar criaturas. Necesitas cápsulas para capturarlas (las fabricas en 🔨 Fabricar). Tienes <b>{iv[120] || 0}</b>.</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button disabled={ocupado} onClick={explorar} style={{ border: 0, borderRadius: 10, padding: "9px 16px", background: "#7c3aed", color: "#fff", fontWeight: 800, opacity: ocupado ? .5 : 1 }}>🌿 Explorar</button>
                <button onClick={() => setColec(true)} style={{ border: "1px solid #fff5", borderRadius: 10, padding: "9px 16px", background: "transparent", color: "#fff", fontWeight: 800 }}>📖 Mis criaturas</button>
              </div>
            </div>)}
      </div>
      {batalla && <PanelBatalla est={est} inicial={batalla} capsulas={iv[120] || 0} alFin={finBatalla} alInv={refrescar} />}
      {colec && <PanelColeccion est={est} cerrar={() => setColec(false)} />}
    </div>
  );
}
