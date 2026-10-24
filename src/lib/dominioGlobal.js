// Tablero Mundial — motor del juego (funciones puras sobre un objeto "estado" serializable a JSON)
// Fases por ronda: evento → acciones → votacion → (siguiente ronda) ... → fin

export const REGIONES = {
  americas: { nombre: "Américas", bonus: 3 },
  europa: { nombre: "Europa", bonus: 2 },
  africa: { nombre: "África", bonus: 3 },
  asia: { nombre: "Asia", bonus: 4 },
  oceania: { nombre: "Oceanía", bonus: 1 },
};

export const TERRITORIOS = [
  { id: "NA", nombre: "Norteamérica", region: "americas", x: 170, y: 110, valor: 3 },
  { id: "MC", nombre: "México y Centroamérica", region: "americas", x: 150, y: 215, valor: 1 },
  { id: "CA", nombre: "Caribe", region: "americas", x: 255, y: 235, valor: 1 },
  { id: "AN", nombre: "Colombia y Andes", region: "americas", x: 245, y: 320, valor: 2 },
  { id: "AZ", nombre: "Amazonía", region: "americas", x: 330, y: 385, valor: 2 },
  { id: "CS", nombre: "Cono Sur", region: "americas", x: 285, y: 480, valor: 2 },
  { id: "ES", nombre: "Escandinavia", region: "europa", x: 470, y: 70, valor: 1 },
  { id: "EO", nombre: "Europa Occidental", region: "europa", x: 470, y: 150, valor: 3 },
  { id: "EE", nombre: "Europa Oriental", region: "europa", x: 565, y: 130, valor: 2 },
  { id: "ME", nombre: "Mediterráneo", region: "europa", x: 520, y: 238, valor: 2 },
  { id: "NF", nombre: "Norte de África", region: "africa", x: 490, y: 300, valor: 2 },
  { id: "AO", nombre: "África Occidental", region: "africa", x: 430, y: 350, valor: 1 },
  { id: "AC", nombre: "África Central", region: "africa", x: 520, y: 385, valor: 1 },
  { id: "AE", nombre: "África Oriental", region: "africa", x: 595, y: 345, valor: 1 },
  { id: "AA", nombre: "África Austral", region: "africa", x: 535, y: 470, valor: 2 },
  { id: "SI", nombre: "Siberia", region: "asia", x: 770, y: 80, valor: 1 },
  { id: "ACE", nombre: "Asia Central", region: "asia", x: 680, y: 175, valor: 1 },
  { id: "OM", nombre: "Oriente Medio", region: "asia", x: 615, y: 255, valor: 3 },
  { id: "IN", nombre: "India", region: "asia", x: 700, y: 290, valor: 2 },
  { id: "CH", nombre: "China", region: "asia", x: 785, y: 195, valor: 3 },
  { id: "SE", nombre: "Sudeste Asiático", region: "asia", x: 790, y: 335, valor: 2 },
  { id: "JK", nombre: "Japón y Corea", region: "asia", x: 890, y: 185, valor: 2 },
  { id: "AU", nombre: "Australia", region: "oceania", x: 840, y: 455, valor: 2 },
  { id: "PA", nombre: "Pacífico", region: "oceania", x: 935, y: 335, valor: 1 },
];

export const ENLACES = [
  ["NA", "MC"], ["NA", "CA"], ["NA", "ES"], ["NA", "EO"], ["NA", "PA"], ["MC", "CA"], ["MC", "AN"], ["CA", "AN"], ["AN", "AZ"], ["AN", "CS"], ["AZ", "CS"], ["AZ", "AO"],
  ["EO", "EE"], ["EO", "ES"], ["EO", "ME"], ["EE", "ES"], ["EE", "ME"], ["EE", "SI"], ["EE", "ACE"], ["ME", "NF"], ["ME", "OM"],
  ["NF", "AO"], ["NF", "AE"], ["NF", "OM"], ["AO", "AC"], ["AC", "AE"], ["AC", "AA"], ["AE", "AA"], ["AE", "OM"],
  ["OM", "ACE"], ["OM", "IN"], ["ACE", "IN"], ["ACE", "CH"], ["ACE", "SI"], ["IN", "CH"], ["IN", "SE"], ["CH", "SE"], ["CH", "JK"], ["CH", "SI"], ["SI", "JK"],
  ["SE", "AU"], ["SE", "PA"], ["JK", "PA"], ["AU", "PA"],
];
export const mapaTerr = Object.fromEntries(TERRITORIOS.map((t) => [t.id, t]));
export function vecinos(id) {
  return ENLACES.filter((e) => e.includes(id)).map((e) => (e[0] === id ? e[1] : e[0]));
}

