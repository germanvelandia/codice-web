import React from "react";

// Calcula la nota a partir de los puntos de la rúbrica, respetando la
// escala REAL configurada en la Planilla (min/max) de esa materia.
export function calcularNotaRubrica(rubrica, nivelesElegidos, config) {
  const escalaMin = config?.escala_min ?? 1;
  const escalaMax = config?.nota_maxima ?? 5;
  let obtenidos = 0, maximos = 0;
  rubrica.forEach((c, i) => {
    const maxCriterio = Math.max(...c.niveles.map((n) => n.puntos));
    maximos += maxCriterio;
    const elegido = nivelesElegidos[i];
    if (elegido !== undefined) obtenidos += c.niveles[elegido].puntos;
  });
  const nota = maximos > 0 ? Math.round((escalaMin + (obtenidos / maximos) * (escalaMax - escalaMin)) * 10) / 10 : escalaMin;
  return { obtenidos, maximos, nota, escalaMin, escalaMax };
}

// Selector de rúbrica reutilizable — usado para calificar tanto desde La
// Forja (individual o por reino) como directo desde la Planilla de
// Calificaciones.
export function SelectorRubrica({ rubrica, nivelesElegidos, onElegir, config }) {
  const { obtenidos, maximos, nota, escalaMin, escalaMax } = calcularNotaRubrica(rubrica, nivelesElegidos, config);
  return (
    <div className="bg-white rounded-lg p-3 border border-violet-100 space-y-2">
      {rubrica.map((c, i) => (
        <div key={i}>
          <div className="text-[11px] font-semibold text-slate-600 mb-1">{c.criterio}</div>
          <div className="flex flex-wrap gap-1.5">
            {c.niveles.map((n, j) => (
              <button key={j} onClick={() => onElegir(i, j)}
                className={`text-[11px] px-2 py-1 rounded-full border ${nivelesElegidos[i] === j ? "bg-violet-500 text-white border-violet-500" : "bg-white text-slate-600 border-slate-200"}`}>
                {n.nombre} ({n.puntos})
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="text-xs text-slate-500 pt-1 border-t border-slate-100">
        {obtenidos}/{maximos} pts → nota <b>{nota}</b> <span className="text-slate-400">(escala {escalaMin}–{escalaMax})</span>
      </div>
    </div>
  );
}
