import React, { useRef, useState } from "react";
import { TIPOS_BLOQUE, ESTILOS_DESTACADO, bloqueVacio, MAX_BLOQUES, normalizarBloque, errorBloque, avisoBloque, resumenLeccion } from "../lib/leccion";
import { LeccionVista } from "./LeccionVista";
import { subirImagenLeccion } from "../lib/imagenesLeccion";

const input = "w-full text-sm rounded-lg px-2.5 py-1.5 border border-slate-200 outline-none bg-white";
const Campo = ({ etiqueta, children }) => <div className="mb-2"><label className="text-[11px] text-slate-500 block mb-1">{etiqueta}</label>{children}</div>;
const Txt = ({ v, set, etiqueta, max = 300, ph = "", area = 0 }) => <Campo etiqueta={etiqueta}>{area ? <textarea rows={area} maxLength={max} value={v ?? ""} placeholder={ph} onChange={(e) => set(e.target.value)} className={input} aria-label={etiqueta} /> : <input value={v ?? ""} maxLength={max} placeholder={ph} onChange={(e) => set(e.target.value)} className={input} aria-label={etiqueta} />}</Campo>;
// editor de una lista de elementos (tarjetas, pasos, secciones, palabras del crucigrama…)
function Lista({ items, vacio, max, min = 2, nuevo, render, etiquetaItem }) {
  return (
    <div>
      {items.value.map((it, i) => (
        <div key={i} className="rounded-lg border border-slate-200 bg-white p-2 mb-2">
          <div className="flex items-center justify-between mb-1"><span className="text-[11px] font-semibold text-slate-500">{etiquetaItem} {i + 1}</span>
            <button type="button" disabled={items.value.length <= min} onClick={() => items.set(items.value.filter((_, k) => k !== i))} className="text-[11px] text-slate-400 hover:text-rose-500 disabled:opacity-30" aria-label={`Quitar ${etiquetaItem.toLowerCase()} ${i + 1}`}>🗑</button></div>
          {render(it, (patch) => items.set(items.value.map((x, k) => (k === i ? { ...x, ...patch } : x))), i)}
        </div>
      ))}
      {items.value.length < max && <button type="button" onClick={() => items.set([...items.value, nuevo()])} className="text-[11px] font-semibold text-violet-600" data-testid="agregar-elemento">+ Agregar {etiquetaItem.toLowerCase()}</button>}
    </div>
  );
}

