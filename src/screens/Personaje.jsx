import React, { useEffect, useState, Suspense, lazy } from "react";
import * as api from "../lib/api";
import { personajeSvg } from "../lib/avatarPartes";
import { nivelPersonaje, textoBeneficio, calcularBonos, escudoDisponible, DIAS_RECARGA_ESCUDO } from "../lib/mejorasPersonaje";
import { InsigniaNivel, CapaEstrellasBanner } from "../components/NivelPersonaje";

// Carga diferida: el personaje y la galería (con sus imágenes) solo se descargan
// cuando el estudiante abre esta sección — no forman parte del paquete principal.
const PersonajeConMejoras = lazy(() => import("../components/PersonajeConMejoras"));
const GaleriaPersonajesRol = lazy(() => import("../components/GaleriaPersonajesRol"));

// Se sigue usando en otras pantallas (rankings) para los avatares armados antes por partes.
export function PersonajePreview({ config, size = 100 }) {
  return (
    <svg viewBox="0 0 145 165" width={size} height={size * (165 / 145)} dangerouslySetInnerHTML={{ __html: personajeSvg({
      cuerpoKey: config.cuerpo_key, peloKey: config.pelo_key, peloColor: config.pelo_color,
      atuendoKey: config.atuendo_key, atuendoColor: config.atuendo_color, accesorioKey: config.accesorio_key,
    }) }} />
  );
}

