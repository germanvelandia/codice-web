import React, { useEffect, useMemo, useRef, useState } from "react";
import { iniciarMundo3D, dibujarIcono, COLOCABLES, NOMBRES, RECETAS } from "../game3d/mundo3d";
import * as api from "../lib/mundo3dApi";
import * as mundoApi from "../lib/mundoApi";
import PanelAldea from "./Mundo3DAldea";

// Mundo 3D del estudiante: un mundo de construcción por grado, con portales para visitar otros grados
// y una aldea viva (misiones, acertijos y posada del Mundo 2D, ahora con personajes que se visitan caminando).
function Icono({ item }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) dibujarIcono(ref.current, item); }, [item]);
  return <canvas ref={ref} width={16} height={16} style={{ width: 30, height: 30, imageRendering: "pixelated" }} />;
}

export default function Mundo3D({ estudianteInfo }) {
  const est = estudianteInfo?.id;
  const miGrado = String(estudianteInfo?.grado_id ?? "");
  const host = useRef(null), ctl = useRef(null), invRef = useRef({}), selRef = useRef(1), ultCambio = useRef(null);
  const [inv, setInv] = useState({});
  const [sel, setSel] = useState(1);
  const [grados, setGrados] = useState(null);
  const [gradoVer, setGradoVer] = useState(miGrado);
  const [zona, setZona] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [colocados, setColocados] = useState(0);
  const [calidadAlta, setCalidadAlta] = useState(true);
  const [listo, setListo] = useState(false);
  const reloj = useRef(null);
  const [datos, setDatos] = useState({ misiones: [], hechas: new Set(), acertijos: null, posada: null, cargado: false });
  const [dialogo, setDialogo] = useState(null);
  const [prog, setProg] = useState({ xp: null, oro: null });
  const npcsRef = useRef([]);
  const avisar = (t) => { setMsg(t); clearTimeout(reloj.current); reloj.current = setTimeout(() => setMsg(""), 3500); };
  useEffect(() => () => clearTimeout(reloj.current), []);

  const fijarInv = (nuevo) => { invRef.current = nuevo; setInv(nuevo); };
  const visitando = gradoVer !== miGrado;

  // estado propio y lista de grados
  useEffect(() => {
    if (!est) return; let vivo = true;
    (async () => {
      try {
        const [e, g] = await Promise.all([api.fetchEstadoMundo3D(est), api.fetchGradosMundo3D(est)]);
        if (!vivo) return;
        fijarInv(Object.fromEntries(Object.entries(e.inventario || {}).map(([k, v]) => [Number(k), v])));
        setColocados(e.colocados || 0); setGrados(g);
        if (!gradoVer && e.grado_id) setGradoVer(String(e.grado_id));
      } catch (er) { if (vivo) setError(er.message || "No se pudo abrir el Mundo 3D."); }
    })();
    return () => { vivo = false; };
  }, [est]); // eslint-disable-line

  // misiones, acertijos y posada (los mismos del Mundo 2D)
  useEffect(() => {
    if (!est) return; let vivo = true;
    (async () => {
      const [m, h, a, p] = await Promise.allSettled([mundoApi.fetchMisionesMundo(miGrado || null), mundoApi.fetchHechasMundo(est), mundoApi.fetchAcertijosMundo(est, miGrado || null), mundoApi.fetchPosadaMundo()]);
      if (!vivo) return;
      setDatos({ misiones: m.status === "fulfilled" ? m.value : [], hechas: new Set(h.status === "fulfilled" ? h.value : []), acertijos: a.status === "fulfilled" ? a.value : null, posada: p.status === "fulfilled" ? p.value : null, cargado: true });
    })();
    return () => { vivo = false; };
  }, [est, miGrado]);

  // personajes: uno por cada (lugar, nombre) con sus misiones; más el maestro de acertijos y el posadero
  const npcs = useMemo(() => {
    if (gradoVer !== miGrado) return []; // de visita no se habla con nadie
    const grupos = new Map();
    for (const m of datos.misiones) { const k = m.lugar + "|" + m.npc_nombre; if (!grupos.has(k)) grupos.set(k, { id: "m-" + k, tipo: "misiones", nombre: m.npc_nombre, emoji: m.npc_emoji || "🧑", lugar: m.lugar, misiones: [] }); grupos.get(k).misiones.push(m); }
    const lista = [...grupos.values()].map((n) => ({ ...n, hecha: n.misiones.every((m) => datos.hechas.has(m.id)) }));
    const ac = datos.acertijos;
    if (ac && ac.lista.length) lista.push({ id: "s-acertijos", tipo: "acertijos", nombre: "Maestra de acertijos", emoji: "🧩", lugar: "acertijos", marca: "🧩 ", hecha: ac.lista.every((x) => ac.hechos.includes(x.id)) });
    if (datos.posada && datos.posada.activa) lista.push({ id: "s-posada", tipo: "posada", nombre: "Posadero", emoji: "🛏️", lugar: "posada", marca: "💤 " });
    return lista;
  }, [datos, gradoVer, miGrado]);
  npcsRef.current = npcs;
  useEffect(() => { if (ctl.current) ctl.current.actualizarNpcs(npcs); }, [npcs, listo]);
  const cerrarDialogo = () => { setDialogo(null); ctl.current && ctl.current.pausar(false); };
  const alHecha = (id, r) => { setDatos((d) => ({ ...d, hechas: new Set([...d.hechas, id]) })); if (r && typeof r.xp === "number") setProg({ xp: r.xp, oro: r.oro }); };
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
    if (!est || !grados || !gradoVer || !host.current) return;
    let vivo = true; let relojPoll = null; let c = null; setListo(false);
    (async () => {
      try {
        const filas = await api.fetchCambiosMundo3D(est, gradoVer);
        if (!vivo) return;
        ultCambio.current = filas.length ? filas[filas.length - 1].actualizado : null;
        host.current.innerHTML = "";
        c = iniciarMundo3D(host.current, {
          grado: gradoVer, yo: est, soloMirar: gradoVer !== miGrado, portales, cambios: filas, npcs: npcsRef.current,
          alNpc: (n) => setDialogo(n),
          cantidad: (i) => invRef.current[i] || 0,
          picar: async (x, y, z, b) => { const r = await api.picarMundo3D(est, x, y, z, b); if (r && r.item) fijarInv({ ...invRef.current, [r.item]: Math.min(999, (invRef.current[r.item] || 0) + 1) }); setColocados((n) => n); return r; },
          poner: async (x, y, z, i) => { const r = await api.ponerMundo3D(est, x, y, z, i); fijarInv({ ...invRef.current, [i]: r.cantidad }); setColocados((n) => n + 1); return r; },
          alSeleccion: (i) => { selRef.current = i; setSel(i); },
          alZona: setZona, alError: (t) => avisar(t),
          alPortal: (id) => { avisar("Viajando al mundo de " + (String(id) === miGrado ? "tu curso" : "curso " + id) + "…"); setGradoVer(String(id)); },
        });
        c.seleccionar(selRef.current); ctl.current = c; setListo(true);
        // ver lo que construyen los compañeros mientras juegas
        relojPoll = setInterval(async () => {
          if (document.hidden) return;
          try {
            const nuevas = await api.fetchCambiosMundo3D(est, gradoVer, ultCambio.current);
            if (nuevas.length && ctl.current === c) { ultCambio.current = nuevas[nuevas.length - 1].actualizado; c.aplicar(nuevas); }
          } catch (_) { /* se reintenta en el siguiente ciclo */ }
        }, 8000);
      } catch (er) { if (vivo) setError(er.message || "No se pudo cargar el mundo."); }
    })();
    return () => { vivo = false; clearInterval(relojPoll); if (c) c.cerrar(); if (ctl.current === c) ctl.current = null; };
  }, [est, grados, gradoVer]); // eslint-disable-line

  const elegir = (i) => { setSel(i); selRef.current = i; ctl.current && ctl.current.seleccionar(i); };
  const fabricar = async (r) => {
    try { const res = await api.fabricarMundo3D(est, r.sale); fijarInv(Object.fromEntries(Object.entries(res.inventario || {}).map(([k, v]) => [Number(k), v]))); avisar("Fabricaste " + r.n + " de " + NOMBRES[r.sale].toLowerCase() + "."); }
    catch (er) { avisar(/sin_material/.test(er.message) ? "No tienes suficiente material." : /demasiado_rapido/.test(er.message) ? "Vas muy rápido." : "No se pudo fabricar."); }
  };
  const cambiarCalidad = () => { const v = !calidadAlta; setCalidadAlta(v); ctl.current && ctl.current.setCalidad(v); };

  if (!est) return <p className="text-sm text-slate-400">Entra con tu código para abrir el Mundo 3D.</p>;
  if (error) return <div className="text-sm text-rose-600 bg-rose-50 rounded-xl p-3">{error} Si es la primera vez, la docente debe ejecutar el archivo 133_mundo3d.sql en Supabase.</div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-extrabold text-slate-800">🧊 Mundo 3D · {visitando ? "Visitando el curso " + gradoVer : "Mi curso " + gradoVer}</span>
        {prog.xp != null && <span className="text-[11px] font-bold rounded-full px-2.5 py-0.5 bg-amber-100 text-amber-700">⭐ {prog.xp} XP · 🪙 {prog.oro}</span>}
        {zona && <span className="text-[11px] font-bold rounded-full px-2.5 py-0.5 bg-emerald-100 text-emerald-700">📍 {zona}</span>}
        {visitando && <><span className="text-[11px] font-bold rounded-full px-2.5 py-0.5 bg-amber-100 text-amber-700">👀 Solo mirar</span>
          <button onClick={() => setGradoVer(miGrado)} className="text-[11px] font-bold text-violet-600 hover:underline">← Volver a mi mundo</button></>}
        {msg && <span className="ml-auto text-[12px] font-semibold text-rose-600" role="status">{msg}</span>}
      </div>

      <div className="relative">
        <div ref={host} style={{ minHeight: 120 }} />
        <PanelAldea dialogo={dialogo} datos={datos} est={est} alHecha={alHecha} alHechoAcertijo={alHechoAcertijo} cerrar={cerrarDialogo} />
      </div>
      {!listo && <p className="text-xs text-slate-400">Preparando el mundo…</p>}

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Bloques">
        {COLOCABLES.map((id, i) => (
          <button key={id} onClick={() => elegir(id)} aria-pressed={sel === id} aria-label={NOMBRES[id] + " (tecla " + (i + 1) + ")"}
            className={`w-[52px] h-[56px] rounded-lg border-2 flex flex-col items-center pt-1 text-[11px] font-bold ${sel === id ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white"} ${(inv[id] || 0) === 0 ? "opacity-50" : ""}`}>
            <Icono item={id} /><span className="text-slate-600">{inv[id] || 0}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-500">Mover: W A S D · Mirar: ratón · Saltar: espacio · Clic izquierdo mantenido: picar · Clic derecho: poner · Rueda o 1 a 8: elegir bloque · E: hablar con un personaje (❗ tiene misión) · Esc: soltar el ratón. En tablet: palanca a la izquierda, arrastra a la derecha para mirar. Entra a los edificios de la aldea: la Biblioteca, el Ágora, el Templo, el Mercado, la Casa de los Acertijos y la Posada. Los portales 🌀 de la plaza llevan a otros cursos (allí solo se mira).</p>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-xs font-extrabold text-slate-700 mb-2">🔨 Taller</div>
          {RECETAS.map((r) => {
            const puede = Object.entries(r.cuesta).every(([k, v]) => (inv[k] || 0) >= v);
            return (
              <div key={r.sale} className="flex items-center justify-between gap-2 py-1.5 border-t border-slate-100 first:border-0">
                <div><div className="text-sm font-semibold text-slate-800">{NOMBRES[r.sale]} ×{r.n}</div><div className="text-[11px] text-slate-500">{r.txt}</div></div>
                <button disabled={!puede || visitando} onClick={() => fabricar(r)} className="text-xs font-bold rounded-lg px-3 py-1.5 bg-violet-600 text-white disabled:opacity-40">Fabricar</button>
              </div>
            );
          })}
        </div>
        <div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-600">
          <div className="text-xs font-extrabold text-slate-700 mb-2">🧱 Tu construcción</div>
          <div>Bloques que has puesto: <b>{colocados}</b> (máximo 4000)</div>
          <div className="text-[11px] text-slate-500 mt-1">Solo tú (y tu docente) pueden quitar lo que construyes. La plaza está protegida. Pica bloques para conseguir materiales.</div>
          <button onClick={cambiarCalidad} className="mt-2 text-xs font-bold rounded-lg px-3 py-1.5 border border-slate-300 text-slate-700">Calidad: {calidadAlta ? "alta" : "baja"}</button>
        </div>
      </div>
    </div>
  );
}
