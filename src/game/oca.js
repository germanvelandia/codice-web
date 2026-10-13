// =====================================================================================
//  🎲 LA OCA DE CÓDICE — pantalla del juego (las reglas están en mundosAlt.js)
//  abrirOca(contenedor, ctx) → { cerrar(), estado() }
//    ctx: { pool, penal, nombre, emoji, rng?, dado?(), rapido?, sonido?, alResultado?(resultado) → Promise<{ok,...}>, alSalir() }
// =====================================================================================
import { META_OCA, TIPOS_CASILLA, tableroOca, tirarDado, nuevaPartidaOca, tirarOca, responderOca, resultadoOca } from "./mundosAlt";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const CARAS = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const COLUMNAS = 6;

export const CSS_OCA = `
.mundo .m-alt { position: absolute; inset: 0; z-index: 29; background: radial-gradient(ellipse at 50% 0%, #4c2a85 0%, #1b1038 75%); color: #fff; overflow: hidden; }
.mundo .m-alt.oculto { display: none; }
.mundo .oca { position: relative; height: 100%; }
.mundo .oca-sc { height: 100%; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.mundo .oca-in { max-width: 560px; margin: 0 auto; padding: 10px 10px 24px; }
.mundo .oca-cab { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.mundo .oca-cab h2 { flex: 1; margin: 0; font-size: 17px; font-weight: 800; }
.mundo .oca-x { border: 0; border-radius: 10px; padding: 7px 12px; font-weight: 700; font-size: 13px; background: rgba(255,255,255,.14); color: #fff; cursor: pointer; }
.mundo .oca-salir { background: #fef3c7; color: #78350f; border-radius: 10px; padding: 8px 10px; font-size: 13px; margin-bottom: 8px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.mundo .oca-salir[hidden] { display: none; }
.mundo .oca-salir button { border: 0; border-radius: 8px; padding: 6px 12px; font-weight: 700; cursor: pointer; }
.mundo .oca-tab { position: relative; display: grid; grid-template-columns: repeat(${COLUMNAS}, 1fr); gap: 3px; background: #2a1858; border-radius: 14px; padding: 5px; }
.mundo .oca-c { position: relative; aspect-ratio: 1; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: clamp(16px, 5.4vw, 26px); background: #4b3790; box-shadow: inset 0 -3px 0 rgba(0,0,0,.22); }
.mundo .oca-c small { position: absolute; top: 2px; left: 4px; font-size: 9px; font-weight: 800; opacity: .75; }
.mundo .oca-c.t-salida { background: #0f766e; } .mundo .oca-c.t-meta { background: #b45309; } .mundo .oca-c.t-libre { background: #3f7d4a; }
.mundo .oca-c.t-prueba { background: #5b4bb5; } .mundo .oca-c.t-oca { background: #0e7490; } .mundo .oca-c.t-puente { background: #8a5a2b; }
.mundo .oca-c.t-dragon { background: #9f1239; } .mundo .oca-c.t-laberinto { background: #6b21a8; } .mundo .oca-c.t-pozo { background: #1e293b; } .mundo .oca-c.t-dados { background: #a16207; }
.mundo .oca-c.actual { outline: 3px solid #fde047; z-index: 1; }
.mundo .oca-ficha { position: absolute; width: calc((100% - 10px - 15px) / ${COLUMNAS}); aspect-ratio: 1; display: flex; align-items: flex-end; justify-content: center; font-size: clamp(20px, 6.6vw, 32px); pointer-events: none; transition: left .2s ease, top .2s ease; z-index: 3; filter: drop-shadow(0 3px 2px rgba(0,0,0,.5)); }
.mundo .oca-mando { display: flex; align-items: center; gap: 12px; margin-top: 10px; background: rgba(255,255,255,.08); border-radius: 14px; padding: 10px 12px; }
.mundo .oca-dado { font-size: 54px; line-height: 1; width: 64px; text-align: center; }
.mundo .oca-dado.gira { animation: ocaGira .12s linear infinite; }
@keyframes ocaGira { from { transform: rotate(-12deg) scale(1.05); } to { transform: rotate(12deg) scale(.95); } }
.mundo .oca-tirar { flex: 1; border: 0; border-radius: 12px; padding: 14px 10px; font-size: 17px; font-weight: 800; background: #facc15; color: #422006; cursor: pointer; box-shadow: 0 4px 0 #a16207; }
.mundo .oca-tirar:disabled { opacity: .5; cursor: default; box-shadow: none; }
.mundo .oca-log { margin-top: 8px; min-height: 40px; font-size: 14px; line-height: 1.4; background: rgba(0,0,0,.25); border-radius: 10px; padding: 8px 10px; }
.mundo .oca-stats { display: flex; gap: 10px; justify-content: center; font-size: 12px; margin-top: 8px; opacity: .85; flex-wrap: wrap; }
.mundo .oca-ayuda { margin-top: 10px; font-size: 12px; background: rgba(255,255,255,.07); border-radius: 10px; padding: 8px 10px; }
.mundo .oca-ayuda summary { cursor: pointer; font-weight: 700; }
.mundo .oca-ayuda li { margin: 3px 0; list-style: none; }
.mundo .oca-vel { position: absolute; inset: 0; z-index: 2; background: rgba(8,6,24,.82); display: flex; align-items: center; justify-content: center; padding: 12px; }
.mundo .oca-card { background: #fff; color: #1e293b; border-radius: 16px; padding: 16px; width: min(480px, 100%); max-height: 100%; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,.5); }
.mundo .oca-card h3 { margin: 0 0 4px; font-size: 13px; color: #7c3aed; font-weight: 800; }
.mundo .oca-card .q { font-size: 17px; font-weight: 700; margin: 4px 0 12px; line-height: 1.35; }
.mundo .oca-op { display: block; width: 100%; text-align: left; border: 2px solid #e2e8f0; background: #f8fafc; border-radius: 12px; padding: 11px 12px; margin-bottom: 8px; font-size: 15px; cursor: pointer; color: #1e293b; }
.mundo .oca-op:disabled { cursor: default; }
.mundo .oca-op.bien { border-color: #059669; background: #d1fae5; } .mundo .oca-op.mal { border-color: #e11d48; background: #ffe4e6; }
.mundo .oca-fb { font-size: 14px; margin: 6px 0 10px; line-height: 1.4; }
.mundo .oca-ok { border: 0; border-radius: 12px; padding: 12px; width: 100%; font-weight: 800; font-size: 15px; background: #7c3aed; color: #fff; cursor: pointer; margin-top: 4px; }
.mundo .oca-ok.sec { background: #e2e8f0; color: #334155; }
.mundo .oca-fin { text-align: center; }
.mundo .oca-fin .gr { font-size: 52px; } .mundo .oca-fin .est { font-size: 30px; letter-spacing: 4px; margin: 4px 0; }
.mundo .oca-prem { margin: 10px 0; font-weight: 700; color: #047857; font-size: 15px; }
.mundo .oca-prem.nota { color: #475569; font-weight: 600; font-size: 13px; }
.mundo .oca-prem.mal { color: #be123c; }
`;

