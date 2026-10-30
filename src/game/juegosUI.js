// =====================================================================================
//  PANTALLA DE LOS JUEGOS DE LA CASA DE LOS ACERTIJOS (sopa, criptograma, ahorcado, rompecabezas)
//  Usa la lógica de acertijos.js. Se monta dentro de un contenedor y avisa cuando el estudiante gana.
// =====================================================================================
import { crearSopa, palabraEnLinea, parsearPalabras, crearCripto, estadoCripto, crearAhorcado, estadoAhorcado, crearRompe, moverRompe, rompeResuelto, letraDe, soloLetras, parsearRosco, aciertaRosco, metaRosco, segundosRosco } from "./acertijos";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ABC = [..."ABCDEFGHIJKLMNÑOPQRSTUVWXYZ"];
const teclado = (usadas = new Set()) => `<div class="jg-teclado">${ABC.map((l) => `<button class="jg-k" data-l="${l}" ${usadas.has(l) ? "disabled" : ""}>${l}</button>`).join("")}</div>`;

// host: elemento donde se dibuja. ac: { tipo, contenido, tam, pista }. cb: { alGanar(), rand }.
// Devuelve { tecla(k) → true si la usó, destruir() }.
export function montarJuego(host, ac, cb = {}) {
  const rand = cb.rand || Math.random; let vivo = true, ganado = false, manejaTecla = () => false;
  const ganar = () => { if (ganado || !vivo) return; ganado = true; if (cb.alGanar) cb.alGanar(); };
  const q = (s) => host.querySelector(s), qa = (s) => host.querySelectorAll(s);
  const pista = ac.pista ? `<div class="jg-pista">💡 ${esc(ac.pista)}</div>` : "";
  const otra = '<button class="jg-otra" data-a="otra">🔄 Otra vez</button>';
  const empezar = () => { ganado = false; ({ sopa: juegoSopa, cripto: juegoCripto, ahorcado: juegoAhorcado, rompe: juegoRompe, rosco: juegoRosco }[ac.tipo] || juegoError)(); };
  host.onclick = (e) => { const b = e.target.closest && e.target.closest('[data-a="otra"]'); if (b) empezar(); };

  function juegoError() { host.innerHTML = '<p class="m-texto">Este acertijo no se puede mostrar todavía.</p>'; }

  // ---------- sopa de letras ----------
  function juegoSopa() {
    const sopa = crearSopa(parsearPalabras(ac.contenido), { tam: ac.tam, rand });
    if (sopa.imposible) return juegoError();
    const halladas = new Set(), celdasOk = new Set(); let primera = null;
    const pintar = () => {
      host.innerHTML = `${pista}<div class="jg-ayuda">Toca la primera y la última letra de cada palabra (en cualquier sentido).</div>
        <div class="jg-sopa" style="grid-template-columns:repeat(${sopa.tam},1fr)">${sopa.grid.map((fila, r) => fila.map((l, c) => `<button class="jg-s ${celdasOk.has(r + "," + c) ? "ok" : ""} ${primera && primera[0] === r && primera[1] === c ? "sel" : ""}" data-r="${r}" data-c="${c}">${l}</button>`).join("")).join("")}</div>
        <div class="jg-palabras">${sopa.palabras.map((p) => `<span class="jg-p ${halladas.has(p) ? "hecha" : ""}">${p}</span>`).join("")}</div>
        <div class="jg-msg">${halladas.size}/${sopa.palabras.length} palabras</div>${otra}`;
      qa(".jg-s").forEach((b) => (b.onclick = () => tocar(Number(b.dataset.r), Number(b.dataset.c))));
    };
    const tocar = (r, c) => {
      if (ganado) return;
      if (!primera) { primera = [r, c]; return pintar(); }
      const a = primera; primera = null;
      const hit = palabraEnLinea(sopa, a, [r, c]);
      if (hit && !halladas.has(hit.palabra)) { halladas.add(hit.palabra); hit.celdas.forEach(([y, x]) => celdasOk.add(y + "," + x)); }
      pintar();
      if (halladas.size === sopa.palabras.length) { q(".jg-msg").textContent = "🎉 ¡Encontraste todas las palabras!"; ganar(); }
    };
    manejaTecla = () => false; pintar();
  }

  // ---------- criptograma ----------
  function juegoCripto() {
    const cr = crearCripto(ac.contenido, { rand });
    if (cr.imposible) return juegoError();
    const intentos = {}; let elegido = null;
    const valor = (cod) => cr.pistas[cod] || intentos[cod] || "";
    const pintar = () => {
      const est = estadoCripto(cr, intentos), malos = est.faltan === 0 ? new Set(est.mal) : new Set();
      // se agrupa por palabras para que no se corten en medio al ajustar la línea
      const grupos = []; let g = [];
      cr.celdas.forEach((c) => { if (c.ch === " ") { if (g.length) grupos.push(g); g = []; } else g.push(c); }); if (g.length) grupos.push(g);
      const celda = (c) => c.codigo == null ? `<span class="jg-sig">${esc(c.ch)}</span>` : `<button class="jg-c ${elegido === c.codigo ? "sel" : ""} ${malos.has(c.codigo) ? "mal" : ""} ${cr.pistas[c.codigo] ? "dada" : ""}" data-cod="${c.codigo}"><span class="l">${valor(c.codigo) || "&nbsp;"}</span><span class="n">${c.codigo}</span></button>`;
      host.innerHTML = `${pista}<div class="jg-ayuda">Cada número es una letra. Toca un número y elige la letra. Las que tienen fondo dorado ya están dadas.</div>
        <div class="jg-cripto">${grupos.map((gr) => `<span class="jg-pal">${gr.map(celda).join("")}</span>`).join("")}</div>
        ${teclado()}<div class="jg-msg">${est.resuelto ? "🎉 ¡Descifraste la frase!" : est.faltan === 0 ? "Hay letras mal puestas (en rojo). ¡Corrígelas!" : `Faltan ${est.faltan} letras por descubrir`}</div>${otra}`;
      qa(".jg-c").forEach((b) => (b.onclick = () => { if (!ganado) { elegido = Number(b.dataset.cod); pintar(); } }));
      qa(".jg-k").forEach((b) => (b.onclick = () => poner(b.dataset.l)));
      if (est.resuelto) ganar();
    };
    const poner = (l) => {
      if (ganado || elegido == null || cr.pistas[elegido]) return;
      intentos[elegido] = l;
      const sig = Object.keys(cr.respuestaDe).map(Number).find((k) => !valor(k)); // salta al siguiente número vacío
      elegido = sig != null ? sig : elegido; pintar();
    };
    manejaTecla = (k) => { const l = letraDe(k); if (l) { poner(l); return true; } if (k === "Backspace" && elegido != null && !cr.pistas[elegido]) { delete intentos[elegido]; pintar(); return true; } return false; };
    elegido = Object.keys(cr.respuestaDe).map(Number).find((k) => !cr.pistas[k]) ?? null; pintar();
  }

  // ---------- ahorcado ----------
    function juegoAhorcado() {
    const ah = crearAhorcado(ac.contenido); if (ah.imposible) return juegoError();
    const probadas = [];
    const pintar = () => {
      const st = estadoAhorcado(ah, probadas), vidas = ah.maxErrores - st.errores;
      host.innerHTML = `${pista}<div class="jg-vidas">${"❤️".repeat(Math.max(0, vidas))}${"🖤".repeat(Math.min(ah.maxErrores, st.errores))}</div>
        <div class="jg-frase ${st.perdio ? "perdio" : ""}">${st.visible.map((ch) => ch === " " ? '<i class="esp"></i>' : ch === "_" ? "<b>&nbsp;</b>" : letraDe(ch) ? `<b>${esc(ch)}</b>` : `<span>${esc(ch)}</span>`).join("")}</div>
        ${st.gano || st.perdio ? "" : teclado(new Set(st.probadas))}
        <div class="jg-msg">${st.gano ? "🎉 ¡Adivinaste!" : st.perdio ? "Se acabaron las vidas. ¡Inténtalo otra vez!" : `Te quedan ${vidas} ${vidas === 1 ? "vida" : "vidas"}`}</div>${otra}`;
      qa(".jg-k").forEach((b) => (b.onclick = () => probar(b.dataset.l)));
      if (st.gano) ganar();
    };
    const probar = (l) => { const st = estadoAhorcado(ah, probadas); if (ganado || st.perdio || st.gano || probadas.includes(l)) return; probadas.push(l); pintar(); };
    manejaTecla = (k) => { const l = letraDe(k); if (l) { probar(l); return true; } return false; };
    pintar();
  }

  // ---------- rompecabezas deslizante ----------
  function juegoRompe() {
    const url = String(ac.contenido || "").trim(), n = (ac.tam || 0) >= 4 ? 4 : 3;
    let est = crearRompe(n, { rand });
    const pintar = () => {
      const hecho = rompeResuelto(est.piezas);
      host.innerHTML = `${pista}<div class="jg-ayuda">Toca una ficha junto al hueco para deslizarla. Ordénalas del 1 al ${n * n - 1}.</div>
        ${url ? `<div class="jg-ref" style="background-image:url('${esc(url)}')" title="Así debe quedar"></div>` : ""}
        <div class="jg-rompe" style="grid-template-columns:repeat(${n},1fr)">${est.piezas.map((p, i) => {
          if (p === 0 && !hecho) return '<div class="jg-f hueco"></div>';
          const v = p === 0 ? n * n : p, fx = (v - 1) % n, fy = Math.floor((v - 1) / n);
          const fondo = url ? `background-image:url('${esc(url)}');background-size:${n * 100}% ${n * 100}%;background-position:${n > 1 ? (fx / (n - 1)) * 100 : 0}% ${n > 1 ? (fy / (n - 1)) * 100 : 0}%;` : "";
          return `<button class="jg-f ${url ? "img" : ""}" data-i="${i}" style="${fondo}">${url ? "" : v}</button>`;
        }).join("")}</div>
        <div class="jg-msg">${hecho ? `🎉 ¡Armado en ${est.movimientos} movimientos!` : `Movimientos: ${est.movimientos}`}</div>${otra}`;
      qa(".jg-f[data-i]").forEach((b) => (b.onclick = () => { if (ganado) return; const nuevo = moverRompe(est, Number(b.dataset.i)); if (nuevo !== est) { est = nuevo; pintar(); } }));
      if (hecho) ganar();
    };
    manejaTecla = () => false; pintar();
  }

  // ---------- rosco de palabras ----------
  let relojRosco = null;
  function juegoRosco() {
    clearInterval(relojRosco);
    const items = parsearRosco(ac.contenido); if (items.length < 5) return juegoError();
    const n = items.length, meta = metaRosco(n); let restante = segundosRosco(n);
    const est = items.map(() => "pend"), pasadas = new Set(); let cur = 0, aviso = "", fin = false;
    const css = "#jg-rosco-css";
    if (!host.ownerDocument.querySelector(css)) {
      const st = host.ownerDocument.createElement("style"); st.id = "jg-rosco-css";
      st.textContent = ".jg-rr{position:relative;width:min(290px,100%);aspect-ratio:1;margin:6px auto}.jg-rl{position:absolute;width:11%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:clamp(10px,3vw,14px);background:#334155;color:#fff;border:2px solid transparent}.jg-rl.ok{background:#16a34a}.jg-rl.mal{background:#dc2626}.jg-rl.pasa{background:#d97706}.jg-rl.cur{border-color:#fde047;box-shadow:0 0 0 3px #fde04788;transform:translate(-50%,-50%) scale(1.25);z-index:2}.jg-rc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800}.jg-rc b{font-size:24px}.jg-rc span{font-size:11px;opacity:.7}.jg-rq{background:var(--fondo,#f1f5f9);border:1px solid var(--borde,#cbd5e1);border-radius:12px;padding:9px 11px;margin:6px 0;font-size:14px;line-height:1.35}.jg-rq small{display:block;font-weight:800;opacity:.75;margin-bottom:2px}.jg-rf{display:flex;gap:6px}.jg-ri{flex:1;min-width:0;font-size:16px;padding:8px 10px;border-radius:10px;border:2px solid var(--borde,#cbd5e1);background:#fff;color:#0f172a;text-transform:uppercase}.jg-rb{border:0;border-radius:10px;padding:8px 12px;font-weight:800;font-size:13px;background:var(--acento,#7c3aed);color:#fff}.jg-rb.sec{background:var(--borde,#e2e8f0);color:var(--texto,#0f172a)}";
      host.ownerDocument.head.appendChild(st);
    }
    const aciertos = () => est.filter((e) => e === "ok").length;
    const siguiente = (desde) => { for (let k = 1; k <= n; k++) { const j = (desde + k) % n; if (est[j] === "pend") return j; } return -1; };
    const mmss = () => `${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, "0")}`;
    const circulo = () => items.map((it, i) => { const ang = (-90 + (360 * i) / n) * (Math.PI / 180); const cls = est[i] !== "pend" ? est[i] : pasadas.has(i) ? "pasa" : ""; return `<span class="jg-rl ${cls} ${i === cur && !fin ? "cur" : ""}" style="left:${50 + 44 * Math.cos(ang)}%;top:${50 + 44 * Math.sin(ang)}%">${esc(it.letra)}</span>`; }).join("");
    const terminar = () => {
      if (fin) return; fin = true; clearInterval(relojRosco);
      const ok = aciertos(), gano = ok >= meta;
      host.innerHTML = `${pista}<div class="jg-rr">${circulo()}<div class="jg-rc"><b>${ok}/${n}</b><span>aciertos</span></div></div>
        <div class="jg-msg">${gano ? `🎉 ¡Completaste el rosco! (${ok} de ${n}, se pedían ${meta})` : `Acertaste ${ok} de ${n}. Se necesitan ${meta} para ganar. ¡Inténtalo otra vez!`}</div>
        <div class="jg-ayuda">${items.map((it, i) => est[i] === "ok" ? "" : `<div>❌ <b>${esc(it.letra)}</b>: ${esc(it.respuesta)}</div>`).join("")}</div>${otra}`;
      if (gano) ganar();
    };
    const pintar = () => {
      if (fin) return;
      const it = items[cur];
      host.innerHTML = `${pista}<div class="jg-rr">${circulo()}<div class="jg-rc"><b class="jg-rt">${mmss()}</b><span>${aciertos()}/${n} · meta ${meta}</span></div></div>
        <div class="jg-rq"><small>${it.modo === "empieza" ? `Empieza por ${esc(it.letra)}` : `Contiene la ${esc(it.letra)}`}</small>${esc(it.definicion)}</div>
        ${aviso ? `<div class="jg-ayuda">${aviso}</div>` : ""}
        <div class="jg-rf"><input class="jg-ri" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Tu respuesta…" aria-label="Tu respuesta"><button class="jg-rb" data-r="ok">✔</button><button class="jg-rb sec" data-r="pasa">⏭ Pasapalabra</button></div>`;
      const inp = q(".jg-ri");
      q('[data-r="ok"]').onclick = responder; q('[data-r="pasa"]').onclick = pasar;
      inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); responder(); } };
      try { inp.focus({ preventScroll: true }); } catch (e) { /* nada */ }
    };
    const avanzar = () => { const j = siguiente(cur); if (j < 0) return terminar(); cur = j; pintar(); };
    function responder() {
      if (fin) return; const inp = q(".jg-ri"); const v = inp ? inp.value : ""; if (!soloLetras(v)) return;
      const it = items[cur];
      if (aciertaRosco(it, v)) { est[cur] = "ok"; aviso = ""; } else { est[cur] = "mal"; aviso = `❌ Era <b>${esc(it.respuesta)}</b>.`; }
      avanzar();
    }
    function pasar() { if (fin) return; pasadas.add(cur); aviso = ""; const j = siguiente(cur); if (j < 0 || j === cur) return pintar(); cur = j; pintar(); }
    relojRosco = setInterval(() => {
      if (!vivo || !host.isConnected) return clearInterval(relojRosco);
      restante -= 1; const t = q(".jg-rt"); if (t) t.textContent = mmss();
      if (restante <= 0) terminar();
    }, 1000);
    manejaTecla = () => false; // el campo de texto usa el teclado normal
    pintar();
  }

  empezar();
  return { tecla: (k) => (vivo ? manejaTecla(k) : false), destruir() { vivo = false; clearInterval(relojRosco); host.onclick = null; host.innerHTML = ""; } };
}
