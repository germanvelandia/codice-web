import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { agruparPorNivel, nivelYCurso, colorGrado } from "../lib/gamification";
import { EditorTexto, TextoEnriquecido } from "../components/RichText";

/* ---------------- Desafíos de equipo ---------------- */
function NuevoDesafioForm({ gradoId, onCancelar, onCreado }) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState("xp");
  const [meta, setMeta] = useState(200);
  const [fechaFin, setFechaFin] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!titulo.trim()) { alert("Escribe un título."); return; }
    setGuardando(true);
    try {
      await api.crearDesafioReino({ grado_id: gradoId, titulo: titulo.trim(), descripcion: descripcion.trim() || null, tipo, meta: parseInt(meta, 10) || 100, fecha_fin: fechaFin || null });
      onCreado();
    } catch (e) {
      alert("Error al crear: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-2xl p-4 mb-3">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título del desafío (ej: Carrera hacia los 200 XP)"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <div className="mb-2"><EditorTexto value={descripcion} onChange={setDescripcion} minHeight={70} placeholder="Descripción (opcional)" /></div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Se mide en</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white">
            <option value="xp">XP</option>
            <option value="monedas">Monedas</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Meta por equipo</label>
          <input type="number" value={meta} onChange={(e) => setMeta(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Termina (opcional)</label>
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
      </div>
      <p className="text-[11px] text-slate-400 mb-3">Se mide desde ahora — lo que cada estudiante ya tenía no cuenta, solo lo que sume de acá en adelante.</p>
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Creando…" : "Crear desafío"}
        </button>
      </div>
    </div>
  );
}

function DesafioCard({ desafio, onCambio }) {
  const [progreso, setProgreso] = useState([]);
  const [cargando, setCargando] = useState(true);

  const cargar = () => { setCargando(true); api.fetchProgresoDesafio(desafio).then((p) => { setProgreso(p); setCargando(false); }); };
  useEffect(() => { cargar(); }, [desafio.id]);

  const eliminar = async () => { if (!confirm(`¿Eliminar el desafío "${desafio.titulo}"?`)) return; await api.eliminarDesafioReino(desafio.id); onCambio(); };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-3">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-bold text-slate-800">⚔️ {desafio.titulo}</h4>
          {desafio.descripcion && <TextoEnriquecido html={desafio.descripcion} className="text-xs text-slate-500 mt-1" />}
          <p className="text-[11px] text-slate-400 mt-1">Meta: {desafio.meta} {desafio.tipo === "xp" ? "XP" : "monedas"} por equipo{desafio.fecha_fin ? ` · Termina ${desafio.fecha_fin}` : ""}</p>
        </div>
        <button onClick={eliminar} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
      </div>
      {cargando ? (
        <div className="text-xs text-slate-400 mt-2">Cargando progreso…</div>
      ) : (
        <div className="space-y-2 mt-3">
          {progreso.map((r) => (
            <div key={r.reino}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="font-semibold text-slate-700">{r.reino}</span>
                <span className="text-slate-500">{r.total}/{desafio.meta}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600" style={{ width: `${r.pct}%` }} />
              </div>
            </div>
          ))}
          {progreso.length === 0 && <p className="text-xs text-slate-400">Todavía no hay reinos con actividad.</p>}
        </div>
      )}
    </div>
  );
}

function PanelDesafios({ grados }) {
  const [gradoId, setGradoId] = useState(grados[0]?.id || "");
  const [desafios, setDesafios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);

  const niveles = agruparPorNivel(grados);
  const { nivel: nivelActual } = nivelYCurso(gradoId || (grados[0]?.id || ""));
  const cursosDelNivel = niveles.find((n) => n.nivel === nivelActual)?.cursos || [];

  const cargar = () => { setCargando(true); api.fetchDesafiosReino(gradoId).then((d) => { setDesafios(d); setCargando(false); }); };
  useEffect(() => { if (gradoId) cargar(); }, [gradoId]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <select value={nivelActual} onChange={(e) => { const n = niveles.find((x) => x.nivel === e.target.value); if (n?.cursos[0]) setGradoId(n.cursos[0].id); }} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {niveles.map((n) => <option key={n.nivel} value={n.nivel}>Grado {n.nivel}°</option>)}
        </select>
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {cursosDelNivel.map((g) => <option key={g.id} value={g.id}>Curso {g.id}</option>)}
        </select>
        <button onClick={() => setFormAbierto((v) => !v)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white ml-auto">
          {formAbierto ? "Cerrar" : "+ Nuevo desafío"}
        </button>
      </div>
      {formAbierto && <NuevoDesafioForm gradoId={gradoId} onCancelar={() => setFormAbierto(false)} onCreado={() => { setFormAbierto(false); cargar(); }} />}
      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : desafios.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">Todavía no hay desafíos para este curso.</div>
      ) : (
        desafios.map((d) => <DesafioCard key={d.id} desafio={d} onCambio={cargar} />)
      )}
    </div>
  );
}

