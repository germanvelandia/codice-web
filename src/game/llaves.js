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
export const llaveDe = (n, lista = LLAVES) => lista.find((l) => l.n === Number(n)) || null;

const comoSet = (tengo) => new Set((tengo ? [...tengo] : []).map(Number).filter((n) => llaveDe(n)));

// ¿Se puede intentar conseguir esta llave ahora? (si el orden es obligatorio, la anterior tiene que estar)
// `lista` = las llaves tal como las dejó la docente (llavesEfectivas); sin ella, las de siempre.
export function puedeConseguir(n, tengo, orden = true, lista = LLAVES) {
  const t = comoSet(tengo), l = llaveDe(n, lista); if (!l) return { ok: false, motivo: "no_existe" };
  if (t.has(l.n)) return { ok: false, motivo: "ya_la_tienes" };
  if (orden && l.n > 1 && !t.has(l.n - 1)) return { ok: false, motivo: "falta_anterior", falta: llaveDe(l.n - 1, lista) };
  return { ok: true };
}

// La siguiente llave que conviene buscar (la primera que falta)
export function siguienteLlave(tengo, lista = LLAVES) { const t = comoSet(tengo); return lista.find((l) => !t.has(l.n)) || null; }
export const cuantas = (tengo) => comoSet(tengo).size;
export const camaraDesbloqueada = (tengo) => comoSet(tengo).size === LLAVES.length;

// Validación de lo que escribe la docente en la pestaña 🏰/🗝️ (devuelve "" si está bien)
export function validarConfigLlaves(c) {
  for (const [k, nombre, min, max] of [["xp", "El XP del cofre", 0, 1000], ["oro", "El oro del cofre", 0, 1000], ["aciertos", "Los aciertos del duelo", 1, 10], ["vidas", "Los corazones del duelo", 1, 10]]) {
    const v = Number(c[k]); if (c[k] === "" || c[k] == null || !Number.isInteger(v) || v < min || v > max) return `${nombre} tiene que ser un número entero entre ${min} y ${max}.`;
  }
  return "";
}


// =====================================================================================
//  LLAVES A GUSTO DE LA DOCENTE
//  Por defecto: bronce en el Bosque (pregunta), plata en la Montaña (duelo), oro en el Lago (acertijo).
//  La docente puede cambiar, para cada llave: la zona, la prueba, en qué parte del mapa aparece y la pista que se lee.
//  Lo que no cambie sigue igual que antes.
// =====================================================================================
export const ZONAS_LLAVE = [["aldea", "🏘️", "Aldea del Códice", "la Aldea"], ["bosque", "🌲", "Bosque de la Curiosidad", "el Bosque"], ["montana", "🏔️", "Montaña del Esfuerzo", "la Montaña"], ["lago", "🏞️", "Lago de la Reflexión", "el Lago"]];
export const CLAVES_ZONA_LLAVE = ZONAS_LLAVE.map((z) => z[0]);
export const CLAVES_PRUEBA = ["pregunta", "duelo", "acertijo"];
// Dónde aparece dentro de la zona. [x0, x1, y0, y1] como fracción del ancho y del alto del mapa.
export const CUADRANTES = {
  auto: { nombre: "Donde caiga (al azar)", caja: null, frase: "" },
  NO: { nombre: "↖ Noroeste (arriba a la izquierda)", caja: [0, 0.5, 0, 0.5], frase: "en el rincón noroeste" },
  NE: { nombre: "↗ Noreste (arriba a la derecha)", caja: [0.5, 1, 0, 0.5], frase: "en el rincón noreste" },
  SO: { nombre: "↙ Suroeste (abajo a la izquierda)", caja: [0, 0.5, 0.5, 1], frase: "en el rincón suroeste" },
  SE: { nombre: "↘ Sureste (abajo a la derecha)", caja: [0.5, 1, 0.5, 1], frase: "en el rincón sureste" },
  centro: { nombre: "◎ Centro", caja: [0.3, 0.7, 0.3, 0.7], frase: "en el centro" },
};
export const CLAVES_CUADRANTE = Object.keys(CUADRANTES);
export const MAX_PISTA = 220;
const zonaInfo = (k) => ZONAS_LLAVE.find((z) => z[0] === k) || null;

