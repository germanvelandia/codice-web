import React, { useEffect, useMemo, useRef, useState } from "react";
import { crearRngLeccion } from "../lib/leccion";
import { mezclar, mezclarDistinto, parsearHuecos, huecoCorrecto, piezasAnagrama, anagramaCorrecto, puntosTrivia, posicionesCorrectas, crearLaberinto, moverJugador, moverEnemigos, mismaCelda } from "../lib/juegos";

// Juegos interactivos de las lecciones. Todos funcionan tocando (celular) y, donde tiene sentido, también arrastrando (computador).
// Son práctica libre: no guardan nada ni dan premio (el premio lo da terminar la lección).

const titulo = (t) => (t ? <h4 className="text-sm font-bold text-slate-800 mb-2">{t}</h4> : null);
const ayuda = (t) => <p className="text-[11px] text-slate-500 mb-2">{t}</p>;
const btn = "text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-50";
const arrastrable = (id) => ({ draggable: true, onDragStart: (e) => { try { e.dataTransfer.setData("text/plain", String(id)); e.dataTransfer.effectAllowed = "move"; } catch { /* sin dataTransfer */ } } });
const destino = (fn) => ({ onDragOver: (e) => e.preventDefault(), onDrop: (e) => { e.preventDefault(); let v = ""; try { v = e.dataTransfer.getData("text/plain"); } catch { /* nada */ } if (v !== "") fn(v); } });
const Fin = ({ children, id }) => <p className="text-xs mt-2 font-semibold text-emerald-700" data-testid={id}>{children}</p>;

// ---------- Unir columnas ----------
export function Unir({ b }) {
  const ders = useMemo(() => mezclarDistinto(b.pares.map((p, i) => ({ i, t: p.der })), crearRngLeccion(b.id)), [b.id]);
  const [hechas, setHechas] = useState([]); const [sel, setSel] = useState(null); const [mal, setMal] = useState(null); const [fallos, setFallos] = useState(0);
  const evaluar = (izq, der) => {
    if (izq === der) { setHechas((h) => [...h, izq]); setMal(null); } else { setFallos((f) => f + 1); setMal(izq + ":" + der); setTimeout(() => setMal(null), 700); }
    setSel(null);
  };
  const tocarIzq = (i) => { if (hechas.includes(i)) return; if (sel && sel.lado === "der") evaluar(i, sel.i); else setSel({ lado: "izq", i }); };
  const tocarDer = (i) => { if (hechas.includes(i)) return; if (sel && sel.lado === "izq") evaluar(sel.i, i); else setSel({ lado: "der", i }); };
  const fin = hechas.length === b.pares.length;
  const est = (activo, hecha, error) => `w-full text-left text-sm rounded-lg border px-3 py-2 ${hecha ? "bg-emerald-100 border-emerald-300 text-emerald-900" : error ? "bg-rose-100 border-rose-400" : activo ? "bg-amber-100 border-amber-400" : "bg-white border-slate-200"}`;
  return (
    <div data-testid="unir">{titulo(b.titulo || "Une cada elemento con su pareja")}{ayuda("Toca un elemento de cada columna (o arrastra uno sobre su pareja).")}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">{b.pares.map((p, i) => <button key={i} type="button" onClick={() => tocarIzq(i)} {...arrastrable(i)} data-testid={`unir-izq-${i}`} data-hecha={hechas.includes(i) ? "1" : "0"} className={est(sel?.lado === "izq" && sel.i === i, hechas.includes(i), false)}>{p.izq}</button>)}</div>
        <div className="space-y-1.5">{ders.map((d) => <button key={d.i} type="button" onClick={() => tocarDer(d.i)} {...destino((v) => !hechas.includes(d.i) && !hechas.includes(Number(v)) && evaluar(Number(v), d.i))} data-testid={`unir-der-${d.i}`} data-hecha={hechas.includes(d.i) ? "1" : "0"} className={est(sel?.lado === "der" && sel.i === d.i, hechas.includes(d.i), mal && mal.endsWith(":" + d.i))}>{d.t}</button>)}</div>
      </div>
      <p className="text-xs mt-2 text-slate-500" data-testid="unir-msg">{fin ? `🎉 ¡Todas unidas!${fallos ? ` (${fallos} ${fallos === 1 ? "intento fallido" : "intentos fallidos"})` : " Sin errores."}` : `${hechas.length}/${b.pares.length} parejas${mal ? " · Esa no es su pareja" : ""}`}</p>
    </div>
  );
}

