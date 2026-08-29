import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { EditorTexto, TextoEnriquecido } from "../components/RichText";

// Analiza el texto que la IA devolvió (siguiendo la estructura del prompt
// de 6 secciones) e intenta separarlo en los campos del formulario. Es un
// "mejor esfuerzo" — si algo no lo detecta bien, el campo queda vacío y se
// completa a mano; nunca hace fallar la carga.
function analizarRespuestaIA(textoCompleto) {
  const limpiar = (s) => (s || "").replace(/\*\*/g, "").replace(/^[:\s]+/, "").trim();

  const seccionRegex = (nombre) => new RegExp(`(?:^|\\n)\\s*#{0,3}\\s*\\*{0,2}\\s*\\d*\\.?\\s*${nombre}[^\\n]*`, "i");

  const extraerSeccion = (texto, inicioRe, finRes) => {
    const mInicio = texto.match(inicioRe);
    if (!mInicio) return "";
    const desde = mInicio.index + mInicio[0].length;
    let hasta = texto.length;
    finRes.forEach((re) => {
      const m = texto.slice(desde).match(re);
      if (m) hasta = Math.min(hasta, desde + m.index);
    });
    return texto.slice(desde, hasta).trim();
  };

  const extraerCampo = (texto, etiquetas, siguientes) => {
    for (const etq of etiquetas) {
      const re = new RegExp(`\\*{0,2}${etq}\\*{0,2}\\s*:?\\s*`, "i");
      const m = texto.match(re);
      if (m) {
        const desde = m.index + m[0].length;
        let hasta = texto.length;
        siguientes.forEach((sig) => {
          const re2 = new RegExp(`\\*{0,2}${sig}\\*{0,2}\\s*:?`, "i");
          const m2 = texto.slice(desde).match(re2);
          if (m2) hasta = Math.min(hasta, desde + m2.index);
        });
        return limpiar(texto.slice(desde, hasta));
      }
    }
    return "";
  };

  const reSec1 = seccionRegex("DATOS DE IDENTIFICACI[OÓ]N");
  const reSec2 = seccionRegex("METAS DE APRENDIZAJE");
  const reSec3 = seccionRegex("FUNDAMENTACI[OÓ]N TE[OÓ]RICA");
  const reSec4 = seccionRegex("SECUENCIA DE ACTIVIDADES");
  const reSec5 = seccionRegex("RECURSOS DE APOYO");
  const reSec6 = seccionRegex("R[UÚ]BRICA DE AUTOEVALUACI[OÓ]N");

  const seccion1 = extraerSeccion(textoCompleto, reSec1, [reSec2, reSec3, reSec4, reSec5, reSec6]);
  const seccion2 = extraerSeccion(textoCompleto, reSec2, [reSec3, reSec4, reSec5, reSec6]);
  const seccion3 = extraerSeccion(textoCompleto, reSec3, [reSec4, reSec5, reSec6]);
  const seccion4 = extraerSeccion(textoCompleto, reSec4, [reSec5, reSec6]);
  const seccion5 = extraerSeccion(textoCompleto, reSec5, [reSec6]);
  const seccion6 = extraerSeccion(textoCompleto, reSec6, []);

  const titulo = extraerCampo(seccion1, ["T[ií]tulo de la Unidad\\s*/?\\s*Tema"], ["Nivel", "Docente", "Tiempo Estimado"]);
  const tiempoEstimado = extraerCampo(seccion1, ["Tiempo Estimado"], []);

  const propositoGeneral = extraerCampo(seccion2, ["Prop[oó]sito General"], ["Desempe[nñ]o", "Aprendizaje Esperado", "Criterios de Evaluaci[oó]n"]);
  const objetivo = extraerCampo(seccion2, ["Desempe[nñ]o\\s*/?\\s*Aprendizaje Esperado", "Aprendizaje Esperado"], ["Criterios de Evaluaci[oó]n"]);
  const criteriosEvaluacion = extraerCampo(seccion2, ["Criterios de Evaluaci[oó]n"], []);

  const esEncabezadoTabla = (s) => /^-+$/.test(s) || /^(criterio|logrado|en proceso|proceso|por mejorar|mejorar|concepto\s*clave|t[eé]rmino)$/i.test(s.trim());

  const idxConceptos = seccion3.search(/Conceptos?\s+Clave/i);
  const contenido = limpiar(idxConceptos >= 0 ? seccion3.slice(0, idxConceptos) : seccion3);
  const bloqueConceptos = idxConceptos >= 0 ? seccion3.slice(idxConceptos) : "";
  let conceptosClave = [...bloqueConceptos.matchAll(/\|\s*([^\|\n]+?)\s*\|\s*([^\|\n]+?)\s*\|/g)]
    .map(([, termino, definicion]) => ({ termino: limpiar(termino), definicion: limpiar(definicion) }))
    .filter((c) => c.termino && !esEncabezadoTabla(c.termino));
  if (conceptosClave.length === 0) {
    conceptosClave = [...bloqueConceptos.matchAll(/[-*]\s*\*{0,2}([^:*\n]+?)\*{0,2}\s*:\s*([^\n]+)/g)]
      .map(([, termino, definicion]) => ({ termino: limpiar(termino), definicion: limpiar(definicion) }));
  }

  const faseExploracion = extraerCampo(seccion4, ["Fase de Exploraci[oó]n[^:]*"], ["Fase de Aplicaci[oó]n", "Fase de Transferencia"]);
  const faseAplicacion = extraerCampo(seccion4, ["Fase de Aplicaci[oó]n[^:]*"], ["Fase de Transferencia"]);
  const faseTransferencia = extraerCampo(seccion4, ["Fase de Transferencia[^:]*"], []);

  const lecturaPrincipal = extraerCampo(seccion5, ["Lectura Principal"], ["Material Multimedia", "Enlaces", "Herramientas Sugeridas"]);
  const materialMultimedia = extraerCampo(seccion5, ["Material Multimedia\\s*/?\\s*Enlaces"], ["Herramientas Sugeridas"]);
  const herramientasSugeridas = extraerCampo(seccion5, ["Herramientas Sugeridas"], []);

  const idxPreguntas = seccion6.search(/Preguntas?\s+de\s+Reflexi[oó]n/i);
  const bloqueRubrica = idxPreguntas >= 0 ? seccion6.slice(0, idxPreguntas) : seccion6;
  const bloquePreguntas = idxPreguntas >= 0 ? seccion6.slice(idxPreguntas) : "";
  const rubricaCriterios = [...bloqueRubrica.matchAll(/\|\s*([^\|\n]+?)\s*\|/g)]
    .map(([, criterio]) => limpiar(criterio))
    .filter((c) => c && !esEncabezadoTabla(c))
    .map((criterio) => ({ criterio }));
  const preguntasReflexion = [...bloquePreguntas.matchAll(/(?:\d+[.)]|[-*])\s*([^\n]+)/g)]
    .map(([, texto]) => limpiar(texto))
    .filter((p) => p && !/preguntas? de reflexi/i.test(p))
    .map((texto) => ({ texto }));

  return {
    titulo: titulo || null, tiempo_estimado: tiempoEstimado || null,
    proposito_general: propositoGeneral || null, objetivo: objetivo || null, criterios_evaluacion: criteriosEvaluacion || null,
    contenido: contenido || null, conceptos_clave: conceptosClave,
    fase_exploracion: faseExploracion || null, fase_aplicacion: faseAplicacion || null, fase_transferencia: faseTransferencia || null,
    lectura_principal: lecturaPrincipal || null, material_multimedia: materialMultimedia || null, herramientas_sugeridas: herramientasSugeridas || null,
    rubrica_criterios: rubricaCriterios,
    preguntas_reflexion: preguntasReflexion.length > 0 ? preguntasReflexion : undefined,
  };
}

