import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

function barajar(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ==================== Editor de contenido (docente) ==================== */
function EditorSetModal({ set, onClose, onGuardado }) {
  const [titulo, setTitulo] = useState(set?.titulo || "");
  const [descripcion, setDescripcion] = useState(set?.descripcion || "");
  const [items, setItems] = useState([{ termino: "", definicion: "" }]);
  const [cargando, setCargando] = useState(!!set);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (set) api.fetchItemsDeSet(set.id).then((its) => { setItems(its.length > 0 ? its : [{ termino: "", definicion: "" }]); setCargando(false); });
  }, [set]);

  const actualizarItem = (i, campo, valor) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, [campo]: valor } : it));
  const agregarItem = () => setItems((prev) => [...prev, { termino: "", definicion: "" }]);
  const quitarItem = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const guardar = async () => {
    if (!titulo.trim()) { alert("Ponele un título al set."); return; }
    const validos = items.filter((it) => it.termino.trim() && it.definicion.trim());
    if (validos.length < 3) { alert("Necesitás al menos 3 pares completos (término + definición) para que los juegos funcionen bien."); return; }
    setGuardando(true);
    try {
      let setId = set?.id;
      if (setId) {
        await api.editarSetDeContenido(setId, { titulo: titulo.trim(), descripcion: descripcion.trim() || null });
      } else {
        const nuevo = await api.crearSetDeContenido(titulo, descripcion, null);
        setId = nuevo.id;
      }
      await api.guardarItemsDeSet(setId, validos);
      onGuardado();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-bold text-slate-800">{set ? "Editar" : "Nuevo"} set de contenido</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-400 mb-4">Un solo contenido — se puede jugar en Emparejar, Ahorcado, Ordenar palabras, y más formatos.</p>

        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título del set (ej: Capitales de Sudamérica)"
          className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none" />
        <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción (opcional)"
          className="w-full text-sm rounded-lg px-3 py-2 mb-4 border border-slate-200 outline-none" />

        {cargando ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Término</label>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Definición / Pista</label>
              <span />
            </div>
            <div className="space-y-1.5 mb-3">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <input value={it.termino} onChange={(e) => actualizarItem(i, "termino", e.target.value)} placeholder="Ej: Bogotá"
                    className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
                  <input value={it.definicion} onChange={(e) => actualizarItem(i, "definicion", e.target.value)} placeholder="Ej: Capital de Colombia"
                    className="text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
                  <button onClick={() => quitarItem(i)} className="text-slate-300 hover:text-rose-500 px-1">🗑</button>
                </div>
              ))}
            </div>
            <button onClick={agregarItem} className="text-xs font-semibold text-violet-500 mb-4">+ Agregar par</button>
          </>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
          <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
            {guardando ? "Guardando…" : "Guardar set"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==================== Juego: Emparejar ==================== */
function JuegoEmparejar({ items, onTerminar }) {
  const [seleccionTermino, setSeleccionTermino] = useState(null);
  const [seleccionDef, setSeleccionDef] = useState(null);
  const [emparejados, setEmparejados] = useState([]);
  const [errores, setErrores] = useState(0);
  const [terminos] = useState(() => barajar(items).slice(0, 8));
  const [defsBarajadas] = useState(() => barajar(terminos));

  useEffect(() => {
    if (seleccionTermino !== null && seleccionDef !== null) {
      if (seleccionTermino.id === seleccionDef.id) {
        setEmparejados((prev) => [...prev, seleccionTermino.id]);
      } else {
        setErrores((prev) => prev + 1);
      }
      setTimeout(() => { setSeleccionTermino(null); setSeleccionDef(null); }, 500);
    }
  }, [seleccionTermino, seleccionDef]);

  useEffect(() => {
    if (emparejados.length === terminos.length && terminos.length > 0) {
      const puntaje = Math.max(0, 100 - errores * 10);
      setTimeout(() => onTerminar(puntaje), 600);
    }
  }, [emparejados]);

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs text-slate-400">{emparejados.length} / {terminos.length} emparejados</span>
        <span className="text-xs text-rose-400">{errores} error{errores !== 1 && "es"}</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          {terminos.map((it) => {
            const hecho = emparejados.includes(it.id);
            const activo = seleccionTermino?.id === it.id;
            return (
              <button key={it.id} disabled={hecho} onClick={() => setSeleccionTermino(it)}
                className={`w-full text-sm px-3 py-2.5 rounded-xl border text-left ${hecho ? "bg-emerald-50 border-emerald-200 text-emerald-600 opacity-60" : activo ? "bg-violet-500 text-white border-violet-500" : "bg-white border-slate-200 text-slate-700"}`}>
                {it.termino}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {defsBarajadas.map((it) => {
            const hecho = emparejados.includes(it.id);
            const activo = seleccionDef?.id === it.id;
            return (
              <button key={it.id} disabled={hecho} onClick={() => setSeleccionDef(it)}
                className={`w-full text-sm px-3 py-2.5 rounded-xl border text-left ${hecho ? "bg-emerald-50 border-emerald-200 text-emerald-600 opacity-60" : activo ? "bg-teal-500 text-white border-teal-500" : "bg-white border-slate-200 text-slate-700"}`}>
                {it.definicion}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ==================== Juego: Ordenar palabras ==================== */
function desordenar(palabra) {
  let letras;
  do { letras = barajar(palabra.toUpperCase().split("")); } while (letras.join("") === palabra.toUpperCase() && palabra.length > 1);
  return letras;
}

function JuegoOrdenarPalabras({ items, onTerminar }) {
  const [ronda, setRonda] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [disponibles, setDisponibles] = useState([]);
  const [resultado, setResultado] = useState(null); // "bien" | "mal" | null
  const [palabras] = useState(() => barajar(items).slice(0, 8));

  const actual = palabras[ronda];

  useEffect(() => {
    if (actual) { setDisponibles(desordenar(actual.termino).map((l, i) => ({ letra: l, id: i }))); setSeleccionadas([]); setResultado(null); }
  }, [ronda]);

  const elegirLetra = (item) => {
    setSeleccionadas((prev) => [...prev, item]);
    setDisponibles((prev) => prev.filter((x) => x.id !== item.id));
  };
  const quitarLetra = (item) => {
    setDisponibles((prev) => [...prev, item]);
    setSeleccionadas((prev) => prev.filter((x) => x.id !== item.id));
  };

  const comprobar = () => {
    const armada = seleccionadas.map((s) => s.letra).join("");
    const bien = armada === actual.termino.toUpperCase();
    setResultado(bien ? "bien" : "mal");
    if (bien) setAciertos((prev) => prev + 1);
    setTimeout(() => {
      if (ronda + 1 >= palabras.length) onTerminar(Math.round(((bien ? aciertos + 1 : aciertos) / palabras.length) * 100));
      else setRonda((prev) => prev + 1);
    }, 1200);
  };

  if (!actual) return null;

  return (
    <div className="text-center">
      <div className="text-xs text-slate-400 mb-1">Palabra {ronda + 1} de {palabras.length}</div>
      <div className="text-sm text-violet-600 font-semibold mb-4">💡 {actual.definicion}</div>

      <div className="flex justify-center gap-1.5 flex-wrap mb-4 min-h-[44px]">
        {seleccionadas.map((s) => (
          <button key={s.id} onClick={() => quitarLetra(s)} className="w-9 h-9 rounded-lg bg-violet-500 text-white font-bold text-lg">{s.letra}</button>
        ))}
        {seleccionadas.length === 0 && <span className="text-xs text-slate-300 self-center">Tocá las letras de abajo, en orden</span>}
      </div>

      <div className="flex justify-center gap-1.5 flex-wrap mb-4">
        {disponibles.map((d) => (
          <button key={d.id} onClick={() => elegirLetra(d)} className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 font-bold text-lg">{d.letra}</button>
        ))}
      </div>

      {resultado && (
        <div className={`text-sm font-semibold mb-2 ${resultado === "bien" ? "text-emerald-600" : "text-rose-500"}`}>
          {resultado === "bien" ? "✓ ¡Correcto!" : `✗ Era: ${actual.termino}`}
        </div>
      )}

      <button disabled={disponibles.length > 0 || !!resultado} onClick={comprobar} className="text-sm font-semibold px-5 py-2 rounded-xl bg-violet-500 text-white disabled:opacity-40">
        Comprobar
      </button>
    </div>
  );
}

/* ==================== Juego: Ahorcado ==================== */
function JuegoAhorcado({ items, onTerminar }) {
  const [ronda, setRonda] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  const [letrasUsadas, setLetrasUsadas] = useState([]);
  const [vidas, setVidas] = useState(6);
  const [resultado, setResultado] = useState(null);
  const [palabras] = useState(() => barajar(items).slice(0, 6));

  const actual = palabras[ronda];
  const palabraNorm = actual ? actual.termino.toUpperCase() : "";
  const letrasUnicas = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");

  useEffect(() => { setLetrasUsadas([]); setVidas(6); setResultado(null); }, [ronda]);

  const ganada = actual && palabraNorm.split("").every((l) => l === " " || letrasUsadas.includes(l));

  useEffect(() => {
    if (!actual || resultado) return;
    if (ganada) {
      setResultado("bien");
      setAciertos((prev) => prev + 1);
      avanzar(true);
    } else if (vidas <= 0) {
      setResultado("mal");
      avanzar(false);
    }
  }, [letrasUsadas, vidas]);

  const avanzar = (bien) => {
    setTimeout(() => {
      if (ronda + 1 >= palabras.length) onTerminar(Math.round(((bien ? aciertos + 1 : aciertos) / palabras.length) * 100));
      else setRonda((prev) => prev + 1);
    }, 1400);
  };

  const elegirLetra = (l) => {
    if (letrasUsadas.includes(l) || resultado) return;
    setLetrasUsadas((prev) => [...prev, l]);
    if (!palabraNorm.includes(l)) setVidas((prev) => prev - 1);
  };

  if (!actual) return null;

  return (
    <div className="text-center">
      <div className="text-xs text-slate-400 mb-1">Palabra {ronda + 1} de {palabras.length} · {"❤️".repeat(Math.max(vidas, 0))}{"🖤".repeat(6 - Math.max(vidas, 0))}</div>
      <div className="text-sm text-violet-600 font-semibold mb-4">💡 {actual.definicion}</div>

      <div className="flex justify-center gap-1.5 flex-wrap mb-5">
        {palabraNorm.split("").map((l, i) => (
          <span key={i} className="w-8 h-9 flex items-center justify-center border-b-2 border-slate-300 text-lg font-bold text-slate-700">
            {l === " " ? "" : (letrasUsadas.includes(l) || resultado === "mal") ? l : ""}
          </span>
        ))}
      </div>

      {resultado && (
        <div className={`text-sm font-semibold mb-3 ${resultado === "bien" ? "text-emerald-600" : "text-rose-500"}`}>
          {resultado === "bien" ? "✓ ¡Correcto!" : `✗ Era: ${actual.termino}`}
        </div>
      )}

      <div className="flex justify-center gap-1 flex-wrap max-w-md mx-auto">
        {letrasUnicas.map((l) => (
          <button key={l} disabled={letrasUsadas.includes(l) || !!resultado} onClick={() => elegirLetra(l)}
            className={`w-7 h-7 rounded text-xs font-bold ${letrasUsadas.includes(l) ? (palabraNorm.includes(l) ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-400") : "bg-slate-100 text-slate-700"}`}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ==================== Pantalla de juego (elige formato) ==================== */
export function JugarSetModal({ set, estudianteId, onClose }) {
  const [items, setItems] = useState(null);
  const [formato, setFormato] = useState(null);
  const [resultadoFinal, setResultadoFinal] = useState(null);

  useEffect(() => { api.fetchItemsDeSet(set.id).then(setItems); }, [set]);

  const terminar = async (puntaje) => {
    setResultadoFinal(puntaje);
    if (estudianteId) {
      try { await api.registrarIntentoBancoContenido(set.id, estudianteId, formato, puntaje); } catch { /* no bloquea el resultado */ }
    }
  };

  const FORMATOS = [
    { key: "emparejar", label: "🔗 Emparejar", min: 3 },
    { key: "ordenar", label: "🔤 Ordenar palabras", min: 3 },
    { key: "ahorcado", label: "🎯 Ahorcado", min: 3 },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg shadow-xl">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-bold text-slate-800">{set.titulo}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        {!items ? (
          <p className="text-sm text-slate-400 py-6 text-center">Cargando…</p>
        ) : resultadoFinal !== null ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-3">{resultadoFinal >= 80 ? "🏆" : resultadoFinal >= 50 ? "🎉" : "💪"}</div>
            <div className="text-2xl font-bold text-violet-600 mb-1">{resultadoFinal} puntos</div>
            <p className="text-sm text-slate-400 mb-4">{resultadoFinal >= 80 ? "¡Excelente!" : resultadoFinal >= 50 ? "¡Bien hecho!" : "¡Seguí practicando!"}</p>
            <div className="flex justify-center gap-2">
              <button onClick={() => { setFormato(null); setResultadoFinal(null); }} className="text-sm font-semibold px-4 py-2 rounded-lg border border-slate-200 text-slate-600">Otro formato</button>
              <button onClick={onClose} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white">Cerrar</button>
            </div>
          </div>
        ) : !formato ? (
          <>
            <p className="text-xs text-slate-400 mb-4">Elegí cómo jugarlo:</p>
            <div className="grid grid-cols-1 gap-2">
              {FORMATOS.map((f) => (
                <button key={f.key} disabled={items.length < f.min} onClick={() => setFormato(f.key)}
                  className="text-sm font-semibold px-4 py-3 rounded-xl border border-slate-200 text-slate-700 hover:border-violet-300 hover:bg-violet-50 disabled:opacity-40 text-left">
                  {f.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="pt-2">
            {formato === "emparejar" && <JuegoEmparejar items={items} onTerminar={terminar} />}
            {formato === "ordenar" && <JuegoOrdenarPalabras items={items} onTerminar={terminar} />}
            {formato === "ahorcado" && <JuegoAhorcado items={items} onTerminar={terminar} />}
          </div>
        )}
      </div>
    </div>
  );
}

/* ==================== Pantalla para el estudiante ==================== */
export function VistaBancoContenidoEstudiante({ estudianteId }) {
  const [sets, setSets] = useState(null);
  const [jugando, setJugando] = useState(null);

  useEffect(() => { api.fetchSetsDeContenidoPublico().then(setSets); }, []);

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">🧩 Juegos de Contenido</h3>
      <p className="text-xs text-slate-400 mb-4">Elegí un set y jugalo — sumás monedas según lo bien que te vaya.</p>

      {sets === null ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : sets.length === 0 ? (
        <div className="text-sm text-slate-400 bg-slate-50 rounded-2xl p-8 text-center border border-dashed border-slate-200">
          Todavía no hay ningún set de juego cargado.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {sets.map((s) => (
            <button key={s.id} onClick={() => setJugando(s)} className="text-left border border-slate-100 rounded-xl p-3 hover:border-violet-300 hover:bg-violet-50">
              <div className="font-semibold text-slate-800 text-sm mb-0.5">{s.titulo}</div>
              {s.descripcion && <p className="text-xs text-slate-400 mb-1.5">{s.descripcion}</p>}
              <div className="text-[11px] text-violet-500 font-semibold">▶️ Jugar · {s.cantidad_items} pares</div>
            </button>
          ))}
        </div>
      )}

      {jugando && <JugarSetModal set={jugando} estudianteId={estudianteId} onClose={() => setJugando(null)} />}
    </div>
  );
}

/* ==================== Pantalla principal (docente) ==================== */
export function VistaBancoContenido() {
  const [sets, setSets] = useState(null);
  const [editando, setEditando] = useState(null); // null = cerrado, {} = nuevo, set = editar
  const [jugando, setJugando] = useState(null);

  const cargar = () => api.fetchSetsDeContenido().then(setSets);
  useEffect(() => { cargar(); }, []);

  const eliminar = async (set) => {
    if (!confirm(`¿Eliminar "${set.titulo}"? Se borran sus contenidos y no se puede deshacer.`)) return;
    await api.eliminarSetDeContenido(set.id);
    cargar();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-lg font-bold text-slate-800">🧩 Banco de Contenido</h2>
        <button onClick={() => setEditando({})} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">+ Nuevo set</button>
      </div>
      <p className="text-xs text-slate-400 mb-4">Cargá un contenido una sola vez, y jugalo en Emparejar, Ahorcado, Ordenar palabras — y más formatos que se van a ir sumando.</p>

      {sets === null ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : sets.length === 0 ? (
        <div className="text-sm text-slate-400 bg-slate-50 rounded-2xl p-8 text-center border border-dashed border-slate-200">
          Todavía no armaste ningún set — tocá "+ Nuevo set" para empezar.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {sets.map((s) => (
            <div key={s.id} className="border border-slate-100 rounded-xl p-3">
              <div className="font-semibold text-slate-800 text-sm mb-0.5">{s.titulo}</div>
              {s.descripcion && <p className="text-xs text-slate-400 mb-1.5">{s.descripcion}</p>}
              <div className="text-[11px] text-slate-400 mb-2">{s.cantidad_items} par{s.cantidad_items !== 1 && "es"}</div>
              <div className="flex gap-1.5">
                <button onClick={() => setJugando(s)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white">▶️ Jugar</button>
                <button onClick={() => setEditando(s)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600">✏️ Editar</button>
                <button onClick={() => eliminar(s)} className="text-slate-300 hover:text-rose-500 px-1">🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editando && <EditorSetModal set={editando.id ? editando : null} onClose={() => setEditando(null)} onGuardado={() => { setEditando(null); cargar(); }} />}
      {jugando && <JugarSetModal set={jugando} onClose={() => setJugando(null)} />}
    </div>
  );
}