// Botón para elegir una imagen del dispositivo (se reduce y se sube sola); entrega la dirección con onUrl
function SubirImagen({ onUrl }) {
  const [estado, setEstado] = useState("");   // "" | "subiendo" | "ok" | mensaje de error
  const elegir = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    setEstado("subiendo");
    try { onUrl(await subirImagenLeccion(f)); setEstado("ok"); } catch (er) { setEstado(er.message || "No se pudo subir la imagen."); }
  };
  return (
    <div className="mb-2">
      <label className={`inline-block text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-violet-300 text-violet-700 bg-white ${estado === "subiendo" ? "opacity-60" : "cursor-pointer"}`}>
        {estado === "subiendo" ? "Subiendo…" : "📁 Subir una imagen desde mi dispositivo"}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" disabled={estado === "subiendo"} onChange={elegir} data-testid="subir-imagen" aria-label="Subir imagen" />
      </label>
      {estado === "ok" && <span className="text-[11px] text-emerald-600 ml-2" data-testid="imagen-subida">Imagen subida ✓</span>}
      {estado && estado !== "ok" && estado !== "subiendo" && <p className="text-[11px] text-rose-600 mt-1" data-testid="error-subida">{estado}</p>}
    </div>
  );
}
const lineasDe = (v) => (Array.isArray(v) ? v.map((x) => (x && typeof x === "object" ? x.texto : x)).join("\n") : String(v ?? ""));
// pregunta con 2 a 4 opciones (la usan la trivia y el laberinto)
function CamposPregunta({ p, set, nombre }) {
  return (<>
    <Txt v={p.pregunta} set={(v) => set({ pregunta: v })} etiqueta="Pregunta" area={2} max={400} />
    <p className="text-[11px] text-slate-500 mb-1">Marca la opción correcta (2 a 4 opciones):</p>
    {[0, 1, 2, 3].map((i) => <div key={i} className="flex items-center gap-2 mb-1"><input type="radio" name={nombre} checked={Number(p.correcta) === i} onChange={() => set({ correcta: i })} aria-label={`Correcta ${i + 1}`} /><input value={p.opciones?.[i] ?? ""} maxLength={150} onChange={(e) => set({ opciones: [0, 1, 2, 3].map((k) => (k === i ? e.target.value : p.opciones?.[k] ?? "")) })} placeholder={`Opción ${i + 1}`} className={input} aria-label={`Opción ${i + 1}`} /></div>)}
    <Txt v={p.explicacion} set={(v) => set({ explicacion: v })} etiqueta="Explicación (opcional)" area={2} max={600} /></>);
}
// diagrama: se ve la imagen y se toca donde va cada punto
function EditorDiagrama({ b, set }) {
  const [ubicando, setUbicando] = useState(null); const [roto, setRoto] = useState(false);
  const ets = b.etiquetas || [];
  const up = (i, patch) => set({ etiquetas: ets.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
  const clic = (e) => { if (ubicando == null) return; const r = e.currentTarget.getBoundingClientRect(); up(ubicando, { x: Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100))), y: Math.round(Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100))) }); setUbicando(null); };
  return (<>
    <Txt v={b.titulo} set={(v) => set({ titulo: v })} etiqueta="Título (opcional)" max={120} />
    <SubirImagen onUrl={(u) => { setRoto(false); set({ url: u }); }} />
    <Txt v={b.url} set={(v) => { setRoto(false); set({ url: v }); }} etiqueta="…o pega la dirección de la imagen (https://…)" max={500} />
    {b.url && !roto && <div className={`relative mb-2 ${ubicando != null ? "cursor-crosshair ring-2 ring-amber-400 rounded-lg" : ""}`} onClick={clic} data-testid="diag-lienzo">
      <img src={b.url} alt="" className="w-full rounded-lg block" draggable={false} onError={() => setRoto(true)} />
      {ets.map((x, i) => <span key={i} style={{ left: `${Number(x.x) || 0}%`, top: `${Number(x.y) || 0}%`, transform: "translate(-50%,-50%)" }} className="absolute w-6 h-6 rounded-full bg-violet-600 border-2 border-white text-white text-[10px] font-bold flex items-center justify-center pointer-events-none">{i + 1}</span>)}
    </div>}
    {roto && <p className="text-[11px] text-rose-600 mb-2">No se pudo cargar la imagen: revisa la dirección.</p>}
    {ubicando != null && <p className="text-[11px] text-amber-700 mb-2">Toca en la imagen el lugar del punto {ubicando + 1}.</p>}
    <Lista etiquetaItem="Punto" items={{ value: ets, set: (v) => set({ etiquetas: v }) }} max={10} nuevo={() => ({ nombre: "", x: 50, y: 50 })} render={(t, upd, i) => (<div className="flex items-center gap-2"><input value={t.nombre} maxLength={40} onChange={(e) => upd({ nombre: e.target.value })} placeholder="Nombre de la parte" className={input} aria-label="Nombre del punto" /><button type="button" onClick={() => setUbicando(ubicando === i ? null : i)} className="text-[11px] font-semibold text-violet-600 whitespace-nowrap" data-testid={`ubicar-${i}`}>📍 Ubicar</button></div>)} /></>);
}
// completar: se puede seleccionar una palabra del texto y convertirla en hueco
function EditorCompletar({ b, set }) {
  const ref = useRef(null);
  const marcar = () => { const el = ref.current; if (!el) return; const a = el.selectionStart, z = el.selectionEnd; if (a === z) return; const t = b.texto || ""; set({ texto: t.slice(0, a) + "[[" + t.slice(a, z).trim() + "]]" + t.slice(z) }); };
  return (<>
    <Txt v={b.titulo} set={(v) => set({ titulo: v })} etiqueta="Título (opcional)" max={120} />
    <Campo etiqueta="Texto (las palabras que faltan van entre [[dobles corchetes]])"><textarea ref={ref} rows={5} maxLength={1500} value={b.texto ?? ""} onChange={(e) => set({ texto: e.target.value })} className={input} aria-label="Texto con espacios" placeholder="Dios es [[amor]] y nos pide [[servir|servicio]] a los demás." /></Campo>
    <button type="button" onClick={marcar} className="text-[11px] font-semibold text-violet-600 mb-2" data-testid="marcar-hueco">✂️ Convertir en espacio lo que tengo seleccionado</button>
    <p className="text-[11px] text-slate-500 mb-2">Con «|» aceptas varias respuestas: [[servir|servicio]].</p>
    <Campo etiqueta="¿Cómo responde el estudiante?"><select value={b.modo} onChange={(e) => set({ modo: e.target.value })} className={input} aria-label="Modo"><option value="banco">Elige de un banco de palabras</option><option value="escribir">Escribe la palabra</option></select></Campo>
    {b.modo !== "escribir" && <Txt v={lineasDe(b.distractores).split("\n").join(", ")} set={(v) => set({ distractores: v })} etiqueta="Palabras de relleno que no van (separadas por comas, opcional)" max={300} />}</>);
}

