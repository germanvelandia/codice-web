// Proyección de nota para el estudiante: "¿cuánto necesito en lo que falta?"
// Usa la misma regla del docente (notaFinalPonderada): una categoría sin ninguna
// nota todavía no cuenta; cuando llegan sus notas, el 100% se reparte entre todas.
import { notaFinalPonderada } from "./calificaciones";

const r1 = (x) => Math.round(x * 10) / 10;
const sube1 = (x) => Math.ceil(x * 10 - 1e-9) / 10; // redondea hacia arriba a 1 decimal

// categorias: [{ id, nombre, porcentaje }] de la materia
// valores: [{ categoria_id, valor }] del periodo (solo notas numéricas)
export function calcularProyeccion(categorias, valores, { notaMinima = 3.5, notaMinimaEscala = 1, notaMaxima = 5 } = {}) {
  const cats = (categorias || []).filter((c) => Number(c.porcentaje) > 0);
  const porCategoria = {};
  (valores || []).forEach((v) => {
    const n = Number(v.valor);
    if (v.valor === null || v.valor === "" || Number.isNaN(n) || v.categoria_id == null) return;
    (porCategoria[v.categoria_id] = porCategoria[v.categoria_id] || []).push(n);
  });

  const filas = cats.map((c) => {
    const vs = porCategoria[c.id] || [];
    const promedio = vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
    return { id: c.id, nombre: c.nombre, porcentaje: Number(c.porcentaje), promedio: promedio === null ? null : r1(promedio), cantidad: vs.length, _prom: promedio };
  });

  const conNotas = filas.filter((f) => f.cantidad > 0);
  const pendientes = filas.filter((f) => f.cantidad === 0);
  const notaActual = notaFinalPonderada(porCategoria, cats);
  const W = filas.reduce((a, f) => a + f.porcentaje, 0);
  const S = conNotas.reduce((a, f) => a + f._prom * f.porcentaje, 0);
  const pesoPend = pendientes.reduce((a, f) => a + f.porcentaje, 0);
  const salida = { filas: filas.map(({ _prom, ...f }) => f), notaActual, pendientes: pendientes.map((f) => f.nombre), pesoPendiente: pesoPend };

  if (notaActual === null) return { ...salida, tipo: "sin_notas" };
  if (pesoPend === 0 || W === 0) return { ...salida, tipo: "sin_pendientes" };

  const final = (x) => r1((S + pesoPend * x) / W);
  const peor = final(notaMinimaEscala), mejor = final(notaMaxima);
  const necesario = ((notaMinima - 0.05) * W - S) / pesoPend; // 3.45 ya se redondea a 3.5
  const base = { ...salida, peor, mejor };

  if (peor >= notaMinima) return { ...base, tipo: "asegurado" };
  if (mejor < notaMinima) return { ...base, tipo: "imposible" };
  return { ...base, tipo: "necesita", necesario: sube1(necesario) };
}
