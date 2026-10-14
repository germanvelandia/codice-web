import React, { useEffect, useRef, useState } from "react";
import * as api from "../lib/modulosApi";
import { TIPOS_ACTIVIDAD, EMOJIS_MODULO, errorActividad, errorModulo, ordenarModulos } from "../lib/modulos";
import { errorLeccion } from "../lib/leccion";
import { MODOS_NOTA, notaDeModulo } from "../lib/notasModulo";
import { CrearModuloIA, CrearLeccionIA } from "./ModulosIA";
import { EditorLeccion } from "./EditorLeccion";
import { ModuloPrevia } from "./ModulosEstudiante";
import { nivelesDe, esNivel, claveNivel, nombreNivel, etiquetaPara } from "../lib/gradosMundo";

const input = "w-full text-sm rounded-lg px-2.5 py-1.5 border border-slate-200 outline-none bg-white";
const moduloVacio = (materiaId, numero, curso) => ({ materia_id: materiaId || "", grado_id: curso || "", numero: String(numero), nombre: "", descripcion: "", emoji: "📘", xp: "30", oro: "10", libre: false, activo: true, nota_activa: false, nota_categoria_id: "", nota_periodo: "", nota_modo: "proporcional", nota_nombre: "", nota_auto: false });
const actividadVacia = () => ({ tipo: "lectura", titulo: "", contenido: "", opciones: ["", "", "", ""], correcta: 0, activa: true });

