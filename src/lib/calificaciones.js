// Helpers de cálculo para la planilla de notas — mismas reglas que el prototipo de Claude.

export const CONFIG_DEFAULT = {
  escala_min: 1.0,
  nota_minima: 3.0,
  nota_maxima: 5.0,
  sistema_periodos: "bimestre",
  cantidad_periodos: 4,
};

export function periodosDe(config) {
  const n = config?.cantidad_periodos || 4;
  return Array.from({ length: n }, (_, i) => String(i + 1));
}

export function bandaDesempeno(nota, config) {
  if (nota === null || nota === undefined || isNaN(nota)) return { key: "sinnota", label: "Sin nota", color: "#94A3B8" };
  const { nota_minima, nota_maxima } = config;
  if (nota < nota_minima) return { key: "bajo", label: "Bajo", color: "#EF4444" };
  const rango = nota_maxima - nota_minima;
  if (nota < nota_minima + rango * 0.33) return { key: "basico", label: "Básico", color: "#F59E0B" };
  if (nota < nota_minima + rango * 0.66) return { key: "alto", label: "Alto", color: "#22C55E" };
  return { key: "superior", label: "Superior", color: "#16A34A" };
}

export function round1(n) { return Math.round(n * 10) / 10; }
export function round2(n) { return Math.round(n * 100) / 100; }

export function notaAutomatica(xpAcumulado, xpMeta, config) {
  const meta = xpMeta && xpMeta > 0 ? xpMeta : 50;
  const fraccion = Math.max(0, Math.min(1, xpAcumulado / meta));
  const nota = config.nota_minima + fraccion * (config.nota_maxima - config.nota_minima);
  return round1(nota);
}

export function notaFinalPonderada(valoresPorCategoria, categorias) {
  let sumaPeso = 0;
  let sumaPonderada = 0;
  categorias.forEach((c) => {
    const valores = valoresPorCategoria[c.id] || [];
    if (valores.length === 0) return;
    const promedioCat = valores.reduce((a, b) => a + b, 0) / valores.length;
    sumaPonderada += promedioCat * c.porcentaje;
    sumaPeso += c.porcentaje;
  });
  if (sumaPeso === 0) return null;
  return round1(sumaPonderada / sumaPeso);
}

export function calcularEstadisticas(valores) {
  const v = valores.filter((x) => x !== null && x !== undefined && !isNaN(x));
  const n = v.length;
  if (n === 0) return { n: 0, media: null, desviacion: null, mediana: null, min: null, max: null };
  const media = v.reduce((a, b) => a + b, 0) / n;
  const varianza = v.reduce((a, b) => a + Math.pow(b - media, 2), 0) / n;
  const desviacion = Math.sqrt(varianza);
  const orden = [...v].sort((a, b) => a - b);
  const mediana = n % 2 === 0 ? (orden[n / 2 - 1] + orden[n / 2]) / 2 : orden[(n - 1) / 2];
  return { n, media: round2(media), desviacion: round2(desviacion), mediana: round1(mediana), min: orden[0], max: orden[n - 1] };
}

export const GAM_CATEGORIAS_OPCIONES = [
  { key: "academico", label: "Académico (general)" },
  { key: "convivencial", label: "Convivencial (general)" },
  { key: "respeto", label: "Pilar: Respeto" },
  { key: "responsabilidad", label: "Pilar: Responsabilidad" },
  { key: "confiabilidad", label: "Pilar: Confiabilidad" },
  { key: "justicia", label: "Pilar: Justicia" },
  { key: "solidaridad", label: "Pilar: Solidaridad" },
  { key: "ciudadania", label: "Pilar: Ciudadanía" },
];
