import React from "react";
import {
  Home, Users, ClipboardCheck, BookOpen, FileText, Calendar, Clock, Award,
  Image, Gift, Trophy, TrendingUp, TrendingDown, Wrench, HelpCircle, Star,
  Edit, BarChart, Package, Shield, Heart, Puzzle, Palette, Archive, User,
  Settings, ClipboardList, GraduationCap, Hammer, Smile, ChevronLeft, LayoutGrid,
} from "lucide-react";

// Un ícono de línea por cada sección que ya existe en la plataforma —
// tanto de grupo como de elemento individual. Elegidos deliberadamente
// entre los nombres MÁS clásicos y antiguos de la librería (evitando
// variantes nuevas tipo "X2"/"X3" o combinaciones recientes), porque
// no hay forma de verificar en este entorno qué versión exacta de
// lucide-react tenés instalada. Si algún día se agrega una sección
// nueva y no está acá, se usa LayoutGrid como respaldo genérico (nunca
// rompe el build, solo se ve menos específico).
const ICONOS_ITEM = {
  inicio: Home,
  entregasrevisar: ClipboardList,
  estudiantes: Users,
  asistencia: ClipboardCheck,
  calificaciones: BookOpen,
  evaluaciones: Award,
  proyectosforja: Hammer,
  planeaciones: FileText,
  tablerosemanal: Calendar,
  rubricas: Star,
  guiasestudio: BookOpen,
  actividadesprogramadas: Smile,
  biblioteca: BookOpen,
  anotaciones: Edit,
  inclusion: Heart,
  bajasvida: TrendingDown,
  direccioncurso: GraduationCap,
  corregirnombres: User,
  niveles: Award,
  objetos: Package,
  horario: Clock,
  roles: Settings,
  reportes: BarChart,
  herramientas: Wrench,
  comarca: Shield,
  bancocontenido: Puzzle,
  // estudiante
  codice: BookOpen,
  notas: FileText,
  misiones: Award,
  forja: Hammer,
  guias: BookOpen,
  proyectos: Archive,
  historial: Archive,
  ranking: TrendingUp,
  salonhonor: Trophy,
  recompensas: Gift,
  album: Image,
  preguntados: HelpCircle,
  personaje: Palette,
  perfil: User,
};

const ICONOS_GRUPO = {
  inicio_grupo: Home,
  academico: GraduationCap,
  convivencial: Heart,
  administracion: Settings,
  herramientas_grupo: Wrench,
  estudio: GraduationCap,
  comunidad: Trophy,
  diversion: Smile,
  cuenta: User,
};

function obtenerIcono(key, esGrupo) {
  return (esGrupo ? ICONOS_GRUPO[key] : ICONOS_ITEM[key]) || LayoutGrid;
}

// Reparte el label en dos líneas de forma pareja, para que el texto en
// negrita quede prolijo dentro de la tarjeta (igual que "Facultad de" +
// nombre en el diseño original).
function partirEnDosLineas(label) {
  const palabras = label.split(" ");
  if (palabras.length <= 1) return [label, null];
  const mitad = Math.ceil(palabras.length / 2);
  return [palabras.slice(0, mitad).join(" "), palabras.slice(mitad).join(" ")];
}

const PALETA = [
  { fondo: "#DCFCE7", icono: "#15803D" }, { fondo: "#DBEAFE", icono: "#1D4ED8" },
  { fondo: "#FCE7F3", icono: "#BE185D" }, { fondo: "#FEF3C7", icono: "#B45309" },
  { fondo: "#FEE2E2", icono: "#B91C1C" }, { fondo: "#EDE9FE", icono: "#6D28D9" },
  { fondo: "#CCFBF1", icono: "#0F766E" }, { fondo: "#FFEDD5", icono: "#C2410C" },
  { fondo: "#E0E7FF", icono: "#4338CA" }, { fondo: "#CFFAFE", icono: "#0E7490" },
  { fondo: "#F3E8FF", icono: "#7E22CE" }, { fondo: "#F1F5F9", icono: "#475569" },
];

function TarjetaMenu({ Icono, colores, label, onClick }) {
  const [linea1, linea2] = partirEnDosLineas(label);
  return (
    <button onClick={onClick}
      className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200 px-4 py-3.5 text-left hover:border-slate-300 hover:shadow-sm transition-all">
      <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: colores.fondo }}>
        <Icono size={20} strokeWidth={2} color={colores.icono} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold text-slate-800 leading-tight truncate">{linea1}</div>
        {linea2 && <div className="text-sm font-bold text-slate-800 leading-tight truncate">{linea2}</div>}
      </div>
    </button>
  );
}

/* ==================== Navegación de 2 niveles: Grupos → Elementos ====================
   Reemplaza la barra de navegación de arriba. Recibe la MISMA estructura
   de grupos que ya usaba la app (MENU_PANEL_GRUPOS / MENU_CODICE_GRUPOS)
   y arma la cuadrícula sola — no hay que mantener una lista aparte.
   grupoAbierto/onCambiarGrupo se manejan afuera para que el padre pueda
   mostrar el grupo abierto como una pantalla propia, sin mezclarlo con
   el resto del contenido de Inicio. */
// Para usar como accionSuperior de VistaInicio — el link para volver al
// primer nivel de secciones, ubicado junto a la fecha / Valor de la Semana.
export function EnlaceTodasLasSecciones({ onCambiarGrupo, variante = "oscura" }) {
  const estilos = variante === "oscura" ? "text-violet-200 hover:text-white" : "text-violet-500 hover:text-violet-700";
  return (
    <button onClick={() => onCambiarGrupo(null)} className={`flex items-center gap-1 text-xs font-semibold mb-2 ${estilos}`}>
      <ChevronLeft size={14} /> Todas las secciones
    </button>
  );
}

export function NavegacionPorTarjetas({ grupos, onIr, grupoAbierto, onCambiarGrupo }) {
  // Grupos con un solo elemento van directo como tarjeta (sin nivel intermedio).
  const gruposVisibles = grupos.filter((g) => g.key !== "inicio_grupo");
  const tarjetasNivel1 = gruposVisibles.flatMap((g) => g.items.length === 1 ? [{ ...g.items[0], esGrupo: false }] : [{ key: g.key, label: g.label, esGrupo: true }]);

  if (grupoAbierto) {
    const grupo = grupos.find((g) => g.key === grupoAbierto);
    if (!grupo) return null;
    return (
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4">{grupo.icono} {grupo.label}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {grupo.items.map((it, i) => (
            <TarjetaMenu key={it.key} Icono={obtenerIcono(it.key, false)} colores={PALETA[i % PALETA.length]} label={it.label} onClick={() => onIr(it.key)} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {tarjetasNivel1.map((it, i) => (
        <TarjetaMenu key={it.key} Icono={obtenerIcono(it.key, it.esGrupo)} colores={PALETA[i % PALETA.length]} label={it.label}
          onClick={() => it.esGrupo ? onCambiarGrupo(it.key) : onIr(it.key)} />
      ))}
    </div>
  );
}

/* ==================== Botón para volver a Inicio ==================== */
export function BotonVolverInicio({ onVolver }) {
  return (
    <button onClick={onVolver} className="flex items-center gap-1.5 text-xs font-semibold text-violet-500 mb-3 hover:text-violet-600">
      <ChevronLeft size={14} /> Volver a Inicio
    </button>
  );
}
