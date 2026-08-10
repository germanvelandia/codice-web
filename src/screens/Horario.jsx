import React, { useEffect, useMemo, useState } from "react";
import * as api from "../lib/api";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const TIPOS_EVENTO = [
  { key: "institucional", label: "Institucional", color: "#8B5CF6" },
  { key: "academico", label: "Académico", color: "#7C3AED" },
  { key: "convivencial", label: "Convivencial", color: "#DB2777" },
  { key: "festivo", label: "Festivo", color: "#F59E0B" },
  { key: "otro", label: "Otro", color: "#64748B" },
];

function tipoInfo(key) { return TIPOS_EVENTO.find((t) => t.key === key) || TIPOS_EVENTO[4]; }

function NuevaClaseForm({ grados, materias, onCancelar, onCreada }) {
  const [gradoId, setGradoId] = useState("");
  const [materiaId, setMateriaId] = useState("");
  const [nombreActividad, setNombreActividad] = useState("");
  const [diasSeleccionados, setDiasSeleccionados] = useState([1]);
  const [horaInicio, setHoraInicio] = useState("07:00");
  const [horaFin, setHoraFin] = useState("08:00");
  const [guardando, setGuardando] = useState(false);

  const toggleDia = (dia) => {
    setDiasSeleccionados((prev) => prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia].sort());
  };
  const todosLosDias = () => setDiasSeleccionados([1, 2, 3, 4, 5]);

  const guardar = async () => {
    if (!materiaId && !nombreActividad.trim()) { alert("Elegí una materia o escribí un nombre de actividad."); return; }
    if (horaFin <= horaInicio) { alert("La hora final debe ser después de la inicial."); return; }
    if (diasSeleccionados.length === 0) { alert("Elegí al menos un día."); return; }
    setGuardando(true);
    try {
      for (const dia of diasSeleccionados) {
        await api.crearHorario({
          grado_id: gradoId || null,
          materia_id: materiaId ? parseInt(materiaId, 10) : null,
          nombre_actividad: nombreActividad.trim() || null,
          dia_semana: dia,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
        });
      }
      onCreada();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-xl p-4 mb-4">
      <div className="mb-3">
        <label className="text-xs text-slate-500 block mb-1">Grado (opcional — dejalo vacío para actividades generales que no son de un curso puntual)</label>
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white">
          <option value="">— Sin grado (actividad general) —</option>
          {grados.map((g) => <option key={g.id} value={g.id}>Grado {g.id}</option>)}
        </select>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-slate-500">Días (elegí uno o varios — es repetitivo cada semana)</label>
          <button type="button" onClick={todosLosDias} className="text-[11px] font-semibold text-violet-600">Lunes a viernes</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DIAS.map((d, i) => {
            const dia = i + 1;
            const activo = diasSeleccionados.includes(dia);
            return (
              <button key={dia} type="button" onClick={() => toggleDia(dia)}
                className={`text-xs px-3 py-1.5 rounded-full border ${activo ? "bg-violet-500 text-white border-violet-500" : "bg-white text-slate-600 border-slate-200"}`}>
                {d.slice(0, 3)}
              </button>
            );
          })}
        </div>
        {diasSeleccionados.length > 1 && (
          <p className="text-[11px] text-slate-400 mt-1">Se va a crear una entrada igual en cada uno de esos {diasSeleccionados.length} días.</p>
        )}
      </div>

      <label className="text-xs text-slate-500 block mb-1">Materia (elegí una, o escribí el nombre abajo si es otra actividad)</label>
      <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white">
        <option value="">— Ninguna —</option>
        {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
      </select>
      <input value={nombreActividad} onChange={(e) => setNombreActividad(e.target.value)} placeholder="O escribí un nombre libre (ej: Dirección de grupo, Descanso, Izada de bandera)"
        className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none bg-white" />

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Hora inicio</label>
          <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Hora fin</label>
          <input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : diasSeleccionados.length > 1 ? `Agregar a ${diasSeleccionados.length} días` : "Agregar al horario"}
        </button>
      </div>
    </div>
  );
}

