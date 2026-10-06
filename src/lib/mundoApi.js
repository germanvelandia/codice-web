import { supabase } from "./supabaseClient";
import { zonaDeMision, ZONAS, RETADORES } from "../game/zonas";
import { misionVisiblePara } from "./gradosMundo";

// Todo lo que el Mundo CÓDICE necesita de la base de datos: las misiones del mundo, cuáles
// ya completó cada estudiante, y entregar el premio (XP y monedas) al completarlas.

// Misiones de ejemplo: se usan SOLO si todavía no se corrió el SQL 62 (el mundo funciona
// en "modo prueba": se puede jugar, pero no se guarda nada ni se entregan premios).
export const MISIONES_EJEMPLO = [
  { id: 1, lugar: "biblioteca", npc_nombre: "La bibliotecaria", titulo: "La regla de oro", texto: "Muchas tradiciones comparten una idea: tratar a los demás como querríamos que nos traten. ¿Cuál de estas acciones la practica?", opciones: ["Burlarme del compañero que se equivocó", "Ayudar al compañero que no entendió el tema", "Copiarme de otro y no decir nada"], correcta: 1, pista: "Piensa: ¿cómo te gustaría que te trataran si fueras tú el que no entendió?", retro: "¡Exacto! Ayudar a otros es poner en práctica la regla de oro.", xp: 20, oro: 5 },
  { id: 2, lugar: "agora", npc_nombre: "El guardián del Ágora", titulo: "El dilema del patio", texto: "En el descanso ves que un compañero nuevo está comiendo solo, sin nadie con quien hablar. ¿Qué haces?", opciones: ["Lo invito a sentarse con mi grupo", "Hago como que no lo vi", "Les cuento a todos que está solo"], correcta: 0, pista: "Un gesto pequeño puede cambiarle el día a alguien.", retro: "¡Muy bien! La empatía empieza con un gesto sencillo.", xp: 20, oro: 5 },
  { id: 3, lugar: "templo", npc_nombre: "La guía del Templo", titulo: "La fuente de la gratitud", texto: "Hoy hablamos de gratitud. ¿Cuál de estas frases la expresa mejor?", opciones: ["Gracias por ayudarme con la tarea, me sirvió mucho", "Siempre quiero más de lo que tengo", "No me debían nada, así que no hay nada que agradecer"], correcta: 0, pista: "Gratitud es reconocer lo que otros hacen por ti.", retro: "¡Así es! Agradecer fortalece los vínculos.", xp: 15, oro: 5 },
  { id: 4, lugar: "mercado", npc_nombre: "El mercader", titulo: "Las cuentas del Códice", texto: "En la tienda de piezas, una 🧥 Capa cuesta 40 monedas y tú tienes 28. ¿Cuántas monedas te faltan para comprarla?", opciones: ["18", "12", "8"], correcta: 1, pista: "Resta: 40 − 28.", retro: "¡Correcto! Te faltan 12 monedas.", xp: 15, oro: 10 },
  { id: 5, lugar: "plaza", npc_nombre: "El sabio de la fuente", titulo: "El acertijo del sabio", texto: "«Entre más lo compartes, más grande se hace. ¿Qué es?»", opciones: ["Una moneda", "El conocimiento", "Un pastel"], correcta: 1, pista: "Si lo enseñas, tú también lo sigues teniendo.", retro: "¡Sabia respuesta! El conocimiento crece al compartirlo.", xp: 20, oro: 5 },
];

