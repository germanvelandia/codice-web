// Encuesta de satisfacción anónima: llamadas a Supabase + estadística de resultados.
import { supabase } from "./supabaseClient";

const MENSAJES = {
  sin_sesion: "Tu sesión venció. Vuelve a entrar con tu código.",
  encuesta_no_disponible: "Esta encuesta ya no está disponible.",
  ya_respondio: "Ya habías respondido esta encuesta. ¡Gracias!",
  sin_respuestas: "Responde al menos una pregunta antes de enviar.",
  respuesta_invalida: "Alguna respuesta no es válida. Revisa e intenta de nuevo.",
  respuestas_invalidas: "Alguna respuesta no es válida. Revisa e intenta de nuevo.",
};
export const mensajeEncuesta = (e) => {
  const m = String(e?.message || e || "");
  const k = Object.keys(MENSAJES).find((x) => m.includes(x));
  return k ? MENSAJES[k] : m;
};

// Preguntas sugeridas (escala 1–5 y abiertas). El docente puede editarlas antes de crear.
export const PREGUNTAS_BASE = [
  { id: "q1", tipo: "escala", texto: "Las clases con CÓDICE (puntos, reinos, retos) me motivan a participar." },
  { id: "q2", tipo: "escala", texto: "Entiendo con claridad cómo se calculan mis notas." },
  { id: "q3", tipo: "escala", texto: "Los juegos y el quiz en vivo me ayudan a aprender mejor los temas." },
  { id: "q4", tipo: "escala", texto: "Me siento más animado(a) a asistir y a cumplir con las actividades." },
  { id: "q5", tipo: "escala", texto: "Trabajar en equipo (reinos y comarca) mejora la convivencia en el curso." },
  { id: "q6", tipo: "escala", texto: "Siento que todos y todas podemos participar en igualdad de condiciones." },
  { id: "q7", tipo: "escala", texto: "Recomendaría seguir usando CÓDICE en otras clases." },
  { id: "t1", tipo: "texto", texto: "¿Qué es lo que más te ha gustado?" },
  { id: "t2", tipo: "texto", texto: "¿Qué cambiarías o mejorarías?" },
];

// ---------- Estudiante ----------
export async function fetchEncuestasPendientes() {
  const { data, error } = await supabase.rpc("encuesta_pendientes");
  if (error) throw error;
  return data || [];
}
export async function responderEncuesta(encuestaId, respuestas) {
  const { data, error } = await supabase.rpc("encuesta_responder", { p_encuesta: encuestaId, p_respuestas: respuestas });
  if (error) throw error;
  return data;
}

// ---------- Docente ----------
export async function fetchMisEncuestas() {
  const { data, error } = await supabase.from("encuestas").select("*").order("creado_en", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function crearEncuesta({ titulo, descripcion, gradoId, preguntas }) {
  const limpias = preguntas
    .map((p, i) => ({ id: p.id || `p${i + 1}`, tipo: p.tipo === "texto" ? "texto" : "escala", texto: String(p.texto || "").trim() }))
    .filter((p) => p.texto);
  if (limpias.length === 0) throw new Error("Agrega al menos una pregunta.");
  const { data, error } = await supabase.from("encuestas").insert({
    titulo: titulo?.trim() || "Encuesta de satisfacción",
    descripcion: descripcion?.trim() || null,
    grado_id: gradoId || null,
    preguntas: limpias,
  }).select().single();
  if (error) throw error;
  return data;
}
export async function activarEncuesta(id, activa) {
  const { error } = await supabase.from("encuestas").update({ activa }).eq("id", id);
  if (error) throw error;
}
export async function eliminarEncuesta(id) {
  const { error } = await supabase.from("encuestas").delete().eq("id", id);
  if (error) throw error;
}
export async function fetchRespuestasEncuesta(encuestaId) {
  const { data, error } = await supabase.from("encuesta_respuestas").select("respuestas, dia, grado_id").eq("encuesta_id", encuestaId).limit(5000);
  if (error) throw error;
  return data || [];
}
export async function fetchParticipacion(encuestaId) {
  const { data, error } = await supabase.rpc("encuesta_participacion_conteo", { p_encuesta: encuestaId });
  if (error) throw error;
  return Number(data) || 0;
}

// ---------- Estadística ----------
const redondear = (n, d = 2) => (n === null || n === undefined ? null : Math.round(n * 10 ** d) / 10 ** d);

// Devuelve, por pregunta, promedio/distribución/% favorable (4–5) o la lista de comentarios.
export function resumirEncuesta(preguntas, filas) {
  const items = (preguntas || []).map((p) => {
    const valores = (filas || []).map((f) => f.respuestas?.[p.id]).filter((v) => v !== undefined && v !== null);
    if (p.tipo === "escala") {
      const nums = valores.map(Number).filter((n) => n >= 1 && n <= 5);
      const dist = [1, 2, 3, 4, 5].map((k) => nums.filter((n) => n === k).length);
      const n = nums.length;
      return {
        id: p.id, tipo: "escala", texto: p.texto, n, dist,
        promedio: n ? redondear(nums.reduce((a, b) => a + b, 0) / n) : null,
        favorable: n ? redondear(((dist[3] + dist[4]) / n) * 100, 1) : null,
        desfavorable: n ? redondear(((dist[0] + dist[1]) / n) * 100, 1) : null,
      };
    }
    return { id: p.id, tipo: "texto", texto: p.texto, n: valores.length, comentarios: valores.map(String) };
  });
  const escalas = items.filter((i) => i.tipo === "escala" && i.n > 0);
  const global = escalas.length ? redondear(escalas.reduce((a, i) => a + i.promedio, 0) / escalas.length) : null;
  const globalFavorable = escalas.length ? redondear(escalas.reduce((a, i) => a + i.favorable, 0) / escalas.length, 1) : null;
  return { total: (filas || []).length, items, global, globalFavorable };
}
