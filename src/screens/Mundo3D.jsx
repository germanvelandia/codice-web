import React, { useEffect, useMemo, useRef, useState } from "react";
import { iniciarMundo3D, dibujarIcono, FRASES_CHAT, COLOCABLES, MATERIALES, HERRAMIENTAS, NOMBRES, RECETAS, MAX_USOS, FUNDICION, COMBUSTIBLES, USABLES, MERCADO, ARMADURAS, COMIDA, defensaDe } from "../game3d/mundo3d";
import * as api from "../lib/mundo3dApi";
import * as mundoApi from "../lib/mundoApi";
import * as apiGeneral from "../lib/api";
import { imagenPersonajeRol } from "../lib/personajesRol";
import { avatarDesdePersonaje } from "../game3d/avatar3d";
import { ZONAS, estadoZonas, misionesDisponibles, zonaDeMision } from "../game/zonas";
import PanelAldea from "./Mundo3DAldea";

// Mundo 3D del estudiante: un mundo de construcción por grado, con portales para visitar otros grados
// y una aldea viva (misiones, acertijos y posada del Mundo 2D, ahora con personajes que se visitan caminando).
function Icono({ item }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) dibujarIcono(ref.current, item); }, [item]);
  return <canvas ref={ref} width={16} height={16} style={{ width: 30, height: 30, imageRendering: "pixelated" }} />;
}

import { PanelBatalla, PanelColeccion } from "./Criaturas3D";
const GRUPOS_REC = ["Bloques básicos", "Materiales", "Herramientas", "Armas", "Armaduras", "Granja", "Comida", "Hornos y cobre", "Criaturas", "Dimensiones", "Bloques valiosos", "Lanas"];
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
function ListaRecetas({ inv, visitando, alFabricar }) {
  return GRUPOS_REC.map((g) => { const rs = RECETAS.filter((r) => (r.g || "Bloques básicos") === g); if (!rs.length) return null;
    return (<div key={g}><h4>{g}</h4>{rs.map((r) => { const puede = Object.entries(r.cuesta).every(([k, v]) => (inv[k] || 0) >= v);
      return (<div key={r.sale} className="m3d-rec"><Icono item={r.sale} /><b>{NOMBRES[r.sale]}{r.n > 1 ? " ×" + r.n : ""}<br /><span style={{ fontWeight: 500, fontSize: 11, opacity: .75 }}>{r.txt}</span></b><button disabled={!puede || visitando} onClick={() => alFabricar(r)}>Fabricar</button></div>); })}</div>); });
}

// Ajustes de cámara: se recuerdan en este navegador
const CAM_DEFECTO = { modo: 1, dist: 4.5, fov: 70, sens: 1 };
const leerCam = () => { try { return { ...CAM_DEFECTO, ...JSON.parse(localStorage.getItem("m3d_cam") || "{}") }; } catch (_) { return { ...CAM_DEFECTO }; } };
const guardarCam = (c) => { try { localStorage.setItem("m3d_cam", JSON.stringify(c)); } catch (_) { /* sin almacenamiento: no pasa nada */ } };
const MODOS_CAM = ["Primera persona", "Tercera persona", "De frente"];
const SND_DEF = { volumen: 0.7, musica: true, silencio: false };
const leerSnd = () => { try { return { ...SND_DEF, ...JSON.parse(localStorage.getItem("m3d_snd") || "{}") }; } catch (_) { return { ...SND_DEF }; } };
const guardarSnd = (c) => { try { localStorage.setItem("m3d_snd", JSON.stringify(c)); } catch (_) { /* sin almacenamiento */ } };
const leerOri = () => { try { return localStorage.getItem("m3d_orient") || "h"; } catch (_) { return "h"; } };
const fijarOri = async (o) => { try { if (!screen.orientation) return; if (o === "libre") screen.orientation.unlock(); else await screen.orientation.lock(o === "h" ? "landscape" : "portrait"); } catch (_) { /* iPhone y algunos navegadores no permiten bloquear: se avisa al jugador */ } };
const leerGiro = () => { try { const v = localStorage.getItem("m3d_giro"); return v == null ? null : v === "1"; } catch (_) { return null; } };
const aplicarCam = (ctl, c) => ctl && ctl.setCamara({ modo: c.modo, dist: c.dist, fov: (c.fov * Math.PI) / 180, sens: c.sens });
const partirSprite = (k) => { const i = String(k || "").lastIndexOf("_"); return i > 0 ? { rolKey: k.slice(0, i), genero: k.slice(i + 1) } : null; };

const CSS_ENTRADA = `
.m3d-puerta,.m3d-velo{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#fff;padding:0 16px}
.m3d-velo{z-index:40}
.m3d-barra{position:absolute;top:8px;right:8px;z-index:30;display:flex;gap:6px;align-items:flex-start}
.m3d-barra button{border:1px solid #fff6;background:#000a;color:#fff;border-radius:10px;padding:6px 10px;font:700 12px system-ui,sans-serif;cursor:pointer}
.m3d-barra button:hover{background:#000d}
.m3d-ajustes{position:absolute;top:46px;right:8px;z-index:31;width:min(290px,calc(100% - 16px));background:#111827f2;color:#fff;border:1px solid #fff4;border-radius:14px;padding:12px;font:12px system-ui,sans-serif}
.m3d-ajustes label{display:block;margin-top:8px;font-weight:700}.m3d-ajustes input[type=range]{width:100%}
.m3d-seg{display:flex;gap:4px;margin-top:4px}.m3d-seg button{flex:1;border:1px solid #fff5;background:#0006;color:#fff;border-radius:8px;padding:5px 2px;font:700 11px system-ui,sans-serif;cursor:pointer}.m3d-seg button.on{background:#7c3aed;border-color:#c4b5fd}
.m3d-hud{position:absolute;top:8px;left:8px;z-index:30;display:flex;flex-wrap:wrap;gap:6px;max-width:55%}
.m3d-hud span{background:#000a;color:#fff;border-radius:99px;padding:3px 10px;font:700 11px system-ui,sans-serif}
.m3d-aviso{position:absolute;top:48px;left:50%;transform:translateX(-50%);z-index:30;background:#be123cee;color:#fff;border-radius:10px;padding:6px 12px;font:700 12px system-ui,sans-serif;max-width:80%}
.m3d-hot{position:absolute;left:50%;bottom:34px;transform:translateX(-50%);z-index:30;display:flex;gap:4px;background:#000a;border-radius:12px;padding:4px}
.m3d-puerta,.m3d-velo{background:radial-gradient(circle at 50% 45%,#5b21b6 0%,#2e1065 55%,#0b0420 100%)}
.m3d-velo{transition:opacity .7s ease,transform .7s ease}
.m3d-velo-fuera{opacity:0;transform:scale(1.35);pointer-events:none}
.m3d-anillo{position:relative;width:130px;height:170px;border-radius:50%;background:conic-gradient(from 0deg,#a78bfa,#38bdf8,#f0abfc,#a78bfa);padding:10px;animation:m3d-gira 4s linear infinite;box-shadow:0 0 40px #a78bfa88}
.m3d-anillo i{display:block;width:100%;height:100%;border-radius:50%;background:radial-gradient(circle,#1e1b4b 0%,#4c1d95 70%,#7c3aed 100%);animation:m3d-pulso 2.2s ease-in-out infinite}
.m3d-anillo-g{animation-duration:1.6s}
@keyframes m3d-gira{to{transform:rotate(360deg)}}
@keyframes m3d-pulso{50%{transform:scale(.88);filter:brightness(1.4)}}
@media (pointer:coarse){.m3d-hot{bottom:12px;left:50%;max-width:calc(100% - 12px);overflow-x:auto;scrollbar-width:none}.m3d-hot::-webkit-scrollbar{display:none}.m3d-hot button{flex:0 0 auto}}
@media (pointer:coarse) and (orientation:portrait){.m3d-hot{bottom:152px;left:6px;right:6px;transform:none;max-width:none;justify-content:flex-start}.m3d-aviso{top:92px;max-width:92%}.m3d-hud{max-width:62%}}
@media (max-width:560px){.m3d-barra button .t{display:none}.m3d-barra button{padding:8px 10px;font-size:15px}.m3d-ajustes{max-height:70dvh;overflow:auto}}
.m3d-chat{position:absolute;z-index:35;left:8px;right:8px;bottom:70px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;background:#111827ee;border:1px solid #fff4;border-radius:14px;padding:8px}
.m3d-chat button{border:0;border-radius:99px;padding:7px 12px;background:#fff;color:#111;font:700 12px system-ui,sans-serif}
.m3d-cerca{position:absolute;z-index:30;left:50%;top:50px;transform:translateX(-50%);background:#0369a1ee;color:#fff;border:0;border-radius:99px;padding:6px 14px;font:700 12px system-ui,sans-serif;white-space:nowrap}
@media (pointer:coarse) and (orientation:portrait){.m3d-chat{bottom:210px}}
.m3d-inv{position:absolute;z-index:36;left:50%;top:50%;transform:translate(-50%,-50%);width:min(580px,calc(100% - 12px));max-height:calc(100% - 16px);overflow:auto;background:#111827f5;color:#fff;border:1px solid #fff4;border-radius:16px;padding:12px;font:13px system-ui,sans-serif}
.m3d-inv h4{margin:10px 0 6px;font:800 12px system-ui,sans-serif;color:#c4b5fd;text-transform:uppercase;letter-spacing:.04em}
.m3d-celdas{display:flex;flex-wrap:wrap;gap:6px}
.m3d-celda{position:relative;width:54px;height:58px;border-radius:10px;border:2px solid #fff3;background:#0006;display:flex;flex-direction:column;align-items:center;justify-content:center;font:700 11px system-ui,sans-serif;color:#fff;cursor:default}
.m3d-celda.sel{border-color:#fbbf24;background:#78350f66}.m3d-celda small{font-size:9px;font-weight:600;color:#cbd5e1;max-width:50px;text-align:center;line-height:1.05;overflow:hidden;max-height:22px}
.m3d-rec{display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid #fff2}.m3d-rec:first-of-type{border-top:0}
.m3d-rec b{flex:1}.m3d-rec button{border:0;border-radius:8px;padding:6px 12px;background:#7c3aed;color:#fff;font:800 12px system-ui,sans-serif}.m3d-rec button:disabled{opacity:.35}
@media (prefers-reduced-motion:reduce){.m3d-anillo,.m3d-anillo i{animation:none}.m3d-velo{transition:none}}`;