export function abrirOca(host, ctx = {}) {
  const rng = ctx.rng || Math.random, rapido = !!ctx.rapido, snd = ctx.sonido || {};
  const sonar = (n) => { try { snd[n] && snd[n](); } catch (e) { /* sin sonido */ } };
  const espera = (ms) => new Promise((r) => setTimeout(r, rapido ? 4 : ms));
  const tablero = tableroOca();
  let e = nuevaPartidaOca({ pool: ctx.pool || [], rng, penal: ctx.penal || 3 });
  let ficha = 0, ocupado = false, vivo = true, confirmando = false, final = null;

  host.classList.remove("oculto");
  host.innerHTML = `<div class="oca"></div>`;
  const raiz = host.firstChild;
  if (e.imposible) { raiz.innerHTML = `<div class="oca-cab"><h2>🎲 La Oca de CÓDICE</h2><button class="oca-x" data-a="salir">✕ Salir</button></div><div class="oca-log">Todavía no hay preguntas para este juego.</div>`; raiz.querySelector('[data-a="salir"]').onclick = () => cerrar(); return { cerrar, estado: () => e }; }

  const celdaPos = (n) => { const fila = Math.floor(n / COLUMNAS), pos = n % COLUMNAS, col = fila % 2 === 0 ? pos : COLUMNAS - 1 - pos; return { col, fila: Math.floor((META_OCA + 1) / COLUMNAS) - 1 - fila }; };
  const filasTot = Math.floor((META_OCA + 1) / COLUMNAS);
  const colocarFicha = () => {
    const f = raiz.querySelector(".oca-ficha"); if (!f) return;
    const p = celdaPos(ficha); f.style.left = `calc(5px + ${p.col} * ((100% - 10px - 15px) / ${COLUMNAS} + 3px))`; f.style.top = `calc(5px + ${p.fila} * ((100% - 10px - ${(filasTot - 1) * 3}px) / ${filasTot} + 3px))`;
    raiz.querySelectorAll(".oca-c").forEach((c) => c.classList.toggle("actual", Number(c.dataset.n) === ficha));
  };
  function armar() {
    const celdas = [...tablero].sort((a, b) => celdaPos(a.n).fila - celdaPos(b.n).fila || celdaPos(a.n).col - celdaPos(b.n).col)
      .map((c) => `<div class="oca-c t-${c.tipo}" data-n="${c.n}" title="${esc(TIPOS_CASILLA[c.tipo].nombre)}"><small>${c.n}</small>${TIPOS_CASILLA[c.tipo].emoji}</div>`).join("");
    const ayuda = Object.entries(TIPOS_CASILLA).map(([, t]) => `<li>${t.emoji} ${esc(t.nombre)}</li>`).join("");
    raiz.innerHTML = `<div class="oca-sc"><div class="oca-in">
      <div class="oca-cab"><h2>🎲 La Oca de CÓDICE</h2><button class="oca-x" data-a="salir">✕ Salir</button></div>
      <div class="oca-salir" data-r="salir" hidden>¿Salir del juego? Se pierde esta partida. <button data-a="si" style="background:#b45309;color:#fff">Sí, salir</button><button data-a="no" style="background:#fff">Seguir jugando</button></div>
      <div class="oca-tab">${celdas}<div class="oca-ficha">${esc(ctx.emoji || "🧙")}</div></div>
      <div class="oca-mando"><div class="oca-dado" data-r="dado">🎲</div><button class="oca-tirar" data-a="tirar">🎲 Tirar el dado</button></div>
      <div class="oca-log" data-r="log"></div>
      <div class="oca-stats" data-r="stats"></div>
      <details class="oca-ayuda"><summary>¿Cómo se juega?</summary><p>Llega a la casilla ${META_OCA} 🏆. Tira el dado: en las casillas ❓ responde una pregunta (si aciertas avanzas 2 casillas más; si fallas retrocedes ${e.penal}). ¡Cuidado con el 🐉, el 🌀 y el 🕳️!</p><ul>${ayuda}</ul></details>
      </div></div><div data-r="velo"></div>`;
    raiz.querySelector('[data-a="salir"]').onclick = () => { if (e.turnos === 0 || e.fase === "fin") cerrar(); else { confirmando = true; pintar(); } };
    raiz.querySelector('[data-a="si"]').onclick = () => cerrar();
    raiz.querySelector('[data-a="no"]').onclick = () => { confirmando = false; pintar(); };
    raiz.querySelector('[data-a="tirar"]').onclick = tirar;
    colocarFicha();
  }
  const q = (r) => raiz.querySelector(`[data-r="${r}"]`);
  function pintar() {
    if (!vivo) return;
    q("salir").hidden = !confirmando;
    q("log").innerHTML = e.log.slice(-2).map((t, i, a) => `<div style="${i === a.length - 1 ? "font-weight:700" : "opacity:.7"}">${esc(t)}</div>`).join("");
    q("stats").innerHTML = `<span>🎯 Casilla ${e.pos}/${META_OCA}</span><span>🎲 Turnos: ${e.turnos}</span><span>✅ ${e.aciertos}</span><span>❌ ${e.errores}</span>`;
    raiz.querySelector('[data-a="tirar"]').disabled = ocupado || e.fase !== "tirar";
    const velo = q("velo");
    if ((e.fase === "prueba" || e.fase === "pozo") && !ocupado && e.pregunta) velo.innerHTML = htmlPregunta();
    else if (e.fase === "fin" && !ocupado) velo.innerHTML = htmlFin();
    else velo.innerHTML = "";
    enlazar();
  }
  const htmlPregunta = () => {
    const p = e.pregunta, pozo = e.fase === "pozo";
    return `<div class="oca-vel"><div class="oca-card"><h3>${pozo ? "🕳️ Estás en el pozo · responde bien para salir" : `❓ Prueba · casilla ${e.pos}`}</h3><div class="q" data-r="enun">${esc(p.texto)}</div>${p.opciones.map((o, i) => `<button class="oca-op" data-op="${i}">${esc(o)}</button>`).join("")}<div data-r="fb"></div></div></div>`;
  };
  const htmlFin = () => `<div class="oca-vel"><div class="oca-card oca-fin"><div class="gr">🏆</div><h2 style="margin:0">¡Llegaste a la meta!</h2><div class="est">${"⭐".repeat(resultadoOca(e).estrellas)}${"☆".repeat(3 - resultadoOca(e).estrellas)}</div><div style="font-size:13px;color:#475569">${e.turnos} turnos · ${e.aciertos} aciertos · ${e.errores} errores</div><div data-r="premio" class="oca-prem nota">Guardando tu premio…</div><div data-r="botones"></div></div></div>`;
  function enlazar() {
    raiz.querySelectorAll("[data-op]").forEach((b) => (b.onclick = () => responder(Number(b.dataset.op))));
    if (e.fase === "fin" && !final) guardarPremio();
    else if (e.fase === "fin" && final) mostrarPremio();
  }

  async function caminar(pasos) {
    for (const p of pasos) {
      if (!vivo) return;
      if (p.motivo === "dado" || p.motivo === "dados" || p.motivo === "acierto") {
        const total = p.motivo === "acierto" ? p.a - p.de : (p.motivo === "dado" ? e.dado : e.dado);
        let c = p.de, dir = 1;
        const camino = p.motivo === "acierto" ? Math.abs(p.a - p.de) : (p.motivo === "dado" ? e.dado : Math.abs(p.a - p.de) || e.dado);
        for (let i = 0; i < camino; i++) { if (c >= META_OCA) dir = -1; c += dir; ficha = c; colocarFicha(); sonar("paso"); await espera(190); }
        void total; ficha = p.a; colocarFicha();
      } else {
        await espera(380); ficha = p.a; colocarFicha();
        sonar(p.motivo === "oca" ? "estrella" : p.motivo === "puente" ? "puerta" : "golpe"); await espera(520);
      }
    }
  }
  async function tirar() {
    if (ocupado || e.fase !== "tirar" || !vivo) return;
    ocupado = true; confirmando = false; pintar();
    const dado = (ctx.dado ? Number(ctx.dado()) : tirarDado(rng)) || 1, d = q("dado");
    d.classList.add("gira"); for (let i = 0; i < 7; i++) { d.textContent = CARAS[Math.floor(Math.random() * 6)]; await espera(70); if (!vivo) return; }
    d.classList.remove("gira"); d.textContent = CARAS[dado - 1]; sonar("hablar");
    e = tirarOca(e, dado);
    await caminar(e.pasos); if (!vivo) return;
    ocupado = false; if (e.fase === "fin") sonar("fanfarria");
    pintar();
  }
  async function responder(i) {
    if (ocupado || (e.fase !== "prueba" && e.fase !== "pozo")) return;
    ocupado = true;
    const sig = responderOca(e, i), u = sig.ultimo, tarj = raiz.querySelector(".oca-card");
    raiz.querySelectorAll("[data-op]").forEach((b) => { b.disabled = true; const k = Number(b.dataset.op); if (k === u.correcta) b.classList.add("bien"); else if (k === i) b.classList.add("mal"); });
    sonar(u.ok ? "bien" : "mal");
    const fb = tarj.querySelector('[data-r="fb"]');
    const msj = u.ok ? (u.pozo ? "✅ ¡Correcto! Sales del pozo." : "✅ ¡Correcto! Avanzas 2 casillas.") : (u.pozo ? "❌ Casi. Sigues en el pozo; vas a intentar con otra pregunta." : `❌ No era esa. Retrocedes ${e.pos - sig.pos} ${e.pos - sig.pos === 1 ? "casilla" : "casillas"}.`);
    fb.innerHTML = `<div class="oca-fb"><b>${msj}</b>${u.retro ? `<br>${esc(u.retro)}` : ""}${!u.ok && u.pista ? `<br>💡 ${esc(u.pista)}` : ""}</div><button class="oca-ok" data-a="seguir">Continuar</button>`;
    fb.querySelector('[data-a="seguir"]').onclick = async () => {
      const antes = e; e = sig; raiz.querySelector('[data-r="velo"]').innerHTML = "";
      await caminar(sig.pasos); if (!vivo) return;
      void antes; ocupado = false; if (e.fase === "fin") sonar("fanfarria"); pintar();
    };
  }
  async function guardarPremio() {
    final = { cargando: true };
    let r;
    try { r = ctx.alResultado ? await ctx.alResultado(resultadoOca(e)) : { ok: true, local: true }; } catch (err) { r = { ok: false, mensaje: err && err.message }; }
    final = r; if (vivo && e.fase === "fin") mostrarPremio();
  }
  function mostrarPremio() {
    const p = q("premio"), b = q("botones"); if (!p || !b || !final || final.cargando) return;
    const r = final;
    if (!r.ok) { p.className = "oca-prem mal"; p.textContent = "No se pudo guardar tu premio: " + (r.mensaje || "revisa tu conexión") + "."; b.innerHTML = `<button class="oca-ok" data-a="reintentar">Reintentar</button>`; b.querySelector("button").onclick = () => { final = null; p.className = "oca-prem nota"; p.textContent = "Guardando tu premio…"; b.innerHTML = ""; guardarPremio(); }; return; }
    if (r.local) { p.className = "oca-prem nota"; p.textContent = "(Modo prueba: no se guardó nada.)"; }
    else if (r.yaEstaba) { p.className = "oca-prem nota"; p.textContent = "Hoy ya ganaste el premio de este tablero. ¡Puedes seguir jugando por diversión y volver mañana por más!"; }
    else {
      const pr = r.premio || {}; p.className = "oca-prem";
      p.innerHTML = `🎁 +${pr.xp || 0} XP · +${pr.oro || 0} 🪙${r.evento ? `<br><span style="font-size:13px">${esc(r.evento.emoji || "🎉")} ${esc(r.evento.nombre)}: +${r.evento.extraXp || 0} XP y +${r.evento.extraOro || 0} 🪙 extra</span>` : ""}`;
    }
    b.innerHTML = `<button class="oca-ok" data-a="otra">🎲 Jugar otra vez</button><button class="oca-ok sec" data-a="fuera" style="margin-top:8px">Volver al mundo</button>`;
    b.querySelector('[data-a="otra"]').onclick = () => { e = nuevaPartidaOca({ pool: ctx.pool, rng, penal: ctx.penal || 3 }); ficha = 0; ocupado = false; final = null; armar(); pintar(); };
    b.querySelector('[data-a="fuera"]').onclick = () => cerrar();
  }
  function cerrar() {
    if (!vivo) return; vivo = false; host.classList.add("oculto"); host.innerHTML = ""; if (ctx.alSalir) ctx.alSalir();
  }
  armar(); pintar();
  return { cerrar, estado: () => e };
}
