import React, { useCallback, useEffect, useRef, useState } from "react";
import { iniciarMundo3D, CENTRO, CRUCE } from "../game3d/mundo3d";
import * as api from "../lib/mundo3dApi";

// Panel del docente para el Mundo 3D: ver lo que construye cada estudiante, moderar (con deshacer),
// programar el curso (abrir/cerrar la construcción y el límite de bloques) y observar el mundo volando.
// Todo pasa por funciones del servidor que exigen sesión de docente: un estudiante no puede usarlas.

const CSS_OBS = `
.obs-root{position:fixed;inset:0;z-index:80;background:#000}
.obs-root .m3d{height:100vh;height:100dvh;border-radius:0}.obs-root .m3d canvas{height:100%;aspect-ratio:auto}
.obs-barra{position:absolute;top:8px;left:8px;right:8px;z-index:30;display:flex;gap:6px;flex-wrap:wrap;align-items:center;pointer-events:none}
.obs-barra>*{pointer-events:auto}
.obs-barra button,.obs-barra select{border:1px solid #fff6;background:#000b;color:#fff;border-radius:10px;padding:6px 10px;font:700 12px system-ui,sans-serif;cursor:pointer}
.obs-info{position:absolute;left:50%;transform:translateX(-50%);bottom:44px;z-index:30;background:#000b;color:#fff;border-radius:10px;padding:6px 12px;font:700 13px system-ui,sans-serif;pointer-events:none;max-width:92%;text-align:center}
`;

