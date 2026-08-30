import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

// Catálogo sugerido de premios reales de aula, con costos pensados para la
// economía típica de CÓDICE (más o menos 1 moneda por acción positiva) —
// el docente los puede editar o borrar después de cargarlos.
const CATALOGO_SUGERIDO = [
  { emoji: "🪑", nombre: "Elegir tu puesto por un día", costo_monedas: 15, peso: 3 },
  { emoji: "⏰", nombre: "Salir 5 minutos antes de clase", costo_monedas: 20, peso: 2 },
  { emoji: "🎧", nombre: "Escuchar música mientras trabajas", costo_monedas: 15, peso: 3 },
  { emoji: "🥇", nombre: "Ser el ayudante del profesor por un día", costo_monedas: 20, peso: 2 },
  { emoji: "🍬", nombre: "Premio pequeño (dulce o sticker)", costo_monedas: 10, peso: 4 },
  { emoji: "🎨", nombre: "10 minutos libres para dibujar", costo_monedas: 15, peso: 3 },
  { emoji: "👥", nombre: "Elegir con quién trabajar en la próxima actividad", costo_monedas: 20, peso: 2 },
  { emoji: "📝", nombre: "Comodín: un día extra para entregar una tarea", costo_monedas: 30, peso: 1 },
  { emoji: "🏆", nombre: "Mención especial en la cartelera de honor", costo_monedas: 25, peso: 2 },
  { emoji: "🎟️", nombre: "Pase para saltar una pregunta oral", costo_monedas: 20, peso: 2 },
  { emoji: "🖍️", nombre: "Kit de útiles pequeño", costo_monedas: 35, peso: 1 },
  { emoji: "🎮", nombre: "5 minutos de tiempo libre (juego, celular, etc.)", costo_monedas: 25, peso: 2 },
];

