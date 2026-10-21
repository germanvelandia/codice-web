import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import * as api from "../lib/api";
import { descargarArchivo } from "../lib/informeImpacto";

const VENTANA_MS = 60000;   // dos respuestas a la MISMA pregunta con menos de 60 s = autoclic
const XP_ACIERTO = 5, MONEDAS_ACIERTO = 2; // lo que Preguntados daba por cada acierto

const mensajePorDefecto = (xp, mon) =>
  `⚠️ ADVERTENCIA: se detectó uso de autoclic en Preguntados (clics repetidos sobre la misma respuesta para sumar puntos). Se descontaron ${xp} XP${mon ? ` y ${mon} monedas` : ""} obtenidos de forma indebida. Si se repite habrá sanciones. Juega limpio: ¡así se gana de verdad!`;

async function respuestasDe(ids) {
  const PAG = 1000, trozos = [];
  for (let i = 0; i < ids.length; i += 10) trozos.push(ids.slice(i, i + 10));
  const porTrozo = await Promise.all(trozos.map(async (trozo) => {
    const filas = [];
    for (let d = 0; ; d += PAG) {
      const { data, error } = await supabase.from("trivia_respuestas").select("id, estudiante_id, pregunta_id, acierto, creado_en").in("estudiante_id", trozo).order("id").range(d, d + PAG - 1);
      if (error) throw error;
      filas.push(...(data || []));
      if (!data || data.length < PAG) break;
    }
    return filas;
  }));
  return porTrozo.flat();
}

// Para cada estudiante: filas "de más" (repetidas de la misma pregunta dentro de la ventana)
function analizar(estudiantes, filas) {
  const porEst = new Map();
  filas.forEach((r) => { const k = String(r.estudiante_id); (porEst.get(k) || porEst.set(k, []).get(k)).push(r); });
  const res = [];
  for (const e of estudiantes) {
    const mias = (porEst.get(String(e.id)) || []).sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en));
    const ultima = new Map(); // pregunta -> hora de la última respuesta contada
    const sobrantes = [];
    for (const r of mias) {
      const t = new Date(r.creado_en).getTime(), prev = ultima.get(r.pregunta_id);
      if (prev !== undefined && t - prev < VENTANA_MS) sobrantes.push(r); else ultima.set(r.pregunta_id, t);
      if (prev !== undefined && t - prev < VENTANA_MS) ultima.set(r.pregunta_id, t); // la ráfaga se encadena
    }
    if (!sobrantes.length) continue;
    const aciertos = sobrantes.filter((r) => r.acierto);
    res.push({ id: e.id, nombre: e.nombre, repetidas: sobrantes.length, aciertosDeMas: aciertos.length, xp: aciertos.length * XP_ACIERTO, monedas: aciertos.length * MONEDAS_ACIERTO, ids: sobrantes.map((r) => r.id), ultima: sobrantes[sobrantes.length - 1].creado_en });
  }
  return res.sort((a, b) => b.xp - a.xp);
}

// Con el SQL 102 la base ya devuelve solo las respuestas repetidas
function resumir(estudiantes, repetidas) {
  const porEst = new Map();
  repetidas.forEach((r) => { const k = String(r.estudiante_id); (porEst.get(k) || porEst.set(k, []).get(k)).push(r); });
  const res = [];
  for (const e of estudiantes) {
    const l = porEst.get(String(e.id));
    if (!l || !l.length) continue;
    const ac = l.filter((r) => r.acierto).length;
    res.push({ id: e.id, nombre: e.nombre, repetidas: l.length, aciertosDeMas: ac, xp: ac * XP_ACIERTO, monedas: ac * MONEDAS_ACIERTO, ids: l.map((r) => r.id), ultima: l[l.length - 1].creado_en });
  }
  return res.sort((a, b) => b.xp - a.xp);
}

