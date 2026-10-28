import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import * as api from "../lib/api";
import { nivelYCurso } from "../lib/gamification";
import {
  GRUPOS_BLOQUE, TIPOS, nuevoContenido, EditorBloque, VistaBloque, htmlBloque, resumenBloque, esAutocorregible, evaluarPregunta, esc,
} from "./BloquesLibro";

/* =====================================================================
   Libros de estudio: libro → capítulos → partes (📖 Libro, 📝 Guía, 🎒 Clase)
   → elementos de aprendizaje. Reemplaza a las antiguas «Guías de estudio».
   ===================================================================== */

const PARTES = [
  { key: "libro", label: "Libro", icono: "📖", ayuda: "La lectura del capítulo: explicaciones, imágenes, videos, glosario…" },
  { key: "guia", label: "Guía", icono: "📝", ayuda: "El trabajo del estudiante: preguntas, actividades y autoevaluación." },
  { key: "clase", label: "Material para la clase", icono: "🎒", ayuda: "Lo que usas en el aula: apoyos, ejemplos, preguntas para el debate." },
];

/* ---------------- acceso a datos ---------------- */
const uidActual = async () => (await supabase.auth.getUser()).data?.user?.id || null;
const ordenar = (a) => [...a].sort((x, y) => (x.orden - y.orden) || (x.id - y.id));

async function fetchLibros(materiaId, gradoId, periodo) {
  const uid = await uidActual();
  let q = supabase.from("libros_estudio").select("*, libro_capitulos(id)").eq("docente_id", uid).eq("materia_id", materiaId).eq("grado_id", gradoId);
  if (periodo) q = q.eq("periodo", periodo);
  const { data, error } = await q.order("creado_en", { ascending: false });
  if (error) throw error;
  return data || [];
}
async function fetchLibrosParaGrado(gradoId) {
  const { data, error } = await supabase.from("libros_estudio").select("*, materias(nombre), libro_capitulos(id)").eq("grado_id", gradoId).eq("publicada", true).order("creado_en", { ascending: false });
  if (error) throw error;
  return data || [];
}
async function fetchLibroCompleto(id) {
  const { data: libro, error } = await supabase.from("libros_estudio").select("*, materias(nombre)").eq("id", id).single();
  if (error) throw error;
  const { data: caps, error: e2 } = await supabase.from("libro_capitulos").select("*").eq("libro_id", id);
  if (e2) throw e2;
  const ids = (caps || []).map((c) => c.id);
  let bloques = [];
  if (ids.length) { const { data, error: e3 } = await supabase.from("libro_bloques").select("*").in("capitulo_id", ids); if (e3) throw e3; bloques = data || []; }
  return { libro, capitulos: ordenar(caps || []), bloques: ordenar(bloques) };
}
const ok = (r) => { if (r.error) throw r.error; return r.data; };
const crearLibro = async (campos) => ok(await supabase.from("libros_estudio").insert({ ...campos, docente_id: await uidActual() }).select().single());
const editarLibro = async (id, campos) => ok(await supabase.from("libros_estudio").update({ ...campos, actualizado_en: new Date().toISOString() }).eq("id", id));
const eliminarLibro = async (id) => ok(await supabase.from("libros_estudio").delete().eq("id", id));
const crearCapitulo = async (campos) => ok(await supabase.from("libro_capitulos").insert(campos).select().single());
const editarCapitulo = async (id, campos) => ok(await supabase.from("libro_capitulos").update(campos).eq("id", id));
const eliminarCapitulo = async (id) => ok(await supabase.from("libro_capitulos").delete().eq("id", id));
const crearBloque = async (campos) => ok(await supabase.from("libro_bloques").insert(campos).select().single());
const editarBloque = async (id, campos) => ok(await supabase.from("libro_bloques").update(campos).eq("id", id));
const eliminarBloque = async (id) => ok(await supabase.from("libro_bloques").delete().eq("id", id));

async function duplicarLibro(origenId, destino) {
  const { libro, capitulos, bloques } = await fetchLibroCompleto(origenId);
  const nuevo = await crearLibro({
    materia_id: destino.materia_id, grado_id: destino.grado_id, periodo: destino.periodo, titulo: `${libro.titulo} (copia)`,
    descripcion: libro.descripcion, tiempo_estimado: libro.tiempo_estimado, fecha_entrega: null, publicada: false,
  });
  for (const c of capitulos) {
    const cap = await crearCapitulo({ libro_id: nuevo.id, orden: c.orden, titulo: c.titulo, resumen: c.resumen, clase_visible: c.clase_visible });
    const filas = bloques.filter((b) => b.capitulo_id === c.id).map((b) => ({ capitulo_id: cap.id, parte: b.parte, orden: b.orden, tipo: b.tipo, contenido: b.contenido }));
    if (filas.length) ok(await supabase.from("libro_bloques").insert(filas));
  }
  return nuevo;
}

async function fetchProgreso(libroId, estudianteId) {
  const { data, error } = await supabase.from("libro_progreso").select("datos").eq("libro_id", libroId).eq("estudiante_id", estudianteId).maybeSingle();
  if (error) throw error;
  return data?.datos || {};
}
async function guardarProgreso(libroId, estudianteId, datos) {
  const { error } = await supabase.from("libro_progreso").upsert({ libro_id: libroId, estudiante_id: estudianteId, datos, actualizado_en: new Date().toISOString() }, { onConflict: "libro_id,estudiante_id" });
  if (error) throw error;
}

