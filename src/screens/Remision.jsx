import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import * as api from "../lib/api";
import { EditorTexto, TextoEnriquecido } from "../components/RichText";

function CampoTexto({ label, value, onChange, tipo = "text", filas, enriquecido }) {
  return (
    <div className="mb-2">
      <label className="text-[11px] text-slate-500 block mb-1">{label}</label>
      {enriquecido ? (
        <EditorTexto value={value} onChange={onChange} minHeight={filas ? filas * 24 : 70} />
      ) : filas ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={filas} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
      ) : (
        <input type={tipo} value={value} onChange={(e) => onChange(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
      )}
    </div>
  );
}

function CampoCheck({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-600 mb-1">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

function CampoSiNo({ label, value, onChange }) {
  return (
    <div className="mb-2">
      <label className="text-[11px] text-slate-500 block mb-1">{label}</label>
      <div className="flex gap-1">
        {["si", "no"].map((v) => (
          <button key={v} onClick={() => onChange(value === v ? null : v)}
            className={`text-xs px-3 py-1.5 rounded-full border ${value === v ? "bg-violet-500 text-white border-violet-500" : "bg-white text-slate-600 border-slate-200"}`}>
            {v === "si" ? "Sí" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}

function RemisionForm({ estudiante, remision, onCancelar, onGuardado }) {
  const [f, setF] = useState({
    fecha_remision: remision?.fecha_remision || new Date().toISOString().slice(0, 10),
    acudiente_nombre: remision?.acudiente_nombre || "",
    telefono_contacto: remision?.telefono_contacto || "",
    eps: remision?.eps || "",
    jornada: remision?.jornada || "",
    curso: remision?.curso || estudiante.grado_id || "",
    motivo_socioemocional: remision?.motivo_socioemocional || false,
    motivo_familiar: remision?.motivo_familiar || false,
    motivo_convivencial: remision?.motivo_convivencial || false,
    descripcion_situacion: remision?.descripcion_situacion || "",
    ajuste_metodologico: remision?.ajuste_metodologico || false,
    revision_normas: remision?.revision_normas || false,
    acompanamiento_individual: remision?.acompanamiento_individual || false,
    estrategias_descripcion: remision?.estrategias_descripcion || "",
    estrategias_familia_nombre: remision?.estrategias_familia_nombre || "",
    compromisos_acordados: remision?.compromisos_acordados || "",
    fecha_compromisos: remision?.fecha_compromisos || "",
    cambio_observado: remision?.cambio_observado || null,
    cumplimiento_compromisos: remision?.cumplimiento_compromisos || null,
    remitido_otras_dependencias: remision?.remitido_otras_dependencias || null,
    cual_dependencia: remision?.cual_dependencia || "",
    motivo_remision_otras: remision?.motivo_remision_otras || "",
    acciones_realizadas: remision?.acciones_realizadas || "",
    recibido_por: remision?.recibido_por || "",
    fecha_recibido: remision?.fecha_recibido || "",
  });
  const [guardando, setGuardando] = useState(false);
  const set = (campo) => (valor) => setF((prev) => ({ ...prev, [campo]: valor }));

  const guardar = async () => {
    setGuardando(true);
    try {
      const campos = { ...f, fecha_compromisos: f.fecha_compromisos || null, fecha_recibido: f.fecha_recibido || null };
      if (remision) await api.editarRemision(remision.id, campos);
      else await api.crearRemision(estudiante.id, campos);
      onGuardado();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-2xl p-4 mb-4">
      <div className="grid grid-cols-2 gap-3">
        <CampoTexto label="Fecha de remisión" tipo="date" value={f.fecha_remision} onChange={set("fecha_remision")} />
        <CampoTexto label="Curso" value={f.curso} onChange={set("curso")} />
        <CampoTexto label="Jornada" value={f.jornada} onChange={set("jornada")} />
        <CampoTexto label="EPS" value={f.eps} onChange={set("eps")} />
        <CampoTexto label="Acudiente" value={f.acudiente_nombre} onChange={set("acudiente_nombre")} />
        <CampoTexto label="Teléfono de contacto" value={f.telefono_contacto} onChange={set("telefono_contacto")} />
      </div>

      <div className="mt-2 mb-1">
        <label className="text-[11px] text-slate-500 block mb-1">Motivo de la remisión</label>
        <div className="flex gap-3 flex-wrap">
          <CampoCheck label="Socioemocional" checked={f.motivo_socioemocional} onChange={set("motivo_socioemocional")} />
          <CampoCheck label="Familiar" checked={f.motivo_familiar} onChange={set("motivo_familiar")} />
          <CampoCheck label="Convivencial" checked={f.motivo_convivencial} onChange={set("motivo_convivencial")} />
        </div>
      </div>

      <CampoTexto label="1. Descripción de la situación observada" filas={3} value={f.descripcion_situacion} onChange={set("descripcion_situacion")} enriquecido />

      <div className="mb-1">
        <label className="text-[11px] text-slate-500 block mb-1">2. Estrategias aplicadas con el estudiante frente a la situación</label>
        <div className="flex gap-3 flex-wrap mb-1">
          <CampoCheck label="Ajuste metodológico" checked={f.ajuste_metodologico} onChange={set("ajuste_metodologico")} />
          <CampoCheck label="Revisión normas de convivencia en clase" checked={f.revision_normas} onChange={set("revision_normas")} />
          <CampoCheck label="Acompañamiento individual" checked={f.acompanamiento_individual} onChange={set("acompanamiento_individual")} />
        </div>
      </div>
      <CampoTexto label="Detalle (tiempos, espacios, metodología, didáctica)" filas={2} value={f.estrategias_descripcion} onChange={set("estrategias_descripcion")} enriquecido />

      <div className="grid grid-cols-2 gap-3">
        <CampoTexto label="3. Nombre del padre/madre/acudiente" value={f.estrategias_familia_nombre} onChange={set("estrategias_familia_nombre")} />
        <CampoTexto label="Fecha de los compromisos" tipo="date" value={f.fecha_compromisos} onChange={set("fecha_compromisos")} />
      </div>
      <CampoTexto label="Compromisos acordados" filas={2} value={f.compromisos_acordados} onChange={set("compromisos_acordados")} enriquecido />

      <div className="grid grid-cols-2 gap-3 mt-2">
        <CampoSiNo label="4. ¿Se ha observado cambio en el estudiante?" value={f.cambio_observado} onChange={set("cambio_observado")} />
        <CampoSiNo label="¿Se evidencia cumplimiento de los compromisos?" value={f.cumplimiento_compromisos} onChange={set("cumplimiento_compromisos")} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <CampoSiNo label="5. ¿Ha sido remitido a otras dependencias?" value={f.remitido_otras_dependencias} onChange={set("remitido_otras_dependencias")} />
        <CampoTexto label="¿Cuál?" value={f.cual_dependencia} onChange={set("cual_dependencia")} />
      </div>
      <CampoTexto label="Motivo de esa remisión" filas={2} value={f.motivo_remision_otras} onChange={set("motivo_remision_otras")} enriquecido />
      <CampoTexto label="Acciones realizadas" filas={2} value={f.acciones_realizadas} onChange={set("acciones_realizadas")} enriquecido />

      <div className="grid grid-cols-2 gap-3">
        <CampoTexto label="Recibido por" value={f.recibido_por} onChange={set("recibido_por")} />
        <CampoTexto label="Fecha de recibido" tipo="date" value={f.fecha_recibido} onChange={set("fecha_recibido")} />
      </div>

      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : remision ? "Guardar cambios" : "Crear remisión"}
        </button>
      </div>
    </div>
  );
}

function RemisionPrintView({ remision, estudiante, institucion, onCerrado }) {
  const [imprimiendo, setImprimiendo] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => window.print(), 150);
    const onAfter = () => { setImprimiendo(false); onCerrado(); };
    window.addEventListener("afterprint", onAfter);
    return () => { clearTimeout(id); window.removeEventListener("afterprint", onAfter); };
  }, []);

  const check = (v) => v ? "☒" : "☐";
  const siNo = (v) => v === "si" ? "SÍ ( X )   NO (   )" : v === "no" ? "SÍ (   )   NO ( X )" : "SÍ (   )   NO (   )";

  const contenido = (
    <div className="print-only" style={{ maxWidth: 800, margin: "0 auto", padding: 24, fontFamily: "Arial, sans-serif", fontSize: 11, color: "#111" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 8 }}>
        {institucion?.logo_url && <img src={institucion.logo_url} alt="Logo" style={{ height: 60 }} />}
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontWeight: "bold", fontSize: 14 }}>{institucion?.nombre || "INSTITUCIÓN EDUCATIVA"}</div>
          {institucion?.resolucion && <div>Licencia de Funcionamiento {institucion.resolucion}</div>}
          <div>{institucion?.codigo_icfes && `CÓDIGO ICFES: ${institucion.codigo_icfes}`}{institucion?.codigo_dane && ` · DANE: ${institucion.codigo_dane}`}</div>
          <div>{institucion?.direccion}{institucion?.telefono && ` · Tel: ${institucion.telefono}`}{institucion?.correo && ` · Correo: ${institucion.correo}`}</div>
        </div>
      </div>
      <div style={{ textAlign: "center", fontWeight: "bold", marginBottom: 4 }}>ÁREA DE ORIENTACIÓN</div>
      <div style={{ textAlign: "center", fontWeight: "bold", marginBottom: 12, textDecoration: "underline" }}>F1. FORMATO DE REMISIÓN DE ESTUDIANTES</div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10 }}>
        <tbody>
          <tr>
            <td style={{ border: "1px solid #000", padding: 4, fontWeight: "bold" }}>Fecha de Remisión</td>
            <td style={{ border: "1px solid #000", padding: 4 }}>{remision.fecha_remision}</td>
            <td style={{ border: "1px solid #000", padding: 4, fontWeight: "bold" }}>Curso</td>
            <td style={{ border: "1px solid #000", padding: 4 }}>{remision.curso}</td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #000", padding: 4, fontWeight: "bold" }}>Nombre del Estudiante</td>
            <td style={{ border: "1px solid #000", padding: 4 }} colSpan={3}>{estudiante.nombre}</td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #000", padding: 4, fontWeight: "bold" }}>Documento</td>
            <td style={{ border: "1px solid #000", padding: 4 }}>{estudiante.documento || "—"}</td>
            <td style={{ border: "1px solid #000", padding: 4, fontWeight: "bold" }}>Jornada</td>
            <td style={{ border: "1px solid #000", padding: 4 }}>{remision.jornada}</td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #000", padding: 4, fontWeight: "bold" }}>Acudiente</td>
            <td style={{ border: "1px solid #000", padding: 4 }}>{remision.acudiente_nombre}</td>
            <td style={{ border: "1px solid #000", padding: 4, fontWeight: "bold" }}>Teléfono</td>
            <td style={{ border: "1px solid #000", padding: 4 }}>{remision.telefono_contacto}</td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #000", padding: 4, fontWeight: "bold" }}>EPS</td>
            <td style={{ border: "1px solid #000", padding: 4 }} colSpan={3}>{remision.eps}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginBottom: 8 }}>
        <b>MOTIVO REMISIÓN:</b> {check(remision.motivo_socioemocional)} Socioemocional &nbsp;&nbsp; {check(remision.motivo_familiar)} Familiar &nbsp;&nbsp; {check(remision.motivo_convivencial)} Convivencial
      </div>

      <div style={{ marginBottom: 6 }}><b>1. DESCRIPCIÓN DE LA SITUACIÓN OBSERVADA:</b></div>
      <div style={{ border: "1px solid #000", minHeight: 50, padding: 6, marginBottom: 10 }} dangerouslySetInnerHTML={{ __html: remision.descripcion_situacion || "" }} />

      <div style={{ marginBottom: 4 }}><b>2. ESTRATEGIAS APLICADAS CON EL ESTUDIANTE FRENTE A LA SITUACIÓN:</b></div>
      <div style={{ marginBottom: 4 }}>
        {check(remision.ajuste_metodologico)} Ajuste metodológico &nbsp;&nbsp; {check(remision.revision_normas)} Revisión normas de convivencia en clase &nbsp;&nbsp; {check(remision.acompanamiento_individual)} Acompañamiento individual
      </div>
      <div style={{ border: "1px solid #000", minHeight: 40, padding: 6, marginBottom: 10 }} dangerouslySetInnerHTML={{ __html: remision.estrategias_descripcion || "" }} />

      <div style={{ marginBottom: 6 }}><b>3. ESTRATEGIAS APLICADAS CON LAS FAMILIAS:</b></div>
      <div style={{ marginBottom: 4 }}>Nombre del padre, madre o acudiente: {remision.estrategias_familia_nombre}</div>
      <div style={{ marginBottom: 4 }}>Compromisos acordados ({remision.fecha_compromisos || "sin fecha"}):</div>
      <div style={{ border: "1px solid #000", minHeight: 30, padding: 6, marginBottom: 10 }} dangerouslySetInnerHTML={{ __html: remision.compromisos_acordados || "" }} />

      <div style={{ marginBottom: 6 }}><b>4. SEGUIMIENTO REALIZADO:</b></div>
      <div style={{ marginBottom: 4 }}>Se ha observado cambio en el estudiante: {siNo(remision.cambio_observado)}</div>
      <div style={{ marginBottom: 10 }}>Se evidencia cumplimiento en los compromisos establecidos: {siNo(remision.cumplimiento_compromisos)}</div>

      <div style={{ marginBottom: 6 }}><b>5. REMISIÓN A OTRAS DEPENDENCIAS (coordinación / docente de apoyo):</b></div>
      <div style={{ marginBottom: 4 }}>¿El estudiante ha sido remitido a otras dependencias? {siNo(remision.remitido_otras_dependencias)} &nbsp; ¿Cuál? {remision.cual_dependencia}</div>
      <div style={{ marginBottom: 4 }}>Motivo de la remisión: <span dangerouslySetInnerHTML={{ __html: remision.motivo_remision_otras || "" }} /></div>
      <div style={{ marginBottom: 16 }}>Acciones realizadas: <span dangerouslySetInnerHTML={{ __html: remision.acciones_realizadas || "" }} /></div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 30, marginBottom: 20 }}>
        <div style={{ borderTop: "1px solid #000", width: "40%", textAlign: "center", paddingTop: 4 }}>Firma Docente</div>
        <div style={{ borderTop: "1px solid #000", width: "40%", textAlign: "center", paddingTop: 4 }}>RECIBIDO POR: {remision.recibido_por} — FECHA: {remision.fecha_recibido || "___"}</div>
      </div>

      <div style={{ fontSize: 8.5, borderTop: "1px solid #999", paddingTop: 6, color: "#333" }}>
        Previo a remisión a orientación: 1) Se deben haber implementado acciones pedagógicas con el o la estudiante antes de abordar la remisión, cuando sea
        remitido por situaciones de convivencia o académico. 2) En caso de presentarse un diagnóstico de discapacidad, el o la estudiante será remitido a
        docente de apoyo pedagógico.
      </div>
    </div>
  );

  return createPortal(contenido, document.body);
}

