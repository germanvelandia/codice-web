import { supabase } from "./supabaseClient";
import { GRADOS_BASE } from "./gamification";
import { notaAutomatica, notaFinalPonderada } from "./calificaciones";

export async function asegurarGradosBase() {
  const filas = GRADOS_BASE.map((id) => ({ id }));
  await supabase.from("grados").upsert(filas, { onConflict: "id", ignoreDuplicates: true });
}

export async function asegurarProfesor() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return;
  const { error } = await supabase.from("profesores").upsert(
    { id: userData.user.id, nombre: userData.user.email, email: userData.user.email },
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (error) console.error("No se pudo asegurar el perfil de docente:", error.message);
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

/* ---------------- Actas de seguimiento ---------------- */
export async function fetchActasPorEstudiante(estudianteId) {
  const { data, error } = await supabase
    .from("actas")
    .select("*, profesores(nombre)")
    .eq("estudiante_id", estudianteId)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function crearActa(estudianteId, campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("actas").insert({
    estudiante_id: estudianteId,
    registrado_por: userData?.user?.id || null,
    ...campos,
  });
  if (error) throw error;
}

export async function eliminarActa(id) {
  const { error } = await supabase.from("actas").delete().eq("id", id);
  if (error) throw error;
}

/* ==================== CALIFICACIONES ==================== */

export async function fetchMaterias() {
  const { data, error } = await supabase.from("materias").select("*").order("nombre");
  if (error) throw error;
  return data || [];
}

export async function crearMateria(nombre) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("materias").insert({ nombre, docente_id: userData.user.id }).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarMateria(id) {
  const { error } = await supabase.from("materias").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicarMateria(materiaOrigenId, nombreNuevo) {
  const nueva = await crearMateria(nombreNuevo);
  const cfg = await fetchNotasConfig(materiaOrigenId);
  await guardarNotasConfig(nueva.id, cfg);
  const cats = await fetchCategorias(materiaOrigenId);
  for (const c of cats) { await crearCategoria(nueva.id, c.nombre, c.porcentaje); }
  return nueva;
}

export async function copiarNotasDesdeMateria(materiaOrigenId, materiaDestinoId) {
  const catsOrigen = await fetchCategorias(materiaOrigenId);
  const catIdMap = {};
  for (const c of catsOrigen) {
    const { data, error } = await supabase.from("notas_categorias").insert({ materia_id: materiaDestinoId, nombre: c.nombre, porcentaje: c.porcentaje }).select().single();
    if (error) throw error;
    catIdMap[c.id] = data.id;
  }
  const { data: actsOrigen, error: eAct } = await supabase.from("notas_actividades").select("*").eq("materia_id", materiaOrigenId);
  if (eAct) throw eAct;
  const actIdMap = {};
  for (const a of (actsOrigen || [])) {
    const { data, error } = await supabase.from("notas_actividades").insert({
      materia_id: materiaDestinoId, categoria_id: catIdMap[a.categoria_id], nombre: a.nombre,
      grado_id: a.grado_id, periodo: a.periodo, es_automatica: a.es_automatica, gam_categoria: a.gam_categoria, xp_meta: a.xp_meta,
    }).select().single();
    if (error) throw error;
    actIdMap[a.id] = data.id;
  }
  const origenActIds = (actsOrigen || []).map((a) => a.id);
  if (origenActIds.length > 0) {
    const { data: valoresOrigen, error: eVal } = await supabase.from("notas_valores").select("*").in("actividad_id", origenActIds);
    if (eVal) throw eVal;
    const nuevosValores = (valoresOrigen || []).map((v) => ({ actividad_id: actIdMap[v.actividad_id], estudiante_id: v.estudiante_id, valor: v.valor }));
    if (nuevosValores.length > 0) {
      const { error } = await supabase.from("notas_valores").insert(nuevosValores);
      if (error) throw error;
    }
  }
}

export async function fetchNotasConfig(materiaId) {
  const { data, error } = await supabase.from("notas_config").select("*").eq("materia_id", materiaId).maybeSingle();
  if (error) throw error;
  if (!data) return { escala_min: 1.0, nota_minima: 3.0, nota_maxima: 5.0, sistema_periodos: "bimestre", cantidad_periodos: 4 };
  return data;
}

export async function guardarNotasConfig(materiaId, config) {
  const { error } = await supabase.from("notas_config").upsert({ materia_id: materiaId, ...config }, { onConflict: "materia_id" });
  if (error) throw error;
}

export async function fetchCategorias(materiaId) {
  const { data, error } = await supabase.from("notas_categorias").select("*").eq("materia_id", materiaId).order("id");
  if (error) throw error;
  return data || [];
}

export async function crearCategoria(materiaId, nombre, porcentaje) {
  const { error } = await supabase.from("notas_categorias").insert({ materia_id: materiaId, nombre, porcentaje });
  if (error) throw error;
}

export async function eliminarCategoria(id) {
  const { error } = await supabase.from("notas_categorias").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchActividades(materiaId, gradoId, periodo) {
  const { data, error } = await supabase
    .from("notas_actividades")
    .select("*")
    .eq("materia_id", materiaId)
    .eq("grado_id", gradoId)
    .eq("periodo", periodo)
    .order("id");
  if (error) throw error;
  return data || [];
}

export async function crearActividad(campos) {
  const { error } = await supabase.from("notas_actividades").insert(campos);
  if (error) throw error;
}

export async function editarActividad(id, cambios) {
  const { error } = await supabase.from("notas_actividades").update(cambios).eq("id", id);
  if (error) throw error;
}

export async function eliminarActividad(id) {
  const { error } = await supabase.from("notas_actividades").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchValores(actividadIds) {
  if (actividadIds.length === 0) return [];
  const { data, error } = await supabase.from("notas_valores").select("*").in("actividad_id", actividadIds);
  if (error) throw error;
  return data || [];
}

export async function setValor(actividadId, estudianteId, valor) {
  if (valor === null || valor === "" || isNaN(valor)) {
    const { error } = await supabase.from("notas_valores").delete().eq("actividad_id", actividadId).eq("estudiante_id", estudianteId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("notas_valores").upsert(
    { actividad_id: actividadId, estudiante_id: estudianteId, valor },
    { onConflict: "actividad_id,estudiante_id" }
  );
  if (error) throw error;
}

export async function fetchXpPorCategoria(estudianteIds, categorias) {
  if (estudianteIds.length === 0 || categorias.length === 0) return {};
  const { data, error } = await supabase
    .from("historial_gamificacion")
    .select("estudiante_id, categoria, xp")
    .in("estudiante_id", estudianteIds)
    .in("categoria", categorias);
  if (error) throw error;
  const mapa = {};
  (data || []).forEach((r) => {
    mapa[r.estudiante_id] = mapa[r.estudiante_id] || {};
    mapa[r.estudiante_id][r.categoria] = (mapa[r.estudiante_id][r.categoria] || 0) + r.xp;
  });
  return mapa;
}

export async function fetchNotasFinales(materiaId) {
  const { data, error } = await supabase.from("notas_finales_periodo").select("*").eq("materia_id", materiaId);
  if (error) throw error;
  return data || [];
}

export async function guardarNotaFinal(materiaId, estudianteId, periodo, nota) {
  const { error } = await supabase.from("notas_finales_periodo").upsert(
    { materia_id: materiaId, estudiante_id: estudianteId, periodo, nota },
    { onConflict: "materia_id,estudiante_id,periodo" }
  );
  if (error) throw error;
}

export async function fetchNivelacion(materiaId) {
  const { data, error } = await supabase.from("nivelacion").select("*").eq("materia_id", materiaId);
  if (error) throw error;
  return data || [];
}

export async function setNivelacion(materiaId, estudianteId, periodo, estado) {
  if (!estado) {
    const { error } = await supabase.from("nivelacion").delete().eq("materia_id", materiaId).eq("estudiante_id", estudianteId).eq("periodo", periodo);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("nivelacion").upsert(
    { materia_id: materiaId, estudiante_id: estudianteId, periodo, estado },
    { onConflict: "materia_id,estudiante_id,periodo" }
  );
  if (error) throw error;
}

export async function calcularNotasFinalesPeriodo(materiaId, gradoId, periodo, estudiantes, categorias, config) {
  const acts = await fetchActividades(materiaId, gradoId, periodo);
  const valoresRows = await fetchValores(acts.map((a) => a.id));
  const categoriasGam = [...new Set(acts.filter((a) => a.es_automatica).map((a) => a.gam_categoria))];
  const xpMapa = categoriasGam.length > 0 ? await fetchXpPorCategoria(estudiantes.map((s) => s.id), categoriasGam) : {};
  const resultado = {};
  for (const s of estudiantes) {
    const porCategoria = {};
    acts.forEach((a) => {
      let v;
      if (a.es_automatica) {
        const xp = xpMapa[s.id]?.[a.gam_categoria] || 0;
        v = notaAutomatica(xp, a.xp_meta, config);
      } else {
        v = valoresRows.find((r) => r.actividad_id === a.id && r.estudiante_id === s.id)?.valor ?? null;
      }
      if (v === null || v === undefined) return;
      porCategoria[a.categoria_id] = porCategoria[a.categoria_id] || [];
      porCategoria[a.categoria_id].push(v);
    });
    resultado[s.id] = notaFinalPonderada(porCategoria, categorias);
  }
  return resultado;
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
