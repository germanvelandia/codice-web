import { supabase } from "./supabaseClient";
import { GRADOS_BASE, ordenarPorApellido } from "./gamification";
import { notaAutomatica, notaFinalPonderada } from "./calificaciones";
import { NIVELACION_COMPROMISOS_DEFAULT } from "./actasTemplates";

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

export async function fetchUsuarioActualId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
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
    .eq("activo", true);
  if (error) throw error;
  return ordenarPorApellido(data || []);
}

export async function fetchTodosEstudiantes() {
  const { data, error } = await supabase
    .from("estudiantes")
    .select("*, progreso(*)")
    .eq("activo", true);
  if (error) throw error;
  return ordenarPorApellido(data || []);
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

/* ---------------- Acceso de estudiantes (código, sin cuenta) ---------------- */
function generarCodigo() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function generarCodigoAcceso(estudianteId) {
  for (let intento = 0; intento < 5; intento++) {
    const codigo = generarCodigo();
    const { error } = await supabase.from("estudiantes").update({ codigo_acceso: codigo }).eq("id", estudianteId);
    if (!error) return codigo;
    if (error.code !== "23505") throw error;
  }
  throw new Error("No se pudo generar un código único, intenta de nuevo.");
}

export async function generarCodigosMasivo(estudiantes) {
  const resultados = {};
  for (const s of estudiantes) {
    if (s.codigo_acceso) { resultados[s.id] = s.codigo_acceso; continue; }
    resultados[s.id] = await generarCodigoAcceso(s.id);
  }
  return resultados;
}

export async function consultarPortalEstudiante(codigo) {
  const { data, error } = await supabase.rpc("estudiante_portal", { p_codigo: codigo.trim().toUpperCase() });
  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
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

export async function editarActa(id, cambios) {
  const { error } = await supabase.from("actas").update(cambios).eq("id", id);
  if (error) throw error;
}

/* ---------------- Acta automática por pérdida de materia ---------------- */
export async function crearActaNivelacionSiReprobado(materiaId, materiaNombre, estudianteId, periodo, notaFinal, config) {
  if (notaFinal === null || notaFinal === undefined) return null;
  const reprobado = notaFinal < config.nota_minima;

  const { data: existente, error: eBusqueda } = await supabase
    .from("actas")
    .select("id, estado")
    .eq("estudiante_id", estudianteId)
    .eq("materia_id", materiaId)
    .eq("periodo", periodo)
    .eq("tipo", "Nivelación")
    .maybeSingle();
  if (eBusqueda) throw eBusqueda;

  if (!reprobado) return null; // aprobó: no se crea acta, nada que tocar aquí

  if (existente) {
    // Ya existía el acta (quizás de una nota anterior) — se actualiza con la nota vigente,
    // salvo que ya esté marcada como superada por el docente
    if (existente.estado !== "superado") {
      await editarActa(existente.id, {
        motivo: `Pérdida de ${materiaNombre} en el periodo ${periodo} (nota final ${notaFinal}, mínima aprobatoria ${config.nota_minima}).`,
        fecha: new Date().toISOString().slice(0, 10),
      });
    }
    return existente;
  }

  await crearActa(estudianteId, {
    tipo: "Nivelación",
    fecha: new Date().toISOString().slice(0, 10),
    materia_id: materiaId,
    periodo,
    estado: "pendiente",
    motivo: `Pérdida de ${materiaNombre} en el periodo ${periodo} (nota final ${notaFinal}, mínima aprobatoria ${config.nota_minima}).`,
    descripcion: "Acta generada automáticamente al guardar las notas finales del periodo.",
    compromisos_academicos: NIVELACION_COMPROMISOS_DEFAULT,
  });
  return null;
}

/* Mantiene el acta de Nivelación sincronizada con el estado que el docente
   marca manualmente en el Boletín (Pendiente / En proceso / Superado) */
export async function sincronizarEstadoActaNivelacion(estudianteId, materiaId, periodo, estadoNivelacion) {
  const { data: acta, error } = await supabase
    .from("actas")
    .select("id, estado")
    .eq("estudiante_id", estudianteId)
    .eq("materia_id", materiaId)
    .eq("periodo", periodo)
    .eq("tipo", "Nivelación")
    .maybeSingle();
  if (error) throw error;
  if (!acta) return;

  const nuevoEstado = estadoNivelacion || "pendiente";
  if (acta.estado === nuevoEstado) return;

  await editarActa(acta.id, {
    estado: nuevoEstado,
    ...(nuevoEstado === "superado" ? { descripcion: "Nivelación superada — compromiso cumplido." } : {}),
  });
}

/* ---------------- Catálogo de comportamientos (convivenciales y académicos) ---------------- */
export async function fetchComportamientos(categoria) {
  let query = supabase.from("comportamientos").select("*, profesores(nombre)").order("nombre");
  if (categoria) query = query.eq("categoria", categoria);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function crearComportamiento(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("comportamientos")
    .insert({ ...campos, docente_id: userData?.user?.id || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarComportamiento(id) {
  const { error } = await supabase.from("comportamientos").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- Catálogo de reinos/equipos ---------------- */
export async function fetchReinos() {
  const { data, error } = await supabase.from("reinos").select("*").order("nombre");
  if (error) throw error;
  return data || [];
}

export async function crearReino(nombre, color) {
  const { data, error } = await supabase.from("reinos").insert({ nombre: nombre.trim(), color: color || null }).select().single();
  if (error) throw error;
  return data;
}

export async function guardarReino(id, cambios) {
  const { error } = await supabase.from("reinos").update(cambios).eq("id", id);
  if (error) throw error;
}

export async function eliminarReino(id) {
  const { error } = await supabase.from("reinos").delete().eq("id", id);
  if (error) throw error;
}

// Cambia el nombre del reino en el catálogo Y en todos los estudiantes que
// lo tengan asignado (reino_actual y reino_original), para que el cambio se
// vea reflejado en todas partes sin dejar estudiantes "huérfanos".
export async function renombrarReino(id, nombreAnterior, nombreNuevo) {
  const nuevo = nombreNuevo.trim();
  if (!nuevo || nuevo === nombreAnterior) return;
  await guardarReino(id, { nombre: nuevo });
  const { error: e1 } = await supabase.from("estudiantes").update({ reino_actual: nuevo }).eq("reino_actual", nombreAnterior);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("estudiantes").update({ reino_original: nuevo }).eq("reino_original", nombreAnterior);
  if (e2) throw e2;
}

// Retira un reino: mueve a TODOS los estudiantes de ese grado que lo tengan
// asignado hacia otro grupo (nombreDestino, ej. "Sin grupo"), para que el
// reino de origen deje de aparecer en cualquier listado.
export async function moverEstudiantesReino(gradoId, nombreOrigen, nombreDestino) {
  const { error: e1 } = await supabase
    .from("estudiantes")
    .update({ reino_actual: nombreDestino, reino_original: nombreDestino })
    .eq("grado_id", gradoId)
    .eq("reino_actual", nombreOrigen);
  if (e1) throw e1;

  const { error: e2 } = await supabase
    .from("estudiantes")
    .update({ reino_actual: nombreDestino, reino_original: nombreDestino })
    .eq("grado_id", gradoId)
    .is("reino_actual", null)
    .eq("reino_original", nombreOrigen);
  if (e2) throw e2;
}

/* ---------------- Docentes / cuenta / administración ---------------- */
export async function fetchProfesoresConMaterias() {
  const { data, error } = await supabase.from("profesores").select("*, materias(nombre)").order("nombre");
  if (error) throw error;
  return data || [];
}

export async function fetchMiPerfil() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return null;
  const { data, error } = await supabase.from("profesores").select("*").eq("id", userData.user.id).maybeSingle();
  if (error) throw error;
  return data;
}

// Cambia la contraseña de la cuenta actualmente conectada. No existe (ni en
// Supabase ni en ningún sistema serio) forma de leer o recuperar la
// contraseña anterior de alguien: solo se puede establecer una nueva.
export async function cambiarMiContrasena(nuevaContrasena) {
  const { error } = await supabase.auth.updateUser({ password: nuevaContrasena });
  if (error) throw error;
}

export async function establecerAdmin(profesorId, esAdmin) {
  const { error } = await supabase.from("profesores").update({ es_admin: esAdmin }).eq("id", profesorId);
  if (error) throw error;
}

export async function fetchInstitucion() {
  const { data, error } = await supabase.from("institucion").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  return data || { id: 1, nombre: "Institución Educativa", ciclo: "", anio: "", logo_url: null };
}

export async function guardarInstitucion(campos) {
  const { error } = await supabase.from("institucion").upsert({ id: 1, ...campos }, { onConflict: "id" });
  if (error) throw error;
}

/* ==================== CALIFICACIONES ==================== */

export async function fetchMaterias() {
  const { data, error } = await supabase.from("materias").select("*, profesores(nombre)").order("nombre");
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
  const { data, error } = await supabase.from("notas_actividades").insert(campos).select().single();
  if (error) throw error;
  return data;
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
// materiaId: la materia/clase en la que se toma la asistencia. Usa null para
// asistencia "general" (no asociada a una materia puntual).
export async function fetchAsistenciaFecha(estudianteIds, fecha, materiaId = null) {
  if (estudianteIds.length === 0) return {};
  let query = supabase.from("asistencia").select("*").eq("fecha", fecha).in("estudiante_id", estudianteIds);
  query = materiaId ? query.eq("materia_id", materiaId) : query.is("materia_id", null);
  const { data, error } = await query;
  if (error) throw error;
  const mapa = {};
  (data || []).forEach((f) => { mapa[f.estudiante_id] = f; });
  return mapa;
}

export async function marcarAsistencia(estudianteId, fecha, codigo, observacion, materiaId = null) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("asistencia").upsert(
    { estudiante_id: estudianteId, fecha, codigo, observacion: observacion || null, materia_id: materiaId, docente_id: userData?.user?.id || null },
    { onConflict: "estudiante_id,fecha,materia_id" }
  );
  if (error) throw error;
}

export async function quitarAsistencia(estudianteId, fecha, materiaId = null) {
  let query = supabase.from("asistencia").delete().eq("estudiante_id", estudianteId).eq("fecha", fecha);
  query = materiaId ? query.eq("materia_id", materiaId) : query.is("materia_id", null);
  const { error } = await query;
  if (error) throw error;
}

export async function marcarTodosPresentes(estudianteIds, fecha, materiaId = null) {
  const { data: userData } = await supabase.auth.getUser();
  const filas = estudianteIds.map((id) => ({ estudiante_id: id, fecha, codigo: "P", materia_id: materiaId, docente_id: userData?.user?.id || null }));
  const { error } = await supabase.from("asistencia").upsert(filas, { onConflict: "estudiante_id,fecha,materia_id" });
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

// Vista consolidada de la asistencia de un estudiante en TODAS sus materias
// (de todos los docentes), para sustentar procesos convivenciales.
export async function fetchAsistenciaConsolidadaEstudiante(estudianteId) {
  const { data, error } = await supabase
    .from("asistencia")
    .select("*, materias(nombre, profesores(nombre))")
    .eq("estudiante_id", estudianteId)
    .order("fecha", { ascending: false });
  if (error) throw error;

  const porMateria = {};
  const general = { P: 0, R: 0, FI: 0, FJ: 0, total: 0 };
  (data || []).forEach((f) => {
    const key = f.materia_id ? (f.materias?.nombre || `Materia ${f.materia_id}`) : "General (sin materia asociada)";
    if (!porMateria[key]) porMateria[key] = { P: 0, R: 0, FI: 0, FJ: 0, total: 0, docente: f.materias?.profesores?.nombre || null };
    porMateria[key][f.codigo] = (porMateria[key][f.codigo] || 0) + 1;
    porMateria[key].total++;
    general[f.codigo] = (general[f.codigo] || 0) + 1;
    general.total++;
  });
  return { general, porMateria, registros: data || [] };
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