export const COLORES = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#4b5563", "#65a30d", "#ea580c", "#0d9488", "#9333ea"];

// ---------------------------------------------------------------- Cartas
const ef = (ejercitos = 0, recursos = 0, paz = 0, etica = 0) => ({ ejercitos, recursos, paz, etica });
export const TIPOS_CARTA = { etica: "Dilema ético", interreligioso: "Diálogo interreligioso y cultural", crisis: "Crisis mundial" };

export const CARTAS_BASE = [
  // --- Dilemas éticos
  { id: "e1", tipo: "etica", titulo: "El tesoro del vecino", texto: "Una nación vecina, en plena crisis, descubre una gran reserva de agua potable. Tu nación puede apoyarla, ignorarla o presionarla para quedarse con parte.", opciones: [
    { texto: "Ofrecer cooperación técnica y compartir los beneficios", efectos: ef(0, -1, 4, 6) }, { texto: "Mirar hacia otro lado: no es asunto nuestro", efectos: ef(0, 0, 0, -1) }, { texto: "Presionar con tropas en la frontera para exigir una parte", efectos: ef(1, 3, -5, -7) }] },
  { id: "e2", tipo: "etica", titulo: "Sanciones que duelen a los inocentes", texto: "Un gobierno vulnera derechos humanos. Sancionarlo presionaría al régimen, pero también dejaría sin medicinas a su población.", opciones: [
    { texto: "Sanciones dirigidas solo a los responsables y ayuda a la población", efectos: ef(0, -1, 3, 5) }, { texto: "Sanciones totales hasta que cambie", efectos: ef(0, 1, -3, -2) }, { texto: "No hacer nada y seguir comerciando", efectos: ef(0, 3, 0, -6) }] },
  { id: "e3", tipo: "etica", titulo: "Armas para quien pague", texto: "Un comprador ofrece mucho dinero por armas, pero podrían usarse contra civiles.", opciones: [
    { texto: "Rechazar la venta y exigir garantías de uso pacífico", efectos: ef(0, 0, 3, 5) }, { texto: "Vender solo armamento defensivo con controles", efectos: ef(0, 2, 0, 0) }, { texto: "Vender todo lo que pidan", efectos: ef(0, 5, -6, -7) }] },
  { id: "e4", tipo: "etica", titulo: "El espía descubierto", texto: "Tus servicios descubren que una nación aliada te espiaba. Puedes denunciarla, negociar en privado o vengarte.", opciones: [
    { texto: "Dialogar en privado y acordar reglas de confianza", efectos: ef(0, 0, 3, 4) }, { texto: "Denunciarla públicamente ante el mundo", efectos: ef(0, 0, -2, 1) }, { texto: "Sabotear sus comunicaciones en respuesta", efectos: ef(1, 0, -4, -5) }] },
  { id: "e5", tipo: "etica", titulo: "Recursos que se acaban", texto: "Un bosque compartido entre naciones se agota. Explotarlo hoy da riqueza; cuidarlo da futuro.", opciones: [
    { texto: "Proponer un pacto de protección y uso responsable", efectos: ef(0, -1, 4, 6) }, { texto: "Explotar solo tu parte con tecnología limpia", efectos: ef(0, 2, 0, 1) }, { texto: "Explotarlo ya, antes que los demás", efectos: ef(0, 5, -4, -6) }] },
  { id: "e6", tipo: "etica", titulo: "Verdad o victoria", texto: "Un error de tu ejército causó víctimas civiles. Admitirlo daña tu imagen; ocultarlo te protege por ahora.", opciones: [
    { texto: "Reconocerlo, investigar y reparar el daño", efectos: ef(0, -2, 2, 7) }, { texto: "Reconocerlo, pero sin reparar nada", efectos: ef(0, 0, -1, 1) }, { texto: "Ocultarlo y culpar al adversario", efectos: ef(1, 0, -5, -8) }] },
  // --- Interreligioso y cultural
  { id: "r1", tipo: "interreligioso", titulo: "Un lugar sagrado compartido", texto: "Dos comunidades de distinta fe veneran el mismo lugar y discuten quién puede acceder. Aparecen tensiones.", opciones: [
    { texto: "Crear un consejo de diálogo con representantes de ambas", efectos: ef(0, -1, 5, 6) }, { texto: "Reservar el lugar solo para la fe mayoritaria", efectos: ef(0, 0, -4, -6) }, { texto: "Cerrarlo a todos por seguridad", efectos: ef(0, 0, -1, -2) }] },
  { id: "r2", tipo: "interreligioso", titulo: "Fiestas que no son de todos", texto: "En tu nación conviven varias creencias. Una gran festividad religiosa choca con el calendario laboral de otra comunidad.", opciones: [
    { texto: "Reconocer los días festivos de todas las comunidades", efectos: ef(0, -1, 4, 5) }, { texto: "Mantener solo el calendario tradicional", efectos: ef(0, 1, -2, -3) }, { texto: "Prohibir las celebraciones públicas de cualquier fe", efectos: ef(0, 0, -5, -7) }] },
  { id: "r3", tipo: "interreligioso", titulo: "Mensajeros de fe", texto: "Un grupo religioso quiere hacer proselitismo en una región de otra creencia. Hay quejas de ambas partes.", opciones: [
    { texto: "Garantizar la libertad de creer y de no ser presionado", efectos: ef(0, 0, 4, 5) }, { texto: "Autorizar solo a la religión oficial", efectos: ef(0, 0, -3, -5) }, { texto: "Expulsar a los mensajeros", efectos: ef(1, 0, -4, -4) }] },
  { id: "r4", tipo: "interreligioso", titulo: "Refugiados de otra fe", texto: "Llegan miles de personas huyendo de la persecución por sus creencias. Piden asilo.", opciones: [
    { texto: "Acogerlos y facilitar su integración", efectos: ef(0, -2, 3, 7) }, { texto: "Acogerlos solo temporalmente en campamentos", efectos: ef(0, -1, 0, 2) }, { texto: "Cerrar la frontera", efectos: ef(1, 1, -3, -7) }] },
  { id: "r5", tipo: "interreligioso", titulo: "Símbolos en la escuela", texto: "Los estudiantes de distintas culturas piden poder usar sus símbolos y vestimentas en la escuela.", opciones: [
    { texto: "Permitirlos y enseñar a conocerse mutuamente", efectos: ef(0, 0, 4, 5) }, { texto: "Permitirlos solo a la mayoría", efectos: ef(0, 0, -2, -4) }, { texto: "Prohibir toda diferencia visible", efectos: ef(0, 0, -4, -5) }] },
  { id: "r6", tipo: "interreligioso", titulo: "Caricaturas y ofensas", texto: "Una publicación ofende profundamente a una comunidad de fe y estalla la indignación en las calles.", opciones: [
    { texto: "Promover diálogo, respeto mutuo y reparación pacífica", efectos: ef(0, 0, 5, 5) }, { texto: "Censurar ambas posturas por la fuerza", efectos: ef(1, 0, -3, -3) }, { texto: "Dejar que el conflicto escale", efectos: ef(0, 0, -6, -5) }] },
  // --- Crisis mundiales
  { id: "c1", tipo: "crisis", titulo: "Hambruna regional", texto: "Una sequía arrasa cultivos y miles de familias pasan hambre. El mundo mira qué hará cada nación.", opciones: [
    { texto: "Enviar ayuda alimentaria sin condiciones", efectos: ef(0, -2, 4, 6) }, { texto: "Enviar ayuda a cambio de acuerdos comerciales", efectos: ef(0, 1, 0, -1) }, { texto: "Cerrar fronteras y proteger lo propio", efectos: ef(1, 1, -3, -5) }] },
  { id: "c2", tipo: "crisis", titulo: "Pandemia", texto: "Un virus se extiende. Hay vacunas limitadas: compartirlas salva más vidas, acapararlas protege a los tuyos primero.", opciones: [
    { texto: "Compartir vacunas con las naciones más afectadas", efectos: ef(0, -2, 4, 7) }, { texto: "Compartir una parte y guardar otra", efectos: ef(0, 0, 1, 1) }, { texto: "Acaparar todas las dosis", efectos: ef(0, 3, -5, -7) }] },
  { id: "c3", tipo: "crisis", titulo: "Calentamiento global", texto: "Las costas se inundan. Reducir emisiones cuesta, pero esperar cuesta más.", opciones: [
    { texto: "Reducir emisiones y financiar a quienes más sufren", efectos: ef(0, -2, 4, 6) }, { texto: "Reducir emisiones solo si los demás también lo hacen", efectos: ef(0, 0, 1, 1) }, { texto: "Ignorar el problema para crecer más rápido", efectos: ef(0, 4, -4, -6) }] },
  { id: "c4", tipo: "crisis", titulo: "Terremoto devastador", texto: "Un terremoto destruye ciudades enteras. Hace falta ayuda urgente para rescatar y reconstruir.", opciones: [
    { texto: "Enviar rescatistas y recursos de inmediato", efectos: ef(0, -2, 4, 6) }, { texto: "Enviar ayuda simbólica", efectos: ef(0, 0, 0, 1) }, { texto: "Aprovechar para ocupar el territorio debilitado", efectos: ef(2, 0, -6, -9) }] },
  { id: "c5", tipo: "crisis", titulo: "Ciberataque mundial", texto: "Un ciberataque paraliza hospitales y bancos en varias naciones. Se acusa a un grupo sin pruebas claras.", opciones: [
    { texto: "Compartir inteligencia y buscar pruebas con todos", efectos: ef(0, -1, 3, 5) }, { texto: "Culpar a la nación más rival", efectos: ef(1, 0, -4, -5) }, { texto: "Guardar silencio y reforzar solo tus defensas", efectos: ef(0, 0, -1, -1) }] },
  { id: "c6", tipo: "crisis", titulo: "Crisis de refugiados climáticos", texto: "Islas que se hunden obligan a miles de familias a buscar nuevos hogares.", opciones: [
    { texto: "Abrir cupos de acogida y programas de integración", efectos: ef(0, -2, 3, 7) }, { texto: "Aceptar solo trabajadores calificados", efectos: ef(0, 1, -1, -2) }, { texto: "Negarse a recibirlos", efectos: ef(1, 1, -3, -6) }] },
];

