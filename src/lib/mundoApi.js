import { supabase } from "./supabaseClient";
import { zonaDeMision, ZONAS, RETADORES } from "../game/zonas";
import { misionVisiblePara } from "./gradosMundo";
import { validarContenido, CLAVES_TIPO } from "../game/acertijos";
import { CONFIG_COMARCA_DEFECTO, calcularAporte, diaColombia, puedeBatallar } from "../game/comarca";
import { validarSecreto, limpiarSecreto, secretoJugable } from "../game/secretos";
import { CONFIG_MONSTRUOS_DEFECTO, validarMonstruo, limpiarMonstruo, nivelDeXp, xpParaNivel, NIVEL_MAX, calcularPremioMonstruo } from "../game/monstruos";
import { CONFIG_LLAVES_DEFECTO, LLAVES, llaveDe, puedeConseguir, camaraDesbloqueada } from "../game/llaves";
import { ITEMS, RECETAS, MAX_POR_ITEM, PARCELA, esDecoracion, celdaValida, puedeFabricar, cantidadPorRecoleccion } from "../game/items";

// Todo lo que el Mundo CÓDICE necesita de la base de datos: las misiones del mundo, cuáles
// ya completó cada estudiante, y entregar el premio (XP y monedas) al completarlas.

// Misiones de ejemplo: se usan SOLO si todavía no se corrió el SQL 62 (el mundo funciona
// en "modo prueba": se puede jugar, pero no se guarda nada ni se entregan premios).
export const MISIONES_EJEMPLO = [
  { id: 1, lugar: "biblioteca", npc_nombre: "La bibliotecaria", titulo: "La regla de oro", texto: "Muchas tradiciones comparten una idea: tratar a los demás como querríamos que nos traten. ¿Cuál de estas acciones la practica?", opciones: ["Burlarme del compañero que se equivocó", "Ayudar al compañero que no entendió el tema", "Copiarme de otro y no decir nada"], correcta: 1, pista: "Piensa: ¿cómo te gustaría que te trataran si fueras tú el que no entendió?", retro: "¡Exacto! Ayudar a otros es poner en práctica la regla de oro.", xp: 20, oro: 5 },
  { id: 2, lugar: "agora", npc_nombre: "El guardián del Ágora", titulo: "El dilema del patio", texto: "En el descanso ves que un compañero nuevo está comiendo solo, sin nadie con quien hablar. ¿Qué haces?", opciones: ["Lo invito a sentarse con mi grupo", "Hago como que no lo vi", "Les cuento a todos que está solo"], correcta: 0, pista: "Un gesto pequeño puede cambiarle el día a alguien.", retro: "¡Muy bien! La empatía empieza con un gesto sencillo.", xp: 20, oro: 5 },
  { id: 3, lugar: "templo", npc_nombre: "La guía del Templo", titulo: "La fuente de la gratitud", texto: "Hoy hablamos de gratitud. ¿Cuál de estas frases la expresa mejor?", opciones: ["Gracias por ayudarme con la tarea, me sirvió mucho", "Siempre quiero más de lo que tengo", "No me debían nada, así que no hay nada que agradecer"], correcta: 0, pista: "Gratitud es reconocer lo que otros hacen por ti.", retro: "¡Así es! Agradecer fortalece los vínculos.", xp: 15, oro: 5 },
  { id: 4, lugar: "mercado", npc_nombre: "El mercader", titulo: "Las cuentas del Códice", texto: "En la tienda de piezas, una 🧥 Capa cuesta 40 monedas y tú tienes 28. ¿Cuántas monedas te faltan para comprarla?", opciones: ["18", "12", "8"], correcta: 1, pista: "Resta: 40 − 28.", retro: "¡Correcto! Te faltan 12 monedas.", xp: 15, oro: 10 },
  { id: 5, lugar: "plaza", npc_nombre: "El sabio de la fuente", titulo: "El acertijo del sabio", texto: "«Entre más lo compartes, más grande se hace. ¿Qué es?»", opciones: ["Una moneda", "El conocimiento", "Un pastel"], correcta: 1, pista: "Si lo enseñas, tú también lo sigues teniendo.", retro: "¡Sabia respuesta! El conocimiento crece al compartirlo.", xp: 20, oro: 5 },
];

// Deja cada misión en la forma que entiende el juego (las opciones pueden venir como lista o como texto).
function normalizarMision(m) {
  let opciones = m.opciones;
  if (typeof opciones === "string") { try { opciones = JSON.parse(opciones); } catch (e) { opciones = []; } }
  return {
    id: m.id, lugar: m.lugar || "plaza", npc_nombre: m.npc_nombre || "Aldeano", npc_emoji: m.npc_emoji || null, npc_sprite: m.npc_sprite || null,
    titulo: m.titulo || "Misión", texto: m.texto || "", opciones: Array.isArray(opciones) ? opciones.map(String) : [],
    correcta: Number(m.correcta) || 0, pista: m.pista || "", retro: m.retro || "", xp: Number(m.xp) || 0, oro: Number(m.oro) || 0,
    grado_id: m.grado_id ? String(m.grado_id) : null,                     // null = para todos los cursos
    zona: zonaDeMision(m),                                                 // en qué zona está (si no existe la columna, se deduce del lugar)
    _tieneZona: Object.prototype.hasOwnProperty.call(m, "zona"),           // false si todavía no se corrió el SQL 64
    _tieneGrado: Object.prototype.hasOwnProperty.call(m, "grado_id"),     // false si todavía no se corrió el SQL 63
  };
}

// Las misiones que ve un estudiante: las de su curso más las que son para todos los cursos.
// (Si todavía no se corrió el SQL 63, la tabla no tiene curso y todas son para todos.)
export async function fetchMisionesMundo(gradoId) {
  const { data, error } = await supabase.from("mundo_misiones").select("*").eq("activo", true).order("orden").order("id");
  if (error) throw error;
  return (data || [])
    .filter((m) => gradoId != null ? misionVisiblePara(m.grado_id, gradoId) : !m.grado_id)   // para todos, para todo su nivel (octavo…) o para su curso
    .map(normalizarMision).filter((m) => m.opciones.length >= 2);
}

export async function fetchHechasMundo(estudianteId) {
  const { data, error } = await supabase.from("mundo_misiones_hechas").select("mision_id").eq("estudiante_id", estudianteId);
  if (error) throw error;
  return (data || []).map((f) => f.mision_id);
}

// Completa una misión: primero se registra (la clave única impide cobrar el premio dos veces) y
// después se entrega el premio. Si el premio falla, se deshace el registro para poder reintentar.
export async function completarMisionMundo(estudianteId, mision) {
  const { error } = await supabase.from("mundo_misiones_hechas").insert({ estudiante_id: estudianteId, mision_id: mision.id });
  if (error) {
    if (error.code === "23505") return { ok: true, yaEstaba: true }; // ya la tenía registrada (por ejemplo, desde otro dispositivo)
    return { ok: false, mensaje: error.message };
  }
  const xp = mision.xp || 0, oro = mision.oro || 0;
  try {
    const [, rpc] = await Promise.all([
      supabase.from("historial_gamificacion").insert({ estudiante_id: estudianteId, etiqueta: `🌍 Mundo: ${mision.titulo}`, xp, vida: 0, monedas: oro, categoria: "general" }),
      supabase.rpc("ajustar_progreso", { p_estudiante_id: estudianteId, p_delta_xp: xp, p_delta_vida: 0, p_delta_monedas: oro }),
    ]);
    if (rpc.error) throw rpc.error;
    const fila = rpc.data?.[0];
    return { ok: true, xp: fila?.xp, oro: fila?.monedas, comarca: await aportarAComarca(estudianteId, { xp, oro, motivo: `Mundo CÓDICE: ${mision.titulo}` }) };
  } catch (e) {
    await supabase.from("mundo_misiones_hechas").delete().eq("estudiante_id", estudianteId).eq("mision_id", mision.id);
    return { ok: false, mensaje: (e && e.message) || "no se pudo entregar el premio" };
  }
}

// =====================================================================================
//  PARA EL DOCENTE: editar las misiones del mundo (se usa desde Estudiantes → Misiones del Mundo)
// =====================================================================================

// Todas las misiones, también las ocultas, con los campos que se editan.
export async function fetchMisionesMundoAdmin() {
  const { data, error } = await supabase.from("mundo_misiones").select("*").order("orden").order("id");
  if (error) throw error;
  return (data || []).map((m) => ({ ...normalizarMision(m), activo: m.activo !== false, orden: Number(m.orden) || 0 }));
}

export async function crearMisionMundo(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("mundo_misiones").insert({ ...campos, docente_id: userData?.user?.id || null }).select().single();
  if (error) throw error;
  return data;
}

// Crea muchas misiones de una vez (para el Excel). Devuelve cuántas se crearon.
export async function crearMisionesMundo(lista) {
  const { data: userData } = await supabase.auth.getUser();
  const docente = userData?.user?.id || null; let creadas = 0;
  for (let i = 0; i < lista.length; i += 50) {
    const trozo = lista.slice(i, i + 50).map((c) => ({ ...c, docente_id: docente }));
    const { error } = await supabase.from("mundo_misiones").insert(trozo);
    if (error) { const e = new Error(error.message); e.creadas = creadas; throw e; }
    creadas += trozo.length;
  }
  return creadas;
}

