// La Gran Obra del curso: llamadas a Supabase (estudiante y docente) + presencia en vivo.
import { supabase } from "./supabaseClient";
import { crearOpciones } from "../game/obras";

const MENSAJES = {
  sin_sesion: "Tu sesión venció. Vuelve a entrar con tu código.",
  obra_no_disponible: "La obra no está disponible en este momento.",
  votacion_cerrada: "La votación ya está cerrada.",
  opcion_invalida: "Esa opción no existe.",
  rol_invalido: "Ese rol no existe.",
  rol_ya_cambiado_hoy: "Ya cambiaste de rol hoy. Mañana podrás hacerlo otra vez.",
  item_invalido: "Ese recurso no se puede aportar.",
  cantidad_invalida: "Esa cantidad no es válida.",
  pregunta_no_emitida: "Esa pregunta ya no está activa. Pide otra.",
  obra_no_encontrada: "No se encontró la obra.",
};
export const mensajeObra = (e) => {
  const m = String(e?.message || e || "");
  const k = Object.keys(MENSAJES).find((x) => m.includes(x));
  return k ? MENSAJES[k] : m;
};
export const MOTIVOS = {
  no_constructor: "Solo los constructores pueden colocar piezas. Elige ese rol en el panel de la obra.",
  fuera_del_plano: "Esa casilla no es parte del plano de esta fase.",
  ocupada: "Alguien ya colocó una pieza ahí.",
  falta_almacen: "Al almacén le faltan recursos para esta pieza. ¡Pide ayuda a los recolectores!",
  tope: "Llegaste al tope de hoy. Mañana puedes seguir.",
  sin_recursos: "No tienes ese recurso en tu mochila.",
  reto_completo: "El reto de esta fase ya está completo. 🎉",
  sin_preguntas: "No hay preguntas disponibles para el reto. Avísale a tu docente.",
};

// ---------- Estudiante ----------
export async function fetchObraEstado() {
  const { data, error } = await supabase.rpc("obra_estado");
  if (error) throw error;
  return data || { hay: false };
}
export async function votarObra(opcion) {
  const { data, error } = await supabase.rpc("obra_votar", { p_opcion: opcion });
  if (error) throw error;
  return data;
}
export async function elegirRolObra(rol) {
  const { data, error } = await supabase.rpc("obra_elegir_rol", { p_rol: rol });
  if (error) throw error;
  return data;
}
export async function aportarObra(item, cantidad) {
  const { data, error } = await supabase.rpc("obra_aportar", { p_item: item, p_cantidad: cantidad });
  if (error) throw error;
  return data;
}
export async function colocarObra(x, y, item) {
  const { data, error } = await supabase.rpc("obra_colocar", { p_x: x, p_y: y, p_item: item });
  if (error) throw error;
  return data;
}
export async function retoPreguntaObra() {
  const { data, error } = await supabase.rpc("obra_reto_pregunta");
  if (error) throw error;
  return data;
}
export async function retoResponderObra(preguntaId, opcion) {
  const { data, error } = await supabase.rpc("obra_reto_responder", { p_pregunta: String(preguntaId), p_opcion: opcion });
  if (error) throw error;
  return data;
}
export async function fetchCanalMundo() {
  const { data, error } = await supabase.rpc("mundo_canal");
  if (error) throw error;
  return data;
}

