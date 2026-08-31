import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import * as api from "../lib/api";
import { agruparPorNivel, nivelYCurso } from "../lib/gamification";
import { periodosDe } from "../lib/calificaciones";
import { EditorTexto, TextoEnriquecido } from "../components/RichText";

const ICONO_RECURSO = { drive: "📁", docs: "📄", forms: "📝", otro: "🔗" };
const LABEL_RECURSO = { drive: "Google Drive", docs: "Google Docs", forms: "Google Forms", otro: "Enlace" };
const TIPOS_TAREA = [
  { key: "tarea", label: "Tarea" },
  { key: "lectura", label: "Lectura" },
  { key: "proyecto", label: "Proyecto" },
  { key: "evaluacion", label: "Evaluación" },
];

function SelectorEstandares({ planeacionId, tipo }) {
  const [vinculados, setVinculados] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [agregando, setAgregando] = useState(false);
  const [creandoNuevo, setCreandoNuevo] = useState(false);
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [nuevaDescripcion, setNuevaDescripcion] = useState("");

  const cargar = async () => {
    const [v, c] = await Promise.all([api.fetchEstandaresDePlaneacion(planeacionId), api.fetchEstandares(tipo)]);
    setVinculados(v.filter((e) => e && e.tipo === tipo));
    setCatalogo(c);
  };
  useEffect(() => { cargar(); }, [planeacionId]);

  const vincular = async (estandarId) => { await api.vincularEstandar(planeacionId, estandarId); cargar(); };
  const desvincular = async (estandarId) => { await api.desvincularEstandar(planeacionId, estandarId); cargar(); };

  const crearYVincular = async () => {
    if (!nuevaDescripcion.trim()) return;
    const nuevo = await api.crearEstandar({ tipo, codigo: nuevoCodigo.trim() || null, descripcion: nuevaDescripcion.trim() });
    await api.vincularEstandar(planeacionId, nuevo.id);
    setNuevoCodigo(""); setNuevaDescripcion(""); setCreandoNuevo(false); setAgregando(false);
    cargar();
  };

  const disponibles = catalogo.filter((e) => !vinculados.some((v) => v.id === e.id));
  const etiqueta = tipo === "dba" ? "DBA" : "Competencia";
  const estilo = tipo === "dba" ? "bg-blue-50 text-blue-700" : "bg-teal-50 text-teal-700";

  return (
    <div className="mt-1">
      {vinculados.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {vinculados.map((e) => (
            <span key={e.id} className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${estilo}`}>
              {e.codigo ? `${e.codigo} — ` : ""}{e.descripcion}
              <button onClick={() => desvincular(e.id)} className="opacity-60 hover:opacity-100">✕</button>
            </span>
          ))}
        </div>
      )}
      {agregando ? (
        <div className="flex flex-col gap-1 bg-slate-50 rounded-lg p-2 max-w-md">
          {disponibles.length > 0 && (
            <select onChange={(e) => { if (e.target.value) { vincular(parseInt(e.target.value, 10)); e.target.value = ""; } }}
              className="text-[11px] rounded px-1.5 py-1 border border-slate-200 outline-none">
              <option value="">Elegir del catálogo…</option>
              {disponibles.map((e) => <option key={e.id} value={e.id}>{e.codigo ? `${e.codigo} — ` : ""}{e.descripcion}</option>)}
            </select>
          )}
          {creandoNuevo ? (
            <div className="flex gap-1">
              <input value={nuevoCodigo} onChange={(e) => setNuevoCodigo(e.target.value)} placeholder="Código"
                className="w-16 text-[11px] rounded px-1.5 py-1 border border-slate-200 outline-none" />
              <input value={nuevaDescripcion} onChange={(e) => setNuevaDescripcion(e.target.value)} placeholder="Descripción"
                className="flex-1 text-[11px] rounded px-1.5 py-1 border border-slate-200 outline-none" />
              <button onClick={crearYVincular} className="text-[11px] px-2 rounded bg-violet-500 text-white">Añadir</button>
            </div>
          ) : (
            <button onClick={() => setCreandoNuevo(true)} className="text-[10px] text-violet-500 text-left">+ Crear nuevo {etiqueta}</button>
          )}
          <button onClick={() => { setAgregando(false); setCreandoNuevo(false); }} className="text-[10px] text-slate-400 text-left">Cerrar</button>
        </div>
      ) : (
        <button onClick={() => setAgregando(true)} className="text-[10px] text-violet-500">+ {etiqueta}</button>
      )}
    </div>
  );
}

function RecursosLista({ planeacionId }) {
  const [recursos, setRecursos] = useState([]);
  const [agregando, setAgregando] = useState(false);
  const [url, setUrl] = useState("");
  const [titulo, setTitulo] = useState("");

  const cargar = () => api.fetchRecursos(planeacionId).then(setRecursos);
  useEffect(() => { cargar(); }, [planeacionId]);

  const agregar = async () => {
    if (!url.trim()) return;
    try {
      await api.crearRecurso(planeacionId, url, titulo);
      setUrl(""); setTitulo(""); setAgregando(false);
      cargar();
    } catch (e) {
      alert("Error al agregar el recurso: " + e.message);
    }
  };

  const quitar = async (id) => { await api.eliminarRecurso(id); cargar(); };

  return (
    <div className="mt-2">
      {recursos.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {recursos.map((r) => (
            <div key={r.id} className="flex items-center gap-1 text-xs bg-slate-50 rounded-full pl-2 pr-1 py-1">
              <a href={r.url} target="_blank" rel="noreferrer" className="text-slate-600 hover:text-violet-600">
                {ICONO_RECURSO[r.tipo]} {r.titulo || LABEL_RECURSO[r.tipo]}
              </a>
              <button onClick={() => quitar(r.id)} className="text-slate-300 hover:text-rose-500 ml-1">✕</button>
            </div>
          ))}
        </div>
      )}
      {agregando ? (
        <div className="flex gap-1.5 items-center">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Pega el link de Drive / Docs / Forms…"
            className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none flex-1 min-w-0" />
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nombre (opcional)"
            className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none w-32" />
          <button onClick={agregar} className="text-xs px-2 py-1.5 rounded-lg bg-violet-500 text-white">Agregar</button>
          <button onClick={() => setAgregando(false)} className="text-xs text-slate-400">✕</button>
        </div>
      ) : (
        <button onClick={() => setAgregando(true)} className="text-[11px] text-violet-500">+ Agregar recurso (Drive/Docs/Forms)</button>
      )}
    </div>
  );
}

function RubricaModal({ tarea, onClose }) {
  const [criterios, setCriterios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.fetchRubrica(tarea.id).then((r) => {
      setCriterios(r?.criterios?.length ? r.criterios : [{ criterio: "", niveles: [{ nombre: "Alto", puntos: 5 }, { nombre: "Medio", puntos: 3 }, { nombre: "Bajo", puntos: 1 }] }]);
      setCargando(false);
    });
  }, [tarea.id]);

  const actualizarCriterio = (i, texto) => setCriterios((prev) => prev.map((c, idx) => idx === i ? { ...c, criterio: texto } : c));
  const actualizarNivel = (i, j, campo, valor) => setCriterios((prev) => prev.map((c, idx) => idx === i
    ? { ...c, niveles: c.niveles.map((n, k) => k === j ? { ...n, [campo]: campo === "puntos" ? parseFloat(valor) || 0 : valor } : n) }
    : c));
  const agregarCriterio = () => setCriterios((prev) => [...prev, { criterio: "", niveles: [{ nombre: "Alto", puntos: 5 }, { nombre: "Medio", puntos: 3 }, { nombre: "Bajo", puntos: 1 }] }]);
  const quitarCriterio = (i) => setCriterios((prev) => prev.filter((_, idx) => idx !== i));

  const guardar = async () => {
    setGuardando(true);
    try {
      await api.guardarRubrica(tarea.id, criterios.filter((c) => c.criterio.trim()));
      onClose();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">📊 Rúbrica — {tarea.titulo}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : (
          <div className="space-y-3 mb-4">
            {criterios.map((c, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <input value={c.criterio} onChange={(e) => actualizarCriterio(i, e.target.value)} placeholder="Criterio a evaluar (ej: Ortografía)"
                    className="flex-1 text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
                  <button onClick={() => quitarCriterio(i)} className="text-slate-300 hover:text-rose-500">🗑</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {c.niveles.map((n, j) => (
                    <div key={j} className="bg-slate-50 rounded-lg p-2">
                      <input value={n.nombre} onChange={(e) => actualizarNivel(i, j, "nombre", e.target.value)}
                        className="w-full text-xs font-semibold rounded px-1 py-1 border border-slate-200 outline-none mb-1" />
                      <input type="number" value={n.puntos} onChange={(e) => actualizarNivel(i, j, "puntos", e.target.value)}
                        className="w-full text-xs rounded px-1 py-1 border border-slate-200 outline-none" placeholder="Puntos" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={agregarCriterio} className="text-xs text-violet-500">+ Agregar criterio</button>
          </div>
        )}

        <button disabled={guardando} onClick={guardar} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : "Guardar rúbrica"}
        </button>
      </div>
    </div>
  );
}

function TareasLista({ planeacionId }) {
  const [tareas, setTareas] = useState([]);
  const [agregando, setAgregando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("tarea");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [rubricaAbierta, setRubricaAbierta] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [tituloEdit, setTituloEdit] = useState("");
  const [tipoEdit, setTipoEdit] = useState("tarea");
  const [fechaEdit, setFechaEdit] = useState("");

  const cargar = () => api.fetchTareas(planeacionId).then(setTareas);
  useEffect(() => { cargar(); }, [planeacionId]);

  const agregar = async () => {
    if (!titulo.trim()) return;
    try {
      await api.crearTarea({ planeacion_id: planeacionId, titulo: titulo.trim(), tipo, fecha_entrega: fechaEntrega || null });
      setTitulo(""); setFechaEntrega(""); setAgregando(false);
      cargar();
    } catch (e) {
      alert("Error al agregar la tarea: " + e.message);
    }
  };

  const empezarEdicion = (t) => {
    setEditandoId(t.id); setTituloEdit(t.titulo); setTipoEdit(t.tipo); setFechaEdit(t.fecha_entrega || "");
  };

  const guardarEdicion = async () => {
    if (!tituloEdit.trim()) return;
    try {
      await api.editarTarea(editandoId, { titulo: tituloEdit.trim(), tipo: tipoEdit, fecha_entrega: fechaEdit || null });
      setEditandoId(null);
      cargar();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
  };

  const quitar = async (id) => { if (!confirm("¿Eliminar esta tarea?")) return; await api.eliminarTarea(id); cargar(); };

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="text-xs font-semibold text-slate-500 mb-2">Tareas (evidencias de aprendizaje)</div>
      {tareas.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {tareas.map((t) => (
            editandoId === t.id ? (
              <div key={t.id} className="bg-violet-50 rounded-lg p-2 flex gap-1.5 items-center flex-wrap">
                <input value={tituloEdit} onChange={(e) => setTituloEdit(e.target.value)} className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none flex-1 min-w-[120px]" />
                <select value={tipoEdit} onChange={(e) => setTipoEdit(e.target.value)} className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none">
                  {TIPOS_TAREA.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                </select>
                <input type="date" value={fechaEdit} onChange={(e) => setFechaEdit(e.target.value)} className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
                <button onClick={guardarEdicion} className="text-xs px-2 py-1.5 rounded-lg bg-violet-500 text-white">Guardar</button>
                <button onClick={() => setEditandoId(null)} className="text-xs text-slate-400">✕</button>
              </div>
            ) : (
              <div key={t.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-2.5 py-1.5">
                <div className="text-xs text-slate-700">
                  <span className="font-semibold">{t.titulo}</span>
                  <span className="text-slate-400"> · {TIPOS_TAREA.find((x) => x.key === t.tipo)?.label}{t.fecha_entrega ? ` · Entrega: ${t.fecha_entrega}` : ""}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setRubricaAbierta(t)} className="text-[11px] text-violet-500">📊 Rúbrica</button>
                  <button onClick={() => empezarEdicion(t)} className="text-slate-300 hover:text-violet-600 text-xs">✏️</button>
                  <button onClick={() => quitar(t.id)} className="text-slate-300 hover:text-rose-500 text-xs">✕</button>
                </div>
              </div>
            )
          ))}
        </div>
      )}
      {agregando ? (
        <div className="flex gap-1.5 items-center flex-wrap">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título de la tarea"
            className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none flex-1 min-w-[120px]" />
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none">
            {TIPOS_TAREA.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
          <button onClick={agregar} className="text-xs px-2 py-1.5 rounded-lg bg-violet-500 text-white">Agregar</button>
          <button onClick={() => setAgregando(false)} className="text-xs text-slate-400">✕</button>
        </div>
      ) : (
        <button onClick={() => setAgregando(true)} className="text-[11px] text-violet-500">+ Agregar tarea</button>
      )}

      {rubricaAbierta && <RubricaModal tarea={rubricaAbierta} onClose={() => setRubricaAbierta(null)} />}
    </div>
  );
}

const ESTADOS_DICTADO = [
  { key: "pendiente", label: "Pendiente", color: "#F59E0B" },
  { key: "dictada", label: "Dictada tal cual se planeó", color: "#22C55E" },
  { key: "alterada", label: "Dictada, pero cambió sobre la marcha", color: "#F97316" },
  { key: "aplazada", label: "Aplazada", color: "#EF4444" },
];

function DictadoControl({ claseId, grados }) {
  const [dictados, setDictados] = useState([]);
  const [agregando, setAgregando] = useState(false);
  const [gradoId, setGradoId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [estado, setEstado] = useState("dictada");
  const [observacionAbiertaDe, setObservacionAbiertaDe] = useState(null);
  const [observacionTemp, setObservacionTemp] = useState({});

  const cargar = () => api.fetchDictados(claseId).then(setDictados);
  useEffect(() => { cargar(); }, [claseId]);
  useEffect(() => { if (grados.length && !gradoId) setGradoId(grados[0].id); }, [grados]);

  const toggleAlerta = async (d) => { await api.editarDictado(d.id, { alerta: !d.alerta }); cargar(); };
  const guardarObservacion = async (id) => {
    await api.editarDictado(id, { observacion: (observacionTemp[id] ?? "").trim() || null });
    setObservacionAbiertaDe(null);
    cargar();
  };

  const agregar = async () => {
    if (!gradoId) return;
    try {
      await api.crearDictado(claseId, gradoId, fecha, estado);
      setAgregando(false);
      cargar();
    } catch (e) {
      alert("Error al registrar: " + e.message);
    }
  };

  const cambiarEstado = async (id, nuevoEstado) => { await api.editarDictado(id, { estado: nuevoEstado }); cargar(); };
  const quitar = async (id) => { await api.eliminarDictado(id); cargar(); };

  return (
    <div className="mt-2 pt-2 border-t border-slate-100">
      <div className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Control por curso — lo que realmente pasó en el aula</div>
      {dictados.length > 0 && (
        <div className="space-y-1.5 mb-1.5">
          {dictados.map((d) => {
            const info = ESTADOS_DICTADO.find((e) => e.key === d.estado);
            return (
              <div key={d.id} className={`rounded-lg p-1.5 ${d.alerta ? "bg-rose-50" : ""}`}>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="font-semibold text-slate-600 w-16 shrink-0">Curso {d.grado_id}</span>
                  <span className="text-slate-400 w-24 shrink-0">{d.fecha || "sin fecha"}</span>
                  <select value={d.estado} onChange={(e) => cambiarEstado(d.id, e.target.value)}
                    className="text-[10px] px-2 py-0.5 rounded-full border-0 outline-none" style={{ background: `${info.color}22`, color: info.color }}>
                    {ESTADOS_DICTADO.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
                  </select>
                  <button onClick={() => toggleAlerta(d)} title="Marcar para revisar más adelante" className={`text-xs shrink-0 ${d.alerta ? "" : "opacity-30"}`}>⚠️</button>
                  <button onClick={() => setObservacionAbiertaDe(observacionAbiertaDe === d.id ? null : d.id)} className="text-[10px] text-violet-500 shrink-0">
                    {d.observacion ? "📝 Ver nota" : "+ Nota"}
                  </button>
                  <button onClick={() => quitar(d.id)} className="text-slate-300 hover:text-rose-500 ml-auto shrink-0">✕</button>
                </div>
                {observacionAbiertaDe === d.id && (
                  <div className="mt-1 flex gap-1.5">
                    <textarea value={observacionTemp[d.id] ?? d.observacion ?? ""} onChange={(e) => setObservacionTemp((prev) => ({ ...prev, [d.id]: e.target.value }))}
                      rows={2} placeholder="¿Qué pasó realmente en esta clase? (ej: un imprevisto cambió la actividad planeada, no alcanzó el tiempo, etc.)"
                      className="flex-1 text-[11px] rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
                    <button onClick={() => guardarObservacion(d.id)} className="text-[11px] px-2 py-1 rounded-lg bg-violet-500 text-white self-start">Guardar</button>
                  </div>
                )}
                {d.observacion && observacionAbiertaDe !== d.id && (
                  <p className="text-[10px] text-slate-500 mt-0.5 pl-[4.5rem]">📝 {d.observacion}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {agregando ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-[11px] rounded-lg px-2 py-1 border border-slate-200 outline-none">
            {grados.map((g) => <option key={g.id} value={g.id}>Curso {g.id}</option>)}
          </select>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="text-[11px] rounded-lg px-2 py-1 border border-slate-200 outline-none" />
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className="text-[11px] rounded-lg px-2 py-1 border border-slate-200 outline-none">
            {ESTADOS_DICTADO.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
          </select>
          <button onClick={agregar} className="text-[11px] px-2 py-1 rounded-lg bg-violet-500 text-white">Guardar</button>
          <button onClick={() => setAgregando(false)} className="text-[11px] text-slate-400">✕</button>
        </div>
      ) : (
        <button onClick={() => setAgregando(true)} className="text-[11px] text-violet-500">+ Registrar en un curso</button>
      )}
    </div>
  );
}

function ClasesLista({ unidadId, grados }) {
  const [clases, setClases] = useState([]);
  const [agregando, setAgregando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [modo, setModo] = useState("agil"); // "agil" | "completo"
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState("");
  const [duracion, setDuracion] = useState("");
  const [descripcionAgil, setDescripcionAgil] = useState("");
  const [inicio, setInicio] = useState("");
  const [desarrollo, setDesarrollo] = useState("");
  const [cierre, setCierre] = useState("");
  const [indicador, setIndicador] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [ajustes, setAjustes] = useState("");

  const cargar = () => api.fetchClases(unidadId).then(setClases);
  useEffect(() => { cargar(); }, [unidadId]);

  const limpiar = () => {
    setTitulo(""); setFecha(""); setDuracion(""); setDescripcionAgil(""); setInicio(""); setDesarrollo(""); setCierre(""); setIndicador(""); setObjetivo(""); setAjustes("");
    setAgregando(false); setEditandoId(null); setModo("agil");
  };

  const empezarEdicionClase = (c) => {
    setEditandoId(c.id);
    setTitulo(c.titulo || "");
    setFecha(c.fecha || "");
    setDuracion(c.duracion_minutos || "");
    setObjetivo(c.objetivo_aprendizaje || "");
    setAjustes(c.ajustes_curriculares || "");
    if (c.momento_inicio || c.momento_cierre) {
      setModo("completo");
      setInicio(c.momento_inicio || "");
      setDesarrollo(c.momento_desarrollo || "");
      setCierre(c.momento_cierre || "");
      setIndicador(c.indicador_desempeno || "");
      setDescripcionAgil("");
    } else {
      setModo("agil");
      setDescripcionAgil(c.momento_desarrollo || "");
      setInicio(""); setDesarrollo(""); setCierre(""); setIndicador("");
    }
    setAgregando(true);
  };

  const guardar = async () => {
    if (!titulo.trim()) return;
    const campos = {
      titulo: titulo.trim(), fecha: fecha || null,
      duracion_minutos: duracion ? parseInt(duracion, 10) : null,
      objetivo_aprendizaje: objetivo.trim() || null,
      ajustes_curriculares: ajustes.trim() || null,
      momento_inicio: modo === "agil" ? null : (inicio.trim() || null),
      momento_desarrollo: modo === "agil" ? (descripcionAgil.trim() || null) : (desarrollo.trim() || null),
      momento_cierre: modo === "agil" ? null : (cierre.trim() || null),
      indicador_desempeno: modo === "agil" ? null : (indicador.trim() || null),
    };
    try {
      if (editandoId) {
        await api.editarPlaneacion(editandoId, campos);
      } else {
        await api.crearPlaneacion({ tipo: "clase", unidad_id: unidadId, orden: clases.length, ...campos });
      }
      limpiar();
      cargar();
    } catch (e) {
      alert("Error al guardar la clase: " + e.message);
    }
  };

  const quitar = async (id) => { if (!confirm("¿Eliminar esta clase?")) return; await api.eliminarPlaneacion(id); cargar(); };

  return (
    <div className="mt-3">
      <div className="text-xs font-semibold text-slate-500 mb-2">Clases de esta unidad</div>
      {clases.length > 0 && (
        <div className="space-y-2 mb-2">
          {clases.map((c, i) => (
            <div key={c.id} className="bg-white border border-slate-100 rounded-lg p-2.5">
              <div className="flex justify-between items-start">
                <div className="text-xs">
                  <span className="font-semibold text-slate-700">Clase {i + 1}: {c.titulo}</span>
                  {c.fecha && <span className="text-slate-400"> · {c.fecha}</span>}
                  {c.duracion_minutos && <span className="text-slate-400"> · {c.duracion_minutos} min</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => empezarEdicionClase(c)} className="text-slate-300 hover:text-violet-600 text-xs">✏️</button>
                  <button onClick={() => quitar(c.id)} className="text-slate-300 hover:text-rose-500 text-xs">✕</button>
                </div>
              </div>
              {c.objetivo_aprendizaje && <p className="text-[11px] text-violet-600 mt-1"><b>🎯 Objetivo:</b> {c.objetivo_aprendizaje}</p>}
              {(c.momento_inicio || c.momento_desarrollo || c.momento_cierre) && (
                <div className="grid sm:grid-cols-3 gap-2 mt-2">
                  {c.momento_inicio && (
                    <div className="bg-amber-50 rounded-lg p-2">
                      <div className="text-[9px] font-bold text-amber-600 uppercase mb-0.5">Actividades de apertura</div>
                      <TextoEnriquecido html={c.momento_inicio} className="text-[11px] text-slate-600" />
                    </div>
                  )}
                  {c.momento_desarrollo && (
                    <div className="bg-violet-50 rounded-lg p-2">
                      <div className="text-[9px] font-bold text-violet-600 uppercase mb-0.5">Actividades de desarrollo</div>
                      <TextoEnriquecido html={c.momento_desarrollo} className="text-[11px] text-slate-600" />
                    </div>
                  )}
                  {c.momento_cierre && (
                    <div className="bg-emerald-50 rounded-lg p-2">
                      <div className="text-[9px] font-bold text-emerald-600 uppercase mb-0.5">Actividades de cierre</div>
                      <TextoEnriquecido html={c.momento_cierre} className="text-[11px] text-slate-600" />
                    </div>
                  )}
                </div>
              )}
              {c.indicador_desempeno && <p className="text-[11px] text-slate-500 mt-1.5"><b>Indicador de desempeño:</b> {c.indicador_desempeno}</p>}
              {c.ajustes_curriculares && (
                <div className="bg-blue-50 rounded-lg p-2 mt-1.5">
                  <div className="text-[9px] font-bold text-blue-600 uppercase mb-0.5">Ajustes razonables / adaptaciones</div>
                  <TextoEnriquecido html={c.ajustes_curriculares} className="text-[11px] text-slate-600" />
                </div>
              )}
              <div className="flex flex-wrap gap-3 mt-1.5">
                <SelectorEstandares planeacionId={c.id} tipo="dba" />
                <SelectorEstandares planeacionId={c.id} tipo="competencia" />
              </div>
              <RecursosLista planeacionId={c.id} />
              <DictadoControl claseId={c.id} grados={grados} />
            </div>
          ))}
        </div>
      )}
      {agregando ? (
        <div className="bg-violet-50 rounded-lg p-3 space-y-2">
          {editandoId && <div className="text-[11px] font-semibold text-violet-600">Editando "{titulo || "esta clase"}"</div>}
          <div className="flex gap-1 rounded-full bg-white p-1 w-fit border border-slate-200">
            <button onClick={() => setModo("agil")} className={`text-[11px] px-3 py-1 rounded-full ${modo === "agil" ? "bg-violet-500 text-white" : "text-slate-600"}`}>🚀 Ágil</button>
            <button onClick={() => setModo("completo")} className={`text-[11px] px-3 py-1 rounded-full ${modo === "completo" ? "bg-violet-500 text-white" : "text-slate-600"}`}>📋 Completo (inicio/desarrollo/cierre)</button>
          </div>
          <div className="flex gap-1.5">
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Tema central de la clase (sesión)"
              className="flex-1 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
            <input type="number" value={duracion} onChange={(e) => setDuracion(e.target.value)} placeholder="Min." className="w-16 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
          </div>
          <input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Objetivo de aprendizaje — ¿qué sabrá o sabrá hacer el estudiante al terminar?"
            className="w-full text-xs rounded-lg px-2 py-1.5 mb-2 border border-slate-200 outline-none" />
          {modo === "agil" ? (
            <EditorTexto value={descripcionAgil} onChange={setDescripcionAgil} minHeight={90} placeholder="¿Qué se va a hacer en esta clase?" />
          ) : (
            <>
              <EditorTexto value={inicio} onChange={setInicio} minHeight={80}
                placeholder="INICIO (10-15%): activación y motivación (dinámica corta, pregunta retadora) · recuperación de saberes previos · presentación del objetivo a los estudiantes…" />
              <EditorTexto value={desarrollo} onChange={setDesarrollo} minHeight={80}
                placeholder="DESARROLLO (65-70%): estructuración/modelado (explicación con ejemplos) · práctica guiada (ejercicios en conjunto) · práctica autónoma (trabajo individual o colaborativo)…" />
              <EditorTexto value={cierre} onChange={setCierre} minHeight={80}
                placeholder="CIERRE (15%): síntesis de los puntos clave · evaluación formativa o boleto de salida · metacognición (¿cómo aprendimos hoy?)…" />
              <input value={indicador} onChange={(e) => setIndicador(e.target.value)} placeholder="Indicador de desempeño (opcional)"
                className="w-full text-xs rounded-lg px-2 py-1.5 mb-2 border border-slate-200 outline-none" />
              <label className="text-[10px] text-slate-500 block mb-1">Ajustes razonables / adaptaciones curriculares (opcional)</label>
              <EditorTexto value={ajustes} onChange={setAjustes} minHeight={60} placeholder="Modificaciones planeadas para estudiantes con PIAR/DUA u otros ritmos de aprendizaje…" />
            </>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={limpiar} className="text-xs text-slate-400">Cancelar</button>
            <button onClick={guardar} className="text-xs px-3 py-1.5 rounded-lg bg-violet-500 text-white">{editandoId ? "Guardar cambios" : "Agregar clase"}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAgregando(true)} className="text-[11px] text-violet-500">+ Agregar clase</button>
      )}
    </div>
  );
}

function bloqueImpresion(titulo, contenido, opts = {}) {
  if (!contenido) return null;
  return (
    <div className="print-avoid-break" style={{ marginBottom: 10, background: opts.bg || "transparent", padding: opts.bg ? 8 : 0, borderRadius: opts.bg ? 6 : 0 }}>
      <div style={{ fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: opts.accent || "#1e293b", marginBottom: 3 }}>{titulo}</div>
      <div style={{ fontSize: 12, lineHeight: 1.4, whiteSpace: "pre-line" }}>{contenido}</div>
    </div>
  );
}

function PlaneacionPrintView({ unidad, institucion, materiaNombre, gradoId, onCerrado }) {
  const [clases, setClases] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [estandaresUnidad, setEstandaresUnidad] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([
      api.fetchClases(unidad.id),
      api.fetchTareas(unidad.id),
      api.fetchEstandaresDePlaneacion(unidad.id),
    ]).then(([cls, tsk, est]) => {
      setClases(cls);
      setTareas(tsk);
      setEstandaresUnidad(est);
      setCargando(false);
    });
  }, [unidad.id]);

  useEffect(() => {
    if (cargando) return;
    const id = setTimeout(() => window.print(), 200);
    const onAfter = () => onCerrado();
    window.addEventListener("afterprint", onAfter);
    return () => { clearTimeout(id); window.removeEventListener("afterprint", onAfter); };
  }, [cargando]);

  if (cargando) return null;

  const dba = estandaresUnidad.filter((e) => e?.tipo === "dba");
  const competencias = estandaresUnidad.filter((e) => e?.tipo === "competencia");

  const contenido = (
    <div className="print-only" style={{ maxWidth: "180mm", margin: "0 auto", padding: "0 0 14mm 0", fontFamily: "Georgia, 'Times New Roman', serif", color: "#1e293b" }}>
      <div className="print-avoid-break" style={{ textAlign: "center", marginBottom: 14, borderBottom: "2px solid #8B5CF6", paddingBottom: 8 }}>
        {institucion?.logo_url && <img src={institucion.logo_url} alt="Logo" style={{ maxHeight: 56, marginBottom: 6, display: "block", marginLeft: "auto", marginRight: "auto" }} />}
        <div style={{ fontSize: 17, fontWeight: 700 }}>{institucion?.nombre}</div>
        <div style={{ fontSize: 13, marginTop: 6, fontStyle: "italic" }}>Planeación de Clase</div>
      </div>

      <table className="print-avoid-break" style={{ width: "100%", fontSize: 11.5, marginBottom: 12, borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={{ fontWeight: 700, padding: "2px 6px 2px 0", width: 90 }}>Materia:</td><td>{materiaNombre}</td>
            <td style={{ fontWeight: 700, padding: "2px 6px 2px 20px", width: 60 }}>Grado:</td><td>{gradoId}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 700, padding: "2px 6px 2px 0" }}>Unidad:</td><td colSpan={3}>{unidad.titulo}</td>
          </tr>
        </tbody>
      </table>

      {bloqueImpresion("Finalidad, propósitos u objetivos", unidad.objetivo)}
      {bloqueImpresion("Contenidos", unidad.contenido)}
      {bloqueImpresion("Problema, caso o proyecto", unidad.problema_proyecto, { bg: "#F5F3FF", accent: "#7C3AED" })}
      {bloqueImpresion("Orientaciones generales para la evaluación", unidad.orientaciones_evaluacion, { bg: "#EFF6FF", accent: "#2563EB" })}

      {dba.length > 0 && bloqueImpresion("DBA vinculados", dba.map((d) => `${d.codigo ? d.codigo + " — " : ""}${d.descripcion}`).join("\n"), { bg: "#EFF6FF", accent: "#2563EB" })}
      {competencias.length > 0 && bloqueImpresion("Competencias vinculadas", competencias.map((c) => `${c.codigo ? c.codigo + " — " : ""}${c.descripcion}`).join("\n"), { bg: "#F0FDFA", accent: "#0D9488" })}

      {clases.length > 0 && (
        <div className="print-avoid-break" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Desarrollo de clases</div>
          {clases.map((c, i) => (
            <div key={c.id} className="print-avoid-break" style={{ border: "1px solid #E2E8F0", borderRadius: 6, padding: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 12 }}>
                Clase {i + 1}: {c.titulo}
                {c.fecha && <span style={{ fontWeight: 400, color: "#64748B" }}> · {c.fecha}</span>}
                {c.duracion_minutos && <span style={{ fontWeight: 400, color: "#64748B" }}> · {c.duracion_minutos} min</span>}
              </div>
              {c.momento_inicio && <div style={{ fontSize: 11, marginTop: 4 }}><b>Actividades de apertura:</b> <span dangerouslySetInnerHTML={{ __html: c.momento_inicio }} /></div>}
              {c.momento_desarrollo && <div style={{ fontSize: 11, marginTop: 2 }}><b>Actividades de desarrollo:</b> <span dangerouslySetInnerHTML={{ __html: c.momento_desarrollo }} /></div>}
              {c.momento_cierre && <div style={{ fontSize: 11, marginTop: 2 }}><b>Actividades de cierre:</b> <span dangerouslySetInnerHTML={{ __html: c.momento_cierre }} /></div>}
              {c.indicador_desempeno && <div style={{ fontSize: 11, marginTop: 2 }}><b>Indicador de desempeño:</b> {c.indicador_desempeno}</div>}
            </div>
          ))}
        </div>
      )}

      {tareas.length > 0 && (
        <div className="print-avoid-break" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Tareas</div>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <tbody>
              {tareas.map((t) => (
                <tr key={t.id} style={{ borderTop: "1px solid #E2E8F0" }}>
                  <td style={{ padding: "4px 6px 4px 0", fontWeight: 700 }}>{t.titulo}</td>
                  <td style={{ padding: "4px 6px", color: "#64748B" }}>{t.tipo}</td>
                  <td style={{ padding: "4px 0", color: "#64748B" }}>{t.fecha_entrega ? `Entrega: ${t.fecha_entrega}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="print-footer">
        {institucion?.nombre} · {materiaNombre} · Grado {gradoId} · {unidad.titulo} · Generado {new Date().toLocaleDateString("es-CO")}
      </div>
    </div>
  );

  return createPortal(contenido, document.body);
}

function UnidadCard({ unidad, institucion, materiaNombre, materias, gradoId, grados, onCambio }) {
  const [expandida, setExpandida] = useState(false);
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(unidad.titulo);
  const [objetivo, setObjetivo] = useState(unidad.objetivo || "");
  const [contenido, setContenido] = useState(unidad.contenido || "");
  const [problemaProyecto, setProblemaProyecto] = useState(unidad.problema_proyecto || "");
  const [orientacionesEvaluacion, setOrientacionesEvaluacion] = useState(unidad.orientaciones_evaluacion || "");
  const [estado, setEstado] = useState(unidad.estado);
  const [imprimiendo, setImprimiendo] = useState(false);
  const guardar = async () => {
    await api.editarPlaneacion(unidad.id, {
      titulo: titulo.trim(), objetivo: objetivo.trim() || null, contenido: contenido.trim() || null,
      problema_proyecto: problemaProyecto.trim() || null, orientaciones_evaluacion: orientacionesEvaluacion.trim() || null,
      estado,
    });
    setEditando(false);
    onCambio();
  };

  const eliminar = async () => {
    if (!confirm(`¿Eliminar la unidad "${unidad.titulo}" y todo su contenido (clases, tareas, recursos)? No se puede deshacer.`)) return;
    await api.eliminarPlaneacion(unidad.id);
    onCambio();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-3">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          {editando ? (
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full text-sm font-bold rounded-lg px-2 py-1 border border-violet-300 outline-none mb-1" />
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-slate-800">{unidad.titulo}</h4>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${unidad.estado === "publicado" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {unidad.estado === "publicado" ? "Publicado" : "Borrador"}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">
                {grados.some((g) => String(g.id) === String(unidad.grado_id)) ? `📍 Curso ${unidad.grado_id}` : `🏫 Todo el grado ${unidad.grado_id}°`}
              </span>
              {unidad.materias_extra && unidad.materias_extra.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                  🔗 + {unidad.materias_extra.map((id) => materias.find((m) => m.id === id)?.nombre || id).join(", ")}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setImprimiendo(true)} className="text-xs text-slate-400 hover:text-violet-600" title="Exportar / Imprimir PDF">🖨️</button>
          <button onClick={() => setEditando((v) => !v)} className="text-xs text-slate-400 hover:text-violet-600">{editando ? "✕" : "✏️"}</button>
          <button onClick={eliminar} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
          <button onClick={() => setExpandida((v) => !v)} className="text-xs text-violet-500">{expandida ? "Cerrar ▲" : "Abrir ▼"}</button>
        </div>
      </div>

      {editando ? (
        <div className="mt-2 space-y-2">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase">Finalidad, propósitos u objetivos</label>
            <input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="¿Qué se espera que logren los estudiantes?"
              className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none mt-1" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase">Contenidos</label>
            <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} rows={2} placeholder="Contenido / temas a desarrollar"
              className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none mt-1" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase">Problema, caso o proyecto (opcional)</label>
            <textarea value={problemaProyecto} onChange={(e) => setProblemaProyecto(e.target.value)} rows={2}
              placeholder="Situación real o problema que dará sentido a la secuencia (si aplica)"
              className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none mt-1" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase">Orientaciones generales para la evaluación</label>
            <textarea value={orientacionesEvaluacion} onChange={(e) => setOrientacionesEvaluacion(e.target.value)} rows={2}
              placeholder="Criterios de valoración del portafolio de evidencias; lineamientos para exámenes, etc."
              className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none mt-1" />
          </div>
          <div className="flex items-center gap-2">
            <select value={estado} onChange={(e) => setEstado(e.target.value)} className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none">
              <option value="borrador">Borrador</option>
              <option value="publicado">Publicado</option>
            </select>
            <button onClick={guardar} className="text-xs px-3 py-1.5 rounded-lg bg-violet-500 text-white">Guardar cambios</button>
          </div>
        </div>
      ) : (
        <>
          {unidad.objetivo && <p className="text-xs text-slate-500 mt-1"><b>Finalidad/objetivo:</b> {unidad.objetivo}</p>}
          {unidad.contenido && <p className="text-xs text-slate-500 mt-1 whitespace-pre-line"><b>Contenidos:</b> {unidad.contenido}</p>}
          {unidad.problema_proyecto && (
            <p className="text-xs text-slate-500 mt-1 whitespace-pre-line bg-violet-50 rounded-lg p-2"><b>Problema/proyecto:</b> {unidad.problema_proyecto}</p>
          )}
          {unidad.orientaciones_evaluacion && (
            <p className="text-xs text-slate-500 mt-1 whitespace-pre-line bg-blue-50 rounded-lg p-2"><b>Evaluación:</b> {unidad.orientaciones_evaluacion}</p>
          )}
        </>
      )}

      {expandida && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap gap-3 mb-2">
            <SelectorEstandares planeacionId={unidad.id} tipo="dba" />
            <SelectorEstandares planeacionId={unidad.id} tipo="competencia" />
          </div>
          <RecursosLista planeacionId={unidad.id} />
          <ClasesLista unidadId={unidad.id} grados={grados} />
          <TareasLista planeacionId={unidad.id} />
        </div>
      )}

      {imprimiendo && (
        <PlaneacionPrintView unidad={unidad} institucion={institucion} materiaNombre={materiaNombre} gradoId={gradoId} onCerrado={() => setImprimiendo(false)} />
      )}
    </div>
  );
}

const PROMPT_PLANTILLA = `Actúa como un experto en diseño curricular colombiano, siguiendo el modelo de secuencias didácticas de Ángel Díaz-Barriga (apertura, desarrollo, cierre).

Necesito un plan de clases para:
- Materia: [COMPLETAR]
- Grado: [COMPLETAR]
- Tema/Unidad: [COMPLETAR]
- Número de clases: [COMPLETAR, ej: 4]
- Objetivo general: [COMPLETAR, opcional]

Devolveme ÚNICAMENTE un JSON válido (sin texto antes ni después, sin bloques de código \`\`\`), con esta estructura exacta:

{
  "titulo": "Título de la unidad",
  "objetivo": "Objetivo de aprendizaje general de la unidad",
  "clases": [
    {
      "titulo": "Título de la clase 1",
      "duracion_minutos": 60,
      "momento_inicio": "Actividad de apertura, recuperación de saberes previos o pregunta detonadora...",
      "momento_desarrollo": "Actividades de desarrollo, aplicación de la información en un caso o problema...",
      "momento_cierre": "Actividad de cierre, síntesis o reconstrucción de lo aprendido...",
      "indicador_desempeno": "Indicador de desempeño observable de esta clase"
    }
  ]
}`;

function ImportarPlanIAModal({ materiaId, materias, gradoId, periodo, onCerrar, onImportado }) {
  const [alcance, setAlcance] = useState("grado");
  const [materiasExtra, setMateriasExtra] = useState([]);
  const [texto, setTexto] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [previa, setPrevia] = useState(null);
  const [errorParseo, setErrorParseo] = useState("");
  const [importando, setImportando] = useState(false);

  const { nivel } = nivelYCurso(gradoId);
  const otrasMaterias = materias.filter((m) => m.id !== materiaId);
  const toggleMateriaExtra = (id) => setMateriasExtra((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const copiarPrompt = async () => {
    try {
      await navigator.clipboard.writeText(PROMPT_PLANTILLA);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (e) {
      alert("No se pudo copiar automáticamente — seleccioná el texto y copialo manualmente.");
    }
  };

  const analizar = () => {
    setErrorParseo("");
    setPrevia(null);
    let limpio = texto.trim();
    // por si la IA igual lo mandó envuelto en ```json ... ```
    limpio = limpio.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
    try {
      const json = JSON.parse(limpio);
      if (!json.titulo || !Array.isArray(json.clases)) {
        setErrorParseo("El JSON no tiene el formato esperado (falta 'titulo' o 'clases').");
        return;
      }
      setPrevia(json);
    } catch (e) {
      setErrorParseo("No pude leer eso como JSON válido. Revisá que hayas pegado la respuesta completa, sin texto extra antes o después.");
    }
  };

  const importar = async () => {
    setImportando(true);
    try {
      const gradoIdAGuardar = alcance === "grado" ? nivel : gradoId;
      await api.crearUnidadConClases(
        { materia_id: materiaId, materias_extra: materiasExtra, grado_id: gradoIdAGuardar, periodo, titulo: previa.titulo, objetivo: previa.objetivo || null, orden: 999 },
        previa.clases
      );
      onImportado();
    } catch (e) {
      alert("Error al importar: " + e.message);
    }
    setImportando(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onCerrar}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">✨ Importar plan generado por IA</h3>
          <button onClick={onCerrar} className="text-slate-400">✕</button>
        </div>

        <div className="bg-violet-50 rounded-xl p-3 mb-4">
          <div className="text-xs font-semibold text-slate-600 mb-1">Paso 1 — Copiá este mensaje y pegalo en tu IA de confianza (Claude, ChatGPT, etc.)</div>
          <p className="text-[11px] text-slate-500 mb-2">Completá los corchetes [COMPLETAR] con tu materia, grado y tema antes de mandarlo.</p>
          <pre className="text-[10px] bg-white rounded-lg p-2 whitespace-pre-wrap max-h-32 overflow-y-auto border border-slate-200">{PROMPT_PLANTILLA}</pre>
          <button onClick={copiarPrompt} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white mt-2">
            {copiado ? "✔ Copiado" : "📋 Copiar mensaje"}
          </button>
        </div>

        <div className="mb-4">
          <div className="text-xs font-semibold text-slate-600 mb-1">Paso 2 — Pegá acá la respuesta (el JSON) que te dio la IA</div>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6} placeholder='{ "titulo": "...", "clases": [...] }'
            className="w-full text-xs font-mono rounded-lg px-3 py-2 border border-slate-200 outline-none" />
          <button onClick={analizar} disabled={!texto.trim()} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white mt-2 disabled:opacity-50">
            Analizar
          </button>
          {errorParseo && <p className="text-xs text-rose-500 mt-2">{errorParseo}</p>}
        </div>

        {previa && (
          <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-3 mb-4">
            <div className="text-xs font-semibold text-emerald-700 mb-1">Vista previa — se va a crear:</div>
            <div className="text-sm font-bold text-slate-800">{previa.titulo}</div>
            {previa.objetivo && <div className="text-xs text-slate-500 mt-0.5">{previa.objetivo}</div>}
            <div className="text-xs text-slate-600 mt-2">{previa.clases.length} clase(s):</div>
            <ul className="text-xs text-slate-500 list-disc list-inside">
              {previa.clases.map((c, i) => <li key={i}>{c.titulo || `Clase ${i + 1}`}</li>)}
            </ul>

            {otrasMaterias.length > 0 && (
              <div className="mt-3">
                <label className="text-[11px] text-slate-500 block mb-1">Combinar con otra(s) materia(s) (opcional)</label>
                <div className="flex flex-wrap gap-1.5">
                  {otrasMaterias.map((m) => (
                    <button key={m.id} onClick={() => toggleMateriaExtra(m.id)}
                      className={`text-xs px-3 py-1 rounded-full border ${materiasExtra.includes(m.id) ? "bg-violet-500 text-white border-violet-500" : "bg-white text-slate-600 border-slate-200"}`}>
                      {m.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3">
              <label className="text-[11px] text-slate-500 block mb-1">Esta planeación aplica a</label>
              <div className="flex gap-1 rounded-full bg-white p-1 w-fit border border-slate-200">
                <button onClick={() => setAlcance("grado")} className={`text-xs px-3 py-1.5 rounded-full ${alcance === "grado" ? "bg-violet-500 text-white" : "text-slate-600"}`}>🏫 Todo el grado {nivel}°</button>
                <button onClick={() => setAlcance("curso")} className={`text-xs px-3 py-1.5 rounded-full ${alcance === "curso" ? "bg-violet-500 text-white" : "text-slate-600"}`}>📍 Solo curso {gradoId}</button>
              </div>
            </div>

            <button disabled={importando} onClick={importar} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-emerald-500 text-white mt-3 disabled:opacity-60">
              {importando ? "Importando…" : "✔ Crear esta unidad con sus clases"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NuevaUnidadForm({ materiaId, materias, gradoId, periodo, orden, onCancelar, onCreada }) {
  const [titulo, setTitulo] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [alcance, setAlcance] = useState("grado"); // "grado" | "curso"
  const [materiasExtra, setMateriasExtra] = useState([]);
  const [guardando, setGuardando] = useState(false);

  const { nivel, curso } = nivelYCurso(gradoId);
  const gradoIdAGuardar = alcance === "grado" ? nivel : gradoId;
  const otrasMaterias = materias.filter((m) => m.id !== materiaId);

  const toggleMateriaExtra = (id) => setMateriasExtra((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const guardar = async () => {
    if (!titulo.trim()) { alert("Escribe un título para la unidad/tema."); return; }
    setGuardando(true);
    try {
      await api.crearPlaneacion({
        tipo: "unidad", materia_id: materiaId, materias_extra: materiasExtra, grado_id: gradoIdAGuardar, periodo,
        titulo: titulo.trim(), objetivo: objetivo.trim() || null, orden,
      });
      onCreada();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-2xl p-4 mb-3">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título de la unidad/tema (ej: Unidad 1 — Números racionales)"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Objetivo de aprendizaje (opcional)"
        className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none bg-white" />

      {otrasMaterias.length > 0 && (
        <div className="mb-3">
          <label className="text-xs text-slate-500 block mb-1">Combinar con otra(s) materia(s) (opcional — para clases integradas, ej: Ética + Religión)</label>
          <div className="flex flex-wrap gap-1.5">
            {otrasMaterias.map((m) => (
              <button key={m.id} onClick={() => toggleMateriaExtra(m.id)}
                className={`text-xs px-3 py-1.5 rounded-full border ${materiasExtra.includes(m.id) ? "bg-violet-500 text-white border-violet-500" : "bg-white text-slate-600 border-slate-200"}`}>
                {m.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-3">
        <label className="text-xs text-slate-500 block mb-1">Esta planeación aplica a</label>
        <div className="flex gap-1 rounded-full bg-white p-1 w-fit border border-slate-200">
          <button onClick={() => setAlcance("grado")} className={`text-xs px-3 py-1.5 rounded-full ${alcance === "grado" ? "bg-violet-500 text-white" : "text-slate-600"}`}>
            🏫 Todo el grado {nivel}° (todos los cursos)
          </button>
          <button onClick={() => setAlcance("curso")} className={`text-xs px-3 py-1.5 rounded-full ${alcance === "curso" ? "bg-violet-500 text-white" : "text-slate-600"}`}>
            📍 Solo el curso {gradoId}
          </button>
        </div>
        {alcance === "grado" && (
          <p className="text-[11px] text-slate-400 mt-1">Va a aparecer en todos los cursos del grado {nivel}° — usá el "Control por curso" dentro de cada clase para registrar en qué curso y fecha se dictó cada una.</p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : "Crear unidad"}
        </button>
      </div>
    </div>
  );
}

const MESES_NOMBRE_PLAN = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS_SEMANA_CORTOS_PLAN = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function aFechaStrPlan(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function AgregarClaseCalendarioForm({ unidades, fecha, onCancelar, onCreada }) {
  const [unidadId, setUnidadId] = useState(unidades[0]?.id || "");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [duracion, setDuracion] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!unidadId) { alert("Elegí a qué unidad pertenece esta clase."); return; }
    if (!titulo.trim()) { alert("Escribe un título."); return; }
    setGuardando(true);
    try {
      await api.crearPlaneacion({
        tipo: "clase", unidad_id: unidadId, titulo: titulo.trim(), fecha, orden: 999,
        duracion_minutos: duracion ? parseInt(duracion, 10) : null,
        momento_desarrollo: descripcion.trim() || null,
      });
      onCreada();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-lg p-3 mt-2">
      <label className="text-[11px] text-slate-500 block mb-1">Unidad a la que pertenece</label>
      <select value={unidadId} onChange={(e) => setUnidadId(parseInt(e.target.value, 10))} className="w-full text-xs rounded-lg px-2 py-1.5 mb-2 border border-slate-200 outline-none bg-white">
        {unidades.map((u) => <option key={u.id} value={u.id}>{u.titulo}</option>)}
      </select>
      <div className="flex gap-1.5 mb-2">
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título de la clase"
          className="flex-1 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
        <input type="number" value={duracion} onChange={(e) => setDuracion(e.target.value)} placeholder="Min." className="w-16 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
      </div>
      <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} placeholder="¿Qué se va a hacer? (opcional)"
        className="w-full text-xs rounded-lg px-2 py-1.5 mb-2 border border-slate-200 outline-none" />
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-400">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-xs px-3 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : "Agregar clase"}
        </button>
      </div>
    </div>
  );
}

function CalendarioClases({ materiaId, gradoId, periodo, onAbrirUnidad }) {
  const [clases, setClases] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mesActual, setMesActual] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [diaSeleccionado, setDiaSeleccionado] = useState(aFechaStrPlan(new Date()));
  const [agregando, setAgregando] = useState(false);

  const cargar = () => {
    setCargando(true);
    api.fetchTodasLasClases(materiaId, gradoId, periodo).then(({ clases, unidades }) => { setClases(clases); setUnidades(unidades); setCargando(false); });
  };
  useEffect(() => { cargar(); }, [materiaId, gradoId, periodo]);

  const primerDiaMes = new Date(mesActual.getFullYear(), mesActual.getMonth(), 1);
  const diasEnMes = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 0).getDate();
  const offset = (primerDiaMes.getDay() + 6) % 7;
  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d);
  while (celdas.length % 7 !== 0) celdas.push(null);

  const clasesDelDia = (fechaStr) => clases.filter((c) => c.fecha === fechaStr);
  const clasesSeleccionado = clasesDelDia(diaSeleccionado);
  const hoyStr = aFechaStrPlan(new Date());

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;
  if (unidades.length === 0) {
    return <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">Creá primero una unidad/tema para poder agendar clases en el calendario.</div>;
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl border border-slate-100 p-3">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setMesActual((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))} className="text-slate-400 hover:text-violet-600 px-2 text-lg">‹</button>
          <div className="font-bold text-slate-800 capitalize">{MESES_NOMBRE_PLAN[mesActual.getMonth()]} {mesActual.getFullYear()}</div>
          <button onClick={() => setMesActual((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))} className="text-slate-400 hover:text-violet-600 px-2 text-lg">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DIAS_SEMANA_CORTOS_PLAN.map((d) => <div key={d} className="text-center text-[10px] font-bold text-slate-400 py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {celdas.map((d, i) => {
            if (d === null) return <div key={i} />;
            const fechaStr = aFechaStrPlan(new Date(mesActual.getFullYear(), mesActual.getMonth(), d));
            const clasesDia = clasesDelDia(fechaStr);
            const esHoy = fechaStr === hoyStr;
            const esSeleccionado = fechaStr === diaSeleccionado;
            return (
              <button key={i} onClick={() => { setDiaSeleccionado(fechaStr); setAgregando(false); }}
                className="aspect-square rounded-lg p-1 flex flex-col items-center justify-start relative"
                style={{ background: esSeleccionado ? "#EDE9FE" : esHoy ? "#F5F3FF" : "transparent", border: esHoy ? "1.5px solid #8B5CF6" : "1px solid transparent" }}>
                <span className={`text-[11px] ${esSeleccionado ? "font-bold text-violet-700" : "text-slate-600"}`}>{d}</span>
                {clasesDia.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-0.5" />}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-500 mb-2">
          {fechaALocalPlan(diaSeleccionado).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
        </div>
        {clasesSeleccionado.length === 0 ? (
          <div className="text-sm text-slate-400 bg-white rounded-2xl p-4 text-center border border-dashed border-slate-200 mb-2">Sin clases agendadas este día.</div>
        ) : (
          <div className="space-y-2 mb-2">
            {clasesSeleccionado.map((c) => (
              <button key={c.id} onClick={() => onAbrirUnidad(c.unidad_id)} className="w-full text-left bg-white rounded-xl border border-slate-100 p-3 hover:border-violet-200">
                <div className="text-sm font-semibold text-slate-800">{c.titulo}</div>
                <div className="text-[11px] text-violet-500">{c.unidad_titulo}</div>
                {c.momento_desarrollo && <TextoEnriquecido html={c.momento_desarrollo} className="text-[11px] text-slate-500 mt-1 line-clamp-2" />}
              </button>
            ))}
          </div>
        )}
        {agregando ? (
          <AgregarClaseCalendarioForm unidades={unidades} fecha={diaSeleccionado} onCancelar={() => setAgregando(false)} onCreada={() => { setAgregando(false); cargar(); }} />
        ) : (
          <button onClick={() => setAgregando(true)} className="text-xs text-violet-500">+ Agregar clase este día</button>
        )}
      </div>
    </div>
  );
}

function fechaALocalPlan(fechaStr) {
  const [a, m, d] = fechaStr.split("-").map(Number);
  return new Date(a, m - 1, d);
}

function PendientesModal({ materiaId, materiaNombre, onClose }) {
  const [pendientes, setPendientes] = useState([]);
  const [cargando, setCargando] = useState(true);

  const cargar = () => {
    setCargando(true);
    api.fetchDictadosPendientes(materiaId).then((d) => { setPendientes(d); setCargando(false); });
  };
  useEffect(() => { cargar(); }, [materiaId]);

  const marcarDictada = async (id) => { await api.editarDictado(id, { estado: "dictada" }); cargar(); };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">📋 Clases pendientes — {materiaNombre}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : pendientes.length === 0 ? (
          <div className="text-sm text-slate-400">No hay clases pendientes ni aplazadas en esta materia. 🎉</div>
        ) : (
          <div className="space-y-1.5">
            {pendientes.map((d) => {
              const info = ESTADOS_DICTADO.find((e) => e.key === d.estado);
              return (
                <div key={d.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <div className="text-xs">
                    <span className="font-semibold text-slate-700">{d.clase_titulo}</span>
                    <span className="text-slate-400"> · Curso {d.grado_id}{d.fecha ? ` · ${d.fecha}` : ""}</span>
                    <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${info.color}22`, color: info.color }}>{info.label}</span>
                  </div>
                  <button onClick={() => marcarDictada(d.id)} className="text-[11px] text-violet-500 shrink-0">Marcar dictada</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FilaEstandar({ e, onCambio }) {
  const [editando, setEditando] = useState(false);
  const [codigo, setCodigo] = useState(e.codigo || "");
  const [descripcion, setDescripcion] = useState(e.descripcion || "");

  const guardar = async () => {
    if (!descripcion.trim()) { alert("La descripción no puede quedar vacía."); return; }
    try {
      await api.editarEstandar(e.id, { codigo: codigo.trim() || null, descripcion: descripcion.trim() });
      setEditando(false);
      onCambio();
    } catch (err) {
      alert("Error al guardar: " + err.message);
    }
  };

  const eliminar = async () => {
    if (!confirm(`¿Eliminar "${e.descripcion}" del catálogo? Se quita de todas las clases/unidades donde estuviera vinculado. No se puede deshacer.`)) return;
    try {
      await api.eliminarEstandar(e.id);
      onCambio();
    } catch (err) {
      alert("Error al eliminar: " + err.message);
    }
  };

  if (editando) {
    return (
      <div className="flex items-center gap-2 bg-violet-50 rounded-lg p-2">
        <input value={codigo} onChange={(ev) => setCodigo(ev.target.value)} placeholder="Código" className="w-20 text-xs rounded px-2 py-1 border border-slate-200 outline-none" />
        <input value={descripcion} onChange={(ev) => setDescripcion(ev.target.value)} placeholder="Descripción" className="flex-1 text-xs rounded px-2 py-1 border border-slate-200 outline-none" />
        <button onClick={guardar} className="text-xs px-2 py-1 rounded-lg bg-violet-500 text-white shrink-0">Guardar</button>
        <button onClick={() => setEditando(false)} className="text-xs text-slate-400 shrink-0">✕</button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-2 py-1.5">
      <div className="text-xs text-slate-700 min-w-0">{e.codigo ? <span className="font-semibold">{e.codigo} — </span> : ""}{e.descripcion}</div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => setEditando(true)} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
        <button onClick={eliminar} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
      </div>
    </div>
  );
}

function CargaMasivaEstandares({ tipo, onCargado }) {
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);

  const lineas = texto.split("\n").map((l) => l.trim()).filter(Boolean);

  const parsearLinea = (linea) => {
    // Acepta "CÓDIGO: descripción", "CÓDIGO - descripción", o solo descripción sin código
    const match = linea.match(/^([A-Za-zÁÉÍÓÚñÑ0-9.]+)\s*[:\-–]\s*(.+)$/);
    if (match) return { codigo: match[1].trim(), descripcion: match[2].trim() };
    return { codigo: null, descripcion: linea };
  };

  const cargarTodos = async () => {
    if (lineas.length === 0) return;
    setCargando(true);
    let hechos = 0;
    for (const linea of lineas) {
      const { codigo, descripcion } = parsearLinea(linea);
      if (!descripcion) continue;
      try {
        await api.crearEstandar({ tipo, codigo, descripcion });
        hechos++;
      } catch (e) {
        // sigue con las demás aunque una falle
      }
    }
    setCargando(false);
    setTexto("");
    setAbierto(false);
    alert(`Se cargaron ${hechos} de ${lineas.length} líneas.`);
    onCargado();
  };

  if (!abierto) {
    return <button onClick={() => setAbierto(true)} className="text-xs font-semibold text-violet-500 mb-3">+ Cargar varios de una vez</button>;
  }

  return (
    <div className="bg-violet-50 rounded-xl p-3 mb-3">
      <p className="text-[11px] text-slate-500 mb-2">
        Pegá uno por línea. Podés poner el código y la descripción separados por "<b>:</b>" o "<b>-</b>" (ej: <i>DBA1: Reconoce estructuras narrativas</i>),
        o solo la descripción si no tiene código.
      </p>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6}
        placeholder={"DBA1: Reconoce estructuras narrativas...\nDBA2: Comprende textos argumentativos...\nSolo una descripción sin código también sirve"}
        className="w-full text-xs font-mono rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-slate-400">{lineas.length} línea(s) detectada(s)</span>
        <div className="flex gap-2">
          <button onClick={() => setAbierto(false)} className="text-xs text-slate-500 px-2 py-1.5">Cancelar</button>
          <button disabled={cargando || lineas.length === 0} onClick={cargarTodos} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-50">
            {cargando ? "Cargando…" : `Cargar ${lineas.length} línea(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

function GestionarEstandaresModal({ onClose }) {
  const [dba, setDba] = useState([]);
  const [competencias, setCompetencias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState("dba");

  const cargar = () => {
    setCargando(true);
    Promise.all([api.fetchEstandares("dba"), api.fetchEstandares("competencia")]).then(([d, c]) => {
      setDba(d); setCompetencias(c); setCargando(false);
    });
  };
  useEffect(() => { cargar(); }, []);

  const lista = tab === "dba" ? dba : competencias;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">🗂️ Catálogo de DBA y Competencias</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Corregí o eliminá los que hayan quedado mal escritos. Es un catálogo compartido: los cambios se reflejan en todas las clases/unidades donde estén vinculados.
        </p>
        <div className="flex gap-1 mb-3 rounded-full bg-slate-100 p-1 w-fit">
          <button onClick={() => setTab("dba")} className={`text-xs px-3 py-1.5 rounded-full ${tab === "dba" ? "bg-blue-500 text-white" : "text-slate-600"}`}>DBA ({dba.length})</button>
          <button onClick={() => setTab("competencia")} className={`text-xs px-3 py-1.5 rounded-full ${tab === "competencia" ? "bg-teal-500 text-white" : "text-slate-600"}`}>Competencias ({competencias.length})</button>
        </div>

        <CargaMasivaEstandares tipo={tab} onCargado={cargar} />

        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : lista.length === 0 ? (
          <div className="text-sm text-slate-400">Todavía no hay ninguno creado en esta categoría.</div>
        ) : (
          <div className="space-y-1.5">
            {lista.map((e) => <FilaEstandar key={e.id} e={e} onCambio={cargar} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export function VistaPlaneaciones({ grados, gradoActivo, periodoActivo, materiaActiva }) {
  const [materias, setMaterias] = useState([]);
  const [materiaId, setMateriaId] = useState(materiaActiva || "");
  const [gradoId, setGradoId] = useState(gradoActivo || "");
  const [periodo, setPeriodo] = useState("1");
  const [unidades, setUnidades] = useState([]);
  const [config, setConfig] = useState({ cantidad_periodos: 4, sistema_periodos: "bimestre" });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { if (gradoActivo) setGradoId(gradoActivo); }, [gradoActivo]);
  useEffect(() => { if (materiaActiva) setMateriaId(materiaActiva); }, [materiaActiva]);
  useEffect(() => { if (periodoActivo) setPeriodo(periodoActivo); }, [periodoActivo]);
  const [formAbierto, setFormAbierto] = useState(false);
  const [institucion, setInstitucion] = useState(null);
  const [pendientesAbierto, setPendientesAbierto] = useState(false);
  const [estandaresAbierto, setEstandaresAbierto] = useState(false);
  const [vista, setVista] = useState("unidades"); // "unidades" | "calendario"
  const [importarIAAbierto, setImportarIAAbierto] = useState(false);
  const [soloVigente, setSoloVigente] = useState(true);

  useEffect(() => {
    api.fetchMaterias().then((data) => { setMaterias(data); if (data[0]) setMateriaId(data[0].id); });
    api.fetchInstitucion().then(setInstitucion);
  }, []);
  useEffect(() => { if (grados.length && !gradoId) setGradoId(grados[0].id); }, [grados]);

  // Respeta la configuración real de periodos de cada materia (bimestre/trimestre/semestre),
  // la misma que se define en Calificaciones → Escala y periodos.
  useEffect(() => {
    if (!materiaId) return;
    api.fetchNotasConfig(materiaId).then((cfg) => {
      setConfig(cfg);
      if (cfg?.periodo_actual) setPeriodo(cfg.periodo_actual);
    });
  }, [materiaId]);

  const marcarPeriodoVigente = async () => {
    await api.guardarNotasConfig(materiaId, { ...config, periodo_actual: periodo });
    setConfig((prev) => ({ ...prev, periodo_actual: periodo }));
  };

  useEffect(() => {
    if (soloVigente && config.periodo_actual && parseInt(periodo, 10) < parseInt(config.periodo_actual, 10)) {
      setPeriodo(config.periodo_actual);
    }
  }, [soloVigente]);

  const listaPeriodos = periodosDe(config);
  useEffect(() => {
    if (!listaPeriodos.includes(periodo)) setPeriodo(listaPeriodos[0] || "1");
  }, [materiaId, config]);

  const cargar = () => {
    if (!materiaId || !gradoId) return;
    setCargando(true);
    setError(null);
    api.fetchUnidades(materiaId, gradoId, periodo)
      .then((data) => { setUnidades(data); setCargando(false); })
      .catch((e) => { setError(e.message); setCargando(false); });
  };
  useEffect(() => { cargar(); }, [materiaId, gradoId, periodo]);

  const niveles = agruparPorNivel(grados);
  const { nivel: nivelActual } = nivelYCurso(gradoId || (grados[0]?.id || ""));
  const cursosDelNivel = niveles.find((n) => n.nivel === nivelActual)?.cursos || [];

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <select value={materiaId} onChange={(e) => setMateriaId(parseInt(e.target.value, 10))} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        <select value={nivelActual} onChange={(e) => {
          const n = niveles.find((x) => x.nivel === e.target.value);
          if (n?.cursos[0]) setGradoId(n.cursos[0].id);
        }} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {niveles.map((n) => <option key={n.nivel} value={n.nivel}>Grado {n.nivel}°</option>)}
        </select>
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {cursosDelNivel.map((g) => <option key={g.id} value={g.id}>Curso {g.id}</option>)}
        </select>
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {listaPeriodos
            .filter((p) => !soloVigente || parseInt(p, 10) >= parseInt(config.periodo_actual || "1", 10))
            .map((p) => <option key={p} value={p}>Periodo {p}{p === config.periodo_actual ? " (vigente)" : ""}</option>)}
        </select>
        {periodo !== config.periodo_actual && (
          <button onClick={marcarPeriodoVigente} title="Marcar este periodo como el vigente para esta materia" className="text-xs px-2.5 py-1.5 rounded-full bg-violet-100 text-violet-700 shrink-0">📌 Marcar como vigente</button>
        )}
        <label className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
          <input type="checkbox" checked={soloVigente} onChange={(e) => setSoloVigente(e.target.checked)} />
          Ocultar periodos anteriores
        </label>
        <button onClick={() => setPendientesAbierto(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-200 text-amber-600">📋 Pendientes</button>
        <button onClick={() => setEstandaresAbierto(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">🗂️ Gestionar DBA/Competencias</button>
        <div className="flex gap-1 rounded-full bg-white p-1 border border-slate-200">
          <button onClick={() => setVista("unidades")} className={`text-xs px-3 py-1.5 rounded-full ${vista === "unidades" ? "bg-violet-500 text-white" : "text-slate-600"}`}>📋 Por unidad</button>
          <button onClick={() => setVista("calendario")} className={`text-xs px-3 py-1.5 rounded-full ${vista === "calendario" ? "bg-violet-500 text-white" : "text-slate-600"}`}>📅 Calendario</button>
        </div>
        <button onClick={() => setImportarIAAbierto(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-violet-300 text-violet-600">✨ Importar plan (IA)</button>
        <button onClick={() => setFormAbierto((v) => !v)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white ml-auto">
          {formAbierto ? "Cerrar" : "+ Nueva unidad/tema"}
        </button>
      </div>

      <p className="text-[11px] text-slate-400 mb-3">
        Plan de estudios de la materia, organizado por unidades/temas dentro de cada periodo. Cada unidad puede tener varias clases, tareas con rúbrica, y recursos de Google Drive/Docs/Forms.
        Los periodos ({config.sistema_periodos === "trimestre" ? "trimestre" : config.sistema_periodos === "semestre" ? "semestre" : "bimestre"}, {listaPeriodos.length} en total) se toman de la configuración de esta materia en Calificaciones → Escala y periodos.
      </p>

      {formAbierto && (
        <NuevaUnidadForm materiaId={materiaId} materias={materias} gradoId={gradoId} periodo={periodo} orden={unidades.length}
          onCancelar={() => setFormAbierto(false)} onCreada={() => { setFormAbierto(false); cargar(); }} />
      )}

      {vista === "calendario" ? (
        <CalendarioClases materiaId={materiaId} gradoId={gradoId} periodo={periodo} onAbrirUnidad={() => setVista("unidades")} />
      ) : cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : error ? (
        <div className="text-sm text-rose-500 bg-rose-50 rounded-xl p-3">Error al cargar: {error}</div>
      ) : unidades.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">
          Todavía no hay unidades/temas para este periodo. Creá la primera con "+ Nueva unidad/tema".
        </div>
      ) : (
        unidades.map((u) => <UnidadCard key={u.id} unidad={u} institucion={institucion} materiaNombre={materias.find((m) => m.id === materiaId)?.nombre || ""} materias={materias} gradoId={gradoId} grados={grados} onCambio={cargar} />)
      )}
      {pendientesAbierto && (
        <PendientesModal materiaId={materiaId} materiaNombre={materias.find((m) => m.id === materiaId)?.nombre || ""} onClose={() => setPendientesAbierto(false)} />
      )}
      {estandaresAbierto && <GestionarEstandaresModal onClose={() => setEstandaresAbierto(false)} />}
      {importarIAAbierto && (
        <ImportarPlanIAModal materiaId={materiaId} materias={materias} gradoId={gradoId} periodo={periodo}
          onCerrar={() => setImportarIAAbierto(false)} onImportado={() => { setImportarIAAbierto(false); cargar(); }} />
      )}
    </div>
  );
}
