import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabaseClient";
import { ACCIONES_RAPIDAS, ACADEMICO_POS, ACADEMICO_NEG, PILARES, CONVIVENCIAL_POS_EXTRA, CONVIVENCIAL_NEG, initials, nextLevel, reinoColor } from "../lib/gamification";
import * as api from "../lib/api";
import { ActasModal } from "./Actas";

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
  const [tab, setTab] = useState("rapido");
  const [cargando, setCargando] = useState(false);

  const aplicar = async (accion) => {
    setCargando(true);
    try {
      const nuevo = await api.registrarAccion(estudiante.id, accion);
      onAplicado(estudiante.id, nuevo);
      setAbierto(false);
    } catch (e) {
      alert("No se pudo registrar: " + e.message);
    }
    setCargando(false);
  };

  const TABS = [
    { key: "rapido", label: "Rápido" },
    { key: "academico_pos", label: "Académico +" },
    { key: "academico_neg", label: "Académico −" },
    { key: "pilares", label: "Pilares" },
    { key: "conviv_pos", label: "Convivencial +" },
    { key: "conviv_neg", label: "Convivencial −" },
  ];

  const listaActual = () => {
    if (tab === "rapido") return ACCIONES_RAPIDAS.map((a) => ({ label: a.label, xp: a.xp, vida: a.vida, categoria: a.categoria }));
    if (tab === "academico_pos") return ACADEMICO_POS.map((a) => ({ ...a, categoria: "academico" }));
    if (tab === "academico_neg") return ACADEMICO_NEG.map((a) => ({ ...a, categoria: "academico" }));
    if (tab === "pilares") return PILARES.map((a) => ({ ...a, categoria: a.key }));
    if (tab === "conviv_pos") return CONVIVENCIAL_POS_EXTRA.map((a) => ({ ...a, categoria: "convivencial" }));
    if (tab === "conviv_neg") return CONVIVENCIAL_NEG.map((a) => ({ ...a, categoria: "convivencial" }));
    return [];
  };

  return (
    <>
      <button onClick={() => setAbierto(true)} className="text-xs px-3 py-1.5 rounded-full bg-violet-500 text-white font-semibold">
        ⚡ Puntos
      </button>
      {abierto && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setAbierto(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl p-4 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-800">Gamificación — {estudiante.nombre}</h3>
              <button onClick={() => setAbierto(false)} className="text-slate-400">✕</button>
            </div>
            <div className="flex gap-1 mb-3 flex-wrap">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`text-xs px-2.5 py-1.5 rounded-full ${tab === t.key ? "bg-violet-500 text-white" : "bg-violet-50 text-violet-600"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {listaActual().map((a, i) => (
                <button key={i} disabled={cargando} onClick={() => aplicar(a)}
                  className={`text-xs text-left px-2.5 py-2 rounded-xl ${a.xp >= 0 ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-rose-50 text-rose-700 hover:bg-rose-100"}`}>
                  {a.label}<div className="text-[10px] opacity-70">{a.xp > 0 ? "+" : ""}{a.xp} XP</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TarjetaEstudiante({ estudiante, onQuitar, onAplicado, reinos, onCambiarReino, roles, onCambiarRol, onCodigoGenerado }) {
  const [actasAbiertas, setActasAbiertas] = useState(false);
  const [generando, setGenerando] = useState(false);
  const codigo = estudiante.codigo_acceso || null;
  const progreso = estudiante.progreso?.[0] || estudiante.progreso || { xp: 0, vida: 100, monedas: 0 };
  const reino = estudiante.reino_actual || estudiante.reino_original || "Sin grupo";
  const rolActualId = estudiante.roles_asignados?.[0]?.rol_id || estudiante.roles_asignados?.rol_id || "";

  const generarCodigo = async () => {
    setGenerando(true);
    try {
      const nuevo = await api.generarCodigoAcceso(estudiante.id);
      onCodigoGenerado(estudiante.id, nuevo);
    } catch (e) {
      alert("No se pudo generar el código: " + e.message);
    }
    setGenerando(false);
  };

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
          {roles && roles.length > 0 && (
            <select value={rolActualId} onChange={(e) => onCambiarRol(estudiante.id, e.target.value ? parseInt(e.target.value, 10) : null)}
              className="text-xs bg-violet-50 text-violet-600 rounded-full px-2 py-0.5 mt-1 outline-none">
              <option value="">Sin rol</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          )}
        </div>
        <div className="text-xs text-amber-500 font-semibold shrink-0">🪙 {progreso.monedas || 0}</div>
      </div>
      <LevelBar xp={progreso.xp || 0} />
      <VidaBar vida={progreso.vida ?? 100} />
      <div className="flex items-center justify-between mt-2">
        {codigo ? (
          <div className="text-[11px] text-slate-500">🔑 Código: <span className="font-mono font-bold text-violet-600">{codigo}</span></div>
        ) : (
          <button disabled={generando} onClick={generarCodigo} className="text-[11px] text-violet-500 underline">
            {generando ? "Generando…" : "🔑 Generar código de acceso"}
          </button>
        )}
      </div>
      <div className="flex justify-between items-center mt-2">
        <button onClick={() => onQuitar(estudiante.id)} className="text-xs text-slate-400 hover:text-rose-500">Quitar</button>
        <div className="flex gap-1.5">
          <button onClick={() => setActasAbiertas(true)} className="text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">📋 Actas</button>
          <QuickGamify estudiante={estudiante} onAplicado={onAplicado} />
        </div>
      </div>
      {actasAbiertas && <ActasModal estudiante={estudiante} onClose={() => setActasAbiertas(false)} />}
    </div>
  );
}

function ImportarEstudiantesModal({ gradoId, reinoDefault, onClose, onImportado }) {
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const fileRef = useRef(null);

  const procesarFilas = async (filas) => {
    const limpias = filas.filter((f) => f.nombre && f.nombre.trim()).map((f) => ({
      nombre: f.nombre.trim(), grado_id: gradoId, reino_original: (f.reino && f.reino.trim()) || reinoDefault,
    }));
    if (limpias.length === 0) { alert("No se encontraron nombres para importar."); return; }
    setCargando(true);
    try {
      await api.crearEstudiantesMasivo(limpias);
      onImportado(limpias.length);
      onClose();
    } catch (e) {
      alert("Error al importar: " + e.message);
    }
    setCargando(false);
  };

  const procesarPegado = () => {
    const filas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
      const partes = l.split(/\t|;|,/).map((x) => x.trim());
      return { nombre: partes[0], reino: partes[1] };
    });
    procesarFilas(filas);
  };

  const procesarArchivo = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "binary" });
        const hoja = wb.Sheets[wb.SheetNames[0]];
        const arr = XLSX.utils.sheet_to_json(hoja, { header: 1 });
        const filas = arr.filter((r) => r.length && r[0]).map((r) => ({ nombre: String(r[0]), reino: r[1] ? String(r[1]) : undefined }));
        procesarFilas(filas);
      } catch (err) {
        alert("No se pudo leer el archivo. Verifica que sea un .xlsx o .csv válido.");
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">Importar estudiantes — Grado {gradoId}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-1.5">Opción 1 — Pegar lista</div>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6}
          placeholder={"Un estudiante por línea.\nOpcional: 'Nombre, Grupo' por línea.\nEj:\nJuan Pérez, Reino Dorado\nMaría Gómez"}
          className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none font-mono" />
        <button disabled={cargando} onClick={procesarPegado} className="w-full text-sm font-semibold py-2 rounded-lg bg-violet-500 text-white mb-4 disabled:opacity-60">
          {cargando ? "Importando…" : "Importar lo pegado"}
        </button>
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-1.5">Opción 2 — Subir archivo (.xlsx / .csv)</div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { if (e.target.files[0]) procesarArchivo(e.target.files[0]); }} className="text-sm" />
        <p className="text-xs text-slate-400 mt-3">Primera columna: nombre. Segunda columna (opcional): grupo/reino.</p>
      </div>
    </div>
  );
}

