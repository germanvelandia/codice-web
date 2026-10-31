import { bandaDesempeno, notaFinalPonderada } from "../lib/calificaciones";
import React, { useEffect, useState } from "react";
import { fetchPeriodosActualesEstudiante } from "../lib/periodoActualApi";
import * as api from "../lib/api";
import { RubricaCalificadaAlumno } from "../components/Rubrica";
import BonoEnCurso from "../screens/BonoEnCurso";
import ProyeccionNota from "../screens/ProyeccionNota";
import { TextoEnriquecido } from "../components/RichText";
import { bajoMinima, estadoFecha, textoPenalizacion } from "../lib/tareasLimites";
import { CATEGORIA_INFO_ESTUDIANTE } from "./EstudianteComunidad";

// Resume, por materia, los periodos con nota (final o en curso calculada en vivo) —
// misma lógica que usa "Mis notas", reutilizada acá para el aviso general.
export function resumenPorMateria(datos) {
  const materias = {};
  datos.finales.forEach((f) => {
    const nombre = f.materias?.nombre || `Materia ${f.materia_id}`;
    materias[nombre] = materias[nombre] || { finales: {}, actividadesPorPeriodo: {} };
    materias[nombre].finales[f.periodo] = f.nota;
  });
  datos.valores.forEach((v) => {
    const act = v.notas_actividades;
    if (!act) return;
    const nombre = act.materias?.nombre || `Materia ${act.materia_id}`;
    materias[nombre] = materias[nombre] || { finales: {}, actividadesPorPeriodo: {} };
    materias[nombre].actividadesPorPeriodo[act.periodo] = materias[nombre].actividadesPorPeriodo[act.periodo] || [];
    materias[nombre].actividadesPorPeriodo[act.periodo].push(v);
  });

  const resultado = {};
  Object.entries(materias).forEach(([nombre, m]) => {
    const periodos = [...new Set([...Object.keys(m.finales), ...Object.keys(m.actividadesPorPeriodo)])].sort();
    resultado[nombre] = periodos.map((periodo) => {
      const actividadesPeriodo = m.actividadesPorPeriodo[periodo] || [];
      if (Object.prototype.hasOwnProperty.call(m.finales, periodo)) {
        return { periodo, nota: m.finales[periodo], enCurso: false };
      }
      const porCategoria = {};
      const categoriasVistas = {};
      actividadesPeriodo.forEach((a) => {
        const cat = a.notas_actividades?.notas_categorias;
        const catId = a.notas_actividades?.categoria_id;
        if (!catId) return;
        categoriasVistas[catId] = { id: catId, porcentaje: cat?.porcentaje || 0 };
        porCategoria[catId] = porCategoria[catId] || [];
        porCategoria[catId].push(a.valor);
      });
      return { periodo, nota: notaFinalPonderada(porCategoria, Object.values(categoriasVistas)), enCurso: true };
    });
  });
  return resultado;
}