// Panel de la docente: crea módulos de estudio por materia, con sus actividades. grados = [{ id }] (los cursos que existen)
export function ModulosAdmin({ grados = [] }) {
  const [datos, setDatos] = useState(null);       // { modulos, actividades, materias, cierres }
  const [faltaSql, setFaltaSql] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [formM, setFormM] = useState(null);       // módulo en edición
  const [abierto, setAbierto] = useState(null);   // id del módulo desplegado
  const [conIA, setConIA] = useState(false);
  const [formA, setFormA] = useState(null);       // { moduloId, ...actividad }
  const [leccion, setLeccion] = useState(null);   // lección en el editor de bloques: { moduloId, id?, titulo, bloques }
  const [previa, setPrevia] = useState(null);   // módulo que se está previsualizando
  const [leccionIA, setLeccionIA] = useState(null); // módulo al que se le agrega una lección con IA
  const [reflexiones, setReflexiones] = useState(null); // { actividad, filas } lo que escribieron los estudiantes
  const [guardando, setGuardando] = useState(false);
  const reloj = useRef(null);
  useEffect(() => () => clearTimeout(reloj.current), []);
  const [opcionesNota, setOpcionesNota] = useState(null);   // { categorias, periodos, config } de la materia del formulario
  const avisar = (t, ms = 2400) => { setAviso(t); clearTimeout(reloj.current); reloj.current = setTimeout(() => setAviso(""), ms); };
  const cursos = [...new Set(grados.map((g) => String(g.id)))], niveles = nivelesDe(cursos);

  const cargar = async () => {
    try { setDatos(await api.fetchModulosAdmin()); }
    catch (e) { if (api.sinTablasModulos(e)) setFaltaSql(true); else setError(e.message || "No se pudieron cargar los módulos."); setDatos({ modulos: [], actividades: [], materias: [], cierres: {} }); }
  };
  useEffect(() => { (async () => { await cargar(); try { const r = await api.sincronizarNotasAutomaticas(); if (r.notas > 0) avisar(`📒 Se actualizaron ${r.notas} ${r.notas === 1 ? "nota" : "notas"} en la planilla.`, 5000); } catch { /* sin notas automáticas */ } })(); }, []);
  const materiaNota = formM && formM.nota_activa && formM.materia_id ? Number(formM.materia_id) : null;
  useEffect(() => { let vivo = true; setOpcionesNota(null); if (materiaNota) api.fetchOpcionesNota(materiaNota).then((o) => vivo && setOpcionesNota(o)).catch(() => vivo && setOpcionesNota({ categorias: [], periodos: ["1", "2", "3", "4"], config: {}, error: true })); return () => { vivo = false; }; }, [materiaNota]);
  if (!datos) return <p className="text-sm text-slate-400">Cargando…</p>;
  if (faltaSql) return <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3">Todavía no se crearon las tablas de los módulos. Corre <b>79_modulos_estudio.sql</b> en el editor SQL de Supabase y vuelve a abrir esto.</div>;

  const nombreMateria = (id) => (id ? datos.materias.find((m) => m.id === id)?.nombre || "Materia" : "General");
  const accion = async (fn, ok) => { setError(""); try { await fn(); await cargar(); if (ok) avisar(ok); } catch (e) { setError(e.message || "Algo salió mal."); } };

  const guardarM = async () => {
    const e = errorModulo(formM); if (e) { setError(e); return; }
    setGuardando(true); setError("");
    try { const id = await api.guardarModulo(formM); setFormM(null); await cargar(); setAbierto(id); avisar("Módulo guardado ✓"); }
    catch (er) { setError("No se pudo guardar: " + (er.message || "error")); }
    setGuardando(false);
  };
  const guardarA = async () => {
    const e = errorActividad(formA); if (e) { setError(e); return; }
    setGuardando(true); setError("");
    try {
      const del = datos.actividades.filter((a) => a.modulo_id === formA.moduloId);
      await api.guardarActividad(formA.moduloId, formA, 1 + Math.max(0, ...del.map((a) => a.orden || 0)));
      setFormA(null); await cargar(); avisar("Actividad guardada ✓");
    } catch (er) { setError("No se pudo guardar: " + (er.message || "error")); }
    setGuardando(false);
  };
  const setM = (k, v) => setFormM((f) => ({ ...f, [k]: v }));
  const setA = (k, v) => setFormA((f) => ({ ...f, [k]: v }));

  // ----- lección: editor de bloques -----
  const guardarLeccion = async () => {
    const e = errorLeccion(leccion); if (e) { setError(e); return; }
    setGuardando(true); setError("");
    try {
      const del = datos.actividades.filter((a) => a.modulo_id === leccion.moduloId);
      await api.guardarActividad(leccion.moduloId, { id: leccion.id, tipo: "leccion", titulo: leccion.titulo, bloques: leccion.bloques }, 1 + Math.max(0, ...del.map((a) => a.orden || 0)));
      setLeccion(null); await cargar(); avisar("Lección guardada ✓");
    } catch (er) { setError("No se pudo guardar: " + (er.message || "error")); }
    setGuardando(false);
  };
  if (leccion) {
    return (
      <div data-testid="pantalla-leccion">
        <button onClick={() => { if (confirm("¿Salir sin guardar los cambios de la lección?")) { setLeccion(null); setError(""); } }} className="text-sm text-violet-500 mb-3" data-testid="volver-leccion">← Volver a los módulos</button>
        <h3 className="font-bold text-slate-800 mb-3">🎓 {leccion.id ? "Editar lección" : "Nueva lección"}</h3>
        {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 mb-3" data-testid="error-modulos">{error}</div>}
        <EditorLeccion valor={leccion} onChange={(v) => setLeccion((l) => ({ ...l, ...v }))} />
        <div className="flex justify-end gap-2 mt-4">
          <button disabled={guardando} onClick={guardarLeccion} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-60" data-testid="btn-guardar-leccion">{guardando ? "Guardando…" : "Guardar lección"}</button>
        </div>
      </div>
    );
  }
  if (previa) return <ModuloPrevia modulo={previa} actividades={datos.actividades.filter((a) => a.modulo_id === previa.id)} onVolver={() => setPrevia(null)} />;
  if (leccionIA) {
    const del = datos.actividades.filter((a) => a.modulo_id === leccionIA.id);
    return <CrearLeccionIA modulo={leccionIA} siguienteOrden={1 + Math.max(0, ...del.map((a) => a.orden || 0))} onCerrar={() => setLeccionIA(null)}
      onCreada={async () => { setLeccionIA(null); await cargar(); setAbierto(leccionIA.id); avisar("Lección creada ✓ Ábrela para ajustarla o agregar imágenes y videos."); }} />;
  }
  if (reflexiones) {
    return (
      <div data-testid="reflexiones-docente">
        <button onClick={() => setReflexiones(null)} className="text-sm text-violet-500 mb-3">← Volver a los módulos</button>
        <h3 className="font-bold text-slate-800 mb-1">✍️ Reflexiones · {reflexiones.actividad.titulo}</h3>
        <p className="text-xs text-slate-500 mb-3">Lo que escribieron los estudiantes en esta lección.</p>
        {!reflexiones.filas.length && <p className="text-sm text-slate-400" data-testid="sin-reflexiones">Todavía nadie ha escrito su reflexión.</p>}
        <div className="space-y-2">{reflexiones.filas.map((f) => {
          const b = (reflexiones.actividad.bloques || []).find((x) => x.id === f.bloque_id);
          return <div key={f.id} className="rounded-xl border border-slate-200 p-3"><div className="text-xs font-semibold text-slate-700">{f.nombre}</div>{b && <div className="text-[11px] text-slate-400 mb-1">{b.consigna}</div>}<p className="text-sm text-slate-700 whitespace-pre-wrap">{f.texto}</p></div>;
        })}</div>
      </div>
    );
  }

  // ----- crear con ayuda de una IA -----
  if (conIA) {
    return <CrearModuloIA materias={datos.materias} cursos={cursos} modulos={datos.modulos} onCerrar={() => setConIA(false)}
      onCreado={async (r) => { setConIA(false); await cargar(); if (r.creados[0]) setAbierto(r.creados[0].id); avisar(`Creado ✓ ${r.creados.length} ${r.creados.length === 1 ? "módulo" : "módulos"} con ${r.actividades} actividades. Revísalo y ajústalo.`); }} />;
  }

  // ----- formulario de módulo -----
  if (formM) {
    return (
      <div data-testid="form-modulo">
        <button onClick={() => { setFormM(null); setError(""); }} className="text-sm text-violet-500 mb-3">← Volver a los módulos</button>
        <h3 className="font-bold text-slate-800 mb-3">{formM.id ? "Editar módulo" : "Nuevo módulo"}</h3>
        {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 mb-3" data-testid="error-modulos">{error}</div>}
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div><label className="text-[11px] text-slate-500 block mb-1">Materia</label>
            <select value={formM.materia_id} onChange={(e) => setM("materia_id", e.target.value)} className={input} aria-label="Materia">
              <option value="">General (sin materia)</option>{datos.materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select></div>
          <div><label className="text-[11px] text-slate-500 block mb-1">¿Para quién?</label>
            <select value={formM.grado_id} onChange={(e) => setM("grado_id", e.target.value)} className={input} aria-label="Grado">
              <option value="">🌐 Todos los cursos</option>
              {[...new Set([...niveles, ...(esNivel(formM.grado_id) ? [formM.grado_id.slice(6)] : [])])].map((n) => <option key={n} value={claveNivel(n)}>📚 Todo {nombreNivel(n).toLowerCase()}</option>)}
              {cursos.map((c) => <option key={c} value={c}>🏫 Solo el curso {c}</option>)}
            </select></div>
          <div><label className="text-[11px] text-slate-500 block mb-1">Número del módulo</label><input type="number" min="1" max="999" value={formM.numero} onChange={(e) => setM("numero", e.target.value)} className={input} aria-label="Número" /></div>
          <div><label className="text-[11px] text-slate-500 block mb-1">Nombre</label><input value={formM.nombre} maxLength={120} onChange={(e) => setM("nombre", e.target.value)} className={input} aria-label="Nombre" placeholder="Ej.: Los valores en la vida diaria" /></div>
        </div>
        <label className="text-[11px] text-slate-500 block mb-1">Descripción (opcional)</label>
        <textarea rows={2} maxLength={600} value={formM.descripcion} onChange={(e) => setM("descripcion", e.target.value)} className={input + " mb-3"} aria-label="Descripción" />
        <div className="flex flex-wrap gap-1 mb-3">{EMOJIS_MODULO.map((em) => <button key={em} type="button" onClick={() => setM("emoji", em)} className={`w-8 h-8 rounded-lg border text-lg ${formM.emoji === em ? "border-violet-500 bg-violet-50" : "border-slate-200"}`}>{em}</button>)}</div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div><label className="text-[11px] text-slate-500 block mb-1">XP al terminar</label><input type="number" min="0" max="500" value={formM.xp} onChange={(e) => setM("xp", e.target.value)} className={input} aria-label="XP" /></div>
          <div><label className="text-[11px] text-slate-500 block mb-1">Oro al terminar</label><input type="number" min="0" max="500" value={formM.oro} onChange={(e) => setM("oro", e.target.value)} className={input} aria-label="Oro" /></div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 mb-1"><input type="checkbox" checked={formM.libre} onChange={(e) => setM("libre", e.target.checked)} /> Módulo libre (se puede abrir sin haber terminado el anterior)</label>
        <label className="flex items-center gap-2 text-sm text-slate-700 mb-4"><input type="checkbox" checked={formM.activo} onChange={(e) => setM("activo", e.target.checked)} /> Visible para los estudiantes</label>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 mb-4" data-testid="seccion-nota">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800"><input type="checkbox" checked={!!formM.nota_activa} onChange={(e) => setM("nota_activa", e.target.checked)} data-testid="nota-activa" /> 📒 Guardar el avance de este módulo como nota en la Planilla</label>
          {formM.nota_activa && (!formM.materia_id
            ? <p className="text-[11px] text-amber-700 mt-2">Primero elige la materia del módulo (arriba): la nota se guarda en la planilla de esa materia.</p>
            : !opcionesNota ? <p className="text-[11px] text-slate-400 mt-2">Cargando las categorías de la planilla…</p>
            : (
              <div className="mt-2 space-y-2">
                {!opcionesNota.categorias.length && <p className="text-[11px] text-amber-700">Esta materia todavía no tiene categorías en la Planilla. Crea una (por ejemplo «Talleres») en Planillas y vuelve aquí.</p>}
                <div className="grid sm:grid-cols-2 gap-2">
                  <div><label className="text-[11px] text-slate-500 block mb-1">Categoría de la planilla</label>
                    <select value={formM.nota_categoria_id || ""} onChange={(e) => setM("nota_categoria_id", e.target.value)} className={input} aria-label="Categoría de la nota"><option value="">Elige…</option>{opcionesNota.categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.porcentaje != null ? ` (${c.porcentaje}%)` : ""}</option>)}</select></div>
                  <div><label className="text-[11px] text-slate-500 block mb-1">Periodo</label>
                    <select value={formM.nota_periodo || ""} onChange={(e) => setM("nota_periodo", e.target.value)} className={input} aria-label="Periodo de la nota"><option value="">Elige…</option>{opcionesNota.periodos.map((p) => <option key={p} value={p}>Periodo {p}</option>)}</select></div>
                </div>
                <div><label className="text-[11px] text-slate-500 block mb-1">¿Cómo se calcula la nota?</label>
                  <select value={formM.nota_modo || "proporcional"} onChange={(e) => setM("nota_modo", e.target.value)} className={input} aria-label="Modo de la nota">{Object.entries(MODOS_NOTA).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}</select>
                  <p className="text-[11px] text-slate-500 mt-1">{(MODOS_NOTA[formM.nota_modo || "proporcional"] || {}).desc}</p></div>
                <div><label className="text-[11px] text-slate-500 block mb-1">Nombre de la columna (opcional)</label>
                  <input value={formM.nota_nombre || ""} maxLength={120} onChange={(e) => setM("nota_nombre", e.target.value)} className={input} aria-label="Nombre de la columna" placeholder={`Módulo ${formM.numero || "N"} — ${formM.nombre || "nombre del módulo"}`} /></div>
                <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={!!formM.nota_auto} onChange={(e) => setM("nota_auto", e.target.checked)} data-testid="nota-auto" /> Actualizar las notas solas cada vez que abra este panel</label>
                <p className="text-[11px] text-slate-500">Escala {opcionesNota.config.escala_min ?? 1}–{opcionesNota.config.nota_maxima ?? 5}: por ejemplo, con 4 actividades, si completa 2 saca {notaDeModulo({ total: 4, hechas: 2, escalaMin: opcionesNota.config.escala_min ?? 1, notaMax: opcionesNota.config.nota_maxima ?? 5 })}. Solo se crean o suben notas: nunca se baja una nota que ya pusiste. Se crea una columna por curso.</p>
              </div>))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => { setFormM(null); setError(""); }} className="text-xs text-slate-500 px-3 py-1.5">Cancelar</button>
          <button disabled={guardando} onClick={guardarM} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-60" data-testid="btn-guardar-modulo">{guardando ? "Guardando…" : "Guardar módulo"}</button>
        </div>
      </div>
    );
  }

  // ----- lista -----
  const porMateria = new Map();
  ordenarModulos(datos.modulos).forEach((m) => { const k = m.materia_id ?? 0; if (!porMateria.has(k)) porMateria.set(k, []); porMateria.get(k).push(m); });
  const actsDe = (id) => datos.actividades.filter((a) => a.modulo_id === id);
  return (
    <div data-testid="modulos-admin">
      <h3 className="font-bold text-slate-800 mb-1">📘 Módulos de estudio</h3>
      <p className="text-xs text-slate-500 mb-3">Cada materia tiene módulos con número y nombre. Dentro van actividades (lecturas, enlaces, videos y preguntas). El estudiante los completa en orden y, al terminar cada módulo, gana XP y oro una sola vez.</p>
      {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 mb-3" data-testid="error-modulos">{error}</div>}
      {aviso && <div className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-3 py-2 mb-3">{aviso}</div>}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => { setError(""); setFormM(moduloVacio("", api.siguienteNumero(datos.modulos, null))); }} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white" data-testid="btn-nuevo-modulo">➕ Nuevo módulo</button>
        <button onClick={() => { setError(""); setConIA(true); }} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-violet-200 text-violet-600" data-testid="btn-crear-ia">✨ Crear con ayuda de una IA</button>
      </div>
      {!datos.modulos.length && <p className="text-sm text-slate-400" data-testid="sin-modulos">Todavía no hay módulos. Crea el primero.</p>}
      {[...porMateria.entries()].map(([k, lista]) => (
        <div key={k} className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold text-slate-700">{nombreMateria(k || null)}</h4>
            <button onClick={() => { setError(""); setFormM(moduloVacio(k || "", api.siguienteNumero(datos.modulos, k || null))); }} className="text-[11px] text-violet-600">+ módulo en esta materia</button>
          </div>
          <div className="space-y-2">
            {lista.map((m) => {
              const acts = actsDe(m.id), abiertoAqui = abierto === m.id;
              return (
                <div key={m.id} className={`rounded-xl border ${m.activo ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-70"}`} data-testid={`modulo-${m.id}`}>
                  <div className="flex items-center gap-2 p-3">
                    <button onClick={() => setAbierto(abiertoAqui ? null : m.id)} className="flex-1 text-left" aria-label={`Abrir módulo ${m.numero}`}>
                      <div className="text-sm font-semibold text-slate-800">{m.emoji} Módulo {m.numero} · {m.nombre}{!m.activo && <span className="ml-2 text-[10px] bg-slate-200 text-slate-600 rounded px-1">oculto</span>}</div>
                      <div className="text-[11px] text-slate-500">{acts.length} {acts.length === 1 ? "actividad" : "actividades"} · {m.xp} XP + {m.oro} oro · {etiquetaPara(m.grado_id)}{m.libre ? " · libre" : ""} · lo completaron {datos.cierres[m.id] || 0}{m.nota_activa ? ` · 📒 va a la planilla (periodo ${m.nota_periodo})` : ""}</div>
                    </button>
                    {!m.nota_activa && <button onClick={() => { setError(""); setFormM({ ...m, materia_id: m.materia_id || "", numero: String(m.numero), xp: String(m.xp), oro: String(m.oro), nota_activa: true, nota_categoria_id: m.nota_categoria_id || "", nota_periodo: m.nota_periodo || "", nota_modo: m.nota_modo || "proporcional", nota_nombre: m.nota_nombre || "", nota_auto: !!m.nota_auto }); setTimeout(() => { const el = document.querySelector("[data-testid=seccion-nota]"); if (el && el.scrollIntoView) el.scrollIntoView({ block: "center" }); }, 80); }} className="text-xs font-semibold text-slate-500 hover:text-emerald-700 hover:underline" aria-label="Configurar nota" data-testid={`config-nota-${m.id}`}>📒 Nota</button>}
                    {m.nota_activa && <button onClick={() => accion(async () => { const r = await api.sincronizarNotasModulo(m.id); setAviso(""); avisar(r.ok ? `📒 ${r.mensaje}` : r.mensaje, 7000); })} className="text-xs font-semibold text-emerald-700 hover:underline" aria-label="Actualizar notas" data-testid={`notas-${m.id}`}>📒 Actualizar notas</button>}
                    <button onClick={() => setPrevia(m)} className="text-xs font-semibold text-violet-600 hover:underline" aria-label="Vista previa del módulo" data-testid={`previa-${m.id}`}>👁 Vista previa</button>
                    <button onClick={() => { setError(""); setFormM({ ...m, materia_id: m.materia_id || "", numero: String(m.numero), xp: String(m.xp), oro: String(m.oro) }); }} className="text-xs text-slate-400 hover:text-violet-600" aria-label="Editar módulo">✏️</button>
                    <button onClick={() => accion(() => api.alternarModulo(m.id, !m.activo), m.activo ? "Módulo oculto" : "Módulo visible")} className="text-xs text-slate-400 hover:text-violet-600" aria-label="Mostrar u ocultar">{m.activo ? "👁" : "🚫"}</button>
                    <button onClick={() => { if (confirm(`¿Eliminar el módulo "${m.nombre}" con sus actividades y el avance de los estudiantes?`)) accion(() => api.eliminarModulo(m.id), "Módulo eliminado"); }} className="text-xs text-slate-400 hover:text-rose-500" aria-label="Eliminar módulo">🗑</button>
                  </div>
                  {abiertoAqui && (
                    <div className="border-t border-slate-100 p-3" data-testid={`acts-${m.id}`}>
                      {m.descripcion && <p className="text-xs text-slate-500 mb-2">{m.descripcion}</p>}
                      {acts.length === 0 && <p className="text-xs text-slate-400 mb-2">Este módulo todavía no tiene actividades: los estudiantes no lo verán hasta que agregues una.</p>}
                      <ul className="space-y-1 mb-2">
                        {acts.map((a, i) => (
                          <li key={a.id} className={`flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 bg-slate-50 ${a.activa === false ? "opacity-60" : ""}`}>
                            <span>{TIPOS_ACTIVIDAD[a.tipo]?.emoji}</span><span className="flex-1 truncate">{a.titulo}{a.tipo === "leccion" && <span className="text-slate-400"> · {(a.bloques || []).length} bloques</span>}</span>
                            {a.tipo === "leccion" && (a.bloques || []).some((b) => b.tipo === "reflexion") && <button onClick={() => accion(async () => setReflexiones({ actividad: a, filas: await api.fetchReflexionesAdmin(a.id) }))} className="text-slate-400 hover:text-violet-600" aria-label="Ver reflexiones" title="Ver lo que escribieron los estudiantes">💬</button>}
                            <button disabled={i === 0} onClick={() => accion(() => api.moverActividad(acts, a.id, -1))} className="text-slate-400 disabled:opacity-30" aria-label="Subir">▲</button>
                            <button disabled={i === acts.length - 1} onClick={() => accion(() => api.moverActividad(acts, a.id, 1))} className="text-slate-400 disabled:opacity-30" aria-label="Bajar">▼</button>
                            <button onClick={() => { setError(""); if (a.tipo === "leccion") { setLeccion({ moduloId: m.id, id: a.id, titulo: a.titulo, bloques: a.bloques || [] }); return; } const ops = [...(a.opciones || []), "", "", "", ""].slice(0, 4); setFormA({ ...a, moduloId: m.id, opciones: ops, correcta: a.correcta ?? 0, contenido: a.contenido || "" }); }} className="text-slate-400 hover:text-violet-600" aria-label="Editar actividad">✏️</button>
                            <button onClick={() => accion(() => api.alternarActividad(a.id, a.activa === false))} className="text-slate-400" aria-label="Mostrar u ocultar actividad">{a.activa === false ? "🚫" : "👁"}</button>
                            <button onClick={() => { if (confirm("¿Eliminar esta actividad?")) accion(() => api.eliminarActividad(a.id)); }} className="text-slate-400 hover:text-rose-500" aria-label="Eliminar actividad">🗑</button>
                          </li>
                        ))}
                      </ul>
                      {formA && formA.moduloId === m.id ? (
                        <div className="bg-violet-50 rounded-xl p-3" data-testid="form-actividad">
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <select value={formA.tipo} onChange={(e) => setA("tipo", e.target.value)} className={input} aria-label="Tipo de actividad">{Object.entries(TIPOS_ACTIVIDAD).filter(([k2]) => k2 !== "leccion").map(([k2, t]) => <option key={k2} value={k2}>{t.emoji} {t.nombre}</option>)}</select>
                            <input value={formA.titulo} maxLength={160} onChange={(e) => setA("titulo", e.target.value)} placeholder="Título" className={input} aria-label="Título de la actividad" />
                          </div>
                          {formA.tipo === "lectura" && <textarea rows={5} value={formA.contenido} onChange={(e) => setA("contenido", e.target.value)} placeholder="Escribe aquí el texto de la lectura…" className={input} aria-label="Texto de la lectura" />}
                          {(formA.tipo === "enlace" || formA.tipo === "video") && <input value={formA.contenido} onChange={(e) => setA("contenido", e.target.value)} placeholder={formA.tipo === "video" ? "Dirección del video (YouTube, Vimeo u otra)" : "Dirección web (https://…)"} className={input} aria-label="Dirección" />}
                          {formA.tipo === "pregunta" && (
                            <div>
                              <textarea rows={2} value={formA.contenido} onChange={(e) => setA("contenido", e.target.value)} placeholder="Escribe la pregunta…" className={input + " mb-2"} aria-label="Pregunta" />
                              <p className="text-[11px] text-slate-500 mb-1">Marca la opción correcta (2 a 4 opciones):</p>
                              {formA.opciones.map((o, i) => (
                                <div key={i} className="flex items-center gap-2 mb-1"><input type="radio" name="correcta" checked={Number(formA.correcta) === i} onChange={() => setA("correcta", i)} aria-label={`Correcta ${i + 1}`} />
                                  <input value={o} maxLength={150} onChange={(e) => setA("opciones", formA.opciones.map((x, k3) => (k3 === i ? e.target.value : x)))} placeholder={`Opción ${i + 1}`} className={input} aria-label={`Opción ${i + 1}`} /></div>
                              ))}
                            </div>
                          )}
                          <div className="flex justify-end gap-2 mt-2">
                            <button onClick={() => { setFormA(null); setError(""); }} className="text-xs text-slate-500 px-3 py-1.5">Cancelar</button>
                            <button disabled={guardando} onClick={guardarA} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-60" data-testid="btn-guardar-actividad">{guardando ? "Guardando…" : "Guardar actividad"}</button>
                          </div>
                        </div>
                      ) : <div className="flex flex-wrap gap-2">
                        <button onClick={() => { setError(""); setLeccion({ moduloId: m.id, titulo: "", bloques: [] }); }} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white" data-testid="btn-nueva-leccion">🎓 Nueva lección</button>
                        <button onClick={() => { setError(""); setLeccionIA(m); }} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-violet-200 text-violet-600" data-testid="btn-leccion-ia">✨ Lección con IA</button>
                        <button onClick={() => { setError(""); setFormA({ ...actividadVacia(), moduloId: m.id }); }} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-violet-200 text-violet-600" data-testid="btn-nueva-actividad">+ Agregar actividad</button>
                      </div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