// Deja cada misión en la forma que entiende el juego (las opciones pueden venir como lista o como texto).
function normalizarMision(m) {
  let opciones = m.opciones;
  if (typeof opciones === "string") { try { opciones = JSON.parse(opciones); } catch (e) { opciones = []; } }
  return {
    id: m.id, lugar: m.lugar || "plaza", npc_nombre: m.npc_nombre || "Aldeano", npc_emoji: m.npc_emoji || null, npc_sprite: m.npc_sprite || null,
    titulo: m.titulo || "Misión", texto: m.texto || "", opciones: Array.isArray(opciones) ? opciones.map(String) : [],
    correcta: Number(m.correcta) || 0, pista: m.pista || "", retro: m.retro || "", xp: Number(m.xp) || 0, oro: Number(m.oro) || 0,
    grado_id: m.grado_id ? String(m.grado_id) : null,                     // null = para todos los cursos
    zona: zonaDeMision(m),                                                 // en qué zona está (si no existe la columna, se deduce del lugar)
    _tieneZona: Object.prototype.hasOwnProperty.call(m, "zona"),           // false si todavía no se corrió el SQL 64
    _tieneGrado: Object.prototype.hasOwnProperty.call(m, "grado_id"),     // false si todavía no se corrió el SQL 63
  };
}

// Las misiones que ve un estudiante: las de su curso más las que son para todos los cursos.
// (Si todavía no se corrió el SQL 63, la tabla no tiene curso y todas son para todos.)
export async function fetchMisionesMundo(gradoId) {
  const { data, error } = await supabase.from("mundo_misiones").select("*").eq("activo", true).order("orden").order("id");
  if (error) throw error;
  return (data || [])
    .filter((m) => gradoId != null ? misionVisiblePara(m.grado_id, gradoId) : !m.grado_id)   // para todos, para todo su nivel (octavo…) o para su curso
    .map(normalizarMision).filter((m) => m.opciones.length >= 2);
}

export async function fetchHechasMundo(estudianteId) {
  const { data, error } = await supabase.from("mundo_misiones_hechas").select("mision_id").eq("estudiante_id", estudianteId);
  if (error) throw error;
  return (data || []).map((f) => f.mision_id);
}

// Completa una misión: primero se registra (la clave única impide cobrar el premio dos veces) y
// después se entrega el premio. Si el premio falla, se deshace el registro para poder reintentar.
export async function completarMisionMundo(estudianteId, mision) {
  const { error } = await supabase.from("mundo_misiones_hechas").insert({ estudiante_id: estudianteId, mision_id: mision.id });
  if (error) {
    if (error.code === "23505") return { ok: true, yaEstaba: true }; // ya la tenía registrada (por ejemplo, desde otro dispositivo)
    return { ok: false, mensaje: error.message };
  }
  const xp = mision.xp || 0, oro = mision.oro || 0;
  try {
    const [, rpc] = await Promise.all([
      supabase.from("historial_gamificacion").insert({ estudiante_id: estudianteId, etiqueta: `🌍 Mundo: ${mision.titulo}`, xp, vida: 0, monedas: oro, categoria: "general" }),
      supabase.rpc("ajustar_progreso", { p_estudiante_id: estudianteId, p_delta_xp: xp, p_delta_vida: 0, p_delta_monedas: oro }),
    ]);
    if (rpc.error) throw rpc.error;
    const fila = rpc.data?.[0];
    return { ok: true, xp: fila?.xp, oro: fila?.monedas };
  } catch (e) {
    await supabase.from("mundo_misiones_hechas").delete().eq("estudiante_id", estudianteId).eq("mision_id", mision.id);
    return { ok: false, mensaje: (e && e.message) || "no se pudo entregar el premio" };
  }
}

// =====================================================================================
//  PARA EL DOCENTE: editar las misiones del mundo (se usa desde Estudiantes → Misiones del Mundo)
// =====================================================================================

// Todas las misiones, también las ocultas, con los campos que se editan.
export async function fetchMisionesMundoAdmin() {
  const { data, error } = await supabase.from("mundo_misiones").select("*").order("orden").order("id");
  if (error) throw error;
  return (data || []).map((m) => ({ ...normalizarMision(m), activo: m.activo !== false, orden: Number(m.orden) || 0 }));
}

export async function crearMisionMundo(campos) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("mundo_misiones").insert({ ...campos, docente_id: userData?.user?.id || null }).select().single();
  if (error) throw error;
  return data;
}

