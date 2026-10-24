import { supabase } from "./supabaseClient";

const nv = (a, b, c) => [{ nombre: "Superior", puntos: 5, descripcion: a }, { nombre: "Básico", puntos: 3, descripcion: b }, { nombre: "Bajo", puntos: 1, descripcion: c }];
const CRITERIOS_DEFECTO = [
  { criterio: "Participación", descripcion: "Aporta ideas y se involucra en las actividades.", niveles: nv("Participa con frecuencia y sus aportes enriquecen la clase.", "Participa algunas veces cuando se le invita.", "Casi no participa.") },
  { criterio: "Respeto y escucha", descripcion: "Escucha y trata bien a sus compañeros y al docente.", niveles: nv("Siempre escucha con atención y respeta las opiniones distintas.", "Escucha, pero a veces interrumpe o se distrae.", "Con frecuencia interrumpe o no respeta a los demás.") },
  { criterio: "Cumplimiento", descripcion: "Entrega lo acordado y asume su parte del trabajo.", niveles: nv("Cumple siempre y a tiempo con sus compromisos.", "Cumple parcialmente o con retraso.", "Rara vez cumple.") },
];
export { CRITERIOS_DEFECTO };

// Convierte líneas de texto ("Criterio") en criterios con niveles estándar
export function criteriosDesdeTexto(txt) {
  return String(txt || "").split("\n").map((l) => l.trim()).filter(Boolean).map((c) => ({
    criterio: c, niveles: [{ nombre: "Alto", puntos: 5 }, { nombre: "Medio", puntos: 3 }, { nombre: "Bajo", puntos: 1 }],
  }));
}

// ---------- Docente ----------
export async function fetchCoevaluaciones(gradoId) {
  let q = supabase.from("coev_evaluaciones").select("*").order("creado_en", { ascending: false });
  if (gradoId) q = q.eq("grado_id", gradoId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
export async function crearCoevaluacion(campos) {
  const { data, error } = await supabase.from("coev_evaluaciones").insert(campos).select().single();
  if (error) throw error;
  if (campos.tipo !== "auto") { const r = await supabase.rpc("coev_generar", { p_eval: data.id }); if (r.error) throw r.error; }
  return data;
}
// Copia una evaluación a otros cursos (misma rúbrica, escala, tipo y fechas). Devuelve cuántas creó.
export async function duplicarCoevaluacion(ev, gradoIds, { sufijoCurso = true } = {}) {
  let n = 0;
  for (const g of gradoIds) {
    await crearCoevaluacion({
      grado_id: g, titulo: sufijoCurso ? `${ev.titulo} (${g})` : ev.titulo, periodo: ev.periodo, tipo: ev.tipo, modo_co: ev.modo_co, cantidad: ev.cantidad,
      criterios: ev.criterios, escala_min: ev.escala_min, escala_max: ev.escala_max, visibilidad: ev.visibilidad, abre: ev.abre, cierra: ev.cierra, materia_id: ev.materia_id || null,
    });
    n++;
  }
  return n;
}

export async function actualizarCoevaluacion(id, campos) {
  const { error } = await supabase.from("coev_evaluaciones").update(campos).eq("id", id);
  if (error) throw error;
}
export async function eliminarCoevaluacion(id) {
  const { error } = await supabase.from("coev_evaluaciones").delete().eq("id", id);
  if (error) throw error;
}
export async function fetchRespuestasCoev(id) {
  const [r, a] = await Promise.all([
    supabase.from("coev_respuestas").select("evaluador_id,evaluado_id,nota,comentario").eq("eval_id", id),
    supabase.from("coev_asignaciones").select("evaluador_id,evaluado_id").eq("eval_id", id),
  ]);
  if (r.error) throw r.error;
  if (a.error) throw a.error;
  return { respuestas: r.data || [], asignaciones: a.data || [] };
}

// ---------- Estudiante ----------
export async function fetchMisCoevaluaciones() {
  const { data, error } = await supabase.rpc("coev_mis_evaluaciones");
  if (error) throw error;
  return data || [];
}
export async function enviarCoev(evalId, evaluadoId, niveles, comentario) {
  const { data, error } = await supabase.rpc("coev_enviar", { p_eval: evalId, p_evaluado: evaluadoId, p_niveles: niveles, p_comentario: comentario || null });
  if (error) throw error;
  return data;
}
export async function fetchMiResultadoCoev(evalId) {
  const { data, error } = await supabase.rpc("coev_mi_resultado", { p_eval: evalId });
  if (error) throw error;
  return data;
}
export function mensajeCoev(e) {
  const m = String(e?.message || e || "");
  if (m.includes("evaluacion_cerrada")) return "Esta evaluación ya está cerrada.";
  if (m.includes("no_asignado")) return "Ese compañero no está en tu lista.";
  if (m.includes("sesion_invalida")) return "Vuelve a entrar con tu código.";
  if (m.includes("coev_")) return "Falta correr el script 110 en Supabase.";
  return m || "No se pudo completar.";
}
