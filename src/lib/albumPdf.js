/* ============================================================================
   📄 Descargar el álbum en PDF (se abre el cuadro de impresión: "Guardar como PDF").
   - modo "docente": todas las láminas a color con su nombre (álbum completo).
   - modo "estudiante": las que tiene a color; las que faltan en gris con "?".
   `paginas` = [{ id, titulo, laminas: [{ nombre, imagen_url, rareza, cantidad? }] }]
   ============================================================================ */
const RAREZA_COLOR = { comun: "#94A3B8", rara: "#3B82F6", epica: "#8B5CF6", legendaria: "#F59E0B" };
const RAREZA_TXT = { comun: "Común", rara: "Rara", epica: "Épica", legendaria: "Legendaria" };
const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const POR_HOJA = 12; // 3 columnas x 4 filas

export function htmlAlbumPdf({ album, paginas, modo = "docente", quien = "", institucion = "" }) {
  const color = album?.color || "#2F55A4";
  const todas = paginas.flatMap((p) => p.laminas);
  const tengo = (l) => modo === "docente" || (l.cantidad || 0) > 0;
  const n = todas.length, t = todas.filter(tengo).length;
  let cont = 0;

  const slot = (l, i) => {
    const num = String(i).padStart(2, "0");
    const c = RAREZA_COLOR[l.rareza] || RAREZA_COLOR.comun;
    if (!tengo(l)) return `<div class="sl falta"><div class="im"><span>?</span></div><div class="nm">Nº ${num}</div></div>`;
    const rep = modo === "estudiante" && l.cantidad > 1 ? `<i class="rep">x${l.cantidad}</i>` : "";
    return `<div class="sl" style="border-color:${c}"><div class="im" style="background:${c}18">${l.imagen_url ? `<img src="${esc(l.imagen_url)}" alt="">` : ""}${rep}</div><div class="nm"><b>${esc(l.nombre || "Lámina")}</b><small style="color:${c}">${RAREZA_TXT[l.rareza] || ""}</small></div></div>`;
  };

  const hojas = paginas.map((p, pi) => {
    const trozos = [];
    for (let i = 0; i < p.laminas.length; i += POR_HOJA) trozos.push(p.laminas.slice(i, i + POR_HOJA));
    if (!trozos.length) trozos.push([]);
    const comp = modo === "estudiante" ? ` · ${p.laminas.filter(tengo).length}/${p.laminas.length}` : "";
    return trozos.map((tr, ti) => `<section class="hoja"><div class="top" style="background:${color}"><span>${esc(album?.nombre || "Álbum")}</span><span>Página ${pi + 1}${trozos.length > 1 ? ` (${ti + 1}/${trozos.length})` : ""}${comp}</span></div>
      ${p.titulo && ti === 0 ? `<h2 style="color:${color}">${esc(p.titulo)}</h2>` : `<h2>&nbsp;</h2>`}
      <div class="grid">${tr.map((l) => slot(l, ++cont)).join("")}</div></section>`).join("");
  }).join("");

  const portada = `<section class="hoja portada" style="border-color:${color}">
    ${album?.portada_url ? `<img class="por" src="${esc(album.portada_url)}" alt="">` : `<div class="emoji">📒</div>`}
    <h1 style="color:${color}">${esc(album?.nombre || "Álbum")}</h1>
    ${album?.descripcion ? `<p>${esc(album.descripcion)}</p>` : ""}
    <p class="dat">${paginas.length} páginas · ${n} láminas${modo === "estudiante" ? ` · conseguidas ${t} de ${n} (${n ? Math.round((t / n) * 100) : 0}%)` : ""}</p>
    ${quien ? `<p class="quien">${esc(quien)}</p>` : ""}${institucion ? `<p class="ins">${esc(institucion)}</p>` : ""}
    <p class="ins">${new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "long", year: "numeric" })}</p></section>`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(album?.nombre || "Álbum")}</title><style>
@page{size:A4 portrait;margin:10mm}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#0f172a}
.hoja{page-break-after:always;break-after:page;height:277mm;display:flex;flex-direction:column;padding:0}
.hoja:last-child{page-break-after:auto;break-after:auto}
.top{color:#fff;display:flex;justify-content:space-between;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700}
h2{margin:10px 0 8px;font-size:18px;text-align:center}
.grid{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(4,1fr);gap:10px;flex:1;min-height:0;padding-bottom:4px}
.sl{border:2px solid;border-radius:10px;padding:6px;display:flex;flex-direction:column;background:#fff;min-height:0}
.sl .im{flex:1;min-height:0;border-radius:6px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.sl img{max-width:100%;max-height:100%;object-fit:contain}
.sl .nm{text-align:center;font-size:12px;margin-top:4px;display:flex;flex-direction:column}
.sl .nm small{font-size:9px;font-weight:700}
.falta{border:2px dashed #cbd5e1;background:#f8fafc}.falta .im{background:#e2e8f0}.falta span{font-size:46px;color:#94a3b8;font-weight:800}
.falta .nm{color:#94a3b8;font-weight:700}
.rep{position:absolute;top:2px;right:2px;background:#0f172a;color:#fff;font-size:10px;font-style:normal;border-radius:8px;padding:1px 6px}
.portada{border:6px double;border-radius:16px;align-items:center;justify-content:center;text-align:center;padding:30px}
.portada h1{font-size:38px;margin:14px 0 6px}.portada .emoji{font-size:90px}.por{max-width:70%;max-height:90mm;border-radius:12px}
.portada p{font-size:14px;color:#475569;margin:5px 0}.portada .dat{font-weight:700;color:#0f172a;font-size:15px}.portada .quien{font-size:20px;font-weight:800;color:#0f172a;margin-top:18px}.portada .ins{font-size:12px}
</style></head><body>${portada}${hojas}</body></html>`;
}

// Abre el cuadro de impresión (Guardar como PDF) con el álbum ya dibujado.
export function descargarPdfAlbum(opciones) {
  const html = htmlAlbumPdf(opciones);
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(f);
  const w = f.contentWindow; w.document.open(); w.document.write(html); w.document.close();
  const quitar = () => setTimeout(() => f.remove(), 1000);
  const imprimir = () => { try { w.focus(); w.onafterprint = quitar; w.print(); } catch { quitar(); } };
  const imgs = [...w.document.images];
  Promise.all(imgs.map((im) => (im.complete ? 1 : new Promise((ok) => { im.onload = im.onerror = ok; })))).then(() => setTimeout(imprimir, 300));
}