// ---------- Clasificar en grupos ----------
export function Clasificar({ b }) {
  const todos = useMemo(() => b.categorias.flatMap((c, ci) => c.elementos.map((t) => ({ t, ci }))).map((x, i) => ({ ...x, i })), [b.id]);
  const orden = useMemo(() => mezclarDistinto(todos.map((x) => x.i), crearRngLeccion(b.id)), [b.id]);
  const [puestos, setPuestos] = useState({}); const [sel, setSel] = useState(null); const [aviso, setAviso] = useState(""); const [fallos, setFallos] = useState(0);
  const colocar = (i, ci) => {
    const it = todos[i]; if (!it || puestos[i] != null) return;
    if (it.ci === ci) { setPuestos((p) => ({ ...p, [i]: ci })); setAviso(""); } else { setFallos((f) => f + 1); setAviso(`«${it.t}» no va en «${b.categorias[ci].nombre}». ¡Prueba otra!`); }
    setSel(null);
  };
  const pendientes = orden.filter((i) => puestos[i] == null), fin = !pendientes.length;
  return (
    <div data-testid="clasificar">{titulo(b.titulo || "Clasifica cada elemento")}{ayuda("Toca un elemento y luego su grupo (o arrástralo hasta la caja).")}
      <div className="flex flex-wrap gap-1.5 mb-3 min-h-[2rem]" data-testid="clas-banco">{pendientes.map((i) => <button key={i} type="button" onClick={() => setSel(sel === i ? null : i)} {...arrastrable(i)} data-testid={`clas-item-${i}`} className={`text-sm rounded-full border px-3 py-1 ${sel === i ? "bg-amber-100 border-amber-400" : "bg-white border-slate-300"}`}>{todos[i].t}</button>)}</div>
      <div className="grid sm:grid-cols-2 gap-2">{b.categorias.map((c, ci) => (
        <div key={ci} role="button" tabIndex={0} onClick={() => sel != null && colocar(sel, ci)} onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && sel != null) { e.preventDefault(); colocar(sel, ci); } }} {...destino((v) => colocar(Number(v), ci))} data-testid={`clas-caja-${ci}`} className={`rounded-xl border-2 border-dashed p-2 min-h-[4.5rem] ${sel != null ? "border-violet-400 bg-violet-50" : "border-slate-300 bg-slate-50"}`}>
          <div className="text-xs font-bold text-slate-700 mb-1">{c.nombre}</div>
          <div className="flex flex-wrap gap-1">{todos.filter((x) => puestos[x.i] === ci).map((x) => <span key={x.i} className="text-xs rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 px-2 py-0.5">{x.t}</span>)}</div>
        </div>))}</div>
      <p className={`text-xs mt-2 ${aviso ? "text-rose-600" : "text-slate-500"}`} data-testid="clas-msg">{fin ? `🎉 ¡Todo en su grupo!${fallos ? ` (${fallos} ${fallos === 1 ? "error" : "errores"})` : " Sin errores."}` : aviso || `${todos.length - pendientes.length}/${todos.length} clasificados`}</p>
    </div>
  );
}

// ---------- Memorama ----------
export function Memorama({ b }) {
  const cartas = useMemo(() => mezclar(b.parejas.flatMap((p, i) => [{ par: i, t: p.a }, { par: i, t: p.b }]), crearRngLeccion(b.id)), [b.id]);
  const [arriba, setArriba] = useState([]); const [halladas, setHalladas] = useState([]); const [intentos, setIntentos] = useState(0); const reloj = useRef(null);
  useEffect(() => () => clearTimeout(reloj.current), []);
  const voltear = (k) => {
    if (arriba.length >= 2 || arriba.includes(k) || halladas.includes(cartas[k].par)) return;
    const nuevo = [...arriba, k]; setArriba(nuevo);
    if (nuevo.length === 2) {
      setIntentos((n) => n + 1);
      if (cartas[nuevo[0]].par === cartas[nuevo[1]].par) { reloj.current = setTimeout(() => { setHalladas((h) => [...h, cartas[nuevo[0]].par]); setArriba([]); }, 350); }
      else reloj.current = setTimeout(() => setArriba([]), 1000);
    }
  };
  const fin = halladas.length === b.parejas.length;
  return (
    <div data-testid="memorama">{titulo(b.titulo || "Memorama")}{ayuda("Voltea dos cartas: si son pareja, se quedan descubiertas.")}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">{cartas.map((c, k) => {
        const abierta = arriba.includes(k) || halladas.includes(c.par), ok = halladas.includes(c.par);
        return <button key={k} type="button" onClick={() => voltear(k)} data-testid={`mem-${k}`} data-par={c.par} data-abierta={abierta ? "1" : "0"} aria-label={abierta ? c.t : "Carta boca abajo"} className={`h-20 rounded-xl border text-xs font-bold p-1 flex items-center justify-center text-center transition-colors ${ok ? "bg-emerald-100 border-emerald-300 text-emerald-900" : abierta ? "bg-white border-violet-400 text-slate-800" : "bg-violet-500 border-violet-600 text-white"}`}>{abierta ? c.t : "?"}</button>;
      })}</div>
      <p className="text-xs mt-2 text-slate-500" data-testid="mem-msg">{fin ? `🎉 ¡Encontraste todas las parejas en ${intentos} ${intentos === 1 ? "intento" : "intentos"}!` : `${halladas.length}/${b.parejas.length} parejas · ${intentos} intentos`}</p>
    </div>
  );
}

