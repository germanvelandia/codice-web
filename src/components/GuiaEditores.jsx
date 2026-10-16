import React, { useState } from "react";
import { EditorTexto } from "./RichText";
import { AREAS, temaArea } from "../lib/guiaDoc";

// Editores de las partes "estructuradas" de la guía: teoría por área y actividades con puntos y evidencia.
// Cada uno recibe la lista y devuelve la lista nueva con onCambiar. Al mover o quitar se vuelve a montar
// (ver) para que los editores de texto muestren el contenido correcto.

const NOMBRES_AREAS = [...new Set(AREAS.filter((a) => a.clave !== "general").map((a) => a.nombre))];

function SelectorArea({ value, onChange }) {
  const t = temaArea(value);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-lg" title={t.nombre}>{t.emoji}</span>
      <input list="guia-areas" value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="Área (ej: Matemáticas)"
        className="w-44 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" style={{ borderColor: t.color }} />
      <datalist id="guia-areas">{NOMBRES_AREAS.map((n) => <option key={n} value={n} />)}</datalist>
    </div>
  );
}

function Controles({ i, n, mover, quitar }) {
  return (
    <div className="flex items-center gap-1 ml-auto shrink-0">
      <button type="button" disabled={i === 0} onClick={() => mover(i, -1)} className="text-xs text-slate-400 hover:text-violet-600 disabled:opacity-30" title="Subir">↑</button>
      <button type="button" disabled={i === n - 1} onClick={() => mover(i, 1)} className="text-xs text-slate-400 hover:text-violet-600 disabled:opacity-30" title="Bajar">↓</button>
      <button type="button" onClick={() => quitar(i)} className="text-xs text-slate-400 hover:text-rose-500" title="Quitar">🗑</button>
    </div>
  );
}

const usarLista = (lista, onCambiar) => {
  const [ver, setVer] = useState(0);
  const cambiar = (nueva, remontar) => { onCambiar(nueva); if (remontar) setVer((v) => v + 1); };
  return {
    ver,
    actualizar: (i, campos) => cambiar(lista.map((x, k) => (k === i ? { ...x, ...campos } : x))),
    agregar: (nuevo) => cambiar([...lista, nuevo]),
    quitar: (i) => { if (confirm("¿Quitar este bloque?")) cambiar(lista.filter((_, k) => k !== i), true); },
    mover: (i, d) => { const j = i + d; if (j < 0 || j >= lista.length) return; const c = [...lista]; [c[i], c[j]] = [c[j], c[i]]; cambiar(c, true); },
  };
};

// 3.x · Teoría por área (cada bloque con su color y emoji)
export function TeoriaEditor({ lista, onCambiar }) {
  const L = usarLista(lista, onCambiar);
  return (
    <div className="space-y-2 mb-2">
      {lista.map((t, i) => {
        const a = temaArea(t.area || t.titulo);
        return (
          <div key={`${L.ver}-${i}`} className="bg-white rounded-xl border-2 p-2.5" style={{ borderColor: a.color }}>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[11px] font-bold text-white rounded-full px-2 py-0.5" style={{ background: a.color }}>3.{i + 1}</span>
              <SelectorArea value={t.area} onChange={(v) => L.actualizar(i, { area: v })} />
              <input value={t.titulo || ""} onChange={(e) => L.actualizar(i, { titulo: e.target.value })} placeholder="Título del tema (ej: costos, proporciones y geometría)"
                className="flex-1 min-w-[160px] text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
              <Controles i={i} n={lista.length} mover={L.mover} quitar={L.quitar} />
            </div>
            <EditorTexto value={t.contenido || ""} onChange={(v) => L.actualizar(i, { contenido: v })} minHeight={80} placeholder="Explicación, ejemplos, fórmulas, tablas…" />
          </div>
        );
      })}
      <button type="button" onClick={() => L.agregar({ area: "", titulo: "", contenido: "" })} className="text-xs text-violet-500">+ Agregar tema por área</button>
    </div>
  );
}

