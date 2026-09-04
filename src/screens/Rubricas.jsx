import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

function RubricaCatalogoForm({ rubrica, onCancelar, onGuardado }) {
  const NIVELES_INICIALES = () => [{ nombre: "Alto", puntos: 5 }, { nombre: "Medio", puntos: 3 }, { nombre: "Bajo", puntos: 1 }];
  const [nombre, setNombre] = useState(rubrica?.nombre || "");
  const [criterios, setCriterios] = useState(rubrica?.criterios?.length ? rubrica.criterios : [{ criterio: "", niveles: NIVELES_INICIALES() }]);
  const [guardando, setGuardando] = useState(false);

  const actualizarCriterio = (i, texto) => setCriterios((prev) => prev.map((c, idx) => idx === i ? { ...c, criterio: texto } : c));
  const actualizarNivel = (i, j, campo, valor) => setCriterios((prev) => prev.map((c, idx) => idx === i
    ? { ...c, niveles: c.niveles.map((n, k) => k === j ? { ...n, [campo]: campo === "puntos" ? parseFloat(valor) || 0 : valor } : n) }
    : c));
  const agregarCriterio = () => setCriterios((prev) => [...prev, { criterio: "", niveles: NIVELES_INICIALES() }]);
  const quitarCriterio = (i) => setCriterios((prev) => prev.filter((_, idx) => idx !== i));
  const agregarNivel = (i) => setCriterios((prev) => prev.map((c, idx) => idx === i ? { ...c, niveles: [...c.niveles, { nombre: "Nuevo nivel", puntos: 0 }] } : c));
  const quitarNivel = (i, j) => setCriterios((prev) => prev.map((c, idx) => {
    if (idx !== i) return c;
    if (c.niveles.length <= 1) { alert("Cada criterio necesita al menos un nivel."); return c; }
    return { ...c, niveles: c.niveles.filter((_, k) => k !== j) };
  }));

  const guardar = async () => {
    if (!nombre.trim()) { alert("Ponele un nombre a la rúbrica (ej: 'Ensayo argumentativo')."); return; }
    const limpios = criterios.filter((c) => c.criterio.trim());
    if (limpios.length === 0) { alert("Agregá al menos un criterio."); return; }
    setGuardando(true);
    try {
      if (rubrica) await api.editarRubricaCatalogo(rubrica.id, { nombre: nombre.trim(), criterios: limpios });
      else await api.crearRubricaCatalogo(nombre.trim(), limpios);
      onGuardado();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-2xl p-4 mb-4">
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la rúbrica (ej: Ensayo argumentativo)"
        className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none bg-white" />

      <div className="space-y-3 mb-3">
        {criterios.map((c, i) => (
          <div key={i} className="border border-slate-200 rounded-xl p-3 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <input value={c.criterio} onChange={(e) => actualizarCriterio(i, e.target.value)} placeholder="Criterio a evaluar (ej: Ortografía)"
                className="flex-1 text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
              <button onClick={() => quitarCriterio(i)} className="text-slate-300 hover:text-rose-500">🗑</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {c.niveles.map((n, j) => (
                <div key={j} className="bg-slate-50 rounded-lg p-2 relative" style={{ width: 110 }}>
                  <button onClick={() => quitarNivel(i, j)} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-400 text-white text-[9px] flex items-center justify-center" title="Quitar este nivel">✕</button>
                  <input value={n.nombre} onChange={(e) => actualizarNivel(i, j, "nombre", e.target.value)}
                    className="w-full text-xs font-semibold rounded px-1 py-1 border border-slate-200 outline-none mb-1" />
                  <input type="number" value={n.puntos} onChange={(e) => actualizarNivel(i, j, "puntos", e.target.value)}
                    className="w-full text-xs rounded px-1 py-1 border border-slate-200 outline-none" placeholder="Puntos" />
                </div>
              ))}
              <button onClick={() => agregarNivel(i)} className="text-xs text-violet-500 border border-dashed border-violet-300 rounded-lg px-3" style={{ width: 110 }}>
                + Nivel
              </button>
            </div>
          </div>
        ))}
        <button onClick={agregarCriterio} className="text-xs text-violet-500">+ Agregar criterio</button>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : rubrica ? "Guardar cambios" : "Crear rúbrica"}
        </button>
      </div>
    </div>
  );
}

export function VistaRubricas() {
  const [rubricas, setRubricas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);

  const cargar = () => { setCargando(true); api.fetchRubricasCatalogo().then((d) => { setRubricas(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  const eliminar = async (r) => {
    if (!confirm(`¿Eliminar la rúbrica "${r.nombre}"? Las tareas que ya la usan conservan su copia, esto solo la saca del catálogo para reutilizar.`)) return;
    await api.eliminarRubricaCatalogo(r.id);
    cargar();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🎯 Rúbricas</h2>
          <p className="text-sm text-slate-400">Armá tus rúbricas una sola vez acá, y después cargalas en cualquier proyecto o taller de La Forja.</p>
        </div>
        <button onClick={() => { setEditando(null); setFormAbierto((v) => !v); }} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white shrink-0">
          {formAbierto ? "Cerrar" : "+ Nueva rúbrica"}
        </button>
      </div>

      {formAbierto && (
        <RubricaCatalogoForm rubrica={editando} onCancelar={() => { setFormAbierto(false); setEditando(null); }}
          onGuardado={() => { setFormAbierto(false); setEditando(null); cargar(); }} />
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : rubricas.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">Todavía no tenés rúbricas guardadas.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {rubricas.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-100 p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-slate-800">{r.nombre}</h4>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => { setEditando(r); setFormAbierto(true); }} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
                  <button onClick={() => eliminar(r)} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
                </div>
              </div>
              <div className="space-y-1">
                {r.criterios.map((c, i) => (
                  <div key={i} className="text-xs text-slate-500">
                    <b>{c.criterio}</b> — {c.niveles.map((n) => `${n.nombre} (${n.puntos})`).join(", ")}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
