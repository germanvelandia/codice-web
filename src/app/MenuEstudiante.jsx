import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { TarjetaMenuLateral } from "./MenuDocente";

export const MENU_CODICE_GRUPOS = [
  {
    key: "inicio_grupo", label: "Inicio", icono: "🏠", items: [
      { key: "inicio", label: "Inicio", icono: "🏠" },
    ],
  },
  {
    key: "estudio", label: "Estudio", icono: "🎓", items: [
      { key: "codice", label: "Códice", icono: "📖" },
      { key: "notas", label: "Notas", icono: "📝" },
      { key: "evaluaciones", label: "Evaluaciones", icono: "📝" },
      { key: "misiones", label: "Misiones", icono: "⚔️" },
      { key: "forja", label: "Forja", icono: "🔨" },
      { key: "guias", label: "Guías", icono: "📘" },
      { key: "modulos", label: "Módulos", icono: "🧭" },
      { key: "biblioteca", label: "Biblioteca", icono: "📚" },
      { key: "proyectos", label: "Proyectos", icono: "📜" },
      { key: "historial", label: "Historial", icono: "🗂️" },
    ],
  },
  {
    key: "comunidad", label: "Comunidad", icono: "🏆", items: [
      { key: "ranking", label: "Ranking", icono: "📊" },
      { key: "salonhonor", label: "Salón de Honor", icono: "🏆" },
      { key: "recompensas", label: "Recompensas", icono: "🎁" },
      { key: "album", label: "Álbum", icono: "🎴" },
      { key: "comarca", label: "Mi Comarca", icono: "🏛️" },
    ],
  },
  {
    key: "diversion", label: "Diversión", icono: "🎡", items: [
      { key: "preguntados", label: "Preguntados", icono: "🎡" },
      { key: "quizvivo", label: "Quiz en vivo", icono: "⚡" },
      { key: "personaje", label: "Personaje", icono: "🎨" },
      { key: "salaavatares", label: "Sala de avatares", icono: "🎭" },
      { key: "mundo", label: "Mundo", icono: "🌍" },
      { key: "tablero", label: "Tablero Mundial", icono: "🧭" },
    ],
  },
  {
    key: "cuenta", label: "Mi cuenta", icono: "👤", items: [
      { key: "coevaluacion", label: "Evaluarnos", icono: "🪞" },
      { key: "misdiplomas", label: "Mis diplomas", icono: "🎖️" },
      { key: "encuesta", label: "Encuesta", icono: "📝" },
      { key: "perfil", label: "Perfil", icono: "👤" },
    ],
  },
];

// Lista plana — se sigue usando donde hace falta el conjunto completo sin agrupar.
export const MENU_CODICE = MENU_CODICE_GRUPOS.flatMap((g) => g.items);

// Íconos temáticos de castillo/aventura para cada destino del menú, en vez
// del emoji genérico — puramente decorativo, la navegación real sigue
// siendo la misma (la key de MENU_CODICE).
export const ICONO_MAPA = {
  album: "🏯", biblioteca: "📚", codice: "📖", forja: "⚒️", guias: "🗺️", modulos: "🧭",
  inicio: "🏰", mundo: "🌍", misiones: "⚔️", evaluaciones: "📝", notas: "📜", personaje: "🧙", salaavatares: "🎭", historial: "📖", perfil: "🛡️", preguntados: "🎡", quizvivo: "⚡", encuesta: "📝", coevaluacion: "🪞", misdiplomas: "🎖️", tablero: "🧭",
  proyectos: "🏹", ranking: "👑", recompensas: "💎", salonhonor: "🏆",
};

export function SidebarTarjetasEstudiante({ activo, onCambiar, monedas, gradoId, onCerrarSesion, menuAbierto, onCerrarMenu }) {
  const [ultimoAnuncio, setUltimoAnuncio] = useState(null);

  useEffect(() => {
    if (!gradoId) return;
    api.fetchAnunciosParaGrado(gradoId).then((lista) => setUltimoAnuncio(lista[0] || null));
  }, [gradoId]);

  const elegir = (key) => { onCambiar(key); onCerrarMenu?.(); };

  const contenido = (
    <div className="h-full flex flex-col" style={{ background: "linear-gradient(180deg, #17264D 0%, #0f1932 100%)" }}>
      <div className="p-3 pb-2">
        <div className="flex items-center justify-between gap-2 mb-2">
          <button onClick={() => elegir("inicio")} className="flex items-center gap-2">
            <span className="text-lg">🧭</span>
            <span className="text-white text-sm font-bold tracking-[0.12em]" style={{ fontFamily: "Georgia, serif" }}>CÓDICE</span>
          </button>
          {monedas !== undefined && (
            <div className="flex items-center gap-1">
              <span className="text-sm">🪙</span>
              <span className="text-xs font-bold text-amber-300">{monedas}</span>
            </div>
          )}
        </div>
        {ultimoAnuncio && (
          <button onClick={() => elegir("mensajes")} className="w-full text-left rounded-xl px-2.5 py-2" style={{ background: "rgba(47,85,164,0.2)" }}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xs">{ultimoAnuncio.fijado ? "📌" : "✉️"}</span>
              <span className="text-[9px] font-bold text-violet-200 uppercase tracking-wide">Último mensaje</span>
            </div>
            <div className="text-[11px] font-semibold text-white truncate">{ultimoAnuncio.titulo}</div>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <TarjetaMenuLateral icono="🏠" label="Inicio" activo={activo === "inicio"} onClick={() => elegir("inicio")} fondo="#E8EEF8" />

        {MENU_CODICE_GRUPOS.filter((g) => g.key !== "inicio_grupo").map((grupo) => (
          <div key={grupo.key} className="mt-3">
            <div className="text-[9px] font-bold uppercase tracking-wide px-2.5 mb-1" style={{ color: "#829aca" }}>{grupo.icono} {grupo.label}</div>
            {grupo.items.map((it) => (
              <TarjetaMenuLateral key={it.key} icono={it.icono} label={it.label} activo={activo === it.key} onClick={() => elegir(it.key)} />
            ))}
          </div>
        ))}
      </div>

      <div className="p-3 pt-2 border-t border-white/10">
        <button onClick={onCerrarSesion} className="w-full text-center text-xs font-semibold text-violet-300 py-1.5" title="Cerrar sesión">🚪 Cerrar sesión</button>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden md:block w-[210px] shrink-0 sticky top-0 h-screen">{contenido}</div>

      <div className="md:hidden w-full sticky top-0 z-30 flex items-center justify-between px-4 py-2.5" style={{ background: "#17264D" }}>
        <button onClick={() => elegir("inicio")} className="flex items-center gap-2">
          <span className="text-lg">🧭</span>
          <span className="text-white text-sm font-bold tracking-[0.12em]">CÓDICE</span>
        </button>
        <div className="flex items-center gap-3">
          {monedas !== undefined && <span className="text-xs font-bold text-amber-300">🪙 {monedas}</span>}
          <button onClick={() => onCerrarMenu?.(true)} className="text-white text-xl">☰</button>
        </div>
      </div>
      {menuAbierto && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => onCerrarMenu?.()} />
          <div className="md:hidden fixed left-0 top-0 bottom-0 z-50 w-[260px] shadow-xl">{contenido}</div>
        </>
      )}
    </>
  );
}
