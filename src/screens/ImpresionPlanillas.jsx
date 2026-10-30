import React, { useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import { CONFIG_DEFAULT, periodosDe, bandaDesempeno, notaAutomatica, notaFinalPonderada } from "../lib/calificaciones";
import { aplicarBono } from "../lib/bono";
import { esGrupoMixto, fetchGruposMixtos, fetchEstudiantesGrupo, fetchDetalleGrupo } from "../lib/gruposMixtos";

/* ============================================================================
   🖨️ Impresión de planillas e informes
   Arma documentos listos para imprimir o guardar en PDF (Carta, Oficio o A4):
   planilla del periodo, consolidado por periodos, asistencia por fechas,
   resumen de asistencia, cuadro de desempeño y lista en blanco.
   ============================================================================ */

const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
const haceDias = (n) => new Date(Date.now() - n * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmtNota = (n) => (n === null || n === undefined || Number.isNaN(Number(n)) ? "" : (Math.round(Number(n) * 10) / 10).toFixed(1));
const fmtFecha = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split("-"); return `${d}/${m}/${y}`; };
const fmtCorta = (iso) => { const [, m, d] = String(iso).slice(0, 10).split("-"); return `${d}/${m}`; };
const porNombre = (a, b) => String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", { sensitivity: "base" });

// Apellidos primero: usa el apellido guardado si existe; si no, asume que las dos últimas
// palabras son los apellidos (con 2 palabras: Nombre Apellido). Es la misma regla de la plataforma.
function apellidosYNombres(e) {
  const nombre = String(e?.nombre || "").trim();
  const ap = String(e?.apellidos || "").trim();
  const M = (x) => x.toLocaleUpperCase("es"); // apellidos siempre en MAYÚSCULAS
  if (ap) {
    // Quita del nombre los apellidos, esté donde esté (al final, al inicio o suelto), sin tildes ni mayúsculas.
    const N = (x) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const apT = ap.split(/\s+/).map(N), t = nombre.split(/\s+/).filter(Boolean), k = apT.length;
    let sinAp = t;
    if (t.length > k && t.slice(-k).map(N).join(" ") === apT.join(" ")) sinAp = t.slice(0, -k);
    else if (t.length > k && t.slice(0, k).map(N).join(" ") === apT.join(" ")) sinAp = t.slice(k);
    else { const r = t.filter((w) => !apT.includes(N(w))); if (r.length && r.length < t.length) sinAp = r; }
    return `${M(ap)} ${sinAp.join(" ")}`.trim();
  }
  const p = nombre.split(/\s+/).filter(Boolean);
  if (p.length <= 1) return nombre;
  if (p.length === 2) return `${M(p[1])} ${p[0]}`;
  return `${M(p.slice(-2).join(" "))} ${p.slice(0, -2).join(" ")}`;
}
const ordenar = (lista, orden) => (orden === "apellido"
  ? lista.map((e) => ({ ...e, nombre: apellidosYNombres(e) })).sort(porNombre)
  : [...lista].sort(porNombre));

// Grupos mixtos: por grado y, dentro de cada grado, por APELLIDOS; el curso va junto al nombre.
const claveGrado = (g) => { const n = parseInt(String(g ?? ""), 10); return Number.isNaN(n) ? 9999 : n; };
const ordenarMixto = (lista) => lista
  .map((e) => ({ ...e, _nom: apellidosYNombres(e), nombre: `${apellidosYNombres(e)}${e.grado_id != null ? ` (${e.grado_id})` : ""}` }))
  .sort((a, b) => claveGrado(a.grado_id) - claveGrado(b.grado_id) || String(a.grado_id).localeCompare(String(b.grado_id), "es", { numeric: true }) || a._nom.localeCompare(b._nom, "es", { sensitivity: "base" }));
const quitarHtml = (h) => String(h || "").replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

const INFORMES = [
  { key: "gruposnotas", emoji: "🧮", titulo: "Notas de grupos mixtos (varios grupos)", desc: "Las planillas de uno o varios grupos mixtos en un solo documento, por grado y apellidos. Ideal para salidas pedagógicas: los que fueron y los que hicieron el trabajo en el colegio.", horizontal: true, usa: ["periodo", "grupos"] },
  { key: "grupo", emoji: "👥", titulo: "Grupo mixto: integrantes y equipos", desc: "Lista del grupo por grado y apellidos, con los equipos y el trabajo de cada uno. Elige un grupo mixto en «Curso».", horizontal: false, usa: [] },
  { key: "estudiante", emoji: "🧾", titulo: "Informe individual del estudiante", desc: "Una hoja completa: periodos, recuperaciones, notas actuales por categoría, observaciones y asistencia.", horizontal: false, usa: ["estudiante"] },
  { key: "planilla", emoji: "📖", titulo: "Planilla del periodo", desc: "Todas las columnas de notas por categoría, nota final y desempeño.", horizontal: true, usa: ["periodo"] },
  { key: "consolidado", emoji: "📚", titulo: "Consolidado por periodos", desc: "Nota final de cada periodo y definitiva del año.", horizontal: false, usa: [] },
  { key: "desempeno", emoji: "📊", titulo: "Cuadro de desempeño", desc: "Estudiantes agrupados en Superior, Alto, Básico y Bajo.", horizontal: false, usa: ["periodo"] },
  { key: "asistencia", emoji: "🗓️", titulo: "Asistencia por fechas", desc: "Matriz de estudiantes por fecha (P, R, FI, FJ) con totales.", horizontal: true, usa: ["fechas", "soloMateria"] },
  { key: "resumen", emoji: "📋", titulo: "Resumen de asistencia", desc: "Totales por estudiante y porcentaje de asistencia.", horizontal: false, usa: ["fechas", "materiaOpcional"] },
  { key: "blanco", emoji: "📝", titulo: "Lista del curso en blanco", desc: "Lista con columnas vacías para anotar a mano.", horizontal: true, usa: ["columnas"] },
];
const PAPEL = { carta: "letter", oficio: "legal", a4: "A4" };
const PASTEL = { bajo: ["#FEE2E2", "#B91C1C"], "básico": ["#FEF3C7", "#B45309"], basico: ["#FEF3C7", "#B45309"], alto: ["#DBEAFE", "#1D4ED8"], superior: ["#DCFCE7", "#15803D"] };
const estiloNota = (v, config) => { if (v === null || v === undefined || Number.isNaN(Number(v))) return ""; const c = PASTEL[bandaDesempeno(v, config).key]; return c ? ` style="background:${c[0]};color:${c[1]}"` : ""; };
const celdaNota = (v, config, extra = "") => `<td${extra ? ` class="${extra}"` : ""}${estiloNota(v, config)}>${fmtNota(v)}</td>`;
const celdaBanda = (v, config) => (v === null || v === undefined ? "<td></td>" : `<td${estiloNota(v, config)}><b>${esc(bandaDesempeno(v, config).label)}</b></td>`);
const leyendaBandas = (config) => {
  const min = Number(config.nota_minima), max = Number(config.nota_maxima), r = max - min, f = (x) => (Math.round(x * 10) / 10).toFixed(1);
  const it = [["bajo", "Bajo", `menos de ${f(min)}`], ["basico", "Básico", `${f(min)} a ${f(min + r * 0.35 - 0.05)}`], ["alto", "Alto", `${f(min + r * 0.35)} a ${f(min + r * 0.7 - 0.05)}`], ["superior", "Superior", `${f(min + r * 0.7)} a ${f(max)}`]];
  return `<div class="leyenda">Desempeño: ${it.map(([k, n, rg]) => `<span style="background:${PASTEL[k][0]};color:${PASTEL[k][1]};padding:1px 6px;border-radius:3px;font-weight:700">${n} (${rg})</span>`).join(" ")}</div>`;
};
const COD = { P: ["#DCFCE7", "#15803D"], R: ["#FEF3C7", "#B45309"], FI: ["#FEE2E2", "#B91C1C"], FJ: ["#DBEAFE", "#1D4ED8"] };

const CSS = (papel, horizontal, denso) => `
@page{size:${PAPEL[papel] || "letter"} ${horizontal ? "landscape" : "portrait"};margin:10mm 10mm 12mm}
*{box-sizing:border-box}
body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:${denso ? 8 : 10}px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.enc{display:flex;align-items:center;justify-content:center;text-align:center;gap:12px;border-bottom:2px solid #17264D;padding-bottom:6px;margin-bottom:6px}
.enc img{height:44px;width:auto}
.enc .ins{font-size:13px;font-weight:700;color:#17264D}
.enc .tit{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#475569}
.meta{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 18px;font-size:10px;margin:0 0 8px;color:#334155}
.meta b{color:#0f172a}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #94a3b8;padding:${denso ? "2px 3px" : "3px 5px"};text-align:center;vertical-align:middle}
thead{display:table-header-group}
tr{page-break-inside:avoid}
th{background:#f1f5f9;font-weight:700}
td.n,th.n{width:24px}
td.nom,th.nom{text-align:left;white-space:nowrap}
th.cat{color:#fff;font-size:${denso ? 7 : 8}px;text-transform:uppercase;letter-spacing:.03em}
th.vert{height:var(--hv,120px);padding:3px 1px;font-weight:700;vertical-align:bottom;min-width:${denso ? 20 : 24}px}
th.vert div{writing-mode:vertical-rl;transform:rotate(180deg);margin:0 auto;max-height:calc(var(--hv,120px) - 8px);font-size:${denso ? 8.5 : 9.5}px;line-height:1.2;letter-spacing:.01em;white-space:normal;word-break:normal;overflow-wrap:anywhere}
th.horiz{font-size:${denso ? 8.5 : 9.5}px;line-height:1.2;padding:4px 3px;min-width:34px}
td.fin{font-weight:700;background:#f8fafc}
.secg table{width:auto;min-width:60%}
.secg td.nom,.secg th.nom{font-size:11.5px;font-weight:600;padding:4px 8px;white-space:nowrap}
.secg td,.secg th{font-size:10.5px}
.secg td.n,.secg th.n{width:26px}
.secg th.vert{min-width:26px}.secg th.vert div{font-size:10px}.secg th.horiz{font-size:10px;min-width:44px}
.secg th.cat{font-size:8.5px}
.secg td.fin,.secg td:last-child{white-space:nowrap}
.secg{page-break-after:always;break-after:page}.secg:last-child{page-break-after:auto;break-after:auto}.gt{margin:0 0 6px;font-size:13px;color:#17264D;border-bottom:2px solid #17264D;padding-bottom:3px}
.mat{margin:0 0 14px}.mat h3{margin:0 0 5px;font-size:12px;padding:4px 8px;color:#fff;background:#17264D;border-radius:3px}
.mat h4{margin:8px 0 3px;font-size:10.5px;color:#17264D}
td.izq,th.izq{text-align:left}.obs{font-size:9px;color:#475569;text-align:left}
.cuadro{border:1px solid #cbd5e1;border-radius:4px;padding:6px 8px;margin:6px 0;font-size:10px;background:#f8fafc;line-height:1.35}
.est{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin:0 0 10px;padding:8px 10px;border:2px solid #17264D;border-radius:6px}
.est .nm{font-size:16px;font-weight:800;color:#17264D;flex:1;min-width:200px}
.chip{display:inline-block;padding:2px 8px;border-radius:10px;font-weight:700;font-size:10px}
td.bajo{color:#B91C1C;font-weight:700}
tfoot td{background:#f1f5f9;font-weight:700}
.pie{margin-top:14px;display:flex;justify-content:space-between;gap:30px;font-size:10px;color:#475569}
.firma{flex:1;border-top:1px solid #0f172a;padding-top:3px;text-align:center;margin-top:26px}
.leyenda{margin-top:8px;font-size:9px;color:#475569}
.grupo{margin:0 0 10px;page-break-inside:avoid}
.grupo h3{margin:0 0 3px;font-size:11px;padding:3px 6px;color:#fff;border-radius:3px}
.vacio{color:#64748b;font-style:italic}
.sub{margin:6px 0 4px;font-size:11px;font-weight:700;color:#17264D}
`;

function documento({ titulo, subtitulo, ins, meta, cuerpo, pie, papel, horizontal, denso }) {
  const logo = ins?.logo_url ? `<img src="${esc(ins.logo_url)}" alt="">` : "";
  const metaHtml = meta.filter((m) => m[1]).map(([k, v]) => `<span><b>${esc(k)}:</b> ${esc(v)}</span>`).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${CSS(papel, horizontal, denso)}</style></head><body>
<div class="enc">${logo}<div><div class="ins">${esc(ins?.nombre || "Institución educativa")}</div><div class="tit">${esc(subtitulo || titulo)}</div></div></div>
<div class="meta">${metaHtml}</div>${cuerpo}${pie}
<div class="leyenda">Impreso desde CÓDICE el ${esc(new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" }))}</div></body></html>`;
}
const firmas = (docente) => `<div class="pie"><div class="firma">${esc(docente || "Docente")}<br>Docente</div><div class="firma">Coordinación / Dirección de curso</div></div>`;
const tablaVacia = (msg) => `<p class="vacio">${esc(msg)}</p>`;

/* ---------- datos de la planilla (igual que la pantalla de Calificaciones) ---------- */
export async function datosPeriodo({ materiaId, gradoId, periodo, estudiantes, categorias, config }) {
  const acts = await api.fetchActividades(materiaId, gradoId, periodo);
  const filas = await api.fetchValores(acts.map((a) => a.id));
  const valores = {};
  filas.forEach((v) => { (valores[v.actividad_id] = valores[v.actividad_id] || {})[v.estudiante_id] = v.valor; });
  const gams = [...new Set(acts.filter((a) => a.es_automatica).map((a) => a.gam_categoria))];
  const [xp, finales, bono] = await Promise.all([
    gams.length ? api.fetchXpPorCategoria(estudiantes.map((s) => s.id), gams).catch(() => ({})) : Promise.resolve({}),
    api.fetchNotasFinales(materiaId).catch(() => []),
    api.fetchBonosPlanilla(materiaId, periodo, estudiantes).catch(() => null),
  ]);
  const manuales = {};
  (finales || []).filter((f) => String(f.periodo) === String(periodo)).forEach((f) => { manuales[f.estudiante_id] = f.nota; });
  const bonos = bono?.bonos || {};
  const valorDe = (a, id) => (a.es_automatica ? notaAutomatica(xp[id]?.[a.gam_categoria] || 0, a.xp_meta, config) : (valores[a.id]?.[id] ?? null));
  const finalDe = (id) => {
    if (manuales[id] !== undefined && manuales[id] !== null) return Number(manuales[id]);
    const porCat = {};
    acts.forEach((a) => { const v = valorDe(a, id); if (v === null || v === undefined) return; (porCat[a.categoria_id] = porCat[a.categoria_id] || []).push(v); });
    const base = notaFinalPonderada(porCat, categorias);
    return aplicarBono(base, bonos[id] || 0, config.nota_maxima);
  };
  return { acts, valorDe, finalDe };
}

/* ---------- constructores de cada informe ---------- */
function htmlPlanilla(ctx, d) {
  const { estudiantes, categorias, config } = ctx;
  const grupos = categorias.map((c) => ({ c, items: d.acts.filter((a) => a.categoria_id === c.id) })).filter((g) => g.items.length);
  const usadas = new Set(grupos.flatMap((g) => g.items.map((a) => a.id)));
  const otras = d.acts.filter((a) => !usadas.has(a.id));
  if (otras.length) grupos.push({ c: { id: "o", nombre: "Otras", porcentaje: null }, items: otras });
  const todas = grupos.flatMap((g) => g.items);
  if (!todas.length) return { cuerpo: tablaVacia("Este periodo todavía no tiene columnas de notas."), denso: false };
  const vertical = todas.length > 7;
  const COLORES = ["#2F55A4", "#7C3AED", "#0E9F6E", "#D97706", "#DC2626", "#0891B2", "#BE185D", "#475569"];
  const cab1 = `<tr><th class="n" rowspan="2">N°</th><th class="nom" rowspan="2">Estudiante</th>${grupos.map((g, i) => `<th class="cat" colspan="${g.items.length}" style="background:${COLORES[i % COLORES.length]}">${esc(g.c.nombre)}${g.c.porcentaje != null ? ` · ${esc(g.c.porcentaje)}%` : ""}</th>`).join("")}<th rowspan="2">Nota<br>final</th><th rowspan="2">Desempeño</th></tr>`;
  // Altura del encabezado según el nombre más largo (para que se lea completo, sin amontonarse)
  const corto = (t) => { const x = String(t || "").trim(); return x.length > 48 ? x.slice(0, 47) + "…" : x; };
  const maxLen = Math.max(...todas.map((a) => corto(a.nombre).length));
  const hv = Math.max(80, Math.min(190, 30 + maxLen * 4.6));
  const cab2 = `<tr${vertical ? ` style="--hv:${Math.round(hv)}px"` : ""}>${todas.map((a) => vertical ? `<th class="vert" title="${esc(a.nombre)}"><div>${esc(corto(a.nombre))}</div></th>` : `<th class="horiz">${esc(a.nombre)}</th>`).join("")}</tr>`;
  const sumas = todas.map(() => ({ s: 0, n: 0 }));
  let sf = 0, nf = 0;
  const filas = estudiantes.map((e, i) => {
    const celdas = todas.map((a, j) => {
      const v = d.valorDe(a, e.id);
      if (v !== null && v !== undefined) { sumas[j].s += Number(v); sumas[j].n++; }
      return celdaNota(v, config);
    }).join("");
    const f = d.finalDe(e.id);
    if (f !== null && f !== undefined) { sf += Number(f); nf++; }
    return `<tr><td class="n">${i + 1}</td><td class="nom">${esc(e.nombre)}</td>${celdas}${celdaNota(f, config, "fin")}${celdaBanda(f, config)}</tr>`;
  }).join("");
  const prom = `<tfoot><tr><td colspan="2" class="nom">Promedio del curso</td>${sumas.map((x) => `<td>${x.n ? fmtNota(x.s / x.n) : ""}</td>`).join("")}<td>${nf ? fmtNota(sf / nf) : ""}</td><td></td></tr></tfoot>`;
  return { cuerpo: `<table><thead>${cab1}${cab2}</thead><tbody>${filas}</tbody>${prom}</table><div class="leyenda">Nota mínima aprobatoria: ${esc(config.nota_minima)} · Escala: ${esc(config.escala_min)} a ${esc(config.nota_maxima)}.</div>${leyendaBandas(config)}`, denso: todas.length > 12 };
}

async function htmlConsolidado(ctx) {
  const { materiaId, gradoId, estudiantes, categorias, config } = ctx;
  const periodos = periodosDe(config);
  const finales = await api.fetchNotasFinales(materiaId).catch(() => []);
  const manual = {};
  finales.forEach((f) => { manual[`${f.periodo}|${f.estudiante_id}`] = f.nota; });
  const calc = {};
  for (const p of periodos) {
    const acts = await api.fetchActividades(materiaId, gradoId, p);
    if (!acts.length && !finales.some((f) => String(f.periodo) === p)) { calc[p] = null; continue; }
    calc[p] = await api.calcularNotasFinalesPeriodo(materiaId, gradoId, p, estudiantes, categorias, config).catch(() => null);
  }
  const tiene = periodos.filter((p) => calc[p] || finales.some((f) => String(f.periodo) === p));
  if (!tiene.length) return { cuerpo: tablaVacia("Todavía no hay notas en ningún periodo."), denso: false };
  const nota = (p, id) => { const m = manual[`${p}|${id}`]; if (m !== undefined && m !== null) return Number(m); const c = calc[p]?.[id]; return c === null || c === undefined ? null : Number(c); };
  const filas = estudiantes.map((e, i) => {
    const vs = tiene.map((p) => nota(p, e.id));
    const con = vs.filter((v) => v !== null);
    const def = con.length ? con.reduce((a, b) => a + b, 0) / con.length : null;
    return `<tr><td class="n">${i + 1}</td><td class="nom">${esc(e.nombre)}</td>${vs.map((v) => celdaNota(v, config)).join("")}${celdaNota(def, config, "fin")}${celdaBanda(def, config)}</tr>`;
  }).join("");
  return { cuerpo: `<table><thead><tr><th class="n">N°</th><th class="nom">Estudiante</th>${tiene.map((p) => `<th>Periodo ${esc(p)}</th>`).join("")}<th>Definitiva</th><th>Desempeño</th></tr></thead><tbody>${filas}</tbody></table><div class="leyenda">La definitiva es el promedio de los periodos con nota. Nota mínima aprobatoria: ${esc(config.nota_minima)}.</div>${leyendaBandas(config)}`, denso: false };
}

function htmlDesempeno(ctx, d) {
  const { estudiantes, config } = ctx;
  const orden = ["Superior", "Alto", "Básico", "Bajo", "Sin nota"];
  const col = { Superior: "#22C55E", Alto: "#3B82F6", "Básico": "#F59E0B", Bajo: "#EF4444", "Sin nota": "#64748B" };
  const g = {}; orden.forEach((k) => { g[k] = []; });
  estudiantes.forEach((e) => { const f = d.finalDe(e.id); const b = bandaDesempeno(f, config); const k = f === null || f === undefined ? "Sin nota" : b.label; (g[k] = g[k] || []).push({ e, f }); });
  const resumen = `<table style="width:auto;margin-bottom:8px"><tr>${orden.map((k) => `<th style="background:${col[k]};color:#fff">${k}</th>`).join("")}</tr><tr>${orden.map((k) => `<td><b>${g[k].length}</b></td>`).join("")}</tr></table>`;
  const bloques = orden.filter((k) => g[k].length).map((k) => `<div class="grupo"><h3 style="background:${col[k]}">${k} (${g[k].length})</h3><table><tbody>${g[k].map(({ e, f }, i) => `<tr><td class="n">${i + 1}</td><td class="nom">${esc(e.nombre)}</td>${celdaNota(f, config)}</tr>`).join("")}</tbody></table></div>`).join("");
  return { cuerpo: resumen + bloques + leyendaBandas(config), denso: false };
}

async function htmlAsistencia(ctx, { desde, hasta, materiaId }) {
  const { gradoId, estudiantes } = ctx;
  const todas = await api.fetchAsistenciaDetalladaCurso(gradoId, desde, hasta);
  const reg = todas.filter((r) => String(r.materia_id) === String(materiaId));
  if (!reg.length) return { cuerpo: tablaVacia("No hay asistencia registrada en esas fechas para esta materia."), denso: false };
  const fechas = [...new Set(reg.map((r) => String(r.fecha).slice(0, 10)))].sort();
  const mapa = {};
  reg.forEach((r) => { mapa[`${r.estudiante_id}|${String(r.fecha).slice(0, 10)}`] = r.codigo; });
  const filas = estudiantes.map((e, i) => {
    const t = { P: 0, R: 0, FI: 0, FJ: 0 };
    const celdas = fechas.map((f) => { const c = mapa[`${e.id}|${f}`]; if (c && t[c] !== undefined) t[c]++; return c ? `<td style="background:${COD[c]?.[0] || "#fff"};color:${COD[c]?.[1] || "#000"};font-weight:700">${esc(c)}</td>` : "<td></td>"; }).join("");
    const total = t.P + t.R + t.FI + t.FJ;
    return `<tr><td class="n">${i + 1}</td><td class="nom">${esc(e.nombre)}</td>${celdas}<td>${t.P}</td><td>${t.R}</td><td class="${t.FI >= 3 ? "bajo" : ""}">${t.FI}</td><td>${t.FJ}</td><td class="fin">${total ? Math.round(((t.P + t.R) / total) * 100) + "%" : ""}</td></tr>`;
  }).join("");
  const cab = `<tr><th class="n">N°</th><th class="nom">Estudiante</th>${fechas.map((f) => fechas.length > 10 ? `<th class="vert"><div>${fmtCorta(f)}</div></th>` : `<th>${fmtCorta(f)}</th>`).join("")}<th>P</th><th>R</th><th>FI</th><th>FJ</th><th>% asist.</th></tr>`;
  return { cuerpo: `<table><thead>${cab}</thead><tbody>${filas}</tbody></table><div class="leyenda">P = presente · R = retardo · FI = falta injustificada · FJ = falta justificada. % de asistencia = (P + R) ÷ registros. Las FI en rojo son 3 o más.</div>`, denso: fechas.length > 16 };
}

async function htmlResumen(ctx, { desde, hasta, materiaId }) {
  const { gradoId, estudiantes } = ctx;
  const todas = await api.fetchAsistenciaDetalladaCurso(gradoId, desde, hasta);
  const reg = materiaId ? todas.filter((r) => String(r.materia_id) === String(materiaId)) : todas;
  if (!reg.length) return { cuerpo: tablaVacia("No hay asistencia registrada en esas fechas."), denso: false };
  const t = {}; estudiantes.forEach((e) => { t[e.id] = { P: 0, R: 0, FI: 0, FJ: 0 }; });
  reg.forEach((r) => { if (t[r.estudiante_id] && t[r.estudiante_id][r.codigo] !== undefined) t[r.estudiante_id][r.codigo]++; });
  const tot = { P: 0, R: 0, FI: 0, FJ: 0 };
  const filas = estudiantes.map((e, i) => {
    const x = t[e.id]; const n = x.P + x.R + x.FI + x.FJ;
    Object.keys(tot).forEach((k) => { tot[k] += x[k]; });
    return `<tr><td class="n">${i + 1}</td><td class="nom">${esc(e.nombre)}</td><td>${x.P}</td><td>${x.R}</td><td class="${x.FI >= 3 ? "bajo" : ""}">${x.FI}</td><td>${x.FJ}</td><td>${n}</td><td class="fin">${n ? Math.round(((x.P + x.R) / n) * 100) + "%" : ""}</td></tr>`;
  }).join("");
  const nT = tot.P + tot.R + tot.FI + tot.FJ;
  return { cuerpo: `<table><thead><tr><th class="n">N°</th><th class="nom">Estudiante</th><th>P</th><th>R</th><th>FI</th><th>FJ</th><th>Registros</th><th>% asistencia</th></tr></thead><tbody>${filas}</tbody><tfoot><tr><td colspan="2" class="nom">Total del curso</td><td>${tot.P}</td><td>${tot.R}</td><td>${tot.FI}</td><td>${tot.FJ}</td><td>${nT}</td><td>${nT ? Math.round(((tot.P + tot.R) / nT) * 100) + "%" : ""}</td></tr></tfoot></table><div class="leyenda">P = presente · R = retardo · FI = falta injustificada · FJ = falta justificada. % de asistencia = (P + R) ÷ registros. Las FI en rojo son 3 o más.</div>`, denso: false };
}

function htmlBlanco(ctx, columnas) {
  const n = Math.max(1, Math.min(40, Number(columnas) || 15));
  const filas = ctx.estudiantes.map((e, i) => `<tr style="height:22px"><td class="n">${i + 1}</td><td class="nom">${esc(e.nombre)}</td>${"<td></td>".repeat(n)}</tr>`).join("");
  return { cuerpo: `<table><thead><tr><th class="n">N°</th><th class="nom">Estudiante</th>${Array.from({ length: n }, () => "<th style=\"min-width:26px\">&nbsp;</th>").join("")}</tr></thead><tbody>${filas}</tbody></table>`, denso: n > 14 };
}


/* ---------- informe individual del estudiante ---------- */
const ESTADO_NIV = { pendiente: "Pendiente", en_proceso: "En proceso", superado: "Superado" };
const promedioDe = (arr) => { const v = arr.filter((x) => x !== null && x !== undefined && !Number.isNaN(Number(x))).map(Number); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

export async function htmlEstudiante(ctx, { estudiante: e, materias, opts, curso }) {
  const { gradoId } = ctx;
  const comentarios = await api.fetchComentariosDesempeno().catch(() => ({}));
  const bloques = [];
  const actuales = []; // nota actual de cada materia, para el resumen superior
  let configBase = CONFIG_DEFAULT;

  for (const m of materias) {
    const [config, categorias, finales, niv] = await Promise.all([
      api.fetchNotasConfig(m.id).catch(() => CONFIG_DEFAULT), api.fetchCategorias(m.id).catch(() => []),
      api.fetchNotasFinales(m.id).catch(() => []), api.fetchNivelacion(m.id).catch(() => []),
    ]);
    configBase = config;
    const periodos = periodosDe(config);
    const actual = String(config.periodo_actual || "1");
    const mias = {}; (finales || []).filter((f) => f.estudiante_id === e.id).forEach((f) => { mias[String(f.periodo)] = f.nota; });
    const nivs = {}; (niv || []).filter((n) => n.estudiante_id === e.id).forEach((n) => { nivs[String(n.periodo)] = n; });
    const acts = await api.fetchActividades(m.id, gradoId, actual).catch(() => []);
    if (!acts.length && !Object.keys(mias).length) continue; // nada de esta materia para el curso

    const d = acts.length ? await datosPeriodo({ materiaId: m.id, gradoId, periodo: actual, estudiantes: [e], categorias, config }) : null;
    const notaDe = (p) => (String(p) === actual && d ? d.finalDe(e.id) : (mias[String(p)] ?? null));
    const notaActual = notaDe(actual);
    actuales.push({ materia: m.nombre, nota: notaActual, config });

    // Resultado por periodo
    const filaNotas = periodos.map((p) => {
      const n = notaDe(p);
      const enCurso = String(p) === actual && mias[String(p)] === undefined;
      return `<td${estiloNota(n, config)}>${n === null || n === undefined ? "—" : `<b>${fmtNota(n)}</b>`}${enCurso && n !== null ? `<div class="obs" style="text-align:center">en curso</div>` : ""}</td>`;
    }).join("");
    const filaBanda = periodos.map((p) => { const n = notaDe(p); return n === null || n === undefined ? "<td>—</td>" : `<td${estiloNota(n, config)}>${esc(bandaDesempeno(n, config).label)}</td>`; }).join("");
    const hayNiv = periodos.some((p) => nivs[String(p)]);
    const filaNiv = hayNiv ? `<tr><td class="nom">Recuperación / nivelación</td>${periodos.map((p) => {
      const r = nivs[String(p)]; if (!r) return "<td>—</td>";
      const partes = [`<b>${esc(ESTADO_NIV[r.estado] || r.estado)}</b>`];
      if (r.nota_original !== null && r.nota_original !== undefined) partes.push(`nota original ${fmtNota(r.nota_original)}`);
      if (r.nota_recuperacion !== null && r.nota_recuperacion !== undefined) partes.push(`recuperación ${fmtNota(r.nota_recuperacion)}`);
      return `<td style="font-size:9px">${partes.join("<br>")}</td>`;
    }).join("")}<td></td></tr>` : "";
    const prom = promedioDe(periodos.map((p) => notaDe(p)));
    const tabla = `<table><thead><tr><th class="nom">Resultado</th>${periodos.map((p) => `<th>Periodo ${esc(p)}</th>`).join("")}<th>Promedio</th></tr></thead><tbody>
      <tr><td class="nom">Nota final</td>${filaNotas}${celdaNota(prom, config, "fin")}</tr>
      <tr><td class="nom">Desempeño</td>${filaBanda}${celdaBanda(prom, config)}</tr>${filaNiv}</tbody></table>`;

    // Detalle del periodo actual por categoría
    let detalle = "";
    if (opts.actividades && acts.length && d) {
      let valoresBD = {};
      try { (await api.fetchValores(acts.map((a) => a.id))).filter((v) => v.estudiante_id === e.id).forEach((v) => { valoresBD[v.actividad_id] = v; }); } catch { /* sin observaciones */ }
      const grupos = categorias.map((c) => ({ c, items: acts.filter((a) => a.categoria_id === c.id) })).filter((g) => g.items.length);
      const usadas = new Set(grupos.flatMap((g) => g.items.map((a) => a.id)));
      const otras = acts.filter((a) => !usadas.has(a.id));
      if (otras.length) grupos.push({ c: { id: "o", nombre: "Otras actividades", porcentaje: null }, items: otras });
      const filas = grupos.map((g) => {
        const vals = g.items.map((a) => d.valorDe(a, e.id));
        const pc = promedioDe(vals);
        const cab = `<tr><td colspan="${opts.observaciones ? 4 : 3}" class="izq" style="background:#eef2ff;font-weight:700;color:#17264D">${esc(g.c.nombre)}${g.c.porcentaje != null ? ` · ${esc(g.c.porcentaje)}% de la nota` : ""}</td></tr>`;
        const cuerpo = g.items.map((a, i) => {
          const v = vals[i];
          const obs = valoresBD[a.id]?.observacion;
          return `<tr><td></td><td class="izq">${esc(a.nombre)}</td>${celdaNota(v, config)}${opts.observaciones ? `<td class="obs">${obs ? esc(obs) : ""}</td>` : ""}</tr>`;
        }).join("");
        const pie = `<tr><td></td><td class="izq" style="font-weight:700">Promedio de la categoría</td>${celdaNota(pc, config, "fin")}${opts.observaciones ? "<td></td>" : ""}</tr>`;
        return cab + cuerpo + pie;
      }).join("");
      detalle = `<h4>Notas del periodo ${esc(actual)} (periodo actual)</h4><table><thead><tr><th style="width:14px"></th><th class="izq">Actividad</th><th style="width:48px">Nota</th>${opts.observaciones ? '<th class="izq">Observación del docente</th>' : ""}</tr></thead><tbody>${filas}</tbody></table>`;
    }
    const band = notaActual !== null && notaActual !== undefined ? bandaDesempeno(notaActual, config) : null;
    const coment = band && comentarios[band.key] ? `<div class="cuadro"><b>Comentario de desempeño (${esc(band.label)}):</b> ${esc(comentarios[band.key])}</div>` : "";
    bloques.push(`<div class="mat"><h3>📘 ${esc(m.nombre)}</h3>${tabla}${detalle}${coment}</div>`);
  }

  // Resumen superior
  const conNota = actuales.filter((a) => a.nota !== null && a.nota !== undefined);
  const promG = promedioDe(conNota.map((a) => a.nota));
  const perdiendo = conNota.filter((a) => Number(a.nota) < Number(a.config.nota_minima));
  const chips = [
    promG !== null ? `<span class="chip"${estiloNota(promG, configBase)}>Promedio periodo actual: ${fmtNota(promG)}</span>` : "",
    perdiendo.length ? `<span class="chip" style="background:#FEE2E2;color:#B91C1C">Perdiendo ${perdiendo.length}: ${esc(perdiendo.map((p) => p.materia).join(", "))}</span>` : (conNota.length ? `<span class="chip" style="background:#DCFCE7;color:#15803D">Sin materias perdidas</span>` : ""),
  ].join(" ");
  const encabezado = `<div class="est"><div class="nm">${esc(e.nombre)}</div><div style="font-size:10px;color:#334155">Curso: <b>${esc(curso || gradoId)}</b></div><div>${chips}</div></div>`;

  // Asistencia
  let asistencia = "";
  if (opts.asistencia) {
    try {
      const a = await api.fetchAsistenciaConsolidadaEstudiante(e.id);
      const filasA = Object.entries(a.porMateria).map(([nom, x]) => `<tr><td class="nom">${esc(nom)}</td><td>${x.P || 0}</td><td>${x.R || 0}</td><td class="${(x.FI || 0) >= 3 ? "bajo" : ""}">${x.FI || 0}</td><td>${x.FJ || 0}</td><td class="fin">${x.total ? Math.round((((x.P || 0) + (x.R || 0)) / x.total) * 100) + "%" : ""}</td></tr>`).join("");
      const g = a.general;
      asistencia = a.registros.length ? `<div class="mat"><h3>🗓️ Asistencia</h3><table><thead><tr><th class="nom">Materia</th><th>P</th><th>R</th><th>FI</th><th>FJ</th><th>% asistencia</th></tr></thead><tbody>${filasA}</tbody><tfoot><tr><td class="nom">Total</td><td>${g.P || 0}</td><td>${g.R || 0}</td><td>${g.FI || 0}</td><td>${g.FJ || 0}</td><td>${g.total ? Math.round((((g.P || 0) + (g.R || 0)) / g.total) * 100) + "%" : ""}</td></tr></tfoot></table><div class="leyenda">P presente · R retardo · FI falta injustificada · FJ falta justificada</div></div>` : "";
    } catch { /* sin asistencia */ }
  }

  // Observador (opcional: es información sensible)
  let observador = "";
  if (opts.observador) {
    try {
      const an = await api.fetchAnotaciones(e.id);
      const texto = (x) => x.descripcion || x.texto || x.observacion || x.detalle || x.anotacion || x.comentario || "";
      if (an.length) observador = `<div class="mat"><h3>🗒️ Observaciones del observador</h3>${an.map((x) => `<div class="cuadro"><b>${esc(fmtFecha(x.fecha || x.created_at || ""))}</b>${x.categoria ? ` · ${esc(x.categoria)}` : ""}${x.titulo ? ` · <b>${esc(x.titulo)}</b>` : ""}<br>${esc(texto(x))}</div>`).join("")}</div>`;
    } catch { /* sin anotaciones */ }
  }

  if (!bloques.length && !asistencia && !observador) return { cuerpo: encabezado + tablaVacia("Este estudiante todavía no tiene notas registradas en tus materias."), denso: false };
  return { cuerpo: encabezado + bloques.join("") + asistencia + observador + (conNota.length ? leyendaBandas(configBase) : ""), denso: false };
}


async function htmlGruposNotas(ctx, { ids, grupos, periodo, materiaId }) {
  const partes = [];
  for (const id of ids) {
    const g = grupos.find((x) => x.id === id);
    const est = ordenarMixto(await fetchEstudiantesGrupo(id));
    const d = await datosPeriodo({ materiaId, gradoId: id, periodo, estudiantes: est, categorias: ctx.categorias, config: ctx.config });
    const cuerpo = d.acts.length && est.length ? htmlPlanilla({ ...ctx, gradoId: id, estudiantes: est }, d).cuerpo
      : tablaVacia(est.length ? "Este grupo todavía no tiene actividades en este periodo." : "Este grupo no tiene estudiantes.");
    partes.push(`<div class="secg"><h3 class="gt">👥 ${esc(g?.nombre || "Grupo mixto")} · ${est.length} estudiante(s)${g?.descripcion ? ` · ${esc(quitarHtml(g.descripcion))}` : ""}</h3>${cuerpo}</div>`);
  }
  return { cuerpo: partes.join(""), denso: false };
}

async function htmlGrupo(ctx, { grupoId, grupoNombre }) {
  const { estudiantes } = ctx;
  let det = { miembros: [], equipos: [] };
  try { det = await fetchDetalleGrupo(grupoId); } catch { /* sin equipos */ }
  const equipoDe = {}; (det.miembros || []).forEach((m) => { if (m.equipo) equipoDe[m.estudiante_id] = m.equipo; });
  let ult = null, n = 0;
  const filas = estudiantes.map((e) => {
    const cab = e.grado_id !== ult ? `<tr><td colspan="4" class="izq" style="background:#eef2ff;font-weight:700;color:#17264D">Grado ${esc(e.grado_id ?? "—")}</td></tr>` : "";
    ult = e.grado_id; n += 1;
    return `${cab}<tr><td class="n">${n}</td><td class="nom">${esc(e._nom || e.nombre)}</td><td>${esc(e.grado_id ?? "")}</td><td>${esc(equipoDe[e.id] || "")}</td></tr>`;
  }).join("");
  const equipos = (det.equipos || []).map((q) => {
    const ints = estudiantes.filter((e) => equipoDe[e.id] === q.nombre).map((e) => `${esc(e._nom || e.nombre)} (${esc(e.grado_id ?? "")})`);
    const trabajo = quitarHtml(q.trabajo);
    return `<div class="mat"><h3>🧩 ${esc(q.nombre)} · ${ints.length} integrante(s)</h3><div class="cuadro">${ints.join(" · ") || "Sin integrantes"}</div>${trabajo ? `<div class="cuadro" style="white-space:pre-wrap"><b>Trabajo:</b> ${esc(trabajo)}</div>` : ""}</div>`;
  }).join("");
  const porGrado = {}; estudiantes.forEach((e) => { porGrado[e.grado_id] = (porGrado[e.grado_id] || 0) + 1; });
  const resumen = Object.entries(porGrado).map(([g, c]) => `<span class="chip" style="background:#EEF2FF;color:#17264D">${esc(g)}: ${c}</span>`).join(" ");
  return { cuerpo: `<div class="est"><div class="nm">👥 ${esc(grupoNombre)}</div><div>${resumen}</div></div>
    <table><thead><tr><th class="n">N°</th><th class="nom">Estudiante (apellidos y nombres)</th><th>Grado</th><th>Equipo</th></tr></thead><tbody>${filas}</tbody></table>${equipos ? `<h4 style="margin:12px 0 4px">Equipos y trabajo</h4>${equipos}` : ""}`, denso: estudiantes.length > 40 };
}

/* ---------- pantalla ---------- */
export function VistaImpresion({ grados = [], gradoActivo, materiaActiva }) {
  const [gradoId, setGradoId] = useState(gradoActivo || grados[0]?.id || "");
  const [materias, setMaterias] = useState([]);
  const [materiaId, setMateriaId] = useState(materiaActiva || "");
  const [config, setConfig] = useState(CONFIG_DEFAULT);
  const [periodo, setPeriodo] = useState("1");
  const [informe, setInforme] = useState("planilla");
  const [papel, setPapel] = useState("carta");
  const [desde, setDesde] = useState(haceDias(60));
  const [hasta, setHasta] = useState(hoy());
  const [columnas, setColumnas] = useState(15);
  const [firmasOn, setFirmasOn] = useState(true);
  const [orden, setOrden] = useState("apellido"); // "apellido" | "nombre"
  const [docenteNombre, setDocenteNombre] = useState(() => { try { return localStorage.getItem("codice_print_docente") || ""; } catch { return ""; } });
  const [recordarNombre, setRecordarNombre] = useState(true);
  const [listaEst, setListaEst] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [selGrupos, setSelGrupos] = useState([]);
  useEffect(() => { fetchGruposMixtos().then((g) => { setGrupos(g || []); setSelGrupos((g || []).map((x) => x.id)); }).catch(() => {}); }, []);
  const cargarEst = (id) => (esGrupoMixto(id) ? fetchEstudiantesGrupo(id).then(ordenarMixto) : api.fetchEstudiantesPorGrado(id).then((l) => ordenar(l, orden)));
  const [estId, setEstId] = useState("");
  const [opts, setOpts] = useState({ actividades: true, observaciones: true, asistencia: true, observador: false });
  const [html, setHtml] = useState("");
  const [msg, setMsg] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const marco = useRef(null);

  useEffect(() => { if (gradoActivo) setGradoId(gradoActivo); }, [gradoActivo]);
  useEffect(() => { api.fetchMisMaterias().then((m) => { setMaterias(m); setMateriaId((x) => x || (m.find((q) => String(q.id) === String(materiaActiva))?.id ?? m[0]?.id ?? "")); }).catch((e) => setMsg(e.message)); }, []);
  useEffect(() => { if (materiaActiva) setMateriaId(materiaActiva); }, [materiaActiva]);
  useEffect(() => { if (materiaId) api.fetchNotasConfig(materiaId).then((c) => { setConfig(c); setPeriodo(String(c.periodo_actual || "1")); }).catch(() => {}); }, [materiaId]);
  useEffect(() => { // lista de estudiantes del curso (para el informe individual)
    if (!gradoId) return;
    cargarEst(gradoId).then((o) => { setListaEst(o); setEstId((x) => (o.some((e) => String(e.id) === String(x)) ? x : (o[0]?.id ?? ""))); }).catch(() => {});
  }, [gradoId, orden]);
  useEffect(() => { // si aún no escribiste tu nombre, usa el de tu perfil (nunca el correo)
    if (docenteNombre) return;
    api.fetchMiPerfil().then((p) => { if (p?.nombre && !/@/.test(p.nombre)) setDocenteNombre(p.nombre); }).catch(() => {});
    // eslint-disable-next-line
  }, []);
  useEffect(() => { setHtml(""); }, [selGrupos, estId, opts, docenteNombre, gradoId, materiaId, periodo, informe, papel, desde, hasta, columnas, firmasOn, orden]);

  const def = INFORMES.find((i) => i.key === informe);
  const materia = materias.find((m) => String(m.id) === String(materiaId));
  const grado = grados.find((g) => String(g.id) === String(gradoId));
  const nombreGrado = esGrupoMixto(gradoId) ? `Grupo mixto: ${(grupos.find((g) => g.id === gradoId) || {}).nombre || ""}` : (grado?.nombre || gradoId);

  const generar = async () => {
    setMsg(""); setTrabajando(true); setHtml("");
    try {
      if (!gradoId) throw new Error("Elige un curso.");
      const necesitaMateria = informe !== "blanco" && informe !== "estudiante" && informe !== "grupo";
      if (informe === "gruposnotas" && !materiaId) throw new Error("Elige una materia.");
      if (necesitaMateria && !materiaId) throw new Error("Elige una materia.");
      const [ins, perfil, estRaw, cats] = await Promise.all([
        api.fetchInstitucion().catch(() => null), api.fetchMiPerfil().catch(() => null),
        esGrupoMixto(gradoId) ? fetchEstudiantesGrupo(gradoId) : api.fetchEstudiantesPorGrado(gradoId), materiaId ? api.fetchCategorias(materiaId) : Promise.resolve([]),
      ]);
      const estudiantes = esGrupoMixto(gradoId) ? ordenarMixto(estRaw) : ordenar(estRaw, orden);
      const ctx = { materiaId, gradoId, estudiantes, categorias: cats, config };
      let r;
      if (informe === "gruposnotas") {
        if (!selGrupos.length) throw new Error("Marca al menos un grupo mixto.");
        r = await htmlGruposNotas(ctx, { ids: selGrupos, grupos, periodo, materiaId });
      }
      else if (informe === "grupo") {
        if (!esGrupoMixto(gradoId)) throw new Error("Este informe es para grupos mixtos: elige uno en «Curso» (aparecen con 👥).");
        r = await htmlGrupo(ctx, { grupoId: gradoId, grupoNombre: nombreGrado });
      }
      else if (informe === "planilla") r = htmlPlanilla(ctx, await datosPeriodo({ ...ctx, periodo }));
      else if (informe === "desempeno") r = htmlDesempeno(ctx, await datosPeriodo({ ...ctx, periodo }));
      else if (informe === "consolidado") r = await htmlConsolidado(ctx);
      else if (informe === "asistencia") r = await htmlAsistencia(ctx, { desde, hasta, materiaId });
      else if (informe === "resumen") r = await htmlResumen(ctx, { desde, hasta, materiaId });
      else if (informe === "estudiante") {
        const est = estudiantes.find((x) => String(x.id) === String(estId));
        if (!est) throw new Error("Elige un estudiante.");
        r = await htmlEstudiante(ctx, { estudiante: est, materias, opts, curso: nombreGrado });
      }
      else r = htmlBlanco(ctx, columnas);
      const nombreDoc = docenteNombre.trim() || (perfil?.nombre && !/@/.test(perfil.nombre) ? perfil.nombre : "");
      if (docenteNombre.trim()) {
        try { localStorage.setItem("codice_print_docente", docenteNombre.trim()); } catch { /* sin almacenamiento */ }
        if (recordarNombre && docenteNombre.trim() !== (perfil?.nombre || "")) { try { await api.guardarMiNombre(docenteNombre.trim()); } catch { /* no bloquea la impresión */ } }
      }
      const meta = [
        ["Curso", informe === "gruposnotas" ? "Grupos mixtos" : nombreGrado],
        ["Materia", informe === "blanco" ? "" : (materia?.nombre || "")],
        ["Docente", nombreDoc],
        ["Periodo", def.usa.includes("periodo") ? `Periodo ${periodo}` : ""],
        ["Fechas", def.usa.includes("fechas") ? `${fmtFecha(desde)} al ${fmtFecha(hasta)}` : ""],
        ["Estudiantes", String(estudiantes.length)],
      ].filter((x) => !(informe === "estudiante" && (x[0] === "Estudiantes" || x[0] === "Materia")));
      setHtml(documento({ titulo: def.titulo, subtitulo: def.titulo, ins, meta, cuerpo: r.cuerpo, pie: firmasOn ? firmas(nombreDoc) : "", papel, horizontal: def.horizontal, denso: r.denso }));
    } catch (e) { setMsg(e.message || String(e)); }
    setTrabajando(false);
  };

  const imprimir = () => { const w = marco.current?.contentWindow; if (!w) return; w.focus(); w.print(); };
  const sel = "text-sm rounded-lg px-2 py-1.5 border border-slate-200 bg-white";
  const mostrar = (k) => def.usa.includes(k);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="text-sm font-semibold text-slate-700 mb-2">1. ¿Qué quieres imprimir?</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {INFORMES.map((i) => (
            <button key={i.key} onClick={() => setInforme(i.key)} className={`text-left rounded-xl border p-2.5 ${informe === i.key ? "border-violet-500 bg-violet-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
              <div className="text-sm font-bold text-slate-800">{i.emoji} {i.titulo}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{i.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
        <div className="text-sm font-semibold text-slate-700">2. Datos del documento</div>
        <div className="flex flex-wrap items-center gap-2">
          {informe !== "gruposnotas" && <select className={sel} value={gradoId} onChange={(e) => setGradoId(e.target.value)}>{grados.map((g) => <option key={g.id} value={g.id}>{g.nombre || g.id}</option>)}{grupos.length > 0 && <optgroup label="Grupos mixtos">{grupos.map((g) => <option key={g.id} value={g.id}>👥 {g.nombre}</option>)}</optgroup>}</select>}
          {informe !== "blanco" && informe !== "estudiante" && informe !== "grupo" && <select className={sel} value={materiaId} onChange={(e) => setMateriaId(e.target.value)}>{materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>}
          {mostrar("grupos") && <div className="basis-full flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            <span className="font-semibold">Grupos:</span>
            {grupos.length === 0 && <span className="text-slate-400">Aún no tienes grupos mixtos.</span>}
            {grupos.map((g) => (<label key={g.id} className="flex items-center gap-1"><input type="checkbox" checked={selGrupos.includes(g.id)} onChange={(e) => setSelGrupos((l) => (e.target.checked ? [...l, g.id] : l.filter((x) => x !== g.id)))} /> 👥 {g.nombre}</label>))}
          </div>}
          {mostrar("estudiante") && <select className={sel + " w-64"} value={estId} onChange={(e) => setEstId(e.target.value)}>{listaEst.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select>}
          {mostrar("estudiante") && <div className="basis-full flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            <span className="font-semibold">Incluir:</span>
            {[["actividades", "Notas del periodo actual"], ["observaciones", "Observaciones por actividad"], ["asistencia", "Asistencia"], ["observador", "Anotaciones del observador (sensible)"]].map(([k, t]) => (
              <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={opts[k]} onChange={(e) => setOpts((o) => ({ ...o, [k]: e.target.checked }))} /> {t}</label>
            ))}
          </div>}
          {mostrar("periodo") && <select className={sel} value={periodo} onChange={(e) => setPeriodo(e.target.value)}>{periodosDe(config).map((p) => <option key={p} value={p}>Periodo {p}</option>)}</select>}
          {mostrar("fechas") && <><label className="text-xs text-slate-600">Desde <input type="date" className={sel} value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
            <label className="text-xs text-slate-600">Hasta <input type="date" className={sel} value={hasta} onChange={(e) => setHasta(e.target.value)} /></label></>}
          {mostrar("columnas") && <label className="text-xs text-slate-600">Columnas vacías <input type="number" min="1" max="40" className={sel + " w-20"} value={columnas} onChange={(e) => setColumnas(e.target.value)} /></label>}
          <label className="text-xs text-slate-600">Papel <select className={sel} value={papel} onChange={(e) => setPapel(e.target.value)}><option value="carta">Carta</option><option value="oficio">Oficio</option><option value="a4">A4</option></select></label>
          <label className="text-xs text-slate-600">Ordenar por <select className={sel} value={orden} onChange={(e) => setOrden(e.target.value)}><option value="apellido">Apellidos (Apellidos Nombres)</option><option value="nombre">Nombres (Nombres Apellidos)</option></select></label>
          <label className="text-xs text-slate-600">Docente <input className={sel + " w-56"} value={docenteNombre} onChange={(e) => setDocenteNombre(e.target.value)} placeholder="Tu nombre completo" /></label>
          <label className="text-xs text-slate-600 flex items-center gap-1" title="Guarda este nombre en tu perfil"><input type="checkbox" checked={recordarNombre} onChange={(e) => setRecordarNombre(e.target.checked)} /> Recordar</label>
          <label className="text-xs text-slate-600 flex items-center gap-1"><input type="checkbox" checked={firmasOn} onChange={(e) => setFirmasOn(e.target.checked)} /> Líneas de firma</label>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button disabled={trabajando} onClick={generar} className="text-sm px-4 py-2 rounded-lg bg-violet-600 text-white disabled:opacity-50">{trabajando ? "Preparando…" : "Ver vista previa"}</button>
          {html && <button onClick={imprimir} className="text-sm px-4 py-2 rounded-lg bg-emerald-600 text-white">🖨️ Imprimir / guardar PDF</button>}
          <span className="text-[11px] text-slate-400">En el cuadro de impresión elige «Guardar como PDF» si quieres el archivo. {def.horizontal ? "Este informe sale en hoja horizontal." : ""}</span>
        </div>
        {msg && <div className="text-xs text-rose-600">{msg}</div>}
      </div>

      {html && (
        <div className="rounded-xl border border-slate-200 bg-slate-100 p-2">
          <iframe ref={marco} title="Vista previa" srcDoc={html} className="w-full bg-white rounded-lg" style={{ height: "70vh", border: "1px solid #e2e8f0" }} />
        </div>
      )}
    </div>
  );
}
