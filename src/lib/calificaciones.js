// ==================== 📐 Cálculos de calificación ====================
// Funciones de cálculo puro (sin conexión a la base de datos) que usan
// Planillas, el Boletín, Estadísticas y el consolidado de Dirección de
// Curso. Reconstruido a partir de cómo lo consume el resto del proyecto,
// después de que el contenido de este archivo se reemplazara por error
// con el de otra pantalla.

// Valores por defecto para una materia que todavía no tiene configuración
// propia guardada (escala colombiana típica: 1.0 a 5.0, aprueba con 3.0).
export const CONFIG_DEFAULT = {
  escala_min: 1.0,
  nota_minima: 3.0,
  nota_maxima: 5.0,
  sistema_periodos: "bimestre", // "bimestre" | "trimestre" | "semestre" | "personalizado"
  cantidad_periodos: 4,
  periodo_actual: "1",
};

// Los periodos de una materia son simplemente "1", "2", "3"… hasta la
// cantidad configurada — el sistema (bimestre/trimestre/semestre) solo
// afecta cuántos son, no cómo se identifican.
export function periodosDe(config) {
  const n = Math.max(1, parseInt(config?.cantidad_periodos, 10) || CONFIG_DEFAULT.cantidad_periodos);
  return Array.from({ length: n }, (_, i) => String(i + 1));
}

// Las 4 bandas de desempeño del Decreto 1290, ubicadas proporcionalmente
// entre la nota mínima aprobatoria y la nota máxima de esa materia (así
// se ajustan solas si una institución usa una escala distinta a 1–5).
const BANDAS_INFO = [
  { key: "bajo", label: "Bajo", color: "#EF4444" },
  { key: "basico", label: "Básico", color: "#F59E0B" },
  { key: "alto", label: "Alto", color: "#3B82F6" },
  { key: "superior", label: "Superior", color: "#22C55E" },
];

export function bandaDesempeno(nota, config) {
  const c = config || CONFIG_DEFAULT;
  if (nota === null || nota === undefined || Number.isNaN(Number(nota))) {
    return { ...BANDAS_INFO[0], key: "sin_nota", label: "Sin nota" };
  }
  const n = Number(nota);
  const min = Number(c.nota_minima ?? CONFIG_DEFAULT.nota_minima);
  const max = Number(c.nota_maxima ?? CONFIG_DEFAULT.nota_maxima);
  if (n < min) return BANDAS_INFO[0]; // Bajo
  const rango = max - min;
  if (n < min + rango * 0.35) return BANDAS_INFO[1]; // Básico
  if (n < min + rango * 0.7) return BANDAS_INFO[2]; // Alto
  return BANDAS_INFO[3]; // Superior
}

// Actividades "automáticas": la nota sale sola de cuánto XP de gamificación
// lleva el estudiante en esa categoría, proporcional a la meta de la
// actividad, escalada a la escala de notas de la materia.
export function notaAutomatica(xp, xpMeta, config) {
  const c = config || CONFIG_DEFAULT;
  const meta = Number(xpMeta) || 1;
  const proporcion = Math.max(0, Math.min(1, Number(xp || 0) / meta));
  const min = Number(c.escala_min ?? CONFIG_DEFAULT.escala_min);
  const max = Number(c.nota_maxima ?? CONFIG_DEFAULT.nota_maxima);
  return Math.round((min + proporcion * (max - min)) * 10) / 10;
}

// Nota final ponderada: promedia las notas de cada categoría (Talleres,
// Participación…) y las combina según el % que pese cada una. Si una
// categoría no tiene ninguna nota cargada todavía, no cuenta ni resta del
// resto — se reparte el 100% entre las categorías que sí tienen algo.
export function notaFinalPonderada(porCategoria, categorias) {
  const conNotas = (categorias || []).filter((c) => (porCategoria[c.id] || []).length > 0);
  if (conNotas.length === 0) return null;
  const pesoTotal = conNotas.reduce((a, c) => a + (Number(c.porcentaje) || 0), 0);
  if (pesoTotal === 0) return null;
  const suma = conNotas.reduce((acc, c) => {
    const valores = porCategoria[c.id] || [];
    const promedioCategoria = valores.reduce((a, v) => a + Number(v), 0) / valores.length;
    return acc + promedioCategoria * (Number(c.porcentaje) || 0);
  }, 0);
  return Math.round((suma / pesoTotal) * 10) / 10;
}

// Estadísticas básicas de un conjunto de notas, para la pestaña Estadísticas.
export function calcularEstadisticas(valores) {
  const n = (valores || []).map(Number).filter((v) => !Number.isNaN(v));
  if (n.length === 0) return { media: null, desviacion: null, mediana: null, min: null, max: null };
  const redondear = (x) => Math.round(x * 10) / 10;
  const media = n.reduce((a, v) => a + v, 0) / n.length;
  const varianza = n.reduce((a, v) => a + (v - media) ** 2, 0) / n.length;
  const ordenados = [...n].sort((a, b) => a - b);
  const mitad = Math.floor(ordenados.length / 2);
  const mediana = ordenados.length % 2 ? ordenados[mitad] : (ordenados[mitad - 1] + ordenados[mitad]) / 2;
  return {
    media: redondear(media),
    desviacion: redondear(Math.sqrt(varianza)),
    mediana: redondear(mediana),
    min: redondear(Math.min(...n)),
    max: redondear(Math.max(...n)),
  };
}

// Categorías de gamificación de las que puede sacar XP una actividad
// "automática" — las mismas áreas que ya existen en el resto de la app.
export const GAM_CATEGORIAS_OPCIONES = [
  { key: "academico", label: "🎓 Académico" },
  { key: "convivencial", label: "🤝 Convivencial" },
  { key: "asistencia", label: "📋 Asistencia" },
  { key: "comarca", label: "🏛️ Comarca de Oakhaven" },
];
