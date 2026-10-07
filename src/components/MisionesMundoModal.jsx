import React, { useEffect, useRef, useState } from "react";
import * as mundoApi from "../lib/mundoApi";
import { ZONAS, LUGARES, zonaDeLugar, zonaPorClave } from "../game/zonas";
import { esNivel, claveNivel, nivelDeClave, nivelDeGrado, nivelesDe, nombreNivel, etiquetaPara, cursosDelNivel, misionVisiblePara, cursoSaturado as cursoSaturadoDe, etiquetaSaturado } from "../lib/gradosMundo";
import { ITEMS, RECETAS } from "../game/items";
import { TIPOS_ACERTIJO, CLAVES_TIPO, validarContenido } from "../game/acertijos";
import { ESCENAS_SECRETO, OBJETOS_SECRETO, MIN_OPCIONES as MIN_OPC_SEC, MAX_OPCIONES as MAX_OPC_SEC, nombreEscena, validarSecreto } from "../game/secretos";
import { LLAVES, TEXTO_PRUEBA, validarConfigLlaves } from "../game/llaves";
import { TIPOS as TIPOS_MON, CLAVES_TIPO as CLAVES_TIPO_MON, NIVEL_MAX as NIVEL_MAX_MON, EMOJIS_MONSTRUO, ESTATS as ESTATS_MON, NOMBRE_ESTAT as NOMBRE_ESTAT_MON, MAX_PUNTOS_POR_ESTAT as MAX_PTS_MON, CATALOGO_NIVEL_MAX, puntosUsados as puntosUsadosMon, validarCatalogo, statsDe as statsMon } from "../game/monstruos";
import { planEdicion, coincideBusqueda } from "../lib/edicionMasiva";
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

