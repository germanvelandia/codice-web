import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import * as api from "../lib/api";

function ImportarExcelModal({ materiaId, onClose, onImportado }) {
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const descargarPlantilla = () => {
    const filas = [
      ["Tema", "Enunciado", "Opción A", "Opción B", "Opción C", "Opción D", "Correcta (A/B/C/D)", "Dificultad (facil/media/dificil)"],
      ["Álgebra", "¿Cuál es el resultado de 2x + 3 = 7?", "x=1", "x=2", "x=3", "x=4", "B", "facil"],
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
          tema: (f["Tema"] || "").toString().trim(),
          enunciado: (f["Enunciado"] || "").toString().trim(),
          opcionA: (f["Opción A"] || f["Opcion A"] || "").toString().trim(),
          opcionB: (f["Opción B"] || f["Opcion B"] || "").toString().trim(),
          opcionC: (f["Opción C"] || f["Opcion C"] || "").toString().trim(),
          opcionD: (f["Opción D"] || f["Opcion D"] || "").toString().trim(),
          correcta: (f["Correcta (A/B/C/D)"] || f["Correcta"] || "").toString().trim().toUpperCase(),
          dificultad: (f["Dificultad (facil/media/dificil)"] || f["Dificultad"] || "").toString().trim().toLowerCase() || null,
        })).filter((f) => f.enunciado);

        if (normalizadas.length === 0) { alert("No se encontraron filas con enunciado. Revisá que uses la plantilla."); setProcesando(false); return; }

        const r = await api.importarPreguntasBanco(materiaId, normalizadas);
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
            </p>
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

function PreguntaBancoForm({ materiaId, pregunta, onCancelar, onGuardada }) {
  const [tema, setTema] = useState(pregunta?.tema || "");
  const [enunciado, setEnunciado] = useState(pregunta?.enunciado || "");
  const [opciones, setOpciones] = useState(pregunta?.opciones?.map((o) => o.texto) || ["", "", "", ""]);
  const [correcta, setCorrecta] = useState(pregunta ? pregunta.opciones.findIndex((o) => o.correcta) : 0);
  const [dificultad, setDificultad] = useState(pregunta?.dificultad || "");
  const [guardando, setGuardando] = useState(false);

  const cambiarOpcion = (i, v) => setOpciones((prev) => prev.map((o, idx) => idx === i ? v : o));

  const guardar = async () => {
    const limpias = opciones.map((o) => o.trim()).filter(Boolean);
    if (!enunciado.trim() || limpias.length < 2) { alert("Completá el enunciado y al menos 2 opciones."); return; }
    setGuardando(true);
    try {
      const campos = {
        tema: tema.trim() || null, enunciado: enunciado.trim(), dificultad: dificultad || null,
        opciones: opciones.map((texto, i) => ({ texto: texto.trim(), correcta: i === correcta })).filter((o) => o.texto),
        materia_id: materiaId,
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
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Tema (ej: Álgebra)" className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        <select value={dificultad} onChange={(e) => setDificultad(e.target.value)} className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white">
          <option value="">Dificultad (opcional)</option>
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
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-1.5">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : pregunta ? "Guardar cambios" : "Agregar pregunta"}
        </button>
      </div>
    </div>
  );
}

export function VistaBancoPreguntas() {
  const [materias, setMaterias] = useState([]);
  const [materiaId, setMateriaId] = useState("");
  const [preguntas, setPreguntas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [importarAbierto, setImportarAbierto] = useState(false);
  const [filtroTema, setFiltroTema] = useState("");

  useEffect(() => {
    api.fetchMaterias().then((ms) => { setMaterias(ms); if (ms[0]) setMateriaId(ms[0].id); });
  }, []);

  const cargar = () => {
    if (!materiaId) return;
    setCargando(true);
    api.fetchBancoPreguntas(materiaId).then((d) => { setPreguntas(d); setCargando(false); });
  };
  useEffect(() => { cargar(); }, [materiaId]);

  const eliminar = async (p) => { if (!confirm("¿Eliminar esta pregunta del banco?")) return; await api.eliminarPreguntaBanco(p.id); cargar(); };

  const temas = Array.from(new Set(preguntas.map((p) => p.tema).filter(Boolean))).sort();
  const visibles = filtroTema ? preguntas.filter((p) => p.tema === filtroTema) : preguntas;

  if (materias.length === 0) {
    return <p className="text-sm text-slate-400">Primero creá al menos una materia (en Calificaciones) para poder armar el banco de preguntas.</p>;
  }

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">🗂️ Banco de preguntas</h3>
      <p className="text-xs text-slate-400 mb-3">
        Cargá muchas preguntas tipo ICFES por materia. Después, al crear una Misión, podés pedir "N preguntas al azar de este banco"
        en vez de escribirlas una por una.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        <select value={materiaId} onChange={(e) => setMateriaId(parseInt(e.target.value, 10))} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
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
      </div>

      {formAbierto && (
        <PreguntaBancoForm materiaId={materiaId} pregunta={editando} onCancelar={() => { setFormAbierto(false); setEditando(null); }} onGuardada={() => { setFormAbierto(false); setEditando(null); cargar(); }} />
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : visibles.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">Todavía no hay preguntas en esta materia.</p>
      ) : (
        <>
          <p className="text-xs text-slate-400 mb-2">{visibles.length} pregunta(s)</p>
          <div className="space-y-2">
            {visibles.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-slate-100 p-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    {p.tema && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 mr-1.5">{p.tema}</span>}
                    {p.dificultad && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{p.dificultad}</span>}
                    <p className="text-sm text-slate-700 mt-1">{p.enunciado}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => { setEditando(p); setFormAbierto(true); }} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
                    <button onClick={() => eliminar(p)} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {p.opciones.map((o, i) => (
                    <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full ${o.correcta ? "bg-emerald-100 text-emerald-700 font-semibold" : "bg-slate-100 text-slate-500"}`}>
                      {o.correcta ? "✓ " : ""}{o.texto}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {importarAbierto && <ImportarExcelModal materiaId={materiaId} onClose={() => setImportarAbierto(false)} onImportado={cargar} />}
    </div>
  );
}
