import React, { Suspense, useEffect, useState } from "react";
import { registrarIngresoMundo } from "../lib/mundoNotaApi";
import * as api from "../lib/api";
import { registrarAccesoUnaVez } from "../lib/accesos";
import { sonidoLogro } from "../lib/sonidos";
import { cerrarSesionEstudiante } from "../lib/sesionEstudiante";
import { nextLevel } from "../lib/gamification";
import { MapaTerritoriosEstudiante } from "../screens/MapaTerritorios";
import { EvaluacionesEstudiante } from "../screens/EvaluacionEstudiante";
import { GuiasEstudiante } from "../screens/GuiasEstudio";
import { ModulosEstudiante } from "../components/Modulosestudiante";
import { VistaPersonaje } from "../screens/Personaje";
import { SalaAvatares } from "../screens/SalaAvatares";
import { HistorialPuntosEstudiante } from "../screens/HistorialPuntos";
import { ObjetosEstudiante } from "../screens/Objetos";
import { EncuestaEstudiante } from "../screens/EncuestaInforme";
import { TableroMundialEstudiante } from "../screens/TableroMundial";
import { DiplomasEstudiante } from "../screens/RankingDiplomas";
import { CoevaluacionEstudiante } from "../screens/Coevaluacion";
import { QuizVivoEstudiante } from "../screens/QuizVivo";
import { SidebarTarjetasEstudiante } from "./MenuEstudiante";
import { AlbumEstudiante, BancoEstudiante, CosmeticosEstudiante, DesafioReinoEstudiante, LogrosEstudiante, MiComarcaEstudiante, MicroMisionesEstudiante, PreguntadosEstudiante, RankingEstudiante, SalonHonorEstudiante, TarjetaPersonajeEstudiante } from "./EstudianteJuego";
import { AnunciosEstudiante, BibliotecaEstudiante, CodiceEstudiante, ValorSemanaEstudiante } from "./EstudianteComunidad";
import { AvisoRendimiento, ForjaEstudiante, HistorialEstudiante, MisNotas, ProyectosEstudiante } from "./EstudianteAcademico";
import { FondoCastillo, MarcoSeccion, VistaMundo } from "./comunes";
import { PortalAcudiente } from "./PortalAcudiente";

