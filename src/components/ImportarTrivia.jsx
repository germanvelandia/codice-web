import React, { useEffect, useRef, useState } from "react";
import { fetchTriviaParaExcel, crearTriviaMasivo } from "../lib/triviaMasivo";
import { objetosDePreguntas, objetosDeCategorias, analizarTrivia, sinCrearCategorias, crearLibroTrivia, leerLibroTrivia, filasPlantillaTrivia, filasExportarTrivia } from "../lib/importarTrivia";

const cargarXLSX = async () => { const mod = await import("xlsx"); return mod.utils ? mod : mod.default; }; // solo se carga cuando se usa
const hoy = () => new Date().toISOString().slice(0, 10);

// Carga masiva de preguntas de Preguntados desde Excel: plantilla con TODAS las categorías, revisión antes de guardar y exportación.
export function ImportarTrivia({ onVolver, onTerminado }) {
  const [datos, setDatos] = useState(null);       // { categorias, preguntas, materias }
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [rev, setRev] = useState(null);           // { archivo, objetos, objetosCat }
  const [crearCats, setCrearCats] = useState(true);
  const [progreso, setProgreso] = useState(null); // { hecho, total }
  const [hecho, setHecho] = useState(null);       // { creadas, categoriasCreadas }
  const entrada = useRef(null);

  const cargar = async () => { try { setDatos(await fetchTriviaParaExcel()); } catch (e) { setError("No se pudieron leer las categorías: " + (e.message || "error")); setDatos({ categorias: [], preguntas: [], materias: [] }); } };
  useEffect(() => { cargar(); }, []);

  const plantilla = async () => {
    setError("");
    try { const X = await cargarXLSX(); X.writeFile(crearLibroTrivia(X, { categorias: datos.categorias, preguntas: filasPlantillaTrivia(datos.categorias) }), "plantilla_preguntados.xlsx"); }
    catch (e) { setError("No se pudo crear el Excel: " + (e.message || "error")); }
  };
  const exportar = async () => {
    setError("");
    try { const X = await cargarXLSX(); X.writeFile(crearLibroTrivia(X, { categorias: datos.categorias, preguntas: filasExportarTrivia(datos.categorias, datos.preguntas) }), `preguntados_${hoy()}.xlsx`); setAviso("Exportado ✓"); setTimeout(() => setAviso(""), 2400); }
    catch (e) { setError("No se pudo crear el Excel: " + (e.message || "error")); }
  };
  const elegir = (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    setError(""); setHecho(null); setAviso("");
    const lector = new FileReader();
    lector.onload = async (ev) => {
      try {
        const X = await cargarXLSX(), hojas = leerLibroTrivia(X, ev.target.result);
        const p = objetosDePreguntas(hojas.preguntas); if (p.error) { setError(p.error); return; }
        if (!p.objetos.length) { setError("No encontré preguntas en el archivo (solo los encabezados)."); return; }
        setCrearCats(true); setRev({ archivo: f.name, objetos: p.objetos, objetosCat: objetosDeCategorias(hojas.categorias).objetos });
      } catch (er) { setError("No se pudo leer el archivo. ¿Es un Excel (.xlsx)? " + (er.message || "")); }
    };
    lector.onerror = () => setError("No se pudo leer el archivo.");
    lector.readAsBinaryString(f);
  };

  // el análisis se recalcula con lo que hay guardado, y respeta la casilla de crear categorías
  let analisis = null, hayNuevasCats = false;
  if (rev && datos) {
    analisis = analizarTrivia(rev.objetos, rev.objetosCat, { existentes: datos.categorias.map((c) => ({ id: c.id, nombre: c.nombre, textos: c.textos })), materias: datos.materias });
    hayNuevasCats = !analisis.error && analisis.categorias.length > 0;
    if (!analisis.error && !crearCats) analisis = sinCrearCategorias(analisis);
  }
  const aplicar = async () => {
    const nuevas = analisis.filas.filter((f) => f.estado === "nueva");
    setProgreso({ hecho: 0, total: nuevas.length }); setError("");
    try {
      const r = await crearTriviaMasivo({ categoriasNuevas: analisis.categorias, filas: nuevas, progreso: (h, t) => setProgreso({ hecho: h, total: t }) });
      setRev(null); setHecho(r); await cargar(); onTerminado && onTerminado();
    } catch (er) {
      setRev(null); await cargar(); onTerminado && onTerminado();
      setError(`Se detuvo la importación: ${er.message || "error"}. Ya se guardaron ${er.creadas ?? 0} preguntas. Corrige el problema y vuelve a subir el mismo archivo: lo que ya está guardado se omite.`);
    }
    setProgreso(null);
  };

  const btn = "text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-50";
  return (
    <div data-testid="importar-trivia">
      <button onClick={onVolver} className="text-sm text-violet-500 mb-3">← Volver a categorías</button>
      <h3 className="font-bold text-slate-800 mb-1">📊 Carga masiva de preguntas (Excel)</h3>
      <p className="text-xs text-slate-500 mb-3">Descarga la plantilla (ya trae todas tus categorías), llena una fila por pregunta con sus 4 opciones y cuál es la correcta, y súbela. Antes de guardar te muestro una revisión. Solo agrega: lo que ya existe se omite, así que puedes volver a subir el archivo sin duplicar.</p>
      {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 mb-3" data-testid="error-trivia">{error}</div>}
      {aviso && <div className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-3 py-2 mb-3">{aviso}</div>}
      {hecho && !rev && (
        <div className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-3 py-3 mb-3" data-testid="hecho-trivia">
          ✅ Listo: se guardaron <b>{hecho.creadas}</b> {hecho.creadas === 1 ? "pregunta" : "preguntas"}{hecho.categoriasCreadas > 0 && <> y se {hecho.categoriasCreadas === 1 ? "creó" : "crearon"} <b>{hecho.categoriasCreadas}</b> {hecho.categoriasCreadas === 1 ? "categoría nueva" : "categorías nuevas"}</>}.
        </div>
      )}
      {!datos ? <p className="text-sm text-slate-400">Cargando…</p> : !rev ? (
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            <button type="button" className={btn} onClick={plantilla} data-testid="btn-plantilla-trivia">📥 Plantilla (con todas las categorías)</button>
            <button type="button" className={btn} onClick={() => entrada.current && entrada.current.click()} data-testid="btn-importar-trivia">📤 Importar desde Excel</button>
            <button type="button" className={btn} onClick={exportar} disabled={!datos.preguntas.length} data-testid="btn-exportar-trivia">📦 Exportar todo</button>
            <input ref={entrada} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={elegir} data-testid="archivo-trivia" />
          </div>
          <div className="text-[11px] text-slate-500 bg-slate-50 rounded-lg p-3">
            <b>Tienes {datos.categorias.length} {datos.categorias.length === 1 ? "categoría" : "categorías"} y {datos.preguntas.length} {datos.preguntas.length === 1 ? "pregunta" : "preguntas"}.</b> El Excel tiene tres hojas: <b>Preguntas</b> (donde escribes), <b>Categorías</b> (todas las que existen, y donde puedes crear nuevas con emoji, color y materia) e <b>Instrucciones</b>. En <b>correcta</b> escribe A, B, C o D.
          </div>
        </div>
      ) : analisis.error ? (
        <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2">{analisis.error} <button className="underline ml-2" onClick={() => setRev(null)}>Volver</button></div>
      ) : (
        <Revision analisis={analisis} archivo={rev.archivo} crearCats={crearCats} setCrearCats={setCrearCats} progreso={progreso} onCancelar={() => setRev(null)} onAplicar={aplicar} hayNuevasCats={hayNuevasCats} />
      )}
    </div>
  );
}

function Revision({ analisis, archivo, crearCats, setCrearCats, progreso, onCancelar, onAplicar, hayNuevasCats }) {
  const r = analisis.resumen, errores = analisis.filas.filter((f) => f.estado === "error");
  const caja = (n, t, c) => <div className={`rounded-lg px-3 py-2 text-center ${c}`}><div className="text-lg font-bold">{n}</div><div className="text-[11px]">{t}</div></div>;
  return (
    <div data-testid="revision-trivia">
      <p className="text-xs text-slate-500 mb-2">Archivo: <b>{archivo}</b></p>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {caja(r.nuevas, r.nuevas === 1 ? "pregunta nueva" : "preguntas nuevas", "bg-emerald-50 text-emerald-700")}
        {caja(r.iguales, "ya existen (se omiten)", "bg-slate-100 text-slate-600")}
        {caja(r.errores, r.errores === 1 ? "fila con error" : "filas con error", r.errores ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-400")}
      </div>
      {hayNuevasCats && (
        <label className="flex items-start gap-2 text-xs bg-violet-50 rounded-lg p-3 mb-3 cursor-pointer">
          <input type="checkbox" checked={crearCats} onChange={(e) => setCrearCats(e.target.checked)} data-testid="chk-crear-cats" className="mt-0.5" />
          <span><b>Crear las categorías nuevas</b> que aparecen en el archivo{analisis.categorias.length ? `: ${analisis.categorias.map((c) => `${c.emoji} ${c.nombre}`).join(", ")}` : ""}. Si lo desmarcas, las preguntas de categorías que no existen se descartan.</span>
        </label>
      )}
      {analisis.avisos.length > 0 && <ul className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-3 list-disc list-inside">{analisis.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>}
      {analisis.porCategoria.length > 0 && (
        <table className="w-full text-xs mb-3" data-testid="tabla-categorias">
          <thead><tr className="text-left text-slate-400"><th className="py-1">Categoría</th><th>Nuevas</th><th>Ya existían</th><th>Errores</th></tr></thead>
          <tbody>{analisis.porCategoria.map((c) => <tr key={c.nombre} className="border-t border-slate-100"><td className="py-1">{c.nombre}{c.nueva && <span className="ml-1 text-[10px] bg-violet-100 text-violet-600 rounded px-1">nueva</span>}</td><td>{c.nuevas}</td><td>{c.iguales}</td><td className={c.errores ? "text-rose-600 font-semibold" : ""}>{c.errores}</td></tr>)}</tbody>
        </table>
      )}
      {errores.length > 0 && (
        <div className="mb-3" data-testid="lista-errores">
          <p className="text-xs font-semibold text-rose-700 mb-1">Filas con error (no se guardan):</p>
          <ul className="text-[11px] text-slate-600 max-h-40 overflow-y-auto space-y-0.5">
            {errores.slice(0, 15).map((f) => <li key={f.fila}>Fila {f.fila}: {f.errores.join(" ")}</li>)}
            {errores.length > 15 && <li>… y {errores.length - 15} más.</li>}
          </ul>
        </div>
      )}
      {progreso && <div className="text-xs text-violet-700 mb-2" data-testid="progreso-trivia">Guardando… {progreso.hecho} de {progreso.total}</div>}
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} disabled={!!progreso} className="text-xs text-slate-500 px-3 py-1.5">Cancelar</button>
        <button onClick={onAplicar} disabled={!!progreso || (r.nuevas === 0 && r.categoriasNuevas === 0)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-50" data-testid="btn-guardar-trivia">
          {r.nuevas ? `Guardar ${r.nuevas} ${r.nuevas === 1 ? "pregunta" : "preguntas"}` : r.categoriasNuevas ? "Crear las categorías" : "Nada que guardar"}
        </button>
      </div>
    </div>
  );
}
