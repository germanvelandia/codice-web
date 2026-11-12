import React, { useEffect, useMemo, useState } from "react";
import * as api from "../lib/api";
import { CONFIG_DEFAULT, periodosDe } from "../lib/calificaciones";

// Separa "Apellidos" y "Nombres" de un estudiante. Usa el apellido guardado si existe;
// si no, asume que las últimas 2 palabras son los apellidos (patrón común en Colombia).
function separarNombre(e) {
  if (e.apellidos && e.apellidos.trim()) return { ap: e.apellidos.trim(), nom: (e.nombre || "").trim() };
  const p = (e.nombre || "").trim().split(/\s+/).filter(Boolean);
  if (p.length <= 1) return { ap: "", nom: p.join(" ") };
  if (p.length === 2) return { ap: p[1], nom: p[0] };
  return { ap: p.slice(-2).join(" "), nom: p.slice(0, -2).join(" ") };
}
const r2 = (n) => (n === null || n === undefined || Number.isNaN(Number(n)) ? null : Math.round(Number(n) * 100) / 100);
const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");


const INSTITUCION_DEFAULT = "Colegio Alfonso López Michelsen I.E.D.";
const DOCENTE_DEFAULT = "Germán Andrés Velandia Daza";
const leerLS = (k, def) => { try { return localStorage.getItem(k) || def; } catch (_) { return def; } };
const guardarLS = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* opcional */ } };
const hoyISO = () => new Date().toISOString().slice(0, 10);
const fmtFecha = (d) => { if (!d) return ""; const [y, m, dd] = String(d).slice(0, 10).split("-"); return `${dd}/${m}`; };

// ---------- Hoja de nivelación: asistencia + actividades con peso + % total + nota automática ----------
const totalPonderado = (acts, res, estId) => {
  const W = acts.reduce((t, a) => t + (Number(a.peso) || 0), 0);
  if (!W) return null;
  const suma = acts.reduce((t, a) => t + (Number(a.peso) || 0) * (res[`${a.id}:${estId}`] ?? 0), 0);
  return Math.round((suma / W) * 10) / 10;
};

