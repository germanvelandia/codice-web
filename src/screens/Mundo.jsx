import React, { useEffect, useRef, useState, Suspense, lazy } from "react";
import * as api from "../lib/api";
import * as mundoApi from "../lib/mundoApi";
import { nivelPersonaje } from "../lib/mejorasPersonaje";
import { useNivelesPersonaje } from "../lib/configNiveles";

// El personaje con su brillo y equipo (se carga aparte, trae las imágenes).
const PersonajeConMejoras = lazy(() => import("../components/PersonajeConMejoras"));

// Mundo CÓDICE: la puerta de entrada al mundo virtual de aprendizaje. Muestra una tarjeta con el
// personaje del estudiante y su progreso; al tocar "Entrar" se abre el juego a pantalla completa.
// El juego y sus imágenes (que pesan) NO se descargan hasta ese momento.

const primerNombre = (n) => { const p = String(n || "").trim().split(/\s+/)[0] || "Estudiante"; return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase(); };

export default function VistaMundo({ estudianteInfo, datos, onProgreso, onIrAPersonaje }) {
  const [info, setInfo] = useState(null);       // { personaje, mejoras, misiones, hechas, modoPrueba }
  const [cargando, setCargando] = useState(true);
  const [jugando, setJugando] = useState(false);
  const [errorJuego, setErrorJuego] = useState("");
  const raizRef = useRef(null);
  const idEst = estudianteInfo.id;
  useNivelesPersonaje(); // para que el nivel se actualice si cambian en "Editar niveles"

  const cargar = async () => {
    const [pers, mej, mis, hec] = await Promise.allSettled([api.fetchPersonajeElegido(idEst), api.fetchMejorasDeEstudiante(idEst), mundoApi.fetchMisionesMundo(), mundoApi.fetchHechasMundo(idEst)]);
    // Si todavía no se corrió el SQL 62 (o no hay misiones cargadas) el mundo funciona en "modo prueba".
    const hayMisiones = mis.status === "fulfilled" && mis.value.length > 0 && hec.status === "fulfilled";
    setInfo({
      personaje: pers.status === "fulfilled" ? pers.value : null,
      mejoras: mej.status === "fulfilled" ? mej.value.filter((f) => f.mejora) : [],
      misiones: hayMisiones ? mis.value : mundoApi.MISIONES_EJEMPLO,
      hechas: hayMisiones ? hec.value : [],
      modoPrueba: !hayMisiones,
    });
    setCargando(false);
  };
  useEffect(() => { setCargando(true); cargar(); }, [idEst]);

  const nv = info ? nivelPersonaje(info.mejoras.length) : null;
  const companero = info ? info.mejoras.find((f) => f.mejora.slot === "companero")?.mejora.emoji || null : null;
  const equipo = info ? info.mejoras.filter((f) => f.mejora.slot !== "companero").map((f) => ({ emoji: f.mejora.emoji, nombre: f.mejora.nombre })) : [];

  // ---- el juego (a pantalla completa) ----
  useEffect(() => {
    if (!jugando || !info) return undefined;
    let cancelado = false, mundo = null;
    const overflowPrevio = document.body.style.overflow; document.body.style.overflow = "hidden";
    (async () => {
      try {
        const [{ iniciarMundo }, { SPRITES_MUNDO }] = await Promise.all([import("../game/mundo"), import("../game/spritesMundo")]);
        if (cancelado || !raizRef.current) return;
        mundo = await iniciarMundo(raizRef.current, {
          sprites: SPRITES_MUNDO, modoPrueba: info.modoPrueba, misiones: info.misiones, hechas: info.hechas,
          jugador: {
            id: idEst, nombre: primerNombre(estudianteInfo.nombre), clave: `${info.personaje.rolKey}_${info.personaje.genero}`, xp: datos?.xp ?? 0, oro: datos?.monedas ?? 0,
            nivel: nv && nv.nivel > 1 ? { nivel: nv.nivel, nombre: nv.nombre, color: nv.color } : null, companero,
          },
          alCompletar: async (m) => (info.modoPrueba ? { ok: true } : mundoApi.completarMisionMundo(idEst, m)),
          alSalir: () => { setJugando(false); },
        });
        if (cancelado) mundo.destruir();
      } catch (e) { if (!cancelado) { setErrorJuego((e && e.message) || "No se pudo abrir el mundo."); setJugando(false); } }
    })();
    return () => { cancelado = true; document.body.style.overflow = overflowPrevio; if (mundo) mundo.destruir(); };
  }, [jugando]);

  const salioDelJuego = useRef(false);
  useEffect(() => { // al salir del mundo se refresca el progreso del portal y las misiones hechas
    if (jugando) { salioDelJuego.current = true; return; }
    if (salioDelJuego.current) { salioDelJuego.current = false; onProgreso && onProgreso(); mundoApi.fetchHechasMundo(idEst).then((hec) => setInfo((i) => (i && !i.modoPrueba ? { ...i, hechas: hec } : i))).catch(() => {}); }
  }, [jugando]);

  if (cargando) return <p className="text-sm text-slate-400">Preparando el mundo…</p>;
  const total = info.misiones.length, hechas = info.misiones.filter((m) => info.hechas.includes(m.id)).length;

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">🌍 Mundo CÓDICE</h2>
      <p className="text-sm text-slate-400 mb-4">Un mundo para explorar con tu personaje: camina por la aldea, entra a los edificios, conversa con sus habitantes y completa misiones para ganar experiencia y monedas.</p>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 max-w-md">
        {!info.personaje ? (
          <div className="text-center py-4">
            <div className="text-5xl mb-2">🎭</div>
            <p className="text-sm text-slate-600 mb-3">Para entrar al mundo primero necesitas un personaje.</p>
            <button onClick={onIrAPersonaje} className="text-sm font-bold px-5 py-2.5 rounded-full bg-violet-500 text-white">Elegir mi personaje</button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4">
              <div className="rounded-2xl flex items-center justify-center shrink-0" style={{ width: 150, height: 150, background: "linear-gradient(160deg, #223b74 0%, #17264D 55%, #0f1932 100%)" }}>
                <Suspense fallback={<span className="text-xs text-white/60">…</span>}>
                  <PersonajeConMejoras rolKey={info.personaje.rolKey} genero={info.personaje.genero} size={96} nivel={nv.nivel} equipo={equipo} companero={companero} />
                </Suspense>
              </div>
              <div className="min-w-0">
                <div className="text-lg font-bold text-slate-800 truncate">{primerNombre(estudianteInfo.nombre)}</div>
                <div className="text-xs font-semibold text-violet-600 mb-2">Nivel {nv.nivel} · {nv.nombre}</div>
                <div className="text-xs text-slate-500">🎯 Misiones: <b className="text-slate-700">{hechas}/{total}</b></div>
              </div>
            </div>
            {info.modoPrueba && (
              <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-2.5 mb-3">🧪 <b>Modo prueba:</b> todavía no están activas las misiones del mundo, así que puedes explorar y jugar, pero no se guarda nada ni se entregan premios.</div>
            )}
            {errorJuego && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-2.5 mb-3">No se pudo abrir el mundo: {errorJuego}</div>}
            <button onClick={() => { setErrorJuego(""); setJugando(true); }} className="w-full text-base font-bold px-5 py-3 rounded-2xl bg-violet-500 text-white shadow-md">🌍 Entrar al mundo</button>
            <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">📱 En el celular se juega mejor con la pantalla horizontal. Usa el círculo para caminar y el botón 💬 para hablar o entrar. En computador: flechas o WASD, y E para interactuar. 🔊 Tiene sonido (la tecla M lo silencia).</p>
          </>
        )}
      </div>

      {jugando && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "#000", paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)", boxSizing: "border-box" }}>
          <div ref={raizRef} style={{ width: "100%", height: "100%" }} />
        </div>
      )}
    </div>
  );
}
