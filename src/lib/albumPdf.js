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
    if (!tengo(l)) return `<div class="sl falta"><div class="im"><b class="gn">${num}</b><span class="q">?</span></div><div class="et"><span>Nº ${num}</span></div></div>`;
    const rep = modo === "estudiante" && l.cantidad > 1 ? `<i class="rep">x${l.cantidad}</i>` : "";
    return `<div class="sl ok" style="--c:${c}"><div class="im">${l.imagen_url ? `<img src="${esc(l.imagen_url)}" alt="">` : ""}${rep}<em class="nn">${num}</em></div><div class="et" style="background:${c}"><span>${esc(l.nombre || "Lámina")}</span></div></div>`;
  };

  // Unidades de álbum: cada página con más de 12 láminas continúa en otra.
  const unidades = [];
  paginas.forEach((p, pi) => {
    const trozos = [];
    for (let i = 0; i < p.laminas.length; i += POR_HOJA) trozos.push(p.laminas.slice(i, i + POR_HOJA));
    if (!trozos.length) trozos.push([]);
    trozos.forEach((tr, ti) => unidades.push({ p, pi, ti, de: trozos.length, tr }));
  });
  const nro = unidades.map(() => 0); let k = 0;
  const hojaUnidad = (u, idx) => {
    const comp = modo === "estudiante" ? `${u.p.laminas.filter(tengo).length}/${u.p.laminas.length}` : `${u.p.laminas.length} láminas`;
    const titulo = u.p.titulo || `Página ${u.pi + 1}`;
    return `<div class="pg ${idx % 2 ? "der" : "izq"}"><div class="ban" style="background:linear-gradient(135deg,${color},${color}cc)"><small>PÁGINA ${u.pi + 1}${u.de > 1 ? ` · ${u.ti + 1}/${u.de}` : ""}</small><h2>${esc(titulo)}</h2><span class="cp">${comp}</span></div>
      <div class="grid">${u.tr.map((l) => slot(l, ++cont)).join("")}</div><div class="folio">${idx + 1}</div></div>`;
  };
  const paginasHtml = unidades.map((u, i) => hojaUnidad(u, i));
  const aperturas = [];
  for (let i = 0; i < paginasHtml.length; i += 2) aperturas.push(`<section class="hoja libro">${paginasHtml[i]}<div class="lomo"></div>${paginasHtml[i + 1] || '<div class="pg der vacia"></div>'}</section>`);

  const fecha = new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "long", year: "numeric" });
  const portada = `<section class="hoja cubierta" style="background:radial-gradient(circle at 50% 35%,${color}dd,${color} 55%,#0b1226 140%)">
    <div class="marco"><div class="sup">ÁLBUM DE COLECCIÓN</div>
    ${album?.portada_url ? `<img class="por" src="${esc(album.portada_url)}" alt="">` : `<div class="emoji">📒</div>`}
    <h1>${esc(album?.nombre || "Álbum")}</h1>
    ${album?.descripcion ? `<p class="de">${esc(album.descripcion)}</p>` : ""}
    <div class="pill">${paginas.length} páginas · ${n} láminas${modo === "estudiante" ? ` · ${t}/${n} conseguidas (${n ? Math.round((t / n) * 100) : 0}%)` : ""}</div>
    ${quien ? `<div class="quien">${esc(quien)}</div>` : ""}
    <div class="ft">${institucion ? esc(institucion) + " · " : ""}${fecha}</div></div></section>`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(album?.nombre || "Álbum")}</title><style>
@page{size:A4 landscape;margin:10mm}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#0f172a}
.hoja{width:277mm;height:190mm;page-break-after:always;break-after:page;overflow:hidden;position:relative;border-radius:10px}
.hoja:last-child{page-break-after:auto;break-after:auto}
.cubierta{color:#fff;padding:8mm}.marco{height:100%;border:3px solid #ffffffcc;border-radius:12px;outline:1px solid #ffffff66;outline-offset:-9px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:10mm}
.sup{letter-spacing:6px;font-size:13px;font-weight:700;opacity:.9}.emoji{font-size:80px;margin:8px}.por{max-height:62mm;max-width:120mm;border-radius:10px;border:3px solid #fff;margin:8px}
.cubierta h1{font-size:46px;margin:6px 0;text-shadow:0 3px 0 #0003}.de{font-size:15px;opacity:.9;margin:2px 0 8px}
.pill{background:#ffffff26;border:1px solid #ffffff88;border-radius:20px;padding:5px 16px;font-weight:700;font-size:14px;margin-top:6px}.quien{font-size:22px;font-weight:800;margin-top:12px}.ft{font-size:11px;opacity:.8;margin-top:10px}
.libro{display:flex;background:#fffaf0;border:1px solid #d6cdb8}
.pg{flex:1;display:flex;flex-direction:column;padding:6mm 7mm 7mm;position:relative;background:#fffaf0;background-image:radial-gradient(#e9dfc6 1px,transparent 1.2px);background-size:5mm 5mm;min-width:0}
.vacia{background:#fffaf0}
.lomo{width:7mm;background:linear-gradient(90deg,#00000012,#00000040 48%,#00000040 52%,#00000012);flex:none;box-shadow:inset 0 0 6px #0003}
.ban{border-radius:8px;color:#fff;padding:5px 12px;position:relative;text-align:center;margin-bottom:5mm;box-shadow:0 2px 0 #0002}
.ban small{display:block;font-size:8px;letter-spacing:3px;opacity:.85}.ban h2{margin:0;font-size:17px}.cp{position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:10px;font-weight:700;background:#0003;border-radius:10px;padding:2px 8px}
.grid{flex:1;min-height:0;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(4,1fr);gap:3.5mm 3.5mm}
.sl{display:flex;flex-direction:column;min-height:0;border-radius:7px;overflow:hidden}
.sl .im{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.sl img{max-width:94%;max-height:94%;object-fit:contain;position:relative}
.et{font-size:9px;font-weight:700;text-align:center;padding:2px 3px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ok{border:2px solid var(--c);background:#fff;box-shadow:0 1px 3px #0003,inset 0 0 0 2px #fff}
.ok .im{background:linear-gradient(160deg,color-mix(in srgb,var(--c) 22%,#fff),#fff 70%)}
.nn{position:absolute;left:3px;top:2px;font-style:normal;font-size:8px;font-weight:800;color:#0f172a99}
.falta{border:2px dashed #b8c0cc;background:#eceff3}
.falta .im{background:repeating-linear-gradient(135deg,#e5e9ef 0 6px,#eceff3 6px 12px)}
.gn{font-size:34px;color:#cbd2dc;font-weight:900;position:absolute}.q{font-size:20px;color:#94a3b8;font-weight:800;position:absolute;bottom:3px;right:8px}
.falta .et{background:#cbd2dc;color:#64748b}
.rep{position:absolute;top:3px;right:3px;background:#0f172a;color:#fff;font-size:8px;font-style:normal;border-radius:8px;padding:1px 5px;z-index:2}
.folio{position:absolute;bottom:2mm;font-size:9px;color:#8a7f66;font-weight:700}.izq .folio{left:7mm}.der .folio{right:7mm}
</style></head><body>${portada}${aperturas.join("")}</body></html>`;
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
