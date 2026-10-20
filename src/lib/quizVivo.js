// Quiz en vivo: llamadas a Supabase (docente y estudiante).
import { supabase } from "./supabaseClient";
import { ajustarMonedas, fetchTriviaCategorias } from "./api";

const limpiar = (e) => { const m = String(e?.message || e || ""); const k = m.match(/sin_sesion|sala_no_existe|no_unido|quiz_terminado|sala_no_encontrada|opcion_invalida/); return k ? k[0] : m; };
const MENSAJES = {
  sin_sesion: "Tu sesión venció. Vuelve a entrar con tu código.",
  sala_no_existe: "No existe un quiz con ese código. Revisa que esté bien escrito.",
  no_unido: "Todavía no te has unido a este quiz.",
  quiz_terminado: "Este quiz ya terminó.",
  sala_no_encontrada: "No se encontró la sala.",
  opcion_invalida: "Esa opción no es válida.",
};
export const mensajeQuiz = (e) => { const k = limpiar(e); return MENSAJES[k] || String(e?.message || k); };

// ---------- Docente ----------
export async function fetchCategoriasQuiz() { return fetchTriviaCategorias(); }

// Toma hasta `cantidad` preguntas al azar del banco de Preguntados (una categoría o todas).
export async function preguntasDesdeBanco(categoriaId, cantidad) {
  let q = supabase.from("trivia_preguntas").select("id, pregunta, opciones, correcta").eq("activa", true);
  if (categoriaId) q = q.eq("categoria_id", categoriaId);
  const { data, error } = await q.limit(1000);
  if (error) throw error;
  const validas = (data || []).filter((p) => Array.isArray(p.opciones) && p.opciones.length >= 2 && Number.isInteger(p.correcta) && p.correcta >= 0 && p.correcta < p.opciones.length);
  for (let i = validas.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [validas[i], validas[j]] = [validas[j], validas[i]]; }
  return validas.slice(0, cantidad).map((p) => ({ texto: p.pregunta, opciones: p.opciones.slice(0, 6), correcta: p.correcta }));
}

export async function crearQuiz(titulo, tiempoSeg, preguntas) {
  const { data, error } = await supabase.rpc("quiz_crear", { p_titulo: titulo, p_tiempo: tiempoSeg, p_preguntas: preguntas });
  if (error) throw new Error(mensajeQuiz(error));
  return data; // { id, codigo, total }
}

export async function avanzarQuiz(salaId, accion) {
  const { data, error } = await supabase.rpc("quiz_avanzar", { p_sala: salaId, p_accion: accion });
  if (error) throw new Error(mensajeQuiz(error));
  return data;
}

export async function fetchMisSalas() {
  const { data, error } = await supabase.from("quiz_salas").select("id, codigo, titulo, estado, idx, creado_en").order("creado_en", { ascending: false }).limit(15);
  if (error) throw error;
  return data || [];
}

export async function eliminarSala(id) {
  const { error } = await supabase.from("quiz_salas").delete().eq("id", id);
  if (error) throw error;
}

// Estado completo de una sala para el panel del docente (se consulta cada pocos segundos).
export async function fetchPanelSala(salaId) {
  const { data: sala, error } = await supabase.from("quiz_salas").select("*").eq("id", salaId).maybeSingle();
  if (error) throw error;
  if (!sala) return null;
  const [pregs, jug, resp] = await Promise.all([
    supabase.from("quiz_preguntas").select("idx, texto, opciones, correcta").eq("sala_id", salaId).order("idx"),
    supabase.from("quiz_jugadores").select("estudiante_id, nombre, puntos").eq("sala_id", salaId).order("puntos", { ascending: false }),
    supabase.from("quiz_respuestas").select("estudiante_id, opcion, correcta").eq("sala_id", salaId).eq("idx", sala.idx),
  ]);
  if (pregs.error) throw pregs.error;
  const preguntas = pregs.data || [];
  const respuestas = resp.data || [];
  const conteo = {};
  respuestas.forEach((r) => { conteo[r.opcion] = (conteo[r.opcion] || 0) + 1; });
  return { sala, preguntas, jugadores: jug.data || [], respondieron: respuestas.length, conteo, actual: preguntas.find((p) => p.idx === sala.idx) || null };
}

// Premia con monedas a los primeros puestos. Devuelve cuántos recibieron.
export async function premiarPodio(jugadores, monedas) {
  let n = 0;
  for (let i = 0; i < monedas.length && i < jugadores.length; i++) {
    if (!(monedas[i] > 0) || !(jugadores[i].puntos > 0)) continue;
    await ajustarMonedas(jugadores[i].estudiante_id, monedas[i]);
    n++;
  }
  return n;
}

// ---------- Estudiante ----------
export async function unirseQuiz(codigo) {
  const { data, error } = await supabase.rpc("quiz_unirse", { p_codigo: codigo });
  if (error) throw new Error(mensajeQuiz(error));
  return data;
}
export async function estadoQuiz(codigo) {
  const { data, error } = await supabase.rpc("quiz_estado", { p_codigo: codigo });
  if (error) throw new Error(mensajeQuiz(error));
  return data;
}
export async function responderQuiz(codigo, opcion) {
  const { data, error } = await supabase.rpc("quiz_responder", { p_codigo: codigo, p_opcion: opcion });
  if (error) throw new Error(mensajeQuiz(error));
  return data; // { ok } o { ok:false, motivo }
}
