import React, { Suspense, useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import { CartaCriatura } from "../screens/Album";
import { TextoEnriquecido } from "../components/RichText";
import { PersonajePreview } from "../screens/Personaje";
import { sonidoAcierto, sonidoError, sonidoGirar, sonidoLogro } from "../lib/sonidos";
import { urlDeTarjeta, urlQR } from "../screens/ComarcaOakhaven";
import { nivelPersonaje } from "../lib/mejorasPersonaje";
import { CapaEstrellasBanner, InsigniaNivel } from "../components/NivelPersonaje";
import { PersonajeConMejoras, PersonajeRol } from "./comunes";

export function AlbumEstudiante({ estudianteId, monedas, onMonedasActualizadas }) {
  const [config, setConfig] = useState(null);
  const [catalogo, setCatalogo] = useState([]);
  const [coleccion, setColeccion] = useState([]);
  const [abriendo, setAbriendo] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = () => {
    Promise.all([api.fetchAlbumConfig(), api.fetchCriaturasActivas(), api.fetchColeccion(estudianteId)]).then(([cfg, cat, col]) => {
      setConfig(cfg); setCatalogo(cat); setColeccion(col); setCargando(false);
    });
  };
  useEffect(() => { cargar(); }, [estudianteId]);

  if (cargando || !config) return <div className="text-sm text-slate-400">Cargando…</div>;
  if (catalogo.length === 0) return <p className="text-sm text-slate-400">Todavía no hay criaturas disponibles para coleccionar.</p>;

  const poseidas = new Map(coleccion.map((c) => [c.criatura_id, c]));
  const puedeAbrir = monedas >= config.costo_sobre;

  const abrirSobre = async () => {
    setAbriendo(true);
    setResultado(null);
    try {
      const r = await api.abrirSobre(estudianteId);
      setTimeout(() => {
        setAbriendo(false);
        setResultado(r);
        onMonedasActualizadas();
        cargar();
      }, 1400);
    } catch (e) {
      setAbriendo(false);
      alert("Error al abrir el sobre: " + e.message);
    }
  };

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">🎴 {config.nombre_album}</h3>
      <p className="text-xs text-slate-400 mb-3">Comprá sobres con tus monedas y coleccioná criaturas al azar. Vas a tener {config.cartas_por_sobre} por sobre.</p>

      {abriendo ? (
        <div className="text-center py-6 text-violet-500 animate-pulse text-sm">🎴 Abriendo sobre…</div>
      ) : resultado ? (
        resultado.ok ? (
          <div className="bg-violet-50 rounded-2xl p-4 mb-3 text-center">
            <div className="text-xs font-semibold text-violet-700 mb-2">¡Te tocaron estas criaturas!</div>
            <div className="flex justify-center gap-2 flex-wrap">
              {resultado.cartas.map((c, i) => <CartaCriatura key={i} criatura={c} tamano="chico" />)}
            </div>
          </div>
        ) : (
          <div className="text-center bg-amber-50 rounded-xl p-3 mb-3 text-xs text-amber-700">Te faltan monedas para abrir un sobre (necesitás {resultado.costo}).</div>
        )
      ) : null}

      <button disabled={!puedeAbrir} onClick={abrirSobre} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-50 mb-4">
        {puedeAbrir ? `🎴 Abrir sobre (🪙 ${config.costo_sobre})` : `Necesitás ${config.costo_sobre} monedas`}
      </button>

      <div className="text-xs font-semibold text-slate-600 mb-2">Tu colección ({coleccion.length}/{catalogo.length})</div>
      <div className="flex flex-wrap gap-2 justify-center">
        {catalogo.map((c) => {
          const tenida = poseidas.get(c.id);
          return <CartaCriatura key={c.id} criatura={tenida ? { ...c, cantidad: tenida.cantidad } : c} tamano="chico" revelada={!!tenida} />;
        })}
      </div>
    </div>
  );
}

