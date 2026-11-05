import React, { useEffect, useId, useRef, useState } from "react";

// Arte original de Detectives del Códice, dibujado con SVG (sin imágenes externas).
// Los rostros se construyen a partir de los RASGOS del caso (color de capa, sombrero, gafas, bigote…):
// así el retrato hablado se va armando con las pistas y la rueda de sospechosos sí se puede comparar a simple vista.

export const hash = (txt) => { let h = 2166136261; const s = String(txt ?? ""); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const pick = (arr, seed, salt = 0) => arr[hash(`${seed}#${salt}`) % arr.length];
const sinTilde = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const PIEL = ["#f6d5b8", "#e8b98d", "#c98f62", "#9c6642", "#6f4527"];
const PELO = ["#2b1b12", "#5a3a22", "#a3622a", "#d9b25a", "#8a8a8a", "#1f2937", "#7c2d12"];
const ROPA = ["#4f46e5", "#0d9488", "#be123c", "#b45309", "#475569", "#7e22ce"];
const COLORES = [
  [/verde/, "#16a34a"], [/celeste/, "#38bdf8"], [/azul/, "#2563eb"], [/rojo|carmes|granate/, "#dc2626"], [/morad|violeta|lila|purpura/, "#7c3aed"],
  [/amarill/, "#eab308"], [/negr/, "#111827"], [/blanc/, "#f1f5f9"], [/naranj/, "#f97316"], [/rosad|rosa\b|fucsia/, "#ec4899"],
  [/gris/, "#6b7280"], [/platead|plata/, "#cbd5e1"], [/dorad|oro\b/, "#d4a017"], [/cafe|marron|castan/, "#78350f"], [/turquesa/, "#14b8a6"],
];
const colorEn = (t) => { const s = sinTilde(t); for (const [re, c] of COLORES) if (re.test(s)) return c; return null; };

// Convierte los rasgos en texto ("Lleva una capa verde") en rasgos dibujables.
export function rasgosAVisual(rasgos = []) {
  const v = {};
  rasgos.forEach((r) => {
    const s = sinTilde(r); const c = colorEn(r);
    if (/capa|capucha|manto|abrigo|gabardina|chaqueta|chaleco|camisa|sudadera|vestido|tunica|poncho|bata/.test(s)) { v.ropa = c || v.ropa; v.tieneRopa = true; if (/capa|manto|capucha|poncho/.test(s)) v.capa = true; }
    if (/sombrero|gorra|gorro|boina|casco|turbante|corona|tiara/.test(s)) v.sombrero = { color: c || "#334155", tipo: /gorra/.test(s) ? "gorra" : /corona|tiara/.test(s) ? "corona" : /boina|gorro/.test(s) ? "boina" : "copa" };
    if (/gafas|lentes|monocl/.test(s)) v.gafas = true;
    if (/bigote/.test(s)) v.bigote = true;
    if (/barba/.test(s)) v.barba = true;
    if (/bufanda|panuelo|corbata|panoleta|mono\b/.test(s)) v.bufanda = c || "#dc2626";
    if (/cicatriz|lunar|marca/.test(s)) v.cicatriz = true;
    if (/anillo|sortija/.test(s)) v.anillo = c || "#cbd5e1";
    if (/collar|medall/.test(s)) v.collar = c || "#d4a017";
    if (/arete|pendiente|zarcillo/.test(s)) v.arete = c || "#d4a017";
    if (/cabello|pelo|melena|trenza|rubi|pelirroj|canos/.test(s)) { v.pelo = c || (/rubi/.test(s) ? "#d9b25a" : /pelirroj/.test(s) ? "#b45309" : /cano/.test(s) ? "#d1d5db" : v.pelo); if (/larg|melena|trenza/.test(s)) v.largo = true; }
    if (/mascara|antifaz/.test(s)) v.mascara = true;
  });
  return v;
}

/* ---------------- Rostro ---------------- */
export function Rostro({ nombre = "", rasgos = [], silueta = false, parcial = false, ancho = 100, alto, style, x, y, className, titulo }) {
  const v = rasgosAVisual(rasgos);
  const seed = nombre || "anon";
  const piel = silueta ? "#cbd5e1" : pick(PIEL, seed, 1);
  const estilo = hash(seed + "e") % 5;               // peinado
  const peloC = silueta ? "#94a3b8" : v.pelo || pick(PELO, seed, 2);
  const ropaC = silueta ? "#94a3b8" : v.ropa || (parcial ? "#94a3b8" : pick(ROPA, seed, 3));
  const largo = v.largo || estilo === 1 || estilo === 4;
  const ojos = pick(["#1f2937", "#3b2a1a", "#1d4ed8", "#166534"], seed, 4);
  const boca = hash(seed + "b") % 3;
  const mostrarCara = !silueta;
  const idg = useId().replace(/:/g, "");
  return (
    <svg x={x} y={y} width={ancho} height={alto ?? ancho * 1.2} viewBox="0 0 100 120" style={style} className={className} role="img" aria-label={titulo || nombre || "Rostro"}>
      <defs><radialGradient id={`f${idg}`} cx="50%" cy="35%" r="70%"><stop offset="0" stopColor="#fff" stopOpacity=".35" /><stop offset="1" stopColor="#000" stopOpacity=".12" /></radialGradient></defs>
      {/* capa detrás */}
      {v.capa && <path d="M6 120 C8 78 24 70 50 68 C76 70 92 78 94 120 Z" fill={ropaC} opacity=".92" />}
      {v.capa && <path d="M6 120 C8 78 24 70 50 68 C76 70 92 78 94 120 Z" fill="#000" opacity=".18" />}
      {/* pelo detrás */}
      {largo && <path d="M24 52 C20 90 26 98 34 100 L66 100 C74 98 80 90 76 52 Z" fill={peloC} />}
      {estilo === 2 && <circle cx="50" cy="14" r="11" fill={peloC} />}
      {/* torso */}
      <path d="M12 120 C14 92 30 84 50 84 C70 84 86 92 88 120 Z" fill={v.capa ? ropaC : ropaC} />
      <path d="M12 120 C14 92 30 84 50 84 C70 84 86 92 88 120 Z" fill="#000" opacity={v.capa ? ".0" : ".08"} />
      {!v.capa && <path d="M40 84 L50 100 L60 84 Z" fill="#fff" opacity=".85" />}
      {v.capa && <g><path d="M16 120 C18 96 34 86 50 86 C66 86 82 96 84 120 L68 120 C66 102 58 97 50 97 C42 97 34 102 32 120 Z" fill={ropaC} /><path d="M16 120 C18 96 34 86 50 86 C66 86 82 96 84 120 L68 120 C66 102 58 97 50 97 C42 97 34 102 32 120 Z" fill="#000" opacity=".22" /><path d="M36 84 L30 74 L46 86 Z M64 84 L70 74 L54 86 Z" fill={ropaC} /><circle cx="50" cy="93" r="3.4" fill="#facc15" stroke="#a16207" strokeWidth="1" /></g>}
      {/* cuello */}
      <rect x="43" y="68" width="14" height="18" rx="5" fill={piel} />
      <rect x="43" y="68" width="14" height="18" rx="5" fill="#000" opacity=".1" />
      {/* collar */}
      {v.collar && <path d="M38 88 Q50 104 62 88" fill="none" stroke={v.collar} strokeWidth="2.5" strokeDasharray="1 3" strokeLinecap="round" />}
      {/* orejas */}
      <ellipse cx="25" cy="50" rx="4.5" ry="6" fill={piel} /><ellipse cx="75" cy="50" rx="4.5" ry="6" fill={piel} />
      {v.arete && <><circle cx="25" cy="58" r="2.6" fill={v.arete} /><circle cx="75" cy="58" r="2.6" fill={v.arete} /></>}
      {/* cabeza */}
      <ellipse cx="50" cy="48" rx="25" ry="29" fill={piel} />
      <ellipse cx="50" cy="48" rx="25" ry="29" fill={`url(#f${idg})`} />
      {/* pelo frontal */}
      {estilo === 0 && <path d="M25 44 C22 20 40 14 50 14 C62 14 78 20 75 44 C68 32 58 28 50 28 C40 28 32 32 25 44 Z" fill={peloC} />}
      {estilo === 1 && <path d="M25 46 C20 18 42 12 50 12 C60 12 80 18 75 46 C70 30 60 26 50 26 C40 26 30 30 25 46 Z" fill={peloC} />}
      {estilo === 2 && <path d="M26 42 C26 22 38 16 50 16 C62 16 74 22 74 42 C66 30 58 28 50 28 C42 28 34 30 26 42 Z" fill={peloC} />}
      {estilo === 3 && <><circle cx="34" cy="26" r="9" fill={peloC} /><circle cx="50" cy="21" r="10" fill={peloC} /><circle cx="66" cy="26" r="9" fill={peloC} /><circle cx="27" cy="38" r="6" fill={peloC} /><circle cx="73" cy="38" r="6" fill={peloC} /></>}
      {estilo === 4 && <path d="M25 46 C22 22 36 14 50 14 C66 14 78 22 75 46 C68 28 58 22 50 22 C42 22 32 28 25 46 Z" fill={peloC} />}
      {/* cara */}
      {mostrarCara && <>
        <ellipse cx="40" cy="48" rx="3" ry="3.4" fill="#fff" /><ellipse cx="60" cy="48" rx="3" ry="3.4" fill="#fff" />
        <circle cx="40.6" cy="48.4" r="1.9" fill={ojos} /><circle cx="60.6" cy="48.4" r="1.9" fill={ojos} />
        <path d="M34 41 Q40 38 45 41 M55 41 Q60 38 66 41" stroke={peloC} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M50 50 Q48 58 52 58" stroke="#000" strokeOpacity=".28" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        {boca === 0 && <path d="M42 64 Q50 70 58 64" stroke="#7f1d1d" strokeWidth="2" fill="none" strokeLinecap="round" />}
        {boca === 1 && <path d="M43 65 L57 65" stroke="#7f1d1d" strokeWidth="2" strokeLinecap="round" />}
        {boca === 2 && <path d="M43 64 Q50 67 57 63" stroke="#7f1d1d" strokeWidth="2" fill="none" strokeLinecap="round" />}
      </>}
      {silueta && <text x="50" y="58" textAnchor="middle" fontSize="30" fontWeight="800" fill="#475569">?</text>}
      {v.barba && <path d="M28 54 C28 76 72 76 72 54 C66 66 34 66 28 54 Z" fill={peloC} opacity=".95" />}
      {v.bigote && <path d="M38 60 Q44 56 50 60 Q56 56 62 60 Q56 63 50 61 Q44 63 38 60 Z" fill={peloC} />}
      {v.cicatriz && <path d="M58 40 L66 54 M60 46 L64 45 M62 50 L66 49" stroke="#9f1239" strokeWidth="1.8" strokeLinecap="round" fill="none" />}
      {v.gafas && <g fill="none" stroke="#111827" strokeWidth="2"><circle cx="40" cy="48" r="7.5" /><circle cx="60" cy="48" r="7.5" /><path d="M47.5 48 L52.5 48" /></g>}
      {v.mascara && <path d="M24 42 C34 36 66 36 76 42 L76 53 C66 56 58 52 50 54 C42 52 34 56 24 53 Z" fill="#111827" opacity=".9" />}
      {/* bufanda */}
      {v.bufanda && <><path d="M32 82 Q50 96 68 82 L70 92 Q50 106 30 92 Z" fill={v.bufanda} /><rect x="58" y="90" width="9" height="22" rx="3" fill={v.bufanda} /><rect x="58" y="90" width="9" height="22" rx="3" fill="#000" opacity=".15" /></>}
      {/* sombrero */}
      {v.sombrero?.tipo === "copa" && <g><ellipse cx="50" cy="26" rx="34" ry="7" fill={v.sombrero.color} /><path d="M30 26 C30 4 70 4 70 26 Z" fill={v.sombrero.color} /><rect x="30" y="20" width="40" height="5" fill="#000" opacity=".28" /></g>}
      {v.sombrero?.tipo === "gorra" && <g><path d="M24 34 C24 10 76 10 76 34 Z" fill={v.sombrero.color} /><path d="M70 32 L94 34 L70 38 Z" fill={v.sombrero.color} /><path d="M70 32 L94 34 L70 38 Z" fill="#000" opacity=".2" /></g>}
      {v.sombrero?.tipo === "boina" && <g><ellipse cx="46" cy="22" rx="30" ry="12" fill={v.sombrero.color} /><circle cx="46" cy="9" r="2.6" fill={v.sombrero.color} /></g>}
      {v.sombrero?.tipo === "corona" && <g fill={v.sombrero.color === "#334155" ? "#d4a017" : v.sombrero.color}><path d="M28 28 L28 10 L39 20 L50 6 L61 20 L72 10 L72 28 Z" /><circle cx="50" cy="8" r="2.4" fill="#ef4444" /></g>}
      {/* mano con anillo */}
      {v.anillo && <g><ellipse cx="82" cy="108" rx="9" ry="7" fill={piel} /><ellipse cx="82" cy="108" rx="9" ry="7" fill="#000" opacity=".1" /><circle cx="85" cy="104" r="3.2" fill="none" stroke={v.anillo} strokeWidth="2" /><circle cx="85" cy="101" r="1.6" fill="#fff" /></g>}
    </svg>
  );
}

/* ---------------- Jefa de la agencia (personaje original) ---------------- */
export function Jefa({ ancho = 130, style }) {
  return (
    <svg width={ancho} height={ancho * 1.25} viewBox="0 0 100 125" style={style} role="img" aria-label="Comisaria Alba Ferrer">
      <path d="M8 125 C10 96 28 88 50 88 C72 88 90 96 92 125 Z" fill="#0f766e" />
      <path d="M36 88 L50 112 L64 88 Z" fill="#f8fafc" /><path d="M44 92 L50 98 L56 92 L53 112 L47 112 Z" fill="#dc2626" />
      <path d="M20 100 L30 125 M80 100 L70 125" stroke="#0d5f58" strokeWidth="3" />
      <circle cx="30" cy="110" r="3" fill="#facc15" /><circle cx="70" cy="110" r="3" fill="#facc15" />
      <rect x="43" y="70" width="14" height="20" rx="5" fill="#b9805a" />
      <path d="M22 50 C12 74 18 88 30 86 L35 58 Z M78 50 C88 74 82 88 70 86 L65 58 Z" fill="#e5e7eb" />
      <ellipse cx="50" cy="50" rx="24" ry="28" fill="#c98f62" />
      <path d="M24 44 C22 18 40 12 52 12 C66 12 78 20 76 44 C70 30 60 24 48 26 C38 28 30 34 24 44 Z" fill="#e5e7eb" />
      <path d="M30 30 C40 20 60 20 70 30" stroke="#cbd5e1" strokeWidth="2" fill="none" />
      <ellipse cx="40" cy="50" rx="3" ry="3.4" fill="#fff" /><ellipse cx="60" cy="50" rx="3" ry="3.4" fill="#fff" />
      <circle cx="40.6" cy="50.4" r="1.9" fill="#3b2a1a" /><circle cx="60.6" cy="50.4" r="1.9" fill="#3b2a1a" />
      <g fill="none" stroke="#0f172a" strokeWidth="1.8"><rect x="31" y="43" width="17" height="14" rx="5" /><rect x="52" y="43" width="17" height="14" rx="5" /><path d="M48 49 L52 49" /></g>
      <path d="M44 66 Q50 70 56 66" stroke="#7f1d1d" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M30 34 C30 16 70 16 70 34 Z" fill="#0f172a" transform="translate(0 -6)" />
      <rect x="28" y="24" width="44" height="6" fill="#0f172a" /><path d="M24 30 L76 30 L72 34 L28 34 Z" fill="#0f172a" />
      <circle cx="50" cy="22" r="4" fill="#facc15" />
    </svg>
  );
}

/* ---------------- Escenas ---------------- */
const TIPOS = [
  ["biblioteca", /bibliotec|libro|archivo|librer|estudio/], ["herreria", /herrer|forja|taller|fabrica|mina|fragua/], ["puerto", /puerto|muelle|rio\b|mar\b|lago|playa|barco|isla|costa|canal/],
  ["torre", /torre|castillo|reloj|faro|fortaleza|campanario|catedral|iglesia/], ["mercado", /mercado|tienda|feria|plaza de mercado|bazar|cafeteria|taberna|posada|restaurante/],
  ["museo", /museo|galeria|teatro|palacio|templo|ayuntamiento|alcaldia/], ["escuela", /colegio|escuela|aula|salon|patio|cancha|gimnasio|universidad|laboratorio/],
  ["cueva", /cueva|cripta|monta|bosque|selva|desierto|volcan|cañon|canon|tumba|ruinas|caverna/], ["estacion", /estacion|aeropuerto|tren|terminal|metro|puente|mirador/],
  ["plaza", /plaza|parque|jardin|fuente|calle|barrio|aldea|pueblo|comarca|ciudad/],
];
export const tipoDeLugar = (lugar) => { const s = sinTilde(lugar); for (const [t, re] of TIPOS) if (re.test(s)) return t; return "ciudad"; };
const CIELOS = { oakhaven: ["#312e81", "#c084fc", "#fde68a"], valores: ["#38bdf8", "#bae6fd", "#fef9c3"], mundo: ["#f97316", "#fcd34d", "#fff7ed"] };

export function Escena({ lugar = "", ambientacion = "oakhaven", testigo = "Testigo", seed, ancho = "100%", children }) {
  const tipo = tipoDeLugar(lugar);
  const [c1, c2, c3] = CIELOS[ambientacion] || CIELOS.oakhaven;
  const id = useId().replace(/:/g, "");
  const noche = ambientacion === "oakhaven";
  return (
    <svg viewBox="0 0 360 170" width={ancho} role="img" aria-label={`Escena: ${lugar}`} style={{ display: "block", borderRadius: 16 }}>
      <defs>
        <linearGradient id={`c${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c1} /><stop offset=".7" stopColor={c2} /><stop offset="1" stopColor={c3} /></linearGradient>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".35" /></linearGradient>
      </defs>
      <rect width="360" height="170" fill={`url(#c${id})`} />
      {noche ? <g fill="#fff" opacity=".85">{[[30, 20], [80, 40], [140, 14], [210, 30], [270, 12], [330, 36], [180, 52]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 2 ? 1.2 : 1.8} />)}<circle cx="310" cy="30" r="14" fill="#fef9c3" /><circle cx="316" cy="26" r="12" fill={c1} opacity=".55" /></g>
        : <g><circle cx="300" cy="34" r="16" fill="#fff7ae" opacity=".9" /><path d="M20 40 q10-12 24 0 q12-10 24 2 q-4 8-48 4z" fill="#fff" opacity=".8" /><path d="M150 26 q8-9 20 0 q10-8 20 1 q-4 7-40 4z" fill="#fff" opacity=".7" /></g>}
      {/* fondo según el lugar */}
      {tipo === "biblioteca" && <g><rect x="0" y="40" width="360" height="90" fill="#5b3a29" />{[0, 1, 2, 3].map((r) => <g key={r}><rect x="0" y={46 + r * 22} width="360" height="3" fill="#3b2418" />{Array.from({ length: 26 }).map((_, i) => <rect key={i} x={6 + i * 14} y={26 + r * 22 + 2} width={8 + (i * 7 + r * 3) % 5} height={18 - (i % 3)} fill={["#b91c1c", "#1d4ed8", "#15803d", "#a16207", "#6d28d9"][(i + r) % 5]} />)}</g>)}<rect x="0" y="40" width="360" height="90" fill={`url(#s${id})`} opacity=".5" /></g>}
      {tipo === "herreria" && <g><rect x="0" y="50" width="360" height="80" fill="#44403c" /><rect x="20" y="60" width="70" height="54" rx="6" fill="#1c1917" /><path d="M32 112 C30 90 44 84 40 70 C52 80 58 90 54 112 Z" fill="#f97316" /><path d="M38 112 C38 98 46 94 46 84 C54 92 56 102 52 112 Z" fill="#fde047" /><rect x="230" y="96" width="60" height="14" rx="3" fill="#6b7280" /><rect x="244" y="108" width="32" height="20" fill="#4b5563" /><path d="M222 96 L236 88 L240 96 Z" fill="#6b7280" /><g stroke="#a8a29e" strokeWidth="3"><path d="M130 62 L150 100" /><path d="M150 62 L130 100" /></g></g>}
      {tipo === "puerto" && <g><rect x="0" y="86" width="360" height="84" fill="#1d4ed8" /><path d="M0 100 q15-8 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 v70 H0z" fill="#2563eb" opacity=".8" /><rect x="0" y="120" width="360" height="12" fill="#92400e" />{[20, 80, 140, 200, 260, 320].map((x) => <rect key={x} x={x} y="112" width="6" height="26" fill="#78350f" />)}<g transform="translate(90 70)"><path d="M0 30 L90 30 L76 48 L14 48 Z" fill="#7c2d12" /><rect x="44" y="-6" width="3" height="36" fill="#451a03" /><path d="M47 -4 L47 26 L82 26 Z" fill="#fff" /></g></g>}
      {tipo === "torre" && <g><path d="M0 130 L0 100 Q40 90 80 110 Q140 80 200 110 Q260 85 360 105 L360 130 Z" fill="#4c1d95" opacity=".7" /><g transform="translate(130 6)"><rect x="20" y="30" width="60" height="100" fill="#57534e" /><path d="M14 32 L50 0 L86 32 Z" fill="#7c2d12" /><circle cx="50" cy="56" r="16" fill="#f8fafc" /><path d="M50 56 L50 46 M50 56 L58 60" stroke="#111827" strokeWidth="2.4" strokeLinecap="round" /><rect x="42" y="92" width="16" height="38" rx="8" fill="#292524" />{[30, 46, 62].map((y) => <rect key={y} x="68" y={y + 40} width="6" height="10" fill="#fde68a" />)}</g></g>}
      {tipo === "mercado" && <g><rect x="0" y="60" width="360" height="70" fill="#a16207" opacity=".35" />{[10, 130, 250].map((x, i) => <g key={x} transform={`translate(${x} 38)`}><path d="M0 18 L100 18 L92 0 L8 0 Z" fill={["#dc2626", "#0ea5e9", "#16a34a"][i]} />{[0, 1, 2, 3, 4].map((k) => <rect key={k} x={k * 20} y="0" width="10" height="18" fill="#fff" opacity=".55" />)}<rect x="4" y="18" width="4" height="70" fill="#78350f" /><rect x="92" y="18" width="4" height="70" fill="#78350f" /><rect x="0" y="60" width="100" height="14" fill="#92400e" /><circle cx="22" cy="54" r="6" fill="#ef4444" /><circle cx="36" cy="55" r="6" fill="#f59e0b" /><circle cx="52" cy="54" r="6" fill="#84cc16" /></g>)}</g>}
      {tipo === "museo" && <g><path d="M60 50 L180 14 L300 50 Z" fill="#e7e5e4" /><rect x="60" y="50" width="240" height="8" fill="#d6d3d1" />{[76, 120, 164, 208, 252].map((x) => <g key={x}><rect x={x} y="58" width="16" height="64" fill="#f5f5f4" /><rect x={x} y="58" width="16" height="64" fill={`url(#s${id})`} opacity=".4" /></g>)}<rect x="52" y="122" width="256" height="8" fill="#d6d3d1" /></g>}
      {tipo === "escuela" && <g><rect x="40" y="54" width="280" height="76" fill="#fde68a" /><rect x="40" y="48" width="280" height="10" fill="#b45309" />{[62, 120, 238, 280].map((x) => <rect key={x} x={x} y="68" width="24" height="26" fill="#bae6fd" stroke="#0369a1" strokeWidth="2" />)}<rect x="162" y="82" width="36" height="48" fill="#92400e" /><path d="M150 54 L180 30 L210 54 Z" fill="#b91c1c" /><rect x="0" y="118" width="360" height="12" fill="#4d7c0f" /></g>}
      {tipo === "cueva" && <g><path d="M0 130 L0 60 Q30 20 60 50 Q80 10 120 40 Q160 0 210 40 Q250 10 290 44 Q330 20 360 56 L360 130 Z" fill="#44403c" /><ellipse cx="180" cy="104" rx="64" ry="38" fill="#0c0a09" /><path d="M140 70 L148 100 L156 70 M200 66 L208 96 L216 66" stroke="#78716c" strokeWidth="5" strokeLinecap="round" />{[16, 84, 270, 330].map((x) => <path key={x} d={`M${x} 130 L${x + 8} 100 L${x + 16} 130Z`} fill="#292524" />)}</g>}
      {tipo === "estacion" && <g><rect x="0" y="98" width="360" height="32" fill="#57534e" /><rect x="0" y="108" width="360" height="4" fill="#a8a29e" /><rect x="30" y="52" width="210" height="46" rx="6" fill="#2563eb" /><rect x="30" y="52" width="210" height="10" fill="#1e40af" />{[44, 84, 124, 164, 204].map((x) => <rect key={x} x={x} y="68" width="26" height="18" fill="#bae6fd" />)}<circle cx="60" cy="102" r="8" fill="#111827" /><circle cx="210" cy="102" r="8" fill="#111827" /><rect x="268" y="40" width="56" height="26" rx="4" fill="#111827" /><text x="296" y="58" textAnchor="middle" fontSize="12" fontWeight="800" fill="#4ade80">SALIDAS</text></g>}
      {tipo === "plaza" && <g><path d="M0 130 L0 92 L30 80 L60 92 L90 74 L120 92 L120 130Z" fill="#6d28d9" opacity=".6" /><path d="M240 130 L240 88 L276 70 L310 88 L360 76 L360 130Z" fill="#6d28d9" opacity=".6" /><g transform="translate(150 62)"><ellipse cx="30" cy="62" rx="38" ry="8" fill="#94a3b8" /><rect x="26" y="26" width="8" height="36" fill="#cbd5e1" /><ellipse cx="30" cy="26" rx="20" ry="5" fill="#cbd5e1" /><path d="M30 20 q-18-24-26 0 M30 20 q18-24 26 0" stroke="#7dd3fc" strokeWidth="3" fill="none" /></g>{[20, 320].map((x) => <g key={x}><rect x={x} y="78" width="6" height="40" fill="#78350f" /><circle cx={x + 3} cy="68" r="20" fill="#15803d" /></g>)}</g>}
      {tipo === "ciudad" && <g>{[[10, 60, 40], [56, 40, 56], [118, 70, 36], [168, 30, 62], [236, 56, 44], [290, 44, 52]].map(([x, y, w], i) => <g key={i}><rect x={x} y={y} width={w} height={130 - y} fill={["#4c1d95", "#5b21b6", "#6d28d9"][i % 3]} />{Array.from({ length: 6 }).map((_, k) => <rect key={k} x={x + 6 + (k % 2) * (w / 2 - 4)} y={y + 8 + Math.floor(k / 2) * 18} width="8" height="9" fill={(i + k) % 3 ? "#fde68a" : "#1e1b4b"} />)}</g>)}</g>}
      {/* suelo y sombra */}
      <rect x="0" y="128" width="360" height="42" fill={tipo === "puerto" ? "#78350f" : "#3f3f46"} /><rect x="0" y="128" width="360" height="42" fill={`url(#s${id})`} />
      <path d="M0 128 H360" stroke="#fff" strokeOpacity=".25" />
      {/* testigo */}
      {testigo && <g><ellipse cx="292" cy="160" rx="34" ry="6" fill="#000" opacity=".3" /><Rostro nombre={testigo} x={258} y={80} ancho={68} alto={82} /></g>}
      {children}
    </svg>
  );
}

/* ---------------- Mapa ---------------- */
const SLOTS = [[18, 42], [40, 36], [64, 40], [84, 54], [74, 80], [46, 86], [22, 80], [50, 62], [86, 36], [12, 60]]; // dejan sitio al pin y a su etiqueta
export function asignarPuntos(nombres) {
  const usados = new Set(); const mapa = {};
  nombres.forEach((n) => { let i = hash(n) % SLOTS.length; while (usados.has(i)) i = (i + 1) % SLOTS.length; usados.add(i); mapa[n] = SLOTS[i]; });
  return mapa;
}
const TIERRA = { oakhaven: ["#1e3a5f", "#c8b27a", "#a08a4e"], valores: ["#0e7490", "#86c8a0", "#4f9c75"], mundo: ["#1d4ed8", "#d6a85f", "#b9823a"] };
export function MapaFondo({ ambientacion = "oakhaven", children, alto = 200 }) {
  const [mar, tierra, borde] = TIERRA[ambientacion] || TIERRA.oakhaven;
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "360 / 200", maxHeight: alto + 80, borderRadius: 16, overflow: "hidden", background: mar, boxShadow: "inset 0 0 0 3px #0003" }}>
      <svg viewBox="0 0 360 200" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden="true">
        <g stroke="#fff" strokeOpacity=".12" strokeWidth=".6">{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => <path key={i} d={`M${i * 36} 0 V200`} />)}{[1, 2, 3, 4].map((i) => <path key={i} d={`M0 ${i * 40} H360`} />)}</g>
        <g fill={tierra} stroke={borde} strokeWidth="2.5" strokeLinejoin="round">
          <path d="M20 40 C30 14 70 10 96 28 C110 40 104 60 84 66 C60 72 52 96 30 88 C10 80 8 56 20 40 Z" />
          <path d="M130 20 C160 4 210 10 230 34 C246 52 220 66 196 60 C176 56 170 80 146 74 C122 66 116 36 130 20 Z" />
          <path d="M250 70 C280 50 332 56 344 90 C352 120 316 146 284 140 C254 134 232 96 250 70 Z" />
          <path d="M40 130 C70 112 120 118 136 146 C148 170 110 188 76 182 C44 176 22 148 40 130 Z" />
          <path d="M170 120 C200 106 232 126 224 156 C216 182 180 186 164 164 C154 150 158 128 170 120 Z" />
        </g>
        <g fill="#fff" opacity=".7" fontSize="9">{[[300, 20], [200, 100], [120, 100]].map(([x, y], i) => <text key={i} x={x} y={y}>〰</text>)}</g>
        <g transform="translate(330 170)"><circle r="14" fill="#0006" /><path d="M0 -11 L4 0 L0 11 L-4 0 Z" fill="#fff" /><path d="M-11 0 L0 -4 L11 0 L0 4 Z" fill="#fff" opacity=".6" /><text y="-14" textAnchor="middle" fontSize="8" fill="#fff" fontWeight="700">N</text></g>
      </svg>
      {children}
    </div>
  );
}

