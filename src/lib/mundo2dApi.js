// Conexión del Mundo 2D (etapa 2) con Supabase: expedición, huerto, parcela y combate.
// Todo pasa por funciones del servidor (RPC, SQL 160): las tablas están cerradas y el servidor decide cantidades, tiempos y premios.
import { supabase } from "./supabaseClient";

const llamar = async (nombre, args) => {
  const { data, error } = await supabase.rpc(nombre, args);
  if (error) throw new Error(error.message || "No se pudo completar la acción.");
  return data;
};

export const expedicionMundo2D = (est, lugar) => llamar("mundo2d_expedicion", { p_est: est, p_lugar: lugar });
export const fetchHuertoMundo2D = (est) => llamar("mundo2d_huerto_ver", { p_est: est });
export const sembrarMundo2D = (est, slot, item) => llamar("mundo2d_sembrar", { p_est: est, p_slot: slot, p_item: item });
export const cosecharMundo2D = (est, slot) => llamar("mundo2d_cosechar", { p_est: est, p_slot: slot });
export const fetchParcelaMundo2D = async (est) => (await llamar("mundo2d_parcela_ver", { p_est: est })) || [];
export const colocarMundo2D = (est, x, y, item) => llamar("mundo2d_colocar", { p_est: est, p_x: x, p_y: y, p_item: item });
export const quitarMundo2D = (est, x, y) => llamar("mundo2d_quitar", { p_est: est, p_x: x, p_y: y });
export const combateIniciarMundo2D = (est, tipo) => llamar("mundo2d_combate_iniciar", { p_est: est, p_tipo: tipo });
export const combateAtacarMundo2D = (est) => llamar("mundo2d_combate_atacar", { p_est: est });
export const combateHuirMundo2D = (est) => llamar("mundo2d_combate_huir", { p_est: est });
