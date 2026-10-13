// Módulos de estudio · acceso a datos (docente y estudiante). La lógica de estados/candados vive en modulos.js
import { supabase } from "./supabaseClient";
import { gradoDeEstudiante, bonoEvento, aportarAComarca } from "./mundoApi";
import { estadoModulos, resumenPorMateria, esCorrecta, errorActividad, errorModulo, limpiarActividad, ordenarModulos } from "./modulos";

const lanzar = (error) => { if (error) { const e = new Error(error.message || "error"); e.code = error.code; throw e; } };
const faltaTabla = (e) => /does not exist|relation|schema cache/i.test((e && e.message) || "");
export const sinTablasModulos = faltaTabla;

async function leerTodo(tabla, orden = "id") {
  const todo = [];
  for (let d = 0; ; d += 1000) {
    const { data, error } = await supabase.from(tabla).select("*").order(orden).range(d, d + 999); lanzar(error);
    todo.push(...(data || [])); if (!data || data.length < 1000) break;
  }
  return todo;
}
export async function fetchMateriasModulos() {
  const { data, error } = await supabase.from("materias").select("id,nombre").order("nombre"); return error ? [] : data || [];
}

// ============================ DOCENTE ============================
// → { modulos, actividades, materias, cierres: { [moduloId]: cuántos estudiantes lo completaron } }
export async function fetchModulosAdmin() {
  const [modulos, actividades, materias, cier] = await Promise.all([leerTodo("modulos"), leerTodo("modulo_actividades"), fetchMateriasModulos(), leerTodo("modulo_cierres").catch(() => [])]);
  const cierres = {}; cier.forEach((c) => { cierres[c.modulo_id] = (cierres[c.modulo_id] || 0) + 1; });
  actividades.sort((a, b) => a.orden - b.orden || a.id - b.id);
  return { modulos: ordenarModulos(modulos), actividades, materias, cierres };
}
const camposModulo = (m, docente_id) => ({ materia_id: m.materia_id ? Number(m.materia_id) : null, grado_id: String(m.grado_id || ""), numero: Number(m.numero), nombre: String(m.nombre).trim(), descripcion: String(m.descripcion || "").trim().slice(0, 600), emoji: String(m.emoji || "📘").trim() || "📘", xp: Number(m.xp), oro: Number(m.oro), libre: !!m.libre, activo: m.activo !== false, ...(docente_id ? { docente_id } : {}) });
export async function guardarModulo(m) {
  const e = errorModulo(m); if (e) throw new Error(e);
  if (m.id) { const { error } = await supabase.from("modulos").update(camposModulo(m)).eq("id", m.id); lanzar(error); return m.id; }
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("modulos").insert(camposModulo(m, u?.user?.id || null)).select("id"); lanzar(error);
  return data?.[0]?.id;
}
export async function alternarModulo(id, activo) { const { error } = await supabase.from("modulos").update({ activo: !!activo }).eq("id", id); lanzar(error); }
export async function eliminarModulo(id) { const { error } = await supabase.from("modulos").delete().eq("id", id); lanzar(error); }
// siguiente número libre en una materia (para sugerirlo al crear)
export const siguienteNumero = (modulos, materiaId) => 1 + Math.max(0, ...modulos.filter((m) => (m.materia_id ?? null) === (materiaId ? Number(materiaId) : null)).map((m) => m.numero));