export async function editarMisionMundo(id, campos) {
  const { error } = await supabase.from("mundo_misiones").update(campos).eq("id", id);
  if (error) throw error;
}

// Cambia los mismos campos a muchas misiones a la vez (en bloques de 200; cada bloque es una sola operación).
// Devuelve cuántas se actualizaron; si un bloque falla, el error trae cuántas alcanzaron a cambiar (e.hechas).
export async function editarMisionesMundo(ids, campos) {
  let hechas = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const trozo = ids.slice(i, i + 200);
    const { error } = await supabase.from("mundo_misiones").update(campos).in("id", trozo);
    if (error) { const e = new Error(error.message); e.hechas = hechas; throw e; }
    hechas += trozo.length;
  }
  return hechas;
}
export async function eliminarMisionesMundo(ids) {
  let hechas = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const trozo = ids.slice(i, i + 200);
    const { error } = await supabase.from("mundo_misiones").delete().in("id", trozo);
    if (error) { const e = new Error(error.message); e.hechas = hechas; throw e; }
    hechas += trozo.length;
  }
  return hechas;
}

// Borrar una misión también borra el registro de quiénes la completaron (los premios ya entregados no se tocan).
export async function eliminarMisionMundo(id) {
  const { error } = await supabase.from("mundo_misiones").delete().eq("id", id);
  if (error) throw error;
}

// Cuántos estudiantes completaron cada misión: { [misionId]: cantidad }
export async function fetchConteoHechasMundo() {
  const { data, error } = await supabase.from("mundo_misiones_hechas").select("mision_id");
  if (error) throw error;
  const conteo = {}; (data || []).forEach((f) => { conteo[f.mision_id] = (conteo[f.mision_id] || 0) + 1; });
  return conteo;
}

// =====================================================================================
//  ZONAS DEL MUNDO: qué abrió la docente para cada curso y cuántas misiones se piden
// =====================================================================================

// Lo que necesita un estudiante: qué zonas abrió la docente para SU curso y el requisito de cada zona.
// Si todavía no se corrió el SQL 64 devuelve error (y el mundo se queda solo con la Aldea).
export async function fetchZonasMundo(gradoId) {
  const [cfg, ab] = await Promise.all([
    supabase.from("mundo_zonas_config").select("*"),
    gradoId == null ? Promise.resolve({ data: [], error: null }) : supabase.from("mundo_zonas_abiertas").select("*").eq("grado_id", String(gradoId)),
  ]);
  if (cfg.error) throw cfg.error;
  if (ab.error) throw ab.error;
  const requisitos = {}; (cfg.data || []).forEach((f) => { requisitos[f.zona] = Number(f.misiones_requeridas); });
  return { abiertas: (ab.data || []).filter((f) => f.abierta).map((f) => f.zona), requisitos };
}

// Para el editor de la docente: los requisitos y TODAS las aperturas por curso.
export async function fetchZonasAdmin() {
  const [cfg, ab] = await Promise.all([supabase.from("mundo_zonas_config").select("*"), supabase.from("mundo_zonas_abiertas").select("*")]);
  if (cfg.error) throw cfg.error;
  if (ab.error) throw ab.error;
  const requisitos = {}; (cfg.data || []).forEach((f) => { requisitos[f.zona] = Number(f.misiones_requeridas); });
  return { requisitos, abiertas: (ab.data || []).map((f) => ({ grado_id: String(f.grado_id), zona: f.zona, abierta: !!f.abierta })) };
}

export async function guardarRequisitoZona(zona, cantidad) {
  const { error } = await supabase.from("mundo_zonas_config").upsert({ zona, misiones_requeridas: cantidad }, { onConflict: "zona" });
  if (error) throw error;
}

export async function abrirZonaCurso(gradoId, zona, abierta) {
  const { error } = await supabase.from("mundo_zonas_abiertas").upsert({ grado_id: String(gradoId), zona, abierta }, { onConflict: "grado_id,zona" });
  if (error) throw error;
}

// =====================================================================================
//  LA POSADA DEL DESCANSO: se recupera vida a cambio de oro. La docente decide si está abierta,
//  cuánto cuesta y cuánta vida da. El descanso lo valida SIEMPRE la base de datos (no lo que cree el navegador).
// =====================================================================================
export const VIDA_MAX = 100;
// Valores por defecto de lo que se puede configurar (la docente los cambia desde el editor)
export const CONFIG_POSADA_DEFECTO = { posada_activa: 1, posada_costo: 15, posada_vida: 25 };

export async function fetchConfigMundo() {
  const { data, error } = await supabase.from("mundo_config").select("*");
  if (error) throw error;
  const cfg = { ...CONFIG_POSADA_DEFECTO, ...CONFIG_DUELO_DEFECTO, ...CONFIG_RETO_DEFECTO, ...CONFIG_RECOLECTA_DEFECTO, ...CONFIG_COMARCA_DEFECTO, ...CONFIG_LLAVES_DEFECTO, ...CONFIG_MONSTRUOS_DEFECTO };
  (data || []).forEach((f) => { if (f.clave in cfg && Number.isFinite(Number(f.valor))) cfg[f.clave] = Number(f.valor); });
  return cfg;
}

export async function guardarConfigMundo(clave, valor) {
  const { error } = await supabase.from("mundo_config").upsert({ clave, valor }, { onConflict: "clave" });
  if (error) throw error;
}

// Lo que necesita el juego: { activa, costo, vida }. Si todavía no existe la tabla (SQL 65), la posada queda cerrada.
export async function fetchPosadaMundo() {
  try { const c = await fetchConfigMundo(); return { activa: c.posada_activa === 1, costo: c.posada_costo, vida: Math.max(1, c.posada_vida) }; }
  catch { return { activa: false, costo: CONFIG_POSADA_DEFECTO.posada_costo, vida: CONFIG_POSADA_DEFECTO.posada_vida }; }
}

// Cuánta vida se recupera y cuánto cuesta para alguien que tiene "vida" (si le falta poco, paga proporcional).
export function planDeDescanso(vida, cfg) {
  const falta = Math.max(0, VIDA_MAX - vida), porUso = Math.max(1, cfg.vida), restaura = Math.min(porUso, falta);
  return { falta, restaura, costo: Math.ceil((cfg.costo * restaura) / porUso) };
}

export async function descansarEnPosada(estudianteId) {
  const c = await fetchConfigMundo();
  if (c.posada_activa !== 1) return { ok: false, mensaje: "La posada está cerrada por ahora. ¡Vuelve pronto!" };
  const { data: prog, error: e1 } = await supabase.from("progreso").select("vida, monedas").eq("estudiante_id", estudianteId).maybeSingle();
  if (e1) throw e1;
  const vida = typeof prog?.vida === "number" ? prog.vida : VIDA_MAX, monedas = prog?.monedas || 0;
  const plan = planDeDescanso(vida, { costo: c.posada_costo, vida: c.posada_vida });
  if (plan.falta === 0) return { ok: false, vida, monedas, mensaje: "¡Te ves en plena forma! No necesitas descansar." };
  if (monedas < plan.costo) return { ok: false, vida, monedas, mensaje: `Descansar cuesta ${plan.costo} 🪙 y tienes ${monedas}. ¡Completa misiones para ganar más oro!` };
  // 1) se aplica el cambio (si falla, no se registra nada y se avisa)
  const { data, error } = await supabase.rpc("ajustar_progreso", { p_estudiante_id: estudianteId, p_delta_xp: 0, p_delta_vida: plan.restaura, p_delta_monedas: -plan.costo });
  if (error) throw error;
  const fila = data?.[0];
  // 2) queda en el historial (si esto falla no se deshace el descanso: ya se cobró y se recuperó)
  try { await supabase.from("historial_gamificacion").insert({ estudiante_id: estudianteId, etiqueta: "🛏️ Posada del Descanso", xp: 0, vida: plan.restaura, monedas: -plan.costo, categoria: "general" }); } catch { /* el historial es secundario */ }
  return { ok: true, vida: typeof fila?.vida === "number" ? fila.vida : vida + plan.restaura, monedas: typeof fila?.monedas === "number" ? fila.monedas : monedas - plan.costo, restaurado: plan.restaura, costo: plan.costo };
}

// =====================================================================================
//  DUELOS CON LOS GUARDIANES E INSIGNIAS
//  Cada zona tiene un Guardián. Al vencerlo por primera vez, el estudiante gana la insignia de la zona
//  (una sola vez) y un premio. Lo que vale lo decide siempre la base de datos, no el navegador.
// =====================================================================================
export const CONFIG_DUELO_DEFECTO = {
  duelo_activo: 1, duelo_aciertos: 4, duelo_vidas: 3, duelo_espera_min: 0, duelo_xp: 40, duelo_oro: 20,
  duelo_banco_aldea: 0, duelo_banco_bosque: 0, duelo_banco_montana: 0, duelo_banco_lago: 0,
  duelo_exige_aldea: 0, duelo_exige_bosque: 0, duelo_exige_montana: 0,
};