// ---------- Docente ----------
export async function fetchObrasDocente() {
  const { data, error } = await supabase.from("mundo_obras").select("*").order("creado_en", { ascending: false });
  if (error) throw error;
  return data || [];
}
// opcionesIds: cuáles del catálogo se ofrecen a votar. Se guardan completas (el plano viaja con la obra).
export async function crearObraDocente({ gradoId, titulo, opcionesIds, retoCategoria, topeDia, retoTopeDia }) {
  const opciones = crearOpciones().filter((o) => !opcionesIds || opcionesIds.includes(o.id));
  if (opciones.length < 2) throw new Error("Ofrece al menos 2 opciones para que puedan votar.");
  const { data, error } = await supabase.from("mundo_obras").insert({
    grado_id: gradoId, titulo: titulo?.trim() || "La Gran Obra", estado: "preparacion", opciones,
    reto_categoria: retoCategoria ? String(retoCategoria) : null,
    tope_dia: Math.max(1, Math.min(60, Number(topeDia) || 20)), reto_tope_dia: Math.max(1, Math.min(40, Number(retoTopeDia) || 10)),
  }).select().single();
  if (error) throw error;
  return data;
}
export async function cambiarEstadoObra(id, estado) {
  const { error } = await supabase.from("mundo_obras").update({ estado }).eq("id", id);
  if (error) throw error;
}
export async function cerrarVotacionObra(id, opcion = null) {
  const { data, error } = await supabase.rpc("obra_cerrar_votacion", { p_obra: id, p_opcion: opcion });
  if (error) throw error;
  return data;
}
export async function eliminarObra(id) {
  const { error } = await supabase.from("mundo_obras").delete().eq("id", id);
  if (error) throw error;
}
export async function fetchDetalleObra(id) {
  const [votos, roles, aportes, piezas] = await Promise.all([
    supabase.from("mundo_obra_votos").select("estudiante_id, opcion_id").eq("obra_id", id).limit(2000),
    supabase.from("mundo_obra_roles").select("estudiante_id, rol").eq("obra_id", id).limit(2000),
    supabase.from("mundo_obra_aportes").select("estudiante_id, tipo, item, cantidad, dia").eq("obra_id", id).limit(20000),
    supabase.from("mundo_obra_piezas").select("x, y, item, fase, estudiante_id").eq("obra_id", id).limit(2000),
  ]);
  for (const r of [votos, roles, aportes, piezas]) if (r.error) throw r.error;
  return { votos: votos.data || [], roles: roles.data || [], aportes: aportes.data || [], piezas: piezas.data || [] };
}

// ---------- Presencia en vivo ----------
// Cada cliente publica su posición (≈5 veces por segundo, solo si se mueve) en el canal secreto de su curso
// y recibe la de sus compañeros. El estado verdadero (obra, notas, monedas) NUNCA viaja por aquí.
export function crearPresencia({ canal, yo, alObra }) {
  const remotos = new Map();
  let canalRt = null, vivo = true, ultimoEnvio = 0, ultimaClave = "";
  try {
    canalRt = supabase.channel(canal, { config: { broadcast: { self: false, ack: false } } });
    canalRt.on("broadcast", { event: "pos" }, ({ payload }) => {
      if (!vivo || !payload || payload.id === yo.id || typeof payload.id === "undefined") return;
      const ahora = Date.now();
      const r = remotos.get(payload.id) || { id: payload.id, rx: payload.x, ry: payload.y, nuevo: true };
      r.nombre = String(payload.n || "").slice(0, 20); r.clave = String(payload.c || ""); r.e = String(payload.e || ""); r.tx = Number(payload.x) || 0; r.ty = Number(payload.y) || 0;
      r.d = String(payload.d || "south"); r.m = !!payload.m; r.visto = ahora;
      if (r.nuevo || r.eAnterior !== r.e) { r.rx = r.tx; r.ry = r.ty; r.nuevo = false; }
      r.eAnterior = r.e; remotos.set(payload.id, r);
      if (remotos.size > 60) { const viejo = [...remotos.values()].sort((a, b) => a.visto - b.visto)[0]; remotos.delete(viejo.id); }
    });
    canalRt.on("broadcast", { event: "obra" }, () => { if (vivo && alObra) alObra(); });
    canalRt.subscribe();
  } catch { canalRt = null; }

  return {
    remotos,
    // estado = { e: id de escena, x, y, d: dirección, m: se mueve }
    enviar(estado, forzar = false) {
      if (!canalRt || !vivo) return;
      const ahora = Date.now();
      const clave = `${estado.e}|${Math.round(estado.x)}|${Math.round(estado.y)}|${estado.m ? 1 : 0}`;
      if (!forzar && (ahora - ultimoEnvio < 200 || (clave === ultimaClave && ahora - ultimoEnvio < 2500))) return;
      ultimoEnvio = ahora; ultimaClave = clave;
      try { canalRt.send({ type: "broadcast", event: "pos", payload: { id: yo.id, n: yo.nombre, c: yo.clave, e: estado.e, x: Math.round(estado.x), y: Math.round(estado.y), d: estado.d, m: estado.m } }); } catch { /* sin conexión */ }
    },
    avisarObra() { if (canalRt && vivo) { try { canalRt.send({ type: "broadcast", event: "obra", payload: {} }); } catch { /* nada */ } } },
    // quita a quien lleva más de 6 s sin dar señales (cerró el juego o perdió conexión)
    limpiar() { const t = Date.now(); for (const [id, r] of remotos) if (t - r.visto > 6000) remotos.delete(id); },
    destruir() { vivo = false; remotos.clear(); try { if (canalRt) supabase.removeChannel(canalRt); } catch { /* nada */ } },
  };
}