export async function guardarActividad(moduloId, a, siguienteOrden = 1) {
  const e = errorActividad(a); if (e) throw new Error(e);
  const l = limpiarActividad(a), campos = { tipo: l.tipo, titulo: l.titulo, contenido: l.contenido, opciones: l.opciones, correcta: l.correcta, activa: a.activa !== false };
  if (a.id) { const { error } = await supabase.from("modulo_actividades").update(campos).eq("id", a.id); lanzar(error); return a.id; }
  const { data, error } = await supabase.from("modulo_actividades").insert({ ...campos, modulo_id: moduloId, orden: siguienteOrden }).select("id"); lanzar(error);
  return data?.[0]?.id;
}
export async function eliminarActividad(id) { const { error } = await supabase.from("modulo_actividades").delete().eq("id", id); lanzar(error); }
export async function alternarActividad(id, activa) { const { error } = await supabase.from("modulo_actividades").update({ activa: !!activa }).eq("id", id); lanzar(error); }
// intercambia el orden con la vecina (delta = -1 sube, +1 baja). lista = actividades del módulo ya ordenadas
export async function moverActividad(lista, id, delta) {
  const i = lista.findIndex((a) => a.id === id), j = i + delta; if (i < 0 || j < 0 || j >= lista.length) return false;
  const a = lista[i], b = lista[j];
  // se renumera todo para no depender de que los "orden" estén bien
  const nuevo = lista.map((x, k) => ({ id: x.id, orden: k + 1 })); nuevo[i].orden = j + 1; nuevo[j].orden = i + 1;
  const cambios = nuevo.filter((n, k) => lista[k].orden !== n.orden);
  for (const c of cambios) { const { error } = await supabase.from("modulo_actividades").update({ orden: c.orden }).eq("id", c.id); lanzar(error); }
  return a.id !== b.id;
}

// ============================ ESTUDIANTE ============================
async function cargarParaEstudiante(estudianteId, gradoId) {
  const [grado, modulos, acts, av, cier, materias] = await Promise.all([
    gradoDeEstudiante(estudianteId, gradoId), leerTodo("modulos"), leerTodo("modulo_actividades"),
    supabase.from("modulo_avance").select("actividad_id,modulo_id").eq("estudiante_id", estudianteId),
    supabase.from("modulo_cierres").select("modulo_id,xp,oro").eq("estudiante_id", estudianteId), fetchMateriasModulos(),
  ]);
  lanzar(av.error); lanzar(cier.error);
  acts.sort((a, b) => a.orden - b.orden || a.id - b.id);
  const hechas = (av.data || []).map((x) => x.actividad_id), cierres = (cier.data || []).map((x) => x.modulo_id);
  return { grado, modulos, acts, hechas, cierres, materias };
}
// → { grado, estados, resumen } para la ruta de módulos del portal
export async function fetchModulosEstudiante(estudianteId, gradoId = null) {
  const d = await cargarParaEstudiante(estudianteId, gradoId);
  const estados = estadoModulos(d.modulos, d.acts, d.hechas, d.grado, d.cierres).map((e) => ({ ...e, materia_nombre: e.materia_id ? d.materias.find((m) => m.id === e.materia_id)?.nombre || "" : "General" }));
  return { grado: d.grado, estados, resumen: resumenPorMateria(estados, d.materias) };
}
// → { modulo (con estado), actividades: [{...,hecha}] } o { bloqueado: true }
export async function fetchModuloEstudiante(estudianteId, moduloId, gradoId = null) {
  const d = await cargarParaEstudiante(estudianteId, gradoId);
  const e = estadoModulos(d.modulos, d.acts, d.hechas, d.grado, d.cierres).find((x) => x.id === moduloId);
  if (!e) return { noExiste: true };
  if (e.estado === "bloqueado") return { bloqueado: true, modulo: e };
  const H = new Set(d.hechas);
  return { modulo: e, actividades: d.acts.filter((a) => a.modulo_id === moduloId && a.activa !== false).map((a) => ({ ...a, hecha: H.has(a.id) })) };
}

/**
 * El estudiante completa una actividad. Lectura/enlace/video: basta con marcarla. Pregunta: se manda { respuesta: índice }; si falla, no cuenta (puede reintentar).
 * Si con esa actividad se completa el módulo, se da el premio UNA sola vez.
 * → { ok, correcto?, yaEstaba?, moduloCompleto?, premio?, mensaje? }
 */
