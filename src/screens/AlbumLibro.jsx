import React, { useEffect, useState } from "react";

/* ============================================================================
   📒 Piezas visuales del álbum de colección: casilla de lámina, página y libro.
   Las usan la vista del estudiante y la del docente.
   ============================================================================ */

export const RAREZA = {
  comun: { label: "Común", color: "#94A3B8" },
  rara: { label: "Rara", color: "#3B82F6" },
  epica: { label: "Épica", color: "#8B5CF6" },
  legendaria: { label: "Legendaria", color: "#F59E0B" },
};
const num = (n) => String(n).padStart(2, "0");

export const ESTILOS_ALBUM = `
@keyframes albPegar{0%{transform:scale(1.5) rotate(-6deg);opacity:0}55%{transform:scale(.94) rotate(1deg);opacity:1}100%{transform:scale(1) rotate(0)}}
@keyframes albBrillo{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,0)}50%{box-shadow:0 0 18px 4px rgba(245,158,11,.75)}}
@keyframes albSacudir{0%,100%{transform:rotate(0)}20%{transform:rotate(-9deg)}40%{transform:rotate(8deg)}60%{transform:rotate(-6deg)}80%{transform:rotate(5deg)}}
@keyframes albVoltear{0%{transform:perspective(600px) rotateY(90deg) scale(.7);opacity:0}100%{transform:perspective(600px) rotateY(0) scale(1);opacity:1}}
@keyframes albBrilloLeg{0%{background-position:-200% 0}100%{background-position:200% 0}}
.alb-pegada{animation:albPegar .7s ease-out both,albBrillo 1.4s ease-in-out 2}
.alb-sacudir{animation:albSacudir .5s ease-in-out infinite}
.alb-voltear{animation:albVoltear .55s ease-out both}
.alb-leg:after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.55) 50%,transparent 65%);background-size:200% 100%;animation:albBrilloLeg 3.2s linear infinite;border-radius:inherit}
`;

// Casilla de una lámina: gris y sin nombre si aún no se tiene; a color con su nombre si ya se consiguió.
export function SlotLamina({ lamina, tengo, resaltar, onClick, ancho = "100%", editable }) {
  const r = RAREZA[lamina.rareza] || RAREZA.comun;
  const color = tengo || editable;
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className={`relative text-left block ${resaltar ? "alb-pegada" : ""} ${color && lamina.rareza === "legendaria" ? "alb-leg" : ""}`}
      style={{ width: ancho, borderRadius: 8, background: color ? "#fff" : "rgba(255,255,255,.55)", padding: 5,
        border: color ? `2px solid ${r.color}` : "2px dashed #CBD5E1", boxShadow: color ? `0 2px 8px ${r.color}55` : "none", cursor: onClick ? "pointer" : "default" }}>
      <div className="relative overflow-hidden" style={{ aspectRatio: "3 / 4", borderRadius: 5, background: color ? `linear-gradient(160deg, ${r.color}22, ${r.color}08)` : "#E2E8F0" }}>
        {lamina.imagen_url ? (
          <img src={lamina.imagen_url} alt={color ? (lamina.nombre || "") : "Lámina por descubrir"} draggable={false}
            className="w-full h-full object-cover"
            style={color ? undefined : { filter: "grayscale(1) brightness(.8) contrast(.6)", opacity: 0.45 }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl" style={{ opacity: color ? 1 : 0.35 }}>{color ? "🖼️" : "❔"}</div>
        )}
        {!color && <div className="absolute inset-0 flex items-center justify-center font-black text-slate-500/70" style={{ fontSize: "clamp(18px,3.2vw,30px)" }}>{num(lamina.numero)}</div>}
        {color && lamina.cantidad > 1 && <span className="absolute top-1 right-1 text-[9px] font-extrabold bg-slate-800 text-white rounded-full px-1.5 py-0.5">x{lamina.cantidad}</span>}
      </div>
      <div className="mt-1 rounded-md text-center font-extrabold text-white truncate px-1 py-0.5" style={{ fontSize: 9, background: color ? "#2F55A4" : "#94A3B8" }}>
        # {num(lamina.numero)} {color ? String(lamina.nombre || "").toUpperCase() : "• • •"}
      </div>
    </button>
  );
}

