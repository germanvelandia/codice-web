import React, { lazy } from "react";

export function Centered({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-violet-50 text-slate-700">
      {children}
    </div>
  );
}

// Fondo ambientado de castillo/aventura medieval — colinas, torres y
// estandartes en SVG, puramente decorativo, detrás del formulario de acceso.
// Silueta de castillo chico, reutilizable para armar un horizonte con
// varios — recibe posición, escala y color para variar la profundidad.
export function Castillito({ x, y, escala = 1, color = "#223b74", opacity = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${escala})`} opacity={opacity}>
      <rect x="0" y="35" width="70" height="45" fill={color} />
      <rect x="-10" y="18" width="18" height="62" fill={color} />
      <rect x="62" y="18" width="18" height="62" fill={color} />
      <polygon points="-1,18 -1,4 8,12" fill={color} />
      <polygon points="71,18 71,4 62,12" fill={color} />
      {[0, 14, 28, 42, 56].map((dx) => (
        <rect key={dx} x={dx} y="30" width="7" height="6" fill={color} />
      ))}
      <rect x="28" y="55" width="14" height="25" fill="#1e1b4b" />
    </g>
  );
}

export function FondoCastillo() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" style={{ background: "linear-gradient(180deg, #28478a 0%, #5474b5 35%, #a7b8db 65%, #fef3c7 100%)" }}>
      <svg viewBox="0 0 800 400" preserveAspectRatio="xMidYMax slice" className="absolute bottom-0 left-0 w-full h-full opacity-90">
        {/* Sol/luna */}
        <circle cx="670" cy="70" r="38" fill="#FDE68A" opacity="0.9" />
        {/* Colinas traseras */}
        <path d="M0,260 Q150,210 300,250 T600,240 T800,260 L800,400 L0,400 Z" fill="#5b21b6" opacity="0.55" />
        {/* Horizonte de castillos chicos, a lo lejos */}
        <Castillito x={30} y={195} escala={0.75} color="#223b74" opacity={0.5} />
        <Castillito x={520} y={200} escala={0.6} color="#223b74" opacity={0.45} />
        <Castillito x={640} y={190} escala={0.8} color="#223b74" opacity={0.5} />
        {/* Colinas delanteras */}
        <path d="M0,300 Q200,250 400,290 T800,290 L800,400 L0,400 Z" fill="#223b74" opacity="0.75" />
        {/* Castillo central, principal */}
        <g transform="translate(300,190)">
          <rect x="0" y="60" width="200" height="110" fill="#3730a3" />
          <rect x="-20" y="30" width="45" height="140" fill="#312e81" />
          <rect x="175" y="30" width="45" height="140" fill="#312e81" />
          <polygon points="2.5,30 2.5,0 25,15" fill="#28478a" />
          <polygon points="197.5,30 197.5,0 175,15" fill="#28478a" />
          <rect x="85" y="100" width="30" height="70" fill="#1e1b4b" rx="15" />
          <rect x="20" y="80" width="20" height="25" fill="#5474b5" opacity="0.8" />
          <rect x="160" y="80" width="20" height="25" fill="#5474b5" opacity="0.8" />
          {[0, 40, 80, 120, 160, 200].map((x) => (
            <rect key={x} x={x - 8} y="52" width="16" height="12" fill="#3730a3" />
          ))}
        </g>
        {/* Castillos laterales, más cerca */}
        <Castillito x={70} y={230} escala={1.1} color="#5b21b6" />
        <Castillito x={630} y={235} escala={1} color="#5b21b6" />
        {/* Torres solitarias pequeñas */}
        <g transform="translate(90,240)">
          <rect x="0" y="20" width="34" height="70" fill="#223b74" />
          <polygon points="-4,20 38,20 17,0" fill="#5474b5" />
        </g>
        <g transform="translate(660,250)">
          <rect x="0" y="20" width="30" height="60" fill="#223b74" />
          <polygon points="-4,20 34,20 15,0" fill="#5474b5" />
        </g>

      </svg>
    </div>
  );
}

// Fondo "retro arcade" para el lado del docente — cuadrícula en píxeles,
// franjas de scanline, y un horizonte bajo de castillos en 8-bit, sin
// interferir con la lectura de las tarjetas blancas de contenido.
export function FondoArcadeDocente() {
  return <div className="fixed inset-0 -z-10" style={{ background: "#1a1533" }} />;
}

// Marco decorativo reutilizable — mismo lenguaje visual del "Zona de
// Herramientas" (degradado azul/dorado, encabezado oscuro, contenido en
// tarjeta blanca adentro), para las demás zonas de la app.
export function MarcoSeccion({ zonaLabel, icono, children }) {
  return (
    <div className="rounded-[28px] p-1" style={{ background: "linear-gradient(135deg, #2F55A4, #B8892B)" }}>
      <div className="rounded-[24px] p-4 md:p-6" style={{ background: "linear-gradient(160deg, #17264D 0%, #223b74 100%)" }}>
        <div className="flex items-center gap-2.5 mb-4 px-1">
          <span className="text-2xl">{icono}</span>
          <div className="text-base font-extrabold text-white">{zonaLabel}</div>
        </div>
        <div className="rounded-2xl bg-white p-4 md:p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

export const NOMBRES_HERRAMIENTAS = {
  ruleta: "Ruleta", ruletamonedas: "Ruleta de Monedas", accionesmasivas: "Acciones Masivas", banco: "Banco",
  album: "Álbum", anuncios: "Anuncios", logros: "Logros", salonhonor: "Salón de Honor", diplomas: "Diplomas", rankdiplomas: "Ranking → diplomas", avatares: "Sala de avatares",
  gamext: "Desafíos / Misiones / Cosméticos", consignas: "Consignas del Códice", trivia: "Preguntados",
  bancopreguntas: "Banco de Preguntas", temporizador: "Temporizador", dado: "Dado", cronometro: "Cronómetro",
  semaforo: "Semáforo", sorteoorden: "Sorteo de Orden / Parejas", grupos: "Generador de Grupos",
  marcador: "Marcador de Puntos", selectorestudiante: "Selector de Estudiante", bingo: "Bingo de Repaso", quizvivo: "Quiz en vivo", rankingganancias: "Ranking de ganancias (XP/oro)", revisiontrivia: "Revisión de Preguntados (autoclic)", recompensas: "Recompensas de estudiantes", obras: "Gran Obra del curso", encuestas: "Encuesta de satisfacción", informe: "Informe de impacto",
  formasexamen: "Formas de Examen (A/B/C/D)",
};

// Carga diferida: este componente (y sus 14 imágenes) solo se descargan
// cuando un estudiante con un rol de la Comarca realmente los necesita —
// no forman parte del paquete principal que carga la pantalla de inicio.
export const PersonajeRol = lazy(() => import("../components/PersonajeRol"));

export const PersonajeConMejoras = lazy(() => import("../components/PersonajeConMejoras"));

export const VistaMundo = lazy(() => import("../screens/Mundo"));