export async function completarActividad(estudianteId, actividadId, { respuesta = null } = {}, gradoId = null) {
  let d;
  try { d = await cargarParaEstudiante(estudianteId, gradoId); } catch (e) { return { ok: false, mensaje: e.message }; }
  const a = d.acts.find((x) => x.id === actividadId && x.activa !== false);
  if (!a) return { ok: false, mensaje: "Esa actividad ya no existe." };
  const estado = estadoModulos(d.modulos, d.acts, d.hechas, d.grado, d.cierres).find((x) => x.id === a.modulo_id);
  if (!estado) return { ok: false, mensaje: "Ese módulo no está disponible para tu curso." };
  if (estado.estado === "bloqueado") return { ok: false, mensaje: "Primero termina el módulo anterior." };
  const yaEstaba = d.hechas.includes(a.id);
  if (!yaEstaba) {
    if (a.tipo === "pregunta" && !esCorrecta(a, respuesta)) return { ok: true, correcto: false };
    const { error } = await supabase.from("modulo_avance").insert({ estudiante_id: estudianteId, actividad_id: a.id, modulo_id: a.modulo_id });
    if (error && !(error.code === "23505" || /duplicate|unique/i.test(error.message || ""))) return { ok: false, mensaje: error.message };
  }
  const res = { ok: true, correcto: a.tipo === "pregunta" ? true : undefined, yaEstaba: yaEstaba || undefined, moduloCompleto: false };
  const completo = estado.hechas + (yaEstaba ? 0 : 1) >= estado.total;
  if (completo) {
    res.moduloCompleto = true;
    // si el premio falló la vez anterior, volver a pulsar la actividad lo reintenta
    if (!d.cierres.includes(a.modulo_id)) {
      const premio = await cerrarModulo(estudianteId, estado, gradoId ?? d.grado);
      if (premio.error) return { ok: false, mensaje: premio.error, deshecho: true, moduloCompleto: false };
      res.premio = premio.premio; res.evento = premio.evento; res.comarca = premio.comarca; res.yaCerrado = premio.yaCerrado;
    }
  }
  return res;
}
async function cerrarModulo(estudianteId, m, grado) {
  const { error } = await supabase.from("modulo_cierres").insert({ estudiante_id: estudianteId, modulo_id: m.id, xp: 0, oro: 0 });
  if (error) { if (error.code === "23505" || /duplicate|unique/i.test(error.message || "")) return { yaCerrado: true, premio: { xp: 0, oro: 0 } }; return { error: error.message }; }
  const b = await bonoEvento(estudianteId, m.xp, m.oro, grado);
  try {
    if (b.xp > 0 || b.oro > 0) {
      const [, rpc] = await Promise.all([
        supabase.from("historial_gamificacion").insert({ estudiante_id: estudianteId, etiqueta: `📘 Módulo ${m.numero}: ${m.nombre}`, xp: b.xp, vida: 0, monedas: b.oro, categoria: "general" }),
        supabase.rpc("ajustar_progreso", { p_estudiante_id: estudianteId, p_delta_xp: b.xp, p_delta_vida: 0, p_delta_monedas: b.oro }),
      ]);
      if (rpc.error) throw rpc.error;
    }
    try { await supabase.from("modulo_cierres").update({ xp: b.xp, oro: b.oro }).eq("estudiante_id", estudianteId).eq("modulo_id", m.id); } catch { /* el detalle es secundario */ }
    return { premio: { xp: b.xp, oro: b.oro }, evento: b.evento, comarca: b.xp || b.oro ? await aportarAComarca(estudianteId, { xp: b.xp, oro: b.oro, motivo: `Módulo ${m.numero}: ${m.nombre}` }) : null };
  } catch (e) {
    await supabase.from("modulo_cierres").delete().eq("estudiante_id", estudianteId).eq("modulo_id", m.id);
    // la actividad queda hecha: al reintentar con la última actividad se vuelve a intentar el cierre
    return { error: (e && e.message) || "no se pudo entregar el premio" };
  }
}
