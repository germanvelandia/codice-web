// Piezas del constructor de Personaje — todo dibujado en SVG (sin depender
// de imágenes externas), estilo plano, para poder combinarlas libremente.
// Cada función devuelve un string de SVG interno (paths/shapes), pensado
// para insertarse dentro de un <svg viewBox="0 0 100 120"> de 100x120.

export const CATALOGO_BASE = {
  cuerpo: [
    { svg_key: "clasico", nombre: "Clásico", costo_monedas: 0 },
  ],
  pelo: [
    { svg_key: "corto", nombre: "Corto", costo_monedas: 0 },
    { svg_key: "largo", nombre: "Largo", costo_monedas: 15 },
    { svg_key: "rizado", nombre: "Rizado", costo_monedas: 15 },
    { svg_key: "mohicano", nombre: "Mohicano", costo_monedas: 25 },
    { svg_key: "calvo", nombre: "Rapado", costo_monedas: 10 },
  ],
  atuendo: [
    { svg_key: "tunica", nombre: "Túnica de Aprendiz", costo_monedas: 0 },
    { svg_key: "armadura", nombre: "Armadura de Caballero", costo_monedas: 30 },
    { svg_key: "capa_mago", nombre: "Túnica de Mago", costo_monedas: 25 },
    { svg_key: "explorador", nombre: "Traje de Explorador", costo_monedas: 20 },
    { svg_key: "real", nombre: "Vestidura Real", costo_monedas: 40 },
  ],
  accesorio: [
    { svg_key: "ninguno", nombre: "Ninguno", costo_monedas: 0 },
    { svg_key: "corona", nombre: "Corona", costo_monedas: 35 },
    { svg_key: "gafas", nombre: "Gafas", costo_monedas: 15 },
    { svg_key: "sombrero_mago", nombre: "Sombrero de Mago", costo_monedas: 25 },
    { svg_key: "capa", nombre: "Capa Heroica", costo_monedas: 30 },
    { svg_key: "antifaz", nombre: "Antifaz", costo_monedas: 15 },
  ],
};

export function svgCuerpo(pielColor) {
  return `
    <ellipse cx="50" cy="105" rx="26" ry="8" fill="black" opacity="0.08" />
    <circle cx="50" cy="45" r="24" fill="${pielColor}" />
    <circle cx="41" cy="44" r="2.3" fill="#1e1b1b" />
    <circle cx="59" cy="44" r="2.3" fill="#1e1b1b" />
    <path d="M43 54 Q50 59 57 54" stroke="#1e1b1b" stroke-width="1.8" fill="none" stroke-linecap="round" />
    <ellipse cx="34" cy="50" rx="3" ry="2.5" fill="${pielColor}" opacity="0.7" />
    <ellipse cx="66" cy="50" rx="3" ry="2.5" fill="${pielColor}" opacity="0.7" />
  `;
}