export function AvisoRendimiento({ estudianteId }) {
  const [resumen, setResumen] = useState(null);

  useEffect(() => {
    api.fetchNotasEstudiante(estudianteId).then((d) => setResumen(resumenPorMateria(d))).catch(() => setResumen({}));
  }, [estudianteId]);

  if (!resumen) return null;
  const config = { escala_min: 1, nota_minima: 3.5, nota_maxima: 5 };

  const estados = Object.entries(resumen)
    .map(([nombre, filas]) => {
      const ultima = filas[filas.length - 1];
      return { nombre, nota: ultima?.nota ?? null };
    })
    .filter((e) => e.nota !== null);

  if (estados.length === 0) return null;

  const enRiesgo = estados.filter((e) => bandaDesempeno(e.nota, config).key === "bajo");

  if (enRiesgo.length > 0) {
    return (
      <div className="rounded-xl p-3 mb-4 bg-rose-50 border border-rose-200">
        <div className="text-sm font-bold text-rose-700">⚠️ Rendimiento académico en riesgo</div>
        <div className="text-xs text-rose-600 mt-1">Estás perdiendo: {enRiesgo.map((e) => e.nombre).join(", ")}. Hablá con tu docente para ponerte al día.</div>
      </div>
    );
  }

  const promedio = estados.reduce((a, e) => a + e.nota, 0) / estados.length;
  const bandaGeneral = bandaDesempeno(promedio, config);
  const mensajes = {
    basico: "Vas cumpliendo lo mínimo. ¡Con un poco más de esfuerzo podés subir de nivel!",
    alto: "Buen desempeño general. ¡Seguí así!",
    superior: "¡Excelente desempeño! Tu esfuerzo se nota.",
  };
  return (
    <div className="rounded-xl p-3 mb-4" style={{ background: `${bandaGeneral.color}15`, border: `1px solid ${bandaGeneral.color}55` }}>
      <div className="text-sm font-bold" style={{ color: bandaGeneral.color }}>
        {bandaGeneral.key === "superior" ? "🌟" : bandaGeneral.key === "alto" ? "👍" : "💪"} {bandaGeneral.label} desempeño académico
      </div>
      <div className="text-xs mt-1" style={{ color: bandaGeneral.color }}>{mensajes[bandaGeneral.key]}</div>
    </div>
  );
}

// Tarjeta de resumen con todas las materias: promedio general, la más fuerte y la que necesita atención.
export function ResumenGeneral({ materias, config }) {
  const con = materias.filter((m) => m.actual && m.actual.nota != null).map((m) => ({ nombre: m.nombre, nota: Number(m.actual.nota) }));
  if (con.length === 0) return null;
  const prom = Math.round((con.reduce((a, m) => a + m.nota, 0) / con.length) * 10) / 10;
  const b = bandaDesempeno(prom, config) || { color: "#94A3B8", label: "" };
  const orden = [...con].sort((x, y) => y.nota - x.nota);
  const mejor = orden[0];
  const peor = orden[orden.length - 1];
  const enRiesgo = con.filter((m) => m.nota < config.nota_minima).length;
  return (
    <div className="rounded-2xl p-3 mb-3 grid gap-2 sm:grid-cols-3" style={{ background: `${b.color}12`, border: `1px solid ${b.color}40` }}>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Promedio del periodo actual</div>
        <div className="text-2xl font-extrabold leading-tight" style={{ color: b.color }}>{prom} <span className="text-xs font-bold">{b.label}</span></div>
        <div className="text-[10px] text-slate-500">{con.length} {con.length === 1 ? "materia" : "materias"}{enRiesgo > 0 ? ` · ${enRiesgo} por debajo de ${config.nota_minima}` : " · todas en nivel básico o superior"}</div>
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">💪 Tu materia más fuerte</div>
        <div className="text-sm font-bold text-slate-800 leading-snug">{mejor.nombre}</div>
        <div className="text-xs font-extrabold" style={{ color: (bandaDesempeno(mejor.nota, config) || b).color }}>{mejor.nota}</div>
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">🎯 Para reforzar</div>
        {con.length > 1 && peor.nombre !== mejor.nombre ? (
          <>
            <div className="text-sm font-bold text-slate-800 leading-snug">{peor.nombre}</div>
            <div className="text-xs font-extrabold" style={{ color: (bandaDesempeno(peor.nota, config) || b).color }}>{peor.nota}</div>
          </>
        ) : <div className="text-xs text-slate-500">Cuando tengas más materias con nota, aquí verás cuál reforzar.</div>}
      </div>
    </div>
  );
}

