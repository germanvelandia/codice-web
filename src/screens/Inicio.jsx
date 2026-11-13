import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import * as api from "../lib/api";
import { FotoLightbox } from "./Estudiantes";

const DIAS_NOMBRE = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const TIPO_EVENTO_COLOR = { institucional: "#2F55A4", academico: "#28478a", convivencial: "#17264D", festivo: "#F59E0B", otro: "#64748B" };

export function ContenidoLightbox({ html, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.75)" }} onClick={onClose}>
      <div style={{ maxWidth: "min(85vw, 500px)", maxHeight: "85vh", overflow: "auto" }} className="bg-white rounded-2xl shadow-2xl p-2" onClick={(e) => e.stopPropagation()} dangerouslySetInnerHTML={{ __html: html }} />
      <button onClick={onClose} className="absolute top-4 right-4 text-white text-2xl">✕</button>
    </div>,
    document.body
  );
}

const MESES_NOMBRE = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS_CORTOS = ["D", "L", "M", "M", "J", "V", "S"];

export function CalendarioPlaneaciones({ onAbrirBitacora }) {
  const [horario, setHorario] = useState(null);
  const [mesVisto, setMesVisto] = useState(() => { const h = new Date(); return { anio: h.getFullYear(), mes: h.getMonth() }; });
  const [selectorDia, setSelectorDia] = useState(null); // { fecha, clases: [...] }

  useEffect(() => { api.fetchHorarioDelDocente().then(setHorario); }, []);

  const diasConClase = new Set((horario || []).map((h) => h.dia_semana));

  const hoy = new Date();
  const primerDiaMes = new Date(mesVisto.anio, mesVisto.mes, 1);
  const diasEnMes = new Date(mesVisto.anio, mesVisto.mes + 1, 0).getDate();
  const offsetInicio = primerDiaMes.getDay(); // 0=domingo

  const celdas = [];
  for (let i = 0; i < offsetInicio; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d);

  const cambiarMes = (delta) => {
    setMesVisto((prev) => {
      const nuevaFecha = new Date(prev.anio, prev.mes + delta, 1);
      return { anio: nuevaFecha.getFullYear(), mes: nuevaFecha.getMonth() };
    });
  };

  const clickDia = (d) => {
    const fechaCelda = new Date(mesVisto.anio, mesVisto.mes, d);
    const clasesDelDia = (horario || []).filter((h) => h.dia_semana === fechaCelda.getDay());
    if (clasesDelDia.length === 0) return;
    const fechaISO = `${fechaCelda.getFullYear()}-${String(fechaCelda.getMonth() + 1).padStart(2, "0")}-${String(fechaCelda.getDate()).padStart(2, "0")}`;
    if (clasesDelDia.length === 1) {
      const h = clasesDelDia[0];
      onAbrirBitacora({ gradoId: h.grado_id, materiaId: h.materia_id || null, materiaNombre: h.materias?.nombre, fecha: fechaISO });
    } else {
      setSelectorDia({ fecha: fechaISO, clases: clasesDelDia });
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 h-full relative">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => cambiarMes(-1)} className="text-slate-400 hover:text-violet-600 px-1">‹</button>
        <div className="text-sm font-bold text-slate-800">{MESES_NOMBRE[mesVisto.mes]} {mesVisto.anio}</div>
        <button onClick={() => cambiarMes(1)} className="text-slate-400 hover:text-violet-600 px-1">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {DIAS_CORTOS.map((d, i) => <div key={i} className="text-[9px] font-bold text-slate-400">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celdas.map((d, i) => {
          if (d === null) return <div key={i} />;
          const fechaCelda = new Date(mesVisto.anio, mesVisto.mes, d);
          const esHoy = fechaCelda.toDateString() === hoy.toDateString();
          const tieneClase = diasConClase.has(fechaCelda.getDay());
          return (
            <button key={i} onClick={() => clickDia(d)} disabled={!tieneClase} className="flex flex-col items-center py-1 rounded-lg hover:bg-violet-50 disabled:hover:bg-transparent">
              <div className={`w-6 h-6 flex items-center justify-center rounded-full text-[11px] ${esHoy ? "bg-violet-500 text-white font-bold" : "text-slate-600"}`}>{d}</div>
              {tieneClase && <div className={`w-1 h-1 rounded-full mt-0.5 ${esHoy ? "bg-violet-500" : "bg-violet-300"}`} />}
            </button>
          );
        })}
      </div>
      <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-violet-300" /> Día con clase planeada — tocá un día para su bitácora
      </div>

      {selectorDia && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setSelectorDia(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-xs shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-bold text-slate-800">¿Qué clase?</h4>
              <button onClick={() => setSelectorDia(null)} className="text-slate-400">✕</button>
            </div>
            <div className="space-y-1.5">
              {selectorDia.clases.map((h) => (
                <button key={h.id} onClick={() => { onAbrirBitacora({ gradoId: h.grado_id, materiaId: h.materia_id || null, materiaNombre: h.materias?.nombre, fecha: selectorDia.fecha }); setSelectorDia(null); }}
                  className="w-full text-left text-xs bg-slate-50 hover:bg-violet-50 rounded-lg px-3 py-2">
                  <span className="font-semibold text-slate-700">{h.materias?.nombre || "Sin materia"}</span>
                  <span className="text-slate-400"> · Grado {h.grado_id}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Tarjeta de una entrada de bitácora (una clase ya registrada).
function TarjetaBitacora({ entrada, onEditar, onEliminar }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3.5">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="text-xs font-bold text-violet-600">{new Date(entrada.fecha + "T00:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}</div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onEditar(entrada)} className="text-xs text-slate-300 hover:text-violet-600">✏️</button>
          <button onClick={() => onEliminar(entrada)} className="text-xs text-slate-300 hover:text-rose-500">🗑</button>
        </div>
      </div>
      {entrada.tema && <div className="text-sm font-bold text-slate-800 mb-1">📖 {entrada.tema}</div>}
      {entrada.actividades_realizadas && <p className="text-xs text-slate-600 mb-1 whitespace-pre-line">{entrada.actividades_realizadas}</p>}
      {entrada.observaciones && <p className="text-xs text-slate-400 italic whitespace-pre-line">{entrada.observaciones}</p>}
    </div>
  );
}

// Modal principal de la bitácora — lista las entradas anteriores como
// tarjetas, y permite agregar una nueva para la fecha indicada.
export function BitacoraClaseModal({ gradoId, materiaId, materiaNombre, fechaInicial, onCerrar }) {
  const [entradas, setEntradas] = useState(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [fecha, setFecha] = useState(fechaInicial);
  const [tema, setTema] = useState("");
  const [actividades, setActividades] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = () => api.fetchBitacorasDeClase(gradoId, materiaId).then(setEntradas);
  useEffect(() => { cargar(); }, [gradoId, materiaId]);

  const abrirNueva = () => {
    setEditando(null); setFecha(fechaInicial); setTema(""); setActividades(""); setObservaciones("");
    setFormAbierto(true);
  };
  const abrirEditar = (e) => {
    setEditando(e); setFecha(e.fecha); setTema(e.tema || ""); setActividades(e.actividades_realizadas || ""); setObservaciones(e.observaciones || "");
    setFormAbierto(true);
  };

  const guardar = async () => {
    if (!tema.trim() && !actividades.trim()) { alert("Contá al menos el tema o qué se hizo en la clase."); return; }
    setGuardando(true);
    try {
      const campos = { grado_id: gradoId, materia_id: materiaId || null, fecha, tema: tema.trim() || null, actividades_realizadas: actividades.trim() || null, observaciones: observaciones.trim() || null };
      if (editando) await api.editarBitacoraClase(editando.id, campos);
      else await api.crearBitacoraClase(campos);
      setFormAbierto(false);
      cargar();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  const eliminar = async (e) => {
    if (!confirm("¿Eliminar esta entrada de la bitácora?")) return;
    await api.eliminarBitacoraClase(e.id);
    cargar();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onCerrar}>
      <div onClick={(e) => e.stopPropagation()} className="bg-slate-50 rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-bold text-slate-800">📔 Bitácora de clase</h3>
          <button onClick={onCerrar} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-400 mb-4">Grado {gradoId}{materiaNombre ? ` · ${materiaNombre}` : ""}</p>

        {formAbierto ? (
          <div className="bg-white rounded-2xl border border-violet-200 p-4 mb-4">
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Tema visto</label>
            <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ej: Ecuaciones de primer grado"
              className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Qué se hizo</label>
            <textarea value={actividades} onChange={(e) => setActividades(e.target.value)} rows={3} placeholder="Actividades realizadas en la clase"
              className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none resize-none" />
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Observaciones (opcional)</label>
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} placeholder="Cómo salió, qué faltó, para retomar la próxima"
              className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none resize-none" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setFormAbierto(false)} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
              <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
                {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Agregar entrada"}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={abrirNueva} className="w-full text-sm font-semibold py-2.5 rounded-2xl border-2 border-dashed border-violet-200 text-violet-500 mb-4 hover:bg-violet-50">
            + Agregar lo que se hizo hoy
          </button>
        )}

        {entradas === null ? (
          <p className="text-xs text-slate-400">Cargando…</p>
        ) : entradas.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">Todavía no hay entradas en esta bitácora.</p>
        ) : (
          <div className="space-y-2">
            {entradas.map((e) => <TarjetaBitacora key={e.id} entrada={e} onEditar={abrirEditar} onEliminar={eliminar} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function ValorSemanaCard() {
  const [valor, setValor] = useState(null);
  const [editando, setEditando] = useState(false);
  const [ampliado, setAmpliado] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [imagenUrl, setImagenUrl] = useState(null);
  const [htmlContenido, setHtmlContenido] = useState("");
  const [modo, setModo] = useState("archivo"); // "archivo" | "html"
  const [guardando, setGuardando] = useState(false);

  const cargar = () => api.fetchValorSemanal().then((v) => {
    setValor(v); setNombre(v.nombre || ""); setDescripcion(v.descripcion || "");
    setImagenUrl(v.imagen_url || null); setHtmlContenido(v.html_contenido || "");
    setModo(v.html_contenido ? "html" : "archivo");
  });
  useEffect(() => { cargar(); }, []);

  const subirImagen = (file) => {
    if (file.size > 500 * 1024) { alert("La imagen es muy grande. Usa una de menos de 500 KB, o mejor usá la opción de código HTML para imágenes más grandes."); return; }
    const reader = new FileReader();
    reader.onload = (e) => setImagenUrl(e.target.result);
    reader.readAsDataURL(file);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await api.guardarValorSemanal({
        nombre: nombre.trim() || null, descripcion: descripcion.trim() || null,
        imagen_url: modo === "archivo" ? imagenUrl : null,
        html_contenido: modo === "html" ? htmlContenido.trim() || null : null,
      });
      setEditando(false);
      cargar();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  if (!valor) return null;

  if (editando) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4">
        <div className="font-bold text-slate-800 mb-3">🌟 Valor de la semana</div>

        <div className="flex gap-1 rounded-full bg-violet-50 p-1 w-fit mb-3">
          <button onClick={() => setModo("archivo")} className={`text-xs px-3 py-1.5 rounded-full ${modo === "archivo" ? "bg-violet-500 text-white" : "text-slate-600"}`}>🖼️ Subir archivo</button>
          <button onClick={() => setModo("html")} className={`text-xs px-3 py-1.5 rounded-full ${modo === "html" ? "bg-violet-500 text-white" : "text-slate-600"}`}>🔤 Código HTML</button>
        </div>

        {modo === "archivo" ? (
          <div className="flex items-center gap-3 mb-3">
            <input type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) subirImagen(e.target.files[0]); }} className="text-xs flex-1" />
            {imagenUrl && <button onClick={() => setImagenUrl(null)} className="text-xs text-rose-500">Quitar</button>}
          </div>
        ) : (
          <div className="mb-3">
            <label className="text-xs text-slate-500 block mb-1">Pegá el código HTML de la imagen (ej: {"<img src=\"https://...\">"})</label>
            <textarea value={htmlContenido} onChange={(e) => setHtmlContenido(e.target.value)} rows={3} placeholder='<img src="https://ejemplo.com/imagen.jpg">'
              className="w-full text-xs font-mono rounded-lg px-3 py-2 border border-slate-200 outline-none" />
            <p className="text-[11px] text-slate-400 mt-1">Sin límite de tamaño — la imagen se muestra en su proporción real, sin recortarse.</p>
          </div>
        )}

        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del valor (ej: Respeto)"
          className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none" />
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} placeholder="Descripción (opcional)"
          className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditando(false)} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
          <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col items-center text-center gap-2 h-full">
      <div className="w-full flex justify-between items-start">
        <div className="text-[10px] font-bold text-violet-500 uppercase tracking-wide">Valor de la semana</div>
        <button onClick={() => setEditando(true)} className="text-xs text-slate-400 hover:text-violet-600 shrink-0">✏️</button>
      </div>
      {valor.html_contenido ? (
        <div className="rounded-xl overflow-hidden cursor-pointer" style={{ maxWidth: 120 }} onClick={() => setAmpliado(true)} dangerouslySetInnerHTML={{ __html: valor.html_contenido }} />
      ) : (
        <div className="rounded-xl overflow-hidden shrink-0" style={{ width: 64, height: 64, background: "#E8EEF8" }}>
          {valor.imagen_url ? (
            <img src={valor.imagen_url} alt={valor.nombre || "Valor de la semana"} onClick={() => setAmpliado(true)} className="w-full h-full object-contain cursor-pointer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl">🌟</div>
          )}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-base font-bold text-slate-800 truncate">{valor.nombre || "Sin definir todavía"}</div>
        {valor.descripcion && <div className="text-xs text-slate-500 mt-0.5">{valor.descripcion}</div>}
      </div>
      {ampliado && valor.html_contenido && <ContenidoLightbox html={valor.html_contenido} onClose={() => setAmpliado(false)} />}
      {ampliado && !valor.html_contenido && valor.imagen_url && <FotoLightbox url={valor.imagen_url} nombre={valor.nombre || "Valor de la semana"} onClose={() => setAmpliado(false)} />}
    </div>
  );
}

function CalificarEntradaCodiceForm({ entrada, onCancelar, onCalificado }) {
  const [nota, setNota] = useState(entrada.nota ?? "");
  const [categoriaId, setCategoriaId] = useState(entrada.categoria_id || "");
  const [periodo, setPeriodo] = useState("1");
  const [categorias, setCategorias] = useState([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (entrada.materia_id) {
      api.fetchCategorias(entrada.materia_id).then(setCategorias);
      api.fetchNotasConfig(entrada.materia_id).then((c) => setPeriodo(c.periodo_actual || "1"));
    }
  }, [entrada.materia_id]);

  const guardar = async () => {
    const valor = parseFloat(String(nota).replace(",", "."));
    if (isNaN(valor)) { alert("Escribí una nota válida."); return; }
    setGuardando(true);
    try {
      await api.calificarEntradaCodice(entrada, entrada.estudiante_id, entrada.grado_id, valor, categoriaId || null, entrada.materia_id ? periodo : null);
      onCalificado();
    } catch (e) {
      alert("Error al calificar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-lg p-2 mt-2 flex items-center gap-1.5 flex-wrap">
      <input type="text" inputMode="decimal" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota"
        className="w-16 text-xs text-center rounded px-2 py-1 border border-slate-200 outline-none" />
      {entrada.materia_id && categorias.length > 0 && (
        <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="text-xs rounded px-2 py-1 border border-slate-200 outline-none">
          <option value="">Sin enviar a Calificaciones</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre} (P{periodo})</option>)}
        </select>
      )}
      <button disabled={guardando} onClick={guardar} className="text-xs px-2.5 py-1 rounded bg-violet-500 text-white">{guardando ? "…" : "Guardar"}</button>
      <button onClick={onCancelar} className="text-xs text-slate-400">Cancelar</button>
    </div>
  );
}

function EntradaCodicePendiente({ entrada, onCambio }) {
  const [calificando, setCalificando] = useState(false);

  const marcarRevisada = async () => { await api.marcarCodiceRevisado(entrada.id); onCambio(); };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="text-xs text-slate-400">{entrada.fecha}{entrada.materia_nombre ? ` · ${entrada.materia_nombre}` : ""}</div>
          <div className="text-sm font-bold text-slate-800">{entrada.estudiante_nombre} <span className="text-xs font-normal text-slate-400">· Grado {entrada.grado_id}</span></div>
          {entrada.titulo && <div className="text-xs font-semibold text-slate-600 mt-1">{entrada.titulo}</div>}
          <div className="text-xs text-slate-500 mt-1 whitespace-pre-line">{entrada.contenido}</div>
        </div>
        <button onClick={marcarRevisada} className="text-[10px] text-slate-400 hover:text-emerald-600 shrink-0">✔ Marcar visto</button>
      </div>
      {calificando ? (
        <CalificarEntradaCodiceForm entrada={entrada} onCancelar={() => setCalificando(false)} onCalificado={() => { setCalificando(false); onCambio(); }} />
      ) : (
        <button onClick={() => setCalificando(true)} className="text-[11px] text-violet-500 mt-2">
          {entrada.nota !== null ? `Nota: ${entrada.nota} — editar` : "+ Poner nota"}
        </button>
      )}
    </div>
  );
}

// Página completa (independiente) para revisar las reflexiones del Códice.
export function VistaReflexiones() {
  const [entradas, setEntradas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [curso, setCurso] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [marcando, setMarcando] = useState(false);

  const cargar = () => { setCargando(true); api.fetchEntradasCodiceSinRevisar().then((d) => { setEntradas(d); setCargando(false); }).catch((e) => { setError(e.message || String(e)); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const cursos = [...new Set(entradas.map((e) => e.grado_id).filter(Boolean))].sort();
  const q = norm(busqueda.trim());
  const visibles = entradas.filter((e) => (curso === "todos" || String(e.grado_id) === String(curso)) &&
    (!q || norm(e.estudiante_nombre).includes(q) || norm(e.titulo).includes(q) || norm(e.contenido).includes(q) || norm(e.materia_nombre).includes(q)));
  const porCurso = {};
  visibles.forEach((e) => { (porCurso[e.grado_id || "—"] = porCurso[e.grado_id || "—"] || []).push(e); });

  const marcarTodas = async () => {
    if (!visibles.length) return;
    if (!confirm(`¿Marcar ${visibles.length} reflexión(es) como leídas? Podrás volver a ponerles nota desde la Planilla, pero dejarán de aparecer aquí.`)) return;
    setError(""); setMsg(""); setMarcando(true);
    try {
      const n = await api.marcarCodiceRevisadoLote(visibles.map((e) => e.id));
      setMsg(`✔ ${n} reflexión(es) marcadas como leídas.`);
      cargar();
    } catch (e) { setError("No se pudieron marcar: " + (e.message || e)); }
    setMarcando(false);
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg,#FDECEC,#fff)", border: "1px solid #F5C6C8" }}>
          <div className="text-3xl font-extrabold" style={{ color: "#C92A2F" }}>{entradas.length}</div>
          <div className="text-xs font-bold text-slate-500">Reflexiones sin revisar</div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg,#E8EEF8,#fff)", border: "1px solid #CFDAEE" }}>
          <div className="text-3xl font-extrabold" style={{ color: "#17489C" }}>{cursos.length}</div>
          <div className="text-xs font-bold text-slate-500">Cursos con pendientes</div>
        </div>
        <div className="rounded-2xl p-4 flex items-center" style={{ background: "linear-gradient(135deg,#E7F7EC,#fff)", border: "1px solid #BFE5CD" }}>
          <button onClick={marcarTodas} disabled={!visibles.length || marcando}
            className="w-full text-sm font-extrabold px-4 py-3 rounded-xl text-white disabled:opacity-40" style={{ background: "#1B9A59" }}>
            {marcando ? "Marcando…" : `✔ Marcar todas como leídas (${visibles.length})`}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 flex-1 min-w-[220px]" style={{ border: "1px solid #CFDAEE" }}>
          <span className="text-slate-400">🔍</span>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por estudiante, título o texto…" className="flex-1 text-sm outline-none bg-transparent" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["todos", ...cursos].map((c) => (
            <button key={c} onClick={() => setCurso(c)} className={`text-xs font-bold px-3 py-1.5 rounded-full border ${String(curso) === String(c) ? "text-white border-transparent" : "bg-white text-slate-600 border-slate-200"}`}
              style={String(curso) === String(c) ? { background: "#2F55A4" } : undefined}>{c === "todos" ? "Todos los cursos" : `Curso ${c}`}</button>
          ))}
        </div>
      </div>

      {msg && <div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mb-3">{msg}</div>}
      {error && <div className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2 mb-3">{error}</div>}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : visibles.length === 0 ? (
        <div className="text-sm text-slate-500 bg-slate-50 rounded-2xl p-8 text-center">{entradas.length === 0 ? "No hay reflexiones pendientes. 🎉" : "Ninguna reflexión coincide con el filtro."}</div>
      ) : (
        <div className="space-y-5">
          {Object.keys(porCurso).sort().map((g) => (
            <div key={g}>
              <div className="text-sm font-extrabold italic mb-2" style={{ color: "#17264D" }}>Curso {g} <span className="text-xs not-italic font-bold text-slate-400">· {porCurso[g].length}</span></div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {porCurso[g].map((e) => <EntradaCodicePendiente key={e.id} entrada={e} onCambio={cargar} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Acciones prioritarias: Urgente / En proceso / Completado ----------
function PanelAccionesPrioritarias({ items }) {
  const urgentes = items.filter((i) => i.col === "urgente" && i.n > 0);
  const proceso = items.filter((i) => i.col === "proceso" && i.n > 0);
  const total = urgentes.reduce((t, i) => t + i.n, 0) + proceso.filter((i) => i.label !== "Clases de hoy").reduce((t, i) => t + i.n, 0);
  const alDia = items.filter((i) => i.n === 0).length;
  const Fila = ({ it, color }) => (
    <button onClick={it.onClick} className="w-full flex items-center gap-3 rounded-2xl bg-white/90 px-3 py-2.5 text-left hover:bg-white hover:shadow-sm transition-all" style={{ border: "1px solid #ffffff" }}>
      <span className="relative text-2xl shrink-0">{it.icono}<span className="absolute -top-2 -right-3 min-w-[20px] h-5 px-1 rounded-full text-[11px] font-extrabold text-white flex items-center justify-center" style={{ background: color }}>{it.n}</span></span>
      <span className="flex-1 min-w-0 text-sm font-semibold text-slate-700 leading-tight pl-2">{it.label}</span>
      <span className="text-slate-400">›</span>
    </button>
  );
  const Vacio = ({ t }) => <div className="text-xs text-slate-400 px-3 py-4 text-center">{t}</div>;
  return (
    <div className="mb-5">
      <div className="inline-flex items-center gap-2 rounded-t-2xl px-5 py-2.5 text-white" style={{ background: "linear-gradient(90deg,#17489C,#0F2F6B)" }}>
        <span className="text-xl" style={{ color: "#FFD23F" }}>★</span>
        <span className="font-extrabold text-lg">Tienes <span style={{ color: "#FFD23F" }}>{total}</span> {total === 1 ? "acción prioritaria" : "acciones prioritarias"}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 rounded-b-2xl rounded-tr-2xl p-3 bg-white" style={{ border: "1px solid #DCE6F5" }}>
        <div className="rounded-2xl overflow-hidden" style={{ background: "#FDECEC" }}>
          <div className="flex items-center gap-2 px-4 py-2.5 text-white font-extrabold text-sm" style={{ background: "linear-gradient(90deg,#E5484D,#C92A2F)" }}>❗ URGENTE · Requiere acción inmediata</div>
          <div className="p-3 space-y-2">{urgentes.length ? urgentes.map((i) => <Fila key={i.label} it={i} color="#D92D32" />) : <Vacio t="Nada urgente por ahora 🎉" />}</div>
        </div>
        <div className="rounded-2xl overflow-hidden" style={{ background: "#FFF4DD" }}>
          <div className="flex items-center gap-2 px-4 py-2.5 text-white font-extrabold text-sm" style={{ background: "linear-gradient(90deg,#F5A524,#E08A0B)" }}>▶ EN PROCESO · Seguimiento activo</div>
          <div className="p-3 space-y-2">{proceso.length ? proceso.map((i) => <Fila key={i.label} it={i} color="#EE9A12" />) : <Vacio t="Sin clases ni pendientes en curso" />}</div>
        </div>
        <div className="rounded-2xl overflow-hidden" style={{ background: "#E7F7EC" }}>
          <div className="flex items-center gap-2 px-4 py-2.5 text-white font-extrabold text-sm" style={{ background: "linear-gradient(90deg,#2FB364,#1B9A59)" }}>✔ COMPLETADO · Al día</div>
          <div className="p-5 text-center">
            <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center text-white text-3xl" style={{ background: "#25A85C" }}>✓</div>
            <div className="mt-2 font-extrabold text-slate-700">{total === 0 ? "Sin acciones pendientes" : alDia > 0 ? `${alDia} ${alDia === 1 ? "frente" : "frentes"} al día` : "Aún tienes pendientes"}</div>
            <div className="text-xs text-slate-500">{total === 0 ? "¡Excelente trabajo!" : "Resuélvelos y aparecerán aquí"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VistaInicio({ onIrA, soloEncabezado, accionSuperior, contenidoMedio, rolEtiqueta = "Docente" }) {
  const [stats, setStats] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [nombreDocente, setNombreDocente] = useState("");
  const [pendientesHoy, setPendientesHoy] = useState({});
  const [marcandoId, setMarcandoId] = useState(null);
  const [observacionAbiertaId, setObservacionAbiertaId] = useState(null);
  const [bitacoraAbierta, setBitacoraAbierta] = useState(null); // { gradoId, materiaId, materiaNombre, fecha }
  const [observacionTemp, setObservacionTemp] = useState("");

  useEffect(() => {
    Promise.all([api.fetchStatsDocente(), api.fetchResumenDocente(), api.fetchMiPerfil(), api.fetchResumenEntregasPorRevisar().catch(() => null)]).then(([s, r0, perfil, rev]) => {
      // Los conteos de entregas salen de la misma fuente que la pantalla «Entregas por revisar», para que coincidan.
      const r = rev ? { ...r0, entregasPendientes: rev.evaluaciones.reduce((a, e) => a + e.cantidad, 0), tareasSinCalificar: rev.tareas.reduce((a, t) => a + t.cantidad, 0) } : r0;
      setStats(s); setResumen(r); setNombreDocente(perfil?.nombre || ""); setCargando(false);
      const pares = (r?.clasesHoy || []).filter((h) => h.materia_id && h.grado_id).map((h) => ({ materiaId: h.materia_id, gradoId: h.grado_id, horarioId: h.id }));
      if (pares.length > 0) api.fetchClasesPendientesDeHoy(pares).then(setPendientesHoy);
    });
  }, []);

  const marcarEstado = async (horarioId, gradoId, estado) => {
    const info = pendientesHoy[horarioId];
    if (!info) return;
    setMarcandoId(horarioId);
    try {
      if (info.dictado) {
        await api.editarDictado(info.dictado.id, { estado, fecha: new Date().toISOString().slice(0, 10) });
      } else {
        await api.crearDictado(info.clase.id, gradoId, new Date().toISOString().slice(0, 10), estado);
      }
      const pares = (resumen?.clasesHoy || []).filter((h) => h.materia_id && h.grado_id).map((h) => ({ materiaId: h.materia_id, gradoId: h.grado_id, horarioId: h.id }));
      const actualizado = await api.fetchClasesPendientesDeHoy(pares);
      setPendientesHoy(actualizado);
    } catch (e) {
      alert("Error al marcar: " + e.message);
    }
    setMarcandoId(null);
  };

  const guardarObservacionRapida = async (horarioId) => {
    const info = pendientesHoy[horarioId];
    if (!info?.dictado) { alert("Marcá primero un estado (Dictada/Alterada/Aplazada) antes de agregar la nota."); return; }
    await api.editarDictado(info.dictado.id, { observacion: observacionTemp.trim() || null });
    setObservacionAbiertaId(null);
    const pares = (resumen?.clasesHoy || []).filter((h) => h.materia_id && h.grado_id).map((h) => ({ materiaId: h.materia_id, gradoId: h.grado_id, horarioId: h.id }));
    api.fetchClasesPendientesDeHoy(pares).then(setPendientesHoy);
  };

  const hoy = new Date();
  const fechaLegible = hoy.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const fechaHoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;

  const { level, pctNivel } = (() => {
    const niveles = [0, 100, 300, 600, 1000];
    const idx = niveles.filter((n) => stats.xp >= n).length - 1;
    const actual = niveles[idx] ?? 0;
    const siguiente = niveles[idx + 1];
    const pct = siguiente ? Math.min(100, Math.round(((stats.xp - actual) / (siguiente - actual)) * 100)) : 100;
    return { level: stats.nivel, pctNivel: pct };
  })();

  // Pendientes reales del docente (los mismos datos que ya calcula la plataforma).
  const irSeguro = (k) => () => onIrA && onIrA(k);
  const accionesPrioritarias = [
    { col: "urgente", n: resumen.entregasPendientes || 0, label: "Entregas de evaluaciones por revisar", icono: "📝", onClick: irSeguro("evaluaciones") },
    { col: "urgente", n: resumen.tareasSinCalificar || 0, label: "Proyectos y Forja por calificar", icono: "📖", onClick: irSeguro("entregasrevisar") },
    { col: "urgente", n: resumen.codiceSinRevisar || 0, label: "Reflexiones del Códice sin revisar", icono: "🪞", onClick: irSeguro("reflexiones") },
    { col: "proceso", n: resumen.clasesPendientes || 0, label: "Clases planeadas por dictar", icono: "🗓️", onClick: irSeguro("planeaciones") },
    { col: "proceso", n: (resumen.clasesHoy || []).length, label: "Clases de hoy", icono: "🎓", onClick: irSeguro("asistencia") },
  ];

  return (
    <div>
      {/* Encabezado del panel */}
      <div className="relative rounded-3xl overflow-hidden mb-4" style={{ background: "linear-gradient(120deg, #EAF2FF 0%, #F8FBFF 55%, #FFFFFF 100%)", border: "1px solid #DCE6F5" }}>
        <div aria-hidden className="absolute right-0 top-0 h-full w-[38%] hidden sm:block pointer-events-none" style={{
          background: "radial-gradient(120% 140% at 100% 0%, #FFD23F 0 18%, transparent 18.5%), radial-gradient(130% 150% at 100% 100%, #1B9A59 0 34%, transparent 34.5%), radial-gradient(150% 170% at 100% 100%, #17489C 0 46%, transparent 46.5%)", opacity: 0.9 }} />
        <div className="relative p-5 md:p-6">
          {accionSuperior}
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-extrabold italic" style={{ color: "#17264D" }}>{rolEtiqueta === "Administrador" ? "Panel de administración" : "Panel docente"}</h1>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full" style={{ background: "#E9E4FF", color: "#4C2FB8", border: "1px solid #D3C9FF" }}>🛡️ {rolEtiqueta}</span>
          </div>
          <div className="mt-1 text-lg md:text-xl" style={{ fontFamily: "'Brush Script MT','Segoe Script','Lucida Handwriting',cursive", color: "#17489C" }}>Aprender · Convivir · Construir Futuro</div>
          <div className="mt-2 text-sm text-slate-600">¡Bienvenido de vuelta{nombreDocente ? `, ${nombreDocente}` : ""}! <span className="text-slate-400">· {fechaLegible}</span></div>
        </div>
      </div>

      {/* Acciones prioritarias */}
      <PanelAccionesPrioritarias items={accionesPrioritarias} />

      {contenidoMedio}

      {!soloEncabezado && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <ValorSemanaCard />

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="font-bold text-slate-800 mb-3">Clases de hoy ({DIAS_NOMBRE[hoy.getDay()]})</div>
          {resumen.clasesHoy.length === 0 ? (
            <p className="text-xs text-slate-400">No tenés clases registradas para hoy en tu Horario.</p>
          ) : (
            <div className="space-y-1.5">
              {resumen.clasesHoy.map((h) => {
                const info = pendientesHoy[h.id];
                return (
                  <div key={h.id} className="bg-slate-50 rounded-lg px-2.5 py-1.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-slate-700 min-w-0 break-words">{h.materias?.nombre || h.nombre_actividad || "—"}{h.grado_id ? ` · ${h.grado_id}` : ""}</span>
                      <span className="text-slate-400 shrink-0 whitespace-nowrap">{h.hora_inicio?.slice(0, 5)}–{h.hora_fin?.slice(0, 5)}</span>
                    </div>
                    {info && (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-200">
                        <div className="text-[11px] text-violet-600 font-medium mb-1">📝 {info.clase.titulo}</div>
                        <div className="flex flex-wrap gap-1 items-center">
                          <button disabled={marcandoId === h.id} onClick={() => marcarEstado(h.id, h.grado_id, "dictada")}
                            className={`text-[10px] font-semibold px-2 py-1 rounded-full ${info.dictado?.estado === "dictada" ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-700"}`}>✔ Dictada</button>
                          <button disabled={marcandoId === h.id} onClick={() => marcarEstado(h.id, h.grado_id, "alterada")}
                            className={`text-[10px] font-semibold px-2 py-1 rounded-full ${info.dictado?.estado === "alterada" ? "bg-orange-500 text-white" : "bg-orange-50 text-orange-700"}`}>⚠ Cambió</button>
                          <button disabled={marcandoId === h.id} onClick={() => marcarEstado(h.id, h.grado_id, "aplazada")}
                            className={`text-[10px] font-semibold px-2 py-1 rounded-full ${info.dictado?.estado === "aplazada" ? "bg-rose-500 text-white" : "bg-rose-50 text-rose-700"}`}>✕ Aplazada</button>
                          <button onClick={() => { setObservacionAbiertaId(observacionAbiertaId === h.id ? null : h.id); setObservacionTemp(info.dictado?.observacion || ""); }}
                            className="text-[10px] text-slate-400">{info.dictado?.observacion ? "📝 Ver nota" : "+ Nota"}</button>
                        </div>
                        {observacionAbiertaId === h.id && (
                          <div className="flex gap-1 mt-1">
                            <input value={observacionTemp} onChange={(e) => setObservacionTemp(e.target.value)} placeholder="¿Qué pasó realmente en esta clase?"
                              className="flex-1 text-[11px] rounded-lg px-2 py-1 border border-slate-200 outline-none" />
                            <button onClick={() => guardarObservacionRapida(h.id)} className="text-[10px] px-2 py-1 rounded-lg bg-violet-500 text-white">Guardar</button>
                          </div>
                        )}
                      </div>
                    )}
                    <button onClick={() => setBitacoraAbierta({ gradoId: h.grado_id, materiaId: h.materia_id || null, materiaNombre: h.materias?.nombre, fecha: fechaHoyISO })}
                      className="text-[10px] font-semibold text-violet-500 mt-1.5">📔 Bitácora de esta clase</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <CalendarioPlaneaciones onAbrirBitacora={setBitacoraAbierta} />
      </div>
      )}

      {bitacoraAbierta && (
        <BitacoraClaseModal gradoId={bitacoraAbierta.gradoId} materiaId={bitacoraAbierta.materiaId} materiaNombre={bitacoraAbierta.materiaNombre}
          fechaInicial={bitacoraAbierta.fecha} onCerrar={() => setBitacoraAbierta(null)} />
      )}
    </div>
  );
}