// ¿Cae el punto (x, y) dentro del cuadrante pedido de un mapa de ancho × alto?
export function enCuadrante(cuadrante, x, y, ancho, alto) {
  const c = CUADRANTES[cuadrante]; if (!c || !c.caja) return true;
  const [x0, x1, y0, y1] = c.caja; return x >= ancho * x0 && x <= ancho * x1 && y >= alto * y0 && y <= alto * y1;
}

// Pista escrita sola cuando la docente cambia la zona o la prueba y no escribe una propia.
export function pistaAuto(llave) {
  const z = zonaInfo(llave.zona), donde = z ? `${z[1]} ${z[2]}` : "el mundo", q = CUADRANTES[llave.cuadrante] || CUADRANTES.auto;
  const dondeFrase = `En ${donde}${q.frase ? ", " + q.frase + "," : ""}`;
  const prueba = { pregunta: "Solo se deja tomar quien sabe responder.", duelo: "Un guardián la custodia: hay que vencerlo en un duelo de preguntas.", acertijo: "Está atrapada en un acertijo: resuélvelo y será tuya." }[llave.prueba] || "";
  return `${dondeFrase} te espera la ${llave.nombre.toLowerCase()}. ${prueba}`.replace(/\s+/g, " ").trim();
}

// config = filas guardadas: [{ llave, zona, prueba, cuadrante, pista }] (puede estar vacía o incompleta o tener basura)
// Devuelve las 3 llaves listas para usar: igual que LLAVES, con lo que la docente haya cambiado.
export function llavesEfectivas(config) {
  const filas = Array.isArray(config) ? config : [];
  return LLAVES.map((base) => {
    const f = filas.find((x) => x && Number(x.llave) === base.n) || {};
    const zona = CLAVES_ZONA_LLAVE.includes(f.zona) ? f.zona : base.zona;
    const prueba = CLAVES_PRUEBA.includes(f.prueba) ? f.prueba : base.prueba;
    const cuadrante = CLAVES_CUADRANTE.includes(f.cuadrante) ? f.cuadrante : "auto";
    const z = zonaInfo(zona), cambio = zona !== base.zona || prueba !== base.prueba || cuadrante !== "auto";
    const propia = String(f.pista || "").trim().slice(0, MAX_PISTA);
    const l = { ...base, zona, prueba, cuadrante, lugar: z ? z[2] : base.lugar };
    l.pista = propia || (cambio ? pistaAuto(l) : base.pista);
    l.personalizada = cambio || !!propia;
    return l;
  });
}

// Lo que escribe la docente para UNA llave (devuelve "" si está bien)
export function validarLlaveConfig(c) {
  if (!c || !CLAVES_ZONA_LLAVE.includes(c.zona)) return "Elige la zona de la llave.";
  if (!CLAVES_PRUEBA.includes(c.prueba)) return "Elige la prueba de la llave.";
  if (c.cuadrante != null && c.cuadrante !== "" && !CLAVES_CUADRANTE.includes(c.cuadrante)) return "Elige un lugar válido dentro de la zona.";
  if (String(c.pista || "").length > MAX_PISTA) return `La pista puede tener como máximo ${MAX_PISTA} letras.`;
  return "";
}
// Las tres a la vez; avisa si una llave quedó en la misma zona y lugar que otra (se encimarían)
export function validarLlavesConfig(lista) {
  const l = Array.isArray(lista) ? lista : [];
  for (const c of l) { const e = validarLlaveConfig(c); if (e) return `Llave ${c.llave}: ${e}`; }
  for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
    if (l[i].zona === l[j].zona && ((l[i].cuadrante || "auto") === (l[j].cuadrante || "auto")) && (l[i].cuadrante || "auto") !== "auto") return `Las llaves ${l[i].llave} y ${l[j].llave} quedarían en el mismo lugar. Cambia la zona o el lugar de una.`;
  }
  return "";
}
