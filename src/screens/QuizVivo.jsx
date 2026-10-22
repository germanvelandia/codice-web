import React, { useEffect, useRef, useState } from "react";
import * as qv from "../lib/quizVivo";

const COLORES = [
  { bg: "#E21B3C", forma: "▲" }, { bg: "#1368CE", forma: "◆" },
  { bg: "#D89E00", forma: "●" }, { bg: "#26890C", forma: "■" },
  { bg: "#7C3AED", forma: "★" }, { bg: "#0E7490", forma: "✚" },
];
const LETRAS = ["A", "B", "C", "D", "E", "F"];

// =====================================================================================
//  DOCENTE
// =====================================================================================
export function VistaQuizVivoDocente() {
  const [salas, setSalas] = useState([]);
  const [salaId, setSalaId] = useState(null);
  const cargar = () => qv.fetchMisSalas().then(setSalas).catch(() => setSalas([]));
  useEffect(() => { cargar(); }, []);

  if (salaId) return <PanelSala salaId={salaId} onSalir={() => { setSalaId(null); cargar(); }} />;
  return (
    <div>
      <CrearQuiz onCreada={(s) => { setSalaId(s.id); }} />
      <div className="mt-6">
        <h3 className="font-bold text-slate-800 mb-2">Tus quizzes recientes</h3>
        {salas.length === 0 && <p className="text-xs text-slate-400">Todavía no has creado ninguno.</p>}
        <div className="space-y-1.5">
          {salas.map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-700 truncate">{s.titulo}</div>
                <div className="text-[11px] text-slate-400">Código <b className="tracking-widest text-slate-600">{s.codigo}</b> · {s.estado === "fin" ? "terminado" : "en curso"} · {new Date(s.creado_en).toLocaleDateString()}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setSalaId(s.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white">Abrir</button>
                <button onClick={async () => { if (!confirm("¿Borrar este quiz y sus resultados?")) return; await qv.eliminarSala(s.id); cargar(); }} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CrearQuiz({ onCreada }) {
  const [titulo, setTitulo] = useState("");
  const [tiempo, setTiempo] = useState(20);
  const [categorias, setCategorias] = useState([]);
  const [categoriaId, setCategoriaId] = useState("");
  const [cantidad, setCantidad] = useState(10);
  const [preguntas, setPreguntas] = useState([]);
  const [manual, setManual] = useState({ texto: "", opciones: ["", "", "", ""], correcta: 0 });
  const [cargando, setCargando] = useState(false);
  const [creando, setCreando] = useState(false);

  useEffect(() => { qv.fetchCategoriasQuiz().then(setCategorias).catch(() => setCategorias([])); }, []);

  const traerDelBanco = async () => {
    setCargando(true);
    try {
      const nuevas = await qv.preguntasDesdeBanco(categoriaId ? Number(categoriaId) || categoriaId : null, Number(cantidad) || 10);
      if (nuevas.length === 0) alert("No encontré preguntas activas con 2 o más opciones en esa categoría.");
      setPreguntas((prev) => [...prev, ...nuevas]);
    } catch (e) { alert("No se pudieron traer las preguntas: " + e.message); }
    setCargando(false);
  };

  const agregarManual = () => {
    const opciones = manual.opciones.map((o) => o.trim()).filter(Boolean);
    const textoCorrecta = manual.opciones[manual.correcta]?.trim();
    if (!manual.texto.trim() || opciones.length < 2 || !textoCorrecta) { alert("Escribe la pregunta, al menos 2 opciones y marca la correcta."); return; }
    setPreguntas((prev) => [...prev, { texto: manual.texto.trim(), opciones, correcta: opciones.indexOf(textoCorrecta) }]);
    setManual({ texto: "", opciones: ["", "", "", ""], correcta: 0 });
  };

  const crear = async () => {
    if (preguntas.length === 0) { alert("Agrega al menos una pregunta."); return; }
    setCreando(true);
    try {
      const s = await qv.crearQuiz(titulo.trim() || "Quiz en vivo", Number(tiempo) || 20, preguntas);
      onCreada(s);
    } catch (e) { alert("No se pudo crear el quiz: " + e.message); }
    setCreando(false);
  };

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">⚡ Nuevo quiz en vivo</h3>
      <p className="text-xs text-slate-400 mb-3">Los estudiantes entran con un código desde su portal y responden al mismo tiempo. Gana más puntos quien acierta más rápido.</p>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (ej: Repaso valores)" className="col-span-2 text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
        <div>
          <label className="text-[11px] text-slate-500 block mb-1">Segundos por pregunta</label>
          <input type="number" min="5" max="120" value={tiempo} onChange={(e) => setTiempo(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
        </div>
      </div>

      <div className="bg-violet-50 rounded-xl p-3 mb-3">
        <div className="text-xs font-semibold text-violet-700 mb-2">1) Traer preguntas de tu banco de Preguntados</div>
        <div className="flex flex-wrap gap-2 items-end">
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="text-xs rounded-lg px-2 py-2 border border-slate-200 bg-white outline-none">
            <option value="">Todas las categorías</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.emoji ? c.emoji + " " : ""}{c.nombre}{c.materia_nombre ? ` · ${c.materia_nombre}` : ""}</option>)}
          </select>
          <div>
            <label className="text-[10px] text-slate-500 block">Cuántas</label>
            <input type="number" min="1" max="60" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="w-16 text-xs rounded-lg px-2 py-2 border border-slate-200 outline-none" />
          </div>
          <button disabled={cargando} onClick={traerDelBanco} className="text-xs font-semibold px-3 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">{cargando ? "Trayendo…" : "Traer al azar"}</button>
        </div>
      </div>

      <details className="bg-slate-50 rounded-xl p-3 mb-3">
        <summary className="text-xs font-semibold text-slate-600 cursor-pointer">2) O escribir una pregunta aquí</summary>
        <div className="mt-2 space-y-1.5">
          <input value={manual.texto} onChange={(e) => setManual({ ...manual, texto: e.target.value })} placeholder="Pregunta" className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
          {manual.opciones.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="correcta" checked={manual.correcta === i} onChange={() => setManual({ ...manual, correcta: i })} title="Es la correcta" />
              <input value={o} onChange={(e) => setManual({ ...manual, opciones: manual.opciones.map((x, k) => (k === i ? e.target.value : x)) })} placeholder={`Opción ${LETRAS[i]}`} className="flex-1 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
            </div>
          ))}
          <button onClick={agregarManual} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-700 text-white">Agregar pregunta</button>
        </div>
      </details>

      <div className="mb-3">
        <div className="text-xs font-semibold text-slate-600 mb-1">Preguntas del quiz ({preguntas.length})</div>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {preguntas.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5">
              <span className="truncate"><b>{i + 1}.</b> {p.texto} <span className="text-emerald-600">✓ {p.opciones[p.correcta]}</span></span>
              <button onClick={() => setPreguntas(preguntas.filter((_, k) => k !== i))} className="text-slate-400 hover:text-rose-500 ml-2">✕</button>
            </div>
          ))}
        </div>
      </div>
      <button disabled={creando || preguntas.length === 0} onClick={crear} className="w-full text-sm font-semibold px-4 py-2.5 rounded-xl bg-emerald-500 text-white disabled:opacity-50">
        {creando ? "Creando…" : "Crear sala y obtener código"}
      </button>
    </div>
  );
}

