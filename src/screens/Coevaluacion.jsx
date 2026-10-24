import React, { useEffect, useMemo, useState } from "react";
import * as api from "../lib/api";
import * as co from "../lib/coevaluacion";
import { calcularNotaRubrica, NivelesEditor, RubricaGrid } from "../components/Rubrica";

const NIVELES_INICIALES = () => [{ nombre: "Alto", puntos: 5 }, { nombre: "Medio", puntos: 3 }, { nombre: "Bajo", puntos: 1 }];

const TIPOS = { auto: "Solo autoevaluación", co: "Solo coevaluación", ambas: "Auto + coevaluación" };
const MODOS = { azar: "Compañeros al azar", todos: "Todo el curso", grupo: "Mi grupo (reino)" };

// =============================== DOCENTE ===============================
export function VistaCoevaluacion({ grados = [], gradoActivo }) {
  const [gradoId, setGradoId] = useState(gradoActivo || grados[0]?.id || "");
  const [lista, setLista] = useState([]);
  const [creando, setCreando] = useState(false);
  const [abierta, setAbierta] = useState(null);
  const [editando, setEditando] = useState(null);
  const [duplicando, setDuplicando] = useState(null);
  const [error, setError] = useState("");
  const cargar = () => co.fetchCoevaluaciones(gradoId).then(setLista).catch((e) => setError(co.mensajeCoev(e)));
  useEffect(() => { if (gradoId) cargar(); }, [gradoId]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-lg px-2 py-2 border border-slate-200 bg-white">
          {grados.map((g) => <option key={g.id} value={g.id}>{g.nombre || g.id}</option>)}
        </select>
        <button onClick={() => { setEditando(null); setCreando(!creando); }} className="text-sm px-3 py-2 rounded-lg bg-violet-600 text-white">{creando ? "Cancelar" : "➕ Nueva evaluación"}</button>
      </div>
      {error && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2">{error}</div>}
      {creando && <FormNueva gradoId={gradoId} onListo={() => { setCreando(false); cargar(); }} />}
      {editando && <FormNueva key={editando.id} gradoId={gradoId} inicial={editando} onListo={() => { setEditando(null); cargar(); }} onCancelar={() => setEditando(null)} />}
      {lista.length === 0 && !creando && <p className="text-xs text-slate-400">Aún no hay autoevaluaciones ni coevaluaciones en este curso.</p>}
      {lista.map((ev) => (
        <div key={ev.id} className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setAbierta(abierta === ev.id ? null : ev.id)} className="font-semibold text-sm text-left flex-1">{ev.titulo}</button>
            <span className="text-[11px] text-slate-500">{TIPOS[ev.tipo]}{ev.tipo !== "auto" ? ` · ${MODOS[ev.modo_co]}${ev.modo_co === "azar" ? ` (${ev.cantidad})` : ""}` : ""}</span>
            <label className="text-[11px] flex items-center gap-1"><input type="checkbox" checked={ev.activa} onChange={async (e) => { await co.actualizarCoevaluacion(ev.id, { activa: e.target.checked }); cargar(); }} />Activa</label>
            <button onClick={() => { setCreando(false); setEditando(null); setDuplicando(duplicando?.id === ev.id ? null : ev); }} className="text-slate-400 hover:text-violet-600" title="Duplicar a otros cursos">📑</button>
            <button onClick={() => { setCreando(false); setDuplicando(null); setEditando(ev); }} className="text-slate-400 hover:text-violet-600" title="Editar">✏️</button>
            <button onClick={async () => { if (!confirm("¿Borrar esta evaluación y sus respuestas?")) return; await co.eliminarCoevaluacion(ev.id); cargar(); }} className="text-slate-400 hover:text-rose-500">🗑</button>
          </div>
          {duplicando?.id === ev.id && <DuplicarEval ev={ev} grados={grados} onListo={() => { setDuplicando(null); cargar(); }} onCancelar={() => setDuplicando(null)} />}
          {abierta === ev.id && <Resultados ev={ev} onCambio={cargar} />}
        </div>
      ))}
    </div>
  );
}


