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
    .select("*, progreso(*), roles_asignados(rol_id)")
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

/* ---------------- Roles de clase ---------------- */
export async function fetchRoles() {
  const { data, error } = await supabase.from("roles_clase").select("*").order("nombre");
  if (error) throw error;
  return data || [];
}

export async function crearRol(nombre, descripcion) {
  const { error } = await supabase.from("roles_clase").insert({ nombre, descripcion: descripcion || null });
  if (error) throw error;
}

export async function eliminarRol(id) {
  await supabase.from("roles_asignados").delete().eq("rol_id", id);
  const { error } = await supabase.from("roles_clase").delete().eq("id", id);
  if (error) throw error;
}

export async function asignarRol(estudianteId, rolId) {
  if (!rolId) {
    const { error } = await supabase.from("roles_asignados").delete().eq("estudiante_id", estudianteId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("roles_asignados").upsert(
    { estudiante_id: estudianteId, rol_id: rolId },
    { onConflict: "estudiante_id" }
  );
  if (error) throw error;
}

/* ---------------- Asistencia ---------------- */
export async function fetchAsistenciaFecha(estudianteIds, fecha) {
  if (estudianteIds.length === 0) return {};
  const { data, error } = await supabase
    .from("asistencia")
    .select("*")
    .eq("fecha", fecha)
    .in("estudiante_id", estudianteIds);
  if (error) throw error;
  const mapa = {};
  (data || []).forEach((f) => { mapa[f.estudiante_id] = f; });
  return mapa;
}

export async function marcarAsistencia(estudianteId, fecha, codigo, observacion) {
  const { error } = await supabase.from("asistencia").upsert(
    { estudiante_id: estudianteId, fecha, codigo, observacion: observacion || null },
    { onConflict: "estudiante_id,fecha" }
  );
  if (error) throw error;
}

export async function quitarAsistencia(estudianteId, fecha) {
  const { error } = await supabase.from("asistencia").delete().eq("estudiante_id", estudianteId).eq("fecha", fecha);
  if (error) throw error;
}

export async function marcarTodosPresentes(estudianteIds, fecha) {
  const filas = estudianteIds.map((id) => ({ estudiante_id: id, fecha, codigo: "P" }));
  const { error } = await supabase.from("asistencia").upsert(filas, { onConflict: "estudiante_id,fecha" });
  if (error) throw error;
}

export async function fetchEstadisticasAsistencia(estudianteId) {
  const { data, error } = await supabase.from("asistencia").select("codigo").eq("estudiante_id", estudianteId);
  if (error) throw error;
  const total = (data || []).length;
  const conteo = { P: 0, R: 0, FI: 0, FJ: 0 };
  (data || []).forEach((f) => { conteo[f.codigo] = (conteo[f.codigo] || 0) + 1; });
  const pct = total > 0 ? Math.round((conteo.P / total) * 100) : null;
  return { ...conteo, total, pct };
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