export function VistaRevisionTrivia({ grados = [] }) {
  const [gradoId, setGradoId] = useState(grados[0]?.id ?? "");
  const [casos, setCasos] = useState(null);
  const [sel, setSel] = useState({});
  const [mensaje, setMensaje] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState("");
  useEffect(() => { if (!gradoId && grados[0]) setGradoId(grados[0].id); }, [grados]);
  useEffect(() => { setCasos(null); setHecho(""); setError(""); }, [gradoId]);

  const buscar = async () => {
    setTrabajando(true); setError(""); setHecho("");
    try {
      const er = await supabase.from("estudiantes").select("id, nombre").eq("grado_id", gradoId).eq("activo", true);
      if (er.error) throw er.error;
      const ests = er.data || [];
      const ids = ests.map((e) => e.id);
      let c;
      const rpc = ids.length ? await supabase.rpc("trivia_autoclic", { p_estudiantes: ids }) : { data: [] };
      if (!rpc.error) c = resumir(ests, rpc.data || []);   // rápido (SQL 102)
      else c = analizar(ests, await respuestasDe(ids));    // respaldo, más lento
      setCasos(c); setSel(Object.fromEntries(c.map((x) => [x.id, true])));
    } catch (e) { setError(e.message || "No se pudo analizar."); }
    setTrabajando(false);
  };

  const marcados = (casos || []).filter((c) => sel[c.id]);
  const aplicar = async () => {
    if (!marcados.length) return;
    if (!confirm(`¿Descontar el XP y las monedas indebidas a ${marcados.length} estudiante(s) y dejarles la advertencia en su historial?`)) return;
    setTrabajando(true); setError("");
    const fallos = [];
    for (const c of marcados) {
      try {
        const msg = (mensaje.trim() || mensajePorDefecto(c.xp, c.monedas));
        if (c.xp > 0) { await api.ajustarXp(c.id, -c.xp); await api.registrarHistorialPunto(c.id, "xp", -c.xp, msg); }
        if (c.monedas > 0) { await api.ajustarMonedas(c.id, -c.monedas); await api.registrarHistorialPunto(c.id, "monedas", -c.monedas, msg); }
        if (c.xp === 0 && c.monedas === 0) await api.registrarHistorialPunto(c.id, "xp", 0, msg);
        // se borran las respuestas repetidas para no volver a descontar lo mismo
        for (let i = 0; i < c.ids.length; i += 100) { const r = await supabase.from("trivia_respuestas").delete().in("id", c.ids.slice(i, i + 100)); if (r.error) throw r.error; }
      } catch (e) { fallos.push(`${c.nombre}: ${e.message || e}`); }
    }
    setTrabajando(false);
    setHecho(`Listo: ${marcados.length - fallos.length} estudiante(s) corregido(s).${fallos.length ? " Con error: " + fallos.join("; ") : ""}`);
    await buscar();
  };
  const csv = () => {
    const g = grados.find((x) => String(x.id) === String(gradoId));
    const rows = ["Estudiante;Respuestas repetidas;Aciertos de más;XP a descontar;Monedas a descontar"];
    (casos || []).forEach((c) => rows.push([c.nombre, c.repetidas, c.aciertosDeMas, c.xp, c.monedas].join(";")));
    descargarArchivo(`autoclic_${String(g?.nombre || gradoId).replace(/\W+/g, "_")}.csv`, "﻿" + rows.join("\r\n"));
  };
  const totXp = marcados.reduce((a, c) => a + c.xp, 0), totMon = marcados.reduce((a, c) => a + c.monedas, 0);

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">🛡️ Revisión de Preguntados (autoclic)</h3>
      <p className="text-xs text-slate-400 mb-3">Busca estudiantes que respondieron la <b>misma pregunta varias veces en menos de 60 segundos</b> (clics repetidos). Cada acierto repetido sumó +{XP_ACIERTO} XP y +{MONEDAS_ACIERTO} monedas de más. Aquí se los descuentas y les dejas una advertencia que verán en su historial.</p>
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-lg px-3 py-2 border border-slate-200 bg-white outline-none">
          {grados.map((g) => <option key={g.id} value={g.id}>{g.nombre || g.id}</option>)}
        </select>
        <button onClick={buscar} disabled={trabajando || !gradoId} className="text-sm font-semibold px-4 py-2 rounded-xl bg-violet-500 text-white disabled:opacity-50">{trabajando && !casos ? "Analizando…" : "🔍 Analizar este curso"}</button>
        {casos && casos.length > 0 && <button onClick={csv} className="text-xs font-semibold text-emerald-600">⬇ CSV</button>}
      </div>
      {error && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2 mb-2">{error}</div>}
      {hecho && <div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg p-2 mb-2">{hecho}</div>}
      {casos && casos.length === 0 && <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-3">✅ No se encontraron respuestas repetidas en este curso.</p>}
      {casos && casos.length > 0 && (
        <div className="space-y-3">
          <div className="space-y-1">
            {casos.map((c) => (
              <label key={c.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer ${sel[c.id] ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"}`}>
                <input type="checkbox" checked={!!sel[c.id]} onChange={(e) => setSel((s) => ({ ...s, [c.id]: e.target.checked }))} />
                <span className="text-sm text-slate-700 flex-1 truncate">{c.nombre}</span>
                <span className="text-xs text-slate-500 shrink-0">{c.repetidas} repetidas · {c.aciertosDeMas} aciertos de más → <b className="text-rose-600">−{c.xp} XP · −{c.monedas} 🪙</b></span>
              </label>
            ))}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-1">Mensaje de advertencia (lo verán en su Historial)</div>
            <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={3} placeholder={mensajePorDefecto("N", "M")} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 bg-white outline-none" />
            <p className="text-[11px] text-slate-400">Si lo dejas vacío se usa el mensaje de arriba, con las cifras de cada estudiante.</p>
          </div>
          <button onClick={aplicar} disabled={trabajando || !marcados.length} className="w-full text-sm font-semibold py-2.5 rounded-xl bg-rose-500 text-white disabled:opacity-50">
            {trabajando ? "Aplicando…" : `Descontar −${totXp} XP y −${totMon} monedas a ${marcados.length} estudiante(s) y advertir`}
          </button>
          <p className="text-[11px] text-slate-400">Se borran también las respuestas repetidas, así que no se descuenta dos veces. Revisa un curso a la vez.</p>
        </div>
      )}
    </div>
  );
}