export function RemisionModal({ estudiante, onClose }) {
  const [remisiones, setRemisiones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [institucion, setInstitucion] = useState(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [imprimiendo, setImprimiendo] = useState(null);

  const cargar = () => { setCargando(true); api.fetchRemisiones(estudiante.id).then((d) => { setRemisiones(d); setCargando(false); }); };
  useEffect(() => { cargar(); api.fetchInstitucion().then(setInstitucion); }, [estudiante.id]);

  const eliminar = async (r) => { if (!confirm("¿Eliminar esta remisión?")) return; await api.eliminarRemision(r.id); cargar(); };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 no-print" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">📨 Formato de Remisión — {estudiante.nombre}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        {formAbierto ? (
          <RemisionForm estudiante={estudiante} remision={editando} onCancelar={() => { setFormAbierto(false); setEditando(null); }}
            onGuardado={() => { setFormAbierto(false); setEditando(null); cargar(); }} />
        ) : (
          <button onClick={() => setFormAbierto(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white mb-3">+ Nueva remisión</button>
        )}

        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : remisiones.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Todavía no hay remisiones registradas para este estudiante.</p>
        ) : (
          <div className="space-y-2">
            {remisiones.map((r) => (
              <div key={r.id} className="bg-slate-50 rounded-xl p-3 flex justify-between items-start gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-700">{r.fecha_remision}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {[r.motivo_socioemocional && "Socioemocional", r.motivo_familiar && "Familiar", r.motivo_convivencial && "Convivencial"].filter(Boolean).join(", ") || "Sin motivo marcado"}
                  </div>
                  {r.descripcion_situacion && <TextoEnriquecido html={r.descripcion_situacion} className="text-xs text-slate-400 mt-1 line-clamp-2" />}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setImprimiendo(r)} className="text-xs text-slate-400 hover:text-violet-600" title="Imprimir / PDF">🖨️</button>
                  <button onClick={() => { setEditando(r); setFormAbierto(true); }} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
                  <button onClick={() => eliminar(r)} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {imprimiendo && (
        <RemisionPrintView remision={imprimiendo} estudiante={estudiante} institucion={institucion} onCerrado={() => setImprimiendo(null)} />
      )}
    </div>
  );
}
