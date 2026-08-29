import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import * as api from "../lib/api";
import {
  CONFIG_DEFAULT, periodosDe, bandaDesempeno, notaAutomatica, notaFinalPonderada,
  calcularEstadisticas, GAM_CATEGORIAS_OPCIONES,
} from "../lib/calificaciones";
import { buscarEstudiantePorNombre, agruparPorNivel, nivelYCurso, initials } from "../lib/gamification";
import { ActasModal } from "./Actas";
import { InclusionBadge, FotoLightbox } from "./Estudiantes";
import { EditorTexto, TextoEnriquecido, textoPlano } from "../components/RichText";

function MiniAvatarCal({ estudiante, size = 22 }) {
  const [ampliada, setAmpliada] = useState(false);
  if (estudiante.foto_url) {
    return (
      <>
        <img src={estudiante.foto_url} alt={estudiante.nombre} onClick={() => setAmpliada(true)}
          className="rounded-full object-cover shrink-0 inline-block align-middle mr-1.5 cursor-pointer" style={{ width: size, height: size }} />
        {ampliada && <FotoLightbox url={estudiante.foto_url} nombre={estudiante.nombre} onClose={() => setAmpliada(false)} />}
      </>
    );
  }
  return (
    <div className="rounded-full flex items-center justify-center font-bold shrink-0 bg-violet-100 text-violet-600 inline-flex align-middle mr-1.5"
      style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initials(estudiante.nombre)}
    </div>
  );
}

