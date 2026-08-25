// Utilidades de cálculo para el módulo de Calificaciones — sin JSX, solo
// funciones puras y constantes, usadas tanto por la pantalla de Calificaciones
// como por api.js.

export const CONFIG_DEFAULT = {
  escala_min: 1.0,
  nota_minima: 3.5,
  nota_maxima: 5.0,
  sistema_periodos: "bimestre",
  cantidad_periodos: 4,
  periodo_actual: "1",
};

// Lista de periodos ("1", "2", "3"...) según la cantidad configurada.
export function periodosDe(config) {
  const cantidad = config?.cantidad_periodos || 4;
  return Array.from({ length: cantidad }, (_, i) => String(i + 1));
}

// Bandas de desempeño (Bajo/Básico/Alto/Superior) — el rango entre la nota
// mínima aprobatoria y la nota máxima se reparte en tres tramos iguales
// para básico/alto/superior; por debajo de la nota mínima es "Bajo".
const BANDAS = [
  { key: "bajo", label: "Bajo", color: "#EF4444" },
  { key: "basico", label: "Básico", color: "#F59E0B" },
  { key: "alto", label: "Alto", color: "#3B82F6" },
  { key: "superior", label: "Superior", color: "#22C55E" },
];

export function bandaDesempeno(valor, config) {
  if (valor === null || valor === undefined || isNaN(valor)) {
    return { key: null, label: "—", color: "#94A3B8" };
  }
  const min = config?.nota_minima ?? CONFIG_DEFAULT.nota_minima;
  const max = config?.nota_maxima ?? CONFIG_DEFAULT.nota_maxima;
  if (valor < min) return BANDAS[0];
  const rango = max - min;
  if (rango <= 0) return BANDAS[3];
  const proporcion = (valor - min) / rango;
  if (proporcion < 1 / 3) return BANDAS[1];
  if (proporcion < 2 / 3) return BANDAS[2];
  return BANDAS[3];
}

// Nota calculada automáticamente a partir del XP acumulado en una categoría
// de gamificación, proporcional a la meta de XP de la actividad.
export function notaAutomatica(xp, xpMeta, config) {
  const min = config?.escala_min ?? CONFIG_DEFAULT.escala_min;
  const max = config?.nota_maxima ?? CONFIG_DEFAULT.nota_maxima;
  if (!xpMeta || xpMeta <= 0) return min;
  const proporcion = Math.min(1, Math.max(0, xp / xpMeta));
  return Math.round((min + proporcion * (max - min)) * 10) / 10;
}

// Nota final ponderada: promedia las notas dentro de cada categoría, y
// combina esos promedios según el porcentaje de cada categoría — si una
// categoría todavía no tiene ninguna nota, no cuenta (se reparte el peso
// entre las que sí tienen).
export function notaFinalPonderada(porCategoria, categorias) {
  let sumaPonderada = 0;
  let pesoTotal = 0;
  (categorias || []).forEach((cat) => {
    const valores = porCategoria[cat.id];
    if (!valores || valores.length === 0) return;
    const promedio = valores.reduce((a, v) => a + v, 0) / valores.length;
    const peso = (cat.porcentaje || 0) / 100;
    sumaPonderada += promedio * peso;
    pesoTotal += peso;
  });
  if (pesoTotal === 0) return null;
  return Math.round((sumaPonderada / pesoTotal) * 10) / 10;
}

// Estadísticas básicas de un conjunto de notas.
export function calcularEstadisticas(valores) {
  if (!valores || valores.length === 0) {
    return { media: null, desviacion: null, mediana: null, min: null, max: null };
  }
  const ordenados = [...valores].sort((a, b) => a - b);
  const media = valores.reduce((a, v) => a + v, 0) / valores.length;
  const varianza = valores.reduce((a, v) => a + Math.pow(v - media, 2), 0) / valores.length;
  const desviacion = Math.sqrt(varianza);
  const mitad = Math.floor(ordenados.length / 2);
  const mediana = ordenados.length % 2 !== 0 ? ordenados[mitad] : (ordenados[mitad - 1] + ordenados[mitad]) / 2;
  return {
    media: Math.round(media * 10) / 10,
    desviacion: Math.round(desviacion * 10) / 10,
    mediana: Math.round(mediana * 10) / 10,
    min: Math.round(ordenados[0] * 10) / 10,
    max: Math.round(ordenados[ordenados.length - 1] * 10) / 10,
  };
}

// Categorías de gamificación disponibles para actividades automáticas.
export const GAM_CATEGORIAS_OPCIONES = [
  { key: "academico", label: "Académico" },
  { key: "convivencial", label: "Convivencial" },
  { key: "participacion", label: "Participación" },
  { key: "asistencia", label: "Asistencia" },
];
