// Gestión de grupos mixtos (estudiantes de varios grados en una sola planilla).
import React, { useEffect, useMemo, useState } from "react";
import * as gm from "../lib/gruposMixtos";

export function GruposMixtosModal({ grupos, onClose, onCambio, onAbrir }) {
  const [editando, setEditando] = useState(null); // null | "nuevo" | grupo
  const [todos, setTodos] = useState([]);
  const [nombre, setNombre] = useState("");
  const [sel, setSel] = useState(new Set());
  const [filtroGrado, setFiltroGrado] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [cuenta, setCuenta] = useState({});

  useEffect(() => { gm.fetchEstudiantesParaElegir().then(setTodos).catch((e) => alert("No se pudieron cargar los estudiantes: " + e.message)); }, []);
  useEffect(() => {
    (async () => { const c = {}; for (const g of grupos) { try { c[g.id] = (await gm.fetchMiembrosGrupo(g.id)).length; } catch (e) { c[g.id] = "?"; } } setCuenta(c); })();
  }, [grupos]);

  const abrirEditor = async (g) => {
    setEditando(g); setNombre(g === "nuevo" ? "" : g.nombre); setBusqueda(""); setFiltroGrado("Todos");
    setSel(g === "nuevo" ? new Set() : new Set(await gm.fetchMiembrosGrupo(g.id)));
  };
  const grados = useMemo(() => ["Todos", ...[...new Set(todos.map((e) => String(e.grado_id)))].sort((a, b) => parseInt(a, 10) - parseInt(b, 10))], [todos]);
  const visibles = todos.filter((e) => (filtroGrado === "Todos" || String(e.grado_id) === filtroGrado) && (!busqueda.trim() || e.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())));
  const toggle = (id) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const guardar = async () => {
    if (!nombre.trim()) { alert("Ponle un nombre al grupo (ej: Nivelación taller 2)."); return; }
    if (sel.size === 0) { alert("Elige al menos un estudiante."); return; }
    setGuardando(true);
    try {
      let id;
      if (editando === "nuevo") id = await gm.crearGrupoMixto(nombre.trim(), [...sel]);
      else { id = editando.id; await gm.editarGrupoMixto(id, nombre.trim(), [...sel]); }
      await onCambio(); setEditando(null);
      if (editando === "nuevo" && confirm("Grupo creado. ¿Abrir su planilla ahora?")) { onAbrir(id); onClose(); }
    } catch (e) { alert("Error al guardar: " + e.message + "\n\n¿Ya ejecutaste el SQL 87 en Supabase?"); }
    setGuardando(false);
  };
  const borrar = async (g) => {
    if (!confirm(`¿Eliminar el grupo "${g.nombre}"? Sus estudiantes no se tocan; la planilla del grupo dejará de aparecer.`)) return;
    try { await gm.eliminarGrupoMixto(g.id); await onCambio(); } catch (e) { alert("Error: " + e.message); }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-xl max-h-[88vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">👥 Grupos mixtos</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        {!editando ? (
          <>
            <p className="text-xs text-slate-500 mb-3">Reúne estudiantes de <b>diferentes grados</b> (p. ej. quienes quedaron pendientes de una actividad) en una planilla propia, con sus columnas, notas y rúbricas.</p>
            {grupos.length === 0 && <p className="text-sm text-slate-400 mb-3">Todavía no hay grupos.</p>}
            <div className="space-y-2 mb-3">
              {grupos.map((g) => (
                <div key={g.id} className="border border-slate-200 rounded-lg p-2 flex items-center gap-2">
                  <div className="flex-1 min-w-0"><div className="text-sm font-semibold text-slate-700 truncate">{g.nombre}</div>
                    <div className="text-[11px] text-slate-400">{cuenta[g.id] ?? "…"} estudiante(s)</div></div>
                  <button onClick={() => { onAbrir(g.id); onClose(); }} className="text-xs px-2 py-1 rounded-full bg-violet-500 text-white">Abrir planilla</button>
                  <button onClick={() => abrirEditor(g)} className="text-xs px-2 py-1 rounded-full border border-slate-200 text-slate-600">Editar</button>
                  <button onClick={() => borrar(g)} className="text-xs text-rose-400">🗑</button>
                </div>))}
            </div>
            <button onClick={() => abrirEditor("nuevo")} className="w-full text-sm font-semibold py-2 rounded-lg bg-violet-500 text-white">+ Nuevo grupo</button>
          </>
        ) : (
          <>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del grupo (ej: Nivelación taller 2)" className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none" />
            <div className="flex flex-wrap gap-1 mb-2">
              {grados.map((g) => <button key={g} onClick={() => setFiltroGrado(g)} className={`text-[11px] px-2 py-1 rounded-full ${filtroGrado === g ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-600"}`}>{g === "Todos" ? "Todos" : g}</button>)}
            </div>
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar estudiante…" className="w-full text-xs rounded-lg px-3 py-1.5 mb-2 border border-slate-200 outline-none" />
            <div className="flex justify-between text-[11px] text-slate-500 mb-1">
              <span><b>{sel.size}</b> elegido(s)</span>
              <span><button className="text-violet-600" onClick={() => setSel((p) => new Set([...p, ...visibles.map((e) => e.id)]))}>Elegir los visibles</button> · <button className="text-slate-500" onClick={() => setSel(new Set())}>Limpiar</button></span>
            </div>
            <div className="border border-slate-200 rounded-lg max-h-64 overflow-y-auto mb-3">
              {visibles.map((e) => (
                <label key={e.id} className="flex items-center gap-2 px-2 py-1 text-xs odd:bg-white even:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={sel.has(e.id)} onChange={() => toggle(e.id)} />
                  <span className="flex-1">{e.nombre}</span><span className="text-slate-400">{e.grado_id}</span>
                </label>))}
              {visibles.length === 0 && <div className="p-3 text-xs text-slate-400">Sin resultados.</div>}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditando(null)} className="text-xs text-slate-500 px-3 py-2">Volver</button>
              <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar grupo"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
