// Grupos mixtos: estudiantes de distintos grados en una planilla propia.
// El grupo se guarda como un curso oculto (grados.id = "GM-…") + la lista de miembros.
import { supabase } from "./supabaseClient";
import * as api from "./api";

export const esGrupoMixto = (gradoId) => typeof gradoId === "string" && gradoId.startsWith("GM-");

export async function fetchGruposMixtos() {
  const { data, error } = await supabase.from("grupos_mixtos").select("*").order("creado_en");
  if (error) return []; // sin SQL 87 todavía
  return data || [];
}

export async function fetchMiembrosGrupo(grupoId) {
  const { data, error } = await supabase.from("grupos_mixtos_estudiantes").select("estudiante_id").eq("grupo_id", grupoId);
  if (error) throw error;
  return (data || []).map((r) => r.estudiante_id);
}

// Mismos datos que fetchEstudiantesPorGrado, pero de los miembros del grupo.
export async function fetchEstudiantesGrupo(grupoId) {
  const ids = await fetchMiembrosGrupo(grupoId);
  if (!ids.length) return [];
  const { data, error } = await supabase.from("estudiantes").select("*, progreso(*), roles_asignados(rol_id)").in("id", ids).eq("activo", true);
  if (error) throw error;
  return (data || []).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
}

export async function fetchEstudiantesParaElegir() {
  const { data, error } = await supabase.from("estudiantes").select("id, nombre, grado_id").eq("activo", true).order("nombre");
  if (error) throw error;
  return data || [];
}

async function guardarMiembros(grupoId, estudianteIds) {
  const { error: e1 } = await supabase.from("grupos_mixtos_estudiantes").delete().eq("grupo_id", grupoId);
  if (e1) throw e1;
  if (estudianteIds.length) {
    const { error } = await supabase.from("grupos_mixtos_estudiantes").insert(estudianteIds.map((id) => ({ grupo_id: grupoId, estudiante_id: id })));
    if (error) throw error;
  }
}

export async function crearGrupoMixto(nombre, estudianteIds) {
  const id = "GM-" + Date.now().toString(36);
  await api.crearGrado(id);
  await api.guardarOcultoGrado(id, true); // no aparece en listas de cursos del resto de la app
  const { error } = await supabase.from("grupos_mixtos").insert({ id, nombre });
  if (error) throw error;
  await guardarMiembros(id, estudianteIds);
  return id;
}

export async function editarGrupoMixto(id, nombre, estudianteIds) {
  const { error } = await supabase.from("grupos_mixtos").update({ nombre }).eq("id", id);
  if (error) throw error;
  await guardarMiembros(id, estudianteIds);
}

// Quita el grupo y su lista. Las columnas y notas de su planilla no se borran de la base.
export async function eliminarGrupoMixto(id) {
  const { error } = await supabase.from("grupos_mixtos").delete().eq("id", id);
  if (error) throw error;
}
