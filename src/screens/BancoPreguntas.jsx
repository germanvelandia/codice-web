import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import * as api from "../lib/api";
import { agruparPorNivel } from "../lib/gamification";

function ImportarExcelModal({ materiaId, niveles, onClose, onImportado }) {
  const [nivelPorDefecto, setNivelPorDefecto] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const descargarPlantilla = () => {
    const filas = [
      ["Grado (opcional, si no lo pones se usa el elegido abajo)", "Tema", "Enunciado", "Opción A", "Opción B", "Opción C", "Opción D", "Correcta (A/B/C/D)", "Dificultad (facil/media/dificil)", "Retroalimentación (opcional)"],
      ["8", "Álgebra", "¿Cuál es el resultado de 2x + 3 = 7?", "x=1", "x=2", "x=3", "x=4", "B", "facil", "Se despeja x restando 3 y dividiendo entre 2: (7-3)/2 = 2"],
    ];
    const hoja = XLSX.utils.aoa_to_sheet(filas);
    hoja["!cols"] = filas[0].map(() => ({ wch: 22 }));
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Preguntas");
    XLSX.writeFile(libro, "plantilla_banco_preguntas.xlsx");
  };

  const procesarArchivo = (file) => {
    setProcesando(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "binary" });
        const hoja = wb.Sheets[wb.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });
        const normalizadas = filas.map((f) => ({
          nivel: (f["Grado (opcional, si no lo pones se usa el elegido abajo)"] || f["Grado"] || "").toString().trim(),
          tema: (f["Tema"] || "").toString().trim(),
          enunciado: (f["Enunciado"] || "").toString().trim(),
          opcionA: (f["Opción A"] || f["Opcion A"] || "").toString().trim(),
          opcionB: (f["Opción B"] || f["Opcion B"] || "").toString().trim(),
          opcionC: (f["Opción C"] || f["Opcion C"] || "").toString().trim(),
          opcionD: (f["Opción D"] || f["Opcion D"] || "").toString().trim(),
          correcta: (f["Correcta (A/B/C/D)"] || f["Correcta"] || "").toString().trim().toUpperCase(),
          dificultad: (f["Dificultad (facil/media/dificil)"] || f["Dificultad"] || "").toString().trim().toLowerCase() || null,
          retroalimentacion: (f["Retroalimentación (opcional)"] || f["Retroalimentacion"] || "").toString().trim() || null,
        })).filter((f) => f.enunciado);

        if (normalizadas.length === 0) { alert("No se encontraron filas con enunciado. Revisá que uses la plantilla."); setProcesando(false); return; }

        const r = await api.importarPreguntasBanco(materiaId, normalizadas, nivelPorDefecto || null);
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
          <h3 className="font-bold text-slate-800">📥 Importar preguntas desde Excel</h3>
          {!procesando && <button onClick={onClose} className="text-slate-400">✕</button>}
        </div>

        {resultado ? (
          <div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3">
              <p className="text-sm font-semibold text-emerald-700">✔ Listo</p>
              <p className="text-xs text-emerald-600 mt-1">Se cargaron {resultado.cargadas} de {resultado.total} pregunta(s).</p>
            </div>
            {resultado.errores.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-700 max-h-32 overflow-y-auto mb-3">
                <p className="font-semibold mb-1">No se pudieron cargar:</p>
                <ul className="list-disc list-inside">{resultado.errores.map((e, i) => <li key={i}>{e}</li>)}</ul>
              </div>
            )}
            <button onClick={onClose} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white">Cerrar</button>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-3">
              Descargá la plantilla, completá una fila por pregunta (tema, enunciado, las 4 opciones, y cuál es la correcta), y subila.
              Si todas las preguntas del archivo son del mismo grado, elegilo acá abajo — así no hace falta ponerlo fila por fila.
            </p>
            <label className="text-xs text-slate-500 block mb-1">Grado por defecto (opcional)</label>
            <select value={nivelPorDefecto} onChange={(e) => setNivelPorDefecto(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none">
              <option value="">Sin grado específico</option>
              {niveles.map((n) => <option key={n.nivel} value={n.nivel}>Grado {n.nivel}°</option>)}
            </select>
            <button onClick={descargarPlantilla} className="w-full text-sm font-semibold py-2.5 rounded-lg border border-violet-200 text-violet-600 mb-3">
              📄 Descargar plantilla
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

function PreguntaBancoForm({ materiaId, niveles, pregunta, onCancelar, onGuardada }) {
  const [nivel, setNivel] = useState(pregunta?.nivel || "");
  const [tema, setTema] = useState(pregunta?.tema || "");
  const [enunciado, setEnunciado] = useState(pregunta?.enunciado || "");
  const [opciones, setOpciones] = useState(pregunta?.opciones?.map((o) => o.texto) || ["", "", "", ""]);
  const [correcta, setCorrecta] = useState(pregunta ? pregunta.opciones.findIndex((o) => o.correcta) : 0);
  const [dificultad, setDificultad] = useState(pregunta?.dificultad || "");
  const [retroalimentacion, setRetroalimentacion] = useState(pregunta?.retroalimentacion || "");
  const [guardando, setGuardando] = useState(false);

  const cambiarOpcion = (i, v) => setOpciones((prev) => prev.map((o, idx) => idx === i ? v : o));

  const guardar = async () => {
    const limpias = opciones.map((o) => o.trim()).filter(Boolean);
    if (!enunciado.trim() || limpias.length < 2) { alert("Completá el enunciado y al menos 2 opciones."); return; }
    setGuardando(true);
    try {
      const campos = {
        nivel: nivel || null, tema: tema.trim() || null, enunciado: enunciado.trim(), dificultad: dificultad || null,
        opciones: opciones.map((texto, i) => ({ texto: texto.trim(), correcta: i === correcta })).filter((o) => o.texto),
        materia_id: materiaId, retroalimentacion: retroalimentacion.trim() || null,
      };
      if (pregunta) await api.editarPreguntaBanco(pregunta.id, campos);
      else await api.crearPreguntaBanco(campos);
      onGuardada();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-xl p-3 mb-3">
      <div className="grid grid-cols-3 gap-2 mb-2">
        <select value={nivel} onChange={(e) => setNivel(e.target.value)} className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white">
          <option value="">Sin grado</option>
          {niveles.map((n) => <option key={n.nivel} value={n.nivel}>Grado {n.nivel}°</option>)}
        </select>
        <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Tema (ej: Álgebra)" className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        <select value={dificultad} onChange={(e) => setDificultad(e.target.value)} className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white">
          <option value="">Dificultad</option>
          <option value="facil">Fácil</option>
          <option value="media">Media</option>
          <option value="dificil">Difícil</option>
        </select>
      </div>
      <textarea value={enunciado} onChange={(e) => setEnunciado(e.target.value)} rows={2} placeholder="Enunciado de la pregunta…"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      {opciones.map((o, i) => (
        <div key={i} className="flex items-center gap-2 mb-1.5">
          <input type="radio" checked={correcta === i} onChange={() => setCorrecta(i)} title="Marcar como correcta" />
          <input value={o} onChange={(e) => cambiarOpcion(i, e.target.value)} placeholder={`Opción ${String.fromCharCode(65 + i)}`}
            className="flex-1 text-sm rounded-lg px-3 py-1.5 border border-slate-200 outline-none bg-white" />
        </div>
      ))}
      <label className="text-xs text-slate-500 block mb-1 mt-1">Retroalimentación (opcional — explicación de por qué es esa la respuesta)</label>
      <textarea value={retroalimentacion} onChange={(e) => setRetroalimentacion(e.target.value)} rows={2} placeholder="Ej: La respuesta es B porque…"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-1.5">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : pregunta ? "Guardar cambios" : "Agregar pregunta"}
        </button>
      </div>
    </div>
  );
}

function TrasladarPreguntasModal({ ids, materias, niveles, onClose, onTrasladado }) {
  const [cambiarMateria, setCambiarMateria] = useState(false);
  const [materiaDestino, setMateriaDestino] = useState(materias[0]?.id || "");
  const [cambiarNivel, setCambiarNivel] = useState(false);
  const [nivelDestino, setNivelDestino] = useState("");
  const [cambiarTema, setCambiarTema] = useState(false);
  const [temaDestino, setTemaDestino] = useState("");
  const [guardando, setGuardando] = useState(false);

  const trasladar = async () => {
    if (!cambiarMateria && !cambiarNivel && !cambiarTema) { alert("Elegí al menos un campo para cambiar."); return; }
    setGuardando(true);
    try {
      const cambios = {};
      if (cambiarMateria) cambios.materia_id = parseInt(materiaDestino, 10);
      if (cambiarNivel) cambios.nivel = nivelDestino || null;
      if (cambiarTema) cambios.tema = temaDestino.trim() || null;
      await api.trasladarPreguntasBanco(ids, cambios);
      onTrasladado();
    } catch (e) {
      alert("Error al trasladar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">↗️ Trasladar {ids.length} pregunta(s)</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">Marcá solo lo que quieras cambiar — lo que no marques queda igual.</p>

        <label className="flex items-center gap-2 text-xs text-slate-600 mb-1">
          <input type="checkbox" checked={cambiarMateria} onChange={(e) => setCambiarMateria(e.target.checked)} /> Cambiar materia
        </label>
        {cambiarMateria && (
          <select value={materiaDestino} onChange={(e) => setMateriaDestino(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none">
            {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        )}

        <label className="flex items-center gap-2 text-xs text-slate-600 mb-1 mt-2">
          <input type="checkbox" checked={cambiarNivel} onChange={(e) => setCambiarNivel(e.target.checked)} /> Cambiar grado
        </label>
        {cambiarNivel && (
          <select value={nivelDestino} onChange={(e) => setNivelDestino(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none">
            <option value="">Sin grado específico</option>
            {niveles.map((n) => <option key={n.nivel} value={n.nivel}>Grado {n.nivel}°</option>)}
          </select>
        )}

        <label className="flex items-center gap-2 text-xs text-slate-600 mb-1 mt-2">
          <input type="checkbox" checked={cambiarTema} onChange={(e) => setCambiarTema(e.target.checked)} /> Cambiar tema
        </label>
        {cambiarTema && (
          <input value={temaDestino} onChange={(e) => setTemaDestino(e.target.value)} placeholder="Nuevo tema"
            className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none" />
        )}

        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onClose} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
          <button disabled={guardando} onClick={trasladar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
            {guardando ? "Trasladando…" : "Trasladar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function VistaBancoPreguntas({ grados = [] }) {
  const [materias, setMaterias] = useState([]);
  const [materiaId, setMateriaId] = useState("");
  const [preguntas, setPreguntas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [importarAbierto, setImportarAbierto] = useState(false);
  const [filtroTema, setFiltroTema] = useState("");
  const [filtroNivel, setFiltroNivel] = useState("");
  const [seleccionando, setSeleccionando] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [trasladarAbierto, setTrasladarAbierto] = useState(false);
  const niveles = agruparPorNivel(grados);

  useEffect(() => {
    api.fetchMaterias().then((ms) => { setMaterias(ms); if (ms[0]) setMateriaId(ms[0].id); });
  }, []);

  const cargar = () => {
    if (!materiaId) return;
    setCargando(true);
    api.fetchBancoPreguntas(materiaId, null, filtroNivel || null).then((d) => { setPreguntas(d); setCargando(false); });
  };
  useEffect(() => { cargar(); setSeleccionadas([]); }, [materiaId, filtroNivel]);

  const eliminar = async (p) => { if (!confirm("¿Eliminar esta pregunta del banco?")) return; await api.eliminarPreguntaBanco(p.id); cargar(); };

  const toggleSeleccion = (id) => setSeleccionadas((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const seleccionarTodasVisibles = (visibles) => setSeleccionadas(visibles.map((p) => p.id));

  const eliminarSeleccionadas = async () => {
    if (!confirm(`¿Eliminar ${seleccionadas.length} pregunta(s) seleccionada(s)?`)) return;
    await api.eliminarPreguntasBancoMasivo(seleccionadas);
    setSeleccionadas([]);
    setSeleccionando(false);
    cargar();
  };

  const temas = Array.from(new Set(preguntas.map((p) => p.tema).filter(Boolean))).sort();
  const visibles = filtroTema ? preguntas.filter((p) => p.tema === filtroTema) : preguntas;

  if (materias.length === 0) {
    return <p className="text-sm text-slate-400">Primero creá al menos una materia (en Calificaciones) para poder armar el banco de preguntas.</p>;
  }

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">🗂️ Banco de preguntas</h3>
      <p className="text-xs text-slate-400 mb-3">
        Cargá muchas preguntas tipo ICFES por materia y grado, para no mezclar los temas entre cursos. Después, al crear una Misión,
        podés pedir "N preguntas al azar de este banco" en vez de escribirlas una por una.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        <select value={materiaId} onChange={(e) => setMateriaId(parseInt(e.target.value, 10))} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        <select value={filtroNivel} onChange={(e) => setFiltroNivel(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          <option value="">Todos los grados</option>
          {niveles.map((n) => <option key={n.nivel} value={n.nivel}>Grado {n.nivel}°</option>)}
        </select>
        {temas.length > 0 && (
          <select value={filtroTema} onChange={(e) => setFiltroTema(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
            <option value="">Todos los temas</option>
            {temas.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <button onClick={() => setImportarAbierto(true)} className="text-xs font-semibold px-3 py-2 rounded-full border border-violet-200 text-violet-600">📥 Importar Excel</button>
        <button onClick={() => { setEditando(null); setFormAbierto((v) => !v); }} className="text-xs font-semibold px-3 py-2 rounded-full bg-violet-500 text-white">
          {formAbierto ? "Cerrar" : "+ Nueva pregunta"}
        </button>
        <button onClick={() => { setSeleccionando((v) => !v); setSeleccionadas([]); }} className={`text-xs font-semibold px-3 py-2 rounded-full border ${seleccionando ? "bg-slate-700 text-white border-slate-700" : "border-slate-200 text-slate-600"}`}>
          {seleccionando ? "✕ Cancelar selección" : "☑️ Seleccionar"}
        </button>
      </div>

      {seleccionando && visibles.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 rounded-xl p-2.5 mb-3">
          <span className="text-xs text-slate-500">{seleccionadas.length} seleccionada(s)</span>
          <button onClick={() => seleccionarTodasVisibles(visibles)} className="text-xs text-violet-500">Seleccionar todas ({visibles.length})</button>
          <button onClick={() => setSeleccionadas([])} className="text-xs text-slate-400">Ninguna</button>
          <div className="flex-1" />
          <button disabled={seleccionadas.length === 0} onClick={() => setTrasladarAbierto(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-500 text-white disabled:opacity-40">
            ↗️ Trasladar
          </button>
          <button disabled={seleccionadas.length === 0} onClick={eliminarSeleccionadas} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-rose-500 text-white disabled:opacity-40">
            🗑 Eliminar
          </button>
        </div>
      )}

      {formAbierto && (
        <PreguntaBancoForm materiaId={materiaId} niveles={niveles} pregunta={editando} onCancelar={() => { setFormAbierto(false); setEditando(null); }} onGuardada={() => { setFormAbierto(false); setEditando(null); cargar(); }} />
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : visibles.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">Todavía no hay preguntas acá — probá cambiar el grado o el tema del filtro.</p>
      ) : (
        <>
          <p className="text-xs text-slate-400 mb-2">{visibles.length} pregunta(s)</p>
          <div className="space-y-2">
            {visibles.map((p) => (
              <div key={p.id} className={`bg-white rounded-xl border p-3 ${seleccionando && seleccionadas.includes(p.id) ? "border-violet-400 bg-violet-50/40" : "border-slate-100"}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    {seleccionando && (
                      <input type="checkbox" checked={seleccionadas.includes(p.id)} onChange={() => toggleSeleccion(p.id)} className="mt-1 shrink-0" />
                    )}
                    <div>
                      {p.nivel && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 mr-1.5">Grado {p.nivel}°</span>}
                      {p.tema && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 mr-1.5">{p.tema}</span>}
                      {p.dificultad && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{p.dificultad}</span>}
                      <p className="text-sm text-slate-700 mt-1">{p.enunciado}</p>
                    </div>
                  </div>
                  {!seleccionando && (
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => { setEditando(p); setFormAbierto(true); }} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
                      <button onClick={() => eliminar(p)} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {p.opciones.map((o, i) => (
                    <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full ${o.correcta ? "bg-emerald-100 text-emerald-700 font-semibold" : "bg-slate-100 text-slate-500"}`}>
                      {o.correcta ? "✓ " : ""}{o.texto}
                    </span>
                  ))}
                </div>
                {p.retroalimentacion && (
                  <p className="text-[11px] text-slate-400 mt-2 italic">💡 {p.retroalimentacion}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {importarAbierto && <ImportarExcelModal materiaId={materiaId} niveles={niveles} onClose={() => setImportarAbierto(false)} onImportado={cargar} />}
      {trasladarAbierto && (
        <TrasladarPreguntasModal ids={seleccionadas} materias={materias} niveles={niveles}
          onClose={() => setTrasladarAbierto(false)}
          onTrasladado={() => { setTrasladarAbierto(false); setSeleccionadas([]); setSeleccionando(false); cargar(); }} />
      )}
    </div>
  );
}