// ---------------------------------------------------------------- Declaratorias
export const DECLARATORIAS = {
  cese: { nombre: "Cese al fuego mundial", texto: "Nadie ataca durante la próxima ronda.", objetivo: false },
  sancion: { nombre: "Sanción contra una nación", texto: "La nación señalada no podrá reforzarse la próxima ronda y pierde 30 % de sus recursos.", objetivo: true },
  humanitario: { nombre: "Corredor humanitario", texto: "Todas ceden 1 recurso; lo recaudado va a las dos naciones con menos territorios.", objetivo: false },
  libertad: { nombre: "Declaración de libertad religiosa y cultural", texto: "Todas las naciones ganan ética y paz.", objetivo: false },
  desarme: { nombre: "Desarme parcial", texto: "Todo territorio con más de 3 ejércitos retira 1; sube la paz mundial.", objetivo: false },
  intervencion: { nombre: "Intervención colectiva contra un agresor", texto: "La nación señalada pierde ética y paz; las que votaron sí reciben un ejército.", objetivo: true },
};

// ---------------------------------------------------------------- Utilidades
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const barajar = (arr, rng = Math.random) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clon = (o) => JSON.parse(JSON.stringify(o));
export function territoriosDe(e, nid) { return Object.keys(e.terr).filter((t) => e.terr[t].d === nid); }
export function ejercitosDe(e, nid) { return territoriosDe(e, nid).reduce((s, t) => s + e.terr[t].t, 0); }
export function sonAliadas(e, a, b) { return (e.alianzas || []).some(([x, y]) => (x === a && y === b) || (x === b && y === a)); }
function log(e, txt) { e.bitacora.push({ r: e.ronda, txt }); if (e.bitacora.length > 160) e.bitacora = e.bitacora.slice(-160); }
const nom = (e, nid) => e.naciones[nid]?.nombre || nid;