export default function Mundo3D({ estudianteInfo }) {
  const est = estudianteInfo?.id;
  const miGrado = String(estudianteInfo?.grado_id ?? "");
  const host = useRef(null), ctl = useRef(null), invRef = useRef({}), selRef = useRef(1), ultCambio = useRef(null);
  const [inv, setInv] = useState({});
  const [desgaste, setDesgaste] = useState({}), comerRef = useRef(null);
  // el servidor cuenta los usos; al romperse una herramienta se avisa y se baja de la mochila
  const usarHerr = (d) => {
    if (!d || !d.item) return;
    setDesgaste((o) => ({ ...o, [d.item]: d.rota ? 0 : d.usos }));
    if (d.rota) { fijarInv({ ...invRef.current, [d.item]: Math.max(0, (invRef.current[d.item] || 0) - 1) }); avisar("💥 Se rompió tu " + NOMBRES[d.item].toLowerCase() + ". ¡Fabrica otra!"); }
  };
  const [sel, setSel] = useState(1);
  const [grados, setGrados] = useState(null);
  const [gradoVer, setGradoVer] = useState(miGrado);
  const [dim, setDim] = useState(0), dimRef = useRef(0); dimRef.current = dim; const sincDim = useRef(false);
  const [zona, setZona] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [colocados, setColocados] = useState(0), [limite, setLimite] = useState(4000), [abierto, setAbierto] = useState(true);
  const [calidadAlta, setCalidadAlta] = useState(true);
  const [listo, setListo] = useState(false);
  const reloj = useRef(null);
  const [datos, setDatos] = useState({ misiones: [], hechas: new Set(), acertijos: null, posada: null, zonas: { abiertas: [], requisitos: {} }, duelos: { activo: false, insignias: [], exige: {}, bancos: {}, esperaHasta: {} }, cargado: false });
  const [dialogo, setDialogo] = useState(null);
  const [prog, setProg] = useState({ xp: null, oro: null });
  const [vida, setVida] = useState(null), vidaCfg = useRef({ monstruos: true });
  const npcsRef = useRef([]);
  const marco = useRef(null), realRef = useRef(false);
  const [cam, setCam] = useState(leerCam), camRef = useRef(null); camRef.current = cam;
  const [snd, setSnd] = useState(leerSnd), sndRef = useRef(null); sndRef.current = snd;
  const puertasRef = useRef({}), estado_ref = useRef({});
  const [ajustes, setAjustes] = useState(false);
  const [batalla, setBatalla] = useState(null), [colec, setColec] = useState(false), critRef = useRef(0);
  const parcelasRef = useRef([]), [parcelas, setParcelas] = useState([]);
  const [giro, setGiro] = useState(() => { const v = leerGiro(); return v == null ? false : v; }), giroRef = useRef(false); giroRef.current = giro;
  const [chat, setChat] = useState(false), [cerca, setCerca] = useState(null), chatRef = useRef(null);
  const [ori, setOri] = useState(leerOri), [vertical, setVertical] = useState(() => typeof matchMedia === "function" && matchMedia("(orientation:portrait)").matches);
  useEffect(() => { if (typeof matchMedia !== "function") return undefined; const m = matchMedia("(orientation:portrait)"), f = () => setVertical(m.matches); f(); m.addEventListener ? m.addEventListener("change", f) : m.addListener(f); return () => { m.removeEventListener ? m.removeEventListener("change", f) : m.removeListener(f); }; }, []);
  const cambiarOri = (o) => { setOri(o); try { localStorage.setItem("m3d_orient", o); } catch (_) { /* nada */ } fijarOri(o); };
  const [mochila, setMochila] = useState(false), [pestana, setPestana] = useState("mochila"), mochilaRef = useRef(null);
  const [ampliado, setAmpliado] = useState(false);
  const [avatar, setAvatar] = useState(null), avatarRef = useRef(null); avatarRef.current = avatar;
  const [looks, setLooks] = useState({});
  // entrada al mundo: puerta + transición (también al viajar por un portal)
  const [entrado, setEntrado] = useState(false);
  const [velo, setVelo] = useState(false), [minOk, setMinOk] = useState(true), [veloTxt, setVeloTxt] = useState("");
  const relojVelo = useRef(null);
  const abrirVelo = (txt) => { setVeloTxt(txt); setVelo(true); setMinOk(false); clearTimeout(relojVelo.current); relojVelo.current = setTimeout(() => setMinOk(true), 1700); };
  useEffect(() => () => clearTimeout(relojVelo.current), []);
  useEffect(() => { if (velo && minOk && listo) { const t = setTimeout(() => setVelo(false), 150); return () => clearTimeout(t); } }, [velo, minOk, listo]);
  const esTactil = typeof matchMedia === "function" && matchMedia("(pointer:coarse)").matches;
  const entrar = () => { if (esTactil) alternarPantalla(); abrirVelo("Cruzando el portal hacia el curso " + gradoVer + "…"); setEntrado(true); };
  const salir = () => { setEntrado(false); setVelo(false); setDialogo(null); };
  const avisar = (t) => { setMsg(t); clearTimeout(reloj.current); reloj.current = setTimeout(() => setMsg(""), 3500); };
  useEffect(() => () => clearTimeout(reloj.current), []);

  const fijarInv = (nuevo) => { invRef.current = nuevo; setInv(nuevo); };
  const visitando = gradoVer !== miGrado, visitandoRef = useRef(false); visitandoRef.current = visitando;

  // estado propio y lista de grados
  useEffect(() => {
    if (!est) return; let vivo = true;
    (async () => {
      try {
        const [e, g] = await Promise.all([api.fetchEstadoMundo3D(est), api.fetchGradosMundo3D(est)]);
        if (!vivo) return;
        fijarInv(Object.fromEntries(Object.entries(e.inventario || {}).map(([k, v]) => [Number(k), v])));
        setColocados(e.colocados || 0); setLimite(e.limite || 4000); setAbierto(e.construir !== false); setGrados(g);
        if (!gradoVer && e.grado_id) setGradoVer(String(e.grado_id));
        api.fetchDesgasteMundo3D(est).then((d) => { if (vivo) setDesgaste(Object.fromEntries(Object.entries(d || {}).map(([k, v]) => [Number(k), v]))); }).catch(() => {});
      } catch (er) { if (vivo) setError(er.message || "No se pudo abrir el Mundo 3D."); }
    })();
    return () => { vivo = false; };
  }, [est]); // eslint-disable-line

  // el avatar del estudiante (su personaje y su equipo) para verlo en pantalla
  useEffect(() => {
    if (!est) return; let vivo = true;
    (async () => {
      const [p, m] = await Promise.allSettled([apiGeneral.fetchPersonajeElegido(est), apiGeneral.fetchMejorasDeEstudiante(est)]);
      const pers = p.status === "fulfilled" ? p.value : null, mej = m.status === "fulfilled" ? m.value.filter((f) => f.mejora).map((f) => f.mejora) : [];
      const cfg = await avatarDesdePersonaje({ rolKey: pers && pers.rolKey, genero: pers && pers.genero, mejoras: mej });
      if (vivo) setAvatar(cfg);
    })();
    return () => { vivo = false; };
  }, [est]);
  useEffect(() => { if (ctl.current && avatar) ctl.current.setAvatar(avatar); }, [avatar, listo]);
  useEffect(() => { guardarCam(cam); aplicarCam(ctl.current, cam); }, [cam, listo]);

  // misiones, acertijos y posada (los mismos del Mundo 2D)
  useEffect(() => {
    if (!est) return; let vivo = true;
    (async () => {
      const [m, h, a, p, z, d] = await Promise.allSettled([mundoApi.fetchMisionesMundo(miGrado || null), mundoApi.fetchHechasMundo(est), mundoApi.fetchAcertijosMundo(est, miGrado || null), mundoApi.fetchPosadaMundo(), mundoApi.fetchZonasMundo(miGrado || null), mundoApi.fetchDuelosMundo(est)]);
      if (!vivo) return;
      const hayTablas = m.status === "fulfilled" && h.status === "fulfilled";
      setDatos({
        misiones: m.status === "fulfilled" ? m.value : [], hechas: new Set(h.status === "fulfilled" ? h.value : []), acertijos: a.status === "fulfilled" ? a.value : null, posada: p.status === "fulfilled" ? p.value : null,
        zonas: z.status === "fulfilled" ? z.value : { abiertas: [], requisitos: {} },       // sin el SQL 64 solo existe la Aldea
        duelos: d.status === "fulfilled" && hayTablas ? d.value : { activo: false, insignias: [], exige: {}, bancos: {}, esperaHasta: {} },
        cargado: true,
      });
    })();
    return () => { vivo = false; };
  }, [est, miGrado]);

  // qué zonas están abiertas para este estudiante (docente + misiones + insignias), igual que en el Mundo 2D
  const estado = useMemo(() => estadoZonas({ misiones: datos.misiones, hechas: datos.hechas, abiertas: datos.zonas.abiertas, requisitos: datos.zonas.requisitos, insignias: datos.duelos.insignias, exigen: datos.duelos.exige }), [datos]);
  estado_ref.current = estado;

  // el aspecto de cada personaje sale de su dibujo (mismo rol y género que en el Mundo 2D)
  useEffect(() => {
    const claves = new Set(datos.misiones.map((m) => m.npc_sprite).filter(Boolean)); ZONAS.forEach((z) => z.guardian && claves.add(z.guardian.sprite));
    const faltan = [...claves].filter((k) => !(k in looks)); if (!faltan.length) return; let vivo = true;
    (async () => {
      const nuevo = {};
      for (const k of faltan) { const sp = partirSprite(k); nuevo[k] = sp && imagenPersonajeRol(sp.rolKey, sp.genero) ? await avatarDesdePersonaje(sp) : null; }
      if (vivo) setLooks((l) => ({ ...l, ...nuevo }));
    })();
    return () => { vivo = false; };
  }, [datos.misiones]); // eslint-disable-line

  // personajes: uno por cada (lugar, nombre) con sus misiones (solo de zonas abiertas); un guardián por zona; el maestro de acertijos y el posadero
  const npcs = useMemo(() => {
    if (gradoVer !== miGrado) return []; // de visita no se habla con nadie
    const grupos = new Map();
    for (const m of misionesDisponibles(datos.misiones, estado)) { const k = m.lugar + "|" + m.npc_nombre; if (!grupos.has(k)) grupos.set(k, { id: "m-" + k, tipo: "misiones", nombre: m.npc_nombre, emoji: m.npc_emoji || "🧑", lugar: m.lugar, look: looks[m.npc_sprite] || null, misiones: [] }); grupos.get(k).misiones.push(m); }
    const lista = [...grupos.values()].map((n) => ({ ...n, hecha: n.misiones.every((m) => datos.hechas.has(m.id)) }));
    const ac = datos.acertijos;
    if (ac && ac.lista.length) lista.push({ id: "s-acertijos", tipo: "acertijos", nombre: "Maestra de acertijos", emoji: "🧩", lugar: "acertijos", marca: "🧩 ", hecha: ac.lista.every((x) => ac.hechos.includes(x.id)) });
    if (datos.posada && datos.posada.activa) lista.push({ id: "s-posada", tipo: "posada", nombre: "Posadero", emoji: "🛏️", lugar: "posada", marca: "💤 " });
    for (const z of ZONAS) if (z.guardian) {
      const tiene = datos.duelos.insignias.includes(z.key);
      lista.push({ id: "g-" + z.key, tipo: "guardian", zona: z.key, nombre: z.guardian.nombre, emoji: "🛡️", lugar: "guardia_" + z.key, marca: estado[z.key] && estado[z.key].desbloqueada ? "⚔️ " : "🔒 ", look: looks[z.guardian.sprite] || null, hecha: tiene });
    }
    return lista;
  }, [datos, estado, looks, gradoVer, miGrado]);
  npcsRef.current = npcs;
  useEffect(() => { if (ctl.current) ctl.current.actualizarNpcs(npcs); }, [npcs, listo]);
  // portones de las zonas: se abren cuando la zona está desbloqueada
  useEffect(() => {
    const p = {}; ZONAS.forEach((z) => { if (z.previa) p[z.key] = !!(estado[z.key] && estado[z.key].desbloqueada); });
    puertasRef.current = p; if (ctl.current) ctl.current.setPuertas(p);
  }, [estado, listo]);
  // mi parcela y las de mis compañeros (solo en el mundo de mi curso)
  useEffect(() => {
    if (!est || !listo || visitando) { parcelasRef.current = []; if (ctl.current) ctl.current.setParcelas([]); return undefined; } let vivo = true;
    const cargar = async () => { try { await api.fetchMiParcela(est); const l = await api.fetchParcelasMundo3D(est); if (vivo) { parcelasRef.current = l; setParcelas(l); if (ctl.current) ctl.current.setParcelas(l); } } catch (_) { /* sin el SQL 139 no hay parcelas */ } };
    cargar(); const r = setInterval(cargar, 60000); return () => { vivo = false; clearInterval(r); };
  }, [est, listo, visitando]); // eslint-disable-line
  const [botonesPP, setBotonesPP] = useState(() => { try { return localStorage.getItem("m3d_pp") === "1"; } catch (_) { return false; } }), ppRef = useRef(false); ppRef.current = botonesPP;
  useEffect(() => { try { localStorage.setItem("m3d_pp", botonesPP ? "1" : "0"); } catch (_) { /* nada */ } if (ctl.current) ctl.current.setControl({ botonesPP }); }, [botonesPP, listo]);
  useEffect(() => { try { localStorage.setItem("m3d_giro", giro ? "1" : "0"); } catch (_) { /* nada */ } if (ctl.current) ctl.current.setControl({ giro }); }, [giro, listo]);
  // compañeros conectados: se envía mi posición y se reciben las de los demás (cada 2 s; en pausa si la pestaña está oculta)
  const [conectados, setConectados] = useState(0);
  useEffect(() => {
    if (!est || !listo || !gradoVer || dim) return; let vivo = true, busy = false;
    const tic = async () => {
      if (busy || document.hidden || !ctl.current) return; busy = true;
      try {
        const p = ctl.current.posicion(), lista = await api.latidoMundo3D(est, gradoVer, p.x, p.y, p.z, p.yaw, avatarRef.current);
        if (vivo && ctl.current) { ctl.current.setOtros(lista); setConectados(lista.length); }
      } catch (_) { /* sin el SQL 136 o sin red: simplemente no se ven compañeros */ } finally { busy = false; }
    };
    tic(); const r = setInterval(tic, 2000);
    return () => { vivo = false; clearInterval(r); setConectados(0); api.salirMundo3D(est).catch(() => {}); };
  }, [est, listo, gradoVer, dim]); // eslint-disable-line
  // vida del personaje (la misma de CÓDICE): se lee al entrar y cada 25 s para ver la recuperación lenta
  useEffect(() => {
    if (!listo || !est) return; let vivo = true;
    const leer = async () => { try { const r = await api.fetchVidaMundo3D(est); if (!vivo || !r) return; setVida(r.vida); vidaCfg.current = { monstruos: r.monstruos !== false }; if (ctl.current) ctl.current.setVida({ monstruos: r.monstruos !== false }); } catch (_) { /* sin SQL 141: el juego sigue sin vida */ } };
    leer(); const t = setInterval(() => { if (!document.hidden) leer(); }, 25000);
    return () => { vivo = false; clearInterval(t); };
  }, [est, listo, gradoVer]); // eslint-disable-line
  // al fallar una pregunta: el servidor quita vida; si llega a 0 el personaje se desmaya y despierta en la aldea
  const alFallo = async () => {
    try { const r = await api.golpeMundo3D(est, "error"); if (r && typeof r.vida === "number") setVida(r.vida); if (r && r.desmayo) { setDialogo(null); if (ctl.current) { ctl.current.pausar(false); ctl.current.desmayarse(); } } return r; } catch (_) { return null; }
  };
  useEffect(() => { guardarSnd(snd); if (ctl.current) ctl.current.setSonido(snd); }, [snd, listo]);
  const refrescarInv = () => api.fetchEstadoMundo3D(est).then((e) => { if (e && e.inventario) fijarInv(Object.fromEntries(Object.entries(e.inventario).map(([k, v]) => [Number(k), v]))); }).catch(() => {});
  const abrirColec = (v) => { setColec(v); if (v) { setAjustes(false); setMochila(false); } ctl.current && ctl.current.pausar(v); };
  const finBatalla = (r, extra) => { const id = critRef.current; setBatalla(null); if (ctl.current) { ctl.current.criaturaFin(id, false); ctl.current.pausar(false); } if (r === "capturada" && extra && extra.xp) setProg((p) => (p.xp == null ? p : { xp: p.xp + extra.xp, oro: p.oro + extra.oro })); };
  const cerrarDialogo = () => { setDialogo(null); ctl.current && ctl.current.pausar(false); };
  const alHecha = (id, r) => { setDatos((d) => ({ ...d, hechas: new Set([...d.hechas, id]) })); if (r && typeof r.xp === "number") setProg({ xp: r.xp, oro: r.oro }); };
  const alInsignia = (zonaKey, r) => setDatos((d) => ({ ...d, duelos: { ...d.duelos, insignias: d.duelos.insignias.includes(zonaKey) ? d.duelos.insignias : [...d.duelos.insignias, zonaKey] } }));
  const alDerrota = (zonaKey) => setDatos((d) => ({ ...d, duelos: { ...d.duelos, esperaHasta: { ...(d.duelos.esperaHasta || {}), [zonaKey]: d.duelos.esperaMin > 0 ? Date.now() + d.duelos.esperaMin * 60000 : 0 } } }));
  const alHechoAcertijo = (id) => setDatos((d) => ({ ...d, acertijos: d.acertijos ? { ...d.acertijos, hechos: [...d.acertijos.hechos, id] } : d.acertijos }));

  // portales: tu mundo (si visitas) y otros grados, hasta 8
  const portales = useMemo(() => {
    if (!grados) return [];
    const otros = grados.filter((g) => g !== gradoVer && g !== miGrado);
    const nivel = (g) => String(g).replace(/\d{2}$/, "");
    otros.sort((a, b) => (nivel(a) === nivel(gradoVer) ? 0 : 1) - (nivel(b) === nivel(gradoVer) ? 0 : 1) || String(a).localeCompare(String(b), "es", { numeric: true }));
    const lista = [];
    if (visitando) lista.push({ id: miGrado, nombre: "Volver a mi mundo (" + miGrado + ")" });
    otros.slice(0, 8 - lista.length).forEach((g) => lista.push({ id: g, nombre: "Curso " + g }));
    return lista;
  }, [grados, gradoVer, miGrado, visitando]);

  // crear el mundo del grado que se mira
  useEffect(() => {
    if (!entrado || !est || !grados || !gradoVer || !host.current) return;
    let vivo = true; let relojPoll = null; let c = null; setListo(false);
    (async () => {
      try {
        if (!sincDim.current) { sincDim.current = true; try { await api.viajarDimMundo3D(est, 0); } catch (_) { /* sin el SQL 147 */ } } // al entrar siempre se empieza en el mundo principal
        const enDim = gradoVer === miGrado ? dim : 0, llave = enDim ? gradoVer + "~" + enDim : gradoVer;
        const filas = await api.fetchCambiosMundo3D(est, llave);
        if (!vivo) return;
        ultCambio.current = filas.length ? filas[filas.length - 1].actualizado : null;
        host.current.innerHTML = "";
        c = iniciarMundo3D(host.current, {
          grado: gradoVer, dim: enDim, yo: est, soloMirar: gradoVer !== miGrado, portales: enDim ? [] : portales, cambios: filas, npcs: enDim ? [] : npcsRef.current,
          avatar: avatarRef.current, camara: camRef.current.modo,
          alCamara: (m) => setCam((c) => ({ ...c, modo: m })),
          alNpc: (n) => setDialogo(n),
          cantidad: (i) => invRef.current[i] || 0,
          picar: async (x, y, z, b) => { const r = await api.picarMundo3D(est, x, y, z, b); if (r && r.item) fijarInv({ ...invRef.current, [r.item]: Math.min(999, (invRef.current[r.item] || 0) + 1) }); if (r && r.extra) fijarInv({ ...invRef.current, [r.extra]: Math.min(999, (invRef.current[r.extra] || 0) + 1) }); if (r && r.desgaste) usarHerr(r.desgaste); setColocados((n) => n); return r; },
          poner: async (x, y, z, i) => { const r = await api.ponerMundo3D(est, x, y, z, i); fijarInv({ ...invRef.current, [i]: r.cantidad }); setColocados((n) => n + 1); return r; },
          labrar: async (x, y, z, b) => { const r = await api.labrarMundo3D(est, x, y, z, b); if (r && r.desgaste) usarHerr(r.desgaste); return r; },
          sembrar: async (x, y, z, i) => { const r = await api.sembrarMundo3D(est, x, y, z, i); fijarInv({ ...invRef.current, [i]: r.cantidad }); return r; },
          cosechar: async (x, y, z) => { const r = await api.cosecharMundo3D(est, x, y, z); if (r && r.inventario) fijarInv(Object.fromEntries(Object.entries(r.inventario).map(([k, v]) => [Number(k), v]))); return r; },
          alComer: () => comerRef.current && comerRef.current(),
          alSeleccion: (i) => { selRef.current = i; setSel(i); },
          alZona: setZona, alError: (t) => avisar(t),
          puertas: enDim ? {} : puertasRef.current, sonido: sndRef.current,
          alCriatura: async (tipo, id) => {
            critRef.current = id; if (ctl.current) ctl.current.pausar(true);
            try { const r = await api.encontrarCriaturaMundo3D(est, tipo); setBatalla(r); }
            catch (er) { const m = String(er.message || ""); if (ctl.current) { ctl.current.pausar(false); ctl.current.criaturaFin(id, !/bloqueada|su_mundo/.test(m)); } avisar(/bloqueada/.test(m) ? "Esa criatura aún es demasiado fuerte: vence a un guardián de zona primero." : /desmayado/.test(m) ? "Estás sin vida: espera a recuperarte." : /demasiado_rapido/.test(m) ? "Más despacio…" : "No se pudo iniciar la batalla (¿falta el SQL 148?)."); }
          },
          alDim: async (d) => {
            if (visitandoRef.current) { avisar("De visita no puedes cruzar al Reino de Brasas."); return; }
            try { await api.viajarDimMundo3D(est, d); abrirVelo(d ? "🔥 Cruzando al Reino de Brasas…" : "🌀 Volviendo al mundo principal…"); setDim(d); }
            catch (er) { const m = String(er.message || ""); avisar(/sin_llave/.test(m) ? "🔑 Necesitas la llave de brasas (6 hierro + 2 oro) para entrar. Se fabrica en la mesa." : /desmayado/.test(m) ? "Estás sin vida: espera a recuperarte." : "No se pudo cruzar el portal."); }
          },
          alInventario: () => mochilaRef.current && mochilaRef.current(true), alMesa: () => { setPestana("fabricar"); mochilaRef.current && mochilaRef.current(true); },
          parcelas: visitandoRef.current || enDim ? [] : parcelasRef.current, giroPalanca: giroRef.current, botonesPP: ppRef.current,
          alChat: () => chatRef.current && chatRef.current(), alCerca: (n) => setCerca(n),
          alDanio: (tipo) => (tipo === "lava" ? api.golpeMundo3D(est, "lava") : api.golpeMundo3D(est, "monstruo", tipo)).then((r) => { if (r && r.armadura) usarHerr(r.armadura); return r; }), alVida: (r) => { if (r && typeof r.vida === "number") setVida(r.vida); }, alRevivir: () => api.revivirMundo3D(est).then((r) => { if (dimRef.current) { abrirVelo("💫 Despiertas en la aldea…"); setDim(0); } return r; }),
          alMonstruoVencido: async (tipo) => { api.gastarArmaMundo3D(est).then((d) => { if (d) usarHerr(d); }).catch(() => {}); const r = await api.monstruoVencidoMundo3D(est, tipo); if (r && (r.xp || r.oro)) setProg((p) => (p.xp == null ? p : { xp: p.xp + r.xp, oro: p.oro + r.oro })); if (r && (r.xp || r.oro)) api.fetchEstadoMundo3D(est).then((e) => { if (e && e.inventario) fijarInv(Object.fromEntries(Object.entries(e.inventario).map(([k, v]) => [Number(k), v]))); }).catch(() => {}); return r; },
          recolectar: async (tipo) => { const r = await api.recolectarMundo3D(est, tipo); if (r && r.item) fijarInv({ ...invRef.current, [r.item]: Math.min(999, (invRef.current[r.item] || 0) + (r.n || 1)) }); return r; },
          alPuerta: (k) => { const z = ZONAS.find((x) => x.key === k); const e = estado_ref.current[k] || {}; avisar("🔒 El portón de «" + (z ? z.nombre : k) + "» está cerrado." + (e.cumplido === false ? " Completa más misiones de la zona anterior." : " Vence al guardián de la zona anterior.")); },
          alPortal: (id) => { const t = "Viajando al mundo de " + (String(id) === miGrado ? "tu curso" : "curso " + id) + "…"; abrirVelo(t); setGradoVer(String(id)); },
        });
        c.seleccionar(selRef.current); aplicarCam(c, camRef.current); ctl.current = c; setListo(true);
        const verCultivos = () => enDim ? Promise.resolve() : api.fetchCultivosMundo3D(est, gradoVer).then((l) => { if (vivo && ctl.current === c) c.aplicarCultivos(l); }).catch(() => {});
        verCultivos();
        // ver lo que construyen los compañeros mientras juegas
        let vuelta = 0;
        relojPoll = setInterval(async () => {
          if (document.hidden) return;
          if (++vuelta % 3 === 0) verCultivos();
          try {
            const nuevas = await api.fetchCambiosMundo3D(est, llave, ultCambio.current);
            if (nuevas.length && ctl.current === c) { ultCambio.current = nuevas[nuevas.length - 1].actualizado; c.aplicar(nuevas); }
          } catch (_) { /* se reintenta en el siguiente ciclo */ }
        }, 3000);
      } catch (er) { if (vivo) setError(er.message || "No se pudo cargar el mundo."); }
    })();
    return () => { vivo = false; clearInterval(relojPoll); if (c) c.cerrar(); if (ctl.current === c) ctl.current = null; };
  }, [est, grados, gradoVer, entrado, dim]); // eslint-disable-line

  // pantalla completa: la del navegador si existe; si no (por ejemplo en iPhone) se amplía sobre toda la página
  useEffect(() => {
    const salida = () => { if (realRef.current && !document.fullscreenElement && !document.webkitFullscreenElement) { realRef.current = false; setAmpliado(false); } };
    document.addEventListener("fullscreenchange", salida); document.addEventListener("webkitfullscreenchange", salida);
    return () => { document.removeEventListener("fullscreenchange", salida); document.removeEventListener("webkitfullscreenchange", salida); };
  }, []);
  useEffect(() => { if (!ampliado) return undefined; const antes = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = antes; }; }, [ampliado]);
  useEffect(() => { // al salir del mundo o de la pantalla se limpia todo
    if (!entrado) { setAjustes(false); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); setAmpliado(false); realRef.current = false; }
  }, [entrado]);
  const alternarPantalla = async () => {
    if (ampliado) { if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch (_) { /* nada */ } } realRef.current = false; setAmpliado(false); return; }
    const el = marco.current; if (!el) return;
    try { if (el.requestFullscreen) { await el.requestFullscreen(); realRef.current = true; } else if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); realRef.current = true; } } catch (_) { realRef.current = false; }
    setAmpliado(true);
    if (esTactil) fijarOri(ori);
  };
  const abrirAjustes = (v) => { setAjustes(v); if (v) setMochila(false); ctl.current && ctl.current.pausar(v); };
  const decir = async (id) => { setChat(false); try { await api.decirMundo3D(est, id); avisar("💬 Tú: " + FRASES_CHAT[id]); } catch (er) { avisar(/chat_cerrado/.test(er.message) ? "Tu docente cerró el chat por ahora." : /demasiado_rapido/.test(er.message) ? "Espera un momento para hablar otra vez." : /sin_presencia/.test(er.message) ? "Aún no hay nadie conectado contigo." : "No se pudo enviar."); } };
  chatRef.current = (v) => setChat((c) => (typeof v === "boolean" ? v : !c));
  const verParcelas = () => { const n = ctl.current && ctl.current.verParcelaAjena(); avisar(n ? "👀 Parcela de " + n + ": mira su construcción (solo él puede modificarla). Pulsa de nuevo para ver la siguiente." : "Aún no hay parcelas de compañeros para ver."); };
  const irParcela = () => { if (ctl.current && ctl.current.irAMiParcela()) avisar("🏠 Estás en tu parcela: aquí solo construyes tú. Fuera de ella puedes construir en cualquier parte, menos en la plaza y en las parcelas de otros."); };
  const abrirMochila = (v) => { setMochila(v); if (v) setAjustes(false); ctl.current && ctl.current.pausar(v); };
  mochilaRef.current = abrirMochila;
  const ciclarCamara = () => setCam((c) => ({ ...c, modo: (c.modo + 1) % 3 }));

  const elegir = (i) => { setSel(i); selRef.current = i; ctl.current && ctl.current.seleccionar(i); };
  const [restanteMercado, setRestanteMercado] = useState(null);
  // comer: devuelve vida (el servidor decide cuánto y limita el ritmo); la tecla R come lo que más cura
  const comer = async (item) => {
    try { const r = await api.comerMundo3D(est, item); fijarInv({ ...invRef.current, [item]: r.cantidad }); if (typeof r.vida === "number") setVida(r.vida); if (ctl.current && ctl.current.setVida) ctl.current.setVida({ vida: r.vida }); avisar("😋 Comiste " + NOMBRES[item].toLowerCase() + ": +" + r.cura + " ❤️"); }
    catch (er) { avisar(/vida_llena/.test(er.message) ? "Tu vida ya está llena." : /demasiado_rapido/.test(er.message) ? "Mastica con calma…" : /desmayado/.test(er.message) ? "Estás desmayado." : /sin_material/.test(er.message) ? "No tienes comida." : "No se pudo comer."); }
  };
  const comerMejor = () => { const id = Object.keys(COMIDA).map(Number).filter((i) => (invRef.current[i] || 0) > 0).sort((a, b) => COMIDA[b] - COMIDA[a])[0]; if (id) comer(id); else avisar("No tienes comida: siembra, cocina o recoge manzanas de los árboles."); };
  comerRef.current = comerMejor;
  const vender = async (item, n) => {
    try { const r = await api.venderMundo3D(est, item, n); fijarInv(Object.fromEntries(Object.entries(r.inventario || {}).map(([k, v]) => [Number(k), v]))); setRestanteMercado(r.restante); setProg((p) => (p.xp == null ? p : { xp: p.xp + r.xp, oro: p.oro + r.oro })); avisar("🛒 Vendiste " + r.vendido + " " + NOMBRES[item].toLowerCase() + ": +" + r.oro + " 🪙"); }
    catch (er) { avisar(/tope_diario/.test(er.message) ? "Hoy ya ganaste el máximo en el Mercado. ¡Vuelve mañana!" : /sin_material/.test(er.message) ? "No tienes tantos." : /demasiado_rapido/.test(er.message) ? "Vas muy rápido." : "No se pudo vender."); }
  };
  const fundir = async (f, n, comb) => {
    try { const res = await api.fundirMundo3D(est, f.entrada, n, comb); fijarInv(Object.fromEntries(Object.entries(res.inventario || {}).map(([k, v]) => [Number(k), v]))); avisar("🔥 Fundiste " + n + " → " + NOMBRES[f.sale].toLowerCase() + "."); }
    catch (er) { avisar(/sin_horno/.test(er.message) ? "Necesitas un horno." : /sin_combustible/.test(er.message) ? "No tienes suficiente combustible." : /sin_material/.test(er.message) ? "No tienes suficiente material." : /demasiado_rapido/.test(er.message) ? "Vas muy rápido." : "No se pudo fundir."); }
  };
  const fabricar = async (r) => {
    try { const res = await api.fabricarMundo3D(est, r.sale); fijarInv(Object.fromEntries(Object.entries(res.inventario || {}).map(([k, v]) => [Number(k), v]))); avisar("Fabricaste " + (r.n > 1 ? r.n + " de " : "") + NOMBRES[r.sale].toLowerCase() + "."); }
    catch (er) { avisar(/sin_material/.test(er.message) ? "No tienes suficiente material." : /demasiado_rapido/.test(er.message) ? "Vas muy rápido." : "No se pudo fabricar."); }
  };
  const cambiarCalidad = () => { const v = !calidadAlta; setCalidadAlta(v); ctl.current && ctl.current.setCalidad(v); };

  const barraBloques = [...COLOCABLES.filter((id) => id <= 9 || (inv[id] || 0) > 0), ...USABLES.filter((id) => (inv[id] || 0) > 0)].map((id, i) => (
    <button key={id} onClick={() => elegir(id)} aria-pressed={sel === id} aria-label={NOMBRES[id] + (i < 9 ? " (tecla " + (i + 1) + ")" : "")}
      className={`w-[52px] h-[56px] rounded-lg border-2 flex flex-col items-center pt-1 text-[11px] font-bold ${sel === id ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white"} ${(inv[id] || 0) === 0 ? "opacity-50" : ""}`}>
      <Icono item={id} /><span className="text-slate-600">{inv[id] || 0}</span>
    </button>
  ));

  if (!est) return <p className="text-sm text-slate-400">Entra con tu código para abrir el Mundo 3D.</p>;
  if (error) return <div className="text-sm text-rose-600 bg-rose-50 rounded-xl p-3">{error} Si es la primera vez, la docente debe ejecutar el archivo 133_mundo3d.sql en Supabase.</div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-extrabold text-slate-800">🧊 Códice Craft · {visitando ? "Visitando el curso " + gradoVer : "Mi curso " + gradoVer}</span>
        {prog.xp != null && <span className="text-[11px] font-bold rounded-full px-2.5 py-0.5 bg-amber-100 text-amber-700">⭐ {prog.xp} XP · 🪙 {prog.oro}</span>}
        {vida != null && <span title="Vida del personaje" className="text-[11px] font-bold rounded-full px-2.5 py-0.5" style={{ background: `linear-gradient(90deg,#fecaca ${vida}%,#f1f5f9 ${vida}%)`, color: vida <= 25 ? "#b91c1c" : "#7f1d1d", minWidth: 84, textAlign: "center" }}>❤️ {vida}</span>}
        {zona && <span className="text-[11px] font-bold rounded-full px-2.5 py-0.5 bg-emerald-100 text-emerald-700">📍 {zona}</span>}
        {conectados > 0 && <span className="text-[11px] font-bold rounded-full px-2.5 py-0.5 bg-sky-100 text-sky-700">👥 {conectados + 1} conectados</span>}
        {visitando && <><span className="text-[11px] font-bold rounded-full px-2.5 py-0.5 bg-amber-100 text-amber-700">👀 Solo mirar</span>
          <button onClick={() => { abrirVelo("Volviendo a tu mundo…"); setGradoVer(miGrado); }} className="text-[11px] font-bold text-violet-600 hover:underline">← Volver a mi mundo</button></>}
        {entrado && <button onClick={salir} className="text-[11px] font-bold text-slate-500 hover:underline">Salir del mundo</button>}
        {msg && <span className="ml-auto text-[12px] font-semibold text-rose-600" role="status">{msg}</span>}
      </div>

      <div ref={marco} className={ampliado ? "m3d-full" : "rounded-xl"} style={ampliado ? { position: "fixed", inset: 0, zIndex: 70, background: "#000", overflow: "hidden" } : { position: "relative", overflow: "hidden", minHeight: entrado ? 120 : 380 }}>
        <style>{CSS_ENTRADA}</style>
        <div ref={host} style={{ minHeight: 120 }} />
        {!entrado && (
          <div className="m3d-puerta absolute inset-0 flex flex-col items-center justify-center text-center text-white px-4">
            <div className="m3d-anillo" aria-hidden="true"><i /></div>
            <h2 className="mt-5 text-xl font-extrabold">Códice Craft · Curso {gradoVer || miGrado}</h2>
            <p className="text-sm text-violet-100 max-w-sm mt-1">Un mundo de bloques para tu curso: construye, explora la aldea y visita a los personajes. Cruza el portal para entrar.</p>
            <button onClick={entrar} disabled={!grados || !gradoVer} className="mt-4 rounded-full px-6 py-2.5 font-extrabold bg-white text-violet-700 shadow-lg hover:scale-105 transition disabled:opacity-50">{grados ? "🌀 Entrar al mundo" : "Preparando…"}</button>
          </div>
        )}
        {entrado && (
          <div className={`m3d-velo absolute inset-0 z-40 flex flex-col items-center justify-center text-white text-center px-4 ${velo ? "" : "m3d-velo-fuera"}`} aria-live="polite">
            <div className="m3d-anillo m3d-anillo-g" aria-hidden="true"><i /></div>
            <p className="mt-5 font-extrabold text-lg">{veloTxt}</p>
            <p className="text-xs text-violet-200 mt-1">Preparando bloques, personajes y portales…</p>
          </div>
        )}
        {entrado && !velo && (
          <>
            <div className="m3d-barra">
              <button onClick={ciclarCamara} title="Cambiar cámara (tecla V)">📷<span className="t"> {MODOS_CAM[cam.modo]}</span></button>
              <button onClick={() => abrirColec(true)} title="Mis criaturas capturadas" disabled={visitando}>🐾<span className="t"> Criaturas</span></button>
              <button onClick={verParcelas} title="Ver las parcelas de mis compañeros" disabled={visitando || parcelas.filter((p) => !p.mia).length === 0}>👀<span className="t"> Ver parcelas</span></button>
              <button onClick={irParcela} title="Ir a mi parcela" disabled={visitando || !parcelas.some((p) => p.mia)}>🏠<span className="t"> Mi parcela</span></button>
              <button onClick={() => setChat((c) => !c)} aria-expanded={chat} title="Chat rápido (tecla T)">💬<span className="t"> Chat</span></button>
              <button onClick={() => abrirMochila(!mochila)} aria-expanded={mochila} title="Mochila y fabricación (tecla I)">🎒<span className="t"> Mochila</span></button>
              <button onClick={() => abrirAjustes(!ajustes)} aria-expanded={ajustes} title="Ajustes de cámara">⚙️</button>
              <button onClick={alternarPantalla} title={ampliado ? "Reducir la pantalla" : "Ampliar la pantalla"}>{ampliado ? "🗗" : "⛶"}<span className="t">{ampliado ? " Reducir" : " Ampliar"}</span></button>
            </div>
            {cerca && !chat && <button className="m3d-cerca" onClick={() => setChat(true)}>👋 {cerca} está cerca · toca para saludar</button>}
            {chat && (
              <div className="m3d-chat" role="dialog" aria-label="Chat rápido">
                {Object.entries(FRASES_CHAT).map(([id, t]) => <button key={id} onClick={() => decir(Number(id))}>{t}</button>)}
              </div>
            )}
            {mochila && (
              <div className="m3d-inv" role="dialog" aria-label="Mochila">
                <div className="m3d-seg" style={{ marginTop: 0 }}><button className={pestana === "mochila" ? "on" : ""} onClick={() => setPestana("mochila")}>🎒 Mochila</button><button className={pestana === "fabricar" ? "on" : ""} onClick={() => setPestana("fabricar")}>🔨 Fabricar</button><button className={pestana === "horno" ? "on" : ""} onClick={() => setPestana("horno")}>🔥 Horno</button><button className={pestana === "mercado" ? "on" : ""} onClick={() => { setPestana("mercado"); api.fetchMercadoHoyMundo3D(est).then((r) => setRestanteMercado(r && r.restante)).catch(() => {}); }}>🛒 Mercado</button></div>
                {pestana === "mochila" ? (() => {
                  const celda = (id, ponible) => (<button key={id} className={"m3d-celda" + (sel === id ? " sel" : "")} onClick={() => ponible && elegir(id)} style={{ cursor: ponible ? "pointer" : "default" }} title={NOMBRES[id]}><Icono item={id} /><span>{inv[id]}</span><small>{NOMBRES[id]}</small>{MAX_USOS(id) > 0 && (<i style={{ display: "block", height: 4, borderRadius: 2, background: "#334155", marginTop: 2, overflow: "hidden" }}><b style={{ display: "block", height: "100%", width: Math.max(4, 100 - ((desgaste[id] || 0) / MAX_USOS(id)) * 100) + "%", background: ((desgaste[id] || 0) / MAX_USOS(id)) > .8 ? "#ef4444" : ((desgaste[id] || 0) / MAX_USOS(id)) > .5 ? "#f59e0b" : "#22c55e" }} /></i>)}</button>);
                  const tengo = (lista) => lista.filter((id) => (inv[id] || 0) > 0), hr = tengo(HERRAMIENTAS), se = tengo([72, 73, 74]), ar = tengo(ARMADURAS), co = Object.keys(COMIDA).map(Number).filter((i) => (inv[i] || 0) > 0), bl = COLOCABLES.filter((id) => (inv[id] || 0) > 0), ma = tengo(MATERIALES);
                  return (<>
                    {hr.length > 0 && <><h4>Herramientas y armas (la barra muestra su desgaste; la azada se elige para labrar)</h4><div className="m3d-celdas">{hr.map((id) => celda(id, id >= 80))}</div></>}
                    {ar.length > 0 && <><h4>🛡️ Armadura puesta · defensa {defensaDe((i) => inv[i] || 0)} (−{Math.min(60, defensaDe((i) => inv[i] || 0) * 5)}% de daño de monstruos)</h4><div className="m3d-celdas">{ar.map((id) => celda(id, false))}</div></>}
                    {co.length > 0 && <><h4>🍽️ Comida (toca para comer · tecla R come lo mejor)</h4><div className="m3d-celdas">{co.map((id) => (<button key={id} className="m3d-celda" onClick={() => comer(id)} title={NOMBRES[id] + " · +" + COMIDA[id] + " vida"}><Icono item={id} /><span>{inv[id]}</span><small>{NOMBRES[id]} +{COMIDA[id]}❤️</small></button>))}</div></>}
                    {se.length > 0 && <><h4>Semillas y cultivos (elígelos y toca tierra labrada)</h4><div className="m3d-celdas">{se.map((id) => celda(id, true))}</div></>}
                    <h4>Bloques (toca uno para elegirlo)</h4><div className="m3d-celdas">{bl.length ? bl.map((id) => celda(id, true)) : <span style={{ opacity: .7 }}>Aún no tienes bloques: pica el suelo.</span>}</div>
                    {ma.length > 0 && <><h4>Materiales</h4><div className="m3d-celdas">{ma.map((id) => celda(id, false))}</div></>}
                    <div style={{ marginTop: 10, color: "#cbd5e1", fontSize: 11 }}>Pica con pico para sacar minerales y fúndelos en el horno. Come (tecla R) para recuperar vida. Con armadura los monstruos te hacen menos daño. Esquila ovejas, recoge huevos y ordeña vacas con la tecla E. Fabrica herramientas mejores para picar más rápido.</div>
                  </>);
                })() : pestana === "mercado" ? <PanelMercado inv={inv} visitando={visitando} restante={restanteMercado} alVender={vender} /> : pestana === "horno" ? <PanelHorno inv={inv} visitando={visitando} alFundir={fundir} /> : <ListaRecetas inv={inv} visitando={visitando} alFabricar={fabricar} />}
                <button onClick={() => abrirMochila(false)} style={{ marginTop: 10, width: "100%", border: 0, borderRadius: 8, padding: 7, background: "#7c3aed", color: "#fff", fontWeight: 800 }}>Cerrar</button>
              </div>
            )}
            {ajustes && (
              <div className="m3d-ajustes" role="dialog" aria-label="Ajustes de cámara">
                <b>Cámara</b>
                <div className="m3d-seg">{MODOS_CAM.map((n, i) => <button key={n} className={cam.modo === i ? "on" : ""} onClick={() => setCam((c) => ({ ...c, modo: i }))}>{n}</button>)}</div>
                <label>Distancia: {cam.dist.toFixed(1)}<input type="range" min="2" max="9" step="0.5" value={cam.dist} onChange={(e) => setCam((c) => ({ ...c, dist: +e.target.value }))} /></label>
                <label>Campo de visión: {cam.fov}°<input type="range" min="55" max="100" step="1" value={cam.fov} onChange={(e) => setCam((c) => ({ ...c, fov: +e.target.value }))} /></label>
                <label>Sensibilidad del giro: {cam.sens.toFixed(1)}×<input type="range" min="0.4" max="2.5" step="0.1" value={cam.sens} onChange={(e) => setCam((c) => ({ ...c, sens: +e.target.value }))} /></label>
                {esTactil && <><b style={{ marginTop: 8, display: "block" }}>Botones PICAR / PONER</b><div className="m3d-seg"><button className={!botonesPP ? "on" : ""} onClick={() => setBotonesPP(false)}>Como Minecraft (solo tocar)</button><button className={botonesPP ? "on" : ""} onClick={() => setBotonesPP(true)}>Mostrar botones</button></div><div style={{ color: "#cbd5e1", marginTop: 3 }}>Tocar = poner o usar · mantener el dedo = picar o golpear.</div></>}
                <b style={{ marginTop: 8, display: "block" }}>Control de la palanca</b>
                <div className="m3d-seg"><button className={giro ? "on" : ""} onClick={() => setGiro(true)}>🖐 Una mano (gira)</button><button className={!giro ? "on" : ""} onClick={() => setGiro(false)}>↔ Libre (de lado)</button></div>
                <div style={{ color: "#cbd5e1", marginTop: 3 }}>Una mano: la palanca avanza y, hacia los lados, gira la mirada.</div>
                {esTactil && <><b style={{ marginTop: 8, display: "block" }}>Pantalla del celular</b><div className="m3d-seg"><button className={ori === "h" ? "on" : ""} onClick={() => cambiarOri("h")}>↔ Horizontal</button><button className={ori === "v" ? "on" : ""} onClick={() => cambiarOri("v")}>↕ Vertical</button><button className={ori === "libre" ? "on" : ""} onClick={() => cambiarOri("libre")}>Libre</button></div></>}
                <b style={{ marginTop: 8, display: "block" }}>Sonido</b>
                <label>Volumen: {Math.round(snd.volumen * 100)}%<input type="range" min="0" max="1" step="0.05" value={snd.volumen} onChange={(e) => setSnd((c) => ({ ...c, volumen: +e.target.value }))} /></label>
                <div className="m3d-seg"><button className={!snd.silencio ? "on" : ""} onClick={() => setSnd((c) => ({ ...c, silencio: false }))}>🔊 Con sonido</button><button className={snd.silencio ? "on" : ""} onClick={() => setSnd((c) => ({ ...c, silencio: true }))}>🔇 Silencio</button></div>
                <div className="m3d-seg" style={{ marginTop: 4 }}><button className={snd.musica ? "on" : ""} onClick={() => setSnd((c) => ({ ...c, musica: true }))}>🎵 Música</button><button className={!snd.musica ? "on" : ""} onClick={() => setSnd((c) => ({ ...c, musica: false }))}>Sin música</button></div>
                <label>Calidad<div className="m3d-seg"><button className={calidadAlta ? "on" : ""} onClick={() => { setCalidadAlta(true); ctl.current && ctl.current.setCalidad(true); }}>Alta</button><button className={!calidadAlta ? "on" : ""} onClick={() => { setCalidadAlta(false); ctl.current && ctl.current.setCalidad(false); }}>Baja</button></div></label>
                <div style={{ marginTop: 8, color: "#cbd5e1" }}>Tecla V: cambia de cámara. «De frente» te deja ver tu avatar.</div>
                <button onClick={() => abrirAjustes(false)} style={{ marginTop: 8, width: "100%", border: 0, borderRadius: 8, padding: 6, background: "#7c3aed", color: "#fff", fontWeight: 800 }}>Listo</button>
              </div>
            )}
            {ampliado && (
              <>
                <div className="m3d-hud">{zona && <span>📍 {zona}</span>}{conectados > 0 && <span>👥 {conectados + 1} conectados</span>}{vida != null && <span title="Vida" style={{ background: `linear-gradient(90deg,#dc2626 ${vida}%,#000a ${vida}%)`, minWidth: 92, textAlign: "center" }}>❤️ {vida}</span>}{prog.xp != null && <span>⭐ {prog.xp} · 🪙 {prog.oro}</span>}{datos.duelos.insignias.map((k) => { const z = ZONAS.find((x) => x.key === k); return z ? <span key={k} title={z.insignia.nombre}>{z.insignia.emoji}</span> : null; })}</div>
                {esTactil && ori === "h" && vertical && <div className="m3d-aviso" style={{ top: 50, background: "#4c1d95ee" }} role="status">↻ Gira el celular en horizontal para jugar mejor (o elige Vertical en ⚙️)</div>}
                {msg && <div className="m3d-aviso" role="status">{msg}</div>}
                <div className="m3d-hot">{barraBloques}</div>
              </>
            )}
          </>
        )}
        {batalla && <PanelBatalla est={est} inicial={batalla} capsulas={inv[120] || 0} alFin={finBatalla} alInv={refrescarInv} />}
        {colec && <PanelColeccion est={est} cerrar={() => abrirColec(false)} />}
        <PanelAldea dialogo={dialogo} datos={datos} estado={estado} est={est} alHecha={alHecha} alHechoAcertijo={alHechoAcertijo} alInsignia={alInsignia} alDerrota={alDerrota} alFallo={alFallo} cerrar={cerrarDialogo} />
      </div>
      {entrado && !listo && !velo && <p className="text-xs text-slate-400">Preparando el mundo…</p>}

      {!ampliado && <div className="flex flex-wrap gap-1.5" role="group" aria-label="Bloques">{barraBloques}</div>}
      <p className="text-[11px] text-slate-500">Mover: W A S D (doble W o Ctrl: correr) · Mirar: ratón · Saltar: espacio · Shift: agacharse · Clic izquierdo mantenido: picar o golpear · Clic derecho: poner, hablar con un personaje (❗ misión, ⚔️ duelo con el guardián), usar la mesa o comer · Rueda o 1 a 9: elegir bloque · E: inventario y fabricación · T: chat · V: cambiar de cámara · Esc: soltar el ratón. Con «⛶ Ampliar» juegas a pantalla completa y con ⚙️ ajustas la cámara. En celular o tablet (como Minecraft): palanca a la izquierda, arrastra a la derecha para mirar, toca para poner o usar, mantén el dedo para picar, y los botones ⬆ saltar, 🧎 agacharse y 🎒 inventario. Entra a los edificios de la aldea y habla con sus aldeanos: la Biblioteca, el Ágora, el Templo, el Mercado, la Casa de los Acertijos y la Posada. Los portales 🌀 a otros cursos están en el Cruce de los Mundos, lejos de la aldea: sigue el camino de adoquín hacia el sureste (allí solo se mira).</p>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-xs font-extrabold text-slate-700 mb-2">🔨 Taller · usa 🎒 Mochila dentro del juego (tecla I)</div>
          <div className="text-[11px] text-slate-500">Pica troncos, piedra y minerales para conseguir materiales. Con 2 tablones haces 4 palos y con palos y tablones, tu primer pico. Después mejora a piedra, hierro y diamante.</div>
          <div style={{ background: "#111827", color: "#fff", borderRadius: 10, padding: "4px 10px", marginTop: 8, maxHeight: 260, overflow: "auto" }} className="m3d-inv-lista"><style>{CSS_ENTRADA}</style><ListaRecetas inv={inv} visitando={visitando} alFabricar={fabricar} /></div>
        </div>
        <div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-600">
          <div className="text-xs font-extrabold text-slate-700 mb-2">🧱 Tu construcción</div>
          <div>Bloques que has puesto: <b>{colocados}</b> (máximo {limite}){!abierto && <b> · 🔒 construcción cerrada por tu docente</b>}</div>
          <div className="text-[11px] text-slate-500 mt-1">Solo tú (y tu docente) pueden quitar lo que construyes. La plaza está protegida. Pica bloques para conseguir materiales.</div>
          <button onClick={cambiarCalidad} className="mt-2 text-xs font-bold rounded-lg px-3 py-1.5 border border-slate-300 text-slate-700">Calidad: {calidadAlta ? "alta" : "baja"}</button>
        </div>
      </div>
    </div>
  );
}
