import React, { useEffect, useMemo, useState } from "react";
import * as api from "../lib/api";
import { MENU_CODICE_GRUPOS } from "./MenuEstudiante";

// Descripción corta de cada sección (una línea, para que el estudiante sepa a dónde va).
const DESCRIPCION = {
  codice: "Tu cuaderno de clase", notas: "Tus valoraciones por periodo", evaluaciones: "Presenta tus evaluaciones",
  misiones: "Retos y micro-misiones", forja: "Proyectos y trabajos", guias: "Guías de estudio",
  modulos: "Rutas de aprendizaje", biblioteca: "Lecturas y recursos", proyectos: "Tus proyectos",
  historial: "Lo que has ganado y hecho",
  ranking: "Cómo vas frente al grupo", salonhonor: "Los mejores del periodo", recompensas: "Canjea tus monedas",
  album: "Colecciona criaturas", comarca: "El reino de tu grupo",
  preguntados: "Gira la ruleta y responde", quizvivo: "Juega en vivo con el docente", personaje: "Personaliza tu personaje",
  salaavatares: "Conoce los avatares", mundo: "Explora, misiones y reinos", tablero: "El tablero de todos los grupos",
  coevaluacion: "Evalúa tu trabajo y el de tu equipo", misdiplomas: "Tus reconocimientos", encuesta: "Cuéntanos cómo vas", perfil: "Tus datos y tu foto",
};
const COLORES = { estudio: "#2F55A4", comunidad: "#B45309", diversion: "#7C3AED", cuenta: "#0F766E" };
// Lo académico va primero y en tarjetas más grandes.
const ACADEMICAS = ["codice", "notas", "evaluaciones", "misiones"];

function leerFav(id) { try { return JSON.parse(localStorage.getItem("codice_fav_est_" + id) || "[]"); } catch { return []; } }
function guardarFav(id, v) { try { localStorage.setItem("codice_fav_est_" + id, JSON.stringify(v)); } catch { /* sin almacenamiento */ } }

export function InicioEstudiante({ onIrA, estudianteId, gradoId }) {
  const [busqueda, setBusqueda] = useState("");
  const [favoritos, setFavoritos] = useState(() => leerFav(estudianteId));
  const [pendientes, setPendientes] = useState({});

  // Insignias de novedad: evaluaciones abiertas con intentos disponibles.
  useEffect(() => {
    if (!gradoId || !estudianteId) return;
    let vivo = true;
    (async () => {
      try {
        const evs = await api.fetchEvaluacionesDisponibles(gradoId);
        const ahora = new Date();
        let n = 0;
        for (const ev of evs) {
          if (ev.fecha_cierre) {
            const lim = new Date(`${ev.fecha_cierre}T${(ev.hora_cierre || "23:59").slice(0, 5)}:00`);
            if (!isNaN(lim) && lim < ahora) continue;
          }
          let usados = 0;
          try { usados = (await api.fetchMisIntentos(ev.id, estudianteId)).length; } catch { /* sigue */ }
          if (ev.intentos_permitidos == null || usados < ev.intentos_permitidos) n++;
        }
        if (vivo) setPendientes({ evaluaciones: n });
      } catch { /* sin insignias */ }
    })();
    return () => { vivo = false; };
  }, [gradoId, estudianteId]);

  const alternarFav = (key) => {
    setFavoritos((prev) => {
      const nuevo = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key].slice(-6);
      guardarFav(estudianteId, nuevo);
      return nuevo;
    });
  };

  const todas = useMemo(() => MENU_CODICE_GRUPOS.flatMap((g) => g.items), []);
  const q = busqueda.trim().toLowerCase();
  const coincide = (it) => !q || it.label.toLowerCase().includes(q) || (DESCRIPCION[it.key] || "").toLowerCase().includes(q);
  const grupos = MENU_CODICE_GRUPOS.filter((g) => g.key !== "inicio_grupo")
    .map((g) => ({ ...g, items: g.items.filter(coincide) })).filter((g) => g.items.length > 0);

  const Insignia = ({ k }) => (pendientes[k] > 0 ? (
    <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow">{pendientes[k]}</span>
  ) : null);
  const Estrella = ({ k }) => (
    <button type="button" onClick={(e) => { e.stopPropagation(); alternarFav(k); }} title={favoritos.includes(k) ? "Quitar de favoritos" : "Fijar en favoritos"}
      className={`absolute bottom-1.5 right-2 text-sm leading-none ${favoritos.includes(k) ? "text-amber-400" : "text-slate-300 hover:text-amber-300"}`}>★</button>
  );

  const Tarjeta = ({ it, color, grande }) => (
    <div className="relative">
      <button onClick={() => onIrA(it.key)} className={`w-full text-left rounded-2xl border bg-white hover:shadow-md transition-all ${grande ? "p-4 pb-5" : "p-3 pb-4"}`} style={{ borderColor: color + "40" }}>
        <div className="flex items-center gap-3">
          <span className={`${grande ? "text-3xl w-12 h-12" : "text-2xl w-10 h-10"} shrink-0 rounded-xl flex items-center justify-center`} style={{ background: color + "18" }}>{it.icono}</span>
          <div className="min-w-0">
            <div className={`font-extrabold text-slate-800 leading-tight ${grande ? "text-sm" : "text-[13px]"}`}>{it.label}</div>
            <div className="text-[11px] text-slate-500 leading-snug">{DESCRIPCION[it.key] || ""}</div>
          </div>
        </div>
      </button>
      <Insignia k={it.key} />
      <Estrella k={it.key} />
    </div>
  );

  const academicas = ACADEMICAS.map((k) => todas.find((t) => t.key === k)).filter((it) => it && coincide(it));
  const favItems = favoritos.map((k) => todas.find((t) => t.key === k)).filter(Boolean);

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="font-extrabold text-slate-800 text-base">🧭 ¿A dónde vamos hoy?</div>
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="🔎 Buscar sección…"
          className="text-sm rounded-full px-3.5 py-1.5 border border-slate-200 bg-white outline-none focus:border-[#2F55A4] w-full sm:w-64" />
      </div>

      {!q && favItems.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
          <div className="text-xs font-extrabold text-amber-700 mb-2">⭐ Mis favoritos</div>
          <div className="flex flex-wrap gap-2">
            {favItems.map((it) => (
              <button key={it.key} onClick={() => onIrA(it.key)} className="flex items-center gap-1.5 text-[12px] font-bold text-slate-700 bg-white border border-amber-200 rounded-full px-3 py-1.5 hover:shadow-sm">
                <span>{it.icono}</span>{it.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {academicas.length > 0 && (
        <div className="mb-5">
          <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400 mb-2">📌 Lo principal</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {academicas.map((it) => <Tarjeta key={it.key} it={it} color={COLORES.estudio} grande />)}
          </div>
        </div>
      )}

      {grupos.length === 0 && <p className="text-sm text-slate-400">No hay secciones con ese nombre.</p>}
      {grupos.map((g) => {
        const color = COLORES[g.key] || "#2F55A4";
        const items = g.items.filter((it) => !ACADEMICAS.includes(it.key));
        if (items.length === 0) return null;
        return (
          <div key={g.key} className="mb-5">
            <div className="text-[11px] font-extrabold uppercase tracking-wide mb-2" style={{ color }}>{g.icono} {g.label}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {items.map((it) => <Tarjeta key={it.key} it={it} color={color} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
