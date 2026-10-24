import React, { useEffect, useMemo, useState } from "react";
import * as api from "../lib/api";
import * as mn from "../lib/mundoNotaApi";
import { CONFIG_DEFAULT, periodosDe } from "../lib/calificaciones";

const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
const haceDias = (n) => new Date(Date.now() - n * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
const IND = { dias: "Días que entró al Mundo", actividades: "Actividades hechas en el Mundo", xp: "XP ganado en el Mundo" };

export function VistaMundoNota({ grados = [], gradoActivo, materiaActiva }) {
  const [tab, setTab] = useState("calcular");
  return (
    <div className="w-full max-w-5xl mx-auto space-y-3">
      <div className="flex gap-1">
        {[["calcular", "🌍 Calcular y pasar a la Planilla"], ["auto", "🔄 Columnas automáticas"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`text-sm px-3 py-1.5 rounded-full border ${tab === k ? "bg-violet-600 text-white border-violet-600" : "bg-white text-slate-600 border-slate-200"}`}>{l}</button>
        ))}
      </div>
      {tab === "calcular" ? <Calcular grados={grados} gradoActivo={gradoActivo} materiaActiva={materiaActiva} onCreadaAuto={() => setTab("auto")} /> : <Automaticas grados={grados} />}
    </div>
  );
}

