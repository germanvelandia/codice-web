// Asistencia dentro de la Planilla: (1) nota actitudinal 1–5 calculada con la asistencia real y
// (2) mirada rápida: matriz fecha × estudiante, retardos e inasistencias.
import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabaseClient";
import * as api from "../lib/api";

const CODIGOS = {
  P: { label: "Presente", fondo: "#DCFCE7", texto: "#15803D" },
  R: { label: "Retardo", fondo: "#FEF3C7", texto: "#B45309" },
  FI: { label: "Falta injustificada", fondo: "#FEE2E2", texto: "#B91C1C" },
  FJ: { label: "Falta justificada", fondo: "#DBEAFE", texto: "#1D4ED8" },
};
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtFecha = (f) => { const [y, m, d] = String(f).split("-"); return `${d}/${m}`; };

// Trae TODAS las filas (Supabase corta en 1000 por pedido).
async function traerAsistencia(estudianteIds, materiaId, desde, hasta) {
  if (!estudianteIds.length) return [];
  const filas = [];
  for (let ini = 0; ; ini += 1000) {
    let q = supabase.from("asistencia").select("estudiante_id, fecha, codigo, materia_id, observacion").in("estudiante_id", estudianteIds);
    if (materiaId) q = q.eq("materia_id", materiaId);
    if (desde) q = q.gte("fecha", desde);
    if (hasta) q = q.lte("fecha", hasta);
    const { data, error } = await q.order("estudiante_id").order("fecha").order("materia_id").order("codigo").range(ini, ini + 999);
    if (error) throw error;
    filas.push(...(data || []));
    if ((data || []).length < 1000) break;
  }
  return filas;
}

function totalesPorEstudiante(estudiantes, filas) {
  const t = {};
  estudiantes.forEach((e) => { t[e.id] = { P: 0, R: 0, FI: 0, FJ: 0, total: 0 }; });
  filas.forEach((r) => { const x = t[r.estudiante_id]; if (!x) return; x[r.codigo] = (x[r.codigo] || 0) + 1; x.total += 1; });
  return t;
}

// Nota en la escala de la planilla: cada clase vale según su código; % de clases "cumplidas" → min…max.
export function notaDeAsistencia(tot, pesos, config) {
  if (!tot || tot.total === 0) return null;
  const pts = tot.P * 1 + tot.R * pesos.R + tot.FJ * pesos.FJ + tot.FI * pesos.FI;
  const min = config.escala_min ?? 1, max = config.nota_maxima ?? 5;
  const nota = min + (max - min) * Math.max(0, Math.min(1, pts / tot.total));
  return Math.round(nota * 10) / 10;
}

const PESOS_DEFECTO = { R: 0.5, FJ: 1, FI: 0 };

