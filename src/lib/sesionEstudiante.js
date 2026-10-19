import { supabase, leerTokenEstudiante, guardarTokenEstudiante } from "./supabaseClient";

// Entra con el código del estudiante. Devuelve { id, nombre, grado_id, reino_actual,
// reino_original, foto_url } o null si el código no existe. Guarda el token de sesión
// (y lo reutiliza si ya había uno válido, para no crear sesiones de más).
export async function loginEstudiante(codigo) {
  const { data, error } = await supabase.rpc("login_estudiante", {
    p_codigo: String(codigo || "").trim().toUpperCase(),
    p_token: leerTokenEstudiante() || null,
  });
  if (error) {
    if (/demasiados_intentos/.test(error.message || "")) {
      throw new Error("Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.");
    }
    throw error;
  }
  if (!data) return null;
  guardarTokenEstudiante(data.token);
  return data.estudiante;
}

// Cierra la sesión del estudiante en el servidor y borra el token del navegador.
export async function cerrarSesionEstudiante() {
  try { await supabase.rpc("cerrar_sesion_estudiante"); } catch { /* da igual */ }
  guardarTokenEstudiante("");
}
