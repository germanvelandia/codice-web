// Detectives del Códice (SQL 142). El estudiante solo habla con funciones del servidor (RPC);
// las respuestas correctas, el destino correcto y el culpable nunca salen del servidor hacia su navegador.
import { supabase } from "./supabaseClient";

const llamar = async (nombre, args) => {
  const { data, error } = await supabase.rpc(nombre, args);
  if (error) {
    const m = String(error.message || "");
    if (m.includes("demasiado_rapido")) throw new Error("Con calma, detective: espera un instante.");
    if (m.includes("caso_no_disponible") || m.includes("sin_caso_en_curso")) throw new Error("Este caso ya no está disponible.");
    throw new Error(m || "No se pudo completar la acción.");
  }
  return data;
};

// ---------- estudiante ----------
export const listaDetectives = async (est) => (await llamar("detectives_lista", { p_est: est })) || [];
export const iniciarDetectives = (est, caso) => llamar("detectives_iniciar", { p_est: est, p_caso: caso });
export const responderDetectives = (est, caso, respuesta) => llamar("detectives_responder", { p_est: est, p_caso: caso, p_respuesta: String(respuesta) });
export const viajarDetectives = (est, caso, destino) => llamar("detectives_viajar", { p_est: est, p_caso: caso, p_destino: String(destino) });
export const arrestarDetectives = (est, caso, sospechoso) => llamar("detectives_arrestar", { p_est: est, p_caso: caso, p_sospechoso: sospechoso });
export const rankingDetectives = async (est, caso) => (await llamar("detectives_ranking", { p_est: est, p_caso: caso })) || [];

// ---------- docente (las tablas exigen sesión de docente y solo muestran SUS casos) ----------
export const resumenDetectives = async (caso) => (await llamar("detectives_resumen", { p_caso: caso })) || [];

