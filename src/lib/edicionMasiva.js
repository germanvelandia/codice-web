// =====================================================================================
//  EDICIÓN MASIVA DE MISIONES (lógica pura, sin pantalla: se puede probar sola)
//  La docente selecciona varias misiones y les cambia de una vez el curso, el lugar, el XP, el oro o si se ven.
//  Antes de guardar se revisa que ningún lugar quede con más de 5 misiones visibles para algún curso.
// =====================================================================================
import { LUGARES, zonaDeLugar, zonaPorClave } from "../game/zonas";
import { MAX_POR_LUGAR, visiblesParaCurso, etiquetaPara, esNivel, nivelDeClave, nombreNivel } from "./gradosMundo";

const nombreLugar = (k) => (LUGARES.find((l) => l.key === k) || { nombre: k }).nombre;
const textoGrado = (c) => (c === "todos" ? "todos los cursos" : esNivel(c) ? `todo ${nombreNivel(nivelDeClave(c)).toLowerCase()}` : `el curso ${c}`);

// cambios: { grado: ""|"todos"|"nivel:8"|"802", lugar: ""|clave, xp: ""|número, oro: ""|número, visible: ""|"mostrar"|"ocultar" }  ("" = dejar como está)
// Devuelve { ok:true, campos, cuantas, resumen:[…] } o { ok:false, error }.
export function planEdicion({ misiones, ids, cambios, cursos = [], columnaCurso = true, columnaZona = true }) {
  const elegidas = new Set(ids || []);
  const objetivo = misiones.filter((m) => elegidas.has(m.id));
  if (!objetivo.length) return { ok: false, error: "No hay misiones seleccionadas." };
  const c = cambios || {}, campos = {}, resumen = [];
  if (c.grado) {
    if (!columnaCurso) return { ok: false, error: "Para cambiar el curso corre primero 63_mundo_por_curso.sql en Supabase." };
    campos.grado_id = c.grado === "todos" ? null : String(c.grado); resumen.push(`Para: ${c.grado === "todos" ? "todos los cursos" : etiquetaPara(c.grado)}`);
  }
  if (c.lugar) {
    if (!LUGARES.some((l) => l.key === c.lugar)) return { ok: false, error: "Ese lugar no existe." };
    if (zonaDeLugar(c.lugar) !== "aldea" && !columnaZona) return { ok: false, error: "Para mover a zonas nuevas corre primero 64_mundo_zonas.sql en Supabase." };
    campos.lugar = c.lugar; if (columnaZona) campos.zona = zonaDeLugar(c.lugar);
    resumen.push(`Lugar: ${nombreLugar(c.lugar)}${zonaPorClave(zonaDeLugar(c.lugar)) ? ` (${zonaPorClave(zonaDeLugar(c.lugar)).nombre})` : ""}`);
  }
  for (const [k, nombre, campo] of [["xp", "El XP", "xp"], ["oro", "El oro", "oro"]]) {
    if (c[k] === "" || c[k] == null) continue;
    const n = Number(c[k]);
    if (!Number.isInteger(n) || n < 0 || n > 1000) return { ok: false, error: `${nombre} tiene que ser un número entero entre 0 y 1000.` };
    campos[campo] = n; resumen.push(`${campo === "xp" ? "XP" : "Oro"}: ${n}`);
  }
  if (c.visible === "mostrar" || c.visible === "ocultar") { campos.activo = c.visible === "mostrar"; resumen.push(c.visible === "mostrar" ? "Se mostrarán" : "Se ocultarán"); }
  if (!Object.keys(campos).length) return { ok: false, error: "Elige al menos un cambio." };

  // ¿Quedaría algún lugar con más de 5 visibles para algún curso?
  if ("grado_id" in campos || "lugar" in campos || campos.activo === true) {
    const despues = misiones.map((m) => (elegidas.has(m.id) ? { ...m, ...campos } : m));
    const lugares = new Set(objetivo.map((m) => (campos.lugar || m.lugar)));
    const revisar = cursos.length ? cursos : [""];
    for (const l of lugares) {
      for (const cu of revisar) {
        const n = visiblesParaCurso(despues, l, cu);
        if (n > MAX_POR_LUGAR) return { ok: false, error: `${nombreLugar(l)} quedaría con ${n} misiones visibles para ${textoGrado(cu || "todos")} (el máximo es ${MAX_POR_LUGAR}, para que los personajes quepan). Elige otro lugar, oculta algunas o selecciona menos misiones.` };
      }
    }
  }
  return { ok: true, campos, cuantas: objetivo.length, resumen };
}

// Filtro de búsqueda por texto (título, pregunta, personaje); ignora tildes y mayúsculas.
const limpio = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function coincideBusqueda(m, q) {
  const b = limpio(q).trim(); if (!b) return true;
  return limpio([m.titulo, m.texto, m.npc_nombre].join(" ")).includes(b);
}
