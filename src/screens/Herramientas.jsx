import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as api from "../lib/api";

let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function beep(freq = 700, dur = 0.08, vol = 0.15) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    gain.gain.value = vol;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.stop(ctx.currentTime + dur);
  } catch (e) { /* silencioso si el navegador bloquea audio */ }
}

// Sonido corto y seco tipo "clac" (para las ruletas)
function clack(vol = 0.18) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 900;
    gain.gain.value = vol;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
    osc.stop(ctx.currentTime + 0.03);
  } catch (e) { /* silencioso */ }
}

// Estallido grave para la bomba
function boom() {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.5);
    gain.gain.value = 0.3;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) { /* silencioso */ }
}

// Programa sonidos de "clac" que se van espaciando con el tiempo, simulando
// una ruleta real que gira rápido y va frenando (usa la misma curva del CSS).
// (los sonidos de "clac" ahora se generan directo en cada spin(), ver más abajo)

const COLORES_RUEDA = ["#8B5CF6", "#F59E0B", "#10B981", "#3B82F6", "#EF4444", "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16", "#06B6D4", "#D946EF"];

// Rueda giratoria grande, estilo Wordwall — gajos de colores en un círculo
// real (SVG), con rotación física hasta el gajo ganador, y ese gajo queda
// resaltado (más brillante, con borde y "explotado" hacia afuera) al frenar.
function RuedaGrande({ items, tamano = 380, onResultado, deshabilitado = false }) {
  const [anguloRueda, setAnguloRueda] = useState(0);
  const [girando, setGirando] = useState(false);
  const [ganadorIdx, setGanadorIdx] = useState(null);

  const n = items.length;
  const anguloPorGajo = n > 0 ? 360 / n : 0;
  const mostrarTexto = n <= 16;

  const girar = () => {
    if (girando || n < 2 || deshabilitado) return;
    setGirando(true);
    setGanadorIdx(null);
    const idx = Math.floor(Math.random() * n);
    const vueltasExtra = 5 * 360;
    const anguloFinal = vueltasExtra + (360 - (idx * anguloPorGajo + anguloPorGajo / 2));
    setAnguloRueda((prev) => prev + anguloFinal);
    // Tics de sonido que se van espaciando (simulan la fricción de una rueda real).
    const pasos = Math.max(14, Math.min(28, n));
    for (let i = 1; i <= pasos; i++) {
      const frac = i / pasos;
      const t = 1 - Math.pow(1 - frac, 3);
      setTimeout(() => clack(0.15 - frac * 0.09), t * 3200);
    }
    setTimeout(() => {
      setGirando(false);
      setGanadorIdx(idx);
      boom();
      onResultado?.(items[idx], idx);
    }, 3250);
  };

  const radio = tamano / 2;
  const radioExplotado = 6; // cuánto se "empuja" el gajo ganador hacia afuera

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative" style={{ width: tamano, height: tamano }}>
        <div className="absolute z-10 text-3xl" style={{ top: -8, left: "50%", transform: "translateX(-50%)" }}>🔻</div>
        <div className="w-full h-full rounded-full overflow-visible shadow-xl"
          style={{ transform: `rotate(${anguloRueda}deg)`, transition: girando ? "transform 3.2s cubic-bezier(0.15,0.85,0.25,1)" : "none" }}>
          <svg viewBox={`0 0 ${tamano} ${tamano}`} className="w-full h-full">
            {items.map((it, i) => {
              const inicio = i * anguloPorGajo, fin = inicio + anguloPorGajo, medio = inicio + anguloPorGajo / 2;
              const esGanador = ganadorIdx === i;
              const offX = esGanador ? radioExplotado * Math.cos((Math.PI * medio) / 180) : 0;
              const offY = esGanador ? radioExplotado * Math.sin((Math.PI * medio) / 180) : 0;
              const cx = radio + offX, cy = radio + offY;
              const x1 = cx + radio * Math.cos((Math.PI * inicio) / 180), y1 = cy + radio * Math.sin((Math.PI * inicio) / 180);
              const x2 = cx + radio * Math.cos((Math.PI * fin) / 180), y2 = cy + radio * Math.sin((Math.PI * fin) / 180);
              const largeArc = anguloPorGajo > 180 ? 1 : 0;
              const color = it.color || COLORES_RUEDA[i % COLORES_RUEDA.length];
              const xTexto = cx + radio * 0.65 * Math.cos((Math.PI * medio) / 180);
              const yTexto = cy + radio * 0.65 * Math.sin((Math.PI * medio) / 180);
              return (
                <g key={i} style={{ filter: esGanador ? "drop-shadow(0 0 10px rgba(255,255,255,0.9))" : "none", transition: "filter 0.3s" }}>
                  <path d={`M${cx},${cy} L${x1},${y1} A${radio},${radio} 0 ${largeArc},1 ${x2},${y2} Z`}
                    fill={color} stroke={esGanador ? "#FFFFFF" : "#ffffff33"} strokeWidth={esGanador ? 4 : 1} />
                  {mostrarTexto && anguloPorGajo > 8 && (
                    <text x={xTexto} y={yTexto} fill="white" fontSize={Math.min(13, anguloPorGajo * 0.9)} fontWeight="bold"
                      textAnchor="middle" dominantBaseline="middle"
                      transform={`rotate(${medio + 90}, ${xTexto}, ${yTexto})`}>
                      {it.label.length > 14 ? it.label.slice(0, 13) + "…" : it.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
        <div className="absolute rounded-full bg-white shadow-md flex items-center justify-center" style={{ width: 46, height: 46, top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
          <span className="text-xl">🎯</span>
        </div>
      </div>
      <button onClick={girar} disabled={girando || n < 2 || deshabilitado} className="text-base font-bold px-8 py-3.5 rounded-full bg-violet-500 text-white disabled:opacity-50 shadow-lg">
        {girando ? "Girando…" : "🎡 Girar"}
      </button>
      {n < 2 && <p className="text-xs text-slate-400">Necesitás al menos 2 opciones para girar.</p>}
    </div>
  );
}

export function VistaRuleta({ grados, gradoActivo }) {
  const [gradoId, setGradoId] = useState(gradoActivo || grados[0]?.id || "");
  const [modo, setModo] = useState("grado");
  const [reino, setReino] = useState("");
  const [estudiantes, setEstudiantes] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [mostrado, setMostrado] = useState(null); // item que se ve en pantalla en cada instante
  const [winner, setWinner] = useState(null);
  const [registrando, setRegistrando] = useState(null);
  const [registrado, setRegistrado] = useState(null);

  useEffect(() => { if (gradoActivo) setGradoId(gradoActivo); }, [gradoActivo]);
  const [accionesRapidas, setAccionesRapidas] = useState([]);

  useEffect(() => { api.fetchAccionesGamificacion().then((d) => setAccionesRapidas(d.filter((a) => a.tab === "rapido" && a.activo))); }, []);

  useEffect(() => { if (grados.length && !gradoId) setGradoId(grados[0].id); }, [grados]);
  useEffect(() => { if (gradoId) api.fetchEstudiantesPorGrado(gradoId).then(setEstudiantes); }, [gradoId]);

  const reinos = useMemo(() => {
    const set = new Set(estudiantes.map((s) => s.reino_actual || s.reino_original || "Sin grupo"));
    return Array.from(set);
  }, [estudiantes]);

  useEffect(() => { if (reinos.length && !reino) setReino(reinos[0]); }, [reinos]);

  // Cada opción lleva { label, estudianteId } — estudianteId es null en modo "equipos"
  // (un reino no es una persona, no se le puede registrar una acción individual).
  const items = useMemo(() => {
    if (modo === "grado") return estudiantes.map((s) => ({ label: s.nombre, estudianteId: s.id }));
    if (modo === "reino") return estudiantes.filter((s) => (s.reino_actual || s.reino_original) === reino).map((s) => ({ label: s.nombre, estudianteId: s.id }));
    if (modo === "equipos") return reinos.map((r) => ({ label: r, estudianteId: null }));
    return [];
  }, [modo, estudiantes, reino, reinos]);

  // Sorteo tipo "máquina": va mostrando nombres al azar cada vez más lento, y el
  // ÚLTIMO que muestra es literalmente el mismo que se guarda como ganador — no hay
  // ningún cálculo de ángulos/geometría de por medio, así nunca pueden desincronizarse.
  const spin = () => {
    if (items.length < 2 || spinning) return;
    setSpinning(true);
    setWinner(null);
    setRegistrado(null);
    const winnerIdx = Math.floor(Math.random() * items.length);
    const duracionTotal = 2800;
    const pasos = Math.max(18, Math.min(34, items.length * 2));
    for (let i = 1; i <= pasos; i++) {
      const frac = i / pasos;
      const t = 1 - Math.pow(1 - frac, 3); // desacelera hacia el final
      const esUltimo = i === pasos;
      setTimeout(() => {
        const idxMostrado = esUltimo ? winnerIdx : Math.floor(Math.random() * items.length);
        setMostrado(items[idxMostrado]);
        clack(0.15 - frac * 0.08);
        if (esUltimo) {
          setSpinning(false);
          setWinner(items[winnerIdx]);
          beep(900, 0.2, 0.2);
        }
      }, t * duracionTotal);
    }
  };

  const registrarParticipacion = async (accion) => {
    if (!winner?.estudianteId) return;
    setRegistrando(accion.id);
    try {
      await api.registrarAccion(winner.estudianteId, { label: accion.label, xp: accion.xp, vida: accion.vida, categoria: "general" });
      setRegistrado(accion.label);
    } catch (e) {
      alert("Error al registrar: " + e.message);
    }
    setRegistrando(null);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-1">La Ruleta del Códice</h2>
      <p className="text-sm text-slate-400 mb-4">Sortea un estudiante de todo el grado, de un reino, o un reino/equipo completo.</p>

      <div className="flex flex-wrap gap-2 mb-6">
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {grados.map((g) => <option key={g.id} value={g.id}>Grado {g.id}</option>)}
        </select>
        <div className="flex gap-1 rounded-full bg-violet-50 p-1">
          <button onClick={() => setModo("grado")} className={`text-xs px-3 py-1.5 rounded-full ${modo === "grado" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Todo el grado</button>
          <button onClick={() => setModo("reino")} className={`text-xs px-3 py-1.5 rounded-full ${modo === "reino" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Un reino</button>
          <button onClick={() => setModo("equipos")} className={`text-xs px-3 py-1.5 rounded-full ${modo === "equipos" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Reinos/Equipos</button>
        </div>
        {modo === "reino" && (
          <select value={reino} onChange={(e) => setReino(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
            {reinos.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="rounded-3xl flex items-center justify-center text-center px-6"
          style={{
            width: 320, minHeight: 160, background: "linear-gradient(180deg, #EDE9FE 0%, #F5F3FF 100%)",
            border: "4px solid #8B5CF6", boxShadow: spinning ? "0 0 0 6px rgba(139,92,246,0.15)" : "none",
            transition: "box-shadow 0.2s",
          }}>
          {mostrado ? (
            <span className="text-2xl font-bold text-violet-700 break-words" style={{ opacity: spinning ? 0.85 : 1 }}>{mostrado.label}</span>
          ) : (
            <span className="text-sm text-slate-400">Tocá "Girar" para sortear</span>
          )}
        </div>
        <button onClick={spin} disabled={spinning || items.length < 2} className="text-sm font-bold px-6 py-3 rounded-full bg-violet-500 text-white disabled:opacity-50">
          {spinning ? "Sorteando…" : "🎲 Girar"}
        </button>
        {winner && !spinning && (
          <div className="text-center">
            <div className="text-lg font-bold px-6 py-3 rounded-2xl bg-violet-100 text-violet-700 mb-3">🎉 {winner.label}</div>
            {winner.estudianteId && (
              <div className="bg-white rounded-2xl border border-slate-100 p-3 max-w-sm">
                <div className="text-xs font-semibold text-slate-500 mb-2">Registrar participación</div>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {accionesRapidas.map((a) => (
                    <button key={a.id} disabled={registrando === a.id} onClick={() => registrarParticipacion(a)}
                      className={`text-xs px-2.5 py-1.5 rounded-full ${a.xp >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"} disabled:opacity-50`}>
                      {registrando === a.id ? "…" : a.label}
                    </button>
                  ))}
                </div>
                {registrado && <p className="text-xs text-emerald-600 mt-2">✔ "{registrado}" registrada.</p>}
              </div>
            )}
          </div>
        )}
        {items.length < 2 && <p className="text-xs text-slate-400">Necesitas al menos 2 opciones para girar.</p>}
      </div>
    </div>
  );
}

const PRESETS_PREMIOS = [
  { label: "10", min: -5, max: 10 },
  { label: "20", min: -10, max: 20 },
  { label: "30", min: -15, max: 30 },
];
const TOTAL_OPCIONES_RUEDA = 25;

export function VistaRuletaMonedas({ grados, gradoActivo }) {
  const [gradoId, setGradoId] = useState(gradoActivo || grados[0]?.id || "");
  const [reinoFiltro, setReinoFiltro] = useState("Todos");
  const [estudiantes, setEstudiantes] = useState([]);
  const [objetivo, setObjetivo] = useState("uno"); // "uno" | "todos"
  const [estudianteId, setEstudianteId] = useState("");

  useEffect(() => { if (gradoActivo) setGradoId(gradoActivo); }, [gradoActivo]);
  const [rangoMin, setRangoMin] = useState(-10);
  const [rangoMax, setRangoMax] = useState(15);
  const [opciones, setOpciones] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [aplicando, setAplicando] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [mostrado, setMostrado] = useState(null);
  const [manualValor, setManualValor] = useState("");
  const [aplicandoManual, setAplicandoManual] = useState(false);

  useEffect(() => { if (grados.length && !gradoId) setGradoId(grados[0].id); }, [grados]);
  useEffect(() => { if (gradoId) api.fetchEstudiantesPorGrado(gradoId).then(setEstudiantes); }, [gradoId]);
  useEffect(() => { if (estudiantes.length && !estudianteId) setEstudianteId(estudiantes[0].id); }, [estudiantes]);

  const reinos = useMemo(() => ["Todos", ...new Set(estudiantes.map((s) => s.reino_actual || s.reino_original || "Sin grupo"))], [estudiantes]);
  const visibles = estudiantes.filter((s) => reinoFiltro === "Todos" || (s.reino_actual || s.reino_original) === reinoFiltro);

  const colorOpcion = (v) => v > 0 ? "#22C55E" : v < 0 ? "#EF4444" : "#94A3B8";

  // La rueda siempre tiene 25 opciones — se regeneran solas cuando cambia
  // el rango, y también se pueden volver a barajar con el mismo rango.
  const regenerar = () => {
    const min = parseInt(rangoMin, 10) || 0;
    const max = parseInt(rangoMax, 10) || 0;
    if (min >= max) return;
    setOpciones(Array.from({ length: TOTAL_OPCIONES_RUEDA }, () => Math.round(min + Math.random() * (max - min))));
  };
  useEffect(() => { regenerar(); }, [rangoMin, rangoMax]);

  const aplicarValor = async (valor) => {
    setAplicando(true);
    try {
      if (objetivo === "uno") {
        await api.ajustarMonedas(estudianteId, valor);
        await api.registrarHistorialGamificacion(estudianteId, { etiqueta: "🎡 Ruleta de Monedas", monedas: valor, categoria: "monedas" });
      } else {
        await api.ajustarMonedasMasivo(visibles.map((s) => s.id), valor);
        await api.registrarHistorialGamificacionMasivo(visibles.map((s) => s.id), { etiqueta: "🎡 Ruleta de Monedas", monedas: valor, categoria: "monedas" });
      }
      setResultado(valor);
    } catch (e) {
      alert("Error al aplicar las monedas: " + e.message);
    }
    setAplicando(false);
  };

  const aplicarManual = async () => {
    const valor = parseInt(manualValor, 10);
    if (isNaN(valor)) { alert("Escribí un número (puede ser negativo)."); return; }
    if (objetivo === "uno" && !estudianteId) return;
    setAplicandoManual(true);
    await aplicarValor(valor);
    setManualValor("");
    setAplicandoManual(false);
  };

  // Mismo formato de "máquina de sorteo" que la Ruleta del Códice: lo último que
  // se muestra en pantalla es exactamente el mismo valor que se aplica.
  const spin = () => {
    if (spinning || opciones.length < 2) return;
    if (objetivo === "uno" && !estudianteId) return;
    setSpinning(true);
    setResultado(null);
    const idx = Math.floor(Math.random() * opciones.length);
    const duracionTotal = 2800;
    const pasos = Math.max(18, Math.min(34, opciones.length));
    for (let i = 1; i <= pasos; i++) {
      const frac = i / pasos;
      const t = 1 - Math.pow(1 - frac, 3);
      const esUltimo = i === pasos;
      setTimeout(() => {
        const idxMostrado = esUltimo ? idx : Math.floor(Math.random() * opciones.length);
        setMostrado(opciones[idxMostrado]);
        clack(0.15 - frac * 0.08);
        if (esUltimo) {
          setSpinning(false);
          beep(900, 0.2, 0.2);
          aplicarValor(opciones[idx]);
        }
      }, t * duracionTotal);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-1">🪙 Ruleta de Monedas</h2>
      <p className="text-sm text-slate-400 mb-4">Gira para dar (o quitar) monedas a un estudiante puntual, o a todo el grupo visible a la vez.</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {grados.map((g) => <option key={g.id} value={g.id}>Grado {g.id}</option>)}
        </select>
        <select value={reinoFiltro} onChange={(e) => setReinoFiltro(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {reinos.map((r) => <option key={r} value={r}>{r === "Todos" ? "Todos los grupos" : r}</option>)}
        </select>
        <div className="flex gap-1 rounded-full bg-violet-50 p-1">
          <button onClick={() => setObjetivo("uno")} className={`text-xs px-3 py-1.5 rounded-full ${objetivo === "uno" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Un estudiante</button>
          <button onClick={() => setObjetivo("todos")} className={`text-xs px-3 py-1.5 rounded-full ${objetivo === "todos" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Todos los visibles ({visibles.length})</button>
        </div>
        {objetivo === "uno" && (
          <select value={estudianteId} onChange={(e) => setEstudianteId(parseInt(e.target.value, 10))} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
            {visibles.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-3 mb-4">
        <div className="text-xs font-semibold text-slate-500 mb-2">Cantidad de premios</div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS_PREMIOS.map((p) => (
            <button key={p.label} onClick={() => { setRangoMin(p.min); setRangoMax(p.max); }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${rangoMin === p.min && rangoMax === p.max ? "bg-violet-500 text-white border-violet-500" : "border-slate-200 text-slate-600"}`}>
              {p.label}
            </button>
          ))}
          <span className="text-[11px] text-slate-400 ml-1">Min</span>
          <input type="number" value={rangoMin} onChange={(e) => setRangoMin(e.target.value)} className="w-16 text-xs text-center rounded-lg px-1 py-1.5 border border-slate-200 outline-none" />
          <span className="text-[11px] text-slate-400">Max</span>
          <input type="number" value={rangoMax} onChange={(e) => setRangoMax(e.target.value)} className="w-16 text-xs text-center rounded-lg px-1 py-1.5 border border-slate-200 outline-none" />
          <button onClick={regenerar} className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-violet-100 text-violet-700 ml-auto">🔄 Rebarajar</button>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">La rueda siempre reparte {TOTAL_OPCIONES_RUEDA} valores al azar entre Min y Max.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-3 mb-4">
        <div className="text-xs font-semibold text-slate-500 mb-2">O aplicar manualmente, sin girar</div>
        <div className="flex items-center gap-2">
          <input type="number" value={manualValor} onChange={(e) => setManualValor(e.target.value)} placeholder="Ej: 10 o -5"
            className="w-24 text-sm text-center rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
          <button disabled={aplicandoManual || (objetivo === "uno" && !estudianteId)} onClick={aplicarManual}
            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white disabled:opacity-50">
            {aplicandoManual ? "Aplicando…" : `Aplicar a ${objetivo === "uno" ? (visibles.find((s) => s.id === estudianteId)?.nombre || "estudiante") : `${visibles.length} estudiantes`}`}
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="rounded-3xl flex items-center justify-center text-center px-6"
          style={{
            width: 280, minHeight: 140, background: "linear-gradient(180deg, #EDE9FE 0%, #F5F3FF 100%)",
            border: "4px solid #8B5CF6", boxShadow: spinning ? "0 0 0 6px rgba(139,92,246,0.15)" : "none",
            transition: "box-shadow 0.2s",
          }}>
          {mostrado !== null ? (
            <span className="text-4xl font-bold" style={{ color: colorOpcion(mostrado), opacity: spinning ? 0.85 : 1 }}>
              {mostrado > 0 ? `+${mostrado}` : mostrado}
            </span>
          ) : (
            <span className="text-sm text-slate-400">Tocá "Girar" para sortear</span>
          )}
        </div>
        <button onClick={spin} disabled={spinning || aplicando || opciones.length < 2 || (objetivo === "uno" && !estudianteId)}
          className="text-sm font-bold px-6 py-3 rounded-full bg-violet-500 text-white disabled:opacity-50">
          {spinning ? "Sorteando…" : aplicando ? "Aplicando…" : "🪙 Girar"}
        </button>
        {resultado !== null && !spinning && !aplicando && (
          <div className={`text-lg font-bold px-6 py-3 rounded-2xl ${resultado >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
            {resultado > 0 ? `🎉 +${resultado} monedas` : resultado < 0 ? `😬 ${resultado} monedas` : "😐 Sin cambio"}
            {" — "}{objetivo === "uno" ? (visibles.find((s) => s.id === estudianteId)?.nombre || "") : `${visibles.length} estudiantes`}
          </div>
        )}
      </div>

    </div>
  );
}

export function VistaTemporizador() {
  const [seconds, setSeconds] = useState(300);
  const [totalInicial, setTotalInicial] = useState(300);
  const [running, setRunning] = useState(false);
  const [manual, setManual] = useState(5);
  const [estilo, setEstilo] = useState("digital"); // "digital" | "arena" | "bomba"
  const [explotó, setExplotó] = useState(false);

  useEffect(() => {
    if (!running) return;
    if (seconds <= 0) { setRunning(false); return; }
    const id = setInterval(() => setSeconds((s) => {
      const restante = s - 1;
      if (estilo === "bomba") {
        if (restante <= 0) { boom(); setExplotó(true); return 0; }
        if (restante <= 3) beep(1100, 0.06, 0.22);
        else if (restante <= 10) beep(850, 0.05, 0.18);
        else beep(700, 0.04, 0.1);
      } else if (estilo === "arena") {
        if (restante <= 0) beep(400, 0.4, 0.2);
        else if (restante % 1 === 0) beep(600, 0.02, 0.06);
      } else {
        if (s <= 1) beep(300, 0.3, 0.25);
        else if (s <= 4) beep(700, 0.05);
      }
      return Math.max(0, restante);
    }), 1000);
    return () => clearInterval(id);
  }, [running, seconds, estilo]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const addTime = (v) => setSeconds((s) => { const n = Math.max(0, s + v); setTotalInicial((t) => Math.max(t, n)); return n; });
  const reiniciar = () => { setRunning(false); setExplotó(false); setSeconds(totalInicial); };
  const fijar = () => {
    const total = Math.max(0, manual) * 60;
    setRunning(false); setExplotó(false); setSeconds(total); setTotalInicial(total);
  };

  const fraccionRestante = totalInicial > 0 ? seconds / totalInicial : 0;
  const urgente = seconds <= 10 && running;

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-xl font-bold text-white mb-1">Temporizador del Aula</h2>
      <p className="text-sm text-slate-400 mb-4">Agrega tiempo manualmente durante actividades o retos.</p>

      <div className="flex gap-1 rounded-full bg-violet-50 p-1 mb-6">
        <button onClick={() => setEstilo("digital")} className={`text-xs px-3 py-1.5 rounded-full ${estilo === "digital" ? "bg-violet-500 text-white" : "text-slate-600"}`}>⏱ Digital</button>
        <button onClick={() => setEstilo("arena")} className={`text-xs px-3 py-1.5 rounded-full ${estilo === "arena" ? "bg-violet-500 text-white" : "text-slate-600"}`}>⏳ Reloj de arena</button>
        <button onClick={() => setEstilo("bomba")} className={`text-xs px-3 py-1.5 rounded-full ${estilo === "bomba" ? "bg-violet-500 text-white" : "text-slate-600"}`}>💣 Bomba</button>
      </div>

      {estilo === "digital" && (
        <div className={`rounded-full flex items-center justify-center mb-6 bg-violet-50 border-8 ${urgente ? "border-rose-500" : "border-violet-500"}`} style={{ width: 220, height: 220 }}>
          <span className={`text-4xl font-bold ${urgente ? "text-rose-500" : "text-slate-800"}`}>{mm}:{ss}</span>
        </div>
      )}

      {estilo === "arena" && (
        <div className="flex flex-col items-center mb-6">
          <div style={{ width: 140, height: 200 }} className="relative">
            {/* Cuerpo del reloj de arena */}
            <svg viewBox="0 0 140 200" width="140" height="200">
              <polygon points="15,10 125,10 70,100 125,190 15,190 70,100" fill="none" stroke="#8B5CF6" strokeWidth="6" strokeLinejoin="round" />
              {/* Arena arriba (disminuye) */}
              <clipPath id="clipArriba"><polygon points="15,10 125,10 70,100" /></clipPath>
              <rect x="15" y={10 + 90 * (1 - fraccionRestante)} width="110" height={90 * fraccionRestante} fill="#F59E0B" clipPath="url(#clipArriba)" />
              {/* Arena abajo (aumenta) */}
              <clipPath id="clipAbajo"><polygon points="70,100 125,190 15,190" /></clipPath>
              <rect x="15" y={190 - 90 * (1 - fraccionRestante)} width="110" height={90 * (1 - fraccionRestante)} fill="#F59E0B" clipPath="url(#clipAbajo)" />
              {running && seconds > 0 && <rect x="68" y="96" width="4" height="8" fill="#F59E0B" />}
            </svg>
          </div>
          <span className={`text-3xl font-bold mt-3 ${urgente ? "text-rose-500" : "text-slate-800"}`}>{mm}:{ss}</span>
        </div>
      )}

      {estilo === "bomba" && (
        <div className="flex flex-col items-center mb-6">
          <div
            className="text-8xl"
            style={{
              animation: explotó ? "none" : running && seconds <= 5 ? "sacudir 0.15s infinite" : running && seconds <= 15 ? "sacudir 0.4s infinite" : "none",
            }}
          >
            {explotó ? "💥" : "💣"}
          </div>
          <style>{`@keyframes sacudir { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }`}</style>
          <span className={`text-3xl font-bold mt-2 ${seconds <= 10 && running ? "text-rose-500" : "text-slate-800"}`}>
            {explotó ? "¡BOOM!" : `${mm}:${ss}`}
          </span>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <button onClick={() => { if (seconds > 0) { setExplotó(false); setRunning((r) => !r); } }} disabled={seconds <= 0}
          className="text-sm font-bold px-5 py-2.5 rounded-full bg-violet-500 text-white disabled:opacity-50">
          {running ? "⏸ Pausar" : "▶ Iniciar"}
        </button>
        <button onClick={reiniciar} className="text-sm font-semibold px-5 py-2.5 rounded-full border border-slate-200 text-slate-600">↺ Reiniciar</button>
      </div>
      <div className="flex gap-2 mb-6 flex-wrap justify-center">
        {[-60, -30, 30, 60, 300].map((v) => (
          <button key={v} onClick={() => addTime(v)} className="text-xs px-3 py-1.5 rounded-full bg-violet-50 text-violet-700">
            {v > 0 ? `+${v >= 60 ? v / 60 + " min" : v + "s"}` : `${v / 60} min`}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Fijar minutos:</span>
        <input type="number" value={manual} onChange={(e) => setManual(parseInt(e.target.value || "0", 10))} className="w-20 text-sm rounded-lg px-2 py-1 border border-slate-200 outline-none" />
        <button onClick={fijar} className="text-xs px-3 py-1.5 rounded-full bg-violet-500 text-white">Fijar</button>
      </div>
    </div>
  );
}

export function DadoTool() {
  const [numDados, setNumDados] = useState(1);
  const [caras, setCaras] = useState(6);
  const [resultados, setResultados] = useState([]);
  const [rodando, setRodando] = useState(false);

  const tirar = () => {
    setRodando(true);
    beep(400, 0.05);
    let i = 0;
    const id = setInterval(() => {
      setResultados(Array.from({ length: numDados }, () => 1 + Math.floor(Math.random() * caras)));
      i++;
      if (i > 8) { clearInterval(id); setRodando(false); beep(800, 0.15, 0.2); }
    }, 80);
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <h3 className="font-bold text-slate-800 mb-3">🎲 Dado</h3>
      <div className="flex gap-2 mb-3">
        <select value={numDados} onChange={(e) => setNumDados(parseInt(e.target.value, 10))} className="text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none">
          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} dado{n > 1 ? "s" : ""}</option>)}
        </select>
        <select value={caras} onChange={(e) => setCaras(parseInt(e.target.value, 10))} className="text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none">
          {[4, 6, 8, 10, 12, 20].map((c) => <option key={c} value={c}>{c} caras</option>)}
        </select>
      </div>
      <div className="flex gap-2 mb-3 flex-wrap min-h-[48px] items-center">
        {resultados.map((r, i) => (
          <div key={i} className="w-12 h-12 rounded-xl bg-violet-500 text-white flex items-center justify-center font-bold text-lg">{r}</div>
        ))}
      </div>
      <button onClick={tirar} disabled={rodando} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
        {rodando ? "Rodando…" : "Tirar"}
      </button>
    </div>
  );
}

export function CronometroTool() {
  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState([]);
  const startRef = useRef(null);

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now() - ms;
    const id = setInterval(() => setMs(Date.now() - startRef.current), 50);
    return () => clearInterval(id);
  }, [running]);

  const fmt = (v) => {
    const totalSec = Math.floor(v / 1000);
    const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const ss = String(totalSec % 60).padStart(2, "0");
    const cc = String(Math.floor((v % 1000) / 10)).padStart(2, "0");
    return `${mm}:${ss}.${cc}`;
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <h3 className="font-bold text-slate-800 mb-3">⏱ Cronómetro</h3>
      <div className="text-3xl font-bold text-slate-800 mb-3 tabular-nums">{fmt(ms)}</div>
      <div className="flex gap-2 mb-2">
        <button onClick={() => setRunning((r) => !r)} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white">{running ? "Pausar" : "Iniciar"}</button>
        <button onClick={() => { setRunning(false); setMs(0); setLaps([]); }} className="text-sm font-semibold px-4 py-2 rounded-lg border border-slate-200 text-slate-600">Reiniciar</button>
        <button onClick={() => running && setLaps((l) => [ms, ...l].slice(0, 8))} disabled={!running} className="text-sm font-semibold px-4 py-2 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40">Vuelta</button>
      </div>
      {laps.length > 0 && (
        <div className="text-xs text-slate-500 space-y-1 mt-2">
          {laps.map((l, i) => <div key={i}>Vuelta {laps.length - i}: {fmt(l)}</div>)}
        </div>
      )}
    </div>
  );
}

export function SemaforoTool() {
  const ESTADOS = [
    { key: "verde", label: "Trabajo en equipo", color: "#22C55E" },
    { key: "amarillo", label: "Voz baja", color: "#F59E0B" },
    { key: "rojo", label: "Silencio total", color: "#EF4444" },
  ];
  const [estado, setEstado] = useState("verde");
  const actual = ESTADOS.find((e) => e.key === estado);

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <h3 className="font-bold text-slate-800 mb-3">🚦 Semáforo de silencio</h3>
      <div className="flex justify-center gap-3 mb-3">
        {ESTADOS.map((e) => (
          <button key={e.key} onClick={() => { setEstado(e.key); if (e.key === "rojo") beep(600, 0.15, 0.2); }}
            className="w-14 h-14 rounded-full border-4"
            style={{ background: estado === e.key ? e.color : "#F1F5F9", borderColor: e.color }} />
        ))}
      </div>
      <div className="text-center text-sm font-semibold" style={{ color: actual.color }}>{actual.label}</div>
    </div>
  );
}

export function SorteoOrdenTool({ grados }) {
  const [gradoId, setGradoId] = useState(grados[0]?.id || "");
  const [estudiantes, setEstudiantes] = useState([]);
  const [modo, setModo] = useState("orden");
  const [resultado, setResultado] = useState([]);

  useEffect(() => { if (grados.length && !gradoId) setGradoId(grados[0].id); }, [grados]);
  useEffect(() => { if (gradoId) api.fetchEstudiantesPorGrado(gradoId).then(setEstudiantes); }, [gradoId]);

  const sortear = () => {
    const mezclados = [...estudiantes].sort(() => Math.random() - 0.5);
    beep(500, 0.08);
    if (modo === "orden") {
      setResultado(mezclados.map((s) => s.nombre));
    } else {
      const parejas = [];
      for (let i = 0; i < mezclados.length; i += 2) {
        parejas.push(mezclados[i + 1] ? `${mezclados[i].nombre} + ${mezclados[i + 1].nombre}` : `${mezclados[i].nombre} (sin pareja)`);
      }
      setResultado(parejas);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 md:col-span-2">
      <h3 className="font-bold text-slate-800 mb-3">👥 Sorteo de orden / parejas</h3>
      <div className="flex flex-wrap gap-2 mb-3">
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none">
          {grados.map((g) => <option key={g.id} value={g.id}>Grado {g.id}</option>)}
        </select>
        <div className="flex gap-1 rounded-full bg-violet-50 p-1">
          <button onClick={() => setModo("orden")} className={`text-xs px-3 py-1.5 rounded-full ${modo === "orden" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Orden aleatorio</button>
          <button onClick={() => setModo("parejas")} className={`text-xs px-3 py-1.5 rounded-full ${modo === "parejas" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Parejas</button>
        </div>
        <button onClick={sortear} disabled={estudiantes.length === 0} className="text-sm font-semibold px-4 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-50">Sortear</button>
      </div>
      {resultado.length > 0 && (
        <ol className="text-sm text-slate-700 list-decimal list-inside space-y-1 max-h-64 overflow-y-auto">
          {resultado.map((r, i) => <li key={i}>{r}</li>)}
        </ol>
      )}
    </div>
  );
}

export function GeneradorGruposTool({ grados }) {
  const [gradoId, setGradoId] = useState(grados[0]?.id || "");
  const [estudiantes, setEstudiantes] = useState([]);
  const [numGrupos, setNumGrupos] = useState(4);
  const [grupos, setGrupos] = useState(null);

  useEffect(() => { if (grados.length && !gradoId) setGradoId(grados[0].id); }, [grados]);
  useEffect(() => { if (gradoId) api.fetchEstudiantesPorGrado(gradoId).then(setEstudiantes); }, [gradoId]);

  const generar = () => {
    const mezclados = [...estudiantes].sort(() => Math.random() - 0.5);
    const n = Math.max(2, Math.min(numGrupos, mezclados.length || 2));
    const resultado = Array.from({ length: n }, () => []);
    mezclados.forEach((s, i) => resultado[i % n].push(s.nombre));
    beep(500, 0.08);
    setGrupos(resultado);
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <h3 className="font-bold text-slate-800 mb-3">🧩 Generador de grupos al azar</h3>
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none">
          {grados.map((g) => <option key={g.id} value={g.id}>Grado {g.id}</option>)}
        </select>
        <label className="text-xs text-slate-500">N° de grupos</label>
        <input type="number" min={2} max={12} value={numGrupos} onChange={(e) => setNumGrupos(parseInt(e.target.value, 10) || 2)}
          className="w-16 text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
        <button onClick={generar} disabled={estudiantes.length === 0} className="text-sm font-semibold px-4 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-50">Generar</button>
      </div>
      {grupos && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {grupos.map((g, i) => (
            <div key={i} className="bg-violet-50 rounded-xl p-2.5">
              <div className="text-xs font-bold text-violet-600 mb-1">Grupo {i + 1}</div>
              <ol className="text-xs text-slate-600 list-decimal list-inside space-y-0.5">
                {g.map((nombre, j) => <li key={j}>{nombre}</li>)}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MarcadorPuntosTool() {
  const [equipos, setEquipos] = useState([{ nombre: "Equipo 1", puntos: 0 }, { nombre: "Equipo 2", puntos: 0 }]);
  const [nombreNuevo, setNombreNuevo] = useState("");

  const sumar = (i, delta) => setEquipos((prev) => prev.map((e, idx) => idx === i ? { ...e, puntos: Math.max(0, e.puntos + delta) } : e));
  const agregar = () => {
    if (!nombreNuevo.trim()) return;
    setEquipos((prev) => [...prev, { nombre: nombreNuevo.trim(), puntos: 0 }]);
    setNombreNuevo("");
  };
  const quitar = (i) => setEquipos((prev) => prev.filter((_, idx) => idx !== i));
  const reiniciar = () => setEquipos((prev) => prev.map((e) => ({ ...e, puntos: 0 })));

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <h3 className="font-bold text-slate-800 mb-3">🏆 Marcador de puntos</h3>
      <div className="space-y-2 mb-3">
        {equipos.map((e, i) => (
          <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl p-2">
            <span className="text-sm font-semibold text-slate-700 flex-1 truncate">{e.nombre}</span>
            <button onClick={() => sumar(i, -1)} className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-500 font-bold">−</button>
            <span className="text-lg font-bold text-violet-600 w-10 text-center">{e.puntos}</span>
            <button onClick={() => sumar(i, 1)} className="w-7 h-7 rounded-lg bg-violet-500 text-white font-bold">+</button>
            <button onClick={() => quitar(i)} className="text-slate-300 hover:text-rose-500 px-1">🗑</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} placeholder="Nombre del equipo" onKeyDown={(e) => e.key === "Enter" && agregar()}
          className="flex-1 text-sm rounded-lg px-3 py-1.5 border border-slate-200 outline-none" />
        <button onClick={agregar} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700">+ Agregar</button>
        <button onClick={reiniciar} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500">↺ Reiniciar</button>
      </div>
    </div>
  );
}

export function SelectorEstudianteTool({ grados }) {
  const [gradoId, setGradoId] = useState(grados[0]?.id || "");
  const [estudiantes, setEstudiantes] = useState([]);
  const [salidos, setSalidos] = useState([]);
  const [elegido, setElegido] = useState(null);
  const [girando, setGirando] = useState(false);
  const [noRepetir, setNoRepetir] = useState(true);

  useEffect(() => { if (grados.length && !gradoId) setGradoId(grados[0].id); }, [grados]);
  useEffect(() => { if (gradoId) api.fetchEstudiantesPorGrado(gradoId).then((est) => { setEstudiantes(est); setSalidos([]); setElegido(null); }); }, [gradoId]);

  const disponibles = noRepetir ? estudiantes.filter((s) => !salidos.includes(s.id)) : estudiantes;

  const elegir = () => {
    if (disponibles.length === 0) return;
    setGirando(true);
    let vueltas = 0;
    const intervalo = setInterval(() => {
      setElegido(disponibles[Math.floor(Math.random() * disponibles.length)]);
      clack(0.1);
      vueltas++;
      if (vueltas > 12) {
        clearInterval(intervalo);
        const final = disponibles[Math.floor(Math.random() * disponibles.length)];
        setElegido(final);
        setSalidos((prev) => [...prev, final.id]);
        setGirando(false);
        boom();
      }
    }, 90);
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <h3 className="font-bold text-slate-800 mb-3">🙋 Selector de estudiante al azar</h3>
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none">
          {grados.map((g) => <option key={g.id} value={g.id}>Grado {g.id}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          <input type="checkbox" checked={noRepetir} onChange={(e) => { setNoRepetir(e.target.checked); setSalidos([]); }} />
          No repetir hasta que salgan todos
        </label>
      </div>
      <div className="bg-violet-50 rounded-xl p-6 text-center mb-3 min-h-[70px] flex items-center justify-center">
        <span className={`text-xl font-bold text-violet-700 ${girando ? "opacity-60" : ""}`}>{elegido ? elegido.nombre : "¿Quién sigue?"}</span>
      </div>
      <div className="flex items-center justify-between">
        <button onClick={elegir} disabled={girando || disponibles.length === 0} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50">
          {girando ? "Eligiendo…" : "🎲 Elegir"}
        </button>
        {noRepetir && <span className="text-xs text-slate-400">Quedan {disponibles.length} de {estudiantes.length}</span>}
      </div>
      {noRepetir && salidos.length > 0 && (
        <button onClick={() => setSalidos([])} className="text-xs text-slate-400 mt-2">↺ Reiniciar lista de salidos</button>
      )}
    </div>
  );
}

function mezclarArray(arr) {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

const LETRAS = ["A", "B", "C", "D"];

function PreguntaFormaForm({ onAgregar }) {
  const [enunciado, setEnunciado] = useState("");
  const [opciones, setOpciones] = useState(["", "", "", ""]);
  const [correctaIdx, setCorrectaIdx] = useState(0);

  const agregar = () => {
    if (!enunciado.trim() || opciones.some((o) => !o.trim())) { alert("Completá el enunciado y las 4 opciones."); return; }
    onAgregar({ enunciado: enunciado.trim(), opciones: opciones.map((o) => o.trim()), correctaIdx });
    setEnunciado(""); setOpciones(["", "", "", ""]); setCorrectaIdx(0);
  };

  return (
    <div className="bg-violet-50 rounded-xl p-3 mb-3">
      <textarea value={enunciado} onChange={(e) => setEnunciado(e.target.value)} rows={2} placeholder="Enunciado de la pregunta"
        className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none mb-2 bg-white" />
      <div className="space-y-1.5 mb-2">
        {opciones.map((op, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name="correcta" checked={correctaIdx === i} onChange={() => setCorrectaIdx(i)} title="Marcar como correcta" />
            <span className="text-xs font-bold text-slate-400 w-4">{LETRAS[i]}</span>
            <input value={op} onChange={(e) => setOpciones((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))} placeholder={`Opción ${LETRAS[i]}`}
              className="flex-1 text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
          </div>
        ))}
      </div>
      <button onClick={agregar} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white">+ Agregar pregunta</button>
    </div>
  );
}

// Genera N "formas" (A, B, C…) con el mismo banco de preguntas, pero
// cada una con el orden de preguntas Y de opciones revuelto distinto —
// así, sentados uno al lado del otro, no ven la misma pregunta en el
// mismo lugar. La letra "correcta" de la hoja de respuestas se recalcula
// para cada forma según dónde terminó cayendo la opción correcta.
export function FormasExamenTool() {
  const [titulo, setTitulo] = useState("");
  const [preguntas, setPreguntas] = useState([]);
  const [cantidadFormas, setCantidadFormas] = useState(4);
  const [formas, setFormas] = useState(null);
  const [imprimiendo, setImprimiendo] = useState(false);

  const quitarPregunta = (i) => setPreguntas((prev) => prev.filter((_, idx) => idx !== i));

  const generarFormas = () => {
    if (preguntas.length < 2) { alert("Agregá al menos 2 preguntas."); return; }
    const n = Math.max(2, Math.min(6, cantidadFormas));
    const nuevas = Array.from({ length: n }, () => {
      const ordenPreguntas = mezclarArray(preguntas.map((_, i) => i));
      return ordenPreguntas.map((idxOriginal) => {
        const p = preguntas[idxOriginal];
        const indicesOpciones = mezclarArray(p.opciones.map((_, i) => i));
        const opcionesNuevas = indicesOpciones.map((i) => p.opciones[i]);
        const letraCorrecta = LETRAS[indicesOpciones.indexOf(p.correctaIdx)];
        return { enunciado: p.enunciado, opciones: opcionesNuevas, letraCorrecta };
      });
    });
    setFormas(nuevas);
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 md:col-span-2">
      <h3 className="font-bold text-slate-800 mb-1">📝 Formas de Examen (A/B/C/D)</h3>
      <p className="text-xs text-slate-400 mb-3">Mismas preguntas para todo el curso, pero con el orden de preguntas y de opciones revuelto distinto en cada forma — para imprimir y evitar copias entre compañeros.</p>

      {!formas ? (
        <>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título del examen (ej: Evaluación de Periodo 3 — Ética)"
            className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none mb-3" />

          {preguntas.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {preguntas.map((p, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-xs">
                  <span className="text-slate-600">{i + 1}. {p.enunciado}</span>
                  <button onClick={() => quitarPregunta(i)} className="text-slate-300 hover:text-rose-500 shrink-0 ml-2">✕</button>
                </div>
              ))}
            </div>
          )}

          <PreguntaFormaForm onAgregar={(p) => setPreguntas((prev) => [...prev, p])} />

          <div className="flex items-center gap-2 mb-3">
            <label className="text-xs text-slate-500">N° de formas distintas (A, B, C…)</label>
            <input type="number" min={2} max={6} value={cantidadFormas} onChange={(e) => setCantidadFormas(parseInt(e.target.value, 10) || 2)}
              className="w-16 text-xs text-center rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
          </div>
          <button onClick={generarFormas} disabled={preguntas.length < 2} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50">
            Generar {Math.max(2, Math.min(6, cantidadFormas))} formas
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-emerald-600 mb-3">✔ {formas.length} formas generadas, con {preguntas.length} preguntas cada una.</p>
          <div className="flex gap-2">
            <button onClick={() => setImprimiendo(true)} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white">🖨️ Imprimir todas las formas</button>
            <button onClick={() => setFormas(null)} className="text-sm text-slate-400">↺ Volver a editar preguntas</button>
          </div>
        </>
      )}

      {imprimiendo && <ImprimirFormasExamen titulo={titulo || "Evaluación"} formas={formas} onCerrado={() => setImprimiendo(false)} />}
    </div>
  );
}

function ImprimirFormasExamen({ titulo, formas, onCerrado }) {
  useEffect(() => {
    const id = setTimeout(() => window.print(), 200);
    const onAfter = () => onCerrado();
    window.addEventListener("afterprint", onAfter);
    return () => { clearTimeout(id); window.removeEventListener("afterprint", onAfter); };
  }, []);

  const contenido = (
    <div className="print-only" style={{ maxWidth: "180mm", margin: "0 auto", fontFamily: "Arial, sans-serif", color: "#1e293b" }}>
      {formas.map((forma, i) => (
        <div key={i} className="print-avoid-break" style={{ pageBreakAfter: "always" }}>
          <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{titulo}</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>FORMA {LETRAS[i]}</div>
          </div>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", marginBottom: 16 }}>
            <tbody>
              <tr>
                <td style={{ border: "1px solid #000", padding: 4, fontWeight: 700, width: "16%" }}>Nombre</td>
                <td style={{ border: "1px solid #000", padding: 4 }} colSpan={3}></td>
              </tr>
              <tr>
                <td style={{ border: "1px solid #000", padding: 4, fontWeight: 700 }}>Curso</td>
                <td style={{ border: "1px solid #000", padding: 4 }}></td>
                <td style={{ border: "1px solid #000", padding: 4, fontWeight: 700 }}>Fecha</td>
                <td style={{ border: "1px solid #000", padding: 4 }}></td>
              </tr>
            </tbody>
          </table>
          {forma.map((p, j) => (
            <div key={j} className="print-avoid-break" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>{j + 1}. {p.enunciado}</div>
              {p.opciones.map((op, k) => (
                <div key={k} style={{ fontSize: 12, marginLeft: 14, marginBottom: 2 }}>{LETRAS[k]}. {op}</div>
              ))}
            </div>
          ))}
        </div>
      ))}

      {/* Hoja de respuestas del docente — una tabla por forma */}
      <div className="print-avoid-break">
        <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{titulo} — Hoja de respuestas (docente)</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${formas.length}, 1fr)`, gap: 12 }}>
          {formas.map((forma, i) => (
            <div key={i}>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4, textAlign: "center" }}>FORMA {LETRAS[i]}</div>
              {forma.map((p, j) => (
                <div key={j} style={{ fontSize: 11, display: "flex", justifyContent: "space-between", borderBottom: "1px solid #ddd", padding: "2px 4px" }}>
                  <span>{j + 1}.</span><span style={{ fontWeight: 700 }}>{p.letraCorrecta}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(contenido, document.body);
}

export function BingoTool() {
  const [textoItems, setTextoItems] = useState("");
  const [cantidadCartones, setCantidadCartones] = useState(4);
  const [cartones, setCartones] = useState(null); // [[9 items], [9 items], ...]
  const [cartonVisto, setCartonVisto] = useState(0);
  const [bolsa, setBolsa] = useState([]);
  const [salidos, setSalidos] = useState([]);
  const [ultimo, setUltimo] = useState(null);

  const items = textoItems.split("\n").map((l) => l.trim()).filter(Boolean);

  // Cada cartón se arma con su propia mezcla al azar — si hay más de 25
  // términos, además pueden tocarle términos distintos a cada uno; si
  // hay justo 25, comparten los mismos términos pero en otro orden, lo
  // que igual hace que cada equipo complete línea en un momento distinto.
  const generarCartones = () => {
    if (items.length < 25) { alert("Escribí al menos 25 palabras/preguntas (una por línea) para armar los cartones de 5x5."); return; }
    const n = Math.max(2, Math.min(20, cantidadCartones));
    const nuevos = Array.from({ length: n }, () => [...items].sort(() => Math.random() - 0.5).slice(0, 25));
    setCartones(nuevos);
    setCartonVisto(0);
    setBolsa([...items].sort(() => Math.random() - 0.5));
    setSalidos([]);
    setUltimo(null);
  };

  const sacar = () => {
    const restantes = bolsa.filter((b) => !salidos.includes(b));
    if (restantes.length === 0) return;
    const elegido = restantes[Math.floor(Math.random() * restantes.length)];
    setSalidos((prev) => [...prev, elegido]);
    setUltimo(elegido);
    beep(600, 0.1);
  };

  const COLORES_BINGO = ["#EF4444", "#F59E0B", "#8B5CF6", "#10B981", "#3B82F6"];

  return (
    <div className="rounded-3xl p-5 md:col-span-2 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #FDF4FF 0%, #F5F3FF 50%, #EFF6FF 100%)", border: "2px solid #E9D5FF" }}>
      <div className="absolute top-3 right-4 text-2xl opacity-70">🎉</div>
      <div className="absolute bottom-3 left-4 text-2xl opacity-50">🎊</div>
      <h3 className="font-extrabold text-slate-800 mb-3 text-lg flex items-center gap-2">
        <span className="text-2xl">🎯</span> Bingo de preguntas/repaso
      </h3>
      {!cartones ? (
        <>
          <p className="text-xs text-slate-500 mb-2">Escribí una palabra, término o pregunta corta por línea (mínimo 25, para el cartón de 5x5).</p>
          <textarea value={textoItems} onChange={(e) => setTextoItems(e.target.value)} rows={5} placeholder={"Fotosíntesis\nCélula\nMitocondria\n..."}
            className="w-full text-sm rounded-xl px-3 py-2 border border-violet-200 outline-none mb-2 bg-white" />
          <div className="flex items-center gap-2 mb-3">
            <label className="text-xs text-slate-500">N° de cartones distintos (uno por equipo/grupo)</label>
            <input type="number" min={2} max={20} value={cantidadCartones} onChange={(e) => setCantidadCartones(parseInt(e.target.value, 10) || 2)}
              className="w-16 text-xs text-center rounded-lg px-2 py-1.5 border border-violet-200 outline-none bg-white" />
          </div>
          <button onClick={generarCartones} className="text-sm font-bold px-5 py-2.5 rounded-full text-white shadow-md" style={{ background: "linear-gradient(to right, #8B5CF6, #EC4899)" }}>
            🎲 Generar cartones y empezar
          </button>
        </>
      ) : (
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl p-3 shadow-sm border border-violet-100">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-500">🏷️ Cartón por equipo</div>
              <select value={cartonVisto} onChange={(e) => setCartonVisto(parseInt(e.target.value, 10))} className="text-xs rounded-lg px-2 py-1 border border-violet-200 outline-none">
                {cartones.map((_, i) => <option key={i} value={i}>Equipo {i + 1}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-5 gap-1.5 mb-1.5">
              {["B", "I", "N", "G", "O"].map((letra, i) => (
                <div key={letra} className="text-center font-extrabold text-white text-lg rounded-xl py-1.5 shadow-sm" style={{ background: COLORES_BINGO[i] }}>{letra}</div>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {cartones[cartonVisto].map((it, i) => {
                const marcado = salidos.includes(it);
                return (
                  <div key={i} className="aspect-square rounded-xl flex items-center justify-center text-center text-[10px] font-bold p-1 transition-all"
                    style={marcado ? { background: "linear-gradient(135deg, #34D399, #10B981)", color: "white", boxShadow: "0 2px 6px rgba(16,185,129,0.4)", transform: "scale(1.04)" } : { background: "#F8FAFC", color: "#475569", border: "1px solid #E2E8F0" }}>
                    {it}
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">🏆 Cada equipo tiene su propio cartón — pasá entre ellos con el selector de arriba para verificar un "¡Bingo!"</p>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-2">🎒 Bolsa: {bolsa.length - salidos.length} de {bolsa.length} sin salir</div>
            <div className="rounded-2xl p-6 text-center mb-3 min-h-[70px] flex items-center justify-center shadow-inner" style={{ background: "linear-gradient(135deg, #EDE9FE, #FCE7F3)", border: "2px dashed #C4B5FD" }}>
              <span className="text-lg font-extrabold" style={{ color: "#7C3AED" }}>{ultimo || "🎈 —"}</span>
            </div>
            <button onClick={sacar} disabled={bolsa.length - salidos.length === 0} className="w-full text-sm font-bold px-4 py-2.5 rounded-full text-white shadow-md disabled:opacity-40 mb-2" style={{ background: "linear-gradient(to right, #8B5CF6, #EC4899)" }}>
              🎱 Sacar uno
            </button>
            <button onClick={() => setCartones(null)} className="w-full text-xs text-slate-400">↺ Empezar de nuevo (nueva lista)</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function VistaHerramientas({ grados }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-1">Herramientas de Clase</h2>
      <p className="text-sm text-slate-400 mb-4">Utilidades para usar junto a la Ruleta y el Temporizador.</p>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <DadoTool />
        <CronometroTool />
        <SemaforoTool />
        <SorteoOrdenTool grados={grados} />
        <GeneradorGruposTool grados={grados} />
        <MarcadorPuntosTool />
        <SelectorEstudianteTool grados={grados} />
        <BingoTool />
      </div>
    </div>
  );
}