export function BancoEstudiante({ estudianteId, monedas, onMonedasActualizadas }) {
  const [premiosActivos, setPremiosActivos] = useState([]);
  const [girando, setGirando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  const cargarPremios = () => api.fetchPremiosActivos().then(setPremiosActivos);
  useEffect(() => { cargarPremios(); }, []);

  const costoMinimo = premiosActivos.length > 0 ? Math.min(...premiosActivos.map((p) => p.costo_monedas)) : null;
  const puedeCanjear = costoMinimo !== null && monedas >= costoMinimo;

  const canjear = async () => {
    setGirando(true);
    setResultado(null);
    try {
      const r = await api.canjearAleatorio(estudianteId);
      setTimeout(() => {
        setGirando(false);
        setResultado(r);
        onMonedasActualizadas();
        cargarPremios();
      }, 1500);
    } catch (e) {
      setGirando(false);
      alert("Error al canjear: " + e.message);
    }
  };

  const verHistorial = async () => {
    const c = await api.fetchCanjes();
    setHistorial(c.filter((x) => x.estudiante_id === estudianteId));
    setMostrarHistorial(true);
  };

  if (premiosActivos.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <div className="text-xs font-semibold text-slate-600 mb-2">🏦 Banco de premios</div>
      <p className="text-[11px] text-slate-400 mb-2">Cangeá tus monedas por un premio sorpresa. Cuantas más monedas tengas, a más premios podés aspirar.</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {premiosActivos.map((p) => (
          <span key={p.id} className={`text-[10px] px-2 py-1 rounded-full ${monedas >= p.costo_monedas ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-400"}`}>
            {p.emoji} {p.nombre} · 🪙{p.costo_monedas}
          </span>
        ))}
      </div>

      {girando ? (
        <div className="text-center py-3 text-sm text-violet-500 animate-pulse">🎰 Sorteando tu premio…</div>
      ) : resultado ? (
        resultado.ok ? (
          <div className="text-center bg-emerald-50 rounded-xl p-3 mb-2">
            <div className="text-2xl">{resultado.premio.emoji}</div>
            <div className="text-sm font-bold text-emerald-700">¡Ganaste "{resultado.premio.nombre}"!</div>
            <div className="text-[11px] text-emerald-600">Pedíselo a tu docente. Te quedan {resultado.monedasRestantes} monedas.</div>
          </div>
        ) : (
          <div className="text-center bg-amber-50 rounded-xl p-3 mb-2 text-xs text-amber-700">Todavía no te alcanzan las monedas para ningún premio disponible.</div>
        )
      ) : null}

      <div className="flex gap-2">
        <button disabled={!puedeCanjear || girando} onClick={canjear} className="flex-1 text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-50">
          {puedeCanjear ? "🎰 Canjear por un premio sorpresa" : `Necesitás al menos ${costoMinimo} monedas`}
        </button>
        <button onClick={verHistorial} className="text-xs text-slate-400 px-2">Historial</button>
      </div>

      {mostrarHistorial && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setMostrarHistorial(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-sm max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-bold text-sm text-slate-800">Tus premios ganados</h4>
              <button onClick={() => setMostrarHistorial(false)} className="text-slate-400">✕</button>
            </div>
            {historial.length === 0 ? (
              <p className="text-xs text-slate-400">Todavía no ganaste ningún premio.</p>
            ) : (
              <div className="space-y-1.5">
                {historial.map((c) => (
                  <div key={c.id} className="flex justify-between text-xs bg-slate-50 rounded-lg px-2 py-1.5">
                    <span>{c.premio?.emoji} {c.premio?.nombre || "Premio"}</span>
                    <span className={c.estado === "entregado" ? "text-emerald-600" : "text-amber-600"}>{c.estado === "entregado" ? "✔ Entregado" : "Pendiente"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function MicroMisionesEstudiante({ estudianteId, onCambio }) {
  const [misiones, setMisiones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [completando, setCompletando] = useState(null);

  const cargar = () => api.fetchMicroMisionesEstudiante(estudianteId).then((d) => { setMisiones(d); setCargando(false); });
  useEffect(() => { cargar(); }, [estudianteId]);

  const completar = async (mision) => {
    setCompletando(mision.id);
    try {
      await api.completarMicroMision(mision, estudianteId);
      cargar();
      onCambio && onCambio();
    } catch (e) {
      alert(e.message);
    }
    setCompletando(null);
  };

  if (cargando || misiones.length === 0) return null;

  return (
    <div className="mb-4 pb-4 border-b border-slate-100">
      <div className="text-xs font-semibold text-slate-600 mb-2">🎯 Misiones diarias/semanales</div>
      <div className="space-y-1.5">
        {misiones.map((m) => (
          <div key={m.id} className={`flex items-center justify-between rounded-lg px-3 py-2 ${m.completada ? "bg-emerald-50" : "bg-slate-50"}`}>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-700">{m.tipo === "diaria" ? "☀️" : "📅"} {m.titulo}</div>
              {m.descripcion && <TextoEnriquecido html={m.descripcion} className="text-[11px] text-slate-500" />}
              <div className="text-[10px] text-slate-400">🪙{m.recompensa_monedas} · ⭐{m.recompensa_xp}</div>
            </div>
            {m.completada ? (
              <span className="text-[11px] text-emerald-600 font-semibold shrink-0">✔ Cumplida</span>
            ) : (
              <button disabled={completando === m.id} onClick={() => completar(m)} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-500 text-white shrink-0">
                {completando === m.id ? "…" : "Marcar cumplida"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Personaje chico para los rankings: el pixel art (el que asignó el docente o eligió el
// estudiante) y, si no tiene ninguno, el avatar que armó antes por partes.
export function MiniPersonaje({ personaje, avatar }) {
  if (personaje) {
    return (
      <Suspense fallback={<span style={{ display: "inline-block", width: 28, height: 28 }} />}>
        <PersonajeRol rolKey={personaje.rolKey} genero={personaje.genero} size={28} />
      </Suspense>
    );
  }
  return avatar ? <PersonajePreview config={avatar} size={26} /> : null;
}

export function SalonHonorEstudiante({ estudianteId }) {
  const [datos, setDatos] = useState(null);
  const [avatares, setAvatares] = useState({});
  const [personajes, setPersonajes] = useState({});
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    api.fetchSalonDeHonor().then((d) => {
      setDatos(d);
      setCargando(false);
      const ids = [...new Set([...d.topXp.map((e) => e.id), ...d.topInsignias.map((e) => e.id)])];
      api.fetchAvatarConfigsMultiples(ids).then(setAvatares);
      api.fetchPersonajesMostrarMultiples(ids).then(setPersonajes).catch(() => {});
    });
  }, []);

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;

  const medalla = (i) => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">🏆 Salón de Honor</h3>
      <p className="text-xs text-slate-400 mb-3">Los mejores de toda la institución, cruzando todos los grados.</p>

      <div className="text-xs font-semibold text-slate-600 mb-1.5">⭐ Más XP</div>
      <div className="space-y-1.5 mb-4">
        {datos.topXp.map((e) => (
          <div key={e.id} className={`flex items-center justify-between px-3 py-2 rounded-xl ${e.id === estudianteId ? "bg-violet-100 border border-violet-300" : "bg-slate-50"}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm w-6 text-center shrink-0">{medalla(datos.topXp.indexOf(e))}</span>
              <MiniPersonaje personaje={personajes[e.id]} avatar={avatares[e.id]} />
              <span className={`text-xs truncate ${e.id === estudianteId ? "font-bold text-violet-700" : "text-slate-700"}`}>{e.nombre}{e.id === estudianteId ? " (vos)" : ""}</span>
              <span className="text-[10px] text-slate-400 shrink-0">G{e.grado_id}</span>
            </div>
            <span className="text-xs font-semibold text-slate-500 shrink-0">{e.xp} XP</span>
          </div>
        ))}
        {datos.topXp.length === 0 && <p className="text-xs text-slate-400">Todavía no hay datos.</p>}
      </div>

      <div className="text-xs font-semibold text-slate-600 mb-1.5">🏅 Más insignias</div>
      <div className="space-y-1.5 mb-4">
        {datos.topInsignias.map((e) => (
          <div key={e.id} className={`flex items-center justify-between px-3 py-2 rounded-xl ${e.id === estudianteId ? "bg-violet-100 border border-violet-300" : "bg-slate-50"}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm w-6 text-center shrink-0">{medalla(datos.topInsignias.indexOf(e))}</span>
              <MiniPersonaje personaje={personajes[e.id]} avatar={avatares[e.id]} />
              <span className={`text-xs truncate ${e.id === estudianteId ? "font-bold text-violet-700" : "text-slate-700"}`}>{e.nombre}{e.id === estudianteId ? " (vos)" : ""}</span>
              <span className="text-[10px] text-slate-400 shrink-0">G{e.grado_id}</span>
            </div>
            <span className="text-xs font-semibold text-amber-600 shrink-0">{e.cantidad} 🏅</span>
          </div>
        ))}
        {datos.topInsignias.length === 0 && <p className="text-xs text-slate-400">Todavía nadie desbloqueó insignias.</p>}
      </div>

      <div className="text-xs font-semibold text-slate-600 mb-1.5">📜 Logros recientes</div>
      <div className="space-y-1.5">
        {datos.muroReciente.slice(0, 8).map((l) => (
          <div key={l.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
            <span className="text-base shrink-0">{l.logro_emoji}</span>
            <div className="text-[11px] min-w-0">
              <span className="font-semibold text-slate-700">{l.estudiante_nombre}</span>
              <span className="text-slate-400"> desbloqueó </span>
              <span className="font-semibold text-violet-600">{l.logro_nombre}</span>
            </div>
          </div>
        ))}
        {datos.muroReciente.length === 0 && <p className="text-xs text-slate-400">Todavía no hay logros desbloqueados.</p>}
      </div>
    </div>
  );
}

export function RankingEstudiante({ estudianteId, gradoId }) {
  const [ranking, setRanking] = useState([]);
  const [avatares, setAvatares] = useState({});
  const [personajes, setPersonajes] = useState({});
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.fetchRankingGrado(gradoId).then((r) => {
      setRanking(r);
      setCargando(false);
      api.fetchAvatarConfigsMultiples(r.map((x) => x.id)).then(setAvatares);
      api.fetchPersonajesMostrarMultiples(r.map((x) => x.id)).then(setPersonajes).catch(() => {});
    });
  }, [gradoId]);

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;

  const medalla = (i) => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">🏆 Ranking de tu grado</h3>
      <p className="text-xs text-slate-400 mb-3">Ordenado por experiencia (XP) acumulada.</p>
      <div className="space-y-1.5">
        {ranking.map((r, i) => (
          <div key={r.id} className={`flex items-center justify-between px-3 py-2 rounded-xl ${r.id === estudianteId ? "bg-violet-100 border border-violet-300" : "bg-slate-50"}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm w-6 text-center shrink-0">{medalla(i)}</span>
              <MiniPersonaje personaje={personajes[r.id]} avatar={avatares[r.id]} />
              <span className={`text-xs truncate ${r.id === estudianteId ? "font-bold text-violet-700" : "text-slate-700"}`}>{r.nombre}{r.id === estudianteId ? " (vos)" : ""}</span>
            </div>
            <span className="text-xs font-semibold text-slate-500 shrink-0">{r.xp} XP</span>
          </div>
        ))}
        {ranking.length === 0 && <p className="text-xs text-slate-400">Todavía no hay datos de XP en tu grado.</p>}
      </div>
    </div>
  );
}

export function LogrosEstudiante({ estudianteId }) {
  const [catalogo, setCatalogo] = useState([]);
  const [desbloqueados, setDesbloqueados] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([api.fetchLogrosCatalogo(), api.fetchLogrosEstudiante(estudianteId)]).then(([c, d]) => {
      setCatalogo(c.filter((l) => l.activo)); setDesbloqueados(d); setCargando(false);
    });
  }, [estudianteId]);

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;
  if (catalogo.length === 0) return null;

  const idsDesbloqueados = new Set(desbloqueados.map((d) => d.logro_id));

  return (
    <div>
      <div className="text-xs font-semibold text-slate-600 mb-2">🏅 Insignias ({desbloqueados.length}/{catalogo.length})</div>
      <div className="grid grid-cols-3 gap-2">
        {catalogo.map((l) => {
          const tiene = idsDesbloqueados.has(l.id);
          return (
            <div key={l.id} className="rounded-xl p-2 text-center" style={{ background: tiene ? "#E8EEF8" : "#F1F5F9", border: `1.5px solid ${tiene ? "#2F55A4" : "#E2E8F0"}` }}>
              <div className="text-2xl" style={{ filter: tiene ? "none" : "grayscale(1)", opacity: tiene ? 1 : 0.35 }}>{l.emoji}</div>
              <div className="text-[9px] font-semibold text-slate-700 truncate mt-0.5">{tiene ? l.nombre : "???"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DesafioReinoEstudiante({ gradoId, miReino }) {
  const [desafios, setDesafios] = useState([]);
  const [progresoPorDesafio, setProgresoPorDesafio] = useState({});
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.fetchDesafiosReino(gradoId).then(async (lista) => {
      const activos = lista.filter((d) => d.activo);
      setDesafios(activos);
      const progresos = {};
      for (const d of activos) { progresos[d.id] = await api.fetchProgresoDesafio(d); }
      setProgresoPorDesafio(progresos);
      setCargando(false);
    });
  }, [gradoId]);

  if (cargando || desafios.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="text-xs font-semibold text-slate-600 mb-2">⚔️ Desafío de tu Reino</div>
      {desafios.map((d) => {
        const filas = progresoPorDesafio[d.id] || [];
        const miFila = filas.find((f) => f.reino === miReino);
        return (
          <div key={d.id} className="bg-violet-50 rounded-xl p-3 mb-2">
            <div className="text-sm font-bold text-slate-800">{d.titulo}</div>
            {d.descripcion && <TextoEnriquecido html={d.descripcion} className="text-[11px] text-slate-500 mt-0.5" />}
            <div className="space-y-1.5 mt-2">
              {filas.slice(0, 4).map((f) => (
                <div key={f.reino}>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className={`font-semibold ${f.reino === miReino ? "text-violet-700" : "text-slate-500"}`}>{f.reino}{f.reino === miReino ? " (vos)" : ""}</span>
                    <span className="text-slate-400">{f.total}/{d.meta}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600" style={{ width: `${f.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CosmeticosEstudiante({ estudianteId, monedas, onMonedasActualizadas }) {
  const [catalogo, setCatalogo] = useState([]);
  const [poseidos, setPoseidos] = useState([]);
  const [equipados, setEquipados] = useState({ marco: null, titulo: null });
  const [cargando, setCargando] = useState(true);

  const cargar = () => {
    Promise.all([api.fetchCosmeticosCatalogo(), api.fetchCosmeticosEstudiante(estudianteId), api.fetchEquipadosEstudiante(estudianteId)]).then(([cat, pos, eq]) => {
      setCatalogo(cat.filter((c) => c.activo)); setPoseidos(pos); setEquipados(eq); setCargando(false);
    });
  };
  useEffect(() => { cargar(); }, [estudianteId]);

  if (cargando) return null;

  const idsPoseidos = new Set(poseidos.map((p) => p.cosmetico_id));

  const comprar = async (c) => {
    try {
      await api.comprarCosmetico(estudianteId, c);
      cargar();
      onMonedasActualizadas();
    } catch (e) {
      alert(e.message);
    }
  };

  const equipar = async (c) => {
    await api.equiparCosmetico(estudianteId, c.tipo, equipados[c.tipo]?.id === c.id ? null : c.id);
    cargar();
  };

  return (
    <div>
      <div className="text-xs font-semibold text-slate-600 mb-2">🎨 Personalización</div>
      <div className="grid grid-cols-2 gap-2">
        {catalogo.map((c) => {
          const tengo = idsPoseidos.has(c.id);
          const equipado = equipados[c.tipo]?.id === c.id;
          return (
            <div key={c.id} className="bg-slate-50 rounded-xl p-2.5 text-center">
              {c.tipo === "marco" ? (
                <div className="w-8 h-8 rounded-full border-4 mx-auto" style={{ borderColor: c.valor }} />
              ) : (
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-violet-100 text-violet-700 inline-block">{c.valor}</span>
              )}
              <div className="text-[11px] font-semibold text-slate-700 mt-1">{c.nombre}</div>
              {tengo ? (
                <button onClick={() => equipar(c)} className={`text-[10px] mt-1 px-2 py-1 rounded-full ${equipado ? "bg-violet-500 text-white" : "bg-white border border-slate-200 text-slate-500"}`}>
                  {equipado ? "✔ Equipado" : "Equipar"}
                </button>
              ) : (
                <button onClick={() => comprar(c)} disabled={monedas < c.costo_monedas} className="text-[10px] mt-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 disabled:opacity-40">
                  🪙 {c.costo_monedas}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {catalogo.length === 0 && <p className="text-xs text-slate-400">Todavía no hay cosméticos disponibles.</p>}
    </div>
  );
}

export function PreguntadosEstudiante({ estudianteId }) {
  const [categorias, setCategorias] = useState([]);
  const [coronas, setCoronas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [girando, setGirando] = useState(false);
  const [rotacion, setRotacion] = useState(0);
  const [categoriaElegida, setCategoriaElegida] = useState(null);
  const [pregunta, setPregunta] = useState(null);
  const [respondida, setRespondida] = useState(null); // { opcion, acierto, corona }
  const [cargandoPregunta, setCargandoPregunta] = useState(false);

  const [bloqueo, setBloqueo] = useState(null); // { bloqueado, mensaje, hasta }
  const cargar = () => {
    Promise.all([api.fetchTriviaCategorias(), api.fetchCoronasEstudiante(estudianteId), api.fetchTriviaBloqueoEstudiante(estudianteId)]).then(([cats, cor, blq]) => {
      setCategorias(cats); setCoronas(cor); setBloqueo(blq); setCargando(false);
    });
  };
  useEffect(() => { cargar(); }, [estudianteId]);

  const girar = () => {
    if (categorias.length === 0) return;
    sonidoGirar();
    setGirando(true);
    setCategoriaElegida(null);
    setPregunta(null);
    setRespondida(null);
    const elegidaIdx = Math.floor(Math.random() * categorias.length);
    const vueltasExtra = 4 * 360;
    const anguloPorSector = 360 / categorias.length;
    // Apunta al centro del sector elegido, en la parte de arriba de la ruleta
    const anguloFinal = 360 - (elegidaIdx * anguloPorSector + anguloPorSector / 2);
    setRotacion((prev) => prev + vueltasExtra + anguloFinal - (prev % 360));

    setTimeout(async () => {
      setGirando(false);
      const cat = categorias[elegidaIdx];
      setCategoriaElegida(cat);
      setCargandoPregunta(true);
      const p = await api.fetchPreguntaTriviaAleatoria(cat.id, estudianteId);
      setPregunta(p);
      setCargandoPregunta(false);
    }, 3200);
  };

  const bloqueoRespuesta = useRef(false); // evita que varios clics seguidos cuenten como varias respuestas
  useEffect(() => { bloqueoRespuesta.current = false; }, [pregunta]);
  const responder = async (opcionIdx) => {
    if (respondida || bloqueoRespuesta.current) return;
    bloqueoRespuesta.current = true;
    let r;
    try { r = await api.responderTrivia(estudianteId, pregunta, opcionIdx); } catch (e) { bloqueoRespuesta.current = false; return; }
    if (r.bloqueado) { setBloqueo({ bloqueado: true, mensaje: r.mensaje }); return; }
    setRespondida({ opcion: opcionIdx, ...r });
    if (r.corona) { sonidoLogro(); setCoronas((prev) => [...prev, pregunta.categoria_id]); }
    else if (r.acierto) sonidoAcierto();
    else sonidoError();
  };

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;

  if (bloqueo?.bloqueado) {
    return (
      <div className="text-center py-10">
        <div className="text-4xl mb-2">🔒</div>
        <p className="text-sm font-bold text-slate-700 mb-1">Preguntados está cerrado por ahora</p>
        <p className="text-sm text-slate-500 max-w-sm mx-auto">{bloqueo.mensaje || "Tu docente lo abrirá de nuevo."}</p>
        {bloqueo.hasta && <p className="text-xs text-slate-400 mt-2">Se abre de nuevo: {new Date(bloqueo.hasta).toLocaleString("es-CO", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</p>}
      </div>
    );
  }

  if (categorias.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-3xl mb-2">🎡</div>
        <p className="text-sm text-slate-400">Tu docente todavía no armó las categorías de Preguntados.</p>
      </div>
    );
  }

  const anguloPorSector = 360 / categorias.length;

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1 text-center">🎡 Preguntados</h3>
      <p className="text-xs text-slate-400 mb-4 text-center">Girá la ruleta, respondé, y ganá la corona de cada categoría acertando 3 seguidas.</p>

      {/* La ruleta */}
      <div className="relative mx-auto mb-4" style={{ width: 220, height: 220 }}>
        <div className="absolute left-1/2 -translate-x-1/2 z-10" style={{ top: -6 }}>
          <div style={{ width: 0, height: 0, borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "16px solid #0f1932" }} />
        </div>
        <svg viewBox="0 0 200 200" width={220} height={220} style={{ transition: girando ? "transform 3.1s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none", transform: `rotate(${rotacion}deg)` }}>
          {categorias.map((c, i) => {
            const a0 = (i * anguloPorSector - 90) * (Math.PI / 180);
            const a1 = ((i + 1) * anguloPorSector - 90) * (Math.PI / 180);
            const x0 = 100 + 95 * Math.cos(a0), y0 = 100 + 95 * Math.sin(a0);
            const x1 = 100 + 95 * Math.cos(a1), y1 = 100 + 95 * Math.sin(a1);
            const grande = anguloPorSector > 180 ? 1 : 0;
            const amitad = (i * anguloPorSector + anguloPorSector / 2 - 90) * (Math.PI / 180);
            const tx = 100 + 62 * Math.cos(amitad), ty = 100 + 62 * Math.sin(amitad);
            return (
              <g key={c.id}>
                <path d={`M100,100 L${x0},${y0} A95,95 0 ${grande} 1 ${x1},${y1} Z`} fill={c.color} stroke="#0f1932" strokeWidth="1.5" />
                <text x={tx} y={ty} fontSize="16" textAnchor="middle" dominantBaseline="middle">{c.emoji}</text>
              </g>
            );
          })}
          <circle cx="100" cy="100" r="16" fill="#0f1932" />
        </svg>
      </div>

      {!categoriaElegida && (
        <button disabled={girando} onClick={girar} className="block mx-auto text-sm font-semibold px-6 py-2.5 rounded-full bg-violet-500 text-white disabled:opacity-60">
          {girando ? "Girando…" : "🎡 Girar la ruleta"}
        </button>
      )}

      {categoriaElegida && (
        <div className="max-w-sm mx-auto">
          <div className="text-center mb-3">
            <span className="text-xs font-bold px-3 py-1 rounded-full text-white" style={{ background: categoriaElegida.color }}>{categoriaElegida.emoji} {categoriaElegida.nombre}</span>
          </div>

          {cargandoPregunta ? (
            <div className="text-sm text-slate-400 text-center">Cargando pregunta…</div>
          ) : !pregunta ? (
            <div className="text-center">
              <p className="text-sm text-slate-400 mb-3">Todavía no hay preguntas cargadas en esta categoría.</p>
              <button onClick={() => setCategoriaElegida(null)} className="text-xs font-semibold text-violet-500">← Girar de nuevo</button>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-sm font-semibold text-slate-800 mb-3">{pregunta.pregunta}</p>
              <div className="space-y-1.5">
                {pregunta.opciones.map((o, i) => {
                  let estilo = "bg-white text-slate-600 border border-slate-200";
                  if (respondida) {
                    if (i === pregunta.correcta) estilo = "bg-emerald-500 text-white";
                    else if (i === respondida.opcion) estilo = "bg-rose-500 text-white";
                  }
                  return (
                    <button key={i} disabled={!!respondida} onClick={() => responder(i)} className={`w-full text-left text-sm px-3 py-2 rounded-lg ${estilo}`}>
                      {o}
                    </button>
                  );
                })}
              </div>

              {respondida && (
                <div className="mt-3 text-center">
                  {respondida.corona ? (
                    <p className="text-sm font-bold text-amber-500">👑 ¡Corona de {categoriaElegida.nombre}! +15 monedas extra</p>
                  ) : respondida.acierto ? (
                    respondida.limite
                      ? <p className="text-sm font-semibold text-amber-600">¡Correcto! 🎯 Ya llegaste al tope de hoy en Preguntados ({respondida.tope || 100} XP). Sigue practicando: mañana vuelve a sumar.</p>
                      : <p className="text-sm font-semibold text-emerald-600">¡Correcto! +5 XP, +2 monedas</p>
                  ) : (
                    <p className="text-sm font-semibold text-rose-500">Fallaste — se corta la racha en esta categoría</p>
                  )}
                  <button onClick={() => { setCategoriaElegida(null); setPregunta(null); setRespondida(null); }} className="mt-2 text-xs font-semibold text-violet-500">Girar de nuevo →</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Vitrina de coronas */}
      <div className="mt-6 pt-4 border-t border-slate-100">
        <div className="text-xs font-semibold text-slate-600 mb-2">Tus coronas ({coronas.length}/{categorias.length})</div>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {categorias.map((c) => {
            const tiene = coronas.includes(c.id);
            return (
              <div key={c.id} className="rounded-xl p-2 text-center" style={{ background: tiene ? c.color : "#F1F5F9", opacity: tiene ? 1 : 0.5 }}>
                <div className="text-lg">{tiene ? "👑" : c.emoji}</div>
                <div className={`text-[9px] font-semibold truncate ${tiene ? "text-white" : "text-slate-400"}`}>{c.nombre}</div>
              </div>
            );
          })}
        </div>
        {coronas.length === categorias.length && categorias.length > 0 && (
          <p className="text-center text-xs font-bold text-amber-500 mt-3">🏆 ¡Completaste todas las coronas!</p>
        )}
      </div>
    </div>
  );
}

// El estudiante ve su propio código QR para abrir su tarjeta de la
// Comarca de Oakhaven en cualquier dispositivo, sin tener que iniciar
// sesión ahí — solo necesita la sesión activa de su grado.
export function MiComarcaEstudiante({ estudianteInfo }) {
  const [sesion, setSesion] = useState(null);
  const [reinoId, setReinoId] = useState(null);
  const [cargando, setCargando] = useState(true);

  // El Reino del estudiante (reino_actual/reino_original) es un NOMBRE
  // ("Los Ilusionistas"), no el id numérico que usa comarca_reinos en
  // esta sesión puntual — hay que buscar cuál fila de esta sesión
  // corresponde a ese nombre antes de poder armar el QR.
  useEffect(() => {
    if (!estudianteInfo?.grado_id) return;
    api.fetchSesionActivaDelGrado(estudianteInfo.grado_id).then(async (s) => {
      setSesion(s);
      if (s) {
        const nombreReino = estudianteInfo?.reino_actual || estudianteInfo?.reino_original;
        const reinosDeSesion = await api.fetchReinosDeSesion(s.id);
        const match = reinosDeSesion.find((r) => r.nombre === nombreReino);
        setReinoId(match?.id || null);
      }
      setCargando(false);
    });
  }, [estudianteInfo?.grado_id]);

  if (cargando) return <p className="text-sm text-slate-400">Cargando…</p>;

  if (!sesion) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-2">🏛️</div>
        <p className="text-sm text-slate-400">Tu docente todavía no abrió una sesión de la Comarca de Oakhaven para tu curso.</p>
      </div>
    );
  }

  if (!reinoId) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-2">🤔</div>
        <p className="text-sm text-slate-400">Hay una sesión activa, pero tu Reino no quedó armado en ella todavía — avisale a tu docente.</p>
      </div>
    );
  }

  const link = urlDeTarjeta(sesion.id, reinoId, estudianteInfo.id);

  return (
    <div className="text-center py-4">
      <div className="text-4xl mb-2">🏛️</div>
      <h3 className="font-bold text-slate-800 mb-1">Mi Comarca de Oakhaven</h3>
      <p className="text-xs text-slate-400 mb-4">Escaneá este código (o tocá el botón) para ver tu tarjeta con tus GP, FP y objetos.</p>
      <img src={urlQR(link)} alt="Código QR de tu tarjeta" className="mx-auto rounded-xl border border-slate-200 mb-4" />
      <a href={link} target="_blank" rel="noreferrer" className="inline-block text-sm font-semibold px-5 py-2.5 rounded-lg bg-violet-500 text-white">
        Ver mi tarjeta ahora
      </a>
    </div>
  );
}

// ==================== 🎴 Tarjeta de personaje (estilo "tarjeta de juego") ====================
// Banner con el personaje del estudiante en grande, y las 3 estadísticas
// clave (Vida, Experiencia, Oro) como barras de colores — inspirado en el
// modelo que mandó el docente. VIDA_MAX=100 porque así arranca cada
// estudiante y así se otorgan las pociones; si en algún momento la vida
// pudiera superar 100, solo hay que subir este número.
export const VIDA_MAX = 100;

export function TarjetaPersonajeEstudiante({ datos, estudianteInfo, avatarConfig, equipados, miRol, level, next, pct, personajeElegido, mejoras = [] }) {
  const vidaPct = Math.max(0, Math.min(100, Math.round(((datos.vida ?? 0) / VIDA_MAX) * 100)));
  const colorVida = vidaPct > 50 ? "#22C55E" : vidaPct > 20 ? "#F59E0B" : "#EF4444";
  // Lo que compró en "Mi Personaje": define su nivel, el equipo que se ve junto a él y su compañero.
  const conPieza = mejoras.filter((f) => f.mejora);
  const nv = nivelPersonaje(conPieza.length);
  const equipoPuesto = conPieza.filter((f) => f.mejora.slot !== "companero").map((f) => ({ emoji: f.mejora.emoji, nombre: f.mejora.nombre }));
  const companero = conPieza.find((f) => f.mejora.slot === "companero")?.mejora.emoji || null;

  return (
    <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-sm mb-4 bg-white">
      {/* Banner con el personaje */}
      <div className="relative h-32 sm:h-36 flex items-center justify-center" style={{ background: "linear-gradient(160deg, #223b74 0%, #17264D 55%, #0f1932 100%)" }}>
        <div aria-hidden className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle, #B8892B 1.5px, transparent 1.5px)", backgroundSize: "18px 18px" }} />
        <CapaEstrellasBanner nivel={nv.nivel} />
        {conPieza.length > 0 && <div className="absolute top-2 left-2 z-10"><InsigniaNivel nivel={nv.nivel} nombre={nv.nombre} color={nv.color} /></div>}
        {(() => {
          // El estudiante elige libremente cuál de los 14 personajes
          // quiere (sin importar el rol que le toque jugar) — si ya
          // eligió uno, se muestra ese dibujo en vez del avatar genérico.
          if (personajeElegido) {
            return (
              <div className="relative" style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.35))" }}>
                <Suspense fallback={<span className="text-6xl relative">🎓</span>}>
                  <PersonajeConMejoras rolKey={personajeElegido.rolKey} genero={personajeElegido.genero} size={120}
                    nivel={nv.nivel} equipo={equipoPuesto} companero={companero} />
                </Suspense>
              </div>
            );
          }
          if (avatarConfig) {
            return (
              <div className="relative" style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.35))" }}>
                <PersonajePreview config={avatarConfig} size={120} />
              </div>
            );
          }
          // Sin personaje todavía: si ya compró piezas, igual se ven (brillo y equipo) con el 🎓.
          if (conPieza.length > 0) {
            return (
              <div className="relative">
                <Suspense fallback={<span className="text-6xl relative">🎓</span>}>
                  <PersonajeConMejoras rolKey={null} size={120} nivel={nv.nivel} equipo={equipoPuesto} companero={companero} />
                </Suspense>
              </div>
            );
          }
          return <span className="text-6xl relative">🎓</span>;
        })()}
        {equipados.marco && (
          <div className="absolute top-2 right-2 text-[10px] font-bold px-2 py-1 rounded-full text-white" style={{ background: "rgba(0,0,0,0.35)" }}>🖼️ {equipados.marco.valor}</div>
        )}
      </div>

      <div className="p-4">
        {/* Foto de perfil pequeña (si tiene) + nombre + rol/título */}
        <div className="flex items-center gap-2.5 -mt-5 mb-3">
          <div className="shrink-0 flex items-center justify-center rounded-full overflow-hidden bg-white" style={{ width: 52, height: 52, border: "3px solid white", boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}>
            {estudianteInfo?.foto_url ? (
              <img src={estudianteInfo.foto_url} alt={datos.nombre} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl">🙂</span>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-7">
            <div className="text-base font-bold text-slate-800 truncate">{datos.nombre}</div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
              {equipados.titulo && <span className="font-semibold text-violet-500">✨ {equipados.titulo.valor}</span>}
              {miRol && <span className="font-semibold text-amber-600" title={miRol.descripcion || undefined}>👑 {miRol.nombre}</span>}
              <span className="text-slate-400">Grado {datos.grado_id} · {datos.grupo}</span>
            </div>
          </div>
        </div>

        {/* Barra de Vida */}
        <div className="rounded-full overflow-hidden relative mb-3" style={{ height: 28, background: "#F1F5F9" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${vidaPct}%`, background: colorVida }} />
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}>
            ❤️ {datos.vida ?? 0} VIDA
          </div>
        </div>

        {/* Experiencia y Oro */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl p-2.5" style={{ background: "#F3E8FF" }}>
            <div className="text-[9px] font-bold text-violet-500 uppercase tracking-wide mb-1">🧬 Experiencia</div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-violet-700 truncate">{level.name}</span>
              <span className="text-[10px] text-violet-500 shrink-0">{next ? `${datos.xp}/${next.min}` : "máx"}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white overflow-hidden">
              <div className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="rounded-2xl p-2.5 flex flex-col justify-center" style={{ background: "#FEF3C7" }}>
            <div className="text-[9px] font-bold text-amber-600 uppercase tracking-wide mb-1">🪙 Oro</div>
            <div className="text-xl font-bold text-amber-700">{datos.monedas}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
