// Módulos de estudio · acceso a datos (docente y estudiante). La lógica de estados/candados vive en modulos.js
import { supabase } from "./supabaseClient";
import { gradoDeEstudiante, bonoEvento, aportarAComarca } from "./mundoApi";
import { estadoModulos, resumenPorMateria, esCorrecta, errorActividad, errorModulo, limpiarActividad, ordenarModulos } from "./modulos";
import { requeridos } from "./leccion";
import { misionVisiblePara } from "./gradosMundo";
import { planNotas, errorNotaModulo, nombreColumnaNota, textoResumenNotas } from "./notasModulo";

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
const camposModulo = (m, docente_id) => ({ materia_id: m.materia_id ? Number(m.materia_id) : null, grado_id: String(m.grado_id || ""), numero: Number(m.numero), nombre: String(m.nombre).trim(), descripcion: String(m.descripcion || "").trim().slice(0, 600), emoji: String(m.emoji || "📘").trim() || "📘", xp: Number(m.xp), oro: Number(m.oro), libre: !!m.libre, activo: m.activo !== false, ...camposNota(m), ...(docente_id ? { docente_id } : {}) });
// Los campos de nota solo se mandan si hacen falta (así nada se rompe si todavía no se corrió el SQL 82)
const camposNota = (m) => (m.nota_activa === true || (m.id && "nota_activa" in m)
  ? { nota_activa: !!m.nota_activa, nota_categoria_id: m.nota_activa && m.nota_categoria_id ? Number(m.nota_categoria_id) : null, nota_periodo: m.nota_activa ? String(m.nota_periodo ?? "") || null : null, nota_modo: m.nota_modo === "completo" ? "completo" : "proporcional", nota_nombre: String(m.nota_nombre || "").trim().slice(0, 120) || null, nota_auto: !!m.nota_activa && !!m.nota_auto }
  : {});
const errorSqlNota = (error) => { if (error && /nota_(activa|categoria|periodo|modo|nombre|auto)/i.test(error.message || "")) { const e = new Error("Falta ejecutar el archivo 82_modulos_nota.sql en Supabase para guardar notas desde los módulos."); throw e; } };
export async function guardarModulo(m) {
  const e = errorModulo(m); if (e) throw new Error(e);
  if (m.id) { const { error } = await supabase.from("modulos").update(camposModulo(m)).eq("id", m.id); errorSqlNota(error); lanzar(error); return m.id; }
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("modulos").insert(camposModulo(m, u?.user?.id || null)).select("id"); errorSqlNota(error); lanzar(error);
  return data?.[0]?.id;
}

// ---------- notas en la Planilla ----------
// Categorías y periodos de la materia (para el formulario del módulo)
export async function fetchOpcionesNota(materiaId) {
  const [c, cfg] = await Promise.all([supabase.from("notas_categorias").select("id,nombre,porcentaje").eq("materia_id", Number(materiaId)).order("id"), supabase.from("notas_config").select("*").eq("materia_id", Number(materiaId)).maybeSingle()]);
  lanzar(c.error);
  const config = cfg.data || { escala_min: 1, nota_maxima: 5, cantidad_periodos: 4 };
  const n = Math.max(1, parseInt(config.cantidad_periodos, 10) || 4);
  return { categorias: c.data || [], periodos: Array.from({ length: n }, (_, i) => String(i + 1)), config };
}
async function leerPaginado(tabla, cols, filtro) {
  const todo = [];
  for (let d = 0; ; d += 1000) {
    let q = supabase.from(tabla).select(cols); if (filtro) q = filtro(q);
    const { data, error } = await q.order("id").range(d, d + 999); lanzar(error);
    todo.push(...(data || [])); if (!data || data.length < 1000) break;
  }
  return todo;
}
/**
 * Escribe en la Planilla las notas del módulo (una columna por curso). Solo crea o sube notas, nunca baja una nota ya puesta.
 * → { ok, mensaje, resumen } · con { simular: true } solo calcula
 */