// Crea muchas misiones de una vez (para el Excel). Devuelve cuántas se crearon.
export async function crearMisionesMundo(lista) {
  const { data: userData } = await supabase.auth.getUser();
  const docente = userData?.user?.id || null; let creadas = 0;
  for (let i = 0; i < lista.length; i += 50) {
    const trozo = lista.slice(i, i + 50).map((c) => ({ ...c, docente_id: docente }));
    const { error } = await supabase.from("mundo_misiones").insert(trozo);
    if (error) { const e = new Error(error.message); e.creadas = creadas; throw e; }
    creadas += trozo.length;
  }
  return creadas;
}

export async function editarMisionMundo(id, campos) {
  const { error } = await supabase.from("mundo_misiones").update(campos).eq("id", id);
  if (error) throw error;
}

// Borrar una misión también borra el registro de quiénes la completaron (los premios ya entregados no se tocan).
export async function eliminarMisionMundo(id) {
  const { error } = await supabase.from("mundo_misiones").delete().eq("id", id);
  if (error) throw error;
}

// Cuántos estudiantes completaron cada misión: { [misionId]: cantidad }
export async function fetchConteoHechasMundo() {
  const { data, error } = await supabase.from("mundo_misiones_hechas").select("mision_id");
  if (error) throw error;
  const conteo = {}; (data || []).forEach((f) => { conteo[f.mision_id] = (conteo[f.mision_id] || 0) + 1; });
  return conteo;
}

// =====================================================================================
//  ZONAS DEL MUNDO: qué abrió la docente para cada curso y cuántas misiones se piden
// =====================================================================================

// Lo que necesita un estudiante: qué zonas abrió la docente para SU curso y el requisito de cada zona.
// Si todavía no se corrió el SQL 64 devuelve error (y el mundo se queda solo con la Aldea).
export async function fetchZonasMundo(gradoId) {
  const [cfg, ab] = await Promise.all([
    supabase.from("mundo_zonas_config").select("*"),
    gradoId == null ? Promise.resolve({ data: [], error: null }) : supabase.from("mundo_zonas_abiertas").select("*").eq("grado_id", String(gradoId)),
  ]);
  if (cfg.error) throw cfg.error;
  if (ab.error) throw ab.error;
  const requisitos = {}; (cfg.data || []).forEach((f) => { requisitos[f.zona] = Number(f.misiones_requeridas); });
  return { abiertas: (ab.data || []).filter((f) => f.abierta).map((f) => f.zona), requisitos };
}

// Para el editor de la docente: los requisitos y TODAS las aperturas por curso.
export async function fetchZonasAdmin() {
  const [cfg, ab] = await Promise.all([supabase.from("mundo_zonas_config").select("*"), supabase.from("mundo_zonas_abiertas").select("*")]);
  if (cfg.error) throw cfg.error;
  if (ab.error) throw ab.error;
  const requisitos = {}; (cfg.data || []).forEach((f) => { requisitos[f.zona] = Number(f.misiones_requeridas); });
  return { requisitos, abiertas: (ab.data || []).map((f) => ({ grado_id: String(f.grado_id), zona: f.zona, abierta: !!f.abierta })) };
}

export async function guardarRequisitoZona(zona, cantidad) {
  const { error } = await supabase.from("mundo_zonas_config").upsert({ zona, misiones_requeridas: cantidad }, { onConflict: "zona" });
  if (error) throw error;
}

export async function abrirZonaCurso(gradoId, zona, abierta) {
  const { error } = await supabase.from("mundo_zonas_abiertas").upsert({ grado_id: String(gradoId), zona, abierta }, { onConflict: "grado_id,zona" });
  if (error) throw error;
}

// =====================================================================================
//  LA POSADA DEL DESCANSO: se recupera vida a cambio de oro. La docente decide si está abierta,
//  cuánto cuesta y cuánta vida da. El descanso lo valida SIEMPRE la base de datos (no lo que cree el navegador).
// =====================================================================================
export const VIDA_MAX = 100;
// Valores por defecto de lo que se puede configurar (la docente los cambia desde el editor)
export const CONFIG_POSADA_DEFECTO = { posada_activa: 1, posada_costo: 15, posada_vida: 25 };

