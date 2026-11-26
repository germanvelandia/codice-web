// Panel del administrador para empezar el año nuevo: eliges qué reiniciar, ves cuántos registros se afectan,
// se guarda un respaldo restaurable y confirmas escribiendo una palabra. La seguridad la pone el servidor (SQL 161).
import React, { useEffect, useMemo, useState } from "react";
import * as api from "../lib/reinicioApi";

const RIESGO = {
  bajo: { txt: "Riesgo bajo", cls: "bg-emerald-50 text-emerald-700" },
  medio: { txt: "Riesgo medio", cls: "bg-amber-50 text-amber-700" },
  alto: { txt: "Riesgo alto", cls: "bg-rose-50 text-rose-700" },
};
const GRUPOS_RAPIDOS = [
  { nombre: "🎮 Juegos y gamificación", claves: ["gamificacion", "logros", "mundo3d", "mundo2d", "comarca", "detectives", "juegos", "codice"] },
  { nombre: "📚 Registros académicos", claves: ["notas", "asistencia", "resultados", "clases", "convivencia"] },
];
const fmt = (n) => Number(n || 0).toLocaleString("es-CO");
const errTxt = (e) => { const m = String((e && e.message) || e || ""); return /solo_administrador/.test(m) ? "Solo un administrador puede hacer esto." : /confirmacion_incorrecta/.test(m) ? "La palabra de confirmación no coincide." : /ya_restaurado/.test(m) ? "Ese reinicio ya fue restaurado." : /sin_respaldo/.test(m) ? "Ese reinicio no tiene respaldo para restaurar." : /does not exist|reinicio_vista/.test(m) ? "Falta ejecutar el SQL 161 en Supabase." : "No se pudo completar la acción."; };

