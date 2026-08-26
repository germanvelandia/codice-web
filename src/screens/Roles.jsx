import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

export function VistaRoles() {
  const [roles, setRoles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [nombreEdicion, setNombreEdicion] = useState("");
  const [descripcionEdicion, setDescripcionEdicion] = useState("");

  const cargar = async () => {
    setCargando(true);
    const data = await api.fetchRoles();
    setRoles(data);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const crear = async () => {
    if (!nombre.trim()) return;
    await api.crearRol(nombre.trim(), descripcion.trim());
    setNombre("");
    setDescripcion("");
    cargar();
  };

  const empezarEdicion = (r) => {
    setEditandoId(r.id);
    setNombreEdicion(r.nombre);
    setDescripcionEdicion(r.descripcion || "");
  };

  const guardarEdicion = async () => {
    if (!nombreEdicion.trim()) return;
    await api.editarRol(editandoId, nombreEdicion.trim(), descripcionEdicion.trim());
    setEditandoId(null);
    cargar();
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar este rol? Se quitará de todos los estudiantes que lo tengan asignado.")) return;
    await api.eliminarRol(id);
    cargar();
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">Roles de Clase</h2>
      <p className="text-sm text-slate-400 mb-4">Crea los roles (líder, secretario, vocero, etc.) y asígnalos a cada estudiante desde la tarjeta de Estudiantes.</p>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Crear nuevo rol</div>
        <div className="flex flex-wrap gap-2">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del rol (ej: Líder)"
            className="flex-1 min-w-[160px] text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción (opcional)"
            className="flex-1 min-w-[200px] text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
          <button onClick={crear} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white">Crear</button>
        </div>
      </div>

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : roles.length === 0 ? (
        <div className="text-sm text-slate-400">Aún no has creado ningún rol. Crea el primero arriba (ej: Líder, Secretario, Vocero).</div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {roles.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              {editandoId === r.id ? (
                <div>
                  <input value={nombreEdicion} onChange={(e) => setNombreEdicion(e.target.value)} autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") guardarEdicion(); if (e.key === "Escape") setEditandoId(null); }}
                    className="w-full text-sm font-semibold rounded-lg px-2 py-1.5 mb-1.5 border border-violet-300 outline-none" />
                  <input value={descripcionEdicion} onChange={(e) => setDescripcionEdicion(e.target.value)} placeholder="Descripción (opcional)"
                    onKeyDown={(e) => { if (e.key === "Enter") guardarEdicion(); if (e.key === "Escape") setEditandoId(null); }}
                    className="w-full text-xs rounded-lg px-2 py-1.5 mb-2 border border-slate-200 outline-none" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditandoId(null)} className="text-xs text-slate-400">Cancelar</button>
                    <button onClick={guardarEdicion} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white">Guardar</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start">
                    <div className="font-semibold text-slate-800">{r.nombre}</div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => empezarEdicion(r)} className="text-slate-400 hover:text-violet-600 text-xs" title="Modificar">✏️</button>
                      <button onClick={() => eliminar(r.id)} className="text-slate-400 hover:text-rose-500 text-xs" title="Eliminar">✕</button>
                    </div>
                  </div>
                  {r.descripcion && <div className="text-xs text-slate-400 mt-1">{r.descripcion}</div>}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