// ---------------------------------------------------------------- Crear
export function armarMazo({ tipos = Object.keys(TIPOS_CARTA), propias = [], rondas = 8, rng = Math.random } = {}) {
  const base = CARTAS_BASE.filter((c) => tipos.includes(c.tipo));
  let mazo = barajar([...base, ...propias], rng);
  // intercala tipos para que no salgan seguidas del mismo
  while (mazo.length < rondas) mazo = mazo.concat(barajar([...base, ...propias], rng));
  return mazo.slice(0, Math.max(rondas, 1));
}

export function crearEstado({ naciones, rondasMax = 8, victoria = "ambas", mazo, rng = Math.random }) {
  if (!naciones?.length || naciones.length < 2) throw new Error("Se necesitan al menos 2 naciones.");
  if (naciones.length > 12) throw new Error("Máximo 12 naciones.");
  const e = {
    ronda: 1, fase: "evento", rondasMax, victoria, terr: {}, naciones: {}, orden: naciones.map((n) => n.id), alianzas: [], mazo: [], carta: null,
    cese: false, sanciones: {}, propuestas: [], bitacora: [], fin: null,
  };
  naciones.forEach((n, i) => { e.naciones[n.id] = { id: n.id, nombre: n.nombre, color: n.color || COLORES[i % COLORES.length], miembros: n.miembros || [], recursos: 3, paz: 50, etica: 50, eliminada: false }; });
  // reparto de territorios equilibrado
  const ids = barajar(TERRITORIOS.map((t) => t.id), rng);
  ids.forEach((t, i) => { e.terr[t] = { d: e.orden[i % e.orden.length], t: 2 }; });
  // ejércitos iniciales extra
  e.orden.forEach((nid) => { const ts = territoriosDe(e, nid); for (let k = 0; k < 3; k++) e.terr[ts[Math.floor(rng() * ts.length)]].t += 1; });
  e.mazo = clon(mazo || armarMazo({ rondas: rondasMax, rng }));
  e.carta = e.mazo.shift() || null;
  log(e, `Comienza la partida con ${e.orden.length} naciones y ${TERRITORIOS.length} territorios.`);
  if (e.carta) log(e, `Carta de la ronda 1: «${e.carta.titulo}».`);
  return e;
}

