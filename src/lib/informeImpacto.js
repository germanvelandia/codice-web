// Informe de impacto: reúne notas, asistencia y (opcional) encuesta de un curso y calcula indicadores.
import { supabase } from "./supabaseClient";
import { fetchEstudiantesPorGrado } from "./api";
import { bandaDesempeno, CONFIG_DEFAULT } from "./calificaciones";

const r2 = (n) => (n === null || n === undefined || Number.isNaN(n) ? null : Math.round(n * 100) / 100);
const r1 = (n) => (n === null || n === undefined || Number.isNaN(n) ? null : Math.round(n * 10) / 10);
const prom = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

async function paginar(armar) {
  const T = 1000; const out = []; let desde = 0;
  for (;;) {
    const { data, error } = await armar().range(desde, desde + T - 1);
    if (error) throw error;
    out.push(...(data || []));
    if ((data || []).length < T || desde > 200000) break;
    desde += T;
  }
  return out;
}
const trozos = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };

// Trae lo necesario de un grado. desde/hasta (YYYY-MM-DD) filtran la asistencia.
export async function fetchDatosInforme(gradoId, desde = null, hasta = null) {
  const estudiantes = await fetchEstudiantesPorGrado(gradoId);
  const ids = estudiantes.map((e) => e.id);
  const notas = []; const asistencia = [];
  for (const grupo of trozos(ids, 80)) {
    notas.push(...await paginar(() => supabase.from("notas_finales_periodo").select("estudiante_id, materia_id, periodo, nota, materias(nombre)").in("estudiante_id", grupo).order("materia_id").order("estudiante_id").order("periodo")));
    asistencia.push(...await paginar(() => {
      let q = supabase.from("asistencia").select("estudiante_id, codigo, fecha, materia_id").in("estudiante_id", grupo).order("fecha").order("estudiante_id").order("materia_id");
      if (desde) q = q.gte("fecha", desde);
      if (hasta) q = q.lte("fecha", hasta);
      return q;
    }));
  }
  return { estudiantes, notas, asistencia };
}