function columnas(n) { return n <= 2 ? 2 : n <= 6 ? (n === 4 ? 2 : 3) : n <= 9 ? 3 : 4; }

export function PaginaAlbum({ pagina, color, resaltarIds, onVerLamina, mostrarTodo }) {
  const laminas = pagina.laminas || [];
  const tengo = laminas.filter((l) => l.cantidad > 0).length;
  return (
    <div className="rounded-2xl p-3 sm:p-4 h-full" style={{ background: "linear-gradient(160deg,#FFF9EC,#FDF0D5)", border: `3px solid ${color}55`, boxShadow: "inset 0 0 40px rgba(180,140,60,.12)" }}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="font-extrabold text-sm" style={{ color }}>{pagina.titulo || `Página ${pagina.numero}`}</div>
        <div className="text-[10px] font-bold text-slate-500">{mostrarTodo ? `${laminas.length} láminas` : `${tengo}/${laminas.length}`}</div>
      </div>
      {laminas.length === 0 ? (
        <div className="text-center text-xs text-slate-400 py-10">Esta página aún no tiene láminas.</div>
      ) : (
        <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${columnas(laminas.length)}, minmax(0, 1fr))` }}>
          {laminas.map((l) => (
            <SlotLamina key={l.id} lamina={l} tengo={l.cantidad > 0} resaltar={resaltarIds?.has(l.id)}
              onClick={l.cantidad > 0 && onVerLamina ? () => onVerLamina(l) : undefined} />
          ))}
        </div>
      )}
      <div className="text-center text-[10px] text-slate-400 mt-3">— {pagina.numero} —</div>
    </div>
  );
}

function useAncho() {
  const [ancho, setAncho] = useState(typeof window === "undefined" ? 1024 : window.innerWidth);
  useEffect(() => { const f = () => setAncho(window.innerWidth); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  return ancho;
}

// El libro: en pantallas anchas muestra dos páginas abiertas; en celular, una.
export function LibroAlbum({ paginas, color = "#2F55A4", resaltarIds, irAPagina, onVerLamina }) {
  const ancho = useAncho();
  const doble = ancho >= 900;
  const [idx, setIdx] = useState(0);
  const total = paginas.length;
  useEffect(() => {
    if (irAPagina == null) return;
    const i = paginas.findIndex((p) => p.id === irAPagina);
    if (i >= 0) setIdx(doble ? i - (i % 2) : i);
  }, [irAPagina]); // eslint-disable-line
  const paso = doble ? 2 : 1;
  const max = Math.max(0, total - 1);
  const ir = (d) => setIdx((x) => Math.min(Math.max(0, x + d * paso), doble ? max - (max % 2) : max));
  const visibles = paginas.slice(idx, idx + paso);
  return (
    <div>
      <style>{ESTILOS_ALBUM}</style>
      <div className="rounded-3xl p-2.5 sm:p-3" style={{ background: `linear-gradient(135deg, ${color}, ${color}BB)`, boxShadow: "0 10px 30px rgba(0,0,0,.18)" }}>
        <div className={`grid gap-2 ${doble ? "grid-cols-2" : "grid-cols-1"}`}>
          {visibles.map((p) => <PaginaAlbum key={p.id} pagina={p} color={color} resaltarIds={resaltarIds} onVerLamina={onVerLamina} />)}
        </div>
      </div>
      <div className="flex items-center justify-center gap-3 mt-3">
        <button onClick={() => ir(-1)} disabled={idx === 0} className="text-sm font-bold px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-600 disabled:opacity-40">◀ Anterior</button>
        <span className="text-xs font-semibold text-slate-500">{doble ? `Páginas ${idx + 1}${visibles.length > 1 ? `–${idx + 2}` : ""}` : `Página ${idx + 1}`} de {total}</span>
        <button onClick={() => ir(1)} disabled={idx + paso >= total} className="text-sm font-bold px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-600 disabled:opacity-40">Siguiente ▶</button>
      </div>
    </div>
  );
}
