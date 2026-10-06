// =====================================================================================
//  MISIONES OCULTAS: objetos brillantes escondidos en el mundo (lógica pura, sin pantalla: se puede probar sola)
//  La docente elige la escena y el objeto; el estudiante lo ve solo al acercarse, lo examina y responde una pregunta.
// =====================================================================================

// Dónde se puede esconder algo. "plaza" = la aldea por fuera; los edificios y las zonas naturales usan su clave.
export const ESCENAS_SECRETO = [
  { key: "plaza", emoji: "🏘️", nombre: "Aldea (afuera)" },
  { key: "biblioteca", emoji: "📚", nombre: "Biblioteca" },
  { key: "agora", emoji: "⚖️", nombre: "Ágora de la Ética" },
  { key: "templo", emoji: "🕊️", nombre: "Templo de la Gratitud" },
  { key: "mercado", emoji: "🛒", nombre: "Mercado del Códice" },
  { key: "posada", emoji: "🛏️", nombre: "Posada del Descanso" },
  { key: "acertijos", emoji: "🧩", nombre: "Casa de los Acertijos" },
  { key: "bosque", emoji: "🌲", nombre: "Bosque de la Curiosidad" },
  { key: "montana", emoji: "⛰️", nombre: "Montaña" },
  { key: "lago", emoji: "🌊", nombre: "Lago" },
];
export const CLAVES_ESCENA = ESCENAS_SECRETO.map((e) => e.key);
export const nombreEscena = (k) => (ESCENAS_SECRETO.find((e) => e.key === k) || { emoji: "📍", nombre: k });

// Objetos que se pueden esconder
export const OBJETOS_SECRETO = ["🗝️", "📜", "💎", "🏺", "🕯️", "📖", "🪙", "🔮", "🧭", "🪶"];
export const MIN_OPCIONES = 2, MAX_OPCIONES = 5;

const txt = (v) => String(v ?? "").trim();

// Valida lo que escribió la docente. Devuelve "" si está bien o el mensaje del problema.
export function validarSecreto(c) {
  if (!txt(c.nombre)) return "Ponle un nombre al objeto (por ejemplo: «Pergamino antiguo»).";
  if (!CLAVES_ESCENA.includes(c.escena)) return "Elige dónde se esconde.";
  if (!OBJETOS_SECRETO.includes(c.emoji)) return "Elige cómo se ve el objeto.";
  if (!txt(c.texto)) return "Escribe la pregunta que se encuentra al examinarlo.";
  const ops = (c.opciones || []).map(txt).filter(Boolean);
  if (ops.length < MIN_OPCIONES) return `Escribe al menos ${MIN_OPCIONES} respuestas.`;
  if (ops.length > MAX_OPCIONES) return `Máximo ${MAX_OPCIONES} respuestas.`;
  if (new Set(ops.map((o) => o.toLowerCase())).size !== ops.length) return "Hay respuestas repetidas.";
  const c0 = Number(c.correcta);
  if (!Number.isInteger(c0) || c0 < 0 || c0 >= (c.opciones || []).length || !txt(c.opciones[c0])) return "Marca cuál es la respuesta correcta (y que no esté vacía).";
  for (const [k, n] of [["xp", "El XP"], ["oro", "El oro"]]) { const v = Number(c[k]); if (c[k] === "" || c[k] == null || !Number.isInteger(v) || v < 0 || v > 500) return `${n} tiene que ser un número entero entre 0 y 500.`; }
  return "";
}

// Deja los campos listos para guardar. Las respuestas vacías se quitan y "correcta" se recalcula sobre las que quedan.
export function limpiarSecreto(c) {
  const todas = (c.opciones || []).map(txt), idxCorrecta = Number(c.correcta);
  const ops = [], mapa = {};
  todas.forEach((o, i) => { if (o) { mapa[i] = ops.length; ops.push(o); } });
  return {
    nombre: txt(c.nombre).slice(0, 60), emoji: c.emoji, escena: c.escena, pista: txt(c.pista).slice(0, 160) || null,
    texto: txt(c.texto).slice(0, 400), opciones: ops, correcta: mapa[idxCorrecta] ?? 0, retro: txt(c.retro).slice(0, 300) || null,
    grado_id: c.grado_id || null, xp: Math.max(0, Math.min(500, Math.floor(Number(c.xp) || 0))), oro: Math.max(0, Math.min(500, Math.floor(Number(c.oro) || 0))), activo: c.activo !== false,
  };
}

// ¿El secreto sirve para jugarse? (para filtrar los que vienen de la base)
export const secretoJugable = (s) => !!s && CLAVES_ESCENA.includes(s.escena) && Array.isArray(s.opciones) && s.opciones.length >= MIN_OPCIONES && Number.isInteger(s.correcta) && s.correcta >= 0 && s.correcta < s.opciones.length && !!txt(s.texto);

// Qué tan visible es el brillo según la distancia al jugador: 0 = no se ve, 1 = se ve entero.
export function brilloPorDistancia(d, { ver = 120, claro = 55 } = {}) {
  if (!(d < ver)) return 0;
  if (d <= claro) return 1;
  return (ver - d) / (ver - claro);
}

// Las pistas (rumores) de los secretos que todavía no se encontraron.
export function rumoresPendientes(lista, hallados) {
  const h = new Set(hallados || []);
  return (lista || []).filter((s) => !h.has(s.id) && txt(s.pista)).map((s) => ({ id: s.id, texto: txt(s.pista), escena: s.escena }));
}
