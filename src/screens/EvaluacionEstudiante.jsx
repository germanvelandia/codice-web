import React, { useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import { TextoEnriquecido } from "../components/RichText";

const COLORES_OPCION = [
  { bg: "#e11d48", borde: "#9f1239" }, { bg: "#2563eb", borde: "#1e40af" },
  { bg: "#d97706", borde: "#b45309" }, { bg: "#059669", borde: "#065f46" },
];
const formatearTiempo = (seg) => `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;
const BTN = { background: "linear-gradient(to right, #2F55A4, #17264D)" };
const PANEL = { background: "rgba(23,38,77,0.75)", border: "1px solid rgba(47,85,164,0.3)" };

/* ---------------- fechas y estados ---------------- */
const hoyBogota = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
const limiteCierre = (e) => (e.fecha_cierre ? new Date(`${e.fecha_cierre}T${e.hora_cierre ? String(e.hora_cierre).slice(0, 5) : "23:59"}:${e.hora_cierre ? "00" : "59"}-05:00`) : null);
function fechaCorta(f) { return f ? new Date(`${f}T12:00:00-05:00`).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Bogota" }) : null; }
export function estadoVentana(e) {
  const hoy = hoyBogota();
  if (e.fecha_apertura && e.fecha_apertura > hoy) return "proxima";
  const lim = limiteCierre(e);
  if (lim && new Date() > lim) return "cerrada";
  return "abierta";
}
// Color según el desempeño (porcentaje del puntaje)
function colorNota(p) {
  if (p >= 90) return { bg: "#059669", txt: "Superior", borde: "#22C55E" };
  if (p >= 80) return { bg: "#2563eb", txt: "Alto", borde: "#3B82F6" };
  if (p >= 60) return { bg: "#d97706", txt: "Básico", borde: "#F59E0B" };
  return { bg: "#e11d48", txt: "Por mejorar", borde: "#F43F5E" };
}

/* ---------------- Pantalla de la evaluación (con vigilancia) ---------------- */
function TomarEvaluacion({ evaluacion, estudianteId, onCerrar }) {
  const vigilar = !!evaluacion.vigilar_pantalla;
  const maxSalidas = Math.max(0, Number(evaluacion.max_salidas) || 0);
  const [intentoId, setIntentoId] = useState(null);
  const [preguntas, setPreguntas] = useState([]);
  const [respuestas, setRespuestas] = useState({});
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [cerradoPorSalida, setCerradoPorSalida] = useState(false);
  const [errorInicio, setErrorInicio] = useState("");
  const [empezado, setEmpezado] = useState(false);
  const [indice, setIndice] = useState(0);
  const [segundosRestantes, setSegundosRestantes] = useState(null);
  const [respuestaCortaTemp, setRespuestaCortaTemp] = useState("");
  const [entiendo, setEntiendo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [aviso, setAviso] = useState(null); // {n, max}
  const ref = useRef({ intentoId: null, preguntas: [], respuestas: {}, terminado: false, salidas: 0, ultima: 0, fs: false });
  ref.current.intentoId = intentoId; ref.current.preguntas = preguntas; ref.current.respuestas = respuestas;

  useEffect(() => {
    (async () => {
      try {
        const { intentoId: id, preguntas: p } = await api.iniciarIntentoConAleatorias(evaluacion, estudianteId);
        setIntentoId(id); setPreguntas(p);
        if (evaluacion.tiempo_limite_minutos) setSegundosRestantes(evaluacion.tiempo_limite_minutos * 60);
      } catch (e) { setErrorInicio(e.message); }
      setCargando(false);
    })();
  }, []);

  const responder = (preguntaId, valor) => setRespuestas((prev) => ({ ...prev, [preguntaId]: valor }));

  const entregarYa = async () => {
    const r = ref.current;
    const payload = r.preguntas.map((p) => ({ pregunta_id: p.id, respuesta: r.respuestas[p.id] || "" }));
    await api.entregarIntento(r.intentoId, payload);
  };
  const salirDePantallaCompleta = () => { try { if (document.fullscreenElement) document.exitFullscreen(); } catch {} };
  const enviar = async () => {
    if (ref.current.terminado) return;
    ref.current.terminado = true; setEnviando(true);
    try { await entregarYa(); setEnviado(true); salirDePantallaCompleta(); }
    catch (e) { ref.current.terminado = false; alert("Error al entregar: " + e.message); }
    setEnviando(false);
  };

  // Tiempo total: al llegar a cero entrega lo respondido
  useEffect(() => {
    if (!empezado || segundosRestantes === null || enviado || enviando || cerradoPorSalida) return;
    if (segundosRestantes <= 0) { enviar(); return; }
    const id = setTimeout(() => setSegundosRestantes((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [empezado, segundosRestantes, enviado, enviando, cerradoPorSalida]);

  /* ---- Vigilancia: salir de la pantalla ---- */
  const cerrarPorSalida = async () => {
    const r = ref.current; if (r.terminado) return;
    r.terminado = true; setEnviando(true);
    try { await api.registrarSalidaIntento(r.intentoId, true); } catch {}
    try { await entregarYa(); } catch {}
    setCerradoPorSalida(true); setEnviando(false); salirDePantallaCompleta();
  };
  const contarSalida = () => {
    const r = ref.current; if (r.terminado) return;
    const t = Date.now(); if (t - r.ultima < 1500) return; r.ultima = t; // un solo conteo por salida
    r.salidas += 1;
    if (r.salidas <= maxSalidas) { api.registrarSalidaIntento(r.intentoId, false).catch(() => {}); setAviso({ n: r.salidas, max: maxSalidas }); }
    else cerrarPorSalida();
  };
  useEffect(() => {
    if (!vigilar || !empezado || enviado || cerradoPorSalida) return;
    const alOcultar = () => { if (document.hidden) contarSalida(); };
    const alPerderFoco = () => setTimeout(() => { if (!document.hasFocus() && !ref.current.terminado) contarSalida(); }, 400);
    const alCambiarFs = () => { if (ref.current.fs && !document.fullscreenElement) contarSalida(); };
    const antesDeIrse = (e) => { e.preventDefault(); e.returnValue = ""; };
    document.addEventListener("visibilitychange", alOcultar);
    window.addEventListener("blur", alPerderFoco);
    document.addEventListener("fullscreenchange", alCambiarFs);
    window.addEventListener("beforeunload", antesDeIrse);
    return () => {
      document.removeEventListener("visibilitychange", alOcultar); window.removeEventListener("blur", alPerderFoco);
      document.removeEventListener("fullscreenchange", alCambiarFs); window.removeEventListener("beforeunload", antesDeIrse);
    };
  }, [vigilar, empezado, enviado, cerradoPorSalida, maxSalidas]);

  const pedirPantallaCompleta = async () => {
    try { const el = document.documentElement; if (el.requestFullscreen) { await el.requestFullscreen(); ref.current.fs = true; } } catch { ref.current.fs = false; }
  };
  const empezar = async () => { if (vigilar) await pedirPantallaCompleta(); setEmpezado(true); setIndice(0); };
  const continuarTrasAviso = async () => { setAviso(null); if (vigilar && ref.current.fs && !document.fullscreenElement) await pedirPantallaCompleta(); };

  const preguntaActual = preguntas[indice];
  const esUltima = indice === preguntas.length - 1;
  const siguiente = () => {
    if (preguntaActual?.tipo === "respuesta_corta") responder(preguntaActual.id, respuestaCortaTemp);
    ref.current.respuestas = { ...ref.current.respuestas, ...(preguntaActual?.tipo === "respuesta_corta" ? { [preguntaActual.id]: respuestaCortaTemp } : {}) };
    setRespuestaCortaTemp("");
    if (esUltima) setConfirmando(true); else setIndice((i) => i + 1);
  };
  const elegirOpcion = (texto) => {
    responder(preguntaActual.id, texto); ref.current.respuestas = { ...ref.current.respuestas, [preguntaActual.id]: texto };
    setTimeout(() => { if (esUltima) enviar(); else setIndice((i) => i + 1); }, 220);
  };

  const bloquear = vigilar && empezado && !enviado ? { onCopy: (e) => e.preventDefault(), onCut: (e) => e.preventDefault(), onPaste: (e) => e.preventDefault(), onContextMenu: (e) => e.preventDefault() } : {};

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 overflow-y-auto" style={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)", userSelect: vigilar && empezado ? "none" : "auto" }} {...bloquear}>
      <div className="w-full max-w-lg my-auto" style={{ fontFamily: "'Poppins', -apple-system, sans-serif" }}>
        {cargando ? (
          <div className="rounded-3xl p-8 text-center text-white" style={PANEL}>Cargando…</div>
        ) : errorInicio ? (
          <div className="rounded-3xl p-6 text-center" style={PANEL}>
            <p className="text-sm text-rose-300 mb-4">{errorInicio}</p>
            <button onClick={onCerrar} className="w-full py-3 rounded-xl font-bold text-white" style={BTN}>Cerrar</button>
          </div>
        ) : cerradoPorSalida ? (
          <div className="rounded-3xl p-8 text-center" style={{ background: "rgba(76,5,25,0.85)", border: "1px solid rgba(244,63,94,0.5)" }}>
            <div className="text-5xl mb-3">🚫</div>
            <div className="text-2xl font-extrabold text-white mb-2">Evaluación cerrada</div>
            <p className="text-sm text-rose-100 mb-6">Saliste de la pantalla de la evaluación. Se entregó lo que alcanzaste a responder y tu docente fue informado.</p>
            <button onClick={onCerrar} className="w-full py-3 rounded-xl font-bold text-white" style={BTN}>Cerrar</button>
          </div>
        ) : enviado ? (
          <div className="rounded-3xl p-8 text-center" style={PANEL}>
            <div className="text-5xl mb-3">✅</div>
            <div className="text-2xl font-extrabold text-white mb-2">¡Entregado!</div>
            <p className="text-sm text-slate-300 mb-6">Tu docente va a revisar y publicar tu nota pronto.</p>
            <button onClick={onCerrar} className="w-full py-3 rounded-xl font-bold text-white" style={BTN}>Cerrar</button>
          </div>
        ) : !empezado ? (
          <div className="rounded-3xl p-7 text-center" style={PANEL}>
            <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg text-white mb-4" style={{ background: "#28478a" }}>Evaluación</span>
            <h1 className="text-2xl font-extrabold mb-3" style={{ background: "linear-gradient(to right, #c084fc, #f472b6, #fde047)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{evaluacion.titulo}</h1>
            {evaluacion.descripcion && (
              <div className="text-sm mb-4 text-left texto-oscuro-forzado">
                <style>{`.texto-oscuro-forzado, .texto-oscuro-forzado * { color: #e2e8f0 !important; }`}</style>
                <TextoEnriquecido html={evaluacion.descripcion} />
              </div>
            )}
            {evaluacion.indicaciones && evaluacion.indicaciones.length > 0 && (
              <div className="text-left mb-4 rounded-2xl p-4" style={{ background: "rgba(15,25,50,0.6)", border: "1px solid rgba(47,85,164,0.3)" }}>
                <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "#d8b4fe" }}>Indicaciones</div>
                <ul className="space-y-1.5">{evaluacion.indicaciones.map((ind, i) => <li key={i} className="flex items-start gap-2 text-xs text-slate-300"><span className="text-violet-400 shrink-0">✓</span><span>{ind}</span></li>)}</ul>
              </div>
            )}
            {vigilar && (
              <div className="text-left mb-4 rounded-2xl p-4" style={{ background: "rgba(120,53,15,0.35)", border: "1px solid rgba(251,191,36,0.6)" }}>
                <div className="text-[12px] font-extrabold mb-1.5" style={{ color: "#fcd34d" }}>⚠️ Evaluación con pantalla vigilada</div>
                <ul className="text-xs space-y-1 text-amber-100">
                  <li>• Se abrirá en <b>pantalla completa</b>.</li>
                  <li>• <b>No puedes cambiar de pestaña, de aplicación ni minimizar</b> mientras presentas.</li>
                  <li>• {maxSalidas === 0 ? <>Si sales, <b>la evaluación se cierra al instante</b> y se entrega lo que lleves.</> : <>Tienes <b>{maxSalidas} advertencia{maxSalidas > 1 ? "s" : ""}</b>; a la siguiente salida la evaluación se cierra y se entrega lo que lleves.</>}</li>
                  <li>• Copiar y pegar están desactivados. Tu docente verá cuántas veces saliste.</li>
                </ul>
                <label className="flex items-center gap-2 text-xs text-amber-50 mt-3 cursor-pointer"><input type="checkbox" checked={entiendo} onChange={(e) => setEntiendo(e.target.checked)} /> Entiendo y acepto estas reglas</label>
              </div>
            )}
            {evaluacion.tiempo_limite_minutos && <p className="text-xs font-semibold mb-5" style={{ color: "#f472b6" }}>⏱ Tienes {evaluacion.tiempo_limite_minutos} minutos en total desde que empieces.</p>}
            <button disabled={vigilar && !entiendo} onClick={empezar} className="w-full py-4 rounded-xl font-extrabold text-white text-lg disabled:opacity-40" style={BTN}>¡Comenzar! 🚀</button>
            <button onClick={onCerrar} className="w-full text-xs text-slate-400 mt-3">Cancelar (no se guarda nada)</button>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-4 rounded-2xl px-5 py-3" style={{ background: "rgba(23,38,77,0.6)", border: "1px solid rgba(47,85,164,0.3)" }}>
              <span className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg text-white" style={{ background: "#28478a" }}>Pregunta {indice + 1}/{preguntas.length}</span>
              {vigilar && <span className="text-[10px] font-semibold text-amber-300">🔒 pantalla vigilada</span>}
              {segundosRestantes !== null && <span className="text-lg font-extrabold" style={{ color: segundosRestantes <= 30 ? "#fb7185" : "#f472b6" }}>{formatearTiempo(segundosRestantes)}</span>}
            </div>
            <div className="rounded-3xl p-7 mb-5 text-center min-h-[110px] flex items-center justify-center" style={{ background: "rgba(23,38,77,0.85)", border: "1px solid rgba(47,85,164,0.4)" }}>
              <span className="text-white text-base font-bold whitespace-pre-line">{preguntaActual.enunciado}</span>
            </div>
            {preguntaActual.tipo === "respuesta_corta" ? (
              <div>
                <textarea value={respuestaCortaTemp} onChange={(e) => setRespuestaCortaTemp(e.target.value)} rows={4} placeholder="Escribe tu respuesta…"
                  className="w-full text-sm rounded-2xl px-4 py-3 mb-3 outline-none text-white" style={{ background: "rgba(15,25,50,0.9)", border: "1px solid #28478a", userSelect: "text" }} />
                <button onClick={siguiente} className="w-full py-3.5 rounded-xl font-bold text-white" style={BTN}>{esUltima ? "Finalizar evaluación" : "Siguiente →"}</button>
              </div>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: (preguntaActual.opciones || []).length > 2 ? "1fr 1fr" : "1fr" }}>
                {(preguntaActual.opciones || []).map((o, j) => {
                  const color = COLORES_OPCION[j % COLORES_OPCION.length]; const marcada = respuestas[preguntaActual.id] === o.texto;
                  return (
                    <button key={j} onClick={() => elegirOpcion(o.texto)} className="flex items-center gap-3 p-5 rounded-2xl font-bold text-white text-left"
                      style={{ background: color.bg, borderBottom: `5px solid ${color.borde}`, outline: marcada ? "3px solid white" : "none" }}>
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs shrink-0" style={{ background: "rgba(0,0,0,0.2)" }}>{String.fromCharCode(65 + j)}</span>
                      <span>{o.texto}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {confirmando && !enviado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="rounded-3xl p-6 w-full max-w-sm text-center" style={{ background: "#17264D", border: "1px solid rgba(47,85,164,0.6)" }}>
            <div className="text-lg font-extrabold text-white mb-2">¿Entregar la evaluación?</div>
            <p className="text-xs text-slate-300 mb-4">No vas a poder cambiar tus respuestas después.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmando(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-200" style={{ background: "rgba(255,255,255,0.1)" }}>Revisar</button>
              <button onClick={() => { setConfirmando(false); enviar(); }} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={BTN}>Entregar</button>
            </div>
          </div>
        </div>
      )}
      {aviso && !cerradoPorSalida && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(76,5,25,0.92)" }}>
          <div className="rounded-3xl p-7 w-full max-w-sm text-center" style={{ background: "#450a0a", border: "2px solid #f43f5e" }}>
            <div className="text-5xl mb-2">⚠️</div>
            <div className="text-xl font-extrabold text-white mb-2">¡Saliste de la pantalla!</div>
            <p className="text-sm text-rose-100 mb-2">Esta es tu advertencia {aviso.n} de {aviso.max}.</p>
            <p className="text-sm font-bold text-amber-300 mb-5">Si vuelves a salir, la evaluación se cierra y se entrega lo que lleves.</p>
            <button onClick={continuarTrasAviso} className="w-full py-3 rounded-xl font-bold text-white" style={{ background: "#e11d48" }}>Entendido, continuar</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Tarjeta de cada evaluación ---------------- */
function TarjetaEvaluacionEstudiante({ evaluacion, estudianteId }) {
  const [intentos, setIntentos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [tomando, setTomando] = useState(false);
  const cargar = () => api.fetchMisIntentos(evaluacion.id, estudianteId).then((d) => { setIntentos(d); setCargando(false); });
  useEffect(() => { cargar(); }, [evaluacion.id]);
  if (cargando) return null;

  const ventana = estadoVentana(evaluacion);
  const usados = intentos.length, maxIntentos = evaluacion.intentos_permitidos;
  const puedeIntentar = ventana === "abierta" && (maxIntentos === null || maxIntentos === undefined || usados < maxIntentos);
  const publicado = intentos.filter((i) => i.visible_para_estudiante).sort((a, b) => b.numero_intento - a.numero_intento)[0];
  const hayPendiente = !publicado && intentos.some((i) => i.estado !== "en_progreso");
  const pct = publicado && Number(publicado.puntaje_maximo) > 0 ? Math.round((Number(publicado.puntaje_obtenido) / Number(publicado.puntaje_maximo)) * 100) : null;
  const cn = pct !== null ? colorNota(pct) : null;

  let borde, chip;
  if (publicado) { borde = cn.borde; chip = { bg: cn.bg, txt: `${publicado.puntaje_obtenido}/${publicado.puntaje_maximo}` }; }
  else if (hayPendiente) { borde = "#F59E0B"; chip = { bg: "#d97706", txt: "⏳ En revisión" }; }
  else if (ventana === "proxima") { borde = "#38BDF8"; chip = { bg: "#0284c7", txt: "🗓️ Próxima" }; }
  else if (ventana === "cerrada") { borde = "#94A3B8"; chip = { bg: usados === 0 ? "#e11d48" : "#64748b", txt: usados === 0 ? "No presentada" : "Cerrada" }; }
  else { borde = "#22C55E"; chip = { bg: "#059669", txt: "🟢 Abierta" }; }
  const lim = limiteCierre(evaluacion);
  const horaTxt = lim && evaluacion.hora_cierre ? `, ${lim.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" })}` : "";

  return (
    <div className="bg-white rounded-xl p-3.5 shadow-sm" style={{ borderLeft: `4px solid ${borde}`, opacity: ventana === "cerrada" && !publicado ? 0.85 : 1 }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-800">📝 {evaluacion.titulo}</div>
          {evaluacion.descripcion && <TextoEnriquecido html={evaluacion.descripcion} className="text-xs text-slate-500 mt-1" />}
        </div>
        <span className="text-[11px] font-bold text-white px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap" style={{ background: chip.bg }}>{chip.txt}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-[11px]">
        <span className="text-sky-700">🟢 Abre: {evaluacion.fecha_apertura ? fechaCorta(evaluacion.fecha_apertura) : "ya abierta"}</span>
        <span className="text-rose-600">🔴 Cierra: {evaluacion.fecha_cierre ? `${fechaCorta(evaluacion.fecha_cierre)}${horaTxt}` : "sin fecha"}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-400">
        <span>{maxIntentos ? `${usados}/${maxIntentos} intentos` : `${usados} intento(s)`}</span>
        {evaluacion.tiempo_limite_minutos && <span>· ⏱ {evaluacion.tiempo_limite_minutos} min</span>}
        {evaluacion.vigilar_pantalla && <span className="text-amber-600">· 🔒 pantalla vigilada</span>}
      </div>
      {publicado && (
        <div className="mt-2 rounded-lg px-3 py-2 text-xs font-semibold flex items-center justify-between" style={{ background: `${cn.bg}15`, color: cn.bg }}>
          <span>Nota de la evaluación: {publicado.puntaje_obtenido} / {publicado.puntaje_maximo} pts</span>
          <span>{pct}% · {cn.txt}</span>
        </div>
      )}
      {puedeIntentar && (
        <button onClick={() => setTomando(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white mt-2.5">{usados > 0 ? "Presentar de nuevo" : "Presentar"}</button>
      )}
      {ventana === "proxima" && <div className="text-[11px] text-sky-700 mt-2">Se habilita el {fechaCorta(evaluacion.fecha_apertura)}.</div>}
      {tomando && <TomarEvaluacion evaluacion={evaluacion} estudianteId={estudianteId} onCerrar={() => { setTomando(false); cargar(); }} />}
    </div>
  );
}

/* ---------------- Lista (no desaparece al cerrar) ---------------- */
export function EvaluacionesEstudiante({ estudianteId, gradoId }) {
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  useEffect(() => { api.fetchEvaluacionesDisponibles(gradoId).then((d) => { setEvaluaciones(d || []); setCargando(false); }).catch(() => setCargando(false)); }, [gradoId]);
  if (cargando || evaluaciones.length === 0) return null;
  const orden = { abierta: 0, proxima: 1, cerrada: 2 };
  const lista = [...evaluaciones].sort((a, b) => orden[estadoVentana(a)] - orden[estadoVentana(b)] || String(b.fecha_cierre || "").localeCompare(String(a.fecha_cierre || "")));
  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <div className="text-xs font-semibold text-slate-600 mb-2">📝 Evaluaciones</div>
      <div className="space-y-2">{lista.map((e) => <TarjetaEvaluacionEstudiante key={e.id} evaluacion={e} estudianteId={estudianteId} />)}</div>
    </div>
  );
}
