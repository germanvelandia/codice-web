// Taller del Mundo 2D: lleva al mundo 2D las funciones del Códice Craft (3D) usando el MISMO inventario del servidor.
// Mercado, horno, encantamientos, pociones, fabricación, granja y criaturas. Todo lo decide el servidor (RPC con RLS):
// el navegador solo muestra y pide; no puede inventar cantidades ni saltarse los límites diarios.
import React, { useEffect, useRef, useState } from "react";
import { dibujarIcono, NOMBRES, RECETAS, FUNDICION, COMBUSTIBLES, MERCADO, ARMADURAS, HERRAMIENTAS, POCIONES, ENCANTOS, COMIDA, MATERIALES } from "../game3d/mundo3d";
import { HABITAT, CRIATURAS } from "../game3d/criaturas3d";
import * as api from "../lib/mundo3dApi";
import * as api2 from "../lib/mundo2dApi";
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


// ---------- Etapa 2: Expedición, Huerto, Parcela y Monstruos (SQL 160) ----------
const msgErr = (er) => { const m = String((er && er.message) || er || "");
  const t = /todavia_no:(\d+)/.exec(m), f = /no_madura:(\d+)/.exec(m);
  if (t) return "Todavía no: vuelve en " + t[1] + " s."; if (f) return "Aún no está madura: faltan " + f[1] + " s.";
  const mapa = { tope_diario: "Hoy ya hiciste todas tus expediciones. ¡Vuelve mañana!", sin_pico: "Necesitas un pico para entrar a la mina. Fabrícalo en 🔨 Fabricar.", desmayado: "Estás desmayado: revive o descansa primero.",
    solo_brasas: "El volcán solo está en el Reino de Brasas.", solo_principal: "Estás en el Reino de Brasas: allí solo se explora el volcán.", demasiado_rapido: "Vas muy rápido.",
    sin_azada: "Necesitas una azada para trabajar el huerto. Fabrícala en 🔨 Fabricar.", sin_material: "No tienes ese material.", ocupado: "Ese lugar ya está ocupado.", semilla_no_valida: "Eso no es una semilla.",
    limite_de_bloques: "Tu parcela está llena (60 bloques).", fuera_de_parcela: "Fuera de la parcela.", bloque_no_valido: "Ese bloque no se puede poner.", ya_vacio: "Ahí no hay nada.",
    monstruos_apagados: "Tu docente apagó los monstruos en este curso.", tipo_no_valido: "Ese monstruo no está en este reino.", jefe_pausa: "El Guardián descansa: vuelve en unos minutos.", sin_llave: "Necesitas la llave de brasas (🔨 Fabricar).", sin_combate: "Ese combate ya terminó." };
  const k = Object.keys(mapa).find((x) => m.includes(x)); return k ? mapa[k] : "No se pudo completar la acción."; };

const LUGARES = [
  { k: "bosque", emoji: "🌲", nombre: "Bosque", txt: "Troncos, palos, manzanas y semillas", dim: 0 },
  { k: "cantera", emoji: "⛰️", nombre: "Cantera", txt: "Piedra, carbón y arena", dim: 0 },
  { k: "mina", emoji: "⛏️", nombre: "Mina", txt: "Hierro, cobre, oro y diamante (según tu pico)", dim: 0 },
  { k: "volcan", emoji: "🌋", nombre: "Volcán", txt: "Fragmentos de brasa (Reino de Brasas)", dim: 1 },
];
function PanelExpedicion({ dim, ocupado, alExp, restantes }) {
  const lista = LUGARES.filter((l) => l.dim === dim);
  return (<div>
    <div style={{ fontSize: 12, opacity: .9, marginBottom: 6 }}>⛏️ Sal de expedición para traer materiales. Cada lugar necesita unos segundos de descanso{restantes != null ? <> · Hoy te quedan <b>{restantes}</b> expediciones</> : null}. Cuanto mejor el pico, mejores minerales.</div>
    {lista.map((l) => (<div key={l.k} className="m3d-rec"><span style={{ fontSize: 26 }}>{l.emoji}</span><b>{l.nombre}<br /><span style={{ fontWeight: 500, fontSize: 11, opacity: .75 }}>{l.txt}</span></b><button disabled={ocupado} onClick={() => alExp(l.k)}>Explorar</button></div>))}
    {dim === 1 && <div style={{ fontSize: 11, opacity: .8, marginTop: 6 }}>Estás en el Reino de Brasas. Para volver al mundo principal usa la pestaña ⚔️ Monstruos.</div>}
  </div>);
}

