import { supabase } from "./supabaseClient";

// Periodo vigente de cada materia donde el estudiante tiene notas, leído por una función segura del servidor
// (el estudiante no puede leer la tabla de configuración directamente). Devuelve { materia_id: "3", ... }.
export async function fetchPeriodosActualesEstudiante(estudianteId) {
  const { data, error } = await supabase.rpc("estudiante_periodos_actuales", { p_estudiante_id: estudianteId });
  if (error) throw error;
  const mapa = {};
  (data || []).forEach((r) => { if (r.periodo_actual != null && r.periodo_actual !== "") mapa[r.materia_id] = String(r.periodo_actual); });
  return mapa;
}
