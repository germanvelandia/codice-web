import React, { useState } from "react";

// Calcula la nota a partir de los puntos de la rúbrica, respetando la
// escala REAL configurada en la Planilla (min/max) de esa materia.
export function calcularNotaRubrica(rubrica, nivelesElegidos, config) {
  const escalaMin = config?.escala_min ?? 1;
  const escalaMax = config?.nota_maxima ?? 5;
  // La nota va de escalaMin (todo en el nivel más bajo) a escalaMax (todo en el más alto).
  // Un criterio sin nivel elegido cuenta como su nivel más bajo.
  let obtenidos = 0, maximos = 0, minimos = 0;
  rubrica.forEach((c, i) => {
    const pts = c.niveles.map((n) => Number(n.puntos) || 0);
    const maxCriterio = Math.max(...pts), minCriterio = Math.min(...pts);
    maximos += maxCriterio; minimos += minCriterio;
    const elegido = nivelesElegidos[i];
    obtenidos += elegido !== undefined && c.niveles[elegido] ? Number(c.niveles[elegido].puntos) || 0 : minCriterio;
  });
  const rango = maximos - minimos;
  const nota = rango > 0 ? Math.round((escalaMin + ((obtenidos - minimos) / rango) * (escalaMax - escalaMin)) * 10) / 10 : escalaMin;
  const completa = rubrica.length > 0 && rubrica.every((_, i) => nivelesElegidos[i] !== undefined);
  return { obtenidos, maximos, minimos, nota, escalaMin, escalaMax, completa };
}

// Selector de rúbrica reutilizable — usado para calificar tanto desde La
// Forja (individual o por reino) como directo desde la Planilla de
// Calificaciones.
// Editor de los niveles de UN criterio: nombre, puntos y descripción de cada nivel (en filas, no en tarjetitas).
export function NivelesEditor({ criterio, i, actualizarNivel, quitarNivel, agregarNivel }) {
  return (
    <div className="space-y-2">
      {criterio.niveles.map((n, j) => (
        <div key={j} className="bg-slate-50 rounded-lg p-2">
          <div className="flex items-center gap-2 mb-1">
            <input value={n.nombre} onChange={(e) => actualizarNivel(i, j, "nombre", e.target.value)} placeholder="Nivel"
              className="flex-1 min-w-0 text-xs font-semibold rounded px-2 py-1 border border-slate-200 outline-none" />
            <input type="number" value={n.puntos} onChange={(e) => actualizarNivel(i, j, "puntos", e.target.value)} placeholder="Pts"
              className="w-16 text-xs rounded px-2 py-1 border border-slate-200 outline-none" />
            <span className="text-[10px] text-slate-400">pts</span>
            {quitarNivel && <button onClick={() => quitarNivel(i, j)} className="text-slate-300 hover:text-rose-500 text-xs" title="Quitar este nivel">✕</button>}
          </div>
          <textarea value={n.descripcion || ""} onChange={(e) => actualizarNivel(i, j, "descripcion", e.target.value)} rows={2}
            placeholder="¿Qué logra el estudiante en este nivel? (descriptor)"
            className="w-full text-xs rounded px-2 py-1 border border-slate-200 outline-none bg-white" />
        </div>
      ))}
      {agregarNivel && <button onClick={() => agregarNivel(i)} className="text-xs text-violet-500 border border-dashed border-violet-300 rounded-lg px-3 py-1">+ Nivel</button>}
    </div>
  );
}

export function SelectorRubrica({ rubrica, nivelesElegidos, onElegir, config }) {
  const { obtenidos, maximos, nota, escalaMin, escalaMax } = calcularNotaRubrica(rubrica, nivelesElegidos, config);
  return (
    <div className="bg-white rounded-lg p-3 border border-violet-100 space-y-2">
      {rubrica.map((c, i) => (
        <div key={i}>
          <div className="text-[11px] font-semibold text-slate-600 mb-1">{c.criterio}</div>
          <div className="flex flex-wrap gap-1.5">
            {c.niveles.map((n, j) => (
              <button key={j} onClick={() => onElegir(i, j)} title={n.descripcion || ""}
                className={`text-[11px] px-2 py-1 rounded-full border ${nivelesElegidos[i] === j ? "bg-violet-500 text-white border-violet-500" : "bg-white text-slate-600 border-slate-200"}`}>
                {n.nombre} ({n.puntos})
              </button>
            ))}
          </div>
          {c.niveles[nivelesElegidos[i]]?.descripcion && (
            <div className="text-[11px] text-slate-500 mt-1 bg-violet-50 rounded-lg px-2 py-1">{c.niveles[nivelesElegidos[i]].descripcion}</div>
          )}
        </div>
      ))}
      <div className="text-xs text-slate-500 pt-1 border-t border-slate-100">
        {obtenidos}/{maximos} pts → nota <b>{nota}</b> <span className="text-slate-400">(escala {escalaMin}–{escalaMax})</span>
      </div>
    </div>
  );
}


