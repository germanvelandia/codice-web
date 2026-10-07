// =====================================================================================
//  LAS TRES LLAVES Y LA CÁMARA DEL CÓDICE (lógica pura, sin pantalla: se puede probar sola)
//  Hay 3 llaves escondidas en 3 zonas distintas; cada una pide una prueba distinta.
//  Con las 3 se abre la puerta sellada de la aldea y se reclama el cofre.
// =====================================================================================

export const CONFIG_LLAVES_DEFECTO = {
  llaves_activo: 1,          // las llaves y la Cámara existen
  llaves_orden: 1,           // 1 = hay que conseguirlas en orden (bronce → plata → oro) · 0 = en cualquier orden
  llaves_xp: 150,            // premio del cofre
  llaves_oro: 80,
  llaves_duelo_aciertos: 3,  // la prueba de la llave de plata: aciertos para ganar
  llaves_duelo_vidas: 2,     // …y errores que se aguantan
};

// n = número de llave · prueba = "pregunta" | "duelo" | "acertijo"
export const LLAVES = [
  { n: 1, nombre: "Llave de Bronce", medalla: "🥉", color: "#cd7f32", zona: "bosque", lugar: "Bosque de la Curiosidad", prueba: "pregunta",
    pista: "Entre los árboles del 🌲 Bosque de la Curiosidad brilla algo de bronce. Solo se deja tomar quien sabe responder." },
  { n: 2, nombre: "Llave de Plata", medalla: "🥈", color: "#c0c7d4", zona: "montana", lugar: "Montaña", prueba: "duelo",
    pista: "En la ⛰️ Montaña un guardián custodia una llave de plata. Solo la entrega a quien lo venza en un duelo de preguntas." },
  { n: 3, nombre: "Llave de Oro", medalla: "🥇", color: "#f2c94c", zona: "lago", lugar: "Lago", prueba: "acertijo",
    pista: "A orillas del 🌊 Lago descansa la llave de oro, atrapada en un acertijo. Resuélvelo y será tuya." },
];
export const TEXTO_PRUEBA = { pregunta: "Responde una pregunta", duelo: "Vence al guardián en un duelo", acertijo: "Resuelve un acertijo" };
export const llaveDe = (n) => LLAVES.find((l) => l.n === Number(n)) || null;

const comoSet = (tengo) => new Set((tengo ? [...tengo] : []).map(Number).filter((n) => llaveDe(n)));

// ¿Se puede intentar conseguir esta llave ahora? (si el orden es obligatorio, la anterior tiene que estar)
export function puedeConseguir(n, tengo, orden = true) {
  const t = comoSet(tengo), l = llaveDe(n); if (!l) return { ok: false, motivo: "no_existe" };
  if (t.has(l.n)) return { ok: false, motivo: "ya_la_tienes" };
  if (orden && l.n > 1 && !t.has(l.n - 1)) return { ok: false, motivo: "falta_anterior", falta: llaveDe(l.n - 1) };
  return { ok: true };
}

// La siguiente llave que conviene buscar (la primera que falta)
export function siguienteLlave(tengo) { const t = comoSet(tengo); return LLAVES.find((l) => !t.has(l.n)) || null; }
export const cuantas = (tengo) => comoSet(tengo).size;
export const camaraDesbloqueada = (tengo) => comoSet(tengo).size === LLAVES.length;

// Validación de lo que escribe la docente en la pestaña 🏰/🗝️ (devuelve "" si está bien)
export function validarConfigLlaves(c) {
  for (const [k, nombre, min, max] of [["xp", "El XP del cofre", 0, 1000], ["oro", "El oro del cofre", 0, 1000], ["aciertos", "Los aciertos del duelo", 1, 10], ["vidas", "Los corazones del duelo", 1, 10]]) {
    const v = Number(c[k]); if (c[k] === "" || c[k] == null || !Number.isInteger(v) || v < min || v > max) return `${nombre} tiene que ser un número entero entre ${min} y ${max}.`;
  }
  return "";
}
