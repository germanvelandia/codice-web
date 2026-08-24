import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import * as api from "../lib/api";

export function VistaCorregirNombres() {
  const [estudiantes, setEstudiantes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [paso, setPaso] = useState(1); // 1: descargar/subir, 2: revisar cambios, 3: resultado
  const [cambios, setCambios] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [resultado, setResultado] = useState(null);

  const cargar = () => { setCargando(true); api.fetchTodosLosEstudiantesActivos().then((d) => { setEstudiantes(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  const descargarPlantilla = () => {
    const filas = [
      ["ID (no borrar ni cambiar)", "Grado", "Nombre actual", "Apellidos actuales (para ordenar)", "Nombre correcto (dejar vacío si ya está bien)", "Apellidos correctos (dejar vacío si ya están bien)"],
      ...estudiantes.map((e) => [e.id, e.grado_id, e.nombre, e.apellidos || "", "", ""]),
    ];
    const hoja = XLSX.utils.aoa_to_sheet(filas);
    hoja["!cols"] = [{ wch: 8 }, { wch: 10 }, { wch: 30 }, { wch: 22 }, { wch: 30 }, { wch: 22 }];
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Estudiantes");
    XLSX.writeFile(libro, "plantilla_corregir_nombres_codice.xlsx");
  };

  const procesarArchivo = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "binary" });
        const hoja = wb.Sheets[wb.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });

        const porId = {}; estudiantes.forEach((es) => { porId[es.id] = es; });
        const detectados = [];
        filas.forEach((f) => {
          const id = parseInt(f["ID (no borrar ni cambiar)"] || f["ID"], 10);
          if (!id || !porId[id]) return;
          const actual = porId[id];
          const nombreNuevo = String(f["Nombre correcto (dejar vacío si ya está bien)"] || "").trim();
          const apellidosNuevo = String(f["Apellidos correctos (dejar vacío si ya están bien)"] || "").trim();
          const cambiaNombre = nombreNuevo && nombreNuevo !== actual.nombre;
          const cambiaApellidos = apellidosNuevo && apellidosNuevo !== (actual.apellidos || "");
          if (cambiaNombre || cambiaApellidos) {
            detectados.push({
              id, grado: actual.grado_id,
              nombreActual: actual.nombre, nombreNuevo: cambiaNombre ? nombreNuevo : null,
              apellidosActual: actual.apellidos || "—", apellidosNuevo: cambiaApellidos ? apellidosNuevo : null,
              incluir: true,
            });
          }
        });

        if (detectados.length === 0) { alert("No se detectó ningún cambio — revisá que hayas completado las columnas de nombre/apellidos correctos."); return; }
        setCambios(detectados);
        setPaso(2);
      } catch (err) {
        alert("No se pudo leer el archivo: " + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const toggleIncluir = (i) => setCambios((prev) => prev.map((c, idx) => idx === i ? { ...c, incluir: !c.incluir } : c));

  const confirmarCambios = async () => {
    setGuardando(true);
    setProgreso(0);
    let hechos = 0, errores = 0;
    const detalleErrores = [];
    const aplicar = cambios.filter((c) => c.incluir);
    for (const c of aplicar) {
      try {
        if (c.nombreNuevo) await api.editarNombreEstudiante(c.id, c.nombreNuevo);
        if (c.apellidosNuevo) await api.guardarApellidos(c.id, c.apellidosNuevo);
        hechos++;
      } catch (e) {
        errores++;
        detalleErrores.push(`${c.nombreActual}: ${e.message}`);
      }
      setProgreso(hechos + errores);
    }
    setGuardando(false);
    setResultado({ hechos, errores, total: aplicar.length, detalleErrores });
    setPaso(3);
    cargar();
  };

  const reiniciar = () => { setPaso(1); setCambios([]); setResultado(null); };

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">🪪 Corregir nombres y apellidos</h2>
      <p className="text-sm text-slate-400 mb-4">
        Corrige nombres incompletos o mal escritos de una sola vez, para todos los cursos — el cambio se refleja automáticamente en toda la plataforma
        (Calificaciones, Observador, Actas, Asistencia, todo), porque el nombre vive en un solo lugar.
      </p>

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : paso === 1 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <p className="text-xs text-slate-500 mb-3">
            1. Descargá la plantilla con los {estudiantes.length} estudiantes activos de todos los cursos.<br />
            2. Completá SOLO las columnas "Nombre correcto" y/o "Apellidos correctos" en las filas que necesiten arreglo — dejá el resto vacío.<br />
            3. Subí el archivo — no hace falta borrar filas ni tocar la columna de ID.
          </p>
          <button onClick={descargarPlantilla} className="w-full text-sm font-semibold py-2.5 rounded-lg border border-violet-200 text-violet-600 mb-3">
            📄 Descargar plantilla ({estudiantes.length} estudiantes)
          </button>
          <label className="text-xs text-slate-500 block mb-1">Subir la plantilla completada</label>
          <input type="file" accept=".xlsx,.xls" onChange={(e) => e.target.files[0] && procesarArchivo(e.target.files[0])} className="text-sm" />
        </div>
      ) : paso === 2 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <p className="text-xs text-slate-500 mb-3">Se detectaron {cambios.length} cambio(s) — revisalos antes de confirmar. Desmarcá los que no quieras aplicar.</p>
          <div className="space-y-1.5 mb-4 max-h-96 overflow-y-auto">
            {cambios.map((c, i) => (
              <div key={c.id} className={`rounded-lg p-2 ${c.incluir ? "bg-emerald-50" : "bg-slate-50 opacity-50"}`}>
                <label className="flex items-start gap-2 text-xs">
                  <input type="checkbox" checked={c.incluir} onChange={() => toggleIncluir(i)} className="mt-0.5" />
                  <div>
                    <div className="text-slate-400">Grado {c.grado}</div>
                    {c.nombreNuevo && <div>Nombre: <span className="line-through text-slate-400">{c.nombreActual}</span> → <b className="text-emerald-700">{c.nombreNuevo}</b></div>}
                    {c.apellidosNuevo && <div>Apellidos (orden): <span className="line-through text-slate-400">{c.apellidosActual}</span> → <b className="text-emerald-700">{c.apellidosNuevo}</b></div>}
                  </div>
                </label>
              </div>
            ))}
          </div>
          {guardando ? (
            <div className="text-center text-sm text-violet-600 font-semibold">Guardando… {progreso}/{cambios.filter((c) => c.incluir).length}</div>
          ) : (
            <div className="flex justify-between">
              <button onClick={reiniciar} className="text-xs text-slate-500 px-3 py-2">← Volver</button>
              <button disabled={cambios.every((c) => !c.incluir)} onClick={confirmarCambios} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50">
                Confirmar {cambios.filter((c) => c.incluir).length} cambio(s)
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3">
            <p className="text-sm font-semibold text-emerald-700">✔ Listo</p>
            <p className="text-xs text-emerald-600 mt-1">Se corrigieron {resultado.hechos} de {resultado.total} estudiante(s).</p>
          </div>
          {resultado.detalleErrores.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 text-[11px] text-rose-700 max-h-32 overflow-y-auto mb-3">
              <p className="font-semibold mb-1">No se pudieron corregir:</p>
              <ul className="list-disc list-inside">{resultado.detalleErrores.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}
          <button onClick={reiniciar} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white">Hacer otra corrección</button>
        </div>
      )}
    </div>
  );
}
