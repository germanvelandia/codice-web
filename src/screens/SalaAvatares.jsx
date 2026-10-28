import React, { useState } from "react";

// Las imágenes viven en /public/avatares/<clave>-el.webp y <clave>-la.webp
const AVATARES = [
  { clave: "vanguardia", el: "El Vanguardia", la: "La Vanguardia", rol: "Logístico / Guardián", tipo: "logistico", desc: "Protege al grupo y se asegura de que nada falte: recursos, tiempos y cuidado del equipo." },
  { clave: "artifice", el: "El Artífice", la: "La Artífice", rol: "Investigador / Académico", tipo: "investigador", desc: "Construye ideas y las pone a funcionar: indaga, prueba y crea soluciones." },
  { clave: "heraldo", el: "El Heraldo", la: "La Heraldo", rol: "Investigador / Académico", tipo: "investigador", desc: "Comunica lo aprendido: hace que el conocimiento llegue claro a todos." },
  { clave: "oraculo", el: "El Oráculo", la: "La Oráculo", rol: "Investigador / Académico", tipo: "investigador", desc: "Ve más allá de lo evidente: conecta saberes y hace las preguntas profundas." },
  { clave: "estratega", el: "El Estratega", la: "La Estratega", rol: "Líder / Organizador", tipo: "lider", desc: "Planea el camino del equipo: reparte tareas, mide el tiempo y fija el rumbo." },
  { clave: "sanador", el: "El Sanador", la: "La Sanador", rol: "Líder / Organizador", tipo: "lider", desc: "Cuida el clima del grupo: media, escucha y mantiene al equipo en armonía." },
];
const FILTROS = [
  { key: "todos", label: "Todos" },
  { key: "investigador", label: "🔎 Investigador / Académico" },
  { key: "lider", label: "🧭 Líder / Organizador" },
  { key: "logistico", label: "🛡️ Logístico / Guardián" },
];
const src = (a, v) => `/avatares/${a.clave}-${v}.webp`;

export function SalaAvatares() {
  const [filtro, setFiltro] = useState("todos");
  const [abierto, setAbierto] = useState(null); // { avatar, v }
  const lista = AVATARES.filter((a) => filtro === "todos" || a.tipo === filtro);

  return (
    <div>
      <h2 className="text-lg font-extrabold text-slate-800">🎭 Sala de avatares</h2>
      <p className="text-xs text-slate-500 mb-3">Conoce a los personajes del Códice. Cada uno tiene su versión masculina y femenina, y un rol dentro del equipo. Toca una carta para verla en grande.</p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {FILTROS.map((f) => (
          <button key={f.key} onClick={() => setFiltro(f.key)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${filtro === f.key ? "bg-[#2F55A4] text-white border-[#2F55A4]" : "bg-white text-slate-600 border-slate-200"}`}>{f.label}</button>
        ))}
      </div>

      <div className="space-y-5">
        {lista.map((a) => (
          <div key={a.clave} className="rounded-2xl border border-slate-200 p-3" style={{ background: "#fbf8ef" }}>
            <div className="flex flex-wrap items-baseline gap-x-2 mb-2">
              <span className="font-extrabold text-[#17264D]">{a.el.replace("El ", "")}</span>
              <span className="text-[11px] font-semibold text-[#B8892B]">{a.rol}</span>
            </div>
            <p className="text-xs text-slate-600 mb-3">{a.desc}</p>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              {[["el", a.el], ["la", a.la]].map(([v, nombre]) => (
                <button key={v} onClick={() => setAbierto({ avatar: a, v, nombre })} className="group text-left" aria-label={nombre}>
                  <img src={src(a, v)} alt={`${nombre} — ${a.rol}`} loading="lazy" className="w-full h-auto rounded-xl shadow-md transition-transform group-hover:-translate-y-1 group-hover:shadow-xl" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(10,16,35,0.85)" }} onClick={() => setAbierto(null)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-full flex flex-col items-center">
            <img src={src(abierto.avatar, abierto.v)} alt={abierto.nombre} className="max-h-[78vh] w-auto rounded-2xl shadow-2xl" />
            <div className="mt-3 flex items-center gap-2">
              <a href={src(abierto.avatar, abierto.v)} download={`${abierto.avatar.clave}-${abierto.v}.webp`} className="text-xs font-semibold px-3 py-2 rounded-full bg-white text-slate-700">⬇️ Descargar</a>
              <button onClick={() => setAbierto(null)} className="text-xs font-semibold px-3 py-2 rounded-full bg-[#B8892B] text-white">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SalaAvatares;
