import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { FALTAS_MANUAL, NIVELACION_COMPROMISOS_DEFAULT } from "../lib/actasTemplates";

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

      {actaImprimir && (
        actaImprimir.tipo === "Reunión de Padres"
          ? <ActaInstitucionalPrintView estudiante={estudiante} acta={actaImprimir} institucion={institucion} />
          : <ActaPrintView estudiante={estudiante} acta={actaImprimir} institucion={institucion} />
      )}
    </div>
  );
}

function celdaTh({ children, width }) {
  return <td style={{ border: "1px solid #000", padding: "4px 6px", fontWeight: "bold", fontSize: 11, width, verticalAlign: "top", background: "#F1F1F1" }}>{children}</td>;
}
function celdaTd({ children, colSpan }) {
  return <td colSpan={colSpan} style={{ border: "1px solid #000", padding: "4px 6px", fontSize: 11, verticalAlign: "top" }}>{children}</td>;
}

function ActaInstitucionalPrintView({ estudiante, acta, institucion, ultimaPagina = true, numeroPagina = 1, totalPaginas = 1 }) {
  const a = acta;
  const agendaItems = (a.agenda || "").split("\n").filter((l) => l.trim());
  return (
    <div className="print-only" style={{ maxWidth: 760, margin: "0 auto", padding: 28, fontFamily: "Calibri, Arial, sans-serif", color: "#000", pageBreakAfter: ultimaPagina ? "auto" : "always" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 6 }}>
        <tbody>
          <tr><td style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "center", fontWeight: "bold", fontSize: 15 }}>ACTA DE REUNIÓN</td></tr>
        </tbody>
      </table>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            {celdaTh({ children: "Fecha" })}{celdaTd({ children: a.fecha })}
            {celdaTh({ children: "Inicio" })}{celdaTd({ children: a.hora_inicio || "—" })}
            {celdaTh({ children: "Fin" })}{celdaTd({ children: a.hora_fin || "—" })}
          </tr>
          <tr>
            {celdaTh({ children: "Lugar" })}{celdaTd({ children: a.lugar || "—", colSpan: 5 })}
          </tr>
          <tr>
            {celdaTh({ children: "Asunto" })}{celdaTd({ children: a.asunto || a.motivo, colSpan: 5 })}
          </tr>
          <tr>
            {celdaTh({ children: "Estudiante" })}{celdaTd({ children: estudiante.nombre, colSpan: 3 })}
            {celdaTh({ children: "Grado" })}{celdaTd({ children: estudiante.grado_id })}
          </tr>
          <tr>
            {celdaTh({ children: "Asistentes" })}{celdaTd({ children: a.asistentes || "—", colSpan: 3 })}
            {celdaTh({ children: "Asist. Externos" })}{celdaTd({ children: a.asistentes_externos || "—" })}
          </tr>
          <tr>
            {celdaTh({ children: "Fecha de Elaboración" })}{celdaTd({ children: a.fecha })}
            {celdaTh({ children: "Elaborado por" })}{celdaTd({ children: a.elaborado_por || (a.profesores?.nombre ?? "—"), colSpan: 2 })}
          </tr>
          {a.proxima_reunion && (
            <tr>
              {celdaTh({ children: "Próxima Reunión" })}{celdaTd({ children: a.proxima_reunion, colSpan: 5 })}
            </tr>
          )}
        </tbody>
      </table>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 0 }}>
        <tbody>
          <tr><td style={{ border: "1px solid #000", padding: "6px 8px" }}>
            <div style={{ fontWeight: "bold", fontSize: 12, marginBottom: 4 }}>AGENDA DE LA REUNIÓN</div>
            {agendaItems.length > 0 ? (
              <ol style={{ margin: "0 0 10px 18px", padding: 0, fontSize: 11 }}>
                {agendaItems.map((it, i) => <li key={i} style={{ marginBottom: 2 }}>{it}</li>)}
              </ol>
            ) : <div style={{ fontSize: 11, marginBottom: 10 }}>—</div>}

            <div style={{ fontWeight: "bold", fontSize: 12, marginBottom: 4 }}>DESARROLLO DE LA AGENDA</div>
            <div style={{ fontSize: 11, marginBottom: 10, whiteSpace: "pre-wrap" }}>{a.desarrollo_agenda || a.descripcion || "—"}</div>

            <div style={{ fontWeight: "bold", fontSize: 12, marginBottom: 4 }}>COMPROMISOS ADQUIRIDOS</div>
            <div style={{ fontSize: 11, whiteSpace: "pre-wrap" }}>{a.compromisos || a.compromisos_academicos || a.compromisos_convivenciales || "—"}</div>
          </td></tr>
        </tbody>
      </table>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 0 }}>
        <tbody>
          <tr><td style={{ border: "1px solid #000", borderTop: "none", padding: "10px 8px" }}>
            <div style={{ fontWeight: "bold", fontSize: 12, textAlign: "center", marginBottom: 30 }}>REVISÓ Y APROBÓ</div>
            <div style={{ fontSize: 12, marginBottom: 22 }}>NOMBRE: _______________________________ (Acudiente de {estudiante.nombre})</div>
            <div style={{ fontSize: 12, marginBottom: 22 }}>CARGO: ________________________________</div>
            <div style={{ fontSize: 12, marginBottom: 10 }}>FIRMA: ________________________________</div>
            <div style={{ fontSize: 11, textAlign: "center", marginTop: 20 }}>En constancia se firma a satisfacción de todos los presentes.</div>
          </td></tr>
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#444", marginTop: 10 }}>
        <span>Página {numeroPagina} de {totalPaginas}</span>
        <span>21-IF-001 · V.1</span>
      </div>
    </div>
  );
}