// ---------- Rúbrica en CUADRÍCULA: criterios en filas, niveles en columnas y una columna de observaciones ----------
// Con onElegir es editable (docente); sin él es de solo lectura (estudiante).
export function RubricaGrid({ rubrica, niveles = {}, observaciones = {}, onElegir, onObservacion, onObservacionBlur, config, nota: notaFija }) {
  const editable = !!onElegir;
  const nombres = [];
  rubrica.forEach((c) => c.niveles.forEach((n) => { if (!nombres.includes(n.nombre)) nombres.push(n.nombre); }));
  const r = calcularNotaRubrica(rubrica, niveles, config);
  const nota = notaFija ?? r.nota;
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-[11px] border-collapse" style={{ minWidth: 120 + nombres.length * 130 + 170 }}>
          <thead>
            <tr className="bg-violet-50 text-slate-600">
              <th className="text-left p-2 border-b border-slate-200 w-28">Criterio</th>
              {nombres.map((nom) => <th key={nom} className="p-2 border-b border-l border-slate-200 text-center">{nom}</th>)}
              <th className="p-2 border-b border-l border-slate-200 text-left w-44">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {rubrica.map((c, i) => (
              <tr key={i} className="align-top">
                <th className="text-left p-2 border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">{c.criterio}</th>
                {nombres.map((nom) => {
                  const j = c.niveles.findIndex((n) => n.nombre === nom);
                  if (j < 0) return <td key={nom} className="border-b border-l border-slate-200 bg-slate-50" />;
                  const n = c.niveles[j], elegido = niveles[i] === j;
                  const contenido = (<><div className={`font-bold ${elegido ? "text-violet-700" : "text-slate-500"}`}>{n.puntos} pts{elegido ? " ✔" : ""}</div><div className="text-slate-500">{n.descripcion}</div></>);
                  return (
                    <td key={nom} className={`border-b border-l border-slate-200 p-0 ${elegido ? "bg-violet-100" : (!editable && niveles[i] !== undefined ? "opacity-40" : "")}`}>
                      {editable
                        ? <button type="button" onClick={() => onElegir(i, j)} className={`w-full h-full text-left p-2 hover:bg-violet-50 ${elegido ? "bg-violet-100 ring-2 ring-inset ring-violet-400" : ""}`}>{contenido}</button>
                        : <div className="p-2">{contenido}</div>}
                    </td>
                  );
                })}
                <td className="border-b border-l border-slate-200 p-1.5">
                  {editable
                    ? <textarea value={observaciones[i] || ""} rows={3} onChange={(e) => onObservacion?.(i, e.target.value)} onBlur={() => onObservacionBlur?.()}
                        placeholder="Observación para este criterio…" className="w-full text-[11px] rounded px-1.5 py-1 border border-slate-200 outline-none" />
                    : (observaciones[i] ? <div className="text-violet-700 italic">📝 {observaciones[i]}</div> : <span className="text-slate-300">—</span>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-slate-500 pt-2">{r.obtenidos}/{r.maximos} pts → nota <b>{nota}</b> <span className="text-slate-400">(escala {r.escalaMin}–{r.escalaMax})</span></div>
    </div>
  );
}

// Para el estudiante: botón que despliega SU rúbrica calificada (si la actividad se calificó con rúbrica)
export function RubricaCalificadaAlumno({ resultado, config }) {
  const [abierta, setAbierta] = useState(false);
  if (!resultado?.rubrica?.length) return null;
  return (
    <div className="mt-1">
      <button type="button" onClick={() => setAbierta((v) => !v)} className="text-[10px] font-semibold text-violet-600 underline">{abierta ? "Ocultar rúbrica" : "📊 Ver mi rúbrica"}</button>
      {abierta && <div className="mt-1"><RubricaGrid rubrica={resultado.rubrica} niveles={resultado.niveles || {}} observaciones={resultado.observaciones || {}} nota={resultado.nota} config={config} /></div>}
    </div>
  );
}
