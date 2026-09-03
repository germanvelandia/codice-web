import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { agruparPorNivel, nivelYCurso } from "../lib/gamification";
import { periodosDe } from "../lib/calificaciones";
import { EditorTexto, TextoEnriquecido } from "../components/RichText";

function TareaForm({ tipo, materiaId, gradoId, periodo, categorias, tarea, onCancelar, onCreada }) {
  const [titulo, setTitulo] = useState(tarea?.titulo || "");
  const [descripcion, setDescripcion] = useState(tarea?.descripcion || "");
  const [url, setUrl] = useState(tarea?.url || "");
  const [fechaEntrega, setFechaEntrega] = useState(tarea?.fecha_entrega || "");
  const [categoriaId, setCategoriaId] = useState(tarea?.categoria_id || categorias[0]?.id || "");
  const [recompensaMonedas, setRecompensaMonedas] = useState(tarea?.recompensa_monedas ?? 0);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!titulo.trim()) { alert("Escribe un título."); return; }
    if (!categoriaId) { alert("Elegí a qué categoría de la Planilla va a mandar la nota."); return; }
    let urlLimpia = url.trim();
    if (urlLimpia && !/^https?:\/\//i.test(urlLimpia)) urlLimpia = "https://" + urlLimpia;
    setGuardando(true);
    try {
      const campos = { titulo: titulo.trim(), descripcion: descripcion.trim() || null, url: urlLimpia || null, fecha_entrega: fechaEntrega || null, categoria_id: categoriaId, recompensa_monedas: parseInt(recompensaMonedas, 10) || 0 };
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
      <label className="text-xs text-slate-500 block mb-1">Instrucciones para el estudiante (opcional)</label>
      <div className="mb-2">
        <EditorTexto value={descripcion} onChange={setDescripcion} minHeight={110} placeholder="Instrucciones para el estudiante…" />
      </div>
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
      <label className="text-xs text-slate-500 block mb-1">🪙 Recompensa en monedas al entregar (opcional)</label>
      <input type="number" min="0" value={recompensaMonedas} onChange={(e) => setRecompensaMonedas(e.target.value)}
        className="w-32 text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none bg-white" />
      <p className="text-[11px] text-slate-400 -mt-2 mb-3">No se entrega sola — vas a poder aplicarla (o no) para cada estudiante al momento de calificar.</p>
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : tarea ? "Guardar cambios" : "Crear"}
        </button>
      </div>
    </div>
  );
}

// Calcula la nota a partir de los puntos de la rúbrica, respetando la
// escala REAL configurada en la Planilla de esa materia (antes estaba fija
// a un máximo de 5, sin importar la configuración).
function calcularNotaRubrica(rubrica, nivelesElegidos, config) {
  const escalaMin = config?.escala_min ?? 1;
  const escalaMax = config?.nota_maxima ?? 5;
  let obtenidos = 0, maximos = 0;
  rubrica.forEach((c, i) => {
    const maxCriterio = Math.max(...c.niveles.map((n) => n.puntos));
    maximos += maxCriterio;
    const elegido = nivelesElegidos[i];
    if (elegido !== undefined) obtenidos += c.niveles[elegido].puntos;
  });
  const nota = maximos > 0 ? Math.round((escalaMin + (obtenidos / maximos) * (escalaMax - escalaMin)) * 10) / 10 : escalaMin;
  return { obtenidos, maximos, nota, escalaMin, escalaMax };
}

