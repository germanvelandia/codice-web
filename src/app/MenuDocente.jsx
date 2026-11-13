import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

export const MENU_PANEL_GRUPOS = [
  {
    key: "inicio_grupo", label: "Inicio", icono: "🏠", items: [
      { key: "inicio", label: "Inicio", icono: "🏠" },
      { key: "entregasrevisar", label: "Entregas por revisar", icono: "📝" },
    ],
  },
  {
    key: "miclase", label: "Mi clase", icono: "🎓", items: [
      { key: "estudiantes", label: "Estudiantes", icono: "🏰" },
      { key: "asistencia", label: "Asistencia", icono: "📋" },
      { key: "calificaciones", label: "Planillas", icono: "📖" },
      { key: "imprimir", label: "Imprimir planillas e informes", icono: "🖨️" },
      { key: "evaluaciones", label: "Evaluaciones", icono: "📝" },
      { key: "recuperaciones", label: "Recuperaciones", icono: "♻️" },
      { key: "proyectosforja", label: "La Forja", icono: "🔨" },
      { key: "coevaluacion", label: "Auto y coevaluación", icono: "🪞" },
    ],
  },
  {
    key: "planeacion", label: "Planear", icono: "🗺️", items: [
      { key: "planeaciones", label: "Planeaciones", icono: "📝" },
      { key: "tablerosemanal", label: "Tablero Semanal", icono: "🗓️" },
      { key: "horario", label: "Agenda", icono: "🗓️" },
      { key: "gcal", label: "Google Calendar", icono: "📆" },
      { key: "actividadesprogramadas", label: "Actividades Programadas", icono: "🎮" },
      { key: "rubricas", label: "Rúbricas", icono: "🎯" },
      { key: "guiasestudio", label: "Guías de Estudio", icono: "📘" },
      { key: "modulosestudio", label: "Módulos de Estudio", icono: "🧭" },
      { key: "biblioteca", label: "Biblioteca", icono: "📚" },
    ],
  },
  {
    key: "evaluar", label: "Evaluar y preguntas", icono: "🗂️", items: [
      { key: "herr_bancopreguntas", label: "Banco de Preguntas", icono: "🗂️" },
      { key: "herr_formasexamen", label: "Formas de Examen (A/B/C/D)", icono: "📝" },
      { key: "herr_consignas", label: "Consignas del Códice", icono: "📜" },
      { key: "herr_trivia", label: "Preguntados", icono: "🎡" },
      { key: "herr_revisiontrivia", label: "Revisión de Preguntados (autoclic)", icono: "🛡️" },
      { key: "herr_quizvivo", label: "Quiz en vivo", icono: "⚡" },
    ],
  },
  {
    key: "convivencial", label: "Convivencia e inclusión", icono: "🤝", items: [
      { key: "riesgo", label: "Estudiantes en riesgo", icono: "🚨" },
      { key: "anotaciones", label: "Anotaciones", icono: "🗒️" },
      { key: "inclusion", label: "Inclusión", icono: "🧩" },
      { key: "bajasvida", label: "Bajas de Vida", icono: "📉" },
      { key: "direccioncurso", label: "Dirección de Curso", icono: "🎓" },
    ],
  },
  {
    key: "gamificacion", label: "Gamificación", icono: "🎮", items: [
      { key: "comarca", label: "Comarca de Oakhaven", icono: "🏛️" },
      { key: "tablero", label: "Tablero Mundial", icono: "🌍" },
      { key: "puntosconducta", label: "Puntos por conducta", icono: "⚖️" },
      { key: "mundonota", label: "Mundo → nota", icono: "🧮" },
      { key: "detectives", label: "Detectives del Códice", icono: "🕵️" },
      { key: "vidanota", label: "Vida → nota de comportamiento", icono: "🩸" },
      { key: "herr_accionesmasivas", label: "Acciones Masivas", icono: "🎯" },
      { key: "herr_recompensas", label: "Recompensas de estudiantes", icono: "🎁" },
      { key: "herr_obras", label: "Gran Obra del curso", icono: "🏗️" },
      { key: "herr_gamext", label: "Desafíos/Misiones/Cosméticos", icono: "🕹️" },
      { key: "niveles", label: "Niveles", icono: "🏅" },
      { key: "objetos", label: "Objetos", icono: "🎒" },
      { key: "roles", label: "Roles", icono: "🎭" },
    ],
  },
  {
    key: "reconocimientos", label: "Reconocimientos", icono: "🏆", items: [
      { key: "herr_logros", label: "Logros", icono: "🏆" },
      { key: "herr_salonhonor", label: "Salón de Honor", icono: "🥇" },
      { key: "herr_diplomas", label: "Diplomas", icono: "🏅" },
      { key: "herr_rankdiplomas", label: "Ranking → diplomas", icono: "🏆" },
      { key: "herr_rankingganancias", label: "Ranking de ganancias (XP/oro)", icono: "🏅" },
      { key: "herr_album", label: "Álbum", icono: "🖼️" },
      { key: "albumes", label: "Álbumes de colección", icono: "📒" },
      { key: "herr_avatares", label: "Sala de avatares", icono: "🎭" },
      { key: "herr_banco", label: "Banco", icono: "🏦" },
      { key: "herr_ruletamonedas", label: "Ruleta de Monedas", icono: "🪙" },
    ],
  },
  {
    key: "herramientas_grupo", label: "En el aula", icono: "🎲", items: [
      { key: "herr_ruleta", label: "Ruleta", icono: "🎡" },
      { key: "herr_dado", label: "Dado", icono: "🎲" },
      { key: "herr_cronometro", label: "Cronómetro", icono: "⏲️" },
      { key: "herr_temporizador", label: "Temporizador", icono: "⏱️" },
      { key: "herr_semaforo", label: "Semáforo", icono: "🚦" },
      { key: "herr_sorteoorden", label: "Sorteo de Orden/Parejas", icono: "🔀" },
      { key: "herr_grupos", label: "Generador de Grupos", icono: "👥" },
      { key: "herr_marcador", label: "Marcador de Puntos", icono: "🔢" },
      { key: "herr_selectorestudiante", label: "Selector de Estudiante", icono: "🎯" },
      { key: "herr_bingo", label: "Bingo de Repaso", icono: "🎯" },
      { key: "herr_anuncios", label: "Anuncios", icono: "📣" },
    ],
  },
  {
    key: "informes", label: "Informes y ajustes", icono: "📊", items: [
      { key: "reportes", label: "Reportes", icono: "📊" },
      { key: "herr_informe", label: "Informe de impacto", icono: "📊" },
      { key: "herr_encuestas", label: "Encuesta de satisfacción", icono: "📝" },
      { key: "corregirnombres", label: "Corregir Nombres", icono: "🪪" },
    ],
  },
];