// Mini gráfica con la evolución de las notas de las actividades del periodo, en orden.
export function EvolucionPeriodo({ actividades, config }) {
  const pts = [...actividades]
    .filter((a) => !isNaN(Number(a.valor)))
    .sort((x, y) => (x.actividad_id ?? x.id) - (y.actividad_id ?? y.id));
  if (pts.length < 2) return null;
  const W = 300, H = 90, pad = 12;
  const min = config.escala_min, max = config.nota_maxima;
  const x = (i) => pad + (i * (W - 2 * pad)) / (pts.length - 1);
  const y = (v) => H - pad - ((Number(v) - min) / (max - min)) * (H - 2 * pad);
  const linea = pts.map((a, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(a.valor).toFixed(1)}`).join(" ");
  const vals = pts.map((a) => Number(a.valor));
  const prom = vals.reduce((a, v) => a + v, 0) / vals.length;
  const ultima = vals[vals.length - 1];
  const dif = Math.round((ultima - prom) * 10) / 10;
  const mensaje = dif > 0.2 ? `📈 Tu última nota (${ultima}) está por encima de tu promedio. ¡Vas mejorando!`
    : dif < -0.2 ? `📉 Tu última nota (${ultima}) quedó por debajo de tu promedio. Tú puedes recuperarte en la próxima.`
    : `➡️ Vas estable: tu última nota (${ultima}) es parecida a tu promedio.`;
  return (
    <div className="mt-2 rounded-xl bg-white border border-slate-200 p-2.5">
      <div className="text-[11px] font-extrabold text-slate-600 mb-1">📊 Cómo vas en este periodo</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 110 }} role="img" aria-label="Evolución de tus notas">
        <line x1={pad} x2={W - pad} y1={y(config.nota_minima)} y2={y(config.nota_minima)} stroke="#CBD5E1" strokeDasharray="4 3" />
        <text x={W - pad} y={y(config.nota_minima) - 3} fontSize="8" fill="#94A3B8" textAnchor="end">{config.nota_minima}</text>
        <path d={linea} fill="none" stroke="#94A3B8" strokeWidth="1.5" />
        {pts.map((a, i) => {
          const b = bandaDesempeno(a.valor, config) || { color: "#94A3B8" };
          return (
            <g key={a.id}>
              <circle cx={x(i)} cy={y(a.valor)} r="5" fill={b.color} stroke="#fff" strokeWidth="1.5">
                <title>{`${a.notas_actividades?.nombre || "Actividad"}: ${a.valor}`}</title>
              </circle>
              <text x={x(i)} y={y(a.valor) - 8} fontSize="8" fontWeight="700" fill={b.color} textAnchor="middle">{a.valor}</text>
            </g>
          );
        })}
      </svg>
      <div className="text-[11px] text-slate-600">{mensaje}</div>
    </div>
  );
}

const COLORES_CATEGORIA = ["#2F55A4", "#7C3AED", "#0F766E", "#B45309", "#BE185D", "#0369A1", "#4D7C0F"];

// Actividades del periodo actual agrupadas por categoría: cada categoría con su color,
// su porcentaje y su promedio, y cada nota con el color de su desempeño.
export function ActividadesPorCategoria({ actividades, config }) {
  const grupos = [];
  const idx = {};
  actividades.forEach((a) => {
    const catId = a.notas_actividades?.categoria_id ?? "sin";
    if (idx[catId] === undefined) {
      idx[catId] = grupos.length;
      grupos.push({
        id: catId,
        nombre: a.notas_actividades?.notas_categorias?.nombre || "Otras actividades",
        porcentaje: a.notas_actividades?.notas_categorias?.porcentaje ?? null,
        items: [],
      });
    }
    grupos[idx[catId]].items.push(a);
  });
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {grupos.map((g, gi) => {
        const color = COLORES_CATEGORIA[gi % COLORES_CATEGORIA.length];
        const valores = g.items.map((a) => Number(a.valor)).filter((v) => !isNaN(v));
        const prom = valores.length ? Math.round((valores.reduce((x, y) => x + y, 0) / valores.length) * 10) / 10 : null;
        const bProm = bandaDesempeno(prom, config) || { color: "#94A3B8" };
        return (
          <div key={g.id} className="rounded-xl overflow-hidden bg-white" style={{ border: `1px solid ${color}40` }}>
            <div className="flex items-center justify-between gap-2 px-3 py-1.5" style={{ background: `${color}15` }}>
              <div className="min-w-0">
                <div className="text-[12px] font-extrabold truncate" style={{ color }}>{g.nombre}</div>
                {g.porcentaje != null && <div className="text-[10px] text-slate-500">{g.porcentaje}% de la nota</div>}
              </div>
              {prom !== null && (
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full shrink-0" style={{ background: `${bProm.color}22`, color: bProm.color }} title="Promedio de la categoría">
                  Prom. {prom}
                </span>
              )}
            </div>
            <div className="p-2 space-y-1.5">
              {g.items.map((a) => {
                const b = bandaDesempeno(a.valor, config) || { color: "#94A3B8" };
                return (
                  <div key={a.id}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-600 leading-snug">{a.notas_actividades?.nombre}</span>
                      <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full shrink-0" style={{ background: `${b.color}22`, color: b.color }}>{a.valor}</span>
                    </div>
                    {a.observacion && (
                      <div className="text-[10px] text-violet-600 italic bg-violet-50 rounded-lg px-2 py-1 mt-0.5">📝 {a.observacion}</div>
                    )}
                    <RubricaCalificadaAlumno resultado={a.rubrica_resultado} config={config} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MisNotas({ estudianteId }) {
  const [datos, setDatos] = useState(null);
  const [comentarios, setComentarios] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [materiaAbierta, setMateriaAbierta] = useState(null);
  const [periodoActualDe, setPeriodoActualDe] = useState({}); // materia_id -> periodo que el docente mantiene activo

  useEffect(() => {
    Promise.all([api.fetchNotasEstudiante(estudianteId), api.fetchComentariosDesempeno()])
      .then(async ([d, c]) => {
        setDatos(d); setComentarios(c); setCargando(false);
        // periodo "actual" de cada materia, según la configuración del docente
        // Función segura del servidor (SQL 128). Si todavía no existe, se usa el periodo más reciente con actividades.
        // OJO: no se lee notas_config directamente: al estudiante la seguridad se lo oculta y devolvía "Periodo 1" por defecto.
        try { setPeriodoActualDe(await fetchPeriodosActualesEstudiante(estudianteId)); } catch { setPeriodoActualDe({}); }
      })
      .catch((e) => { setError(e.message); setCargando(false); });
  }, [estudianteId]);

  if (cargando) return <div className="text-xs text-slate-400 mt-4">Cargando notas…</div>;
  if (error) return <div className="text-xs text-rose-500 bg-rose-50 rounded-lg p-2 mt-4">Error al cargar notas: {error}</div>;
  if (!datos) return null;

  // Junta, por materia, los periodos con nota final guardada (definitiva) y los
  // periodos donde solo hay actividades cargadas todavía (en curso) — para estos
  // últimos se calcula la nota en vivo con la misma fórmula ponderada del docente.
  const materias = {};
  datos.finales.forEach((f) => {
    const nombre = f.materias?.nombre || `Materia ${f.materia_id}`;
    materias[nombre] = materias[nombre] || { finales: {}, actividadesPorPeriodo: {} };
    materias[nombre].materiaId = f.materia_id;
    materias[nombre].finales[f.periodo] = f.nota;
  });
  datos.valores.forEach((v) => {
    const act = v.notas_actividades;
    if (!act) return;
    const nombre = act.materias?.nombre || `Materia ${act.materia_id}`;
    materias[nombre] = materias[nombre] || { finales: {}, actividadesPorPeriodo: {} };
    materias[nombre].materiaId = act.materia_id;
    materias[nombre].actividadesPorPeriodo[act.periodo] = materias[nombre].actividadesPorPeriodo[act.periodo] || [];
    materias[nombre].actividadesPorPeriodo[act.periodo].push(v);
  });

  if (Object.keys(materias).length === 0) {
    return <div className="text-xs text-slate-400 mt-4 pt-4 border-t border-slate-100">Todavía no tenés notas ni actividades cargadas.</div>;
  }
  const config = { escala_min: 1, nota_minima: 3.5, nota_maxima: 5 };

  const resumenMaterias = Object.entries(materias).map(([nombreMateria, m]) => {
    const periodos = [...new Set([...Object.keys(m.finales), ...Object.keys(m.actividadesPorPeriodo)])].sort();
    // Periodo actual: el que el docente tiene activo; si no se pudo leer, el más reciente con actividades.
    const conActividades = Object.keys(m.actividadesPorPeriodo).sort();
    const periodoActual = String(periodoActualDe[m.materiaId] ?? conActividades[conActividades.length - 1] ?? periodos[periodos.length - 1]);

    const filas = periodos.map((periodo) => {
      const actividadesPeriodo = m.actividadesPorPeriodo[periodo] || [];
      const esActual = String(periodo) === periodoActual;
      if (Object.prototype.hasOwnProperty.call(m.finales, periodo)) {
        return { periodo, nota: m.finales[periodo], enCurso: false, actividadesPeriodo, esActual };
      }
      // Sin nota final guardada todavía: se calcula en vivo con lo que hay cargado
      const porCategoria = {};
      const categoriasVistas = {};
      actividadesPeriodo.forEach((a) => {
        const cat = a.notas_actividades?.notas_categorias;
        const catId = a.notas_actividades?.categoria_id;
        if (!catId) return;
        categoriasVistas[catId] = { id: catId, porcentaje: cat?.porcentaje || 0 };
        porCategoria[catId] = porCategoria[catId] || [];
        porCategoria[catId].push(a.valor);
      });
      const notaViva = notaFinalPonderada(porCategoria, Object.values(categoriasVistas));
      return { periodo, nota: notaViva, enCurso: true, actividadesPeriodo, esActual };
    });

    // Cambio frente al periodo anterior (solo si ese periodo ya tiene resultado)
    filas.forEach((f, k) => {
      const ant = k > 0 ? filas[k - 1].nota : null;
      f.delta = f.esActual && ant != null && f.nota != null ? Math.round((f.nota - ant) * 10) / 10 : null;
    });
    // Nota final de la materia: promedio de los periodos que ya tienen nota (provisional si alguno sigue en curso)
    const conNota = filas.filter((f) => f.nota != null);
    const final = conNota.length ? Math.round((conNota.reduce((a, f) => a + Number(f.nota), 0) / conNota.length) * 10) / 10 : null;
    return { nombre: nombreMateria, filas, actual: filas.find((f) => f.esActual) || null, final, finalProvisional: conNota.some((f) => f.enCurso), periodosConNota: conNota.length };
  });
  const finalesMaterias = resumenMaterias.filter((r) => r.final != null);
  const promedioFinalGeneral = finalesMaterias.length ? Math.round((finalesMaterias.reduce((a, r) => a + r.final, 0) / finalesMaterias.length) * 10) / 10 : null;
  const bGeneral = promedioFinalGeneral != null ? bandaDesempeno(promedioFinalGeneral, config) : null;

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <div className="text-xs font-semibold text-slate-600 mb-2">📚 Mis notas</div>
      {promedioFinalGeneral != null && (
        <div className="rounded-2xl p-3 mb-3 flex items-center justify-between gap-3" style={{ background: `${bGeneral.color}15`, border: `1px solid ${bGeneral.color}44` }}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Mi nota final (promedio de todas las materias)</div>
            <div className="text-[11px] text-slate-500">{finalesMaterias.some((r) => r.finalProvisional) ? "Provisional: incluye periodos en curso" : "Promedio de los periodos con nota"}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-extrabold leading-none" style={{ color: bGeneral.color }}>{promedioFinalGeneral.toFixed(1)}</div>
            <div className="text-[10px] font-bold" style={{ color: bGeneral.color }}>{bGeneral.label}</div>
          </div>
        </div>
      )}
      <ResumenGeneral materias={resumenMaterias} config={config} />
      <div className="space-y-2">
        {Object.entries(materias).map(([nombreMateria, m]) => {
          const abierta = materiaAbierta === nombreMateria;
          const { filas, final: notaFinal, finalProvisional, periodosConNota } = resumenMaterias.find((r) => r.nombre === nombreMateria);
          const bFinal = notaFinal != null ? bandaDesempeno(notaFinal, config) : null;
          return (
            <div key={nombreMateria} className="bg-slate-50 rounded-xl p-3">
              <button onClick={() => setMateriaAbierta(abierta ? null : nombreMateria)} className="w-full text-left">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-800">{nombreMateria}</div>
                  {bFinal && <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shrink-0" style={{ background: `${bFinal.color}22`, color: bFinal.color }} title="Promedio de los periodos con nota">Final: {notaFinal.toFixed(1)}{finalProvisional && " 🕓"}</span>}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {filas.map((f) => {
                    const b = bandaDesempeno(f.nota, config);
                    return (
                      <span key={f.periodo} className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1" style={{ background: `${b.color}22`, color: b.color }}>
                        P{f.periodo}: {f.nota ?? "—"}{f.enCurso && " 🕓"}
                      </span>
                    );
                  })}
                </div>
              </button>

              {abierta && (
                <div className="mt-2 pt-2 border-t border-slate-200 space-y-2">
                  {bFinal && <div className="text-xs font-bold rounded-lg px-2.5 py-1.5" style={{ background: `${bFinal.color}15`, color: bFinal.color }}>🏁 Nota final: {notaFinal.toFixed(1)} ({bFinal.label}) · promedio de {periodosConNota} {periodosConNota === 1 ? "periodo" : "periodos"}{finalProvisional ? " · provisional" : ""}</div>}
                  {filas.map((f) => {
                    const b = bandaDesempeno(f.nota, config);
                    return (
                      <div key={f.periodo}>
                        <div className="text-xs font-semibold text-slate-600">
                          Periodo {f.periodo} — <span style={{ color: b.color }}>{f.nota ?? "—"} ({b.label})</span>
                          {f.enCurso && <span className="text-amber-600 font-normal"> · En curso (provisional, puede cambiar)</span>}
                          {!f.enCurso && !f.esActual && <span className="text-slate-400 font-normal"> · Resultado final</span>}
                          {f.delta != null && f.delta !== 0 && (
                            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: f.delta > 0 ? "#05966922" : "#DC262622", color: f.delta > 0 ? "#059669" : "#DC2626" }}>
                              {f.delta > 0 ? "▲ +" : "▼ "}{f.delta} frente al periodo anterior
                            </span>
                          )}
                        </div>
                        {f.esActual && f.actividadesPeriodo.length > 0 && (
                          <>
                            <EvolucionPeriodo actividades={f.actividadesPeriodo} config={config} />
                            <ActividadesPorCategoria actividades={f.actividadesPeriodo} config={config} />
                          </>
                        )}
                        {f.esActual && f.actividadesPeriodo.length > 0 && (
                          <BonoEnCurso materiaId={f.actividadesPeriodo[0].notas_actividades?.materia_id} periodo={f.periodo} estudianteId={estudianteId} nota={f.nota} />
                        )}
                        {f.esActual && f.actividadesPeriodo.length > 0 && (
                          <ProyeccionNota materiaId={f.actividadesPeriodo[0].notas_actividades?.materia_id} actividades={f.actividadesPeriodo} />
                        )}
                        {!f.enCurso && f.nota !== null && comentarios[b.key] && (
                          <div className="text-[11px] text-slate-500 italic mt-1 bg-white rounded-lg p-2">{comentarios[b.key]}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TareaCalificableEstudiante({ tarea, estudianteId, icono = "📄" }) {
  const [entrega, setEntrega] = useState(null);
  useEffect(() => { api.fetchMiEntrega(tarea.id, estudianteId).then(setEntrega); }, [tarea.id]);

  const calificado = entrega?.nota !== null && entrega?.nota !== undefined;
  const colorBorde = calificado ? "#22C55E" : "#F59E0B";

  return (
    <div className="bg-white rounded-xl p-3.5 shadow-sm" style={{ borderLeft: `4px solid ${colorBorde}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-800">{icono} {tarea.titulo}</div>
          {tarea.materias?.nombre && <div className="text-[11px] text-violet-500 font-semibold mt-0.5">{tarea.materias.nombre}</div>}
          {tarea.descripcion && <TextoEnriquecido html={tarea.descripcion} className="text-xs text-slate-500 mt-1" />}
        </div>
        {calificado ? (
          <span className="text-xs font-bold text-white bg-emerald-500 px-2.5 py-1 rounded-full shrink-0">{entrega.nota}</span>
        ) : (
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-full shrink-0 whitespace-nowrap">⏳ Pendiente</span>
        )}
      </div>
      {tarea.fecha_entrega && <div className="text-[11px] text-slate-400 mt-2">📅 Entrega: {tarea.fecha_entrega}</div>}
      {(() => {
        const est = estadoFecha(tarea);
        const hayExigencia = tarea.nota_minima > 0 || tarea.fecha_limite || tarea.penalizacion_dia > 0;
        if (!hayExigencia) return null;
        return (
          <div className="mt-2 space-y-1">
            {tarea.fecha_limite && !calificado && (
              <div className={`text-[11px] font-semibold rounded-lg px-2 py-1 ${est.tipo === "vencida" ? "bg-rose-50 text-rose-600" : est.tipo === "hoy" ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-500"}`}>
                {est.tipo === "faltan" && `⏳ Tienes ${est.dias} día${est.dias === 1 ? "" : "s"} para entregar (límite ${tarea.fecha_limite})`}
                {est.tipo === "hoy" && "⏳ Hoy es el último día para entregar"}
                {est.tipo === "vencida" && `⚠️ El plazo venció hace ${est.dias} día${est.dias === 1 ? "" : "s"}${tarea.penalizacion_dia > 0 ? ` — cada día de retraso resta ${tarea.penalizacion_dia}` : ""}`}
              </div>
            )}
            {tarea.penalizacion_dia > 0 && <div className="text-[10px] text-slate-400">Retraso: {textoPenalizacion(tarea)}</div>}
            {tarea.nota_minima > 0 && !calificado && <div className="text-[11px] text-sky-600">🎯 Para darla por lograda necesitas al menos {tarea.nota_minima}</div>}
            {calificado && tarea.nota_minima > 0 && (
              bajoMinima(entrega.nota, tarea)
                ? <div className="text-[11px] font-semibold text-rose-600 bg-rose-50 rounded-lg px-2 py-1">🔁 Por recuperar: la mínima era {tarea.nota_minima}. Habla con tu docente para mejorarla.</div>
                : <div className="text-[11px] font-semibold text-emerald-600">✅ Lograda (mínima {tarea.nota_minima})</div>
            )}
            {calificado && entrega.dias_retraso > 0 && entrega.nota_original != null && Number(entrega.nota_original) !== Number(entrega.nota) && (
              <div className="text-[10px] text-slate-400">Nota {entrega.nota_original} − penalización por {entrega.dias_retraso} día{entrega.dias_retraso === 1 ? "" : "s"} de retraso</div>
            )}
          </div>
        );
      })()}
      {tarea.url && (
        <a href={tarea.url} target="_blank" rel="noreferrer" className="inline-block text-xs font-semibold text-white bg-violet-500 px-3 py-1.5 rounded-lg mt-2">
          🔗 Abrir enlace
        </a>
      )}
      {calificado && entrega.comentario && (
        <div className="text-xs text-slate-600 italic bg-slate-50 rounded-lg p-2 mt-2">"{entrega.comentario}"</div>
      )}
    </div>
  );
}

