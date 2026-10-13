import React, { useState } from "react";
import { TIPOS_BLOQUE, ESTILOS_DESTACADO, bloqueVacio, MAX_BLOQUES, normalizarBloque, errorBloque, avisoBloque, resumenLeccion } from "../lib/leccion";
import { LeccionVista } from "./LeccionVista";

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

function CamposBloque({ b, set }) {
  switch (b.tipo) {
    case "texto": return (<><Txt v={b.titulo} set={(v) => set({ titulo: v })} etiqueta="Título (opcional)" max={120} /><Txt v={b.contenido} set={(v) => set({ contenido: v })} etiqueta="Texto" area={6} max={4000} ph={"Párrafos separados por una línea en blanco.\n## Subtítulo\n- Lista con guiones\n**Negrita**"} /></>);
    case "destacado": return (<>
      <Campo etiqueta="Tipo de recuadro"><select value={b.estilo} onChange={(e) => set({ estilo: e.target.value })} className={input} aria-label="Tipo de recuadro">{Object.entries(ESTILOS_DESTACADO).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.nombre}</option>)}</select></Campo>
      <Txt v={b.titulo} set={(v) => set({ titulo: v })} etiqueta="Título (opcional)" max={120} /><Txt v={b.contenido} set={(v) => set({ contenido: v })} etiqueta="Contenido" area={3} max={900} /><Txt v={b.fuente} set={(v) => set({ fuente: v })} etiqueta="Fuente (opcional, ej.: Mateo 5,3-12)" max={120} /></>);
    case "imagen": return (<><Txt v={b.url} set={(v) => set({ url: v })} etiqueta="Dirección de la imagen (https://…)" max={500} /><Txt v={b.descripcion} set={(v) => set({ descripcion: v })} etiqueta="Descripción de la imagen" max={300} /><Txt v={b.pie} set={(v) => set({ pie: v })} etiqueta="Pie de foto (opcional)" max={300} /></>);
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
    default: return null;
  }
}
function resumenBloque(b) {
  const x = { texto: b.contenido, destacado: b.contenido, imagen: b.descripcion || b.url, video: b.titulo || b.url, tarjetas: `${b.tarjetas?.length || 0} tarjetas`, descubre: `${b.items?.length || 0} secciones`, pasos: `${b.pasos?.length || 0} pasos`, pregunta: b.pregunta, reflexion: b.consigna, enlace: b.texto, sopa: Array.isArray(b.palabras) ? b.palabras.join(", ") : b.palabras, crucigrama: `${b.entradas?.length || 0} palabras`, criptograma: b.frase }[b.tipo];
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
