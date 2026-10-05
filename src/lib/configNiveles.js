import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// Configuración de los NIVELES del personaje: cuántas piezas pide cada uno, cómo se llama
// y cómo se ve (brillo y estrellas). Se edita desde Estudiantes → Piezas del personaje →
// "Editar niveles" y se guarda en la tabla avatar_niveles. Si la tabla no existe todavía
// (o está vacía), se usan los 4 niveles de fábrica.

export const NIVELES_POR_DEFECTO = [
  { nivel: 1, nombre: "Novato", desde: 0, color: null, estrellas: 0 },
  { nivel: 2, nombre: "Aventurero", desde: 1, color: "#CD7F32", estrellas: 0 }, // bronce
  { nivel: 3, nombre: "Veterano", desde: 3, color: "#C0C8D0", estrellas: 1 },   // plata
  { nivel: 4, nombre: "Leyenda", desde: 5, color: "#FFC93C", estrellas: 2 },    // oro
];
export const MAX_NIVELES = 10;

// Deja la lista siempre usable: ordenada por piezas, el primer nivel en 0, sin dos niveles
// que pidan lo mismo, y numerada 1, 2, 3… sin saltos.
export function normalizarNiveles(filas) {
  const limpias = (Array.isArray(filas) ? filas : []).map((f) => ({
    nombre: String(f.nombre ?? "").trim(),
    desde: Math.max(0, parseInt(f.desde, 10) || 0),
    color: f.color || null,
    estrellas: [0, 1, 2].includes(Number(f.estrellas)) ? Number(f.estrellas) : 0,
    orden: Number(f.nivel) || 0,
  })).sort((a, b) => a.desde - b.desde || a.orden - b.orden);
  if (limpias.length === 0) return NIVELES_POR_DEFECTO;
  limpias[0].desde = 0;
  const unicas = [];
  limpias.forEach((f) => { if (unicas.length === 0 || f.desde > unicas[unicas.length - 1].desde) unicas.push(f); });
  return unicas.slice(0, MAX_NIVELES).map((f, i) => ({ nivel: i + 1, nombre: f.nombre || `Nivel ${i + 1}`, desde: f.desde, color: f.color, estrellas: f.estrellas }));
}

// ---- Lo que está vigente ahora (lo leen todas las pantallas) ----
let actuales = NIVELES_POR_DEFECTO;
const oyentes = new Set();
export function nivelesActuales() { return actuales; }
export function fijarNiveles(lista) {
  actuales = normalizarNiveles(lista);
  oyentes.forEach((f) => f());
}

// Las pantallas que tienen que redibujarse cuando cambian los niveles usan este hook.
export function useNivelesPersonaje() {
  const [valor, setValor] = useState(actuales);
  useEffect(() => {
    const avisar = () => setValor(actuales);
    oyentes.add(avisar);
    avisar();
    return () => { oyentes.delete(avisar); };
  }, []);
  return valor;
}

// ---- Base de datos ----
export async function fetchNivelesPersonaje() {
  const { data, error } = await supabase.from("avatar_niveles").select("*").order("nivel");
  if (error) throw error;
  return data || [];
}

// Guarda la lista completa: primero se escriben los niveles 1..N y después se borran los
// que sobren (los que ya no existen).
export async function guardarNivelesPersonaje(lista) {
  const filas = normalizarNiveles(lista).map((n) => ({ nivel: n.nivel, nombre: n.nombre, desde: n.desde, color: n.color || null, estrellas: n.estrellas || 0 }));
  const { error } = await supabase.from("avatar_niveles").upsert(filas, { onConflict: "nivel" });
  if (error) throw error;
  const { error: e2 } = await supabase.from("avatar_niveles").delete().gt("nivel", filas.length);
  if (e2) throw e2;
  fijarNiveles(filas);
}

// Al arrancar la app se pide la configuración guardada, para que ya esté lista cuando se
// abra cualquier pantalla con personajes. Si falla (por ejemplo falta el SQL), se siguen
// usando los niveles de fábrica sin avisar nada.
fetchNivelesPersonaje().then((filas) => { if (filas.length) fijarNiveles(filas); }).catch(() => {});
