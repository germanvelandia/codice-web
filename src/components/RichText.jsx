import React, { useEffect, useRef, useState } from "react";

const COLORES_TEXTO = ["#111827", "#DC2626", "#2563EB", "#16A34A", "#D97706", "#7C3AED"];

// Editor de texto enriquecido liviano — sin dependencias externas. Guarda el
// contenido como HTML (negrita, cursiva, subrayado, color, tamaño, alineación,
// listas). El botón activo/inactivo no se refleja en tiempo real, es una
// herramienta simple, no un procesador de texto completo.
export function EditorTexto({ value, onChange, minHeight = 130, placeholder = "" }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== (value || "")) {
      editorRef.current.innerHTML = value || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // solo al montar — si sincronizáramos en cada cambio de `value`, se pierde la posición del cursor mientras se escribe

  const ejecutar = (comando, valor = null) => {
    editorRef.current.focus();
    document.execCommand(comando, false, valor);
    onChange(editorRef.current.innerHTML);
  };

  const seleccion = () => String(window.getSelection?.()?.toString() || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  const insertar = (html) => { editorRef.current.focus(); document.execCommand("insertHTML", false, html); onChange(editorRef.current.innerHTML); };
  const insertarTabla = () => {
    const r = window.prompt("¿Cuántas filas y columnas? (ej: 4x3 → 4 filas, 3 columnas; la primera fila es el encabezado)", "3x3");
    const m = String(r || "").match(/^\s*(\d{1,2})\s*[x×,]\s*(\d{1,2})\s*$/i);
    if (!m) return;
    const f = Math.min(30, +m[1]), c = Math.min(8, +m[2]);
    const celda = (tag, txt) => `<${tag} style="border:1px solid #cbd5e1;padding:5px 8px;${tag === "th" ? "background:#f1f5f9;font-weight:700;text-align:left" : ""}">${txt}</${tag}>`;
    const fila = (tag, i) => `<tr>${Array.from({ length: c }, (_, j) => celda(tag, tag === "th" ? `Columna ${j + 1}` : "<br>")).join("")}</tr>`;
    insertar(`<table style="border-collapse:collapse;width:100%;margin:6px 0"><tbody>${fila("th", 0)}${Array.from({ length: f - 1 }, (_, i) => fila("td", i)).join("")}</tbody></table><p><br></p>`);
  };

  const BotonBarra = ({ onClick, children, title, className = "" }) => (
    <button type="button" title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      className={`w-7 h-7 shrink-0 rounded hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs ${className}`}>
      {children}
    </button>
  );

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-0.5 bg-slate-50 border-b border-slate-200 px-1.5 py-1">
        <BotonBarra title="Negrita" onClick={() => ejecutar("bold")} className="font-bold">B</BotonBarra>
        <BotonBarra title="Cursiva" onClick={() => ejecutar("italic")} className="italic">I</BotonBarra>
        <BotonBarra title="Subrayado" onClick={() => ejecutar("underline")} className="underline">U</BotonBarra>
        <span className="w-px h-5 bg-slate-300 mx-1" />
        <select onMouseDown={(e) => e.stopPropagation()} onChange={(e) => ejecutar("fontSize", e.target.value)} defaultValue="3"
          title="Tamaño de letra" className="text-[11px] rounded border border-slate-200 px-1 py-1 bg-white outline-none">
          <option value="2">Chico</option>
          <option value="3">Normal</option>
          <option value="5">Grande</option>
          <option value="7">Muy grande</option>
        </select>
        <span className="w-px h-5 bg-slate-300 mx-1" />
        {COLORES_TEXTO.map((c) => (
          <button key={c} type="button" title="Color de letra" onMouseDown={(e) => e.preventDefault()} onClick={() => ejecutar("foreColor", c)}
            className="w-5 h-5 shrink-0 rounded-full border border-white shadow" style={{ background: c }} />
        ))}
        <span className="w-px h-5 bg-slate-300 mx-1" />
        <BotonBarra title="Alinear a la izquierda" onClick={() => ejecutar("justifyLeft")}>⬅</BotonBarra>
        <BotonBarra title="Centrar" onClick={() => ejecutar("justifyCenter")}>↔</BotonBarra>
        <BotonBarra title="Alinear a la derecha" onClick={() => ejecutar("justifyRight")}>➡</BotonBarra>
        <span className="w-px h-5 bg-slate-300 mx-1" />
        <BotonBarra title="Lista con viñetas" onClick={() => ejecutar("insertUnorderedList")}>•≡</BotonBarra>
        <BotonBarra title="Lista numerada" onClick={() => ejecutar("insertOrderedList")}>1.</BotonBarra>
        <span className="w-px h-5 bg-slate-300 mx-1" />
        <BotonBarra title="Subtítulo" onClick={() => insertar(`<h4 style="font-weight:700;font-size:14px;margin:8px 0 3px">${seleccion() || "Subtítulo"}</h4><p><br></p>`)}>H</BotonBarra>
        <BotonBarra title="Tabla (filas × columnas)" onClick={insertarTabla}>▦</BotonBarra>
        <BotonBarra title="Cuadro destacado" onClick={() => insertar(`<div style="border-left:5px solid #7c3aed;background:#f5f3ff;padding:8px 12px;border-radius:8px;margin:6px 0">${seleccion() || "Texto destacado"}</div><p><br></p>`)}>💡</BotonBarra>
        <BotonBarra title="Quitar formato" onClick={() => ejecutar("removeFormat")}>✕</BotonBarra>
      </div>
      <div ref={editorRef} contentEditable suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        data-placeholder={placeholder}
        className="px-3 py-2 text-sm outline-none rich-text-editable"
        style={{ minHeight }} />
    </div>
  );
}

