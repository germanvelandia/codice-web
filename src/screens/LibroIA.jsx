import React, { useMemo, useState } from "react";
import { TIPOS } from "./BloquesLibro";

/* =====================================================================
   Crear libros de estudio con IA (ChatGPT, Claude, Gemini…):
   1) la plataforma arma un prompt con tus datos; 2) lo pegas en tu IA;
   3) pegas aquí la respuesta y la plataforma la convierte en capítulos y
   elementos de aprendizaje listos para editar.
   ===================================================================== */

const TIPOS_IA = ["texto", "encabezado", "pregunta_opcion", "pregunta_vf", "pregunta_completar", "abierta", "tabla", "linea_tiempo", "mapa_mental", "caso", "glosario", "flashcards", "cita", "sabias", "rubrica"];
const CLAVE_EXTRA = "codice_ia_libros_extra";

export function construirPrompt({ institucion, materia, grado, periodo, tema, capitulos, tiempo, profundidad, enfasis, extra, prioridades }) {
  return `Eres un diseñador instruccional experto en educación básica y media en Colombia. Vas a crear un LIBRO DE ESTUDIO completo, listo para usarse en una plataforma educativa.

DATOS
- Institución: ${institucion || "(sin dato)"}
- Asignatura: ${materia || "(sin dato)"}
- Grado: ${grado || "(sin dato)"}${periodo ? `\n- Periodo: ${periodo}` : ""}
- Tema del libro: ${tema || "(escribe aquí el tema)"}
- Número de capítulos: ${capitulos}
- Tiempo estimado de estudio: ${tiempo || "a criterio tuyo"}
- Nivel de profundidad: ${profundidad}${enfasis ? `\n- Enfoque o énfasis: ${enfasis}` : ""}${prioridades.length ? `\n- Incluye con prioridad: ${prioridades.join(", ")}` : ""}${extra ? `\n- Instrucciones adicionales: ${extra}` : ""}

ESTRUCTURA
Cada capítulo tiene TRES partes:
1. "libro": la lectura del estudiante. Explicación clara en párrafos cortos, con títulos de sección, glosario, y apoyos como mapa mental, línea de tiempo, cita o "¿sabías que?".
2. "guia": el trabajo del estudiante. De 4 a 6 preguntas autocorregibles variadas (opción múltiple, verdadero/falso, completar), al menos una actividad abierta, y cuando aplique una tabla o cuadro comparativo, un caso o dilema ético y una rúbrica de autoevaluación.
3. "clase": material para el docente en el aula: preguntas para el debate, un caso para analizar en grupo, una actividad de inicio o cierre.

FORMATO DE RESPUESTA
Responde ÚNICAMENTE con un bloque de código JSON válido (sin texto antes ni después) con esta forma:
{
  "titulo": "…",
  "descripcion": "Qué van a aprender (1-2 frases)",
  "tiempo_estimado": "3 horas",
  "capitulos": [
    {
      "titulo": "…",
      "resumen": "…",
      "libro": [ { "tipo": "texto", "html": "<p>…</p>" } ],
      "guia": [ { "tipo": "pregunta_opcion", "enunciado": "…", "opciones": [ { "texto": "…", "correcta": true }, { "texto": "…", "correcta": false } ], "retro": "…" } ],
      "clase": [ { "tipo": "abierta", "enunciado": "…", "pide_enlace": false } ]
    }
  ]
}

TIPOS DE ELEMENTO PERMITIDOS (campo "tipo" y sus campos):
- "texto": { "html": "texto con etiquetas <p>, <b>, <i>, <ul>, <ol>, <li>, <h3>, <br>" }
- "encabezado": { "texto": "título de sección", "nivel": "2" }  (nivel "2" grande, "3" mediano)
- "pregunta_opcion": { "enunciado", "opciones": [ { "texto", "correcta": true/false } ] (3 a 4 opciones, UNA sola correcta), "retro": "por qué es correcta" }
- "pregunta_vf": { "enunciado": "afirmación", "correcta": true o false, "retro" }
- "pregunta_completar": { "enunciado": "frase con ___", "respuestas": "respuesta1; respuesta2", "retro" }
- "abierta": { "enunciado": "consigna", "pide_enlace": false }
- "tabla": { "titulo", "columnas": ["A", "B"], "filas": [ ["…", "…"] ], "editable": false }  (con "editable": true y celdas "" el estudiante las completa)
- "linea_tiempo": { "titulo", "eventos": [ { "fecha", "titulo", "texto" } ] }
- "mapa_mental": { "centro": "idea central", "ramas": [ { "texto": "rama", "hijos": "idea 1\\nidea 2" } ] }
- "caso": { "titulo", "situacion": "<p>…</p>", "preguntas": "pregunta 1\\npregunta 2" }
- "glosario": { "titulo": "Glosario", "terminos": [ { "termino", "definicion" } ] }
- "flashcards": { "titulo", "tarjetas": [ { "frente", "reverso" } ] }
- "cita": { "texto", "autor" }
- "sabias": { "texto" }
- "rubrica": { "titulo": "Mi autoevaluación", "criterios": [ { "criterio": "Explico…" } ] }

REGLAS
- Todo el contenido debe ser específico del tema, claro y adecuado al grado; nada genérico ni de relleno.
- No inventes enlaces, videos, imágenes ni referencias bibliográficas reales: si recomiendas un recurso, descríbelo dentro de un elemento "texto".
- Las preguntas autocorregibles deben tener una única respuesta correcta indiscutible.
- Usa español neutro y tono cercano para estudiantes.
- El JSON debe ser válido: comillas dobles, sin comentarios y sin comas finales.`;
}