export async function sincronizarNotasModulo(moduloId, { simular = false } = {}) {
  const { data: m, error } = await supabase.from("modulos").select("*").eq("id", moduloId).maybeSingle(); lanzar(error);
  if (!m) return { ok: false, mensaje: "El módulo ya no existe." };
  if (!m.nota_activa) return { ok: false, mensaje: "Este módulo no está configurado para guardar nota." };
  const falla = errorNotaModulo(m); if (falla) return { ok: false, mensaje: falla };
  const [acts, avance, estudiantes, opciones] = await Promise.all([
    leerPaginado("modulo_actividades", "id,activa", (q) => q.eq("modulo_id", m.id)), leerPaginado("modulo_avance", "estudiante_id,actividad_id", (q) => q.eq("modulo_id", m.id)),
    leerPaginado("estudiantes", "id,nombre,grado_id,activo"), fetchOpcionesNota(m.materia_id),
  ]);
  if (!acts.some((a) => a.activa !== false)) return { ok: false, mensaje: "El módulo todavía no tiene actividades." };
  const nombre = nombreColumnaNota(m), periodo = String(m.nota_periodo);
  // notas que ya existen, por curso (cada curso tiene su propia columna)
  const cursos = [...new Set(estudiantes.map((e) => String(e.grado_id)))], existentes = {}, columnas = {};
  for (const g of cursos) {
    const { data: col } = await supabase.from("notas_actividades").select("id").eq("materia_id", m.materia_id).eq("grado_id", g).eq("periodo", periodo).eq("nombre", nombre).maybeSingle();
    if (col) { columnas[g] = col.id; const { data: vs } = await supabase.from("notas_valores").select("estudiante_id,valor").eq("actividad_id", col.id); (vs || []).forEach((v) => { existentes[v.estudiante_id] = v.valor; }); }
  }
  const plan = planNotas({ modulo: m, actividades: acts, estudiantes, avance, existentes, config: opciones.config });
  if (simular || !plan.filas.length) return { ok: true, resumen: plan.resumen, mensaje: textoResumenNotas(plan.resumen) };
  for (const g of [...new Set(plan.filas.map((f) => String(f.grado_id)))]) {
    if (!columnas[g]) {
      const { data, error: e1 } = await supabase.from("notas_actividades").insert({ nombre, categoria_id: m.nota_categoria_id, materia_id: m.materia_id, grado_id: g, periodo, es_automatica: false }).select("id"); lanzar(e1);
      columnas[g] = data?.[0]?.id;
    }
    for (const f of plan.filas.filter((x) => String(x.grado_id) === g)) { const { error: e2 } = await supabase.from("notas_valores").upsert({ actividad_id: columnas[g], estudiante_id: f.estudiante_id, valor: f.nota }, { onConflict: "actividad_id,estudiante_id" }); lanzar(e2); }
  }
  return { ok: true, resumen: plan.resumen, mensaje: textoResumenNotas(plan.resumen) };
}
// Los módulos marcados como "automático": se ponen al día al abrir el panel de módulos
export async function sincronizarNotasAutomaticas() {
  let lista = []; try { const { data } = await supabase.from("modulos").select("id,nota_activa,nota_auto,activo").eq("nota_auto", true); lista = (data || []).filter((m) => m.nota_activa && m.activo !== false); } catch { return { modulos: 0, notas: 0, errores: 0 }; }
  let notas = 0, errores = 0;
  for (const m of lista) { try { const r = await sincronizarNotasModulo(m.id); if (r.ok && r.resumen) notas += r.resumen.crear + r.resumen.subir; else if (!r.ok) errores++; } catch { errores++; } }
  return { modulos: lista.length, notas, errores };
}
export async function alternarModulo(id, activo) { const { error } = await supabase.from("modulos").update({ activo: !!activo }).eq("id", id); lanzar(error); }
export async function eliminarModulo(id) { const { error } = await supabase.from("modulos").delete().eq("id", id); lanzar(error); }
// siguiente número libre en una materia (para sugerirlo al crear)
export const siguienteNumero = (modulos, materiaId) => 1 + Math.max(0, ...modulos.filter((m) => (m.materia_id ?? null) === (materiaId ? Number(materiaId) : null)).map((m) => m.numero));

