import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { agruparPorNivel, ordenarPorApellido } from "../lib/gamification";

function ObjetoForm({ objeto, onCancelar, onGuardado }) {
  const [nombre, setNombre] = useState(objeto?.nombre || "");
  const [emoji, setEmoji] = useState(objeto?.emoji || "🎒");
  const [descripcion, setDescripcion] = useState(objeto?.descripcion || "");
  const [tipo, setTipo] = useState(objeto?.tipo || "consumible");
  const [efectoVida, setEfectoVida] = useState(objeto?.efecto_vida ?? 0);
  const [costo, setCosto] = useState(objeto?.costo_monedas ?? 10);
  const [comprable, setComprable] = useState(objeto?.comprable ?? true);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!nombre.trim()) { alert("Ponele un nombre al objeto."); return; }
    setGuardando(true);
    try {
      const campos = {
        nombre: nombre.trim(), emoji: emoji.trim() || "🎒", descripcion: descripcion.trim() || null,
        tipo, efecto_vida: parseInt(efectoVida, 10) || 0, costo_monedas: parseInt(costo, 10) || 0, comprable,
      };
      if (objeto) await api.editarObjeto(objeto.id, campos);
      else await api.crearObjeto(campos);
      onGuardado();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-2xl p-4 mb-3">
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🎒" className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white text-center" />
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del objeto" className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
      </div>
      <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción (opcional)"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <div className="grid grid-cols-2 gap-2 mb-2">
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white">
          <option value="consumible">Consumible (se usa y se gasta)</option>
          <option value="coleccionable">Coleccionable (se guarda)</option>
        </select>
        <label className="flex items-center gap-2 text-xs text-slate-600 bg-white rounded-lg px-3 border border-slate-200">
          <input type="checkbox" checked={comprable} onChange={(e) => setComprable(e.target.checked)} /> Aparece en la tienda del estudiante
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Efecto en Vida al usarlo (0 = sin efecto)</label>
          <input type="number" value={efectoVida} onChange={(e) => setEfectoVida(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Costo (monedas)</label>
          <input type="number" value={costo} onChange={(e) => setCosto(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : objeto ? "Guardar cambios" : "Crear objeto"}
        </button>
      </div>
    </div>
  );
}

// Panel para regalarle un objeto a uno o varios estudiantes del curso activo.
function DarObjetoPanel({ objetos, grados, gradoActivo }) {
  const [gradoId, setGradoId] = useState(gradoActivo || grados[0]?.id || "");
  const [estudiantes, setEstudiantes] = useState([]);
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [objetoId, setObjetoId] = useState(objetos[0]?.id || "");
  const [cantidad, setCantidad] = useState(1);
  const [dando, setDando] = useState(false);

  useEffect(() => { if (gradoActivo) setGradoId(gradoActivo); }, [gradoActivo]);
  useEffect(() => { if (!gradoId) return; api.fetchEstudiantesPorGrado(gradoId).then((d) => setEstudiantes(ordenarPorApellido(d))); }, [gradoId]);
  useEffect(() => { if (!objetoId && objetos[0]) setObjetoId(objetos[0].id); }, [objetos]);

  const toggle = (id) => setSeleccionados((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const marcarTodos = () => setSeleccionados(new Set(estudiantes.map((e) => e.id)));

  const dar = async () => {
    if (seleccionados.size === 0) { alert("Elegí al menos un estudiante."); return; }
    const objeto = objetos.find((o) => o.id === objetoId);
    if (!objeto) return;
    setDando(true);
    try {
      await api.darObjetoMasivo([...seleccionados], objetoId, objeto.nombre, parseInt(cantidad, 10) || 1);
      alert(`Le diste "${objeto.nombre}" a ${seleccionados.size} estudiante(s).`);
      setSeleccionados(new Set());
    } catch (e) {
      alert("Error al entregar: " + e.message);
    }
    setDando(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4">
      <h3 className="font-bold text-slate-800 mb-3">🎁 Entregar un objeto</h3>
      <div className="flex flex-wrap gap-2 mb-3">
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {grados.map((g) => <option key={g.id} value={g.id}>Curso {g.id}</option>)}
        </select>
        <select value={objetoId} onChange={(e) => setObjetoId(parseInt(e.target.value, 10))} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {objetos.map((o) => <option key={o.id} value={o.id}>{o.emoji} {o.nombre}</option>)}
        </select>
        <input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="w-20 text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white" />
        <button onClick={marcarTodos} className="text-xs font-semibold px-3 py-2 rounded-full border border-slate-200 text-slate-600">Marcar todos</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-3 max-h-56 overflow-y-auto">
        {estudiantes.map((e) => (
          <label key={e.id} className={`flex items-center gap-1.5 text-xs rounded-lg px-2 py-1.5 border ${seleccionados.has(e.id) ? "bg-violet-50 border-violet-200" : "border-slate-100"}`}>
            <input type="checkbox" checked={seleccionados.has(e.id)} onChange={() => toggle(e.id)} />
            <span className="truncate">{e.nombre}</span>
          </label>
        ))}
      </div>
      <button disabled={dando} onClick={dar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
        {dando ? "Entregando…" : `Entregar a ${seleccionados.size} estudiante(s)`}
      </button>
    </div>
  );
}

export function VistaObjetos({ grados, gradoActivo }) {
  const [objetos, setObjetos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);

  const cargar = () => { setCargando(true); api.fetchObjetosCatalogo().then((d) => { setObjetos(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  const eliminar = async (o) => { if (!confirm(`¿Eliminar "${o.nombre}" del catálogo?`)) return; await api.eliminarObjeto(o.id); cargar(); };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🎒 Objetos</h2>
          <p className="text-sm text-slate-400">Ítems que el estudiante compra con monedas o recibe de vos — algunos restauran Vida al usarlos.</p>
        </div>
        <button onClick={() => { setEditando(null); setFormAbierto((v) => !v); }} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">
          {formAbierto ? "Cerrar" : "+ Nuevo objeto"}
        </button>
      </div>

      {formAbierto && (
        <ObjetoForm objeto={editando} onCancelar={() => { setFormAbierto(false); setEditando(null); }}
          onGuardado={() => { setFormAbierto(false); setEditando(null); cargar(); }} />
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {objetos.map((o) => (
            <div key={o.id} className="bg-white rounded-2xl border border-slate-100 p-3">
              <div className="flex justify-between items-start">
                <div className="text-2xl">{o.emoji}</div>
                <div className="flex gap-1.5">
                  <button onClick={() => { setEditando(o); setFormAbierto(true); }} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
                  <button onClick={() => eliminar(o)} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
                </div>
              </div>
              <div className="text-sm font-semibold text-slate-800 mt-1">{o.nombre}</div>
              {o.descripcion && <div className="text-xs text-slate-500 mt-0.5">{o.descripcion}</div>}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{o.tipo === "consumible" ? "Consumible" : "Coleccionable"}</span>
                {o.efecto_vida > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">❤️ +{o.efecto_vida} Vida</span>}
                {o.comprable && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">🪙 {o.costo_monedas}</span>}
              </div>
            </div>
          ))}
          {objetos.length === 0 && <div className="col-span-full text-sm text-slate-400 text-center py-6">Todavía no hay objetos.</div>}
        </div>
      )}

      {objetos.length > 0 && grados.length > 0 && <DarObjetoPanel objetos={objetos} grados={grados} gradoActivo={gradoActivo} />}
    </div>
  );
}

// ---------------- Lado del estudiante: inventario + tienda ----------------
export function ObjetosEstudiante({ estudianteId, monedas, onMonedasActualizadas }) {
  const [inventario, setInventario] = useState([]);
  const [tienda, setTienda] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(null); // id del objeto sobre el que se está actuando

  const cargar = () => {
    setCargando(true);
    Promise.all([api.fetchInventarioEstudiante(estudianteId), api.fetchObjetosCatalogo()]).then(([inv, cat]) => {
      setInventario(inv);
      setTienda(cat.filter((o) => o.comprable));
      setCargando(false);
    });
  };
  useEffect(() => { cargar(); }, [estudianteId]);

  const usar = async (item) => {
    setOcupado(item.objeto_id);
    try {
      await api.usarObjeto(estudianteId, item.objeto_id, item.objetos_catalogo?.efecto_vida || 0, item.objetos_catalogo?.nombre || "objeto");
      cargar();
      onMonedasActualizadas();
    } catch (e) {
      alert(e.message);
    }
    setOcupado(null);
  };

  const comprar = async (objeto) => {
    setOcupado(objeto.id);
    try {
      await api.comprarObjeto(estudianteId, objeto.id, objeto.costo_monedas, monedas);
      cargar();
      onMonedasActualizadas();
    } catch (e) {
      alert(e.message);
    }
    setOcupado(null);
  };

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;

  return (
    <div className="mt-5">
      <h3 className="font-bold text-slate-800 mb-1">🎒 Mis objetos</h3>
      {inventario.length === 0 ? (
        <p className="text-xs text-slate-400 mb-4">Todavía no tenés objetos — comprá alguno abajo o esperá a que tu docente te regale uno.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {inventario.map((item) => {
            const o = item.objetos_catalogo;
            if (!o) return null;
            return (
              <div key={item.id} className="bg-white rounded-xl border border-slate-100 p-2.5 text-center">
                <div className="text-2xl">{o.emoji}</div>
                <div className="text-xs font-semibold text-slate-700 mt-1">{o.nombre}</div>
                <div className="text-[10px] text-slate-400">Tenés: {item.cantidad}</div>
                {o.tipo === "consumible" ? (
                  <button disabled={ocupado === item.objeto_id} onClick={() => usar(item)}
                    className="text-[11px] font-semibold mt-1.5 px-2 py-1 rounded-full bg-emerald-500 text-white disabled:opacity-60">
                    {ocupado === item.objeto_id ? "…" : o.efecto_vida > 0 ? `Usar (+${o.efecto_vida} ❤️)` : "Usar"}
                  </button>
                ) : (
                  <span className="text-[10px] text-violet-500 mt-1.5 block">✨ Coleccionable</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <h3 className="font-bold text-slate-800 mb-1">🛒 Tienda de objetos</h3>
      <p className="text-xs text-slate-400 mb-2">🪙 Tenés {monedas} monedas.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {tienda.map((o) => (
          <div key={o.id} className="bg-white rounded-xl border border-slate-100 p-2.5 text-center">
            <div className="text-2xl">{o.emoji}</div>
            <div className="text-xs font-semibold text-slate-700 mt-1">{o.nombre}</div>
            {o.efecto_vida > 0 && <div className="text-[10px] text-emerald-600">+{o.efecto_vida} ❤️ al usarlo</div>}
            <button disabled={ocupado === o.id || monedas < o.costo_monedas} onClick={() => comprar(o)}
              className="text-[11px] font-semibold mt-1.5 px-2 py-1 rounded-full bg-amber-500 text-white disabled:opacity-50">
              {ocupado === o.id ? "…" : `🪙 ${o.costo_monedas}`}
            </button>
          </div>
        ))}
        {tienda.length === 0 && <p className="col-span-full text-xs text-slate-400">Todavía no hay objetos en la tienda.</p>}
      </div>
    </div>
  );
}
