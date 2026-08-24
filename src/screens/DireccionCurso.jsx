import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import * as api from "../lib/api";
import { ordenarPorApellido } from "../lib/gamification";

const PERIODOS = ["1", "2", "3", "4"];
// Encabezado del colegio, reutilizado en todas las impresiones de esta pantalla
function htmlEncabezadoColegio(institucion, subtitulo) {
  return `
    <div style="display:flex; align-items:center; gap:12px; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:16px;">
      ${institucion?.logo_url ? `<img src="${institucion.logo_url}" style="height:55px;" />` : ""}
      <div style="flex:1; text-align:center;">
        <div style="font-weight:bold; font-size:15px;">${institucion?.nombre || "INSTITUCIÓN EDUCATIVA"}</div>
        ${institucion?.direccion ? `<div style="font-size:11px;">${institucion.direccion}${institucion?.telefono ? ` · Tel: ${institucion.telefono}` : ""}</div>` : ""}
        ${subtitulo ? `<div style="font-weight:bold; margin-top:4px; font-size:12px;">${subtitulo}</div>` : ""}
      </div>
    </div>
  `;
}

function CitacionForm({ estudiantes, citacion, onCancelar, onGuardada }) {
  const [estudianteId, setEstudianteId] = useState(citacion?.estudiante_id || estudiantes[0]?.id || "");
  const [motivo, setMotivo] = useState(citacion?.motivo || "");
  const [fecha, setFecha] = useState(citacion?.fecha_citacion || "");
  const [hora, setHora] = useState(citacion?.hora_citacion || "");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!estudianteId || !motivo.trim()) { alert("Elegí el estudiante y escribí el motivo."); return; }
    setGuardando(true);
    try {
      const campos = { motivo: motivo.trim(), fecha_citacion: fecha || null, hora_citacion: hora || null };
      if (citacion) await api.editarCitacion(citacion.id, campos);
      else await api.crearCitacion(estudianteId, campos);
      onGuardada();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-xl p-3 mb-3">
      <label className="text-xs text-slate-500 block mb-1">Estudiante</label>
      <select value={estudianteId} onChange={(e) => setEstudianteId(parseInt(e.target.value, 10))} disabled={!!citacion}
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white disabled:opacity-60">
        {estudiantes.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
      </select>
      <label className="text-xs text-slate-500 block mb-1">Motivo de la citación</label>
      <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Ej: Bajo rendimiento académico en varias materias…"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Fecha propuesta</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Hora</label>
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-1.5">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : citacion ? "Guardar cambios" : "Generar citación"}
        </button>
      </div>
    </div>
  );
}

// Ficha de citación — la notificación que se envía ANTES de la reunión
// (distinta del acta, que se llena DESPUÉS con lo que se conversó).
function imprimirFichaCitacion(citacion, institucion) {
  const ventana = window.open("", "_blank");
  ventana.document.write(`
    <html><head><title>Citación — ${citacion.estudiante_nombre}</title></head>
    <body style="font-family: Arial, sans-serif; padding: 30px; font-size: 13px;">
      ${htmlEncabezadoColegio(institucion, "CITACIÓN A ACUDIENTE")}
      <p>Respetado(a) acudiente,</p>
      <p>Se le cita a una reunión con Dirección de Curso para tratar el siguiente asunto relacionado con el estudiante:</p>
      <p><b>Estudiante:</b> ${citacion.estudiante_nombre}</p>
      <p><b>Motivo:</b><br/>${citacion.motivo}</p>
      <p><b>Fecha propuesta:</b> ${citacion.fecha_citacion || "Por confirmar"} ${citacion.hora_citacion || ""}</p>
      <p>Agradecemos su puntual asistencia. En caso de no poder asistir, por favor comuníquese con la institución para reprogramar.</p>
      <div style="margin-top:50px; border-top:1px dashed #999; padding-top:10px;">
        <p style="font-size:11px; color:#555;">— Recorte y devuelva esta parte firmada —</p>
        <p>Yo, ______________________________________, acudiente de <b>${citacion.estudiante_nombre}</b>, confirmo asistencia a la citación del ${citacion.fecha_citacion || "___"}.</p>
        <div style="margin-top:30px; border-top:1px solid #000; width:250px; text-align:center; padding-top:4px;">Firma Acudiente</div>
      </div>
      <script>window.print();</script>
    </body></html>
  `);
  ventana.document.close();
}