// ---------- Diagrama etiquetado ----------
export function Diagrama({ b }) {
  const nombres = useMemo(() => mezclarDistinto(b.etiquetas.map((e, i) => i), crearRngLeccion(b.id)), [b.id]);
  const [puestos, setPuestos] = useState({}); const [selP, setSelP] = useState(null); const [selN, setSelN] = useState(null); const [aviso, setAviso] = useState(""); const [roto, setRoto] = useState(false);
  const probar = (p, n) => {
    if (p == null || n == null || puestos[p] != null || Object.values(puestos).includes(n)) return;
    if (p === n) { setPuestos((x) => ({ ...x, [p]: n })); setAviso(""); } else setAviso(`Ese no es «${b.etiquetas[n].nombre}». ¡Inténtalo de nuevo!`);
    setSelP(null); setSelN(null);
  };
  const tocarPunto = (p) => { if (puestos[p] != null) return; if (selN != null) probar(p, selN); else setSelP(selP === p ? null : p); };
  const tocarNombre = (n) => { if (Object.values(puestos).includes(n)) return; if (selP != null) probar(selP, n); else setSelN(selN === n ? null : n); };
  const libres = nombres.filter((n) => !Object.values(puestos).includes(n)), fin = !libres.length;
  return (
    <div data-testid="diagrama">{titulo(b.titulo || "Diagrama")}{ayuda("Toca un punto y luego el nombre que le corresponde (o arrastra el nombre hasta el punto).")}
      {roto ? <p className="text-xs text-rose-600">No se pudo cargar la imagen.</p> : (
        <div className="relative select-none">
          <img src={b.url} alt={b.titulo || "Diagrama"} className="w-full rounded-xl border border-slate-200 block" draggable={false} onError={() => setRoto(true)} />
          {b.etiquetas.map((e, p) => { const puesto = puestos[p] != null; return (
            <button key={p} type="button" onClick={() => tocarPunto(p)} {...destino((v) => probar(p, Number(v)))} data-testid={`diag-punto-${p}`} data-hecho={puesto ? "1" : "0"} aria-label={puesto ? e.nombre : `Punto ${p + 1}`}
              style={{ left: `${e.x}%`, top: `${e.y}%`, transform: "translate(-50%,-50%)" }} className={`absolute rounded-full border-2 text-[10px] font-bold flex items-center justify-center ${puesto ? "bg-emerald-500 border-white text-white px-2 h-6 whitespace-nowrap" : selP === p ? "bg-amber-400 border-white w-7 h-7 text-slate-900" : "bg-violet-600 border-white w-7 h-7 text-white"}`}>{puesto ? e.nombre : p + 1}</button>); })}
        </div>)}
      <div className="flex flex-wrap gap-1.5 mt-3 min-h-[2rem]">{libres.map((n) => <button key={n} type="button" onClick={() => tocarNombre(n)} {...arrastrable(n)} data-testid={`diag-nombre-${n}`} className={`text-sm rounded-full border px-3 py-1 ${selN === n ? "bg-amber-100 border-amber-400" : "bg-white border-slate-300"}`}>{b.etiquetas[n].nombre}</button>)}</div>
      <p className={`text-xs mt-2 ${aviso ? "text-rose-600" : "text-slate-500"}`} data-testid="diag-msg">{fin ? "🎉 ¡Nombraste todas las partes!" : aviso || `${b.etiquetas.length - libres.length}/${b.etiquetas.length} partes`}</p>
    </div>
  );
}