/* ---------- lectura de la respuesta de la IA ---------- */
function extraerJSON(texto) {
  let t = String(texto || "").replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1];
  const ini = t.indexOf("{"); if (ini < 0) throw new Error("No encontré un JSON en el texto pegado.");
  let prof = 0, enCad = false, esc = false, fin = -1;
  for (let i = ini; i < t.length; i++) {
    const ch = t[i];
    if (enCad) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') enCad = false; continue; }
    if (ch === '"') enCad = true; else if (ch === "{") prof++; else if (ch === "}") { prof--; if (prof === 0) { fin = i; break; } }
  }
  if (fin < 0) throw new Error("El JSON parece estar cortado (la IA no terminó la respuesta). Pídele que continúe o que lo genere de nuevo con menos capítulos.");
  const crudo = t.slice(ini, fin + 1);
  try { return JSON.parse(crudo); } catch { /* intento con comas finales */ }
  try { return JSON.parse(crudo.replace(/,\s*([}\]])/g, "$1")); } catch (e) { throw new Error("El JSON no es válido: " + e.message); }
}

export function limpiarHtml(h) {
  return String(h ?? "").replace(/<\s*(script|style|iframe|object|embed)[\s\S]*?<\s*\/\s*\1\s*>/gi, "").replace(/<\s*(script|style|iframe|object|embed)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/javascript:/gi, "");
}
const str = (v) => (v === null || v === undefined ? "" : String(v));
const lineas = (v) => (Array.isArray(v) ? v.map(str).join("\n") : str(v));
const arr = (v) => (Array.isArray(v) ? v : []);

