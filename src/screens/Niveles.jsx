import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

export function VistaNiveles() {
  const [niveles, setNiveles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoXp, setNuevoXp] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [editNombre, setEditNombre] = useState("");
  const [editXp, setEditXp] = useState("");

  const cargar = () => { setCargando(true); api.fetchNivelesConfig().then((d) => { setNiveles(d.sort((a, b) => a.xp_minimo - b.xp_minimo)); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  const agregar = async () => {
    if (!nuevoNombre.trim()) { alert("Ponele un nombre al nivel."); return; }
    await api.crearNivelConfig(nuevoNombre.trim(), parseInt(nuevoXp, 10) || 0);
    setNuevoNombre(""); setNuevoXp("");
    cargar();
  };

  const empezarEdicion = (n) => { setEditandoId(n.id); setEditNombre(n.nombre); setEditXp(String(n.xp_minimo)); };
  const guardarEdicion = async () => {
    if (!editNombre.trim()) return;
    await api.editarNivelConfig(editandoId, { nombre: editNombre.trim(), xp_minimo: parseInt(editXp, 10) || 0 });
    setEditandoId(null);
    cargar();
  };

  const eliminar = async (n) => {
    if (!confirm(`¿Eliminar el nivel "${n.nombre}"?`)) return;
    await api.eliminarNivelConfig(n.id);
    cargar();
  };

  const restablecer = async () => {
    if (!confirm("¿Restablecer los niveles a los de fábrica (Novato/Aprendiz/Experto/Maestro/Sabio/Leyenda)? Esto borra los tuyos propios y no se puede deshacer.")) return;
    await api.restablecerNivelesConfig();
    cargar();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-slate-800">🏅 Niveles</h2>
        <button onClick={restablecer} className="text-xs text-rose-500">🗑️ Restablecer a los de fábrica</button>
      </div>
      <p className="text-sm text-slate-400 mb-4">
        A partir de cuánta experiencia (XP) el estudiante pasa a cada nivel. Se ve en su Inicio, el Mapa de Territorios y el Ranking.
      </p>

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 mb-4">
          {niveles.map((n) => (
            <div key={n.id} className="flex items-center gap-3 px-4 py-3">
              {editandoId === n.id ? (
                <>
                  <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} autoFocus
                    className="flex-1 text-sm rounded-lg px-3 py-1.5 border border-violet-300 outline-none" />
                  <input type="number" value={editXp} onChange={(e) => setEditXp(e.target.value)}
                    className="w-24 text-sm rounded-lg px-3 py-1.5 border border-violet-300 outline-none" />
                  <span className="text-xs text-slate-400">XP</span>
                  <button onClick={guardarEdicion} className="text-xs text-emerald-600 font-semibold">Guardar</button>
                  <button onClick={() => setEditandoId(null)} className="text-xs text-slate-400">Cancelar</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-semibold text-slate-700">{n.nombre}</span>
                  <span className="text-xs text-slate-400">desde {n.xp_minimo} XP</span>
                  <button onClick={() => empezarEdicion(n)} className="text-xs text-violet-500">✏️</button>
                  <button onClick={() => eliminar(n)} className="text-xs text-rose-400">✕</button>
                </>
              )}
            </div>
          ))}
          {niveles.length === 0 && <div className="px-4 py-6 text-sm text-slate-400 text-center">Todavía no hay niveles configurados.</div>}
        </div>
      )}

      <div className="bg-violet-50 rounded-2xl p-4">
        <p className="text-xs font-semibold text-violet-700 mb-2">+ Agregar nivel</p>
        <div className="flex gap-2">
          <input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Nombre (ej: Campeón)"
            className="flex-1 text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
          <input type="number" value={nuevoXp} onChange={(e) => setNuevoXp(e.target.value)} placeholder="XP mínimo"
            className="w-28 text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
          <button onClick={agregar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white">Agregar</button>
        </div>
      </div>
    </div>
  );
}
