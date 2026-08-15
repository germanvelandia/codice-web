import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { agruparPorNivel } from "../lib/gamification";
import { EditorTexto, TextoEnriquecido } from "../components/RichText";

function RespuestasConsignaModal({ consigna, onClose }) {
  const [respuestas, setRespuestas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => { api.fetchRespuestasConsigna(consigna.id).then((d) => { setRespuestas(d); setCargando(false); }); }, [consigna.id]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">Respuestas — {consigna.titulo}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <TextoEnriquecido html={consigna.pregunta} className="text-xs text-slate-500 italic mb-3" />
        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : respuestas.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Todavía nadie respondió.</p>
        ) : (
          <div className="space-y-2">
            {respuestas.map((r) => (
              <div key={r.id} className="bg-slate-50 rounded-xl p-3">
                <div className="text-xs font-semibold text-slate-700">{r.estudiante_nombre} <span className="text-slate-400 font-normal">· Grado {r.grado_id} · {r.fecha}</span></div>
                <p className="text-xs text-slate-600 mt-1 whitespace-pre-line">{r.contenido}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConsignaForm({ grados, consigna, onCancelar, onGuardada }) {
  const niveles = agruparPorNivel(grados);
  const [nivel, setNivel] = useState(consigna?.nivel || niveles[0]?.nivel || "");
  const [materiaId, setMateriaId] = useState(consigna?.materia_id || "");
  const [materias, setMaterias] = useState([]);
  const [titulo, setTitulo] = useState(consigna?.titulo || "");
  const [pregunta, setPregunta] = useState(consigna?.pregunta || "");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { api.fetchMaterias().then(setMaterias); }, []);

  const guardar = async () => {
    if (!titulo.trim() || !pregunta.trim()) { alert("Completá el título y la pregunta."); return; }
    setGuardando(true);
    try {
      const campos = { nivel, materia_id: materiaId ? parseInt(materiaId, 10) : null, titulo: titulo.trim(), pregunta: pregunta.trim() };
      if (consigna) await api.editarConsignaCodice(consigna.id, campos);
      else await api.crearConsignaCodice({ ...campos, activa: true });
      onGuardada();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-2xl p-4 mb-4">
      <label className="text-xs text-slate-500 block mb-1">Grado (aplica a todos los cursos de ese grado)</label>
      <select value={nivel} onChange={(e) => setNivel(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white">
        {niveles.map((n) => <option key={n.nivel} value={n.nivel}>Grado {n.nivel}°</option>)}
      </select>
      <label className="text-xs text-slate-500 block mb-1">Materia (opcional)</label>
      <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white">
        <option value="">Sin materia específica</option>
        {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
      </select>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título corto (ej: Reflexión semana 3)"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <div className="mb-3"><EditorTexto value={pregunta} onChange={setPregunta} minHeight={90} placeholder="Escribí la pregunta o consigna que van a responder…" /></div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : consigna ? "Guardar cambios" : "Publicar consigna"}
        </button>
      </div>
    </div>
  );
}

export function VistaConsignasCodice({ grados }) {
  const [consignas, setConsignas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [verRespuestasDe, setVerRespuestasDe] = useState(null);

  const cargar = () => { setCargando(true); api.fetchConsignasCodice().then((d) => { setConsignas(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  const toggleActiva = async (c) => { await api.editarConsignaCodice(c.id, { activa: !c.activa }); cargar(); };
  const eliminar = async (c) => { if (!confirm(`¿Eliminar la consigna "${c.titulo}"? Las respuestas que ya escribieron los estudiantes se conservan en sus Códices.`)) return; await api.eliminarConsignaCodice(c.id); cargar(); };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">📢 Consignas del Códice</h2>
          <p className="text-sm text-slate-400">Publicá una pregunta para todo un grado — cada estudiante la ve y escribe su propia respuesta en su Códice.</p>
        </div>
        <button onClick={() => { setEditando(null); setFormAbierto((v) => !v); }} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">
          {formAbierto ? "Cerrar" : "+ Nueva consigna"}
        </button>
      </div>

      {formAbierto && (
        <ConsignaForm grados={grados} consigna={editando} onCancelar={() => setFormAbierto(false)} onGuardada={() => { setFormAbierto(false); setEditando(null); cargar(); }} />
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : consignas.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">Todavía no publicaste ninguna consigna.</div>
      ) : (
        <div className="space-y-2">
          {consignas.map((c) => (
            <div key={c.id} className={`bg-white rounded-2xl border p-4 ${c.activa ? "border-slate-100" : "border-slate-100 opacity-50"}`}>
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-slate-800">{c.titulo}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">Grado {c.nivel}°{c.materia_nombre ? ` · ${c.materia_nombre}` : ""}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.activa ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{c.activa ? "Activa" : "Inactiva"}</span>
                  </div>
                  <TextoEnriquecido html={c.pregunta} className="text-xs text-slate-500 italic mt-1" />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setVerRespuestasDe(c)} className="text-xs text-slate-400 hover:text-violet-600" title="Ver respuestas">👀</button>
                  <button onClick={() => { setEditando(c); setFormAbierto(true); }} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
                  <button onClick={() => toggleActiva(c)} className={`text-[10px] px-2 py-1 rounded-full ${c.activa ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700"}`}>
                    {c.activa ? "Desactivar" : "Activar"}
                  </button>
                  <button onClick={() => eliminar(c)} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {verRespuestasDe && <RespuestasConsignaModal consigna={verRespuestasDe} onClose={() => setVerRespuestasDe(null)} />}
    </div>
  );
}
