import { supabase } from "./supabaseClient";
import { zonaDeMision } from "../game/zonas";

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
    .filter((m) => !m.grado_id || (gradoId != null && String(m.grado_id) === String(gradoId)))
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
    return { ok: true, xp: fila?.xp, oro: fila?.monedas };
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

export async function editarMisionMundo(id, campos) {
  const { error } = await supabase.from("mundo_misiones").update(campos).eq("id", id);
  if (error) throw error;
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
  const cfg = { ...CONFIG_POSADA_DEFECTO };
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