function normalizarBloque(b, avisos, ubic) {
  if (!b || typeof b !== "object") return null;
  const tipo = str(b.tipo).trim();
  if (!TIPOS_IA.includes(tipo)) { avisos.push(`${ubic}: se omitió un elemento de tipo «${tipo || "?"}».`); return null; }
  const c = TIPOS[tipo].vacio();
  switch (tipo) {
    case "texto": c.html = limpiarHtml(b.html ?? b.texto ?? b.contenido); if (!c.html.trim()) return null; break;
    case "encabezado": c.texto = str(b.texto ?? b.titulo); c.nivel = str(b.nivel) === "3" ? "3" : "2"; if (!c.texto.trim()) return null; break;
    case "pregunta_opcion": {
      c.enunciado = str(b.enunciado ?? b.pregunta); c.retro = str(b.retro ?? b.retroalimentacion);
      let ops = arr(b.opciones).map((o) => (typeof o === "string" ? { texto: o, correcta: false } : { texto: str(o?.texto), correcta: !!o?.correcta })).filter((o) => o.texto.trim());
      if (ops.length < 2) { avisos.push(`${ubic}: se omitió una pregunta con menos de 2 opciones.`); return null; }
      const k = ops.findIndex((o) => o.correcta); ops = ops.map((o, i) => ({ ...o, correcta: i === (k < 0 ? 0 : k) }));
      if (k < 0) avisos.push(`${ubic}: una pregunta no indicaba la respuesta correcta; se marcó la opción A, revísala.`);
      c.opciones = ops; if (!c.enunciado.trim()) return null; break;
    }
    case "pregunta_vf": c.enunciado = str(b.enunciado ?? b.pregunta); c.correcta = b.correcta === true || str(b.correcta).toLowerCase() === "true" || str(b.correcta).toLowerCase() === "verdadero"; c.retro = str(b.retro); if (!c.enunciado.trim()) return null; break;
    case "pregunta_completar": c.enunciado = str(b.enunciado); c.respuestas = Array.isArray(b.respuestas) ? b.respuestas.join("; ") : str(b.respuestas ?? b.respuesta); c.retro = str(b.retro); if (!c.enunciado.trim() || !c.respuestas.trim()) return null; break;
    case "abierta": c.enunciado = str(b.enunciado ?? b.consigna); c.pide_enlace = !!b.pide_enlace; if (!c.enunciado.trim()) return null; break;
    case "tabla": {
      const cols = arr(b.columnas).map(str); const filas = arr(b.filas).map((f) => arr(f).map(str));
      if (cols.length < 1) return null;
      c.titulo = str(b.titulo); c.columnas = cols; c.filas = filas.map((f) => cols.map((_, j) => f[j] ?? "")); c.editable = !!b.editable; break;
    }
    case "linea_tiempo": c.titulo = str(b.titulo); c.eventos = arr(b.eventos).map((e) => ({ fecha: str(e?.fecha), titulo: str(e?.titulo), texto: str(e?.texto) })).filter((e) => e.titulo || e.fecha); if (!c.eventos.length) return null; break;
    case "mapa_mental": c.centro = str(b.centro); c.ramas = arr(b.ramas).map((r) => ({ texto: str(r?.texto), hijos: lineas(r?.hijos) })).filter((r) => r.texto); if (!c.centro || !c.ramas.length) return null; break;
    case "caso": c.titulo = str(b.titulo); c.situacion = limpiarHtml(b.situacion); c.preguntas = lineas(b.preguntas); if (!c.situacion.trim()) return null; break;
    case "glosario": c.titulo = str(b.titulo) || "Glosario"; c.terminos = arr(b.terminos).map((t) => ({ termino: str(t?.termino), definicion: str(t?.definicion) })).filter((t) => t.termino); if (!c.terminos.length) return null; break;
    case "flashcards": c.titulo = str(b.titulo) || "Tarjetas de repaso"; c.tarjetas = arr(b.tarjetas).map((t) => ({ frente: str(t?.frente), reverso: str(t?.reverso) })).filter((t) => t.frente); if (!c.tarjetas.length) return null; break;
    case "cita": c.texto = str(b.texto); c.autor = str(b.autor); if (!c.texto.trim()) return null; break;
    case "sabias": c.texto = str(b.texto); if (!c.texto.trim()) return null; break;
    case "rubrica": c.titulo = str(b.titulo) || "Mi autoevaluación"; c.criterios = arr(b.criterios).map((x) => ({ criterio: str(typeof x === "string" ? x : x?.criterio) })).filter((x) => x.criterio); if (!c.criterios.length) return null; break;
    default: return null;
  }
  return { tipo, contenido: c };
}