// Todo lo que necesita el juego para los duelos de UN estudiante. Si todavía no existen las tablas (SQL 66), falla
// y el mundo se queda sin Guardianes.
export async function fetchDuelosMundo(estudianteId) {
  const cfg = await fetchConfigMundo();
  const [ins, intentos] = await Promise.all([
    supabase.from("mundo_insignias").select("zona").eq("estudiante_id", estudianteId),
    supabase.from("mundo_duelos").select("zona, creado_en").eq("estudiante_id", estudianteId).eq("ganado", false).order("creado_en", { ascending: false }).limit(60),
  ]);
  if (ins.error) throw ins.error;
  const insignias = (ins.data || []).map((f) => f.zona);
  // espera tras perder: se cuenta desde la última derrota de cada zona
  const esperaHasta = {};
  if (cfg.duelo_espera_min > 0 && !intentos.error) {
    for (const f of intentos.data || []) { if (f.zona in esperaHasta) continue; const t = Date.parse(f.creado_en) + cfg.duelo_espera_min * 60000; esperaHasta[f.zona] = t > Date.now() ? t : 0; }
  }
  // preguntas extra: la categoría de Preguntados que la docente asignó a cada zona
  const bancos = {};
  await Promise.all(ZONAS.filter((z) => cfg[`duelo_banco_${z.key}`] > 0).map(async (z) => {
    const { data } = await supabase.from("trivia_preguntas").select("pregunta, opciones, correcta").eq("categoria_id", cfg[`duelo_banco_${z.key}`]).eq("activa", true).limit(80);
    bancos[z.key] = data || [];
  }));
  const exige = {}; ZONAS.forEach((z) => { exige[z.key] = cfg[`duelo_exige_${z.key}`] === 1; });
  return { activo: cfg.duelo_activo === 1, aciertos: Math.max(1, cfg.duelo_aciertos), vidas: Math.max(1, cfg.duelo_vidas), esperaMin: Math.max(0, cfg.duelo_espera_min), premio: { xp: cfg.duelo_xp, oro: cfg.duelo_oro }, exige, bancos, insignias, esperaHasta };
}

// Registra el resultado de un duelo.
//  - Perder: queda anotado (para la espera).
//  - Ganar: se otorga la insignia (única por estudiante y zona) y el premio SOLO la primera vez.
//    Si el premio falla, se deshace la insignia para poder reintentar (no se pierde nada).
export async function registrarDuelo(estudianteId, zona, { ganado, aciertos = 0, errores = 0 }) {
  try { await supabase.from("mundo_duelos").insert({ estudiante_id: estudianteId, zona, ganado: !!ganado, aciertos, errores }); } catch { /* el intento es secundario */ }
  if (!ganado) return { ok: true };
  const { error: eIns } = await supabase.from("mundo_insignias").insert({ estudiante_id: estudianteId, zona });
  if (eIns) {
    if (eIns.code === "23505" || /duplicate|unique/i.test(eIns.message || "")) return { ok: true, yaTenia: true }; // ya la tenía: sin premio doble
    throw eIns;
  }
  const cfg = await fetchConfigMundo(), xp = cfg.duelo_xp, oro = cfg.duelo_oro;
  if (xp || oro) {
    const { error } = await supabase.rpc("ajustar_progreso", { p_estudiante_id: estudianteId, p_delta_xp: xp, p_delta_vida: 0, p_delta_monedas: oro });
    if (error) { await supabase.from("mundo_insignias").delete().eq("estudiante_id", estudianteId).eq("zona", zona); throw error; }
    try { await supabase.from("historial_gamificacion").insert({ estudiante_id: estudianteId, etiqueta: `🏅 Insignia: ${(ZONAS.find((z) => z.key === zona) || {}).insignia?.nombre || zona}`, xp, vida: 0, monedas: oro, categoria: "general" }); } catch { /* el historial es secundario */ }
  }
  return { ok: true, xp, oro, comarca: await aportarAComarca(estudianteId, { xp, oro, motivo: "Mundo CÓDICE: insignia" }) };
}

// ----- para el editor de la docente -----
// Las categorías de Preguntados con cuántas preguntas activas tienen.
export async function fetchCategoriasParaDuelo() {
  const [cats, pregs] = await Promise.all([
    supabase.from("trivia_categorias").select("id, nombre, emoji").eq("activa", true).order("id"),
    supabase.from("trivia_preguntas").select("categoria_id").eq("activa", true),
  ]);
  if (cats.error) throw cats.error;
  const cuenta = {}; (pregs.data || []).forEach((p) => { cuenta[p.categoria_id] = (cuenta[p.categoria_id] || 0) + 1; });
  return (cats.data || []).map((c) => ({ id: c.id, nombre: c.nombre, emoji: c.emoji || "❓", preguntas: cuenta[c.id] || 0 }));
}

// Cuántos estudiantes ganaron la insignia de cada zona: { zona: cantidad }
export async function fetchInsigniasResumen() {
  const { data, error } = await supabase.from("mundo_insignias").select("zona");
  if (error) throw error;
  const r = {}; (data || []).forEach((f) => { r[f.zona] = (r[f.zona] || 0) + 1; });
  return r;
}

// =====================================================================================
//  RETADORES: personajes hostiles con retos difíciles. Si el estudiante pierde, le quitan vida
//  (nunca por debajo de una vida mínima). Si gana, recibe un premio y el retador se va.
//  El daño y el premio los calcula SIEMPRE la base de datos, con la vida real del estudiante.
// =====================================================================================
export const CONFIG_RETO_DEFECTO = {
  reto_activo: 1, reto_danio: 15, reto_vida_min: 20, reto_aciertos: 3, reto_vidas: 2, reto_tiempo: 20, reto_espera_min: 5, reto_xp: 30, reto_oro: 15,
  reto_zona_bosque: 1, reto_zona_montana: 0, reto_zona_lago: 0, reto_banco_bosque: 0, reto_banco_montana: 0, reto_banco_lago: 0,
};

// Todo lo que necesita el juego para los retadores de UN estudiante. Si todavía no existe la tabla (SQL 67), falla y no hay retadores.
export async function fetchRetosMundo(estudianteId) {
  const cfg = await fetchConfigMundo();
  const { data, error } = await supabase.from("mundo_retos").select("enemigo, ganado, creado_en").eq("estudiante_id", estudianteId).order("creado_en", { ascending: false }).limit(400);
  if (error) throw error;
  const ganados = [...new Set((data || []).filter((f) => f.ganado).map((f) => f.enemigo))];
  const esperaHasta = {};
  if (cfg.reto_espera_min > 0) {
    for (const f of data || []) { if (f.ganado || f.enemigo in esperaHasta) continue; const t = Date.parse(f.creado_en) + cfg.reto_espera_min * 60000; esperaHasta[f.enemigo] = t > Date.now() ? t : 0; }
  }
  const zonas = {}, bancos = {};
  await Promise.all(ZONAS.filter((z) => (z.retadores || []).length).map(async (z) => {
    zonas[z.key] = cfg[`reto_zona_${z.key}`] === 1;
    if (zonas[z.key] && cfg[`reto_banco_${z.key}`] > 0) {
      const { data: preg } = await supabase.from("trivia_preguntas").select("pregunta, opciones, correcta").eq("categoria_id", cfg[`reto_banco_${z.key}`]).eq("activa", true).limit(80);
      bancos[z.key] = preg || [];
    }
  }));
  return { activo: cfg.reto_activo === 1, danio: Math.max(0, cfg.reto_danio), vidaMin: Math.max(0, cfg.reto_vida_min), aciertos: Math.max(1, cfg.reto_aciertos), vidas: Math.max(1, cfg.reto_vidas), tiempo: Math.max(0, cfg.reto_tiempo), espera: Math.max(0, cfg.reto_espera_min), premio: { xp: cfg.reto_xp, oro: cfg.reto_oro }, zonas, bancos, ganados, esperaHasta };
}