/* ---------------- Cartel de «SE BUSCA» ---------------- */
export function Cartel({ titulo, recompensa, nombre, rasgos = [], silueta = true, capturado = false, ancho = 190 }) {
  return (
    <div style={{ width: ancho, background: "#f5e6c4", border: "3px solid #7c5a2b", borderRadius: 6, padding: "8px 8px 10px", textAlign: "center", color: "#3b2a14", boxShadow: "0 6px 14px #0004", transform: "rotate(-2deg)", position: "relative", fontFamily: "Georgia, serif" }}>
      <div style={{ fontWeight: 900, letterSpacing: capturado ? 1 : 2, fontSize: capturado ? 17 : 20, lineHeight: 1 }}>{capturado ? "CAPTURADO" : "SE BUSCA"}</div>
      <div style={{ background: "#e8d3a2", border: "2px solid #7c5a2b", margin: "6px auto", width: ancho - 40, borderRadius: 4, overflow: "hidden" }}>
        <Rostro nombre={nombre || "sombra"} rasgos={rasgos} silueta={silueta} ancho={ancho - 44} />
      </div>
      <div style={{ fontWeight: 800, fontSize: 13 }}>{silueta ? "IDENTIDAD DESCONOCIDA" : nombre}</div>
      {recompensa && <div style={{ fontSize: 11, marginTop: 2 }}>Recompensa: {recompensa}</div>}
      {titulo && <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>{titulo}</div>}
    </div>
  );
}