export async function fetchConfigMundo() {
  const { data, error } = await supabase.from("mundo_config").select("*");
  if (error) throw error;
  const cfg = { ...CONFIG_POSADA_DEFECTO, ...CONFIG_DUELO_DEFECTO, ...CONFIG_RETO_DEFECTO };
  (data || []).forEach((f) => { if (f.clave in cfg && Number.isFinite(Number(f.valor))) cfg[f.clave] = Number(f.valor); });
  return cfg;
}

export async function guardarConfigMundo(clave, valor) {
  const { error } = await supabase.from("mundo_config").upsert({ clave, valor }, { onConflict: "clave" });
  if (error) throw error;
}

// Lo que necesita el juego: { activa, costo, vida }. Si todavía no existe la tabla (SQL 65), la posada queda cerrada.
export async function fetchPosadaMundo() {
  try { const c = await fetchConfigMundo(); return { activa: c.posada_activa === 1, costo: c.posada_costo, vida: Math.max(1, c.posada_vida) }; }
  catch { return { activa: false, costo: CONFIG_POSADA_DEFECTO.posada_costo, vida: CONFIG_POSADA_DEFECTO.posada_vida }; }
}

// Cuánta vida se recupera y cuánto cuesta para alguien que tiene "vida" (si le falta poco, paga proporcional).
export function planDeDescanso(vida, cfg) {
  const falta = Math.max(0, VIDA_MAX - vida), porUso = Math.max(1, cfg.vida), restaura = Math.min(porUso, falta);
  return { falta, restaura, costo: Math.ceil((cfg.costo * restaura) / porUso) };
}

export async function descansarEnPosada(estudianteId) {
  const c = await fetchConfigMundo();
  if (c.posada_activa !== 1) return { ok: false, mensaje: "La posada está cerrada por ahora. ¡Vuelve pronto!" };
  const { data: prog, error: e1 } = await supabase.from("progreso").select("vida, monedas").eq("estudiante_id", estudianteId).maybeSingle();
  if (e1) throw e1;
  const vida = typeof prog?.vida === "number" ? prog.vida : VIDA_MAX, monedas = prog?.monedas || 0;
  const plan = planDeDescanso(vida, { costo: c.posada_costo, vida: c.posada_vida });
  if (plan.falta === 0) return { ok: false, vida, monedas, mensaje: "¡Te ves en plena forma! No necesitas descansar." };
  if (monedas < plan.costo) return { ok: false, vida, monedas, mensaje: `Descansar cuesta ${plan.costo} 🪙 y tienes ${monedas}. ¡Completa misiones para ganar más oro!` };
  // 1) se aplica el cambio (si falla, no se registra nada y se avisa)
  const { data, error } = await supabase.rpc("ajustar_progreso", { p_estudiante_id: estudianteId, p_delta_xp: 0, p_delta_vida: plan.restaura, p_delta_monedas: -plan.costo });
  if (error) throw error;
  const fila = data?.[0];
  // 2) queda en el historial (si esto falla no se deshace el descanso: ya se cobró y se recuperó)
  try { await supabase.from("historial_gamificacion").insert({ estudiante_id: estudianteId, etiqueta: "🛏️ Posada del Descanso", xp: 0, vida: plan.restaura, monedas: -plan.costo, categoria: "general" }); } catch { /* el historial es secundario */ }
  return { ok: true, vida: typeof fila?.vida === "number" ? fila.vida : vida + plan.restaura, monedas: typeof fila?.monedas === "number" ? fila.monedas : monedas - plan.costo, restaurado: plan.restaura, costo: plan.costo };
}

