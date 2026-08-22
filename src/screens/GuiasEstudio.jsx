import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { EditorTexto, TextoEnriquecido } from "../components/RichText";

function GuiaForm({ materiaId, gradoId, periodo, guia, onCancelar, onGuardada }) {
  const [titulo, setTitulo] = useState(guia?.titulo || "");
  const [objetivo, setObjetivo] = useState(guia?.objetivo || "");
  const [contenido, setContenido] = useState(guia?.contenido || "");
  const [actividades, setActividades] = useState(guia?.actividades || "");
  const [recursos, setRecursos] = useState(guia?.recursos || "");
  const [fechaEntrega, setFechaEntrega] = useState(guia?.fecha_entrega || "");
  const [publicada, setPublicada] = useState(guia?.publicada ?? true);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!titulo.trim()) { alert("Ponele un título a la guía."); return; }
    setGuardando(true);
    try {
      const campos = {
        titulo: titulo.trim(), objetivo: objetivo || null, contenido: contenido || null,
        actividades: actividades || null, recursos: recursos || null,
        fecha_entrega: fechaEntrega || null, publicada,
        materia_id: materiaId, grado_id: gradoId, periodo,
      };
      if (guia) await api.editarGuiaEstudio(guia.id, campos);
      else await api.crearGuiaEstudio(campos);
      onGuardada();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-xl p-3 mb-3">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título de la guía (ej: Guía de fracciones — Periodo 1)"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />

      <label className="text-xs text-slate-500 block mb-1">Objetivo</label>
      <div className="mb-2"><EditorTexto value={objetivo} onChange={setObjetivo} minHeight={50} placeholder="¿Qué va a lograr el estudiante con esta guía?" /></div>

      <label className="text-xs text-slate-500 block mb-1">Contenido</label>
      <div className="mb-2"><EditorTexto value={contenido} onChange={setContenido} minHeight={90} placeholder="Explicación, conceptos clave, teoría…" /></div>

      <label className="text-xs text-slate-500 block mb-1">Actividades</label>
      <div className="mb-2"><EditorTexto value={actividades} onChange={setActividades} minHeight={90} placeholder="Ejercicios o tareas a resolver…" /></div>

      <label className="text-xs text-slate-500 block mb-1">Recursos (enlaces, materiales)</label>
      <div className="mb-2"><EditorTexto value={recursos} onChange={setRecursos} minHeight={50} placeholder="Enlaces de video, lecturas, páginas de referencia…" /></div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Fecha de entrega (opcional)</label>
          <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600 mt-5">
          <input type="checkbox" checked={publicada} onChange={(e) => setPublicada(e.target.checked)} /> Visible para los estudiantes
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-1.5">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : guia ? "Guardar cambios" : "Crear guía"}
        </button>
      </div>
    </div>
  );
}

function imprimirGuia(guia, institucion) {
  const ventana = window.open("", "_blank");
  ventana.document.write(`
    <html><head><title>${guia.titulo}</title></head>
    <body style="font-family: Arial, sans-serif; padding: 30px; font-size: 13px;">
      <div style="display:flex; align-items:center; gap:12px; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:16px;">
        ${institucion?.logo_url ? `<img src="${institucion.logo_url}" style="height:55px;" />` : ""}
        <div style="flex:1; text-align:center;">
          <div style="font-weight:bold; font-size:15px;">${institucion?.nombre || "INSTITUCIÓN EDUCATIVA"}</div>
          <div style="font-weight:bold; margin-top:4px; font-size:13px;">GUÍA DE ESTUDIO</div>
        </div>
      </div>
      <h2>${guia.titulo}</h2>
      ${guia.fecha_entrega ? `<p><b>Fecha de entrega:</b> ${guia.fecha_entrega}</p>` : ""}
      ${guia.objetivo ? `<p><b>Objetivo:</b></p><div>${guia.objetivo}</div>` : ""}
      ${guia.contenido ? `<p><b>Contenido:</b></p><div>${guia.contenido}</div>` : ""}
      ${guia.actividades ? `<p><b>Actividades:</b></p><div>${guia.actividades}</div>` : ""}
      ${guia.recursos ? `<p><b>Recursos:</b></p><div>${guia.recursos}</div>` : ""}
      <script>window.print();</script>
    </body></html>
  `);
  ventana.document.close();
}