// ---------------------------------------------------------------- Fase 1: evento
function sumarEjercitos(e, nid, n, rng) {
  const ts = territoriosDe(e, nid);
  if (!ts.length) return;
  if (n > 0) { for (let i = 0; i < n; i++) { const t = ts.sort((a, b) => e.terr[a].t - e.terr[b].t)[0]; e.terr[t].t += 1; } }
  else { for (let i = 0; i < -n; i++) { const t = ts.sort((a, b) => e.terr[b].t - e.terr[a].t)[0]; if (e.terr[t].t > 1) e.terr[t].t -= 1; } }
}
export function aplicarEfectos(e, nid, ef0, rng = Math.random) {
  const n = e.naciones[nid]; if (!n) return;
  const f = { ejercitos: 0, recursos: 0, paz: 0, etica: 0, ...ef0 };
  sumarEjercitos(e, nid, Number(f.ejercitos) || 0, rng);
  n.recursos = Math.max(0, n.recursos + (Number(f.recursos) || 0));
  n.paz = clamp(n.paz + (Number(f.paz) || 0));
  n.etica = clamp(n.etica + (Number(f.etica) || 0));
}

// acciones: [{nacion, tipo:'evento', payload:{opcion}}]
export function aplicarEvento(estado, acciones = [], rng = Math.random) {
  const e = clon(estado);
  if (e.fase !== "evento") throw new Error("No estamos en la fase de evento.");
  const c = e.carta;
  if (!c) { e.fase = "acciones"; return e; }
  const elegidas = {};
  acciones.filter((a) => a.tipo === "evento").forEach((a) => { elegidas[a.nacion] = Number(a.payload?.opcion); });
  e.orden.forEach((nid) => {
    const i = elegidas[nid];
    if (Number.isInteger(i) && c.opciones[i]) {
      aplicarEfectos(e, nid, c.opciones[i].efectos, rng);
      log(e, `${nom(e, nid)} eligió: «${c.opciones[i].texto}».`);
    } else {
      aplicarEfectos(e, nid, { paz: -2, etica: -2 }, rng);
      log(e, `${nom(e, nid)} no se pronunció ante «${c.titulo}»: la indecisión cuesta ética y paz.`);
    }
  });
  e.fase = "acciones";
  return e;
}

// ---------------------------------------------------------------- Fase 2: acciones
function refuerzosDe(e, nid) {
  const ts = territoriosDe(e, nid);
  let r = Math.max(2, Math.floor(ts.length / 3));
  Object.entries(REGIONES).forEach(([rid, info]) => {
    const todos = TERRITORIOS.filter((t) => t.region === rid).map((t) => t.id);
    if (todos.every((t) => ts.includes(t))) r += info.bonus;
  });
  return r;
}
export { refuerzosDe };

export function batalla(atq, def, rng = Math.random) {
  let a = atq, d = def, rondas = 0;
  const dado = () => Math.floor(rng() * 6) + 1;
  while (a > 0 && d > 0 && rondas < 200) {
    const da = Array.from({ length: Math.min(3, a) }, dado).sort((x, y) => y - x);
    const dd = Array.from({ length: Math.min(2, d) }, dado).sort((x, y) => y - x);
    for (let i = 0; i < Math.min(da.length, dd.length); i++) { if (da[i] > dd[i]) d--; else a--; }
    rondas++;
  }
  return { atq: a, def: d };
}

