import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import * as api from "../lib/api";

const PROMPT_IA_RUBRICAS = `Actuá como un diseñador instruccional experto en evaluación educativa.
Vas a crear una o más RÚBRICAS DE EVALUACIÓN para el tema que te indique,
siguiendo EXACTAMENTE este formato de texto (es importante respetarlo tal
cual, para poder importarlo después):

R�BRICA: [nombre corto y claro de la rúbrica]

CRITERIO: [nombre del primer criterio a evaluar]
- Alto (5 pts): [descripción breve de qué logra el estudiante en este nivel]
- Medio (3 pts): [descripción breve]
- Bajo (1 pts): [descripción breve]

CRITERIO: [nombre del segundo criterio]
- Alto (5 pts): [descripción]
- Medio (3 pts): [descripción]
- Bajo (1 pts): [descripción]

(repetí "CRITERIO:" con sus niveles para cada criterio que haga falta — entre
3 y 5 criterios suele ser un buen número)

Si te pido varias rúbricas en el mismo pedido, separá cada una repitiendo
"RÚBRICA: [nombre]" de nuevo desde cero, con sus propios criterios.

DATOS PARA LA RÚBRICA:
- Tema / actividad a evaluar: [completá acá]
- Nivel / grado: [completá acá]
- Aspectos que más te importa evaluar (opcional): [completá acá]

Generá los puntos de cada nivel en la misma escala relativa (por ejemplo
5/3/1) — yo los voy a ajustar después a la escala de notas de mi Planilla.
No uses relleno genérico: cada descripción de nivel tiene que ser específica
al criterio y al tema pedido.`;