// Selector de rúbrica reutilizable — usado tanto para calificar a un
// estudiante individual como a todo un reino de una vez.
function SelectorRubrica({ rubrica, nivelesElegidos, onElegir, config }) {
  const { obtenidos, maximos, nota, escalaMin, escalaMax } = calcularNotaRubrica(rubrica, nivelesElegidos, config);
  return (
    <div className="bg-white rounded-lg p-3 border border-violet-100 space-y-2">
      {rubrica.map((c, i) => (
        <div key={i}>
          <div className="text-[11px] font-semibold text-slate-600 mb-1">{c.criterio}</div>
          <div className="flex flex-wrap gap-1.5">
            {c.niveles.map((n, j) => (
              <button key={j} onClick={() => onElegir(i, j)}
                className={`text-[11px] px-2 py-1 rounded-full border ${nivelesElegidos[i] === j ? "bg-violet-500 text-white border-violet-500" : "bg-white text-slate-600 border-slate-200"}`}>
                {n.nombre} ({n.puntos})
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="text-xs text-slate-500 pt-1 border-t border-slate-100">
        {obtenidos}/{maximos} pts → nota <b>{nota}</b> <span className="text-slate-400">(escala {escalaMin}–{escalaMax}, la misma de tu Planilla)</span>
      </div>
    </div>
  );
}

function CalificarModal({ tarea, config, onClose, onCambio }) {
  const [modo, setModo] = useState("individual"); // "individual" | "reino"
  const [entregas, setEntregas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [editandoId, setEditandoId] = useState(null);
  const [notaTemp, setNotaTemp] = useState("");
  const [comentarioTemp, setComentarioTemp] = useState("");
  const [dandoMonedas, setDandoMonedas] = useState(null);
  const [codiceAbiertoPara, setCodiceAbiertoPara] = useState(null);
  const [codiceTexto, setCodiceTexto] = useState("");
  const [guardandoCodice, setGuardandoCodice] = useState(false);
  const [rubricando, setRubricando] = useState(null); // estudianteId
  const [nivelesElegidos, setNivelesElegidos] = useState({}); // { criterioIdx: nivelIdx }
  const [notaMasiva, setNotaMasiva] = useState("");
  const [comentarioMasivo, setComentarioMasivo] = useState("");
  const [aplicandoMasivo, setAplicandoMasivo] = useState(false);

  // --- Modo "Por Reino" ---
  const [estudiantesGrado, setEstudiantesGrado] = useState([]);
  const [reinoElegido, setReinoElegido] = useState(null);
  const [notaReino, setNotaReino] = useState("");
  const [comentarioReino, setComentarioReino] = useState("");
  const [nivelesReino, setNivelesReino] = useState({});
  const [aplicandoReino, setAplicandoReino] = useState(false);

  const cargar = () => { setCargando(true); api.fetchEntregasDeTarea(tarea.id).then((d) => { setEntregas(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, [tarea.id]);
  useEffect(() => {
    if (modo === "reino" && tarea.grado_id) api.fetchEstudiantesPorGrado(tarea.grado_id).then(setEstudiantesGrado);
  }, [modo, tarea.grado_id]);

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

  // Agrupa las entregas ya calificadas por su nota, para poder dejar el
  // mismo comentario a todos los que sacaron lo mismo, de una sola vez.
  const gruposPorNota = {};
  entregas.forEach((e) => {
    if (e.nota === null || e.nota === undefined) return;
    const clave = String(e.nota);
    (gruposPorNota[clave] = gruposPorNota[clave] || []).push(e);
  });
  const notasDisponibles = Object.keys(gruposPorNota).sort((a, b) => parseFloat(b) - parseFloat(a));

  const aplicarComentarioMasivo = async () => {
    if (!notaMasiva) { alert("Elegí a qué grupo de nota aplicarlo."); return; }
    if (!comentarioMasivo.trim()) { alert("Escribí el comentario a aplicar."); return; }
    setAplicandoMasivo(true);
    try {
      const grupo = gruposPorNota[notaMasiva] || [];
      for (const e of grupo) {
        await api.calificarTarea(tarea, e.estudiante_id, e.nota, comentarioMasivo.trim());
      }
      setComentarioMasivo("");
      cargar();
      onCambio();
    } catch (e) {
      alert("Error al aplicar el comentario: " + e.message);
    }
    setAplicandoMasivo(false);
  };

  const abrirRubrica = (estudianteId, resultadoPrevio) => {
    setRubricando(estudianteId);
    setNivelesElegidos(resultadoPrevio || {});
  };

  const guardarConRubrica = async (estudianteId) => {
    const { nota } = calcularNotaRubrica(tarea.rubrica, nivelesElegidos, config);
    try {
      await api.calificarTarea(tarea, estudianteId, nota, "", nivelesElegidos);
      setRubricando(null);
      cargar();
      onCambio();
    } catch (e) {
      alert("Error al calificar: " + e.message);
    }
  };

  const darMonedas = async (estudianteId) => {
    setDandoMonedas(estudianteId);
    try {
      const r = await api.darMonedasPorTarea(tarea.id, estudianteId, tarea.recompensa_monedas);
      if (r.yaEntregadas) alert("A este estudiante ya se le habían dado las monedas de esta tarea.");
      cargar();
    } catch (e) {
      alert("Error al dar las monedas: " + e.message);
    }
    setDandoMonedas(null);
  };

  const dejarEnCodice = async (estudianteId) => {
    if (!codiceTexto.trim()) { alert("Escribí algo para dejar en el Códice."); return; }
    setGuardandoCodice(true);
    try {
      await api.crearEntradaCodiceDocente(estudianteId, {
        titulo: tarea.titulo, contenido: codiceTexto.trim(), materia_id: tarea.materia_id, tarea_id: tarea.id,
      });
      setCodiceAbiertoPara(null);
      setCodiceTexto("");
      alert("Quedó agregado al Códice del estudiante.");
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardandoCodice(false);
  };

  // --- Lógica del modo "Por Reino" ---
  const reinosAgrupados = {};
  estudiantesGrado.forEach((e) => {
    const r = e.reino_actual || e.reino_original || "Sin grupo";
    (reinosAgrupados[r] = reinosAgrupados[r] || []).push(e);
  });

  const elegirReino = (reino) => {
    setReinoElegido(reino);
    setNotaReino(""); setComentarioReino(""); setNivelesReino({});
  };

  const aplicarAlReino = async () => {
    const estudiantesDelReino = reinosAgrupados[reinoElegido] || [];
    if (estudiantesDelReino.length === 0) return;
    let nota;
    if (tarea.rubrica?.length > 0) {
      nota = calcularNotaRubrica(tarea.rubrica, nivelesReino, config).nota;
    } else {
      nota = parseFloat(notaReino.replace(",", "."));
      if (isNaN(nota)) { alert("Escribe una nota válida."); return; }
    }
    if (!confirm(`¿Aplicar la nota ${nota} a los ${estudiantesDelReino.length} estudiantes de "${reinoElegido}"? Esto sobrescribe la nota que ya tuvieran en esta tarea.`)) return;
    setAplicandoReino(true);
    try {
      for (const est of estudiantesDelReino) {
        await api.calificarTarea(tarea, est.id, nota, comentarioReino, tarea.rubrica?.length > 0 ? nivelesReino : undefined);
      }
      setReinoElegido(null);
      cargar();
      onCambio();
    } catch (e) {
      alert("Error al calificar por reino: " + e.message);
    }
    setAplicandoReino(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">Calificar — {tarea.titulo}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">Al guardar una nota, se manda automáticamente a la columna "{tarea.titulo}" en la Planilla de Calificaciones.</p>

        <div className="flex gap-1 rounded-full bg-slate-100 p-1 mb-3 w-fit">
          <button onClick={() => setModo("individual")} className={`text-xs px-3 py-1.5 rounded-full ${modo === "individual" ? "bg-violet-500 text-white" : "text-slate-600"}`}>👤 Individual</button>
          <button onClick={() => setModo("reino")} className={`text-xs px-3 py-1.5 rounded-full ${modo === "reino" ? "bg-violet-500 text-white" : "text-slate-600"}`}>👥 Por Reino</button>
        </div>

        {modo === "reino" ? (
          <div>
            <p className="text-xs text-slate-500 mb-2">Elegí un reino para calificar a todos sus estudiantes con la misma nota de una sola vez.</p>
            {estudiantesGrado.length === 0 ? (
              <div className="text-sm text-slate-400">Cargando estudiantes…</div>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {Object.entries(reinosAgrupados).map(([reino, ests]) => (
                    <button key={reino} onClick={() => elegirReino(reino)}
                      className={`text-xs px-3 py-1.5 rounded-full border ${reinoElegido === reino ? "bg-violet-500 text-white border-violet-500" : "bg-white text-slate-600 border-slate-200"}`}>
                      {reino} ({ests.length})
                    </button>
                  ))}
                </div>
                {reinoElegido && (
                  <div className="bg-violet-50 rounded-xl p-3">
                    <p className="text-xs font-semibold text-violet-700 mb-2">Calificando a los {reinosAgrupados[reinoElegido].length} estudiantes de "{reinoElegido}"</p>
                    {tarea.rubrica?.length > 0 ? (
                      <div className="mb-2">
                        <SelectorRubrica rubrica={tarea.rubrica} nivelesElegidos={nivelesReino} config={config}
                          onElegir={(i, j) => setNivelesReino((prev) => ({ ...prev, [i]: j }))} />
                      </div>
                    ) : (
                      <div className="flex gap-1.5 mb-2">
                        <input type="text" inputMode="decimal" value={notaReino} onChange={(e) => setNotaReino(e.target.value)} placeholder="Nota"
                          className="w-20 text-sm text-center rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
                        <input type="text" value={comentarioReino} onChange={(e) => setComentarioReino(e.target.value)} placeholder="Comentario (opcional, para todos)"
                          className="flex-1 text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
                      </div>
                    )}
                    {tarea.rubrica?.length > 0 && (
                      <input type="text" value={comentarioReino} onChange={(e) => setComentarioReino(e.target.value)} placeholder="Comentario (opcional, para todos)"
                        className="w-full text-sm rounded-lg px-2 py-1.5 mb-2 border border-slate-200 outline-none bg-white" />
                    )}
                    <button disabled={aplicandoReino} onClick={aplicarAlReino} className="w-full text-sm font-semibold py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
                      {aplicandoReino ? "Aplicando…" : `Aplicar a los ${reinosAgrupados[reinoElegido].length} estudiantes`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            {notasDisponibles.length > 0 && (
              <div className="bg-violet-50 rounded-xl p-3 mb-3">
                <div className="text-[11px] font-semibold text-violet-700 mb-1.5">📝 Comentario masivo por nota</div>
                <div className="flex gap-1.5 mb-2">
                  <select value={notaMasiva} onChange={(e) => setNotaMasiva(e.target.value)} className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
                    <option value="">Elegí un grupo…</option>
                    {notasDisponibles.map((n) => <option key={n} value={n}>Nota {n} ({gruposPorNota[n].length} estudiante{gruposPorNota[n].length !== 1 ? "s" : ""})</option>)}
                  </select>
                </div>
                <div className="flex gap-1.5">
                  <input value={comentarioMasivo} onChange={(e) => setComentarioMasivo(e.target.value)} placeholder="Comentario a aplicar a todo el grupo…"
                    className="flex-1 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
                  <button disabled={aplicandoMasivo} onClick={aplicarComentarioMasivo} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
                    {aplicandoMasivo ? "Aplicando…" : "Aplicar"}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Esto reemplaza el comentario de cada estudiante del grupo elegido — la nota no cambia.</p>
              </div>
            )}

            {cargando ? (
              <div className="text-sm text-slate-400">Cargando…</div>
            ) : (
              <div className="space-y-1.5">
                {entregas.map((e) => (
                  <div key={e.estudiante_id} className="bg-slate-50 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                      <span className="text-xs font-semibold text-slate-700">{e.estudiante_nombre}</span>
                      <div className="flex items-center gap-1.5">
                        {tarea.rubrica?.length > 0 && (
                          <button onClick={() => abrirRubrica(e.estudiante_id, e.rubrica_resultado)} className="text-[11px] px-2 py-1 rounded-full border border-violet-200 text-violet-600">📊 Con rúbrica</button>
                        )}
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
                        {tarea.recompensa_monedas > 0 && e.nota !== null && (
                          e.monedas_entregadas ? (
                            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">🪙 Entregadas</span>
                          ) : (
                            <button disabled={dandoMonedas === e.estudiante_id} onClick={() => darMonedas(e.estudiante_id)}
                              className="text-[10px] font-semibold text-white bg-amber-500 px-2 py-1 rounded-full disabled:opacity-50">
                              {dandoMonedas === e.estudiante_id ? "…" : `🪙 Dar ${tarea.recompensa_monedas}`}
                            </button>
                          )
                        )}
                        <button onClick={() => { setCodiceAbiertoPara(codiceAbiertoPara === e.estudiante_id ? null : e.estudiante_id); setCodiceTexto(""); }}
                          className="text-[10px] font-semibold text-violet-600 bg-violet-100 px-2 py-1 rounded-full">
                          📖 Códice
                        </button>
                      </div>
                    </div>
                    {codiceAbiertoPara === e.estudiante_id && (
                      <div className="mt-2 bg-white rounded-lg p-2 border border-violet-100">
                        <div className="mb-1.5">
                          <EditorTexto value={codiceTexto} onChange={setCodiceTexto} minHeight={60}
                            placeholder={`Escribí algo sobre "${tarea.titulo}" para dejar en su Códice…`} />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setCodiceAbiertoPara(null)} className="text-[11px] text-slate-400">Cancelar</button>
                          <button disabled={guardandoCodice} onClick={() => dejarEnCodice(e.estudiante_id)} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-violet-500 text-white disabled:opacity-60">
                            {guardandoCodice ? "Guardando…" : "Agregar al Códice"}
                          </button>
                        </div>
                      </div>
                    )}
                    {rubricando === e.estudiante_id && (
                      <div className="mt-2">
                        <SelectorRubrica rubrica={tarea.rubrica} nivelesElegidos={nivelesElegidos} config={config}
                          onElegir={(i, j) => setNivelesElegidos((prev) => ({ ...prev, [i]: j }))} />
                        <div className="flex justify-end gap-2 mt-2">
                          <button onClick={() => setRubricando(null)} className="text-[11px] text-slate-400">Cancelar</button>
                          <button onClick={() => guardarConRubrica(e.estudiante_id)} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-violet-500 text-white">Guardar nota</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {entregas.length === 0 && <p className="text-xs text-slate-400">Todavía nadie tiene registro. Se irán agregando cuando califiques a cada estudiante.</p>}
              </div>
            )}
          </>
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

function RubricaTareaModal({ tarea, config, onClose, onGuardada }) {
  const NIVELES_INICIALES = () => [{ nombre: "Alto", puntos: 5 }, { nombre: "Medio", puntos: 3 }, { nombre: "Bajo", puntos: 1 }];
  const [criterios, setCriterios] = useState(
    tarea.rubrica?.length ? tarea.rubrica : [{ criterio: "", niveles: NIVELES_INICIALES() }]
  );
  const [guardando, setGuardando] = useState(false);

  const actualizarCriterio = (i, texto) => setCriterios((prev) => prev.map((c, idx) => idx === i ? { ...c, criterio: texto } : c));
  const actualizarNivel = (i, j, campo, valor) => setCriterios((prev) => prev.map((c, idx) => idx === i
    ? { ...c, niveles: c.niveles.map((n, k) => k === j ? { ...n, [campo]: campo === "puntos" ? parseFloat(valor) || 0 : valor } : n) }
    : c));
  const agregarCriterio = () => setCriterios((prev) => [...prev, { criterio: "", niveles: NIVELES_INICIALES() }]);
  const quitarCriterio = (i) => setCriterios((prev) => prev.filter((_, idx) => idx !== i));

  // Niveles ahora totalmente ajustables — antes quedaban fijos en 3 por criterio.
  const agregarNivel = (i) => setCriterios((prev) => prev.map((c, idx) => idx === i ? { ...c, niveles: [...c.niveles, { nombre: "Nuevo nivel", puntos: 0 }] } : c));
  const quitarNivel = (i, j) => setCriterios((prev) => prev.map((c, idx) => {
    if (idx !== i) return c;
    if (c.niveles.length <= 1) { alert("Cada criterio necesita al menos un nivel."); return c; }
    return { ...c, niveles: c.niveles.filter((_, k) => k !== j) };
  }));

  const guardar = async () => {
    const limpios = criterios.filter((c) => c.criterio.trim());
    if (limpios.some((c) => c.niveles.length === 0)) { alert("Cada criterio necesita al menos un nivel."); return; }
    setGuardando(true);
    try {
      await api.guardarRubricaTareaCalificable(tarea.id, limpios);
      onGuardada();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  const quitarRubrica = async () => {
    if (!confirm("¿Quitar la rúbrica de esta tarea? Vas a volver a calificar con nota manual.")) return;
    setGuardando(true);
    try {
      await api.guardarRubricaTareaCalificable(tarea.id, null);
      onGuardada();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setGuardando(false);
  };

  const escalaMin = config?.escala_min ?? 1;
  const escalaMax = config?.nota_maxima ?? 5;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">📊 Rúbrica — {tarea.titulo}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-1">
          Definí los criterios y sus niveles con puntos — podés agregar o quitar tanto criterios como niveles, no hay un número fijo.
        </p>
        <p className="text-xs text-slate-500 mb-3">
          Al calificar, elegís el nivel de cada criterio y la nota se calcula sola, ajustada a la escala real de tu Planilla ({escalaMin}–{escalaMax}).
        </p>

        <div className="space-y-3 mb-4">
          {criterios.map((c, i) => (
            <div key={i} className="border border-slate-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <input value={c.criterio} onChange={(e) => actualizarCriterio(i, e.target.value)} placeholder="Criterio a evaluar (ej: Ortografía)"
                  className="flex-1 text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
                <button onClick={() => quitarCriterio(i)} className="text-slate-300 hover:text-rose-500">🗑</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {c.niveles.map((n, j) => (
                  <div key={j} className="bg-slate-50 rounded-lg p-2 relative" style={{ width: 110 }}>
                    <button onClick={() => quitarNivel(i, j)} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-400 text-white text-[9px] flex items-center justify-center" title="Quitar este nivel">✕</button>
                    <input value={n.nombre} onChange={(e) => actualizarNivel(i, j, "nombre", e.target.value)}
                      className="w-full text-xs font-semibold rounded px-1 py-1 border border-slate-200 outline-none mb-1" />
                    <input type="number" value={n.puntos} onChange={(e) => actualizarNivel(i, j, "puntos", e.target.value)}
                      className="w-full text-xs rounded px-1 py-1 border border-slate-200 outline-none" placeholder="Puntos" />
                  </div>
                ))}
                <button onClick={() => agregarNivel(i)} className="text-xs text-violet-500 border border-dashed border-violet-300 rounded-lg px-3" style={{ width: 110 }}>
                  + Nivel
                </button>
              </div>
            </div>
          ))}
          <button onClick={agregarCriterio} className="text-xs text-violet-500">+ Agregar criterio</button>
        </div>

        <div className="flex gap-2">
          {tarea.rubrica?.length > 0 && (
            <button disabled={guardando} onClick={quitarRubrica} className="text-xs font-semibold px-3 py-2.5 rounded-lg border border-rose-200 text-rose-500">Quitar rúbrica</button>
          )}
          <button disabled={guardando} onClick={guardar} className="flex-1 text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
            {guardando ? "Guardando…" : "Guardar rúbrica"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TareaCard({ tarea, categorias, materias, grados, config, onCambio }) {
  const [calificando, setCalificando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [copiando, setCopiando] = useState(false);
  const [rubricaAbierta, setRubricaAbierta] = useState(false);
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
          {tarea.descripcion && <TextoEnriquecido html={tarea.descripcion} className="text-xs text-slate-500 mt-1" />}
          {tarea.fecha_entrega && <p className="text-[11px] text-slate-400 mt-1">Entrega: {tarea.fecha_entrega}</p>}
          {tarea.url && <a href={tarea.url} target="_blank" rel="noreferrer" className="text-[11px] text-violet-500 mt-1 block truncate">🔗 {tarea.url}</a>}
          {tarea.recompensa_monedas > 0 && <span className="inline-block text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full mt-1">🪙 {tarea.recompensa_monedas} al entregar</span>}
          {tarea.rubrica?.length > 0 && <span className="inline-block text-[10px] font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full mt-1 ml-1">📊 Con rúbrica</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setCalificando(true)} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-500 text-white">Calificar</button>
          <button onClick={() => setRubricaAbierta(true)} className="text-xs text-slate-400 hover:text-violet-600" title="Rúbrica de evaluación">📊</button>
          <button onClick={() => setEditando(true)} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
          <button onClick={() => setCopiando(true)} className="text-xs text-slate-400 hover:text-violet-600" title="Copiar a otro curso">📋</button>
          <button onClick={eliminar} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
        </div>
      </div>
      {calificando && <CalificarModal tarea={tarea} config={config} onClose={() => setCalificando(false)} onCambio={onCambio} />}
      {copiando && <CopiarTareaModal tarea={tarea} materias={materias} grados={grados} onClose={() => setCopiando(false)} onCopiada={onCambio} />}
      {rubricaAbierta && <RubricaTareaModal tarea={tarea} config={config} onClose={() => setRubricaAbierta(false)} onGuardada={() => { setRubricaAbierta(false); onCambio(); }} />}
    </div>
  );
}

export function VistaProyectosForja({ grados, gradoActivo, periodoActivo, materiaActiva }) {
  const [tipo, setTipo] = useState("proyecto");
  const [materias, setMaterias] = useState([]);
  const [materiaId, setMateriaId] = useState(materiaActiva || "");
  const [gradoId, setGradoId] = useState(gradoActivo || "");
  const [periodo, setPeriodo] = useState("1");
  const [config, setConfig] = useState({ cantidad_periodos: 4 });
  const [categorias, setCategorias] = useState([]);
  const [tareas, setTareas] = useState([]);

  useEffect(() => { if (gradoActivo) setGradoId(gradoActivo); }, [gradoActivo]);
  useEffect(() => { if (materiaActiva) setMateriaId(materiaActiva); }, [materiaActiva]);
  useEffect(() => { if (periodoActivo) setPeriodo(periodoActivo); }, [periodoActivo]);
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
        tareas.map((t) => <TareaCard key={t.id} tarea={t} categorias={categorias} materias={materias} grados={grados} config={config} onCambio={cargar} />)
      )}
    </div>
  );
}
