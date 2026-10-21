// =====================================================================================
//  LA GRAN OBRA DEL CURSO — catálogo (lógica pura, sin pantalla)
//  Cada opción trae su plano por fases. Las piezas se colocan en una cuadrícula de la plaza
//  compartida. El docente copia estas opciones a la obra de su curso; el servidor valida cada
//  pieza contra ese plano y su costo.
// =====================================================================================

export const PLAZA = { cols: 26, filas: 18 };           // tamaño de la plaza compartida (en casillas)
export const RECURSOS_OBRA = ["madera", "piedra", "pez", "hierba"];
export const EMOJI_RECURSO = { madera: "🪵", piedra: "🪨", pez: "🐟", hierba: "🌿" };
export const NOMBRE_RECURSO = { madera: "Madera", piedra: "Piedra", pez: "Pez", hierba: "Hierba" };

// Piezas: emoji y costo en recursos del almacén común.
export const PIEZAS_OBRA = {
  muro: { nombre: "Muro", emoji: "🧱", costo: { piedra: 2 } },
  columna: { nombre: "Columna", emoji: "🏛️", costo: { piedra: 3 } },
  viga: { nombre: "Viga", emoji: "🪵", costo: { madera: 2 } },
  techo: { nombre: "Techo", emoji: "🟫", costo: { madera: 2, piedra: 1 } },
  estatua: { nombre: "Estatua", emoji: "🗿", costo: { piedra: 4 } },
  farol: { nombre: "Farol", emoji: "🏮", costo: { piedra: 1, madera: 1 } },
  estante: { nombre: "Estante de libros", emoji: "📚", costo: { madera: 3 } },
  mesa: { nombre: "Mesa de estudio", emoji: "🪑", costo: { madera: 2 } },
  mural: { nombre: "Mural", emoji: "🖼️", costo: { madera: 2, hierba: 1 } },
  valla: { nombre: "Valla", emoji: "🚧", costo: { madera: 1 } },
  cultivo: { nombre: "Cultivo", emoji: "🥕", costo: { hierba: 2 } },
  arbol: { nombre: "Árbol", emoji: "🌳", costo: { hierba: 2, madera: 1 } },
  flor: { nombre: "Flores", emoji: "🌷", costo: { hierba: 1 } },
  pozo: { nombre: "Pozo", emoji: "⛲", costo: { piedra: 4 } },
  estanque: { nombre: "Estanque", emoji: "🌊", costo: { pez: 2, piedra: 1 } },
  bandera: { nombre: "Bandera", emoji: "🚩", costo: { madera: 1, hierba: 1 } },
  campana: { nombre: "Campana", emoji: "🔔", costo: { piedra: 2, madera: 1 } },
  corona: { nombre: "Corona del curso", emoji: "👑", costo: { piedra: 2, madera: 2, hierba: 2, pez: 1 } },
  paloma: { nombre: "Paloma de la paz", emoji: "🕊️", costo: { piedra: 2, hierba: 2, pez: 1 } },
};
export const emojiDePieza = (item) => PIEZAS_OBRA[item]?.emoji || "❔";
export const nombreDePieza = (item) => PIEZAS_OBRA[item]?.nombre || item;

// ---- ayudas para dibujar planos ----
const fila = (x1, x2, y, item) => { const o = []; for (let x = x1; x <= x2; x++) o.push({ x, y, item }); return o; };
const col = (x, y1, y2, item) => { const o = []; for (let y = y1; y <= y2; y++) o.push({ x, y, item }); return o; };
const pt = (x, y, item) => ({ x, y, item });
// Un rectángulo hueco (los muros), dejando una puerta abajo.
function anillo(x1, x2, y1, y2, item, puerta = []) {
  return [...fila(x1, x2, y1, item), ...fila(x1, x2, y2, item).filter((p) => !puerta.includes(p.x)), ...col(x1, y1 + 1, y2 - 1, item), ...col(x2, y1 + 1, y2 - 1, item)];
}

// Costos que necesita cada opción (solo las piezas que usa).
const costosDe = (fases) => {
  const usados = new Set(); fases.forEach((f) => f.piezas.forEach((p) => usados.add(p.item)));
  const c = {}; usados.forEach((k) => { c[k] = PIEZAS_OBRA[k].costo; }); return c;
};