function PegarDeIaModal({ onClose, onAnalizado }) {
  const [texto, setTexto] = useState("");

  const analizar = () => {
    if (!texto.trim()) { alert("Pegá acá el texto que te devolvió la IA."); return; }
    const datos = analizarRespuestaIA(texto);
    const huboAlgo = Object.values(datos).some((v) => (Array.isArray(v) ? v.length > 0 : !!v));
    if (!huboAlgo) {
      if (!confirm("No pude reconocer ninguna sección con el formato esperado — ¿igual querés abrir el formulario vacío para completarlo a mano?")) return;
    }
    onAnalizado(datos);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-2xl shadow-xl">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-slate-800">📋 Pegar lo que devolvió la IA</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Pegá acá **todo** lo que te devolvió Claude (u otra IA) con el prompt de las 6 secciones — voy a intentar separarlo automáticamente en los campos del formulario. Después vas a poder revisar y ajustar todo antes de guardar.
        </p>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={14} placeholder="Pegá acá la respuesta completa de la IA…"
          className="w-full text-xs rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
          <button onClick={analizar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white">Analizar y llenar formulario</button>
        </div>
      </div>
    </div>
  );
}

function PromptIaModal({ onClose }) {
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => { api.fetchPromptIaGuias().then((t) => { setTexto(t); setCargando(false); }); }, []);

  const copiar = () => {
    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await api.guardarPromptIaGuias(texto);
      setEditando(false);
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  const restablecer = async () => {
    if (!confirm("¿Volver al prompt original de fábrica? Esto reemplaza cualquier ajuste que le hayas hecho.")) return;
    setTexto(api.PROMPT_IA_GUIAS_DEFAULT);
    await api.guardarPromptIaGuias(api.PROMPT_IA_GUIAS_DEFAULT);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-slate-800">🤖 Prompt de IA para generar Guías de Estudio</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Copiá este texto y pegalo en Claude (u otra IA), completando los datos entre corchetes — te va a devolver una guía lista para pasar campo por campo al formulario de acá arriba.
        </p>

        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : editando ? (
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={20}
            className="w-full text-xs font-mono rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />
        ) : (
          <pre className="text-xs bg-slate-50 rounded-lg p-3 mb-3 whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">{texto}</pre>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button onClick={restablecer} className="text-xs text-rose-500 px-3 py-2">🗑️ Restablecer al original</button>
          {editando ? (
            <>
              <button onClick={() => setEditando(false)} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
              <button disabled={guardando} onClick={guardar} className="text-xs font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
                {guardando ? "Guardando…" : "Guardar cambios"}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditando(true)} className="text-xs font-semibold px-4 py-2 rounded-lg border border-slate-200 text-slate-600">✏️ Editar</button>
              <button onClick={copiar} className="text-xs font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white">
                {copiado ? "✔ Copiado" : "📋 Copiar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Editor de una lista dinámica de filas (agregar/quitar), usado para
// Conceptos Clave, Criterios de la Rúbrica y Preguntas de Reflexión.
function ListaEditable({ filas, onCambiar, campos, placeholder }) {
  const agregar = () => onCambiar([...filas, Object.fromEntries(campos.map((c) => [c.key, ""]))]);
  const quitar = (i) => onCambiar(filas.filter((_, idx) => idx !== i));
  const actualizar = (i, key, valor) => onCambiar(filas.map((f, idx) => (idx === i ? { ...f, [key]: valor } : f)));

  return (
    <div className="mb-2">
      {filas.map((fila, i) => (
        <div key={i} className="flex gap-1.5 mb-1.5">
          {campos.map((c) => (
            <input key={c.key} value={fila[c.key] || ""} onChange={(e) => actualizar(i, c.key, e.target.value)}
              placeholder={c.placeholder} className={`${c.ancho || "flex-1"} text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white`} />
          ))}
          <button onClick={() => quitar(i)} className="text-slate-400 hover:text-rose-500 text-xs px-1">✕</button>
        </div>
      ))}
      <button onClick={agregar} className="text-xs text-violet-500">+ {placeholder}</button>
    </div>
  );
}

function GuiaForm({ materiaId, gradoId, periodo, guia, onCancelar, onGuardada }) {
  const [titulo, setTitulo] = useState(guia?.titulo || "");
  const [tiempoEstimado, setTiempoEstimado] = useState(guia?.tiempo_estimado || "");
  const [propositoGeneral, setPropositoGeneral] = useState(guia?.proposito_general || "");
  const [objetivo, setObjetivo] = useState(guia?.objetivo || "");
  const [criteriosEvaluacion, setCriteriosEvaluacion] = useState(guia?.criterios_evaluacion || "");
  const [contenido, setContenido] = useState(guia?.contenido || "");
  const [conceptosClave, setConceptosClave] = useState(guia?.conceptos_clave?.length ? guia.conceptos_clave : []);
  const [faseExploracion, setFaseExploracion] = useState(guia?.fase_exploracion || "");
  const [faseAplicacion, setFaseAplicacion] = useState(guia?.fase_aplicacion || "");
  const [faseTransferencia, setFaseTransferencia] = useState(guia?.fase_transferencia || "");
  const [lecturaPrincipal, setLecturaPrincipal] = useState(guia?.lectura_principal || "");
  const [materialMultimedia, setMaterialMultimedia] = useState(guia?.material_multimedia || "");
  const [herramientasSugeridas, setHerramientasSugeridas] = useState(guia?.herramientas_sugeridas || "");
  const [rubricaCriterios, setRubricaCriterios] = useState(guia?.rubrica_criterios?.length ? guia.rubrica_criterios : []);
  const [preguntasReflexion, setPreguntasReflexion] = useState(guia?.preguntas_reflexion?.length ? guia.preguntas_reflexion : [
    { texto: "¿Cuál fue el concepto o actividad más desafiante y qué estrategia utilicé para resolverlo?" },
    { texto: "¿Qué dudas o temas requieren una tutoría o profundización adicional?" },
  ]);
  const [fechaEntrega, setFechaEntrega] = useState(guia?.fecha_entrega || "");
  const [publicada, setPublicada] = useState(guia?.publicada ?? true);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!titulo.trim()) { alert("Ponele un título a la guía."); return; }
    setGuardando(true);
    try {
      const campos = {
        titulo: titulo.trim(), tiempo_estimado: tiempoEstimado || null,
        proposito_general: propositoGeneral || null, objetivo: objetivo || null, criterios_evaluacion: criteriosEvaluacion || null,
        contenido: contenido || null, conceptos_clave: conceptosClave.filter((c) => c.termino?.trim()),
        fase_exploracion: faseExploracion || null, fase_aplicacion: faseAplicacion || null, fase_transferencia: faseTransferencia || null,
        lectura_principal: lecturaPrincipal || null, material_multimedia: materialMultimedia || null, herramientas_sugeridas: herramientasSugeridas || null,
        rubrica_criterios: rubricaCriterios.filter((c) => c.criterio?.trim()),
        preguntas_reflexion: preguntasReflexion.filter((p) => p.texto?.trim()),
        fecha_entrega: fechaEntrega || null, publicada,
        materia_id: materiaId, grado_id: gradoId, periodo,
      };
      if (guia?.id) await api.editarGuiaEstudio(guia.id, campos);
      else await api.crearGuiaEstudio(campos);
      onGuardada();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-xl p-3 mb-3 space-y-3">
      {/* 1. Datos de identificación */}
      <div>
        <div className="text-[10px] font-bold text-violet-600 uppercase tracking-wide mb-1.5">1. Datos de identificación</div>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título de la Unidad / Tema"
          className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
        <div className="grid grid-cols-2 gap-2">
          <input value={tiempoEstimado} onChange={(e) => setTiempoEstimado(e.target.value)} placeholder="Tiempo estimado (ej: 3 horas)"
            className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
          <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
      </div>

      {/* 2. Metas de aprendizaje y competencias */}
      <div>
        <div className="text-[10px] font-bold text-violet-600 uppercase tracking-wide mb-1.5">2. Metas de aprendizaje y competencias</div>
        <label className="text-xs text-slate-500 block mb-1">Propósito general (1-2 oraciones)</label>
        <textarea value={propositoGeneral} onChange={(e) => setPropositoGeneral(e.target.value)} rows={2}
          className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
        <label className="text-xs text-slate-500 block mb-1">Desempeño / Aprendizaje esperado</label>
        <div className="mb-2"><EditorTexto value={objetivo} onChange={setObjetivo} minHeight={60} placeholder="Verbo de acción + contenido + contexto…" /></div>
        <label className="text-xs text-slate-500 block mb-1">Criterios de evaluación</label>
        <div className="mb-1"><EditorTexto value={criteriosEvaluacion} onChange={setCriteriosEvaluacion} minHeight={50} placeholder="Indicadores específicos que evidencian el nivel de dominio…" /></div>
      </div>

      {/* 3. Fundamentación teórica y conceptos clave */}
      <div>
        <div className="text-[10px] font-bold text-violet-600 uppercase tracking-wide mb-1.5">3. Fundamentación teórica y conceptos clave</div>
        <div className="mb-2"><EditorTexto value={contenido} onChange={setContenido} minHeight={90} placeholder="Síntesis clara y estructurada del tema…" /></div>
        <label className="text-xs text-slate-500 block mb-1">Conceptos clave</label>
        <ListaEditable filas={conceptosClave} onCambiar={setConceptosClave} placeholder="Agregar concepto"
          campos={[{ key: "termino", placeholder: "Término", ancho: "w-32" }, { key: "definicion", placeholder: "Definición / aplicación" }]} />
      </div>

      {/* 4. Secuencia de actividades */}
      <div>
        <div className="text-[10px] font-bold text-violet-600 uppercase tracking-wide mb-1.5">4. Secuencia de actividades y práctica guiada</div>
        <label className="text-xs text-slate-500 block mb-1">Fase de exploración y comprensión</label>
        <div className="mb-2"><EditorTexto value={faseExploracion} onChange={setFaseExploracion} minHeight={50} placeholder="Pregunta de reflexión inicial o lectura dirigida…" /></div>
        <label className="text-xs text-slate-500 block mb-1">Fase de aplicación y análisis</label>
        <div className="mb-2"><EditorTexto value={faseAplicacion} onChange={setFaseAplicacion} minHeight={70} placeholder="Ejercicio práctico, caso, problema o cuadro comparativo…" /></div>
        <label className="text-xs text-slate-500 block mb-1">Fase de transferencia / creación</label>
        <div className="mb-1"><EditorTexto value={faseTransferencia} onChange={setFaseTransferencia} minHeight={60} placeholder="Síntesis, propuesta, argumentación o producto final…" /></div>
      </div>

      {/* 5. Recursos de apoyo */}
      <div>
        <div className="text-[10px] font-bold text-violet-600 uppercase tracking-wide mb-1.5">5. Recursos de apoyo y material complementario</div>
        <input value={lecturaPrincipal} onChange={(e) => setLecturaPrincipal(e.target.value)} placeholder="Lectura principal (referencia, capítulo, páginas)"
          className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
        <input value={materialMultimedia} onChange={(e) => setMaterialMultimedia(e.target.value)} placeholder="Material multimedia / enlaces"
          className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
        <input value={herramientasSugeridas} onChange={(e) => setHerramientasSugeridas(e.target.value)} placeholder="Herramientas sugeridas (software, plataformas)"
          className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
      </div>

      {/* 6. Rúbrica de autoevaluación */}
      <div>
        <div className="text-[10px] font-bold text-violet-600 uppercase tracking-wide mb-1.5">6. Rúbrica de autoevaluación y metacognición</div>
        <label className="text-xs text-slate-500 block mb-1">Criterios de desempeño (el estudiante marca Logrado / En proceso / Por mejorar)</label>
        <ListaEditable filas={rubricaCriterios} onCambiar={setRubricaCriterios} placeholder="Agregar criterio"
          campos={[{ key: "criterio", placeholder: "Ej: Comprendo y explico con claridad los conceptos centrales" }]} />
        <label className="text-xs text-slate-500 block mb-1">Preguntas de reflexión final</label>
        <ListaEditable filas={preguntasReflexion} onCambiar={setPreguntasReflexion} placeholder="Agregar pregunta"
          campos={[{ key: "texto", placeholder: "Pregunta de reflexión" }]} />
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={publicada} onChange={(e) => setPublicada(e.target.checked)} /> Visible para los estudiantes
      </label>

      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-1.5">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : guia?.id ? "Guardar cambios" : "Crear guía"}
        </button>
      </div>
    </div>
  );
}

function imprimirGuia(guia, institucion) {
  const filaConcepto = (c) => `<tr><td style="border:1px solid #ccc; padding:6px; font-weight:bold; width:25%;">${c.termino}</td><td style="border:1px solid #ccc; padding:6px;">${c.definicion || ""}</td></tr>`;
  const filaRubrica = (c) => `<tr><td style="border:1px solid #ccc; padding:6px;">${c.criterio}</td><td style="border:1px solid #ccc; padding:6px; text-align:center; width:70px;">☐</td><td style="border:1px solid #ccc; padding:6px; text-align:center; width:70px;">☐</td><td style="border:1px solid #ccc; padding:6px; text-align:center; width:70px;">☐</td></tr>`;

  const ventana = window.open("", "_blank");
  ventana.document.write(`
    <html><head><title>${guia.titulo}</title></head>
    <body style="font-family: Arial, sans-serif; padding: 30px; font-size: 13px; line-height: 1.5;">
      <div style="display:flex; align-items:center; gap:12px; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:16px;">
        ${institucion?.logo_url ? `<img src="${institucion.logo_url}" style="height:55px;" />` : ""}
        <div style="flex:1; text-align:center;">
          <div style="font-weight:bold; font-size:15px;">${institucion?.nombre || "INSTITUCIÓN EDUCATIVA"}</div>
          <div style="font-weight:bold; margin-top:4px; font-size:13px;">GUÍA DE ESTUDIO PEDAGÓGICA</div>
        </div>
      </div>

      <h2 style="margin-bottom:4px;">${guia.titulo}</h2>
      <p style="color:#555; margin-top:0;">${guia.tiempo_estimado ? `⏱ ${guia.tiempo_estimado}` : ""}${guia.fecha_entrega ? ` · 📅 Entrega: ${guia.fecha_entrega}` : ""}</p>

      ${guia.proposito_general || guia.objetivo || guia.criterios_evaluacion ? `
        <h3 style="border-bottom:1px solid #ccc; padding-bottom:3px;">2. Metas de Aprendizaje y Competencias</h3>
        ${guia.proposito_general ? `<p><b>Propósito General:</b> ${guia.proposito_general}</p>` : ""}
        ${guia.objetivo ? `<p><b>Desempeño / Aprendizaje Esperado:</b></p><div>${guia.objetivo}</div>` : ""}
        ${guia.criterios_evaluacion ? `<p><b>Criterios de Evaluación:</b></p><div>${guia.criterios_evaluacion}</div>` : ""}
      ` : ""}

      ${guia.contenido || (guia.conceptos_clave && guia.conceptos_clave.length > 0) ? `
        <h3 style="border-bottom:1px solid #ccc; padding-bottom:3px;">3. Fundamentación Teórica y Conceptos Clave</h3>
        ${guia.contenido ? `<div>${guia.contenido}</div>` : ""}
        ${guia.conceptos_clave && guia.conceptos_clave.length > 0 ? `
          <table style="border-collapse:collapse; width:100%; margin-top:8px;">
            <tr><th style="border:1px solid #ccc; padding:6px; background:#f3f4f6;">Concepto Clave</th><th style="border:1px solid #ccc; padding:6px; background:#f3f4f6;">Definición / Aplicación</th></tr>
            ${guia.conceptos_clave.map(filaConcepto).join("")}
          </table>` : ""}
      ` : ""}

      ${guia.fase_exploracion || guia.fase_aplicacion || guia.fase_transferencia ? `
        <h3 style="border-bottom:1px solid #ccc; padding-bottom:3px;">4. Secuencia de Actividades y Práctica Guiada</h3>
        ${guia.fase_exploracion ? `<p><b>Fase de Exploración y Comprensión:</b></p><div>${guia.fase_exploracion}</div>` : ""}
        ${guia.fase_aplicacion ? `<p><b>Fase de Aplicación y Análisis:</b></p><div>${guia.fase_aplicacion}</div>` : ""}
        ${guia.fase_transferencia ? `<p><b>Fase de Transferencia / Creación:</b></p><div>${guia.fase_transferencia}</div>` : ""}
      ` : ""}

      ${guia.lectura_principal || guia.material_multimedia || guia.herramientas_sugeridas ? `
        <h3 style="border-bottom:1px solid #ccc; padding-bottom:3px;">5. Recursos de Apoyo y Material Complementario</h3>
        ${guia.lectura_principal ? `<p><b>Lectura Principal:</b> ${guia.lectura_principal}</p>` : ""}
        ${guia.material_multimedia ? `<p><b>Material Multimedia / Enlaces:</b> ${guia.material_multimedia}</p>` : ""}
        ${guia.herramientas_sugeridas ? `<p><b>Herramientas Sugeridas:</b> ${guia.herramientas_sugeridas}</p>` : ""}
      ` : ""}

      ${(guia.rubrica_criterios && guia.rubrica_criterios.length > 0) || (guia.preguntas_reflexion && guia.preguntas_reflexion.length > 0) ? `
        <h3 style="border-bottom:1px solid #ccc; padding-bottom:3px;">6. Rúbrica de Autoevaluación y Metacognición</h3>
        ${guia.rubrica_criterios && guia.rubrica_criterios.length > 0 ? `
          <table style="border-collapse:collapse; width:100%; margin-bottom:12px;">
            <tr><th style="border:1px solid #ccc; padding:6px; background:#f3f4f6;">Criterio de Desempeño</th><th style="border:1px solid #ccc; padding:6px; background:#f3f4f6;">Logrado</th><th style="border:1px solid #ccc; padding:6px; background:#f3f4f6;">En Proceso</th><th style="border:1px solid #ccc; padding:6px; background:#f3f4f6;">Por Mejorar</th></tr>
            ${guia.rubrica_criterios.map(filaRubrica).join("")}
          </table>` : ""}
        ${guia.preguntas_reflexion && guia.preguntas_reflexion.length > 0 ? `
          <p><b>Preguntas de Reflexión Final</b></p>
          <ol>${guia.preguntas_reflexion.map((p) => `<li style="margin-bottom:10px;">${p.texto}<br/>_______________________________________________</li>`).join("")}</ol>
        ` : ""}
      ` : ""}

      <script>window.print();</script>
    </body></html>
  `);
  ventana.document.close();
}

export function VistaGuiasEstudio({ grados, gradoActivo }) {
  const [materias, setMaterias] = useState([]);
  const [materiaId, setMateriaId] = useState("");
  const [gradoId, setGradoId] = useState(gradoActivo || grados[0]?.id || "");
  const [periodo, setPeriodo] = useState("1");
  const [guias, setGuias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [institucion, setInstitucion] = useState(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [promptAbierto, setPromptAbierto] = useState(false);

  useEffect(() => { if (gradoActivo) setGradoId(gradoActivo); }, [gradoActivo]);
  const [pegarAbierto, setPegarAbierto] = useState(false);

  useEffect(() => {
    api.fetchMaterias().then((data) => { setMaterias(data); if (data[0]) setMateriaId(data[0].id); });
    api.fetchInstitucion().then(setInstitucion);
  }, []);
  useEffect(() => { if (grados.length && !gradoId) setGradoId(grados[0].id); }, [grados]);

  const cargar = () => {
    if (!materiaId || !gradoId) return;
    setCargando(true);
    api.fetchGuiasEstudio(materiaId, gradoId, periodo).then((d) => { setGuias(d); setCargando(false); });
  };
  useEffect(() => { cargar(); }, [materiaId, gradoId, periodo]);

  const eliminar = async (id) => { if (!confirm("¿Eliminar esta guía de estudio?")) return; await api.eliminarGuiaEstudio(id); cargar(); };

  if (materias.length === 0) {
    return <p className="text-sm text-slate-400">Primero creá al menos una materia (en Calificaciones) para poder armar guías de estudio.</p>;
  }

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">📘 Guías de estudio</h3>
      <p className="text-xs text-slate-400 mb-3">Guía pedagógica completa (identificación, metas, teoría, actividades, recursos y autoevaluación) — visible e imprimible para los estudiantes del curso.</p>

      <div className="flex flex-wrap gap-2 mb-3">
        <select value={materiaId} onChange={(e) => setMateriaId(parseInt(e.target.value, 10))} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {grados.map((g) => <option key={g.id} value={g.id}>Curso {g.id}</option>)}
        </select>
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {["1", "2", "3", "4"].map((p) => <option key={p} value={p}>Periodo {p}</option>)}
        </select>
        <button onClick={() => { setEditando(null); setFormAbierto((v) => !v); }} className="text-xs font-semibold px-3 py-2 rounded-full bg-violet-500 text-white">
          {formAbierto ? "Cerrar" : "+ Nueva guía"}
        </button>
        <button onClick={() => setPromptAbierto(true)} className="text-xs font-semibold px-3 py-2 rounded-full border border-violet-200 text-violet-600">
          🤖 Prompt de IA
        </button>
        <button onClick={() => setPegarAbierto(true)} className="text-xs font-semibold px-3 py-2 rounded-full border border-emerald-200 text-emerald-600">
          📋 Pegar desde IA
        </button>
      </div>

      {promptAbierto && <PromptIaModal onClose={() => setPromptAbierto(false)} />}
      {pegarAbierto && (
        <PegarDeIaModal onClose={() => setPegarAbierto(false)}
          onAnalizado={(datos) => { setEditando(datos); setPegarAbierto(false); setFormAbierto(true); }} />
      )}

      {formAbierto && (
        <GuiaForm materiaId={materiaId} gradoId={gradoId} periodo={periodo} guia={editando}
          onCancelar={() => { setFormAbierto(false); setEditando(null); }}
          onGuardada={() => { setFormAbierto(false); setEditando(null); cargar(); }} />
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : guias.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">Todavía no hay guías para esta materia/curso/periodo.</p>
      ) : (
        <div className="space-y-2">
          {guias.map((g) => (
            <div key={g.id} className="bg-white rounded-xl border border-slate-100 p-3">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-700">{g.titulo}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {g.publicada ? "🟢 Visible para estudiantes" : "⚪ Borrador (no visible)"}
                    {g.tiempo_estimado ? ` · ⏱ ${g.tiempo_estimado}` : ""}
                    {g.fecha_entrega ? ` · Entrega: ${g.fecha_entrega}` : ""}
                  </div>
                  {g.proposito_general && <p className="text-xs text-slate-500 mt-1.5">{g.proposito_general}</p>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => imprimirGuia(g, institucion)} className="text-xs text-slate-400 hover:text-violet-600">🖨️</button>
                  <button onClick={() => { setEditando(g); setFormAbierto(true); }} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
                  <button onClick={() => eliminar(g.id)} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Rúbrica interactiva: el estudiante marca cada criterio y contesta las
// preguntas de reflexión — se guarda solo, sin botón de "enviar" único.
function AutoevaluacionInteractiva({ guia, estudianteId }) {
  const [respuestas, setRespuestas] = useState({});
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.fetchAutoevaluacionGuia(guia.id, estudianteId).then((r) => { setRespuestas(r); setCargando(false); });
  }, [guia.id, estudianteId]);

  const marcarCriterio = (i, estado) => {
    const nuevo = { ...respuestas, criterios: { ...(respuestas.criterios || {}), [i]: estado } };
    setRespuestas(nuevo);
    api.guardarAutoevaluacionGuia(guia.id, estudianteId, nuevo);
  };

  const responderPregunta = (i, texto) => {
    const nuevo = { ...respuestas, reflexiones: { ...(respuestas.reflexiones || {}), [i]: texto } };
    setRespuestas(nuevo);
  };
  const guardarPregunta = () => api.guardarAutoevaluacionGuia(guia.id, estudianteId, respuestas);

  if (cargando) return null;

  return (
    <div className="mt-4 bg-violet-50 rounded-xl p-3">
      <h4 className="text-sm font-bold text-slate-700 mb-2">✅ Mi autoevaluación</h4>
      {guia.rubrica_criterios?.map((c, i) => (
        <div key={i} className="mb-2 bg-white rounded-lg p-2">
          <p className="text-xs text-slate-600 mb-1.5">{c.criterio}</p>
          <div className="flex gap-1.5">
            {["Logrado", "En proceso", "Por mejorar"].map((estado) => (
              <button key={estado} onClick={() => marcarCriterio(i, estado)}
                className={`text-[11px] px-2 py-1 rounded-full ${respuestas.criterios?.[i] === estado ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                {estado}
              </button>
            ))}
          </div>
        </div>
      ))}
      {guia.preguntas_reflexion?.map((p, i) => (
        <div key={i} className="mb-2">
          <label className="text-xs text-slate-600 block mb-1">{p.texto}</label>
          <textarea value={respuestas.reflexiones?.[i] || ""} onChange={(e) => responderPregunta(i, e.target.value)} onBlur={guardarPregunta}
            rows={2} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
        </div>
      ))}
    </div>
  );
}

export function GuiasEstudiante({ gradoId, estudianteId }) {
  const [guias, setGuias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [abierta, setAbierta] = useState(null);

  useEffect(() => {
    if (!gradoId) return;
    api.fetchGuiasEstudioParaGrado(gradoId).then((d) => { setGuias(d); setCargando(false); });
  }, [gradoId]);

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;

  if (abierta) {
    return (
      <div>
        <button onClick={() => setAbierta(null)} className="text-sm text-violet-500 mb-3">← Volver</button>
        <h3 className="font-bold text-slate-800 mb-1">{abierta.titulo}</h3>
        <p className="text-xs text-slate-400 mb-3">
          {abierta.materias?.nombre}{abierta.tiempo_estimado ? ` · ⏱ ${abierta.tiempo_estimado}` : ""}{abierta.fecha_entrega ? ` · 📅 Entrega: ${abierta.fecha_entrega}` : ""}
        </p>

        {abierta.proposito_general && <p className="text-sm text-slate-600 italic mb-3">{abierta.proposito_general}</p>}

        {abierta.objetivo && (<><h4 className="text-sm font-bold text-slate-700 mt-3">🎯 Aprendizaje esperado</h4><TextoEnriquecido html={abierta.objetivo} className="text-sm text-slate-600" /></>)}
        {abierta.criterios_evaluacion && (<><h4 className="text-sm font-bold text-slate-700 mt-3">✔️ Criterios de evaluación</h4><TextoEnriquecido html={abierta.criterios_evaluacion} className="text-sm text-slate-600" /></>)}

        {abierta.contenido && (<><h4 className="text-sm font-bold text-slate-700 mt-3">📚 Fundamentación teórica</h4><TextoEnriquecido html={abierta.contenido} className="text-sm text-slate-600" /></>)}
        {abierta.conceptos_clave?.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {abierta.conceptos_clave.map((c, i) => (
              <div key={i} className="bg-slate-50 rounded-lg p-2">
                <span className="text-xs font-bold text-violet-600">{c.termino}: </span>
                <span className="text-xs text-slate-600">{c.definicion}</span>
              </div>
            ))}
          </div>
        )}

        {abierta.fase_exploracion && (<><h4 className="text-sm font-bold text-slate-700 mt-3">🔍 Para empezar</h4><TextoEnriquecido html={abierta.fase_exploracion} className="text-sm text-slate-600" /></>)}
        {abierta.fase_aplicacion && (<><h4 className="text-sm font-bold text-slate-700 mt-3">✏️ Manos a la obra</h4><TextoEnriquecido html={abierta.fase_aplicacion} className="text-sm text-slate-600" /></>)}
        {abierta.fase_transferencia && (<><h4 className="text-sm font-bold text-slate-700 mt-3">🚀 Para ir más allá</h4><TextoEnriquecido html={abierta.fase_transferencia} className="text-sm text-slate-600" /></>)}

        {(abierta.lectura_principal || abierta.material_multimedia || abierta.herramientas_sugeridas) && (
          <>
            <h4 className="text-sm font-bold text-slate-700 mt-3">📎 Recursos</h4>
            {abierta.lectura_principal && <p className="text-xs text-slate-600 mt-1"><b>Lectura:</b> {abierta.lectura_principal}</p>}
            {abierta.material_multimedia && <p className="text-xs text-slate-600 mt-1"><b>Multimedia:</b> {abierta.material_multimedia}</p>}
            {abierta.herramientas_sugeridas && <p className="text-xs text-slate-600 mt-1"><b>Herramientas:</b> {abierta.herramientas_sugeridas}</p>}
          </>
        )}

        {estudianteId && (abierta.rubrica_criterios?.length > 0 || abierta.preguntas_reflexion?.length > 0) && (
          <AutoevaluacionInteractiva guia={abierta} estudianteId={estudianteId} />
        )}
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-3">📘 Guías de estudio</h3>
      {guias.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">Todavía no hay guías de estudio publicadas.</p>
      ) : (
        <div className="space-y-2">
          {guias.map((g) => (
            <button key={g.id} onClick={() => setAbierta(g)} className="w-full text-left bg-white rounded-xl border border-slate-100 p-3 hover:border-violet-200">
              <div className="text-sm font-semibold text-slate-700">{g.titulo}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{g.materias?.nombre}{g.tiempo_estimado ? ` · ⏱ ${g.tiempo_estimado}` : ""}{g.fecha_entrega ? ` · Entrega: ${g.fecha_entrega}` : ""}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