/* ---------------- Misiones diarias/semanales ---------------- */
function MicroMisionForm({ mision, onCancelar, onGuardado }) {
  const [titulo, setTitulo] = useState(mision?.titulo || "");
  const [descripcion, setDescripcion] = useState(mision?.descripcion || "");
  const [tipo, setTipo] = useState(mision?.tipo || "diaria");
  const [recompensaMonedas, setRecompensaMonedas] = useState(mision?.recompensa_monedas ?? 5);
  const [recompensaXp, setRecompensaXp] = useState(mision?.recompensa_xp ?? 5);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!titulo.trim()) { alert("Escribe un título."); return; }
    setGuardando(true);
    try {
      const campos = { titulo: titulo.trim(), descripcion: descripcion.trim() || null, tipo, recompensa_monedas: parseInt(recompensaMonedas, 10) || 0, recompensa_xp: parseInt(recompensaXp, 10) || 0 };
      if (mision) await api.editarMicroMision(mision.id, campos);
      else await api.crearMicroMision({ ...campos, activo: true });
      onGuardado();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-2xl p-4 mb-3">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (ej: Participá hoy en clase)"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <div className="mb-2"><EditorTexto value={descripcion} onChange={setDescripcion} minHeight={70} placeholder="Descripción (opcional)" /></div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Se renueva</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white">
            <option value="diaria">Cada día</option>
            <option value="semanal">Cada semana</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">🪙 Monedas</label>
          <input type="number" value={recompensaMonedas} onChange={(e) => setRecompensaMonedas(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">⭐ XP</label>
          <input type="number" value={recompensaXp} onChange={(e) => setRecompensaXp(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
      </div>
      <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg p-2 mb-3">⚠️ El estudiante la marca como cumplida él mismo (no la verificás vos) — usala para hábitos de bajo riesgo, no para logros que necesiten evidencia.</p>
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : mision ? "Guardar cambios" : "Crear misión"}
        </button>
      </div>
    </div>
  );
}

function PanelMicroMisiones() {
  const [misiones, setMisiones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);

  const cargar = () => { setCargando(true); api.fetchMicroMisiones().then((d) => { setMisiones(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  const toggleActivo = async (m) => { await api.editarMicroMision(m.id, { activo: !m.activo }); cargar(); };
  const eliminar = async (m) => { if (!confirm(`¿Eliminar "${m.titulo}"?`)) return; await api.eliminarMicroMision(m.id); cargar(); };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => { setEditando(null); setFormAbierto((v) => !v); }} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">
          {formAbierto ? "Cerrar" : "+ Nueva misión"}
        </button>
      </div>
      {formAbierto && <MicroMisionForm mision={editando} onCancelar={() => setFormAbierto(false)} onGuardado={() => { setFormAbierto(false); setEditando(null); cargar(); }} />}
      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : misiones.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">Todavía no hay misiones.</div>
      ) : (
        <div className="space-y-2">
          {misiones.map((m) => (
            <div key={m.id} className={`bg-white rounded-2xl border p-3 flex justify-between items-start ${m.activo ? "border-slate-100" : "border-slate-100 opacity-50"}`}>
              <div>
                <div className="text-sm font-semibold text-slate-800">{m.tipo === "diaria" ? "☀️" : "📅"} {m.titulo}</div>
                {m.descripcion && <TextoEnriquecido html={m.descripcion} className="text-xs text-slate-500 mt-0.5" />}
                <div className="text-[11px] text-slate-400 mt-1">{m.tipo === "diaria" ? "Diaria" : "Semanal"} · 🪙{m.recompensa_monedas} · ⭐{m.recompensa_xp}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => { setEditando(m); setFormAbierto(true); }} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
                <button onClick={() => toggleActivo(m)} className={`text-[10px] px-2 py-0.5 rounded-full ${m.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{m.activo ? "Activa" : "Inactiva"}</button>
                <button onClick={() => eliminar(m)} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Cosméticos ---------------- */
function CosmeticoForm({ cosmetico, onCancelar, onGuardado }) {
  const [nombre, setNombre] = useState(cosmetico?.nombre || "");
  const [tipo, setTipo] = useState(cosmetico?.tipo || "marco");
  const [valor, setValor] = useState(cosmetico?.valor || "#8B5CF6");
  const [costo, setCosto] = useState(cosmetico?.costo_monedas ?? 20);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!nombre.trim() || !valor.trim()) { alert("Completá el nombre y el valor."); return; }
    setGuardando(true);
    try {
      const campos = { nombre: nombre.trim(), tipo, valor: valor.trim(), costo_monedas: parseInt(costo, 10) || 1 };
      if (cosmetico) await api.editarCosmetico(cosmetico.id, campos);
      else await api.crearCosmetico({ ...campos, activo: true });
      onGuardado();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-2xl p-4 mb-3">
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej: Marco Dorado)"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white">
            <option value="marco">Marco (color)</option>
            <option value="titulo">Título (texto)</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">{tipo === "marco" ? "Color" : "Texto del título"}</label>
          {tipo === "marco" ? (
            <input type="color" value={valor} onChange={(e) => setValor(e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 outline-none bg-white" />
          ) : (
            <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ej: Sabio del Códice" className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
          )}
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">🪙 Costo</label>
          <input type="number" value={costo} onChange={(e) => setCosto(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : cosmetico ? "Guardar cambios" : "Crear"}
        </button>
      </div>
    </div>
  );
}

function DuplicadosCosmeticosModal({ onClose, onCambio }) {
  const [grupos, setGrupos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [fusionando, setFusionando] = useState(null);
  const [limpiandoTodo, setLimpiandoTodo] = useState(false);

  const cargar = () => { setCargando(true); api.fetchCosmeticosDuplicados().then((g) => { setGrupos(g); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  const fusionar = async (grupo, idAConservar) => {
    setFusionando(idAConservar);
    try {
      const idsAEliminar = grupo.filter((c) => c.id !== idAConservar).map((c) => c.id);
      await api.fusionarCosmeticosDuplicados(idAConservar, idsAEliminar);
      cargar();
      onCambio();
    } catch (e) {
      alert("Error al fusionar: " + e.message);
    }
    setFusionando(null);
  };

  const limpiarTodo = async () => {
    if (!confirm(`¿Limpiar los ${grupos.length} grupo(s) de duplicados de una sola vez? En cada uno se conserva automáticamente la versión que más estudiantes tengan.`)) return;
    setLimpiandoTodo(true);
    try {
      const r = await api.limpiarTodosLosDuplicadosCosmeticos();
      alert(`Listo — se fusionaron ${r.fusionadas} versión(es) duplicada(s) en ${r.grupos} grupo(s).`);
      cargar();
      onCambio();
    } catch (e) {
      alert("Error al limpiar: " + e.message);
    }
    setLimpiandoTodo(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">🧹 Cosméticos duplicados</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Elegí cuál versión conservar de cada nombre repetido, o dejá que la app lo resuelva sola. Los estudiantes que ya lo tenían
          comprado (o equipado) pasan a quedar con la que quede — nadie pierde su compra.
        </p>
        {!cargando && grupos.length > 0 && (
          <button disabled={limpiandoTodo} onClick={limpiarTodo} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-emerald-500 text-white disabled:opacity-60 mb-3">
            {limpiandoTodo ? "Limpiando…" : `🧹 Limpiar los ${grupos.length} grupo(s) automáticamente`}
          </button>
        )}
        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : grupos.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-4">No hay duplicados. 🎉</div>
        ) : (
          <div className="space-y-4">
            {grupos.map((grupo, i) => (
              <div key={i} className="border border-slate-100 rounded-xl p-3">
                <div className="text-sm font-semibold text-slate-700 mb-2">"{grupo[0].nombre}" — {grupo.length} versiones</div>
                <div className="space-y-1.5">
                  {grupo.map((c) => (
                    <div key={c.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        {c.tipo === "marco" ? <span className="w-4 h-4 rounded-full border-2 inline-block" style={{ borderColor: c.valor }} /> : <span className="font-semibold">{c.valor}</span>}
                        <span>ID {c.id} · {c.total_poseido} estudiante(s) lo tienen</span>
                      </div>
                      <button disabled={fusionando !== null} onClick={() => fusionar(grupo, c.id)} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-500 text-white disabled:opacity-50">
                        {fusionando === c.id ? "Fusionando…" : "Conservar esta"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PanelCosmeticos() {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [duplicadosAbierto, setDuplicadosAbierto] = useState(false);

  const cargar = () => { setCargando(true); api.fetchCosmeticosCatalogo().then((d) => { setItems(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  const toggleActivo = async (c) => { await api.editarCosmetico(c.id, { activo: !c.activo }); cargar(); };
  const eliminar = async (c) => { if (!confirm(`¿Eliminar "${c.nombre}"?`)) return; await api.eliminarCosmetico(c.id); cargar(); };

  return (
    <div>
      <div className="flex justify-end gap-2 mb-3">
        <button onClick={() => setDuplicadosAbierto(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-200 text-amber-600">🧹 Duplicados</button>
        <button onClick={() => { setEditando(null); setFormAbierto((v) => !v); }} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">
          {formAbierto ? "Cerrar" : "+ Nuevo cosmético"}
        </button>
      </div>
      {formAbierto && <CosmeticoForm cosmetico={editando} onCancelar={() => setFormAbierto(false)} onGuardado={() => { setFormAbierto(false); setEditando(null); cargar(); }} />}
      {duplicadosAbierto && <DuplicadosCosmeticosModal onClose={() => setDuplicadosAbierto(false)} onCambio={cargar} />}
      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">Todavía no hay cosméticos.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((c) => (
            <div key={c.id} className={`bg-white rounded-2xl border p-3 ${c.activo ? "border-slate-100" : "border-slate-100 opacity-50"}`}>
              <div className="flex justify-between items-start">
                {c.tipo === "marco" ? (
                  <div className="w-8 h-8 rounded-full border-4" style={{ borderColor: c.valor }} />
                ) : (
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-violet-100 text-violet-700">{c.valor}</span>
                )}
                <div className="flex gap-1.5">
                  <button onClick={() => { setEditando(c); setFormAbierto(true); }} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
                  <button onClick={() => eliminar(c)} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
                </div>
              </div>
              <div className="text-sm font-semibold text-slate-800 mt-1">{c.nombre}</div>
              <div className="text-[11px] text-amber-600 mt-1">🪙 {c.costo_monedas} monedas</div>
              <button onClick={() => toggleActivo(c)} className={`text-[11px] mt-2 px-2 py-1 rounded-full ${c.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {c.activo ? "Activo" : "Inactivo"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function VistaGamificacionExtra({ grados }) {
  const [tab, setTab] = useState("desafios");
  return (
    <div>
      <div className="flex gap-1 mb-4 rounded-full bg-white p-1 w-fit border border-slate-100 shadow-sm">
        <button onClick={() => setTab("desafios")} className={`text-xs px-4 py-2 rounded-full ${tab === "desafios" ? "bg-violet-500 text-white" : "text-slate-600"}`}>⚔️ Desafíos de Reino</button>
        <button onClick={() => setTab("misiones")} className={`text-xs px-4 py-2 rounded-full ${tab === "misiones" ? "bg-violet-500 text-white" : "text-slate-600"}`}>🎯 Misiones diarias/semanales</button>
        <button onClick={() => setTab("cosmeticos")} className={`text-xs px-4 py-2 rounded-full ${tab === "cosmeticos" ? "bg-violet-500 text-white" : "text-slate-600"}`}>🎨 Cosméticos</button>
      </div>
      {tab === "desafios" && <PanelDesafios grados={grados} />}
      {tab === "misiones" && <PanelMicroMisiones />}
      {tab === "cosmeticos" && <PanelCosmeticos />}
    </div>
  );
}
