import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { EditorTexto, TextoEnriquecido } from "../components/RichText";

/* =====================================================================
   Elementos de aprendizaje de los libros de estudio.
   Cada tipo tiene: etiqueta, ícono, contenido vacío, editor (docente),
   vista (estudiante / vista previa) y versión para imprimir.
   ===================================================================== */

export const GRUPOS_BLOQUE = [
  { key: "medios", label: "Texto y medios", tipos: ["texto", "encabezado", "imagen", "video", "audio", "enlace", "archivo"] },
  { key: "preguntas", label: "Preguntas autocorregibles", tipos: ["pregunta_opcion", "pregunta_vf", "pregunta_completar"] },
  { key: "actividades", label: "Actividades de trabajo", tipos: ["abierta", "tabla", "linea_tiempo", "mapa_mental", "caso"] },
  { key: "apoyos", label: "Apoyos de estudio", tipos: ["glosario", "flashcards", "cita", "sabias", "rubrica"] },
];

export const TIPOS = {
  texto: { label: "Texto con formato", icono: "📝", vacio: () => ({ html: "" }) },
  encabezado: { label: "Título de sección", icono: "🔤", vacio: () => ({ texto: "", nivel: "2" }) },
  imagen: { label: "Imagen", icono: "🖼️", vacio: () => ({ url: "", pie: "" }) },
  video: { label: "Video (YouTube / Vimeo)", icono: "🎬", vacio: () => ({ url: "", titulo: "" }) },
  audio: { label: "Audio", icono: "🎧", vacio: () => ({ url: "", titulo: "" }) },
  enlace: { label: "Enlace", icono: "🔗", vacio: () => ({ url: "", titulo: "", descripcion: "" }) },
  archivo: { label: "Archivo para descargar", icono: "📎", vacio: () => ({ url: "", nombre: "" }) },
  pregunta_opcion: { label: "Opción múltiple", icono: "🔘", vacio: () => ({ enunciado: "", opciones: [{ texto: "", correcta: true }, { texto: "", correcta: false }, { texto: "", correcta: false }, { texto: "", correcta: false }], retro: "" }) },
  pregunta_vf: { label: "Verdadero / Falso", icono: "⚖️", vacio: () => ({ enunciado: "", correcta: true, retro: "" }) },
  pregunta_completar: { label: "Completar la respuesta", icono: "✍️", vacio: () => ({ enunciado: "", respuestas: "", retro: "" }) },
  abierta: { label: "Respuesta abierta / entrega", icono: "💬", vacio: () => ({ enunciado: "", pide_enlace: false }) },
  tabla: { label: "Tabla / cuadro comparativo", icono: "📊", vacio: () => ({ titulo: "", columnas: ["", ""], filas: [["", ""], ["", ""]], editable: false }) },
  linea_tiempo: { label: "Línea de tiempo", icono: "⏳", vacio: () => ({ titulo: "", eventos: [{ fecha: "", titulo: "", texto: "" }] }) },
  mapa_mental: { label: "Mapa mental", icono: "🧠", vacio: () => ({ centro: "", ramas: [{ texto: "", hijos: "" }] }) },
  caso: { label: "Caso o dilema ético", icono: "⚖️", vacio: () => ({ titulo: "", situacion: "", preguntas: "" }) },
  glosario: { label: "Glosario", icono: "📖", vacio: () => ({ titulo: "Glosario", terminos: [{ termino: "", definicion: "" }] }) },
  flashcards: { label: "Tarjetas de repaso", icono: "🃏", vacio: () => ({ titulo: "Tarjetas de repaso", tarjetas: [{ frente: "", reverso: "" }] }) },
  cita: { label: "Cita o reflexión", icono: "💭", vacio: () => ({ texto: "", autor: "" }) },
  sabias: { label: "¿Sabías que…?", icono: "💡", vacio: () => ({ texto: "" }) },
  rubrica: { label: "Rúbrica de autoevaluación", icono: "✅", vacio: () => ({ titulo: "Mi autoevaluación", criterios: [{ criterio: "" }] }) },
};
export const nuevoContenido = (tipo) => (TIPOS[tipo] ? TIPOS[tipo].vacio() : {});

const PREGUNTAS_AUTO = ["pregunta_opcion", "pregunta_vf", "pregunta_completar"];
export const esAutocorregible = (tipo) => PREGUNTAS_AUTO.includes(tipo);
export const esInteractivo = (tipo) => [...PREGUNTAS_AUTO, "abierta", "caso", "rubrica", "tabla"].includes(tipo);

/* ---------- utilidades ---------- */
const norm = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function urlVideo(url) {
  const u = String(url || "").trim();
  let m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
  if (m) return { tipo: "iframe", src: `https://www.youtube.com/embed/${m[1]}` };
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (m) return { tipo: "iframe", src: `https://player.vimeo.com/video/${m[1]}` };
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(u)) return { tipo: "video", src: u };
  return u ? { tipo: "enlace", src: u } : null;
}

