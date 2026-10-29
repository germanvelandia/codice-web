import { supabase } from "./supabaseClient";

export async function registrarIngresoMundo() {
  try {
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
    try { if (localStorage.getItem("mundo_ingreso_dia") === hoy) return; } catch {}
    const { error } = await supabase.rpc("mundo_registrar_ingreso");
    if (!error) { try { localStorage.setItem("mundo_ingreso_dia", hoy); } catch {} }
  } catch { /* el registro es secundario: nunca debe estorbar */ }
}

export async function calcularMundoNota(gradoId, desde, hasta, params) {
  const { data, error } = await supabase.rpc("mundo_nota_calcular", { p_grado: String(gradoId), p_desde: desde, p_hasta: hasta, p_params: params });
  if (error) throw error;
  return data || [];
}
export async function fetchSyncsMundo() {
  const { data, error } = await supabase.from("mundo_nota_sync").select("*").order("creado_en", { ascending: false });
  if (error) throw error; return data || [];
}
export async function crearSyncMundo(campos) {
  const { data, error } = await supabase.from("mundo_nota_sync").insert(campos).select().single();
  if (error) throw error; return data;
}
export async function actualizarSyncMundo(id, campos) {
  const { error } = await supabase.from("mundo_nota_sync").update(campos).eq("id", id); if (error) throw error;
}
export async function eliminarSyncMundo(id) {
  const { error } = await supabase.from("mundo_nota_sync").delete().eq("id", id); if (error) throw error;
}
export async function syncAhoraMundo(id) {
  const { data, error } = await supabase.rpc("mundo_nota_sync_ahora", { p_id: id }); if (error) throw error; return data;
}
export function mensajeMundoNota(e) {
  const m = String(e?.message || e || "");
  if (m.includes("dias_plataforma") || m.includes("mundo_nota_calcular")) return "Falta correr el script 123 en Supabase.";
  if (m.includes("mundo_nota") || m.includes("mundo_ingresos")) return "Falta correr el script 112 (y el 123) en Supabase.";
  if (m.includes("no_autorizado")) return "No tienes permiso sobre esa configuración.";
  return m || "No se pudo completar.";
}
