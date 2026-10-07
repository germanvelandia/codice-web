// =====================================================================================
//  SEGUIMIENTO DEL MUNDO — resumen por estudiante (lógica pura, sin base de datos)
//  Recibe las filas ya leídas y devuelve una fila por estudiante: qué ha hecho, qué tan alto está su monstruo
//  y cuánta actividad tuvo en la última semana.
// =====================================================================================
import { nivelDeXp } from "./monstruos";
import { misionVisiblePara } from "../lib/gradosMundo";

export const DIA_MS = 86400000;
export const VENTANA_DIAS = 7;

const tiempo = (v) => { const t = v ? Date.parse(v) : NaN; return Number.isFinite(t) ? t : null; };
const lista = (v) => (Array.isArray(v) ? v : []);

// Una misión / acertijo / secreto cuenta para el estudiante si está activo y es de su curso.
const visibles = (items, grado) => lista(items).filter((x) => x && x.activo !== false && misionVisiblePara(x.grado_id || "", grado));

/**
 * entrada: {
 *   estudiantes: [{id, nombre, apellidos?, grado_id, activo?}],
 *   misiones, acertijos, secretos: catálogos [{id, grado_id, activo}],
 *   eventos: { misiones, acertijos, secretos, llaves, camara, insignias, retos, recoleccion, monstruos, duelosMon, duelos }
 *      cada uno es una lista de { estudiante_id, cuando, ...extras }   (ganado en retos/duelos, xp en monstruos, cantidad en recoleccion)
 *   ahora (ms), dias
 * }
 */
export function resumirSeguimiento({ estudiantes, misiones, acertijos, secretos, eventos = {}, ahora = Date.now(), dias = VENTANA_DIAS } = {}) {
  const desde = ahora - dias * DIA_MS;
  const porEst = (clave) => { const m = new Map(); lista(eventos[clave]).forEach((f) => { if (f == null || f.estudiante_id == null) return; const k = String(f.estudiante_id); if (!m.has(k)) m.set(k, []); m.get(k).push(f); }); return m; };
  const E = {}; ["misiones", "acertijos", "secretos", "llaves", "camara", "insignias", "retos", "recoleccion", "monstruos", "duelosMon", "duelos"].forEach((k) => { E[k] = porEst(k); });
  const de = (k, id) => E[k].get(String(id)) || [];

  const filas = lista(estudiantes).filter((e) => e && e.activo !== 0 && e.activo !== false && e.activo !== "0").map((e) => {
    const grado = e.grado_id || "";
    const propios = ["misiones", "acertijos", "secretos", "llaves", "camara", "insignias", "retos", "recoleccion", "monstruos", "duelosMon", "duelos"].map((k) => de(k, e.id));
    const [mi, ac, se, ll, ca, ins, re, rec, mon, dm, du] = propios;
    let ultima = null, semana = 0;
    propios.forEach((arr) => arr.forEach((f) => { const t = tiempo(f.cuando); if (t == null) return; if (ultima == null || t > ultima) ultima = t; if (t >= desde && t <= ahora + DIA_MS) semana++; }));
    const nivelMax = mon.reduce((m, f) => Math.max(m, nivelDeXp(f.xp).nivel), 0);
    const hechasSet = (arr, clave) => new Set(arr.map((f) => f[clave]).filter((v) => v != null));
    const catM = visibles(misiones, grado), catA = visibles(acertijos, grado), catS = visibles(secretos, grado);
    const cuentaDe = (cat, arr, clave) => { const s = hechasSet(arr, clave), ids = new Set(cat.map((x) => x.id)); return [...s].filter((id) => ids.has(id)).length; };
    const hayMovimiento = ultima != null || mon.length > 0;
    const estado = !hayMovimiento ? "nunca" : semana > 0 ? "activo" : "inactivo";
    const nombre = [e.nombre, e.apellidos].filter(Boolean).join(" ").replace(/\s+/g, " ").trim() || "Estudiante";
    return {
      id: e.id, nombre, grado,
      misiones: cuentaDe(catM, mi, "mision_id") || (catM.length ? 0 : mi.length), misionesTotal: catM.length,
      acertijos: cuentaDe(catA, ac, "acertijo_id") || (catA.length ? 0 : ac.length), acertijosTotal: catA.length,
      secretos: cuentaDe(catS, se, "secreto_id") || (catS.length ? 0 : se.length), secretosTotal: catS.length,
      llaves: new Set(ll.map((f) => f.llave)).size, camara: ca.length > 0,
      insignias: new Set(ins.map((f) => f.zona)).size,
      retos: re.filter((f) => f.ganado).length,
      recogido: rec.reduce((s, f) => s + (Number(f.cantidad) || 0), 0),
      monstruos: mon.length, nivelMonstruo: nivelMax,
      duelosMon: dm.length, victoriasMon: dm.filter((f) => f.ganado).length,
      semana, ultima, estado,
      dias: ultima == null ? null : Math.max(0, Math.floor((ahora - ultima) / DIA_MS)),
    };
  });

  const resumen = { total: filas.length, activos: 0, inactivos: 0, nunca: 0, accionesSemana: 0 };
  filas.forEach((f) => { if (f.estado === "activo") resumen.activos++; else if (f.estado === "inactivo") resumen.inactivos++; else resumen.nunca++; resumen.accionesSemana += f.semana; });
  const grados = [...new Set(filas.map((f) => f.grado).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "es", { numeric: true }));
  return { filas, resumen, grados };
}

