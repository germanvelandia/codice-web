// =====================================================================================
//  MUNDO 3D DE CÓDICE — motor en primera persona (WebGL directo, sin librerías).
//  iniciarMundo3D(host, ctx) → { aplicar(filas), seleccionar(item), setCalidad(alta), cerrar() }
//    ctx: {
//      grado,            // grado cuyo mundo se muestra (semilla del terreno)
//      yo,               // id del estudiante (para saber qué bloques son suyos)
//      soloMirar,        // true al visitar otro grado: no se puede picar ni poner
//      vuelo,            // true para el docente observador: vuela sin chocar
//      puertas,          // { bosque: true, montana: false, lago: false } portones abiertos de las zonas
//      alPuerta(zona),   // el jugador llegó a un portón cerrado
//      sonido,           // { volumen, musica, silencio } iniciales
//      alApuntar(info),  // observador: { autor, x, y, z } del bloque que mira (o null)
//      portales,         // [{ id, nombre }] hacia otros mundos (máximo 8)
//      cambios,          // filas [{x,y,z,bloque,autor_id}] ya guardadas
//      cantidad(item),   // cuántos bloques de ese tipo tiene el estudiante
//      picar(x,y,z,b), poner(x,y,z,item)   // devuelven una promesa; si falla se deshace el cambio local
//      alSeleccion(item), alZona(nombre), alPortal(id), alError(texto)
//    }
//  Solo se guardan los cambios de los estudiantes; el terreno se genera igual cada vez con una semilla.
// =====================================================================================

import { crearAmbiente } from "./ambiente3d";
import { crearSonido } from "./sonido3d";
import { ESPECIES, POBLACION } from "./animales3d";
import { MONSTRUOS, danioDeArma } from "./monstruos3d";

export const SX = 256, SY = 40, SZ = 256, CH = 16, NCX = SX / CH, NCZ = SZ / CH;
export const CENTRO = 128, RADIO_PLAZA = 34, RADIO_ADOQUIN = 12; // la aldea (69 × 69) está protegida; el empedrado de la plaza es de 25 × 25
const AIRE = 0, AGUA = 11, PORTAL = 12, ADOQUIN = 13, LAVA = 114, VELO = 119;

const NOMBRES_BASE = { 42: "Hierro", 3: "Piedra", 44: "Diamante" };
export const NOMBRES = { 1: "Pasto", 2: "Tierra", 3: "Piedra", 4: "Tronco", 5: "Hojas", 6: "Tablones", 7: "Ladrillo", 8: "Cristal", 9: "Arena", 10: "Mineral", 11: "Agua", 12: "Portal", 13: "Adoquín", 14: "Muralla", 15: "Portón",
  16: "Bloque de hierro", 17: "Bloque de oro", 18: "Bloque de diamante", 19: "Lana blanca", 20: "Lana roja", 21: "Lana azul", 22: "Lana verde", 23: "Lana amarilla",
  40: "Palo", 41: "Carbón", 42: "Hierro", 43: "Oro", 44: "Diamante", 45: "Lana", 46: "Huevo", 47: "Manzana", 48: "Leche",
  50: "Pico de madera", 51: "Pico de piedra", 52: "Pico de hierro", 53: "Pico de diamante", 54: "Hacha de madera", 55: "Hacha de piedra", 56: "Hacha de hierro", 57: "Hacha de diamante",
  58: "Pala de madera", 59: "Pala de piedra", 60: "Pala de hierro", 61: "Pala de diamante",
  26: "Grava", 27: "Arena roja", 28: "Nieve", 29: "Hielo", 30: "Cactus", 31: "Arcilla", 32: "Granito", 33: "Andesita", 34: "Diorita", 35: "Pizarra profunda", 36: "Lámpara",
  37: "Tierra labrada", 72: "Semillas", 73: "Zanahoria", 74: "Papa", 75: "Trigo", 76: "Pan", 77: "Papa asada", 78: "Huevo frito",
  80: "Azada de madera", 81: "Azada de piedra", 82: "Azada de hierro", 83: "Azada de diamante",
  ...Object.fromEntries(["cobre", "hierro", "diamante"].flatMap((m, t) => ["Casco", "Peto", "Pantalón", "Botas"].map((n, p) => [84 + t * 4 + p, n + " de " + m]))),
  96: "Llave de brasas", 97: "Fragmento de brasa", 98: "Corazón de brasa", 112: "Basalto", 113: "Roca ígnea", 114: "Lava", 115: "Brasa luminosa", 116: "Mena de brasa", 117: "Ladrillo ígneo", 119: "Velo de brasas",
  24: "Horno", 25: "Bloque de cobre", 62: "Cobre crudo", 63: "Lingote de cobre", 65: "Hierro crudo", 66: "Oro crudo",
  68: "Espada de madera", 69: "Espada de piedra", 70: "Espada de hierro", 71: "Espada de diamante" };
export const COLOCABLES = [1, 2, 3, 4, 6, 7, 8, 9, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 112, 113, 115, 117];
// Frases rápidas del chat (los mismos números que la tabla mundo3d_frases del servidor)
export const FRASES_CHAT = { 1: "¡Hola!", 2: "¡Buen trabajo!", 3: "¿Me ayudas?", 4: "¡Gracias!", 5: "¿Construimos juntos?", 6: "¡Mira lo que hice!", 7: "Vamos a la aldea", 8: "Necesito piedra", 9: "¡Qué bien!", 10: "¡Hasta luego!", 11: "Sígueme", 12: "¡Cuidado!" };
export const MATERIALES = [40, 41, 42, 43, 44, 45, 46, 47, 48, 62, 63, 65, 66, 75, 76, 77, 78, 96, 97, 98];
// Lo que se lleva en la mano y se usa sobre el terreno: semillas y cultivos (se siembran) y azadas (labran)
export const USABLES = [72, 73, 74, 80, 81, 82, 83];
// Armaduras (84-95) y comida: mismos números que el servidor (tabla mundo3d_comida y _m3d_defensa)
export const ARMADURAS = [84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95];
export const COMIDA = { 47: 6, 48: 5, 73: 3, 76: 15, 77: 12, 78: 10 };
const PTS_ARM = [[1, 2, 1, 1], [2, 3, 2, 1], [3, 4, 3, 2]];
export function defensaDe(cantidad) { let tot = 0; for (let p = 0; p < 4; p++) { let m = 0; for (let t = 0; t < 3; t++) if (cantidad(84 + t * 4 + p) > 0) m = Math.max(m, PTS_ARM[t][p]); tot += m; } return tot; }
export const SEMILLAS = { 72: 0, 73: 1, 74: 2 };
export const NOMBRES_CULTIVO = ["trigo", "zanahoria", "papa"];
// Mercado de la aldea (mismos precios que la tabla mundo3d_mercado)
export const MERCADO = [{ item: 75, precio: 1 }, { item: 73, precio: 1 }, { item: 74, precio: 1 }, { item: 76, precio: 3 }, { item: 77, precio: 3 }, { item: 78, precio: 2 }, { item: 47, precio: 2 }, { item: 45, precio: 1 }, { item: 63, precio: 2 }, { item: 42, precio: 3 }, { item: 43, precio: 6 }, { item: 97, precio: 4 }, { item: 98, precio: 25 }];
export const HERRAMIENTAS = [50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 68, 69, 70, 71, 80, 81, 82, 83];
// Usos máximos antes de romperse (los mismos números que _m3d_max_usos del servidor)
export const MAX_USOS = (id) => (id >= 50 && id <= 61 ? [60, 130, 250, 600][(id - 50) % 4] : id >= 68 && id <= 71 ? [20, 40, 80, 160][id - 68] : id >= 80 && id <= 83 ? [60, 130, 250, 600][id - 80] : id >= 84 && id <= 95 ? [80, 160, 320][((id - 84) / 4) | 0] : 0);
// Fundición y combustibles (mismos datos que las tablas mundo3d_fundicion y mundo3d_combustible)
export const FUNDICION = [{ entrada: 65, sale: 42 }, { entrada: 66, sale: 43 }, { entrada: 62, sale: 63 }, { entrada: 9, sale: 8 }, { entrada: 4, sale: 41 }, { entrada: 31, sale: 7 }, { entrada: 74, sale: 77 }, { entrada: 46, sale: 78 }];
export const COMBUSTIBLES = [{ item: 41, rinde: 8 }, { item: 4, rinde: 3 }, { item: 6, rinde: 2 }, { item: 40, rinde: 1 }, { item: 97, rinde: 16 }];
const DUREZA = { 112: 1, 113: .9, 115: .5, 116: 1.3, 117: 1.1, 26: .35, 27: .3, 28: .15, 29: .4, 30: .35, 31: .4, 32: 1, 33: 1, 34: 1, 35: 1.5, 36: .5, 24: 1.2, 25: 1.6, 1: .3, 2: .3, 3: .9, 4: .6, 5: .15, 6: .5, 7: .9, 8: .2, 9: .25, 10: 1.1, 16: 1.6, 17: 1.6, 18: 2, 19: .3, 20: .3, 21: .3, 22: .3, 23: .3 };
export const RECETAS = [
  { sale: 6, n: 4, cuesta: { 4: 1 }, txt: "1 tronco → 4 tablones" },
  { sale: 7, n: 2, cuesta: { 3: 2 }, txt: "2 piedra → 2 ladrillos" },
  { sale: 8, n: 2, cuesta: { 9: 2 }, txt: "2 arena → 2 cristales" },
  { sale: 40, n: 4, cuesta: { 6: 2 }, txt: "2 tablones → 4 palos", g: "Materiales" },
  ...[["madera", 6, 0], ["piedra", 3, 1], ["hierro", 42, 2], ["diamante", 44, 3]].flatMap(([nom, mat, t]) => [
    { sale: 50 + t, n: 1, cuesta: { [mat]: 3, 40: 2 }, txt: "3 " + (mat === 6 ? "tablones" : NOMBRES_BASE[mat].toLowerCase()) + " + 2 palos", g: "Herramientas" },
    { sale: 54 + t, n: 1, cuesta: { [mat]: 3, 40: 2 }, txt: "3 " + (mat === 6 ? "tablones" : NOMBRES_BASE[mat].toLowerCase()) + " + 2 palos", g: "Herramientas" },
    { sale: 58 + t, n: 1, cuesta: { [mat]: 1, 40: 2 }, txt: "1 " + (mat === 6 ? "tablón" : NOMBRES_BASE[mat].toLowerCase()) + " + 2 palos", g: "Herramientas" },
  ]),
  ...[["madera", 6, 0], ["piedra", 3, 1], ["hierro", 42, 2], ["diamante", 44, 3]].map(([nom, mat, t]) => ({ sale: 68 + t, n: 1, cuesta: { [mat]: 2, 40: 1 }, txt: "2 " + (mat === 6 ? "tablones" : NOMBRES_BASE[mat].toLowerCase()) + " + 1 palo", g: "Armas" })),
  ...[63, 42, 44].flatMap((mat, t) => [["Casco", 3], ["Peto", 5], ["Pantalón", 4], ["Botas", 2]].map(([n, c], p) => ({ sale: 84 + t * 4 + p, n: 1, cuesta: { [mat]: c }, txt: c + " " + (t === 0 ? "lingotes de cobre" : t === 1 ? "hierro" : "diamante"), g: "Armaduras" }))),
  { sale: 96, n: 1, cuesta: { 42: 6, 43: 2 }, txt: "6 hierro + 2 oro → llave para entrar al Reino de Brasas", g: "Dimensiones" },
  { sale: 115, n: 1, cuesta: { 97: 3 }, txt: "3 fragmentos de brasa → 1 brasa luminosa", g: "Dimensiones" },
  { sale: 117, n: 2, cuesta: { 97: 1, 3: 2 }, txt: "1 fragmento + 2 piedra → 2 ladrillos ígneos", g: "Dimensiones" },
  { sale: 76, n: 1, cuesta: { 75: 3 }, txt: "3 trigo → 1 pan", g: "Comida" },
  ...[["madera", 6, 0], ["piedra", 3, 1], ["hierro", 42, 2], ["diamante", 44, 3]].map(([nom, mat, t]) => ({ sale: 80 + t, n: 1, cuesta: { [mat]: 2, 40: 2 }, txt: "2 " + (mat === 6 ? "tablones" : NOMBRES_BASE[mat].toLowerCase()) + " + 2 palos", g: "Granja" })),
  { sale: 36, n: 2, cuesta: { 41: 1, 8: 1 }, txt: "1 carbón + 1 cristal → 2 lámparas", g: "Decoración" },
  { sale: 29, n: 1, cuesta: { 28: 4 }, txt: "4 nieve → 1 hielo", g: "Decoración" },
  { sale: 26, n: 2, cuesta: { 3: 1 }, txt: "1 piedra → 2 grava", g: "Decoración" },
  { sale: 24, n: 1, cuesta: { 3: 8 }, txt: "8 piedra → 1 horno (para fundir)", g: "Hornos y cobre" },
  { sale: 25, n: 1, cuesta: { 63: 4 }, txt: "4 lingotes de cobre → 1 bloque", g: "Hornos y cobre" },
  { sale: 16, n: 1, cuesta: { 42: 4 }, txt: "4 hierro → 1 bloque", g: "Bloques valiosos" },
  { sale: 17, n: 1, cuesta: { 43: 4 }, txt: "4 oro → 1 bloque", g: "Bloques valiosos" },
  { sale: 18, n: 1, cuesta: { 44: 4 }, txt: "4 diamante → 1 bloque", g: "Bloques valiosos" },
  ...[19, 20, 21, 22, 23].map((id) => ({ sale: id, n: 1, cuesta: { 45: 1 }, txt: "1 lana → 1 " + ["lana blanca", "lana roja", "lana azul", "lana verde", "lana amarilla"][id - 19], g: "Lanas" })),
];
// El Cruce de los Mundos (portales a otros cursos) está lejos de la aldea, al sureste.
export const CRUCE = { x: 216, z: 200 };
export const enPlazaProtegida = (x, z) => (Math.abs(x - CENTRO) <= RADIO_PLAZA && Math.abs(z - CENTRO) <= RADIO_PLAZA) || (Math.abs(x - CRUCE.x) <= 14 && Math.abs(z - CRUCE.z) <= 8);