// "Mi Personaje": el personaje que te asignó tu docente (o el que elegiste), y las
// piezas que podés comprar con monedas para mejorarlo — cada una trae un beneficio y
// sube su nivel.
export function VistaPersonaje({ estudianteId, monedas, onMonedasActualizadas }) {
  const [catalogo, setCatalogo] = useState([]);
  const [mias, setMias] = useState([]); // lo que ya compró (cada fila trae su pieza en .mejora)
  const [personajeElegido, setPersonajeElegido] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [comprando, setComprando] = useState(null);
  const [guardandoPersonaje, setGuardandoPersonaje] = useState(false);
  const [galeriaAbierta, setGaleriaAbierta] = useState(false);

  const cargar = async () => {
    const [cat, propias, elegido] = await Promise.all([
      api.fetchMejorasCatalogo({ soloActivas: true }).catch(() => []),
      api.fetchMejorasDeEstudiante(estudianteId).catch(() => []),
      api.fetchPersonajeElegido(estudianteId).catch(() => null),
    ]);
    setCatalogo(cat);
    setMias(propias);
    setPersonajeElegido(elegido);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, [estudianteId]);

  const elegirPersonaje = async (rolKey, genero) => {
    setGuardandoPersonaje(true);
    setPersonajeElegido({ rolKey, genero, asignadoPorDocente: false }); // se ve el cambio al toque; si falla el guardado, se avisa
    try {
      await api.guardarPersonajeElegido(estudianteId, rolKey, genero);
      setGaleriaAbierta(false);
    } catch (e) {
      alert("No se pudo guardar: " + e.message);
    }
    setGuardandoPersonaje(false);
  };

  const comprar = async (m) => {
    if (!confirm(`¿Comprar "${m.nombre}" por ${m.costo} monedas?`)) return;
    setComprando(m.id);
    try {
      await api.comprarMejoraPersonaje(estudianteId, m, monedas);
      await cargar();
      onMonedasActualizadas();
    } catch (e) {
      alert(e.message);
      await cargar();
    }
    setComprando(null);
  };

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;

  const nv = nivelPersonaje(mias.length);
  const equipo = mias.filter((f) => f.mejora && f.mejora.slot !== "companero").map((f) => ({ emoji: f.mejora.emoji, nombre: f.mejora.nombre }));
  const companero = mias.find((f) => f.mejora?.slot === "companero")?.mejora.emoji || null;
  const bonos = calcularBonos(mias);
  const tenidas = new Set(mias.map((f) => f.mejora_id));
  const avance = nv.siguiente ? Math.round(((mias.length - nv.desde) / (nv.siguiente.desde - nv.desde)) * 100) : 100;
  const asignado = !!personajeElegido?.asignadoPorDocente;

  const resumenBonos = [
    bonos.xpPct > 0 && `+${bonos.xpPct}% de experiencia`,
    bonos.monedasExtra > 0 && `+${bonos.monedasExtra} 🪙 por acción positiva`,
  ].filter(Boolean).join(" · ");

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">🎨 Mi Personaje</h3>
      <p className="text-xs text-slate-400 mb-3">Mejorá a tu personaje comprando piezas con tus monedas: cada una te da un beneficio y lo hace subir de nivel.</p>

      <div className="relative rounded-2xl overflow-hidden mb-2 flex items-center justify-center"
        style={{ height: 190, background: "linear-gradient(160deg, #223b74 0%, #17264D 55%, #0f1932 100%)" }}>
        <div aria-hidden className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle, #B8892B 1.5px, transparent 1.5px)", backgroundSize: "18px 18px" }} />
        <CapaEstrellasBanner nivel={nv.nivel} />
        {mias.length > 0 && <div className="absolute top-2 right-2 z-10"><InsigniaNivel nivel={nv.nivel} nombre={nv.nombre} color={nv.color} /></div>}
        <div className="relative z-10" style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.35))" }}>
          <Suspense fallback={<span className="text-6xl">🎓</span>}>
            <PersonajeConMejoras rolKey={personajeElegido?.rolKey} genero={personajeElegido?.genero} size={120}
              nivel={nv.nivel} equipo={equipo} companero={companero} />
          </Suspense>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between items-baseline text-xs mb-1">
          <span className="font-bold text-slate-700">Nivel {nv.nivel} · {nv.nombre}</span>
          <span className="font-bold text-amber-600">🪙 {monedas}</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600" style={{ width: `${avance}%` }} />
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          {nv.siguiente ? `Te ${nv.faltan === 1 ? "falta 1 pieza" : `faltan ${nv.faltan} piezas`} para ser ${nv.siguiente.nombre}.` : "¡Llegaste al nivel máximo! 🌟"}
        </p>
      </div>

      {/* El personaje en sí: lo asigna el docente; si no lo asignó, se puede elegir. */}
      <div className="bg-slate-50 rounded-2xl p-3 mb-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-slate-500">
            {asignado ? "🎭 Tu personaje — lo asignó tu docente" : personajeElegido ? "🎭 Tu personaje" : "🎭 Todavía no tenés un personaje — elegí uno"}
          </p>
          {!asignado && (
            <button onClick={() => setGaleriaAbierta((v) => !v)} className="text-xs font-semibold text-violet-600 shrink-0">
              {galeriaAbierta ? "Cerrar" : personajeElegido ? "Cambiar" : "Elegir"}
            </button>
          )}
        </div>
        {galeriaAbierta && !asignado && (
          <div className="mt-2">
            <Suspense fallback={<p className="text-xs text-slate-400 text-center py-4">Cargando personajes…</p>}>
              <GaleriaPersonajesRol elegido={personajeElegido} onElegir={elegirPersonaje} />
            </Suspense>
          </div>
        )}
        {guardandoPersonaje && <p className="text-[10px] text-slate-400 text-center mt-1">Guardando…</p>}
      </div>

      <h4 className="text-sm font-bold text-slate-800 mb-2">🛒 Piezas para mejorar tu personaje</h4>
      {catalogo.length === 0 ? (
        <p className="text-xs text-slate-400 bg-slate-50 rounded-xl p-3 mb-4">Todavía no hay piezas disponibles. Tu docente las va a ir sumando.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {catalogo.map((m) => {
            const fila = mias.find((f) => f.mejora_id === m.id);
            const faltan = m.costo - monedas;
            return (
              <div key={m.id} className={`rounded-2xl border p-3 flex items-start gap-3 ${fila ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                <div className="text-3xl shrink-0 leading-none">{m.emoji}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-800 leading-tight">{m.nombre}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{textoBeneficio(m)}</div>
                  <div className="mt-2">
                    {fila ? (
                      <span className="text-[11px] font-semibold text-emerald-700">
                        ✓ Tuya{m.beneficio_tipo === "privilegio" ? (fila.canjeado ? " · Canjeado ✓" : " · 🎟️ Pedíselo a tu docente") : ""}
                      </span>
                    ) : faltan > 0 ? (
                      <span className="text-[11px] text-slate-400">🪙 {m.costo} · te faltan {faltan}</span>
                    ) : (
                      <button disabled={comprando === m.id} onClick={() => comprar(m)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-500 text-white disabled:opacity-60">
                        {comprando === m.id ? "Comprando…" : `Comprar · 🪙 ${m.costo}`}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mias.length > 0 && (
        <div className="bg-violet-50 rounded-2xl p-3">
          <h4 className="text-xs font-bold text-violet-700 mb-1.5">✨ Tus beneficios activos</h4>
          {resumenBonos && <p className="text-xs font-semibold text-violet-800 mb-1.5">{resumenBonos}</p>}
          <ul className="space-y-1">
            {mias.filter((f) => f.mejora).map((f) => (
              <li key={f.id} className="text-[11px] text-slate-600">
                <span className="mr-1">{f.mejora.emoji}</span><span className="font-semibold">{f.mejora.nombre}</span> — {textoBeneficio(f.mejora)}
                {f.mejora.beneficio_tipo === "escudo_vida" && (
                  <span className={escudoDisponible(f) ? "text-emerald-600" : "text-amber-600"}>
                    {escudoDisponible(f) ? " · listo" : ` · recargando (vuelve en ${Math.max(1, Math.ceil(DIAS_RECARGA_ESCUDO - (new Date() - new Date(f.ultimo_uso)) / 86400000))} días)`}
                  </span>
                )}
                {f.mejora.beneficio_tipo === "privilegio" && <span className={f.canjeado ? "text-slate-400" : "text-amber-600"}>{f.canjeado ? " · canjeado" : " · disponible"}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
