// Rúbrica calificada: se guarda junto a la nota de la Planilla (notas_valores.rubrica_resultado, jsonb).
// resultado = { rubrica: [criterios con niveles y descriptores (copia al momento de calificar)],
//               niveles: { [criterio]: indiceDelNivel }, observaciones: { [criterio]: "texto" }, nota }
import { supabase } from "./supabaseClient";
import { fetchActividades } from "./api";

// Guarda (o actualiza) el resultado de la rúbrica de una celda. La nota ya debe estar en la celda (setValor).
export async function guardarResultadoRubrica(actividadId, estudianteId, resultado) {
  const { error } = await supabase.from("notas_valores").update({ rubrica_resultado: resultado }).eq("actividad_id", actividadId).eq("estudiante_id", estudianteId);
  if (error) throw error;
}

// La Forja manda la nota a una columna de la Planilla con el nombre de la tarea: se busca esa columna.
async function actividadDeTarea(tarea) {
  if (!tarea?.categoria_id) return null;
  const acts = await fetchActividades(tarea.materia_id, tarea.grado_id, tarea.periodo);
  return acts.find((a) => a.nombre === tarea.titulo) || null;
}
export async function guardarResultadoRubricaDeTarea(tarea, estudianteId, resultado) {
  const act = await actividadDeTarea(tarea);
  if (act) await guardarResultadoRubrica(act.id, estudianteId, resultado);
}
export async function leerResultadoRubricaDeTarea(tarea, estudianteId) {
  const act = await actividadDeTarea(tarea);
  if (!act) return null;
  const { data } = await supabase.from("notas_valores").select("rubrica_resultado").eq("actividad_id", act.id).eq("estudiante_id", estudianteId).maybeSingle();
  return data?.rubrica_resultado || null;
}