export function VistaReinicioAnio() {
  const [datos, setDatos] = useState(null), [error, setError] = useState("");
  const [sel, setSel] = useState([]), [respaldo, setRespaldo] = useState(true), [abiertos, setAbiertos] = useState([]);
  const [paso, setPaso] = useState("elegir"); // elegir | confirmar | listo
  const [palabra, setPalabra] = useState(""), [ocupado, setOcupado] = useState(false), [resultado, setResultado] = useState(null);
  const [restaurando, setRestaurando] = useState(null), [palabraRest, setPalabraRest] = useState("");

  const cargar = () => api.fetchReinicioVista().then((d) => { setDatos(d); setError(""); }).catch((e) => setError(errTxt(e)));
  useEffect(() => { cargar(); }, []);

  const modulos = datos?.modulos || [];
  const elegidos = useMemo(() => modulos.filter((m) => sel.includes(m.clave)), [modulos, sel]);
  const totalFilas = elegidos.reduce((a, m) => a + (m.filas || 0), 0);
  const alternar = (k) => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const hayAlto = elegidos.some((m) => m.riesgo === "alto");

  const ejecutar = async () => {
    setOcupado(true); setError("");
    try { const r = await api.ejecutarReinicio(sel, palabra.trim().toUpperCase(), respaldo); setResultado(r); setPaso("listo"); setSel([]); setPalabra(""); cargar(); }
    catch (e) { setError(errTxt(e)); }
    setOcupado(false);
  };
  const restaurar = async () => {
    setOcupado(true); setError("");
    try { await api.restaurarReinicio(restaurando, palabraRest.trim().toUpperCase()); setRestaurando(null); setPalabraRest(""); await cargar(); }
    catch (e) { setError(errTxt(e)); }
    setOcupado(false);
  };
  const borrarRespaldo = async (lote) => {
    if (!window.confirm("Se borrará el respaldo de este reinicio y ya no se podrá restaurar. ¿Continuar?")) return;
    try { await api.borrarRespaldoReinicio(lote); await cargar(); } catch (e) { setError(errTxt(e)); }
  };

  if (!datos && !error) return <div className="text-sm text-slate-400">Cargando…</div>;
  if (!datos) return <div className="text-sm text-rose-600 bg-rose-50 rounded-xl p-3">{error}</div>;

  if (paso === "listo" && resultado) {
    const filas = Object.entries(resultado.filas || {});
    return (
      <div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-3">
          <div className="font-bold text-emerald-800">✅ Reinicio completado</div>
          <p className="text-xs text-emerald-700 mt-1">{respaldo ? "Se guardó un respaldo: puedes restaurarlo desde el historial de abajo si algo salió mal." : "No se guardó respaldo."}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 mb-3 text-xs text-slate-600 grid sm:grid-cols-2 gap-x-4">
          {filas.map(([t, n]) => <div key={t} className="flex justify-between py-0.5"><span>{t}</span><b>{fmt(n)}</b></div>)}
        </div>
        {(resultado.omitidas || []).length > 0 && <div className="text-xs bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 text-amber-800">Se omitieron: {resultado.omitidas.join(" · ")}</div>}
        <button onClick={() => { setPaso("elegir"); setResultado(null); }} className="text-sm font-bold px-4 py-2 rounded-full bg-violet-500 text-white">Volver</button>
        <Historial datos={datos} onRestaurar={setRestaurando} onBorrar={borrarRespaldo} />
      </div>
    );
  }

  if (paso === "confirmar") {
    return (
      <div>
        <button onClick={() => { setPaso("elegir"); setPalabra(""); }} className="text-sm text-violet-500 mb-3">← Volver a elegir</button>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-3">
          <div className="font-bold text-rose-800">⚠️ Vas a reiniciar {elegidos.length} módulo(s) · {fmt(totalFilas)} registros</div>
          <p className="text-xs text-rose-700 mt-1">Esto afecta a todos los estudiantes. {respaldo ? "Se guardará un respaldo que podrás restaurar." : "SIN respaldo: no se podrá deshacer."}</p>
        </div>
        <ul className="bg-white rounded-xl border border-slate-200 p-3 mb-3 text-sm text-slate-700 space-y-1">
          {elegidos.map((m) => <li key={m.clave}>{m.icono} {m.etiqueta} <span className="text-xs text-slate-400">· {fmt(m.filas)} registros</span></li>)}
        </ul>
        <label className="text-xs font-semibold text-slate-600 block mb-1">Para confirmar escribe <b>REINICIAR</b></label>
        <div className="flex gap-2 flex-wrap items-center">
          <input value={palabra} onChange={(e) => setPalabra(e.target.value)} className="text-sm rounded-lg px-3 py-2 border border-slate-300 outline-none" placeholder="REINICIAR" />
          <button disabled={ocupado || palabra.trim().toUpperCase() !== "REINICIAR"} onClick={ejecutar} className="text-sm font-bold px-4 py-2 rounded-full bg-rose-600 text-white disabled:opacity-40">{ocupado ? "Reiniciando…" : "Reiniciar ahora"}</button>
        </div>
        {error && <div className="text-xs text-rose-600 mt-2">{error}</div>}
      </div>
    );
  }

  return (
    <div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 text-xs text-amber-800">
        Elige qué datos del año que termina quieres dejar en cero. <b>No se tocan</b> estudiantes, docentes, cursos, materias, bancos de preguntas, rúbricas ni casos de Detectives. La promoción de curso se hace en el panel de arriba.
      </div>
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        {GRUPOS_RAPIDOS.map((g) => <button key={g.nombre} onClick={() => setSel((s) => Array.from(new Set([...s, ...g.claves.filter((k) => modulos.some((m) => m.clave === k))])))} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">{g.nombre}</button>)}
        <button onClick={() => setSel(modulos.map((m) => m.clave))} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">Todo</button>
        <button onClick={() => setSel([])} className="text-xs text-slate-400 px-2">Limpiar</button>
      </div>

      <div className="space-y-2 mb-4">
        {modulos.map((m) => {
          const r = RIESGO[m.riesgo] || RIESGO.medio, on = sel.includes(m.clave), abierto = abiertos.includes(m.clave);
          return (
            <div key={m.clave} className={`rounded-xl border p-3 bg-white ${on ? "border-violet-400 ring-1 ring-violet-200" : "border-slate-200"}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={on} onChange={() => alternar(m.clave)} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 text-sm">{m.icono} {m.etiqueta}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.cls}`}>{r.txt}</span>
                    <span className="text-[11px] text-slate-400">{fmt(m.filas)} registros</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{m.detalle}</p>
                </div>
              </label>
              {(m.tablas || []).length > 0 && (
                <button onClick={() => setAbiertos((a) => (a.includes(m.clave) ? a.filter((x) => x !== m.clave) : [...a, m.clave]))} className="text-[11px] text-violet-500 mt-1 ml-7">{abierto ? "Ocultar detalle ▲" : "Ver detalle ▼"}</button>
              )}
              {abierto && <div className="ml-7 mt-1 grid sm:grid-cols-2 gap-x-4 text-[11px] text-slate-500">{m.tablas.map((t) => <div key={t.tabla} className="flex justify-between"><span>{t.tabla}{t.restablece ? " (se restablece)" : ""}</span><b>{fmt(t.filas)}</b></div>)}</div>}
            </div>
          );
        })}
      </div>

      <label className="flex items-start gap-2 text-xs text-slate-600 mb-3 cursor-pointer">
        <input type="checkbox" checked={respaldo} onChange={(e) => setRespaldo(e.target.checked)} className="mt-0.5" />
        <span><b>Guardar respaldo</b> antes de borrar (recomendado). Así podrás restaurar todo si te equivocas.{!respaldo && <b className="text-rose-600"> Sin respaldo no hay vuelta atrás.</b>}</span>
      </label>
      {hayAlto && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-2.5 mb-3">Elegiste módulos de riesgo alto (notas, asistencia, convivencia…). Son registros oficiales: descarga o imprime tus planillas antes de continuar.</div>}
      {error && <div className="text-xs text-rose-600 mb-2">{error}</div>}
      <button disabled={elegidos.length === 0} onClick={() => setPaso("confirmar")} className="text-sm font-bold px-5 py-2.5 rounded-full bg-rose-600 text-white disabled:opacity-40">
        Reiniciar {elegidos.length > 0 ? `${elegidos.length} módulo(s) · ${fmt(totalFilas)} registros` : "(elige módulos)"}
      </button>

      <Historial datos={datos} onRestaurar={setRestaurando} onBorrar={borrarRespaldo} />
      {restaurando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.45)" }} onClick={() => setRestaurando(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h4 className="font-bold text-slate-800 mb-1">♻️ Restaurar este reinicio</h4>
            <p className="text-xs text-slate-500 mb-3">Se devolverán los datos que se borraron (si hay registros nuevos con los mismos datos se conservan los nuevos). Escribe <b>RESTAURAR</b> para confirmar.</p>
            <input value={palabraRest} onChange={(e) => setPalabraRest(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-300 outline-none mb-3" placeholder="RESTAURAR" />
            {error && <div className="text-xs text-rose-600 mb-2">{error}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setRestaurando(null)} className="text-sm text-slate-500 px-3 py-2">Cancelar</button>
              <button disabled={ocupado || palabraRest.trim().toUpperCase() !== "RESTAURAR"} onClick={restaurar} className="text-sm font-bold px-4 py-2 rounded-full bg-violet-600 text-white disabled:opacity-40">{ocupado ? "Restaurando…" : "Restaurar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Historial({ datos, onRestaurar, onBorrar }) {
  const h = datos?.historial || [];
  if (h.length === 0) return null;
  return (
    <div className="mt-6">
      <h4 className="font-bold text-slate-700 text-sm mb-2">Reinicios anteriores</h4>
      <div className="space-y-2">
        {h.map((x) => {
          const total = Object.values((x.resumen && x.resumen.filas) || {}).reduce((a, n) => a + Number(n || 0), 0);
          return (
            <div key={x.lote} className="bg-white rounded-xl border border-slate-200 p-3 text-xs">
              <div className="flex justify-between gap-2 flex-wrap">
                <b className="text-slate-700">{new Date(x.cuando).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}</b>
                <span className="text-slate-400">{fmt(total)} registros · {(x.modulos || []).join(", ")}</span>
              </div>
              <div className="mt-1.5 flex gap-3 items-center">
                {x.restaurado ? <span className="text-emerald-600 font-semibold">♻️ Restaurado</span>
                  : x.respaldo_borrado ? <span className="text-slate-400">Respaldo borrado</span>
                  : x.con_respaldo ? <><button onClick={() => onRestaurar(x.lote)} className="text-violet-600 font-semibold">♻️ Restaurar</button><button onClick={() => onBorrar(x.lote)} className="text-slate-400">Borrar respaldo</button></>
                  : <span className="text-slate-400">Sin respaldo</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
