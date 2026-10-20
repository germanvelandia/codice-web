// Bono de participación: suma hasta `bono_max` a la nota final, proporcional al XP ganado.
const r1 = (x) => Math.round(x * 10) / 10;

// cfg: { bono_max, xp_meta, activo }. xp: XP del estudiante en la categoría/ventana elegida.
export function calcularBono(cfg, xp) {
  if (!cfg || cfg.activo === false) return 0;
  const max = Number(cfg.bono_max) || 0, meta = Number(cfg.xp_meta) || 0;
  if (max <= 0 || meta <= 0) return 0;
  const proporcion = Math.min(1, Math.max(0, Number(xp) || 0) / meta);
  return r1(max * proporcion);
}

// Nota con bono, sin pasar nunca de la nota máxima de la escala.
export function aplicarBono(nota, bono, notaMaxima = 5) {
  if (nota === null || nota === undefined || nota === "" || Number.isNaN(Number(nota))) return nota;
  const b = Number(bono) || 0;
  if (b <= 0) return Number(nota);
  return Math.min(Number(notaMaxima) || 5, r1(Number(nota) + b));
}