export function ProyectosEstudiante({ estudianteId, gradoId }) {
  const [proyectos, setProyectos] = useState([]);
  const [tareasPlan, setTareasPlan] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([api.fetchTareasCalificablesEstudiante(gradoId, "proyecto"), api.fetchTareasPlaneacionParaGrado(gradoId)])
      .then(([p, t]) => { setProyectos(p); setTareasPlan(t); setCargando(false); });
  }, [gradoId]);

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;
  if (proyectos.length === 0 && tareasPlan.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-3xl mb-2">📜</div>
        <p className="text-sm text-slate-400">Todavía no tenés proyectos asignados.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-3">📜 Proyectos</h3>
      {proyectos.length > 0 && (
        <div className="space-y-2 mb-5">
          {proyectos.map((p) => <TareaCalificableEstudiante key={p.id} tarea={p} estudianteId={estudianteId} icono="📜" />)}
        </div>
      )}
      {tareasPlan.length > 0 && (
        <>
          <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Otras tareas de clase</div>
          <div className="space-y-2">
            {tareasPlan.map((t) => (
              <div key={t.id} className="bg-white rounded-xl p-3.5 shadow-sm border-l-4 border-slate-300">
                <div className="text-sm font-bold text-slate-800">📝 {t.titulo}</div>
                <div className="text-[11px] text-violet-500 font-semibold mt-0.5">{t.materia_nombre}{t.unidad_titulo ? ` · ${t.unidad_titulo}` : ""}</div>
                {t.fecha_entrega && <div className="text-[11px] text-slate-400 mt-1.5">📅 Entrega: {t.fecha_entrega}</div>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function ForjaEstudiante({ estudianteId, gradoId }) {
  const [talleres, setTalleres] = useState([]);
  const [cargando, setCargando] = useState(true);
  useEffect(() => { api.fetchTareasCalificablesEstudiante(gradoId, "forja").then((d) => { setTalleres(d); setCargando(false); }); }, [gradoId]);

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;
  if (talleres.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-3xl mb-2">🔨</div>
        <p className="text-sm text-slate-400">Todavía no tenés talleres o entregables asignados.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-3">🔨 Forja</h3>
      <div className="space-y-2">
        {talleres.map((t) => <TareaCalificableEstudiante key={t.id} tarea={t} estudianteId={estudianteId} icono="🔨" />)}
      </div>
    </div>
  );
}

export function HistorialEstudiante({ estudianteId }) {
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [verTodo, setVerTodo] = useState(false);

  useEffect(() => { api.fetchHistorialGamificacion(estudianteId).then((d) => { setHistorial(d); setCargando(false); }); }, [estudianteId]);

  if (cargando) return null;
  if (historial.length === 0) return null;

  const visibles = verTodo ? historial : historial.slice(0, 6);

  return (
    <div className="mt-5 pt-4 border-t border-slate-100">
      <div className="text-xs font-semibold text-slate-600 mb-2">📜 Historial reciente</div>
      <div className="space-y-1.5">
        {visibles.map((h) => {
          const info = CATEGORIA_INFO_ESTUDIANTE[h.categoria] || { label: h.categoria, color: "#94A3B8", emoji: "•" };
          return (
            <div key={h.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-700">{h.etiqueta}</div>
                <div className="text-[10px] text-slate-400">
                  {new Date(h.ts).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                  <span style={{ color: info.color }}> · {info.emoji} {info.label}</span>
                </div>
              </div>
              <div className={`text-xs font-semibold shrink-0 ${h.xp >= 0 ? "text-emerald-600" : "text-rose-500"}`}>{h.xp > 0 ? "+" : ""}{h.xp} XP</div>
            </div>
          );
        })}
      </div>
      {historial.length > 6 && (
        <button onClick={() => setVerTodo((v) => !v)} className="text-[11px] text-violet-500 mt-2">
          {verTodo ? "Ver menos" : `Ver todo (${historial.length})`}
        </button>
      )}
    </div>
  );
}