function PanelSala({ salaId, onSalir }) {
  const [panel, setPanel] = useState(null);
  const [error, setError] = useState("");
  const [, setTick] = useState(0);
  const [trabajando, setTrabajando] = useState(false);
  const [premios, setPremios] = useState([30, 20, 10]);
  const [premiado, setPremiado] = useState(false);
  const cerrandoRef = useRef(false);

  const refrescar = () => qv.fetchPanelSala(salaId).then((p) => { setPanel(p); setError(""); }).catch((e) => setError(e.message));
  useEffect(() => { refrescar(); const id = setInterval(() => { if (!document.hidden) refrescar(); }, 4000); return () => clearInterval(id); }, [salaId]);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 500); return () => clearInterval(id); }, []);

  const accion = async (a) => {
    setTrabajando(true);
    try { await qv.avanzarQuiz(salaId, a); await refrescar(); } catch (e) { alert(e.message); }
    setTrabajando(false); cerrandoRef.current = false;
  };

  if (!panel) return <div className="text-sm text-slate-400">{error || "Cargando…"}</div>;
  const { sala, preguntas, jugadores, respondieron, conteo, actual } = panel;
  const total = preguntas.length;
  const restante = sala.estado === "pregunta" ? Math.max(0, sala.tiempo_seg - (Date.now() - Date.parse(sala.pregunta_inicio)) / 1000) : null;

  // Cuando se acaba el tiempo o ya contestaron todos, pasa solo a mostrar el resultado
  const todos = jugadores.length > 0 && respondieron >= jugadores.length;
  if (sala.estado === "pregunta" && (restante <= 0 || todos) && !cerrandoRef.current) {
    cerrandoRef.current = true;
    qv.avanzarQuiz(salaId, "resultado").then(refrescar).catch(() => { cerrandoRef.current = false; });
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <button onClick={onSalir} className="text-xs text-slate-500">← Volver</button>
        <div className="text-xs text-slate-400">{sala.titulo}</div>
      </div>

      <div className="text-center bg-violet-50 rounded-2xl py-4 mb-3">
        <div className="text-[11px] text-violet-600 font-semibold">Entra al portal → ⚡ Quiz en vivo e ingresa el código</div>
        <div className="text-5xl font-black tracking-[0.3em] text-violet-700 mt-1">{sala.codigo}</div>
        <div className="text-xs text-slate-500 mt-1">{jugadores.length} jugador{jugadores.length === 1 ? "" : "es"} conectado{jugadores.length === 1 ? "" : "s"}</div>
      </div>

      {sala.estado === "lobby" && (
        <div className="text-center">
          <p className="text-sm text-slate-500 mb-3">Espera a que se unan tus estudiantes y luego comienza.</p>
          <button disabled={trabajando || jugadores.length === 0} onClick={() => accion("iniciar")} className="text-sm font-semibold px-6 py-2.5 rounded-xl bg-emerald-500 text-white disabled:opacity-50">▶ Iniciar quiz ({total} preguntas)</button>
        </div>
      )}

      {(sala.estado === "pregunta" || sala.estado === "resultado") && actual && (
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Pregunta {sala.idx + 1} de {total}</span>
            {sala.estado === "pregunta" ? <span className="font-bold text-rose-600">⏱ {Math.ceil(restante)} s · respondieron {respondieron}/{jugadores.length}</span> : <span className="font-semibold text-emerald-600">Resultado</span>}
          </div>
          <div className="text-lg font-bold text-slate-800 mb-2">{actual.texto}</div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {actual.opciones.map((o, i) => {
              const esCorrecta = sala.estado === "resultado" && i === actual.correcta;
              return (
                <div key={i} className="rounded-xl px-3 py-2 text-white text-sm font-semibold flex justify-between items-center" style={{ background: COLORES[i % 6].bg, opacity: sala.estado === "resultado" && !esCorrecta ? 0.45 : 1, outline: esCorrecta ? "3px solid #111" : "none" }}>
                  <span>{COLORES[i % 6].forma} {o}</span><span className="text-xs bg-black/20 rounded-full px-2 py-0.5">{conteo[i] || 0}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 justify-center mb-3">
            {sala.estado === "pregunta" && <button disabled={trabajando} onClick={() => accion("resultado")} className="text-sm font-semibold px-4 py-2 rounded-xl bg-amber-500 text-white">📊 Mostrar resultado ya</button>}
            {sala.estado === "resultado" && <button disabled={trabajando} onClick={() => accion("iniciar")} className="text-sm font-semibold px-5 py-2 rounded-xl bg-emerald-500 text-white">{sala.idx + 1 >= total ? "🏁 Terminar y ver podio" : "▶ Siguiente pregunta"}</button>}
            <button disabled={trabajando} onClick={() => { if (confirm("¿Terminar el quiz ahora?")) accion("fin"); }} className="text-xs text-slate-400 px-3">Terminar</button>
          </div>
        </div>
      )}

      {sala.estado === "fin" && (
        <div className="mb-3">
          <div className="text-center text-lg font-extrabold text-slate-800 mb-2">🏁 ¡Quiz terminado!</div>
          <div className="flex justify-center items-end gap-2 mb-3">
            {[1, 0, 2].map((pos) => jugadores[pos] ? (
              <div key={pos} className="text-center">
                <div className="text-2xl">{["🥇", "🥈", "🥉"][pos]}</div>
                <div className="text-xs font-bold text-slate-700 max-w-[90px] truncate">{jugadores[pos].nombre}</div>
                <div className="rounded-t-lg bg-violet-500 text-white text-xs font-bold px-3 pt-1" style={{ height: [70, 50, 36][pos] }}>{jugadores[pos].puntos}</div>
              </div>
            ) : null)}
          </div>
          <div className="bg-amber-50 rounded-xl p-3">
            <div className="text-xs font-semibold text-amber-700 mb-1.5">🪙 Premiar al podio con monedas (opcional)</div>
            <div className="flex items-center gap-2">
              {premios.map((m, i) => (
                <label key={i} className="text-[11px] text-slate-500">{["🥇", "🥈", "🥉"][i]}
                  <input type="number" min="0" value={m} onChange={(e) => setPremios(premios.map((x, k) => (k === i ? Number(e.target.value) || 0 : x)))} className="w-14 ml-1 text-xs rounded px-1.5 py-1 border border-slate-200" />
                </label>
              ))}
              <button disabled={premiado || trabajando} onClick={async () => {
                setTrabajando(true);
                try { const n = await qv.premiarPodio(jugadores, premios); setPremiado(true); alert(`Monedas entregadas a ${n} estudiante${n === 1 ? "" : "s"}.`); }
                catch (e) { alert("No se pudieron entregar las monedas: " + e.message); }
                setTrabajando(false);
              }} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 text-white disabled:opacity-50">{premiado ? "Entregadas ✓" : "Entregar"}</button>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold text-slate-600 mb-1">Clasificación</div>
        <div className="space-y-1">
          {jugadores.slice(0, 10).map((j, i) => (
            <div key={j.estudiante_id} className="flex justify-between text-xs bg-slate-50 rounded-lg px-3 py-1.5"><span>{i + 1}. {j.nombre}</span><b className="text-violet-600">{j.puntos}</b></div>
          ))}
          {jugadores.length === 0 && <p className="text-xs text-slate-400">Aún no hay jugadores.</p>}
        </div>
      </div>
    </div>
  );
}

// =====================================================================================
//  ESTUDIANTE
// =====================================================================================
export function QuizVivoEstudiante() {
  const [codigo, setCodigo] = useState(() => { try { return sessionStorage.getItem("codice_quiz_codigo") || ""; } catch { return ""; } });
  const [unido, setUnido] = useState(false);
  const [est, setEst] = useState(null);
  const [recibidoEn, setRecibidoEn] = useState(0);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [miOpcion, setMiOpcion] = useState(null);
  const [, setTick] = useState(0);
  const idxRef = useRef(-2);

  const guardar = (c) => { try { sessionStorage.setItem("codice_quiz_codigo", c); } catch { /* sin almacenamiento */ } };

  const entrar = async (c) => {
    setError("");
    try { await qv.unirseQuiz(c); guardar(c); setUnido(true); } catch (e) { setError(e.message); setUnido(false); }
  };
  // si recarga la página, vuelve a entrar solo
  useEffect(() => { if (codigo) entrar(codigo.trim().toUpperCase()); }, []);

  useEffect(() => {
    if (!unido) return undefined;
    let vivo = true;
    const pedir = () => qv.estadoQuiz(codigo.trim().toUpperCase()).then((d) => {
      if (!vivo) return;
      if (d.idx !== idxRef.current) { idxRef.current = d.idx; setMiOpcion(null); }
      setEst(d); setRecibidoEn(Date.now()); setError("");
    }).catch((e) => { if (vivo) setError(e.message); });
    pedir();
    const id = setInterval(() => { if (!document.hidden) pedir(); }, 3000);
    const t = setInterval(() => setTick((x) => x + 1), 250);
    return () => { vivo = false; clearInterval(id); clearInterval(t); };
  }, [unido, codigo]);

  const responder = async (i) => {
    if (enviando || miOpcion !== null || est?.yo?.respondio) return;
    setEnviando(true); setMiOpcion(i);
    try {
      const r = await qv.responderQuiz(codigo.trim().toUpperCase(), i);
      if (!r.ok) { setMiOpcion(null); setError(r.motivo === "tiempo" ? "Se acabó el tiempo." : r.motivo === "ya_respondio" ? "Ya habías respondido." : "No se pudo enviar."); }
    } catch (e) { setMiOpcion(null); setError(e.message); }
    setEnviando(false);
  };

  const salir = () => { try { sessionStorage.removeItem("codice_quiz_codigo"); } catch { /* nada */ } setUnido(false); setEst(null); setCodigo(""); idxRef.current = -2; };

  if (!unido) {
    return (
      <div className="max-w-sm mx-auto text-center py-6">
        <div className="text-4xl mb-2">⚡</div>
        <h3 className="font-bold text-slate-800 mb-1">Quiz en vivo</h3>
        <p className="text-xs text-slate-400 mb-4">Escribe el código que tu docente muestra en pantalla.</p>
        <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} maxLength={6} placeholder="CÓDIGO"
          className="w-full text-center text-3xl font-black tracking-[0.3em] rounded-xl px-3 py-3 border-2 border-violet-200 outline-none uppercase" />
        {error && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2 mt-3">{error}</div>}
        <button disabled={codigo.trim().length < 4} onClick={() => entrar(codigo.trim().toUpperCase())} className="w-full mt-3 text-sm font-bold py-3 rounded-xl bg-violet-500 text-white disabled:opacity-50">Entrar</button>
      </div>
    );
  }

  if (!est) return <div className="text-sm text-slate-400 text-center py-8">{error || "Conectando…"}</div>;
  const restante = est.estado === "pregunta" && est.restante != null ? Math.max(0, est.restante - (Date.now() - recibidoEn) / 1000) : 0;
  const respondio = est.yo?.respondio || miOpcion !== null;

  return (
    <div className="max-w-md mx-auto">
      <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
        <span>{est.titulo}</span>
        <span>Puntos: <b className="text-violet-600">{est.yo.puntos}</b> · Puesto {est.yo.puesto}</span>
      </div>
      {error && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2 mb-2">{error}</div>}

      {est.estado === "lobby" && (
        <div className="text-center py-10">
          <div className="text-5xl mb-3">🎮</div>
          <div className="font-bold text-slate-800">¡Estás dentro, {est.yo.nombre?.split(" ")[0]}!</div>
          <p className="text-xs text-slate-400 mt-1">Esperando a que el docente inicie… ({est.jugadores} conectado{est.jugadores === 1 ? "" : "s"})</p>
        </div>
      )}

      {est.estado === "pregunta" && est.pregunta && (
        <div>
          <div className="flex justify-between text-xs mb-1"><span className="text-slate-500">Pregunta {est.idx + 1} de {est.total}</span><span className="font-black text-rose-600 text-lg">⏱ {Math.ceil(restante)}</span></div>
          <div className="h-1.5 rounded-full bg-slate-100 mb-3 overflow-hidden"><div className="h-full bg-rose-500" style={{ width: `${(restante / est.tiempo_seg) * 100}%`, transition: "width 0.25s linear" }} /></div>
          <div className="text-lg font-bold text-slate-800 mb-3">{est.pregunta.texto}</div>
          <div className="grid grid-cols-1 gap-2">
            {est.pregunta.opciones.map((o, i) => (
              <button key={i} disabled={respondio || restante <= 0} onClick={() => responder(i)}
                className="rounded-xl px-4 py-3.5 text-white text-left font-semibold text-sm flex items-center gap-3 disabled:opacity-60"
                style={{ background: COLORES[i % 6].bg, outline: (miOpcion === i || est.yo.opcion === i) ? "4px solid #111" : "none" }}>
                <span className="text-lg">{COLORES[i % 6].forma}</span><span>{o}</span>
              </button>
            ))}
          </div>
          {respondio && <div className="text-center text-sm font-semibold text-violet-600 mt-3">✅ Respuesta enviada. Espera el resultado…</div>}
        </div>
      )}

      {est.estado === "resultado" && est.pregunta && (
        <div className="text-center">
          <div className={`rounded-2xl py-6 mb-3 ${est.yo.acerto ? "bg-emerald-50" : "bg-rose-50"}`}>
            <div className="text-5xl">{est.yo.acerto ? "🎉" : est.yo.respondio ? "😅" : "⌛"}</div>
            <div className={`font-extrabold text-lg mt-1 ${est.yo.acerto ? "text-emerald-600" : "text-rose-600"}`}>
              {est.yo.acerto ? `¡Correcto! +${est.yo.puntos_pregunta}` : est.yo.respondio ? "No era esa" : "No alcanzaste a responder"}
            </div>
            <div className="text-xs text-slate-500 mt-1">Respuesta correcta: <b>{est.pregunta.opciones[est.pregunta.correcta]}</b></div>
          </div>
          <div className="text-xs font-semibold text-slate-600 mb-1">Clasificación</div>
          <div className="space-y-1 text-left">
            {est.ranking.slice(0, 5).map((j, i) => (
              <div key={i} className="flex justify-between text-xs bg-slate-50 rounded-lg px-3 py-1.5"><span>{i + 1}. {j.nombre}</span><b className="text-violet-600">{j.puntos}</b></div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Tu puesto: {est.yo.puesto} de {est.jugadores}</p>
        </div>
      )}

      {est.estado === "fin" && (
        <div className="text-center">
          <div className="text-5xl mb-1">{est.yo.puesto === 1 ? "🥇" : est.yo.puesto === 2 ? "🥈" : est.yo.puesto === 3 ? "🥉" : "🏁"}</div>
          <div className="font-extrabold text-slate-800 text-lg">Quedaste en el puesto {est.yo.puesto} de {est.jugadores}</div>
          <div className="text-sm text-violet-600 font-bold mb-3">{est.yo.puntos} puntos</div>
          <div className="space-y-1 text-left mb-3">
            {est.ranking.slice(0, 5).map((j, i) => (
              <div key={i} className="flex justify-between text-xs bg-slate-50 rounded-lg px-3 py-1.5"><span>{["🥇", "🥈", "🥉"][i] || `${i + 1}.`} {j.nombre}</span><b className="text-violet-600">{j.puntos}</b></div>
            ))}
          </div>
          <button onClick={salir} className="text-sm font-semibold px-5 py-2 rounded-xl bg-violet-500 text-white">Salir del quiz</button>
        </div>
      )}
    </div>
  );
}