// =====================================================================================
//  DUELOS CON LOS GUARDIANES E INSIGNIAS
//  Cada zona tiene un Guardián. Al vencerlo por primera vez, el estudiante gana la insignia de la zona
//  (una sola vez) y un premio. Lo que vale lo decide siempre la base de datos, no el navegador.
// =====================================================================================
export const CONFIG_DUELO_DEFECTO = {
  duelo_activo: 1, duelo_aciertos: 4, duelo_vidas: 3, duelo_espera_min: 0, duelo_xp: 40, duelo_oro: 20,
  duelo_banco_aldea: 0, duelo_banco_bosque: 0, duelo_banco_montana: 0, duelo_banco_lago: 0,
  duelo_exige_aldea: 0, duelo_exige_bosque: 0, duelo_exige_montana: 0,
};

// Todo lo que necesita el juego para los duelos de UN estudiante. Si todavía no existen las tablas (SQL 66), falla
// y el mundo se queda sin Guardianes.
export async function fetchDuelosMundo(estudianteId) {
  const cfg = await fetchConfigMundo();
  const [ins, intentos] = await Promise.all([
    supabase.from("mundo_insignias").select("zona").eq("estudiante_id", estudianteId),
    supabase.from("mundo_duelos").select("zona, creado_en").eq("estudiante_id", estudianteId).eq("ganado", false).order("creado_en", { ascending: false }).limit(60),
  ]);
  if (ins.error) throw ins.error;
  const insignias = (ins.data || []).map((f) => f.zona);
  // espera tras perder: se cuenta desde la última derrota de cada zona
  const esperaHasta = {};
  if (cfg.duelo_espera_min > 0 && !intentos.error) {
    for (const f of intentos.data || []) { if (f.zona in esperaHasta) continue; const t = Date.parse(f.creado_en) + cfg.duelo_espera_min * 60000; esperaHasta[f.zona] = t > Date.now() ? t : 0; }
  }
  // preguntas extra: la categoría de Preguntados que la docente asignó a cada zona
  const bancos = {};
  await Promise.all(ZONAS.filter((z) => cfg[`duelo_banco_${z.key}`] > 0).map(async (z) => {
    const { data } = await supabase.from("trivia_preguntas").select("pregunta, opciones, correcta").eq("categoria_id", cfg[`duelo_banco_${z.key}`]).eq("activa", true).limit(80);
    bancos[z.key] = data || [];
  }));
  const exige = {}; ZONAS.forEach((z) => { exige[z.key] = cfg[`duelo_exige_${z.key}`] === 1; });
  return { activo: cfg.duelo_activo === 1, aciertos: Math.max(1, cfg.duelo_aciertos), vidas: Math.max(1, cfg.duelo_vidas), esperaMin: Math.max(0, cfg.duelo_espera_min), premio: { xp: cfg.duelo_xp, oro: cfg.duelo_oro }, exige, bancos, insignias, esperaHasta };
}

// Registra el resultado de un duelo.
//  - Perder: queda anotado (para la espera).
//  - Ganar: se otorga la insignia (única por estudiante y zona) y el premio SOLO la primera vez.
//    Si el premio falla, se deshace la insignia para poder reintentar (no se pierde nada).
export async function registrarDuelo(estudianteId, zona, { ganado, aciertos = 0, errores = 0 }) {
  try { await supabase.from("mundo_duelos").insert({ estudiante_id: estudianteId, zona, ganado: !!ganado, aciertos, errores }); } catch { /* el intento es secundario */ }
  if (!ganado) return { ok: true };
  const { error: eIns } = await supabase.from("mundo_insignias").insert({ estudiante_id: estudianteId, zona });
  if (eIns) {
    if (eIns.code === "23505" || /duplicate|unique/i.test(eIns.message || "")) return { ok: true, yaTenia: true }; // ya la tenía: sin premio doble
    throw eIns;
  }
  const cfg = await fetchConfigMundo(), xp = cfg.duelo_xp, oro = cfg.duelo_oro;
  if (xp || oro) {
    const { error } = await supabase.rpc("ajustar_progreso", { p_estudiante_id: estudianteId, p_delta_xp: xp, p_delta_vida: 0, p_delta_monedas: oro });
    if (error) { await supabase.from("mundo_insignias").delete().eq("estudiante_id", estudianteId).eq("zona", zona); throw error; }
    try { await supabase.from("historial_gamificacion").insert({ estudiante_id: estudianteId, etiqueta: `🏅 Insignia: ${(ZONAS.find((z) => z.key === zona) || {}).insignia?.nombre || zona}`, xp, vida: 0, monedas: oro, categoria: "general" }); } catch { /* el historial es secundario */ }
  }
  return { ok: true, xp, oro };
}

