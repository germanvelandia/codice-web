// =====================================================================================
//  GUÍAS DE ESTUDIO · documento (pantalla + impresión) e importador de texto
//  Lógica pura: sin pantalla ni base de datos.
// =====================================================================================

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Texto de la docente: si ya trae etiquetas HTML se respeta; si es texto plano se escapa y se conservan los saltos de línea.
export const htmlSeguro = (t) => { const s = String(t ?? ""); if (!s.trim()) return ""; return /<[a-z][\s\S]*>/i.test(s) ? s : esc(s).replace(/\n/g, "<br>"); };
const vacioHtml = (h) => !String(h ?? "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

// ---------- Áreas: emoji y color ----------
export const AREAS = [
  { clave: "matem", nombre: "Matemáticas", emoji: "🧮", color: "#2563EB" },
  { clave: "espa", nombre: "Español", emoji: "📖", color: "#DC2626" },
  { clave: "lengua", nombre: "Lengua Castellana", emoji: "📖", color: "#DC2626" },
  { clave: "natural", nombre: "Ciencias Naturales", emoji: "🌿", color: "#16A34A" },
  { clave: "biolog", nombre: "Biología", emoji: "🌿", color: "#16A34A" },
  { clave: "quimic", nombre: "Química", emoji: "⚗️", color: "#0891B2" },
  { clave: "fisica", nombre: "Física", emoji: "⚛️", color: "#4F46E5" },
  { clave: "social", nombre: "Ciencias Sociales", emoji: "🌎", color: "#D97706" },
  { clave: "histor", nombre: "Historia", emoji: "🏛️", color: "#B45309" },
  { clave: "geograf", nombre: "Geografía", emoji: "🗺️", color: "#CA8A04" },
  { clave: "ingl", nombre: "Inglés", emoji: "🔤", color: "#7C3AED" },
  { clave: "fisic", nombre: "Educación Física", emoji: "🏃", color: "#EA580C" },
  { clave: "etic", nombre: "Ética y Valores", emoji: "🤝", color: "#DB2777" },
  { clave: "religi", nombre: "Educación Religiosa", emoji: "🕊️", color: "#0D9488" },
  { clave: "artis", nombre: "Educación Artística", emoji: "🎨", color: "#C026D3" },
  { clave: "tecnolog", nombre: "Tecnología e Informática", emoji: "💻", color: "#0284C7" },
  { clave: "filosof", nombre: "Filosofía", emoji: "🧠", color: "#6D28D9" },
  { clave: "econom", nombre: "Economía y Política", emoji: "📊", color: "#047857" },
  { clave: "general", nombre: "General", emoji: "📌", color: "#475569" },
];
const sinTildes = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export function temaArea(nombre) {
  const n = sinTildes(nombre);
  if (!n.trim()) return AREAS.find((a) => a.clave === "general");
  // "Educación Física" debe ganar a "Física"; "Ciencias Naturales — Biología" a Biología
  const orden = ["fisic", "matem", "lengua", "espa", "natural", "biolog", "quimic", "social", "histor", "geograf", "ingl", "etic", "religi", "artis", "tecnolog", "filosof", "econom"];
  if (/educacion fisica|ed\. fisica/.test(n)) return AREAS.find((a) => a.clave === "fisic");
  if (/\bfisica\b/.test(n) && !/educacion/.test(n)) return AREAS.find((a) => a.clave === "fisica");
  for (const k of orden) if (k !== "fisic" && n.includes(k)) return AREAS.find((a) => a.clave === k);
  return { clave: "otra", nombre, emoji: "📘", color: "#6B7280" };
}

// ---------- LaTeX sencillo → texto legible ----------
export function latexATexto(s) {
  let t = String(s ?? "");
  const par = (x) => (/^[\w.,]+$/.test(x.trim()) ? x.trim() : `(${x.trim()})`);
  for (let i = 0; i < 3; i++) t = t.replace(/\\(?:d)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_, a, b) => `${par(a)}/${par(b)}`).replace(/\\text\s*\{([^{}]*)\}/g, "$1").replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)");
  const mapa = { "\\times": "×", "\\cdot": "·", "\\div": "÷", "\\leq": "≤", "\\le": "≤", "\\geq": "≥", "\\ge": "≥", "\\neq": "≠", "\\approx": "≈", "\\pi": "π", "\\%": "%", "\\,": " ", "\;": " ", "\\!": "", "\\left": "", "\\right": "", "\\quad": "  " };
  Object.keys(mapa).sort((a, b) => b.length - a.length).forEach((k) => { t = t.split(k).join(mapa[k]); });
  t = t.replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, "").replace(/\^2/g, "²").replace(/\^3/g, "³");
  return t.replace(/\s{2,}/g, " ").trim();
}
const conFormulasEnLinea = (linea) => linea.replace(/\\\(([\s\S]*?)\\\)/g, (_, f) => `\u0001${latexATexto(f)}\u0002`);
const aHtmlLinea = (linea) => esc(conFormulasEnLinea(linea)).replace(/\u0001/g, '<span class="f">').replace(/\u0002/g, "</span>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");

