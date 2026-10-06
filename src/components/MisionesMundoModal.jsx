import React, { useEffect, useRef, useState } from "react";
import * as mundoApi from "../lib/mundoApi";
import { ZONAS, LUGARES, zonaDeLugar, zonaPorClave } from "../game/zonas";
import { esNivel, claveNivel, nivelDeClave, nivelDeGrado, nivelesDe, nombreNivel, etiquetaPara, cursosDelNivel, misionVisiblePara, cursoSaturado as cursoSaturadoDe, etiquetaSaturado } from "../lib/gradosMundo";
import { ITEMS, RECETAS } from "../game/items";
import { aObjetos, analizarImportacion, filasParaExportar, filasPlantilla, crearLibro, leerLibro } from "../lib/importarMisiones";

// Editor de las misiones del Mundo CÓDICE: acá se agregan, cambian, ocultan y borran las preguntas
// que los estudiantes encuentran al hablar con los personajes. Los cambios se ven en el mundo
// apenas se guardan (cada estudiante las carga al entrar).

const ROLES = [
  ["maestro_gremio", "👑", "Maestro del Gremio"], ["heraldo", "🕊️", "Heraldo de la Alianza"], ["peregrino", "📜", "Peregrino del Sentido"], ["cronista", "🖋️", "Cronista del Reino"],
  ["defensor", "⚖️", "Defensor del Pacto"], ["consejero", "🏦", "Consejero Real"], ["guardian", "🎨", "Guardián del Símbolo"],
];
const PERSONAJES = ROLES.flatMap(([k, e, n]) => [{ valor: `${k}_femenino`, texto: `${e} ${n} ♀` }, { valor: `${k}_masculino`, texto: `${e} ${n} ♂` }]);
const MAX_POR_LUGAR = 5; // más de 5 personajes en un mismo lugar no caben sin encimarse
const MIN_OPCIONES = 2, MAX_OPCIONES = 5;
const nombreLugar = (k) => LUGARES.find((l) => l.key === k) || { emoji: "📍", nombre: k };

const vacia = (curso) => ({ grado_id: curso || "", zona: "aldea", lugar: "biblioteca", npc_nombre: "", npc_sprite: "", titulo: "", texto: "", opciones: ["", ""], correcta: 0, pista: "", retro: "", xp: 10, oro: 5, orden: 0, activo: true });
const aForm = (m) => ({ grado_id: m.grado_id ? String(m.grado_id) : "", zona: m.zona || zonaDeLugar(m.lugar), lugar: m.lugar || "plaza", npc_nombre: m.npc_nombre || "", npc_sprite: m.npc_sprite || "", titulo: m.titulo || "", texto: m.texto || "", opciones: m.opciones && m.opciones.length >= MIN_OPCIONES ? [...m.opciones] : ["", ""], correcta: Math.min(Number(m.correcta) || 0, Math.max(0, (m.opciones || []).length - 1)), pista: m.pista || "", retro: m.retro || "", xp: m.xp ?? 0, oro: m.oro ?? 0, orden: m.orden ?? 0, activo: m.activo !== false });

