import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import * as api from "../lib/api";

const PERIODOS = ["1", "2", "3", "4"];

function ImportarNotasModal({ gradoId, materiaNombre, periodo, estudiantes, onClose, onImportado }) {
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

        const r = await api.importarNotasDireccionCurso(gradoId, materiaNombre, periodo, normalizadas, estudiantes);
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

// Adivina la materia y el periodo directo del texto del encabezado de una
// columna del boletín del colegio (ej: "MATEMATICAS P1", "Ética y Religión - Periodo 2",
// "INGLES_3"). No depende de ningún catálogo — usa el nombre tal cual venga.
function adivinarMapeo(encabezado) {
  const texto = String(encabezado || "").trim();
  if (!texto) return { materiaNombre: "", periodo: "" };
  const match = texto.match(/^(.*?)[\s._-]*(?:per(?:iodo)?)?\.?\s*([1-4])\s*$/i);
  if (match) {
    const nombre = match[1].replace(/[-_.]+$/, "").trim();
    return { materiaNombre: nombre || texto, periodo: match[2] };
  }
  return { materiaNombre: texto, periodo: "" };
}

function ImportarBoletinModal({ gradoId, estudiantes, onClose, onImportado }) {
  const [paso, setPaso] = useState(1); // 1: subir archivo, 2: mapear columnas, 3: resultado
  const [encabezados, setEncabezados] = useState([]);
  const [filasCrudo, setFilasCrudo] = useState([]);
  const [mapeo, setMapeo] = useState({}); // { indiceColumna: { materiaNombre, periodo } }
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
          mapeoInicial[i] = adivinarMapeo(heads[i]);
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
    setMapeo((prev) => ({ ...prev, [indice]: { ...(prev[indice] || { materiaNombre: "", periodo: "" }), [campo]: valor } }));
  };

  const columnasReconocidas = Object.values(mapeo).filter((m) => m && m.materiaNombre.trim() && m.periodo).length;

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
              tiene que ser el nombre del estudiante. Las materias NO necesitan estar registradas en la plataforma — se usan tal cual las trae
              el archivo del colegio.
            </p>
            <input type="file" accept=".xlsx,.xls" onChange={(e) => e.target.files[0] && procesarArchivo(e.target.files[0])} disabled={procesando} className="text-sm" />
            {procesando && <p className="text-xs text-violet-500 mt-2">Procesando…</p>}
          </div>
        )}

        {paso === 2 && (
          <div>
            <p className="text-xs text-slate-500 mb-3">
              Revisá el nombre de materia y el periodo que le detecté a cada columna — traté de leerlo directo del encabezado de tu archivo,
              corregí lo que haga falta. Dejá el periodo vacío en las columnas que quieras ignorar (ej: "Promedio" o "Puesto" que ya trae el colegio).
            </p>
            <div className="space-y-1.5 mb-4 max-h-96 overflow-y-auto">
              {encabezados.slice(1).map((h, idx) => {
                const i = idx + 1;
                const m = mapeo[i] || { materiaNombre: "", periodo: "" };
                const reconocida = m.materiaNombre.trim() && m.periodo;
                return (
                  <div key={i} className={`flex items-center gap-2 rounded-lg p-2 ${reconocida ? "bg-emerald-50" : "bg-slate-50"}`}>
                    <span className="text-[10px] text-slate-400 w-28 truncate shrink-0" title={h}>Excel: "{h}"</span>
                    <input value={m.materiaNombre} onChange={(e) => actualizarMapeo(i, "materiaNombre", e.target.value)} placeholder="Nombre de la materia"
                      className="flex-1 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
                    <select value={m.periodo} onChange={(e) => actualizarMapeo(i, "periodo", e.target.value)}
                      className="w-24 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
                      <option value="">Ignorar</option>
                      {PERIODOS.map((p) => <option key={p} value={p}>Periodo {p}</option>)}
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

function PanelDireccionCurso({ gradoId, onVerNotas, onVerCitaciones }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!gradoId) return;
    setCargando(true);
    api.fetchPanelDireccionCurso(gradoId).then((d) => { setDatos(d); setCargando(false); });
  }, [gradoId]);

  if (cargando || !datos) return <div className="text-sm text-slate-400">Cargando…</div>;

  const { estudiantes, resumenGrupo } = datos;
  const visibles = estudiantes.filter((e) => !query.trim() || e.nombre.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-3 text-center">
          <div className="text-xl font-bold text-violet-600">{resumenGrupo.asistenciaPromedio !== null ? `${resumenGrupo.asistenciaPromedio}%` : "—"}</div>
          <div className="text-[10px] text-slate-400">Asistencia del grupo</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-3 text-center">
          <div className="text-xl font-bold text-violet-600">{resumenGrupo.promedioGrupo !== null ? resumenGrupo.promedioGrupo.toFixed(2) : "—"}</div>
          <div className="text-[10px] text-slate-400">Promedio del grupo</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-3 text-center">
          <div className="text-xl font-bold text-rose-500">{resumenGrupo.casosConvivenciales}</div>
          <div className="text-[10px] text-slate-400">Casos convivenciales</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-3 text-center">
          <div className="text-xl font-bold text-amber-500">{resumenGrupo.compromisosPendientes}</div>
          <div className="text-[10px] text-slate-400">Compromisos pendientes</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-3 text-center cursor-pointer hover:border-violet-200" onClick={onVerCitaciones}>
          <div className="text-xl font-bold text-blue-500">{resumenGrupo.citacionesPendientes}</div>
          <div className="text-[10px] text-slate-400">Citaciones pendientes</div>
        </div>
      </div>

      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="🔍 Buscar estudiante…"
        className="text-sm rounded-full px-4 py-2 border border-slate-200 outline-none w-full max-w-sm mb-3" />

      <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-100">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-3 py-2">Estudiante</th>
              <th className="px-3 py-2">Asistencia</th>
              <th className="px-3 py-2">Promedio</th>
              <th className="px-3 py-2">Pérdidas</th>
              <th className="px-3 py-2">Situaciones</th>
              <th className="px-3 py-2">Compromisos</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((e) => (
              <tr key={e.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-700">{e.nombre}</span>
                    {e.piar && <span title="PIAR">🧩</span>}
                    {e.dua && <span title="DUA">🧩</span>}
                  </div>
                </td>
                <td className={`text-center px-3 py-2 font-semibold ${e.porcentajeAsistencia !== null && e.porcentajeAsistencia < 80 ? "text-rose-600" : "text-slate-600"}`}>
                  {e.porcentajeAsistencia !== null ? `${e.porcentajeAsistencia}%` : "—"}
                </td>
                <td className="text-center px-3 py-2 font-semibold text-slate-700">{e.promedioGeneral !== null ? e.promedioGeneral.toFixed(1) : "—"}</td>
                <td className={`text-center px-3 py-2 font-semibold ${e.perdidas > 0 ? "text-rose-600" : "text-emerald-600"}`}>{e.perdidas}</td>
                <td className="text-center px-3 py-2">{e.totalSituaciones}</td>
                <td className={`text-center px-3 py-2 ${e.compromisosPendientes > 0 ? "text-amber-600 font-semibold" : "text-slate-400"}`}>{e.compromisosPendientes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-400 mt-3">
        Ficha completa (acudiente, EPS, PIAR/DUA, Observador, Actas) desde Estudiantes → "⋯ Más" en cada estudiante. Notas detalladas y análisis en la pestaña "Notas" de arriba.
      </p>
    </div>
  );
}

function CitacionForm({ estudiantes, citacion, onCancelar, onGuardada }) {
  const [estudianteId, setEstudianteId] = useState(citacion?.estudiante_id || estudiantes[0]?.id || "");
  const [motivo, setMotivo] = useState(citacion?.motivo || "");
  const [fecha, setFecha] = useState(citacion?.fecha_citacion || "");
  const [hora, setHora] = useState(citacion?.hora_citacion || "");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!estudianteId || !motivo.trim()) { alert("Elegí el estudiante y escribí el motivo."); return; }
    setGuardando(true);
    try {
      const campos = { motivo: motivo.trim(), fecha_citacion: fecha || null, hora_citacion: hora || null };
      if (citacion) await api.editarCitacion(citacion.id, campos);
      else await api.crearCitacion(estudianteId, campos);
      onGuardada();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-xl p-3 mb-3">
      <label className="text-xs text-slate-500 block mb-1">Estudiante</label>
      <select value={estudianteId} onChange={(e) => setEstudianteId(parseInt(e.target.value, 10))} disabled={!!citacion}
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white disabled:opacity-60">
        {estudiantes.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
      </select>
      <label className="text-xs text-slate-500 block mb-1">Motivo de la citación</label>
      <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Ej: Bajo rendimiento académico en varias materias…"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Fecha propuesta</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Hora</label>
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-1.5">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : citacion ? "Guardar cambios" : "Generar citación"}
        </button>
      </div>
    </div>
  );
}

// Ficha de citación — la notificación que se envía ANTES de la reunión
// (distinta del acta, que se llena DESPUÉS con lo que se conversó).
function imprimirFichaCitacion(citacion) {
  const ventana = window.open("", "_blank");
  ventana.document.write(`
    <html><head><title>Citación — ${citacion.estudiante_nombre}</title></head>
    <body style="font-family: Arial, sans-serif; padding: 30px; font-size: 13px;">
      <h2 style="text-align:center;">CITACIÓN A ACUDIENTE</h2>
      <p>Respetado(a) acudiente,</p>
      <p>Se le cita a una reunión con Dirección de Curso para tratar el siguiente asunto relacionado con el estudiante:</p>
      <p><b>Estudiante:</b> ${citacion.estudiante_nombre}</p>
      <p><b>Motivo:</b><br/>${citacion.motivo}</p>
      <p><b>Fecha propuesta:</b> ${citacion.fecha_citacion || "Por confirmar"} ${citacion.hora_citacion || ""}</p>
      <p>Agradecemos su puntual asistencia. En caso de no poder asistir, por favor comuníquese con la institución para reprogramar.</p>
      <div style="margin-top:50px; border-top:1px dashed #999; padding-top:10px;">
        <p style="font-size:11px; color:#555;">— Recorte y devuelva esta parte firmada —</p>
        <p>Yo, ______________________________________, acudiente de <b>${citacion.estudiante_nombre}</b>, confirmo asistencia a la citación del ${citacion.fecha_citacion || "___"}.</p>
        <div style="margin-top:30px; border-top:1px solid #000; width:250px; text-align:center; padding-top:4px;">Firma Acudiente</div>
      </div>
      <script>window.print();</script>
    </body></html>
  `);
  ventana.document.close();
}

function AtenderCitacionModal({ citacion, onClose, onGuardada }) {
  const [estado, setEstado] = useState(citacion.estado === "pendiente" ? "atendida" : citacion.estado);
  const [notas, setNotas] = useState(citacion.notas_atencion || "");
  const [acuerdos, setAcuerdos] = useState(citacion.acuerdos || "");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      await api.editarCitacion(citacion.id, { estado, notas_atencion: notas.trim() || null, acuerdos: acuerdos.trim() || null });
      onGuardada();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setGuardando(false);
  };

  const imprimir = () => {
    const ventana = window.open("", "_blank");
    ventana.document.write(`
      <html><head><title>Acta de atención — ${citacion.estudiante_nombre}</title></head>
      <body style="font-family: Arial, sans-serif; padding: 30px; font-size: 13px;">
        <h2 style="text-align:center;">ACTA DE ATENCIÓN A ACUDIENTE</h2>
        <p><b>Estudiante:</b> ${citacion.estudiante_nombre}</p>
        <p><b>Fecha:</b> ${citacion.fecha_citacion || "—"} ${citacion.hora_citacion || ""}</p>
        <p><b>Motivo de la citación:</b><br/>${citacion.motivo}</p>
        <p><b>Notas de la atención:</b><br/>${notas || "—"}</p>
        <p><b>Acuerdos:</b><br/>${acuerdos || "—"}</p>
        <div style="display:flex; justify-content:space-between; margin-top:60px;">
          <div style="border-top:1px solid #000; width:40%; text-align:center; padding-top:4px;">Firma Padre de Familia / Acudiente</div>
          <div style="border-top:1px solid #000; width:40%; text-align:center; padding-top:4px;">Firma Director(a) de Curso</div>
        </div>
        <script>window.print();</script>
      </body></html>
    `);
    ventana.document.close();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">📞 {citacion.estudiante_nombre}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3"><b>Motivo:</b> {citacion.motivo}</p>

        <label className="text-xs text-slate-500 block mb-1">Estado</label>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none">
          <option value="pendiente">Pendiente</option>
          <option value="atendida">Atendida</option>
          <option value="no_asistio">No asistió</option>
        </select>
        <label className="text-xs text-slate-500 block mb-1">Notas de la reunión</label>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none" />
        <label className="text-xs text-slate-500 block mb-1">Acuerdos</label>
        <textarea value={acuerdos} onChange={(e) => setAcuerdos(e.target.value)} rows={2} className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />

        <div className="flex justify-between gap-2">
          <button onClick={imprimir} className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 text-slate-600">🖨️ Imprimir acta</button>
          <button disabled={guardando} onClick={guardar} className="text-xs font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CitacionesDireccionCurso({ gradoId }) {
  const [estudiantes, setEstudiantes] = useState([]);
  const [citaciones, setCitaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [atendiendo, setAtendiendo] = useState(null);

  const cargar = () => {
    if (!gradoId) return;
    setCargando(true);
    Promise.all([api.fetchEstudiantesPorGrado(gradoId), api.fetchCitacionesPorCurso(gradoId)]).then(([est, cit]) => {
      setEstudiantes(est.sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setCitaciones(cit);
      setCargando(false);
    });
  };
  useEffect(() => { cargar(); }, [gradoId]);

  const eliminar = async (id) => { if (!confirm("¿Eliminar esta citación?")) return; await api.eliminarCitacion(id); cargar(); };
  const verificar = async (id, estado) => { await api.editarCitacion(id, { estado }); cargar(); };

  const ESTADO_LABEL = { pendiente: "🟡 Pendiente", atendida: "🟢 Atendida", no_asistio: "🔴 No asistió" };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm text-slate-500">Generá y llevá el registro de citaciones a padres de este curso.</p>
        <button onClick={() => setFormAbierto((v) => !v)} className="text-xs font-semibold px-3 py-2 rounded-full bg-violet-500 text-white">
          {formAbierto ? "Cerrar" : "+ Nueva citación"}
        </button>
      </div>

      {formAbierto && (
        <CitacionForm estudiantes={estudiantes} onCancelar={() => setFormAbierto(false)} onGuardada={() => { setFormAbierto(false); cargar(); }} />
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : citaciones.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">Todavía no hay citaciones registradas para este curso.</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(
            citaciones.reduce((acc, c) => { (acc[c.estudiante_id] = acc[c.estudiante_id] || []).push(c); return acc; }, {})
          ).map(([estudianteId, lista]) => {
            const noAsistio = lista.filter((c) => c.estado === "no_asistio").length;
            return (
              <div key={estudianteId} className="bg-white rounded-2xl border border-slate-100 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-slate-700">{lista[0].estudiante_nombre}</div>
                  <div className="flex gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{lista.length} citación(es)</span>
                    {noAsistio > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-semibold">{noAsistio} sin asistir</span>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {lista.map((c) => (
                    <div key={c.id} className="border-t border-slate-50 pt-1.5 flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-slate-600">{c.motivo}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {ESTADO_LABEL[c.estado]} {c.fecha_citacion ? `· ${c.fecha_citacion}${c.hora_citacion ? ` ${c.hora_citacion}` : ""}` : ""}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0 items-center">
                        <button onClick={() => imprimirFichaCitacion(c)} title="Imprimir ficha de citación (antes de la reunión)" className="text-xs text-slate-400 hover:text-violet-600">🎫</button>
                        {c.estado === "pendiente" && (
                          <>
                            <button onClick={() => verificar(c.id, "atendida")} title="Marcar que sí asistió" className="text-xs text-emerald-500 font-semibold">✅</button>
                            <button onClick={() => verificar(c.id, "no_asistio")} title="Marcar que no asistió" className="text-xs text-rose-500 font-semibold">❌</button>
                          </>
                        )}
                        <button onClick={() => setAtendiendo(c)} className="text-xs text-violet-500 font-semibold">Gestionar</button>
                        <button onClick={() => eliminar(c.id)} className="text-xs text-slate-300 hover:text-rose-500">🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {atendiendo && <AtenderCitacionModal citacion={atendiendo} onClose={() => setAtendiendo(null)} onGuardada={() => { setAtendiendo(null); cargar(); }} />}
    </div>
  );
}

function VistaNotasDireccionCurso({ grados, gradoId, setGradoId }) {
  const [estudiantes, setEstudiantes] = useState([]);
  const [notas, setNotas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [periodoVista, setPeriodoVista] = useState("promedio");
  const [notaMinima, setNotaMinima] = useState(3.5);
  const [importando, setImportando] = useState(null); // { materiaNombre, periodo }
  const [importarBoletinAbierto, setImportarBoletinAbierto] = useState(false);
  const [agregarMateriaAbierto, setAgregarMateriaAbierto] = useState(false);
  const [materiaAAgregar, setMateriaAAgregar] = useState("");
  const [periodoAAgregar, setPeriodoAAgregar] = useState("1");
  const [vistaAnalisis, setVistaAnalisis] = useState(false);

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

  const materiasConNotas = Array.from(new Set(notas.map((n) => n.materia_nombre))).sort();

  const periodosConDatos = Array.from(new Set(notas.map((n) => n.periodo))).sort();

  const notaCeldaCompleta = (estudianteId, materiaNombre, periodo) => {
    if (periodo === "promedio") {
      const propias = notas.filter((n) => n.estudiante_id === estudianteId && n.materia_nombre === materiaNombre);
      if (propias.length === 0) return null;
      const promedio = propias.reduce((a, n) => a + Number(n.nota), 0) / propias.length;
      return { nota: promedio, en_nivelacion: propias.some((n) => n.en_nivelacion), id: null };
    }
    return notas.find((n) => n.estudiante_id === estudianteId && n.materia_nombre === materiaNombre && n.periodo === periodo) || null;
  };

  const promedioMateria = (estudianteId, materiaNombre) => {
    const propias = notas.filter((n) => n.estudiante_id === estudianteId && n.materia_nombre === materiaNombre);
    if (propias.length === 0) return null;
    return propias.reduce((a, n) => a + Number(n.nota), 0) / propias.length;
  };

  const resumenEstudiante = (estudianteId) => {
    const porMateria = materiasConNotas.map((m) => ({ materia: m, valor: periodoVista === "promedio" ? promedioMateria(estudianteId, m) : notaCeldaCompleta(estudianteId, m, periodoVista)?.nota ?? null }));
    const conValor = porMateria.filter((x) => x.valor !== null && x.valor !== undefined);
    const perdidas = conValor.filter((x) => x.valor < notaMinima).map((x) => x.materia);
    const promedio = conValor.length ? conValor.reduce((a, x) => a + x.valor, 0) / conValor.length : null;
    return { promedio, perdidas: perdidas.length, materiasBajas: perdidas, total: conValor.length };
  };

  const toggleNivelacion = async (celda, periodo) => {
    if (periodo === "promedio") { alert('Para marcar nivelación, elegí un periodo puntual arriba (no "Promedio de todos los periodos").'); return; }
    if (!celda || !celda.id) return;
    await api.toggleNivelacionNota(celda.id, !celda.en_nivelacion);
    cargar();
  };

  const eliminarMateriaDelCurso = async (materiaNombre) => {
    if (!confirm(`¿Eliminar TODAS las notas cargadas de "${materiaNombre}" en este curso? Esto no se puede deshacer.`)) return;
    await api.eliminarNotasMateriaDireccionCurso(gradoId, materiaNombre, null);
    cargar();
  };

  const ranking = estudiantes
    .map((e) => ({ ...e, ...resumenEstudiante(e.id) }))
    .filter((e) => e.promedio !== null)
    .sort((a, b) => b.promedio - a.promedio)
    .map((e, i) => ({ ...e, puesto: i + 1 }));

  const promedioPorMateria = materiasConNotas.map((m) => {
    const valores = estudiantes.map((e) => periodoVista === "promedio" ? promedioMateria(e.id, m) : notaCeldaCompleta(e.id, m, periodoVista)?.nota ?? null).filter((v) => v !== null && v !== undefined);
    const promedio = valores.length ? valores.reduce((a, v) => a + v, 0) / valores.length : null;
    const perdidasCount = valores.filter((v) => v < notaMinima).length;
    return { nombre: m, promedio, perdidasCount, totalEvaluados: valores.length };
  }).sort((a, b) => (a.promedio ?? 99) - (b.promedio ?? 99));

  return (
    <div>
      <div className="flex flex-wrap gap-2 items-center mb-2">
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
        <button onClick={() => setAgregarMateriaAbierto((v) => !v)} className="text-xs font-semibold px-3 py-2 rounded-full border border-violet-200 text-violet-600">
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
          <p className="text-xs text-slate-500 mb-2">Escribí el nombre de la materia tal cual la querés ver (no hace falta que exista en tu catálogo) y el periodo cuyas notas vas a subir.</p>
          <div className="flex flex-wrap gap-2 items-center">
            <input value={materiaAAgregar} onChange={(e) => setMateriaAAgregar(e.target.value)} placeholder="Ej: Matemáticas"
              className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
            <select value={periodoAAgregar} onChange={(e) => setPeriodoAAgregar(e.target.value)} className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white">
              {PERIODOS.map((p) => <option key={p} value={p}>Periodo {p}</option>)}
            </select>
            <button disabled={!materiaAAgregar.trim()} onClick={() => {
              setImportando({ materiaNombre: materiaAAgregar.trim(), periodo: periodoAAgregar });
              setAgregarMateriaAbierto(false);
              setMateriaAAgregar("");
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
                  <th key={m} className="px-3 py-2">
                    <div>{m}</div>
                    <button onClick={() => eliminarMateriaDelCurso(m)} className="text-[9px] text-rose-400 font-normal">🗑 quitar</button>
                    <div>
                      <button onClick={() => setImportando({ materiaNombre: m, periodo: periodoVista === "promedio" ? "1" : periodoVista })}
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
                      const celda = notaCeldaCompleta(e.id, m, periodoVista);
                      const v = celda?.nota;
                      const esBaja = v !== null && v !== undefined && v < notaMinima;
                      const enNivelacion = celda?.en_nivelacion;
                      return (
                        <td key={m} onClick={() => toggleNivelacion(celda, periodoVista)}
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
        <ImportarNotasModal gradoId={gradoId} materiaNombre={importando.materiaNombre} periodo={importando.periodo}
          estudiantes={estudiantes} onClose={() => setImportando(null)} onImportado={cargar} />
      )}
      {importarBoletinAbierto && (
        <ImportarBoletinModal gradoId={gradoId} estudiantes={estudiantes} onClose={() => setImportarBoletinAbierto(false)} onImportado={cargar} />
      )}
    </div>
  );
}

export function VistaDireccionCurso({ grados }) {
  const [gradoId, setGradoId] = useState(grados[0]?.id || "");
  const [vista, setVista] = useState("panel"); // "panel" | "notas" | "citaciones"

  useEffect(() => { if (grados.length && !gradoId) setGradoId(grados[0].id); }, [grados]);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-800">🎓 Dirección de Curso</h2>
        <p className="text-sm text-slate-400">Panel central del curso: asistencia, convivencia, notas y citaciones, todo en un solo lugar.</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {grados.map((g) => <option key={g.id} value={g.id}>Curso {g.id}</option>)}
        </select>
        <div className="flex gap-1 rounded-full bg-slate-100 p-1">
          <button onClick={() => setVista("panel")} className={`text-xs px-3 py-1.5 rounded-full ${vista === "panel" ? "bg-violet-500 text-white" : "text-slate-600"}`}>📊 Panel</button>
          <button onClick={() => setVista("notas")} className={`text-xs px-3 py-1.5 rounded-full ${vista === "notas" ? "bg-violet-500 text-white" : "text-slate-600"}`}>📝 Notas</button>
          <button onClick={() => setVista("citaciones")} className={`text-xs px-3 py-1.5 rounded-full ${vista === "citaciones" ? "bg-violet-500 text-white" : "text-slate-600"}`}>📞 Citaciones</button>
        </div>
      </div>

      {vista === "panel" && <PanelDireccionCurso gradoId={gradoId} onVerCitaciones={() => setVista("citaciones")} />}
      {vista === "notas" && <VistaNotasDireccionCurso grados={grados} gradoId={gradoId} setGradoId={setGradoId} />}
      {vista === "citaciones" && <CitacionesDireccionCurso gradoId={gradoId} />}
    </div>
  );
}
