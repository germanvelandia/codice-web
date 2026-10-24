import { supabase } from "./supabaseClient";

// ---------- Docente ----------
export async function fetchPartidas(gradoId) {
  let q = supabase.from("dg_partidas").select("*").order("creado_en", { ascending: false });
  if (gradoId) q = q.eq("grado_id", gradoId);
  const { data, error } = await q; if (error) throw error; return data || [];
}
export async function fetchPartida(id) {
  const { data, error } = await supabase.from("dg_partidas").select("*").eq("id", id).single(); if (error) throw error; return data;
}
export async function crearPartida(campos) {
  const { data, error } = await supabase.from("dg_partidas").insert(campos).select().single(); if (error) throw error; return data;
}
export async function guardarEstadoPartida(id, estado, version, extra = {}) {
  const { error } = await supabase.from("dg_partidas").update({ estado, version: (version || 1) + 1, ...extra }).eq("id", id); if (error) throw error;
  return (version || 1) + 1;
}
export async function actualizarPartida(id, campos) {
  const { error } = await supabase.from("dg_partidas").update(campos).eq("id", id); if (error) throw error;
}
export async function eliminarPartida(id) {
  const { error } = await supabase.from("dg_partidas").delete().eq("id", id); if (error) throw error;
}
export async function fetchAccionesRonda(id, ronda) {
  const { data, error } = await supabase.from("dg_acciones").select("*").eq("partida_id", id).eq("ronda", ronda).order("id"); if (error) throw error; return data || [];
}
export function claveDeAccion(tipo, payload) {
  if (tipo === "evento") return "e";
  if (tipo === "voto") return "v" + (payload?.propuesta || "");
  if (tipo === "propuesta") return "p";
  return "";
}
export async function guardarAccionDocente(partidaId, ronda, nacion, tipo, payload) {
  const clave = claveDeAccion(tipo, payload);
  const fila = { partida_id: partidaId, ronda, nacion, tipo, clave, payload, autor: "docente" };
  if (clave) {
    await supabase.from("dg_acciones").delete().eq("partida_id", partidaId).eq("ronda", ronda).eq("nacion", nacion).eq("tipo", tipo).eq("clave", clave);
  }
  const { error } = await supabase.from("dg_acciones").insert(fila); if (error) throw error;
}
export async function borrarAccionDocente(id) {
  const { error } = await supabase.from("dg_acciones").delete().eq("id", id); if (error) throw error;
}
export async function fetchCartas() {
  const { data, error } = await supabase.from("dg_cartas").select("*").order("creado_en", { ascending: false }); if (error) throw error; return data || [];
}
export async function crearCarta(c) {
  const { error } = await supabase.from("dg_cartas").insert(c); if (error) throw error;
}
export async function eliminarCarta(id) {
  const { error } = await supabase.from("dg_cartas").delete().eq("id", id); if (error) throw error;
}

// ---------- Estudiante ----------
export async function fetchMisPartidas() {
  const { data, error } = await supabase.rpc("dg_mis_partidas"); if (error) throw error; return data || [];
}
export async function fetchVersionPartida(id) {
  const { data, error } = await supabase.rpc("dg_version", { p_partida: id }); if (error) throw error; return data;
}
export async function fetchEstadoJuego(id) {
  const { data, error } = await supabase.rpc("dg_estado", { p_partida: id }); if (error) throw error; return data;
}
export async function enviarAccionJuego(id, tipo, payload) {
  const { error } = await supabase.rpc("dg_enviar_accion", { p_partida: id, p_tipo: tipo, p_payload: payload }); if (error) throw error;
}
export async function borrarAccionJuego(partidaId, accionId) {
  const { error } = await supabase.rpc("dg_borrar_accion", { p_partida: partidaId, p_accion: accionId }); if (error) throw error;
}
export function mensajeJuego(e) {
  const m = String(e?.message || e || "");
  const t = { fase_incorrecta: "Esa acción no corresponde a la fase actual.", fase_cerrada: "El tiempo de esta fase ya terminó.", modo_mesa: "Esta partida la maneja el docente en clase.", sin_nacion: "No perteneces a ninguna nación de esta partida.", limite_acciones: "Ya enviaste el máximo de este tipo de acción.", sesion_invalida: "Vuelve a entrar con tu código.", partida_no_disponible: "La partida ya no está disponible." };
  for (const k of Object.keys(t)) if (m.includes(k)) return t[k];
  if (m.includes("dg_")) return "Falta correr el script 111 en Supabase.";
  return m || "No se pudo completar.";
}