function EditarClaseModal({ clase, grados, materias, onCerrar, onGuardado }) {
  const [gradoId, setGradoId] = useState(clase.grado_id || "");
  const [materiaId, setMateriaId] = useState(clase.materia_id || "");
  const [nombreActividad, setNombreActividad] = useState(clase.nombre_actividad || "");
  const [diaSemana, setDiaSemana] = useState(clase.dia_semana);
  const [horaInicio, setHoraInicio] = useState(clase.hora_inicio?.slice(0, 5) || "07:00");
  const [horaFin, setHoraFin] = useState(clase.hora_fin?.slice(0, 5) || "08:00");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!materiaId && !nombreActividad.trim()) { alert("Elegí una materia o escribí un nombre de actividad."); return; }
    if (horaFin <= horaInicio) { alert("La hora final debe ser después de la inicial."); return; }
    setGuardando(true);
    try {
      await api.editarHorario(clase.id, {
        grado_id: gradoId || null,
        materia_id: materiaId ? parseInt(materiaId, 10) : null,
        nombre_actividad: nombreActividad.trim() || null,
        dia_semana: diaSemana,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
      });
      onGuardado();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  const eliminar = async () => {
    if (!confirm("¿Eliminar esta clase del horario?")) return;
    await api.eliminarHorario(clase.id);
    onGuardado();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onCerrar}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">Editar clase</h3>
          <button onClick={onCerrar} className="text-slate-400">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Grado (opcional)</label>
            <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none">
              <option value="">— Sin grado (actividad general) —</option>
              {grados.map((g) => <option key={g.id} value={g.id}>Grado {g.id}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Día</label>
            <select value={diaSemana} onChange={(e) => setDiaSemana(parseInt(e.target.value, 10))} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none">
              {DIAS.map((d, i) => <option key={i} value={i + 1}>{d}</option>)}
            </select>
          </div>
        </div>

        <label className="text-xs text-slate-500 block mb-1">Materia</label>
        <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none">
          <option value="">— Ninguna —</option>
          {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        <input value={nombreActividad} onChange={(e) => setNombreActividad(e.target.value)} placeholder="O un nombre libre (ej: Dirección de grupo)"
          className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Hora inicio</label>
            <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Hora fin</label>
            <input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
          </div>
        </div>

        <div className="flex justify-between gap-2">
          <button onClick={eliminar} className="text-xs text-rose-500 px-3 py-2">🗑 Eliminar</button>
          <div className="flex gap-2">
            <button onClick={onCerrar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
            <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Genera las horas de la grilla (de la más temprana a la más tardía entre las clases, redondeadas a la hora)
function horasDeGrilla(visible) {
  if (visible.length === 0) return Array.from({ length: 10 }, (_, i) => i + 6); // 6:00–15:00 por defecto
  const inicios = visible.map((h) => parseInt(h.hora_inicio.slice(0, 2), 10));
  const fines = visible.map((h) => parseInt(h.hora_fin.slice(0, 2), 10) + (h.hora_fin.slice(3, 5) !== "00" ? 1 : 0));
  const min = Math.min(...inicios, 6);
  const max = Math.max(...fines, min + 4);
  return Array.from({ length: max - min }, (_, i) => min + i);
}

function horaAFraccion(horaStr, base) {
  const [h, m] = horaStr.split(":").map(Number);
  return (h - base) + m / 60;
}

const COLORES_GRADO = ["#8B5CF6", "#3B82F6", "#F59E0B", "#14B8A6", "#EC4899", "#22C55E", "#F43F5E", "#0EA5E9", "#A855F7", "#84CC16"];
const COLOR_SIN_GRADO = "#64748B";
function colorDeGrado(gradoId) {
  if (!gradoId) return COLOR_SIN_GRADO;
  let hash = 0;
  for (const c of String(gradoId)) hash = (hash * 31 + c.charCodeAt(0)) % COLORES_GRADO.length;
  return COLORES_GRADO[Math.abs(hash) % COLORES_GRADO.length];
}
function colorDeClase(h) {
  return colorDeGrado(h.grado_id);
}

function LeyendaGrados({ grados }) {
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {grados.map((g) => (
        <span key={g.id} className="flex items-center gap-1.5 text-[11px] text-slate-600">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorDeGrado(g.id) }} /> Grado {g.id}
        </span>
      ))}
      <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR_SIN_GRADO }} /> Sin grado
      </span>
    </div>
  );
}

