import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

const TIPOS_LOGRO = [
  { key: "nivel_xp", label: "XP alcanzado", umbralLabel: "XP necesario" },
  { key: "monedas", label: "Monedas juntadas", umbralLabel: "Monedas necesarias" },
  { key: "coleccion_completa", label: "Álbum completo", umbralLabel: null },
  { key: "codice_entradas", label: "Entradas en el Códice", umbralLabel: "Cantidad de entradas" },
  { key: "evaluaciones_completadas", label: "Evaluaciones completadas", umbralLabel: "Cantidad de evaluaciones" },
  { key: "asistencia_presentes", label: "Asistencias acumuladas", umbralLabel: "Cantidad de asistencias" },
];

function LogroForm({ logro, onCancelar, onGuardado }) {
  const [nombre, setNombre] = useState(logro?.nombre || "");
  const [descripcion, setDescripcion] = useState(logro?.descripcion || "");
  const [emoji, setEmoji] = useState(logro?.emoji || "🏅");
  const [tipo, setTipo] = useState(logro?.tipo || "nivel_xp");
  const [umbral, setUmbral] = useState(logro?.umbral ?? 100);
  const [guardando, setGuardando] = useState(false);

  const tipoInfo = TIPOS_LOGRO.find((t) => t.key === tipo);

  const guardar = async () => {
    if (!nombre.trim()) { alert("Escribe un nombre."); return; }
    setGuardando(true);
    try {
      const campos = { nombre: nombre.trim(), descripcion: descripcion.trim() || null, emoji: emoji.trim() || "🏅", tipo, umbral: tipoInfo?.umbralLabel ? parseInt(umbral, 10) || 0 : 0 };
      if (logro) await api.editarLogro(logro.id, campos);
      else await api.crearLogro({ ...campos, activo: true });
      onGuardado();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-2xl p-4 mb-3">
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🏅" className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white text-center" />
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del logro" className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
      </div>
      <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} placeholder="Descripción (opcional)"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Se desbloquea cuando…</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white">
            {TIPOS_LOGRO.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        {tipoInfo?.umbralLabel && (
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">{tipoInfo.umbralLabel}</label>
            <input type="number" value={umbral} onChange={(e) => setUmbral(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : logro ? "Guardar cambios" : "Crear logro"}
        </button>
      </div>
    </div>
  );
}

function DuplicadosLogrosModal({ onClose, onCambio }) {
  const [grupos, setGrupos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [fusionando, setFusionando] = useState(null);
  const [limpiandoTodo, setLimpiandoTodo] = useState(false);

  const cargar = () => { setCargando(true); api.fetchLogrosDuplicados().then((g) => { setGrupos(g); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  const fusionar = async (grupo, idAConservar) => {
    setFusionando(idAConservar);
    try {
      const idsAEliminar = grupo.filter((l) => l.id !== idAConservar).map((l) => l.id);
      await api.fusionarLogrosDuplicados(idAConservar, idsAEliminar);
      cargar();
      onCambio();
    } catch (e) {
      alert("Error al fusionar: " + e.message);
    }
    setFusionando(null);
  };

  const limpiarTodo = async () => {
    if (!confirm(`¿Limpiar los ${grupos.length} grupo(s) de duplicados de una sola vez? En cada uno se conserva automáticamente la versión que más estudiantes tengan desbloqueada.`)) return;
    setLimpiandoTodo(true);
    try {
      const r = await api.limpiarTodosLosDuplicadosLogros();
      alert(`Listo — se fusionaron ${r.fusionadas} versión(es) duplicada(s) en ${r.grupos} grupo(s).`);
      cargar();
      onCambio();
    } catch (e) {
      alert("Error al limpiar: " + e.message);
    }
    setLimpiandoTodo(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">🧹 Logros duplicados</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Elegí cuál versión conservar de cada nombre repetido, o dejá que la app lo resuelva sola. Los estudiantes que ya lo tenían
          desbloqueado pasan a quedar con la que quede — nadie pierde su insignia.
        </p>
        {!cargando && grupos.length > 0 && (
          <button disabled={limpiandoTodo} onClick={limpiarTodo} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-emerald-500 text-white disabled:opacity-60 mb-3">
            {limpiandoTodo ? "Limpiando…" : `🧹 Limpiar los ${grupos.length} grupo(s) automáticamente`}
          </button>
        )}
        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : grupos.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-4">No hay duplicados. 🎉</div>
        ) : (
          <div className="space-y-4">
            {grupos.map((grupo, i) => (
              <div key={i} className="border border-slate-100 rounded-xl p-3">
                <div className="text-sm font-semibold text-slate-700 mb-2">"{grupo[0].nombre}" — {grupo.length} versiones</div>
                <div className="space-y-1.5">
                  {grupo.map((l) => (
                    <div key={l.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="text-lg">{l.emoji}</span>
                        <span>ID {l.id} · {l.total_desbloqueado} estudiante(s) la tienen</span>
                      </div>
                      <button disabled={fusionando !== null} onClick={() => fusionar(grupo, l.id)} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-500 text-white disabled:opacity-50">
                        {fusionando === l.id ? "Fusionando…" : "Conservar esta"}
                      </button>
                    </div>
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

export function VistaLogros() {
  const [logros, setLogros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [duplicadosAbierto, setDuplicadosAbierto] = useState(false);

  const cargar = () => { setCargando(true); api.fetchLogrosCatalogo().then((d) => { setLogros(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  const toggleActivo = async (l) => { await api.editarLogro(l.id, { activo: !l.activo }); cargar(); };
  const eliminar = async (l) => { if (!confirm(`¿Eliminar el logro "${l.nombre}"? Los estudiantes que ya lo tenían lo conservan en su historial.`)) return; await api.eliminarLogro(l.id); cargar(); };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🏅 Insignias / Logros</h2>
          <p className="text-sm text-slate-400">Se desbloquean solos cuando el estudiante cumple el hito — no hace falta otorgarlos a mano.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setDuplicadosAbierto(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-200 text-amber-600">🧹 Duplicados</button>
          <button onClick={() => { setEditando(null); setFormAbierto((v) => !v); }} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">
            {formAbierto ? "Cerrar" : "+ Nuevo logro"}
          </button>
        </div>
      </div>

      {formAbierto && (
        <LogroForm logro={editando} onCancelar={() => setFormAbierto(false)} onGuardado={() => { setFormAbierto(false); setEditando(null); cargar(); }} />
      )}
      {duplicadosAbierto && <DuplicadosLogrosModal onClose={() => setDuplicadosAbierto(false)} onCambio={cargar} />}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : logros.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">
          Todavía no hay logros en el catálogo.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {logros.map((l) => {
            const tipoInfo = TIPOS_LOGRO.find((t) => t.key === l.tipo);
            return (
              <div key={l.id} className={`bg-white rounded-2xl border p-3 ${l.activo ? "border-slate-100" : "border-slate-100 opacity-50"}`}>
                <div className="flex justify-between items-start">
                  <div className="text-3xl">{l.emoji}</div>
                  <div className="flex gap-1.5">
                    <button onClick={() => { setEditando(l); setFormAbierto(true); }} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
                    <button onClick={() => eliminar(l)} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
                  </div>
                </div>
                <div className="text-sm font-semibold text-slate-800 mt-1">{l.nombre}</div>
                {l.descripcion && <div className="text-xs text-slate-500 mt-1">{l.descripcion}</div>}
                <div className="text-[11px] text-slate-400 mt-1">{tipoInfo?.label}{tipoInfo?.umbralLabel ? `: ${l.umbral}` : ""}</div>
                <button onClick={() => toggleActivo(l)} className={`text-[11px] mt-2 px-2 py-1 rounded-full ${l.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {l.activo ? "Activo" : "Inactivo"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
