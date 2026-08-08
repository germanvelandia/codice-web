import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { agruparPorNivel, nivelYCurso } from "../lib/gamification";

const ICONO_RECURSO = { drive: "📁", docs: "📄", forms: "📝", otro: "🔗" };
const LABEL_RECURSO = { drive: "Google Drive", docs: "Google Docs", forms: "Google Forms", otro: "Enlace" };
const TIPOS_TAREA = [
  { key: "tarea", label: "Tarea" },
  { key: "lectura", label: "Lectura" },
  { key: "proyecto", label: "Proyecto" },
  { key: "evaluacion", label: "Evaluación" },
];

function RecursosLista({ planeacionId }) {
  const [recursos, setRecursos] = useState([]);
  const [agregando, setAgregando] = useState(false);
  const [url, setUrl] = useState("");
  const [titulo, setTitulo] = useState("");

  const cargar = () => api.fetchRecursos(planeacionId).then(setRecursos);
  useEffect(() => { cargar(); }, [planeacionId]);

  const agregar = async () => {
    if (!url.trim()) return;
    await api.crearRecurso(planeacionId, url, titulo);
    setUrl(""); setTitulo(""); setAgregando(false);
    cargar();
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

  const cargar = () => api.fetchTareas(planeacionId).then(setTareas);
  useEffect(() => { cargar(); }, [planeacionId]);

  const agregar = async () => {
    if (!titulo.trim()) return;
    await api.crearTarea({ planeacion_id: planeacionId, titulo: titulo.trim(), tipo, fecha_entrega: fechaEntrega || null });
    setTitulo(""); setFechaEntrega(""); setAgregando(false);
    cargar();
  };

  const quitar = async (id) => { if (!confirm("¿Eliminar esta tarea?")) return; await api.eliminarTarea(id); cargar(); };

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="text-xs font-semibold text-slate-500 mb-2">Tareas</div>
      {tareas.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {tareas.map((t) => (
            <div key={t.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-2.5 py-1.5">
              <div className="text-xs text-slate-700">
                <span className="font-semibold">{t.titulo}</span>
                <span className="text-slate-400"> · {TIPOS_TAREA.find((x) => x.key === t.tipo)?.label}{t.fecha_entrega ? ` · Entrega: ${t.fecha_entrega}` : ""}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setRubricaAbierta(t)} className="text-[11px] text-violet-500">📊 Rúbrica</button>
                <button onClick={() => quitar(t.id)} className="text-slate-300 hover:text-rose-500 text-xs">✕</button>
              </div>
            </div>
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

function ClasesLista({ unidadId }) {
  const [clases, setClases] = useState([]);
  const [agregando, setAgregando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState("");
  const [contenido, setContenido] = useState("");

  const cargar = () => api.fetchClases(unidadId).then(setClases);
  useEffect(() => { cargar(); }, [unidadId]);

  const agregar = async () => {
    if (!titulo.trim()) return;
    await api.crearPlaneacion({ tipo: "clase", unidad_id: unidadId, titulo: titulo.trim(), fecha: fecha || null, contenido: contenido.trim() || null, orden: clases.length });
    setTitulo(""); setFecha(""); setContenido(""); setAgregando(false);
    cargar();
  };

  const quitar = async (id) => { if (!confirm("¿Eliminar esta clase?")) return; await api.eliminarPlaneacion(id); cargar(); };

  return (
    <div className="mt-3">
      <div className="text-xs font-semibold text-slate-500 mb-2">Clases de esta unidad</div>
      {clases.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {clases.map((c, i) => (
            <div key={c.id} className="bg-white border border-slate-100 rounded-lg p-2.5">
              <div className="flex justify-between items-start">
                <div className="text-xs">
                  <span className="font-semibold text-slate-700">Clase {i + 1}: {c.titulo}</span>
                  {c.fecha && <span className="text-slate-400"> · {c.fecha}</span>}
                </div>
                <button onClick={() => quitar(c.id)} className="text-slate-300 hover:text-rose-500 text-xs">✕</button>
              </div>
              {c.contenido && <div className="text-[11px] text-slate-500 mt-1 whitespace-pre-line">{c.contenido}</div>}
              <RecursosLista planeacionId={c.id} />
            </div>
          ))}
        </div>
      )}
      {agregando ? (
        <div className="bg-violet-50 rounded-lg p-2.5 space-y-1.5">
          <div className="flex gap-1.5">
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título de la clase"
              className="flex-1 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
          </div>
          <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} rows={2} placeholder="Desarrollo de la clase (actividades, metodología…)"
            className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setAgregando(false)} className="text-xs text-slate-400">Cancelar</button>
            <button onClick={agregar} className="text-xs px-3 py-1.5 rounded-lg bg-violet-500 text-white">Agregar clase</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAgregando(true)} className="text-[11px] text-violet-500">+ Agregar clase</button>
      )}
    </div>
  );
}

function UnidadCard({ unidad, onCambio }) {
  const [expandida, setExpandida] = useState(false);
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(unidad.titulo);
  const [objetivo, setObjetivo] = useState(unidad.objetivo || "");
  const [contenido, setContenido] = useState(unidad.contenido || "");
  const [estado, setEstado] = useState(unidad.estado);

  const guardar = async () => {
    await api.editarPlaneacion(unidad.id, { titulo: titulo.trim(), objetivo: objetivo.trim() || null, contenido: contenido.trim() || null, estado });
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
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-slate-800">{unidad.titulo}</h4>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${unidad.estado === "publicado" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {unidad.estado === "publicado" ? "Publicado" : "Borrador"}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setEditando((v) => !v)} className="text-xs text-slate-400 hover:text-violet-600">{editando ? "✕" : "✏️"}</button>
          <button onClick={eliminar} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
          <button onClick={() => setExpandida((v) => !v)} className="text-xs text-violet-500">{expandida ? "Cerrar ▲" : "Abrir ▼"}</button>
        </div>
      </div>

      {editando ? (
        <div className="mt-2 space-y-2">
          <input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Objetivo de aprendizaje de la unidad"
            className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
          <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} rows={2} placeholder="Contenido / temas a desarrollar"
            className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
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
          {unidad.objetivo && <p className="text-xs text-slate-500 mt-1"><b>Objetivo:</b> {unidad.objetivo}</p>}
          {unidad.contenido && <p className="text-xs text-slate-500 mt-1 whitespace-pre-line">{unidad.contenido}</p>}
        </>
      )}

      {expandida && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <RecursosLista planeacionId={unidad.id} />
          <ClasesLista unidadId={unidad.id} />
          <TareasLista planeacionId={unidad.id} />
        </div>
      )}
    </div>
  );
}

function NuevaUnidadForm({ materiaId, gradoId, periodo, orden, onCancelar, onCreada }) {
  const [titulo, setTitulo] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!titulo.trim()) { alert("Escribe un título para la unidad/tema."); return; }
    setGuardando(true);
    try {
      await api.crearPlaneacion({ tipo: "unidad", materia_id: materiaId, grado_id: gradoId, periodo, titulo: titulo.trim(), objetivo: objetivo.trim() || null, orden });
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
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : "Crear unidad"}
        </button>
      </div>
    </div>
  );
}