export function crearOpciones() {
  const templo = [
    { nombre: "Cimientos", reto_meta: 4, piezas: fila(8, 17, 10, "muro") },
    { nombre: "Columnas", reto_meta: 4, piezas: [...[8, 11, 14, 17].flatMap((x) => [pt(x, 9, "columna"), pt(x, 8, "columna")])] },
    { nombre: "Techo", reto_meta: 5, piezas: [...fila(8, 17, 7, "viga"), ...fila(10, 15, 6, "techo")] },
    { nombre: "El corazón del templo", reto_meta: 5, piezas: [pt(12, 9, "estatua"), pt(9, 9, "farol"), pt(16, 9, "farol"), pt(10, 9, "flor"), pt(15, 9, "flor"), pt(13, 9, "campana"), pt(12, 5, "corona")] },
  ];
  const biblioteca = [
    { nombre: "Muros", reto_meta: 4, piezas: anillo(9, 16, 7, 11, "muro", [12, 13]) },
    { nombre: "Estantes y mesas", reto_meta: 4, piezas: [...fila(10, 15, 8, "estante"), ...[10, 12, 14].map((x) => pt(x, 10, "mesa"))] },
    { nombre: "Techo y luz", reto_meta: 5, piezas: [...fila(9, 16, 6, "viga"), ...fila(10, 15, 5, "techo"), pt(9, 12, "farol"), pt(16, 12, "farol")] },
    { nombre: "Jardín de lectura", reto_meta: 5, piezas: [pt(8, 11, "arbol"), pt(17, 11, "arbol"), pt(11, 12, "flor"), pt(14, 12, "flor"), pt(12, 4, "bandera"), pt(13, 4, "corona")] },
  ];
  const huerto = [
    { nombre: "La cerca", reto_meta: 4, piezas: anillo(8, 17, 6, 12, "valla", [12, 13]) },
    { nombre: "Los cultivos", reto_meta: 4, piezas: [...fila(9, 16, 8, "cultivo"), ...fila(9, 16, 10, "cultivo")] },
    { nombre: "Agua y sombra", reto_meta: 5, piezas: [pt(12, 9, "pozo"), pt(13, 9, "estanque"), pt(9, 9, "arbol"), pt(16, 9, "arbol"), pt(10, 11, "flor"), pt(15, 11, "flor")] },
    { nombre: "La fiesta de la cosecha", reto_meta: 5, piezas: [pt(7, 9, "farol"), pt(18, 9, "farol"), pt(12, 5, "bandera"), pt(13, 5, "mural"), pt(12, 12, "mesa"), pt(13, 12, "corona")] },
  ];
  const plaza = [
    { nombre: "El corazón de la plaza", reto_meta: 4, piezas: [pt(12, 8, "pozo"), pt(13, 8, "pozo"), pt(12, 9, "pozo"), pt(13, 9, "pozo"), pt(12, 10, "estanque"), pt(13, 10, "estanque")] },
    { nombre: "Bancas y faroles", reto_meta: 4, piezas: [...[9, 11, 14, 16].map((x) => pt(x, 7, "mesa")), ...[9, 16].map((x) => pt(x, 11, "farol")), ...[9, 16].map((x) => pt(x, 9, "farol"))] },
    { nombre: "Vida en la plaza", reto_meta: 5, piezas: [...[7, 10, 15, 18].map((x) => pt(x, 6, "arbol")), ...[8, 11, 14, 17].map((x) => pt(x, 12, "flor")), pt(7, 9, "bandera"), pt(18, 9, "bandera")] },
    { nombre: "Nuestro mural y la paz", reto_meta: 5, piezas: [pt(11, 5, "mural"), pt(12, 5, "mural"), pt(13, 5, "mural"), pt(14, 5, "mural"), pt(12, 4, "campana"), pt(13, 4, "paloma")] },
  ];
  const op = (id, nombre, emoji, desc, fases) => ({ id, nombre, emoji, desc, fases, costos: costosDe(fases) });
  return [
    op("templo", "Templo de los Valores", "🏛️", "Un templo con columnas, una estatua y una campana: cada piedra representa un valor del curso.", templo),
    op("biblioteca", "Gran Biblioteca", "📚", "Una biblioteca con estantes, mesas de estudio y un jardín de lectura para todo el colegio.", biblioteca),
    op("huerto", "Huerto Comunitario", "🌳", "Un huerto cercado con cultivos, un pozo y una fiesta de la cosecha entre todos.", huerto),
    op("plaza", "Plaza de la Convivencia", "🕊️", "Una plaza con fuente, bancas, faroles y un mural: el lugar donde nos encontramos y hacemos la paz.", plaza),
  ];
}

export const totalPiezas = (opc) => opc.fases.reduce((a, f) => a + f.piezas.length, 0);
export function costoTotal(opc) {
  const t = {};
  opc.fases.forEach((f) => f.piezas.forEach((p) => { Object.entries(PIEZAS_OBRA[p.item].costo).forEach(([k, n]) => { t[k] = (t[k] || 0) + n; }); }));
  return t;
}

// Revisa que un plano sea coherente (se usa en pruebas y antes de crear la obra).
export function validarOpcion(opc) {
  const errores = [], vistos = new Set();
  opc.fases.forEach((f, i) => {
    if (!f.piezas.length) errores.push(`Fase ${i + 1} vacía`);
    f.piezas.forEach((p) => {
      const k = `${p.x},${p.y}`;
      if (!PIEZAS_OBRA[p.item]) errores.push(`Pieza desconocida ${p.item}`);
      if (vistos.has(k)) errores.push(`Casilla repetida ${k}`); vistos.add(k);
      if (p.x < 2 || p.x > PLAZA.cols - 3 || p.y < 2 || p.y > PLAZA.filas - 5) errores.push(`Fuera de zona ${k}`);
    });
  });
  return errores;
}
