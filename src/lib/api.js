import { supabase } from "./supabaseClient";
import { GRADOS_BASE, ordenarPorApellido, buscarEstudiantePorNombre } from "./gamification";
import { notaAutomatica, notaFinalPonderada } from "./calificaciones";
import { NIVELACION_COMPROMISOS_DEFAULT, FALTAS_MANUAL } from "./actasTemplates";
import { CATALOGO_BASE } from "./avatarPartes";

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

export async function fetchGrados(incluirOcultos = false) {
  let query = supabase.from("grados").select("*");
  if (!incluirOcultos) query = query.eq("oculto", false);
  const { data, error } = await query;
  if (error) throw error;
  // Orden numérico (no alfabético): en texto "1001" queda antes que "801",
  // lo que hacía que los selectores de grado arrancaran siempre en 1001.
  return (data || []).sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
}

export async function guardarOcultoGrado(id, oculto) {
  const { error } = await supabase.from("grados").update({ oculto }).eq("id", id);
  if (error) throw error;
}

export async function crearGrado(id) {
  const { error } = await supabase.from("grados").upsert({ id, es_personalizado: true }, { onConflict: "id" });
  if (error) throw error;
}

/* ---------------- Promoción de fin de año ---------------- */
// Trae todos los cursos con la cantidad de estudiantes activos en cada uno,
// para armar la pantalla de promoción.
export async function fetchGradosConConteo() {
  const [gradosRes, estudiantesRes] = await Promise.all([
    fetchGrados(),
    supabase.from("estudiantes").select("id, grado_id").eq("activo", true),
  ]);
  const conteo = {};
  (estudiantesRes.data || []).forEach((e) => { conteo[e.grado_id] = (conteo[e.grado_id] || 0) + 1; });
  return gradosRes.map((g) => ({ ...g, cantidadEstudiantes: conteo[g.id] || 0 }));
}

// Vista previa: para cada mapeo {origen, destino}, devuelve la lista de
// estudiantes que se moverían — no cambia nada todavía.
export async function fetchPreviaPromocion(mapa) {
  const resultado = [];
  for (const { origen, destino, graduacion } of mapa) {
    const { data } = await supabase.from("estudiantes").select("id, nombre").eq("grado_id", origen).eq("activo", true).order("nombre");
    resultado.push({ origen, destino, graduacion, estudiantes: data || [] });
  }
  return resultado;
}

// Ejecuta la promoción real: mueve a cada estudiante de su curso de origen
// al de destino (o lo marca inactivo si es graduación), sin borrar ningún
// dato histórico de notas/asistencia — esos quedan tal cual estaban.
export async function ejecutarPromocion(mapa, reiniciarProgreso) {
  const { data: userData } = await supabase.auth.getUser();
  const detalle = [];

  for (const { origen, destino, graduacion } of mapa) {
    const { data: estudiantes } = await supabase.from("estudiantes").select("id, nombre").eq("grado_id", origen).eq("activo", true);
    if (!estudiantes || estudiantes.length === 0) continue;

    if (graduacion) {
      const ids = estudiantes.map((e) => e.id);
      await supabase.from("estudiantes").update({ activo: false }).in("id", ids);
      estudiantes.forEach((e) => detalle.push({ estudiante_id: e.id, nombre: e.nombre, grado_anterior: origen, grado_nuevo: "graduado" }));
    } else {
      await crearGrado(destino); // asegura que el curso destino exista
      const ids = estudiantes.map((e) => e.id);
      await supabase.from("estudiantes").update({ grado_id: destino }).in("id", ids);
      estudiantes.forEach((e) => detalle.push({ estudiante_id: e.id, nombre: e.nombre, grado_anterior: origen, grado_nuevo: destino }));

      if (reiniciarProgreso) {
        await Promise.all(ids.map((id) => supabase.from("progreso").upsert({ estudiante_id: id, xp: 0, vida: 100, monedas: 0 })));
      }
    }
  }

  await supabase.from("promociones_historial").insert({ docente_id: userData?.user?.id || null, detalle, reinicio_progreso: !!reiniciarProgreso });
  return detalle;
}

