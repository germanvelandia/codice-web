import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import * as api from "./lib/api";
import { nextLevel } from "./lib/gamification";
import { bandaDesempeno, notaFinalPonderada } from "./lib/calificaciones";
import { VistaGrados, VistaReinos, VistaEstudiantes } from "./screens/Estudiantes";
import { VistaAsistencia } from "./screens/Asistencia";
import { VistaRuleta, VistaRuletaMonedas, VistaTemporizador, VistaHerramientas } from "./screens/Herramientas";
import { VistaBanco } from "./screens/Banco";
import { VistaRoles } from "./screens/Roles";
import { VistaCalificaciones } from "./screens/Calificaciones";
import { VistaReportes } from "./screens/Reportes";
import { VistaHorario } from "./screens/Horario";
import { VistaPlaneaciones } from "./screens/Planeaciones";
import { VistaEvaluaciones } from "./screens/Evaluaciones";
import { VistaProyectosForja } from "./screens/TareasCalificables";
import { VistaInicio } from "./screens/Inicio";
import { InstitucionModal } from "./screens/Institucion";
import { AdministracionModal } from "./screens/Administracion";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Link dedicado para estudiantes: tu-sitio.vercel.app/#estudiante
  // No muestra ninguna opción de docente, ni espera sesión de Supabase.
  const soloEstudiante = typeof window !== "undefined" && window.location.hash === "#estudiante";

  useEffect(() => {
    if (soloEstudiante) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (soloEstudiante) {
    return (
      <Centered>
        <div className="w-full max-w-sm md:max-w-3xl">
          <h1 className="text-2xl font-bold text-violet-600 text-center mb-1">CÓDICE</h1>
          <PortalEstudiante />
        </div>
      </Centered>
    );
  }

  if (loading) return <Centered>Cargando…</Centered>;
  return session ? <Panel session={session} /> : <AccessGate />;
}

function Centered({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-violet-50 text-slate-700">
      {children}
    </div>
  );
}

function AccessGate() {
  return (
    <Centered>
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-violet-600 text-center mb-1">CÓDICE</h1>
        <LoginScreen />
      </div>
    </Centered>
  );
}

function TomarEvaluacion({ evaluacion, estudianteId, onCerrar }) {
  const [intentoId, setIntentoId] = useState(null);
  const [preguntas, setPreguntas] = useState([]);
  const [respuestas, setRespuestas] = useState({});
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [errorInicio, setErrorInicio] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const id = await api.iniciarIntento(evaluacion.id, estudianteId);
        setIntentoId(id);
        const p = await api.obtenerPreguntasParaEstudiante(evaluacion.id);
        setPreguntas(p);
      } catch (e) {
        setErrorInicio(e.message);
      }
      setCargando(false);
    })();
  }, []);

  const responder = (preguntaId, valor) => setRespuestas((prev) => ({ ...prev, [preguntaId]: valor }));

  const enviar = async () => {
    if (!confirm("¿Entregar la evaluación? No vas a poder cambiar tus respuestas después.")) return;
    setEnviando(true);
    try {
      const payload = preguntas.map((p) => ({ pregunta_id: p.id, respuesta: respuestas[p.id] || "" }));
      await api.entregarIntento(intentoId, payload);
      setEnviado(true);
    } catch (e) {
      alert("Error al entregar: " + e.message);
    }
    setEnviando(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : errorInicio ? (
          <>
            <p className="text-sm text-rose-500 mb-3">{errorInicio}</p>
            <button onClick={onCerrar} className="text-sm px-4 py-2 rounded-lg bg-violet-500 text-white">Cerrar</button>
          </>
        ) : enviado ? (
          <div className="text-center py-6">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-sm text-slate-700 mb-1">¡Entregado!</p>
            <p className="text-xs text-slate-400 mb-4">Tu docente va a revisar y publicar tu nota pronto.</p>
            <button onClick={onCerrar} className="text-sm px-4 py-2 rounded-lg bg-violet-500 text-white">Cerrar</button>
          </div>
        ) : (
          <>
            <h3 className="font-bold text-slate-800 mb-1">{evaluacion.titulo}</h3>
            {evaluacion.descripcion && <p className="text-xs text-slate-500 mb-3">{evaluacion.descripcion}</p>}
            <div className="space-y-3 mb-4">
              {preguntas.map((p, i) => (
                <div key={p.id} className="border border-slate-100 rounded-xl p-3">
                  <div className="text-sm font-medium text-slate-800 mb-2">{i + 1}. {p.enunciado}</div>
                  {p.tipo === "respuesta_corta" ? (
                    <textarea value={respuestas[p.id] || ""} onChange={(e) => responder(p.id, e.target.value)} rows={2}
                      className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
                  ) : (
                    <div className="space-y-1.5">
                      {(p.opciones || []).map((o, j) => (
                        <label key={j} className="flex items-center gap-2 text-sm">
                          <input type="radio" name={`p-${p.id}`} checked={respuestas[p.id] === o.texto} onChange={() => responder(p.id, o.texto)} />
                          {o.texto}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button disabled={enviando} onClick={enviar} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
              {enviando ? "Entregando…" : "Entregar evaluación"}
            </button>
            <button onClick={onCerrar} className="w-full text-xs text-slate-400 mt-2">Cancelar (no se guarda nada)</button>
          </>
        )}
      </div>
    </div>
  );
}

function TarjetaEvaluacionEstudiante({ evaluacion, estudianteId }) {
  const [intentos, setIntentos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [tomando, setTomando] = useState(false);

  const cargar = () => api.fetchMisIntentos(evaluacion.id, estudianteId).then((d) => { setIntentos(d); setCargando(false); });
  useEffect(() => { cargar(); }, [evaluacion.id]);

  if (cargando) return null;
  const usados = intentos.length;
  const maxIntentos = evaluacion.intentos_permitidos;
  const puedeIntentar = maxIntentos === null || usados < maxIntentos;
  const publicado = intentos.filter((i) => i.visible_para_estudiante).sort((a, b) => b.numero_intento - a.numero_intento)[0];
  const hayPendiente = intentos.some((i) => i.estado !== "en_progreso" && !i.visible_para_estudiante);

  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <div className="text-sm font-semibold text-slate-800">{evaluacion.titulo}</div>
      {evaluacion.descripcion && <div className="text-xs text-slate-500 mt-0.5">{evaluacion.descripcion}</div>}
      <div className="text-[11px] text-slate-400 mt-1">
        {maxIntentos ? `${usados}/${maxIntentos} intentos usados` : `${usados} intento(s) usados`}
        {evaluacion.tiempo_limite_minutos ? ` · ${evaluacion.tiempo_limite_minutos} min` : ""}
      </div>
      {publicado && <div className="text-xs font-semibold text-emerald-600 mt-1">Nota: {publicado.puntaje_obtenido}/{publicado.puntaje_maximo}</div>}
      {!publicado && hayPendiente && <div className="text-xs text-amber-600 mt-1">Entregado — pendiente de revisión del docente</div>}
      {puedeIntentar && (
        <button onClick={() => setTomando(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white mt-2">
          {usados > 0 ? "Presentar de nuevo" : "Presentar"}
        </button>
      )}
      {tomando && <TomarEvaluacion evaluacion={evaluacion} estudianteId={estudianteId} onCerrar={() => { setTomando(false); cargar(); }} />}
    </div>
  );
}

// Resume, por materia, los periodos con nota (final o en curso calculada en vivo) —
// misma lógica que usa "Mis notas", reutilizada acá para el aviso general.
function resumenPorMateria(datos) {
  const materias = {};
  datos.finales.forEach((f) => {
    const nombre = f.materias?.nombre || `Materia ${f.materia_id}`;
    materias[nombre] = materias[nombre] || { finales: {}, actividadesPorPeriodo: {} };
    materias[nombre].finales[f.periodo] = f.nota;
  });
  datos.valores.forEach((v) => {
    const act = v.notas_actividades;
    if (!act) return;
    const nombre = act.materias?.nombre || `Materia ${act.materia_id}`;
    materias[nombre] = materias[nombre] || { finales: {}, actividadesPorPeriodo: {} };
    materias[nombre].actividadesPorPeriodo[act.periodo] = materias[nombre].actividadesPorPeriodo[act.periodo] || [];
    materias[nombre].actividadesPorPeriodo[act.periodo].push(v);
  });

  const resultado = {};
  Object.entries(materias).forEach(([nombre, m]) => {
    const periodos = [...new Set([...Object.keys(m.finales), ...Object.keys(m.actividadesPorPeriodo)])].sort();
    resultado[nombre] = periodos.map((periodo) => {
      const actividadesPeriodo = m.actividadesPorPeriodo[periodo] || [];
      if (Object.prototype.hasOwnProperty.call(m.finales, periodo)) {
        return { periodo, nota: m.finales[periodo], enCurso: false };
      }
      const porCategoria = {};
      const categoriasVistas = {};
      actividadesPeriodo.forEach((a) => {
        const cat = a.notas_actividades?.notas_categorias;
        const catId = a.notas_actividades?.categoria_id;
        if (!catId) return;
        categoriasVistas[catId] = { id: catId, porcentaje: cat?.porcentaje || 0 };
        porCategoria[catId] = porCategoria[catId] || [];
        porCategoria[catId].push(a.valor);
      });
      return { periodo, nota: notaFinalPonderada(porCategoria, Object.values(categoriasVistas)), enCurso: true };
    });
  });
  return resultado;
}

function AvisoRendimiento({ estudianteId }) {
  const [resumen, setResumen] = useState(null);

  useEffect(() => {
    api.fetchNotasEstudiante(estudianteId).then((d) => setResumen(resumenPorMateria(d))).catch(() => setResumen({}));
  }, [estudianteId]);

  if (!resumen) return null;
  const config = { escala_min: 1, nota_minima: 3.5, nota_maxima: 5 };

  const estados = Object.entries(resumen)
    .map(([nombre, filas]) => {
      const ultima = filas[filas.length - 1];
      return { nombre, nota: ultima?.nota ?? null };
    })
    .filter((e) => e.nota !== null);

  if (estados.length === 0) return null;

  const enRiesgo = estados.filter((e) => bandaDesempeno(e.nota, config).key === "bajo");

  if (enRiesgo.length > 0) {
    return (
      <div className="rounded-xl p-3 mb-4 bg-rose-50 border border-rose-200">
        <div className="text-sm font-bold text-rose-700">⚠️ Rendimiento académico en riesgo</div>
        <div className="text-xs text-rose-600 mt-1">Estás perdiendo: {enRiesgo.map((e) => e.nombre).join(", ")}. Hablá con tu docente para ponerte al día.</div>
      </div>
    );
  }

  const promedio = estados.reduce((a, e) => a + e.nota, 0) / estados.length;
  const bandaGeneral = bandaDesempeno(promedio, config);
  const mensajes = {
    basico: "Vas cumpliendo lo mínimo. ¡Con un poco más de esfuerzo podés subir de nivel!",
    alto: "Buen desempeño general. ¡Seguí así!",
    superior: "¡Excelente desempeño! Tu esfuerzo se nota.",
  };
  return (
    <div className="rounded-xl p-3 mb-4" style={{ background: `${bandaGeneral.color}15`, border: `1px solid ${bandaGeneral.color}55` }}>
      <div className="text-sm font-bold" style={{ color: bandaGeneral.color }}>
        {bandaGeneral.key === "superior" ? "🌟" : bandaGeneral.key === "alto" ? "👍" : "💪"} {bandaGeneral.label} desempeño académico
      </div>
      <div className="text-xs mt-1" style={{ color: bandaGeneral.color }}>{mensajes[bandaGeneral.key]}</div>
    </div>
  );
}

function MisNotas({ estudianteId }) {
  const [datos, setDatos] = useState(null);
  const [comentarios, setComentarios] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [materiaAbierta, setMateriaAbierta] = useState(null);

  useEffect(() => {
    Promise.all([api.fetchNotasEstudiante(estudianteId), api.fetchComentariosDesempeno()])
      .then(([d, c]) => { setDatos(d); setComentarios(c); setCargando(false); })
      .catch((e) => { setError(e.message); setCargando(false); });
  }, [estudianteId]);

  if (cargando) return <div className="text-xs text-slate-400 mt-4">Cargando notas…</div>;
  if (error) return <div className="text-xs text-rose-500 bg-rose-50 rounded-lg p-2 mt-4">Error al cargar notas: {error}</div>;
  if (!datos) return null;

  // Junta, por materia, los periodos con nota final guardada (definitiva) y los
  // periodos donde solo hay actividades cargadas todavía (en curso) — para estos
  // últimos se calcula la nota en vivo con la misma fórmula ponderada del docente.
  const materias = {};
  datos.finales.forEach((f) => {
    const nombre = f.materias?.nombre || `Materia ${f.materia_id}`;
    materias[nombre] = materias[nombre] || { finales: {}, actividadesPorPeriodo: {} };
    materias[nombre].finales[f.periodo] = f.nota;
  });
  datos.valores.forEach((v) => {
    const act = v.notas_actividades;
    if (!act) return;
    const nombre = act.materias?.nombre || `Materia ${act.materia_id}`;
    materias[nombre] = materias[nombre] || { finales: {}, actividadesPorPeriodo: {} };
    materias[nombre].actividadesPorPeriodo[act.periodo] = materias[nombre].actividadesPorPeriodo[act.periodo] || [];
    materias[nombre].actividadesPorPeriodo[act.periodo].push(v);
  });

  if (Object.keys(materias).length === 0) {
    return <div className="text-xs text-slate-400 mt-4 pt-4 border-t border-slate-100">Todavía no tenés notas ni actividades cargadas.</div>;
  }
  const config = { escala_min: 1, nota_minima: 3.5, nota_maxima: 5 };

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <div className="text-xs font-semibold text-slate-600 mb-2">📚 Mis notas</div>
      <div className="space-y-2">
        {Object.entries(materias).map(([nombreMateria, m]) => {
          const abierta = materiaAbierta === nombreMateria;
          const periodos = [...new Set([...Object.keys(m.finales), ...Object.keys(m.actividadesPorPeriodo)])].sort();

          const filas = periodos.map((periodo) => {
            const actividadesPeriodo = m.actividadesPorPeriodo[periodo] || [];
            if (Object.prototype.hasOwnProperty.call(m.finales, periodo)) {
              return { periodo, nota: m.finales[periodo], enCurso: false, actividadesPeriodo };
            }
            // Sin nota final guardada todavía: se calcula en vivo con lo que hay cargado
            const porCategoria = {};
            const categoriasVistas = {};
            actividadesPeriodo.forEach((a) => {
              const cat = a.notas_actividades?.notas_categorias;
              const catId = a.notas_actividades?.categoria_id;
              if (!catId) return;
              categoriasVistas[catId] = { id: catId, porcentaje: cat?.porcentaje || 0 };
              porCategoria[catId] = porCategoria[catId] || [];
              porCategoria[catId].push(a.valor);
            });
            const notaViva = notaFinalPonderada(porCategoria, Object.values(categoriasVistas));
            return { periodo, nota: notaViva, enCurso: true, actividadesPeriodo };
          });

          return (
            <div key={nombreMateria} className="bg-slate-50 rounded-xl p-3">
              <button onClick={() => setMateriaAbierta(abierta ? null : nombreMateria)} className="w-full text-left">
                <div className="text-sm font-semibold text-slate-800">{nombreMateria}</div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {filas.map((f) => {
                    const b = bandaDesempeno(f.nota, config);
                    return (
                      <span key={f.periodo} className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1" style={{ background: `${b.color}22`, color: b.color }}>
                        P{f.periodo}: {f.nota ?? "—"}{f.enCurso && " 🕓"}
                      </span>
                    );
                  })}
                </div>
              </button>

              {abierta && (
                <div className="mt-2 pt-2 border-t border-slate-200 space-y-2">
                  {filas.map((f) => {
                    const b = bandaDesempeno(f.nota, config);
                    return (
                      <div key={f.periodo}>
                        <div className="text-xs font-semibold text-slate-600">
                          Periodo {f.periodo} — <span style={{ color: b.color }}>{f.nota ?? "—"} ({b.label})</span>
                          {f.enCurso && <span className="text-amber-600 font-normal"> · En curso (provisional, puede cambiar)</span>}
                        </div>
                        {f.enCurso && f.actividadesPeriodo.length > 0 && (
                          <div className="ml-2 mt-1 space-y-0.5">
                            {f.actividadesPeriodo.map((a) => (
                              <div key={a.id} className="text-[11px] text-slate-500 flex justify-between">
                                <span>{a.notas_actividades?.nombre}{a.notas_actividades?.notas_categorias?.nombre ? ` (${a.notas_actividades.notas_categorias.nombre})` : ""}</span>
                                <span className="font-semibold">{a.valor}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {!f.enCurso && f.nota !== null && comentarios[b.key] && (
                          <div className="text-[11px] text-slate-500 italic mt-1 bg-white rounded-lg p-2">{comentarios[b.key]}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BancoEstudiante({ estudianteId, monedas, onMonedasActualizadas }) {
  const [premiosActivos, setPremiosActivos] = useState([]);
  const [girando, setGirando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  const cargarPremios = () => api.fetchPremiosActivos().then(setPremiosActivos);
  useEffect(() => { cargarPremios(); }, []);

  const costoMinimo = premiosActivos.length > 0 ? Math.min(...premiosActivos.map((p) => p.costo_monedas)) : null;
  const puedeCanjear = costoMinimo !== null && monedas >= costoMinimo;

  const canjear = async () => {
    setGirando(true);
    setResultado(null);
    try {
      const r = await api.canjearAleatorio(estudianteId);
      setTimeout(() => {
        setGirando(false);
        setResultado(r);
        onMonedasActualizadas();
        cargarPremios();
      }, 1500);
    } catch (e) {
      setGirando(false);
      alert("Error al canjear: " + e.message);
    }
  };

  const verHistorial = async () => {
    const c = await api.fetchCanjes();
    setHistorial(c.filter((x) => x.estudiante_id === estudianteId));
    setMostrarHistorial(true);
  };

  if (premiosActivos.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <div className="text-xs font-semibold text-slate-600 mb-2">🏦 Banco de premios</div>
      <p className="text-[11px] text-slate-400 mb-2">Cangeá tus monedas por un premio sorpresa. Cuantas más monedas tengas, a más premios podés aspirar.</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {premiosActivos.map((p) => (
          <span key={p.id} className={`text-[10px] px-2 py-1 rounded-full ${monedas >= p.costo_monedas ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-400"}`}>
            {p.emoji} {p.nombre} · 🪙{p.costo_monedas}
          </span>
        ))}
      </div>

      {girando ? (
        <div className="text-center py-3 text-sm text-violet-500 animate-pulse">🎰 Sorteando tu premio…</div>
      ) : resultado ? (
        resultado.ok ? (
          <div className="text-center bg-emerald-50 rounded-xl p-3 mb-2">
            <div className="text-2xl">{resultado.premio.emoji}</div>
            <div className="text-sm font-bold text-emerald-700">¡Ganaste "{resultado.premio.nombre}"!</div>
            <div className="text-[11px] text-emerald-600">Pedíselo a tu docente. Te quedan {resultado.monedasRestantes} monedas.</div>
          </div>
        ) : (
          <div className="text-center bg-amber-50 rounded-xl p-3 mb-2 text-xs text-amber-700">Todavía no te alcanzan las monedas para ningún premio disponible.</div>
        )
      ) : null}

      <div className="flex gap-2">
        <button disabled={!puedeCanjear || girando} onClick={canjear} className="flex-1 text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-50">
          {puedeCanjear ? "🎰 Canjear por un premio sorpresa" : `Necesitás al menos ${costoMinimo} monedas`}
        </button>
        <button onClick={verHistorial} className="text-xs text-slate-400 px-2">Historial</button>
      </div>

      {mostrarHistorial && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setMostrarHistorial(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-sm max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-bold text-sm text-slate-800">Tus premios ganados</h4>
              <button onClick={() => setMostrarHistorial(false)} className="text-slate-400">✕</button>
            </div>
            {historial.length === 0 ? (
              <p className="text-xs text-slate-400">Todavía no ganaste ningún premio.</p>
            ) : (
              <div className="space-y-1.5">
                {historial.map((c) => (
                  <div key={c.id} className="flex justify-between text-xs bg-slate-50 rounded-lg px-2 py-1.5">
                    <span>{c.premio?.emoji} {c.premio?.nombre || "Premio"}</span>
                    <span className={c.estado === "entregado" ? "text-emerald-600" : "text-amber-600"}>{c.estado === "entregado" ? "✔ Entregado" : "Pendiente"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EvaluacionesEstudiante({ estudianteId, gradoId }) {
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.fetchEvaluacionesDisponibles(gradoId).then((data) => {
      const hoy = new Date().toISOString().slice(0, 10);
      const vigentes = data.filter((e) => (!e.fecha_apertura || e.fecha_apertura <= hoy) && (!e.fecha_cierre || e.fecha_cierre >= hoy));
      setEvaluaciones(vigentes);
      setCargando(false);
    });
  }, [gradoId]);

  if (cargando || evaluaciones.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <div className="text-xs font-semibold text-slate-600 mb-2">📝 Evaluaciones disponibles</div>
      <div className="space-y-2">
        {evaluaciones.map((e) => <TarjetaEvaluacionEstudiante key={e.id} evaluacion={e} estudianteId={estudianteId} />)}
      </div>
    </div>
  );
}

function RankingEstudiante({ estudianteId, gradoId }) {
  const [ranking, setRanking] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => { api.fetchRankingGrado(gradoId).then((r) => { setRanking(r); setCargando(false); }); }, [gradoId]);

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;

  const medalla = (i) => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">🏆 Ranking de tu grado</h3>
      <p className="text-xs text-slate-400 mb-3">Ordenado por experiencia (XP) acumulada.</p>
      <div className="space-y-1.5">
        {ranking.map((r, i) => (
          <div key={r.id} className={`flex items-center justify-between px-3 py-2 rounded-xl ${r.id === estudianteId ? "bg-violet-100 border border-violet-300" : "bg-slate-50"}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm w-6 text-center shrink-0">{medalla(i)}</span>
              <span className={`text-xs truncate ${r.id === estudianteId ? "font-bold text-violet-700" : "text-slate-700"}`}>{r.nombre}{r.id === estudianteId ? " (vos)" : ""}</span>
            </div>
            <span className="text-xs font-semibold text-slate-500 shrink-0">{r.xp} XP</span>
          </div>
        ))}
        {ranking.length === 0 && <p className="text-xs text-slate-400">Todavía no hay datos de XP en tu grado.</p>}
      </div>
    </div>
  );
}

function TareaCalificableEstudiante({ tarea, estudianteId }) {
  const [entrega, setEntrega] = useState(null);
  useEffect(() => { api.fetchMiEntrega(tarea.id, estudianteId).then(setEntrega); }, [tarea.id]);
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <div className="text-sm font-semibold text-slate-800">{tarea.titulo}</div>
      {tarea.materias?.nombre && <div className="text-[11px] text-slate-400">{tarea.materias.nombre}</div>}
      {tarea.descripcion && <div className="text-xs text-slate-500 mt-1">{tarea.descripcion}</div>}
      {tarea.fecha_entrega && <div className="text-[11px] text-slate-400 mt-1">Entrega: {tarea.fecha_entrega}</div>}
      {entrega?.nota !== null && entrega?.nota !== undefined ? (
        <div className="text-xs font-semibold text-emerald-600 mt-1.5">Nota: {entrega.nota}{entrega.comentario ? ` — "${entrega.comentario}"` : ""}</div>
      ) : (
        <div className="text-[11px] text-amber-600 mt-1.5">Pendiente de calificación</div>
      )}
    </div>
  );
}

function ProyectosEstudiante({ estudianteId, gradoId }) {
  const [proyectos, setProyectos] = useState([]);
  const [tareasPlan, setTareasPlan] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([api.fetchTareasCalificablesEstudiante(gradoId, "proyecto"), api.fetchTareasPlaneacionParaGrado(gradoId)])
      .then(([p, t]) => { setProyectos(p); setTareasPlan(t); setCargando(false); });
  }, [gradoId]);

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;
  if (proyectos.length === 0 && tareasPlan.length === 0) return <p className="text-sm text-slate-400">Todavía no tenés proyectos asignados.</p>;

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-3">📜 Proyectos</h3>
      {proyectos.length > 0 && (
        <div className="space-y-2 mb-4">
          {proyectos.map((p) => <TareaCalificableEstudiante key={p.id} tarea={p} estudianteId={estudianteId} />)}
        </div>
      )}
      {tareasPlan.length > 0 && (
        <>
          <div className="text-xs font-semibold text-slate-500 mb-2">Otras tareas de clase</div>
          <div className="space-y-2">
            {tareasPlan.map((t) => (
              <div key={t.id} className="bg-slate-50 rounded-xl p-3">
                <div className="text-sm font-semibold text-slate-800">{t.titulo}</div>
                <div className="text-[11px] text-slate-400">{t.materia_nombre}{t.unidad_titulo ? ` · ${t.unidad_titulo}` : ""}</div>
                {t.fecha_entrega && <div className="text-[11px] text-slate-400 mt-0.5">Entrega: {t.fecha_entrega}</div>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ForjaEstudiante({ estudianteId, gradoId }) {
  const [talleres, setTalleres] = useState([]);
  const [cargando, setCargando] = useState(true);
  useEffect(() => { api.fetchTareasCalificablesEstudiante(gradoId, "forja").then((d) => { setTalleres(d); setCargando(false); }); }, [gradoId]);

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;
  if (talleres.length === 0) return <p className="text-sm text-slate-400">Todavía no tenés talleres o entregables asignados.</p>;

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-3">🔨 Forja</h3>
      <div className="space-y-2">
        {talleres.map((t) => <TareaCalificableEstudiante key={t.id} tarea={t} estudianteId={estudianteId} />)}
      </div>
    </div>
  );
}

function ProximamentePanel({ nombre }) {
  return (
    <div className="text-center py-8">
      <div className="text-4xl mb-2">🔒</div>
      <p className="text-sm font-semibold text-slate-600">{nombre}</p>
      <p className="text-xs text-slate-400 mt-1">Todavía no está disponible — próximamente.</p>
    </div>
  );
}

const MENU_CODICE = [
  { key: "inicio", label: "Inicio", icono: "🏠" },
  { key: "misiones", label: "Misiones", icono: "⚔️" },
  { key: "proyectos", label: "Proyectos", icono: "📜" },
  { key: "forja", label: "Forja", icono: "🔨" },
  { key: "codice", label: "Códice", icono: "📖" },
  { key: "notas", label: "Notas", icono: "📝" },
  { key: "ranking", label: "Ranking", icono: "🏆" },
  { key: "recompensas", label: "Recompensas", icono: "🎁" },
  { key: "perfil", label: "Perfil", icono: "👤" },
];

function MenuCodice({ activo, onCambiar }) {
  return (
    <div className="rounded-2xl overflow-hidden mb-4" style={{ background: "linear-gradient(180deg, #1e1b30 0%, #14101f 100%)", border: "2px solid #8B5CF6" }}>
      <div className="text-center py-3" style={{ background: "linear-gradient(180deg, #2d2450 0%, #1e1b30 100%)", borderBottom: "2px solid #7c3aed55" }}>
        <div className="text-2xl">🧭</div>
        <div className="text-violet-200 text-xs font-bold tracking-[0.2em] mt-0.5" style={{ fontFamily: "Georgia, serif" }}>CÓDICE</div>
      </div>
      <div>
        {MENU_CODICE.map((m) => (
          <button key={m.key} onClick={() => onCambiar(m.key)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
            style={{
              background: activo === m.key ? "rgba(139,92,246,0.25)" : "transparent",
              borderLeft: activo === m.key ? "3px solid #C4B5FD" : "3px solid transparent",
              borderBottom: "1px solid rgba(139,92,246,0.15)",
            }}>
            <span className="text-lg">{m.icono}</span>
            <span className={`text-xs font-semibold tracking-wide uppercase ${activo === m.key ? "text-violet-100" : "text-violet-300/70"}`}>{m.label}</span>
            {activo === m.key && <span className="ml-auto text-violet-300">›</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function PortalEstudiante() {
  const [codigo, setCodigo] = useState("");
  const [datos, setDatos] = useState(null);
  const [estudianteInfo, setEstudianteInfo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [vista, setVista] = useState("inicio");

  const consultar = async () => {
    if (!codigo.trim()) return;
    setCargando(true);
    setError("");
    try {
      const res = await api.consultarPortalEstudiante(codigo);
      if (!res) { setError("Código no encontrado. Verifica con tu docente."); setDatos(null); }
      else {
        setDatos(res);
        const info = await api.fetchEstudiantePorCodigo(codigo);
        setEstudianteInfo(info);
      }
    } catch (e) {
      setError("Ocurrió un error: " + e.message);
    }
    setCargando(false);
  };

  if (datos) {
    const { level, next, pct } = nextLevel(datos.xp || 0);
    const totalAsis = Number(datos.total_asistencia) || 0;
    const pctAsis = totalAsis > 0 ? Math.round((Number(datos.presentes) / totalAsis) * 100) : null;

    return (
      <div className="md:flex md:gap-5 md:items-start">
        <div className="md:w-60 md:shrink-0">
          <MenuCodice activo={vista} onCambiar={setVista} />
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 md:flex-1">
          {vista === "inicio" && (
            <>
              <div className="text-center mb-4">
                <div className="text-lg font-bold text-slate-800">{datos.nombre}</div>
                <div className="text-xs text-slate-400">Grado {datos.grado_id} · {datos.grupo}</div>
              </div>
              {estudianteInfo && <AvisoRendimiento estudianteId={estudianteInfo.id} />}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span className="font-semibold text-violet-600">{level.name}</span>
                  <span>{datos.xp}{next ? ` / ${next.min} XP` : " XP · nivel máximo"}</span>
                </div>
                <div className="h-2.5 rounded-full bg-violet-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-emerald-50 rounded-xl p-2 text-center">
                  <div className="text-sm font-bold text-emerald-600">{datos.vida}</div>
                  <div className="text-[10px] text-slate-400">Vida</div>
                </div>
                <div className="bg-amber-50 rounded-xl p-2 text-center">
                  <div className="text-sm font-bold text-amber-600">{datos.monedas}</div>
                  <div className="text-[10px] text-slate-400">Monedas</div>
                </div>
                <div className="bg-blue-50 rounded-xl p-2 text-center">
                  <div className="text-sm font-bold text-blue-600">{pctAsis ?? "—"}{pctAsis !== null && "%"}</div>
                  <div className="text-[10px] text-slate-400">Asistencia</div>
                </div>
              </div>
              <div className="text-xs text-slate-500">
                Presentes: {datos.presentes} · Retardos: {datos.retardos} · Faltas injustificadas: {datos.faltas_injustificadas} · Faltas justificadas: {datos.faltas_justificadas}
              </div>
            </>
          )}

          {vista === "misiones" && estudianteInfo && (
            <EvaluacionesEstudiante estudianteId={estudianteInfo.id} gradoId={estudianteInfo.grado_id} />
          )}

          {vista === "proyectos" && estudianteInfo && (
            <ProyectosEstudiante estudianteId={estudianteInfo.id} gradoId={estudianteInfo.grado_id} />
          )}

          {vista === "forja" && estudianteInfo && (
            <ForjaEstudiante estudianteId={estudianteInfo.id} gradoId={estudianteInfo.grado_id} />
          )}

          {(vista === "codice" || vista === "notas") && estudianteInfo && (
            <MisNotas estudianteId={estudianteInfo.id} />
          )}

          {vista === "recompensas" && estudianteInfo && (
            <BancoEstudiante estudianteId={estudianteInfo.id} monedas={datos.monedas} onMonedasActualizadas={() => consultar()} />
          )}

          {vista === "ranking" && estudianteInfo && (
            <RankingEstudiante estudianteId={estudianteInfo.id} gradoId={estudianteInfo.grado_id} />
          )}

          {vista === "perfil" && (
            <div>
              <h3 className="font-bold text-slate-800 mb-3">👤 Mi perfil</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-400">Nombre</span><span className="font-semibold text-slate-700">{datos.nombre}</span></div>
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-400">Grado</span><span className="font-semibold text-slate-700">{datos.grado_id}</span></div>
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-400">Grupo</span><span className="font-semibold text-slate-700">{datos.grupo}</span></div>
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-400">Nivel</span><span className="font-semibold text-violet-600">{level.name}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">XP total</span><span className="font-semibold text-slate-700">{datos.xp}</span></div>
              </div>
            </div>
          )}

          {vista === "mensajes" && (
            <ProximamentePanel nombre="Mensajes" />
          )}

          <button onClick={() => { setDatos(null); setCodigo(""); setEstudianteInfo(null); setVista("inicio"); }} className="w-full text-xs text-violet-500 mt-4">← Consultar otro código</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <p className="text-sm text-slate-500 text-center mb-4">Ingresa el código de acceso que te dio tu docente para ver tu progreso.</p>
      <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Ej: AB3D9K" maxLength={6}
        className="w-full text-center text-lg font-mono font-bold tracking-widest rounded-lg px-3 py-3 mb-3 border border-slate-200 outline-none" />
      {error && <p className="text-xs text-rose-500 mb-2 text-center">{error}</p>}
      <button disabled={cargando} onClick={consultar} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
        {cargando ? "Consultando…" : "Ver mi progreso"}
      </button>
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const entrar = async () => {
    setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setCargando(false);
    if (error) setMensaje(error.message);
  };

  const recuperar = async () => {
    if (!email) { setMensaje("Escribe tu correo arriba primero."); return; }
    setCargando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setCargando(false);
    setMensaje(error ? error.message : "Te enviamos un correo para restablecer tu contraseña.");
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <p className="text-sm text-slate-500 text-center mb-5">Acceso de docentes</p>

      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo" type="email"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" type="password"
        className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />

      {mensaje && <p className="text-xs text-rose-500 mb-2">{mensaje}</p>}

      <button disabled={cargando} onClick={entrar}
        className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
        {cargando ? "Un momento…" : "Entrar"}
      </button>

      <button onClick={recuperar} className="w-full text-xs text-violet-500 mt-3">¿Olvidaste tu contraseña?</button>
      <p className="text-[11px] text-slate-400 text-center mt-4">
        ¿Sos docente nuevo y no tenés cuenta? Pedile a un administrador de la plataforma que te invite.
      </p>
    </div>
  );
}

const MENU_PANEL = [
  { key: "inicio", label: "Inicio", icono: "🏠" },
  { key: "estudiantes", label: "Estudiantes", icono: "🏰" },
  { key: "asistencia", label: "Asistencia", icono: "📋" },
  { key: "calificaciones", label: "Códice", icono: "📖" },
  { key: "evaluaciones", label: "Misiones", icono: "⚔️" },
  { key: "proyectosforja", label: "La Forja", icono: "🔨" },
  { key: "planeaciones", label: "Biblioteca", icono: "📚" },
  { key: "horario", label: "Agenda", icono: "🗓️" },
  { key: "herramientas", label: "Herramientas", icono: "🛠️" },
  { key: "roles", label: "Roles", icono: "🎭" },
  { key: "reportes", label: "Reportes", icono: "📊" },
];

function SidebarPanel({ activo, onCambiar, email, institucion, onAdmin, onInstitucion, onSalir }) {
  return (
    <>
      {/* Escritorio: barra lateral fija */}
      <div className="hidden md:flex md:flex-col md:w-60 md:shrink-0 md:h-screen md:sticky md:top-0"
        style={{ background: "linear-gradient(180deg, #1e1b30 0%, #14101f 100%)", borderRight: "2px solid #8B5CF6" }}>
        <button onClick={() => onCambiar("inicio")} className="text-center py-5" style={{ background: "linear-gradient(180deg, #2d2450 0%, #1e1b30 100%)", borderBottom: "2px solid #7c3aed55" }}>
          {institucion?.imagen_menu_url ? (
            <img src={institucion.logo_url} alt="Logo" className="mx-auto rounded-xl object-cover" style={{ width: 56, height: 56 }} />
          ) : (
            <div className="text-2xl">🧭</div>
          )}
          <div className="text-violet-200 text-sm font-bold tracking-[0.2em] mt-1.5" style={{ fontFamily: "Georgia, serif" }}>CÓDICE</div>
        </button>
        <div className="flex-1 overflow-y-auto py-2">
          {MENU_PANEL.map((m) => (
            <button key={m.key} onClick={() => onCambiar(m.key)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
              style={{
                background: activo === m.key ? "rgba(139,92,246,0.25)" : "transparent",
                borderLeft: activo === m.key ? "3px solid #C4B5FD" : "3px solid transparent",
              }}>
              <span className="text-base">{m.icono}</span>
              <span className={`text-xs font-semibold tracking-wide ${activo === m.key ? "text-violet-100" : "text-violet-300/70"}`}>{m.label}</span>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-violet-900/60 space-y-1.5">
          <button onClick={onAdmin} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-violet-300/80 hover:bg-white/5 text-xs"><span>👤</span> Docentes y mi cuenta</button>
          <button onClick={onInstitucion} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-violet-300/80 hover:bg-white/5 text-xs"><span>⚙️</span> Institución</button>
          <button onClick={onSalir} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-violet-300/80 hover:bg-white/5 text-xs"><span>🚪</span> Cerrar sesión</button>
          <div className="text-[10px] text-violet-400/60 px-2 pt-1 truncate">{email}</div>
        </div>
      </div>

      {/* Móvil: barra superior con scroll horizontal */}
      <div className="md:hidden" style={{ background: "linear-gradient(180deg, #1e1b30 0%, #14101f 100%)" }}>
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => onCambiar("inicio")} className="flex items-center gap-2">
            {institucion?.imagen_menu_url ? (
              <img src={institucion.logo_url} alt="Logo" className="rounded-lg object-cover" style={{ width: 24, height: 24 }} />
            ) : (
              <span className="text-lg">🧭</span>
            )}
            <span className="text-violet-200 text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "Georgia, serif" }}>CÓDICE</span>
          </button>
          <div className="flex items-center gap-3">
            <button onClick={onAdmin} className="text-base">👤</button>
            <button onClick={onInstitucion} className="text-base">⚙️</button>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto px-2 pb-2">
          {MENU_PANEL.map((m) => (
            <button key={m.key} onClick={() => onCambiar(m.key)}
              className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap shrink-0"
              style={{ background: activo === m.key ? "rgba(139,92,246,0.35)" : "transparent", color: activo === m.key ? "#EDE9FE" : "#A78BFA" }}>
              {m.icono} {m.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function Panel({ session }) {
  const [tab, setTab] = useState("inicio");
  const [subTabHerramientas, setSubTabHerramientas] = useState("ruleta");
  const [grado, setGrado] = useState(null);
  const [reino, setReino] = useState(null);
  const [modoLista, setModoLista] = useState(false);
  const [grados, setGrados] = useState([]);
  const [institucionAbierta, setInstitucionAbierta] = useState(false);
  const [administracionAbierta, setAdministracionAbierta] = useState(false);
  const [institucion, setInstitucion] = useState(null);

  const cargarInstitucion = () => api.fetchInstitucion().then(setInstitucion);

  useEffect(() => {
    api.asegurarProfesor().then(() => api.asegurarGradosBase()).then(() => api.fetchGrados()).then(setGrados);
    cargarInstitucion();
  }, []);

  const irA = (key) => {
    setTab(key);
    if (key === "estudiantes") { setGrado(null); setReino(null); setModoLista(false); }
  };

  return (
    <div className="min-h-screen bg-violet-50 md:flex">
      <SidebarPanel activo={tab} onCambiar={irA} email={session.user.email} institucion={institucion}
        onAdmin={() => setAdministracionAbierta(true)} onInstitucion={() => setInstitucionAbierta(true)}
        onSalir={() => supabase.auth.signOut()} />

      {institucionAbierta && <InstitucionModal onClose={() => { setInstitucionAbierta(false); cargarInstitucion(); }} />}
      {administracionAbierta && <AdministracionModal onClose={() => setAdministracionAbierta(false)} />}

      <div className="p-6 max-w-6xl mx-auto md:flex-1 md:min-w-0">
        {tab === "inicio" && <VistaInicio onIrA={irA} />}
        {tab === "estudiantes" && (
          <>
            {!grado && <VistaGrados onElegirGrado={(g) => { setGrado(g); setReino(null); setModoLista(true); }} />}
            {grado && !modoLista && !reino && (
              <VistaReinos
                gradoId={grado}
                onElegirReino={(r) => setReino(r)}
                onVerTodos={() => setModoLista(true)}
                onVolver={() => setGrado(null)}
              />
            )}
            {grado && (modoLista || reino) && (
              <VistaEstudiantes
                gradoId={grado}
                grados={grados}
                reinoFiltro={modoLista ? null : reino}
                onVolver={() => setGrado(null)}
                onVerGrupos={() => { setReino(null); setModoLista(false); }}
              />
            )}
          </>
        )}
        {tab === "asistencia" && grados.length > 0 && <VistaAsistencia grados={grados} />}
        {tab === "herramientas" && grados.length > 0 && (
          <>
            <div className="flex gap-1 mb-6 rounded-full bg-white p-1 w-fit border border-slate-100 shadow-sm">
              <button onClick={() => setSubTabHerramientas("ruleta")} className={`text-xs px-3 py-1.5 rounded-full ${subTabHerramientas === "ruleta" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Ruleta</button>
              <button onClick={() => setSubTabHerramientas("ruletamonedas")} className={`text-xs px-3 py-1.5 rounded-full ${subTabHerramientas === "ruletamonedas" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Ruleta de Monedas</button>
              <button onClick={() => setSubTabHerramientas("banco")} className={`text-xs px-3 py-1.5 rounded-full ${subTabHerramientas === "banco" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Banco</button>
              <button onClick={() => setSubTabHerramientas("temporizador")} className={`text-xs px-3 py-1.5 rounded-full ${subTabHerramientas === "temporizador" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Temporizador</button>
              <button onClick={() => setSubTabHerramientas("otras")} className={`text-xs px-3 py-1.5 rounded-full ${subTabHerramientas === "otras" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Otras herramientas</button>
            </div>
            {subTabHerramientas === "ruleta" && <VistaRuleta grados={grados} />}
            {subTabHerramientas === "ruletamonedas" && <VistaRuletaMonedas grados={grados} />}
            {subTabHerramientas === "banco" && <VistaBanco />}
            {subTabHerramientas === "temporizador" && <VistaTemporizador />}
            {subTabHerramientas === "otras" && <VistaHerramientas grados={grados} />}
          </>
        )}
        {tab === "roles" && <VistaRoles />}
        {tab === "calificaciones" && grados.length > 0 && <VistaCalificaciones grados={grados} />}
        {tab === "reportes" && grados.length > 0 && <VistaReportes grados={grados} />}
        {tab === "horario" && grados.length > 0 && <VistaHorario grados={grados} />}
        {tab === "planeaciones" && grados.length > 0 && <VistaPlaneaciones grados={grados} />}
        {tab === "evaluaciones" && grados.length > 0 && <VistaEvaluaciones grados={grados} />}
        {tab === "proyectosforja" && grados.length > 0 && <VistaProyectosForja grados={grados} />}
      </div>
    </div>
  );
}