export async function guardarActividad(moduloId, a, siguienteOrden = 1) {
  const e = errorActividad(a); if (e) throw new Error(e);
  const l = limpiarActividad(a), campos = { tipo: l.tipo, titulo: l.titulo, contenido: l.contenido, opciones: l.opciones, correcta: l.correcta, activa: a.activa !== false, ...(l.tipo === "leccion" ? { bloques: l.bloques } : {}) };
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
  if (!yaEstaba && a.tipo === "leccion") {
    const falta = requeridos(a.bloques).reflexiones; // las reflexiones sí se pueden comprobar: tienen que estar guardadas
    if (falta.length) {
      const { data: rf, error: er } = await supabase.from("modulo_reflexiones").select("bloque_id").eq("estudiante_id", estudianteId).eq("actividad_id", a.id);
      if (er) return { ok: false, mensaje: er.message };
      const hay = new Set((rf || []).map((x) => x.bloque_id));
      if (falta.some((id) => !hay.has(id))) return { ok: true, correcto: false, faltaReflexion: true, mensaje: "Escribe y guarda tu reflexión para terminar la lección." };
    }
  }
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

// Crea los módulos que salieron de la respuesta de la IA (con sus actividades buenas). Si algo falla a la mitad, deshace ese módulo.
// modulos = salida de leerRespuestaIA().modulos (ya editados por la docente) · base = { materia_id, grado_id, libre }
// → { creados: [{id, nombre, actividades}], total actividades }
export async function crearModulosDesdeIA(modulos, base = {}, existentes = []) {
  const { data: u } = await supabase.auth.getUser();
  const docente_id = u?.user?.id || null;
  let numero = siguienteNumero(existentes, base.materia_id);
  const creados = []; let acts = 0;
  for (const m of modulos) {
    const buenas = m.actividades.filter((a) => !a.error);
    const e = errorModulo({ nombre: m.nombre, numero, xp: m.xp, oro: m.oro }); if (e) { const er = new Error(e); er.creados = creados; throw er; }
    const { data, error } = await supabase.from("modulos").insert(camposModulo({ ...base, numero, nombre: m.nombre, descripcion: m.descripcion, emoji: m.emoji, xp: m.xp, oro: m.oro, activo: base.activo !== false }, docente_id)).select("id");
    if (error || !data?.[0]) { const er = new Error(`No se pudo crear el módulo "${m.nombre}": ${error?.message || "sin respuesta"}`); er.creados = creados; throw er; }
    const id = data[0].id;
    if (buenas.length) {
      const filas = buenas.map((a, i) => { const l = limpiarActividad(a); return { modulo_id: id, orden: i + 1, tipo: l.tipo, titulo: l.titulo, contenido: l.contenido, opciones: l.opciones, correcta: l.correcta, activa: true, ...(l.tipo === "leccion" ? { bloques: l.bloques } : {}) }; });
      const { error: e2 } = await supabase.from("modulo_actividades").insert(filas);
      if (e2) { await supabase.from("modulos").delete().eq("id", id); const er = new Error(`No se pudieron guardar las actividades de "${m.nombre}": ${e2.message}`); er.creados = creados; throw er; }
    }
    creados.push({ id, nombre: m.nombre, actividades: buenas.length }); acts += buenas.length; numero++;
  }
  return { creados, actividades: acts };
}

// ============================ REFLEXIONES ============================
// El estudiante guarda (o corrige) lo que escribió en un bloque de reflexión
export async function guardarReflexion(estudianteId, actividadId, bloqueId, texto) {
  const t = String(texto ?? "").trim();
  if (!t) return { ok: false, mensaje: "Escribe algo antes de guardar." };
  if (t.length > 2000) return { ok: false, mensaje: "Tu reflexión es muy larga (máximo 2000 letras)." };
  const { error } = await supabase.from("modulo_reflexiones").upsert({ estudiante_id: estudianteId, actividad_id: actividadId, bloque_id: String(bloqueId), texto: t, actualizado_en: new Date().toISOString() }, { onConflict: "estudiante_id,actividad_id,bloque_id" });
  return error ? { ok: false, mensaje: error.message } : { ok: true };
}
// → { [bloqueId]: texto }
export async function fetchReflexiones(estudianteId, actividadId) {
  const { data, error } = await supabase.from("modulo_reflexiones").select("bloque_id,texto").eq("estudiante_id", estudianteId).eq("actividad_id", actividadId);
  if (error) return {};
  const o = {}; (data || []).forEach((r) => (o[r.bloque_id] = r.texto)); return o;
}
// Para la docente: lo que escribió cada estudiante en una lección → [{ estudiante_id, nombre, bloque_id, texto, actualizado_en }]
export async function fetchReflexionesAdmin(actividadId) {
  const { data, error } = await supabase.from("modulo_reflexiones").select("*").eq("actividad_id", actividadId); lanzar(error);
  const filas = data || []; if (!filas.length) return [];
  const ids = [...new Set(filas.map((f) => f.estudiante_id))];
  const { data: es } = await supabase.from("estudiantes").select("id,nombre").in("id", ids);
  const nom = new Map((es || []).map((e) => [e.id, e.nombre]));
  return filas.map((f) => ({ ...f, nombre: nom.get(f.estudiante_id) || `Estudiante ${f.estudiante_id}` })).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
}

// Para la docente: quién desarrolló un módulo → [{ estudiante_id, nombre, grado_id, hechas, total, estado, ultimo }]
// estado: "completo" | "proceso" | "nada". Incluye a los estudiantes que aún no empiezan.
export async function fetchEntregasModulo(modulo) {
  const [acts, avance, ests, cierres] = await Promise.all([
    leerPaginado("modulo_actividades", "id,activa", (q) => q.eq("modulo_id", modulo.id)),
    leerPaginado("modulo_avance", "id,estudiante_id,actividad_id,hecho_en", (q) => q.eq("modulo_id", modulo.id)),
    leerPaginado("estudiantes", "id,nombre,grado_id,activo"),
    supabase.from("modulo_cierres").select("estudiante_id").eq("modulo_id", modulo.id).then((r) => r.data || []),
  ]);
  const ids = new Set(acts.filter((a) => a.activa !== false).map((a) => Number(a.id)));
  const por = new Map();
  avance.forEach((r) => {
    if (!ids.has(Number(r.actividad_id))) return;
    const k = Number(r.estudiante_id); const o = por.get(k) || { n: new Set(), ult: null };
    o.n.add(Number(r.actividad_id)); if (r.hecho_en && (!o.ult || r.hecho_en > o.ult)) o.ult = r.hecho_en; por.set(k, o);
  });
  const cerrado = new Set(cierres.map((c) => Number(c.estudiante_id)));
  const total = ids.size;
  return ests.filter((e) => e.activo !== false && e.activo !== 0 && misionVisiblePara(modulo.grado_id || "", e.grado_id)).map((e) => {
    const o = por.get(Number(e.id)); const hechas = o ? o.n.size : 0;
    const estado = (total > 0 && hechas >= total) || cerrado.has(Number(e.id)) ? "completo" : hechas > 0 ? "proceso" : "nada";
    return { estudiante_id: e.id, nombre: e.nombre || `Estudiante ${e.id}`, grado_id: String(e.grado_id ?? ""), hechas, total, estado, ultimo: o?.ult || null };
  }).sort((a, b) => a.grado_id.localeCompare(b.grado_id, "es", { numeric: true }) || String(a.nombre).localeCompare(String(b.nombre), "es"));
}