// Registra el resultado de un reto.
//  - Perder: se calcula el daño con la vida REAL (nunca por debajo de la vida mínima). Si no se puede aplicar, no se registra nada.
//  - Ganar: premio SOLO la primera vez; si el premio falla, se deshace la victoria para poder reintentar.
export async function registrarReto(estudianteId, { enemigo, zona, ganado, aciertos = 0, errores = 0 }) {
  const def = RETADORES.find((r) => r.id === enemigo);
  if (!def) throw new Error("Retador desconocido.");
  const cfg = await fetchConfigMundo();
  if (!ganado) {
    const { data: prog, error: e1 } = await supabase.from("progreso").select("vida").eq("estudiante_id", estudianteId).maybeSingle();
    if (e1) throw e1;
    const vida = typeof prog?.vida === "number" ? prog.vida : VIDA_MAX;
    const danio = Math.min(Math.max(0, cfg.reto_danio), Math.max(0, vida - Math.max(0, cfg.reto_vida_min)));
    let nueva = vida;
    if (danio > 0) {
      const { data, error } = await supabase.rpc("ajustar_progreso", { p_estudiante_id: estudianteId, p_delta_xp: 0, p_delta_vida: -danio, p_delta_monedas: 0 });
      if (error) throw error;
      nueva = typeof data?.[0]?.vida === "number" ? data[0].vida : vida - danio;
    }
    try { await supabase.from("mundo_retos").insert({ estudiante_id: estudianteId, enemigo, zona: zona || def.zona, ganado: false, aciertos, errores, danio }); } catch { /* el intento es secundario */ }
    if (danio > 0) { try { await supabase.from("historial_gamificacion").insert({ estudiante_id: estudianteId, etiqueta: `☠️ ${def.nombre} te venció`, xp: 0, vida: -danio, monedas: 0, categoria: "general" }); } catch { /* el historial es secundario */ } }
    return { ok: true, danio, vida: nueva };
  }
  const { error: eIns } = await supabase.from("mundo_retos").insert({ estudiante_id: estudianteId, enemigo, zona: zona || def.zona, ganado: true, aciertos, errores, danio: 0 });
  if (eIns) {
    if (eIns.code === "23505" || /duplicate|unique/i.test(eIns.message || "")) return { ok: true, yaTenia: true };
    throw eIns;
  }
  const xp = cfg.reto_xp, oro = cfg.reto_oro;
  if (xp || oro) {
    const { error } = await supabase.rpc("ajustar_progreso", { p_estudiante_id: estudianteId, p_delta_xp: xp, p_delta_vida: 0, p_delta_monedas: oro });
    if (error) { await supabase.from("mundo_retos").delete().eq("estudiante_id", estudianteId).eq("enemigo", enemigo).eq("ganado", true); throw error; }
    try { await supabase.from("historial_gamificacion").insert({ estudiante_id: estudianteId, etiqueta: `⚔️ Derrotó a ${def.nombre}`, xp, vida: 0, monedas: oro, categoria: "general" }); } catch { /* el historial es secundario */ }
  }
  return { ok: true, xp, oro, comarca: await aportarAComarca(estudianteId, { xp, oro, motivo: `Mundo CÓDICE: derrotó a ${def.nombre}` }) };
}

// ----- para el editor de la docente -----
// Cuántos retadores fueron derrotados por zona y cuántas derrotas hubo: { derrotados: { zona: n }, derrotas: n, danioTotal: n }
export async function fetchRetosResumen() {
  const { data, error } = await supabase.from("mundo_retos").select("zona, ganado, danio");
  if (error) throw error;
  const r = { derrotados: {}, derrotas: 0, danioTotal: 0 };
  (data || []).forEach((f) => { if (f.ganado) r.derrotados[f.zona] = (r.derrotados[f.zona] || 0) + 1; else { r.derrotas += 1; r.danioTotal += Number(f.danio) || 0; } });
  return r;
}

// =====================================================================================
//  RECOGER RECURSOS, MOCHILA Y FABRICAR
//  Cada recolección exige acertar una pregunta (lo verifica el juego) y tiene un límite por día.
//  El límite, los ingredientes y el tope por objeto se revisan aquí leyendo la base justo antes de escribir;
//  si algo falla a medias, se deshace lo hecho.
// =====================================================================================
export const CONFIG_RECOLECTA_DEFECTO = { recolecta_activo: 1, recolecta_limite_dia: 30, recolecta_cantidad: 2, recolecta_espera_min: 2, recolecta_respawn_min: 3 };

// El día cambia a la medianoche de Colombia (UTC-5, sin horario de verano). Devuelve ISO UTC del inicio del día actual.
export function inicioDelDia(ahora = Date.now()) {
  const OFFSET = 5 * 3600000, local = ahora - OFFSET;
  return new Date(local - (((local % 86400000) + 86400000) % 86400000) + OFFSET).toISOString();
}

export async function leerInventario(estudianteId) {
  const { data, error } = await supabase.from("mundo_inventario").select("item, cantidad").eq("estudiante_id", estudianteId);
  if (error) throw error;
  const inv = {}; (data || []).forEach((f) => { if (ITEMS[f.item] && f.cantidad > 0) inv[f.item] = f.cantidad; });
  return inv;
}

export async function recogidoHoyDe(estudianteId) {
  const { data, error } = await supabase.from("mundo_recoleccion").select("cantidad").eq("estudiante_id", estudianteId).gte("creado_en", inicioDelDia());
  if (error) throw error;
  return (data || []).reduce((a, f) => a + (Number(f.cantidad) || 0), 0);
}

async function guardarCantidad(estudianteId, item, cantidad) {
  const c = Math.max(0, Math.min(MAX_POR_ITEM, Math.floor(cantidad)));
  const { error } = await supabase.from("mundo_inventario").upsert({ estudiante_id: estudianteId, item, cantidad: c, actualizado_en: new Date().toISOString() }, { onConflict: "estudiante_id,item" });
  if (error) throw error;
}

// Vuelve el inventario a como estaba (mapa item → cantidad anterior). Es lo último que se intenta; si falla, no se oculta.
async function restaurar(estudianteId, antes) {
  for (const [item, c] of Object.entries(antes)) { try { await guardarCantidad(estudianteId, item, c); } catch { /* mejor esfuerzo */ } }
}

// Todo lo que necesita el juego: configuración, inventario y lo recogido hoy. Si faltan las tablas (SQL 68), falla y no hay recolección.
export async function fetchRecolectaMundo(estudianteId) {
  const cfg = await fetchConfigMundo();
  const [inventario, hoy] = await Promise.all([leerInventario(estudianteId), recogidoHoyDe(estudianteId)]);
  return { activo: cfg.recolecta_activo === 1, limite: Math.max(0, cfg.recolecta_limite_dia), cantidad: Math.max(1, cfg.recolecta_cantidad), espera: Math.max(0, cfg.recolecta_espera_min), respawn: Math.max(0, cfg.recolecta_respawn_min), inventario, hoy };
}

// Recoge: respeta el límite diario y el tope de 99. Devuelve { ok, item, cantidad, inventario, hoy } o { ok:false, limite:true }.
export async function recolectarRecurso(estudianteId, { item, zona }) {
  const def = ITEMS[item]; if (!def || def.tipo !== "recurso") throw new Error("Recurso desconocido.");
  const cfg = await fetchConfigMundo();
  if (cfg.recolecta_activo !== 1) return { ok: false, mensaje: "La recolección está cerrada por ahora." };
  const [inv, hoy] = await Promise.all([leerInventario(estudianteId), recogidoHoyDe(estudianteId)]);
  if (cfg.recolecta_limite_dia > 0 && hoy >= cfg.recolecta_limite_dia) return { ok: false, limite: true, hoy, inventario: inv };
  const actual = inv[item] || 0;
  if (actual >= MAX_POR_ITEM) return { ok: false, lleno: true, hoy, inventario: inv };
  let dar = cantidadPorRecoleccion(item, inv, cfg.recolecta_cantidad);
  if (cfg.recolecta_limite_dia > 0) dar = Math.min(dar, cfg.recolecta_limite_dia - hoy);
  dar = Math.min(dar, MAX_POR_ITEM - actual);
  await guardarCantidad(estudianteId, item, actual + dar);
  const { error } = await supabase.from("mundo_recoleccion").insert({ estudiante_id: estudianteId, item, zona: zona || null, cantidad: dar });
  if (error) { await restaurar(estudianteId, { [item]: actual }); throw error; }
  return { ok: true, item, cantidad: dar, inventario: { ...inv, [item]: actual + dar }, hoy: hoy + dar };
}

// Fabrica: revisa ingredientes leyendo el inventario real, descuenta y suma. Si algo falla, devuelve todo como estaba.
export async function fabricarEnMundo(estudianteId, recetaId) {
  const receta = RECETAS[recetaId]; if (!receta) throw new Error("Receta desconocida.");
  const inv = await leerInventario(estudianteId);
  const p = puedeFabricar(recetaId, inv);
  if (!p.ok) return { ok: false, motivo: p.motivo, faltan: p.faltan, inventario: inv };
  const antes = {}, nuevo = { ...inv };
  for (const [k, n] of Object.entries(receta.ingredientes)) { antes[k] = inv[k] || 0; nuevo[k] = (inv[k] || 0) - n; }
  antes[recetaId] = inv[recetaId] || 0; nuevo[recetaId] = (inv[recetaId] || 0) + 1;
  try { for (const k of Object.keys(antes)) await guardarCantidad(estudianteId, k, nuevo[k]); }
  catch (e) { await restaurar(estudianteId, antes); throw e; }
  Object.keys(nuevo).forEach((k) => { if (!nuevo[k]) delete nuevo[k]; });
  return { ok: true, item: recetaId, inventario: nuevo };
}

