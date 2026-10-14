// Imágenes de las lecciones: validar, reducir (para que no pesen) y subir al almacén de Supabase (bucket "lecciones-imagenes").
import { supabase } from "./supabaseClient";

export const BUCKET_IMAGENES = "lecciones-imagenes";
export const MAX_BYTES_ORIGINAL = 12 * 1024 * 1024;   // lo que se acepta del celular/cámara
export const MAX_BYTES_GIF = 3 * 1024 * 1024;         // los GIF no se reducen (perderían la animación)
const TIPOS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

// → { ok: true } | { ok: false, mensaje }
export function validarImagen(archivo) {
  if (!archivo) return { ok: false, mensaje: "Elige una imagen." };
  if (!TIPOS[archivo.type]) return { ok: false, mensaje: "Ese archivo no es una imagen compatible (usa JPG, PNG, WEBP o GIF)." };
  if (archivo.size > MAX_BYTES_ORIGINAL) return { ok: false, mensaje: "La imagen pesa más de 12 MB. Elige una más liviana." };
  if (archivo.type === "image/gif" && archivo.size > MAX_BYTES_GIF) return { ok: false, mensaje: "El GIF pesa más de 3 MB. Usa uno más liviano o conviértelo a imagen." };
  return { ok: true };
}
// Nombre único y sin caracteres raros
export function nombreImagen(tipo, ahora = Date.now(), azar = Math.random) {
  return `${ahora}-${Math.floor(azar() * 1e9).toString(36)}.${TIPOS[tipo] || "jpg"}`;
}
// Tamaño final manteniendo proporción (el lado más largo no pasa de max; nunca se agranda)
export function tamanoReducido(ancho, alto, max = 1400) {
  const f = Math.min(1, max / Math.max(ancho, alto, 1)); return { ancho: Math.max(1, Math.round(ancho * f)), alto: Math.max(1, Math.round(alto * f)) };
}

// Reduce la imagen en el navegador. Devuelve { blob, tipo }. GIF y WEBP livianos se dejan igual.
export async function reducirImagen(archivo, { max = 1400, calidad = 0.85 } = {}) {
  if (archivo.type === "image/gif") return { blob: archivo, tipo: archivo.type };
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error("No se pudo leer la imagen: puede estar dañada.")); i.src = url; });
    const { ancho, alto } = tamanoReducido(img.naturalWidth, img.naturalHeight, max);
    const lienzo = document.createElement("canvas"); lienzo.width = ancho; lienzo.height = alto;
    const ctx = lienzo.getContext("2d"); const png = archivo.type === "image/png";
    if (!png) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, ancho, alto); }            // JPEG no tiene transparencia
    ctx.drawImage(img, 0, 0, ancho, alto);
    const tipo = png ? "image/png" : "image/jpeg";
    const blob = await new Promise((ok) => lienzo.toBlob(ok, tipo, calidad));
    if (!blob) throw new Error("No se pudo preparar la imagen.");
    return blob.size < archivo.size ? { blob, tipo } : { blob: archivo, tipo: archivo.type };   // si no se logró bajar el peso, se deja la original
  } finally { URL.revokeObjectURL(url); }
}

// Mensajes claros para los errores típicos de Supabase Storage
export function mensajeErrorSubida(e) {
  const m = String((e && (e.message || e.error)) || e || "");
  if (/bucket not found|not found/i.test(m)) return "Falta crear el almacén de imágenes: ejecuta el archivo 81_imagenes_lecciones.sql en Supabase.";
  if (/row-level security|policy|unauthorized|not authorized|jwt/i.test(m)) return "Tu sesión no tiene permiso para subir imágenes. Vuelve a iniciar sesión como docente (o ejecuta 81_imagenes_lecciones.sql).";
  if (/exceeded|too large|payload/i.test(m)) return "La imagen es demasiado pesada para el almacén.";
  return "No se pudo subir la imagen: " + (m || "error desconocido");
}

// Sube la imagen y devuelve su dirección pública (https://…)
export async function subirImagenLeccion(archivo) {
  const v = validarImagen(archivo); if (!v.ok) throw new Error(v.mensaje);
  const { blob, tipo } = await reducirImagen(archivo);
  const ruta = nombreImagen(tipo);
  const { error } = await supabase.storage.from(BUCKET_IMAGENES).upload(ruta, blob, { contentType: tipo, upsert: false, cacheControl: "31536000" });
  if (error) throw new Error(mensajeErrorSubida(error));
  const { data } = supabase.storage.from(BUCKET_IMAGENES).getPublicUrl(ruta);
  if (!data || !data.publicUrl) throw new Error("No se pudo obtener la dirección de la imagen.");
  return data.publicUrl;
}
