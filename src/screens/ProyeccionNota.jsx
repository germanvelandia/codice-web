import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { bandaDesempeno } from "../lib/calificaciones";
import { calcularProyeccion } from "../lib/proyeccionNota";

const CONFIG = { escala_min: 1, nota_minima: 3.5, nota_maxima: 5 };

// Desglose por categoría + "¿cuánto necesito en lo que falta?" para un periodo en curso.
// Va dentro de "Mis notas" (portal del estudiante), debajo de la lista de actividades.
export default function ProyeccionNota({ materiaId, actividades }) {
  const [cats, setCats] = useState(null);

  useEffect(() => {
    let vivo = true;
    if (materiaId == null) { setCats([]); return () => { vivo = false; }; }
    api.fetchCategorias(materiaId).then((c) => { if (vivo) setCats(c); }).catch(() => { if (vivo) setCats([]); });
    return () => { vivo = false; };
  }, [materiaId]);

  if (!cats || cats.length === 0) return null;
  return <PanelProyeccion cats={cats} actividades={actividades} />;
}

export function PanelProyeccion({ cats, actividades }) {
  const valores = (actividades || []).map((a) => ({ categoria_id: a.notas_actividades?.categoria_id, valor: a.valor }));
  const p = calcularProyeccion(cats, valores, { notaMinima: CONFIG.nota_minima, notaMinimaEscala: CONFIG.escala_min, notaMaxima: CONFIG.nota_maxima });
  if (p.tipo === "sin_notas") return null;

  const caja = {
    asegurado: ["bg-emerald-50 border-emerald-200 text-emerald-700", `✅ Ya tienes asegurado como mínimo ${p.peor} en este periodo, aunque lo que falta salga muy bajo.`],
    necesita: ["bg-amber-50 border-amber-200 text-amber-800",
      `🎯 Para llegar a ${CONFIG.nota_minima} necesitas promediar al menos ${p.necesario} en lo que falta (${p.pendientes.join(", ")}: ${p.pesoPendiente}% de la nota). Tu nota podría quedar entre ${p.peor} y ${p.mejor}.`],
    imposible: ["bg-rose-50 border-rose-200 text-rose-700",
      `⚠️ Con lo que falta (${p.pendientes.join(", ")}), la mejor nota posible sería ${p.mejor}. Habla con tu docente para ver cómo recuperar.`],
    sin_pendientes: ["bg-slate-50 border-slate-200 text-slate-600", "Todas las categorías ya tienen nota. Tu nota solo cambia si el docente agrega o modifica actividades."],
  }[p.tipo];

  return (
    <div className="mt-2 rounded-lg bg-white border border-slate-200 p-2.5">
      <div className="text-[11px] font-bold text-slate-600 mb-1.5">📊 Cómo se forma tu nota</div>
      <div className="space-y-1.5">
        {p.filas.map((f) => {
          const b = f.promedio === null ? null : bandaDesempeno(f.promedio, CONFIG);
          const ancho = f.promedio === null ? 0 : Math.max(4, Math.min(100, (f.promedio / CONFIG.nota_maxima) * 100));
          return (
            <div key={f.id}>
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>{f.nombre} <span className="text-slate-400">· {f.porcentaje}%</span></span>
                <span className="font-semibold" style={b ? { color: b.color } : undefined}>
                  {f.promedio === null ? "sin notas aún" : `${f.promedio} (${f.cantidad} ${f.cantidad === 1 ? "nota" : "notas"})`}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${ancho}%`, background: b ? b.color : "transparent" }} />
              </div>
            </div>
          );
        })}
      </div>
      {caja && <div className={`mt-2 text-[11px] rounded-lg border p-2 ${caja[0]}`}>{caja[1]}</div>}
      <div className="text-[10px] text-slate-400 mt-1.5">Es una estimación: puede cambiar si el docente agrega o modifica actividades.</div>
    </div>
  );
}