// Usa un consumible: cura (nunca por encima de VIDA_MAX). No se gasta si la vida ya está llena o si la cura falla.
export async function usarItemMundo(estudianteId, { item }) {
  const def = ITEMS[item]; if (!def || def.tipo !== "consumible") return { ok: false, mensaje: "Eso no se puede usar." };
  const inv = await leerInventario(estudianteId);
  if (!(inv[item] > 0)) return { ok: false, mensaje: "No tienes ese objeto.", inventario: inv };
  const { data: prog, error: e1 } = await supabase.from("progreso").select("vida").eq("estudiante_id", estudianteId).maybeSingle();
  if (e1) throw e1;
  const vida = typeof prog?.vida === "number" ? prog.vida : VIDA_MAX, cura = Math.min(def.cura || 0, VIDA_MAX - vida);
  if (cura <= 0) return { ok: false, lleno: true, vida, mensaje: "Ya tienes la vida llena: no se gastó.", inventario: inv };
  await guardarCantidad(estudianteId, item, inv[item] - 1);
  const { data, error } = await supabase.rpc("ajustar_progreso", { p_estudiante_id: estudianteId, p_delta_xp: 0, p_delta_vida: cura, p_delta_monedas: 0 });
  if (error) { await restaurar(estudianteId, { [item]: inv[item] }); throw error; }
  try { await supabase.from("historial_gamificacion").insert({ estudiante_id: estudianteId, etiqueta: `${def.emoji} ${def.nombre}`, xp: 0, vida: cura, monedas: 0, categoria: "general" }); } catch { /* el historial es secundario */ }
  const nuevo = { ...inv, [item]: inv[item] - 1 }; if (!nuevo[item]) delete nuevo[item];
  return { ok: true, curado: cura, vida: typeof data?.[0]?.vida === "number" ? data[0].vida : vida + cura, inventario: nuevo };
}

// ----- para el editor de la docente -----
// { recogidas: total de unidades, estudiantes: cuántos recogieron, porItem: { madera: n } }
export async function fetchRecolectaResumen() {
  const { data, error } = await supabase.from("mundo_recoleccion").select("estudiante_id, item, cantidad");
  if (error) throw error;
  const r = { recogidas: 0, estudiantes: 0, porItem: {} }, set = new Set();
  (data || []).forEach((f) => { r.recogidas += Number(f.cantidad) || 0; set.add(f.estudiante_id); r.porItem[f.item] = (r.porItem[f.item] || 0) + (Number(f.cantidad) || 0); });
  r.estudiantes = set.size;
  return r;
}

// =====================================================================================
//  LA PARCELA: colocar y recoger piezas de decoración
//  Una casilla solo puede tener una pieza (índice único en la base). Colocar saca la pieza de la mochila y recoger la devuelve;
//  si el segundo paso falla, se deshace el primero.
// =====================================================================================
export async function fetchParcelaMundo(estudianteId) {
  const { data, error } = await supabase.from("mundo_parcela").select("item, x, y").eq("estudiante_id", estudianteId);
  if (error) throw error;
  return { activo: true, piezas: (data || []).filter((f) => esDecoracion(f.item)).map((f) => ({ item: f.item, x: f.x, y: f.y })) };
}

export async function colocarEnParcela(estudianteId, { item, x, y }) {
  if (!esDecoracion(item)) return { ok: false, mensaje: "Ese objeto no se puede colocar." };
  if (!celdaValida(x, y)) return { ok: false, mensaje: "Ahí no se puede construir." };
  const inv = await leerInventario(estudianteId);
  if (!(inv[item] > 0)) return { ok: false, mensaje: "No tienes ese objeto.", inventario: inv };
  const { data: filas, error: eL } = await supabase.from("mundo_parcela").select("x, y").eq("estudiante_id", estudianteId);
  if (eL) throw eL;
  if ((filas || []).length >= PARCELA.maxPiezas) return { ok: false, mensaje: `Tu parcela ya tiene el máximo de ${PARCELA.maxPiezas} piezas.`, inventario: inv };
  if ((filas || []).some((f) => f.x === x && f.y === y)) return { ok: false, ocupado: true, mensaje: "Esa casilla ya está ocupada.", inventario: inv };
  const { error: eI } = await supabase.from("mundo_parcela").insert({ estudiante_id: estudianteId, item, x, y });
  if (eI) {
    if (eI.code === "23505" || /duplicate|unique/i.test(eI.message || "")) return { ok: false, ocupado: true, mensaje: "Esa casilla ya está ocupada.", inventario: inv };
    throw eI;
  }
  try { await guardarCantidad(estudianteId, item, inv[item] - 1); }
  catch (e) { await supabase.from("mundo_parcela").delete().eq("estudiante_id", estudianteId).eq("x", x).eq("y", y); throw e; }
  const nuevo = { ...inv, [item]: inv[item] - 1 }; if (!nuevo[item]) delete nuevo[item];
  return { ok: true, inventario: nuevo };
}

export async function quitarDeParcela(estudianteId, { x, y }) {
  const { data: filas, error: eL } = await supabase.from("mundo_parcela").select("item, x, y").eq("estudiante_id", estudianteId).eq("x", x).eq("y", y);
  if (eL) throw eL;
  const pieza = (filas || [])[0]; if (!pieza) return { ok: false, mensaje: "Ahí ya no hay nada.", vacia: true };
  const inv = await leerInventario(estudianteId);
  if ((inv[pieza.item] || 0) >= MAX_POR_ITEM) return { ok: false, lleno: true, mensaje: "Tu mochila ya tiene el máximo de ese objeto.", inventario: inv };
  const { error: eD } = await supabase.from("mundo_parcela").delete().eq("estudiante_id", estudianteId).eq("x", x).eq("y", y);
  if (eD) throw eD;
  try { await guardarCantidad(estudianteId, pieza.item, (inv[pieza.item] || 0) + 1); }
  catch (e) { await supabase.from("mundo_parcela").insert({ estudiante_id: estudianteId, item: pieza.item, x, y }); throw e; }
  return { ok: true, item: pieza.item, inventario: { ...inv, [pieza.item]: (inv[pieza.item] || 0) + 1 } };
}

// Para el editor de la docente: { piezas, parcelas }
export async function fetchParcelaResumen() {
  const { data, error } = await supabase.from("mundo_parcela").select("estudiante_id");
  if (error) throw error;
  return { piezas: (data || []).length, parcelas: new Set((data || []).map((f) => f.estudiante_id)).size };
}

// =====================================================================================
//  CASA DE LOS ACERTIJOS: sopa de letras, criptograma, ahorcado y rompecabezas
//  El premio se gana UNA vez por acertijo: se registra (clave única) y luego se entrega; si el premio falla, se deshace el registro.
// =====================================================================================
const normalizarAcertijo = (a) => ({
  id: a.id, tipo: a.tipo, titulo: a.titulo || "", contenido: a.contenido || "", pista: a.pista || "", tam: a.tam == null ? null : Number(a.tam),
  grado_id: a.grado_id || "", xp: Math.max(0, Number(a.xp) || 0), oro: Math.max(0, Number(a.oro) || 0), orden: Number(a.orden) || 0, activo: a.activo !== false,
});

// Lo que necesita la pantalla del estudiante: { activo, lista, hechos }. Sin la tabla (SQL 70 sin correr), las mesas quedan "no disponibles".
export async function fetchAcertijosMundo(estudianteId, gradoId) {
  const { data, error } = await supabase.from("mundo_acertijos").select("*").eq("activo", true).order("orden").order("id");
  if (error) throw error;
  const lista = (data || []).map(normalizarAcertijo).filter((a) => CLAVES_TIPO.includes(a.tipo) && !validarContenido(a.tipo, a.contenido, { tam: a.tam }) && (gradoId != null ? misionVisiblePara(a.grado_id, gradoId) : !a.grado_id));
  const { data: h, error: eh } = await supabase.from("mundo_acertijos_hechos").select("acertijo_id").eq("estudiante_id", estudianteId);
  if (eh) throw eh;
  return { activo: true, lista, hechos: (h || []).map((f) => f.acertijo_id) };
}

export async function completarAcertijoMundo(estudianteId, { id }) {
  const { data: filas, error: eL } = await supabase.from("mundo_acertijos").select("*").eq("id", id).eq("activo", true);
  if (eL) return { ok: false, mensaje: eL.message };
  const a = (filas || [])[0] ? normalizarAcertijo(filas[0]) : null;
  if (!a) return { ok: false, mensaje: "Ese acertijo ya no está disponible." };
  const { error } = await supabase.from("mundo_acertijos_hechos").insert({ estudiante_id: estudianteId, acertijo_id: id });
  if (error) {
    if (error.code === "23505" || /duplicate|unique/i.test(error.message || "")) return { ok: true, yaEstaba: true };
    return { ok: false, mensaje: error.message };
  }
  try {
    const [, rpc] = await Promise.all([
      supabase.from("historial_gamificacion").insert({ estudiante_id: estudianteId, etiqueta: `🧩 Acertijo: ${a.titulo}`, xp: a.xp, vida: 0, monedas: a.oro, categoria: "general" }),
      supabase.rpc("ajustar_progreso", { p_estudiante_id: estudianteId, p_delta_xp: a.xp, p_delta_vida: 0, p_delta_monedas: a.oro }),
    ]);
    if (rpc.error) throw rpc.error;
    const fila = rpc.data?.[0];
    return { ok: true, xp: fila?.xp, oro: fila?.monedas, comarca: await aportarAComarca(estudianteId, { xp: a.xp, oro: a.oro, motivo: `Mundo CÓDICE: acertijo ${a.titulo}` }) };
  } catch (e) {
    await supabase.from("mundo_acertijos_hechos").delete().eq("estudiante_id", estudianteId).eq("acertijo_id", id);
    return { ok: false, mensaje: (e && e.message) || "no se pudo entregar el premio" };
  }
}

