// =====================================================================================
//  LA COMARCA DE OAKHAVEN DENTRO DEL MUNDO CÓDICE (lógica pura, sin pantalla: se puede probar sola)
//  - Aportes: el oro y el XP que se ganan en el mundo suman GP y FP al reino del estudiante.
//  - Batallas: un reino ataca una provincia de otro reino respondiendo preguntas.
//  - Mapa: reinos ordenados con sus provincias.
// =====================================================================================

export const CONFIG_COMARCA_DEFECTO = {
  comarca_activo: 1,            // la Sala de la Comarca existe y muestra el mapa
  comarca_aportes_activo: 1,    // el oro/XP del mundo suma GP/FP al reino
  comarca_oro_por_gp: 10,       // cuántas monedas ganadas = 1 GP
  comarca_xp_por_fp: 25,        // cuánto XP ganado = 1 FP
  comarca_tope_gp_dia: 5,       // máximo de GP que un estudiante aporta por día
  comarca_tope_fp_dia: 5,       // máximo de FP que un estudiante aporta por día
  comarca_batallas_activo: 0,   // las batallas entre reinos empiezan CERRADAS: la docente las abre
  comarca_batallas_dia: 2,      // batallas por estudiante por día
  comarca_proteccion_min: 30,   // tras cambiar de dueña, una provincia no se puede atacar durante estos minutos
  comarca_batalla_aciertos: 3,  // aciertos para ganar una batalla
  comarca_batalla_vidas: 2,     // errores que se aguantan antes de perder
};

// El día del juego empieza a la medianoche de Colombia (UTC−5): "2026-10-06"
export function diaColombia(ahora = Date.now()) { return new Date(ahora - 5 * 3600000).toISOString().slice(0, 10); }
const ent = (v, def = 0) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? n : def; };

// ¿Cuánto GP y FP aporta esta recompensa? Lleva el "resto" (monedas o XP que todavía no completan 1 GP/FP) y el tope diario.
//  fila = { xp_resto, oro_resto, dia, gp_hoy, fp_hoy } o null si es la primera vez.
// Devuelve { gp, fp, fila } con la fila nueva para guardar.
export function calcularAporte({ xp = 0, oro = 0, fila = null, cfg = CONFIG_COMARCA_DEFECTO, hoy = diaColombia() }) {
  const oroPorGp = ent(cfg.comarca_oro_por_gp), xpPorFp = ent(cfg.comarca_xp_por_fp);
  const f = fila || {}, mismoDia = f.dia === hoy;
  const gpHoy = mismoDia ? ent(f.gp_hoy) : 0, fpHoy = mismoDia ? ent(f.fp_hoy) : 0;
  const oroTotal = Math.max(0, ent(f.oro_resto) + Math.max(0, ent(oro))), xpTotal = Math.max(0, ent(f.xp_resto) + Math.max(0, ent(xp)));
  const gpBruto = oroPorGp > 0 ? Math.floor(oroTotal / oroPorGp) : 0, fpBruto = xpPorFp > 0 ? Math.floor(xpTotal / xpPorFp) : 0;
  const gp = Math.max(0, Math.min(gpBruto, ent(cfg.comarca_tope_gp_dia) - gpHoy)), fp = Math.max(0, Math.min(fpBruto, ent(cfg.comarca_tope_fp_dia) - fpHoy));
  return {
    gp, fp,
    fila: { xp_resto: xpPorFp > 0 ? xpTotal % xpPorFp : 0, oro_resto: oroPorGp > 0 ? oroTotal % oroPorGp : 0, dia: hoy, gp_hoy: gpHoy + gp, fp_hoy: fpHoy + fp },   // lo que sobra por encima del tope no se acumula
  };
}

// ---------- batallas ----------
export const estaProtegida = (prov, ahora = Date.now()) => !!prov.protegida_hasta && Date.parse(prov.protegida_hasta) > ahora;

// Las provincias de un reino que se pueden atacar: no protegidas, y el reino no se queda sin ninguna.
export function provinciasAtacables(provincias, reinoObjetivoId, miReinoId, ahora = Date.now()) {
  if (reinoObjetivoId == null || reinoObjetivoId === miReinoId) return [];
  const suyas = provincias.filter((p) => p.reino_actual_id === reinoObjetivoId);
  if (suyas.length <= 1) return [];
  return suyas.filter((p) => !estaProtegida(p, ahora));
}

// ¿Puede esta persona librar una batalla ahora?  motivo: "cerrado" | "sin_reino" | "limite"
export function puedeBatallar({ activo, miReinoId, batallasHoy = 0, limite = 0 }) {
  if (!activo) return { ok: false, motivo: "cerrado" };
  if (miReinoId == null) return { ok: false, motivo: "sin_reino" };
  if (limite > 0 && batallasHoy >= limite) return { ok: false, motivo: "limite" };
  return { ok: true };
}

// Los reinos con algo atacable (para elegir a quién retar)
export function reinosAtacables(reinos, provincias, miReinoId, ahora = Date.now()) {
  return reinos.filter((r) => r.id !== miReinoId).map((r) => ({ reino: r, provincias: provinciasAtacables(provincias, r.id, miReinoId, ahora) })).filter((x) => x.provincias.length > 0);
}

// ---------- mapa ----------
// "Templo del Sol — Hierro" → "Hierro"
export const nombreCortoProvincia = (p) => String((p && p.nombre) || "").split("— ")[1] || String((p && p.nombre) || "");

// Reinos ordenados: más provincias primero; si empatan, más GP; luego más FP.
export function resumenReinos(reinos, provincias, ahora = Date.now()) {
  return reinos.map((r) => {
    const ps = provincias.filter((p) => p.reino_actual_id === r.id);
    return { ...r, provincias: ps, ciudades: ps.filter((p) => p.nivel === "ciudad").length, protegidas: ps.filter((p) => estaProtegida(p, ahora)).length };
  }).sort((a, b) => b.provincias.length - a.provincias.length || (b.gp || 0) - (a.gp || 0) || (b.fp || 0) - (a.fp || 0) || (a.orden || 0) - (b.orden || 0));
}