export function svgPelo(key, color) {
  switch (key) {
    case "largo":
      return `<path d="M26 40 Q22 70 30 78 L33 60 Q26 45 32 30 Z" fill="${color}" />
              <path d="M74 40 Q78 70 70 78 L67 60 Q74 45 68 30 Z" fill="${color}" />
              <path d="M25 32 Q50 10 75 32 Q75 22 50 18 Q25 22 25 32 Z" fill="${color}" />`;
    case "rizado":
      return Array.from({ length: 9 }).map((_, i) => {
        const ang = (i / 8) * Math.PI - Math.PI;
        const x = 50 + Math.cos(ang) * 26;
        const y = 30 + Math.sin(ang) * 16;
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="${color}" />`;
      }).join("");
    case "mohicano":
      return `<path d="M44 12 L50 34 L56 12 Z" fill="${color}" />
              <path d="M40 18 L46 34 L50 20 Z" fill="${color}" />
              <path d="M60 18 L54 34 L50 20 Z" fill="${color}" />`;
    case "calvo":
      return `<path d="M28 32 Q50 24 72 32" stroke="${color}" stroke-width="2" fill="none" opacity="0.3" />`;
    case "corto":
    default:
      return `<path d="M25 34 Q26 14 50 14 Q74 14 75 34 Q68 22 50 22 Q32 22 25 34 Z" fill="${color}" />`;
  }
}

export function svgAtuendo(key, color) {
  switch (key) {
    case "armadura":
      return `<path d="M22 98 Q50 78 78 98 L78 118 L22 118 Z" fill="${color}" />
              <path d="M35 88 L65 88 L62 100 L38 100 Z" fill="#94A3B8" opacity="0.6" />
              <circle cx="50" cy="94" r="4" fill="#CBD5E1" />
              <path d="M22 98 L14 108 L22 112 Z" fill="${color}" />
              <path d="M78 98 L86 108 L78 112 Z" fill="${color}" />`;
    case "capa_mago":
      return `<path d="M20 100 Q50 76 80 100 L84 120 L16 120 Z" fill="${color}" />
              <path d="M38 88 L62 88 L58 120 L42 120 Z" fill="${color}" opacity="0.7" />
              <circle cx="44" cy="98" r="2" fill="#FDE68A" />
              <circle cx="56" cy="105" r="2" fill="#FDE68A" />
              <circle cx="50" cy="92" r="2" fill="#FDE68A" />`;
    case "explorador":
      return `<path d="M24 98 Q50 82 76 98 L76 118 L24 118 Z" fill="${color}" />
              <rect x="40" y="95" width="20" height="12" fill="#78350F" opacity="0.4" />
              <path d="M24 98 L18 90 L28 92 Z" fill="${color}" />
              <path d="M76 98 L82 90 L72 92 Z" fill="${color}" />`;
    case "real":
      return `<path d="M18 100 Q50 74 82 100 L86 120 L14 120 Z" fill="${color}" />
              <path d="M32 100 L68 100 L64 120 L36 120 Z" fill="#FDE68A" opacity="0.5" />
              <path d="M18 100 Q50 90 82 100" stroke="#FDE68A" stroke-width="2" fill="none" />`;
    case "tunica":
    default:
      return `<path d="M26 98 Q50 82 74 98 L74 118 L26 118 Z" fill="${color}" />
              <path d="M26 98 L20 108 L26 112 Z" fill="${color}" />
              <path d="M74 98 L80 108 L74 112 Z" fill="${color}" />`;
  }
}

export function svgAccesorio(key) {
  switch (key) {
    case "corona":
      return `<path d="M36 18 L40 8 L46 16 L50 6 L54 16 L60 8 L64 18 Z" fill="#FBBF24" stroke="#B45309" stroke-width="0.8" />`;
    case "gafas":
      return `<circle cx="41" cy="44" r="6" fill="none" stroke="#1e293b" stroke-width="2" />
              <circle cx="59" cy="44" r="6" fill="none" stroke="#1e293b" stroke-width="2" />
              <line x1="47" y1="44" x2="53" y2="44" stroke="#1e293b" stroke-width="2" />`;
    case "sombrero_mago":
      return `<path d="M50 2 L64 30 L36 30 Z" fill="#5B21B6" />
              <ellipse cx="50" cy="30" rx="20" ry="4" fill="#5B21B6" />
              <circle cx="50" cy="12" r="2" fill="#FDE68A" />`;
    case "capa":
      return `<path d="M30 60 Q20 100 34 118 L40 100 Q34 78 40 62 Z" fill="#DC2626" opacity="0.85" />
              <path d="M70 60 Q80 100 66 118 L60 100 Q66 78 60 62 Z" fill="#DC2626" opacity="0.85" />`;
    case "antifaz":
      return `<path d="M32 42 Q41 38 48 42 Q41 48 32 46 Z" fill="#1e293b" />
              <path d="M68 42 Q59 38 52 42 Q59 48 68 46 Z" fill="#1e293b" />
              <path d="M48 42 L52 42" stroke="#1e293b" stroke-width="2" />`;
    case "ninguno":
    default:
      return "";
  }
}

// Arma el SVG completo del personaje (orden: atuendo -> cuerpo -> pelo -> accesorio).
export function personajeSvg({ pielColor, peloKey, peloColor, atuendoKey, atuendoColor, accesorioKey }) {
  return `
    ${svgAtuendo(atuendoKey || "tunica", atuendoColor || "#7C3AED")}
    ${svgCuerpo(pielColor || "#F5D0A9")}
    ${svgPelo(peloKey || "corto", peloColor || "#3B2314")}
    ${svgAccesorio(accesorioKey || "ninguno")}
  `;
}
