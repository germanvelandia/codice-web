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

      <p className="text-[11px] text-slate-500 mb-3">
        Aparecen los estudiantes con nota del periodo por debajo de <b>{minimaNum ?? "—"}</b>. Si la recuperación alcanza esa mínima, la nota del periodo queda en <b>{minimaNum ?? "—"}</b> (la nota original se conserva).
        Si no la alcanza, la nota no cambia. Si borras la recuperación, vuelve la nota original. Marca el <b>Estado</b> de cada estudiante (Sin marcar, Pendiente, En proceso, Superado) igual que en Planillas, y filtra por estado para ver quiénes ya entregaron y quiénes no. Cambiar la mínima aquí afecta esta planilla; usa «Guardar en la materia» para que sea la de siempre.
      </p>
      {aviso && <div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mb-2">{aviso}</div>}
      {error && <div className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2 mb-2">{error}</div>}
      {cargando && <div className="text-sm text-slate-400">Cargando…</div>}

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
    </div>
  );
}