// acciones: refuerzo{terr,n} · ataque{desde,hacia,n} · ayuda{a,cantidad} · pacto{con,tipo:'alianza'|'romper'} · propuesta{tipo,objetivo?}
export function resolverAcciones(estado, acciones = [], rng = Math.random) {
  const e = clon(estado);
  if (e.fase !== "acciones") throw new Error("No estamos en la fase de acciones.");
  const vivas = e.orden.filter((n) => !e.naciones[n].eliminada);

  // 1) ingresos y refuerzos
  vivas.forEach((nid) => {
    const ts = territoriosDe(e, nid);
    e.naciones[nid].recursos += ts.reduce((s, t) => s + (mapaTerr[t].valor > 1 ? 1 : 0), 0) || 1;
    if (e.sanciones[nid]) { log(e, `${nom(e, nid)} está sancionada: no recibe refuerzos esta ronda.`); return; }
    let cupo = refuerzosDe(e, nid);
    acciones.filter((a) => a.nacion === nid && a.tipo === "refuerzo").forEach((a) => {
      const t = a.payload?.terr; const n = Math.max(0, Math.min(cupo, parseInt(a.payload?.n, 10) || 0));
      if (e.terr[t]?.d === nid && n > 0) { e.terr[t].t += n; cupo -= n; }
    });
    if (cupo > 0) { const ts2 = territoriosDe(e, nid).sort((x, y) => e.terr[x].t - e.terr[y].t); ts2.slice(0, 1).forEach((t) => { e.terr[t].t += cupo; }); }
    log(e, `${nom(e, nid)} recibe refuerzos y recursos.`);
  });

  // 2) ayudas
  acciones.filter((a) => a.tipo === "ayuda").forEach((a) => {
    const de = e.naciones[a.nacion], para = e.naciones[a.payload?.a];
    const q = Math.max(0, parseInt(a.payload?.cantidad, 10) || 0);
    if (!de || !para || de === para || q <= 0 || de.recursos < q) return;
    de.recursos -= q; para.recursos += q;
    de.etica = clamp(de.etica + Math.min(6, q * 2)); para.paz = clamp(para.paz + 1);
    log(e, `${de.nombre} envió ${q} recurso(s) de ayuda a ${para.nombre}.`);
  });

  // 3) pactos: alianza solo si es mutua; romper es unilateral
  const quiere = new Set(acciones.filter((a) => a.tipo === "pacto" && a.payload?.tipo === "alianza").map((a) => `${a.nacion}>${a.payload?.con}`));
  quiere.forEach((k) => {
    const [x, y] = k.split(">");
    if (x < y && quiere.has(`${y}>${x}`) && e.naciones[x] && e.naciones[y] && !sonAliadas(e, x, y)) {
      e.alianzas.push([x, y]); e.naciones[x].etica = clamp(e.naciones[x].etica + 2); e.naciones[y].etica = clamp(e.naciones[y].etica + 2);
      log(e, `Alianza entre ${nom(e, x)} y ${nom(e, y)}.`);
    }
  });
  acciones.filter((a) => a.tipo === "pacto" && a.payload?.tipo === "romper").forEach((a) => {
    const antes = e.alianzas.length;
    e.alianzas = e.alianzas.filter(([x, y]) => !((x === a.nacion && y === a.payload?.con) || (y === a.nacion && x === a.payload?.con)));
    if (e.alianzas.length < antes) { e.naciones[a.nacion].etica = clamp(e.naciones[a.nacion].etica - 2); log(e, `${nom(e, a.nacion)} rompió su alianza con ${nom(e, a.payload.con)}.`); }
  });

  // 4) ataques
  acciones.filter((a) => a.tipo === "ataque").forEach((a) => {
    const { desde, hacia } = a.payload || {}; let n = parseInt(a.payload?.n, 10) || 0;
    if (e.cese) { log(e, `Ataque de ${nom(e, a.nacion)} cancelado: rige el cese al fuego mundial.`); return; }
    if (!e.terr[desde] || !e.terr[hacia] || e.terr[desde].d !== a.nacion) return;
    const defNid = e.terr[hacia].d;
    if (defNid === a.nacion || !vecinos(desde).includes(hacia)) return;
    if (sonAliadas(e, a.nacion, defNid)) { log(e, `${nom(e, a.nacion)} no puede atacar a su aliada ${nom(e, defNid)} (debe romper la alianza antes).`); return; }
    n = Math.min(n, e.terr[desde].t - 1);
    if (n < 1) return;
    const res = batalla(n, e.terr[hacia].t, rng);
    const A = e.naciones[a.nacion], D = e.naciones[defNid];
    A.etica = clamp(A.etica - 3); D.paz = clamp(D.paz - 5);
    if (res.def === 0) {
      e.terr[desde].t -= n; e.terr[hacia] = { d: a.nacion, t: res.atq };
      A.etica = clamp(A.etica - 2);
      log(e, `${A.nombre} conquistó ${mapaTerr[hacia].nombre} a ${D.nombre}.`);
      if (!territoriosDe(e, defNid).length) {
        D.eliminada = true; A.recursos += D.recursos; D.recursos = 0;
        e.alianzas = e.alianzas.filter(([x, y]) => x !== defNid && y !== defNid);
        log(e, `${D.nombre} perdió todos sus territorios: sus habitantes quedan como refugiados y aún pueden votar.`);
      }
    } else {
      e.terr[desde].t -= (n - res.atq); e.terr[hacia].t = res.def;
      log(e, `${A.nombre} atacó ${mapaTerr[hacia].nombre} (${D.nombre}) y fue rechazada.`);
    }
  });

  // 5) propuestas de declaratoria (una por nación, máx. 5)
  e.propuestas = [];
  acciones.filter((a) => a.tipo === "propuesta").forEach((a) => {
    const d = DECLARATORIAS[a.payload?.tipo];
    if (!d || e.propuestas.length >= 5 || e.propuestas.some((p) => p.por === a.nacion)) return;
    if (d.objetivo && !e.naciones[a.payload?.objetivo]) return;
    e.propuestas.push({ id: `p${e.ronda}_${e.propuestas.length + 1}`, tipo: a.payload.tipo, por: a.nacion, objetivo: d.objetivo ? a.payload.objetivo : null });
  });
  e.propuestas.forEach((p) => log(e, `${nom(e, p.por)} propone: «${DECLARATORIAS[p.tipo].nombre}»${p.objetivo ? ` contra ${nom(e, p.objetivo)}` : ""}.`));
  e.fase = e.propuestas.length ? "votacion" : "cierre";
  return e;
}

