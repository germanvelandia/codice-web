// Registro de accesos de estudiantes (reemplaza a api.registrarAcceso / api.fetchReporteAccesos).
// Dos problemas que tenía el anterior:
//  1) Se registraba un "acceso" cada vez que la pantalla del estudiante se refrescaba (al comprar, jugar, cobrar monedas…),
//     no solo al entrar → miles de filas falsas.
//  2) El reporte leía TODA la tabla sin paginar; Supabase corta en 1000 filas, así que con tantos registros el reporte
//     solo veía los más viejos y el "último acceso" quedaba congelado.
import { supabase } from "./supabaseClient";
import { fetchEstudiantesPorGrado } from "./api";

const MINUTOS_ENTRE_ACCESOS = 30;

// Una visita = un registro. Si el mismo estudiante ya registró hace menos de 30 min en este navegador, no repite.
export async function registrarAccesoUnaVez(estudianteId) {
  try {
    const clave = `codice_acceso_${estudianteId}`;
    const ultimo = Number(localStorage.getItem(clave) || 0);
    if (Date.now() - ultimo < MINUTOS_ENTRE_ACCESOS * 60000) return;
    const { error } = await supabase.from("accesos_estudiante").insert({ estudiante_id: estudianteId });
    if (error) { console.warn("No se pudo registrar el acceso:", error.message); return; }
    localStorage.setItem(clave, String(Date.now()));
  } catch (e) { /* nunca debe bloquear el ingreso */ }
}

async function traerAccesos(ids) {
  const filas = [];
  for (let ini = 0; ; ini += 1000) {
    const { data, error } = await supabase.from("accesos_estudiante").select("estudiante_id, fecha")
      .in("estudiante_id", ids).order("fecha", { ascending: false }).order("estudiante_id").range(ini, ini + 999);
    if (error) throw error;
    filas.push(...(data || []));
    if ((data || []).length < 1000) break;
  }
  return filas;
}

// Último acceso y cantidad total de cada estudiante del curso (lee todas las filas, no solo las primeras 1000).
export async function fetchReporteAccesos(gradoId) {
  const estudiantes = await fetchEstudiantesPorGrado(gradoId);
  const ids = estudiantes.map((e) => e.id);
  const accesos = ids.length ? await traerAccesos(ids) : [];
  const por = {};
  accesos.forEach((a) => {
    const x = por[a.estudiante_id] || (por[a.estudiante_id] = { total: 0, ultimo: null });
    x.total++;
    if (!x.ultimo || a.fecha > x.ultimo) x.ultimo = a.fecha;
  });
  return estudiantes.map((e) => ({ ...e, totalAccesos: por[e.id]?.total || 0, ultimoAcceso: por[e.id]?.ultimo || null }))
    .sort((a, b) => {
      if (!a.ultimoAcceso && !b.ultimoAcceso) return a.nombre.localeCompare(b.nombre);
      if (!a.ultimoAcceso) return 1;
      if (!b.ultimoAcceso) return -1;
      return b.ultimoAcceso.localeCompare(a.ultimoAcceso);
    });
}