export function calcularInforme({ estudiantes, notas, asistencia }, { notaMin = CONFIG_DEFAULT.nota_minima, materiaId = null } = {}) {
  const cfg = { ...CONFIG_DEFAULT, nota_minima: notaMin };
  const nombrePorId = new Map(estudiantes.map((e) => [e.id, e.nombre]));
  const validas = notas.filter((n) => n.nota !== null && n.nota !== undefined && nombrePorId.has(n.estudiante_id) && (!materiaId || String(n.materia_id) === String(materiaId)));
  const periodos = [...new Set(validas.map((n) => n.periodo))].sort((a, b) => Number(a) - Number(b));

  // Promedio de cada estudiante por periodo
  const porEstPer = new Map(); // `${est}|${per}` -> [notas]
  validas.forEach((n) => { const k = `${n.estudiante_id}|${n.periodo}`; if (!porEstPer.has(k)) porEstPer.set(k, []); porEstPer.get(k).push(Number(n.nota)); });
  const promEst = (est, per) => { const a = porEstPer.get(`${est}|${per}`); return a ? prom(a) : null; };

  const porPeriodo = periodos.map((per) => {
    const proms = estudiantes.map((e) => promEst(e.id, per)).filter((v) => v !== null);
    const bandas = { bajo: 0, basico: 0, alto: 0, superior: 0 };
    proms.forEach((p) => { const b = bandaDesempeno(p, cfg).key; if (bandas[b] !== undefined) bandas[b]++; });
    const aprobados = proms.filter((p) => p >= notaMin).length;
    return { periodo: per, n: proms.length, promedio: r2(prom(proms)), aprobados, pctAprobados: proms.length ? r1((aprobados / proms.length) * 100) : null, bandas };
  });

  // Evolución primer → último periodo (solo estudiantes con nota en ambos)
  let evolucion = null;
  if (periodos.length >= 2) {
    const p0 = periodos[0]; const p1 = periodos[periodos.length - 1];
    let mejoran = 0; let igual = 0; let empeoran = 0; const difs = [];
    estudiantes.forEach((e) => {
      const a = promEst(e.id, p0); const b = promEst(e.id, p1);
      if (a === null || b === null) return;
      const d = b - a; difs.push(d);
      if (d > 0.05) mejoran++; else if (d < -0.05) empeoran++; else igual++;
    });
    const f0 = porPeriodo[0]; const f1 = porPeriodo[porPeriodo.length - 1];
    evolucion = {
      desde: p0, hasta: p1, comparados: difs.length, mejoran, igual, empeoran,
      cambioPromedio: f0.promedio !== null && f1.promedio !== null ? r2(f1.promedio - f0.promedio) : null,
      cambioAprobados: f0.pctAprobados !== null && f1.pctAprobados !== null ? r1(f1.pctAprobados - f0.pctAprobados) : null,
      promedioDiferencia: r2(prom(difs)),
    };
  }

  // Por materia
  const mats = new Map();
  validas.forEach((n) => { const m = mats.get(n.materia_id) || { id: n.materia_id, nombre: n.materias?.nombre || `Materia ${n.materia_id}`, notas: [] }; m.notas.push(Number(n.nota)); mats.set(n.materia_id, m); });
  const porMateria = [...mats.values()].map((m) => ({ id: m.id, nombre: m.nombre, n: m.notas.length, promedio: r2(prom(m.notas)), pctAprobados: r1((m.notas.filter((x) => x >= notaMin).length / m.notas.length) * 100) })).sort((a, b) => a.nombre.localeCompare(b.nombre));

  // Asistencia
  const asis = asistencia.filter((a) => nombrePorId.has(a.estudiante_id));
  const cuenta = { P: 0, R: 0, FI: 0, FJ: 0 };
  asis.forEach((a) => { if (cuenta[a.codigo] !== undefined) cuenta[a.codigo]++; });
  const totalAsis = cuenta.P + cuenta.R + cuenta.FI + cuenta.FJ;
  const pct = (x) => (totalAsis ? r1((x / totalAsis) * 100) : null);
  const asistenciaRes = { total: totalAsis, ...cuenta, pctPresente: pct(cuenta.P), pctAsistio: pct(cuenta.P + cuenta.R), pctRetardo: pct(cuenta.R), pctFI: pct(cuenta.FI), pctFJ: pct(cuenta.FJ) };
  const asisEst = new Map();
  asis.forEach((a) => { const o = asisEst.get(a.estudiante_id) || { ok: 0, t: 0 }; if (cuenta[a.codigo] !== undefined) { o.t++; if (a.codigo === "P" || a.codigo === "R") o.ok++; } asisEst.set(a.estudiante_id, o); });

  // Fila por estudiante
  const filas = estudiantes.map((e) => {
    const porPer = periodos.map((per) => { const v = promEst(e.id, per); return v === null ? null : r2(v); });
    const todas = porPer.filter((v) => v !== null);
    const a = asisEst.get(e.id);
    return { id: e.id, nombre: e.nombre, porPeriodo: porPer, promedio: todas.length ? r2(prom(todas)) : null, asistencia: a && a.t ? r1((a.ok / a.t) * 100) : null };
  }).sort((x, y) => String(x.nombre).localeCompare(String(y.nombre)));

  return { notaMin, periodos, totalEstudiantes: estudiantes.length, porPeriodo, evolucion, porMateria, asistencia: asistenciaRes, filas };
}

