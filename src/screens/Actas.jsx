import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import * as api from "../lib/api";
import { FALTAS_MANUAL, NIVELACION_COMPROMISOS_DEFAULT } from "../lib/actasTemplates";
import { inicialesConPuntos, documentoEnmascarado } from "../lib/gamification";

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

export function ActasModal({ estudiante, onClose }) {
  const [actas, setActas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [actaImprimir, setActaImprimir] = useState(null);
  const [institucion, setInstitucion] = useState({ nombre: "Institución Educativa", ciclo: "", anio: "", logo_url: null });

  const cargar = async () => {
    setCargando(true);
    const data = await api.fetchActasPorEstudiante(estudiante.id);
    setActas(data);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, [estudiante.id]);
  useEffect(() => { api.fetchInstitucion().then(setInstitucion); }, []);

  useEffect(() => {
    if (!actaImprimir) return;
    const id = setTimeout(() => window.print(), 150);
    const onAfter = () => setActaImprimir(null);
    window.addEventListener("afterprint", onAfter);
    return () => { clearTimeout(id); window.removeEventListener("afterprint", onAfter); };
  }, [actaImprimir]);

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar esta acta?")) return;
    await api.eliminarActa(id);
    cargar();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 no-print" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">Actas de Seguimiento — {estudiante.nombre}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        {!formAbierto ? (
          <button onClick={() => setFormAbierto(true)} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white mb-4">
            + Nueva acta
          </button>
        ) : (
          <NuevaActaForm estudianteId={estudiante.id} onCancelar={() => setFormAbierto(false)} onGuardada={() => { setFormAbierto(false); cargar(); }} />
        )}

        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : actas.length === 0 ? (
          <div className="text-sm text-slate-400">Este estudiante no tiene actas registradas todavía.</div>
        ) : (
          <div className="space-y-3">
            {actas.map((a) => (
              <div key={a.id} className="border border-slate-100 rounded-xl p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      {a.tipo} · {a.fecha}
                      {a.estado && a.tipo === "Nivelación" && (
                        <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full ${
                          a.estado === "superado" ? "bg-emerald-100 text-emerald-700" :
                          a.estado === "en_proceso" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                        }`}>
                          {a.estado === "superado" ? "Superado" : a.estado === "en_proceso" ? "En proceso" : "Pendiente"}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{a.motivo}</div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setActaImprimir(a)} className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600">🖨️ Imprimir / PDF</button>
                    <button onClick={() => eliminar(a.id)} className="text-xs text-slate-400 hover:text-rose-500">✕</button>
                  </div>
                </div>
                {a.descripcion && <p className="text-xs text-slate-600 mt-2">{a.descripcion}</p>}
                {a.tipo_falta && (
                  <div className="text-xs text-amber-600 mt-2">Falta {a.tipo_falta} ({a.articulo}) · Plazo: {a.plazo_dias} días hábiles</div>
                )}
                {a.implicaciones_legales && (
                  <div className="text-xs text-slate-600 mt-2 bg-amber-50 rounded-lg p-2"><b>Implicaciones legales:</b> {a.implicaciones_legales}</div>
                )}
                {a.compromisos_academicos && (
                  <div className="text-xs text-slate-600 mt-2"><b>Compromisos académicos:</b> {a.compromisos_academicos}</div>
                )}
                {a.compromisos_convivenciales && (
                  <div className="text-xs text-slate-600 mt-2"><b>Compromisos convivenciales:</b> {a.compromisos_convivenciales}</div>
                )}
                {a.compromisos && (
                  <div className="text-xs text-slate-600 mt-2"><b>Compromisos:</b> {a.compromisos}</div>
                )}
                {a.asistencia_resumen && (
                  <div className="text-xs text-slate-500 mt-2">
                    Asistencia: P:{a.asistencia_resumen.P} R:{a.asistencia_resumen.R} FI:{a.asistencia_resumen.FI} FJ:{a.asistencia_resumen.FJ} ({a.asistencia_resumen.pct}%)
                  </div>
                )}
                <div className="text-[10px] text-slate-400 mt-2">Registrado por: {a.profesores?.nombre || "—"}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {actaImprimir && <ActaPrintView estudiante={estudiante} acta={actaImprimir} institucion={institucion} actasRelacionadas={actas} />}
    </div>
  );
}

function seccion(titulo, contenido, opts = {}) {
  return (
    <div className="print-avoid-break" style={{ marginBottom: 16, background: opts.bg || "transparent", padding: opts.bg ? 12 : 0, borderRadius: opts.bg ? 6 : 0, borderLeft: opts.accent ? `3px solid ${opts.accent}` : "none" }}>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6, color: opts.accent || "#1e293b" }}>{titulo}</div>
      <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-line" }}>{contenido}</div>
    </div>
  );
}

function ActaPrintView({ estudiante, acta, institucion, actasRelacionadas }) {
  const a = acta;
  const [asistenciaLive, setAsistenciaLive] = useState(null);

  // Si el acta no guardó un sustento de asistencia propio, se trae un consolidado
  // actual (todas las materias, todos los docentes) para dejarlo por escrito igual.
  useEffect(() => {
    if (!a.asistencia_resumen) {
      api.fetchAsistenciaConsolidadaEstudiante(estudiante.id).then(setAsistenciaLive).catch(() => {});
    }
  }, [estudiante.id, a.id]);

  const seguimientos = (actasRelacionadas || [])
    .filter((r) => r.id !== a.id)
    .sort((x, y) => (x.fecha < y.fecha ? 1 : -1))
    .slice(0, 4);

  const folio = `CD-${String(a.id).padStart(5, "0")}`;

  const contenido = (
    <div
      className="print-only"
      style={{
        maxWidth: "180mm",
        margin: "0 auto",
        padding: "0 0 14mm 0",
        fontFamily: "'Georgia', 'Times New Roman', serif",
        color: "#1e293b",
      }}
    >
      {/* Encabezado institucional */}
      <div className="print-avoid-break" style={{ textAlign: "center", marginBottom: 18, borderBottom: "2px solid #8B5CF6", paddingBottom: 10 }}>
        {institucion.logo_url && (
          <img src={institucion.logo_url} alt="Logo" style={{ maxHeight: 64, marginBottom: 8, display: "block", marginLeft: "auto", marginRight: "auto" }} />
        )}
        <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: 0.3 }}>{institucion.nombre}</div>
        {(institucion.ciclo || institucion.anio) && (
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            {institucion.ciclo}{institucion.ciclo && institucion.anio ? " — " : ""}{institucion.anio}
          </div>
        )}
        <div style={{ fontSize: 15, marginTop: 8, fontStyle: "italic" }}>Acta de Seguimiento — {a.tipo}</div>
        <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 3 }}>Folio {folio}</div>
      </div>

      {/* Datos generales */}
      <table className="print-avoid-break" style={{ width: "100%", fontSize: 12.5, marginBottom: 18, borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={{ padding: "3px 6px 3px 0", fontWeight: 700, width: 110 }}>Estudiante:</td><td style={{ padding: "3px 0" }}>{inicialesConPuntos(estudiante.nombre)}</td>
            <td style={{ padding: "3px 6px 3px 24px", fontWeight: 700, width: 70 }}>Grado:</td><td style={{ padding: "3px 0" }}>{estudiante.grado_id}</td>
          </tr>
          <tr>
            <td style={{ padding: "3px 6px 3px 0", fontWeight: 700 }}>Documento:</td><td style={{ padding: "3px 0" }}>{documentoEnmascarado(estudiante.documento) || "No registrado"}</td>
            <td style={{ padding: "3px 6px 3px 24px", fontWeight: 700 }}>Grupo:</td><td style={{ padding: "3px 0" }}>{estudiante.reino_actual || estudiante.reino_original || "—"}</td>
          </tr>
          <tr>
            <td style={{ padding: "3px 6px 3px 0", fontWeight: 700 }}>Fecha:</td><td style={{ padding: "3px 0" }}>{a.fecha}</td>
            {(estudiante.piar || estudiante.dua) && (
              <>
                <td style={{ padding: "3px 6px 3px 24px", fontWeight: 700 }}>Inclusión:</td>
                <td style={{ padding: "3px 0" }}>{[estudiante.piar && "PIAR", estudiante.dua && "DUA"].filter(Boolean).join(" · ")}</td>
              </>
            )}
          </tr>
          {a.estado && a.tipo === "Nivelación" && (
            <tr>
              <td style={{ padding: "3px 6px 3px 0", fontWeight: 700 }}>Estado:</td>
              <td colSpan={3} style={{ padding: "3px 0" }}>
                {a.estado === "superado" ? "Superado" : a.estado === "en_proceso" ? "En proceso" : "Pendiente"}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {seccion("Motivo", a.motivo)}
      {a.descripcion && seccion("Observaciones / descripción de la situación", a.descripcion)}

      {/* Aspecto académico — siempre visible, con lo que haya registrado en esta acta */}
      {seccion(
        "Aspecto académico",
        a.compromisos_academicos || "Sin observaciones académicas registradas en esta acta.",
        { bg: "#F5F3FF", accent: "#7C3AED" }
      )}

      {/* Aspecto convivencial — siempre visible, con lo que haya registrado en esta acta */}
      {seccion(
        a.tipo_falta ? `Aspecto convivencial — Falta ${a.tipo_falta} (${a.articulo})` : "Aspecto convivencial",
        (a.tipo_falta ? `Plazo de respuesta: ${a.plazo_dias} días hábiles.\n\n` : "") +
          (a.compromisos_convivenciales || "Sin observaciones convivenciales registradas en esta acta."),
        { bg: "#FFF3F8", accent: "#DB2777" }
      )}

      {a.implicaciones_legales && seccion("Implicaciones legales", a.implicaciones_legales, { bg: "#FEF3C7", accent: "#B45309" })}

      {a.compromisos && seccion("Compromisos", a.compromisos)}

      {/* Asistencia */}
      {a.asistencia_resumen ? (
        seccion(
          "Asistencia (sustento registrado con el acta)",
          `Presentes: ${a.asistencia_resumen.P} · Retardos: ${a.asistencia_resumen.R} · Faltas injustificadas: ${a.asistencia_resumen.FI} · Faltas justificadas: ${a.asistencia_resumen.FJ} · % Asistencia: ${a.asistencia_resumen.pct ?? "—"}%`,
          { bg: "#EFF6FF", accent: "#2563EB" }
        )
      ) : asistenciaLive ? (
        seccion(
          "Asistencia (consolidado actual, todas las materias)",
          `Presentes: ${asistenciaLive.general.P} · Retardos: ${asistenciaLive.general.R} · Faltas injustificadas: ${asistenciaLive.general.FI} · Faltas justificadas: ${asistenciaLive.general.FJ}`,
          { bg: "#EFF6FF", accent: "#2563EB" }
        )
      ) : null}

      {/* Seguimientos relacionados */}
      {seguimientos.length > 0 && (
        <div className="print-avoid-break" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 }}>Seguimientos anteriores del estudiante</div>
          <table style={{ width: "100%", fontSize: 11.5, borderCollapse: "collapse" }}>
            <tbody>
              {seguimientos.map((s) => (
                <tr key={s.id} style={{ borderTop: "1px solid #E2E8F0" }}>
                  <td style={{ padding: "4px 6px 4px 0", whiteSpace: "nowrap" }}>{s.fecha}</td>
                  <td style={{ padding: "4px 6px", whiteSpace: "nowrap", fontWeight: 700 }}>{s.tipo}</td>
                  <td style={{ padding: "4px 0", color: "#475569" }}>{s.motivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Firmas */}
      <div className="print-avoid-break" style={{ marginTop: 46, display: "flex", justifyContent: "space-between" }}>
        {["Docente", "Estudiante", "Acudiente"].map((f) => (
          <div key={f} style={{ textAlign: "center", width: "30%" }}>
            <div style={{ borderTop: "1px solid #1e293b", marginBottom: 4 }} />
            <div style={{ fontSize: 11 }}>{f}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, fontSize: 9.5, color: "#64748b", textAlign: "right" }}>
        Registrado por: {a.profesores?.nombre || "—"} · Generado el {new Date().toLocaleDateString("es-CO")}
      </div>

      {/* Pie de página repetido en cada hoja (abajo a la izquierda) */}
      <div className="print-footer">
        {institucion.nombre} · Folio {folio} · {inicialesConPuntos(estudiante.nombre)} · Generado {new Date().toLocaleDateString("es-CO")}
      </div>
    </div>
  );

  // Se renderiza directamente sobre <body> (fuera del modal) para que la
  // impresión no herede el centrado/flex del overlay y la hoja quede completa.
  return createPortal(contenido, document.body);
}

// Convierte los 3 comportamientos predefinidos (leve/grave/gravísima) al mismo
// formato que los que el docente cree en el catálogo, para poder mezclarlos en una sola lista.
const CONVIVENCIALES_BASE = Object.entries(FALTAS_MANUAL).map(([key, f]) => ({
  id: `base-${key}`, nombre: f.tipo, articulo: f.articulo, plazo_dias: f.plazoDias,
  implicaciones_legales: f.implicaciones, esBase: true,
}));

const ACADEMICOS_BASE = [
  { id: "base-nivelacion", nombre: "Recuperación estándar", plantilla: NIVELACION_COMPROMISOS_DEFAULT, esBase: true },
];

function SelectorComportamiento({ categoria, valorId, onSeleccionar, onUsarPlantilla }) {
  const base = categoria === "convivencial" ? CONVIVENCIALES_BASE : ACADEMICOS_BASE;
  const [personalizados, setPersonalizados] = useState([]);
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [articulo, setArticulo] = useState("");
  const [plazoDias, setPlazoDias] = useState("");
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = () => api.fetchComportamientos(categoria).then((data) => setPersonalizados(data));
  useEffect(() => { cargar(); }, [categoria]);

  const opciones = [...base, ...personalizados];

  const crear = async () => {
    if (!nombre.trim()) return;
    setGuardando(true);
    try {
      const campos = categoria === "convivencial"
        ? { categoria, nombre: nombre.trim(), articulo: articulo.trim() || null, plazo_dias: plazoDias ? parseInt(plazoDias, 10) : null, implicaciones_legales: texto.trim() || null }
        : { categoria, nombre: nombre.trim(), plantilla: texto.trim() || null };
      const nuevo = await api.crearComportamiento(campos);
      await cargar();
      onSeleccionar(nuevo);
      setCreando(false);
      setNombre(""); setArticulo(""); setPlazoDias(""); setTexto("");
    } catch (e) {
      alert("Error al crear: " + e.message);
    }
    setGuardando(false);
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar este comportamiento del catálogo? No afecta las actas ya creadas con él.")) return;
    await api.eliminarComportamiento(id);
    cargar();
  };

  return (
    <div className="mb-2">
      <div className="flex flex-wrap gap-1.5 mb-2">
        {opciones.map((o) => (
          <div key={o.id} className="relative group">
            <button onClick={() => onSeleccionar(o)}
              className={`text-xs px-3 py-1.5 rounded-full ${valorId === o.id ? "bg-violet-500 text-white" : "bg-white text-slate-600 border border-slate-200"}`}>
              {o.nombre}{o.articulo ? ` (${o.articulo})` : ""}
            </button>
            {!o.esBase && (
              <button onClick={() => eliminar(o.id)} title="Eliminar del catálogo"
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-400 text-white text-[9px] leading-4 opacity-0 group-hover:opacity-100">✕</button>
            )}
          </div>
        ))}
        <button onClick={() => setCreando((v) => !v)} className="text-xs px-3 py-1.5 rounded-full border border-dashed border-violet-300 text-violet-600">
          + Nuevo
        </button>
      </div>

      {creando && (
        <div className="bg-white border border-violet-200 rounded-lg p-3 mb-2 space-y-2">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={categoria === "convivencial" ? "Nombre del comportamiento (ej: Uso de celular en clase)" : "Nombre de la plantilla (ej: Plan de lectura crítica)"}
            className="w-full text-xs rounded-lg px-3 py-2 border border-slate-200 outline-none" />
          {categoria === "convivencial" && (
            <div className="flex gap-2">
              <input value={articulo} onChange={(e) => setArticulo(e.target.value)} placeholder="Artículo (opcional, ej: Art. 71)"
                className="flex-1 text-xs rounded-lg px-3 py-2 border border-slate-200 outline-none" />
              <input value={plazoDias} onChange={(e) => setPlazoDias(e.target.value)} type="number" placeholder="Plazo (días)"
                className="w-28 text-xs rounded-lg px-3 py-2 border border-slate-200 outline-none" />
            </div>
          )}
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3}
            placeholder={categoria === "convivencial" ? "Implicaciones legales de este comportamiento…" : "Plan / compromisos de esta plantilla académica…"}
            className="w-full text-xs rounded-lg px-3 py-2 border border-slate-200 outline-none" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreando(false)} className="text-xs text-slate-500 px-2 py-1.5">Cancelar</button>
            <button disabled={guardando} onClick={crear} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
              {guardando ? "Guardando…" : "Agregar al catálogo y usar"}
            </button>
          </div>
        </div>
      )}

      {categoria === "academico" && valorId && (
        <button onClick={() => onUsarPlantilla(opciones.find((o) => o.id === valorId)?.plantilla || "")}
          className="text-xs px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 mb-2">
          ⤵️ Insertar esta plantilla en el texto de abajo
        </button>
      )}
    </div>
  );
}

function NuevaActaForm({ estudianteId, onCancelar, onGuardada }) {
  const [tipo, setTipo] = useState("Convivencial");
  const [fecha, setFecha] = useState(hoyISO());
  const [motivo, setMotivo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [compromisosAcademicos, setCompromisosAcademicos] = useState("");
  const [compromisosConvivenciales, setCompromisosConvivenciales] = useState("");
  const [comportamientoConv, setComportamientoConv] = useState(null);
  const [comportamientoAcad, setComportamientoAcad] = useState(null);
  const [implicaciones, setImplicaciones] = useState("");
  const [reincidente, setReincidente] = useState(false);
  const [incluirAsistencia, setIncluirAsistencia] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const seleccionarConv = (o) => { setComportamientoConv(o); setImplicaciones(o.implicaciones_legales || ""); };
  const seleccionarAcad = (o) => { setComportamientoAcad(o); if (!compromisosAcademicos.trim()) setCompromisosAcademicos(o.plantilla || ""); };

  const guardar = async () => {
    if (!motivo.trim()) { alert("Escribe al menos el motivo."); return; }
    if (tipo === "Convivencial" && !comportamientoConv) { alert("Elige o crea un comportamiento del catálogo."); return; }
    setGuardando(true);
    try {
      const campos = {
        tipo, fecha, motivo: motivo.trim(), descripcion: descripcion.trim() || null,
        compromisos_academicos: compromisosAcademicos.trim() || null,
        compromisos_convivenciales: compromisosConvivenciales.trim() || null,
      };
      if (tipo === "Convivencial") {
        campos.categoria_falta = comportamientoConv.id;
        campos.tipo_falta = (reincidente ? "Reincidente / " : "") + comportamientoConv.nombre;
        campos.articulo = comportamientoConv.articulo || null;
        campos.plazo_dias = comportamientoConv.plazo_dias || null;
        campos.implicaciones_legales = implicaciones.trim() || comportamientoConv.implicaciones_legales || null;
      }
      if (incluirAsistencia) {
        campos.asistencia_resumen = await api.fetchEstadisticasAsistencia(estudianteId);
      }
      await api.crearActa(estudianteId, campos);
      onGuardada();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-xl p-4 mb-4">
      <div className="flex gap-1 mb-3 rounded-full bg-white p-1 w-fit">
        {["Convivencial", "Académico", "Nivelación"].map((t) => (
          <button key={t} onClick={() => setTipo(t)} className={`text-xs px-3 py-1.5 rounded-full ${tipo === t ? "bg-violet-500 text-white" : "text-slate-600"}`}>{t}</button>
        ))}
      </div>

      {tipo === "Nivelación" && (
        <p className="text-xs text-violet-700 bg-violet-100 rounded-lg px-3 py-2 mb-3">
          Para estudiantes con pérdida de materia — el acta se enfocará en <b>compromisos académicos</b> para su recuperación.
        </p>
      )}

      {tipo === "Convivencial" && (
        <div className="mb-3">
          <label className="text-xs text-slate-500 block mb-1">Comportamiento (catálogo del Manual de Convivencia — puedes agregar los que necesites)</label>
          <SelectorComportamiento categoria="convivencial" valorId={comportamientoConv?.id} onSeleccionar={seleccionarConv} />
          <label className="flex items-center gap-2 text-xs text-slate-600 mt-1">
            <input type="checkbox" checked={reincidente} onChange={(e) => setReincidente(e.target.checked)} />
            Es un comportamiento constante / reincidente
          </label>
          {comportamientoConv && (
            <div className="mt-3">
              <label className="text-xs text-slate-500 block mb-1">Implicaciones legales (precargadas según el comportamiento elegido — puedes ajustarlas)</label>
              <textarea value={implicaciones} onChange={(e) => setImplicaciones(e.target.value)} rows={3}
                className="w-full text-xs rounded-lg px-3 py-2 border border-amber-200 bg-amber-50 outline-none" />
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 mb-2">
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
      </div>
      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo del acta"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} placeholder="Descripción de la situación"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />

      {(tipo === "Nivelación" || tipo === "Académico") && (
        <div className="mb-2">
          <label className="text-xs text-slate-500 block mb-1">Plantilla académica (catálogo — puedes agregar las que necesites)</label>
          <SelectorComportamiento categoria="academico" valorId={comportamientoAcad?.id} onSeleccionar={seleccionarAcad}
            onUsarPlantilla={(texto) => setCompromisosAcademicos(texto)} />
          <label className="text-xs text-slate-500 block mb-1 mt-1">Compromisos académicos {tipo === "Nivelación" && "(para superar la pérdida de la materia)"}</label>
          <textarea value={compromisosAcademicos} onChange={(e) => setCompromisosAcademicos(e.target.value)} rows={3}
            placeholder="Ej: Entregar plan de recuperación semanal, sustentar los temas pendientes..."
            className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
      )}

      {tipo === "Convivencial" && (
        <div className="mb-2">
          <label className="text-xs text-slate-500 block mb-1">Compromisos convivenciales {reincidente && "(dado el incumplimiento constante)"}</label>
          <textarea value={compromisosConvivenciales} onChange={(e) => setCompromisosConvivenciales(e.target.value)} rows={2}
            placeholder="Ej: Presentarse puntualmente, respetar el conducto regular, evitar conflictos con compañeros..."
            className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-slate-500 mb-3 mt-2">
        <input type="checkbox" checked={incluirAsistencia} onChange={(e) => setIncluirAsistencia(e.target.checked)} />
        Incluir resumen de asistencia como sustento
      </label>

      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : "Guardar acta"}
        </button>
      </div>
    </div>
  );
} 
