import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

const CATEGORIAS = [
  { key: "academico", label: "Académico", emoji: "📘", color: "#3B82F6" },
  { key: "convivencial", label: "Convivencial", emoji: "🤝", color: "#F59E0B" },
];

function BuscadorAnotaciones({ onSeleccionar }) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) { setResultados([]); return; }
    setBuscando(true);
    const id = setTimeout(() => {
      api.buscarEstudiantesGlobal(query).then((r) => { setResultados(r); setBuscando(false); setAbierto(true); });
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  const elegir = (est) => {
    onSeleccionar(est);
    setQuery("");
    setResultados([]);
    setAbierto(false);
  };

  return (
    <div className="relative max-w-md">
      <input value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => resultados.length && setAbierto(true)}
        placeholder="🔍 Buscar estudiante por nombre…"
        className="w-full text-sm rounded-full px-4 py-2.5 border border-slate-200 outline-none bg-white" />
      {abierto && query.trim().length >= 2 && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-100 max-h-64 overflow-y-auto" onMouseLeave={() => setAbierto(false)}>
          {buscando ? (
            <div className="text-xs text-slate-400 p-3">Buscando…</div>
          ) : resultados.length === 0 ? (
            <div className="text-xs text-slate-400 p-3">Sin resultados.</div>
          ) : (
            resultados.map((r) => (
              <button key={r.id} onClick={() => elegir(r)} className="w-full text-left px-3 py-2 text-sm hover:bg-violet-50 flex justify-between items-center">
                <span className="text-slate-700">{r.nombre}</span>
                <span className="text-xs text-slate-400">Grado {r.grado_id}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AnotacionForm({ estudianteId, anotacion, onCancelar, onGuardado }) {
  const [categoria, setCategoria] = useState(anotacion?.categoria || "academico");
  const [contenido, setContenido] = useState(anotacion?.contenido || "");
  const [fecha, setFecha] = useState(anotacion?.fecha || new Date().toISOString().slice(0, 10));
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!contenido.trim()) { alert("Escribí la anotación."); return; }
    setGuardando(true);
    try {
      const campos = { categoria, contenido: contenido.trim(), fecha };
      if (anotacion) await api.editarAnotacion(anotacion.id, campos);
      else await api.crearAnotacion(estudianteId, campos);
      onGuardado();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-2xl p-4 mb-4">
      <div className="flex gap-1 mb-3">
        {CATEGORIAS.map((c) => (
          <button key={c.key} onClick={() => setCategoria(c.key)}
            className={`text-xs px-3 py-1.5 rounded-full border ${categoria === c.key ? "text-white" : "bg-white text-slate-600 border-slate-200"}`}
            style={categoria === c.key ? { background: c.color, borderColor: c.color } : undefined}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>
      <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} rows={4} placeholder="Escribí tu anotación privada…"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <label className="text-[11px] text-slate-500 block mb-1">Fecha</label>
      <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none bg-white" />
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : anotacion ? "Guardar cambios" : "Agregar anotación"}
        </button>
      </div>
    </div>
  );
}

function PanelAnotacionesEstudiante({ estudiante, onVolver }) {
  const [anotaciones, setAnotaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [filtro, setFiltro] = useState("todas");

  const cargar = () => { setCargando(true); api.fetchAnotaciones(estudiante.id).then((d) => { setAnotaciones(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, [estudiante.id]);

  const eliminar = async (a) => { if (!confirm("¿Eliminar esta anotación?")) return; await api.eliminarAnotacion(a.id); cargar(); };
  const visibles = filtro === "todas" ? anotaciones : anotaciones.filter((a) => a.categoria === filtro);

  return (
    <div>
      <button onClick={onVolver} className="text-sm text-violet-500 mb-3">← Buscar otro estudiante</button>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-slate-800">{estudiante.nombre}</h3>
          <p className="text-xs text-slate-400">Grado {estudiante.grado_id} · Tus anotaciones privadas — nadie más las ve</p>
        </div>
        <button onClick={() => { setEditando(null); setFormAbierto((v) => !v); }} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">
          {formAbierto ? "Cerrar" : "+ Nueva anotación"}
        </button>
      </div>

      {formAbierto && (
        <AnotacionForm estudianteId={estudiante.id} anotacion={editando} onCancelar={() => { setFormAbierto(false); setEditando(null); }}
          onGuardado={() => { setFormAbierto(false); setEditando(null); cargar(); }} />
      )}

      <div className="flex gap-1 mb-3 rounded-full bg-white p-1 w-fit border border-slate-100">
        <button onClick={() => setFiltro("todas")} className={`text-xs px-3 py-1.5 rounded-full ${filtro === "todas" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Todas</button>
        {CATEGORIAS.map((c) => (
          <button key={c.key} onClick={() => setFiltro(c.key)} className={`text-xs px-3 py-1.5 rounded-full ${filtro === c.key ? "bg-violet-500 text-white" : "text-slate-600"}`}>{c.emoji} {c.label}</button>
        ))}
      </div>

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : visibles.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">Todavía no tenés anotaciones para este estudiante.</div>
      ) : (
        <div className="space-y-2">
          {visibles.map((a) => {
            const info = CATEGORIAS.find((c) => c.key === a.categoria);
            return (
              <div key={a.id} className="bg-white rounded-xl border border-slate-100 p-3" style={{ borderLeft: `4px solid ${info.color}` }}>
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${info.color}22`, color: info.color }}>{info.emoji} {info.label}</span>
                    <span className="text-[11px] text-slate-400 ml-2">{a.fecha}</span>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => { setEditando(a); setFormAbierto(true); }} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
                    <button onClick={() => eliminar(a)} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
                  </div>
                </div>
                <p className="text-sm text-slate-600 mt-2 whitespace-pre-line">{a.contenido}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function VistaAnotaciones() {
  const [estudianteElegido, setEstudianteElegido] = useState(null);

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">📝 Anotaciones</h2>
      <p className="text-sm text-slate-400 mb-4">Notas rápidas académicas o convivenciales — privadas, exclusivas tuyas (no se comparten con otros docentes ni con el estudiante).</p>

      {!estudianteElegido ? (
        <BuscadorAnotaciones onSeleccionar={setEstudianteElegido} />
      ) : (
        <PanelAnotacionesEstudiante estudiante={estudianteElegido} onVolver={() => setEstudianteElegido(null)} />
      )}
    </div>
  );
}
