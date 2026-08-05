import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import * as api from "../lib/api";
import {
  CONFIG_DEFAULT, periodosDe, bandaDesempeno, notaAutomatica, notaFinalPonderada,
  calcularEstadisticas, GAM_CATEGORIAS_OPCIONES,
} from "../lib/calificaciones";
import { buscarEstudiantePorNombre } from "../lib/gamification";
import { ActasModal } from "./Actas";

function BarraMateria({ materias, materiaActualId, setMateriaActualId, onCambio }) {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [duplicando, setDuplicando] = useState(false);
  const [copiarDesdeId, setCopiarDesdeId] = useState("");

  const crear = async () => {
    if (!nombre.trim()) return;
    const nueva = await api.crearMateria(nombre.trim());
    setNombre(""); setCreando(false);
    onCambio();
    setMateriaActualId(nueva.id);
  };

  const duplicar = async () => {
    if (!nombre.trim()) return;
    const nueva = await api.duplicarMateria(materiaActualId, nombre.trim());
    setNombre(""); setDuplicando(false);
    onCambio();
    setMateriaActualId(nueva.id);
  };

  const eliminar = async () => {
    if (materias.length <= 1) { alert("Debes tener al menos una materia."); return; }
    if (!confirm("¿Eliminar esta materia? Se borran también sus categorías, actividades y notas.")) return;
    await api.eliminarMateria(materiaActualId);
    onCambio();
    setMateriaActualId(materias.find((m) => m.id !== materiaActualId)?.id || null);
  };

  const copiar = async () => {
    const origen = materias.find((m) => m.id === parseInt(copiarDesdeId, 10));
    if (!origen) return;
    if (!confirm(`¿Copiar todas las categorías, actividades y notas de "${origen.nombre}" a esta materia? Esto reemplaza lo que ya tengas aquí.`)) return;
    await api.copiarNotasDesdeMateria(origen.id, materiaActualId);
    onCambio();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3 mb-4 flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-slate-400">Materia:</span>
      {materias.length > 0 && (
        <select value={materiaActualId || ""} onChange={(e) => setMateriaActualId(parseInt(e.target.value, 10))} className="text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none">
          {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
      )}
      {!creando ? (
        <button onClick={() => setCreando(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-100 text-violet-700">+ Nueva materia</button>
      ) : (
        <div className="flex gap-1">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej: Ética)" className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
          <button onClick={crear} className="text-xs px-2 py-1.5 rounded-lg bg-violet-500 text-white">Crear</button>
          <button onClick={() => setCreando(false)} className="text-xs px-2 py-1.5 text-slate-400">✕</button>
        </div>
      )}
      {materiaActualId && !duplicando && (
        <button onClick={() => setDuplicando(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">⧉ Duplicar como nueva</button>
      )}
      {duplicando && (
        <div className="flex gap-1">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la copia" className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
          <button onClick={duplicar} className="text-xs px-2 py-1.5 rounded-lg bg-violet-500 text-white">Duplicar</button>
          <button onClick={() => setDuplicando(false)} className="text-xs px-2 py-1.5 text-slate-400">✕</button>
        </div>
      )}
      {materiaActualId && <button onClick={eliminar} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>}
      {materiaActualId && materias.length > 1 && (
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-slate-400">Copiar notas desde:</span>
          <select value={copiarDesdeId} onChange={(e) => setCopiarDesdeId(e.target.value)} className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none">
            <option value="">Elige…</option>
            {materias.filter((m) => m.id !== materiaActualId).map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
          <button disabled={!copiarDesdeId} onClick={copiar} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white disabled:opacity-40">Copiar con un clic</button>
        </div>
      )}
    </div>
  );
}

function PanelCategorias({ materiaId, categorias, onCambio }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [porcentaje, setPorcentaje] = useState(25);
  const sumaTotal = categorias.reduce((a, c) => a + c.porcentaje, 0);

  const crear = async () => {
    if (!nombre.trim()) return;
    await api.crearCategoria(materiaId, nombre.trim(), porcentaje);
    setNombre("");
    onCambio();
  };
  const eliminar = async (id) => { await api.eliminarCategoria(id); onCambio(); };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3 mb-4">
      <button onClick={() => setAbierto((v) => !v)} className="text-sm font-semibold text-slate-700 flex items-center gap-2">
        {abierto ? "▾" : "▸"} Categorías de evaluación {sumaTotal !== 100 && <span className="text-xs text-amber-600">(suman {sumaTotal}%, deberían sumar 100%)</span>}
      </button>
      {abierto && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2 mb-3">
            {categorias.map((c) => (
              <div key={c.id} className="flex items-center gap-2 bg-violet-50 rounded-full px-3 py-1.5 text-xs">
                <span>{c.nombre} ({c.porcentaje}%)</span>
                <button onClick={() => eliminar(c.id)} className="text-slate-400 hover:text-rose-500">✕</button>
              </div>
            ))}
            {categorias.length === 0 && <span className="text-xs text-slate-400">Sin categorías todavía.</span>}
          </div>
          <div className="flex gap-2">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej: Talleres)" className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none flex-1" />
            <input type="number" value={porcentaje} onChange={(e) => setPorcentaje(parseInt(e.target.value || "0", 10))} className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none w-20" />
            <button onClick={crear} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white">Crear</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActividadModal({ materiaId, gradoId, periodo, categorias, editar, onClose, onGuardada }) {
  const [nombre, setNombre] = useState(editar?.nombre || "");
  const [categoriaId, setCategoriaId] = useState(editar?.categoria_id || categorias[0]?.id || "");
  const [tipo, setTipo] = useState(editar?.es_automatica ? "auto" : "manual");
  const [gamCategoria, setGamCategoria] = useState(editar?.gam_categoria || "academico");
  const [xpMeta, setXpMeta] = useState(editar?.xp_meta || 50);

  const guardar = async () => {
    if (!nombre.trim() || !categoriaId) return;
    const campos = {
      nombre: nombre.trim(), categoria_id: categoriaId, materia_id: materiaId, grado_id: gradoId, periodo,
      es_automatica: tipo === "auto", gam_categoria: tipo === "auto" ? gamCategoria : null, xp_meta: tipo === "auto" ? xpMeta : null,
    };
    if (editar) await api.editarActividad(editar.id, campos);
    else await api.crearActividad(campos);
    onGuardada();
  };

  if (categorias.length === 0) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 max-w-sm text-center shadow-xl">
          <p className="text-sm text-slate-700 mb-3">Primero crea al menos una categoría de evaluación.</p>
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg bg-violet-500 text-white">Entendido</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">{editar ? "Editar actividad" : "Nueva actividad"}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej: Taller 1)"
          className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none" />
        <select value={categoriaId} onChange={(e) => setCategoriaId(parseInt(e.target.value, 10))} className="w-full text-sm rounded-lg px-2 py-2 mb-2 border border-slate-200 outline-none">
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({c.porcentaje}%)</option>)}
        </select>
        <div className="flex gap-1 mb-2 rounded-full bg-slate-100 p-1">
          <button onClick={() => setTipo("manual")} className={`flex-1 text-xs py-1.5 rounded-full ${tipo === "manual" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Manual</button>
          <button onClick={() => setTipo("auto")} className={`flex-1 text-xs py-1.5 rounded-full ${tipo === "auto" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Automática (gamificación)</button>
        </div>
        {tipo === "auto" && (
          <div className="bg-slate-50 rounded-lg p-2 mb-2">
            <p className="text-xs text-slate-500 mb-1.5">La nota se calcula con todo el XP acumulado del estudiante en esta categoría de gamificación.</p>
            <select value={gamCategoria} onChange={(e) => setGamCategoria(e.target.value)} className="w-full text-sm rounded-lg px-2 py-1.5 mb-1.5 border border-slate-200 outline-none">
              {GAM_CATEGORIAS_OPCIONES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">XP para nota máxima:</label>
              <input type="number" value={xpMeta} onChange={(e) => setXpMeta(parseInt(e.target.value || "1", 10))} className="w-20 text-sm rounded-lg px-2 py-1 border border-slate-200 outline-none" />
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 mt-2">
          <button onClick={onClose} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
          <button onClick={guardar} className="text-xs font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white">{editar ? "Guardar cambios" : "Crear actividad"}</button>
        </div>
      </div>
    </div>
  );
}

function ImportarMoodleModal({ materiaId, gradoId, periodo, categorias, periodos, estudiantes, onClose, onImportado }) {
  const [paso, setPaso] = useState(1);
  const [texto, setTexto] = useState("");
  const [filas, setFilas] = useState([]);
  const [encabezados, setEncabezados] = useState([]);
  const [colNombre, setColNombre] = useState("");
  const [config, setConfig] = useState({});
  const [importando, setImportando] = useState(false);
  const [progresoTexto, setProgresoTexto] = useState("");
  const [resultado, setResultado] = useState(null);

  const procesarDesdeArray = (arr) => {
    if (arr.length < 2) { alert("No se encontraron suficientes filas."); return; }
    const heads = arr[0].map((h) => String(h || "").trim()).filter(Boolean);
    const datos = arr.slice(1).filter((r) => r.length > 0 && r.some((c) => c !== "" && c !== undefined));
    setEncabezados(heads);
    setColNombre(heads[0]);
    const cfg = {};
    heads.slice(1).forEach((h) => { cfg[h] = { incluir: true, categoriaId: categorias[0]?.id || "", periodo: periodo || periodos[0] }; });
    setConfig(cfg);
    setFilas(datos.map((r) => {
      const obj = {};
      heads.forEach((h, i) => { obj[h] = r[i]; });
      return obj;
    }));
    setPaso(2);
  };

  const procesarPegado = () => {
    const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const arr = lineas.map((l) => l.split(/\t|;|,/).map((x) => x.trim()));
    procesarDesdeArray(arr);
  };

  const procesarArchivo = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "binary" });
        const hoja = wb.Sheets[wb.SheetNames[0]];
        const arr = XLSX.utils.sheet_to_json(hoja, { header: 1 });
        procesarDesdeArray(arr);
      } catch (err) {
        alert("No se pudo leer el archivo.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const columnasIncluidas = encabezados.filter((h) => h !== colNombre && config[h]?.incluir);

  if (categorias.length === 0) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 max-w-sm text-center shadow-xl">
          <p className="text-sm text-slate-700 mb-3">Primero crea al menos una categoría de evaluación.</p>
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg bg-violet-500 text-white">Entendido</button>
        </div>
      </div>
    );
  }

  const marcarTodasComo = (periodoElegido) => {
    setConfig((prev) => {
      const nuevo = { ...prev };
      columnasIncluidas.forEach((h) => { nuevo[h] = { ...nuevo[h], periodo: periodoElegido }; });
      return nuevo;
    });
  };

  const importar = async () => {
    if (columnasIncluidas.length === 0) { alert("Selecciona al menos una columna de notas."); return; }
    setImportando(true);
    const encontrados = new Set();
    const noEncontrados = new Set();
    try {
      const actividadPorColumna = {};
      for (const col of columnasIncluidas) {
        setProgresoTexto(`Creando actividad "${col}"…`);
        const cfg = config[col];
        const act = await api.crearActividad({
          nombre: col, categoria_id: cfg.categoriaId, materia_id: materiaId, grado_id: gradoId,
          periodo: cfg.periodo, es_automatica: false,
        });
        actividadPorColumna[col] = act.id;
      }
      let i = 0;
      for (const fila of filas) {
        i++;
        setProgresoTexto(`Importando notas… (${i} / ${filas.length})`);
        const nombreMoodle = fila[colNombre];
        if (!nombreMoodle) continue;
        const estudiante = buscarEstudiantePorNombre(String(nombreMoodle), estudiantes);
        if (!estudiante) { noEncontrados.add(String(nombreMoodle)); continue; }
        encontrados.add(estudiante.id);
        for (const col of columnasIncluidas) {
          const valorCrudo = fila[col];
          const valor = parseFloat(String(valorCrudo).replace(",", "."));
          if (isNaN(valor)) continue;
          await api.setValor(actividadPorColumna[col], estudiante.id, valor);
        }
      }
      setResultado({ importados: encontrados.size, columnas: columnasIncluidas.length, noEncontrados: Array.from(noEncontrados) });
    } catch (e) {
      alert("Error al importar: " + e.message);
    }
    setImportando(false);
    setProgresoTexto("");
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">Importar notas de Moodle / Excel</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        {resultado ? (
          <div>
            <p className="text-sm text-emerald-600 mb-2">
              ✔️ Se importaron {resultado.columnas} actividad{resultado.columnas === 1 ? "" : "es"} con notas para {resultado.importados} estudiante{resultado.importados === 1 ? "" : "s"}.
            </p>
            {resultado.noEncontrados.length > 0 && (
              <div className="bg-amber-50 rounded-lg p-3 mb-3">
                <p className="text-xs text-amber-700 font-semibold mb-1">No se encontraron en el grado (verifica el nombre o agrégalos manualmente):</p>
                <ul className="text-xs text-amber-700 list-disc list-inside">
                  {resultado.noEncontrados.map((n) => <li key={n}>{n}</li>)}
                </ul>
              </div>
            )}
            <button onClick={() => { onImportado(); onClose(); }} className="w-full text-sm font-semibold py-2 rounded-lg bg-violet-500 text-white">Listo</button>
          </div>
        ) : paso === 1 ? (
          <div>
            <p className="text-xs text-slate-500 mb-3">
              Puedes pegar o subir <b>un archivo grande con notas de varios periodos a la vez</b> (por ejemplo, columnas del Trimestre I y del Trimestre II juntas) — en el siguiente paso eliges a qué periodo va cada columna.
            </p>
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1.5">Opción 1 — Pegar tabla (incluye encabezados en la primera fila)</div>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6}
              placeholder={"Nombre\tTaller1_T1\tQuiz1_T1\tTaller1_T2\nJuan Pérez García\t4.5\t3.8\t4.0\nMaría Gómez\t5.0\t4.2\t4.8"}
              className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none font-mono" />
            <button onClick={procesarPegado} className="w-full text-sm font-semibold py-2 rounded-lg bg-violet-500 text-white mb-4">Continuar</button>
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1.5">Opción 2 — Subir archivo exportado de Moodle (.xlsx / .csv)</div>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { if (e.target.files[0]) procesarArchivo(e.target.files[0]); }} className="text-sm" />
            <p className="text-xs text-slate-400 mt-3">La primera fila debe tener los nombres de las columnas (Nombre, y una por cada actividad/calificación).</p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-slate-600 mb-3">Se encontraron {filas.length} filas con {encabezados.length} columnas.</p>
            <div className="mb-3">
              <label className="text-xs text-slate-500 block mb-1">¿Cuál columna tiene el nombre del estudiante?</label>
              <select value={colNombre} onChange={(e) => setColNombre(e.target.value)} className="w-full text-sm rounded-lg px-2 py-2 border border-slate-200 outline-none">
                {encabezados.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs text-slate-500">Marcar todas las columnas incluidas como periodo:</span>
              {periodos.map((p) => (
                <button key={p} onClick={() => marcarTodasComo(p)} className="text-xs px-2.5 py-1 rounded-full bg-violet-50 text-violet-600">Periodo {p}</button>
              ))}
            </div>

            <div className="border border-slate-100 rounded-xl overflow-hidden mb-3">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-3 py-2">Incluir</th>
                    <th className="text-left px-3 py-2">Columna</th>
                    <th className="text-left px-3 py-2">Categoría</th>
                    <th className="text-left px-3 py-2">Periodo</th>
                  </tr>
                </thead>
                <tbody>
                  {encabezados.filter((h) => h !== colNombre).map((h) => (
                    <tr key={h} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={!!config[h]?.incluir}
                          onChange={(e) => setConfig((prev) => ({ ...prev, [h]: { ...prev[h], incluir: e.target.checked } }))} />
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-700">{h}</td>
                      <td className="px-3 py-2">
                        <select value={config[h]?.categoriaId || ""} disabled={!config[h]?.incluir}
                          onChange={(e) => setConfig((prev) => ({ ...prev, [h]: { ...prev[h], categoriaId: parseInt(e.target.value, 10) } }))}
                          className="text-xs rounded-lg px-2 py-1 border border-slate-200 outline-none disabled:opacity-40">
                          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select value={config[h]?.periodo || ""} disabled={!config[h]?.incluir}
                          onChange={(e) => setConfig((prev) => ({ ...prev, [h]: { ...prev[h], periodo: e.target.value } }))}
                          className="text-xs rounded-lg px-2 py-1 border border-slate-200 outline-none disabled:opacity-40">
                          {periodos.map((p) => <option key={p} value={p}>Periodo {p}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {importando && <p className="text-xs text-violet-600 mb-2">{progresoTexto}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={() => setPaso(1)} className="text-xs text-slate-500 px-3 py-2">← Volver</button>
              <button disabled={importando} onClick={importar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
                {importando ? "Importando…" : `Importar ${columnasIncluidas.length} columna(s)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NotaMasivaModal({ actividades, estudiantesVisibles, reinoFiltro, onClose, onAplicado }) {
  const manuales = actividades.filter((a) => !a.es_automatica);
  const [actividadId, setActividadId] = useState(manuales[0]?.id || "");
  const [valor, setValor] = useState("");
  const [aplicando, setAplicando] = useState(false);

  if (manuales.length === 0) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 max-w-sm text-center shadow-xl">
          <p className="text-sm text-slate-700 mb-3">No hay actividades manuales en este periodo todavía (las automáticas se calculan solas, no se pueden fijar).</p>
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg bg-violet-500 text-white">Entendido</button>
        </div>
      </div>
    );
  }

  const aplicar = async () => {
    const v = parseFloat(String(valor).replace(",", "."));
    if (isNaN(v)) { alert("Escribe una nota válida."); return; }
    setAplicando(true);
    try {
      for (const s of estudiantesVisibles) { await api.setValor(actividadId, s.id, v); }
      onAplicado(actividadId, estudiantesVisibles.map((s) => s.id), v);
      onClose();
    } catch (e) {
      alert("Error al aplicar: " + e.message);
    }
    setAplicando(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">Aplicar nota masiva</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Se aplicará a los <b>{estudiantesVisibles.length}</b> estudiantes visibles ({reinoFiltro === "Todos" ? "todo el grado" : reinoFiltro}).
        </p>
        <label className="text-xs text-slate-500 block mb-1">Actividad</label>
        <select value={actividadId} onChange={(e) => setActividadId(parseInt(e.target.value, 10))} className="w-full text-sm rounded-lg px-2 py-2 mb-3 border border-slate-200 outline-none">
          {manuales.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        <label className="text-xs text-slate-500 block mb-1">Nota para todos</label>
        <input type="number" step="0.1" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ej: 4.5"
          className="w-full text-sm rounded-lg px-3 py-2 mb-4 border border-slate-200 outline-none" />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
          <button disabled={aplicando} onClick={aplicar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
            {aplicando ? "Aplicando…" : "Aplicar a todos"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Planilla({ materiaId, config, categorias, estudiantes, gradoId, periodo, onCambioCategorias }) {
  const [actividades, setActividades] = useState([]);
  const [valores, setValores] = useState({});
  const [xpMapa, setXpMapa] = useState({});
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [actividadEditar, setActividadEditar] = useState(null);
  const [importarMoodleAbierto, setImportarMoodleAbierto] = useState(false);
  const [notaMasivaAbierta, setNotaMasivaAbierta] = useState(false);
  const [reinoFiltro, setReinoFiltro] = useState("Todos");

  const cargar = async () => {
    setCargando(true);
    const acts = await api.fetchActividades(materiaId, gradoId, periodo);
    setActividades(acts);
    const valoresRows = await api.fetchValores(acts.map((a) => a.id));
    const valMap = {};
    valoresRows.forEach((v) => { valMap[v.actividad_id] = valMap[v.actividad_id] || {}; valMap[v.actividad_id][v.estudiante_id] = v.valor; });
    setValores(valMap);
    const categoriasGam = [...new Set(acts.filter((a) => a.es_automatica).map((a) => a.gam_categoria))];
    if (categoriasGam.length > 0) {
      const xp = await api.fetchXpPorCategoria(estudiantes.map((s) => s.id), categoriasGam);
      setXpMapa(xp);
    } else {
      setXpMapa({});
    }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, [materiaId, gradoId, periodo, estudiantes.length]);
  useEffect(() => { setReinoFiltro("Todos"); }, [gradoId]);

  const reinos = useMemo(() => {
    const set = new Set(estudiantes.map((s) => s.reino_actual || s.reino_original || "Sin grupo"));
    return ["Todos", ...Array.from(set)];
  }, [estudiantes]);

  const estudiantesVisibles = estudiantes.filter((s) => reinoFiltro === "Todos" || (s.reino_actual || s.reino_original) === reinoFiltro);

  const valorDeActividad = (actividad, estudianteId) => {
    if (actividad.es_automatica) {
      const xp = xpMapa[estudianteId]?.[actividad.gam_categoria] || 0;
      return notaAutomatica(xp, actividad.xp_meta, config);
    }
    return valores[actividad.id]?.[estudianteId] ?? null;
  };

  const guardarValorManual = async (actividadId, estudianteId, valorTexto) => {
    const v = valorTexto === "" ? null : Math.max(config.escala_min, Math.min(config.nota_maxima, parseFloat(valorTexto)));
    await api.setValor(actividadId, estudianteId, v);
    setValores((prev) => ({ ...prev, [actividadId]: { ...(prev[actividadId] || {}), [estudianteId]: v } }));
  };

  const aplicarNotaMasiva = (actividadId, estudianteIds, valor) => {
    setValores((prev) => {
      const nuevo = { ...(prev[actividadId] || {}) };
      estudianteIds.forEach((id) => { nuevo[id] = valor; });
      return { ...prev, [actividadId]: nuevo };
    });
  };

  const notaFinal = (estudianteId) => {
    const porCategoria = {};
    actividades.forEach((a) => {
      const v = valorDeActividad(a, estudianteId);
      if (v === null || v === undefined) return;
      porCategoria[a.categoria_id] = porCategoria[a.categoria_id] || [];
      porCategoria[a.categoria_id].push(v);
    });
    return notaFinalPonderada(porCategoria, categorias);
  };

  const eliminarAct = async (id) => { if (!confirm("¿Eliminar esta actividad?")) return; await api.eliminarActividad(id); cargar(); };

  return (
    <div>
      <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
        <select value={reinoFiltro} onChange={(e) => setReinoFiltro(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {reinos.map((r) => <option key={r} value={r}>{r === "Todos" ? "Todos los grupos" : r}</option>)}
        </select>
        <div className="text-sm text-slate-500">{actividades.length} actividad{actividades.length === 1 ? "" : "es"} · {estudiantesVisibles.length} estudiante{estudiantesVisibles.length === 1 ? "" : "s"}</div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setNotaMasivaAbierta(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">🖊 Nota masiva</button>
          <button onClick={() => setImportarMoodleAbierto(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-100 text-violet-700">📥 Importar de Moodle/Excel</button>
          <button onClick={() => { setActividadEditar(null); setModalAbierto(true); }} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">+ Nueva actividad</button>
        </div>
      </div>
      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
          <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th className="sticky left-0 bg-slate-50 text-left px-3 py-2 border-b border-slate-100">Estudiante</th>
                {actividades.map((a) => (
                  <th key={a.id} className="px-3 py-2 border-b border-slate-100 bg-slate-50 min-w-[110px]">
                    <div className="flex items-center justify-center gap-1">
                      {a.es_automatica && <span title="Automática">⚡</span>}
                      <span>{a.nombre}</span>
                      <button onClick={() => { setActividadEditar(a); setModalAbierto(true); }} className="text-slate-400">✎</button>
                      <button onClick={() => eliminarAct(a.id)} className="text-slate-400">✕</button>
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2 border-b border-slate-100 bg-slate-50">Nota Final</th>
              </tr>
            </thead>
            <tbody>
              {estudiantesVisibles.map((s) => {
                const final = notaFinal(s.id);
                const banda = bandaDesempeno(final, config);
                return (
                  <tr key={s.id} className="odd:bg-white even:bg-slate-50">
                    <td className="sticky left-0 bg-inherit text-left px-3 py-2 font-medium text-slate-700">{s.nombre}</td>
                    {actividades.map((a) => {
                      const v = valorDeActividad(a, s.id);
                      const b = bandaDesempeno(v, config);
                      if (a.es_automatica) {
                        return <td key={a.id} className="text-center px-3 py-2" style={{ color: b.color, fontWeight: 600 }}>{v}</td>;
                      }
                      return (
                        <td key={a.id} className="text-center px-3 py-2">
                          <input type="number" step="0.1" defaultValue={v ?? ""} onBlur={(e) => guardarValorManual(a.id, s.id, e.target.value)}
                            style={v !== null && v !== undefined ? { color: b.color, borderColor: b.color, background: `${b.color}11`, fontWeight: 700 } : {}}
                            className="w-14 text-center text-xs rounded px-1 py-1 border border-slate-200 outline-none" />
                        </td>
                      );
                    })}
                    <td className="text-center px-3 py-2 font-bold" style={{ color: banda.color }}>{final ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {modalAbierto && (
        <ActividadModal materiaId={materiaId} gradoId={gradoId} periodo={periodo} categorias={categorias} editar={actividadEditar}
          onClose={() => setModalAbierto(false)} onGuardada={() => { setModalAbierto(false); cargar(); }} />
      )}
      {importarMoodleAbierto && (
        <ImportarMoodleModal materiaId={materiaId} gradoId={gradoId} periodo={periodo} categorias={categorias} periodos={periodosDe(config)} estudiantes={estudiantes}
          onClose={() => setImportarMoodleAbierto(false)} onImportado={cargar} />
      )}
      {notaMasivaAbierta && (
        <NotaMasivaModal actividades={actividades} estudiantesVisibles={estudiantesVisibles} reinoFiltro={reinoFiltro}
          onClose={() => setNotaMasivaAbierta(false)} onAplicado={aplicarNotaMasiva} />
      )}
    </div>
  );
}

function Boletin({ materiaId, config, categorias, estudiantes, gradoId, guardarActual }) {
  const periodos = periodosDe(config);
  const [finales, setFinales] = useState([]);
  const [nivelacion, setNivelacion] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [actaEstudiante, setActaEstudiante] = useState(null);

  const cargar = async () => {
    setCargando(true);
    const [f, n] = await Promise.all([api.fetchNotasFinales(materiaId), api.fetchNivelacion(materiaId)]);
    setFinales(f); setNivelacion(n);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, [materiaId]);

  const notaGuardada = (estudianteId, periodo) => finales.find((f) => f.estudiante_id === estudianteId && f.periodo === periodo)?.nota ?? null;
  const estadoNiv = (estudianteId, periodo) => nivelacion.find((n) => n.estudiante_id === estudianteId && n.periodo === periodo)?.estado || "";

  const cambiarNivelacion = async (estudianteId, periodo, estado) => {
    await api.setNivelacion(materiaId, estudianteId, periodo, estado || null);
    await api.sincronizarEstadoActaNivelacion(estudianteId, materiaId, periodo, estado);
    cargar();
  };

  const promedioAnual = (estudianteId) => {
    const notas = periodos.map((p) => notaGuardada(estudianteId, p)).filter((n) => n !== null);
    if (notas.length === 0) return null;
    return Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10;
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={async () => { await guardarActual(); cargar(); }} className="text-xs font-semibold px-4 py-2 rounded-full bg-violet-500 text-white">
          💾 Guardar notas finales del periodo actual
        </button>
      </div>
      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
          <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th className="text-left px-3 py-2 border-b border-slate-100 bg-slate-50">Estudiante</th>
                {periodos.map((p) => <th key={p} className="px-3 py-2 border-b border-slate-100 bg-slate-50">Periodo {p}</th>)}
                <th className="px-3 py-2 border-b border-slate-100 bg-slate-50">Promedio</th>
              </tr>
            </thead>
            <tbody>
              {estudiantes.map((s, i) => {
                const prom = promedioAnual(s.id);
                const bandaProm = bandaDesempeno(prom, config);
                return (
                  <tr key={s.id} className="odd:bg-white even:bg-slate-50">
                    <td className="text-left px-3 py-2 font-medium text-slate-700">{s.nombre}</td>
                    {periodos.map((p) => {
                      const n = notaGuardada(s.id, p);
                      const b = bandaDesempeno(n, config);
                      const necesitaNiv = n !== null && n < config.nota_minima;
                      return (
                        <td key={p} className="text-center px-3 py-2">
                          <div style={{ color: n !== null ? b.color : "#94A3B8", fontWeight: n !== null ? 700 : 400 }}>{n ?? "—"}</div>
                          {necesitaNiv && (
                            <div className="flex items-center gap-1 mt-1">
                              <select value={estadoNiv(s.id, p)} onChange={(e) => cambiarNivelacion(s.id, p, e.target.value)} className="text-[10px] rounded px-1 py-0.5 border border-slate-200">
                                <option value="">Sin marcar</option>
                                <option value="pendiente">Pendiente</option>
                                <option value="en_proceso">En proceso</option>
                                <option value="superado">Superado</option>
                              </select>
                              <button onClick={() => setActaEstudiante(s)} title="Ver / editar acta de nivelación" className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">📋</button>
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-center px-3 py-2 font-bold" style={{ color: bandaProm.color }}>{prom ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {actaEstudiante && <ActasModal estudiante={actaEstudiante} onClose={() => setActaEstudiante(null)} />}
    </div>
  );
}

function Estadisticas({ materiaId, config, categorias, estudiantes, gradoId, periodo }) {
  const [notas, setNotas] = useState({});
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!materiaId || !gradoId || estudiantes.length === 0) { setCargando(false); return; }
    setCargando(true);
    api.calcularNotasFinalesPeriodo(materiaId, gradoId, periodo, estudiantes, categorias, config).then((n) => { setNotas(n); setCargando(false); });
  }, [materiaId, gradoId, periodo, estudiantes.length, categorias.length]);

  const valores = estudiantes.map((s) => notas[s.id]).filter((n) => n !== null && n !== undefined);
  const stats = calcularEstadisticas(valores);

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;

  return (
    <div>
      <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))" }}>
        {[["Promedio", stats.media], ["Desv. estándar", stats.desviacion], ["Mediana", stats.mediana], ["Mínimo", stats.min], ["Máximo", stats.max]].map(([label, val]) => (
          <div key={label} className="bg-white rounded-xl p-3 text-center shadow-sm border border-slate-100">
            <div className="text-xl font-bold text-violet-600">{val ?? "—"}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400 mt-1">{label}</div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="text-sm font-semibold text-slate-700 mb-3">Notas por estudiante — Periodo {periodo}</div>
        {estudiantes.length === 0 ? (
          <div className="text-sm text-slate-400">No hay estudiantes en este grado.</div>
        ) : (
          <div className="space-y-2">
            {estudiantes.map((s) => {
              const n = notas[s.id];
              const banda = bandaDesempeno(n, config);
              const pct = n !== null && n !== undefined ? Math.max(2, Math.min(100, (n / config.nota_maxima) * 100)) : 0;
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <div className="w-36 text-xs text-slate-600 truncate shrink-0">{s.nombre}</div>
                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: banda.color }} />
                  </div>
                  <div className="w-10 text-xs text-right font-bold shrink-0" style={{ color: banda.color }}>{n ?? "—"}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function VistaCalificaciones({ grados }) {
  const [materias, setMaterias] = useState([]);
  const [materiaActualId, setMateriaActualId] = useState(null);
  const [config, setConfig] = useState(CONFIG_DEFAULT);
  const [categorias, setCategorias] = useState([]);
  const [gradoId, setGradoId] = useState(grados[0]?.id || "");
  const [periodo, setPeriodo] = useState("1");
  const [subVista, setSubVista] = useState("planilla");
  const [estudiantes, setEstudiantes] = useState([]);
  const [cargando, setCargando] = useState(true);

  const cargarMaterias = async () => {
    const m = await api.fetchMaterias();
    setMaterias(m);
    if (!materiaActualId && m.length > 0) setMateriaActualId(m[0].id);
    return m;
  };

  useEffect(() => { cargarMaterias().then(() => setCargando(false)); }, []);
  useEffect(() => { if (grados.length && !gradoId) setGradoId(grados[0].id); }, [grados]);

  const cargarConfigYCategorias = async () => {
    if (!materiaActualId) return;
    const [cfg, cats] = await Promise.all([api.fetchNotasConfig(materiaActualId), api.fetchCategorias(materiaActualId)]);
    setConfig(cfg);
    setCategorias(cats);
  };
  useEffect(() => { cargarConfigYCategorias(); }, [materiaActualId]);

  useEffect(() => {
    if (!gradoId) return;
    api.fetchEstudiantesPorGrado(gradoId).then(setEstudiantes);
  }, [gradoId]);

  const guardarNotasFinalesActual = async () => {
    const notas = await api.calcularNotasFinalesPeriodo(materiaActualId, gradoId, periodo, estudiantes, categorias, config);
    const materiaActual = materias.find((m) => m.id === materiaActualId);
    for (const s of estudiantes) {
      const final = notas[s.id];
      if (final !== null && final !== undefined) {
        await api.guardarNotaFinal(materiaActualId, s.id, periodo, final);
        await api.crearActaNivelacionSiReprobado(materiaActualId, materiaActual?.nombre || "la materia", s.id, periodo, final, config);
      }
    }
    alert("Notas finales del periodo guardadas en el boletín.");
  };

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">Planilla de Notas</h2>
      <p className="text-xs text-violet-600 mb-3">Esta planilla es privada de tu cuenta — otros docentes que usen este enlace no ven ni afectan tus calificaciones.</p>

      <BarraMateria materias={materias} materiaActualId={materiaActualId} setMateriaActualId={setMateriaActualId} onCambio={cargarMaterias} />

      {!materiaActualId ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">
          Crea tu primera materia (ej: "Ética" o "Religión") para empezar a calificar.
        </div>
      ) : (
        <>
          <PanelCategorias materiaId={materiaActualId} categorias={categorias} onCambio={cargarConfigYCategorias} />

          <div className="flex flex-wrap gap-2 mb-4 items-center">
            <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
              {grados.map((g) => <option key={g.id} value={g.id}>Grado {g.id}</option>)}
            </select>
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
              {periodosDe(config).map((p) => <option key={p} value={p}>Periodo {p}</option>)}
            </select>
            <div className="flex gap-1 rounded-full bg-violet-50 p-1">
              <button onClick={() => setSubVista("planilla")} className={`text-xs px-3 py-1.5 rounded-full ${subVista === "planilla" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Planilla</button>
              <button onClick={() => setSubVista("boletin")} className={`text-xs px-3 py-1.5 rounded-full ${subVista === "boletin" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Boletín / Nivelación</button>
              <button onClick={() => setSubVista("estadisticas")} className={`text-xs px-3 py-1.5 rounded-full ${subVista === "estadisticas" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Estadísticas</button>
              <button onClick={() => setSubVista("config")} className={`text-xs px-3 py-1.5 rounded-full ${subVista === "config" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Escala y periodos</button>
            </div>
          </div>

          {subVista === "planilla" && (
            <Planilla materiaId={materiaActualId} config={config} categorias={categorias} estudiantes={estudiantes} gradoId={gradoId} periodo={periodo} onCambioCategorias={cargarConfigYCategorias} />
          )}
          {subVista === "boletin" && (
            <Boletin materiaId={materiaActualId} config={config} categorias={categorias} estudiantes={estudiantes} gradoId={gradoId} guardarActual={guardarNotasFinalesActual} />
          )}
          {subVista === "estadisticas" && (
            <Estadisticas materiaId={materiaActualId} config={config} categorias={categorias} estudiantes={estudiantes} gradoId={gradoId} periodo={periodo} />
          )}
          {subVista === "config" && (
            <ConfigEscala materiaId={materiaActualId} config={config} onGuardado={cargarConfigYCategorias} />
          )}
        </>
      )}
    </div>
  );
}

function ConfigEscala({ materiaId, config, onGuardado }) {
  const [notaMinima, setNotaMinima] = useState(config.nota_minima);
  const [notaMaxima, setNotaMaxima] = useState(config.nota_maxima);
  const [escalaMin, setEscalaMin] = useState(config.escala_min);
  const [sistemaPeriodos, setSistemaPeriodos] = useState(config.sistema_periodos);
  const [cantidadPeriodos, setCantidadPeriodos] = useState(config.cantidad_periodos);

  const guardar = async () => {
    await api.guardarNotasConfig(materiaId, {
      escala_min: escalaMin, nota_minima: notaMinima, nota_maxima: notaMaxima,
      sistema_periodos: sistemaPeriodos, cantidad_periodos: cantidadPeriodos,
    });
    onGuardado();
    alert("Configuración guardada.");
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 max-w-md">
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Escala mínima</label>
          <input type="number" step="0.1" value={escalaMin} onChange={(e) => setEscalaMin(parseFloat(e.target.value))} className="w-full text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Nota mínima aprobatoria</label>
          <input type="number" step="0.1" value={notaMinima} onChange={(e) => setNotaMinima(parseFloat(e.target.value))} className="w-full text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Nota máxima</label>
          <input type="number" step="0.1" value={notaMaxima} onChange={(e) => setNotaMaxima(parseFloat(e.target.value))} className="w-full text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
        </div>
      </div>
      <div className="mb-3">
        <label className="text-xs text-slate-500 block mb-1">Sistema de periodos</label>
        <select value={sistemaPeriodos} onChange={(e) => {
          const val = e.target.value; setSistemaPeriodos(val);
          setCantidadPeriodos(val === "bimestre" ? 4 : val === "trimestre" ? 3 : val === "semestre" ? 2 : cantidadPeriodos);
        }} className="w-full text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none">
          <option value="bimestre">Bimestres (4)</option>
          <option value="trimestre">Trimestres (3)</option>
          <option value="semestre">Semestres (2)</option>
          <option value="personalizado">Personalizado</option>
        </select>
      </div>
      {sistemaPeriodos === "personalizado" && (
        <div className="mb-3">
          <label className="text-xs text-slate-500 block mb-1">Cantidad de periodos</label>
          <input type="number" value={cantidadPeriodos} onChange={(e) => setCantidadPeriodos(parseInt(e.target.value || "1", 10))} className="w-full text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
        </div>
      )}
      <button onClick={guardar} className="w-full text-sm font-semibold py-2 rounded-lg bg-violet-500 text-white">Guardar configuración</button>
    </div>
  );
}
