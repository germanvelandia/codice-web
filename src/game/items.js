// =====================================================================================
//  RECURSOS, HERRAMIENTAS Y RECETAS DEL MUNDO CÓDICE (lógica pura, sin pantalla: se puede probar sola)
// =====================================================================================

export const MAX_POR_ITEM = 99;

// tipo: recurso (se recoge) · herramienta (se fabrica una vez y mejora un recurso) · consumible (cura vida) · decoracion (para la parcela, más adelante)
export const ITEMS = {
  madera: { nombre: "Madera", emoji: "🪵", tipo: "recurso" },
  piedra: { nombre: "Piedra", emoji: "🪨", tipo: "recurso" },
  pez: { nombre: "Pez", emoji: "🐟", tipo: "recurso" },
  hierba: { nombre: "Hierba", emoji: "🌿", tipo: "recurso" },
  hacha: { nombre: "Hacha", emoji: "🪓", tipo: "herramienta", mejora: "madera", desc: "+1 madera cada vez que recoges" },
  pico: { nombre: "Pico", emoji: "⛏️", tipo: "herramienta", mejora: "piedra", desc: "+1 piedra cada vez que recoges" },
  cana: { nombre: "Caña de pescar", emoji: "🎣", tipo: "herramienta", mejora: "pez", desc: "+1 pez cada vez que pescas" },
  pocion: { nombre: "Poción", emoji: "🧪", tipo: "consumible", cura: 25, desc: "Cura 25 ❤️" },
  sopa: { nombre: "Sopa de pescado", emoji: "🍲", tipo: "consumible", cura: 50, desc: "Cura 50 ❤️" },
  silla: { nombre: "Silla", emoji: "🪑", tipo: "decoracion" },
  mesa: { nombre: "Mesa", emoji: "🍽️", tipo: "decoracion" },
  farol: { nombre: "Farol", emoji: "🏮", tipo: "decoracion" },
  maceta: { nombre: "Maceta", emoji: "🪴", tipo: "decoracion" },
};

// Qué se encuentra en cada zona natural: [item, cuántos puntos de recolección hay en el mapa]
export const RECURSOS_POR_ZONA = {
  bosque: [["madera", 10], ["hierba", 6]],
  montana: [["piedra", 8]],
  lago: [["pez", 6], ["hierba", 3]],
};

export const RECETAS = {
  hacha: { ingredientes: { madera: 3, piedra: 2 } },
  pico: { ingredientes: { madera: 3, piedra: 3 } },
  cana: { ingredientes: { madera: 3, hierba: 1 } },
  pocion: { ingredientes: { hierba: 3 } },
  sopa: { ingredientes: { pez: 2, hierba: 1 } },
  silla: { ingredientes: { madera: 4 } },
  mesa: { ingredientes: { madera: 6, piedra: 2 } },
  farol: { ingredientes: { piedra: 3, madera: 1 } },
  maceta: { ingredientes: { piedra: 2, hierba: 2 } },
};

export const recetaDe = (id) => RECETAS[id] || null;
export const esHerramienta = (id) => !!ITEMS[id] && ITEMS[id].tipo === "herramienta";
export const herramientaDe = (recurso) => Object.keys(ITEMS).find((k) => ITEMS[k].tipo === "herramienta" && ITEMS[k].mejora === recurso) || null;
const cant = (inv, k) => Math.max(0, Number((inv || {})[k]) || 0);

// Lo que le falta a un inventario para fabricar: { item: cuántos faltan }
export function faltantes(id, inv) {
  const r = recetaDe(id); if (!r) return null;
  const f = {};
  for (const [k, n] of Object.entries(r.ingredientes)) { const t = n - cant(inv, k); if (t > 0) f[k] = t; }
  return f;
}

// ¿Se puede fabricar ahora? Las herramientas solo una vez; ningún objeto pasa de MAX_POR_ITEM.
export function puedeFabricar(id, inv) {
  if (!recetaDe(id)) return { ok: false, motivo: "receta" };
  if (esHerramienta(id) && cant(inv, id) >= 1) return { ok: false, motivo: "ya_tiene" };
  if (cant(inv, id) >= MAX_POR_ITEM) return { ok: false, motivo: "lleno" };
  const f = faltantes(id, inv);
  if (Object.keys(f).length) return { ok: false, motivo: "faltan", faltan: f };
  return { ok: true };
}

// Cuántas unidades da una recolección: la base (mínimo 1), más 1 si tiene la herramienta de ese recurso.
export function cantidadPorRecoleccion(item, inv, base = 2) {
  const h = herramientaDe(item);
  return Math.max(1, Math.floor(Number(base) || 1)) + (h && cant(inv, h) >= 1 ? 1 : 0);
}

// =====================================================================================
//  LA PARCELA: un terreno propio donde cada estudiante coloca sus objetos de decoración
// =====================================================================================
export const PARCELA = { cols: 16, filas: 12, maxPiezas: 60 };
export const esDecoracion = (id) => !!ITEMS[id] && ITEMS[id].tipo === "decoracion";
// Se puede construir dentro de la cerca (se deja libre el paso de la entrada, abajo al centro).
export function celdaValida(x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  if (x < 1 || x > PARCELA.cols - 2 || y < 1 || y > PARCELA.filas - 2) return false;
  const mitad = PARCELA.cols / 2;
  if ((x === mitad - 1 || x === mitad) && y >= PARCELA.filas - 3) return false;                // el paso de la entrada
  return true;
}
