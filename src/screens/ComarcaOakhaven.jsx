import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { agruparPorNivel } from "../lib/gamification";

function CambiarEmojiReino({ reino, onGuardado }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(reino.emoji);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!valor.trim()) { setEditando(false); return; }
    setGuardando(true);
    try {
      await api.guardarEmojiReino(reino.id, valor.trim());
      onGuardado();
      setEditando(false);
    } catch (e) {
      alert("Error al guardar el emoji: " + e.message);
    }
    setGuardando(false);
  };

  if (!editando) {
    return (
      <button onClick={() => { setValor(reino.emoji); setEditando(true); }} className="text-[10px] font-semibold px-2 py-1 rounded-full bg-white/80 text-slate-600">
        {reino.emoji} Cambiar ícono
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 bg-white/90 rounded-full px-1.5 py-1">
      <input value={valor} onChange={(e) => setValor(e.target.value)} autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") guardar(); if (e.key === "Escape") setEditando(false); }}
        className="w-9 text-center text-sm outline-none bg-transparent" placeholder="🏰" />
      <button disabled={guardando} onClick={guardar} className="text-[10px] font-semibold text-violet-600">{guardando ? "…" : "✓"}</button>
      <button onClick={() => setEditando(false)} className="text-[10px] text-slate-400">✕</button>
    </div>
  );
}

function SubirImagenReino({ reino, onGuardado }) {
  const [subiendo, setSubiendo] = useState(false);

  const subir = (file) => {
    if (file.size > 800 * 1024) { alert("La imagen es muy grande — usá una de menos de 800 KB."); return; }
    setSubiendo(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        await api.guardarImagenReino(reino.id, e.target.result);
        onGuardado();
      } catch (err) {
        alert("Error al guardar la imagen: " + err.message);
      }
      setSubiendo(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <label className="text-[10px] font-semibold px-2 py-1 rounded-full bg-white/80 text-slate-600 cursor-pointer">
      {subiendo ? "Subiendo…" : reino.imagen_url ? "🖼️ Cambiar imagen" : "🖼️ Subir imagen"}
      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && subir(e.target.files[0])} />
    </label>
  );
}