// ---------- Completar los espacios ----------
export function Completar({ b }) {
  const { partes, huecos } = useMemo(() => parsearHuecos(b.texto), [b.id, b.texto]);
  const huecosL = partes.filter((p) => p.t === "hueco");
  const banco = useMemo(() => mezclarDistinto([...huecosL.map((h) => h.validas[0]), ...(b.distractores || [])].map((t, k) => ({ k, t })), crearRngLeccion(b.id)), [b.id, b.texto]);
  const [vals, setVals] = useState({}); const [selH, setSelH] = useState(null); const [selW, setSelW] = useState(null); const [comprobado, setComprobado] = useState(false);
  const usadas = Object.values(vals).filter((v) => typeof v === "number");
  const llenar = (h, k) => { setComprobado(false); setVals((v) => ({ ...v, [h]: k })); setSelH(null); setSelW(null); };
  const tocarHueco = (h) => { if (b.modo === "escribir") return; if (vals[h] != null) { setComprobado(false); setVals((v) => { const n = { ...v }; delete n[h]; return n; }); return; } if (selW != null) llenar(h, selW); else setSelH(selH === h ? null : h); };
  const tocarPalabra = (k) => { if (usadas.includes(k)) return; if (selH != null) llenar(selH, k); else setSelW(selW === k ? null : k); };
  const valorDe = (h) => (b.modo === "escribir" ? vals[h] || "" : vals[h] != null ? banco.find((x) => x.k === vals[h])?.t || "" : "");
  const buenos = huecosL.filter((h) => huecoCorrecto(h, valorDe(h.i))).length, completo = buenos === huecos;
  return (
    <div data-testid="completar">{titulo(b.titulo || "Completa el texto")}{ayuda(b.modo === "escribir" ? "Escribe la palabra que falta en cada espacio." : "Toca un espacio y luego la palabra (o arrastra la palabra al espacio). Toca un espacio lleno para vaciarlo.")}
      <p className="text-sm text-slate-800 leading-9">{partes.map((p, i) => p.t === "txt" ? <React.Fragment key={i}>{p.texto}</React.Fragment> : (
        b.modo === "escribir"
          ? <input key={i} value={vals[p.i] || ""} onChange={(e) => { setComprobado(false); setVals((v) => ({ ...v, [p.i]: e.target.value })); }} maxLength={40} aria-label={`Espacio ${p.i + 1}`} data-testid={`hueco-${p.i}`} style={{ width: `${Math.max(5, p.validas[0].length + 2)}ch` }} className={`mx-1 text-center text-sm border-b-2 outline-none bg-transparent ${comprobado ? (huecoCorrecto(p, vals[p.i]) ? "border-emerald-500 text-emerald-700" : "border-rose-500 text-rose-700") : "border-slate-400 focus:border-violet-500"}`} />
          : <button key={i} type="button" onClick={() => tocarHueco(p.i)} {...destino((v) => llenar(p.i, Number(v)))} data-testid={`hueco-${p.i}`} aria-label={`Espacio ${p.i + 1}`} className={`mx-1 min-w-[4.5rem] px-2 py-0.5 rounded-lg border-b-2 text-sm font-semibold ${comprobado && vals[p.i] != null ? (huecoCorrecto(p, valorDe(p.i)) ? "bg-emerald-100 border-emerald-500 text-emerald-800" : "bg-rose-100 border-rose-500 text-rose-800") : selH === p.i ? "bg-amber-100 border-amber-500" : "bg-slate-100 border-slate-400"}`}>{valorDe(p.i) || "    "}</button>))}</p>
      {b.modo !== "escribir" && <div className="flex flex-wrap gap-1.5 mt-3">{banco.filter((x) => !usadas.includes(x.k)).map((x) => <button key={x.k} type="button" onClick={() => tocarPalabra(x.k)} {...arrastrable(x.k)} data-testid={`palabra-${x.k}`} className={`text-sm rounded-full border px-3 py-1 ${selW === x.k ? "bg-amber-100 border-amber-400" : "bg-white border-slate-300"}`}>{x.t}</button>)}</div>}
      <div className="flex items-center gap-2 mt-3"><button type="button" onClick={() => setComprobado(true)} className={btn} data-testid="completar-comprobar">Comprobar</button>
        <span className="text-xs text-slate-500" data-testid="completar-msg">{comprobado ? (completo ? "🎉 ¡Todo correcto!" : `${buenos}/${huecos} bien. Corrige los espacios en rojo.`) : ""}</span></div>
    </div>
  );
}

