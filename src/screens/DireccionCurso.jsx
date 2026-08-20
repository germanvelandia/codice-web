import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import * as api from "../lib/api";
import { agruparPorNivel } from "../lib/gamification";

const PERIODOS = ["1", "2", "3", "4"];

function ImportarNotasModal({ gradoId, materiaId, materiaNombre, periodo, estudiantes, onClose, onImportado }) {
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const descargarPlantilla = () => {
    const filas = [["Nombre del Estudiante", "Nota"], ...estudiantes.map((e) => [e.nombre, ""])];
    const hoja = XLSX.utils.aoa_to_sheet(filas);
    hoja["!cols"] = [{ wch: 32 }, { wch: 10 }];
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Notas");
    XLSX.writeFile(libro, `notas_${materiaNombre}_periodo${periodo}_curso${gradoId}.xlsx`);
  };

  const procesarArchivo = (file) => {
    setProcesando(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "binary" });
        const hoja = wb.Sheets[wb.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });
        const normalizadas = filas
          .map((f) => ({ nombre: (f["Nombre del Estudiante"] || f["Estudiante"] || f["Nombre"] || "").toString().trim(), nota: f["Nota"] }))
          .filter((f) => f.nombre && f.nota !== "" && f.nota !== undefined);

        if (normalizadas.length === 0) { alert("No se encontraron filas con nombre y nota. Revisá que uses la plantilla."); setProcesando(false); return; }

        const r = await api.importarNotasDireccionCurso(gradoId, materiaId, periodo, normalizadas, estudiantes);
        setResultado(r);
        onImportado();
      } catch (err) {
        alert("No se pudo leer el archivo: " + err.message);
      }
      setProcesando(false);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={procesando ? undefined : onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">📥 Importar notas — {materiaNombre} (Periodo {periodo})</h3>
          {!procesando && <button onClick={onClose} className="text-slate-400">✕</button>}
        </div>

        {resultado ? (
          <div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3">
              <p className="text-sm font-semibold text-emerald-700">✔ Listo</p>
              <p className="text-xs text-emerald-600 mt-1">Se cargaron {resultado.cargadas} de {resultado.total} nota(s).</p>
            </div>
            {resultado.sinEmparejar.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-700 max-h-32 overflow-y-auto mb-3">
                <p className="font-semibold mb-1">No se encontró un estudiante con este nombre:</p>
                <ul className="list-disc list-inside">{resultado.sinEmparejar.map((n, i) => <li key={i}>{n}</li>)}</ul>
              </div>
            )}
            <button onClick={onClose} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white">Cerrar</button>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-3">
              Descargá la plantilla (ya con los nombres de este curso precargados), completá la columna de nota, y subila.
            </p>
            <button onClick={descargarPlantilla} className="w-full text-sm font-semibold py-2.5 rounded-lg border border-violet-200 text-violet-600 mb-3">
              📄 Descargar plantilla ({estudiantes.length} estudiante{estudiantes.length !== 1 ? "s" : ""})
            </button>
            <label className="text-xs text-slate-500 block mb-1">Subir la plantilla completada</label>
            <input type="file" accept=".xlsx,.xls" onChange={(e) => e.target.files[0] && procesarArchivo(e.target.files[0])} disabled={procesando} className="text-sm" />
            {procesando && <p className="text-xs text-violet-500 mt-2">Procesando…</p>}
          </>
        )}
      </div>
    </div>
  );
}

// Adivina la materia y el periodo a partir del texto del encabezado de una
// columna del boletín del colegio (ej: "MATEMATICAS P1", "Español - Periodo 2").
function adivinarMapeo(encabezado, materias) {
  const texto = String(encabezado || "").toLowerCase();
  const periodoMatch = texto.match(/[1-4]\b/);
  const periodo = periodoMatch ? periodoMatch[0] : "";
  let mejorMateria = null;
  let mejorPuntaje = 0;
  for (const m of materias) {
    const nombreMat = m.nombre.toLowerCase();
    if (texto.includes(nombreMat) || nombreMat.includes(texto.replace(/[^a-záéíóúñ ]/g, "").trim())) {
      const puntaje = nombreMat.length;
      if (puntaje > mejorPuntaje) { mejorPuntaje = puntaje; mejorMateria = m.id; }
    }
  }
  return { materiaId: mejorMateria, periodo };
}