// ----- para el editor de la docente -----
export async function fetchAcertijosAdmin() {
  const { data, error } = await supabase.from("mundo_acertijos").select("*").order("orden").order("id");
  if (error) throw error;
  return (data || []).map(normalizarAcertijo);
}
function limpiarAcertijo(c) {
  const tipo = c.tipo, err = CLAVES_TIPO.includes(tipo) ? validarContenido(tipo, c.contenido, { tam: c.tam }) : "Elige un tipo de acertijo.";
  if (err) throw new Error(err);
  if (!String(c.titulo || "").trim()) throw new Error("Ponle un título al acertijo.");
  const tam = tipo === "sopa" ? Math.max(8, Math.min(16, Number(c.tam) || 10)) : tipo === "rompe" ? (Number(c.tam) >= 4 ? 4 : 3) : null;
  return { tipo, titulo: String(c.titulo).trim().slice(0, 80), contenido: String(c.contenido || "").trim(), pista: String(c.pista || "").trim() || null, tam, grado_id: c.grado_id || null, xp: Math.max(0, Math.min(500, Math.floor(Number(c.xp) || 0))), oro: Math.max(0, Math.min(500, Math.floor(Number(c.oro) || 0))), activo: c.activo !== false };
}
export async function crearAcertijoMundo(campos) {
  const limpio = limpiarAcertijo(campos);
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("mundo_acertijos").insert({ ...limpio, docente_id: userData?.user?.id || null }).select().single();
  if (error) throw error;
  return normalizarAcertijo(data);
}
export async function editarAcertijoMundo(id, campos) {
  const { error } = await supabase.from("mundo_acertijos").update(limpiarAcertijo(campos)).eq("id", id);
  if (error) throw error;
}
export async function eliminarAcertijoMundo(id) {
  const { error } = await supabase.from("mundo_acertijos").delete().eq("id", id);
  if (error) throw error;
}
// { [acertijoId]: cuántos estudiantes lo resolvieron }
export async function fetchConteoAcertijos() {
  const { data, error } = await supabase.from("mundo_acertijos_hechos").select("acertijo_id");
  if (error) throw error;
  const c = {}; (data || []).forEach((f) => { c[f.acertijo_id] = (c[f.acertijo_id] || 0) + 1; }); return c;
}

// =====================================================================================
//  MISIONES OCULTAS: objetos brillantes escondidos en el mundo
//  El premio se gana UNA vez por secreto: se registra (clave única) y luego se entrega; si el premio falla, se deshace el registro.
// =====================================================================================
function normalizarSecreto(f) {
  let opciones = f.opciones;
  if (typeof opciones === "string") { try { opciones = JSON.parse(opciones); } catch (e) { opciones = []; } }
  return {
    id: f.id, nombre: f.nombre || "Objeto", emoji: f.emoji || "📜", escena: f.escena || "plaza", pista: f.pista || "", texto: f.texto || "",
    opciones: Array.isArray(opciones) ? opciones.map(String) : [], correcta: Number(f.correcta) || 0, retro: f.retro || "",
    grado_id: f.grado_id ? String(f.grado_id) : "", xp: Math.max(0, Number(f.xp) || 0), oro: Math.max(0, Number(f.oro) || 0), orden: Number(f.orden) || 0, activo: f.activo !== false,
  };
}

// Lo que necesita la pantalla del estudiante: { activo, lista, hallados }.
export async function fetchSecretosMundo(estudianteId, gradoId) {
  const { data, error } = await supabase.from("mundo_secretos").select("*").eq("activo", true).order("orden").order("id");
  if (error) throw error;
  const lista = (data || []).map(normalizarSecreto).filter((x) => secretoJugable(x) && (gradoId != null ? misionVisiblePara(x.grado_id, gradoId) : !x.grado_id));
  const { data: h, error: eh } = await supabase.from("mundo_secretos_hallados").select("secreto_id").eq("estudiante_id", estudianteId);
  if (eh) throw eh;
  return { activo: true, lista, hallados: (h || []).map((f) => f.secreto_id) };
}

export async function hallarSecretoMundo(estudianteId, { id }) {
  const { data: filas, error: eL } = await supabase.from("mundo_secretos").select("*").eq("id", id).eq("activo", true);
  if (eL) return { ok: false, mensaje: eL.message };
  const x = (filas || [])[0] ? normalizarSecreto(filas[0]) : null;
  if (!x) return { ok: false, mensaje: "Ese objeto ya no está disponible." };
  const { error } = await supabase.from("mundo_secretos_hallados").insert({ estudiante_id: estudianteId, secreto_id: id });
  if (error) {
    if (error.code === "23505" || /duplicate|unique/i.test(error.message || "")) return { ok: true, yaEstaba: true };
    return { ok: false, mensaje: error.message };
  }
  try {
    const [, rpc] = await Promise.all([
      supabase.from("historial_gamificacion").insert({ estudiante_id: estudianteId, etiqueta: `🔎 Secreto: ${x.nombre}`, xp: x.xp, vida: 0, monedas: x.oro, categoria: "general" }),
      supabase.rpc("ajustar_progreso", { p_estudiante_id: estudianteId, p_delta_xp: x.xp, p_delta_vida: 0, p_delta_monedas: x.oro }),
    ]);
    if (rpc.error) throw rpc.error;
    const fila = rpc.data?.[0];
    return { ok: true, xp: fila?.xp, oro: fila?.monedas, comarca: await aportarAComarca(estudianteId, { xp: x.xp, oro: x.oro, motivo: `Mundo CÓDICE: secreto ${x.nombre}` }) };
  } catch (e) {
    await supabase.from("mundo_secretos_hallados").delete().eq("estudiante_id", estudianteId).eq("secreto_id", id);
    return { ok: false, mensaje: (e && e.message) || "no se pudo entregar el premio" };
  }
}

// ----- para el editor de la docente -----
export async function fetchSecretosAdmin() {
  const { data, error } = await supabase.from("mundo_secretos").select("*").order("orden").order("id");
  if (error) throw error;
  return (data || []).map(normalizarSecreto);
}
function secretoParaGuardar(c) { const err = validarSecreto(c); if (err) throw new Error(err); return limpiarSecreto(c); }
export async function crearSecretoMundo(campos) {
  const limpio = secretoParaGuardar(campos);
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("mundo_secretos").insert({ ...limpio, docente_id: userData?.user?.id || null }).select().single();
  if (error) throw error;
  return normalizarSecreto(data);
}
export async function editarSecretoMundo(id, campos) {
  const { error } = await supabase.from("mundo_secretos").update(secretoParaGuardar(campos)).eq("id", id);
  if (error) throw error;
}
export async function eliminarSecretoMundo(id) {
  const { error } = await supabase.from("mundo_secretos").delete().eq("id", id);
  if (error) throw error;
}
// { [secretoId]: cuántos estudiantes lo encontraron }
export async function fetchConteoSecretos() {
  const { data, error } = await supabase.from("mundo_secretos_hallados").select("secreto_id");
  if (error) throw error;
  const c = {}; (data || []).forEach((f) => { c[f.secreto_id] = (c[f.secreto_id] || 0) + 1; }); return c;
}

// =====================================================================================
//  COMARCA DE OAKHAVEN dentro del mundo
//  El reino de cada estudiante sale de la Comarca activa de su curso (SQL 72). Las escrituras en la Comarca pasan por
//  funciones de la base (mundo_comarca_*), porque esas tablas solo las puede escribir la docente.
// =====================================================================================
const miReinoDe = async (estudianteId) => {
  const { data, error } = await supabase.rpc("mundo_comarca_mi_reino", { p_estudiante_id: estudianteId });
  if (error) throw error;
  const f = (data || [])[0];
  return f ? { sesionId: f.sesion_id, reinoId: f.reino_id } : null;
};

// Todo lo que necesita la Sala de la Comarca: { activo, hay, sesionId, miReinoId, reinos, provincias, batallasHoy, batallas, aportes }.
// activo=false: la docente apagó la integración. hay=false: el curso no tiene una Comarca activa (o el estudiante no tiene reino).
export async function fetchComarcaMundo(estudianteId) {
  const cfg = await fetchConfigMundo();
  const base = {
    activo: cfg.comarca_activo === 1, hay: false, reinos: [], provincias: [], batallasHoy: 0, ahora: Date.now(),
    batallas: { activo: cfg.comarca_batallas_activo === 1, dia: cfg.comarca_batallas_dia, aciertos: Math.max(1, cfg.comarca_batalla_aciertos), vidas: Math.max(1, cfg.comarca_batalla_vidas), proteccionMin: cfg.comarca_proteccion_min },
    aportes: { activo: cfg.comarca_aportes_activo === 1, oroPorGp: cfg.comarca_oro_por_gp, xpPorFp: cfg.comarca_xp_por_fp, topeGp: cfg.comarca_tope_gp_dia, topeFp: cfg.comarca_tope_fp_dia },
  };
  if (!base.activo) return base;
  const mi = await miReinoDe(estudianteId);
  if (!mi) return base;
  const [r, p, d] = await Promise.all([
    supabase.from("comarca_reinos").select("*").eq("sesion_id", mi.sesionId).order("orden"),
    supabase.from("comarca_provincias").select("*").eq("sesion_id", mi.sesionId).order("id"),
    supabase.from("comarca_duelos").select("id").eq("sesion_id", mi.sesionId).eq("estudiante_id", estudianteId).eq("origen", "mundo").gte("creado_en", new Date(inicioDelDia()).toISOString()),
  ]);
  if (r.error) throw r.error; if (p.error) throw p.error;
  return { ...base, hay: true, sesionId: mi.sesionId, miReinoId: mi.reinoId, reinos: r.data || [], provincias: p.data || [], batallasHoy: d.error ? 0 : (d.data || []).length };
}

