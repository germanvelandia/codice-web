import * as api from "../lib/api";
import { fijarUsuarioPersistencia, useEstadoPersistente } from "../lib/api";
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { InstitucionModal } from "../screens/Institucion";
import { AdministracionModal } from "../screens/Administracion";
import { VistaInicio } from "../screens/Inicio";
import { VistaEstudiantesRiesgo } from "../screens/EstudiantesRiesgo";
import { VistaAlbumesDocente } from "../screens/AlbumesDocente";
import { VistaEntregasPorRevisar } from "../screens/EntregasPorRevisar";
import { VistaEstudiantes, VistaGrados, VistaReinos } from "../screens/Estudiantes";
import { VistaAsistencia } from "../screens/Asistencia";
import { BingoTool, CronometroTool, DadoTool, FormasExamenTool, GeneradorGruposTool, MarcadorPuntosTool, SelectorEstudianteTool, SemaforoTool, SorteoOrdenTool, VistaRuleta, VistaRuletaMonedas, VistaTemporizador } from "../screens/Herramientas";
import { VistaAccionesMasivas } from "../screens/AccionesMasivas";
import { VistaBanco } from "../screens/Banco";
import { VistaAlbum } from "../screens/Album";
import { VistaAnuncios } from "../screens/Anuncios";
import { VistaLogros } from "../screens/Logros";
import { VistaSalonHonor } from "../screens/SalonHonor";
import { VistaDiplomas } from "../screens/Diplomas";
import { SalaAvatares } from "../screens/SalaAvatares";
import { VistaRankingDiplomas } from "../screens/RankingDiplomas";
import { VistaGamificacionExtra } from "../screens/GamificacionExtra";
import { VistaConsignasCodice } from "../screens/ConsignasCodice";
import { VistaTriviaAdmin } from "../screens/TriviaAdmin";
import { VistaQuizVivoDocente } from "../screens/QuizVivo";
import { VistaRankingGanancias } from "../screens/RankingGanancias";
import { VistaRevisionTrivia } from "../screens/RevisionTrivia";
import { VistaRecompensasDocente } from "../screens/RecompensasDocente";
import { VistaObraDocente } from "../screens/ObraDocente";
import { VistaEncuestasDocente, VistaInformeImpacto } from "../screens/EncuestaInforme";
import { VistaBancoPreguntas } from "../screens/BancoPreguntas";
import { VistaRoles } from "../screens/Roles";
import { VistaCalificaciones } from "../screens/Calificaciones";
import { VistaCoevaluacion } from "../screens/Coevaluacion";
import { VistaRecuperaciones } from "../screens/Recuperaciones";
import { VistaGoogleCalendar } from "../screens/GoogleCalendar";
import { VistaVidaNota } from "../screens/VidaNota";
import { VistaImpresion } from "../screens/ImpresionPlanillas";
import { VistaMundoNota } from "../screens/MundoNota";
import { VistaTableroMundial } from "../screens/TableroMundial";
import { VistaPuntosConducta } from "../screens/PuntosConducta";
import { VistaReportes } from "../screens/Reportes";
import { VistaHorario } from "../screens/Horario";
import { VistaPlaneaciones } from "../screens/Planeaciones";
import { VistaTableroSemanal } from "../screens/TableroSemanal";
import { VistaRubricas } from "../screens/Rubricas";
import { VistaBiblioteca } from "../screens/Biblioteca";
import { VistaComarcaOakhaven } from "../screens/ComarcaOakhaven";
import { VistaAnotaciones } from "../screens/Anotaciones";
import { VistaInclusionGeneral } from "../screens/InclusionGeneral";
import { VistaBajasVida } from "../screens/BajasVida";
import { VistaCorregirNombres } from "../screens/CorregirNombres";
import { VistaNiveles } from "../screens/Niveles";
import { VistaObjetos } from "../screens/Objetos";
import { VistaDireccionCurso } from "../screens/DireccionCurso";
import { VistaGuiasEstudio } from "../screens/GuiasEstudio";
import { ModulosAdmin } from "../components/ModulosAdmin";
import { VistaActividadesProgramadas } from "../screens/ActividadesProgramadas";
import { VistaEvaluaciones } from "../screens/Evaluaciones";
import { VistaProyectosForja } from "../screens/TareasCalificables";
import { CLAVES_SOLO_ADMIN, MENU_PANEL, MENU_PANEL_GRUPOS, SidebarTarjetas, TarjetasMenuInicio, PantallaGrupoMenu } from "./MenuDocente";
import { MarcoSeccion, NOMBRES_HERRAMIENTAS } from "./comunes";