export async function fetchHistorialPromociones() {
  const { data, error } = await supabase.from("promociones_historial").select("*").order("creado_en", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function eliminarGrado(id) {
  const { count, error: e1 } = await supabase.from("estudiantes").select("id", { count: "exact", head: true }).eq("grado_id", id);
  if (e1) throw e1;
  if (count > 0) throw new Error(`Todavía hay ${count} estudiante(s) en este curso. Trasladalos a otro curso o desactivalos antes de eliminarlo.`);
  const { error } = await supabase.from("grados").delete().eq("id", id);
  if (error) throw error;
}

export async function guardarColorGrado(id, color) {
  const { error } = await supabase.from("grados").update({ color }).eq("id", id);
  if (error) throw error;
}

// Busca estudiantes por nombre en TODOS los grados a la vez (para el buscador global)
export async function buscarEstudiantesGlobal(query) {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase.from("estudiantes").select("id, nombre, grado_id").eq("activo", true).ilike("nombre", `%${q}%`).order("nombre").limit(15);
  if (error) throw error;
  return data || [];
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
export async function editarNombreEstudiante(id, nombre) {
  const { error } = await supabase.from("estudiantes").update({ nombre: nombre.trim() }).eq("id", id);
  if (error) throw error;
}

export async function guardarApellidos(id, apellidos) {
  const { error } = await supabase.from("estudiantes").update({ apellidos: apellidos.trim() || null }).eq("id", id);
  if (error) throw error;
}

export async function guardarDocumento(id, documento, extra = {}) {
  const { data, error } = await supabase.from("estudiantes").update({ documento: documento.trim() || null, ...extra }).eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error(`No se encontró ningún estudiante con id ${id} para actualizar (o el guardado quedó bloqueado silenciosamente).`);
}

// Traslada un estudiante a otro grado. Notas, asistencia, actas, progreso y
// código de acceso quedan vinculados al estudiante (no al grado), así que se
// conservan automáticamente — no hace falta volver a crearlo ni recalificarlo.
export async function trasladarEstudiante(id, nuevoGradoId, reiniciarGrupo) {
  const cambios = { grado_id: nuevoGradoId };
  if (reiniciarGrupo) { cambios.reino_actual = "Sin grupo"; cambios.reino_original = "Sin grupo"; }
  const { error } = await supabase.from("estudiantes").update(cambios).eq("id", id);
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

// Usado por el flujo de evaluaciones para saber el id/grado del estudiante a partir de su código
export async function fetchEstudiantePorCodigo(codigo) {
  const { data, error } = await supabase.from("estudiantes").select("id, nombre, grado_id, reino_actual, reino_original, foto_url").eq("codigo_acceso", codigo.trim().toUpperCase()).maybeSingle();
  if (error) throw error;
  return data;
}

/* ---------------- Roles de clase ---------------- */
export async function fetchRoles() {
  const { data, error } = await supabase.from("roles_clase").select("*").order("nombre");
  if (error) throw error;
  return data || [];
}

// Trae el rol asignado a un estudiante puntual (con nombre y descripción),
// para mostrárselo a él mismo en su portal.
export async function fetchMiRol(estudianteId) {
  const { data, error } = await supabase.from("roles_asignados").select("roles_clase(nombre, descripcion)").eq("estudiante_id", estudianteId).maybeSingle();
  if (error) throw error;
  return data?.roles_clase || null;
}

export async function crearRol(nombre, descripcion) {
  const { error } = await supabase.from("roles_clase").insert({ nombre, descripcion: descripcion || null });
  if (error) throw error;
}

export async function editarRol(id, nombre, descripcion) {
  const { error } = await supabase.from("roles_clase").update({ nombre, descripcion: descripcion || null }).eq("id", id);
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
  const [{ data, error }, profesoresRes] = await Promise.all([
    supabase.from("actas").select("*").eq("estudiante_id", estudianteId).order("fecha", { ascending: false }),
    supabase.from("profesores").select("id, nombre"),
  ]);
  if (error) throw error;
  const nombrePorId = {}; (profesoresRes.data || []).forEach((p) => { nombrePorId[p.id] = p.nombre; });
  return (data || []).map((a) => ({ ...a, profesores: a.registrado_por ? { nombre: nombrePorId[a.registrado_por] || null } : null }));
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
  let query = supabase.from("comportamientos").select("*").order("nombre");
  if (categoria) query = query.eq("categoria", categoria);
  const [{ data, error }, profesoresRes] = await Promise.all([query, supabase.from("profesores").select("id, nombre")]);
  if (error) throw error;
  const nombrePorId = {}; (profesoresRes.data || []).forEach((p) => { nombrePorId[p.id] = p.nombre; });
  return (data || []).map((c) => ({ ...c, profesores: c.docente_id ? { nombre: nombrePorId[c.docente_id] || null } : null }));
}

// Aplica un comportamiento del catálogo a varios estudiantes a la vez —
// crea un acta para cada uno (mismo formato que el formulario individual
// de Actas), sin tener que repetirlo uno por uno.
export async function aplicarComportamientoMasivo(estudianteIds, comportamiento, motivo, fecha) {
  const tipo = comportamiento.categoria === "convivencial" ? "Convivencial" : "Académico";
  const campos = { tipo, fecha: fecha || new Date().toISOString().slice(0, 10), motivo: (motivo || comportamiento.nombre).trim() };
  if (comportamiento.categoria === "convivencial") {
    campos.categoria_falta = comportamiento.id;
    campos.tipo_falta = comportamiento.nombre;
    campos.articulo = comportamiento.articulo || null;
    campos.plazo_dias = comportamiento.plazo_dias || null;
    campos.implicaciones_legales = comportamiento.implicaciones_legales || null;
  } else {
    campos.compromisos_academicos = comportamiento.plantilla || null;
  }
  let hechos = 0;
  const errores = [];
  for (const id of estudianteIds) {
    try {
      await crearActa(id, campos);
      hechos++;
    } catch (e) {
      errores.push(e.message);
    }
  }
  return { hechos, total: estudianteIds.length, errores };
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

export async function editarComportamiento(id, campos) {
  const { error } = await supabase.from("comportamientos").update(campos).eq("id", id);
  if (error) throw error;
}

// Crea en la base los 3 comportamientos convivenciales genéricos
// (Leve/Grave/Gravísima, según FALTAS_MANUAL) y la plantilla académica
// estándar — como filas normales, editables y eliminables como cualquier
// otra. Solo siembra lo que falte (no duplica si ya existen).
export async function sembrarComportamientosBase() {
  const { data: userData } = await supabase.auth.getUser();
  const docenteId = userData?.user?.id || null;
  const existentes = await fetchComportamientos();
  const filas = [];
  if (!existentes.some((c) => c.categoria === "convivencial")) {
    Object.values(FALTAS_MANUAL).forEach((f) => {
      filas.push({ docente_id: docenteId, categoria: "convivencial", nombre: f.tipo, articulo: f.articulo, plazo_dias: f.plazoDias, implicaciones_legales: f.implicaciones });
    });
  }
  if (!existentes.some((c) => c.categoria === "academico")) {
    filas.push({ docente_id: docenteId, categoria: "academico", nombre: "Recuperación estándar", plantilla: NIVELACION_COMPROMISOS_DEFAULT });
  }
  if (filas.length > 0) {
    const { error } = await supabase.from("comportamientos").insert(filas);
    if (error) throw error;
  }
}

// Borra TODO el catálogo de una categoría (propio del docente) y lo vuelve
// a sembrar con los valores genéricos de fábrica — para cuando cambia el
// manual de convivencia (ej: cambio de institución).
export async function restablecerComportamientos(categoria) {
  const { data: userData } = await supabase.auth.getUser();
  const docenteId = userData?.user?.id || null;
  await supabase.from("comportamientos").delete().eq("categoria", categoria).eq("docente_id", docenteId);
  if (categoria === "convivencial") {
    const filas = Object.values(FALTAS_MANUAL).map((f) => ({ docente_id: docenteId, categoria: "convivencial", nombre: f.tipo, articulo: f.articulo, plazo_dias: f.plazoDias, implicaciones_legales: f.implicaciones }));
    const { error } = await supabase.from("comportamientos").insert(filas);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("comportamientos").insert({ docente_id: docenteId, categoria: "academico", nombre: "Recuperación estándar", plantilla: NIVELACION_COMPROMISOS_DEFAULT });
    if (error) throw error;
  }
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

// Asignaturas personalizadas del Generador de Diplomas (además de las que
// vienen fijas en la app).
export async function fetchAsignaturasDiploma() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return [];
  const { data, error } = await supabase.from("diploma_asignaturas").select("*").eq("docente_id", userData.user.id).order("creado_en");
  if (error) throw error;
  return data || [];
}

export async function crearAsignaturaDiploma(nombre, pilares, patronFondo) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("diploma_asignaturas")
    .insert({ docente_id: userData?.user?.id, nombre, pilares, patron_fondo: patronFondo || "general" })
    .select().single();
  if (error) throw error;
  return data;
}

export async function eliminarAsignaturaDiploma(id) {
  const { error } = await supabase.from("diploma_asignaturas").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchMiPerfil() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return null;
  const { data, error } = await supabase.from("profesores").select("*").eq("id", userData.user.id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function guardarMiNombre(nombre) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return;
  const { error } = await supabase.from("profesores").update({ nombre }).eq("id", userData.user.id);
  if (error) throw error;
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

export async function eliminarDocente(profesorId) {
  const { error } = await supabase.from("profesores").delete().eq("id", profesorId);
  if (error) throw error;
}

/* ---------------- Procesos de inclusión (PIAR / DUA) ---------------- */
export async function guardarFotoEstudiante(estudianteId, fotoUrl) {
  const { error } = await supabase.from("estudiantes").update({ foto_url: fotoUrl }).eq("id", estudianteId);
  if (error) throw error;
}

export async function guardarInclusion(estudianteId, cambios) {
  const { error } = await supabase.from("estudiantes").update(cambios).eq("id", estudianteId);
  if (error) throw error;
}

// Trae a TODOS los estudiantes en proceso de inclusión (PIAR o DUA), sin
// importar el curso — para no tener que ir buscando uno por uno.
export async function fetchEstudiantesEnInclusion() {
  const { data, error } = await supabase.from("estudiantes").select("*")
    .eq("activo", true).or("piar.eq.true,dua.eq.true").order("nombre");
  if (error) throw error;
  return data || [];
}

export async function fetchSeguimientosInclusion(estudianteId) {
  const [seguimientosRes, profesoresRes, materiasRes] = await Promise.all([
    supabase.from("seguimiento_inclusion").select("*").eq("estudiante_id", estudianteId).order("fecha", { ascending: false }),
    supabase.from("profesores").select("id, nombre"),
    supabase.from("materias").select("id, nombre"),
  ]);
  if (seguimientosRes.error) throw seguimientosRes.error;
  const nombreProfPorId = {}; (profesoresRes.data || []).forEach((p) => { nombreProfPorId[p.id] = p.nombre; });
  const nombreMatPorId = {}; (materiasRes.data || []).forEach((m) => { nombreMatPorId[m.id] = m.nombre; });
  return (seguimientosRes.data || []).map((s) => ({
    ...s,
    profesores: s.docente_id ? { nombre: nombreProfPorId[s.docente_id] || null } : null,
    materias: s.materia_id ? { nombre: nombreMatPorId[s.materia_id] || null } : null,
  }));
}

export async function crearSeguimientoInclusion(estudianteId, materiaId, tipo, observacion) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("seguimiento_inclusion").insert({
    estudiante_id: estudianteId,
    materia_id: materiaId || null,
    docente_id: userData?.user?.id || null,
    tipo,
    observacion,
    fecha: new Date().toISOString().slice(0, 10),
  });
  if (error) throw error;
}

export async function eliminarSeguimientoInclusion(id) {
  const { error } = await supabase.from("seguimiento_inclusion").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- Directorio de acudientes ---------------- */
export async function fetchAcudientesPorGrado(gradoId) {
  const estudiantes = await fetchEstudiantesPorGrado(gradoId);
  const ids = estudiantes.map((e) => e.id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("acudientes").select("*").in("estudiante_id", ids);
  if (error) throw error;
  const mapa = {};
  (data || []).forEach((a) => { mapa[a.estudiante_id] = a; });
  return estudiantes.map((s) => ({ estudiante: s, acudiente: mapa[s.id] || null }));
}

export async function guardarAcudiente(estudianteId, campos) {
  const { data, error } = await supabase.from("acudientes").upsert(
    { estudiante_id: estudianteId, ...campos },
    { onConflict: "estudiante_id" }
  ).select("estudiante_id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error(`El guardado del acudiente del estudiante ${estudianteId} no devolvió confirmación (posible bloqueo silencioso).`);
}

/* ---------------- Horario de clases ---------------- */
export async function fetchHorario() {
  const [horarioRes, profesoresRes] = await Promise.all([
    supabase.from("horario").select("*, materias(nombre)").order("dia_semana").order("hora_inicio"),
    supabase.from("profesores").select("id, nombre"),
  ]);
  if (horarioRes.error) throw horarioRes.error;
  if (profesoresRes.error) throw profesoresRes.error;
  const nombrePorId = {};
  (profesoresRes.data || []).forEach((p) => { nombrePorId[p.id] = p.nombre; });
  return (horarioRes.data || []).map((h) => ({ ...h, profesores: { nombre: nombrePorId[h.docente_id] || null } }));
}

export async function crearHorario(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("horario").insert({ ...campos, docente_id: userData?.user?.id || null });
  if (error) throw error;
}

export async function eliminarHorario(id) {
  const { error } = await supabase.from("horario").delete().eq("id", id);
  if (error) throw error;
}

export async function editarHorario(id, cambios) {
  const { error } = await supabase.from("horario").update(cambios).eq("id", id);
  if (error) throw error;
}

/* ---------------- Cronograma de actividades ---------------- */
export async function fetchCronograma() {
  const [cronoRes, profesoresRes] = await Promise.all([
    supabase.from("cronograma").select("*").order("fecha"),
    supabase.from("profesores").select("id, nombre"),
  ]);
  if (cronoRes.error) throw cronoRes.error;
  if (profesoresRes.error) throw profesoresRes.error;
  const nombrePorId = {};
  (profesoresRes.data || []).forEach((p) => { nombrePorId[p.id] = p.nombre; });
  return (cronoRes.data || []).map((e) => ({ ...e, profesores: { nombre: nombrePorId[e.docente_id] || null } }));
}

export async function crearEventoCronograma(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("cronograma").insert({ ...campos, docente_id: userData?.user?.id || null }).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarEventoCronograma(id) {
  const { error } = await supabase.from("cronograma").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- Planeaciones (plan de estudios y clases) ---------------- */
function detectarTipoRecurso(url) {
  if (/docs\.google\.com\/document/.test(url)) return "docs";
  if (/docs\.google\.com\/forms|forms\.gle/.test(url)) return "forms";
  if (/drive\.google\.com/.test(url)) return "drive";
  return "otro";
}

// Todas las clases (de todas las unidades) de una materia+grado+periodo, con el
// título de su unidad — para la vista de calendario.
export async function fetchTodasLasClases(materiaId, gradoId, periodo) {
  const unidades = await fetchUnidades(materiaId, gradoId, periodo);
  const unidadIds = unidades.map((u) => u.id);
  if (unidadIds.length === 0) return { clases: [], unidades: [] };
  const { data, error } = await supabase.from("planeaciones").select("*").in("unidad_id", unidadIds).eq("tipo", "clase").order("orden");
  if (error) throw error;
  const unidadPorId = {}; unidades.forEach((u) => { unidadPorId[u.id] = u; });
  const clases = (data || []).map((c) => ({ ...c, unidad_titulo: unidadPorId[c.unidad_id]?.titulo || "" }));
  return { clases, unidades };
}

// Crea una unidad y, adentro, todas las clases que vengan en la lista —
// usado por el importador de planes generados externamente con IA.
export async function crearUnidadConClases(datosUnidad, clases) {
  const unidad = await crearPlaneacion({ tipo: "unidad", ...datosUnidad });
  for (let i = 0; i < clases.length; i++) {
    const c = clases[i];
    await crearPlaneacion({
      tipo: "clase", unidad_id: unidad.id, orden: i,
      titulo: c.titulo || `Clase ${i + 1}`,
      duracion_minutos: c.duracion_minutos || null,
      momento_inicio: c.momento_inicio || null,
      momento_desarrollo: c.momento_desarrollo || null,
      momento_cierre: c.momento_cierre || null,
      indicador_desempeno: c.indicador_desempeno || null,
    });
  }
  return unidad;
}

export async function fetchUnidades(materiaId, gradoId, periodo) {
  const nivel = String(gradoId || "").slice(0, -2) || String(gradoId || "");
  const { data, error } = await supabase
    .from("planeaciones")
    .select("*")
    .eq("periodo", periodo).eq("tipo", "unidad")
    .or(`grado_id.eq.${gradoId},grado_id.eq.${nivel}`)
    .order("orden");
  if (error) throw error;
  return (data || []).filter((u) => u.materia_id === materiaId || (u.materias_extra || []).includes(materiaId));
}

export async function fetchClases(unidadId) {
  const { data, error } = await supabase.from("planeaciones").select("*").eq("unidad_id", unidadId).eq("tipo", "clase").order("orden");
  if (error) throw error;
  return data || [];
}

export async function crearPlaneacion(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("planeaciones").insert({ ...campos, docente_id: userData?.user?.id || null }).select().single();
  if (error) throw error;
  return data;
}

export async function editarPlaneacion(id, cambios) {
  const { error } = await supabase.from("planeaciones").update(cambios).eq("id", id);
  if (error) throw error;
}

export async function eliminarPlaneacion(id) {
  const { error } = await supabase.from("planeaciones").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchRecursos(planeacionId) {
  const { data, error } = await supabase.from("planeacion_recursos").select("*").eq("planeacion_id", planeacionId).order("id");
  if (error) throw error;
  return data || [];
}

export async function crearRecurso(planeacionId, url, titulo) {
  const { error } = await supabase.from("planeacion_recursos").insert({
    planeacion_id: planeacionId, url: url.trim(), titulo: titulo?.trim() || null, tipo: detectarTipoRecurso(url),
  });
  if (error) throw error;
}

export async function eliminarRecurso(id) {
  const { error } = await supabase.from("planeacion_recursos").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchTareas(planeacionId) {
  const { data, error } = await supabase.from("planeacion_tareas").select("*").eq("planeacion_id", planeacionId).order("fecha_entrega");
  if (error) throw error;
  return data || [];
}

export async function crearTarea(campos) {
  const { data, error } = await supabase.from("planeacion_tareas").insert(campos).select().single();
  if (error) throw error;
  return data;
}

export async function editarTarea(id, campos) {
  const { error } = await supabase.from("planeacion_tareas").update(campos).eq("id", id);
  if (error) throw error;
}

export async function eliminarTarea(id) {
  const { error } = await supabase.from("planeacion_tareas").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchRubrica(tareaId) {
  const { data, error } = await supabase.from("planeacion_rubricas").select("*").eq("tarea_id", tareaId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function guardarRubrica(tareaId, criterios) {
  const { error } = await supabase.from("planeacion_rubricas").upsert(
    { tarea_id: tareaId, criterios, actualizado_en: new Date().toISOString() },
    { onConflict: "tarea_id" }
  );
  if (error) throw error;
}

/* ---------------- DBA y Competencias (catálogo propio, vinculable a planeaciones) ---------------- */
export async function fetchEstandares(tipo) {
  let query = supabase.from("estandares").select("*").order("codigo");
  if (tipo) query = query.eq("tipo", tipo);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function crearEstandar(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("estandares").insert({ ...campos, docente_id: userData?.user?.id || null }).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarEstandar(id) {
  const { error } = await supabase.from("estandares").delete().eq("id", id);
  if (error) throw error;
}

export async function editarEstandar(id, cambios) {
  const { error } = await supabase.from("estandares").update(cambios).eq("id", id);
  if (error) throw error;
}

export async function fetchEstandaresDePlaneacion(planeacionId) {
  const { data, error } = await supabase.from("planeacion_estandares").select("*, estandares(*)").eq("planeacion_id", planeacionId);
  if (error) throw error;
  return (data || []).map((r) => r.estandares);
}

export async function vincularEstandar(planeacionId, estandarId) {
  const { error } = await supabase.from("planeacion_estandares").insert({ planeacion_id: planeacionId, estandar_id: estandarId });
  if (error && error.code !== "23505") throw error; // ignora si ya estaba vinculado
}

export async function desvincularEstandar(planeacionId, estandarId) {
  const { error } = await supabase.from("planeacion_estandares").delete().eq("planeacion_id", planeacionId).eq("estandar_id", estandarId);
  if (error) throw error;
}

/* ---------------- Evaluaciones virtuales (lado docente) ---------------- */
export async function fetchEvaluaciones(materiaId, gradoId, periodo) {
  const { data, error } = await supabase.from("evaluaciones").select("*")
    .eq("materia_id", materiaId).eq("grado_id", gradoId).eq("periodo", periodo).order("creado_en", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function crearEvaluacion(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("evaluaciones").insert({ ...campos, docente_id: userData?.user?.id || null }).select().single();
  if (error) throw error;
  return data;
}

export async function editarEvaluacion(id, cambios) {
  const { error } = await supabase.from("evaluaciones").update(cambios).eq("id", id);
  if (error) throw error;
}

export async function eliminarEvaluacion(id) {
  const { error } = await supabase.from("evaluaciones").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchPreguntasDocente(evaluacionId) {
  const { data, error } = await supabase.from("evaluacion_preguntas").select("*").eq("evaluacion_id", evaluacionId).order("orden");
  if (error) throw error;
  return data || [];
}

export async function crearPregunta(campos) {
  const { error } = await supabase.from("evaluacion_preguntas").insert(campos);
  if (error) throw error;
}

// Crea la pregunta en la evaluación, y opcionalmente una copia en el banco
// de preguntas, para que quede disponible también para otras evaluaciones.
export async function crearPreguntaConBanco(campos, guardarEnBanco, materiaId, tema, nivel) {
  await crearPregunta(campos);
  if (guardarEnBanco && materiaId && campos.tipo !== "respuesta_corta") {
    await crearPreguntaBanco({ materia_id: materiaId, nivel: nivel || null, tema: tema || null, enunciado: campos.enunciado, opciones: campos.opciones, retroalimentacion: campos.retroalimentacion || null });
  }
}

// Empieza el intento de siempre (sin tocar la función existente), y si la
// evaluación tiene preguntas aleatorias configuradas, le sortea un
// subconjunto propio a este intento puntual — estable durante todo el intento.
export async function iniciarIntentoConAleatorias(evaluacion, estudianteId) {
  const intentoId = await iniciarIntento(evaluacion.id, estudianteId);

  if (!evaluacion.preguntas_aleatorias_cantidad) {
    const preguntas = await obtenerPreguntasParaEstudiante(evaluacion.id);
    return { intentoId, preguntas };
  }

  // ¿Ya tiene preguntas asignadas este intento? (por si recarga la página)
  const { data: yaAsignadas } = await supabase.from("evaluacion_intento_preguntas").select("pregunta_id, orden").eq("intento_id", intentoId).order("orden");
  const todas = await obtenerPreguntasParaEstudiante(evaluacion.id);

  if (yaAsignadas && yaAsignadas.length > 0) {
    const porId = {}; todas.forEach((p) => { porId[p.id] = p; });
    const preguntas = yaAsignadas.map((a) => porId[a.pregunta_id]).filter(Boolean);
    return { intentoId, preguntas };
  }

  const cantidad = Math.min(evaluacion.preguntas_aleatorias_cantidad, todas.length);
  const elegidas = [...todas].sort(() => Math.random() - 0.5).slice(0, cantidad);
  await supabase.from("evaluacion_intento_preguntas").insert(
    elegidas.map((p, i) => ({ intento_id: intentoId, pregunta_id: p.id, orden: i }))
  );
  return { intentoId, preguntas: elegidas };
}

export async function editarPregunta(id, campos) {
  const { error } = await supabase.from("evaluacion_preguntas").update(campos).eq("id", id);
  if (error) throw error;
}

export async function eliminarPregunta(id) {
  const { error } = await supabase.from("evaluacion_preguntas").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchIntentosDeEvaluacion(evaluacionId) {
  const [intentosRes, estudiantesRes] = await Promise.all([
    supabase.from("evaluacion_intentos").select("*").eq("evaluacion_id", evaluacionId).order("entregado_en"),
    supabase.from("estudiantes").select("id, nombre"),
  ]);
  if (intentosRes.error) throw intentosRes.error;
  if (estudiantesRes.error) throw estudiantesRes.error;
  const nombrePorId = {};
  (estudiantesRes.data || []).forEach((e) => { nombrePorId[e.id] = e.nombre; });
  return (intentosRes.data || []).map((i) => ({ ...i, estudiante_nombre: nombrePorId[i.estudiante_id] || `Estudiante ${i.estudiante_id}` }));
}

export async function fetchRespuestasDeIntento(intentoId) {
  const { data, error } = await supabase.from("evaluacion_respuestas").select("*, evaluacion_preguntas(enunciado, tipo, puntos, opciones)").eq("intento_id", intentoId);
  if (error) throw error;
  return data || [];
}

export async function calificarRespuesta(respuestaId, puntos, correcta) {
  const { error } = await supabase.from("evaluacion_respuestas").update({ puntos_obtenidos: puntos, correcta }).eq("id", respuestaId);
  if (error) throw error;
}

export async function recalcularPuntajeIntento(intentoId) {
  const { data, error } = await supabase.from("evaluacion_respuestas").select("puntos_obtenidos").eq("intento_id", intentoId);
  if (error) throw error;
  const total = (data || []).reduce((acc, r) => acc + (r.puntos_obtenidos || 0), 0);
  const { error: e2 } = await supabase.from("evaluacion_intentos").update({ puntaje_obtenido: total, estado: "calificado" }).eq("id", intentoId);
  if (e2) throw e2;
}

// Manda la nota de una Misión (evaluación) escalada a la escala de la materia
// (ej: puntaje 7/10 -> 3.5/5), directo a la Planilla de Calificaciones.
async function empujarNotaAEvaluacion(evaluacion, estudianteId, puntajeObtenido, puntajeMaximo) {
  if (!evaluacion?.categoria_id || !puntajeMaximo || puntajeMaximo <= 0 || puntajeObtenido === null) return;
  const config = await fetchNotasConfig(evaluacion.materia_id);
  const notaEscalada = Math.round((puntajeObtenido / puntajeMaximo) * (config.nota_maxima || 5) * 10) / 10;
  const existentes = await fetchActividades(evaluacion.materia_id, evaluacion.grado_id, evaluacion.periodo);
  let actividad = existentes.find((a) => a.nombre === evaluacion.titulo);
  if (!actividad) {
    actividad = await crearActividad({
      nombre: evaluacion.titulo, categoria_id: evaluacion.categoria_id, materia_id: evaluacion.materia_id,
      grado_id: evaluacion.grado_id, periodo: evaluacion.periodo, es_automatica: false,
    });
  }
  await setValor(actividad.id, estudianteId, notaEscalada);
}

export async function publicarResultado(intentoId, visible = true, evaluacion = null, intento = null) {
  const { error } = await supabase.from("evaluacion_intentos").update({ visible_para_estudiante: visible }).eq("id", intentoId);
  if (error) throw error;
  if (visible && evaluacion && intento) {
    await empujarNotaAEvaluacion(evaluacion, intento.estudiante_id, intento.puntaje_obtenido, intento.puntaje_maximo);
  }
}

export async function publicarTodosLosResultados(evaluacionId, evaluacion = null) {
  const { data: intentos, error: e1 } = await supabase.from("evaluacion_intentos").select("*").eq("evaluacion_id", evaluacionId).neq("estado", "en_progreso");
  if (e1) throw e1;
  const { error } = await supabase.from("evaluacion_intentos").update({ visible_para_estudiante: true }).eq("evaluacion_id", evaluacionId);
  if (error) throw error;
  if (evaluacion) {
    for (const intento of intentos || []) {
      await empujarNotaAEvaluacion(evaluacion, intento.estudiante_id, intento.puntaje_obtenido, intento.puntaje_maximo);
    }
  }
}

/* ---------------- Evaluaciones virtuales (lado estudiante, vía código de acceso) ---------------- */
export async function fetchEvaluacionesDisponibles(gradoId, materiaId) {
  let query = supabase.from("evaluaciones").select("*").eq("estado", "publicada").eq("grado_id", gradoId);
  if (materiaId) query = query.eq("materia_id", materiaId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchMisIntentos(evaluacionId, estudianteId) {
  const { data, error } = await supabase.from("evaluacion_intentos").select("*").eq("evaluacion_id", evaluacionId).eq("estudiante_id", estudianteId).order("numero_intento");
  if (error) throw error;
  return data || [];
}

export async function obtenerPreguntasParaEstudiante(evaluacionId) {
  const { data, error } = await supabase.rpc("obtener_preguntas_evaluacion", { p_evaluacion_id: evaluacionId });
  if (error) throw error;
  return data || [];
}

export async function iniciarIntento(evaluacionId, estudianteId) {
  const { data, error } = await supabase.rpc("iniciar_intento_evaluacion", { p_evaluacion_id: evaluacionId, p_estudiante_id: estudianteId });
  if (error) throw error;
  return data;
}

export async function entregarIntento(intentoId, respuestas) {
  const { error } = await supabase.rpc("entregar_intento_evaluacion", { p_intento_id: intentoId, p_respuestas: respuestas });
  if (error) throw error;
}

export async function copiarEvaluacion(evaluacionId, materiaDestinoId, gradoDestinoId, periodoDestino) {
  const { data: original, error: e1 } = await supabase.from("evaluaciones").select("*").eq("id", evaluacionId).single();
  if (e1) throw e1;
  const preguntas = await fetchPreguntasDocente(evaluacionId);

  const nueva = await crearEvaluacion({
    materia_id: materiaDestinoId, grado_id: gradoDestinoId, periodo: periodoDestino,
    titulo: original.titulo, descripcion: original.descripcion,
    fecha_apertura: null, fecha_cierre: null,
    intentos_permitidos: original.intentos_permitidos, tiempo_limite_minutos: original.tiempo_limite_minutos,
    estado: "borrador",
  });

  for (const p of preguntas) {
    await crearPregunta({
      evaluacion_id: nueva.id, orden: p.orden, tipo: p.tipo, enunciado: p.enunciado, puntos: p.puntos, opciones: p.opciones,
    });
  }
  return nueva;
}

// Notas de un estudiante (todas las materias, todos los periodos) — usado en el portal del estudiante
export async function fetchNotasEstudiante(estudianteId) {
  const { data: finales, error: e1 } = await supabase
    .from("notas_finales_periodo")
    .select("*, materias(nombre)")
    .eq("estudiante_id", estudianteId)
    .order("periodo");
  if (e1) throw e1;

  const { data: valores, error: e2 } = await supabase
    .from("notas_valores")
    .select("*, notas_actividades(nombre, periodo, materia_id, categoria_id, materias(nombre), notas_categorias(nombre, porcentaje))")
    .eq("estudiante_id", estudianteId);
  if (e2) throw e2;

  return { finales: finales || [], valores: valores || [] };
}

/* ---------------- Comentarios generales por banda de desempeño ---------------- */
export async function fetchComentariosDesempeno() {
  const { data, error } = await supabase.from("comentarios_desempeno").select("*");
  if (error) throw error;
  const mapa = {};
  (data || []).forEach((c) => { mapa[c.banda] = c.comentario; });
  return mapa;
}

export async function guardarComentarioDesempeno(banda, comentario) {
  const { error } = await supabase.from("comentarios_desempeno").upsert(
    { banda, comentario, actualizado_en: new Date().toISOString() },
    { onConflict: "banda" }
  );
  if (error) throw error;
}

/* ---------------- Control de dictado (misma clase, varios cursos) ---------------- */
export async function fetchDictados(claseId) {
  const { data, error } = await supabase.from("planeacion_dictados").select("*").eq("clase_id", claseId).order("fecha");
  if (error) throw error;
  return data || [];
}

export async function crearDictado(claseId, gradoId, fecha, estado) {
  const { error } = await supabase.from("planeacion_dictados").insert({ clase_id: claseId, grado_id: gradoId, fecha: fecha || null, estado });
  if (error) throw error;
}

export async function editarDictado(id, cambios) {
  const { error } = await supabase.from("planeacion_dictados").update(cambios).eq("id", id);
  if (error) throw error;
}

export async function eliminarDictado(id) {
  const { error } = await supabase.from("planeacion_dictados").delete().eq("id", id);
  if (error) throw error;
}

// Todos los pendientes/aplazados de las clases de una materia (para el panel de seguimiento)
export async function fetchDictadosPendientes(materiaId) {
  const { data: unidades, error: e1 } = await supabase.from("planeaciones").select("id").eq("materia_id", materiaId).eq("tipo", "unidad");
  if (e1) throw e1;
  const unidadIds = (unidades || []).map((u) => u.id);
  if (unidadIds.length === 0) return [];

  const { data: clases, error: e2 } = await supabase.from("planeaciones").select("id, titulo, unidad_id").in("unidad_id", unidadIds).eq("tipo", "clase");
  if (e2) throw e2;
  const claseIds = (clases || []).map((c) => c.id);
  if (claseIds.length === 0) return [];

  const { data: dictados, error: e3 } = await supabase.from("planeacion_dictados").select("*").in("clase_id", claseIds).neq("estado", "dictada");
  if (e3) throw e3;

  const claseTitulo = {};
  (clases || []).forEach((c) => { claseTitulo[c.id] = c.titulo; });
  return (dictados || []).map((d) => ({ ...d, clase_titulo: claseTitulo[d.clase_id] || "Clase" }));
}

// Ajusta las monedas de un estudiante directamente (sumar o restar), sin pasar
// por una acción de XP — usado por la Ruleta de Monedas y el Banco.
export async function ajustarMonedas(estudianteId, delta) {
  const { data, error } = await supabase.rpc("ajustar_progreso", { p_estudiante_id: estudianteId, p_delta_monedas: delta });
  if (error) throw error;
  return data?.[0]?.monedas ?? 0;
}

export async function ajustarMonedasMasivo(estudianteIds, delta) {
  const resultados = {};
  await Promise.all(estudianteIds.map(async (id) => { resultados[id] = await ajustarMonedas(id, delta); }));
  return resultados;
}

// Deja registro de un punto bueno/malo (XP, monedas o vida) dado en clase,
// con motivo — para que el estudiante después pueda ver por qué se lo
// dieron o se lo quitaron. Se llama por separado de ajustar* (que solo
// mueve el total), así las compras/canjes normales no ensucian este
// historial pedagógico.
export async function registrarHistorialPunto(estudianteId, tipo, delta, motivo) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("historial_puntos").insert({
    estudiante_id: estudianteId, tipo, delta, motivo: motivo || null, docente_id: userData?.user?.id || null,
  });
  if (error) throw error;
}

export async function registrarHistorialPuntoMasivo(estudianteIds, tipo, delta, motivo) {
  const { data: userData } = await supabase.auth.getUser();
  const filas = estudianteIds.map((id) => ({ estudiante_id: id, tipo, delta, motivo: motivo || null, docente_id: userData?.user?.id || null }));
  const { error } = await supabase.from("historial_puntos").insert(filas);
  if (error) throw error;
}

export async function fetchHistorialPuntos(estudianteId) {
  const { data, error } = await supabase.from("historial_puntos").select("*").eq("estudiante_id", estudianteId).order("creado_en", { ascending: false });
  if (error) throw error;
  return data || [];
}

/* ---------------- Banco de premios ---------------- */
// Niveles de XP (Novato/Aprendiz/etc.) — editable por docente, se siembra
// con los mismos valores de fábrica la primera vez.
const NIVELES_DEFAULT = [
  { nombre: "Novato", xp_minimo: 0 }, { nombre: "Aprendiz", xp_minimo: 150 }, { nombre: "Experto", xp_minimo: 400 },
  { nombre: "Maestro", xp_minimo: 800 }, { nombre: "Sabio", xp_minimo: 1400 }, { nombre: "Leyenda", xp_minimo: 2200 },
];

export async function fetchNivelesConfig() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NIVELES_DEFAULT.map((n) => ({ name: n.nombre, min: n.xp_minimo }));
  let { data, error } = await supabase.from("niveles_config").select("*").eq("docente_id", userData.user.id).order("orden");
  if (error) throw error;
  if (!data || data.length === 0) {
    const filas = NIVELES_DEFAULT.map((n, i) => ({ docente_id: userData.user.id, nombre: n.nombre, xp_minimo: n.xp_minimo, orden: i }));
    const { data: sembrados, error: e2 } = await supabase.from("niveles_config").insert(filas).select();
    if (e2) throw e2;
    data = sembrados;
  }
  return data;
}

// Traduce las filas de la base (nombre/xp_minimo) al formato {name, min}
// que usa nextLevel() — pensada para el lado del ESTUDIANTE, que no tiene
// sesión de Supabase Auth (entra con código), así que lee sin filtrar por
// docente_id. Si todavía no hay nada configurado, cae a los valores de fábrica.
export async function fetchNivelesParaJuego() {
  const { data, error } = await supabase.from("niveles_config").select("*").order("xp_minimo");
  if (error) throw error;
  if (!data || data.length === 0) return NIVELES_DEFAULT.map((n) => ({ name: n.nombre, min: n.xp_minimo }));
  return data.map((n) => ({ name: n.nombre, min: n.xp_minimo }));
}

export async function crearNivelConfig(nombre, xpMinimo) {
  const { data: userData } = await supabase.auth.getUser();
  const existentes = await fetchNivelesConfig();
  const { error } = await supabase.from("niveles_config").insert({ docente_id: userData?.user?.id, nombre, xp_minimo: xpMinimo, orden: existentes.length });
  if (error) throw error;
}

export async function editarNivelConfig(id, campos) {
  const { error } = await supabase.from("niveles_config").update(campos).eq("id", id);
  if (error) throw error;
}

export async function eliminarNivelConfig(id) {
  const { error } = await supabase.from("niveles_config").delete().eq("id", id);
  if (error) throw error;
}

export async function restablecerNivelesConfig() {
  const { data: userData } = await supabase.auth.getUser();
  const docenteId = userData?.user?.id || null;
  await supabase.from("niveles_config").delete().eq("docente_id", docenteId);
  const filas = NIVELES_DEFAULT.map((n, i) => ({ docente_id: docenteId, nombre: n.nombre, xp_minimo: n.xp_minimo, orden: i }));
  const { error } = await supabase.from("niveles_config").insert(filas);
  if (error) throw error;
}

/* ---------------- Objetos (inventario con efecto real) ---------------- */
const OBJETOS_DEFAULT = [
  { nombre: "Sangre", emoji: "🩸", descripcion: "Un poco de vitalidad — restaura algo de vida.", tipo: "consumible", efecto_vida: 5, costo_monedas: 8, comprable: true },
  { nombre: "Poción de sangre", emoji: "🧪", descripcion: "Una poción concentrada — restaura bastante vida.", tipo: "consumible", efecto_vida: 15, costo_monedas: 20, comprable: true },
  { nombre: "Poción de sangre mayor", emoji: "⚗️", descripcion: "La versión más fuerte — restaura mucha vida.", tipo: "consumible", efecto_vida: 30, costo_monedas: 40, comprable: true },
  { nombre: "Llave", emoji: "🗝️", descripcion: "Un objeto misterioso para coleccionar.", tipo: "coleccionable", efecto_vida: 0, costo_monedas: 15, comprable: true },
];

export async function fetchObjetosCatalogo() {
  let { data, error } = await supabase.from("objetos_catalogo").select("*").order("orden");
  if (error) throw error;
  if (!data || data.length === 0) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return OBJETOS_DEFAULT.map((o, i) => ({ id: `default-${i}`, ...o }));
    const filas = OBJETOS_DEFAULT.map((o, i) => ({ docente_id: userData.user.id, ...o, orden: i }));
    const { data: sembrados, error: e2 } = await supabase.from("objetos_catalogo").insert(filas).select();
    if (e2) throw e2;
    data = sembrados;
  }
  return data;
}

export async function crearObjeto(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("objetos_catalogo").insert({ ...campos, docente_id: userData?.user?.id || null });
  if (error) throw error;
}

export async function editarObjeto(id, campos) {
  const { error } = await supabase.from("objetos_catalogo").update(campos).eq("id", id);
  if (error) throw error;
}

export async function eliminarObjeto(id) {
  const { error } = await supabase.from("objetos_catalogo").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchInventarioEstudiante(estudianteId) {
  const { data, error } = await supabase.from("estudiante_objetos").select("*, objetos_catalogo(*)").eq("estudiante_id", estudianteId).gt("cantidad", 0);
  if (error) throw error;
  return data || [];
}

async function ajustarInventario(estudianteId, objetoId, delta) {
  const { data: existente } = await supabase.from("estudiante_objetos").select("*").eq("estudiante_id", estudianteId).eq("objeto_id", objetoId).maybeSingle();
  const cantidadNueva = Math.max(0, (existente?.cantidad || 0) + delta);
  const { error } = await supabase.from("estudiante_objetos").upsert(
    { estudiante_id: estudianteId, objeto_id: objetoId, cantidad: cantidadNueva },
    { onConflict: "estudiante_id,objeto_id" }
  );
  if (error) throw error;
  return cantidadNueva;
}

// El estudiante compra un objeto de la tienda con sus propias monedas.
export async function comprarObjeto(estudianteId, objetoId, costo, monedasActuales) {
  if (monedasActuales < costo) throw new Error("No tenés suficientes monedas para esto.");
  await ajustarMonedas(estudianteId, -costo);
  await ajustarInventario(estudianteId, objetoId, 1);
}

// El docente le da un objeto a un estudiante (o a varios) como recompensa —
// no descuenta monedas.
export async function darObjetoEstudiante(estudianteId, objetoId, nombreObjeto, cantidad = 1) {
  await ajustarInventario(estudianteId, objetoId, cantidad);
  await registrarHistorialGamificacion(estudianteId, { etiqueta: `🎁 Recibiste: ${nombreObjeto}`, categoria: "objeto" });
}

export async function darObjetoMasivo(estudianteIds, objetoId, nombreObjeto, cantidad = 1) {
  await Promise.all(estudianteIds.map((id) => darObjetoEstudiante(id, objetoId, nombreObjeto, cantidad)));
}

// El estudiante usa un objeto de su inventario: descuenta 1 unidad y, si
// tiene efecto_vida, se lo aplica.
export async function usarObjeto(estudianteId, objetoId, efectoVida, nombreObjeto) {
  const nuevaCantidad = await ajustarInventario(estudianteId, objetoId, -1);
  if (nuevaCantidad < 0) throw new Error("Ya no tenés unidades de este objeto.");
  if (efectoVida) {
    await ajustarVida(estudianteId, efectoVida);
    await registrarHistorialGamificacion(estudianteId, { etiqueta: `Usaste: ${nombreObjeto}`, vida: efectoVida, categoria: "objeto" });
  }
  return nuevaCantidad;
}

/* ---------------- Actividades Programadas (recompensa automática, con duplicado a varios cursos) ---------------- */
export async function fetchActividadesProgramadas() {
  const { data, error } = await supabase.from("actividades_programadas")
    .select("*, materias(nombre), actividades_programadas_cursos(*, notas_actividades(nombre))")
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Crea la actividad programada y la vincula de una a los cursos elegidos —
// "cursos" es un array de { grado_id, actividad_notas_id (o null) }.
export async function crearActividadProgramada(campos, cursos) {
  const { data: userData } = await supabase.auth.getUser();
  const { data: creada, error } = await supabase.from("actividades_programadas")
    .insert({ ...campos, docente_id: userData?.user?.id || null }).select().single();
  if (error) throw error;
  if (cursos.length > 0) {
    const filas = cursos.map((c) => ({ actividad_programada_id: creada.id, grado_id: c.grado_id, actividad_notas_id: c.actividad_notas_id || null }));
    const { error: e2 } = await supabase.from("actividades_programadas_cursos").insert(filas);
    if (e2) throw e2;
  }
  return creada;
}

export async function editarActividadProgramada(id, campos) {
  const { error } = await supabase.from("actividades_programadas").update(campos).eq("id", id);
  if (error) throw error;
}

// Reemplaza por completo la lista de cursos duplicados de una actividad
// programada (borra los que ya no estén, agrega los nuevos).
export async function actualizarCursosActividadProgramada(actividadProgramadaId, cursos) {
  await supabase.from("actividades_programadas_cursos").delete().eq("actividad_programada_id", actividadProgramadaId);
  if (cursos.length > 0) {
    const filas = cursos.map((c) => ({ actividad_programada_id: actividadProgramadaId, grado_id: c.grado_id, actividad_notas_id: c.actividad_notas_id || null }));
    const { error } = await supabase.from("actividades_programadas_cursos").insert(filas);
    if (error) throw error;
  }
}

export async function eliminarActividadProgramada(id) {
  const { error } = await supabase.from("actividades_programadas").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchPremios() {
  const { data, error } = await supabase.from("banco_premios").select("*").order("costo_monedas");
  if (error) throw error;
  return data || [];
}

export async function fetchPremiosActivos() {
  const { data, error } = await supabase.from("banco_premios").select("*").eq("activo", true).order("costo_monedas");
  if (error) throw error;
  return (data || []).filter((p) => p.stock === null || p.stock > 0);
}

export async function crearPremio(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("banco_premios").insert({ ...campos, docente_id: userData?.user?.id || null });
  if (error) throw error;
}

export async function editarPremio(id, cambios) {
  const { error } = await supabase.from("banco_premios").update(cambios).eq("id", id);
  if (error) throw error;
}

export async function eliminarPremio(id) {
  const { error } = await supabase.from("banco_premios").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchCanjes() {
  const [canjesRes, premiosRes, estudiantesRes] = await Promise.all([
    supabase.from("banco_canjes").select("*").order("fecha", { ascending: false }),
    supabase.from("banco_premios").select("id, nombre, emoji"),
    supabase.from("estudiantes").select("id, nombre, grado_id"),
  ]);
  if (canjesRes.error) throw canjesRes.error;
  if (premiosRes.error) throw premiosRes.error;
  if (estudiantesRes.error) throw estudiantesRes.error;
  const premioPorId = {}; (premiosRes.data || []).forEach((p) => { premioPorId[p.id] = p; });
  const estudiantePorId = {}; (estudiantesRes.data || []).forEach((e) => { estudiantePorId[e.id] = e; });
  return (canjesRes.data || []).map((c) => ({ ...c, premio: premioPorId[c.premio_id], estudiante: estudiantePorId[c.estudiante_id] }));
}

export async function marcarCanjeEntregado(id) {
  const { error } = await supabase.from("banco_canjes").update({ estado: "entregado" }).eq("id", id);
  if (error) throw error;
}

// El estudiante gasta monedas por un premio SORPRESA: se sortea entre los
// premios activos que pueda pagar y que tengan stock, con más chance los que
// tengan mayor "peso". Devuelve el premio que le tocó, o null si no alcanza
// para ninguno.
export async function canjearAleatorio(estudianteId) {
  const { data: prog } = await supabase.from("progreso").select("monedas").eq("estudiante_id", estudianteId).maybeSingle();
  const monedas = prog?.monedas || 0;

  const disponibles = (await fetchPremiosActivos()).filter((p) => p.costo_monedas <= monedas);
  if (disponibles.length === 0) return { ok: false, monedas };

  const pesoTotal = disponibles.reduce((a, p) => a + p.peso, 0);
  let r = Math.random() * pesoTotal;
  let elegido = disponibles[0];
  for (const p of disponibles) {
    if (r < p.peso) { elegido = p; break; }
    r -= p.peso;
  }

  const nuevasMonedas = await ajustarMonedas(estudianteId, -elegido.costo_monedas);
  if (elegido.stock !== null) {
    await editarPremio(elegido.id, { stock: Math.max(0, elegido.stock - 1) });
  }
  const { error } = await supabase.from("banco_canjes").insert({ premio_id: elegido.id, estudiante_id: estudianteId, costo_pagado: elegido.costo_monedas });
  if (error) throw error;

  return { ok: true, premio: elegido, monedasRestantes: nuevasMonedas };
}

export async function fetchRankingGrado(gradoId) {
  const { data, error } = await supabase
    .from("estudiantes")
    .select("id, nombre, reino_actual, reino_original, progreso(xp)")
    .eq("grado_id", gradoId).eq("activo", true);
  if (error) throw error;
  return (data || [])
    .map((s) => ({ id: s.id, nombre: s.nombre, reino: s.reino_actual || s.reino_original || "Sin grupo", xp: s.progreso?.[0]?.xp || s.progreso?.xp || 0 }))
    .sort((a, b) => b.xp - a.xp);
}

/* ---------------- Proyectos y Forja (tareas calificables con envío automático a Calificaciones) ---------------- */
export async function fetchTareasCalificables(materiaId, gradoId, periodo, tipo) {
  let query = supabase.from("tareas_calificables").select("*").eq("materia_id", materiaId).eq("grado_id", gradoId).eq("periodo", periodo);
  if (tipo) query = query.eq("tipo", tipo);
  const { data, error } = await query.order("creado_en", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function crearTareaCalificable(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("tareas_calificables").insert({ ...campos, docente_id: userData?.user?.id || null }).select().single();
  if (error) throw error;
  return data;
}

// Copia un proyecto/forja a otro curso (y opcionalmente otra materia/periodo),
// como una tarea nueva sin entregas ni calificaciones — para no mezclar
// el progreso de un curso con el de otro.
export async function copiarTareaCalificable(tareaId, materiaDestinoId, gradoDestinoId, periodoDestino, categoriaDestinoId) {
  const { data: original, error: e1 } = await supabase.from("tareas_calificables").select("*").eq("id", tareaId).single();
  if (e1) throw e1;
  return crearTareaCalificable({
    tipo: original.tipo, materia_id: materiaDestinoId, grado_id: gradoDestinoId, periodo: periodoDestino,
    categoria_id: categoriaDestinoId, titulo: original.titulo, descripcion: original.descripcion,
    fecha_entrega: null, url: original.url || null,
  });
}

// Copia TODA la estructura de columnas de la Planilla (Misiones + Proyectos +
// Forja + columnas manuales) de un curso a otro, de una sola vez — sin fecha
// de entrega ni notas de estudiantes, para que el docente las ajuste antes de usarlas.
export async function copiarPlanillaCompleta(materiaId, gradoOrigen, gradoDestino, periodo) {
  const [evaluaciones, tareas, actividades] = await Promise.all([
    fetchEvaluaciones(materiaId, gradoOrigen, periodo),
    fetchTareasCalificables(materiaId, gradoOrigen, periodo),
    fetchActividades(materiaId, gradoOrigen, periodo),
  ]);

  let evaluacionesCopiadas = 0;
  let tareasCopiadas = 0;
  let actividadesCopiadas = 0;
  const advertencias = [];

  for (const ev of evaluaciones) {
    try {
      await copiarEvaluacion(ev.id, materiaId, gradoDestino, periodo);
      evaluacionesCopiadas++;
    } catch (e) {
      advertencias.push(`Misión "${ev.titulo}": ${e.message}`);
    }
  }

  for (const t of tareas) {
    try {
      await copiarTareaCalificable(t.id, materiaId, gradoDestino, periodo, t.categoria_id);
      tareasCopiadas++;
    } catch (e) {
      advertencias.push(`${t.tipo === "proyecto" ? "Proyecto" : "Forja"} "${t.titulo}": ${e.message}`);
    }
  }

  for (const a of actividades) {
    try {
      await crearActividad({ nombre: a.nombre, descripcion: a.descripcion || null, categoria_id: a.categoria_id, materia_id: materiaId, grado_id: gradoDestino, periodo });
      actividadesCopiadas++;
    } catch (e) {
      advertencias.push(`Columna "${a.nombre}": ${e.message}`);
    }
  }

  return {
    evaluacionesCopiadas, tareasCopiadas, actividadesCopiadas,
    totalOrigen: evaluaciones.length + tareas.length + actividades.length,
    advertencias,
  };
}

export async function editarTareaCalificable(id, cambios) {
  const { error } = await supabase.from("tareas_calificables").update(cambios).eq("id", id);
  if (error) throw error;
}

export async function guardarRubricaTareaCalificable(tareaId, criterios) {
  const { error } = await supabase.from("tareas_calificables").update({ rubrica: criterios }).eq("id", tareaId);
  if (error) throw error;
}

export async function eliminarTareaCalificable(id) {
  const { error } = await supabase.from("tareas_calificables").delete().eq("id", id);
  if (error) throw error;
}

// Da la recompensa en monedas de una tarea a un estudiante puntual — protegido
// para que, si volvés a tocar el botón (o re-calificás), no se dupliquen.
export async function darMonedasPorTarea(tareaId, estudianteId, monedas) {
  const { data: entrega } = await supabase.from("tarea_entregas").select("monedas_entregadas").eq("tarea_id", tareaId).eq("estudiante_id", estudianteId).maybeSingle();
  if (entrega?.monedas_entregadas) return { yaEntregadas: true };
  await ajustarMonedas(estudianteId, monedas);
  await supabase.from("tarea_entregas").update({ monedas_entregadas: true }).eq("tarea_id", tareaId).eq("estudiante_id", estudianteId);
  return { yaEntregadas: false };
}

export async function fetchEntregasDeTarea(tareaId) {
  const [entregasRes, estudiantesRes] = await Promise.all([
    supabase.from("tarea_entregas").select("*").eq("tarea_id", tareaId),
    supabase.from("estudiantes").select("id, nombre"),
  ]);
  if (entregasRes.error) throw entregasRes.error;
  if (estudiantesRes.error) throw estudiantesRes.error;
  const nombrePorId = {}; (estudiantesRes.data || []).forEach((e) => { nombrePorId[e.id] = e.nombre; });
  return (entregasRes.data || []).map((e) => ({ ...e, estudiante_nombre: nombrePorId[e.estudiante_id] || `Estudiante ${e.estudiante_id}` }));
}

// Califica la entrega de un estudiante Y manda esa nota directo a la Planilla
// de Calificaciones (crea o reutiliza la columna/actividad correspondiente).
export async function calificarTarea(tarea, estudianteId, nota, comentario, rubricaResultado) {
  const { error: e1 } = await supabase.from("tarea_entregas").upsert(
    { tarea_id: tarea.id, estudiante_id: estudianteId, estado: "calificado", nota, comentario: comentario || null, rubrica_resultado: rubricaResultado || null, fecha_calificacion: new Date().toISOString() },
    { onConflict: "tarea_id,estudiante_id" }
  );
  if (e1) throw e1;

  if (tarea.categoria_id) {
    const existentes = await fetchActividades(tarea.materia_id, tarea.grado_id, tarea.periodo);
    let actividad = existentes.find((a) => a.nombre === tarea.titulo);
    if (!actividad) {
      actividad = await crearActividad({
        nombre: tarea.titulo, categoria_id: tarea.categoria_id, materia_id: tarea.materia_id,
        grado_id: tarea.grado_id, periodo: tarea.periodo, es_automatica: false,
      });
    }
    await setValor(actividad.id, estudianteId, nota);
  }
}

// Lado estudiante
export async function fetchTareasCalificablesEstudiante(gradoId, tipo) {
  const { data, error } = await supabase.from("tareas_calificables").select("*, materias(nombre)").eq("grado_id", gradoId).eq("tipo", tipo).order("fecha_entrega");
  if (error) throw error;
  return data || [];
}

export async function fetchMiEntrega(tareaId, estudianteId) {
  const { data, error } = await supabase.from("tarea_entregas").select("*").eq("tarea_id", tareaId).eq("estudiante_id", estudianteId).maybeSingle();
  if (error) throw error;
  return data;
}

// Tareas del banco de Planeaciones (con rúbrica) asignadas al grado del estudiante,
// para mostrarlas también dentro de "Proyectos" como referencia.
export async function fetchTareasPlaneacionParaGrado(gradoId) {
  const nivel = String(gradoId || "").slice(0, -2) || String(gradoId || "");
  const { data: unidades, error: e1 } = await supabase.from("planeaciones").select("id, titulo, materia_id, materias(nombre)")
    .or(`grado_id.eq.${gradoId},grado_id.eq.${nivel}`).eq("tipo", "unidad");
  if (e1) throw e1;
  const unidadIds = (unidades || []).map((u) => u.id);
  if (unidadIds.length === 0) return [];
  const unidadPorId = {}; (unidades || []).forEach((u) => { unidadPorId[u.id] = u; });

  const { data: clases, error: e2 } = await supabase.from("planeaciones").select("id, unidad_id").in("unidad_id", unidadIds).eq("tipo", "clase");
  if (e2) throw e2;
  const planeacionIds = [...unidadIds, ...(clases || []).map((c) => c.id)];
  const unidadDeClase = {}; (clases || []).forEach((c) => { unidadDeClase[c.id] = c.unidad_id; });

  const { data: tareas, error: e3 } = await supabase.from("planeacion_tareas").select("*").in("planeacion_id", planeacionIds);
  if (e3) throw e3;
  return (tareas || []).map((t) => {
    const unidadId = unidadDeClase[t.planeacion_id] || t.planeacion_id;
    const u = unidadPorId[unidadId];
    return { ...t, materia_nombre: u?.materias?.nombre || "", unidad_titulo: u?.titulo || "" };
  });
}

/* ---------------- Estadísticas del docente e Inicio (dashboard) ---------------- */
const NIVELES_DOCENTE = [
  { min: 0, nombre: "Aprendiz" }, { min: 100, nombre: "Docente" }, { min: 300, nombre: "Mentor" },
  { min: 600, nombre: "Maestro" }, { min: 1000, nombre: "Gran Maestro" },
];

// Para cada clase de hoy del Horario (materia + curso), busca la próxima
// "clase" pendiente de esa Unidad en Planeaciones — para poder marcarla
// (dictada/alterada/aplazada) ahí mismo, desde Inicio, sin ir a buscarla.
export async function fetchClasesPendientesDeHoy(paresHorario) {
  if (!paresHorario || paresHorario.length === 0) return {};
  const materiaIds = [...new Set(paresHorario.map((p) => p.materiaId).filter(Boolean))];
  if (materiaIds.length === 0) return {};

  const { data: unidades, error: e1 } = await supabase.from("planeaciones").select("id, materia_id, grado_id").eq("tipo", "unidad").in("materia_id", materiaIds);
  if (e1) throw e1;
  const unidadIds = (unidades || []).map((u) => u.id);
  if (unidadIds.length === 0) return {};

  const { data: clases, error: e2 } = await supabase.from("planeaciones").select("*").in("unidad_id", unidadIds).eq("tipo", "clase").order("orden");
  if (e2) throw e2;
  const claseIds = (clases || []).map((c) => c.id);

  const { data: dictados, error: e3 } = claseIds.length > 0
    ? await supabase.from("planeacion_dictados").select("*").in("clase_id", claseIds)
    : { data: [] };
  if (e3) throw e3;

  const resultado = {};
  paresHorario.forEach(({ materiaId, gradoId, horarioId }) => {
    const nivel = String(gradoId || "").slice(0, -2);
    const unidadesRelevantes = (unidades || []).filter((u) => u.materia_id === materiaId && (u.grado_id === gradoId || u.grado_id === nivel));
    const unidadIdsRelevantes = new Set(unidadesRelevantes.map((u) => u.id));
    const clasesRelevantes = (clases || []).filter((c) => unidadIdsRelevantes.has(c.unidad_id));
    const pendiente = clasesRelevantes.find((c) => {
      const d = (dictados || []).find((d) => d.clase_id === c.id && d.grado_id === gradoId);
      return !d || d.estado === "pendiente";
    });
    if (pendiente) {
      const dictadoExistente = (dictados || []).find((d) => d.clase_id === pendiente.id && d.grado_id === gradoId);
      resultado[horarioId] = { clase: pendiente, dictado: dictadoExistente || null };
    }
  });
  return resultado;
}

export async function fetchStatsDocente() {
  const { data: userData } = await supabase.auth.getUser();
  const docenteId = userData?.user?.id;
  const vacio = { xp: 0, nivel: "Aprendiz", insignias: 0, estudiantesACargo: 0 };
  if (!docenteId) return vacio;

  const contar = async (tabla, filtroExtra) => {
    let q = supabase.from(tabla).select("id", { count: "exact", head: true }).eq("docente_id", docenteId);
    if (filtroExtra) q = filtroExtra(q);
    const { count, error } = await q;
    if (error) return 0;
    return count || 0;
  };

  const [materias, unidades, evaluaciones, horario, tareas] = await Promise.all([
    contar("materias"),
    contar("planeaciones", (q) => q.eq("tipo", "unidad")),
    contar("evaluaciones"),
    contar("horario"),
    contar("tareas_calificables"),
  ]);

  const xp = materias * 20 + unidades * 15 + evaluaciones * 25 + horario * 5 + tareas * 15;
  const insignias = [materias > 0, unidades > 0, evaluaciones > 0, horario > 0, tareas > 0].filter(Boolean).length;

  let nivel = NIVELES_DOCENTE[0].nombre;
  for (const n of NIVELES_DOCENTE) if (xp >= n.min) nivel = n.nombre;

  const { count: estudiantesACargo } = await supabase.from("estudiantes").select("id", { count: "exact", head: true }).eq("activo", true);

  return { xp, nivel, insignias, estudiantesACargo: estudiantesACargo || 0 };
}

export async function fetchResumenDocente() {
  const { data: userData } = await supabase.auth.getUser();
  const docenteId = userData?.user?.id;
  if (!docenteId) return { clasesHoy: [], eventosHoy: [], evaluacionesPublicadas: 0, entregasPendientes: 0, tareasSinCalificar: 0, clasesPendientes: 0 };

  const hoy = new Date();
  const diaSemana = hoy.getDay();
  const fechaHoy = hoy.toISOString().slice(0, 10);

  const [horarioRes, cronogramaRes, evaluacionesRes, tareasRes, dictadosRes, codiceRes] = await Promise.all([
    supabase.from("horario").select("*, materias(nombre)").eq("docente_id", docenteId).eq("dia_semana", diaSemana).order("hora_inicio"),
    supabase.from("cronograma").select("*"),
    supabase.from("evaluaciones").select("id").eq("docente_id", docenteId).eq("estado", "publicada"),
    supabase.from("tareas_calificables").select("id").eq("docente_id", docenteId),
    supabase.from("planeacion_dictados").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabase.from("codice_entradas").select("id", { count: "exact", head: true }).eq("revisado", false),
  ]);

  const eventosHoy = (cronogramaRes.data || []).filter((e) => e.fecha <= fechaHoy && (!e.fecha_fin || e.fecha_fin >= fechaHoy));

  const evaluacionIds = (evaluacionesRes.data || []).map((e) => e.id);
  let entregasPendientes = 0;
  if (evaluacionIds.length > 0) {
    const { count } = await supabase.from("evaluacion_intentos").select("id", { count: "exact", head: true }).in("evaluacion_id", evaluacionIds).eq("estado", "entregado");
    entregasPendientes = count || 0;
  }

  const tareaIds = (tareasRes.data || []).map((t) => t.id);
  let tareasSinCalificar = 0;
  if (tareaIds.length > 0) {
    const { count } = await supabase.from("tarea_entregas").select("id", { count: "exact", head: true }).in("tarea_id", tareaIds).is("nota", null);
    tareasSinCalificar = count || 0;
  }

  return {
    clasesHoy: horarioRes.data || [],
    eventosHoy,
    evaluacionesPublicadas: evaluacionIds.length,
    entregasPendientes,
    tareasSinCalificar,
    clasesPendientes: dictadosRes.count || 0,
    codiceSinRevisar: codiceRes.count || 0,
  };
}

/* ---------------- PIAR completo ---------------- */
export async function fetchPiarFormularios(estudianteId) {
  const { data, error } = await supabase.from("piar_formularios").select("*").eq("estudiante_id", estudianteId).order("creado_en", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function crearPiarFormulario(estudianteId, campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("piar_formularios").insert({ estudiante_id: estudianteId, ...campos, diligenciado_por: userData?.user?.id || null }).select().single();
  if (error) throw error;
  return data;
}

export async function editarPiarFormulario(id, campos) {
  const { error } = await supabase.from("piar_formularios").update(campos).eq("id", id);
  if (error) throw error;
}

export async function eliminarPiarFormulario(id) {
  const { error } = await supabase.from("piar_formularios").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchPiarDatosSensibles(formularioId) {
  const { data, error } = await supabase.from("piar_datos_sensibles").select("*").eq("piar_formulario_id", formularioId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function guardarPiarDatosSensibles(formularioId, campos) {
  const { error } = await supabase.from("piar_datos_sensibles").upsert(
    { piar_formulario_id: formularioId, ...campos },
    { onConflict: "piar_formulario_id" }
  );
  if (error) throw error;
}

export async function fetchPiarAjustes(formularioId) {
  const { data, error } = await supabase.from("piar_ajustes").select("*").eq("piar_formulario_id", formularioId).order("creado_en");
  if (error) throw error;
  return data || [];
}

export async function crearPiarAjuste(formularioId, campos) {
  const { data, error } = await supabase.from("piar_ajustes").insert({ piar_formulario_id: formularioId, ...campos }).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarPiarAjuste(id) {
  const { error } = await supabase.from("piar_ajustes").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchPiarSeguimiento(ajusteId) {
  const [segRes, profesoresRes] = await Promise.all([
    supabase.from("piar_seguimiento").select("*").eq("piar_ajuste_id", ajusteId).order("fecha", { ascending: false }),
    supabase.from("profesores").select("id, nombre"),
  ]);
  if (segRes.error) throw segRes.error;
  if (profesoresRes.error) throw profesoresRes.error;
  const nombrePorId = {}; (profesoresRes.data || []).forEach((p) => { nombrePorId[p.id] = p.nombre; });
  return (segRes.data || []).map((s) => ({ ...s, autor_nombre: nombrePorId[s.autor_id] || "Docente" }));
}

export async function crearPiarSeguimiento(ajusteId, campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("piar_seguimiento").insert({ piar_ajuste_id: ajusteId, autor_id: userData?.user?.id || null, ...campos });
  if (error) throw error;
}

export async function eliminarPiarSeguimiento(id) {
  const { error } = await supabase.from("piar_seguimiento").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- Álbum de criaturas (sobres comprados con monedas) ---------------- */
export async function fetchCriaturas() {
  const { data, error } = await supabase.from("criaturas").select("*").order("rareza").order("nombre");
  if (error) throw error;
  return data || [];
}

export async function fetchCriaturasActivas() {
  const { data, error } = await supabase.from("criaturas").select("*").eq("activo", true);
  if (error) throw error;
  return data || [];
}

export async function crearCriatura(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("criaturas").insert({ ...campos, docente_id: userData?.user?.id || null });
  if (error) throw error;
}

export async function editarCriatura(id, cambios) {
  const { error } = await supabase.from("criaturas").update(cambios).eq("id", id);
  if (error) throw error;
}

export async function eliminarCriatura(id) {
  const { error } = await supabase.from("criaturas").delete().eq("id", id);
  if (error) throw error;
}

// Agrupa las criaturas por nombre (sin importar mayúsculas/espacios) y devuelve
// solo los grupos que tienen más de una — para poder limpiarlos.
export async function fetchCriaturasDuplicadas() {
  const [criaturasRes, coleccionesRes] = await Promise.all([
    supabase.from("criaturas").select("*"),
    supabase.from("estudiante_criaturas").select("criatura_id, cantidad"),
  ]);
  if (criaturasRes.error) throw criaturasRes.error;
  if (coleccionesRes.error) throw coleccionesRes.error;

  const totalPorCriatura = {};
  (coleccionesRes.data || []).forEach((c) => {
    totalPorCriatura[c.criatura_id] = (totalPorCriatura[c.criatura_id] || 0) + c.cantidad;
  });

  const grupos = {};
  (criaturasRes.data || []).forEach((c) => {
    const clave = c.nombre.trim().toLowerCase();
    grupos[clave] = grupos[clave] || [];
    grupos[clave].push({ ...c, total_coleccionado: totalPorCriatura[c.id] || 0 });
  });

  return Object.values(grupos).filter((g) => g.length > 1);
}

// Fusiona duplicados: se queda con "idAConservar" y transfiere las colecciones
// de los estudiantes que tenían las otras (sumando cantidades), antes de
// borrarlas — así ningún estudiante pierde lo que ya coleccionó.
export async function fusionarCriaturasDuplicadas(idAConservar, idsAEliminar) {
  for (const idEliminar of idsAEliminar) {
    const { data: colecciones } = await supabase.from("estudiante_criaturas").select("*").eq("criatura_id", idEliminar);
    for (const col of colecciones || []) {
      const { data: existente } = await supabase.from("estudiante_criaturas").select("*").eq("estudiante_id", col.estudiante_id).eq("criatura_id", idAConservar).maybeSingle();
      if (existente) {
        await supabase.from("estudiante_criaturas").update({ cantidad: existente.cantidad + col.cantidad }).eq("id", existente.id);
      } else {
        await supabase.from("estudiante_criaturas").insert({ estudiante_id: col.estudiante_id, criatura_id: idAConservar, cantidad: col.cantidad });
      }
    }
    await supabase.from("criaturas").delete().eq("id", idEliminar);
  }
}

// Limpia TODOS los grupos de duplicados de una sola vez — en cada grupo se
// queda automáticamente con la versión que más estudiantes tengan coleccionada
// (para perder lo menos posible), y fusiona el resto.
export async function limpiarTodosLosDuplicadosCriaturas() {
  const grupos = await fetchCriaturasDuplicadas();
  let totalFusionadas = 0;
  for (const grupo of grupos) {
    const conservar = [...grupo].sort((a, b) => b.total_coleccionado - a.total_coleccionado || a.id - b.id)[0];
    const idsAEliminar = grupo.filter((c) => c.id !== conservar.id).map((c) => c.id);
    await fusionarCriaturasDuplicadas(conservar.id, idsAEliminar);
    totalFusionadas += idsAEliminar.length;
  }
  return { grupos: grupos.length, fusionadas: totalFusionadas };
}

export async function fetchAlbumConfig() {
  const { data, error } = await supabase.from("album_config").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  return data || { id: 1, costo_sobre: 15, cartas_por_sobre: 3, nombre_album: "Álbum de Criaturas del Códice" };
}

export async function guardarAlbumConfig(campos) {
  const { error } = await supabase.from("album_config").upsert({ id: 1, ...campos }, { onConflict: "id" });
  if (error) throw error;
}

export async function fetchColeccion(estudianteId) {
  const { data, error } = await supabase.from("estudiante_criaturas").select("*, criaturas(*)").eq("estudiante_id", estudianteId);
  if (error) throw error;
  return data || [];
}

// Abre un sobre: descuenta las monedas, sortea N criaturas (con peso por rareza)
// entre las activas, y las suma a la colección del estudiante (o le aumenta la
// cantidad si ya la tenía). Devuelve las cartas que salieron en ese sobre.
export async function abrirSobre(estudianteId) {
  const config = await fetchAlbumConfig();
  const { data: prog } = await supabase.from("progreso").select("monedas").eq("estudiante_id", estudianteId).maybeSingle();
  const monedas = prog?.monedas || 0;
  if (monedas < config.costo_sobre) return { ok: false, monedas, costo: config.costo_sobre };

  const catalogo = await fetchCriaturasActivas();
  if (catalogo.length === 0) return { ok: false, sinCatalogo: true };

  // Prioriza criaturas que el estudiante todavía no tiene. Solo repite (y
  // solo dentro del mismo sobre) si ya no queda ninguna nueva por sortear.
  const { data: coleccionActual } = await supabase.from("estudiante_criaturas").select("criatura_id").eq("estudiante_id", estudianteId);
  const idsExcluidos = new Set((coleccionActual || []).map((c) => c.criatura_id));

  const sortear = () => {
    const disponibles = catalogo.filter((c) => !idsExcluidos.has(c.id));
    const pool = disponibles.length > 0 ? disponibles : catalogo; // ya tiene/sacó todo — recién ahí permite repetidas
    const pesoTotal = pool.reduce((a, c) => a + c.peso, 0);
    let r = Math.random() * pesoTotal;
    for (const c of pool) { if (r < c.peso) return c; r -= c.peso; }
    return pool[0];
  };

  const cartas = [];
  for (let i = 0; i < config.cartas_por_sobre; i++) {
    const carta = sortear();
    cartas.push(carta);
    idsExcluidos.add(carta.id); // no repetir la misma carta nueva dos veces dentro de este mismo sobre
  }

  const nuevasMonedas = await ajustarMonedas(estudianteId, -config.costo_sobre);

  for (const carta of cartas) {
    const { data: existente } = await supabase.from("estudiante_criaturas").select("*").eq("estudiante_id", estudianteId).eq("criatura_id", carta.id).maybeSingle();
    if (existente) {
      await supabase.from("estudiante_criaturas").update({ cantidad: existente.cantidad + 1 }).eq("id", existente.id);
    } else {
      await supabase.from("estudiante_criaturas").insert({ estudiante_id: estudianteId, criatura_id: carta.id, cantidad: 1 });
    }
  }

  return { ok: true, cartas, monedasRestantes: nuevasMonedas };
}

/* ---------------- Códice personal (diario de reflexiones del estudiante) ---------------- */
export async function fetchEntradasCodice(estudianteId) {
  const [entradasRes, materiasRes, tareasRes] = await Promise.all([
    supabase.from("codice_entradas").select("*").eq("estudiante_id", estudianteId).order("fecha", { ascending: false }),
    supabase.from("materias").select("id, nombre"),
    supabase.from("tareas_calificables").select("id, titulo"),
  ]);
  if (entradasRes.error) throw entradasRes.error;
  if (materiasRes.error) throw materiasRes.error;
  const nombrePorId = {}; (materiasRes.data || []).forEach((m) => { nombrePorId[m.id] = m.nombre; });
  const tareaPorId = {}; (tareasRes.data || []).forEach((t) => { tareaPorId[t.id] = t.titulo; });
  return (entradasRes.data || []).map((e) => ({ ...e, materia_nombre: e.materia_id ? nombrePorId[e.materia_id] : null, tarea_titulo: e.tarea_id ? tareaPorId[e.tarea_id] : null }));
}

export async function crearEntradaCodice(estudianteId, campos) {
  const { data, error } = await supabase.from("codice_entradas").insert({ estudiante_id: estudianteId, ...campos }).select().single();
  if (error) throw error;
  return data;
}

// El docente deja una entrada directo en el Códice del estudiante (distinto
// de comentar una entrada ya escrita por el estudiante) — opcionalmente
// vinculada a un Proyecto/Forja puntual.
export async function crearEntradaCodiceDocente(estudianteId, campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("codice_entradas").insert({ estudiante_id: estudianteId, autor_docente_id: userData?.user?.id || null, ...campos }).select().single();
  if (error) throw error;
  return data;
}

export async function editarEntradaCodice(id, campos) {
  const { error } = await supabase.from("codice_entradas").update(campos).eq("id", id);
  if (error) throw error;
}

export async function eliminarEntradaCodice(id) {
  const { error } = await supabase.from("codice_entradas").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchComentariosCodice(entradaId) {
  const [comRes, profesoresRes] = await Promise.all([
    supabase.from("codice_comentarios").select("*").eq("entrada_id", entradaId).order("creado_en"),
    supabase.from("profesores").select("id, nombre"),
  ]);
  if (comRes.error) throw comRes.error;
  if (profesoresRes.error) throw profesoresRes.error;
  const nombrePorId = {}; (profesoresRes.data || []).forEach((p) => { nombrePorId[p.id] = p.nombre; });
  return (comRes.data || []).map((c) => ({ ...c, autor_nombre: nombrePorId[c.autor_id] || "Docente" }));
}

export async function crearComentarioCodice(entradaId, comentario) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("codice_comentarios").insert({ entrada_id: entradaId, autor_id: userData?.user?.id || null, comentario });
  if (error) throw error;
}

export async function marcarCodiceRevisado(id) {
  const { error } = await supabase.from("codice_entradas").update({ revisado: true }).eq("id", id);
  if (error) throw error;
}

// Todas las entradas de Códice de todos los estudiantes que el docente todavía
// no revisó, con el nombre del estudiante/grado/materia ya resueltos.
export async function fetchEntradasCodiceSinRevisar() {
  const [entradasRes, estudiantesRes, materiasRes] = await Promise.all([
    supabase.from("codice_entradas").select("*").eq("revisado", false).order("creado_en", { ascending: false }),
    supabase.from("estudiantes").select("id, nombre, grado_id"),
    supabase.from("materias").select("id, nombre"),
  ]);
  if (entradasRes.error) throw entradasRes.error;
  if (estudiantesRes.error) throw estudiantesRes.error;
  if (materiasRes.error) throw materiasRes.error;
  const estPorId = {}; (estudiantesRes.data || []).forEach((e) => { estPorId[e.id] = e; });
  const matPorId = {}; (materiasRes.data || []).forEach((m) => { matPorId[m.id] = m.nombre; });
  return (entradasRes.data || []).map((e) => ({
    ...e,
    estudiante_nombre: estPorId[e.estudiante_id]?.nombre || "Estudiante",
    grado_id: estPorId[e.estudiante_id]?.grado_id,
    materia_nombre: e.materia_id ? matPorId[e.materia_id] : null,
  }));
}

// Le pone nota a una entrada del Códice. Si la entrada tiene materia y se le
// pasa categoría+periodo, la nota también se manda a la Planilla de Calificaciones
// (columna compartida "Códice — Reflexiones" en esa categoría).
export async function calificarEntradaCodice(entrada, estudianteId, gradoId, nota, categoriaId, periodo) {
  const { error } = await supabase.from("codice_entradas").update({ nota, categoria_id: categoriaId || null, revisado: true }).eq("id", entrada.id);
  if (error) throw error;

  if (entrada.materia_id && categoriaId && periodo) {
    const existentes = await fetchActividades(entrada.materia_id, gradoId, periodo);
    let actividad = existentes.find((a) => a.nombre === "Códice — Reflexiones" && a.categoria_id === categoriaId);
    if (!actividad) {
      actividad = await crearActividad({ nombre: "Códice — Reflexiones", categoria_id: categoriaId, materia_id: entrada.materia_id, grado_id: gradoId, periodo, es_automatica: false });
    }
    await setValor(actividad.id, estudianteId, nota);
  }
}

/* ---------------- Valor de la semana ---------------- */
export async function fetchValorSemanal() {
  const { data, error } = await supabase.from("valor_semanal").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  return data || { id: 1, nombre: null, descripcion: null, imagen_url: null };
}

export async function guardarValorSemanal(campos) {
  const { error } = await supabase.from("valor_semanal").upsert({ id: 1, ...campos, actualizado_en: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw error;
}

/* ---------------- Anuncios (tablero de mensajes) ---------------- */
export async function fetchAnuncios() {
  const [anunciosRes, profesoresRes] = await Promise.all([
    supabase.from("anuncios").select("*").order("fijado", { ascending: false }).order("creado_en", { ascending: false }),
    supabase.from("profesores").select("id, nombre"),
  ]);
  if (anunciosRes.error) throw anunciosRes.error;
  if (profesoresRes.error) throw profesoresRes.error;
  const nombrePorId = {}; (profesoresRes.data || []).forEach((p) => { nombrePorId[p.id] = p.nombre; });
  return (anunciosRes.data || []).map((a) => ({ ...a, autor_nombre: nombrePorId[a.docente_id] || "Docente" }));
}

// Para el estudiante: los generales (sin grado) + los de su grado específico
export async function fetchAnunciosParaGrado(gradoId) {
  const { data, error } = await supabase.from("anuncios").select("*").order("fijado", { ascending: false }).order("creado_en", { ascending: false });
  if (error) throw error;
  return (data || []).filter((a) => !a.grado_id || String(a.grado_id) === String(gradoId));
}

export async function crearAnuncio(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("anuncios").insert({ ...campos, docente_id: userData?.user?.id || null });
  if (error) throw error;
}

export async function editarAnuncio(id, cambios) {
  const { error } = await supabase.from("anuncios").update(cambios).eq("id", id);
  if (error) throw error;
}

export async function eliminarAnuncio(id) {
  const { error } = await supabase.from("anuncios").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- Insignias / logros automáticos ---------------- */
export async function fetchLogrosCatalogo() {
  const { data, error } = await supabase.from("logros_catalogo").select("*").order("tipo").order("umbral");
  if (error) throw error;
  return data || [];
}

export async function crearLogro(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("logros_catalogo").insert({ ...campos, docente_id: userData?.user?.id || null });
  if (error) throw error;
}

export async function editarLogro(id, cambios) {
  const { error } = await supabase.from("logros_catalogo").update(cambios).eq("id", id);
  if (error) throw error;
}

export async function eliminarLogro(id) {
  const { error } = await supabase.from("logros_catalogo").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchLogrosEstudiante(estudianteId) {
  const { data, error } = await supabase.from("estudiante_logros").select("*, logros_catalogo(*)").eq("estudiante_id", estudianteId);
  if (error) throw error;
  return data || [];
}

// Agrupa el catálogo de logros por nombre y devuelve solo los grupos con más
// de uno — para poder limpiarlos, igual que ya hacemos con criaturas y cosméticos.
export async function fetchLogrosDuplicados() {
  const [catalogoRes, desbloqueadosRes] = await Promise.all([
    supabase.from("logros_catalogo").select("*"),
    supabase.from("estudiante_logros").select("logro_id"),
  ]);
  if (catalogoRes.error) throw catalogoRes.error;
  if (desbloqueadosRes.error) throw desbloqueadosRes.error;

  const totalPorLogro = {};
  (desbloqueadosRes.data || []).forEach((l) => { totalPorLogro[l.logro_id] = (totalPorLogro[l.logro_id] || 0) + 1; });

  const grupos = {};
  (catalogoRes.data || []).forEach((l) => {
    const clave = l.nombre.trim().toLowerCase();
    grupos[clave] = grupos[clave] || [];
    grupos[clave].push({ ...l, total_desbloqueado: totalPorLogro[l.id] || 0 });
  });

  return Object.values(grupos).filter((g) => g.length > 1);
}

// Fusiona duplicados de logros: se queda con "idAConservar" y transfiere
// quién ya lo tenía desbloqueado desde las otras versiones, antes de borrarlas
// — así ningún estudiante pierde una insignia que ya se ganó.
export async function fusionarLogrosDuplicados(idAConservar, idsAEliminar) {
  for (const idEliminar of idsAEliminar) {
    const { data: desbloqueos } = await supabase.from("estudiante_logros").select("*").eq("logro_id", idEliminar);
    for (const d of desbloqueos || []) {
      const { data: yaLoTiene } = await supabase.from("estudiante_logros").select("id").eq("estudiante_id", d.estudiante_id).eq("logro_id", idAConservar).maybeSingle();
      if (!yaLoTiene) {
        await supabase.from("estudiante_logros").insert({ estudiante_id: d.estudiante_id, logro_id: idAConservar, desbloqueado_en: d.desbloqueado_en });
      }
    }
    await supabase.from("logros_catalogo").delete().eq("id", idEliminar);
  }
}

// Limpia TODOS los grupos de duplicados de logros de una sola vez — se queda
// automáticamente con la versión que más estudiantes tengan desbloqueada.
export async function limpiarTodosLosDuplicadosLogros() {
  const grupos = await fetchLogrosDuplicados();
  let totalFusionadas = 0;
  for (const grupo of grupos) {
    const conservar = [...grupo].sort((a, b) => b.total_desbloqueado - a.total_desbloqueado || a.id - b.id)[0];
    const idsAEliminar = grupo.filter((l) => l.id !== conservar.id).map((l) => l.id);
    await fusionarLogrosDuplicados(conservar.id, idsAEliminar);
    totalFusionadas += idsAEliminar.length;
  }
  return { grupos: grupos.length, fusionadas: totalFusionadas };
}

// Revisa los hitos actuales del estudiante contra el catálogo activo y
// desbloquea automáticamente los que ya cumple y todavía no tenía.
// Devuelve los logros NUEVOS desbloqueados en esta pasada (para festejarlos).
export async function verificarYOtorgarLogros(estudianteId) {
  const [catalogo, yaDesbloqueados, progreso, coleccion, catalogoCriaturas, entradas, intentos, asistencia] = await Promise.all([
    fetchLogrosCatalogo(),
    supabase.from("estudiante_logros").select("logro_id").eq("estudiante_id", estudianteId).then((r) => (r.data || []).map((x) => x.logro_id)),
    supabase.from("progreso").select("xp, monedas").eq("estudiante_id", estudianteId).maybeSingle().then((r) => r.data || { xp: 0, monedas: 0 }),
    supabase.from("estudiante_criaturas").select("criatura_id").eq("estudiante_id", estudianteId).then((r) => r.data || []),
    supabase.from("criaturas").select("id").eq("activo", true).then((r) => r.data || []),
    supabase.from("codice_entradas").select("id", { count: "exact", head: true }).eq("estudiante_id", estudianteId).then((r) => r.count || 0),
    supabase.from("evaluacion_intentos").select("id", { count: "exact", head: true }).eq("estudiante_id", estudianteId).neq("estado", "en_progreso").then((r) => r.count || 0),
    supabase.from("asistencia").select("*", { count: "exact", head: true }).eq("estudiante_id", estudianteId).eq("codigo", "P").then((r) => r.count || 0),
  ]);

  const cumple = (logro) => {
    switch (logro.tipo) {
      case "nivel_xp": return progreso.xp >= logro.umbral;
      case "monedas": return progreso.monedas >= logro.umbral;
      case "coleccion_completa": return catalogoCriaturas.length > 0 && coleccion.length >= catalogoCriaturas.length;
      case "codice_entradas": return entradas >= logro.umbral;
      case "evaluaciones_completadas": return intentos >= logro.umbral;
      case "asistencia_presentes": return asistencia >= logro.umbral;
      default: return false;
    }
  };

  const nuevos = catalogo.filter((l) => l.activo && !yaDesbloqueados.includes(l.id) && cumple(l));
  for (const logro of nuevos) {
    await supabase.from("estudiante_logros").insert({ estudiante_id: estudianteId, logro_id: logro.id });
  }
  return nuevos;
}

/* ---------------- Salón de Honor (ranking institucional) ---------------- */
export async function fetchSalonDeHonor() {
  const [estudiantesRes, progresoRes, logrosRes, catalogoLogrosRes] = await Promise.all([
    supabase.from("estudiantes").select("id, nombre, grado_id").eq("activo", true),
    supabase.from("progreso").select("estudiante_id, xp"),
    supabase.from("estudiante_logros").select("*").order("desbloqueado_en", { ascending: false }).limit(20),
    supabase.from("logros_catalogo").select("id, nombre, emoji"),
  ]);
  if (estudiantesRes.error) throw estudiantesRes.error;
  if (progresoRes.error) throw progresoRes.error;
  if (logrosRes.error) throw logrosRes.error;
  if (catalogoLogrosRes.error) throw catalogoLogrosRes.error;

  const estPorId = {}; (estudiantesRes.data || []).forEach((e) => { estPorId[e.id] = e; });
  const xpPorEstudiante = {}; (progresoRes.data || []).forEach((p) => { xpPorEstudiante[p.estudiante_id] = p.xp || 0; });
  const logroPorId = {}; (catalogoLogrosRes.data || []).forEach((l) => { logroPorId[l.id] = l; });

  // Top por XP (institucional, todos los grados)
  const topXp = (estudiantesRes.data || [])
    .map((e) => ({ id: e.id, nombre: e.nombre, grado_id: e.grado_id, xp: xpPorEstudiante[e.id] || 0 }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 10);

  // Top por cantidad de insignias
  const conteoLogros = {};
  (logrosRes.data || []).forEach((l) => { conteoLogros[l.estudiante_id] = (conteoLogros[l.estudiante_id] || 0) + 1; });
  const { data: todosLosLogros } = await supabase.from("estudiante_logros").select("estudiante_id");
  const conteoTotalLogros = {};
  (todosLosLogros || []).forEach((l) => { conteoTotalLogros[l.estudiante_id] = (conteoTotalLogros[l.estudiante_id] || 0) + 1; });
  const topInsignias = Object.entries(conteoTotalLogros)
    .map(([estudianteId, cantidad]) => ({ id: parseInt(estudianteId, 10), nombre: estPorId[estudianteId]?.nombre || "Estudiante", grado_id: estPorId[estudianteId]?.grado_id, cantidad }))
    .filter((x) => x.nombre !== "Estudiante" || estPorId[x.id])
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10);

  // Muro de logros recientes (toda la institución)
  const muroReciente = (logrosRes.data || []).map((l) => ({
    ...l,
    estudiante_nombre: estPorId[l.estudiante_id]?.nombre || "Estudiante",
    grado_id: estPorId[l.estudiante_id]?.grado_id,
    logro_nombre: logroPorId[l.logro_id]?.nombre || "Logro",
    logro_emoji: logroPorId[l.logro_id]?.emoji || "🏅",
  }));

  return { topXp, topInsignias, muroReciente };
}

/* ---------------- Desafíos de equipo (Reinos) ---------------- */
export async function crearDesafioReino(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { data: desafio, error } = await supabase.from("desafios_reino").insert({ ...campos, docente_id: userData?.user?.id || null }).select().single();
  if (error) throw error;

  // Toma una "foto" del xp/monedas actual de cada estudiante del grado, para
  // medir después cuánto sumó cada uno DESDE que arrancó el desafío.
  const estudiantes = await fetchEstudiantesPorGrado(campos.grado_id);
  const { data: progresos } = await supabase.from("progreso").select("estudiante_id, xp, monedas").in("estudiante_id", estudiantes.map((e) => e.id));
  const progPorId = {}; (progresos || []).forEach((p) => { progPorId[p.estudiante_id] = p; });
  const filas = estudiantes.map((e) => ({
    desafio_id: desafio.id, estudiante_id: e.id,
    valor_inicial: campos.tipo === "monedas" ? (progPorId[e.id]?.monedas || 0) : (progPorId[e.id]?.xp || 0),
  }));
  if (filas.length > 0) await supabase.from("desafio_snapshots").insert(filas);
  return desafio;
}

export async function fetchDesafiosReino(gradoId) {
  const { data, error } = await supabase.from("desafios_reino").select("*").eq("grado_id", gradoId).order("creado_en", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function eliminarDesafioReino(id) {
  const { error } = await supabase.from("desafios_reino").delete().eq("id", id);
  if (error) throw error;
}

// Progreso actual del desafío, agrupado por reino
export async function fetchProgresoDesafio(desafio) {
  const [snapshotsRes, estudiantesRes] = await Promise.all([
    supabase.from("desafio_snapshots").select("*").eq("desafio_id", desafio.id),
    fetchEstudiantesPorGrado(desafio.grado_id),
  ]);
  if (snapshotsRes.error) throw snapshotsRes.error;
  const snapshots = snapshotsRes.data || [];
  const estudiantes = estudiantesRes || [];
  const estudianteIds = estudiantes.map((e) => e.id);
  const { data: progresos } = await supabase.from("progreso").select("estudiante_id, xp, monedas").in("estudiante_id", estudianteIds);
  const progPorId = {}; (progresos || []).forEach((p) => { progPorId[p.estudiante_id] = p; });
  const estPorId = {}; estudiantes.forEach((e) => { estPorId[e.id] = e; });

  const porReino = {};
  snapshots.forEach((s) => {
    const est = estPorId[s.estudiante_id];
    if (!est) return;
    const reino = est.reino_actual || est.reino_original || "Sin grupo";
    const actual = campos_tipo_valor(progPorId[s.estudiante_id], desafio.tipo);
    const delta = Math.max(0, actual - s.valor_inicial);
    porReino[reino] = (porReino[reino] || 0) + delta;
  });

  return Object.entries(porReino).map(([reino, total]) => ({ reino, total, pct: Math.min(100, Math.round((total / desafio.meta) * 100)) })).sort((a, b) => b.total - a.total);
}

function campos_tipo_valor(prog, tipo) {
  if (!prog) return 0;
  return tipo === "monedas" ? (prog.monedas || 0) : (prog.xp || 0);
}

/* ---------------- Misiones diarias/semanales ---------------- */
function claveDePeriodo(tipo) {
  const hoy = new Date();
  if (tipo === "diaria") return hoy.toISOString().slice(0, 10);
  // Clave de semana ISO simplificada: año + número de semana
  const inicioAno = new Date(hoy.getFullYear(), 0, 1);
  const semana = Math.ceil((((hoy - inicioAno) / 86400000) + inicioAno.getDay() + 1) / 7);
  return `${hoy.getFullYear()}-W${semana}`;
}

export async function fetchMicroMisiones() {
  const { data, error } = await supabase.from("micro_misiones").select("*").order("tipo").order("creado_en");
  if (error) throw error;
  return data || [];
}

export async function crearMicroMision(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("micro_misiones").insert({ ...campos, docente_id: userData?.user?.id || null });
  if (error) throw error;
}

export async function editarMicroMision(id, cambios) {
  const { error } = await supabase.from("micro_misiones").update(cambios).eq("id", id);
  if (error) throw error;
}

export async function eliminarMicroMision(id) {
  const { error } = await supabase.from("micro_misiones").delete().eq("id", id);
  if (error) throw error;
}

// Misiones activas + si el estudiante ya la completó en el periodo actual
export async function fetchMicroMisionesEstudiante(estudianteId) {
  const [misionesRes, completadasRes] = await Promise.all([
    supabase.from("micro_misiones").select("*").eq("activo", true),
    supabase.from("micro_mision_completadas").select("*").eq("estudiante_id", estudianteId),
  ]);
  if (misionesRes.error) throw misionesRes.error;
  if (completadasRes.error) throw completadasRes.error;
  return (misionesRes.data || []).map((m) => {
    const clave = claveDePeriodo(m.tipo);
    const completada = (completadasRes.data || []).some((c) => c.mision_id === m.id && c.periodo_clave === clave);
    return { ...m, completada };
  });
}

export async function completarMicroMision(mision, estudianteId) {
  const clave = claveDePeriodo(mision.tipo);
  const { error } = await supabase.from("micro_mision_completadas").insert({ mision_id: mision.id, estudiante_id: estudianteId, periodo_clave: clave });
  if (error) {
    if (error.code === "23505") throw new Error("Ya la completaste en este periodo.");
    throw error;
  }
  if (mision.recompensa_monedas) await ajustarMonedas(estudianteId, mision.recompensa_monedas);
  if (mision.recompensa_xp) await ajustarXp(estudianteId, mision.recompensa_xp);
}

export async function ajustarXp(estudianteId, delta) {
  const { data, error } = await supabase.rpc("ajustar_progreso", { p_estudiante_id: estudianteId, p_delta_xp: delta });
  if (error) throw error;
  return data?.[0]?.xp ?? 0;
}

export async function ajustarXpMasivo(estudianteIds, delta) {
  const resultados = {};
  await Promise.all(estudianteIds.map(async (id) => { resultados[id] = await ajustarXp(id, delta); }));
  return resultados;
}

export async function ajustarVida(estudianteId, delta) {
  const { data, error } = await supabase.rpc("ajustar_progreso", { p_estudiante_id: estudianteId, p_delta_vida: delta });
  if (error) throw error;
  return data?.[0]?.vida ?? 0;
}

export async function ajustarVidaMasivo(estudianteIds, delta) {
  const resultados = {};
  await Promise.all(estudianteIds.map(async (id) => { resultados[id] = await ajustarVida(id, delta); }));
  return resultados;
}

/* ---------------- Personalización cosmética ---------------- */
/* ---------------- Personaje (constructor de avatar por partes) ---------------- */
export async function fetchAvatarCatalogo() {
  let { data, error } = await supabase.from("avatar_catalogo").select("*").order("categoria").order("orden");
  if (error) throw error;
  if (!data || data.length === 0) {
    // Siembra el catálogo genérico de fábrica, editable después.
    const { data: userData } = await supabase.auth.getUser();
    const docenteId = userData?.user?.id || null;
    const filas = [];
    Object.entries(CATALOGO_BASE).forEach(([categoria, items]) => {
      items.forEach((it, i) => filas.push({ docente_id: docenteId, categoria, nombre: it.nombre, svg_key: it.svg_key, costo_monedas: it.costo_monedas, orden: i }));
    });
    const { data: sembrado, error: e2 } = await supabase.from("avatar_catalogo").insert(filas).select();
    if (e2) throw e2;
    data = sembrado;
  }
  return data;
}

export async function crearParteAvatar(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("avatar_catalogo").insert({ ...campos, docente_id: userData?.user?.id || null }).select().single();
  if (error) throw error;
  return data;
}

export async function editarParteAvatar(id, campos) {
  const { error } = await supabase.from("avatar_catalogo").update(campos).eq("id", id);
  if (error) throw error;
}

export async function eliminarParteAvatar(id) {
  const { error } = await supabase.from("avatar_catalogo").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchAvatarConfig(estudianteId) {
  const { data, error } = await supabase.from("estudiante_avatar_config").select("*").eq("estudiante_id", estudianteId).maybeSingle();
  if (error) throw error;
  return data || { estudiante_id: estudianteId, cuerpo_id: null, pelo_id: null, pelo_color: "brown", atuendo_id: null, atuendo_color: "blue", accesorio_id: null, nombre_personaje: null };
}

// Trae la config de varios estudiantes a la vez (Ranking / Salón de Honor),
// ya resuelta a svg_key (no ids) para pasarla directo al renderer del
// personaje — un solo viaje a la base en vez de uno por fila.
export async function fetchAvatarConfigsMultiples(estudianteIds) {
  if (!estudianteIds || estudianteIds.length === 0) return {};
  const [{ data: configs, error: e1 }, { data: catalogo, error: e2 }] = await Promise.all([
    supabase.from("estudiante_avatar_config").select("*").in("estudiante_id", estudianteIds),
    supabase.from("avatar_catalogo").select("id, svg_key"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const svgKeyDe = (id) => (catalogo || []).find((c) => c.id === id)?.svg_key;
  const resultado = {};
  (configs || []).forEach((c) => {
    resultado[c.estudiante_id] = {
      pelo_color: c.pelo_color || "brown", atuendo_color: c.atuendo_color || "blue",
      cuerpo_key: svgKeyDe(c.cuerpo_id) || "tint_1_smile",
      pelo_key: svgKeyDe(c.pelo_id) || "corto",
      atuendo_key: svgKeyDe(c.atuendo_id) || "tunica",
      accesorio_key: svgKeyDe(c.accesorio_id) || "ninguno",
      nombre_personaje: c.nombre_personaje || null,
    };
  });
  return resultado;
}

export async function guardarAvatarConfig(estudianteId, campos) {
  const { error } = await supabase.from("estudiante_avatar_config").upsert({ estudiante_id: estudianteId, ...campos }, { onConflict: "estudiante_id" });
  if (error) throw error;
}

export async function fetchAvatarDesbloqueados(estudianteId) {
  const { data, error } = await supabase.from("estudiante_avatar_desbloqueado").select("parte_id").eq("estudiante_id", estudianteId);
  if (error) throw error;
  return (data || []).map((d) => d.parte_id);
}

// Compra (descuenta monedas) y desbloquea una parte del catálogo para el
// estudiante — falla con un mensaje claro si no le alcanzan las monedas.
export async function comprarParteAvatar(estudianteId, parteId, costo, monedasActuales) {
  if (monedasActuales < costo) throw new Error("No tenés suficientes monedas para esto.");
  const { error: e1 } = await supabase.from("estudiante_avatar_desbloqueado").insert({ estudiante_id: estudianteId, parte_id: parteId });
  if (e1) throw e1;
  await ajustarMonedas(estudianteId, -costo);
}

export async function fetchCosmeticosCatalogo() {
  const { data, error } = await supabase.from("cosmeticos_catalogo").select("*").order("tipo").order("costo_monedas");
  if (error) throw error;
  return data || [];
}

export async function crearCosmetico(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("cosmeticos_catalogo").insert({ ...campos, docente_id: userData?.user?.id || null });
  if (error) throw error;
}

export async function editarCosmetico(id, cambios) {
  const { error } = await supabase.from("cosmeticos_catalogo").update(cambios).eq("id", id);
  if (error) throw error;
}

export async function eliminarCosmetico(id) {
  const { error } = await supabase.from("cosmeticos_catalogo").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchCosmeticosEstudiante(estudianteId) {
  const { data, error } = await supabase.from("estudiante_cosmeticos").select("*, cosmeticos_catalogo(*)").eq("estudiante_id", estudianteId);
  if (error) throw error;
  return data || [];
}

export async function comprarCosmetico(estudianteId, cosmetico) {
  const { data: prog } = await supabase.from("progreso").select("monedas").eq("estudiante_id", estudianteId).maybeSingle();
  if ((prog?.monedas || 0) < cosmetico.costo_monedas) throw new Error("No te alcanzan las monedas.");
  const { error } = await supabase.from("estudiante_cosmeticos").insert({ estudiante_id: estudianteId, cosmetico_id: cosmetico.id });
  if (error) { if (error.code === "23505") throw new Error("Ya lo tenés."); throw error; }
  await ajustarMonedas(estudianteId, -cosmetico.costo_monedas);
}

export async function equiparCosmetico(estudianteId, tipo, cosmeticoId) {
  const campo = tipo === "marco" ? "marco_equipado_id" : "titulo_equipado_id";
  const { data: actual } = await supabase.from("progreso").select("*").eq("estudiante_id", estudianteId).maybeSingle();
  const { error } = await supabase.from("progreso").upsert({
    estudiante_id: estudianteId, xp: actual?.xp || 0, vida: actual?.vida ?? 100, monedas: actual?.monedas || 0,
    marco_equipado_id: actual?.marco_equipado_id, titulo_equipado_id: actual?.titulo_equipado_id,
    [campo]: cosmeticoId,
  });
  if (error) throw error;
}

export async function fetchEquipadosEstudiante(estudianteId) {
  const { data, error } = await supabase.from("progreso").select("marco_equipado_id, titulo_equipado_id").eq("estudiante_id", estudianteId).maybeSingle();
  if (error) throw error;
  if (!data || (!data.marco_equipado_id && !data.titulo_equipado_id)) return { marco: null, titulo: null };
  const ids = [data.marco_equipado_id, data.titulo_equipado_id].filter(Boolean);
  const { data: cosmeticos } = await supabase.from("cosmeticos_catalogo").select("*").in("id", ids);
  const porId = {}; (cosmeticos || []).forEach((c) => { porId[c.id] = c; });
  return { marco: data.marco_equipado_id ? porId[data.marco_equipado_id] : null, titulo: data.titulo_equipado_id ? porId[data.titulo_equipado_id] : null };
}

// Agrupa cosméticos por nombre (sin importar mayúsculas/espacios) y devuelve
// solo los grupos que tienen más de uno — para poder limpiarlos.
export async function fetchCosmeticosDuplicados() {
  const [catalogoRes, poseidosRes] = await Promise.all([
    supabase.from("cosmeticos_catalogo").select("*"),
    supabase.from("estudiante_cosmeticos").select("cosmetico_id"),
  ]);
  if (catalogoRes.error) throw catalogoRes.error;
  if (poseidosRes.error) throw poseidosRes.error;

  const totalPorCosmetico = {};
  (poseidosRes.data || []).forEach((c) => { totalPorCosmetico[c.cosmetico_id] = (totalPorCosmetico[c.cosmetico_id] || 0) + 1; });

  const grupos = {};
  (catalogoRes.data || []).forEach((c) => {
    const clave = c.nombre.trim().toLowerCase();
    grupos[clave] = grupos[clave] || [];
    grupos[clave].push({ ...c, total_poseido: totalPorCosmetico[c.id] || 0 });
  });

  return Object.values(grupos).filter((g) => g.length > 1);
}

// Fusiona duplicados de cosméticos: se queda con "idAConservar" y transfiere
// quién lo tenía comprado y equipado desde las otras versiones, antes de
// borrarlas — así ningún estudiante pierde su compra ni queda con algo roto equipado.
export async function fusionarCosmeticosDuplicados(idAConservar, idsAEliminar) {
  for (const idEliminar of idsAEliminar) {
    const { data: compras } = await supabase.from("estudiante_cosmeticos").select("*").eq("cosmetico_id", idEliminar);
    for (const compra of compras || []) {
      const { data: yaLoTiene } = await supabase.from("estudiante_cosmeticos").select("id").eq("estudiante_id", compra.estudiante_id).eq("cosmetico_id", idAConservar).maybeSingle();
      if (!yaLoTiene) {
        await supabase.from("estudiante_cosmeticos").insert({ estudiante_id: compra.estudiante_id, cosmetico_id: idAConservar });
      }
    }
    // Si alguien lo tenía EQUIPADO, lo re-equipa con el que va a quedar (para que no le quede "roto")
    await supabase.from("progreso").update({ marco_equipado_id: idAConservar }).eq("marco_equipado_id", idEliminar);
    await supabase.from("progreso").update({ titulo_equipado_id: idAConservar }).eq("titulo_equipado_id", idEliminar);
    await supabase.from("cosmeticos_catalogo").delete().eq("id", idEliminar);
  }
}

// Limpia TODOS los grupos de duplicados de cosméticos de una sola vez — se
// queda automáticamente con la versión que más estudiantes tengan.
export async function limpiarTodosLosDuplicadosCosmeticos() {
  const grupos = await fetchCosmeticosDuplicados();
  let totalFusionadas = 0;
  for (const grupo of grupos) {
    const conservar = [...grupo].sort((a, b) => b.total_poseido - a.total_poseido || a.id - b.id)[0];
    const idsAEliminar = grupo.filter((c) => c.id !== conservar.id).map((c) => c.id);
    await fusionarCosmeticosDuplicados(conservar.id, idsAEliminar);
    totalFusionadas += idsAEliminar.length;
  }
  return { grupos: grupos.length, fusionadas: totalFusionadas };
}

/* ---------------- Catálogo de acciones de gamificación (editable) ---------------- */
export async function fetchAccionesGamificacion() {
  const { data, error } = await supabase.from("acciones_gamificacion").select("*").order("tab").order("id");
  if (error) throw error;
  return data || [];
}

export async function crearAccionGamificacion(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("acciones_gamificacion").insert({ ...campos, docente_id: userData?.user?.id || null });
  if (error) throw error;
}

export async function editarAccionGamificacion(id, cambios) {
  const { error } = await supabase.from("acciones_gamificacion").update(cambios).eq("id", id);
  if (error) throw error;
}

export async function eliminarAccionGamificacion(id) {
  const { error } = await supabase.from("acciones_gamificacion").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- Biblioteca (enlaces por grado completo) ---------------- */
export async function fetchBibliotecaRecursos() {
  const { data, error } = await supabase.from("biblioteca_recursos").select("*").order("nivel").order("creado_en", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Para el estudiante: solo lo de su propio grado (nivel)
export async function fetchBibliotecaPorNivel(nivel) {
  const { data, error } = await supabase.from("biblioteca_recursos").select("*").eq("nivel", nivel).order("categoria").order("creado_en", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function crearRecursoBiblioteca(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("biblioteca_recursos").insert({ ...campos, docente_id: userData?.user?.id || null });
  if (error) throw error;
}

export async function editarRecursoBiblioteca(id, cambios) {
  const { error } = await supabase.from("biblioteca_recursos").update(cambios).eq("id", id);
  if (error) throw error;
}

export async function eliminarRecursoBiblioteca(id) {
  const { error } = await supabase.from("biblioteca_recursos").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- Formato de Remisión de Estudiantes ---------------- */
export async function fetchRemisiones(estudianteId) {
  const { data, error } = await supabase.from("remisiones_estudiantes").select("*").eq("estudiante_id", estudianteId).order("fecha_remision", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function crearRemision(estudianteId, campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("remisiones_estudiantes").insert({ estudiante_id: estudianteId, docente_id: userData?.user?.id || null, ...campos }).select().single();
  if (error) throw error;
  return data;
}

export async function editarRemision(id, campos) {
  const { error } = await supabase.from("remisiones_estudiantes").update(campos).eq("id", id);
  if (error) throw error;
}

export async function eliminarRemision(id) {
  const { error } = await supabase.from("remisiones_estudiantes").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- Anotaciones privadas del docente ---------------- */
export async function fetchAnotaciones(estudianteId) {
  const { data, error } = await supabase.from("anotaciones_estudiantes").select("*").eq("estudiante_id", estudianteId).order("fecha", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function crearAnotacion(estudianteId, campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("anotaciones_estudiantes").insert({ estudiante_id: estudianteId, docente_id: userData?.user?.id, ...campos });
  if (error) throw error;
}

export async function editarAnotacion(id, campos) {
  const { error } = await supabase.from("anotaciones_estudiantes").update(campos).eq("id", id);
  if (error) throw error;
}

export async function eliminarAnotacion(id) {
  const { error } = await supabase.from("anotaciones_estudiantes").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchAcudiente(estudianteId) {
  const { data, error } = await supabase.from("acudientes").select("*").eq("estudiante_id", estudianteId).maybeSingle();
  if (error) throw error;
  return data;
}

// Resumen imprimible de un estudiante: notas por periodo, sus propias
// anotaciones (privadas), asistencia y gamificación — todo junto.
export async function fetchResumenEstudiante(estudianteId) {
  const [estudianteRes, notasRes, anotaciones, asistencia, progresoRes, logrosRes] = await Promise.all([
    supabase.from("estudiantes").select("*").eq("id", estudianteId).maybeSingle(),
    supabase.from("notas_finales_periodo").select("*, materias(nombre)").eq("estudiante_id", estudianteId),
    fetchAnotaciones(estudianteId),
    fetchEstadisticasAsistencia(estudianteId),
    supabase.from("progreso").select("*").eq("estudiante_id", estudianteId).maybeSingle(),
    fetchLogrosEstudiante(estudianteId),
  ]);
  if (estudianteRes.error) throw estudianteRes.error;

  // Arma una tabla materia x periodo
  const materiasMap = {};
  const notasPorMateriaPeriodo = {};
  (notasRes.data || []).forEach((n) => {
    if (!materiasMap[n.materia_id]) materiasMap[n.materia_id] = n.materias?.nombre || `Materia ${n.materia_id}`;
    notasPorMateriaPeriodo[n.materia_id] = notasPorMateriaPeriodo[n.materia_id] || {};
    notasPorMateriaPeriodo[n.materia_id][n.periodo] = n.nota;
  });
  const periodos = Array.from(new Set((notasRes.data || []).map((n) => n.periodo))).sort();
  const materias = Object.entries(materiasMap).map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));

  return {
    estudiante: estudianteRes.data,
    materias, periodos, notasPorMateriaPeriodo,
    anotaciones, asistencia,
    progreso: progresoRes.data || { xp: 0, vida: 100, monedas: 0 },
    logros: logrosRes,
  };
}

// Datos para el Observador del Estudiante: identificación completa +
// matriz cronológica de actas (situaciones registradas).
export async function fetchObservadorData(estudianteId) {
  const [estudianteRes, acudiente, actas, institucion] = await Promise.all([
    supabase.from("estudiantes").select("*").eq("id", estudianteId).maybeSingle(),
    fetchAcudiente(estudianteId),
    fetchActasPorEstudiante(estudianteId),
    fetchInstitucion(),
  ]);
  if (estudianteRes.error) throw estudianteRes.error;
  return {
    estudiante: estudianteRes.data,
    acudiente,
    actas: [...actas].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "")),
    institucion,
  };
}

// Trae los datos del Observador para TODOS los estudiantes activos de un
// curso de una sola vez — para imprimirlos todos juntos.
export async function fetchObservadorDataGrado(gradoId) {
  const estudiantes = await fetchEstudiantesPorGrado(gradoId);
  const activos = estudiantes.filter((e) => e.activo !== false).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const institucion = await fetchInstitucion();
  const datos = [];
  for (const est of activos) {
    const d = await fetchObservadorData(est.id);
    datos.push(d);
  }
  return { datos, institucion };
}

/* ---------------- Consignas del Códice (pregunta general para todo un grado) ---------------- */
export async function fetchConsignasCodice() {
  const [consignasRes, materiasRes] = await Promise.all([
    supabase.from("codice_consignas").select("*").order("creado_en", { ascending: false }),
    supabase.from("materias").select("id, nombre"),
  ]);
  if (consignasRes.error) throw consignasRes.error;
  const nombrePorId = {}; (materiasRes.data || []).forEach((m) => { nombrePorId[m.id] = m.nombre; });
  return (consignasRes.data || []).map((c) => ({ ...c, materia_nombre: c.materia_id ? nombrePorId[c.materia_id] : null }));
}

export async function crearConsignaCodice(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("codice_consignas").insert({ ...campos, docente_id: userData?.user?.id || null });
  if (error) throw error;
}

export async function editarConsignaCodice(id, cambios) {
  const { error } = await supabase.from("codice_consignas").update(cambios).eq("id", id);
  if (error) throw error;
}

export async function eliminarConsignaCodice(id) {
  const { error } = await supabase.from("codice_consignas").delete().eq("id", id);
  if (error) throw error;
}

// Para el estudiante: consignas activas de su grado (nivel completo)
export async function fetchConsignasActivasParaGrado(gradoId) {
  const nivel = String(gradoId || "").slice(0, -2) || String(gradoId || "");
  const { data, error } = await supabase.from("codice_consignas").select("*").eq("nivel", nivel).eq("activa", true).order("creado_en", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Para el docente: quiénes ya respondieron una consigna puntual
export async function fetchRespuestasConsigna(consignaId) {
  const [entradasRes, estudiantesRes] = await Promise.all([
    supabase.from("codice_entradas").select("*").eq("consigna_id", consignaId),
    supabase.from("estudiantes").select("id, nombre, grado_id").eq("activo", true),
  ]);
  if (entradasRes.error) throw entradasRes.error;
  if (estudiantesRes.error) throw estudiantesRes.error;
  const nombrePorId = {}; (estudiantesRes.data || []).forEach((e) => { nombrePorId[e.id] = e; });
  return (entradasRes.data || []).map((e) => ({ ...e, estudiante_nombre: nombrePorId[e.estudiante_id]?.nombre || "Estudiante", grado_id: nombrePorId[e.estudiante_id]?.grado_id }));
}

/* ---------------- 🎡 Preguntados (trivia con ruleta) ---------------- */
export async function fetchTriviaCategorias() {
  const [catRes, materiasRes] = await Promise.all([
    supabase.from("trivia_categorias").select("*").eq("activa", true).order("id"),
    supabase.from("materias").select("id, nombre"),
  ]);
  if (catRes.error) throw catRes.error;
  const nombrePorId = {}; (materiasRes.data || []).forEach((m) => { nombrePorId[m.id] = m.nombre; });
  return (catRes.data || []).map((c) => ({ ...c, materia_nombre: c.materia_id ? nombrePorId[c.materia_id] : null }));
}

export async function crearTriviaCategoria(campos) {
  const { error } = await supabase.from("trivia_categorias").insert(campos);
  if (error) throw error;
}

export async function editarTriviaCategoria(id, cambios) {
  const { error } = await supabase.from("trivia_categorias").update(cambios).eq("id", id);
  if (error) throw error;
}

export async function eliminarTriviaCategoria(id) {
  const { error } = await supabase.from("trivia_categorias").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchTriviaPreguntas(categoriaId) {
  const { data, error } = await supabase.from("trivia_preguntas").select("*").eq("categoria_id", categoriaId).order("creado_en", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function crearTriviaPregunta(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("trivia_preguntas").insert({ ...campos, docente_id: userData?.user?.id || null });
  if (error) throw error;
}

export async function editarTriviaPregunta(id, cambios) {
  const { error } = await supabase.from("trivia_preguntas").update(cambios).eq("id", id);
  if (error) throw error;
}

export async function eliminarTriviaPregunta(id) {
  const { error } = await supabase.from("trivia_preguntas").delete().eq("id", id);
  if (error) throw error;
}

// Trae una pregunta al azar de la categoría, evitando (cuando se pueda) las
// últimas 5 que el estudiante ya respondió en esa categoría.
export async function fetchPreguntaTriviaAleatoria(categoriaId, estudianteId) {
  const [{ data: todas, error }, recientesRes] = await Promise.all([
    supabase.from("trivia_preguntas").select("*").eq("categoria_id", categoriaId).eq("activa", true),
    supabase.from("trivia_respuestas").select("pregunta_id").eq("estudiante_id", estudianteId).eq("categoria_id", categoriaId).order("creado_en", { ascending: false }).limit(5),
  ]);
  if (error) throw error;
  if (!todas || todas.length === 0) return null;
  const recientesIds = new Set((recientesRes.data || []).map((r) => r.pregunta_id));
  const disponibles = todas.filter((p) => !recientesIds.has(p.id));
  const pool = disponibles.length > 0 ? disponibles : todas;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Registra la respuesta, aplica XP/monedas, y calcula si corresponde otorgar
// la corona de esa categoría (3 aciertos seguidos, sin haber fallado antes en la racha actual).
export async function responderTrivia(estudianteId, pregunta, opcionElegida) {
  const acierto = opcionElegida === pregunta.correcta;
  await supabase.from("trivia_respuestas").insert({
    estudiante_id: estudianteId, pregunta_id: pregunta.id, categoria_id: pregunta.categoria_id, acierto,
  });

  let corona = false;
  if (acierto) {
    await ajustarXp(estudianteId, 5);
    await ajustarMonedas(estudianteId, 2);

    // Racha actual: últimas respuestas en esta categoría, contadas desde la más reciente hasta el primer fallo
    const { data: ultimas } = await supabase.from("trivia_respuestas").select("acierto").eq("estudiante_id", estudianteId).eq("categoria_id", pregunta.categoria_id).order("creado_en", { ascending: false }).limit(3);
    const racha = (ultimas || []).every((r) => r.acierto) && (ultimas || []).length >= 3;
    if (racha) {
      const { data: yaTiene } = await supabase.from("trivia_coronas").select("id").eq("estudiante_id", estudianteId).eq("categoria_id", pregunta.categoria_id).maybeSingle();
      if (!yaTiene) {
        await supabase.from("trivia_coronas").insert({ estudiante_id: estudianteId, categoria_id: pregunta.categoria_id });
        await ajustarMonedas(estudianteId, 15);
        corona = true;
      }
    }
  }
  return { acierto, corona };
}

export async function fetchCoronasEstudiante(estudianteId) {
  const { data, error } = await supabase.from("trivia_coronas").select("categoria_id").eq("estudiante_id", estudianteId);
  if (error) throw error;
  return (data || []).map((c) => c.categoria_id);
}

// Para el docente: cuántas coronas tiene cada estudiante de un curso, para un mini-ranking
export async function fetchRankingCoronas(gradoId) {
  const [estudiantes, coronasRes] = await Promise.all([
    fetchEstudiantesPorGrado(gradoId),
    supabase.from("trivia_coronas").select("estudiante_id"),
  ]);
  const conteo = {};
  (coronasRes.data || []).forEach((c) => { conteo[c.estudiante_id] = (conteo[c.estudiante_id] || 0) + 1; });
  return estudiantes.map((e) => ({ ...e, coronas: conteo[e.id] || 0 })).sort((a, b) => b.coronas - a.coronas);
}

/* ---------------- 🗂️ Banco de preguntas (reutilizable en Misiones) ---------------- */
export async function fetchBancoPreguntas(materiaId, tema, nivel) {
  let query = supabase.from("banco_preguntas").select("*").order("creado_en", { ascending: false });
  if (materiaId) query = query.eq("materia_id", materiaId);
  if (tema) query = query.eq("tema", tema);
  if (nivel) query = query.eq("nivel", nivel);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchNivelesBanco(materiaId) {
  let query = supabase.from("banco_preguntas").select("nivel");
  if (materiaId) query = query.eq("materia_id", materiaId);
  const { data, error } = await query;
  if (error) throw error;
  return Array.from(new Set((data || []).map((r) => r.nivel).filter(Boolean))).sort();
}

export async function fetchTemasBanco(materiaId, nivel) {
  let query = supabase.from("banco_preguntas").select("tema");
  if (materiaId) query = query.eq("materia_id", materiaId);
  if (nivel) query = query.eq("nivel", nivel);
  const { data, error } = await query;
  if (error) throw error;
  return Array.from(new Set((data || []).map((r) => r.tema).filter(Boolean))).sort();
}

export async function crearPreguntaBanco(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("banco_preguntas").insert({ ...campos, docente_id: userData?.user?.id || null });
  if (error) throw error;
}

export async function editarPreguntaBanco(id, campos) {
  const { error } = await supabase.from("banco_preguntas").update(campos).eq("id", id);
  if (error) throw error;
}

export async function eliminarPreguntaBanco(id) {
  const { error } = await supabase.from("banco_preguntas").delete().eq("id", id);
  if (error) throw error;
}

export async function eliminarPreguntasBancoMasivo(ids) {
  const { error } = await supabase.from("banco_preguntas").delete().in("id", ids);
  if (error) throw error;
}

// Traslada preguntas seleccionadas a otra materia/grado/tema de una sola vez —
// solo cambia los campos que se le pasen (los que se dejan undefined no se tocan).
export async function trasladarPreguntasBanco(ids, cambios) {
  const set = {};
  if (cambios.materia_id !== undefined) set.materia_id = cambios.materia_id;
  if (cambios.nivel !== undefined) set.nivel = cambios.nivel;
  if (cambios.tema !== undefined) set.tema = cambios.tema;
  const { error } = await supabase.from("banco_preguntas").update(set).in("id", ids);
  if (error) throw error;
}

// Importación masiva desde Excel — filas ya parseadas en JS, cada una con
// { enunciado, opcionA..D, correcta (A/B/C/D), tema }.
export async function importarPreguntasBanco(materiaId, filas, nivel) {
  let cargadas = 0;
  const errores = [];
  for (const f of filas) {
    try {
      const opciones = [
        { texto: f.opcionA, correcta: f.correcta === "A" },
        { texto: f.opcionB, correcta: f.correcta === "B" },
        { texto: f.opcionC, correcta: f.correcta === "C" },
        { texto: f.opcionD, correcta: f.correcta === "D" },
      ].filter((o) => o.texto && o.texto.trim());
      if (opciones.length < 2 || !opciones.some((o) => o.correcta)) { errores.push(`"${f.enunciado?.slice(0, 40)}...": faltan opciones o respuesta correcta`); continue; }
      await crearPreguntaBanco({ materia_id: materiaId, nivel: f.nivel || nivel || null, tema: f.tema || null, enunciado: f.enunciado, opciones, dificultad: f.dificultad || null, retroalimentacion: f.retroalimentacion || null });
      cargadas++;
    } catch (e) {
      errores.push(`"${f.enunciado?.slice(0, 40)}...": ${e.message}`);
    }
  }
  return { cargadas, total: filas.length, errores };
}

// Elige N preguntas al azar del banco (con el filtro de materia/tema que se
// pida) y las crea como preguntas reales de la evaluación indicada.
export async function agregarPreguntasAleatoriasDesdeBanco(evaluacionId, materiaId, tema, nivel, cantidad, ordenInicial) {
  const disponibles = await fetchBancoPreguntas(materiaId, tema || null, nivel || null);
  if (disponibles.length === 0) return { agregadas: 0, disponibles: 0 };
  const mezcladas = [...disponibles].sort(() => Math.random() - 0.5);
  const elegidas = mezcladas.slice(0, cantidad);
  let orden = ordenInicial;
  for (const p of elegidas) {
    await crearPregunta({ evaluacion_id: evaluacionId, orden: orden++, tipo: "opcion_multiple", enunciado: p.enunciado, puntos: 1, opciones: p.opciones, retroalimentacion: p.retroalimentacion || null });
  }
  return { agregadas: elegidas.length, disponibles: disponibles.length };
}

// Copia preguntas del banco (de la materia ligada a la categoría) hacia
// Preguntados, convirtiendo el formato — así el mismo banco alimenta las
// evaluaciones Y el juego. No duplica: salta las que ya tengan el mismo enunciado.
export async function importarBancoATrivia(categoriaId, materiaId, tema, nivel) {
  const [banco, existentes] = await Promise.all([
    fetchBancoPreguntas(materiaId, tema || null, nivel || null),
    fetchTriviaPreguntas(categoriaId),
  ]);
  const enunciadosExistentes = new Set(existentes.map((p) => p.pregunta.trim().toLowerCase()));

  let importadas = 0;
  for (const b of banco) {
    if (enunciadosExistentes.has(b.enunciado.trim().toLowerCase())) continue;
    const correctaIdx = b.opciones.findIndex((o) => o.correcta);
    if (correctaIdx < 0) continue;
    await crearTriviaPregunta({
      categoria_id: categoriaId,
      pregunta: b.enunciado,
      opciones: b.opciones.map((o) => o.texto),
      correcta: correctaIdx,
    });
    importadas++;
  }
  return { importadas, total: banco.length };
}

/* ---------------- 🔑 Registro de accesos de estudiantes ---------------- */
// Se llama cada vez que un estudiante entra con su código. No frena el
// login si falla — es solo un registro, no algo crítico para poder entrar.
export async function registrarAcceso(estudianteId) {
  try {
    await supabase.from("accesos_estudiante").insert({ estudiante_id: estudianteId });
  } catch (e) {
    // silencioso — nunca debe bloquear el ingreso del estudiante
  }
}

// Reporte por curso: último acceso y cantidad total de cada estudiante.
export async function fetchReporteAccesos(gradoId) {
  const [estudiantes, accesosRes] = await Promise.all([
    fetchEstudiantesPorGrado(gradoId),
    supabase.from("accesos_estudiante").select("estudiante_id, fecha"),
  ]);
  const porEstudiante = {};
  (accesosRes.data || []).forEach((a) => {
    if (!porEstudiante[a.estudiante_id]) porEstudiante[a.estudiante_id] = { total: 0, ultimo: null };
    porEstudiante[a.estudiante_id].total++;
    if (!porEstudiante[a.estudiante_id].ultimo || a.fecha > porEstudiante[a.estudiante_id].ultimo) {
      porEstudiante[a.estudiante_id].ultimo = a.fecha;
    }
  });
  return estudiantes.map((e) => ({
    ...e,
    totalAccesos: porEstudiante[e.id]?.total || 0,
    ultimoAcceso: porEstudiante[e.id]?.ultimo || null,
  })).sort((a, b) => {
    if (!a.ultimoAcceso && !b.ultimoAcceso) return a.nombre.localeCompare(b.nombre);
    if (!a.ultimoAcceso) return 1;
    if (!b.ultimoAcceso) return -1;
    return b.ultimoAcceso.localeCompare(a.ultimoAcceso);
  });
}

// Trae a todos los estudiantes que hayan tenido alguna baja de vida por
// comportamiento (de todos los cursos juntos), con el total perdido y la
// cantidad de incidentes — para detectarlos sin ir curso por curso.
export async function fetchEstudiantesConBajasVida() {
  const [historialRes, estudiantesRes] = await Promise.all([
    supabase.from("historial_gamificacion").select("estudiante_id, etiqueta, vida, categoria, ts").lt("vida", 0).order("ts", { ascending: false }),
    supabase.from("estudiantes").select("id, nombre, grado_id, foto_url").eq("activo", true),
  ]);
  if (historialRes.error) throw historialRes.error;
  const estudiantePorId = {}; (estudiantesRes.data || []).forEach((e) => { estudiantePorId[e.id] = e; });

  const porEstudiante = {};
  (historialRes.data || []).forEach((h) => {
    if (!estudiantePorId[h.estudiante_id]) return; // estudiante inactivo/trasladado
    if (!porEstudiante[h.estudiante_id]) porEstudiante[h.estudiante_id] = { totalPerdida: 0, incidentes: 0, ultimo: null, recientes: [] };
    const acc = porEstudiante[h.estudiante_id];
    acc.totalPerdida += Math.abs(h.vida);
    acc.incidentes += 1;
    if (!acc.ultimo || h.ts > acc.ultimo) acc.ultimo = h.ts;
    if (acc.recientes.length < 5) acc.recientes.push(h);
  });

  return Object.entries(porEstudiante).map(([estudianteId, acc]) => ({
    ...estudiantePorId[estudianteId],
    ...acc,
  })).sort((a, b) => b.totalPerdida - a.totalPerdida);
}

/* ---------------- 🎓 Dirección de Curso (consolidado por Excel) ---------------- */
// Trae todas las notas cargadas para un curso — la materia queda como texto
// libre (tal cual venga del boletín del colegio), no depende de que esté
// registrada en el catálogo de materias del docente.
export async function fetchNotasDireccionCurso(gradoId) {
  const { data, error } = await supabase.from("director_curso_notas").select("*").eq("grado_id", gradoId);
  if (error) throw error;
  return data || [];
}

export async function guardarNotaDireccionCurso(gradoId, materiaNombre, estudianteId, periodo, nota) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("director_curso_notas").upsert(
    { grado_id: gradoId, materia_nombre: materiaNombre, estudiante_id: estudianteId, periodo, nota, docente_id: userData?.user?.id || null, actualizado_en: new Date().toISOString() },
    { onConflict: "grado_id,materia_nombre,estudiante_id,periodo" }
  );
  if (error) throw error;
}

export async function eliminarNotasMateriaDireccionCurso(gradoId, materiaNombre, periodo) {
  let query = supabase.from("director_curso_notas").delete().eq("grado_id", gradoId).eq("materia_nombre", materiaNombre);
  if (periodo) query = query.eq("periodo", periodo);
  const { error } = await query;
  if (error) throw error;
}

// Borra la nota de un solo estudiante en una sola materia+periodo (una
// celda puntual de la tabla), a diferencia de la anterior que borra toda
// la materia de golpe.
export async function eliminarNotaCeldaDireccionCurso(gradoId, materiaNombre, estudianteId, periodo) {
  const { error } = await supabase.from("director_curso_notas").delete()
    .eq("grado_id", gradoId).eq("materia_nombre", materiaNombre).eq("estudiante_id", estudianteId).eq("periodo", periodo);
  if (error) throw error;
}

// Importa un Excel (Estudiante | Nota) para una materia y periodo puntual,
// emparejando por nombre — no crea asignaturas nuevas, solo carga notas.
export async function importarNotasDireccionCurso(gradoId, materiaNombre, periodo, filas, estudiantes) {
  let cargadas = 0;
  const sinEmparejar = [];
  for (const f of filas) {
    const match = buscarEstudiantePorNombre(f.nombre, estudiantes);
    if (!match) { sinEmparejar.push(f.nombre); continue; }
    const notaNum = parseFloat(String(f.nota).replace(",", "."));
    if (isNaN(notaNum)) continue;
    await guardarNotaDireccionCurso(gradoId, materiaNombre, match.id, periodo, notaNum);
    cargadas++;
  }
  return { cargadas, total: filas.length, sinEmparejar };
}

export async function toggleNivelacionNota(id, valor) {
  const { error } = await supabase.from("director_curso_notas").update({ en_nivelacion: valor }).eq("id", id);
  if (error) throw error;
}

// Importa el boletín ANCHO que entrega el colegio: una fila por estudiante,
// muchas columnas (una por cada materia+periodo). "columnas" es un mapa
// { indiceColumna: { materiaNombre, periodo } | null } armado a partir de lo
// que dice el propio encabezado del Excel — las columnas en null se ignoran.
export async function importarBoletinAnchoDireccionCurso(gradoId, filasCrudo, encabezados, columnas, estudiantes) {
  let cargadas = 0;
  const sinEmparejar = new Set();
  for (const fila of filasCrudo) {
    const nombreEstudiante = String(fila[0] || "").trim();
    if (!nombreEstudiante) continue;
    const match = buscarEstudiantePorNombre(nombreEstudiante, estudiantes);
    if (!match) { sinEmparejar.add(nombreEstudiante); continue; }

    for (let i = 1; i < encabezados.length; i++) {
      const mapeo = columnas[i];
      if (!mapeo || !mapeo.materiaNombre || !mapeo.periodo) continue;
      const crudo = fila[i];
      if (crudo === undefined || crudo === "" || crudo === null) continue;
      const notaNum = parseFloat(String(crudo).replace(",", "."));
      if (isNaN(notaNum)) continue;
      await guardarNotaDireccionCurso(gradoId, mapeo.materiaNombre.trim(), match.id, String(mapeo.periodo), notaNum);
      cargadas++;
    }
  }
  return { cargadas, sinEmparejar: Array.from(sinEmparejar) };
}

// Consolida, por curso: identificación básica, % de asistencia, resumen
// académico (de Dirección de Curso) y situaciones convivenciales — para el
// panel central del Director de Curso, sin tener que ir pantalla por pantalla.
export async function fetchPanelDireccionCurso(gradoId) {
  const estudiantes = await fetchEstudiantesPorGrado(gradoId);
  const idsEstudiantes = estudiantes.map((e) => e.id);
  const [asistenciaRes, notas, actasRes, citacionesRes] = await Promise.all([
    idsEstudiantes.length ? supabase.from("asistencia").select("estudiante_id, codigo").in("estudiante_id", idsEstudiantes) : { data: [] },
    fetchNotasDireccionCurso(gradoId),
    supabase.from("actas").select("id, estudiante_id, fecha, tipo, tipo_evento, evaluacion_compromiso"),
    supabase.from("citaciones_padres").select("id, estudiante_id, estado, fecha_citacion"),
  ]);

  const asistenciaPorEstudiante = {};
  (asistenciaRes.data || []).forEach((r) => {
    if (!asistenciaPorEstudiante[r.estudiante_id]) asistenciaPorEstudiante[r.estudiante_id] = { P: 0, R: 0, FI: 0, FJ: 0, total: 0 };
    asistenciaPorEstudiante[r.estudiante_id][r.codigo] = (asistenciaPorEstudiante[r.estudiante_id][r.codigo] || 0) + 1;
    asistenciaPorEstudiante[r.estudiante_id].total += 1;
  });

  const idsDelCurso = new Set(estudiantes.map((e) => e.id));
  const actasDelCurso = (actasRes.data || []).filter((a) => idsDelCurso.has(a.estudiante_id));
  const citacionesDelCurso = (citacionesRes.data || []).filter((c) => idsDelCurso.has(c.estudiante_id));

  const resultado = estudiantes.map((e) => {
    const asis = asistenciaPorEstudiante[e.id];
    const porcentajeAsistencia = asis && asis.total > 0 ? Math.round(((asis.P || 0) / asis.total) * 100) : null;
    const propiasNotas = notas.filter((n) => n.estudiante_id === e.id);
    const materiasUnicas = Array.from(new Set(propiasNotas.map((n) => n.materia_nombre)));
    const promediosPorMateria = materiasUnicas.map((m) => {
      const vals = propiasNotas.filter((n) => n.materia_nombre === m).map((n) => Number(n.nota));
      return vals.reduce((a, v) => a + v, 0) / vals.length;
    });
    const promedioGeneral = promediosPorMateria.length ? promediosPorMateria.reduce((a, v) => a + v, 0) / promediosPorMateria.length : null;
    const perdidas = promediosPorMateria.filter((v) => v < 3.5).length;
    const actasEst = actasDelCurso.filter((a) => a.estudiante_id === e.id);
    const compromisosPendientes = actasEst.filter((a) => a.evaluacion_compromiso === "en_proceso" || !a.evaluacion_compromiso).length;
    const citacionesPendientes = citacionesDelCurso.filter((c) => c.estudiante_id === e.id && c.estado === "pendiente").length;

    return {
      ...e,
      porcentajeAsistencia,
      promedioGeneral,
      perdidas,
      totalSituaciones: actasEst.length,
      compromisosPendientes,
      citacionesPendientes,
    };
  });

  const conAsistencia = resultado.filter((e) => e.porcentajeAsistencia !== null);
  const conPromedio = resultado.filter((e) => e.promedioGeneral !== null);
  const resumenGrupo = {
    asistenciaPromedio: conAsistencia.length ? Math.round(conAsistencia.reduce((a, e) => a + e.porcentajeAsistencia, 0) / conAsistencia.length) : null,
    promedioGrupo: conPromedio.length ? conPromedio.reduce((a, e) => a + e.promedioGeneral, 0) / conPromedio.length : null,
    casosConvivenciales: actasDelCurso.length,
    compromisosPendientes: resultado.reduce((a, e) => a + e.compromisosPendientes, 0),
    citacionesPendientes: resultado.reduce((a, e) => a + e.citacionesPendientes, 0),
  };

  return { estudiantes: resultado, resumenGrupo };
}

/* ---------------- 📞 Citaciones a padres ---------------- */
export async function fetchCitacionesPorCurso(gradoId) {
  const estudiantes = await fetchEstudiantesPorGrado(gradoId);
  const ids = estudiantes.map((e) => e.id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("citaciones_padres").select("*").in("estudiante_id", ids).order("fecha_citacion", { ascending: false });
  if (error) throw error;
  const nombrePorId = {}; estudiantes.forEach((e) => { nombrePorId[e.id] = e.nombre; });
  return (data || []).map((c) => ({ ...c, estudiante_nombre: nombrePorId[c.estudiante_id] }));
}

export async function crearCitacion(estudianteId, campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("citaciones_padres").insert({ estudiante_id: estudianteId, docente_id: userData?.user?.id || null, ...campos });
  if (error) throw error;
}

export async function editarCitacion(id, campos) {
  const { error } = await supabase.from("citaciones_padres").update(campos).eq("id", id);
  if (error) throw error;
}

export async function eliminarCitacion(id) {
  const { error } = await supabase.from("citaciones_padres").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- 🗓️ Jornada de Entrega de Informes ---------------- */
export async function fetchJornadasPorCurso(gradoId) {
  const { data, error } = await supabase.from("jornadas_entrega_informes").select("*").eq("grado_id", gradoId).order("fecha", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function crearJornada(gradoId, periodo, nombre, fecha) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("jornadas_entrega_informes")
    .insert({ grado_id: gradoId, periodo, nombre, fecha: fecha || null, docente_id: userData?.user?.id || null })
    .select().single();
  if (error) throw error;
  return data;
}

// Trae la jornada de ese curso+periodo si ya existe, o la crea sola (nombre
// automático) — para que Dirección de Curso sea una sola pantalla con
// pestañas de periodo, sin tener que crear una jornada aparte cada vez.
export async function fetchOCrearJornada(gradoId, periodo) {
  const { data: existente } = await supabase.from("jornadas_entrega_informes").select("*").eq("grado_id", gradoId).eq("periodo", periodo).limit(1).maybeSingle();
  if (existente) return existente;
  return crearJornada(gradoId, periodo, `Entrega de informes — Periodo ${periodo}`, null);
}

export async function eliminarJornada(id) {
  const { error } = await supabase.from("jornadas_entrega_informes").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchDetalleJornada(jornadaId, gradoId) {
  const [horariosRes, asignacionesRes, estudiantes] = await Promise.all([
    supabase.from("jornada_horarios").select("*").eq("jornada_id", jornadaId).order("orden"),
    supabase.from("jornada_asignaciones").select("*").eq("jornada_id", jornadaId),
    fetchEstudiantesPorGrado(gradoId),
  ]);
  if (horariosRes.error) throw horariosRes.error;
  if (asignacionesRes.error) throw asignacionesRes.error;
  const asigPorEstudiante = {}; (asignacionesRes.data || []).forEach((a) => { asigPorEstudiante[a.estudiante_id] = a; });
  return {
    horarios: horariosRes.data || [],
    estudiantes: estudiantes.sort((a, b) => a.nombre.localeCompare(b.nombre)).map((e) => ({ ...e, asignacion: asigPorEstudiante[e.id] || null })),
  };
}

export async function crearHorarioJornada(jornadaId, etiqueta, horaInicio, horaFin, capacidad, orden) {
  const { error } = await supabase.from("jornada_horarios").insert({ jornada_id: jornadaId, etiqueta, hora_inicio: horaInicio || null, hora_fin: horaFin || null, capacidad: capacidad || 5, orden });
  if (error) throw error;
}

export async function eliminarHorarioJornada(id) {
  const { error } = await supabase.from("jornada_horarios").delete().eq("id", id);
  if (error) throw error;
}

// Asigna (o desasigna, con horarioId=null) un estudiante a un horario —
// upsert, para poder cambiarlo con solo volver a llamar la función.
export async function asignarEstudianteHorario(jornadaId, estudianteId, horarioId) {
  const { error } = await supabase.from("jornada_asignaciones").upsert(
    { jornada_id: jornadaId, estudiante_id: estudianteId, horario_id: horarioId },
    { onConflict: "jornada_id,estudiante_id" }
  );
  if (error) throw error;
}

export async function actualizarChecklistJornada(jornadaId, estudianteId, cambios) {
  const { error } = await supabase.from("jornada_asignaciones").upsert(
    { jornada_id: jornadaId, estudiante_id: estudianteId, ...cambios },
    { onConflict: "jornada_id,estudiante_id" }
  );
  if (error) throw error;
}

export async function fetchEstadosMateriaCurso(gradoId) {
  const { data, error } = await supabase.from("director_curso_estado_materia").select("*").eq("grado_id", gradoId);
  if (error) throw error;
  return data || [];
}

export async function guardarEstadoMateria(gradoId, materiaNombre, estudianteId, estado) {
  const { error } = await supabase.from("director_curso_estado_materia").upsert(
    { grado_id: gradoId, materia_nombre: materiaNombre, estudiante_id: estudianteId, estado, actualizado_en: new Date().toISOString() },
    { onConflict: "grado_id,materia_nombre,estudiante_id" }
  );
  if (error) throw error;
}

/* ---------------- 🧑‍🏫 Tutorías individuales ---------------- */
export async function fetchTutoriasEstudiante(estudianteId) {
  const { data, error } = await supabase.from("tutorias_individuales").select("*").eq("estudiante_id", estudianteId).order("fecha", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function crearTutoria(estudianteId, campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("tutorias_individuales").insert({ estudiante_id: estudianteId, docente_id: userData?.user?.id || null, ...campos });
  if (error) throw error;
}

export async function editarTutoria(id, campos) {
  const { error } = await supabase.from("tutorias_individuales").update(campos).eq("id", id);
  if (error) throw error;
}

export async function eliminarTutoria(id) {
  const { error } = await supabase.from("tutorias_individuales").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- 📘 Guías de estudio ---------------- */
export async function fetchGuiasEstudio(materiaId, gradoId, periodo) {
  let query = supabase.from("guias_estudio").select("*").eq("materia_id", materiaId).eq("grado_id", gradoId);
  if (periodo) query = query.eq("periodo", periodo);
  const { data, error } = await query.order("creado_en", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Para el estudiante: todas las guías publicadas de su grado (de cualquier materia).
export async function fetchGuiasEstudioParaGrado(gradoId) {
  const { data, error } = await supabase.from("guias_estudio").select("*, materias(nombre)").eq("grado_id", gradoId).eq("publicada", true).order("creado_en", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function crearGuiaEstudio(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("guias_estudio").insert({ ...campos, docente_id: userData?.user?.id || null });
  if (error) throw error;
}

export async function editarGuiaEstudio(id, campos) {
  const { error } = await supabase.from("guias_estudio").update(campos).eq("id", id);
  if (error) throw error;
}

export async function eliminarGuiaEstudio(id) {
  const { error } = await supabase.from("guias_estudio").delete().eq("id", id);
  if (error) throw error;
}

// Prompt de IA de fábrica para generar Guías de Estudio — se siembra la
// primera vez, editable después.
export const PROMPT_IA_GUIAS_DEFAULT = `Actuá como un diseñador instruccional experto en educación básica y media.
Vas a crear una GUÍA DE ESTUDIO PEDAGÓGICA completa, siguiendo exactamente
esta estructura de 6 secciones, sin saltarte ninguna:

DATOS DE ENTRADA
- Institución / Asignatura: [nombre institución — asignatura o módulo]
- Título de la Unidad / Tema: [tema central]
- Nivel / Grado / Población: [grado o ciclo]
- Docente / Responsable: [nombre]
- Tiempo estimado: [horas de estudio o plazo de entrega]
- Nivel de profundidad deseado: [introductorio / intermedio / avanzado]
- Enfoque o énfasis particular (opcional): [ej: pensamiento crítico, resolución
  de problemas, enfoque práctico, preparación para evaluación externa, etc.]

GENERÁ LA GUÍA CON ESTAS 6 SECCIONES EXACTAS:

1. DATOS DE IDENTIFICACIÓN
   Tabla con: Institución/Asignatura, Título de la Unidad/Tema,
   Nivel/Grado/Población, Docente/Responsable, Tiempo Estimado.

2. METAS DE APRENDIZAJE Y COMPETENCIAS
   - Propósito General (1-2 oraciones).
   - Desempeño/Aprendizaje Esperado: 2-4 enunciados con formato
     "Verbo de acción + contenido + contexto" (ej: "Analizar los postulados
     teóricos centrales mediante estudio de casos").
   - Criterios de Evaluación: 3-5 indicadores concretos y observables que
     muestren el nivel de dominio esperado.

3. FUNDAMENTACIÓN TEÓRICA Y CONCEPTOS CLAVE
   - Una síntesis clara y estructurada del tema (evitá bloques densos de
     texto — usá párrafos cortos, listas o subtítulos).
   - Una tabla de 4-8 Conceptos Clave, cada uno con su definición sintética
     y su relación directa con el tema central.

4. SECUENCIA DE ACTIVIDADES Y PRÁCTICA GUIADA
   - Fase de Exploración y Comprensión: una pregunta de reflexión inicial o
     lectura dirigida que conecte con saberes previos.
   - Fase de Aplicación y Análisis: un ejercicio práctico, caso, problema o
     cuadro comparativo concreto (no solo la instrucción genérica — traé el
     ejercicio ya armado, con su enunciado completo).
   - Fase de Transferencia/Creación: una consigna de síntesis, propuesta,
     argumentación o producto final que el estudiante deba construir.

5. RECURSOS DE APOYO Y MATERIAL COMPLEMENTARIO
   - Lectura Principal: referencia bibliográfica sugerida (autor, título,
     capítulo/páginas aproximadas — aclarando que es una sugerencia genérica
     si no conocés el material real del docente).
   - Material Multimedia/Enlaces: 2-3 sugerencias de tipo de recurso
     (video explicativo, podcast, simulador, etc.) describiendo qué buscar,
     sin inventar URLs reales.
   - Herramientas Sugeridas: software, calculadoras o plataformas útiles
     para esta unidad puntual.

6. RÚBRICA DE AUTOEVALUACIÓN Y METACOGNICIÓN
   - Tabla con 3-5 Criterios de Desempeño (columnas: Logrado / En Proceso /
     Por Mejorar) — los criterios deben reflejar exactamente lo que se pidió
     lograr en la sección 2.
   - 2 Preguntas de Reflexión Final, siguiendo este espíritu:
     "¿Cuál fue el concepto o actividad más desafiante y qué estrategia
     utilicé para resolverlo?" / "¿Qué dudas o temas requieren una tutoría
     o profundización adicional?" — podés ajustarlas al tema puntual.

REGLAS IMPORTANTES:
- Todo el contenido tiene que ser específico al tema pedido, no genérico
  ni reciclable para cualquier materia.
- Usá un lenguaje claro y adecuado al nivel/grado indicado.
- La Fase de Aplicación (sección 4) es la más importante: el ejercicio
  tiene que estar completamente desarrollado, listo para que el estudiante
  lo resuelva sin pasos adicionales de tu parte.
- Si el "Enfoque o énfasis particular" fue indicado, que se note claramente
  en las secciones 2, 3 y 4.
- No uses relleno ni frases vacías — cada campo debe aportar contenido real.`;

export async function fetchPromptIaGuias() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return PROMPT_IA_GUIAS_DEFAULT;
  const { data, error } = await supabase.from("prompt_ia_guias").select("texto").eq("docente_id", userData.user.id).maybeSingle();
  if (error) throw error;
  if (data) return data.texto;
  await supabase.from("prompt_ia_guias").insert({ docente_id: userData.user.id, texto: PROMPT_IA_GUIAS_DEFAULT });
  return PROMPT_IA_GUIAS_DEFAULT;
}

export async function guardarPromptIaGuias(texto) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("prompt_ia_guias").upsert({ docente_id: userData?.user?.id, texto, actualizado_en: new Date().toISOString() }, { onConflict: "docente_id" });
  if (error) throw error;
}

// Autoevaluación del estudiante para una guía puntual (rúbrica marcada +
// respuestas a las preguntas de reflexión) — se guarda a medida que va
// completando, no hace falta un botón de "enviar" único.
export async function fetchAutoevaluacionGuia(guiaId, estudianteId) {
  const { data, error } = await supabase.from("guia_autoevaluaciones").select("*").eq("guia_id", guiaId).eq("estudiante_id", estudianteId).maybeSingle();
  if (error) throw error;
  return data?.respuestas || {};
}

export async function guardarAutoevaluacionGuia(guiaId, estudianteId, respuestas) {
  const { error } = await supabase.from("guia_autoevaluaciones").upsert(
    { guia_id: guiaId, estudiante_id: estudianteId, respuestas, actualizado_en: new Date().toISOString() },
    { onConflict: "guia_id,estudiante_id" }
  );
  if (error) throw error;
}

// Marca/desmarca una materia como perdida para un estudiante en esa jornada
// — recibe el arreglo actual (ya cargado en pantalla) para no tener que
// releer de la base antes de guardar.
export async function toggleMateriaPerdida(jornadaId, estudianteId, materiasActuales, materiaNombre) {
  const actual = materiasActuales || [];
  const nuevo = actual.includes(materiaNombre) ? actual.filter((m) => m !== materiaNombre) : [...actual, materiaNombre];
  await actualizarChecklistJornada(jornadaId, estudianteId, { materias_perdidas: nuevo });
  return nuevo;
}

/* ---------------- Plantillas de recomendación (ampliables) ---------------- */
export async function fetchPlantillasCompromiso() {
  const { data, error } = await supabase.from("plantillas_compromiso_dc").select("*").order("creado_en");
  if (error) throw error;
  return data || [];
}

export async function crearPlantillaCompromiso(categoria, texto) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("plantillas_compromiso_dc").insert({ categoria, texto, docente_id: userData?.user?.id || null });
  if (error) throw error;
}

export async function eliminarPlantillaCompromiso(id) {
  const { error } = await supabase.from("plantillas_compromiso_dc").delete().eq("id", id);
  if (error) throw error;
}

export async function editarPlantillaCompromiso(id, texto) {
  const { error } = await supabase.from("plantillas_compromiso_dc").update({ texto }).eq("id", id);
  if (error) throw error;
}

const PLANTILLAS_COMPROMISO_SEED = {
  nivelacion: [
    "El estudiante y su acudiente se comprometen a presentar el plan de nivelación de las asignaturas pendientes en un plazo máximo de 15 días hábiles a partir de la firma de la presente acta, según lo establecido en el Manual de Convivencia.",
    "El estudiante se compromete a mejorar su desempeño académico durante el periodo siguiente, cumpliendo oportunamente con las actividades, tareas y evaluaciones propuestas por cada docente.",
  ],
  convivencial: [
    "El estudiante se compromete a dar cumplimiento a las normas establecidas en el Manual de Convivencia Institucional, manteniendo un comportamiento respetuoso con la comunidad educativa.",
    "El estudiante se compromete a asistir puntualmente a la institución y a cada una de sus clases, evitando llegadas tarde e inasistencias injustificadas.",
  ],
};

// Siembra las plantillas genéricas de fábrica, como filas normales editables
// — solo lo que falte (no duplica si ya hay alguna en esa categoría).
export async function sembrarPlantillasCompromisoBase() {
  const { data: userData } = await supabase.auth.getUser();
  const docenteId = userData?.user?.id || null;
  const existentes = await fetchPlantillasCompromiso();
  const filas = [];
  ["nivelacion", "convivencial"].forEach((categoria) => {
    if (!existentes.some((p) => p.categoria === categoria)) {
      PLANTILLAS_COMPROMISO_SEED[categoria].forEach((texto) => filas.push({ docente_id: docenteId, categoria, texto }));
    }
  });
  if (filas.length > 0) {
    const { error } = await supabase.from("plantillas_compromiso_dc").insert(filas);
    if (error) throw error;
  }
}

// Borra todas las plantillas propias de una categoría y las vuelve a
// sembrar con las genéricas de fábrica — para cuando cambia el manual.
export async function restablecerPlantillasCompromiso(categoria) {
  const { data: userData } = await supabase.auth.getUser();
  const docenteId = userData?.user?.id || null;
  await supabase.from("plantillas_compromiso_dc").delete().eq("categoria", categoria).eq("docente_id", docenteId);
  const filas = PLANTILLAS_COMPROMISO_SEED[categoria].map((texto) => ({ docente_id: docenteId, categoria, texto }));
  const { error } = await supabase.from("plantillas_compromiso_dc").insert(filas);
  if (error) throw error;
}

/* ---------------- Plan de asignaturas (checklist de Dirección de Curso) ---------------- */
const MATERIAS_CHECKLIST_SEED = [
  "Artes y Danzas", "Ciencias Naturales y Educación Ambiental", "Ciencias Sociales",
  "Educación Ética y en Valores Humanos", "Educación Física, Recreación y Deportes",
  "Educación Religiosa y Moral", "Humanidades - Lengua Castellana", "Idioma Extranjero - Inglés",
  "Matemáticas", "Tecnología e Informática",
];

export async function fetchMateriasChecklist() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return [];
  let { data, error } = await supabase.from("direccion_curso_materias_checklist").select("*").eq("docente_id", userData.user.id).order("orden");
  if (error) throw error;
  if (!data || data.length === 0) {
    const filas = MATERIAS_CHECKLIST_SEED.map((nombre, i) => ({ docente_id: userData.user.id, nombre, orden: i }));
    const { data: sembradas, error: e2 } = await supabase.from("direccion_curso_materias_checklist").insert(filas).select();
    if (e2) throw e2;
    data = sembradas;
  }
  return data;
}

export async function crearMateriaChecklist(nombre) {
  const { data: userData } = await supabase.auth.getUser();
  const existentes = await fetchMateriasChecklist();
  const { data, error } = await supabase.from("direccion_curso_materias_checklist")
    .insert({ docente_id: userData?.user?.id, nombre, orden: existentes.length })
    .select().single();
  if (error) throw error;
  return data;
}

export async function editarMateriaChecklist(id, nombre) {
  const { error } = await supabase.from("direccion_curso_materias_checklist").update({ nombre }).eq("id", id);
  if (error) throw error;
}

export async function eliminarMateriaChecklist(id) {
  const { error } = await supabase.from("direccion_curso_materias_checklist").delete().eq("id", id);
  if (error) throw error;
}

export async function restablecerMateriasChecklist() {
  const { data: userData } = await supabase.auth.getUser();
  const docenteId = userData?.user?.id || null;
  await supabase.from("direccion_curso_materias_checklist").delete().eq("docente_id", docenteId);
  const filas = MATERIAS_CHECKLIST_SEED.map((nombre, i) => ({ docente_id: docenteId, nombre, orden: i }));
  const { error } = await supabase.from("direccion_curso_materias_checklist").insert(filas);
  if (error) throw error;
}

/* ---------------- Dirección de Curso — materias configurables por curso ---------------- */
export async function fetchMateriasCurso(gradoId) {
  const { data, error } = await supabase.from("direccion_curso_materias").select("*").eq("grado_id", gradoId).order("orden").order("id");
  if (error) throw error;
  return data || [];
}

export async function crearMateriaCurso(gradoId, nombre, orden) {
  const { error } = await supabase.from("direccion_curso_materias").insert({ grado_id: gradoId, nombre: nombre.trim(), orden: orden ?? 0 });
  if (error) throw error;
}

// Renombra la materia Y mueve todas las notas ya guardadas con el nombre
// viejo al nombre nuevo, para no perder el historial cargado.
export async function renombrarMateriaCurso(id, gradoId, nombreViejo, nombreNuevo) {
  const { error: e1 } = await supabase.from("direccion_curso_materias").update({ nombre: nombreNuevo.trim() }).eq("id", id);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("director_curso_notas").update({ materia_nombre: nombreNuevo.trim() }).eq("grado_id", gradoId).eq("materia_nombre", nombreViejo);
  if (e2) throw e2;
}

// Elimina la materia de la lista Y todas las notas guardadas con ese nombre.
export async function eliminarMateriaCurso(id, gradoId, nombre) {
  const { error: e1 } = await supabase.from("director_curso_notas").delete().eq("grado_id", gradoId).eq("materia_nombre", nombre);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("direccion_curso_materias").delete().eq("id", id);
  if (e2) throw e2;
}

export async function fetchConfigCurso(gradoId) {
  const { data, error } = await supabase.from("direccion_curso_config").select("*").eq("grado_id", gradoId).maybeSingle();
  if (error) throw error;
  return data || { grado_id: gradoId, sistema_periodos: "trimestre", nota_minima: 3.5 };
}

export async function guardarConfigCurso(gradoId, cambios) {
  const { error } = await supabase.from("direccion_curso_config").upsert({ grado_id: gradoId, ...cambios }, { onConflict: "grado_id" });
  if (error) throw error;
}

// Trae a TODOS los estudiantes activos de TODOS los cursos juntos — para
// la corrección masiva de nombres/apellidos.
export async function fetchTodosLosEstudiantesActivos() {
  const { data, error } = await supabase.from("estudiantes").select("id, nombre, apellidos, grado_id").eq("activo", true);
  if (error) throw error;
  return ordenarPorApellido(data || []);
}

export async function fetchInstitucion() {
  const { data, error } = await supabase.from("institucion").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  return data || { id: 1, nombre: "Institución Educativa", ciclo: "", anio: "", logo_url: null, imagen_menu_url: null };
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

// Esta función faltaba por completo en el código — el botón de "crear
// materia" en Calificaciones la llamaba, pero nunca se había escrito.
export async function crearMateria(nombre) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("materias").insert({ nombre: nombre.trim(), docente_id: userData?.user?.id || null }).select().single();
  if (error) throw error;
  return data;
}

// Trae la materia especial "Dirección de Curso" (la crea si todavía no
// existe) — para usarla como materia real en vez de "sin materia" (null),
// que en Postgres causaba duplicados al no tratar dos NULL como iguales.
// Compara nombres ignorando mayúsculas, tildes y espacios de más — para
// encontrar la materia aunque se haya escrito "direccion de curso",
// "DIRECCIÓN DE CURSO ", etc.
function normalizarNombre(s) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}

export async function fetchOCrearMateriaDireccionCurso() {
  const todas = await fetchMaterias();
  const existente = todas.find((m) => normalizarNombre(m.nombre) === normalizarNombre("Dirección de Curso"));
  if (existente) return existente;
  return crearMateria("Dirección de Curso");
}

// Limpia los duplicados que haya quedado en la asistencia GENERAL (sin
// materia, materia_id null) de un curso, y migra lo que sobreviva hacia la
// materia real "Dirección de Curso" — para dejar todo consistente y que
// no vuelva a duplicarse.
export async function limpiarYMigrarAsistenciaGeneral(gradoId) {
  const materiaDC = await fetchOCrearMateriaDireccionCurso();
  const estudiantes = await fetchEstudiantesPorGrado(gradoId);
  const ids = estudiantes.map((e) => e.id);
  if (ids.length === 0) return { duplicadosEliminados: 0, migrados: 0, materiaId: materiaDC.id };

  const { data: generales, error } = await supabase.from("asistencia").select("*").in("estudiante_id", ids).is("materia_id", null);
  if (error) throw error;

  // Agrupa por estudiante+fecha (la tabla no tiene columna "id" propia, así
  // que no hay forma de saber cuál duplicado es "el más reciente" — se
  // conserva uno cualquiera del grupo y se borran los demás).
  const grupos = {};
  (generales || []).forEach((r) => {
    const clave = `${r.estudiante_id}_${r.fecha}`;
    if (!grupos[clave]) grupos[clave] = [];
    grupos[clave].push(r);
  });

  let duplicadosEliminados = 0;
  let migrados = 0;
  for (const clave of Object.keys(grupos)) {
    const fila = grupos[clave];
    const conservar = fila[fila.length - 1];
    if (fila.length > 1) duplicadosEliminados += fila.length - 1;

    // Borra TODAS las filas de ese estudiante+fecha sin materia, y deja una
    // sola, ya migrada hacia la materia real "Dirección de Curso".
    await supabase.from("asistencia").delete().eq("estudiante_id", conservar.estudiante_id).eq("fecha", conservar.fecha).is("materia_id", null);
    const { error: eIns } = await supabase.from("asistencia").insert({
      estudiante_id: conservar.estudiante_id, fecha: conservar.fecha, codigo: conservar.codigo,
      observacion: conservar.observacion, materia_id: materiaDC.id, docente_id: conservar.docente_id,
      xp_aplicado: conservar.xp_aplicado, vida_aplicada: conservar.vida_aplicada,
    });
    if (!eIns) migrados++;
  }

  return { duplicadosEliminados, migrados, materiaId: materiaDC.id };
}

export async function renombrarMateria(id, nombreNuevo) {
  const { error } = await supabase.from("materias").update({ nombre: nombreNuevo.trim() }).eq("id", id);
  if (error) throw error;
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
  if (!data) return { escala_min: 1.0, nota_minima: 3.5, nota_maxima: 5.0, sistema_periodos: "bimestre", cantidad_periodos: 4, periodo_actual: "1" };
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

// Copia columnas (actividades) puntuales de una materia a otra, junto con las
// notas ya cargadas — a diferencia de copiarNotasDesdeMateria, esto no trae todo,
// solo lo seleccionado, y no reemplaza lo que ya exista.
// destinoPorActividad: { [actividadOrigenId]: { actividadDestinoId } | { categoriaId } }
//   - Si viene actividadDestinoId, la nota cae directo en esa columna ya existente.
//   - Si no, se crea una columna nueva en categoriaId.
// Si se pasa estudianteId, solo copia la nota de ESE estudiante en vez de la de todos.
export async function copiarColumnasEspecificas(actividadesOrigenIds, materiaDestinoId, gradoDestinoId, destinoPorActividad, estudianteId = null) {
  const actividadesOrigen = await Promise.all(
    actividadesOrigenIds.map(async (id) => {
      const { data, error } = await supabase.from("notas_actividades").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    })
  );
  const valoresOrigen = await fetchValores(actividadesOrigenIds);

  let copiadas = 0;
  for (const act of actividadesOrigen) {
    const destino = destinoPorActividad[act.id] || {};
    let actividadDestinoId = destino.actividadDestinoId || null;

    if (!actividadDestinoId) {
      const nueva = await crearActividad({
        nombre: act.nombre,
        categoria_id: destino.categoriaId,
        materia_id: materiaDestinoId,
        grado_id: gradoDestinoId,
        periodo: act.periodo,
        es_automatica: act.es_automatica,
        gam_categoria: act.gam_categoria || null,
      });
      actividadDestinoId = nueva.id;
    }

    const valoresDeEsta = valoresOrigen.filter((v) => v.actividad_id === act.id && (!estudianteId || v.estudiante_id === estudianteId));
    for (const v of valoresDeEsta) {
      await setValor(actividadDestinoId, v.estudiante_id, v.valor);
    }
    copiadas++;
  }
  return copiadas;
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
  await otorgarRecompensaSiCorresponde(actividadId, estudianteId, valor);
}

// Si esta actividad de la Planilla está vinculada a una Actividad
// Programada con recompensa configurada, y la nota alcanza el mínimo, le
// da al estudiante el XP/Vida/Monedas configurados — una sola vez por
// actividad+estudiante, aunque se corrija la nota varias veces después.
async function otorgarRecompensaSiCorresponde(actividadId, estudianteId, valor) {
  const { data: vinculo } = await supabase.from("actividades_programadas_cursos")
    .select("actividades_programadas(nombre, recompensa_xp, recompensa_vida, recompensa_monedas, nota_minima)")
    .eq("actividad_notas_id", actividadId).maybeSingle();
  const prog = vinculo?.actividades_programadas;
  if (!prog) return;
  const sinRecompensa = !prog.recompensa_xp && !prog.recompensa_vida && !prog.recompensa_monedas;
  if (sinRecompensa) return;
  if (valor < (prog.nota_minima ?? 3.5)) return;

  const { data: yaOtorgada } = await supabase.from("recompensas_otorgadas").select("id").eq("actividad_id", actividadId).eq("estudiante_id", estudianteId).maybeSingle();
  if (yaOtorgada) return;

  const { error: eGuard } = await supabase.from("recompensas_otorgadas").insert({ actividad_id: actividadId, estudiante_id: estudianteId });
  if (eGuard) return; // si otro proceso ya insertó el guard en simultáneo, no duplicamos

  await supabase.rpc("ajustar_progreso", {
    p_estudiante_id: estudianteId, p_delta_xp: prog.recompensa_xp || 0,
    p_delta_vida: prog.recompensa_vida || 0, p_delta_monedas: prog.recompensa_monedas || 0,
  });
  await registrarHistorialGamificacion(estudianteId, {
    etiqueta: `🎯 Aprobaste: ${prog.nombre}`,
    xp: prog.recompensa_xp || 0, vida: prog.recompensa_vida || 0, monedas: prog.recompensa_monedas || 0,
    categoria: "academico",
  });
}

// Guarda una observación para una celda de la Planilla que YA tiene nota
// puesta (no crea la fila si no existía antes).
export async function setObservacionValor(actividadId, estudianteId, observacion) {
  const { error } = await supabase.from("notas_valores").update({ observacion: observacion || null }).eq("actividad_id", actividadId).eq("estudiante_id", estudianteId);
  if (error) throw error;
}

// Deja registro de un punto bueno/malo (XP, vida y/o monedas) en el
// historial de gamificación — usado desde Acciones Masivas, la Ruleta de
// Monedas, y la asistencia, para que el estudiante después pueda ver por
// qué le dieron o le quitaron puntos.
export async function registrarHistorialGamificacion(estudianteId, { etiqueta, xp = 0, vida = 0, monedas = 0, categoria = "general" }) {
  const { error } = await supabase.from("historial_gamificacion").insert({ estudiante_id: estudianteId, etiqueta, xp, vida, monedas, categoria });
  if (error) throw error;
}

export async function registrarHistorialGamificacionMasivo(estudianteIds, campos) {
  const filas = estudianteIds.map((id) => ({ estudiante_id: id, categoria: "general", xp: 0, vida: 0, monedas: 0, ...campos }));
  const { error } = await supabase.from("historial_gamificacion").insert(filas);
  if (error) throw error;
}

export async function fetchHistorialGamificacion(estudianteId) {
  const { data, error } = await supabase.from("historial_gamificacion").select("*").eq("estudiante_id", estudianteId).order("ts", { ascending: false });
  if (error) throw error;
  return data || [];
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

// Control transversal: notas finales de un grado en TODAS las materias
// (de todos los docentes), para un periodo dado (o todos si periodo es null).
export async function fetchNotasFinalesTransversal(gradoId, periodo = null) {
  const estudiantes = await fetchEstudiantesPorGrado(gradoId);
  const ids = estudiantes.map((e) => e.id);
  if (ids.length === 0) return { estudiantes: [], materias: [], notas: {} };

  let query = supabase.from("notas_finales_periodo").select("*, materias(nombre, profesores(nombre))").in("estudiante_id", ids);
  if (periodo) query = query.eq("periodo", periodo);
  const { data, error } = await query;
  if (error) throw error;

  const materiasMap = {};
  const notas = {};
  (data || []).forEach((n) => {
    if (!materiasMap[n.materia_id]) {
      materiasMap[n.materia_id] = { id: n.materia_id, nombre: n.materias?.nombre || `Materia ${n.materia_id}`, docente: n.materias?.profesores?.nombre || null };
    }
    notas[n.estudiante_id] = notas[n.estudiante_id] || {};
    // Si hay varios periodos y no se filtró uno específico, se guarda el promedio simple de los periodos disponibles
    const anterior = notas[n.estudiante_id][n.materia_id];
    notas[n.estudiante_id][n.materia_id] = anterior !== undefined ? { suma: anterior.suma + n.nota, n: anterior.n + 1 } : { suma: n.nota, n: 1 };
  });

  const materias = Object.values(materiasMap).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const notasFinales = {};
  Object.entries(notas).forEach(([estId, porMateria]) => {
    notasFinales[estId] = {};
    Object.entries(porMateria).forEach(([matId, v]) => { notasFinales[estId][matId] = Math.round((v.suma / v.n) * 10) / 10; });
  });

  return { estudiantes, materias, notas: notasFinales };
}

export async function guardarNotaFinal(materiaId, estudianteId, periodo, nota) {
  const { error } = await supabase.from("notas_finales_periodo").upsert(
    { materia_id: materiaId, estudiante_id: estudianteId, periodo, nota },
    { onConflict: "materia_id,estudiante_id,periodo" }
  );
  if (error) throw error;
}

// A diferencia de guardarNotaFinal(..., null) —que deja la fila con nota vacía y
// sigue contando como "cerrado"— esto borra la fila por completo, así el periodo
// vuelve a calcularse en vivo a partir de las actividades cargadas.
export async function eliminarNotaFinalPeriodo(materiaId, estudianteId, periodo) {
  const { error } = await supabase.from("notas_finales_periodo").delete()
    .eq("materia_id", materiaId).eq("estudiante_id", estudianteId).eq("periodo", periodo);
  if (error) throw error;
}

export async function fetchNivelacion(materiaId) {
  const { data, error } = await supabase.from("nivelacion").select("*").eq("materia_id", materiaId);
  if (error) throw error;
  return data || [];
}

export async function setNivelacion(materiaId, estudianteId, periodo, estado, notaOriginal) {
  if (!estado) {
    const { error } = await supabase.from("nivelacion").delete().eq("materia_id", materiaId).eq("estudiante_id", estudianteId).eq("periodo", periodo);
    if (error) throw error;
    return;
  }
  const payload = { materia_id: materiaId, estudiante_id: estudianteId, periodo, estado };
  if (notaOriginal !== undefined) payload.nota_original = notaOriginal;
  const { error } = await supabase.from("nivelacion").upsert(
    payload,
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
// Totales de asistencia INSTITUCIONAL (sin materia, materia_id = null) de
// un curso puntual, en un rango de fechas — para el reporte de Dirección
// de Curso, sin mezclar con la asistencia de clase de otros docentes.
// Listado detallado (fila por fila, con materia) de la asistencia de un
// curso en un rango de fechas — para poder ver y borrar registros puntuales
// que hayan quedado mal cargados (mezclados entre materias, duplicados, etc.).
export async function fetchAsistenciaDetalladaCurso(gradoId, fechaDesde, fechaHasta) {
  const estudiantes = await fetchEstudiantesPorGrado(gradoId);
  const ids = estudiantes.map((e) => e.id);
  if (ids.length === 0) return [];
  const nombrePorId = {}; estudiantes.forEach((e) => { nombrePorId[e.id] = e.nombre; });

  let query = supabase.from("asistencia").select("estudiante_id, fecha, codigo, materia_id").in("estudiante_id", ids);
  if (fechaDesde) query = query.gte("fecha", fechaDesde);
  if (fechaHasta) query = query.lte("fecha", fechaHasta);
  const { data, error } = await query.order("fecha", { ascending: false });
  if (error) throw error;

  const materias = await fetchMaterias();
  const nombreMateriaPorId = {}; materias.forEach((m) => { nombreMateriaPorId[m.id] = m.nombre; });

  // No hay columna "id" en esta tabla — su identificador real es
  // estudiante+fecha+materia, así que armamos una clave sintética con eso
  // para usar como key de lista y para poder borrar la fila correcta.
  return (data || []).map((r) => ({
    ...r,
    id: `${r.estudiante_id}_${r.fecha}_${r.materia_id ?? "null"}`,
    estudianteNombre: nombrePorId[r.estudiante_id] || `Estudiante ${r.estudiante_id}`,
    materiaNombre: r.materia_id ? (nombreMateriaPorId[r.materia_id] || `Materia ${r.materia_id}`) : "— Sin materia (antiguo) —",
  }));
}

export async function fetchTotalesAsistenciaInstitucionalCurso(gradoId, fechaDesde, fechaHasta, materiaId = null) {
  const estudiantes = await fetchEstudiantesPorGrado(gradoId);
  const ids = estudiantes.map((e) => e.id);
  if (ids.length === 0) return [];

  let query = supabase.from("asistencia").select("estudiante_id, codigo, fecha").in("estudiante_id", ids);
  query = materiaId ? query.eq("materia_id", materiaId) : query.is("materia_id", null);
  if (fechaDesde) query = query.gte("fecha", fechaDesde);
  if (fechaHasta) query = query.lte("fecha", fechaHasta);
  const { data: registros, error } = await query;
  if (error) throw error;

  const totales = {};
  estudiantes.forEach((e) => { totales[e.id] = { estudianteId: e.id, nombre: e.nombre, P: 0, R: 0, FI: 0, FJ: 0, total: 0 }; });
  (registros || []).forEach((r) => {
    if (!totales[r.estudiante_id]) return;
    totales[r.estudiante_id][r.codigo] = (totales[r.estudiante_id][r.codigo] || 0) + 1;
    totales[r.estudiante_id].total += 1;
  });

  return ordenarPorApellido(Object.values(totales));
}

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

// Cache simple en memoria del catálogo de asistencia, para no consultarlo en
// cada marca de asistencia (se recarga en cada sesión/recarga de página).
let _catalogoAsistenciaCache = null;
const LABEL_CODIGO_ASISTENCIA = { P: "Presente", R: "Retardo", FI: "Falta injustificada", FJ: "Falta justificada" };

async function efectoDeCodigoAsistencia(codigo) {
  if (!_catalogoAsistenciaCache) {
    const { data } = await supabase.from("acciones_gamificacion").select("*").eq("tab", "asistencia").eq("activo", true);
    _catalogoAsistenciaCache = data || [];
  }
  const fila = _catalogoAsistenciaCache.find((a) => a.codigo_asistencia === codigo);
  return fila ? { xp: fila.xp, vida: fila.vida } : { xp: 0, vida: 0 };
}

export async function marcarAsistencia(estudianteId, fecha, codigo, observacion, materiaId = null) {
  const { data: userData } = await supabase.auth.getUser();

  // Si ya había una marca previa para este día, revierte su efecto de
  // gamificación antes de aplicar el nuevo (evita que se acumule al corregir).
  // La tabla "asistencia" no tiene una columna "id" propia — su identificador
  // real es la combinación estudiante+fecha+materia, así que la usamos tal
  // cual, tanto para buscar como para actualizar. Se usa un select común (no
  // .maybeSingle()) porque, si quedaron filas duplicadas de antes, esa
  // función se rompe al encontrar más de una — acá simplemente se limpian
  // las de más y se sigue con una sola.
  let queryPrevia = supabase.from("asistencia").select("xp_aplicado, vida_aplicada").eq("estudiante_id", estudianteId).eq("fecha", fecha);
  queryPrevia = materiaId ? queryPrevia.eq("materia_id", materiaId) : queryPrevia.is("materia_id", null);
  const { data: previas, error: errorPrevia } = await queryPrevia;
  if (errorPrevia) throw errorPrevia;

  if (previas && previas.length > 1) {
    // Había duplicados de antes — se borran todos, se revierte el efecto
    // de cada uno, y se sigue como si no hubiera existido ninguno.
    for (const p of previas) {
      if (p.xp_aplicado) await ajustarXp(estudianteId, -p.xp_aplicado);
      if (p.vida_aplicada) await ajustarVida(estudianteId, -p.vida_aplicada);
    }
    let queryLimpiar = supabase.from("asistencia").delete().eq("estudiante_id", estudianteId).eq("fecha", fecha);
    queryLimpiar = materiaId ? queryLimpiar.eq("materia_id", materiaId) : queryLimpiar.is("materia_id", null);
    await queryLimpiar;
  }
  const previa = previas && previas.length === 1 ? previas[0] : null;
  if (previa && (previa.xp_aplicado || previa.vida_aplicada)) {
    if (previa.xp_aplicado) await ajustarXp(estudianteId, -previa.xp_aplicado);
    if (previa.vida_aplicada) await ajustarVida(estudianteId, -previa.vida_aplicada);
  }

  const efecto = await efectoDeCodigoAsistencia(codigo);
  const campos = { estudiante_id: estudianteId, fecha, codigo, observacion: observacion || null, materia_id: materiaId, docente_id: userData?.user?.id || null, xp_aplicado: efecto.xp, vida_aplicada: efecto.vida };

  // Actualiza o inserta a mano según si ya existía una fila — no se puede
  // confiar en upsert/onConflict acá porque, cuando materia_id es NULL
  // (asistencia general, sin materia), Postgres no trata dos NULL como
  // iguales y terminaría insertando una fila nueva cada vez en vez de
  // corregir la existente (eso duplicaba los conteos en los reportes).
  if (previa) {
    let queryUpdate = supabase.from("asistencia").update(campos).eq("estudiante_id", estudianteId).eq("fecha", fecha);
    queryUpdate = materiaId ? queryUpdate.eq("materia_id", materiaId) : queryUpdate.is("materia_id", null);
    const { error } = await queryUpdate;
    if (error) throw error;
  } else {
    const { error } = await supabase.from("asistencia").insert(campos);
    if (error) throw error;
  }

  if (efecto.xp) await ajustarXp(estudianteId, efecto.xp);
  if (efecto.vida) await ajustarVida(estudianteId, efecto.vida);
  if (efecto.xp || efecto.vida) {
    await registrarHistorialGamificacion(estudianteId, {
      etiqueta: `Asistencia: ${LABEL_CODIGO_ASISTENCIA[codigo] || codigo} (${fecha})`,
      xp: efecto.xp || 0, vida: efecto.vida || 0, categoria: "asistencia",
    });
  }
}

export async function quitarAsistencia(estudianteId, fecha, materiaId = null) {
  let queryPrevia = supabase.from("asistencia").select("xp_aplicado, vida_aplicada").eq("estudiante_id", estudianteId).eq("fecha", fecha);
  queryPrevia = materiaId ? queryPrevia.eq("materia_id", materiaId) : queryPrevia.is("materia_id", null);
  const { data: previa } = await queryPrevia.maybeSingle();

  let query = supabase.from("asistencia").delete().eq("estudiante_id", estudianteId).eq("fecha", fecha);
  query = materiaId ? query.eq("materia_id", materiaId) : query.is("materia_id", null);
  const { error } = await query;
  if (error) throw error;

  if (previa && (previa.xp_aplicado || previa.vida_aplicada)) {
    if (previa.xp_aplicado) await ajustarXp(estudianteId, -previa.xp_aplicado);
    if (previa.vida_aplicada) await ajustarVida(estudianteId, -previa.vida_aplicada);
  }
}

// Totales de asistencia agrupados por grado (para comparar entre cursos de
// un vistazo), opcionalmente acotado a un rango de fechas.
export async function fetchTotalesAsistenciaPorGrado(fechaDesde, fechaHasta, materiaId = null) {
  let query = supabase.from("asistencia").select("estudiante_id, codigo");
  if (fechaDesde) query = query.gte("fecha", fechaDesde);
  if (fechaHasta) query = query.lte("fecha", fechaHasta);
  if (materiaId) query = query.eq("materia_id", materiaId);
  const { data: registros, error } = await query;
  if (error) throw error;

  const { data: estudiantes, error: e2 } = await supabase.from("estudiantes").select("id, grado_id");
  if (e2) throw e2;
  const gradoPorEstudiante = {}; (estudiantes || []).forEach((e) => { gradoPorEstudiante[e.id] = e.grado_id; });

  const totales = {};
  (registros || []).forEach((r) => {
    const grado = gradoPorEstudiante[r.estudiante_id];
    if (!grado) return;
    totales[grado] = totales[grado] || { grado, P: 0, R: 0, FI: 0, FJ: 0, total: 0 };
    totales[grado][r.codigo] = (totales[grado][r.codigo] || 0) + 1;
    totales[grado].total += 1;
  });

  return Object.values(totales).sort((a, b) => a.grado.localeCompare(b.grado, undefined, { numeric: true }));
}

// Igual que fetchTotalesAsistenciaPorGrado, pero desglosado por estudiante
// (agrupado/ordenado por grado) en vez de solo el total agregado del grado.
export async function fetchTotalesAsistenciaPorEstudiante(fechaDesde, fechaHasta, materiaId = null) {
  let query = supabase.from("asistencia").select("estudiante_id, codigo");
  if (fechaDesde) query = query.gte("fecha", fechaDesde);
  if (fechaHasta) query = query.lte("fecha", fechaHasta);
  if (materiaId) query = query.eq("materia_id", materiaId);
  const { data: registros, error } = await query;
  if (error) throw error;

  const { data: estudiantes, error: e2 } = await supabase.from("estudiantes").select("id, nombre, grado_id").eq("activo", true);
  if (e2) throw e2;

  const totales = {};
  (estudiantes || []).forEach((e) => {
    totales[e.id] = { estudianteId: e.id, nombre: e.nombre, grado: e.grado_id, P: 0, R: 0, FI: 0, FJ: 0, total: 0 };
  });
  (registros || []).forEach((r) => {
    if (!totales[r.estudiante_id]) return;
    totales[r.estudiante_id][r.codigo] = (totales[r.estudiante_id][r.codigo] || 0) + 1;
    totales[r.estudiante_id].total += 1;
  });

  return Object.values(totales).sort((a, b) => a.grado.localeCompare(b.grado, undefined, { numeric: true }) || a.nombre.localeCompare(b.nombre));
}

// Mueve registros de asistencia GENERAL (sin materia) hacia una materia
// puntual, en un rango de fechas — salta cualquiera que ya tenga un
// registro propio en esa materia/fecha, para no pisarlo ni duplicar.
export async function moverAsistenciaGeneralAMateria(gradoId, materiaId, fechaDesde, fechaHasta) {
  const estudiantes = await fetchEstudiantesPorGrado(gradoId);
  const ids = estudiantes.map((e) => e.id);
  if (ids.length === 0) return { movidos: 0, saltados: 0, detalleSaltados: [] };
  const nombrePorId = {}; estudiantes.forEach((e) => { nombrePorId[e.id] = e.nombre; });

  let queryGenerales = supabase.from("asistencia").select("estudiante_id, fecha").in("estudiante_id", ids).is("materia_id", null);
  if (fechaDesde) queryGenerales = queryGenerales.gte("fecha", fechaDesde);
  if (fechaHasta) queryGenerales = queryGenerales.lte("fecha", fechaHasta);
  const { data: generales, error: e1 } = await queryGenerales;
  if (e1) throw e1;
  if (!generales || generales.length === 0) return { movidos: 0, saltados: 0, detalleSaltados: [] };

  const { data: existentes, error: e2 } = await supabase.from("asistencia").select("estudiante_id, fecha")
    .in("estudiante_id", ids).eq("materia_id", materiaId)
    .in("fecha", Array.from(new Set(generales.map((g) => g.fecha))));
  if (e2) throw e2;
  const yaExiste = new Set((existentes || []).map((r) => `${r.estudiante_id}_${r.fecha}`));

  let movidos = 0;
  const detalleSaltados = [];
  for (const g of generales) {
    const clave = `${g.estudiante_id}_${g.fecha}`;
    if (yaExiste.has(clave)) { detalleSaltados.push(`${nombrePorId[g.estudiante_id] || g.estudiante_id} (${g.fecha}) — ya tenía un registro en esa materia`); continue; }
    const { error } = await supabase.from("asistencia").update({ materia_id: materiaId })
      .eq("estudiante_id", g.estudiante_id).eq("fecha", g.fecha).is("materia_id", null);
    if (error) { detalleSaltados.push(`${nombrePorId[g.estudiante_id] || g.estudiante_id} (${g.fecha}) — ${error.message}`); continue; }
    movidos++;
  }
  return { movidos, saltados: detalleSaltados.length, detalleSaltados };
}

export async function marcarTodosPresentes(estudianteIds, fecha, materiaId = null) {
  await Promise.all(estudianteIds.map((id) => marcarAsistencia(id, fecha, "P", null, materiaId)));
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
  const deltaMonedas = accion.xp > 0 ? 1 : 0;
  const [, rpcRes] = await Promise.all([
    supabase.from("historial_gamificacion").insert({
      estudiante_id: estudianteId, etiqueta: accion.label, xp: accion.xp, vida: accion.vida, monedas: deltaMonedas, categoria: accion.categoria,
    }),
    supabase.rpc("ajustar_progreso", { p_estudiante_id: estudianteId, p_delta_xp: accion.xp, p_delta_vida: accion.vida, p_delta_monedas: deltaMonedas }),
  ]);
  if (rpcRes.error) throw rpcRes.error;
  const fila = rpcRes.data?.[0];
  return { xp: fila?.xp ?? 0, vida: fila?.vida ?? 0, monedas: fila?.monedas ?? 0 };
}