function AtenderCitacionModal({ citacion, institucion, onClose, onGuardada }) {
  const [estado, setEstado] = useState(citacion.estado === "pendiente" ? "atendida" : citacion.estado);
  const [notas, setNotas] = useState(citacion.notas_atencion || "");
  const [acuerdos, setAcuerdos] = useState(citacion.acuerdos || "");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      await api.editarCitacion(citacion.id, { estado, notas_atencion: notas.trim() || null, acuerdos: acuerdos.trim() || null });
      onGuardada();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setGuardando(false);
  };

  const imprimir = () => {
    const ventana = window.open("", "_blank");
    ventana.document.write(`
      <html><head><title>Acta de atención — ${citacion.estudiante_nombre}</title></head>
      <body style="font-family: Arial, sans-serif; padding: 30px; font-size: 13px;">
        ${htmlEncabezadoColegio(institucion, "ACTA DE ATENCIÓN A ACUDIENTE")}
        <p><b>Estudiante:</b> ${citacion.estudiante_nombre}</p>
        <p><b>Fecha:</b> ${citacion.fecha_citacion || "—"} ${citacion.hora_citacion || ""}</p>
        <p><b>Motivo de la citación:</b><br/>${citacion.motivo}</p>
        <p><b>Notas de la atención:</b><br/>${notas || "—"}</p>
        <p><b>Acuerdos:</b><br/>${acuerdos || "—"}</p>
        <div style="display:flex; justify-content:space-between; margin-top:60px;">
          <div style="border-top:1px solid #000; width:40%; text-align:center; padding-top:4px;">Firma Padre de Familia / Acudiente</div>
          <div style="border-top:1px solid #000; width:40%; text-align:center; padding-top:4px;">Firma Director(a) de Curso</div>
        </div>
        <script>window.print();</script>
      </body></html>
    `);
    ventana.document.close();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">📞 {citacion.estudiante_nombre}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3"><b>Motivo:</b> {citacion.motivo}</p>

        <label className="text-xs text-slate-500 block mb-1">Estado</label>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none">
          <option value="pendiente">Pendiente</option>
          <option value="atendida">Atendida</option>
          <option value="no_asistio">No asistió</option>
        </select>
        <label className="text-xs text-slate-500 block mb-1">Notas de la reunión</label>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none" />
        <label className="text-xs text-slate-500 block mb-1">Acuerdos</label>
        <textarea value={acuerdos} onChange={(e) => setAcuerdos(e.target.value)} rows={2} className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />

        <div className="flex justify-between gap-2">
          <button onClick={imprimir} className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 text-slate-600">🖨️ Imprimir acta</button>
          <button disabled={guardando} onClick={guardar} className="text-xs font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NuevoHorarioForm({ jornadaId, orden, onCancelar, onCreado }) {
  const [etiqueta, setEtiqueta] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [capacidad, setCapacidad] = useState(5);
  const [guardando, setGuardando] = useState(false);

  const crear = async () => {
    if (!etiqueta.trim()) { alert("Ponele un nombre al grupo/horario (ej: Grupo A)."); return; }
    setGuardando(true);
    try {
      await api.crearHorarioJornada(jornadaId, etiqueta.trim(), horaInicio, horaFin, parseInt(capacidad, 10) || 5, orden);
      onCreado();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-xl p-2.5 mb-2 flex flex-wrap gap-2 items-center">
      <input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} placeholder="Grupo A" className="w-28 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
      <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
      <span className="text-xs text-slate-400">a</span>
      <input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
      <input type="number" min="1" value={capacidad} onChange={(e) => setCapacidad(e.target.value)} title="Capacidad" className="w-14 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
      <button onClick={onCancelar} className="text-xs text-slate-500">Cancelar</button>
      <button disabled={guardando} onClick={crear} className="text-xs font-semibold px-2 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
        {guardando ? "…" : "Agregar"}
      </button>
    </div>
  );
}

