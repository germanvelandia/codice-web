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
  const { miembros } = await fetchDetalleGrupo(grupoId);
  const ids = miembros.map((m) => m.estudiante_id);
  if (!ids.length) return [];
  const equipoDe = {}; miembros.forEach((m) => { equipoDe[m.estudiante_id] = m.equipo; });
  const { data, error } = await supabase.from("estudiantes").select("*, progreso(*), roles_asignados(rol_id)").in("id", ids).eq("activo", true);
  if (error) throw error;
  // Los equipos del grupo reemplazan al "reino" en esta planilla: así los filtros y la nota masiva por equipo funcionan solos.
  return (data || []).map((e) => ({ ...e, grado_original: e.grado_id, equipo: equipoDe[e.id] || null, reino_actual: equipoDe[e.id] || "Sin equipo", reino_original: equipoDe[e.id] || "Sin equipo" }))
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
}

export async function fetchEstudiantesParaElegir() {
  const { data, error } = await supabase.from("estudiantes").select("id, nombre, grado_id").eq("activo", true).order("nombre");
  if (error) throw error;
  return data || [];
}

// miembros: [{ estudiante_id, equipo|null }]  ·  equipos: [{ nombre, trabajo }]
export async function fetchDetalleGrupo(grupoId) {
  const { data: m, error } = await supabase.from("grupos_mixtos_estudiantes").select("*").eq("grupo_id", grupoId);
  if (error) throw error;
  let equipos = [];
  const r = await supabase.from("grupos_mixtos_equipos").select("*").eq("grupo_id", grupoId).order("nombre");
  if (!r.error) equipos = r.data || []; // sin SQL 88 → sin equipos
  return { miembros: (m || []).map((x) => ({ estudiante_id: x.estudiante_id, equipo: x.equipo || null })), equipos };
}

async function guardarContenido(grupoId, miembros, equipos) {
  const { error: e1 } = await supabase.from("grupos_mixtos_estudiantes").delete().eq("grupo_id", grupoId);
  if (e1) throw e1;
  if (miembros.length) {
    const { error } = await supabase.from("grupos_mixtos_estudiantes").insert(miembros.map((m) => ({ grupo_id: grupoId, estudiante_id: m.estudiante_id, equipo: m.equipo || null })));
    if (error) throw error;
  }
  const { error: e2 } = await supabase.from("grupos_mixtos_equipos").delete().eq("grupo_id", grupoId);
  if (e2) throw e2;
  if (equipos.length) {
    const { error } = await supabase.from("grupos_mixtos_equipos").insert(equipos.map((q) => ({ grupo_id: grupoId, nombre: q.nombre, trabajo: q.trabajo || null })));
    if (error) throw error;
  }
}

// datos: { nombre, descripcion, miembros, equipos }
export async function crearGrupoMixto(datos) {
  const id = "GM-" + Date.now().toString(36);
  await api.crearGrado(id);
  await api.guardarOcultoGrado(id, true); // no aparece en listas de cursos del resto de la app
  const { error } = await supabase.from("grupos_mixtos").insert({ id, nombre: datos.nombre, descripcion: datos.descripcion || null });
  if (error) throw error;
  await guardarContenido(id, datos.miembros, datos.equipos);
  return id;
}

export async function editarGrupoMixto(id, datos) {
  const { error } = await supabase.from("grupos_mixtos").update({ nombre: datos.nombre, descripcion: datos.descripcion || null }).eq("id", id);
  if (error) throw error;
  await guardarContenido(id, datos.miembros, datos.equipos);
}

// Quita el grupo, sus equipos y su lista. Las columnas y notas de su planilla no se borran de la base.
export async function eliminarGrupoMixto(id) {
  const { error } = await supabase.from("grupos_mixtos").delete().eq("id", id);
  if (error) throw error;
}
