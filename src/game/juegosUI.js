// =====================================================================================
//  PANTALLA DE LOS JUEGOS DE LA CASA DE LOS ACERTIJOS (sopa, criptograma, ahorcado, rompecabezas)
//  Usa la lógica de acertijos.js. Se monta dentro de un contenedor y avisa cuando el estudiante gana.
// =====================================================================================
import { crearSopa, palabraEnLinea, parsearPalabras, crearCripto, estadoCripto, crearAhorcado, estadoAhorcado, crearRompe, moverRompe, rompeResuelto, letraDe } from "./acertijos";

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
  const empezar = () => { ganado = false; ({ sopa: juegoSopa, cripto: juegoCripto, ahorcado: juegoAhorcado, rompe: juegoRompe }[ac.tipo] || juegoError)(); };
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

  empezar();
  return { tecla: (k) => (vivo ? manejaTecla(k) : false), destruir() { vivo = false; host.onclick = null; host.innerHTML = ""; } };
}
