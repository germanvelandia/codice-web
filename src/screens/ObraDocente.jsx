import React, { useEffect, useMemo, useState } from "react";
import * as ob from "../lib/mundoObras";
import { crearOpciones, costoTotal, totalPiezas, EMOJI_RECURSO, RECURSOS_OBRA } from "../game/obras";
import { fetchEstudiantesPorGrado, fetchTriviaCategorias } from "../lib/api";
import { descargarArchivo } from "../lib/informeImpacto";

const ESTADO = { preparacion: ["En preparación", "bg-slate-100 text-slate-600"], votacion: ["🗳️ Votación abierta", "bg-amber-100 text-amber-700"], construccion: ["🔨 En construcción", "bg-emerald-100 text-emerald-700"], terminada: ["🏆 Terminada", "bg-violet-100 text-violet-700"] };
const nombreGrado = (g) => g?.nombre || g?.id;
const primerNombre = (n) => String(n || "").trim().split(/\s+/)[0] || "—";

export function VistaObraDocente({ grados = [] }) {
  const [gradoId, setGradoId] = useState(grados[0]?.id ?? "");
  const [obras, setObras] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  useEffect(() => { if (!gradoId && grados[0]) setGradoId(grados[0].id); }, [grados]);

  const cargar = async () => {
    try { setObras(await ob.fetchObrasDocente()); setError(""); }
    catch (e) { setError(e.message || "No se pudieron cargar las obras. ¿Ya corriste el SQL 99?"); }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const delGrado = obras.filter((o) => String(o.grado_id) === String(gradoId));
  const viva = delGrado.find((o) => o.estado !== "terminada") || null;
  const terminadas = delGrado.filter((o) => o.estado === "terminada");

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">🏗️ La Gran Obra del curso</h3>
      <p className="text-xs text-slate-400 mb-3">Una construcción colaborativa dentro del Mundo: tus estudiantes votan qué construir y la levantan entre todos (recolectores aportan recursos, constructores colocan piezas, y cada fase pide acertar preguntas en equipo). Una obra por curso.</p>
      <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-lg px-3 py-2 border border-slate-200 bg-white outline-none mb-3">
        {grados.map((g) => <option key={g.id} value={g.id}>{nombreGrado(g)}</option>)}
      </select>
      {error && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2 mb-3">{error}</div>}
      {cargando ? <p className="text-xs text-slate-400">Cargando…</p> : viva
        ? <PanelObra key={viva.id} obra={viva} gradoId={gradoId} onCambio={cargar} />
        : <CrearObra gradoId={gradoId} nombre={nombreGrado(grados.find((g) => String(g.id) === String(gradoId)))} onCreada={cargar} />}
      {terminadas.length > 0 && (
        <div className="mt-6">
          <div className="text-xs font-semibold text-slate-600 mb-1">Obras terminadas de este curso</div>
          {terminadas.map((o) => (
            <div key={o.id} className="flex items-center justify-between text-xs bg-violet-50 rounded-lg px-3 py-2 mb-1">
              <span>🏆 {o.titulo} · {o.opciones.find((x) => x.id === o.opcion_id)?.nombre || ""} · {new Date(o.creado_en).toLocaleDateString()}</span>
              <button onClick={async () => { if (!confirm("¿Borrar esta obra terminada y su historial?")) return; await ob.eliminarObra(o.id); cargar(); }} className="text-slate-400 hover:text-rose-500">🗑</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CrearObra({ gradoId, nombre, onCreada }) {
  const catalogo = useMemo(() => crearOpciones(), []);
  const [titulo, setTitulo] = useState("");
  const [elegidas, setElegidas] = useState(catalogo.map((o) => o.id));
  const [categorias, setCategorias] = useState([]);
  const [categoria, setCategoria] = useState("");
  const [tope, setTope] = useState(20);
  const [topeRetos, setTopeRetos] = useState(10);
  const [creando, setCreando] = useState(false);
  useEffect(() => { fetchTriviaCategorias().then(setCategorias).catch(() => setCategorias([])); }, []);
  useEffect(() => { setTitulo(`La Gran Obra de ${nombre || "mi curso"}`); }, [nombre]);

  const alternar = (id) => setElegidas((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
  const crear = async () => {
    setCreando(true);
    try { await ob.crearObraDocente({ gradoId, titulo, opcionesIds: elegidas, retoCategoria: categoria || null, topeDia: tope, retoTopeDia: topeRetos }); onCreada(); }
    catch (e) { alert("No se pudo crear: " + (e.message || e)); }
    setCreando(false);
  };
  return (
    <div className="bg-slate-50 rounded-2xl p-3 space-y-3">
      <div className="text-sm font-bold text-slate-700">Nueva obra para {nombre}</div>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 bg-white outline-none" placeholder="Título" />
      <div>
        <div className="text-xs font-semibold text-slate-600 mb-1">1) Opciones que tus estudiantes podrán votar (mínimo 2)</div>
        {catalogo.map((o) => {
          const c = costoTotal(o);
          return (
            <label key={o.id} className={`flex gap-2 items-start rounded-xl border p-2 mb-1.5 cursor-pointer ${elegidas.includes(o.id) ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-white"}`}>
              <input type="checkbox" checked={elegidas.includes(o.id)} onChange={() => alternar(o.id)} className="mt-1" />
              <span className="text-2xl">{o.emoji}</span>
              <span className="min-w-0">
                <b className="text-sm text-slate-700">{o.nombre}</b>
                <span className="block text-[11px] text-slate-500">{o.desc}</span>
                <span className="block text-[11px] text-slate-400">{o.fases.length} fases · {totalPiezas(o)} piezas · {RECURSOS_OBRA.filter((k) => c[k]).map((k) => `${c[k]}${EMOJI_RECURSO[k]}`).join(" ")}</span>
              </span>
            </label>
          );
        })}
      </div>
      <div>
        <div className="text-xs font-semibold text-slate-600 mb-1">2) Preguntas del reto en equipo (cada fase pide aciertos entre todos)</div>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 bg-white outline-none">
          <option value="">Todas las categorías de Preguntados</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.emoji ? c.emoji + " " : ""}{c.nombre}{c.materia_nombre ? ` · ${c.materia_nombre}` : ""}</option>)}
        </select>
        <p className="text-[11px] text-slate-400 mt-1">Usa tu banco de Preguntados. Elige la categoría de tu materia para que la obra refuerce lo que están viendo.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-slate-500">Recursos que cada estudiante puede aportar por día
          <input type="number" min="1" max="60" value={tope} onChange={(e) => setTope(e.target.value)} className="w-full text-sm rounded-lg px-2 py-1.5 border border-slate-200 bg-white" /></label>
        <label className="text-[11px] text-slate-500">Preguntas del reto por estudiante por día
          <input type="number" min="1" max="40" value={topeRetos} onChange={(e) => setTopeRetos(e.target.value)} className="w-full text-sm rounded-lg px-2 py-1.5 border border-slate-200 bg-white" /></label>
      </div>
      <button disabled={creando || elegidas.length < 2} onClick={crear} className="w-full text-sm font-semibold py-2.5 rounded-xl bg-violet-500 text-white disabled:opacity-50">{creando ? "Creando…" : "Crear obra (queda en preparación)"}</button>
      <p className="text-[11px] text-slate-400">Después la abres a votación cuando quieras. Los estudiantes la ven en el Mundo, en el cartel 🏗️ junto a su parcela.</p>
    </div>
  );
}

function PanelObra({ obra, gradoId, onCambio }) {
  const [det, setDet] = useState(null);
  const [estudiantes, setEstudiantes] = useState([]);
  const [trabajando, setTrabajando] = useState(false);
  const [forzar, setForzar] = useState("");

  const cargarDet = () => ob.fetchDetalleObra(obra.id).then(setDet).catch(() => {});
  useEffect(() => { fetchEstudiantesPorGrado(gradoId).then(setEstudiantes).catch(() => setEstudiantes([])); }, [gradoId]);
  useEffect(() => { cargarDet(); const id = setInterval(() => { if (!document.hidden) { cargarDet(); onCambio(); } }, 20000); return () => clearInterval(id); }, [obra.id]);

  const accion = async (fn) => { setTrabajando(true); try { await fn(); await onCambio(); await cargarDet(); } catch (e) { alert(ob.mensajeObra(e)); } setTrabajando(false); };
  const [txtEstado, clsEstado] = ESTADO[obra.estado];
  const opElegida = obra.opciones.find((x) => x.id === obra.opcion_id);
  const nombreDe = useMemo(() => new Map(estudiantes.map((e) => [String(e.id), e.nombre])), [estudiantes]);

  // ---- cifras de la obra ----
  const votos = useMemo(() => { const c = {}; (det?.votos || []).forEach((v) => { c[v.opcion_id] = (c[v.opcion_id] || 0) + 1; }); return c; }, [det]);
  const porEst = useMemo(() => {
    const m = new Map(estudiantes.map((e) => [String(e.id), { id: String(e.id), nombre: e.nombre, recursos: 0, piezas: 0, aciertos: 0, intentos: 0, rol: null }]));
    (det?.roles || []).forEach((r) => { const x = m.get(String(r.estudiante_id)); if (x) x.rol = r.rol; });
    (det?.aportes || []).forEach((a) => { const x = m.get(String(a.estudiante_id)); if (!x) return; if (a.tipo === "recurso") x.recursos += a.cantidad; else if (a.tipo === "pieza") x.piezas++; else { x.intentos++; if (a.item === "acierto") x.aciertos++; } });
    return [...m.values()];
  }, [det, estudiantes]);
  const activos = porEst.filter((e) => e.recursos + e.piezas + e.intentos > 0);
  const sinAportar = porEst.filter((e) => e.recursos + e.piezas + e.intentos === 0);
  const fases = opElegida?.fases || [];
  const faseActual = obra.estado === "construccion" ? fases[obra.fase] : null;
  const piezasTotal = fases.reduce((a, f) => a + f.piezas.length, 0);
  const colocadas = det?.piezas.length || 0;

  const csv = () => {
    const filas = ["Estudiante;Rol;Recursos aportados;Piezas colocadas;Respuestas del reto;Aciertos"];
    [...porEst].sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach((e) => filas.push([e.nombre, e.rol || "sin rol", e.recursos, e.piezas, e.intentos, e.aciertos].join(";")));
    descargarArchivo(`obra_${String(obra.titulo).replace(/\W+/g, "_")}.csv`, "﻿" + filas.join("\r\n"));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0"><div className="text-sm font-bold text-slate-700 truncate">{obra.titulo}</div>{opElegida && <div className="text-xs text-slate-500">{opElegida.emoji} {opElegida.nombre}</div>}</div>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${clsEstado}`}>{txtEstado}</span>
      </div>

      {obra.estado === "preparacion" && (
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-2">Los estudiantes aún no pueden votar. Opciones: {obra.opciones.map((o) => `${o.emoji} ${o.nombre}`).join(" · ")}.</p>
          <button disabled={trabajando} onClick={() => accion(() => ob.cambiarEstadoObra(obra.id, "votacion"))} className="text-sm font-semibold px-4 py-2 rounded-xl bg-amber-500 text-white">🗳️ Abrir votación</button>
        </div>
      )}

      {obra.estado === "votacion" && (
        <div className="bg-amber-50 rounded-xl p-3">
          <div className="text-xs font-semibold text-amber-700 mb-2">Votos: {det?.votos.length || 0} de {estudiantes.length} estudiantes</div>
          {obra.opciones.map((o) => { const n = votos[o.id] || 0, max = Math.max(1, ...Object.values(votos)); return (
            <div key={o.id} className="mb-1.5"><div className="flex justify-between text-xs"><span>{o.emoji} {o.nombre}</span><b>{n}</b></div><div className="h-2 bg-white rounded-full overflow-hidden"><div className="h-full bg-amber-400" style={{ width: `${(n / max) * 100}%` }} /></div></div>
          ); })}
          <div className="flex flex-wrap gap-2 items-center mt-3">
            <button disabled={trabajando} onClick={() => { if (confirm("¿Cerrar la votación y empezar a construir con la opción más votada?")) accion(() => ob.cerrarVotacionObra(obra.id, null)); }} className="text-sm font-semibold px-4 py-2 rounded-xl bg-emerald-500 text-white">✅ Cerrar votación y construir</button>
            <select value={forzar} onChange={(e) => setForzar(e.target.value)} className="text-xs rounded-lg px-2 py-2 border border-slate-200 bg-white"><option value="">o elegir yo…</option>{obra.opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>
            {forzar && <button disabled={trabajando} onClick={() => accion(() => ob.cerrarVotacionObra(obra.id, forzar))} className="text-xs font-semibold px-3 py-2 rounded-lg bg-slate-700 text-white">Construir esta</button>}
          </div>
        </div>
      )}

      {(obra.estado === "construccion" || obra.estado === "terminada") && opElegida && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-violet-50 rounded-xl p-2"><div className="text-[10px] text-violet-600">Fase</div><div className="text-lg font-black text-violet-700">{obra.estado === "terminada" ? fases.length : obra.fase + 1}/{fases.length}</div></div>
            <div className="bg-emerald-50 rounded-xl p-2"><div className="text-[10px] text-emerald-600">Piezas</div><div className="text-lg font-black text-emerald-700">{colocadas}/{piezasTotal}</div></div>
            <div className="bg-amber-50 rounded-xl p-2"><div className="text-[10px] text-amber-600">Participaron</div><div className="text-lg font-black text-amber-700">{activos.length}/{estudiantes.length}</div></div>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${piezasTotal ? (colocadas / piezasTotal) * 100 : 0}%` }} /></div>
          {faseActual && (
            <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-2.5">
              <b>Fase {obra.fase + 1}: {faseActual.nombre}</b> · piezas {det?.piezas.filter((p) => p.fase === obra.fase).length || 0}/{faseActual.piezas.length} · reto del equipo {Math.min(obra.reto_correctos, faseActual.reto_meta)}/{faseActual.reto_meta} aciertos
            </div>
          )}
          <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-2.5"><b>📦 Almacén común:</b> {RECURSOS_OBRA.map((k) => `${EMOJI_RECURSO[k]} ${(obra.almacen || {})[k] || 0}`).join("  ")} · Roles: {(det?.roles || []).filter((r) => r.rol === "recolector").length} recolectores, {(det?.roles || []).filter((r) => r.rol === "constructor").length} constructores</div>
          {(det?.roles || []).filter((r) => r.rol === "constructor").length === 0 && obra.estado === "construccion" && <div className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">⚠️ Todavía nadie eligió el rol de constructor: sin constructores no se colocan piezas. Pídeselo a algunos estudiantes.</div>}
          <div>
            <div className="flex justify-between items-center mb-1"><div className="text-xs font-semibold text-slate-600">Aportes por estudiante</div><button onClick={csv} className="text-[11px] font-semibold text-emerald-600">⬇ CSV</button></div>
            <div className="max-h-56 overflow-y-auto space-y-1">
              {[...activos].sort((a, b) => (b.recursos + 3 * b.piezas + 2 * b.aciertos) - (a.recursos + 3 * a.piezas + 2 * a.aciertos)).map((e) => (
                <div key={e.id} className="flex justify-between text-xs bg-white border border-slate-100 rounded-lg px-2.5 py-1.5"><span className="truncate">{primerNombre(e.nombre)} <span className="text-slate-400">{e.rol === "constructor" ? "🔨" : e.rol === "recolector" ? "🎒" : ""}</span></span><span className="text-slate-500 shrink-0">🎒 {e.recursos} · 🔨 {e.piezas} · ❓ {e.aciertos}/{e.intentos}</span></div>
              ))}
              {activos.length === 0 && <p className="text-xs text-slate-400">Todavía nadie ha aportado.</p>}
            </div>
            {sinAportar.length > 0 && <details className="mt-2"><summary className="text-[11px] text-slate-500 cursor-pointer">{sinAportar.length} estudiante{sinAportar.length === 1 ? "" : "s"} sin aportes aún</summary><p className="text-[11px] text-slate-400 mt-1">{sinAportar.map((e) => primerNombre(e.nombre)).join(", ")}</p></details>}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
        {obra.estado === "construccion" && <button disabled={trabajando} onClick={() => { if (confirm("¿Pausar la obra? Los estudiantes la verán como 'en preparación' hasta que la reabras.")) accion(() => ob.cambiarEstadoObra(obra.id, "preparacion")); }} className="text-xs font-semibold px-3 py-2 rounded-lg bg-slate-100 text-slate-600">⏸ Pausar</button>}
        {obra.estado === "preparacion" && obra.opcion_id && <button disabled={trabajando} onClick={() => accion(() => ob.cambiarEstadoObra(obra.id, "construccion"))} className="text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-500 text-white">▶ Reanudar construcción</button>}
        {obra.estado === "construccion" && <button disabled={trabajando} onClick={() => { if (confirm("¿Dar la obra por terminada ahora?")) accion(() => ob.cambiarEstadoObra(obra.id, "terminada")); }} className="text-xs font-semibold px-3 py-2 rounded-lg bg-violet-500 text-white">🏁 Terminar ahora</button>}
        <button disabled={trabajando} onClick={() => { if (confirm("¿Borrar esta obra y todo su avance? No se puede deshacer.")) accion(() => ob.eliminarObra(obra.id)); }} className="text-xs text-slate-400 hover:text-rose-500 px-2 py-2">🗑 Borrar obra</button>
      </div>
    </div>
  );
}
