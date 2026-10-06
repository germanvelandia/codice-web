import { supabase } from "./supabaseClient";

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
  };
}

export async function fetchMisionesMundo() {
  const { data, error } = await supabase.from("mundo_misiones").select("*").eq("activo", true).order("orden").order("id");
  if (error) throw error;
  return (data || []).map(normalizarMision).filter((m) => m.opciones.length >= 2);
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
