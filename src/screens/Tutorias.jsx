import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

function imprimirActaTutoria(tutoria, estudianteNombre, institucion) {
  const ventana = window.open("", "_blank");
  ventana.document.write(`
    <html><head><title>Tutoría — ${estudianteNombre}</title></head>
    <body style="font-family: Arial, sans-serif; padding: 30px; font-size: 13px;">
      <div style="display:flex; align-items:center; gap:12px; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:16px;">
        ${institucion?.logo_url ? `<img src="${institucion.logo_url}" style="height:55px;" />` : ""}
        <div style="flex:1; text-align:center;">
          <div style="font-weight:bold; font-size:15px;">${institucion?.nombre || "INSTITUCIÓN EDUCATIVA"}</div>
          <div style="font-weight:bold; margin-top:4px; font-size:12px;">ACTA DE TUTORÍA INDIVIDUAL</div>
        </div>
      </div>
      <p><b>Estudiante:</b> ${estudianteNombre}</p>
      <p><b>Fecha:</b> ${tutoria.fecha || "—"}</p>
      <p><b>Tema:</b><br/>${tutoria.tema}</p>
      <p><b>Notas de la conversación:</b><br/>${tutoria.notas || "—"}</p>
      <p><b>Compromisos del estudiante:</b><br/>${tutoria.compromisos || "—"}</p>
      <p><b>Próximo seguimiento:</b> ${tutoria.proximo_seguimiento || "No programado"}</p>
      <div style="display:flex; justify-content:space-between; margin-top:60px;">
        <div style="border-top:1px solid #000; width:40%; text-align:center; padding-top:4px;">Firma del Estudiante</div>
        <div style="border-top:1px solid #000; width:40%; text-align:center; padding-top:4px;">Firma del Director de Curso / Tutor</div>
      </div>
      <script>window.print();</script>
    </body></html>
  `);
  ventana.document.close();
}

function TutoriaForm({ estudianteId, tutoria, onCancelar, onGuardada }) {
  const [fecha, setFecha] = useState(tutoria?.fecha || new Date().toISOString().slice(0, 10));
  const [tema, setTema] = useState(tutoria?.tema || "");
  const [notas, setNotas] = useState(tutoria?.notas || "");
  const [compromisos, setCompromisos] = useState(tutoria?.compromisos || "");
  const [proximoSeguimiento, setProximoSeguimiento] = useState(tutoria?.proximo_seguimiento || "");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!tema.trim()) { alert("Escribí el tema de la tutoría."); return; }
    setGuardando(true);
    try {
      const campos = { fecha, tema: tema.trim(), notas: notas.trim() || null, compromisos: compromisos.trim() || null, proximo_seguimiento: proximoSeguimiento || null };
      if (tutoria) await api.editarTutoria(tutoria.id, campos);
      else await api.crearTutoria(estudianteId, campos);
      onGuardada();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-xl p-3 mb-3">
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Próximo seguimiento (opcional)</label>
          <input type="date" value={proximoSeguimiento} onChange={(e) => setProximoSeguimiento(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
      </div>
      <label className="text-xs text-slate-500 block mb-1">Tema de la tutoría</label>
      <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ej: Orientación vocacional, dificultades de convivencia con el grupo…"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <label className="text-xs text-slate-500 block mb-1">Notas de la conversación</label>
      <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <label className="text-xs text-slate-500 block mb-1">Compromisos del estudiante</label>
      <textarea value={compromisos} onChange={(e) => setCompromisos(e.target.value)} rows={2} className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none bg-white" />
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-1.5">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : tutoria ? "Guardar cambios" : "Registrar tutoría"}
        </button>
      </div>
    </div>
  );
}

export function TutoriasModal({ estudiante, onClose }) {
  const [tutorias, setTutorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [institucion, setInstitucion] = useState(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);

  const cargar = () => { setCargando(true); api.fetchTutoriasEstudiante(estudiante.id).then((d) => { setTutorias(d); setCargando(false); }); };
  useEffect(() => { cargar(); api.fetchInstitucion().then(setInstitucion); }, [estudiante.id]);

  const eliminar = async (id) => { if (!confirm("¿Eliminar este registro de tutoría?")) return; await api.eliminarTutoria(id); cargar(); };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">🧑‍🏫 Tutoría individual — {estudiante.nombre}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">Registro de reuniones uno a uno con el estudiante (distinto de las citaciones a padres).</p>

        {formAbierto ? (
          <TutoriaForm estudianteId={estudiante.id} tutoria={editando}
            onCancelar={() => { setFormAbierto(false); setEditando(null); }}
            onGuardada={() => { setFormAbierto(false); setEditando(null); cargar(); }} />
        ) : (
          <button onClick={() => setFormAbierto(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white mb-3">+ Nueva tutoría</button>
        )}

        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : tutorias.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Todavía no hay tutorías registradas.</p>
        ) : (
          <div className="space-y-2">
            {tutorias.map((t) => (
              <div key={t.id} className="bg-slate-50 rounded-xl p-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-700">{t.tema}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{t.fecha}{t.proximo_seguimiento ? ` · Próximo: ${t.proximo_seguimiento}` : ""}</div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => imprimirActaTutoria(t, estudiante.nombre, institucion)} className="text-xs text-slate-400 hover:text-violet-600">🖨️</button>
                    <button onClick={() => { setEditando(t); setFormAbierto(true); }} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
                    <button onClick={() => eliminar(t.id)} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
                  </div>
                </div>
                {t.notas && <p className="text-[11px] text-slate-500 mt-1.5">{t.notas}</p>}
                {t.compromisos && <p className="text-[11px] text-emerald-600 mt-1">✓ Compromiso: {t.compromisos}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