// ---------------------------------------------------------------- Fase 3: votación y cierre
// acciones: voto{propuesta, voto:'si'|'no'|'abs'} (payload.propuesta, payload.voto)
export function cerrarRonda(estado, acciones = [], rng = Math.random, extra = []) {
  const e = clon(estado);
  if (e.fase !== "votacion" && e.fase !== "cierre") throw new Error("Aún no se pueden cerrar las votaciones.");
  e.cese = false; e.sanciones = {};
  const todas = [...e.propuestas, ...extra];
  todas.forEach((p) => {
    const d = DECLARATORIAS[p.tipo] || { nombre: p.titulo || "Declaratoria del docente" };
    const votos = { si: [], no: [], abs: [] };
    e.orden.forEach((nid) => {
      const v = acciones.find((a) => a.tipo === "voto" && a.nacion === nid && a.payload?.propuesta === p.id)?.payload?.voto;
      if (nid === p.por) votos.si.push(nid); else if (v === "si" || v === "no") votos[v].push(nid); else votos.abs.push(nid);
    });
    const ok = p.docente ? true : votos.si.length > votos.no.length;
    log(e, `Votación «${d.nombre}»: ${votos.si.length} a favor, ${votos.no.length} en contra, ${votos.abs.length} abstenciones → ${ok ? "APROBADA" : "RECHAZADA"}.`);
    if (!ok) return;
    const todasN = e.orden.filter((n) => !e.naciones[n].eliminada || true);
    if (p.tipo === "cese") { e.cese = true; todasN.forEach((n) => aplicarEfectos(e, n, { paz: 5 }, rng)); }
    else if (p.tipo === "sancion" && p.objetivo) { e.sanciones[p.objetivo] = true; const o = e.naciones[p.objetivo]; o.recursos = Math.floor(o.recursos * 0.7); votos.si.forEach((n) => aplicarEfectos(e, n, { etica: 1 }, rng)); }
    else if (p.tipo === "humanitario") {
      let pozo = 0; todasN.forEach((n) => { if (e.naciones[n].recursos > 0) { e.naciones[n].recursos -= 1; pozo += 1; } aplicarEfectos(e, n, { etica: 2, paz: 3 }, rng); });
      const pobres = e.orden.filter((n) => !e.naciones[n].eliminada).sort((a, b) => territoriosDe(e, a).length - territoriosDe(e, b).length).slice(0, 2);
      pobres.forEach((n, i) => { e.naciones[n].recursos += Math.floor(pozo / pobres.length) + (i === 0 ? pozo % pobres.length : 0); });
    }
    else if (p.tipo === "libertad") todasN.forEach((n) => aplicarEfectos(e, n, { etica: 4, paz: 3 }, rng));
    else if (p.tipo === "desarme") { Object.values(e.terr).forEach((t) => { if (t.t > 3) t.t -= 1; }); todasN.forEach((n) => aplicarEfectos(e, n, { paz: 6 }, rng)); }
    else if (p.tipo === "intervencion" && p.objetivo) { aplicarEfectos(e, p.objetivo, { etica: -5, paz: -5 }, rng); votos.si.forEach((n) => aplicarEfectos(e, n, { ejercitos: 1 }, rng)); }
    else if (p.docente) { e.orden.forEach((n) => aplicarEfectos(e, n, p.efectos || {}, rng)); }
  });
  e.propuestas = [];

  // ¿fin del juego?
  const vivas = e.orden.filter((n) => !e.naciones[n].eliminada);
  const dominio = vivas.find((n) => territoriosDe(e, n).length >= Math.ceil(TERRITORIOS.length * 0.6));
  if (e.ronda >= e.rondasMax || vivas.length <= 1 || (dominio && e.victoria !== "equilibrio")) {
    e.fase = "fin"; e.carta = null; e.fin = resultados(e);
    log(e, "La partida terminó. Revisen los resultados y conversen sobre lo vivido.");
    return e;
  }
  e.ronda += 1; e.fase = "evento"; e.carta = e.mazo.shift() || null;
  if (e.carta) log(e, `Carta de la ronda ${e.ronda}: «${e.carta.titulo}».`);
  return e;
}