function Cascaron({ titulo, onClose, ancho = "max-w-lg", children }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`bg-white rounded-2xl p-5 w-full ${ancho} max-h-[90vh] overflow-y-auto shadow-xl`}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">{titulo}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ============ 1) Nota actitudinal desde la asistencia ============ */
export function AsistenciaNotaModal({ materiaId, gradoId, periodo, categorias, actividades, estudiantes, config, actividadInicial, onClose, onAplicado }) {
  const manuales = actividades.filter((a) => !a.es_automatica);
  const [destino, setDestino] = useState(actividadInicial?.id ? String(actividadInicial.id) : "nueva");
  const [nombre, setNombre] = useState("Actitudinal (asistencia)");
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id || "");
  const guardada = actividadInicial?.config_auto?.asistencia || {};
  const [desde, setDesde] = useState(guardada.desde || "");
  const [hasta, setHasta] = useState(guardada.hasta || "");
  const [pesos, setPesos] = useState({ ...PESOS_DEFECTO, ...(guardada.pesos || {}) });
  const [soloVacios, setSoloVacios] = useState(false);
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState("");
  const [aplicando, setAplicando] = useState(false);

  useEffect(() => {
    let vivo = true; setFilas(null); setError("");
    traerAsistencia(estudiantes.map((e) => e.id), materiaId, desde || null, hasta || null)
      .then((f) => vivo && setFilas(f)).catch((e) => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [desde, hasta, materiaId, estudiantes.length]);

  const tot = useMemo(() => (filas ? totalesPorEstudiante(estudiantes, filas) : {}), [filas, estudiantes]);
  const notas = useMemo(() => {
    const n = {}; estudiantes.forEach((e) => { n[e.id] = notaDeAsistencia(tot[e.id], pesos, config); }); return n;
  }, [tot, pesos, config, estudiantes]);
  const clases = filas ? new Set(filas.map((f) => f.fecha)).size : 0;
  const actDestino = destino === "nueva" ? null : actividades.find((a) => a.id === parseInt(destino, 10));
  const num = (v) => { const x = parseFloat(String(v).replace(",", ".")); return isNaN(x) ? 0 : Math.max(0, Math.min(1, x)); };

  const aplicar = async () => {
    if (destino === "nueva" && (!nombre.trim() || !categoriaId)) { alert("Escribe un nombre y elige la categoría de la columna nueva."); return; }
    setAplicando(true);
    try {
      let act = actDestino;
      if (!act) {
        act = await api.crearActividad({ nombre: nombre.trim(), categoria_id: categoriaId, materia_id: materiaId, grado_id: gradoId, periodo, es_automatica: false });
      }
      // Recordar los ajustes en la columna (si falta el SQL 86, simplemente no se recuerdan).
      try { await api.editarActividad(act.id, { config_auto: { ...(act.config_auto || {}), asistencia: { desde, hasta, pesos } } }); } catch (e) { /* sin SQL 86 */ }
      const aplicados = [];
      for (const e of estudiantes) {
        const v = notas[e.id];
        if (v === null || v === undefined) continue;
        if (soloVacios && actDestino) {
          const { data } = await supabase.from("notas_valores").select("valor").eq("actividad_id", act.id).eq("estudiante_id", e.id).maybeSingle();
          if (data && data.valor !== null && data.valor !== undefined) continue;
        }
        await api.setValor(act.id, e.id, v); aplicados.push(e.id);
      }
      onAplicado(); onClose();
      alert(`Listo: nota de asistencia puesta a ${aplicados.length} estudiante(s) en "${act.nombre}". Puedes ajustar cualquier casilla a mano.`);
    } catch (e) { alert("Error: " + e.message); }
    setAplicando(false);
  };

  return (
    <Cascaron titulo="📋 Nota actitudinal desde la asistencia" onClose={onClose} ancho="max-w-2xl">
      <p className="text-xs text-slate-500 mb-3">
        Se calcula con las asistencias que tomaste en <b>esta materia</b>: el porcentaje de clases cumplidas se convierte a la escala de la planilla
        ({config.escala_min ?? 1}–{config.nota_maxima ?? 5}). La nota queda como una columna normal de la Planilla, así que puedes retocarla casilla por casilla.
      </p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="col-span-2">
          <label className="text-xs text-slate-500 block mb-1">Columna de la Planilla</label>
          <select value={destino} onChange={(e) => setDestino(e.target.value)} className="w-full text-sm rounded-lg px-2 py-2 border border-slate-200 outline-none">
            <option value="nueva">➕ Crear columna nueva</option>
            {manuales.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </div>
        {destino === "nueva" && (<>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la columna" className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
          <select value={categoriaId} onChange={(e) => setCategoriaId(parseInt(e.target.value, 10))} className="text-sm rounded-lg px-2 py-2 border border-slate-200 outline-none">
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({c.porcentaje}%)</option>)}
          </select>
        </>)}
        <div><label className="text-xs text-slate-500 block mb-1">Desde (opcional)</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" /></div>
        <div><label className="text-xs text-slate-500 block mb-1">Hasta (opcional)</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" /></div>
      </div>
      <p className="text-[11px] text-slate-400 mb-2">Tip: pon aquí las fechas del periodo {periodo} para que solo cuenten sus clases.</p>
      <div className="bg-slate-50 rounded-lg p-2 mb-3">
        <p className="text-xs text-slate-600 mb-1.5">¿Cuánto vale cada clase? (Presente = 1; entre 0 y 1)</p>
        <div className="flex gap-3 flex-wrap text-xs">
          {[["R", "Retardo"], ["FJ", "Falta justificada"], ["FI", "Falta injustificada"]].map(([k, l]) => (
            <label key={k} className="flex items-center gap-1" style={{ color: CODIGOS[k].texto }}>{l}
              <input type="number" step="0.1" min="0" max="1" value={pesos[k]} onChange={(e) => setPesos({ ...pesos, [k]: num(e.target.value) })}
                className="w-14 text-xs rounded px-1 py-0.5 border border-slate-200 outline-none text-slate-700" />
            </label>
          ))}
        </div>
      </div>
      {error && <div className="text-xs text-rose-500 mb-2">{error}</div>}
      {!filas ? <div className="text-sm text-slate-400">Cargando asistencia…</div> : (
        <>
          <p className="text-xs text-slate-500 mb-1">{clases} clase(s) con asistencia registrada en este rango.</p>
          {clases === 0 && <p className="text-xs text-amber-600 mb-2">Aún no hay asistencia tomada en esta materia en ese rango, no hay nada que calcular.</p>}
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-3 max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0"><tr>
                <th className="text-left px-2 py-1.5">Estudiante</th>
                {["P", "R", "FJ", "FI"].map((k) => <th key={k} className="px-1 py-1.5" style={{ color: CODIGOS[k].texto }}>{k}</th>)}
                <th className="px-2 py-1.5">Nota</th></tr></thead>
              <tbody>{estudiantes.map((e) => { const t = tot[e.id] || {}; return (
                <tr key={e.id} className="odd:bg-white even:bg-slate-50">
                  <td className="px-2 py-1">{e.nombre}</td>
                  {["P", "R", "FJ", "FI"].map((k) => <td key={k} className="text-center">{t[k] || 0}</td>)}
                  <td className="text-center font-bold text-violet-600">{notas[e.id] ?? "—"}</td></tr>); })}</tbody>
            </table>
          </div>
        </>
      )}
      {actDestino && (
        <label className="flex items-start gap-2 text-xs text-slate-600 mb-3 bg-violet-50 rounded-lg p-2">
          <input type="checkbox" checked={soloVacios} onChange={(e) => setSoloVacios(e.target.checked)} className="mt-0.5" />
          <span>Solo rellenar los que están <b>sin nota</b> (no pisa lo que ya ajustaste a mano).</span>
        </label>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={aplicando || !filas || clases === 0} onClick={aplicar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-40">
          {aplicando ? "Aplicando…" : actDestino ? "Poner / actualizar notas" : "Crear columna y poner notas"}
        </button>
      </div>
    </Cascaron>
  );
}

/* ============ 2) Mirada rápida: fechas × estudiantes ============ */
export function AsistenciaMatrizModal({ materiaId, gradoId, materias, estudiantes, nombreCurso, onClose }) {
  const [alcance, setAlcance] = useState(String(materiaId)); // id de materia | "todas"
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [vista, setVista] = useState("resumen"); // resumen | matriz
  const [filas, setFilas] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [error, setError] = useState("");
  const nombreMateria = (id) => materias.find((m) => m.id === id)?.nombre || (id ? `Materia ${id}` : "Sin materia");

  useEffect(() => {
    let vivo = true; setFilas(null); setError("");
    traerAsistencia(estudiantes.map((e) => e.id), alcance === "todas" ? null : parseInt(alcance, 10), desde || null, hasta || null)
      .then((f) => vivo && setFilas(f)).catch((e) => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [alcance, desde, hasta, estudiantes.length]);

  const clases = useMemo(() => {
    if (!filas) return [];
    const m = new Map();
    filas.forEach((r) => { const k = `${r.fecha}|${r.materia_id ?? ""}`; if (!m.has(k)) m.set(k, { key: k, fecha: r.fecha, materia_id: r.materia_id }); });
    return [...m.values()].sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.materia_id || 0) - (b.materia_id || 0));
  }, [filas]);
  const celda = useMemo(() => {
    const c = {}; (filas || []).forEach((r) => { c[`${r.estudiante_id}|${r.fecha}|${r.materia_id ?? ""}`] = r; }); return c;
  }, [filas]);
  const tot = useMemo(() => totalesPorEstudiante(estudiantes, filas || []), [filas, estudiantes]);
  const ordenados = useMemo(() => [...estudiantes].sort((a, b) => {
    const ta = tot[a.id], tb = tot[b.id];
    return (tb.FI * 3 + tb.R) - (ta.FI * 3 + ta.R) || a.nombre.localeCompare(b.nombre);
  }), [estudiantes, tot]);
  const detalleDe = (id) => (filas || []).filter((r) => r.estudiante_id === id && r.codigo !== "P").sort((a, b) => a.fecha.localeCompare(b.fecha));
  const pct = (t) => (t.total ? Math.round(((t.P + t.FJ) / t.total) * 100) : null);
  const alcanceTxt = alcance === "todas" ? "Todas las materias" : nombreMateria(parseInt(alcance, 10));

  const excel = () => {
    const wb = XLSX.utils.book_new();
    const resumen = ordenados.map((e) => ({ Estudiante: e.nombre, Presentes: tot[e.id].P, Retardos: tot[e.id].R, "Faltas justificadas": tot[e.id].FJ, "Faltas injustificadas": tot[e.id].FI, "Clases registradas": tot[e.id].total, "% asistencia": pct(tot[e.id]) }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), "Resumen");
    const matriz = estudiantes.map((e) => { const f = { Estudiante: e.nombre }; clases.forEach((c) => { f[`${fmtFecha(c.fecha)}${alcance === "todas" ? " " + nombreMateria(c.materia_id) : ""}`] = celda[`${e.id}|${c.fecha}|${c.materia_id ?? ""}`]?.codigo || ""; }); return f; });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matriz), "Por fechas");
    XLSX.writeFile(wb, `Asistencia_${(nombreCurso || "curso").replace(/\W+/g, "_")}.xlsx`);
  };
  const pdf = () => {
    const celdaHtml = (c) => c ? `<td style="background:${CODIGOS[c.codigo]?.fondo};color:${CODIGOS[c.codigo]?.texto};text-align:center;font-weight:700">${esc(c.codigo)}</td>` : `<td></td>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Asistencia</title><style>
      @page{size:landscape;margin:12mm}body{font-family:Arial,sans-serif;font-size:10px;color:#1e293b}h1{font-size:15px;margin:0}
      table{border-collapse:collapse;width:100%;margin-top:8px}th,td{border:1px solid #cbd5e1;padding:3px 4px}th{background:#f1f5f9;font-size:9px}td.n{white-space:nowrap}
      h2{font-size:12px;margin:14px 0 0}</style></head><body>
      <h1>📋 Asistencia — ${esc(nombreCurso || "")}</h1><div>${esc(alcanceTxt)}${desde || hasta ? ` · ${esc(desde || "…")} a ${esc(hasta || "…")}` : ""}</div>
      <h2>Resumen (más novedades primero)</h2><table><tr><th>Estudiante</th><th>P</th><th>R</th><th>FJ</th><th>FI</th><th>Clases</th><th>% asist.</th></tr>
      ${ordenados.map((e) => { const t = tot[e.id]; return `<tr><td class="n">${esc(e.nombre)}</td><td align=center>${t.P}</td><td align=center>${t.R}</td><td align=center>${t.FJ}</td><td align=center>${t.FI}</td><td align=center>${t.total}</td><td align=center>${pct(t) ?? "—"}${pct(t) !== null ? "%" : ""}</td></tr>`; }).join("")}</table>
      <h2>Por fechas</h2><table><tr><th>Estudiante</th>${clases.map((c) => `<th>${fmtFecha(c.fecha)}${alcance === "todas" ? `<br>${esc(nombreMateria(c.materia_id).slice(0, 8))}` : ""}</th>`).join("")}</tr>
      ${estudiantes.map((e) => `<tr><td class="n">${esc(e.nombre)}</td>${clases.map((c) => celdaHtml(celda[`${e.id}|${c.fecha}|${c.materia_id ?? ""}`])).join("")}</tr>`).join("")}</table>
      <p>P presente · R retardo · FJ falta justificada · FI falta injustificada</p><script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`;
    api.abrirDocumentoParaImprimir(html);
  };

  const chip = (act, f, txt) => <button onClick={f} className={`text-xs font-semibold px-3 py-1.5 rounded-full ${act ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-600"}`}>{txt}</button>;

  return (
    <Cascaron titulo="📋 Asistencia por fechas" onClose={onClose} ancho="max-w-5xl">
      <div className="flex flex-wrap gap-2 items-end mb-3">
        <div><label className="text-[11px] text-slate-500 block">Materia</label>
          <select value={alcance} onChange={(e) => setAlcance(e.target.value)} className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none">
            <option value="todas">Todas las materias</option>
            {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select></div>
        <div><label className="text-[11px] text-slate-500 block">Desde</label><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" /></div>
        <div><label className="text-[11px] text-slate-500 block">Hasta</label><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" /></div>
        <div className="flex gap-1">{chip(vista === "resumen", () => setVista("resumen"), "⚡ Resumen")}{chip(vista === "matriz", () => setVista("matriz"), "🗓️ Por fechas")}</div>
        <div className="flex gap-1 ml-auto">
          <button onClick={excel} disabled={!filas} className="text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 disabled:opacity-40">Excel</button>
          <button onClick={pdf} disabled={!filas} className="text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 disabled:opacity-40">PDF</button>
        </div>
      </div>
      {error && <div className="text-xs text-rose-500 mb-2">{error}</div>}
      {!filas ? <div className="text-sm text-slate-400">Cargando…</div> : clases.length === 0 ? (
        <div className="text-sm text-slate-400">No hay asistencia registrada con esos filtros.</div>
      ) : vista === "resumen" ? (
        <>
          <p className="text-xs text-slate-500 mb-2">{clases.length} clase(s) registradas · primero quienes más retardos e inasistencias tienen. Toca un nombre para ver en qué fechas.</p>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50"><tr><th className="text-left px-2 py-1.5">Estudiante</th>
                {["R", "FJ", "FI"].map((k) => <th key={k} className="px-2 py-1.5" style={{ color: CODIGOS[k].texto }}>{CODIGOS[k].label}</th>)}
                <th className="px-2 py-1.5">% asist.</th></tr></thead>
              <tbody>{ordenados.map((e) => { const t = tot[e.id]; const p = pct(t); const det = abierto === e.id ? detalleDe(e.id) : null; return (
                <React.Fragment key={e.id}>
                  <tr onClick={() => setAbierto(abierto === e.id ? null : e.id)} className="odd:bg-white even:bg-slate-50 cursor-pointer">
                    <td className="px-2 py-1.5 font-medium text-slate-700">{e.nombre}</td>
                    {["R", "FJ", "FI"].map((k) => <td key={k} className="text-center"><span className="inline-block min-w-[22px] rounded px-1 font-bold" style={t[k] ? { background: CODIGOS[k].fondo, color: CODIGOS[k].texto } : { color: "#cbd5e1" }}>{t[k]}</span></td>)}
                    <td className="text-center font-semibold" style={{ color: p === null ? "#94a3b8" : p < 80 ? "#B91C1C" : p < 90 ? "#B45309" : "#15803D" }}>{p === null ? "—" : p + "%"}</td>
                  </tr>
                  {det && (<tr><td colSpan={5} className="bg-white px-3 py-2">
                    {det.length === 0 ? <span className="text-slate-400">Sin novedades 🎉</span> : (
                      <div className="flex flex-wrap gap-1.5">{det.map((r, i) => (
                        <span key={i} className="rounded px-1.5 py-0.5" style={{ background: CODIGOS[r.codigo]?.fondo, color: CODIGOS[r.codigo]?.texto }} title={r.observacion || undefined}>
                          {fmtFecha(r.fecha)} · {r.codigo}{alcance === "todas" ? ` · ${nombreMateria(r.materia_id)}` : ""}{r.observacion ? " 📝" : ""}</span>))}</div>)}
                  </td></tr>)}
                </React.Fragment>); })}</tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="overflow-auto border border-slate-200 rounded-lg" style={{ maxHeight: "60vh" }}>
          <table className="text-[11px] border-collapse">
            <thead><tr>
              <th className="sticky left-0 top-0 z-20 bg-slate-50 text-left px-2 py-1.5 min-w-[170px] border-b border-slate-200">Estudiante</th>
              {clases.map((c) => (
                <th key={c.key} className="sticky top-0 z-10 bg-slate-50 px-1.5 py-1 border-b border-slate-200 min-w-[38px] font-semibold">
                  {fmtFecha(c.fecha)}{alcance === "todas" && <div className="text-[9px] font-normal text-slate-400">{nombreMateria(c.materia_id).slice(0, 7)}</div>}</th>))}
              {["R", "FJ", "FI"].map((k) => <th key={k} className="sticky top-0 z-10 bg-slate-50 px-2 border-b border-slate-200" style={{ color: CODIGOS[k].texto }}>{k}</th>)}
            </tr></thead>
            <tbody>{estudiantes.map((e) => (
              <tr key={e.id}>
                <td className="sticky left-0 bg-white px-2 py-1 font-medium text-slate-700 whitespace-nowrap border-b border-slate-100">{e.nombre}</td>
                {clases.map((c) => { const r = celda[`${e.id}|${c.fecha}|${c.materia_id ?? ""}`]; return (
                  <td key={c.key} title={r?.observacion || undefined} className="text-center font-bold border-b border-slate-100"
                    style={r ? { background: CODIGOS[r.codigo]?.fondo, color: CODIGOS[r.codigo]?.texto } : {}}>{r ? r.codigo : ""}</td>); })}
                {["R", "FJ", "FI"].map((k) => <td key={k} className="text-center font-bold border-b border-slate-100" style={{ color: CODIGOS[k].texto }}>{tot[e.id][k] || ""}</td>)}
              </tr>))}</tbody>
          </table>
        </div>
      )}
      <div className="flex gap-3 flex-wrap mt-3 text-[11px]">
        {Object.entries(CODIGOS).map(([k, v]) => <span key={k} className="rounded px-1.5 py-0.5" style={{ background: v.fondo, color: v.texto }}>{k} = {v.label}</span>)}
      </div>
    </Cascaron>
  );
}