/* ---------------- Rango de detective ---------------- */
export const RANGOS = [
  { min: 0, nombre: "Aprendiz", emoji: "🔰" }, { min: 1, nombre: "Agente", emoji: "🕵️" }, { min: 3, nombre: "Inspector", emoji: "🔎" },
  { min: 5, nombre: "Comisario", emoji: "⭐" }, { min: 8, nombre: "Leyenda del Códice", emoji: "👑" },
];
export const rangoDe = (n) => { let i = 0; RANGOS.forEach((r, k) => { if (n >= r.min) i = k; }); const sig = RANGOS[i + 1]; return { ...RANGOS[i], i, siguiente: sig, falta: sig ? sig.min - n : 0 }; };

/* ---------------- Máquina de escribir ---------------- */
export function useMaquina(texto, activo = true, velocidad = 22) {
  const [n, setN] = useState(0);
  const reducir = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    setN(0);
    if (!activo || !texto) return undefined;
    if (reducir) { setN(texto.length); return undefined; }
    const t = setInterval(() => setN((x) => { if (x >= texto.length) { clearInterval(t); return x; } return x + 1; }), velocidad);
    return () => clearInterval(t);
  }, [texto, activo, velocidad, reducir]);
  const completo = n >= (texto || "").length;
  return { texto: (texto || "").slice(0, n), completo, saltar: () => setN((texto || "").length) };
}

