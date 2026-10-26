import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import * as api from "../lib/api";
import { CONFIG_DEFAULT, periodosDe } from "../lib/calificaciones";

const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
const haceDias = (n) => new Date(Date.now() - n * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
const redondear = (x) => Math.round(x * 10) / 10;
const PAG = 1000;

async function paginar(construir) {
  const todo = [];
  for (let d = 0; ; d += PAG) {
    const { data, error } = await construir().range(d, d + PAG - 1);
    if (error) throw error;
    todo.push(...(data || []));
    if (!data || data.length < PAG) break;
  }
  return todo;
}
const finDia = (f) => new Date(`${f}T23:59:59-05:00`).toISOString();
const iniDia = (f) => new Date(`${f}T00:00:00-05:00`).toISOString();

// Suma de cambios de vida por estudiante en el rango, según las fuentes elegidas
async function cambiosDeVida(ids, desde, hasta, fuentes) {
  const por = {}; const sumar = (id, v, tipo) => { const k = String(id); por[k] = por[k] || { perdido: 0, ganado: 0 }; if (v < 0) por[k].perdido += -v; else por[k].ganado += v; };
  if (fuentes.conducta || fuentes.mundo) {
    const cats = [...(fuentes.conducta ? ["asistencia", "convivencial", "academico"] : []), ...(fuentes.mundo ? ["general", "objeto"] : [])];
    const { data: una } = await supabase.from("historial_gamificacion").select("*").limit(1);
    const col = ["ts", "created_at", "creado_en", "fecha"].find((c) => una?.[0] && c in una[0]) || "ts";
    for (let i = 0; i < ids.length; i += 150) {
      const trozo = ids.slice(i, i + 150);
      const filas = await paginar(() => supabase.from("historial_gamificacion").select("estudiante_id, vida, categoria").in("estudiante_id", trozo).in("categoria", cats).neq("vida", 0).gte(col, iniDia(desde)).lte(col, finDia(hasta)).order("id"));
      filas.forEach((f) => sumar(f.estudiante_id, Number(f.vida) || 0));
    }
  }
  if (fuentes.clase) {
    for (let i = 0; i < ids.length; i += 150) {
      const trozo = ids.slice(i, i + 150);
      const filas = await paginar(() => supabase.from("historial_puntos").select("estudiante_id, delta").in("estudiante_id", trozo).eq("tipo", "vida").neq("delta", 0).gte("creado_en", iniDia(desde)).lte("creado_en", finDia(hasta)).order("id"));
      filas.forEach((f) => sumar(f.estudiante_id, Number(f.delta) || 0));
    }
  }
  return por;
}

export function VistaVidaNota({ grados = [], gradoActivo, materiaActiva }) {
  const [gradoId, setGradoId] = useState(gradoActivo || grados[0]?.id || "");
  const [modo, setModo] = useState("balance"); // balance | actual
  const [desde, setDesde] = useState(haceDias(60)); const [hasta, setHasta] = useState(hoy());
  const [fuentes, setFuentes] = useState({ conducta: true, clase: true, mundo: false });
  const [contarGanado, setContarGanado] = useState(true);
  const [tolerancia, setTolerancia] = useState(100);
  const [piso, setPiso] = useState(0); const [techo, setTecho] = useState(100);
  const [materias, setMaterias] = useState([]); const [materiaId, setMateriaId] = useState(materiaActiva || "");
  const [config, setConfig] = useState(CONFIG_DEFAULT); const [cats, setCats] = useState([]); const [categoriaId, setCategoriaId] = useState("");
  const [periodo, setPeriodo] = useState("1"); const [columnas, setColumnas] = useState([]);
  const [destino, setDestino] = useState("nueva"); const [nombre, setNombre] = useState("Comportamiento (vida del personaje)");
  const [estudiantes, setEstudiantes] = useState([]); const [filas, setFilas] = useState(null);
  const [msg, setMsg] = useState(""); const [trabajando, setTrabajando] = useState(false);

  useEffect(() => { api.fetchMisMaterias().then((m) => { setMaterias(m); if (!materiaId && m[0]) setMateriaId(m.find((x) => String(x.id) === String(materiaActiva))?.id ?? m[0].id); }).catch((e) => setMsg(e.message)); }, []);
  useEffect(() => {
    if (!materiaId) return;
    Promise.all([api.fetchNotasConfig(materiaId), api.fetchCategorias(materiaId)]).then(([c, cs]) => { setConfig(c); setPeriodo(String(c.periodo_actual || "1")); setCats(cs); setCategoriaId(cs[0]?.id || ""); }).catch((e) => setMsg(e.message));
  }, [materiaId]);
  useEffect(() => { if (materiaId && gradoId) api.fetchActividades(materiaId, gradoId, periodo).then(setColumnas).catch(() => setColumnas([])); }, [materiaId, gradoId, periodo]);
  useEffect(() => { if (gradoId) api.fetchEstudiantesPorGrado(gradoId).then(setEstudiantes).catch(() => {}); setFilas(null); }, [gradoId]);

  const emin = Number(config.escala_min ?? 1), emax = Number(config.nota_maxima ?? 5);
  const alt = (k) => setFuentes((f) => ({ ...f, [k]: !f[k] }));

  const calcular = async () => {
    setMsg(""); setTrabajando(true);
    try {
      const ids = estudiantes.map((e) => e.id);
      let res;
      if (modo === "actual") {
        const { data, error } = await supabase.from("progreso").select("estudiante_id, vida").in("estudiante_id", ids);
        if (error) throw error;
        const v = Object.fromEntries((data || []).map((p) => [String(p.estudiante_id), p.vida]));
        res = estudiantes.map((e) => {
          const vida = v[String(e.id)] ?? 100; const t = Math.max(0, Math.min(1, (vida - piso) / Math.max(1, techo - piso)));
          return { id: e.id, nombre: e.nombre, detalle: `${vida} ❤️`, nota: redondear(emin + t * (emax - emin)) };
        });
      } else {
        const por = await cambiosDeVida(ids, desde, hasta, fuentes);
        res = estudiantes.map((e) => {
          const c = por[String(e.id)] || { perdido: 0, ganado: 0 };
          const neto = contarGanado ? Math.max(0, c.perdido - c.ganado) : c.perdido;
          const t = Math.max(0, Math.min(1, neto / Math.max(1, Number(tolerancia) || 1)));
          return { id: e.id, nombre: e.nombre, detalle: `−${c.perdido} / +${c.ganado}`, neto, nota: redondear(emax - t * (emax - emin)) };
        });
      }
      setFilas(res.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
    } catch (e) { setMsg(e.message || String(e)); }
    setTrabajando(false);
  };

  const pasar = async () => {
    if (!filas) return;
    if (destino === "nueva" && (!categoriaId || !nombre.trim())) return setMsg("Pon nombre y categoría a la columna nueva.");
    if (!confirm(`Se escribirán ${filas.length} notas en la Planilla${destino !== "nueva" ? " (reemplazan las de esa columna)" : ""}. ¿Continuar?`)) return;
    setTrabajando(true); setMsg("");
    try {
      let actId = destino;
      if (destino === "nueva") actId = (await api.crearActividad({ nombre: nombre.trim(), categoria_id: categoriaId, materia_id: materiaId, grado_id: gradoId, periodo, es_automatica: false })).id;
      for (const f of filas) await api.setValor(actId, f.id, f.nota);
      setMsg(`✔ ${filas.length} notas pasadas a la Planilla (periodo ${periodo}).`);
      api.fetchActividades(materiaId, gradoId, periodo).then(setColumnas).catch(() => {});
    } catch (e) { setMsg(e.message || String(e)); }
    setTrabajando(false);
  };

  const sel = "text-sm rounded-lg px-2 py-1.5 border border-slate-200 bg-white"; const num = "w-20 rounded px-1 py-1 border border-slate-200 text-sm";
  return (
    <div className="w-full max-w-5xl mx-auto space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
        <div className="text-sm font-semibold text-slate-700">1. ¿Qué vida se mira?</div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label><input type="radio" checked={modo === "balance"} onChange={() => setModo("balance")} /> 🩸 Vida perdida en el periodo (recomendado)</label>
          <label><input type="radio" checked={modo === "actual"} onChange={() => setModo("actual")} /> ❤️ Vida que tiene hoy</label>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select className={sel} value={gradoId} onChange={(e) => setGradoId(e.target.value)}>{grados.map((g) => <option key={g.id} value={g.id}>{g.nombre || g.id}</option>)}</select>
          {modo === "balance" && <>
            <label className="text-xs text-slate-600">Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={sel} /></label>
            <label className="text-xs text-slate-600">Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={sel} /></label>
          </>}
        </div>
        {modo === "balance" ? (
          <div className="space-y-1 text-xs text-slate-600">
            <div className="font-semibold">Qué cambios de vida cuentan:</div>
            <label className="block"><input type="checkbox" checked={fuentes.conducta} onChange={() => alt("conducta")} /> Descuentos automáticos por conducta (retardos, faltas, anotaciones, actas)</label>
            <label className="block"><input type="checkbox" checked={fuentes.clase} onChange={() => alt("clase")} /> Puntos de vida que das o quitas en clase</label>
            <label className="block"><input type="checkbox" checked={fuentes.mundo} onChange={() => alt("mundo")} /> Vida del Mundo (duelos, posada, pociones) — normalmente NO es comportamiento</label>
            <label className="block"><input type="checkbox" checked={contarGanado} onChange={(e) => setContarGanado(e.target.checked)} /> La vida que sumas por buen comportamiento compensa la que perdió</label>
            <label className="block">Perder <input type="number" min="1" value={tolerancia} onChange={(e) => setTolerancia(e.target.value)} className={num} /> ❤️ en el periodo = nota mínima ({emin}). Sin pérdidas = {emax}.</label>
          </div>
        ) : (
          <div className="text-xs text-slate-600 space-y-1">
            <label className="block">Con <input type="number" value={piso} onChange={(e) => setPiso(Number(e.target.value))} className={num} /> ❤️ o menos → nota {emin}</label>
            <label className="block">Con <input type="number" value={techo} onChange={(e) => setTecho(Number(e.target.value))} className={num} /> ❤️ o más → nota {emax}</label>
            <p className="text-[11px] text-amber-700">Ojo: la vida de hoy sube si el estudiante descansa en la Posada o usa pociones, y baja por duelos del Mundo. Para comportamiento es más justo «vida perdida en el periodo».</p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
        <div className="text-sm font-semibold text-slate-700">2. ¿Dónde queda en la Planilla?</div>
        <div className="flex flex-wrap gap-2 items-center">
          <select className={sel} value={materiaId} onChange={(e) => setMateriaId(e.target.value)}>{materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
          <select className={sel} value={periodo} onChange={(e) => setPeriodo(e.target.value)}>{periodosDe(config).map((p) => <option key={p} value={p}>Periodo {p}</option>)}</select>
          <select className={sel} value={destino} onChange={(e) => setDestino(e.target.value)}><option value="nueva">➕ Crear columna nueva</option>{columnas.map((c) => <option key={c.id} value={c.id}>Usar «{c.nombre}»</option>)}</select>
        </div>
        {destino === "nueva" && <div className="flex flex-wrap gap-2"><input value={nombre} onChange={(e) => setNombre(e.target.value)} className={sel + " flex-1 min-w-[10rem]"} /><select className={sel} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>{cats.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({c.porcentaje}%)</option>)}</select></div>}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button disabled={trabajando || !gradoId} onClick={calcular} className="text-sm px-4 py-2 rounded-lg bg-violet-600 text-white disabled:opacity-50">{trabajando ? "Calculando…" : "Ver vista previa"}</button>
        {filas && <button disabled={trabajando || !filas.length} onClick={pasar} className="text-sm px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50">Pasar {filas.length} notas a la Planilla</button>}
      </div>
      {msg && <div className={`text-xs ${msg.startsWith("✔") ? "text-emerald-700" : "text-rose-600"}`}>{msg}</div>}
      {filas && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-xs"><thead><tr className="text-left text-slate-500 bg-slate-50"><th className="p-2">Estudiante</th><th className="p-2">{modo === "actual" ? "Vida" : "Vida perdida / ganada"}</th>{modo === "balance" && <th className="p-2">Pérdida neta</th>}<th className="p-2">Nota</th></tr></thead>
            <tbody>{filas.map((f) => <tr key={f.id} className="border-t border-slate-100"><td className="p-2">{f.nombre}</td><td className="p-2">{f.detalle}</td>{modo === "balance" && <td className="p-2">{f.neto}</td>}<td className="p-2 font-semibold">{f.nota}</td></tr>)}</tbody></table>
        </div>
      )}
    </div>
  );
}
