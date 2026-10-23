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
  const [error, setError] = useState("");
  const cargar = () => co.fetchCoevaluaciones(gradoId).then(setLista).catch((e) => setError(co.mensajeCoev(e)));
  useEffect(() => { if (gradoId) cargar(); }, [gradoId]);

  return (
    <div className="max-w-3xl mx-auto space-y-3">
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
            <button onClick={() => { setCreando(false); setEditando(ev); }} className="text-slate-400 hover:text-violet-600" title="Editar">✏️</button>
            <button onClick={async () => { if (!confirm("¿Borrar esta evaluación y sus respuestas?")) return; await co.eliminarCoevaluacion(ev.id); cargar(); }} className="text-slate-400 hover:text-rose-500">🗑</button>
          </div>
          {abierta === ev.id && <Resultados ev={ev} onCambio={cargar} />}
        </div>
      ))}
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
        await co.actualizarCoevaluacion(inicial.id, { titulo: titulo.trim(), periodo: periodo || null, criterios, escala_min: Number(escMin), escala_max: Number(escMax), visibilidad: visib, cierra: cierra ? new Date(cierra).toISOString() : null });
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
          <select value={modo} disabled={ed} onChange={(e) => setModo(e.target.value)} className={inp}>{Object.entries(MODOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          {modo === "azar" && <label className="text-xs text-slate-600 flex items-center gap-2">Cuántos evalúa cada uno <input type="number" min={1} max={40} disabled={ed} value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="w-16 rounded-lg px-2 py-1 border border-slate-200" /></label>}
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
      {ed && <p className="text-[11px] text-slate-500">Tipo, modo y cantidad no se cambian una vez creada (ya hay compañeros asignados).{conRespuestas ? " Los criterios quedan bloqueados porque ya hay respuestas; para cambiarlos crea una evaluación nueva." : ""}</p>}
      {error && <div className="text-xs text-rose-600">{error}</div>}
      <div className="flex gap-2">
        <button disabled={guardando} onClick={guardar} className="text-sm px-3 py-2 rounded-lg bg-violet-600 text-white disabled:opacity-50">{guardando ? "Guardando…" : ed ? "Guardar cambios" : "Crear y asignar"}</button>
        {ed && <button onClick={onCancelar} className="text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white">Cancelar</button>}
      </div>
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
        <button onClick={csv} className="ml-auto px-2 py-1 rounded border border-slate-200">⬇ CSV</button>
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
    <div className="max-w-md mx-auto space-y-3">
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