export const ORDENES_SEGUIMIENTO = {
  nombre: "Nombre", curso: "Curso", semana: "Actividad de la semana", reciente: "Más reciente", inactivos: "Quien lleva más sin jugar",
  misiones: "Misiones hechas", llaves: "Llaves", monstruo: "Nivel del monstruo",
};

// filtro { grado:'' | '801', estado:'' | 'activo'|'inactivo'|'nunca', texto:'', orden:'nombre' }
export function filtrarSeguimiento(filas, { grado = "", estado = "", texto = "", orden = "nombre" } = {}) {
  const q = String(texto || "").trim().toLowerCase();
  const sinTilde = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const out = lista(filas).filter((f) => (!grado || f.grado === grado) && (!estado || f.estado === estado) && (!q || sinTilde(f.nombre).includes(sinTilde(q))));
  const nom = (a, b) => String(a.nombre).localeCompare(String(b.nombre), "es");
  const cmp = {
    nombre: nom,
    curso: (a, b) => String(a.grado).localeCompare(String(b.grado), "es", { numeric: true }) || nom(a, b),
    semana: (a, b) => b.semana - a.semana || nom(a, b),
    reciente: (a, b) => (b.ultima ?? -1) - (a.ultima ?? -1) || nom(a, b),
    inactivos: (a, b) => (a.ultima ?? -Infinity) - (b.ultima ?? -Infinity) || nom(a, b),
    misiones: (a, b) => b.misiones - a.misiones || nom(a, b),
    llaves: (a, b) => b.llaves - a.llaves || Number(b.camara) - Number(a.camara) || nom(a, b),
    monstruo: (a, b) => b.nivelMonstruo - a.nivelMonstruo || nom(a, b),
  }[orden] || nom;
  return out.sort(cmp);
}

export const ETIQUETA_ESTADO = { activo: "🟢 Jugó esta semana", inactivo: "🟡 Sin jugar esta semana", nunca: "⚪ Nunca ha jugado" };

export function textoUltima(f) {
  if (f.ultima == null) return "—";
  if (f.dias === 0) return "hoy";
  if (f.dias === 1) return "ayer";
  return `hace ${f.dias} días`;
}

// Filas listas para pasar a una hoja de Excel
export function filasParaExcel(filas) {
  return lista(filas).map((f) => ({
    Estudiante: f.nombre, Curso: f.grado, Estado: ETIQUETA_ESTADO[f.estado].replace(/^\S+\s/, ""),
    "Acciones esta semana": f.semana, "Última actividad": textoUltima(f),
    Misiones: `${f.misiones}/${f.misionesTotal}`, Acertijos: `${f.acertijos}/${f.acertijosTotal}`, Secretos: `${f.secretos}/${f.secretosTotal}`,
    Llaves: f.llaves, "Cámara abierta": f.camara ? "Sí" : "No", Insignias: f.insignias, "Retos ganados": f.retos, "Recursos recogidos": f.recogido,
    Monstruos: f.monstruos, "Nivel del monstruo": f.nivelMonstruo || "", "Duelos de monstruos": f.duelosMon, "Victorias de monstruos": f.victoriasMon,
  }));
}
