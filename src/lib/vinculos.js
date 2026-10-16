// Columnas vinculadas de la Planilla: comparten notas_actividades.grupo_vinculo y un trigger
// (85_columnas_vinculadas.sql) replica cada nota entre ellas.
import { supabase } from "./supabaseClient";

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16); }));

// Une origen y destino en un mismo grupo (reutiliza el grupo que ya tengan).
export async function vincularColumnas(origenId, destinoId) {
  const { data, error } = await supabase.from("notas_actividades").select("id, grupo_vinculo").in("id", [origenId, destinoId]);
  if (error) throw error;
  const grupoExistente = (data || []).map((a) => a.grupo_vinculo).find(Boolean);
  const grupo = grupoExistente || uuid();
  const { error: e2 } = await supabase.from("notas_actividades").update({ grupo_vinculo: grupo }).in("id", [origenId, destinoId]);
  if (e2) throw e2;
  return grupo;
}

export async function desvincularColumna(actividadId) {
  const { error } = await supabase.from("notas_actividades").update({ grupo_vinculo: null }).eq("id", actividadId);
  if (error) throw error;
}