function Calcular({ grados, gradoActivo, materiaActiva, onCreadaAuto }) {
  const [gradoId, setGradoId] = useState(gradoActivo || grados[0]?.id || "");
  const [desde, setDesde] = useState(haceDias(60));
  const [hasta, setHasta] = useState(hoy());
  const [modo, setModo] = useState("meta");
  const [ind, setInd] = useState({ dias: { on: true, peso: 30, meta: 10 }, actividades: { on: true, peso: 50, meta: 8 }, xp: { on: true, peso: 20, meta: 100 } });
  const [rIndicador, setRIndicador] = useState("actividades");
  const [tramos, setTramos] = useState([{ desde: 0, nota: 2 }, { desde: 4, nota: 3.5 }, { desde: 8, nota: 5 }]);
  const [bonoMax, setBonoMax] = useState(0.5);
  const [sinPart, setSinPart] = useState("omitir");
  const [materias, setMaterias] = useState([]);
  const [materiaId, setMateriaId] = useState(materiaActiva || "");
  const [config, setConfig] = useState(CONFIG_DEFAULT);
  const [cats, setCats] = useState([]);
  const [categoriaId, setCategoriaId] = useState("");
  const [periodo, setPeriodo] = useState("1");
  const [columnas, setColumnas] = useState([]);
  const [destino, setDestino] = useState("nueva");
  const [nombre, setNombre] = useState("Participación en el Mundo");
  const [estudiantes, setEstudiantes] = useState([]);
  const [filas, setFilas] = useState(null);
  const [msg, setMsg] = useState(""); const [trabajando, setTrabajando] = useState(false);

  useEffect(() => { api.fetchMisMaterias().then((m) => { setMaterias(m); if (!materiaId && m[0]) setMateriaId(m.find((x) => String(x.id) === String(materiaActiva))?.id ?? m[0].id); }).catch((e) => setMsg(e.message)); }, []);
  useEffect(() => {
    if (!materiaId) return;
    Promise.all([api.fetchNotasConfig(materiaId), api.fetchCategorias(materiaId)]).then(([c, cs]) => { setConfig(c); setPeriodo(String(c.periodo_actual || "1")); setCats(cs); setCategoriaId(cs[0]?.id || ""); }).catch((e) => setMsg(e.message));
  }, [materiaId]);
  useEffect(() => { if (materiaId && gradoId) api.fetchActividades(materiaId, gradoId, periodo).then(setColumnas).catch(() => setColumnas([])); }, [materiaId, gradoId, periodo]);
  useEffect(() => { if (gradoId) api.fetchEstudiantesPorGrado(gradoId).then(setEstudiantes).catch(() => {}); setFilas(null); }, [gradoId]);

  const emin = Number(config.escala_min ?? 1), emax = Number(config.nota_maxima ?? 5);
  const params = useMemo(() => {
    const pesos = {}, metas = {};
    Object.entries(ind).forEach(([k, v]) => { if (v.on) { pesos[k] = Number(v.peso) || 0; metas[k] = Number(v.meta) || 0; } });
    return { modo, escala_min: emin, escala_max: emax, sin_participacion: sinPart, pesos, metas, rangos: { indicador: rIndicador, tramos: tramos.map((t) => ({ desde: Number(t.desde) || 0, nota: Number(t.nota) || 0 })) }, bono_max: Number(bonoMax) || 0 };
  }, [modo, ind, rIndicador, tramos, bonoMax, sinPart, emin, emax]);
  const nom = (id) => estudiantes.find((e) => String(e.id) === String(id))?.nombre || id;

  const calcular = async () => {
    setMsg(""); setTrabajando(true);
    try { const d = await mn.calcularMundoNota(gradoId, desde, hasta, params); setFilas(d.map((f) => ({ ...f, nombre: nom(f.estudiante_id) })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))); }
    catch (e) { setMsg(mn.mensajeMundoNota(e)); }
    setTrabajando(false);
  };
  const conValor = (filas || []).filter((f) => f.valor !== null && f.valor !== undefined);

  const asegurarColumna = async () => {
    if (destino !== "nueva") return destino;
    if (!categoriaId || !nombre.trim()) throw new Error("Pon nombre y categoría a la columna nueva.");
    const act = await api.crearActividad({ nombre: nombre.trim(), categoria_id: categoriaId, materia_id: materiaId, grado_id: gradoId, periodo, es_automatica: false });
    return act.id;
  };
  const pasarAhora = async () => {
    if (!filas) return setMsg("Primero calcula la vista previa.");
    if (modo === "bono") {
      if (destino === "nueva") return setMsg("El bono se suma a una columna que ya tenga notas: elige una columna existente.");
      if (!confirm(`Se sumará el bono (hasta ${bonoMax}) a las notas ya puestas en esa columna, sin pasar de ${emax}. Quien ya recibió un bono de Mundo no se vuelve a bonificar. ¿Continuar?`)) return;
      setTrabajando(true); setMsg("");
      try {
        const vals = await api.fetchValores([destino]); let n = 0;
        for (const f of conValor) {
          const v = vals.find((x) => String(x.estudiante_id) === String(f.estudiante_id));
          if (!v || v.valor === null || v.valor === undefined || Number(f.valor) <= 0) continue;
          if (String(v.observacion || "").startsWith("Bono Mundo")) continue;
          await api.setValor(destino, v.estudiante_id, Math.min(emax, Math.round((Number(v.valor) + Number(f.valor)) * 10) / 10));
          await api.setObservacionValor(destino, v.estudiante_id, `Bono Mundo +${f.valor}`); n++;
        }
        setMsg(`✔ Bono sumado a ${n} estudiante(s).`);
      } catch (e) { setMsg(e.message || String(e)); }
      setTrabajando(false); return;
    }
    if (!confirm(`Se escribirán ${conValor.length} notas en la Planilla${destino !== "nueva" ? " (reemplazan las de esa columna)" : ""}. ¿Continuar?`)) return;
    setTrabajando(true); setMsg("");
    try {
      const actId = await asegurarColumna();
      for (const f of conValor) await api.setValor(actId, f.estudiante_id, Number(f.valor));
      setMsg(`✔ ${conValor.length} notas pasadas a la Planilla (periodo ${periodo}).`);
      api.fetchActividades(materiaId, gradoId, periodo).then(setColumnas).catch(() => {});
    } catch (e) { setMsg(e.message || String(e)); }
    setTrabajando(false);
  };
  const dejarAutomatica = async () => {
    if (modo === "bono") return;
    if (!confirm("La columna se mantendrá al día sola (cada hora, si activaste el programador) y sobrescribirá lo que edites a mano en ella. ¿Continuar?")) return;
    setTrabajando(true); setMsg("");
    try {
      const actId = await asegurarColumna();
      const nombreCol = destino === "nueva" ? nombre.trim() : (columnas.find((c) => String(c.id) === String(destino))?.nombre || "");
      const cfg = await mn.crearSyncMundo({ grado_id: gradoId, materia_id: materiaId, periodo, actividad_id: actId, nombre: nombreCol, desde, hasta: hasta === hoy() ? null : hasta, params });
      await mn.syncAhoraMundo(cfg.id);
      onCreadaAuto();
    } catch (e) { setMsg(mn.mensajeMundoNota(e)); }
    setTrabajando(false);
  };

  const sel = "text-sm rounded-lg px-2 py-1.5 border border-slate-200 bg-white";
  const num = "w-16 rounded px-1 py-1 border border-slate-200 text-sm";
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
        <div className="text-sm font-semibold text-slate-700">1. ¿De quién y de cuándo?</div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select className={sel} value={gradoId} onChange={(e) => setGradoId(e.target.value)}>{grados.map((g) => <option key={g.id} value={g.id}>{g.nombre || g.id}</option>)}</select>
          <label className="text-xs text-slate-600">Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={sel} /></label>
          <label className="text-xs text-slate-600">Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={sel} /></label>
        </div>
        <p className="text-[11px] text-slate-400">Los días cuentan los ingresos registrados desde ahora y también los días en que hubo alguna actividad en el Mundo, así que el pasado también suma.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
        <div className="text-sm font-semibold text-slate-700">2. ¿Cómo se convierte en nota?</div>
        <div className="flex flex-wrap gap-3 text-sm">
          {[["meta", "Meta → nota proporcional"], ["rangos", "Por rangos"], ["bono", "Bono que suma"]].map(([k, l]) => <label key={k}><input type="radio" checked={modo === k} onChange={() => setModo(k)} /> {l}</label>)}
        </div>
        {modo !== "rangos" && (
          <div className="space-y-1">
            <p className="text-[11px] text-slate-500">{modo === "meta" ? `Cada indicador llega a su meta = 100 %. La nota va de ${emin} a ${emax} según el avance combinado (los pesos son la importancia de cada uno).` : `El bono va de 0 hasta el máximo según el avance combinado. Se suma a una columna que ya tenga notas.`}</p>
            {Object.entries(IND).map(([k, l]) => (
              <div key={k} className="flex flex-wrap items-center gap-2 text-sm">
                <label className="w-64"><input type="checkbox" checked={ind[k].on} onChange={(e) => setInd({ ...ind, [k]: { ...ind[k], on: e.target.checked } })} /> {l}</label>
                <label className="text-xs text-slate-500">Meta <input type="number" min="1" value={ind[k].meta} onChange={(e) => setInd({ ...ind, [k]: { ...ind[k], meta: e.target.value } })} className={num} disabled={!ind[k].on} /></label>
                <label className="text-xs text-slate-500">Peso <input type="number" min="0" value={ind[k].peso} onChange={(e) => setInd({ ...ind, [k]: { ...ind[k], peso: e.target.value } })} className={num} disabled={!ind[k].on} /></label>
              </div>
            ))}
            {modo === "bono" && <label className="text-sm">Bono máximo <input type="number" step="0.1" min="0" value={bonoMax} onChange={(e) => setBonoMax(e.target.value)} className={num} /> puntos</label>}
          </div>
        )}
        {modo === "rangos" && (
          <div className="space-y-1 text-sm">
            <label className="text-xs text-slate-600">Según <select className={sel} value={rIndicador} onChange={(e) => setRIndicador(e.target.value)}>{Object.entries(IND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            {tramos.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                Desde <input type="number" value={t.desde} onChange={(e) => setTramos(tramos.map((x, q) => q === i ? { ...x, desde: e.target.value } : x))} className={num} /> → nota <input type="number" step="0.1" value={t.nota} onChange={(e) => setTramos(tramos.map((x, q) => q === i ? { ...x, nota: e.target.value } : x))} className={num} />
                <button onClick={() => setTramos(tramos.filter((_, q) => q !== i))} className="text-slate-400 hover:text-rose-500">🗑</button>
              </div>
            ))}
            <button onClick={() => setTramos([...tramos, { desde: (Number(tramos[tramos.length - 1]?.desde) || 0) + 2, nota: emax }])} className="text-xs text-violet-600">+ Agregar tramo</button>
          </div>
        )}
        <label className="text-xs text-slate-600 flex items-center gap-2">Quien no hizo nada en el Mundo:
          <select className={sel} value={sinPart} onChange={(e) => setSinPart(e.target.value)}><option value="omitir">No se le pone nota (queda vacío)</option><option value="minima">Nota mínima ({emin})</option></select></label>
        <p className="text-[11px] text-slate-400">Sugerencia: deja «No se le pone nota» o úsalo como bono, para no castigar a quien no tiene acceso a internet o dispositivo en casa.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
        <div className="text-sm font-semibold text-slate-700">3. ¿Dónde queda en la Planilla?</div>
        <div className="flex flex-wrap gap-2 items-center">
          <select className={sel} value={materiaId} onChange={(e) => setMateriaId(e.target.value)}>{materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
          <select className={sel} value={periodo} onChange={(e) => setPeriodo(e.target.value)}>{periodosDe(config).map((p) => <option key={p} value={p}>Periodo {p}</option>)}</select>
          <select className={sel} value={destino} onChange={(e) => setDestino(e.target.value)}>{modo !== "bono" && <option value="nueva">➕ Crear columna nueva</option>}{modo === "bono" && <option value="nueva">— elige una columna —</option>}{columnas.map((c) => <option key={c.id} value={c.id}>Usar «{c.nombre}»</option>)}</select>
        </div>
        {destino === "nueva" && modo !== "bono" && (
          <div className="flex flex-wrap gap-2"><input value={nombre} onChange={(e) => setNombre(e.target.value)} className={sel + " flex-1 min-w-[10rem]"} /><select className={sel} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>{cats.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({c.porcentaje}%)</option>)}</select></div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button disabled={trabajando || !gradoId} onClick={calcular} className="text-sm px-4 py-2 rounded-lg bg-violet-600 text-white disabled:opacity-50">{trabajando ? "Calculando…" : "Ver vista previa"}</button>
        {filas && <button disabled={trabajando || conValor.length === 0} onClick={pasarAhora} className="text-sm px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50">{modo === "bono" ? "Sumar bono ahora" : `Pasar ${conValor.length} notas ahora`}</button>}
        {filas && modo !== "bono" && <button disabled={trabajando} onClick={dejarAutomatica} className="text-sm px-4 py-2 rounded-lg border border-violet-300 text-violet-700 bg-white">🔄 Mantener al día automáticamente</button>}
      </div>
      {msg && <div className={`text-xs ${msg.startsWith("✔") ? "text-emerald-700" : "text-rose-600"}`}>{msg}</div>}

      {filas && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-xs"><thead><tr className="text-left text-slate-500 bg-slate-50"><th className="p-2">Estudiante</th><th className="p-2">Días</th><th className="p-2">Actividades</th><th className="p-2">XP</th><th className="p-2">Avance</th><th className="p-2">{modo === "bono" ? "Bono" : "Nota"}</th></tr></thead>
            <tbody>{filas.map((f) => <tr key={f.estudiante_id} className="border-t border-slate-100"><td className="p-2">{f.nombre}</td><td className="p-2">{f.dias}</td><td className="p-2">{f.actividades}</td><td className="p-2">{Math.round(f.xp)}</td><td className="p-2">{Math.round(f.progreso * 100)}%</td><td className="p-2 font-semibold">{f.valor ?? "—"}</td></tr>)}</tbody></table>
        </div>
      )}
    </div>
  );
}

