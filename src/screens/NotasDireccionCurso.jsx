import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import * as api from "../lib/api";
import { ordenarPorApellido, buscarEstudiantePorNombre } from "../lib/gamification";

const SISTEMAS = {
  bimestre: { nombre: "Bimestre", cantidad: 4 },
  trimestre: { nombre: "Trimestre", cantidad: 3 },
  semestre: { nombre: "Semestre", cantidad: 2 },
};

function periodosDe(sistema) {
  const info = SISTEMAS[sistema] || SISTEMAS.trimestre;
  return Array.from({ length: info.cantidad }, (_, i) => String(i + 1));
}

function promedio(valores) {
  const nums = valores.filter((v) => v !== null && v !== undefined && v !== "").map(Number);
  if (nums.length === 0) return null;
  return nums.reduce((a, v) => a + v, 0) / nums.length;
}

// Color por desempeño (Bajo/Básico/Alto/Superior) — igual criterio que la
// Planilla de Calificaciones: por debajo de la nota mínima es "Bajo", y el
// resto del rango hasta 5.0 se reparte en tres tramos iguales.
function colorDesempeno(valor, notaMinima) {
  if (valor === null || valor === undefined || isNaN(valor)) return { color: "#94A3B8", bg: "transparent" };
  const min = notaMinima ?? 3.5;
  const max = 5.0;
  if (valor < min) return { color: "#B91C1C", bg: "#FEF2F2" };
  const rango = max - min;
  if (rango <= 0) return { color: "#15803D", bg: "#F0FDF4" };
  const proporcion = (valor - min) / rango;
  if (proporcion < 1 / 3) return { color: "#B45309", bg: "#FFFBEB" };
  if (proporcion < 2 / 3) return { color: "#1D4ED8", bg: "#EFF6FF" };
  return { color: "#15803D", bg: "#F0FDF4" };
}