// ----- para el editor de la docente -----
// Las categorías de Preguntados con cuántas preguntas activas tienen.
export async function fetchCategoriasParaDuelo() {
  const [cats, pregs] = await Promise.all([
    supabase.from("trivia_categorias").select("id, nombre, emoji").eq("activa", true).order("id"),
    supabase.from("trivia_preguntas").select("categoria_id").eq("activa", true),
  ]);
  if (cats.error) throw cats.error;
  const cuenta = {}; (pregs.data || []).forEach((p) => { cuenta[p.categoria_id] = (cuenta[p.categoria_id] || 0) + 1; });
  return (cats.data || []).map((c) => ({ id: c.id, nombre: c.nombre, emoji: c.emoji || "❓", preguntas: cuenta[c.id] || 0 }));
}

// Cuántos estudiantes ganaron la insignia de cada zona: { zona: cantidad }
export async function fetchInsigniasResumen() {
  const { data, error } = await supabase.from("mundo_insignias").select("zona");
  if (error) throw error;
  const r = {}; (data || []).forEach((f) => { r[f.zona] = (r[f.zona] || 0) + 1; });
  return r;
}

// =====================================================================================
//  RETADORES: personajes hostiles con retos difíciles. Si el estudiante pierde, le quitan vida
//  (nunca por debajo de una vida mínima). Si gana, recibe un premio y el retador se va.
//  El daño y el premio los calcula SIEMPRE la base de datos, con la vida real del estudiante.
// =====================================================================================
export const CONFIG_RETO_DEFECTO = {
  reto_activo: 1, reto_danio: 15, reto_vida_min: 20, reto_aciertos: 3, reto_vidas: 2, reto_tiempo: 20, reto_espera_min: 5, reto_xp: 30, reto_oro: 15,
  reto_zona_bosque: 1, reto_zona_montana: 0, reto_zona_lago: 0, reto_banco_bosque: 0, reto_banco_montana: 0, reto_banco_lago: 0,
};

// Todo lo que necesita el juego para los retadores de UN estudiante. Si todavía no existe la tabla (SQL 67), falla y no hay retadores.
export async function fetchRetosMundo(estudianteId) {
  const cfg = await fetchConfigMundo();
  const { data, error } = await supabase.from("mundo_retos").select("enemigo, ganado, creado_en").eq("estudiante_id", estudianteId).order("creado_en", { ascending: false }).limit(400);
  if (error) throw error;
  const ganados = [...new Set((data || []).filter((f) => f.ganado).map((f) => f.enemigo))];
  const esperaHasta = {};
  if (cfg.reto_espera_min > 0) {
    for (const f of data || []) { if (f.ganado || f.enemigo in esperaHasta) continue; const t = Date.parse(f.creado_en) + cfg.reto_espera_min * 60000; esperaHasta[f.enemigo] = t > Date.now() ? t : 0; }
  }
  const zonas = {}, bancos = {};
  await Promise.all(ZONAS.filter((z) => (z.retadores || []).length).map(async (z) => {
    zonas[z.key] = cfg[`reto_zona_${z.key}`] === 1;
    if (zonas[z.key] && cfg[`reto_banco_${z.key}`] > 0) {
      const { data: preg } = await supabase.from("trivia_preguntas").select("pregunta, opciones, correcta").eq("categoria_id", cfg[`reto_banco_${z.key}`]).eq("activa", true).limit(80);
      bancos[z.key] = preg || [];
    }
  }));
  return { activo: cfg.reto_activo === 1, danio: Math.max(0, cfg.reto_danio), vidaMin: Math.max(0, cfg.reto_vida_min), aciertos: Math.max(1, cfg.reto_aciertos), vidas: Math.max(1, cfg.reto_vidas), tiempo: Math.max(0, cfg.reto_tiempo), espera: Math.max(0, cfg.reto_espera_min), premio: { xp: cfg.reto_xp, oro: cfg.reto_oro }, zonas, bancos, ganados, esperaHasta };
}

