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

  const cargar = async () => {
    setCargando(true);
    const data = await api.fetchActasPorEstudiante(estudiante.id);
    setActas(data);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, [estudiante.id]);

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar esta acta?")) return;
    await api.eliminarActa(id);
    cargar();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
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
                  <button onClick={() => eliminar(a.id)} className="text-xs text-slate-400 hover:text-rose-500">✕</button>
                </div>
                {a.descripcion && <p className="text-xs text-slate-600 mt-2">{a.descripcion}</p>}
                {a.tipo_falta && (
                  <div className="text-xs text-amber-600 mt-2">Falta {a.tipo_falta} ({a.articulo}) · Plazo: {a.plazo_dias} días hábiles</div>
                )}
                {(a.compromisos || a.compromisos_academicos || a.compromisos_convivenciales) && (
                  <div className="text-xs text-slate-600 mt-2">
                    <b>Compromisos:</b> {a.compromisos || [a.compromisos_academicos, a.compromisos_convivenciales].filter(Boolean).join(" · ")}
                  </div>
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
    </div>
  );
}

function NuevaActaForm({ estudianteId, onCancelar, onGuardada }) {
  const [tipo, setTipo] = useState("Convivencial");
  const [fecha, setFecha] = useState(hoyISO());
  const [motivo, setMotivo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [compromisos, setCompromisos] = useState("");
  const [categoriaFalta, setCategoriaFalta] = useState("leve");
  const [incluirAsistencia, setIncluirAsistencia] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!motivo.trim()) { alert("Escribe al menos el motivo."); return; }
    setGuardando(true);
    try {
      const campos = { tipo, fecha, motivo: motivo.trim(), descripcion: descripcion.trim() || null, compromisos: compromisos.trim() || null };
      if (tipo === "Convivencial") {
        const f = FALTAS_MANUAL[categoriaFalta];
        campos.categoria_falta = categoriaFalta;
        campos.tipo_falta = f.tipo;
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

      {tipo === "Convivencial" && (
        <div className="mb-3">
          <label className="text-xs text-slate-500 block mb-1">Categoría de la falta (Manual de Convivencia)</label>
          <div className="flex gap-1">
            {Object.entries(FALTAS_MANUAL).map(([key, f]) => (
              <button key={key} onClick={() => setCategoriaFalta(key)}
                className={`text-xs px-3 py-1.5 rounded-full ${categoriaFalta === key ? "bg-violet-500 text-white" : "bg-white text-slate-600"}`}>
                {f.tipo} ({f.articulo})
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-2">
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
      </div>
      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo del acta"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} placeholder="Descripción de la situación"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <textarea value={compromisos} onChange={(e) => setCompromisos(e.target.value)} rows={2} placeholder="Compromisos acordados"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />

      <label className="flex items-center gap-2 text-xs text-slate-500 mb-3">
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