export function Panel({ session }) {
  // Lo que se recuerda al "Actualizar" es propio de cada docente.
  fijarUsuarioPersistencia(session.user.id);
  const [tab, setTab] = useEstadoPersistente("panel_seccion", "inicio");
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const [esAdmin, setEsAdmin] = useState(null); // null = todavía no se sabe
  const [previsualizandoDocente, setPrevisualizandoDocente] = useState(false);
  const esAdminEfectivo = esAdmin && !previsualizandoDocente;
  useEffect(() => { api.fetchMiPerfil().then((p) => setEsAdmin(!!p?.es_admin)); }, []);
  const [subTabHerramientas, setSubTabHerramientas] = useEstadoPersistente("panel_herramienta", "ruleta");
  const [grado, setGrado] = useEstadoPersistente("panel_estudiantes_curso", null);
  const [gradoActivo, setGradoActivo] = useEstadoPersistente("panel_curso_activo", null);
  const [periodoActivo, setPeriodoActivo] = useEstadoPersistente("panel_periodo_activo", "1");
  const [materias, setMaterias] = useState([]);
  const [materiaActiva, setMateriaActiva] = useEstadoPersistente("panel_materia_activa", null);
  const [reino, setReino] = useEstadoPersistente("panel_estudiantes_reino", null);
  const [modoLista, setModoLista] = useEstadoPersistente("panel_estudiantes_lista", false);
  const [grados, setGrados] = useState([]);
  const [institucionAbierta, setInstitucionAbierta] = useState(false);
  const [administracionAbierta, setAdministracionAbierta] = useState(false);
  const [institucion, setInstitucion] = useState(null);
  const [destinoBusqueda, setDestinoBusqueda] = useState(null);

  const irACalificacionesDesdeBusqueda = (estudiante) => {
    setTab("calificaciones");
    setDestinoBusqueda({ estudianteId: estudiante.id, gradoId: estudiante.grado_id, ts: Date.now() });
  };

  const cargarInstitucion = () => api.fetchInstitucion().then(setInstitucion);

  useEffect(() => {
    api.asegurarProfesor().then(() => api.asegurarGradosBase()).then(() => api.fetchGrados()).then((data) => {
      setGrados(data);
      setGradoActivo((prev) => (prev && data.some((g) => g.id === prev) ? prev : data[0]?.id || null));
    });
    api.fetchMaterias().then((data) => {
      setMaterias(data);
      setMateriaActiva((prev) => (prev && data.some((m) => m.id === prev) ? prev : data[0]?.id || null));
    });
    cargarInstitucion();
  }, []);

  const irA = (key) => {
    if (CLAVES_SOLO_ADMIN.includes(key) && !esAdminEfectivo) return;
    if (key.startsWith("herr_")) {
      setTab("herramientas");
      setSubTabHerramientas(key.slice(5));
      return;
    }
    setTab(key);
    if (key === "estudiantes") { setGrado(null); setReino(null); setModoLista(false); }
  };

  // Para que el menú resalte bien el ítem activo cuando estás en una
  // herramienta específica (en vez de mostrar "Herramientas" resaltado
  // en general sin distinguir cuál).
  const claveActivaMenu = tab === "herramientas" ? `herr_${subTabHerramientas}` : String(tab).startsWith("grupo:") ? "inicio" : tab;

  // Los docentes que no son admin no ven las opciones de administración, y los grupos que quedan vacíos se ocultan.
  const menuPanelVisible = esAdminEfectivo ? MENU_PANEL_GRUPOS : MENU_PANEL_GRUPOS
    .map((g) => ({ ...g, items: g.items.filter((it) => !CLAVES_SOLO_ADMIN.includes(it.key)) }))
    .filter((g) => g.items.length > 0);

  // Favoritos del docente (se recuerdan en este navegador, también al volver otro día)
  const claveFav = `codice_fav_${session.user.id}`;
  const [favoritos, setFavoritos] = useState(() => { try { const v = JSON.parse(localStorage.getItem(claveFav) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } });
  const alternarFavorito = (key) => setFavoritos((prev) => {
    const nuevo = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
    try { localStorage.setItem(claveFav, JSON.stringify(nuevo)); } catch { /* sin almacenamiento: no pasa nada */ }
    return nuevo;
  });

  // Si la sección recordada ya no existe (o cambiaste de rol), se vuelve a Inicio.
  // El chequeo de administrador espera a saber quién sos: antes de eso "esAdmin"
  // es null y una pantalla de administración recordada se perdería en cada F5.
  const seccionesValidas = ["inicio", "herramientas", ...MENU_PANEL.map((i) => i.key).filter((k) => !k.startsWith("herr_"))];
  useEffect(() => {
    if (!seccionesValidas.includes(tab) && !(String(tab).startsWith("grupo:") && menuPanelVisible.some((g) => "grupo:" + g.key === tab))) { setTab("inicio"); return; }
    if (esAdmin === null) return;
    if (!esAdminEfectivo && CLAVES_SOLO_ADMIN.includes(tab)) { setTab("inicio"); }
  }, [tab, esAdmin, esAdminEfectivo]);
  useEffect(() => {
    if (!NOMBRES_HERRAMIENTAS[subTabHerramientas]) setSubTabHerramientas("ruleta");
  }, [subTabHerramientas]);

  // Desde "Entregas por revisar": salta directo a Misiones o Proyectos/Forja,
  // ya con el curso, la materia y el periodo correctos seleccionados arriba.
  const irAGradoDesdeRevisar = (gradoId, materiaId, periodo, destino) => {
    setGradoActivo(gradoId);
    if (materiaId) setMateriaActiva(materiaId);
    if (periodo) setPeriodoActivo(String(periodo));
    setTab(destino);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#FBFBFD" }}>
      <SidebarTarjetas activo={claveActivaMenu} onCambiar={irA} email={session.user.email} institucion={institucion}
        onAdmin={() => setAdministracionAbierta(true)} onInstitucion={() => setInstitucionAbierta(true)}
        onSalir={() => supabase.auth.signOut()} onBuscarEstudiante={irACalificacionesDesdeBusqueda}
        esAdmin={esAdmin} esAdminEfectivo={esAdminEfectivo} previsualizandoDocente={previsualizandoDocente} onCambiarPrevisualizacion={setPrevisualizandoDocente}
        grupos={menuPanelVisible} favoritos={favoritos} onAlternarFavorito={alternarFavorito} menuAbierto={menuMovilAbierto} onCerrarMenu={(abrir) => setMenuMovilAbierto(!!abrir)} />

      {institucionAbierta && <InstitucionModal onClose={() => { setInstitucionAbierta(false); cargarInstitucion(); }} />}
      {administracionAbierta && <AdministracionModal onClose={() => setAdministracionAbierta(false)} />}

      <div className="flex-1 min-w-0 p-5 md:p-10">
        {tab === "inicio" && <VistaInicio onIrA={irA} contenidoMedio={<TarjetasMenuInicio grupos={menuPanelVisible} onIrA={irA} favoritos={favoritos} />} />}
        {String(tab).startsWith("grupo:") && (() => {
          const g = menuPanelVisible.find((x) => "grupo:" + x.key === tab);
          return g ? <PantallaGrupoMenu grupo={g} onIrA={irA} onVolver={() => setTab("inicio")} favoritos={favoritos} onAlternarFavorito={alternarFavorito} /> : null;
        })()}
        {tab === "entregasrevisar" && <MarcoSeccion zonaLabel="Académico — Entregas por revisar" icono="🎓"><VistaEntregasPorRevisar onIrAGrado={irAGradoDesdeRevisar} /></MarcoSeccion>}
        {tab === "estudiantes" && (
          <MarcoSeccion zonaLabel="Académico — Estudiantes" icono="🎓">
            {!grado && <VistaGrados onElegirGrado={(g) => { setGrado(g); setReino(null); setModoLista(true); }} />}
            {grado && !modoLista && !reino && (
              <VistaReinos
                gradoId={grado}
                onElegirReino={(r) => setReino(r)}
                onVerTodos={() => setModoLista(true)}
                onVolver={() => setGrado(null)}
              />
            )}
            {grado && (modoLista || reino) && (
              <VistaEstudiantes
                gradoId={grado}
                grados={grados}
                reinoFiltro={modoLista ? null : reino}
                onVolver={() => setGrado(null)}
                onVerGrupos={() => { setReino(null); setModoLista(false); }}
              />
            )}
          </MarcoSeccion>
        )}
        {tab === "asistencia" && grados.length > 0 && <MarcoSeccion zonaLabel="Académico — Asistencia" icono="🎓"><VistaAsistencia grados={grados} gradoActivo={gradoActivo} /></MarcoSeccion>}
        {tab === "herramientas" && grados.length > 0 && (
          <div className="rounded-[28px] p-1" style={{ background: "linear-gradient(135deg, #2F55A4, #B8892B)" }}>
            <div className="rounded-[24px] p-4 md:p-6" style={{ background: "linear-gradient(160deg, #17264D 0%, #223b74 100%)" }}>
              <div className="flex items-center gap-2.5 mb-4 px-1">
                <span className="text-2xl">🎮</span>
                <div>
                  <div className="text-[10px] font-extrabold tracking-wide uppercase" style={{ color: "#f1e7d5" }}>Zona de Herramientas</div>
                  <div className="text-lg font-extrabold text-white">{NOMBRES_HERRAMIENTAS[subTabHerramientas] || "Herramienta"}</div>
                </div>
              </div>
              <div className="rounded-2xl bg-white p-4 md:p-5">
                {subTabHerramientas === "ruleta" && <VistaRuleta grados={grados} gradoActivo={gradoActivo} />}
                {subTabHerramientas === "ruletamonedas" && <VistaRuletaMonedas grados={grados} gradoActivo={gradoActivo} />}
                {subTabHerramientas === "accionesmasivas" && <VistaAccionesMasivas grados={grados} gradoActivo={gradoActivo} />}
            {subTabHerramientas === "banco" && <VistaBanco />}
            {subTabHerramientas === "album" && <VistaAlbum />}
            {subTabHerramientas === "anuncios" && <VistaAnuncios grados={grados} />}
            {subTabHerramientas === "logros" && <VistaLogros />}
            {subTabHerramientas === "salonhonor" && <VistaSalonHonor grados={grados} />}
            {subTabHerramientas === "diplomas" && <VistaDiplomas grados={grados} gradoActivo={gradoActivo} />}
            {subTabHerramientas === "avatares" && <SalaAvatares esDocente />}
            {subTabHerramientas === "rankdiplomas" && <VistaRankingDiplomas grados={grados} gradoActivo={gradoActivo} />}
            {subTabHerramientas === "gamext" && <VistaGamificacionExtra grados={grados} />}
            {subTabHerramientas === "consignas" && <VistaConsignasCodice grados={grados} />}
            {subTabHerramientas === "trivia" && <VistaTriviaAdmin grados={grados} />}
            {subTabHerramientas === "quizvivo" && <VistaQuizVivoDocente />}
            {subTabHerramientas === "rankingganancias" && <VistaRankingGanancias grados={grados} />}
            {subTabHerramientas === "revisiontrivia" && <VistaRevisionTrivia grados={grados} />}
            {subTabHerramientas === "recompensas" && <VistaRecompensasDocente grados={grados} />}
            {subTabHerramientas === "obras" && <VistaObraDocente grados={grados} />}
            {subTabHerramientas === "encuestas" && <VistaEncuestasDocente grados={grados} />}
            {subTabHerramientas === "informe" && <VistaInformeImpacto grados={grados} />}
            {subTabHerramientas === "bancopreguntas" && <VistaBancoPreguntas grados={grados} />}
            {subTabHerramientas === "temporizador" && <VistaTemporizador />}
            {subTabHerramientas === "dado" && <DadoTool />}
            {subTabHerramientas === "cronometro" && <CronometroTool />}
            {subTabHerramientas === "semaforo" && <SemaforoTool />}
            {subTabHerramientas === "sorteoorden" && <SorteoOrdenTool grados={grados} />}
            {subTabHerramientas === "grupos" && <GeneradorGruposTool grados={grados} />}
            {subTabHerramientas === "marcador" && <MarcadorPuntosTool />}
            {subTabHerramientas === "selectorestudiante" && <SelectorEstudianteTool grados={grados} />}
                {subTabHerramientas === "bingo" && <BingoTool />}
                {subTabHerramientas === "formasexamen" && <FormasExamenTool />}
              </div>
            </div>
          </div>
        )}
        {tab === "roles" && <VistaRoles />}
        {tab === "calificaciones" && grados.length > 0 && <MarcoSeccion zonaLabel="Académico — Planillas" icono="🎓"><VistaCalificaciones grados={grados} destinoBusqueda={destinoBusqueda} gradoActivo={gradoActivo} materiaActiva={materiaActiva} /></MarcoSeccion>}
        {tab === "coevaluacion" && grados.length > 0 && <MarcoSeccion zonaLabel="Académico — Auto y coevaluación" icono="🪞"><VistaCoevaluacion grados={grados} gradoActivo={gradoActivo} /></MarcoSeccion>}
        {tab === "recuperaciones" && grados.length > 0 && <MarcoSeccion zonaLabel="Académico — Recuperaciones" icono="🎓"><VistaRecuperaciones grados={grados} gradoActivo={gradoActivo} materiaActiva={materiaActiva} /></MarcoSeccion>}
        {tab === "gcal" && <MarcoSeccion zonaLabel="Académico — Google Calendar" icono="📆"><VistaGoogleCalendar /></MarcoSeccion>}
        {tab === "vidanota" && grados.length > 0 && <MarcoSeccion zonaLabel="Gamificación — Vida → nota" icono="🩸"><VistaVidaNota grados={grados} gradoActivo={gradoActivo} materiaActiva={materiaActiva} /></MarcoSeccion>}
        {tab === "imprimir" && grados.length > 0 && <MarcoSeccion zonaLabel="Académico — Imprimir" icono="🖨️"><VistaImpresion grados={grados} gradoActivo={gradoActivo} materiaActiva={materiaActiva} /></MarcoSeccion>}
        {tab === "mundonota" && grados.length > 0 && <MarcoSeccion zonaLabel="Gamificación — Mundo → nota" icono="🧮"><VistaMundoNota grados={grados} gradoActivo={gradoActivo} materiaActiva={materiaActiva} /></MarcoSeccion>}
        {tab === "tablero" && grados.length > 0 && <MarcoSeccion zonaLabel="Gamificación — Tablero Mundial" icono="🌍"><VistaTableroMundial grados={grados} gradoActivo={gradoActivo} /></MarcoSeccion>}
        {tab === "puntosconducta" && <MarcoSeccion zonaLabel="Gamificación — Puntos por conducta" icono="🎮"><VistaPuntosConducta /></MarcoSeccion>}
        {tab === "reportes" && grados.length > 0 && <VistaReportes grados={grados} gradoActivo={gradoActivo} />}
        {tab === "horario" && grados.length > 0 && <VistaHorario grados={grados} />}
        {tab === "planeaciones" && grados.length > 0 && <MarcoSeccion zonaLabel="Planeación — Planeaciones" icono="🗺️"><VistaPlaneaciones grados={grados} gradoActivo={gradoActivo} periodoActivo={periodoActivo} materiaActiva={materiaActiva} /></MarcoSeccion>}
        {tab === "tablerosemanal" && grados.length > 0 && <MarcoSeccion zonaLabel="Planeación — Tablero Semanal" icono="🗺️"><VistaTableroSemanal grados={grados} /></MarcoSeccion>}
        {tab === "rubricas" && <MarcoSeccion zonaLabel="Planeación — Rúbricas" icono="🗺️"><VistaRubricas /></MarcoSeccion>}
        {tab === "biblioteca" && grados.length > 0 && <MarcoSeccion zonaLabel="Planeación — Biblioteca" icono="🗺️"><VistaBiblioteca grados={grados} gradoActivo={gradoActivo} /></MarcoSeccion>}
        {tab === "comarca" && grados.length > 0 && (
          <MarcoSeccion zonaLabel="Comarca de Oakhaven" icono="🏛️">
            <VistaComarcaOakhaven grados={grados} gradoActivo={gradoActivo} />
          </MarcoSeccion>
        )}
        {tab === "albumes" && <MarcoSeccion zonaLabel="Reconocimientos — Álbumes de colección" icono="📒"><VistaAlbumesDocente /></MarcoSeccion>}
        {tab === "riesgo" && grados.length > 0 && <MarcoSeccion zonaLabel="Convivencial — Estudiantes en riesgo" icono="🚨"><VistaEstudiantesRiesgo grados={grados} gradoActivo={gradoActivo} onIrA={irA} /></MarcoSeccion>}
        {tab === "anotaciones" && <MarcoSeccion zonaLabel="Convivencial — Anotaciones" icono="🤝"><VistaAnotaciones /></MarcoSeccion>}
        {tab === "inclusion" && <MarcoSeccion zonaLabel="Convivencial — Inclusión" icono="🤝"><VistaInclusionGeneral /></MarcoSeccion>}
        {tab === "bajasvida" && <MarcoSeccion zonaLabel="Convivencial — Bajas de Vida" icono="🤝"><VistaBajasVida /></MarcoSeccion>}
        {tab === "corregirnombres" && <VistaCorregirNombres />}
        {tab === "niveles" && <VistaNiveles />}
        {tab === "objetos" && <VistaObjetos grados={grados} gradoActivo={gradoActivo} />}
        {tab === "direccioncurso" && <MarcoSeccion zonaLabel="Convivencial — Dirección de Curso" icono="🤝"><VistaDireccionCurso grados={grados} gradoActivo={gradoActivo} esAdmin={esAdminEfectivo} /></MarcoSeccion>}
        {tab === "guiasestudio" && <MarcoSeccion zonaLabel="Planeación — Guías de Estudio" icono="🗺️"><VistaGuiasEstudio grados={grados} gradoActivo={gradoActivo} periodoActivo={periodoActivo} materiaActiva={materiaActiva} /></MarcoSeccion>}
        {tab === "modulosestudio" && grados.length > 0 && <MarcoSeccion zonaLabel="Planeación — Módulos de Estudio" icono="🗺️"><ModulosAdmin grados={grados} /></MarcoSeccion>}
        {tab === "actividadesprogramadas" && <MarcoSeccion zonaLabel="Planeación — Actividades Programadas" icono="🗺️"><VistaActividadesProgramadas grados={grados} /></MarcoSeccion>}
        {tab === "evaluaciones" && grados.length > 0 && <MarcoSeccion zonaLabel="Académico — Evaluaciones" icono="🎓"><VistaEvaluaciones grados={grados} gradoActivo={gradoActivo} periodoActivo={periodoActivo} materiaActiva={materiaActiva} /></MarcoSeccion>}
        {tab === "proyectosforja" && grados.length > 0 && <MarcoSeccion zonaLabel="Académico — La Forja" icono="🎓"><VistaProyectosForja grados={grados} gradoActivo={gradoActivo} periodoActivo={periodoActivo} materiaActiva={materiaActiva} /></MarcoSeccion>}
      </div>
    </div>
  );
}
