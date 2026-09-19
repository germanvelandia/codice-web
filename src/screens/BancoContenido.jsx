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
/* ==================== Juego: Sopa de Letras ==================== */
function generarSopaDeLetras(palabras, tam = 12) {
  const grid = Array.from({ length: tam }, () => Array(tam).fill(null));
  const direcciones = [[0, 1], [1, 0], [1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1], [-1, 1]];
  const colocadas = [];

  const cabe = (palabra, fila, col, [df, dc]) => {
    for (let i = 0; i < palabra.length; i++) {
      const f = fila + df * i, c = col + dc * i;
      if (f < 0 || f >= tam || c < 0 || c >= tam) return false;
      const actual = grid[f][c];
      if (actual !== null && actual !== palabra[i]) return false;
    }
    return true;
  };

  palabras.forEach((palabraOriginal) => {
    const palabra = palabraOriginal.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-ZÑ]/g, "");
    if (!palabra || palabra.length > tam) return;
    let colocada = false;
    for (let intento = 0; intento < 60 && !colocada; intento++) {
      const dir = direcciones[Math.floor(Math.random() * direcciones.length)];
      const fila = Math.floor(Math.random() * tam), col = Math.floor(Math.random() * tam);
      if (cabe(palabra, fila, col, dir)) {
        const celdas = [];
        for (let i = 0; i < palabra.length; i++) {
          const f = fila + dir[0] * i, c = col + dir[1] * i;
          grid[f][c] = palabra[i];
          celdas.push([f, c]);
        }
        colocadas.push({ palabra, celdas });
        colocada = true;
      }
    }
  });

  const letras = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
  for (let f = 0; f < tam; f++) for (let c = 0; c < tam; c++) if (grid[f][c] === null) grid[f][c] = letras[Math.floor(Math.random() * letras.length)];

  return { grid, colocadas };
}

