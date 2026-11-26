// Reinicio de año (solo administrador). Todo lo hace el servidor (SQL 161): verifica que seas administrador,
// guarda un respaldo antes de borrar y registra quién lo hizo. El navegador solo pide y muestra.
import { supabase } from "./supabaseClient";

const llamar = async (nombre, args) => {
  const { data, error } = await supabase.rpc(nombre, args || {});
  if (error) throw new Error(error.message || "No se pudo completar la acción.");
  return data;
};

export const fetchReinicioVista = () => llamar("reinicio_vista");
export const ejecutarReinicio = (modulos, confirmacion, respaldo = true) => llamar("reinicio_ejecutar", { p_modulos: modulos, p_confirmacion: confirmacion, p_respaldo: !!respaldo });
export const restaurarReinicio = (lote, confirmacion) => llamar("reinicio_restaurar", { p_lote: lote, p_confirmacion: confirmacion });
export const borrarRespaldoReinicio = (lote) => llamar("reinicio_borrar_respaldo", { p_lote: lote });