function BarraMateria({ materias, materiaActualId, setMateriaActualId, onCambio }) {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [duplicando, setDuplicando] = useState(false);
  const [copiando, setCopiando] = useState(false);
  const [copiarDesdeId, setCopiarDesdeId] = useState("");
  const [renombrando, setRenombrando] = useState(false);
  const [nombreRenombrar, setNombreRenombrar] = useState("");
  const [menuAbierto, setMenuAbierto] = useState(false);

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
    setCopiando(false);
    onCambio();
  };

  const renombrar = async () => {
    if (!nombreRenombrar.trim()) return;
    await api.renombrarMateria(materiaActualId, nombreRenombrar.trim());
    setRenombrando(false);
    onCambio();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3 mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-slate-400 shrink-0">Materia:</span>
        {materias.length > 0 && !renombrando && (
          <select value={materiaActualId || ""} onChange={(e) => setMateriaActualId(parseInt(e.target.value, 10))} className="text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none">
            {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        )}

        {renombrando && (
          <div className="flex gap-1">
            <input value={nombreRenombrar} onChange={(e) => setNombreRenombrar(e.target.value)} placeholder="Nuevo nombre" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") renombrar(); if (e.key === "Escape") setRenombrando(false); }}
              className="text-xs rounded-lg px-2 py-1.5 border border-violet-300 outline-none" />
            <button onClick={renombrar} className="text-xs px-2 py-1.5 rounded-lg bg-violet-500 text-white">Guardar</button>
            <button onClick={() => setRenombrando(false)} className="text-xs px-2 py-1.5 text-slate-400">✕</button>
          </div>
        )}

        {!creando ? (
          <button onClick={() => setCreando(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-100 text-violet-700 shrink-0">+ Nueva materia</button>
        ) : (
          <div className="flex gap-1">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej: Ética)" autoFocus className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
            <button onClick={crear} className="text-xs px-2 py-1.5 rounded-lg bg-violet-500 text-white">Crear</button>
            <button onClick={() => setCreando(false)} className="text-xs px-2 py-1.5 text-slate-400">✕</button>
          </div>
        )}

        {materiaActualId && !renombrando && (
          <div className="relative ml-auto shrink-0">
            <button onClick={() => setMenuAbierto((v) => !v)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">⋯ Más</button>
            {menuAbierto && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuAbierto(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-100 py-1 w-56 z-20">
                  <button onClick={() => { setMenuAbierto(false); const actual = materias.find((m) => m.id === materiaActualId); setNombreRenombrar(actual?.nombre || ""); setRenombrando(true); }}
                    className="w-full text-left text-xs px-3 py-2 hover:bg-slate-50">✏️ Renombrar materia</button>
                  <button onClick={() => { setMenuAbierto(false); setDuplicando(true); }} className="w-full text-left text-xs px-3 py-2 hover:bg-slate-50">⧉ Duplicar como nueva</button>
                  {materias.length > 1 && (
                    <button onClick={() => { setMenuAbierto(false); setCopiando(true); }} className="w-full text-left text-xs px-3 py-2 hover:bg-slate-50">⇥ Copiar notas desde otra materia</button>
                  )}
                  <div className="border-t border-slate-100 my-1" />
                  <button onClick={() => { setMenuAbierto(false); eliminar(); }} className="w-full text-left text-xs px-3 py-2 hover:bg-rose-50 text-rose-500">🗑 Eliminar esta materia</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {duplicando && (
        <div className="flex gap-1.5 items-center mt-2 pt-2 border-t border-slate-100">
          <span className="text-xs text-slate-400 shrink-0">Nombre de la copia:</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Ética 2026" autoFocus className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none flex-1 min-w-0" />
          <button onClick={duplicar} className="text-xs px-3 py-1.5 rounded-lg bg-violet-500 text-white shrink-0">Duplicar</button>
          <button onClick={() => setDuplicando(false)} className="text-xs px-2 py-1.5 text-slate-400 shrink-0">✕</button>
        </div>
      )}

      {copiando && (
        <div className="flex gap-1.5 items-center mt-2 pt-2 border-t border-slate-100">
          <span className="text-xs text-slate-400 shrink-0">Copiar notas desde:</span>
          <select value={copiarDesdeId} onChange={(e) => setCopiarDesdeId(e.target.value)} className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none flex-1 min-w-0">
            <option value="">Elige…</option>
            {materias.filter((m) => m.id !== materiaActualId).map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
          <button disabled={!copiarDesdeId} onClick={copiar} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white disabled:opacity-40 shrink-0">Copiar con un clic</button>
          <button onClick={() => setCopiando(false)} className="text-xs px-2 py-1.5 text-slate-400 shrink-0">✕</button>
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
  const [fecha, setFecha] = useState(editar?.fecha || "");
  const [descripcion, setDescripcion] = useState(editar?.descripcion || "");
  const [categoriaId, setCategoriaId] = useState(editar?.categoria_id || categorias[0]?.id || "");
  const [tipo, setTipo] = useState(editar?.es_automatica ? "auto" : "manual");
  const [gamCategoria, setGamCategoria] = useState(editar?.gam_categoria || "academico");
  const [xpMeta, setXpMeta] = useState(editar?.xp_meta || 50);

  const guardar = async () => {
    if (!nombre.trim() || !categoriaId) return;
    const campos = {
      nombre: nombre.trim(), fecha: fecha || null, descripcion: descripcion || null,
      categoria_id: categoriaId, materia_id: materiaId, grado_id: gradoId, periodo,
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
        <label className="text-xs text-slate-500 block mb-1">Fecha de trabajo/calificación (opcional)</label>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none" />
        <label className="text-xs text-slate-500 block mb-1">Descripción breve — qué se hizo (opcional)</label>
        <div className="mb-2"><EditorTexto value={descripcion} onChange={setDescripcion} minHeight={70} placeholder="Ej: Taller sobre ecuaciones de primer grado, trabajo en parejas" /></div>
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

  const [procesandoArchivo, setProcesandoArchivo] = useState(false);

  const procesarArchivo = (file) => {
    setProcesandoArchivo(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      // Pequeña pausa para que el navegador alcance a pintar el aviso de "Procesando…"
      // antes del trabajo pesado de leer el Excel (que bloquea la pantalla un instante).
      setTimeout(() => {
        try {
          const wb = XLSX.read(e.target.result, { type: "binary" });
          const hoja = wb.Sheets[wb.SheetNames[0]];
          const arr = XLSX.utils.sheet_to_json(hoja, { header: 1 });
          procesarDesdeArray(arr);
        } catch (err) {
          alert("No se pudo leer el archivo.");
        }
        setProcesandoArchivo(false);
      }, 50);
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

  const marcarIncluirTodas = (valor) => {
    setConfig((prev) => {
      const nuevo = { ...prev };
      encabezados.filter((h) => h !== colNombre).forEach((h) => { nuevo[h] = { ...nuevo[h], incluir: valor }; });
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
            <input type="file" accept=".xlsx,.xls,.csv" disabled={procesandoArchivo} onChange={(e) => { if (e.target.files[0]) procesarArchivo(e.target.files[0]); }} className="text-sm disabled:opacity-40" />
            {procesandoArchivo && <p className="text-xs text-violet-600 mt-2">⏳ Procesando el archivo, un momento (los archivos grandes pueden tardar unos segundos)…</p>}
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
              <span className="text-xs text-slate-500">Casillas de notas:</span>
              <button onClick={() => marcarIncluirTodas(true)} className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">✓ Seleccionar todas</button>
              <button onClick={() => marcarIncluirTodas(false)} className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">✕ Ninguna</button>
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
                    <th className="text-left px-3 py-2">
                      <input type="checkbox"
                        checked={encabezados.filter((h) => h !== colNombre).length > 0 && encabezados.filter((h) => h !== colNombre).every((h) => config[h]?.incluir)}
                        onChange={(e) => marcarIncluirTodas(e.target.checked)} />
                    </th>
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

function NotaMasivaModal({ actividades, estudiantesVisibles, reinoFiltro, valorDeActividad, onClose, onAplicado }) {
  const manuales = actividades.filter((a) => !a.es_automatica);
  const [actividadId, setActividadId] = useState(manuales[0]?.id || "");
  const [valor, setValor] = useState("");
  const [soloVacios, setSoloVacios] = useState(true);
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

  const actividadElegida = actividades.find((a) => a.id === parseInt(actividadId, 10));
  const yaCalificados = actividadElegida ? estudiantesVisibles.filter((s) => {
    const v = valorDeActividad(actividadElegida, s.id);
    return v !== null && v !== undefined;
  }).length : 0;

  const aplicar = async () => {
    const v = parseFloat(String(valor).replace(",", "."));
    if (isNaN(v)) { alert("Escribe una nota válida."); return; }
    setAplicando(true);
    try {
      const destino = soloVacios
        ? estudiantesVisibles.filter((s) => {
            const actual = valorDeActividad(actividadElegida, s.id);
            return actual === null || actual === undefined;
          })
        : estudiantesVisibles;
      for (const s of destino) { await api.setValor(actividadId, s.id, v); }
      onAplicado(actividadId, destino.map((s) => s.id), v);
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
          className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />

        <label className="flex items-start gap-2 text-xs text-slate-600 mb-1 bg-violet-50 rounded-lg p-2">
          <input type="checkbox" checked={soloVacios} onChange={(e) => setSoloVacios(e.target.checked)} className="mt-0.5" />
          <span>Solo rellenar los que están <b>sin nota</b> — no toca a quienes ya tienen una nota puesta en esta actividad.</span>
        </label>
        <p className="text-[11px] text-slate-400 mb-4">
          {soloVacios
            ? `Se aplicará a ${estudiantesVisibles.length - yaCalificados} de ${estudiantesVisibles.length} estudiante(s) — ${yaCalificados} ya tienen nota y se van a respetar.`
            : `⚠️ Se aplicará a los ${estudiantesVisibles.length} estudiantes visibles, incluso reemplazando notas que ya tengan.`}
        </p>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
          <button disabled={aplicando} onClick={aplicar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
            {aplicando ? "Aplicando…" : "Aplicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ObservacionMasivaModal({ actividades, estudiantesVisibles, valorDeActividad, onClose, onAplicado }) {
  const [actividadId, setActividadId] = useState(actividades[0]?.id || "");
  const [notaElegida, setNotaElegida] = useState("");
  const [texto, setTexto] = useState("");
  const [aplicando, setAplicando] = useState(false);

  const actividadElegida = actividades.find((a) => a.id === parseInt(actividadId, 10));

  const gruposPorNota = {};
  if (actividadElegida) {
    estudiantesVisibles.forEach((s) => {
      const v = valorDeActividad(actividadElegida, s.id);
      if (v === null || v === undefined) return;
      const clave = String(v);
      (gruposPorNota[clave] = gruposPorNota[clave] || []).push(s);
    });
  }
  const notasDisponibles = Object.keys(gruposPorNota).sort((a, b) => parseFloat(b) - parseFloat(a));

  const aplicar = async () => {
    if (!notaElegida) { alert("Elegí a qué grupo de nota aplicarlo."); return; }
    if (!texto.trim()) { alert("Escribí la observación."); return; }
    setAplicando(true);
    try {
      const destino = gruposPorNota[notaElegida] || [];
      for (const s of destino) { await api.setObservacionValor(actividadId, s.id, texto.trim()); }
      onAplicado(actividadId, destino.map((s) => s.id), texto.trim());
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
          <h3 className="font-bold text-slate-800">📝 Observación masiva</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">Dejá la misma observación a todos los que ya sacaron la misma nota en una actividad puntual.</p>

        <label className="text-xs text-slate-500 block mb-1">Actividad</label>
        <select value={actividadId} onChange={(e) => { setActividadId(parseInt(e.target.value, 10)); setNotaElegida(""); }} className="w-full text-sm rounded-lg px-2 py-2 mb-3 border border-slate-200 outline-none">
          {actividades.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>

        <label className="text-xs text-slate-500 block mb-1">Grupo de nota</label>
        {notasDisponibles.length === 0 ? (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 mb-3">Todavía no hay ninguna nota puesta en esta actividad.</p>
        ) : (
          <select value={notaElegida} onChange={(e) => setNotaElegida(e.target.value)} className="w-full text-sm rounded-lg px-2 py-2 mb-3 border border-slate-200 outline-none">
            <option value="">Elegí…</option>
            {notasDisponibles.map((n) => <option key={n} value={n}>Nota {n} ({gruposPorNota[n].length} estudiante{gruposPorNota[n].length !== 1 ? "s" : ""})</option>)}
          </select>
        )}

        <label className="text-xs text-slate-500 block mb-1">Observación</label>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} placeholder="Ej: Excelente manejo del tema, sigue así…"
          className="w-full text-sm rounded-lg px-3 py-2 mb-4 border border-slate-200 outline-none" />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
          <button disabled={aplicando || notasDisponibles.length === 0} onClick={aplicar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
            {aplicando ? "Aplicando…" : "Aplicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CopiarPlanillaOtroCursoModal({ materiaId, gradoId, grados, periodo, periodos, onClose, onCopiado }) {
  const niveles = agruparPorNivel(grados);
  const { nivel: nivelActual } = nivelYCurso(gradoId);
  const [nivel, setNivel] = useState(nivelActual);
  const [destinosElegidos, setDestinosElegidos] = useState([]);
  const [periodoOrigen, setPeriodoOrigen] = useState(periodo);
  const [previa, setPrevia] = useState(null);
  const [cargandoPrevia, setCargandoPrevia] = useState(false);
  const [copiando, setCopiando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const cursosDelNivel = (niveles.find((n) => n.nivel === nivel)?.cursos || []).filter((g) => g.id !== gradoId);
  useEffect(() => { setDestinosElegidos([]); setPrevia(null); }, [nivel]);

  const toggleDestino = (id) => {
    setDestinosElegidos((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    setPrevia(null);
  };

  const verPrevia = async () => {
    if (destinosElegidos.length === 0) { alert("Elegí al menos un curso destino."); return; }
    setCargandoPrevia(true);
    const [evaluaciones, tareas, actividades] = await Promise.all([
      api.fetchEvaluaciones(materiaId, gradoId, periodoOrigen),
      api.fetchTareasCalificables(materiaId, gradoId, periodoOrigen),
      api.fetchActividades(materiaId, gradoId, periodoOrigen),
    ]);
    setPrevia({ evaluaciones, tareas, actividades });
    setCargandoPrevia(false);
  };

  const copiar = async () => {
    setCopiando(true);
    try {
      const resultados = [];
      for (const destinoId of destinosElegidos) {
        const r = await api.copiarPlanillaCompleta(materiaId, gradoId, destinoId, periodoOrigen);
        resultados.push({ curso: destinoId, ...r });
      }
      setResultado(resultados);
      onCopiado();
    } catch (e) {
      alert("Error al copiar: " + e.message);
    }
    setCopiando(false);
  };

  const totalPrevia = previa ? previa.evaluaciones.length + previa.tareas.length + previa.actividades.length : 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">📋 Copiar planilla completa a otros cursos</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        {resultado ? (
          <div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3">
              <p className="text-sm font-semibold text-emerald-700">✔ Listo</p>
              {resultado.map((r) => (
                <p key={r.curso} className="text-xs text-emerald-600 mt-1">
                  <b>Curso {r.curso}:</b> {r.evaluacionesCopiadas} Misión(es), {r.tareasCopiadas} Proyecto(s)/Forja, {r.actividadesCopiadas} columna(s) manual(es) — de {r.totalOrigen} en total.
                </p>
              ))}
            </div>
            {resultado.some((r) => r.advertencias.length > 0) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 text-xs text-amber-700">
                <p className="font-semibold mb-1">Algunas no se pudieron copiar:</p>
                {resultado.map((r) => r.advertencias.length > 0 && (
                  <div key={r.curso}><b>Curso {r.curso}:</b><ul className="list-disc list-inside">{r.advertencias.map((a, i) => <li key={i}>{a}</li>)}</ul></div>
                ))}
              </div>
            )}
            <button onClick={onClose} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white">Listo</button>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-3">
              Copia todas las Misiones, Proyectos/Forja y columnas manuales de este curso a uno o varios cursos a la vez — sin fechas de entrega ni notas
              de estudiantes, para que las ajustes antes de usarlas.
            </p>

            <label className="text-xs text-slate-500 block mb-1">Periodo a copiar</label>
            <select value={periodoOrigen} onChange={(e) => { setPeriodoOrigen(e.target.value); setPrevia(null); }} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none">
              {periodos.map((p) => <option key={p} value={p}>Periodo {p}</option>)}
            </select>

            <label className="text-xs text-slate-500 block mb-1">Grado</label>
            <select value={nivel} onChange={(e) => setNivel(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none">
              {niveles.map((n) => <option key={n.nivel} value={n.nivel}>Grado {n.nivel}°</option>)}
            </select>

            <label className="text-xs text-slate-500 block mb-1">Cursos destino (elegí uno o varios)</label>
            {cursosDelNivel.length === 0 ? (
              <p className="text-xs text-slate-400 mb-3">No hay otro curso en este grado.</p>
            ) : (
              <div className="flex flex-wrap gap-2 mb-3">
                {cursosDelNivel.map((g) => (
                  <button key={g.id} onClick={() => toggleDestino(g.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border ${destinosElegidos.includes(g.id) ? "bg-violet-500 text-white border-violet-500" : "bg-white text-slate-600 border-slate-200"}`}>
                    {destinosElegidos.includes(g.id) ? "✓ " : ""}Curso {g.id}
                  </button>
                ))}
              </div>
            )}

            {!previa ? (
              <button disabled={cargandoPrevia || destinosElegidos.length === 0} onClick={verPrevia} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-50">
                {cargandoPrevia ? "Cargando…" : "Ver qué se va a copiar →"}
              </button>
            ) : totalPrevia === 0 ? (
              <p className="text-sm text-slate-400 text-center py-3">Este curso no tiene ninguna columna en el periodo {periodoOrigen} todavía.</p>
            ) : (
              <>
                <div className="bg-slate-50 rounded-xl p-3 mb-3 text-xs text-slate-600 max-h-40 overflow-y-auto">
                  {previa.evaluaciones.length > 0 && <p className="font-semibold mt-1">⚔️ Misiones ({previa.evaluaciones.length})</p>}
                  {previa.evaluaciones.map((e) => <div key={e.id}>· {e.titulo}</div>)}
                  {previa.tareas.length > 0 && <p className="font-semibold mt-1">📜 Proyectos/Forja ({previa.tareas.length})</p>}
                  {previa.tareas.map((t) => <div key={t.id}>· {t.titulo}</div>)}
                  {previa.actividades.length > 0 && <p className="font-semibold mt-1">📝 Columnas manuales ({previa.actividades.length})</p>}
                  {previa.actividades.map((a) => <div key={a.id}>· {a.nombre}</div>)}
                </div>
                <button disabled={copiando} onClick={copiar} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
                  {copiando ? "Copiando…" : `Copiar ${totalPrevia} columna(s) a ${destinosElegidos.length} curso(s)`}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CopiarColumnasModal({ materiaDestinoId, gradoId, periodos, categoriasDestino, materias, estudiantes, onClose, onCopiado }) {
  const [materiaOrigenId, setMateriaOrigenId] = useState("");
  const [periodoOrigen, setPeriodoOrigen] = useState(periodos[0] || "1");
  const [actividadesOrigen, setActividadesOrigen] = useState([]);
  const [actividadesDestino, setActividadesDestino] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState({}); // { actividadId: true }
  const [destinoPorActividad, setDestinoPorActividad] = useState({}); // { actividadId: "nueva" | actividadDestinoId }
  const [categoriaPorActividad, setCategoriaPorActividad] = useState({}); // { actividadId: categoriaDestinoId } (solo si destino = "nueva")
  const [copiando, setCopiando] = useState(false);
  const [alcance, setAlcance] = useState("todos"); // "todos" | "uno"
  const [estudianteId, setEstudianteId] = useState("");

  const materiasOrigenPosibles = materias.filter((m) => m.id !== materiaDestinoId);

  const cargarActividades = async (matId, per) => {
    if (!matId) { setActividadesOrigen([]); return; }
    setCargando(true);
    const [acts, actsDestino] = await Promise.all([
      api.fetchActividades(parseInt(matId, 10), gradoId, per),
      api.fetchActividades(materiaDestinoId, gradoId, per),
    ]);
    setActividadesOrigen(acts);
    setActividadesDestino(actsDestino);
    // Por defecto: si hay una columna en destino con el mismo nombre, se sugiere esa;
    // si no, se sugiere crear una nueva con la primera categoría disponible.
    const mapaDestino = {};
    const mapaCategoria = {};
    acts.forEach((a) => {
      const igual = actsDestino.find((d) => d.nombre === a.nombre);
      mapaDestino[a.id] = igual ? igual.id : "nueva";
      mapaCategoria[a.id] = categoriasDestino[0]?.id || "";
    });
    setDestinoPorActividad(mapaDestino);
    setCategoriaPorActividad(mapaCategoria);
    setSeleccionadas({});
    setCargando(false);
  };

  useEffect(() => { cargarActividades(materiaOrigenId, periodoOrigen); }, [materiaOrigenId, periodoOrigen]);
  useEffect(() => { if (estudiantes.length && !estudianteId) setEstudianteId(estudiantes[0].id); }, [estudiantes]);

  const toggle = (id) => setSeleccionadas((prev) => ({ ...prev, [id]: !prev[id] }));
  const idsSeleccionados = Object.keys(seleccionadas).filter((id) => seleccionadas[id]).map((id) => parseInt(id, 10));

  const copiar = async () => {
    if (idsSeleccionados.length === 0) { alert("Elegí al menos una columna."); return; }
    const sinDefinir = idsSeleccionados.filter((id) => destinoPorActividad[id] === "nueva" && !categoriaPorActividad[id]);
    if (sinDefinir.length > 0) { alert("Elegí una categoría para cada columna nueva que vayas a crear."); return; }
    setCopiando(true);
    try {
      const mapaFinal = {};
      idsSeleccionados.forEach((id) => {
        mapaFinal[id] = destinoPorActividad[id] === "nueva"
          ? { categoriaId: categoriaPorActividad[id] }
          : { actividadDestinoId: destinoPorActividad[id] };
      });
      const n = await api.copiarColumnasEspecificas(idsSeleccionados, materiaDestinoId, gradoId, mapaFinal, alcance === "uno" ? estudianteId : null);
      alert(alcance === "uno"
        ? `Se copió la nota de ${estudiantes.find((s) => s.id === estudianteId)?.nombre || "ese estudiante"} en ${n} columna(s).`
        : `Se copiaron ${n} columna(s) con sus notas.`);
      onCopiado();
      onClose();
    } catch (e) {
      alert("Error al copiar: " + e.message);
    }
    setCopiando(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">📑 Copiar columnas específicas</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Elegí de qué materia y periodo traer columnas puntuales (con sus notas ya cargadas) hacia la materia actual — no reemplaza nada, solo agrega.
        </p>

        {categoriasDestino.length === 0 ? (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-3 mb-3">
            Esta materia todavía no tiene categorías de notas creadas. Cerrá este panel y creá al menos una categoría (arriba, en "Categorías") antes de copiar columnas.
          </p>
        ) : (
          <>
        <div className="mb-3">
          <label className="text-xs text-slate-500 block mb-1">¿A quién aplica esta copia?</label>
          <div className="flex gap-1 mb-2">
            <button onClick={() => setAlcance("todos")} className={`text-xs px-3 py-1.5 rounded-full ${alcance === "todos" ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-600"}`}>Todo el curso</button>
            <button onClick={() => setAlcance("uno")} className={`text-xs px-3 py-1.5 rounded-full ${alcance === "uno" ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-600"}`}>Un solo estudiante</button>
          </div>
          {alcance === "uno" && (
            <select value={estudianteId} onChange={(e) => setEstudianteId(parseInt(e.target.value, 10))} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none">
              {estudiantes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Materia origen</label>
            <select value={materiaOrigenId} onChange={(e) => setMateriaOrigenId(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none">
              <option value="">Elegí…</option>
              {materiasOrigenPosibles.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Periodo origen</label>
            <select value={periodoOrigen} onChange={(e) => setPeriodoOrigen(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none">
              {periodos.map((p) => <option key={p} value={p}>Periodo {p}</option>)}
            </select>
          </div>
        </div>

        {cargando ? (
          <div className="text-sm text-slate-400">Cargando columnas…</div>
        ) : materiaOrigenId && actividadesOrigen.length === 0 ? (
          <div className="text-sm text-slate-400">Esa materia no tiene columnas en ese periodo.</div>
        ) : (
          <div className="space-y-2 mb-4">
            {actividadesOrigen.map((a) => (
              <div key={a.id} className={`border rounded-lg p-2 ${seleccionadas[a.id] ? "border-violet-300 bg-violet-50" : "border-slate-200"}`}>
                <label className="flex items-center gap-2 text-sm text-slate-700 mb-1">
                  <input type="checkbox" checked={!!seleccionadas[a.id]} onChange={() => toggle(a.id)} />
                  {a.es_automatica && <span title="Automática">⚡</span>}
                  {a.nombre}
                </label>
                {seleccionadas[a.id] && (
                  <div className="ml-6 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 shrink-0">Colocar en:</span>
                      <select value={destinoPorActividad[a.id] || "nueva"} onChange={(e) => setDestinoPorActividad((prev) => ({ ...prev, [a.id]: e.target.value === "nueva" ? "nueva" : parseInt(e.target.value, 10) }))}
                        className="text-xs rounded-lg px-2 py-1 border border-slate-200 outline-none flex-1">
                        <option value="nueva">+ Crear columna nueva</option>
                        {actividadesDestino.map((d) => <option key={d.id} value={d.id}>{d.nombre} (columna existente)</option>)}
                      </select>
                    </div>
                    {destinoPorActividad[a.id] === "nueva" && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 shrink-0">Categoría:</span>
                        <select value={categoriaPorActividad[a.id] || ""} onChange={(e) => setCategoriaPorActividad((prev) => ({ ...prev, [a.id]: parseInt(e.target.value, 10) }))}
                          className="text-xs rounded-lg px-2 py-1 border border-slate-200 outline-none">
                          {categoriasDestino.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
          <button disabled={copiando || idsSeleccionados.length === 0} onClick={copiar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-40">
            {copiando ? "Copiando…" : `Copiar ${idsSeleccionados.length || ""} columna(s)`}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

// Colores reconocibles por tipo de categoría de evaluación (coinciden por nombre,
// sin distinguir mayúsculas/acentos); cualquier categoría con otro nombre cae a un
// color de una paleta de repuesto, siempre el mismo para el mismo nombre.
const PALETA_CATEGORIAS = ["#3B82F6", "#8B5CF6", "#F59E0B", "#14B8A6", "#EC4899", "#64748B", "#22C55E", "#F43F5E"];
const COLOR_CATEGORIA_FIJO = {
  cognitivo: "#3B82F6", conceptual: "#3B82F6", saber: "#3B82F6",
  procedimental: "#8B5CF6", propositivo: "#8B5CF6", "saberhacer": "#8B5CF6",
  actitudinal: "#F59E0B", ser: "#F59E0B",
  autoevaluacion: "#14B8A6",
  coevaluacion: "#EC4899",
  heteroevaluacion: "#64748B",
};
function colorCategoria(nombre) {
  const key = (nombre || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
  if (COLOR_CATEGORIA_FIJO[key]) return COLOR_CATEGORIA_FIJO[key];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) % PALETA_CATEGORIAS.length;
  return PALETA_CATEGORIAS[Math.abs(hash) % PALETA_CATEGORIAS.length];
}

function Planilla({ materiaId, config, categorias, estudiantes, gradoId, grados, periodo, materias, onCambioCategorias, estudianteDestacadoId }) {
  const [actividades, setActividades] = useState([]);
  const [valores, setValores] = useState({});
  const [observaciones, setObservaciones] = useState({});
  const [xpMapa, setXpMapa] = useState({});
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [actividadEditar, setActividadEditar] = useState(null);
  const [importarMoodleAbierto, setImportarMoodleAbierto] = useState(false);
  const [notaMasivaAbierta, setNotaMasivaAbierta] = useState(false);
  const [observacionMasivaAbierta, setObservacionMasivaAbierta] = useState(false);
  const [reinoFiltro, setReinoFiltro] = useState("Todos");
  const [soloPerdiendo, setSoloPerdiendo] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionando, setSeleccionando] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [finalesGuardados, setFinalesGuardados] = useState([]);
  const [editandoFinal, setEditandoFinal] = useState(null); // estudianteId
  const [valorFinalTemp, setValorFinalTemp] = useState("");
  const [copiarColumnasAbierto, setCopiarColumnasAbierto] = useState(false);
  const [copiarPlanillaAbierto, setCopiarPlanillaAbierto] = useState(false);
  const [menuHerramientasAbierto, setMenuHerramientasAbierto] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const acts = await api.fetchActividades(materiaId, gradoId, periodo);
    setActividades(acts);
    const valoresRows = await api.fetchValores(acts.map((a) => a.id));
    const valMap = {};
    const obsMap = {};
    valoresRows.forEach((v) => {
      valMap[v.actividad_id] = valMap[v.actividad_id] || {}; valMap[v.actividad_id][v.estudiante_id] = v.valor;
      if (v.observacion) { obsMap[v.actividad_id] = obsMap[v.actividad_id] || {}; obsMap[v.actividad_id][v.estudiante_id] = v.observacion; }
    });
    setValores(valMap);
    setObservaciones(obsMap);
    const categoriasGam = [...new Set(acts.filter((a) => a.es_automatica).map((a) => a.gam_categoria))];
    if (categoriasGam.length > 0) {
      const xp = await api.fetchXpPorCategoria(estudiantes.map((s) => s.id), categoriasGam);
      setXpMapa(xp);
    } else {
      setXpMapa({});
    }
    const finales = await api.fetchNotasFinales(materiaId);
    setFinalesGuardados(finales.filter((f) => f.periodo === periodo));
    setCargando(false);
  };
  useEffect(() => { cargar(); }, [materiaId, gradoId, periodo, estudiantes.length]);
  useEffect(() => { setReinoFiltro("Todos"); }, [gradoId]);
  useEffect(() => { setSeleccionando(false); setSeleccionadas([]); }, [materiaId, periodo]);

  const reinos = useMemo(() => {
    const set = new Set(estudiantes.map((s) => s.reino_actual || s.reino_original || "Sin grupo"));
    return ["Todos", ...Array.from(set)];
  }, [estudiantes]);

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

  const aplicarObservacionMasiva = (actividadId, estudianteIds, texto) => {
    setObservaciones((prev) => {
      const nuevo = { ...(prev[actividadId] || {}) };
      estudianteIds.forEach((id) => { nuevo[id] = texto; });
      return { ...prev, [actividadId]: nuevo };
    });
  };

  // Si el docente ya fijó manualmente la nota final de este periodo, esa manda;
  // si no, se muestra el cálculo automático de siempre (como preview, hasta que se guarde).
  const notaManual = (estudianteId) => finalesGuardados.find((f) => f.estudiante_id === estudianteId)?.nota;

  const notaFinalCalculada = (estudianteId) => {
    const porCategoria = {};
    actividades.forEach((a) => {
      const v = valorDeActividad(a, estudianteId);
      if (v === null || v === undefined) return;
      porCategoria[a.categoria_id] = porCategoria[a.categoria_id] || [];
      porCategoria[a.categoria_id].push(v);
    });
    return notaFinalPonderada(porCategoria, categorias);
  };

  const notaFinal = (estudianteId) => {
    const manual = notaManual(estudianteId);
    return manual !== undefined && manual !== null ? manual : notaFinalCalculada(estudianteId);
  };

  const estudiantesVisiblesPorReino = estudiantes.filter((s) => reinoFiltro === "Todos" || (s.reino_actual || s.reino_original) === reinoFiltro);
  const estudiantesVisiblesPerdiendo = soloPerdiendo
    ? estudiantesVisiblesPorReino.filter((s) => { const n = notaFinal(s.id); return n !== null && n !== undefined && n < config.nota_minima; })
    : estudiantesVisiblesPorReino;
  const estudiantesVisibles = busqueda.trim()
    ? estudiantesVisiblesPerdiendo.filter((s) => s.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))
    : estudiantesVisiblesPerdiendo;

  const esManual = (estudianteId) => {
    const manual = notaManual(estudianteId);
    return manual !== undefined && manual !== null;
  };

  const guardarNotaFinalManual = async (estudianteId) => {
    const valor = valorFinalTemp.trim() === "" ? null : parseFloat(valorFinalTemp.replace(",", "."));
    if (valorFinalTemp.trim() !== "" && (isNaN(valor) || valor < config.escala_min || valor > config.nota_maxima)) {
      alert(`La nota debe estar entre ${config.escala_min} y ${config.nota_maxima}.`);
      return;
    }
    if (valor === null) {
      await api.eliminarNotaFinalPeriodo(materiaId, estudianteId, periodo);
    } else {
      await api.guardarNotaFinal(materiaId, estudianteId, periodo, valor);
    }
    setEditandoFinal(null);
    cargar();
  };

  const quitarNotaManual = async (estudianteId) => {
    if (!confirm("¿Quitar el valor manual y volver a mostrar el cálculo automático/en vivo? (esto no borra las notas de las actividades, solo el valor fijado a mano)")) return;
    await api.eliminarNotaFinalPeriodo(materiaId, estudianteId, periodo);
    cargar();
  };

  const eliminarAct = async (id) => { if (!confirm("¿Eliminar esta actividad?")) return; await api.eliminarActividad(id); cargar(); };

  // Agrupa las actividades por categoría (contiguas, en el orden de las categorías)
  // para poder pintar una franja de color por grupo en el encabezado de la Planilla.
  const gruposCategoria = categorias
    .map((cat) => ({ id: cat.id, nombre: cat.nombre, color: colorCategoria(cat.nombre), items: actividades.filter((a) => a.categoria_id === cat.id) }))
    .filter((g) => g.items.length > 0);
  const idsAgrupados = new Set(gruposCategoria.flatMap((g) => g.items.map((a) => a.id)));
  const sinCategoria = actividades.filter((a) => !idsAgrupados.has(a.id));
  if (sinCategoria.length > 0) gruposCategoria.push({ id: "otras", nombre: "Otras", color: "#94A3B8", items: sinCategoria });
  const actividadesOrdenadas = gruposCategoria.flatMap((g) => g.items);
  const colorPorActividad = {};
  gruposCategoria.forEach((g) => g.items.forEach((a) => { colorPorActividad[a.id] = g.color; }));

  const toggleSeleccion = (id) => {
    setSeleccionadas((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const eliminarSeleccionadas = async () => {
    if (seleccionadas.length === 0) return;
    if (!confirm(`¿Eliminar ${seleccionadas.length} columna${seleccionadas.length === 1 ? "" : "s"} de notas? Esta acción no se puede deshacer.`)) return;
    for (const id of seleccionadas) { await api.eliminarActividad(id); }
    setSeleccionadas([]);
    setSeleccionando(false);
    cargar();
  };

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3 mb-3">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="🔍 Buscar estudiante…"
            className="text-sm rounded-lg px-3 py-1.5 border border-slate-200 outline-none w-48" />
          <select value={reinoFiltro} onChange={(e) => setReinoFiltro(e.target.value)} className="text-sm rounded-lg px-3 py-1.5 border border-slate-200 outline-none">
            {reinos.map((r) => <option key={r} value={r}>{r === "Todos" ? "Todos los grupos" : r}</option>)}
          </select>
          <button onClick={() => setSoloPerdiendo((v) => !v)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${soloPerdiendo ? "bg-rose-500 text-white border-rose-500" : "border-rose-200 text-rose-600"}`}>
            🔴 {soloPerdiendo ? "Viendo solo quienes van perdiendo" : "Ver solo quienes van perdiendo"}
          </button>
          <div className="text-xs text-slate-400 ml-auto">{actividades.length} actividad{actividades.length === 1 ? "" : "es"} · {estudiantesVisibles.length} estudiante{estudiantesVisibles.length === 1 ? "" : "s"}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => { setActividadEditar(null); setModalAbierto(true); }} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">+ Nueva actividad</button>
          <button onClick={() => setNotaMasivaAbierta(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">🖊 Nota masiva</button>
          <button onClick={() => setObservacionMasivaAbierta(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">📝 Observación masiva</button>

          {seleccionando ? (
            <>
              <button onClick={eliminarSeleccionadas} disabled={seleccionadas.length === 0}
                className="text-xs font-semibold px-3 py-1.5 rounded-full bg-rose-500 text-white disabled:opacity-40">
                🗑 Eliminar {seleccionadas.length > 0 ? `(${seleccionadas.length})` : ""}
              </button>
              <button onClick={() => { setSeleccionando(false); setSeleccionadas([]); }} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">Cancelar</button>
            </>
          ) : (
            <div className="relative">
              <button onClick={() => setMenuHerramientasAbierto((v) => !v)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">⋯ Más acciones</button>
              {menuHerramientasAbierto && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuHerramientasAbierto(false)} />
                  <div className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-100 py-1 w-64 z-20">
                    <button onClick={() => { setMenuHerramientasAbierto(false); setCopiarColumnasAbierto(true); }} className="w-full text-left text-xs px-3 py-2 hover:bg-slate-50">📑 Copiar columnas de otra materia</button>
                    <button onClick={() => { setMenuHerramientasAbierto(false); setCopiarPlanillaAbierto(true); }} className="w-full text-left text-xs px-3 py-2 hover:bg-slate-50">📋 Copiar planilla a otro curso</button>
                    <button onClick={() => { setMenuHerramientasAbierto(false); setImportarMoodleAbierto(true); }} className="w-full text-left text-xs px-3 py-2 hover:bg-slate-50">📥 Importar de Moodle/Excel</button>
                    <div className="border-t border-slate-100 my-1" />
                    <button onClick={() => { setMenuHerramientasAbierto(false); setSeleccionando(true); }} className="w-full text-left text-xs px-3 py-2 hover:bg-rose-50 text-rose-500">🗑 Borrar varias columnas</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
          <table className="w-full text-xs" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 bg-slate-50"></th>
                {gruposCategoria.map((g) => (
                  <th key={g.id} colSpan={g.items.length} className="sticky top-0 z-10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
                    style={{ background: g.color }}>
                    {g.nombre}
                  </th>
                ))}
                <th className="sticky top-0 z-10 bg-slate-50"></th>
              </tr>
              <tr>
                <th className="sticky left-0 top-0 z-20 bg-slate-50 text-left px-3 py-2 border-b border-slate-100">Estudiante</th>
                {actividadesOrdenadas.map((a) => (
                  <th key={a.id} className={`sticky top-0 z-10 px-3 py-2 border-b border-slate-100 min-w-[110px] ${seleccionando && seleccionadas.includes(a.id) ? "bg-rose-50" : ""}`}
                    style={!seleccionando ? { background: `${colorPorActividad[a.id]}14` } : {}}>
                    <div className="flex items-center justify-center gap-1" title={[a.fecha, a.descripcion ? textoPlano(a.descripcion) : null].filter(Boolean).join(" — ") || undefined}>
                      {seleccionando && (
                        <input type="checkbox" checked={seleccionadas.includes(a.id)} onChange={() => toggleSeleccion(a.id)} />
                      )}
                      {a.es_automatica && <span title="Automática">⚡</span>}
                      <span>{a.nombre}</span>
                      {a.fecha && <span className="text-[9px] text-slate-400 font-normal">({a.fecha.slice(5)})</span>}
                      {!seleccionando && (
                        <>
                          <button onClick={() => { setActividadEditar(a); setModalAbierto(true); }} className="text-slate-400">✎</button>
                          <button onClick={() => eliminarAct(a.id)} className="text-slate-400">✕</button>
                        </>
                      )}
                    </div>
                  </th>
                ))}
                <th className="sticky top-0 z-10 px-3 py-2 border-b border-slate-100 bg-slate-50">Nota Final</th>
              </tr>
            </thead>
            <tbody>
              {estudiantesVisibles.map((s) => {
                const final = notaFinal(s.id);
                const banda = bandaDesempeno(final, config);
                const destacado = estudianteDestacadoId && s.id === estudianteDestacadoId;
                return (
                  <tr key={s.id} ref={destacado ? (el) => el?.scrollIntoView({ behavior: "smooth", block: "center" }) : null}
                    className={destacado ? "bg-amber-100" : "odd:bg-white even:bg-slate-50"}
                    style={destacado ? { boxShadow: "inset 0 0 0 2px #F59E0B" } : undefined}>
                    <td className="sticky left-0 bg-inherit text-left px-3 py-2 font-medium text-slate-700"><MiniAvatarCal estudiante={s} />{s.nombre} <InclusionBadge estudiante={s} size="text-xs" /></td>
                    {actividadesOrdenadas.map((a) => {
                      const v = valorDeActividad(a, s.id);
                      const b = bandaDesempeno(v, config);
                      const tinte = `${colorPorActividad[a.id]}0A`;
                      if (a.es_automatica) {
                        return <td key={a.id} className="text-center px-3 py-2" style={{ color: b.color, fontWeight: 600, background: tinte }}>{v}</td>;
                      }
                      return (
                        <td key={a.id} className="text-center px-3 py-2" style={{ background: tinte }}>
                          <div className="flex items-center justify-center gap-0.5">
                            <input type="number" step="0.1" defaultValue={v ?? ""} onBlur={(e) => guardarValorManual(a.id, s.id, e.target.value)}
                              style={v !== null && v !== undefined ? { color: b.color, borderColor: b.color, background: `${b.color}11`, fontWeight: 700 } : {}}
                              className="w-14 text-center text-xs rounded px-1 py-1 border border-slate-200 outline-none" />
                            {observaciones[a.id]?.[s.id] && (
                              <span title={observaciones[a.id][s.id]} className="text-[10px] cursor-help">📝</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="text-center px-3 py-2 font-bold" style={{ color: banda.color }}>
                      {editandoFinal === s.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <input autoFocus type="text" inputMode="decimal" value={valorFinalTemp} onChange={(e) => setValorFinalTemp(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") guardarNotaFinalManual(s.id); if (e.key === "Escape") setEditandoFinal(null); }}
                            className="w-14 text-center text-xs rounded px-1 py-0.5 border border-violet-300 outline-none font-normal" />
                          <button onClick={() => guardarNotaFinalManual(s.id)} className="text-emerald-500 text-xs">✔</button>
                          <button onClick={() => setEditandoFinal(null)} className="text-slate-400 text-xs">✕</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1 group cursor-pointer"
                          onClick={() => { setEditandoFinal(s.id); setValorFinalTemp(final !== null && final !== undefined ? String(final) : ""); }}
                          title={esManual(s.id) ? "Nota fijada manualmente — clic para editar" : "Clic para fijar manualmente"}>
                          <span>{final ?? "—"}</span>
                          {esManual(s.id) ? (
                            <span className="text-violet-400 text-[10px]" title="Valor manual (no calculado)">✎</span>
                          ) : (
                            <span className="text-slate-300 text-[10px] opacity-0 group-hover:opacity-100">✎</span>
                          )}
                        </div>
                      )}
                      {esManual(s.id) && editandoFinal !== s.id && (
                        <button onClick={() => quitarNotaManual(s.id)} className="block mx-auto text-[9px] text-slate-400 hover:text-rose-500 font-normal mt-0.5">quitar manual</button>
                      )}
                    </td>
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
        <NotaMasivaModal actividades={actividades} estudiantesVisibles={estudiantesVisibles} reinoFiltro={reinoFiltro} valorDeActividad={valorDeActividad}
          onClose={() => setNotaMasivaAbierta(false)} onAplicado={aplicarNotaMasiva} />
      )}
      {observacionMasivaAbierta && (
        <ObservacionMasivaModal actividades={actividades} estudiantesVisibles={estudiantesVisibles} valorDeActividad={valorDeActividad}
          onClose={() => setObservacionMasivaAbierta(false)} onAplicado={aplicarObservacionMasiva} />
      )}
      {copiarColumnasAbierto && (
        <CopiarColumnasModal materiaDestinoId={materiaId} gradoId={gradoId} periodos={periodosDe(config)} categoriasDestino={categorias} materias={materias} estudiantes={estudiantes}
          onClose={() => setCopiarColumnasAbierto(false)} onCopiado={cargar} />
      )}
      {copiarPlanillaAbierto && (
        <CopiarPlanillaOtroCursoModal materiaId={materiaId} gradoId={gradoId} grados={grados} periodo={periodo} periodos={periodosDe(config)}
          onClose={() => setCopiarPlanillaAbierto(false)} onCopiado={() => {}} />
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
  const [editandoCelda, setEditandoCelda] = useState(null); // { estudianteId, periodo }
  const [valorTemp, setValorTemp] = useState("");
  const [soloPerdiendo, setSoloPerdiendo] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const cargar = async () => {
    setCargando(true);
    const [f, n] = await Promise.all([api.fetchNotasFinales(materiaId), api.fetchNivelacion(materiaId)]);
    setFinales(f); setNivelacion(n);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, [materiaId]);

  const notaGuardada = (estudianteId, periodo) => finales.find((f) => f.estudiante_id === estudianteId && f.periodo === periodo)?.nota ?? null;
  const estadoNiv = (estudianteId, periodo) => nivelacion.find((n) => n.estudiante_id === estudianteId && n.periodo === periodo)?.estado || "";
  const nivelacionDe = (estudianteId, periodo) => nivelacion.find((n) => n.estudiante_id === estudianteId && n.periodo === periodo);

  const guardarNotaManual = async (estudianteId, periodo) => {
    const valor = valorTemp.trim() === "" ? null : parseFloat(valorTemp.replace(",", "."));
    if (valorTemp.trim() !== "" && (isNaN(valor) || valor < config.escala_min || valor > config.nota_maxima)) {
      alert(`La nota debe estar entre ${config.escala_min} y ${config.nota_maxima}.`);
      return;
    }
    if (valor === null) {
      // Borra la fila por completo (no solo el valor) para que el periodo vuelva
      // a calcularse en vivo, en vez de quedar "cerrado" con una nota vacía.
      await api.eliminarNotaFinalPeriodo(materiaId, estudianteId, periodo);
    } else {
      await api.guardarNotaFinal(materiaId, estudianteId, periodo, valor);
    }
    setEditandoCelda(null);
    cargar();
  };

  const volverACalcularEnVivo = async (estudianteId, periodo) => {
    if (!confirm("¿Quitar la nota fijada de este periodo y volver a calcularla en vivo a partir de las actividades? Esta acción no borra las actividades, solo el valor que quedó guardado como definitivo.")) return;
    await api.eliminarNotaFinalPeriodo(materiaId, estudianteId, periodo);
    cargar();
  };

  const cambiarNivelacion = async (estudianteId, periodo, estado) => {
    const registroPrevio = nivelacion.find((n) => n.estudiante_id === estudianteId && n.periodo === periodo);
    const notaActual = notaGuardada(estudianteId, periodo);
    // La nota original solo se fija la primera vez que se marca "superado" para este
    // periodo — si ya se había guardado antes, se conserva (no se pisa en toggles repetidos).
    const notaOriginal = estado === "superado"
      ? (registroPrevio?.nota_original ?? notaActual)
      : undefined;

    await api.setNivelacion(materiaId, estudianteId, periodo, estado || null, notaOriginal);
    await api.sincronizarEstadoActaNivelacion(estudianteId, materiaId, periodo, estado);
    if (estado === "superado" && (notaActual === null || notaActual < config.nota_minima)) {
      await api.guardarNotaFinal(materiaId, estudianteId, periodo, config.nota_minima);
    }
    cargar();
  };

  const promedioAnual = (estudianteId) => {
    const notas = periodos.map((p) => notaGuardada(estudianteId, p)).filter((n) => n !== null);
    if (notas.length === 0) return null;
    return Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="🔍 Buscar estudiante…"
          className="text-xs rounded-full px-3 py-2 border border-slate-200 outline-none w-44 shrink-0" />
        <button onClick={() => setSoloPerdiendo((v) => !v)}
          className={`text-xs font-semibold px-3 py-2 rounded-full border shrink-0 ${soloPerdiendo ? "bg-rose-500 text-white border-rose-500" : "border-rose-200 text-rose-600"}`}>
          🔴 {soloPerdiendo ? "Viendo solo quienes van perdiendo" : "Ver solo quienes van perdiendo"}
        </button>
        <p className="text-[11px] text-slate-400 flex-1 min-w-[220px]">
          💡 Hacé clic en cualquier nota para editarla a mano (útil al migrar notas de otra planilla). El botón de la derecha recalcula con la fórmula y <b>sobreescribe</b> las notas de ese periodo — usalo solo si querés volver a calcular automáticamente.
        </p>
        <button onClick={async () => { await guardarActual(); cargar(); }} className="text-xs font-semibold px-4 py-2 rounded-full bg-violet-500 text-white shrink-0">
          💾 Guardar notas finales del periodo actual
        </button>
      </div>
      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
          <table className="w-full text-xs" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 text-left px-3 py-2 border-b border-slate-100 bg-slate-50">Estudiante</th>
                {periodos.map((p) => <th key={p} className="sticky top-0 z-10 px-3 py-2 border-b border-slate-100 bg-slate-50">Periodo {p}</th>)}
                <th className="sticky top-0 z-10 px-3 py-2 border-b border-slate-100 bg-slate-50">Promedio</th>
              </tr>
            </thead>
            <tbody>
              {estudiantes
                .filter((s) => !soloPerdiendo || periodos.some((p) => { const n = notaGuardada(s.id, p); return n !== null && n < config.nota_minima; }))
                .filter((s) => !busqueda.trim() || s.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))
                .map((s, i) => {
                const prom = promedioAnual(s.id);
                const bandaProm = bandaDesempeno(prom, config);
                return (
                  <tr key={s.id} className="odd:bg-white even:bg-slate-50">
                    <td className="text-left px-3 py-2 font-medium text-slate-700"><MiniAvatarCal estudiante={s} />{s.nombre} <InclusionBadge estudiante={s} size="text-xs" /></td>
                    {periodos.map((p) => {
                      const n = notaGuardada(s.id, p);
                      const b = bandaDesempeno(n, config);
                      const necesitaNiv = (n !== null && n < config.nota_minima) || !!nivelacionDe(s.id, p);
                      const registroNiv = nivelacionDe(s.id, p);
                      const mostrarOriginal = registroNiv?.estado === "superado" && registroNiv?.nota_original !== null && registroNiv?.nota_original !== undefined;
                      return (
                        <td key={p} className="text-center px-3 py-2">
                          {editandoCelda?.estudianteId === s.id && editandoCelda?.periodo === p ? (
                            <div className="flex items-center justify-center gap-1">
                              <input autoFocus type="text" inputMode="decimal" value={valorTemp} onChange={(e) => setValorTemp(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") guardarNotaManual(s.id, p); if (e.key === "Escape") setEditandoCelda(null); }}
                                className="w-14 text-center text-xs rounded px-1 py-0.5 border border-violet-300 outline-none" />
                              <button onClick={() => guardarNotaManual(s.id, p)} className="text-emerald-500 text-xs">✔</button>
                              <button onClick={() => setEditandoCelda(null)} className="text-slate-400 text-xs">✕</button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1 group">
                              <span className="cursor-pointer" style={{ color: n !== null ? b.color : "#94A3B8", fontWeight: n !== null ? 700 : 400 }}
                                onClick={() => { setEditandoCelda({ estudianteId: s.id, periodo: p }); setValorTemp(n !== null ? String(n) : ""); }}>
                                {n ?? "—"}
                                {mostrarOriginal && <span className="text-[10px] text-slate-400 font-normal"> ({registroNiv.nota_original})</span>}
                              </span>
                              <span className="text-slate-300 text-[10px] opacity-0 group-hover:opacity-100 cursor-pointer"
                                onClick={() => { setEditandoCelda({ estudianteId: s.id, periodo: p }); setValorTemp(n !== null ? String(n) : ""); }}>✎</span>
                              {n !== null && (
                                <button onClick={() => volverACalcularEnVivo(s.id, p)} title="Quitar nota fijada y volver a calcular en vivo"
                                  className="text-violet-300 hover:text-violet-600 text-[10px] opacity-0 group-hover:opacity-100">↺</button>
                              )}
                            </div>
                          )}
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

const BANDAS_INFO = [
  { key: "bajo", label: "Bajo", color: "#EF4444" },
  { key: "basico", label: "Básico", color: "#F59E0B" },
  { key: "alto", label: "Alto", color: "#3B82F6" },
  { key: "superior", label: "Superior", color: "#22C55E" },
];

function ComentariosDesempenoModal({ onClose }) {
  const [comentarios, setComentarios] = useState({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(null);

  useEffect(() => { api.fetchComentariosDesempeno().then((d) => { setComentarios(d); setCargando(false); }); }, []);

  const guardar = async (banda) => {
    setGuardando(banda);
    try {
      await api.guardarComentarioDesempeno(banda, comentarios[banda] || "");
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(null);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">💬 Comentarios por desempeño</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Un comentario general por nivel de desempeño, que se le muestra al estudiante junto a cada nota según en qué banda caiga
          (no es por estudiante puntual — aplica a todas las materias y todos los estudiantes que obtengan esa banda).
        </p>

        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : (
          <div className="space-y-3">
            {BANDAS_INFO.map((b) => (
              <div key={b.key}>
                <label className="text-xs font-semibold block mb-1" style={{ color: b.color }}>{b.label}</label>
                <div className="flex gap-2">
                  <textarea value={comentarios[b.key] || ""} onChange={(e) => setComentarios((prev) => ({ ...prev, [b.key]: e.target.value }))} rows={2}
                    className="flex-1 text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
                  <button disabled={guardando === b.key} onClick={() => guardar(b.key)} className="text-xs font-semibold px-3 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60 self-start">
                    {guardando === b.key ? "…" : "Guardar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function VistaCalificaciones({ grados, destinoBusqueda, gradoActivo, materiaActiva }) {
  const [materias, setMaterias] = useState([]);
  const [materiaActualId, setMateriaActualId] = useState(null);
  const [config, setConfig] = useState(CONFIG_DEFAULT);
  const [categorias, setCategorias] = useState([]);
  const [gradoId, setGradoId] = useState(gradoActivo || grados[0]?.id || "");
  const [periodo, setPeriodo] = useState("1");
  const [soloVigente, setSoloVigente] = useState(true);
  const [subVista, setSubVista] = useState("planilla");
  const [comentariosAbiertos, setComentariosAbiertos] = useState(false);
  const [estudiantes, setEstudiantes] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Curso activo elegido en la barra superior — no pisa el salto puntual
  // que hace el buscador global de estudiantes (ver el efecto de abajo).
  useEffect(() => { if (gradoActivo) setGradoId(gradoActivo); }, [gradoActivo]);
  // Materia activa de la barra superior (el periodo sigue su propia lógica
  // de "vigente" por materia, no se pisa con un periodo global).
  useEffect(() => { if (materiaActiva) setMateriaActualId(materiaActiva); }, [materiaActiva]);

  // Cuando llega desde el buscador global de estudiantes: saltar directo a su
  // curso, en la Planilla, con su fila resaltada.
  useEffect(() => {
    if (!destinoBusqueda) return;
    setGradoId(destinoBusqueda.gradoId);
    setSubVista("planilla");
    setSoloVigente(false);
  }, [destinoBusqueda]);

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
    return cfg;
  };
  // Al cambiar de materia, el periodo arranca en el "vigente" que hayas marcado
  // para esa materia (no siempre en el Periodo 1).
  useEffect(() => { cargarConfigYCategorias().then((cfg) => { if (cfg?.periodo_actual) setPeriodo(cfg.periodo_actual); }); }, [materiaActualId]);

  const marcarPeriodoVigente = async () => {
    await api.guardarNotasConfig(materiaActualId, { ...config, periodo_actual: periodo });
    setConfig((prev) => ({ ...prev, periodo_actual: periodo }));
  };

  useEffect(() => {
    if (soloVigente && config.periodo_actual && parseInt(periodo, 10) < parseInt(config.periodo_actual, 10)) {
      setPeriodo(config.periodo_actual);
    }
  }, [soloVigente]);

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
          {estudiantes.some((s) => s.piar || s.dua) && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 mb-4 text-sm text-violet-800">
              🧩 <b>Recordatorio de inclusión</b> — este grupo tiene estudiantes con proceso PIAR/DUA activo:{" "}
              {estudiantes.filter((s) => s.piar || s.dua).map((s) => s.nombre).join(", ")}.
            </div>
          )}

          <PanelCategorias materiaId={materiaActualId} categorias={categorias} onCambio={cargarConfigYCategorias} />

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3 mb-4">
            <div className="flex flex-wrap gap-2 items-center mb-2">
              {(() => {
                const niveles = agruparPorNivel(grados);
                const { nivel: nivelActual } = nivelYCurso(gradoId);
                const cursosDelNivel = niveles.find((n) => n.nivel === nivelActual)?.cursos || [];
                return (
                  <>
                    <select value={nivelActual} onChange={(e) => {
                      const nuevoNivel = niveles.find((n) => n.nivel === e.target.value);
                      if (nuevoNivel?.cursos[0]) setGradoId(nuevoNivel.cursos[0].id);
                    }} className="text-sm rounded-lg px-3 py-1.5 border border-slate-200 outline-none">
                      {niveles.map((n) => <option key={n.nivel} value={n.nivel}>Grado {n.nivel}°</option>)}
                    </select>
                    <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-lg px-3 py-1.5 border border-slate-200 outline-none">
                      {cursosDelNivel.map((g) => <option key={g.id} value={g.id}>Curso {g.id}</option>)}
                    </select>
                  </>
                );
              })()}
              <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="text-sm rounded-lg px-3 py-1.5 border border-slate-200 outline-none">
                {periodosDe(config)
                  .filter((p) => !soloVigente || parseInt(p, 10) >= parseInt(config.periodo_actual || "1", 10))
                  .map((p) => <option key={p} value={p}>Periodo {p}{p === config.periodo_actual ? " (vigente)" : ""}</option>)}
              </select>
              {periodo !== config.periodo_actual && (
                <button onClick={marcarPeriodoVigente} title="Marcar este periodo como el vigente para esta materia" className="text-xs px-2.5 py-1.5 rounded-full bg-violet-100 text-violet-700 shrink-0">📌 Marcar como vigente</button>
              )}
              <label className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
                <input type="checkbox" checked={soloVigente} onChange={(e) => setSoloVigente(e.target.checked)} />
                Ocultar periodos anteriores
              </label>
              <button onClick={() => setComentariosAbiertos(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 ml-auto">💬 Comentarios por desempeño</button>
            </div>
            <div className="flex gap-1 rounded-full bg-violet-50 p-1 w-fit flex-wrap">
              <button onClick={() => setSubVista("planilla")} className={`text-xs px-3 py-1.5 rounded-full ${subVista === "planilla" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Planilla</button>
              <button onClick={() => setSubVista("boletin")} className={`text-xs px-3 py-1.5 rounded-full ${subVista === "boletin" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Boletín / Nivelación</button>
              <button onClick={() => setSubVista("estadisticas")} className={`text-xs px-3 py-1.5 rounded-full ${subVista === "estadisticas" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Estadísticas</button>
              <button onClick={() => setSubVista("config")} className={`text-xs px-3 py-1.5 rounded-full ${subVista === "config" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Escala y periodos</button>
            </div>
          </div>

          {subVista === "planilla" && (
            <Planilla materiaId={materiaActualId} config={config} categorias={categorias} estudiantes={estudiantes} gradoId={gradoId} grados={grados} periodo={periodo} materias={materias} onCambioCategorias={cargarConfigYCategorias} estudianteDestacadoId={destinoBusqueda?.estudianteId} />
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
          {comentariosAbiertos && <ComentariosDesempenoModal onClose={() => setComentariosAbiertos(false)} />}
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
