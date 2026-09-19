import React from "react";
import {
  Home, Users, ClipboardCheck, BookOpen, Swords, Hammer, FileText, CalendarDays,
  Landmark, Puzzle, BarChart3, Wrench, BookText, ScrollText, Library, Archive,
  TrendingUp, Trophy, Gift, Image, CircleHelp, Palette, User,
} from "lucide-react";

// Cada tarjeta: fondo pastel del círculo + color más saturado del ícono,
// combinando siempre la misma familia de color (ej: verde claro + verde oscuro).
const PALETA = [
  { fondo: "#DCFCE7", icono: "#15803D" }, // verde
  { fondo: "#DBEAFE", icono: "#1D4ED8" }, // azul
  { fondo: "#FCE7F3", icono: "#BE185D" }, // rosa
  { fondo: "#FEF3C7", icono: "#B45309" }, // ámbar
  { fondo: "#FEE2E2", icono: "#B91C1C" }, // rojo
  { fondo: "#EDE9FE", icono: "#6D28D9" }, // violeta
  { fondo: "#CCFBF1", icono: "#0F766E" }, // teal
  { fondo: "#FFEDD5", icono: "#C2410C" }, // naranja
  { fondo: "#E0E7FF", icono: "#4338CA" }, // índigo
  { fondo: "#CFFAFE", icono: "#0E7490" }, // cian
  { fondo: "#F3E8FF", icono: "#7E22CE" }, // púrpura
  { fondo: "#F1F5F9", icono: "#475569" }, // gris
];

function TarjetaMenu({ Icono, colores, tituloLinea1, tituloLinea2, onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200 px-4 py-3.5 text-left hover:border-slate-300 hover:shadow-sm transition-all">
      <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: colores.fondo }}>
        <Icono size={20} strokeWidth={2} color={colores.icono} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold text-slate-800 leading-tight truncate">{tituloLinea1}</div>
        {tituloLinea2 && <div className="text-sm font-bold text-slate-800 leading-tight truncate">{tituloLinea2}</div>}
      </div>
    </button>
  );
}

function CuadriculaTarjetas({ items, onIr }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" style={{ background: "#FAFAFA" }}>
      {items.map((it, i) => (
        <TarjetaMenu key={it.key} Icono={it.Icono} colores={PALETA[i % PALETA.length]}
          tituloLinea1={it.linea1} tituloLinea2={it.linea2} onClick={() => onIr(it.key)} />
      ))}
    </div>
  );
}

/* ==================== Inicio del docente ==================== */
export function InicioDocenteTarjetas({ onIr }) {
  const items = [
    { key: "estudiantes", Icono: Users, linea1: "Gestión de", linea2: "Estudiantes" },
    { key: "asistencia", Icono: ClipboardCheck, linea1: "Registro de", linea2: "Asistencia" },
    { key: "calificaciones", Icono: BookOpen, linea1: "Planillas de", linea2: "Calificaciones" },
    { key: "evaluaciones", Icono: Swords, linea1: "Misiones y", linea2: "Evaluaciones" },
    { key: "proyectosforja", Icono: Hammer, linea1: "La Forja —", linea2: "Proyectos" },
    { key: "planeaciones", Icono: FileText, linea1: "Planeación de", linea2: "Clases" },
    { key: "tablerosemanal", Icono: CalendarDays, linea1: "Tablero", linea2: "Semanal" },
    { key: "comarca", Icono: Landmark, linea1: "Comarca de", linea2: "Oakhaven" },
    { key: "bancocontenido", Icono: Puzzle, linea1: "Banco de", linea2: "Contenido" },
    { key: "reportes", Icono: BarChart3, linea1: "Reportes e", linea2: "Indicadores" },
    { key: "biblioteca", Icono: Library, linea1: "Biblioteca de", linea2: "Recursos" },
    { key: "herramientas", Icono: Wrench, linea1: "Caja de", linea2: "Herramientas" },
  ];
  return <CuadriculaTarjetas items={items} onIr={onIr} />;
}

/* ==================== Inicio del estudiante ==================== */
export function InicioEstudianteTarjetas({ onIr }) {
  const items = [
    { key: "codice", Icono: BookText, linea1: "Mi", linea2: "Códice" },
    { key: "notas", Icono: ScrollText, linea1: "Mis", linea2: "Notas" },
    { key: "misiones", Icono: Swords, linea1: "Mis", linea2: "Misiones" },
    { key: "forja", Icono: Hammer, linea1: "La", linea2: "Forja" },
    { key: "guias", Icono: BookOpen, linea1: "Guías de", linea2: "Estudio" },
    { key: "biblioteca", Icono: Library, linea1: "Mi", linea2: "Biblioteca" },
    { key: "proyectos", Icono: Archive, linea1: "Mis", linea2: "Proyectos" },
    { key: "comarca", Icono: Landmark, linea1: "Mi", linea2: "Comarca" },
    { key: "bancocontenido", Icono: Puzzle, linea1: "Juegos de", linea2: "Contenido" },
    { key: "ranking", Icono: TrendingUp, linea1: "Ranking del", linea2: "Curso" },
    { key: "salonhonor", Icono: Trophy, linea1: "Salón de", linea2: "Honor" },
    { key: "recompensas", Icono: Gift, linea1: "Mis", linea2: "Recompensas" },
    { key: "album", Icono: Image, linea1: "Mi", linea2: "Álbum" },
    { key: "preguntados", Icono: CircleHelp, linea1: "Preguntados", linea2: null },
    { key: "personaje", Icono: Palette, linea1: "Mi", linea2: "Personaje" },
    { key: "perfil", Icono: User, linea1: "Mi", linea2: "Perfil" },
  ];
  return <CuadriculaTarjetas items={items} onIr={onIr} />;
}
