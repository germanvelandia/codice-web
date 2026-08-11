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
  const [imagenUrl, setImagenUrl] = useState(criatura?.imagen_url || null);
  const [rareza, setRareza] = useState(criatura?.rareza || "comun");
  const [descripcion, setDescripcion] = useState(criatura?.descripcion || "");
  const [peso, setPeso] = useState(criatura?.peso ?? 10);
  const [poder, setPoder] = useState(criatura?.poder ?? 0);
  const [vida, setVida] = useState(criatura?.vida ?? 0);
  const [experiencia, setExperiencia] = useState(criatura?.experiencia ?? 0);
  const [oro, setOro] = useState(criatura?.oro ?? 0);
  const [guardando, setGuardando] = useState(false);

  const subirImagen = (file) => {
    if (file.size > 500 * 1024) { alert("La imagen es muy grande. Usa una de menos de 500 KB."); return; }
    const reader = new FileReader();
    reader.onload = (e) => setImagenUrl(e.target.result);
    reader.readAsDataURL(file);
  };

  const guardar = async () => {
    if (!nombre.trim()) { alert("Escribe un nombre."); return; }
    setGuardando(true);
    try {
      const campos = {
        nombre: nombre.trim(), emoji: emoji.trim() || "✨", imagen_url: imagenUrl, rareza,
        descripcion: descripcion.trim() || null, peso: parseInt(peso, 10) || 1,
        poder: parseInt(poder, 10) || 0, vida: parseInt(vida, 10) || 0,
        experiencia: parseInt(experiencia, 10) || 0, oro: parseInt(oro, 10) || 0,
      };
      if (criatura) await api.editarCriatura(criatura.id, campos);
      else await api.crearCriatura({ ...campos, activo: true });
      onGuardado();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  const info = RAREZAS.find((r) => r.key === rareza);

  return (
    <div className="bg-violet-50 rounded-2xl p-4 mb-3">
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Formulario */}
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Imagen de la carta</label>
          <div className="flex items-center gap-2 mb-2">
            <input type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) subirImagen(e.target.files[0]); }} className="text-xs flex-1" />
            {imagenUrl && <button onClick={() => setImagenUrl(null)} className="text-xs text-rose-500">Quitar</button>}
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="✨ (respaldo si no hay imagen)" className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white text-center" />
            <select value={rareza} onChange={(e) => setRareza(e.target.value)} className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white">
              {RAREZAS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la criatura" className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} placeholder="Descripción / poder especial (opcional)"
            className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">⚔️ Poder</label>
              <input type="number" value={poder} onChange={(e) => setPoder(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">❤️ Vida</label>
              <input type="number" value={vida} onChange={(e) => setVida(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">⭐ Experiencia</label>
              <input type="number" value={experiencia} onChange={(e) => setExperiencia(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">🪙 Oro</label>
              <input type="number" value={oro} onChange={(e) => setOro(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
            </div>
          </div>
          <label className="text-[10px] text-slate-500 block mb-1">Probabilidad relativa de salir en un sobre</label>
          <input type="number" value={peso} onChange={(e) => setPeso(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>

        {/* Vista previa de la carta */}
        <div className="flex items-start justify-center">
          <CartaCriatura criatura={{ nombre: nombre || "Nombre", emoji, imagen_url: imagenUrl, rareza, descripcion, poder, vida, experiencia, oro }} revelada />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : criatura ? "Guardar cambios" : "Crear criatura"}
        </button>
      </div>
    </div>
  );
}

// Componente de carta reutilizable — se usa acá (catálogo docente) y también
// se importa desde App.jsx para el lado del estudiante (colección + sobres).
export function CartaCriatura({ criatura, revelada = true, tamano = "normal" }) {
  const info = RAREZAS.find((r) => r.key === criatura.rareza) || RAREZAS[0];
  const w = tamano === "chico" ? 130 : 168;
  const h = tamano === "chico" ? 182 : 235;

  if (!revelada) {
    return (
      <div className="rounded-2xl flex flex-col items-center justify-center" style={{ width: w, height: h, background: "#E2E8F0", border: "3px solid #CBD5E1" }}>
        <div className="text-4xl opacity-40">❓</div>
        <div className="text-[10px] font-semibold text-slate-400 mt-1">???</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={{ width: w, height: h, border: `3px solid ${info.color}`, background: "white", boxShadow: `0 2px 10px ${info.color}33` }}>
      {/* Encabezado: nombre + esquina de rareza (tipo/logo) */}
      <div className="flex items-center justify-between px-2 py-1" style={{ background: info.color }}>
        <span className="text-[10px] font-bold text-white truncate">{criatura.nombre}</span>
        <span className="text-[8px] font-bold text-white bg-black/20 rounded-full px-1.5 py-0.5 shrink-0 uppercase">{info.label}</span>
      </div>

      {/* Imagen */}
      <div className="flex-1 flex items-center justify-center" style={{ background: `linear-gradient(160deg, ${info.color}18, ${info.color}05)` }}>
        {criatura.imagen_url ? (
          <img src={criatura.imagen_url} alt={criatura.nombre} className="w-full h-full object-cover" />
        ) : (
          <span style={{ fontSize: tamano === "chico" ? 40 : 56 }}>{criatura.emoji}</span>
        )}
      </div>

      {/* Descripción / poder especial */}
      {criatura.descripcion && (
        <div className="px-2 py-1 text-[8px] text-slate-500 italic leading-tight" style={{ minHeight: 24 }}>
          {criatura.descripcion.length > 60 ? criatura.descripcion.slice(0, 58) + "…" : criatura.descripcion}
        </div>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-4 gap-0.5 px-1.5 pb-1.5">
        <div className="text-center bg-slate-50 rounded py-0.5">
          <div className="text-[9px]">⚔️</div>
          <div className="text-[9px] font-bold text-slate-700">{criatura.poder || 0}</div>
        </div>
        <div className="text-center bg-slate-50 rounded py-0.5">
          <div className="text-[9px]">❤️</div>
          <div className="text-[9px] font-bold text-slate-700">{criatura.vida || 0}</div>
        </div>
        <div className="text-center bg-slate-50 rounded py-0.5">
          <div className="text-[9px]">⭐</div>
          <div className="text-[9px] font-bold text-slate-700">{criatura.experiencia || 0}</div>
        </div>
        <div className="text-center bg-slate-50 rounded py-0.5">
          <div className="text-[9px]">🪙</div>
          <div className="text-[9px] font-bold text-slate-700">{criatura.oro || 0}</div>
        </div>
      </div>
      {criatura.cantidad > 1 && (
        <div className="text-center text-[9px] font-bold text-violet-600 pb-1">x{criatura.cantidad}</div>
      )}
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
        <div className="flex flex-wrap gap-3">
          {criaturas.map((c) => (
            <div key={c.id} className={c.activo ? "" : "opacity-40"}>
              <CartaCriatura criatura={c} tamano="chico" />
              <div className="flex items-center justify-center gap-2 mt-1.5">
                <button onClick={() => { setEditando(c); setFormAbierto(true); }} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
                <button onClick={() => toggleActivo(c)} className={`text-[10px] px-2 py-0.5 rounded-full ${c.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {c.activo ? "Activa" : "Inactiva"}
                </button>
                <button onClick={() => eliminar(c)} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 
