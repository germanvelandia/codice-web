import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { EditorTexto, TextoEnriquecido } from "../components/RichText";

function AnuncioForm({ grados, anuncio, onCancelar, onGuardado }) {
  const [titulo, setTitulo] = useState(anuncio?.titulo || "");
  const [contenido, setContenido] = useState(anuncio?.contenido || "");
  const [gradoId, setGradoId] = useState(anuncio?.grado_id || "");
  const [fijado, setFijado] = useState(anuncio?.fijado || false);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!titulo.trim() || !contenido.trim()) { alert("Completá el título y el mensaje."); return; }
    setGuardando(true);
    try {
      const campos = { titulo: titulo.trim(), contenido: contenido.trim(), grado_id: gradoId || null, fijado };
      if (anuncio) await api.editarAnuncio(anuncio.id, campos);
      else await api.crearAnuncio(campos);
      onGuardado();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-2xl p-4 mb-4">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título del anuncio"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <div className="mb-2"><EditorTexto value={contenido} onChange={setContenido} minHeight={110} placeholder="Escribí el mensaje para los estudiantes…" /></div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Dirigido a</label>
          <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white">
            <option value="">Todos los grados</option>
            {grados.map((g) => <option key={g.id} value={g.id}>Solo grado {g.id}</option>)}
          </select>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={fijado} onChange={(e) => setFijado(e.target.checked)} /> 📌 Fijar arriba de todo
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : anuncio ? "Guardar cambios" : "Publicar anuncio"}
        </button>
      </div>
    </div>
  );
}

export function VistaAnuncios({ grados }) {
  const [anuncios, setAnuncios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);

  const cargar = () => { setCargando(true); api.fetchAnuncios().then((d) => { setAnuncios(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  const eliminar = async (a) => { if (!confirm(`¿Eliminar el anuncio "${a.titulo}"?`)) return; await api.eliminarAnuncio(a.id); cargar(); };
  const toggleFijado = async (a) => { await api.editarAnuncio(a.id, { fijado: !a.fijado }); cargar(); };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">📢 Anuncios</h2>
          <p className="text-sm text-slate-400">Tablero de mensajes visible para los estudiantes en su portal.</p>
        </div>
        <button onClick={() => { setEditando(null); setFormAbierto((v) => !v); }} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">
          {formAbierto ? "Cerrar" : "+ Nuevo anuncio"}
        </button>
      </div>

      {formAbierto && (
        <AnuncioForm grados={grados} anuncio={editando} onCancelar={() => setFormAbierto(false)} onGuardado={() => { setFormAbierto(false); setEditando(null); cargar(); }} />
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : anuncios.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">
          Todavía no publicaste ningún anuncio.
        </div>
      ) : (
        <div className="space-y-2">
          {anuncios.map((a) => (
            <div key={a.id} className={`bg-white rounded-2xl border p-4 ${a.fijado ? "border-amber-300" : "border-slate-100"}`}>
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.fijado && <span className="text-[10px]">📌</span>}
                    <h4 className="font-bold text-slate-800">{a.titulo}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">{a.grado_id ? `Grado ${a.grado_id}` : "Todos los grados"}</span>
                  </div>
                  <TextoEnriquecido html={a.contenido} className="text-xs text-slate-500 mt-1" />
                  <p className="text-[10px] text-slate-400 mt-1.5">{a.autor_nombre} · {new Date(a.creado_en).toLocaleDateString("es-CO")}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleFijado(a)} className="text-xs text-slate-400 hover:text-amber-500" title="Fijar/desfijar">📌</button>
                  <button onClick={() => { setEditando(a); setFormAbierto(true); }} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
                  <button onClick={() => eliminar(a)} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