// Analiza el texto que la IA devolvió (siguiendo el formato de arriba) y lo
// separa en rúbricas independientes, cada una con sus criterios y niveles.
// Es un "mejor esfuerzo": si algo no calza exacto, esa rúbrica se ignora en
// vez de romper el resto.
function analizarRubricasDeIA(texto) {
  const limpiarTexto = (s) => (s || "").replace(/\*\*/g, "").trim();
  const bloquesRubrica = texto.split(/(?:^|\n)\s*#{0,3}\s*\*{0,2}RÚBRICA\s*:?/i).slice(1);

  return bloquesRubrica.map((bloque) => {
    const finNombre = bloque.search(/\n/);
    const nombre = limpiarTexto(finNombre >= 0 ? bloque.slice(0, finNombre) : bloque);
    const bloquesCriterio = bloque.split(/(?:^|\n)\s*#{0,3}\s*\*{0,2}CRITERIO\s*:?/i).slice(1);

    const criterios = bloquesCriterio.map((cBloque) => {
      const finCriterio = cBloque.search(/\n/);
      const criterio = limpiarTexto(finCriterio >= 0 ? cBloque.slice(0, finCriterio) : cBloque);
      const niveles = [...cBloque.matchAll(/[-*]\s*\*{0,2}([^:(*\n]+?)\*{0,2}\s*\(?\s*(\d+(?:\.\d+)?)\s*pts?\)?/gi)]
        .map(([, nom, pts]) => ({ nombre: limpiarTexto(nom), puntos: parseFloat(pts) || 0 }));
      return { criterio, niveles };
    }).filter((c) => c.criterio && c.niveles.length > 0);

    return { nombre, criterios };
  }).filter((r) => r.nombre && r.criterios.length > 0);
}

function PromptIaRubricasModal({ onClose }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = () => { navigator.clipboard.writeText(PROMPT_IA_RUBRICAS); setCopiado(true); setTimeout(() => setCopiado(false), 2000); };
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-slate-800">🤖 Prompt de IA para generar rúbricas</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">Copiá este texto y pegalo en Claude (u otra IA), completando los datos del final — después usá "📋 Pegar desde IA" acá para traerla directo.</p>
        <pre className="text-xs bg-slate-50 rounded-lg p-3 mb-3 whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">{PROMPT_IA_RUBRICAS}</pre>
        <button onClick={copiar} className="w-full text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white">{copiado ? "✔ Copiado" : "📋 Copiar"}</button>
      </div>
    </div>
  );
}

function PegarDeIaModal({ onClose, onImportadas }) {
  const [texto, setTexto] = useState("");
  const [importando, setImportando] = useState(false);

  const analizar = async () => {
    if (!texto.trim()) { alert("Pegá acá el texto que te devolvió la IA."); return; }
    const rubricas = analizarRubricasDeIA(texto);
    if (rubricas.length === 0) { alert("No pude reconocer ninguna rúbrica con el formato esperado. Revisá que la IA haya usado \"RÚBRICA:\" y \"CRITERIO:\" tal como pide el prompt."); return; }
    if (!confirm(`Encontré ${rubricas.length} rúbrica(s): ${rubricas.map((r) => r.nombre).join(", ")}. ¿Las agrego a tu catálogo?`)) return;
    setImportando(true);
    try {
      for (const r of rubricas) await api.crearRubricaCatalogo(r.nombre, r.criterios);
      onImportadas();
    } catch (e) {
      alert("Error al importar: " + e.message);
    }
    setImportando(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-2xl shadow-xl">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-slate-800">📋 Pegar rúbrica(s) desde IA</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">Pegá acá todo lo que te devolvió la IA — puede traer una o varias rúbricas juntas, las voy a separar solas.</p>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={14} placeholder="Pegá acá la respuesta completa de la IA…"
          className="w-full text-xs rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
          <button disabled={importando} onClick={analizar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
            {importando ? "Importando…" : "Analizar y agregar al catálogo"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RubricaCatalogoForm({ rubrica, onCancelar, onGuardado }) {
  const NIVELES_INICIALES = () => [{ nombre: "Alto", puntos: 5 }, { nombre: "Medio", puntos: 3 }, { nombre: "Bajo", puntos: 1 }];
  const [nombre, setNombre] = useState(rubrica?.nombre || "");
  const [criterios, setCriterios] = useState(rubrica?.criterios?.length ? rubrica.criterios : [{ criterio: "", niveles: NIVELES_INICIALES() }]);
  const [guardando, setGuardando] = useState(false);

  const actualizarCriterio = (i, texto) => setCriterios((prev) => prev.map((c, idx) => idx === i ? { ...c, criterio: texto } : c));
  const actualizarNivel = (i, j, campo, valor) => setCriterios((prev) => prev.map((c, idx) => idx === i
    ? { ...c, niveles: c.niveles.map((n, k) => k === j ? { ...n, [campo]: campo === "puntos" ? parseFloat(valor) || 0 : valor } : n) }
    : c));
  const agregarCriterio = () => setCriterios((prev) => [...prev, { criterio: "", niveles: NIVELES_INICIALES() }]);
  const quitarCriterio = (i) => setCriterios((prev) => prev.filter((_, idx) => idx !== i));
  const agregarNivel = (i) => setCriterios((prev) => prev.map((c, idx) => idx === i ? { ...c, niveles: [...c.niveles, { nombre: "Nuevo nivel", puntos: 0 }] } : c));
  const quitarNivel = (i, j) => setCriterios((prev) => prev.map((c, idx) => {
    if (idx !== i) return c;
    if (c.niveles.length <= 1) { alert("Cada criterio necesita al menos un nivel."); return c; }
    return { ...c, niveles: c.niveles.filter((_, k) => k !== j) };
  }));

  const guardar = async () => {
    if (!nombre.trim()) { alert("Ponele un nombre a la rúbrica (ej: 'Ensayo argumentativo')."); return; }
    const limpios = criterios.filter((c) => c.criterio.trim());
    if (limpios.length === 0) { alert("Agregá al menos un criterio."); return; }
    setGuardando(true);
    try {
      if (rubrica) await api.editarRubricaCatalogo(rubrica.id, { nombre: nombre.trim(), criterios: limpios });
      else await api.crearRubricaCatalogo(nombre.trim(), limpios);
      onGuardado();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-2xl p-4 mb-4">
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la rúbrica (ej: Ensayo argumentativo)"
        className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none bg-white" />

      <div className="space-y-3 mb-3">
        {criterios.map((c, i) => (
          <div key={i} className="border border-slate-200 rounded-xl p-3 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <input value={c.criterio} onChange={(e) => actualizarCriterio(i, e.target.value)} placeholder="Criterio a evaluar (ej: Ortografía)"
                className="flex-1 text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
              <button onClick={() => quitarCriterio(i)} className="text-slate-300 hover:text-rose-500">🗑</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {c.niveles.map((n, j) => (
                <div key={j} className="bg-slate-50 rounded-lg p-2 relative" style={{ width: 110 }}>
                  <button onClick={() => quitarNivel(i, j)} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-400 text-white text-[9px] flex items-center justify-center" title="Quitar este nivel">✕</button>
                  <input value={n.nombre} onChange={(e) => actualizarNivel(i, j, "nombre", e.target.value)}
                    className="w-full text-xs font-semibold rounded px-1 py-1 border border-slate-200 outline-none mb-1" />
                  <input type="number" value={n.puntos} onChange={(e) => actualizarNivel(i, j, "puntos", e.target.value)}
                    className="w-full text-xs rounded px-1 py-1 border border-slate-200 outline-none" placeholder="Puntos" />
                </div>
              ))}
              <button onClick={() => agregarNivel(i)} className="text-xs text-violet-500 border border-dashed border-violet-300 rounded-lg px-3" style={{ width: 110 }}>
                + Nivel
              </button>
            </div>
          </div>
        ))}
        <button onClick={agregarCriterio} className="text-xs text-violet-500">+ Agregar criterio</button>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : rubrica ? "Guardar cambios" : "Crear rúbrica"}
        </button>
      </div>
    </div>
  );
}

export function VistaRubricas() {
  const [rubricas, setRubricas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [promptAbierto, setPromptAbierto] = useState(false);
  const [pegarAbierto, setPegarAbierto] = useState(false);
  const [importandoExcel, setImportandoExcel] = useState(false);

  const cargar = () => { setCargando(true); api.fetchRubricasCatalogo().then((d) => { setRubricas(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  const eliminar = async (r) => {
    if (!confirm(`¿Eliminar la rúbrica "${r.nombre}"? Las tareas que ya la usan conservan su copia, esto solo la saca del catálogo para reutilizar.`)) return;
    await api.eliminarRubricaCatalogo(r.id);
    cargar();
  };

  // Exporta todas las rúbricas del catálogo a un Excel — una fila por cada
  // combinación de rúbrica/criterio/nivel, fácil de editar y volver a importar.
  const exportarExcel = () => {
    if (rubricas.length === 0) { alert("Todavía no tenés rúbricas para exportar."); return; }
    const filas = [];
    rubricas.forEach((r) => {
      r.criterios.forEach((c) => {
        c.niveles.forEach((n) => {
          filas.push({ Rúbrica: r.nombre, Criterio: c.criterio, Nivel: n.nombre, Puntos: n.puntos });
        });
      });
    });
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Rúbricas");
    XLSX.writeFile(libro, "rubricas_codice.xlsx");
  };

  // Importa desde un Excel con las mismas columnas que exporta la función de
  // arriba (Rúbrica / Criterio / Nivel / Puntos) — agrupa filas por rúbrica
  // y por criterio, respetando el orden en que aparecen.
  const importarExcel = (file) => {
    setImportandoExcel(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "binary" });
        const hoja = wb.Sheets[wb.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json(hoja);
        const porRubrica = {};
        filas.forEach((f) => {
          const nombreR = String(f["Rúbrica"] || f["Rubrica"] || "").trim();
          const nombreC = String(f["Criterio"] || "").trim();
          const nombreN = String(f["Nivel"] || "").trim();
          const puntos = parseFloat(f["Puntos"]) || 0;
          if (!nombreR || !nombreC || !nombreN) return;
          porRubrica[nombreR] = porRubrica[nombreR] || {};
          porRubrica[nombreR][nombreC] = porRubrica[nombreR][nombreC] || [];
          porRubrica[nombreR][nombreC].push({ nombre: nombreN, puntos });
        });
        const nombresRubricas = Object.keys(porRubrica);
        if (nombresRubricas.length === 0) { alert("No encontré filas válidas — revisá que el Excel tenga las columnas Rúbrica, Criterio, Nivel y Puntos."); setImportandoExcel(false); return; }
        if (!confirm(`Encontré ${nombresRubricas.length} rúbrica(s): ${nombresRubricas.join(", ")}. ¿Las agrego a tu catálogo?`)) { setImportandoExcel(false); return; }
        for (const nombreR of nombresRubricas) {
          const criterios = Object.entries(porRubrica[nombreR]).map(([criterio, niveles]) => ({ criterio, niveles }));
          await api.crearRubricaCatalogo(nombreR, criterios);
        }
        cargar();
      } catch (err) {
        alert("No se pudo leer el archivo: " + err.message);
      }
      setImportandoExcel(false);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🎯 Rúbricas</h2>
          <p className="text-sm text-slate-400">Armá tus rúbricas una sola vez acá, y después cargalas en cualquier proyecto, taller, o columna de la Planilla.</p>
        </div>
        <button onClick={() => { setEditando(null); setFormAbierto((v) => !v); }} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white shrink-0">
          {formAbierto ? "Cerrar" : "+ Nueva rúbrica"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setPromptAbierto(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-violet-200 text-violet-600">🤖 Prompt de IA</button>
        <button onClick={() => setPegarAbierto(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-emerald-200 text-emerald-600">📋 Pegar desde IA</button>
        <button onClick={exportarExcel} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">📤 Exportar a Excel</button>
        <label className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 cursor-pointer">
          {importandoExcel ? "Importando…" : "📥 Importar de Excel"}
          <input type="file" accept=".xlsx,.xls" className="hidden" disabled={importandoExcel}
            onChange={(e) => { if (e.target.files[0]) importarExcel(e.target.files[0]); e.target.value = ""; }} />
        </label>
      </div>

      {promptAbierto && <PromptIaRubricasModal onClose={() => setPromptAbierto(false)} />}
      {pegarAbierto && <PegarDeIaModal onClose={() => setPegarAbierto(false)} onImportadas={() => { setPegarAbierto(false); cargar(); }} />}

      {formAbierto && (
        <RubricaCatalogoForm rubrica={editando} onCancelar={() => { setFormAbierto(false); setEditando(null); }}
          onGuardado={() => { setFormAbierto(false); setEditando(null); cargar(); }} />
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : rubricas.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">Todavía no tenés rúbricas guardadas.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {rubricas.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-100 p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-slate-800">{r.nombre}</h4>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => { setEditando(r); setFormAbierto(true); }} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
                  <button onClick={() => eliminar(r)} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
                </div>
              </div>
              <div className="space-y-1">
                {r.criterios.map((c, i) => (
                  <div key={i} className="text-xs text-slate-500">
                    <b>{c.criterio}</b> — {c.niveles.map((n) => `${n.nombre} (${n.puntos})`).join(", ")}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