function CalendarioHorario({ visible, modo, onEditar }) {
  const horas = horasDeGrilla(visible);
  const alturaHora = 52; // px por hora

  const porDia = useMemo(() => {
    const mapa = {};
    for (let i = 1; i <= 6; i++) mapa[i] = [];
    visible.forEach((h) => { mapa[h.dia_semana]?.push(h); });
    return mapa;
  }, [visible]);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
      <div style={{ minWidth: 640 }}>
        <div className="grid" style={{ gridTemplateColumns: "50px repeat(6, 1fr)" }}>
          <div />
          {DIAS.map((d) => <div key={d} className="text-center text-xs font-bold text-slate-600 py-2 border-b border-slate-100">{d.slice(0, 3)}</div>)}
        </div>
        <div className="grid relative" style={{ gridTemplateColumns: "50px repeat(6, 1fr)", height: horas.length * alturaHora }}>
          <div className="relative">
            {horas.map((h, i) => (
              <div key={h} className="absolute text-[10px] text-slate-400 -translate-y-1/2" style={{ top: i * alturaHora, right: 6 }}>{h}:00</div>
            ))}
          </div>
          {[1, 2, 3, 4, 5, 6].map((dia) => (
            <div key={dia} className="relative border-l border-slate-100">
              {horas.map((h, i) => <div key={h} className="absolute w-full border-t border-slate-50" style={{ top: i * alturaHora }} />)}
              {porDia[dia].map((clase) => {
                const base = horas[0];
                const top = horaAFraccion(clase.hora_inicio.slice(0, 5), base) * alturaHora;
                const alto = Math.max(24, (horaAFraccion(clase.hora_fin.slice(0, 5), base) - horaAFraccion(clase.hora_inicio.slice(0, 5), base)) * alturaHora);
                const color = colorDeClase(clase);
                return (
                  <button key={clase.id} onClick={() => onEditar(clase)}
                    className="absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 text-left overflow-hidden hover:brightness-95"
                    style={{ top, height: alto, background: `${color}22`, borderLeft: `3px solid ${color}` }}>
                    <div className="text-[10px] font-bold leading-tight truncate" style={{ color }}>{clase.materias?.nombre || clase.nombre_actividad || "—"}</div>
                    <div className="text-[9px] text-slate-500 leading-tight truncate">
                      {clase.hora_inicio?.slice(0, 5)}–{clase.hora_fin?.slice(0, 5)}{clase.grado_id ? ` · ${clase.grado_id}` : ""}
                    </div>
                    {modo === "todos" && <div className="text-[9px] text-slate-400 truncate">{clase.profesores?.nombre}</div>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HorarioSemanal({ grados, materias, usuarioId }) {
  const [horario, setHorario] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modo, setModo] = useState("mio"); // "mio" | "todos"
  const [vista, setVista] = useState("calendario"); // "calendario" | "lista"
  const [formAbierto, setFormAbierto] = useState(false);
  const [error, setError] = useState(null);
  const [claseEditando, setClaseEditando] = useState(null);

  const cargar = () => {
    setCargando(true);
    setError(null);
    api.fetchHorario()
      .then((data) => { setHorario(data); setCargando(false); })
      .catch((e) => { setError(e.message); setCargando(false); });
  };
  useEffect(() => { cargar(); }, []);

  const visible = modo === "mio" ? horario.filter((h) => h.docente_id === usuarioId) : horario;

  const porDia = useMemo(() => {
    const mapa = {};
    for (let i = 1; i <= 6; i++) mapa[i] = [];
    visible.forEach((h) => { mapa[h.dia_semana]?.push(h); });
    return mapa;
  }, [visible]);

  const intentarEditar = (clase) => {
    if (clase.docente_id !== usuarioId) { alert("Solo podés editar tus propias clases."); return; }
    setClaseEditando(clase);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 rounded-full bg-white p-1 w-fit border border-slate-100">
            <button onClick={() => setModo("mio")} className={`text-xs px-3 py-1.5 rounded-full ${modo === "mio" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Mi horario</button>
            <button onClick={() => setModo("todos")} className={`text-xs px-3 py-1.5 rounded-full ${modo === "todos" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Todos los docentes</button>
          </div>
          <div className="flex gap-1 rounded-full bg-white p-1 w-fit border border-slate-100">
            <button onClick={() => setVista("calendario")} className={`text-xs px-3 py-1.5 rounded-full ${vista === "calendario" ? "bg-violet-500 text-white" : "text-slate-600"}`}>📅 Calendario</button>
            <button onClick={() => setVista("lista")} className={`text-xs px-3 py-1.5 rounded-full ${vista === "lista" ? "bg-violet-500 text-white" : "text-slate-600"}`}>☰ Lista</button>
          </div>
        </div>
        <button onClick={() => setFormAbierto((v) => !v)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">
          {formAbierto ? "Cerrar" : "+ Agregar clase"}
        </button>
      </div>

      {formAbierto && (
        <NuevaClaseForm grados={grados} materias={materias} onCancelar={() => setFormAbierto(false)} onCreada={() => { setFormAbierto(false); cargar(); }} />
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : error ? (
        <div className="text-sm text-rose-500 bg-rose-50 rounded-xl p-3">Error al cargar el horario: {error}</div>
      ) : vista === "calendario" ? (
        <>
          <p className="text-[11px] text-slate-400 mb-2">Tocá cualquier bloque para editarlo o eliminarlo. El color de cada bloque es según el grado.</p>
          <LeyendaGrados grados={grados} />
          <CalendarioHorario visible={visible} modo={modo} onEditar={intentarEditar} />
        </>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {DIAS.map((dia, i) => (
            <div key={dia} className="bg-white rounded-2xl border border-slate-100 p-3">
              <div className="text-xs font-bold text-slate-700 mb-2">{dia}</div>
              {porDia[i + 1].length === 0 ? (
                <div className="text-[11px] text-slate-300">Sin clases</div>
              ) : (
                <div className="space-y-1.5">
                  {porDia[i + 1].map((h) => (
                    <button key={h.id} onClick={() => intentarEditar(h)} className="w-full text-left text-[11px] bg-violet-50 rounded-lg px-2 py-1.5 hover:bg-violet-100">
                      <div className="font-semibold text-violet-700">{h.hora_inicio?.slice(0, 5)}–{h.hora_fin?.slice(0, 5)}</div>
                      <div className="text-slate-600">{h.materias?.nombre || h.nombre_actividad || "—"}{h.grado_id ? ` · ${h.grado_id}` : ""}</div>
                      {modo === "todos" && <div className="text-slate-400">{h.profesores?.nombre}</div>}
                      {h.docente_id === usuarioId && <div className="text-violet-400 text-[10px] mt-0.5">✎ Editar</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {claseEditando && (
        <EditarClaseModal clase={claseEditando} grados={grados} materias={materias}
          onCerrar={() => setClaseEditando(null)} onGuardado={() => { setClaseEditando(null); cargar(); }} />
      )}
    </div>
  );
}

function NuevoEventoForm({ grados, onCancelar, onCreado }) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState("institucional");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [fechaFin, setFechaFin] = useState("");
  const [gradoId, setGradoId] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!titulo.trim()) { alert("Escribe un título."); return; }
    setGuardando(true);
    try {
      await api.crearEventoCronograma({
        titulo: titulo.trim(), descripcion: descripcion.trim() || null, tipo,
        fecha, fecha_fin: fechaFin || null, grado_id: gradoId || null,
      });
      onCreado();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-xl p-4 mb-4">
      <div className="flex gap-1 mb-3 flex-wrap">
        {TIPOS_EVENTO.map((t) => (
          <button key={t.key} onClick={() => setTipo(t.key)}
            className="text-xs px-3 py-1.5 rounded-full"
            style={{ background: tipo === t.key ? t.color : "white", color: tipo === t.key ? "white" : t.color }}>
            {t.label}
          </button>
        ))}
      </div>

      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título del evento"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} placeholder="Descripción (opcional)"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Hasta (opcional)</label>
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Grado (opcional)</label>
          <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white">
            <option value="">Todos los grados</option>
            {grados.map((g) => <option key={g.id} value={g.id}>Grado {g.id}</option>)}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : "Agregar evento"}
        </button>
      </div>
    </div>
  );
}

function Cronograma({ grados }) {
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [filtroGrado, setFiltroGrado] = useState("Todos");
  const [error, setError] = useState(null);

  const cargar = () => {
    setCargando(true);
    setError(null);
    api.fetchCronograma()
      .then((data) => { setEventos(data); setCargando(false); })
      .catch((e) => { setError(e.message); setCargando(false); });
  };
  useEffect(() => { cargar(); }, []);

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar este evento del cronograma?")) return;
    await api.eliminarEventoCronograma(id);
    cargar();
  };

  const hoy = new Date().toISOString().slice(0, 10);
  const visibles = eventos
    .filter((e) => filtroTipo === "Todos" || e.tipo === filtroTipo)
    .filter((e) => filtroGrado === "Todos" || !e.grado_id || e.grado_id === filtroGrado);
  const proximos = visibles.filter((e) => (e.fecha_fin || e.fecha) >= hoy);
  const pasados = visibles.filter((e) => (e.fecha_fin || e.fecha) < hoy);

  const Tarjeta = ({ e }) => {
    const info = tipoInfo(e.tipo);
    return (
      <div className="bg-white rounded-xl border-l-4 p-3 flex justify-between items-start gap-2" style={{ borderLeftColor: info.color }}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: `${info.color}22`, color: info.color }}>{info.label}</span>
            <span className="text-xs text-slate-400">{e.fecha}{e.fecha_fin && e.fecha_fin !== e.fecha ? ` → ${e.fecha_fin}` : ""}{e.grado_id ? ` · Grado ${e.grado_id}` : " · Todos los grados"}</span>
          </div>
          <div className="text-sm font-semibold text-slate-800 mt-1">{e.titulo}</div>
          {e.descripcion && <div className="text-xs text-slate-500 mt-0.5">{e.descripcion}</div>}
          <div className="text-[10px] text-slate-400 mt-1">{e.profesores?.nombre}</div>
        </div>
        <button onClick={() => eliminar(e.id)} className="text-slate-300 hover:text-rose-500 text-xs shrink-0">✕</button>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="text-xs rounded-full px-3 py-1.5 border border-slate-200 outline-none bg-white">
            <option value="Todos">Todos los tipos</option>
            {TIPOS_EVENTO.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <select value={filtroGrado} onChange={(e) => setFiltroGrado(e.target.value)} className="text-xs rounded-full px-3 py-1.5 border border-slate-200 outline-none bg-white">
            <option value="Todos">Todos los grados</option>
            {grados.map((g) => <option key={g.id} value={g.id}>Grado {g.id}</option>)}
          </select>
        </div>
        <button onClick={() => setFormAbierto((v) => !v)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">
          {formAbierto ? "Cerrar" : "+ Agregar evento"}
        </button>
      </div>

      {formAbierto && (
        <NuevoEventoForm grados={grados} onCancelar={() => setFormAbierto(false)} onCreado={() => { setFormAbierto(false); cargar(); }} />
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : error ? (
        <div className="text-sm text-rose-500 bg-rose-50 rounded-xl p-3">Error al cargar el cronograma: {error}</div>
      ) : (
        <>
          <div className="text-xs font-semibold text-slate-500 mb-2">Próximos</div>
          <div className="space-y-2 mb-5">
            {proximos.length === 0 ? <div className="text-sm text-slate-400">Sin eventos próximos.</div> : proximos.map((e) => <Tarjeta key={e.id} e={e} />)}
          </div>
          {pasados.length > 0 && (
            <>
              <div className="text-xs font-semibold text-slate-400 mb-2">Pasados</div>
              <div className="space-y-2 opacity-60">
                {pasados.slice().reverse().map((e) => <Tarjeta key={e.id} e={e} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export function VistaHorario({ grados }) {
  const [tab, setTab] = useState("horario");
  const [materias, setMaterias] = useState([]);
  const [usuarioId, setUsuarioId] = useState(null);

  useEffect(() => {
    api.fetchMaterias().then(setMaterias);
    api.fetchUsuarioActualId().then(setUsuarioId);
  }, []);

  return (
    <div>
      <div className="flex gap-1 mb-4 rounded-full bg-white p-1 w-fit border border-slate-100">
        <button onClick={() => setTab("horario")} className={`text-sm px-4 py-2 rounded-full ${tab === "horario" ? "bg-violet-500 text-white" : "text-slate-600"}`}>📅 Horario semanal</button>
        <button onClick={() => setTab("cronograma")} className={`text-sm px-4 py-2 rounded-full ${tab === "cronograma" ? "bg-violet-500 text-white" : "text-slate-600"}`}>🗓️ Cronograma</button>
      </div>
      {tab === "horario" ? (
        <HorarioSemanal grados={grados} materias={materias} usuarioId={usuarioId} />
      ) : (
        <Cronograma grados={grados} />
      )}
    </div>
  );
}