// Puntaje de una pregunta autocorregible → { ok: boolean|null }
export function evaluarPregunta(bloque, estado) {
  const c = bloque.contenido || {};
  if (!estado || !estado.comprobada) return { ok: null };
  if (bloque.tipo === "pregunta_opcion") return { ok: !!c.opciones?.[estado.sel]?.correcta };
  if (bloque.tipo === "pregunta_vf") return { ok: estado.sel === c.correcta };
  if (bloque.tipo === "pregunta_completar") {
    const buenas = String(c.respuestas || "").split(/[;\n]/).map(norm).filter(Boolean);
    return { ok: buenas.includes(norm(estado.txt)) };
  }
  return { ok: null };
}

/* ---------- subida de archivos ---------- */
const BUCKET = "libros-estudio";
function reducirImagen(archivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo); const img = new Image();
    img.onload = () => {
      const esc2 = Math.min(1, 1400 / img.width, 1400 / img.height);
      const c = document.createElement("canvas"); c.width = Math.round(img.width * esc2); c.height = Math.round(img.height * esc2);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen"))), "image/webp", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("El archivo no es una imagen válida")); };
    img.src = url;
  });
}
export async function subirArchivo(archivo, { imagen = false } = {}) {
  if (archivo.size > 15 * 1024 * 1024) throw new Error("El archivo pesa más de 15 MB.");
  let cuerpo = archivo, tipo = archivo.type || "application/octet-stream", ext = (archivo.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (imagen) { cuerpo = await reducirImagen(archivo); tipo = "image/webp"; ext = "webp"; }
  const ruta = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || "bin"}`;
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, cuerpo, { contentType: tipo, upsert: false });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
}

/* ---------- piezas de formulario ---------- */
const CLS = "w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white";
const Etiqueta = ({ children }) => <div className="text-[11px] font-semibold text-slate-500 mb-1">{children}</div>;

function SubirArchivo({ valor, onUrl, aceptar, imagen, etiqueta = "Subir archivo" }) {
  const [subiendo, setSubiendo] = useState(false);
  const elegir = async (f) => {
    if (!f) return; setSubiendo(true);
    try { onUrl(await subirArchivo(f, { imagen }), f.name); } catch (e) { alert("No se pudo subir: " + e.message); }
    setSubiendo(false);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white cursor-pointer">
        {subiendo ? "Subiendo…" : valor ? "Cambiar archivo" : `⬆️ ${etiqueta}`}
        <input type="file" accept={aceptar} className="hidden" disabled={subiendo} onChange={(e) => { elegir(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      <span className="text-[10px] text-slate-400">o pega un enlace:</span>
      <input value={valor || ""} onChange={(e) => onUrl(e.target.value)} placeholder="https://…" className="flex-1 min-w-[10rem] text-xs rounded-lg px-2.5 py-1.5 border border-slate-200 outline-none bg-white" />
    </div>
  );
}

function ListaItems({ items, onChange, campos, vacio, agregar = "➕ Agregar", minimo = 0 }) {
  const cambiar = (i, k, v) => onChange(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const mover = (i, d) => { const n = [...items]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex gap-1.5 items-start bg-slate-50 rounded-lg p-2">
          <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: campos.length > 1 && !campos.some((c) => c.multi) ? `repeat(${campos.length}, minmax(0,1fr))` : "1fr" }}>
            {campos.map((c) => c.multi
              ? <textarea key={c.k} value={it[c.k] || ""} onChange={(e) => cambiar(i, c.k, e.target.value)} rows={2} placeholder={c.label} className={CLS} />
              : <input key={c.k} value={it[c.k] || ""} onChange={(e) => cambiar(i, c.k, e.target.value)} placeholder={c.label} className={CLS} />)}
          </div>
          <div className="flex flex-col text-[11px] text-slate-400">
            <button onClick={() => mover(i, -1)} title="Subir">↑</button>
            <button onClick={() => mover(i, 1)} title="Bajar">↓</button>
            {items.length > minimo && <button onClick={() => onChange(items.filter((_, j) => j !== i))} title="Quitar" className="text-rose-400">✕</button>}
          </div>
        </div>
      ))}
      <button onClick={() => onChange([...items, { ...vacio }])} className="text-xs font-semibold text-violet-600">{agregar}</button>
    </div>
  );
}

/* =====================  EDITORES (docente)  ===================== */
export function EditorBloque({ tipo, c, set }) {
  switch (tipo) {
    case "texto": return <EditorTexto value={c.html || ""} onChange={(v) => set({ html: v })} minHeight={140} placeholder="Escribe aquí el contenido…" />;
    case "encabezado": return (
      <div className="flex gap-2"><input value={c.texto || ""} onChange={(e) => set({ texto: e.target.value })} placeholder="Título de la sección" className={CLS} />
        <select value={c.nivel || "2"} onChange={(e) => set({ nivel: e.target.value })} className="text-sm rounded-lg px-2 border border-slate-200 bg-white"><option value="2">Grande</option><option value="3">Mediano</option></select></div>);
    case "imagen": return (
      <div className="space-y-2"><SubirArchivo valor={c.url} imagen aceptar="image/*" etiqueta="Subir imagen" onUrl={(u) => set({ url: u })} />
        {c.url && <img src={c.url} alt="" className="max-h-48 rounded-lg border border-slate-200" />}
        <input value={c.pie || ""} onChange={(e) => set({ pie: e.target.value })} placeholder="Pie de imagen (opcional)" className={CLS} /></div>);
    case "video": return (
      <div className="space-y-2"><input value={c.url || ""} onChange={(e) => set({ url: e.target.value })} placeholder="Enlace de YouTube o Vimeo (o un .mp4)" className={CLS} />
        <input value={c.titulo || ""} onChange={(e) => set({ titulo: e.target.value })} placeholder="Título (opcional)" className={CLS} />
        {urlVideo(c.url) && <div className="max-w-sm"><VideoVista c={c} /></div>}</div>);
    case "audio": return (
      <div className="space-y-2"><SubirArchivo valor={c.url} aceptar="audio/*" etiqueta="Subir audio" onUrl={(u) => set({ url: u })} />
        <input value={c.titulo || ""} onChange={(e) => set({ titulo: e.target.value })} placeholder="Título (opcional)" className={CLS} />
        {c.url && <audio controls src={c.url} className="w-full" />}</div>);
    case "enlace": return (
      <div className="space-y-2"><input value={c.url || ""} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" className={CLS} />
        <input value={c.titulo || ""} onChange={(e) => set({ titulo: e.target.value })} placeholder="Título del enlace" className={CLS} />
        <input value={c.descripcion || ""} onChange={(e) => set({ descripcion: e.target.value })} placeholder="Para qué sirve (opcional)" className={CLS} /></div>);
    case "archivo": return (
      <div className="space-y-2"><SubirArchivo valor={c.url} aceptar=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip" etiqueta="Subir archivo" onUrl={(u, n) => set({ url: u, nombre: c.nombre || n || "" })} />
        <input value={c.nombre || ""} onChange={(e) => set({ nombre: e.target.value })} placeholder="Nombre que verá el estudiante" className={CLS} /></div>);
    case "pregunta_opcion": return (
      <div className="space-y-2">
        <textarea value={c.enunciado || ""} onChange={(e) => set({ enunciado: e.target.value })} rows={2} placeholder="Enunciado de la pregunta" className={CLS} />
        <Etiqueta>Opciones (marca la correcta)</Etiqueta>
        {(c.opciones || []).map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" checked={!!o.correcta} onChange={() => set({ opciones: c.opciones.map((x, j) => ({ ...x, correcta: j === i })) })} title="Respuesta correcta" />
            <input value={o.texto || ""} onChange={(e) => set({ opciones: c.opciones.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)) })} placeholder={`Opción ${"ABCDEF"[i] || i + 1}`} className={CLS} />
            {c.opciones.length > 2 && <button onClick={() => { const n = c.opciones.filter((_, j) => j !== i); if (!n.some((x) => x.correcta)) n[0].correcta = true; set({ opciones: n }); }} className="text-rose-400 text-xs">✕</button>}
          </div>))}
        {(c.opciones || []).length < 6 && <button onClick={() => set({ opciones: [...c.opciones, { texto: "", correcta: false }] })} className="text-xs font-semibold text-violet-600">➕ Agregar opción</button>}
        <input value={c.retro || ""} onChange={(e) => set({ retro: e.target.value })} placeholder="Retroalimentación al responder (opcional)" className={CLS} />
      </div>);
    case "pregunta_vf": return (
      <div className="space-y-2"><textarea value={c.enunciado || ""} onChange={(e) => set({ enunciado: e.target.value })} rows={2} placeholder="Afirmación" className={CLS} />
        <div className="flex gap-4 text-sm"><label className="flex items-center gap-1.5"><input type="radio" checked={c.correcta === true} onChange={() => set({ correcta: true })} /> Es verdadera</label>
          <label className="flex items-center gap-1.5"><input type="radio" checked={c.correcta === false} onChange={() => set({ correcta: false })} /> Es falsa</label></div>
        <input value={c.retro || ""} onChange={(e) => set({ retro: e.target.value })} placeholder="Retroalimentación (opcional)" className={CLS} /></div>);
    case "pregunta_completar": return (
      <div className="space-y-2"><textarea value={c.enunciado || ""} onChange={(e) => set({ enunciado: e.target.value })} rows={2} placeholder="Enunciado (puedes usar ___ para el espacio)" className={CLS} />
        <input value={c.respuestas || ""} onChange={(e) => set({ respuestas: e.target.value })} placeholder="Respuestas aceptadas, separadas por ; (ej: Constitución; la Constitución)" className={CLS} />
        <p className="text-[10px] text-slate-400">No se distingue entre mayúsculas, minúsculas ni tildes.</p>
        <input value={c.retro || ""} onChange={(e) => set({ retro: e.target.value })} placeholder="Retroalimentación (opcional)" className={CLS} /></div>);
    case "abierta": return (
      <div className="space-y-2"><textarea value={c.enunciado || ""} onChange={(e) => set({ enunciado: e.target.value })} rows={3} placeholder="Consigna o pregunta para el estudiante" className={CLS} />
        <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={!!c.pide_enlace} onChange={(e) => set({ pide_enlace: e.target.checked })} /> También pide un enlace (para entregar un producto en Drive, YouTube, etc.)</label></div>);
    case "tabla": return <EditorTabla c={c} set={set} />;
    case "linea_tiempo": return (
      <div className="space-y-2"><input value={c.titulo || ""} onChange={(e) => set({ titulo: e.target.value })} placeholder="Título (opcional)" className={CLS} />
        <ListaItems items={c.eventos || []} onChange={(eventos) => set({ eventos })} vacio={{ fecha: "", titulo: "", texto: "" }} agregar="➕ Agregar evento" minimo={1}
          campos={[{ k: "fecha", label: "Fecha o época" }, { k: "titulo", label: "Evento" }, { k: "texto", label: "Descripción", multi: true }]} /></div>);
    case "mapa_mental": return (
      <div className="space-y-2"><input value={c.centro || ""} onChange={(e) => set({ centro: e.target.value })} placeholder="Idea central" className={CLS} />
        <ListaItems items={c.ramas || []} onChange={(ramas) => set({ ramas })} vacio={{ texto: "", hijos: "" }} agregar="➕ Agregar rama" minimo={1}
          campos={[{ k: "texto", label: "Rama principal" }, { k: "hijos", label: "Ideas de esta rama (una por línea)", multi: true }]} /></div>);
    case "caso": return (
      <div className="space-y-2"><input value={c.titulo || ""} onChange={(e) => set({ titulo: e.target.value })} placeholder="Título del caso o dilema" className={CLS} />
        <Etiqueta>Situación</Etiqueta><EditorTexto value={c.situacion || ""} onChange={(v) => set({ situacion: v })} minHeight={110} placeholder="Describe el caso…" />
        <textarea value={c.preguntas || ""} onChange={(e) => set({ preguntas: e.target.value })} rows={3} placeholder="Preguntas para analizarlo (una por línea)" className={CLS} /></div>);
    case "glosario": return (
      <div className="space-y-2"><input value={c.titulo || ""} onChange={(e) => set({ titulo: e.target.value })} placeholder="Título" className={CLS} />
        <ListaItems items={c.terminos || []} onChange={(terminos) => set({ terminos })} vacio={{ termino: "", definicion: "" }} agregar="➕ Agregar término" minimo={1}
          campos={[{ k: "termino", label: "Término" }, { k: "definicion", label: "Definición" }]} /></div>);
    case "flashcards": return (
      <div className="space-y-2"><input value={c.titulo || ""} onChange={(e) => set({ titulo: e.target.value })} placeholder="Título" className={CLS} />
        <ListaItems items={c.tarjetas || []} onChange={(tarjetas) => set({ tarjetas })} vacio={{ frente: "", reverso: "" }} agregar="➕ Agregar tarjeta" minimo={1}
          campos={[{ k: "frente", label: "Frente (pregunta o concepto)" }, { k: "reverso", label: "Reverso (respuesta)" }]} /></div>);
    case "cita": return (
      <div className="space-y-2"><textarea value={c.texto || ""} onChange={(e) => set({ texto: e.target.value })} rows={3} placeholder="Texto de la cita o reflexión" className={CLS} />
        <input value={c.autor || ""} onChange={(e) => set({ autor: e.target.value })} placeholder="Autor o fuente (opcional)" className={CLS} /></div>);
    case "sabias": return <textarea value={c.texto || ""} onChange={(e) => set({ texto: e.target.value })} rows={3} placeholder="Dato curioso o idea para recordar" className={CLS} />;
    case "rubrica": return (
      <div className="space-y-2"><input value={c.titulo || ""} onChange={(e) => set({ titulo: e.target.value })} placeholder="Título" className={CLS} />
        <ListaItems items={c.criterios || []} onChange={(criterios) => set({ criterios })} vacio={{ criterio: "" }} agregar="➕ Agregar criterio" minimo={1} campos={[{ k: "criterio", label: "Criterio (ej: Explico con mis palabras el concepto)" }]} />
        <p className="text-[10px] text-slate-400">El estudiante marca cada criterio como Logrado, En proceso o Por mejorar.</p></div>);
    default: return <p className="text-xs text-slate-400">Este elemento no tiene opciones.</p>;
  }
}

function EditorTabla({ c, set }) {
  const cols = c.columnas || [], filas = c.filas || [];
  const setCol = (j, v) => set({ columnas: cols.map((x, i) => (i === j ? v : x)) });
  const setCel = (i, j, v) => set({ filas: filas.map((f, r) => (r === i ? f.map((x, k) => (k === j ? v : x)) : f)) });
  return (
    <div className="space-y-2">
      <input value={c.titulo || ""} onChange={(e) => set({ titulo: e.target.value })} placeholder="Título de la tabla (opcional)" className={CLS} />
      <div className="overflow-x-auto"><table className="text-xs border-collapse">
        <thead><tr>{cols.map((x, j) => <th key={j} className="p-0.5"><input value={x} onChange={(e) => setCol(j, e.target.value)} placeholder={`Columna ${j + 1}`} className="w-32 text-xs font-bold rounded px-2 py-1.5 border border-violet-300 bg-violet-50 outline-none" /></th>)}<th /></tr></thead>
        <tbody>{filas.map((f, i) => (<tr key={i}>{f.map((x, j) => <td key={j} className="p-0.5"><input value={x} onChange={(e) => setCel(i, j, e.target.value)} className="w-32 text-xs rounded px-2 py-1.5 border border-slate-200 bg-white outline-none" /></td>)}
          <td><button onClick={() => set({ filas: filas.filter((_, r) => r !== i) })} className="text-rose-400 px-1">✕</button></td></tr>))}</tbody></table></div>
      <div className="flex flex-wrap gap-3 text-xs font-semibold text-violet-600">
        <button onClick={() => set({ filas: [...filas, cols.map(() => "")] })}>➕ Fila</button>
        <button onClick={() => set({ columnas: [...cols, ""], filas: filas.map((f) => [...f, ""]) })}>➕ Columna</button>
        {cols.length > 1 && <button onClick={() => set({ columnas: cols.slice(0, -1), filas: filas.map((f) => f.slice(0, -1)) })} className="text-rose-400">➖ Quitar última columna</button>}
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={!!c.editable} onChange={(e) => set({ editable: e.target.checked })} /> El estudiante completa las celdas que dejes vacías</label>
    </div>
  );
}

/* =====================  VISTAS (estudiante / vista previa)  ===================== */
function VideoVista({ c }) {
  const v = urlVideo(c.url);
  if (!v) return null;
  if (v.tipo === "iframe") return <div className="aspect-video rounded-xl overflow-hidden bg-black"><iframe src={v.src} title={c.titulo || "Video"} className="w-full h-full" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" /></div>;
  if (v.tipo === "video") return <video controls src={v.src} className="w-full rounded-xl" />;
  return <a href={v.src} target="_blank" rel="noreferrer" className="text-sm text-violet-600 underline">▶ Abrir el video</a>;
}

const Tarjeta = ({ color = "#e2e8f0", children, className = "" }) => <div className={`rounded-xl p-3 ${className}`} style={{ background: color }}>{children}</div>;

function Resultado({ ok, retro }) {
  if (ok === null || ok === undefined) return null;
  return (
    <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
      <b>{ok ? "✅ ¡Correcto!" : "❌ Aún no. Inténtalo de nuevo."}</b>{retro ? <div className="mt-0.5 text-slate-600">💡 {retro}</div> : null}
    </div>
  );
}

function Flashcards({ c }) {
  const [volteadas, setVolteadas] = useState({});
  return (
    <div>
      {c.titulo && <h4 className="font-bold text-slate-700 mb-2">🃏 {c.titulo}</h4>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {(c.tarjetas || []).map((t, i) => (
          <button key={i} onClick={() => setVolteadas((p) => ({ ...p, [i]: !p[i] }))}
            className="min-h-[88px] rounded-xl p-3 text-sm font-semibold text-center border-2 transition-colors"
            style={volteadas[i] ? { background: "#fff7e0", borderColor: "#B8892B", color: "#6b4e10" } : { background: "#E8EEF8", borderColor: "#2F55A4", color: "#17264D" }}>
            {volteadas[i] ? t.reverso : t.frente}
            <div className="text-[9px] font-normal opacity-60 mt-1">{volteadas[i] ? "respuesta" : "toca para voltear"}</div>
          </button>))}
      </div>
    </div>
  );
}

export function VistaBloque({ bloque, estado, onEstado }) {
  const c = bloque.contenido || {};
  const e = estado || {};
  const poner = (parcial) => onEstado && onEstado({ ...e, ...parcial });
  switch (bloque.tipo) {
    case "texto": return <TextoEnriquecido html={c.html || ""} className="text-sm text-slate-700" />;
    case "encabezado": return c.nivel === "3" ? <h4 className="text-base font-bold text-[#2F55A4] mt-2">{c.texto}</h4> : <h3 className="text-lg font-extrabold text-[#17264D] mt-3 pb-1 border-b-2 border-[#B8892B]/40">{c.texto}</h3>;
    case "imagen": return c.url ? <figure><img src={c.url} alt={c.pie || ""} loading="lazy" className="max-w-full rounded-xl mx-auto" />{c.pie && <figcaption className="text-[11px] text-slate-500 text-center mt-1">{c.pie}</figcaption>}</figure> : null;
    case "video": return <div>{c.titulo && <div className="text-xs font-bold text-slate-600 mb-1">🎬 {c.titulo}</div>}<VideoVista c={c} /></div>;
    case "audio": return c.url ? <div>{c.titulo && <div className="text-xs font-bold text-slate-600 mb-1">🎧 {c.titulo}</div>}<audio controls src={c.url} className="w-full" /></div> : null;
    case "enlace": return c.url ? (
      <a href={c.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-sky-200 bg-sky-50 p-3 hover:shadow-sm">
        <div className="text-sm font-bold text-sky-700">🔗 {c.titulo || c.url}</div>{c.descripcion && <div className="text-xs text-slate-600 mt-0.5">{c.descripcion}</div>}</a>) : null;
    case "archivo": return c.url ? (
      <a href={c.url} target="_blank" rel="noreferrer" download className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:shadow-sm">📎 {c.nombre || "Descargar archivo"} <span className="text-xs text-violet-500">⬇️</span></a>) : null;

    case "pregunta_opcion": {
      const r = evaluarPregunta(bloque, e);
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xs font-bold text-[#2F55A4] mb-1">🔘 Pregunta</div>
          <p className="text-sm text-slate-800 font-semibold mb-2 whitespace-pre-line">{c.enunciado}</p>
          <div className="space-y-1.5">
            {(c.opciones || []).map((o, i) => {
              const marcada = e.sel === i; const mostrar = e.comprobada;
              const estilo = mostrar && marcada ? (o.correcta ? "border-emerald-400 bg-emerald-50" : "border-rose-400 bg-rose-50") : marcada ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-white";
              return (<button key={i} disabled={!!e.comprobada && r.ok} onClick={() => poner({ sel: i, comprobada: false })} className={`w-full text-left text-sm rounded-lg border px-3 py-2 ${estilo}`}>
                <b className="text-slate-400 mr-1.5">{"ABCDEF"[i]}.</b>{o.texto}</button>);
            })}
          </div>
          {e.sel !== undefined && !(e.comprobada && r.ok) && <button onClick={() => poner({ comprobada: true })} className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#2F55A4] text-white">Comprobar</button>}
          <Resultado ok={r.ok} retro={e.comprobada ? c.retro : ""} />
        </div>);
    }
    case "pregunta_vf": {
      const r = evaluarPregunta(bloque, e);
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xs font-bold text-[#2F55A4] mb-1">⚖️ Verdadero o falso</div>
          <p className="text-sm text-slate-800 font-semibold mb-2 whitespace-pre-line">{c.enunciado}</p>
          <div className="flex gap-2">{[[true, "Verdadero"], [false, "Falso"]].map(([v, l]) => (
            <button key={l} disabled={!!e.comprobada && r.ok} onClick={() => poner({ sel: v, comprobada: false })} className={`flex-1 text-sm rounded-lg border px-3 py-2 font-semibold ${e.sel === v ? (e.comprobada ? (r.ok ? "border-emerald-400 bg-emerald-50" : "border-rose-400 bg-rose-50") : "border-violet-400 bg-violet-50") : "border-slate-200"}`}>{l}</button>))}</div>
          {e.sel !== undefined && !(e.comprobada && r.ok) && <button onClick={() => poner({ comprobada: true })} className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#2F55A4] text-white">Comprobar</button>}
          <Resultado ok={r.ok} retro={e.comprobada ? c.retro : ""} />
        </div>);
    }
    case "pregunta_completar": {
      const r = evaluarPregunta(bloque, e);
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xs font-bold text-[#2F55A4] mb-1">✍️ Completa</div>
          <p className="text-sm text-slate-800 font-semibold mb-2 whitespace-pre-line">{c.enunciado}</p>
          <input value={e.txt || ""} onChange={(ev) => poner({ txt: ev.target.value, comprobada: false })} placeholder="Escribe tu respuesta" className={CLS} disabled={!!e.comprobada && r.ok} />
          {(e.txt || "").trim() && !(e.comprobada && r.ok) && <button onClick={() => poner({ comprobada: true })} className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#2F55A4] text-white">Comprobar</button>}
          <Resultado ok={r.ok} retro={e.comprobada ? c.retro : ""} />
        </div>);
    }
    case "abierta": return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
        <div className="text-xs font-bold text-amber-700 mb-1">💬 Actividad</div>
        <p className="text-sm text-slate-800 font-semibold mb-2 whitespace-pre-line">{c.enunciado}</p>
        <textarea value={e.txt || ""} onChange={(ev) => poner({ txt: ev.target.value })} rows={4} placeholder="Escribe tu respuesta aquí…" className={CLS} />
        {c.pide_enlace && <input value={e.enlace || ""} onChange={(ev) => poner({ enlace: ev.target.value })} placeholder="Enlace de tu trabajo (Drive, YouTube…)" className={CLS + " mt-2"} />}
        <div className="text-[10px] text-slate-400 mt-1">Se guarda automáticamente.</div>
      </div>);
    case "tabla": {
      const cols = c.columnas || [], filas = c.filas || [];
      return (
        <div>{c.titulo && <div className="text-sm font-bold text-slate-700 mb-1">📊 {c.titulo}</div>}
          <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-xs">
            <thead><tr style={{ background: "#17264D" }}>{cols.map((x, j) => <th key={j} className="p-2 text-left text-white font-bold">{x}</th>)}</tr></thead>
            <tbody>{filas.map((f, i) => (<tr key={i} className={i % 2 ? "bg-slate-50" : "bg-white"}>{f.map((x, j) => (
              <td key={j} className="p-1.5 align-top text-slate-700">{c.editable && !String(x).trim()
                ? <textarea value={e.celdas?.[`${i}-${j}`] || ""} onChange={(ev) => poner({ celdas: { ...(e.celdas || {}), [`${i}-${j}`]: ev.target.value } })} rows={2} className="w-full min-w-[7rem] text-xs rounded border border-amber-300 bg-amber-50/50 px-1.5 py-1 outline-none" placeholder="Completa…" />
                : x}</td>))}</tr>))}</tbody></table></div></div>);
    }
    case "linea_tiempo": return (
      <div>{c.titulo && <div className="text-sm font-bold text-slate-700 mb-2">⏳ {c.titulo}</div>}
        <div className="border-l-2 border-[#B8892B] ml-2 space-y-3">{(c.eventos || []).map((ev, i) => (
          <div key={i} className="relative pl-4"><span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-[#B8892B] border-2 border-white" />
            <div className="text-[11px] font-bold text-[#B8892B]">{ev.fecha}</div><div className="text-sm font-bold text-[#17264D]">{ev.titulo}</div>{ev.texto && <div className="text-xs text-slate-600">{ev.texto}</div>}</div>))}</div></div>);
    case "mapa_mental": {
      const colores = ["#2F55A4", "#0E9F8E", "#B8892B", "#7C3AED", "#E0552E", "#0EA5E9"];
      return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-center mb-3"><span className="inline-block rounded-full px-5 py-2 text-sm font-extrabold text-white" style={{ background: "#17264D" }}>🧠 {c.centro}</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{(c.ramas || []).map((r, i) => (
            <div key={i} className="rounded-xl bg-white border-2 p-2.5" style={{ borderColor: colores[i % colores.length] }}>
              <div className="text-sm font-bold" style={{ color: colores[i % colores.length] }}>{r.texto}</div>
              <ul className="mt-1 space-y-0.5">{String(r.hijos || "").split("\n").map((h) => h.trim()).filter(Boolean).map((h, k) => <li key={k} className="text-xs text-slate-600 pl-3 relative"><span className="absolute left-0">•</span>{h}</li>)}</ul></div>))}</div></div>);
    }
    case "caso": {
      const qs = String(c.preguntas || "").split("\n").map((x) => x.trim()).filter(Boolean);
      return (
        <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3">
          <div className="text-xs font-bold text-violet-700 mb-1">⚖️ Caso para analizar</div>
          {c.titulo && <div className="text-sm font-extrabold text-[#17264D] mb-1">{c.titulo}</div>}
          <TextoEnriquecido html={c.situacion || ""} className="text-sm text-slate-700" />
          {qs.map((q, i) => (<div key={i} className="mt-2"><div className="text-xs font-semibold text-slate-700 mb-1">{i + 1}. {q}</div>
            <textarea value={e.resp?.[i] || ""} onChange={(ev) => poner({ resp: { ...(e.resp || {}), [i]: ev.target.value } })} rows={3} className={CLS} placeholder="Tu análisis…" /></div>))}
        </div>);
    }
    case "glosario": return (
      <div>{c.titulo && <h4 className="font-bold text-slate-700 mb-2">📖 {c.titulo}</h4>}
        <div className="grid gap-1.5">{(c.terminos || []).filter((t) => t.termino).map((t, i) => (
          <div key={i} className="bg-slate-50 rounded-lg p-2"><span className="text-xs font-bold text-violet-600">{t.termino}: </span><span className="text-xs text-slate-600">{t.definicion}</span></div>))}</div></div>);
    case "flashcards": return <Flashcards c={c} />;
    case "cita": return (
      <blockquote className="rounded-xl border-l-4 border-[#B8892B] bg-[#fbf8ef] px-4 py-3"><p className="text-sm italic text-slate-700 whitespace-pre-line">“{c.texto}”</p>{c.autor && <footer className="text-xs font-semibold text-[#B8892B] mt-1">— {c.autor}</footer>}</blockquote>);
    case "sabias": return <div className="rounded-xl bg-yellow-50 border border-yellow-200 px-3 py-2.5 text-sm text-slate-700 whitespace-pre-line"><b className="text-yellow-700">💡 ¿Sabías que…? </b>{c.texto}</div>;
    case "rubrica": return (
      <div className="rounded-xl bg-violet-50 p-3"><h4 className="text-sm font-bold text-slate-700 mb-2">✅ {c.titulo || "Mi autoevaluación"}</h4>
        {(c.criterios || []).filter((x) => x.criterio).map((x, i) => (<div key={i} className="mb-2 bg-white rounded-lg p-2"><p className="text-xs text-slate-600 mb-1.5">{x.criterio}</p>
          <div className="flex flex-wrap gap-1.5">{["Logrado", "En proceso", "Por mejorar"].map((n) => (
            <button key={n} onClick={() => poner({ niv: { ...(e.niv || {}), [i]: n } })} className={`text-[11px] px-2.5 py-1 rounded-full ${e.niv?.[i] === n ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-600"}`}>{n}</button>))}</div></div>))}</div>);
    default: return null;
  }
}

