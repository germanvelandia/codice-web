import React from "react";

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