function ImportarBoletinModal({ gradoId, estudiantes, materias, onClose, onImportado }) {
  const [paso, setPaso] = useState(1); // 1: subir archivo, 2: mapear columnas, 3: resultado
  const [encabezados, setEncabezados] = useState([]);
  const [filasCrudo, setFilasCrudo] = useState([]);
  const [mapeo, setMapeo] = useState({}); // { indiceColumna: { materiaId, periodo } }
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const procesarArchivo = (file) => {
    setProcesando(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "binary" });
        const hoja = wb.Sheets[wb.SheetNames[0]];
        const arr = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "" });
        if (arr.length < 2) { alert("El archivo no tiene suficientes filas."); setProcesando(false); return; }
        const heads = arr[0];
        const datos = arr.slice(1).filter((f) => f.some((c) => c !== "" && c !== undefined));
        setEncabezados(heads);
        setFilasCrudo(datos);

        const mapeoInicial = {};
        for (let i = 1; i < heads.length; i++) {
          const adivinado = adivinarMapeo(heads[i], materias);
          if (adivinado.materiaId && adivinado.periodo) mapeoInicial[i] = adivinado;
        }
        setMapeo(mapeoInicial);
        setPaso(2);
      } catch (err) {
        alert("No se pudo leer el archivo: " + err.message);
      }
      setProcesando(false);
    };
    reader.readAsBinaryString(file);
  };

  const actualizarMapeo = (indice, campo, valor) => {
    setMapeo((prev) => ({ ...prev, [indice]: { ...(prev[indice] || { materiaId: "", periodo: "" }), [campo]: valor } }));
  };

  const columnasReconocidas = Object.values(mapeo).filter((m) => m && m.materiaId && m.periodo).length;

  const confirmarImportacion = async () => {
    setProcesando(true);
    try {
      const r = await api.importarBoletinAnchoDireccionCurso(gradoId, filasCrudo, encabezados, mapeo, estudiantes);
      setResultado(r);
      setPaso(3);
      onImportado();
    } catch (e) {
      alert("Error al importar: " + e.message);
    }
    setProcesando(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={procesando ? undefined : onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">📥 Importar boletín del colegio</h3>
          {!procesando && <button onClick={onClose} className="text-slate-400">✕</button>}
        </div>

        {paso === 1 && (
          <div>
            <p className="text-xs text-slate-500 mb-3">
              Subí tal cual el archivo Excel que te entrega el colegio (con todas las materias y periodos como columnas) — la primera columna
              tiene que ser el nombre del estudiante. Después vas a poder revisar y corregir qué columna corresponde a cada materia y periodo.
            </p>
            <input type="file" accept=".xlsx,.xls" onChange={(e) => e.target.files[0] && procesarArchivo(e.target.files[0])} disabled={procesando} className="text-sm" />
            {procesando && <p className="text-xs text-violet-500 mt-2">Procesando…</p>}
          </div>
        )}

        {paso === 2 && (
          <div>
            <p className="text-xs text-slate-500 mb-3">
              Revisá que cada columna quede asignada a la materia y periodo correctos — traté de adivinarlo solo, pero corregí lo que haga falta.
              Las columnas que dejes sin materia/periodo (ej: "Promedio" o "Puesto" del colegio) se ignoran.
            </p>
            <div className="space-y-1.5 mb-4 max-h-96 overflow-y-auto">
              {encabezados.slice(1).map((h, idx) => {
                const i = idx + 1;
                const m = mapeo[i] || { materiaId: "", periodo: "" };
                return (
                  <div key={i} className={`flex items-center gap-2 rounded-lg p-2 ${m.materiaId && m.periodo ? "bg-emerald-50" : "bg-slate-50"}`}>
                    <span className="text-[11px] text-slate-500 w-40 truncate shrink-0" title={h}>{h || `Columna ${i + 1}`}</span>
                    <select value={m.materiaId} onChange={(e) => actualizarMapeo(i, "materiaId", e.target.value ? parseInt(e.target.value, 10) : "")}
                      className="flex-1 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
                      <option value="">— Ignorar esta columna —</option>
                      {materias.map((mat) => <option key={mat.id} value={mat.id}>{mat.nombre}</option>)}
                    </select>
                    <select value={m.periodo} onChange={(e) => actualizarMapeo(i, "periodo", e.target.value)}
                      className="w-24 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
                      <option value="">Periodo</option>
                      {PERIODOS.map((p) => <option key={p} value={p}>P{p}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">{columnasReconocidas} de {encabezados.length - 1} columna(s) reconocida(s)</span>
              <div className="flex gap-2">
                <button onClick={() => setPaso(1)} className="text-xs text-slate-500 px-3 py-2">← Volver</button>
                <button disabled={procesando || columnasReconocidas === 0} onClick={confirmarImportacion} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50">
                  {procesando ? "Importando…" : `Importar ${columnasReconocidas} columna(s)`}
                </button>
              </div>
            </div>
          </div>
        )}

        {paso === 3 && resultado && (
          <div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3">
              <p className="text-sm font-semibold text-emerald-700">✔ Listo</p>
              <p className="text-xs text-emerald-600 mt-1">Se cargaron {resultado.cargadas} nota(s) en total.</p>
            </div>
            {resultado.sinEmparejar.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-700 max-h-32 overflow-y-auto mb-3">
                <p className="font-semibold mb-1">No se encontró un estudiante con este nombre en el curso:</p>
                <ul className="list-disc list-inside">{resultado.sinEmparejar.map((n, i) => <li key={i}>{n}</li>)}</ul>
              </div>
            )}
            <button onClick={onClose} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white">Cerrar</button>
          </div>
        )}
      </div>
    </div>
  );
}

function recomendacionPara(resumen, materiasBajas) {
  if (resumen.total === 0) return "Todavía no hay notas suficientes para generar una recomendación.";
  if (resumen.perdidas === 0 && resumen.promedio >= 4.3) return "Desempeño sobresaliente — considerar para reconocimiento o cuadro de honor.";
  if (resumen.perdidas === 0) return "Buen desempeño general, sin materias perdidas. Continuar con el acompañamiento habitual.";
  if (resumen.perdidas <= 2) return `Requiere refuerzo puntual en: ${materiasBajas.join(", ")}. Recomendable citar acudiente y acordar plan de mejoramiento.`;
  return `Situación académica crítica (${resumen.perdidas} materias perdidas). Se recomienda remisión a Orientación Escolar, citación urgente a acudiente y plan de mejoramiento integral.`;
}

export function VistaDireccionCurso({ grados }) {
  const [gradoId, setGradoId] = useState(grados[0]?.id || "");
  const [estudiantes, setEstudiantes] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [notas, setNotas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [periodoVista, setPeriodoVista] = useState("promedio");
  const [notaMinima, setNotaMinima] = useState(3.5);
  const [importando, setImportando] = useState(null);
  const [importarBoletinAbierto, setImportarBoletinAbierto] = useState(false);
  const [agregarMateriaAbierto, setAgregarMateriaAbierto] = useState(false);
  const [materiaAAgregar, setMateriaAAgregar] = useState("");
  const [periodoAAgregar, setPeriodoAAgregar] = useState("1");
  const [vistaAnalisis, setVistaAnalisis] = useState(false);

  useEffect(() => { if (grados.length && !gradoId) setGradoId(grados[0].id); }, [grados]);
  useEffect(() => { api.fetchMaterias().then(setMaterias); }, []);

  const cargar = () => {
    if (!gradoId) return;
    setCargando(true);
    Promise.all([api.fetchEstudiantesPorGrado(gradoId), api.fetchNotasDireccionCurso(gradoId)]).then(([est, n]) => {
      setEstudiantes(est.sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setNotas(n);
      setCargando(false);
    });
  };
  useEffect(() => { cargar(); }, [gradoId]);

  const materiasConNotas = Array.from(new Set(notas.map((n) => n.materia_id)))
    .map((id) => ({ id, nombre: notas.find((n) => n.materia_id === id)?.materia_nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const periodosConDatos = Array.from(new Set(notas.map((n) => n.periodo))).sort();

  const notaCeldaCompleta = (estudianteId, materiaId, periodo) => {
    if (periodo === "promedio") {
      const propias = notas.filter((n) => n.estudiante_id === estudianteId && n.materia_id === materiaId);
      if (propias.length === 0) return null;
      const promedio = propias.reduce((a, n) => a + Number(n.nota), 0) / propias.length;
      return { nota: promedio, en_nivelacion: propias.some((n) => n.en_nivelacion), id: null };
    }
    return notas.find((n) => n.estudiante_id === estudianteId && n.materia_id === materiaId && n.periodo === periodo) || null;
  };

  const promedioMateria = (estudianteId, materiaId) => {
    const propias = notas.filter((n) => n.estudiante_id === estudianteId && n.materia_id === materiaId);
    if (propias.length === 0) return null;
    return propias.reduce((a, n) => a + Number(n.nota), 0) / propias.length;
  };

  const resumenEstudiante = (estudianteId) => {
    const porMateria = materiasConNotas.map((m) => ({ materia: m.nombre, valor: periodoVista === "promedio" ? promedioMateria(estudianteId, m.id) : notaCeldaCompleta(estudianteId, m.id, periodoVista)?.nota ?? null }));
    const conValor = porMateria.filter((x) => x.valor !== null && x.valor !== undefined);
    const perdidas = conValor.filter((x) => x.valor < notaMinima).map((x) => x.materia);
    const promedio = conValor.length ? conValor.reduce((a, x) => a + x.valor, 0) / conValor.length : null;
    return { promedio, perdidas: perdidas.length, materiasBajas: perdidas, total: conValor.length };
  };

  const toggleNivelacion = async (celda, estudianteId, materiaId, periodo) => {
    if (periodo === "promedio") { alert('Para marcar nivelación, elegí un periodo puntual arriba (no "Promedio de todos los periodos").'); return; }
    if (!celda || !celda.id) return;
    await api.toggleNivelacionNota(celda.id, !celda.en_nivelacion);
    cargar();
  };

  const eliminarMateriaDelCurso = async (materiaId, materiaNombre) => {
    if (!confirm(`¿Eliminar TODAS las notas cargadas de "${materiaNombre}" en este curso? Esto no se puede deshacer.`)) return;
    await api.eliminarNotasMateriaDireccionCurso(gradoId, materiaId, null);
    cargar();
  };

  const materiasDisponiblesParaAgregar = materias.filter((m) => !materiasConNotas.some((mc) => mc.id === m.id));

  const ranking = estudiantes
    .map((e) => ({ ...e, ...resumenEstudiante(e.id) }))
    .filter((e) => e.promedio !== null)
    .sort((a, b) => b.promedio - a.promedio)
    .map((e, i) => ({ ...e, puesto: i + 1 }));

  const promedioPorMateria = materiasConNotas.map((m) => {
    const valores = estudiantes.map((e) => periodoVista === "promedio" ? promedioMateria(e.id, m.id) : notaCeldaCompleta(e.id, m.id, periodoVista)?.nota ?? null).filter((v) => v !== null && v !== undefined);
    const promedio = valores.length ? valores.reduce((a, v) => a + v, 0) / valores.length : null;
    const perdidasCount = valores.filter((v) => v < notaMinima).length;
    return { nombre: m.nombre, promedio, perdidasCount, totalEvaluados: valores.length };
  }).sort((a, b) => (a.promedio ?? 99) - (b.promedio ?? 99));

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-800">🎓 Dirección de Curso</h2>
        <p className="text-sm text-slate-400">Consolidá las notas de todas las materias del curso (las dictes vos o no) subiendo el boletín del colegio — promedios, pérdidas, puestos y recomendaciones de un vistazo.</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-2">
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {grados.map((g) => <option key={g.id} value={g.id}>Curso {g.id}</option>)}
        </select>
        <select value={periodoVista} onChange={(e) => setPeriodoVista(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          <option value="promedio">Promedio de todos los periodos</option>
          {periodosConDatos.map((p) => <option key={p} value={p}>Solo Periodo {p}</option>)}
        </select>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white rounded-full px-3 py-2 border border-slate-200">
          Nota mínima:
          <input type="number" step="0.1" min="0" max="5" value={notaMinima} onChange={(e) => setNotaMinima(parseFloat(e.target.value) || 3.5)}
            className="w-14 text-xs rounded px-1.5 py-0.5 border border-slate-200 outline-none" />
        </div>
        <button onClick={() => setImportarBoletinAbierto(true)} className="text-xs font-semibold px-3 py-2 rounded-full bg-rose-500 text-white">
          📥 Importar boletín del colegio
        </button>
        <button onClick={() => { setAgregarMateriaAbierto((v) => !v); setMateriaAAgregar(materiasDisponiblesParaAgregar[0]?.id || ""); }}
          className="text-xs font-semibold px-3 py-2 rounded-full border border-violet-200 text-violet-600">
          + Cargar una materia
        </button>
        {materiasConNotas.length > 0 && (
          <button onClick={() => setVistaAnalisis((v) => !v)} className={`text-xs font-semibold px-3 py-2 rounded-full ${vistaAnalisis ? "bg-slate-700 text-white" : "border border-slate-200 text-slate-600"}`}>
            📊 {vistaAnalisis ? "Ver tabla" : "Ver análisis"}
          </button>
        )}
      </div>
      <p className="text-[11px] text-slate-400 mb-4">🔴 Reprobado (menor a {notaMinima}) · 🟡 En nivelación (tocá una celda de un periodo puntual para marcarla)</p>

      {agregarMateriaAbierto && (
        <div className="bg-violet-50 rounded-xl p-3 mb-4">
          <p className="text-xs text-slate-500 mb-2">Elegí la materia (del catálogo — no crea una nueva) y el periodo cuyas notas vas a subir con la plantilla simple.</p>
          <div className="flex flex-wrap gap-2 items-center">
            <select value={materiaAAgregar} onChange={(e) => setMateriaAAgregar(e.target.value)} className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white">
              {materiasDisponiblesParaAgregar.length === 0 && <option value="">— Todas ya están cargadas —</option>}
              {materiasDisponiblesParaAgregar.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              {materias.filter((m) => materiasConNotas.some((mc) => mc.id === m.id)).map((m) => <option key={m.id} value={m.id}>{m.nombre} (ya tiene notas)</option>)}
            </select>
            <select value={periodoAAgregar} onChange={(e) => setPeriodoAAgregar(e.target.value)} className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white">
              {PERIODOS.map((p) => <option key={p} value={p}>Periodo {p}</option>)}
            </select>
            <button disabled={!materiaAAgregar} onClick={() => {
              const m = materias.find((x) => x.id === parseInt(materiaAAgregar, 10));
              setImportando({ materiaId: m.id, materiaNombre: m.nombre, periodo: periodoAAgregar });
              setAgregarMateriaAbierto(false);
            }} className="text-xs font-semibold px-3 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50">
              Continuar →
            </button>
            <button onClick={() => setAgregarMateriaAbierto(false)} className="text-xs text-slate-500">Cancelar</button>
          </div>
        </div>
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : materiasConNotas.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">
          Todavía no cargaste notas de ninguna materia para este curso — subí el boletín del colegio o cargá una materia a la vez.
        </div>
      ) : vistaAnalisis ? (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="font-semibold text-slate-700 mb-3">🏅 Puestos del curso</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-3 py-2">Puesto</th>
                    <th className="text-left px-3 py-2">Estudiante</th>
                    <th className="px-3 py-2">Promedio</th>
                    <th className="px-3 py-2">Pérdidas</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((e) => (
                    <tr key={e.id} className="border-t border-slate-100">
                      <td className="text-center px-3 py-2 font-bold text-violet-600">{e.puesto}</td>
                      <td className="px-3 py-2">{e.nombre}</td>
                      <td className="text-center px-3 py-2 font-semibold">{e.promedio.toFixed(2)}</td>
                      <td className={`text-center px-3 py-2 font-semibold ${e.perdidas > 0 ? "text-rose-600" : "text-emerald-600"}`}>{e.perdidas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="font-semibold text-slate-700 mb-3">📚 Promedio por asignatura (todo el curso)</div>
            <div className="space-y-1.5">
              {promedioPorMateria.map((m) => (
                <div key={m.nombre} className="flex items-center gap-2">
                  <span className="text-xs w-40 shrink-0">{m.nombre}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                    <div className={`h-full ${m.promedio < notaMinima ? "bg-rose-400" : "bg-emerald-400"}`} style={{ width: `${Math.min(100, ((m.promedio || 0) / 5) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-semibold w-12 text-right">{m.promedio !== null ? m.promedio.toFixed(2) : "—"}</span>
                  <span className="text-[10px] text-slate-400 w-24">{m.perdidasCount} de {m.totalEvaluados} perdió</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="font-semibold text-slate-700 mb-3">💡 Recomendaciones por estudiante</div>
            <div className="space-y-2">
              {estudiantes.map((e) => {
                const resumen = resumenEstudiante(e.id);
                if (resumen.total === 0) return null;
                return (
                  <div key={e.id} className="border-l-4 rounded-lg p-2.5 bg-slate-50" style={{ borderColor: resumen.perdidas === 0 ? "#22C55E" : resumen.perdidas <= 2 ? "#F59E0B" : "#EF4444" }}>
                    <div className="text-xs font-semibold text-slate-700">{e.nombre} <span className="text-slate-400 font-normal">· Promedio {resumen.promedio.toFixed(2)}</span></div>
                    <p className="text-[11px] text-slate-600 mt-0.5">{recomendacionPara(resumen, resumen.materiasBajas)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-100">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-3 py-2 sticky left-0 bg-slate-50">Estudiante</th>
                {materiasConNotas.map((m) => (
                  <th key={m.id} className="px-3 py-2">
                    <div>{m.nombre}</div>
                    <button onClick={() => eliminarMateriaDelCurso(m.id, m.nombre)} className="text-[9px] text-rose-400 font-normal">🗑 quitar</button>
                    <div>
                      <button onClick={() => setImportando({ materiaId: m.id, materiaNombre: m.nombre, periodo: periodoVista === "promedio" ? "1" : periodoVista })}
                        className="text-[9px] text-violet-500 font-normal">📥 recargar</button>
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2">Promedio</th>
                <th className="px-3 py-2">Pérdidas</th>
              </tr>
            </thead>
            <tbody>
              {estudiantes.map((e) => {
                const resumen = resumenEstudiante(e.id);
                return (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 sticky left-0 bg-white font-medium text-slate-700">{e.nombre}</td>
                    {materiasConNotas.map((m) => {
                      const celda = notaCeldaCompleta(e.id, m.id, periodoVista);
                      const v = celda?.nota;
                      const esBaja = v !== null && v !== undefined && v < notaMinima;
                      const enNivelacion = celda?.en_nivelacion;
                      return (
                        <td key={m.id} onClick={() => toggleNivelacion(celda, e.id, m.id, periodoVista)}
                          className={`text-center px-3 py-2 cursor-pointer ${enNivelacion ? "bg-amber-100 text-amber-700 font-semibold" : esBaja ? "bg-rose-50 text-rose-600 font-semibold" : v !== null && v !== undefined ? "text-slate-600" : "text-slate-300"}`}
                          title={periodoVista === "promedio" ? "Elegí un periodo puntual arriba para marcar nivelación" : "Tocá para marcar/desmarcar en nivelación"}>
                          {v !== null && v !== undefined ? v.toFixed(1) : "—"}
                        </td>
                      );
                    })}
                    <td className="text-center px-3 py-2 font-semibold text-slate-700">{resumen.promedio !== null ? resumen.promedio.toFixed(1) : "—"}</td>
                    <td className={`text-center px-3 py-2 font-semibold ${resumen.perdidas > 0 ? "text-rose-600" : "text-emerald-600"}`}>{resumen.perdidas}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {importando && (
        <ImportarNotasModal gradoId={gradoId} materiaId={importando.materiaId} materiaNombre={importando.materiaNombre} periodo={importando.periodo}
          estudiantes={estudiantes} onClose={() => setImportando(null)} onImportado={cargar} />
      )}
      {importarBoletinAbierto && (
        <ImportarBoletinModal gradoId={gradoId} estudiantes={estudiantes} materias={materias} onClose={() => setImportarBoletinAbierto(false)} onImportado={cargar} />
      )}
    </div>
  );
}