// El menú se agrupa en 4 secciones para no tener una fila interminable de pestañas.
const MENU_MUNDO = [
  { id: "contenido", icono: "📚", nombre: "Contenido", ayuda: "Lo que los estudiantes responden: preguntas con personajes, acertijos y misiones ocultas.", tabs: [["misiones", "🎯 Misiones"], ["acertijos", "🧩 Acertijos"], ["secretos", "🔎 Secretos"]] },
  { id: "mapa", icono: "🗺️", nombre: "Mapa y recursos", ayuda: "Qué zonas están abiertas, qué se puede recolectar y dónde se recuperan.", tabs: [["zonas", "🗺️ Zonas"], ["recursos", "🎒 Recursos"], ["posada", "🛏️ Posada"]] },
  { id: "combate", icono: "⚔️", nombre: "Combate", ayuda: "Guardianes, retadores y monstruos: los duelos del mundo.", tabs: [["duelos", "⚔️ Guardianes"], ["retos", "☠️ Retadores"], ["monstruos", "🐲 Monstruos"]] },
  { id: "aventura", icono: "🏰", nombre: "Aventura", ayuda: "Metas grandes: reinos de la Comarca y las tres llaves de la Cámara del Códice.", tabs: [["comarca", "🏰 Comarca"], ["llaves", "🗝️ Llaves"]] },
];

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
  const [seleccion, setSeleccion] = useState([]);          // ids de las misiones marcadas para editar de una vez
  const [busqueda, setBusqueda] = useState("");
  const [masivo, setMasivo] = useState(null);                // null = panel cerrado; si no: { grado, lugar, xp, oro, visible }
  const [errMasivo, setErrMasivo] = useState("");
  const [aplicandoMasivo, setAplicandoMasivo] = useState(false);
  const [pestana, setPestana] = useState("misiones");       // "misiones" | "zonas"
  const [editando, setEditando] = useState(null); // null | "nueva" | id
  const [form, setForm] = useState(vacia());
  const [errForm, setErrForm] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");

  const cargar = async () => {
    try {
      const [m, c] = await Promise.all([mundoApi.fetchMisionesMundoAdmin(), mundoApi.fetchConteoHechasMundo().catch(() => ({}))]);
      setMisiones(m); setConteo(c); setError(""); setSeleccion((s) => s.filter((id) => m.some((x) => x.id === id)));
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

  const alternarSel = (id) => setSeleccion((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const abrirMasivo = () => { setMasivo({ grado: "", lugar: "", xp: "", oro: "", visible: "" }); setErrMasivo(""); };
  const aplicarMasivo = async () => {
    const plan = planEdicion({ misiones, ids: seleccion, cambios: masivo, cursos, columnaCurso, columnaZona });
    if (!plan.ok) { setErrMasivo(plan.error); return; }
    if (!confirm(`Se cambiarán ${plan.cuantas} ${plan.cuantas === 1 ? "misión" : "misiones"}:\n\n• ${plan.resumen.join("\n• ")}\n\n¿Aplicar?`)) return;
    setAplicandoMasivo(true); setErrMasivo("");
    try { await mundoApi.editarMisionesMundo(seleccion, plan.campos); await cargar(); setMasivo(null); setSeleccion([]); mostrarAviso(`${plan.cuantas} ${plan.cuantas === 1 ? "misión actualizada" : "misiones actualizadas"} ✓`); }
    catch (er) { await cargar(); setErrMasivo(`No se pudo terminar: ${er.message || "error"}${er.hechas ? ` (alcanzaron a cambiar ${er.hechas})` : ""}.`); }
    setAplicandoMasivo(false);
  };
  const borrarMasivo = async () => {
    const sel = misiones.filter((m) => seleccion.includes(m.id)); if (!sel.length) return;
    const hechas = sel.reduce((a, m) => a + (conteo[m.id] || 0), 0);
    if (!confirm(`¿Borrar ${sel.length} ${sel.length === 1 ? "misión" : "misiones"}?${hechas ? `\n\nSe borra también el registro de ${hechas} ${hechas === 1 ? "vez completada" : "veces completadas"} (los premios ya entregados no se tocan).` : ""}\n\nSi solo quieres que dejen de aparecer, mejor ocúltalas.`)) return;
    setAplicandoMasivo(true); setErrMasivo("");
    try { await mundoApi.eliminarMisionesMundo(sel.map((m) => m.id)); await cargar(); setMasivo(null); setSeleccion([]); mostrarAviso("Borradas"); }
    catch (er) { await cargar(); setErrMasivo(`No se pudo terminar: ${er.message || "error"}${er.hechas ? ` (alcanzaron a borrarse ${er.hechas})` : ""}.`); }
    setAplicandoMasivo(false);
  };
  const lista = misiones.filter((m) => (filtro === "todos" || m.zona === filtro) && (filtroCurso === "todos" || (filtroCurso === "generales" ? !m.grado_id : esNivel(filtroCurso) ? !m.grado_id || m.grado_id === filtroCurso || (!esNivel(m.grado_id) && nivelDeGrado(m.grado_id) === nivelDeClave(filtroCurso)) : misionVisiblePara(m.grado_id, filtroCurso))) && coincideBusqueda(m, busqueda));
  const grupoActual = MENU_MUNDO.find((g) => g.tabs.some(([id]) => id === pestana)) || MENU_MUNDO[0];
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
          <div className="mb-3">
            <div className="flex flex-wrap gap-1 rounded-2xl bg-slate-100 p-1" role="tablist" aria-label="Secciones">
              {MENU_MUNDO.map((g) => (
                <button key={g.id} type="button" role="tab" aria-selected={grupoActual.id === g.id} onClick={() => { if (grupoActual.id !== g.id) setPestana(g.tabs[0][0]); }}
                  className={`flex-1 min-w-[7.5rem] text-xs font-semibold px-3 py-2 rounded-xl transition ${grupoActual.id === g.id ? "bg-violet-500 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}>{g.icono} {g.nombre}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2 px-1" role="tablist" aria-label={grupoActual.nombre}>
              {grupoActual.tabs.map(([id, texto]) => (
                <button key={id} type="button" role="tab" aria-selected={pestana === id} onClick={() => setPestana(id)}
                  className={`text-xs px-3 py-1.5 rounded-full border ${pestana === id ? "bg-violet-50 border-violet-400 text-violet-700 font-semibold" : "border-slate-200 text-slate-600 hover:border-violet-300"}`}>{texto}</button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-2 px-1">{grupoActual.ayuda}</p>
          </div>
        )}
        {sinTabla ? (
          <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3">Todavía no se crearon las tablas de las misiones. Corre <b>62_mundo.sql</b> en el editor SQL de Supabase y vuelve a abrir esto.</div>
        ) : cargando ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : pestana === "monstruos" && !editando ? (
          <PanelMonstruos cursos={cursos} niveles={niveles} />
        ) : pestana === "llaves" && !editando ? (
          <PanelLlaves />
        ) : pestana === "comarca" && !editando ? (
          <PanelComarca />
        ) : pestana === "secretos" && !editando ? (
          <PanelSecretos cursos={cursos} niveles={niveles} />
        ) : pestana === "acertijos" && !editando ? (
          <PanelAcertijos cursos={cursos} niveles={niveles} gradoActual={gradoActual} />
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
            {misiones.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-3" data-testid="barra-seleccion">
                <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="🔎 Buscar por título, pregunta o personaje" aria-label="Buscar misiones" className="text-xs rounded-lg px-3 py-1.5 border border-slate-200 bg-white w-64 max-w-full" />
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600"><input type="checkbox" aria-label="Seleccionar todas las que se ven" checked={lista.length > 0 && lista.every((m) => seleccion.includes(m.id))} onChange={(e) => setSeleccion((s) => (e.target.checked ? [...new Set([...s, ...lista.map((m) => m.id)])] : s.filter((id) => !lista.some((m) => m.id === id))))} /> Seleccionar las {lista.length} que se ven</label>
                {seleccion.length > 0 && <button type="button" onClick={() => { setSeleccion([]); setMasivo(null); }} className="text-[11px] text-slate-500 underline">Quitar selección</button>}
              </div>
            )}
            {seleccion.length > 0 && (
              <div className="rounded-xl border-2 border-violet-300 bg-violet-50 p-3 mb-3" data-testid="panel-masivo">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-violet-800">✏️ {seleccion.length} {seleccion.length === 1 ? "misión seleccionada" : "misiones seleccionadas"}</span>
                  {!masivo && <button type="button" onClick={abrirMasivo} className="text-xs font-bold px-3 py-1.5 rounded-full bg-violet-500 text-white">Editar juntas</button>}
                  {!masivo && <button type="button" onClick={borrarMasivo} disabled={aplicandoMasivo} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-rose-50 text-rose-600">Borrar</button>}
                </div>
                {masivo && (
                  <div className="mt-3">
                    <p className="text-[11px] text-slate-500 mb-2">Cambia solo lo que necesites: lo que dejes en “sin cambios” se queda como está en cada misión.</p>
                    <div className="grid sm:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">¿Para qué grado o curso?</label>
                        <select value={masivo.grado} onChange={(e) => setMasivo((x) => ({ ...x, grado: e.target.value }))} disabled={!columnaCurso} aria-label="Grado o curso" className={input}>
                          <option value="">— sin cambios —</option><option value="todos">🌐 Todos los cursos</option>
                          {niveles.map((n) => <option key={n} value={claveNivel(n)}>📚 Todo {nombreNivel(n).toLowerCase()}</option>)}
                          {cursos.map((c) => <option key={c} value={c}>🏫 Solo el curso {c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Mover a este lugar</label>
                        <select value={masivo.lugar} onChange={(e) => setMasivo((x) => ({ ...x, lugar: e.target.value }))} aria-label="Lugar" className={input}>
                          <option value="">— sin cambios —</option>
                          {ZONAS.map((z) => <optgroup key={z.key} label={`${z.emoji} ${z.nombre}`}>{z.lugares.map((l) => <option key={l.key} value={l.key}>{l.emoji} {l.nombre}</option>)}</optgroup>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-700">XP <input type="number" min="0" max="1000" value={masivo.xp} placeholder="—" onChange={(e) => setMasivo((x) => ({ ...x, xp: e.target.value }))} className="w-20 text-sm rounded-lg px-2.5 py-1.5 border border-slate-200 outline-none bg-white" aria-label="XP" /> Oro <input type="number" min="0" max="1000" value={masivo.oro} placeholder="—" onChange={(e) => setMasivo((x) => ({ ...x, oro: e.target.value }))} className="w-20 text-sm rounded-lg px-2.5 py-1.5 border border-slate-200 outline-none bg-white" aria-label="Oro" /></div>
                      <div>
                        <select value={masivo.visible} onChange={(e) => setMasivo((x) => ({ ...x, visible: e.target.value }))} aria-label="Visibilidad" className={input}>
                          <option value="">Visibilidad: sin cambios</option><option value="mostrar">👁️ Mostrarlas</option><option value="ocultar">🙈 Ocultarlas</option>
                        </select>
                      </div>
                    </div>
                    {errMasivo && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-2.5 mb-3" data-testid="error-masivo">{errMasivo}</div>}
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => { setMasivo(null); setErrMasivo(""); }} className="text-sm text-slate-500 px-4 py-2">Cancelar</button>
                      <button type="button" onClick={aplicarMasivo} disabled={aplicandoMasivo} className="text-sm font-bold px-5 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50">{aplicandoMasivo ? "Aplicando…" : `Aplicar a ${seleccion.length}`}</button>
                    </div>
                  </div>
                )}
                {!masivo && errMasivo && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-2.5 mt-2">{errMasivo}</div>}
              </div>
            )}
            {lista.length === 0 && <p className="text-sm text-slate-400 py-6 text-center">No hay misiones {busqueda.trim() ? "que coincidan con la búsqueda" : filtro === "todos" ? "todavía" : "en esta zona"}. Crea la primera con "+ Nueva misión".</p>}
            <div className="space-y-2">
              {lista.map((m) => {
                const l = nombreLugar(m.lugar), n = conteo[m.id] || 0;
                return (
                  <div key={m.id} className={`rounded-xl border p-3 ${seleccion.includes(m.id) ? "border-violet-400 bg-violet-50/50" : m.activo ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-70"}`}>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" checked={seleccion.includes(m.id)} onChange={() => alternarSel(m.id)} aria-label={`Seleccionar ${m.titulo}`} className="mt-1 shrink-0" />
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


// ----- Pestaña "Secretos": objetos brillantes escondidos en el mundo; al examinarlos se responde una pregunta -----
const secretoVacio = () => ({ nombre: "", emoji: "📜", escena: "biblioteca", pista: "", texto: "", opciones: ["", ""], correcta: 0, retro: "", grado_id: "", xp: "30", oro: "10", activo: true });
function PanelSecretos({ cursos, niveles }) {
  const [lista, setLista] = useState(null);
  const [conteo, setConteo] = useState({});
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [faltaSql, setFaltaSql] = useState(false);
  const relojAviso = useRef(null);
  useEffect(() => () => clearTimeout(relojAviso.current), []);
  const avisar = (t) => { setAviso(t); clearTimeout(relojAviso.current); relojAviso.current = setTimeout(() => setAviso(""), 2400); };
  const cargar = async () => {
    try { setLista(await mundoApi.fetchSecretosAdmin()); mundoApi.fetchConteoSecretos().then(setConteo).catch(() => {}); }
    catch (e) { if (/does not exist|relation|schema cache/i.test(e.message || "")) setFaltaSql(true); else setError(e.message || "No se pudieron cargar los secretos."); setLista([]); }
  };
  useEffect(() => { cargar(); }, []);
  if (lista === null) return <p className="text-sm text-slate-400">Cargando…</p>;
  if (faltaSql) return <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3">Todavía no se crearon las tablas de los secretos. Corre <b>71_mundo_secretos.sql</b> en el editor SQL de Supabase y vuelve a abrir esto.</div>;
  const input = "w-full text-sm rounded-lg px-2.5 py-1.5 border border-slate-200 outline-none bg-white";
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const aForm3 = (x) => ({ id: x.id, nombre: x.nombre, emoji: x.emoji, escena: x.escena, pista: x.pista, texto: x.texto, opciones: x.opciones.length ? [...x.opciones] : ["", ""], correcta: x.correcta, retro: x.retro, grado_id: x.grado_id || "", xp: String(x.xp), oro: String(x.oro), activo: x.activo });
  const guardar = async () => {
    const e = validarSecreto(form); if (e) { setError(e); return; }
    setGuardando(true); setError("");
    try {
      if (form.id) await mundoApi.editarSecretoMundo(form.id, form); else await mundoApi.crearSecretoMundo(form);
      setForm(null); avisar("Guardado ✓"); await cargar();
    } catch (er) { setError("No se pudo guardar: " + (er.message || "error desconocido")); }
    setGuardando(false);
  };
  const alternar = async (x) => { try { await mundoApi.editarSecretoMundo(x.id, { ...x, activo: !x.activo }); await cargar(); } catch (er) { setError("No se pudo cambiar: " + (er.message || "")); } };
  const borrar = async (x) => { if (!window.confirm(`¿Borrar el secreto "${x.nombre}"? También se borra el registro de quiénes lo encontraron (los premios ya entregados no se tocan).`)) return; try { await mundoApi.eliminarSecretoMundo(x.id); await cargar(); } catch (er) { setError("No se pudo borrar: " + (er.message || "")); } };

  if (form) {
    const ops = form.opciones;
    const cambiarOp = (i, v) => set("opciones", ops.map((o, k) => (k === i ? v : o)));
    const quitarOp = (i) => setForm((f) => ({ ...f, opciones: f.opciones.filter((_, k) => k !== i), correcta: f.correcta === i ? 0 : f.correcta > i ? f.correcta - 1 : f.correcta }));
    return (
      <div data-testid="form-secreto">
        <h4 className="text-sm font-bold text-slate-800 mb-2">{form.id ? "✏️ Editar secreto" : "➕ Nuevo secreto"}</h4>
        {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-2.5 mb-3" data-testid="error-secreto">{error}</div>}
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div><label className="text-[11px] text-slate-500 block mb-1">Nombre del objeto</label><input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} maxLength={60} className={input} aria-label="Nombre" placeholder="Ej: Pergamino antiguo" /></div>
          <div><label className="text-[11px] text-slate-500 block mb-1">¿Dónde se esconde?</label>
            <select value={form.escena} onChange={(e) => set("escena", e.target.value)} className={input} aria-label="Escena">{ESCENAS_SECRETO.map((x) => <option key={x.key} value={x.key}>{x.emoji} {x.nombre}</option>)}</select></div>
        </div>
        <div className="mb-3"><label className="text-[11px] text-slate-500 block mb-1">¿Cómo se ve?</label>
          <div className="flex flex-wrap gap-1.5">{OBJETOS_SECRETO.map((e) => <button type="button" key={e} onClick={() => set("emoji", e)} aria-label={`Objeto ${e}`} className={`text-xl w-10 h-10 rounded-lg border-2 ${form.emoji === e ? "border-violet-500 bg-violet-50" : "border-slate-200"}`}>{e}</button>)}</div></div>
        <div className="mb-3"><label className="text-[11px] text-slate-500 block mb-1">Rumor (lo cuentan los vecinos mientras no lo encuentren; opcional)</label><input value={form.pista} onChange={(e) => set("pista", e.target.value)} maxLength={160} className={input} aria-label="Rumor" placeholder="Ej: Dicen que algo brilla entre los libros…" /></div>
        <div className="mb-3"><label className="text-[11px] text-slate-500 block mb-1">Pregunta que aparece al examinarlo</label><textarea value={form.texto} onChange={(e) => set("texto", e.target.value)} rows={2} maxLength={400} className={input} aria-label="Pregunta" /></div>
        <div className="mb-3"><label className="text-[11px] text-slate-500 block mb-1">Respuestas (marca la correcta)</label>
          {ops.map((o, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5">
              <input type="radio" name="correcta-secreto" checked={form.correcta === i} onChange={() => set("correcta", i)} aria-label={`Correcta ${i + 1}`} />
              <input value={o} onChange={(e) => cambiarOp(i, e.target.value)} className={input} aria-label={`Respuesta ${i + 1}`} />
              {ops.length > MIN_OPC_SEC && <button type="button" onClick={() => quitarOp(i)} aria-label={`Quitar respuesta ${i + 1}`} className="text-slate-400 text-lg px-1">×</button>}
            </div>
          ))}
          {ops.length < MAX_OPC_SEC && <button type="button" onClick={() => set("opciones", [...ops, ""])} className="text-xs text-violet-600 font-semibold">+ Agregar respuesta</button>}</div>
        <div className="mb-3"><label className="text-[11px] text-slate-500 block mb-1">Mensaje al acertar (opcional)</label><input value={form.retro} onChange={(e) => set("retro", e.target.value)} maxLength={300} className={input} aria-label="Mensaje al acertar" /></div>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div><label className="text-[11px] text-slate-500 block mb-1">Para…</label>
            <select value={form.grado_id} onChange={(e) => set("grado_id", e.target.value)} className={input} aria-label="Grado">
              <option value="">🌐 Todos los cursos</option>
              {[...new Set([...niveles, ...(esNivel(form.grado_id) ? [nivelDeClave(form.grado_id)] : [])])].map((n) => <option key={n} value={claveNivel(n)}>📚 Todo {nombreNivel(n).toLowerCase()}</option>)}
              {cursos.map((c) => <option key={c} value={c}>🏫 Solo el curso {c}</option>)}
            </select></div>
          <div><label className="text-[11px] text-slate-500 block mb-1">XP</label><input type="number" min="0" max="500" value={form.xp} onChange={(e) => set("xp", e.target.value)} className={input} aria-label="XP" /></div>
          <div><label className="text-[11px] text-slate-500 block mb-1">Oro</label><input type="number" min="0" max="500" value={form.oro} onChange={(e) => set("oro", e.target.value)} className={input} aria-label="Oro" /></div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 mb-4"><input type="checkbox" checked={form.activo} onChange={(e) => set("activo", e.target.checked)} /> Visible para los estudiantes</label>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => { setForm(null); setError(""); }} disabled={guardando} className="text-sm text-slate-500 px-4 py-2">Cancelar</button>
          <button type="button" onClick={guardar} disabled={guardando} className="text-sm font-bold px-5 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar secreto"}</button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 leading-relaxed">Los <b>secretos</b> son objetos brillantes (📜 🗝️ 💎…) escondidos en una escena del mundo. El estudiante solo los ve <b>cuando se acerca</b>; al examinarlos responde una pregunta y gana XP y oro <b>una sola vez</b>. Mientras no lo encuentre, los vecinos le cuentan tu <b>rumor</b> como pista. La posición dentro de la escena es fija y la elige el juego.</div>
      {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-2.5 mb-3">{error}</div>}
      <div className="flex items-center gap-3 mb-3"><button type="button" onClick={() => { setError(""); setForm(secretoVacio()); }} className="text-sm font-bold px-4 py-2 rounded-lg bg-violet-500 text-white">➕ Nuevo secreto</button>{aviso && <span className="text-xs font-semibold text-emerald-600">{aviso}</span>}</div>
      {lista.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">Todavía no hay secretos. ¡Esconde el primero!</p>}
      <div className="rounded-xl border border-slate-200 divide-y divide-slate-100" data-testid="lista-secretos">
        {lista.map((x) => (
          <div key={x.id} className={`px-3 py-2.5 flex items-center gap-2 ${x.activo ? "" : "opacity-50"}`}>
            <span className="text-xl">{x.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-800 truncate">{x.nombre}{!x.activo && <span className="ml-2 text-[10px] rounded-full px-2 py-0.5 bg-slate-100 text-slate-500">OCULTO</span>}</div>
              <div className="text-[11px] text-slate-500">{nombreEscena(x.escena).emoji} {nombreEscena(x.escena).nombre} · {x.grado_id ? etiquetaPara(x.grado_id) : "Todos los cursos"} · +{x.xp} XP · +{x.oro} 🪙 · encontrado por {conteo[x.id] || 0}</div>
            </div>
            <button type="button" onClick={() => { setError(""); setForm(aForm3(x)); }} className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">Editar</button>
            <button type="button" onClick={() => alternar(x)} className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">{x.activo ? "Ocultar" : "Mostrar"}</button>
            <button type="button" onClick={() => borrar(x)} className="text-xs px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600">Borrar</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----- Pestaña "Acertijos": sopa de letras, criptograma, ahorcado y rompecabezas de la Casa de los Acertijos -----
const acertijoVacio = (curso) => ({ tipo: "sopa", titulo: "", contenido: "", pista: "", tam: "10", grado_id: curso || "", xp: "20", oro: "5", activo: true });
function PanelAcertijos({ cursos, niveles, gradoActual }) {
  const [lista, setLista] = useState(null);
  const [conteo, setConteo] = useState({});
  const [form, setForm] = useState(null);       // null = viendo la lista; { id?, ...campos } = editando
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [faltaSql, setFaltaSql] = useState(false);
  const relojAviso = useRef(null);
  useEffect(() => () => clearTimeout(relojAviso.current), []);
  const avisar = (t) => { setAviso(t); clearTimeout(relojAviso.current); relojAviso.current = setTimeout(() => setAviso(""), 2400); };
  const cargar = async () => {
    try { setLista(await mundoApi.fetchAcertijosAdmin()); mundoApi.fetchConteoAcertijos().then(setConteo).catch(() => {}); }
    catch (e) { if (/does not exist|relation|schema cache/i.test(e.message || "")) setFaltaSql(true); else setError(e.message || "No se pudieron cargar los acertijos."); setLista([]); }
  };
  useEffect(() => { cargar(); }, []);
  if (lista === null) return <p className="text-sm text-slate-400">Cargando…</p>;
  if (faltaSql) return <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3">Todavía no se crearon las tablas de los acertijos. Corre <b>70_mundo_acertijos.sql</b> en el editor SQL de Supabase y vuelve a abrir esto.</div>;
  const input = "w-full text-sm rounded-lg px-2.5 py-1.5 border border-slate-200 outline-none bg-white";
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const aForm2 = (a) => ({ id: a.id, tipo: a.tipo, titulo: a.titulo, contenido: a.contenido, pista: a.pista, tam: String(a.tam || (a.tipo === "rompe" ? 3 : 10)), grado_id: a.grado_id || "", xp: String(a.xp), oro: String(a.oro), activo: a.activo });
  const errorForm = () => {
    if (!form.titulo.trim()) return "Ponle un título al acertijo.";
    const tam = form.tipo === "sopa" ? Number(form.tam) : undefined; const e = validarContenido(form.tipo, form.contenido, { tam }); if (e) return e;
    for (const [k, n] of [["xp", "El XP"], ["oro", "El oro"]]) { const v = Number(form[k]); if (form[k] === "" || !Number.isInteger(v) || v < 0 || v > 500) return `${n} tiene que ser un número entero entre 0 y 500.`; }
    return "";
  };
  const guardar = async () => {
    const e = errorForm(); if (e) { setError(e); return; }
    setGuardando(true); setError("");
    try {
      const campos = { ...form, tam: form.tipo === "sopa" || form.tipo === "rompe" ? Number(form.tam) : null, xp: Number(form.xp), oro: Number(form.oro) };
      if (form.id) await mundoApi.editarAcertijoMundo(form.id, campos); else await mundoApi.crearAcertijoMundo(campos);
      setForm(null); avisar("Guardado ✓"); await cargar();
    } catch (er) { setError("No se pudo guardar: " + (er.message || "error desconocido")); }
    setGuardando(false);
  };
  const alternar = async (a) => { try { await mundoApi.editarAcertijoMundo(a.id, { ...a, activo: !a.activo }); await cargar(); } catch (er) { setError("No se pudo cambiar: " + (er.message || "")); } };
  const borrar = async (a) => { if (!window.confirm(`¿Borrar el acertijo "${a.titulo}"? También se borra el registro de quiénes lo resolvieron (los premios ya entregados no se tocan).`)) return; try { await mundoApi.eliminarAcertijoMundo(a.id); await cargar(); } catch (er) { setError("No se pudo borrar: " + (er.message || "")); } };

  if (form) {
    const T = TIPOS_ACERTIJO[form.tipo];
    return (
      <div data-testid="form-acertijo">
        <h4 className="text-sm font-bold text-slate-800 mb-2">{form.id ? "✏️ Editar acertijo" : "➕ Nuevo acertijo"}</h4>
        {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-2.5 mb-3" data-testid="error-acertijo">{error}</div>}
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div><label className="text-[11px] text-slate-500 block mb-1">Tipo de juego</label>
            <select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value, tam: e.target.value === "rompe" ? "3" : "10" }))} className={input} aria-label="Tipo">{CLAVES_TIPO.map((k) => <option key={k} value={k}>{TIPOS_ACERTIJO[k].emoji} {TIPOS_ACERTIJO[k].nombre}</option>)}</select></div>
          <div><label className="text-[11px] text-slate-500 block mb-1">¿Para qué grado o curso es?</label>
            <select value={form.grado_id} onChange={(e) => set("grado_id", e.target.value)} className={input} aria-label="Grado">
              <option value="">🌐 Todos los cursos</option>
              {[...new Set([...niveles, ...(esNivel(form.grado_id) ? [nivelDeClave(form.grado_id)] : [])])].map((n) => <option key={n} value={claveNivel(n)}>📚 Todo {nombreNivel(n).toLowerCase()}</option>)}
              {cursos.map((c) => <option key={c} value={c}>🏫 Solo el curso {c}</option>)}
            </select></div>
        </div>
        <div className="mb-3"><label className="text-[11px] text-slate-500 block mb-1">Título (lo ve el estudiante)</label><input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} maxLength={80} className={input} aria-label="Título" placeholder="Ej: Valores de convivencia" /></div>
        <div className="mb-3"><label className="text-[11px] text-slate-500 block mb-1">{form.tipo === "rompe" ? "Enlace de la imagen (opcional)" : form.tipo === "sopa" ? "Palabras a buscar" : "Frase o palabra"}</label>
          <textarea value={form.contenido} onChange={(e) => set("contenido", e.target.value)} rows={form.tipo === "rompe" ? 1 : 3} className={input} aria-label="Contenido" />
          <div className="text-[11px] text-slate-400 mt-1">{T.ayuda}</div></div>
        <div className="mb-3"><label className="text-[11px] text-slate-500 block mb-1">Pista (opcional)</label><input value={form.pista} onChange={(e) => set("pista", e.target.value)} maxLength={140} className={input} aria-label="Pista" /></div>
        <div className="grid grid-cols-3 gap-3 mb-3">
          {(form.tipo === "sopa" || form.tipo === "rompe") && <div><label className="text-[11px] text-slate-500 block mb-1">{form.tipo === "sopa" ? "Tamaño (8 a 16)" : "Fichas por lado"}</label>
            {form.tipo === "sopa" ? <input type="number" min="8" max="16" value={form.tam} onChange={(e) => set("tam", e.target.value)} className={input} aria-label="Tamaño" /> : <select value={form.tam} onChange={(e) => set("tam", e.target.value)} className={input} aria-label="Tamaño"><option value="3">3 × 3 (fácil)</option><option value="4">4 × 4 (difícil)</option></select>}</div>}
          <div><label className="text-[11px] text-slate-500 block mb-1">XP</label><input type="number" min="0" max="500" value={form.xp} onChange={(e) => set("xp", e.target.value)} className={input} aria-label="XP" /></div>
          <div><label className="text-[11px] text-slate-500 block mb-1">Oro</label><input type="number" min="0" max="500" value={form.oro} onChange={(e) => set("oro", e.target.value)} className={input} aria-label="Oro" /></div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 mb-4"><input type="checkbox" checked={form.activo} onChange={(e) => set("activo", e.target.checked)} /> Visible para los estudiantes</label>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => { setForm(null); setError(""); }} disabled={guardando} className="text-sm text-slate-500 px-4 py-2">Cancelar</button>
          <button type="button" onClick={guardar} disabled={guardando} className="text-sm font-bold px-5 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar acertijo"}</button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 leading-relaxed">En la <b>Casa de los Acertijos</b> (una casa nueva en la aldea) hay una mesa por juego: 🔤 sopa de letras, 🔐 criptograma, 🪢 ahorcado y 🧩 rompecabezas. Tú cargas el contenido aquí y cada estudiante gana el premio <b>una sola vez</b> por acertijo (después puede repetirlo por diversión). La cuadrícula, los números y el orden se mezclan solos cada vez.</div>
      {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-2.5 mb-3">{error}</div>}
      <div className="flex items-center gap-3 mb-3"><button type="button" onClick={() => { setError(""); setForm(acertijoVacio(gradoActual && nivelDeGrado(gradoActual) ? "" : "")); }} className="text-sm font-bold px-4 py-2 rounded-lg bg-violet-500 text-white">➕ Nuevo acertijo</button>{aviso && <span className="text-xs font-semibold text-emerald-600">{aviso}</span>}</div>
      {lista.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">Todavía no hay acertijos. ¡Crea el primero!</p>}
      <div className="rounded-xl border border-slate-200 divide-y divide-slate-100" data-testid="lista-acertijos">
        {lista.map((a) => (
          <div key={a.id} className={`px-3 py-2.5 flex items-center gap-2 ${a.activo ? "" : "opacity-50"}`}>
            <span className="text-xl">{TIPOS_ACERTIJO[a.tipo]?.emoji || "🧩"}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-800 truncate">{a.titulo}{!a.activo && <span className="ml-2 text-[10px] rounded-full px-2 py-0.5 bg-slate-100 text-slate-500">OCULTO</span>}</div>
              <div className="text-[11px] text-slate-500">{TIPOS_ACERTIJO[a.tipo]?.nombre} · {a.grado_id ? etiquetaPara(a.grado_id) : "Todos los cursos"} · +{a.xp} XP · +{a.oro} 🪙 · resuelto por {conteo[a.id] || 0}</div>
            </div>
            <button type="button" onClick={() => { setError(""); setForm(aForm2(a)); }} className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">Editar</button>
            <button type="button" onClick={() => alternar(a)} className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">{a.activo ? "Ocultar" : "Mostrar"}</button>
            <button type="button" onClick={() => borrar(a)} className="text-xs px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600">Borrar</button>
          </div>
        ))}
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

// ----- Las Tres Llaves y la Cámara del Códice -----
function PanelLlaves() {
  const [f, setF] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const relojAviso = useRef(null);
  useEffect(() => () => clearTimeout(relojAviso.current), []);
  useEffect(() => {
    (async () => {
      try {
        const c = await mundoApi.fetchConfigMundo();
        setF({ activo: c.llaves_activo === 1, orden: c.llaves_orden === 1, xp: String(c.llaves_xp), oro: String(c.llaves_oro), aciertos: String(c.llaves_duelo_aciertos), vidas: String(c.llaves_duelo_vidas) });
      } catch (e) { setError(e.message || "No se pudo cargar la configuración."); return; }
      mundoApi.fetchLlavesResumen().then(setResumen).catch(() => setResumen(false));
    })();
  }, []);
  if (error && !f) return <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3">{error}</div>;
  if (!f) return <p className="text-sm text-slate-400">Cargando…</p>;
  const guardar = async () => {
    const e = validarConfigLlaves(f); if (e) { setError(e); return; }
    setGuardando(true); setError("");
    try {
      for (const [k, v] of [["llaves_activo", f.activo ? 1 : 0], ["llaves_orden", f.orden ? 1 : 0], ["llaves_xp", Number(f.xp)], ["llaves_oro", Number(f.oro)], ["llaves_duelo_aciertos", Number(f.aciertos)], ["llaves_duelo_vidas", Number(f.vidas)]]) await mundoApi.guardarConfigMundo(k, v);
      setAviso("Guardado ✓"); clearTimeout(relojAviso.current); relojAviso.current = setTimeout(() => setAviso(""), 2400);
    } catch (er) { setError("No se pudo guardar: " + (er.message || "error desconocido")); }
    setGuardando(false);
  };
  const input = "w-20 text-sm rounded-lg px-2.5 py-1.5 border border-slate-200 outline-none bg-white";
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <div>
      <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 leading-relaxed">
        Para empezar a <b>recorrer todo el mundo</b>: hay <b>3 llaves escondidas</b>, cada una en una zona y con su propia prueba. Con las 3 se abre la puerta sellada de la <b>🔐 Cámara del Códice</b> (en la aldea) y se reclama un cofre con un premio grande.
        <ul className="mt-2 space-y-1">{LLAVES.map((l) => <li key={l.n}>{l.medalla} <b>{l.nombre}</b> · {l.lugar} · {TEXTO_PRUEBA[l.prueba]}{l.prueba === "acertijo" ? " (usa tus acertijos; si no hay, una pregunta)" : l.prueba === "pregunta" ? " (de las misiones de la zona)" : " (con preguntas de las misiones)"}</li>)}</ul>
        <p className="mt-2">La puerta y cada llave dan una <b>pista</b> de dónde buscar la siguiente. Las preguntas salen de tus misiones del mundo, y los acertijos de la 🧩 Casa de los Acertijos. Cada estudiante recibe el premio del cofre <b>una sola vez</b>.</p>
      </div>
      {resumen === false && <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 mb-3">Todavía no se crearon las tablas de las llaves. Corre <b>73_mundo_llaves.sql</b> en el editor SQL de Supabase y vuelve a abrir esto.</div>}
      {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-2.5 mb-3">{error}</div>}
      {resumen && <div className="text-[11px] text-slate-500 mb-3" data-testid="resumen-llaves">🗝️ {resumen.estudiantes} {resumen.estudiantes === 1 ? "estudiante ha conseguido" : "estudiantes han conseguido"} llaves · 🥉 {resumen.porLlave[1]} · 🥈 {resumen.porLlave[2]} · 🥇 {resumen.porLlave[3]} · 🔐 {resumen.abiertas} {resumen.abiertas === 1 ? "cofre abierto" : "cofres abiertos"}</div>}
      <div className="rounded-xl border border-slate-200 p-4 mb-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3"><input type="checkbox" checked={f.activo} onChange={(e) => setF((x) => ({ ...x, activo: e.target.checked }))} /> Las llaves y la Cámara están activas</label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-1"><input type="checkbox" checked={f.orden} onChange={(e) => setF((x) => ({ ...x, orden: e.target.checked }))} /> Hay que conseguirlas en orden (bronce → plata → oro)</label>
        <p className="text-[11px] text-slate-400 mb-3 ml-6">Con orden, cada llave da la pista de la siguiente y siguen un hilo. Sin orden, pueden buscarlas en cualquier orden.</p>
        <div className="flex flex-wrap items-center gap-2 mb-2 text-sm text-slate-700">El cofre da <input type="number" min="0" max="1000" value={f.xp} onChange={set("xp")} className={input} aria-label="XP del cofre" /> XP y <input type="number" min="0" max="1000" value={f.oro} onChange={set("oro")} className={input} aria-label="Oro del cofre" /> 🪙</div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">En el duelo de la llave de plata hay que acertar <input type="number" min="1" max="10" value={f.aciertos} onChange={set("aciertos")} className={input} aria-label="Aciertos del duelo" /> preguntas antes de perder <input type="number" min="1" max="10" value={f.vidas} onChange={set("vidas")} className={input} aria-label="Corazones del duelo" /> ❤️</div>
      </div>
      <div className="flex items-center gap-3 justify-end">
        {aviso && <span className="text-xs font-semibold text-emerald-600">{aviso}</span>}
        <button type="button" onClick={guardar} disabled={guardando} className="text-sm font-bold px-5 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar llaves"}</button>
      </div>
    </div>
  );
}

// ----- Laboratorio de monstruos y duelos (SQL 74) -----
const CAMPOS_MON = [
  ["monstruos_equipo_max", "equipoMax", 1, 6, "Monstruos por estudiante (máximo)"],
  ["monstruos_puntos", "puntos", 4, 40, "Puntos para repartir al crear (vida, ataque, defensa, velocidad)"],
  ["monstruos_premios_dia", "premiosDia", 0, 50, "Victorias con premio por día (después, solo diversión)"],
  ["monstruos_xp", "xp", 0, 200, "XP base por victoria (se ajusta según el nivel del rival)"],
  ["monstruos_oro", "oro", 0, 200, "Oro base por victoria"],
  ["monstruos_capturas_dia", "capturasDia", 0, 20, "Capturas de salvajes por día (por estudiante)"],
];
function PanelMonstruos({ cursos = [], niveles = [] }) {
  const [f, setF] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const relojAviso = useRef(null);
  useEffect(() => () => clearTimeout(relojAviso.current), []);
  useEffect(() => {
    (async () => {
      try {
        const c = await mundoApi.fetchConfigMundo();
        const x = { activo: c.monstruos_activo === 1, captura: c.monstruos_captura_activo === 1, puntosCfg: c.monstruos_puntos }; CAMPOS_MON.forEach(([clave, k]) => { x[k] = String(c[clave]); });
        setF(x);
      } catch (e) { setError(e.message || "No se pudo cargar la configuración."); return; }
      mundoApi.fetchMonstruosResumen().then(setResumen).catch(() => setResumen(false));
    })();
  }, []);
  if (error && !f) return <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3">{error}</div>;
  if (!f) return <p className="text-sm text-slate-400">Cargando…</p>;
  const guardar = async () => {
    for (const [, k, mn, mx, txt] of CAMPOS_MON) { const n = Number(f[k]); if (f[k] === "" || !Number.isInteger(n) || n < mn || n > mx) { setError(`"${txt}": escribe un número entero entre ${mn} y ${mx}.`); return; } }
    setGuardando(true); setError("");
    try {
      await mundoApi.guardarConfigMundo("monstruos_activo", f.activo ? 1 : 0);
      await mundoApi.guardarConfigMundo("monstruos_captura_activo", f.captura ? 1 : 0);
      for (const [clave, k] of CAMPOS_MON) await mundoApi.guardarConfigMundo(clave, Number(f[k]));
      setAviso("Guardado ✓"); clearTimeout(relojAviso.current); relojAviso.current = setTimeout(() => setAviso(""), 2400);
    } catch (er) { setError("No se pudo guardar: " + (er.message || "error desconocido")); }
    setGuardando(false);
  };
  const input = "w-20 text-sm rounded-lg px-2.5 py-1.5 border border-slate-200 outline-none bg-white";
  return (
    <div>
      <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 leading-relaxed">
        Cada estudiante <b>crea su monstruo</b> en el <b>🧪 Laboratorio</b> de la aldea: elige nombre, aspecto, tipo y reparte puntos. Con él reta a los <b>monstruos salvajes</b> y a los <b>jefes</b> del Bosque, la Montaña y el Lago.
        <ul className="mt-2 space-y-1">
          <li>🔥→🌿→⚡→💧→🔥 <b>Tipos:</b> {CLAVES_TIPO_MON.map((t) => `${TIPOS_MON[t].emoji} ${TIPOS_MON[t].nombre} (${TIPOS_MON[t].lema})`).join(" · ")}. Cada tipo pega fuerte al siguiente.</li>
          <li>📈 <b>Niveles:</b> el monstruo gana XP en cada victoria y sube hasta el nivel {NIVEL_MAX_MON}; cada nivel lo hace más fuerte. Los rivales tienen su propio nivel: ganarle a uno más fuerte da más premio.</li>
          <li>🎯 <b>Pregunta para atacar:</b> por turnos; el estudiante elige habilidad y responde una pregunta (de tus misiones de la zona) para pegar fuerte. ⚡ <b>Pelea rápida:</b> pelean solos y cada 3 rondas hay una pregunta clave (premio algo menor).</li>
        </ul>
        <p className="mt-2">Los resultados los informa el juego (no se pueden verificar), por eso hay un <b>tope diario</b> de victorias con premio. El premio de XP y oro cuenta como cualquier otra actividad del mundo.</p>
      </div>
      {resumen === false && <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 mb-3">Todavía no se crearon las tablas de los monstruos. Corre <b>74_mundo_monstruos.sql</b> en el editor SQL de Supabase y vuelve a abrir esto.</div>}
      {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-2.5 mb-3">{error}</div>}
      {resumen && <div className="text-[11px] text-slate-500 mb-3" data-testid="resumen-monstruos">🐲 {resumen.monstruos} {resumen.monstruos === 1 ? "monstruo creado" : "monstruos creados"} por {resumen.estudiantes} {resumen.estudiantes === 1 ? "estudiante" : "estudiantes"} · ⚔️ {resumen.duelos} duelos ({resumen.victorias} victorias) · {CLAVES_TIPO_MON.map((t) => `${TIPOS_MON[t].emoji} ${resumen.porTipo[t] || 0}`).join(" · ")}</div>}
      <div className="rounded-xl border border-slate-200 p-4 mb-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3"><input type="checkbox" checked={f.activo} onChange={(e) => setF((x) => ({ ...x, activo: e.target.checked }))} /> El Laboratorio y los duelos de monstruos están activos</label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3"><input type="checkbox" checked={f.captura} onChange={(e) => setF((x) => ({ ...x, captura: e.target.checked }))} /> 🎯 Se puede intentar capturar a los salvajes después de vencerlos (los jefes no)</label>
        <div className="space-y-2">
          {CAMPOS_MON.map(([clave, k, mn, mx, txt]) => (
            <label key={clave} className="flex flex-wrap items-center gap-2 text-sm text-slate-700"><input type="number" min={mn} max={mx} value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} className={input} aria-label={txt} /> {txt}</label>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 justify-end">
        {aviso && <span className="text-xs font-semibold text-emerald-600">{aviso}</span>}
        <button type="button" onClick={guardar} disabled={guardando} className="text-sm font-bold px-5 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar monstruos"}</button>
      </div>
      <CatalogoMonstruos cursos={cursos} niveles={niveles} puntos={Number(f.puntosCfg) || 20} />
    </div>
  );
}

// El catálogo: monstruos que prepara la docente y que los estudiantes adoptan en la máquina del Laboratorio
function CatalogoMonstruos({ cursos, niveles, puntos }) {
  const vacio = () => ({ id: null, nombre: "", tipo: "fuego", emoji: EMOJIS_MONSTRUO[0], nivel: 1, grado_id: "", puntos: (() => { const r = Math.floor(puntos / 4); return { hp: r + (puntos - r * 4), atk: r, def: r, vel: r }; })() });
  const [lista, setLista] = useState(null);
  const [conteo, setConteo] = useState({});
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const relojAviso = useRef(null);
  useEffect(() => () => clearTimeout(relojAviso.current), []);
  const cargar = async () => {
    try { setLista(await mundoApi.fetchCatalogoMonstruosAdmin()); mundoApi.fetchConteoCatalogo().then(setConteo).catch(() => {}); setError(""); }
    catch (e) { setLista(false); setError(e.message || "No se pudo cargar el catálogo."); }
  };
  useEffect(() => { cargar(); }, []);
  const mostrarAviso = (t) => { setAviso(t); clearTimeout(relojAviso.current); relojAviso.current = setTimeout(() => setAviso(""), 2400); };
  const input = "w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white";
  const set = (k, v) => setForm((x) => ({ ...x, [k]: v }));
  const ajustar = (k, d) => setForm((x) => ({ ...x, puntos: { ...x.puntos, [k]: x.puntos[k] + d } }));
  const guardar = async () => {
    const e = validarCatalogo(form, { puntos }); if (e) { setError(e); return; }
    setGuardando(true); setError("");
    try { await mundoApi.guardarCatalogoMonstruo(form, form.id); await cargar(); setForm(null); mostrarAviso(form.id != null ? "Cambios guardados ✓" : "Agregado al catálogo ✓"); }
    catch (er) { setError("No se pudo guardar: " + (er.message || "error")); }
    setGuardando(false);
  };
  const alternar = async (x) => { try { await mundoApi.alternarCatalogoMonstruo(x.id, !x.activo); await cargar(); } catch (er) { setError("No se pudo cambiar: " + er.message); } };
  const borrar = async (x) => {
    const n = conteo[x.id] || 0;
    if (!confirm(`¿Quitar a "${x.nombre}" del catálogo?${n ? `\n\n${n} estudiante${n === 1 ? "" : "s"} ya lo adoptó; sus monstruos se quedan como están.` : ""}\n\nSi solo quieres que deje de aparecer, mejor ocúltalo.`)) return;
    try { await mundoApi.eliminarCatalogoMonstruo(x.id); await cargar(); mostrarAviso("Quitado"); } catch (er) { setError("No se pudo quitar: " + er.message); }
  };
  if (lista === false) return <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 mt-4">Para el catálogo y la captura corre <b>75_mundo_catalogo_monstruos.sql</b> en el editor SQL de Supabase y vuelve a abrir esto.{error ? ` (${error})` : ""}</div>;
  if (!lista) return <p className="text-sm text-slate-400 mt-4">Cargando catálogo…</p>;
  const usados = form ? puntosUsadosMon(form.puntos) : 0, st = form ? statsMon({ puntos: form.puntos, nivel: form.nivel || 1 }) : null;
  return (
    <div className="mt-5 border-t border-slate-200 pt-4" data-testid="catalogo-monstruos">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-bold text-slate-800">📖 Catálogo del Laboratorio</h4>
        {!form && <button type="button" onClick={() => { setForm(vacio()); setError(""); }} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-violet-500 text-white">+ Nuevo monstruo</button>}
      </div>
      <p className="text-[11px] text-slate-400 mb-3">Monstruos que preparas tú: cada estudiante puede adoptar cada uno una vez (cuenta para su equipo). Puedes darles un nivel inicial de 1 a {CATALOGO_NIVEL_MAX} y elegir qué curso los ve.</p>
      {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-2.5 mb-3">{error}</div>}
      {aviso && <div className="text-xs font-semibold text-emerald-600 mb-2">{aviso}</div>}
      {form ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 mb-3">
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div><label className="text-[11px] text-slate-500 block mb-1">Nombre</label><input value={form.nombre} maxLength={20} onChange={(e) => set("nombre", e.target.value)} className={input} aria-label="Nombre del monstruo" placeholder="Ej: Sabio Ético" /></div>
            <div><label className="text-[11px] text-slate-500 block mb-1">Nivel inicial</label>
              <select value={form.nivel} onChange={(e) => set("nivel", Number(e.target.value))} className={input} aria-label="Nivel inicial">{Array.from({ length: CATALOGO_NIVEL_MAX }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Nivel {n}</option>)}</select></div>
            <div><label className="text-[11px] text-slate-500 block mb-1">¿Quién lo ve?</label>
              <select value={form.grado_id} onChange={(e) => set("grado_id", e.target.value)} className={input} aria-label="Curso del monstruo">
                <option value="">🌐 Todos los cursos</option>
                {[...new Set([...niveles, ...(esNivel(form.grado_id) ? [nivelDeClave(form.grado_id)] : [])])].map((n) => <option key={n} value={claveNivel(n)}>📚 Todo {nombreNivel(n).toLowerCase()}</option>)}
                {cursos.map((c) => <option key={c} value={c}>🏫 Solo el curso {c}</option>)}
              </select></div>
            <div><label className="text-[11px] text-slate-500 block mb-1">Tipo</label>
              <div className="flex flex-wrap gap-1">{CLAVES_TIPO_MON.map((t) => <button key={t} type="button" onClick={() => set("tipo", t)} aria-pressed={form.tipo === t} className={`text-xs px-2.5 py-1.5 rounded-lg border ${form.tipo === t ? "border-violet-500 bg-violet-100 font-semibold" : "border-slate-200 bg-white"}`}>{TIPOS_MON[t].emoji} {TIPOS_MON[t].nombre}</button>)}</div></div>
          </div>
          <label className="text-[11px] text-slate-500 block mb-1">Aspecto</label>
          <div className="flex flex-wrap gap-1 mb-3">{EMOJIS_MONSTRUO.map((e) => <button key={e} type="button" onClick={() => set("emoji", e)} aria-pressed={form.emoji === e} className={`text-xl w-10 h-10 rounded-lg border ${form.emoji === e ? "border-violet-500 bg-violet-100" : "border-slate-200 bg-white"}`}>{e}</button>)}</div>
          <label className="text-[11px] text-slate-500 block mb-1">Puntos · quedan <b>{puntos - usados}</b> de {puntos} (máximo {MAX_PTS_MON} por estadística)</label>
          <div className="grid grid-cols-2 gap-2 mb-3">{ESTATS_MON.map((k) => (
            <div key={k} className="flex items-center gap-2 text-sm text-slate-700"><span className="w-24">{NOMBRE_ESTAT_MON[k]} <small className="text-slate-400">({st[k]})</small></span>
              <button type="button" onClick={() => ajustar(k, -1)} disabled={form.puntos[k] <= 0} className="w-7 h-7 rounded-lg border border-slate-200 bg-white disabled:opacity-40" aria-label={`menos ${NOMBRE_ESTAT_MON[k]}`}>−</button><b className="w-5 text-center">{form.puntos[k]}</b>
              <button type="button" onClick={() => ajustar(k, 1)} disabled={form.puntos[k] >= MAX_PTS_MON || usados >= puntos} className="w-7 h-7 rounded-lg border border-slate-200 bg-white disabled:opacity-40" aria-label={`más ${NOMBRE_ESTAT_MON[k]}`}>+</button></div>))}</div>
          <div className="flex items-center gap-2 justify-end">
            <button type="button" onClick={() => { setForm(null); setError(""); }} className="text-sm px-4 py-2 rounded-lg border border-slate-200 text-slate-600">Cancelar</button>
            <button type="button" onClick={guardar} disabled={guardando} className="text-sm font-bold px-5 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50">{guardando ? "Guardando…" : form.id != null ? "Guardar cambios" : "Agregar al catálogo"}</button>
          </div>
        </div>
      ) : null}
      {lista.length === 0 && !form ? <p className="text-xs text-slate-400">Todavía no hay monstruos en el catálogo.</p> : (
        <ul className="space-y-2">{lista.map((x) => (
          <li key={x.id} className={`flex items-center gap-3 rounded-xl border p-3 ${x.activo ? "border-slate-200" : "border-slate-200 bg-slate-50 opacity-70"}`}>
            <span className="text-2xl">{x.emoji}</span>
            <div className="flex-1 min-w-0"><div className="text-sm font-semibold text-slate-800 truncate">{x.nombre} <span className="text-[11px] font-normal text-slate-500">· {TIPOS_MON[x.tipo].emoji} {TIPOS_MON[x.tipo].nombre} · Nv {x.nivel}</span></div>
              <div className="text-[11px] text-slate-500">{x.grado_id ? etiquetaPara(x.grado_id) : "Todos los cursos"} · adoptado por {conteo[x.id] || 0}{x.activo ? "" : " · oculto"}</div></div>
            <div className="flex gap-1 text-xs">
              <button type="button" onClick={() => { setForm({ ...x, puntos: { ...x.puntos } }); setError(""); }} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600">Editar</button>
              <button type="button" onClick={() => alternar(x)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600">{x.activo ? "Ocultar" : "Mostrar"}</button>
              <button type="button" onClick={() => borrar(x)} className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600">Quitar</button>
            </div>
          </li>))}</ul>
      )}
    </div>
  );
}

// ----- La Sala de la Comarca: aportes de GP/FP y batallas entre reinos -----
function PanelComarca() {
  const [f, setF] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const relojAviso = useRef(null);
  useEffect(() => () => clearTimeout(relojAviso.current), []);
  useEffect(() => {
    (async () => {
      try {
        const c = await mundoApi.fetchConfigMundo();
        setF({ activo: c.comarca_activo === 1, aportes: c.comarca_aportes_activo === 1, oroGp: String(c.comarca_oro_por_gp), xpFp: String(c.comarca_xp_por_fp), topeGp: String(c.comarca_tope_gp_dia), topeFp: String(c.comarca_tope_fp_dia),
          batallas: c.comarca_batallas_activo === 1, batDia: String(c.comarca_batallas_dia), proteccion: String(c.comarca_proteccion_min), aciertos: String(c.comarca_batalla_aciertos), vidas: String(c.comarca_batalla_vidas) });
      } catch (e) { setError(e.message || "No se pudo cargar la configuración."); return; }
      mundoApi.fetchComarcaResumen().then(setResumen).catch(() => setResumen(false));
    })();
  }, []);
  if (error && !f) return <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3">{error}</div>;
  if (!f) return <p className="text-sm text-slate-400">Cargando…</p>;
  const num = (v) => (v === "" ? NaN : Number(v));
  const rangos = [["oroGp", "Las monedas por cada GP", 1, 1000], ["xpFp", "El XP por cada FP", 1, 1000], ["topeGp", "El tope diario de GP", 0, 50], ["topeFp", "El tope diario de FP", 0, 50], ["batDia", "Las batallas por día", 0, 20], ["proteccion", "Los minutos de protección", 0, 1440], ["aciertos", "Los aciertos para ganar", 1, 10], ["vidas", "Los corazones", 1, 10]];
  const errorDe = () => { for (const [k, nombre, min, max] of rangos) { const n = num(f[k]); if (!Number.isInteger(n) || n < min || n > max) return `${nombre} tiene que ser un número entero entre ${min} y ${max}.`; } return ""; };
  const guardar = async () => {
    const e = errorDe(); if (e) { setError(e); return; }
    setGuardando(true); setError("");
    try {
      for (const [k, v] of [["comarca_activo", f.activo ? 1 : 0], ["comarca_aportes_activo", f.aportes ? 1 : 0], ["comarca_oro_por_gp", num(f.oroGp)], ["comarca_xp_por_fp", num(f.xpFp)], ["comarca_tope_gp_dia", num(f.topeGp)], ["comarca_tope_fp_dia", num(f.topeFp)],
        ["comarca_batallas_activo", f.batallas ? 1 : 0], ["comarca_batallas_dia", num(f.batDia)], ["comarca_proteccion_min", num(f.proteccion)], ["comarca_batalla_aciertos", num(f.aciertos)], ["comarca_batalla_vidas", num(f.vidas)]]) await mundoApi.guardarConfigMundo(k, v);
      setAviso("Guardado ✓"); clearTimeout(relojAviso.current); relojAviso.current = setTimeout(() => setAviso(""), 2400);
    } catch (er) { setError("No se pudo guardar: " + (er.message || "error desconocido")); }
    setGuardando(false);
  };
  const input = "w-20 text-sm rounded-lg px-2.5 py-1.5 border border-slate-200 outline-none bg-white";
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <div>
      <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 leading-relaxed">
        La <b>Sala de la Comarca 🏰</b> es un edificio de la aldea con el <b>mapa de los reinos</b> y un <b>Heraldo</b>. Cada estudiante pertenece al reino que tiene en tu Comarca de Oakhaven (el de su curso con sesión activa). Lo que se hace aquí <b>modifica tu Comarca real</b>: el oro y el XP que ganan en el mundo suman <b>GP</b> y <b>FP</b> a su reino, y las batallas pueden cambiar de dueña una provincia.
      </div>
      {resumen === false && <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 mb-3">Todavía no se crearon las funciones de la Comarca en el mundo. Corre <b>72_mundo_comarca.sql</b> en el editor SQL de Supabase y vuelve a abrir esto.</div>}
      {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-2.5 mb-3">{error}</div>}
      {resumen && <div className="text-[11px] text-slate-500 mb-3" data-testid="resumen-comarca">⚔️ {resumen.batallas} {resumen.batallas === 1 ? "batalla librada" : "batallas libradas"} ({resumen.tomadas} {resumen.tomadas === 1 ? "provincia conquistada" : "provincias conquistadas"}) · ⚒️ {resumen.gp} GP y {resumen.fp} FP aportados desde el mundo</div>}
      <div className="rounded-xl border border-slate-200 p-4 mb-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3"><input type="checkbox" checked={f.activo} onChange={(e) => setF((x) => ({ ...x, activo: e.target.checked }))} /> La Sala de la Comarca está abierta</label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3"><input type="checkbox" checked={f.aportes} onChange={(e) => setF((x) => ({ ...x, aportes: e.target.checked }))} /> Lo que ganan en el mundo suma GP y FP a su reino</label>
        <div className="flex flex-wrap items-center gap-2 mb-2 text-sm text-slate-700">Cada <input type="number" min="1" max="1000" value={f.oroGp} onChange={set("oroGp")} className={input} aria-label="Monedas por GP" /> 🪙 ganadas = 1 GP, y cada <input type="number" min="1" max="1000" value={f.xpFp} onChange={set("xpFp")} className={input} aria-label="XP por FP" /> XP = 1 FP</div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">Cada estudiante aporta como máximo <input type="number" min="0" max="50" value={f.topeGp} onChange={set("topeGp")} className={input} aria-label="Tope de GP por día" /> GP y <input type="number" min="0" max="50" value={f.topeFp} onChange={set("topeFp")} className={input} aria-label="Tope de FP por día" /> FP por día <span className="text-[11px] text-slate-400">(el día cambia a la medianoche)</span></div>
      </div>
      <div className="rounded-xl border border-slate-200 p-4 mb-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-1"><input type="checkbox" checked={f.batallas} onChange={(e) => setF((x) => ({ ...x, batallas: e.target.checked }))} /> Las batallas entre reinos están abiertas</label>
        <p className="text-[11px] text-slate-400 mb-3 ml-6">Empiezan <b>cerradas</b>. Ábrelas cuando quieras que los estudiantes puedan quitarse provincias entre reinos (un reino nunca se queda sin su última provincia).</p>
        <div className="flex flex-wrap items-center gap-2 mb-2 text-sm text-slate-700">Cada estudiante puede librar <input type="number" min="0" max="20" value={f.batDia} onChange={set("batDia")} className={input} aria-label="Batallas por día" /> batallas por día <span className="text-[11px] text-slate-400">(0 = sin límite)</span></div>
        <div className="flex flex-wrap items-center gap-2 mb-2 text-sm text-slate-700">Para ganar hay que acertar <input type="number" min="1" max="10" value={f.aciertos} onChange={set("aciertos")} className={input} aria-label="Aciertos para ganar" /> preguntas antes de perder <input type="number" min="1" max="10" value={f.vidas} onChange={set("vidas")} className={input} aria-label="Corazones" /> ❤️</div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">Una provincia conquistada queda protegida <input type="number" min="0" max="1440" value={f.proteccion} onChange={set("proteccion")} className={input} aria-label="Minutos de protección" /> minutos <span className="text-[11px] text-slate-400">(así no se la quitan enseguida)</span></div>
        <p className="text-[11px] text-slate-400 mt-3">Las preguntas salen de las misiones del mundo. El resultado lo reporta el juego del estudiante; si quieres, revisa la Comarca en tu panel después de una batalla.</p>
      </div>
      <div className="flex items-center gap-3 justify-end">
        {aviso && <span className="text-xs font-semibold text-emerald-600">{aviso}</span>}
        <button type="button" onClick={guardar} disabled={guardando} className="text-sm font-bold px-5 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar Comarca"}</button>
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
