import React, { useMemo, useRef, useState } from "react";
import { TIPOS_BLOQUE, ESTILOS_DESTACADO, parsearTexto, urlSegura, videoIncrustable, requeridos, crearCrucigrama, crearRngLeccion } from "../lib/leccion";
import { Unir, Clasificar, Memorama, Diagrama, Completar, Anagrama, Ordenar, Trivia, Ruleta, Laberinto } from "./JuegosLeccion";
import { crearSopa, palabraEnLinea, crearCripto, estadoCripto, soloLetras } from "../game/acertijos";

const caja = "rounded-2xl border border-slate-200 bg-white p-4";
const titulo = (t) => (t ? <h4 className="text-sm font-bold text-slate-800 mb-2">{t}</h4> : null);
const Segs = ({ segs }) => segs.map((s, i) => (s.b ? <b key={i}>{s.texto}</b> : <React.Fragment key={i}>{s.texto}</React.Fragment>));

// ---------- bloques sencillos ----------
function Texto({ b }) {
  return (
    <div className="text-sm text-slate-700 leading-relaxed space-y-2">
      {titulo(b.titulo)}
      {parsearTexto(b.contenido).map((x, i) => x.t === "h" ? <h5 key={i} className="font-bold text-slate-800 pt-1">{x.texto}</h5>
        : x.t === "p" ? <p key={i}><Segs segs={x.segs} /></p>
        : x.t === "ul" ? <ul key={i} className="list-disc pl-5 space-y-0.5">{x.items.map((it, k) => <li key={k}><Segs segs={it} /></li>)}</ul>
        : <ol key={i} className="list-decimal pl-5 space-y-0.5">{x.items.map((it, k) => <li key={k}><Segs segs={it} /></li>)}</ol>)}
    </div>
  );
}
const COLORES = { idea: "bg-amber-50 border-amber-300", cita: "bg-sky-50 border-sky-300", oracion: "bg-violet-50 border-violet-300" };
function Destacado({ b }) {
  const e = ESTILOS_DESTACADO[b.estilo] || ESTILOS_DESTACADO.idea;
  return (
    <div className={`rounded-2xl border-l-4 p-4 ${COLORES[b.estilo] || COLORES.idea}`} data-testid="destacado">
      <div className="text-xs font-bold text-slate-600 mb-1">{e.emoji} {b.titulo || e.nombre}</div>
      <p className={`text-sm text-slate-800 whitespace-pre-wrap ${b.estilo !== "idea" ? "italic" : ""}`}>{b.contenido}</p>
      {b.fuente && <div className="text-[11px] text-slate-500 mt-1">— {b.fuente}</div>}
    </div>
  );
}
function Imagen({ b }) {
  const url = urlSegura(b.url); if (!url) return null;
  return <figure><img src={url} alt={b.descripcion} loading="lazy" className="w-full rounded-2xl border border-slate-200" />{(b.pie || b.descripcion) && <figcaption className="text-[11px] text-slate-500 mt-1">{b.pie || b.descripcion}</figcaption>}</figure>;
}
function Video({ b }) {
  const url = urlSegura(b.url); if (!url) return null; const emb = videoIncrustable(url);
  return (
    <div>{titulo(b.titulo)}
      {emb ? <div className="aspect-video"><iframe src={emb} title={b.titulo || "Video"} className="w-full h-full rounded-2xl" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>
        : <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-600 underline break-all">🎬 Abrir el video</a>}</div>
  );
}
function Enlace({ b }) {
  const url = urlSegura(b.url); if (!url) return null;
  return <div><a href={url} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-semibold px-4 py-2 rounded-xl bg-violet-500 text-white" data-testid="boton-enlace">🔗 {b.texto}</a>{b.descripcion && <p className="text-[11px] text-slate-500 mt-1">{b.descripcion}</p>}</div>;
}

// ---------- interactivos ----------
function Tarjetas({ b }) {
  const [vueltas, setVueltas] = useState({});
  return (
    <div>{titulo(b.titulo)}<p className="text-[11px] text-slate-500 mb-2">Toca una tarjeta para darle la vuelta.</p>
      <div className="grid grid-cols-2 gap-2">
        {b.tarjetas.map((t, i) => {
          const v = !!vueltas[i];
          return (
            <button key={i} type="button" onClick={() => setVueltas((x) => ({ ...x, [i]: !x[i] }))} className="relative h-28 w-full" style={{ perspective: "700px" }} data-testid={`tarjeta-${i}`} data-vuelta={v ? "1" : "0"} aria-label={v ? `Reverso: ${t.reverso}` : `Frente: ${t.frente}`}>
              <div className="absolute inset-0 transition-transform duration-500" style={{ transformStyle: "preserve-3d", transform: v ? "rotateY(180deg)" : "none" }}>
                <div className="absolute inset-0 rounded-2xl bg-violet-500 text-white flex items-center justify-center p-2 text-sm font-bold text-center" style={{ backfaceVisibility: "hidden" }}>{t.frente}</div>
                <div className="absolute inset-0 rounded-2xl bg-emerald-50 border border-emerald-300 text-slate-800 flex items-center justify-center p-2 text-xs text-center overflow-auto" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>{t.reverso}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
function Descubre({ b }) {
  const [abiertos, setAbiertos] = useState({});
  return (
    <div>{titulo(b.titulo)}
      <div className="space-y-2">{b.items.map((it, i) => (
        <div key={i} className="rounded-xl border border-slate-200 overflow-hidden">
          <button type="button" onClick={() => setAbiertos((x) => ({ ...x, [i]: !x[i] }))} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-800 bg-slate-50" aria-expanded={!!abiertos[i]} data-testid={`desc-${i}`}><span>{it.titulo}</span><span className="text-violet-500">{abiertos[i] ? "−" : "+"}</span></button>
          {abiertos[i] && <p className="px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">{it.contenido}</p>}
        </div>))}</div>
    </div>
  );
}
function Pasos({ b }) {
  const [visto, setVisto] = useState(1);
  return (
    <div>{titulo(b.titulo)}
      <ol className="space-y-2">{b.pasos.slice(0, visto).map((p, i) => (
        <li key={i} className="flex gap-3 rounded-xl border border-slate-200 p-3 bg-white" data-testid={`paso-${i}`}><span className="w-6 h-6 shrink-0 rounded-full bg-violet-500 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span><div className="text-sm text-slate-700">{p.titulo && <div className="font-semibold text-slate-800">{p.titulo}</div>}<div className="whitespace-pre-wrap">{p.contenido}</div></div></li>))}</ol>
      {visto < b.pasos.length ? <button type="button" onClick={() => setVisto((v) => v + 1)} className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white" data-testid="siguiente-paso">Siguiente paso →</button> : <p className="text-[11px] text-emerald-600 mt-2">Viste todos los pasos ✓</p>}
    </div>
  );
}
function Pregunta({ b, hecha, onAcierto }) {
  const [elegida, setElegida] = useState(null);
  const bien = hecha || (elegida != null && elegida === b.correcta);
  return (
    <div className={`${caja} ${bien ? "border-emerald-300 bg-emerald-50" : ""}`} data-testid={`preg-${b.id}`} data-ok={bien ? "1" : "0"}>
      <div className="text-[11px] font-bold text-violet-600 mb-1">❓ Pregunta rápida</div>
      <p className="text-sm text-slate-800 mb-2">{b.pregunta}</p>
      <div className="space-y-1.5">{b.opciones.map((o, i) => {
        const esta = elegida === i, malo = esta && !bien, bueno = bien && b.correcta === i;
        return <button key={i} type="button" disabled={bien} onClick={() => { setElegida(i); if (i === b.correcta) onAcierto(b.id); }} data-testid={`op-${b.id}-${i}`}
          className={`w-full text-left text-sm rounded-lg border px-3 py-2 ${bueno ? "bg-emerald-100 border-emerald-300" : malo ? "bg-rose-50 border-rose-300" : "bg-white border-slate-200"}`}>{String.fromCharCode(65 + i)}. {o}</button>;
      })}</div>
      {elegida != null && !bien && <p className="text-xs text-rose-600 mt-2" data-testid={`mal-${b.id}`}>Esa no es. ¡Inténtalo otra vez!</p>}
      {bien && <p className="text-xs text-emerald-700 mt-2" data-testid={`bien-${b.id}`}>✅ ¡Correcto!{b.explicacion ? " " + b.explicacion : ""}</p>}
    </div>
  );
}
function Reflexion({ b, guardada, onGuardar }) {
  const [texto, setTexto] = useState(guardada || "");
  const [estado, setEstado] = useState(guardada ? "ok" : "");   // "" | "guardando" | "ok" | mensaje de error
  const guardar = async () => {
    setEstado("guardando"); const r = await onGuardar(b.id, texto);
    setEstado(r && r.ok ? "ok" : (r && r.mensaje) || "No se pudo guardar.");
  };
  return (
    <div className={`${caja} border-violet-200 bg-violet-50`} data-testid={`refl-${b.id}`}>
      <div className="text-[11px] font-bold text-violet-600 mb-1">✍️ Reflexión personal</div>
      <p className="text-sm text-slate-800 mb-2">{b.consigna}</p>
      <textarea rows={4} maxLength={2000} value={texto} onChange={(e) => { setTexto(e.target.value); if (estado === "ok") setEstado(""); }} placeholder={b.ayuda || "Escribe aquí lo que piensas…"} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" aria-label="Tu reflexión" />
      <div className="flex items-center gap-2 mt-2">
        <button type="button" onClick={guardar} disabled={estado === "guardando" || !texto.trim()} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white disabled:opacity-50" data-testid={`guardar-${b.id}`}>{estado === "guardando" ? "Guardando…" : "Guardar mi reflexión"}</button>
        {estado === "ok" && <span className="text-xs text-emerald-600" data-testid={`guardada-${b.id}`}>Guardada ✓</span>}
        {estado && estado !== "ok" && estado !== "guardando" && <span className="text-xs text-rose-600">{estado}</span>}
      </div>
    </div>
  );
}

// ---------- juegos de palabras ----------
function Sopa({ b }) {
  const sopa = useMemo(() => crearSopa(b.palabras, { rand: crearRngLeccion(b.id) }), [b.id]);
  const [halladas, setHalladas] = useState([]); const [ok, setOk] = useState([]); const [primera, setPrimera] = useState(null);
  if (sopa.imposible) return null;
  const tocar = (r, c) => {
    if (!primera) { setPrimera([r, c]); return; }
    const hit = palabraEnLinea(sopa, primera, [r, c]); setPrimera(null);
    if (hit && !halladas.includes(hit.palabra)) { setHalladas((h) => [...h, hit.palabra]); setOk((o) => [...o, ...hit.celdas.map(([y, x]) => y + "," + x)]); }
  };
  const fin = halladas.length === sopa.palabras.length;
  return (
    <div data-testid="sopa">{titulo(b.titulo || "Sopa de letras")}<p className="text-[11px] text-slate-500 mb-2">Toca la primera y la última letra de cada palabra.</p>
      <div className="grid gap-0.5 max-w-sm" style={{ gridTemplateColumns: `repeat(${sopa.tam}, minmax(0,1fr))` }}>
        {sopa.grid.map((fila, r) => fila.map((l, c) => <button key={r + "," + c} type="button" onClick={() => tocar(r, c)} data-r={r} data-c={c} className={`aspect-square text-[11px] font-bold rounded ${ok.includes(r + "," + c) ? "bg-emerald-200 text-emerald-900" : primera && primera[0] === r && primera[1] === c ? "bg-amber-200" : "bg-slate-100 text-slate-700"}`}>{l}</button>))}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">{sopa.palabras.map((p) => <span key={p} className={`text-[11px] px-2 py-0.5 rounded-full ${halladas.includes(p) ? "bg-emerald-100 text-emerald-700 line-through" : "bg-slate-100 text-slate-600"}`}>{p}</span>)}</div>
      <p className="text-xs mt-1 text-slate-500" data-testid="sopa-msg">{fin ? "🎉 ¡Encontraste todas las palabras!" : `${halladas.length}/${sopa.palabras.length} palabras`}</p>
    </div>
  );
}
function Crucigrama({ b }) {
  const cr = useMemo(() => crearCrucigrama(b.entradas, { rand: crearRngLeccion(b.id) }), [b.id]);
  const [resp, setResp] = useState({}); const [comprobado, setComprobado] = useState(false);
  const refs = useRef({});
  if (cr.imposible) return null;
  const numeros = new Map(); cr.entradas.forEach((e) => numeros.set(e.fila + "," + e.col, e.num));
  const poner = (r, c, valor) => {
    const l = soloLetras(valor).slice(-1); setComprobado(false); setResp((x) => ({ ...x, [r + "," + c]: l }));
    if (l) { const sig = [`${r},${c + 1}`, `${r + 1},${c}`].find((k) => refs.current[k]); if (sig) refs.current[sig].focus(); }
  };
  const total = cr.celdas.flat().filter(Boolean).length, correctas = cr.celdas.flat().reduce((n, l, i) => n + (l && resp[Math.floor(i / cr.columnas) + "," + (i % cr.columnas)] === l ? 1 : 0), 0);
  const completo = correctas === total;
  const lista = (dir) => cr.entradas.filter((e) => e.dir === dir);
  return (
    <div data-testid="crucigrama">{titulo(b.titulo || "Crucigrama")}
      <div className="grid gap-0.5 max-w-md" style={{ gridTemplateColumns: `repeat(${cr.columnas}, minmax(0,1fr))` }}>
        {cr.celdas.map((fila, r) => fila.map((l, c) => {
          if (!l) return <div key={r + "," + c} className="aspect-square" />;
          const k = r + "," + c, v = resp[k] || "", mal = comprobado && v && v !== l, bien = comprobado && v === l;
          return (
            <div key={k} className="relative aspect-square">
              {numeros.has(k) && <span className="absolute left-0.5 top-0 text-[8px] text-slate-500 leading-none z-10">{numeros.get(k)}</span>}
              <input ref={(el) => { if (el) refs.current[k] = el; else delete refs.current[k]; }} value={v} onChange={(e) => poner(r, c, e.target.value)} maxLength={2} inputMode="text" autoCapitalize="characters" aria-label={`Celda ${r + 1},${c + 1}`} data-cel={k}
                className={`w-full h-full text-center text-sm font-bold uppercase rounded border outline-none ${mal ? "bg-rose-100 border-rose-400" : bien ? "bg-emerald-100 border-emerald-400" : "bg-white border-slate-300 focus:border-violet-500"}`} />
            </div>
          );
        }))}
      </div>
      <div className="grid sm:grid-cols-2 gap-2 mt-3 text-xs text-slate-700">
        {["H", "V"].map((d) => <div key={d}><div className="font-bold text-slate-800 mb-1">{d === "H" ? "➡️ Horizontales" : "⬇️ Verticales"}</div><ul className="space-y-0.5">{lista(d).map((e) => <li key={e.num + d}><b>{e.num}.</b> {e.pista} <span className="text-slate-400">({e.palabra.length})</span></li>)}</ul></div>)}
      </div>
      <div className="flex items-center gap-2 mt-2"><button type="button" onClick={() => setComprobado(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white" data-testid="comprobar-cruci">Comprobar</button>
        <span className="text-xs text-slate-500" data-testid="cruci-msg">{comprobado && completo ? "🎉 ¡Completaste el crucigrama!" : comprobado ? "Las letras en rojo no son. ¡Corrígelas!" : ""}</span></div>
    </div>
  );
}
function Criptograma({ b }) {
  const cr = useMemo(() => crearCripto(b.frase, { rand: crearRngLeccion(b.id) }), [b.id]);
  const [intentos, setIntentos] = useState({}); const [sel, setSel] = useState(null);
  if (cr.imposible) return null;
  const valor = (cod) => cr.pistas[cod] || intentos[cod] || "";
  const est = estadoCripto(cr, intentos), malos = est.faltan === 0 ? new Set(est.mal) : new Set();
  const poner = (l) => { if (sel == null || cr.pistas[sel]) return; setIntentos((x) => ({ ...x, [sel]: l })); const sig = Object.keys(cr.respuestaDe).map(Number).find((k) => k !== sel && !valor(k)); if (sig != null) setSel(sig); };
  const grupos = []; let g = []; cr.celdas.forEach((c) => { if (c.ch === " ") { if (g.length) grupos.push(g); g = []; } else g.push(c); }); if (g.length) grupos.push(g);
  return (
    <div data-testid="criptograma">{titulo(b.titulo || "Criptograma")}
      {b.pista && <p className="text-xs text-slate-600 mb-1">💡 {b.pista}</p>}<p className="text-[11px] text-slate-500 mb-2">Cada número es una letra. Toca un número y elige la letra. Las de fondo dorado ya están dadas.</p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">{grupos.map((gr, i) => <span key={i} className="inline-flex gap-0.5">{gr.map((c, k) => c.codigo == null ? <span key={k} className="self-end text-slate-600 px-0.5">{c.ch}</span>
        : <button key={k} type="button" onClick={() => setSel(c.codigo)} data-cod={c.codigo} className={`w-7 rounded border flex flex-col items-center ${cr.pistas[c.codigo] ? "bg-amber-100 border-amber-300" : sel === c.codigo ? "border-violet-500 bg-violet-50" : malos.has(c.codigo) ? "bg-rose-100 border-rose-400" : "bg-white border-slate-300"}`}><span className="text-sm font-bold h-5 leading-5">{valor(c.codigo) || " "}</span><span className="text-[9px] text-slate-500">{c.codigo}</span></button>)}</span>)}</div>
      <div className="flex flex-wrap gap-1 mt-3">{[..."ABCDEFGHIJKLMNÑOPQRSTUVWXYZ"].map((l) => <button key={l} type="button" onClick={() => poner(l)} data-l={l} className="w-7 h-7 text-xs font-bold rounded bg-slate-100 text-slate-700">{l}</button>)}</div>
      <p className="text-xs mt-2 text-slate-500" data-testid="cripto-msg">{est.resuelto ? "🎉 ¡Descifraste la frase!" : est.faltan === 0 ? "Hay letras mal puestas (en rojo)." : `Faltan ${est.faltan} letras por descubrir`}</p>
    </div>
  );
}

// ---------- la lección ----------
/**
 * actividad = { id, titulo, bloques }  ·  hecha = ya la terminó  ·  reflexiones = { [bloqueId]: texto }
 * onGuardarReflexion(bloqueId, texto) → { ok, mensaje }  ·  onTerminar() → Promise (el que da el premio)
 */
export function LeccionVista({ actividad, hecha = false, reflexiones = {}, onGuardarReflexion, onTerminar }) {
  const bloques = actividad.bloques || [];
  const req = requeridos(bloques);
  const [acertadas, setAcertadas] = useState([]);
  const [guardadas, setGuardadas] = useState(() => Object.keys(reflexiones).filter((k) => String(reflexiones[k] || "").trim()));
  const [ocupado, setOcupado] = useState(false);
  const faltanP = hecha ? 0 : req.preguntas.filter((id) => !acertadas.includes(id)).length;
  const faltanR = hecha ? 0 : req.reflexiones.filter((id) => !guardadas.includes(id)).length;
  const guardar = async (id, texto) => { const r = await onGuardarReflexion(id, texto); if (r && r.ok) setGuardadas((g) => (g.includes(id) ? g : [...g, id])); return r; };
  const pintar = (b) => {
    switch (b.tipo) {
      case "texto": return <Texto b={b} />;
      case "destacado": return <Destacado b={b} />;
      case "imagen": return <Imagen b={b} />;
      case "video": return <Video b={b} />;
      case "tarjetas": return <Tarjetas b={b} />;
      case "descubre": return <Descubre b={b} />;
      case "pasos": return <Pasos b={b} />;
      case "pregunta": return <Pregunta b={b} hecha={hecha} onAcierto={(id) => setAcertadas((a) => (a.includes(id) ? a : [...a, id]))} />;
      case "reflexion": return <Reflexion b={b} guardada={reflexiones[b.id]} onGuardar={guardar} />;
      case "enlace": return <Enlace b={b} />;
      case "sopa": return <Sopa b={b} />;
      case "crucigrama": return <Crucigrama b={b} />;
      case "criptograma": return <Criptograma b={b} />;
      case "unir": return <Unir b={b} />;
      case "clasificar": return <Clasificar b={b} />;
      case "memorama": return <Memorama b={b} />;
      case "diagrama": return <Diagrama b={b} />;
      case "completar": return <Completar b={b} />;
      case "anagrama": return <Anagrama b={b} />;
      case "linea": case "jerarquia": return <Ordenar b={b} />;
      case "trivia": return <Trivia b={b} />;
      case "ruleta": return <Ruleta b={b} />;
      case "laberinto": return <Laberinto b={b} />;
      default: return null;
    }
  };
  const terminar = async () => { setOcupado(true); try { await onTerminar(); } finally { setOcupado(false); } };
  return (
    <div className="space-y-4" data-testid="leccion">
      {bloques.filter((b) => TIPOS_BLOQUE[b.tipo]).map((b) => { const x = pintar(b); return x ? <div key={b.id} data-bloque={b.tipo}>{x}</div> : null; })}
      {!hecha && (
        <div className="pt-2">
          <button type="button" onClick={terminar} disabled={ocupado || faltanP > 0 || faltanR > 0} className="text-sm font-semibold px-4 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-50" data-testid="terminar-leccion">✅ Terminé la lección</button>
          {(faltanP > 0 || faltanR > 0) && <p className="text-[11px] text-slate-500 mt-1" data-testid="faltan">Para terminar te falta: {[faltanP > 0 && `${faltanP} ${faltanP === 1 ? "pregunta" : "preguntas"} por acertar`, faltanR > 0 && `${faltanR} ${faltanR === 1 ? "reflexión" : "reflexiones"} por guardar`].filter(Boolean).join(" y ")}.</p>}
        </div>
      )}
    </div>
  );
}
