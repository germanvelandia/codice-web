import React, { useEffect, useState } from "react";
import { LeccionVista } from "./LeccionVista";
import * as api from "../lib/modulosApi";
import { TIPOS_ACTIVIDAD, urlSegura, videoIncrustable } from "../lib/modulos";

// Ruta de módulos de estudio para el portal del estudiante.
// Props: estudianteId, gradoId (opcional), onVolver (opcional), onPremio({xp, oro}) (opcional: para refrescar la barra de XP del portal)
export function ModulosEstudiante({ estudianteId, gradoId = null, onVolver, onPremio }) {
  const [datos, setDatos] = useState(null);          // { estados, resumen }
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(null);      // id del módulo que se está estudiando
  const [aviso, setAviso] = useState(null);          // celebración al completar un módulo

  const cargar = async () => {
    try { setDatos(await api.fetchModulosEstudiante(estudianteId, gradoId)); setError(""); }
    catch (e) { if (api.sinTablasModulos(e)) setError("Los módulos todavía no están disponibles."); else setError(e.message || "No se pudieron cargar los módulos."); setDatos({ estados: [], resumen: [] }); }
  };
  useEffect(() => { cargar(); }, [estudianteId]);
  if (!datos) return <p className="text-sm text-slate-400 p-4">Cargando tus módulos…</p>;

  if (abierto) return <Modulo estudianteId={estudianteId} gradoId={gradoId} moduloId={abierto} onVolver={() => { setAbierto(null); cargar(); }} onCompleto={(r) => { setAviso(r); if (onPremio && r.premio) onPremio(r.premio); }} />;

  const porMateria = new Map();
  datos.estados.forEach((e) => { const k = e.materia_id ?? 0; if (!porMateria.has(k)) porMateria.set(k, []); porMateria.get(k).push(e); });
  return (
    <div className="p-4 max-w-2xl mx-auto" data-testid="modulos-estudiante">
      {onVolver && <button onClick={onVolver} className="text-sm text-violet-600 mb-3">← Volver</button>}
      <h2 className="text-xl font-bold text-slate-800 mb-1">📘 Mis módulos de estudio</h2>
      <p className="text-xs text-slate-500 mb-4">Completa las actividades de cada módulo en orden. Al terminar un módulo ganas XP y oro, y se abre el siguiente.</p>
      {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 mb-3">{error}</div>}
      {aviso && aviso.moduloCompleto && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 mb-4 text-sm" data-testid="celebracion">
          🎉 ¡Módulo completado!{aviso.premio && (aviso.premio.xp > 0 || aviso.premio.oro > 0) ? <> Ganaste <b>{aviso.premio.xp} XP</b> y <b>{aviso.premio.oro} 🪙</b>.</> : null}
          {aviso.evento && <div className="text-xs mt-1">{aviso.evento.emoji} Bono de «{aviso.evento.nombre}»</div>}
          <button onClick={() => setAviso(null)} className="ml-2 text-xs underline">Cerrar</button>
        </div>
      )}
      {!datos.estados.length && !error && <p className="text-sm text-slate-400" data-testid="sin-modulos">Tu docente todavía no ha publicado módulos para tu curso.</p>}
      {datos.resumen.map((r) => (
        <section key={r.materia_id ?? 0} className="mb-6">
          <div className="flex items-baseline justify-between mb-2"><h3 className="font-bold text-slate-700">{r.nombre}</h3><span className="text-[11px] text-slate-500">{r.completos} de {r.modulos} módulos · {r.pct}%</span></div>
          <div className="space-y-2">
            {(porMateria.get(r.materia_id ?? 0) || []).filter((e) => e.estado !== "vacio").map((e) => {
              const bloq = e.estado === "bloqueado", comp = e.estado === "completo";
              return (
                <button key={e.id} disabled={bloq} onClick={() => { setAviso(null); setAbierto(e.id); }} data-testid={`mod-${e.id}`} data-estado={e.estado}
                  className={`w-full text-left rounded-2xl border p-3 flex items-center gap-3 ${bloq ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed" : comp ? "bg-emerald-50 border-emerald-200" : "bg-white border-violet-200 shadow-sm"}`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-white border border-slate-200 shrink-0">{bloq ? "🔒" : comp ? "✅" : e.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">Módulo {e.numero} · {e.nombre}</div>
                    <div className="h-1.5 bg-slate-200 rounded-full mt-1.5 overflow-hidden"><div className="h-full bg-violet-500" style={{ width: `${e.pct}%` }} /></div>
                    <div className="text-[11px] text-slate-500 mt-1">{bloq ? "Termina el módulo anterior para abrirlo" : `${e.hechas} de ${e.total} actividades · ${e.xp} XP + ${e.oro} 🪙`}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function Modulo({ estudianteId, gradoId, moduloId, onVolver, onCompleto }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState({});            // actividadId → respuesta equivocada
  const [final, setFinal] = useState(null);
  const cargar = async () => { try { setD(await api.fetchModuloEstudiante(estudianteId, moduloId, gradoId)); } catch (e) { setError(e.message || "No se pudo abrir el módulo."); setD({ noExiste: true }); } };
  useEffect(() => { cargar(); }, [moduloId]);
  if (!d) return <p className="text-sm text-slate-400 p-4">Abriendo el módulo…</p>;
  if (d.noExiste || d.bloqueado) return <div className="p-4"><button onClick={onVolver} className="text-sm text-violet-600 mb-3">← Volver</button><p className="text-sm text-slate-500">{error || (d.bloqueado ? "Primero termina el módulo anterior." : "Este módulo ya no está disponible.")}</p></div>;

  const hacer = async (a, respuesta = null) => {
    if (ocupado) return; setOcupado(true); setError("");
    const r = await api.completarActividad(estudianteId, a.id, { respuesta }, gradoId);
    if (!r.ok) setError(r.mensaje || "No se pudo guardar tu avance.");
    else if (r.faltaReflexion) setError(r.mensaje);
    else if (r.correcto === false) setFallo((f) => ({ ...f, [a.id]: respuesta }));
    else { setFallo((f) => { const n = { ...f }; delete n[a.id]; return n; }); if (r.moduloCompleto && r.premio) { setFinal(r); onCompleto(r); } }
    await cargar(); setOcupado(false);
  };
  const { modulo: m, actividades } = d, hechas = actividades.filter((a) => a.hecha).length;
  return (
    <div className="p-4 max-w-2xl mx-auto" data-testid="modulo-abierto">
      <button onClick={onVolver} className="text-sm text-violet-600 mb-3">← Mis módulos</button>
      <h2 className="text-lg font-bold text-slate-800">{m.emoji} Módulo {m.numero} · {m.nombre}</h2>
      {m.descripcion && <p className="text-sm text-slate-500 mt-1">{m.descripcion}</p>}
      <div className="h-2 bg-slate-200 rounded-full mt-3 mb-1 overflow-hidden"><div className="h-full bg-violet-500 transition-all" style={{ width: `${actividades.length ? Math.round((hechas / actividades.length) * 100) : 0}%` }} /></div>
      <p className="text-[11px] text-slate-500 mb-4">{hechas} de {actividades.length} actividades</p>
      {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 mb-3" data-testid="error-modulo">{error}</div>}
      {final && final.moduloCompleto && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 mb-4 text-sm" data-testid="modulo-completo">
          🎉 ¡Terminaste este módulo!{final.premio && (final.premio.xp > 0 || final.premio.oro > 0) ? <> Ganaste <b>{final.premio.xp} XP</b> y <b>{final.premio.oro} 🪙</b>.</> : null}
        </div>
      )}
      <div className="space-y-3">
        {actividades.map((a) => (
          <article key={a.id} className={`rounded-2xl border p-3 ${a.hecha ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"}`} data-testid={`act-${a.id}`} data-hecha={a.hecha ? "1" : "0"}>
            <div className="flex items-center gap-2 mb-2"><span>{a.hecha ? "✅" : TIPOS_ACTIVIDAD[a.tipo]?.emoji}</span><h4 className="text-sm font-semibold text-slate-800 flex-1">{a.titulo}</h4><span className="text-[10px] text-slate-400">{TIPOS_ACTIVIDAD[a.tipo]?.nombre}</span></div>
            {a.tipo === "leccion" && <LeccionDeActividad a={a} estudianteId={estudianteId} onTerminar={() => hacer(a)} />}
            {a.tipo === "lectura" && <p className="text-sm text-slate-700 whitespace-pre-wrap mb-2">{a.contenido}</p>}
            {a.tipo === "enlace" && urlSegura(a.contenido) && <a href={urlSegura(a.contenido)} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-600 underline break-all block mb-2">🔗 Abrir el enlace</a>}
            {a.tipo === "video" && (videoIncrustable(a.contenido)
              ? <div className="aspect-video mb-2"><iframe src={videoIncrustable(a.contenido)} title={a.titulo} className="w-full h-full rounded-lg" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>
              : urlSegura(a.contenido) && <a href={urlSegura(a.contenido)} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-600 underline break-all block mb-2">🎬 Abrir el video</a>)}
            {a.tipo === "pregunta" && (
              <div>
                <p className="text-sm text-slate-700 mb-2">{a.contenido}</p>
                <div className="space-y-1.5">
                  {(a.opciones || []).map((o, i) => {
                    const malo = fallo[a.id] === i, bien = a.hecha && Number(a.correcta) === i;
                    return <button key={i} disabled={a.hecha || ocupado} onClick={() => hacer(a, i)} data-testid={`op-${a.id}-${i}`} className={`w-full text-left text-sm rounded-lg border px-3 py-2 ${bien ? "bg-emerald-100 border-emerald-300" : malo ? "bg-rose-50 border-rose-300" : "bg-white border-slate-200"}`}>{String.fromCharCode(65 + i)}. {o}</button>;
                  })}
                </div>
                {fallo[a.id] != null && !a.hecha && <p className="text-xs text-rose-600 mt-2" data-testid={`mal-${a.id}`}>Esa no es. ¡Inténtalo otra vez!</p>}
              </div>
            )}
            {a.tipo !== "pregunta" && a.tipo !== "leccion" && !a.hecha && <button disabled={ocupado} onClick={() => hacer(a)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-60" data-testid={`hecho-${a.id}`}>{a.tipo === "lectura" ? "Ya la leí" : a.tipo === "video" ? "Ya lo vi" : "Ya lo revisé"}</button>}
          </article>
        ))}
      </div>
    </div>
  );
}

// Carga lo que el estudiante ya escribió en las reflexiones y muestra la lección
function LeccionDeActividad({ a, estudianteId, onTerminar }) {
  const [refl, setRefl] = useState(null);
  useEffect(() => { let vivo = true; api.fetchReflexiones(estudianteId, a.id).then((r) => vivo && setRefl(r)); return () => { vivo = false; }; }, [a.id, estudianteId]);
  if (!refl) return <p className="text-sm text-slate-400">Abriendo la lección…</p>;
  return <LeccionVista actividad={a} hecha={a.hecha} reflexiones={refl} onGuardarReflexion={(bloqueId, texto) => api.guardarReflexion(estudianteId, a.id, bloqueId, texto)} onTerminar={onTerminar} />;
}
