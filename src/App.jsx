import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import * as api from "./lib/api";
import { nextLevel, nivelYCurso } from "./lib/gamification";
import { bandaDesempeno, notaFinalPonderada } from "./lib/calificaciones";
import { VistaGrados, VistaReinos, VistaEstudiantes, FotoLightbox } from "./screens/Estudiantes";
import { VistaAsistencia } from "./screens/Asistencia";
import { VistaRuleta, VistaRuletaMonedas, VistaTemporizador, VistaHerramientas } from "./screens/Herramientas";
import { VistaAccionesMasivas } from "./screens/AccionesMasivas";
import { VistaBanco } from "./screens/Banco";
import { VistaAlbum, CartaCriatura } from "./screens/Album";
import { VistaAnuncios } from "./screens/Anuncios";
import { VistaLogros } from "./screens/Logros";
import { VistaSalonHonor } from "./screens/SalonHonor";
import { VistaGamificacionExtra } from "./screens/GamificacionExtra";
import { VistaRoles } from "./screens/Roles";
import { VistaCalificaciones } from "./screens/Calificaciones";
import { VistaReportes } from "./screens/Reportes";
import { VistaHorario } from "./screens/Horario";
import { VistaPlaneaciones } from "./screens/Planeaciones";
import { VistaBiblioteca } from "./screens/Biblioteca";
import { VistaAnotaciones } from "./screens/Anotaciones";
import { VistaInclusionGeneral } from "./screens/InclusionGeneral";
import { VistaBajasVida } from "./screens/BajasVida";
import { VistaCorregirNombres } from "./screens/CorregirNombres";
import { VistaDireccionCurso } from "./screens/DireccionCurso";
import { VistaGuiasEstudio, GuiasEstudiante } from "./screens/GuiasEstudio";
import { VistaConsignasCodice } from "./screens/ConsignasCodice";
import { VistaTriviaAdmin } from "./screens/TriviaAdmin";
import { VistaBancoPreguntas } from "./screens/BancoPreguntas";
import { VistaEvaluaciones } from "./screens/Evaluaciones";
import { VistaProyectosForja } from "./screens/TareasCalificables";
import { VistaInicio, ContenidoLightbox } from "./screens/Inicio";
import { EditorTexto, TextoEnriquecido, textoPlano } from "./components/RichText";
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
        const { intentoId: id, preguntas: p } = await api.iniciarIntentoConAleatorias(evaluacion, estudianteId);
        setIntentoId(id);
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
            <h3 className="font-bold text-slate-800 mb-2">⚔️ {evaluacion.titulo}</h3>
            {(evaluacion.descripcion || (evaluacion.indicaciones && evaluacion.indicaciones.length > 0) || evaluacion.tiempo_limite_minutos) && (
              <div className="bg-violet-50 rounded-2xl p-4 mb-4">
                {evaluacion.descripcion && <TextoEnriquecido html={evaluacion.descripcion} className="text-xs text-slate-600 mb-3" />}
                {evaluacion.indicaciones && evaluacion.indicaciones.length > 0 && (
                  <>
                    <div className="text-[11px] font-bold text-violet-700 uppercase tracking-wide mb-1.5">Indicaciones</div>
                    <ul className="space-y-1.5 mb-1">
                      {evaluacion.indicaciones.map((ind, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                          <span className="text-violet-400 shrink-0">✓</span>
                          <span className="leading-relaxed">{ind}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {evaluacion.tiempo_limite_minutos && (
                  <div className="text-[11px] font-semibold text-violet-700 mt-2">⏱ Tiempo sugerido: {evaluacion.tiempo_limite_minutos} minutos</div>
                )}
              </div>
            )}
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

  const colorBorde = publicado ? "#22C55E" : hayPendiente ? "#F59E0B" : "#8B5CF6";

  return (
    <div className="bg-white rounded-xl p-3.5 shadow-sm" style={{ borderLeft: `4px solid ${colorBorde}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-800">⚔️ {evaluacion.titulo}</div>
          {evaluacion.descripcion && <TextoEnriquecido html={evaluacion.descripcion} className="text-xs text-slate-500 mt-1" />}
        </div>
        {publicado ? (
          <span className="text-xs font-bold text-white bg-emerald-500 px-2.5 py-1 rounded-full shrink-0">{publicado.puntaje_obtenido}/{publicado.puntaje_maximo}</span>
        ) : hayPendiente ? (
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-full shrink-0 whitespace-nowrap">⏳ En revisión</span>
        ) : null}
      </div>
      <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
        <span>{maxIntentos ? `${usados}/${maxIntentos} intentos` : `${usados} intento(s)`}</span>
        {evaluacion.tiempo_limite_minutos && <span>· ⏱ {evaluacion.tiempo_limite_minutos} min</span>}
      </div>
      {puedeIntentar && (
        <button onClick={() => setTomando(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white mt-2.5">
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

function AlbumEstudiante({ estudianteId, monedas, onMonedasActualizadas }) {
  const [config, setConfig] = useState(null);
  const [catalogo, setCatalogo] = useState([]);
  const [coleccion, setColeccion] = useState([]);
  const [abriendo, setAbriendo] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = () => {
    Promise.all([api.fetchAlbumConfig(), api.fetchCriaturasActivas(), api.fetchColeccion(estudianteId)]).then(([cfg, cat, col]) => {
      setConfig(cfg); setCatalogo(cat); setColeccion(col); setCargando(false);
    });
  };
  useEffect(() => { cargar(); }, [estudianteId]);

  if (cargando || !config) return <div className="text-sm text-slate-400">Cargando…</div>;
  if (catalogo.length === 0) return <p className="text-sm text-slate-400">Todavía no hay criaturas disponibles para coleccionar.</p>;

  const poseidas = new Map(coleccion.map((c) => [c.criatura_id, c]));
  const puedeAbrir = monedas >= config.costo_sobre;

  const abrirSobre = async () => {
    setAbriendo(true);
    setResultado(null);
    try {
      const r = await api.abrirSobre(estudianteId);
      setTimeout(() => {
        setAbriendo(false);
        setResultado(r);
        onMonedasActualizadas();
        cargar();
      }, 1400);
    } catch (e) {
      setAbriendo(false);
      alert("Error al abrir el sobre: " + e.message);
    }
  };

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">🎴 {config.nombre_album}</h3>
      <p className="text-xs text-slate-400 mb-3">Comprá sobres con tus monedas y coleccioná criaturas al azar. Vas a tener {config.cartas_por_sobre} por sobre.</p>

      {abriendo ? (
        <div className="text-center py-6 text-violet-500 animate-pulse text-sm">🎴 Abriendo sobre…</div>
      ) : resultado ? (
        resultado.ok ? (
          <div className="bg-violet-50 rounded-2xl p-4 mb-3 text-center">
            <div className="text-xs font-semibold text-violet-700 mb-2">¡Te tocaron estas criaturas!</div>
            <div className="flex justify-center gap-2 flex-wrap">
              {resultado.cartas.map((c, i) => <CartaCriatura key={i} criatura={c} tamano="chico" />)}
            </div>
          </div>
        ) : (
          <div className="text-center bg-amber-50 rounded-xl p-3 mb-3 text-xs text-amber-700">Te faltan monedas para abrir un sobre (necesitás {resultado.costo}).</div>
        )
      ) : null}

      <button disabled={!puedeAbrir} onClick={abrirSobre} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-50 mb-4">
        {puedeAbrir ? `🎴 Abrir sobre (🪙 ${config.costo_sobre})` : `Necesitás ${config.costo_sobre} monedas`}
      </button>

      <div className="text-xs font-semibold text-slate-600 mb-2">Tu colección ({coleccion.length}/{catalogo.length})</div>
      <div className="flex flex-wrap gap-2 justify-center">
        {catalogo.map((c) => {
          const tenida = poseidas.get(c.id);
          return <CartaCriatura key={c.id} criatura={tenida ? { ...c, cantidad: tenida.cantidad } : c} tamano="chico" revelada={!!tenida} />;
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

function MicroMisionesEstudiante({ estudianteId, onCambio }) {
  const [misiones, setMisiones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [completando, setCompletando] = useState(null);

  const cargar = () => api.fetchMicroMisionesEstudiante(estudianteId).then((d) => { setMisiones(d); setCargando(false); });
  useEffect(() => { cargar(); }, [estudianteId]);

  const completar = async (mision) => {
    setCompletando(mision.id);
    try {
      await api.completarMicroMision(mision, estudianteId);
      cargar();
      onCambio && onCambio();
    } catch (e) {
      alert(e.message);
    }
    setCompletando(null);
  };

  if (cargando || misiones.length === 0) return null;

  return (
    <div className="mb-4 pb-4 border-b border-slate-100">
      <div className="text-xs font-semibold text-slate-600 mb-2">🎯 Misiones diarias/semanales</div>
      <div className="space-y-1.5">
        {misiones.map((m) => (
          <div key={m.id} className={`flex items-center justify-between rounded-lg px-3 py-2 ${m.completada ? "bg-emerald-50" : "bg-slate-50"}`}>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-700">{m.tipo === "diaria" ? "☀️" : "📅"} {m.titulo}</div>
              {m.descripcion && <TextoEnriquecido html={m.descripcion} className="text-[11px] text-slate-500" />}
              <div className="text-[10px] text-slate-400">🪙{m.recompensa_monedas} · ⭐{m.recompensa_xp}</div>
            </div>
            {m.completada ? (
              <span className="text-[11px] text-emerald-600 font-semibold shrink-0">✔ Cumplida</span>
            ) : (
              <button disabled={completando === m.id} onClick={() => completar(m)} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-500 text-white shrink-0">
                {completando === m.id ? "…" : "Marcar cumplida"}
              </button>
            )}
          </div>
        ))}
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

function SalonHonorEstudiante({ estudianteId }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => { api.fetchSalonDeHonor().then((d) => { setDatos(d); setCargando(false); }); }, []);

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;

  const medalla = (i) => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">🏆 Salón de Honor</h3>
      <p className="text-xs text-slate-400 mb-3">Los mejores de toda la institución, cruzando todos los grados.</p>

      <div className="text-xs font-semibold text-slate-600 mb-1.5">⭐ Más XP</div>
      <div className="space-y-1.5 mb-4">
        {datos.topXp.map((e) => (
          <div key={e.id} className={`flex items-center justify-between px-3 py-2 rounded-xl ${e.id === estudianteId ? "bg-violet-100 border border-violet-300" : "bg-slate-50"}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm w-6 text-center shrink-0">{medalla(datos.topXp.indexOf(e))}</span>
              <span className={`text-xs truncate ${e.id === estudianteId ? "font-bold text-violet-700" : "text-slate-700"}`}>{e.nombre}{e.id === estudianteId ? " (vos)" : ""}</span>
              <span className="text-[10px] text-slate-400 shrink-0">G{e.grado_id}</span>
            </div>
            <span className="text-xs font-semibold text-slate-500 shrink-0">{e.xp} XP</span>
          </div>
        ))}
        {datos.topXp.length === 0 && <p className="text-xs text-slate-400">Todavía no hay datos.</p>}
      </div>

      <div className="text-xs font-semibold text-slate-600 mb-1.5">🏅 Más insignias</div>
      <div className="space-y-1.5 mb-4">
        {datos.topInsignias.map((e) => (
          <div key={e.id} className={`flex items-center justify-between px-3 py-2 rounded-xl ${e.id === estudianteId ? "bg-violet-100 border border-violet-300" : "bg-slate-50"}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm w-6 text-center shrink-0">{medalla(datos.topInsignias.indexOf(e))}</span>
              <span className={`text-xs truncate ${e.id === estudianteId ? "font-bold text-violet-700" : "text-slate-700"}`}>{e.nombre}{e.id === estudianteId ? " (vos)" : ""}</span>
              <span className="text-[10px] text-slate-400 shrink-0">G{e.grado_id}</span>
            </div>
            <span className="text-xs font-semibold text-amber-600 shrink-0">{e.cantidad} 🏅</span>
          </div>
        ))}
        {datos.topInsignias.length === 0 && <p className="text-xs text-slate-400">Todavía nadie desbloqueó insignias.</p>}
      </div>

      <div className="text-xs font-semibold text-slate-600 mb-1.5">📜 Logros recientes</div>
      <div className="space-y-1.5">
        {datos.muroReciente.slice(0, 8).map((l) => (
          <div key={l.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
            <span className="text-base shrink-0">{l.logro_emoji}</span>
            <div className="text-[11px] min-w-0">
              <span className="font-semibold text-slate-700">{l.estudiante_nombre}</span>
              <span className="text-slate-400"> desbloqueó </span>
              <span className="font-semibold text-violet-600">{l.logro_nombre}</span>
            </div>
          </div>
        ))}
        {datos.muroReciente.length === 0 && <p className="text-xs text-slate-400">Todavía no hay logros desbloqueados.</p>}
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

function TareaCalificableEstudiante({ tarea, estudianteId, icono = "📄" }) {
  const [entrega, setEntrega] = useState(null);
  useEffect(() => { api.fetchMiEntrega(tarea.id, estudianteId).then(setEntrega); }, [tarea.id]);

  const calificado = entrega?.nota !== null && entrega?.nota !== undefined;
  const colorBorde = calificado ? "#22C55E" : "#F59E0B";

  return (
    <div className="bg-white rounded-xl p-3.5 shadow-sm" style={{ borderLeft: `4px solid ${colorBorde}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-800">{icono} {tarea.titulo}</div>
          {tarea.materias?.nombre && <div className="text-[11px] text-violet-500 font-semibold mt-0.5">{tarea.materias.nombre}</div>}
          {tarea.descripcion && <TextoEnriquecido html={tarea.descripcion} className="text-xs text-slate-500 mt-1" />}
        </div>
        {calificado ? (
          <span className="text-xs font-bold text-white bg-emerald-500 px-2.5 py-1 rounded-full shrink-0">{entrega.nota}</span>
        ) : (
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-full shrink-0 whitespace-nowrap">⏳ Pendiente</span>
        )}
      </div>
      {tarea.fecha_entrega && <div className="text-[11px] text-slate-400 mt-2">📅 Entrega: {tarea.fecha_entrega}</div>}
      {tarea.url && (
        <a href={tarea.url} target="_blank" rel="noreferrer" className="inline-block text-xs font-semibold text-white bg-violet-500 px-3 py-1.5 rounded-lg mt-2">
          🔗 Abrir enlace
        </a>
      )}
      {calificado && entrega.comentario && (
        <div className="text-xs text-slate-600 italic bg-slate-50 rounded-lg p-2 mt-2">"{entrega.comentario}"</div>
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
  if (proyectos.length === 0 && tareasPlan.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-3xl mb-2">📜</div>
        <p className="text-sm text-slate-400">Todavía no tenés proyectos asignados.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-3">📜 Proyectos</h3>
      {proyectos.length > 0 && (
        <div className="space-y-2 mb-5">
          {proyectos.map((p) => <TareaCalificableEstudiante key={p.id} tarea={p} estudianteId={estudianteId} icono="📜" />)}
        </div>
      )}
      {tareasPlan.length > 0 && (
        <>
          <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Otras tareas de clase</div>
          <div className="space-y-2">
            {tareasPlan.map((t) => (
              <div key={t.id} className="bg-white rounded-xl p-3.5 shadow-sm border-l-4 border-slate-300">
                <div className="text-sm font-bold text-slate-800">📝 {t.titulo}</div>
                <div className="text-[11px] text-violet-500 font-semibold mt-0.5">{t.materia_nombre}{t.unidad_titulo ? ` · ${t.unidad_titulo}` : ""}</div>
                {t.fecha_entrega && <div className="text-[11px] text-slate-400 mt-1.5">📅 Entrega: {t.fecha_entrega}</div>}
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
  if (talleres.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-3xl mb-2">🔨</div>
        <p className="text-sm text-slate-400">Todavía no tenés talleres o entregables asignados.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-3">🔨 Forja</h3>
      <div className="space-y-2">
        {talleres.map((t) => <TareaCalificableEstudiante key={t.id} tarea={t} estudianteId={estudianteId} icono="🔨" />)}
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
  { key: "album", label: "Álbum", icono: "🎴" },
  { key: "biblioteca", label: "Biblioteca", icono: "📚" },
  { key: "codice", label: "Códice", icono: "📖" },
  { key: "forja", label: "Forja", icono: "🔨" },
  { key: "guias", label: "Guías", icono: "📘" },
  { key: "inicio", label: "Inicio", icono: "🏠" },
  { key: "misiones", label: "Misiones", icono: "⚔️" },
  { key: "notas", label: "Notas", icono: "📝" },
  { key: "perfil", label: "Perfil", icono: "👤" },
  { key: "preguntados", label: "Preguntados", icono: "🎡" },
  { key: "proyectos", label: "Proyectos", icono: "📜" },
  { key: "ranking", label: "Ranking", icono: "📊" },
  { key: "recompensas", label: "Recompensas", icono: "🎁" },
  { key: "salonhonor", label: "Salón de Honor", icono: "🏆" },
];

function MenuCodice({ activo, onCambiar, monedas, gradoId }) {
  const [ultimoAnuncio, setUltimoAnuncio] = useState(null);
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    if (!gradoId) return;
    api.fetchAnunciosParaGrado(gradoId).then((lista) => setUltimoAnuncio(lista[0] || null));
  }, [gradoId]);

  const elegir = (key) => {
    onCambiar(key);
    setMenuAbierto(false);
  };

  return (
    <div className="rounded-2xl overflow-hidden mb-4" style={{ background: "linear-gradient(180deg, #1e1b30 0%, #14101f 100%)", border: "2px solid #8B5CF6" }}>
      <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ background: "linear-gradient(180deg, #2d2450 0%, #1e1b30 100%)", borderBottom: "2px solid #7c3aed55" }}>
        <button onClick={() => elegir("inicio")} className="flex items-center gap-2">
          <span className="text-xl">🧭</span>
          <span className="text-violet-200 text-sm font-bold tracking-[0.2em]" style={{ fontFamily: "Georgia, serif" }}>CÓDICE</span>
        </button>
        {monedas !== undefined && (
          <div className="flex items-center gap-1.5">
            <span className="text-base">🪙</span>
            <span className="text-sm font-bold text-amber-300">{monedas}</span>
          </div>
        )}
        <button onClick={() => setMenuAbierto((v) => !v)} className="md:hidden text-violet-200 text-lg" title="Menú">
          {menuAbierto ? "✕" : "☰"}
        </button>
      </div>

      {ultimoAnuncio && (
        <button onClick={() => elegir("mensajes")} className="w-full text-left px-3 py-2.5" style={{ background: "rgba(139,92,246,0.15)", borderBottom: "1px solid rgba(139,92,246,0.15)" }}>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs">{ultimoAnuncio.fijado ? "📌" : "✉️"}</span>
            <span className="text-[10px] font-bold text-violet-200 uppercase tracking-wide">Último mensaje</span>
          </div>
          <div className="text-xs font-semibold text-white truncate">{ultimoAnuncio.titulo}</div>
          <div className="text-[11px] text-violet-300 truncate">{ultimoAnuncio.contenido}</div>
        </button>
      )}

      {/* Escritorio: opciones en fila, envolviendo si hace falta */}
      <div className="hidden md:flex flex-wrap gap-1 px-3 py-2">
        {MENU_CODICE.map((m) => (
          <button key={m.key} onClick={() => elegir(m.key)}
            className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap flex items-center gap-1.5"
            style={{ background: activo === m.key ? "rgba(139,92,246,0.35)" : "transparent", color: activo === m.key ? "#EDE9FE" : "#A78BFA" }}>
            <span>{m.icono}</span> {m.label}
          </button>
        ))}
      </div>

      {/* Móvil: menú desplegable en grilla — nada queda fuera de pantalla */}
      {menuAbierto && (
        <div className="md:hidden px-3 py-3 grid grid-cols-3 gap-1.5">
          {MENU_CODICE.map((m) => (
            <button key={m.key} onClick={() => elegir(m.key)}
              className="text-[11px] px-2 py-2.5 rounded-xl flex flex-col items-center gap-1"
              style={{ background: activo === m.key ? "rgba(139,92,246,0.35)" : "rgba(255,255,255,0.05)", color: activo === m.key ? "#EDE9FE" : "#A78BFA" }}>
              <span className="text-base">{m.icono}</span>
              <span className="text-center leading-tight">{m.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EntradaCodiceCard({ entrada }) {
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

function CodiceEstudiante({ estudianteId, gradoId }) {
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

function ValorSemanaEstudiante() {
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

function AnunciosEstudiante({ gradoId }) {
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

function LogrosEstudiante({ estudianteId }) {
  const [catalogo, setCatalogo] = useState([]);
  const [desbloqueados, setDesbloqueados] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([api.fetchLogrosCatalogo(), api.fetchLogrosEstudiante(estudianteId)]).then(([c, d]) => {
      setCatalogo(c.filter((l) => l.activo)); setDesbloqueados(d); setCargando(false);
    });
  }, [estudianteId]);

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;
  if (catalogo.length === 0) return null;

  const idsDesbloqueados = new Set(desbloqueados.map((d) => d.logro_id));

  return (
    <div>
      <div className="text-xs font-semibold text-slate-600 mb-2">🏅 Insignias ({desbloqueados.length}/{catalogo.length})</div>
      <div className="grid grid-cols-3 gap-2">
        {catalogo.map((l) => {
          const tiene = idsDesbloqueados.has(l.id);
          return (
            <div key={l.id} className="rounded-xl p-2 text-center" style={{ background: tiene ? "#F5F3FF" : "#F1F5F9", border: `1.5px solid ${tiene ? "#8B5CF6" : "#E2E8F0"}` }}>
              <div className="text-2xl" style={{ filter: tiene ? "none" : "grayscale(1)", opacity: tiene ? 1 : 0.35 }}>{l.emoji}</div>
              <div className="text-[9px] font-semibold text-slate-700 truncate mt-0.5">{tiene ? l.nombre : "???"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DesafioReinoEstudiante({ gradoId, miReino }) {
  const [desafios, setDesafios] = useState([]);
  const [progresoPorDesafio, setProgresoPorDesafio] = useState({});
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.fetchDesafiosReino(gradoId).then(async (lista) => {
      const activos = lista.filter((d) => d.activo);
      setDesafios(activos);
      const progresos = {};
      for (const d of activos) { progresos[d.id] = await api.fetchProgresoDesafio(d); }
      setProgresoPorDesafio(progresos);
      setCargando(false);
    });
  }, [gradoId]);

  if (cargando || desafios.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="text-xs font-semibold text-slate-600 mb-2">⚔️ Desafío de tu Reino</div>
      {desafios.map((d) => {
        const filas = progresoPorDesafio[d.id] || [];
        const miFila = filas.find((f) => f.reino === miReino);
        return (
          <div key={d.id} className="bg-violet-50 rounded-xl p-3 mb-2">
            <div className="text-sm font-bold text-slate-800">{d.titulo}</div>
            {d.descripcion && <TextoEnriquecido html={d.descripcion} className="text-[11px] text-slate-500 mt-0.5" />}
            <div className="space-y-1.5 mt-2">
              {filas.slice(0, 4).map((f) => (
                <div key={f.reino}>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className={`font-semibold ${f.reino === miReino ? "text-violet-700" : "text-slate-500"}`}>{f.reino}{f.reino === miReino ? " (vos)" : ""}</span>
                    <span className="text-slate-400">{f.total}/{d.meta}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600" style={{ width: `${f.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CosmeticosEstudiante({ estudianteId, monedas, onMonedasActualizadas }) {
  const [catalogo, setCatalogo] = useState([]);
  const [poseidos, setPoseidos] = useState([]);
  const [equipados, setEquipados] = useState({ marco: null, titulo: null });
  const [cargando, setCargando] = useState(true);

  const cargar = () => {
    Promise.all([api.fetchCosmeticosCatalogo(), api.fetchCosmeticosEstudiante(estudianteId), api.fetchEquipadosEstudiante(estudianteId)]).then(([cat, pos, eq]) => {
      setCatalogo(cat.filter((c) => c.activo)); setPoseidos(pos); setEquipados(eq); setCargando(false);
    });
  };
  useEffect(() => { cargar(); }, [estudianteId]);

  if (cargando) return null;

  const idsPoseidos = new Set(poseidos.map((p) => p.cosmetico_id));

  const comprar = async (c) => {
    try {
      await api.comprarCosmetico(estudianteId, c);
      cargar();
      onMonedasActualizadas();
    } catch (e) {
      alert(e.message);
    }
  };

  const equipar = async (c) => {
    await api.equiparCosmetico(estudianteId, c.tipo, equipados[c.tipo]?.id === c.id ? null : c.id);
    cargar();
  };

  return (
    <div>
      <div className="text-xs font-semibold text-slate-600 mb-2">🎨 Personalización</div>
      <div className="grid grid-cols-2 gap-2">
        {catalogo.map((c) => {
          const tengo = idsPoseidos.has(c.id);
          const equipado = equipados[c.tipo]?.id === c.id;
          return (
            <div key={c.id} className="bg-slate-50 rounded-xl p-2.5 text-center">
              {c.tipo === "marco" ? (
                <div className="w-8 h-8 rounded-full border-4 mx-auto" style={{ borderColor: c.valor }} />
              ) : (
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-violet-100 text-violet-700 inline-block">{c.valor}</span>
              )}
              <div className="text-[11px] font-semibold text-slate-700 mt-1">{c.nombre}</div>
              {tengo ? (
                <button onClick={() => equipar(c)} className={`text-[10px] mt-1 px-2 py-1 rounded-full ${equipado ? "bg-violet-500 text-white" : "bg-white border border-slate-200 text-slate-500"}`}>
                  {equipado ? "✔ Equipado" : "Equipar"}
                </button>
              ) : (
                <button onClick={() => comprar(c)} disabled={monedas < c.costo_monedas} className="text-[10px] mt-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 disabled:opacity-40">
                  🪙 {c.costo_monedas}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {catalogo.length === 0 && <p className="text-xs text-slate-400">Todavía no hay cosméticos disponibles.</p>}
    </div>
  );
}

const CATEGORIAS_BIBLIOTECA = {
  enlace: { label: "Enlace", emoji: "🔗", color: "#8B5CF6" },
  documento: { label: "Documento", emoji: "📄", color: "#3B82F6" },
  video: { label: "Video", emoji: "🎬", color: "#EF4444" },
  libro: { label: "Libro", emoji: "📖", color: "#F59E0B" },
  audio: { label: "Audio", emoji: "🎧", color: "#22C55E" },
};

function BibliotecaEstudiante({ gradoId }) {
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

const CATEGORIA_INFO_ESTUDIANTE = {
  academico: { label: "Académico", color: "#3B82F6", emoji: "📘" },
  convivencial: { label: "Convivencial", color: "#F59E0B", emoji: "🤝" },
  general: { label: "General", color: "#8B5CF6", emoji: "⚡" },
  respeto: { label: "Respeto", color: "#22C55E", emoji: "🌱" },
  responsabilidad: { label: "Responsabilidad", color: "#22C55E", emoji: "✅" },
  confiabilidad: { label: "Confiabilidad", color: "#22C55E", emoji: "🤲" },
  justicia: { label: "Justicia", color: "#22C55E", emoji: "⚖️" },
  solidaridad: { label: "Solidaridad", color: "#22C55E", emoji: "💛" },
  ciudadania: { label: "Ciudadanía", color: "#22C55E", emoji: "🏛️" },
};

function HistorialEstudiante({ estudianteId }) {
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [verTodo, setVerTodo] = useState(false);

  useEffect(() => { api.fetchHistorialGamificacion(estudianteId).then((d) => { setHistorial(d); setCargando(false); }); }, [estudianteId]);

  if (cargando) return null;
  if (historial.length === 0) return null;

  const visibles = verTodo ? historial : historial.slice(0, 6);

  return (
    <div className="mt-5 pt-4 border-t border-slate-100">
      <div className="text-xs font-semibold text-slate-600 mb-2">📜 Historial reciente</div>
      <div className="space-y-1.5">
        {visibles.map((h) => {
          const info = CATEGORIA_INFO_ESTUDIANTE[h.categoria] || { label: h.categoria, color: "#94A3B8", emoji: "•" };
          return (
            <div key={h.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-700">{h.etiqueta}</div>
                <div className="text-[10px] text-slate-400">
                  {new Date(h.ts).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                  <span style={{ color: info.color }}> · {info.emoji} {info.label}</span>
                </div>
              </div>
              <div className={`text-xs font-semibold shrink-0 ${h.xp >= 0 ? "text-emerald-600" : "text-rose-500"}`}>{h.xp > 0 ? "+" : ""}{h.xp} XP</div>
            </div>
          );
        })}
      </div>
      {historial.length > 6 && (
        <button onClick={() => setVerTodo((v) => !v)} className="text-[11px] text-violet-500 mt-2">
          {verTodo ? "Ver menos" : `Ver todo (${historial.length})`}
        </button>
      )}
    </div>
  );
}

function PreguntadosEstudiante({ estudianteId }) {
  const [categorias, setCategorias] = useState([]);
  const [coronas, setCoronas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [girando, setGirando] = useState(false);
  const [rotacion, setRotacion] = useState(0);
  const [categoriaElegida, setCategoriaElegida] = useState(null);
  const [pregunta, setPregunta] = useState(null);
  const [respondida, setRespondida] = useState(null); // { opcion, acierto, corona }
  const [cargandoPregunta, setCargandoPregunta] = useState(false);

  const cargar = () => {
    Promise.all([api.fetchTriviaCategorias(), api.fetchCoronasEstudiante(estudianteId)]).then(([cats, cor]) => {
      setCategorias(cats); setCoronas(cor); setCargando(false);
    });
  };
  useEffect(() => { cargar(); }, [estudianteId]);

  const girar = () => {
    if (categorias.length === 0) return;
    setGirando(true);
    setCategoriaElegida(null);
    setPregunta(null);
    setRespondida(null);
    const elegidaIdx = Math.floor(Math.random() * categorias.length);
    const vueltasExtra = 4 * 360;
    const anguloPorSector = 360 / categorias.length;
    // Apunta al centro del sector elegido, en la parte de arriba de la ruleta
    const anguloFinal = 360 - (elegidaIdx * anguloPorSector + anguloPorSector / 2);
    setRotacion((prev) => prev + vueltasExtra + anguloFinal - (prev % 360));

    setTimeout(async () => {
      setGirando(false);
      const cat = categorias[elegidaIdx];
      setCategoriaElegida(cat);
      setCargandoPregunta(true);
      const p = await api.fetchPreguntaTriviaAleatoria(cat.id, estudianteId);
      setPregunta(p);
      setCargandoPregunta(false);
    }, 3200);
  };

  const responder = async (opcionIdx) => {
    if (respondida) return;
    const r = await api.responderTrivia(estudianteId, pregunta, opcionIdx);
    setRespondida({ opcion: opcionIdx, ...r });
    if (r.corona) setCoronas((prev) => [...prev, pregunta.categoria_id]);
  };

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;

  if (categorias.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-3xl mb-2">🎡</div>
        <p className="text-sm text-slate-400">Tu docente todavía no armó las categorías de Preguntados.</p>
      </div>
    );
  }

  const anguloPorSector = 360 / categorias.length;

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1 text-center">🎡 Preguntados</h3>
      <p className="text-xs text-slate-400 mb-4 text-center">Girá la ruleta, respondé, y ganá la corona de cada categoría acertando 3 seguidas.</p>

      {/* La ruleta */}
      <div className="relative mx-auto mb-4" style={{ width: 220, height: 220 }}>
        <div className="absolute left-1/2 -translate-x-1/2 z-10" style={{ top: -6 }}>
          <div style={{ width: 0, height: 0, borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "16px solid #1e1b30" }} />
        </div>
        <svg viewBox="0 0 200 200" width={220} height={220} style={{ transition: girando ? "transform 3.1s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none", transform: `rotate(${rotacion}deg)` }}>
          {categorias.map((c, i) => {
            const a0 = (i * anguloPorSector - 90) * (Math.PI / 180);
            const a1 = ((i + 1) * anguloPorSector - 90) * (Math.PI / 180);
            const x0 = 100 + 95 * Math.cos(a0), y0 = 100 + 95 * Math.sin(a0);
            const x1 = 100 + 95 * Math.cos(a1), y1 = 100 + 95 * Math.sin(a1);
            const grande = anguloPorSector > 180 ? 1 : 0;
            const amitad = (i * anguloPorSector + anguloPorSector / 2 - 90) * (Math.PI / 180);
            const tx = 100 + 62 * Math.cos(amitad), ty = 100 + 62 * Math.sin(amitad);
            return (
              <g key={c.id}>
                <path d={`M100,100 L${x0},${y0} A95,95 0 ${grande} 1 ${x1},${y1} Z`} fill={c.color} stroke="#1e1b30" strokeWidth="1.5" />
                <text x={tx} y={ty} fontSize="16" textAnchor="middle" dominantBaseline="middle">{c.emoji}</text>
              </g>
            );
          })}
          <circle cx="100" cy="100" r="16" fill="#1e1b30" />
        </svg>
      </div>

      {!categoriaElegida && (
        <button disabled={girando} onClick={girar} className="block mx-auto text-sm font-semibold px-6 py-2.5 rounded-full bg-violet-500 text-white disabled:opacity-60">
          {girando ? "Girando…" : "🎡 Girar la ruleta"}
        </button>
      )}

      {categoriaElegida && (
        <div className="max-w-sm mx-auto">
          <div className="text-center mb-3">
            <span className="text-xs font-bold px-3 py-1 rounded-full text-white" style={{ background: categoriaElegida.color }}>{categoriaElegida.emoji} {categoriaElegida.nombre}</span>
          </div>

          {cargandoPregunta ? (
            <div className="text-sm text-slate-400 text-center">Cargando pregunta…</div>
          ) : !pregunta ? (
            <div className="text-center">
              <p className="text-sm text-slate-400 mb-3">Todavía no hay preguntas cargadas en esta categoría.</p>
              <button onClick={() => setCategoriaElegida(null)} className="text-xs font-semibold text-violet-500">← Girar de nuevo</button>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-sm font-semibold text-slate-800 mb-3">{pregunta.pregunta}</p>
              <div className="space-y-1.5">
                {pregunta.opciones.map((o, i) => {
                  let estilo = "bg-white text-slate-600 border border-slate-200";
                  if (respondida) {
                    if (i === pregunta.correcta) estilo = "bg-emerald-500 text-white";
                    else if (i === respondida.opcion) estilo = "bg-rose-500 text-white";
                  }
                  return (
                    <button key={i} disabled={!!respondida} onClick={() => responder(i)} className={`w-full text-left text-sm px-3 py-2 rounded-lg ${estilo}`}>
                      {o}
                    </button>
                  );
                })}
              </div>

              {respondida && (
                <div className="mt-3 text-center">
                  {respondida.corona ? (
                    <p className="text-sm font-bold text-amber-500">👑 ¡Corona de {categoriaElegida.nombre}! +15 monedas extra</p>
                  ) : respondida.acierto ? (
                    <p className="text-sm font-semibold text-emerald-600">¡Correcto! +5 XP, +2 monedas</p>
                  ) : (
                    <p className="text-sm font-semibold text-rose-500">Fallaste — se corta la racha en esta categoría</p>
                  )}
                  <button onClick={() => { setCategoriaElegida(null); setPregunta(null); setRespondida(null); }} className="mt-2 text-xs font-semibold text-violet-500">Girar de nuevo →</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Vitrina de coronas */}
      <div className="mt-6 pt-4 border-t border-slate-100">
        <div className="text-xs font-semibold text-slate-600 mb-2">Tus coronas ({coronas.length}/{categorias.length})</div>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {categorias.map((c) => {
            const tiene = coronas.includes(c.id);
            return (
              <div key={c.id} className="rounded-xl p-2 text-center" style={{ background: tiene ? c.color : "#F1F5F9", opacity: tiene ? 1 : 0.5 }}>
                <div className="text-lg">{tiene ? "👑" : c.emoji}</div>
                <div className={`text-[9px] font-semibold truncate ${tiene ? "text-white" : "text-slate-400"}`}>{c.nombre}</div>
              </div>
            );
          })}
        </div>
        {coronas.length === categorias.length && categorias.length > 0 && (
          <p className="text-center text-xs font-bold text-amber-500 mt-3">🏆 ¡Completaste todas las coronas!</p>
        )}
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
  const [nuevosLogros, setNuevosLogros] = useState([]);
  const [equipados, setEquipados] = useState({ marco: null, titulo: null });

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
        if (info) {
          api.registrarAcceso(info.id);
          api.verificarYOtorgarLogros(info.id).then((nuevos) => { if (nuevos.length > 0) setNuevosLogros(nuevos); });
          api.fetchEquipadosEstudiante(info.id).then(setEquipados);
        }
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
      <div>
        {nuevosLogros.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setNuevosLogros((prev) => prev.slice(1))}>
            <div onClick={(e) => e.stopPropagation()} className="rounded-3xl p-6 text-center max-w-xs" style={{ background: "linear-gradient(160deg, #2d2450, #1e1b30)", border: "2px solid #F59E0B" }}>
              <div className="text-[11px] font-bold text-amber-300 uppercase tracking-widest mb-2">¡Nuevo logro desbloqueado!</div>
              <div className="text-6xl mb-2">{nuevosLogros[0].emoji}</div>
              <div className="text-lg font-bold text-white">{nuevosLogros[0].nombre}</div>
              {nuevosLogros[0].descripcion && <div className="text-xs text-violet-200 mt-1">{nuevosLogros[0].descripcion}</div>}
              <button onClick={() => setNuevosLogros((prev) => prev.slice(1))} className="mt-4 text-sm font-semibold px-5 py-2 rounded-full bg-amber-400 text-slate-900">
                {nuevosLogros.length > 1 ? `Genial (${nuevosLogros.length - 1} más)` : "¡Genial!"}
              </button>
            </div>
          </div>
        )}
        <MenuCodice activo={vista} onCambiar={setVista} monedas={datos.monedas} gradoId={datos.grado_id} />

        <div className="bg-white rounded-2xl shadow-lg p-6">
          {vista === "inicio" && (
            <>
              <div className="text-center mb-4">
                <div className="mx-auto mb-1.5 flex items-center justify-center rounded-full overflow-hidden" style={{ width: 56, height: 56, border: equipados.marco ? `4px solid ${equipados.marco.valor}` : "4px solid transparent", background: "#F5F3FF" }}>
                  {estudianteInfo?.foto_url ? (
                    <img src={estudianteInfo.foto_url} alt={datos.nombre} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">🎓</span>
                  )}
                </div>
                <div className="text-lg font-bold text-slate-800">{datos.nombre}</div>
                {equipados.titulo && <div className="text-[11px] font-semibold text-violet-500">✨ {equipados.titulo.valor}</div>}
                <div className="text-xs text-slate-400">Grado {datos.grado_id} · {datos.grupo}</div>
              </div>
              <ValorSemanaEstudiante />
              {estudianteInfo && <DesafioReinoEstudiante gradoId={estudianteInfo.grado_id} miReino={estudianteInfo.reino_actual || estudianteInfo.reino_original || "Sin grupo"} />}
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
            <>
              <MicroMisionesEstudiante estudianteId={estudianteInfo.id} onCambio={() => consultar()} />
              <EvaluacionesEstudiante estudianteId={estudianteInfo.id} gradoId={estudianteInfo.grado_id} />
            </>
          )}

          {vista === "proyectos" && estudianteInfo && (
            <ProyectosEstudiante estudianteId={estudianteInfo.id} gradoId={estudianteInfo.grado_id} />
          )}

          {vista === "forja" && estudianteInfo && (
            <ForjaEstudiante estudianteId={estudianteInfo.id} gradoId={estudianteInfo.grado_id} />
          )}

          {vista === "guias" && estudianteInfo && (
            <GuiasEstudiante gradoId={estudianteInfo.grado_id} />
          )}

          {vista === "codice" && estudianteInfo && (
            <CodiceEstudiante estudianteId={estudianteInfo.id} gradoId={estudianteInfo.grado_id} />
          )}

          {vista === "biblioteca" && estudianteInfo && (
            <BibliotecaEstudiante gradoId={estudianteInfo.grado_id} />
          )}

          {vista === "notas" && estudianteInfo && (
            <MisNotas estudianteId={estudianteInfo.id} />
          )}

          {vista === "recompensas" && estudianteInfo && (
            <BancoEstudiante estudianteId={estudianteInfo.id} monedas={datos.monedas} onMonedasActualizadas={() => consultar()} />
          )}

          {vista === "preguntados" && estudianteInfo && (
            <PreguntadosEstudiante estudianteId={estudianteInfo.id} />
          )}

          {vista === "album" && estudianteInfo && (
            <AlbumEstudiante estudianteId={estudianteInfo.id} monedas={datos.monedas} onMonedasActualizadas={() => consultar()} />
          )}

          {vista === "ranking" && estudianteInfo && (
            <RankingEstudiante estudianteId={estudianteInfo.id} gradoId={estudianteInfo.grado_id} />
          )}

          {vista === "salonhonor" && estudianteInfo && (
            <SalonHonorEstudiante estudianteId={estudianteInfo.id} />
          )}

          {vista === "perfil" && estudianteInfo && (
            <div>
              <h3 className="font-bold text-slate-800 mb-3">👤 Mi perfil</h3>
              <div className="space-y-2 text-sm mb-5">
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-400">Nombre</span><span className="font-semibold text-slate-700">{datos.nombre}</span></div>
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-400">Grado</span><span className="font-semibold text-slate-700">{datos.grado_id}</span></div>
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-400">Grupo</span><span className="font-semibold text-slate-700">{datos.grupo}</span></div>
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-400">Nivel</span><span className="font-semibold text-violet-600">{level.name}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">XP total</span><span className="font-semibold text-slate-700">{datos.xp}</span></div>
              </div>
              <LogrosEstudiante estudianteId={estudianteInfo.id} />
              <div className="mt-5 pt-4 border-t border-slate-100">
                <CosmeticosEstudiante estudianteId={estudianteInfo.id} monedas={datos.monedas} onMonedasActualizadas={() => consultar()} />
              </div>
              <HistorialEstudiante estudianteId={estudianteInfo.id} />
            </div>
          )}

          {vista === "mensajes" && estudianteInfo && (
            <AnunciosEstudiante gradoId={estudianteInfo.grado_id} />
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
  { key: "planeaciones", label: "Planeaciones", icono: "📝" },
  { key: "biblioteca", label: "Biblioteca", icono: "📚" },
  { key: "anotaciones", label: "Anotaciones", icono: "🗒️" },
  { key: "inclusion", label: "Inclusión", icono: "🧩" },
  { key: "bajasvida", label: "Bajas de Vida", icono: "📉" },
  { key: "corregirnombres", label: "Corregir Nombres", icono: "🪪" },
  { key: "direccioncurso", label: "Dirección de Curso", icono: "🎓" },
  { key: "guiasestudio", label: "Guías de Estudio", icono: "📘" },
  { key: "horario", label: "Agenda", icono: "🗓️" },
  { key: "herramientas", label: "Herramientas", icono: "🛠️" },
  { key: "roles", label: "Roles", icono: "🎭" },
  { key: "reportes", label: "Reportes", icono: "📊" },
];

function BuscadorEstudiantesGlobal({ onSeleccionar }) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) { setResultados([]); return; }
    setBuscando(true);
    const id = setTimeout(() => {
      api.buscarEstudiantesGlobal(query).then((r) => { setResultados(r); setBuscando(false); setAbierto(true); });
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  const elegir = (est) => {
    onSeleccionar(est);
    setQuery("");
    setResultados([]);
    setAbierto(false);
  };

  return (
    <div className="relative">
      <input value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => resultados.length && setAbierto(true)}
        placeholder="🔍 Buscar estudiante…"
        className="w-full text-xs rounded-full px-3 py-2 border border-slate-200 outline-none bg-slate-50 focus:bg-white" />
      {abierto && (query.trim().length >= 2) && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-100 max-h-64 overflow-y-auto" onMouseLeave={() => setAbierto(false)}>
          {buscando ? (
            <div className="text-xs text-slate-400 p-3">Buscando…</div>
          ) : resultados.length === 0 ? (
            <div className="text-xs text-slate-400 p-3">Sin resultados.</div>
          ) : (
            resultados.map((r) => (
              <button key={r.id} onClick={() => elegir(r)} className="w-full text-left px-3 py-2 text-xs hover:bg-violet-50 flex justify-between items-center">
                <span className="text-slate-700">{r.nombre}</span>
                <span className="text-slate-400">Grado {r.grado_id}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SidebarPanel({ activo, onCambiar, email, institucion, onAdmin, onInstitucion, onSalir, onBuscarEstudiante }) {
  const [menuAbierto, setMenuAbierto] = useState(false);

  const elegir = (key) => {
    onCambiar(key);
    setMenuAbierto(false);
  };

  return (
    <div className="md:sticky md:top-0 md:z-20" style={{ background: "linear-gradient(180deg, #1e1b30 0%, #14101f 100%)", borderBottom: "2px solid #8B5CF6" }}>
      {/* Fila superior: logo, buscador, accesos rápidos */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
        <button onClick={() => elegir("inicio")} className="flex items-center gap-2 shrink-0">
          {institucion?.imagen_menu_url ? (
            <img src={institucion.imagen_menu_url} alt="Logo" className="rounded-lg object-cover" style={{ width: 32, height: 32 }} />
          ) : (
            <span className="text-xl">🧭</span>
          )}
          <span className="text-violet-200 text-base font-bold tracking-[0.15em]" style={{ fontFamily: "Georgia, serif" }}>CÓDICE</span>
        </button>

        <div className="flex-1 min-w-[160px] max-w-md order-3 md:order-none">
          <BuscadorEstudiantesGlobal onSeleccionar={onBuscarEstudiante} />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button onClick={onAdmin} className="text-base" title="Docentes y mi cuenta">👤</button>
          <button onClick={onInstitucion} className="text-base" title="Institución">⚙️</button>
          <button onClick={onSalir} className="text-base hidden md:inline" title="Cerrar sesión">🚪</button>
          {/* Móvil: botón hamburguesa para desplegar el menú completo */}
          <button onClick={() => setMenuAbierto((v) => !v)} className="md:hidden text-violet-200 text-lg" title="Menú">
            {menuAbierto ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Escritorio: todas las opciones en fila, envolviendo si hace falta */}
      <div className="hidden md:flex flex-wrap gap-1 px-3 pb-2">
        {MENU_PANEL.map((m) => (
          <button key={m.key} onClick={() => elegir(m.key)}
            className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap flex items-center gap-1.5"
            style={{ background: activo === m.key ? "rgba(139,92,246,0.35)" : "transparent", color: activo === m.key ? "#EDE9FE" : "#A78BFA" }}>
            <span>{m.icono}</span> {m.label}
          </button>
        ))}
      </div>

      {/* Móvil: menú desplegable en grilla — nada queda fuera de pantalla */}
      {menuAbierto && (
        <div className="md:hidden px-3 pb-3 grid grid-cols-3 gap-1.5">
          {MENU_PANEL.map((m) => (
            <button key={m.key} onClick={() => elegir(m.key)}
              className="text-[11px] px-2 py-2.5 rounded-xl flex flex-col items-center gap-1"
              style={{ background: activo === m.key ? "rgba(139,92,246,0.35)" : "rgba(255,255,255,0.05)", color: activo === m.key ? "#EDE9FE" : "#A78BFA" }}>
              <span className="text-base">{m.icono}</span>
              <span className="text-center leading-tight">{m.label}</span>
            </button>
          ))}
          <button onClick={onSalir} className="text-[11px] px-2 py-2.5 rounded-xl flex flex-col items-center gap-1 text-rose-300" style={{ background: "rgba(255,255,255,0.05)" }}>
            <span className="text-base">🚪</span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      )}

      <div className="hidden md:block text-[10px] text-violet-400/60 px-4 pb-1.5 truncate">{email}</div>
    </div>
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
  const [destinoBusqueda, setDestinoBusqueda] = useState(null);

  const irACalificacionesDesdeBusqueda = (estudiante) => {
    setTab("calificaciones");
    setDestinoBusqueda({ estudianteId: estudiante.id, gradoId: estudiante.grado_id, ts: Date.now() });
  };

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
    <div className="min-h-screen bg-violet-50">
      <SidebarPanel activo={tab} onCambiar={irA} email={session.user.email} institucion={institucion}
        onAdmin={() => setAdministracionAbierta(true)} onInstitucion={() => setInstitucionAbierta(true)}
        onSalir={() => supabase.auth.signOut()} onBuscarEstudiante={irACalificacionesDesdeBusqueda} />

      {institucionAbierta && <InstitucionModal onClose={() => { setInstitucionAbierta(false); cargarInstitucion(); }} />}
      {administracionAbierta && <AdministracionModal onClose={() => setAdministracionAbierta(false)} />}

      <div className="p-6 max-w-6xl mx-auto">
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
              <button onClick={() => setSubTabHerramientas("accionesmasivas")} className={`text-xs px-3 py-1.5 rounded-full ${subTabHerramientas === "accionesmasivas" ? "bg-violet-500 text-white" : "text-slate-600"}`}>🎯 Acciones Masivas</button>
              <button onClick={() => setSubTabHerramientas("banco")} className={`text-xs px-3 py-1.5 rounded-full ${subTabHerramientas === "banco" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Banco</button>
              <button onClick={() => setSubTabHerramientas("album")} className={`text-xs px-3 py-1.5 rounded-full ${subTabHerramientas === "album" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Álbum</button>
              <button onClick={() => setSubTabHerramientas("anuncios")} className={`text-xs px-3 py-1.5 rounded-full ${subTabHerramientas === "anuncios" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Anuncios</button>
              <button onClick={() => setSubTabHerramientas("logros")} className={`text-xs px-3 py-1.5 rounded-full ${subTabHerramientas === "logros" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Logros</button>
              <button onClick={() => setSubTabHerramientas("salonhonor")} className={`text-xs px-3 py-1.5 rounded-full ${subTabHerramientas === "salonhonor" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Salón de Honor</button>
              <button onClick={() => setSubTabHerramientas("gamext")} className={`text-xs px-3 py-1.5 rounded-full ${subTabHerramientas === "gamext" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Desafíos/Misiones/Cosméticos</button>
              <button onClick={() => setSubTabHerramientas("consignas")} className={`text-xs px-3 py-1.5 rounded-full ${subTabHerramientas === "consignas" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Consignas del Códice</button>
              <button onClick={() => setSubTabHerramientas("trivia")} className={`text-xs px-3 py-1.5 rounded-full ${subTabHerramientas === "trivia" ? "bg-violet-500 text-white" : "text-slate-600"}`}>🎡 Preguntados</button>
              <button onClick={() => setSubTabHerramientas("bancopreguntas")} className={`text-xs px-3 py-1.5 rounded-full ${subTabHerramientas === "bancopreguntas" ? "bg-violet-500 text-white" : "text-slate-600"}`}>🗂️ Banco de Preguntas</button>
              <button onClick={() => setSubTabHerramientas("temporizador")} className={`text-xs px-3 py-1.5 rounded-full ${subTabHerramientas === "temporizador" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Temporizador</button>
              <button onClick={() => setSubTabHerramientas("otras")} className={`text-xs px-3 py-1.5 rounded-full ${subTabHerramientas === "otras" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Otras herramientas</button>
            </div>
            {subTabHerramientas === "ruleta" && <VistaRuleta grados={grados} />}
            {subTabHerramientas === "ruletamonedas" && <VistaRuletaMonedas grados={grados} />}
            {subTabHerramientas === "accionesmasivas" && <VistaAccionesMasivas grados={grados} />}
            {subTabHerramientas === "banco" && <VistaBanco />}
            {subTabHerramientas === "album" && <VistaAlbum />}
            {subTabHerramientas === "anuncios" && <VistaAnuncios grados={grados} />}
            {subTabHerramientas === "logros" && <VistaLogros />}
            {subTabHerramientas === "salonhonor" && <VistaSalonHonor />}
            {subTabHerramientas === "gamext" && <VistaGamificacionExtra grados={grados} />}
            {subTabHerramientas === "consignas" && <VistaConsignasCodice grados={grados} />}
            {subTabHerramientas === "trivia" && <VistaTriviaAdmin grados={grados} />}
            {subTabHerramientas === "bancopreguntas" && <VistaBancoPreguntas grados={grados} />}
            {subTabHerramientas === "temporizador" && <VistaTemporizador />}
            {subTabHerramientas === "otras" && <VistaHerramientas grados={grados} />}
          </>
        )}
        {tab === "roles" && <VistaRoles />}
        {tab === "calificaciones" && grados.length > 0 && <VistaCalificaciones grados={grados} destinoBusqueda={destinoBusqueda} />}
        {tab === "reportes" && grados.length > 0 && <VistaReportes grados={grados} />}
        {tab === "horario" && grados.length > 0 && <VistaHorario grados={grados} />}
        {tab === "planeaciones" && grados.length > 0 && <VistaPlaneaciones grados={grados} />}
        {tab === "biblioteca" && grados.length > 0 && <VistaBiblioteca grados={grados} />}
        {tab === "anotaciones" && <VistaAnotaciones />}
        {tab === "inclusion" && <VistaInclusionGeneral />}
        {tab === "bajasvida" && <VistaBajasVida />}
        {tab === "corregirnombres" && <VistaCorregirNombres />}
        {tab === "direccioncurso" && <VistaDireccionCurso grados={grados} />}
        {tab === "guiasestudio" && <VistaGuiasEstudio grados={grados} />}
        {tab === "evaluaciones" && grados.length > 0 && <VistaEvaluaciones grados={grados} />}
        {tab === "proyectosforja" && grados.length > 0 && <VistaProyectosForja grados={grados} />}
      </div>
    </div>
  );
}