// ---------- Texto plano → HTML (párrafos, listas, tablas con tabuladores, fórmulas) ----------
const ETIQUETAS_NEGRITA = /^(Ejemplo|Traducci[oó]n|Nota|Recuerda|Importante|Formato de entrega|Evidencia[s]? que debes entregar|Donde)\s*:/i;
const esTituloCorto = (l) => { const t = l.trim(); return t.length > 1 && t.length <= 62 && /^[A-ZÁÉÍÓÚÑ¿«0-9]/.test(t) && !/[.:;,)?!»"”\]]$/.test(t) && !/\t/.test(t) && !/^\s*[-*•]\s/.test(l) && !/^\s*(\d+|[a-h])[.)]\s/.test(l); };
export function textoAHtml(texto, { subtitulos = true } = {}) {
  const lineas = String(texto ?? "").replace(/\r/g, "").split("\n");
  const out = []; let i = 0;
  const cierraLista = () => {};
  while (i < lineas.length) {
    const l = lineas[i];
    if (!l.trim()) { i++; continue; }
    // fórmula en bloque \[ ... \]
    if (/^\s*\\\[/.test(l)) {
      let cuerpo = l.replace(/^\s*\\\[/, ""); 
      while (!/\\\]/.test(cuerpo) && i + 1 < lineas.length) { i++; cuerpo += "\n" + lineas[i]; }
      const f = cuerpo.replace(/\\\][\s\S]*$/, "");
      out.push(`<div class="formula">${esc(latexATexto(f))}</div>`); i++; continue;
    }
    // tabla (líneas con tabuladores)
    if (l.includes("\t")) {
      const filas = []; while (i < lineas.length && lineas[i].includes("\t")) { filas.push(lineas[i].split("\t").map((c) => c.trim())); i++; }
      const n = Math.max(...filas.map((f) => f.length));
      const celdas = (f, tag) => f.concat(Array(n - f.length).fill("")).map((c) => `<${tag}>${aHtmlLinea(c)}</${tag}>`).join("");
      out.push(`<table><thead><tr>${celdas(filas[0], "th")}</tr></thead><tbody>${filas.slice(1).map((f) => `<tr>${celdas(f, "td")}</tr>`).join("")}</tbody></table>`); continue;
    }
    // listas
    let m;
    if ((m = l.match(/^\s*[-*•]\s+(.*)$/))) {
      const items = []; while (i < lineas.length && (m = lineas[i].match(/^\s*[-*•]\s+(.*)$/))) { items.push(m[1]); i++; }
      out.push(`<ul>${items.map((x) => `<li>${aHtmlLinea(x)}</li>`).join("")}</ul>`); continue;
    }
    if ((m = l.match(/^\s*(\d+)[.)]\s+(.*)$/))) {
      const ini = parseInt(m[1], 10); const items = []; while (i < lineas.length && (m = lineas[i].match(/^\s*\d+[.)]\s+(.*)$/))) { items.push(m[1]); i++; }
      out.push(`<ol${ini > 1 ? ` start="${ini}"` : ""}>${items.map((x) => `<li>${aHtmlLinea(x)}</li>`).join("")}</ol>`); continue;
    }
    if ((m = l.match(/^\s*([a-h])[.)]\s+(.*)$/))) {
      const ini = m[1].charCodeAt(0) - 96; const items = []; while (i < lineas.length && (m = lineas[i].match(/^\s*[a-h][.)]\s+(.*)$/))) { items.push(m[1]); i++; }
      out.push(`<ol type="a"${ini > 1 ? ` start="${ini}"` : ""}>${items.map((x) => `<li>${aHtmlLinea(x)}</li>`).join("")}</ol>`); continue;
    }
    // subtítulo corto
    if (subtitulos && esTituloCorto(l) && i + 1 < lineas.length && lineas[i + 1].trim()) { out.push(`<h4>${aHtmlLinea(l.trim())}</h4>`); i++; continue; }
    // párrafo (una línea = un párrafo; el texto pegado de IA trae un párrafo por línea)
    const t = l.trim();
    const mm = t.match(ETIQUETAS_NEGRITA);
    out.push(`<p>${mm ? `<b>${esc(mm[0])}</b>${aHtmlLinea(t.slice(mm[0].length))}` : aHtmlLinea(t)}</p>`);
    i++;
  }
  return out.join("");
}

