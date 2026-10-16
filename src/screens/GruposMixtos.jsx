// Gestión de grupos mixtos (estudiantes de varios grados en una sola planilla),
// con equipos propios y textos sobre el trabajo.
import React, { useEffect, useMemo, useState } from "react";
import * as gm from "../lib/gruposMixtos";
import { EditorTexto, TextoEnriquecido, textoPlano } from "../components/RichText";

export function GruposMixtosModal({ grupos, inicial, onClose, onCambio, onAbrir }) {
  const [editando, setEditando] = useState(null); // null | "nuevo" | grupo
  const [todos, setTodos] = useState([]);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [sel, setSel] = useState(new Set());
  const [equipos, setEquipos] = useState([]); // [{ nombre, trabajo }]
  const [equipoDe, setEquipoDe] = useState({}); // { estudianteId: nombreEquipo }
  const [pestana, setPestana] = useState("estudiantes");
  const [nuevoEquipo, setNuevoEquipo] = useState("");
  const [nRepartir, setNRepartir] = useState(2);
  const [filtroGrado, setFiltroGrado] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [cuenta, setCuenta] = useState({});

  useEffect(() => { gm.fetchEstudiantesParaElegir().then(setTodos).catch((e) => alert("No se pudieron cargar los estudiantes: " + e.message)); }, []);
  useEffect(() => {
    (async () => { const c = {}; for (const g of grupos) { try { c[g.id] = (await gm.fetchMiembrosGrupo(g.id)).length; } catch (e) { c[g.id] = "?"; } } setCuenta(c); })();
  }, [grupos]);

  const abrirEditor = async (g) => {
    setEditando(g); setNombre(g === "nuevo" ? "" : g.nombre); setDescripcion(g === "nuevo" ? "" : g.descripcion || "");
    setBusqueda(""); setFiltroGrado("Todos"); setPestana("estudiantes"); setNuevoEquipo("");
    if (g === "nuevo") { setSel(new Set()); setEquipos([]); setEquipoDe({}); return; }
    const d = await gm.fetchDetalleGrupo(g.id);
    setSel(new Set(d.miembros.map((m) => m.estudiante_id)));
    setEquipos(d.equipos.map((q) => ({ nombre: q.nombre, trabajo: q.trabajo || "" })));
    const eq = {}; d.miembros.forEach((m) => { if (m.equipo) eq[m.estudiante_id] = m.equipo; }); setEquipoDe(eq);
  };
  useEffect(() => { if (inicial) abrirEditor(inicial); }, [inicial?.id]);

  const grados = useMemo(() => ["Todos", ...[...new Set(todos.map((e) => String(e.grado_id)))].sort((a, b) => parseInt(a, 10) - parseInt(b, 10))], [todos]);
  const visibles = todos.filter((e) => (filtroGrado === "Todos" || String(e.grado_id) === filtroGrado) && (!busqueda.trim() || e.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())));
  const elegidos = todos.filter((e) => sel.has(e.id));
  const toggle = (id) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const agregarEquipo = () => {
    const n = nuevoEquipo.trim();
    if (!n) return;
    if (equipos.some((q) => q.nombre.toLowerCase() === n.toLowerCase())) { alert("Ya existe un equipo con ese nombre."); return; }
    setEquipos([...equipos, { nombre: n, trabajo: "" }]); setNuevoEquipo("");
  };
  const quitarEquipo = (n) => {
    if (!confirm(`¿Quitar el equipo "${n}"? Sus integrantes quedan sin equipo.`)) return;
    setEquipos(equipos.filter((q) => q.nombre !== n));
    setEquipoDe((p) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== n)));
  };
  // Reparte a los elegidos en N equipos, mezclando grados (round-robin sobre una lista barajada).
  const repartir = () => {
    const n = Math.max(1, Math.min(parseInt(nRepartir, 10) || 1, elegidos.length));
    if (!elegidos.length) { alert("Primero elige estudiantes."); return; }
    const nombres = Array.from({ length: n }, (_, i) => `Equipo ${i + 1}`);
    const barajados = [...elegidos].sort(() => Math.random() - 0.5);
    const eq = {}; barajados.forEach((e, i) => { eq[e.id] = nombres[i % n]; });
    const previos = equipos.filter((q) => !nombres.includes(q.nombre));
    setEquipos([...previos.filter((q) => (q.trabajo || "").trim()), ...nombres.map((nm) => equipos.find((q) => q.nombre === nm) || { nombre: nm, trabajo: "" })]);
    setEquipoDe(eq);
  };

  const guardar = async () => {
    if (!nombre.trim()) { alert("Ponle un nombre al grupo (ej: Nivelación taller 2)."); return; }
    if (sel.size === 0) { alert("Elige al menos un estudiante."); return; }
    setGuardando(true);
    try {
      const datos = {
        nombre: nombre.trim(), descripcion,
        miembros: [...sel].map((id) => ({ estudiante_id: id, equipo: equipos.some((q) => q.nombre === equipoDe[id]) ? equipoDe[id] : null })),
        equipos,
      };
      let id;
      if (editando === "nuevo") id = await gm.crearGrupoMixto(datos);
      else { id = editando.id; await gm.editarGrupoMixto(id, datos); }
      await onCambio(); setEditando(null);
      if (editando === "nuevo" && confirm("Grupo creado. ¿Abrir su planilla ahora?")) { onAbrir(id); onClose(); }
      else if (inicial) onClose();
    } catch (e) { alert("Error al guardar: " + e.message + "\n\n¿Ya ejecutaste los SQL 87 y 88 en Supabase?"); }
    setGuardando(false);
  };
  const borrar = async (g) => {
    if (!confirm(`¿Eliminar el grupo "${g.nombre}"? Sus estudiantes no se tocan; la planilla del grupo dejará de aparecer.`)) return;
    try { await gm.eliminarGrupoMixto(g.id); await onCambio(); } catch (e) { alert("Error: " + e.message); }
  };

  const Pest = ({ k, children }) => (
    <button onClick={() => setPestana(k)} className={`text-xs font-semibold px-3 py-1.5 rounded-full ${pestana === k ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-600"}`}>{children}</button>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">👥 Grupos mixtos</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        {!editando ? (
          <>
            <p className="text-xs text-slate-500 mb-3">Reúne estudiantes de <b>diferentes grados</b> (p. ej. quienes quedaron pendientes de una actividad) en una planilla propia, con <b>equipos independientes</b> de los de su grado y textos sobre el trabajo.</p>
            {grupos.length === 0 && <p className="text-sm text-slate-400 mb-3">Todavía no hay grupos.</p>}
            <div className="space-y-2 mb-3">
              {grupos.map((g) => (
                <div key={g.id} className="border border-slate-200 rounded-lg p-2 flex items-center gap-2">
                  <div className="flex-1 min-w-0"><div className="text-sm font-semibold text-slate-700 truncate">{g.nombre}</div>
                    <div className="text-[11px] text-slate-400">{cuenta[g.id] ?? "…"} estudiante(s){g.descripcion ? " · 📎 con texto" : ""}</div></div>
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
            <div className="flex gap-1.5 mb-3">
              <Pest k="estudiantes">👤 Estudiantes ({sel.size})</Pest>
              <Pest k="equipos">🧩 Equipos ({equipos.length})</Pest>
              <Pest k="trabajo">📎 Trabajo / texto</Pest>
            </div>

            {pestana === "estudiantes" && (<>
              <div className="flex flex-wrap gap-1 mb-2">
                {grados.map((g) => <button key={g} onClick={() => setFiltroGrado(g)} className={`text-[11px] px-2 py-1 rounded-full ${filtroGrado === g ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-600"}`}>{g}</button>)}
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
            </>)}

            {pestana === "equipos" && (<>
              <p className="text-[11px] text-slate-500 mb-2">Estos equipos son <b>solo de este grupo</b>: no tienen relación con los reinos o equipos de su grado. En la planilla del grupo funcionan como filtro y sirven para poner una nota a todo un equipo con "Nota masiva".</p>
              {sel.size === 0 && <p className="text-xs text-amber-600 mb-2">Primero elige estudiantes en la pestaña anterior.</p>}
              <div className="flex gap-2 mb-2 items-center flex-wrap">
                <input value={nuevoEquipo} onChange={(e) => setNuevoEquipo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && agregarEquipo()} placeholder="Nombre del equipo" className="flex-1 min-w-[140px] text-xs rounded-lg px-3 py-1.5 border border-slate-200 outline-none" />
                <button onClick={agregarEquipo} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">+ Equipo</button>
                <span className="text-[11px] text-slate-400">o</span>
                <input type="number" min="1" value={nRepartir} onChange={(e) => setNRepartir(e.target.value)} className="w-14 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
                <button onClick={repartir} className="text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">🎲 Repartir al azar</button>
              </div>
              <div className="space-y-3 mb-3">
                {equipos.map((q) => (
                  <div key={q.nombre} className="border border-slate-200 rounded-lg p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <b className="text-sm text-slate-700 flex-1">🧩 {q.nombre}</b>
                      <span className="text-[11px] text-slate-400">{elegidos.filter((e) => equipoDe[e.id] === q.nombre).length} integrante(s)</span>
                      <button onClick={() => quitarEquipo(q.nombre)} className="text-xs text-rose-400">🗑</button>
                    </div>
                    <div className="text-[11px] text-slate-500 mb-1">{elegidos.filter((e) => equipoDe[e.id] === q.nombre).map((e) => e.nombre).join(" · ") || "Sin integrantes todavía"}</div>
                    <label className="text-[11px] text-slate-500 block mb-1">Texto sobre el trabajo de este equipo</label>
                    <EditorTexto value={q.trabajo} onChange={(v) => setEquipos((p) => p.map((x) => (x.nombre === q.nombre ? { ...x, trabajo: v } : x)))} minHeight={60} placeholder="Tema, indicaciones, enlaces, acuerdos…" />
                  </div>))}
              </div>
              {equipos.length > 0 && elegidos.length > 0 && (<>
                <div className="text-xs font-semibold text-slate-600 mb-1">Asignar integrantes</div>
                <div className="border border-slate-200 rounded-lg max-h-56 overflow-y-auto mb-3">
                  {elegidos.map((e) => (
                    <div key={e.id} className="flex items-center gap-2 px-2 py-1 text-xs odd:bg-white even:bg-slate-50">
                      <span className="flex-1">{e.nombre} <span className="text-slate-400">({e.grado_id})</span></span>
                      <select value={equipoDe[e.id] || ""} onChange={(ev) => setEquipoDe((p) => ({ ...p, [e.id]: ev.target.value || undefined }))} className="text-xs rounded px-1 py-0.5 border border-slate-200 outline-none">
                        <option value="">Sin equipo</option>
                        {equipos.map((q) => <option key={q.nombre} value={q.nombre}>{q.nombre}</option>)}
                      </select>
                    </div>))}
                </div>
              </>)}
            </>)}

            {pestana === "trabajo" && (<>
              <p className="text-[11px] text-slate-500 mb-2">Texto sobre el trabajo del grupo completo: la actividad pendiente, criterios, fechas, observaciones. Se muestra en la parte de arriba de la planilla del grupo.</p>
              <div className="mb-3"><EditorTexto value={descripcion} onChange={setDescripcion} minHeight={140} placeholder="Ej: Taller 2 pendiente. Entrega el 24 de octubre. Se califica con la rúbrica de exposición…" /></div>
            </>)}

            <div className="flex justify-end gap-2">
              <button onClick={() => (inicial ? onClose() : setEditando(null))} className="text-xs text-slate-500 px-3 py-2">{inicial ? "Cancelar" : "Volver"}</button>
              <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar grupo"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Franja que se ve arriba de la planilla de un grupo: texto del trabajo + equipos.
export function BannerGrupo({ grupo, estudiantes, onEditar }) {
  const [detalle, setDetalle] = useState(null);
  useEffect(() => { let v = true; gm.fetchDetalleGrupo(grupo.id).then((d) => v && setDetalle(d)).catch(() => {}); return () => { v = false; }; }, [grupo.id, grupo.descripcion, estudiantes.length]);
  const equipos = detalle?.equipos || [];
  const hayTexto = (grupo.descripcion && textoPlano(grupo.descripcion).trim()) || equipos.some((q) => q.trabajo && textoPlano(q.trabajo).trim());
  return (
    <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <b className="text-sm text-violet-800">👥 {grupo.nombre}</b>
        <span className="text-xs text-violet-600">{estudiantes.length} estudiante(s) de {new Set(estudiantes.map((e) => e.grado_original)).size} grado(s){equipos.length ? ` · ${equipos.length} equipo(s)` : ""}</span>
        <button onClick={onEditar} className="ml-auto text-xs px-3 py-1 rounded-full bg-white border border-violet-200 text-violet-700">✎ Equipos y texto</button>
      </div>
      {hayTexto && (
        <details className="mt-1.5">
          <summary className="text-xs text-violet-700 cursor-pointer">📎 Ver texto del trabajo</summary>
          <div className="mt-1.5 space-y-2 text-sm text-slate-700">
            {grupo.descripcion && textoPlano(grupo.descripcion).trim() && <div className="bg-white rounded-lg p-2"><TextoEnriquecido html={grupo.descripcion} /></div>}
            {equipos.filter((q) => q.trabajo && textoPlano(q.trabajo).trim()).map((q) => (
              <div key={q.nombre} className="bg-white rounded-lg p-2"><div className="text-xs font-bold text-violet-700 mb-1">🧩 {q.nombre}</div><TextoEnriquecido html={q.trabajo} /></div>))}
          </div>
        </details>
      )}
    </div>
  );
}