/* ---------------- impresión ---------------- */
function imprimirLibro({ libro, capitulos, bloques }, institucion, partes) {
  const cuerpo = capitulos.map((c, i) => {
    const secciones = PARTES.filter((p) => partes.includes(p.key)).map((p) => {
      const bs = bloques.filter((b) => b.capitulo_id === c.id && b.parte === p.key);
      if (!bs.length) return "";
      return `<h3 class="parte">${p.icono} ${esc(p.label)}</h3>${bs.map((b) => `<div class="bloque">${htmlBloque(b)}</div>`).join("")}`;
    }).join("");
    return `<section><h1>Capítulo ${i + 1}: ${esc(c.titulo)}</h1>${c.resumen ? `<p><i>${esc(c.resumen)}</i></p>` : ""}${secciones}</section>`;
  }).join("");
  const w = window.open("", "_blank");
  if (!w) { alert("El navegador bloqueó la ventana. Permite las ventanas emergentes para imprimir."); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(libro.titulo)}</title><style>
    @page{margin:15mm} body{font-family:Georgia,serif;color:#1a1a2e;font-size:13px;line-height:1.5}
    header{display:flex;align-items:center;gap:12px;border-bottom:2px solid #17264D;padding-bottom:8px;margin-bottom:14px} header img{height:52px} header div{flex:1;text-align:center}
    h1{font-size:19px;color:#17264D;margin:18px 0 4px;page-break-after:avoid} h2{font-size:16px;color:#17264D;border-bottom:1px solid #B8892B;padding-bottom:2px} h3{font-size:14px;color:#2F55A4}
    h3.parte{background:#E8EEF8;padding:4px 8px;border-radius:4px;margin-top:14px} .bloque{margin:8px 0;page-break-inside:avoid}
    .caja{border:1px solid #bbb;border-radius:6px;padding:8px 10px;background:#fafafa} .lineas{height:70px;background:repeating-linear-gradient(transparent,transparent 22px,#999 23px)}
    table{border-collapse:collapse;width:100%;margin:4px 0} th{background:#17264D;color:#fff;padding:5px;text-align:left} td{border:1px solid #bbb;padding:5px;vertical-align:top}
    blockquote{border-left:4px solid #B8892B;margin:6px 0;padding:6px 12px;background:#fbf8ef;font-style:italic} figure{text-align:center;margin:6px 0} figcaption{font-size:11px;color:#555}
    section{page-break-before:always} section:first-of-type{page-break-before:auto}
  </style></head><body>
    <header>${institucion?.logo_url ? `<img src="${esc(institucion.logo_url)}">` : ""}<div><b>${esc(institucion?.nombre || "")}</b><br>${esc(libro.materias?.nombre || "")}${libro.periodo ? ` · Periodo ${esc(libro.periodo)}` : ""}</div></header>
    <h1 style="font-size:24px;text-align:center">${esc(libro.titulo)}</h1>${libro.descripcion ? `<p style="text-align:center"><i>${esc(libro.descripcion)}</i></p>` : ""}
    <p style="text-align:center;font-size:11px">Nombre: ________________________________ Curso: ________ Fecha: ____________</p>
    ${cuerpo}<script>window.onload=()=>setTimeout(()=>window.print(),600)</script></body></html>`);
  w.document.close();
}

/* ---------------- lector (estudiante y vista previa) ---------------- */
function LectorLibro({ datosLibro, estudianteId, onVolver, vistaPrevia = false, institucion }) {
  const { libro, capitulos, bloques } = datosLibro;
  const [capIdx, setCapIdx] = useState(0);
  const [parte, setParte] = useState("libro");
  const [datos, setDatos] = useState({ r: {}, hechos: [] });
  const [cargado, setCargado] = useState(!estudianteId);
  const temporizador = useRef(null);
  const cap = capitulos[capIdx];

  useEffect(() => {
    if (!estudianteId) return;
    fetchProgreso(libro.id, estudianteId).then((d) => { setDatos({ r: d.r || {}, hechos: d.hechos || [] }); setCargado(true); }).catch(() => setCargado(true));
  }, [libro.id, estudianteId]);

  const persistir = (nuevo) => {
    setDatos(nuevo);
    if (!estudianteId) return;
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => guardarProgreso(libro.id, estudianteId, nuevo).catch(() => {}), 800);
  };
  useEffect(() => () => clearTimeout(temporizador.current), []);

  const partesVisibles = PARTES.filter((p) => p.key !== "clase" || cap?.clase_visible || vistaPrevia).filter((p) => bloques.some((b) => b.capitulo_id === cap?.id && b.parte === p.key) || p.key !== "clase");
  useEffect(() => { if (!partesVisibles.some((p) => p.key === parte)) setParte("libro"); }, [capIdx]);
  const bs = bloques.filter((b) => b.capitulo_id === cap?.id && b.parte === parte);
  const hecho = (id) => datos.hechos.includes(id);
  const alternarHecho = () => persistir({ ...datos, hechos: hecho(cap.id) ? datos.hechos.filter((x) => x !== cap.id) : [...datos.hechos, cap.id] });
  const pct = capitulos.length ? Math.round((capitulos.filter((c) => hecho(c.id)).length / capitulos.length) * 100) : 0;

  const autos = bloques.filter((b) => esAutocorregible(b.tipo));
  const aciertos = autos.filter((b) => evaluarPregunta(b, datos.r[b.id]).ok === true).length;

  if (!cargado) return <p className="text-sm text-slate-400">Cargando…</p>;
  if (!cap) return <div><button onClick={onVolver} className="text-sm text-violet-500 mb-3">← Volver</button><p className="text-sm text-slate-400">Este libro todavía no tiene capítulos.</p></div>;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <button onClick={onVolver} className="text-sm text-violet-500">← Volver</button>
        <button onClick={() => imprimirLibro(datosLibro, institucion, vistaPrevia ? ["libro", "guia", "clase"] : ["libro", "guia"])} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">🖨️ Imprimir / PDF</button>
      </div>
      {vistaPrevia && <div className="text-[11px] bg-amber-50 text-amber-700 rounded-lg px-3 py-1.5 mb-2">👁 Vista previa: así lo ve el estudiante. Lo que respondas aquí no se guarda.</div>}
      <div className="rounded-2xl p-4 mb-3 text-white" style={{ background: "linear-gradient(135deg,#17264D,#2F55A4)" }}>
        <div className="text-[10px] font-bold tracking-wide uppercase opacity-70">{libro.materias?.nombre}{libro.tiempo_estimado ? ` · ⏱ ${libro.tiempo_estimado}` : ""}{libro.fecha_entrega ? ` · 📅 Entrega ${libro.fecha_entrega}` : ""}</div>
        <h2 className="text-xl font-extrabold leading-tight">{libro.titulo}</h2>
        {libro.descripcion && <p className="text-xs opacity-80 mt-1">{libro.descripcion}</p>}
        <div className="mt-2 flex items-center gap-2"><div className="flex-1 h-2 rounded-full bg-white/20 overflow-hidden"><div className="h-full" style={{ width: `${pct}%`, background: "#F5C451" }} /></div><span className="text-[11px] font-bold">{pct}%</span></div>
        {autos.length > 0 && <div className="text-[11px] opacity-80 mt-1">Preguntas de práctica correctas: {aciertos} de {autos.length}</div>}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2">
        {capitulos.map((c, i) => (
          <button key={c.id} onClick={() => setCapIdx(i)} className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border ${i === capIdx ? "bg-[#2F55A4] text-white border-[#2F55A4]" : "bg-white text-slate-600 border-slate-200"}`}>
            {hecho(c.id) ? "✅ " : ""}{i + 1}. {c.titulo}</button>))}
      </div>

      <h3 className="text-base font-extrabold text-[#17264D]">Capítulo {capIdx + 1}: {cap.titulo}</h3>
      {cap.resumen && <p className="text-xs text-slate-500 mb-2">{cap.resumen}</p>}
      <div className="flex gap-1.5 mb-3">{partesVisibles.map((p) => (
        <button key={p.key} onClick={() => setParte(p.key)} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${parte === p.key ? "bg-[#17264D] text-white border-[#17264D]" : "bg-white text-slate-600 border-slate-200"}`}>{p.icono} {p.label}</button>))}</div>

      {bs.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">Esta parte todavía no tiene contenido.</p> : (
        <div className="space-y-3">{bs.map((b) => <VistaBloque key={b.id} bloque={b} estado={datos.r[b.id]} onEstado={(e) => persistir({ ...datos, r: { ...datos.r, [b.id]: e } })} />)}</div>)}

      <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-100">
        <button disabled={capIdx === 0} onClick={() => { setCapIdx(capIdx - 1); window.scrollTo?.({ top: 0 }); }} className="text-xs font-semibold px-3 py-2 rounded-full border border-slate-200 text-slate-600 disabled:opacity-30">← Anterior</button>
        <button onClick={alternarHecho} className={`text-xs font-bold px-4 py-2 rounded-full ${hecho(cap.id) ? "bg-emerald-100 text-emerald-700" : "bg-emerald-500 text-white"}`}>{hecho(cap.id) ? "✅ Capítulo terminado" : "Marcar capítulo como terminado"}</button>
        <button disabled={capIdx === capitulos.length - 1} onClick={() => { setCapIdx(capIdx + 1); window.scrollTo?.({ top: 0 }); }} className="text-xs font-semibold px-3 py-2 rounded-full border border-slate-200 text-slate-600 disabled:opacity-30">Siguiente →</button>
      </div>
    </div>
  );
}

/* ---------------- estudiante ---------------- */
export function GuiasEstudiante({ gradoId, estudianteId }) {
  const [libros, setLibros] = useState([]);
  const [progresos, setProgresos] = useState({});
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState(null);
  const [cargandoLibro, setCargandoLibro] = useState(false);
  const [institucion, setInstitucion] = useState(null);

  useEffect(() => {
    if (!gradoId) return;
    fetchLibrosParaGrado(gradoId).then(async (d) => {
      setLibros(d); setCargando(false);
      if (estudianteId && d.length) {
        const { data } = await supabase.from("libro_progreso").select("libro_id, datos").eq("estudiante_id", estudianteId).in("libro_id", d.map((l) => l.id));
        setProgresos(Object.fromEntries((data || []).map((p) => [p.libro_id, p.datos])));
      }
    }).catch(() => setCargando(false));
    api.fetchInstitucion().then(setInstitucion).catch(() => {});
  }, [gradoId, estudianteId, abierto]);

  const abrir = async (l) => { setCargandoLibro(true); try { setAbierto(await fetchLibroCompleto(l.id)); } catch (e) { alert("No se pudo abrir: " + e.message); } setCargandoLibro(false); };

  if (abierto) return <LectorLibro datosLibro={abierto} estudianteId={estudianteId} onVolver={() => setAbierto(null)} institucion={institucion} />;
  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;
  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-3">📘 Libros y guías de estudio</h3>
      {libros.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">Todavía no hay libros de estudio publicados.</p> : (
        <div className="grid sm:grid-cols-2 gap-3">
          {libros.map((l) => {
            const n = l.libro_capitulos?.length || 0; const h = progresos[l.id]?.hechos?.length || 0; const pct = n ? Math.round((h / n) * 100) : 0;
            return (
              <button key={l.id} disabled={cargandoLibro} onClick={() => abrir(l)} className="text-left rounded-2xl overflow-hidden border border-slate-200 bg-white hover:shadow-md transition-shadow">
                <div className="px-3 py-3 text-white" style={{ background: "linear-gradient(135deg,#17264D,#2F55A4)" }}>
                  <div className="text-[10px] font-bold uppercase tracking-wide opacity-70">{l.materias?.nombre}</div>
                  <div className="text-base font-extrabold leading-tight">📘 {l.titulo}</div></div>
                <div className="p-3">
                  {l.descripcion && <p className="text-xs text-slate-500 mb-2 line-clamp-2">{l.descripcion}</p>}
                  <div className="text-[11px] text-slate-400 mb-1.5">{n} capítulo(s){l.tiempo_estimado ? ` · ⏱ ${l.tiempo_estimado}` : ""}{l.fecha_entrega ? ` · 📅 ${l.fecha_entrega}` : ""}</div>
                  <div className="flex items-center gap-2"><div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} /></div><span className="text-[10px] font-bold text-slate-500">{pct}%</span></div>
                </div></button>);
          })}
        </div>)}
    </div>
  );
}

/* ---------------- docente: bloque ---------------- */
function BloqueCard({ bloque, indice, total, onMover, onEliminar, onDuplicar, onCambio, abiertoInicial }) {
  const [abierto, setAbierto] = useState(!!abiertoInicial);
  const [c, setC] = useState(bloque.contenido || {});
  const [estado, setEstado] = useState("guardado");
  const [vistaEst, setVistaEst] = useState({});
  const sucio = useRef(false); const temp = useRef(null); const ultimo = useRef(c);
  const t = TIPOS[bloque.tipo] || { label: bloque.tipo, icono: "▫️" };

  const guardarYa = async () => { if (!sucio.current) return; sucio.current = false; setEstado("guardando"); try { await editarBloque(bloque.id, { contenido: ultimo.current }); onCambio(bloque.id, ultimo.current); setEstado("guardado"); } catch { setEstado("error"); sucio.current = true; } };
  const set = (parcial) => { const nuevo = { ...ultimo.current, ...parcial }; ultimo.current = nuevo; setC(nuevo); sucio.current = true; setEstado("pendiente"); clearTimeout(temp.current); temp.current = setTimeout(guardarYa, 900); };
  useEffect(() => () => { clearTimeout(temp.current); guardarYa(); }, []);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
        <span className="text-base">{t.icono}</span>
        <div className="min-w-0 flex-1"><div className="text-[11px] font-bold text-slate-500">{t.label}</div>{!abierto && <div className="text-[11px] text-slate-400 truncate">{resumenBloque({ contenido: c })}</div>}</div>
        <span className={`text-[10px] ${estado === "error" ? "text-rose-500" : "text-slate-300"}`}>{estado === "guardando" || estado === "pendiente" ? "Guardando…" : estado === "error" ? "No se guardó" : "✓"}</span>
        <button onClick={() => onMover(-1)} disabled={indice === 0} className="text-xs text-slate-400 disabled:opacity-20 px-1" title="Subir">↑</button>
        <button onClick={() => onMover(1)} disabled={indice === total - 1} className="text-xs text-slate-400 disabled:opacity-20 px-1" title="Bajar">↓</button>
        <button onClick={() => { guardarYa(); onDuplicar(); }} className="text-xs px-1" title="Duplicar">⧉</button>
        <button onClick={() => setAbierto((v) => !v)} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${abierto ? "bg-violet-500 text-white" : "bg-violet-50 text-violet-600"}`}>{abierto ? "Listo" : "✏️ Editar"}</button>
        <button onClick={onEliminar} className="text-xs px-1" title="Eliminar">🗑</button>
      </div>
      <div className="p-3">
        {abierto ? <EditorBloque tipo={bloque.tipo} c={c} set={set} /> : <VistaBloque bloque={{ ...bloque, contenido: c }} estado={vistaEst[bloque.id]} onEstado={(e) => setVistaEst((p) => ({ ...p, [bloque.id]: e }))} />}
      </div>
    </div>
  );
}

function SelectorElemento({ onElegir, onBanco, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-xl max-h-[88vh] overflow-y-auto p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-800">➕ Agregar un elemento de aprendizaje</h3><button onClick={onClose} className="text-slate-400">✕</button></div>
        {GRUPOS_BLOQUE.map((g) => (
          <div key={g.key} className="mb-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">{g.label}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {g.tipos.map((k) => <button key={k} onClick={() => onElegir(k)} className="flex items-center gap-2 text-left rounded-xl border border-slate-200 px-2.5 py-2 hover:border-violet-300 hover:bg-violet-50"><span className="text-lg">{TIPOS[k].icono}</span><span className="text-[12px] font-semibold text-slate-700 leading-tight">{TIPOS[k].label}</span></button>)}
              {g.key === "preguntas" && <button onClick={onBanco} className="flex items-center gap-2 text-left rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 px-2.5 py-2"><span className="text-lg">🗂️</span><span className="text-[12px] font-semibold text-amber-800 leading-tight">Traer del Banco de Preguntas</span></button>}
            </div>
          </div>))}
      </div>
    </div>
  );
}

function BancoModal({ materiaId, gradoId, onClose, onAgregar }) {
  const { nivel } = nivelYCurso(gradoId || "");
  const [lista, setLista] = useState([]); const [cargando, setCargando] = useState(true);
  const [tema, setTema] = useState(""); const [periodo, setPeriodo] = useState(""); const [q, setQ] = useState(""); const [sel, setSel] = useState([]);
  const sinT = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  useEffect(() => { api.fetchBancoPreguntas(materiaId, null, null).then((d) => { setLista(d.filter((p) => !nivel || String(p.nivel || "").trim() === String(nivel))); setCargando(false); }).catch(() => setCargando(false)); }, []);
  const temas = useMemo(() => Array.from(new Set(lista.map((p) => (p.tema || "").trim()).filter(Boolean))).sort(), [lista]);
  const vis = lista.filter((p) => (!tema || (p.tema || "").trim() === tema) && (!periodo || p.periodo === periodo) && (!q.trim() || sinT(p.enunciado).includes(sinT(q))));
  const cls = "text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white";
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
        <div className="p-4 border-b border-slate-100"><h3 className="font-bold text-slate-800 mb-2">🗂️ Traer del Banco de Preguntas{nivel ? ` (grado ${nivel}°)` : ""}</h3>
          <div className="flex flex-wrap gap-2"><select value={tema} onChange={(e) => setTema(e.target.value)} className={cls}><option value="">Todos los temas</option>{temas.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className={cls}><option value="">Todo periodo</option><option value="T1">Trimestre 1</option><option value="T2">Trimestre 2</option><option value="T3">Trimestre 3</option><option value="REC">Recuperación</option></select>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Buscar…" className={cls + " flex-1 min-w-[8rem]"} /></div>
          <div className="text-xs text-slate-500 mt-2">{vis.length} pregunta(s) · {sel.length} elegida(s) <button onClick={() => setSel(Array.from(new Set([...sel, ...vis.map((p) => p.id)])))} className="text-violet-500 ml-2">Elegir todas las visibles</button></div></div>
        <div className="p-3 overflow-y-auto flex-1 space-y-1.5">{cargando ? <p className="text-sm text-slate-400 text-center py-6">Cargando…</p> : vis.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">No hay preguntas con ese filtro.</p> : vis.map((p) => (
          <label key={p.id} className={`flex items-start gap-2 rounded-lg border p-2 cursor-pointer ${sel.includes(p.id) ? "border-violet-400 bg-violet-50/50" : "border-slate-200"}`}>
            <input type="checkbox" checked={sel.includes(p.id)} onChange={() => setSel((a) => a.includes(p.id) ? a.filter((x) => x !== p.id) : [...a, p.id])} className="mt-1" />
            <div className="min-w-0"><div className="text-[10px] text-violet-600">{p.tema}</div><p className="text-xs text-slate-700">{p.enunciado}</p></div></label>))}</div>
        <div className="p-3 border-t border-slate-100 flex justify-end gap-2"><button onClick={onClose} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
          <button disabled={!sel.length} onClick={() => onAgregar(lista.filter((p) => sel.includes(p.id)))} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-40">Agregar {sel.length}</button></div>
      </div>
    </div>
  );
}

/* ---------------- docente: editor del libro ---------------- */
function EditorLibro({ libroId, onVolver, institucion }) {
  const [datos, setDatos] = useState(null);
  const [capIdx, setCapIdx] = useState(0);
  const [parte, setParte] = useState("libro");
  const [selector, setSelector] = useState(false);
  const [bancoAbierto, setBancoAbierto] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [nuevosIds, setNuevosIds] = useState([]);
  const [meta, setMeta] = useState({});
  const [progresoAbierto, setProgresoAbierto] = useState(false);

  const cargar = async () => { const d = await fetchLibroCompleto(libroId); setDatos(d); setMeta({ titulo: d.libro.titulo, descripcion: d.libro.descripcion || "", tiempo_estimado: d.libro.tiempo_estimado || "", fecha_entrega: d.libro.fecha_entrega || "" }); };
  useEffect(() => { cargar().catch((e) => alert("No se pudo abrir el libro: " + e.message)); }, [libroId]);
  const refrescar = async () => { const d = await fetchLibroCompleto(libroId); setDatos(d); setRecarga((n) => n + 1); };

  if (!datos) return <p className="text-sm text-slate-400">Cargando…</p>;
  const { libro, capitulos, bloques } = datos;
  const cap = capitulos[Math.min(capIdx, capitulos.length - 1)];
  const bs = cap ? bloques.filter((b) => b.capitulo_id === cap.id && b.parte === parte) : [];
  const guardarMeta = async (parcial) => { const nuevo = { ...meta, ...parcial }; setMeta(nuevo); };
  const persistirMeta = async () => { try { await editarLibro(libro.id, { titulo: meta.titulo.trim() || libro.titulo, descripcion: meta.descripcion || null, tiempo_estimado: meta.tiempo_estimado || null, fecha_entrega: meta.fecha_entrega || null }); } catch (e) { alert("No se pudo guardar: " + e.message); } };

  const agregarCapitulo = async () => { const c = await crearCapitulo({ libro_id: libro.id, orden: (capitulos[capitulos.length - 1]?.orden || 0) + 1, titulo: `Capítulo ${capitulos.length + 1}` }); await refrescar(); setCapIdx(capitulos.length); return c; };
  const renombrarCapitulo = async () => { const t = prompt("Nombre del capítulo:", cap.titulo); if (t === null || !t.trim()) return; await editarCapitulo(cap.id, { titulo: t.trim() }); refrescar(); };
  const eliminarCap = async () => { if (!confirm(`¿Eliminar el capítulo «${cap.titulo}» con todo su contenido?`)) return; await eliminarCapitulo(cap.id); setCapIdx(0); refrescar(); };
  const moverCap = async (d) => { const i = capitulos.findIndex((c) => c.id === cap.id), j = i + d; if (j < 0 || j >= capitulos.length) return; const a = capitulos[i], b = capitulos[j]; await Promise.all([editarCapitulo(a.id, { orden: b.orden }), editarCapitulo(b.id, { orden: a.orden })]); setCapIdx(j); refrescar(); };
  const editarResumen = async () => { const t = prompt("Resumen del capítulo (opcional):", cap.resumen || ""); if (t === null) return; await editarCapitulo(cap.id, { resumen: t.trim() || null }); refrescar(); };

  const ordenSiguiente = () => (bs[bs.length - 1]?.orden || 0) + 1;
  const agregarBloque = async (tipo, contenido) => { const b = await crearBloque({ capitulo_id: cap.id, parte, orden: ordenSiguiente(), tipo, contenido: contenido || nuevoContenido(tipo) }); setNuevosIds((a) => [...a, b.id]); setSelector(false); await refrescar(); return b; };
  const agregarDelBanco = async (preguntas) => {
    let orden = ordenSiguiente();
    const filas = preguntas.map((p) => ({ capitulo_id: cap.id, parte, orden: orden++, tipo: "pregunta_opcion", contenido: { enunciado: p.contexto ? `${p.contexto}\n\n${p.enunciado}` : p.enunciado, opciones: (p.opciones || []).map((o) => ({ texto: o.texto, correcta: !!o.correcta })), retro: p.retroalimentacion || "" } }));
    const { error } = await supabase.from("libro_bloques").insert(filas); if (error) { alert("Error: " + error.message); return; }
    setBancoAbierto(false); setSelector(false); refrescar();
  };
  const moverBloque = async (b, d) => { const i = bs.findIndex((x) => x.id === b.id), j = i + d; if (j < 0 || j >= bs.length) return; const o = bs[j]; await Promise.all([editarBloque(b.id, { orden: o.orden }), editarBloque(o.id, { orden: b.orden })]); refrescar(); };
  const quitarBloque = async (b) => { if (!confirm("¿Eliminar este elemento?")) return; await eliminarBloque(b.id); refrescar(); };
  const duplicarBloque = async (b) => { await crearBloque({ capitulo_id: cap.id, parte: b.parte, orden: b.orden + 0.5, tipo: b.tipo, contenido: b.contenido }); refrescar(); };
  const cambioLocal = (id, contenido) => setDatos((d) => ({ ...d, bloques: d.bloques.map((b) => (b.id === id ? { ...b, contenido } : b)) }));
  const alternarPublicada = async () => { await editarLibro(libro.id, { publicada: !libro.publicada }); refrescar(); };
  const alternarClase = async () => { await editarCapitulo(cap.id, { clase_visible: !cap.clase_visible }); refrescar(); };

  if (vistaPrevia) return <LectorLibro datosLibro={datos} estudianteId={null} vistaPrevia institucion={institucion} onVolver={() => setVistaPrevia(false)} />;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button onClick={onVolver} className="text-sm text-violet-500">← Mis libros</button><div className="flex-1" />
        <button onClick={() => setVistaPrevia(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">👁 Vista del estudiante</button>
        <button onClick={() => setImprimiendo(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">🖨️ Imprimir</button>
        <button onClick={() => setProgresoAbierto(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">📊 Progreso</button>
        <button onClick={alternarPublicada} className={`text-xs font-bold px-3 py-1.5 rounded-full ${libro.publicada ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"}`}>{libro.publicada ? "✅ Publicado" : "Borrador — publicar"}</button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 mb-3 grid gap-2">
        <input value={meta.titulo || ""} onChange={(e) => guardarMeta({ titulo: e.target.value })} onBlur={persistirMeta} placeholder="Título del libro" className="text-lg font-extrabold text-[#17264D] outline-none border-b border-transparent focus:border-violet-300" />
        <input value={meta.descripcion || ""} onChange={(e) => guardarMeta({ descripcion: e.target.value })} onBlur={persistirMeta} placeholder="Descripción breve (qué van a aprender)" className="text-sm text-slate-600 outline-none border-b border-transparent focus:border-violet-300" />
        <div className="grid grid-cols-2 gap-2"><input value={meta.tiempo_estimado || ""} onChange={(e) => guardarMeta({ tiempo_estimado: e.target.value })} onBlur={persistirMeta} placeholder="Tiempo estimado (ej: 3 horas)" className="text-xs rounded-lg px-3 py-2 border border-slate-200 outline-none" />
          <input type="date" value={meta.fecha_entrega || ""} onChange={(e) => guardarMeta({ fecha_entrega: e.target.value })} onBlur={persistirMeta} className="text-xs rounded-lg px-3 py-2 border border-slate-200 outline-none" /></div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
        {capitulos.map((c, i) => <button key={c.id} onClick={() => setCapIdx(i)} className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border ${cap && c.id === cap.id ? "bg-[#2F55A4] text-white border-[#2F55A4]" : "bg-white text-slate-600 border-slate-200"}`}>{i + 1}. {c.titulo}</button>)}
        <button onClick={agregarCapitulo} className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border border-dashed border-violet-300 text-violet-600">➕ Capítulo</button>
      </div>

      {!cap ? <p className="text-sm text-slate-400 text-center py-6">Agrega el primer capítulo para empezar.</p> : (<>
        <div className="flex flex-wrap items-center gap-2 mt-1 mb-2">
          <span className="text-sm font-extrabold text-[#17264D]">Capítulo {capitulos.findIndex((c) => c.id === cap.id) + 1}: {cap.titulo}</span>
          <button onClick={renombrarCapitulo} className="text-xs" title="Cambiar nombre">✏️</button><button onClick={editarResumen} className="text-[11px] text-violet-500">resumen</button>
          <button onClick={() => moverCap(-1)} className="text-xs text-slate-400">←</button><button onClick={() => moverCap(1)} className="text-xs text-slate-400">→</button>
          {capitulos.length > 1 && <button onClick={eliminarCap} className="text-xs" title="Eliminar capítulo">🗑</button>}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-1">{PARTES.map((p) => <button key={p.key} onClick={() => setParte(p.key)} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${parte === p.key ? "bg-[#17264D] text-white border-[#17264D]" : "bg-white text-slate-600 border-slate-200"}`}>{p.icono} {p.label} <span className="opacity-60">({bloques.filter((b) => b.capitulo_id === cap.id && b.parte === p.key).length})</span></button>)}</div>
        <p className="text-[11px] text-slate-400 mb-2">{PARTES.find((p) => p.key === parte).ayuda}</p>
        {parte === "clase" && (
          <label className="flex items-center gap-2 text-xs text-slate-600 bg-amber-50 rounded-lg px-3 py-2 mb-2"><input type="checkbox" checked={!!cap.clase_visible} onChange={alternarClase} /> Mostrar el material de la clase a los estudiantes en este capítulo <span className="text-slate-400">(si no, solo lo ves tú)</span></label>)}

        <div className="space-y-2.5" key={`${cap.id}-${parte}-${recarga}`}>
          {bs.map((b, i) => <BloqueCard key={b.id} bloque={b} indice={i} total={bs.length} abiertoInicial={nuevosIds.includes(b.id)} onMover={(d) => moverBloque(b, d)} onEliminar={() => quitarBloque(b)} onDuplicar={() => duplicarBloque(b)} onCambio={cambioLocal} />)}
        </div>
        <button onClick={() => setSelector(true)} className="w-full mt-3 text-sm font-bold py-3 rounded-xl border-2 border-dashed border-violet-300 text-violet-600 hover:bg-violet-50">➕ Agregar elemento de aprendizaje</button>
      </>)}

      {selector && <SelectorElemento onElegir={(t) => agregarBloque(t)} onBanco={() => setBancoAbierto(true)} onClose={() => setSelector(false)} />}
      {bancoAbierto && <BancoModal materiaId={libro.materia_id} gradoId={libro.grado_id} onClose={() => setBancoAbierto(false)} onAgregar={agregarDelBanco} />}
      {imprimiendo && <ImprimirModal onClose={() => setImprimiendo(false)} onImprimir={(partes) => { setImprimiendo(false); imprimirLibro(datos, institucion, partes); }} />}
      {progresoAbierto && <ProgresoModal datos={datos} onClose={() => setProgresoAbierto(false)} />}
    </div>
  );
}

function ImprimirModal({ onClose, onImprimir }) {
  const [sel, setSel] = useState(["libro", "guia"]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
        <h3 className="font-bold text-slate-800 mb-2">🖨️ ¿Qué partes imprimes?</h3>
        {PARTES.map((p) => <label key={p.key} className="flex items-center gap-2 text-sm text-slate-700 py-1"><input type="checkbox" checked={sel.includes(p.key)} onChange={() => setSel((a) => a.includes(p.key) ? a.filter((x) => x !== p.key) : [...a, p.key])} />{p.icono} {p.label}</label>)}
        <p className="text-[11px] text-slate-400 mt-1">Se abre una ventana lista para imprimir o guardar como PDF.</p>
        <div className="flex justify-end gap-2 mt-3"><button onClick={onClose} className="text-xs text-slate-500 px-3 py-2">Cancelar</button><button disabled={!sel.length} onClick={() => onImprimir(sel)} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-40">Imprimir</button></div>
      </div>
    </div>
  );
}

function ProgresoModal({ datos, onClose }) {
  const { libro, capitulos, bloques } = datos;
  const [filas, setFilas] = useState(null); const [abierto, setAbierto] = useState(null);
  useEffect(() => {
    (async () => {
      const ests = await api.fetchEstudiantesLivianosPorGrado(libro.grado_id);
      const { data } = await supabase.from("libro_progreso").select("estudiante_id, datos").eq("libro_id", libro.id);
      const mapa = Object.fromEntries((data || []).map((p) => [String(p.estudiante_id), p.datos || {}]));
      setFilas(ests.map((e) => ({ e, d: mapa[String(e.id)] || null })));
    })().catch(() => setFilas([]));
  }, []);
  const autos = bloques.filter((b) => esAutocorregible(b.tipo));
  const abiertas = bloques.filter((b) => ["abierta", "caso"].includes(b.tipo));
  const calc = (d) => ({
    hechos: capitulos.filter((c) => d?.hechos?.includes(c.id)).length,
    aciertos: autos.filter((b) => evaluarPregunta(b, d?.r?.[b.id]).ok === true).length,
    respondidas: abiertas.filter((b) => { const e = d?.r?.[b.id]; return e && ((e.txt || "").trim() || Object.values(e.resp || {}).some((x) => String(x).trim())); }).length,
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between"><h3 className="font-bold text-slate-800">📊 Progreso — {libro.titulo}</h3><button onClick={onClose} className="text-slate-400">✕</button></div>
        <div className="p-3 overflow-y-auto">
          {!filas ? <p className="text-sm text-slate-400 text-center py-6">Cargando…</p> : filas.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">No hay estudiantes en este curso.</p> : (
            <table className="w-full text-xs"><thead><tr className="text-left text-slate-500"><th className="p-1.5">Estudiante</th><th className="p-1.5">Capítulos</th><th className="p-1.5">Práctica correcta</th><th className="p-1.5">Actividades</th></tr></thead>
              <tbody>{filas.map(({ e, d }) => { const r = calc(d); return (<React.Fragment key={e.id}>
                <tr onClick={() => d && setAbierto(abierto === e.id ? null : e.id)} className={`border-t border-slate-100 ${d ? "cursor-pointer hover:bg-slate-50" : "text-slate-300"}`}>
                  <td className="p-1.5 font-semibold">{e.nombre}</td><td className="p-1.5">{d ? `${r.hechos}/${capitulos.length}` : "—"}</td><td className="p-1.5">{d && autos.length ? `${r.aciertos}/${autos.length}` : "—"}</td><td className="p-1.5">{d && abiertas.length ? `${r.respondidas}/${abiertas.length}` : "—"}</td></tr>
                {abierto === e.id && <tr><td colSpan={4} className="bg-slate-50 p-2 space-y-2">{abiertas.map((b) => { const s = d.r?.[b.id] || {}; const txt = b.tipo === "caso" ? Object.values(s.resp || {}).join("\n") : s.txt; return (
                  <div key={b.id}><div className="text-[11px] font-bold text-slate-600">{resumenBloque(b)}</div><div className="text-xs text-slate-700 whitespace-pre-line">{txt || <i className="text-slate-300">Sin respuesta</i>}{s.enlace ? <div className="text-sky-600 break-all">🔗 {s.enlace}</div> : null}</div></div>); })}
                  {abiertas.length === 0 && <div className="text-slate-400">Este libro no tiene actividades abiertas.</div>}</td></tr>}
              </React.Fragment>); })}</tbody></table>)}
        </div>
      </div>
    </div>
  );
}

/* ---------------- docente: lista de libros ---------------- */
function DuplicarModal({ libro, grados, materias, onClose, onHecho }) {
  const [grado, setGrado] = useState(libro.grado_id); const [materia, setMateria] = useState(libro.materia_id); const [periodo, setPeriodo] = useState(libro.periodo || "1"); const [trabajando, setTrabajando] = useState(false);
  const cls = "w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white mb-2";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
        <h3 className="font-bold text-slate-800 mb-1">⧉ Duplicar «{libro.titulo}»</h3><p className="text-xs text-slate-500 mb-3">Se copia con todos sus capítulos y elementos como borrador.</p>
        <select value={materia} onChange={(e) => setMateria(e.target.value)} className={cls}>{materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
        <select value={grado} onChange={(e) => setGrado(e.target.value)} className={cls}>{grados.map((g) => <option key={g.id} value={g.id}>{g.nombre || g.id}</option>)}</select>
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className={cls}>{[1, 2, 3, 4].map((p) => <option key={p} value={String(p)}>Periodo {p}</option>)}</select>
        <div className="flex justify-end gap-2"><button onClick={onClose} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
          <button disabled={trabajando} onClick={async () => { setTrabajando(true); try { await duplicarLibro(libro.id, { materia_id: materia, grado_id: grado, periodo }); onHecho(); } catch (e) { alert("Error: " + e.message); } setTrabajando(false); }} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">{trabajando ? "Copiando…" : "Duplicar"}</button></div>
      </div>
    </div>
  );
}

export function VistaGuiasEstudio({ grados, gradoActivo, periodoActivo, materiaActiva }) {
  const [materias, setMaterias] = useState([]);
  const [materiaId, setMateriaId] = useState(materiaActiva || "");
  const [gradoId, setGradoId] = useState(gradoActivo || grados[0]?.id || "");
  const [periodo, setPeriodo] = useState("1");
  const [libros, setLibros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(null);
  const [duplicando, setDuplicando] = useState(null);
  const [institucion, setInstitucion] = useState(null);

  useEffect(() => { if (gradoActivo) setGradoId(gradoActivo); }, [gradoActivo]);
  useEffect(() => { if (materiaActiva) setMateriaId(materiaActiva); }, [materiaActiva]);
  useEffect(() => { if (periodoActivo) setPeriodo(String(periodoActivo)); }, [periodoActivo]);
  useEffect(() => { api.fetchMaterias().then((d) => { setMaterias(d); setMateriaId((m) => m || d[0]?.id || ""); }); api.fetchInstitucion().then(setInstitucion).catch(() => {}); }, []);
  useEffect(() => { if (grados.length && !gradoId) setGradoId(grados[0].id); }, [grados]);

  const cargar = () => { if (!materiaId || !gradoId) return; setCargando(true); setError(""); fetchLibros(materiaId, gradoId, periodo).then((d) => { setLibros(d); setCargando(false); }).catch((e) => { setError(e.message || "Error"); setCargando(false); }); };
  useEffect(() => { cargar(); }, [materiaId, gradoId, periodo, editando]);

  if (editando) return <EditorLibro libroId={editando} institucion={institucion} onVolver={() => setEditando(null)} />;

  const nuevo = async () => {
    const t = prompt("Título del nuevo libro:"); if (!t || !t.trim()) return;
    try { const l = await crearLibro({ materia_id: materiaId, grado_id: gradoId, periodo, titulo: t.trim(), publicada: false }); await crearCapitulo({ libro_id: l.id, orden: 1, titulo: "Capítulo 1" }); setEditando(l.id); }
    catch (e) { alert("No se pudo crear: " + e.message); }
  };
  const borrar = async (l) => { if (!confirm(`¿Eliminar el libro «${l.titulo}» con todos sus capítulos?`)) return; try { await eliminarLibro(l.id); cargar(); } catch (e) { alert("Error: " + e.message); } };
  const alternar = async (l) => { try { await editarLibro(l.id, { publicada: !l.publicada }); cargar(); } catch (e) { alert("Error: " + e.message); } };
  const cls = "text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)} className={cls}>{materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className={cls}>{grados.map((g) => <option key={g.id} value={g.id}>{g.nombre || g.id}</option>)}</select>
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className={cls}>{[1, 2, 3, 4].map((p) => <option key={p} value={String(p)}>Periodo {p}</option>)}</select>
        <div className="flex-1" />
        <button onClick={nuevo} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white">➕ Nuevo libro</button>
      </div>
      <p className="text-xs text-slate-500 mb-3">Cada libro tiene capítulos, y cada capítulo tiene tres partes: 📖 Libro (lectura), 📝 Guía (trabajo del estudiante) y 🎒 Material para la clase.</p>
      {error && <p className="text-xs bg-rose-50 text-rose-700 rounded-lg p-2.5 mb-3">No se pudieron cargar los libros ({error}). ¿Ya ejecutaste el script <b>120_libros_estudio.sql</b> en Supabase?</p>}
      {cargando ? <p className="text-sm text-slate-400">Cargando…</p> : libros.length === 0 && !error ? (
        <p className="text-sm text-slate-400 text-center py-8">No hay libros para esta materia, curso y periodo. Pulsa «➕ Nuevo libro».</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {libros.map((l) => (
            <div key={l.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <button onClick={() => setEditando(l.id)} className="block w-full text-left px-3 py-3 text-white" style={{ background: "linear-gradient(135deg,#17264D,#2F55A4)" }}>
                <div className="text-base font-extrabold leading-tight">📘 {l.titulo}</div>
                <div className="text-[11px] opacity-75 mt-0.5">{l.libro_capitulos?.length || 0} capítulo(s){l.tiempo_estimado ? ` · ⏱ ${l.tiempo_estimado}` : ""}{l.fecha_entrega ? ` · 📅 ${l.fecha_entrega}` : ""}</div></button>
              <div className="flex items-center gap-1.5 p-2.5">
                <button onClick={() => alternar(l)} className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${l.publicada ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{l.publicada ? "✅ Publicado" : "Borrador"}</button>
                <div className="flex-1" />
                <button onClick={() => setEditando(l.id)} className="text-xs font-semibold text-violet-600 px-2">✏️ Abrir</button>
                <button onClick={() => setDuplicando(l)} className="text-sm px-1" title="Duplicar">⧉</button>
                <button onClick={() => borrar(l)} className="text-sm px-1" title="Eliminar">🗑</button>
              </div>
            </div>))}
        </div>)}
      {duplicando && <DuplicarModal libro={duplicando} grados={grados} materias={materias} onClose={() => setDuplicando(null)} onHecho={() => { setDuplicando(null); cargar(); }} />}
    </div>
  );
}