// 4 · Actividades: tarjeta por actividad con situación, puntos y evidencia
export function ActividadesEditor({ lista, onCambiar }) {
  const L = usarLista(lista, onCambiar);
  const FASES = [["aplicacion", "✏️ Aplicación y análisis"], ["exploracion", "🔍 Exploración"], ["transferencia", "🚀 Transferencia"]];
  return (
    <div className="space-y-3 mb-2">
      {lista.map((a, i) => {
        const t = temaArea(a.area || a.titulo);
        const puntos = a.puntos || [];
        const setPuntos = (p) => L.actualizar(i, { puntos: p });
        return (
          <div key={`${L.ver}-${i}`} className="rounded-xl border-2 overflow-hidden bg-white" style={{ borderColor: t.color }}>
            <div className="flex flex-wrap items-center gap-2 px-2.5 py-2 text-white" style={{ background: t.color }}>
              <span className="font-bold text-sm">{t.emoji} Actividad {i + 1}</span>
              <Controles i={i} n={lista.length} mover={L.mover} quitar={L.quitar} />
            </div>
            <div className="p-2.5 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <SelectorArea value={a.area} onChange={(v) => L.actualizar(i, { area: v })} />
                <input value={a.titulo || ""} onChange={(e) => L.actualizar(i, { titulo: e.target.value })} placeholder="Título de la actividad"
                  className="flex-1 min-w-[160px] text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
                <select value={a.fase || "aplicacion"} onChange={(e) => L.actualizar(i, { fase: e.target.value })} className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
                  {FASES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="bg-sky-50 rounded-lg p-2">
                <input value={a.intro_titulo || ""} onChange={(e) => L.actualizar(i, { intro_titulo: e.target.value })} placeholder="🧭 Rótulo del recuadro (Situación, Caso, Texto para analizar, Lectura de apoyo…)"
                  className="w-full text-xs font-semibold rounded-lg px-2 py-1.5 mb-1.5 border border-slate-200 outline-none bg-white" />
                <EditorTexto value={a.situacion || ""} onChange={(v) => L.actualizar(i, { situacion: v })} minHeight={60} placeholder="Situación, caso, texto o lectura que da contexto a la actividad…" />
              </div>
              {puntos.map((p, j) => (
                <div key={`${L.ver}-${i}-${j}`} className="border-l-4 pl-2" style={{ borderColor: t.color }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold text-white rounded px-1.5 py-0.5" style={{ background: t.color }}>Punto {j + 1}</span>
                    <input value={p.titulo || ""} onChange={(e) => setPuntos(puntos.map((x, k) => (k === j ? { ...x, titulo: e.target.value } : x)))} placeholder="Título del punto"
                      className="flex-1 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
                    <button type="button" onClick={() => { if (confirm("¿Quitar este punto?")) { setPuntos(puntos.filter((_, k) => k !== j)); } }} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
                  </div>
                  <EditorTexto value={p.contenido || ""} onChange={(v) => setPuntos(puntos.map((x, k) => (k === j ? { ...x, contenido: v } : x)))} minHeight={60} placeholder="Preguntas, ejercicios, cuadros para completar…" />
                </div>
              ))}
              <button type="button" onClick={() => setPuntos([...puntos, { titulo: "", contenido: "" }])} className="text-xs text-violet-500">+ Agregar punto</button>
              <div className="bg-emerald-50 rounded-lg p-2">
                <label className="text-[11px] font-semibold text-emerald-700 block mb-1">📦 Evidencia que debe entregar el estudiante</label>
                <textarea value={a.evidencia || ""} onChange={(e) => L.actualizar(i, { evidencia: e.target.value })} rows={2} placeholder="Ej: operaciones completas, dibujo a escala y explicación…"
                  className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
              </div>
            </div>
          </div>
        );
      })}
      <button type="button" onClick={() => L.agregar({ fase: "aplicacion", area: "", titulo: "", intro_titulo: "Situación", situacion: "", puntos: [{ titulo: "", contenido: "" }], evidencia: "" })} className="text-xs font-semibold text-violet-600 border border-dashed border-violet-300 rounded-lg px-3 py-1.5">+ Agregar actividad</button>
    </div>
  );
}
