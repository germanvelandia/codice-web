// =====================================================================================
//  🍄 PLATAFORMAS DE CÓDICE — pantalla del juego (las reglas y la física están en mundosAlt.js)
//  abrirPlataformas(contenedor, ctx) → { cerrar(), estado(), avanzar(cuadros, entrada) }
//    ctx: { pool, corazones, puerta, rng?, rapido?, sonido?, hechos?: Set<'n1'|'n2'|'n3'>, nivelInicial?,
//           alResultado?(resultado) → Promise<{ok,...}>, alSalir() }
// =====================================================================================
import { T, FILAS, PW, PH, ANCHO_VISTA, ALTO_VISTA, NIVELES_PLAT, NOMBRES_NIVEL, nuevaPartidaPlat, pasoPlat, responderPlat, resultadoPlat, estrellasPlat } from "./mundosAlt";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const FUENTE = "system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
const TEMAS = [
  null,
  { cielo: ["#7dd3fc", "#e0f2fe"], colinas: "#86efac", colinas2: "#4ade80", suelo: "#8b5a2b", sueloOsc: "#6b4423", cesped: "#4ade80", plat: "#b45309" },
  { cielo: ["#1e1b4b", "#4c1d95"], colinas: "#4338ca", colinas2: "#3730a3", suelo: "#57534e", sueloOsc: "#44403c", cesped: "#a78bfa", plat: "#78716c" },
  { cielo: ["#7c2d12", "#fdba74"], colinas: "#9a3412", colinas2: "#7c2d12", suelo: "#6b7280", sueloOsc: "#4b5563", cesped: "#fbbf24", plat: "#92400e" },
];

export const CSS_PLAT = `
.mundo .pl-raiz { height: 100%; overflow-y: auto; -webkit-overflow-scrolling: touch; background: radial-gradient(ellipse at 50% 0%, #1e3a8a 0%, #0b1020 80%); }
.mundo .pl { max-width: 1100px; margin: 0 auto; padding: 8px 8px 10px; color: #fff; min-height: 100%; box-sizing: border-box; display: flex; flex-direction: column; }
.mundo .pl-cab { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
.mundo .pl-cab h2 { margin: 0; font-size: 16px; font-weight: 800; flex: 1; min-width: 140px; }
.mundo .pl-hud { display: flex; gap: 8px; font-weight: 800; font-size: 14px; flex-wrap: wrap; }
.mundo .pl-hud span { background: rgba(0,0,0,.35); border-radius: 8px; padding: 3px 8px; }
.mundo .pl-esc { position: relative; flex: 1; min-height: 220px; border-radius: 12px; overflow: hidden; background: #000; box-shadow: 0 6px 24px rgba(0,0,0,.5); user-select: none; -webkit-user-select: none; touch-action: none; }
.mundo .pl-esc canvas { position: absolute; display: block; image-rendering: pixelated; }
.mundo .pl-aviso { position: absolute; left: 50%; top: 10px; transform: translateX(-50%); max-width: 92%; background: rgba(15,23,42,.9); color: #fff; padding: 8px 12px; border-radius: 10px; font-size: 13px; text-align: center; pointer-events: none; }
.mundo .pl-ctl { position: absolute; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-between; padding: 10px; pointer-events: none; }
.mundo .pl-ctl .g { display: flex; gap: 10px; pointer-events: auto; }
.mundo .pl-b { width: 60px; height: 60px; border-radius: 50%; border: 2px solid rgba(255,255,255,.7); background: rgba(15,23,42,.45); color: #fff; font-size: 26px; display: flex; align-items: center; justify-content: center; touch-action: none; user-select: none; -webkit-user-select: none; cursor: pointer; }
.mundo .pl-b.on { background: rgba(250,204,21,.7); color: #422006; }
.mundo .pl-ayuda { font-size: 12px; opacity: .85; margin-top: 6px; text-align: center; }
.mundo .pl-menu { background: rgba(255,255,255,.08); border-radius: 14px; padding: 14px; }
.mundo .pl-menu h3 { margin: 0 0 6px; font-size: 18px; }
.mundo .pl-niv { display: flex; align-items: center; gap: 10px; background: rgba(0,0,0,.28); border-radius: 12px; padding: 10px 12px; margin-top: 8px; }
.mundo .pl-niv b { flex: 1; }
.mundo .pl-niv .ya { font-size: 11px; background: #065f46; border-radius: 8px; padding: 2px 8px; }
.mundo .pl-niv button { border: 0; border-radius: 10px; padding: 9px 14px; font-weight: 800; background: #facc15; color: #422006; cursor: pointer; }
.mundo .pl-vel { position: absolute; inset: 0; background: rgba(8,6,24,.78); display: flex; align-items: center; justify-content: center; padding: 10px; overflow-y: auto; }
`;