export function GenerarActaMultipleModal({ gradoId, onClose }) {
  const [estudiantes, setEstudiantes] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [institucion, setInstitucion] = useState({ nombre: "Institución Educativa" });
  const [guardando, setGuardando] = useState(false);
  const [actasParaImprimir, setActasParaImprimir] = useState(null); // [{estudiante, acta}]

  const [fecha, setFecha] = useState(hoyISO());
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [lugar, setLugar] = useState("");
  const [asunto, setAsunto] = useState("");
  const [asistentes, setAsistentes] = useState("Padres de familia y/o acudientes");
  const [asistentesExternos, setAsistentesExternos] = useState("");
  const [agenda, setAgenda] = useState("");
  const [desarrolloAgenda, setDesarrolloAgenda] = useState("");
  const [compromisosAdquiridos, setCompromisosAdquiridos] = useState("");
  const [elaboradoPor, setElaboradoPor] = useState("");
  const [proximaReunion, setProximaReunion] = useState("");

  useEffect(() => {
    api.fetchEstudiantesPorGrado(gradoId).then((est) => { setEstudiantes(est); setCargando(false); });
    api.fetchInstitucion().then(setInstitucion);
  }, [gradoId]);

  useEffect(() => {
    if (!actasParaImprimir) return;
    const id = setTimeout(() => window.print(), 200);
    const onAfter = () => setActasParaImprimir(null);
    window.addEventListener("afterprint", onAfter);
    return () => { clearTimeout(id); window.removeEventListener("afterprint", onAfter); };
  }, [actasParaImprimir]);

  const toggleEstudiante = (id) => setSeleccionados((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const marcarTodos = () => setSeleccionados(seleccionados.length === estudiantes.length ? [] : estudiantes.map((e) => e.id));

  const generar = async () => {
    if (!asunto.trim()) { alert("Escribe al menos el asunto de la reunión."); return; }
    if (seleccionados.length === 0) { alert("Elegí al menos un estudiante."); return; }
    setGuardando(true);
    try {
      const camposComunes = {
        tipo: "Reunión de Padres", fecha, motivo: asunto.trim(),
        hora_inicio: horaInicio || null, hora_fin: horaFin || null, lugar: lugar.trim() || null,
        asunto: asunto.trim(), asistentes: asistentes.trim() || null, asistentes_externos: asistentesExternos.trim() || null,
        agenda: agenda.trim() || null, desarrollo_agenda: desarrolloAgenda.trim() || null,
        compromisos: compromisosAdquiridos.trim() || null,
        elaborado_por: elaboradoPor.trim() || null, proxima_reunion: proximaReunion || null,
      };
      const actasCreadas = await api.crearActasEnLote(seleccionados, camposComunes);
      const parEstudianteActa = actasCreadas.map((acta) => ({ estudiante: estudiantes.find((e) => e.id === acta.estudiante_id), acta }));
      setActasParaImprimir(parEstudianteActa);
    } catch (e) {
      alert("Error al generar las actas: " + e.message);
    }
    setGuardando(false);
  };

  if (actasParaImprimir) {
    return (
      <div>
        {actasParaImprimir.map((par, i) => (
          <ActaInstitucionalPrintView key={par.acta.id} estudiante={par.estudiante} acta={par.acta} institucion={institucion}
            numeroPagina={i + 1} totalPaginas={actasParaImprimir.length} ultimaPagina={i === actasParaImprimir.length - 1} />
        ))}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 no-print" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-bold text-slate-800">📋 Generar Acta de Reunión — varios estudiantes</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-400 mb-4">Llená el contenido de la reunión UNA sola vez — se genera una copia idéntica por cada estudiante elegido, lista para que cada acudiente firme la suya.</p>

        <div className="bg-slate-50 rounded-xl p-3 mb-4">
          <div className="grid grid-cols-3 gap-2 mb-2">
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
            <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} placeholder="Inicio" className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
            <input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} placeholder="Fin" className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
          </div>
          <input value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Lugar" className="w-full text-xs rounded-lg px-2 py-1.5 mb-2 border border-slate-200 outline-none bg-white" />
          <input value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Asunto de la reunión (ej: Reporte de rendimiento académico)"
            className="w-full text-xs rounded-lg px-2 py-1.5 mb-2 border border-slate-200 outline-none bg-white" />
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input value={asistentes} onChange={(e) => setAsistentes(e.target.value)} placeholder="Asistentes" className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
            <input value={asistentesExternos} onChange={(e) => setAsistentesExternos(e.target.value)} placeholder="Asistentes externos (opcional)" className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
          </div>
          <textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={3} placeholder="Agenda (un punto por línea)"
            className="w-full text-xs rounded-lg px-2 py-1.5 mb-2 border border-slate-200 outline-none bg-white" />
          <textarea value={desarrolloAgenda} onChange={(e) => setDesarrolloAgenda(e.target.value)} rows={3} placeholder="Desarrollo de la agenda"
            className="w-full text-xs rounded-lg px-2 py-1.5 mb-2 border border-slate-200 outline-none bg-white" />
          <textarea value={compromisosAdquiridos} onChange={(e) => setCompromisosAdquiridos(e.target.value)} rows={2} placeholder="Compromisos adquiridos"
            className="w-full text-xs rounded-lg px-2 py-1.5 mb-2 border border-slate-200 outline-none bg-white" />
          <div className="grid grid-cols-2 gap-2">
            <input value={elaboradoPor} onChange={(e) => setElaboradoPor(e.target.value)} placeholder="Elaborado por" className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
            <input type="date" value={proximaReunion} onChange={(e) => setProximaReunion(e.target.value)} placeholder="Próxima reunión" className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
          </div>
        </div>

        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-semibold text-slate-600">¿A qué estudiantes citás? ({seleccionados.length} elegido{seleccionados.length !== 1 && "s"})</label>
          <button onClick={marcarTodos} className="text-xs text-violet-500">{seleccionados.length === estudiantes.length ? "Ninguno" : "Todos"}</button>
        </div>
        {cargando ? (
          <p className="text-xs text-slate-400">Cargando estudiantes…</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 mb-4 max-h-40 overflow-y-auto">
            {estudiantes.map((e) => (
              <button key={e.id} onClick={() => toggleEstudiante(e.id)}
                className={`text-xs px-2.5 py-1.5 rounded-full border ${seleccionados.includes(e.id) ? "bg-violet-500 text-white border-violet-500" : "bg-white text-slate-500 border-slate-200"}`}>
                {seleccionados.includes(e.id) ? "✓ " : ""}{e.nombre}
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
          <button disabled={guardando} onClick={generar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
            {guardando ? "Generando…" : `Generar ${seleccionados.length || ""} acta(s) y ver para imprimir`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActaPrintView({ estudiante, acta, institucion }) {
  const a = acta;
  return (
    <div className="print-only" style={{ maxWidth: 800, margin: "0 auto", padding: 32, fontFamily: "Georgia, serif", color: "#1e293b" }}>
      <div style={{ textAlign: "center", marginBottom: 20, borderBottom: "2px solid #8B5CF6", paddingBottom: 12 }}>
        {institucion.logo_url && (
          <img src={institucion.logo_url} alt="Logo" style={{ maxHeight: 70, marginBottom: 8, display: "block", marginLeft: "auto", marginRight: "auto" }} />
        )}
        <div style={{ fontSize: 20, fontWeight: "bold" }}>{institucion.nombre}</div>
        {(institucion.ciclo || institucion.anio) && (
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            {institucion.ciclo}{institucion.ciclo && institucion.anio ? " — " : ""}{institucion.anio}
          </div>
        )}
        <div style={{ fontSize: 16, marginTop: 6 }}>Acta de Seguimiento — {a.tipo}</div>
      </div>

      <table style={{ width: "100%", fontSize: 13, marginBottom: 16, borderCollapse: "collapse" }}>
        <tbody>
          <tr><td style={{ padding: 4, fontWeight: "bold", width: 160 }}>Estudiante:</td><td style={{ padding: 4 }}>{estudiante.nombre}</td></tr>
          <tr><td style={{ padding: 4, fontWeight: "bold" }}>Grado:</td><td style={{ padding: 4 }}>{estudiante.grado_id}</td></tr>
          <tr><td style={{ padding: 4, fontWeight: "bold" }}>Grupo:</td><td style={{ padding: 4 }}>{estudiante.reino_actual || estudiante.reino_original}</td></tr>
          <tr><td style={{ padding: 4, fontWeight: "bold" }}>Fecha:</td><td style={{ padding: 4 }}>{a.fecha}</td></tr>
          {a.tipo_falta && (
            <tr><td style={{ padding: 4, fontWeight: "bold" }}>Tipo de falta:</td><td style={{ padding: 4 }}>{a.tipo_falta} ({a.articulo}) — Plazo de respuesta: {a.plazo_dias} días hábiles</td></tr>
          )}
        </tbody>
      </table>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>Motivo</div>
        <div style={{ fontSize: 13 }}>{a.motivo}</div>
      </div>

      {a.descripcion && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>Descripción de la situación</div>
          <div style={{ fontSize: 13 }}>{a.descripcion}</div>
        </div>
      )}

      {a.implicaciones_legales && (
        <div style={{ marginBottom: 14, background: "#FEF3C7", padding: 10, borderRadius: 6 }}>
          <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>Implicaciones legales</div>
          <div style={{ fontSize: 13 }}>{a.implicaciones_legales}</div>
        </div>
      )}

      {a.compromisos_academicos && (
        <div style={{ marginBottom: 14, background: "#F5F3FF", padding: 10, borderRadius: 6 }}>
          <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>Compromisos académicos</div>
          <div style={{ fontSize: 13 }}>{a.compromisos_academicos}</div>
        </div>
      )}

      {a.compromisos_convivenciales && (
        <div style={{ marginBottom: 14, background: "#FFF3F8", padding: 10, borderRadius: 6 }}>
          <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>Compromisos convivenciales</div>
          <div style={{ fontSize: 13 }}>{a.compromisos_convivenciales}</div>
        </div>
      )}

      {a.compromisos && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>Compromisos</div>
          <div style={{ fontSize: 13 }}>{a.compromisos}</div>
        </div>
      )}

      {a.asistencia_resumen && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>Sustento de asistencia</div>
          <div style={{ fontSize: 13 }}>
            Presentes: {a.asistencia_resumen.P} · Retardos: {a.asistencia_resumen.R} · Faltas injustificadas: {a.asistencia_resumen.FI} · Faltas justificadas: {a.asistencia_resumen.FJ} · % Asistencia: {a.asistencia_resumen.pct}%
          </div>
        </div>
      )}

      <div style={{ marginTop: 50, display: "flex", justifyContent: "space-between" }}>
        {["Docente", "Estudiante", "Acudiente"].map((f) => (
          <div key={f} style={{ textAlign: "center", width: "30%" }}>
            <div style={{ borderTop: "1px solid #1e293b", marginBottom: 4 }} />
            <div style={{ fontSize: 12 }}>{f}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, fontSize: 10, color: "#64748b", textAlign: "right" }}>
        Registrado por: {a.profesores?.nombre || "—"} · Generado el {new Date().toLocaleDateString("es-CO")}
      </div>
    </div>
  );
}

function NuevaActaForm({ estudianteId, onCancelar, onGuardada }) {
  const [tipo, setTipo] = useState("Convivencial");
  const [fecha, setFecha] = useState(hoyISO());
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [lugar, setLugar] = useState("");
  const [asunto, setAsunto] = useState("");
  const [asistentes, setAsistentes] = useState("");
  const [asistentesExternos, setAsistentesExternos] = useState("");
  const [agenda, setAgenda] = useState("");
  const [desarrolloAgenda, setDesarrolloAgenda] = useState("");
  const [elaboradoPor, setElaboradoPor] = useState("");
  const [proximaReunion, setProximaReunion] = useState("");
  const [compromisosAdquiridos, setCompromisosAdquiridos] = useState("");
  const [motivo, setMotivo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [compromisosAcademicos, setCompromisosAcademicos] = useState("");
  const [compromisosConvivenciales, setCompromisosConvivenciales] = useState("");
  const [categoriaFalta, setCategoriaFalta] = useState("leve");
  const [implicaciones, setImplicaciones] = useState(FALTAS_MANUAL.leve.implicaciones);
  const [reincidente, setReincidente] = useState(false);
  const [incluirAsistencia, setIncluirAsistencia] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Precarga las implicaciones legales según la falta elegida (queda editable)
  useEffect(() => {
    if (tipo === "Convivencial") setImplicaciones(FALTAS_MANUAL[categoriaFalta].implicaciones);
  }, [tipo, categoriaFalta]);

  // Precarga el plan de compromisos académicos al entrar en modo Nivelación (solo si está vacío, para no pisar lo que ya escribió el docente)
  useEffect(() => {
    if (tipo === "Nivelación" && !compromisosAcademicos.trim()) {
      setCompromisosAcademicos(NIVELACION_COMPROMISOS_DEFAULT);
    }
  }, [tipo]);

  const guardar = async () => {
    if (tipo !== "Reunión de Padres" && !motivo.trim()) { alert("Escribe al menos el motivo."); return; }
    if (tipo === "Reunión de Padres" && !asunto.trim()) { alert("Escribe al menos el asunto de la reunión."); return; }
    setGuardando(true);
    try {
      const campos = {
        tipo, fecha, motivo: motivo.trim() || (tipo === "Reunión de Padres" ? asunto.trim() : ""), descripcion: descripcion.trim() || null,
        compromisos_academicos: compromisosAcademicos.trim() || null,
        compromisos_convivenciales: compromisosConvivenciales.trim() || null,
      };
      if (tipo === "Reunión de Padres") {
        Object.assign(campos, {
          hora_inicio: horaInicio || null, hora_fin: horaFin || null, lugar: lugar.trim() || null,
          asunto: asunto.trim() || null, asistentes: asistentes.trim() || null, asistentes_externos: asistentesExternos.trim() || null,
          agenda: agenda.trim() || null, desarrollo_agenda: desarrolloAgenda.trim() || null,
          elaborado_por: elaboradoPor.trim() || null, proxima_reunion: proximaReunion || null,
          compromisos: compromisosAdquiridos.trim() || null,
        });
      }
      if (tipo === "Convivencial") {
        const f = FALTAS_MANUAL[categoriaFalta];
        campos.categoria_falta = categoriaFalta;
        campos.tipo_falta = (reincidente ? "Reincidente / " : "") + f.tipo;
        campos.articulo = f.articulo;
        campos.plazo_dias = f.plazoDias;
        campos.implicaciones_legales = implicaciones.trim() || f.implicaciones;
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
      <div className="flex gap-1 mb-3 rounded-full bg-white p-1 w-fit flex-wrap">
        {["Convivencial", "Académico", "Nivelación", "Reunión de Padres"].map((t) => (
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
          <label className="text-xs text-slate-500 block mb-1">Categoría de la falta (Manual de Convivencia)</label>
          <div className="flex gap-1 mb-2">
            {Object.entries(FALTAS_MANUAL).map(([key, f]) => (
              <button key={key} onClick={() => setCategoriaFalta(key)}
                className={`text-xs px-3 py-1.5 rounded-full ${categoriaFalta === key ? "bg-violet-500 text-white" : "bg-white text-slate-600"}`}>
                {f.tipo} ({f.articulo})
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={reincidente} onChange={(e) => setReincidente(e.target.checked)} />
            Es una falta constante / reincidente (incumplimiento repetido del manual de convivencia)
          </label>
          <div className="mt-3">
            <label className="text-xs text-slate-500 block mb-1">Implicaciones legales (precargadas según la falta — puedes ajustarlas)</label>
            <textarea value={implicaciones} onChange={(e) => setImplicaciones(e.target.value)} rows={3}
              className="w-full text-xs rounded-lg px-3 py-2 border border-amber-200 bg-amber-50 outline-none" />
          </div>
        </div>
      )}

      {tipo === "Reunión de Padres" && (
        <div className="mb-3 bg-white rounded-xl p-3 border border-slate-200">
          <div className="text-xs font-bold text-slate-600 mb-2">Formato institucional de Reunión</div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} placeholder="Inicio" className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
            <input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} placeholder="Fin" className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
            <input value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Lugar" className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
          </div>
          <input value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Asunto de la reunión"
            className="w-full text-xs rounded-lg px-2 py-1.5 mb-2 border border-slate-200 outline-none" />
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input value={asistentes} onChange={(e) => setAsistentes(e.target.value)} placeholder="Asistentes (ej: Padres de familia, Director de curso)" className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
            <input value={asistentesExternos} onChange={(e) => setAsistentesExternos(e.target.value)} placeholder="Asistentes externos (opcional)" className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
          </div>
          <textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={3} placeholder="Agenda de la reunión (un punto por línea)"
            className="w-full text-xs rounded-lg px-2 py-1.5 mb-2 border border-slate-200 outline-none" />
          <textarea value={desarrolloAgenda} onChange={(e) => setDesarrolloAgenda(e.target.value)} rows={4} placeholder="Desarrollo de la agenda"
            className="w-full text-xs rounded-lg px-2 py-1.5 mb-2 border border-slate-200 outline-none" />
          <textarea value={compromisosAdquiridos} onChange={(e) => setCompromisosAdquiridos(e.target.value)} rows={2} placeholder="Compromisos adquiridos"
            className="w-full text-xs rounded-lg px-2 py-1.5 mb-2 border border-slate-200 outline-none" />
          <div className="grid grid-cols-2 gap-2">
            <input value={elaboradoPor} onChange={(e) => setElaboradoPor(e.target.value)} placeholder="Elaborado por" className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
            <input type="date" value={proximaReunion} onChange={(e) => setProximaReunion(e.target.value)} placeholder="Próxima reunión" className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-2">
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
      </div>
      {tipo !== "Reunión de Padres" && (
        <>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo del acta"
            className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} placeholder="Descripción de la situación"
            className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
        </>
      )}

      {(tipo === "Nivelación" || tipo === "Académico") && (
        <div className="mb-2">
          <label className="text-xs text-slate-500 block mb-1">Compromisos académicos {tipo === "Nivelación" && "(para superar la pérdida de la materia)"}</label>
          <textarea value={compromisosAcademicos} onChange={(e) => setCompromisosAcademicos(e.target.value)} rows={2}
            placeholder="Ej: Entregar plan de recuperación semanal, sustentar los temas pendientes..."
            className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
      )}

      {tipo === "Convivencial" && (
        <div className="mb-2">
          <label className="text-xs text-slate-500 block mb-1">Compromisos convivenciales {reincidente && "(dado el incumplimiento constante del manual)"}</label>
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
