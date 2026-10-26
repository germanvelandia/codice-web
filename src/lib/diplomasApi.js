import { supabase } from "./supabaseClient";

export async function fetchDiplomasOtorgados(gradoId, materiaId) {
  let q = supabase.from("diplomas_otorgados").select("id, estudiante_id, materia_id, periodo, puesto, promedio, tipo, datos, creado_en").eq("grado_id", gradoId).order("creado_en", { ascending: false });
  if (materiaId) q = q.eq("materia_id", String(materiaId));
  const { data, error } = await q; if (error) throw error; return data || [];
}

// filas: [{estudiante_id, grado_id, materia_id, materia_nombre, periodo, puesto, promedio, tipo, datos}]
export async function otorgarDiplomas(filas) {
  const { error } = await supabase.from("diplomas_otorgados").upsert(filas, { onConflict: "estudiante_id,materia_id,periodo,tipo" });
  if (error) throw error;
}

export async function retirarDiploma(id) {
  const { error } = await supabase.from("diplomas_otorgados").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchMisDiplomas() {
  const { data, error } = await supabase.rpc("diplomas_mis");
  if (error) throw error;
  return data || [];
}

// Ranking de una materia en un curso a partir de las notas finales de periodo ya cerradas.
export async function calcularRanking(materiaId, estudiantes, periodos) {
  const { data, error } = await supabase.from("notas_finales_periodo").select("estudiante_id, periodo, nota").eq("materia_id", materiaId);
  if (error) throw error;
  const idsGrado = new Set(estudiantes.map((e) => String(e.id)));
  const filas = (data || []).filter((n) => idsGrado.has(String(n.estudiante_id)) && n.nota != null);
  const periodosExistentes = [...new Set(filas.map((n) => String(n.periodo)))].sort();
  const usar = periodos && periodos.length ? periodos.map(String) : periodosExistentes;
  const por = {};
  filas.filter((n) => usar.includes(String(n.periodo))).forEach((n) => {
    const k = String(n.estudiante_id); por[k] = por[k] || {}; por[k][String(n.periodo)] = Number(n.nota);
  });
  const lista = estudiantes.map((e) => {
    const p = por[String(e.id)] || {}; const vals = Object.values(p);
    return { id: e.id, nombre: e.nombre, porPeriodo: p, n: vals.length, promedio: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
  }).filter((r) => r.promedio != null);
  lista.sort((a, b) => b.promedio - a.promedio || a.nombre.localeCompare(b.nombre));
  let puesto = 0, ant = null;
  lista.forEach((r, i) => { const v = Math.round(r.promedio * 100); if (v !== ant) { puesto = i + 1; ant = v; } r.puesto = puesto; });
  return { lista, periodosExistentes };
}
