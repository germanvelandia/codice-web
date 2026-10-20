// Reglas puras de las tareas: penalización por retraso, nota mínima y estado de la fecha.
const r1 = (x) => Math.round(x * 10) / 10;

// Nota después de restar la penalización por días de retraso.
// tarea: { penalizacion_dia, penalizacion_tope }. Nunca baja de la nota mínima de la escala.
export function aplicarPenalizacion(nota, dias, tarea, escalaMin = 1) {
  const n = Number(nota);
  if (nota === null || nota === undefined || nota === "" || Number.isNaN(n)) return nota;
  const d = Math.max(0, Number(dias) || 0);
  const porDia = Number(tarea?.penalizacion_dia) || 0;
  if (d === 0 || porDia <= 0) return n;
  let resta = d * porDia;
  const tope = Number(tarea?.penalizacion_tope);
  if (tope > 0) resta = Math.min(resta, tope);
  return r1(Math.max(Number(escalaMin) || 1, n - resta));
}

export function bajoMinima(nota, tarea) {
  const min = Number(tarea?.nota_minima);
  if (!(min > 0) || nota === null || nota === undefined || nota === "") return false;
  return Number(nota) < min;
}

const aFecha = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null; };

// Estado de la fecha de una tarea respecto a "hoy". Usa la fecha límite; si no hay, la de entrega.
export function estadoFecha(tarea, hoy = new Date()) {
  const limite = aFecha(tarea?.fecha_limite) || aFecha(tarea?.fecha_entrega);
  if (!limite) return { tipo: "sin_fecha" };
  const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const dias = Math.round((limite - h) / 86400000);
  const esLimite = !!aFecha(tarea?.fecha_limite);
  if (dias > 0) return { tipo: "faltan", dias, esLimite };
  if (dias === 0) return { tipo: "hoy", dias: 0, esLimite };
  return { tipo: "vencida", dias: -dias, esLimite };
}

// Texto corto de la penalización, para mostrar a docente y estudiante.
export function textoPenalizacion(tarea) {
  const porDia = Number(tarea?.penalizacion_dia) || 0;
  if (porDia <= 0) return "";
  const tope = Number(tarea?.penalizacion_tope);
  return `−${porDia} por día de retraso${tope > 0 ? ` (máx. −${tope})` : ""}`;
}