const CULTIVOS = { 0: { n: "Trigo", e: ["🌱", "🌿", "🌾", "🌾"] }, 1: { n: "Zanahoria", e: ["🌱", "🌿", "🥕", "🥕"] }, 2: { n: "Papa", e: ["🌱", "🌿", "🥔", "🥔"] } };
function PanelHuerto({ est, inv, ocupado, alCambio, avisar, pedir }) {
  const [h, setH] = useState(null), [semilla, setSemilla] = useState(72), [ahora, setAhora] = useState(Date.now()), t0 = useRef(Date.now());
  const cargar = () => api2.fetchHuertoMundo2D(est).then((d) => { t0.current = Date.now(); setH(d); }).catch((er) => avisar(msgErr(er)));
  useEffect(() => { cargar(); }, []); // eslint-disable-line
  useEffect(() => { const i = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(i); }, []);
  const semillas = [72, 73, 74].filter((i) => (inv[i] || 0) > 0);
  useEffect(() => { if (semillas.length && !semillas.includes(semilla)) setSemilla(semillas[0]); }, [inv]); // eslint-disable-line
  const sembrar = (slot) => pedir(async () => { try { const r = await api2.sembrarMundo2D(est, slot, semilla); alCambio((o) => ({ ...o, [semilla]: r.cantidad })); avisar("🌱 ¡Sembrado!"); await cargar(); } catch (er) { avisar(msgErr(er)); } });
  const cosechar = (slot) => pedir(async () => { try { const r = await api2.cosecharMundo2D(est, slot); alCambio(num(r.inventario), true); avisar("🧺 Cosechaste " + r.n + " " + NOMBRES[r.item].toLowerCase() + (r.semilla_n ? " y " + r.semilla_n + " semillas" : "") + "."); await cargar(); } catch (er) { avisar(msgErr(er)); } });
  if (!h) return <div>Cargando…</div>;
  const por = Object.fromEntries((h.slots || []).map((s) => [s.slot, s]));
  const pasado = Math.floor((ahora - t0.current) / 1000);
  return (<div>
    <div style={{ fontSize: 12, opacity: .9, marginBottom: 6 }}>🌱 Tu huerto tiene 6 parcelas. {h.azada ? "Elige una semilla y toca una parcela vacía para sembrar." : "Necesitas una azada para trabajarlo: fabrícala en 🔨 Fabricar."}</div>
    {h.azada && <div className="m3d-celdas" style={{ marginBottom: 8 }}>{[72, 73, 74].map((i) => (<button key={i} className={"m3d-celda" + (semilla === i ? " sel" : "")} onClick={() => setSemilla(i)} title={NOMBRES[i]}><Icono item={i} /><span>{inv[i] || 0}</span><small>{NOMBRES[i]}</small></button>))}</div>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
      {[0, 1, 2, 3, 4, 5].map((slot) => { const c = por[slot]; const falta = c ? Math.max(0, c.falta - pasado) : 0; const lista = c && falta === 0; const et = c ? (lista ? 3 : Math.min(2, c.etapa)) : 0;
        return (<button key={slot} disabled={ocupado || !h.azada || (c && !lista) || (!c && (inv[semilla] || 0) < 1)} onClick={() => (c ? cosechar(slot) : sembrar(slot))}
          style={{ border: "2px solid " + (lista ? "#fbbf24" : "#fff3"), background: "#3f2a1a", borderRadius: 12, padding: 8, color: "#fff", minHeight: 84, opacity: !h.azada ? .5 : 1 }}>
          <div style={{ fontSize: 28 }}>{c ? CULTIVOS[c.tipo].e[et] : "🟫"}</div>
          <div style={{ fontSize: 11, fontWeight: 700 }}>{c ? (lista ? "¡Cosechar!" : CULTIVOS[c.tipo].n + " · " + Math.floor(falta / 60) + ":" + String(falta % 60).padStart(2, "0")) : "Vacía"}</div>
        </button>); })}
    </div>
  </div>);
}

const BLOQUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 16, 17, 18, 19, 20, 21, 22, 23];
function PanelParcela({ est, inv, ocupado, alCambio, avisar, pedir }) {
  const [celdas, setCeldas] = useState(null), [sel, setSel] = useState(3);
  const cargar = () => api2.fetchParcelaMundo2D(est).then(setCeldas).catch((er) => avisar(msgErr(er)));
  useEffect(() => { cargar(); }, []); // eslint-disable-line
  const mios = BLOQUES.filter((i) => (inv[i] || 0) > 0);
  useEffect(() => { if (mios.length && !mios.includes(sel)) setSel(mios[0]); }, [inv]); // eslint-disable-line
  if (!celdas) return <div>Cargando…</div>;
  const mapa = {}; celdas.forEach((c) => { mapa[c.x + "," + c.y] = c.item; });
  const toca = (x, y) => pedir(async () => {
    const hay = mapa[x + "," + y];
    try {
      if (hay) { await api2.quitarMundo2D(est, x, y); alCambio((o) => ({ ...o, [hay]: (o[hay] || 0) + 1 })); }
      else { const r = await api2.colocarMundo2D(est, x, y, sel); alCambio((o) => ({ ...o, [sel]: r.cantidad })); }
      await cargar();
    } catch (er) { avisar(msgErr(er)); }
  });
  return (<div>
    <div style={{ fontSize: 12, opacity: .9, marginBottom: 6 }}>🧱 Tu parcela es de 10 × 10. Elige un bloque y toca un cuadro vacío para ponerlo; toca un bloque puesto para recogerlo. Llevas {celdas.length}/60.</div>
    <div className="m3d-celdas" style={{ marginBottom: 8 }}>{mios.length ? mios.map((i) => (<button key={i} className={"m3d-celda" + (sel === i ? " sel" : "")} onClick={() => setSel(i)} title={NOMBRES[i]}><Icono item={i} /><span>{inv[i]}</span><small>{NOMBRES[i]}</small></button>)) : <span style={{ opacity: .7, fontSize: 12 }}>No tienes bloques: consíguelos en ⛏️ Expedición o 🔨 Fabricar.</span>}</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)", gap: 2, background: "#14532d", padding: 4, borderRadius: 10 }}>
      {Array.from({ length: 100 }, (_, i) => { const x = i % 10, y = Math.floor(i / 10), it = mapa[x + "," + y];
        return (<button key={i} disabled={ocupado || (!it && mios.length === 0)} onClick={() => toca(x, y)} aria-label={it ? "Quitar " + NOMBRES[it] : "Poner bloque"}
          style={{ aspectRatio: "1", border: "1px solid #0003", background: it ? "#0000" : "#16a34a55", padding: 0, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {it ? <canvas ref={(c) => c && dibujarIcono(c, it)} width={16} height={16} style={{ width: "100%", height: "100%", imageRendering: "pixelated" }} /> : null}
        </button>); })}
    </div>
  </div>);
}

const MONS = { 0: [["limo", "🟢", "Limo"], ["esqueleto", "💀", "Esqueleto"], ["sombra", "👻", "Sombra"]], 1: [["brasero", "🔥", "Brasero"], ["ceniza", "🌫️", "Espectro de ceniza"], ["guardian_brasas", "👑", "Guardián de Brasas"]] };
function PanelMonstruos({ est, dim, setDim, ocupado, avisar, pedir, alInv, alRefrescar }) {
  const [vida, setVida] = useState(null), [lucha, setLucha] = useState(null), [log, setLog] = useState(""), [espera, setEspera] = useState(false);
  useEffect(() => { api.fetchVidaMundo3D(est).then((v) => v && setVida(v.vida)).catch(() => {}); }, []); // eslint-disable-line
  const iniciar = (t) => pedir(async () => { try { const r = await api2.combateIniciarMundo2D(est, t[0]); setVida(r.vida); setLucha({ ...r, nombre: t[2], emoji: t[1] }); setLog("¡Apareció " + t[2] + "!"); } catch (er) { avisar(msgErr(er)); } });
  const atacar = async () => {
    if (espera) return; setEspera(true); setTimeout(() => setEspera(false), 1050);
    try {
      const r = await api2.combateAtacarMundo2D(est);
      if (r.limitado) return;
      if (typeof r.vida === "number") setVida(r.vida);
      if (r.ganado) { setLucha(null); const p = r.premio || {}; setLog(""); avisar("⚔️ ¡Venciste! " + (p.xp || p.oro ? "+" + (p.xp || 0) + " XP · +" + (p.oro || 0) + " 🪙" : p.tope ? "(ya llegaste al tope de premios de hoy)" : "") + (p.item ? " · ¡Obtuviste una pieza rara!" : "")); alRefrescar(); }
      else if (r.perdido) { setLucha(null); setVida(0); avisar("😵 Te desmayaste. Revive para continuar."); }
      else { setLucha((l) => l && { ...l, hp: r.hp }); setLog("Le hiciste " + r.dmg + " de daño" + (r.danio ? " y te hirió: -" + r.danio + " ❤️" : "") + "."); }
    } catch (er) { avisar(msgErr(er)); setLucha(null); }
  };
  const huir = async () => { try { await api2.combateHuirMundo2D(est); } catch (_) { /* nada */ } setLucha(null); setLog(""); };
  const revivir = () => pedir(async () => { try { const r = await api.revivirMundo3D(est); setVida(r.vida); setDim(0); avisar("❤️ Volviste con " + r.vida + " de vida."); } catch (er) { avisar(msgErr(er)); } });
  const viajar = (d) => pedir(async () => { try { await api.viajarDimMundo3D(est, d); setDim(d); avisar(d === 1 ? "🔥 Cruzaste al Reino de Brasas." : "🌍 Volviste al mundo principal."); } catch (er) { avisar(msgErr(er)); } });
  return (<div>
    <div style={{ fontSize: 12, marginBottom: 8 }}>❤️ Vida: <b>{vida == null ? "…" : vida}</b> / 100 {vida === 0 && <button onClick={revivir} disabled={ocupado} style={{ marginLeft: 8, border: 0, borderRadius: 8, padding: "4px 10px", background: "#be123c", color: "#fff", fontWeight: 800 }}>Revivir</button>}
      <span style={{ marginLeft: 8, opacity: .8 }}>{dim === 1 ? "🔥 Reino de Brasas" : "🌍 Mundo principal"}</span></div>
    {lucha ? (<div style={{ border: "1px solid #fff4", borderRadius: 12, padding: 10, textAlign: "center" }}>
      <div style={{ fontSize: 44 }}>{lucha.emoji}</div><b>{lucha.nombre}</b>
      <div style={{ background: "#0006", borderRadius: 99, height: 12, margin: "6px 0", overflow: "hidden" }}><div style={{ width: Math.max(0, (lucha.hp / lucha.hp_max) * 100) + "%", height: "100%", background: "#ef4444", transition: "width .2s" }} /></div>
      <div style={{ fontSize: 11, opacity: .85 }}>{lucha.hp} / {lucha.hp_max} PV</div>
      <div style={{ fontSize: 12, minHeight: 18, margin: "6px 0" }}>{log}</div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button onClick={atacar} disabled={espera} style={{ border: 0, borderRadius: 10, padding: "9px 18px", background: "#7c3aed", color: "#fff", fontWeight: 800, opacity: espera ? .5 : 1 }}>⚔️ Atacar</button>
        <button onClick={huir} style={{ border: "1px solid #fff5", borderRadius: 10, padding: "9px 14px", background: "transparent", color: "#fff", fontWeight: 800 }}>🏃 Huir</button>
      </div>
      <div style={{ fontSize: 10, opacity: .7, marginTop: 6 }}>Tu daño depende de tu mejor espada (o herramienta) y su encantamiento Filo. La armadura reduce lo que te hieren.</div>
    </div>) : (<>
      {(MONS[dim] || []).map((m) => (<div key={m[0]} className="m3d-rec"><span style={{ fontSize: 26 }}>{m[1]}</span><b>{m[2]}</b><button disabled={ocupado || vida === 0} onClick={() => iniciar(m)}>Pelear</button></div>))}
      <div style={{ marginTop: 10 }}>
        {dim === 0 ? <button disabled={ocupado} onClick={() => viajar(1)} style={{ border: "1px solid #fb923c", borderRadius: 10, padding: "8px 12px", background: "#7c2d12", color: "#fff", fontWeight: 800 }}>🔥 Viajar al Reino de Brasas (necesita llave)</button>
          : <button disabled={ocupado} onClick={() => viajar(0)} style={{ border: "1px solid #fff5", borderRadius: 10, padding: "8px 12px", background: "transparent", color: "#fff", fontWeight: 800 }}>🌍 Volver al mundo principal</button>}
      </div>
    </>)}
  </div>);
}

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
const TABS = [["mochila", "🎒 Mochila"], ["exped", "⛏️ Expedición"], ["huerto", "🌱 Huerto"], ["parcela", "🧱 Parcela"], ["monstruos", "⚔️ Monstruos"], ["granja", "🐑 Granja"], ["fabricar", "🔨 Fabricar"], ["horno", "🔥 Horno"], ["encantar", "✨ Encantar"], ["pociones", "🧪 Pociones"], ["mercado", "🛒 Mercado"], ["criaturas", "🐾 Criaturas"]];

export default function Taller2D({ estudianteInfo, onCerrar }) {
  const est = estudianteInfo?.id;
  const [inv, setInv] = useState(null), [encantos, setEncantos] = useState({}), [restante, setRestante] = useState(null);
  const [tab, setTab] = useState("mochila"), [aviso, setAviso] = useState(""), [error, setError] = useState("");
  const [batalla, setBatalla] = useState(null), [colec, setColec] = useState(false), [ocupado, setOcupado] = useState(false);
  const [dim, setDim] = useState(0), [restantes, setRestantes] = useState(null);
  const avisoT = useRef(null);
  const avisar = (t) => { setAviso(t); clearTimeout(avisoT.current); avisoT.current = setTimeout(() => setAviso(""), 3500); };
  useEffect(() => () => clearTimeout(avisoT.current), []);

  const refrescar = () => api.fetchEstadoMundo3D(est).then((e) => { if (e && e.inventario) setInv(num(e.inventario)); }).catch(() => {});
  useEffect(() => {
    if (!est) return;
    api.fetchEstadoMundo3D(est).then((e) => setInv(num(e && e.inventario))).catch((er) => setError(er.message || "No se pudo abrir el Taller."));
    api.fetchEncantosMundo3D(est).then((e) => setEncantos(e || {})).catch(() => {});
    api.fetchDimensionMundo3D(est).then((d) => d && setDim(d.dim === 1 ? 1 : 0)).catch(() => {});
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
  const explorar2 = (lugar) => pedir(async () => {
    try { const r = await api2.expedicionMundo2D(est, lugar); setInv(num(r.inventario)); setRestantes(r.restantes); avisar("🎁 Trajiste " + r.n + " " + NOMBRES[r.item].toLowerCase() + (r.desgaste && r.desgaste.rota ? " · ¡Se rompió tu herramienta!" : "") + "."); }
    catch (er) { avisar(msgErr(er)); }
  });
  const cambiarInv = (f, reemplazar) => setInv((o) => (reemplazar ? f : f(o || {})));
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
                <p style={{ marginTop: 10, fontSize: 11, color: "#cbd5e1" }}>Este es el mismo inventario de Códice Craft (3D): lo que consigues aquí lo tienes allá, y al revés. Consigue materiales en ⛏️ Expedición y 🐑 Granja.</p>
              </>);
            })()
          : tab === "exped" ? <PanelExpedicion dim={dim} ocupado={ocupado} alExp={explorar2} restantes={restantes} />
          : tab === "huerto" ? <PanelHuerto est={est} inv={iv} ocupado={ocupado} alCambio={cambiarInv} avisar={avisar} pedir={pedir} />
          : tab === "parcela" ? <PanelParcela est={est} inv={iv} ocupado={ocupado} alCambio={cambiarInv} avisar={avisar} pedir={pedir} />
          : tab === "monstruos" ? <PanelMonstruos est={est} dim={dim} setDim={setDim} ocupado={ocupado} avisar={avisar} pedir={pedir} alRefrescar={refrescar} />
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