export function VistaPlaneaciones({ grados }) {
  const [materias, setMaterias] = useState([]);
  const [materiaId, setMateriaId] = useState("");
  const [gradoId, setGradoId] = useState("");
  const [periodo, setPeriodo] = useState("1");
  const [unidades, setUnidades] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);

  useEffect(() => {
    api.fetchMaterias().then((data) => { setMaterias(data); if (data[0]) setMateriaId(data[0].id); });
  }, []);
  useEffect(() => { if (grados.length && !gradoId) setGradoId(grados[0].id); }, [grados]);

  const cargar = () => {
    if (!materiaId || !gradoId) return;
    setCargando(true);
    api.fetchUnidades(materiaId, gradoId, periodo).then((data) => { setUnidades(data); setCargando(false); });
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
          {["1", "2", "3", "4"].map((p) => <option key={p} value={p}>Periodo {p}</option>)}
        </select>
        <button onClick={() => setFormAbierto((v) => !v)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white ml-auto">
          {formAbierto ? "Cerrar" : "+ Nueva unidad/tema"}
        </button>
      </div>

      <p className="text-[11px] text-slate-400 mb-3">
        Plan de estudios de la materia, organizado por unidades/temas dentro de cada periodo. Cada unidad puede tener varias clases, tareas con rúbrica, y recursos de Google Drive/Docs/Forms.
      </p>

      {formAbierto && (
        <NuevaUnidadForm materiaId={materiaId} gradoId={gradoId} periodo={periodo} orden={unidades.length}
          onCancelar={() => setFormAbierto(false)} onCreada={() => { setFormAbierto(false); cargar(); }} />
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : unidades.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">
          Todavía no hay unidades/temas para este periodo. Creá la primera con "+ Nueva unidad/tema".
        </div>
      ) : (
        unidades.map((u) => <UnidadCard key={u.id} unidad={u} onCambio={cargar} />)
      )}
    </div>
  );
}
