import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { ACCIONES_RAPIDAS, initials, nextLevel, reinoColor } from "../lib/gamification";
import * as api from "../lib/api";

function LevelBar({ xp }) {
  const { level, next, pct } = nextLevel(xp);
  return (
    <div className="mb-1">
      <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
        <span className="font-semibold text-violet-600">{level.name}</span>
        <span>{xp}{next ? ` / ${next.min} XP` : " XP · nivel máximo"}</span>
      </div>
      <div className="h-2 rounded-full bg-violet-100 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
function VidaBar({ vida }) {
  const color = vida > 50 ? "from-emerald-400 to-emerald-500" : vida > 20 ? "from-amber-400 to-amber-500" : "from-rose-500 to-rose-600";
  return (
    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${vida}%` }} />
    </div>
  );
}

function QuickGamify({ estudiante, onAplicado }) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);

  const aplicar = async (accion) => {
    setCargando(true);
    try {
      const nuevo = await api.registrarAccion(estudiante.id, accion);
      onAplicado(estudiante.id, nuevo);
    } catch (e) {
      alert("No se pudo registrar: " + e.message);
    }
    setCargando(false);
    setAbierto(false);
  };

  return (
    <div className="relative">
      <button onClick={() => setAbierto((v) => !v)} className="text-xs px-3 py-1.5 rounded-full bg-violet-500 text-white font-semibold">
        ⚡ Puntos
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 mt-2 z-20 w-72 bg-white rounded-2xl shadow-xl p-3 border border-slate-100">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-2">Reconocer</div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {ACCIONES_RAPIDAS.filter((a) => a.tipo === "positiva").map((a) => (
                <button key={a.key} disabled={cargando} onClick={() => aplicar(a)} className="text-xs text-left px-2.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                  {a.label}<div className="text-[10px] opacity-70">+{a.xp} XP</div>
                </button>
              ))}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-2">Llamar la atención</div>
            <div className="grid grid-cols-2 gap-2">
              {ACCIONES_RAPIDAS.filter((a) => a.tipo === "negativa").map((a) => (
                <button key={a.key} disabled={cargando} onClick={() => aplicar(a)} className="text-xs text-left px-2.5 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100">
                  {a.label}<div className="text-[10px] opacity-70">{a.xp} XP</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TarjetaEstudiante({ estudiante, onQuitar, onAplicado, reinos, onCambiarReino }) {
  const progreso = estudiante.progreso?.[0] || estudiante.progreso || { xp: 0, vida: 100, monedas: 0 };
  const reino = estudiante.reino_actual || estudiante.reino_original || "Sin grupo";
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <div className="flex items-start gap-3 mb-2">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: `${reinoColor(reino)}22`, color: reinoColor(reino) }}>
          {initials(estudiante.nombre)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-800 truncate">{estudiante.nombre}</div>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <select value={reino} onChange={(e) => onCambiarReino(estudiante.id, e.target.value)} className="text-xs bg-transparent outline-none">
              {reinos.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="text-xs text-amber-500 font-semibold shrink-0">🪙 {progreso.monedas || 0}</div>
      </div>
      <LevelBar xp={progreso.xp || 0} />
      <VidaBar vida={progreso.vida ?? 100} />
      <div className="flex justify-between items-center mt-3">
        <button onClick={() => onQuitar(estudiante.id)} className="text-xs text-slate-400 hover:text-rose-500">Quitar</button>
        <QuickGamify estudiante={estudiante} onAplicado={onAplicado} />
      </div>
    </div>
  );
}

export function VistaEstudiantes({ gradoId, reinoFiltro, onVolver }) {
  const [estudiantes, setEstudiantes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [query, setQuery] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoReino, setNuevoReino] = useState("Sin grupo");

  const cargar = async () => {
    setCargando(true);
    const data = await api.fetchEstudiantesPorGrado(gradoId);
    setEstudiantes(data);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, [gradoId]);

  const reinos = useMemo(() => {
    const set = new Set(estudiantes.map((s) => s.reino_actual || s.reino_original || "Sin grupo"));
    set.add("Sin grupo");
    return Array.from(set);
  }, [estudiantes]);

  const visibles = estudiantes
    .filter((s) => !reinoFiltro || (s.reino_actual || s.reino_original) === reinoFiltro)
    .filter((s) => s.nombre.toLowerCase().includes(query.toLowerCase()));

  const actualizarProgresoLocal = (id, nuevo) => {
    setEstudiantes((prev) => prev.map((s) => (s.id === id ? { ...s, progreso: [nuevo] } : s)));
  };

  const agregar = async () => {
    if (!nuevoNombre.trim()) return;
    await api.crearEstudiante({ nombre: nuevoNombre.trim(), grado_id: gradoId, reino_original: nuevoReino });
    setNuevoNombre("");
    cargar();
  };

  const quitar = async (id) => {
    if (!confirm("¿Quitar este estudiante de la lista?")) return;
    await api.quitarEstudiante(id);
    cargar();
  };

  const cambiarReino = async (id, reino) => {
    await api.cambiarReino(id, reino);
    setEstudiantes((prev) => prev.map((s) => (s.id === id ? { ...s, reino_actual: reino } : s)));
  };

  return (
    <div>
      <button onClick={onVolver} className="text-sm text-violet-500 mb-3">← Grado {gradoId}</button>
      <h2 className="text-xl font-bold text-slate-800 mb-4">
        {reinoFiltro ? reinoFiltro : `Grado ${gradoId} — todos los estudiantes`}
      </h2>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3 mb-4 flex flex-wrap gap-2">
        <input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Nombre del estudiante"
          className="flex-1 min-w-[180px] text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
        <select value={nuevoReino} onChange={(e) => setNuevoReino(e.target.value)} className="text-sm rounded-lg px-2 py-2 border border-slate-200 outline-none">
          {reinos.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={agregar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white">Agregar</button>
      </div>

      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar estudiante…"
        className="w-full max-w-sm text-sm rounded-full px-4 py-2 border border-slate-200 outline-none mb-4" />

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : visibles.length === 0 ? (
        <div className="text-sm text-slate-400">No hay estudiantes todavía. Agrega el primero arriba.</div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {visibles.map((s) => (
            <TarjetaEstudiante key={s.id} estudiante={s} reinos={reinos} onQuitar={quitar} onCambiarReino={cambiarReino} onAplicado={actualizarProgresoLocal} />
          ))}
        </div>
      )}
    </div>
  );
}

export function VistaReinos({ gradoId, onElegirReino, onVerTodos, onVolver }) {
  const [estudiantes, setEstudiantes] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.fetchEstudiantesPorGrado(gradoId).then((data) => { setEstudiantes(data); setCargando(false); });
  }, [gradoId]);

  const reinos = useMemo(() => {
    const mapa = {};
    estudiantes.forEach((s) => {
      const r = s.reino_actual || s.reino_original || "Sin grupo";
      mapa[r] = (mapa[r] || 0) + 1;
    });
    return Object.entries(mapa);
  }, [estudiantes]);

  return (
    <div>
      <button onClick={onVolver} className="text-sm text-violet-500 mb-3">← Grados</button>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-800">Grado {gradoId} — Reinos</h2>
        <button onClick={onVerTodos} className="text-sm text-violet-500 font-semibold">Ver listado completo →</button>
      </div>
      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : reinos.length === 0 ? (
        <div className="text-sm text-slate-400">Este grado no tiene estudiantes todavía.</div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {reinos.map(([nombre, n]) => (
            <button key={nombre} onClick={() => onElegirReino(nombre)} className="text-left bg-white rounded-2xl p-4 shadow-sm border-t-4"
              style={{ borderTopColor: reinoColor(nombre) }}>
              <div className="font-semibold text-slate-800">{nombre}</div>
              <div className="text-xs text-slate-400 mt-1">{n} estudiante{n === 1 ? "" : "s"}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function VistaGrados({ onElegirGrado }) {
  const [grados, setGrados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nuevoGrado, setNuevoGrado] = useState("");

  const cargar = async () => {
    setCargando(true);
    await api.asegurarGradosBase();
    const data = await api.fetchGrados();
    setGrados(data);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const crear = async () => {
    if (!nuevoGrado.trim()) return;
    await api.crearGrado(nuevoGrado.trim());
    setNuevoGrado("");
    cargar();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-bold text-slate-800">Grados</h2>
        <div className="flex gap-2">
          <input value={nuevoGrado} onChange={(e) => setNuevoGrado(e.target.value)} placeholder="Nuevo grado (ej: 1004)"
            className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none w-40" />
          <button onClick={crear} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white">Crear</button>
        </div>
      </div>
      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
          {grados.map((g) => (
            <button key={g.id} onClick={() => onElegirGrado(g.id)} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 text-center hover:shadow-md">
              <div className="text-2xl font-bold text-violet-600">{g.id}</div>
              <div className="text-xs text-slate-400 mt-1">Grado</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