// ---------------------------------------------------------------- Puntajes
export function paxMundial(e) {
  const v = e.orden.map((n) => e.naciones[n].paz); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}
export function puntajes(e) {
  const colapso = paxMundial(e) < 25;
  return e.orden.map((nid) => {
    const n = e.naciones[nid], ts = territoriosDe(e, nid);
    const aliados = (e.alianzas || []).filter(([x, y]) => x === nid || y === nid).length;
    let eq = ts.length * 3 + Math.round(n.etica * 0.4) + Math.round(n.paz * 0.4) + aliados * 3 + Math.floor(n.recursos / 2);
    if (colapso) eq = Math.round(eq * 0.5);
    return { nid, nombre: n.nombre, color: n.color, territorios: ts.length, ejercitos: ejercitosDe(e, nid), equilibrio: eq, etica: n.etica, paz: n.paz, recursos: n.recursos, aliados, eliminada: n.eliminada };
  });
}
export function resultados(e) {
  const p = puntajes(e);
  const porEq = [...p].sort((a, b) => b.equilibrio - a.equilibrio);
  const porDom = [...p].sort((a, b) => b.territorios - a.territorios || b.ejercitos - a.ejercitos);
  return { equilibrio: porEq, dominacion: porDom, colapso: paxMundial(e) < 25, paz: Math.round(paxMundial(e)) };
}

// ---------------------------------------------------------------- Armar naciones
export function armarNaciones({ jugadores, estudiantes, cantidad = 4, nombres = [] }) {
  // jugadores: 'reinos' | 'equipos' | 'individual'
  const NOMBRES = ["Aurora", "Concordia", "Solaris", "Armonía", "Fénix", "Cóndor", "Ceiba", "Nimbus", "Orión", "Lumbre", "Tierra Viva", "Horizonte"];
  const id = (e) => String(e.id);
  if (jugadores === "individual") return estudiantes.slice(0, 12).map((s, i) => ({ id: `n${i + 1}`, nombre: s.nombre, miembros: [id(s)], color: COLORES[i % COLORES.length] }));
  if (jugadores === "reinos") {
    const g = new Map(); estudiantes.forEach((s) => { const k = s.reino_actual || "Sin reino"; if (!g.has(k)) g.set(k, []); g.get(k).push(id(s)); });
    return [...g.entries()].slice(0, 12).map(([k, m], i) => ({ id: `n${i + 1}`, nombre: k, miembros: m, color: COLORES[i % COLORES.length] }));
  }
  const n = Math.max(2, Math.min(12, cantidad));
  const bar = barajar(estudiantes); const eq = Array.from({ length: n }, (_, i) => ({ id: `n${i + 1}`, nombre: nombres[i] || NOMBRES[i % NOMBRES.length], miembros: [], color: COLORES[i % COLORES.length] }));
  bar.forEach((s, i) => eq[i % n].miembros.push(id(s)));
  return eq;
}
