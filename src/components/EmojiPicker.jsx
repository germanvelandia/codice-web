import React, { useState } from "react";

const CATEGORIAS_EMOJI = {
  "🎮 Juego": ["⚔️", "🛡️", "🏰", "👑", "🧙", "🐉", "🗝️", "💎", "🏆", "🥇", "🥈", "🥉", "🎯", "🎲", "🃏", "🧩", "🔮", "⚗️", "🩸", "🧪", "📜", "📖", "🗺️", "🕯️", "🔨", "⚖️", "🏹", "🎪", "🎭", "🎨"],
  "😀 Caras": ["😀", "😄", "😁", "😊", "😇", "🙂", "😉", "😌", "🤩", "🥳", "😎", "🤔", "😴", "🥱", "😅", "😢", "😡", "🤯", "🤗", "🙌"],
  "✋ Manos": ["👍", "👎", "👏", "🙌", "🤝", "✋", "🖐️", "☝️", "✌️", "🤞", "💪", "🙏", "👋", "🫡"],
  "🐱 Animales": ["🐶", "🐱", "🦁", "🐯", "🐻", "🐼", "🦊", "🐺", "🦉", "🦅", "🐢", "🐍", "🦄", "🐝", "🦋", "🐙", "🦖", "🐬"],
  "🍎 Objetos/Comida": ["📚", "✏️", "🖊️", "📌", "📎", "🔑", "🎁", "🧸", "⏰", "💡", "🔔", "📢", "🎵", "🎶", "🍎", "🍕", "🍦", "🍬", "🎂", "☕"],
  "⭐ Símbolos": ["⭐", "🌟", "✨", "💫", "❤️", "💛", "💚", "💙", "💜", "🔥", "💥", "✅", "❌", "❗", "❓", "⚡", "🌈", "☀️", "🌙", "☁️"],
};

// Selector de emoji con lista curada por categorías, más un campo de texto
// para pegar/escribir cualquier otro emoji que no esté en la lista.
export function EmojiPicker({ value, onChange, size = "text-sm" }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="relative inline-block">
      <button type="button" onClick={() => setAbierto((v) => !v)}
        className={`${size} w-12 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white`}>
        {value || "🙂"}
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
          <div className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-100 p-3 z-50" style={{ width: 280 }}>
            <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="O escribí/pegá otro emoji acá"
              className="w-full text-sm rounded-lg px-2 py-1.5 mb-2 border border-slate-200 outline-none" />
            <div className="max-h-56 overflow-y-auto space-y-2">
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
        </>
      )}
    </div>
  );
}