/* ---------------- Verificación de estudiantes (compartida por los dos importadores) ---------------- */
function PantallaVerificacion({ filas, estudiantes, onCorregir, onConfirmar, onVolver, guardando }) {
  const sinEmparejar = filas.filter((f) => !f.estudianteId).length;
  return (
    <div>
      <p className="text-xs text-slate-500 mb-3">
        Revisá que cada fila haya quedado emparejada con el estudiante correcto — es lo más importante antes de subir las notas.
        {sinEmparejar > 0 && <span className="text-amber-600 font-semibold"> {sinEmparejar} fila(s) sin emparejar todavía.</span>}
      </p>
      <div className="space-y-1.5 mb-4 max-h-96 overflow-y-auto">
        {filas.map((f, i) => (
          <div key={i} className={`rounded-lg p-2 ${f.estudianteId ? "bg-emerald-50" : "bg-amber-50"}`}>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 w-32 truncate shrink-0" title={f.nombreOriginal}>Excel: "{f.nombreOriginal}"</span>
              <select value={f.estudianteId || ""} onChange={(e) => onCorregir(i, e.target.value ? parseInt(e.target.value, 10) : null)}
                className="flex-1 text-xs rounded-lg px-2 py-1 border border-slate-200 outline-none bg-white">
                <option value="">— Sin emparejar (no se sube) —</option>
                {estudiantes.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 pl-1">
              {Object.entries(f.valoresPorPeriodo).filter(([, v]) => v !== "" && v !== undefined).map(([p, v]) => `P${p}: ${v}`).join(" · ") || "Sin notas en esta fila"}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between">
        <button onClick={onVolver} className="text-xs text-slate-500 px-3 py-2">← Volver</button>
        <button disabled={guardando || filas.every((f) => !f.estudianteId)} onClick={onConfirmar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50">
          {guardando ? "Subiendo…" : `Confirmar y subir ${filas.filter((f) => f.estudianteId).length} fila(s)`}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Opción 1: pegar tabla ---------------- */
function ImportarPegarModal({ gradoId, materias, periodos, estudiantes, onClose, onImportado }) {
  const [materiaNombre, setMateriaNombre] = useState(materias[0]?.nombre || "");
  const [texto, setTexto] = useState("");
  const [paso, setPaso] = useState(1);
  const [filas, setFilas] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const procesar = () => {
    const lineas = texto.trim().split("\n").filter((l) => l.trim());
    if (lineas.length < 2) { alert("Pegá al menos una fila de encabezado y una fila de datos."); return; }
    const filasDatos = lineas.slice(1);
    const parseadas = filasDatos.map((linea) => {
      const columnas = linea.split("\t");
      const nombreOriginal = (columnas[0] || "").trim();
      const valoresPorPeriodo = {};
      periodos.forEach((p, idx) => { valoresPorPeriodo[p] = (columnas[idx + 1] || "").trim(); });
      const match = buscarEstudiantePorNombre(nombreOriginal, estudiantes);
      return { nombreOriginal, estudianteId: match?.id || null, valoresPorPeriodo };
    }).filter((f) => f.nombreOriginal);
    setFilas(parseadas);
    setPaso(2);
  };

  const corregir = (i, estudianteId) => setFilas((prev) => prev.map((f, idx) => idx === i ? { ...f, estudianteId } : f));

  const confirmar = async () => {
    setGuardando(true);
    let cargadas = 0;
    const errores = [];
    for (const f of filas) {
      if (!f.estudianteId) continue;
      for (const p of periodos) {
        const val = f.valoresPorPeriodo[p];
        if (val === "" || val === undefined) continue;
        const num = parseFloat(String(val).replace(",", "."));
        if (isNaN(num)) continue;
        try {
          await api.guardarNotaDireccionCurso(gradoId, materiaNombre, f.estudianteId, p, num);
          cargadas++;
        } catch (e) {
          errores.push(`${f.nombreOriginal} (P${p}): ${e.message}`);
        }
      }
    }
    setGuardando(false);
    setResultado({ cargadas, errores });
    onImportado();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">📋 Pegar tabla de notas</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        {resultado !== null ? (
          <div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3">
              <p className="text-sm font-semibold text-emerald-700">{resultado.cargadas > 0 ? "✔ Listo" : "⚠️ No se cargó ninguna nota"}</p>
              <p className="text-xs text-emerald-600 mt-1">Se cargaron {resultado.cargadas} nota(s).</p>
            </div>
            {resultado.errores.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 text-[11px] text-rose-700 max-h-40 overflow-y-auto mb-3">
                <p className="font-semibold mb-1">Detalle de lo que falló:</p>
                <ul className="list-disc list-inside">{resultado.errores.map((e, i) => <li key={i}>{e}</li>)}</ul>
              </div>
            )}
            <button onClick={onClose} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white">Cerrar</button>
          </div>
        ) : paso === 1 ? (
          <div>
            <label className="text-xs text-slate-500 block mb-1">Materia</label>
            <select value={materiaNombre} onChange={(e) => setMateriaNombre(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none">
              {materias.map((m) => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
            </select>
            <p className="text-xs text-slate-500 mb-2">
              Copiá desde Excel el bloque completo (incluida la fila de encabezados) y pegalo acá — primera columna: nombre del estudiante,
              columnas siguientes en orden: {periodos.map((p) => `P${p}`).join(", ")}.
            </p>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={10} placeholder="Estudiante	P1	P2	P3"
              className="w-full text-xs font-mono rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />
            <button disabled={!texto.trim() || !materiaNombre} onClick={procesar} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-50">
              Continuar →
            </button>
          </div>
        ) : (
          <PantallaVerificacion filas={filas} estudiantes={estudiantes} onCorregir={corregir} onConfirmar={confirmar} onVolver={() => setPaso(1)} guardando={guardando} />
        )}
      </div>
    </div>
  );
}

/* ---------------- Opción 2: subir archivo Moodle/Excel ---------------- */
function adivinarPeriodoColumna(encabezado, periodos) {
  const texto = String(encabezado || "").toLowerCase();
  const match = texto.match(/[1-9]\d*/);
  if (match && periodos.includes(match[0])) return match[0];
  return "";
}

function ImportarArchivoModal({ gradoId, materias, periodos, estudiantes, onClose, onImportado }) {
  const [materiaNombre, setMateriaNombre] = useState(materias[0]?.nombre || "");
  const [paso, setPaso] = useState(1);
  const [encabezados, setEncabezados] = useState([]);
  const [filasCrudo, setFilasCrudo] = useState([]);
  const [mapeoColumnas, setMapeoColumnas] = useState({});
  const [filas, setFilas] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const procesarArchivo = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "binary" });
        const hoja = wb.Sheets[wb.SheetNames[0]];
        const arr = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "" });
        if (arr.length < 2) { alert("El archivo no tiene suficientes filas."); return; }
        const heads = arr[0];
        setEncabezados(heads);
        setFilasCrudo(arr.slice(1).filter((f) => f.some((c) => c !== "" && c !== undefined)));
        const mapeoInicial = {};
        for (let i = 1; i < heads.length; i++) {
          const p = adivinarPeriodoColumna(heads[i], periodos);
          if (p) mapeoInicial[i] = p;
        }
        setMapeoColumnas(mapeoInicial);
        setPaso(2);
      } catch (err) {
        alert("No se pudo leer el archivo: " + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const confirmarMapeo = () => {
    const parseadas = filasCrudo.map((fila) => {
      const nombreOriginal = String(fila[0] || "").trim();
      const valoresPorPeriodo = {};
      periodos.forEach((p) => { valoresPorPeriodo[p] = ""; });
      Object.entries(mapeoColumnas).forEach(([idx, periodo]) => {
        if (periodo) valoresPorPeriodo[periodo] = String(fila[idx] ?? "").trim();
      });
      const match = buscarEstudiantePorNombre(nombreOriginal, estudiantes);
      return { nombreOriginal, estudianteId: match?.id || null, valoresPorPeriodo };
    }).filter((f) => f.nombreOriginal);
    setFilas(parseadas);
    setPaso(3);
  };

  const corregir = (i, estudianteId) => setFilas((prev) => prev.map((f, idx) => idx === i ? { ...f, estudianteId } : f));

  const confirmar = async () => {
    setGuardando(true);
    let cargadas = 0;
    const errores = [];
    for (const f of filas) {
      if (!f.estudianteId) continue;
      for (const p of periodos) {
        const val = f.valoresPorPeriodo[p];
        if (val === "" || val === undefined) continue;
        const num = parseFloat(String(val).replace(",", "."));
        if (isNaN(num)) continue;
        try {
          await api.guardarNotaDireccionCurso(gradoId, materiaNombre, f.estudianteId, p, num);
          cargadas++;
        } catch (e) {
          errores.push(`${f.nombreOriginal} (P${p}): ${e.message}`);
        }
      }
    }
    setGuardando(false);
    setResultado({ cargadas, errores });
    onImportado();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">📥 Subir archivo (Moodle / Excel / CSV)</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        {resultado !== null ? (
          <div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3">
              <p className="text-sm font-semibold text-emerald-700">{resultado.cargadas > 0 ? "✔ Listo" : "⚠️ No se cargó ninguna nota"}</p>
              <p className="text-xs text-emerald-600 mt-1">Se cargaron {resultado.cargadas} nota(s).</p>
            </div>
            {resultado.errores.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 text-[11px] text-rose-700 max-h-40 overflow-y-auto mb-3">
                <p className="font-semibold mb-1">Detalle de lo que falló:</p>
                <ul className="list-disc list-inside">{resultado.errores.map((e, i) => <li key={i}>{e}</li>)}</ul>
              </div>
            )}
            <button onClick={onClose} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white">Cerrar</button>
          </div>
        ) : paso === 1 ? (
          <div>
            <label className="text-xs text-slate-500 block mb-1">Materia</label>
            <select value={materiaNombre} onChange={(e) => setMateriaNombre(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none">
              {materias.map((m) => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
            </select>
            <p className="text-xs text-slate-500 mb-3">
              Subí el archivo exportado de Moodle (o cualquier Excel/CSV) tal cual — puede traer varias columnas de periodos a la vez.
              Primera columna: nombre del estudiante.
            </p>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files[0] && procesarArchivo(e.target.files[0])} className="text-sm" />
          </div>
        ) : paso === 2 ? (
          <div>
            <p className="text-xs text-slate-500 mb-3">Decime qué periodo corresponde a cada columna del archivo (dejá "Ignorar" en las que no apliquen).</p>
            <div className="space-y-1.5 mb-4 max-h-72 overflow-y-auto">
              {encabezados.slice(1).map((h, idx) => {
                const i = idx + 1;
                return (
                  <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                    <span className="text-[11px] text-slate-500 w-40 truncate shrink-0" title={h}>Excel: "{h || `Columna ${i + 1}`}"</span>
                    <select value={mapeoColumnas[i] || ""} onChange={(e) => setMapeoColumnas((prev) => ({ ...prev, [i]: e.target.value }))}
                      className="flex-1 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
                      <option value="">Ignorar esta columna</option>
                      {periodos.map((p) => <option key={p} value={p}>Periodo {p}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between">
              <button onClick={() => setPaso(1)} className="text-xs text-slate-500 px-3 py-2">← Volver</button>
              <button onClick={confirmarMapeo} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white">Continuar →</button>
            </div>
          </div>
        ) : (
          <PantallaVerificacion filas={filas} estudiantes={estudiantes} onCorregir={corregir} onConfirmar={confirmar} onVolver={() => setPaso(2)} guardando={guardando} />
        )}
      </div>
    </div>
  );
}

/* ---------------- Pantalla principal ---------------- */
export function NotasDireccionCurso({ gradoId }) {
  const [materias, setMaterias] = useState([]);
  const [config, setConfig] = useState({ sistema_periodos: "trimestre" });
  const [notas, setNotas] = useState([]);
  const [estudiantes, setEstudiantes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [agregandoMateria, setAgregandoMateria] = useState(false);
  const [nombreNuevaMateria, setNombreNuevaMateria] = useState("");
  const [editandoMateriaId, setEditandoMateriaId] = useState(null);
  const [nombreEdicion, setNombreEdicion] = useState("");
  const [importarPegarAbierto, setImportarPegarAbierto] = useState(false);
  const [importarArchivoAbierto, setImportarArchivoAbierto] = useState(false);
  const [anchoCelda, setAnchoCelda] = useState(64);

  const periodos = periodosDe(config.sistema_periodos);

  const cargar = () => {
    if (!gradoId) return;
    setCargando(true);
    Promise.all([
      api.fetchMateriasCurso(gradoId),
      api.fetchConfigCurso(gradoId),
      api.fetchNotasDireccionCurso(gradoId),
      api.fetchEstudiantesPorGrado(gradoId),
    ]).then(([m, c, n, e]) => {
      setMaterias(m);
      setConfig(c);
      setNotas(n);
      setEstudiantes(ordenarPorApellido(e));
      setCargando(false);
    });
  };
  useEffect(() => { cargar(); }, [gradoId]);

  const cambiarSistema = async (sistema) => {
    setConfig((prev) => ({ ...prev, sistema_periodos: sistema }));
    await api.guardarConfigCurso(gradoId, { sistema_periodos: sistema, nota_minima: config.nota_minima ?? 3.5 });
  };

  const cambiarNotaMinima = async (valor) => {
    setConfig((prev) => ({ ...prev, nota_minima: valor }));
    await api.guardarConfigCurso(gradoId, { sistema_periodos: config.sistema_periodos, nota_minima: valor });
  };

  const agregarMateria = async () => {
    if (!nombreNuevaMateria.trim()) return;
    try {
      await api.crearMateriaCurso(gradoId, nombreNuevaMateria.trim(), materias.length);
      setNombreNuevaMateria("");
      setAgregandoMateria(false);
      cargar();
    } catch (e) {
      alert("Error: " + (e.message.includes("duplicate") ? "Ya existe una materia con ese nombre en este curso." : e.message));
    }
  };

  const guardarEdicionMateria = async (materia) => {
    if (!nombreEdicion.trim()) return;
    try {
      await api.renombrarMateriaCurso(materia.id, gradoId, materia.nombre, nombreEdicion.trim());
      setEditandoMateriaId(null);
      cargar();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const eliminarMateria = async (materia) => {
    if (!confirm(`¿Eliminar "${materia.nombre}" y TODAS sus notas cargadas en este curso? Esto no se puede deshacer.`)) return;
    await api.eliminarMateriaCurso(materia.id, gradoId, materia.nombre);
    cargar();
  };

  const notaDe = (estudianteId, materiaNombre, periodo) => {
    const n = notas.find((x) => x.estudiante_id === estudianteId && x.materia_nombre === materiaNombre && x.periodo === periodo);
    return n ? n.nota : null;
  };

  const guardarNotaCelda = async (estudianteId, materiaNombre, periodo, valorTexto) => {
    const texto = valorTexto.trim().replace(",", ".");
    try {
      if (texto === "") {
        await api.eliminarNotaCeldaDireccionCurso(gradoId, materiaNombre, estudianteId, periodo);
      } else {
        const num = parseFloat(texto);
        if (isNaN(num)) { alert("Escribí un número válido."); cargar(); return; }
        await api.guardarNotaDireccionCurso(gradoId, materiaNombre, estudianteId, periodo, num);
      }
      cargar();
    } catch (e) {
      alert("Error al guardar: " + e.message);
      cargar();
    }
  };

  const resultadoMateria = (estudianteId, materiaNombre) => promedio(periodos.map((p) => notaDe(estudianteId, materiaNombre, p)));

  const resultadoGeneral = (estudianteId) => promedio(materias.map((m) => resultadoMateria(estudianteId, m.nombre)));

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;

  return (
    <div>
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white rounded-full px-3 py-2 border border-slate-200">
          Sistema:
          <div className="flex gap-1 rounded-full bg-slate-100 p-0.5">
            {Object.entries(SISTEMAS).map(([key, info]) => (
              <button key={key} onClick={() => cambiarSistema(key)} className={`text-[11px] px-2 py-1 rounded-full ${config.sistema_periodos === key ? "bg-violet-500 text-white" : "text-slate-600"}`}>
                {info.nombre}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white rounded-full px-3 py-2 border border-slate-200">
          Nota mínima:
          <input type="number" step="0.1" min="0" max="5" value={config.nota_minima ?? 3.5} onChange={(e) => cambiarNotaMinima(parseFloat(e.target.value) || 3.5)}
            className="w-14 text-xs rounded px-1.5 py-0.5 border border-slate-200 outline-none" />
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500 bg-white rounded-full px-3 py-2 border border-slate-200">
          Ancho de celdas:
          <button onClick={() => setAnchoCelda((v) => Math.max(48, v - 12))} className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold">−</button>
          <span className="w-6 text-center">{anchoCelda}</span>
          <button onClick={() => setAnchoCelda((v) => Math.min(140, v + 12))} className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold">+</button>
        </div>
        <button onClick={() => setImportarPegarAbierto(true)} disabled={materias.length === 0} className="text-xs font-semibold px-3 py-2 rounded-full border border-violet-200 text-violet-600 disabled:opacity-40">
          📋 Pegar tabla
        </button>
        <button onClick={() => setImportarArchivoAbierto(true)} disabled={materias.length === 0} className="text-xs font-semibold px-3 py-2 rounded-full border border-violet-200 text-violet-600 disabled:opacity-40">
          📥 Subir archivo Moodle/Excel
        </button>
      </div>
      <p className="text-[11px] text-slate-400 mb-2">🔴 Bajo · 🟡 Básico · 🔵 Alto · 🟢 Superior (según la nota mínima configurada) — tocá cualquier nota para corregirla. Usá "Ancho de celdas" si algún número queda apretado.</p>

      {materias.length === 0 && !agregandoMateria && (
        <p className="text-xs text-amber-600 mb-2">Todavía no hay materias configuradas para este curso — agregá la primera con el botón (+) en la tabla de abajo.</p>
      )}

      <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-100">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th rowSpan={2} className="sticky left-0 bg-slate-50 border border-slate-200 px-2 py-2 text-left align-bottom">Estudiante</th>
              {materias.map((m) => (
                <th key={m.id} colSpan={periodos.length + 1} className="border border-slate-200 bg-slate-50 px-2 py-1.5">
                  {editandoMateriaId === m.id ? (
                    <div className="flex items-center gap-1">
                      <input value={nombreEdicion} onChange={(e) => setNombreEdicion(e.target.value)} className="w-28 text-[11px] rounded px-1 py-0.5 border border-slate-300 outline-none" autoFocus />
                      <button onClick={() => guardarEdicionMateria(m)} className="text-emerald-600">✔</button>
                      <button onClick={() => setEditandoMateriaId(null)} className="text-slate-400">✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="font-semibold">{m.nombre}</span>
                      <button onClick={() => { setEditandoMateriaId(m.id); setNombreEdicion(m.nombre); }} title="Modificar" className="text-slate-400 hover:text-violet-600">✏️</button>
                      <button onClick={() => eliminarMateria(m)} title="Eliminar" className="text-slate-400 hover:text-rose-500">➖</button>
                    </div>
                  )}
                </th>
              ))}
              <th rowSpan={2} className="border border-slate-200 bg-violet-50 px-2 py-2 align-bottom font-semibold text-violet-700" style={{ minWidth: anchoCelda + 20, width: anchoCelda + 20 }}>Resultado Final</th>
              <th rowSpan={2} className="border border-slate-200 px-1 py-2 align-bottom">
                {agregandoMateria ? (
                  <div className="flex flex-col gap-1 items-center">
                    <input value={nombreNuevaMateria} onChange={(e) => setNombreNuevaMateria(e.target.value)} placeholder="Nombre" className="w-24 text-[11px] rounded px-1 py-1 border border-slate-300 outline-none" autoFocus />
                    <div className="flex gap-1">
                      <button onClick={agregarMateria} className="text-emerald-600 text-xs">✔</button>
                      <button onClick={() => setAgregandoMateria(false)} className="text-slate-400 text-xs">✕</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAgregandoMateria(true)} title="Agregar materia" className="text-violet-500 text-base font-bold">➕</button>
                )}
              </th>
            </tr>
            <tr>
              {materias.map((m) => (
                <React.Fragment key={m.id}>
                  {periodos.map((p) => <th key={p} className="border border-slate-200 bg-slate-50 px-1.5 py-1.5 font-normal text-[11px]" style={{ minWidth: anchoCelda, width: anchoCelda }}>P{p}</th>)}
                  <th className="border border-slate-200 bg-slate-100 px-1.5 py-1.5 font-semibold text-[11px]" style={{ minWidth: anchoCelda + 10, width: anchoCelda + 10 }}>Result.</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {estudiantes.map((e) => (
              <tr key={e.id}>
                <td className="sticky left-0 bg-white border border-slate-200 px-2 py-1.5 font-medium text-slate-700 whitespace-nowrap">{e.nombre}</td>
                {materias.map((m) => (
                  <React.Fragment key={m.id}>
                    {periodos.map((p) => {
                      const v = notaDe(e.id, m.nombre, p);
                      const c = colorDesempeno(v, config.nota_minima);
                      return (
                        <td key={p} className="border border-slate-200 p-0" style={{ background: c.bg, minWidth: anchoCelda, width: anchoCelda }}>
                          <input type="text" inputMode="decimal" defaultValue={v !== null ? v.toFixed(1) : ""} placeholder="—"
                            onBlur={(ev) => guardarNotaCelda(e.id, m.nombre, p, ev.target.value)}
                            onKeyDown={(ev) => { if (ev.key === "Enter") ev.target.blur(); }}
                            style={{ color: c.color }}
                            className="w-full text-center text-sm font-semibold bg-transparent outline-none px-1.5 py-2" />
                        </td>
                      );
                    })}
                    {(() => {
                      const r = resultadoMateria(e.id, m.nombre);
                      const c = colorDesempeno(r, config.nota_minima);
                      return (
                        <td className="border border-slate-200 px-1.5 py-2 text-center text-sm font-bold" style={{ background: c.bg, color: c.color, minWidth: anchoCelda + 10, width: anchoCelda + 10 }}>
                          {r !== null ? r.toFixed(1) : "—"}
                        </td>
                      );
                    })()}
                  </React.Fragment>
                ))}
                {(() => {
                  const r = resultadoGeneral(e.id);
                  const c = colorDesempeno(r, config.nota_minima);
                  return (
                    <td className="border border-slate-200 px-2 py-2 text-center text-base font-bold" style={{ background: c.bg, color: c.color, minWidth: anchoCelda + 20, width: anchoCelda + 20 }}>
                      {r !== null ? r.toFixed(1) : "—"}
                    </td>
                  );
                })()}
                <td className="border border-slate-200"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {importarPegarAbierto && (
        <ImportarPegarModal gradoId={gradoId} materias={materias} periodos={periodos} estudiantes={estudiantes}
          onClose={() => setImportarPegarAbierto(false)} onImportado={cargar} />
      )}
      {importarArchivoAbierto && (
        <ImportarArchivoModal gradoId={gradoId} materias={materias} periodos={periodos} estudiantes={estudiantes}
          onClose={() => setImportarArchivoAbierto(false)} onImportado={cargar} />
      )}
    </div>
  );
}
