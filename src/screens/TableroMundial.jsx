import React, { useEffect, useMemo, useRef, useState } from "react";
import * as api from "../lib/api";
import * as tm from "../lib/tableroMundialApi";
import * as dg from "../lib/dominioGlobal";

const FASES = { evento: "1. Evento mundial", acciones: "2. Acciones", votacion: "3. Votación de declaratorias", cierre: "3. Cierre de ronda", fin: "Fin de la partida" };
const AYUDA_FASE = {
  evento: "Lean la carta y elijan cómo responde cada nación. Quien no se pronuncia pierde ética y paz.",
  acciones: "Refuercen sus territorios, ataquen (si se atreven), envíen ayuda, firmen o rompan alianzas y propongan una declaratoria mundial.",
  votacion: "Todas las naciones votan las declaratorias propuestas. Se aprueban si hay más votos a favor que en contra.",
  cierre: "No hay declaratorias que votar. El docente cierra la ronda.",
  fin: "La partida terminó. Conversen: ¿qué decisiones construyeron paz y cuáles la destruyeron?",
};
const clon = (o) => JSON.parse(JSON.stringify(o));

// ============================================================ MAPA
export function MapaMundo({ estado, resaltar, seleccion, onClickTerr, desdeSel, alcance }) {
  const W = 1000, H = 540;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto rounded-2xl select-none" style={{ background: "linear-gradient(180deg,#0e2a47,#13395f)" }}>
      {dg.ENLACES.map(([a, b]) => {
        const A = dg.mapaTerr[a], B = dg.mapaTerr[b];
        if ((a === "NA" && b === "PA") || (a === "PA" && b === "NA")) return (<g key={a + b} stroke="#7aa2c9" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6"><line x1={A.x} y1={A.y} x2={0} y2={A.y + 30} /><line x1={B.x} y1={B.y} x2={W} y2={B.y - 30} /></g>);
        const grande = Math.hypot(A.x - B.x, A.y - B.y) > 260;
        return <line key={a + b} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#7aa2c9" strokeWidth={grande ? 1.2 : 2} strokeDasharray={grande ? "5 6" : undefined} opacity="0.55" />;
      })}
      {dg.TERRITORIOS.map((t) => {
        const s = estado.terr[t.id]; const n = estado.naciones[s.d];
        const sel = seleccion === t.id, ds = desdeSel === t.id; const alc = alcance?.includes(t.id);
        const mio = resaltar && s.d === resaltar;
        return (
          <g key={t.id} transform={`translate(${t.x},${t.y})`} onClick={() => onClickTerr?.(t.id)} style={{ cursor: onClickTerr ? "pointer" : "default" }}>
            <title>{`${t.nombre} — ${n.nombre} (${s.t} ejércitos)`}</title>
            {(sel || ds || alc) && <circle r="34" fill="none" stroke={ds ? "#fde047" : alc ? "#f87171" : "#fff"} strokeWidth="3" strokeDasharray={alc ? "5 4" : undefined} />}
            <circle r={mio ? 28 : 25} fill={n.color} stroke={mio ? "#fff" : "#0b1d33"} strokeWidth={mio ? 4 : 2.5} opacity={n.eliminada ? 0.5 : 1} />
            <text textAnchor="middle" y="6" fontSize="19" fontWeight="800" fill="#fff" stroke="#0b1d33" strokeWidth="3" paintOrder="stroke">{s.t}</text>
            <text textAnchor="middle" y="46" fontSize="11.5" fontWeight="600" fill="#e2efff" stroke="#0b1d33" strokeWidth="3" paintOrder="stroke">{t.nombre}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Barra({ valor, color }) {
  return <div className="h-1.5 rounded bg-slate-200 overflow-hidden"><div className="h-full" style={{ width: `${valor}%`, background: color }} /></div>;
}

export function TablaNaciones({ estado, nacionPropia, onElegir, elegida }) {
  const p = useMemo(() => dg.puntajes(estado), [estado]);
  const mundo = Math.round(dg.paxMundial(estado));
  return (
    <div className="space-y-2">
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-2">
        <div className="flex justify-between text-[11px] font-semibold text-slate-600"><span>🕊 Paz mundial</span><span>{mundo}/100</span></div>
        <Barra valor={mundo} color={mundo < 25 ? "#dc2626" : mundo < 50 ? "#f59e0b" : "#16a34a"} />
        {mundo < 25 && <div className="text-[11px] text-rose-600 mt-1">⚠️ El mundo está al borde del colapso: si termina así, los puntajes de equilibrio se reducen a la mitad.</div>}
      </div>
      {p.map((n) => (
        <button key={n.nid} onClick={() => onElegir?.(n.nid)} className={`w-full text-left rounded-xl border p-2 ${elegida === n.nid ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-white"} ${n.eliminada ? "opacity-50" : ""}`}>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: n.color }} />
            <span className="text-sm font-semibold flex-1 truncate">{n.nombre}{nacionPropia === n.nid ? " (tú)" : ""}{n.eliminada ? " · refugiados" : ""}</span>
            <span className="text-[11px] text-slate-500">{n.territorios} terr · {n.ejercitos} ⚔</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-1 text-[10px] text-slate-500">
            <div>Ética {n.etica}<Barra valor={n.etica} color="#7c3aed" /></div>
            <div>Paz {n.paz}<Barra valor={n.paz} color="#0891b2" /></div>
            <div>Recursos {n.recursos} · 🤝 {n.aliados}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

export function CartaView({ carta, elegida, onElegir, deshabilitado, mostrarEfectos }) {
  if (!carta) return null;
  const color = { etica: "#7c3aed", interreligioso: "#0891b2", crisis: "#dc2626" }[carta.tipo] || "#475569";
  return (
    <div className="rounded-2xl border-2 bg-white p-3" style={{ borderColor: color }}>
      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{dg.TIPOS_CARTA[carta.tipo] || "Evento"}</div>
      <div className="text-base font-extrabold text-slate-800">{carta.titulo}</div>
      <p className="text-sm text-slate-600 mb-2">{carta.texto}</p>
      <div className="space-y-1">
        {carta.opciones.map((o, i) => (
          <button key={i} disabled={deshabilitado} onClick={() => onElegir?.(i)} className={`w-full text-left text-sm rounded-lg border px-3 py-2 ${elegida === i ? "bg-violet-100 border-violet-400" : "bg-slate-50 border-slate-200"} disabled:opacity-60`}>
            <b>{String.fromCharCode(65 + i)}.</b> {o.texto}
            {mostrarEfectos && <span className="block text-[10px] text-slate-400">ej {o.efectos.ejercitos} · rec {o.efectos.recursos} · paz {o.efectos.paz} · ét {o.efectos.etica}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================ PANEL DE ACCIONES (compartido)
export function PanelAcciones({ estado, nacion, misAcciones = [], onEnviar, onBorrar }) {
  const [tab, setTab] = useState("refuerzo");
  const [f, setF] = useState({});
  const [msg, setMsg] = useState("");
  const [enviando, setEnviando] = useState(false);
  const nac = estado.naciones[nacion];
  const propios = dg.territoriosDe(estado, nacion);
  const enviar = async (tipo, payload) => {
    setEnviando(true); setMsg("");
    try { await onEnviar(tipo, payload); setF({}); setMsg("✔ Enviado"); } catch (e) { setMsg(tm.mensajeJuego(e)); }
    setEnviando(false);
  };
  const otras = estado.orden.filter((n) => n !== nacion);
  const sel = "text-sm rounded-lg px-2 py-1.5 border border-slate-200 bg-white";
  const btn = "text-sm px-3 py-1.5 rounded-lg bg-violet-600 text-white disabled:opacity-40";
  const nombreAcc = (a) => {
    const p = a.payload || {};
    const nn = (id) => estado.naciones[id]?.nombre || id;
    const tt = (id) => dg.mapaTerr[id]?.nombre || id;
    if (a.tipo === "evento") return `Respuesta a la carta: opción ${String.fromCharCode(65 + Number(p.opcion))}`;
    if (a.tipo === "refuerzo") return `Refuerzo: ${p.n} en ${tt(p.terr)}`;
    if (a.tipo === "ataque") return `Ataque: ${tt(p.desde)} → ${tt(p.hacia)} con ${p.n}`;
    if (a.tipo === "ayuda") return `Ayuda: ${p.cantidad} recurso(s) a ${nn(p.a)}`;
    if (a.tipo === "pacto") return p.tipo === "alianza" ? `Alianza con ${nn(p.con)}` : `Romper alianza con ${nn(p.con)}`;
    if (a.tipo === "propuesta") return `Propuesta: ${dg.DECLARATORIAS[p.tipo]?.nombre}${p.objetivo ? " contra " + nn(p.objetivo) : ""}`;
    if (a.tipo === "voto") return `Voto «${p.voto}» a ${p.propuesta}`;
    return a.tipo;
  };
  if (!nac) return null;

  return (
    <div className="space-y-2">
      {estado.fase === "evento" && (
        <div>
          <CartaView carta={estado.carta} elegida={misAcciones.find((a) => a.tipo === "evento")?.payload?.opcion} onElegir={(i) => enviar("evento", { opcion: i })} deshabilitado={enviando} />
          <p className="text-[11px] text-slate-400 mt-1">Puedes cambiar tu respuesta mientras la fase siga abierta.</p>
        </div>
      )}
      {estado.fase === "acciones" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
          <div className="flex flex-wrap gap-1">
            {[["refuerzo", "🛡 Reforzar"], ["ataque", "⚔ Atacar"], ["ayuda", "🎁 Ayuda"], ["pacto", "🤝 Alianzas"], ["propuesta", "📜 Declaratoria"]].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`text-xs px-2.5 py-1 rounded-full border ${tab === k ? "bg-violet-600 text-white border-violet-600" : "bg-white text-slate-600 border-slate-200"}`}>{l}</button>
            ))}
          </div>
          {tab === "refuerzo" && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs text-slate-500">Cupo esta ronda: {dg.refuerzosDe(estado, nacion)}</span>
              <select className={sel} value={f.terr || ""} onChange={(e) => setF({ ...f, terr: e.target.value })}><option value="">Territorio…</option>{propios.map((t) => <option key={t} value={t}>{dg.mapaTerr[t].nombre}</option>)}</select>
              <input type="number" min="1" className={sel + " w-16"} value={f.n || ""} onChange={(e) => setF({ ...f, n: e.target.value })} placeholder="Cant." />
              <button disabled={!f.terr || !f.n || enviando} className={btn} onClick={() => enviar("refuerzo", { terr: f.terr, n: Number(f.n) })}>Enviar</button>
              <span className="text-[11px] text-slate-400 w-full">Lo que no repartas se coloca solo en tu territorio más débil.</span>
            </div>
          )}
          {tab === "ataque" && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <select className={sel} value={f.desde || ""} onChange={(e) => setF({ ...f, desde: e.target.value, hacia: "" })}><option value="">Desde…</option>{propios.filter((t) => estado.terr[t].t > 1).map((t) => <option key={t} value={t}>{dg.mapaTerr[t].nombre} ({estado.terr[t].t})</option>)}</select>
              <select className={sel} value={f.hacia || ""} onChange={(e) => setF({ ...f, hacia: e.target.value })}><option value="">Hacia…</option>{(f.desde ? dg.vecinos(f.desde).filter((t) => estado.terr[t].d !== nacion && !dg.sonAliadas(estado, nacion, estado.terr[t].d)) : []).map((t) => <option key={t} value={t}>{dg.mapaTerr[t].nombre} — {estado.naciones[estado.terr[t].d].nombre} ({estado.terr[t].t})</option>)}</select>
              <input type="number" min="1" className={sel + " w-16"} value={f.n || ""} onChange={(e) => setF({ ...f, n: e.target.value })} placeholder="Ejérc." />
              <button disabled={!f.desde || !f.hacia || !f.n || enviando} className={btn} onClick={() => enviar("ataque", { desde: f.desde, hacia: f.hacia, n: Number(f.n) })}>Enviar</button>
              <span className="text-[11px] text-amber-600 w-full">Atacar cuesta 3 de ética y daña la paz del atacado; conquistar cuesta 2 de ética más.</span>
            </div>
          )}
          {tab === "ayuda" && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs text-slate-500">Tienes {nac.recursos} recursos</span>
              <select className={sel} value={f.a || ""} onChange={(e) => setF({ ...f, a: e.target.value })}><option value="">A quién…</option>{otras.map((n) => <option key={n} value={n}>{estado.naciones[n].nombre}</option>)}</select>
              <input type="number" min="1" max={nac.recursos} className={sel + " w-16"} value={f.cantidad || ""} onChange={(e) => setF({ ...f, cantidad: e.target.value })} placeholder="Cant." />
              <button disabled={!f.a || !f.cantidad || enviando} className={btn} onClick={() => enviar("ayuda", { a: f.a, cantidad: Number(f.cantidad) })}>Enviar</button>
            </div>
          )}
          {tab === "pacto" && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <select className={sel} value={f.con || ""} onChange={(e) => setF({ ...f, con: e.target.value })}><option value="">Con quién…</option>{otras.map((n) => <option key={n} value={n}>{estado.naciones[n].nombre}{dg.sonAliadas(estado, nacion, n) ? " (aliada)" : ""}</option>)}</select>
              <button disabled={!f.con || enviando} className={btn} onClick={() => enviar("pacto", { tipo: "alianza", con: f.con })}>Proponer alianza</button>
              <button disabled={!f.con || enviando} className="text-sm px-3 py-1.5 rounded-lg border border-rose-300 text-rose-600 disabled:opacity-40" onClick={() => enviar("pacto", { tipo: "romper", con: f.con })}>Romper alianza</button>
              <span className="text-[11px] text-slate-400 w-full">La alianza solo se firma si la otra nación también la propone.</span>
            </div>
          )}
          {tab === "propuesta" && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <select className={sel} value={f.tipo || ""} onChange={(e) => setF({ ...f, tipo: e.target.value })}><option value="">Declaratoria…</option>{Object.entries(dg.DECLARATORIAS).map(([k, d]) => <option key={k} value={k}>{d.nombre}</option>)}</select>
              {f.tipo && dg.DECLARATORIAS[f.tipo].objetivo && <select className={sel} value={f.objetivo || ""} onChange={(e) => setF({ ...f, objetivo: e.target.value })}><option value="">Contra…</option>{otras.map((n) => <option key={n} value={n}>{estado.naciones[n].nombre}</option>)}</select>}
              <button disabled={!f.tipo || (dg.DECLARATORIAS[f.tipo]?.objetivo && !f.objetivo) || enviando} className={btn} onClick={() => enviar("propuesta", { tipo: f.tipo, objetivo: f.objetivo })}>Proponer</button>
              {f.tipo && <span className="text-[11px] text-slate-500 w-full">{dg.DECLARATORIAS[f.tipo].texto}</span>}
            </div>
          )}
        </div>
      )}
      {estado.fase === "votacion" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
          {estado.propuestas.map((p) => {
            const mi = misAcciones.find((a) => a.tipo === "voto" && a.payload?.propuesta === p.id)?.payload?.voto;
            const d = dg.DECLARATORIAS[p.tipo];
            return (
              <div key={p.id} className="rounded-xl bg-slate-50 p-2">
                <div className="text-sm font-semibold">{d.nombre}{p.objetivo ? ` contra ${estado.naciones[p.objetivo].nombre}` : ""}</div>
                <div className="text-[11px] text-slate-500">Propone {estado.naciones[p.por].nombre}. {d.texto}</div>
                {p.por === nacion ? <div className="text-[11px] text-violet-600 mt-1">Tu propuesta cuenta como voto a favor.</div> : (
                  <div className="flex gap-1 mt-1">
                    {[["si", "👍 A favor"], ["no", "👎 En contra"], ["abs", "✋ Abstenerme"]].map(([v, l]) => (
                      <button key={v} disabled={enviando} onClick={() => enviar("voto", { propuesta: p.id, voto: v })} className={`text-xs px-2.5 py-1 rounded-full border ${mi === v ? "bg-violet-600 text-white border-violet-600" : "bg-white border-slate-200 text-slate-600"}`}>{l}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {msg && <div className={`text-xs ${msg.startsWith("✔") ? "text-emerald-600" : "text-rose-600"}`}>{msg}</div>}
      {misAcciones.filter((a) => a.tipo !== "evento" && a.tipo !== "voto").length > 0 && (
        <div className="rounded-xl bg-slate-50 p-2">
          <div className="text-[11px] font-semibold text-slate-500 mb-1">Acciones enviadas esta ronda</div>
          {misAcciones.filter((a) => a.tipo !== "evento" && a.tipo !== "voto").map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-xs"><span className="flex-1">{nombreAcc(a)}</span>{onBorrar && <button onClick={() => onBorrar(a.id)} className="text-slate-400 hover:text-rose-500">🗑</button>}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function Bitacora({ estado, n = 14 }) {
  const lineas = estado.bitacora.slice(-n).reverse();
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2 max-h-64 overflow-y-auto">
      <div className="text-[11px] font-semibold text-slate-500 mb-1">📰 Diario del mundo</div>
      {lineas.map((l, i) => <div key={i} className="text-xs text-slate-600 py-0.5 border-b border-slate-50"><span className="text-slate-400">R{l.r}</span> {l.txt}</div>)}
    </div>
  );
}

function Resultados({ estado }) {
  const r = estado.fin || dg.resultados(estado);
  const v = estado.victoria;
  const Lista = ({ titulo, datos, campo, extra }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="font-bold text-sm mb-1">{titulo}</div>
      {datos.map((n, i) => (
        <div key={n.nid} className="flex items-center gap-2 text-sm py-0.5"><span className="w-5">{["🥇", "🥈", "🥉"][i] || i + 1}</span><span className="w-3 h-3 rounded-full" style={{ background: n.color }} /><span className="flex-1">{n.nombre}</span><b>{n[campo]}</b><span className="text-[11px] text-slate-400">{extra(n)}</span></div>
      ))}
    </div>
  );
  return (
    <div className="space-y-2">
      {r.colapso && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm p-3">💥 La paz mundial cayó por debajo de 25: el mundo colapsó y los puntajes de equilibrio se redujeron a la mitad. Conquistar sin cuidar a los demás tiene un costo para todos.</div>}
      <div className="grid md:grid-cols-2 gap-2">
        {v !== "dominacion" && <Lista titulo="⚖️ Equilibrio (territorio + paz + ética)" datos={r.equilibrio} campo="equilibrio" extra={(n) => `${n.territorios} terr · ét ${n.etica} · paz ${n.paz}`} />}
        {v !== "equilibrio" && <Lista titulo="🏴 Dominación (territorios)" datos={r.dominacion} campo="territorios" extra={(n) => `${n.ejercitos} ⚔`} />}
      </div>
      <div className="rounded-xl bg-violet-50 text-sm text-slate-700 p-3">
        <b>Para conversar:</b>
        <ul className="list-disc pl-5 mt-1 space-y-0.5">
          <li>¿Quién ganó por dominación y quién por equilibrio? ¿Coinciden? ¿Por qué?</li>
          <li>¿Qué decisión de una carta les costó más tomar y por qué?</li>
          <li>¿Cuándo convenía cooperar aunque se perdiera ventaja? ¿Les pasa algo parecido en la vida real?</li>
          <li>¿Qué hizo que una declaratoria fuera aprobada o rechazada?</li>
          <li>¿Cómo se sintieron las naciones que perdieron todo su territorio?</li>
        </ul>
      </div>
    </div>
  );
}

// ============================================================ DOCENTE
export function VistaTableroMundial({ grados = [], gradoActivo }) {
  const [gradoId, setGradoId] = useState(gradoActivo || grados[0]?.id || "");
  const [lista, setLista] = useState([]);
  const [abierta, setAbierta] = useState(null);
  const [creando, setCreando] = useState(false);
  const [bancoAbierto, setBancoAbierto] = useState(false);
  const [error, setError] = useState("");
  const cargar = () => tm.fetchPartidas(gradoId).then(setLista).catch((e) => setError(tm.mensajeJuego(e)));
  useEffect(() => { if (gradoId) cargar(); }, [gradoId]);
  if (abierta) return <PartidaDocente id={abierta} onVolver={() => { setAbierta(null); cargar(); }} />;
  return (
    <div className="w-full max-w-5xl mx-auto space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-lg px-2 py-2 border border-slate-200 bg-white">{grados.map((g) => <option key={g.id} value={g.id}>{g.nombre || g.id}</option>)}</select>
        <button onClick={() => setCreando(!creando)} className="text-sm px-3 py-2 rounded-lg bg-violet-600 text-white">{creando ? "Cancelar" : "➕ Nueva partida"}</button>
        <button onClick={() => setBancoAbierto(!bancoAbierto)} className="text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white">🃏 Mis cartas de evento</button>
      </div>
      {error && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2">{error}</div>}
      {bancoAbierto && <BancoCartas />}
      {creando && <FormPartida gradoId={gradoId} onListo={(p) => { setCreando(false); setAbierta(p.id); }} />}
      {lista.length === 0 && !creando && <p className="text-xs text-slate-400">Aún no hay partidas en este curso. Crea una para empezar a jugar.</p>}
      {lista.map((p) => (
        <button key={p.id} onClick={() => setAbierta(p.id)} className="w-full text-left bg-white border border-slate-200 rounded-xl p-3 hover:border-violet-300">
          <div className="flex items-center gap-2"><span className="text-xl">🌍</span><span className="font-semibold text-sm flex-1">{p.titulo}</span>
            <span className="text-[11px] text-slate-500">{p.estado.fase === "fin" ? "Terminada" : `Ronda ${p.estado.ronda}/${p.estado.rondasMax} · ${FASES[p.estado.fase]}`}</span></div>
          <div className="text-[11px] text-slate-400 ml-8">{{ mesa: "Moderada por ti", dispositivos: "Desde dispositivos", semanal: "Por turnos semanales" }[p.modo]} · {p.estado.orden.length} naciones</div>
        </button>
      ))}
    </div>
  );
}

function FormPartida({ gradoId, onListo }) {
  const [titulo, setTitulo] = useState("");
  const [modo, setModo] = useState("mesa");
  const [jugadores, setJugadores] = useState("reinos");
  const [cantidad, setCantidad] = useState(5);
  const [victoria, setVictoria] = useState("ambas");
  const [rondas, setRondas] = useState(8);
  const [tipos, setTipos] = useState(Object.keys(dg.TIPOS_CARTA));
  const [conPropias, setConPropias] = useState(true);
  const [error, setError] = useState(""); const [guardando, setGuardando] = useState(false);
  const inp = "text-sm rounded-lg px-2 py-1.5 border border-slate-200 bg-white outline-none w-full";
  const crear = async () => {
    if (!titulo.trim()) return setError("Ponle un título a la partida.");
    setGuardando(true); setError("");
    try {
      const ests = (await api.fetchEstudiantesPorGrado(gradoId)).filter((s) => s.activo !== false);
      if (ests.length < 2) throw new Error("El curso necesita al menos 2 estudiantes.");
      const naciones = dg.armarNaciones({ jugadores, estudiantes: ests, cantidad: Number(cantidad) });
      if (naciones.length < 2) throw new Error("Con esa configuración se forma menos de 2 naciones (revisa los reinos del curso).");
      const propias = conPropias ? (await tm.fetchCartas()).map((c) => ({ id: "p" + c.id, tipo: c.tipo, titulo: c.titulo, texto: c.texto, opciones: c.opciones })) : [];
      const mazo = dg.armarMazo({ tipos, propias, rondas: Number(rondas) });
      const estado = dg.crearEstado({ naciones, rondasMax: Number(rondas), victoria, mazo });
      const p = await tm.crearPartida({ grado_id: gradoId, titulo: titulo.trim(), modo, jugadores, victoria, estado });
      onListo(p);
    } catch (e) { setError(e.message || String(e)); } finally { setGuardando(false); }
  };
  return (
    <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 space-y-2">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (ej. Cumbre mundial 802)" className={inp} />
      <div className="grid md:grid-cols-3 gap-2">
        <label className="text-xs text-slate-600">¿Cómo se juega?<select value={modo} onChange={(e) => setModo(e.target.value)} className={inp}><option value="mesa">Yo moderé en el proyector</option><option value="dispositivos">Equipos desde sus dispositivos</option><option value="semanal">Turnos semanales</option></select></label>
        <label className="text-xs text-slate-600">¿Quiénes son las naciones?<select value={jugadores} onChange={(e) => setJugadores(e.target.value)} className={inp}><option value="reinos">Los reinos del curso</option><option value="equipos">Equipos al azar</option><option value="individual">Cada estudiante (máx. 12)</option></select></label>
        <label className="text-xs text-slate-600">¿Cómo se gana?<select value={victoria} onChange={(e) => setVictoria(e.target.value)} className={inp}><option value="ambas">Equilibrio y dominación (ambos)</option><option value="equilibrio">Solo equilibrio</option><option value="dominacion">Solo dominación</option></select></label>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        {jugadores === "equipos" && <label>Equipos <input type="number" min="2" max="12" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="w-14 rounded px-1 border border-slate-200" /></label>}
        <label>Rondas <input type="number" min="3" max="20" value={rondas} onChange={(e) => setRondas(e.target.value)} className="w-14 rounded px-1 border border-slate-200" /></label>
        {Object.entries(dg.TIPOS_CARTA).map(([k, l]) => <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={tipos.includes(k)} onChange={(e) => setTipos(e.target.checked ? [...tipos, k] : tipos.filter((x) => x !== k))} />{l}</label>)}
        <label className="flex items-center gap-1"><input type="checkbox" checked={conPropias} onChange={(e) => setConPropias(e.target.checked)} />Incluir mis cartas</label>
      </div>
      {error && <div className="text-xs text-rose-600">{error}</div>}
      <button disabled={guardando || tipos.length === 0} onClick={crear} className="text-sm px-3 py-2 rounded-lg bg-violet-600 text-white disabled:opacity-50">{guardando ? "Creando…" : "Crear partida"}</button>
    </div>
  );
}

function FormCarta({ onGuardar, etiqueta = "Guardar carta" }) {
  const vacia = () => ({ texto: "", efectos: { ejercitos: 0, recursos: 0, paz: 0, etica: 0 } });
  const [tipo, setTipo] = useState("etica"); const [titulo, setTitulo] = useState(""); const [texto, setTexto] = useState("");
  const [ops, setOps] = useState([vacia(), vacia(), vacia()]);
  const [error, setError] = useState("");
  const inp = "text-sm rounded-lg px-2 py-1.5 border border-slate-200 bg-white outline-none w-full";
  const num = (i, k, v) => setOps((p) => p.map((o, q) => q === i ? { ...o, efectos: { ...o.efectos, [k]: Number(v) || 0 } } : o));
  const guardar = async () => {
    const opciones = ops.filter((o) => o.texto.trim()).map((o) => ({ texto: o.texto.trim(), efectos: o.efectos }));
    if (!titulo.trim() || !texto.trim() || opciones.length < 2) return setError("Pon título, situación y al menos 2 opciones.");
    setError(""); try { await onGuardar({ tipo, titulo: titulo.trim(), texto: texto.trim(), opciones }); setTitulo(""); setTexto(""); setOps([vacia(), vacia(), vacia()]); } catch (e) { setError(e.message); }
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
      <div className="grid grid-cols-3 gap-2"><select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inp}>{Object.entries(dg.TIPOS_CARTA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título" className={inp + " col-span-2"} /></div>
      <textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Situación o dilema que enfrentan las naciones" className={inp} />
      {ops.map((o, i) => (
        <div key={i} className="rounded-lg bg-slate-50 p-2 space-y-1">
          <input value={o.texto} onChange={(e) => setOps((p) => p.map((x, q) => q === i ? { ...x, texto: e.target.value } : x))} placeholder={`Opción ${String.fromCharCode(65 + i)}`} className={inp} />
          <div className="grid grid-cols-4 gap-1 text-[10px] text-slate-500">
            {[["ejercitos", "Ejércitos"], ["recursos", "Recursos"], ["paz", "Paz"], ["etica", "Ética"]].map(([k, l]) => <label key={k}>{l}<input type="number" value={o.efectos[k]} onChange={(e) => num(i, k, e.target.value)} className="w-full rounded px-1 py-0.5 border border-slate-200" /></label>)}
          </div>
        </div>
      ))}
      {error && <div className="text-xs text-rose-600">{error}</div>}
      <button onClick={guardar} className="text-sm px-3 py-1.5 rounded-lg bg-violet-600 text-white">{etiqueta}</button>
    </div>
  );
}

function BancoCartas() {
  const [cartas, setCartas] = useState([]);
  const cargar = () => tm.fetchCartas().then(setCartas).catch(() => {});
  useEffect(() => { cargar(); }, []);
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">Estas cartas se mezclan con las del juego al crear una partida. Los efectos suman o restan: ejércitos, recursos, paz (0–100) y ética (0–100) de cada nación según la opción que elija.</p>
      <FormCarta onGuardar={async (c) => { await tm.crearCarta(c); cargar(); }} />
      {cartas.map((c) => (
        <div key={c.id} className="rounded-xl bg-white border border-slate-200 p-2 flex items-start gap-2"><div className="flex-1"><div className="text-sm font-semibold">{c.titulo} <span className="text-[10px] text-slate-400">{dg.TIPOS_CARTA[c.tipo]}</span></div><div className="text-xs text-slate-500">{c.texto}</div></div><button onClick={async () => { await tm.eliminarCarta(c.id); cargar(); }} className="text-slate-400 hover:text-rose-500">🗑</button></div>
      ))}
    </div>
  );
}

function PartidaDocente({ id, onVolver }) {
  const [p, setP] = useState(null);
  const [acciones, setAcciones] = useState([]);
  const [error, setError] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [elegida, setElegida] = useState(null);
  const [actuarComo, setActuarComo] = useState("");
  const [panel, setPanel] = useState("");
  const [terrSel, setTerrSel] = useState(null);
  const refrescar = async () => {
    try { const pp = await tm.fetchPartida(id); setP(pp); setAcciones(await tm.fetchAccionesRonda(id, pp.estado.ronda)); setError(""); } catch (e) { setError(tm.mensajeJuego(e)); }
  };
  useEffect(() => { refrescar(); const t = setInterval(() => { if (!document.hidden) refrescar(); }, 20000); return () => clearInterval(t); }, [id]);
  if (!p) return <div className="text-sm text-slate-400 py-8 text-center">{error || "Cargando…"}</div>;
  const e = p.estado;
  const adaptar = (rows) => rows.map((a) => ({ nacion: a.nacion, tipo: a.tipo, payload: a.payload }));
  const guardar = async (nuevo, extra) => { const v = await tm.guardarEstadoPartida(p.id, nuevo, p.version, extra); setP({ ...p, estado: nuevo, version: v, ...extra }); };
  const avanzar = async () => {
    setTrabajando(true);
    try {
      const acs = adaptar(await tm.fetchAccionesRonda(p.id, e.ronda));
      let nuevo;
      if (e.fase === "evento") nuevo = dg.aplicarEvento(e, acs);
      else if (e.fase === "acciones") nuevo = dg.resolverAcciones(e, acs);
      else nuevo = dg.cerrarRonda(e, acs);
      await guardar(nuevo, { cierre: null });
      setAcciones(await tm.fetchAccionesRonda(p.id, nuevo.ronda));
    } catch (er) { setError(er.message || String(er)); }
    setTrabajando(false);
  };
  const nombreBoton = { evento: "Aplicar respuestas a la carta ▶", acciones: "Resolver acciones y combates ▶", votacion: "Cerrar votación y pasar de ronda ▶", cierre: "Cerrar ronda ▶" }[e.fase];
  const respondieron = new Set(acciones.filter((a) => (e.fase === "evento" && a.tipo === "evento") || (e.fase === "votacion" && a.tipo === "voto") || (e.fase === "acciones")).map((a) => a.nacion));
  const accionDe = (a) => ({ ...a });

  const ajustar = async (nid, k, d) => {
    const nuevo = clon(e); dg.aplicarEfectos(nuevo, nid, { [k]: d });
    nuevo.bitacora.push({ r: e.ronda, txt: `El docente ajustó ${k} de ${nuevo.naciones[nid].nombre} (${d > 0 ? "+" : ""}${d}).` });
    await guardar(nuevo);
  };
  const declaratoriaDocente = async (titulo, efectos) => {
    const nuevo = clon(e); nuevo.orden.forEach((n) => dg.aplicarEfectos(nuevo, n, efectos));
    nuevo.bitacora.push({ r: e.ronda, txt: `Declaratoria del docente: «${titulo}».` }); await guardar(nuevo);
  };
  const cartaPropiaAhora = async (c) => { const nuevo = clon(e); nuevo.carta = { id: "x" + Date.now(), ...c }; nuevo.bitacora.push({ r: e.ronda, txt: `El docente lanza una carta especial: «${c.titulo}».` }); await guardar(nuevo); };
  const cambiarCierre = async (valor) => { const iso = valor ? new Date(valor).toISOString() : null; await tm.actualizarPartida(p.id, { cierre: iso }); setP({ ...p, cierre: iso }); };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onVolver} className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 bg-white">← Partidas</button>
        <div className="font-bold text-slate-800">{p.titulo}</div>
        <span className="text-xs text-slate-500">{e.fase === "fin" ? "Terminada" : `Ronda ${e.ronda}/${e.rondasMax} · ${FASES[e.fase]}`}</span>
        <button onClick={refrescar} className="ml-auto text-xs px-2 py-1 rounded border border-slate-200 bg-white">🔄 Actualizar</button>
        <button onClick={async () => { if (!confirm("¿Borrar esta partida?")) return; await tm.eliminarPartida(p.id); onVolver(); }} className="text-slate-400 hover:text-rose-500">🗑</button>
      </div>
      {error && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2">{error}</div>}
      <div className="grid lg:grid-cols-[1fr_320px] gap-3">
        <div className="space-y-3">
          <MapaMundo estado={e} onClickTerr={(t) => setTerrSel(t === terrSel ? null : t)} seleccion={terrSel} />
          {terrSel && <div className="text-xs bg-white border border-slate-200 rounded-lg p-2"><b>{dg.mapaTerr[terrSel].nombre}</b> · {e.naciones[e.terr[terrSel].d].nombre} · {e.terr[terrSel].t} ejércitos · vecinos: {dg.vecinos(terrSel).map((t) => dg.mapaTerr[t].nombre).join(", ")}</div>}
          {e.fase !== "fin" && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3 space-y-2">
              <div className="text-sm font-semibold text-violet-800">{FASES[e.fase]}</div>
              <p className="text-xs text-slate-600">{AYUDA_FASE[e.fase]}</p>
              {e.fase === "evento" && <CartaView carta={e.carta} mostrarEfectos deshabilitado />}
              {e.fase === "votacion" && e.propuestas.map((pr) => <div key={pr.id} className="text-xs bg-white rounded-lg p-2">📜 <b>{dg.DECLARATORIAS[pr.tipo].nombre}</b>{pr.objetivo ? ` contra ${e.naciones[pr.objetivo].nombre}` : ""} — propone {e.naciones[pr.por].nombre}</div>)}
              <div className="flex flex-wrap gap-1 text-[11px]">
                {e.orden.map((n) => <span key={n} className={`px-2 py-0.5 rounded-full border ${respondieron.has(n) ? "bg-emerald-100 border-emerald-300 text-emerald-700" : "bg-white border-slate-200 text-slate-400"}`}>{respondieron.has(n) ? "✔" : "…"} {e.naciones[n].nombre}</span>)}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button disabled={trabajando} onClick={avanzar} className="text-sm px-4 py-2 rounded-lg bg-violet-600 text-white disabled:opacity-50">{trabajando ? "Procesando…" : nombreBoton}</button>
                {p.modo !== "mesa" && <label className="text-[11px] text-slate-500">Cierre de esta fase <input type="datetime-local" value={p.cierre ? new Date(new Date(p.cierre).getTime() - new Date(p.cierre).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""} onChange={(ev) => cambiarCierre(ev.target.value)} className="rounded px-1 border border-slate-200" /></label>}
              </div>
              <div className="border-t border-violet-100 pt-2">
                <div className="text-[11px] font-semibold text-slate-600 mb-1">{p.modo === "mesa" ? "Registra las decisiones de cada nación:" : "También puedes registrar decisiones por una nación:"}</div>
                <select value={actuarComo} onChange={(ev) => setActuarComo(ev.target.value)} className="text-sm rounded-lg px-2 py-1.5 border border-slate-200 bg-white mb-2"><option value="">Elegir nación…</option>{e.orden.map((n) => <option key={n} value={n}>{e.naciones[n].nombre}</option>)}</select>
                {actuarComo && <PanelAcciones estado={e} nacion={actuarComo} misAcciones={acciones.filter((a) => a.nacion === actuarComo)}
                  onEnviar={async (tipo, payload) => { await tm.guardarAccionDocente(p.id, e.ronda, actuarComo, tipo, payload); await refrescar(); }}
                  onBorrar={async (aid) => { await tm.borrarAccionDocente(aid); await refrescar(); }} />}
              </div>
            </div>
          )}
          {e.fase === "fin" && <Resultados estado={e} />}
          {acciones.length > 0 && e.fase !== "fin" && (
            <details className="rounded-xl border border-slate-200 bg-white p-2 text-xs"><summary className="cursor-pointer font-semibold text-slate-600">Acciones recibidas esta ronda ({acciones.length})</summary>
              <div className="mt-1 space-y-0.5">{acciones.map((a) => <div key={a.id} className="flex gap-2"><span className="text-slate-400 w-24 truncate">{e.naciones[a.nacion]?.nombre}</span><span className="flex-1">{a.tipo} {JSON.stringify(a.payload)}</span><button onClick={async () => { await tm.borrarAccionDocente(a.id); refrescar(); }} className="text-slate-300 hover:text-rose-500">🗑</button></div>)}</div></details>
          )}
        </div>
        <div className="space-y-3">
          <TablaNaciones estado={e} onElegir={setElegida} elegida={elegida} />
          {elegida && e.fase !== "fin" && (
            <div className="rounded-xl bg-white border border-slate-200 p-2 text-xs"><div className="font-semibold mb-1">Ajustar {e.naciones[elegida].nombre}</div>
              <div className="flex flex-wrap gap-1">{[["etica", "Ética"], ["paz", "Paz"], ["recursos", "Recursos"], ["ejercitos", "Ejércitos"]].map(([k, l]) => <span key={k} className="inline-flex items-center border border-slate-200 rounded-lg overflow-hidden"><button onClick={() => ajustar(elegida, k, -5 * (k === "recursos" || k === "ejercitos" ? 0.2 : 1))} className="px-1.5 hover:bg-slate-100">−</button><span className="px-1">{l}</span><button onClick={() => ajustar(elegida, k, 5 * (k === "recursos" || k === "ejercitos" ? 0.2 : 1))} className="px-1.5 hover:bg-slate-100">+</button></span>)}</div></div>
          )}
          <Bitacora estado={e} />
          {e.fase !== "fin" && (
            <div className="rounded-xl bg-white border border-slate-200 p-2 text-xs space-y-1">
              <div className="font-semibold">Herramientas del docente</div>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => setPanel(panel === "decl" ? "" : "decl")} className="px-2 py-1 rounded border border-slate-200">📜 Declaratoria del docente</button>
                {e.fase === "evento" && <button onClick={() => setPanel(panel === "carta" ? "" : "carta")} className="px-2 py-1 rounded border border-slate-200">🃏 Carta especial ahora</button>}
              </div>
              {panel === "decl" && <DeclaratoriaDocente onAplicar={async (t, ef) => { await declaratoriaDocente(t, ef); setPanel(""); }} />}
              {panel === "carta" && <FormCarta etiqueta="Lanzar esta carta" onGuardar={async (c) => { await cartaPropiaAhora(c); setPanel(""); }} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DeclaratoriaDocente({ onAplicar }) {
  const [t, setT] = useState(""); const [ef, setEf] = useState({ ejercitos: 0, recursos: 0, paz: 0, etica: 0 });
  return (
    <div className="space-y-1">
      <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Ej. Declaración mundial de la dignidad humana" className="w-full rounded px-2 py-1 border border-slate-200" />
      <div className="grid grid-cols-4 gap-1 text-[10px] text-slate-500">{[["ejercitos", "Ejérc."], ["recursos", "Recurs."], ["paz", "Paz"], ["etica", "Ética"]].map(([k, l]) => <label key={k}>{l}<input type="number" value={ef[k]} onChange={(e) => setEf({ ...ef, [k]: Number(e.target.value) || 0 })} className="w-full rounded px-1 py-0.5 border border-slate-200" /></label>)}</div>
      <button disabled={!t.trim()} onClick={() => onAplicar(t.trim(), ef)} className="px-2 py-1 rounded bg-violet-600 text-white disabled:opacity-40">Aplicar a todas las naciones</button>
    </div>
  );
}

// ============================================================ ESTUDIANTE
export function TableroMundialEstudiante() {
  const [partidas, setPartidas] = useState(null);
  const [sel, setSel] = useState(null);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const versionRef = useRef(0);
  const cargarLista = () => tm.fetchMisPartidas().then((l) => { setPartidas(l); if (!sel && l.length === 1) setSel(l[0].id); setError(""); }).catch((e) => { setPartidas([]); setError(tm.mensajeJuego(e)); });
  useEffect(() => { cargarLista(); }, []);
  const cargarEstado = async () => { if (!sel) return; try { const d = await tm.fetchEstadoJuego(sel); setDatos(d); versionRef.current = d?.version || 0; } catch (e) { setError(tm.mensajeJuego(e)); } };
  useEffect(() => { setDatos(null); versionRef.current = 0; if (sel) cargarEstado(); }, [sel]);
  useEffect(() => {
    if (!sel) return;
    const t = setInterval(async () => {
      if (document.hidden) return;
      try { const v = await tm.fetchVersionPartida(sel); if (v && v !== versionRef.current) cargarEstado(); } catch {}
    }, 20000);
    return () => clearInterval(t);
  }, [sel]);

  if (partidas === null) return <div className="text-sm text-slate-400 text-center py-8">Cargando…</div>;
  if (!sel) return (
    <div className="max-w-2xl mx-auto space-y-2">
      {error && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2">{error}</div>}
      {partidas.length === 0 && <div className="text-center py-10"><div className="text-4xl mb-2">🌍</div><p className="text-sm text-slate-500">No hay ninguna partida del Tablero Mundial activa por ahora.</p></div>}
      {partidas.map((p) => <button key={p.id} onClick={() => setSel(p.id)} className="w-full text-left bg-white border border-slate-200 rounded-xl p-3"><b className="text-sm">🌍 {p.titulo}</b><div className="text-[11px] text-slate-500">Ronda {p.ronda} · {FASES[p.fase]} {p.juega ? "" : "· (solo observas)"}</div></button>)}
    </div>
  );
  if (!datos) return <div className="text-sm text-slate-400 text-center py-8">{error || "Cargando partida…"}</div>;
  const e = datos.estado, nac = datos.nacion, modo = datos.modo;
  const puede = nac && modo !== "mesa" && e.fase !== "fin";
  const cierraEn = datos.cierre ? new Date(datos.cierre) : null;
  return (
    <div className="w-full max-w-6xl mx-auto space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {partidas.length > 1 && <button onClick={() => { setSel(null); setDatos(null); }} className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 bg-white">← Partidas</button>}
        <div className="font-bold text-slate-800">{datos.titulo}</div>
        <span className="text-xs text-slate-500">{e.fase === "fin" ? "Terminada" : `Ronda ${e.ronda}/${e.rondasMax} · ${FASES[e.fase]}`}</span>
        <button onClick={cargarEstado} className="ml-auto text-xs px-2 py-1 rounded border border-slate-200 bg-white">🔄 Actualizar</button>
      </div>
      {error && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2">{error}</div>}
      {nac ? <div className="rounded-xl p-2 text-sm text-white font-semibold" style={{ background: e.naciones[nac].color }}>Eres parte de la nación {e.naciones[nac].nombre}</div> : <div className="rounded-xl bg-slate-100 p-2 text-sm text-slate-600">No perteneces a ninguna nación en esta partida: la observas.</div>}
      {modo === "mesa" && e.fase !== "fin" && <div className="rounded-xl bg-amber-50 text-amber-800 text-xs p-2">Tu docente modera esta partida en clase: aquí puedes seguir el mapa, pero las decisiones se toman en voz alta.</div>}
      {cierraEn && e.fase !== "fin" && <div className="text-xs text-slate-500">⏳ Esta fase cierra el {cierraEn.toLocaleString("es-CO")}</div>}
      <div className="grid lg:grid-cols-[1fr_320px] gap-3">
        <div className="space-y-3">
          <MapaMundo estado={e} resaltar={nac} />
          {e.fase !== "fin" && <div className="text-xs text-slate-500 bg-white border border-slate-200 rounded-xl p-2"><b>{FASES[e.fase]}:</b> {AYUDA_FASE[e.fase]}</div>}
          {puede && e.fase === "evento" && <PanelAcciones estado={e} nacion={nac} misAcciones={datos.mis_acciones} onEnviar={async (t, pl) => { await tm.enviarAccionJuego(sel, t, pl); await cargarEstado(); }} onBorrar={async (a) => { await tm.borrarAccionJuego(sel, a); await cargarEstado(); }} />}
          {!puede && e.fase === "evento" && <CartaView carta={e.carta} deshabilitado />}
          {puede && e.fase !== "evento" && <PanelAcciones estado={e} nacion={nac} misAcciones={datos.mis_acciones} onEnviar={async (t, pl) => { await tm.enviarAccionJuego(sel, t, pl); await cargarEstado(); }} onBorrar={async (a) => { await tm.borrarAccionJuego(sel, a); await cargarEstado(); }} />}
          {e.fase === "fin" && <Resultados estado={e} />}
        </div>
        <div className="space-y-3">
          <TablaNaciones estado={e} nacionPropia={nac} />
          <Bitacora estado={e} />
        </div>
      </div>
    </div>
  );
}