// =====================================================================================
//  IMPORTADOR: texto de la IA (formato "GUÍA DE ESTUDIO PEDAGÓGICA…") → campos de la guía
// =====================================================================================
const limpia = (s) => String(s ?? "").replace(/\*\*/g, "").replace(/^[\s#>]+/, "").trim();
const RE_SECCIONES = [
  ["datos", /^\s*#{0,3}\s*\*{0,2}\s*1\s*[.)]\s*DATOS\s+DE\s+IDENTIFICACI[OÓ]N/i],
  ["metas", /^\s*#{0,3}\s*\*{0,2}\s*2\s*[.)]\s*METAS\s+DE\s+APRENDIZAJE/i],
  ["teoria", /^\s*#{0,3}\s*\*{0,2}\s*3\s*[.)]\s*FUNDAMENTACI[OÓ]N/i],
  ["secuencia", /^\s*#{0,3}\s*\*{0,2}\s*4\s*[.)]\s*SECUENCIA\s+DE\s+ACTIVIDADES/i],
  ["recursos", /^\s*#{0,3}\s*\*{0,2}\s*5\s*[.)]\s*RECURSOS\s+DE\s+APOYO/i],
  ["rubrica", /^\s*#{0,3}\s*\*{0,2}\s*6\s*[.)]\s*R[UÚ]BRICA\s+DE\s+AUTOEVALUACI[OÓ]N/i],
];
const partirEn = (lineas, regex) => { // [{titulo, lineas}] según líneas que cumplen regex(línea) → match
  const bloques = []; let actual = { titulo: null, lineas: [], m: null };
  lineas.forEach((l) => { const m = regex(l); if (m) { bloques.push(actual); actual = { titulo: l, lineas: [], m }; } else actual.lineas.push(l); });
  bloques.push(actual); return bloques;
};
const trimLineas = (ls) => { let a = 0, b = ls.length; while (a < b && !ls[a].trim()) a++; while (b > a && !ls[b - 1].trim()) b--; return ls.slice(a, b); };
const aTexto = (ls) => trimLineas(ls).join("\n");
const tablaDe = (ls) => trimLineas(ls).filter((l) => l.includes("\t")).map((l) => l.split("\t").map((c) => c.trim()));
const sinTabla = (ls) => ls.filter((l) => !l.includes("\t"));

// Tablas de markdown (| a | b |) → líneas con tabuladores; se descartan las filas separadoras (|---|---|)
export function normalizarTablas(texto) {
  return String(texto ?? "").replace(/\r/g, "").split("\n").map((l) => {
    if (/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l) && l.includes("|")) return null;
    if (/^\s*\|.*\|\s*$/.test(l)) return l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()).join("\t");
    return l;
  }).filter((l) => l !== null).join("\n");
}

export function analizarGuiaTexto(texto) {
  const todas = normalizarTablas(texto).split("\n");
  const partes = partirEn(todas, (l) => { for (const [k, re] of RE_SECCIONES) if (re.test(l)) return k; return null; });
  const sec = {}; partes.forEach((p) => { if (p.m) sec[p.m] = p.lineas; });
  if (Object.keys(sec).length < 2) return null; // no tiene el formato esperado
  const r = {};

  // Encabezado: título, subtítulo y presentación
  const cab = trimLineas(partes[0].lineas).filter((l) => l.trim());
  if (cab.length) {
    const esRotulo = /^GU[ÍI]A\s+DE\s+ESTUDIO/i.test(limpia(cab[0]));
    r.titulo = limpia(esRotulo && cab[1] ? cab[1] : cab[0]);
    r.rotulo = esRotulo ? limpia(cab[0]) : null;
    const resto = cab.slice(esRotulo ? 2 : 1).map(limpia).join("\n");
    if (resto) r.presentacion = resto;
  }

  // 1. Datos + orientaciones
  if (sec.datos) {
    const bl = partirEn(sec.datos, (l) => /^\s*Orientaciones\b/i.test(l) ? "o" : null);
    const filas = tablaDe(bl[0].lineas).slice(1).filter((f) => f[0]);
    r.datos = filas.map((f) => ({ campo: limpia(f[0]), valor: limpia(f.slice(1).join(" ")) }));
    const orient = bl.find((b) => b.m);
    if (orient) r.orientaciones = textoAHtml(aTexto(orient.lineas), { subtitulos: false });
    const fecha = r.datos.find((d) => /^fecha$/i.test(d.campo)); if (fecha) r.fecha_texto = fecha.valor;
  }

  // 2. Metas
  if (sec.metas) {
    const bl = partirEn(sec.metas, (l) => { const m = l.match(/^\s*#{0,3}\s*\*{0,2}\s*([ABC])\s*[.)]\s+(.+)$/); return m ? m[1] : null; });
    const g = (k) => bl.find((b) => b.m === k);
    if (g("A")) r.proposito_general = limpia(aTexto(g("A").lineas));
    if (g("B")) r.objetivo = textoAHtml(aTexto(g("B").lineas), { subtitulos: false });
    if (g("C")) r.criterios_evaluacion = textoAHtml(aTexto(g("C").lineas), { subtitulos: false });
  }

  // 3. Fundamentación: subsecciones "3.n. Área: título" (la última suele ser "Conceptos clave")
  if (sec.teoria) {
    const bl = partirEn(sec.teoria, (l) => { const m = l.match(/^\s*#{0,3}\s*\*{0,2}\s*3\s*\.\s*(\d+)\s*[.)]?\s+(.+?)\*{0,2}\s*$/); return m ? m[2] : null; });
    const intro = aTexto(bl[0].lineas); if (intro) r.contenido = textoAHtml(intro);
    r.teoria = []; r.conceptos_clave = [];
    bl.filter((b) => b.m).forEach((b) => {
      const nombre = limpia(b.m);
      if (/^conceptos?\s+clave/i.test(nombre)) {
        r.conceptos_clave = tablaDe(b.lineas).slice(1).filter((f) => f[0]).map((f) => ({ termino: limpia(f[0]), definicion: limpia(f[1] || ""), relacion: limpia(f[2] || "") }));
        return;
      }
      const i = nombre.indexOf(":");
      const area = i > 0 ? nombre.slice(0, i).trim() : "", titulo = i > 0 ? nombre.slice(i + 1).trim() : nombre;
      r.teoria.push({ area, titulo, contenido: textoAHtml(aTexto(b.lineas)) });
    });
  }

  // 4. Secuencia: A exploración · B aplicación (Actividad N.) · C transferencia
  if (sec.secuencia) {
    const bl = partirEn(sec.secuencia, (l) => { const m = l.match(/^\s*#{0,3}\s*\*{0,2}\s*([ABC])\s*[.)]\s+(.+?)\*{0,2}\s*$/); return m && /^fase/i.test(limpia(m[2])) ? m[1] : null; });
    const g = (k) => bl.find((b) => b.m === k);
    if (g("A")) r.fase_exploracion = textoAHtml(aTexto(g("A").lineas));
    if (g("C")) r.fase_transferencia = textoAHtml(aTexto(g("C").lineas));
    r.actividades_guia = [];
    if (g("B")) {
      const ab = partirEn(g("B").lineas, (l) => { const m = l.match(/^\s*#{0,3}\s*\*{0,2}\s*Actividad\s+(\d+)\s*[.:]\s*(.+?)\*{0,2}\s*$/i); return m ? m[2] : null; });
      const introB = aTexto(ab[0].lineas); if (introB) r.fase_aplicacion = textoAHtml(introB);
      ab.filter((b) => b.m).forEach((b) => {
        const nombre = limpia(b.m), i = nombre.indexOf(":");
        const act = { fase: "aplicacion", area: i > 0 ? nombre.slice(0, i).trim() : "", titulo: i > 0 ? nombre.slice(i + 1).trim() : nombre, intro_titulo: "", situacion: "", puntos: [], evidencia: "" };
        const pb = partirEn(b.lineas, (l) => { const m = l.match(/^\s*#{0,3}\s*\*{0,2}\s*Punto\s+(\d+)\s*[.:]\s*(.*?)\*{0,2}\s*$/i); return m ? (m[2] || " ") : null; });
        const pre = trimLineas(pb[0].lineas);
        if (pre.length && esTituloCorto(pre[0])) { act.intro_titulo = limpia(pre[0]); act.situacion = textoAHtml(aTexto(pre.slice(1))); }
        else if (pre.length && /^(Caso|Situaci[oó]n|Texto|Lectura)\b[^\n]{0,70}$/i.test(limpia(pre[0])) && !/[.]$/.test(pre[0].trim())) { act.intro_titulo = limpia(pre[0]); act.situacion = textoAHtml(aTexto(pre.slice(1))); }
        else act.situacion = textoAHtml(aTexto(pre));
        pb.filter((x) => x.m).forEach((x, idx) => {
          // la evidencia va al final del último punto
          let cuerpo = x.lineas; const ie = cuerpo.findIndex((l) => /^\s*Evidencias?\s+que\s+debes\s+entregar\s*:/i.test(l));
          if (ie >= 0) { act.evidencia = limpia(cuerpo.slice(ie).join(" ").replace(/^\s*Evidencias?\s+que\s+debes\s+entregar\s*:\s*/i, "")); cuerpo = cuerpo.slice(0, ie); }
          act.puntos.push({ titulo: limpia(x.m).trim(), contenido: textoAHtml(aTexto(cuerpo)) });
        });
        if (!act.puntos.length) { // sin "Punto N.": la evidencia puede estar en la situación
          const ie = b.lineas.findIndex((l) => /^\s*Evidencias?\s+que\s+debes\s+entregar\s*:/i.test(l));
          if (ie >= 0) act.evidencia = limpia(b.lineas.slice(ie).join(" ").replace(/^\s*Evidencias?\s+que\s+debes\s+entregar\s*:\s*/i, ""));
        }
        r.actividades_guia.push(act);
      });
    }
  }

  // 5. Recursos: A lecturas · B multimedia · C herramientas
  if (sec.recursos) {
    const bl = partirEn(sec.recursos, (l) => { const m = l.match(/^\s*#{0,3}\s*\*{0,2}\s*([ABC])\s*[.)]\s+(.+?)\*{0,2}\s*$/); return m ? m[1] : null; });
    const g = (k) => bl.find((b) => b.m === k);
    if (g("A")) r.lectura_principal = textoAHtml(aTexto(g("A").lineas), { subtitulos: false });
    if (g("B")) r.material_multimedia = textoAHtml(aTexto(g("B").lineas), { subtitulos: false });
    if (g("C")) r.herramientas_sugeridas = textoAHtml(aTexto(g("C").lineas), { subtitulos: false });
  }

  // 6. Rúbrica de autoevaluación + preguntas de reflexión
  if (sec.rubrica) {
    const bl = partirEn(sec.rubrica, (l) => { const m = l.match(/^\s*#{0,3}\s*\*{0,2}\s*([AB])\s*[.)]\s+(.+?)\*{0,2}\s*$/); return m ? m[1] : null; });
    const g = (k) => bl.find((b) => b.m === k);
    if (g("A")) r.rubrica_criterios = tablaDe(g("A").lineas).slice(1).filter((f) => f[0]).map((f) => ({ criterio: limpia(f[0]) }));
    if (g("B")) {
      const ls = trimLineas(g("B").lineas);
      r.preguntas_reflexion = ls.map((l) => l.match(/^\s*\d+[.)]\s+(.*)$/)).filter(Boolean).map((m) => ({ texto: limpia(m[1]) }));
      const intro = ls.find((l) => l.trim() && !/^\s*\d+[.)]/.test(l)); if (intro) r.reflexion_intro = limpia(intro);
    }
  }
  return r;
}

// =====================================================================================
//  DOCUMENTO (impresión y pantalla)
// =====================================================================================
const SECCIONES = {
  datos: { n: 1, emoji: "📋", titulo: "Datos de identificación", color: "#475569" },
  metas: { n: 2, emoji: "🎯", titulo: "Metas de aprendizaje y competencias", color: "#7C3AED" },
  teoria: { n: 3, emoji: "📚", titulo: "Fundamentación teórica y conceptos clave", color: "#2563EB" },
  secuencia: { n: 4, emoji: "🧩", titulo: "Secuencia de actividades y práctica guiada", color: "#EA580C" },
  recursos: { n: 5, emoji: "📎", titulo: "Recursos de apoyo y material complementario", color: "#0D9488" },
  rubrica: { n: 6, emoji: "✅", titulo: "Rúbrica de autoevaluación y metacognición", color: "#16A34A" },
};

export const CSS_GUIA = `
.guia-doc{font-family:"Segoe UI",Arial,Helvetica,sans-serif;color:#1f2937;font-size:13px;line-height:1.55}
.guia-doc *{box-sizing:border-box}
.guia-doc .portada{border-radius:14px;padding:18px 22px;color:#fff;background:linear-gradient(135deg,#6d28d9,#2563eb);margin-bottom:14px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.guia-doc .inst{display:flex;align-items:center;gap:12px;margin-bottom:10px}.guia-doc .inst img{height:46px;background:#fff;border-radius:8px;padding:3px}
.guia-doc .inst b{font-size:14px;display:block}.guia-doc .inst span{font-size:10.5px;letter-spacing:.12em;opacity:.9}
.guia-doc .portada h1{font-size:23px;line-height:1.2;margin:4px 0 6px;font-weight:800}
.guia-doc .meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.guia-doc .meta span{background:rgba(255,255,255,.22);border-radius:999px;padding:2px 10px;font-size:11.5px}
.guia-doc .pres{font-size:12.5px;margin:6px 0 0;opacity:.96}
.guia-doc .indice{border:1px solid #e5e7eb;border-radius:12px;padding:10px 14px;margin:0 0 14px;background:#fafafa}
.guia-doc .indice b{font-size:12px;color:#475569}.guia-doc .indice ol{margin:4px 0 0;padding-left:0;list-style:none;display:flex;flex-wrap:wrap;gap:4px 16px;font-size:12px}
.guia-doc .indice a{color:inherit;text-decoration:none}
.guia-doc .sec{margin:20px 0 8px;break-after:avoid;page-break-after:avoid}
.guia-doc .sec-h{display:flex;align-items:center;gap:10px;color:#fff;border-radius:10px;padding:7px 14px;font-size:15px;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.guia-doc .sec-h .n{background:rgba(255,255,255,.28);border-radius:999px;min-width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;font-size:13px}
.guia-doc h3.sub{font-size:13.5px;margin:12px 0 5px;color:#111827;break-after:avoid;page-break-after:avoid}
.guia-doc h4{font-size:12.5px;margin:10px 0 3px;color:#374151;break-after:avoid;page-break-after:avoid}
.guia-doc p{margin:4px 0}.guia-doc ul,.guia-doc ol{margin:4px 0 6px;padding-left:22px}.guia-doc li{margin:2px 0}
.guia-doc table{border-collapse:collapse;width:100%;margin:8px 0;font-size:12px}
.guia-doc th,.guia-doc td{border:1px solid #cbd5e1;padding:5px 8px;vertical-align:top;text-align:left}
.guia-doc th{background:#f1f5f9;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.guia-doc tr{break-inside:avoid;page-break-inside:avoid}
.guia-doc td:empty::after{content:"\\00a0";display:block;min-height:22px}
.guia-doc .tabla-wrap{overflow-x:auto}
.guia-doc .formula{text-align:center;font-family:"Cambria Math","Times New Roman",serif;font-size:15px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;padding:6px 10px;margin:6px 0}
.guia-doc .f{font-family:"Cambria Math","Times New Roman",serif;font-style:italic}
.guia-doc .caja{border-radius:10px;padding:9px 13px;margin:8px 0;border-left:5px solid;break-inside:avoid;page-break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.guia-doc .caja>b.t{display:block;margin-bottom:2px}
.guia-doc .c-amar{background:#fffbeb;border-color:#f59e0b}.guia-doc .c-viol{background:#f5f3ff;border-color:#7c3aed}.guia-doc .c-verde{background:#f0fdf4;border-color:#16a34a}.guia-doc .c-azul{background:#eff6ff;border-color:#2563eb}
.guia-doc .tarjeta{border:1.5px solid;border-radius:12px;margin:10px 0;overflow:hidden}
.guia-doc .tarjeta>.th{display:flex;align-items:center;gap:8px;padding:6px 12px;color:#fff;font-weight:700;font-size:13px;-webkit-print-color-adjust:exact;print-color-adjust:exact;break-after:avoid;page-break-after:avoid}
.guia-doc .tarjeta>.th small{font-weight:500;opacity:.92;font-size:11.5px;margin-left:auto}
.guia-doc .tarjeta>.tb{padding:6px 12px 10px}
.guia-doc .act{margin:14px 0;border:2px solid;border-radius:14px;overflow:hidden}
.guia-doc .act-h{color:#fff;padding:9px 14px;display:flex;align-items:center;gap:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact;break-after:avoid;page-break-after:avoid}
.guia-doc .act-h .em{font-size:22px}.guia-doc .act-h .t{font-size:15px;font-weight:800;line-height:1.2}.guia-doc .act-h .a{font-size:11.5px;opacity:.93}
.guia-doc .act-b{padding:4px 14px 12px}
.guia-doc .punto{margin:10px 0 4px;border-top:1px solid #e5e7eb;padding-top:6px}
.guia-doc .punto-h{display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px;break-after:avoid;page-break-after:avoid}
.guia-doc .punto-h .pn{color:#fff;border-radius:6px;padding:1px 8px;font-size:11.5px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.guia-doc .lineas div{border-bottom:1px dotted #94a3b8;height:24px}
.guia-doc .lineas{margin:6px 0 2px}
.guia-doc .pie{margin-top:22px;border-top:1px solid #e5e7eb;padding-top:6px;font-size:10.5px;color:#94a3b8;display:flex;justify-content:space-between}
.guia-doc .fase{display:inline-block;color:#fff;border-radius:999px;padding:2px 12px;font-size:12px;font-weight:700;margin:12px 0 2px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.guia-doc .caja p:first-child{margin-top:0}.guia-doc .caja p:last-child{margin-bottom:0}
`;

const fechaCorta = (f) => { if (!f) return ""; const m = String(f).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(f); };
const seccionH = (clave, anclaId) => { const s = SECCIONES[clave]; return `<div class="sec" id="${anclaId}"><div class="sec-h" style="background:${s.color}"><span class="n">${s.n}</span><span>${s.emoji} ${esc(s.titulo)}</span></div></div>`; };
const caja = (tipo, titulo, html) => (vacioHtml(html) ? "" : `<div class="caja c-${tipo}"><b class="t">${titulo}</b>${html}</div>`);
const lineasRespuesta = (n) => `<div class="lineas">${"<div></div>".repeat(n)}</div>`;
const envolverTablas = (h) => String(h ?? "").replace(/<table/g, '<div class="tabla-wrap"><table').replace(/<\/table>/g, "</table></div>");

/**
 * Cuerpo del documento (sin <html>), con la clase .guia-doc.
 * opciones: { institucion, materia, lineas: 0..6 (renglones para responder tras cada punto), indice: true }
 */
export function htmlGuiaCuerpo(guia, { institucion = null, materia = "", lineas = 0, indice = true } = {}) {
  const g = guia || {};
  const datos = Array.isArray(g.datos) ? g.datos.filter((d) => d.campo || d.valor) : [];
  const teoria = Array.isArray(g.teoria) ? g.teoria : [];
  const actividades = Array.isArray(g.actividades_guia) ? g.actividades_guia : [];
  const concept = Array.isArray(g.conceptos_clave) ? g.conceptos_clave.filter((c) => c.termino) : [];
  const rub = Array.isArray(g.rubrica_criterios) ? g.rubrica_criterios.filter((c) => c.criterio) : [];
  const preg = Array.isArray(g.preguntas_reflexion) ? g.preguntas_reflexion.filter((p) => p.texto) : [];
  const tieneMetas = g.proposito_general || !vacioHtml(g.objetivo) || !vacioHtml(g.criterios_evaluacion);
  const tieneTeoria = !vacioHtml(g.contenido) || teoria.length || concept.length;
  const exp = !vacioHtml(g.fase_exploracion), apl = !vacioHtml(g.fase_aplicacion), tra = !vacioHtml(g.fase_transferencia);
  const tieneSecuencia = exp || apl || tra || actividades.length;
  const tieneRecursos = !vacioHtml(g.lectura_principal) || !vacioHtml(g.material_multimedia) || !vacioHtml(g.herramientas_sugeridas);
  const tieneRubrica = rub.length || preg.length;
  const tiene = { datos: datos.length || !vacioHtml(g.orientaciones), metas: tieneMetas, teoria: tieneTeoria, secuencia: tieneSecuencia, recursos: tieneRecursos, rubrica: tieneRubrica };
  const nombreInst = institucion?.nombre || "INSTITUCIÓN EDUCATIVA";
  const logo = institucion?.logo_url && /^(https?:|data:image)/i.test(institucion.logo_url) ? `<img src="${esc(institucion.logo_url)}" alt="">` : "";
  const meta = [materia ? `📘 ${esc(materia)}` : "", g.tiempo_estimado ? `⏱ ${esc(g.tiempo_estimado)}` : "", g.fecha_entrega ? `📅 Entrega: ${esc(fechaCorta(g.fecha_entrega))}` : "", g.periodo ? `🗓 Periodo ${esc(g.periodo)}` : ""].filter(Boolean).map((x) => `<span>${x}</span>`).join("");
  const p = [];

  p.push(`<div class="portada"><div class="inst">${logo}<div><b>${esc(nombreInst)}</b><span>${esc((g.rotulo || "GUÍA DE ESTUDIO").toUpperCase())}</span></div></div>
    <h1>${esc(g.titulo || "Guía de estudio")}</h1>${meta ? `<div class="meta">${meta}</div>` : ""}${g.presentacion ? `<p class="pres">${esc(g.presentacion).replace(/\n/g, "<br>")}</p>` : ""}</div>`);

  if (indice) {
    const items = Object.keys(SECCIONES).filter((k) => tiene[k]).map((k) => `<li><a href="#gd-${k}">${SECCIONES[k].emoji} ${SECCIONES[k].n}. ${esc(SECCIONES[k].titulo)}</a></li>`).join("");
    if (items) p.push(`<div class="indice"><b>📑 En esta guía</b><ol>${items}</ol></div>`);
  }

  if (tiene.datos) {
    p.push(seccionH("datos", "gd-datos"));
    if (datos.length) p.push(`<table><tbody>${datos.map((d) => `<tr><th style="width:28%">${esc(d.campo)}</th><td>${esc(d.valor)}</td></tr>`).join("")}</tbody></table>`);
    p.push(caja("amar", "📝 Orientaciones para el estudiante", htmlSeguro(g.orientaciones)));
  }

  if (tiene.metas) {
    p.push(seccionH("metas", "gd-metas"));
    if (g.proposito_general) p.push(caja("viol", "🧭 Propósito general", `<p>${esc(g.proposito_general)}</p>`));
    if (!vacioHtml(g.objetivo)) p.push(`<h3 class="sub">🎓 Desempeños o aprendizajes esperados</h3>${envolverTablas(htmlSeguro(g.objetivo))}`);
    if (!vacioHtml(g.criterios_evaluacion)) p.push(`<h3 class="sub">📏 Criterios de evaluación</h3>${envolverTablas(htmlSeguro(g.criterios_evaluacion))}`);
  }

  if (tiene.teoria) {
    p.push(seccionH("teoria", "gd-teoria"));
    if (!vacioHtml(g.contenido)) p.push(envolverTablas(htmlSeguro(g.contenido)));
    teoria.forEach((t, i) => {
      const a = temaArea(t.area || t.titulo);
      p.push(`<div class="tarjeta" style="border-color:${a.color}"><div class="th" style="background:${a.color}"><span>${a.emoji}</span><span>3.${i + 1}. ${t.area && t.titulo ? `${esc(t.area)}: ${esc(t.titulo)}` : esc(t.titulo || t.area || "")}</span></div><div class="tb">${envolverTablas(htmlSeguro(t.contenido))}</div></div>`);
    });
    if (concept.length) {
      const conRel = concept.some((c) => c.relacion);
      p.push(`<h3 class="sub">🔑 Conceptos clave</h3><div class="tabla-wrap"><table><thead><tr><th style="width:22%">Concepto</th><th>Definición sintética</th>${conRel ? "<th style=\"width:30%\">Relación con el tema</th>" : ""}</tr></thead><tbody>${concept.map((c) => `<tr><td><b>${esc(c.termino)}</b></td><td>${esc(c.definicion || "")}</td>${conRel ? `<td>${esc(c.relacion || "")}</td>` : ""}</tr>`).join("")}</tbody></table></div>`);
    }
  }

  if (tiene.secuencia) {
    p.push(seccionH("secuencia", "gd-secuencia"));
    const FASES = { exploracion: ["🔍 Fase de exploración y comprensión", "#0EA5E9"], aplicacion: ["✏️ Fase de aplicación y análisis", "#EA580C"], transferencia: ["🚀 Fase de transferencia y creación", "#16A34A"] };
    const fase = (k, html) => `<span class="fase" style="background:${FASES[k][1]}">${FASES[k][0]}</span>${envolverTablas(htmlSeguro(html))}`;
    if (exp) p.push(fase("exploracion", g.fase_exploracion));
    const porFase = (k) => actividades.map((a, i) => ({ a, i })).filter((x) => (x.a.fase || "aplicacion") === k);
    const render = ({ a, i }) => {
      const t = temaArea(a.area || a.titulo);
      const pts = (Array.isArray(a.puntos) ? a.puntos : []).map((pt, j) => `<div class="punto"><div class="punto-h"><span class="pn" style="background:${t.color}">Punto ${j + 1}</span><span>${esc(pt.titulo || "")}</span></div>${envolverTablas(htmlSeguro(pt.contenido))}${lineas > 0 ? lineasRespuesta(lineas) : ""}</div>`).join("");
      return `<div class="act" style="border-color:${t.color}"><div class="act-h" style="background:${t.color}"><span class="em">${t.emoji}</span><div><div class="t">Actividad ${i + 1}${a.titulo ? ` · ${esc(a.titulo.charAt(0).toUpperCase() + a.titulo.slice(1))}` : ""}</div><div class="a">${esc(a.area || t.nombre)}</div></div></div>
        <div class="act-b">${vacioHtml(a.situacion) ? "" : `<div class="caja c-azul"><b class="t">🧭 ${esc(a.intro_titulo || "Situación")}</b>${envolverTablas(htmlSeguro(a.situacion))}</div>`}${pts}${a.evidencia ? `<div class="caja c-verde"><b class="t">📦 Evidencia que debes entregar</b>${esc(a.evidencia.charAt(0).toUpperCase() + a.evidencia.slice(1))}</div>` : ""}</div></div>`;
    };
    if (apl || porFase("aplicacion").length) {
      p.push(`<span class="fase" style="background:${FASES.aplicacion[1]}">${FASES.aplicacion[0]}</span>`);
      if (apl) p.push(envolverTablas(htmlSeguro(g.fase_aplicacion)));
      porFase("aplicacion").forEach((x) => p.push(render(x)));
    }
    porFase("exploracion").forEach((x) => p.push(render(x)));
    if (tra || porFase("transferencia").length) {
      p.push(`<span class="fase" style="background:${FASES.transferencia[1]}">${FASES.transferencia[0]}</span>`);
      if (tra) p.push(`<div class="caja c-verde">${envolverTablas(htmlSeguro(g.fase_transferencia))}</div>`);
      porFase("transferencia").forEach((x) => p.push(render(x)));
    }
  }

  if (tiene.recursos) {
    p.push(seccionH("recursos", "gd-recursos"));
    if (!vacioHtml(g.lectura_principal)) p.push(`<h3 class="sub">📖 Lecturas principales</h3>${envolverTablas(htmlSeguro(g.lectura_principal))}`);
    if (!vacioHtml(g.material_multimedia)) p.push(`<h3 class="sub">🎬 Material multimedia y enlaces</h3>${envolverTablas(htmlSeguro(g.material_multimedia))}`);
    if (!vacioHtml(g.herramientas_sugeridas)) p.push(`<h3 class="sub">🧰 Herramientas sugeridas</h3>${envolverTablas(htmlSeguro(g.herramientas_sugeridas))}`);
  }

  if (tiene.rubrica) {
    p.push(seccionH("rubrica", "gd-rubrica"));
    if (rub.length) p.push(`<h3 class="sub">🪞 Rúbrica de autoevaluación</h3><p>Antes de entregar, marca una opción para cada criterio y sé honesto(a) con tu desempeño.</p><div class="tabla-wrap"><table><thead><tr><th>Criterio de desempeño</th><th style="width:70px;text-align:center">✅ Logrado</th><th style="width:70px;text-align:center">🟡 En proceso</th><th style="width:70px;text-align:center">🔴 Por mejorar</th></tr></thead><tbody>${rub.map((c) => `<tr><td>${esc(c.criterio)}</td><td style="text-align:center">☐</td><td style="text-align:center">☐</td><td style="text-align:center">☐</td></tr>`).join("")}</tbody></table></div>`);
    if (preg.length) p.push(`<h3 class="sub">💭 Preguntas de reflexión final</h3>${g.reflexion_intro ? `<p>${esc(g.reflexion_intro)}</p>` : ""}<ol>${preg.map((q) => `<li style="margin-bottom:6px">${esc(q.texto)}${lineas > 0 ? lineasRespuesta(Math.max(2, lineas)) : ""}</li>`).join("")}</ol>`);
  }

  p.push(`<div class="pie"><span>${esc(nombreInst)}</span><span>Generado con CÓDICE</span></div>`);
  return `<div class="guia-doc">${p.join("")}</div>`;
}

/** Documento completo para imprimir (A4, con colores). */
export function htmlGuiaImprimible(guia, opciones = {}) {
  const { autoImprimir = true } = opciones;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(guia?.titulo || "Guía de estudio")}</title>
<style>@page{size:A4;margin:12mm 12mm 14mm;@bottom-right{content:counter(page) " / " counter(pages);font-size:9px;color:#94a3b8}}
body{margin:0;background:#fff}${CSS_GUIA}</style></head><body>${htmlGuiaCuerpo(guia, opciones)}
${autoImprimir ? "<script>window.onload=function(){window.print();};</script>" : ""}</body></html>`;
}