function JuegoSopaDeLetras({ items, onTerminar }) {
  const [{ grid, colocadas }] = useState(() => generarSopaDeLetras(items.slice(0, 8).map((it) => it.termino)));
  const [celdaInicio, setCeldaInicio] = useState(null);
  const [celdaActual, setCeldaActual] = useState(null);
  const [encontradas, setEncontradas] = useState([]);
  const [arrastrando, setArrastrando] = useState(false);

  const lineaEntre = (a, b) => {
    if (!a || !b) return [];
    const df = Math.sign(b[0] - a[0]), dc = Math.sign(b[1] - a[1]);
    const largo = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) + 1;
    if ((b[0] - a[0]) * df !== largo - 1 && df !== 0) return [];
    return Array.from({ length: largo }, (_, i) => [a[0] + df * i, a[1] + dc * i]);
  };

  const celdaEnRuta = (linea, f, c) => linea.some(([lf, lc]) => lf === f && lc === c);

  const soltar = () => {
    const linea = lineaEntre(celdaInicio, celdaActual);
    const coincide = colocadas.find((p) =>
      !encontradas.includes(p.palabra) &&
      p.celdas.length === linea.length &&
      (p.celdas.every(([f, c], i) => linea[i][0] === f && linea[i][1] === c) || p.celdas.every(([f, c], i) => linea[linea.length - 1 - i][0] === f && linea[linea.length - 1 - i][1] === c))
    );
    if (coincide) {
      const nuevas = [...encontradas, coincide.palabra];
      setEncontradas(nuevas);
      if (nuevas.length === colocadas.length) setTimeout(() => onTerminar(100), 500);
    }
    setCeldaInicio(null); setCeldaActual(null); setArrastrando(false);
  };

  const lineaActual = arrastrando ? lineaEntre(celdaInicio, celdaActual) : [];
  const celdasEncontradas = colocadas.filter((p) => encontradas.includes(p.palabra)).flatMap((p) => p.celdas);

  return (
    <div>
      <div className="text-xs text-slate-400 mb-2 text-center">{encontradas.length} / {colocadas.length} palabras encontradas — arrastrá para seleccionar</div>
      <div className="flex flex-wrap gap-1 justify-center mb-3">
        {colocadas.map((p) => <span key={p.palabra} className={`text-[10px] px-2 py-0.5 rounded-full ${encontradas.includes(p.palabra) ? "bg-emerald-100 text-emerald-600 line-through" : "bg-slate-100 text-slate-500"}`}>{p.palabra}</span>)}
      </div>
      <div className="select-none mx-auto" style={{ width: "fit-content" }} onMouseUp={soltar} onTouchEnd={soltar}>
        {grid.map((fila, f) => (
          <div key={f} className="flex">
            {fila.map((letra, c) => {
              const enRuta = celdaEnRuta(lineaActual, f, c);
              const enc = celdasEncontradas.some(([ff, cc]) => ff === f && cc === c);
              return (
                <div key={c}
                  onMouseDown={() => { setCeldaInicio([f, c]); setCeldaActual([f, c]); setArrastrando(true); }}
                  onMouseEnter={() => arrastrando && setCeldaActual([f, c])}
                  onTouchStart={() => { setCeldaInicio([f, c]); setCeldaActual([f, c]); setArrastrando(true); }}
                  onTouchMove={(e) => {
                    const t = e.touches[0]; const el = document.elementFromPoint(t.clientX, t.clientY);
                    if (el?.dataset?.fc) setCeldaActual(el.dataset.fc.split(",").map(Number));
                  }}
                  data-fc={`${f},${c}`}
                  className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-[11px] font-bold border border-slate-100 cursor-pointer ${enc ? "bg-emerald-200 text-emerald-800" : enRuta ? "bg-violet-200" : "text-slate-600"}`}>
                  {letra}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==================== Juego: Rueda giratoria ==================== */
function JuegoRueda({ items, onTerminar }) {
  const [restantes, setRestantes] = useState(() => barajar(items).slice(0, 10));
  const [girando, setGirando] = useState(false);
  const [elegido, setElegido] = useState(null);
  const [revelado, setRevelado] = useState(false);
  const [sabidas, setSabidas] = useState(0);
  const [anguloRueda, setAnguloRueda] = useState(0);
  const COLORES = ["#8B5CF6", "#F59E0B", "#10B981", "#3B82F6", "#EF4444", "#EC4899", "#14B8A6", "#F97316"];

  const girar = () => {
    if (girando || restantes.length === 0) return;
    setGirando(true); setRevelado(false);
    const idx = Math.floor(Math.random() * restantes.length);
    const anguloPorGajo = 360 / restantes.length;
    const vueltasExtra = 4 * 360;
    const anguloFinal = vueltasExtra + (360 - (idx * anguloPorGajo + anguloPorGajo / 2));
    setAnguloRueda((prev) => prev + anguloFinal);
    setTimeout(() => { setElegido(restantes[idx]); setGirando(false); }, 2200);
  };

  const marcar = (sabia) => {
    if (sabia) setSabidas((prev) => prev + 1);
    const nuevos = restantes.filter((r) => r.id !== elegido.id);
    setRestantes(nuevos);
    setElegido(null); setRevelado(false);
    if (nuevos.length === 0) onTerminar(Math.round((((sabia ? sabidas + 1 : sabidas)) / items.slice(0, 10).length) * 100));
  };

  return (
    <div className="text-center">
      <div className="text-xs text-slate-400 mb-3">Quedan {restantes.length}</div>
      <div className="relative mx-auto mb-4" style={{ width: 220, height: 220 }}>
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10 text-2xl">🔻</div>
        <div className="w-full h-full rounded-full overflow-hidden shadow-lg transition-transform" style={{ transform: `rotate(${anguloRueda}deg)`, transitionDuration: girando ? "2.2s" : "0s", transitionTimingFunction: "cubic-bezier(0.2,0.8,0.2,1)" }}>
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {restantes.map((_, i) => {
              const anguloPorGajo = 360 / restantes.length;
              const inicio = i * anguloPorGajo, fin = inicio + anguloPorGajo;
              const x1 = 50 + 50 * Math.cos((Math.PI * inicio) / 180), y1 = 50 + 50 * Math.sin((Math.PI * inicio) / 180);
              const x2 = 50 + 50 * Math.cos((Math.PI * fin) / 180), y2 = 50 + 50 * Math.sin((Math.PI * fin) / 180);
              return <path key={i} d={`M50,50 L${x1},${y1} A50,50 0 0,1 ${x2},${y2} Z`} fill={COLORES[i % COLORES.length]} />;
            })}
          </svg>
        </div>
      </div>

      {elegido ? (
        <div className="bg-violet-50 rounded-xl p-4 mb-3">
          <div className="text-sm text-slate-600 mb-2">{elegido.definicion}</div>
          {!revelado ? (
            <button onClick={() => setRevelado(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white">Ver respuesta</button>
          ) : (
            <>
              <div className="text-lg font-bold text-violet-700 mb-2">{elegido.termino}</div>
              <div className="flex justify-center gap-2">
                <button onClick={() => marcar(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500 text-white">✓ Lo sabía</button>
                <button onClick={() => marcar(false)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-400 text-white">✗ No lo sabía</button>
              </div>
            </>
          )}
        </div>
      ) : (
        <button disabled={girando} onClick={girar} className="text-sm font-semibold px-5 py-2.5 rounded-xl bg-violet-500 text-white disabled:opacity-50">
          {girando ? "Girando…" : "🎡 Girar"}
        </button>
      )}
    </div>
  );
}

/* ==================== Juego: Concurso de preguntas (Quiz) ==================== */
function JuegoQuiz({ items, onTerminar }) {
  const [preguntas] = useState(() => barajar(items).slice(0, 10).map((it) => {
    const distractores = barajar(items.filter((x) => x.id !== it.id)).slice(0, 3).map((x) => x.termino);
    return { ...it, opciones: barajar([it.termino, ...distractores]) };
  }));
  const [ronda, setRonda] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  const [elegida, setElegida] = useState(null);

  const actual = preguntas[ronda];

  const elegir = (op) => {
    if (elegida) return;
    setElegida(op);
    const bien = op === actual.termino;
    if (bien) setAciertos((prev) => prev + 1);
    setTimeout(() => {
      if (ronda + 1 >= preguntas.length) onTerminar(Math.round(((bien ? aciertos + 1 : aciertos) / preguntas.length) * 100));
      else { setRonda((prev) => prev + 1); setElegida(null); }
    }, 1000);
  };

  if (!actual) return null;

  return (
    <div className="text-center">
      <div className="text-xs text-slate-400 mb-2">Pregunta {ronda + 1} de {preguntas.length}</div>
      <div className="text-base font-semibold text-slate-800 mb-4">{actual.definicion}</div>
      <div className="grid grid-cols-1 gap-2">
        {actual.opciones.map((op) => {
          const esCorrecta = op === actual.termino;
          const mostrar = elegida && (op === elegida || esCorrecta);
          return (
            <button key={op} disabled={!!elegida} onClick={() => elegir(op)}
              className={`text-sm px-4 py-2.5 rounded-xl border text-left ${mostrar ? (esCorrecta ? "bg-emerald-100 border-emerald-300 text-emerald-700" : "bg-rose-100 border-rose-300 text-rose-600") : "bg-white border-slate-200 text-slate-700"}`}>
              {op}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ==================== Juego: Abrecajas ==================== */
function JuegoAbrecajas({ items, onTerminar }) {
  const [cajas] = useState(() => barajar(items).slice(0, 9));
  const [abierta, setAbierta] = useState(null);
  const [revelado, setRevelado] = useState(false);
  const [resueltas, setResueltas] = useState([]);
  const [sabidas, setSabidas] = useState(0);

  const abrir = (it) => { setAbierta(it); setRevelado(false); };

  const marcar = (sabia) => {
    if (sabia) setSabidas((prev) => prev + 1);
    const nuevas = [...resueltas, abierta.id];
    setResueltas(nuevas);
    setAbierta(null); setRevelado(false);
    if (nuevas.length === cajas.length) onTerminar(Math.round((((sabia ? sabidas + 1 : sabidas)) / cajas.length) * 100));
  };

  return (
    <div>
      <div className="text-xs text-slate-400 mb-3 text-center">{resueltas.length} / {cajas.length} cajas abiertas</div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        {cajas.map((it, i) => {
          const hecha = resueltas.includes(it.id);
          return (
            <button key={it.id} disabled={hecha} onClick={() => abrir(it)}
              className={`aspect-square rounded-xl flex items-center justify-center text-2xl font-bold ${hecha ? "bg-slate-50 text-slate-200" : "bg-gradient-to-br from-violet-400 to-fuchsia-400 text-white hover:scale-105 transition-transform"}`}>
              {hecha ? "✓" : i + 1}
            </button>
          );
        })}
      </div>

      {abierta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-xs text-center">
            <div className="text-sm text-slate-600 mb-3">{abierta.definicion}</div>
            {!revelado ? (
              <button onClick={() => setRevelado(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white">📦 Abrir</button>
            ) : (
              <>
                <div className="text-lg font-bold text-violet-700 mb-3">{abierta.termino}</div>
                <div className="flex justify-center gap-2">
                  <button onClick={() => marcar(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500 text-white">✓ Lo sabía</button>
                  <button onClick={() => marcar(false)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-400 text-white">✗ No lo sabía</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
    { key: "sopa", label: "🔍 Sopa de letras", min: 3 },
    { key: "rueda", label: "🎡 Rueda giratoria", min: 3 },
    { key: "quiz", label: "📝 Concurso de preguntas", min: 4 },
    { key: "abrecajas", label: "📦 Abrecajas", min: 3 },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" style={{ maxWidth: formato === "sopa" ? 420 : 512 }}>
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
            {formato === "sopa" && <JuegoSopaDeLetras items={items} onTerminar={terminar} />}
            {formato === "rueda" && <JuegoRueda items={items} onTerminar={terminar} />}
            {formato === "quiz" && <JuegoQuiz items={items} onTerminar={terminar} />}
            {formato === "abrecajas" && <JuegoAbrecajas items={items} onTerminar={terminar} />}
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