const cuando = (t) => {
  if (!t) return "—";
  const m = Math.round((Date.now() - Date.parse(t)) / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  if (m < 60 * 24) return `hace ${Math.round(m / 60)} h`;
  return `hace ${Math.round(m / 1440)} d`;
};

function Observador({ grado, nombres, foco, cerrar }) {
  const host = useRef(null), ctl = useRef(null), ult = useRef(null);
  const [info, setInfo] = useState(null), [error, setError] = useState(""), [listo, setListo] = useState(false);
  const [conect, setConect] = useState([]);
  const nombresRef = useRef(nombres); nombresRef.current = nombres;

  useEffect(() => {
    let vivo = true, reloj = null, relojP = null, c = null;
    (async () => {
      try {
        const filas = await api.fetchCambiosDocente(grado);
        const parc = await api.fetchParcelasDocente(grado).catch(() => []);
        if (!vivo) return;
        ult.current = filas.length ? filas[filas.length - 1].actualizado : null;
        host.current.innerHTML = "";
        c = iniciarMundo3D(host.current, {
          grado, yo: 0, soloMirar: true, vuelo: true, portales: [], cambios: filas, npcs: [], camara: 0,
          cantidad: () => 0, picar: async () => {}, poner: async () => {},
          parcelas: parc, alApuntar: (i) => setInfo(i), alError: () => {}, alSeleccion: () => {},
        });
        ctl.current = c;
        // punto de partida: lo construido por el estudiante elegido, o la aldea vista desde arriba
        const mias = foco ? filas.filter((f) => f.autor_id === foco && f.bloque > 0) : [];
        if (mias.length) {
          const mx = mias.reduce((a, f) => a + f.x, 0) / mias.length, mz = mias.reduce((a, f) => a + f.z, 0) / mias.length, my = Math.max(...mias.map((f) => f.y));
          c.ir(mx + .5, my + 6, mz + 14, 0, .46);
        } else c.ir(CENTRO + .5, 28, CENTRO + 44, 0, .5);
        setListo(true);
        reloj = setInterval(async () => {
          if (document.hidden) return;
          try {
            const n = await api.fetchCambiosDocente(grado, ult.current);
            if (n.length && ctl.current === c) { ult.current = n[n.length - 1].actualizado; c.aplicar(n); }
          } catch (_) { /* se reintenta */ }
        }, 6000);
        // estudiantes conectados ahora mismo (se ven como personajes en el mundo)
        const tic = async () => { if (document.hidden) return; try { const l = await api.fetchPresenciaDocente(grado); if (ctl.current === c) { c.setOtros(l.map((p) => ({ id: p.estudiante_id, x: p.x, y: p.y, z: p.z, yaw: p.yaw, avatar: p.avatar, nombre: p.nombre }))); setConect(l); } } catch (_) { /* sin el SQL 136 no hay presencia */ } };
        tic(); relojP = setInterval(tic, 2500);
      } catch (e) { if (vivo) setError(e.message || "No se pudo cargar el mundo."); }
    })();
    return () => { vivo = false; clearInterval(reloj); clearInterval(relojP); if (c) c.cerrar(); ctl.current = null; };
  }, [grado, foco]);

  useEffect(() => { const k = (e) => { if (e.key === "Escape" && !document.pointerLockElement) cerrar(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [cerrar]);

  const ir = (lugar) => {
    const c = ctl.current; if (!c) return;
    if (lugar === "aldea") c.ir(CENTRO + .5, 28, CENTRO + 44, 0, .5);
    else if (lugar === "cruce") c.ir(CRUCE.x + .5, 24, CRUCE.z + 22, 0, .4);
    else if (lugar === "alto") c.ir(CENTRO + .5, 64, CENTRO + .5, 0, 1.45);
    else if (lugar.startsWith("est:")) { const p = conect.find((q) => String(q.estudiante_id) === lugar.slice(4)); if (p) c.ir(p.x, p.y + 4, p.z + 8, 0, .35); }
  };
  const hora = (v) => { const c = ctl.current; if (!c) return; c.setAmbiente({ hora: v === "auto" ? null : Number(v) }); };
  const clima = (v) => { const c = ctl.current; if (!c) return; c.setAmbiente({ clima: v === "auto" ? null : v }); };
  const quien = info ? (info.autor == null ? "Terreno original" : (nombresRef.current[info.autor] || "Estudiante #" + info.autor)) : "";

  return (
    <div className="obs-root m3d-full" role="dialog" aria-modal="true" aria-label={`Observando el curso ${grado}`}>
      <style>{CSS_OBS}</style>
      <div ref={host} style={{ width: "100%", height: "100%" }} />
      <div className="obs-barra">
        <button onClick={cerrar}>✕ Salir del observador</button>
        <span style={{ color: "#fff", font: "700 12px system-ui", textShadow: "0 1px 3px #000" }}>👁️ Curso {grado} · solo mirar</span>
        <select aria-label="Ir a…" defaultValue="" onChange={(e) => { ir(e.target.value); e.target.value = ""; }}>
          <option value="" disabled>Ir a…</option><option value="aldea">🏘️ La aldea</option><option value="cruce">🌀 Cruce de los Mundos</option><option value="alto">🦅 Vista desde arriba</option>
          {conect.map((p) => <option key={p.estudiante_id} value={"est:" + p.estudiante_id}>👤 {p.nombre}{p.visita ? " (visita)" : ""}</option>)}
        </select>
        <select aria-label="Hora del día" defaultValue="auto" onChange={(e) => hora(e.target.value)}><option value="auto">🕒 Hora real</option><option value="0.05">🌅 Amanecer</option><option value="0.3">☀️ Día</option><option value="0.62">🌇 Atardecer</option><option value="0.85">🌙 Noche</option></select>
        <select aria-label="Clima" defaultValue="auto" onChange={(e) => clima(e.target.value)}><option value="auto">☁️ Clima real</option><option value="despejado">☀️ Despejado</option><option value="lluvia">🌧️ Lluvia</option></select>
        <span style={{ color: "#fff", font: "700 12px system-ui", textShadow: "0 1px 3px #000" }}>👥 {conect.length} conectado{conect.length === 1 ? "" : "s"}</span>
      </div>
      {info && <div className="obs-info">{info.autor == null ? "🌱 " : "🧱 "}{quien} · ({info.x}, {info.y}, {info.z})</div>}
      {!listo && !error && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff", font: "700 14px system-ui" }}>Cargando el mundo…</div>}
      {error && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fecaca", font: "700 14px system-ui", padding: 16, textAlign: "center" }}>{error}</div>}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 30, textAlign: "center", color: "#fff", font: "11px system-ui", textShadow: "0 1px 3px #000", pointerEvents: "none" }}>
        Clic para mirar · W A S D: volar hacia donde miras · Espacio: subir · Mayús: bajar · Ctrl: más rápido · Esc: soltar el ratón
      </div>
    </div>
  );
}

export default function Mundo3DDocente() {
  const [grados, setGrados] = useState(null), [grado, setGrado] = useState("");
  const [filas, setFilas] = useState(null), [aj, setAj] = useState({ construir: true, limite: 4000, presencia: true, chat: true }), [conectados, setConectados] = useState([]), [hist, setHist] = useState([]);
  const [msg, setMsg] = useState(""), [err, setErr] = useState(""), [ocupado, setOcupado] = useState(false);
  const [confirma, setConfirma] = useState(null); // { autor, desde, texto }
  const [obs, setObs] = useState(null);           // { foco }

  const cargarGrados = useCallback(async () => {
    try { const g = await api.fetchGradosDocente(); setGrados(g); setGrado((a) => a || g[0] || ""); } catch (e) { setErr(e.message || "No se pudieron cargar los cursos."); setGrados([]); }
  }, []);
  useEffect(() => { cargarGrados(); }, [cargarGrados]);

  const cargar = useCallback(async () => {
    if (!grado) return; setErr(""); setFilas(null);
    try {
      const [r, a, h] = await Promise.all([api.fetchResumenMundo3D(grado), api.fetchAjustesMundo3D(grado), api.fetchHistorialMundo3D(grado)]);
      setFilas(r); setAj({ construir: a.construir !== false, limite: a.limite ?? 4000, presencia: a.presencia !== false, chat: a.chat !== false, monstruos: a.monstruos !== false, danio_error: a.danio_error ?? 5 }); setHist(h);
    } catch (e) { setErr(e.message || "No se pudo cargar el curso."); setFilas([]); }
  }, [grado]);
  useEffect(() => { cargar(); setConfirma(null); setMsg(""); }, [cargar]);

  // quiénes están conectados ahora (cada 5 s mientras se mira el panel)
  useEffect(() => {
    if (!grado || obs) return undefined; let vivo = true;
    const tic = async () => { if (document.hidden) return; try { const l = await api.fetchPresenciaDocente(grado); if (vivo) setConectados(l); } catch (_) { if (vivo) setConectados([]); } };
    tic(); const r = setInterval(tic, 5000); return () => { vivo = false; clearInterval(r); };
  }, [grado, obs]);
  const nombres = {}; (filas || []).forEach((f) => { nombres[f.estudiante_id] = f.nombre; });
  const total = (filas || []).reduce((a, f) => a + Number(f.colocados || 0), 0);

  const guardarAj = async () => {
    setOcupado(true); setErr(""); setMsg("");
    try { const r = await api.guardarAjustesMundo3D(grado, aj.construir, aj.limite); await api.fijarPresenciaMundo3D(grado, aj.presencia !== false); await api.fijarChatMundo3D(grado, aj.chat !== false); try { await api.fijarVidaMundo3D(grado, aj.monstruos !== false, aj.danio_error ?? 5); } catch (_) { /* sin SQL 141 */ } setAj({ construir: r.construir, limite: r.limite, presencia: aj.presencia !== false, chat: aj.chat !== false, monstruos: aj.monstruos !== false, danio_error: aj.danio_error ?? 5 }); setMsg(r.construir ? "Guardado: la construcción está abierta." : "Guardado: la construcción está cerrada (los estudiantes pueden explorar)."); cargar(); }
    catch (e) { setErr(e.message || "No se pudo guardar."); } setOcupado(false);
  };
  const revertir = async () => {
    const c = confirma; if (!c) return; setOcupado(true); setErr(""); setMsg("");
    try { const r = await api.revertirMundo3D(grado, c.autor, c.desde); setMsg(r.cantidad ? `Se deshicieron ${r.cantidad} cambios. Puedes recuperarlos desde el historial.` : "No había cambios para deshacer."); setConfirma(null); cargar(); }
    catch (e) { setErr(e.message || "No se pudo revertir."); } setOcupado(false);
  };
  const deshacer = async (lote) => {
    setOcupado(true); setErr(""); setMsg("");
    try { const n = await api.deshacerReversionMundo3D(lote); setMsg(n ? `Se recuperaron ${n} cambios.` : "No se recuperó nada (esas casillas ya estaban ocupadas o la papelera se vació)."); cargar(); }
    catch (e) { setErr(e.message || "No se pudo deshacer."); } setOcupado(false);
  };
  const hace = (h) => new Date(Date.now() - h * 3600000).toISOString();

  if (obs) return <Observador grado={grado} nombres={nombres} foco={obs.foco} cerrar={() => setObs(null)} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-extrabold">🧊 Mundo 3D</h2>
        <select value={grado} onChange={(e) => setGrado(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-bold" aria-label="Curso">
          {(grados || []).map((g) => <option key={g} value={g}>Curso {g}</option>)}
        </select>
        <button onClick={cargar} className="rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-sm font-bold">↻ Actualizar</button>
        <button onClick={() => setObs({ foco: null })} disabled={!grado} className="rounded-lg bg-violet-600 text-white px-3 py-1.5 text-sm font-bold disabled:opacity-50">👁️ Observar el mundo</button>
      </div>
      {grados && !grados.length && <p className="text-sm text-slate-500">Todavía no hay cursos con estudiantes activos.</p>}
      {err && <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm p-2.5">{err}</div>}
      {msg && <div role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm p-2.5">{msg}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
        <h3 className="font-extrabold text-sm">⚙️ Programar el curso {grado}</h3>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={aj.construir} onChange={(e) => setAj((a) => ({ ...a, construir: e.target.checked }))} /> Construcción abierta (si la cierras, los estudiantes solo exploran)
        </label>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={aj.presencia !== false} onChange={(e) => setAj((a) => ({ ...a, presencia: e.target.checked }))} /> Presencia: que los estudiantes se vean entre sí (solo el primer nombre)
        </label>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={aj.chat !== false} onChange={(e) => setAj((a) => ({ ...a, chat: e.target.checked }))} /> Chat rápido (solo frases predeterminadas, sin texto libre)
        </label>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={aj.monstruos !== false} onChange={(e) => setAj((a) => ({ ...a, monstruos: e.target.checked }))} /> Monstruos: aparecen fuera de la aldea y le quitan vida al personaje (se combaten con las herramientas)
        </label>
        <label className="flex items-center gap-2 text-sm font-bold">Vida que se pierde por respuesta equivocada (0 a 20)
          <input type="number" min="0" max="20" value={aj.danio_error ?? 5} onChange={(e) => setAj((a) => ({ ...a, danio_error: e.target.value }))} className="w-20 rounded-lg border border-slate-300 px-2 py-1" />
        </label>
        <label className="flex items-center gap-2 text-sm font-bold">Límite de bloques por estudiante
          <input type="number" min="0" max="20000" value={aj.limite} onChange={(e) => setAj((a) => ({ ...a, limite: e.target.value }))} className="w-24 rounded-lg border border-slate-300 px-2 py-1" />
        </label>
        <button onClick={guardarAj} disabled={ocupado || !grado} className="rounded-lg bg-violet-600 text-white px-3 py-1.5 text-sm font-bold disabled:opacity-50">Guardar</button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3" aria-live="polite">
        <h3 className="font-extrabold text-sm mb-1">🟢 Conectados ahora ({conectados.length})</h3>
        {conectados.length ? <div className="flex flex-wrap gap-1.5">{conectados.map((p) => <span key={p.estudiante_id} className="rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-2.5 py-0.5">{p.nombre}{p.visita ? " · visita" : ""}</span>)}</div> : <p className="text-xs text-slate-500">Nadie conectado en este momento en el curso {grado}.</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h3 className="font-extrabold text-sm flex-1">🧱 Lo que han construido ({total} bloques)</h3>
          <button onClick={() => setConfirma({ autor: null, desde: hace(1), texto: "todo lo hecho en la última hora por todo el curso" })} className="rounded-lg bg-amber-100 hover:bg-amber-200 px-2.5 py-1 text-xs font-bold">Deshacer última hora</button>
          <button onClick={() => setConfirma({ autor: null, desde: null, texto: "TODO lo construido por todo el curso" })} className="rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 px-2.5 py-1 text-xs font-bold">Reiniciar el curso</button>
        </div>
        {filas === null ? <p className="text-sm text-slate-500">Cargando…</p> : !filas.length ? <p className="text-sm text-slate-500">No hay estudiantes en este curso.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Estudiante</th><th>Puestos</th><th>Quitados</th><th>Último cambio</th><th /></tr></thead>
            <tbody>{filas.map((f) => (
              <tr key={f.estudiante_id} className="border-t border-slate-100">
                <td className="py-1.5 font-semibold">{f.nombre}</td><td>{f.colocados}</td><td>{f.quitados}</td><td className="text-slate-500">{cuando(f.ultimo)}</td>
                <td className="text-right whitespace-nowrap">
                  <button onClick={() => setObs({ foco: f.estudiante_id })} disabled={!Number(f.colocados)} className="rounded-md bg-violet-100 hover:bg-violet-200 text-violet-700 px-2 py-0.5 text-xs font-bold mr-1 disabled:opacity-40">Ver</button>
                  <button onClick={() => setConfirma({ autor: f.estudiante_id, desde: null, texto: `todo lo construido por ${f.nombre}` })} disabled={!Number(f.colocados) && !Number(f.quitados)} className="rounded-md bg-rose-100 hover:bg-rose-200 text-rose-700 px-2 py-0.5 text-xs font-bold disabled:opacity-40">Revertir</button>
                </td>
              </tr>))}</tbody>
          </table></div>
        )}
        {confirma && (
          <div role="alertdialog" aria-label="Confirmar" className="mt-3 rounded-xl border-2 border-rose-300 bg-rose-50 p-3 text-sm">
            <p className="font-bold">¿Deshacer {confirma.texto} en el curso {grado}?</p>
            <p className="text-xs text-slate-600">Se guarda en el historial y podrás recuperarlo con «Deshacer».</p>
            <div className="mt-2 flex gap-2">
              <button onClick={revertir} disabled={ocupado} className="rounded-lg bg-rose-600 text-white px-3 py-1.5 font-bold disabled:opacity-50">Sí, deshacer</button>
              <button onClick={() => setConfirma(null)} className="rounded-lg bg-white border border-slate-300 px-3 py-1.5 font-bold">Cancelar</button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3">
        <h3 className="font-extrabold text-sm mb-2">🕘 Historial</h3>
        {!hist.length ? <p className="text-sm text-slate-500">Aún no hay acciones registradas.</p> : (
          <ul className="space-y-1 text-sm">{hist.map((h) => (
            <li key={h.id} className="flex items-center gap-2">
              <span className="text-slate-500 w-24 shrink-0">{cuando(h.ts)}</span>
              <span className="flex-1">{h.accion === "revertir" ? `Revertir ${h.autor_id ? "a " + (nombres[h.autor_id] || "#" + h.autor_id) : "al curso"}: ${h.cantidad} cambios` : h.accion === "deshacer" ? `Recuperó ${h.cantidad} cambios` : `Ajustes del curso (límite ${h.cantidad})`}</span>
              {h.deshacible && <button onClick={() => deshacer(h.lote)} disabled={ocupado} className="rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-2 py-0.5 text-xs font-bold">↩ Deshacer</button>}
            </li>))}</ul>
        )}
      </section>
    </div>
  );
}
