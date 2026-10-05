import React from "react";

// Piezas visuales LIVIANAS del nivel del personaje (sin imágenes): se pueden cargar
// en cualquier pantalla sin sumar peso. El personaje en sí vive en
// PersonajeConMejoras, que se carga aparte cuando hace falta.

const ID_ESTILOS = "codice-nivel-estilos";
export function asegurarEstilosNivel() {
  if (typeof document === "undefined" || document.getElementById(ID_ESTILOS)) return;
  const el = document.createElement("style");
  el.id = ID_ESTILOS;
  el.textContent = `
    @keyframes codicePulso { 0%,100% { transform: scale(1); opacity: .85; } 50% { transform: scale(1.08); opacity: 1; } }
    @keyframes codiceTitila { 0%,100% { opacity: .25; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.15); } }
    @keyframes codiceFlota { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
    @media (prefers-reduced-motion: reduce) { .codice-anim { animation: none !important; } }
  `;
  document.head.appendChild(el);
}

// Pastilla "Nv 3" con el color del nivel (bronce, plata, oro).
export function InsigniaNivel({ nivel, nombre, color }) {
  return (
    <span title={`Nivel ${nivel} · ${nombre}`} className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
      style={{ background: color || "#94A3B8", color: nivel >= 4 ? "#5B3A00" : "#1F2937", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>
      Nv {nivel}
    </span>
  );
}

const POS_NIVEL_3 = [[8, 18], [22, 70], [35, 12], [60, 22], [78, 60], [88, 15], [15, 45], [92, 75]];
const POS_NIVEL_4 = [[48, 80], [70, 10], [5, 82], [40, 55], [85, 40], [28, 30], [62, 70], [95, 32]];

// Estrellitas que titilan en el fondo del banner: aparecen desde el nivel 3
// (blancas) y se suman más y doradas en el nivel 4.
export function CapaEstrellasBanner({ nivel }) {
  asegurarEstilosNivel();
  if (nivel < 3) return null;
  const puntos = nivel >= 4 ? [...POS_NIVEL_3, ...POS_NIVEL_4] : POS_NIVEL_3;
  const color = nivel >= 4 ? "#FFE08A" : "#FFFFFF";
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
      {puntos.map(([x, y], i) => (
        <span key={i} className="codice-anim absolute" style={{
          left: `${x}%`, top: `${y}%`, color, fontSize: 8 + (i % 3) * 3, lineHeight: 1,
          animation: `codiceTitila ${2 + (i % 4) * 0.4}s ease-in-out ${(i * 0.37).toFixed(2)}s infinite`,
        }}>✦</span>
      ))}
    </div>
  );
}
