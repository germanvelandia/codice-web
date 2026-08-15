import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { agruparPorNivel, nivelYCurso } from "../lib/gamification";
import { periodosDe } from "../lib/calificaciones";

function TareaForm({ tipo, materiaId, gradoId, periodo, categorias, tarea, onCancelar, onCreada }) {
  const [titulo, setTitulo] = useState(tarea?.titulo || "");
  const [descripcion, setDescripcion] = useState(tarea?.descripcion || "");
  const [url, setUrl] = useState(tarea?.url || "");
  const [fechaEntrega, setFechaEntrega] = useState(tarea?.fecha_entrega || "");
  const [categoriaId, setCategoriaId] = useState(tarea?.categoria_id || categorias[0]?.id || "");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!titulo.trim()) { alert("Escribe un título."); return; }
    if (!categoriaId) { alert("Elegí a qué categoría de la Planilla va a mandar la nota."); return; }
    let urlLimpia = url.trim();
    if (urlLimpia && !/^https?:\/\//i.test(urlLimpia)) urlLimpia = "https://" + urlLimpia;
    setGuardando(true);
    try {
      const campos = { titulo: titulo.trim(), descripcion: descripcion.trim() || null, url: urlLimpia || null, fecha_entrega: fechaEntrega || null, categoria_id: categoriaId };
      if (tarea) {
        await api.editarTareaCalificable(tarea.id, campos);
      } else {
        await api.crearTareaCalificable({ tipo, materia_id: materiaId, grado_id: gradoId, periodo, ...campos });
      }
      onCreada();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-2xl p-4 mb-3">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={tipo === "proyecto" ? "Título del proyecto" : "Título del taller/entregable"}
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} placeholder="Instrucciones para el estudiante (opcional)"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <label className="text-xs text-slate-500 block mb-1">Enlace para el estudiante (opcional — formulario, material, actividad externa…)</label>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Ej: docs.google.com/forms/..."
        className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none bg-white" />
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Fecha de entrega</label>
          <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Categoría en Calificaciones</label>
          <select value={categoriaId} onChange={(e) => setCategoriaId(parseInt(e.target.value, 10))} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white">
            {categorias.length === 0 && <option value="">Sin categorías creadas</option>}
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : tarea ? "Guardar cambios" : "Crear"}
        </button>
      </div>
    </div>
  );
}

