// Códice Craft: acceso directo al mundo 3D para estudiantes (link …/#craft).
// Solo pide el código del estudiante (el mismo del portal) y abre el mundo; no muestra ninguna opción de docente.
// La seguridad es la misma del portal: el código se valida en el servidor y el mundo solo funciona con la sesión del estudiante.
import React, { Suspense, useEffect, useState } from "react";
import * as api from "../lib/api";
import { VistaMundo3D } from "./comunes";
import { cerrarSesionEstudiante } from "../lib/sesionEstudiante";

const NOMBRE = "Códice Craft";

export function PortalCraft() {
  const [codigo, setCodigo] = useState(() => { try { return localStorage.getItem("codice_estudiante_codigo") || ""; } catch (_) { return ""; } });
  const [est, setEst] = useState(null), [cargando, setCargando] = useState(false), [error, setError] = useState("");

  useEffect(() => { document.title = NOMBRE; }, []);

  const entrar = async (cod) => {
    const c = String(cod ?? codigo).trim(); if (!c) return;
    setCargando(true); setError("");
    try {
      const res = await api.consultarPortalEstudiante(c);
      if (!res) { setError("Código no encontrado. Pídele a tu docente tu código."); setEst(null); setCargando(false); return; }
      const info = await api.fetchEstudiantePorCodigo(c);
      if (!info) { setError("No se pudo abrir tu perfil. Intenta de nuevo."); setCargando(false); return; }
      try { localStorage.setItem("codice_estudiante_codigo", c); } catch (_) { /* sin almacenamiento */ }
      setEst(info);
    } catch (e) { setError("No se pudo entrar. Revisa tu conexión e intenta de nuevo."); }
    setCargando(false);
  };
  useEffect(() => { if (codigo) entrar(codigo); }, []); // eslint-disable-line

  const salir = () => {
    try { cerrarSesionEstudiante(); localStorage.removeItem("codice_estudiante_codigo"); } catch (_) { /* nada */ }
    setCodigo(""); setEst(null);
  };

  if (est) {
    return (
      <div className="min-h-screen" style={{ background: "#0f0a2a" }}>
        <div className="max-w-5xl mx-auto p-3">
          <div className="flex items-center justify-between text-white mb-2 px-1">
            <b className="text-base">🧊 {NOMBRE} <span className="font-normal opacity-70 text-sm">· {est.nombre || "Explorador"}</span></b>
            <button onClick={salir} className="text-xs px-3 py-1 rounded-full bg-white/15 hover:bg-white/25">Salir</button>
          </div>
          <div className="rounded-2xl bg-white p-3">
            <Suspense fallback={<p className="text-sm text-slate-400">Cargando {NOMBRE}…</p>}><VistaMundo3D estudianteInfo={est} /></Suspense>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ background: "linear-gradient(160deg,#1e1b4b,#0f0a2a 60%,#3b0764)" }}>
      <form onSubmit={(e) => { e.preventDefault(); entrar(); }} className="w-full max-w-sm text-center text-white">
        <div className="text-7xl mb-2">🧊</div>
        <h1 className="text-3xl font-extrabold tracking-tight">{NOMBRE}</h1>
        <p className="text-violet-200 text-sm mt-1 mb-5">Construye, explora y captura criaturas con tu curso.</p>
        <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Tu código de estudiante" autoCapitalize="none" autoComplete="off"
          className="w-full rounded-xl px-4 py-3 text-slate-900 text-center text-lg font-semibold outline-none focus:ring-4 ring-amber-400" />
        {error && <p className="text-red-300 text-sm mt-2">{error}</p>}
        <button disabled={cargando || !codigo.trim()} className="mt-3 w-full rounded-xl py-3 font-extrabold text-slate-900 bg-amber-400 disabled:opacity-50">{cargando ? "Entrando…" : "¡Entrar al mundo!"}</button>
        <p className="text-[11px] text-violet-300/80 mt-4">¿No tienes tu código? Pídeselo a tu docente.</p>
      </form>
    </div>
  );
}
