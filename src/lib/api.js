import { supabase } from "./supabaseClient";
import { GRADOS_BASE } from "./gamification";

export async function asegurarGradosBase() {
  const filas = GRADOS_BASE.map((id) => ({ id }));
  await supabase.from("grados").upsert(filas, { onConflict: "id", ignoreDuplicates: true });
}

export async function fetchGrados() {
  const { data, error } = await supabase.from("grados").select("*").order("id");
  if (error) throw error;
  return data || [];
}

export async function crearGrado(id) {
  const { error } = await supabase.from("grados").upsert({ id, es_personalizado: true }, { onConflict: "id" });
  if (error) throw error;
}

export async function fetchEstudiantesPorGrado(gradoId) {
  const { data, error } = await supabase
    .from("estudiantes")
    .select("*, progreso(*)")
    .eq("grado_id", gradoId)
    .eq("activo", true)
    .order("nombre");
  if (error) throw error;
  return data || [];
}

export async function fetchTodosEstudiantes() {
  const { data, error } = await supabase
    .from("estudiantes")
    .select("*, progreso(*)")
    .eq("activo", true)
    .order("nombre");
  if (error) throw error;
  return data || [];
}

export async function crearEstudiante({ nombre, grado_id, reino_original }) {
  const { error } = await supabase.from("estudiantes").insert({ nombre, grado_id, reino_original: reino_original || "Sin grupo" });
  if (error) throw error;
}

export async function crearEstudiantesMasivo(filas) {
  const { error } = await supabase.from("estudiantes").insert(filas);
  if (error) throw error;
}

export async function quitarEstudiante(id) {
  const { error } = await supabase.from("estudiantes").update({ activo: false }).eq("id", id);
  if (error) throw error;
}

export async function cambiarReino(id, reino_actual) {
  const { error } = await supabase.from("estudiantes").update({ reino_actual }).eq("id", id);
  if (error) throw error;
}

export async function registrarAccion(estudianteId, accion) {
  await supabase.from("historial_gamificacion").insert({
    estudiante_id: estudianteId,
    etiqueta: accion.label,
    xp: accion.xp,
    vida: accion.vida,
    categoria: accion.categoria,
  });
  const { data: actual } = await supabase.from("progreso").select("*").eq("estudiante_id", estudianteId).maybeSingle();
  const nuevoXp = Math.max(0, (actual?.xp || 0) + accion.xp);
  const nuevaVida = Math.max(0, Math.min(100, (actual?.vida ?? 100) + accion.vida));
  const nuevasMonedas = (actual?.monedas || 0) + (accion.xp > 0 ? 1 : 0);
  const { error } = await supabase.from("progreso").upsert({
    estudiante_id: estudianteId,
    xp: nuevoXp,
    vida: nuevaVida,
    monedas: nuevasMonedas,
  });
  if (error) throw error;
  return { xp: nuevoXp, vida: nuevaVida, monedas: nuevasMonedas };
}
