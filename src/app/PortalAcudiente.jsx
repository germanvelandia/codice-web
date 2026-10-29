import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { Centered, FondoCastillo } from "./comunes";

// Portal de Acudientes — entra con número de documento de identidad
// (que hace de clave la primera vez) y correo NO hace falta ni se usa
// para el ingreso — evita el límite de envío de correos de Supabase.
// Al entrar la primera vez, se exige elegir una clave propia, que
// reemplaza al documento de ahí en adelante. Solo lectura: notas,
// asistencia, anuncios, y anotaciones de convivencia completas. NO ve
// el proceso PIAR/DUA, ni nada de gestión de aula.
export function PortalAcudiente({ onElegirEstudiante }) {
  const [documento, setDocumento] = useState("");
  const [rol, setRol] = useState(null);
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const [necesitaCambiarClave, setNecesitaCambiarClave] = useState(false);
  const [nuevaClave, setNuevaClave] = useState("");
  const [nuevaClave2, setNuevaClave2] = useState("");
  const [cambiandoClave, setCambiandoClave] = useState(false);

  const [hijos, setHijos] = useState(null);
  const [hijoElegidoId, setHijoElegidoId] = useState(null);
  const [vista, setVista] = useState("notas");
  const [materiaAbierta, setMateriaAbierta] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [anuncios, setAnuncios] = useState([]);

  const ingresar = async () => {
    if (!documento.trim() || !clave.trim()) { setError("Completá documento y clave."); return; }
    setCargando(true);
    setError("");
    try {
      const r = await api.iniciarSesionAcudientePorDocumento(documento, clave);
      if (!r.ok) { setError(r.error); setCargando(false); return; }
      setRol(r.rol);
      if (r.necesitaCambiarClave) {
        setNecesitaCambiarClave(true);
      } else {
        setHijos(r.estudiantes);
        if (r.estudiantes[0]) setHijoElegidoId(r.estudiantes[0].id);
      }
    } catch (e) {
      setError(e.message);
    }
    setCargando(false);
  };

  const guardarNuevaClave = async () => {
    if (nuevaClave.trim().length < 4) { setError("La clave nueva debe tener al menos 4 caracteres."); return; }
    if (nuevaClave !== nuevaClave2) { setError("Las dos claves no coinciden."); return; }
    setCambiandoClave(true);
    setError("");
    try {
      await api.cambiarClaveAcudiente(documento, rol, nuevaClave);
      const r = await api.iniciarSesionAcudientePorDocumento(documento, nuevaClave);
      setHijos(r.estudiantes);
      if (r.estudiantes[0]) setHijoElegidoId(r.estudiantes[0].id);
      setNecesitaCambiarClave(false);
    } catch (e) {
      setError(e.message);
    }
    setCambiandoClave(false);
  };

  useEffect(() => {
    if (!hijoElegidoId) return;
    setResumen(null);
    api.fetchResumenParaAcudiente(hijoElegidoId).then(setResumen);
    api.fetchAnunciosParaAcudiente(hijos?.find((h) => h.id === hijoElegidoId)?.grado_id).then(setAnuncios);
  }, [hijoElegidoId]);

  const hijoElegido = hijos?.find((h) => h.id === hijoElegidoId);

  // Pantalla 1: pedir documento + clave (o el documento como clave inicial)
  if (!hijos && !necesitaCambiarClave) {
    return (
      <div className="min-h-screen flex items-center justify-center relative py-6">
        <FondoCastillo />
        <div className="w-full max-w-sm px-4">
          {onElegirEstudiante && (
            <div className="flex gap-1 rounded-full bg-slate-100 p-1 mb-5">
              <button onClick={onElegirEstudiante} className="flex-1 text-xs font-semibold py-2 rounded-full text-slate-500">🎓 Soy estudiante</button>
              <button className="flex-1 text-xs font-semibold py-2 rounded-full bg-white shadow-sm">👪 Soy acudiente</button>
            </div>
          )}
          <div className="text-center mb-5">
            <div className="text-4xl mb-1">👪</div>
            <h1 className="text-2xl font-bold" style={{ color: "#17264D", fontFamily: "Georgia, serif" }}>Portal de Acudientes</h1>
            <p className="text-slate-400 text-xs mt-1">Seguimiento del progreso de tu hijo/a en CÓDICE</p>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <label className="text-xs text-slate-500 block mb-1">Número de documento de identidad</label>
            <input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="Ej: 123456789"
              className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />
            <label className="text-xs text-slate-500 block mb-1">Clave</label>
            <input type="password" value={clave} onChange={(e) => setClave(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") ingresar(); }}
              placeholder="La primera vez, usá tu documento"
              className="w-full text-sm rounded-lg px-3 py-2 mb-1 border border-slate-200 outline-none" />
            <p className="text-[11px] text-slate-400 mb-3">¿Primera vez? Escribí tu número de documento también en la clave — después vas a poder elegir una propia.</p>
            {error && <p className="text-xs text-rose-500 mb-2">{error}</p>}
            <button disabled={cargando} onClick={ingresar} className="w-full text-sm font-semibold py-2.5 rounded-lg text-white disabled:opacity-60" style={{ background: "#2F55A4" }}>
              {cargando ? "…" : "Ingresar"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla 2: primera vez — obligado a elegir una clave propia
  if (necesitaCambiarClave) {
    return (
      <div className="min-h-screen flex items-center justify-center relative py-6">
        <FondoCastillo />
        <div className="w-full max-w-sm px-4">
          <div className="text-center mb-5">
            <div className="text-4xl mb-1">🔐</div>
            <h1 className="text-xl font-bold" style={{ color: "#17264D", fontFamily: "Georgia, serif" }}>Elegí tu clave</h1>
            <p className="text-slate-400 text-xs mt-1">Por seguridad, reemplazá el documento por una clave propia que solo vos conozcas.</p>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <label className="text-xs text-slate-500 block mb-1">Clave nueva</label>
            <input type="password" value={nuevaClave} onChange={(e) => setNuevaClave(e.target.value)}
              className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />
            <label className="text-xs text-slate-500 block mb-1">Repetí la clave nueva</label>
            <input type="password" value={nuevaClave2} onChange={(e) => setNuevaClave2(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") guardarNuevaClave(); }}
              className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />
            {error && <p className="text-xs text-rose-500 mb-2">{error}</p>}
            <button disabled={cambiandoClave} onClick={guardarNuevaClave} className="w-full text-sm font-semibold py-2.5 rounded-lg text-white disabled:opacity-60" style={{ background: "#2F55A4" }}>
              {cambiandoClave ? "…" : "Guardar y entrar"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (hijos === null) return <Centered>Cargando…</Centered>;

  return (
    <div className="min-h-screen" style={{ background: "#FBFBFD" }}>
      <div className="px-4 md:px-8 py-4" style={{ background: "#17264D" }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">👪</span>
            <span className="text-white font-bold text-sm tracking-wide">Portal de Acudientes</span>
          </div>
          <div className="flex items-center gap-3">
            {hijos.length > 1 && (
              <select value={hijoElegidoId} onChange={(e) => setHijoElegidoId(parseInt(e.target.value, 10))} className="text-xs rounded-full px-3 py-1.5 border-none outline-none">
                {hijos.map((h) => <option key={h.id} value={h.id}>{h.nombre}</option>)}
              </select>
            )}
            <button onClick={() => { setHijos(null); setDocumento(""); setClave(""); }} className="text-white text-xs underline">Cerrar sesión</button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-6">
        {hijoElegido && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden shrink-0" style={{ background: "#E8EEF8" }}>
              {api.urlFotoEstudiante(hijoElegido) ? <img src={api.urlFotoEstudiante(hijoElegido)} alt={hijoElegido.nombre} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">🎓</div>}
            </div>
            <div>
              <div className="font-bold text-slate-800">{hijoElegido.nombre}</div>
              <div className="text-xs text-slate-400">Grado {hijoElegido.grado_id}</div>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            { key: "notas", label: "📖 Notas" },
            { key: "asistencia", label: "📋 Asistencia" },
            { key: "anuncios", label: "📣 Anuncios" },
            { key: "convivencia", label: "🗒️ Convivencia" },
          ].map((t) => (
            <button key={t.key} onClick={() => setVista(t.key)}
              className={`text-xs font-semibold px-3 py-2 rounded-full ${vista === t.key ? "text-white" : "bg-white text-slate-600 border border-slate-200"}`}
              style={vista === t.key ? { background: "#2F55A4" } : undefined}>
              {t.label}
            </button>
          ))}
        </div>

        {!resumen ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-5">
            {vista === "notas" && (
              resumen.materias.length === 0 ? (
                <p className="text-sm text-slate-400">Todavía no hay notas registradas.</p>
              ) : (
                <div className="space-y-2">
                  {resumen.materias.map((m) => {
                    const abierta = materiaAbierta === m.id;
                    return (
                      <div key={m.id} className="bg-slate-50 rounded-xl p-3">
                        <button onClick={() => setMateriaAbierta(abierta ? null : m.id)} className="w-full text-left">
                          <div className="text-sm font-semibold text-slate-800">{m.nombre}</div>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {resumen.periodos.map((p) => {
                              const celda = resumen.notasPorMateriaPeriodo[m.id]?.[p];
                              return (
                                <span key={p} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${celda?.enCurso ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700"}`}>
                                  P{p}: {celda && celda.nota !== null && celda.nota !== undefined ? Number(celda.nota).toFixed(1) : "—"}{celda?.enCurso && "*"}
                                </span>
                              );
                            })}
                          </div>
                        </button>

                        {abierta && (
                          <div className="mt-2 pt-2 border-t border-slate-200 space-y-2">
                            {resumen.periodos.map((p) => {
                              const celda = resumen.notasPorMateriaPeriodo[m.id]?.[p];
                              if (!celda) return null;
                              return (
                                <div key={p}>
                                  <div className="text-xs font-semibold text-slate-600">
                                    Periodo {p} — <span>{celda.nota !== null && celda.nota !== undefined ? Number(celda.nota).toFixed(1) : "—"}</span>
                                    {celda.enCurso && <span className="text-amber-600 font-normal"> · En curso (provisional)</span>}
                                  </div>
                                  {celda.enCurso && (
                                    celda.actividades.length > 0 ? (
                                      <div className="ml-2 mt-1 space-y-0.5">
                                        {celda.actividades.map((a) => (
                                          <div key={a.id}>
                                            <div className="text-[11px] text-slate-500 flex justify-between gap-2">
                                              <span>{a.notas_actividades?.nombre}{a.notas_actividades?.notas_categorias?.nombre ? ` (${a.notas_actividades.notas_categorias.nombre})` : ""}</span>
                                              <span className="font-semibold shrink-0">{a.valor}</span>
                                            </div>
                                            {a.observacion && (
                                              <div className="text-[10px] text-violet-600 italic bg-violet-50 rounded-lg px-2 py-1 mt-0.5">📝 {a.observacion}</div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-[11px] text-slate-400 ml-2 mt-0.5">Sin actividades individuales cargadas para este periodo.</p>
                                    )
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-[11px] text-amber-600 mt-1">* Nota en curso — el periodo todavía no cerró, se va actualizando con cada actividad nueva. Tocá una materia para ver el detalle.</p>
                </div>
              )
            )}

            {vista === "asistencia" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-emerald-50 rounded-xl p-3 text-center"><div className="text-lg font-bold text-emerald-600">{resumen.asistencia.P}</div><div className="text-[10px] text-slate-500">Presentes</div></div>
                <div className="bg-amber-50 rounded-xl p-3 text-center"><div className="text-lg font-bold text-amber-600">{resumen.asistencia.R}</div><div className="text-[10px] text-slate-500">Retardos</div></div>
                <div className="bg-rose-50 rounded-xl p-3 text-center"><div className="text-lg font-bold text-rose-600">{resumen.asistencia.FI}</div><div className="text-[10px] text-slate-500">Faltas injustificadas</div></div>
                <div className="bg-slate-50 rounded-xl p-3 text-center"><div className="text-lg font-bold text-slate-600">{resumen.asistencia.FJ}</div><div className="text-[10px] text-slate-500">Faltas justificadas</div></div>
                {resumen.asistencia.pct !== null && <div className="col-span-2 sm:col-span-4 text-center text-sm text-slate-500 mt-1">% de asistencia: <b className="text-slate-800">{resumen.asistencia.pct}%</b></div>}
              </div>
            )}

            {vista === "anuncios" && (
              anuncios.length === 0 ? <p className="text-sm text-slate-400">No hay anuncios todavía.</p> : (
                <div className="space-y-2">
                  {anuncios.map((a) => (
                    <div key={a.id} className="bg-slate-50 rounded-xl p-3">
                      <div className="text-xs font-bold text-slate-700">{a.titulo}</div>
                      <div className="text-xs text-slate-500 mt-1">{a.contenido}</div>
                    </div>
                  ))}
                </div>
              )
            )}

            {vista === "convivencia" && (
              resumen.anotaciones.length === 0 ? <p className="text-sm text-slate-400">No hay anotaciones registradas.</p> : (
                <div className="space-y-2">
                  {resumen.anotaciones.map((a) => (
                    <div key={a.id} className="bg-slate-50 rounded-xl p-3">
                      <div className="text-[10px] text-slate-400">{a.fecha} · {a.categoria === "academico" ? "📘 Académico" : "🤝 Convivencial"}</div>
                      <div className="text-sm text-slate-700 mt-1 whitespace-pre-line">{a.contenido}</div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