export function PortalEstudiante() {
  const [tipoAcceso, setTipoAcceso] = useState("estudiante"); // "estudiante" | "acudiente"
  const [codigo, setCodigo] = useState(() => localStorage.getItem("codice_estudiante_codigo") || "");
  const [datos, setDatos] = useState(null);
  const [estudianteInfo, setEstudianteInfo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [vista, setVista] = useState("inicio");
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const irAEstudiante = (key) => { setVista(key); };
  // Cada día que el estudiante entra al Mundo queda registrado (una sola llamada por día en este navegador)
  useEffect(() => { if (vista === "mundo" && estudianteInfo?.id) registrarIngresoMundo(); }, [vista, estudianteInfo?.id]);
  const [nuevosLogros, setNuevosLogros] = useState([]);
  const [equipados, setEquipados] = useState({ marco: null, titulo: null });
  const [avatarConfig, setAvatarConfig] = useState(null);
  const [miRol, setMiRol] = useState(null);
  const [personajeElegido, setPersonajeElegido] = useState(null);
  const [mejoras, setMejoras] = useState([]);
  const [nivelesConfig, setNivelesConfig] = useState(null);

  useEffect(() => { api.fetchNivelesParaJuego().then(setNivelesConfig); }, []);

  const consultar = async () => {
    if (!codigo.trim()) return;
    setCargando(true);
    setError("");
    try {
      const res = await api.consultarPortalEstudiante(codigo);
      if (!res) { setError("Código no encontrado. Verifica con tu docente."); setDatos(null); }
      else {
        setDatos(res);
        localStorage.setItem("codice_estudiante_codigo", codigo.trim());
        const info = await api.fetchEstudiantePorCodigo(codigo);
        setEstudianteInfo(info);
        if (info) {
          registrarAccesoUnaVez(info.id);
          api.verificarYOtorgarLogros(info.id).then((nuevos) => { if (nuevos.length > 0) { sonidoLogro(); setNuevosLogros(nuevos); } });
          api.fetchEquipadosEstudiante(info.id).then(setEquipados);
          api.fetchAvatarConfigsMultiples([info.id]).then((mapa) => setAvatarConfig(mapa[info.id] || null));
          api.fetchMiRol(info.id).then(setMiRol);
          api.fetchPersonajeElegido(info.id).then(setPersonajeElegido).catch(() => {});
          api.fetchMejorasDeEstudiante(info.id).then(setMejoras).catch(() => {});
        }
      }
    } catch (e) {
      setError("Ocurrió un error: " + e.message);
    }
    setCargando(false);
  };

  // Si ya había una sesión guardada (mismo navegador), la restaura sola
  // al cargar la página — así un refresco no saca al estudiante afuera.
  useEffect(() => {
    if (codigo && !datos) consultar();
  }, []);

  const cerrarSesion = () => {
    if (!confirm("¿Cerrar sesión? Vas a tener que ingresar tu código de nuevo la próxima vez.")) return;
    cerrarSesionEstudiante();
    localStorage.removeItem("codice_estudiante_codigo");
    setCodigo("");
    setDatos(null);
    setEstudianteInfo(null);
    setVista("inicio");
  };

  if (datos) {
    const { level, next, pct } = nextLevel(datos.xp || 0, nivelesConfig);
    const totalAsis = Number(datos.total_asistencia) || 0;
    const pctAsis = totalAsis > 0 ? Math.round((Number(datos.presentes) / totalAsis) * 100) : null;

    return (
      <div className="min-h-screen flex flex-col md:flex-row" style={{ background: "#FBFBFD" }}>
        {nuevosLogros.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setNuevosLogros((prev) => prev.slice(1))}>
            <div onClick={(e) => e.stopPropagation()} className="rounded-3xl p-6 text-center max-w-xs" style={{ background: "linear-gradient(160deg, #1c2f5e, #0f1932)", border: "2px solid #F59E0B" }}>
              <div className="text-[11px] font-bold text-amber-300 uppercase tracking-widest mb-2">¡Nuevo logro desbloqueado!</div>
              <div className="text-6xl mb-2">{nuevosLogros[0].emoji}</div>
              <div className="text-lg font-bold text-white">{nuevosLogros[0].nombre}</div>
              {nuevosLogros[0].descripcion && <div className="text-xs text-violet-200 mt-1">{nuevosLogros[0].descripcion}</div>}
              <button onClick={() => setNuevosLogros((prev) => prev.slice(1))} className="mt-4 text-sm font-semibold px-5 py-2 rounded-full bg-amber-400 text-slate-900">
                {nuevosLogros.length > 1 ? `Genial (${nuevosLogros.length - 1} más)` : "¡Genial!"}
              </button>
            </div>
          </div>
        )}
        <SidebarTarjetasEstudiante activo={vista} onCambiar={irAEstudiante} monedas={datos.monedas} gradoId={datos.grado_id} onCerrarSesion={cerrarSesion}
          menuAbierto={menuMovilAbierto} onCerrarMenu={(abrir) => setMenuMovilAbierto(!!abrir)} />

        <div className="flex-1 min-w-0 p-5 md:p-10">
          {vista === "inicio" && (
            <>
              <TarjetaPersonajeEstudiante
                datos={datos} estudianteInfo={estudianteInfo} avatarConfig={avatarConfig}
                equipados={equipados} miRol={miRol} level={level} next={next} pct={pct} personajeElegido={personajeElegido} mejoras={mejoras}
              />

              <ValorSemanaEstudiante />
              {estudianteInfo && <DesafioReinoEstudiante gradoId={estudianteInfo.grado_id} miReino={estudianteInfo.reino_actual || estudianteInfo.reino_original || "Sin grupo"} />}
              {estudianteInfo && <AvisoRendimiento estudianteId={estudianteInfo.id} />}

              <div className="bg-blue-50 rounded-xl p-3 mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-700">📋 Asistencia</span>
                <span className="text-sm font-bold text-blue-600">{pctAsis ?? "—"}{pctAsis !== null && "%"}</span>
              </div>
              <div className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
                Presentes: {datos.presentes} · Retardos: {datos.retardos} · Faltas injustificadas: {datos.faltas_injustificadas} · Faltas justificadas: {datos.faltas_justificadas}
              </div>
            </>
          )}

          {vista === "misiones" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Estudio — Misiones" icono="🎓">
              <div className="mb-4"><MapaTerritoriosEstudiante estudianteId={estudianteInfo.id} nombre={datos.nombre} xp={datos.xp} /></div>
              <MicroMisionesEstudiante estudianteId={estudianteInfo.id} onCambio={() => consultar()} />
            </MarcoSeccion>
          )}

          {vista === "evaluaciones" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Estudio — Evaluaciones" icono="🎓">
              <EvaluacionesEstudiante estudianteId={estudianteInfo.id} gradoId={estudianteInfo.grado_id} />
            </MarcoSeccion>
          )}

          {vista === "proyectos" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Estudio — Proyectos" icono="🎓"><ProyectosEstudiante estudianteId={estudianteInfo.id} gradoId={estudianteInfo.grado_id} /></MarcoSeccion>
          )}

          {vista === "forja" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Estudio — Forja" icono="🎓"><ForjaEstudiante estudianteId={estudianteInfo.id} gradoId={estudianteInfo.grado_id} /></MarcoSeccion>
          )}

          {vista === "guias" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Estudio — Guías" icono="🎓"><GuiasEstudiante gradoId={estudianteInfo.grado_id} estudianteId={estudianteInfo.id} /></MarcoSeccion>
          )}

          {vista === "modulos" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Estudio — Módulos" icono="🎓"><ModulosEstudiante estudianteId={estudianteInfo.id} gradoId={estudianteInfo.grado_id} onPremio={() => consultar()} /></MarcoSeccion>
          )}

          {vista === "codice" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Estudio — Códice" icono="🎓"><CodiceEstudiante estudianteId={estudianteInfo.id} gradoId={estudianteInfo.grado_id} /></MarcoSeccion>
          )}

          {vista === "biblioteca" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Estudio — Biblioteca" icono="🎓"><BibliotecaEstudiante gradoId={estudianteInfo.grado_id} /></MarcoSeccion>
          )}

          {vista === "notas" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Estudio — Notas" icono="🎓"><MisNotas estudianteId={estudianteInfo.id} /></MarcoSeccion>
          )}

          {vista === "personaje" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Diversión — Personaje" icono="🎡"><VistaPersonaje estudianteId={estudianteInfo.id} monedas={datos.monedas} onMonedasActualizadas={() => consultar()} /></MarcoSeccion>
          )}

          {vista === "salaavatares" && (
            <MarcoSeccion zonaLabel="Diversión — Sala de avatares" icono="🎭"><SalaAvatares /></MarcoSeccion>
          )}

          {vista === "mundo" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Diversión — Mundo" icono="🎡"><Suspense fallback={<p className="text-sm text-slate-400">Cargando…</p>}><VistaMundo estudianteInfo={estudianteInfo} datos={datos} onProgreso={() => consultar()} onIrAPersonaje={() => setVista("personaje")} /></Suspense></MarcoSeccion>
          )}

          {vista === "historial" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Estudio — Historial" icono="🎓"><HistorialPuntosEstudiante estudianteId={estudianteInfo.id} /></MarcoSeccion>
          )}

          {vista === "recompensas" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Comunidad — Recompensas" icono="🏆">
              <BancoEstudiante estudianteId={estudianteInfo.id} monedas={datos.monedas} onMonedasActualizadas={() => consultar()} />
              <ObjetosEstudiante estudianteId={estudianteInfo.id} monedas={datos.monedas} onMonedasActualizadas={() => consultar()} />
            </MarcoSeccion>
          )}

          {vista === "preguntados" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Diversión — Preguntados" icono="🎡"><PreguntadosEstudiante estudianteId={estudianteInfo.id} /></MarcoSeccion>
          )}

          {vista === "encuesta" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Mi cuenta — Encuesta" icono="📝"><EncuestaEstudiante /></MarcoSeccion>
          )}

          {vista === "tablero" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Diversión — Tablero Mundial" icono="🧭"><TableroMundialEstudiante /></MarcoSeccion>
          )}

          {vista === "misdiplomas" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Mi cuenta — Mis diplomas" icono="🎖️"><DiplomasEstudiante nombre={estudianteInfo.nombre} /></MarcoSeccion>
          )}

          {vista === "coevaluacion" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Mi cuenta — Evaluarnos" icono="🪞"><CoevaluacionEstudiante /></MarcoSeccion>
          )}

          {vista === "quizvivo" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Diversión — Quiz en vivo" icono="⚡"><QuizVivoEstudiante estudianteId={estudianteInfo.id} /></MarcoSeccion>
          )}

          {vista === "album" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Comunidad — Álbum" icono="🏆"><AlbumEstudiante estudianteId={estudianteInfo.id} monedas={datos.monedas} onMonedasActualizadas={() => consultar()} /></MarcoSeccion>
          )}

          {vista === "comarca" && estudianteInfo && <MarcoSeccion zonaLabel="Comunidad — Mi Comarca" icono="🏆"><MiComarcaEstudiante estudianteInfo={estudianteInfo} /></MarcoSeccion>}

          {vista === "ranking" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Comunidad — Ranking" icono="🏆"><RankingEstudiante estudianteId={estudianteInfo.id} gradoId={estudianteInfo.grado_id} /></MarcoSeccion>
          )}

          {vista === "salonhonor" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Comunidad — Salón de Honor" icono="🏆"><SalonHonorEstudiante estudianteId={estudianteInfo.id} /></MarcoSeccion>
          )}

          {vista === "perfil" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Mi cuenta — Perfil" icono="👤">
              <h3 className="font-bold text-slate-800 mb-3">👤 Mi perfil</h3>
              <div className="space-y-2 text-sm mb-5">
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-400">Nombre</span><span className="font-semibold text-slate-700">{datos.nombre}</span></div>
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-400">Grado</span><span className="font-semibold text-slate-700">{datos.grado_id}</span></div>
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-400">Grupo</span><span className="font-semibold text-slate-700">{datos.grupo}</span></div>
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-400">Nivel</span><span className="font-semibold text-violet-600">{level.name}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">XP total</span><span className="font-semibold text-slate-700">{datos.xp}</span></div>
              </div>
              <LogrosEstudiante estudianteId={estudianteInfo.id} />
              <div className="mt-5 pt-4 border-t border-slate-100">
                <CosmeticosEstudiante estudianteId={estudianteInfo.id} monedas={datos.monedas} onMonedasActualizadas={() => consultar()} />
              </div>
              <HistorialEstudiante estudianteId={estudianteInfo.id} />
            </MarcoSeccion>
          )}

          {vista === "mensajes" && estudianteInfo && (
            <MarcoSeccion zonaLabel="Mensajes" icono="✉️"><AnunciosEstudiante gradoId={estudianteInfo.grado_id} /></MarcoSeccion>
          )}

          <button onClick={() => { setDatos(null); setCodigo(""); setEstudianteInfo(null); setVista("inicio"); }} className="w-full text-xs text-violet-500 mt-4">← Consultar otro código</button>
        </div>
      </div>
    );
  }

  if (tipoAcceso === "acudiente") {
    return <PortalAcudiente onElegirEstudiante={() => setTipoAcceso("estudiante")} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative py-6">
      <FondoCastillo />
      <div className="w-full max-w-sm px-4">
        <div className="flex gap-1 rounded-full bg-slate-100 p-1 mb-5">
          <button onClick={() => setTipoAcceso("estudiante")} className="flex-1 text-xs font-semibold py-2 rounded-full bg-white shadow-sm">🎓 Soy estudiante</button>
          <button onClick={() => setTipoAcceso("acudiente")} className="flex-1 text-xs font-semibold py-2 rounded-full text-slate-500">👪 Soy acudiente</button>
        </div>
        <div className="text-center mb-5">
          <div className="text-4xl mb-1">🎓</div>
          <h1 className="text-2xl font-bold" style={{ color: "#17264D", fontFamily: "Georgia, serif" }}>CÓDICE</h1>
          <p className="text-slate-400 text-xs mt-1">Tu aventura de aprendizaje</p>
        </div>
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <p className="text-sm text-slate-500 text-center mb-4">Ingresa el código de acceso que te dio tu docente para ver tu progreso.</p>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Ej: AB3D9K" maxLength={6}
            className="w-full text-center text-lg font-mono font-bold tracking-widest rounded-lg px-3 py-3 mb-3 border border-slate-200 outline-none" />
          {error && <p className="text-xs text-rose-500 mb-2 text-center">{error}</p>}
          <button disabled={cargando} onClick={consultar} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
            {cargando ? "Consultando…" : "Ver mi progreso"}
          </button>
        </div>
      </div>
    </div>
  );
}