function SeguimientoNivelacion({ materiaId, gradoId, periodo, materia, nombreCurso, lista, cargar, setError, grados = [] }) {
  const [plan, setPlan] = useState({ actividad: "", instrucciones: "", fecha_limite: "", porcentaje_minimo: 60, nota_aprobada: 3.5 });
  const [acts, setActs] = useState([]);        // actividades guardadas
  const [editAct, setEditAct] = useState([]);  // copia editable [{id?, nombre, peso}]
  const [res, setRes] = useState({});          // "act:est" -> logro
  const [sesiones, setSesiones] = useState([]);
  const [asis, setAsis] = useState({});
  const [nuevaFecha, setNuevaFecha] = useState(hoyISO());
  const [nuevoTema, setNuevoTema] = useState("");
  const [draft, setDraft] = useState({});
  const [ocupado, setOcupado] = useState(null);
  const [msg, setMsg] = useState("");
  const [inst, setInst] = useState(null); // datos de ⚙️ Institución (nombre, logo, año)
  const [docente, setDocente] = useState(() => leerLS("niv_docente", DOCENTE_DEFAULT));
  const [copiando, setCopiando] = useState(false);
  const [destinos, setDestinos] = useState([]);
  const [reemplazar, setReemplazar] = useState(false);

  const copiarACursos = async () => {
    if (!acts.length) { setError("Primero guarda al menos una actividad."); return; }
    if (!destinos.length) { setError("Elige al menos un curso."); return; }
    setError(""); setMsg("Copiando…");
    try {
      const inf = await api.copiarPlanNivelacion(materiaId, gradoId, periodo, destinos, { plan, actividades: acts, reemplazar });
      const nom = (g) => grados.find((x) => String(x.id) === String(g))?.nombre || g;
      const ok = inf.filter((i) => i.estado === "copiado").map((i) => nom(i.grado)), om = inf.filter((i) => i.estado === "omitido").map((i) => nom(i.grado));
      setMsg(`${ok.length ? `Copiado a: ${ok.join(", ")}. ` : ""}${om.length ? `Omitidos (ya tenían actividades): ${om.join(", ")}. Marca «reemplazar» si quieres sobrescribirlos.` : ""}`);
      setDestinos([]); setCopiando(false);
    } catch (e) { setMsg(""); setError("No se pudo copiar: " + (e.message || e)); }
  };
  const itemsAplicar = () => lista.filter((f) => totalDe(f) !== null).map((f) => ({ estudianteId: f.e.id, entregado: true, fechaEntrega: f.reg?.fecha_entrega || hoyISO(), porcentaje: totalDe(f) }));
  const aplicarOtrasMaterias = async () => {
    const items = itemsAplicar();
    if (!items.length) { setError("Aún no hay resultados para aplicar."); return; }
    setError(""); setMsg("Revisando otras materias…");
    try {
      const vista = await api.aplicarNivelacionEnOtrasMaterias(materiaId, gradoId, periodo, items, plan, { soloVista: true });
      const con = vista.filter((v) => v.estudiantes > 0);
      if (!con.length) { setMsg("Ninguno de estos estudiantes perdió otra de tus materias en este periodo."); return; }
      if (!confirm("Se aplicará este resultado (misma regla de " + plan.porcentaje_minimo + "% → nota " + plan.nota_aprobada + ") en:\n" + con.map((v) => `• ${v.materia}: ${v.estudiantes} estudiante(s)`).join("\n") + "\n¿Continuar?")) { setMsg(""); return; }
      await api.aplicarNivelacionEnOtrasMaterias(materiaId, gradoId, periodo, items, plan);
      setMsg("Resultado aplicado en: " + con.map((v) => `${v.materia} (${v.estudiantes})`).join(", ") + ". Planillas y Boletín ya se actualizaron.");
      await cargar();
    } catch (e) { setMsg(""); setError("No se pudo aplicar: " + (e.message || e)); }
  };

  useEffect(() => { api.fetchInstitucion().then(setInst).catch(() => setInst(null)); }, []);
  const institucion = (inst?.nombre && inst.nombre !== "Institución Educativa") ? inst.nombre : INSTITUCION_DEFAULT;
  const anioDoc = inst?.anio || String(new Date().getFullYear());

  const recargar = async () => {
    try {
      const [p, s, ac] = await Promise.all([
        api.fetchPlanNivelacion(materiaId, gradoId, periodo), api.fetchSesionesNivelacion(materiaId, gradoId, periodo),
        api.fetchActividadesNivelacion(materiaId, gradoId, periodo),
      ]);
      setPlan({ ...p, fecha_limite: p.fecha_limite || "" });
      setSesiones(s.sesiones);
      const m = {}; s.asistencia.forEach((a) => { m[`${a.sesion_id}:${a.estudiante_id}`] = a.presente; });
      setAsis(m); setDraft({});
      setActs(ac.actividades); setEditAct(ac.actividades.map((a) => ({ id: a.id, nombre: a.nombre, peso: a.peso })));
      const r = {}; ac.resultados.forEach((x) => { r[`${x.actividad_id}:${x.estudiante_id}`] = Number(x.logro); });
      setRes(r);
    } catch (e) { setError("No se pudo cargar el seguimiento (¿corriste los SQL 154 y 155?): " + (e.message || e)); }
  };
  useEffect(() => { if (materiaId && gradoId && periodo) recargar(); }, [materiaId, gradoId, periodo]);

  const pesoEdit = editAct.reduce((t, a) => t + (Number(a.peso) || 0), 0);
  const nota3 = Number(plan.nota_aprobada);

  // Escribe en nivelación el total y aplica la regla de nota (3.5 si cumple).
  const aplicar = async (f, acts2, res2) => {
    const tieneAlgo = acts2.some((a) => res2[`${a.id}:${f.e.id}`] !== undefined);
    const total = tieneAlgo ? totalPonderado(acts2, res2, f.e.id) : null;
    await api.guardarSeguimientoNivelacion(materiaId, f.e.id, periodo, {
      entregado: tieneAlgo, fechaEntrega: f.reg?.fecha_entrega || hoyISO(), porcentaje: total,
      observacion: draft[f.e.id]?.obs ?? f.reg?.observacion ?? "", notaOriginal: f.original, estadoPrevio: f.reg?.estado || "", plan,
    });
  };

  const guardarPlan = async () => {
    try { await api.guardarPlanNivelacion(materiaId, gradoId, periodo, plan); setMsg("Plan guardado."); await cargar(); }
    catch (e) { setError("No se pudo guardar el plan: " + (e.message || e)); }
  };
  const guardarActs = async () => {
    const limpias = editAct.filter((a) => (a.nombre || "").trim() || Number(a.peso));
    if (Math.round(limpias.reduce((t, a) => t + (Number(a.peso) || 0), 0)) !== 100 && !confirm("Los pesos no suman 100 %. El total se calculará proporcionalmente. ¿Guardar de todos modos?")) return;
    setError(""); setMsg("Guardando…");
    try {
      const idsNuevos = new Set(limpias.filter((a) => a.id).map((a) => a.id));
      await api.guardarActividadesNivelacion(materiaId, gradoId, periodo, limpias, acts.filter((a) => !idsNuevos.has(a.id)).map((a) => a.id));
      const ac = await api.fetchActividadesNivelacion(materiaId, gradoId, periodo);
      const r = {}; ac.resultados.forEach((x) => { r[`${x.actividad_id}:${x.estudiante_id}`] = Number(x.logro); });
      // Los pesos cambiaron: se recalcula el total y la nota de todos los que ya tienen resultados.
      for (const f of lista) { if (ac.actividades.some((a) => r[`${a.id}:${f.e.id}`] !== undefined) || f.reg?.porcentaje != null) await aplicar(f, ac.actividades, r); }
      await recargar(); await cargar(); setMsg("Actividades guardadas y totales recalculados.");
    } catch (e) { setMsg(""); setError("No se pudieron guardar las actividades: " + (e.message || e)); }
  };
  const agregarSesion = async () => {
    if (!nuevaFecha) return;
    if (sesiones.some((s) => s.fecha === nuevaFecha && (s.tema || "") === nuevoTema) && !confirm("Ya hay una sesión con esa fecha. ¿Agregar otra?")) return;
    try { await api.crearSesionNivelacion(materiaId, gradoId, periodo, nuevaFecha, nuevoTema); setNuevoTema(""); await recargar(); }
    catch (e) { setError("No se pudo crear la sesión: " + (e.message || e)); }
  };
  const quitarSesion = async (s) => {
    if (!confirm(`¿Eliminar la sesión del ${fmtFecha(s.fecha)} y su asistencia?`)) return;
    try { await api.eliminarSesionNivelacion(s.id); await recargar(); } catch (e) { setError(e.message || String(e)); }
  };
  const marcar = async (s, est, v) => {
    setAsis((p) => ({ ...p, [`${s.id}:${est}`]: v }));
    try { await api.marcarAsistenciaNivelacion(s.id, est, v); } catch (e) { setError("No se pudo guardar la asistencia: " + (e.message || e)); }
  };

  const guardarCelda = async (f, a) => {
    const k = `${a.id}:${f.e.id}`;
    const txt = String(draft[k] ?? "").trim().replace(",", ".");
    const v = txt === "" ? null : parseFloat(txt);
    if (v !== null && (Number.isNaN(v) || v < 0 || v > 100)) { setError("El resultado de cada actividad va de 0 a 100 (% logrado)."); return; }
    setError(""); setOcupado(f.e.id);
    try {
      await api.guardarResultadoNivelacion(a.id, f.e.id, v);
      const res2 = { ...res }; if (v === null) delete res2[k]; else res2[k] = v;
      setRes(res2);
      await aplicar(f, acts, res2);
      setDraft((p) => { const n = { ...p }; delete n[k]; return n; });
      await cargar();
    } catch (e) { setError("No se pudo guardar: " + (e.message || e)); }
    setOcupado(null);
  };
  const guardarObs = async (f) => {
    setOcupado(f.e.id);
    try { await aplicar(f, acts, res); await cargar(); } catch (e) { setError("No se pudo guardar: " + (e.message || e)); }
    setOcupado(null);
  };

  const totalDe = (f) => (acts.some((a) => res[`${a.id}:${f.e.id}`] !== undefined) ? totalPonderado(acts, res, f.e.id) : null);
  const cumple = (f) => { const t = totalDe(f); return t !== null && t >= Number(plan.porcentaje_minimo); };
  const resumen = useMemo(() => ({ t: lista.length, ent: lista.filter((f) => totalDe(f) !== null).length, ok: lista.filter(cumple).length }), [lista, acts, res, plan.porcentaje_minimo]);
  const asistio = (s, f) => asis[`${s.id}:${f.e.id}`];
  const rotulo = (a) => `${a.nombre || "Actividad"} (${Number(a.peso) || 0}%)`;
  const titulo = acts.length ? acts.map(rotulo).join(" + ") : "(sin actividades — agrégalas arriba)";

  const cabecera = ["#", "Apellidos", "Nombres", "Nota", ...sesiones.map((s) => fmtFecha(s.fecha)), ...acts.map(rotulo), "Total %", "Nota final", "Observación"];
  const filaDatos = (f, i) => [i + 1, f.ap, f.nom, f.original ?? "",
    ...sesiones.map((s) => (asistio(s, f) === undefined ? "" : asistio(s, f) ? "✔" : "✘")),
    ...acts.map((a) => res[`${a.id}:${f.e.id}`] ?? ""), totalDe(f) ?? "", cumple(f) ? plan.nota_aprobada : (f.original ?? ""), f.reg?.observacion ?? ""];
  const descargarCSV = () => {
    const csv = "﻿" + [cabecera, ...lista.map(filaDatos)].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `nivelacion_${nombreCurso}_periodo${periodo}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const imprimir = () => {
    const w = window.open("", "_blank");
    if (!w) { setError("El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes."); return; }
    const vacias = Math.max(0, 4 - sesiones.length);
    const th = sesiones.map((s) => `<th class="v">${esc(fmtFecha(s.fecha))}${s.tema ? `<br><small>${esc(s.tema)}</small>` : ""}</th>`).join("") + Array.from({ length: vacias }, () => `<th class="v">&nbsp;</th>`).join("");
    const tha = acts.map((a) => `<th class="v">${esc(a.nombre || "Actividad")}<br><small>${esc(Number(a.peso) || 0)}%</small></th>`).join("");
    const cuerpo = lista.map((f, i) => `<tr><td class="c">${i + 1}</td><td>${esc(f.ap)}</td><td>${esc(f.nom)}</td><td class="c">${esc(f.original ?? "")}</td>` +
      sesiones.map((s) => `<td class="c">${asistio(s, f) === undefined ? "" : asistio(s, f) ? "✔" : "✘"}</td>`).join("") + Array.from({ length: vacias }, () => `<td></td>`).join("") +
      acts.map((a) => `<td class="c">${esc(res[`${a.id}:${f.e.id}`] ?? "")}</td>`).join("") +
      `<td class="c">${esc(totalDe(f) ?? "")}</td><td class="c">${esc(cumple(f) ? plan.nota_aprobada : "")}</td></tr>`).join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Nivelación ${esc(nombreCurso)}</title>
<style>@page{size:landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#111}h2{margin:0 0 2px}p{margin:2px 0;font-size:12px;color:#333}
table{border-collapse:collapse;width:100%;font-size:12px;margin-top:8px}th,td{border:1px solid #333;padding:5px 6px}th{background:#e8eef8}.c{text-align:center}.v{min-width:46px}td{height:24px}
.act{border:1px solid #333;padding:6px 8px;margin-top:8px;font-size:12px}</style></head><body>
<div style="display:flex;align-items:center;gap:12px;border-bottom:2px solid #333;padding-bottom:6px">${inst?.logo_url ? `<img src="${esc(inst.logo_url)}" style="height:54px">` : ""}<div style="flex:1;text-align:center"><h2 style="font-size:17px;text-transform:uppercase">${esc(institucion)}</h2><div style="font-weight:bold;font-size:13px">Hoja de asistencia y entrega de nivelaciones</div></div></div>
<p><b>${esc(materia?.nombre || "")}</b> · Docente: ${esc(docente)} · Curso ${esc(nombreCurso)} · Periodo ${esc(periodo)} · Año ${esc(anioDoc)} · Aprueba con ${esc(plan.porcentaje_minimo)}% o más → nota ${esc(plan.nota_aprobada)}</p>
<div class="act"><b>Actividades:</b> ${esc(titulo)}${plan.instrucciones ? `<br>${esc(plan.instrucciones)}` : ""}${plan.fecha_limite ? `<br><b>Fecha límite de entrega:</b> ${esc(fmtFecha(plan.fecha_limite))}` : ""}</div>
<table><thead><tr><th>#</th><th>Apellidos</th><th>Nombres</th><th>Nota</th>${th}${tha}<th>Total %</th><th>Nota nivelación</th></tr></thead><tbody>${cuerpo}</tbody></table>
<script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  const inp = "text-sm rounded-lg px-2 py-1 border border-slate-300 focus:border-[#2F55A4] outline-none";
  return (
    <div>
      <div className="rounded-xl border border-slate-200 p-3 mb-3 bg-white">
        <div className="text-xs font-bold text-slate-600 mb-2">📝 Actividades de la nivelación (periodo {periodo})</div>
        <div className="grid gap-1.5">
          {editAct.map((a, i) => (
            <div key={a.id || `n${i}`} className="flex items-center gap-2">
              <input value={a.nombre} placeholder="Ej.: Guía de trabajo" onChange={(e) => setEditAct((p) => p.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} className={`${inp} flex-1 min-w-0`} />
              <input value={a.peso} inputMode="decimal" onChange={(e) => setEditAct((p) => p.map((x, j) => (j === i ? { ...x, peso: String(e.target.value).replace(",", ".") } : x)))} className={`${inp} w-16 text-center`} />
              <span className="text-xs text-slate-500">%</span>
              <button onClick={() => setEditAct((p) => p.filter((_, j) => j !== i))} className="text-rose-500 font-bold px-1" title="Quitar">×</button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <button onClick={() => setEditAct((p) => [...p, { nombre: "", peso: p.length ? 0 : 100 }])} className="text-xs font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-700">＋ Agregar actividad</button>
          <button onClick={guardarActs} className="text-xs font-bold px-3 py-1.5 rounded-full text-white" style={{ background: "#2F55A4" }}>💾 Guardar actividades</button>
          <span className={`text-[11px] font-bold ${Math.round(pesoEdit) === 100 ? "text-emerald-600" : "text-amber-600"}`}>Suman {pesoEdit}%{Math.round(pesoEdit) === 100 ? " ✓" : " (deben sumar 100)"}</span>
          <button onClick={() => setCopiando((v) => !v)} className="text-xs font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-700">📋 Copiar a otros cursos</button>
          <button onClick={aplicarOtrasMaterias} className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">🔁 Aplicar a mis otras materias</button>
        </div>
        {msg && <div className="text-[11px] text-emerald-700 mt-1">{msg}</div>}
        {copiando && (
          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
            <div className="text-[11px] font-bold text-slate-600 mb-1">Copiar estas actividades y la regla (periodo {periodo}) a:</div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {grados.filter((g) => String(g.id) !== String(gradoId)).map((g) => (
                <label key={g.id} className="text-xs text-slate-700 flex items-center gap-1">
                  <input type="checkbox" checked={destinos.includes(g.id)} onChange={(e) => setDestinos((p) => e.target.checked ? [...p, g.id] : p.filter((x) => x !== g.id))} />{g.nombre || g.id}
                </label>
              ))}
            </div>
            <label className="text-[11px] text-slate-500 flex items-center gap-1 mt-1"><input type="checkbox" checked={reemplazar} onChange={(e) => setReemplazar(e.target.checked)} />Reemplazar si el curso ya tiene actividades (borra sus resultados)</label>
            <button onClick={copiarACursos} className="mt-1.5 text-xs font-bold px-3 py-1.5 rounded-full text-white" style={{ background: "#2F55A4" }}>Copiar</button>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-3 mt-3 pt-3 border-t border-slate-100">
          <label className="text-[11px] font-bold text-slate-500 sm:col-span-3">Instrucciones (opcional)
            <textarea value={plan.instrucciones} onChange={(e) => setPlan({ ...plan, instrucciones: e.target.value })} rows={2} className={`${inp} block w-full mt-0.5`} /></label>
          <label className="text-[11px] font-bold text-slate-500">Fecha límite
            <input type="date" value={plan.fecha_limite} onChange={(e) => setPlan({ ...plan, fecha_limite: e.target.value })} className={`${inp} block mt-0.5`} /></label>
          <label className="text-[11px] font-bold text-slate-500">% total para aprobar
            <input value={plan.porcentaje_minimo} inputMode="decimal" onChange={(e) => setPlan({ ...plan, porcentaje_minimo: e.target.value })} className={`${inp} block w-24 text-center mt-0.5`} /></label>
          <label className="text-[11px] font-bold text-slate-500">Nota si aprueba
            <input value={plan.nota_aprobada} inputMode="decimal" onChange={(e) => setPlan({ ...plan, nota_aprobada: String(e.target.value).replace(",", ".") })} className={`${inp} block w-24 text-center mt-0.5`} /></label>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button onClick={guardarPlan} className="text-xs font-bold px-3 py-1.5 rounded-full text-white" style={{ background: "#2F55A4" }}>💾 Guardar regla</button>
          <span className="text-[11px] text-slate-500 ml-auto">Con resultados <b>{resumen.ent}</b>/{resumen.t} · Aprueban <b>{resumen.ok}</b></span>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">En la tabla escribes el <b>% logrado (0–100)</b> en cada actividad. El total es el promedio ponderado por los pesos. Si el total llega al mínimo, la nota del periodo pasa a <b>{plan.nota_aprobada}</b> en Planillas y Boletín (la original se conserva); si deja de llegar, vuelve la original. Cada actividad puede ser distinta por curso y periodo.</p>
      </div>

      <div className="flex flex-wrap items-end gap-2 mb-2">
        <label className="text-[11px] font-bold text-slate-500">Nueva sesión
          <input type="date" value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} className={`${inp} block mt-0.5`} /></label>
        <label className="text-[11px] font-bold text-slate-500">Tema (opcional)
          <input value={nuevoTema} onChange={(e) => setNuevoTema(e.target.value)} className={`${inp} block mt-0.5`} /></label>
        <button onClick={agregarSesion} className="text-xs font-bold px-3 py-2 rounded-full bg-slate-100 text-slate-700">＋ Agregar sesión</button>
        <details className="text-[11px] text-slate-500 w-full">
          <summary className="cursor-pointer font-bold">🏫 Encabezado: {institucion}</summary>
          <div className="flex flex-wrap gap-2 mt-1">
            <input value={docente} onChange={(e) => { setDocente(e.target.value); guardarLS("niv_docente", e.target.value); }} className={`${inp} flex-1 min-w-[200px]`} placeholder="Docente" />
          </div>
          <p className="mt-1">El nombre del colegio, el logo y el año se toman de ⚙️ Institución (los mismos de las actas y planillas).</p>
        </details>
        <div className="flex gap-1.5 ml-auto">
          <button onClick={imprimir} disabled={!lista.length} className="text-xs font-bold px-3 py-2 rounded-full text-white disabled:opacity-40" style={{ background: "#2F55A4" }}>🖨️ Imprimir / guardar PDF</button>
          <button onClick={descargarCSV} disabled={!lista.length} className="text-xs font-bold px-3 py-2 rounded-full bg-slate-100 text-slate-700 disabled:opacity-40">⬇ CSV</button>
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-5 text-center">No hay estudiantes con asignatura perdida en este periodo.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#E8EEF8] text-slate-700 text-xs">
                <th rowSpan={2} className="px-2 py-1.5 w-8">#</th><th rowSpan={2} className="px-2 py-1.5 text-left">Apellidos</th><th rowSpan={2} className="px-2 py-1.5 text-left">Nombres</th><th rowSpan={2} className="px-2 py-1.5">Nota</th>
                {sesiones.length > 0 && <th colSpan={sesiones.length} className="px-2 py-1.5 border-l border-slate-300">Asistencia</th>}
                <th colSpan={acts.length + 3} className="px-2 py-1.5 border-l border-slate-300 text-left">Actividades: <span className="font-extrabold">{titulo}</span>{plan.fecha_limite ? ` · límite ${fmtFecha(plan.fecha_limite)}` : ""}</th>
              </tr>
              <tr className="bg-[#E8EEF8] text-slate-700 text-xs">
                {sesiones.map((s, k) => (
                  <th key={s.id} className={`px-1 py-1.5 font-semibold ${k === 0 ? "border-l border-slate-300" : ""}`} title={s.tema || ""}>
                    {fmtFecha(s.fecha)} <button onClick={() => quitarSesion(s)} className="text-rose-400 font-bold" title="Eliminar sesión">×</button>
                    {s.tema && <div className="text-[10px] font-normal text-slate-500 max-w-[90px] truncate">{s.tema}</div>}
                  </th>
                ))}
                {acts.map((a, k) => (
                  <th key={a.id} className={`px-2 py-1.5 ${k === 0 ? "border-l border-slate-300" : ""}`}>{a.nombre || "Actividad"}<div className="text-[10px] font-normal text-slate-500">{Number(a.peso) || 0}% · 0–100</div></th>
                ))}
                <th className="px-2 py-1.5">Total %</th><th className="px-2 py-1.5">Nota final</th><th className="px-2 py-1.5 text-left">Observación</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((f, i) => {
                const ok = cumple(f); const t = totalDe(f);
                return (
                  <tr key={f.e.id} className="odd:bg-white even:bg-slate-50 border-t border-slate-100">
                    <td className="text-center px-2 py-1.5 text-slate-400">{i + 1}</td>
                    <td className="px-2 py-1.5 font-semibold text-slate-700">{f.ap}</td>
                    <td className="px-2 py-1.5 text-slate-700">{f.nom}</td>
                    <td className="text-center px-2 py-1.5 font-bold text-rose-600">{f.original ?? "—"}</td>
                    {sesiones.map((s) => (
                      <td key={s.id} className="text-center px-1 py-1.5">
                        <input type="checkbox" checked={asistio(s, f) === true} onChange={(e) => marcar(s, f.e.id, e.target.checked)} />
                      </td>
                    ))}
                    {acts.map((a) => {
                      const k = `${a.id}:${f.e.id}`;
                      return (
                        <td key={a.id} className="text-center px-2 py-1.5">
                          <input value={draft[k] ?? (res[k] ?? "")} inputMode="decimal" disabled={ocupado === f.e.id} placeholder="—"
                            onChange={(e) => setDraft((p) => ({ ...p, [k]: e.target.value }))}
                            onBlur={() => { if (draft[k] !== undefined) guardarCelda(f, a); }} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                            className={`${inp} w-16 text-center`} />
                        </td>
                      );
                    })}
                    <td className="text-center px-2 py-1.5 font-bold text-slate-700">{t === null ? "—" : `${t}%`}</td>
                    <td className={`text-center px-2 py-1.5 font-bold ${ok ? "text-emerald-600" : "text-slate-500"}`}>{ok ? plan.nota_aprobada : (f.original ?? "—")}{ok && " ✓"}</td>
                    <td className="px-2 py-1.5">
                      <input value={draft[f.e.id]?.obs ?? (f.reg?.observacion ?? "")} disabled={ocupado === f.e.id}
                        onChange={(e) => setDraft((p) => ({ ...p, [f.e.id]: { ...p[f.e.id], obs: e.target.value } }))}
                        onBlur={() => { if (draft[f.e.id]?.obs !== undefined) guardarObs(f); }} className={`${inp} w-full min-w-[120px]`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- Tabla transversal: un estudiante, todas las materias que perdió ----------
function MatrizTransversal({ gradoId, periodo, nombreCurso, inst, institucion, docente, setError }) {
  const [m, setM] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [soloVarias, setSoloVarias] = useState(false);
  const [guia, setGuia] = useState({});
  const [ocupado, setOcupado] = useState(null);
  const [msg, setMsg] = useState("");

  const cargar = async () => {
    if (!gradoId || !periodo) return;
    setCargando(true); setError("");
    try { setM(await api.fetchMatrizNivelacion(gradoId, periodo)); }
    catch (e) { setError("No se pudo armar la tabla: " + (e.message || e)); }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, [gradoId, periodo]);

  const filas = useMemo(() => {
    if (!m) return [];
    return m.estudiantes.map((e) => {
      const cel = m.celdas[e.id] || {};
      const perdidas = m.materias.filter((x) => cel[x.id]?.perdio);
      return { e, ...separarNombre(e), cel, perdidas };
    }).filter((f) => (soloVarias ? f.perdidas.length >= 2 : f.perdidas.length >= 1))
      .sort((a, b) => b.perdidas.length - a.perdidas.length || a.ap.localeCompare(b.ap, "es", { sensitivity: "base" }));
  }, [m, soloVarias]);

  const aplicar = async (f) => {
    const txt = String(guia[f.e.id] ?? "").trim().replace(",", ".");
    const pct = parseFloat(txt);
    if (txt === "" || Number.isNaN(pct) || pct < 0 || pct > 100) { setError("Escribe el % de la guía (0 a 100)."); return; }
    if (!confirm(`Aplicar ${pct}% a ${f.nom} ${f.ap} en: ${f.perdidas.map((x) => x.nombre).join(", ")}.\n(La nota pasa a la de aprobación solo si ${pct}% llega al mínimo de cada materia.)`)) return;
    setError(""); setOcupado(f.e.id);
    try {
      const n = await api.aplicarGuiaTransversal(periodo, [{ estudianteId: f.e.id, porcentaje: pct, materiaIds: f.perdidas.map((x) => x.id) }], m);
      setMsg(`Aplicado en ${n} materia(s). Planillas y Boletín ya se actualizaron.`);
      await cargar();
    } catch (e) { setError("No se pudo aplicar: " + (e.message || e)); }
    setOcupado(null);
  };
  const aplicarTodos = async () => {
    const items = filas.filter((f) => String(guia[f.e.id] ?? "").trim() !== "").map((f) => ({ estudianteId: f.e.id, porcentaje: parseFloat(String(guia[f.e.id]).replace(",", ".")), materiaIds: f.perdidas.map((x) => x.id) }))
      .filter((i) => !Number.isNaN(i.porcentaje) && i.porcentaje >= 0 && i.porcentaje <= 100);
    if (!items.length) { setError("Escribe el % de la guía en al menos una fila."); return; }
    if (!confirm(`Se aplicará el % escrito a ${items.length} estudiante(s) en todas las materias que perdió cada uno. ¿Continuar?`)) return;
    setError(""); setOcupado("todos");
    try { const n = await api.aplicarGuiaTransversal(periodo, items, m); setMsg(`Aplicado en ${n} registro(s) de materia.`); setGuia({}); await cargar(); }
    catch (e) { setError("No se pudo aplicar: " + (e.message || e)); }
    setOcupado(null);
  };

  const textoCelda = (c) => (c ? (c.reg?.estado === "superado" ? `${c.original} → ${c.actual}` : String(c.original)) : "");
  const descargarCSV = () => {
    const cab = ["#", "Apellidos", "Nombres", ...m.materias.map((x) => x.nombre), "Perdidas"];
    const rows = filas.map((f, i) => [i + 1, f.ap, f.nom, ...m.materias.map((x) => textoCelda(f.cel[x.id])), f.perdidas.length]);
    const csv = "﻿" + [cab, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `transversal_${nombreCurso}_periodo${periodo}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const imprimir = () => {
    const w = window.open("", "_blank");
    if (!w) { setError("El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes."); return; }
    const th = m.materias.map((x) => `<th>${esc(x.nombre)}</th>`).join("");
    const cuerpo = filas.map((f, i) => `<tr><td class="c">${i + 1}</td><td>${esc(f.ap)}</td><td>${esc(f.nom)}</td>` +
      m.materias.map((x) => { const c = f.cel[x.id]; return `<td class="c" ${c?.perdio && c.reg?.estado !== "superado" ? 'style="color:#b91c1c;font-weight:bold"' : ""}>${esc(textoCelda(c))}</td>`; }).join("") +
      `<td class="c"><b>${f.perdidas.length}</b></td><td></td></tr>`).join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Transversal ${esc(nombreCurso)}</title>
<style>@page{size:landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#111}h2{margin:0}p{margin:3px 0;font-size:12px;color:#333}
table{border-collapse:collapse;width:100%;font-size:12px;margin-top:8px}th,td{border:1px solid #333;padding:5px 6px}th{background:#e8eef8}.c{text-align:center}td{height:24px}</style></head><body>
<div style="display:flex;align-items:center;gap:12px;border-bottom:2px solid #333;padding-bottom:6px">${inst?.logo_url ? `<img src="${esc(inst.logo_url)}" style="height:54px">` : ""}<div style="flex:1;text-align:center"><h2 style="font-size:17px;text-transform:uppercase">${esc(institucion)}</h2><div style="font-weight:bold;font-size:13px">Estudiantes con asignaturas perdidas - nivelación transversal</div></div></div>
<p>Curso ${esc(nombreCurso)} · Periodo ${esc(periodo)} · Docente: ${esc(docente)} · En rojo: asignatura perdida</p>
<table><thead><tr><th>#</th><th>Apellidos</th><th>Nombres</th>${th}<th>Perdidas</th><th>Guía común (%)</th></tr></thead><tbody>${cuerpo}</tbody></table>
<script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  if (cargando && !m) return <div className="text-sm text-slate-400">Armando la tabla…</div>;
  if (!m) return null;
  const inp = "text-sm rounded-lg px-2 py-1 border border-slate-300 focus:border-[#2F55A4] outline-none";
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <label className="text-xs text-slate-600 flex items-center gap-1"><input type="checkbox" checked={soloVarias} onChange={(e) => setSoloVarias(e.target.checked)} />Solo los que perdieron 2 o más materias</label>
        <span className="text-[11px] text-slate-500">{filas.length} estudiante(s) · {m.materias.length} materia(s) tuyas con notas</span>
        <div className="flex gap-1.5 ml-auto">
          <button onClick={aplicarTodos} disabled={ocupado === "todos"} className="text-xs font-bold px-3 py-2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">🔁 Aplicar todos los % escritos</button>
          <button onClick={imprimir} disabled={!filas.length} className="text-xs font-bold px-3 py-2 rounded-full text-white disabled:opacity-40" style={{ background: "#2F55A4" }}>🖨️ Imprimir / guardar PDF</button>
          <button onClick={descargarCSV} disabled={!filas.length} className="text-xs font-bold px-3 py-2 rounded-full bg-slate-100 text-slate-700 disabled:opacity-40">⬇ CSV</button>
        </div>
      </div>
      {msg && <div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mb-2">{msg}</div>}
      <p className="text-[11px] text-slate-500 mb-2">Cada fila es un estudiante y cada columna una de tus materias. En rojo: la perdió. Si una misma guía sirve para varias, escribe su <b>% de guía</b> y pulsa «Aplicar»: se registra en todas las materias que perdió, con la regla de cada una (% mínimo y nota de la hoja de nivelación de esa materia).</p>
      {filas.length === 0 ? (
        <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-5 text-center">Nadie con asignaturas perdidas en el periodo {periodo} de este curso.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#E8EEF8] text-slate-700 text-xs">
                <th className="px-2 py-1.5 w-8">#</th><th className="px-2 py-1.5 text-left">Apellidos</th><th className="px-2 py-1.5 text-left">Nombres</th>
                {m.materias.map((x) => <th key={x.id} className="px-2 py-1.5">{x.nombre}<div className="text-[10px] font-normal text-slate-500">mín. {x.minima}</div></th>)}
                <th className="px-2 py-1.5">Perdidas</th><th className="px-2 py-1.5">Guía común (%)</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={f.e.id} className="odd:bg-white even:bg-slate-50 border-t border-slate-100">
                  <td className="text-center px-2 py-1.5 text-slate-400">{i + 1}</td>
                  <td className="px-2 py-1.5 font-semibold text-slate-700">{f.ap}</td>
                  <td className="px-2 py-1.5 text-slate-700">{f.nom}</td>
                  {m.materias.map((x) => {
                    const c = f.cel[x.id];
                    const sup = c?.reg?.estado === "superado";
                    return <td key={x.id} className={`text-center px-2 py-1.5 font-bold ${!c ? "text-slate-300" : sup ? "text-emerald-600" : c.perdio ? "text-rose-600" : "text-slate-500"}`}>{c ? textoCelda(c) : "—"}{sup && " ✓"}</td>;
                  })}
                  <td className="text-center px-2 py-1.5 font-bold">{f.perdidas.length}</td>
                  <td className="text-center px-2 py-1.5 whitespace-nowrap">
                    <input value={guia[f.e.id] ?? ""} inputMode="decimal" placeholder="%" onChange={(e) => setGuia((p) => ({ ...p, [f.e.id]: e.target.value }))} className={`${inp} w-16 text-center`} />
                    <button onClick={() => aplicar(f)} disabled={ocupado === f.e.id} className="ml-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">Aplicar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function VistaRecuperaciones({ grados = [], gradoActivo, materiaActiva }) {
  const [materias, setMaterias] = useState([]);
  const [materiaId, setMateriaId] = useState(materiaActiva || "");
  const [gradoId, setGradoId] = useState(gradoActivo || grados[0]?.id || "");
  const [config, setConfig] = useState(CONFIG_DEFAULT);
  const [periodo, setPeriodo] = useState("1");
  const [minima, setMinima] = useState("");
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [edicion, setEdicion] = useState({});
  const [guardando, setGuardando] = useState(null);
  const [aviso, setAviso] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [modo, setModo] = useState("seguimiento"); // seguimiento | transversal | notas
  const [inst, setInst] = useState(null);
  useEffect(() => { api.fetchInstitucion().then(setInst).catch(() => setInst(null)); }, []);
  const institucionNombre = (inst?.nombre && inst.nombre !== "Institución Educativa") ? inst.nombre : INSTITUCION_DEFAULT;
  const docenteNombre = leerLS("niv_docente", DOCENTE_DEFAULT);

  useEffect(() => {
    api.fetchMisMaterias().then((m) => {
      setMaterias(m);
      if (!materiaId && m[0]) setMateriaId(m.find((x) => String(x.id) === String(materiaActiva))?.id ?? m[0].id);
    }).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { if (!gradoId && grados[0]) setGradoId(grados[0].id); }, [grados]);

  // Al cambiar de materia: trae su configuración (mínima aprobatoria, periodos).
  useEffect(() => {
    if (!materiaId) return;
    api.fetchNotasConfig(materiaId).then((c) => {
      setConfig(c);
      setMinima(String(c.nota_minima ?? 3));
      setPeriodo(String(c.periodo_actual || "1"));
    }).catch((e) => setError(e.message));
  }, [materiaId]);

  const minimaNum = (() => { const v = parseFloat(String(minima).replace(",", ".")); return Number.isNaN(v) ? null : v; })();

  const cargar = async () => {
    if (!materiaId || !gradoId || !periodo) return;
    setCargando(true); setError(""); setEdicion({});
    try {
      const [ests, finales, niv, cats] = await Promise.all([
        api.fetchEstudiantesPorGrado(gradoId), api.fetchNotasFinales(materiaId),
        api.fetchNivelacion(materiaId), api.fetchCategorias(materiaId),
      ]);
      const guardada = new Map(finales.filter((f) => String(f.periodo) === String(periodo)).map((f) => [f.estudiante_id, f.nota]));
      const sinGuardar = ests.filter((e) => !guardada.has(e.id));
      let vivas = {};
      if (sinGuardar.length) vivas = await api.calcularNotasFinalesPeriodo(materiaId, gradoId, periodo, sinGuardar, cats, config);
      const nivDe = new Map(niv.filter((n) => String(n.periodo) === String(periodo)).map((n) => [n.estudiante_id, n]));
      setFilas(ests.map((e) => {
        const reg = nivDe.get(e.id);
        const actual = guardada.has(e.id) ? guardada.get(e.id) : (vivas[e.id] ?? null);
        // Si ya hay recuperación registrada, la "Nota" que se muestra es la original.
        const original = reg?.nota_original ?? actual;
        return { e, ...separarNombre(e), original: r2(original), actual: r2(actual), reg, recup: reg?.nota_recuperacion ?? null };
      }));
    } catch (err) { setError(err.message || String(err)); }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, [materiaId, gradoId, periodo, config.nota_minima]);

  // Aparecen los que perdieron (nota original por debajo de la mínima) o que ya tienen recuperación.
  const lista = useMemo(() => {
    if (minimaNum === null) return [];
    return filas.filter((f) => (f.original !== null && f.original < minimaNum) || f.recup !== null || (f.reg && f.reg.estado))
      .sort((a, b) => a.ap.localeCompare(b.ap, "es", { sensitivity: "base" }) || a.nom.localeCompare(b.nom, "es", { sensitivity: "base" }));
  }, [filas, minimaNum]);

  const guardarMinimaEnMateria = async () => {
    if (minimaNum === null) return;
    try { await api.guardarNotasConfig(materiaId, { ...config, nota_minima: minimaNum }); setConfig({ ...config, nota_minima: minimaNum }); setAviso("Mínima aprobatoria guardada en la materia."); }
    catch (e) { setError(e.message); }
  };

  const guardarRecup = async (f) => {
    const txt = (edicion[f.e.id] ?? (f.recup ?? "")).toString().trim().replace(",", ".");
    if (txt === String(f.recup ?? "")) return;
    const valor = txt === "" ? null : parseFloat(txt);
    if (valor !== null && (Number.isNaN(valor) || valor < (config.escala_min ?? 1) || valor > (config.nota_maxima ?? 5))) {
      setError(`La nota debe estar entre ${config.escala_min ?? 1} y ${config.nota_maxima ?? 5}.`); return;
    }
    setError(""); setGuardando(f.e.id);
    try {
      await api.guardarRecuperacion(materiaId, f.e.id, periodo, { notaRecuperacion: valor, notaOriginal: f.original, minima: minimaNum });
      await cargar();
    } catch (err) { setError("No se pudo guardar: " + (err.message || err)); }
    setGuardando(null);
  };

  const ETIQUETA_ESTADO = { "": "Sin marcar", pendiente: "Pendiente", en_proceso: "En proceso", superado: "Superado" };
  const cambiarEstado = async (f, nuevo) => {
    if (!nuevo && f.recup !== null && !confirm("Dejar «Sin marcar» borra también la nota de recuperación de este estudiante. ¿Continuar?")) return;
    setError(""); setGuardando(f.e.id);
    try {
      await api.cambiarEstadoRecuperacion(materiaId, f.e.id, periodo, { estado: nuevo, estadoPrevio: f.reg?.estado || "", notaOriginal: f.original, minima: minimaNum });
      await cargar();
    } catch (err) { setError("No se pudo cambiar el estado: " + (err.message || err)); }
    setGuardando(null);
  };
  const conteo = useMemo(() => {
    const c = { todos: lista.length, "": 0, pendiente: 0, en_proceso: 0, superado: 0 };
    lista.forEach((f) => { c[f.reg?.estado || ""] += 1; });
    return c;
  }, [lista]);
  const visibles = filtro === "todos" ? lista : lista.filter((f) => (f.reg?.estado || "") === filtro);

  const materia = materias.find((m) => String(m.id) === String(materiaId));
  const grado = grados.find((g) => String(g.id) === String(gradoId));
  const nombreCurso = grado?.nombre || grado?.id || gradoId;

  const filasExport = () => visibles.map((f, i) => [i + 1, f.ap, f.nom, f.original ?? "", f.recup ?? "", ETIQUETA_ESTADO[f.reg?.estado || ""]]);
  const descargarCSV = () => {
    const filasCsv = [["#", "Apellidos", "Nombres", "Nota", "Recuperación", "Estado"], ...filasExport()];
    const csv = "﻿" + filasCsv.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `recuperacion_${nombreCurso}_periodo${periodo}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const imprimir = () => {
    const w = window.open("", "_blank");
    if (!w) { setError("El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes."); return; }
    const cuerpo = visibles.map((f, i) => `<tr><td class="c">${i + 1}</td><td>${esc(f.ap)}</td><td>${esc(f.nom)}</td><td class="c">${esc(f.original ?? "")}</td><td class="c">${esc(f.recup ?? "")}</td><td class="c">${esc(ETIQUETA_ESTADO[f.reg?.estado || ""])}</td></tr>`).join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Recuperación ${esc(nombreCurso)}</title>
<style>body{font-family:Arial,sans-serif;margin:24px;color:#111}h2{margin:0 0 2px}p{margin:0 0 12px;color:#444;font-size:13px}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #333;padding:6px 8px}th{background:#e8eef8}.c{text-align:center}
td:nth-child(5){height:26px}</style></head><body>
<h2>Planilla de recuperación — ${esc(materia?.nombre || "")}</h2>
<p>Curso ${esc(nombreCurso)} · Periodo ${esc(periodo)} · Nota mínima aprobatoria: ${esc(minimaNum ?? "")}</p>
<table><thead><tr><th rowspan="2">#</th><th colspan="2">Datos de estudiante</th><th>Nota</th><th>Recuperación</th><th>Estado</th></tr>
<tr><th>Apellidos</th><th>Nombres</th><th></th><th></th><th></th></tr></thead><tbody>${cuerpo}</tbody></table>
<script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 items-end mb-3">
        <label className="text-[11px] font-bold text-slate-500">Materia
          <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)} className="block mt-0.5 text-sm rounded-lg px-2 py-1.5 border border-slate-200 bg-white">
            {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-bold text-slate-500">Curso
          <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="block mt-0.5 text-sm rounded-lg px-2 py-1.5 border border-slate-200 bg-white">
            {grados.map((g) => <option key={g.id} value={g.id}>{g.nombre || g.id}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-bold text-slate-500">Periodo
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="block mt-0.5 text-sm rounded-lg px-2 py-1.5 border border-slate-200 bg-white">
            {periodosDe(config).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-bold text-slate-500">Mínima aprobatoria
          <div className="flex gap-1 mt-0.5">
            <input value={minima} onChange={(e) => setMinima(e.target.value)} inputMode="decimal" className="w-20 text-sm text-center rounded-lg px-2 py-1.5 border border-slate-200" />
            <button onClick={guardarMinimaEnMateria} title="Guardar esta mínima en la configuración de la materia" className="text-[11px] font-bold px-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">💾 Guardar en la materia</button>
          </div>
        </label>
        <div className="flex gap-1.5 ml-auto">
          <button onClick={imprimir} disabled={!visibles.length} className="text-xs font-bold px-3 py-2 rounded-full text-white disabled:opacity-40" style={{ background: "#2F55A4" }}>🖨️ Imprimir planilla</button>
          <button onClick={descargarCSV} disabled={!visibles.length} className="text-xs font-bold px-3 py-2 rounded-full bg-slate-100 text-slate-700 disabled:opacity-40">⬇ CSV</button>
        </div>
      </div>

      <div className="flex gap-1.5 mb-3">
        {[["seguimiento", "📋 Hoja de nivelación"], ["transversal", "🔀 Transversal"], ["notas", "♻️ Notas de recuperación"]].map(([k, t]) => (
          <button key={k} onClick={() => setModo(k)} className={`text-xs font-bold px-3 py-1.5 rounded-full border ${modo === k ? "text-white border-transparent" : "bg-white text-slate-600 border-slate-200"}`} style={modo === k ? { background: "#2F55A4" } : undefined}>{t}</button>
        ))}
      </div>
      {aviso && <div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mb-2">{aviso}</div>}
      {error && <div className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2 mb-2">{error}</div>}
      {modo === "seguimiento" && !cargando && (
        <SeguimientoNivelacion materiaId={materiaId} gradoId={gradoId} periodo={periodo} materia={materia} nombreCurso={nombreCurso} lista={lista} cargar={cargar} setError={setError} grados={grados} />
      )}
      {modo === "transversal" && <MatrizTransversal gradoId={gradoId} periodo={periodo} nombreCurso={nombreCurso} inst={inst} institucion={institucionNombre} docente={docenteNombre} setError={setError} />}
      {cargando && modo !== "transversal" && <div className="text-sm text-slate-400">Cargando…</div>}
      {modo === "notas" && <>
      <p className="text-[11px] text-slate-500 mb-3">
        Aparecen los estudiantes con nota del periodo por debajo de <b>{minimaNum ?? "—"}</b>. Si la recuperación alcanza esa mínima, la nota del periodo queda en <b>{minimaNum ?? "—"}</b> (la nota original se conserva).
        Si no la alcanza, la nota no cambia. Si borras la recuperación, vuelve la nota original. Marca el <b>Estado</b> de cada estudiante (Sin marcar, Pendiente, En proceso, Superado) igual que en Planillas, y filtra por estado para ver quiénes ya entregaron y quiénes no. Cambiar la mínima aquí afecta esta planilla; usa «Guardar en la materia» para que sea la de siempre.
      </p>
      {!cargando && lista.length === 0 && !error && (
        <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-5 text-center">🎉 Nadie tiene la nota del periodo {periodo} por debajo de {minimaNum ?? "la mínima"} en este curso.</div>
      )}

      {lista.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {[["todos", "Todos"], ["", "Sin marcar"], ["pendiente", "Pendiente"], ["en_proceso", "En proceso"], ["superado", "Superado"]].map(([k, t]) => (
            <button key={k || "sm"} onClick={() => setFiltro(k)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-full border ${filtro === k ? "text-white border-transparent" : "bg-white text-slate-600 border-slate-200"}`}
              style={filtro === k ? { background: "#2F55A4" } : undefined}>{t} · {conteo[k]}</button>
          ))}
        </div>
      )}

      {lista.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#E8EEF8] text-slate-700 text-xs">
                <th rowSpan={2} className="px-2 py-1.5 border-r border-slate-200 w-10">#</th>
                <th colSpan={2} className="px-2 py-1.5 border-r border-slate-200">Datos de estudiante</th>
                <th rowSpan={2} className="px-2 py-1.5 border-r border-slate-200 w-20">Nota</th>
                <th rowSpan={2} className="px-2 py-1.5 border-r border-slate-200 w-32">Recuperación</th>
                <th rowSpan={2} className="px-2 py-1.5 w-32">Estado</th>
              </tr>
              <tr className="bg-[#E8EEF8] text-slate-700 text-xs">
                <th className="px-2 py-1 border-r border-slate-200 text-left">Apellidos</th>
                <th className="px-2 py-1 border-r border-slate-200 text-left">Nombres</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f, i) => {
                const est = f.reg?.estado || "";
                return (
                  <tr key={f.e.id} className="odd:bg-white even:bg-slate-50 border-t border-slate-100">
                    <td className="text-center px-2 py-1.5 text-slate-400">{i + 1}</td>
                    <td className="px-2 py-1.5 font-semibold text-slate-700">{f.ap}</td>
                    <td className="px-2 py-1.5 text-slate-700">{f.nom}</td>
                    <td className="text-center px-2 py-1.5 font-bold text-rose-600">{f.original ?? "—"}</td>
                    <td className="text-center px-2 py-1.5">
                      <input value={edicion[f.e.id] ?? (f.recup ?? "")} inputMode="decimal" disabled={guardando === f.e.id}
                        onChange={(e) => setEdicion((p) => ({ ...p, [f.e.id]: e.target.value }))}
                        onBlur={() => guardarRecup(f)} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                        placeholder="—" className="w-20 text-center text-sm rounded-lg px-2 py-1 border border-slate-300 focus:border-[#2F55A4] outline-none" />
                    </td>
                    <td className="text-center px-2 py-1.5">
                      <select value={est} disabled={guardando === f.e.id} onChange={(e) => cambiarEstado(f, e.target.value)}
                        className={`text-[11px] font-bold rounded-lg px-1.5 py-1 border ${est === "superado" ? "border-emerald-300 text-emerald-700 bg-emerald-50" : est === "en_proceso" ? "border-amber-300 text-amber-700 bg-amber-50" : est === "pendiente" ? "border-sky-300 text-sky-700 bg-sky-50" : "border-slate-300 text-slate-500 bg-white"}`}>
                        <option value="">Sin marcar</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="en_proceso">En proceso</option>
                        <option value="superado">Superado</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </>}
    </div>
  );
}
