import React, { useEffect, useRef, useState } from "react";
import { InsigniaNivel } from "./NivelPersonaje";
import { PERSONAJES_NIVEL } from "../lib/personajesNivel";
import { nivelesActuales, guardarNivelesPersonaje, NIVELES_POR_DEFECTO, MAX_NIVELES } from "../lib/configNiveles";

// Editor de los niveles del personaje: agregar, quitar y cambiar cuántas piezas pide cada
// uno, cómo se llama y cómo se ve (brillo y estrellas). Se carga aparte, solo al abrirlo.

const COLORES = [
  { nombre: "Sin brillo", valor: null },
  { nombre: "Bronce", valor: "#CD7F32" },
  { nombre: "Plata", valor: "#C0C8D0" },
  { nombre: "Oro", valor: "#FFC93C" },
  { nombre: "Esmeralda", valor: "#34D399" },
  { nombre: "Zafiro", valor: "#60A5FA" },
  { nombre: "Violeta", valor: "#A78BFA" },
  { nombre: "Rubí", valor: "#F87171" },
  { nombre: "Rosa", valor: "#F472B6" },
];
const ESTRELLAS = [{ valor: 0, nombre: "Ninguna" }, { valor: 1, nombre: "Blancas" }, { valor: 2, nombre: "Blancas y doradas" }];
const TOTAL_PERSONAJES = 14;

const copiar = (lista) => lista.map((n) => ({ ...n }));
// Versión "limpia" de un borrador (números de verdad, color vacío = null) para comparar y guardar.
const limpiar = (lista) => lista.map((n) => ({
  nombre: String(n.nombre ?? "").trim(), desde: parseInt(n.desde, 10), color: n.color || null, estrellas: Number(n.estrellas) || 0,
}));

function dibujosPropios(nivel) {
  let c = 0;
  Object.keys(PERSONAJES_NIVEL).forEach((rol) => Object.keys(PERSONAJES_NIVEL[rol]).forEach((g) => { if (PERSONAJES_NIVEL[rol][g][nivel]) c++; }));
  return c;
}

