import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { EditorTexto, TextoEnriquecido, textoPlano } from "../components/RichText";
import { ContenidoLightbox } from "../screens/Inicio";
import { FotoLightbox } from "../screens/Estudiantes";
import { nivelYCurso } from "../lib/gamification";

export function ProximamentePanel({ nombre }) {
  return (
    <div className="text-center py-8">
      <div className="text-4xl mb-2">🔒</div>
      <p className="text-sm font-semibold text-slate-600">{nombre}</p>
      <p className="text-xs text-slate-400 mt-1">Todavía no está disponible — próximamente.</p>
    </div>
  );
}

export function EntradaCodiceCard({ entrada }) {
  const [comentarios, setComentarios] = useState([]);
  const [expandido, setExpandido] = useState(false);

  const verComentarios = () => {
    if (!expandido) api.fetchComentariosCodice(entrada.id).then(setComentarios);
    setExpandido((v) => !v);
  };

  return (
    <div className={`rounded-xl p-3 ${entrada.autor_docente_id ? "bg-violet-50 border border-violet-100" : "bg-slate-50"}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[11px] text-slate-400">
          {entrada.fecha}{entrada.materia_nombre ? ` · ${entrada.materia_nombre}` : ""}
          {entrada.autor_docente_id && <span className="ml-1.5 text-violet-600 font-semibold">· ✍️ De tu docente</span>}
        </div>
        {entrada.nota !== null && entrada.nota !== undefined && (
          <span className="text-[10px] font-bold text-white bg-emerald-500 px-2 py-0.5 rounded-full">Nota: {entrada.nota}</span>
        )}
      </div>
      {entrada.titulo && <div className="text-sm font-bold text-slate-800 mb-1">{entrada.titulo}</div>}
      {entrada.tarea_titulo && <div className="text-[11px] text-violet-500 mb-1">🔗 Vinculada a: {entrada.tarea_titulo}</div>}
      <TextoEnriquecido html={entrada.contenido} className="text-xs text-slate-600" />
      <button onClick={verComentarios} className="text-[11px] text-violet-500 mt-2">
        {expandido ? "Ocultar comentarios" : "💬 Ver comentarios del docente"}
      </button>
      {expandido && (
        <div className="mt-2 space-y-1.5">
          {comentarios.length === 0 ? (
            <p className="text-[11px] text-slate-400">Todavía no tiene comentarios.</p>
          ) : (
            comentarios.map((c) => (
              <div key={c.id} className="bg-white rounded-lg p-2 text-[11px]">
                <span className="font-semibold text-violet-600">{c.autor_nombre}: </span>
                <span className="text-slate-600">{c.comentario}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function CodiceEstudiante({ estudianteId, gradoId }) {
  const [entradas, setEntradas] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [consignas, setConsignas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [escribiendo, setEscribiendo] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [materiaId, setMateriaId] = useState("");
  const [consignaIdActual, setConsignaIdActual] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = () => api.fetchEntradasCodice(estudianteId).then((d) => { setEntradas(d); setCargando(false); });
  useEffect(() => {
    cargar();
    api.fetchMaterias().then(setMaterias);
    if (gradoId) api.fetchConsignasActivasParaGrado(gradoId).then(setConsignas);
  }, [estudianteId, gradoId]);

  const idsRespondidas = new Set(entradas.filter((e) => e.consigna_id).map((e) => e.consigna_id));

  const responderConsigna = (consigna) => {
    setConsignaIdActual(consigna.id);
    setTitulo(consigna.titulo);
    setMateriaId(consigna.materia_id || "");
    setContenido("");
    setEscribiendo(true);
  };

  const guardar = async () => {
    if (!contenido.trim()) return;
    setGuardando(true);
    try {
      await api.crearEntradaCodice(estudianteId, { titulo: titulo.trim() || null, contenido: contenido.trim(), materia_id: materiaId ? parseInt(materiaId, 10) : null, consigna_id: consignaIdActual });
      setTitulo(""); setContenido(""); setMateriaId(""); setConsignaIdActual(null); setEscribiendo(false);
      cargar();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">📖 Mi Códice</h3>
      <p className="text-xs text-slate-400 mb-3">Tu diario personal de aprendizajes — anotá qué entendiste, qué te costó, o cualquier reflexión sobre tus clases.</p>

      {consignas.filter((c) => !idsRespondidas.has(c.id)).length > 0 && (
        <div className="space-y-2 mb-4">
          {consignas.filter((c) => !idsRespondidas.has(c.id)).map((c) => (
            <div key={c.id} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">📢 Consigna de tu docente</div>
              <div className="text-sm font-bold text-slate-800 mt-0.5">{c.titulo}</div>
              <TextoEnriquecido html={c.pregunta} className="text-xs text-slate-600 italic mt-1" />
              <button onClick={() => responderConsigna(c)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 text-white mt-2">Responder</button>
            </div>
          ))}
        </div>
      )}

      {escribiendo ? (
        <div className="bg-violet-50 rounded-xl p-3 mb-3">
          {consignaIdActual && <p className="text-[11px] text-violet-600 font-semibold mb-2">Respondiendo la consigna: "{textoPlano(consignas.find((c) => c.id === consignaIdActual)?.pregunta)}"</p>}
          <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 mb-2 border border-slate-200 outline-none">
            <option value="">Sin materia específica</option>
            {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (opcional)"
            className="w-full text-sm rounded-lg px-2 py-1.5 mb-2 border border-slate-200 outline-none" />
          <div className="mb-2"><EditorTexto value={contenido} onChange={setContenido} minHeight={110} placeholder="¿Qué aprendiste hoy? ¿Qué te costó entender? ¿Qué reflexión te queda?" /></div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setEscribiendo(false); setConsignaIdActual(null); }} className="text-xs text-slate-400 px-2 py-1">Cancelar</button>
            <button disabled={guardando} onClick={guardar} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
              {guardando ? "Guardando…" : "Guardar entrada"}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setConsignaIdActual(null); setTitulo(""); setMateriaId(""); setEscribiendo(true); }} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white mb-3">
          ✎ Nueva entrada
        </button>
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : entradas.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">Todavía no escribiste ninguna entrada en tu Códice.</p>
      ) : (
        <div className="space-y-2">
          {entradas.map((e) => <EntradaCodiceCard key={e.id} entrada={e} />)}
        </div>
      )}
    </div>
  );
}

export function ValorSemanaEstudiante() {
  const [valor, setValor] = useState(null);
  const [ampliado, setAmpliado] = useState(false);
  useEffect(() => { api.fetchValorSemanal().then(setValor); }, []);
  if (!valor || (!valor.nombre && !valor.imagen_url && !valor.html_contenido)) return null;

  return (
    <div className="bg-violet-50 rounded-2xl p-3 mb-4 flex items-center gap-3">
      {valor.html_contenido ? (
        <div className="shrink-0 rounded-xl overflow-hidden cursor-pointer" style={{ maxWidth: 110 }} onClick={() => setAmpliado(true)} dangerouslySetInnerHTML={{ __html: valor.html_contenido }} />
      ) : (
        <div className="rounded-xl overflow-hidden shrink-0" style={{ width: 56, height: 56, background: "white" }}>
          {valor.imagen_url ? (
            <img src={valor.imagen_url} alt={valor.nombre || "Valor de la semana"} onClick={() => setAmpliado(true)} className="w-full h-full object-contain cursor-pointer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl">🌟</div>
          )}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[9px] font-bold text-violet-500 uppercase tracking-wide">Valor de la semana</div>
        <div className="text-sm font-bold text-slate-800 truncate">{valor.nombre}</div>
        {valor.descripcion && <div className="text-[11px] text-slate-500 mt-0.5">{valor.descripcion}</div>}
      </div>
      {ampliado && valor.html_contenido && <ContenidoLightbox html={valor.html_contenido} onClose={() => setAmpliado(false)} />}
      {ampliado && !valor.html_contenido && valor.imagen_url && <FotoLightbox url={valor.imagen_url} nombre={valor.nombre || "Valor de la semana"} onClose={() => setAmpliado(false)} />}
    </div>
  );
}

export function AnunciosEstudiante({ gradoId }) {
  const [anuncios, setAnuncios] = useState([]);
  const [cargando, setCargando] = useState(true);
  useEffect(() => { api.fetchAnunciosParaGrado(gradoId).then((d) => { setAnuncios(d); setCargando(false); }); }, [gradoId]);

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;
  if (anuncios.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-3xl mb-2">✉️</div>
        <p className="text-sm text-slate-400">No hay anuncios por ahora.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-3">✉️ Mensajes</h3>
      <div className="space-y-2">
        {anuncios.map((a) => (
          <div key={a.id} className={`bg-white rounded-xl p-3.5 shadow-sm ${a.fijado ? "border-l-4 border-amber-400" : "border-l-4 border-violet-300"}`}>
            <div className="flex items-center gap-1.5">
              {a.fijado && <span className="text-xs">📌</span>}
              <div className="text-sm font-bold text-slate-800">{a.titulo}</div>
            </div>
            <TextoEnriquecido html={a.contenido} className="text-xs text-slate-600 mt-1" />
            <p className="text-[10px] text-slate-400 mt-2">{new Date(a.creado_en).toLocaleDateString("es-CO", { day: "numeric", month: "long" })}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const CATEGORIAS_BIBLIOTECA = {
  enlace: { label: "Enlace", emoji: "🔗", color: "#2F55A4" },
  documento: { label: "Documento", emoji: "📄", color: "#3B82F6" },
  video: { label: "Video", emoji: "🎬", color: "#EF4444" },
  libro: { label: "Libro", emoji: "📖", color: "#F59E0B" },
  audio: { label: "Audio", emoji: "🎧", color: "#22C55E" },
};

export function BibliotecaEstudiante({ gradoId }) {
  const [recursos, setRecursos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const { nivel } = nivelYCurso(gradoId);

  useEffect(() => { api.fetchBibliotecaPorNivel(nivel).then((d) => { setRecursos(d); setCargando(false); }); }, [nivel]);

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;
  if (recursos.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-3xl mb-2">📚</div>
        <p className="text-sm text-slate-400">Todavía no hay nada en la biblioteca.</p>
      </div>
    );
  }

  const porCategoria = Object.entries(CATEGORIAS_BIBLIOTECA)
    .map(([key, info]) => ({ key, ...info, items: recursos.filter((r) => r.categoria === key) }))
    .filter((c) => c.items.length > 0);

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">📚 Biblioteca</h3>
      <p className="text-xs text-slate-400 mb-4">Recursos y enlaces para tu grado.</p>
      <div className="space-y-5">
        {porCategoria.map((cat) => (
          <div key={cat.key}>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">{cat.emoji} {cat.label}s</div>
            <div className="rounded-xl p-3 flex gap-2 flex-wrap items-end" style={{ background: "linear-gradient(180deg, transparent 85%, #D6B98C 85%, #D6B98C 100%)" }}>
              {cat.items.map((r) => (
                <a key={r.id} href={r.url} target="_blank" rel="noreferrer"
                  className="rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow px-2 pt-3 pb-2 block"
                  style={{ width: 84, minHeight: 110, background: cat.color }} title={textoPlano(r.descripcion) || r.titulo}>
                  <div className="text-lg mb-1">{cat.emoji}</div>
                  <div className="text-[9px] font-bold text-white leading-tight break-words">{r.titulo}</div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const CATEGORIA_INFO_ESTUDIANTE = {
  academico: { label: "Académico", color: "#3B82F6", emoji: "📘" },
  convivencial: { label: "Convivencial", color: "#F59E0B", emoji: "🤝" },
  general: { label: "General", color: "#2F55A4", emoji: "⚡" },
  asistencia: { label: "Asistencia", color: "#0E9F8E", emoji: "📋" },
  respeto: { label: "Respeto", color: "#22C55E", emoji: "🌱" },
  responsabilidad: { label: "Responsabilidad", color: "#22C55E", emoji: "✅" },
  confiabilidad: { label: "Confiabilidad", color: "#22C55E", emoji: "🤲" },
  justicia: { label: "Justicia", color: "#22C55E", emoji: "⚖️" },
  solidaridad: { label: "Solidaridad", color: "#22C55E", emoji: "💛" },
  ciudadania: { label: "Ciudadanía", color: "#22C55E", emoji: "🏛️" },
};
