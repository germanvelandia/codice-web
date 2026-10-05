// Lógica de las piezas que mejoran al personaje (sin imágenes ni base de datos,
// para que se pueda cargar en cualquier pantalla sin pesar nada).

import { NIVELES_POR_DEFECTO, nivelesActuales } from "./configNiveles";

// El nivel del personaje sube con la CANTIDAD de piezas que el estudiante compró. Cuántas
// piezas pide cada nivel, cómo se llama y cómo se ve se configura en Editar niveles
// (configNiveles.js); estos son los 4 de fábrica.
export const NIVELES_PERSONAJE = NIVELES_POR_DEFECTO;

export function nivelPersonaje(cantidad, niveles = nivelesActuales()) {
  let actual = niveles[0];
  niveles.forEach((n) => { if (cantidad >= n.desde) actual = n; });
  const siguiente = niveles.find((n) => n.nivel === actual.nivel + 1) || null;
  return { ...actual, siguiente, faltan: siguiente ? siguiente.desde - cantidad : 0 };
}

export const TIPOS_BENEFICIO = [
  { key: "xp_pct", label: "Más experiencia (%)", usaValor: true },
  { key: "monedas_extra", label: "Monedas extra en cada acción positiva", usaValor: true },
  { key: "escudo_vida", label: "Escudo: absorbe 1 resta de vida por semana", usaValor: false },
  { key: "privilegio", label: "Privilegio de clase (lo concedés vos)", usaValor: false },
  { key: "ninguno", label: "Solo decorativa", usaValor: false },
];

// Los beneficios automáticos siempre se explican con su valor real (así, si editás
// el valor, el texto no queda desactualizado); el privilegio y lo decorativo usan
// el texto que escribas.
export function textoBeneficio(m) {
  const v = Number(m.beneficio_valor) || 0;
  switch (m.beneficio_tipo) {
    case "xp_pct": return `+${v}% de experiencia cuando tu docente te da puntos`;
    case "monedas_extra": return `+${v} ${v === 1 ? "moneda extra" : "monedas extra"} en cada acción positiva`;
    case "escudo_vida": return "Te protege de 1 resta de vida por semana";
    case "privilegio": return (m.beneficio_texto || "").trim() || "Un privilegio de clase";
    default: return (m.beneficio_texto || "").trim() || "Solo decorativa";
  }
}

export const DIAS_RECARGA_ESCUDO = 7;

export function escudoDisponible(fila, ahora = new Date()) {
  if (!fila.ultimo_uso) return true;
  return (ahora - new Date(fila.ultimo_uso)) / 86400000 >= DIAS_RECARGA_ESCUDO;
}

// "filas" = lo que el estudiante compró: [{ id, ultimo_uso, canjeado, mejora: {...pieza} }].
// Una pieza que después se oculte del catálogo sigue dando su beneficio: ya la compró.
export function calcularBonos(filas, ahora = new Date()) {
  let xpPct = 0, monedasExtra = 0, escudo = null;
  (filas || []).forEach((f) => {
    const m = f.mejora;
    if (!m) return;
    if (m.beneficio_tipo === "xp_pct") xpPct += Number(m.beneficio_valor) || 0;
    else if (m.beneficio_tipo === "monedas_extra") monedasExtra += Number(m.beneficio_valor) || 0;
    else if (m.beneficio_tipo === "escudo_vida" && !escudo && escudoDisponible(f, ahora)) escudo = f;
  });
  return { xpPct, monedasExtra, escudo };
}

// Aplica los beneficios a una acción del catálogo (la que da el docente con ⚡ Puntos).
//  · La experiencia extra siempre es al menos +1 (se redondea hacia arriba), y solo
//    cuando la acción suma experiencia.
//  · Las monedas extra se suman junto con la moneda que ya se daba por acción positiva.
//  · El escudo anula una resta de vida y queda "usado" (recarga a los 7 días).
// Sin beneficios, devuelve la acción tal cual.
export function aplicarBonosAccion(accion, bonos) {
  const xpBase = accion.xp || 0;
  const vidaBase = accion.vida || 0;
  const res = { xp: xpBase, vida: vidaBase, monedasExtra: 0, escudoUsado: null, sufijo: "" };
  if (!bonos) return res;
  const notas = [];
  if (xpBase > 0 && bonos.xpPct > 0) {
    const extra = Math.ceil((xpBase * bonos.xpPct) / 100);
    res.xp = xpBase + extra;
    notas.push(`+${extra} XP por sus piezas`);
  }
  if (xpBase > 0 && bonos.monedasExtra > 0) {
    res.monedasExtra = Math.round(bonos.monedasExtra);
    notas.push(`+${res.monedasExtra} 🪙 por sus piezas`);
  }
  if (vidaBase < 0 && bonos.escudo) {
    res.vida = 0;
    res.escudoUsado = bonos.escudo;
    notas.push(`🛡️ el escudo absorbió ${Math.abs(vidaBase)} de vida`);
  }
  res.sufijo = notas.length ? ` (${notas.join(", ")})` : "";
  return res;
}
