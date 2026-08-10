import React, { useEffect, useMemo, useRef, useState } from "react";
import * as api from "../lib/api";
import { reinoColor } from "../lib/gamification";
import { ACCIONES_RAPIDAS } from "../lib/gamification";

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
function programarClacs(duracionMs, vueltas, nSegmentos) {
  const totalClacs = Math.max(8, Math.round(vueltas * nSegmentos * 0.6));
  for (let i = 1; i <= totalClacs; i++) {
    const frac = i / totalClacs;
    // Aproximación de easing "ease-out cúbico" inverso: los clacs se separan más hacia el final
    const t = 1 - Math.pow(1 - frac, 3);
    setTimeout(() => clack(0.15 - frac * 0.08), t * duracionMs);
  }
}

export function VistaRuleta({ grados }) {
  const [gradoId, setGradoId] = useState(grados[0]?.id || "");
  const [modo, setModo] = useState("grado");
  const [reino, setReino] = useState("");
  const [estudiantes, setEstudiantes] = useState([]);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState(null);
  const [registrando, setRegistrando] = useState(null);
  const [registrado, setRegistrado] = useState(null);

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

  const n = Math.max(items.length, 1);
  const sliceDeg = 360 / n;
  const colores = items.map((it, i) => reinoColor(it.label + i));
  const gradient = `conic-gradient(${colores.map((c, i) => `${c} ${i * sliceDeg}deg ${(i + 1) * sliceDeg}deg`).join(",")})`;

  const spin = () => {
    if (items.length < 2 || spinning) return;
    setSpinning(true);
    setWinner(null);
    setRegistrado(null);
    const winnerIdx = Math.floor(Math.random() * items.length);
    const vueltas = 6;
    programarClacs(4000, vueltas, items.length);
    setRotation((r) => {
      const rMod = ((r % 360) + 360) % 360;
      const objetivoMod = (360 - (winnerIdx * sliceDeg + sliceDeg / 2) + 360) % 360;
      let delta = objetivoMod - rMod;
      if (delta <= 0) delta += 360; // siempre gira hacia adelante, nunca "hacia atrás"
      return r + 360 * vueltas + delta;
    });
    setTimeout(() => {
      setSpinning(false);
      setWinner(items[winnerIdx]);
      beep(900, 0.2, 0.2);
    }, 4000);
  };

  const registrarParticipacion = async (accion) => {
    if (!winner?.estudianteId) return;
    setRegistrando(accion.key);
    try {
      await api.registrarAccion(winner.estudianteId, accion);
      setRegistrado(accion.label);
    } catch (e) {
      alert("Error al registrar: " + e.message);
    }
    setRegistrando(null);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">La Ruleta del Códice</h2>
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
        <div className="relative" style={{ width: 280, height: 280 }}>
          <div style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)", zIndex: 2, width: 0, height: 0, borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "18px solid #8B5CF6" }} />
          <div style={{
            width: 280, height: 280, borderRadius: "50%", background: items.length > 1 ? gradient : "#EDE9FE",
            border: "5px solid #8B5CF6", transform: `rotate(${rotation}deg)`,
            transition: spinning ? "transform 4s cubic-bezier(0.15,0.75,0.15,1)" : "none", position: "relative",
          }}>
            {items.map((it, i) => {
              const angle = i * sliceDeg + sliceDeg / 2;
              return (
                <div key={i} style={{ position: "absolute", top: "50%", left: "50%", width: "50%", height: 0, transform: `rotate(${angle}deg)`, transformOrigin: "0 0" }}>
                  <span style={{
                    position: "absolute", right: 14, top: -8,
                    display: "inline-block", maxWidth: 90, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    fontSize: n > 20 ? 8 : n > 10 ? 10 : 12, fontWeight: 600, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.7)",
                  }}>
                    {it.label.length > 16 ? it.label.slice(0, 15) + "…" : it.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <button onClick={spin} disabled={spinning || items.length < 2} className="text-sm font-bold px-6 py-3 rounded-full bg-violet-500 text-white disabled:opacity-50">
          {spinning ? "Girando…" : "🎡 Girar la ruleta"}
        </button>
        {winner && !spinning && (
          <div className="text-center">
            <div className="text-lg font-bold px-6 py-3 rounded-2xl bg-violet-100 text-violet-700 mb-3">🎉 {winner.label}</div>
            {winner.estudianteId && (
              <div className="bg-white rounded-2xl border border-slate-100 p-3 max-w-sm">
                <div className="text-xs font-semibold text-slate-500 mb-2">Registrar participación</div>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {ACCIONES_RAPIDAS.map((a) => (
                    <button key={a.key} disabled={registrando === a.key} onClick={() => registrarParticipacion(a)}
                      className={`text-xs px-2.5 py-1.5 rounded-full ${a.tipo === "positiva" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"} disabled:opacity-50`}>
                      {registrando === a.key ? "…" : a.label}
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

const OPCIONES_MONEDAS_DEFAULT = [10, 5, 3, -3, -5, 0, 15, -10];

export function VistaRuletaMonedas({ grados }) {
  const [gradoId, setGradoId] = useState(grados[0]?.id || "");
  const [reinoFiltro, setReinoFiltro] = useState("Todos");
  const [estudiantes, setEstudiantes] = useState([]);
  const [objetivo, setObjetivo] = useState("uno"); // "uno" | "todos"
  const [estudianteId, setEstudianteId] = useState("");
  const [opciones, setOpciones] = useState(OPCIONES_MONEDAS_DEFAULT);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [aplicando, setAplicando] = useState(false);
  const [manualValor, setManualValor] = useState("");
  const [aplicandoManual, setAplicandoManual] = useState(false);
  const [rangoMin, setRangoMin] = useState(-10);
  const [rangoMax, setRangoMax] = useState(15);
  const [rangoCantidad, setRangoCantidad] = useState(8);

  useEffect(() => { if (grados.length && !gradoId) setGradoId(grados[0].id); }, [grados]);
  useEffect(() => { if (gradoId) api.fetchEstudiantesPorGrado(gradoId).then(setEstudiantes); }, [gradoId]);
  useEffect(() => { if (estudiantes.length && !estudianteId) setEstudianteId(estudiantes[0].id); }, [estudiantes]);

  const reinos = useMemo(() => ["Todos", ...new Set(estudiantes.map((s) => s.reino_actual || s.reino_original || "Sin grupo"))], [estudiantes]);
  const visibles = estudiantes.filter((s) => reinoFiltro === "Todos" || (s.reino_actual || s.reino_original) === reinoFiltro);

  const n = Math.max(opciones.length, 1);
  const sliceDeg = 360 / n;
  const colorOpcion = (v) => v > 0 ? "#22C55E" : v < 0 ? "#EF4444" : "#94A3B8";
  const colores = opciones.map(colorOpcion);
  const gradient = `conic-gradient(${colores.map((c, i) => `${c} ${i * sliceDeg}deg ${(i + 1) * sliceDeg}deg`).join(",")})`;

  const cambiarOpcion = (i, valor) => setOpciones((prev) => prev.map((o, idx) => idx === i ? (parseInt(valor, 10) || 0) : o));
  const agregarOpcion = () => setOpciones((prev) => [...prev, 5]);
  const quitarOpcion = (i) => setOpciones((prev) => prev.filter((_, idx) => idx !== i));

  const generarPorRango = () => {
    const min = parseInt(rangoMin, 10) || 0;
    const max = parseInt(rangoMax, 10) || 0;
    const cantidad = Math.max(2, Math.min(16, parseInt(rangoCantidad, 10) || 8));
    if (min >= max) { alert("El mínimo debe ser menor que el máximo."); return; }
    const nuevas = Array.from({ length: cantidad }, () => Math.round(min + Math.random() * (max - min)));
    setOpciones(nuevas);
  };

  const aplicarManual = async () => {
    const valor = parseInt(manualValor, 10);
    if (isNaN(valor)) { alert("Escribí un número (puede ser negativo)."); return; }
    if (objetivo === "uno" && !estudianteId) return;
    setAplicandoManual(true);
    try {
      if (objetivo === "uno") {
        await api.ajustarMonedas(estudianteId, valor);
      } else {
        await api.ajustarMonedasMasivo(visibles.map((s) => s.id), valor);
      }
      setResultado(valor);
      setManualValor("");
    } catch (e) {
      alert("Error al aplicar: " + e.message);
    }
    setAplicandoManual(false);
  };

  const spin = () => {
    if (spinning || opciones.length < 2) return;
    if (objetivo === "uno" && !estudianteId) return;
    setSpinning(true);
    setResultado(null);
    const idx = Math.floor(Math.random() * opciones.length);
    const vueltas = 6;
    programarClacs(4000, vueltas, opciones.length);
    setRotation((r) => {
      const rMod = ((r % 360) + 360) % 360;
      const objetivoMod = (360 - (idx * sliceDeg + sliceDeg / 2) + 360) % 360;
      let delta = objetivoMod - rMod;
      if (delta <= 0) delta += 360;
      return r + 360 * vueltas + delta;
    });
    setTimeout(async () => {
      setSpinning(false);
      const valor = opciones[idx];
      setResultado(valor);
      beep(900, 0.2, 0.2);
      setAplicando(true);
      try {
        if (objetivo === "uno") {
          await api.ajustarMonedas(estudianteId, valor);
        } else {
          await api.ajustarMonedasMasivo(visibles.map((s) => s.id), valor);
        }
      } catch (e) {
        alert("Error al aplicar las monedas: " + e.message);
      }
      setAplicando(false);
    }, 4000);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">🪙 Ruleta de Monedas</h2>
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
        <div className="text-xs font-semibold text-slate-500 mb-2">Casillas de la ruleta (monedas a dar o quitar)</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {opciones.map((o, i) => (
            <div key={i} className="flex items-center gap-1">
              <input type="number" value={o} onChange={(e) => cambiarOpcion(i, e.target.value)}
                className="w-16 text-xs text-center rounded-lg px-1 py-1 border border-slate-200 outline-none" style={{ color: colorOpcion(o) }} />
              {opciones.length > 2 && <button onClick={() => quitarOpcion(i)} className="text-slate-300 hover:text-rose-500 text-xs">✕</button>}
            </div>
          ))}
          <button onClick={agregarOpcion} className="text-xs text-violet-500 px-2">+ Casilla</button>
        </div>
        <div className="flex items-center gap-2 flex-wrap bg-violet-50 rounded-lg p-2">
          <span className="text-[11px] text-slate-500">O generar por rango:</span>
          <input type="number" value={rangoMin} onChange={(e) => setRangoMin(e.target.value)} className="w-16 text-xs text-center rounded-lg px-1 py-1 border border-slate-200 outline-none" title="Mínimo (puede ser negativo)" />
          <span className="text-[11px] text-slate-400">a</span>
          <input type="number" value={rangoMax} onChange={(e) => setRangoMax(e.target.value)} className="w-16 text-xs text-center rounded-lg px-1 py-1 border border-slate-200 outline-none" title="Máximo" />
          <span className="text-[11px] text-slate-400">·</span>
          <input type="number" value={rangoCantidad} onChange={(e) => setRangoCantidad(e.target.value)} className="w-14 text-xs text-center rounded-lg px-1 py-1 border border-slate-200 outline-none" title="Cantidad de casillas" />
          <span className="text-[11px] text-slate-400">casillas</span>
          <button onClick={generarPorRango} className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white ml-auto">Generar</button>
        </div>
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
        <div className="relative" style={{ width: 260, height: 260 }}>
          <div style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)", zIndex: 2, width: 0, height: 0, borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "18px solid #8B5CF6" }} />
          <div style={{
            width: 260, height: 260, borderRadius: "50%", background: opciones.length > 1 ? gradient : "#EDE9FE",
            border: "5px solid #8B5CF6", transform: `rotate(${rotation}deg)`,
            transition: spinning ? "transform 4s cubic-bezier(0.15,0.75,0.15,1)" : "none", position: "relative",
          }}>
            {opciones.map((o, i) => {
              const angle = i * sliceDeg + sliceDeg / 2;
              return (
                <div key={i} style={{ position: "absolute", top: "50%", left: "50%", width: "50%", height: 0, transform: `rotate(${angle}deg)`, transformOrigin: "0 0" }}>
                  <span style={{
                    position: "absolute", right: 16, top: -10,
                    display: "inline-block", fontSize: 14, fontWeight: 700, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.7)",
                  }}>
                    {o > 0 ? `+${o}` : o}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <button onClick={spin} disabled={spinning || aplicando || opciones.length < 2 || (objetivo === "uno" && !estudianteId)}
          className="text-sm font-bold px-6 py-3 rounded-full bg-violet-500 text-white disabled:opacity-50">
          {spinning ? "Girando…" : aplicando ? "Aplicando…" : "🪙 Girar la ruleta"}
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
      <h2 className="text-xl font-bold text-slate-800 mb-1">Temporizador del Aula</h2>
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

function DadoTool() {
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

function CronometroTool() {
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

function SemaforoTool() {
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

function SorteoOrdenTool({ grados }) {
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

export function VistaHerramientas({ grados }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">Herramientas de Clase</h2>
      <p className="text-sm text-slate-400 mb-4">Cuatro utilidades más para usar junto a la Ruleta y el Temporizador.</p>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <DadoTool />
        <CronometroTool />
        <SemaforoTool />
        <SorteoOrdenTool grados={grados} />
      </div>
    </div>
  );
}
