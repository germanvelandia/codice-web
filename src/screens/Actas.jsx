import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

const FALTAS_MANUAL = {
  leve: { tipo: "Leve", articulo: "Art. 68", plazoDias: 5 },
  grave: { tipo: "Grave", articulo: "Art. 69", plazoDias: 10 },
  gravisima: { tipo: "Gravísima", articulo: "Art. 70", plazoDias: 15 },
};

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
                    <div className="text-sm font-semibold text-slate-800">{a.tipo} · {a.fecha}</div>
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

      {actaImprimir && <ActaPrintView estudiante={estudiante} acta={actaImprimir} institucion={institucion} />}
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
  const [motivo, setMotivo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [compromisosAcademicos, setCompromisosAcademicos] = useState("");
  const [compromisosConvivenciales, setCompromisosConvivenciales] = useState("");
  const [categoriaFalta, setCategoriaFalta] = useState("leve");
  const [reincidente, setReincidente] = useState(false);
  const [incluirAsistencia, setIncluirAsistencia] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!motivo.trim()) { alert("Escribe al menos el motivo."); return; }
    setGuardando(true);
    try {
      const campos = {
        tipo, fecha, motivo: motivo.trim(), descripcion: descripcion.trim() || null,
        compromisos_academicos: compromisosAcademicos.trim() || null,
        compromisos_convivenciales: compromisosConvivenciales.trim() || null,
      };
      if (tipo === "Convivencial") {
        const f = FALTAS_MANUAL[categoriaFalta];
        campos.categoria_falta = categoriaFalta;
        campos.tipo_falta = (reincidente ? "Reincidente / " : "") + f.tipo;
        campos.articulo = f.articulo;
        campos.plazo_dias = f.plazoDias;
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
