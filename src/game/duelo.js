// =====================================================================================
//  LA LÓGICA DEL DUELO CONTRA UN GUARDIÁN (sin pantalla: se puede probar sola).
//  El duelo es una batalla de preguntas: el guardián tiene una barra de "maestría" (hay que acertar
//  N preguntas para vencerlo) y el estudiante tiene corazones (cada error le cuesta uno).
//    - Se gana al llegar a N aciertos.
//    - Se pierde al quedarse sin corazones, o si se acaban las preguntas sin llegar a N.
// =====================================================================================

export const textoNorm = (t) => String(t ?? "").toLowerCase().replace(/\s+/g, " ").trim();

// Mezcla (Fisher–Yates) sin tocar el original.
export function barajar(lista, rand = Math.random) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const aLista = (o) => { if (Array.isArray(o)) return o; if (typeof o === "string") { try { const v = JSON.parse(o); return Array.isArray(v) ? v : []; } catch { return []; } } return []; };

// Una pregunta válida tiene enunciado, al menos 2 opciones con texto, y una "correcta" que existe.
export function normalizarPregunta(p, fuente) {
  if (!p) return null;
  const texto = String(p.texto ?? p.pregunta ?? "").trim();
  const opciones = aLista(p.opciones).map((o) => String(o ?? "").trim());
  const correcta = Number(p.correcta);
  if (!texto || opciones.length < 2 || opciones.some((o) => !o) || !Number.isInteger(correcta) || correcta < 0 || correcta >= opciones.length) return null;
  return { texto, opciones, correcta, pista: String(p.pista ?? "").trim(), retro: String(p.retro ?? "").trim(), fuente };
}

// El banco del duelo de una zona: las preguntas de las misiones de esa zona + las de la categoría de Preguntados (si hay).
export function armarPool(misionesZona = [], banco = []) {
  const vistas = new Set(), pool = [];
  const agregar = (p) => { if (!p) return; const k = textoNorm(p.texto); if (vistas.has(k)) return; vistas.add(k); pool.push(p); };
  misionesZona.forEach((m) => agregar(normalizarPregunta({ texto: m.texto, opciones: m.opciones, correcta: m.correcta, pista: m.pista, retro: m.retro }, "mision")));
  banco.forEach((p) => agregar(normalizarPregunta(p, "banco")));
  return pool;
}

// Minutos que faltan para poder volver a retar (0 si ya puede).
export const esperaRestanteMin = (esperaHasta, ahora = Date.now()) => (esperaHasta && esperaHasta > ahora ? Math.ceil((esperaHasta - ahora) / 60000) : 0);

// Crea un duelo. Devuelve { imposible, motivo } si no hay preguntas suficientes para poder ganar.
export function crearDuelo({ pool, aciertos = 4, vidas = 3, rand = Math.random }) {
  const necesarios = Math.max(1, Math.floor(aciertos)), corazones = Math.max(1, Math.floor(vidas));
  if (!pool || pool.length < necesarios) return { imposible: true, motivo: "pocas", disponibles: pool ? pool.length : 0, necesarios };
  // Cada pregunta se prepara con sus opciones mezcladas, recordando cuál es la correcta.
  const preguntas = barajar(pool, rand).map((p) => {
    const orden = barajar(p.opciones.map((_, i) => i), rand);
    return { texto: p.texto, opciones: orden.map((i) => p.opciones[i]), correcta: orden.indexOf(p.correcta), pista: p.pista, retro: p.retro, fuente: p.fuente };
  });
  const e = { aciertos: 0, errores: 0, i: 0, fin: null };
  return {
    imposible: false, necesarios, corazones, total: preguntas.length,
    actual: () => (e.fin ? null : preguntas[e.i]),
    progreso: () => ({ aciertos: e.aciertos, errores: e.errores, necesarios, corazones, vidasRestantes: Math.max(0, corazones - e.errores), numero: e.i + 1, fin: e.fin }),
    // Responde la pregunta actual con la opción "idx". Devuelve cómo salió y si el duelo terminó.
    responder(idx) {
      if (e.fin) return { ignorada: true, fin: e.fin };
      const p = preguntas[e.i], acierto = idx === p.correcta;
      if (acierto) e.aciertos++; else e.errores++;
      e.i++;
      if (e.aciertos >= necesarios) e.fin = "gana";
      else if (e.errores >= corazones) e.fin = "pierde";
      else if (e.i >= preguntas.length) e.fin = "pierde"; // se acabaron las preguntas sin llegar a los aciertos
      return { acierto, correcta: p.correcta, pista: p.pista, retro: p.retro, fin: e.fin, progreso: { aciertos: e.aciertos, errores: e.errores, vidasRestantes: Math.max(0, corazones - e.errores) } };
    },
    // Rendirse cuenta como perder.
    rendirse() { if (!e.fin) e.fin = "pierde"; return e.fin; },
  };
}
