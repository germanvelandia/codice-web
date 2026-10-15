// Rúbricas: lectura del texto que devuelve la IA (o que pega la docente) y documento imprimible.
// Cada nivel puede traer su DESCRIPCIÓN: { nombre, puntos, descripcion }.

const sinMarcas = (s) => String(s ?? "").replace(/\*\*|__/g, "").replace(/^[\s#>*\-•–—]+/, "").trim();
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const RE_RUBRICA = /^[\s#>*\-•]*\**\s*R[ÚU]BRICA\s*\**\s*:\s*\**\s*(.*)$/i;
const RE_CRITERIO = /^[\s#>*\-•]*\**\s*CRITERIO\s*\**\s*:\s*\**\s*(.*)$/i;
// "Alto (5 pts): texto" · "- **Medio (3 pts):** texto" · "Bajo (1): texto" · "Alto — 5 pts: texto"
const RE_NIVEL = /^[\s#>*\-•]*\**\s*([^:(\n*]{1,40}?)\s*\**\s*(?:\(\s*(\d+(?:[.,]\d+)?)\s*(?:pts?\.?|puntos?)?\s*\)|[-–—]\s*(\d+(?:[.,]\d+)?)\s*(?:pts?\.?|puntos?))\s*\**\s*[:\-–—]?\s*\**\s*(.*)$/i;

export function analizarRubricasDeIA(texto) {
  const rubricas = []; let rub = null, cri = null, niv = null;
  const nuevaRub = (nombre) => { rub = { nombre, criterios: [] }; rubricas.push(rub); cri = null; niv = null; };
  for (const cruda of String(texto ?? "").split(/\r?\n/)) {
    const linea = cruda.trim(); if (!linea) { niv = niv; continue; }
    let m;
    if ((m = linea.match(RE_RUBRICA))) { nuevaRub(sinMarcas(m[1])); continue; }
    if ((m = linea.match(RE_CRITERIO))) {
      if (!rub) nuevaRub("Rúbrica importada");
      cri = { criterio: sinMarcas(m[1]), niveles: [] }; rub.criterios.push(cri); niv = null; continue;
    }
    if (cri && (m = linea.match(RE_NIVEL))) {
      niv = { nombre: sinMarcas(m[1]), puntos: parseFloat(String(m[2] ?? m[3]).replace(",", ".")) || 0, descripcion: sinMarcas(m[4]) };
      cri.niveles.push(niv); continue;
    }
    if (niv) niv.descripcion = (niv.descripcion + " " + sinMarcas(linea)).trim(); // continuación de la descripción
  }
  return rubricas.map((r) => ({ ...r, criterios: r.criterios.filter((c) => c.criterio && c.niveles.length) })).filter((r) => r.nombre && r.criterios.length);
}

// Rúbrica → texto con el mismo formato que se importa (para copiar / respaldar)
export function rubricaATexto(nombre, criterios) {
  return [`RÚBRICA: ${nombre}`, ...criterios.flatMap((c) => [`CRITERIO: ${c.criterio}`, ...c.niveles.map((n) => `${n.nombre} (${n.puntos} pts): ${n.descripcion || ""}`.trim())])].join("\n");
}

export const puntosMaximos = (criterios) => criterios.reduce((s, c) => s + Math.max(0, ...c.niveles.map((n) => Number(n.puntos) || 0)), 0);

// Documento imprimible: matriz criterios × niveles con las descripciones
export function htmlRubrica({ nombre, criterios, institucion, autoImprimir = true }) {
  const nivelesNombres = [];
  criterios.forEach((c) => c.niveles.forEach((n) => { if (!nivelesNombres.includes(n.nombre)) nivelesNombres.push(n.nombre); }));
  const cab = nivelesNombres.map((x) => `<th>${esc(x)}</th>`).join("");
  const filas = criterios.map((c) => {
    const celdas = nivelesNombres.map((nom) => { const n = c.niveles.find((x) => x.nombre === nom); return n ? `<td><div class="p">${esc(n.puntos)} pts</div>${esc(n.descripcion || "")}</td>` : "<td></td>"; }).join("");
    return `<tr><th class="c">${esc(c.criterio)}</th>${celdas}</tr>`;
  }).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Rúbrica — ${esc(nombre)}</title>
<style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#111;font-size:10.5px}h1{font-size:15px;margin:0}h2{font-size:13px;margin:6px 0 8px}
table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #444;padding:5px;vertical-align:top;text-align:left}thead th{background:#ede9fe;text-align:center}
th.c{background:#f5f3ff;width:16%}tr{page-break-inside:avoid}.p{font-weight:bold;color:#6d28d9;margin-bottom:2px}.m{margin-top:6px;font-size:10px}</style></head><body>
<h1>${esc(institucion?.nombre || "INSTITUCIÓN EDUCATIVA")}</h1><h2>RÚBRICA: ${esc(nombre)}</h2>
<table><thead><tr><th class="c">Criterio</th>${cab}</tr></thead><tbody>${filas}</tbody></table>
<div class="m">Puntaje máximo: ${puntosMaximos(criterios)} pts · Generado con CÓDICE</div>
${autoImprimir ? "<script>window.onload=function(){window.print();};</script>" : ""}</body></html>`;
}