// Textos preestablecidos para armar el acta rápido — son un punto de
// partida genérico, hay que ajustarlos al Manual de Convivencia real de
// cada institución antes de imprimir (son editables una vez insertados).
const PLANTILLAS_COMPROMISO = [
  { categoria: "Nivelación / tiempos de entrega", texto: "El estudiante y su acudiente se comprometen a presentar el plan de nivelación de las asignaturas pendientes en un plazo máximo de 15 días hábiles a partir de la firma de la presente acta, según lo establecido en el Manual de Convivencia." },
  { categoria: "Compromiso académico periodo siguiente", texto: "El estudiante se compromete a mejorar su desempeño académico durante el periodo siguiente, cumpliendo oportunamente con las actividades, tareas y evaluaciones propuestas por cada docente." },
  { categoria: "Cumplimiento convivencial", texto: "El estudiante se compromete a dar cumplimiento a las normas establecidas en el Manual de Convivencia Institucional, manteniendo un comportamiento respetuoso con la comunidad educativa." },
  { categoria: "Puntualidad / llegada temprana", texto: "El estudiante se compromete a asistir puntualmente a la institución y a cada una de sus clases, evitando llegadas tarde e inasistencias injustificadas." },
];

function ActaCompromisoModal({ estudiante, jornada, institucion, onClose, onGuardada }) {
  const [asignaturasPerdidas, setAsignaturasPerdidas] = useState(estudiante.asignacion?.asignaturas_perdidas || "");
  const [compromisos, setCompromisos] = useState(estudiante.asignacion?.acta_compromiso || "");
  const [guardando, setGuardando] = useState(false);

  const insertarPlantilla = (texto) => setCompromisos((prev) => prev ? `${prev}\n\n${texto}` : texto);

  const guardar = async () => {
    setGuardando(true);
    try {
      await api.actualizarChecklistJornada(jornada.id, estudiante.id, { asignaturas_perdidas: asignaturasPerdidas || null, acta_compromiso: compromisos || null });
      onGuardada();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  const imprimir = () => {
    const ventana = window.open("", "_blank");
    ventana.document.write(`
      <html><head><title>Acta de compromiso — ${estudiante.nombre}</title></head>
      <body style="font-family: Arial, sans-serif; padding: 30px; font-size: 13px;">
        ${htmlEncabezadoColegio(institucion, "ACTA DE COMPROMISO ACADÉMICO Y CONVIVENCIAL")}
        <p><b>Estudiante:</b> ${estudiante.nombre} · Curso ${jornada.grado_id}</p>
        <p><b>Periodo:</b> ${jornada.periodo} · <b>Fecha:</b> ${new Date().toLocaleDateString("es-CO")}</p>
        <p><b>Asignaturas perdidas:</b><br/>${(asignaturasPerdidas || "—").replace(/\n/g, "<br/>")}</p>
        <p><b>Compromisos:</b></p>
        <div style="white-space:pre-line;">${compromisos || "—"}</div>
        <div style="display:flex; justify-content:space-between; margin-top:60px;">
          <div style="border-top:1px solid #000; width:28%; text-align:center; padding-top:4px;">Firma Estudiante</div>
          <div style="border-top:1px solid #000; width:28%; text-align:center; padding-top:4px;">Firma Padre de Familia</div>
          <div style="border-top:1px solid #000; width:28%; text-align:center; padding-top:4px;">Firma Director de Curso</div>
        </div>
        <script>window.print();</script>
      </body></html>
    `);
    ventana.document.close();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">📝 Acta de compromiso — {estudiante.nombre}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        <label className="text-xs text-slate-500 block mb-1">Asignaturas perdidas</label>
        <textarea value={asignaturasPerdidas} onChange={(e) => setAsignaturasPerdidas(e.target.value)} rows={2} placeholder="Ej: Matemáticas, Ciencias Naturales"
          className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />

        <label className="text-xs text-slate-500 block mb-1">Insertar recomendación (según Manual de Convivencia — revisá y ajustá el texto antes de imprimir)</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {PLANTILLAS_COMPROMISO.map((p, i) => (
            <button key={i} onClick={() => insertarPlantilla(p.texto)} className="text-[11px] px-2.5 py-1 rounded-full border border-violet-200 text-violet-600">
              + {p.categoria}
            </button>
          ))}
        </div>
        <label className="text-xs text-slate-500 block mb-1">Compromisos (texto final del acta)</label>
        <textarea value={compromisos} onChange={(e) => setCompromisos(e.target.value)} rows={8}
          className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />

        <div className="flex justify-between gap-2">
          <button onClick={imprimir} className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 text-slate-600">🖨️ Imprimir acta</button>
          <button disabled={guardando} onClick={guardar} className="text-xs font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function imprimirListadoHorario(jornada, horario, estudiantesDelHorario, institucion) {
  const filas = estudiantesDelHorario.map((e) => `<tr><td style="border:1px solid #000;padding:4px;">${e.nombre}</td><td style="border:1px solid #000;padding:4px;">${e.asignacion?.tiene_reportes ? "Sí" : "No"}</td></tr>`).join("");
  const ventana = window.open("", "_blank");
  ventana.document.write(`
    <html><head><title>${jornada.nombre} — ${horario.etiqueta}</title></head>
    <body style="font-family: Arial, sans-serif; padding: 30px; font-size: 13px;">
      ${htmlEncabezadoColegio(institucion, `${jornada.nombre} — ${horario.etiqueta}`)}
      <p style="text-align:center;">${horario.hora_inicio || ""} a ${horario.hora_fin || ""}</p>
      <table style="width:100%; border-collapse:collapse; margin-top:10px;">
        <thead><tr><th style="border:1px solid #000;padding:4px;">Estudiante</th><th style="border:1px solid #000;padding:4px;">¿Tiene reportes?</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <script>window.print();</script>
    </body></html>
  `);
  ventana.document.close();
}

function JornadaDetalle({ jornada, gradoId, institucion }) {
  const [horarios, setHorarios] = useState([]);
  const [estudiantes, setEstudiantes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formHorarioAbierto, setFormHorarioAbierto] = useState(false);

  const cargar = () => {
    setCargando(true);
    api.fetchDetalleJornada(jornada.id, gradoId).then((d) => { setHorarios(d.horarios); setEstudiantes(d.estudiantes); setCargando(false); });
  };
  useEffect(() => { cargar(); }, [jornada.id]);

  const eliminarHorario = async (id) => { if (!confirm("¿Eliminar este horario/grupo? Los estudiantes asignados quedan sin grupo.")) return; await api.eliminarHorarioJornada(id); cargar(); };
  const asignar = async (estudianteId, horarioId) => { await api.asignarEstudianteHorario(jornada.id, estudianteId, horarioId || null); cargar(); };
  const marcarCheck = async (estudianteId, campo, valorActual) => { await api.actualizarChecklistJornada(jornada.id, estudianteId, { [campo]: !valorActual }); cargar(); };

  const [marcandoTodos, setMarcandoTodos] = useState(null); // campo en proceso
  const [actaAbiertaPara, setActaAbiertaPara] = useState(null);
  const marcarTodos = async (campo) => {
    const todosMarcados = estudiantes.every((e) => e.asignacion?.[campo]);
    const nuevoValor = !todosMarcados; // si ya estaban todos marcados, esto los desmarca a todos
    setMarcandoTodos(campo);
    for (const e of estudiantes) {
      await api.actualizarChecklistJornada(jornada.id, e.id, { [campo]: nuevoValor });
    }
    setMarcandoTodos(null);
    cargar();
  };

  const conteoDelHorario = (horarioId) => estudiantes.filter((e) => e.asignacion?.horario_id === horarioId).length;
  const sinAsignar = estudiantes.filter((e) => !e.asignacion?.horario_id);

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;

  return (
    <div>
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm font-semibold text-slate-700">Horarios / grupos de atención — Periodo {jornada.periodo}</div>
          <button onClick={() => setFormHorarioAbierto((v) => !v)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">
            {formHorarioAbierto ? "Cerrar" : "+ Agregar horario"}
          </button>
        </div>
        {formHorarioAbierto && (
          <NuevoHorarioForm jornadaId={jornada.id} orden={horarios.length} onCancelar={() => setFormHorarioAbierto(false)} onCreado={() => { setFormHorarioAbierto(false); cargar(); }} />
        )}
        {horarios.length === 0 ? (
          <p className="text-xs text-slate-400">Todavía no armaste ningún horario/grupo para este periodo.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {horarios.map((h) => {
              const cant = conteoDelHorario(h.id);
              const lleno = cant >= h.capacidad;
              return (
                <div key={h.id} className={`rounded-xl p-2.5 border ${lleno ? "bg-amber-50 border-amber-200" : "bg-white border-slate-100"}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-semibold text-slate-700">{h.etiqueta}</div>
                      <div className="text-[11px] text-slate-400">{h.hora_inicio || "—"} a {h.hora_fin || "—"} · {cant}/{h.capacidad}</div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => imprimirListadoHorario(jornada, h, estudiantes.filter((e) => e.asignacion?.horario_id === h.id), institucion)} className="text-xs text-slate-400 hover:text-violet-600">🖨️</button>
                      <button onClick={() => eliminarHorario(h.id)} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {sinAsignar.length > 0 && (
          <p className="text-[11px] text-amber-600 mt-2">⚠️ {sinAsignar.length} estudiante(s) todavía sin asignar a un horario.</p>
        )}
      </div>

      <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-100">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-3 py-2">Estudiante</th>
              <th className="px-3 py-2">Horario / grupo</th>
              <th className="px-3 py-2">
                <div>¿Tiene reportes?</div>
                <button onClick={() => marcarTodos("tiene_reportes")} disabled={marcandoTodos === "tiene_reportes"} className="text-[9px] font-normal text-violet-500">
                  {marcandoTodos === "tiene_reportes" ? "…" : "☑️ Todos"}
                </button>
              </th>
              <th className="px-3 py-2">
                <div>Informe entregado</div>
                <button onClick={() => marcarTodos("informe_entregado")} disabled={marcandoTodos === "informe_entregado"} className="text-[9px] font-normal text-violet-500">
                  {marcandoTodos === "informe_entregado" ? "…" : "☑️ Todos"}
                </button>
              </th>
              <th className="px-3 py-2">
                <div>Citación entregada</div>
                <button onClick={() => marcarTodos("citacion_entregada")} disabled={marcandoTodos === "citacion_entregada"} className="text-[9px] font-normal text-violet-500">
                  {marcandoTodos === "citacion_entregada" ? "…" : "☑️ Todos"}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {estudiantes.map((e) => (
              <tr key={e.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-700">{e.nombre}</td>
                <td className="px-3 py-2">
                  <select value={e.asignacion?.horario_id || ""} onChange={(ev) => asignar(e.id, ev.target.value ? parseInt(ev.target.value, 10) : null)}
                    className="text-xs rounded-lg px-2 py-1 border border-slate-200 outline-none bg-white">
                    <option value="">— Sin asignar —</option>
                    {horarios.map((h) => <option key={h.id} value={h.id}>{h.etiqueta}</option>)}
                  </select>
                </td>
                <td className="text-center px-3 py-2">
                  <input type="checkbox" checked={!!e.asignacion?.tiene_reportes} onChange={() => marcarCheck(e.id, "tiene_reportes", e.asignacion?.tiene_reportes)} />
                  {e.asignacion?.tiene_reportes && (
                    <button onClick={() => setActaAbiertaPara(e)} className="block mx-auto mt-0.5 text-[10px] font-semibold text-violet-500">
                      {e.asignacion?.acta_compromiso ? "📝 Ver acta" : "📝 Generar acta"}
                    </button>
                  )}
                </td>
                <td className="text-center px-3 py-2">
                  <input type="checkbox" checked={!!e.asignacion?.informe_entregado} onChange={() => marcarCheck(e.id, "informe_entregado", e.asignacion?.informe_entregado)} />
                </td>
                <td className="text-center px-3 py-2">
                  <input type="checkbox" checked={!!e.asignacion?.citacion_entregada} onChange={() => marcarCheck(e.id, "citacion_entregada", e.asignacion?.citacion_entregada)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {actaAbiertaPara && (
        <ActaCompromisoModal estudiante={actaAbiertaPara} jornada={jornada} institucion={institucion}
          onClose={() => setActaAbiertaPara(null)} onGuardada={() => { setActaAbiertaPara(null); cargar(); }} />
      )}
    </div>
  );
}

// Una sola pantalla para toda la secuencia de entrega de informes del año:
// las jornadas de cada periodo se crean solas (si no existen) al tocar la
// pestaña — no hay que ir creando "jornadas" sueltas una por una.
function JornadasDireccionCurso({ gradoId, institucion }) {
  const [periodoActivo, setPeriodoActivo] = useState("1");
  const [jornada, setJornada] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    api.fetchOCrearJornada(gradoId, periodoActivo).then((j) => { setJornada(j); setCargando(false); });
  }, [gradoId, periodoActivo]);

  return (
    <div>
      <p className="text-sm text-slate-500 mb-3">Toda la secuencia de entrega de informes del año, en una sola pantalla — cambiá de periodo con las pestañas.</p>
      <div className="flex gap-1 rounded-full bg-slate-100 p-1 w-fit mb-4">
        {PERIODOS.map((p) => (
          <button key={p} onClick={() => setPeriodoActivo(p)} className={`text-xs px-3 py-1.5 rounded-full ${periodoActivo === p ? "bg-violet-500 text-white" : "text-slate-600"}`}>
            Periodo {p}
          </button>
        ))}
      </div>

      {cargando || !jornada ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : (
        <JornadaDetalle jornada={jornada} gradoId={gradoId} institucion={institucion} />
      )}
    </div>
  );
}

function CitacionesDireccionCurso({ gradoId, institucion }) {
  const [estudiantes, setEstudiantes] = useState([]);
  const [citaciones, setCitaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [atendiendo, setAtendiendo] = useState(null);

  const cargar = () => {
    if (!gradoId) return;
    setCargando(true);
    Promise.all([api.fetchEstudiantesPorGrado(gradoId), api.fetchCitacionesPorCurso(gradoId)]).then(([est, cit]) => {
      setEstudiantes(ordenarPorApellido(est));
      setCitaciones(cit);
      setCargando(false);
    });
  };
  useEffect(() => { cargar(); }, [gradoId]);

  const eliminar = async (id) => { if (!confirm("¿Eliminar esta citación?")) return; await api.eliminarCitacion(id); cargar(); };
  const verificar = async (id, estado) => { await api.editarCitacion(id, { estado }); cargar(); };

  const ESTADO_LABEL = { pendiente: "🟡 Pendiente", atendida: "🟢 Atendida", no_asistio: "🔴 No asistió" };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm text-slate-500">Generá y llevá el registro de citaciones a padres de este curso.</p>
        <button onClick={() => setFormAbierto((v) => !v)} className="text-xs font-semibold px-3 py-2 rounded-full bg-violet-500 text-white">
          {formAbierto ? "Cerrar" : "+ Nueva citación"}
        </button>
      </div>

      {formAbierto && (
        <CitacionForm estudiantes={estudiantes} onCancelar={() => setFormAbierto(false)} onGuardada={() => { setFormAbierto(false); cargar(); }} />
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : citaciones.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">Todavía no hay citaciones registradas para este curso.</div>
      ) : (
        <div className="space-y-4">
          {estudiantes
            .map((e) => ({ estudiante: e, lista: citaciones.filter((c) => c.estudiante_id === e.id) }))
            .filter((g) => g.lista.length > 0)
            .map(({ estudiante, lista }) => {
            const estudianteId = estudiante.id;
            const noAsistio = lista.filter((c) => c.estado === "no_asistio").length;
            return (
              <div key={estudianteId} className="bg-white rounded-2xl border border-slate-100 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-slate-700">{lista[0].estudiante_nombre}</div>
                  <div className="flex gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{lista.length} citación(es)</span>
                    {noAsistio > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-semibold">{noAsistio} sin asistir</span>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {lista.map((c) => (
                    <div key={c.id} className="border-t border-slate-50 pt-1.5 flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-slate-600">{c.motivo}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {ESTADO_LABEL[c.estado]} {c.fecha_citacion ? `· ${c.fecha_citacion}${c.hora_citacion ? ` ${c.hora_citacion}` : ""}` : ""}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0 items-center">
                        <button onClick={() => imprimirFichaCitacion(c, institucion)} title="Imprimir ficha de citación (antes de la reunión)" className="text-xs text-slate-400 hover:text-violet-600">🎫</button>
                        {c.estado === "pendiente" && (
                          <>
                            <button onClick={() => verificar(c.id, "atendida")} title="Marcar que sí asistió" className="text-xs text-emerald-500 font-semibold">✅</button>
                            <button onClick={() => verificar(c.id, "no_asistio")} title="Marcar que no asistió" className="text-xs text-rose-500 font-semibold">❌</button>
                          </>
                        )}
                        <button onClick={() => setAtendiendo(c)} className="text-xs text-violet-500 font-semibold">Gestionar</button>
                        <button onClick={() => eliminar(c.id)} className="text-xs text-slate-300 hover:text-rose-500">🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {atendiendo && <AtenderCitacionModal citacion={atendiendo} institucion={institucion} onClose={() => setAtendiendo(null)} onGuardada={() => { setAtendiendo(null); cargar(); }} />}
    </div>
  );
}
export function VistaDireccionCurso({ grados }) {
  const [gradoId, setGradoId] = useState(grados[0]?.id || "");
  const [vista, setVista] = useState("citaciones"); // "citaciones" | "jornada"
  const [institucion, setInstitucion] = useState(null);

  useEffect(() => { if (grados.length && !gradoId) setGradoId(grados[0].id); }, [grados]);
  useEffect(() => { api.fetchInstitucion().then(setInstitucion); }, []);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-800">🎓 Dirección de Curso</h2>
        <p className="text-sm text-slate-400">Citaciones a padres y jornada de entrega de informes, todo en un solo lugar.</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {grados.map((g) => <option key={g.id} value={g.id}>Curso {g.id}</option>)}
        </select>
        <div className="flex gap-1 rounded-full bg-slate-100 p-1">
          <button onClick={() => setVista("citaciones")} className={`text-xs px-3 py-1.5 rounded-full ${vista === "citaciones" ? "bg-violet-500 text-white" : "text-slate-600"}`}>📞 Citaciones</button>
          <button onClick={() => setVista("jornada")} className={`text-xs px-3 py-1.5 rounded-full ${vista === "jornada" ? "bg-violet-500 text-white" : "text-slate-600"}`}>🗓️ Jornada de Entrega</button>
        </div>
      </div>

      {vista === "citaciones" && <CitacionesDireccionCurso gradoId={gradoId} institucion={institucion} />}
      {vista === "jornada" && <JornadasDireccionCurso gradoId={gradoId} institucion={institucion} />}
    </div>
  );
}