// Registra el resultado de un reto.
//  - Perder: se calcula el daño con la vida REAL (nunca por debajo de la vida mínima). Si no se puede aplicar, no se registra nada.
//  - Ganar: premio SOLO la primera vez; si el premio falla, se deshace la victoria para poder reintentar.
export async function registrarReto(estudianteId, { enemigo, zona, ganado, aciertos = 0, errores = 0 }) {
  const def = RETADORES.find((r) => r.id === enemigo);
  if (!def) throw new Error("Retador desconocido.");
  const cfg = await fetchConfigMundo();
  if (!ganado) {
    const { data: prog, error: e1 } = await supabase.from("progreso").select("vida").eq("estudiante_id", estudianteId).maybeSingle();
    if (e1) throw e1;
    const vida = typeof prog?.vida === "number" ? prog.vida : VIDA_MAX;
    const danio = Math.min(Math.max(0, cfg.reto_danio), Math.max(0, vida - Math.max(0, cfg.reto_vida_min)));
    let nueva = vida;
    if (danio > 0) {
      const { data, error } = await supabase.rpc("ajustar_progreso", { p_estudiante_id: estudianteId, p_delta_xp: 0, p_delta_vida: -danio, p_delta_monedas: 0 });
      if (error) throw error;
      nueva = typeof data?.[0]?.vida === "number" ? data[0].vida : vida - danio;
    }
    try { await supabase.from("mundo_retos").insert({ estudiante_id: estudianteId, enemigo, zona: zona || def.zona, ganado: false, aciertos, errores, danio }); } catch { /* el intento es secundario */ }
    if (danio > 0) { try { await supabase.from("historial_gamificacion").insert({ estudiante_id: estudianteId, etiqueta: `☠️ ${def.nombre} te venció`, xp: 0, vida: -danio, monedas: 0, categoria: "general" }); } catch { /* el historial es secundario */ } }
    return { ok: true, danio, vida: nueva };
  }
  const { error: eIns } = await supabase.from("mundo_retos").insert({ estudiante_id: estudianteId, enemigo, zona: zona || def.zona, ganado: true, aciertos, errores, danio: 0 });
  if (eIns) {
    if (eIns.code === "23505" || /duplicate|unique/i.test(eIns.message || "")) return { ok: true, yaTenia: true };
    throw eIns;
  }
  const xp = cfg.reto_xp, oro = cfg.reto_oro;
  if (xp || oro) {
    const { error } = await supabase.rpc("ajustar_progreso", { p_estudiante_id: estudianteId, p_delta_xp: xp, p_delta_vida: 0, p_delta_monedas: oro });
    if (error) { await supabase.from("mundo_retos").delete().eq("estudiante_id", estudianteId).eq("enemigo", enemigo).eq("ganado", true); throw error; }
    try { await supabase.from("historial_gamificacion").insert({ estudiante_id: estudianteId, etiqueta: `⚔️ Derrotó a ${def.nombre}`, xp, vida: 0, monedas: oro, categoria: "general" }); } catch { /* el historial es secundario */ }
  }
  return { ok: true, xp, oro };
}

// ----- para el editor de la docente -----
// Cuántos retadores fueron derrotados por zona y cuántas derrotas hubo: { derrotados: { zona: n }, derrotas: n, danioTotal: n }
export async function fetchRetosResumen() {
  const { data, error } = await supabase.from("mundo_retos").select("zona, ganado, danio");
  if (error) throw error;
  const r = { derrotados: {}, derrotas: 0, danioTotal: 0 };
  (data || []).forEach((f) => { if (f.ganado) r.derrotados[f.zona] = (r.derrotados[f.zona] || 0) + 1; else { r.derrotas += 1; r.danioTotal += Number(f.danio) || 0; } });
  return r;
}