function CamposBloque({ b, set }) {
  switch (b.tipo) {
    case "texto": return (<><Txt v={b.titulo} set={(v) => set({ titulo: v })} etiqueta="Título (opcional)" max={120} /><Txt v={b.contenido} set={(v) => set({ contenido: v })} etiqueta="Texto" area={6} max={4000} ph={"Párrafos separados por una línea en blanco.\n## Subtítulo\n- Lista con guiones\n**Negrita**"} /></>);
    case "destacado": return (<>
      <Campo etiqueta="Tipo de recuadro"><select value={b.estilo} onChange={(e) => set({ estilo: e.target.value })} className={input} aria-label="Tipo de recuadro">{Object.entries(ESTILOS_DESTACADO).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.nombre}</option>)}</select></Campo>
      <Txt v={b.titulo} set={(v) => set({ titulo: v })} etiqueta="Título (opcional)" max={120} /><Txt v={b.contenido} set={(v) => set({ contenido: v })} etiqueta="Contenido" area={3} max={900} /><Txt v={b.fuente} set={(v) => set({ fuente: v })} etiqueta="Fuente (opcional, ej.: Mateo 5,3-12)" max={120} /></>);
    case "imagen": return (<><SubirImagen onUrl={(u) => set({ url: u })} /><Txt v={b.url} set={(v) => set({ url: v })} etiqueta="…o pega la dirección de la imagen (https://…)" max={500} />{b.url && <img src={b.url} alt="" className="w-full max-h-48 object-contain rounded-lg border border-slate-200 bg-white mb-2" data-testid="miniatura" />}<Txt v={b.descripcion} set={(v) => set({ descripcion: v })} etiqueta="Descripción de la imagen" max={300} /><Txt v={b.pie} set={(v) => set({ pie: v })} etiqueta="Pie de foto (opcional)" max={300} /></>);
    case "video": return (<><Txt v={b.url} set={(v) => set({ url: v })} etiqueta="Dirección del video (YouTube, Vimeo u otra)" max={500} /><Txt v={b.titulo} set={(v) => set({ titulo: v })} etiqueta="Título (opcional)" max={120} /></>);
    case "tarjetas": return (<><Txt v={b.titulo} set={(v) => set({ titulo: v })} etiqueta="Título (opcional)" max={120} />
      <Lista etiquetaItem="Tarjeta" items={{ value: b.tarjetas, set: (v) => set({ tarjetas: v }) }} max={12} nuevo={() => ({ frente: "", reverso: "" })} render={(t, up) => (<><Txt v={t.frente} set={(v) => up({ frente: v })} etiqueta="Por delante (término)" max={120} /><Txt v={t.reverso} set={(v) => up({ reverso: v })} etiqueta="Por detrás (significado)" max={300} area={2} /></>)} /></>);
    case "descubre": return (<><Txt v={b.titulo} set={(v) => set({ titulo: v })} etiqueta="Título (opcional)" max={120} />
      <Lista etiquetaItem="Sección" items={{ value: b.items, set: (v) => set({ items: v }) }} max={10} nuevo={() => ({ titulo: "", contenido: "" })} render={(t, up) => (<><Txt v={t.titulo} set={(v) => up({ titulo: v })} etiqueta="Título que se toca" max={120} /><Txt v={t.contenido} set={(v) => up({ contenido: v })} etiqueta="Lo que se descubre" max={1500} area={3} /></>)} /></>);
    case "pasos": return (<><Txt v={b.titulo} set={(v) => set({ titulo: v })} etiqueta="Título (opcional)" max={120} />
      <Lista etiquetaItem="Paso" items={{ value: b.pasos, set: (v) => set({ pasos: v }) }} max={10} nuevo={() => ({ titulo: "", contenido: "" })} render={(t, up) => (<><Txt v={t.titulo} set={(v) => up({ titulo: v })} etiqueta="Título del paso" max={120} /><Txt v={t.contenido} set={(v) => up({ contenido: v })} etiqueta="Explicación" max={1000} area={2} /></>)} /></>);
    case "pregunta": return (<>
      <Txt v={b.pregunta} set={(v) => set({ pregunta: v })} etiqueta="Pregunta" area={2} max={400} />
      <p className="text-[11px] text-slate-500 mb-1">Marca la opción correcta (2 a 4 opciones):</p>
      {[0, 1, 2, 3].map((i) => <div key={i} className="flex items-center gap-2 mb-1"><input type="radio" name={`c-${b.id}`} checked={Number(b.correcta) === i} onChange={() => set({ correcta: i })} aria-label={`Correcta ${i + 1}`} /><input value={b.opciones[i] ?? ""} maxLength={150} onChange={(e) => set({ opciones: [0, 1, 2, 3].map((k) => (k === i ? e.target.value : b.opciones[k] ?? "")) })} placeholder={`Opción ${i + 1}`} className={input} aria-label={`Opción ${i + 1}`} /></div>)}
      <Txt v={b.explicacion} set={(v) => set({ explicacion: v })} etiqueta="Explicación que se muestra al acertar (opcional)" area={2} max={600} /></>);
    case "reflexion": return (<><Txt v={b.consigna} set={(v) => set({ consigna: v })} etiqueta="Consigna" area={2} max={600} ph="¿Qué te dice este tema para tu vida?" /><Txt v={b.ayuda} set={(v) => set({ ayuda: v })} etiqueta="Ayuda para empezar (opcional)" max={300} /></>);
    case "enlace": return (<><Txt v={b.texto} set={(v) => set({ texto: v })} etiqueta="Texto del botón" max={80} /><Txt v={b.url} set={(v) => set({ url: v })} etiqueta="Dirección (https://…)" max={500} /><Txt v={b.descripcion} set={(v) => set({ descripcion: v })} etiqueta="Descripción (opcional)" max={300} /></>);
    case "sopa": return (<><Txt v={b.titulo} set={(v) => set({ titulo: v })} etiqueta="Título (opcional)" max={120} /><Txt v={Array.isArray(b.palabras) ? b.palabras.join(", ") : b.palabras} set={(v) => set({ palabras: v })} etiqueta="Palabras (separadas por comas; de 3 a 14 letras)" area={2} max={400} ph="PAZ, RESPETO, JUSTICIA, AMOR" /></>);
    case "crucigrama": return (<><Txt v={b.titulo} set={(v) => set({ titulo: v })} etiqueta="Título (opcional)" max={120} />
      <p className="text-[11px] text-slate-500 mb-1">Escribe de 4 a 10 palabras (sin espacios) que compartan letras entre sí, cada una con su pista. El crucigrama se arma solo.</p>
      <Lista etiquetaItem="Palabra" min={3} items={{ value: b.entradas, set: (v) => set({ entradas: v }) }} max={12} nuevo={() => ({ palabra: "", pista: "" })} render={(t, up) => (<div className="grid grid-cols-[1fr_2fr] gap-2"><input value={t.palabra} maxLength={14} onChange={(e) => up({ palabra: e.target.value })} placeholder="PALABRA" className={input} aria-label="Palabra del crucigrama" /><input value={t.pista} maxLength={160} onChange={(e) => up({ pista: e.target.value })} placeholder="Pista" className={input} aria-label="Pista del crucigrama" /></div>)} /></>);
    case "criptograma": return (<><Txt v={b.titulo} set={(v) => set({ titulo: v })} etiqueta="Título (opcional)" max={120} /><Txt v={b.frase} set={(v) => set({ frase: v })} etiqueta="Frase secreta (8 a 100 letras)" area={2} max={160} ph="La paz comienza en ti" /><Txt v={b.pista} set={(v) => set({ pista: v })} etiqueta="Pista (opcional)" max={160} /></>);
    case "unir": return (<><Txt v={b.titulo} set={(v) => set({ titulo: v })} etiqueta="Título (opcional)" max={120} />
      <Lista etiquetaItem="Pareja" items={{ value: b.pares, set: (v) => set({ pares: v }) }} max={8} nuevo={() => ({ izq: "", der: "" })} render={(t, up) => (<div className="grid grid-cols-2 gap-2"><input value={t.izq} maxLength={120} onChange={(e) => up({ izq: e.target.value })} placeholder="Columna izquierda" className={input} aria-label="Izquierda" /><input value={t.der} maxLength={120} onChange={(e) => up({ der: e.target.value })} placeholder="Su pareja (derecha)" className={input} aria-label="Derecha" /></div>)} /></>);
    case "clasificar": return (<><Txt v={b.titulo} set={(v) => set({ titulo: v })} etiqueta="Título (opcional)" max={120} />
      <Lista etiquetaItem="Categoría" items={{ value: b.categorias, set: (v) => set({ categorias: v }) }} max={4} nuevo={() => ({ nombre: "", elementos: "" })} render={(t, up) => (<><Txt v={t.nombre} set={(v) => up({ nombre: v })} etiqueta="Nombre de la categoría" max={60} /><Txt v={lineasDe(t.elementos)} set={(v) => up({ elementos: v })} etiqueta="Elementos que pertenecen (uno por línea)" area={3} max={800} /></>)} /></>);
    case "memorama": return (<><Txt v={b.titulo} set={(v) => set({ titulo: v })} etiqueta="Título (opcional)" max={120} />
      <Lista etiquetaItem="Pareja" items={{ value: b.parejas, set: (v) => set({ parejas: v }) }} max={8} nuevo={() => ({ a: "", b: "" })} render={(t, up) => (<div className="grid grid-cols-2 gap-2"><input value={t.a} maxLength={60} onChange={(e) => up({ a: e.target.value })} placeholder="Carta 1" className={input} aria-label="Carta 1" /><input value={t.b} maxLength={60} onChange={(e) => up({ b: e.target.value })} placeholder="Carta 2 (su pareja)" className={input} aria-label="Carta 2" /></div>)} /></>);
    case "diagrama": return <EditorDiagrama b={b} set={set} />;
    case "completar": return <EditorCompletar b={b} set={set} />;
    case "anagrama": return (<><Txt v={b.titulo} set={(v) => set({ titulo: v })} etiqueta="Título (opcional)" max={120} />
      <Campo etiqueta="¿Qué se ordena?"><select value={b.modo} onChange={(e) => set({ modo: e.target.value })} className={input} aria-label="Modo del anagrama"><option value="letras">Las letras de una palabra</option><option value="frase">Las palabras de una oración</option></select></Campo>
      <Lista etiquetaItem={b.modo === "frase" ? "Oración" : "Palabra"} min={1} items={{ value: b.items, set: (v) => set({ items: v }) }} max={8} nuevo={() => ({ texto: "", pista: "" })} render={(t, up) => (<div className="grid grid-cols-[1fr_1fr] gap-2"><input value={t.texto} maxLength={b.modo === "frase" ? 160 : 30} onChange={(e) => up({ texto: e.target.value })} placeholder={b.modo === "frase" ? "Amarás a tu prójimo" : "RESPETO"} className={input} aria-label="Texto a ordenar" /><input value={t.pista} maxLength={160} onChange={(e) => up({ pista: e.target.value })} placeholder="Pista (opcional)" className={input} aria-label="Pista" /></div>)} /></>);
    case "linea": case "jerarquia": return (<><Txt v={b.titulo} set={(v) => set({ titulo: v })} etiqueta="Título (opcional)" max={120} />
      <p className="text-[11px] text-slate-500 mb-1">Escribe los elementos YA en el orden correcto; al estudiante se le muestran desordenados.</p>
      <div className="grid grid-cols-2 gap-2"><Txt v={b.inicio} set={(v) => set({ inicio: v })} etiqueta={b.tipo === "linea" ? "Rótulo del principio (ej.: Más antiguo)" : "Rótulo de arriba (ej.: Más importante)"} max={40} /><Txt v={b.fin} set={(v) => set({ fin: v })} etiqueta={b.tipo === "linea" ? "Rótulo del final (ej.: Más reciente)" : "Rótulo de abajo (ej.: Menos importante)"} max={40} /></div>
      <Lista etiquetaItem="Elemento" min={3} items={{ value: b.items, set: (v) => set({ items: v }) }} max={10} nuevo={() => ({ texto: "", etiqueta: "" })} render={(t, up) => (<div className="grid grid-cols-[2fr_1fr] gap-2"><input value={t.texto} maxLength={150} onChange={(e) => up({ texto: e.target.value })} placeholder="Elemento" className={input} aria-label="Elemento" /><input value={t.etiqueta} maxLength={30} onChange={(e) => up({ etiqueta: e.target.value })} placeholder="Año/dato (opcional)" className={input} aria-label="Dato" /></div>)} /></>);
    case "trivia": return (<><Txt v={b.titulo} set={(v) => set({ titulo: v })} etiqueta="Título (opcional)" max={120} />
      <Campo etiqueta="Segundos por pregunta (5 a 60)"><input type="number" min="5" max="60" value={b.segundos} onChange={(e) => set({ segundos: e.target.value })} className={input} aria-label="Segundos por pregunta" /></Campo>
      <Lista etiquetaItem="Pregunta" items={{ value: b.preguntas, set: (v) => set({ preguntas: v }) }} max={10} nuevo={() => ({ pregunta: "", opciones: ["", "", "", ""], correcta: 0, explicacion: "" })} render={(p, up, i) => <CamposPregunta p={p} set={up} nombre={`c-${b.id}-${i}`} />} /></>);
    case "ruleta": return (<><Txt v={b.titulo} set={(v) => set({ titulo: v })} etiqueta="Título (opcional)" max={120} /><Txt v={lineasDe(b.items)} set={(v) => set({ items: v })} etiqueta="Temas o preguntas de la ruleta (uno por línea, de 3 a 12)" area={6} max={1500} ph={"¿Qué es la paz?\nUn gesto de respeto\nCuenta una experiencia"} /></>);
    case "laberinto": return (<><Txt v={b.titulo} set={(v) => set({ titulo: v })} etiqueta="Título (opcional)" max={120} /><CamposPregunta p={b} set={set} nombre={`c-${b.id}`} />
      <Campo etiqueta="Enemigos que persiguen"><select value={b.enemigos} onChange={(e) => set({ enemigos: Number(e.target.value) })} className={input} aria-label="Enemigos"><option value={0}>Ninguno (sin presión)</option><option value={1}>1 enemigo</option><option value={2}>2 enemigos</option><option value={3}>3 enemigos</option></select></Campo></>);
    default: return null;
  }
}
function resumenBloque(b) {
  const x = { texto: b.contenido, destacado: b.contenido, imagen: b.descripcion || b.url, video: b.titulo || b.url, tarjetas: `${b.tarjetas?.length || 0} tarjetas`, descubre: `${b.items?.length || 0} secciones`, pasos: `${b.pasos?.length || 0} pasos`, pregunta: b.pregunta, reflexion: b.consigna, enlace: b.texto, sopa: Array.isArray(b.palabras) ? b.palabras.join(", ") : b.palabras, crucigrama: `${b.entradas?.length || 0} palabras`, criptograma: b.frase, unir: `${b.pares?.length || 0} parejas`, clasificar: `${b.categorias?.length || 0} categorías`, memorama: `${b.parejas?.length || 0} parejas`, diagrama: `${b.etiquetas?.length || 0} puntos`, completar: b.texto, anagrama: `${b.items?.length || 0} ${b.modo === "frase" ? "oraciones" : "palabras"}`, linea: `${b.items?.length || 0} eventos`, jerarquia: `${b.items?.length || 0} elementos`, trivia: `${b.preguntas?.length || 0} preguntas · ${b.segundos || 20} s`, ruleta: `${lineasDe(b.items).split("\n").filter(Boolean).length} opciones`, laberinto: b.pregunta }[b.tipo];
  return String(x || "").replace(/\s+/g, " ").slice(0, 70);
}