export async function casosDelDocente() {
  const { data, error } = await supabase.from("detectives_casos").select("*, detectives_paradas(count), detectives_sospechosos(count)").order("creado", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}
export async function casoCompleto(id) {
  const [c, p, s] = await Promise.all([
    supabase.from("detectives_casos").select("*").eq("id", id).single(),
    supabase.from("detectives_paradas").select("*").eq("caso_id", id).order("orden"),
    supabase.from("detectives_sospechosos").select("*").eq("caso_id", id).order("id"),
  ]);
  if (c.error) throw new Error(c.error.message);
  return { ...c.data, paradas: p.data || [], sospechosos: s.data || [] };
}
export async function crearCaso(caso, { grado_id, materia_id = null }) {
  const { data: c, error } = await supabase.from("detectives_casos").insert({
    grado_id: String(grado_id), materia_id, titulo: caso.titulo, ambientacion: caso.ambientacion, historia: caso.historia,
    vidas: caso.vidas ?? 5, xp: caso.xp ?? 40, oro: caso.oro ?? 20, publicado: false,
  }).select().single();
  if (error) throw new Error(error.message);
  try {
    const paradas = caso.paradas.map((p, i) => ({ caso_id: c.id, orden: i + 1, lugar: p.lugar, emoji: p.emoji, escena: p.escena, testigo: p.testigo, pregunta: p.pregunta, opciones: p.opciones, correcta: p.correcta, retro: p.retro, pista: p.pista, rasgo: p.rasgo, destinos: p.destinos, destino_ok: p.destino_ok }));
    const r1 = await supabase.from("detectives_paradas").insert(paradas); if (r1.error) throw r1.error;
    const sosp = caso.sospechosos.map((s) => ({ caso_id: c.id, nombre: s.nombre, emoji: s.emoji, rasgos: s.rasgos, culpable: !!s.culpable }));
    const r2 = await supabase.from("detectives_sospechosos").insert(sosp); if (r2.error) throw r2.error;
  } catch (e) {
    await supabase.from("detectives_casos").delete().eq("id", c.id); // no dejar casos a medias
    throw new Error(e.message || "No se pudo guardar el caso.");
  }
  return c;
}
export async function actualizarCaso(id, cambios) {
  const { error } = await supabase.from("detectives_casos").update(cambios).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function actualizarParada(id, cambios) {
  const { error } = await supabase.from("detectives_paradas").update(cambios).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function actualizarSospechoso(id, cambios) {
  const { error } = await supabase.from("detectives_sospechosos").update(cambios).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function borrarCaso(id) {
  const { error } = await supabase.from("detectives_casos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- ambientaciones ----------
export const AMBIENTES = {
  oakhaven: { label: "Comarca de Oakhaven", emoji: "🏰", fondo: "linear-gradient(135deg,#1e1b4b,#4c1d95)", descr: "un reino medieval con plazas, bibliotecas, herrerías y torres" },
  valores: { label: "Colegio y valores", emoji: "🏫", fondo: "linear-gradient(135deg,#0f3d3e,#115e59)", descr: "el colegio y el barrio: patio, biblioteca, tienda escolar, cancha y calles cercanas" },
  mundo: { label: "Vuelta al mundo", emoji: "🌍", fondo: "linear-gradient(135deg,#7c2d12,#b45309)", descr: "un viaje por distintas ciudades del mundo (mercados, museos, puertos, estaciones)" },
};

// ---------- instrucciones para pedirle el caso a cualquier IA (sin API) ----------
export function instruccionesIA({ tema, grado, materia, ambientacion = "oakhaven", paradas = 4 }) {
  const amb = AMBIENTES[ambientacion] || AMBIENTES.oakhaven;
  return `Eres diseñador de juegos educativos. Crea un CASO DE DETECTIVES original para estudiantes de ${grado || "secundaria"}${materia ? `, materia: ${materia}` : ""}.
TEMA que deben aprender: ${tema || "(escribe aquí el tema)"}.
AMBIENTACIÓN: ${amb.label} — ${amb.descr}.
Reglas:
- Historia y villano ORIGINALES (no uses personajes de otras historias ni marcas). Tono apto para menores.
- ${paradas} paradas. En cada parada el estudiante responde UNA pregunta de opción múltiple (3 o 4 opciones) sobre el tema; si acierta, un testigo le da una pista que apunta al siguiente lugar y un rasgo del culpable.
- Cada parada tiene "destinos": 3 o 4 lugares posibles a donde viajar; "destino_ok" debe ser uno de ellos y la pista del testigo debe permitir deducirlo (sin nombrarlo de forma obvia).
- La última parada también lleva destinos; su pista apunta al escondite del culpable.
- Exactamente 4 sospechosos; solo UNO es culpable y es el único que reúne TODOS los rasgos descubiertos (uno por parada). Cada inocente debe fallar en al menos un rasgo.
- "correcta" debe ser idéntica a una de las "opciones". "retro" explica en 1 frase por qué.
- Responde SOLO con JSON válido (sin texto antes ni después, sin comentarios), con esta forma exacta:
{
  "titulo": "…",
  "historia": "Introducción de 3 a 5 frases: qué pasó y quién es el villano.",
  "paradas": [
    { "lugar": "…", "emoji": "🏛️", "escena": "Descripción corta del sitio.", "testigo": "Nombre o rol del testigo",
      "pregunta": "…", "opciones": ["…","…","…"], "correcta": "…", "retro": "…",
      "pista": "Lo que dice el testigo.", "rasgo": "Rasgo del culpable (corto)",
      "destinos": ["…","…","…"], "destino_ok": "…" }
  ],
  "sospechosos": [
    { "nombre": "…", "emoji": "🧑", "rasgos": ["…","…"], "culpable": false }
  ]
}`;
}

const limpio = (v, max) => String(v ?? "").trim().slice(0, max);

// Lee lo que pegó el docente: tolera texto alrededor y cercos ```json. Devuelve { caso, errores, avisos }.
export function leerCasoIA(texto, ambientacion = "oakhaven") {
  const errores = [], avisos = [];
  let obj = null;
  try {
    const t = String(texto || "");
    const i = t.indexOf("{"), f = t.lastIndexOf("}");
    if (i < 0 || f < i) throw new Error("no hay JSON");
    obj = JSON.parse(t.slice(i, f + 1));
  } catch { return { caso: null, errores: ["No pude leer el JSON. Copia la respuesta completa de la IA, desde la primera { hasta la última }."], avisos }; }
  const paradas = (Array.isArray(obj.paradas) ? obj.paradas : []).slice(0, 12).map((p, k) => {
    const opciones = (Array.isArray(p.opciones) ? p.opciones : []).map((o) => limpio(o, 200)).filter(Boolean).slice(0, 5);
    const destinos = (Array.isArray(p.destinos) ? p.destinos : []).map((o) => limpio(o, 80)).filter(Boolean).slice(0, 6);
    const q = {
      lugar: limpio(p.lugar, 80), emoji: limpio(p.emoji, 8) || "📍", escena: limpio(p.escena, 700), testigo: limpio(p.testigo, 80) || "Un testigo",
      pregunta: limpio(p.pregunta, 500), opciones, correcta: limpio(p.correcta, 200), retro: limpio(p.retro, 400), pista: limpio(p.pista, 600), rasgo: limpio(p.rasgo, 120),
      destinos, destino_ok: limpio(p.destino_ok, 80),
    };
    const n = `Parada ${k + 1}`;
    if (!q.lugar) errores.push(`${n}: falta el lugar.`);
    if (!q.pregunta) errores.push(`${n}: falta la pregunta.`);
    if (opciones.length < 2) errores.push(`${n}: necesita al menos 2 opciones.`);
    if (!opciones.includes(q.correcta)) errores.push(`${n}: la respuesta correcta no coincide con ninguna opción.`);
    if (destinos.length < 2) errores.push(`${n}: necesita al menos 2 destinos.`);
    if (!destinos.includes(q.destino_ok)) errores.push(`${n}: el destino correcto no está entre los destinos.`);
    if (!q.pista) avisos.push(`${n}: no tiene pista.`);
    if (!q.rasgo) avisos.push(`${n}: no descubre ningún rasgo del culpable.`);
    return q;
  });
  if (paradas.length < 2) errores.push("El caso necesita al menos 2 paradas.");
  const sospechosos = (Array.isArray(obj.sospechosos) ? obj.sospechosos : []).slice(0, 8).map((s) => ({
    nombre: limpio(s.nombre, 60), emoji: limpio(s.emoji, 8) || "🕵️",
    rasgos: (Array.isArray(s.rasgos) ? s.rasgos : []).map((r) => limpio(r, 120)).filter(Boolean).slice(0, 8), culpable: s.culpable === true,
  }));
  if (sospechosos.length < 3) errores.push("Faltan sospechosos (mínimo 3).");
  if (sospechosos.some((s) => !s.nombre)) errores.push("Hay un sospechoso sin nombre.");
  const culp = sospechosos.filter((s) => s.culpable);
  if (culp.length !== 1) errores.push(`Debe haber exactamente 1 culpable (hay ${culp.length}).`);
  else {
    const rasgos = paradas.map((p) => p.rasgo).filter(Boolean);
    const falta = rasgos.filter((r) => !culp[0].rasgos.includes(r));
    if (falta.length) avisos.push(`El culpable no tiene estos rasgos descubiertos: ${falta.join("; ")}.`);
    sospechosos.filter((s) => !s.culpable).forEach((s) => { if (rasgos.length && rasgos.every((r) => s.rasgos.includes(r))) avisos.push(`«${s.nombre}» también reúne todos los rasgos: el caso tendría dos soluciones.`); });
  }
  if (!limpio(obj.titulo, 120)) errores.push("Falta el título.");
  return { caso: { titulo: limpio(obj.titulo, 120), ambientacion, historia: limpio(obj.historia, 2500), vidas: 5, xp: 40, oro: 20, paradas, sospechosos }, errores, avisos };
}

// ---------- caso de ejemplo (Ética, 8.º) ----------
export const CASO_EJEMPLO = {
  titulo: "El robo de la Campana de la Honestidad",
  ambientacion: "oakhaven",
  historia: "Cada amanecer, la Campana de la Honestidad suena sobre Oakhaven y nadie puede mentir mientras vibra su eco. Anoche desapareció. Tras el robo quedó una nota firmada solo con una sombra: «Sin la campana, las mentiras serán la ley». Eres el detective del Códice y tienes poco tiempo. Responde bien a cada testigo, deduce a dónde huyó el ladrón y arréstalo antes de que se agoten tus horas.",
  vidas: 5, xp: 40, oro: 20,
  paradas: [
    { lugar: "Plaza de Oakhaven", emoji: "🏛️", escena: "La plaza amaneció en silencio. Donde colgaba la campana solo queda una cuerda cortada.", testigo: "Mara, la vendedora de flores",
      pregunta: "Un compañero encuentra una billetera con dinero y nadie lo ve. ¿Qué acción muestra honestidad?",
      opciones: ["Quedarse con el dinero porque nadie lo vio", "Devolverla a su dueño o entregarla a una autoridad", "Gastar solo la mitad", "Dejarla donde estaba"], correcta: "Devolverla a su dueño o entregarla a una autoridad",
      retro: "La honestidad es actuar con verdad y justicia aunque nadie nos esté mirando.",
      pista: "Vi a alguien con una capa verde cruzar la plaza. Murmuró que necesitaba «un lugar lleno de libros antiguos» para esconderse.", rasgo: "Lleva una capa verde",
      destinos: ["Biblioteca Antigua", "Mercado del Puerto", "Herrería del Norte"], destino_ok: "Biblioteca Antigua" },
    { lugar: "Biblioteca Antigua", emoji: "📚", escena: "Estantes altísimos y olor a papel viejo. Sobre una mesa hay un pañuelo olvidado.", testigo: "Don Eustaquio, el bibliotecario",
      pregunta: "¿Qué significa ser una persona responsable?",
      opciones: ["Cumplir mis compromisos y asumir las consecuencias de mis decisiones", "Echarle la culpa a otro cuando algo sale mal", "Hacer solo lo que me conviene", "Prometer mucho y cumplir poco"], correcta: "Cumplir mis compromisos y asumir las consecuencias de mis decisiones",
      retro: "Responsabilidad es responder por lo que hago, para bien y para mal.",
      pista: "El pañuelo huele a menta. El encapuchado preguntó dónde se forja el hierro más fuerte de la comarca.", rasgo: "Huele a menta",
      destinos: ["Taberna del Roble", "Herrería del Norte", "Jardines del Castillo"], destino_ok: "Herrería del Norte" },
    { lugar: "Herrería del Norte", emoji: "⚒️", escena: "El yunque aún está tibio. Hay huellas irregulares en la ceniza, como de alguien que arrastra un pie.", testigo: "Brunilda, la herrera",
      pregunta: "¿Qué es la empatía?",
      opciones: ["Ponerme en el lugar del otro y comprender lo que siente", "Reírme de lo que le pasa a los demás", "Opinar siempre sin escuchar", "Ayudar solo a mis amigos"], correcta: "Ponerme en el lugar del otro y comprender lo que siente",
      retro: "La empatía nos permite entender al otro y actuar con cuidado hacia sus sentimientos.",
      pista: "Cojeaba de la pierna izquierda y dejó una moneda de pago sobre el yunque. Dijo que iba a ver el río desde lo alto.", rasgo: "Cojea de la pierna izquierda",
      destinos: ["Mirador del Río", "Puerto de Oakhaven", "Cripta Vieja"], destino_ok: "Mirador del Río" },
    { lugar: "Mirador del Río", emoji: "🌉", escena: "Desde aquí se ve toda la comarca. En la baranda quedó marcado un anillo de plata.", testigo: "Un guardia que patrulla",
      pregunta: "Un grupo excluye a un compañero por pensar distinto. ¿Qué valor falta en esa situación?",
      opciones: ["Respeto", "Competencia", "Rapidez", "Orgullo"], correcta: "Respeto",
      retro: "El respeto reconoce la dignidad de todas las personas, aunque piensen o sean distintas.",
      pista: "Llevaba un anillo de plata y se dirigió a la torre más alta, donde el reloj marca la hora de los secretos.", rasgo: "Usa un anillo de plata",
      destinos: ["Torre del Reloj", "Establos Reales", "Fuente de los Deseos"], destino_ok: "Torre del Reloj" },
  ],
  sospechosos: [
    { nombre: "Valeria Brisa", emoji: "🧙‍♀️", rasgos: ["Lleva una capa verde", "Huele a menta", "Cojea de la pierna izquierda", "Usa un anillo de plata"], culpable: true },
    { nombre: "Teodoro Roble", emoji: "🧔", rasgos: ["Lleva una capa verde", "Huele a menta", "Cojea de la pierna izquierda", "Usa una bufanda roja"], culpable: false },
    { nombre: "Isolda Nube", emoji: "👩‍🎤", rasgos: ["Lleva una capa azul", "Huele a menta", "Cojea de la pierna izquierda", "Usa un anillo de plata"], culpable: false },
    { nombre: "Bruno Ceniza", emoji: "🧑‍🔧", rasgos: ["Lleva una capa verde", "Huele a lavanda", "Cojea de la pierna derecha", "Usa un anillo de plata"], culpable: false },
  ],
};