export function leerRespuestaIA(texto) {
  const obj = extraerJSON(texto); const avisos = [];
  const caps = arr(obj.capitulos ?? obj.chapters);
  if (!caps.length) throw new Error("El JSON no trae capítulos («capitulos»).");
  const capitulos = caps.map((c, i) => {
    const partes = {};
    for (const p of ["libro", "guia", "clase"]) partes[p] = arr(c?.[p]).map((b) => normalizarBloque(b, avisos, `Capítulo ${i + 1} (${p})`)).filter(Boolean);
    return { titulo: str(c?.titulo) || `Capítulo ${i + 1}`, resumen: str(c?.resumen), partes };
  });
  return { titulo: str(obj.titulo), descripcion: str(obj.descripcion), tiempo_estimado: str(obj.tiempo_estimado), capitulos, avisos };
}

/* ---------- ventana ---------- */
const PRIORIDADES = ["casos o dilemas éticos", "mapas mentales", "líneas de tiempo", "cuadros comparativos", "tarjetas de repaso", "preguntas tipo ICFES"];
const CLS = "w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white";

export function IAModal({ contexto, destinoLibro, onClose, onImportar }) {
  const [paso, setPaso] = useState(1);
  const [f, setF] = useState({ tema: destinoLibro?.titulo && !destinoLibro?.titulo.startsWith("Borrador") ? destinoLibro.titulo : "", capitulos: destinoLibro ? 1 : 3, tiempo: "", profundidad: "intermedio", enfasis: "", prioridades: [], extra: (() => { try { return localStorage.getItem(CLAVE_EXTRA) || ""; } catch { return ""; } })() });
  const [respuesta, setRespuesta] = useState("");
  const [lectura, setLectura] = useState(null);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [importando, setImportando] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const prompt = useMemo(() => construirPrompt({ ...contexto, ...f, capitulos: f.capitulos }), [contexto, f]);

  const copiar = async () => {
    try { localStorage.setItem(CLAVE_EXTRA, f.extra); } catch { /* sin almacenamiento */ }
    try { await navigator.clipboard.writeText(prompt); setCopiado(true); setTimeout(() => setCopiado(false), 2500); }
    catch { const t = document.getElementById("prompt-ia-libro"); t?.select(); document.execCommand?.("copy"); setCopiado(true); }
  };
  const analizar = () => { setError(""); setLectura(null); try { setLectura(leerRespuestaIA(respuesta)); } catch (e) { setError(e.message); } };
  const total = lectura ? lectura.capitulos.reduce((n, c) => n + c.partes.libro.length + c.partes.guia.length + c.partes.clase.length, 0) : 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-xl">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between"><h3 className="font-bold text-slate-800">🤖 {destinoLibro ? "Agregar capítulos con IA" : "Crear un libro con IA"}</h3><button onClick={onClose} className="text-slate-400">✕</button></div>
          <div className="flex gap-1.5 mt-2">{[[1, "1. Preparar el prompt"], [2, "2. Pegar la respuesta"]].map(([n, l]) => <button key={n} onClick={() => setPaso(n)} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${paso === n ? "bg-[#17264D] text-white border-[#17264D]" : "bg-white text-slate-600 border-slate-200"}`}>{l}</button>)}</div>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {paso === 1 ? (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-500">Completa los datos, copia el prompt y pégalo en tu IA favorita (ChatGPT, Claude, Gemini…). Cuando responda, vuelve y pega su respuesta en el paso 2.</p>
              <input value={f.tema} onChange={(e) => set("tema", e.target.value)} placeholder="Tema del libro (ej: La dignidad humana y la Constitución de 1991)" className={CLS} />
              <div className="grid grid-cols-3 gap-2">
                <label className="text-[11px] text-slate-500">Capítulos<input type="number" min="1" max="6" value={f.capitulos} onChange={(e) => set("capitulos", Math.max(1, Math.min(6, parseInt(e.target.value, 10) || 1)))} className={CLS} /></label>
                <label className="text-[11px] text-slate-500">Tiempo<input value={f.tiempo} onChange={(e) => set("tiempo", e.target.value)} placeholder="3 horas" className={CLS} /></label>
                <label className="text-[11px] text-slate-500">Profundidad<select value={f.profundidad} onChange={(e) => set("profundidad", e.target.value)} className={CLS}><option>introductorio</option><option>intermedio</option><option>avanzado</option></select></label>
              </div>
              <input value={f.enfasis} onChange={(e) => set("enfasis", e.target.value)} placeholder="Enfoque o énfasis (opcional: pensamiento crítico, convivencia, preparación Saber…)" className={CLS} />
              <div><div className="text-[11px] font-semibold text-slate-500 mb-1">Incluir con prioridad</div><div className="flex flex-wrap gap-1.5">{PRIORIDADES.map((p) => (
                <button key={p} onClick={() => set("prioridades", f.prioridades.includes(p) ? f.prioridades.filter((x) => x !== p) : [...f.prioridades, p])} className={`text-[11px] px-2.5 py-1 rounded-full border ${f.prioridades.includes(p) ? "bg-violet-500 text-white border-violet-500" : "bg-white text-slate-600 border-slate-200"}`}>{p}</button>))}</div></div>
              <textarea value={f.extra} onChange={(e) => set("extra", e.target.value)} rows={2} placeholder="Instrucciones adicionales (se recuerdan para la próxima vez). Ej: usa el lenguaje del gremio, los roles Maestro del Gremio y Cronista, rúbrica con Sello de Oro, Plata y Cobre…" className={CLS} />
              <div><div className="text-[11px] font-semibold text-slate-500 mb-1">Prompt listo para copiar</div><textarea id="prompt-ia-libro" readOnly value={prompt} rows={6} className="w-full text-[11px] font-mono rounded-lg px-3 py-2 border border-slate-200 bg-slate-50 outline-none" /></div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-500">Pega aquí la respuesta completa de la IA (el bloque JSON). Puedes pegarla tal cual, con o sin las comillas de código.</p>
              <textarea value={respuesta} onChange={(e) => { setRespuesta(e.target.value); setLectura(null); setError(""); }} rows={9} placeholder='{ "titulo": "…", "capitulos": [ … ] }' className={CLS + " font-mono text-xs"} />
              {error && <p className="text-xs bg-rose-50 text-rose-700 rounded-lg p-2.5">{error}</p>}
              {lectura && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                  <div className="text-sm font-bold text-emerald-800 mb-1">✅ Listo para importar: {lectura.capitulos.length} capítulo(s) y {total} elementos</div>
                  {lectura.titulo && !destinoLibro && <div className="text-xs text-slate-700 mb-1">Título: <b>{lectura.titulo}</b></div>}
                  <ul className="text-xs text-slate-600 space-y-0.5">{lectura.capitulos.map((c, i) => <li key={i}>• <b>{c.titulo}</b> — 📖 {c.partes.libro.length} · 📝 {c.partes.guia.length} · 🎒 {c.partes.clase.length}</li>)}</ul>
                  {lectura.avisos.length > 0 && <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2"><b>Avisos:</b><ul className="list-disc pl-4">{lectura.avisos.slice(0, 8).map((a, i) => <li key={i}>{a}</li>)}</ul></div>}
                  <p className="text-[11px] text-slate-500 mt-2">Todo queda como {destinoLibro ? "capítulos nuevos al final del libro" : "un libro en borrador"} y lo puedes editar elemento por elemento.</p>
                </div>)}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-slate-100 flex justify-end gap-2">
          {paso === 1 ? (<>
            <button onClick={copiar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white">{copiado ? "✅ Copiado" : "📋 Copiar prompt"}</button>
            <button onClick={() => setPaso(2)} className="text-sm font-semibold px-4 py-2 rounded-lg border border-slate-200 text-slate-700">Ya tengo la respuesta →</button>
          </>) : (<>
            <button disabled={!respuesta.trim()} onClick={analizar} className="text-sm font-semibold px-4 py-2 rounded-lg border border-slate-200 text-slate-700 disabled:opacity-40">Analizar respuesta</button>
            <button disabled={!lectura || importando} onClick={async () => { setImportando(true); try { await onImportar(lectura); } catch (e) { setError("No se pudo importar: " + e.message); setImportando(false); } }} className="text-sm font-semibold px-4 py-2 rounded-lg bg-emerald-500 text-white disabled:opacity-40">{importando ? "Importando…" : "Importar"}</button>
          </>)}
        </div>
      </div>
    </div>
  );
}