export function VistaGuiasEstudio({ grados }) {
  const [materias, setMaterias] = useState([]);
  const [materiaId, setMateriaId] = useState("");
  const [gradoId, setGradoId] = useState(grados[0]?.id || "");
  const [periodo, setPeriodo] = useState("1");
  const [guias, setGuias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [institucion, setInstitucion] = useState(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);

  useEffect(() => {
    api.fetchMaterias().then((data) => { setMaterias(data); if (data[0]) setMateriaId(data[0].id); });
    api.fetchInstitucion().then(setInstitucion);
  }, []);
  useEffect(() => { if (grados.length && !gradoId) setGradoId(grados[0].id); }, [grados]);

  const cargar = () => {
    if (!materiaId || !gradoId) return;
    setCargando(true);
    api.fetchGuiasEstudio(materiaId, gradoId, periodo).then((d) => { setGuias(d); setCargando(false); });
  };
  useEffect(() => { cargar(); }, [materiaId, gradoId, periodo]);

  const eliminar = async (id) => { if (!confirm("¿Eliminar esta guía de estudio?")) return; await api.eliminarGuiaEstudio(id); cargar(); };

  if (materias.length === 0) {
    return <p className="text-sm text-slate-400">Primero creá al menos una materia (en Calificaciones) para poder armar guías de estudio.</p>;
  }

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">📘 Guías de estudio</h3>
      <p className="text-xs text-slate-400 mb-3">Documento formal con objetivo, contenido, actividades y recursos — visible e imprimible para los estudiantes del curso.</p>

      <div className="flex flex-wrap gap-2 mb-3">
        <select value={materiaId} onChange={(e) => setMateriaId(parseInt(e.target.value, 10))} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {grados.map((g) => <option key={g.id} value={g.id}>Curso {g.id}</option>)}
        </select>
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {["1", "2", "3", "4"].map((p) => <option key={p} value={p}>Periodo {p}</option>)}
        </select>
        <button onClick={() => { setEditando(null); setFormAbierto((v) => !v); }} className="text-xs font-semibold px-3 py-2 rounded-full bg-violet-500 text-white">
          {formAbierto ? "Cerrar" : "+ Nueva guía"}
        </button>
      </div>

      {formAbierto && (
        <GuiaForm materiaId={materiaId} gradoId={gradoId} periodo={periodo} guia={editando}
          onCancelar={() => { setFormAbierto(false); setEditando(null); }}
          onGuardada={() => { setFormAbierto(false); setEditando(null); cargar(); }} />
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : guias.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">Todavía no hay guías para esta materia/curso/periodo.</p>
      ) : (
        <div className="space-y-2">
          {guias.map((g) => (
            <div key={g.id} className="bg-white rounded-xl border border-slate-100 p-3">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-700">{g.titulo}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {g.publicada ? "🟢 Visible para estudiantes" : "⚪ Borrador (no visible)"}
                    {g.fecha_entrega ? ` · Entrega: ${g.fecha_entrega}` : ""}
                  </div>
                  {g.objetivo && <TextoEnriquecido html={g.objetivo} className="text-xs text-slate-500 mt-1.5" />}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => imprimirGuia(g, institucion)} className="text-xs text-slate-400 hover:text-violet-600">🖨️</button>
                  <button onClick={() => { setEditando(g); setFormAbierto(true); }} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
                  <button onClick={() => eliminar(g.id)} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function GuiasEstudiante({ gradoId }) {
  const [guias, setGuias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [abierta, setAbierta] = useState(null);

  useEffect(() => {
    if (!gradoId) return;
    api.fetchGuiasEstudioParaGrado(gradoId).then((d) => { setGuias(d); setCargando(false); });
  }, [gradoId]);

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;

  if (abierta) {
    return (
      <div>
        <button onClick={() => setAbierta(null)} className="text-sm text-violet-500 mb-3">← Volver</button>
        <h3 className="font-bold text-slate-800 mb-1">{abierta.titulo}</h3>
        <p className="text-xs text-slate-400 mb-3">{abierta.materias?.nombre}{abierta.fecha_entrega ? ` · Entrega: ${abierta.fecha_entrega}` : ""}</p>
        {abierta.objetivo && (<><h4 className="text-sm font-bold text-slate-700 mt-3">Objetivo</h4><TextoEnriquecido html={abierta.objetivo} className="text-sm text-slate-600" /></>)}
        {abierta.contenido && (<><h4 className="text-sm font-bold text-slate-700 mt-3">Contenido</h4><TextoEnriquecido html={abierta.contenido} className="text-sm text-slate-600" /></>)}
        {abierta.actividades && (<><h4 className="text-sm font-bold text-slate-700 mt-3">Actividades</h4><TextoEnriquecido html={abierta.actividades} className="text-sm text-slate-600" /></>)}
        {abierta.recursos && (<><h4 className="text-sm font-bold text-slate-700 mt-3">Recursos</h4><TextoEnriquecido html={abierta.recursos} className="text-sm text-slate-600" /></>)}
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-3">📘 Guías de estudio</h3>
      {guias.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">Todavía no hay guías de estudio publicadas.</p>
      ) : (
        <div className="space-y-2">
          {guias.map((g) => (
            <button key={g.id} onClick={() => setAbierta(g)} className="w-full text-left bg-white rounded-xl border border-slate-100 p-3 hover:border-violet-200">
              <div className="text-sm font-semibold text-slate-700">{g.titulo}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{g.materias?.nombre}{g.fecha_entrega ? ` · Entrega: ${g.fecha_entrega}` : ""}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