export function Globo({ quien, texto, color = "#fff", children, activo = true, lado = "izq" }) {
  const m = useMaquina(texto, activo);
  return (
    <div onClick={m.saltar} style={{ position: "relative", background: color, color: "#1e293b", borderRadius: 16, padding: "10px 12px", boxShadow: "0 2px 8px #0002", border: "2px solid #0f172a14", cursor: m.completo ? "default" : "pointer" }}>
      {quien && <div style={{ fontSize: 11, fontWeight: 800, color: "#6366f1", marginBottom: 2 }}>{quien}</div>}
      <div style={{ whiteSpace: "pre-line", lineHeight: 1.45, minHeight: 20 }}>{m.texto}{!m.completo && <span style={{ opacity: 0.5 }}>▍</span>}</div>
      {children && m.completo && <div style={{ marginTop: 6 }}>{children}</div>}
      <span style={{ position: "absolute", bottom: -9, [lado === "izq" ? "left" : "right"]: 24, width: 0, height: 0, borderLeft: "9px solid transparent", borderRight: "9px solid transparent", borderTop: `10px solid ${color}` }} />
    </div>
  );
}

/* ---------------- Sonidos (WebAudio, sin archivos) ---------------- */
let ac = null;
const silenciado = () => { try { return localStorage.getItem("detectives_mute") === "1"; } catch { return false; } };
export const fijarSilencio = (v) => { try { localStorage.setItem("detectives_mute", v ? "1" : "0"); } catch { /* sin almacenamiento */ } };
export const estaSilenciado = silenciado;
function tono(f, ini, dur, tipo = "sine", vol = 0.08) {
  if (silenciado()) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
    const o = ac.createOscillator(), g = ac.createGain(); o.type = tipo; o.frequency.value = f;
    const t0 = ac.currentTime + ini; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur + 0.05);
  } catch { /* sin audio: no pasa nada */ }
}
export const sonido = {
  click: () => tono(520, 0, 0.07, "triangle"),
  ok: () => { tono(660, 0, 0.12); tono(880, 0.1, 0.16); tono(1320, 0.22, 0.2); },
  mal: () => { tono(220, 0, 0.18, "sawtooth", 0.06); tono(150, 0.14, 0.26, "sawtooth", 0.06); },
  viaje: () => { [300, 380, 460, 540, 620].forEach((f, i) => tono(f, i * 0.12, 0.2, "triangle", 0.05)); },
  sirena: () => { for (let i = 0; i < 4; i++) { tono(700, i * 0.4, 0.2, "square", 0.04); tono(520, i * 0.4 + 0.2, 0.2, "square", 0.04); } },
  victoria: () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tono(f, i * 0.13, 0.22, "triangle", 0.07)); },
  derrota: () => { [392, 330, 262, 196].forEach((f, i) => tono(f, i * 0.2, 0.3, "sawtooth", 0.05)); },
};
