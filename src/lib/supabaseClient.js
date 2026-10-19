import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Falta configurar VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en Vercel"
  );
}

// Token de sesión del estudiante (portal sin cuenta). Lo entrega el RPC
// login_estudiante y viaja en la cabecera x-student-token; las políticas de
// Supabase lo usan para dejar ver y tocar SOLO lo que le corresponde.
const CLAVE_TOKEN = "codice_student_token";

export function leerTokenEstudiante() {
  try { return localStorage.getItem(CLAVE_TOKEN) || ""; } catch { return ""; }
}

export function guardarTokenEstudiante(token) {
  try {
    if (token) localStorage.setItem(CLAVE_TOKEN, token);
    else localStorage.removeItem(CLAVE_TOKEN);
  } catch { /* sin almacenamiento: el portal pedirá el código de nuevo */ }
}

const fetchConToken = (input, init = {}) => {
  const token = leerTokenEstudiante();
  if (!token) return fetch(input, init);
  const headers = new Headers(init.headers || (typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined));
  headers.set("x-student-token", token);
  return fetch(input, { ...init, headers });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchConToken },
});