export default function EditorNivelesPersonaje({ cantidadPiezas = 0 }) {
  const [lista, setLista] = useState(() => copiar(nivelesActuales()));
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");
  const temporizador = useRef(null);
  useEffect(() => () => clearTimeout(temporizador.current), []);

  const guardado = limpiar(nivelesActuales());
  const hayCambios = JSON.stringify(limpiar(lista)) !== JSON.stringify(guardado);

  const cambiar = (i, campo, valor) => setLista((prev) => prev.map((n, k) => (k === i ? { ...n, [campo]: valor } : n)));

  const agregar = () => {
    if (lista.length >= MAX_NIVELES) return;
    const ultimo = lista[lista.length - 1];
    const usados = lista.map((n) => n.color);
    const color = (COLORES.find((c) => c.valor && !usados.includes(c.valor)) || { valor: ultimo.color }).valor;
    setLista([...lista, { nivel: lista.length + 1, nombre: `Nivel ${lista.length + 1}`, desde: (parseInt(ultimo.desde, 10) || 0) + 2, color, estrellas: ultimo.estrellas || 0 }]);
  };
  const quitarUltimo = () => { if (lista.length > 2) setLista(lista.slice(0, -1)); };
  const restaurar = () => {
    if (confirm("¿Volver a los 4 niveles originales (Novato, Aventurero, Veterano y Leyenda)? Se aplica cuando guardes.")) setLista(copiar(NIVELES_POR_DEFECTO));
  };

  const guardar = async () => {
    const b = limpiar(lista);
    for (let i = 0; i < b.length; i++) {
      if (!b[i].nombre) { alert(`El nivel ${i + 1} necesita un nombre.`); return; }
      if (isNaN(b[i].desde) || b[i].desde < 0) { alert(`Escribí cuántas piezas pide el nivel ${i + 1} (un número, 0 o más).`); return; }
      if (i > 0 && b[i].desde <= b[i - 1].desde) {
        alert(`El nivel ${i + 1} tiene que pedir MÁS piezas que el nivel ${i} (ahora pide ${b[i].desde} y el anterior ${b[i - 1].desde}).`);
        return;
      }
    }
    setGuardando(true);
    try {
      await guardarNivelesPersonaje(b);
      setLista(copiar(nivelesActuales()));
      setAviso("Guardado ✓");
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setAviso(""), 2500);
    } catch (e) {
      alert("No se pudo guardar: " + e.message + (/does not exist|relation/i.test(e.message) ? "\n\n¿Ya corriste el SQL 61_niveles_personaje.sql en Supabase?" : ""));
    }
    setGuardando(false);
  };

  const inputCls = "w-full text-sm rounded-lg px-2.5 py-1.5 border border-slate-200 outline-none bg-white";
  return (
    <div>
      <p className="text-xs text-slate-400 mb-3">
        El nivel de un personaje sube según cuántas piezas compró el estudiante. Acá definís cuántos niveles hay, cuántas piezas pide cada uno y cómo se ve.
        Los cambios se aplican a todos los estudiantes apenas guardes.
      </p>

      <div className="space-y-2 mb-3">
        {lista.map((n, i) => {
          const esUltimo = i === lista.length - 1;
          const desde = parseInt(n.desde, 10);
          const propios = i === 0 ? null : dibujosPropios(i + 1);
          const inalcanzable = cantidadPiezas > 0 && !isNaN(desde) && desde > cantidadPiezas;
          return (
            <div key={i} className="rounded-xl border border-slate-200 p-3 bg-white">
              <div className="flex items-center gap-2 mb-2">
                <div className="shrink-0"><InsigniaNivel nivel={i + 1} nombre={n.nombre} color={n.color} /></div>
                <input value={n.nombre} onChange={(e) => cambiar(i, "nombre", e.target.value)} placeholder="Nombre del nivel" className={inputCls} />
                {esUltimo && lista.length > 2 && (
                  <button type="button" onClick={quitarUltimo} className="text-[11px] font-semibold text-rose-600 shrink-0">Quitar</button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Piezas que pide</label>
                  <input type="number" min="0" value={i === 0 ? 0 : n.desde} disabled={i === 0} onChange={(e) => cambiar(i, "desde", e.target.value)} className={`${inputCls} ${i === 0 ? "bg-slate-50 text-slate-400" : ""}`} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Brillo</label>
                  <select value={n.color || ""} onChange={(e) => cambiar(i, "color", e.target.value || null)} className={inputCls}>
                    {COLORES.map((c) => <option key={c.nombre} value={c.valor || ""}>{c.nombre}</option>)}
                    {n.color && !COLORES.some((c) => c.valor === n.color) && <option value={n.color}>{n.color}</option>}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Estrellas</label>
                  <select value={n.estrellas || 0} onChange={(e) => cambiar(i, "estrellas", Number(e.target.value))} className={inputCls}>
                    {ESTRELLAS.map((e) => <option key={e.valor} value={e.valor}>{e.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-1.5 text-[10px] leading-snug">
                {i === 0 ? (
                  <span className="text-slate-400">Es el nivel de partida: se ve con el dibujo base, sin piezas.</span>
                ) : propios === TOTAL_PERSONAJES ? (
                  <span className="text-emerald-600 font-semibold">● {propios}/{TOTAL_PERSONAJES} personajes con dibujo propio en este nivel</span>
                ) : propios > 0 ? (
                  <span className="text-amber-600 font-semibold">● {propios}/{TOTAL_PERSONAJES} personajes con dibujo propio (el resto usa el del nivel anterior)</span>
                ) : (
                  <span className="text-slate-400">● Sin dibujos propios todavía: usa el dibujo del nivel anterior</span>
                )}
                {inalcanzable && (
                  <div className="text-amber-700 mt-0.5">⚠️ Tu catálogo tiene {cantidadPiezas} piezas activas, así que nadie podría llegar a este nivel (pide {desde}). Agregá piezas o bajá este número.</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={agregar} disabled={lista.length >= MAX_NIVELES}
          className="text-xs font-semibold px-3 py-2 rounded-full border border-violet-200 text-violet-700 disabled:opacity-40">+ Agregar nivel</button>
        <button type="button" onClick={restaurar} className="text-xs text-slate-500 px-2 py-2">Volver a los 4 originales</button>
        <div className="flex-1" />
        {aviso && <span className="text-xs font-semibold text-emerald-600">{aviso}</span>}
        <button type="button" onClick={guardar} disabled={!hayCambios || guardando}
          className="text-xs font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-40">
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
      <p className="text-[11px] text-slate-400 mt-3">
        Solo se puede quitar el último nivel (así los dibujos de cada nivel no se desalinean). Los dibujos propios de cada nivel se cargan aparte; un nivel nuevo usa el del anterior hasta entonces. Máximo {MAX_NIVELES} niveles.
      </p>
    </div>
  );
}