// Editor de la lección: título + bloques. valor = { titulo, bloques } · onChange(nuevoValor)
export function EditorLeccion({ valor, onChange }) {
  const [elegir, setElegir] = useState(false);
  const [abierto, setAbierto] = useState(null);
  const [previa, setPrevia] = useState(false);
  const bloques = valor.bloques || [];
  const poner = (bs) => onChange({ ...valor, bloques: bs });
  const set = (i, patch) => poner(bloques.map((b, k) => (k === i ? { ...b, ...patch } : b)));
  const mover = (i, d) => { const j = i + d; if (j < 0 || j >= bloques.length) return; const c = [...bloques]; [c[i], c[j]] = [c[j], c[i]]; poner(c); };
  const agregar = (tipo) => { const b = bloqueVacio(tipo); poner([...bloques, b]); setAbierto(b.id); setElegir(false); };
  const resumen = resumenLeccion(bloques);

  if (previa) {
    const limpios = bloques.map((b, i) => normalizarBloque(b, i)).filter((b) => b && !errorBloque(b));
    return (
      <div data-testid="vista-previa">
        <div className="flex items-center justify-between mb-3"><span className="text-xs font-bold text-violet-600">👁 Así la verá el estudiante (los botones no guardan nada)</span><button type="button" onClick={() => setPrevia(false)} className="text-xs text-slate-500 px-2 py-1" data-testid="cerrar-previa">Volver a editar</button></div>
        {bloques.length !== limpios.length && <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-3">{bloques.length - limpios.length} bloque(s) incompletos no aparecen en la vista previa.</p>}
        <LeccionVista actividad={{ id: 0, titulo: valor.titulo, bloques: limpios }} onGuardarReflexion={async () => ({ ok: true })} onTerminar={async () => {}} />
      </div>
    );
  }
  return (
    <div data-testid="editor-leccion">
      <Txt v={valor.titulo} set={(v) => onChange({ ...valor, titulo: v })} etiqueta="Título de la lección" max={160} />
      <div className="flex items-center justify-between mb-2"><span className="text-[11px] text-slate-500">{bloques.length} {bloques.length === 1 ? "bloque" : "bloques"}{resumen.pregunta ? ` · ${resumen.pregunta} ${resumen.pregunta === 1 ? "pregunta" : "preguntas"}` : ""}{resumen.reflexion ? ` · ${resumen.reflexion} ${resumen.reflexion === 1 ? "reflexión" : "reflexiones"}` : ""}</span>
        <button type="button" onClick={() => setPrevia(true)} disabled={!bloques.length} className="text-[11px] font-semibold text-violet-600 disabled:opacity-40" data-testid="ver-previa">👁 Vista previa</button></div>
      <div className="space-y-2 mb-3">
        {bloques.map((b, i) => {
          const t = TIPOS_BLOQUE[b.tipo]; if (!t) return null;
          const n = normalizarBloque(b, i), e = n ? errorBloque(n) : "Bloque no válido.", av = n && !e ? avisoBloque(n) : "", abiertoAqui = abierto === b.id;
          return (
            <div key={b.id} className={`rounded-xl border ${e ? "border-rose-200" : "border-slate-200"} bg-white`} data-testid={`bloque-${i}`} data-tipo={b.tipo}>
              <div className="flex items-center gap-1.5 px-3 py-2">
                <button type="button" onClick={() => setAbierto(abiertoAqui ? null : b.id)} className="flex-1 min-w-0 text-left" aria-label={`Abrir bloque ${i + 1}`}>
                  <div className="text-xs font-semibold text-slate-800">{t.emoji} {i + 1}. {t.nombre}</div>
                  <div className="text-[11px] text-slate-500 truncate">{resumenBloque(b) || "Vacío"}</div>
                  {e && <div className="text-[11px] text-rose-600">⚠️ {e}</div>}{av && <div className="text-[11px] text-amber-700">{av}</div>}
                </button>
                <button type="button" disabled={i === 0} onClick={() => mover(i, -1)} className="text-slate-400 disabled:opacity-30 text-xs" aria-label="Subir bloque">▲</button>
                <button type="button" disabled={i === bloques.length - 1} onClick={() => mover(i, 1)} className="text-slate-400 disabled:opacity-30 text-xs" aria-label="Bajar bloque">▼</button>
                <button type="button" onClick={() => { if (confirm("¿Quitar este bloque?")) poner(bloques.filter((_, k) => k !== i)); }} className="text-slate-400 hover:text-rose-500 text-xs" aria-label="Quitar bloque">🗑</button>
              </div>
              {abiertoAqui && <div className="border-t border-slate-100 p-3 bg-slate-50 rounded-b-xl"><CamposBloque b={b} set={(patch) => set(i, patch)} /></div>}
            </div>
          );
        })}
      </div>
      {elegir ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3" data-testid="elegir-bloque">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-bold text-slate-800">¿Qué quieres agregar?</span><button type="button" onClick={() => setElegir(false)} className="text-xs text-slate-500">Cancelar</button></div>
          <div className="grid sm:grid-cols-2 gap-2">{Object.entries(TIPOS_BLOQUE).map(([k, t]) => <button key={k} type="button" onClick={() => agregar(k)} className="text-left rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-violet-400" data-testid={`nuevo-${k}`}><div className="text-sm font-semibold text-slate-800">{t.emoji} {t.nombre}</div><div className="text-[11px] text-slate-500">{t.desc}</div></button>)}</div>
        </div>
      ) : bloques.length < MAX_BLOQUES ? <button type="button" onClick={() => setElegir(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-violet-200 text-violet-600" data-testid="agregar-bloque">+ Agregar bloque</button> : <p className="text-[11px] text-slate-500">Llegaste al máximo de {MAX_BLOQUES} bloques.</p>}
    </div>
  );
}