export default function MisionesMundoModal({ onClose, grados = [], gradoActual = "" }) {
  const [misiones, setMisiones] = useState([]);
  const [conteo, setConteo] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [filtroCurso, setFiltroCurso] = useState("todos"); // "todos" | "generales" | "nivel:8" | id de un curso
  const [importacion, setImportacion] = useState(null);       // la revisión del Excel antes de guardar: { archivo, analisis }
  const [aplicando, setAplicando] = useState(null);           // { hecho, total } mientras se guarda
  const entradaArchivo = useRef(null);
  const [pestana, setPestana] = useState("misiones");       // "misiones" | "zonas"
  const [editando, setEditando] = useState(null); // null | "nueva" | id
  const [form, setForm] = useState(vacia());
  const [errForm, setErrForm] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");

  const cargar = async () => {
    try {
      const [m, c] = await Promise.all([mundoApi.fetchMisionesMundoAdmin(), mundoApi.fetchConteoHechasMundo().catch(() => ({}))]);
      setMisiones(m); setConteo(c); setError("");
    } catch (e) { setError(e.message || "No se pudieron cargar las misiones."); }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);
  const relojAviso = useRef(null);
  useEffect(() => () => clearTimeout(relojAviso.current), []);
  const mostrarAviso = (t) => { setAviso(t); clearTimeout(relojAviso.current); relojAviso.current = setTimeout(() => setAviso(""), 2600); }; // un solo temporizador: el aviso nuevo no lo borra el anterior

  // Cursos que existen: los del docente más cualquiera que ya tenga misiones propias (sin contar las marcas de grado "nivel:8").
  const cursos = [...new Set([...grados.map((g) => String(g.id)), ...misiones.map((m) => m.grado_id).filter((c) => c && !esNivel(c)).map(String)])];
  const niveles = nivelesDe(cursos);                                       // por ejemplo ["8", "9", "10"]
  const columnaCurso = misiones.length === 0 || misiones.some((m) => m._tieneGrado); // false = falta correr el SQL 63
  const columnaZona = misiones.length === 0 || misiones.some((m) => m._tieneZona);    // false = falta correr el SQL 64
  // Si poner una misión visible haría pasar de 5 a algún curso, devuelve cuál (o null si cabe).
  const cursoSaturado = (lugar, gradoSel, exceptoId) => cursoSaturadoDe(misiones, lugar, gradoSel, exceptoId, cursos);
  const textoSaturado = (lugar, c) => `${nombreLugar(lugar).nombre} ya tiene ${MAX_POR_LUGAR} misiones visibles para ${etiquetaSaturado(c)} (el máximo para que los personajes quepan). Oculta una o elige otro lugar.`;
  // ---- Excel: descargar la plantilla, exportar las misiones, o importarlas con una revisión antes de guardar ----
  const cargarXLSX = async () => { const mod = await import("xlsx"); return mod.utils ? mod : mod.default; }; // se carga solo cuando se usa
  const hoy = () => new Date().toISOString().slice(0, 10);
  const bajarPlantilla = async () => {
    try { const X = await cargarXLSX(); X.writeFile(crearLibro(X, { filas: filasPlantilla(), cursos }), "plantilla_misiones_mundo.xlsx"); }
    catch (e) { setError("No se pudo crear el Excel: " + (e.message || "error")); }
  };
  const exportar = async () => {
    try { const X = await cargarXLSX(); X.writeFile(crearLibro(X, { filas: filasParaExportar(misiones), cursos }), `misiones_mundo_${hoy()}.xlsx`); mostrarAviso("Exportadas ✓"); }
    catch (e) { setError("No se pudo crear el Excel: " + (e.message || "error")); }
  };
  const elegirArchivo = (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    setError("");
    const lector = new FileReader();
    lector.onload = async (ev) => {
      try {
        const X = await cargarXLSX(); const r = aObjetos(leerLibro(X, ev.target.result));
        if (r.error) { setError(r.error); return; }
        if (!r.objetos.length) { setError("No encontré misiones en el archivo (solo los encabezados)."); return; }
        setImportacion({ archivo: f.name, analisis: analizarImportacion(r.objetos, { misiones, cursos, columnaCurso, columnaZona }) });
      } catch (er) { setError("No se pudo leer el archivo. ¿Es un Excel (.xlsx)? " + (er.message || "")); }
    };
    lector.onerror = () => setError("No se pudo leer el archivo.");
    lector.readAsBinaryString(f);
  };
  const aplicarImportacion = async () => {
    const filas = importacion.analisis.filas.filter((f) => f.estado === "nueva" || f.estado === "actualiza");
    const nuevas = filas.filter((f) => f.estado === "nueva"), cambios = filas.filter((f) => f.estado === "actualiza");
    let creadas = 0, actualizadas = 0; setAplicando({ hecho: 0, total: filas.length }); setError("");
    try {
      if (nuevas.length) { creadas = await mundoApi.crearMisionesMundo(nuevas.map((f) => f.campos)); setAplicando({ hecho: creadas, total: filas.length }); }
      for (let i = 0; i < cambios.length; i += 10) { const trozo = cambios.slice(i, i + 10); await Promise.all(trozo.map((f) => mundoApi.editarMisionMundo(f.id, f.campos))); actualizadas += trozo.length; setAplicando({ hecho: creadas + actualizadas, total: filas.length }); }
      setImportacion(null); await cargar(); mostrarAviso(`Importado ✓ ${creadas} nueva${creadas === 1 ? "" : "s"}, ${actualizadas} actualizada${actualizadas === 1 ? "" : "s"}`);
    } catch (er) {
      creadas = er.creadas ?? creadas;
      setImportacion(null); await cargar();   // primero se recarga la lista (eso limpia los errores) y DESPUÉS se muestra el mensaje
      setError(`Se detuvo la importación: ${er.message || "error"}. Ya se guardaron ${creadas} nuevas y ${actualizadas} actualizadas. Corrige el problema y vuelve a importar el mismo archivo: lo que ya está guardado no se duplica.`);
    }
    setAplicando(null);
  };
  const abrirNueva = (base) => { setForm(base ? aForm(base) : vacia(!columnaCurso ? "" : filtroCurso !== "todos" && filtroCurso !== "generales" ? filtroCurso : gradoActual ? (nivelDeGrado(gradoActual) ? claveNivel(nivelDeGrado(gradoActual)) : String(gradoActual)) : "")); setEditando("nueva"); setErrForm(""); };
  const abrirEditar = (m) => { setForm(aForm(m)); setEditando(m.id); setErrForm(""); };
  const cambiar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));
  const cambiarOpcion = (i, v) => setForm((f) => ({ ...f, opciones: f.opciones.map((o, k) => (k === i ? v : o)) }));
  const agregarOpcion = () => setForm((f) => (f.opciones.length < MAX_OPCIONES ? { ...f, opciones: [...f.opciones, ""] } : f));
  const quitarOpcion = (i) => setForm((f) => {
    if (f.opciones.length <= MIN_OPCIONES) return f;
    const opciones = f.opciones.filter((_, k) => k !== i);
    // si se quita la correcta, queda la primera; si se quita una anterior, la correcta se corre un lugar
    const correcta = i === f.correcta ? 0 : i < f.correcta ? f.correcta - 1 : f.correcta;
    return { ...f, opciones, correcta };
  });

  const validar = () => {
    if (!form.titulo.trim()) return "Escribe un título para la misión.";
    if (!form.texto.trim()) return "Escribe lo que pregunta o plantea la misión.";
    if (form.opciones.length < MIN_OPCIONES) return `Tiene que haber al menos ${MIN_OPCIONES} respuestas.`;
    if (form.opciones.some((o) => !o.trim())) return "Ninguna respuesta puede quedar vacía (escríbela o quítala con la ✕).";
    const nums = { XP: form.xp, "Oro": form.oro, "Orden": form.orden };
    for (const [n, v] of Object.entries(nums)) { const x = Number(v); if (v === "" || !Number.isInteger(x) || x < 0 || x > 1000) return `${n} tiene que ser un número entero entre 0 y 1000.`; }
    if (form.activo) { const c = cursoSaturado(form.lugar, form.grado_id, editando === "nueva" ? null : editando); if (c) return textoSaturado(form.lugar, c); }
    return "";
  };

  const guardar = async () => {
    const e = validar(); if (e) { setErrForm(e); return; }
    setGuardando(true); setErrForm("");
    const campos = {
      lugar: form.lugar, npc_nombre: form.npc_nombre.trim() || "Aldeano", npc_sprite: form.npc_sprite || null, titulo: form.titulo.trim(), texto: form.texto.trim(),
      opciones: form.opciones.map((o) => o.trim()), correcta: form.correcta, pista: form.pista.trim(), retro: form.retro.trim(), xp: Number(form.xp), oro: Number(form.oro), orden: Number(form.orden), activo: form.activo,
    };
    if (columnaCurso) campos.grado_id = form.grado_id || null; // si todavía no existe la columna (SQL 63), no se manda para no romper
    if (columnaZona) campos.zona = form.zona;                    // ídem para la zona (SQL 64)
    try {
      if (editando === "nueva") await mundoApi.crearMisionMundo(campos); else await mundoApi.editarMisionMundo(editando, campos);
      await cargar(); setEditando(null); mostrarAviso("Guardada ✓");
    } catch (er) { setErrForm("No se pudo guardar: " + (er.message || "error desconocido") + (/grado_id/i.test(er.message || "") ? "\n\nParece que falta correr 63_mundo_por_curso.sql en Supabase." : /zona/i.test(er.message || "") ? "\n\nParece que falta correr 64_mundo_zonas.sql en Supabase." : "")); }
    setGuardando(false);
  };

  const alternarVisible = async (m) => {
    if (!m.activo) { const c = cursoSaturado(m.lugar, m.grado_id, m.id); if (c) { setError(textoSaturado(m.lugar, c)); return; } }
    setError("");
    try { await mundoApi.editarMisionMundo(m.id, { activo: !m.activo }); await cargar(); } catch (er) { setError("No se pudo cambiar: " + er.message); }
  };
  const borrar = async (m) => {
    const n = conteo[m.id] || 0;
    if (!confirm(`¿Borrar la misión "${m.titulo}"?${n ? `\n\n${n} estudiante${n === 1 ? "" : "s"} la completó; se borra ese registro (los premios ya entregados no se tocan).` : ""}\n\nSi solo quieres que deje de aparecer, mejor ocúltala.`)) return;
    setError("");
    try { await mundoApi.eliminarMisionMundo(m.id); await cargar(); mostrarAviso("Borrada"); } catch (er) { setError("No se pudo borrar: " + er.message); }
  };

  const lista = misiones.filter((m) => (filtro === "todos" || m.zona === filtro) && (filtroCurso === "todos" || (filtroCurso === "generales" ? !m.grado_id : esNivel(filtroCurso) ? !m.grado_id || m.grado_id === filtroCurso || (!esNivel(m.grado_id) && nivelDeGrado(m.grado_id) === nivelDeClave(filtroCurso)) : misionVisiblePara(m.grado_id, filtroCurso))));
  const input = "w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white";
  const sinTabla = /does not exist|relation|schema cache/i.test(error);

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-3" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-bold text-slate-800">🌍 Misiones del Mundo</h3>
          <button onClick={onClose} className="text-slate-400 text-xl" aria-label="Cerrar">×</button>
        </div>
        <p className="text-xs text-slate-400 mb-3">Son las preguntas que tus estudiantes encuentran al hablar con los personajes del mundo. Cada una la da un personaje, en un lugar, y premia con XP y oro. Los cambios se ven apenas se guardan.</p>

        {!sinTabla && !cargando && !editando && !importacion && (
          <div className="inline-flex gap-1 rounded-full bg-slate-100 p-1 mb-3">
            <button type="button" onClick={() => setPestana("misiones")} className={`text-xs px-3 py-1.5 rounded-full ${pestana === "misiones" ? "bg-violet-500 text-white" : "text-slate-600"}`}>🎯 Misiones</button>
            <button type="button" onClick={() => setPestana("zonas")} className={`text-xs px-3 py-1.5 rounded-full ${pestana === "zonas" ? "bg-violet-500 text-white" : "text-slate-600"}`}>🗺️ Zonas</button>
            <button type="button" onClick={() => setPestana("posada")} className={`text-xs px-3 py-1.5 rounded-full ${pestana === "posada" ? "bg-violet-500 text-white" : "text-slate-600"}`}>🛏️ Posada</button>
            <button type="button" onClick={() => setPestana("duelos")} className={`text-xs px-3 py-1.5 rounded-full ${pestana === "duelos" ? "bg-violet-500 text-white" : "text-slate-600"}`}>⚔️ Duelos</button>
            <button type="button" onClick={() => setPestana("retos")} className={`text-xs px-3 py-1.5 rounded-full ${pestana === "retos" ? "bg-violet-500 text-white" : "text-slate-600"}`}>☠️ Retadores</button>
            <button type="button" onClick={() => setPestana("recursos")} className={`text-xs px-3 py-1.5 rounded-full ${pestana === "recursos" ? "bg-violet-500 text-white" : "text-slate-600"}`}>🎒 Recursos</button>
          </div>
        )}
        {sinTabla ? (
          <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3">Todavía no se crearon las tablas de las misiones. Corre <b>62_mundo.sql</b> en el editor SQL de Supabase y vuelve a abrir esto.</div>
        ) : cargando ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : pestana === "recursos" && !editando ? (
          <PanelRecursos />
        ) : pestana === "retos" && !editando ? (
          <PanelRetos misiones={misiones} />
        ) : pestana === "duelos" && !editando ? (
          <PanelDuelos misiones={misiones} />
        ) : pestana === "posada" && !editando ? (
          <PanelPosada />
        ) : pestana === "zonas" && !editando ? (
          <PanelZonas cursos={grados.length ? grados.map((g) => String(g.id)) : cursos} />
        ) : importacion ? (
          <RevisionImportacion analisis={importacion.analisis} archivo={importacion.archivo} aplicando={aplicando} onCancelar={() => setImportacion(null)} onAplicar={aplicarImportacion} />
        ) : editando ? (
          <div>
            <h4 className="text-sm font-bold text-slate-800 mb-3">{editando === "nueva" ? "➕ Nueva misión" : "✏️ Editar misión"}</h4>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">¿Para qué grado o curso es?</label>
                <select value={form.grado_id} onChange={(e) => cambiar("grado_id", e.target.value)} disabled={!columnaCurso} className={input}>
                  <option value="">🌐 Todos los cursos</option>
                  {[...new Set([...niveles, ...(esNivel(form.grado_id) ? [nivelDeClave(form.grado_id)] : [])])].map((n) => <option key={n} value={claveNivel(n)}>📚 Todo {nombreNivel(n).toLowerCase()}{cursosDelNivel(cursos, n).length ? ` (${cursosDelNivel(cursos, n).join(", ")})` : ""}</option>)}
                  {cursos.map((c) => <option key={c} value={c}>🏫 Solo el curso {c}</option>)}
                </select>
                {!columnaCurso && <div className="text-[11px] text-amber-700 mt-1">Para separar por curso, corre primero <b>63_mundo_por_curso.sql</b> en Supabase.</div>}
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">¿En qué zona del mundo?</label>
                <select value={form.zona} onChange={(e) => setForm((f) => ({ ...f, zona: e.target.value, lugar: (zonaPorClave(e.target.value) || ZONAS[0]).lugares[0].key }))} disabled={!columnaZona} className={input}>
                  {ZONAS.map((z) => <option key={z.key} value={z.key}>{z.emoji} {z.nombre}</option>)}
                </select>
                {!columnaZona && <div className="text-[11px] text-amber-700 mt-1">Para usar zonas nuevas, corre primero <b>64_mundo_zonas.sql</b>.</div>}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div><label className="text-[11px] text-slate-500 block mb-1">¿Dónde está?</label>
                <select value={form.lugar} onChange={(e) => cambiar("lugar", e.target.value)} className={input}>{LUGARES.filter((l) => l.zona === form.zona).map((l) => <option key={l.key} value={l.key}>{l.emoji} {l.nombre}</option>)}</select></div>
              <div><label className="text-[11px] text-slate-500 block mb-1">Personaje que la da</label>
                <select value={form.npc_sprite} onChange={(e) => cambiar("npc_sprite", e.target.value)} className={input}><option value="">Automático (según el lugar)</option>{PERSONAJES.map((p) => <option key={p.valor} value={p.valor}>{p.texto}</option>)}</select></div>
              <div className="sm:col-span-2"><label className="text-[11px] text-slate-500 block mb-1">Nombre del personaje (ej: "La bibliotecaria")</label>
                <input value={form.npc_nombre} onChange={(e) => cambiar("npc_nombre", e.target.value)} maxLength={40} className={input} placeholder="Aldeano" /></div>
              <div className="sm:col-span-2"><label className="text-[11px] text-slate-500 block mb-1">Título de la misión</label>
                <input value={form.titulo} onChange={(e) => cambiar("titulo", e.target.value)} maxLength={60} className={input} placeholder="Ej: La regla de oro" /></div>
              <div className="sm:col-span-2"><label className="text-[11px] text-slate-500 block mb-1">Lo que pregunta o plantea</label>
                <textarea value={form.texto} onChange={(e) => cambiar("texto", e.target.value)} rows={3} maxLength={500} className={input} placeholder="Escribe la pregunta o la situación…" /></div>
            </div>

            <div className="mb-3">
              <label className="text-[11px] text-slate-500 block mb-1">Respuestas posibles — marca con el círculo la <b>correcta</b></label>
              {form.opciones.map((o, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <input type="radio" name="correcta" checked={form.correcta === i} onChange={() => cambiar("correcta", i)} aria-label={`La respuesta ${i + 1} es la correcta`} />
                  <input value={o} onChange={(e) => cambiarOpcion(i, e.target.value)} maxLength={120} className={input} placeholder={`Respuesta ${i + 1}`} />
                  <button type="button" onClick={() => quitarOpcion(i)} disabled={form.opciones.length <= MIN_OPCIONES} className="text-slate-400 disabled:opacity-30 text-lg px-1" aria-label="Quitar respuesta">✕</button>
                </div>
              ))}
              {form.opciones.length < MAX_OPCIONES && <button type="button" onClick={agregarOpcion} className="text-xs font-semibold text-violet-600 mt-1">+ Agregar respuesta</button>}
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div><label className="text-[11px] text-slate-500 block mb-1">Pista (si se equivoca)</label><input value={form.pista} onChange={(e) => cambiar("pista", e.target.value)} maxLength={200} className={input} /></div>
              <div><label className="text-[11px] text-slate-500 block mb-1">Mensaje al acertar</label><input value={form.retro} onChange={(e) => cambiar("retro", e.target.value)} maxLength={200} className={input} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div><label className="text-[11px] text-slate-500 block mb-1">✨ XP</label><input type="number" min="0" value={form.xp} onChange={(e) => cambiar("xp", e.target.value)} className={input} /></div>
              <div><label className="text-[11px] text-slate-500 block mb-1">🪙 Oro</label><input type="number" min="0" value={form.oro} onChange={(e) => cambiar("oro", e.target.value)} className={input} /></div>
              <div><label className="text-[11px] text-slate-500 block mb-1">Orden</label><input type="number" min="0" value={form.orden} onChange={(e) => cambiar("orden", e.target.value)} className={input} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 mb-3"><input type="checkbox" checked={form.activo} onChange={(e) => cambiar("activo", e.target.checked)} /> Visible para los estudiantes</label>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 mb-3">
              <div className="text-[10px] font-bold text-slate-400 mb-1.5">VISTA PREVIA — así la ve el estudiante</div>
              <div className="rounded-xl bg-white border border-slate-200 p-3">
                <div className="text-sm font-bold text-slate-800">{form.npc_nombre.trim() || "Aldeano"}</div>
                <div className="text-[11px] font-bold text-violet-600 mb-1">🎯 {form.titulo.trim() || "Título de la misión"}</div>
                <p className="text-sm text-slate-700 mb-2">{form.texto.trim() || "Aquí va lo que pregunta o plantea…"}</p>
                {form.opciones.map((o, i) => (
                  <div key={i} className={`text-sm rounded-lg px-3 py-1.5 mb-1 border-2 ${form.correcta === i ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>{i + 1}. {o.trim() || "…"}{form.correcta === i && <span className="text-[10px] text-emerald-600 font-bold ml-2">✓ correcta</span>}</div>
                ))}
                <div className="text-xs font-bold text-slate-600 mt-2">🎁 +{Number(form.xp) || 0} XP · +{Number(form.oro) || 0} 🪙</div>
              </div>
            </div>

            {errForm && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-2.5 mb-3">{errForm}</div>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setEditando(null); setErrForm(""); }} className="text-sm text-slate-500 px-4 py-2">Cancelar</button>
              <button type="button" onClick={guardar} disabled={guardando} className="text-sm font-bold px-5 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar misión"}</button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <button type="button" onClick={() => setFiltro("todos")} className={`text-xs px-3 py-1.5 rounded-full ${filtro === "todos" ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-600"}`}>Todas ({misiones.length})</button>
              {ZONAS.map((z) => (
                <button key={z.key} type="button" onClick={() => setFiltro(z.key)} className={`text-xs px-3 py-1.5 rounded-full ${filtro === z.key ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-600"}`}>{z.emoji} {z.nombre.split(" ")[0]} ({misiones.filter((m) => m.zona === z.key).length})</button>
              ))}
              <div className="flex-1" />
              {aviso && <span className="text-xs font-semibold text-emerald-600">{aviso}</span>}
              <button type="button" onClick={() => abrirNueva()} className="text-xs font-bold px-4 py-2 rounded-full bg-violet-500 text-white">+ Nueva misión</button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className="text-[11px] font-bold text-slate-400 mr-1">EXCEL</span>
              <button type="button" onClick={bajarPlantilla} className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700">📥 Descargar plantilla</button>
              <button type="button" onClick={exportar} disabled={misiones.length === 0} className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 disabled:opacity-40">📤 Exportar mis misiones</button>
              <button type="button" onClick={() => entradaArchivo.current && entradaArchivo.current.click()} className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-violet-50 text-violet-700">📊 Importar desde Excel</button>
              <input ref={entradaArchivo} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={elegirArchivo} data-testid="archivo-excel" />
            </div>
            {columnaCurso && cursos.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <label className="text-[11px] text-slate-500">Mostrar:</label>
                <select value={filtroCurso} onChange={(e) => setFiltroCurso(e.target.value)} className="text-xs rounded-lg px-2.5 py-1.5 border border-slate-200 bg-white">
                  <option value="todos">Todas las misiones</option><option value="generales">🌐 Solo las de todos los cursos</option>
                  {niveles.map((n) => <option key={n} value={claveNivel(n)}>📚 Lo que ve {nombreNivel(n).toLowerCase()} (todos sus cursos)</option>)}
                  {cursos.map((c) => <option key={c} value={c}>🏫 Lo que ve el curso {c}</option>)}
                </select>
              </div>
            )}
            {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-2.5 mb-3">{error}</div>}
            {lista.length === 0 && <p className="text-sm text-slate-400 py-6 text-center">No hay misiones {filtro === "todos" ? "todavía" : "en esta zona"}. Crea la primera con "+ Nueva misión".</p>}
            <div className="space-y-2">
              {lista.map((m) => {
                const l = nombreLugar(m.lugar), n = conteo[m.id] || 0;
                return (
                  <div key={m.id} className={`rounded-xl border p-3 ${m.activo ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-70"}`}>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-slate-800 truncate">{m.titulo}{!m.activo && <span className="ml-2 text-[10px] font-bold text-slate-500 bg-slate-200 rounded-full px-2 py-0.5">OCULTA</span>}</div>
                        <div className="text-[11px] text-slate-500">{l.emoji} {l.nombre} · {m.npc_nombre} · ✨ {m.xp} XP · 🪙 {m.oro}</div>
                        <div className="text-[11px] mt-0.5"><span className={`rounded-full px-2 py-0.5 font-semibold ${m.grado_id ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-500"}`}>{m.grado_id ? `${esNivel(m.grado_id) ? "📚" : "🏫"} ${etiquetaPara(m.grado_id)}` : "🌐 Todos los cursos"}</span>{m.zona && m.zona !== "aldea" && zonaPorClave(m.zona) && <span className="ml-1.5 rounded-full px-2 py-0.5 font-semibold bg-emerald-50 text-emerald-700">{zonaPorClave(m.zona).emoji} {zonaPorClave(m.zona).nombre}</span>}</div>
                        <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">✅ {n} estudiante{n === 1 ? "" : "s"} {n === 1 ? "la completó" : "la completaron"}</div>
                      </div>
                      <div className="flex flex-wrap gap-1 justify-end shrink-0">
                        <button type="button" onClick={() => abrirEditar(m)} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-50 text-violet-700">Editar</button>
                        <button type="button" onClick={() => abrirNueva({ ...m, titulo: m.titulo + " (copia)", orden: m.orden + 1 })} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">Duplicar</button>
                        <button type="button" onClick={() => alternarVisible(m)} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{m.activo ? "Ocultar" : "Mostrar"}</button>
                        <button type="button" onClick={() => borrar(m)} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-600">Borrar</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ----- Pestaña "Zonas": abrir cada zona por curso y decidir cuántas misiones se piden para entrar -----
function PanelZonas({ cursos }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [req, setReq] = useState({});
  const [ocupado, setOcupado] = useState(false);
  const zonasNuevas = ZONAS.filter((z) => z.previa);

  const cargar = async () => {
    try {
      const d = await mundoApi.fetchZonasAdmin();
      setDatos(d); setReq(Object.fromEntries(zonasNuevas.map((z) => [z.key, String(d.requisitos[z.key] ?? z.requisitoPorDefecto)]))); setError("");
    } catch (e) { setError(e.message || "No se pudieron cargar las zonas."); }
  };
  useEffect(() => { cargar(); }, []);
  const relojAviso = useRef(null);
  useEffect(() => () => clearTimeout(relojAviso.current), []);
  const avisar = (t) => { setAviso(t); clearTimeout(relojAviso.current); relojAviso.current = setTimeout(() => setAviso(""), 2400); };
  const abierta = (c, z) => !!datos && datos.abiertas.some((a) => a.grado_id === String(c) && a.zona === z && a.abierta);

  const alternar = async (c, z) => {
    setError(""); try { await mundoApi.abrirZonaCurso(c, z, !abierta(c, z)); await cargar(); } catch (e) { setError("No se pudo cambiar: " + e.message); }
  };
  const paraTodos = async (z, valor) => {
    setOcupado(true); setError("");
    try { for (const c of cursos) await mundoApi.abrirZonaCurso(c, z, valor); await cargar(); avisar(valor ? "Abierta para todos tus cursos" : "Cerrada para todos tus cursos"); }
    catch (e) { setError("No se pudo cambiar: " + e.message); }
    setOcupado(false);
  };
  const guardarReq = async (z) => {
    const n = Number(req[z]);
    if (req[z] === "" || !Number.isInteger(n) || n < 0 || n > 20) { setError("La cantidad de misiones tiene que ser un número entero entre 0 y 20."); return; }
    setError(""); try { await mundoApi.guardarRequisitoZona(z, n); await cargar(); avisar("Guardado ✓"); } catch (e) { setError("No se pudo guardar: " + e.message); }
  };

  if (error && !datos) {
    const sin = /does not exist|relation|schema cache/i.test(error);
    return <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3">{sin ? <>Todavía no se crearon las tablas de las zonas. Corre <b>64_mundo_zonas.sql</b> en el editor SQL de Supabase y vuelve a abrir esto.</> : error}</div>;
  }
  if (!datos) return <p className="text-sm text-slate-400">Cargando…</p>;

  return (
    <div>
      <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 leading-relaxed">
        Una zona nueva se abre para un estudiante cuando se cumplen <b>las dos cosas</b>: <b>vos la abrís para su curso</b> y <b>él completa</b> las misiones que pidas de la zona anterior.
        Así vos marcás el ritmo de la clase y cada estudiante lo recorre a su paso. Si un curso tiene menos misiones de las que pedís, alcanza con completarlas todas.
      </div>
      {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-2.5 mb-3">{error}</div>}
      {aviso && <div className="text-xs font-semibold text-emerald-600 mb-2">{aviso}</div>}
      {zonasNuevas.map((z) => {
        const previa = zonaPorClave(z.previa);
        return (
          <div key={z.key} className="rounded-xl border border-slate-200 p-4 mb-3">
            <div className="text-sm font-bold text-slate-800 mb-1">{z.emoji} {z.nombre}</div>
            <div className="text-[11px] text-slate-500 mb-3">Se entra desde {previa.emoji} {previa.nombre} por el portón del este. {previa.previa && <>El estudiante también tiene que haber llegado a {previa.nombre}.</>}</div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <label className="text-xs text-slate-600">Misiones de {previa.nombre} que hay que completar:</label>
              <input type="number" min="0" max="20" value={req[z.key] ?? ""} onChange={(e) => setReq((r) => ({ ...r, [z.key]: e.target.value }))} className="w-20 text-sm rounded-lg px-2.5 py-1.5 border border-slate-200 outline-none bg-white" aria-label={`Misiones requeridas para ${z.nombre}`} />
              <button type="button" onClick={() => guardarReq(z.key)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-50 text-violet-700">Guardar</button>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="text-[11px] font-bold text-slate-400">ABRIR PARA</div>
              <div className="flex-1" />
              <button type="button" disabled={ocupado} onClick={() => paraTodos(z.key, true)} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 disabled:opacity-40">Abrir para todos mis cursos</button>
              <button type="button" disabled={ocupado} onClick={() => paraTodos(z.key, false)} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 disabled:opacity-40">Cerrar para todos</button>
            </div>
            {cursos.length === 0 && <p className="text-xs text-slate-400">No encontré cursos para abrir.</p>}
            <div className="space-y-1.5">
              {cursos.map((c) => {
                const ab = abierta(c, z.key);
                return (
                  <div key={c} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
                    <div className="text-sm text-slate-700 flex-1">🏫 Curso {c}</div>
                    <span className={`text-[11px] font-semibold ${ab ? "text-emerald-600" : "text-slate-400"}`}>{ab ? "🔓 Abierta" : "🔒 Cerrada"}</span>
                    <button type="button" onClick={() => alternar(c, z.key)} aria-label={`${ab ? "Cerrar" : "Abrir"} ${z.nombre} para el curso ${c}`} className={`text-[11px] font-bold px-3 py-1 rounded-full ${ab ? "bg-slate-100 text-slate-600" : "bg-violet-500 text-white"}`}>{ab ? "Cerrar" : "Abrir"}</button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ----- Pestaña "Posada": abrirla o cerrarla, cuánto cuesta descansar y cuánta vida da -----
function PanelPosada() {
  const [cfg, setCfg] = useState(null);                 // { activa, costo, vida } como texto, para poder escribir
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const relojAviso = useRef(null);
  useEffect(() => () => clearTimeout(relojAviso.current), []);
  const cargar = async () => {
    try { const c = await mundoApi.fetchConfigMundo(); setCfg({ activa: c.posada_activa === 1, costo: String(c.posada_costo), vida: String(c.posada_vida) }); setError(""); }
    catch (e) { setError(e.message || "No se pudo cargar la posada."); }
  };
  useEffect(() => { cargar(); }, []);

  if (error && !cfg) {
    const sin = /does not exist|relation|schema cache/i.test(error);
    return <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3">{sin ? <>Todavía no se creó la configuración de la posada. Corre <b>65_mundo_posada_y_zonas.sql</b> en el editor SQL de Supabase y vuelve a abrir esto.</> : error}</div>;
  }
  if (!cfg) return <p className="text-sm text-slate-400">Cargando…</p>;

  const costo = Number(cfg.costo), vida = Number(cfg.vida);
  const valido = cfg.costo !== "" && Number.isInteger(costo) && costo >= 0 && costo <= 1000 && cfg.vida !== "" && Number.isInteger(vida) && vida >= 1 && vida <= mundoApi.VIDA_MAX;
  const ejemplo = (v) => mundoApi.planDeDescanso(v, { costo, vida });
  const guardar = async () => {
    if (!valido) { setError(`El costo tiene que ser un número entero entre 0 y 1000, y la vida entre 1 y ${mundoApi.VIDA_MAX}.`); return; }
    setGuardando(true); setError("");
    try {
      await mundoApi.guardarConfigMundo("posada_activa", cfg.activa ? 1 : 0); await mundoApi.guardarConfigMundo("posada_costo", costo); await mundoApi.guardarConfigMundo("posada_vida", vida);
      setAviso("Guardado ✓"); clearTimeout(relojAviso.current); relojAviso.current = setTimeout(() => setAviso(""), 2400);
    } catch (e) { setError("No se pudo guardar: " + (e.message || "error desconocido")); }
    setGuardando(false);
  };
  const input = "w-24 text-sm rounded-lg px-2.5 py-1.5 border border-slate-200 outline-none bg-white";
  const ej60 = valido ? ejemplo(60) : null, ej95 = valido ? ejemplo(95) : null;

  return (
    <div>
      <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 leading-relaxed">
        La <b>🛏️ Posada del Descanso</b> está en la aldea. Ahí los estudiantes recuperan <b>vida</b> a cambio de <b>oro</b>. Vos decidís si está abierta, cuánto cuesta y cuánta vida da.
        La vida y el oro se descuentan de verdad en su progreso, y queda anotado en su historial.
      </div>
      {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-2.5 mb-3">{error}</div>}
      <div className="rounded-xl border border-slate-200 p-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-4"><input type="checkbox" checked={cfg.activa} onChange={(e) => setCfg((c) => ({ ...c, activa: e.target.checked }))} /> La posada está abierta</label>
        <div className="flex flex-wrap items-center gap-2 mb-2 text-sm text-slate-700">
          Recuperar <input type="number" min="1" max={mundoApi.VIDA_MAX} value={cfg.vida} onChange={(e) => setCfg((c) => ({ ...c, vida: e.target.value }))} className={input} aria-label="Vida que se recupera" /> ❤️ de vida cuesta
          <input type="number" min="0" max="1000" value={cfg.costo} onChange={(e) => setCfg((c) => ({ ...c, costo: e.target.value }))} className={input} aria-label="Monedas que cuesta" /> 🪙
        </div>
        <p className="text-[11px] text-slate-400 mb-3">Si al estudiante le falta menos vida de la que se recupera, paga proporcional (nunca de más). Poné 0 monedas para que descansar sea gratis.</p>
        {valido && (
          <div className="text-xs text-slate-600 bg-violet-50 rounded-lg p-3 mb-3" data-testid="ejemplo-posada">
            <b>Ejemplos:</b> con 60 de vida, descansa y recupera <b>{ej60.restaura} ❤️</b> por <b>{ej60.costo} 🪙</b>. Con 95 de vida, recupera <b>{ej95.restaura} ❤️</b> por <b>{ej95.costo} 🪙</b>.
          </div>
        )}
        <div className="flex items-center gap-3 justify-end">
          {aviso && <span className="text-xs font-semibold text-emerald-600">{aviso}</span>}
          <button type="button" onClick={guardar} disabled={guardando} className="text-sm font-bold px-5 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}


// ----- Pestaña "Duelos": reglas de los duelos con los Guardianes, de dónde salen las preguntas y la insignia como requisito -----
function PanelDuelos({ misiones }) {
  const [f, setF] = useState(null);                  // la configuración como texto, para poder escribir
  const [cats, setCats] = useState([]);              // categorías de Preguntados
  const [resumen, setResumen] = useState({});        // cuántos ganaron cada insignia
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const relojAviso = useRef(null);
  useEffect(() => () => clearTimeout(relojAviso.current), []);
  const cargar = async () => {
    try {
      const c = await mundoApi.fetchConfigMundo();
      const g = { activo: c.duelo_activo === 1, aciertos: String(c.duelo_aciertos), vidas: String(c.duelo_vidas), espera: String(c.duelo_espera_min), xp: String(c.duelo_xp), oro: String(c.duelo_oro), banco: {}, exige: {} };
      ZONAS.forEach((z) => { g.banco[z.key] = String(c[`duelo_banco_${z.key}`] ?? 0); g.exige[z.key] = c[`duelo_exige_${z.key}`] === 1; });
      setF(g); setError("");
    } catch (e) { setError(e.message || "No se pudo cargar la configuración."); }
    mundoApi.fetchCategoriasParaDuelo().then(setCats).catch(() => setCats([]));
    mundoApi.fetchInsigniasResumen().then(setResumen).catch(() => setResumen({}));
  };
  useEffect(() => { cargar(); }, []);

  if (error && !f) {
    const sin = /does not exist|relation|schema cache/i.test(error);
    return <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3">{sin ? <>Todavía no se crearon las tablas de los duelos. Corre <b>65_mundo_posada_y_zonas.sql</b> y después <b>66_mundo_duelos.sql</b> en el editor SQL de Supabase y vuelve a abrir esto.</> : error}</div>;
  }
  if (!f) return <p className="text-sm text-slate-400">Cargando…</p>;

  const num = (v) => (v === "" ? NaN : Number(v));
  const rangos = [["aciertos", "Las preguntas a acertar", 1, 20], ["vidas", "Los corazones", 1, 10], ["espera", "La espera", 0, 1440], ["xp", "El XP del premio", 0, 1000], ["oro", "El oro del premio", 0, 1000]];
  const errorDe = () => { for (const [k, nombre, min, max] of rangos) { const n = num(f[k]); if (!Number.isInteger(n) || n < min || n > max) return `${nombre} tiene que ser un número entero entre ${min} y ${max}.`; } return ""; };
  const poolZona = (z) => { const banco = cats.find((c) => String(c.id) === f.banco[z.key]); return { misiones: misiones.filter((m) => m.activo && m.zona === z.key).length, banco: banco ? banco.preguntas : 0 }; };
  const guardar = async () => {
    const e = errorDe(); if (e) { setError(e); return; }
    setGuardando(true); setError("");
    try {
      const pares = [["duelo_activo", f.activo ? 1 : 0], ["duelo_aciertos", num(f.aciertos)], ["duelo_vidas", num(f.vidas)], ["duelo_espera_min", num(f.espera)], ["duelo_xp", num(f.xp)], ["duelo_oro", num(f.oro)]];
      ZONAS.forEach((z) => { pares.push([`duelo_banco_${z.key}`, Number(f.banco[z.key]) || 0]); if (ZONAS.some((x) => x.previa === z.key)) pares.push([`duelo_exige_${z.key}`, f.exige[z.key] ? 1 : 0]); });
      for (const [k, v] of pares) await mundoApi.guardarConfigMundo(k, v);
      setAviso("Guardado ✓"); clearTimeout(relojAviso.current); relojAviso.current = setTimeout(() => setAviso(""), 2400);
    } catch (er) { setError("No se pudo guardar: " + (er.message || "error desconocido")); }
    setGuardando(false);
  };
  const input = "w-20 text-sm rounded-lg px-2.5 py-1.5 border border-slate-200 outline-none bg-white";
  const A = num(f.aciertos), V = num(f.vidas);

  return (
    <div>
      <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 leading-relaxed">
        Cada zona tiene un <b>Guardián</b> que espera en su arena. El estudiante lo reta a un <b>duelo de preguntas</b>: el Guardián tiene una barra de maestría (hay que acertar varias preguntas) y el estudiante tiene corazones (cada error le cuesta uno).
        Al ganar por primera vez recibe la <b>insignia</b> de la zona y un premio. Las preguntas salen de las <b>misiones de esa zona</b> y, si querés, de una categoría de <b>Preguntados</b>.
      </div>
      {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-2.5 mb-3">{error}</div>}
      <div className="rounded-xl border border-slate-200 p-4 mb-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-4"><input type="checkbox" checked={f.activo} onChange={(e) => setF((x) => ({ ...x, activo: e.target.checked }))} /> Los duelos están activos</label>
        <div className="flex flex-wrap items-center gap-2 mb-2 text-sm text-slate-700">
          Para vencer al Guardián hay que acertar <input type="number" min="1" max="20" value={f.aciertos} onChange={(e) => setF((x) => ({ ...x, aciertos: e.target.value }))} className={input} aria-label="Preguntas a acertar" /> preguntas antes de perder
          <input type="number" min="1" max="10" value={f.vidas} onChange={(e) => setF((x) => ({ ...x, vidas: e.target.value }))} className={input} aria-label="Corazones" /> ❤️ corazones.
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-2 text-sm text-slate-700">
          Si pierde, espera <input type="number" min="0" max="1440" value={f.espera} onChange={(e) => setF((x) => ({ ...x, espera: e.target.value }))} className={input} aria-label="Minutos de espera" /> minutos para reintentar <span className="text-[11px] text-slate-400">(0 = sin espera)</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
          Premio de la primera victoria en cada zona: <input type="number" min="0" max="1000" value={f.xp} onChange={(e) => setF((x) => ({ ...x, xp: e.target.value }))} className={input} aria-label="XP del premio" /> ✨ XP y
          <input type="number" min="0" max="1000" value={f.oro} onChange={(e) => setF((x) => ({ ...x, oro: e.target.value }))} className={input} aria-label="Oro del premio" /> 🪙
        </div>
      </div>
      {ZONAS.map((z) => {
        const pl = poolZona(z), total = pl.misiones + pl.banco, esUltima = !ZONAS.some((x) => x.previa === z.key), siguiente = ZONAS.find((x) => x.previa === z.key);
        const faltan = Number.isInteger(A) && total < A, justas = Number.isInteger(A) && Number.isInteger(V) && !faltan && total < A + V - 1;
        return (
          <div key={z.key} className="rounded-xl border border-slate-200 p-4 mb-3">
            <div className="flex items-start gap-2 mb-2">
              <div className="flex-1"><div className="text-sm font-bold text-slate-800">{z.insignia.emoji} {z.insignia.nombre}</div><div className="text-[11px] text-slate-500">Guardián: {z.guardian.nombre} · {z.guardian.titulo} · en {z.emoji} {z.nombre}</div></div>
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 rounded-full px-2.5 py-1">🏅 {resumen[z.key] || 0} {(resumen[z.key] || 0) === 1 ? "estudiante la ganó" : "estudiantes la ganaron"}</span>
            </div>
            <label className="text-[11px] text-slate-500 block mb-1">Preguntas del Guardián</label>
            <select value={f.banco[z.key]} onChange={(e) => setF((x) => ({ ...x, banco: { ...x.banco, [z.key]: e.target.value } }))} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white mb-1" aria-label={`Banco de preguntas de ${z.nombre}`}>
              <option value="0">Solo las misiones de esta zona</option>
              {cats.map((c) => <option key={c.id} value={String(c.id)}>{c.emoji} Preguntados: {c.nombre} ({c.preguntas} {c.preguntas === 1 ? "pregunta" : "preguntas"})</option>)}
            </select>
            <div className={`text-[11px] mb-2 ${faltan ? "text-rose-600 font-semibold" : justas ? "text-amber-700" : "text-slate-400"}`} data-testid={`pool-${z.key}`}>
              {pl.misiones} de misiones{pl.banco ? ` + ${pl.banco} del banco` : ""} = {total} {total === 1 ? "pregunta" : "preguntas"}.{faltan ? ` ⚠️ Con menos de ${A} el Guardián no puede hacer duelos.` : justas ? ` Conviene tener al menos ${A + V - 1} para que se pueda fallar sin quedarse sin preguntas.` : ""}
            </div>
            {!esUltima && <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={f.exige[z.key]} onChange={(e) => setF((x) => ({ ...x, exige: { ...x.exige, [z.key]: e.target.checked } }))} aria-label={`Exigir la insignia de ${z.nombre}`} /> Hace falta esta insignia para pasar a {siguiente.emoji} {siguiente.nombre}</label>}
          </div>
        );
      })}
      <div className="flex items-center gap-3 justify-end">
        {aviso && <span className="text-xs font-semibold text-emerald-600">{aviso}</span>}
        <button type="button" onClick={guardar} disabled={guardando} className="text-sm font-bold px-5 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar duelos"}</button>
      </div>
    </div>
  );
}


// ----- Pestaña "Retadores": personajes hostiles con retos difíciles que quitan vida si el estudiante pierde -----
function PanelRetos({ misiones }) {
  const zonasConRetadores = ZONAS.filter((z) => (z.retadores || []).length);
  const [f, setF] = useState(null);
  const [cats, setCats] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const relojAviso = useRef(null);
  useEffect(() => () => clearTimeout(relojAviso.current), []);
  const cargar = async () => {
    try {
      const c = await mundoApi.fetchConfigMundo();
      const g = { activo: c.reto_activo === 1, danio: String(c.reto_danio), vidaMin: String(c.reto_vida_min), aciertos: String(c.reto_aciertos), vidas: String(c.reto_vidas), tiempo: String(c.reto_tiempo), espera: String(c.reto_espera_min), xp: String(c.reto_xp), oro: String(c.reto_oro), zona: {}, banco: {} };
      zonasConRetadores.forEach((z) => { g.zona[z.key] = c[`reto_zona_${z.key}`] === 1; g.banco[z.key] = String(c[`reto_banco_${z.key}`] ?? 0); });
      setF(g); setError("");
    } catch (e) { setError(e.message || "No se pudo cargar la configuración."); }
    mundoApi.fetchCategoriasParaDuelo().then(setCats).catch(() => setCats([]));
    mundoApi.fetchRetosResumen().then(setResumen).catch(() => setResumen(null));
  };
  useEffect(() => { cargar(); }, []);

  if (error && !f) {
    const sin = /does not exist|relation|schema cache/i.test(error);
    return <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3">{sin ? <>Todavía no se crearon las tablas de los retadores. Corre <b>67_mundo_retadores.sql</b> en el editor SQL de Supabase y vuelve a abrir esto.</> : error}</div>;
  }
  if (!f) return <p className="text-sm text-slate-400">Cargando…</p>;

  const num = (v) => (v === "" ? NaN : Number(v));
  const rangos = [["danio", "La vida que quitan", 1, 50], ["vidaMin", "La vida mínima", 0, 90], ["aciertos", "Las preguntas a acertar", 1, 10], ["vidas", "Los corazones", 1, 5], ["tiempo", "El tiempo por pregunta", 0, 120], ["espera", "La espera", 0, 120], ["xp", "El XP del premio", 0, 1000], ["oro", "El oro del premio", 0, 1000]];
  const errorDe = () => { for (const [k, nombre, min, max] of rangos) { const n = num(f[k]); if (!Number.isInteger(n) || n < min || n > max) return `${nombre} tiene que ser un número entero entre ${min} y ${max}.`; } return ""; };
  const poolZona = (z) => { const banco = cats.find((c) => String(c.id) === f.banco[z.key]); return banco ? { total: banco.preguntas, fuente: `${banco.preguntas} del banco "${banco.nombre}" (solo salen esas)` } : { total: misiones.filter((m) => m.activo && m.zona === z.key).length, fuente: `${misiones.filter((m) => m.activo && m.zona === z.key).length} de las misiones de la zona` }; };
  const guardar = async () => {
    const e = errorDe(); if (e) { setError(e); return; }
    setGuardando(true); setError("");
    try {
      const pares = [["reto_activo", f.activo ? 1 : 0], ["reto_danio", num(f.danio)], ["reto_vida_min", num(f.vidaMin)], ["reto_aciertos", num(f.aciertos)], ["reto_vidas", num(f.vidas)], ["reto_tiempo", num(f.tiempo)], ["reto_espera_min", num(f.espera)], ["reto_xp", num(f.xp)], ["reto_oro", num(f.oro)]];
      zonasConRetadores.forEach((z) => { pares.push([`reto_zona_${z.key}`, f.zona[z.key] ? 1 : 0], [`reto_banco_${z.key}`, Number(f.banco[z.key]) || 0]); });
      for (const [k, v] of pares) await mundoApi.guardarConfigMundo(k, v);
      setAviso("Guardado ✓"); clearTimeout(relojAviso.current); relojAviso.current = setTimeout(() => setAviso(""), 2400);
    } catch (er) { setError("No se pudo guardar: " + (er.message || "error desconocido")); }
    setGuardando(false);
  };
  const input = "w-20 text-sm rounded-lg px-2.5 py-1.5 border border-slate-200 outline-none bg-white";
  const A = num(f.aciertos);

  return (
    <div>
      <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3 mb-3 leading-relaxed">
        <b>☠️ Atención:</b> los retadores quitan <b>vida real</b> (la que ves en la ficha del estudiante) cuando el estudiante pierde. Nunca la bajan de la <b>vida mínima</b> que definas, y no pelean con quien ya está tan herido. La vida se recupera en la 🛏️ Posada a cambio de oro. Si preferís no usar esta función, desmarcá "Los retadores están activos".
      </div>
      <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 leading-relaxed">
        Los <b>retadores</b> son personajes oscuros y peligrosos que le cortan el paso al estudiante en el camino. Lo retan a un <b>duelo difícil</b>: menos corazones, tiempo límite por pregunta y sin pistas. Si gana, recibe un premio y el retador se va para siempre. Si pierde, el retador le quita vida y no vuelve a pelear con él por un rato.
      </div>
      {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-2.5 mb-3">{error}</div>}
      {resumen && <div className="text-[11px] text-slate-500 mb-3" data-testid="resumen-retos">☠️ {Object.values(resumen.derrotados).reduce((a, b) => a + b, 0)} {Object.values(resumen.derrotados).reduce((a, b) => a + b, 0) === 1 ? "retador derrotado" : "retadores derrotados"} · 💔 {resumen.derrotas} {resumen.derrotas === 1 ? "derrota" : "derrotas"} ({resumen.danioTotal} ❤️ quitados en total)</div>}
      <div className="rounded-xl border border-slate-200 p-4 mb-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-4"><input type="checkbox" checked={f.activo} onChange={(e) => setF((x) => ({ ...x, activo: e.target.checked }))} /> Los retadores están activos</label>
        <div className="flex flex-wrap items-center gap-2 mb-2 text-sm text-slate-700">
          Si el estudiante pierde, le quitan <input type="number" min="1" max="50" value={f.danio} onChange={(e) => setF((x) => ({ ...x, danio: e.target.value }))} className={input} aria-label="Vida que quitan" /> ❤️, pero nunca baja de
          <input type="number" min="0" max="90" value={f.vidaMin} onChange={(e) => setF((x) => ({ ...x, vidaMin: e.target.value }))} className={input} aria-label="Vida mínima" /> ❤️
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-2 text-sm text-slate-700">
          Para vencerlos: acertar <input type="number" min="1" max="10" value={f.aciertos} onChange={(e) => setF((x) => ({ ...x, aciertos: e.target.value }))} className={input} aria-label="Preguntas a acertar" /> preguntas antes de perder
          <input type="number" min="1" max="5" value={f.vidas} onChange={(e) => setF((x) => ({ ...x, vidas: e.target.value }))} className={input} aria-label="Corazones" /> ❤️ corazones
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-2 text-sm text-slate-700">
          Tiempo por pregunta: <input type="number" min="0" max="120" value={f.tiempo} onChange={(e) => setF((x) => ({ ...x, tiempo: e.target.value }))} className={input} aria-label="Segundos por pregunta" /> segundos <span className="text-[11px] text-slate-400">(0 = sin tiempo)</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-2 text-sm text-slate-700">
          Si pierde, ese retador no pelea con él por <input type="number" min="0" max="120" value={f.espera} onChange={(e) => setF((x) => ({ ...x, espera: e.target.value }))} className={input} aria-label="Minutos de espera" /> minutos
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
          Premio por derrotar a cada retador (una vez): <input type="number" min="0" max="1000" value={f.xp} onChange={(e) => setF((x) => ({ ...x, xp: e.target.value }))} className={input} aria-label="XP del premio" /> ✨ XP y
          <input type="number" min="0" max="1000" value={f.oro} onChange={(e) => setF((x) => ({ ...x, oro: e.target.value }))} className={input} aria-label="Oro del premio" /> 🪙
        </div>
      </div>
      {zonasConRetadores.map((z) => {
        const pl = poolZona(z), faltan = Number.isInteger(A) && pl.total < A;
        return (
          <div key={z.key} className="rounded-xl border border-slate-200 p-4 mb-3">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-1"><input type="checkbox" checked={f.zona[z.key]} onChange={(e) => setF((x) => ({ ...x, zona: { ...x.zona, [z.key]: e.target.checked } }))} aria-label={`Retadores en ${z.nombre}`} /> {z.emoji} Hay retadores en {z.nombre}</label>
            <div className="text-[11px] text-slate-500 mb-2">{z.retadores.length} retadores: {z.retadores.map((r) => r.nombre).join(" · ")}</div>
            <label className="text-[11px] text-slate-500 block mb-1">Preguntas de los retadores (para que sean difíciles, usá una categoría de Preguntados con preguntas exigentes)</label>
            <select value={f.banco[z.key]} onChange={(e) => setF((x) => ({ ...x, banco: { ...x.banco, [z.key]: e.target.value } }))} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white mb-1" aria-label={`Banco de preguntas de los retadores de ${z.nombre}`}>
              <option value="0">Las preguntas de las misiones de esta zona</option>
              {cats.map((c) => <option key={c.id} value={String(c.id)}>{c.emoji} Preguntados: {c.nombre} ({c.preguntas} {c.preguntas === 1 ? "pregunta" : "preguntas"})</option>)}
            </select>
            <div className={`text-[11px] ${faltan ? "text-rose-600 font-semibold" : "text-slate-400"}`} data-testid={`pool-reto-${z.key}`}>Preguntas disponibles: {pl.fuente}.{faltan ? ` ⚠️ Con menos de ${A} los retadores de esta zona no pelean.` : ""}</div>
          </div>
        );
      })}
      <div className="flex items-center gap-3 justify-end">
        {aviso && <span className="text-xs font-semibold text-emerald-600">{aviso}</span>}
        <button type="button" onClick={guardar} disabled={guardando} className="text-sm font-bold px-5 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar retadores"}</button>
      </div>
    </div>
  );
}


// ----- Pestaña "Recursos": recoger madera, piedra, peces y hierba (cada recolección pide una pregunta) y fabricar objetos -----
function PanelRecursos() {
  const [f, setF] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [parc, setParc] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [faltaSql, setFaltaSql] = useState(false);
  const relojAviso = useRef(null);
  useEffect(() => () => clearTimeout(relojAviso.current), []);
  useEffect(() => {
    (async () => {
      try {
        const c = await mundoApi.fetchConfigMundo();
        setF({ activo: c.recolecta_activo === 1, limite: String(c.recolecta_limite_dia), cantidad: String(c.recolecta_cantidad), espera: String(c.recolecta_espera_min), respawn: String(c.recolecta_respawn_min) });
      } catch (e) { setError(e.message || "No se pudo cargar la configuración."); return; }
      mundoApi.fetchParcelaResumen().then(setParc).catch(() => setParc(false));
      mundoApi.fetchRecolectaResumen().then(setResumen).catch((e) => { if (/does not exist|relation|schema cache/i.test(e.message || "")) setFaltaSql(true); });
    })();
  }, []);
  if (error && !f) return <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3">{error}</div>;
  if (!f) return <p className="text-sm text-slate-400">Cargando…</p>;
  const num = (v) => (v === "" ? NaN : Number(v));
  const rangos = [["limite", "El límite por día", 0, 500], ["cantidad", "La cantidad por recolección", 1, 10], ["espera", "La espera tras equivocarse", 0, 60], ["respawn", "El tiempo para que vuelva el recurso", 0, 60]];
  const errorDe = () => { for (const [k, nombre, min, max] of rangos) { const n = num(f[k]); if (!Number.isInteger(n) || n < min || n > max) return `${nombre} tiene que ser un número entero entre ${min} y ${max}.`; } return ""; };
  const guardar = async () => {
    const e = errorDe(); if (e) { setError(e); return; }
    setGuardando(true); setError("");
    try {
      for (const [k, v] of [["recolecta_activo", f.activo ? 1 : 0], ["recolecta_limite_dia", num(f.limite)], ["recolecta_cantidad", num(f.cantidad)], ["recolecta_espera_min", num(f.espera)], ["recolecta_respawn_min", num(f.respawn)]]) await mundoApi.guardarConfigMundo(k, v);
      setAviso("Guardado ✓"); clearTimeout(relojAviso.current); relojAviso.current = setTimeout(() => setAviso(""), 2400);
    } catch (er) { setError("No se pudo guardar: " + (er.message || "error desconocido")); }
    setGuardando(false);
  };
  const input = "w-20 text-sm rounded-lg px-2.5 py-1.5 border border-slate-200 outline-none bg-white";
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <div>
      <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 leading-relaxed">
        En el Bosque, la Montaña y el Lago hay puntos de recolección (🪵 madera, 🪨 piedra, 🐟 peces, 🌿 hierba). Para recoger, el estudiante <b>responde una pregunta</b> de esa zona. Lo recogido va a su <b>mochila 🎒</b> y con eso puede <b>fabricar</b> herramientas (que dan +1 al recoger), pociones que curan y objetos para decorar su <b>parcela 🏡</b> (un terreno propio al que se entra por el cartel cerca de la plaza).
      </div>
      {faltaSql && <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 mb-3">Todavía no se crearon las tablas de recursos. Corre <b>68_mundo_recursos.sql</b> en el editor SQL de Supabase y vuelve a abrir esto.</div>}
      {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-2.5 mb-3">{error}</div>}
      {resumen && <div className="text-[11px] text-slate-500 mb-3" data-testid="resumen-recursos">🎒 {resumen.recogidas} {resumen.recogidas === 1 ? "unidad recogida" : "unidades recogidas"} por {resumen.estudiantes} {resumen.estudiantes === 1 ? "estudiante" : "estudiantes"}{Object.keys(resumen.porItem).length ? " · " + Object.entries(resumen.porItem).map(([k, n]) => `${ITEMS[k] ? ITEMS[k].emoji : k} ${n}`).join("  ") : ""}</div>}
      {parc === false && <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 mb-3">Todavía no se creó la tabla de las parcelas. Corre <b>69_mundo_parcela.sql</b> en el editor SQL de Supabase y vuelve a abrir esto.</div>}
      {parc && <div className="text-[11px] text-slate-500 mb-3" data-testid="resumen-parcelas">🏡 {parc.piezas} {parc.piezas === 1 ? "pieza colocada" : "piezas colocadas"} en {parc.parcelas} {parc.parcelas === 1 ? "parcela" : "parcelas"}</div>}
      <div className="rounded-xl border border-slate-200 p-4 mb-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-4"><input type="checkbox" checked={f.activo} onChange={(e) => setF((x) => ({ ...x, activo: e.target.checked }))} /> La recolección está activa</label>
        <div className="flex flex-wrap items-center gap-2 mb-2 text-sm text-slate-700">Cada estudiante puede recoger hasta <input type="number" min="0" max="500" value={f.limite} onChange={set("limite")} className={input} aria-label="Límite por día" /> unidades por día <span className="text-[11px] text-slate-400">(0 = sin límite; el día cambia a la medianoche)</span></div>
        <div className="flex flex-wrap items-center gap-2 mb-2 text-sm text-slate-700">Cada recolección da <input type="number" min="1" max="10" value={f.cantidad} onChange={set("cantidad")} className={input} aria-label="Unidades por recolección" /> unidades (la herramienta correcta suma +1)</div>
        <div className="flex flex-wrap items-center gap-2 mb-2 text-sm text-slate-700">Si se equivoca, ese punto queda agotado <input type="number" min="0" max="60" value={f.espera} onChange={set("espera")} className={input} aria-label="Minutos de espera" /> minutos</div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">Después de recogerlo, el punto vuelve en <input type="number" min="0" max="60" value={f.respawn} onChange={set("respawn")} className={input} aria-label="Minutos para que vuelva" /> minutos</div>
      </div>
      <div className="rounded-xl border border-slate-200 p-4 mb-3">
        <div className="text-sm font-bold text-slate-800 mb-2">🔨 Lo que se puede fabricar</div>
        <ul className="text-xs text-slate-600 space-y-1" data-testid="lista-recetas">
          {Object.entries(RECETAS).map(([id, r]) => <li key={id}>{ITEMS[id].emoji} <b>{ITEMS[id].nombre}</b> = {Object.entries(r.ingredientes).map(([k, n]) => `${n} ${ITEMS[k].emoji}`).join(" + ")}{ITEMS[id].desc ? <span className="text-slate-400"> · {ITEMS[id].desc}</span> : null}</li>)}
        </ul>
        <p className="text-[11px] text-slate-400 mt-2">Las preguntas salen de las misiones de cada zona (o de las de todo el mundo si la zona no tiene). Cuantas más misiones cargues, más variadas serán.</p>
      </div>
      <div className="flex items-center gap-3 justify-end">
        {aviso && <span className="text-xs font-semibold text-emerald-600">{aviso}</span>}
        <button type="button" onClick={guardar} disabled={guardando} className="text-sm font-bold px-5 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar recursos"}</button>
      </div>
    </div>
  );
}

// ----- La revisión de un Excel antes de guardar: qué se crea, qué se actualiza, qué tiene errores -----
function RevisionImportacion({ analisis, archivo, aplicando, onCancelar, onAplicar }) {
  const { filas, resumen } = analisis;
  const aplicables = resumen.nuevas + resumen.actualizadas;
  const estado = { nueva: ["✅", "Nueva", "bg-emerald-50 text-emerald-700"], actualiza: ["🔄", "Se actualiza", "bg-sky-50 text-sky-700"], igual: ["＝", "Sin cambios", "bg-slate-100 text-slate-500"], error: ["❌", "Con error", "bg-rose-50 text-rose-700"] };
  return (
    <div>
      <h4 className="text-sm font-bold text-slate-800 mb-1">📊 Revisar antes de importar</h4>
      <p className="text-[11px] text-slate-400 mb-3">Archivo: {archivo}. Todavía no se guardó nada.</p>
      <div className="flex flex-wrap gap-1.5 mb-3" data-testid="resumen-importacion">
        <span className="text-xs font-semibold rounded-full px-3 py-1 bg-emerald-50 text-emerald-700">✅ {resumen.nuevas} nueva{resumen.nuevas === 1 ? "" : "s"}</span>
        <span className="text-xs font-semibold rounded-full px-3 py-1 bg-sky-50 text-sky-700">🔄 {resumen.actualizadas} para actualizar</span>
        <span className="text-xs font-semibold rounded-full px-3 py-1 bg-slate-100 text-slate-500">＝ {resumen.iguales} sin cambios</span>
        <span className={`text-xs font-semibold rounded-full px-3 py-1 ${resumen.errores ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-400"}`}>❌ {resumen.errores} con error</span>
        {resumen.ocultas > 0 && <span className="text-xs font-semibold rounded-full px-3 py-1 bg-amber-50 text-amber-700">🙈 {resumen.ocultas} quedarán ocultas</span>}
        {resumen.ejemplos > 0 && <span className="text-xs rounded-full px-3 py-1 bg-slate-100 text-slate-400">{resumen.ejemplos} de ejemplo ignorada{resumen.ejemplos === 1 ? "" : "s"}</span>}
      </div>
      {resumen.errores > 0 && <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-2.5 mb-3">Las filas con error <b>no se importan</b>. Corrígelas en el Excel y vuelve a importar el mismo archivo: lo que ya está guardado no se duplica.</div>}
      {filas.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">No hay filas para importar (solo ejemplos o filas vacías).</p>}
      <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 mb-3" data-testid="filas-importacion">
        {filas.map((f) => {
          const [icono, texto, color] = estado[f.estado];
          return (
            <div key={f.fila} className="px-3 py-2 text-xs">
              <div className="flex items-start gap-2">
                <span className="text-slate-400 w-12 shrink-0">Fila {f.fila}</span>
                <span className={`rounded-full px-2 py-0.5 font-semibold shrink-0 ${color}`}>{icono} {texto}</span>
                <span className="font-semibold text-slate-700 min-w-0 truncate">{f.titulo || "(sin título)"}</span>
              </div>
              {f.errores.map((e, i) => <div key={i} className="text-rose-600 mt-1 ml-14">• {e}</div>)}
              {f.avisos.map((a, i) => <div key={i} className="text-amber-700 mt-1 ml-14">• {a}</div>)}
            </div>
          );
        })}
      </div>
      {aplicando && <div className="text-xs text-slate-500 mb-2" data-testid="progreso-importacion">Guardando… {aplicando.hecho} de {aplicando.total}</div>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancelar} disabled={!!aplicando} className="text-sm text-slate-500 px-4 py-2 disabled:opacity-40">Cancelar</button>
        <button type="button" onClick={onAplicar} disabled={!!aplicando || aplicables === 0} className="text-sm font-bold px-5 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-40">{aplicando ? "Guardando…" : aplicables === 0 ? "Nada para importar" : `Importar ${aplicables} ${aplicables === 1 ? "misión" : "misiones"}`}</button>
      </div>
    </div>
  );
}