export function abrirPlataformas(host, ctx = {}) {
  const rng = ctx.rng || Math.random, rapido = !!ctx.rapido, snd = ctx.sonido || {};
  const sonar = (n) => { try { snd[n] && snd[n](); } catch (err) { /* sin sonido */ } };
  const hechos = new Set(ctx.hechos ? [...ctx.hechos] : []);
  let e = null, nivel = 0, vivo = true, pausado = false, raf = 0, last = 0, acc = 0, final = null, confirmando = false;
  const entrada = { izq: false, der: false, salto: false };
  host.classList.remove("oculto");
  host.innerHTML = `<div class="pl-raiz"><div class="pl"></div></div>`;
  const raiz = host.firstChild.firstChild;
  let cv = null, g = null;
  const ajustar = () => { if (!cv) return; const esc = raiz.querySelector('[data-r="esc"]'); if (!esc) return; const w = esc.clientWidth, h = esc.clientHeight; if (!w || !h) return; const k = Math.max(0.3, Math.min(w / ANCHO_VISTA, h / ALTO_VISTA)), cw = Math.floor(ANCHO_VISTA * k), ch = Math.floor(ALTO_VISTA * k); cv.style.width = cw + 'px'; cv.style.height = ch + 'px'; cv.style.left = Math.floor((w - cw) / 2) + 'px'; cv.style.top = Math.floor((h - ch) / 2) + 'px'; };
  window.addEventListener('resize', ajustar);

  // ---------- teclado (captura: el mundo de fondo no debe moverse) ----------
  const MAPA = { ArrowLeft: "izq", a: "izq", A: "izq", ArrowRight: "der", d: "der", D: "der", ArrowUp: "salto", w: "salto", W: "salto", " ": "salto", Spacebar: "salto" };
  const abajo = (ev) => { if (!vivo) return; const k = MAPA[ev.key]; if (k) entrada[k] = true; ev.preventDefault(); ev.stopImmediatePropagation(); };
  const arriba = (ev) => { if (!vivo) return; const k = MAPA[ev.key]; if (k) entrada[k] = false; ev.stopImmediatePropagation(); };
  window.addEventListener("keydown", abajo, true); window.addEventListener("keyup", arriba, true);

  // ---------- pantallas ----------
  function menu() {
    cancelAnimationFrame(raf); e = null; final = null; pausado = false; confirmando = false;
    const filas = Array.from({ length: NIVELES_PLAT }, (_, i) => `<div class="pl-niv"><span style="font-size:24px">${["🌳", "🕳️", "🏰"][i]}</span><b>Nivel ${i + 1} · ${esc(NOMBRES_NIVEL[i])}</b>${hechos.has(`n${i + 1}`) ? `<span class="ya">premio de hoy ✓</span>` : ""}<button data-niv="${i + 1}">▶ Jugar</button></div>`).join("");
    raiz.innerHTML = `<div class="pl-cab"><h2>🍄 Plataformas de CÓDICE</h2><button class="oca-x" data-a="salir">✕ Salir</button></div>
      <div class="pl-menu"><h3>¡Cruza los mundos del saber!</h3>
      <p style="margin:4px 0;font-size:14px;line-height:1.45">Corre y salta hasta la bandera 🚩. Golpea los bloques <b>❓</b> desde abajo para responder preguntas: cada acierto cuenta para abrir la <b>puerta del saber</b> 🚪 que te cierra el camino. Pisa a los enemigos desde arriba y esquiva los pinchos. ¡Tienes ${ctx.corazones || 3} ❤️!</p>
      <p style="margin:4px 0;font-size:12px;opacity:.85">⌨️ Flechas o A/D para moverte · Espacio o ↑ para saltar &nbsp;|&nbsp; 📱 botones en pantalla</p>
      ${filas}</div>`;
    raiz.querySelector('[data-a="salir"]').onclick = () => cerrar();
    raiz.querySelectorAll("[data-niv]").forEach((b) => (b.onclick = () => iniciar(Number(b.dataset.niv))));
  }
  function iniciar(n) {
    nivel = n; final = null; pausado = false; confirmando = false; acc = 0;
    e = nuevaPartidaPlat({ nivel: n, pool: ctx.pool || [], rng, corazones: ctx.corazones || 3, puerta: ctx.puerta || 3 });
    if (e.imposible) { menu(); return; }
    raiz.innerHTML = `<div class="pl-cab"><h2>Nivel ${n} · ${esc(NOMBRES_NIVEL[n - 1])}</h2><div class="pl-hud"><span data-r="h-v"></span><span data-r="h-m"></span><span data-r="h-a"></span></div><button class="oca-x" data-a="salir">✕ Salir</button></div>
      <div class="oca-salir" data-r="salir" hidden>¿Salir del nivel? Se pierde el avance. <button data-a="si" style="background:#b45309;color:#fff">Sí, salir</button><button data-a="no" style="background:#fff">Seguir jugando</button></div>
      <div class="pl-esc" data-r="esc"><canvas width="${ANCHO_VISTA}" height="${ALTO_VISTA}"></canvas><div class="pl-aviso" data-r="aviso" hidden></div>
        <div class="pl-ctl"><div class="g"><div class="pl-b" data-k="izq" aria-label="Izquierda">◀</div><div class="pl-b" data-k="der" aria-label="Derecha">▶</div></div><div class="g"><div class="pl-b" data-k="salto" aria-label="Saltar">⤒</div></div></div>
        <div data-r="velo"></div></div>
      <div class="pl-ayuda">Golpea los bloques ❓ desde abajo · Abre la puerta 🚪 con ${e.puertaNecesita} ${e.puertaNecesita === 1 ? "acierto" : "aciertos"} · Llega a la bandera 🚩</div>`;
    cv = raiz.querySelector("canvas"); g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
    raiz.querySelector('[data-a="salir"]').onclick = () => { if (!e || e.fase !== "jugando" && e.fase !== "pregunta") menu(); else { confirmando = true; pausado = true; raiz.querySelector('[data-r="salir"]').hidden = false; } };
    raiz.querySelector('[data-a="si"]').onclick = () => menu();
    raiz.querySelector('[data-a="no"]').onclick = () => { confirmando = false; pausado = !!(e && e.fase === "pregunta") || !!final; raiz.querySelector('[data-r="salir"]').hidden = true; };
    raiz.querySelectorAll("[data-k]").forEach((b) => {
      const k = b.dataset.k, on = (ev) => { ev.preventDefault(); entrada[k] = true; b.classList.add("on"); try { b.setPointerCapture(ev.pointerId); } catch (err) { /* sin captura */ } }, off = () => { entrada[k] = false; b.classList.remove("on"); };
      b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off); b.addEventListener("pointercancel", off); b.addEventListener("pointerleave", off);
    });
    ajustar(); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(cuadro); dibujar(); hud();
  }

  // ---------- bucle ----------
  function cuadro(ahora) {
    if (!vivo || !e) return;
    raf = requestAnimationFrame(cuadro);
    const dt = Math.min(0.1, (ahora - last) / 1000); last = ahora;
    if (!pausado && e.fase === "jugando") { acc += dt; let k = 0; while (acc >= 1 / 60 && k++ < 6) { pasoPlat(e, entrada, 1 / 60); acc -= 1 / 60; drenar(); if (e.fase !== "jugando") break; } }
    dibujar(); hud();
  }
  function avanzar(cuadros = 1, ent = null) {
    if (!e) return;
    for (let i = 0; i < cuadros && e.fase === "jugando"; i++) { pasoPlat(e, ent || entrada, 1 / 60); drenar(); }
    dibujar(); hud();
  }
  const SONIDO = { salto: "paso", moneda: "estrella", pisoton: "golpe", danio: "mal", golpe: "golpe", acierto: "bien", error: "mal", puerta_abierta: "puerta", puerta_cerrada: "golpe", ganado: "fanfarria", perdido: "derrota" };
  function drenar() {
    const evs = e.ev.splice(0);
    for (const v of evs) {
      if (SONIDO[v]) sonar(SONIDO[v]);
      if (v === "pregunta") { pausado = true; mostrarPregunta(); }
      if (v === "ganado") mostrarFin(true);
      if (v === "perdido") mostrarFin(false);
    }
  }
  function hud() {
    const set = (r, t) => { const el = raiz.querySelector(`[data-r="${r}"]`); if (el && el.textContent !== t) el.textContent = t; };
    if (!e) return;
    set("h-v", "❤️".repeat(Math.max(0, e.corazones)) + "🖤".repeat(Math.max(0, e.corazonesMax - e.corazones))); set("h-m", `🪙 ${e.monedas}`); set("h-a", `✅ ${Math.min(e.aciertos, e.puertaNecesita)}/${e.puertaNecesita}${e.puertaAbierta ? " 🚪" : ""}`);
    const av = raiz.querySelector('[data-r="aviso"]'); if (av) { if (e.aviso) { av.hidden = false; if (av.textContent !== e.aviso) av.textContent = e.aviso; } else av.hidden = true; }
  }
  function mostrarPregunta() {
    entrada.izq = entrada.der = entrada.salto = false;
    const p = e.pregunta, velo = raiz.querySelector('[data-r="velo"]');
    velo.innerHTML = `<div class="pl-vel"><div class="oca-card"><h3>❓ Bloque del saber · respuestas correctas: ${e.aciertos}/${e.puertaNecesita}</h3><div class="q">${esc(p.texto)}</div>${p.opciones.map((o, i) => `<button class="oca-op" data-op="${i}">${esc(o)}</button>`).join("")}<div data-r="fb"></div></div></div>`;
    velo.querySelectorAll("[data-op]").forEach((b) => (b.onclick = () => {
      if (!e || e.fase !== "pregunta") return;
      const i = Number(b.dataset.op), r = responderPlat(e, i);
      velo.querySelectorAll("[data-op]").forEach((x) => { x.disabled = true; const k = Number(x.dataset.op); if (k === r.correcta) x.classList.add("bien"); else if (k === i) x.classList.add("mal"); });
      const fb = velo.querySelector('[data-r="fb"]');
      fb.innerHTML = `<div class="oca-fb"><b>${r.ok ? "✅ ¡Correcto! +3 🪙" : "❌ No era esa. El bloque sigue ahí: ¡inténtalo de nuevo!"}</b>${r.retro ? `<br>${esc(r.retro)}` : ""}${!r.ok && r.pista ? `<br>💡 ${esc(r.pista)}` : ""}${r.ok && e.puertaAbierta === false && e.aciertos >= e.puertaNecesita ? "<br>🚪 ¡La puerta del saber se va a abrir!" : ""}</div><button class="oca-ok" data-a="seguir">Continuar</button>`;
      drenar0();
      fb.querySelector('[data-a="seguir"]').onclick = () => { velo.innerHTML = ""; pausado = confirmando; acc = 0; last = performance.now(); hud(); };
    }));
  }
  const drenar0 = () => { const evs = e.ev.splice(0); evs.forEach((v) => SONIDO[v] && sonar(SONIDO[v])); };
  async function mostrarFin(gano) {
    pausado = true; entrada.izq = entrada.der = entrada.salto = false;
    const velo = raiz.querySelector('[data-r="velo"]'), est = gano ? estrellasPlat(e) : 0;
    const res = resultadoPlat(e);
    velo.innerHTML = `<div class="pl-vel"><div class="oca-card oca-fin"><div class="gr">${gano ? "🚩" : "💔"}</div><h2 style="margin:0">${gano ? "¡Nivel superado!" : "¡Te quedaste sin corazones!"}</h2>${gano ? `<div class="est">${"⭐".repeat(est)}${"☆".repeat(3 - est)}</div>` : ""}<div style="font-size:13px;color:#475569">${gano ? `🪙 ${e.monedas} · ✅ ${e.aciertos} aciertos · ❌ ${e.errores} errores · 👟 ${e.pisotones} pisotones` : "Ánimo: inténtalo otra vez, ¡ya conoces el camino!"}</div><div data-r="premio" class="oca-prem nota">${gano ? "Guardando tu premio…" : ""}</div><div data-r="botones"></div></div></div>`;
    const botones = () => {
      const b = velo.querySelector('[data-r="botones"]');
      b.innerHTML = `${gano && nivel < NIVELES_PLAT ? `<button class="oca-ok" data-a="sig">Siguiente nivel ▶</button>` : ""}<button class="oca-ok ${gano && nivel < NIVELES_PLAT ? "sec" : ""}" data-a="rep" style="margin-top:8px">${gano ? "🔁 Repetir nivel" : "🔁 Intentar de nuevo"}</button><button class="oca-ok sec" data-a="menu" style="margin-top:8px">Elegir nivel</button><button class="oca-ok sec" data-a="fuera" style="margin-top:8px">Volver al mundo</button>`;
      const s = b.querySelector('[data-a="sig"]'); if (s) s.onclick = () => iniciar(nivel + 1);
      b.querySelector('[data-a="rep"]').onclick = () => iniciar(nivel); b.querySelector('[data-a="menu"]').onclick = () => menu(); b.querySelector('[data-a="fuera"]').onclick = () => cerrar();
    };
    if (!gano) { botones(); return; }
    const p = velo.querySelector('[data-r="premio"]');
    const enviar = async () => {
      let r;
      try { r = ctx.alResultado ? await ctx.alResultado(res) : { ok: true, local: true }; } catch (err) { r = { ok: false, mensaje: err && err.message }; }
      if (!vivo) return;
      if (!r.ok) { p.className = "oca-prem mal"; p.textContent = "No se pudo guardar tu premio: " + (r.mensaje || "revisa tu conexión") + "."; const b = velo.querySelector('[data-r="botones"]'); b.innerHTML = `<button class="oca-ok" data-a="reint">Reintentar</button>`; b.querySelector("button").onclick = () => { p.className = "oca-prem nota"; p.textContent = "Guardando tu premio…"; b.innerHTML = ""; enviar(); }; return; }
      if (r.local) { p.className = "oca-prem nota"; p.textContent = "(Modo prueba: no se guardó nada.)"; }
      else if (r.yaEstaba) { hechos.add(res.clave); p.className = "oca-prem nota"; p.textContent = "Hoy ya ganaste el premio de este nivel. ¡Vuelve mañana por más!"; }
      else { hechos.add(res.clave); const pr = r.premio || {}; p.className = "oca-prem"; p.innerHTML = `🎁 +${pr.xp || 0} XP · +${pr.oro || 0} 🪙${r.evento ? `<br><span style="font-size:13px">${esc(r.evento.emoji || "🎉")} ${esc(r.evento.nombre)}: +${r.evento.extraXp || 0} XP y +${r.evento.extraOro || 0} 🪙 extra</span>` : ""}`; }
      botones();
    };
    enviar();
  }

  // ---------- dibujo ----------
  const solidoDe = (c, r) => { if (c < 0 || c >= e.ancho || r < 0 || r >= FILAS) return false; return "#=?uG".includes(e.grid[r][c]); };
  function dibujar() {
    if (!g || !e) return;
    const tm = TEMAS[nivel] || TEMAS[1], cam = Math.max(0, Math.min(e.ancho * T - ANCHO_VISTA, Math.round(e.x + PW / 2 - ANCHO_VISTA / 2)));
    const cielo = g.createLinearGradient(0, 0, 0, ALTO_VISTA); cielo.addColorStop(0, tm.cielo[0]); cielo.addColorStop(1, tm.cielo[1]); g.fillStyle = cielo; g.fillRect(0, 0, ANCHO_VISTA, ALTO_VISTA);
    // colinas lejanas (se mueven más despacio)
    for (let capa = 0; capa < 2; capa++) { g.fillStyle = capa ? tm.colinas2 : tm.colinas; const par = capa ? 0.5 : 0.25; g.beginPath(); g.moveTo(0, ALTO_VISTA); for (let x = 0; x <= ANCHO_VISTA; x += 16) { const wx = x + cam * par; g.lineTo(x, ALTO_VISTA - 120 - capa * 30 - Math.sin(wx / (70 + capa * 40)) * 26 - Math.sin(wx / 23) * 6); } g.lineTo(ANCHO_VISTA, ALTO_VISTA); g.fill(); }
    if (nivel === 1) { g.font = `28px ${FUENTE}`; g.textAlign = "center"; g.textBaseline = "middle"; for (let i = 0; i < 6; i++) { const x = ((i * 260 - cam * 0.2) % (ANCHO_VISTA + 200) + ANCHO_VISTA + 200) % (ANCHO_VISTA + 200) - 60; g.globalAlpha = 0.9; g.fillText("☁️", x, 40 + (i % 3) * 28); g.globalAlpha = 1; } }
    const c0 = Math.floor(cam / T), c1 = Math.min(e.ancho - 1, Math.ceil((cam + ANCHO_VISTA) / T));
    g.textAlign = "center"; g.textBaseline = "middle";
    for (let r = 0; r < FILAS; r++) for (let c = c0; c <= c1; c++) {
      const ch = e.grid[r][c]; if (ch === " ") continue; const x = c * T - cam, y = r * T;
      if (ch === "#") {
        g.fillStyle = tm.suelo; g.fillRect(x, y, T, T); g.fillStyle = tm.sueloOsc; g.fillRect(x + 4, y + 10, 4, 4); g.fillRect(x + 18, y + 20, 5, 4); g.fillRect(x + 24, y + 6, 3, 3);
        if (!solidoDe(c, r - 1)) { g.fillStyle = tm.cesped; g.fillRect(x, y, T, 7); g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(x, y + 7, T, 2); }
      } else if (ch === "=") {
        g.fillStyle = tm.plat; g.fillRect(x, y, T, T); g.fillStyle = "rgba(255,255,255,.22)"; g.fillRect(x, y, T, 4); g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(x, y + T - 5, T, 5); g.fillRect(x + T / 2 - 1, y + 6, 2, T - 12);
      } else if (ch === "?" || ch === "u") {
        let dy = 0; if (e.golpe && e.golpe.c === c && e.golpe.r === r) dy = -Math.sin((1 - e.golpe.t / 0.18) * Math.PI) * 7;
        g.fillStyle = ch === "?" ? "#facc15" : "#78716c"; g.fillRect(x, y + dy, T, T); g.strokeStyle = ch === "?" ? "#a16207" : "#44403c"; g.lineWidth = 3; g.strokeRect(x + 1.5, y + dy + 1.5, T - 3, T - 3);
        g.fillStyle = ch === "?" ? "#fff" : "#a8a29e"; g.font = `bold 20px ${FUENTE}`; g.fillText(ch === "?" ? "?" : "·", x + T / 2, y + dy + T / 2 + 1);
      } else if (ch === "G") {
        g.fillStyle = "#94a3b8"; g.fillRect(x, y, T, T); g.strokeStyle = "#475569"; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, T - 2, T - 2); g.fillStyle = "#64748b"; g.fillRect(x + 4, y + 4, T - 8, 3);
        if (e.grid[r - 1] && e.grid[r - 1][c] === "G" && e.grid[r + 1] && e.grid[r + 1][c] === "G" && e.grid[r - 2] && e.grid[r - 2][c] === "G") { g.font = `22px ${FUENTE}`; g.fillText("🔒", x + T / 2, y + T / 2); }
      } else if (ch === "o") {
        const w = Math.abs(Math.cos(e.t * 4 + c * 0.7)) * 9 + 2; g.fillStyle = "#fbbf24"; g.beginPath(); g.ellipse(x + T / 2, y + T / 2, w, 10, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = "#b45309"; g.lineWidth = 2; g.stroke();
      } else if (ch === "^") {
        g.fillStyle = "#e2e8f0"; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x + i * 10 + 1, y + T); g.lineTo(x + i * 10 + 6, y + T - 18); g.lineTo(x + i * 10 + 11, y + T); g.fill(); } g.fillStyle = "#94a3b8"; g.fillRect(x, y + T - 4, T, 4);
      } else if (ch === "F") {
        g.fillStyle = "#e2e8f0"; g.fillRect(x + T / 2 - 2, y, 4, T);
        if (!e.grid[r - 1] || e.grid[r - 1][c] !== "F") { g.fillStyle = "#ef4444"; g.beginPath(); g.moveTo(x + T / 2 + 2, y + 2); g.lineTo(x + T / 2 + 24 + Math.sin(e.t * 6) * 3, y + 10); g.lineTo(x + T / 2 + 2, y + 18); g.fill(); g.fillStyle = "#facc15"; g.beginPath(); g.arc(x + T / 2, y + 1, 4, 0, Math.PI * 2); g.fill(); }
      }
    }
    // enemigos
    for (const n of e.enemigos) {
      if (!n.vivo) continue; const x = n.x - cam, y = n.y, b = Math.sin(e.t * 9 + n.x) * 1.5;
      g.fillStyle = "#dc2626"; g.beginPath(); g.moveTo(x, y + n.h); g.lineTo(x, y + 10); g.quadraticCurveTo(x + n.w / 2, y - 6 + b, x + n.w, y + 10); g.lineTo(x + n.w, y + n.h); g.fill();
      g.fillStyle = "#7f1d1d"; g.fillRect(x + 1, y + n.h - 5, 8, 5); g.fillRect(x + n.w - 9, y + n.h - 5 - b, 8, 5);
      g.fillStyle = "#fff"; g.fillRect(x + 5, y + 8, 6, 7); g.fillRect(x + 13, y + 8, 6, 7); g.fillStyle = "#111"; const mir = n.vx > 0 ? 3 : 0; g.fillRect(x + 6 + mir, y + 11, 3, 4); g.fillRect(x + 14 + mir, y + 11, 3, 4);
      g.fillStyle = "#450a0a"; g.fillRect(x + 4, y + 5, 7, 2); g.fillRect(x + 13, y + 5, 7, 2);
    }
    // héroe
    if (!(e.inv > 0 && Math.floor(e.t * 14) % 2 === 0) && e.fase !== "perdido") {
      const x = Math.round(e.x - cam), y = Math.round(e.y), cam2 = Math.floor(e.t * 12) % 2, corre = Math.abs(e.vx) > 20 && e.enSuelo, dir = e.dir;
      g.fillStyle = "#1e293b"; if (!e.enSuelo) { g.fillRect(x + 2, y + 22, 7, 6); g.fillRect(x + 11, y + 20, 7, 6); } else { g.fillRect(x + 2, y + 22 + (corre && cam2 ? 0 : 0), 7, 6); g.fillRect(x + 11, y + 22, 7, 6 - (corre && cam2 ? 2 : 0)); }
      g.fillStyle = "#7c3aed"; g.fillRect(x + 1, y + 12, 18, 11);
      g.fillStyle = "#fcd5b0"; g.fillRect(x + 3, y + 4, 14, 9);
      g.fillStyle = "#facc15"; g.fillRect(x + 1, y, 18, 5); g.fillRect(dir > 0 ? x + 10 : x - 1, y + 3, 10, 3);
      g.fillStyle = "#111"; g.fillRect(dir > 0 ? x + 11 : x + 5, y + 7, 3, 3);
      g.fillStyle = "#fcd5b0"; g.fillRect(dir > 0 ? x + 17 : x - 1, y + 14, 3, 5);
    }
    // nombre del nivel al empezar
    if (e.t < 2.2) { g.globalAlpha = Math.min(1, 2.2 - e.t); g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(ANCHO_VISTA / 2 - 190, 60, 380, 44); g.fillStyle = "#fff"; g.font = `bold 22px ${FUENTE}`; g.fillText(`Nivel ${nivel} · ${NOMBRES_NIVEL[nivel - 1]}`, ANCHO_VISTA / 2, 82); g.globalAlpha = 1; }
  }

  function cerrar() {
    if (!vivo) return; vivo = false; cancelAnimationFrame(raf);
    window.removeEventListener("resize", ajustar); window.removeEventListener("keydown", abajo, true); window.removeEventListener("keyup", arriba, true);
    host.classList.add("oculto"); host.innerHTML = ""; if (ctx.alSalir) ctx.alSalir();
  }
  if (ctx.nivelInicial) iniciar(ctx.nivelInicial); else menu();
  return { cerrar, estado: () => e, avanzar, entrada, hechos: () => [...hechos] };
}
