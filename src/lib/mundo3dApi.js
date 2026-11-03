// Conexión del Mundo 3D con Supabase. Todo pasa por funciones del servidor (RPC): las tablas están cerradas.
import { supabase } from "./supabaseClient";

const llamar = async (nombre, args) => {
  const { data, error } = await supabase.rpc(nombre, args);
  if (error) throw new Error(error.message || "No se pudo completar la acción.");
  return data;
};

export const fetchEstadoMundo3D = (est) => llamar("mundo3d_mi_estado", { p_est: est });
export const fetchGradosMundo3D = async (est) => (await llamar("mundo3d_grados", { p_est: est })) || [];
// Cambios de un grado; con "desde" solo trae lo nuevo.
export const fetchCambiosMundo3D = async (est, grado, desde = null) => (await llamar("mundo3d_cargar", { p_est: est, p_grado: String(grado), p_desde: desde })) || [];
export const picarMundo3D = (est, x, y, z, bloque) => llamar("mundo3d_picar", { p_est: est, p_x: x, p_y: y, p_z: z, p_bloque: bloque });
export const ponerMundo3D = (est, x, y, z, item) => llamar("mundo3d_poner", { p_est: est, p_x: x, p_y: y, p_z: z, p_item: item });
export const recolectarMundo3D = (est, tipo) => llamar("mundo3d_recolectar", { p_est: est, p_tipo: String(tipo) });
export const fabricarMundo3D = (est, sale) => llamar("mundo3d_fabricar", { p_est: est, p_sale: sale });

// Presencia: registra mi posición y devuelve a los compañeros conectados en ese mundo (SQL 136)
const num = (v) => (Number.isFinite(v) ? v : 0);
export const latidoMundo3D = async (est, grado, x, y, z, yaw, avatar = null) => (await llamar("mundo3d_latido", { p_est: est, p_grado: String(grado), p_x: num(x), p_y: num(y), p_z: num(z), p_yaw: num(yaw), p_avatar: avatar })) || [];
export const salirMundo3D = (est) => llamar("mundo3d_salir", { p_est: est });
export const fetchPresenciaDocente = async (grado) => (await llamar("mundo3d_presencia_docente", { p_grado: String(grado) })) || [];
export const fijarPresenciaMundo3D = (grado, activa) => llamar("mundo3d_presencia_set", { p_grado: String(grado), p_on: !!activa });

// Docente
export const fetchResumenMundo3D = async (grado) => (await llamar("mundo3d_resumen", { p_grado: String(grado) })) || [];
export const revertirMundo3D = (grado, autor = null, desde = null) => llamar("mundo3d_revertir", { p_grado: String(grado), p_autor: autor, p_desde: desde }); // → { lote, cantidad }

// Docente (panel y observador): todas pasan por funciones que exigen sesión de docente
export const fetchGradosDocente = async () => (await llamar("mundo3d_docente_grados", {})) || [];
export const fetchCambiosDocente = async (grado, desde = null) => (await llamar("mundo3d_docente_cargar", { p_grado: String(grado), p_desde: desde })) || [];
export const fetchAjustesMundo3D = (grado) => llamar("mundo3d_ajustes_get", { p_grado: String(grado) });
export const guardarAjustesMundo3D = (grado, construir, limite) => llamar("mundo3d_ajustes_set", { p_grado: String(grado), p_construir: !!construir, p_limite: Math.max(0, Math.min(20000, Math.floor(Number(limite) || 0))) });
export const deshacerReversionMundo3D = (lote) => llamar("mundo3d_deshacer", { p_lote: lote });
export const fetchHistorialMundo3D = async (grado) => (await llamar("mundo3d_historial", { p_grado: String(grado) })) || [];