function DuplicarEval({ ev, grados, onListo, onCancelar }) {
  const [elegidos, setElegidos] = useState([]);
  const [sufijo, setSufijo] = useState(true);
  const [msg, setMsg] = useState(""); const [trabajando, setTrabajando] = useState(false);
  const otros = grados.filter((g) => String(g.id) !== String(ev.grado_id));
  const alternar = (id) => setElegidos((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const duplicar = async () => {
    setTrabajando(true); setMsg("");
    try { const n = await co.duplicarCoevaluacion(ev, elegidos, { sufijoCurso: sufijo }); setMsg(`✔ Se creó en ${n} curso(s).`); setTimeout(onListo, 900); }
    catch (e) { setMsg(co.mensajeCoev(e)); }
    setTrabajando(false);
  };
  return (
    <div className="mt-2 rounded-xl border border-violet-200 bg-violet-50 p-3 space-y-2">
      <div className="text-sm font-semibold text-violet-800">📑 Duplicar «{ev.titulo}» a otros cursos</div>
      <p className="text-[11px] text-slate-500">Se copian la rúbrica, la escala, el tipo, el modo de coevaluación y la fecha de cierre. Cada curso tendrá sus propias respuestas y sus compañeros asignados.</p>
      <div className="flex flex-wrap gap-2">
        {otros.map((g) => <label key={g.id} className={`text-sm px-3 py-1 rounded-full border cursor-pointer ${elegidos.includes(g.id) ? "bg-violet-600 text-white border-violet-600" : "bg-white border-slate-200 text-slate-600"}`}><input type="checkbox" className="hidden" checked={elegidos.includes(g.id)} onChange={() => alternar(g.id)} />{g.nombre || g.id}</label>)}
        {otros.length > 0 && <button onClick={() => setElegidos(elegidos.length === otros.length ? [] : otros.map((g) => g.id))} className="text-xs text-violet-600 underline">{elegidos.length === otros.length ? "Quitar todos" : "Todos"}</button>}
        {otros.length === 0 && <span className="text-xs text-slate-400">No hay otros cursos disponibles.</span>}
      </div>
      <label className="text-xs text-slate-600 flex items-center gap-1"><input type="checkbox" checked={sufijo} onChange={(e) => setSufijo(e.target.checked)} /> Agregar el curso al título (ej. «{ev.titulo} (802)»)</label>
      {msg && <div className={`text-xs ${msg.startsWith("✔") ? "text-emerald-700" : "text-rose-600"}`}>{msg}</div>}
      <div className="flex gap-2">
        <button disabled={!elegidos.length || trabajando} onClick={duplicar} className="text-sm px-3 py-2 rounded-lg bg-violet-600 text-white disabled:opacity-40">{trabajando ? "Duplicando…" : `Duplicar a ${elegidos.length} curso(s)`}</button>
        <button onClick={onCancelar} className="text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white">Cancelar</button>
      </div>
    </div>
  );
}

function FormNueva({ gradoId, onListo, inicial, onCancelar }) {
  const ed = !!inicial;
  const [conRespuestas, setConRespuestas] = useState(false);
  const [titulo, setTitulo] = useState(inicial?.titulo || "");
  const [periodo, setPeriodo] = useState(inicial?.periodo || "");
  const [tipo, setTipo] = useState(inicial?.tipo || "ambas");
  const [modo, setModo] = useState(inicial?.modo_co || "azar");
  const [cantidad, setCantidad] = useState(inicial?.cantidad || 3);
  const [rubrica, setRubrica] = useState(() => JSON.parse(JSON.stringify(inicial ? inicial.criterios : co.CRITERIOS_DEFECTO)));
  const [catalogo, setCatalogo] = useState([]);
  const aLocal = (iso) => { if (!iso) return ""; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const [cierra, setCierra] = useState(aLocal(inicial?.cierra));
  const [visib, setVisib] = useState(inicial?.visibilidad || "docente");
  const [escMin, setEscMin] = useState(inicial?.escala_min ?? 1);
  const [escMax, setEscMax] = useState(inicial?.escala_max ?? 5);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { api.fetchRubricasCatalogo().then(setCatalogo).catch(() => {}); if (inicial) co.fetchRespuestasCoev(inicial.id).then((d) => setConRespuestas(d.respuestas.length > 0)).catch(() => {}); }, []);

  const actualizarCriterio = (i, t) => setRubrica((p) => p.map((c, k) => k === i ? { ...c, criterio: t } : c));
  const actualizarNivel = (i, jj, campo, v) => setRubrica((p) => p.map((c, k) => k === i ? { ...c, niveles: c.niveles.map((n, m) => m === jj ? { ...n, [campo]: campo === "puntos" ? parseFloat(v) || 0 : v } : n) } : c));
  const agregarNivel = (i) => setRubrica((p) => p.map((c, k) => k === i ? { ...c, niveles: [...c.niveles, { nombre: "Nuevo nivel", puntos: 0 }] } : c));
  const quitarNivel = (i, jj) => setRubrica((p) => p.map((c, k) => k !== i ? c : c.niveles.length <= 1 ? c : { ...c, niveles: c.niveles.filter((_, m) => m !== jj) }));

  const guardar = async () => {
    const criterios = ed && conRespuestas ? inicial.criterios : rubrica.filter((c) => c.criterio.trim()).map((c) => ({ criterio: c.criterio.trim(), niveles: c.niveles.map((n) => ({ nombre: String(n.nombre).trim(), puntos: Number(n.puntos) || 0, descripcion: (n.descripcion || "").trim() })) }));
    if (criterios.length === 0 || criterios.some((c) => c.niveles.length < 2 || c.niveles.some((n) => !n.nombre))) return setError("Cada criterio necesita nombre y al menos 2 niveles con nombre.");
    if (!titulo.trim()) return setError("Ponle un título.");
    if (!criterios.length) return setError("Agrega al menos un criterio.");
    setGuardando(true); setError("");
    try {
      if (ed) {
        const cambioAsig = modo !== inicial.modo_co || (Number(cantidad) || 3) !== inicial.cantidad;
        await co.actualizarCoevaluacion(inicial.id, { titulo: titulo.trim(), periodo: periodo || null, criterios, escala_min: Number(escMin), escala_max: Number(escMax), visibilidad: visib, cierra: cierra ? new Date(cierra).toISOString() : null, modo_co: modo, cantidad: Number(cantidad) || 3 });
        if (cambioAsig && inicial.tipo !== "auto") await co.reasignarCoevaluacion(inicial.id, false);
        return onListo();
      }
      await co.crearCoevaluacion({
        grado_id: gradoId, titulo: titulo.trim(), periodo: periodo || null, tipo, modo_co: modo, cantidad: Number(cantidad) || 3,
        criterios, escala_min: Number(escMin), escala_max: Number(escMax), visibilidad: visib,
        cierra: cierra ? new Date(cierra).toISOString() : null,
      });
      onListo();
    } catch (e) { setError(co.mensajeCoev(e)); } finally { setGuardando(false); }
  };
  const inp = "text-sm rounded-lg px-2 py-1.5 border border-slate-200 bg-white outline-none w-full";
  return (
    <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 space-y-2">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (ej. Trabajo en equipo – P3)" className={inp} />
      <div className="grid grid-cols-2 gap-2">
        <select value={tipo} disabled={ed} onChange={(e) => setTipo(e.target.value)} className={inp}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="Periodo (opcional)" className={inp} />
      </div>
      {tipo !== "auto" && (
        <div className="grid grid-cols-2 gap-2">
          <select value={modo} onChange={(e) => setModo(e.target.value)} className={inp}>{Object.entries(MODOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          {(modo === "azar" || modo === "grupo") && <label className="text-xs text-slate-600 flex items-center gap-2">Cuántos compañeros evalúa cada uno <input type="number" min={1} max={40} value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="w-16 rounded-lg px-2 py-1 border border-slate-200" /></label>}
        </div>
      )}
      <div className={`space-y-2 ${ed && conRespuestas ? "opacity-40 pointer-events-none" : ""}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">📊 Rúbrica de calificación</span>
          {catalogo.length > 0 && (
            <select value="" onChange={(e) => { const r = catalogo.find((x) => String(x.id) === e.target.value); if (r) setRubrica(JSON.parse(JSON.stringify(r.criterios))); }} className="text-xs rounded-lg px-2 py-1 border border-slate-200 bg-white ml-auto">
              <option value="">📋 Cargar desde una rúbrica guardada…</option>{catalogo.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          )}
        </div>
        <div className="space-y-3">
          {rubrica.map((c, i) => (
            <div key={i} className="border border-slate-200 rounded-xl p-3 bg-white">
              <div className="flex items-center gap-2 mb-2">
                <input value={c.criterio} onChange={(e) => actualizarCriterio(i, e.target.value)} placeholder="Criterio a evaluar (ej: Participación)" className="flex-1 text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
                <button onClick={() => setRubrica((p) => p.filter((_, k) => k !== i))} className="text-slate-300 hover:text-rose-500">🗑</button>
              </div>
              <NivelesEditor criterio={c} i={i} actualizarNivel={actualizarNivel} quitarNivel={quitarNivel} agregarNivel={agregarNivel} />
            </div>
          ))}
          <button onClick={() => setRubrica((p) => [...p, { criterio: "", niveles: NIVELES_INICIALES() }])} className="text-xs text-violet-500">+ Agregar criterio</button>
        </div>
        <p className="text-[11px] text-slate-500">Igual que en las planillas: los estudiantes verán la cuadrícula (criterios en filas, niveles en columnas con su descriptor) y la nota se ajusta a la escala de abajo.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
        <label>Escala de {" "}<input type="number" step="0.1" value={escMin} onChange={(e) => setEscMin(e.target.value)} className="w-14 rounded px-1 border border-slate-200" /> a <input type="number" step="0.1" value={escMax} onChange={(e) => setEscMax(e.target.value)} className="w-14 rounded px-1 border border-slate-200" /></label>
        <label>Cierra <input type="datetime-local" value={cierra} onChange={(e) => setCierra(e.target.value)} className="rounded px-1 border border-slate-200" /></label>
      </div>
      {tipo !== "auto" && (
        <select value={visib} onChange={(e) => setVisib(e.target.value)} className={inp}>
          <option value="docente">Privacidad: solo yo veo las coevaluaciones</option>
          <option value="promedio">Privacidad: los estudiantes verán su promedio y comentarios, sin nombres (cuando yo publique)</option>
        </select>
      )}
      {ed && <p className="text-[11px] text-slate-500">El tipo no se cambia una vez creada. Si cambias el modo o la cantidad de compañeros, se reasignan los pares que aún no tienen respuesta (los ya evaluados se conservan).{conRespuestas ? " Los criterios quedan bloqueados porque ya hay respuestas; para cambiarlos crea una evaluación nueva." : ""}</p>}
      {error && <div className="text-xs text-rose-600">{error}</div>}
      <div className="flex gap-2">
        <button disabled={guardando} onClick={guardar} className="text-sm px-3 py-2 rounded-lg bg-violet-600 text-white disabled:opacity-50">{guardando ? "Guardando…" : ed ? "Guardar cambios" : "Crear y asignar"}</button>
        {ed && <button onClick={onCancelar} className="text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white">Cancelar</button>}
      </div>
    </div>
  );
}


// ---------- Pasar los resultados a una columna de la Planilla de calificaciones ----------
function PasarAPlanilla({ ev, filas }) {
  const [abierto, setAbierto] = useState(false);
  const [materias, setMaterias] = useState([]);
  const [materiaId, setMateriaId] = useState("");
  const [cats, setCats] = useState([]);
  const [categoriaId, setCategoriaId] = useState("");
  const [periodo, setPeriodo] = useState(ev.periodo || "1");
  const [columnas, setColumnas] = useState([]);
  const [destino, setDestino] = useState("nueva");
  const [nombre, setNombre] = useState(ev.titulo);
  const [fuente, setFuente] = useState(ev.tipo === "auto" ? "auto" : ev.tipo === "co" ? "co" : "mixta");
  const [pesoAuto, setPesoAuto] = useState(30);
  const [rellenar, setRellenar] = useState(false);
  const [config, setConfig] = useState(null);
  const [msg, setMsg] = useState(""); const [trabajando, setTrabajando] = useState(false);
  useEffect(() => { if (abierto && !materias.length) api.fetchMisMaterias().then((m) => { setMaterias(m); if (m[0]) setMateriaId(m[0].id); }).catch((e) => setMsg(e.message)); }, [abierto]);
  useEffect(() => {
    if (!materiaId) return;
    Promise.all([api.fetchCategorias(materiaId), api.fetchNotasConfig(materiaId)]).then(([c, cfg]) => { setCats(c); setCategoriaId(c[0]?.id || ""); setConfig(cfg); if (!ev.periodo && cfg?.periodo_actual) setPeriodo(String(cfg.periodo_actual)); }).catch((e) => setMsg(e.message));
  }, [materiaId]);
  useEffect(() => { if (materiaId) api.fetchActividades(materiaId, ev.grado_id, periodo).then(setColumnas).catch(() => setColumnas([])); }, [materiaId, periodo]);

  const escalaMin = Number(config?.escala_min ?? ev.escala_min ?? 1), escalaMax = Number(config?.nota_maxima ?? ev.escala_max ?? 5);
  // Las notas de la evaluación están en su propia escala; se llevan a la escala de la materia
  const aEscala = (n) => (n === null || n === undefined ? null : Math.round((escalaMin + ((Number(n) - Number(ev.escala_min)) / ((Number(ev.escala_max) - Number(ev.escala_min)) || 1)) * (escalaMax - escalaMin)) * 10) / 10);
  const notaDe = (f) => {
    let v = null;
    if (fuente === "auto") v = f.auto;
    else if (fuente === "co") v = f.prom;
    else if (f.auto !== null && f.prom !== null) v = (f.auto * pesoAuto + f.prom * (100 - pesoAuto)) / 100;
    else v = f.prom ?? f.auto;
    const e = aEscala(v);
    return e === null ? (rellenar ? escalaMin : null) : e;
  };
  const vista = filas.map((f) => ({ f, nota: notaDe(f) }));
  const conNota = vista.filter((x) => x.nota !== null).length;

  const aplicar = async () => {
    if (!materiaId || (destino === "nueva" && (!categoriaId || !nombre.trim())) || (destino !== "nueva" && !destino)) return setMsg("Completa materia, categoría y columna.");
    if (!confirm(`Se escribirán ${conNota} notas en la Planilla${destino !== "nueva" ? " (reemplazan las de esa columna)" : ""}. ¿Continuar?`)) return;
    setTrabajando(true); setMsg("");
    try {
      let actId = destino;
      if (destino === "nueva") {
        const act = await api.crearActividad({ nombre: nombre.trim(), categoria_id: categoriaId, materia_id: materiaId, grado_id: ev.grado_id, periodo, es_automatica: false });
        actId = act.id;
      }
      for (const x of vista) { if (x.nota !== null) await api.setValor(actId, x.f.e.id, x.nota); }
      setMsg(`✔ ${conNota} notas pasadas a la Planilla (periodo ${periodo}). Ya puedes verlas y ajustarlas allí.`);
      api.fetchActividades(materiaId, ev.grado_id, periodo).then(setColumnas).catch(() => {});
    } catch (er) { setMsg(er.message || String(er)); }
    setTrabajando(false);
  };
  const sel = "text-sm rounded-lg px-2 py-1.5 border border-slate-200 bg-white";
  if (!abierto) return <button onClick={() => setAbierto(true)} className="text-sm px-3 py-2 rounded-lg border border-violet-300 text-violet-700 bg-white">📖 Pasar a la planilla de calificaciones</button>;
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 space-y-2">
      <div className="flex items-center"><div className="font-semibold text-sm text-violet-800">📖 Pasar a la Planilla</div><button onClick={() => setAbierto(false)} className="ml-auto text-slate-400">✕</button></div>
      <div className="flex flex-wrap gap-2 items-center">
        <select className={sel} value={materiaId} onChange={(e) => setMateriaId(e.target.value)}>{materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
        <label className="text-xs text-slate-600">Periodo <input value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="w-12 rounded px-1 py-1 border border-slate-200" /></label>
        <select className={sel} value={destino} onChange={(e) => setDestino(e.target.value)}><option value="nueva">➕ Crear columna nueva</option>{columnas.map((c) => <option key={c.id} value={c.id}>Usar «{c.nombre}»</option>)}</select>
      </div>
      {destino === "nueva" && (
        <div className="flex flex-wrap gap-2 items-center">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la columna" className={sel + " flex-1 min-w-[10rem]"} />
          <select className={sel} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>{cats.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({c.porcentaje}%)</option>)}</select>
        </div>
      )}
      <div className="flex flex-wrap gap-3 text-xs text-slate-600 items-center">
        {ev.tipo !== "co" && <label><input type="radio" checked={fuente === "auto"} onChange={() => setFuente("auto")} /> Solo autoevaluación</label>}
        {ev.tipo !== "auto" && <label><input type="radio" checked={fuente === "co"} onChange={() => setFuente("co")} /> Solo promedio de coevaluación</label>}
        {ev.tipo === "ambas" && <label><input type="radio" checked={fuente === "mixta"} onChange={() => setFuente("mixta")} /> Combinar</label>}
        {fuente === "mixta" && <span>Auto <input type="number" min="0" max="100" value={pesoAuto} onChange={(e) => setPesoAuto(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className="w-14 rounded px-1 border border-slate-200" />% · Co {100 - pesoAuto}%</span>}
        <label><input type="checkbox" checked={rellenar} onChange={(e) => setRellenar(e.target.checked)} /> Poner la nota mínima ({escalaMin}) a quien no participó</label>
      </div>
      <div className="max-h-48 overflow-y-auto rounded-lg bg-white border border-slate-200">
        <table className="w-full text-xs"><thead><tr className="text-left text-slate-500"><th className="p-1">Estudiante</th><th className="p-1">Auto</th><th className="p-1">Co</th><th className="p-1">Nota a la planilla</th></tr></thead>
          <tbody>{vista.map(({ f, nota }) => <tr key={f.e.id} className="border-t border-slate-100"><td className="p-1">{f.e.nombre}</td><td className="p-1">{f.auto ?? "—"}</td><td className="p-1">{f.prom ?? "—"}</td><td className="p-1 font-semibold">{nota ?? "—"}</td></tr>)}</tbody></table>
      </div>
      {msg && <div className={`text-xs ${msg.startsWith("✔") ? "text-emerald-700" : "text-rose-600"}`}>{msg}</div>}
      <button disabled={trabajando || conNota === 0} onClick={aplicar} className="text-sm px-3 py-2 rounded-lg bg-violet-600 text-white disabled:opacity-50">{trabajando ? "Pasando…" : `Pasar ${conNota} notas a la Planilla`}</button>
      <p className="text-[11px] text-slate-500">Tú decides qué parte cuenta. La nota se escribe en una columna de la Planilla, donde puedes corregirla estudiante por estudiante.</p>
    </div>
  );
}

function Resultados({ ev, onCambio }) {
  const [est, setEst] = useState([]);
  const [datos, setDatos] = useState(null);
  useEffect(() => {
    api.fetchEstudiantesPorGrado(ev.grado_id).then(setEst).catch(() => {});
    co.fetchRespuestasCoev(ev.id).then(setDatos).catch(() => setDatos({ respuestas: [], asignaciones: [] }));
  }, [ev.id]);
  const filas = useMemo(() => {
    if (!datos) return [];
    return est.map((e) => {
      const auto = datos.respuestas.find((r) => String(r.evaluador_id) === String(e.id) && String(r.evaluado_id) === String(e.id));
      const recib = datos.respuestas.filter((r) => String(r.evaluado_id) === String(e.id) && String(r.evaluador_id) !== String(e.id));
      const asig = datos.asignaciones.filter((a) => String(a.evaluador_id) === String(e.id)).length;
      const hechas = datos.respuestas.filter((r) => String(r.evaluador_id) === String(e.id) && String(r.evaluado_id) !== String(e.id)).length;
      const prom = recib.length ? Math.round((recib.reduce((s, r) => s + Number(r.nota), 0) / recib.length) * 10) / 10 : null;
      return { e, auto: auto?.nota ?? null, autoCom: auto?.comentario || "", prom, n: recib.length, asig, hechas, coms: recib.map((r) => r.comentario).filter(Boolean) };
    }).sort((a, b) => (a.e.nombre || "").localeCompare(b.e.nombre || "", "es"));
  }, [est, datos]);

  const csv = () => {
    const l = [["Estudiante", "Autoevaluación", "Promedio coevaluación", "Evaluaciones recibidas", "Debía evaluar", "Evaluó", "Comentarios"]];
    filas.forEach((f) => l.push([f.e.nombre, f.auto ?? "", f.prom ?? "", f.n, f.asig, f.hechas, f.coms.join(" | ")]));
    const txt = l.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + txt], { type: "text/csv" })); a.download = `coevaluacion_${ev.titulo}.csv`; a.click();
  };
  if (!datos) return <p className="text-xs text-slate-400 mt-2">Cargando…</p>;
  const completos = filas.filter((f) => (ev.tipo === "co" || f.auto !== null) && (ev.tipo === "auto" || f.hechas >= f.asig) && (ev.tipo !== "auto" ? f.asig > 0 : true)).length;
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-slate-500">Completaron todo: <b>{completos}/{filas.length}</b></span>
        {ev.visibilidad === "promedio" && ev.tipo !== "auto" && (
          <label className="flex items-center gap-1"><input type="checkbox" checked={ev.resultados_visibles} onChange={async (e) => { await co.actualizarCoevaluacion(ev.id, { resultados_visibles: e.target.checked }); onCambio(); }} /> Publicar a estudiantes (promedio y comentarios sin nombres)</label>
        )}
        {ev.tipo !== "auto" && <button onClick={async () => { const borrar = confirm("¿Reasignar compañeros?\n\nAceptar = conserva las coevaluaciones ya enviadas y reasigna lo pendiente.\nSi quieres empezar de cero y borrar todas las coevaluaciones, cancela y usa «Reasignar y borrar»."); if (!borrar) return; try { await co.reasignarCoevaluacion(ev.id, false); const d = await co.fetchRespuestasCoev(ev.id); setDatos(d); } catch (e) { alert(co.mensajeCoev(e)); } }} className="ml-auto px-2 py-1 rounded border border-slate-200">🔀 Reasignar compañeros</button>}
        {ev.tipo !== "auto" && <button onClick={async () => { if (!confirm("Esto BORRA todas las coevaluaciones enviadas (las autoevaluaciones se conservan) y vuelve a asignar compañeros desde cero. ¿Continuar?")) return; try { await co.reasignarCoevaluacion(ev.id, true); const d = await co.fetchRespuestasCoev(ev.id); setDatos(d); } catch (e) { alert(co.mensajeCoev(e)); } }} className="px-2 py-1 rounded border border-rose-200 text-rose-600">Reasignar y borrar</button>}
        <button onClick={csv} className="px-2 py-1 rounded border border-slate-200">⬇ CSV</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-left text-slate-500"><th className="p-1">Estudiante</th>{ev.tipo !== "co" && <th className="p-1">Auto</th>}{ev.tipo !== "auto" && <><th className="p-1">Prom. co</th><th className="p-1">Recibidas</th><th className="p-1">Evaluó</th></>}</tr></thead>
          <tbody>{filas.map((f) => (
            <tr key={f.e.id} className="border-t border-slate-100" title={f.coms.join(" • ")}>
              <td className="p-1">{f.e.nombre}</td>
              {ev.tipo !== "co" && <td className="p-1">{f.auto ?? "—"}</td>}
              {ev.tipo !== "auto" && <><td className="p-1 font-semibold">{f.prom ?? "—"}</td><td className="p-1">{f.n}</td><td className={`p-1 ${f.hechas < f.asig ? "text-amber-600" : ""}`}>{f.hechas}/{f.asig}</td></>}
            </tr>))}</tbody>
        </table>
      </div>
      <PasarAPlanilla ev={ev} filas={filas} />
      <p className="text-[11px] text-slate-400">Los datos son para tu criterio: tú decides la nota. Pasa el cursor sobre una fila para ver los comentarios recibidos (sin autor).</p>
    </div>
  );
}

// =============================== ESTUDIANTE ===============================
export function CoevaluacionEstudiante() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const cargar = () => co.fetchMisCoevaluaciones().then((d) => { setLista(d); setError(""); }).catch((e) => { setLista([]); setError(co.mensajeCoev(e)); });
  useEffect(() => { cargar(); }, []);
  if (lista === null) return <div className="text-sm text-slate-400 text-center py-8">Cargando…</div>;
  return (
    <div className="w-full max-w-6xl mx-auto space-y-3">
      {error && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2">{error}</div>}
      {lista.length === 0 && <div className="text-center py-10"><div className="text-4xl mb-2">🪞</div><p className="text-sm text-slate-500">No tienes evaluaciones pendientes.</p></div>}
      {lista.map((ev) => <TarjetaEval key={ev.id} ev={ev} onCambio={cargar} />)}
    </div>
  );
}

function TarjetaEval({ ev, onCambio }) {
  const [activo, setActivo] = useState(null); // id del evaluado en edición
  const [res, setRes] = useState(null);
  useEffect(() => { if (ev.resultados_visibles || !ev.abierta) co.fetchMiResultadoCoev(ev.id).then(setRes).catch(() => {}); }, [ev.id, ev.resultados_visibles, ev.abierta]);
  const objetivos = [
    ...(ev.tipo !== "co" ? [{ id: ev.mi_id, nombre: "Mi autoevaluación", hecha: !!ev.auto, esYo: true }] : []),
    ...(ev.tipo !== "auto" ? ev.pendientes.map((p) => ({ ...p, esYo: false })) : []),
  ];
  const hechas = objetivos.filter((o) => o.hecha).length;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3">
      <div className="flex items-center justify-between"><div className="font-semibold text-sm">{ev.titulo}</div><div className="text-[11px] text-slate-500">{hechas}/{objetivos.length}</div></div>
      {ev.cierra && <div className="text-[11px] text-slate-400">{ev.abierta ? "Cierra" : "Cerró"}: {new Date(ev.cierra).toLocaleString("es-CO")}</div>}
      {ev.abierta && (
        <div className="mt-2 space-y-1">
          {objetivos.map((o) => (
            <div key={String(o.id) + o.esYo}>
              <button onClick={() => setActivo(activo === o.id ? null : o.id)} className={`w-full text-left text-sm px-3 py-2 rounded-lg border ${o.hecha ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                {o.hecha ? "✅" : "⬜"} {o.nombre}
              </button>
              {activo === o.id && <Formulario ev={ev} objetivo={o} onListo={() => { setActivo(null); onCambio(); }} />}
            </div>
          ))}
        </div>
      )}
      {res?.auto && <div className="text-xs text-slate-600 mt-2">Tu autoevaluación: <b>{res.auto.nota}</b></div>}
      {res?.publicado && (
        <div className="mt-2 bg-violet-50 rounded-xl p-2 text-xs">
          {res.cantidad_co > 0
            ? <>Lo que tus compañeros opinan de ti (anónimo): promedio <b>{res.promedio_co}</b> de {res.cantidad_co} evaluaciones.
                {res.comentarios?.length > 0 && <ul className="list-disc pl-4 mt-1 space-y-0.5">{res.comentarios.map((c, i) => <li key={i}>{c}</li>)}</ul>}</>
            : "Aún nadie te ha evaluado."}
        </div>
      )}
    </div>
  );
}

function Formulario({ ev, objetivo, onListo }) {
  const previo = objetivo.esYo ? ev.auto : objetivo;
  const [niveles, setNiveles] = useState(() => { const o = {}; (Array.isArray(previo?.niveles) ? previo.niveles : []).forEach((v, i) => { o[i] = v; }); return o; });
  // El comentario se guarda como líneas "Criterio: observación"
  const [obs, setObs] = useState(() => {
    const o = {}; const lineas = String(previo?.comentario || "").split("\n");
    ev.criterios.forEach((c, i) => { const l = lineas.find((x) => x.startsWith(c.criterio + ": ")); if (l) o[i] = l.slice(c.criterio.length + 2); });
    return o;
  });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const config = { escala_min: Number(ev.escala_min), nota_maxima: Number(ev.escala_max) };
  const completo = ev.criterios.every((_, i) => niveles[i] !== undefined);
  const enviar = async () => {
    setEnviando(true); setError("");
    const coment = ev.criterios.map((c, i) => (obs[i] || "").trim() ? `${c.criterio}: ${obs[i].trim()}` : null).filter(Boolean).join("\n");
    try { await co.enviarCoev(ev.id, objetivo.id, ev.criterios.map((_, i) => niveles[i]), coment); onListo(); }
    catch (e) { setError(co.mensajeCoev(e)); } finally { setEnviando(false); }
  };
  return (
    <div className="mt-1 space-y-2">
      <RubricaGrid rubrica={ev.criterios} niveles={niveles} observaciones={obs} config={config}
        onElegir={(i, k) => setNiveles((p) => ({ ...p, [i]: k }))} onObservacion={(i, t) => setObs((p) => ({ ...p, [i]: t.slice(0, 160) }))} />
      {error && <div className="text-xs text-rose-600">{error}</div>}
      <button disabled={!completo || enviando} onClick={enviar} className="text-sm px-3 py-2 rounded-lg bg-violet-600 text-white disabled:opacity-40">{enviando ? "Enviando…" : (previo?.niveles ? "Guardar cambios" : "Enviar")}</button>
      {!completo && <p className="text-[11px] text-slate-400">Elige un nivel en cada criterio para poder enviar.</p>}
    </div>
  );
}
