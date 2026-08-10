import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabaseClient";
import { ACCIONES_RAPIDAS, ACADEMICO_POS, ACADEMICO_NEG, PILARES, CONVIVENCIAL_POS_EXTRA, CONVIVENCIAL_NEG, initials, nextLevel, reinoColor, reinoInfo, sugerirApellidos, colorGrado, REINO_COLORS, buscarEstudiantePorNombre } from "../lib/gamification";

// (REINO_COLORS ahora se importa directo desde gamification.js, ver arriba)
import * as api from "../lib/api";
import { ActasModal } from "./Actas";
import { DirectorioModal } from "./Directorio";

function LevelBar({ xp }) {
  const { level, next, pct } = nextLevel(xp);
  return (
    <div className="mb-1">
      <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
        <span className="font-semibold text-violet-600">{level.name}</span>
        <span>{xp}{next ? ` / ${next.min} XP` : " XP · nivel máximo"}</span>
      </div>
      <div className="h-2 rounded-full bg-violet-100 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
function VidaBar({ vida }) {
  const color = vida > 50 ? "from-emerald-400 to-emerald-500" : vida > 20 ? "from-amber-400 to-amber-500" : "from-rose-500 to-rose-600";
  return (
    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${vida}%` }} />
    </div>
  );
}

function QuickGamify({ estudiante, onAplicado }) {
  const [abierto, setAbierto] = useState(false);
  const [tab, setTab] = useState("rapido");
  const [cargando, setCargando] = useState(false);

  const aplicar = async (accion) => {
    setCargando(true);
    try {
      const nuevo = await api.registrarAccion(estudiante.id, accion);
      onAplicado(estudiante.id, nuevo);
      setAbierto(false);
    } catch (e) {
      alert("No se pudo registrar: " + e.message);
    }
    setCargando(false);
  };

  const TABS = [
    { key: "rapido", label: "Rápido" },
    { key: "academico_pos", label: "Académico +" },
    { key: "academico_neg", label: "Académico −" },
    { key: "pilares", label: "Pilares" },
    { key: "conviv_pos", label: "Convivencial +" },
    { key: "conviv_neg", label: "Convivencial −" },
  ];

  const listaActual = () => {
    if (tab === "rapido") return ACCIONES_RAPIDAS.map((a) => ({ label: a.label, xp: a.xp, vida: a.vida, categoria: a.categoria }));
    if (tab === "academico_pos") return ACADEMICO_POS.map((a) => ({ ...a, categoria: "academico" }));
    if (tab === "academico_neg") return ACADEMICO_NEG.map((a) => ({ ...a, categoria: "academico" }));
    if (tab === "pilares") return PILARES.map((a) => ({ ...a, categoria: a.key }));
    if (tab === "conviv_pos") return CONVIVENCIAL_POS_EXTRA.map((a) => ({ ...a, categoria: "convivencial" }));
    if (tab === "conviv_neg") return CONVIVENCIAL_NEG.map((a) => ({ ...a, categoria: "convivencial" }));
    return [];
  };

  return (
    <>
      <button onClick={() => setAbierto(true)} className="text-xs px-3 py-1.5 rounded-full bg-violet-500 text-white font-semibold">
        ⚡ Puntos
      </button>
      {abierto && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setAbierto(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl p-4 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-800">Gamificación — {estudiante.nombre}</h3>
              <button onClick={() => setAbierto(false)} className="text-slate-400">✕</button>
            </div>
            <div className="flex gap-1 mb-3 flex-wrap">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`text-xs px-2.5 py-1.5 rounded-full ${tab === t.key ? "bg-violet-500 text-white" : "bg-violet-50 text-violet-600"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {listaActual().map((a, i) => (
                <button key={i} disabled={cargando} onClick={() => aplicar(a)}
                  className={`text-xs text-left px-2.5 py-2 rounded-xl ${a.xp >= 0 ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-rose-50 text-rose-700 hover:bg-rose-100"}`}>
                  {a.label}<div className="text-[10px] opacity-70">{a.xp > 0 ? "+" : ""}{a.xp} XP</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function InclusionBadge({ estudiante, size = "text-sm" }) {
  if (!estudiante?.piar && !estudiante?.dua) return null;
  const partes = [estudiante.piar && "PIAR", estudiante.dua && "DUA"].filter(Boolean).join(" · ");
  return <span title={`Proceso de inclusión activo: ${partes}`} className={size}>🧩</span>;
}

export function InclusionModal({ estudiante, materiaId, onClose, onGuardado }) {
  const [piar, setPiar] = useState(!!estudiante.piar);
  const [dua, setDua] = useState(!!estudiante.dua);
  const [ajustes, setAjustes] = useState(estudiante.ajustes_inclusion || "");
  const [guardando, setGuardando] = useState(false);
  const [seguimientos, setSeguimientos] = useState([]);
  const [cargandoSeg, setCargandoSeg] = useState(true);
  const [nuevoTipo, setNuevoTipo] = useState("General");
  const [nuevaObs, setNuevaObs] = useState("");

  const cargarSeguimientos = () => {
    setCargandoSeg(true);
    api.fetchSeguimientosInclusion(estudiante.id).then((d) => { setSeguimientos(d); setCargandoSeg(false); });
  };
  useEffect(() => { cargarSeguimientos(); }, [estudiante.id]);

  const guardar = async () => {
    setGuardando(true);
    try {
      await api.guardarInclusion(estudiante.id, { piar, dua, ajustes_inclusion: ajustes.trim() || null });
      onGuardado?.({ ...estudiante, piar, dua, ajustes_inclusion: ajustes.trim() || null });
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  const agregarSeguimiento = async () => {
    if (!nuevaObs.trim()) return;
    try {
      await api.crearSeguimientoInclusion(estudiante.id, materiaId, nuevoTipo, nuevaObs.trim());
      setNuevaObs("");
      cargarSeguimientos();
    } catch (e) {
      alert("Error al guardar el seguimiento: " + e.message);
    }
  };

  const borrarSeguimiento = async (id) => {
    if (!confirm("¿Eliminar este registro de seguimiento?")) return;
    await api.eliminarSeguimientoInclusion(id);
    cargarSeguimientos();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">🧩 Proceso de inclusión — {estudiante.nombre}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        <div className="flex gap-4 mb-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={piar} onChange={(e) => setPiar(e.target.checked)} /> Tiene PIAR
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={dua} onChange={(e) => setDua(e.target.checked)} /> Aplica DUA
          </label>
        </div>

        <label className="text-xs text-slate-500 block mb-1">Ajustes razonables / apoyos acordados</label>
        <textarea value={ajustes} onChange={(e) => setAjustes(e.target.value)} rows={3}
          placeholder="Ej: Tiempo adicional en evaluaciones, material en letra ampliada, ubicación cerca al docente…"
          className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />

        <button disabled={guardando} onClick={guardar} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-60 mb-4">
          {guardando ? "Guardando…" : "Guardar"}
        </button>

        <div className="border-t border-slate-100 pt-4">
          <div className="text-xs font-semibold text-slate-600 mb-2">Bitácora de seguimiento</div>

          <div className="bg-violet-50 rounded-lg p-3 mb-3">
            <div className="flex gap-2 mb-2">
              {["PIAR", "DUA", "General"].map((t) => (
                <button key={t} onClick={() => setNuevoTipo(t)} className={`text-xs px-2.5 py-1 rounded-full ${nuevoTipo === t ? "bg-violet-500 text-white" : "bg-white text-slate-600"}`}>{t}</button>
              ))}
            </div>
            <textarea value={nuevaObs} onChange={(e) => setNuevaObs(e.target.value)} rows={2}
              placeholder="Ej: Se aplicó tiempo adicional en la evaluación del periodo, buen desempeño…"
              className="w-full text-xs rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none" />
            <button onClick={agregarSeguimiento} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white">+ Agregar al seguimiento</button>
          </div>

          {cargandoSeg ? (
            <div className="text-xs text-slate-400">Cargando…</div>
          ) : seguimientos.length === 0 ? (
            <div className="text-xs text-slate-400">Todavía no hay registros de seguimiento.</div>
          ) : (
            <div className="space-y-2">
              {seguimientos.map((s) => (
                <div key={s.id} className="border border-slate-100 rounded-lg p-2">
                  <div className="flex justify-between items-start">
                    <div className="text-[11px] font-semibold text-violet-600">{s.tipo} · {s.fecha}{s.materias?.nombre ? ` · ${s.materias.nombre}` : ""}</div>
                    <button onClick={() => borrarSeguimiento(s.id)} className="text-[10px] text-slate-300 hover:text-rose-500">✕</button>
                  </div>
                  <div className="text-xs text-slate-600 mt-1">{s.observacion}</div>
                  <div className="text-[10px] text-slate-400 mt-1">{s.profesores?.nombre}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TrasladoModal({ estudiante, grados, gradoActual, onClose, onTrasladado }) {
  const opciones = grados.filter((g) => g.id !== gradoActual);
  const [destino, setDestino] = useState(opciones[0]?.id || "");
  const [reiniciarGrupo, setReiniciarGrupo] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const trasladar = async () => {
    if (!destino) return;
    if (!confirm(`¿Trasladar a ${estudiante.nombre} al grado ${destino}? Conserva todas sus notas, asistencia y actas.`)) return;
    setGuardando(true);
    try {
      await api.trasladarEstudiante(estudiante.id, destino, reiniciarGrupo);
      onTrasladado();
      onClose();
    } catch (e) {
      alert("Error al trasladar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">🔀 Trasladar de grado</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          {estudiante.nombre} pasa del grado {gradoActual} a otro grado, conservando sus notas, asistencia, actas y progreso —
          no hace falta volver a crearlo ni recalificarlo.
        </p>

        <label className="text-xs text-slate-500 block mb-1">Grado destino</label>
        <select value={destino} onChange={(e) => setDestino(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none">
          {opciones.map((g) => <option key={g.id} value={g.id}>Grado {g.id}</option>)}
        </select>

        <label className="flex items-center gap-2 text-xs text-slate-600 mb-4">
          <input type="checkbox" checked={reiniciarGrupo} onChange={(e) => setReiniciarGrupo(e.target.checked)} />
          Reiniciar su grupo/reino a "Sin grupo" (recomendado, ya que los grupos suelen ser propios de cada grado)
        </label>

        <button disabled={guardando || !destino} onClick={trasladar} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Trasladando…" : "Confirmar traslado"}
        </button>
      </div>
    </div>
  );
}

function DocumentoModal({ estudiante, onClose, onGuardado }) {
  const [documento, setDocumento] = useState(estudiante.documento || "");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      await api.guardarDocumento(estudiante.id, documento);
      onGuardado(documento.trim() || null);
      onClose();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">🪪 Documento — {estudiante.nombre}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Se guarda completo, pero en las actas oficiales solo se muestran los últimos 4 dígitos.
        </p>
        <input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="Número de documento"
          className="w-full text-sm rounded-lg px-3 py-2 mb-4 border border-slate-200 outline-none" />
        <button disabled={guardando} onClick={guardar} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

function TarjetaEstudiante({ estudiante, onQuitar, onRenombrar, onAplicado, reinos, catalogoReinos, onCambiarReino, roles, onCambiarRol, onCodigoGenerado, grados, gradoActual, onTrasladado }) {
  const [actasAbiertas, setActasAbiertas] = useState(false);
  const [inclusionAbierta, setInclusionAbierta] = useState(false);
  const [trasladoAbierto, setTrasladoAbierto] = useState(false);
  const [documentoAbierto, setDocumentoAbierto] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombreTemp, setNombreTemp] = useState(estudiante.nombre);
  const codigo = estudiante.codigo_acceso || null;
  const progreso = estudiante.progreso?.[0] || estudiante.progreso || { xp: 0, vida: 100, monedas: 0 };
  const reino = estudiante.reino_actual || estudiante.reino_original || "Sin grupo";
  const infoReino = reinoInfo(reino, catalogoReinos);
  const rolActualId = estudiante.roles_asignados?.[0]?.rol_id || estudiante.roles_asignados?.rol_id || "";

  const generarCodigo = async () => {
    setGenerando(true);
    try {
      const nuevo = await api.generarCodigoAcceso(estudiante.id);
      onCodigoGenerado(estudiante.id, nuevo);
    } catch (e) {
      alert("No se pudo generar el código: " + e.message);
    }
    setGenerando(false);
  };

  const guardarNombre = async () => {
    if (!nombreTemp.trim()) { setNombreTemp(estudiante.nombre); setEditandoNombre(false); return; }
    if (nombreTemp.trim() !== estudiante.nombre) {
      try {
        await onRenombrar(estudiante.id, nombreTemp);
      } catch (e) {
        alert("Error al renombrar: " + e.message);
        setNombreTemp(estudiante.nombre);
      }
    }
    setEditandoNombre(false);
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <div className="flex items-start gap-3 mb-2">
        {infoReino.logo_url ? (
          <img src={infoReino.logo_url} alt="" className="w-10 h-10 object-contain rounded-full shrink-0 border border-slate-100" />
        ) : (
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: `${infoReino.color}22`, color: infoReino.color }}>
            {initials(estudiante.nombre)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {editandoNombre ? (
            <div className="flex items-center gap-1">
              <input autoFocus value={nombreTemp} onChange={(e) => setNombreTemp(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") guardarNombre(); if (e.key === "Escape") { setNombreTemp(estudiante.nombre); setEditandoNombre(false); } }}
                onBlur={guardarNombre}
                className="text-sm font-semibold text-slate-800 border-b border-violet-300 outline-none flex-1 min-w-0" />
            </div>
          ) : (
            <div className="text-sm font-semibold text-slate-800 flex items-center gap-1 min-w-0">
              <span className="truncate min-w-0">{estudiante.nombre}</span>
              <InclusionBadge estudiante={estudiante} />
              <button onClick={() => { setNombreTemp(estudiante.nombre); setEditandoNombre(true); }} title="Editar nombre" className="text-slate-300 hover:text-violet-500 text-xs shrink-0">✏️</button>
            </div>
          )}
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <select value={reino} onChange={(e) => onCambiarReino(estudiante.id, e.target.value)} className="text-xs bg-transparent outline-none">
              {reinos.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {roles && roles.length > 0 && (
            <select value={rolActualId} onChange={(e) => onCambiarRol(estudiante.id, e.target.value ? parseInt(e.target.value, 10) : null)}
              className="text-xs bg-violet-50 text-violet-600 rounded-full px-2 py-0.5 mt-1 outline-none">
              <option value="">Sin rol</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          )}
        </div>
        <div className="text-xs text-amber-500 font-semibold shrink-0">🪙 {progreso.monedas || 0}</div>
      </div>
      <LevelBar xp={progreso.xp || 0} />
      <VidaBar vida={progreso.vida ?? 100} />
      <div className="flex items-center justify-between mt-2">
        {codigo ? (
          <div className="text-[11px] text-slate-500">🔑 Código: <span className="font-mono font-bold text-violet-600">{codigo}</span></div>
        ) : (
          <button disabled={generando} onClick={generarCodigo} className="text-[11px] text-violet-500 underline">
            {generando ? "Generando…" : "🔑 Generar código de acceso"}
          </button>
        )}
      </div>
      <div className="flex justify-between items-center mt-2 relative">
        <div className="relative">
          <button onClick={() => setMenuAbierto((v) => !v)} className="text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">⋯ Más</button>
          {menuAbierto && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuAbierto(false)} />
              <div className="absolute left-0 bottom-full mb-1 bg-white rounded-xl shadow-lg border border-slate-100 py-1 w-48 z-20">
                {grados && grados.length > 1 && (
                  <button onClick={() => { setMenuAbierto(false); setTrasladoAbierto(true); }} className="w-full text-left text-xs px-3 py-2 hover:bg-slate-50">🔀 Trasladar de grado</button>
                )}
                <button onClick={() => { setMenuAbierto(false); setInclusionAbierta(true); }} className="w-full text-left text-xs px-3 py-2 hover:bg-slate-50">
                  {estudiante.piar || estudiante.dua ? "🧩 Inclusión" : "+ Inclusión"}
                </button>
                <button onClick={() => { setMenuAbierto(false); setActasAbiertas(true); }} className="w-full text-left text-xs px-3 py-2 hover:bg-slate-50">📋 Actas</button>
                <button onClick={() => { setMenuAbierto(false); setDocumentoAbierto(true); }} className="w-full text-left text-xs px-3 py-2 hover:bg-slate-50">🪪 Documento</button>
                <div className="border-t border-slate-100 my-1" />
                <button onClick={() => { setMenuAbierto(false); onQuitar(estudiante.id); }} className="w-full text-left text-xs px-3 py-2 hover:bg-rose-50 text-rose-500">🗑 Quitar de la lista</button>
              </div>
            </>
          )}
        </div>
        <QuickGamify estudiante={estudiante} onAplicado={onAplicado} />
      </div>
      {actasAbiertas && <ActasModal estudiante={estudiante} onClose={() => setActasAbiertas(false)} />}
      {inclusionAbierta && <InclusionModal estudiante={estudiante} onClose={() => setInclusionAbierta(false)} onGuardado={() => setInclusionAbierta(false)} />}
      {trasladoAbierto && (
        <TrasladoModal estudiante={estudiante} grados={grados} gradoActual={gradoActual} onClose={() => setTrasladoAbierto(false)} onTrasladado={onTrasladado} />
      )}
      {documentoAbierto && (
        <DocumentoModal estudiante={estudiante} onClose={() => setDocumentoAbierto(false)} onGuardado={onTrasladado} />
      )}
    </div>
  );
}

function ImportarEstudiantesModal({ gradoId, reinoDefault, onClose, onImportado }) {
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const fileRef = useRef(null);

  const procesarFilas = async (filas) => {
    const limpias = filas.filter((f) => f.nombre && f.nombre.trim()).map((f) => ({
      nombre: f.nombre.trim(), grado_id: gradoId, reino_original: (f.reino && f.reino.trim()) || reinoDefault,
    }));
    if (limpias.length === 0) { alert("No se encontraron nombres para importar."); return; }
    setCargando(true);
    try {
      await api.crearEstudiantesMasivo(limpias);
      onImportado(limpias.length);
      onClose();
    } catch (e) {
      alert("Error al importar: " + e.message);
    }
    setCargando(false);
  };

  const procesarPegado = () => {
    const filas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
      const partes = l.split(/\t|;|,/).map((x) => x.trim());
      return { nombre: partes[0], reino: partes[1] };
    });
    procesarFilas(filas);
  };

  const procesarArchivo = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "binary" });
        const hoja = wb.Sheets[wb.SheetNames[0]];
        const arr = XLSX.utils.sheet_to_json(hoja, { header: 1 });
        const filas = arr.filter((r) => r.length && r[0]).map((r) => ({ nombre: String(r[0]), reino: r[1] ? String(r[1]) : undefined }));
        procesarFilas(filas);
      } catch (err) {
        alert("No se pudo leer el archivo. Verifica que sea un .xlsx o .csv válido.");
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">Importar estudiantes — Grado {gradoId}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-1.5">Opción 1 — Pegar lista</div>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6}
          placeholder={"Un estudiante por línea.\nOpcional: 'Nombre, Grupo' por línea.\nEj:\nJuan Pérez, Reino Dorado\nMaría Gómez"}
          className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none font-mono" />
        <button disabled={cargando} onClick={procesarPegado} className="w-full text-sm font-semibold py-2 rounded-lg bg-violet-500 text-white mb-4 disabled:opacity-60">
          {cargando ? "Importando…" : "Importar lo pegado"}
        </button>
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-1.5">Opción 2 — Subir archivo (.xlsx / .csv)</div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { if (e.target.files[0]) procesarArchivo(e.target.files[0]); }} className="text-sm" />
        <p className="text-xs text-slate-400 mt-3">Primera columna: nombre. Segunda columna (opcional): grupo/reino.</p>
      </div>
    </div>
  );
}

function OrganizarApellidosModal({ estudiantes, onClose, onGuardado }) {
  const [filas, setFilas] = useState(
    estudiantes.map((s) => ({ id: s.id, nombre: s.nombre, apellidos: s.apellidos || sugerirApellidos(s.nombre) }))
  );
  const [guardando, setGuardando] = useState(false);

  const cambiar = (id, valor) => setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, apellidos: valor } : f)));

  const previa = [...filas].sort((a, b) =>
    `${a.apellidos} ${a.nombre}`.localeCompare(`${b.apellidos} ${b.nombre}`, "es", { sensitivity: "base" })
  );

  const guardar = async () => {
    setGuardando(true);
    try {
      for (const f of filas) {
        await api.guardarApellidos(f.id, f.apellidos);
      }
      onGuardado();
      onClose();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-slate-800">🔤 Organizar orden alfabético</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Se sugirió un apellido a partir del nombre completo de cada estudiante — revisalo y corregilo donde haga falta.
          Una vez guardado, ese apellido queda fijo y se usa siempre para ordenar (deja de adivinarse).
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1">Nombre completo → Apellido(s)</div>
            <div className="space-y-1.5">
              {filas.map((f) => (
                <div key={f.id} className="flex items-center gap-2">
                  <div className="flex-1 text-xs text-slate-600 truncate">{f.nombre}</div>
                  <input value={f.apellidos} onChange={(e) => cambiar(f.id, e.target.value)}
                    className="w-32 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1">Vista previa del orden resultante</div>
            <div className="space-y-1.5">
              {previa.map((f, i) => (
                <div key={f.id} className="text-xs text-slate-600 px-2 py-1.5 bg-slate-50 rounded-lg">{i + 1}. {f.nombre}</div>
              ))}
            </div>
          </div>
        </div>

        <button disabled={guardando} onClick={guardar} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-60 mt-4">
          {guardando ? "Guardando…" : "Guardar y aplicar orden"}
        </button>
      </div>
    </div>
  );
}

function CodigosModal({ estudiantes, gradoId, onClose, onActualizado }) {
  const [lista, setLista] = useState(estudiantes);
  const [generando, setGenerando] = useState(false);
  const [institucion, setInstitucion] = useState(null);
  const [imprimiendo, setImprimiendo] = useState(false);

  useEffect(() => { api.fetchInstitucion().then(setInstitucion); }, []);

  useEffect(() => {
    if (!imprimiendo) return;
    const id = setTimeout(() => window.print(), 150);
    const onAfter = () => setImprimiendo(false);
    window.addEventListener("afterprint", onAfter);
    return () => { clearTimeout(id); window.removeEventListener("afterprint", onAfter); };
  }, [imprimiendo]);

  const generarUno = async (id) => {
    try {
      const codigo = await api.generarCodigoAcceso(id);
      setLista((prev) => prev.map((s) => (s.id === id ? { ...s, codigo_acceso: codigo } : s)));
      onActualizado(id, codigo);
    } catch (e) {
      alert("No se pudo generar: " + e.message);
    }
  };

  const generarTodos = async () => {
    setGenerando(true);
    try {
      const faltantes = lista.filter((s) => !s.codigo_acceso);
      for (const s of faltantes) { await generarUno(s.id); }
    } catch (e) {
      alert("Error: " + e.message);
    }
    setGenerando(false);
  };

  const conCodigo = lista.filter((s) => s.codigo_acceso);

  const contenidoImprimible = imprimiendo ? (
    <div className="print-only" style={{ maxWidth: 900, margin: "0 auto", padding: 28, fontFamily: "Georgia, serif", color: "#1e293b" }}>
      <div style={{ textAlign: "center", marginBottom: 16, borderBottom: "2px solid #8B5CF6", paddingBottom: 10 }}>
        {institucion?.logo_url && (
          <img src={institucion.logo_url} alt="Logo" style={{ maxHeight: 60, marginBottom: 6, display: "block", marginLeft: "auto", marginRight: "auto" }} />
        )}
        <div style={{ fontSize: 18, fontWeight: "bold" }}>{institucion?.nombre || "Institución Educativa"}</div>
        <div style={{ fontSize: 14, marginTop: 4 }}>Códigos de acceso — Grado {gradoId}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {conCodigo.map((s) => (
          <div key={s.id} className="print-avoid-break" style={{ border: "1.5px dashed #C4B5FD", borderRadius: 8, padding: 10, textAlign: "center" }}>
            <div style={{ fontSize: 11, marginBottom: 4 }}>{s.nombre}</div>
            <div style={{ fontSize: 20, fontWeight: "bold", letterSpacing: 2, color: "#7C3AED", fontFamily: "monospace" }}>{s.codigo_acceso}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, fontSize: 10, color: "#64748b" }}>Generado el {new Date().toLocaleDateString("es-CO")} — codice-web.vercel.app/#estudiante</div>
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 no-print" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">Códigos de acceso</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <div className="flex gap-2 mb-4">
          <button disabled={generando} onClick={generarTodos} className="flex-1 text-sm font-semibold py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
            {generando ? "Generando…" : "🔑 Generar los que falten"}
          </button>
          <button disabled={conCodigo.length === 0} onClick={() => setImprimiendo(true)} className="text-sm font-semibold px-3 py-2 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40">
            🖨️ PDF
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {lista.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-700 truncate">{s.nombre}</span>
              {s.codigo_acceso ? (
                <span className="font-mono font-bold text-violet-600 text-sm shrink-0">{s.codigo_acceso}</span>
              ) : (
                <button onClick={() => generarUno(s.id)} className="text-xs text-violet-500 underline shrink-0">Generar</button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-4">Comparte cada código con el estudiante o acudiente correspondiente — con él pueden entrar desde el link de estudiantes.</p>
      </div>

      {contenidoImprimible && createPortal(contenidoImprimible, document.body)}
    </div>
  );
}

function PlanillaBlancoModal({ estudiantes, gradoId, onClose }) {
  const [institucion, setInstitucion] = useState({ nombre: "Institución Educativa", ciclo: "", anio: "", logo_url: null });
  const [docente, setDocente] = useState("");
  const [materia, setMateria] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [numColumnas, setNumColumnas] = useState(5);
  const [imprimiendo, setImprimiendo] = useState(false);

  useEffect(() => {
    api.fetchInstitucion().then(setInstitucion);
    supabase.auth.getUser().then(({ data }) => setDocente(data?.user?.email || ""));
  }, []);

  useEffect(() => {
    if (!imprimiendo) return;
    const id = setTimeout(() => window.print(), 150);
    const onAfter = () => setImprimiendo(false);
    window.addEventListener("afterprint", onAfter);
    return () => { clearTimeout(id); window.removeEventListener("afterprint", onAfter); };
  }, [imprimiendo]);

  const contenidoImprimible = imprimiendo ? (
    <div className="print-only" style={{ maxWidth: 900, margin: "0 auto", padding: 28, fontFamily: "Georgia, serif", color: "#1e293b" }}>
      <div style={{ textAlign: "center", marginBottom: 16, borderBottom: "2px solid #8B5CF6", paddingBottom: 10 }}>
        {institucion.logo_url && (
          <img src={institucion.logo_url} alt="Logo" style={{ maxHeight: 60, marginBottom: 6, display: "block", marginLeft: "auto", marginRight: "auto" }} />
        )}
        <div style={{ fontSize: 18, fontWeight: "bold" }}>{institucion.nombre}</div>
        {(institucion.ciclo || institucion.anio) && (
          <div style={{ fontSize: 11, color: "#64748b" }}>{institucion.ciclo}{institucion.ciclo && institucion.anio ? " — " : ""}{institucion.anio}</div>
        )}
        <div style={{ fontSize: 14, marginTop: 4 }}>Planilla de Calificaciones</div>
      </div>
      <table style={{ width: "100%", fontSize: 11, marginBottom: 14, borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={{ padding: 3, fontWeight: "bold" }}>Grado:</td><td style={{ padding: 3 }}>{gradoId}</td>
            <td style={{ padding: 3, fontWeight: "bold" }}>Materia:</td><td style={{ padding: 3 }}>{materia || "—"}</td>
          </tr>
          <tr>
            <td style={{ padding: 3, fontWeight: "bold" }}>Docente:</td><td style={{ padding: 3 }}>{docente || "—"}</td>
            <td style={{ padding: 3, fontWeight: "bold" }}>Periodo:</td><td style={{ padding: 3 }}>{periodo || "—"}</td>
          </tr>
        </tbody>
      </table>
      <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", border: "1px solid #cbd5e1" }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #cbd5e1", padding: 6, width: 28 }}>#</th>
            <th style={{ border: "1px solid #cbd5e1", padding: 6, textAlign: "left" }}>Estudiante</th>
            {Array.from({ length: numColumnas }).map((_, i) => (
              <th key={i} style={{ border: "1px solid #cbd5e1", padding: 6, width: 60 }}>&nbsp;</th>
            ))}
            <th style={{ border: "1px solid #cbd5e1", padding: 6, width: 70 }}>Nota Final</th>
          </tr>
        </thead>
        <tbody>
          {estudiantes.map((s, i) => (
            <tr key={s.id}>
              <td style={{ border: "1px solid #cbd5e1", padding: 6, textAlign: "center" }}>{i + 1}</td>
              <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>{s.nombre}</td>
              {Array.from({ length: numColumnas }).map((_, j) => (
                <td key={j} style={{ border: "1px solid #cbd5e1", padding: 6 }}>&nbsp;</td>
              ))}
              <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 16, fontSize: 10, color: "#64748b" }}>Generado el {new Date().toLocaleDateString("es-CO")}</div>
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 no-print" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">Imprimir planilla en blanco — Grado {gradoId}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <label className="text-xs text-slate-500 block mb-1">Materia (opcional)</label>
        <input value={materia} onChange={(e) => setMateria(e.target.value)} placeholder="Ej: Ética"
          className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none" />
        <label className="text-xs text-slate-500 block mb-1">Periodo (opcional)</label>
        <input value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="Ej: Periodo 1"
          className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none" />
        <label className="text-xs text-slate-500 block mb-1">Columnas en blanco para notas</label>
        <input type="number" min={1} max={10} value={numColumnas} onChange={(e) => setNumColumnas(parseInt(e.target.value || "1", 10))}
          className="w-full text-sm rounded-lg px-3 py-2 mb-4 border border-slate-200 outline-none" />
        <button onClick={() => setImprimiendo(true)} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white">
          🖨️ Imprimir / PDF
        </button>
      </div>

      {contenidoImprimible && createPortal(contenidoImprimible, document.body)}
    </div>
  );
}

export function VistaEstudiantes({ gradoId, grados, reinoFiltro, onVolver, onVerGrupos }) {
  const [estudiantes, setEstudiantes] = useState([]);
  const [roles, setRoles] = useState([]);
  const [catalogoReinos, setCatalogoReinos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [query, setQuery] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoReino, setNuevoReino] = useState("Sin grupo");
  const [importarAbierto, setImportarAbierto] = useState(false);
  const [codigosAbierto, setCodigosAbierto] = useState(false);
  const [planillaBlancoAbierta, setPlanillaBlancoAbierta] = useState(false);
  const [ordenAbierto, setOrdenAbierto] = useState(false);
  const [directorioAbierto, setDirectorioAbierto] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const [data, rolesData, reinosData] = await Promise.all([api.fetchEstudiantesPorGrado(gradoId), api.fetchRoles(), api.fetchReinos()]);
    setEstudiantes(data);
    setRoles(rolesData);
    setCatalogoReinos(reinosData);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, [gradoId]);

  const reinos = useMemo(() => {
    const set = new Set(estudiantes.map((s) => s.reino_actual || s.reino_original || "Sin grupo"));
    set.add("Sin grupo");
    return Array.from(set);
  }, [estudiantes]);

  const visibles = estudiantes
    .filter((s) => !reinoFiltro || (s.reino_actual || s.reino_original) === reinoFiltro)
    .filter((s) => s.nombre.toLowerCase().includes(query.toLowerCase()));

  const actualizarProgresoLocal = (id, nuevo) => {
    setEstudiantes((prev) => prev.map((s) => (s.id === id ? { ...s, progreso: [nuevo] } : s)));
  };

  const actualizarCodigoLocal = (id, codigo) => {
    setEstudiantes((prev) => prev.map((s) => (s.id === id ? { ...s, codigo_acceso: codigo } : s)));
  };

  const agregar = async () => {
    if (!nuevoNombre.trim()) return;
    await api.crearEstudiante({ nombre: nuevoNombre.trim(), grado_id: gradoId, reino_original: nuevoReino });
    setNuevoNombre("");
    cargar();
  };

  const quitar = async (id) => {
    if (!confirm("¿Quitar este estudiante de la lista?")) return;
    await api.quitarEstudiante(id);
    cargar();
  };

  const cambiarReino = async (id, reino) => {
    await api.cambiarReino(id, reino);
    setEstudiantes((prev) => prev.map((s) => (s.id === id ? { ...s, reino_actual: reino } : s)));
  };

  const renombrar = async (id, nombreNuevo) => {
    await api.editarNombreEstudiante(id, nombreNuevo);
    setEstudiantes((prev) => prev.map((s) => (s.id === id ? { ...s, nombre: nombreNuevo.trim() } : s)));
  };

  const cambiarRol = async (id, rolId) => {
    await api.asignarRol(id, rolId);
    setEstudiantes((prev) => prev.map((s) => (s.id === id ? { ...s, roles_asignados: rolId ? [{ rol_id: rolId }] : [] } : s)));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <button onClick={onVolver} className="text-sm text-violet-500">← Grados</button>
        {onVerGrupos && <button onClick={onVerGrupos} className="text-sm text-violet-500">👪 Ver por grupos/reinos</button>}
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-4">
        {reinoFiltro ? reinoFiltro : `Grado ${gradoId} — todos los estudiantes`}
      </h2>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3 mb-4">
        <div className="flex flex-wrap gap-2 items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wide text-slate-400">Agregar estudiante</div>
          <div className="flex gap-2">
            <button onClick={() => setCodigosAbierto(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">🔑 Ver códigos de acceso</button>
            <button onClick={() => setOrdenAbierto(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">🔤 Organizar orden alfabético</button>
            <button onClick={() => setDirectorioAbierto(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">👪 Directorio de acudientes</button>
            <button onClick={() => setPlanillaBlancoAbierta(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">🖨️ Planilla en blanco</button>
            <button onClick={() => setImportarAbierto(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-100 text-violet-700">📥 Importar varios</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Nombre del estudiante"
            className="flex-1 min-w-[180px] text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
          <select value={nuevoReino} onChange={(e) => setNuevoReino(e.target.value)} className="text-sm rounded-lg px-2 py-2 border border-slate-200 outline-none">
            {reinos.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button onClick={agregar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white">Agregar</button>
        </div>
      </div>
      {importarAbierto && (
        <ImportarEstudiantesModal
          gradoId={gradoId}
          reinoDefault={reinoFiltro || "Sin grupo"}
          onClose={() => setImportarAbierto(false)}
          onImportado={(n) => { cargar(); alert(`Se importaron ${n} estudiantes.`); }}
        />
      )}
      {codigosAbierto && (
        <CodigosModal
          estudiantes={visibles}
          gradoId={gradoId}
          onClose={() => setCodigosAbierto(false)}
          onActualizado={actualizarCodigoLocal}
        />
      )}
      {planillaBlancoAbierta && (
        <PlanillaBlancoModal estudiantes={visibles} gradoId={gradoId} onClose={() => setPlanillaBlancoAbierta(false)} />
      )}
      {ordenAbierto && (
        <OrganizarApellidosModal estudiantes={estudiantes} onClose={() => setOrdenAbierto(false)} onGuardado={cargar} />
      )}
      {directorioAbierto && (
        <DirectorioModal gradoId={gradoId} onClose={() => setDirectorioAbierto(false)} />
      )}

      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar estudiante…"
        className="w-full max-w-sm text-sm rounded-full px-4 py-2 border border-slate-200 outline-none mb-4" />

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : visibles.length === 0 ? (
        <div className="text-sm text-slate-400">No hay estudiantes todavía. Agrega el primero arriba.</div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {visibles.map((s) => (
            <TarjetaEstudiante key={s.id} estudiante={s} reinos={reinos} catalogoReinos={catalogoReinos} onQuitar={quitar} onRenombrar={renombrar} onCambiarReino={cambiarReino} onAplicado={actualizarProgresoLocal} roles={roles} onCambiarRol={cambiarRol} onCodigoGenerado={actualizarCodigoLocal} grados={grados} gradoActual={gradoId} onTrasladado={cargar} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReinoEditorModal({ reino, gradoId, otrosReinos, onClose, onGuardado }) {
  // reino puede ser un registro existente del catálogo, o { nombre, esNuevo: true }
  // para uno que todavía no está registrado (solo existe como texto en estudiantes).
  const [nombre, setNombre] = useState(reino.nombre || "");
  const [color, setColor] = useState(reino.color || reinoColor(reino.nombre || ""));
  const [logoUrl, setLogoUrl] = useState(reino.logo_url || null);
  const [guardando, setGuardando] = useState(false);
  const [destinoRetiro, setDestinoRetiro] = useState("Sin grupo");

  const subirLogo = (file) => {
    if (file.size > 500 * 1024) {
      alert("La imagen es muy grande. Usa un logo pequeño (menos de 500 KB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setLogoUrl(e.target.result);
    reader.readAsDataURL(file);
  };

  const guardar = async () => {
    if (!nombre.trim()) { alert("Escribe un nombre para el reino."); return; }
    setGuardando(true);
    try {
      if (reino.id) {
        // Ya existe en el catálogo: renombrar (en cascada) si cambió, y guardar color/logo
        if (nombre.trim() !== reino.nombre) {
          await api.renombrarReino(reino.id, reino.nombre, nombre.trim());
        }
        await api.guardarReino(reino.id, { color, logo_url: logoUrl });
      } else {
        // Todavía no está en el catálogo (era solo texto en estudiantes)
        const nuevo = await api.crearReino(nombre.trim(), color);
        await api.guardarReino(nuevo.id, { logo_url: logoUrl });
        if (nombre.trim() !== reino.nombre) {
          await api.renombrarReino(nuevo.id, reino.nombre, nombre.trim());
        }
      }
      onGuardado();
      onClose();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  const eliminarDelCatalogo = async () => {
    if (!confirm(`¿Quitar "${reino.nombre}" del catálogo? Solo pierde su color y logo personalizados — sigue apareciendo en el listado si hay estudiantes con este grupo.`)) return;
    setGuardando(true);
    try {
      await api.eliminarReino(reino.id);
      onGuardado();
      onClose();
    } catch (e) {
      alert("Error al eliminar: " + e.message);
    }
    setGuardando(false);
  };

  const retirarGrupo = async () => {
    if (!confirm(`¿Retirar el grupo "${reino.nombre}" por completo? Todos sus estudiantes pasarán a "${destinoRetiro}", y el grupo dejará de aparecer en cualquier listado.`)) return;
    setGuardando(true);
    try {
      await api.moverEstudiantesReino(gradoId, reino.nombre, destinoRetiro);
      if (reino.id) await api.eliminarReino(reino.id);
      onGuardado();
      onClose();
    } catch (e) {
      alert("Error al retirar el grupo: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">{reino.id ? "Editar reino" : "Registrar reino"}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        <label className="text-xs text-slate-500 block mb-1">Nombre del reino</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Reino del Fuego"
          className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />
        {reino.id && nombre.trim() !== reino.nombre && (
          <p className="text-[11px] text-amber-600 -mt-2 mb-3">Al guardar, se renombrará en todos los estudiantes que pertenezcan a este reino.</p>
        )}

        <label className="text-xs text-slate-500 block mb-1">Color</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {REINO_COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)}
              className="w-7 h-7 rounded-full border-2"
              style={{ background: c, borderColor: color === c ? "#1e293b" : "transparent" }} />
          ))}
        </div>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 mb-4" />

        <label className="text-xs text-slate-500 block mb-1">Logo (opcional)</label>
        <div className="flex items-center gap-3 mb-4">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-14 w-14 object-contain rounded-lg border border-slate-200" />
          ) : (
            <div className="h-14 w-14 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-400">Sin logo</div>
          )}
          <div className="flex flex-col gap-1">
            <input type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) subirLogo(e.target.files[0]); }} className="text-xs" />
            {logoUrl && <button onClick={() => setLogoUrl(null)} className="text-xs text-rose-500 text-left">Quitar logo</button>}
          </div>
        </div>

        <button disabled={guardando} onClick={guardar} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : "Guardar"}
        </button>

        <div className="border-t border-slate-100 mt-4 pt-4">
          <div className="text-xs font-semibold text-rose-600 mb-2">Retirar este grupo (ya no continúa)</div>
          <label className="text-xs text-slate-500 block mb-1">Mover a sus estudiantes a:</label>
          <select value={destinoRetiro} onChange={(e) => setDestinoRetiro(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none">
            <option value="Sin grupo">Sin grupo</option>
            {(otrosReinos || []).filter((r) => r !== reino.nombre).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button disabled={guardando} onClick={retirarGrupo} className="w-full text-xs font-semibold py-2 rounded-lg bg-rose-50 text-rose-600 disabled:opacity-60">
            🗑 Retirar grupo y mover estudiantes
          </button>
          {reino.id && (
            <button disabled={guardando} onClick={eliminarDelCatalogo} className="w-full text-[11px] text-slate-400 py-2 mt-1">
              Solo quitar del catálogo (mantener estudiantes en este grupo)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function VistaReinos({ gradoId, onElegirReino, onVerTodos, onVolver }) {
  const [estudiantes, setEstudiantes] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(null); // reino (del catálogo o { nombre, esNuevo }) que se está editando

  const cargar = () => {
    setCargando(true);
    Promise.all([api.fetchEstudiantesPorGrado(gradoId), api.fetchReinos()]).then(([est, cat]) => {
      setEstudiantes(est);
      setCatalogo(cat);
      setCargando(false);
    });
  };
  useEffect(() => { cargar(); }, [gradoId]);

  const reinos = useMemo(() => {
    const mapa = {};
    estudiantes.forEach((s) => {
      const r = s.reino_actual || s.reino_original || "Sin grupo";
      mapa[r] = (mapa[r] || 0) + 1;
    });
    return Object.entries(mapa);
  }, [estudiantes]);

  const abrirEditor = (nombre) => {
    const existente = catalogo.find((r) => r.nombre === nombre);
    setEditando(existente || { nombre });
  };

  return (
    <div>
      <button onClick={onVolver} className="text-sm text-violet-500 mb-3">← Grados</button>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-bold text-slate-800">Grado {gradoId} — Reinos</h2>
        <div className="flex gap-2">
          <button onClick={() => setEditando({ nombre: "" })} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-100 text-violet-700">+ Nuevo reino</button>
          <button onClick={onVerTodos} className="text-sm text-violet-500 font-semibold">Ver listado completo →</button>
        </div>
      </div>
      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : reinos.length === 0 ? (
        <div className="text-sm text-slate-400">Este grado no tiene estudiantes todavía.</div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {reinos.map(([nombre, n]) => {
            const info = reinoInfo(nombre, catalogo);
            return (
              <div key={nombre} className="relative bg-white rounded-2xl p-4 shadow-sm border-t-4" style={{ borderTopColor: info.color }}>
                <button onClick={() => abrirEditor(nombre)} title="Editar reino"
                  className="absolute top-2 right-2 text-xs w-6 h-6 rounded-full bg-slate-50 text-slate-400 hover:text-violet-600">✏️</button>
                <button onClick={() => onElegirReino(nombre)} className="text-left w-full">
                  <div className="flex items-center gap-2">
                    {info.logo_url && <img src={info.logo_url} alt="" className="w-8 h-8 object-contain rounded" />}
                    <div className="font-semibold text-slate-800">{nombre}</div>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{n} estudiante{n === 1 ? "" : "s"}</div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {editando && (
        <ReinoEditorModal reino={editando} gradoId={gradoId} otrosReinos={reinos.map(([nombre]) => nombre)} onClose={() => setEditando(null)} onGuardado={cargar} />
      )}
    </div>
  );
}

// Mapeo de columnas del formato típico de formularios de matrícula institucionales
// (una hoja por curso, con datos de padre/madre/acudiente/emergencia)
function extraerFilaAcudiente(fila) {
  const val = (clave) => (fila[clave] ?? "").toString().trim();
  const nombres = val("Nombres del Estudiante (Completos)") || val("Nombres del Estudiante");
  const apellidos = val("Apellidos del Estudiante");
  const direccionBase = val("Dirección de Residencia Principal");
  const direccionExtra = val("Detalles adicionales de dirección");
  return {
    nombreCompleto: [nombres, apellidos].filter(Boolean).join(" "),
    documento: val("profile_field_documento") || val("Documento"),
    direccion: [direccionBase, direccionExtra].filter(Boolean).join(" — ") || null,
    nombre_padre: val("profile_field_padre") || null,
    telefono_padre: val("profile_field_telefono_padre") || null,
    nombre_madre: val("profile_field_madre") || null,
    telefono_madre: val("profile_field_telefono_madre") || null,
    contacto_emergencia_nombre: val("CONTACTO DE EMERGENCIA (Distinto a padres/acudiente)") || null,
    contacto_emergencia_telefono: val("Teléfono del Contacto de Emergencia") || null,
  };
}

function ImportarDirectorioInstitucionalModal({ onClose }) {
  const [paso, setPaso] = useState(1);
  const [procesando, setProcesando] = useState(false);
  const [progresoTexto, setProgresoTexto] = useState("");
  const [resultado, setResultado] = useState(null);

  const procesarArchivo = (file) => {
    setProcesando(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      setTimeout(async () => {
        try {
          const wb = XLSX.read(e.target.result, { type: "binary" });
          const resumenPorCurso = [];
          for (const nombreHoja of wb.SheetNames) {
            const gradoId = nombreHoja.trim();
            const hoja = wb.Sheets[nombreHoja];
            const filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });
            if (filas.length === 0) continue;

            setProgresoTexto(`Cargando estudiantes del curso ${gradoId}…`);
            const estudiantesDelCurso = await api.fetchEstudiantesPorGrado(gradoId);

            let actualizados = 0;
            const sinEmparejar = [];

            for (let i = 0; i < filas.length; i++) {
              const datos = extraerFilaAcudiente(filas[i]);
              if (!datos.nombreCompleto.trim()) continue;
              setProgresoTexto(`Curso ${gradoId}: procesando ${i + 1} de ${filas.length}…`);

              const estudiante = buscarEstudiantePorNombre(datos.nombreCompleto, estudiantesDelCurso);
              if (!estudiante) { sinEmparejar.push(datos.nombreCompleto); continue; }

              if (datos.documento) await api.guardarDocumento(estudiante.id, datos.documento);
              await api.guardarAcudiente(estudiante.id, {
                nombre_padre: datos.nombre_padre, telefono_padre: datos.telefono_padre,
                nombre_madre: datos.nombre_madre, telefono_madre: datos.telefono_madre,
                contacto_emergencia_nombre: datos.contacto_emergencia_nombre, contacto_emergencia_telefono: datos.contacto_emergencia_telefono,
                contacto_emergencia_relacion: null, direccion: datos.direccion,
              });
              actualizados++;
            }
            resumenPorCurso.push({ gradoId, actualizados, sinEmparejar, total: filas.length });
          }
          setResultado(resumenPorCurso);
          setPaso(2);
        } catch (err) {
          alert("Error al procesar el archivo: " + err.message);
        }
        setProcesando(false);
      }, 50);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">🗂️ Importar directorio institucional</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        {paso === 1 ? (
          <>
            <p className="text-xs text-slate-500 mb-3">
              Subí el Excel de matrícula con <b>una hoja por curso</b> (ej: "801", "802", "803", "804") — cada nombre de hoja debe
              coincidir con un grado ya creado en la app. Reconoce automáticamente las columnas de nombre, documento, dirección,
              padre/madre y contacto de emergencia del formato típico de formularios de matrícula.
            </p>
            <input type="file" accept=".xlsx,.xls" disabled={procesando} onChange={(e) => { if (e.target.files[0]) procesarArchivo(e.target.files[0]); }} className="text-sm disabled:opacity-40" />
            {procesando && <p className="text-xs text-violet-600 mt-3">⏳ {progresoTexto || "Procesando…"}</p>}
          </>
        ) : (
          <div>
            <p className="text-sm text-emerald-600 mb-3">✔️ Importación completada.</p>
            <div className="space-y-2">
              {resultado.map((r) => (
                <div key={r.gradoId} className="bg-slate-50 rounded-lg p-3">
                  <div className="text-sm font-semibold text-slate-700">Curso {r.gradoId}</div>
                  <div className="text-xs text-slate-500">{r.actualizados} de {r.total} estudiantes actualizados.</div>
                  {r.sinEmparejar.length > 0 && (
                    <div className="text-xs text-amber-700 mt-1">
                      <b>No se encontraron ({r.sinEmparejar.length}):</b> {r.sinEmparejar.join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={onClose} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white mt-4">Listo</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function VistaGrados({ onElegirGrado }) {
  const [grados, setGrados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nuevoGrado, setNuevoGrado] = useState("");
  const [editandoColorDe, setEditandoColorDe] = useState(null);
  const [importarAbierto, setImportarAbierto] = useState(false);

  const cargar = async () => {
    setCargando(true);
    await api.asegurarGradosBase();
    const data = await api.fetchGrados();
    setGrados(data);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const crear = async () => {
    if (!nuevoGrado.trim()) return;
    await api.crearGrado(nuevoGrado.trim());
    setNuevoGrado("");
    cargar();
  };

  const elegirColor = async (gradoId, color) => {
    await api.guardarColorGrado(gradoId, color);
    setEditandoColorDe(null);
    cargar();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-bold text-slate-800">Grados</h2>
        <div className="flex gap-2">
          <input value={nuevoGrado} onChange={(e) => setNuevoGrado(e.target.value)} placeholder="Nuevo grado (ej: 1004)"
            className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none w-40" />
          <button onClick={crear} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white">Crear</button>
          <button onClick={() => setImportarAbierto(true)} className="text-sm font-semibold px-4 py-2 rounded-lg border border-slate-200 text-slate-600">🗂️ Importar directorio</button>
        </div>
      </div>
      <p className="text-xs text-slate-400 mb-3">El color de cada grado se usa automáticamente en el calendario de Horario y en otros lugares de la app. Tocá el círculo de color para cambiarlo.</p>
      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
          {grados.map((g) => {
            const color = colorGrado(g.id, grados);
            return (
              <div key={g.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 text-center hover:shadow-md relative">
                <button onClick={(e) => { e.stopPropagation(); setEditandoColorDe(editandoColorDe === g.id ? null : g.id); }}
                  className="absolute top-2 right-2 w-4 h-4 rounded-full border border-white shadow" style={{ background: color }} title="Cambiar color" />
                <button onClick={() => onElegirGrado(g.id)} className="w-full">
                  <div className="text-2xl font-bold" style={{ color }}>{g.id}</div>
                  <div className="text-xs text-slate-400 mt-1">Grado</div>
                </button>
                {editandoColorDe === g.id && (
                  <div className="absolute z-10 top-8 right-2 bg-white rounded-xl shadow-lg border border-slate-100 p-2 grid grid-cols-4 gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {REINO_COLORS.map((c) => (
                      <button key={c} onClick={() => elegirColor(g.id, c)} className="w-6 h-6 rounded-full border border-slate-200" style={{ background: c }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {importarAbierto && <ImportarDirectorioInstitucionalModal onClose={() => setImportarAbierto(false)} />}
    </div>
  );
}