/* =====================  IMPRESIÓN  ===================== */
export function htmlBloque(b) {
  const c = b.contenido || {};
  const caja = (t) => `<div class="caja">${t}</div>`;
  switch (b.tipo) {
    case "texto": return `<div>${c.html || ""}</div>`;
    case "encabezado": return c.nivel === "3" ? `<h3>${esc(c.texto)}</h3>` : `<h2>${esc(c.texto)}</h2>`;
    case "imagen": return c.url ? `<figure><img src="${esc(c.url)}" style="max-width:100%;max-height:300px">${c.pie ? `<figcaption>${esc(c.pie)}</figcaption>` : ""}</figure>` : "";
    case "video": return c.url ? caja(`🎬 <b>${esc(c.titulo || "Video")}</b><br>${esc(c.url)}`) : "";
    case "audio": return c.url ? caja(`🎧 <b>${esc(c.titulo || "Audio")}</b><br>${esc(c.url)}`) : "";
    case "enlace": return c.url ? caja(`🔗 <b>${esc(c.titulo || c.url)}</b> — ${esc(c.url)}${c.descripcion ? `<br>${esc(c.descripcion)}` : ""}`) : "";
    case "archivo": return c.url ? caja(`📎 ${esc(c.nombre || "Archivo")} — ${esc(c.url)}`) : "";
    case "pregunta_opcion": return caja(`<b>${esc(c.enunciado)}</b><br>${(c.opciones || []).map((o, i) => `☐ ${"ABCDEF"[i]}. ${esc(o.texto)}`).join("<br>")}`);
    case "pregunta_vf": return caja(`<b>${esc(c.enunciado)}</b><br>☐ Verdadero &nbsp; ☐ Falso`);
    case "pregunta_completar": return caja(`<b>${esc(c.enunciado)}</b><br>Respuesta: ______________________________`);
    case "abierta": return caja(`<b>${esc(c.enunciado)}</b><div class="lineas"></div>${c.pide_enlace ? "<div>Enlace: ______________________________</div>" : ""}`);
    case "tabla": return `${c.titulo ? `<b>${esc(c.titulo)}</b>` : ""}<table><thead><tr>${(c.columnas || []).map((x) => `<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${(c.filas || []).map((f) => `<tr>${f.map((x) => `<td>${esc(x) || "&nbsp;<br>&nbsp;"}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    case "linea_tiempo": return `${c.titulo ? `<b>${esc(c.titulo)}</b>` : ""}<ul>${(c.eventos || []).map((e) => `<li><b>${esc(e.fecha)}</b> — ${esc(e.titulo)}${e.texto ? `: ${esc(e.texto)}` : ""}</li>`).join("")}</ul>`;
    case "mapa_mental": return caja(`🧠 <b>${esc(c.centro)}</b><ul>${(c.ramas || []).map((r) => `<li><b>${esc(r.texto)}</b><ul>${String(r.hijos || "").split("\n").filter((h) => h.trim()).map((h) => `<li>${esc(h)}</li>`).join("")}</ul></li>`).join("")}</ul>`);
    case "caso": return caja(`⚖️ <b>${esc(c.titulo || "Caso")}</b>${c.situacion || ""}${String(c.preguntas || "").split("\n").filter((q) => q.trim()).map((q, i) => `<p><b>${i + 1}. ${esc(q)}</b></p><div class="lineas"></div>`).join("")}`);
    case "glosario": return `<b>${esc(c.titulo || "Glosario")}</b><table><tbody>${(c.terminos || []).filter((t) => t.termino).map((t) => `<tr><td style="width:28%"><b>${esc(t.termino)}</b></td><td>${esc(t.definicion)}</td></tr>`).join("")}</tbody></table>`;
    case "flashcards": return `<b>${esc(c.titulo || "Tarjetas")}</b><table><tbody>${(c.tarjetas || []).map((t) => `<tr><td style="width:40%">${esc(t.frente)}</td><td>${esc(t.reverso)}</td></tr>`).join("")}</tbody></table>`;
    case "cita": return `<blockquote>“${esc(c.texto)}”${c.autor ? `<br><b>— ${esc(c.autor)}</b>` : ""}</blockquote>`;
    case "sabias": return caja(`💡 <b>¿Sabías que…?</b> ${esc(c.texto)}`);
    case "rubrica": return `<b>${esc(c.titulo || "Mi autoevaluación")}</b><table><thead><tr><th>Criterio</th><th>Logrado</th><th>En proceso</th><th>Por mejorar</th></tr></thead><tbody>${(c.criterios || []).filter((x) => x.criterio).map((x) => `<tr><td>${esc(x.criterio)}</td><td>☐</td><td>☐</td><td>☐</td></tr>`).join("")}</tbody></table>`;
    default: return "";
  }
}

export const resumenBloque = (b) => {
  const c = b.contenido || {};
  const plano = (h) => String(h || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const t = c.enunciado || c.texto || c.titulo || c.centro || plano(c.html) || c.pie || c.nombre || c.url || plano(c.situacion) || "";
  return String(t).slice(0, 90);
};