// Suma al reino del estudiante el GP/FP que corresponde a lo que acaba de ganar. NUNCA lanza error: si algo falla, simplemente no aporta
// (así un problema con la Comarca no puede deshacer el premio del estudiante). Devuelve { gp, fp } o null.
export async function aportarAComarca(estudianteId, { xp = 0, oro = 0, motivo = "Mundo CÓDICE" } = {}) {
  try {
    const cfg = await fetchConfigMundo();
    if (cfg.comarca_activo !== 1 || cfg.comarca_aportes_activo !== 1) return null;
    const mi = await miReinoDe(estudianteId); if (!mi) return null;
    const { data: filas, error: eF } = await supabase.from("mundo_comarca_aportes").select("*").eq("estudiante_id", estudianteId).eq("sesion_id", mi.sesionId);
    if (eF) return null;
    const calc = calcularAporte({ xp, oro, fila: (filas || [])[0] || null, cfg, hoy: diaColombia() });
    if (calc.gp > 0 || calc.fp > 0) {
      const { error } = await supabase.rpc("mundo_comarca_sumar", { p_estudiante_id: estudianteId, p_gp: calc.gp, p_fp: calc.fp, p_motivo: motivo });
      if (error) return null;                                      // no se guarda el resto: se reintenta con la próxima recompensa
    }
    await supabase.from("mundo_comarca_aportes").upsert({ estudiante_id: estudianteId, sesion_id: mi.sesionId, ...calc.fila }, { onConflict: "estudiante_id,sesion_id" });
    return calc.gp > 0 || calc.fp > 0 ? { gp: calc.gp, fp: calc.fp } : null;
  } catch { return null; }
}

// Resultado de una batalla entre reinos. Devuelve { ok, tomada, provincia } o { ok:false, motivo, mensaje }.
const MENSAJES_BATALLA = {
  cerrado: "Las batallas entre reinos están cerradas por ahora.", sin_reino: "Tu curso no tiene una Comarca activa o todavía no tienes reino.",
  limite: "Hoy ya libraste todas tus batallas. ¡Vuelve mañana!", no_existe: "Esa provincia ya no existe.", propia: "Esa provincia ya es de tu reino.",
  protegida: "Esa provincia acaba de cambiar de dueña y está protegida un rato.", ultima: "Ese reino no puede quedarse sin provincias.",
};
export async function batallaComarca(estudianteId, { provinciaId, ganado, aciertos = 0, errores = 0 }) {
  const cfg = await fetchConfigMundo();
  const mi = await miReinoDe(estudianteId);
  const pb = puedeBatallar({ activo: cfg.comarca_activo === 1 && cfg.comarca_batallas_activo === 1, miReinoId: mi && mi.reinoId, limite: cfg.comarca_batallas_dia, batallasHoy: mi ? await (async () => {
    const { data } = await supabase.from("comarca_duelos").select("id").eq("sesion_id", mi.sesionId).eq("estudiante_id", estudianteId).eq("origen", "mundo").gte("creado_en", new Date(inicioDelDia()).toISOString());
    return (data || []).length;
  })() : 0 });
  if (!pb.ok) return { ok: false, motivo: pb.motivo, mensaje: MENSAJES_BATALLA[pb.motivo] };
  const { data, error } = await supabase.rpc("mundo_comarca_tomar_provincia", { p_estudiante_id: estudianteId, p_provincia_id: provinciaId, p_ganado: !!ganado, p_aciertos: aciertos, p_errores: errores, p_proteccion_min: cfg.comarca_proteccion_min });
  if (error) return { ok: false, mensaje: error.message };
  const f = (data || [])[0];
  if (!f) return { ok: false, mensaje: "No se pudo registrar la batalla." };
  if (!f.ok) return { ok: false, motivo: f.motivo, mensaje: MENSAJES_BATALLA[f.motivo] || "No se pudo registrar la batalla." };
  return { ok: true, tomada: f.motivo === "tomada", provincia: f.provincia_nombre };
}

// Para el editor de la docente: cuánto ha pasado en el mundo con la Comarca.
export async function fetchComarcaResumen() {
  const [d, m] = await Promise.all([
    supabase.from("comarca_duelos").select("ganador_id, reino_retador_id").eq("origen", "mundo"),
    supabase.from("comarca_movimientos").select("tipo, cantidad, motivo"),
  ]);
  if (d.error) throw d.error;
  const batallas = d.data || [], movs = (m.data || []).filter((x) => /^Mundo CÓDICE/.test(x.motivo || ""));
  return { batallas: batallas.length, tomadas: batallas.filter((b) => b.ganador_id === b.reino_retador_id).length, gp: movs.filter((x) => x.tipo === "gp").reduce((a, x) => a + x.cantidad, 0), fp: movs.filter((x) => x.tipo === "fp").reduce((a, x) => a + x.cantidad, 0) };
}


// ----- Las Tres Llaves y la Cámara del Códice (SQL 73) -----
// Lo que necesita el juego de UN estudiante: qué llaves tiene y si ya reclamó el cofre. Si falta el SQL 73, falla y el mundo se queda sin llaves.
export async function fetchLlavesMundo(estudianteId) {
  const cfg = await fetchConfigMundo();
  const base = { activo: cfg.llaves_activo === 1, orden: cfg.llaves_orden === 1, tengo: [], abierta: false, premio: { xp: cfg.llaves_xp, oro: cfg.llaves_oro }, duelo: { aciertos: Math.max(1, cfg.llaves_duelo_aciertos), vidas: Math.max(1, cfg.llaves_duelo_vidas) } };
  if (!base.activo) return base;
  const [l, c] = await Promise.all([
    supabase.from("mundo_llaves").select("llave").eq("estudiante_id", estudianteId),
    supabase.from("mundo_camara").select("id").eq("estudiante_id", estudianteId),
  ]);
  if (l.error) throw l.error;
  if (c.error) throw c.error;
  return { ...base, tengo: (l.data || []).map((f) => Number(f.llave)).filter((n) => llaveDe(n)).sort(), abierta: (c.data || []).length > 0 };
}

// Guarda que el estudiante ganó una llave. Respeta el orden (si la docente lo exige). Ganar la misma llave dos veces no hace nada.
export async function conseguirLlaveMundo(estudianteId, { llave }) {
  const l = llaveDe(llave); if (!l) return { ok: false, mensaje: "Esa llave no existe." };
  const cfg = await fetchConfigMundo();
  if (cfg.llaves_activo !== 1) return { ok: false, mensaje: "Las llaves están cerradas por ahora." };
  const { data, error: eL } = await supabase.from("mundo_llaves").select("llave").eq("estudiante_id", estudianteId);
  if (eL) return { ok: false, mensaje: eL.message };
  const tengo = (data || []).map((f) => Number(f.llave));
  if (tengo.includes(l.n)) return { ok: true, yaEstaba: true, tengo };
  const pc = puedeConseguir(l.n, tengo, cfg.llaves_orden === 1);
  if (!pc.ok) return { ok: false, mensaje: pc.motivo === "falta_anterior" ? `Primero necesitas la ${pc.falta.nombre}.` : "No se puede conseguir esa llave." };
  const { error } = await supabase.from("mundo_llaves").insert({ estudiante_id: estudianteId, llave: l.n });
  if (error) {
    if (error.code === "23505" || /duplicate|unique/i.test(error.message || "")) return { ok: true, yaEstaba: true, tengo };
    return { ok: false, mensaje: error.message };
  }
  return { ok: true, tengo: [...tengo, l.n].sort() };
}

// Reclama el cofre de la Cámara (una sola vez): hay que tener las 3 llaves. Entrega el premio y suma a la Comarca.
export async function abrirCamaraMundo(estudianteId) {
  const cfg = await fetchConfigMundo();
  if (cfg.llaves_activo !== 1) return { ok: false, mensaje: "La Cámara está cerrada por ahora." };
  const { data, error: eL } = await supabase.from("mundo_llaves").select("llave").eq("estudiante_id", estudianteId);
  if (eL) return { ok: false, mensaje: eL.message };
  if (!camaraDesbloqueada((data || []).map((f) => Number(f.llave)))) return { ok: false, mensaje: "Todavía te faltan llaves." };
  const { error } = await supabase.from("mundo_camara").insert({ estudiante_id: estudianteId });
  if (error) {
    if (error.code === "23505" || /duplicate|unique/i.test(error.message || "")) return { ok: true, yaEstaba: true };
    return { ok: false, mensaje: error.message };
  }
  const xp = cfg.llaves_xp, oro = cfg.llaves_oro;
  try {
    const [, rpc] = await Promise.all([
      supabase.from("historial_gamificacion").insert({ estudiante_id: estudianteId, etiqueta: "🔐 Cámara del Códice", xp, vida: 0, monedas: oro, categoria: "general" }),
      supabase.rpc("ajustar_progreso", { p_estudiante_id: estudianteId, p_delta_xp: xp, p_delta_vida: 0, p_delta_monedas: oro }),
    ]);
    if (rpc.error) throw rpc.error;
    const fila = rpc.data?.[0];
    return { ok: true, xp: fila?.xp, oro: fila?.monedas, premio: { xp, oro }, comarca: await aportarAComarca(estudianteId, { xp, oro, motivo: "Mundo CÓDICE: Cámara del Códice" }) };
  } catch (e) {
    await supabase.from("mundo_camara").delete().eq("estudiante_id", estudianteId);
    return { ok: false, mensaje: (e && e.message) || "no se pudo entregar el premio" };
  }
}