// atlas: 0 pasto arriba, 1 pasto lado, 2 tierra, 3 piedra, 4 tronco lado, 5 tronco arriba, 6 hojas, 7 tablones, 8 ladrillo, 9 cristal, 10 arena, 11 mineral, 12 agua, 13 portal, 14 adoquín
const NT = 60;
function tileDe(b, cara) { // cara: 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z
  switch (b) {
    case 1: return cara === 2 ? 0 : cara === 3 ? 2 : 1;
    case 2: return 2; case 3: return 3;
    case 4: return cara === 2 || cara === 3 ? 5 : 4;
    case 5: return 6; case 6: return 7; case 7: return 8; case 8: return 9; case 9: return 10; case 10: return 11;
    case 11: return 12; case 12: return 13; case 13: return 14; case 14: return 15; case 15: return 16;
  }
  if (b >= 16 && b <= 23) return b + 1;
  if (b === 24) return cara === 2 || cara === 3 ? 3 : 25;
  if (b === 25) return 26;
  if (b === 37) return cara === 2 ? 39 : 2;
  if (b >= 112 && b <= 119) return 52 + (b - 112);
  if (b >= 100 && b <= 111) return 40 + (b - 100);
  if (b === 30) return cara === 2 || cara === 3 ? 32 : 31;
  if (b >= 26 && b <= 29) return b + 1;
  if (b >= 31 && b <= 36) return b + 2;
  return 3;
}
let _atlas = null, _palRef = null;
const _pal = () => { atlasCanvas(); return _palRef; };
export function atlasCanvas() {
  if (_atlas) return _atlas;
  const a = document.createElement("canvas"); a.width = 16 * NT; a.height = 16;
  const g = a.getContext("2d"); let s = 11; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const pal = [["#5aa63c", "#6dbb4a", "#3f8a2c"], ["#5aa63c", "#6dbb4a", "#3f8a2c"], ["#8a5a35", "#9a6a42", "#734a2a"], ["#8b8f96", "#9ca0a7", "#767a82"],
    ["#6b4a2b", "#7b5836", "#58391f"], ["#a07a48", "#b08a56", "#8a6638"], ["#2f7d32", "#3f9440", "#256a29"], ["#c8964f", "#d6a661", "#b7843f"],
    ["#b5503c", "#c4604a", "#8f3c2c"], ["#9fd8e8", "#c3ecf7", "#7cc2d6"], ["#dcc58a", "#e8d49c", "#c9b177"], ["#8b8f96", "#9ca0a7", "#767a82"],
    ["#2f6fcf", "#3a7fe0", "#2a62b8"], ["#7a3fd0", "#9a5cf0", "#5b2aa8"], ["#a8a49a", "#b8b4aa", "#948f84"], ["#6a4a26", "#7d5a30", "#5a3d1e"], ["#a77b45", "#b98a52", "#946b39"],
    ["#d8d8dc", "#e8e8ec", "#c2c2c8"], ["#f3c93a", "#ffe066", "#d9a820"], ["#3fd8d0", "#7df3ee", "#2bb5b0"],
    ["#ececec", "#f7f7f7", "#dcdcdc"], ["#c0392b", "#d44a3a", "#a22d21"], ["#2f5fc4", "#3d72dd", "#274fa6"], ["#3d9a3a", "#4cb148", "#2f7d2d"], ["#f1c40f", "#f7d63a", "#d4aa0a"],
    ["#7f838a", "#90949b", "#6b6f76"], ["#c8693a", "#d9794a", "#a9532b"],
    ["#8d8a86", "#a09d98", "#77746f"], ["#b9552f", "#c8653c", "#9d4626"], ["#f4f8fb", "#ffffff", "#dde7ee"], ["#a9d8f0", "#c4e8fa", "#8cc4e0"],
    ["#2f7a3c", "#3b8f4a", "#276832"], ["#3f8a47", "#4aa055", "#327a3b"], ["#9aa3b5", "#adb6c7", "#858ea1"],
    ["#a5675a", "#b87666", "#8d554a"], ["#78787b", "#898a8d", "#66676a"], ["#cfcfd0", "#dddde0", "#bcbcc0"], ["#4a4c53", "#5a5c64", "#3b3d43"], ["#ffe08a", "#fff0b8", "#f2c75a"],
    ["#6b4426", "#7a5230", "#583619"], ...Array.from({ length: 12 }, () => ["#000", "#000", "#000"]),
    ["#3c3f4a", "#4a4d5a", "#2f323c"], ["#5a2a22", "#6b342a", "#46201a"], ["#e8590c", "#ff7a1a", "#c2410c"], ["#ffcc4d", "#ffe08a", "#f59e0b"], ["#5a2a22", "#6b342a", "#46201a"], ["#5c1f1a", "#722a22", "#44140f"], ["#3c3f4a", "#4a4d5a", "#2f323c"], ["#7a2fd0", "#ff7a1a", "#4a1a90"]];
  _palRef = pal;
  for (let t = 0; t < NT; t++) {
    const ox = t * 16;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { g.fillStyle = pal[t][(r() * 3) | 0]; g.fillRect(ox + x, y, 1, 1); }
    if (t === 1) { for (let x = 0; x < 16; x++) { g.fillStyle = ["#8a5a35", "#9a6a42", "#734a2a"][(r() * 3) | 0]; g.fillRect(ox + x, 4, 1, 12); } g.fillStyle = "#6dbb4a"; g.fillRect(ox, 0, 16, 4); g.fillStyle = "#3f8a2c"; for (let x = 0; x < 16; x += 2) g.fillRect(ox + x, 4, 1, 1 + (r() * 2 | 0)); }
    if (t === 4) { g.fillStyle = "#0003"; for (let x = 3; x < 16; x += 5) g.fillRect(ox + x, 0, 1, 16); }
    if (t === 5) { g.strokeStyle = "#58391f"; g.strokeRect(ox + 3.5, 3.5, 9, 9); g.strokeRect(ox + 6.5, 6.5, 3, 3); }
    if (t === 7) { g.fillStyle = "#0003"; for (let y = 3; y < 16; y += 4) g.fillRect(ox, y, 16, 1); }
    if (t === 8) { g.fillStyle = "#e8d8c4"; for (let y = 3; y < 16; y += 4) g.fillRect(ox, y, 16, 1); for (let y = 0; y < 16; y += 4) for (let x = (y / 4 % 2) * 4 + 3; x < 16; x += 8) g.fillRect(ox + x, y, 1, 4); }
    if (t === 9) { g.strokeStyle = "#6fb9cf"; g.strokeRect(ox + .5, .5, 15, 15); g.fillStyle = "#fff"; g.fillRect(ox + 3, 3, 4, 1); g.fillRect(ox + 3, 3, 1, 4); }
    if (t === 11) { g.fillStyle = "#f2c14e"; for (let i = 0; i < 7; i++) g.fillRect(ox + ((r() * 13) | 0) + 1, ((r() * 13) | 0) + 1, 2, 2); }
    if (t === 12) { g.fillStyle = "#ffffff30"; for (let i = 0; i < 5; i++) g.fillRect(ox + ((r() * 12) | 0), ((r() * 14) | 0), 4, 1); }
    if (t === 13) { g.fillStyle = "#e9d8ff"; for (let i = 0; i < 9; i++) g.fillRect(ox + ((r() * 14) | 0), ((r() * 14) | 0), 1, 1); }
    if (t === 14) { g.fillStyle = "#0004"; g.fillRect(ox, 7, 16, 1); g.fillRect(ox + 7, 0, 1, 16); }
    if (t === 15) { g.fillStyle = "#2a1a0a"; for (let x = 3; x < 16; x += 4) g.fillRect(ox + x, 0, 1, 16); g.fillStyle = "#8f6a3a"; for (let x = 0; x < 16; x += 4) g.fillRect(ox + x, 0, 2, 16); g.fillStyle = "#3a3f46"; g.fillRect(ox, 3, 16, 2); g.fillRect(ox, 11, 16, 2); }
    if (t >= 17 && t <= 19) { g.fillStyle = "#0003"; g.fillRect(ox, 0, 16, 1); g.fillRect(ox, 15, 16, 1); g.fillRect(ox, 0, 1, 16); g.fillRect(ox + 15, 0, 1, 16); g.fillStyle = "#fff6"; g.fillRect(ox + 2, 2, 3, 1); g.fillRect(ox + 2, 2, 1, 3); }
    if (t === 52) { g.fillStyle = "#1f2128"; for (let y = 2; y < 16; y += 5) g.fillRect(ox, y, 16, 1); g.fillStyle = "#5c6070"; for (let i = 0; i < 8; i++) g.fillRect(ox + ((r() * 14) | 0), ((r() * 14) | 0), 2, 1); }
    else if (t === 53) { g.fillStyle = "#c2410c"; for (let i = 0; i < 6; i++) g.fillRect(ox + ((r() * 13) | 0), ((r() * 13) | 0), 1, 3); g.fillStyle = "#2a100c"; for (let i = 0; i < 8; i++) g.fillRect(ox + ((r() * 14) | 0), ((r() * 14) | 0), 2, 2); }
    else if (t === 54) { g.fillStyle = "#ffd34d"; for (let i = 0; i < 12; i++) g.fillRect(ox + ((r() * 13) | 0), ((r() * 13) | 0), 3, 2); g.fillStyle = "#b53a08"; for (let i = 0; i < 6; i++) g.fillRect(ox + ((r() * 13) | 0), ((r() * 13) | 0), 2, 2); }
    else if (t === 55) { g.fillStyle = "#fff6c8"; for (let i = 0; i < 10; i++) g.fillRect(ox + ((r() * 13) | 0), ((r() * 13) | 0), 3, 3); g.strokeStyle = "#b45309"; g.strokeRect(ox + .5, .5, 15, 15); }
    else if (t === 56) { g.fillStyle = "#ff8a1f"; for (let i = 0; i < 8; i++) g.fillRect(ox + ((r() * 13) | 0), ((r() * 13) | 0), 2, 2); g.fillStyle = "#ffe08a"; for (let i = 0; i < 5; i++) g.fillRect(ox + ((r() * 14) | 0), ((r() * 14) | 0), 1, 1); }
    else if (t === 57) { g.fillStyle = "#1a0a08"; for (let y = 3; y < 16; y += 4) g.fillRect(ox, y, 16, 1); for (let y = 0; y < 16; y += 4) for (let x = (y / 4 % 2) * 4 + 3; x < 16; x += 8) g.fillRect(ox + x, y, 1, 4); g.fillStyle = "#ff7a1a55"; for (let i = 0; i < 4; i++) g.fillRect(ox + ((r() * 13) | 0), ((r() * 13) | 0), 2, 1); }
    else if (t === 59) { g.fillStyle = "#e9a8ff"; for (let i = 0; i < 10; i++) g.fillRect(ox + ((r() * 13) | 0), ((r() * 15) | 0), 3, 1); g.fillStyle = "#ffcc4d"; for (let i = 0; i < 6; i++) g.fillRect(ox + ((r() * 14) | 0), ((r() * 14) | 0), 1, 2); }
    else if (t === 39) { g.fillStyle = "#4a2d16"; for (let x = 2; x < 16; x += 5) g.fillRect(ox + x, 0, 2, 16); g.fillStyle = "#8a6a45"; for (let i = 0; i < 6; i++) g.fillRect(ox + ((r() * 14) | 0), ((r() * 14) | 0), 1, 1); }
    else if (t >= 40 && t <= 51) { // cultivos sobre fondo transparente: cultivo = (t - 40) / 4, etapa = (t - 40) % 4
      g.clearRect(ox, 0, 16, 16); const cu = ((t - 40) / 4) | 0, et = (t - 40) % 4, alto = [4, 8, 12, 14][et];
      const tallo = ["#7bbf3a", "#5aa03a", "#4e9a2f"][cu], maduro = ["#e2b93b", "#5aa03a", "#4e9a2f"][cu];
      for (let c0 = 1; c0 < 16; c0 += 3) { const hh = alto - ((c0 * 7) % 3); g.fillStyle = et === 3 ? maduro : tallo; g.fillRect(ox + c0, 16 - hh, 2, hh); g.fillStyle = "#0002"; g.fillRect(ox + c0 + 1, 16 - hh, 1, hh);
        if (et === 3) { if (cu === 0) { g.fillStyle = "#f2d36b"; g.fillRect(ox + c0 - 1, 16 - hh, 4, 3); } else if (cu === 1) { g.fillStyle = "#f08a24"; g.fillRect(ox + c0, 16 - hh - 1, 2, 3); } else { g.fillStyle = "#f4f0ff"; g.fillRect(ox + c0, 16 - hh, 2, 2); } }
        else if (cu === 1 && et > 0) { g.fillStyle = "#3f8a2a"; g.fillRect(ox + c0 - 1, 16 - hh, 1, 2); g.fillRect(ox + c0 + 2, 16 - hh, 1, 2); } }
    }
    else if (t === 25) { g.fillStyle = "#2a2a2e"; g.fillRect(ox + 3, 6, 10, 7); g.fillStyle = "#ff8a1f"; g.fillRect(ox + 5, 9, 6, 3); g.fillStyle = "#ffd34d"; g.fillRect(ox + 7, 10, 2, 2); g.fillStyle = "#0004"; g.fillRect(ox, 3, 16, 1); }
    else if (t === 26) { g.fillStyle = "#3fbf9f"; for (let i = 0; i < 9; i++) g.fillRect(ox + ((r() * 14) | 0), ((r() * 14) | 0), 2, 2); g.fillStyle = "#0003"; g.fillRect(ox, 0, 16, 1); g.fillRect(ox, 15, 16, 1); g.fillRect(ox, 0, 1, 16); g.fillRect(ox + 15, 0, 1, 16); }
    else if (t === 27) { g.fillStyle = "#0004"; for (let i = 0; i < 14; i++) g.fillRect(ox + ((r() * 14) | 0), ((r() * 14) | 0), 2, 2); g.fillStyle = "#fff3"; for (let i = 0; i < 8; i++) g.fillRect(ox + ((r() * 14) | 0), ((r() * 14) | 0), 1, 1); }
    else if (t === 28) { g.fillStyle = "#7a2f18"; for (let y = 4; y < 16; y += 5) g.fillRect(ox, y, 16, 1); }
    else if (t === 29) { g.fillStyle = "#e3edf3"; for (let i = 0; i < 10; i++) g.fillRect(ox + ((r() * 14) | 0), ((r() * 14) | 0), 2, 1); }
    else if (t === 30) { g.fillStyle = "#ffffff80"; g.fillRect(ox + 2, 2, 5, 1); g.fillRect(ox + 8, 9, 5, 1); g.fillRect(ox + 4, 12, 3, 1); g.strokeStyle = "#8cc4e0"; g.strokeRect(ox + .5, .5, 15, 15); }
    else if (t === 31) { g.fillStyle = "#1f5a2a"; for (let x = 3; x < 16; x += 4) g.fillRect(ox + x, 0, 1, 16); g.fillStyle = "#e8f5d8"; for (let y = 2; y < 16; y += 4) for (let x = 1; x < 16; x += 4) g.fillRect(ox + x, y, 1, 1); }
    else if (t === 32) { g.fillStyle = "#2a6f35"; g.strokeStyle = "#1f5a2a"; g.strokeRect(ox + 1.5, 1.5, 13, 13); g.fillStyle = "#f0e68c"; g.fillRect(ox + 7, 7, 2, 2); }
    else if (t === 33) { g.fillStyle = "#8691a3"; for (let i = 0; i < 5; i++) g.fillRect(ox + ((r() * 12) | 0), ((r() * 14) | 0), 4, 1); }
    else if (t === 34) { g.fillStyle = "#d9a590"; for (let i = 0; i < 10; i++) g.fillRect(ox + ((r() * 13) | 0), ((r() * 13) | 0), 3, 2); }
    else if (t === 35) { g.fillStyle = "#a0a0a4"; for (let i = 0; i < 10; i++) g.fillRect(ox + ((r() * 13) | 0), ((r() * 13) | 0), 2, 2); }
    else if (t === 36) { g.fillStyle = "#ffffff"; for (let i = 0; i < 12; i++) g.fillRect(ox + ((r() * 14) | 0), ((r() * 14) | 0), 2, 2); g.fillStyle = "#b8b8c0"; for (let i = 0; i < 6; i++) g.fillRect(ox + ((r() * 14) | 0), ((r() * 14) | 0), 2, 1); }
    else if (t === 37) { g.fillStyle = "#2b2c31"; for (let y = 5; y < 16; y += 6) g.fillRect(ox, y, 16, 1); g.fillStyle = "#6a6d78"; for (let i = 0; i < 6; i++) g.fillRect(ox + ((r() * 14) | 0), ((r() * 14) | 0), 1, 1); }
    else if (t === 38) { g.fillStyle = "#a8742a"; g.fillRect(ox, 0, 16, 2); g.fillRect(ox, 14, 16, 2); g.fillRect(ox, 0, 2, 16); g.fillRect(ox + 14, 0, 2, 16); g.fillStyle = "#fff8d0"; g.fillRect(ox + 4, 4, 8, 8); }
    else if (t >= 20 && t <= 24) { g.fillStyle = "#0002"; for (let i = 0; i < 12; i++) g.fillRect(ox + ((r() * 14) | 0), ((r() * 14) | 0), 2, 1); }
    if (t === 16) { g.fillStyle = "#0004"; for (let x = 4; x < 16; x += 4) g.fillRect(ox + x, 0, 1, 16); g.fillStyle = "#3a3f46"; g.fillRect(ox, 2, 16, 3); g.fillRect(ox, 11, 16, 3); g.fillStyle = "#9aa1ab"; for (let x = 2; x < 16; x += 5) { g.fillRect(ox + x, 3, 1, 1); g.fillRect(ox + x, 12, 1, 1); } g.fillStyle = "#d4af37"; g.fillRect(ox + 11, 7, 3, 3); }
  }
  return (_atlas = a);
}
const TIER = ["#b9854a", "#8b8f96", "#e2e2e6", "#4de3e0"];
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const COL_ITEM = { 40: "#8a5a2b", 41: "#2b2b2f", 42: "#e2e2e6", 43: "#f7d63a", 44: "#4de3e0", 45: "#f4f4f0", 46: "#efe3c4", 47: "#d83a2f", 48: "#f2f6ff", 72: "#b7c85a", 73: "#f08a24", 74: "#c4945a", 75: "#f2d36b", 76: "#d9993f", 77: "#a8692a", 78: "#f7c52e", 80: "#b9854a", 81: "#8b8f96", 82: "#e2e2e6", 83: "#4de3e0", 96: "#c0392b", 97: "#ff8a1f", 98: "#ff3b1f", 62: "#c8693a", ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [84 + i, ["#e08a52", "#e2e2e6", "#4de3e0"][(i / 4) | 0]])), 63: "#e08a52", 65: "#b9a89a", 66: "#e6c860" };
// color representativo de un bloque o item (para las partículas y lo que cae al picar)
export function colorItem(item) {
  if (COL_ITEM[item]) return hexRgb(COL_ITEM[item]);
  if (item >= 50 && item <= 61) return hexRgb(TIER[(item - 50) % 4]);
  if (item >= 68 && item <= 71) return hexRgb(TIER[item - 68]);
  const k = (item === 1 ? 1 : tileDe(item, 0)); return hexRgb(_pal()[Math.min(k, NT - 1)][0]);
}
// dibujo de un item en un canvas: los bloques salen del atlas; materiales y herramientas se dibujan en una cuadrícula de 16 × 16
export function dibujarIcono(canvas, item) {
  const c = canvas.getContext("2d"); c.imageSmoothingEnabled = false; c.clearRect(0, 0, canvas.width, canvas.height);
  if (item < 40 || (item >= 112 && item <= 119)) { c.drawImage(atlasCanvas(), (item === 1 ? 1 : tileDe(item, 0)) * 16, 0, 16, 16, 0, 0, canvas.width, canvas.height); return; }
  c.save(); c.scale(canvas.width / 16, canvas.height / 16);
  const px = (col, x, y, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const pts = (col, a) => a.forEach(([x, y]) => px(col, x, y));
  if (item >= 84 && item <= 95) {
    const col = ["#e08a52", "#e2e2e6", "#4de3e0"][((item - 84) / 4) | 0], pz = (item - 84) % 4, som = "#00000040";
    if (pz === 0) { px(col, 3, 4, 10, 6); px(col, 2, 6, 12, 5); px(som, 5, 8, 6, 3); px("#ffffff55", 4, 5, 3, 1); }
    else if (pz === 1) { px(col, 2, 3, 12, 11); px(col, 0, 3, 3, 5); px(col, 13, 3, 3, 5); px(som, 6, 3, 4, 3); px(som, 4, 10, 8, 1); px("#ffffff55", 3, 4, 2, 4); }
    else if (pz === 2) { px(col, 3, 2, 10, 4); px(col, 3, 6, 4, 8); px(col, 9, 6, 4, 8); px(som, 7, 6, 2, 8); px("#ffffff55", 4, 3, 3, 1); }
    else { px(col, 2, 8, 5, 5); px(col, 9, 8, 5, 5); px(col, 1, 11, 6, 3); px(col, 9, 11, 6, 3); px(som, 2, 13, 5, 1); px(som, 9, 13, 5, 1); }
  } else if (item >= 80 && item <= 83) {
    const col = TIER[item - 80];
    for (let i = 0; i < 11; i++) { px("#7a5230", 3 + i, 13 - i); px("#5b3b20", 4 + i, 13 - i); }
    px(col, 9, 2, 5, 2); px(col, 12, 3, 2, 3); px("#00000044", 9, 4, 3, 1);
  } else if (item >= 68 && item <= 71) {
    const col = TIER[item - 68];
    for (let i = 0; i < 9; i++) px(col, 5 + i, 10 - i); for (let i = 0; i < 9; i++) px("#ffffff55", 6 + i, 10 - i);
    px("#8b8f96", 4, 10, 4, 1); px("#7a5230", 3, 12, 3, 1); px("#5b3b20", 3, 11, 2, 1); px("#7a5230", 2, 13, 2, 2);
  } else if (item >= 50 && item <= 61) {
    const k = ((item - 50) / 4) | 0, col = TIER[(item - 50) % 4], oscuro = "#00000044";
    for (let i = 0; i < 10; i++) { px("#7a5230", 3 + i, 13 - i); px("#5b3b20", 3 + i, 14 - i); }
    const head = k === 0 ? [[5, 3], [6, 2], [7, 2], [8, 1], [9, 1], [10, 1], [11, 2], [12, 3], [13, 4], [13, 5], [14, 6], [6, 3], [10, 2], [11, 3], [12, 4]]
      : k === 1 ? [[9, 2], [10, 2], [11, 2], [12, 2], [8, 3], [9, 3], [10, 3], [11, 3], [12, 3], [13, 3], [8, 4], [9, 4], [10, 4], [11, 4], [12, 4], [13, 4], [9, 5], [10, 5], [11, 5], [12, 5], [10, 6], [11, 6]]
        : [[11, 1], [12, 1], [13, 1], [10, 2], [11, 2], [12, 2], [13, 2], [14, 2], [10, 3], [11, 3], [12, 3], [13, 3], [14, 3], [11, 4], [12, 4], [13, 4]];
    pts(col, head); pts(oscuro, head.slice(0, Math.floor(head.length / 4)).map(([x, y]) => [x, y + 1]));
  } else if (item === 40) { for (let i = 0; i < 12; i++) { px("#8a5a2b", 2 + i, 13 - i); px("#6a431f", 3 + i, 13 - i); } }
  else if (item === 41) { pts("#2b2b2f", [[5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9]]); pts("#555a66", [[6, 5], [7, 5], [5, 6]]); }
  else if (item === 42 || item === 43) { const base = item === 42 ? "#d8d8dc" : "#f3c93a", luz = item === 42 ? "#ffffff" : "#fff3a0", som = item === 42 ? "#9a9aa2" : "#b88a10"; px(som, 3, 7, 11, 5); px(base, 3, 6, 11, 5); px(luz, 4, 6, 8, 1); px(som, 3, 11, 11, 1); px("#0002", 13, 6, 1, 5); }
  else if (item === 44) { const d = [[7, 2], [8, 2], [6, 3], [7, 3], [8, 3], [9, 3], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [11, 5], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [6, 7], [7, 7], [8, 7], [9, 7], [7, 8], [8, 8]]; pts("#2bb5b0", d); pts("#7df3ee", d.filter(([x, y]) => x + y < 12 && y < 7)); pts("#ffffff", [[7, 3], [6, 4]]); }
  else if (item === 45) { px("#dcdcd6", 3, 5, 10, 8); px("#f7f7f3", 3, 4, 10, 8); px("#f7f7f3", 4, 3, 8, 1); px("#cfcfc8", 5, 7, 2, 1); px("#cfcfc8", 9, 9, 2, 1); }
  else if (item === 46) { const e = [[7, 3], [8, 3], [6, 4], [7, 4], [8, 4], [9, 4], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [6, 9], [7, 9], [8, 9], [9, 9], [6, 10], [7, 10], [8, 10], [9, 10]]; pts("#e2cf9f", e); pts("#f6ecd2", e.filter(([x, y]) => x < 8 && y < 8)); }
  else if (item === 47) { const a = [[5, 5], [6, 5], [7, 5], [9, 5], [10, 5], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [5, 10], [6, 10], [9, 10], [10, 10]]; pts("#c62f26", a); pts("#ec5b4f", [[5, 6], [6, 6], [5, 7]]); pts("#5a3b1e", [[8, 3], [8, 4]]); pts("#3d9a3a", [[9, 3], [10, 3], [10, 4]]); }
  else if (item === 62 || item === 65 || item === 66) { const base = item === 62 ? "#c8693a" : item === 65 ? "#b9a89a" : "#e6c860"; px("#00000033", 3, 7, 11, 6); px("#8b8f96", 3, 6, 11, 6); px(base, 4, 7, 3, 3); px(base, 8, 9, 3, 2); px(base, 6, 4, 4, 3); px(base, 10, 7, 2, 2); }
  else if (item === 72) { pts("#7a8f2a", [[5, 5], [8, 4], [10, 7], [6, 9], [9, 10], [4, 11], [11, 11], [7, 7]]); pts("#b7c85a", [[5, 4], [8, 3], [10, 6], [6, 8], [9, 9], [4, 10], [11, 10], [7, 6]]); }
  else if (item === 73) { for (let i = 0; i < 9; i++) px("#f08a24", 5 + ((i * 0) | 0) + (i > 5 ? 1 : 0), 4 + i, 6 - ((i / 2) | 0)); px("#d9731a", 7, 8, 2, 3); px("#4e9a2f", 5, 2, 2, 3); px("#4e9a2f", 8, 1, 2, 3); px("#6bb83a", 6, 1, 2, 2); }
  else if (item === 74) { px("#a97a42", 4, 6, 9, 6); px("#c4945a", 5, 5, 7, 6); px("#7a5430", 6, 8, 1, 1); px("#7a5430", 9, 7, 1, 1); px("#7a5430", 8, 10, 1, 1); }
  else if (item === 75) { for (const x of [4, 7, 10]) { px("#c9a227", x, 6, 1, 8); px("#f2d36b", x - 1, 2, 3, 3); px("#f2d36b", x, 5, 1, 1); } }
  else if (item === 76) { px("#a66a2a", 2, 8, 12, 5); px("#d9993f", 2, 6, 12, 5); px("#e8b563", 3, 5, 10, 2); px("#f4d28f", 4, 6, 3, 1); px("#8a561f", 2, 12, 12, 1); }
  else if (item === 77) { px("#7a4a1c", 4, 6, 9, 6); px("#a8692a", 5, 5, 7, 6); px("#f3d9a0", 6, 7, 4, 2); px("#4a2d10", 8, 10, 1, 1); }
  else if (item === 78) { px("#ffffff", 3, 5, 11, 7); px("#eeeeee", 3, 11, 11, 1); px("#f7c52e", 6, 6, 5, 5); px("#e0a916", 6, 10, 5, 1); }
  else if (item === 96) { px("#c0392b", 3, 3, 6, 6); px("#7a1a12", 5, 5, 2, 2); for (let i = 0; i < 6; i++) px("#e8e8ec", 8 + i, 8 + i, 2, 1); px("#e8e8ec", 11, 11, 3, 1); px("#e8e8ec", 13, 10, 1, 3); px("#ffcc4d", 4, 4, 2, 1); }
  else if (item === 97) { pts("#b53a08", [[7, 3], [6, 4], [8, 4], [5, 5], [9, 5], [4, 6], [10, 6], [5, 8], [9, 8], [6, 9], [8, 9]]); for (let y = 4; y < 9; y++) px("#ff8a1f", 6 + ((y < 6) ? 6 - y : 0), y, 3 + (y < 6 ? (y - 4) * 2 : 4 - (y - 6)), 1); px("#ffe08a", 7, 5, 2, 2); }
  else if (item === 98) { const hh = [[4, 4], [5, 4], [6, 4], [9, 4], [10, 4], [11, 4], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [11, 5], [12, 5], [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6], [12, 6], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [6, 9], [7, 9], [8, 9], [9, 9], [7, 10], [8, 10]]; pts("#e63a12", hh); pts("#ff9a3a", [[4, 5], [5, 5], [4, 6]]); pts("#ffe08a", [[5, 5]]); }
  else if (item === 63) { px("#a9532b", 3, 7, 11, 5); px("#e08a52", 3, 6, 11, 5); px("#f4b184", 4, 6, 8, 1); px("#a9532b", 3, 11, 11, 1); }
  else if (item === 48) { px("#cfd6e6", 6, 2, 4, 2); px("#f2f6ff", 5, 4, 6, 9); px("#b8c3dc", 5, 12, 6, 1); px("#7aa2ff", 6, 7, 4, 3); }
  c.restore();
}

// ---------- terreno ----------
const hashTxt = (s) => { let h = 2166136261 >>> 0; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
function ruidoV(seed, x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const h = (a, b) => { let n = Math.imul((a * 374761393 + b * 668265263 + seed) | 0, 1274126177); n = (n ^ (n >>> 13)) >>> 0; n = Math.imul(n, 1274126177) >>> 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const sm = (t) => t * t * (3 - 2 * t);
  const a = h(xi, zi), b = h(xi + 1, zi), c = h(xi, zi + 1), d = h(xi + 1, zi + 1), u = sm(xf), v = sm(zf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const MONTE = { x: 208, z: 48, r: 52 }, LAGO = { x: 128, z: 214, r: 34 };
// Caminos de adoquín que salen de la plaza hacia cada terreno del reino: [nombre, puntos]
export const CAMINOS = [
  ["🌲 Bosque de la Curiosidad", [[116, 118], [116, 96], [96, 80], [70, 66], [58, 58]]],
  ["⛰️ Montaña del Esfuerzo", [[140, 118], [140, 96], [160, 80], [184, 68], [200, 62]]],
  ["🏞️ Lago y muelle", [[128, 141], [128, 166], [128, 184]]],
  ["🌀 Cruce de los Mundos", [[142, 142], [172, 150], [198, 176], [206, 196]]],
];
function distSeg(x, z, a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)); return Math.hypot(x - (a[0] + t * dx), z - (a[1] + t * dz)); }
function distCamino(x, z) { let d = 1e9; for (const [, pts] of CAMINOS) for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distSeg(x, z, pts[i], pts[i + 1])); return d; }
function altura(x, z, seed) {
  const n = ruidoV(seed, x * .06, z * .06) * .6 + ruidoV(seed + 1, x * .15, z * .15) * .3 + ruidoV(seed + 2, x * .4, z * .4) * .1;
  let h = 13 + (n - .5) * 5; // el campo queda siempre sobre el nivel del agua (solo hay agua en el lago)
  const md = Math.hypot(x - MONTE.x, z - MONTE.z), mt = Math.max(0, 1 - md / MONTE.r);
  h += mt * mt * (3 - 2 * mt) * 24 * (.75 + .5 * ruidoV(seed + 3, x * .09, z * .09));
  const ld = Math.hypot((x - LAGO.x) * .8, z - LAGO.z), lg = Math.max(0, 1 - ld / LAGO.r);
  h -= lg * lg * (3 - 2 * lg) * 8;
  const e = Math.max(Math.abs(x - CENTRO), Math.abs(z - CENTRO)), f = Math.min(1, Math.max(0, (e - RADIO_PLAZA) / 14)), ff = f * f * (3 - 2 * f);
  h = 12 + (h - 12) * ff;
  const ex = Math.max(0, Math.abs(x - CRUCE.x) - 16), ez = Math.max(0, Math.abs(z - CRUCE.z) - 10), pe = Math.max(ex, ez), pf = Math.min(1, pe / 8), pff = pf * pf * (3 - 2 * pf);
  h = 12 + (h - 12) * pff;
  const dr = distCamino(x, z), fr = Math.min(1, Math.max(0, (dr - 2) / 6)), frr = fr * fr * (3 - 2 * fr); // los caminos van parejos
  h = 12 + (h - 12) * frr;
  return Math.max(2, Math.min(SY - 8, Math.round(h)));
}
// Biomas nuevos (iguales en todos los mundos): 1 desierto de arena roja (suroeste), 2 tundra nevada (este). Se excluyen la aldea, el lago y el Cruce.
export function bioma(x, z) {
  if (Math.max(Math.abs(x - CENTRO), Math.abs(z - CENTRO)) < RADIO_PLAZA + 12) return 0;
  if (Math.hypot((x - LAGO.x) * .8, z - LAGO.z) < LAGO.r + 6) return 0;
  if (Math.abs(x - CRUCE.x) < 26 && Math.abs(z - CRUCE.z) < 18) return 0;
  if (Math.hypot(x - MONTE.x, z - MONTE.z) < MONTE.r + 2) return 0;
  const j = (ruidoV(77, x * .07, z * .07) - .5) * 20;
  if (Math.hypot(x - 50, z - 190) < 44 + j) return 1;
  if (Math.hypot(x - 228, z - 130) < 32 + j) return 2;
  return 0;
}
export function zonaDe(x, z) {
  if (Math.abs(x - CRUCE.x) <= 16 && Math.abs(z - CRUCE.z) <= 10) return "Cruce de los Mundos";
  if (Math.max(Math.abs(x - CENTRO), Math.abs(z - CENTRO)) <= RADIO_PLAZA + 3) return "Aldea del Códice";
  if (Math.hypot(x - MONTE.x, z - MONTE.z) < MONTE.r) return "Montaña del Esfuerzo";
  if (Math.hypot((x - LAGO.x) * .8, z - LAGO.z) < LAGO.r + 3) return "Lago";
  const bi = bioma(x, z); if (bi === 1) return "Desierto de Arena Roja"; if (bi === 2) return "Tundra Nevada";
  if (x < 110 && z < 110) return "Bosque de la Curiosidad";
  return "Campos de Oakhaven";
}


// ---------- la aldea: edificios con su lugar (las claves son las mismas del Mundo 2D) ----------
export const EDIFICIOS = [
  { key: "biblioteca", nombre: "Biblioteca", emoji: "📚", cx: 106, cz: 106, pared: 7 },
  { key: "agora", nombre: "Ágora de la Ética", emoji: "⚖️", cx: 128, cz: 102, pared: 3 },
  { key: "templo", nombre: "Templo de la Gratitud", emoji: "🕊️", cx: 150, cz: 106, pared: 9 },
  { key: "mercado", nombre: "Mercado del Códice", emoji: "🛒", cx: 102, cz: 128, pared: 6 },
  { key: "acertijos", nombre: "Casa de los Acertijos", emoji: "🧩", cx: 154, cz: 128, pared: 7 },
  { key: "comarca", nombre: "Sala de la Comarca", emoji: "🏰", cx: 106, cz: 152, pared: 3 },
  { key: "posada", nombre: "Posada del Descanso", emoji: "🛏️", cx: 150, cz: 152, pared: 6 },
];
// Puntos de interés al aire libre (mismas claves de lugar que el Mundo 2D): [x, z, nombre]
export const PUNTOS = {
  claro: [62, 62, "Claro del Bosque"], arroyo: [90, 84, "Arroyo Cantarino"], mirador: [40, 96, "Mirador"], campamento: [92, 40, "Campamento del Ermitaño"],
  cascada: [28, 70, "Cascada Escondida"], roble: [64, 26, "Gran Roble"], ruinas: [22, 22, "Ruinas Antiguas"],
  sendero: [184, 68, "Sendero de Piedra"], cueva: [232, 84, "Cueva del Eco"], cumbre: [208, 48, "Cumbre"],
  orilla: [100, 184, "Orilla"], muelle: [128, 188, "Muelle"], isla: [128, 214, "Isla Serena"],
  // guardianes de cada zona (duelo para ganar la insignia)
  guardia_aldea: [138, 122, "Guardiana de la Aldea"], guardia_bosque: [67, 72, "Guardia del Bosque"], guardia_montana: [188, 72, "Guardia de la Montaña"], guardia_lago: [124, 178, "Guardia del Lago"],
};
// De qué lado está la puerta (mirando a la plaza)
function ladoPuerta(e) { const dx = CENTRO - e.cx, dz = CENTRO - e.cz; return Math.abs(dx) > Math.abs(dz) ? { eje: "x", sg: Math.sign(dx) } : { eje: "z", sg: Math.sign(dz) }; }

// ---------- portales (en el Cruce de los Mundos, lejos de la aldea) ----------
// Marco de 4 de ancho × 5 de alto, hueco de 2 × 3. Dos filas sobre una plataforma de piedra.
export function posicionesPortales(n) {
  const xs = [-10, -4, 2, 8].map((o) => CRUCE.x + o), res = [];
  for (let i = 0; i < Math.min(8, n); i++) res.push({ x: xs[i % 4], z: CRUCE.z + (i < 4 ? -4 : 4), y: 13 });
  return res;
}

export function iniciarMundo3D(host, ctx) {
  let vivo = true;
  const DIM = ctx.dim | 0;
  const mundo = new Uint8Array(SX * SY * SZ);
  let ultApuntado = "";
  const autores = new Map(); // "x,y,z" → autor_id de los bloques cambiados
  const idx = (x, y, z) => (y * SZ + z) * SX + x;
  const get = (x, y, z) => (x < 0 || x >= SX || z < 0 || z >= SZ || y < 0) ? (y < 0 ? 3 : 0) : (y >= SY ? 0 : mundo[idx(x, y, z)]);
  const esHueco = (b) => b === AIRE || b === AGUA || b === PORTAL || (b >= 100 && b <= 111) || b === LAVA || b === VELO;     // no choca
  const solido = (x, y, z) => { if (y < 0 || x < 0 || x >= SX || z < 0 || z >= SZ) return true; return !esHueco(get(x, y, z)); };
  const sucios = new Set(); const chunks = [];

  // ----- generar -----
  const semilla = hashTxt("codice-" + ctx.grado) | 0;
  let sem = (semilla >>> 0) || 1; const rnd = () => { sem = (Math.imul(sem, 1664525) + 1013904223) >>> 0; return sem / 4294967296; };
  const alt = new Int16Array(SX * SZ), eraPasto = new Uint8Array(SX * SZ); // eraPasto: donde el terreno original tenía pasto (para no cambiar la secuencia aleatoria de los árboles)
  for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
    const h = altura(x, z, semilla); alt[z * SX + x] = h;
    const enPlaza = Math.max(Math.abs(x - CENTRO), Math.abs(z - CENTRO)) <= RADIO_ADOQUIN, nearLago = Math.hypot((x - LAGO.x) * .8, z - LAGO.z) < LAGO.r + 3;
    const enCamino = distCamino(x, z) <= 1.5; // los caminos son de adoquín
    for (let y = 0; y <= h; y++) {
      let b;
      if (y === h) b = (enPlaza || enCamino) ? ADOQUIN : (nearLago && h <= 12) ? 9 : (h >= 30 ? 3 : 1);
      else if (y >= h - 3) b = (nearLago && h <= 12) ? 9 : (h >= 30 ? 3 : 2);
      else { b = 3; if (y > 1 && y < h - 5 && rnd() < .03) b = 10; }
      if (b === 3 && h >= 26 && y >= h - 2 && !enCamino && !enPlaza && ((Math.imul((x * 73856093) ^ (y * 19349663) ^ (z * 83492791) ^ semilla, 2654435761) >>> 0) % 1000) < 45) b = 10; // vetas a la vista en la montaña
      if (y === h && b === 1) eraPasto[z * SX + x] = 1;
      mundo[idx(x, y, z)] = b;
    }
    for (let y = h + 1; y <= 11; y++) mundo[idx(x, y, z)] = AGUA;
  }
  for (let i = 0; i < 50; i++) { // cuevas
    let cx = (rnd() * SX) | 0, cy = 4 + ((rnd() * 8) | 0), cz = (rnd() * SZ) | 0; const r = 2;
    for (let k = 0; k < 18; k++) {
      for (let dz = -r; dz <= r; dz++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy + dz * dz <= r * r) { const x = cx + dx, y = cy + dy, z = cz + dz; if (x > 0 && x < SX - 1 && z > 0 && z < SZ - 1 && y > 1 && y < alt[z * SX + x] - 3 && !enPlazaProtegida(x, z)) mundo[idx(x, y, z)] = AIRE; }
      }
      cx += ((rnd() * 3) | 0) - 1; cy += ((rnd() * 3) | 0) - 1; cz += ((rnd() * 3) | 0) - 1;
    }
  }
  // rocas variadas bajo tierra y superficie de los biomas (sin usar la secuencia aleatoria: los mundos ya construidos no cambian)
  const hz = (x, y, z, k) => (Math.imul((x * 73856093) ^ (y * 19349663) ^ (z * 83492791) ^ k, 2654435761) >>> 0) / 4294967296;
  for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
    const h = alt[z * SX + x], bi = bioma(x, z);
    for (let y = 2; y <= h - 4; y++) {
      if (mundo[idx(x, y, z)] !== 3) continue;
      if (y <= 5) { mundo[idx(x, y, z)] = 35; continue; }
      const gr = ruidoV(semilla + 11 + (y >> 2), x * .09, z * .09), dio = ruidoV(semilla + 37 + (y >> 2), x * .09, z * .09);
      mundo[idx(x, y, z)] = gr > .72 ? 32 : gr < .17 ? 33 : dio > .74 ? 34 : 3;
    }
    if (bi && h < 30 && mundo[idx(x, h, z)] === 1) {
      if (bi === 1) {
        const roja = ruidoV(91, x * .1, z * .1) > .6 ? 27 : 9;
        mundo[idx(x, h, z)] = roja; for (let y = h - 1; y >= h - 3; y--) if (mundo[idx(x, y, z)] === 2) mundo[idx(x, y, z)] = roja;
        for (let y = h - 4; y >= h - 9 && y > 1; y--) if (mundo[idx(x, y, z)] === 3 && ((y >> 1) & 1)) mundo[idx(x, y, z)] = 27;
      } else {
        mundo[idx(x, h, z)] = 28;
      }
    }
  }
  for (let z = 3; z < SZ - 3; z++) for (let x = 3; x < SX - 3; x++) { // árboles (más densos en el bosque)
    const a = alt[z * SX + x]; if (!eraPasto[z * SX + x]) continue;
    if (Math.max(Math.abs(x - CENTRO), Math.abs(z - CENTRO)) < RADIO_PLAZA + 6) continue;
    if (Math.abs(x - CRUCE.x) < 20 && Math.abs(z - CRUCE.z) < 14) continue;
    if (distCamino(x, z) < 4) continue;
    const p = zonaDe(x, z) === "Bosque de la Curiosidad" ? .035 : .004, r0 = rnd(), bi = bioma(x, z);
    if (bi && mundo[idx(x, a, z)] !== 1) {
      const h0 = hz(x, 0, z, 5);
      if (bi === 1) { if (h0 < .012 && !mundo[idx(x, a + 1, z)]) { const t = 1 + ((hz(x, 1, z, 6) * 3) | 0); for (let k = 1; k <= t; k++) mundo[idx(x, a + k, z)] = 30; } }
      else if (bi === 2 && h0 < .01) { // abeto nevado
        const t = 5 + ((hz(x, 1, z, 6) * 3) | 0); for (let k = 1; k <= t; k++) mundo[idx(x, a + k, z)] = 4;
        for (let k = 2; k <= t + 1; k++) { const rr = k % 2 === 0 ? 2 : 1, cima = k >= t; for (let dz = -rr; dz <= rr; dz++) for (let dx = -rr; dx <= rr; dx++) { if ((cima ? Math.abs(dx) + Math.abs(dz) > 0 : Math.abs(dx) + Math.abs(dz) > rr + 1) || (dx === 0 && dz === 0 && k <= t)) continue; const xx = x + dx, yy = a + k, zz = z + dz; if (yy < SY && !mundo[idx(xx, yy, zz)]) mundo[idx(xx, yy, zz)] = 5; } }
        if (a + t + 2 < SY) mundo[idx(x, a + t + 2, z)] = 28;
      }
    } else if (!bi && r0 < p) {
      const t = 4 + ((rnd() * 2) | 0);
      for (let k = 1; k <= t; k++) mundo[idx(x, a + k, z)] = 4;
      for (let dy = -2; dy <= 1; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) <= 3) { const xx = x + dx, yy = a + t + dy, zz = z + dz; if (yy < SY && !mundo[idx(xx, yy, zz)]) mundo[idx(xx, yy, zz)] = 5; }
      }
    }
  }
  // el Cruce de los Mundos: plataforma de adoquín y un camino que sale de la aldea
  const portalesZona = []; const etiquetas = [];
  for (let dz = -6; dz <= 6; dz++) for (let dx = -12; dx <= 12; dx++) { const x = CRUCE.x + dx, z = CRUCE.z + dz; mundo[idx(x, 12, z)] = ADOQUIN; for (let y = 13; y <= 19; y++) mundo[idx(x, y, z)] = AIRE; }
  // letreros en cada camino (donde sale de la aldea) y el letrero del Cruce
  for (const [nombre, pts] of CAMINOS) {
    let px = pts[0][0], pz = pts[0][1];
    outer: for (let k = 0; k < pts.length - 1; k++) { const [x0, z0] = pts[k], [x1, z1] = pts[k + 1], n = Math.ceil(Math.hypot(x1 - x0, z1 - z0)); for (let i = 0; i <= n; i++) { px = Math.round(x0 + (x1 - x0) * i / n); pz = Math.round(z0 + (z1 - z0) * i / n); if (Math.max(Math.abs(px - CENTRO), Math.abs(pz - CENTRO)) >= RADIO_PLAZA + 3) break outer; } }
    const sx = px + 3, a0 = alt[pz * SX + sx]; for (let k = 1; k <= 3; k++) mundo[idx(sx, a0 + k, pz)] = 4; mundo[idx(sx, a0 + 4, pz)] = 6;
    etiquetas.push({ x: sx + .5, y: a0 + 5.6, z: pz + .5, texto: nombre, clase: "edif" });
  }
  etiquetas.push({ x: CRUCE.x + .5, y: 20.5, z: CRUCE.z + .5, texto: "🌀 Cruce de los Mundos", clase: "edif" });
  // portales
  posicionesPortales((ctx.portales || []).length).forEach((p, i) => {
    const info = ctx.portales[i];
    for (let dx = 0; dx < 4; dx++) for (let dy = 0; dy < 5; dy++) {
      const borde = dx === 0 || dx === 3 || dy === 0 || dy === 4;
      mundo[idx(p.x + dx, p.y + dy, p.z)] = borde ? 7 : PORTAL;
    }
    portalesZona.push({ ...p, id: info.id, nombre: info.nombre });
    etiquetas.push({ x: p.x + 2, y: p.y + 5.6, z: p.z + .5, texto: info.nombre });
  });

  // edificios de la aldea (9 × 9, paredes de 5 de alto, techo, puerta de 3 × 3 hacia la plaza, ventanas de cristal)
  for (const e of EDIFICIOS) {
    const d = ladoPuerta(e), y0 = 12;
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
      const x = e.cx + dx, z = e.cz + dz, borde = Math.abs(dx) === 4 || Math.abs(dz) === 4;
      mundo[idx(x, y0, z)] = 6;
      for (let y = y0 + 1; y <= y0 + 5; y++) mundo[idx(x, y, z)] = borde ? e.pared : AIRE;
      mundo[idx(x, y0 + 6, z)] = 6;
      if (Math.abs(dx) <= 3 && Math.abs(dz) <= 3) mundo[idx(x, y0 + 7, z)] = 6;
    }
    for (let o = -1; o <= 1; o++) for (let y = y0 + 1; y <= y0 + 3; y++) {
      const x = d.eje === "x" ? e.cx + d.sg * 4 : e.cx + o, z = d.eje === "x" ? e.cz + o : e.cz + d.sg * 4; mundo[idx(x, y, z)] = AIRE;
    }
    for (const o of [-2, 2]) for (const y of [y0 + 2, y0 + 3]) {
      if (d.eje === "x") { mundo[idx(e.cx - d.sg * 4, y, e.cz + o)] = 8; mundo[idx(e.cx + o, y, e.cz - 4)] = 8; mundo[idx(e.cx + o, y, e.cz + 4)] = 8; }
      else { mundo[idx(e.cx + o, y, e.cz - d.sg * 4)] = 8; mundo[idx(e.cx - 4, y, e.cz + o)] = 8; mundo[idx(e.cx + 4, y, e.cz + o)] = 8; }
    }
    mundo[idx(e.cx, y0 + 1, e.cz)] = 6; mundo[idx(e.cx + 1, y0 + 1, e.cz)] = 6; // una mesa al centro
    etiquetas.push({ x: e.cx + .5, y: y0 + 9.2, z: e.cz + .5, texto: e.emoji + " " + e.nombre, clase: "edif" });
  }
  for (let z = LAGO.z - 30; z <= LAGO.z - 12; z++) for (let x = LAGO.x - 1; x <= LAGO.x + 1; x++) { mundo[idx(x, 12, z)] = 6; for (let y = 13; y <= 16; y++) mundo[idx(x, y, z)] = AIRE; } // el muelle
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) if (dx * dx + dz * dz <= 10) { // la isla del lago
    const x = LAGO.x + dx, z = LAGO.z + dz; for (let y = 1; y <= 12; y++) if (!mundo[idx(x, y, z)] || mundo[idx(x, y, z)] === AGUA) mundo[idx(x, y, z)] = 9;
  }

  // ----- personajes (NPC) -----
  let npcs = [];
  // el suelo firme más cercano a un punto (nunca agua, árboles ni huecos): ahí se paran los personajes al aire libre
  function firme(x0, z0) {
    for (let r = 0; r <= 10; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const x = x0 + dx, z = z0 + dz; if (x < 2 || z < 2 || x >= SX - 2 || z >= SZ - 2) continue;
      let y = SY - 3; while (y > 0 && !mundo[idx(x, y, z)]) y--;
      if (y >= 12 && [1, 2, 3, 6, 9, 13].includes(mundo[idx(x, y, z)]) && !mundo[idx(x, y + 1, z)] && !mundo[idx(x, y + 2, z)]) return { x: x + .5, z: z + .5, y: y + 1 };
    }
    return { x: x0 + .5, z: z0 + .5, y: 13 };
  }
  function posNpc(lista) {
    const porLugar = {};
    for (const n of lista) (porLugar[n.lugar || "plaza"] = porLugar[n.lugar || "plaza"] || []).push(n);
    const res = [];
    for (const [lugar, ns] of Object.entries(porLugar)) {
      ns.forEach((n, i) => {
        let x, z, y = 13; const ed = EDIFICIOS.find((e) => e.key === lugar);
        if (ed) {
          const d = ladoPuerta(ed), o = ns.length === 1 ? 0 : -2.5 + (5 * i) / (ns.length - 1), fondo = -d.sg * 3;
          x = d.eje === "x" ? ed.cx + fondo + .5 : ed.cx + o + .5; z = d.eje === "x" ? ed.cz + o + .5 : ed.cz + fondo + .5;
        } else if (lugar === "plaza" || !PUNTOS[lugar]) { const a = (i / Math.max(1, ns.length)) * Math.PI * 2 + .6; x = CENTRO + .5 + Math.cos(a) * 6; z = CENTRO + .5 + Math.sin(a) * 6 - 1; }
        else {
          const pt = PUNTOS[lugar], f = firme(pt[0] + i * 2, pt[1]); x = f.x; z = f.z; y = f.y;
        }
        res.push({ ...n, x, y, z, r: ed ? (ns.length > 3 ? .8 : 1.5) : lugar === "plaza" || !PUNTOS[lugar] ? 2.5 : 2 });
      });
    }
    return res;
  }
  npcs = posNpc(ctx.npcs || []);
  // en lugares al aire libre, cada punto de interés lleva un letrero
  const lugaresConNpc = [...new Set(npcs.map((n) => n.lugar))].filter((l) => PUNTOS[l]);
  lugaresConNpc.forEach((l) => { const p = PUNTOS[l]; etiquetas.push({ x: p[0] + .5, y: (alt[p[1] * SX + p[0]] || 12) + 3.6, z: p[1] + .5, texto: "📍 " + p[2], clase: "edif" }); });

  // ----- cambios guardados -----
  // ----- murallas y portones de las zonas -----
  // Cada zona (Bosque, Montaña, Lago) está rodeada por una muralla de 3 bloques; solo se cruza por el portón del camino.
  // El portón se abre cuando la zona está desbloqueada para el estudiante. Nadie puede construir cerca de los muros.
  const CLAVE_ZONA = { "Bosque de la Curiosidad": "bosque", "Montaña del Esfuerzo": "montana", "Lago": "lago" };
  const NOMBRE_ZONA = { bosque: "Bosque de la Curiosidad", montana: "Montaña del Esfuerzo", lago: "Lago de la Reflexión" };
  const fijo = new Uint8Array(SX * SZ), veda = new Uint8Array(SX * SZ);
  const puertasZona = {}, antorchas = [], flores = [];
  {
    const zi = new Uint8Array(SX * SZ), CODIGOS = { bosque: 1, montana: 2, lago: 3 }, NOMBRES_Z = [null, "bosque", "montana", "lago"];
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) zi[z * SX + x] = CODIGOS[CLAVE_ZONA[zonaDe(x, z)]] || 0;
    const zAt = (x, z) => (x < 0 || x >= SX || z < 0 || z >= SZ ? -1 : zi[z * SX + x]);
    const bordes = [], puerta = new Set();
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      const k = zi[z * SX + x]; if (!k) continue; let borde = false;
      for (let dz = -1; dz <= 1 && !borde; dz++) for (let dx = -1; dx <= 1; dx++) { const o = zAt(x + dx, z + dz); if (o >= 0 && o !== k) { borde = true; break; } }
      if (borde) { bordes.push([x, z, k]); if (distCamino(x, z) <= 2.6) puerta.add(x + "," + z); }
    }
    const altMax = (x, z) => { let m = 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, zz = z + dz; if (xx >= 0 && xx < SX && zz >= 0 && zz < SZ) m = Math.max(m, alt[zz * SX + xx]); } return m; };
    for (const [x, z, k] of bordes) {
      const a = alt[z * SX + x], clave = NOMBRES_Z[k]; fijo[z * SX + x] = 1;
      if (puerta.has(x + "," + z)) {
        const p = puertasZona[clave] || (puertasZona[clave] = { celdas: [], sx: 0, sz: 0, sy: 0, abierta: false, init: false, nombre: NOMBRE_ZONA[clave], et: -1 });
        p.celdas.push([x, a + 1, z]); p.sx += x + .5; p.sz += z + .5; p.sy = Math.max(p.sy, a);
        for (let y = a + 1; y <= a + 3; y++) mundo[idx(x, y, z)] = 15;
        mundo[idx(x, a + 4, z)] = 6; mundo[idx(x, a + 5, z)] = 4;
      } else {
        let pilar = false; for (let dz = -1; dz <= 1 && !pilar; dz++) for (let dx = -1; dx <= 1; dx++) if (puerta.has((x + dx) + "," + (z + dz))) { pilar = true; break; }
        if (pilar) { for (let y = a + 1; y <= a + 7; y++) mundo[idx(x, y, z)] = 7; mundo[idx(x, a + 8, z)] = 3; antorchas.push([x + .5, a + 8.9, z + .5]); }
        else for (let y = a + 1; y <= altMax(x, z) + 3; y++) mundo[idx(x, y, z)] = 14;
      }
    }
    for (const k in puertasZona) { const p = puertasZona[k], n = p.celdas.length; p.cx = p.sx / n; p.cz = p.sz / n; etiquetas.push({ x: p.cx, y: p.sy + 8.2, z: p.cz, texto: "🔒 " + p.nombre, clase: "edif" }); p.et = etiquetas.length - 1; }
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) if (fijo[z * SX + x]) for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { const xx = x + dx, zz = z + dz; if (xx >= 0 && xx < SX && zz >= 0 && zz < SZ) veda[zz * SX + xx] = 1; }
    // antorchas en las esquinas de la plaza y junto a cada puerta de edificio
    for (const [dx, dz] of [[-13, -13], [13, -13], [-13, 13], [13, 13]]) { const x = CENTRO + dx, z = CENTRO + dz; antorchas.push([x + .5, alt[z * SX + x] + 1, z + .5]); }
    for (const e of EDIFICIOS) { const d = ladoPuerta(e), x = e.cx + (d.eje === "x" ? d.sg * 5 : 3), z = e.cz + (d.eje === "z" ? d.sg * 5 : 3); antorchas.push([x + .5, alt[z * SX + x] + 1, z + .5]); }
    // flores silvestres, en grupos, sobre el pasto
    let s4 = ((semilla ^ 0x2c1b3c6d) >>> 0) || 9; const r4 = () => { s4 = (Math.imul(s4, 1664525) + 1013904223) >>> 0; return s4 / 4294967296; };
    const COLS = [[.86, .15, .15], [.98, .82, .15], [.35, .45, .95], [.95, .5, .75], [.97, .97, .95], [.72, .3, .85]];
    for (let g = 0; g < 70; g++) {
      const gx = 6 + r4() * (SX - 12), gz = 6 + r4() * (SZ - 12), col = COLS[(r4() * COLS.length) | 0];
      for (let i = 0; i < 6; i++) {
        const x = Math.floor(gx + (r4() - .5) * 7), z = Math.floor(gz + (r4() - .5) * 7); if (x < 2 || z < 2 || x >= SX - 2 || z >= SZ - 2) continue;
        const a = alt[z * SX + x]; if (mundo[idx(x, a, z)] !== 1 || mundo[idx(x, a + 1, z)] !== AIRE || veda[z * SX + x] || distCamino(x, z) < 2.5) continue;
        flores.push({ x: x + .2 + r4() * .6, y: a + 1, z: z + .2 + r4() * .6, bx: x, bz: z, col: i % 4 === 3 ? COLS[(r4() * COLS.length) | 0] : col, ph: r4() * 6.28 });
      }
    }
  }
  function setPuertas(m) {
    for (const k in puertasZona) {
      const p = puertasZona[k], abre = !!(m && m[k]); if (p.init && abre === p.abierta) continue;
      const cambio = p.init && abre; p.abierta = abre; p.init = true;
      for (const [x, y0, z] of p.celdas) { for (let y = y0; y < y0 + 3; y++) mundo[idx(x, y, z)] = abre ? AIRE : 15; marcar(x, z); }
      const el = capaEt[p.et]; if (el) el.textContent = (abre ? "🔓 " : "🔒 ") + p.nombre;
      if (cambio && Math.hypot(p.cx - jug.x, p.cz - jug.z) < 40) sonido.abrirPuerta();
    }
  }

  // ----- dimensiones: Reino de Brasas (dim 1) y arcos de entrada/salida -----
  const LAIR = { x: 210, z: 60 };
  if (DIM === 1) {
    mundo.fill(0); fijo.fill(0); veda.fill(0); antorchas.length = 0; flores.length = 0; etiquetas.length = 0; portalesZona.length = 0;
    for (const k in puertasZona) delete puertasZona[k];
    const hh = (x, z, k) => hz(x, 0, z, k);
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      const n = ruidoV(semilla + 7, x / 22, z / 22) * .6 + ruidoV(semilla + 13, x / 9, z / 9) * .4;
      let h = 5 + Math.floor(n * 15);
      const dp = Math.max(Math.abs(x - CENTRO), Math.abs(z - CENTRO)), dl = Math.hypot(x - LAIR.x, z - LAIR.z);
      if (dp <= 22) h = 12; else if (dp < RADIO_PLAZA) { const t = (dp - 22) / (RADIO_PLAZA - 22); h = Math.round(12 + (h - 12) * t); }
      if (dl <= 20) h = 12; else if (dl < 28) { const t = (dl - 20) / 8; h = Math.round(12 + (h - 12) * t); }
      h = Math.max(5, Math.min(19, h));
      for (let y = 0; y <= h; y++) mundo[idx(x, y, z)] = (y === h && hh(x, z, 1) < .35) ? 113 : 112;
      if (h < 9) { for (let y = h + 1; y <= 9; y++) mundo[idx(x, y, z)] = LAVA; alt[z * SX + x] = 9; } else alt[z * SX + x] = h;
      for (let y = 36; y < SY; y++) mundo[idx(x, y, z)] = 113;
      if (hh(x, z, 2) < .035 && dp > 14) { const L = 2 + Math.floor(hh(x, z, 3) * 4); for (let y = 36 - L; y < 36; y++) mundo[idx(x, y, z)] = 113; }
      if (hh(x, z, 4) < .012 && dp > 14) mundo[idx(x, 35, z)] = 115;
      if (h >= 9 && hh(x, z, 5) < .004 && dp > 14) mundo[idx(x, h, z)] = 115;
      for (let y = 1; y < h - 1; y++) if (hz(x, y, z, 6) < .012) mundo[idx(x, y, z)] = 116;
      if (h >= 11 && hh(x, z, 8) < .03 && dp > 14) mundo[idx(x, h, z)] = 116; // vetas a la vista
    }
    // plaza segura: suelo de ladrillo ígneo, pilares con brasa y arco de regreso
    for (let z = CENTRO - 12; z <= CENTRO + 12; z++) for (let x = CENTRO - 12; x <= CENTRO + 12; x++) mundo[idx(x, 12, z)] = 117;
    for (const [sx, sz] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) { for (let y = 13; y <= 16; y++) mundo[idx(CENTRO + sx, y, CENTRO + sz)] = 117; mundo[idx(CENTRO + sx, 17, CENTRO + sz)] = 115; }
    const az = CENTRO - 8;
    for (let y = 13; y <= 15; y++) { mundo[idx(CENTRO - 2, y, az)] = 117; mundo[idx(CENTRO + 1, y, az)] = 117; mundo[idx(CENTRO - 1, y, az)] = VELO; mundo[idx(CENTRO, y, az)] = VELO; }
    for (let x = CENTRO - 2; x <= CENTRO + 1; x++) mundo[idx(x, 16, az)] = 117;
    mundo[idx(CENTRO - 2, 17, az)] = 115; mundo[idx(CENTRO + 1, 17, az)] = 115;
    etiquetas.push({ x: CENTRO + .5, y: 18.8, z: az + .5, texto: "🔙 Volver al mundo principal", clase: "edif" });
    etiquetas.push({ x: CENTRO + .5, y: 15.5, z: CENTRO + .5, texto: "🏠 Campamento seguro", clase: "edif" });
    // arena del Guardián: plataforma, anillo de lava y cuatro puentes
    for (let z = LAIR.z - 16; z <= LAIR.z + 16; z++) for (let x = LAIR.x - 16; x <= LAIR.x + 16; x++) {
      const d = Math.hypot(x - LAIR.x, z - LAIR.z), px = Math.abs(x - LAIR.x), pz = Math.abs(z - LAIR.z);
      if (d <= 11) mundo[idx(x, 12, z)] = 117;
      else if (d <= 15) { const puente = px <= 1 || pz <= 1; if (puente) mundo[idx(x, 12, z)] = 117; else { mundo[idx(x, 12, z)] = LAVA; mundo[idx(x, 11, z)] = LAVA; mundo[idx(x, 10, z)] = 112; } }
    }
    for (const [sx, sz] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) { for (let y = 13; y <= 17; y++) mundo[idx(LAIR.x + sx, y, LAIR.z + sz)] = 117; mundo[idx(LAIR.x + sx, 18, LAIR.z + sz)] = 115; }
    etiquetas.push({ x: LAIR.x + .5, y: 22, z: LAIR.z + .5, texto: "👑 Guarida del Guardián de Brasas", clase: "edif" });
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) if (x === 0 || z === 0 || x === SX - 1 || z === SZ - 1) fijo[z * SX + x] = 1;
  } else if (DIM === 0) {
    const ax = CRUCE.x + 11, a = 12;
    for (let dz = -3; dz <= 2; dz++) for (let dx = -1; dx <= 1; dx++) for (let y = a + 1; y <= a + 6; y++) mundo[idx(ax + dx, y, CRUCE.z + dz)] = AIRE;
    for (let y = a + 1; y <= a + 3; y++) { mundo[idx(ax, y, CRUCE.z - 2)] = 117; mundo[idx(ax, y, CRUCE.z + 1)] = 117; mundo[idx(ax, y, CRUCE.z - 1)] = VELO; mundo[idx(ax, y, CRUCE.z)] = VELO; }
    for (let z = CRUCE.z - 2; z <= CRUCE.z + 1; z++) mundo[idx(ax, a + 4, z)] = 117;
    mundo[idx(ax, a + 5, CRUCE.z - 2)] = 115; mundo[idx(ax, a + 5, CRUCE.z + 1)] = 115;
    etiquetas.push({ x: ax + .5, y: a + 6.6, z: CRUCE.z + .5, texto: "🔥 Reino de Brasas (necesitas la llave)", clase: "edif" });
    for (let dz = -3; dz <= 2; dz++) for (let dx = -1; dx <= 1; dx++) fijo[(CRUCE.z + dz) * SX + ax + dx] = 1;
  }
  let dimCd = 0;
  function vigilarDim(dt) {
    dimCd = Math.max(0, dimCd - dt); if (dimCd > 0 || ctx.soloMirar || ctx.vuelo || desmayado > 0) return;
    const xi = Math.floor(jug.x), zi = Math.floor(jug.z);
    if (get(xi, Math.floor(jug.y + .3), zi) === VELO || get(xi, Math.floor(jug.y + 1.2), zi) === VELO) { dimCd = 4; try { sonido.portal(); ctx.alDim && ctx.alDim(DIM ? 0 : 1); } catch (_) {} }
  }
  // ----- lava: quema (el servidor descuenta la vida) -----
  let lavaCd = 0;
  function vigilarLava(dt) {
    lavaCd = Math.max(0, lavaCd - dt); if (!enLava || lavaCd > 0 || ctx.soloMirar || desmayado > 0) return;
    lavaCd = 1; danoEl.classList.add("on"); requestAnimationFrame(() => requestAnimationFrame(() => danoEl.classList.remove("on"))); sonido.dano();
    jug.vy = Math.max(jug.vy, 2.5);
    Promise.resolve(ctx.alDanio && ctx.alDanio("lava")).then((r) => { if (!r) return; try { ctx.alVida && ctx.alVida(r); } catch (_) {} if (r.desmayo) desmayarse(); }).catch(() => {});
  }
  // ----- jefe: el Guardián de Brasas despierta cuando te acercas a su guarida -----
  let jefeCd = 0;
  function vigilarJefe(dt) {
    jefeCd = Math.max(0, jefeCd - dt);
    if (DIM !== 1 || jefeCd > 0 || !monActivo || ctx.soloMirar || ctx.vuelo || desmayado > 0 || pausado) return;
    if (mons.some((m) => m.def.jefe) || Math.hypot(jug.x - LAIR.x, jug.z - LAIR.z) > 60) return;
    const def = MONSTRUOS.guardian_brasas; mons.push({ tipo: "guardian_brasas", def, x: LAIR.x + .5, y: 13, z: LAIR.z + .5, h: 0, hp: def.hp, flash: 0, cd: 2, lunge: 0, fase: 0, amp: 0, kb: null, quema: 0 });
    aviso("👑 ¡Despierta el Guardián de Brasas!"); sonido.monstruo("guardian_brasas");
  }
  let esperaPuerta = 0;
  function vigilarPuertas(dt) {
    esperaPuerta = Math.max(0, esperaPuerta - dt); if (esperaPuerta > 0 || ctx.vuelo) return;
    for (const k in puertasZona) { const p = puertasZona[k]; if (!p.abierta && Math.hypot(p.cx - jug.x, p.cz - jug.z) < 6.5 && Math.abs(p.sy + 1 - jug.y) < 6) { esperaPuerta = 6; sonido.puertaCerrada(); try { ctx.alPuerta && ctx.alPuerta(k); } catch (_) {} break; } }
  }

  function aplicar(filas, noMarcar) {
    for (const f of filas || []) {
      if (f.x < 0 || f.x >= SX || f.z < 0 || f.z >= SZ || f.y < 0 || f.y >= SY) continue;
      if (fijo[f.z * SX + f.x]) continue; // los muros y portones de las zonas no se pueden cambiar
      mundo[idx(f.x, f.y, f.z)] = f.bloque; autores.set(f.x + "," + f.y + "," + f.z, f.autor_id);
      if (!noMarcar) marcar(f.x, f.z);
    }
  }
  const marcar = (x, z) => {
    const cx = Math.floor(x / CH), cz = Math.floor(z / CH); sucios.add(cz * NCX + cx);
    if (x % CH === 0 && cx > 0) sucios.add(cz * NCX + cx - 1); if (x % CH === CH - 1 && cx < NCX - 1) sucios.add(cz * NCX + cx + 1);
    if (z % CH === 0 && cz > 0) sucios.add((cz - 1) * NCX + cx); if (z % CH === CH - 1 && cz < NCZ - 1) sucios.add((cz + 1) * NCX + cx);
  };
  aplicar(ctx.cambios, true);

  // ----- DOM -----
  const estilo = document.createElement("style");
  estilo.textContent = `.m3d{position:relative;width:100%;overflow:hidden;background:#000;touch-action:none;user-select:none;-webkit-user-select:none;border-radius:8px}
.m3d canvas{display:block;width:100%;aspect-ratio:16/9;cursor:crosshair;touch-action:none}
.m3d-full .m3d{height:100vh;height:100dvh;border-radius:0}.m3d-full .m3d canvas{height:100%;aspect-ratio:auto}
.m3d-mira{position:absolute;left:50%;top:50%;width:18px;height:18px;transform:translate(-50%,-50%);pointer-events:none}
.m3d-mira:before,.m3d-mira:after{content:"";position:absolute;background:#fff;mix-blend-mode:difference}
.m3d-mira:before{left:8px;top:0;width:2px;height:18px}.m3d-mira:after{top:8px;left:0;height:2px;width:18px}
.m3d-ayuda{position:absolute;left:0;right:0;bottom:10px;text-align:center;pointer-events:none;font:12px monospace;color:#fff;text-shadow:0 1px 3px #000}
.m3d-et{position:absolute;left:0;top:0;transform:translate(-50%,-100%);font:600 12px system-ui,sans-serif;color:#fff;background:#4b2a8fcc;padding:2px 8px;border-radius:10px;pointer-events:none;white-space:nowrap}
.m3d-joy{position:absolute;left:14px;bottom:14px;width:110px;height:110px;border-radius:50%;border:2px solid #fff5;background:#0003;display:none;pointer-events:none}
.m3d-joy i{position:absolute;left:35px;top:35px;width:40px;height:40px;border-radius:50%;background:#fff7}
.m3d-acc{position:absolute;right:12px;bottom:12px;display:none;gap:8px;flex-direction:column}
.m3d-acc button{width:64px;height:46px;border-radius:10px;border:2px solid #fff6;background:#0007;color:#fff;font:12px monospace;touch-action:none}
.m3d-et.edif{background:#14532dcc;font-size:13px}
.m3d-npc{position:absolute;left:0;top:0;transform:translate(-50%,-100%);font:600 12px system-ui,sans-serif;color:#fff;background:#92400ecc;padding:2px 8px;border-radius:10px;pointer-events:none;white-space:nowrap}
.m3d-npc.ok{background:#166534cc}
.m3d-botin{position:absolute;left:10px;top:70px;display:flex;flex-direction:column;gap:3px;pointer-events:none;z-index:5}.m3d-botin div{font:700 12px system-ui,sans-serif;color:#fff;background:#0009;padding:3px 9px;border-radius:8px;width:max-content;animation:m3d-botin 2.2s ease forwards}@keyframes m3d-botin{0%{opacity:0;transform:translateX(-10px)}10%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0}}
.m3d-burbuja{position:absolute;left:0;top:0;transform:translate(-50%,-100%);font:700 13px system-ui,sans-serif;color:#111;background:#fff;padding:4px 10px;border-radius:12px;pointer-events:none;white-space:nowrap;box-shadow:0 2px 6px #0006;z-index:6}
.m3d-parcela{position:absolute;left:0;top:0;transform:translate(-50%,-100%);font:700 12px system-ui,sans-serif;color:#fff;background:#475569cc;padding:2px 9px;border-radius:10px;pointer-events:none;white-space:nowrap}.m3d-parcela.mia{background:#b45309e6}
.m3d-otro{position:absolute;left:0;top:0;transform:translate(-50%,-100%);font:600 12px system-ui,sans-serif;color:#fff;background:#0369a1cc;padding:2px 8px;border-radius:10px;pointer-events:none;white-space:nowrap}
.m3d-hablar{position:absolute;left:50%;bottom:44px;transform:translateX(-50%);font:600 13px system-ui,sans-serif;color:#fff;background:#000a;border:1px solid #fff6;padding:6px 12px;border-radius:10px;pointer-events:none;display:none}
.m3d-acc button.hab{display:none;background:#b45309cc}
@media (pointer:coarse){.m3d-joy{display:block}.m3d-acc{display:flex}.m3d-hablar{display:none!important}}
@media (pointer:coarse) and (orientation:portrait){.m3d-joy{left:12px;bottom:18px;width:120px;height:120px}.m3d-joy i{left:40px;top:40px}.m3d-acc{flex-direction:row;flex-wrap:wrap;justify-content:flex-end;width:154px;right:10px;bottom:18px}.m3d-acc button{width:72px;height:56px;font-size:13px;font-weight:700}.m3d-ayuda{bottom:150px}}
.m3d,.m3d canvas{-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}`;
  const raiz = document.createElement("div"); raiz.className = "m3d";
  const cv = document.createElement("canvas"); cv.width = 800; cv.height = 450; cv.setAttribute("aria-label", "Mundo 3D de bloques");
  const mira = document.createElement("div"); mira.className = "m3d-mira";
  const esTactil = typeof matchMedia === "function" && matchMedia("(pointer:coarse)").matches;
  const ayuda = document.createElement("div"); ayuda.className = "m3d-ayuda"; ayuda.textContent = esTactil ? "Toca para jugar" : "Haz clic para jugar";
  const joyEl = document.createElement("div"); joyEl.className = "m3d-joy"; joyEl.innerHTML = "<i></i>";
  const acc = document.createElement("div"); acc.className = "m3d-acc";
  acc.innerHTML = '<button data-k="salto">SALTAR</button><button data-k="picar">PICAR</button><button data-k="poner">PONER</button><button data-k="hablar" class="hab">HABLAR</button>';
  const hablarEl = document.createElement("div"); hablarEl.className = "m3d-hablar";
  estilo.textContent += ".m3d-dano{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,rgba(255,0,0,0) 38%,rgba(190,0,0,.7) 100%);opacity:0;transition:opacity .45s ease-out}.m3d-dano.on{opacity:1;transition:none}.m3d-desmayo{position:absolute;inset:0;display:none;align-items:center;justify-content:center;text-align:center;background:#000d;color:#fff;font:700 20px system-ui,sans-serif;z-index:5;padding:20px}";
  const rayoEl = document.createElement("div"); rayoEl.style.cssText = "position:absolute;inset:0;pointer-events:none;background:#eaf2ff;opacity:0";
  let rayoT = 8 + Math.random() * 10, rayoF = 0, truenoT = 0;
  const danoEl = document.createElement("div"); danoEl.className = "m3d-dano";
  const desmayoEl = document.createElement("div"); desmayoEl.className = "m3d-desmayo"; desmayoEl.innerHTML = "<div>💫 ¡Te desmayaste!<br><span style='font-weight:500;font-size:15px'>Despiertas en la aldea. Estudia un poco y vuelve a intentarlo.</span></div>";
  raiz.append(estilo, cv, mira, ayuda, joyEl, acc, hablarEl, rayoEl, danoEl, desmayoEl);
  const btnHab = acc.querySelector(".hab");
  const capaEt = etiquetas.map((e) => { const d = document.createElement("div"); d.className = "m3d-et" + (e.clase ? " " + e.clase : ""); d.textContent = (e.clase ? "" : "🌀 ") + e.texto; d.style.display = "none"; raiz.append(d); return d; });
  host.append(raiz);

  // ----- WebGL -----
  const gl = cv.getContext("webgl", { antialias: false, alpha: false });
  if (!gl) { raiz.innerHTML = '<div style="padding:24px;text-align:center;color:#98a0ad">Tu navegador no permite gráficos 3D (WebGL). Prueba con otro navegador.</div>'; return { aplicar() {}, seleccionar() {}, setCalidad() {}, cerrar() { raiz.remove(); } }; }
  const prog = (vs, fs) => { const p = gl.createProgram(); for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); gl.attachShader(p, sh); } gl.linkProgram(p); return p; };
  const P = prog("attribute vec3 p;attribute vec2 u;attribute float s;uniform mat4 m;varying vec2 vu;varying float vs;varying float vd;void main(){vec4 q=m*vec4(p,1.0);gl_Position=q;vu=u;vs=s;vd=q.w;}",
    "precision mediump float;uniform sampler2D t;uniform vec3 cn;uniform vec3 lc;uniform vec2 fg;varying vec2 vu;varying float vs;varying float vd;void main(){vec4 c=texture2D(t,vu);if(c.a<.5)discard;float f=clamp((vd-fg.x)/fg.y,0.0,1.0);gl_FragColor=vec4(mix(c.rgb*vs*lc,cn,f),1.0);}");
  const PL = prog("attribute vec3 p;uniform mat4 m;void main(){gl_Position=m*vec4(p,1.0);}", "precision mediump float;void main(){gl_FragColor=vec4(1.0);}");
  const loc = { p: gl.getAttribLocation(P, "p"), u: gl.getAttribLocation(P, "u"), s: gl.getAttribLocation(P, "s"), m: gl.getUniformLocation(P, "m"), t: gl.getUniformLocation(P, "t"), cn: gl.getUniformLocation(P, "cn"), lc: gl.getUniformLocation(P, "lc"), fg: gl.getUniformLocation(P, "fg") };
  const locL = { p: gl.getAttribLocation(PL, "p"), m: gl.getUniformLocation(PL, "m") };
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas());
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
  gl.getExtension("OES_element_index_uint");
  const CARAS = [
    { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: .8 }, { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: .8 },
    { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1 }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: .5 },
    { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: .9 }, { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: .7 },
  ];
  const UVC = [[0, 1], [1, 1], [1, 0], [0, 0]];
  const transparente = (b) => b === AIRE || b === 8 || b === AGUA || b === PORTAL || (b >= 100 && b <= 111) || b === LAVA || b === VELO;
  function construir(cx, cz) {
    const pos = [], uv = [], sh = [], ind = []; let n = 0;
    for (let z = cz * CH; z < cz * CH + CH; z++) for (let x = cx * CH; x < cx * CH + CH; x++) for (let y = 0; y < SY; y++) {
      const b = mundo[idx(x, y, z)]; if (!b) continue;
      if (b >= 100 && b <= 111) { // cultivo: dos planos cruzados, visibles por ambos lados
        const t = tileDe(b, 0), u0 = t / NT + .0005, u1 = (t + 1) / NT - .0005;
        for (const [ax, az, bx, bz] of [[0, 0, 1, 1], [1, 0, 0, 1]]) {
          pos.push(x + ax, y, z + az, x + bx, y, z + bz, x + bx, y + 1, z + bz, x + ax, y + 1, z + az);
          uv.push(u0, .999, u1, .999, u1, .001, u0, .001); sh.push(.95, .95, .95, .95);
          ind.push(n, n + 1, n + 2, n, n + 2, n + 3, n, n + 2, n + 1, n, n + 3, n + 2); n += 4;
        }
        continue;
      }
      for (let f = 0; f < 6; f++) {
        const c = CARAS[f], nb = get(x + c.n[0], y + c.n[1], z + c.n[2]);
        if (!transparente(nb) || nb === b) continue;
        const t = tileDe(b, f), u0 = t / NT + .0005, u1 = (t + 1) / NT - .0005, dy = (b === AGUA || b === LAVA) && f === 2 ? -.12 : 0;
        for (let k = 0; k < 4; k++) { pos.push(x + c.c[k][0], y + c.c[k][1] + (c.c[k][1] ? dy : 0), z + c.c[k][2]); uv.push(UVC[k][0] ? u1 : u0, UVC[k][1] ? .999 : .001); sh.push(c.s); }
        ind.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4;
      }
    }
    let ch = chunks[cz * NCX + cx]; if (!ch) ch = chunks[cz * NCX + cx] = { pb: gl.createBuffer(), ub: gl.createBuffer(), sb: gl.createBuffer(), ib: gl.createBuffer(), n: 0 };
    gl.bindBuffer(gl.ARRAY_BUFFER, ch.pb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, ch.ub); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, ch.sb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sh), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ch.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(ind), gl.STATIC_DRAW);
    ch.n = ind.length;
  }
  for (let cz = 0; cz < NCZ; cz++) for (let cx = 0; cx < NCX; cx++) construir(cx, cz);
  const cajaB = gl.createBuffer();
  { const e = .002, a = -e, b = 1 + e; const v = [[a, a, a], [b, a, a], [b, a, a], [b, a, b], [b, a, b], [a, a, b], [a, a, b], [a, a, a], [a, b, a], [b, b, a], [b, b, a], [b, b, b], [b, b, b], [a, b, b], [a, b, b], [a, b, a], [a, a, a], [a, b, a], [b, a, a], [b, b, a], [b, a, b], [b, b, b], [a, a, b], [a, b, b]];
    gl.bindBuffer(gl.ARRAY_BUFFER, cajaB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v.flat()), gl.STATIC_DRAW); }

  // ----- personajes: aldeanos de bloques, con cuerpo y movimiento -----
  const PC = prog("attribute vec3 p;attribute float s;uniform mat4 m;uniform vec3 c;varying vec3 vc;varying float vd;void main(){vec4 q=m*vec4(p,1.0);gl_Position=q;vc=c*s;vd=q.w;}",
    "precision mediump float;uniform vec3 cn;uniform vec3 lc;uniform vec2 fg;varying vec3 vc;varying float vd;void main(){float f=clamp((vd-fg.x)/fg.y,0.0,1.0);gl_FragColor=vec4(mix(vc*lc,cn,f),1.0);}");
  const locC = { p: gl.getAttribLocation(PC, "p"), s: gl.getAttribLocation(PC, "s"), m: gl.getUniformLocation(PC, "m"), c: gl.getUniformLocation(PC, "c"), cn: gl.getUniformLocation(PC, "cn"), lc: gl.getUniformLocation(PC, "lc"), fg: gl.getUniformLocation(PC, "fg") };
  const cuboB = gl.createBuffer();
  { const d = [], sh = [.8, .8, 1, .55, .9, .7], Q = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
    for (let a = 0; a < 3; a++) for (let sg = -1; sg <= 1; sg += 2) {
      const u = (a + 1) % 3, w = (a + 2) % 3, fs = a === 0 ? sh[sg > 0 ? 0 : 1] : a === 1 ? sh[sg > 0 ? 2 : 3] : sh[sg > 0 ? 4 : 5];
      for (const [qu, qw] of Q) { const v = [0, 0, 0]; v[a] = sg * .5; v[u] = qu * .5; v[w] = qw * .5; d.push(v[0], v[1], v[2], fs); }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, cuboB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(d), gl.STATIC_DRAW); }
  const T4 = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
  const S4 = (x, y, z) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
  const RY = (a) => { const c = Math.cos(a), s2 = Math.sin(a); return [c, 0, -s2, 0, 0, 1, 0, 0, s2, 0, c, 0, 0, 0, 0, 1]; };
  const RX = (a) => { const c = Math.cos(a), s2 = Math.sin(a); return [1, 0, 0, 0, 0, c, s2, 0, 0, -s2, c, 0, 0, 0, 0, 1]; };
  const hsl = (h, sa, l) => { const k = (n) => (n + h / 30) % 12, a = sa * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return [f(0), f(8), f(4)]; };
  const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const oscuro = (c, k) => c.map((v) => v * k);
  const PIELES = ["#f1c9a5", "#e0ac84", "#c68642", "#9a6a45", "#7a4a2b"].map(hex), PELOS = ["#2b1b12", "#4a2f1b", "#8a5a2b", "#d6b25e", "#b8b8b8", "#7a2f1b"].map(hex);
  function aspecto(n) {
    const h = hashTxt((n.id || "") + (n.nombre || ""));
    const piel = PIELES[h % 5], pelo = PELOS[(h >>> 3) % 6], ropa = hsl((h >>> 6) % 360, .5, .42), estilo = (h >>> 14) % 3;
    return { piel, pelo, ropa, manga: oscuro(ropa, .8), pant: hex("#3b3f55"), cinto: hex("#5a3b1e"), sombrero: oscuro(ropa, .7), estilo, k: .96 + ((h >>> 17) % 12) / 100, semilla: (h % 628) / 100 };
  }
  // la apariencia del jugador: viene de su avatar (colores y accesorio) y se arma con las mismas piezas
  function aspectoDesde(c) {
    const ropa = hex(c.ropa || "#3b6fb6");
    return { piel: hex(c.piel || "#e0ac84"), pelo: hex(c.pelo || "#4a2f1b"), ropa, manga: oscuro(ropa, .8), pant: hex(c.pant || "#3b3f55"), cinto: hex("#5a3b1e"), sombrero: oscuro(ropa, .7),
      estilo: 0, largo: !!c.largo, acc: c.acc || null, accCol: hex(c.accCol || "#c9a227"), capa: c.capa ? hex(c.capa) : null, k: 1, semilla: 0.5 };
  }
  const aspectoJugadorDefecto = () => { const h = hashTxt("jug" + (ctx.yo || 0)); return { piel: ["#f1c9a5", "#e0ac84", "#c68642", "#9a6a45"][h % 4], pelo: ["#2b1b12", "#4a2f1b", "#8a5a2b", "#d6b25e"][(h >>> 3) % 4], ropa: "#" + hsl((h >>> 6) % 360, .5, .42).map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join(""), pant: "#3b3f55" }; };
  // cada pieza: [ancho, alto, fondo, desplazamiento x, y, z, color]
  const cuerpo = (a) => ({
    capa: a.capa ? [[.5, .85, .05, 0, -.42, -.03, a.capa]] : null,
    piernaI: [[.25, .72, .27, 0, -.36, 0, a.pant]], piernaD: [[.25, .72, .27, 0, -.36, 0, a.pant]],
    torso: [[.56, .72, .32, 0, 1.08, 0, a.ropa], [.58, .08, .34, 0, .8, 0, a.cinto]],
    brazoI: [[.2, .4, .24, 0, -.2, 0, a.manga], [.18, .26, .22, 0, -.53, 0, a.piel]], brazoD: [[.2, .4, .24, 0, -.2, 0, a.manga], [.18, .26, .22, 0, -.53, 0, a.piel]],
    cabeza: [[.5, .5, .5, 0, .25, 0, a.piel], [.1, .14, .1, 0, .2, .3, oscuro(a.piel, .85)], [.08, .08, .03, -.12, .3, .26, [.1, .1, .12]], [.08, .08, .03, .12, .3, .26, [.1, .1, .12]], [.16, .03, .02, 0, .1, .255, [.45, .2, .2]],
      ...(a.largo ? [[.54, .72, .1, 0, .1, -.27, a.pelo], [.06, .4, .3, -.28, .2, -.08, a.pelo], [.06, .4, .3, .28, .2, -.08, a.pelo]] : [[.54, .4, .08, 0, .3, -.27, a.pelo]]),
      ...(a.acc === "casco" ? [[.6, .26, .6, 0, .5, 0, a.accCol], [.08, .22, .04, 0, .3, .27, a.accCol]]
        : a.acc === "capucha" ? [[.62, .12, .62, 0, .57, 0, a.sombrero], [.62, .56, .1, 0, .27, -.29, a.sombrero], [.08, .5, .5, -.29, .25, -.02, a.sombrero], [.08, .5, .5, .29, .25, -.02, a.sombrero]]
        : a.acc === "corona" ? [[.54, .14, .54, 0, .55, 0, a.pelo], [.5, .08, .5, 0, .62, 0, a.accCol], [.08, .14, .08, -.18, .72, 0, a.accCol], [.08, .16, .08, 0, .73, 0, a.accCol], [.08, .14, .08, .18, .72, 0, a.accCol]]
        : a.acc === "gafas" ? [[.54, .14, .54, 0, .55, 0, a.pelo], [.17, .13, .03, -.12, .3, .27, [.08, .08, .1]], [.17, .13, .03, .12, .3, .27, [.08, .08, .1]], [.08, .03, .03, 0, .31, .27, [.08, .08, .1]]]
        : a.estilo === 1 ? [[.88, .06, .88, 0, .52, 0, a.sombrero], [.42, .2, .42, 0, .65, 0, a.sombrero]] : [[.54, .14, .54, 0, .55, 0, a.pelo]]),
      ...(a.estilo === 2 ? [[.4, .22, .08, 0, .08, .27, a.pelo]] : [])],
  });
  const jugV = { n: { x: 0, y: 0, z: 0, hecha: true, tipo: "jugador" }, ap: null, partes: null, h: 0, fase: 0, amp: 0, cab: 0, nodFijo: 0, mover: false, habla: false, dist: 99 };
  const ponerAvatar = (c) => { jugV.ap = aspectoDesde(c || aspectoJugadorDefecto()); jugV.partes = cuerpo(jugV.ap); };
  ponerAvatar(ctx.avatar);
  // ----- otros jugadores conectados (compañeros): llegan del servidor cada par de segundos y se mueven suavizados -----
  let cercaOtro = null;
  const otros = new Map(), esColor = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);
  const avatarSeguro = (a) => { const o = {}; if (a && typeof a === "object") { for (const k of ["piel", "pelo", "ropa", "pant", "accCol", "capa"]) if (esColor(a[k])) o[k] = a[k]; if (["casco", "capucha", "corona", "gafas"].includes(a.acc)) o.acc = a.acc; o.largo = a.largo === true; } return o; };
  function setOtros(lista) {
    const ids = new Set();
    for (const j of (lista || []).slice(0, 60)) {
      if (!j || !Number.isFinite(+j.x) || !Number.isFinite(+j.y) || !Number.isFinite(+j.z)) continue;
      const id = String(j.id); ids.add(id); let o = otros.get(id);
      const llave = JSON.stringify(j.avatar || null);
      if (!o) {
        const el = document.createElement("div"); el.className = "m3d-otro"; el.style.display = "none"; raiz.append(el);
        const bub = document.createElement("div"); bub.className = "m3d-burbuja"; bub.style.display = "none"; raiz.append(bub);
        o = { id, n: { x: +j.x, y: +j.y, z: +j.z, hecha: true, tipo: "jugador" }, tx: +j.x, ty: +j.y, tz: +j.z, th: (+j.yaw || 0) + Math.PI, h: (+j.yaw || 0) + Math.PI, fase: Math.random() * 6, amp: 0, cab: 0, nodFijo: 0, mover: false, habla: false, dist: 99, el, bub, llave: null };
        otros.set(id, o);
      }
      if (o.llave !== llave) { o.llave = llave; o.ap = aspectoDesde({ piel: "#e0ac84", pelo: "#4a2f1b", ropa: "#3b6fb6", pant: "#3b3f55", ...avatarSeguro(j.avatar) }); o.partes = cuerpo(o.ap); }
      o.tx = +j.x; o.ty = +j.y; o.tz = +j.z; o.th = (+j.yaw || 0) + Math.PI;
      o.frase = FRASES_CHAT[j.frase] || ""; if (o.bub.textContent !== o.frase) o.bub.textContent = o.frase;
      const txt = String(j.nombre || "Compañero").slice(0, 40); if (o.el.textContent !== txt) o.el.textContent = "👤 " + txt;
    }
    for (const [id, o] of otros) if (!ids.has(id)) { o.el.remove(); o.bub.remove(); otros.delete(id); }
  }
  function moverOtros(dt) {
    for (const o of otros.values()) {
      const dx = o.tx - o.n.x, dz = o.tz - o.n.z, d = Math.hypot(dx, dz);
      if (d > 12) { o.n.x = o.tx; o.n.z = o.tz; o.n.y = o.ty; }
      else { const k = Math.min(1, 6 * dt); o.n.x += dx * k; o.n.z += dz * k; o.n.y += (o.ty - o.n.y) * k; }
      o.h += angDif(o.th, o.h) * Math.min(1, 10 * dt);
      const mover = d > .08; o.mover = mover; o.amp += ((mover ? 1 : 0) - o.amp) * Math.min(1, 8 * dt); if (mover) o.fase += dt * 9;
      o.dist = Math.hypot(o.n.x - jug.x, o.n.z - jug.z);
    }
    let cer = null, md = 8; for (const o of otros.values()) if (o.dist < md) { md = o.dist; cer = o; } // ¿hay alguien cerca para saludar?
    const nom = cer ? cer.el.textContent.replace("👤 ", "") : null; if (nom !== cercaOtro) { cercaOtro = nom; try { ctx.alCerca && ctx.alCerca(nom); } catch (_) {} }
  }
  let vis = [], hablandoCon = null;
  function limpiarNpcs() { vis.forEach((v) => v.el.remove()); vis = []; }
  function montarNpcs(lista) {
    const previos = new Map(vis.map((v) => [v.n.id, v])); vis.forEach((v) => v.el.remove()); vis = [];
    npcs = posNpc(lista || []);
    for (const n of npcs) {
      const viejo = previos.get(n.id), llave = JSON.stringify(n.look || null);
      const el = document.createElement("div");
      el.className = "m3d-npc" + (n.hecha ? " ok" : ""); el.textContent = (n.hecha ? "✅ " : (n.marca || "❗ ")) + n.nombre; el.style.display = "none"; raiz.append(el);
      if (viejo && viejo.llave === llave) { // el mismo personaje: conserva su lugar, su paso y su rumbo
        Object.assign(viejo.n, { nombre: n.nombre, hecha: n.hecha, marca: n.marca, tipo: n.tipo, emoji: n.emoji, zona: n.zona, misiones: n.misiones, r: n.r });
        if (hablandoCon === viejo.n || hablandoCon === n) hablandoCon = viejo.n;
        viejo.el = el; vis.push(viejo); continue;
      }
      const ap = n.look ? aspectoDesde(n.look) : aspecto(n);
      vis.push({ n, ap, el, llave, partes: cuerpo(ap), h: Math.atan2(CENTRO - n.x, CENTRO - n.z), x0: n.x, z0: n.z, obj: null, espera: 1 + Math.random() * 3, fase: ap.semilla, amp: 0, cab: 0, nod: 0 });
    }
    npcs = vis.map((v) => v.n);
  }
  const angDif = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  // dónde pisaría un personaje en (x, z): busca el suelo cerca de la altura de referencia y exige 2 bloques libres arriba
  function sueloPara(x, z, yRef) {
    const xi = Math.floor(x), zi = Math.floor(z);
    for (let y = Math.round(yRef) + 1; y >= Math.round(yRef) - 2; y--) if (solido(xi, y - 1, zi) && !solido(xi, y, zi) && !solido(xi, y + 1, zi) && get(xi, y - 1, zi) !== AGUA && get(xi, y, zi) !== LAVA) return y;
    return null;
  }
  function moverNpcs(dt, t) {
    for (const v of vis) {
      const n = v.n, dx = jug.x - n.x, dz = jug.z - n.z, dist = Math.hypot(dx, dz), habla = hablandoCon === n, cerca = dist < 4.2;
      let objH = null, mover = false;
      if (habla || cerca) objH = Math.atan2(dx, dz);
      else if (v.obj) {
        const ox = v.obj[0] - n.x, oz = v.obj[1] - n.z, d = Math.hypot(ox, oz);
        if (d < .15) { v.obj = null; v.espera = 1.5 + Math.random() * 3.5; }
        else {
          objH = Math.atan2(ox, oz);
          if (Math.abs(angDif(objH, v.h)) < .5) {
            const paso = Math.min(d, .85 * dt), nx = n.x + ox / d * paso, nz = n.z + oz / d * paso, sy = sueloPara(nx, nz, n.y);
            if (sy != null && Math.abs(sy - n.y) <= 1.01) { n.x = nx; n.z = nz; n.y += (sy - n.y) * Math.min(1, 10 * dt); mover = true; } else { v.obj = null; v.espera = 1; }
          }
        }
      } else {
        v.espera -= dt;
        if (v.espera <= 0) {
          v.espera = .6; const a = Math.random() * Math.PI * 2, r = (.4 + Math.random() * .6) * (n.r || 1.5), px = v.x0 + Math.cos(a) * r, pz = v.z0 + Math.sin(a) * r;
          if (sueloPara(px, pz, n.y) != null) v.obj = [px, pz];
        }
      }
      if (objH != null) v.h += Math.max(-4 * dt, Math.min(4 * dt, angDif(objH, v.h)));
      const mirada = dist < 10 ? Math.max(-1, Math.min(1, angDif(Math.atan2(dx, dz), v.h))) : 0;
      v.cab += (mirada - v.cab) * Math.min(1, 6 * dt);
      v.amp += ((mover ? 1 : 0) - v.amp) * Math.min(1, 8 * dt); if (mover) v.fase += dt * 8;
      v.mover = mover; v.habla = habla; v.dist = dist;
    }
  }
  function dibujarAldeano(v, t) {
    const n = v.n, a = v.ap, sw = Math.sin(v.fase) * .7 * v.amp, sue = Math.sin(t * 1.3 + a.semilla) * .04;
    let bI = -sw * .8 + sue, bD = sw * .8 - sue, nod = v.nodFijo || 0;
    if (v.habla) { bD = -.7 + Math.sin(t * 4 + a.semilla) * .4; bI = -.25 + Math.sin(t * 3.1) * .2; nod = Math.sin(t * 5) * .1; }
    else if (!v.mover && !n.hecha && n.tipo !== "posada" && v.dist < 9) bD = -2.7 + Math.sin(t * 7) * .4; // saluda con la mano
    const resp = 1 + Math.sin(t * 1.8 + a.semilla) * .012;
    const base = mul(M, mul(mul(T4(n.x, n.y, n.z), RY(v.h)), S4(a.k, a.k * resp, a.k)));
    const grupo = (g, boxes) => { for (const [w, h, d, ox, oy, oz, col] of boxes) { gl.uniformMatrix4fv(locC.m, false, new Float32Array(mul(g, mul(T4(ox, oy, oz), S4(w, h, d))))); gl.uniform3f(locC.c, col[0], col[1], col[2]); gl.drawArrays(gl.TRIANGLES, 0, 36); } };
    const P = v.partes;
    grupo(mul(base, mul(T4(-.14, .72, 0), RX(sw))), P.piernaI); grupo(mul(base, mul(T4(.14, .72, 0), RX(-sw))), P.piernaD);
    grupo(base, P.torso);
    grupo(mul(base, mul(T4(-.4, 1.38, 0), RX(bI))), P.brazoI); grupo(mul(base, mul(T4(.4, 1.38, 0), RX(bD))), P.brazoD);
    if (P.capa) grupo(mul(base, mul(T4(0, 1.4, -.17), RX(.12 + Math.abs(sw) * .5))), P.capa);
    grupo(mul(base, mul(T4(0, 1.44, 0), mul(RY(v.cab), RX(nod)))), P.cabeza);
  }
  montarNpcs(ctx.npcs);

  // ----- cámara -----
  const perspectiva = (fov, asp, n, f) => { const t = 1 / Math.tan(fov / 2); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]; };
  const mul = (a, b) => { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
  const jug = { x: CENTRO + .5, y: 13.1, z: CENTRO + 6.5, vx: 0, vy: 0, vz: 0, suelo: false, yaw: 0, pitch: 0 };
  const ojo = () => jug.y + 1.6;
  // cámara: 0 = primera persona, 1 = tercera (detrás del personaje), 2 = de frente (para ver cómo se ve tu avatar)
  const cam = { modo: ctx.camara || 0, dist: 4.5, fov: 1.2, sens: 1 };
  function camaraActual() {
    if (cam.modo === 0) return { ex: jug.x, ey: ojo(), ez: jug.z, yaw: jug.yaw, pitch: jug.pitch };
    const f = adelante(), dir = cam.modo === 1 ? -1 : 1, ey0 = ojo(); let t = .3;
    while (t < cam.dist) { const px = jug.x + f[0] * dir * (t + .25), py = ey0 + f[1] * dir * (t + .25), pz = jug.z + f[2] * dir * (t + .25); if (solido(Math.floor(px), Math.floor(py), Math.floor(pz))) break; t += .2; }
    const d = Math.max(.5, Math.min(cam.dist, t - .1));
    const ex = jug.x + f[0] * dir * d, ey = ey0 + f[1] * dir * d, ez = jug.z + f[2] * dir * d;
    return cam.modo === 1 ? { ex, ey, ez, yaw: jug.yaw, pitch: jug.pitch } : { ex, ey, ez, yaw: jug.yaw + Math.PI, pitch: -jug.pitch };
  }
  function vista(c) {
    const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const ex = c.ex, ey = c.ey, ez = c.ez, rx = cy, rz = -sy, ux = -sp * sy, uy = cp, uz = -sp * cy, bx = sy * cp, by = sp, bz = cy * cp;
    return [rx, ux, bx, 0, 0, uy, by, 0, rz, uz, bz, 0, -(rx * ex + rz * ez), -(ux * ex + uy * ey + uz * ez), -(bx * ex + by * ey + bz * ez), 1];
  }
  const adelante = () => { const cy = Math.cos(jug.yaw), sy = Math.sin(jug.yaw), cp = Math.cos(jug.pitch), sp = Math.sin(jug.pitch); return [-sy * cp, -sp, -cy * cp]; };

  // ----- física -----
  const RAD = .3, ALTO = 1.75;
  const choca = (x, y, z) => { for (let yy = Math.floor(y); yy <= Math.floor(y + ALTO - .001); yy++) for (let zz = Math.floor(z - RAD); zz <= Math.floor(z + RAD); zz++) for (let xx = Math.floor(x - RAD); xx <= Math.floor(x + RAD); xx++) if (solido(xx, yy, zz)) return true; return false; };
  const tec = {}; const joy = { x: 0, y: 0 }; const control = { giro: !!ctx.giroPalanca };
  let enAgua = false, enLava = false;
  function actualizar(dt) {
    if (ctx.vuelo) { // modo observador (docente): vuela sin chocar; W A S D siguen la mirada, espacio sube, mayúscula baja, Ctrl acelera
      const f = adelante(), cy = Math.cos(jug.yaw), sy = Math.sin(jug.yaw), v = tec.control ? 45 : 16;
      let ax = (tec.d ? 1 : 0) - (tec.a ? 1 : 0) + joy.x, af = (tec.w ? 1 : 0) - (tec.s ? 1 : 0) - joy.y;
      const l = Math.hypot(ax, af); if (l > 1) { ax /= l; af /= l; }
      jug.x += (f[0] * af + cy * ax) * v * dt; jug.z += (f[2] * af - sy * ax) * v * dt; jug.y += (f[1] * af + (tec[" "] ? 1 : 0) - (tec.shift ? 1 : 0)) * v * dt;
      jug.vx = jug.vy = jug.vz = 0; jug.suelo = false; enAgua = false;
      jug.x = Math.max(.5, Math.min(SX - .5, jug.x)); jug.z = Math.max(.5, Math.min(SZ - .5, jug.z)); jug.y = Math.max(1, Math.min(SY + 40, jug.y));
      return;
    }
    let jx = joy.x; if (control.giro && Math.abs(joy.x) > .18) { jug.yaw -= joy.x * 2.3 * dt; jx = 0; } else if (control.giro) jx = 0; // «una mano»: la palanca también gira
    let ax = (tec.d ? 1 : 0) - (tec.a ? 1 : 0) + jx, az = (tec.s ? 1 : 0) - (tec.w ? 1 : 0) + joy.y;
    const l = Math.hypot(ax, az); if (l > 1) { ax /= l; az /= l; }
    { const bj = get(Math.floor(jug.x), Math.floor(jug.y + .9), Math.floor(jug.z)); enLava = bj === LAVA || get(Math.floor(jug.x), Math.floor(jug.y + .1), Math.floor(jug.z)) === LAVA; enAgua = bj === AGUA || enLava; }
    const cy = Math.cos(jug.yaw), sy = Math.sin(jug.yaw), v = enAgua ? 2.4 : ((tec.shift || tec.control || joy.corre) ? 6.4 : 4.3);
    jug.vx = (ax * cy + az * sy) * v; jug.vz = (-ax * sy + az * cy) * v;
    if (enAgua) { jug.vy = Math.max(jug.vy - 8 * dt, -2.5); if (tec[" "]) jug.vy = 3.2; }
    else { if (tec[" "] && jug.suelo) { jug.vy = 8.6; jug.suelo = false; sonido.salto(); } jug.vy = Math.max(jug.vy - 26 * dt, -30); }
    let nx = jug.x + jug.vx * dt; if (!choca(nx, jug.y, jug.z)) jug.x = nx;
    let nz = jug.z + jug.vz * dt; if (!choca(jug.x, jug.y, nz)) jug.z = nz;
    let ny = jug.y + jug.vy * dt; jug.suelo = false;
    if (!choca(jug.x, ny, jug.z)) jug.y = ny; else { if (jug.vy < 0) { jug.y = Math.floor(ny) + 1.001; jug.suelo = true; } jug.vy = 0; }
    jug.x = Math.max(.5, Math.min(SX - .5, jug.x)); jug.z = Math.max(.5, Math.min(SZ - .5, jug.z));
    if (jug.y < -10) { jug.x = CENTRO + .5; jug.z = CENTRO + 6.5; jug.y = 14; jug.vy = 0; }
  }

  // ----- apuntar (recorrido por la cuadrícula) -----
  function apuntar() {
    const d = adelante(), x = jug.x, y = ojo(), z = jug.z;
    let ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const sx = Math.sign(d[0]), sy = Math.sign(d[1]), sz = Math.sign(d[2]);
    const tdx = d[0] ? Math.abs(1 / d[0]) : 1e9, tdy = d[1] ? Math.abs(1 / d[1]) : 1e9, tdz = d[2] ? Math.abs(1 / d[2]) : 1e9;
    let tx = d[0] ? (sx > 0 ? ix + 1 - x : x - ix) * tdx : 1e9, ty = d[1] ? (sy > 0 ? iy + 1 - y : y - iy) * tdy : 1e9, tz = d[2] ? (sz > 0 ? iz + 1 - z : z - iz) * tdz : 1e9;
    let px = ix, py = iy, pz = iz, t = 0;
    while (t <= (ctx.vuelo ? 60 : 5.5)) {
      const b = get(ix, iy, iz);
      if (b !== AIRE && b !== AGUA && b !== PORTAL && b !== LAVA && b !== VELO && iy >= 0 && iy < SY) return { x: ix, y: iy, z: iz, px, py, pz, b };
      px = ix; py = iy; pz = iz;
      if (tx < ty && tx < tz) { ix += sx; t = tx; tx += tdx; } else if (ty < tz) { iy += sy; t = ty; ty += tdy; } else { iz += sz; t = tz; tz += tdz; }
    }
    return null;
  }

  // ----- acciones -----
  let sel = 1, picar = false, picando = null, ocupado = false, pausado = false, cercano = null;
  // ----- herramientas: la mejor que tengas en el inventario acelera el picado (pico: piedra y minerales, hacha: madera, pala: tierra y arena) -----
  const CLASE = { 112: 0, 113: 0, 115: 0, 116: 0, 117: 0, 26: 2, 27: 2, 28: 2, 29: 0, 30: 1, 31: 2, 32: 0, 33: 0, 34: 0, 35: 0, 36: 0, 24: 0, 25: 0, 3: 0, 7: 0, 10: 0, 16: 0, 17: 0, 18: 0, 4: 1, 6: 1, 5: 1, 15: 1, 1: 2, 2: 2, 9: 2 };
  const MULT = [2.2, 3.6, 5.5, 8];
  function herramientaPara(b) {
    const k = CLASE[b]; if (k === undefined) return { mult: 1, id: 0, k: -1 };
    for (let t = 3; t >= 0; t--) { const id = 50 + k * 4 + t; if (ctx.cantidad(id) > 0) return { mult: MULT[t], id, k }; }
    return { mult: 1, id: 0, k };
  }
  // ----- efectos: partículas al picar, lo que cae del bloque y avisos de lo recogido -----
  // ----- parcelas personales (cada estudiante tiene un lote de 16 × 16 donde solo él construye) y mesas de fabricación -----
  const TAM_PARCELA = 16;
  let parcelas = [], mesaCer = null;
  const mesas = [{ x: CENTRO + 5.5, z: CENTRO + 9.5, y: 0, fija: true }];
  const mesaBase = mesas[0]; mesaBase.y = 12;
  const plotDe = (x, z) => { for (const p of parcelas) if (x >= p.x && x < p.x + TAM_PARCELA && z >= p.z && z < p.z + TAM_PARCELA) return p; return null; };
  const topeSolido = (x, z) => { for (let y = SY - 2; y >= 0; y--) { const b = get(x, y, z); if (b !== AIRE && b !== AGUA && b !== 5 && b !== 8 && b !== PORTAL) return y + 1; } return 1; };
  function setParcelas(lista) {
    parcelas.forEach((p) => p.el.remove()); parcelas = []; mesas.length = 1;
    for (const q of (lista || []).slice(0, 80)) {
      if (!Number.isFinite(+q.x) || !Number.isFinite(+q.z)) continue;
      const el = document.createElement("div"); el.className = "m3d-parcela" + (q.mia ? " mia" : ""); el.textContent = (q.mia ? "🏠 Mi parcela" : "🏠 " + String(q.nombre || "Compañero").slice(0, 30)); el.style.display = "none"; raiz.append(el);
      const p = { x: +q.x | 0, z: +q.z | 0, mia: !!q.mia, nombre: String(q.nombre || ""), el, postes: [], t: 0 };
      for (let i = 0; i <= TAM_PARCELA; i += 4) for (const [dx, dz] of [[i, 0], [i, TAM_PARCELA], [0, i], [TAM_PARCELA, i]]) { if ((dx === 0 || dx === TAM_PARCELA) && (dz === 0 || dz === TAM_PARCELA) && !(i === 0 || i === TAM_PARCELA)) continue; p.postes.push({ x: p.x + dx, z: p.z + dz, y: 0, esq: (dx === 0 || dx === TAM_PARCELA) && (dz === 0 || dz === TAM_PARCELA) }); }
      p.postes = p.postes.filter((a, i, r) => r.findIndex((b) => b.x === a.x && b.z === a.z) === i);
      parcelas.push(p);
      if (p.mia) mesas.push({ x: p.x + 2.5, z: p.z + 2.5, y: 0 });
    }
  }
  function ajustarAlturas(dt) { // la altura de los postes y las mesas se recalcula de vez en cuando (el terreno cambia)
    ajustarAlturas.t = (ajustarAlturas.t || 0) - dt; if (ajustarAlturas.t > 0) return; ajustarAlturas.t = 1.5;
    for (const p of parcelas) { if (Math.hypot(p.x + 8 - jug.x, p.z + 8 - jug.z) > 70) continue; for (const q of p.postes) q.y = topeSolido(Math.min(SX - 1, q.x), Math.min(SZ - 1, q.z)); }
    for (const m of mesas) m.y = topeSolido(Math.floor(m.x), Math.floor(m.z));
  }
  function irAMiParcela() {
    const p = parcelas.find((q) => q.mia); if (!p) return false;
    const cx = p.x + 8, cz = p.z + 8; jug.x = cx + .5; jug.z = cz + .5; jug.y = topeSolido(cx, cz) + .1; jug.vx = jug.vy = jug.vz = 0; jug.yaw = 0; return true;
  }
  let verIdx = -1;
  function verParcelaAjena() { // salta junto a la parcela del siguiente compañero para mirar su construcción
    const lista = parcelas.filter((q) => !q.mia); if (!lista.length) return null;
    verIdx = (verIdx + 1) % lista.length; const p = lista[verIdx], x = Math.max(2, p.x - 3), z = p.z + 8;
    jug.x = x + .5; jug.z = z + .5; jug.y = topeSolido(x, z) + .1; jug.vx = jug.vy = jug.vz = 0; jug.yaw = -Math.PI / 2; jug.pitch = .15; return p.nombre || "Compañero";
  }
  function dibujarParcelas(cielo, tt) {
    if (!parcelas.length && !mesas.length) return;
    prepararPC(cielo, false);
    const cj = (g, w, h, d, ox, oy, oz, c) => { gl.uniformMatrix4fv(locC.m, false, new Float32Array(mul(g, mul(T4(ox, oy, oz), S4(w, h, d))))); pcol(c); gl.drawArrays(gl.TRIANGLES, 0, 36); };
    for (const p of parcelas) {
      if (Math.hypot(p.x + 8 - jug.x, p.z + 8 - jug.z) > 75) continue;
      const col = p.mia ? [1, .78, .2] : [.55, .62, .78], tapa = p.mia ? [1, .95, .6] : [.8, .85, .95];
      for (const q of p.postes) { const h = q.esq ? 2.6 : 1.3; cj(M, .24, h, .24, q.x, q.y + h / 2, q.z, col); if (q.esq) cj(M, .34, .22, .34, q.x, q.y + h + .1, q.z, tapa); }
    }
    for (const m of mesas) {
      if (Math.hypot(m.x - jug.x, m.z - jug.z) > 60) continue;
      const g = mul(M, T4(m.x, m.y, m.z));
      for (const [lx, lz] of [[-.4, -.4], [.4, -.4], [-.4, .4], [.4, .4]]) cj(g, .14, .8, .14, lx, .4, lz, [.36, .24, .12]);
      cj(g, 1.1, .16, 1.1, 0, .88, 0, [.62, .43, .22]); cj(g, .9, .04, .9, 0, .97, 0, [.82, .62, .36]);
      cj(g, .2, .02, .5, -.2, 1.0, 0, [.55, .55, .6]); cj(g, .22, .1, .22, .25, 1.03, .1, [.7, .2, .2]);
    }
    cerrarPC();
  }
  const particulas = [], caidos = [];
  const rr = (a, b) => a + Math.random() * (b - a);
  function soltarParticulas(x, y, z, b, n, fuerza) {
    const c = colorItem(b); if (particulas.length > 160) particulas.splice(0, n);
    for (let i = 0; i < n; i++) { const k = .75 + Math.random() * .4; particulas.push({ x: x + rr(-.35, .35), y: y + rr(-.35, .35), z: z + rr(-.35, .35), vx: rr(-1, 1) * fuerza, vy: rr(.5, 1.8) * fuerza, vz: rr(-1, 1) * fuerza, vida: rr(.5, .9), tam: rr(.06, .13), c: [c[0] * k, c[1] * k, c[2] * k] }); }
  }
  function soltarItem(x, y, z, item) { if (caidos.length > 40) caidos.shift(); caidos.push({ x: x + .5, y: y + .4, z: z + .5, vx: rr(-1.2, 1.2), vy: 3.4, vz: rr(-1.2, 1.2), t: 0, item, c: colorItem(item), ph: Math.random() * 6 }); }
  const botin = document.createElement("div"); botin.className = "m3d-botin"; raiz.append(botin);
  let ultBotin = null;
  function avisoBotin(item, n) {
    const nombre = NOMBRES[item] || "Objeto", ahora = performance.now();
    if (ultBotin && ultBotin.item === item && ahora - ultBotin.t < 1800 && ultBotin.el.parentNode) { ultBotin.n += n; ultBotin.t = ahora; ultBotin.el.textContent = "+" + ultBotin.n + " " + nombre; ultBotin.el.style.animation = "none"; void ultBotin.el.offsetWidth; ultBotin.el.style.animation = ""; return; }
    const el = document.createElement("div"); el.textContent = "+" + n + " " + nombre; botin.append(el); while (botin.childNodes.length > 4) botin.firstChild.remove(); setTimeout(() => el.remove(), 2200);
    ultBotin = { item, n, t: ahora, el };
  }
  function moverEfectos(dt) {
    for (let i = particulas.length - 1; i >= 0; i--) { const p = particulas[i]; p.vida -= dt; p.vy -= 16 * dt; const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
      if (solido(Math.floor(nx), Math.floor(ny), Math.floor(nz))) { p.vx *= -.3; p.vz *= -.3; p.vy *= -.3; } else { p.x = nx; p.y = ny; p.z = nz; }
      if (p.vida <= 0) particulas.splice(i, 1); }
    for (let i = caidos.length - 1; i >= 0; i--) { const d = caidos[i]; d.t += dt;
      if (d.t < .45) { d.vy -= 18 * dt; const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt, nz = d.z + d.vz * dt; if (!solido(Math.floor(nx), Math.floor(ny - .15), Math.floor(nz))) { d.x = nx; d.y = ny; d.z = nz; } else { d.vy = 0; d.vx *= .5; d.vz *= .5; } }
      else { const tx = jug.x, ty = jug.y + .8, tz = jug.z, dx = tx - d.x, dy = ty - d.y, dz = tz - d.z, dist = Math.hypot(dx, dy, dz), v = Math.min(dist, (6 + d.t * 4) * dt);
        if (dist < .55 || d.t > 6) { caidos.splice(i, 1); sonido.recoger(); avisoBotin(d.item, 1); continue; } d.x += dx / dist * v; d.y += dy / dist * v; d.z += dz / dist * v; } }
  }
  const pcol = (c) => gl.uniform3f(locC.c, c[0], c[1], c[2]);
  function dibujarEfectos(cielo, tt) {
    if (!particulas.length && !caidos.length && !picando) return;
    prepararPC(cielo, false);
    const cj = (g, w, h, d, ox, oy, oz, c) => { gl.uniformMatrix4fv(locC.m, false, new Float32Array(mul(g, mul(T4(ox, oy, oz), S4(w, h, d))))); pcol(c); gl.drawArrays(gl.TRIANGLES, 0, 36); };
    for (const p of particulas) cj(M, p.tam, p.tam, p.tam, p.x, p.y, p.z, p.c);
    for (const d of caidos) { const g = mul(M, mul(T4(d.x, d.y + Math.sin(tt * 4 + d.ph) * .05, d.z), RY(tt * 2.2 + d.ph))); cj(g, .24, .24, .24, 0, 0, 0, d.c); cj(g, .16, .16, .16, 0, 0, 0, [Math.min(1, d.c[0] * 1.25), Math.min(1, d.c[1] * 1.25), Math.min(1, d.c[2] * 1.25)]); }
    if (picando && picando.dur) { // grietas que crecen sobre el bloque
      const pr = Math.min(1, picando.t / picando.dur), n = 1 + Math.floor(pr * 11); let sd = (Math.imul(picando.x * 73856093 ^ picando.y * 19349663 ^ picando.z * 83492791, 2654435761) >>> 0) || 1; const q = () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return sd / 4294967296; };
      const g = mul(M, T4(picando.x + .5, picando.y + .5, picando.z + .5));
      for (let i = 0; i < n; i++) { const cara = (q() * 6) | 0, sg = cara % 2 ? -1 : 1, u = (q() - .5) * .8, v = (q() - .5) * .8, a = .08 + q() * .22, b2 = .02 + q() * .02, o = .506 * sg, co = [.13, .12, .12];
        if (cara < 2) cj(g, .012, b2 + a * (i % 2), a * ((i + 1) % 2) + .03, o, u, v, co); else if (cara < 4) cj(g, a * ((i + 1) % 2) + .03, .012, b2 + a * (i % 2), u, o, v, co); else cj(g, b2 + a * (i % 2), a * ((i + 1) % 2) + .03, .012, u, v, o, co); }
    }
    cerrarPC();
  }
  function limpiarEntrada() { for (const k in tec) tec[k] = false; picar = false; joy.x = joy.y = 0; }
  let animalCer = null, avisoPico = false;
  // lo que se puede llevar en la mano (bloques que tienes, o los básicos; más semillas y azadas)
  const listaMano = (extra) => [...COLOCABLES.filter((b) => ctx.cantidad(b) > 0 || b <= 9 || b === extra), ...USABLES.filter((b) => ctx.cantidad(b) > 0 || b === extra)];
  const ACCION_ANIMAL = { oveja: "E · Esquilar a la ", gallina: "E · Recoger huevo de la ", vaca: "E · Ordeñar a la ", cerdo: "E · Buscar papas con el ", conejo: "E · Pedir una zanahoria al " };
  function hablar() {
    if (pausado) return;
    if (!cercano && !animalCer && mesaCer) { try { ctx.alMesa && ctx.alMesa(); } catch (_) {} return; }
    if (!cercano) { // sin personaje cerca: si hay un animal delante, se le saluda
      if (animalCer) { const a = animalCer; sonido.animal(a.tipo); a.pasta = 0; a.espera = 2; a.susto = 0; aviso(FRASES[a.tipo] || "🐾");
        if (ctx.recolectar && !ctx.soloMirar && ["oveja", "gallina", "vaca", "cerdo", "conejo"].includes(a.tipo)) {
          Promise.resolve(ctx.recolectar(a.tipo)).then((r) => { if (r && r.item) { sonido.recoger(); avisoBotin(r.item, r.n || 1); } }).catch((e) => { const m = String((e && e.message) || e || ""), t = /todavia_no:(\d+)/.exec(m); aviso(t ? "Todavía no tiene más. Vuelve en " + t[1] + " s." : /demasiado_rapido/.test(m) ? "Vas muy rápido." : "No se pudo recoger ahora."); });
        } }
      return;
    }
    pausado = true; hablandoCon = cercano; limpiarEntrada(); if (document.pointerLockElement === cv) document.exitPointerLock();
    try { ctx.alNpc && ctx.alNpc(cercano); } catch (_) {}
  }
  const clave = (x, y, z) => x + "," + y + "," + z;
  const aviso = (t) => { try { ctx.alError && ctx.alError(t); } catch (_) {} };
  function puedeEditar(x, y, z) {
    if (ctx.soloMirar) { aviso("Estás de visita: aquí solo se puede mirar."); return false; }
    if (veda[z * SX + x]) { aviso("Los muros y portones de las zonas están protegidos."); return false; }
    if (enPlazaProtegida(x, z)) { aviso("La plaza está protegida: construye fuera de ella."); return false; }
    const pl = plotDe(x, z); if (pl && !pl.mia) { aviso("🏠 Esta es la parcela de " + (pl.nombre || "otro compañero") + ": puedes mirar su construcción, pero solo él puede cambiarla. Construye en tu parcela o fuera de las parcelas."); return false; }
    if (y < 1 || y >= SY - 1) return false;
    return true;
  }
  function quePicar(dt) {
    if (!picar) { picando = null; return; }
    if (golpearMonstruo()) { picando = null; return; }
    const h = apuntar(); if (!h || h.b === ADOQUIN || h.y <= 0) { picando = null; return; }
    if (h.b >= 100) { picando = null; cosecharAhora(h); return; }
    if (!picando || picando.x !== h.x || picando.y !== h.y || picando.z !== h.z) { const hr = herramientaPara(h.b); picando = { x: h.x, y: h.y, z: h.z, t: 0, b: h.b, dur: (DUREZA[h.b] || 1) / hr.mult, herr: hr.id, p: 0 };
      if (h.b === 10 && hr.k === 0 && !hr.id && !avisoPico) { avisoPico = true; aviso("Con un pico sacas más minerales (y mejores). Fabrica uno en la mochila 🎒."); } }
    picando.t += dt; picando.s = (picando.s || 0) + dt; if (picando.s > .28) { picando.s = 0; sonido.picar(h.b); }
    picando.p += dt; if (picando.p > .09) { picando.p = 0; soltarParticulas(h.x + .5 - adelante()[0] * .5, h.y + .5 - adelante()[1] * .5, h.z + .5 - adelante()[2] * .5, h.b, 1, 1.4); }
    if (picando.t >= picando.dur) {
      const { x, y, z, b } = picando; picando = null;
      if (ocupado) return;
      if (!puedeEditar(x, y, z)) { picar = false; return; }
      const dueno = autores.get(clave(x, y, z));
      if (dueno != null && dueno !== ctx.yo && b > 0 && mundo[idx(x, y, z)] > 0) { aviso("Ese bloque lo puso otro compañero."); picar = false; return; }
      mundo[idx(x, y, z)] = AIRE; marcar(x, z); ocupado = true; sonido.romper(b); soltarParticulas(x + .5, y + .5, z + .5, b, 16, 2.6);
      Promise.resolve(ctx.picar(x, y, z, b)).then((r) => { autores.set(clave(x, y, z), ctx.yo); if (r && r.item) soltarItem(x, y, z, r.item); }).catch((e) => {
        if (!vivo) return; mundo[idx(x, y, z)] = b; marcar(x, z); aviso(mensajeError(e));
      }).finally(() => { ocupado = false; });
    }
  }
  function poner() {
    if (golpearMonstruo()) return;
    const h = apuntar(); if (!h || ocupado) return;
    if (USABLES.includes(sel)) { usarMano(h); return; }
    const { px: x, py: y, pz: z } = h; if (!puedeEditar(x, y, z)) return;
    const c = get(x, y, z); if (c !== AIRE && c !== AGUA && c !== LAVA) return;
    if (!(ctx.cantidad(sel) > 0)) { aviso("No tienes " + NOMBRES[sel].toLowerCase() + ". Pica o fabrica más."); return; }
    if (x + 1 > jug.x - RAD && x < jug.x + RAD && z + 1 > jug.z - RAD && z < jug.z + RAD && y + 1 > jug.y && y < jug.y + ALTO) return;
    const antes = c; mundo[idx(x, y, z)] = sel; marcar(x, z); ocupado = true; sonido.poner(sel);
    Promise.resolve(ctx.poner(x, y, z, sel)).then(() => { autores.set(clave(x, y, z), ctx.yo); }).catch((e) => {
      if (!vivo) return; mundo[idx(x, y, z)] = antes; marcar(x, z); aviso(mensajeError(e));
    }).finally(() => { ocupado = false; });
  }
  // azada: labra pasto o tierra · semillas: se siembran sobre tierra labrada (el servidor decide y cuenta el crecimiento)
  function usarMano(h) {
    if (!(ctx.cantidad(sel) > 0)) { aviso("No tienes " + NOMBRES[sel].toLowerCase() + "."); return; }
    if (sel >= 80) {
      if (h.b !== 1 && h.b !== 2) { aviso("La azada se usa sobre pasto o tierra."); return; }
      if (!puedeEditar(h.x, h.y, h.z) || !ctx.labrar) return;
      const antes = h.b; mundo[idx(h.x, h.y, h.z)] = 37; marcar(h.x, h.z); ocupado = true; sonido.poner(2);
      Promise.resolve(ctx.labrar(h.x, h.y, h.z, antes)).then(() => { autores.set(clave(h.x, h.y, h.z), ctx.yo); }).catch((e) => { if (!vivo) return; mundo[idx(h.x, h.y, h.z)] = antes; marcar(h.x, h.z); aviso(mensajeError(e)); }).finally(() => { ocupado = false; });
      return;
    }
    if (h.b !== 37) { aviso("Siembra sobre tierra labrada: primero usa una azada en el pasto."); return; }
    const ax = h.x, ay = h.y + 1, az = h.z; if (get(ax, ay, az) !== AIRE) { aviso("Ahí no cabe una planta."); return; }
    if (!puedeEditar(ax, ay, az) || !ctx.sembrar) return;
    const tipo = SEMILLAS[sel]; mundo[idx(ax, ay, az)] = 100 + tipo * 4; marcar(ax, az); ocupado = true; sonido.poner(1);
    Promise.resolve(ctx.sembrar(h.x, h.y, h.z, sel)).then(() => { autores.set(clave(ax, ay, az), ctx.yo); aviso("🌱 Sembraste " + NOMBRES_CULTIVO[tipo] + ". Crece con el tiempo."); }).catch((e) => { if (!vivo) return; mundo[idx(ax, ay, az)] = AIRE; marcar(ax, az); aviso(mensajeError(e)); }).finally(() => { ocupado = false; });
  }
  let cosechaCd = 0;
  function cosecharAhora(h) {
    const ahora = performance.now(); if (ahora < cosechaCd || ocupado || ctx.soloMirar || !ctx.cosechar) return; cosechaCd = ahora + 1200;
    ocupado = true;
    Promise.resolve(ctx.cosechar(h.x, h.y, h.z)).then((r) => {
      mundo[idx(h.x, h.y, h.z)] = AIRE; marcar(h.x, h.z); sonido.recoger(); soltarParticulas(h.x + .5, h.y + .5, h.z + .5, 5, 8, 1.6);
      if (r && r.item) avisoBotin(r.item, r.n || 1); if (r && r.semilla) avisoBotin(r.semilla, r.semilla_n || 1);
    }).catch((e) => { const m = String((e && e.message) || e || ""), t = /no_madura:(\d+)/.exec(m); aviso(t ? "🌱 Todavía no está madura. Faltan " + (t[1] >= 60 ? Math.ceil(t[1] / 60) + " min" : t[1] + " s") + "." : /bloque_ajeno/.test(m) ? "Esa planta la sembró otro compañero." : mensajeError(e)); }).finally(() => { ocupado = false; });
  }
  function mensajeError(e) {
    const m = String((e && e.message) || e || "");
    if (/demasiado_rapido/.test(m)) return "Vas muy rápido. Espera un momento.";
    if (/parcela_ajena/.test(m)) return "Esa es la parcela de otro compañero.";
    if (/bloque_ajeno/.test(m)) return "Ese bloque lo puso otro compañero.";
    if (/sin_azada/.test(m)) return "Necesitas una azada: fabrícala con material y palos.";
    if (/sin_tierra_labrada/.test(m)) return "Siembra sobre tierra labrada.";
    if (/semilla_no_valida/.test(m)) return "Eso no se puede sembrar.";
    if (/sin_material/.test(m)) return "No tienes suficiente material.";
    if (/limite_de_bloques/.test(m)) return "Llegaste al máximo de bloques puestos.";
    if (/zona_protegida/.test(m)) return "La plaza está protegida.";
    if (/construccion_cerrada/.test(m)) return "Tu docente cerró la construcción por ahora: puedes explorar.";
    if (/ocupado/.test(m)) return "Ese lugar ya está ocupado.";
    return "No se pudo guardar el cambio. Intenta de nuevo.";
  }

  // ----- entrada -----
  const bloqueado = () => document.pointerLockElement === cv;
  let jugando = false, sinBloqueo = false, arrastraRaton = false;
  const mapaTecla = (k) => (k === "arrowup" ? "w" : k === "arrowdown" ? "s" : k === "arrowleft" ? "a" : k === "arrowright" ? "d" : k);
  const mirar = (dx, dy, k) => { jug.yaw -= dx * k * cam.sens; jug.pitch = Math.max(-1.55, Math.min(1.55, jug.pitch + dy * k * cam.sens)); };
  const seleccionar = (item) => { sel = item; ctx.alSeleccion && ctx.alSeleccion(item); };
  const escuchas = [];
  const on = (obj, ev, fn, op) => { obj.addEventListener(ev, fn, op); escuchas.push([obj, ev, fn, op]); };
  on(window, "keydown", (e) => {
    if (pausado || (!jugando && !bloqueado())) return;
    const k = e.key.toLowerCase(); if (k === "e") { hablar(); return; } if (k === "t") { try { ctx.alChat && ctx.alChat(); } catch (_) {} return; } if (k === "r") { try { ctx.alComer && ctx.alComer(); } catch (_) {} return; } if (k === "i" || k === "b") { try { ctx.alInventario && ctx.alInventario(); } catch (_) {} return; } if (k === "v") { cam.modo = (cam.modo + 1) % 3; try { ctx.alCamara && ctx.alCamara(cam.modo); } catch (_) {} return; } if ([" ", "arrowup", "arrowdown"].includes(k)) e.preventDefault();
    tec[mapaTecla(k)] = true; if (k === "f" && sinBloqueo) picar = true;
    const n = +e.key; if (n >= 1 && n <= 9) { const mios = listaMano(); if (mios[n - 1]) seleccionar(mios[n - 1]); }
  });
  on(window, "keyup", (e) => { const k = e.key.toLowerCase(); tec[mapaTecla(k)] = false; if (k === "f" && sinBloqueo) picar = false; });
  on(window, "blur", () => { for (const k in tec) tec[k] = false; picar = false; });
  on(cv, "contextmenu", (e) => e.preventDefault());
  const toques = {};
  on(cv, "pointerdown", (e) => {
    if (pausado) return;
    if (e.pointerType === "touch") {
      try { cv.setPointerCapture(e.pointerId); } catch (_) { /* sin captura: se sigue igual */ } ayuda.textContent = ""; jugando = true;
      const r = cv.getBoundingClientRect(); const t = toques[e.pointerId] = { izq: (e.clientX - r.left) < r.width * .4, x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY, t0: performance.now(), movio: false, picando: false };
      if (!t.izq) t.reloj = setTimeout(() => { if (toques[e.pointerId] === t && !t.movio && !pausado) { t.picando = true; picar = true; } }, 300); // mantener el dedo = picar; toque corto = poner
      return;
    }
    if (!bloqueado() && !sinBloqueo) { try { cv.requestPointerLock(); } catch (_) { sinBloqueo = true; } jugando = true; ayuda.textContent = ""; }
    if (e.button === 2) { poner(); return; }
    if (e.button === 0) { if (sinBloqueo) arrastraRaton = true; else picar = true; }
  });
  on(document, "pointerlockerror", () => { sinBloqueo = true; ayuda.textContent = "Arrastra para mirar · mantén F para picar · clic derecho para poner"; });
  on(window, "pointerup", (e) => { if (e.pointerType !== "touch") { arrastraRaton = false; if (e.button === 0 && !sinBloqueo) picar = false; } });
  on(window, "mousemove", (e) => { if (bloqueado()) mirar(e.movementX, e.movementY, .0024); else if (arrastraRaton) mirar(e.movementX, e.movementY, .004); });
  on(document, "pointerlockchange", () => { if (!bloqueado()) { picar = false; if (jugando && !sinBloqueo) ayuda.textContent = "Haz clic para seguir jugando"; } });
  on(cv, "wheel", (e) => { e.preventDefault(); const mios = listaMano(sel), i = Math.max(0, mios.indexOf(sel)); seleccionar(mios[(i + (e.deltaY > 0 ? 1 : -1) + mios.length) % mios.length]); }, { passive: false });
  on(cv, "pointermove", (e) => {
    const t = toques[e.pointerId]; if (!t) return;
    if (t.izq) { const dx = e.clientX - t.ox, dy = e.clientY - t.oy, m = Math.min(1, Math.hypot(dx, dy) / 45), a = Math.atan2(dy, dx); joy.corre = Math.hypot(dx, dy) > 80; joy.x = Math.cos(a) * m; joy.y = Math.sin(a) * m; joyEl.firstChild.style.transform = `translate(${joy.x * 30}px,${joy.y * 30}px)`; }
    else { if (!t.picando && Math.hypot(e.clientX - t.ox, e.clientY - t.oy) > 10) t.movio = true; mirar(e.clientX - t.x, e.clientY - t.y, .006); t.x = e.clientX; t.y = e.clientY; }
  });
  const finT = (e) => { const t = toques[e.pointerId]; if (!t) return; if (t.izq) { joy.x = joy.y = 0; joy.corre = false; joyEl.firstChild.style.transform = ""; } else { clearTimeout(t.reloj); if (t.picando) picar = false; else if (!t.movio && e.type === "pointerup" && performance.now() - t.t0 < 300 && !pausado) poner(); } delete toques[e.pointerId]; };
  on(cv, "pointerup", finT); on(cv, "pointercancel", finT);
  acc.querySelectorAll("button").forEach((b) => {
    const k = b.dataset.k;
    on(b, "pointerdown", (e) => { e.preventDefault(); if (k === "hablar") { hablar(); return; } if (pausado) return; jugando = true; ayuda.textContent = ""; if (k === "salto") tec[" "] = true; else if (k === "picar") picar = true; else poner(); });
    const up = () => { if (k === "salto") tec[" "] = false; else if (k === "picar") picar = false; };
    on(b, "pointerup", up); on(b, "pointerleave", up); on(b, "pointercancel", up);
  });

  // ----- tamaño y bucle -----
  let alta = true;
  const tamano = () => { const r = cv.getBoundingClientRect(); const k = alta ? Math.min(devicePixelRatio || 1, 1.5) : .6; const w = Math.max(320, Math.round(r.width * k)), h = Math.max(180, Math.round(r.height * k)); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } };
  const ro = new ResizeObserver(tamano); ro.observe(cv);
  let zonaAct = "", cooldownPortal = 0, M = null;
  // ----- ambiente: hora del día, sol, luna, estrellas, nubes y lluvia -----
  const ambiente = crearAmbiente(DIM), sonido = crearSonido(ctx.sonido || {});
  let amb = ambiente.get();
  const mezclar = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const RZ = (a) => { const c = Math.cos(a), s2 = Math.sin(a); return [c, s2, 0, 0, -s2, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; };
  const nubes = [], estrellas = [], gotas = [];
  { let s2 = 12345; const r2 = () => { s2 = (Math.imul(s2, 1664525) + 1013904223) >>> 0; return s2 / 4294967296; };
    for (let i = 0; i < 18; i++) nubes.push({ x: r2() * 280, z: r2() * 280, w: 12 + r2() * 20, d: 8 + r2() * 10, v: .8 + r2() * .8, y: 66 + r2() * 8 });
    for (let i = 0; i < 110; i++) { const a = r2() * Math.PI * 2, e = .08 + r2() * 1.3; estrellas.push([Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e), r2()]); }
    for (let i = 0; i < 170; i++) gotas.push({ dx: (r2() - .5) * 26, dz: (r2() - .5) * 26, y: r2() * 16, tope: -1 }); }
  const topeColumna = (x, z) => { for (let y = SY - 1; y >= 0; y--) if (solido(x, y, z) && get(x, y, z) !== 8) return y + 1; return 0; };
  const orientar = (d) => mul(RY(Math.atan2(d[0], d[2])), RX(-Math.asin(Math.max(-1, Math.min(1, d[1])))));
  function prepararPC(cielo, flat) {
    gl.useProgram(PC); gl.uniform3f(locC.cn, cielo[0], cielo[1], cielo[2]);
    if (flat) { gl.uniform3f(locC.lc, 1, 1, 1); gl.uniform2f(locC.fg, 0, .001); } else { gl.uniform3f(locC.lc, amb.luz[0], amb.luz[1], amb.luz[2]); gl.uniform2f(locC.fg, 40 - 14 * amb.lluvia - 12 * (amb.niebla || 0), 45 - 15 * amb.lluvia - 12 * (amb.niebla || 0)); }
    gl.bindBuffer(gl.ARRAY_BUFFER, cuboB); gl.enableVertexAttribArray(locC.p); gl.vertexAttribPointer(locC.p, 3, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(locC.s); gl.vertexAttribPointer(locC.s, 1, gl.FLOAT, false, 16, 12);
    gl.disable(gl.CULL_FACE);
  }
  function cerrarPC() { gl.disableVertexAttribArray(locC.p); gl.disableVertexAttribArray(locC.s); gl.enable(gl.CULL_FACE); }
  const pieza = (pos, mat, col) => { gl.uniform3f(locC.cn, col[0], col[1], col[2]); gl.uniformMatrix4fv(locC.m, false, new Float32Array(mul(M, mul(T4(pos[0], pos[1], pos[2]), mat)))); gl.drawArrays(gl.TRIANGLES, 0, 36); };
  // sol, luna y estrellas: van detrás de todo
  function dibujarCielo(c, cielo, tt) {
    prepararPC(cielo, true); gl.depthMask(false);
    const eye = [c.ex, c.ey, c.ez], en = (d, r) => [eye[0] + d[0] * r, eye[1] + d[1] * r, eye[2] + d[2] * r], ll = amb.lluvia;
    if (amb.altura > -.14) pieza(en(amb.sol, 100), mul(orientar(amb.sol), S4(16, 16, 1)), mezclar(mezclar([1, .97, .76], [1, .6, .28], amb.ocaso), cielo, ll * .9));
    if (amb.altura < .14) pieza(en(amb.luna, 100), mul(orientar(amb.luna), S4(12, 12, 1)), mezclar([.88, .92, 1], cielo, ll * .9));
    if (amb.noche > .35 && ll < .7) { const k = Math.min(1, (amb.noche - .35) * 1.6) * (1 - ll);
      for (const st of estrellas) pieza(en(st, 105), S4(.9, .9, .9), mezclar(cielo, [1, 1, 1], k * (.55 + .45 * Math.sin(tt * 2 + st[3] * 40)))); }
    gl.depthMask(true); cerrarPC();
  }
  // nubes y lluvia: van delante del terreno, con su profundidad
  function dibujarAtmosfera(c, cielo, tt, dt) {
    prepararPC(cielo, true); gl.depthMask(false);
    const base = amb.luz.map((v) => Math.min(1, v * 1.08)), gris = [.55, .58, .62].map((v, i) => v * Math.max(.3, amb.luz[i]));
    const colNube = mezclar(base, gris, amb.lluvia * .7);
    for (const n of nubes) {
      const rx = (((n.x + tt * n.v - c.ex) % 280) + 280) % 280 - 140, rz = (((n.z - c.ez) % 280) + 280) % 280 - 140;
      pieza([c.ex + rx, n.y, c.ez + rz], S4(n.w, 2.5, n.d), colNube);
    }
    if (amb.lluvia > .12 && !ctx.vuelo) {
      const nieva = bioma(Math.floor(c.ex), Math.floor(c.ez)) === 2, activas = Math.floor(gotas.length * amb.lluvia), col = nieva ? [.97, .98, 1] : mezclar(cielo, [.7, .8, .96], .75);
      for (let i = 0; i < activas; i++) {
        const g = gotas[i]; g.y -= (nieva ? 2.4 : 17) * dt; if (nieva) g.dx += Math.sin(tt * 1.3 + i) * .4 * dt;
        if (g.y < -7 || g.tope < 0) { g.dx = (Math.random() - .5) * 26; g.dz = (Math.random() - .5) * 26; g.y = 8 + Math.random() * 8; g.tope = topeColumna(Math.floor(c.ex + g.dx), Math.floor(c.ez + g.dz)); }
        const yy = c.ey + g.y; if (yy < g.tope) continue;
        pieza([c.ex + g.dx, yy, c.ez + g.dz], nieva ? S4(.1, .1, .1) : S4(.03, .55, .03), col);
      }
    }
    gl.depthMask(true); cerrarPC();
  }

  // ----- animales -----
  const animales = [];
  { let s3 = ((semilla ^ 0x5bd1e995) >>> 0) || 7; const r3 = () => { s3 = (Math.imul(s3, 1664525) + 1013904223) >>> 0; return s3 / 4294967296; };
    const valido = (x, z) => {
      const xi = Math.floor(x), zi = Math.floor(z); if (xi < 4 || zi < 4 || xi > SX - 5 || zi > SZ - 5) return false;
      if (Math.hypot(x - CENTRO, z - CENTRO) < 46 || Math.hypot(x - CRUCE.x, z - CRUCE.z) < 24 || Math.hypot(x - MONTE.x, z - MONTE.z) < MONTE.r + 2 || Math.hypot((x - LAGO.x) * .8, z - LAGO.z) < LAGO.r + 6) return false;
      if (distCamino(xi, zi) <= 3) return false;
      const h = alt[zi * SX + xi]; return get(xi, h, zi) === 1 && sueloPara(x, z, h + 1) != null;
    };
    for (const [tipo, n] of DIM ? [] : POBLACION) {
      let puestos = 0, intentos = 0;
      while (puestos < n && intentos < 500) {
        intentos++; const cx = 10 + r3() * (SX - 20), cz = 10 + r3() * (SZ - 20); if (!valido(cx, cz)) continue;
        const tam = Math.min(n - puestos, 2 + Math.floor(r3() * 3));
        for (let i = 0; i < tam; i++) {
          const x = cx + (r3() - .5) * 8, z = cz + (r3() - .5) * 8; if (!valido(x, z)) continue;
          const y = sueloPara(x, z, alt[Math.floor(z) * SX + Math.floor(x)] + 1);
          animales.push({ tipo, esp: ESPECIES[tipo], x, y, z, x0: x, z0: z, h: r3() * 6.28, obj: null, espera: r3() * 4, pasta: 0, susto: 0, fase: r3() * 6, fase0: r3() * 6, amp: 0, snd: 5 + r3() * 25 });
          puestos++;
        }
      }
    }
  }
  const FRASES = { vaca: "🐄 ¡Muuu!", oveja: "🐑 ¡Beee!", cerdo: "🐖 ¡Oinc, oinc!", gallina: "🐔 ¡Coc, coc, coc!", conejo: "🐇 ¡Salta, salta!" };
  function moverAnimales(dt) {
    for (const a of animales) {
      const dxp = jug.x - a.x, dzp = jug.z - a.z, dp = Math.hypot(dxp, dzp); if (dp > 90) continue;
      const e = a.esp; let mover = false;
      if (a.susto > 0) a.susto -= dt;
      if (dp < 2.4 && Math.hypot(jug.vx, jug.vz) > 3 && a.susto <= 0 && !ctx.vuelo) { // se asusta si corres hacia ella
        const ang = Math.atan2(-dxp, -dzp) + (Math.random() - .5) * 1.2; a.obj = [a.x + Math.sin(ang) * 4, a.z + Math.cos(ang) * 4]; a.susto = 2.2; a.pasta = 0;
      }
      if (a.pasta > 0) a.pasta -= dt;
      else if (a.obj) {
        const ox = a.obj[0] - a.x, oz = a.obj[1] - a.z, d = Math.hypot(ox, oz);
        if (d < .2) { a.obj = null; a.espera = 1 + Math.random() * 4; }
        else {
          const objH = Math.atan2(ox, oz); a.h += Math.max(-5 * dt, Math.min(5 * dt, angDif(objH, a.h)));
          if (Math.abs(angDif(objH, a.h)) < .6) {
            const paso = Math.min(d, e.vel * (a.susto > 0 ? 2.6 : 1) * dt), nx = a.x + ox / d * paso, nz = a.z + oz / d * paso, sy = sueloPara(nx, nz, a.y);
            if (sy != null && Math.abs(sy - a.y) <= 1.01) { a.x = nx; a.z = nz; a.y += (sy - a.y) * Math.min(1, 10 * dt); mover = true; } else { a.obj = null; a.espera = 1; }
          }
        }
      } else {
        a.espera -= dt;
        if (a.espera <= 0) {
          a.espera = .5;
          if (Math.random() < .45) a.pasta = 2 + Math.random() * 3;
          else { const ang = Math.random() * 6.28, r = (.4 + Math.random() * .6) * e.radio, px = a.x0 + Math.cos(ang) * r, pz = a.z0 + Math.sin(ang) * r; if (sueloPara(px, pz, a.y) != null) a.obj = [px, pz]; }
        }
      }
      a.amp += ((mover ? 1 : 0) - a.amp) * Math.min(1, 8 * dt); if (mover) a.fase += dt * (a.susto > 0 ? 14 : 7);
      if (dp < 16) { a.snd -= dt; if (a.snd <= 0) { a.snd = 14 + Math.random() * 30; sonido.animal(a.tipo); } }
    }
  }
  function dibujarAnimales(cielo, tt) {
    prepararPC(cielo, false);
    for (const a of animales) {
      if (Math.hypot(a.x - jug.x, a.z - jug.z) > 70) continue;
      const sw = Math.sin(a.fase) * .65 * a.amp, base = mul(M, mul(T4(a.x, a.y, a.z), RY(a.h)));
      for (const p of a.esp.partes) {
        let g = mul(base, T4(p.p[0], p.p[1], p.p[2]));
        if (p.tipo === "pata") g = mul(g, RX(p.fase ? -sw : sw));
        else if (p.tipo === "cabeza") g = mul(g, RX(a.pasta > 0 ? (a.tipo === "gallina" ? .8 + Math.sin(tt * 14) * .3 : .95 + Math.sin(tt * 6) * .08) : Math.sin(tt * 1.2 + a.fase0) * .05 + (a.tipo === "gallina" ? Math.sin(a.fase * 2) * .25 * a.amp : 0)));
        else if (p.tipo === "ala") g = mul(g, RZ((p.fase ? 1 : -1) * (a.susto > 0 ? 1.1 + Math.sin(tt * 30) * .5 : .08)));
        else if (p.tipo === "cola") g = mul(g, RX(.25 + Math.sin(tt * 2.5 + a.fase0) * .2));
        for (const [w, hh, d, ox, oy, oz, col] of p.cajas) {
          gl.uniformMatrix4fv(locC.m, false, new Float32Array(mul(g, mul(T4(ox, oy, oz), S4(w, hh, d))))); gl.uniform3f(locC.c, col[0], col[1], col[2]); gl.drawArrays(gl.TRIANGLES, 0, 36);
        }
      }
    }
    cerrarPC();
  }

  // ----- monstruos: salen fuera de la aldea (limo de día; esqueleto y sombra de noche). Te quitan vida; se les gana a golpes -----
  const mons = [];
  let monActivo = false, monT = 5, invJug = 0, desmayado = 0, golpeCd = 0, empuje = null, monGolpeTxt = 0;
  const enAldea = (x, z) => Math.max(Math.abs(x - CENTRO), Math.abs(z - CENTRO)) < RADIO_PLAZA + 4;
  function aparecerMonstruo() {
    const noche = amb.noche > .55, tope = DIM ? 7 : noche ? 6 : 2; if (mons.filter((q) => !q.def.jefe).length >= tope) return;
    const r = Math.random(), tipo = DIM ? (r < .55 ? "brasero" : "ceniza") : !noche ? "limo" : r < .3 ? "limo" : r < .7 ? "esqueleto" : "sombra";
    for (let i = 0; i < 12; i++) {
      const ang = Math.random() * 6.283, d = 16 + Math.random() * 14, x = jug.x + Math.cos(ang) * d, z = jug.z + Math.sin(ang) * d;
      const xi = Math.floor(x), zi = Math.floor(z); if (xi < 4 || zi < 4 || xi > SX - 5 || zi > SZ - 5 || enAldea(x, z)) continue;
      const y = sueloPara(x, z, alt[zi * SX + xi] + 1); if (y == null || Math.abs(y - jug.y) > 9) continue;
      const def = MONSTRUOS[tipo]; mons.push({ tipo, def, x, y, z, h: Math.random() * 6.28, hp: def.hp, flash: 0, cd: 1.2, lunge: 0, fase: Math.random() * 6, amp: 0, kb: null, quema: 0 });
      return;
    }
  }
  function quitarMonstruo(m, efecto) { const i = mons.indexOf(m); if (i >= 0) mons.splice(i, 1); if (efecto) soltarParticulas(m.x, m.y + .7, m.z, m.def.sangre, 14, 2.4); }
  function golpeJugador(m) {
    invJug = 1; danoEl.classList.add("on"); requestAnimationFrame(() => requestAnimationFrame(() => danoEl.classList.remove("on")));
    sonido.dano(); const dx = jug.x - m.x, dz = jug.z - m.z, d = Math.hypot(dx, dz) || 1; empuje = { x: dx / d * 5.5, z: dz / d * 5.5, t: .16 };
    Promise.resolve(ctx.alDanio && ctx.alDanio(m.tipo)).then((r) => { if (!r) return; try { ctx.alVida && ctx.alVida(r); } catch (_) {} if (r.desmayo) desmayarse(); }).catch(() => {});
  }
  function desmayarse() {
    if (desmayado > 0) return; desmayado = 3.2; sonido.desmayo(); limpiarEntrada(); mons.length = 0; if (bloqueado()) document.exitPointerLock();
    desmayoEl.style.display = "flex";
    setTimeout(() => {
      const x = CENTRO + .5, z = CENTRO + 6.5, y = sueloPara(x, z, 13) || 13.1; jug.x = x; jug.z = z; jug.y = y + .05; jug.vx = jug.vy = jug.vz = 0;
      Promise.resolve(ctx.alRevivir && ctx.alRevivir()).then((r) => { try { ctx.alVida && ctx.alVida(r); } catch (_) {} }).catch(() => {});
    }, 1800);
  }
  // ¿hay un monstruo justo delante? Si lo hay, se le pega (cada .5 s) en vez de picar
  function golpearMonstruo() {
    if (!mons.length || pausado || desmayado > 0 || ctx.soloMirar) return false;
    const f = adelante(), ex = jug.x, ey = ojo(), ez = jug.z; let mejor = null, md = 1e9;
    for (const m of mons) { const vx = m.x - ex, vy = m.y + .8 - ey, vz = m.z - ez, d = Math.hypot(vx, vy, vz); if (d > 3.7) continue; if ((vx * f[0] + vy * f[1] + vz * f[2]) / d < .86) continue; if (d < md) { md = d; mejor = m; } }
    if (!mejor) return false;
    if (golpeCd > 0) return true;
    golpeCd = .5; const m = mejor, dmg = danioDeArma((id) => ctx.cantidad(id)); m.hp -= dmg; m.flash = .22; sonido.pegar();
    const dx = m.x - jug.x, dz = m.z - jug.z, dd = Math.hypot(dx, dz) || 1; m.kb = { x: dx / dd * 4, z: dz / dd * 4, t: .15 }; soltarParticulas(m.x, m.y + .8, m.z, m.def.sangre, 4, 1.6);
    if (m.hp <= 0) {
      quitarMonstruo(m, true); sonido.vencido();
      if (m.def.jefe) jefeCd = 300;
      Promise.resolve(ctx.alMonstruoVencido && ctx.alMonstruoVencido(m.tipo)).then((r) => { if (r && r.jefe_pausa) aviso("👑 Ya venciste al jefe hace poco. ¡Vuelve en unos minutos!"); else if (r && (r.xp || r.oro)) aviso((r.jefe ? "👑 ¡Jefe vencido! +1 corazón de brasa · +" : "⚔️ Venciste al " + m.def.nombre.toLowerCase() + ": +") + r.xp + " XP · +" + r.oro + " 🪙"); else if (r && r.tope) aviso("Hoy ya ganaste el máximo de premios por monstruos. ¡Sigue jugando!"); }).catch(() => {});
    }
    return true;
  }
  function moverMonstruos(dt) {
    if (golpeCd > 0) golpeCd -= dt; if (invJug > 0) invJug -= dt;
    if (desmayado > 0) { desmayado -= dt; if (desmayado <= 0) desmayoEl.style.display = "none"; return; }
    if (empuje) { empuje.t -= dt; const nx = jug.x + empuje.x * dt, nz = jug.z + empuje.z * dt; if (!choca(nx, jug.y, jug.z)) jug.x = nx; if (!choca(jug.x, jug.y, nz)) jug.z = nz; if (empuje.t <= 0) empuje = null; }
    const activo = monActivo && !ctx.soloMirar && !ctx.vuelo; if (!activo && mons.length) mons.length = 0; if (!activo || pausado) return;
    monT -= dt; if (monT <= 0) { monT = (DIM ? 3 : 5) + Math.random() * 5; if (!enAldea(jug.x, jug.z)) aparecerMonstruo(); }
    for (const m of [...mons]) {
      const dx = jug.x - m.x, dz = jug.z - m.z, d = Math.hypot(dx, dz), def = m.def;
      if (d > (def.jefe ? 140 : 58) || (!def.jefe && enAldea(m.x, m.z))) { quitarMonstruo(m, false); continue; }
      if (def.noche && !DIM && amb.noche < .25) { m.quema += dt; if (m.quema > 1.6) { quitarMonstruo(m, true); continue; } } else m.quema = 0;
      if (m.flash > 0) m.flash -= dt; if (m.cd > 0) m.cd -= dt; if (m.lunge > 0) m.lunge -= dt;
      let mover = false;
      if (m.kb) { m.kb.t -= dt; const nx = m.x + m.kb.x * dt, nz = m.z + m.kb.z * dt, sy = sueloPara(nx, nz, m.y); if (sy != null && Math.abs(sy - m.y) <= 1.01) { m.x = nx; m.z = nz; m.y = sy; } if (m.kb.t <= 0) m.kb = null; }
      else if (d < def.vision && !enAldea(jug.x, jug.z)) {
        const objH = Math.atan2(dx, dz); m.h += Math.max(-6 * dt, Math.min(6 * dt, angDif(objH, m.h)));
        if (d > def.alcance * .8) {
          for (const off of [0, .8, -.8]) {
            const a = m.h + off, paso = def.vel * (m.tipo === "limo" ? .45 + .55 * Math.max(0, Math.sin(m.fase)) : 1) * dt, nx = m.x + Math.sin(a) * paso, nz = m.z + Math.cos(a) * paso, sy = sueloPara(nx, nz, m.y);
            if (sy != null && Math.abs(sy - m.y) <= 1.01 && !enAldea(nx, nz)) { m.x = nx; m.z = nz; m.y += (sy - m.y) * Math.min(1, 12 * dt); mover = true; break; }
          }
        }
        if (d < def.alcance + .35 && Math.abs(m.y - jug.y) < 1.7 && m.cd <= 0 && invJug <= 0) { m.cd = 1.5; m.lunge = .3; golpeJugador(m); }
        if (d < 12 && Math.random() < dt * .25) sonido.monstruo(m.tipo);
      }
      m.amp += ((mover ? 1 : 0) - m.amp) * Math.min(1, 8 * dt); m.fase += dt * (mover ? (m.tipo === "limo" ? 6 : 9) : 1.5);
    }
  }
  function dibujarMonstruos(cielo, tt) {
    if (!mons.length) return; prepararPC(cielo, false);
    for (const m of mons) {
      if (Math.hypot(m.x - jug.x, m.z - jug.z) > 60) continue;
      const def = m.def, sw = Math.sin(m.fase) * .8 * m.amp, flota = def.flota ? .35 + Math.sin(tt * 2 + m.fase) * .12 : 0;
      const sq = m.tipo === "limo" ? 1 + Math.sin(m.fase) * .12 * (m.amp + .3) : 1, lung = m.lunge > 0 ? Math.sin(m.lunge / .3 * Math.PI) * .35 : 0;
      const base = mul(M, mul(T4(m.x, m.y + flota, m.z), mul(RY(m.h), mul(T4(0, 0, lung), S4(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq))))));
      const fl = m.flash > 0 ? Math.min(1, m.flash / .22) * .65 : 0;
      for (const p of def.partes) {
        let g = mul(base, T4(p.p[0], p.p[1], p.p[2]));
        if (p.tipo === "pata") g = mul(g, RX(p.fase ? -sw : sw));
        else if (p.tipo === "brazo") g = mul(g, RX(-1.25 + (p.fase ? -sw : sw) * .3 + (m.lunge > 0 ? -.4 : 0)));
        else if (p.tipo === "cabeza") g = mul(g, RX(Math.sin(tt * 1.5 + m.fase) * .04));
        for (const [w, hh, dd, ox, oy, oz, col] of p.cajas) {
          gl.uniformMatrix4fv(locC.m, false, new Float32Array(mul(g, mul(T4(ox, oy, oz), S4(w, hh, dd)))));
          gl.uniform3f(locC.c, col[0] + (1 - col[0]) * fl, col[1] * (1 - fl * .6), col[2] * (1 - fl * .6)); gl.drawArrays(gl.TRIANGLES, 0, 36);
        }
      }
      if (m.hp < m.def.hp) { // barra de vida sobre la cabeza
        const hb = mul(M, mul(T4(m.x, m.y + (m.tipo === "limo" ? 1.15 : (m.def.alto || 2.15)) + flota, m.z), RY(Math.atan2(jug.x - m.x, jug.z - m.z))));
        const fr = Math.max(0, m.hp / m.def.hp); gl.uniform3f(locC.lc, 1, 1, 1);
        for (const [w, ox, col] of [[.8, 0, [.15, .15, .15]], [.76 * fr, -.38 * (1 - fr), [.9, .2, .2]]]) { gl.uniformMatrix4fv(locC.m, false, new Float32Array(mul(hb, mul(T4(ox, 0, w === .8 ? 0 : .01), S4(w, .09, .03))))); gl.uniform3f(locC.c, col[0], col[1], col[2]); gl.drawArrays(gl.TRIANGLES, 0, 36); }
        gl.uniform3f(locC.lc, amb.luz[0], amb.luz[1], amb.luz[2]);
      }
    }
    cerrarPC();
  }

  // ----- flores y antorchas -----
  function dibujarDecor(cielo, tt) {
    prepararPC(cielo, false);
    const col = (c) => gl.uniform3f(locC.c, c[0], c[1], c[2]);
    const caja = (g, w, h, d, ox, oy, oz, c) => { gl.uniformMatrix4fv(locC.m, false, new Float32Array(mul(g, mul(T4(ox, oy, oz), S4(w, h, d))))); col(c); gl.drawArrays(gl.TRIANGLES, 0, 36); };
    for (const f of flores) {
      const dx = f.x - jug.x, dz = f.z - jug.z; if (dx * dx + dz * dz > 2500) continue;
      if (get(f.bx, f.y, f.bz) !== AIRE || get(f.bx, f.y - 1, f.bz) !== 1) continue;
      const g = mul(M, mul(T4(f.x, f.y, f.z), RZ(Math.sin(tt * 1.6 + f.ph) * .07)));
      caja(g, .06, .4, .06, 0, .2, 0, [.2, .55, .2]); caja(g, .22, .12, .22, 0, .44, 0, f.col); caja(g, .08, .08, .08, 0, .52, 0, [1, .85, .2]);
    }
    for (const a of antorchas) {
      const dx = a[0] - jug.x, dz = a[2] - jug.z; if (dx * dx + dz * dz > 3600) continue;
      const g = mul(M, T4(a[0], a[1], a[2]));
      caja(g, .14, .7, .14, 0, .35, 0, [.4, .27, .14]);
      gl.uniform3f(locC.lc, 1, 1, 1); // la llama brilla aunque sea de noche
      const fl = .85 + .15 * Math.sin(tt * 9 + a[0] * 3);
      caja(g, .26, .26, .26, 0, .82, 0, [1, .62 * fl, .12]); caja(g, .14, .16, .14, 0, 1.02 + .04 * Math.sin(tt * 11 + a[2]), 0, [1, .9, .35]);
      gl.uniform3f(locC.lc, amb.luz[0], amb.luz[1], amb.luz[2]);
    }
    cerrarPC();
  }

  function dibujar() {
    gl.viewport(0, 0, cv.width, cv.height);
    amb = ambiente.get(); const tt0 = performance.now() / 1000, dt0 = Math.min(.05, Math.max(0, tt0 - (dibujar.t || tt0))); dibujar.t = tt0;
    // tormenta: con lluvia fuerte caen rayos de vez en cuando (destello y trueno que llega un poco después)
    if (amb.lluvia > .85 && !ctx.vuelo && !pausado) { rayoT -= dt0; if (rayoT <= 0) { rayoT = 14 + Math.random() * 22; rayoF = 1; truenoT = 1 + Math.random() * 2; } }
    if (rayoF > 0) { rayoF -= dt0 * 3; rayoEl.style.opacity = String(Math.max(0, rayoF) * (rayoF > .5 ? .85 : .5)); }
    if (truenoT > 0) { truenoT -= dt0; if (truenoT <= 0) { try { sonido.trueno && sonido.trueno(); } catch (_) {} } }
    const kAg = .3 + .7 * amb.dia, cielo = enLava ? [.55, .12, .02] : enAgua ? [.2 * kAg, .4 * kAg, .7 * kAg] : amb.cielo; gl.clearColor(cielo[0], cielo[1], cielo[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const cc = camaraActual(); const asp = cv.width / cv.height, fovV = asp < 16 / 9 ? Math.min(1.75, 2 * Math.atan(Math.tan(cam.fov / 2) * Math.pow(16 / 9 / asp, .6))) : cam.fov; // en pantallas verticales se abre el campo para no ver 'por un tubo'
    M = mul(perspectiva(fovV, asp, .05, 140), vista(cc));
    if (!enAgua && !DIM) dibujarCielo(cc, cielo, tt0);
    gl.useProgram(P); gl.uniformMatrix4fv(loc.m, false, new Float32Array(M)); gl.uniform1i(loc.t, 0); gl.uniform3f(loc.cn, cielo[0], cielo[1], cielo[2]);
    gl.uniform3f(loc.lc, amb.luz[0], amb.luz[1], amb.luz[2]); gl.uniform2f(loc.fg, 40 - 14 * amb.lluvia - 12 * (amb.niebla || 0), 45 - 15 * amb.lluvia - 12 * (amb.niebla || 0));
    gl.enableVertexAttribArray(loc.p); gl.enableVertexAttribArray(loc.u); gl.enableVertexAttribArray(loc.s);
    for (let cz = 0; cz < NCZ; cz++) for (let cx = 0; cx < NCX; cx++) {
      const ch = chunks[cz * NCX + cx]; if (!ch || !ch.n) continue;
      const dx = cx * CH + CH / 2 - jug.x, dz = cz * CH + CH / 2 - jug.z; if (dx * dx + dz * dz > 100 * 100) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, ch.pb); gl.vertexAttribPointer(loc.p, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, ch.ub); gl.vertexAttribPointer(loc.u, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, ch.sb); gl.vertexAttribPointer(loc.s, 1, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ch.ib); gl.drawElements(gl.TRIANGLES, ch.n, gl.UNSIGNED_INT, 0);
    }
    gl.disableVertexAttribArray(loc.u); gl.disableVertexAttribArray(loc.s);
    if (vis.length || otros.size) {
      const tt = performance.now() / 1000;
      gl.useProgram(PC); gl.uniform3f(locC.cn, cielo[0], cielo[1], cielo[2]); gl.uniform3f(locC.lc, amb.luz[0], amb.luz[1], amb.luz[2]); gl.uniform2f(locC.fg, 40 - 14 * amb.lluvia - 12 * (amb.niebla || 0), 45 - 15 * amb.lluvia - 12 * (amb.niebla || 0));
      gl.bindBuffer(gl.ARRAY_BUFFER, cuboB); gl.enableVertexAttribArray(locC.p); gl.vertexAttribPointer(locC.p, 3, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(locC.s); gl.vertexAttribPointer(locC.s, 1, gl.FLOAT, false, 16, 12);
      gl.disable(gl.CULL_FACE);
      for (const v of vis) if (Math.hypot(v.n.x - jug.x, v.n.z - jug.z) < 64) dibujarAldeano(v, tt);
      for (const o of otros.values()) if (o.dist < 64) dibujarAldeano(o, tt);
      if (cam.modo !== 0) { // tu personaje, con tu avatar
        const hv = Math.hypot(jug.vx, jug.vz); jugV.n.x = jug.x; jugV.n.y = jug.y; jugV.n.z = jug.z; jugV.h = jug.yaw + Math.PI;
        jugV.mover = hv > .3 && jug.suelo; jugV.amp += ((jugV.mover ? 1 : 0) - jugV.amp) * .2; if (jugV.mover) jugV.fase += hv * .03; jugV.nodFijo = Math.max(-.8, Math.min(.8, jug.pitch * .7));
        dibujarAldeano(jugV, tt);
      }
      gl.enable(gl.CULL_FACE); gl.disableVertexAttribArray(locC.p); gl.disableVertexAttribArray(locC.s);
    }
    dibujarDecor(cielo, tt0); dibujarAnimales(cielo, tt0); dibujarMonstruos(cielo, tt0); dibujarEfectos(cielo, tt0); dibujarParcelas(cielo, tt0); if (!DIM) dibujarAtmosfera(cc, cielo, tt0, dt0);
    const h = apuntar();
    if (ctx.alApuntar) { // el docente ve quién puso el bloque que mira
      const au = h ? autores.get(clave(h.x, h.y, h.z)) : undefined, k = h ? (au === undefined ? "base" : String(au)) : "";
      if (k !== ultApuntado) { ultApuntado = k; try { ctx.alApuntar(h ? { autor: au === undefined ? null : au, x: h.x, y: h.y, z: h.z } : null); } catch (_) {} }
    }
    if (h) {
      gl.useProgram(PL); gl.uniformMatrix4fv(locL.m, false, new Float32Array(mul(M, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, h.x, h.y, h.z, 1])));
      gl.bindBuffer(gl.ARRAY_BUFFER, cajaB); gl.enableVertexAttribArray(locL.p); gl.vertexAttribPointer(locL.p, 3, gl.FLOAT, false, 0, 0);
      gl.disable(gl.CULL_FACE); gl.drawArrays(gl.LINES, 0, 24); gl.enable(gl.CULL_FACE);
    }
    // etiquetas de los portales
    const w = cv.clientWidth, hh = cv.clientHeight;
    etiquetas.forEach((e, i) => {
      const dx = e.x - jug.x, dz = e.z - jug.z, dist = Math.hypot(dx, dz), el = capaEt[i];
      if (dist > (e.clase ? 22 : 30)) { el.style.display = "none"; return; }
      const q = [M[0] * e.x + M[4] * e.y + M[8] * e.z + M[12], M[1] * e.x + M[5] * e.y + M[9] * e.z + M[13], M[3] * e.x + M[7] * e.y + M[11] * e.z + M[15]];
      if (q[2] <= .1) { el.style.display = "none"; return; }
      el.style.display = ""; el.style.left = ((q[0] / q[2] * .5 + .5) * w) + "px"; el.style.top = ((1 - (q[1] / q[2] * .5 + .5)) * hh) + "px";
    });
    // etiquetas de los personajes y el más cercano al que se puede hablar
    const fw = adelante(), fl = Math.hypot(fw[0], fw[2]) || 1; let cerca = null, mejor = 3.4;
    for (const v of vis) {
      const n = v.n, dx = n.x - jug.x, dz = n.z - jug.z, dist = Math.hypot(dx, dz), el = v.el, ey = n.y + 2.45;
      const q = [M[0] * n.x + M[4] * ey + M[8] * n.z + M[12], M[1] * n.x + M[5] * ey + M[9] * n.z + M[13], M[3] * n.x + M[7] * ey + M[11] * n.z + M[15]];
      if (dist > 24 || q[2] <= .1) el.style.display = "none";
      else { el.style.display = ""; el.style.left = ((q[0] / q[2] * .5 + .5) * w) + "px"; el.style.top = ((1 - (q[1] / q[2] * .5 + .5)) * hh) + "px"; }
      if (dist < mejor && Math.abs(n.y - jug.y) < 3 && (dx * fw[0] + dz * fw[2]) / (dist * fl + 1e-6) > .3) { mejor = dist; cerca = n; }
    }
    for (const o of otros.values()) { // etiquetas de los compañeros
      const ey = o.n.y + 2.3, q = [M[0] * o.n.x + M[4] * ey + M[8] * o.n.z + M[12], M[1] * o.n.x + M[5] * ey + M[9] * o.n.z + M[13], M[3] * o.n.x + M[7] * ey + M[11] * o.n.z + M[15]];
      if (o.dist > 40 || q[2] <= .1) { o.el.style.display = "none"; o.bub.style.display = "none"; } else { const lx = ((q[0] / q[2] * .5 + .5) * w) + "px", ty = ((1 - (q[1] / q[2] * .5 + .5)) * hh);
        o.el.style.display = ""; o.el.style.left = lx; o.el.style.top = ty + "px"; o.bub.style.display = o.frase ? "" : "none"; o.bub.style.left = lx; o.bub.style.top = (ty - 24) + "px"; }
    }
    for (const p of parcelas) { const cx = p.x + 8, cz = p.z + 8, d = Math.hypot(cx - jug.x, cz - jug.z), ey = (p.postes[0] ? p.postes[0].y : 14) + 3.4;
      const q = [M[0] * cx + M[4] * ey + M[8] * cz + M[12], M[1] * cx + M[5] * ey + M[9] * cz + M[13], M[3] * cx + M[7] * ey + M[11] * cz + M[15]];
      if (d > 34 || q[2] <= .1) p.el.style.display = "none"; else { p.el.style.display = ""; p.el.style.left = ((q[0] / q[2] * .5 + .5) * w) + "px"; p.el.style.top = ((1 - (q[1] / q[2] * .5 + .5)) * hh) + "px"; } }
    mesaCer = null; if (!pausado && !ctx.vuelo) { let md = 2.6; for (const m of mesas) { const d = Math.hypot(m.x - jug.x, m.z - jug.z); if (d < md && Math.abs(m.y - jug.y) < 3) { md = d; mesaCer = m; } } }
    cercano = pausado ? null : cerca;
    animalCer = null;
    if (!cercano && !pausado && !ctx.vuelo) { let mj = 3; for (const a of animales) { const dx = a.x - jug.x, dz = a.z - jug.z, dist = Math.hypot(dx, dz); if (dist < mj && Math.abs(a.y - jug.y) < 2.5 && (dx * fw[0] + dz * fw[2]) / (dist * fl + 1e-6) > .45) { mj = dist; animalCer = a; } } }
    const algo = cercano || animalCer || mesaCer;
    hablarEl.style.display = algo ? "block" : "none"; if (algo) hablarEl.textContent = !cercano && !animalCer ? "E · Usar la mesa de fabricación" : cercano ? "E · Hablar con " + cercano.nombre : (ACCION_ANIMAL[animalCer.tipo] || "E · Acariciar ") + animalCer.esp.nombre.toLowerCase();
    btnHab.style.display = algo ? "block" : "none";
  }
  let ult = performance.now(), raf = 0;
  // sonidos del entorno: pasos, agua, viento, pájaros, grillos, lluvia y música
  let pasoAcc = 0, enAguaAntes = false;
  function bajoTecho() { const x = Math.floor(jug.x), z = Math.floor(jug.z); for (let y = Math.floor(jug.y + 2); y < Math.floor(jug.y + 10) && y < SY; y++) { const b = get(x, y, z); if (b !== AIRE && b !== AGUA && b !== PORTAL && b !== 5) return true; } return false; }
  function ambienteSonoro(dt) {
    if (!ctx.vuelo) {
      const hv = Math.hypot(jug.vx, jug.vz);
      if (enAgua && !enAguaAntes) sonido.agua();
      if (jug.suelo && hv > .5 && !enAgua) { pasoAcc += hv * dt; if (pasoAcc >= (hv > 5 ? 1.5 : 2)) { pasoAcc = 0; sonido.paso(get(Math.floor(jug.x), Math.floor(jug.y - .05), Math.floor(jug.z)), hv > 5); } }
      else if (enAgua && hv > .5) { pasoAcc += hv * dt; if (pasoAcc >= 1.4) { pasoAcc = 0; sonido.agua(); } }
      else pasoAcc = Math.min(pasoAcc, 1.2);
      enAguaAntes = enAgua;
    }
    sonido.actualizar(dt, { dia: amb.dia, noche: amb.noche, lluvia: amb.lluvia, bajoTecho: DIM ? true : ctx.vuelo ? false : bajoTecho(), enAgua, altura: jug.y });
  }
  const activarSonido = () => sonido.activar();
  on(window, "pointerdown", activarSonido, true); on(window, "keydown", activarSonido, true);

  function bucle(t) {
    if (!vivo) return;
    const dt = Math.min(.05, (t - ult) / 1000); ult = t;
    for (const k of sucios) construir(k % NCX, (k / NCX) | 0); sucios.clear();
    if (pausado) limpiarEntrada();
    actualizar(dt); quePicar(dt); moverNpcs(dt, performance.now() / 1000); moverOtros(dt); moverEfectos(dt); ajustarAlturas(dt); moverAnimales(dt); moverMonstruos(dt); vigilarJefe(dt); vigilarLava(dt); vigilarPuertas(dt); vigilarDim(dt); dibujar(); ambienteSonoro(dt);
    const z = DIM === 1 ? "Reino de Brasas" : zonaDe(Math.floor(jug.x), Math.floor(jug.z)); if (z !== zonaAct) { zonaAct = z; ctx.alZona && ctx.alZona(z); }
    cooldownPortal = Math.max(0, cooldownPortal - dt);
    if (!cooldownPortal) for (const p of portalesZona) {
      if (jug.x > p.x + 1 && jug.x < p.x + 3 && Math.abs(jug.z - (p.z + .5)) < .6 && jug.y + .9 > p.y + 1 && jug.y < p.y + 4) { cooldownPortal = 3; sonido.portal(); ctx.alPortal && ctx.alPortal(p.id); break; }
    }
    raf = requestAnimationFrame(bucle);
  }
  setPuertas(ctx.puertas || {}); if (ctx.parcelas) setParcelas(ctx.parcelas);
  jug.y = alt[(CENTRO + 6) * SX + CENTRO] + 1.1;
  raf = requestAnimationFrame(bucle);

  return {
    aplicar: (filas) => aplicar(filas),
    aplicarCultivos: (lista) => { for (const c of lista || []) { if (!(c.x >= 0 && c.x < SX && c.z >= 0 && c.z < SZ && c.y >= 0 && c.y < SY)) continue; const b = mundo[idx(c.x, c.y, c.z)]; if (b >= 100 && b <= 111) { const nb = 100 + (c.tipo | 0) * 4 + Math.min(3, c.etapa | 0); if (nb !== b) { mundo[idx(c.x, c.y, c.z)] = nb; marcar(c.x, c.z); } } } },
    seleccionar: (i) => { sel = i; },
    setCalidad: (v) => { alta = !!v; tamano(); },
    setCamara: (o) => { Object.assign(cam, o); },
    getCamara: () => ({ ...cam }),
    ir: (x, y, z, yaw, pitch) => { jug.x = x; jug.y = y; jug.z = z; if (yaw != null) jug.yaw = yaw; if (pitch != null) jug.pitch = pitch; jug.vx = jug.vy = jug.vz = 0; },
    setAvatar: (c) => ponerAvatar(c),
    setPuertas: (m) => setPuertas(m),
    setSonido: (o) => sonido.ajustar(o || {}), getSonido: () => sonido.estado(),
    setAmbiente: (o) => { if (!o) return; if ("hora" in o) ambiente.fijarHora(o.hora); if ("clima" in o) ambiente.fijarClima(o.clima); },
    getAmbiente: () => ({ hora: amb.hora, lluvia: amb.lluvia, dia: amb.dia }),
    pausar: (v) => { pausado = !!v; if (!pausado) hablandoCon = null; if (pausado) { limpiarEntrada(); if (bloqueado()) document.exitPointerLock(); } else if (jugando && !sinBloqueo) ayuda.textContent = "Haz clic para seguir jugando"; },
    actualizarNpcs: (lista) => montarNpcs(lista),
    setOtros: (lista) => setOtros(lista),
    setParcelas: (lista) => setParcelas(lista), irAMiParcela: () => irAMiParcela(), verParcelaAjena: () => verParcelaAjena(), setControl: (o) => { if (o && "giro" in o) control.giro = !!o.giro; },
    setVida: (o) => { if (o && "monstruos" in o) { monActivo = !!o.monstruos; if (!monActivo) mons.length = 0; } },
    desmayarse: () => desmayarse(),
    posicion: () => ({ x: jug.x, y: jug.y, z: jug.z, yaw: jug.yaw }),
    _debug: { mons, aparecerMonstruo, ponerMonstruo: (tipo, x, z) => { const def = MONSTRUOS[tipo], y = sueloPara(x, z, jug.y); if (!def || y == null) return null; const m = { tipo, def, x, y, z, h: 0, hp: def.hp, flash: 0, cd: 1.2, lunge: 0, fase: 0, amp: 0, kb: null, quema: 0 }; mons.push(m); return m; }, golpearMonstruo, jug, apuntar, get, picarAhora: (v) => { picar = v; }, poner, animales, ambiente, sonido },
    cerrar: () => {
      vivo = false; cancelAnimationFrame(raf); ro.disconnect();
      escuchas.forEach(([o, e, f, op]) => o.removeEventListener(e, f, op));
      if (bloqueado()) document.exitPointerLock();
      chunks.forEach((c) => { if (c) { gl.deleteBuffer(c.pb); gl.deleteBuffer(c.ub); gl.deleteBuffer(c.sb); gl.deleteBuffer(c.ib); } });
      sonido.cerrar(); limpiarNpcs(); otros.forEach((o) => { o.el.remove(); o.bub.remove(); }); otros.clear(); parcelas.forEach((p) => p.el.remove()); gl.deleteTexture(tex); const ex = gl.getExtension("WEBGL_lose_context"); if (ex) ex.loseContext();
      raiz.remove();
    },
  };
}
