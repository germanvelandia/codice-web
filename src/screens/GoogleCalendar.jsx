import React, { useState } from "react";
import { CLIENT_ID, TIPOS, pedirToken, sincronizar, resumenPrevio, generarICS } from "../lib/googleCalendar";

const hoyAnio = new Date().getFullYear();

export function VistaGoogleCalendar() {
  const [tipos, setTipos] = useState(TIPOS.map((t) => t.key));
  const [desde, setDesde] = useState(`${hoyAnio}-01-15`);
  const [hasta, setHasta] = useState(`${hoyAnio}-11-30`);
  const [msg, setMsg] = useState(""); const [ocupado, setOcupado] = useState(false);
  const [prev, setPrev] = useState(null); const [res, setRes] = useState(null); const [error, setError] = useState("");

  const alt = (k) => setTipos((t) => (t.includes(k) ? t.filter((x) => x !== k) : [...t, k]));

  const ver = async () => {
    setError(""); setRes(null); setOcupado(true); setMsg("Calculando…");
    try { setPrev(await resumenPrevio(tipos, { desde, hasta })); } catch (e) { setError(e.message); }
    setOcupado(false); setMsg("");
  };
  const enviar = async () => {
    setError(""); setRes(null); setOcupado(true);
    try {
      setMsg("Pidiendo permiso a Google…");
      const token = await pedirToken();
      setRes(await sincronizar(token, tipos, { desde, hasta }, setMsg));
    } catch (e) { setError(e.message); }
    setOcupado(false); setMsg("");
  };

  const descargar = async () => {
    setError(""); setRes(null); setOcupado(true); setMsg("Armando el archivo…");
    try {
      const { texto, total } = await generarICS(tipos, { desde, hasta });
      const url = URL.createObjectURL(new Blob([texto], { type: "text/calendar;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = "codice.ics"; a.click(); URL.revokeObjectURL(url);
      setMsg(`Descargado codice.ics con ${total} eventos.`);
    } catch (e) { setError(e.message); setMsg(""); }
    setOcupado(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 w-full max-w-3xl space-y-4">
      <div>
        <h2 className="font-bold text-slate-800">📆 Enviar a Google Calendar</h2>
        <p className="text-xs text-slate-500">Descarga el archivo y, en Google Calendar (en el computador): ⚙️ Configuración → Importar y exportar → Importar → elige codice.ics y el calendario destino. Si vuelves a importarlo más adelante, los eventos se actualizan en vez de duplicarse (los que borraste en CÓDICE debes quitarlos a mano en Google).</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-1.5">
        {TIPOS.map((t) => (
          <label key={t.key} className="flex items-center gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2 cursor-pointer">
            <input type="checkbox" checked={tipos.includes(t.key)} onChange={() => alt(t.key)} /> {t.icono} {t.label}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        <label>Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="border rounded-lg px-2 py-1 ml-1" /></label>
        <label>Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="border rounded-lg px-2 py-1 ml-1" /></label>
      </div>
      <p className="text-[11px] text-slate-400">Las clases del horario se repiten cada semana entre esas fechas.</p>
      <div className="flex flex-wrap gap-2">
        <button disabled={ocupado || !tipos.length} onClick={ver} className="text-xs font-semibold px-4 py-2 rounded-xl border border-violet-300 text-violet-700 disabled:opacity-50">Ver qué se enviaría</button>
        <button disabled={ocupado || !tipos.length} onClick={descargar} className="text-xs font-semibold px-4 py-2 rounded-xl bg-violet-500 text-white disabled:opacity-50">⬇️ Descargar archivo para Google Calendar</button>
        {CLIENT_ID && <button disabled={ocupado || !tipos.length} onClick={enviar} className="text-xs font-semibold px-4 py-2 rounded-xl border border-violet-300 text-violet-700 disabled:opacity-50">🔄 Sincronizar directo</button>}
        <a href="https://calendar.google.com" target="_blank" rel="noreferrer" className="text-xs font-semibold px-4 py-2 rounded-xl border border-slate-200 text-slate-600">Abrir Google Calendar</a>
      </div>
      {msg && <div className="text-xs text-slate-500">{msg}</div>}
      {error && <div className="text-xs bg-rose-50 text-rose-700 rounded-lg px-3 py-2">{error}</div>}
      {prev && !res && (
        <div className="text-xs bg-slate-50 rounded-lg px-3 py-2">
          Se enviarían <b>{prev.total}</b> eventos: {TIPOS.filter((t) => prev.por[t.key]).map((t) => `${t.icono} ${prev.por[t.key]}`).join(" · ") || "ninguno"}
        </div>
      )}
      {res && (
        <div className="text-xs bg-emerald-50 text-emerald-800 rounded-lg px-3 py-2 space-y-1">
          <div>✔ Listo: {res.creados} nuevos · {res.actualizados} actualizados · {res.sinCambio} sin cambios · {res.borrados} quitados</div>
          {res.errores.length > 0 && <div className="text-rose-700">⚠ {res.errores.length} con problema: {res.errores.slice(0, 3).join(" | ")}</div>}
        </div>
      )}
    </div>
  );
}
