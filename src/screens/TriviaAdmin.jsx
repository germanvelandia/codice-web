import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { agruparPorNivel } from "../lib/gamification";
import { EmojiPicker } from "../components/EmojiPicker";

const COLORES_CATEGORIA = ["#0EA5E9", "#22C55E", "#EC4899", "#F59E0B", "#8B5CF6", "#EF4444", "#14B8A6", "#6366F1"];

function CategoriaForm({ materias, categoria, onCancelar, onGuardada }) {
  const [nombre, setNombre] = useState(categoria?.nombre || "");
  const [emoji, setEmoji] = useState(categoria?.emoji || "❓");
  const [color, setColor] = useState(categoria?.color || COLORES_CATEGORIA[0]);
  const [materiaId, setMateriaId] = useState(categoria?.materia_id || "");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!nombre.trim()) { alert("Ponele un nombre a la categoría."); return; }
    setGuardando(true);
    try {
      const campos = { nombre: nombre.trim(), emoji: emoji.trim() || "❓", color, materia_id: materiaId ? parseInt(materiaId, 10) : null };
      if (categoria) await api.editarTriviaCategoria(categoria.id, campos);
      else await api.crearTriviaCategoria(campos);
      onGuardada();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-xl p-3 mb-3">
      <div className="flex gap-2 mb-2">
        <EmojiPicker value={emoji} onChange={setEmoji} />
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la categoría" className="flex-1 text-sm rounded-lg px-3 py-1.5 border border-slate-200 outline-none bg-white" />
      </div>
      <label className="text-xs text-slate-500 block mb-1">Ligar a una materia (opcional — si no, queda como categoría general)</label>
      <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)} className="w-full text-sm rounded-lg px-3 py-1.5 mb-2 border border-slate-200 outline-none bg-white">
        <option value="">Categoría general (sin materia)</option>
        {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
      </select>
      <label className="text-xs text-slate-500 block mb-1">Color</label>
      <div className="flex gap-1.5 mb-3">
        {COLORES_CATEGORIA.map((c) => (
          <button key={c} onClick={() => setColor(c)} className="w-6 h-6 rounded-full border-2" style={{ background: c, borderColor: color === c ? "#111" : "white" }} />
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="text-xs text-slate-500 px-3 py-1.5">Cancelar</button>
        <button disabled={guardando} onClick={guardar} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : categoria ? "Guardar cambios" : "Crear categoría"}
        </button>
      </div>
    </div>
  );
}

function PreguntaForm({ categoriaId, pregunta, onCancelar, onGuardada }) {
  const [texto, setTexto] = useState(pregunta?.pregunta || "");
  const [opciones, setOpciones] = useState(pregunta?.opciones || ["", "", "", ""]);
  const [correcta, setCorrecta] = useState(pregunta?.correcta ?? 0);
  const [guardando, setGuardando] = useState(false);

  const cambiarOpcion = (i, valor) => setOpciones((prev) => prev.map((o, idx) => idx === i ? valor : o));

  const guardar = async () => {
    if (!texto.trim() || opciones.some((o) => !o.trim())) { alert("Completá la pregunta y las 4 opciones."); return; }
    setGuardando(true);
    try {
      const campos = { pregunta: texto.trim(), opciones: opciones.map((o) => o.trim()), correcta, categoria_id: categoriaId };
      if (pregunta) await api.editarTriviaPregunta(pregunta.id, campos);
      else await api.crearTriviaPregunta(campos);
      onGuardada();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-violet-50 rounded-xl p-3 mb-3">
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} placeholder="Escribí la pregunta…"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white" />
      <p className="text-[11px] text-slate-500 mb-1">Marcá cuál es la opción correcta:</p>
      {opciones.map((o, i) => (
        <div key={i} className="flex items-center gap-2 mb-1.5">
          <input type="radio" checked={correcta === i} onChange={() => setCorrecta(i)} />
          <input value={o} onChange={(e) => cambiarOpcion(i, e.target.value)} placeholder={`Opción ${i + 1}`}
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

function PreguntasDeCategoria({ categoria, grados, onVolver }) {
  const [preguntas, setPreguntas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [importarBancoAbierto, setImportarBancoAbierto] = useState(false);
  const [temasBanco, setTemasBanco] = useState([]);
  const [temaElegido, setTemaElegido] = useState("");
  const [nivelElegido, setNivelElegido] = useState("");
  const [importandoBanco, setImportandoBanco] = useState(false);
  const niveles = agruparPorNivel(grados || []);

  const cargar = () => { setCargando(true); api.fetchTriviaPreguntas(categoria.id).then((d) => { setPreguntas(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, [categoria.id]);
  useEffect(() => { if (categoria.materia_id) api.fetchTemasBanco(categoria.materia_id, nivelElegido || null).then(setTemasBanco); }, [categoria.materia_id, nivelElegido]);

  const eliminar = async (p) => { if (!confirm("¿Eliminar esta pregunta?")) return; await api.eliminarTriviaPregunta(p.id); cargar(); };

  const importarDelBanco = async () => {
    setImportandoBanco(true);
    try {
      const r = await api.importarBancoATrivia(categoria.id, categoria.materia_id, temaElegido || null, nivelElegido || null);
      alert(`Se importaron ${r.importadas} pregunta(s) nueva(s) del banco (de ${r.total} revisadas — las repetidas se saltan solas).`);
      setImportarBancoAbierto(false);
      cargar();
    } catch (e) {
      alert("Error al importar: " + e.message);
    }
    setImportandoBanco(false);
  };

  return (
    <div>
      <button onClick={onVolver} className="text-sm text-violet-500 mb-3">← Volver a categorías</button>
      <h3 className="font-bold text-slate-800 mb-1">{categoria.emoji} {categoria.nombre}</h3>
      <p className="text-xs text-slate-400 mb-3">{preguntas.length} pregunta(s) — hacen falta al menos 3-4 para que la ruleta no repita siempre lo mismo.</p>

      {categoria.materia_id && (
        importarBancoAbierto ? (
          <div className="bg-amber-50 rounded-xl p-3 mb-3">
            <p className="text-[11px] text-amber-700 mb-2">Trae las preguntas del banco de "{categoria.materia_nombre}" hacia esta categoría (no duplica las que ya estén).</p>
            <select value={nivelElegido} onChange={(e) => { setNivelElegido(e.target.value); setTemaElegido(""); }} className="w-full text-xs rounded-lg px-2 py-1.5 mb-2 border border-slate-200 outline-none bg-white">
              <option value="">Todos los grados</option>
              {niveles.map((n) => <option key={n.nivel} value={n.nivel}>Grado {n.nivel}°</option>)}
            </select>
            <select value={temaElegido} onChange={(e) => setTemaElegido(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 mb-2 border border-slate-200 outline-none bg-white">
              <option value="">Todos los temas</option>
              {temasBanco.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setImportarBancoAbierto(false)} className="text-xs text-slate-500 px-2 py-1">Cancelar</button>
              <button disabled={importandoBanco} onClick={importarDelBanco} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 text-white disabled:opacity-60">
                {importandoBanco ? "Importando…" : "Importar"}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setImportarBancoAbierto(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-200 text-amber-600 mb-3">
            🗂️ Importar del Banco de Preguntas
          </button>
        )
      )}

      {formAbierto ? (
        <PreguntaForm categoriaId={categoria.id} pregunta={editando} onCancelar={() => { setFormAbierto(false); setEditando(null); }} onGuardada={() => { setFormAbierto(false); setEditando(null); cargar(); }} />
      ) : (
        <button onClick={() => setFormAbierto(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white mb-3">+ Nueva pregunta</button>
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : preguntas.length === 0 ? (
        <p className="text-sm text-slate-400">Todavía no hay preguntas en esta categoría.</p>
      ) : (
        <div className="space-y-2">
          {preguntas.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-100 p-3">
              <div className="flex justify-between items-start gap-2">
                <p className="text-sm text-slate-700">{p.pregunta}</p>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => { setEditando(p); setFormAbierto(true); }} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
                  <button onClick={() => eliminar(p)} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {p.opciones.map((o, i) => (
                  <span key={i} className={`text-[11px] px-2 py-0.5 rounded-full ${i === p.correcta ? "bg-emerald-100 text-emerald-700 font-semibold" : "bg-slate-100 text-slate-500"}`}>
                    {i === p.correcta ? "✓ " : ""}{o}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function VistaTriviaAdmin({ grados }) {
  const [categorias, setCategorias] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [categoriaAbierta, setCategoriaAbierta] = useState(null);

  const cargar = () => { setCargando(true); api.fetchTriviaCategorias().then((d) => { setCategorias(d); setCargando(false); }); };
  useEffect(() => { cargar(); api.fetchMaterias().then(setMaterias); }, []);

  const eliminar = async (c) => { if (!confirm(`¿Eliminar la categoría "${c.nombre}"? También se borran sus preguntas.`)) return; await api.eliminarTriviaCategoria(c.id); cargar(); };

  if (categoriaAbierta) {
    return <PreguntasDeCategoria categoria={categoriaAbierta} grados={grados} onVolver={() => { setCategoriaAbierta(null); cargar(); }} />;
  }

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">🎡 Preguntados — categorías y preguntas</h3>
      <p className="text-xs text-slate-400 mb-3">Armá las categorías de la ruleta (mezclá materias reales con categorías generales) y cargá preguntas de opción múltiple para cada una.</p>

      {formAbierto ? (
        <CategoriaForm materias={materias} categoria={editando} onCancelar={() => { setFormAbierto(false); setEditando(null); }} onGuardada={() => { setFormAbierto(false); setEditando(null); cargar(); }} />
      ) : (
        <button onClick={() => setFormAbierto(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white mb-3">+ Nueva categoría</button>
      )}

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {categorias.map((c) => (
            <div key={c.id} className="rounded-xl p-3 text-white flex items-center justify-between" style={{ background: c.color }}>
              <button onClick={() => setCategoriaAbierta(c)} className="text-left flex-1">
                <div className="text-sm font-bold">{c.emoji} {c.nombre}</div>
                <div className="text-[11px] opacity-80">{c.materia_nombre || "Categoría general"}</div>
              </button>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => { setEditando(c); setFormAbierto(true); }} className="text-xs opacity-80 hover:opacity-100">✏️</button>
                <button onClick={() => eliminar(c)} className="text-xs opacity-80 hover:opacity-100">🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
