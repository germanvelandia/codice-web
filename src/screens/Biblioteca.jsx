import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { agruparPorNivel } from "../lib/gamification";
import { EditorTexto } from "../components/RichText";

const CATEGORIAS = [
  { key: "enlace", label: "Enlace", emoji: "🔗", color: "#8B5CF6" },
  { key: "documento", label: "Documento", emoji: "📄", color: "#3B82F6" },
  { key: "video", label: "Video", emoji: "🎬", color: "#EF4444" },
  { key: "libro", label: "Libro", emoji: "📖", color: "#F59E0B" },
  { key: "audio", label: "Audio", emoji: "🎧", color: "#22C55E" },
];

function catInfo(cat) { return CATEGORIAS.find((c) => c.key === cat) || CATEGORIAS[0]; }

// Un "libro" en la estantería — el lomo coloreado según su categoría
function LomoLibro({ recurso, onEditar, onEliminar }) {
  const info = catInfo(recurso.categoria);
  return (
    <div className="rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow" style={{ width: 92, background: info.color }}>
      <a href={recurso.url} target="_blank" rel="noreferrer" className="block px-2 pt-3 pb-2" style={{ minHeight: 130 }}>
        <div className="text-xl mb-1">{info.emoji}</div>
        <div className="text-[10px] font-bold text-white leading-tight break-words">{recurso.titulo}</div>
      </a>
      <div className="flex justify-center gap-2 bg-black/10 py-1">
        <button onClick={() => onEditar(recurso)} className="text-[10px] text-white/80 hover:text-white">✏️</button>
        <button onClick={() => onEliminar(recurso)} className="text-[10px] text-white/80 hover:text-white">🗑</button>
      </div>
    </div>
  );
}

function RecursoForm({ nivel, recurso, onCancelar, onGuardado }) {
  const [titulo, setTitulo] = useState(recurso?.titulo || "");
  const [descripcion, setDescripcion] = useState(recurso?.descripcion || "");
  const [url, setUrl] = useState(recurso?.url || "");
  const [categoria, setCategoria] = useState(recurso?.categoria || "enlace");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!titulo.trim() || !url.trim()) { alert("Completá el título y el enlace."); return; }
    let urlLimpia = url.trim();
    if (!/^https?:\/\//i.test(urlLimpia)) urlLimpia = "https://" + urlLimpia;
    setGuardando(true);
    try {
      const campos = { titulo: titulo.trim(), descripcion: descripcion.trim() || null, url: urlLimpia, categoria };
      if (recurso) await api.editarRecursoBiblioteca(recurso.id, campos);
      else await api.crearRecursoBiblioteca({ ...campos, nivel });
      onGuardado();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-2xl p-4 mb-4">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título del recurso"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Enlace (URL)"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <div className="mb-2"><EditorTexto value={descripcion} onChange={setDescripcion} minHeight={70} placeholder="Descripción (opcional)" /></div>
      <label className="text-[10px] text-slate-500 block mb-1">Tipo</label>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {CATEGORIAS.map((c) => (
          <button key={c.key} onClick={() => setCategoria(c.key)}
            className={`text-xs px-3 py-1.5 rounded-full border ${categoria === c.key ? "text-white" : "bg-white text-slate-600 border-slate-200"}`}
            style={categoria === c.key ? { background: c.color, borderColor: c.color } : undefined}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : recurso ? "Guardar cambios" : "Agregar a la estantería"}
        </button>
      </div>
    </div>
  );
}

export function VistaBiblioteca({ grados }) {
  const niveles = agruparPorNivel(grados);
  const [nivel, setNivel] = useState(niveles[0]?.nivel || "");
  const [recursos, setRecursos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);

  const cargar = () => { setCargando(true); api.fetchBibliotecaRecursos().then((d) => { setRecursos(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  const recursosDelNivel = recursos.filter((r) => r.nivel === nivel);
  const porCategoria = CATEGORIAS.map((c) => ({ ...c, items: recursosDelNivel.filter((r) => r.categoria === c.key) })).filter((c) => c.items.length > 0);

  const eliminar = async (r) => { if (!confirm(`¿Eliminar "${r.titulo}" de la biblioteca?`)) return; await api.eliminarRecursoBiblioteca(r.id); cargar(); };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800">📚 Biblioteca</h2>
          <p className="text-sm text-slate-400">Enlaces informativos, organizados por grado completo — los ven todos los cursos de ese grado.</p>
        </div>
        <div className="flex gap-2">
          <select value={nivel} onChange={(e) => { setNivel(e.target.value); setFormAbierto(false); }} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
            {niveles.map((n) => <option key={n.nivel} value={n.nivel}>Grado {n.nivel}°</option>)}
          </select>
          <button onClick={() => { setEditando(null); setFormAbierto((v) => !v); }} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">
            {formAbierto ? "Cerrar" : "+ Agregar"}
          </button>
        </div>
      </div>

      {formAbierto && (
        <RecursoForm nivel={nivel} recurso={editando} onCancelar={() => setFormAbierto(false)} onGuardado={() => { setFormAbierto(false); setEditando(null); cargar(); }} />
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : recursosDelNivel.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">
          Todavía no hay nada en la biblioteca del grado {nivel}°.
        </div>
      ) : (
        <div className="space-y-6">
          {porCategoria.map((cat) => (
            <div key={cat.key}>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{cat.emoji} {cat.label}s</div>
              <div className="rounded-xl p-3 flex gap-2 flex-wrap items-end" style={{ background: "linear-gradient(180deg, transparent 85%, #D6B98C 85%, #D6B98C 100%)" }}>
                {cat.items.map((r) => (
                  <LomoLibro key={r.id} recurso={r} onEditar={(rec) => { setEditando(rec); setFormAbierto(true); }} onEliminar={eliminar} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
