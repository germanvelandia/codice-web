// Preguntados · carga masiva: lectura de lo que ya existe (para la plantilla, la exportación y la revisión) y guardado por lotes
import { supabase } from "./supabaseClient";

async function paginar(armar) {
  const todo = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await armar().range(desde, desde + 999);
    if (error) throw new Error(error.message);
    todo.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return todo;
}

// → { categorias: [{id,nombre,emoji,color,materia_id,materia_nombre,total,textos}], preguntas: [...], materias: [{id,nombre}] }
export async function fetchTriviaParaExcel() {
  const [cats, preguntas, mats] = await Promise.all([
    paginar(() => supabase.from("trivia_categorias").select("id,nombre,emoji,color,materia_id,activa").order("id")),
    paginar(() => supabase.from("trivia_preguntas").select("id,categoria_id,pregunta,opciones,correcta,activa").order("id")),
    supabase.from("materias").select("id,nombre").order("nombre").then((r) => (r.error ? [] : r.data || [])),
  ]);
  const nomMat = new Map(mats.map((m) => [m.id, m.nombre]));
  const categorias = cats.map((c) => {
    const mias = preguntas.filter((p) => p.categoria_id === c.id);
    return { ...c, materia_nombre: c.materia_id ? nomMat.get(c.materia_id) || "" : "", total: mias.length, textos: mias.map((p) => p.pregunta) };
  });
  return { categorias, preguntas, materias: mats };
}

// categoriasNuevas = salida de analizarTrivia().categorias · filas = las filas con estado "nueva"
// progreso(hecho, total) es opcional. Si algo falla, el error trae .creadas (cuántas preguntas sí quedaron guardadas).
export async function crearTriviaMasivo({ categoriasNuevas = [], filas = [], progreso } = {}) {
  const { data: u } = await supabase.auth.getUser();
  const docente_id = u?.user?.id || null;
  const ids = new Map();
  let creadas = 0, categoriasCreadas = 0;
  const fallar = (msg) => { const e = new Error(msg); e.creadas = creadas; e.categoriasCreadas = categoriasCreadas; return e; };
  const total = filas.length;
  for (const c of categoriasNuevas) {
    const { data, error } = await supabase.from("trivia_categorias").insert({ nombre: c.nombre, emoji: c.emoji, color: c.color, materia_id: c.materia_id ?? null, activa: true }).select("id");
    if (error || !data?.[0]) throw fallar(`No se pudo crear la categoría "${c.nombre}": ${error?.message || "sin respuesta"}`);
    ids.set(c.nombre.toLowerCase(), data[0].id); categoriasCreadas++;
  }
  let existentes = null;
  const idDe = async (nombre) => {
    const k = nombre.toLowerCase();
    if (ids.has(k)) return ids.get(k);
    if (!existentes) existentes = await paginar(() => supabase.from("trivia_categorias").select("id,nombre").order("id"));
    const e = existentes.find((x) => x.nombre.toLowerCase() === k);
    return e ? e.id : null;
  };
  const lista = [];
  for (const f of filas) {
    const categoria_id = await idDe(f.categoria);
    if (categoria_id == null) throw fallar(`No encontré la categoría "${f.categoria}" para guardar la fila ${f.fila}.`);
    lista.push({ categoria_id, docente_id, pregunta: f.campos.pregunta, opciones: f.campos.opciones, correcta: f.campos.correcta, activa: f.campos.activa });
  }
  for (let i = 0; i < lista.length; i += 50) {
    const lote = lista.slice(i, i + 50);
    const { error } = await supabase.from("trivia_preguntas").insert(lote);
    if (error) throw fallar(`Se guardaron ${creadas} preguntas y falló el lote que empieza en la ${i + 1}: ${error.message}`);
    creadas += lote.length; if (progreso) progreso(creadas, total);
  }
  return { creadas, categoriasCreadas };
}