// ---------- Anagrama (letras o palabras de una oración) ----------
function ItemAnagrama({ b, it, n }) {
  const piezas = useMemo(() => piezasAnagrama(it.texto, b.modo), [it.texto, b.modo]);
  const orden = useMemo(() => mezclarDistinto(piezas.map((_, k) => k), crearRngLeccion(b.id + n)), [b.id, n, it.texto]);
  const [armado, setArmado] = useState([]); const listo = armado.length === piezas.length && anagramaCorrecto(it.texto, b.modo, armado.map((k) => piezas[k]));
  const lleno = armado.length === piezas.length, mayus = b.modo === "letras" ? "uppercase" : "";
  const pieza = (k, extra, onClick, tid) => <button key={k} type="button" onClick={onClick} data-testid={tid} className={`min-w-[2rem] h-9 px-2 rounded-lg border text-sm font-bold ${mayus} ${extra}`}>{piezas[k]}</button>;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3" data-testid={`ana-${n}`} data-ok={listo ? "1" : "0"}>
      {it.pista && <p className="text-xs text-slate-600 mb-2">💡 {it.pista}</p>}
      <div className={`flex flex-wrap gap-1 min-h-[2.5rem] rounded-lg p-1.5 border-2 border-dashed ${listo ? "border-emerald-400 bg-emerald-50" : lleno ? "border-rose-400 bg-rose-50" : "border-slate-300"}`} data-testid={`ana-${n}-armado`}>{armado.map((k, p) => pieza(k, "bg-violet-100 border-violet-300", () => !listo && setArmado(armado.filter((_, q) => q !== p)), `ana-${n}-quitar-${p}`))}</div>
      <div className="flex flex-wrap gap-1 mt-2">{orden.filter((k) => !armado.includes(k)).map((k) => pieza(k, "bg-white border-slate-300", () => !listo && setArmado([...armado, k]), `ana-${n}-pieza-${k}`))}</div>
      <p className={`text-xs mt-1.5 ${listo ? "text-emerald-700 font-semibold" : lleno ? "text-rose-600" : "text-slate-400"}`} data-testid={`ana-${n}-msg`}>{listo ? "✅ ¡Correcto!" : lleno ? "No es el orden correcto. Toca una pieza armada para quitarla." : "Toca las piezas en orden."}</p>
      {!listo && armado.length > 0 && <button type="button" onClick={() => setArmado([])} className="text-[11px] text-slate-500 underline mt-1">Empezar de nuevo</button>}
    </div>
  );
}
export function Anagrama({ b }) {
  return <div data-testid="anagrama">{titulo(b.titulo || (b.modo === "frase" ? "Ordena la oración" : "Ordena las letras"))}<div className="space-y-2">{b.items.map((it, n) => <ItemAnagrama key={n} b={b} it={it} n={n} />)}</div></div>;
}

