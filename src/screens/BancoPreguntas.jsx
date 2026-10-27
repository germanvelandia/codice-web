import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import * as api from "../lib/api";
import { agruparPorNivel } from "../lib/gamification";

function ImportarExcelModal({ materiaId, niveles, nivelInicial = "", onClose, onImportado }) {
  const [nivelPorDefecto, setNivelPorDefecto] = useState(nivelInicial || "");
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

        if (normalizadas.length === 0) { alert("No se encontraron filas con enunciado. Revisa que uses la plantilla."); setProcesando(false); return; }

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
              Descarga la plantilla, completa una fila por pregunta (tema, enunciado, las 4 opciones y cuál es la correcta) y súbela.
              Si todas las preguntas del archivo son del mismo grado, elígelo aquí abajo — así no hace falta ponerlo fila por fila.
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

function PreguntaBancoForm({ materiaId, niveles, pregunta, nivelInicial = "", temaInicial = "", onCancelar, onGuardada }) {
  const [nivel, setNivel] = useState(pregunta?.nivel || nivelInicial || "");
  const [tema, setTema] = useState(pregunta?.tema || temaInicial || "");
  const [enunciado, setEnunciado] = useState(pregunta?.enunciado || "");
  const [opciones, setOpciones] = useState(pregunta?.opciones?.map((o) => o.texto) || ["", "", "", ""]);
  const [correcta, setCorrecta] = useState(pregunta ? pregunta.opciones.findIndex((o) => o.correcta) : 0);
  const [dificultad, setDificultad] = useState(pregunta?.dificultad || "");
  const [retroalimentacion, setRetroalimentacion] = useState(pregunta?.retroalimentacion || "");
  const [guardando, setGuardando] = useState(false);

  const cambiarOpcion = (i, v) => setOpciones((prev) => prev.map((o, idx) => idx === i ? v : o));

  const guardar = async () => {
    const limpias = opciones.map((o) => o.trim()).filter(Boolean);
    if (!enunciado.trim() || limpias.length < 2) { alert("Completa el enunciado y al menos 2 opciones."); return; }
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
    if (!cambiarMateria && !cambiarNivel && !cambiarTema) { alert("Elige al menos un campo para cambiar."); return; }
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
        <p className="text-xs text-slate-500 mb-3">Marca solo lo que quieras cambiar; lo que no marques queda igual.</p>

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


/* ---------- Utilidades de organización ---------- */
const sinTildes = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const PALETA = [
  { borde: "#7c3aed", fondo: "#f5f3ff", icono: "📘" }, { borde: "#0ea5e9", fondo: "#f0f9ff", icono: "📗" },
  { borde: "#f59e0b", fondo: "#fffbeb", icono: "📙" }, { borde: "#10b981", fondo: "#ecfdf5", icono: "📕" },
  { borde: "#ec4899", fondo: "#fdf2f8", icono: "📓" }, { borde: "#6366f1", fondo: "#eef2ff", icono: "📔" },
];
const ICONOS_MATERIA = [[/etica|valor/, "⚖️"], [/relig/, "🕊️"], [/filos/, "🦉"], [/mate/, "📐"], [/cienc|biol|quim|fisi/, "🔬"], [/lengu|liter|casted/, "📖"], [/social|histor/, "🌍"], [/ingl/, "🔤"], [/arte|art/, "🎨"], [/tecno|inform/, "💻"]];
const iconoMateria = (n, i) => ICONOS_MATERIA.find(([r]) => r.test(sinTildes(n)))?.[1] || PALETA[i % PALETA.length].icono;
const DIF = { facil: { l: "Fácil", c: "#22c55e" }, media: { l: "Media", c: "#f59e0b" }, dificil: { l: "Difícil", c: "#ef4444" } };

function BarraDificultad({ items }) {
  const t = items.length || 1; const n = (k) => items.filter((p) => p.dificultad === k).length; const sin = items.length - n("facil") - n("media") - n("dificil");
  return (
    <div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100">
        {["facil", "media", "dificil"].map((k) => <div key={k} style={{ width: `${(n(k) / t) * 100}%`, background: DIF[k].c }} />)}
        <div style={{ width: `${(sin / t) * 100}%`, background: "#cbd5e1" }} />
      </div>
      <div className="flex gap-2 mt-1 text-[9px] text-slate-400">
        {["facil", "media", "dificil"].map((k) => n(k) > 0 && <span key={k}><span style={{ color: DIF[k].c }}>●</span> {n(k)}</span>)}
        {sin > 0 && <span>○ {sin} sin nivel</span>}
      </div>
    </div>
  );
}

function Tarjeta({ icono, titulo, sub, total, extra, color, onClick, onEditar, destacada }) {
  return (
    <div className="relative group">
      <button onClick={onClick} className="w-full text-left rounded-2xl p-3.5 border bg-white hover:shadow-md transition-shadow" style={{ borderColor: color?.borde || "#e2e8f0", borderLeftWidth: 5, background: destacada ? "#fff7ed" : "#fff" }}>
        <div className="flex items-start justify-between gap-2">
          <div className="text-2xl leading-none">{icono}</div>
          <div className="text-right"><div className="text-xl font-extrabold text-slate-800 leading-none">{total}</div><div className="text-[9px] text-slate-400">pregunta{total !== 1 ? "s" : ""}</div></div>
        </div>
        <div className="mt-2 text-sm font-bold text-slate-800 leading-tight">{titulo}</div>
        {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
        {extra && <div className="mt-2">{extra}</div>}
      </button>
      {onEditar && <button onClick={onEditar} title="Renombrar o unir" className="absolute bottom-1.5 right-1.5 text-[11px] text-slate-400 hover:text-violet-600 opacity-0 group-hover:opacity-100 bg-white border border-slate-200 rounded-full w-6 h-6">✏️</button>}
    </div>
  );
}

// Unifica varios nombres de tema (con tildes, mayúsculas o espacios distintos) bajo uno solo
function RenombrarTemaModal({ grupo, onClose, onHecho }) {
  const [nombre, setNombre] = useState(grupo.etiqueta);
  const [guardando, setGuardando] = useState(false);
  const guardar = async () => {
    setGuardando(true);
    try { await api.trasladarPreguntasBanco(grupo.items.map((p) => p.id), { tema: nombre.trim() || null }); onHecho(); }
    catch (e) { alert("No se pudo guardar: " + e.message); }
    setGuardando(false);
  };
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
        <h3 className="font-bold text-slate-800 mb-1">✏️ Renombrar tema</h3>
        <p className="text-xs text-slate-500 mb-3">Cambia el nombre de las {grupo.items.length} preguntas de este tema.{grupo.variantes.length > 1 ? ` Hoy está escrito de ${grupo.variantes.length} formas: ${grupo.variantes.map((v) => `«${v}»`).join(", ")}.` : ""}</p>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" autoFocus />
        <p className="text-[11px] text-slate-400 mt-1">Si escribes el nombre de otro tema que ya existe, se unen en uno solo.</p>
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onClose} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
          <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

export function VistaBancoPreguntas({ grados = [] }) {
  const [materias, setMaterias] = useState([]);
  const [indice, setIndice] = useState(null); // todas las preguntas, solo campos de ubicación
  const [ruta, setRuta] = useState({ materiaId: null, nivel: null, temaKey: null, soloLista: false }); // nivel: "" = sin grado
  const [preguntas, setPreguntas] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [importarAbierto, setImportarAbierto] = useState(false);
  const [seleccionando, setSeleccionando] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [trasladarAbierto, setTrasladarAbierto] = useState(false);
  const [renombrar, setRenombrar] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroDif, setFiltroDif] = useState("");
  const niveles = agruparPorNivel(grados);

  const cargarIndice = async () => {
    const [mis, todas, idx] = await Promise.all([api.fetchMisMaterias(), api.fetchMaterias(), api.fetchIndiceBanco()]);
    const ids = new Set(idx.map((p) => String(p.materia_id)));
    const lista = [...mis];
    todas.forEach((m) => { if (ids.has(String(m.id)) && !lista.some((x) => String(x.id) === String(m.id))) lista.push(m); });
    setMaterias(lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))); setIndice(idx);
  };
  useEffect(() => { cargarIndice().catch(() => setIndice([])); }, []);

  const materia = materias.find((m) => String(m.id) === String(ruta.materiaId));
  const enMateria = useMemo(() => (indice || []).filter((p) => String(p.materia_id) === String(ruta.materiaId)), [indice, ruta.materiaId]);
  const enNivel = useMemo(() => ruta.nivel === null ? enMateria : enMateria.filter((p) => String(p.nivel || "") === ruta.nivel), [enMateria, ruta.nivel]);

  const gruposTema = useMemo(() => {
    const mapa = {};
    enNivel.forEach((p) => {
      const k = p.tema && p.tema.trim() ? sinTildes(p.tema) : "";
      mapa[k] = mapa[k] || { key: k, items: [], cuentas: {} };
      mapa[k].items.push(p); if (k) mapa[k].cuentas[p.tema.trim()] = (mapa[k].cuentas[p.tema.trim()] || 0) + 1;
    });
    return Object.values(mapa).map((g) => {
      const variantes = Object.keys(g.cuentas).sort((a, b) => g.cuentas[b] - g.cuentas[a]);
      return { ...g, etiqueta: variantes[0] || "Sin tema", variantes };
    }).sort((a, b) => (a.key === "" ? 1 : b.key === "" ? -1 : a.etiqueta.localeCompare(b.etiqueta, "es")));
  }, [enNivel]);

  // Preguntas completas solo cuando se llega al último nivel
  const enLista = ruta.temaKey !== null || ruta.soloLista;
  const cargarLista = () => {
    if (!enLista || !ruta.materiaId) return;
    setCargandoLista(true);
    api.fetchBancoPreguntas(ruta.materiaId, null, ruta.nivel ? ruta.nivel : null).then((d) => { setPreguntas(d); setCargandoLista(false); }).catch(() => setCargandoLista(false));
  };
  useEffect(() => { cargarLista(); setSeleccionadas([]); setBusqueda(""); setFiltroDif(""); }, [ruta.materiaId, ruta.nivel, ruta.temaKey, ruta.soloLista]);
  const refrescar = () => { cargarIndice(); cargarLista(); };

  const visibles = useMemo(() => {
    let l = preguntas;
    if (ruta.nivel === "") l = l.filter((p) => !p.nivel);
    if (ruta.temaKey !== null) l = l.filter((p) => (p.tema && p.tema.trim() ? sinTildes(p.tema) : "") === ruta.temaKey);
    if (filtroDif) l = l.filter((p) => (p.dificultad || "") === filtroDif);
    if (busqueda.trim()) { const q = sinTildes(busqueda); l = l.filter((p) => sinTildes(p.enunciado).includes(q) || sinTildes(p.tema).includes(q)); }
    return l;
  }, [preguntas, ruta, filtroDif, busqueda]);

  const eliminar = async (p) => { if (!confirm("¿Eliminar esta pregunta del banco?")) return; await api.eliminarPreguntaBanco(p.id); refrescar(); };
  const toggleSeleccion = (id) => setSeleccionadas((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const eliminarSeleccionadas = async () => {
    if (!confirm(`¿Eliminar ${seleccionadas.length} pregunta(s) seleccionada(s)?`)) return;
    await api.eliminarPreguntasBancoMasivo(seleccionadas); setSeleccionadas([]); setSeleccionando(false); refrescar();
  };

  const irMateria = (id) => setRuta({ materiaId: id, nivel: null, temaKey: null, soloLista: false });
  const irNivel = (n) => setRuta((r) => ({ ...r, nivel: n, temaKey: null, soloLista: false }));
  const irTema = (k) => setRuta((r) => ({ ...r, temaKey: k, soloLista: false }));
  const nivelesDe = (items) => {
    const m = {}; items.forEach((p) => { const k = p.nivel ? String(p.nivel) : ""; (m[k] = m[k] || []).push(p); });
    return Object.entries(m).sort((a, b) => (a[0] === "" ? 1 : b[0] === "" ? -1 : parseInt(a[0], 10) - parseInt(b[0], 10)));
  };
  const temaActual = ruta.temaKey !== null ? gruposTema.find((g) => g.key === ruta.temaKey) : null;
  const etiquetaNivel = (n) => (n === "" ? "Sin grado" : `Grado ${n}°`);

  if (indice === null) return <div className="text-sm text-slate-400">Cargando banco…</div>;
  if (materias.length === 0) return <p className="text-sm text-slate-400">Primero crea al menos una materia (en Calificaciones) para poder armar el banco de preguntas.</p>;

  const nivel = ruta.materiaId === null ? 0 : ruta.nivel === null ? 1 : (ruta.temaKey === null && !ruta.soloLista) ? 2 : 3;
  const migas = [{ t: "🗂️ Banco", f: () => setRuta({ materiaId: null, nivel: null, temaKey: null, soloLista: false }) }];
  if (nivel >= 1) migas.push({ t: materia?.nombre || "Materia", f: () => irMateria(ruta.materiaId) });
  if (nivel >= 2) migas.push({ t: etiquetaNivel(ruta.nivel), f: () => irNivel(ruta.nivel) });
  if (nivel === 3) migas.push({ t: ruta.soloLista ? "Todas" : (temaActual?.etiqueta || "Tema"), f: null });

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">🗂️ Banco de preguntas</h3>
      <p className="text-xs text-slate-400 mb-3">Entra por tarjetas: asignatura → grado → temática. Al crear una evaluación puedes pedir «N preguntas al azar de este banco».</p>

      <div className="flex flex-wrap items-center gap-1 text-xs mb-3">
        {migas.map((m, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-slate-300">›</span>}
            {m.f ? <button onClick={m.f} className="text-violet-600 hover:underline font-semibold">{m.t}</button> : <span className="text-slate-700 font-bold">{m.t}</span>}
          </React.Fragment>
        ))}
        <div className="flex-1" />
        {nivel >= 1 && <>
          <button onClick={() => setImportarAbierto(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-violet-200 text-violet-600">📥 Importar Excel</button>
          <button onClick={() => { setEditando(null); setFormAbierto((v) => !v); }} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">{formAbierto ? "Cerrar" : "+ Nueva pregunta"}</button>
        </>}
      </div>

      {formAbierto && nivel >= 1 && (
        <PreguntaBancoForm materiaId={ruta.materiaId} niveles={niveles} pregunta={editando} nivelInicial={ruta.nivel || ""} temaInicial={temaActual?.etiqueta && temaActual.key ? temaActual.etiqueta : ""}
          onCancelar={() => { setFormAbierto(false); setEditando(null); }} onGuardada={() => { setFormAbierto(false); setEditando(null); refrescar(); }} />
      )}

      {/* NIVEL 0: asignaturas */}
      {nivel === 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {materias.map((m, i) => {
              const items = indice.filter((p) => String(p.materia_id) === String(m.id));
              const grs = nivelesDe(items);
              return <Tarjeta key={m.id} icono={iconoMateria(m.nombre, i)} titulo={m.nombre} total={items.length} color={PALETA[i % PALETA.length]} onClick={() => irMateria(m.id)}
                sub={grs.length ? `${grs.filter(([k]) => k).length} grado(s)${grs.some(([k]) => !k) ? " + sin grado" : ""}` : "Aún sin preguntas"}
                extra={items.length > 0 && <BarraDificultad items={items} />} />;
            })}
          </div>
          {indice.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Todavía no hay preguntas. Entra a una asignatura para agregarlas o importarlas desde Excel.</p>}
        </>
      )}

      {/* NIVEL 1: grados de la materia */}
      {nivel === 1 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {nivelesDe(enMateria).map(([n, items], i) => (
              <Tarjeta key={n || "sin"} icono={n ? "🎓" : "📥"} titulo={etiquetaNivel(n)} total={items.length} color={PALETA[(parseInt(n, 10) || 0) % PALETA.length]} destacada={!n}
                sub={`${new Set(items.map((p) => (p.tema && p.tema.trim() ? sinTildes(p.tema) : null)).filter(Boolean)).size} tema(s)${!n ? " · por clasificar" : ""}`}
                onClick={() => irNivel(n)} extra={<BarraDificultad items={items} />} />
            ))}
            <Tarjeta icono="📋" titulo="Ver todas" total={enMateria.length} sub="Lista completa con buscador" onClick={() => setRuta((r) => ({ ...r, nivel: null, temaKey: null, soloLista: true }))} />
          </div>
          {enMateria.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Esta asignatura aún no tiene preguntas. Usa «+ Nueva pregunta» o «📥 Importar Excel».</p>}
        </>
      )}

      {/* NIVEL 2: temáticas del grado */}
      {nivel === 2 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {gruposTema.map((g, i) => (
            <Tarjeta key={g.key || "sin"} icono={g.key ? "🏷️" : "❓"} titulo={g.etiqueta} total={g.items.length} color={PALETA[i % PALETA.length]} destacada={!g.key}
              sub={!g.key ? "Por clasificar" : g.variantes.length > 1 ? `⚠️ escrito de ${g.variantes.length} formas` : null}
              onClick={() => irTema(g.key)} onEditar={g.key ? () => setRenombrar(g) : null} extra={<BarraDificultad items={g.items} />} />
          ))}
          <Tarjeta icono="📋" titulo="Ver todas" total={enNivel.length} sub="De este grado, con buscador" onClick={() => setRuta((r) => ({ ...r, soloLista: true }))} />
        </div>
      )}

      {/* NIVEL 3: lista de preguntas */}
      {nivel === 3 && (
        <>
          <div className="flex flex-wrap gap-2 mb-3 items-center">
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="🔍 Buscar en el enunciado…" className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white flex-1 min-w-[10rem]" />
            <select value={filtroDif} onChange={(e) => setFiltroDif(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
              <option value="">Toda dificultad</option><option value="facil">Fácil</option><option value="media">Media</option><option value="dificil">Difícil</option>
            </select>
            <button onClick={() => { setSeleccionando((v) => !v); setSeleccionadas([]); }} className={`text-xs font-semibold px-3 py-2 rounded-full border ${seleccionando ? "bg-slate-700 text-white border-slate-700" : "border-slate-200 text-slate-600"}`}>{seleccionando ? "✕ Cancelar selección" : "☑️ Seleccionar"}</button>
          </div>
          {seleccionando && visibles.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-slate-50 rounded-xl p-2.5 mb-3">
              <span className="text-xs text-slate-500">{seleccionadas.length} seleccionada(s)</span>
              <button onClick={() => setSeleccionadas(visibles.map((p) => p.id))} className="text-xs text-violet-500">Seleccionar todas ({visibles.length})</button>
              <button onClick={() => setSeleccionadas([])} className="text-xs text-slate-400">Ninguna</button>
              <div className="flex-1" />
              <button disabled={seleccionadas.length === 0} onClick={() => setTrasladarAbierto(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-500 text-white disabled:opacity-40">↗️ Trasladar / clasificar</button>
              <button disabled={seleccionadas.length === 0} onClick={eliminarSeleccionadas} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-rose-500 text-white disabled:opacity-40">🗑 Eliminar</button>
            </div>
          )}
          {cargandoLista ? <div className="text-sm text-slate-400">Cargando…</div> : visibles.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No hay preguntas con ese filtro.</p>
          ) : (
            <>
              <p className="text-xs text-slate-400 mb-2">{visibles.length} pregunta(s)</p>
              <div className="space-y-2">
                {visibles.map((p) => (
                  <div key={p.id} className={`bg-white rounded-xl border p-3 ${seleccionando && seleccionadas.includes(p.id) ? "border-violet-400 bg-violet-50/40" : "border-slate-200"}`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        {seleccionando && <input type="checkbox" checked={seleccionadas.includes(p.id)} onChange={() => toggleSeleccion(p.id)} className="mt-1 shrink-0" />}
                        <div>
                          {p.nivel && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 mr-1.5">Grado {p.nivel}°</span>}
                          {p.tema && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 mr-1.5">{p.tema}</span>}
                          {p.dificultad && <span className="text-[10px] px-2 py-0.5 rounded-full text-white" style={{ background: DIF[p.dificultad]?.c || "#94a3b8" }}>{DIF[p.dificultad]?.l || p.dificultad}</span>}
                          <p className="text-sm text-slate-700 mt-1">{p.enunciado}</p>
                        </div>
                      </div>
                      {!seleccionando && (
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => { setEditando(p); setFormAbierto(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
                          <button onClick={() => eliminar(p)} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {p.opciones.map((o, i) => <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full ${o.correcta ? "bg-emerald-100 text-emerald-700 font-semibold" : "bg-slate-100 text-slate-500"}`}>{o.correcta ? "✓ " : ""}{o.texto}</span>)}
                    </div>
                    {p.retroalimentacion && <p className="text-[11px] text-slate-400 mt-2 italic">💡 {p.retroalimentacion}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {importarAbierto && <ImportarExcelModal materiaId={ruta.materiaId} niveles={niveles} nivelInicial={ruta.nivel || ""} onClose={() => setImportarAbierto(false)} onImportado={refrescar} />}
      {trasladarAbierto && (
        <TrasladarPreguntasModal ids={seleccionadas} materias={materias} niveles={niveles} onClose={() => setTrasladarAbierto(false)}
          onTrasladado={() => { setTrasladarAbierto(false); setSeleccionadas([]); setSeleccionando(false); refrescar(); }} />
      )}
      {renombrar && <RenombrarTemaModal grupo={renombrar} onClose={() => setRenombrar(null)} onHecho={() => { setRenombrar(null); refrescar(); }} />}
    </div>
  );
}