function CalificarModal({ tarea, onClose, onCambio }) {
  const [entregas, setEntregas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [editandoId, setEditandoId] = useState(null);
  const [notaTemp, setNotaTemp] = useState("");
  const [comentarioTemp, setComentarioTemp] = useState("");

  const cargar = () => { setCargando(true); api.fetchEntregasDeTarea(tarea.id).then((d) => { setEntregas(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, [tarea.id]);

  const guardarNota = async (estudianteId) => {
    const valor = parseFloat(notaTemp.replace(",", "."));
    if (isNaN(valor)) { alert("Escribe una nota válida."); return; }
    try {
      await api.calificarTarea(tarea, estudianteId, valor, comentarioTemp);
      setEditandoId(null);
      cargar();
      onCambio();
    } catch (e) {
      alert("Error al calificar: " + e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">Calificar — {tarea.titulo}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">Al guardar una nota, se manda automáticamente a la columna "{tarea.titulo}" en la Planilla de Calificaciones.</p>
        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : (
          <div className="space-y-1.5">
            {entregas.map((e) => (
              <div key={e.estudiante_id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-xs font-semibold text-slate-700">{e.estudiante_nombre}</span>
                {editandoId === e.estudiante_id ? (
                  <div className="flex items-center gap-1.5">
                    <input type="text" inputMode="decimal" value={notaTemp} onChange={(ev) => setNotaTemp(ev.target.value)} placeholder="Nota"
                      className="w-16 text-xs text-center rounded px-2 py-1 border border-slate-200 outline-none" />
                    <input type="text" value={comentarioTemp} onChange={(ev) => setComentarioTemp(ev.target.value)} placeholder="Comentario (opcional)"
                      className="w-32 text-xs rounded px-2 py-1 border border-slate-200 outline-none" />
                    <button onClick={() => guardarNota(e.estudiante_id)} className="text-xs px-2 py-1 rounded bg-violet-500 text-white">✔</button>
                    <button onClick={() => setEditandoId(null)} className="text-xs text-slate-400">✕</button>
                  </div>
                ) : (
                  <button onClick={() => { setEditandoId(e.estudiante_id); setNotaTemp(e.nota ?? ""); setComentarioTemp(e.comentario || ""); }}
                    className="text-xs px-2 py-1 rounded-full" style={{ background: e.nota !== null ? "#DCFCE7" : "#F1F5F9", color: e.nota !== null ? "#15803D" : "#64748B" }}>
                    {e.nota !== null ? `Nota: ${e.nota}` : "Sin calificar"}
                  </button>
                )}
              </div>
            ))}
            {entregas.length === 0 && <p className="text-xs text-slate-400">Todavía nadie tiene registro. Se irán agregando cuando califiques a cada estudiante.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function CopiarTareaModal({ tarea, materias, grados, onClose, onCopiada }) {
  const [materiaDestinoId, setMateriaDestinoId] = useState(tarea.materia_id);
  const [gradoDestinoId, setGradoDestinoId] = useState("");
  const [periodoDestino, setPeriodoDestino] = useState("");
  const [categoriaDestinoId, setCategoriaDestinoId] = useState("");
  const [categoriasDestino, setCategoriasDestino] = useState([]);
  const [config, setConfig] = useState({ cantidad_periodos: 4, sistema_periodos: "bimestre" });
  const [copiando, setCopiando] = useState(false);

  const niveles = agruparPorNivel(grados);
  const { nivel: nivelActual } = nivelYCurso(gradoDestinoId || grados[0]?.id || "");
  const cursosDelNivel = niveles.find((n) => n.nivel === nivelActual)?.cursos || [];

  useEffect(() => { if (grados.length && !gradoDestinoId) setGradoDestinoId(grados[0].id); }, [grados]);
  useEffect(() => {
    if (!materiaDestinoId) return;
    api.fetchNotasConfig(materiaDestinoId).then(setConfig);
    api.fetchCategorias(materiaDestinoId).then((cats) => {
      setCategoriasDestino(cats);
      const misma = cats.find((c) => c.id === tarea.categoria_id);
      setCategoriaDestinoId(misma ? misma.id : (cats[0]?.id || ""));
    });
  }, [materiaDestinoId]);
  const listaPeriodos = periodosDe(config);
  useEffect(() => { if (!listaPeriodos.includes(periodoDestino)) setPeriodoDestino(listaPeriodos[0] || "1"); }, [materiaDestinoId, config]);

  const copiar = async () => {
    if (!categoriaDestinoId) { alert("Elegí a qué categoría de Calificaciones va a mandar la nota en el curso destino."); return; }
    setCopiando(true);
    try {
      await api.copiarTareaCalificable(tarea.id, materiaDestinoId, gradoDestinoId, periodoDestino, categoriaDestinoId);
      alert(`"${tarea.titulo}" se copió al curso destino — recordá poner la fecha de entrega si hace falta.`);
      onCopiada();
      onClose();
    } catch (e) {
      alert("Error al copiar: " + e.message);
    }
    setCopiando(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">📋 Copiar {tarea.tipo === "proyecto" ? "proyecto" : "forja"}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Copia "{tarea.titulo}" a otro curso — sin fecha de entrega ni entregas previas, para que la ajustes antes de asignarla.
        </p>

        <label className="text-xs text-slate-500 block mb-1">Materia destino</label>
        <select value={materiaDestinoId} onChange={(e) => setMateriaDestinoId(parseInt(e.target.value, 10))} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none">
          {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Grado</label>
            <select value={nivelActual} onChange={(e) => {
              const n = niveles.find((x) => x.nivel === e.target.value);
              if (n?.cursos[0]) setGradoDestinoId(n.cursos[0].id);
            }} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none">
              {niveles.map((n) => <option key={n.nivel} value={n.nivel}>Grado {n.nivel}°</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Curso</label>
            <select value={gradoDestinoId} onChange={(e) => setGradoDestinoId(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none">
              {cursosDelNivel.map((g) => <option key={g.id} value={g.id}>Curso {g.id}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Periodo</label>
            <select value={periodoDestino} onChange={(e) => setPeriodoDestino(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none">
              {listaPeriodos.map((p) => <option key={p} value={p}>Periodo {p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Categoría</label>
            <select value={categoriaDestinoId} onChange={(e) => setCategoriaDestinoId(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none">
              {categoriasDestino.length === 0 && <option value="">Sin categorías en esta materia</option>}
              {categoriasDestino.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
          <button disabled={copiando} onClick={copiar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
            {copiando ? "Copiando…" : "Copiar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TareaCard({ tarea, categorias, materias, grados, onCambio }) {
  const [calificando, setCalificando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [copiando, setCopiando] = useState(false);
  const eliminar = async () => {
    if (!confirm(`¿Eliminar "${tarea.titulo}"? Esto no borra la nota que ya se envió a Calificaciones.`)) return;
    await api.eliminarTareaCalificable(tarea.id);
    onCambio();
  };

  if (editando) {
    return (
      <TareaForm tipo={tarea.tipo} tarea={tarea} categorias={categorias}
        onCancelar={() => setEditando(false)} onCreada={() => { setEditando(false); onCambio(); }} />
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-3">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-bold text-slate-800">{tarea.titulo}</h4>
          {tarea.descripcion && <p className="text-xs text-slate-500 mt-1">{tarea.descripcion}</p>}
          {tarea.fecha_entrega && <p className="text-[11px] text-slate-400 mt-1">Entrega: {tarea.fecha_entrega}</p>}
          {tarea.url && <a href={tarea.url} target="_blank" rel="noreferrer" className="text-[11px] text-violet-500 mt-1 block truncate">🔗 {tarea.url}</a>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setCalificando(true)} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-500 text-white">Calificar</button>
          <button onClick={() => setEditando(true)} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
          <button onClick={() => setCopiando(true)} className="text-xs text-slate-400 hover:text-violet-600" title="Copiar a otro curso">📋</button>
          <button onClick={eliminar} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
        </div>
      </div>
      {calificando && <CalificarModal tarea={tarea} onClose={() => setCalificando(false)} onCambio={onCambio} />}
      {copiando && <CopiarTareaModal tarea={tarea} materias={materias} grados={grados} onClose={() => setCopiando(false)} onCopiada={onCambio} />}
    </div>
  );
}

export function VistaProyectosForja({ grados }) {
  const [tipo, setTipo] = useState("proyecto");
  const [materias, setMaterias] = useState([]);
  const [materiaId, setMateriaId] = useState("");
  const [gradoId, setGradoId] = useState("");
  const [periodo, setPeriodo] = useState("1");
  const [config, setConfig] = useState({ cantidad_periodos: 4 });
  const [categorias, setCategorias] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);

  useEffect(() => { api.fetchMaterias().then((data) => { setMaterias(data); if (data[0]) setMateriaId(data[0].id); }); }, []);
  useEffect(() => { if (grados.length && !gradoId) setGradoId(grados[0].id); }, [grados]);
  useEffect(() => {
    if (!materiaId) return;
    api.fetchNotasConfig(materiaId).then(setConfig);
    api.fetchCategorias(materiaId).then(setCategorias);
  }, [materiaId]);
  const listaPeriodos = periodosDe(config);
  useEffect(() => { if (!listaPeriodos.includes(periodo)) setPeriodo(listaPeriodos[0] || "1"); }, [materiaId, config]);

  const cargar = () => {
    if (!materiaId || !gradoId) return;
    setCargando(true);
    api.fetchTareasCalificables(materiaId, gradoId, periodo, tipo).then((d) => { setTareas(d); setCargando(false); });
  };
  useEffect(() => { cargar(); }, [materiaId, gradoId, periodo, tipo]);

  const niveles = agruparPorNivel(grados);
  const { nivel: nivelActual } = nivelYCurso(gradoId || (grados[0]?.id || ""));
  const cursosDelNivel = niveles.find((n) => n.nivel === nivelActual)?.cursos || [];

  return (
    <div>
      <div className="flex gap-1 mb-4 rounded-full bg-white p-1 w-fit border border-slate-100 shadow-sm">
        <button onClick={() => setTipo("proyecto")} className={`text-xs px-4 py-2 rounded-full ${tipo === "proyecto" ? "bg-violet-500 text-white" : "text-slate-600"}`}>📜 Proyectos</button>
        <button onClick={() => setTipo("forja")} className={`text-xs px-4 py-2 rounded-full ${tipo === "forja" ? "bg-violet-500 text-white" : "text-slate-600"}`}>🔨 Forja</button>
      </div>

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
          {listaPeriodos.map((p) => <option key={p} value={p}>Periodo {p}</option>)}
        </select>
        <button onClick={() => setFormAbierto((v) => !v)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white ml-auto">
          {formAbierto ? "Cerrar" : `+ Nuevo ${tipo === "proyecto" ? "proyecto" : "taller"}`}
        </button>
      </div>

      <p className="text-[11px] text-slate-400 mb-3">Cuando califiques una entrega, la nota se envía sola a la Planilla de Calificaciones (columna con el mismo nombre, en la categoría que elijas).</p>

      {formAbierto && (
        <TareaForm tipo={tipo} materiaId={materiaId} gradoId={gradoId} periodo={periodo} categorias={categorias}
          onCancelar={() => setFormAbierto(false)} onCreada={() => { setFormAbierto(false); cargar(); }} />
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : tareas.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">
          Todavía no hay {tipo === "proyecto" ? "proyectos" : "talleres"} para este periodo.
        </div>
      ) : (
        tareas.map((t) => <TareaCard key={t.id} tarea={t} categorias={categorias} materias={materias} grados={grados} onCambio={cargar} />)
      )}
    </div>
  );
}
