// Genera la hoja de nivelación como archivo PDF (descarga directa, sin ventana de impresión).
// Usa pdf-lib, que se carga solo al pulsar el botón. No envía datos a ningún servidor: todo ocurre en el navegador.
const limpiar = (t) => String(t ?? "").replace(/[✔✓]/g, "X").replace(/✘/g, "-").replace(/[—–]/g, "-").replace(/→/g, "->").replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

export async function generarPdfNivelacion(d) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 841.89, H = 595.28, M = 28;
  const negro = rgb(0.07, 0.07, 0.07), gris = rgb(0.35, 0.35, 0.35), azul = rgb(0.91, 0.93, 0.97), linea = rgb(0.2, 0.2, 0.2);

  const ajustar = (txt, font, size, ancho) => { // recorta con «…» para que quepa en la celda
    let t = limpiar(txt);
    if (font.widthOfTextAtSize(t, size) <= ancho) return t;
    while (t.length > 1 && font.widthOfTextAtSize(t + "...", size) > ancho) t = t.slice(0, -1);
    return t + "...";
  };
  const envolver = (txt, font, size, ancho) => { // parte en líneas por palabras
    const palabras = limpiar(txt).split(/\s+/).filter(Boolean), lineas = []; let cur = "";
    for (const p of palabras) {
      const prueba = cur ? cur + " " + p : p;
      if (font.widthOfTextAtSize(prueba, size) <= ancho || !cur) cur = prueba; else { lineas.push(cur); cur = p; }
    }
    if (cur) lineas.push(cur);
    return lineas;
  };

  const nS = d.sesiones.length + d.sesionesVacias, nA = d.acts.length;
  const wNum = 20, wNota = 30, wSes = 36, wAct = 52, wTot = 38, wFin = 42, wObs = 120;
  const fijo = wNum + wNota + nS * wSes + nA * wAct + wTot + wFin + wObs;
  const resto = Math.max(120, W - 2 * M - fijo);
  const wAp = resto * 0.5, wNom = resto * 0.5;
  const cols = [
    { t: "#", w: wNum, a: "c" }, { t: "Apellidos", w: wAp }, { t: "Nombres", w: wNom }, { t: "Nota", w: wNota, a: "c" },
    ...d.sesiones.map((s) => ({ t: s.fecha + (s.tema ? "\n" + s.tema : ""), w: wSes, a: "c", k: "ses" })),
    ...Array.from({ length: d.sesionesVacias }, () => ({ t: "", w: wSes, a: "c", k: "vacia" })),
    ...d.acts.map((a) => ({ t: `${a.nombre || "Actividad"}\n${a.peso}%`, w: wAct, a: "c", k: "act" })),
    { t: "Total %", w: wTot, a: "c" }, { t: "Nota nivelación", w: wFin, a: "c" }, { t: "Observación / firma", w: wObs },
  ];
  const totalW = cols.reduce((t, c) => t + c.w, 0);

  const paginas = [];
  const nuevaPagina = () => { const p = doc.addPage([W, H]); paginas.push(p); return p; };

  const encabezadoDoc = (p) => {
    p.drawText(limpiar(d.titulo), { x: M, y: H - M - 10, size: 14, font: fb, color: negro });
    p.drawText(limpiar(d.subtitulo), { x: M, y: H - M - 25, size: 9, font: f, color: gris });
    let y = H - M - 40;
    const acto = "Actividades: " + (d.actividadesTxt || "-") + (d.limite ? "   |   Fecha limite de entrega: " + d.limite : "");
    envolver(acto, f, 8.5, W - 2 * M).slice(0, 2).forEach((l) => { p.drawText(l, { x: M, y, size: 8.5, font: f, color: negro }); y -= 11; });
    if (d.instrucciones) envolver(d.instrucciones, f, 8, W - 2 * M).slice(0, 2).forEach((l) => { p.drawText(l, { x: M, y, size: 8, font: f, color: gris }); y -= 10; });
    return y - 6;
  };
  const cabeceraTabla = (p, y) => {
    const lineasPorCol = cols.map((c) => (c.t || "").split("\n").flatMap((s, i) => envolver(s, i ? f : fb, 6.8, c.w - 4)));
    const alto = Math.max(22, Math.max(...lineasPorCol.map((l) => l.length)) * 8 + 6);
    let x = M;
    cols.forEach((c, i) => {
      p.drawRectangle({ x, y: y - alto, width: c.w, height: alto, color: azul, borderColor: linea, borderWidth: 0.6 });
      lineasPorCol[i].forEach((l, j) => {
        const font = j === 0 ? fb : f, tw = font.widthOfTextAtSize(l, 6.8);
        p.drawText(l, { x: c.a === "c" ? x + (c.w - tw) / 2 : x + 3, y: y - 9 - j * 8, size: 6.8, font, color: negro });
      });
      x += c.w;
    });
    return y - alto;
  };

  let p = nuevaPagina(); let y = cabeceraTabla(p, encabezadoDoc(p));
  const alto = 17;
  d.filas.forEach((fi) => {
    if (y - alto < M + 40) { p = nuevaPagina(); y = cabeceraTabla(p, H - M); }
    const celdas = [
      String(fi.n), fi.ap, fi.nom, fi.nota ?? "",
      ...fi.asis.map((a) => (a === undefined ? "" : a ? "X" : "-")),
      ...Array.from({ length: d.sesionesVacias }, () => ""),
      ...fi.res.map((r) => r ?? ""), fi.total === null || fi.total === undefined ? "" : fi.total + "%", fi.final ?? "", fi.obs || "",
    ];
    let x = M;
    cols.forEach((c, i) => {
      p.drawRectangle({ x, y: y - alto, width: c.w, height: alto, borderColor: linea, borderWidth: 0.5 });
      const txt = ajustar(celdas[i], i === 4 + 0 && false ? fb : f, 8, c.w - 5);
      const tw = f.widthOfTextAtSize(txt, 8);
      p.drawText(txt, { x: c.a === "c" ? x + (c.w - tw) / 2 : x + 3, y: y - 12, size: 8, font: f, color: negro });
      x += c.w;
    });
    y -= alto;
  });

  // Firmas en la última página
  if (y - 50 < M + 20) { p = nuevaPagina(); y = H - M; }
  y -= 34;
  p.drawLine({ start: { x: M, y }, end: { x: M + 200, y }, thickness: 0.6, color: linea });
  p.drawText("Docente: " + limpiar(d.docente || ""), { x: M, y: y - 11, size: 8.5, font: f, color: negro });
  p.drawLine({ start: { x: W - M - 200, y }, end: { x: W - M, y }, thickness: 0.6, color: linea });
  p.drawText("Coordinacion / Vo. Bo.", { x: W - M - 200, y: y - 11, size: 8.5, font: f, color: negro });

  paginas.forEach((pg, i) => {
    pg.drawText(`Pagina ${i + 1} de ${paginas.length}  -  Generado ${d.generado}`, { x: M, y: M - 12, size: 7.5, font: f, color: gris });
  });
  return doc.save();
}
