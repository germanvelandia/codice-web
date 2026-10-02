import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const CATEGORIAS_EMOJI = {
  "🎮 Juego": ["⚔️", "🛡️", "🏰", "👑", "🧙", "🐉", "🗝️", "💎", "🏆", "🥇", "🥈", "🥉", "🎯", "🎲", "🃏", "🧩", "🔮", "⚗️", "🩸", "🧪", "📜", "📖", "🗺️", "🕯️", "🔨", "⚖️", "🏹", "🎪", "🎭", "🎨"],
  "😀 Caras": ["😀", "😄", "😁", "😊", "😇", "🙂", "😉", "😌", "🤩", "🥳", "😎", "🤔", "😴", "🥱", "😅", "😢", "😡", "🤯", "🤗", "🙌"],
  "✋ Manos": ["👍", "👎", "👏", "🙌", "🤝", "✋", "🖐️", "☝️", "✌️", "🤞", "💪", "🙏", "👋", "🫡"],
  "🐱 Animales": ["🐶", "🐱", "🦁", "🐯", "🐻", "🐼", "🦊", "🐺", "🦉", "🦅", "🐢", "🐍", "🦄", "🐝", "🦋", "🐙", "🦖", "🐬"],
  "🍎 Objetos/Comida": ["📚", "✏️", "🖊️", "📌", "📎", "🔑", "🎁", "🧸", "⏰", "💡", "🔔", "📢", "🎵", "🎶", "🍎", "🍕", "🍦", "🍬", "🎂", "☕"],
  "⭐ Símbolos": ["⭐", "🌟", "✨", "💫", "❤️", "💛", "💚", "💙", "💜", "🔥", "💥", "✅", "❌", "❗", "❓", "⚡", "🌈", "☀️", "🌙", "☁️"],
};

const ANCHO_PANEL = 280;
const ALTO_PANEL_APROX = 340; // botón de texto + categorías — para decidir si abre hacia arriba o hacia abajo

// Selector de emoji con lista curada por categorías, más un campo de texto
// para pegar/escribir cualquier otro emoji que no esté en la lista.
//
// El panel se dibuja en un portal directo sobre <body>, posicionado por
// coordenadas ("position: fixed" puesto en línea, no solo por clase —
// así no depende de que la hoja de estilos esté cargada). Antes el panel
// usaba "position: absolute" dentro del botón, y quedaba cortado si el
// botón vivía dentro de algo con "overflow: hidden" (como una tarjeta
// con una imagen recortada) — overflow:hidden corta a los descendientes
// posicionados aunque tengan un z-index alto. Con el portal, el panel ya
// no es descendiente de esa tarjeta, así que no lo afecta.
export function EmojiPicker({ value, onChange, size = "text-sm" }) {
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState(null);
  const botonRef = useRef(null);

  const abrir = () => {
    const r = botonRef.current.getBoundingClientRect();
    const abajoHayEspacio = window.innerHeight - r.bottom >= ALTO_PANEL_APROX;
    setPosicion({
      left: Math.min(r.left, window.innerWidth - ANCHO_PANEL - 8),
      top: abajoHayEspacio ? r.bottom + 4 : null,
      bottom: abajoHayEspacio ? null : window.innerHeight - r.top + 4,
    });
    setAbierto(true);
  };

  // Si la ventana cambia de tamaño (o se gira el celular) mientras está
  // abierto, recalcula — si no, el panel podría quedar mal ubicado.
  useEffect(() => {
    if (!abierto) return;
    const recalcular = () => abrir();
    window.addEventListener("resize", recalcular);
    return () => window.removeEventListener("resize", recalcular);
  }, [abierto]);

  return (
    <div className="inline-block">
      <button ref={botonRef} type="button" onClick={abrir}
        className={`${size} w-12 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white`}>
        {value || "🙂"}
      </button>
      {abierto && posicion && createPortal(
        <>
          <div className="fixed inset-0" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }} onClick={() => setAbierto(false)} />
          <div
            className="bg-white rounded-xl shadow-lg border border-slate-200 p-3"
            style={{
              position: "fixed", width: ANCHO_PANEL, left: posicion.left,
              top: posicion.top ?? "auto", bottom: posicion.bottom ?? "auto",
              maxHeight: "70vh", display: "flex", flexDirection: "column", zIndex: 101,
            }}
          >
            <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="O escribí/pegá otro emoji acá"
              className="w-full text-sm rounded-lg px-2 py-1.5 mb-2 border border-slate-200 outline-none shrink-0" />
            <div className="overflow-y-auto space-y-2">
              {Object.entries(CATEGORIAS_EMOJI).map(([cat, lista]) => (
                <div key={cat}>
                  <div className="text-[10px] font-semibold text-slate-400 mb-1">{cat}</div>
                  <div className="grid grid-cols-8 gap-1">
                    {lista.map((e) => (
                      <button key={e} type="button" onClick={() => { onChange(e); setAbierto(false); }}
                        className="text-lg hover:bg-violet-50 rounded p-1">{e}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