// ---------- Exportación ----------
const num = (v, d = 1) => (v === null || v === undefined ? "" : String(Math.round(v * 10 ** d) / 10 ** d).replace(".", ","));
const celda = (v) => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export function informeACSV(inf, encuestaResumen = null, etiqueta = "") {
  const L = [];
  L.push(["INFORME DE IMPACTO", etiqueta].map(celda).join(";"));
  L.push(["Estudiantes", inf.totalEstudiantes, "Nota mínima de aprobación", num(inf.notaMin)].map(celda).join(";"));
  L.push("");
  L.push("RENDIMIENTO POR PERIODO");
  L.push(["Periodo", "Estudiantes con nota", "Promedio", "% aprobados", "Bajo", "Básico", "Alto", "Superior"].join(";"));
  inf.porPeriodo.forEach((p) => L.push([p.periodo, p.n, num(p.promedio, 2), num(p.pctAprobados), p.bandas.bajo, p.bandas.basico, p.bandas.alto, p.bandas.superior].join(";")));
  if (inf.evolucion) {
    const e = inf.evolucion;
    L.push("");
    L.push(`EVOLUCIÓN periodo ${e.desde} → ${e.hasta}`);
    L.push(["Cambio en el promedio", num(e.cambioPromedio, 2), "Cambio en % aprobados (pts)", num(e.cambioAprobados), "Mejoraron", e.mejoran, "Igual", e.igual, "Bajaron", e.empeoran].join(";"));
  }
  L.push("");
  L.push("POR MATERIA");
  L.push(["Materia", "Notas", "Promedio", "% aprobados"].join(";"));
  inf.porMateria.forEach((m) => L.push([celda(m.nombre), m.n, num(m.promedio, 2), num(m.pctAprobados)].join(";")));
  L.push("");
  L.push("ASISTENCIA");
  const a = inf.asistencia;
  L.push(["Registros", "% presente", "% retardo", "% falta injustificada", "% falta justificada"].join(";"));
  L.push([a.total, num(a.pctPresente), num(a.pctRetardo), num(a.pctFI), num(a.pctFJ)].join(";"));
  if (encuestaResumen && encuestaResumen.total > 0) {
    L.push("");
    L.push(`ENCUESTA DE SATISFACCIÓN (${encuestaResumen.total} respuestas, anónimas)`);
    L.push(["Pregunta", "Promedio (1-5)", "% favorable (4-5)", "% desfavorable (1-2)", "Respuestas"].join(";"));
    encuestaResumen.items.filter((i) => i.tipo === "escala").forEach((i) => L.push([celda(i.texto), num(i.promedio, 2), num(i.favorable), num(i.desfavorable), i.n].join(";")));
    L.push(["SATISFACCIÓN GLOBAL", num(encuestaResumen.global, 2), num(encuestaResumen.globalFavorable), "", ""].join(";"));
    encuestaResumen.items.filter((i) => i.tipo === "texto").forEach((i) => { L.push(""); L.push(celda(i.texto)); i.comentarios.forEach((c) => L.push(celda(c))); });
  }
  L.push("");
  L.push("DETALLE POR ESTUDIANTE");
  L.push(["Estudiante", ...inf.periodos.map((p) => `Promedio P${p}`), "Promedio general", "% asistencia"].join(";"));
  inf.filas.forEach((f) => L.push([celda(f.nombre), ...f.porPeriodo.map((v) => num(v, 2)), num(f.promedio, 2), num(f.asistencia)].join(";")));
  return "﻿" + L.join("\r\n");
}

// Texto corto para pegar en el informe de la maestría.
export function informeATexto(inf, encuestaResumen = null, etiqueta = "") {
  const t = [];
  t.push(`Informe de impacto — ${etiqueta}`.trim());
  t.push(`Estudiantes: ${inf.totalEstudiantes}. Nota mínima de aprobación: ${num(inf.notaMin)}.`);
  inf.porPeriodo.forEach((p) => t.push(`Periodo ${p.periodo}: promedio ${num(p.promedio, 2)}, aprobación ${num(p.pctAprobados)}% (${p.n} estudiantes con nota).`));
  if (inf.evolucion) {
    const e = inf.evolucion;
    t.push(`Del periodo ${e.desde} al ${e.hasta}: el promedio del curso cambió ${e.cambioPromedio > 0 ? "+" : ""}${num(e.cambioPromedio, 2)} y la aprobación ${e.cambioAprobados > 0 ? "+" : ""}${num(e.cambioAprobados)} puntos. De ${e.comparados} estudiantes comparados, ${e.mejoran} mejoraron, ${e.igual} se mantuvieron y ${e.empeoran} bajaron.`);
  }
  const a = inf.asistencia;
  if (a.total) t.push(`Asistencia: ${num(a.pctPresente)}% presente, ${num(a.pctRetardo)}% retardos, ${num(a.pctFI)}% faltas injustificadas y ${num(a.pctFJ)}% justificadas (${a.total} registros).`);
  if (encuestaResumen && encuestaResumen.total > 0) t.push(`Encuesta de satisfacción (${encuestaResumen.total} respuestas anónimas): promedio global ${num(encuestaResumen.global, 2)} de 5; ${num(encuestaResumen.globalFavorable)}% de valoraciones favorables (4 o 5).`);
  t.push("Nota: los cambios entre periodos describen lo observado en el curso y no prueban por sí solos que CÓDICE los haya causado.");
  return t.join("\n");
}

export function descargarArchivo(nombre, contenido, tipo = "text/csv;charset=utf-8") {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
