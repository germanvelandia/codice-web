import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import * as api from "./lib/api";
import { nextLevel } from "./lib/gamification";
import { bandaDesempeno, notaFinalPonderada } from "./lib/calificaciones";
import { VistaGrados, VistaReinos, VistaEstudiantes } from "./screens/Estudiantes";
import { VistaAsistencia } from "./screens/Asistencia";
import { VistaRuleta, VistaTemporizador, VistaHerramientas } from "./screens/Herramientas";
import { VistaRoles } from "./screens/Roles";
import { VistaCalificaciones } from "./screens/Calificaciones";
import { VistaReportes } from "./screens/Reportes";
import { VistaHorario } from "./screens/Horario";
import { VistaPlaneaciones } from "./screens/Planeaciones";
import { VistaEvaluaciones } from "./screens/Evaluaciones";
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
        <div className="w-full max-w-sm">
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
                        {f.actividadesPeriodo.length > 0 && (
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

function PortalEstudiante() {
  const [codigo, setCodigo] = useState("");
  const [datos, setDatos] = useState(null);
  const [estudianteInfo, setEstudianteInfo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

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
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="text-center mb-4">
          <div className="text-lg font-bold text-slate-800">{datos.nombre}</div>
          <div className="text-xs text-slate-400">Grado {datos.grado_id} · {datos.grupo}</div>
        </div>
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
        <div className="text-xs text-slate-500 mb-4">
          Presentes: {datos.presentes} · Retardos: {datos.retardos} · Faltas injustificadas: {datos.faltas_injustificadas} · Faltas justificadas: {datos.faltas_justificadas}
        </div>
        {estudianteInfo && <MisNotas estudianteId={estudianteInfo.id} />}
        {estudianteInfo && <EvaluacionesEstudiante estudianteId={estudianteInfo.id} gradoId={estudianteInfo.grado_id} />}
        <button onClick={() => { setDatos(null); setCodigo(""); setEstudianteInfo(null); }} className="w-full text-xs text-violet-500 mt-4">← Consultar otro código</button>
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

function Panel({ session }) {
  const [tab, setTab] = useState("estudiantes");
  const [subTabHerramientas, setSubTabHerramientas] = useState("ruleta");
  const [grado, setGrado] = useState(null);
  const [reino, setReino] = useState(null);
  const [modoLista, setModoLista] = useState(false);
  const [grados, setGrados] = useState([]);
  const [institucionAbierta, setInstitucionAbierta] = useState(false);
  const [administracionAbierta, setAdministracionAbierta] = useState(false);

  useEffect(() => {
    api.asegurarProfesor().then(() => api.asegurarGradosBase()).then(() => api.fetchGrados()).then(setGrados);
  }, []);

  const irAEstudiantes = () => { setTab("estudiantes"); setGrado(null); setReino(null); setModoLista(false); };

  return (
    <div className="min-h-screen bg-violet-50">
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold text-violet-700 cursor-pointer" onClick={irAEstudiantes}>CÓDICE</h1>
        <div className="flex gap-1 rounded-full bg-violet-50 p-1 flex-wrap">
          <button onClick={irAEstudiantes} className={`text-xs px-3 py-1.5 rounded-full ${tab === "estudiantes" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Estudiantes</button>
          <button onClick={() => setTab("asistencia")} className={`text-xs px-3 py-1.5 rounded-full ${tab === "asistencia" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Asistencia</button>
          <button onClick={() => setTab("herramientas")} className={`text-xs px-3 py-1.5 rounded-full ${tab === "herramientas" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Herramientas</button>
          <button onClick={() => setTab("roles")} className={`text-xs px-3 py-1.5 rounded-full ${tab === "roles" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Roles</button>
          <button onClick={() => setTab("calificaciones")} className={`text-xs px-3 py-1.5 rounded-full ${tab === "calificaciones" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Calificaciones</button>
          <button onClick={() => setTab("reportes")} className={`text-xs px-3 py-1.5 rounded-full ${tab === "reportes" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Reportes</button>
          <button onClick={() => setTab("horario")} className={`text-xs px-3 py-1.5 rounded-full ${tab === "horario" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Horario</button>
          <button onClick={() => setTab("planeaciones")} className={`text-xs px-3 py-1.5 rounded-full ${tab === "planeaciones" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Planeaciones</button>
          <button onClick={() => setTab("evaluaciones")} className={`text-xs px-3 py-1.5 rounded-full ${tab === "evaluaciones" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Evaluaciones</button>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setAdministracionAbierta(true)} className="text-lg" title="Docentes y mi cuenta">👤</button>
          <button onClick={() => setInstitucionAbierta(true)} className="text-lg" title="Datos de la institución">⚙️</button>
          <button onClick={() => supabase.auth.signOut()} className="text-sm text-slate-500">Cerrar sesión ({session.user.email})</button>
        </div>
      </div>
      {institucionAbierta && <InstitucionModal onClose={() => setInstitucionAbierta(false)} />}
      {administracionAbierta && <AdministracionModal onClose={() => setAdministracionAbierta(false)} />}
      <div className="p-6 max-w-6xl mx-auto">
        {tab === "estudiantes" && (
          <>
            {!grado && <VistaGrados onElegirGrado={(g) => { setGrado(g); setReino(null); setModoLista(false); }} />}
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
                onVolver={() => { setReino(null); setModoLista(false); }}
              />
            )}
          </>
        )}
        {tab === "asistencia" && grados.length > 0 && <VistaAsistencia grados={grados} />}
        {tab === "herramientas" && grados.length > 0 && (
          <>
            <div className="flex gap-1 mb-6 rounded-full bg-white p-1 w-fit border border-slate-100 shadow-sm">
              <button onClick={() => setSubTabHerramientas("ruleta")} className={`text-xs px-3 py-1.5 rounded-full ${subTabHerramientas === "ruleta" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Ruleta</button>
              <button onClick={() => setSubTabHerramientas("temporizador")} className={`text-xs px-3 py-1.5 rounded-full ${subTabHerramientas === "temporizador" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Temporizador</button>
              <button onClick={() => setSubTabHerramientas("otras")} className={`text-xs px-3 py-1.5 rounded-full ${subTabHerramientas === "otras" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Otras herramientas</button>
            </div>
            {subTabHerramientas === "ruleta" && <VistaRuleta grados={grados} />}
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
      </div>
    </div>
  );
}
