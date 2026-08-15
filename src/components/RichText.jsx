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

export function TextoEnriquecido({ html, className = "" }) {
  if (!html) return null;
  const pareceHtml = /<[a-z][\s\S]*>/i.test(html);
  return (
    <div className={`leading-relaxed ${className}`} style={{ wordBreak: "break-word", whiteSpace: pareceHtml ? "normal" : "pre-line" }}
      dangerouslySetInnerHTML={{ __html: html }} />
  );
} 