// Lista plana — se sigue usando donde hace falta el conjunto completo sin agrupar.
export const MENU_PANEL = MENU_PANEL_GRUPOS.flatMap((g) => g.items);

export const CLAVES_SOLO_ADMIN = ["corregirnombres", "niveles", "objetos", "horario", "roles", "reportes"];

export function BuscadorEstudiantesGlobal({ onSeleccionar }) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) { setResultados([]); return; }
    setBuscando(true);
    const id = setTimeout(() => {
      api.buscarEstudiantesGlobal(query).then((r) => { setResultados(r); setBuscando(false); setAbierto(true); });
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  const elegir = (est) => {
    onSeleccionar(est);
    setQuery("");
    setResultados([]);
    setAbierto(false);
  };

  return (
    <div className="relative">
      <input value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => resultados.length && setAbierto(true)}
        placeholder="🔍 Buscar estudiante…"
        className="w-full text-xs rounded-full px-3 py-2 border border-slate-200 outline-none bg-slate-50 focus:bg-white" />
      {abierto && (query.trim().length >= 2) && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-100 max-h-64 overflow-y-auto" onMouseLeave={() => setAbierto(false)}>
          {buscando ? (
            <div className="text-xs text-slate-400 p-3">Buscando…</div>
          ) : resultados.length === 0 ? (
            <div className="text-xs text-slate-400 p-3">Sin resultados.</div>
          ) : (
            resultados.map((r) => (
              <button key={r.id} onClick={() => elegir(r)} className="w-full text-left px-3 py-2 text-xs hover:bg-violet-50 flex justify-between items-center">
                <span className="text-slate-700">{r.nombre}</span>
                <span className="text-slate-400">Grado {r.grado_id}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Tarjeta de un ítem del menú lateral — mismo lenguaje visual que las
// tarjetas del resto de la app (círculo de color + texto), apiladas
// verticalmente contra el fondo oscuro del menú.
export function TarjetaMenuLateral({ icono, label, activo, onClick, fondo, color, sub, esFavorito, onAlternarFavorito }) {
  return (
    <div className={`group relative w-full flex items-center rounded-xl mb-1 transition-all ${activo ? "shadow-md" : "hover:bg-white/10"}`} style={activo ? { background: "#1F7AF0" } : undefined}>
      <button onClick={onClick} className="flex-1 min-w-0 flex items-center gap-2.5 px-2.5 py-2 text-left">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm" style={{ background: activo ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)" }}>
          {icono}
        </div>
        <span className="min-w-0">
          <span className={`block text-sm font-bold leading-tight ${activo ? "text-white" : "text-[#E8EEF8]"}`}>{label}</span>
          {sub && <span className={`block text-[10px] ${activo ? "text-white/70" : "text-white/40"}`}>{sub}</span>}
        </span>
      </button>
      {onAlternarFavorito && (
        <button onClick={(e) => { e.stopPropagation(); onAlternarFavorito(); }} title={esFavorito ? "Quitar de favoritos" : "Agregar a favoritos"}
          className={`shrink-0 pr-2.5 text-sm ${esFavorito ? "text-amber-400" : "text-white/30 sm:opacity-0 sm:group-hover:opacity-100 hover:text-amber-300"} ${activo && !esFavorito ? "!text-white/60" : ""}`}>
          {esFavorito ? "★" : "☆"}
        </button>
      )}
    </div>
  );
}

// Menú en tarjetas para la página de Inicio: cada grupo con sus secciones.
export const COLORES_GRUPO = {
  miclase: "#2F55A4", convivencial: "#0E9F8E", planeacion: "#B8892B", evaluar: "#0EA5E9",
  gamificacion: "#7C3AED", reconocimientos: "#D97706", herramientas_grupo: "#E0552E", informes: "#475569",
};

export function TarjetasMenuInicio({ grupos, onIrA, favoritos = [] }) {
  const [busqueda, setBusqueda] = useState("");
  const refBuscar = React.useRef(null);
  const norm = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = norm(busqueda.trim());
  const todos = grupos.filter((g) => g.key !== "inicio_grupo");
  const todasLasSecciones = grupos.flatMap((g) => g.items);
  // Atajo de teclado: Ctrl/Cmd + K enfoca el buscador de funciones.
  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); refBuscar.current?.focus(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const coincidencias = q ? todos.map((g) => ({ ...g, items: g.items.filter((it) => norm(it.label).includes(q) || norm(g.label).includes(q)) })).filter((g) => g.items.length > 0) : [];
  const esMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform || "");

  const Tarjeta = ({ it, color }) => (
    <button onClick={() => onIrA(it.key)} className="flex items-center gap-3 text-left rounded-xl bg-white px-3 py-3 min-h-[68px] hover:shadow-md hover:-translate-y-0.5 transition-all" style={{ border: `1px solid ${color}33`, boxShadow: "0 1px 2px rgba(15,25,50,0.04)" }}>
      <span className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: color + "1A" }}>{it.icono}</span>
      <span className="text-[13px] font-bold leading-tight text-slate-800 min-w-0">{it.label}</span>
    </button>
  );

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2 font-extrabold italic text-xl" style={{ color: "#17264D" }}>
          <span className="grid grid-cols-2 gap-0.5 w-6 h-6">{["#2F55A4", "#1B9A59", "#F5A524", "#2F55A4"].map((c, i) => <span key={i} className="rounded-sm" style={{ background: c }} />)}</span>
          Catálogo de funciones
        </div>
        <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 w-full sm:w-96" style={{ border: "1px solid #CFDAEE" }}>
          <span className="text-slate-400">🔍</span>
          <input ref={refBuscar} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Busca una función…" className="flex-1 min-w-0 text-sm outline-none bg-transparent" />
          <span className="hidden sm:inline text-[11px] font-bold text-slate-500 bg-slate-100 rounded-md px-1.5 py-0.5">{esMac ? "⌘ K" : "Ctrl K"}</span>
        </div>
      </div>
      {q ? (
        coincidencias.length === 0 ? <p className="text-sm text-slate-400">No hay funciones con ese nombre.</p> : (
          <div className="space-y-3">
            {coincidencias.map((g) => {
              const color = COLORES_GRUPO[g.key] || "#2F55A4";
              return (
                <div key={g.key} className="rounded-2xl p-3" style={{ background: color + "12", border: `1px solid ${color}22` }}>
                  <div className="text-sm font-extrabold mb-2" style={{ color }}>{g.icono} {g.label}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">{g.items.map((it) => <Tarjeta key={it.key} it={it} color={color} />)}</div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <>
          {favoritos.length > 0 && (
            <div className="mb-5 rounded-2xl p-3" style={{ background: "#FFF7E0", border: "1px solid #F5D98A" }}>
              <div className="text-sm font-extrabold text-amber-700 mb-2">⭐ Mis favoritos</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                {favoritos.map((k) => todasLasSecciones.find((it) => it.key === k)).filter(Boolean).map((it) => <Tarjeta key={it.key} it={it} color="#D97706" />)}
              </div>
            </div>
          )}
          {/* Solo un ícono y el nombre de cada grupo; al hacer clic se abre su menú de funciones */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {todos.map((g) => {
              const color = COLORES_GRUPO[g.key] || "#2F55A4";
              return (
                <button key={g.key} onClick={() => onIrA("grupo:" + g.key)} title={`${g.items.length} ${g.items.length === 1 ? "función" : "funciones"}`}
                  className="group flex flex-col items-center justify-center gap-3 rounded-3xl bg-white px-4 py-7 hover:-translate-y-1 hover:shadow-xl transition-all"
                  style={{ border: `1px solid ${color}33`, boxShadow: "0 2px 6px rgba(15,25,50,0.05)" }}>
                  <span className="w-20 h-20 rounded-3xl flex items-center justify-center text-5xl group-hover:scale-105 transition-transform" style={{ background: `linear-gradient(135deg, ${color}26, ${color}0D)` }}>{g.icono}</span>
                  <span className="text-base font-extrabold text-center leading-tight" style={{ color: "#17264D" }}>{g.label}</span>
                  <span className="h-1 w-10 rounded-full" style={{ background: color }} />
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Pantalla propia de una tarjeta: se abre al tocar el grupo en el Inicio y muestra sus opciones.
export function PantallaGrupoMenu({ grupo, onIrA, onVolver, favoritos = [], onAlternarFavorito }) {
  const color = COLORES_GRUPO[grupo.key] || "#2F55A4";
  return (
    <div className="max-w-[1500px] mx-auto">
      <div className="relative rounded-2xl overflow-hidden mb-4 px-4 py-3.5 md:px-5 flex items-center gap-3" style={{ background: `linear-gradient(120deg, ${color}18 0%, #FFFFFF 70%)`, border: `1px solid ${color}33` }}>
        <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: `linear-gradient(180deg, ${color}, #1B9A59)` }} />
        <span className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0 ml-1" style={{ background: color + "22" }}>{grupo.icono}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color }}>Catálogo de funciones › {grupo.items.length} {grupo.items.length === 1 ? "función" : "funciones"}</div>
          <h1 className="text-xl md:text-2xl font-extrabold italic leading-tight" style={{ color: "#17264D" }}>{grupo.label}</h1>
        </div>
        <button onClick={onVolver} className="text-xs font-bold px-3 py-1.5 rounded-full bg-white shrink-0" style={{ color, border: `1px solid ${color}55` }}>← Inicio</button>
      </div>
      <div className="rounded-2xl p-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5" style={{ background: color + "12", border: `1px solid ${color}22` }}>
        {grupo.items.map((it) => {
          const fav = favoritos.includes(it.key);
          return (
            <div key={it.key} className="relative group">
              <button onClick={() => onIrA(it.key)} className="w-full flex items-center gap-3 text-left rounded-xl bg-white px-3 py-3 min-h-[68px] hover:shadow-md hover:-translate-y-0.5 transition-all" style={{ border: `1px solid ${color}33` }}>
                <span className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: color + "1A" }}>{it.icono}</span>
                <span className="text-[13px] font-bold leading-tight text-slate-800 pr-6 min-w-0">{it.label}</span>
              </button>
              {onAlternarFavorito && (
                <button onClick={() => onAlternarFavorito(it.key)} title={fav ? "Quitar de favoritos" : "Agregar a favoritos"}
                  className={`absolute top-2 right-2.5 text-base ${fav ? "text-amber-400" : "text-slate-300 hover:text-amber-400"}`}>{fav ? "★" : "☆"}</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SidebarTarjetas({ activo, onCambiar, email, institucion, onAdmin, onInstitucion, onSalir, onBuscarEstudiante, esAdmin, esAdminEfectivo, previsualizandoDocente, onCambiarPrevisualizacion, grupos, favoritos = [], onAlternarFavorito, menuAbierto, onCerrarMenu, menuFijo = false, onAlternarMenuFijo }) {
  const [nombreDocente, setNombreDocente] = useState("");
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombreTemp, setNombreTemp] = useState("");
  const [buscarMenu, setBuscarMenu] = useState("");
  // Grupos desplegados — por defecto, solo el que contiene la sección
  // activa; los demás quedan colapsados hasta que se les haga clic.
  const [gruposAbiertos, setGruposAbiertos] = useState(() => {
    const inicial = grupos.find((g) => g.items.some((it) => it.key === activo));
    return new Set(inicial ? [inicial.key] : []);
  });
  const toggleGrupo = (key) => setGruposAbiertos((prev) => {
    const nuevo = new Set(prev);
    if (nuevo.has(key)) nuevo.delete(key); else nuevo.add(key);
    return nuevo;
  });
  // Si la sección activa cambia a una de un grupo todavía cerrado, ese
  // grupo se abre solo (por ejemplo, al entrar por un atajo o al volver).
  useEffect(() => {
    const contenedor = grupos.find((g) => g.items.some((it) => it.key === activo));
    if (contenedor && !gruposAbiertos.has(contenedor.key)) {
      setGruposAbiertos((prev) => new Set(prev).add(contenedor.key));
    }
  }, [activo, grupos.length]); // grupos.length: el grupo "Administración" aparece recién cuando se sabe que sos admin

  useEffect(() => { api.fetchMiPerfil().then((p) => setNombreDocente(p?.nombre || "")); }, []);

  const guardarNombre = async () => {
    const valor = nombreTemp.trim();
    if (!valor) { setEditandoNombre(false); return; }
    try {
      await api.guardarMiNombre(valor);
      setNombreDocente(valor);
      setEditandoNombre(false);
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
  };

  const elegir = (key) => { onCambiar(key); onCerrarMenu?.(); };

  const contenido = (
    <div className="relative h-full flex flex-col" style={{ background: "linear-gradient(180deg, #0B3F94 0%, #082B69 55%, #061E4D 100%)" }}>
      {onAlternarMenuFijo && <button onClick={onAlternarMenuFijo} title="Ocultar el menú fijo" className="hidden lg:flex absolute top-2 right-2 z-10 w-6 h-6 items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 text-sm">«</button>}
      <div className="p-3 pb-2">
        <button onClick={() => elegir("inicio")} className="flex items-center gap-2.5 mb-2 px-1 text-left w-full">
          {(institucion?.logo_url || institucion?.imagen_menu_url) ? (
            <img src={institucion.logo_url || institucion.imagen_menu_url} alt="Escudo" className="object-contain shrink-0" style={{ width: 46, height: 46 }} />
          ) : (
            <span className="text-3xl shrink-0">🧭</span>
          )}
          <span className="min-w-0">
            <span className="block text-white text-[15px] font-extrabold leading-tight">{(institucion?.nombre && institucion.nombre !== "Institución Educativa") ? institucion.nombre : "CÓDICE"}</span>
            <span className="block text-[10px] text-white/60 leading-tight mt-0.5">Construimos una convivencia de excelencia</span>
          </span>
        </button>

        <div className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 mb-2" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div className="relative shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg bg-white/90">👤<span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2" style={{ background: "#3DDC84", borderColor: "#0B3F94" }} /></div>
          <div className="min-w-0">
            <div className="text-white text-sm font-extrabold truncate">{nombreDocente || (esAdminEfectivo ? "Administrador" : "Docente")}</div>
            <div className="text-[11px] text-white/60 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: "#3DDC84" }} />En línea</div>
          </div>
        </div>

        <BuscadorEstudiantesGlobal onSeleccionar={(r) => { onBuscarEstudiante(r); onCerrarMenu?.(); }} />
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <TarjetaMenuLateral icono="🏠" label="Inicio" activo={activo === "inicio"} onClick={() => elegir("inicio")} fondo="#E8EEF8" />
        <TarjetaMenuLateral icono="📝" label="Entregas por revisar" activo={activo === "entregasrevisar"} onClick={() => elegir("entregasrevisar")} />

        <input value={buscarMenu} onChange={(e) => setBuscarMenu(e.target.value)} placeholder="🔎 Buscar opción…"
          className="w-full text-xs rounded-full px-3 py-1.5 mt-1 mb-1 bg-white/10 text-white placeholder-white/40 outline-none border border-white/10 focus:border-white/30" />

        {buscarMenu.trim() ? (
          (() => {
            const norm = (t) => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const q = norm(buscarMenu.trim());
            const res = grupos.flatMap((g) => g.items.map((it) => ({ ...it, grupo: g.label }))).filter((it) => it.key !== "inicio" && it.key !== "entregasrevisar" && (norm(it.label).includes(q) || norm(it.grupo).includes(q)));
            return res.length === 0 ? <p className="text-[11px] text-white/50 px-2 py-2">Nada con ese nombre.</p> : res.map((it) => (
              <TarjetaMenuLateral key={it.key} icono={it.icono} label={it.label} sub={it.grupo} activo={activo === it.key} onClick={() => { setBuscarMenu(""); elegir(it.key); }} />
            ));
          })()
        ) : (<>
        {favoritos.length > 0 && (
          <div className="mt-2">
            <div className="px-2.5 py-1 mb-1 text-[9px] font-bold uppercase tracking-wide" style={{ color: "#F5C451" }}>⭐ Favoritos</div>
            {favoritos.map((k) => grupos.flatMap((g) => g.items).find((it) => it.key === k)).filter(Boolean).map((it) => (
              <TarjetaMenuLateral key={it.key} icono={it.icono} label={it.label} activo={activo === it.key} onClick={() => elegir(it.key)} esFavorito onAlternarFavorito={() => onAlternarFavorito?.(it.key)} />
            ))}
          </div>
        )}

        {grupos.filter((g) => g.key !== "inicio_grupo").map((grupo) => {
          const abierto = gruposAbiertos.has(grupo.key);
          return (
            <div key={grupo.key} className="mt-2">
              <button onClick={() => toggleGrupo(grupo.key)} className="w-full flex items-center justify-between px-2.5 py-1 mb-1 rounded-lg hover:bg-white/5">
                <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "#829aca" }}>{grupo.icono} {grupo.label}</span>
                <span className="text-[8px]" style={{ color: "#829aca" }}>{abierto ? "▾" : "▸"}</span>
              </button>
              {abierto && grupo.items.map((it) => (
                <TarjetaMenuLateral key={it.key} icono={it.icono} label={it.label} activo={activo === it.key} onClick={() => elegir(it.key)}
                  esFavorito={favoritos.includes(it.key)} onAlternarFavorito={() => onAlternarFavorito?.(it.key)} />
              ))}
            </div>
          );
        })}
        </>)}
      </div>

      <div className="p-3 pt-2 border-t border-white/10">
        {esAdmin && (
          <button onClick={() => onCambiarPrevisualizacion((v) => !v)}
            className={`w-full text-center text-[10px] font-bold px-2.5 py-1.5 rounded-full border mb-2 ${previsualizandoDocente ? "bg-amber-400 text-slate-900 border-amber-400" : "border-white/20 text-violet-200"}`}
            title="Como administrador, podés previsualizar la app tal como la ve un docente regular, sin perder tu permiso real.">
            {previsualizandoDocente ? "👤 Viendo como docente" : "🔍 Ver como docente"}
          </button>
        )}
        <div className="flex items-center gap-1 mb-2 px-1">
          {editandoNombre ? (
            <>
              <input value={nombreTemp} onChange={(e) => setNombreTemp(e.target.value)} autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") guardarNombre(); if (e.key === "Escape") setEditandoNombre(false); }}
                placeholder="Tu nombre" className="text-[11px] bg-transparent border-b border-violet-400 text-violet-100 outline-none px-1 flex-1 min-w-0" />
              <button onClick={guardarNombre} className="text-[10px] text-emerald-400">✔</button>
              <button onClick={() => setEditandoNombre(false)} className="text-[10px] text-violet-400/60">✕</button>
            </>
          ) : (
            <button onClick={() => { setNombreTemp(nombreDocente); setEditandoNombre(true); }} className="text-[10px] text-violet-300/70 truncate hover:text-violet-200 flex-1 text-left" title="Tocá para editar tu nombre">
              {nombreDocente || "+ Agregar tu nombre"} <span className="opacity-60">✏️</span>
            </button>
          )}
        </div>
        <div className="flex items-center justify-around">
          <button onClick={onAdmin} className="text-base" title={esAdminEfectivo ? "Docentes y mi cuenta" : "Mi cuenta"}>👤</button>
          {esAdminEfectivo && <button onClick={onInstitucion} className="text-base" title="Institución">⚙️</button>}
          <button onClick={onSalir} className="text-base" title="Cerrar sesión">🚪</button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Escritorio: menú lateral fijo (se puede ocultar con «) */}
      {menuFijo && <aside className="hidden lg:block fixed left-0 top-0 bottom-0 w-[270px] z-30 shadow-xl">{contenido}</aside>}

      {/* Barra superior con hamburguesa + cajón deslizante (móvil, o escritorio con el menú fijo oculto) */}
      <div className={`w-full sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-2.5 ${menuFijo ? "lg:hidden" : ""}`} style={{ background: "#0B3F94" }}>
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => ((typeof window !== "undefined" && window.innerWidth >= 1024 && onAlternarMenuFijo) ? onAlternarMenuFijo() : onCerrarMenu?.(true))} className="text-white text-xl shrink-0" title="Menú">☰</button>
          <button onClick={() => elegir("inicio")} className="flex items-center gap-2 shrink-0">
            <span className="text-lg">🧭</span>
            <span className="text-white text-sm font-bold tracking-[0.12em]">CÓDICE</span>
          </button>
          {activo !== "inicio" && (
            <span className="text-[#E8EEF8] text-xs font-semibold truncate pl-3 border-l border-white/20">
              {(grupos.flatMap((g) => g.items).find((it) => it.key === activo) || {}).icono} {(grupos.flatMap((g) => g.items).find((it) => it.key === activo) || {}).label}
            </span>
          )}
        </div>
        {activo !== "inicio" && (
          <button onClick={() => elegir("inicio")} className="text-[11px] font-bold px-3 py-1.5 rounded-full shrink-0" style={{ background: "#E8EEF8", color: "#17264D" }}>🏠 Inicio</button>
        )}
      </div>
      {menuAbierto && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => onCerrarMenu?.()} />
          <div className="fixed left-0 top-0 bottom-0 z-50 w-[280px] shadow-xl">{contenido}</div>
        </>
      )}
    </>
  );
}