// Para la pestaña de la docente: cuántos estudiantes tienen cada llave y cuántos ya abrieron la Cámara.
export async function fetchLlavesResumen() {
  const [l, c] = await Promise.all([supabase.from("mundo_llaves").select("estudiante_id, llave"), supabase.from("mundo_camara").select("estudiante_id")]);
  if (l.error) throw l.error;
  if (c.error) throw c.error;
  const porLlave = { 1: 0, 2: 0, 3: 0 }; (l.data || []).forEach((f) => { if (porLlave[f.llave] != null) porLlave[f.llave]++; });
  return { porLlave, estudiantes: new Set((l.data || []).map((f) => f.estudiante_id)).size, abiertas: (c.data || []).length };
}


// ----- Monstruos y duelos de monstruos (SQL 74) -----
const normalizarMonstruo = (f) => ({ id: f.id, nombre: f.nombre, tipo: f.tipo, emoji: f.emoji, puntos: (typeof f.puntos === "string" ? (() => { try { return JSON.parse(f.puntos); } catch { return {}; } })() : f.puntos) || {}, xp: Number(f.xp) || 0, nivel: nivelDeXp(f.xp).nivel, origen: f.origen || "creado" });
const inicioDiaColombia = () => `${diaColombia()}T05:00:00Z`;   // la medianoche de Colombia (UTC−5) en UTC

// Lo que necesita el juego de UN estudiante: su equipo y cuántas victorias con premio lleva hoy. Si falta el SQL 74, falla y el mundo se queda sin monstruos.
export async function fetchMonstruosMundo(estudianteId) {
  const cfg = await fetchConfigMundo();
  const base = { activo: cfg.monstruos_activo === 1, equipoMax: Math.max(1, cfg.monstruos_equipo_max), puntos: Math.max(1, cfg.monstruos_puntos), premiosDia: cfg.monstruos_premios_dia, premio: { xp: cfg.monstruos_xp, oro: cfg.monstruos_oro }, equipo: [], premiosHoy: 0 };
  if (!base.activo) return base;
  const [m, d] = await Promise.all([
    supabase.from("mundo_monstruos").select("*").eq("estudiante_id", estudianteId).order("id"),
    supabase.from("mundo_monstruos_duelos").select("id").eq("estudiante_id", estudianteId).eq("premiado", true).gte("creado_en", inicioDiaColombia()),
  ]);
  if (m.error) throw m.error;
  if (d.error) throw d.error;
  return { ...base, equipo: (m.data || []).map(normalizarMonstruo), premiosHoy: (d.data || []).length };
}

// Crea un monstruo del estudiante (reparto de puntos validado). El equipo tiene un máximo.
export async function crearMonstruoMundo(estudianteId, campos) {
  const cfg = await fetchConfigMundo();
  if (cfg.monstruos_activo !== 1) return { ok: false, mensaje: "El Laboratorio está cerrado por ahora." };
  const err = validarMonstruo(campos, { puntos: cfg.monstruos_puntos }); if (err) return { ok: false, mensaje: err };
  const { data: previos, error: eP } = await supabase.from("mundo_monstruos").select("id").eq("estudiante_id", estudianteId);
  if (eP) return { ok: false, mensaje: eP.message };
  if ((previos || []).length >= cfg.monstruos_equipo_max) return { ok: false, mensaje: `Tu equipo ya está completo (${cfg.monstruos_equipo_max} monstruos).` };
  const l = limpiarMonstruo(campos);
  const { data, error } = await supabase.from("mundo_monstruos").insert({ estudiante_id: estudianteId, ...l, xp: 0, origen: "creado" }).select().maybeSingle();
  if (error) return { ok: false, mensaje: error.message };
  return { ok: true, monstruo: normalizarMonstruo(data || { ...l, xp: 0 }) };
}

// Registra un duelo de monstruos y entrega el premio (XP del monstruo, y XP/oro del estudiante) si todavía no llegó al tope del día.
// ganado lo reporta el juego del estudiante (no se puede verificar desde aquí).
export async function registrarDueloMonstruo(estudianteId, { monstruoId, rivalNombre = "", rivalNivel = 1, zona = null, jefe = false, modo = "turnos", ganado = false }) {
  const cfg = await fetchConfigMundo();
  if (cfg.monstruos_activo !== 1) return { ok: false, mensaje: "Los duelos de monstruos están cerrados por ahora." };
  const { data: filas, error: eM } = await supabase.from("mundo_monstruos").select("*").eq("id", monstruoId).eq("estudiante_id", estudianteId);
  if (eM) return { ok: false, mensaje: eM.message };
  const mon = (filas || [])[0]; if (!mon) return { ok: false, mensaje: "Ese monstruo no es tuyo." };
  const m0 = normalizarMonstruo(mon);
  const { data: hoy, error: eH } = await supabase.from("mundo_monstruos_duelos").select("id").eq("estudiante_id", estudianteId).eq("premiado", true).gte("creado_en", inicioDiaColombia());
  if (eH) return { ok: false, mensaje: eH.message };
  const modoOk = modo === "rapida" ? "rapida" : "turnos", nivelRival = Math.max(1, Math.min(NIVEL_MAX, Math.floor(Number(rivalNivel) || 1)));
  const premio = calcularPremioMonstruo({ ganado: !!ganado, nivelYo: m0.nivel, nivelRival, jefe: !!jefe, modo: modoOk, premiosHoy: (hoy || []).length, cfg });
  const premiado = premio.xpMonstruo > 0;
  const { data: duelo, error } = await supabase.from("mundo_monstruos_duelos").insert({ estudiante_id: estudianteId, monstruo_id: monstruoId, rival: String(rivalNombre).slice(0, 40), rival_nivel: nivelRival, zona, jefe: !!jefe, modo: modoOk, ganado: !!ganado, premiado, xp_monstruo: premio.xpMonstruo }).select().maybeSingle();
  if (error) return { ok: false, mensaje: error.message };
  const xpTope = xpParaNivel(NIVEL_MAX), xpNueva = Math.min(xpTope, m0.xp + premio.xpMonstruo);
  const deshacer = async () => { await supabase.from("mundo_monstruos").update({ xp: m0.xp }).eq("id", monstruoId); if (duelo && duelo.id != null) await supabase.from("mundo_monstruos_duelos").delete().eq("id", duelo.id); };
  try {
    if (premiado) { const { error: eU } = await supabase.from("mundo_monstruos").update({ xp: xpNueva }).eq("id", monstruoId); if (eU) throw eU; }
    let fila = null, comarca = null;
    if (premio.xp > 0 || premio.oro > 0) {
      const [, rpc] = await Promise.all([
        supabase.from("historial_gamificacion").insert({ estudiante_id: estudianteId, etiqueta: `🐲 Duelo de monstruos: ${m0.nombre} vs ${String(rivalNombre).slice(0, 30) || "rival"}`, xp: premio.xp, vida: 0, monedas: premio.oro, categoria: "general" }),
        supabase.rpc("ajustar_progreso", { p_estudiante_id: estudianteId, p_delta_xp: premio.xp, p_delta_vida: 0, p_delta_monedas: premio.oro }),
      ]);
      if (rpc.error) throw rpc.error;
      fila = rpc.data?.[0];
      comarca = await aportarAComarca(estudianteId, { xp: premio.xp, oro: premio.oro, motivo: "Mundo CÓDICE: duelo de monstruos" });
    }
    const nuevo = nivelDeXp(xpNueva).nivel;
    return { ok: true, premio, xp: fila?.xp, oro: fila?.monedas, comarca, monstruo: { id: monstruoId, xp: xpNueva, nivel: nuevo }, subio: nuevo > m0.nivel, premiosHoy: (hoy || []).length + (premiado ? 1 : 0) };
  } catch (e) {
    await deshacer();
    return { ok: false, mensaje: (e && e.message) || "no se pudo entregar el premio" };
  }
}

// Para la pestaña de la docente
export async function fetchMonstruosResumen() {
  const [m, d] = await Promise.all([supabase.from("mundo_monstruos").select("estudiante_id, tipo"), supabase.from("mundo_monstruos_duelos").select("ganado, estudiante_id")]);
  if (m.error) throw m.error;
  if (d.error) throw d.error;
  const porTipo = {}; (m.data || []).forEach((f) => { porTipo[f.tipo] = (porTipo[f.tipo] || 0) + 1; });
  return { monstruos: (m.data || []).length, estudiantes: new Set((m.data || []).map((f) => f.estudiante_id)).size, duelos: (d.data || []).length, victorias: (d.data || []).filter((f) => f.ganado).length, porTipo };
}