function AjustarEconomiaModal({ sesion, reino, billetesDeSesion, onClose, onCambio }) {
  const [tipo, setTipo] = useState("gp");
  const [modo, setModo] = useState("rapido"); // "rapido" | "billetes"
  const [cantidad, setCantidad] = useState(5);
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [denominaciones, setDenominaciones] = useState([]);
  const [conteos, setConteos] = useState({}); // { denominacion_id: cantidad }
  const [formDenomAbierto, setFormDenomAbierto] = useState(false);
  const [valorNuevo, setValorNuevo] = useState(10);
  const [emojiNuevo, setEmojiNuevo] = useState("💵");

  useEffect(() => {
    api.fetchComarcaDenominaciones().then((d) => {
      setDenominaciones(d);
      const inicial = {};
      d.forEach((den) => {
        const existente = billetesDeSesion.find((b) => b.reino_id === reino.id && b.denominacion_id === den.id);
        inicial[den.id] = existente?.cantidad || 0;
      });
      setConteos(inicial);
    });
  }, []);

  const totalContado = denominaciones.reduce((sum, d) => sum + d.valor * (conteos[d.id] || 0), 0);

  const cambiarConteo = (denomId, delta) => {
    setConteos((prev) => ({ ...prev, [denomId]: Math.max(0, (prev[denomId] || 0) + delta) }));
  };

  const crearDenominacion = async () => {
    await api.crearComarcaDenominacion(valorNuevo, emojiNuevo, null);
    const actualizadas = await api.fetchComarcaDenominaciones();
    setDenominaciones(actualizadas);
    setFormDenomAbierto(false);
  };

  const guardarConteo = async () => {
    setGuardando(true);
    try {
      const lista = denominaciones.map((d) => ({ denominacion_id: d.id, cantidad: conteos[d.id] || 0 }));
      await api.guardarBilletesReino(sesion.id, reino.id, lista);
      onCambio();
      onClose();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setGuardando(false);
  };

  const aplicar = async (signo) => {
    setGuardando(true);
    try {
      await api.ajustarEconomiaReino(sesion.id, reino.id, tipo, signo * (parseInt(cantidad, 10) || 0), motivo.trim() || null);
      onCambio();
      onClose();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-xs max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-bold text-slate-800">{reino.emoji} {reino.nombre}</h4>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <div className="flex gap-1 rounded-full bg-slate-100 p-1 mb-3">
          <button onClick={() => setTipo("gp")} className={`flex-1 text-xs py-1.5 rounded-full ${tipo === "gp" ? "bg-amber-500 text-white" : "text-slate-600"}`}>🪙 GP</button>
          <button onClick={() => setTipo("fp")} className={`flex-1 text-xs py-1.5 rounded-full ${tipo === "fp" ? "bg-violet-500 text-white" : "text-slate-600"}`}>🕊️ FP</button>
        </div>

        {tipo === "gp" && (
          <div className="flex gap-1 rounded-full bg-amber-50 p-1 mb-3">
            <button onClick={() => setModo("rapido")} className={`flex-1 text-[11px] py-1.5 rounded-full ${modo === "rapido" ? "bg-amber-500 text-white" : "text-slate-500"}`}>Ajuste rápido</button>
            <button onClick={() => setModo("billetes")} className={`flex-1 text-[11px] py-1.5 rounded-full ${modo === "billetes" ? "bg-amber-500 text-white" : "text-slate-500"}`}>💵 Contar billetes</button>
          </div>
        )}

        {tipo === "gp" && modo === "billetes" ? (
          <div>
            <div className="space-y-1.5 mb-3">
              {denominaciones.map((d) => (
                <div key={d.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-sm font-semibold text-slate-700">{d.emoji} {d.valor} GP</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => cambiarConteo(d.id, -1)} className="w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-500">−</button>
                    <span className="text-sm w-5 text-center">{conteos[d.id] || 0}</span>
                    <button onClick={() => cambiarConteo(d.id, 1)} className="w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-500">+</button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setFormDenomAbierto((v) => !v)} className="text-[11px] text-violet-500 mb-2">{formDenomAbierto ? "Cerrar" : "+ Agregar otra denominación"}</button>
            {formDenomAbierto && (
              <div className="flex gap-1.5 mb-3">
                <input value={emojiNuevo} onChange={(e) => setEmojiNuevo(e.target.value)} className="w-10 text-sm rounded-lg px-1 py-1.5 border border-slate-200 outline-none text-center" />
                <input type="number" value={valorNuevo} onChange={(e) => setValorNuevo(e.target.value)} className="flex-1 text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none text-center" />
                <button onClick={crearDenominacion} className="text-xs font-semibold px-2 py-1.5 rounded-lg bg-violet-500 text-white">+</button>
              </div>
            )}
            <div className="text-center text-sm font-bold text-amber-700 mb-3">Total contado: 🪙 {totalContado} GP</div>
            <button disabled={guardando} onClick={guardarConteo} className="w-full text-sm font-semibold py-2 rounded-lg bg-amber-500 text-white disabled:opacity-60">
              {guardando ? "Guardando…" : "Guardar conteo"}
            </button>
          </div>
        ) : (
          <>
            <input type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="Cantidad"
              className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none text-center" />
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional, ej: Peaje cobrado)"
              className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />
            <div className="flex gap-2">
              <button disabled={guardando} onClick={() => aplicar(-1)} className="flex-1 text-sm font-semibold py-2 rounded-lg bg-rose-100 text-rose-700 disabled:opacity-50">− Quitar</button>
              <button disabled={guardando} onClick={() => aplicar(1)} className="flex-1 text-sm font-semibold py-2 rounded-lg bg-emerald-100 text-emerald-700 disabled:opacity-50">+ Dar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const PALETA_REINOS = ["#8B5CF6", "#F59E0B", "#10B981", "#3B82F6", "#EF4444", "#EC4899", "#14B8A6", "#F97316"];

const ICONOS_MATERIAL = {
  "Madera": "🪵", "Hierbas": "🌿", "Frutas": "🍎", "Animales": "🦌", "Piedra": "🪨", "Resina": "🟤", "Setas": "🍄", "Aguas": "💧",
  "Oro": "🪙", "Mármol": "⬜", "Esmeraldas": "💚", "Hierro": "⚙️", "Carbón": "⚫", "Cristales": "💎", "Pieles": "🦫", "Agua Glacial": "🧊",
  "Trigo": "🌾", "Especias": "🌶️", "Aceite": "🫒", "Telas": "🧵", "Cerámica": "🏺", "Cobre": "🟠", "Algarrobo": "🌰",
  "Azufre": "🟡", "Petróleo": "🛢️", "Caucho": "⚫", "Sal": "🧂", "Tabaco": "🚬", "Cacao": "🍫",
  "Lana": "🧶", "Plata": "⚪", "Uvas": "🍇", "Papel": "📄", "Tinta": "🖋️", "Esencias": "🧴", "Fósforos": "🔥",
  "Pescado": "🐟", "Perlas": "🦪", "Algas": "🌱", "Calamar": "🦑", "Langosta": "🦞", "Conchas": "🐚", "Madera Marina": "🪵",
};
function iconoDeMaterial(material) { return ICONOS_MATERIAL[material] || "📦"; }

function ReajustarProvinciasModal({ sesion, reinos, provincias, onClose, onCambio }) {
  const [arquetipos, setArquetipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [reinoActivoId, setReinoActivoId] = useState(reinos[0]?.id || null);
  const [nuevoMaterial, setNuevoMaterial] = useState("");
  const [nuevoDado, setNuevoDado] = useState(6);
  const [guardando, setGuardando] = useState(false);

  const cargar = () => api.fetchComarcaArquetipos().then((d) => { setArquetipos(d); setCargando(false); });
  useEffect(() => { cargar(); }, []);

  const reinoActivo = reinos.find((r) => r.id === reinoActivoId);
  const arquetipoDeReino = (reino) => arquetipos.find((a) => a.id === reino?.arquetipo_id);
  const provinciasDe = (reinoId) => provincias.filter((p) => p.reino_original_id === reinoId);

  const cambiarArquetipo = async (arquetipoId) => {
    setGuardando(true);
    try {
      await api.asignarArquetipoAReino(reinoActivoId, arquetipoId ? parseInt(arquetipoId, 10) : null);
      onCambio();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setGuardando(false);
  };

  const agregarProvincia = async () => {
    if (!nuevoMaterial) return;
    setGuardando(true);
    try {
      await api.crearProvincia(sesion.id, reinoActivoId, `${reinoActivo.nombre} — ${nuevoMaterial}`, nuevoMaterial, parseInt(nuevoDado, 10) || 6);
      setNuevoMaterial("");
      onCambio();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setGuardando(false);
  };

  const cambiarMaterialDe = async (provincia, material) => {
    setGuardando(true);
    try {
      await api.editarProvincia(provincia.id, { recurso: material, nombre: `${reinoActivo.nombre} — ${material}` });
      onCambio();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setGuardando(false);
  };

  const cambiarDadoDe = async (provincia, numero) => {
    await api.editarProvincia(provincia.id, { numero_dado: parseInt(numero, 10) || null });
    onCambio();
  };

  const borrarProvincia = async (provincia) => {
    if (!confirm(`¿Eliminar la provincia "${provincia.nombre.split("— ")[1] || provincia.nombre}"?`)) return;
    setGuardando(true);
    try {
      await api.eliminarProvincia(provincia.id);
      onCambio();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setGuardando(false);
  };

  if (cargando) return null;
  const arquetipo = arquetipoDeReino(reinoActivo);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-bold text-slate-800">🛠️ Reajustar Provincias</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-400 mb-3">Elegí un arquetipo temático para cada Reino, y armá sus provincias con los materiales de esa lista.</p>

        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
          {reinos.map((r) => (
            <button key={r.id} onClick={() => setReinoActivoId(r.id)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap shrink-0"
              style={{ background: reinoActivoId === r.id ? "#8B5CF6" : "#F1F5F9", color: reinoActivoId === r.id ? "#FFFFFF" : "#475569" }}>
              {r.emoji} {r.nombre}
            </button>
          ))}
        </div>

        {reinoActivo && (
          <div className="border border-slate-100 rounded-xl p-3">
            <label className="text-xs text-slate-500 block mb-1">Arquetipo temático de {reinoActivo.nombre}</label>
            <select value={reinoActivo.arquetipo_id || ""} onChange={(e) => cambiarArquetipo(e.target.value)} disabled={guardando}
              className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none bg-white">
              <option value="">Sin arquetipo asignado</option>
              {arquetipos.map((a) => <option key={a.id} value={a.id}>{a.emoji} {a.nombre}</option>)}
            </select>

            {!arquetipo ? (
              <p className="text-xs text-slate-400">Elegí un arquetipo arriba para ver sus materiales disponibles.</p>
            ) : (
              <>
                <div className="flex gap-2 items-end mb-3">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 block mb-1">Agregar provincia con material</label>
                    <select value={nuevoMaterial} onChange={(e) => setNuevoMaterial(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
                      <option value="">Elegir material…</option>
                      {arquetipo.comarca_materiales.map((m) => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                    </select>
                  </div>
                  <div className="w-20">
                    <label className="text-[10px] text-slate-500 block mb-1">N° dado</label>
                    <input type="number" min="2" max="12" value={nuevoDado} onChange={(e) => setNuevoDado(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
                  </div>
                  <button disabled={guardando || !nuevoMaterial} onClick={agregarProvincia} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-50">+ Agregar</button>
                </div>

                <div className="space-y-1.5">
                  {provinciasDe(reinoActivo.id).length === 0 ? (
                    <p className="text-xs text-slate-400">Este Reino todavía no tiene provincias — agregá una arriba.</p>
                  ) : provinciasDe(reinoActivo.id).map((p) => (
                    <div key={p.id} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                      <select value={p.recurso} onChange={(e) => cambiarMaterialDe(p, e.target.value)} className="flex-1 text-xs rounded-lg px-2 py-1 border border-slate-200 outline-none bg-white">
                        {arquetipo.comarca_materiales.map((m) => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                        {!arquetipo.comarca_materiales.some((m) => m.nombre === p.recurso) && <option value={p.recurso}>{p.recurso} (actual)</option>}
                      </select>
                      <input type="number" min="2" max="12" value={p.numero_dado || ""} onChange={(e) => cambiarDadoDe(p, e.target.value)}
                        className="w-14 text-xs rounded-lg px-2 py-1 border border-slate-200 outline-none text-center" title="Número de dado" />
                      <button onClick={() => borrarProvincia(p)} className="text-slate-300 hover:text-rose-500 shrink-0">🗑</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MapaProvinciasModal({ sesion, reinos, provincias, onClose, onCambio }) {
  const [transfiriendo, setTransfiriendo] = useState(null);
  const [mejorando, setMejorando] = useState(null);
  const [costoMejora, setCostoMejora] = useState(15);
  const [guardandoMejora, setGuardandoMejora] = useState(false);
  const [filtroReinoId, setFiltroReinoId] = useState("todos");
  const colorDe = (reinoId) => {
    const idx = reinos.findIndex((r) => r.id === reinoId);
    return PALETA_REINOS[idx % PALETA_REINOS.length] || "#94A3B8";
  };

  const confirmarMejora = async () => {
    setGuardandoMejora(true);
    try {
      await api.mejorarProvincia(sesion.id, mejorando, parseInt(costoMejora, 10) || 0);
      setMejorando(null);
      onCambio();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setGuardandoMejora(false);
  };

  const provinciasFiltradas = filtroReinoId === "todos" ? provincias : provincias.filter((p) => p.reino_actual_id === filtroReinoId);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-bold text-slate-800 text-lg">🗺️ Mapa de Provincias</h3>
          <button onClick={onClose} className="text-slate-400 text-xl">✕</button>
        </div>
        <p className="text-xs text-slate-400 mb-3">El número grande es el que activa su producción con el Dado. Tocá una provincia para transferirla, o "⬆️" para subirla a Ciudad.</p>

        {/* Pestañas: ver todos los Reinos juntos, o el mapa de uno solo */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
          <button onClick={() => setFiltroReinoId("todos")}
            className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap shrink-0"
            style={{ background: filtroReinoId === "todos" ? "#1E293B" : "#F1F5F9", color: filtroReinoId === "todos" ? "#FFFFFF" : "#475569" }}>
            🗺️ Todos
          </button>
          {reinos.map((r) => (
            <button key={r.id} onClick={() => setFiltroReinoId(r.id)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap shrink-0"
              style={{ background: filtroReinoId === r.id ? colorDe(r.id) : "#F1F5F9", color: filtroReinoId === r.id ? "#FFFFFF" : "#475569" }}>
              {r.emoji} {r.nombre}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3">
          {provinciasFiltradas.map((p) => {
            const reinoDueno = reinos.find((r) => r.id === p.reino_actual_id);
            const cambioDeManos = p.reino_original_id !== p.reino_actual_id;
            return (
              <div key={p.id} className="rounded-xl p-3 text-white shadow-sm relative" style={{ background: colorDe(p.reino_actual_id) }}>
                {p.bloqueada && <span className="absolute top-1.5 right-1.5 text-sm" title="Bloqueada por el Ladrón">🔒</span>}
                {!p.bloqueada && cambioDeManos && <span className="absolute top-1.5 right-1.5 text-[10px]">🔄</span>}
                <button onClick={() => setTransfiriendo(p)} className="text-left w-full">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] opacity-80">{iconoDeMaterial(p.recurso)} {p.recurso}</span>
                    <span className="text-xs font-bold bg-white/25 rounded-full w-5 h-5 flex items-center justify-center">{p.numero_dado || "–"}</span>
                  </div>
                  <div className="text-sm font-bold leading-tight mb-1.5">{p.nombre.split("— ")[1] || p.nombre}</div>
                  <div className="text-[10px] bg-black/20 rounded-full px-2 py-0.5 inline-block">{reinoDueno ? `${reinoDueno.emoji} ${reinoDueno.nombre}` : "Sin dueño"}</div>
                </button>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[9px] uppercase tracking-wide opacity-70">{p.nivel === "ciudad" ? "🏙️ Ciudad" : "🏘️ Villa"}</span>
                  {p.nivel !== "ciudad" && (
                    <button onClick={() => setMejorando(p)} className="text-[10px] bg-white/25 hover:bg-white/40 rounded-full px-2 py-0.5">⬆️ Mejorar</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {transfiriendo && <TransferirProvinciaModal provincia={transfiriendo} reinos={reinos} onClose={() => setTransfiriendo(null)} onCambio={onCambio} />}

      {mejorando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setMejorando(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-xs shadow-xl">
            <h4 className="font-bold text-slate-800 mb-1">⬆️ Mejorar a Ciudad</h4>
            <p className="text-xs text-slate-500 mb-3">{mejorando.nombre.split("— ")[1] || mejorando.nombre} va a producir el doble desde ahora. ¿Cuánto GP le cobramos al Reino dueño?</p>
            <input type="number" value={costoMejora} onChange={(e) => setCostoMejora(e.target.value)}
              className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none text-center" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setMejorando(null)} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
              <button disabled={guardandoMejora} onClick={confirmarMejora} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
                {guardandoMejora ? "…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TransferirProvinciaModal({ provincia, reinos, onClose, onCambio }) {
  const transferir = async (reinoId) => {
    try {
      await api.transferirProvincia(provincia.id, reinoId);
      onCambio();
      onClose();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-xs shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-bold text-slate-800 text-sm">{provincia.nombre}</h4>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">¿A qué reino pasa esta provincia? (por compra, duelo o juicio)</p>
        <div className="space-y-1.5">
          {reinos.map((r) => (
            <button key={r.id} onClick={() => transferir(r.id)}
              className={`w-full text-left text-sm px-3 py-2 rounded-lg ${provincia.reino_actual_id === r.id ? "bg-violet-100 text-violet-700 font-semibold" : "bg-slate-50 hover:bg-slate-100"}`}>
              {r.emoji} {r.nombre} {provincia.reino_actual_id === r.id && "· Dueño actual"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BancoModal({ sesion, reinos, onClose, onCambio }) {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [reinoElegido, setReinoElegido] = useState(reinos[0]?.id || "");
  const [comprando, setComprando] = useState(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [nombre, setNombre] = useState("");
  const [emoji, setEmoji] = useState("📦");
  const [costoGp, setCostoGp] = useState(5);
  const [reinoDueno, setReinoDueno] = useState("");

  const cargar = () => { setCargando(true); api.fetchComarcaProductos().then((d) => { setProductos(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  const empezarEdicion = (p) => {
    setEditandoId(p.id); setNombre(p.nombre); setEmoji(p.emoji); setCostoGp(p.costo_gp); setReinoDueno(p.reino_dueno_nombre || "");
    setFormAbierto(true);
  };

  const cancelarForm = () => {
    setFormAbierto(false); setEditandoId(null); setNombre(""); setEmoji("📦"); setCostoGp(5); setReinoDueno("");
  };

  const guardarProducto = async () => {
    if (!nombre.trim()) return;
    const campos = { nombre: nombre.trim(), emoji, costo_gp: parseInt(costoGp, 10) || 0, reino_dueno_nombre: reinoDueno || null };
    if (editandoId) {
      await api.editarComarcaProducto(editandoId, campos);
    } else {
      await api.crearComarcaProducto(campos);
    }
    cancelarForm();
    cargar();
  };

  const eliminarProducto = async (p) => {
    if (!confirm(`¿Quitar "${p.nombre}" del catálogo del Banco? El inventario que ya tengan los Reinos no se pierde.`)) return;
    await api.eliminarComarcaProducto(p.id);
    cargar();
  };

  const comprar = async (producto) => {
    if (!reinoElegido) { alert("Elegí primero a qué Reino se le vende."); return; }
    setComprando(producto.id);
    try {
      await api.comprarleAlBanco(sesion.id, reinoElegido, producto);
      onCambio();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setComprando(null);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-md max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">🏦 El Banco Central</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        <label className="text-xs text-slate-500 block mb-1">Vender a qué Reino</label>
        <select value={reinoElegido} onChange={(e) => setReinoElegido(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none">
          {reinos.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.nombre} (🪙 {r.gp})</option>)}
        </select>

        <button onClick={() => (formAbierto ? cancelarForm() : setFormAbierto(true))} className="text-xs font-semibold text-violet-500 mb-2">{formAbierto ? "Cerrar" : "+ Agregar producto al catálogo del Banco"}</button>
        {formAbierto && (
          <div className="bg-violet-50 rounded-xl p-3 mb-3 space-y-1.5">
            <div className="flex gap-1.5 flex-wrap items-end">
              <input value={emoji} onChange={(e) => setEmoji(e.target.value)} className="w-12 text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none text-center" />
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej: Tijeras)" className="flex-1 min-w-[100px] text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
              <input type="number" value={costoGp} onChange={(e) => setCostoGp(e.target.value)} placeholder="GP" className="w-16 text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none text-center" />
            </div>
            <select value={reinoDueno} onChange={(e) => setReinoDueno(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
              <option value="">Sin Reino dueño (producto general)</option>
              {reinos.map((r) => <option key={r.id} value={r.nombre}>{r.emoji} Especialidad de {r.nombre}</option>)}
            </select>
            <button onClick={guardarProducto} className="w-full text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white">{editandoId ? "Guardar" : "Agregar"}</button>
          </div>
        )}

        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : productos.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-4">El Banco todavía no tiene productos para vender.</div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {productos.map((p) => (
              <div key={p.id} className="border border-slate-100 rounded-xl p-2.5 text-center relative">
                <div className="absolute top-1 right-1 flex gap-1">
                  <button onClick={() => empezarEdicion(p)} className="text-[10px] text-slate-300 hover:text-violet-600">✏️</button>
                  <button onClick={() => eliminarProducto(p)} className="text-[10px] text-slate-300 hover:text-rose-500">🗑</button>
                </div>
                <div className="text-2xl mb-1">{p.emoji}</div>
                <div className="text-xs font-semibold text-slate-700">{p.nombre}</div>
                {p.reino_dueno_nombre && <div className="text-[9px] text-violet-500 mb-1">⭐ {p.reino_dueno_nombre}</div>}
                <button disabled={comprando === p.id} onClick={() => comprar(p)} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-500 text-white mt-1.5 disabled:opacity-60">
                  {comprando === p.id ? "…" : `🪙 ${p.costo_gp}`}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TruequesModal({ sesion, reinos, inventario, recursos, onClose, onCambio }) {
  const [trueques, setTrueques] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [reinoOferta, setReinoOferta] = useState(reinos[0]?.id || "");
  const [reinoDestino, setReinoDestino] = useState(reinos[1]?.id || "");
  const [gpOfrecido, setGpOfrecido] = useState(0);
  const [gpPedido, setGpPedido] = useState(0);
  const [productoOfrecidoId, setProductoOfrecidoId] = useState("");
  const [productoPedidoId, setProductoPedidoId] = useState("");
  const [recursoOfrecido, setRecursoOfrecido] = useState("");
  const [cantidadRecursoOfrecida, setCantidadRecursoOfrecida] = useState(1);
  const [recursoPedido, setRecursoPedido] = useState("");
  const [cantidadRecursoPedida, setCantidadRecursoPedida] = useState(1);

  const cargar = () => { setCargando(true); api.fetchTruequesDeSesion(sesion.id).then((d) => { setTrueques(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  const productosDisponibles = [...new Map(inventario.map((i) => [i.producto_id, i.comarca_productos])).values()];
  const recursosPosibles = [...new Set(recursos.map((r) => r.recurso))];

  const proponer = async () => {
    try {
      await api.proponerTrueque({
        sesion_id: sesion.id, reino_oferta_id: reinoOferta, reino_destino_id: reinoDestino,
        gp_ofrecido: parseInt(gpOfrecido, 10) || 0, gp_pedido: parseInt(gpPedido, 10) || 0,
        producto_ofrecido_id: productoOfrecidoId || null, cantidad_ofrecida: productoOfrecidoId ? 1 : 0,
        producto_pedido_id: productoPedidoId || null, cantidad_pedida: productoPedidoId ? 1 : 0,
        recurso_ofrecido: recursoOfrecido || null, cantidad_recurso_ofrecida: recursoOfrecido ? (parseInt(cantidadRecursoOfrecida, 10) || 0) : 0,
        recurso_pedido: recursoPedido || null, cantidad_recurso_pedida: recursoPedido ? (parseInt(cantidadRecursoPedida, 10) || 0) : 0,
      });
      setFormAbierto(false);
      cargar();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const resolver = async (t, aceptar) => {
    try {
      await api.resolverTrueque(t, aceptar);
      cargar();
      onCambio();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-md max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">🤝 Trueques entre Reinos</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        <button onClick={() => setFormAbierto((v) => !v)} className="text-xs font-semibold text-violet-500 mb-2">{formAbierto ? "Cerrar" : "+ Proponer un trueque"}</button>
        {formAbierto && (
          <div className="bg-violet-50 rounded-xl p-3 mb-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Reino que ofrece</label>
                <select value={reinoOferta} onChange={(e) => setReinoOferta(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
                  {reinos.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Reino destino</label>
                <select value={reinoDestino} onChange={(e) => setReinoDestino(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
                  {reinos.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Ofrece GP</label>
                <input type="number" value={gpOfrecido} onChange={(e) => setGpOfrecido(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Pide GP</label>
                <input type="number" value={gpPedido} onChange={(e) => setGpPedido(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex gap-1">
                <select value={recursoOfrecido} onChange={(e) => setRecursoOfrecido(e.target.value)} className="flex-1 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
                  <option value="">Sin recurso</option>
                  {recursosPosibles.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                {recursoOfrecido && <input type="number" value={cantidadRecursoOfrecida} onChange={(e) => setCantidadRecursoOfrecida(e.target.value)} className="w-12 text-xs rounded-lg px-1 py-1.5 border border-slate-200 outline-none text-center" />}
              </div>
              <div className="flex gap-1">
                <select value={recursoPedido} onChange={(e) => setRecursoPedido(e.target.value)} className="flex-1 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
                  <option value="">Sin recurso</option>
                  {recursosPosibles.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                {recursoPedido && <input type="number" value={cantidadRecursoPedida} onChange={(e) => setCantidadRecursoPedida(e.target.value)} className="w-12 text-xs rounded-lg px-1 py-1.5 border border-slate-200 outline-none text-center" />}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Ofrece producto</label>
                <select value={productoOfrecidoId} onChange={(e) => setProductoOfrecidoId(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
                  <option value="">Ninguno</option>
                  {productosDisponibles.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Pide producto</label>
                <select value={productoPedidoId} onChange={(e) => setProductoPedidoId(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
                  <option value="">Ninguno</option>
                  {productosDisponibles.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.nombre}</option>)}
                </select>
              </div>
            </div>
            <button onClick={proponer} className="w-full text-xs font-semibold py-2 rounded-lg bg-violet-500 text-white">Proponer trueque</button>
          </div>
        )}

        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : trueques.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-4">Todavía no se propuso ningún trueque.</div>
        ) : (
          <div className="space-y-2">
            {trueques.map((t) => (
              <div key={t.id} className="border border-slate-100 rounded-xl p-2.5 text-xs">
                <div className="font-semibold text-slate-700">{t.oferta?.emoji} {t.oferta?.nombre} ⇄ {t.destino?.emoji} {t.destino?.nombre}</div>
                <div className="text-slate-500 mt-1">
                  Ofrece: {t.gp_ofrecido > 0 && `🪙${t.gp_ofrecido} `}{t.ofrecido && `${t.ofrecido.emoji} ${t.ofrecido.nombre} `}{t.recurso_ofrecido && `${t.cantidad_recurso_ofrecida} ${t.recurso_ofrecido}`}
                  {!t.gp_ofrecido && !t.ofrecido && !t.recurso_ofrecido && "nada"}
                  {" — "}Pide: {t.gp_pedido > 0 && `🪙${t.gp_pedido} `}{t.pedido && `${t.pedido.emoji} ${t.pedido.nombre} `}{t.recurso_pedido && `${t.cantidad_recurso_pedida} ${t.recurso_pedido}`}
                  {!t.gp_pedido && !t.pedido && !t.recurso_pedido && "nada"}
                </div>
                {t.estado === "pendiente" ? (
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => resolver(t, true)} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">✔ Aceptar</button>
                    <button onClick={() => resolver(t, false)} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-rose-100 text-rose-700">✕ Rechazar</button>
                  </div>
                ) : (
                  <span className={`text-[10px] font-semibold mt-1.5 inline-block px-2 py-0.5 rounded-full ${t.estado === "aceptado" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {t.estado === "aceptado" ? "✔ Aceptado" : "✕ Rechazado"}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MisionesSecretasModal({ sesion, reinos, onClose }) {
  const [catalogo, setCatalogo] = useState([]);
  const [misiones, setMisiones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [textoNuevo, setTextoNuevo] = useState("");
  const [repartiendo, setRepartiendo] = useState(false);
  const [modoImprimir, setModoImprimir] = useState(false);

  const cargar = () => {
    setCargando(true);
    Promise.all([api.fetchMisionesCatalogo(), api.fetchMisionesDeSesion(sesion.id)]).then(([cat, mis]) => {
      setCatalogo(cat); setMisiones(mis); setCargando(false);
    });
  };
  useEffect(() => { cargar(); }, []);

  const agregarAlCatalogo = async () => {
    if (!textoNuevo.trim()) return;
    await api.crearMisionCatalogo(textoNuevo.trim());
    setTextoNuevo("");
    cargar();
  };

  const eliminarDelCatalogo = async (id) => { await api.eliminarMisionCatalogo(id); cargar(); };

  const repartir = async () => {
    if (misiones.length > 0 && !confirm("Ya hay misiones repartidas en esta sesión — ¿volver a sortear? Se van a reemplazar las actuales.")) return;
    setRepartiendo(true);
    try {
      await api.repartirMisionesSecretas(sesion.id, reinos);
      cargar();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setRepartiendo(false);
  };

  const toggleCumplida = async (mision) => {
    await api.marcarMisionCumplida(mision.id, !mision.cumplida);
    cargar();
  };

  const misionesDe = (reinoId) => misiones.filter((m) => m.reino_id === reinoId);

  if (modoImprimir) {
    return (
      <div className="fixed inset-0 z-40 bg-white overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-4 print:hidden">
          <h3 className="font-bold text-slate-800">📜 Misiones Secretas — para imprimir</h3>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">🖨️ Imprimir</button>
            <button onClick={() => setModoImprimir(false)} className="text-slate-400">✕</button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {reinos.map((reino) => (
            <div key={reino.id} className="border-2 border-dashed border-slate-300 rounded-2xl p-4 break-inside-avoid">
              <div className="text-center mb-2">
                <div className="text-2xl">{reino.emoji}</div>
                <div className="font-bold text-slate-800">{reino.nombre}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wide">Misiones Secretas — Confidencial</div>
              </div>
              <ol className="text-xs text-slate-700 list-decimal list-inside space-y-1">
                {misionesDe(reino.id).map((m) => <li key={m.id}>{m.texto}</li>)}
              </ol>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (cargando) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-bold text-slate-800">📜 Misiones Secretas</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-400 mb-3">Cada Reino recibe 10 misiones al azar del catálogo — se revelan al final de la sesión.</p>

        <div className="flex gap-2 mb-3">
          <button disabled={repartiendo} onClick={repartir} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
            {repartiendo ? "Repartiendo…" : "🎲 Repartir 10 misiones a cada Reino"}
          </button>
          {misiones.length > 0 && (
            <button onClick={() => setModoImprimir(true)} className="text-sm font-semibold px-4 py-2 rounded-lg border border-violet-200 text-violet-600">🖨️ Ver para imprimir</button>
          )}
        </div>

        <button onClick={() => setFormAbierto((v) => !v)} className="text-xs text-violet-500 mb-2">{formAbierto ? "Cerrar catálogo" : "+ Agregar misión al catálogo"}</button>
        {formAbierto && (
          <div className="bg-violet-50 rounded-xl p-3 mb-3">
            <div className="flex gap-1.5 mb-2">
              <input value={textoNuevo} onChange={(e) => setTextoNuevo(e.target.value)} placeholder="Ej: Dominar 3 provincias de un mismo material"
                className="flex-1 text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none" onKeyDown={(e) => e.key === "Enter" && agregarAlCatalogo()} />
              <button onClick={agregarAlCatalogo} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white">+</button>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {catalogo.map((m) => (
                <div key={m.id} className="flex justify-between items-center text-xs bg-white rounded-lg px-2 py-1">
                  <span>{m.texto}</span>
                  <button onClick={() => eliminarDelCatalogo(m.id)} className="text-slate-300 hover:text-rose-500 shrink-0">🗑</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {misiones.length > 0 && (
          <div className="space-y-3">
            {reinos.map((reino) => (
              <div key={reino.id} className="border border-slate-100 rounded-xl p-3">
                <div className="font-bold text-slate-800 text-sm mb-2">{reino.emoji} {reino.nombre}</div>
                <div className="space-y-1">
                  {misionesDe(reino.id).map((m) => (
                    <label key={m.id} className={`flex items-center gap-2 text-xs px-2 py-1 rounded-lg ${m.cumplida ? "bg-emerald-50 text-emerald-700 line-through" : "bg-slate-50 text-slate-600"}`}>
                      <input type="checkbox" checked={m.cumplida} onChange={() => toggleCumplida(m)} />
                      {m.texto}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TarjetasRolImprimibleModal({ sesion, reinos, onClose }) {
  const [estudiantes, setEstudiantes] = useState([]);
  const [catalogoRoles, setCatalogoRoles] = useState([]);
  const [nombresFantasia, setNombresFantasia] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([api.fetchEstudiantesPorGrado(sesion.grado_id), api.fetchRoles(), api.fetchNombresFantasiaDeSesion(sesion.id)]).then(([est, roles, fantasia]) => {
      setEstudiantes(est); setCatalogoRoles(roles); setNombresFantasia(fantasia); setCargando(false);
    });
  }, []);

  if (cargando) return null;

  const reinoDe = (est) => reinos.find((r) => r.nombre.trim().toLowerCase() === (est.reino_actual || est.reino_original || "").trim().toLowerCase());
  const rolDe = (est) => {
    const rolId = est.roles_asignados?.[0]?.rol_id || est.roles_asignados?.rol_id;
    if (!rolId) return null;
    const catalogado = catalogoRoles.find((r) => r.id === rolId);
    return catalogado ? { ...catalogado, info: api.COMARCA_ROLES.find((rc) => rc.nombre === catalogado.nombre) } : null;
  };
  const nombreMostrado = (est) => nombresFantasia.find((n) => n.estudiante_id === est.id)?.nombre || est.nombre;

  const tarjetas = estudiantes.map((est) => ({ est, reino: reinoDe(est), rol: rolDe(est) })).filter((t) => t.reino && t.rol);

  return (
    <div className="fixed inset-0 z-40 bg-white overflow-y-auto p-6">
      <div className="flex justify-between items-center mb-4 print:hidden">
        <h3 className="font-bold text-slate-800">🎭 Tarjetas de Rol — para imprimir</h3>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">🖨️ Imprimir</button>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
      </div>
      {tarjetas.length === 0 ? (
        <p className="text-sm text-slate-400 print:hidden">Todavía nadie tiene un Reino y un rol asignados a la vez — hacelo primero en "🎭 Roles".</p>
      ) : (
        <div className="grid sm:grid-cols-3 gap-3">
          {tarjetas.map(({ est, reino, rol }) => (
            <div key={est.id} className="rounded-2xl p-4 text-white shadow-sm break-inside-avoid" style={{ background: "linear-gradient(160deg, #451a80 0%, #2d1155 100%)", border: "2px solid #C084FC" }}>
              <div className="text-[9px] uppercase tracking-widest text-violet-200 mb-1">{reino.emoji} {reino.nombre}</div>
              <div className="text-3xl mb-1">{rol.info?.emoji || "🎭"}</div>
              <div className="text-sm font-bold mb-0.5">{rol.nombre}</div>
              <div className="text-xs text-violet-200 mb-2">{nombreMostrado(est)}</div>
              {rol.info?.descripcion && <p className="text-[10px] text-violet-100 leading-snug">{rol.info.descripcion}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InventarioImprimibleModal({ reinos, inventario, onClose }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl print:shadow-none print:max-h-none">
        <div className="flex justify-between items-center mb-4 print:hidden">
          <h3 className="font-bold text-slate-800">📋 Inventario por Reino</h3>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">🖨️ Imprimir</button>
            <button onClick={onClose} className="text-slate-400">✕</button>
          </div>
        </div>
        <div className="space-y-4">
          {reinos.map((r) => {
            const items = inventario.filter((i) => i.reino_id === r.id && i.cantidad > 0);
            return (
              <div key={r.id} className="border border-slate-200 rounded-xl p-3">
                <div className="font-bold text-slate-800 text-sm mb-2">{r.emoji} {r.nombre} — 🪙 {r.gp} GP · 🕊️ {r.fp} FP</div>
                {items.length === 0 ? (
                  <p className="text-xs text-slate-400">Sin productos todavía.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-slate-400"><th className="pb-1">Producto</th><th className="pb-1 text-right">Cantidad</th></tr></thead>
                    <tbody>
                      {items.map((i) => (
                        <tr key={i.id} className="border-t border-slate-100">
                          <td className="py-1">{i.comarca_productos?.emoji} {i.comarca_productos?.nombre}</td>
                          <td className="py-1 text-right font-semibold">{i.cantidad}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DuelosModal({ sesion, reinos, provincias, onClose, onCambio }) {
  const [duelos, setDuelos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [reinoRetador, setReinoRetador] = useState(reinos[0]?.id || "");
  const [reinoRetado, setReinoRetado] = useState(reinos[1]?.id || "");
  const [provinciaEnJuego, setProvinciaEnJuego] = useState("");
  const [jugadaRetador, setJugadaRetador] = useState("");
  const [jugadaRetado, setJugadaRetado] = useState("");
  const [jugandoRondaDe, setJugandoRondaDe] = useState(null);

  const cargar = () => { setCargando(true); api.fetchDuelosDeSesion(sesion.id).then((d) => { setDuelos(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  const provinciasDelRetado = provincias.filter((p) => p.reino_actual_id === reinoRetado);

  const crear = async () => {
    if (reinoRetador === reinoRetado) { alert("Elegí dos Reinos distintos."); return; }
    try {
      await api.crearDuelo(sesion.id, reinoRetador, reinoRetado, provinciaEnJuego || null);
      setFormAbierto(false);
      cargar();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const siguienteRonda = (duelo) => {
    for (let n = 1; n <= 3; n++) { if (!duelo[`ronda${n}_retador`]) return n; }
    return null;
  };

  const jugar = async (duelo) => {
    const ronda = siguienteRonda(duelo);
    if (!ronda || !jugadaRetador || !jugadaRetado) return;
    try {
      await api.jugarRondaDuelo(duelo, ronda, jugadaRetador, jugadaRetado);
      setJugandoRondaDe(null); setJugadaRetador(""); setJugadaRetado("");
      cargar();
      onCambio();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const eliminar = async (d) => {
    if (!confirm("¿Cancelar este duelo?")) return;
    await api.eliminarDuelo(d.id);
    cargar();
  };

  const OPCIONES = [{ v: "piedra", e: "🪨" }, { v: "papel", e: "📄" }, { v: "tijera", e: "✂️" }];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-md max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">⚔️ Duelos (Piedra, Papel o Tijera)</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        <button onClick={() => setFormAbierto((v) => !v)} className="text-xs font-semibold text-violet-500 mb-2">{formAbierto ? "Cerrar" : "+ Nuevo duelo"}</button>
        {formAbierto && (
          <div className="bg-violet-50 rounded-xl p-3 mb-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Reino retador</label>
                <select value={reinoRetador} onChange={(e) => setReinoRetador(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
                  {reinos.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Reino retado</label>
                <select value={reinoRetado} onChange={(e) => setReinoRetado(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
                  {reinos.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.nombre}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Provincia en juego (opcional — se la lleva el retador si gana)</label>
              <select value={provinciaEnJuego} onChange={(e) => setProvinciaEnJuego(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
                <option value="">Sin provincia en juego (solo por honor)</option>
                {provinciasDelRetado.map((p) => <option key={p.id} value={p.id}>{p.nombre.split("— ")[1] || p.nombre}</option>)}
              </select>
            </div>
            <button onClick={crear} className="w-full text-xs font-semibold py-2 rounded-lg bg-violet-500 text-white">Empezar duelo</button>
          </div>
        )}

        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : duelos.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-4">Todavía no hay duelos.</div>
        ) : (
          <div className="space-y-2">
            {duelos.map((d) => {
              const ronda = siguienteRonda(d);
              return (
                <div key={d.id} className="border border-slate-100 rounded-xl p-3 text-xs">
                  <div className="flex justify-between items-start">
                    <div className="font-semibold text-slate-700">{d.retador?.emoji} {d.retador?.nombre} 🆚 {d.retado?.emoji} {d.retado?.nombre}</div>
                    {d.estado === "en_curso" && <button onClick={() => eliminar(d)} className="text-slate-300 hover:text-rose-500">🗑</button>}
                  </div>
                  {d.provincia && <div className="text-slate-400 mt-0.5">En juego: {d.provincia.nombre.split("— ")[1] || d.provincia.nombre}</div>}
                  <div className="flex gap-2 mt-1.5">
                    {[1, 2, 3].map((n) => (
                      <span key={n} className="text-slate-500">R{n}: {d[`ronda${n}_retador`] ? OPCIONES.find((o) => o.v === d[`ronda${n}_retador`])?.e : "—"} vs {d[`ronda${n}_retado`] ? OPCIONES.find((o) => o.v === d[`ronda${n}_retado`])?.e : "—"}</span>
                    ))}
                  </div>

                  {d.estado === "terminado" ? (
                    <div className="mt-2 text-emerald-700 font-semibold">🏆 Ganó {d.ganador?.emoji} {d.ganador?.nombre}</div>
                  ) : jugandoRondaDe === d.id ? (
                    <div className="mt-2 bg-slate-50 rounded-lg p-2 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-16 shrink-0">{d.retador?.nombre}:</span>
                        {OPCIONES.map((o) => <button key={o.v} onClick={() => setJugadaRetador(o.v)} className={`text-base px-1.5 py-0.5 rounded ${jugadaRetador === o.v ? "bg-violet-200" : ""}`}>{o.e}</button>)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-16 shrink-0">{d.retado?.nombre}:</span>
                        {OPCIONES.map((o) => <button key={o.v} onClick={() => setJugadaRetado(o.v)} className={`text-base px-1.5 py-0.5 rounded ${jugadaRetado === o.v ? "bg-violet-200" : ""}`}>{o.e}</button>)}
                      </div>
                      <button disabled={!jugadaRetador || !jugadaRetado} onClick={() => jugar(d)} className="w-full text-xs font-semibold py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-50">Confirmar Ronda {ronda}</button>
                    </div>
                  ) : (
                    <button onClick={() => { setJugandoRondaDe(d.id); setJugadaRetador(""); setJugadaRetado(""); }} className="mt-2 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">Jugar Ronda {ronda}</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function RolesModal({ sesion, reinos, onClose }) {
  const [estudiantes, setEstudiantes] = useState([]);
  const [catalogoRoles, setCatalogoRoles] = useState([]);
  const [nombresFantasia, setNombresFantasia] = useState([]);
  const [nombresTemp, setNombresTemp] = useState({}); // edición local antes de guardar
  const [primeraCarga, setPrimeraCarga] = useState(true);
  const [creandoCatalogo, setCreandoCatalogo] = useState(false);
  const [guardandoId, setGuardandoId] = useState(null);
  const [recienGuardadoId, setRecienGuardadoId] = useState(null);
  const [guardandoNombreId, setGuardandoNombreId] = useState(null);
  const [recienGuardadoNombreId, setRecienGuardadoNombreId] = useState(null);
  const [editandoRolDe, setEditandoRolDe] = useState(null);
  const [reinoActivoId, setReinoActivoId] = useState(reinos[0]?.id || null);

  const cargar = () => {
    return Promise.all([api.fetchEstudiantesPorGrado(sesion.grado_id), api.fetchRoles(), api.fetchNombresFantasiaDeSesion(sesion.id)]).then(([est, roles, fantasia]) => {
      setEstudiantes(est); setCatalogoRoles(roles); setNombresFantasia(fantasia); setPrimeraCarga(false);
    });
  };
  useEffect(() => { cargar(); }, []);

  const rolesComarcaEnCatalogo = api.COMARCA_ROLES.map((rc) => ({ ...rc, catalogado: catalogoRoles.find((c) => c.nombre === rc.nombre) }));
  const faltanPorCrear = rolesComarcaEnCatalogo.filter((r) => !r.catalogado);

  const crearLos7EnCatalogo = async () => {
    setCreandoCatalogo(true);
    try {
      for (const r of faltanPorCrear) await api.crearRol(r.nombre, r.descripcion);
      cargar();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setCreandoCatalogo(false);
  };

  const asignar = async (estudianteId, rolId) => {
    setGuardandoId(estudianteId);
    try {
      await api.asignarRol(estudianteId, rolId || null);
      await cargar();
      setEditandoRolDe(null);
      setRecienGuardadoId(estudianteId);
      setTimeout(() => setRecienGuardadoId((prev) => (prev === estudianteId ? null : prev)), 2000);
    } catch (e) {
      alert("Error al guardar el rol: " + e.message);
    }
    setGuardandoId(null);
  };

  const guardarNombreFantasia = async (estudianteId) => {
    const nombre = nombresTemp[estudianteId] ?? (nombresFantasia.find((n) => n.estudiante_id === estudianteId)?.nombre || "");
    setGuardandoNombreId(estudianteId);
    try {
      await api.guardarNombreFantasia(sesion.id, estudianteId, nombre);
      await cargar();
      setRecienGuardadoNombreId(estudianteId);
      setTimeout(() => setRecienGuardadoNombreId((prev) => (prev === estudianteId ? null : prev)), 2000);
    } catch (e) {
      alert("Error al guardar el nombre: " + e.message);
    }
    setGuardandoNombreId(null);
  };

  // Agrupa a los estudiantes del curso según su Reino actual (o el
  // original, si no tienen el actual seteado) — comparación sin importar
  // mayúsculas/minúsculas ni espacios de más, para no perder estudiantes
  // por una diferencia mínima de escritura.
  const normalizar = (s) => (s || "").trim().toLowerCase();
  const estudiantesDe = (reino) => estudiantes.filter((e) => normalizar(e.reino_actual || e.reino_original) === normalizar(reino.nombre));
  const sinReinoAsignado = estudiantes.filter((e) => !reinos.some((r) => normalizar(r.nombre) === normalizar(e.reino_actual || e.reino_original)));
  const nombreFantasiaDe = (estudianteId) => nombresTemp[estudianteId] ?? (nombresFantasia.find((n) => n.estudiante_id === estudianteId)?.nombre || "");

  if (primeraCarga) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-bold text-slate-800">🎭 Los 7 Roles</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-400 mb-3">Asigná el rol y, si querés, un nombre de fantasía para el avatar de cada estudiante (ej: "Lord Aldric"). Cada guardado se confirma con un ✓ visible.</p>

        {faltanPorCrear.length > 0 && (
          <div className="bg-violet-50 rounded-xl p-3 mb-4 flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-violet-700">Faltan {faltanPorCrear.length} de los 7 roles en tu catálogo de Roles de Clase.</p>
            <button disabled={creandoCatalogo} onClick={crearLos7EnCatalogo} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
              {creandoCatalogo ? "Creando…" : "+ Crear los que faltan"}
            </button>
          </div>
        )}

        {sinReinoAsignado.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4">
            <p className="text-xs text-rose-700 font-semibold mb-1">⚠️ {sinReinoAsignado.length} estudiante(s) de este curso no calzan con ninguno de los Reinos de esta sesión:</p>
            <p className="text-xs text-rose-600">{sinReinoAsignado.map((e) => `${e.nombre} (Reino: "${e.reino_actual || e.reino_original || "sin asignar"}")`).join(", ")}</p>
            <p className="text-[11px] text-rose-500 mt-1">Revisá en Estudiantes que el nombre de su Reino sea exactamente igual al de esta sesión.</p>
          </div>
        )}

        {/* Pestañas por Reino */}
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
          {reinos.map((reino) => (
            <button key={reino.id} onClick={() => setReinoActivoId(reino.id)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap shrink-0"
              style={{ background: reinoActivoId === reino.id ? "#8B5CF6" : "#F1F5F9", color: reinoActivoId === reino.id ? "#FFFFFF" : "#475569" }}>
              {reino.emoji} {reino.nombre} <span className="opacity-70">({estudiantesDe(reino).length})</span>
            </button>
          ))}
        </div>

        {(() => {
          const reino = reinos.find((r) => r.id === reinoActivoId) || reinos[0];
          if (!reino) return null;
          return (
            <div className="border border-slate-100 rounded-xl p-3">
              <div className="font-bold text-slate-800 text-sm mb-2">{reino.emoji} {reino.nombre}</div>
              {estudiantesDe(reino).length === 0 ? (
                <p className="text-xs text-slate-400">Ningún estudiante de este curso tiene este Reino asignado.</p>
              ) : (
                <div className="space-y-2">
                  {estudiantesDe(reino).map((est) => {
                    const rolActualId = est.roles_asignados?.[0]?.rol_id || est.roles_asignados?.rol_id || "";
                    const rolActual = catalogoRoles.find((r) => r.id === rolActualId);
                    const infoComarcaActual = rolActual ? api.COMARCA_ROLES.find((rc) => rc.nombre === rolActual.nombre) : null;
                    const editando = editandoRolDe === est.id;
                    return (
                      <div key={est.id} className="bg-white border border-slate-100 rounded-xl p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-sm font-semibold text-slate-800 flex-1 min-w-0 truncate">{est.nombre}</span>
                          {recienGuardadoId === est.id && <span className="text-[10px] text-emerald-600 font-semibold shrink-0">✓ Guardado</span>}
                        </div>

                        {editando ? (
                          <div className="flex items-center gap-2">
                            <select value={rolActualId} onChange={(e) => asignar(est.id, e.target.value ? parseInt(e.target.value, 10) : null)}
                              disabled={guardandoId === est.id} autoFocus
                              className="flex-1 text-xs rounded-lg px-2 py-1.5 border border-violet-300 outline-none bg-white">
                              <option value="">Sin rol</option>
                              {catalogoRoles.map((r) => {
                                const infoComarca = api.COMARCA_ROLES.find((rc) => rc.nombre === r.nombre);
                                return <option key={r.id} value={r.id}>{infoComarca ? `${infoComarca.emoji} ` : ""}{r.nombre}</option>;
                              })}
                            </select>
                            {guardandoId === est.id ? (
                              <span className="text-[10px] text-slate-400 shrink-0">Guardando…</span>
                            ) : (
                              <button onClick={() => setEditandoRolDe(null)} className="text-[11px] text-slate-400 shrink-0">Cancelar</button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            {rolActual ? (
                              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">
                                {infoComarcaActual?.emoji || "🎭"} {rolActual.nombre}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 px-2.5 py-1 rounded-full bg-slate-100">Sin rol asignado</span>
                            )}
                            <button onClick={() => setEditandoRolDe(est.id)} className="text-[11px] font-semibold text-violet-500 shrink-0">
                              {rolActual ? "Cambiar" : "Asignar"}
                            </button>
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-50">
                          <span className="text-[10px] text-slate-400 shrink-0">🎭 Nombre de fantasía</span>
                          <input value={nombreFantasiaDe(est.id)} onChange={(e) => setNombresTemp((prev) => ({ ...prev, [est.id]: e.target.value }))}
                            onBlur={() => guardarNombreFantasia(est.id)} onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                            placeholder="Ej: Lord Aldric (opcional)" disabled={guardandoNombreId === est.id}
                            className="flex-1 text-xs rounded-lg px-2 py-1 border border-slate-200 outline-none bg-white" />
                          {guardandoNombreId === est.id && <span className="text-[10px] text-slate-400 shrink-0">…</span>}
                          {recienGuardadoNombreId === est.id && <span className="text-[10px] text-emerald-600 font-semibold shrink-0">✓</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function RecursosModal({ sesion, reinos, recursos, onClose, onCambio }) {
  const [vendiendo, setVendiendo] = useState(null); // { reinoId, recurso }
  const [cantidadVenta, setCantidadVenta] = useState(3);
  const [guardando, setGuardando] = useState(false);

  const vender = async () => {
    setGuardando(true);
    try {
      const gp = await api.venderRecursoAlBanco(sesion.id, vendiendo.reinoId, vendiendo.recurso, parseInt(cantidadVenta, 10) || 0);
      alert(`El Banco pagó ${gp} GP por eso.`);
      setVendiendo(null);
      onCambio();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-md max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-bold text-slate-800">📦 Recursos por Reino</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-400 mb-3">Se ganan tirando el Dado — el Banco los compra a 3 recursos = 1 GP.</p>

        <div className="space-y-3">
          {reinos.map((r) => {
            const suyos = recursos.filter((x) => x.reino_id === r.id && x.cantidad > 0);
            return (
              <div key={r.id} className="border border-slate-100 rounded-xl p-3">
                <div className="font-bold text-slate-800 text-sm mb-2">{r.emoji} {r.nombre}</div>
                {suyos.length === 0 ? (
                  <p className="text-xs text-slate-400">Todavía no juntó recursos.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {suyos.map((x) => (
                      <button key={x.id} onClick={() => { setVendiendo({ reinoId: r.id, recurso: x.recurso, disponible: x.cantidad }); setCantidadVenta(Math.min(3, x.cantidad)); }}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {x.recurso}: {x.cantidad}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {vendiendo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setVendiendo(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-xs shadow-xl">
            <h4 className="font-bold text-slate-800 mb-2">Vender {vendiendo.recurso} al Banco</h4>
            <p className="text-xs text-slate-400 mb-2">Tiene {vendiendo.disponible} disponibles — cada 3 = 1 GP.</p>
            <input type="number" max={vendiendo.disponible} value={cantidadVenta} onChange={(e) => setCantidadVenta(e.target.value)}
              className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none text-center" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setVendiendo(null)} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
              <button disabled={guardando} onClick={vender} className="text-sm font-semibold px-4 py-2 rounded-lg bg-emerald-500 text-white disabled:opacity-60">
                {guardando ? "…" : "Vender"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function urlDeTarjeta(sesionId, reinoId, estudianteId) {
  const base = window.location.origin + window.location.pathname;
  const params = new URLSearchParams({ sesion: sesionId, reino: reinoId });
  if (estudianteId) params.set("estudiante", estudianteId);
  return `${base}#comarca-tarjeta?${params.toString()}`;
}

export function urlQR(texto) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(texto)}`;
}

function QRModal({ sesion, reinos, onClose }) {
  const [estudiantes, setEstudiantes] = useState([]);
  const [catalogoRoles, setCatalogoRoles] = useState([]);
  const [nombresFantasia, setNombresFantasia] = useState([]);
  const [vista, setVista] = useState("reinos"); // "reinos" | "estudiantes"

  useEffect(() => {
    Promise.all([api.fetchEstudiantesPorGrado(sesion.grado_id), api.fetchRoles(), api.fetchNombresFantasiaDeSesion(sesion.id)]).then(([est, roles, fantasia]) => {
      setEstudiantes(est); setCatalogoRoles(roles); setNombresFantasia(fantasia);
    });
  }, []);

  const reinoDe = (est) => reinos.find((r) => r.nombre === (est.reino_actual || est.reino_original));
  const rolDe = (est) => {
    const rolId = est.roles_asignados?.[0]?.rol_id || est.roles_asignados?.rol_id;
    if (!rolId) return null;
    const catalogado = catalogoRoles.find((r) => r.id === rolId);
    return catalogado ? { ...catalogado, info: api.COMARCA_ROLES.find((rc) => rc.nombre === catalogado.nombre) } : null;
  };
  const nombreMostrado = (est) => nombresFantasia.find((n) => n.estudiante_id === est.id)?.nombre || est.nombre;

  const conRolYReino = estudiantes.filter((e) => rolDe(e) && reinoDe(e));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-bold text-slate-800">📱 Tarjetas QR</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-400 mb-3">Cada estudiante escanea su QR con el celular y ve el saldo de su Reino en vivo, sin necesitar login.</p>

        <div className="flex gap-1 rounded-full bg-slate-100 p-1 mb-4 w-fit">
          <button onClick={() => setVista("reinos")} className={`text-xs px-3 py-1.5 rounded-full ${vista === "reinos" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Por Reino (compartida)</button>
          <button onClick={() => setVista("estudiantes")} className={`text-xs px-3 py-1.5 rounded-full ${vista === "estudiantes" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Por estudiante</button>
        </div>

        {vista === "reinos" ? (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {reinos.map((r) => (
              <div key={r.id} className="border border-slate-100 rounded-xl p-3 text-center">
                <img src={urlQR(urlDeTarjeta(sesion.id, r.id))} alt={`QR ${r.nombre}`} className="mx-auto mb-2 rounded-lg" />
                <div className="text-xs font-semibold text-slate-700">{r.emoji} {r.nombre}</div>
              </div>
            ))}
          </div>
        ) : conRolYReino.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Todavía ningún estudiante de este curso tiene uno de los 7 roles asignado — hacelo en "🎭 Roles" primero.</p>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {conRolYReino.map((est) => {
              const reino = reinoDe(est);
              const rol = rolDe(est);
              return (
                <div key={est.id} className="border border-slate-100 rounded-xl p-3 text-center">
                  <img src={urlQR(urlDeTarjeta(sesion.id, reino.id, est.id))} alt={`QR ${est.nombre}`} className="mx-auto mb-2 rounded-lg" />
                  <div className="text-xs font-semibold text-slate-700">{nombreMostrado(est)}</div>
                  <div className="text-[10px] text-slate-400">{rol.info?.emoji || "🎭"} {rol.nombre} · {reino?.nombre}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function iconoDeEfecto(evento) {
  switch (evento.efecto_tipo) {
    case "gp_todos": return evento.efecto_valor >= 0 ? "🪙" : "💸";
    case "fp_todos": return evento.efecto_valor >= 0 ? "🕊️" : "💔";
    case "gp_aleatorio": return "🎁";
    case "bloquear_provincia_aleatoria": return "🔒";
    case "liberar_provincias": return "🔓";
    case "producir_extra": return "🌾";
    default: return "📜";
  }
}

function textoDeEfecto(evento, detalle) {
  switch (evento.efecto_tipo) {
    case "gp_todos": return `Todos los Reinos ${evento.efecto_valor >= 0 ? "ganan" : "pierden"} ${Math.abs(evento.efecto_valor)} GP.`;
    case "fp_todos": return `Todos los Reinos ${evento.efecto_valor >= 0 ? "ganan" : "pierden"} ${Math.abs(evento.efecto_valor)} FP.`;
    case "gp_aleatorio": return detalle ? `¡${detalle.emoji} ${detalle.nombre} fue el elegido! ${evento.efecto_valor >= 0 ? "Gana" : "Pierde"} ${Math.abs(evento.efecto_valor)} GP.` : "No había ningún Reino para elegir.";
    case "bloquear_provincia_aleatoria": return detalle ? `Se bloqueó: ${detalle.nombre.split("— ")[1] || detalle.nombre}.` : "No había ninguna provincia libre para bloquear.";
    case "liberar_provincias": return "Todas las provincias bloqueadas quedan libres de nuevo.";
    case "producir_extra": return detalle !== null ? `Salió ${detalle} en el dado extra — produjeron las provincias con ese número.` : "";
    default: return "Esta carta no tiene efecto sobre el juego.";
  }
}

function DadoReveladoModal({ resultado, reinos, onClose }) {
  const { dado, provinciaBloqueada, detalleProduccion } = resultado;
  const esLadron = dado === 7;

  // Agrupa la producción por Reino, para mostrar "Zafiro recibió: 2 Oro, 1 Trigo".
  const porReino = {};
  (detalleProduccion || []).forEach((d) => {
    if (!porReino[d.reinoId]) porReino[d.reinoId] = [];
    porReino[d.reinoId].push(d);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-3xl shadow-2xl overflow-hidden w-full max-w-sm"
        style={{ background: esLadron ? "linear-gradient(160deg, #7f1d1d 0%, #450a0a 100%)" : "linear-gradient(160deg, #1e3a8a 0%, #172554 100%)", border: `3px solid ${esLadron ? "#F87171" : "#60A5FA"}` }}>
        <div className="p-6 text-center">
          <div className="text-[11px] font-bold text-white/70 uppercase tracking-[0.2em] mb-3">🎲 Resultado del Dado</div>
          <div className="flex justify-center gap-2 mb-3">
            <div className="w-16 h-16 rounded-xl bg-white text-slate-800 text-3xl font-bold flex items-center justify-center shadow-lg">{dado}</div>
          </div>

          {esLadron ? (
            <>
              <div className="text-5xl mb-2">🔒</div>
              <h2 className="text-xl font-bold text-white mb-2">¡Salió el Ladrón!</h2>
              {provinciaBloqueada ? (
                <p className="text-sm text-rose-100">Bloqueó: <b>{provinciaBloqueada.nombre.split("— ")[1] || provinciaBloqueada.nombre}</b> — no va a producir hasta el próximo 7.</p>
              ) : (
                <p className="text-sm text-rose-100">No había ninguna provincia libre para bloquear.</p>
              )}
            </>
          ) : Object.keys(porReino).length === 0 ? (
            <>
              <div className="text-5xl mb-2">🌾</div>
              <h2 className="text-xl font-bold text-white mb-2">Ninguna provincia produjo</h2>
              <p className="text-sm text-blue-100">Ningún Reino tiene una provincia con el número {dado} en este momento.</p>
            </>
          ) : (
            <>
              <div className="text-5xl mb-3">🌾</div>
              <h2 className="text-lg font-bold text-white mb-3">¡Producción!</h2>
              <div className="space-y-2 text-left">
                {Object.entries(porReino).map(([reinoId, items]) => {
                  const reino = reinos.find((r) => String(r.id) === String(reinoId));
                  return (
                    <div key={reinoId} className="bg-white/10 rounded-xl p-2.5">
                      <div className="text-sm font-bold text-white mb-1">{reino?.emoji} {reino?.nombre}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((it, i) => (
                          <span key={i} className="text-[11px] bg-white/15 text-blue-50 px-2 py-0.5 rounded-full">{iconoDeMaterial(it.recurso)} +{it.cantidad} {it.recurso}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <button onClick={onClose} className="text-sm font-semibold px-6 py-2.5 rounded-xl bg-white text-slate-800 mt-5">Continuar</button>
        </div>
      </div>
    </div>
  );
}

function CartaReveladaModal({ evento, detalle, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-3xl shadow-2xl overflow-hidden w-full max-w-sm"
        style={{ background: "linear-gradient(160deg, #451a80 0%, #2d1155 100%)", border: "3px solid #C084FC" }}>
        <div className="p-6 text-center">
          <div className="text-[11px] font-bold text-violet-300 uppercase tracking-[0.2em] mb-3">🎲 Carta de Destino Inesperado</div>
          <div className="text-7xl mb-3">{iconoDeEfecto(evento)}</div>
          <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "Georgia, serif" }}>{evento.titulo}</h2>
          {evento.descripcion && <p className="text-sm text-violet-100 italic mb-4">{evento.descripcion}</p>}
          <div className="bg-white/10 rounded-2xl p-3 mb-5">
            <p className="text-sm text-white font-semibold">{textoDeEfecto(evento, detalle)}</p>
          </div>
          <button onClick={onClose} className="text-sm font-semibold px-6 py-2.5 rounded-xl bg-white text-violet-700">Continuar</button>
        </div>
      </div>
    </div>
  );
}

const EFECTOS_INFO = {
  gp_todos: { label: "Suma/resta GP a TODOS los Reinos", necesitaValor: true },
  fp_todos: { label: "Suma/resta FP a TODOS los Reinos", necesitaValor: true },
  gp_aleatorio: { label: "Suma/resta GP a UN Reino al azar", necesitaValor: true },
  bloquear_provincia_aleatoria: { label: "Bloquea una provincia al azar (como el Ladrón)", necesitaValor: false },
  liberar_provincias: { label: "Libera todas las provincias bloqueadas", necesitaValor: false },
  producir_extra: { label: "Ronda de producción extra (tira el dado sola)", necesitaValor: false },
  ninguno: { label: "Sin efecto — solo un mensaje narrativo", necesitaValor: false },
};

function CartaDestinoCard({ sesion, reinos, provincias, onCambio }) {
  const [eventos, setEventos] = useState([]);
  const [eventoElegidoId, setEventoElegidoId] = useState("");
  const [aplicando, setAplicando] = useState(false);
  const [revelada, setRevelada] = useState(null); // { evento, detalle }
  const [formAbierto, setFormAbierto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [efectoTipo, setEfectoTipo] = useState("gp_todos");
  const [efectoValor, setEfectoValor] = useState(5);
  const [cargandoSemilla, setCargandoSemilla] = useState(false);

  const cargar = () => api.fetchComarcaEventos().then(setEventos);
  useEffect(() => { cargar(); }, []);

  const cargarSemilla = async () => {
    setCargandoSemilla(true);
    try {
      await api.cargarEventosSemilla();
      cargar();
    } catch (e) {
      alert("Error al cargar las cartas: " + e.message);
    }
    setCargandoSemilla(false);
  };

  const crearEvento = async () => {
    if (!titulo.trim()) return;
    await api.crearComarcaEvento({ titulo: titulo.trim(), descripcion: descripcion.trim() || null, efecto_tipo: efectoTipo, efecto_valor: parseInt(efectoValor, 10) || 0 });
    setTitulo(""); setDescripcion(""); setFormAbierto(false);
    cargar();
  };

  const eliminarEvento = async (id) => { await api.eliminarComarcaEvento(id); cargar(); };

  const sacarCarta = async () => {
    const evento = eventos[Math.floor(Math.random() * eventos.length)];
    if (!evento) { alert("Todavía no armaste ninguna Carta de Destino en el catálogo."); return; }
    await aplicar(evento);
  };

  const aplicar = async (evento) => {
    setAplicando(true);
    try {
      const detalle = await api.aplicarEventoComarca(sesion.id, evento, reinos, provincias);
      setRevelada({ evento, detalle });
      onCambio();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setAplicando(false);
  };

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 mb-4">
      <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
        <div className="text-xs font-bold text-amber-700 uppercase tracking-wide">🎲 Carta de Destino Inesperado</div>
        <button onClick={() => setFormAbierto((v) => !v)} className="text-[11px] text-amber-700 underline">{formAbierto ? "Cerrar catálogo" : "+ Crear carta nueva"}</button>
      </div>

      {sesion.evento_actual && <p className="text-sm text-amber-800 mb-2">📜 Última carta: {sesion.evento_actual}</p>}

      {formAbierto && (
        <div className="bg-white/70 rounded-xl p-3 mb-3 space-y-1.5">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (ej: Peste Fiscal)" className="w-full text-sm rounded-lg px-2 py-1.5 border border-amber-200 outline-none" />
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción narrativa (opcional)" className="w-full text-xs rounded-lg px-2 py-1.5 border border-amber-200 outline-none" />
          <select value={efectoTipo} onChange={(e) => setEfectoTipo(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-amber-200 outline-none bg-white">
            {Object.entries(EFECTOS_INFO).map(([key, info]) => <option key={key} value={key}>{info.label}</option>)}
          </select>
          {EFECTOS_INFO[efectoTipo].necesitaValor && (
            <input type="number" value={efectoValor} onChange={(e) => setEfectoValor(e.target.value)} placeholder="Cantidad (puede ser negativa)" className="w-full text-xs rounded-lg px-2 py-1.5 border border-amber-200 outline-none" />
          )}
          <button onClick={crearEvento} className="w-full text-xs font-semibold py-1.5 rounded-lg bg-amber-500 text-white">Agregar al catálogo</button>

          {eventos.length > 0 && (
            <div className="pt-2 space-y-1">
              {eventos.map((ev) => (
                <div key={ev.id} className="flex justify-between items-center text-xs bg-white rounded-lg px-2 py-1">
                  <span>{iconoDeEfecto(ev)} {ev.titulo}</span>
                  <button onClick={() => eliminarEvento(ev.id)} className="text-slate-300 hover:text-rose-500">🗑</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {eventos.length === 0 ? (
        <div className="bg-white/70 border border-dashed border-amber-300 rounded-xl p-3 text-center">
          <p className="text-xs text-amber-700 mb-2">Todavía no hay ninguna carta cargada en el catálogo.</p>
          <button disabled={cargandoSemilla} onClick={cargarSemilla} className="text-sm font-semibold px-4 py-2 rounded-lg bg-orange-500 text-white disabled:opacity-60">
            {cargandoSemilla ? "Cargando 30 cartas…" : "🎴 Cargar 30 cartas de ejemplo"}
          </button>
        </div>
      ) : (
        <div className="flex gap-2 items-center flex-wrap">
          <select value={eventoElegidoId} onChange={(e) => setEventoElegidoId(e.target.value)} className="flex-1 min-w-[160px] text-sm rounded-lg px-3 py-2 border border-amber-200 outline-none bg-white">
            <option value="">Elegir una carta puntual…</option>
            {eventos.map((ev) => <option key={ev.id} value={ev.id}>{ev.titulo}</option>)}
          </select>
          <button disabled={aplicando || !eventoElegidoId} onClick={() => aplicar(eventos.find((e) => e.id === parseInt(eventoElegidoId, 10)))}
            className="text-xs font-semibold px-3 py-2 rounded-lg bg-amber-500 text-white disabled:opacity-50">Aplicar esta</button>
          <button disabled={aplicando} onClick={sacarCarta} className="text-xs font-semibold px-3 py-2 rounded-lg bg-orange-500 text-white disabled:opacity-50">
            {aplicando ? "Sacando…" : "🎴 Sacar al azar"}
          </button>
        </div>
      )}

      {revelada && <CartaReveladaModal evento={revelada.evento} detalle={revelada.detalle} onClose={() => setRevelada(null)} />}
    </div>
  );
}

function TableroSesion({ sesion: sesionInicial, onVolver }) {
  const [sesion, setSesion] = useState(sesionInicial);
  const [reinos, setReinos] = useState([]);
  const [provincias, setProvincias] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [billetes, setBilletes] = useState([]);
  const [recursos, setRecursos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [primeraCarga, setPrimeraCarga] = useState(true);
  const [tirandoDado, setTirandoDado] = useState(false);
  const [resultadoDado, setResultadoDado] = useState(null);
  const [ajustandoEconomiaDe, setAjustandoEconomiaDe] = useState(null);
  const [transfiriendo, setTransfiriendo] = useState(null);
  const [bancoAbierto, setBancoAbierto] = useState(false);
  const [truequesAbierto, setTruequesAbierto] = useState(false);
  const [inventarioAbierto, setInventarioAbierto] = useState(false);
  const [mapaAbierto, setMapaAbierto] = useState(false);
  const [reajustandoAbierto, setReajustandoAbierto] = useState(false);
  const [recursosAbierto, setRecursosAbierto] = useState(false);
  const [duelosAbierto, setDuelosAbierto] = useState(false);
  const [rolesAbierto, setRolesAbierto] = useState(false);
  const [qrAbierto, setQrAbierto] = useState(false);
  const [misionesAbierto, setMisionesAbierto] = useState(false);
  const [tarjetasRolAbierto, setTarjetasRolAbierto] = useState(false);
  const [evento, setEvento] = useState(sesion.evento_actual || "");
  const [guardandoEvento, setGuardandoEvento] = useState(false);

  const cargar = () => {
    Promise.all([api.fetchReinosDeSesion(sesion.id), api.fetchProvinciasDeSesion(sesion.id), api.fetchInventarioDeSesion(sesion.id), api.fetchBilletesDeSesion(sesion.id), api.fetchRecursosDeSesion(sesion.id)]).then(([r, p, inv, bil, rec]) => {
      setReinos(r); setProvincias(p); setInventario(inv); setBilletes(bil); setRecursos(rec); setCargando(false); setPrimeraCarga(false);
    });
  };
  useEffect(() => { cargar(); }, [sesion.id]);

  const tirarDado = async () => {
    setTirandoDado(true);
    try {
      const { dado, provinciaBloqueada } = await api.tirarDado(sesion.id, provincias);
      let detalleProduccion = [];
      if (dado !== 7) detalleProduccion = await api.producirPorDado(sesion.id, dado, provincias);
      setResultadoDado({ dado, provinciaBloqueada, detalleProduccion });
      setSesion((prev) => ({ ...prev, ultimo_dado: dado }));
      cargar();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setTirandoDado(false);
  };

  const guardarEvento = async () => {
    setGuardandoEvento(true);
    try { await api.guardarEventoSesion(sesion.id, evento.trim() || null); } catch (e) { alert(e.message); }
    setGuardandoEvento(false);
  };

  const finalizar = async () => {
    if (!confirm("¿Finalizar esta sesión? El tablero queda guardado como historial, pero no se va a poder seguir jugando en ella.")) return;
    await api.finalizarSesionComarca(sesion.id);
    onVolver();
  };

  if (primeraCarga) return <div className="text-sm text-slate-400">Cargando el tablero…</div>;

  return (
    <div>
      <button onClick={onVolver} className="text-sm text-violet-500 mb-3">← Volver a mis sesiones</button>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-white">🗺️ {sesion.titulo}</h2>
          <p className="text-sm text-slate-400">Curso {sesion.grado_id} · {sesion.fecha} · {sesion.estado === "activa" ? "🟢 En juego" : "⚪ Finalizada"}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMapaAbierto(true)} className="text-xs font-semibold px-3 py-2 rounded-full bg-violet-100 text-violet-700">🗺️ Ver Mapa</button>
          <button onClick={() => setReajustandoAbierto(true)} className="text-xs font-semibold px-3 py-2 rounded-full bg-cyan-100 text-cyan-700">🛠️ Reajustar Provincias</button>
          <button onClick={() => setBancoAbierto(true)} className="text-xs font-semibold px-3 py-2 rounded-full bg-amber-100 text-amber-700">🏦 El Banco</button>
          <button onClick={() => setTruequesAbierto(true)} className="text-xs font-semibold px-3 py-2 rounded-full bg-teal-100 text-teal-700">🤝 Trueques</button>
          <button onClick={() => setInventarioAbierto(true)} className="text-xs font-semibold px-3 py-2 rounded-full bg-indigo-100 text-indigo-700">📋 Inventario</button>
          <button onClick={() => setRecursosAbierto(true)} className="text-xs font-semibold px-3 py-2 rounded-full bg-emerald-100 text-emerald-700">📦 Recursos</button>
          <button onClick={() => setDuelosAbierto(true)} className="text-xs font-semibold px-3 py-2 rounded-full bg-rose-100 text-rose-700">⚔️ Duelos</button>
          <button onClick={() => setRolesAbierto(true)} className="text-xs font-semibold px-3 py-2 rounded-full bg-fuchsia-100 text-fuchsia-700">🎭 Roles</button>
          <button onClick={() => setQrAbierto(true)} className="text-xs font-semibold px-3 py-2 rounded-full bg-slate-100 text-slate-700">📱 Tarjetas QR</button>
          <button onClick={() => setMisionesAbierto(true)} className="text-xs font-semibold px-3 py-2 rounded-full bg-orange-100 text-orange-700">📜 Misiones Secretas</button>
          <button onClick={() => setTarjetasRolAbierto(true)} className="text-xs font-semibold px-3 py-2 rounded-full bg-fuchsia-100 text-fuchsia-700">🖨️ Imprimir Tarjetas de Rol</button>
          {sesion.estado === "activa" && (
            <button onClick={finalizar} className="text-xs font-semibold px-3 py-2 rounded-full border border-slate-200 text-slate-600">🏁 Finalizar sesión</button>
          )}
        </div>
      </div>

      {/* El Dado — producción de recursos */}
      <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs font-bold text-indigo-700 uppercase tracking-wide mb-1">🎲 El Dado (producción de recursos)</div>
          {sesion.ultimo_dado ? (
            <div className="text-sm text-slate-600">
              Último resultado: <span className="text-2xl font-bold text-indigo-700">{sesion.ultimo_dado}</span>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Todavía no se tiró el dado en esta sesión.</p>
          )}
        </div>
        <button disabled={tirandoDado} onClick={tirarDado} className="text-sm font-semibold px-4 py-2.5 rounded-xl bg-indigo-500 text-white disabled:opacity-60 shrink-0">
          {tirandoDado ? "Tirando…" : "🎲 Tirar el Dado"}
        </button>
      </div>

      {resultadoDado && <DadoReveladoModal resultado={resultadoDado} reinos={reinos} onClose={() => setResultadoDado(null)} />}

      {/* Carta de Destino actual */}
      <CartaDestinoCard sesion={sesion} reinos={reinos} provincias={provincias} onCambio={cargar} />

      {/* Los 6 reinos */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {reinos.map((reino) => {
          const susProvincias = provincias.filter((p) => p.reino_actual_id === reino.id);
          return (
            <div key={reino.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="relative h-24 bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center">
                {reino.imagen_url ? (
                  <img src={reino.imagen_url} alt={reino.nombre} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl">{reino.emoji}</span>
                )}
                <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                  <CambiarEmojiReino reino={reino} onGuardado={cargar} />
                  <SubirImagenReino reino={reino} onGuardado={cargar} />
                </div>
              </div>
              <div className="p-3">
                <div className="font-bold text-slate-800 text-sm mb-1">{reino.emoji} {reino.nombre}</div>
                <div className="flex gap-2 mb-2">
                  <button onClick={() => setAjustandoEconomiaDe(reino)} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700">🪙 {reino.gp} GP</button>
                  <button onClick={() => setAjustandoEconomiaDe(reino)} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-violet-100 text-violet-700">🕊️ {reino.fp} FP</button>
                </div>
                <div className="text-[10px] text-slate-400 mb-1">Provincias controladas: {susProvincias.length}/24</div>
                <button onClick={() => setMapaAbierto(true)} className="text-[10px] text-slate-400 hover:text-violet-600 mb-2 underline">Ver detalle en el mapa →</button>
                {inventario.filter((i) => i.reino_id === reino.id && i.cantidad > 0).length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1.5 border-t border-slate-100">
                    {inventario.filter((i) => i.reino_id === reino.id && i.cantidad > 0).map((i) => (
                      <span key={i.id} title={i.comarca_productos?.nombre} className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded-full">
                        {i.comarca_productos?.emoji} x{i.cantidad}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {ajustandoEconomiaDe && <AjustarEconomiaModal sesion={sesion} reino={ajustandoEconomiaDe} billetesDeSesion={billetes} onClose={() => setAjustandoEconomiaDe(null)} onCambio={cargar} />}
      {transfiriendo && <TransferirProvinciaModal provincia={transfiriendo} reinos={reinos} onClose={() => setTransfiriendo(null)} onCambio={cargar} />}
      {bancoAbierto && <BancoModal sesion={sesion} reinos={reinos} onClose={() => setBancoAbierto(false)} onCambio={cargar} />}
      {truequesAbierto && <TruequesModal sesion={sesion} reinos={reinos} inventario={inventario} recursos={recursos} onClose={() => setTruequesAbierto(false)} onCambio={cargar} />}
      {inventarioAbierto && <InventarioImprimibleModal reinos={reinos} inventario={inventario} onClose={() => setInventarioAbierto(false)} />}
      {mapaAbierto && <MapaProvinciasModal sesion={sesion} reinos={reinos} provincias={provincias} onClose={() => setMapaAbierto(false)} onCambio={cargar} />}
      {reajustandoAbierto && <ReajustarProvinciasModal sesion={sesion} reinos={reinos} provincias={provincias} onClose={() => setReajustandoAbierto(false)} onCambio={cargar} />}
      {recursosAbierto && <RecursosModal sesion={sesion} reinos={reinos} recursos={recursos} onClose={() => setRecursosAbierto(false)} onCambio={cargar} />}
      {duelosAbierto && <DuelosModal sesion={sesion} reinos={reinos} provincias={provincias} onClose={() => setDuelosAbierto(false)} onCambio={cargar} />}
      {rolesAbierto && <RolesModal sesion={sesion} reinos={reinos} onClose={() => setRolesAbierto(false)} />}
      {qrAbierto && <QRModal sesion={sesion} reinos={reinos} onClose={() => setQrAbierto(false)} />}
      {misionesAbierto && <MisionesSecretasModal sesion={sesion} reinos={reinos} onClose={() => setMisionesAbierto(false)} />}
      {tarjetasRolAbierto && <TarjetasRolImprimibleModal sesion={sesion} reinos={reinos} onClose={() => setTarjetasRolAbierto(false)} />}
    </div>
  );
}

export function TarjetaComarcaPublica() {
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const sesionId = params.get("sesion");
  const reinoId = params.get("reino");
  const estudianteId = params.get("estudiante");

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [formTruequeAbierto, setFormTruequeAbierto] = useState(false);
  const [reinoDestino, setReinoDestino] = useState("");
  const [otrosReinos, setOtrosReinos] = useState([]);
  const [nombresFantasia, setNombresFantasia] = useState([]);
  const [gpPedido, setGpPedido] = useState(0);
  const [gpOfrecido, setGpOfrecido] = useState(0);
  const [enviando, setEnviando] = useState(false);

  const cargar = () => {
    setCargando(true);
    Promise.all([api.fetchTarjetaReino(sesionId, reinoId), api.fetchNombresFantasiaDeSesion(sesionId)]).then(([d, fantasia]) => { setDatos(d); setNombresFantasia(fantasia); setCargando(false); });
  };
  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, 15000); // se refresca solo cada 15s
    return () => clearInterval(intervalo);
  }, [sesionId, reinoId]);

  useEffect(() => { if (sesionId) api.fetchTodosLosReinosDeSesionPublico(sesionId).then(setOtrosReinos); }, [sesionId]);

  const miDato = datos?.estudiantesDelReino?.find((e) => String(e.id) === String(estudianteId));
  const miNombre = nombresFantasia.find((n) => String(n.estudiante_id) === String(estudianteId))?.nombre || miDato?.nombre;
  const miRolNombre = miDato?.roles_asignados?.[0]?.roles_clase?.nombre || miDato?.roles_asignados?.roles_clase?.nombre;
  const miRolInfo = miRolNombre ? api.COMARCA_ROLES.find((r) => r.nombre === miRolNombre) : null;

  const enviarTrueque = async () => {
    if (!reinoDestino) { alert("Elegí a qué Reino se lo proponés."); return; }
    setEnviando(true);
    try {
      await api.proponerTrueque({
        sesion_id: sesionId, reino_oferta_id: reinoId, reino_destino_id: reinoDestino,
        gp_ofrecido: parseInt(gpOfrecido, 10) || 0, gp_pedido: parseInt(gpPedido, 10) || 0,
      });
      alert("¡Propuesta enviada! El docente la va a revisar.");
      setFormTruequeAbierto(false); setGpOfrecido(0); setGpPedido(0);
    } catch (e) {
      alert("Error: " + e.message);
    }
    setEnviando(false);
  };

  if (!sesionId || !reinoId) return <div className="min-h-screen flex items-center justify-center text-white">Tarjeta inválida.</div>;
  if (cargando || !datos?.reino) return <div className="min-h-screen flex items-center justify-center text-white">Cargando tu Reino…</div>;

  const { reino, provincias, inventario, recursos } = datos;

  return (
    <div className="min-h-screen py-6 px-4" style={{ background: "linear-gradient(135deg, #2d2450 0%, #1e1b30 60%, #14101f 100%)" }}>
      <div className="max-w-sm mx-auto">
        <div className="text-center mb-4">
          <div className="text-4xl mb-1">🏰</div>
          <h1 className="text-white text-lg font-bold tracking-wide" style={{ fontFamily: "Georgia, serif" }}>CÓDICE — Comarca de Oakhaven</h1>
        </div>

        <div className="bg-white rounded-2xl overflow-hidden shadow-xl mb-3">
          <div className="h-28 bg-gradient-to-br from-violet-200 to-fuchsia-200 flex items-center justify-center">
            {reino.imagen_url ? <img src={reino.imagen_url} alt={reino.nombre} className="w-full h-full object-cover" /> : <span className="text-5xl">{reino.emoji}</span>}
          </div>
          <div className="p-4">
            <div className="text-lg font-bold text-slate-800">{reino.emoji} {reino.nombre}</div>
            {miNombre && <div className="text-xs text-violet-600 font-semibold">{miNombre}{miRolNombre ? ` · ${miRolInfo?.emoji || "🎭"} ${miRolNombre}` : ""}</div>}
            <div className="flex gap-2 mt-3">
              <div className="flex-1 bg-amber-50 rounded-xl p-2 text-center"><div className="text-xl font-bold text-amber-700">{reino.gp}</div><div className="text-[10px] text-amber-600">🪙 GP</div></div>
              <div className="flex-1 bg-violet-50 rounded-xl p-2 text-center"><div className="text-xl font-bold text-violet-700">{reino.fp}</div><div className="text-[10px] text-violet-600">🕊️ FP</div></div>
            </div>
          </div>
        </div>

        <div className="bg-white/95 rounded-2xl p-3 mb-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">🗺️ Provincias ({provincias.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {provincias.length === 0 ? <p className="text-xs text-slate-400">Todavía ninguna.</p> : provincias.map((p) => (
              <span key={p.id} className="text-[10px] bg-slate-100 px-2 py-1 rounded-full">{p.nombre.split("— ")[1] || p.nombre} ({p.numero_dado}){p.nivel === "ciudad" ? " 🏙️" : ""}</span>
            ))}
          </div>
        </div>

        {recursos.some((r) => r.cantidad > 0) && (
          <div className="bg-white/95 rounded-2xl p-3 mb-3">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">📦 Recursos</div>
            <div className="flex flex-wrap gap-1.5">
              {recursos.filter((r) => r.cantidad > 0).map((r) => <span key={r.id} className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">{r.recurso}: {r.cantidad}</span>)}
            </div>
          </div>
        )}

        {inventario.some((i) => i.cantidad > 0) && (
          <div className="bg-white/95 rounded-2xl p-3 mb-3">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">🎒 Inventario</div>
            <div className="flex flex-wrap gap-1.5">
              {inventario.filter((i) => i.cantidad > 0).map((i) => <span key={i.id} className="text-[10px] bg-teal-50 text-teal-700 px-2 py-1 rounded-full">{i.comarca_productos?.emoji} {i.comarca_productos?.nombre} x{i.cantidad}</span>)}
            </div>
          </div>
        )}

        <button onClick={() => setFormTruequeAbierto((v) => !v)} className="w-full text-sm font-semibold py-2.5 rounded-xl bg-violet-500 text-white mb-2">
          {formTruequeAbierto ? "Cerrar" : "🤝 Proponer un trueque"}
        </button>
        {formTruequeAbierto && (
          <div className="bg-white/95 rounded-2xl p-3 mb-3 space-y-2">
            <select value={reinoDestino} onChange={(e) => setReinoDestino(e.target.value)} className="w-full text-xs rounded-lg px-2 py-2 border border-slate-200 outline-none">
              <option value="">¿A qué Reino se lo proponés?</option>
              {otrosReinos.filter((r) => String(r.id) !== String(reinoId)).map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.nombre}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[10px] text-slate-500 block mb-1">Ofrecés GP</label><input type="number" value={gpOfrecido} onChange={(e) => setGpOfrecido(e.target.value)} className="w-full text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none text-center" /></div>
              <div><label className="text-[10px] text-slate-500 block mb-1">Pedís GP</label><input type="number" value={gpPedido} onChange={(e) => setGpPedido(e.target.value)} className="w-full text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none text-center" /></div>
            </div>
            <button disabled={enviando} onClick={enviarTrueque} className="w-full text-sm font-semibold py-2 rounded-lg bg-teal-500 text-white disabled:opacity-60">{enviando ? "Enviando…" : "Enviar propuesta"}</button>
          </div>
        )}

        <p className="text-center text-[10px] text-violet-200 mt-4">Se actualiza solo cada 15 segundos — o tocá para actualizar ya.</p>
        <button onClick={cargar} className="w-full text-xs text-violet-200 underline mt-1">🔄 Actualizar ahora</button>
      </div>
    </div>
  );
}

export function VistaComarcaOakhaven({ grados, gradoActivo }) {
  const [sesiones, setSesiones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [sesionAbierta, setSesionAbierta] = useState(null);
  const [creandoAbierto, setCreandoAbierto] = useState(false);
  const [editandoSesion, setEditandoSesion] = useState(null);
  const [gradoId, setGradoId] = useState(gradoActivo || grados[0]?.id || "");
  const [titulo, setTitulo] = useState("Comarca de Oakhaven");
  const [catalogoReinos, setCatalogoReinos] = useState([]);
  const [reinosSeleccionados, setReinosSeleccionados] = useState([]);
  const [cargandoReinos, setCargandoReinos] = useState(false);
  const [creando, setCreando] = useState(false);

  const cargar = () => { setCargando(true); api.fetchSesionesComarca().then((d) => { setSesiones(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    if (!gradoId) return;
    setCargandoReinos(true);
    api.fetchReinosDelCurso(gradoId).then((r) => { setCatalogoReinos(r); setReinosSeleccionados(r); setCargandoReinos(false); });
  }, [gradoId]);

  const toggleReino = (nombre) => {
    setReinosSeleccionados((prev) => prev.includes(nombre) ? prev.filter((r) => r !== nombre) : [...prev, nombre]);
  };

  const crear = async () => {
    if (reinosSeleccionados.length < 2) { alert("Elegí al menos 2 Reinos para que jueguen en esta sesión."); return; }
    setCreando(true);
    try {
      const nueva = await api.crearSesionComarca(gradoId, titulo.trim() || "Comarca de Oakhaven", reinosSeleccionados);
      setCreandoAbierto(false);
      setSesionAbierta(nueva);
    } catch (e) {
      alert("Error al crear la sesión: " + e.message);
    }
    setCreando(false);
  };

  const guardarEdicionSesion = async () => {
    try {
      await api.editarSesionComarca(editandoSesion.id, { titulo: editandoSesion.titulo.trim() || "Comarca de Oakhaven" });
      setEditandoSesion(null);
      cargar();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const eliminarSesion = async (s, ev) => {
    ev.stopPropagation();
    if (!confirm(`¿Eliminar por completo la sesión "${s.titulo}"? Se borran también sus reinos, provincias, trueques y todo lo demás. No se puede deshacer.`)) return;
    try {
      await api.eliminarSesionComarca(s.id);
      cargar();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  if (sesionAbierta) return <TableroSesion sesion={sesionAbierta} onVolver={() => { setSesionAbierta(null); cargar(); }} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-xl font-bold text-white">🏛️ Comarca de Oakhaven</h2>
          <p className="text-sm text-slate-400">6 Reinos rivales, provincias en disputa, y una economía viva — para vivirlo en el aula.</p>
        </div>
        <button onClick={() => setCreandoAbierto((v) => !v)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">
          {creandoAbierto ? "Cerrar" : "+ Nueva sesión"}
        </button>
      </div>

      {!cargando && (
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 my-3">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">✅ Checklist — ¿qué cursos ya tienen su Comarca?</div>
          <div className="flex flex-wrap gap-1.5">
            {grados.map((g) => {
              const activa = sesiones.find((s) => String(s.grado_id) === String(g.id) && s.estado === "activa");
              return (
                <button key={g.id} onClick={() => activa && setSesionAbierta(activa)}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-full ${activa ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-400 border border-dashed border-slate-300"}`}>
                  {activa ? "✅" : "⬜"} Curso {g.id}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {creandoAbierto && (
        <div className="bg-violet-50 rounded-2xl p-4 my-4">
          <label className="text-xs text-slate-500 block mb-1">Curso</label>
          <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white">
            {grados.map((g) => <option key={g.id} value={g.id}>Curso {g.id}</option>)}
          </select>
          <label className="text-xs text-slate-500 block mb-1">Título de la sesión</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none bg-white" />

          <label className="text-xs text-slate-500 block mb-1">¿Qué Reinos juegan esta sesión?</label>
          {cargandoReinos ? (
            <p className="text-xs text-slate-400 mb-3">Buscando…</p>
          ) : catalogoReinos.length === 0 ? (
            <p className="text-xs text-rose-500 mb-3">Este curso todavía no tiene Reinos asignados a sus estudiantes — hacelo primero desde Estudiantes → Reinos.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {catalogoReinos.map((r, i) => {
                const marcado = reinosSeleccionados.includes(r);
                return (
                  <button key={r} type="button" onClick={() => toggleReino(r)}
                    className={`text-xs font-semibold px-2 py-1 rounded-full border ${marcado ? "bg-violet-500 text-white border-violet-500" : "bg-white text-slate-400 border-slate-200"}`}>
                    {marcado ? "✓ " : ""}{api.COMARCA_REINOS_BASE[i]?.emoji || "🏰"} {r}
                  </button>
                );
              })}
            </div>
          )}

          <p className="text-[11px] text-slate-400 mb-3">Se va a crear un Reino de la Comarca por cada uno de los marcados, con sus 4 provincias, listos para repartir entre las mesas.</p>
          <button disabled={creando || reinosSeleccionados.length < 2} onClick={crear} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
            {creando ? "Creando el tablero…" : "🏛️ Fundar la Comarca"}
          </button>
        </div>
      )}

      {editandoSesion && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setEditandoSesion(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-xs shadow-xl">
            <h4 className="font-bold text-slate-800 mb-2">Editar sesión</h4>
            <input value={editandoSesion.titulo} onChange={(e) => setEditandoSesion({ ...editandoSesion, titulo: e.target.value })} autoFocus
              className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditandoSesion(null)} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
              <button onClick={guardarEdicionSesion} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {cargando ? (
        <div className="text-sm text-slate-400 mt-4">Cargando…</div>
      ) : sesiones.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200 mt-4">
          Todavía no armaste ninguna sesión. Creá la primera con "+ Nueva sesión".
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          {sesiones.map((s) => (
            <div key={s.id} onClick={() => setSesionAbierta(s)} className="bg-white rounded-2xl border border-slate-100 p-4 text-left hover:border-violet-300 cursor-pointer relative">
              <div className="flex justify-between items-start gap-2">
                <div className="font-bold text-slate-800">{s.titulo}</div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); setEditandoSesion(s); }} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
                  <button onClick={(e) => eliminarSesion(s, e)} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
                </div>
              </div>
              <div className="text-xs text-slate-400">Curso {s.grado_id} · {s.fecha}</div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1.5 inline-block ${s.estado === "activa" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {s.estado === "activa" ? "🟢 En juego" : "⚪ Finalizada"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
