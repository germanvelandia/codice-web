import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { agruparPorNivel, nivelYCurso } from "../lib/gamification";
import { periodosDe } from "../lib/calificaciones";
import { EditorTexto, TextoEnriquecido } from "../components/RichText";

const TIPOS_PREGUNTA = [
  { key: "opcion_multiple", label: "Opción múltiple" },
  { key: "verdadero_falso", label: "Verdadero / Falso" },
  { key: "respuesta_corta", label: "Respuesta corta (manual)" },
];

function NuevaPreguntaForm({ evaluacionId, orden, pregunta, materiaId, gradoId, onCreada, onCancelar }) {
  const [tipo, setTipo] = useState(pregunta?.tipo || "opcion_multiple");
  const [enunciado, setEnunciado] = useState(pregunta?.enunciado || "");
  const [puntos, setPuntos] = useState(pregunta?.puntos || 1);
  const [opciones, setOpciones] = useState(pregunta?.tipo === "opcion_multiple" ? (pregunta.opciones || []).map((o) => o.texto) : ["", ""]);
  const [correcta, setCorrecta] = useState(pregunta?.tipo === "opcion_multiple" ? Math.max(0, (pregunta.opciones || []).findIndex((o) => o.correcta)) : 0);
  const [vfCorrecta, setVfCorrecta] = useState(
    pregunta?.tipo === "verdadero_falso" ? ((pregunta.opciones || []).find((o) => o.correcta)?.texto || "Verdadero") : "Verdadero"
  );
  const [guardarEnBanco, setGuardarEnBanco] = useState(false);
  const [temaBanco, setTemaBanco] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!enunciado.trim()) { alert("Escribe el enunciado de la pregunta."); return; }
    let opcionesFinal = [];
    if (tipo === "opcion_multiple") {
      const limpias = opciones.map((o) => o.trim()).filter(Boolean);
      if (limpias.length < 2) { alert("Agrega al menos 2 opciones."); return; }
      opcionesFinal = limpias.map((texto, i) => ({ texto, correcta: i === correcta }));
    } else if (tipo === "verdadero_falso") {
      opcionesFinal = [
        { texto: "Verdadero", correcta: vfCorrecta === "Verdadero" },
        { texto: "Falso", correcta: vfCorrecta === "Falso" },
      ];
    }
    setGuardando(true);
    try {
      const campos = { tipo, enunciado: enunciado.trim(), puntos: parseFloat(puntos) || 1, opciones: opcionesFinal };
      if (pregunta) {
        await api.editarPregunta(pregunta.id, campos);
      } else {
        const { nivel } = nivelYCurso(gradoId || "");
        await api.crearPreguntaConBanco({ evaluacion_id: evaluacionId, orden, ...campos }, guardarEnBanco, materiaId, temaBanco, nivel);
      }
      onCreada();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-xl p-3 mb-2">
      <div className="flex gap-1 mb-2">
        {TIPOS_PREGUNTA.map((t) => (
          <button key={t.key} onClick={() => setTipo(t.key)} className={`text-xs px-2.5 py-1 rounded-full ${tipo === t.key ? "bg-violet-500 text-white" : "bg-white text-slate-600"}`}>{t.label}</button>
        ))}
      </div>
      <div className="flex gap-2 mb-2">
        <input value={enunciado} onChange={(e) => setEnunciado(e.target.value)} placeholder="Enunciado de la pregunta"
          className="flex-1 text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        <input type="number" step="0.5" value={puntos} onChange={(e) => setPuntos(e.target.value)} placeholder="Pts" className="w-16 text-sm rounded-lg px-2 py-2 border border-slate-200 outline-none bg-white" />
      </div>

      {tipo === "opcion_multiple" && (
        <div className="space-y-1.5 mb-2">
          {opciones.map((op, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" checked={correcta === i} onChange={() => setCorrecta(i)} title="Marcar como correcta" />
              <input value={op} onChange={(e) => setOpciones((prev) => prev.map((o, idx) => idx === i ? e.target.value : o))}
                placeholder={`Opción ${i + 1}`} className="flex-1 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
              {opciones.length > 2 && (
                <button onClick={() => { setOpciones((prev) => prev.filter((_, idx) => idx !== i)); if (correcta >= opciones.length - 1) setCorrecta(0); }} className="text-slate-300 hover:text-rose-500 text-xs">✕</button>
              )}
            </div>
          ))}
          <button onClick={() => setOpciones((prev) => [...prev, ""])} className="text-[11px] text-violet-500">+ Agregar opción</button>
        </div>
      )}

      {tipo === "verdadero_falso" && (
        <div className="flex gap-3 mb-2">
          <label className="flex items-center gap-1.5 text-xs"><input type="radio" checked={vfCorrecta === "Verdadero"} onChange={() => setVfCorrecta("Verdadero")} /> Verdadero</label>
          <label className="flex items-center gap-1.5 text-xs"><input type="radio" checked={vfCorrecta === "Falso"} onChange={() => setVfCorrecta("Falso")} /> Falso</label>
        </div>
      )}

      {tipo === "respuesta_corta" && (
        <p className="text-[11px] text-slate-500 mb-2">Esta pregunta no se autocalifica — vos revisás y asignás el puntaje manualmente en los resultados.</p>
      )}

      {!pregunta && materiaId && tipo !== "respuesta_corta" && (
        <div className="mb-2">
          <label className="flex items-center gap-2 text-[11px] text-slate-600">
            <input type="checkbox" checked={guardarEnBanco} onChange={(e) => setGuardarEnBanco(e.target.checked)} />
            También guardar esta pregunta en el banco de preguntas (para reusarla en otras evaluaciones)
          </label>
          {guardarEnBanco && (
            <input value={temaBanco} onChange={(e) => setTemaBanco(e.target.value)} placeholder="Tema en el banco (opcional, ej: Álgebra)"
              className="w-full text-xs rounded-lg px-2 py-1.5 mt-1.5 border border-slate-200 outline-none bg-white" />
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        {onCancelar && <button onClick={onCancelar} className="text-xs text-slate-500 px-2 py-1.5">Cancelar</button>}
        <button disabled={guardando} onClick={guardar} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : pregunta ? "Guardar cambios" : "Agregar pregunta"}
        </button>
      </div>
    </div>
  );
}

function PreguntasEditor({ evaluacionId, materiaId, gradoId }) {
  const [preguntas, setPreguntas] = useState([]);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [aleatorioAbierto, setAleatorioAbierto] = useState(false);
  const [temas, setTemas] = useState([]);
  const [temaElegido, setTemaElegido] = useState("");
  const [cantidad, setCantidad] = useState(10);
  const [cargandoAleatorio, setCargandoAleatorio] = useState(false);
  const { nivel } = nivelYCurso(gradoId || "");

  const cargar = () => api.fetchPreguntasDocente(evaluacionId).then(setPreguntas);
  useEffect(() => { cargar(); }, [evaluacionId]);
  useEffect(() => { if (materiaId) api.fetchTemasBanco(materiaId, nivel || null).then(setTemas); }, [materiaId, nivel]);

  const quitar = async (id) => { if (!confirm("¿Eliminar esta pregunta?")) return; await api.eliminarPregunta(id); cargar(); };
  const totalPuntos = preguntas.reduce((a, p) => a + Number(p.puntos), 0);

  const traerAleatorias = async () => {
    setCargandoAleatorio(true);
    try {
      const r = await api.agregarPreguntasAleatoriasDesdeBanco(evaluacionId, materiaId, temaElegido || null, nivel || null, parseInt(cantidad, 10) || 10, preguntas.length);
      if (r.disponibles === 0) alert(`No hay preguntas en el banco para esta materia${nivel ? `, grado ${nivel}°` : ""}${temaElegido ? ` y tema "${temaElegido}"` : ""}.`);
      else alert(`Se agregaron ${r.agregadas} pregunta(s) al azar (de ${r.disponibles} disponibles en el banco).`);
      setAleatorioAbierto(false);
      cargar();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setCargandoAleatorio(false);
  };

  return (
    <div className="mt-2">
      <div className="text-xs font-semibold text-slate-500 mb-2">Preguntas ({preguntas.length}) · {totalPuntos} pts en total</div>
      {preguntas.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {preguntas.map((p, i) => (
            editando?.id === p.id ? (
              <NuevaPreguntaForm key={p.id} evaluacionId={evaluacionId} pregunta={p}
                onCancelar={() => setEditando(null)} onCreada={() => { setEditando(null); cargar(); }} />
            ) : (
              <div key={p.id} className="bg-white border border-slate-100 rounded-lg p-2.5">
                <div className="flex justify-between items-start">
                  <div className="text-xs text-slate-700">
                    <b>{i + 1}.</b> {p.enunciado} <span className="text-slate-400">({p.puntos} pts · {TIPOS_PREGUNTA.find((t) => t.key === p.tipo)?.label})</span>
                  </div>
                  <div className="flex gap-1.5 shrink-0 ml-2">
                    <button onClick={() => setEditando(p)} className="text-slate-300 hover:text-violet-600 text-xs">✏️</button>
                    <button onClick={() => quitar(p.id)} className="text-slate-300 hover:text-rose-500 text-xs">✕</button>
                  </div>
                </div>
                {p.tipo !== "respuesta_corta" && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {(p.opciones || []).map((o, j) => (
                      <span key={j} className={`text-[10px] px-2 py-0.5 rounded-full ${o.correcta ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {o.correcta ? "✓ " : ""}{o.texto}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          ))}
        </div>
      )}

      {aleatorioAbierto && (
        <div className="bg-amber-50 rounded-xl p-3 mb-2">
          <p className="text-[11px] text-amber-700 mb-2">
            Elige N preguntas al azar del banco de esta materia{nivel ? `, solo del grado ${nivel}°` : ""} y las agrega tal cual (podés editarlas después).
          </p>
          <div className="flex gap-2 mb-2">
            <select value={temaElegido} onChange={(e) => setTemaElegido(e.target.value)} className="flex-1 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
              <option value="">Todos los temas de la materia</option>
              {temas.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="w-16 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setAleatorioAbierto(false)} className="text-xs text-slate-500 px-2 py-1">Cancelar</button>
            <button disabled={cargandoAleatorio} onClick={traerAleatorias} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 text-white disabled:opacity-60">
              {cargandoAleatorio ? "Agregando…" : "Agregar al azar"}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        {formAbierto ? null : <button onClick={() => setFormAbierto(true)} className="text-[11px] text-violet-500">+ Agregar pregunta</button>}
        {materiaId && !aleatorioAbierto && <button onClick={() => setAleatorioAbierto(true)} className="text-[11px] text-amber-600">🗂️ N preguntas al azar del banco</button>}
      </div>
      {formAbierto && (
        <div className="mt-2">
          <NuevaPreguntaForm evaluacionId={evaluacionId} orden={preguntas.length} materiaId={materiaId} gradoId={gradoId} onCreada={() => { setFormAbierto(false); cargar(); }} onCancelar={() => setFormAbierto(false)} />
        </div>
      )}
    </div>
  );
}

function ResultadosEvaluacion({ evaluacion, onCerrar }) {
  const [intentos, setIntentos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [intentoAbierto, setIntentoAbierto] = useState(null);
  const [respuestas, setRespuestas] = useState([]);

  const cargar = () => {
    setCargando(true);
    api.fetchIntentosDeEvaluacion(evaluacion.id).then((data) => { setIntentos(data); setCargando(false); });
  };
  useEffect(() => { cargar(); }, [evaluacion.id]);

  const abrirIntento = async (intento) => {
    setIntentoAbierto(intento);
    const r = await api.fetchRespuestasDeIntento(intento.id);
    setRespuestas(r);
  };

  const calificarCorta = async (respuestaId, puntosMax) => {
    const valor = prompt(`¿Cuántos puntos (de máximo ${puntosMax})?`);
    if (valor === null) return;
    const puntos = Math.min(parseFloat(valor) || 0, puntosMax);
    await api.calificarRespuesta(respuestaId, puntos, puntos > 0);
    await api.recalcularPuntajeIntento(intentoAbierto.id);
    const r = await api.fetchRespuestasDeIntento(intentoAbierto.id);
    setRespuestas(r);
    cargar();
  };

  const publicar = async (intentoId) => {
    const intento = intentos.find((i) => i.id === intentoId);
    await api.publicarResultado(intentoId, true, evaluacion, intento);
    cargar();
  };
  const publicarTodos = async () => {
    if (!confirm("¿Publicar el resultado de todos los estudiantes que ya están calificados?")) return;
    await api.publicarTodosLosResultados(evaluacion.id, evaluacion);
    cargar();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onCerrar}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">Resultados — {evaluacion.titulo}</h3>
          <button onClick={onCerrar} className="text-slate-400">✕</button>
        </div>

        {!intentoAbierto ? (
          <>
            <div className="flex justify-end mb-2">
              <button onClick={publicarTodos} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">📤 Publicar todos los calificados</button>
            </div>
            {cargando ? (
              <div className="text-sm text-slate-400">Cargando…</div>
            ) : intentos.length === 0 ? (
              <div className="text-sm text-slate-400">Todavía nadie ha presentado esta evaluación.</div>
            ) : (
              <div className="space-y-1.5">
                {intentos.map((i) => (
                  <div key={i.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                    <button onClick={() => abrirIntento(i)} className="text-xs text-left hover:text-violet-600">
                      <span className="font-semibold">{i.estudiante_nombre}</span>
                      <span className="text-slate-400"> · Intento {i.numero_intento} · {i.estado}{i.puntaje_obtenido !== null ? ` · ${i.puntaje_obtenido}/${i.puntaje_maximo} pts` : ""}</span>
                    </button>
                    {i.estado !== "en_progreso" && (
                      i.visible_para_estudiante ? (
                        <span className="text-[10px] text-emerald-600">✔ Publicado</span>
                      ) : (
                        <button onClick={() => publicar(i.id)} className="text-[11px] text-violet-500">Publicar</button>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div>
            <button onClick={() => setIntentoAbierto(null)} className="text-xs text-violet-500 mb-2">← Volver a la lista</button>
            <div className="text-sm font-semibold text-slate-800 mb-2">{intentoAbierto.estudiante_nombre} — {intentoAbierto.puntaje_obtenido ?? "—"}/{intentoAbierto.puntaje_maximo ?? "—"} pts</div>
            <div className="space-y-2">
              {respuestas.map((r) => (
                <div key={r.id} className="border border-slate-100 rounded-lg p-2.5">
                  <div className="text-xs font-semibold text-slate-700">{r.evaluacion_preguntas?.enunciado}</div>
                  <div className="text-xs text-slate-600 mt-1">Respondió: <b>{r.respuesta || "(sin responder)"}</b></div>
                  {r.evaluacion_preguntas?.tipo === "respuesta_corta" ? (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-slate-400">{r.puntos_obtenidos !== null ? `Calificado: ${r.puntos_obtenidos} pts` : "Sin calificar"}</span>
                      <button onClick={() => calificarCorta(r.id, r.evaluacion_preguntas.puntos)} className="text-[11px] text-violet-500">Calificar</button>
                    </div>
                  ) : (
                    <span className={`text-[11px] ${r.correcta ? "text-emerald-600" : "text-rose-500"}`}>{r.correcta ? "✔ Correcta" : "✕ Incorrecta"} ({r.puntos_obtenidos} pts)</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NuevaEvaluacionForm({ materiaId, gradoId, periodo, categorias, evaluacion, onCancelar, onCreada }) {
  const [titulo, setTitulo] = useState(evaluacion?.titulo || "");
  const [descripcion, setDescripcion] = useState(evaluacion?.descripcion || "");
  const [indicaciones, setIndicaciones] = useState(evaluacion?.indicaciones?.length ? evaluacion.indicaciones : [""]);
  const [fechaApertura, setFechaApertura] = useState(evaluacion?.fecha_apertura || "");
  const [fechaCierre, setFechaCierre] = useState(evaluacion?.fecha_cierre || "");
  const [intentos, setIntentos] = useState(evaluacion?.intentos_permitidos ? String(evaluacion.intentos_permitidos) : evaluacion ? "ilimitado" : "1");
  const [tiempoLimite, setTiempoLimite] = useState(evaluacion?.tiempo_limite_minutos ? String(evaluacion.tiempo_limite_minutos) : "");
  const [categoriaId, setCategoriaId] = useState(evaluacion?.categoria_id ? String(evaluacion.categoria_id) : "");
  const [aleatoriasActivo, setAleatoriasActivo] = useState(!!evaluacion?.preguntas_aleatorias_cantidad);
  const [aleatoriasCantidad, setAleatoriasCantidad] = useState(evaluacion?.preguntas_aleatorias_cantidad || 10);
  const [guardando, setGuardando] = useState(false);

  const cambiarIndicacion = (i, valor) => setIndicaciones((prev) => prev.map((x, idx) => idx === i ? valor : x));
  const agregarIndicacion = () => setIndicaciones((prev) => [...prev, ""]);
  const quitarIndicacion = (i) => setIndicaciones((prev) => prev.filter((_, idx) => idx !== i));

  const guardar = async () => {
    if (!titulo.trim()) { alert("Escribe un título."); return; }
    setGuardando(true);
    try {
      const campos = {
        titulo: titulo.trim(), descripcion: descripcion.trim() || null,
        indicaciones: indicaciones.map((i) => i.trim()).filter(Boolean),
        fecha_apertura: fechaApertura || null, fecha_cierre: fechaCierre || null,
        intentos_permitidos: intentos === "ilimitado" ? null : parseInt(intentos, 10),
        tiempo_limite_minutos: tiempoLimite ? parseInt(tiempoLimite, 10) : null,
        categoria_id: categoriaId ? parseInt(categoriaId, 10) : null,
        preguntas_aleatorias_cantidad: aleatoriasActivo ? (parseInt(aleatoriasCantidad, 10) || null) : null,
      };
      if (evaluacion) {
        await api.editarEvaluacion(evaluacion.id, campos);
        onCreada(null);
      } else {
        const nueva = await api.crearEvaluacion({ materia_id: materiaId, grado_id: gradoId, periodo, ...campos });
        onCreada(nueva);
      }
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-2xl p-4 mb-3">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título de la evaluación"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <label className="text-xs text-slate-500 block mb-1">Propósito / introducción (opcional)</label>
      <div className="mb-2">
        <EditorTexto value={descripcion} onChange={setDescripcion} minHeight={100} placeholder="Ej: Esta prueba busca identificar tus conocimientos previos sobre…" />
      </div>

      <label className="text-xs text-slate-500 block mb-1">Indicaciones (una por línea — se muestran como lista al estudiante)</label>
      <div className="space-y-1.5 mb-2">
        {indicaciones.map((ind, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 shrink-0">•</span>
            <input value={ind} onChange={(e) => cambiarIndicacion(i, e.target.value)} placeholder="Ej: Selecciona una sola respuesta por pregunta"
              className="flex-1 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
            {indicaciones.length > 1 && <button onClick={() => quitarIndicacion(i)} className="text-slate-300 hover:text-rose-500 text-xs shrink-0">✕</button>}
          </div>
        ))}
        <button onClick={agregarIndicacion} className="text-[11px] text-violet-500">+ Agregar indicación</button>
      </div>

      <label className="text-xs text-slate-500 block mb-1">Categoría en Calificaciones (opcional — si la elegís, la nota se manda sola a la Planilla al publicar)</label>
      <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white">
        <option value="">— No enviar a Calificaciones —</option>
        {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Abre</label>
          <input type="date" value={fechaApertura} onChange={(e) => setFechaApertura(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Cierra</label>
          <input type="date" value={fechaCierre} onChange={(e) => setFechaCierre(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Intentos permitidos</label>
          <select value={intentos} onChange={(e) => setIntentos(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white">
            <option value="1">1 (único intento)</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="ilimitado">Ilimitados</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Tiempo límite (min, opcional)</label>
          <input type="number" value={tiempoLimite} onChange={(e) => setTiempoLimite(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-600 mb-2 bg-amber-50 rounded-lg p-2.5">
        <input type="checkbox" checked={aleatoriasActivo} onChange={(e) => setAleatoriasActivo(e.target.checked)} />
        Preguntas aleatorias por estudiante (cada uno recibe un subconjunto al azar, en vez de todos las mismas)
      </label>
      {aleatoriasActivo && (
        <div className="mb-2">
          <label className="text-xs text-slate-500 block mb-1">¿Cuántas preguntas debe responder cada estudiante?</label>
          <input type="number" min="1" value={aleatoriasCantidad} onChange={(e) => setAleatoriasCantidad(e.target.value)}
            className="w-24 text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
          <p className="text-[11px] text-slate-400 mt-1">Cargá más preguntas de las que necesita cada uno (ej: 20 preguntas totales para que cada estudiante responda 10 al azar).</p>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : evaluacion ? "Guardar cambios" : "Crear evaluación"}
        </button>
      </div>
    </div>
  );
}

function CopiarEvaluacionModal({ evaluacion, materias, grados, onClose, onCopiada }) {
  const [materiaDestinoId, setMateriaDestinoId] = useState(evaluacion.materia_id);
  const [gradoDestinoId, setGradoDestinoId] = useState("");
  const [periodoDestino, setPeriodoDestino] = useState("");
  const [config, setConfig] = useState({ cantidad_periodos: 4, sistema_periodos: "bimestre" });
  const [copiando, setCopiando] = useState(false);

  const niveles = agruparPorNivel(grados);
  const { nivel: nivelActual } = nivelYCurso(gradoDestinoId || grados[0]?.id || "");
  const cursosDelNivel = niveles.find((n) => n.nivel === nivelActual)?.cursos || [];

  useEffect(() => { if (grados.length && !gradoDestinoId) setGradoDestinoId(grados[0].id); }, [grados]);
  useEffect(() => { if (materiaDestinoId) api.fetchNotasConfig(materiaDestinoId).then(setConfig); }, [materiaDestinoId]);
  const listaPeriodos = periodosDe(config);
  useEffect(() => { if (!listaPeriodos.includes(periodoDestino)) setPeriodoDestino(listaPeriodos[0] || "1"); }, [materiaDestinoId, config]);

  const copiar = async () => {
    setCopiando(true);
    try {
      await api.copiarEvaluacion(evaluacion.id, materiaDestinoId, gradoDestinoId, periodoDestino);
      alert(`"${evaluacion.titulo}" se copió como borrador — recordá revisar las fechas y publicarla cuando esté lista.`);
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
          <h3 className="font-bold text-slate-800">📋 Copiar evaluación</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Copia "{evaluacion.titulo}" con todas sus preguntas a otro curso — siempre como borrador, sin fechas, para que la revises antes de publicar.
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

        <label className="text-xs text-slate-500 block mb-1">Periodo destino</label>
        <select value={periodoDestino} onChange={(e) => setPeriodoDestino(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-4 border border-slate-200 outline-none">
          {listaPeriodos.map((p) => <option key={p} value={p}>Periodo {p}</option>)}
        </select>

        <button disabled={copiando} onClick={copiar} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {copiando ? "Copiando…" : "Copiar evaluación"}
        </button>
      </div>
    </div>
  );
}

function EvaluacionCard({ evaluacion, materias, grados, categorias, onCambio }) {
  const [expandida, setExpandida] = useState(false);
  const [resultadosAbiertos, setResultadosAbiertos] = useState(false);
  const [copiando, setCopiando] = useState(false);
  const [editando, setEditando] = useState(false);

  const publicar = async () => {
    await api.editarEvaluacion(evaluacion.id, { estado: "publicada" });
    onCambio();
  };
  const despublicar = async () => {
    await api.editarEvaluacion(evaluacion.id, { estado: "borrador" });
    onCambio();
  };
  const eliminar = async () => {
    if (!confirm(`¿Eliminar "${evaluacion.titulo}" y todos los intentos/respuestas asociados? No se puede deshacer.`)) return;
    await api.eliminarEvaluacion(evaluacion.id);
    onCambio();
  };

  if (editando) {
    return (
      <NuevaEvaluacionForm evaluacion={evaluacion} categorias={categorias}
        onCancelar={() => setEditando(false)} onCreada={() => { setEditando(false); onCambio(); }} />
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-3">
      <div className="flex justify-between items-start gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-slate-800">{evaluacion.titulo}</h4>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${evaluacion.estado === "publicada" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {evaluacion.estado === "publicada" ? "Publicada" : "Borrador"}
            </span>
          </div>
          {evaluacion.descripcion && <TextoEnriquecido html={evaluacion.descripcion} className="text-xs text-slate-500 mt-1" />}
          <p className="text-[11px] text-slate-400 mt-1">
            {evaluacion.fecha_apertura || evaluacion.fecha_cierre ? `${evaluacion.fecha_apertura || "…"} → ${evaluacion.fecha_cierre || "…"} · ` : ""}
            {evaluacion.intentos_permitidos ? `${evaluacion.intentos_permitidos} intento(s)` : "Intentos ilimitados"}
            {evaluacion.tiempo_limite_minutos ? ` · ${evaluacion.tiempo_limite_minutos} min` : ""}
            {evaluacion.preguntas_aleatorias_cantidad ? ` · 🎲 ${evaluacion.preguntas_aleatorias_cantidad} al azar por estudiante` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {evaluacion.estado === "borrador" ? (
            <button onClick={publicar} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-500 text-white">Publicar</button>
          ) : (
            <button onClick={despublicar} className="text-[11px] px-2.5 py-1 rounded-full border border-slate-200 text-slate-500">Volver a borrador</button>
          )}
          <button onClick={() => setEditando(true)} className="text-xs text-slate-400 hover:text-violet-600" title="Editar">✏️</button>
          <button onClick={() => setResultadosAbiertos(true)} className="text-xs text-slate-400 hover:text-violet-600">📊</button>
          <button onClick={() => setCopiando(true)} className="text-xs text-slate-400 hover:text-violet-600" title="Copiar a otro curso">📋</button>
          <button onClick={eliminar} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
          <button onClick={() => setExpandida((v) => !v)} className="text-xs text-violet-500">{expandida ? "▲" : "▼"}</button>
        </div>
      </div>

      {expandida && <PreguntasEditor evaluacionId={evaluacion.id} materiaId={evaluacion.materia_id} gradoId={evaluacion.grado_id} />}
      {resultadosAbiertos && <ResultadosEvaluacion evaluacion={evaluacion} onCerrar={() => setResultadosAbiertos(false)} />}
      {copiando && <CopiarEvaluacionModal evaluacion={evaluacion} materias={materias} grados={grados} onClose={() => setCopiando(false)} onCopiada={onCambio} />}
    </div>
  );
}

export function VistaEvaluaciones({ grados }) {
  const [materias, setMaterias] = useState([]);
  const [materiaId, setMateriaId] = useState("");
  const [gradoId, setGradoId] = useState("");
  const [periodo, setPeriodo] = useState("1");
  const [config, setConfig] = useState({ cantidad_periodos: 4, sistema_periodos: "bimestre" });
  const [categorias, setCategorias] = useState([]);
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [formAbierto, setFormAbierto] = useState(false);

  useEffect(() => {
    api.fetchMaterias().then((data) => { setMaterias(data); if (data[0]) setMateriaId(data[0].id); });
  }, []);
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
    setError(null);
    api.fetchEvaluaciones(materiaId, gradoId, periodo)
      .then((data) => { setEvaluaciones(data); setCargando(false); })
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
          {listaPeriodos.map((p) => <option key={p} value={p}>Periodo {p}</option>)}
        </select>
        <button onClick={() => setFormAbierto((v) => !v)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white ml-auto">
          {formAbierto ? "Cerrar" : "+ Nueva evaluación"}
        </button>
      </div>

      <p className="text-[11px] text-slate-400 mb-3">
        El estudiante nunca ve su nota apenas termina — queda "entregado, pendiente de revisión" hasta que vos la publiques desde 📊 Resultados.
      </p>

      {formAbierto && (
        <NuevaEvaluacionForm materiaId={materiaId} gradoId={gradoId} periodo={periodo} categorias={categorias}
          onCancelar={() => setFormAbierto(false)} onCreada={() => { setFormAbierto(false); cargar(); }} />
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : error ? (
        <div className="text-sm text-rose-500 bg-rose-50 rounded-xl p-3">Error al cargar: {error}</div>
      ) : evaluaciones.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">
          Todavía no hay evaluaciones para este periodo. Creá la primera con "+ Nueva evaluación".
        </div>
      ) : (
        evaluaciones.map((e) => <EvaluacionCard key={e.id} evaluacion={e} materias={materias} grados={grados} categorias={categorias} onCambio={cargar} />)
      )}
    </div>
  );
}