function Automaticas({ grados }) {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(""); const [trabajando, setTrabajando] = useState(null);
  const cargar = () => mn.fetchSyncsMundo().then(setLista).catch((e) => { setLista([]); setError(mn.mensajeMundoNota(e)); });
  useEffect(() => { cargar(); }, []);
  if (lista === null) return <div className="text-sm text-slate-400 py-6 text-center">Cargando…</div>;
  return (
    <div className="space-y-2">
      <div className="text-xs bg-amber-50 text-amber-800 rounded-lg p-2">Para que se actualicen solas cada hora, activa la extensión <b>pg_cron</b> en Supabase (Database → Extensions) y corre una sola vez el comando que aparece al final del script 112. Mientras tanto, puedes pulsar «Sincronizar ahora».</div>
      {error && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2">{error}</div>}
      {lista.length === 0 && <p className="text-xs text-slate-400">Aún no hay columnas automáticas. Crea una desde «Calcular y pasar a la Planilla».</p>}
      {lista.map((c) => (
        <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <b className="flex-1">{c.nombre || "Columna"}</b>
            <span className="text-[11px] text-slate-500">Curso {c.grado_id} · periodo {c.periodo} · {c.params?.modo === "rangos" ? "por rangos" : "meta"} · {c.desde} → {c.hasta || "hoy"}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{c.ultima_sync ? `Última sincronización: ${new Date(c.ultima_sync).toLocaleString("es-CO")} (${c.ultima_cantidad} notas)` : "Aún no sincronizada"}</div>
          <div className="flex flex-wrap gap-2 mt-2 text-xs">
            <button disabled={trabajando === c.id} onClick={async () => { setTrabajando(c.id); try { await mn.syncAhoraMundo(c.id); await cargar(); } catch (e) { setError(mn.mensajeMundoNota(e)); } setTrabajando(null); }} className="px-2 py-1 rounded border border-slate-200">{trabajando === c.id ? "Sincronizando…" : "🔄 Sincronizar ahora"}</button>
            <label className="flex items-center gap-1"><input type="checkbox" checked={c.activo} onChange={async (e) => { await mn.actualizarSyncMundo(c.id, { activo: e.target.checked }); cargar(); }} /> Activa</label>
            <button onClick={async () => { if (!confirm("¿Dejar de actualizar esta columna? Las notas ya escritas se conservan.")) return; await mn.eliminarSyncMundo(c.id); cargar(); }} className="px-2 py-1 rounded border border-rose-200 text-rose-600">Quitar automatización</button>
          </div>
        </div>
      ))}
    </div>
  );
}
