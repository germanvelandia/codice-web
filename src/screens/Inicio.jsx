import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import * as api from "../lib/api";
import { FotoLightbox } from "./Estudiantes";

const DIAS_NOMBRE = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const TIPO_EVENTO_COLOR = { institucional: "#8B5CF6", academico: "#7C3AED", convivencial: "#DB2777", festivo: "#F59E0B", otro: "#64748B" };

export function ContenidoLightbox({ html, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.75)" }} onClick={onClose}>
      <div style={{ maxWidth: "min(85vw, 500px)", maxHeight: "85vh", overflow: "auto" }} className="bg-white rounded-2xl shadow-2xl p-2" onClick={(e) => e.stopPropagation()} dangerouslySetInnerHTML={{ __html: html }} />
      <button onClick={onClose} className="absolute top-4 right-4 text-white text-2xl">✕</button>
    </div>,
    document.body
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
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4 flex items-center gap-4">
      {valor.html_contenido ? (
        <div className="shrink-0 rounded-xl overflow-hidden cursor-pointer" style={{ maxWidth: 140 }} onClick={() => setAmpliado(true)} dangerouslySetInnerHTML={{ __html: valor.html_contenido }} />
      ) : (
        <div className="rounded-xl overflow-hidden shrink-0" style={{ width: 72, height: 72, background: "#F5F3FF" }}>
          {valor.imagen_url ? (
            <img src={valor.imagen_url} alt={valor.nombre || "Valor de la semana"} onClick={() => setAmpliado(true)} className="w-full h-full object-contain cursor-pointer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl">🌟</div>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold text-violet-500 uppercase tracking-wide">Valor de la semana</div>
        <div className="text-base font-bold text-slate-800 truncate">{valor.nombre || "Sin definir todavía"}</div>
        {valor.descripcion && <div className="text-xs text-slate-500 mt-0.5">{valor.descripcion}</div>}
      </div>
      <button onClick={() => setEditando(true)} className="text-xs text-slate-400 hover:text-violet-600 shrink-0">✏️</button>
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
    <div className="bg-white rounded-xl border border-slate-100 p-3">
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

function ReflexionesSinRevisarModal({ onClose }) {
  const [entradas, setEntradas] = useState([]);
  const [cargando, setCargando] = useState(true);

  const cargar = () => { setCargando(true); api.fetchEntradasCodiceSinRevisar().then((d) => { setEntradas(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">📜 Reflexiones sin revisar</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : entradas.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-4">No hay reflexiones pendientes. 🎉</div>
        ) : (
          <div className="space-y-2">
            {entradas.map((e) => <EntradaCodicePendiente key={e.id} entrada={e} onCambio={cargar} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export function VistaInicio({ onIrA }) {
  const [stats, setStats] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [nombreDocente, setNombreDocente] = useState("");
  const [codiceAbierto, setCodiceAbierto] = useState(false);
  const [pendientesHoy, setPendientesHoy] = useState({});
  const [marcandoId, setMarcandoId] = useState(null);
  const [observacionAbiertaId, setObservacionAbiertaId] = useState(null);
  const [observacionTemp, setObservacionTemp] = useState("");

  useEffect(() => {
    Promise.all([api.fetchStatsDocente(), api.fetchResumenDocente(), api.fetchMiPerfil()]).then(([s, r, perfil]) => {
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

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;

  const { level, pctNivel } = (() => {
    const niveles = [0, 100, 300, 600, 1000];
    const idx = niveles.filter((n) => stats.xp >= n).length - 1;
    const actual = niveles[idx] ?? 0;
    const siguiente = niveles[idx + 1];
    const pct = siguiente ? Math.min(100, Math.round(((stats.xp - actual) / (siguiente - actual)) * 100)) : 100;
    return { level: stats.nivel, pctNivel: pct };
  })();

  const MODULOS = [
    { key: "estudiantes", label: "Mi Reino", sub: "Tus estudiantes", icono: "🏰" },
    { key: "calificaciones", label: "Códice", sub: "Notas y planillas", icono: "📖" },
    { key: "evaluaciones", label: "Misiones", sub: "Evaluaciones", icono: "⚔️" },
    { key: "proyectosforja", label: "La Forja", sub: "Proyectos y talleres", icono: "🔨" },
    { key: "planeaciones", label: "Biblioteca", sub: "Planeaciones", icono: "📚" },
    { key: "herramientas", label: "Herramientas", sub: "Ruleta, banco, temporizador", icono: "🛠️" },
    { key: "horario", label: "Agenda", sub: "Horario y cronograma", icono: "🗓️" },
    { key: "reportes", label: "Reportes", sub: "Análisis y estadísticas", icono: "📊" },
  ];

  return (
    <div>
      {/* Banner de bienvenida */}
      <div className="rounded-2xl overflow-hidden mb-4" style={{ background: "linear-gradient(135deg, #2d2450 0%, #1e1b30 60%, #14101f 100%)", border: "1px solid #7c3aed55" }}>
        <div className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-violet-200 text-sm">¡Bienvenido de vuelta{nombreDocente ? `, ${nombreDocente}` : ""}!</div>
              <div className="text-white text-xl font-bold mt-0.5 capitalize">{fechaLegible}</div>
            </div>
            <div className="text-4xl">🏰</div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
              <div className="text-lg font-bold text-violet-100">{level}</div>
              <div className="text-[10px] text-violet-300 uppercase tracking-wide">Nivel</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
              <div className="text-lg font-bold text-violet-100">{stats.xp}</div>
              <div className="text-[10px] text-violet-300 uppercase tracking-wide">XP total</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
              <div className="text-lg font-bold text-violet-100">{stats.insignias}</div>
              <div className="text-[10px] text-violet-300 uppercase tracking-wide">Insignias</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
              <div className="text-lg font-bold text-violet-100">{stats.estudiantesACargo}</div>
              <div className="text-[10px] text-violet-300 uppercase tracking-wide">Estudiantes</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400" style={{ width: `${pctNivel}%` }} />
            </div>
          </div>
        </div>
      </div>

      <ValorSemanaCard />

      {/* Resumen del día */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <div className="font-bold text-slate-800 mb-3">Resumen del día</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">📅 Clases de hoy</span><span className="font-semibold text-slate-700">{resumen.clasesHoy.length}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">🗓️ Eventos de hoy</span><span className="font-semibold text-slate-700">{resumen.eventosHoy.length}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">⚔️ Misiones publicadas</span><span className="font-semibold text-slate-700">{resumen.evaluacionesPublicadas}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">📝 Entregas por revisar</span><span className="font-semibold text-amber-600">{resumen.entregasPendientes}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">🔨 Tareas sin calificar</span><span className="font-semibold text-amber-600">{resumen.tareasSinCalificar}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">📖 Clases planeadas pendientes</span><span className="font-semibold text-amber-600">{resumen.clasesPendientes}</span></div>
            <button onClick={() => setCodiceAbierto(true)} className="w-full flex justify-between hover:bg-slate-50 rounded px-1 -mx-1">
              <span className="text-slate-500">📜 Reflexiones sin revisar</span><span className="font-semibold text-amber-600">{resumen.codiceSinRevisar}</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
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
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <div className="font-bold text-slate-800 mb-3">Eventos de hoy</div>
          {resumen.eventosHoy.length === 0 ? (
            <p className="text-xs text-slate-400">No hay eventos del cronograma para hoy.</p>
          ) : (
            <div className="space-y-1.5">
              {resumen.eventosHoy.map((e) => (
                <div key={e.id} className="flex items-start gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: TIPO_EVENTO_COLOR[e.tipo] || "#64748B" }} />
                  <span className="font-semibold text-slate-700 min-w-0 break-words">{e.titulo}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Módulos principales */}
      <div className="font-bold text-slate-800 mb-3">Módulos principales</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {MODULOS.map((m) => (
          <button key={m.key} onClick={() => onIrA(m.key)} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-left hover:border-violet-300 transition-colors">
            <div className="text-2xl mb-1">{m.icono}</div>
            <div className="text-sm font-bold text-slate-800">{m.label}</div>
            <div className="text-[11px] text-slate-400">{m.sub}</div>
          </button>
        ))}
      </div>

      {codiceAbierto && <ReflexionesSinRevisarModal onClose={() => setCodiceAbierto(false)} />}
    </div>
  );
}