function CodigosModal({ estudiantes, onClose, onActualizado }) {
  const [lista, setLista] = useState(estudiantes);
  const [generando, setGenerando] = useState(false);

  const generarUno = async (id) => {
    try {
      const codigo = await api.generarCodigoAcceso(id);
      setLista((prev) => prev.map((s) => (s.id === id ? { ...s, codigo_acceso: codigo } : s)));
      onActualizado(id, codigo);
    } catch (e) {
      alert("No se pudo generar: " + e.message);
    }
  };

  const generarTodos = async () => {
    setGenerando(true);
    try {
      const faltantes = lista.filter((s) => !s.codigo_acceso);
      for (const s of faltantes) { await generarUno(s.id); }
    } catch (e) {
      alert("Error: " + e.message);
    }
    setGenerando(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">Códigos de acceso</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <button disabled={generando} onClick={generarTodos} className="w-full text-sm font-semibold py-2 rounded-lg bg-violet-500 text-white mb-4 disabled:opacity-60">
          {generando ? "Generando…" : "🔑 Generar los que falten"}
        </button>
        <div className="divide-y divide-slate-100">
          {lista.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-700 truncate">{s.nombre}</span>
              {s.codigo_acceso ? (
                <span className="font-mono font-bold text-violet-600 text-sm shrink-0">{s.codigo_acceso}</span>
              ) : (
                <button onClick={() => generarUno(s.id)} className="text-xs text-violet-500 underline shrink-0">Generar</button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-4">Comparte cada código con el estudiante o acudiente correspondiente — con él pueden entrar desde "Soy estudiante" en la pantalla de inicio.</p>
      </div>
    </div>
  );
}

export function VistaEstudiantes({ gradoId, reinoFiltro, onVolver }) {
  const [estudiantes, setEstudiantes] = useState([]);
  const [roles, setRoles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [query, setQuery] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoReino, setNuevoReino] = useState("Sin grupo");
  const [importarAbierto, setImportarAbierto] = useState(false);
  const [codigosAbierto, setCodigosAbierto] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const [data, rolesData] = await Promise.all([api.fetchEstudiantesPorGrado(gradoId), api.fetchRoles()]);
    setEstudiantes(data);
    setRoles(rolesData);
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

  const actualizarCodigoLocal = (id, codigo) => {
    setEstudiantes((prev) => prev.map((s) => (s.id === id ? { ...s, codigo_acceso: codigo } : s)));
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

  const cambiarRol = async (id, rolId) => {
    await api.asignarRol(id, rolId);
    setEstudiantes((prev) => prev.map((s) => (s.id === id ? { ...s, roles_asignados: rolId ? [{ rol_id: rolId }] : [] } : s)));
  };

  return (
    <div>
      <button onClick={onVolver} className="text-sm text-violet-500 mb-3">← Grado {gradoId}</button>
      <h2 className="text-xl font-bold text-slate-800 mb-4">
        {reinoFiltro ? reinoFiltro : `Grado ${gradoId} — todos los estudiantes`}
      </h2>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3 mb-4">
        <div className="flex flex-wrap gap-2 items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wide text-slate-400">Agregar estudiante</div>
          <div className="flex gap-2">
            <button onClick={() => setCodigosAbierto(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">🔑 Ver códigos de acceso</button>
            <button onClick={() => setImportarAbierto(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-100 text-violet-700">📥 Importar varios</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Nombre del estudiante"
            className="flex-1 min-w-[180px] text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
          <select value={nuevoReino} onChange={(e) => setNuevoReino(e.target.value)} className="text-sm rounded-lg px-2 py-2 border border-slate-200 outline-none">
            {reinos.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button onClick={agregar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white">Agregar</button>
        </div>
      </div>
      {importarAbierto && (
        <ImportarEstudiantesModal
          gradoId={gradoId}
          reinoDefault={reinoFiltro || "Sin grupo"}
          onClose={() => setImportarAbierto(false)}
          onImportado={(n) => { cargar(); alert(`Se importaron ${n} estudiantes.`); }}
        />
      )}
      {codigosAbierto && (
        <CodigosModal
          estudiantes={visibles}
          onClose={() => setCodigosAbierto(false)}
          onActualizado={actualizarCodigoLocal}
        />
      )}

      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar estudiante…"
        className="w-full max-w-sm text-sm rounded-full px-4 py-2 border border-slate-200 outline-none mb-4" />

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : visibles.length === 0 ? (
        <div className="text-sm text-slate-400">No hay estudiantes todavía. Agrega el primero arriba.</div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {visibles.map((s) => (
            <TarjetaEstudiante key={s.id} estudiante={s} reinos={reinos} onQuitar={quitar} onCambiarReino={cambiarReino} onAplicado={actualizarProgresoLocal} roles={roles} onCambiarRol={cambiarRol} onCodigoGenerado={actualizarCodigoLocal} />
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