// ---------- Línea de tiempo y jerarquía ----------
export function Ordenar({ b }) {
  const esLinea = b.tipo === "linea", total = b.items.length;
  const [orden, setOrden] = useState(() => mezclarDistinto(b.items.map((_, i) => i), crearRngLeccion(b.id)));
  const [comprobado, setComprobado] = useState(false);
  const mover = (p, d) => { const q = p + d; if (q < 0 || q >= total) return; setComprobado(false); setOrden((o) => { const c = [...o]; [c[p], c[q]] = [c[q], c[p]]; return c; }); };
  const soltar = (desde, hasta) => { if (desde === hasta || Number.isNaN(desde)) return; setComprobado(false); setOrden((o) => { const c = [...o]; const [x] = c.splice(desde, 1); c.splice(hasta, 0, x); return c; }); };
  const buenas = posicionesCorrectas(orden), resuelto = buenas === total;
  const arriba = b.inicio || (esLinea ? "Antes" : "Más importante"), abajo = b.fin || (esLinea ? "Después" : "Menos importante");
  return (
    <div data-testid={`orden-${b.tipo}`}>{titulo(b.titulo || (esLinea ? "Línea de tiempo" : "Ordena por jerarquía"))}{ayuda("Arrastra los elementos (o usa las flechas) hasta dejarlos en el orden correcto y pulsa Comprobar.")}
      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1"><span>{esLinea ? "⬇ " : "🔺 "}{arriba}</span></div>
      <div className={`space-y-1.5 ${esLinea ? "border-l-4 border-violet-300 pl-3" : ""}`}>{orden.map((o, p) => {
        const bien = comprobado && o === p, mal = comprobado && o !== p;
        const ancho = esLinea ? undefined : { width: `${total > 1 ? 55 + (p / (total - 1)) * 45 : 100}%`, margin: "0 auto" };
        return (
          <div key={o} {...arrastrable(p)} {...destino((v) => soltar(Number(v), p))} style={ancho} data-testid={`ord-item-${p}`} data-orig={o} className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-sm ${bien || resuelto ? "bg-emerald-100 border-emerald-300" : mal ? "bg-rose-50 border-rose-300" : "bg-white border-slate-200"}`}>
            <span className="w-5 text-[11px] font-bold text-slate-400 shrink-0">{p + 1}</span>
            <span className="flex-1 text-slate-800">{b.items[o].texto}{resuelto && b.items[o].etiqueta && <span className="ml-2 text-[11px] font-bold text-violet-600">{b.items[o].etiqueta}</span>}</span>
            <button type="button" disabled={p === 0 || resuelto} onClick={() => mover(p, -1)} aria-label="Subir" data-testid={`ord-sub-${p}`} className="text-slate-500 disabled:opacity-30 px-1">▲</button>
            <button type="button" disabled={p === total - 1 || resuelto} onClick={() => mover(p, 1)} aria-label="Bajar" data-testid={`ord-baj-${p}`} className="text-slate-500 disabled:opacity-30 px-1">▼</button>
          </div>);
      })}</div>
      <div className="text-[10px] font-bold text-slate-500 mt-1">{abajo}</div>
      <div className="flex items-center gap-2 mt-2"><button type="button" disabled={resuelto} onClick={() => setComprobado(true)} className={btn} data-testid="ord-comprobar">Comprobar</button>
        <span className="text-xs text-slate-500" data-testid="ord-msg">{resuelto ? "🎉 ¡Orden correcto!" : comprobado ? `${buenas}/${total} en su lugar (en verde). Sigue intentando.` : ""}</span></div>
    </div>
  );
}

// ---------- Trivia con tiempo ----------
export function Trivia({ b }) {
  const [fase, setFase] = useState("inicio"); const [q, setQ] = useState(0); const [resp, setResp] = useState(null);   // { elegida, puntos } al responder
  const [pts, setPts] = useState([]); const [resto, setResto] = useState(b.segundos); const t0 = useRef(0);
  const p = b.preguntas[q];
  useEffect(() => {
    if (fase !== "jugando" || resp) return;
    t0.current = Date.now(); setResto(b.segundos);
    const id = setInterval(() => { const dt = (Date.now() - t0.current) / 1000; const r = Math.max(0, b.segundos - dt); setResto(r); if (r <= 0) { clearInterval(id); setResp({ elegida: -1, puntos: 0 }); setPts((x) => [...x, 0]); } }, 100);
    return () => clearInterval(id);
  }, [fase, q, !!resp]);
  const elegir = (i) => { if (resp) return; const puntos = puntosTrivia(i === p.correcta, Date.now() - t0.current, b.segundos); setResp({ elegida: i, puntos }); setPts((x) => [...x, puntos]); };
  const siguiente = () => { if (q + 1 >= b.preguntas.length) setFase("fin"); else { setQ(q + 1); setResp(null); } };
  const reiniciar = () => { setFase("jugando"); setQ(0); setResp(null); setPts([]); };
  const total = pts.reduce((a, c) => a + c, 0), max = b.preguntas.length * 100, aciertos = pts.filter((x) => x > 0).length;
  if (fase === "inicio") return <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center" data-testid="trivia"><h4 className="text-sm font-bold text-slate-800">⏱️ {b.titulo || "Trivia con tiempo"}</h4><p className="text-xs text-slate-500 my-2">{b.preguntas.length} preguntas · {b.segundos} segundos cada una. ¡Mientras más rápido aciertes, más puntos (hasta 100 por pregunta)!</p><button type="button" onClick={() => setFase("jugando")} className={btn} data-testid="trivia-empezar">▶ Empezar</button></div>;
  if (fase === "fin") return <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-center" data-testid="trivia"><h4 className="text-sm font-bold text-emerald-800">🏁 ¡Terminaste la trivia!</h4><p className="text-2xl font-bold text-emerald-700 my-1" data-testid="trivia-total">{total} <span className="text-sm font-semibold text-slate-500">de {max} puntos</span></p><p className="text-xs text-slate-600 mb-2" data-testid="trivia-final">{aciertos} de {b.preguntas.length} correctas</p><button type="button" onClick={reiniciar} className={btn} data-testid="trivia-otra">Jugar otra vez</button></div>;
  const frac = Math.max(0, Math.min(1, resto / b.segundos));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4" data-testid="trivia">
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1"><span>Pregunta {q + 1} de {b.preguntas.length}</span><span data-testid="trivia-acum">⭐ {total}</span></div>
      <div className="h-2 rounded-full bg-slate-200 overflow-hidden mb-3"><div className={`h-full ${frac < 0.25 ? "bg-rose-500" : "bg-violet-500"}`} style={{ width: `${resp ? 0 : frac * 100}%` }} data-testid="trivia-barra" /></div>
      <p className="text-sm text-slate-800 mb-2">{p.pregunta}</p>
      <div className="space-y-1.5">{p.opciones.map((o, i) => {
        const bien = resp && i === p.correcta, malo = resp && resp.elegida === i && i !== p.correcta;
        return <button key={i} type="button" disabled={!!resp} onClick={() => elegir(i)} data-testid={`trivia-op-${i}`} className={`w-full text-left text-sm rounded-lg border px-3 py-2 ${bien ? "bg-emerald-100 border-emerald-300" : malo ? "bg-rose-50 border-rose-300" : "bg-white border-slate-200"}`}>{String.fromCharCode(65 + i)}. {o}</button>;
      })}</div>
      {resp && <div className="mt-2"><p className={`text-xs font-semibold ${resp.puntos ? "text-emerald-700" : "text-rose-600"}`} data-testid="trivia-res">{resp.elegida === -1 ? "⏰ ¡Se acabó el tiempo!" : resp.puntos ? `✅ ¡Correcto! +${resp.puntos} puntos` : "❌ Esa no era."}{p.explicacion ? " " + p.explicacion : ""}</p><button type="button" onClick={siguiente} className={btn + " mt-2"} data-testid="trivia-sig">{q + 1 >= b.preguntas.length ? "Ver mi resultado" : "Siguiente →"}</button></div>}
    </div>
  );
}

// ---------- Ruleta ----------
const COLORES_RULETA = ["#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#0ea5e9", "#ec4899", "#84cc16", "#f97316"];
export function Ruleta({ b }) {
  const n = b.items.length; const [giro, setGiro] = useState(0); const [girando, setGirando] = useState(false); const [sale, setSale] = useState(null); const reloj = useRef(null);
  useEffect(() => () => clearTimeout(reloj.current), []);
  const ang = 360 / n, r = 100;
  const punto = (grados, radio) => { const a = ((grados - 90) * Math.PI) / 180; return [r + radio * Math.cos(a), r + radio * Math.sin(a)]; };
  const girar = () => {
    if (girando) return; const k = Math.floor(Math.random() * n), centro = (k + 0.5) * ang;
    setGiro((g) => Math.ceil(g / 360) * 360 + 360 * 5 + (360 - centro)); setGirando(true); setSale(null);
    reloj.current = setTimeout(() => { setGirando(false); setSale(k); }, 4200);
  };
  return (
    <div data-testid="ruleta" className="text-center">{titulo(b.titulo || "Ruleta")}
      <div className="relative mx-auto w-64 max-w-full">
        <div className="absolute left-1/2 -top-1 -translate-x-1/2 z-10 text-2xl leading-none" aria-hidden="true">🔻</div>
        <svg viewBox="0 0 200 200" className="w-full" style={{ transform: `rotate(${giro}deg)`, transition: girando ? "transform 4s cubic-bezier(.17,.67,.12,1)" : "none" }} data-giro={giro} role="img" aria-label="Ruleta">
          {b.items.map((t, i) => { const [x1, y1] = punto(i * ang, r), [x2, y2] = punto((i + 1) * ang, r), [tx, ty] = punto((i + 0.5) * ang, r * 0.62);
            return <g key={i}><path d={n === 1 ? `M ${r} ${r} m -${r} 0 a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 -${2 * r} 0` : `M ${r} ${r} L ${x1} ${y1} A ${r} ${r} 0 ${ang > 180 ? 1 : 0} 1 ${x2} ${y2} Z`} fill={COLORES_RULETA[i % COLORES_RULETA.length]} stroke="#fff" strokeWidth="1.5" />
              <text x={tx} y={ty} fontSize="9" fontWeight="700" fill="#fff" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${(i + 0.5) * ang} ${tx} ${ty})`}>{t.length > 13 ? t.slice(0, 12) + "…" : t}</text></g>; })}
        </svg>
      </div>
      <button type="button" onClick={girar} disabled={girando} className={btn + " mt-3"} data-testid="ruleta-girar">{girando ? "Girando…" : sale == null ? "🎡 ¡Girar!" : "🎡 Girar otra vez"}</button>
      {sale != null && <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-slate-800" data-testid="ruleta-resultado" data-k={sale}>{b.items[sale]}</div>}
    </div>
  );
}

// ---------- Laberinto de respuestas ----------
export function Laberinto({ b }) {
  const lab = useMemo(() => crearLaberinto({ seed: crearRngLeccion(b.id), opciones: b.opciones.length, enemigos: b.enemigos }), [b.id]);
  const [jug, setJug] = useState(lab.inicio); const [ene, setEne] = useState(lab.enemigos); const [pasos, setPasos] = useState(0);
  const [fuera, setFuera] = useState([]); const [msg, setMsg] = useState(""); const [gano, setGano] = useState(false); const [capturas, setCapturas] = useState(0);
  const mover = (df, dc) => {
    if (gano) return; const nuevo = moverJugador(lab, jug, df, dc); if (mismaCelda(nuevo, jug)) return;
    const k = lab.respuestas.findIndex((r, i) => mismaCelda(r, nuevo) && !fuera.includes(i));
    if (k >= 0) {
      if (k === b.correcta) { setJug(nuevo); setGano(true); setMsg(""); return; }
      setFuera((f) => [...f, k]); setMsg(`❌ «${b.opciones[k]}» no era. Vuelves al inicio.`); setJug(lab.inicio); setEne(lab.enemigos); return;
    }
    const p = pasos + 1; setPasos(p);
    let e = ene; if (e.some((x) => mismaCelda(x, nuevo))) return atrapado();
    if (p % 2 === 0) e = moverEnemigos(lab, e, nuevo);
    if (e.some((x) => mismaCelda(x, nuevo))) return atrapado();
    setJug(nuevo); setEne(e); setMsg("");
  };
  const atrapado = () => { setCapturas((c) => c + 1); setJug(lab.inicio); setEne(lab.enemigos); setMsg("👾 ¡Te atraparon! Vuelves al inicio."); };
  const tecla = (e) => { const m = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key]; if (m) { e.preventDefault(); mover(...m); } };
  const resp = (f, c) => lab.respuestas.findIndex((r, i) => r[0] === f && r[1] === c && !fuera.includes(i));
  return (
    <div data-testid="laberinto" tabIndex={0} onKeyDown={tecla} className="outline-none">{titulo(b.titulo || "Laberinto de respuestas")}
      <p className="text-sm text-slate-800 mb-1">{b.pregunta}</p>{ayuda("Llega hasta la letra de la respuesta correcta sin que te atrape un 👾. Usa las flechas de abajo o las del teclado.")}
      <div className="flex flex-wrap gap-1.5 mb-2">{b.opciones.map((o, i) => <span key={i} className={`text-xs rounded-full border px-2 py-0.5 ${fuera.includes(i) ? "line-through text-slate-400 border-slate-200" : "border-slate-300 text-slate-700"}`}><b>{String.fromCharCode(65 + i)}</b> {o}</span>)}</div>
      <div className="grid gap-px bg-slate-300 p-px rounded-lg max-w-xs mx-auto" style={{ gridTemplateColumns: `repeat(${lab.tam}, minmax(0,1fr))` }} data-testid="lab-mapa">
        {lab.mapa.map((fila, f) => fila.map((v, c) => {
          const esJ = mismaCelda(jug, [f, c]), esE = ene.some((x) => mismaCelda(x, [f, c])), k = resp(f, c);
          return <div key={f + "," + c} data-celda={f + "," + c} className={`aspect-square flex items-center justify-center text-[11px] font-bold ${v ? "bg-slate-700" : "bg-white"}`}>{esJ ? "🙂" : esE ? "👾" : k >= 0 ? <span className="w-full h-full flex items-center justify-center bg-amber-200 text-amber-900 rounded">{String.fromCharCode(65 + k)}</span> : ""}</div>;
        }))}
      </div>
      <div className="grid grid-cols-3 gap-1 w-36 mx-auto mt-3">
        <span /><button type="button" onClick={() => mover(-1, 0)} className="h-9 rounded-lg bg-slate-100 text-lg" data-testid="lab-arriba" aria-label="Arriba">⬆️</button><span />
        <button type="button" onClick={() => mover(0, -1)} className="h-9 rounded-lg bg-slate-100 text-lg" data-testid="lab-izq" aria-label="Izquierda">⬅️</button>
        <button type="button" onClick={() => mover(1, 0)} className="h-9 rounded-lg bg-slate-100 text-lg" data-testid="lab-abajo" aria-label="Abajo">⬇️</button>
        <button type="button" onClick={() => mover(0, 1)} className="h-9 rounded-lg bg-slate-100 text-lg" data-testid="lab-der" aria-label="Derecha">➡️</button>
      </div>
      <p className={`text-xs mt-2 text-center ${gano ? "text-emerald-700 font-semibold" : msg ? "text-rose-600" : "text-slate-500"}`} data-testid="lab-msg">{gano ? `🎉 ¡Llegaste a la respuesta correcta! ${b.explicacion || ""}`.trim() : msg || `${pasos} pasos${capturas ? ` · te atraparon ${capturas} ${capturas === 1 ? "vez" : "veces"}` : ""}`}</p>
    </div>
  );
}