function PremioForm({ premio, onCancelar, onGuardado }) {
  const [nombre, setNombre] = useState(premio?.nombre || "");
  const [descripcion, setDescripcion] = useState(premio?.descripcion || "");
  const [emoji, setEmoji] = useState(premio?.emoji || "🎁");
  const [costo, setCosto] = useState(premio?.costo_monedas ?? 10);
  const [peso, setPeso] = useState(premio?.peso ?? 1);
  const [stock, setStock] = useState(premio?.stock ?? "");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!nombre.trim()) { alert("Escribe un nombre para el premio."); return; }
    setGuardando(true);
    try {
      const campos = {
        nombre: nombre.trim(), descripcion: descripcion.trim() || null, emoji: emoji.trim() || "🎁",
        costo_monedas: parseInt(costo, 10) || 1, peso: parseInt(peso, 10) || 1,
        stock: stock === "" ? null : parseInt(stock, 10),
      };
      if (premio) await api.editarPremio(premio.id, campos);
      else await api.crearPremio({ ...campos, activo: true });
      onGuardado();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-2xl p-4 mb-3">
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🎁" className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white text-center" />
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del premio" className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
      </div>
      <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción (opcional)"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Costo (monedas)</label>
          <input type="number" value={costo} onChange={(e) => setCosto(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Probabilidad relativa</label>
          <input type="number" value={peso} onChange={(e) => setPeso(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Stock (vacío = ilimitado)</label>
          <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : premio ? "Guardar cambios" : "Crear premio"}
        </button>
      </div>
    </div>
  );
}

function CanjesPendientes() {
  const [canjes, setCanjes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [soloPendientes, setSoloPendientes] = useState(true);

  const cargar = () => { setCargando(true); api.fetchCanjes().then((d) => { setCanjes(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  const entregar = async (id) => { await api.marcarCanjeEntregado(id); cargar(); };
  const visibles = soloPendientes ? canjes.filter((c) => c.estado === "pendiente") : canjes;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-slate-800">Canjes de estudiantes</h3>
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} /> Solo pendientes
        </label>
      </div>
      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : visibles.length === 0 ? (
        <div className="text-sm text-slate-400">No hay canjes {soloPendientes ? "pendientes" : "todavía"}.</div>
      ) : (
        <div className="space-y-1.5">
          {visibles.map((c) => (
            <div key={c.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
              <div className="text-xs text-slate-700">
                <span className="text-base mr-1">{c.premio?.emoji || "🎁"}</span>
                <span className="font-semibold">{c.estudiante?.nombre || "Estudiante"}</span>
                <span className="text-slate-400"> · Grado {c.estudiante?.grado_id} · ganó "{c.premio?.nombre || "Premio eliminado"}" · {c.costo_pagado} monedas · {new Date(c.fecha).toLocaleDateString("es-CO")}</span>
              </div>
              {c.estado === "pendiente" ? (
                <button onClick={() => entregar(c.id)} className="text-[11px] font-semibold text-violet-500 shrink-0">Marcar entregado</button>
              ) : (
                <span className="text-[10px] text-emerald-600 shrink-0">✔ Entregado</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function VistaBanco() {
  const [premios, setPremios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);

  const cargar = () => { setCargando(true); api.fetchPremios().then((d) => { setPremios(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  const toggleActivo = async (p) => { await api.editarPremio(p.id, { activo: !p.activo }); cargar(); };
  const eliminar = async (p) => { if (!confirm(`¿Eliminar "${p.nombre}" del banco?`)) return; await api.eliminarPremio(p.id); cargar(); };

  const [cargandoSugerido, setCargandoSugerido] = useState(false);
  const cargarSugerido = async () => {
    setCargandoSugerido(true);
    try {
      await Promise.all(CATALOGO_SUGERIDO.map((p) => api.crearPremio({ ...p, activo: true, stock: null })));
      cargar();
    } catch (e) {
      alert("Error al cargar el catálogo sugerido: " + e.message);
    }
    setCargandoSugerido(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🏦 Banco de premios</h2>
          <p className="text-sm text-slate-400">Los estudiantes canjean sus monedas por un premio sorpresa desde su portal.</p>
        </div>
        <button onClick={() => { setEditando(null); setFormAbierto((v) => !v); }} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">
          {formAbierto ? "Cerrar" : "+ Nuevo premio"}
        </button>
      </div>

      <div className="mb-4">
        <button disabled={cargandoSugerido} onClick={cargarSugerido} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-violet-200 text-violet-600 disabled:opacity-50">
          {cargandoSugerido ? "Cargando…" : "✨ Cargar catálogo sugerido (12 premios)"}
        </button>
      </div>

      {formAbierto && (
        <PremioForm premio={editando} onCancelar={() => setFormAbierto(false)} onGuardado={() => { setFormAbierto(false); setEditando(null); cargar(); }} />
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : premios.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200 mb-4">
          Todavía no hay premios en el banco. Creá el primero con "+ Nuevo premio".
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {premios.map((p) => (
            <div key={p.id} className={`bg-white rounded-2xl border p-3 ${p.activo ? "border-slate-100" : "border-slate-100 opacity-50"}`}>
              <div className="flex justify-between items-start">
                <div className="text-2xl">{p.emoji}</div>
                <div className="flex gap-1.5">
                  <button onClick={() => { setEditando(p); setFormAbierto(true); }} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
                  <button onClick={() => eliminar(p)} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
                </div>
              </div>
              <div className="text-sm font-semibold text-slate-800 mt-1">{p.nombre}</div>
              {p.descripcion && <div className="text-xs text-slate-500 mt-0.5">{p.descripcion}</div>}
              <div className="text-xs text-amber-600 font-semibold mt-1">🪙 {p.costo_monedas} monedas</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {p.stock === null ? "Stock ilimitado" : `Stock: ${p.stock}`} · Peso: {p.peso}
              </div>
              <button onClick={() => toggleActivo(p)} className={`text-[11px] mt-2 px-2 py-1 rounded-full ${p.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {p.activo ? "Activo (visible)" : "Inactivo (oculto)"}
              </button>
            </div>
          ))}
        </div>
      )}

      <CanjesPendientes />
    </div>
  );
}
