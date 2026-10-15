// Documento imprimible (y guardable como PDF) de un Control de Dirección de Curso.
// Se escapa todo lo que escribe la docente (nombres, observaciones…) para que nunca se interprete como HTML.
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const urlImagen = (u) => (/^(https?:\/\/|data:image\/(png|jpe?g|webp|gif);base64,)/i.test(String(u || "").trim()) ? esc(String(u).trim()) : "");
export const moneda = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CO");
const fechaLarga = (d) => d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
// "2026-10-15" → "15/10/2026" (si no tiene ese formato se deja igual)
const fechaCorta = (s) => { const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s || ""); };

/**
 * control: { nombre, descripcion, monto_esperado, fecha_limite } · estudiantes: [{ id, nombre }] (ya ordenados)
 * estados: { [estudianteId]: { completado, monto_pagado, fecha_pago, observacion } } · institucion: { nombre, logo_url, direccion, telefono }
 * → texto HTML completo de la página
 */
export function htmlControlCurso({ control, gradoId, estudiantes = [], estados = {}, institucion = null, docente = "", fecha = new Date(), autoImprimir = true }) {
  const esPago = control.monto_esperado != null;
  const est = (e) => estados[e.id] || {};
  const hechos = estudiantes.filter((e) => est(e).completado).length;
  const recaudado = estudiantes.reduce((a, e) => a + (Number(est(e).monto_pagado) || 0), 0);
  const esperado = esPago ? Number(control.monto_esperado) * estudiantes.length : 0;
  const logo = urlImagen(institucion?.logo_url);
  const filas = estudiantes.map((e, i) => {
    const s = est(e), si = !!s.completado;
    return `<tr>
      <td class="c">${i + 1}</td>
      <td>${esc(e.nombre)}</td>
      <td class="c ${si ? "si" : "no"}">${si ? "✓ Sí" : "— No"}</td>
      ${esPago ? `<td class="r">${s.monto_pagado ? moneda(s.monto_pagado) : "—"}</td><td class="c">${s.fecha_pago ? esc(fechaCorta(s.fecha_pago)) : "—"}</td>` : ""}
      <td>${esc(s.observacion || "")}</td>
    </tr>`;
  }).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(control.nombre)} — Curso ${esc(gradoId)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; padding: 0; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .enc { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 14px; }
  .enc img { height: 55px; }
  .enc .t { flex: 1; text-align: center; }
  .enc .n { font-weight: bold; font-size: 15px; }
  .enc .s { font-size: 11px; }
  .enc .d { font-weight: bold; margin-top: 4px; font-size: 12px; }
  h2 { font-size: 15px; margin: 0 0 2px; }
  .desc { color: #444; margin: 0 0 6px; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 8px 0 12px; font-size: 11.5px; }
  .meta b { font-weight: bold; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #ede9fe; text-align: left; font-size: 11px; padding: 5px 6px; border: 1px solid #999; }
  td { padding: 4px 6px; border: 1px solid #bbb; vertical-align: top; }
  tr:nth-child(even) td { background: #f8f8fb; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
  .c { text-align: center; } .r { text-align: right; white-space: nowrap; }
  .si { color: #047857; font-weight: bold; } .no { color: #888; }
  .tot { margin-top: 10px; font-size: 12px; }
  .firmas { display: flex; justify-content: space-between; gap: 40px; margin-top: 56px; page-break-inside: avoid; }
  .firmas div { flex: 1; border-top: 1px solid #000; text-align: center; padding-top: 4px; font-size: 11px; }
  .pie { margin-top: 18px; font-size: 9.5px; color: #777; text-align: right; }
</style></head><body>
  <div class="enc">${logo ? `<img src="${logo}" alt="">` : ""}<div class="t">
    <div class="n">${esc(institucion?.nombre || "INSTITUCIÓN EDUCATIVA")}</div>
    ${institucion?.direccion ? `<div class="s">${esc(institucion.direccion)}${institucion?.telefono ? ` · Tel: ${esc(institucion.telefono)}` : ""}</div>` : ""}
    <div class="d">CONTROL DE CURSO</div></div></div>
  <h2>${esc(control.nombre)}</h2>
  ${control.descripcion ? `<p class="desc">${esc(control.descripcion)}</p>` : ""}
  <div class="meta">
    <span><b>Curso:</b> ${esc(gradoId)}</span>
    ${docente ? `<span><b>Director(a) de curso:</b> ${esc(docente)}</span>` : ""}
    ${control.fecha_limite ? `<span><b>Fecha límite:</b> ${esc(fechaCorta(control.fecha_limite))}</span>` : ""}
    ${esPago ? `<span><b>Valor por estudiante:</b> ${moneda(control.monto_esperado)}</span>` : ""}
    <span><b>Fecha del reporte:</b> ${esc(fechaLarga(fecha))}</span>
  </div>
  <table><thead><tr><th class="c" style="width:28px">#</th><th>Estudiante</th><th class="c" style="width:62px">Cumplió</th>${esPago ? `<th class="r" style="width:80px">Monto pagado</th><th class="c" style="width:74px">Fecha de pago</th>` : ""}<th>Observación</th></tr></thead>
  <tbody>${filas || `<tr><td colspan="${esPago ? 6 : 4}" class="c">Este curso no tiene estudiantes.</td></tr>`}</tbody></table>
  <div class="tot"><b>${hechos} de ${estudiantes.length}</b> estudiantes cumplieron${estudiantes.length ? ` (${Math.round((hechos / estudiantes.length) * 100)} %)` : ""}.${esPago ? ` &nbsp; <b>Recaudado:</b> ${moneda(recaudado)} de ${moneda(esperado)} esperados${esperado > recaudado ? ` (faltan ${moneda(esperado - recaudado)})` : ""}.` : ""}</div>
  <div class="firmas"><div>Director(a) de Curso</div><div>Coordinación / Rectoría</div></div>
  <div class="pie">Generado con CÓDICE · ${esc(fechaLarga(fecha))}</div>
  ${autoImprimir ? "<script>window.onload = function () { window.print(); };</script>" : ""}
</body></html>`;
}
