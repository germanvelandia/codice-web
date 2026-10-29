import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { CONFIG_DEFAULT, bandaDesempeno } from "../lib/calificaciones";
import { datosPeriodo } from "./ImpresionPlanillas";

/* ============================================================================
   🚨 Estudiantes en riesgo
   Une, por curso, las notas del periodo actual (de todas tus materias) con las
   faltas de los últimos días, y arma una lista priorizada con un mensaje
   sugerido para el acudiente. No guarda nada: solo lee y orienta.
   ============================================================================ */

const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
const haceDias = (n) => new Date(Date.now() - n * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
const fmt = (n) => (Math.round(Number(n) * 10) / 10).toFixed(1);
const porNombre = (a, b) => String(a.nombre || "").localeCompare(String(b.nombre || ""), "es");
const NIVEL = {
  alto: { label: "Riesgo alto", color: "#B91C1C", fondo: "#FEE2E2", emoji: "🔴" },
  medio: { label: "Riesgo medio", color: "#B45309", fondo: "#FEF3C7", emoji: "🟠" },
};

export function clasificarRiesgo({ perdiendo, fi, r, umbralFI = 3, umbralR = 5 }) {
  const faltas = fi >= umbralFI;
  const tardes = r >= umbralR;
  if (perdiendo.length >= 2 || (perdiendo.length >= 1 && (faltas || tardes))) return "alto";
  if (perdiendo.length === 1 || faltas || tardes) return "medio";
  return null;
}

export function mensajeAcudiente({ nombre, perdiendo, fi, r, dias }) {
  const partes = [];
  if (perdiendo.length) partes.push(`presenta dificultades académicas en ${perdiendo.map((p) => `${p.materia} (${fmt(p.nota)})`).join(", ")}`);
  if (fi >= 3) partes.push(`tiene ${fi} faltas injustificadas en los últimos ${dias} días`);
  if (r >= 5) partes.push(`ha llegado tarde ${r} veces en los últimos ${dias} días`);
  return `Cordial saludo. Le escribo para informarle que ${nombre} ${partes.join(" y ")}. Quisiera acordar con usted un compromiso para acompañar su proceso y que pueda mejorar. Quedo atento a su respuesta.`;
}

export function VistaEstudiantesRiesgo({ grados = [], gradoActivo, onIrA }) {
  const [gradoId, setGradoId] = useState(gradoActivo || grados[0]?.id || "");
  const [dias, setDias] = useState(30);
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState("");
  const [lista, setLista] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [copiado, setCopiado] = useState(null);

  useEffect(() => { if (gradoActivo) setGradoId(gradoActivo); }, [gradoActivo]);

  const analizar = async () => {
    if (!gradoId) return;
    setCargando(true); setMsg(""); setLista(null);
    try {
      const [materias, estRaw, asis] = await Promise.all([
        api.fetchMisMaterias(),
        api.fetchEstudiantesPorGrado(gradoId),
        api.fetchAsistenciaDetalladaCurso(gradoId, haceDias(dias), hoy()).catch(() => []),
      ]);
      const estudiantes = [...estRaw].sort(porNombre);
      const por = {};
      estudiantes.forEach((e) => { por[e.id] = { id: e.id, nombre: e.nombre, perdiendo: [], fi: 0, r: 0 }; });

      asis.forEach((a) => { const x = por[a.estudiante_id]; if (!x) return; if (a.codigo === "FI") x.fi++; else if (a.codigo === "R") x.r++; });

      let materiasRevisadas = 0;
      for (const m of materias) {
        const [config, categorias] = await Promise.all([
          api.fetchNotasConfig(m.id).catch(() => CONFIG_DEFAULT),
          api.fetchCategorias(m.id).catch(() => []),
        ]);
        const periodo = String(config.periodo_actual || "1");
        const acts = await api.fetchActividades(m.id, gradoId, periodo).catch(() => []);
        if (!acts.length) continue; // esa materia no tiene actividades en este curso
        materiasRevisadas++;
        const d = await datosPeriodo({ materiaId: m.id, gradoId, periodo, estudiantes, categorias, config });
        estudiantes.forEach((e) => {
          const nota = d.finalDe(e.id);
          if (nota === null || nota === undefined) return;
          if (Number(nota) < Number(config.nota_minima)) por[e.id].perdiendo.push({ materia: m.nombre, nota: Number(nota), minima: config.nota_minima });
        });
      }

      const filas = Object.values(por)
        .map((x) => ({ ...x, nivel: clasificarRiesgo(x) }))
        .filter((x) => x.nivel)
        .sort((a, b) => (a.nivel === b.nivel ? (b.perdiendo.length - a.perdiendo.length) || (b.fi - a.fi) : a.nivel === "alto" ? -1 : 1));
      setLista({ filas, total: estudiantes.length, materiasRevisadas });
    } catch (e) {
      setMsg(e.message || "No se pudo analizar el curso.");
    }
    setCargando(false);
  };

  useEffect(() => { if (gradoId) analizar(); /* eslint-disable-next-line */ }, [gradoId, dias]);

  const copiar = async (x) => {
    const t = mensajeAcudiente({ nombre: x.nombre, perdiendo: x.perdiendo, fi: x.fi, r: x.r, dias });
    try { await navigator.clipboard.writeText(t); setCopiado(x.id); setTimeout(() => setCopiado(null), 2500); } catch { window.prompt("Copia el mensaje:", t); }
  };

  const visibles = (lista?.filas || []).filter((x) => filtro === "todos" || x.nivel === filtro);
  const nAlto = (lista?.filas || []).filter((x) => x.nivel === "alto").length;
  const nMedio = (lista?.filas || []).filter((x) => x.nivel === "medio").length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-full px-3 py-1.5 border border-slate-200 bg-white">
          {grados.map((g) => <option key={g.id} value={g.id}>{g.nombre || g.id}</option>)}
        </select>
        <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className="text-sm rounded-full px-3 py-1.5 border border-slate-200 bg-white">
          <option value={15}>Faltas: últimos 15 días</option>
          <option value={30}>Faltas: últimos 30 días</option>
          <option value={60}>Faltas: últimos 60 días</option>
        </select>
        <button onClick={analizar} disabled={cargando} className="text-xs font-semibold px-4 py-2 rounded-full bg-violet-500 text-white disabled:opacity-50">
          {cargando ? "Analizando…" : "🔄 Volver a analizar"}
        </button>
      </div>

      <p className="text-[11px] text-slate-500 mb-3">
        Cuenta como <b>perdiendo</b> una materia con nota del periodo actual por debajo de la mínima. <b>Riesgo alto:</b> pierde 2 o más materias, o pierde una y además tiene 3+ faltas injustificadas o 5+ retardos. <b>Riesgo medio:</b> pierde una materia, o tiene 3+ faltas injustificadas o 5+ retardos.
      </p>

      {msg && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2 mb-3">{msg}</div>}
      {cargando && <div className="text-sm text-slate-400">Revisando notas y asistencia de tus materias…</div>}

      {lista && !cargando && (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            {[["todos", `Todos (${lista.filas.length})`], ["alto", `🔴 Alto (${nAlto})`], ["medio", `🟠 Medio (${nMedio})`]].map(([k, t]) => (
              <button key={k} onClick={() => setFiltro(k)} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${filtro === k ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200"}`}>{t}</button>
            ))}
            <span className="text-[11px] text-slate-400 self-center">{lista.total} estudiantes · {lista.materiasRevisadas} {lista.materiasRevisadas === 1 ? "materia revisada" : "materias revisadas"}</span>
          </div>

          {lista.materiasRevisadas === 0 && (
            <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4">Ninguna de tus materias tiene actividades en este curso para el periodo actual, así que no hay notas que analizar.</div>
          )}
          {lista.materiasRevisadas > 0 && lista.filas.length === 0 && (
            <div className="text-sm text-emerald-700 bg-emerald-50 rounded-xl p-4">✅ Ningún estudiante de este curso está en riesgo según estas reglas. ¡Buen trabajo!</div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {visibles.map((x) => {
              const n = NIVEL[x.nivel];
              return (
                <div key={x.id} className="rounded-2xl bg-white p-3" style={{ border: `1px solid ${n.color}55`, borderLeft: `5px solid ${n.color}` }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-extrabold text-slate-800 text-sm leading-tight">{x.nombre}</div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0" style={{ background: n.fondo, color: n.color }}>{n.emoji} {n.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {x.perdiendo.map((p) => {
                      const b = bandaDesempeno(p.nota, { ...CONFIG_DEFAULT, nota_minima: p.minima }) || { color: "#B91C1C" };
                      return <span key={p.materia} className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${b.color}22`, color: b.color }}>📉 {p.materia}: {fmt(p.nota)}</span>;
                    })}
                    {x.fi > 0 && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">🚫 {x.fi} FI</span>}
                    {x.r > 0 && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">⏰ {x.r} retardos</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button onClick={() => copiar(x)} className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-violet-300 text-violet-700">
                      {copiado === x.id ? "✅ Copiado" : "📋 Copiar mensaje para el acudiente"}
                    </button>
                    {onIrA && <button onClick={() => onIrA("anotaciones")} className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-slate-300 text-slate-600">📝 Ir a Anotaciones</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
