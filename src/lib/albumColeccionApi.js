import { supabase } from "./supabaseClient";

const BUCKET = "album-laminas";

/* ===== Estudiante (todo pasa por funciones seguras del servidor) ===== */
export async function albListar(estudianteId) {
  const { data, error } = await supabase.rpc("alb_listar", { p_estudiante_id: estudianteId });
  if (error) throw error;
  return data || [];
}
export async function albDetalle(estudianteId, albumId) {
  const { data, error } = await supabase.rpc("alb_detalle", { p_estudiante_id: estudianteId, p_album_id: albumId });
  if (error) throw error;
  return data;
}
export async function albAbrirSobre(estudianteId, albumId) {
  const { data, error } = await supabase.rpc("alb_abrir_sobre", { p_estudiante_id: estudianteId, p_album_id: albumId });
  if (error) throw error;
  return data;
}

/* ===== Docente ===== */
export async function fetchAlbumesDocente() {
  const [{ data: albumes, error }, { data: laminas }] = await Promise.all([
    supabase.from("alb_albumes").select("*").order("orden").order("id"),
    supabase.from("alb_laminas").select("album_id, pagina_id"),
  ]);
  if (error) throw error;
  const cuenta = {};
  (laminas || []).forEach((l) => { cuenta[l.album_id] = (cuenta[l.album_id] || 0) + 1; });
  return (albumes || []).map((a) => ({ ...a, total_laminas: cuenta[a.id] || 0 }));
}
export async function crearAlbum(campos) {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("alb_albumes").insert({ ...campos, docente_id: u?.user?.id }).select().single();
  if (error) throw error;
  // todo álbum nace con su primera página
  await supabase.from("alb_paginas").insert({ album_id: data.id, numero: 1, titulo: "Página 1" });
  return data;
}
export async function editarAlbum(id, campos) {
  const { error } = await supabase.from("alb_albumes").update(campos).eq("id", id);
  if (error) throw error;
}
export async function eliminarAlbum(id) {
  const { error } = await supabase.from("alb_albumes").delete().eq("id", id);
  if (error) throw error;
}
export async function fetchEstructuraAlbum(albumId) {
  const [p, l] = await Promise.all([
    supabase.from("alb_paginas").select("*").eq("album_id", albumId).order("numero"),
    supabase.from("alb_laminas").select("*").eq("album_id", albumId).order("numero"),
  ]);
  if (p.error) throw p.error;
  if (l.error) throw l.error;
  return { paginas: p.data || [], laminas: l.data || [] };
}
export async function crearPagina(albumId, titulo) {
  const { data: max } = await supabase.from("alb_paginas").select("numero").eq("album_id", albumId).order("numero", { ascending: false }).limit(1);
  const numero = (max?.[0]?.numero || 0) + 1;
  const { data, error } = await supabase.from("alb_paginas").insert({ album_id: albumId, numero, titulo: titulo || `Página ${numero}` }).select().single();
  if (error) throw error;
  return data;
}
export async function editarPagina(id, campos) {
  const { error } = await supabase.from("alb_paginas").update(campos).eq("id", id);
  if (error) throw error;
}
export async function eliminarPagina(id) {
  const { error } = await supabase.from("alb_paginas").delete().eq("id", id);
  if (error) throw error;
}
// Crea varias láminas a la vez en una página; la numeración continúa desde la última del álbum.
export async function crearLaminas(albumId, paginaId, items) {
  const { data: max } = await supabase.from("alb_laminas").select("numero").eq("album_id", albumId).order("numero", { ascending: false }).limit(1);
  let n = max?.[0]?.numero || 0;
  const filas = items.map((it) => ({ album_id: albumId, pagina_id: paginaId, numero: ++n, nombre: it.nombre, imagen_url: it.imagen_url, rareza: it.rareza || "comun", peso: it.peso || 10 }));
  const { data, error } = await supabase.from("alb_laminas").insert(filas).select();
  if (error) throw error;
  return data;
}
export async function editarLamina(id, campos) {
  const { error } = await supabase.from("alb_laminas").update(campos).eq("id", id);
  if (error) throw error;
}
export async function eliminarLamina(lamina) {
  const { error } = await supabase.from("alb_laminas").delete().eq("id", lamina.id);
  if (error) throw error;
  const ruta = rutaEnBucket(lamina.imagen_url);
  if (ruta) { try { await supabase.storage.from(BUCKET).remove([ruta]); } catch { /* la imagen huérfana no estorba */ } }
}
export async function fetchAvanceAlbum(albumId) {
  const { data: lams } = await supabase.from("alb_laminas").select("id").eq("album_id", albumId).not("pagina_id", "is", null);
  const ids = (lams || []).map((l) => l.id);
  if (!ids.length) return { total: 0, estudiantes: [] };
  const { data } = await supabase.from("alb_estudiante_laminas").select("estudiante_id, lamina_id").in("lamina_id", ids);
  const por = {};
  (data || []).forEach((r) => { por[r.estudiante_id] = (por[r.estudiante_id] || 0) + 1; });
  const idsEst = Object.keys(por).map(Number);
  const { data: ests } = idsEst.length ? await supabase.from("estudiantes").select("id, nombre").in("id", idsEst) : { data: [] };
  const nombre = {}; (ests || []).forEach((e) => { nombre[e.id] = e.nombre; });
  return { total: ids.length, estudiantes: Object.entries(por).map(([id, n]) => ({ estudiante_id: Number(id), nombre: nombre[id] || `Estudiante ${id}`, tengo: n })).sort((a, b) => b.tengo - a.tengo) };
}

/* ===== Imágenes: se reducen y convierten a webp antes de subirlas (cuida el espacio) ===== */
function reducir(archivo, maxAncho, maxAlto) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo); const img = new Image();
    img.onload = () => {
      const esc = Math.min(1, maxAlto / img.height, maxAncho / img.width);
      const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(img.width * esc)); c.height = Math.max(1, Math.round(img.height * esc));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen"))), "image/webp", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`"${archivo.name}" no es una imagen válida`)); };
    img.src = url;
  });
}
export async function subirImagenAlbum(archivo, { maxAncho = 520, maxAlto = 700 } = {}) {
  const blob = await reducir(archivo, maxAncho, maxAlto);
  const ruta = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, blob, { contentType: "image/webp", upsert: false });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
}
export const rutaEnBucket = (url) => { const m = String(url || "").match(new RegExp(`/${BUCKET}/(.+)$`)); return m ? m[1] : null; };

// "03_socrates-de-atenas.png" → "Socrates de atenas"
export function nombreDesdeArchivo(nombreArchivo) {
  const base = String(nombreArchivo || "").replace(/\.[^.]+$/, "").replace(/^[#\s\d]+[-_.)\s]+/, "").replace(/[-_]+/g, " ").trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "Lámina";
}