// Muestra el HTML guardado por el editor. Si el contenido es texto plano viejo
// (de antes de tener el editor), preserva los saltos de línea igual que antes.
// Para usos puntuales donde se necesita el texto sin formato (ej: una
// referencia breve dentro de una oración) — saca las etiquetas HTML.
export function textoPlano(html) {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

// Limpia el HTML antes de mostrarlo (seguridad): deja solo etiquetas de formato
// seguras y estilos inofensivos; elimina scripts, eventos (onclick…), iframes,
// enlaces javascript: e imágenes que no sean data:/https.
const TAGS_OK = new Set(["B","STRONG","I","EM","U","S","P","BR","DIV","SPAN","FONT","UL","OL","LI","H1","H2","H3","H4","BLOCKQUOTE","TABLE","THEAD","TBODY","TR","TH","TD","A","IMG","SUB","SUP","HR","CODE","PRE"]);
const ESTILOS_OK = ["color","background","background-color","font-size","font-weight","font-style","text-align","text-decoration","border","border-left","border-radius","padding","margin","width","max-width","border-collapse","vertical-align"];
export function limpiarHtml(html) {
  if (!html || typeof document === "undefined") return html || "";
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const limpiar = (nodo) => {
    Array.from(nodo.childNodes).forEach((h) => {
      if (h.nodeType === 3) return;
      if (h.nodeType !== 1) { h.remove(); return; }
      if (!TAGS_OK.has(h.tagName)) {
        if (["SCRIPT","STYLE","IFRAME","OBJECT","EMBED","FORM","INPUT","BUTTON","LINK","META","SVG","MATH"].includes(h.tagName.toUpperCase())) { h.remove(); return; }
        limpiar(h); h.replaceWith(...Array.from(h.childNodes)); return;
      }
      Array.from(h.attributes).forEach((a) => {
        const n = a.name.toLowerCase(), v = a.value;
        if (n === "style") {
          const ok = v.split(";").map((d) => d.trim()).filter((d) => {
            const [k, ...r] = d.split(":"); const val = r.join(":").toLowerCase();
            return k && ESTILOS_OK.includes(k.trim().toLowerCase()) && !/url\(|expression|javascript|@import/.test(val);
          }).join(";");
          if (ok) h.setAttribute("style", ok); else h.removeAttribute("style");
        } else if (["color","size","face","align","colspan","rowspan","width","height"].includes(n)) {
          /* permitido */
        } else if (n === "href" && h.tagName === "A" && /^(https?:|mailto:)/i.test(v.trim())) {
          h.setAttribute("target", "_blank"); h.setAttribute("rel", "noopener noreferrer");
        } else if (n === "src" && h.tagName === "IMG" && /^(https:|data:image\/)/i.test(v.trim())) {
          /* permitido */
        } else if (n === "alt") {
          /* permitido */
        } else { h.removeAttribute(a.name); }
      });
      limpiar(h);
    });
  };
  limpiar(tpl.content);
  const div = document.createElement("div");
  div.appendChild(tpl.content.cloneNode(true));
  return div.innerHTML;
}

export function TextoEnriquecido({ html, className = "" }) {
  if (!html) return null;
  const pareceHtml = /<[a-z][\s\S]*>/i.test(html);
  return (
    <div className={`leading-relaxed ${className}`} style={{ wordBreak: "break-word", whiteSpace: pareceHtml ? "normal" : "pre-line" }}
      dangerouslySetInnerHTML={{ __html: pareceHtml ? limpiarHtml(html) : html.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])) }} />
  );
}
