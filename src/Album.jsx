import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

const RAREZAS = [
  { key: "comun", label: "Común", color: "#94A3B8" },
  { key: "rara", label: "Rara", color: "#3B82F6" },
  { key: "epica", label: "Épica", color: "#8B5CF6" },
  { key: "legendaria", label: "Legendaria", color: "#F59E0B" },
];

function CriaturaForm({ criatura, onCancelar, onGuardado }) {
  const [nombre, setNombre] = useState(criatura?.nombre || "");
  const [emoji, setEmoji] = useState(criatura?.emoji || "✨");
  const [rareza, setRareza] = useState(criatura?.rareza || "comun");
  const [descripcion, setDescripcion] = useState(criatura?.descripcion || "");
  const [peso, setPeso] = useState(criatura?.peso ?? 10);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!nombre.trim()) { alert("Escribe un nombre."); return; }
    setGuardando(true);
    try {
      const campos = { nombre: nombre.trim(), emoji: emoji.trim() || "✨", rareza, descripcion: descripcion.trim() || null, peso: parseInt(peso, 10) || 1 };
      if (criatura) await api.editarCriatura(criatura.id, campos);
      else await api.crearCriatura({ ...campos, activo: true });
      onGuardado();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-2xl p-4 mb-3">
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="✨" className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white text-center" />
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la criatura" className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
      </div>
      <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} placeholder="Descripción (opcional)"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Rareza</label>
          <select value={rareza} onChange={(e) => setRareza(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white">
            {RAREZAS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Probabilidad relativa</label>
          <input type="number" value={peso} onChange={(e) => setPeso(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : criatura ? "Guardar cambios" : "Crear criatura"}
        </button>
      </div>
    </div>
  );
}

export function VistaAlbum() {
  const [criaturas, setCriaturas] = useState([]);
  const [config, setConfig] = useState({ costo_sobre: 15, cartas_por_sobre: 3, nombre_album: "" });
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [configAbierta, setConfigAbierta] = useState(false);
  const [guardandoConfig, setGuardandoConfig] = useState(false);

  const cargar = () => {
    setCargando(true);
    Promise.all([api.fetchCriaturas(), api.fetchAlbumConfig()]).then(([c, cfg]) => { setCriaturas(c); setConfig(cfg); setCargando(false); });
  };
  useEffect(() => { cargar(); }, []);

  const toggleActivo = async (c) => { await api.editarCriatura(c.id, { activo: !c.activo }); cargar(); };
  const eliminar = async (c) => { if (!confirm(`¿Eliminar "${c.nombre}" del catálogo? Los estudiantes que ya la tengan la conservan en su colección.`)) return; await api.eliminarCriatura(c.id); cargar(); };

  const guardarConfig = async () => {
    setGuardandoConfig(true);
    try {
      await api.guardarAlbumConfig({
        costo_sobre: parseInt(config.costo_sobre, 10) || 1,
        cartas_por_sobre: parseInt(config.cartas_por_sobre, 10) || 1,
        nombre_album: config.nombre_album.trim() || "Álbum de Criaturas del Códice",
      });
      setConfigAbierta(false);
      cargar();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardandoConfig(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🎴 Álbum de Criaturas</h2>
          <p className="text-sm text-slate-400">Los estudiantes compran sobres con monedas y coleccionan criaturas al azar.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setConfigAbierta(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">⚙️ Configurar sobre</button>
          <button onClick={() => { setEditando(null); setFormAbierto((v) => !v); }} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">
            {formAbierto ? "Cerrar" : "+ Nueva criatura"}
          </button>
        </div>
      </div>

      {configAbierta && (
        <div className="bg-violet-50 rounded-2xl p-4 mb-4">
          <label className="text-xs text-slate-500 block mb-1">Nombre del álbum</label>
          <input value={config.nombre_album} onChange={(e) => setConfig((c) => ({ ...c, nombre_album: e.target.value }))} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Costo por sobre (monedas)</label>
              <input type="number" value={config.costo_sobre} onChange={(e) => setConfig((c) => ({ ...c, costo_sobre: e.target.value }))} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Cartas por sobre</label>
              <input type="number" value={config.cartas_por_sobre} onChange={(e) => setConfig((c) => ({ ...c, cartas_por_sobre: e.target.value }))} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfigAbierta(false)} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
            <button disabled={guardandoConfig} onClick={guardarConfig} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
              {guardandoConfig ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {formAbierto && (
        <CriaturaForm criatura={editando} onCancelar={() => setFormAbierto(false)} onGuardado={() => { setFormAbierto(false); setEditando(null); cargar(); }} />
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : criaturas.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">
          Todavía no hay criaturas en el catálogo.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {criaturas.map((c) => {
            const info = RAREZAS.find((r) => r.key === c.rareza);
            return (
              <div key={c.id} className={`bg-white rounded-2xl border p-3 ${c.activo ? "border-slate-100" : "border-slate-100 opacity-50"}`} style={{ borderTop: `3px solid ${info.color}` }}>
                <div className="flex justify-between items-start">
                  <div className="text-3xl">{c.emoji}</div>
                  <div className="flex gap-1.5">
                    <button onClick={() => { setEditando(c); setFormAbierto(true); }} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
                    <button onClick={() => eliminar(c)} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
                  </div>
                </div>
                <div className="text-sm font-semibold text-slate-800 mt-1">{c.nombre}</div>
                <span className="text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block" style={{ background: `${info.color}22`, color: info.color }}>{info.label}</span>
                {c.descripcion && <div className="text-xs text-slate-500 mt-1">{c.descripcion}</div>}
                <div className="text-[11px] text-slate-400 mt-1">Peso: {c.peso}</div>
                <button onClick={() => toggleActivo(c)} className={`text-[11px] mt-2 px-2 py-1 rounded-full ${c.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {c.activo ? "Activa (puede salir en sobres)" : "Inactiva"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
