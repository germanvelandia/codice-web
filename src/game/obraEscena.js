// =====================================================================================
//  LA GRAN OBRA DENTRO DEL MUNDO — plaza compartida + panel (votar, aportar, retos, construir)
//  Este módulo se engancha al motor (mundo.js) con montarObra(env). El estado verdadero vive en
//  el servidor: aquí solo se dibuja y se piden acciones.
// =====================================================================================
import { PLAZA, PIEZAS_OBRA, RECURSOS_OBRA, EMOJI_RECURSO, NOMBRE_RECURSO, emojiDePieza, nombreDePieza } from "./obras";

const MOTIVOS = {
  no_constructor: "Solo los constructores colocan piezas. Elige ese rol en el panel 🏗️.",
  fuera_del_plano: "Esa casilla no es parte del plano de esta fase.",
  ocupada: "Alguien ya colocó una pieza ahí.",
  falta_almacen: "Al almacén le faltan recursos para esta pieza. ¡Los recolectores pueden ayudar!",
  tope: "Llegaste al tope de hoy. Mañana puedes seguir.",
  sin_recursos: "No tienes ese recurso en tu mochila.",
  reto_completo: "El reto de esta fase ya está completo 🎉",
  sin_preguntas: "No hay preguntas disponibles. Avísale a tu docente.",
};
const ESTADO_TXT = { preparacion: "en preparación", votacion: "🗳️ votación", construccion: "🔨 en construcción", terminada: "🏆 terminada" };

export const CSS_OBRA = `
.mundo .m-obra { position: absolute; right: 10px; top: 58px; z-index: 20; width: min(340px, calc(100% - 20px)); max-height: calc(100% - 150px); overflow-y: auto; background: var(--panel); color: var(--texto); border: 1px solid var(--borde); border-radius: 16px; padding: 10px 12px; box-shadow: 0 6px 20px rgba(0,0,0,.4); }
@media (max-width: 699px) { .mundo .m-obra { left: 8px; right: 8px; width: auto; top: 96px; max-height: 38%; } }
.mundo .m-toast { pointer-events: none; }
.mundo .m-obra .ob-cab { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 14px; }
.mundo .m-obra .ob-cab span { font-size: 11px; font-weight: 600; color: var(--suave); }
.mundo .m-obra .ob-cab button { margin-left: auto; background: none; border: 0; color: var(--suave); font-size: 18px; cursor: pointer; }
.mundo .m-obra .ob-tabs { display: flex; gap: 4px; margin: 8px 0; }
.mundo .m-obra .ob-tabs button { flex: 1; font-size: 12px; font-weight: 700; padding: 6px 4px; border-radius: 10px; border: 1px solid var(--borde); background: var(--fondo); color: var(--texto); cursor: pointer; }
.mundo .m-obra .ob-tabs button.sel { background: var(--acento); color: #fff; border-color: var(--acento); }
.mundo .m-obra .ob-txt { font-size: 12px; color: var(--suave); line-height: 1.4; margin: 4px 0; }
.mundo .m-obra .ob-barra { height: 8px; background: var(--borde); border-radius: 6px; overflow: hidden; margin: 3px 0 6px; } .mundo .m-obra .ob-barra i { display: block; height: 100%; background: var(--ok); }
.mundo .m-obra .ob-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
.mundo .m-obra .ob-chip { font-size: 12px; font-weight: 700; background: var(--fondo); border: 1px solid var(--borde); border-radius: 999px; padding: 3px 9px; }
.mundo .m-obra .ob-op { display: flex; gap: 10px; align-items: center; border: 1px solid var(--borde); border-radius: 12px; padding: 8px; margin: 6px 0; background: var(--fondo); }
.mundo .m-obra .ob-op.mi { border-color: var(--acento); box-shadow: 0 0 0 2px var(--acento) inset; }
.mundo .m-obra .ob-op .e { font-size: 28px; } .mundo .m-obra .ob-op b { font-size: 13px; } .mundo .m-obra .ob-op small { display: block; font-size: 11px; color: var(--suave); line-height: 1.3; }
.mundo .m-obra .ob-btn { font-size: 12px; font-weight: 800; padding: 7px 12px; border-radius: 10px; border: 0; background: var(--acento); color: #fff; cursor: pointer; } .mundo .m-obra .ob-btn.g { background: var(--ok); } .mundo .m-obra .ob-btn:disabled { opacity: .5; }
.mundo .m-obra .ob-btn.s { background: var(--fondo); color: var(--texto); border: 1px solid var(--borde); }
.mundo .m-obra .ob-fila { display: flex; align-items: center; gap: 8px; margin: 5px 0; font-size: 13px; } .mundo .m-obra .ob-fila .n { flex: 1; font-weight: 700; }
.mundo .m-obra .ob-msg { font-size: 12px; font-weight: 700; margin-top: 6px; color: var(--ok); } .mundo .m-obra .ob-msg.mal { color: var(--mal); }
.mundo .m-obra .ob-preg { font-size: 14px; font-weight: 800; margin: 6px 0; }
.mundo .m-obra .ob-opc { display: block; width: 100%; text-align: left; margin: 4px 0; padding: 9px 10px; border-radius: 10px; border: 1px solid var(--borde); background: var(--fondo); color: var(--texto); font-size: 13px; cursor: pointer; } .mundo .m-obra .ob-opc.ok { background: var(--ok-s); border-color: var(--ok); } .mundo .m-obra .ob-opc.mal { background: var(--mal-s); border-color: var(--mal); }
`;
export const HTML_OBRA = '<div class="m-obra oculto"></div>';

// ---------- la escena: una plaza grande y cercada donde todo el curso construye ----------
export function crearPlazaObra({ lienzo, rng, TILE, FUENTE_EMOJI, estadoObra, piezas, ghosts }) {
  const COLS = PLAZA.cols, FILAS = PLAZA.filas, W = COLS * TILE, H = FILAS * TILE, mitad = COLS / 2, r = rng(8181);
  const esCerca = (tx, ty) => tx === 0 || ty === 0 || tx === COLS - 1 || (ty === FILAS - 1 && tx !== mitad - 1 && tx !== mitad);
  const [suelo, g] = lienzo(W, H);
  for (let ty = 0; ty < FILAS; ty++) for (let tx = 0; tx < COLS; tx++) {
    const px = tx * TILE, py = ty * TILE;
    const camino = (tx === mitad - 1 || tx === mitad) && ty >= FILAS - 5;
    const empedrado = tx >= 3 && tx <= COLS - 4 && ty >= 2 && ty <= FILAS - 5;       // la zona de obra: suelo de piedra clara
    g.fillStyle = camino ? ((tx + ty) % 2 ? "#b79a6a" : "#ae9061") : empedrado ? ((tx + ty) % 2 ? "#cfc9b8" : "#c6c0ae") : ((tx + ty) % 2 ? "#4c9a45" : "#478f40"); g.fillRect(px, py, TILE, TILE);
    for (let i = 0; i < 5; i++) { g.fillStyle = camino ? "#9c8052" : empedrado ? "#b3ad9a" : (r() < 0.5 ? "#5fb057" : "#3b7d35"); g.fillRect(px + Math.floor(r() * 30), py + Math.floor(r() * 30), 2, 2); }
  }
  for (let ty = 0; ty < FILAS; ty++) for (let tx = 0; tx < COLS; tx++) if (esCerca(tx, ty)) {
    const px = tx * TILE, py = ty * TILE;
    g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(px, py + 24, TILE, 5);
    g.fillStyle = "#8a5a2b"; g.fillRect(px, py + 12, TILE, 4); g.fillRect(px, py + 20, TILE, 4);
    g.fillStyle = "#6b4220"; g.fillRect(px + 4, py + 6, 5, 22); g.fillRect(px + 23, py + 6, 5, 22); g.fillStyle = "#a67340"; g.fillRect(px + 4, py + 6, 5, 2); g.fillRect(px + 23, py + 6, 5, 2);
  }
  const obstaculos = [];
  return {
    id: "obra", zona: "obra", nombre: "La Gran Obra", icono: "🏗️", exterior: false, musica: "exterior", plazaObra: true,
    ancho: W, alto: H, suelo, fondo: "#17391c", obstaculos, spawn: { x: W / 2, y: H - TILE - 6 }, mini: null, estrellas: [], edificios: [], portones: [],
    npcs: [], puertas: [], salidas: [{ x: W / 2 - TILE + 6, y: H - TILE + 12, w: 2 * TILE - 12, h: TILE + 20 }], slotsPorLugar: {},
    bloqueado: (px, py) => { const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE); return tx < 0 || ty < 0 || tx >= COLS || ty >= FILAS ? true : esCerca(tx, ty); },
    piso: () => "pasto", puntoLibre: () => ({ x: W / 2, y: H - 90 }),
    piezas,
    objetos(lista, ctx, camX, camY, visible, t) {
      const emojiPieza = (item, sx, sy, grande) => { ctx.globalAlpha = 1; ctx.fillStyle = "#000"; ctx.font = (grande ? 30 : 24) + "px " + FUENTE_EMOJI; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText(emojiDePieza(item), sx, sy); };
      for (const [, p] of piezas) {
        const cx = p.x * TILE + 16, by = p.y * TILE + 28; if (!visible(cx, by)) continue;
        lista.push({ y: by, d: () => {
          const sx = Math.round(cx - camX), sy = Math.round(by - camY);
          ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(sx, sy - 2, 12, 4, 0, 0, 7); ctx.fill();
          if (p.item === "farol") { ctx.fillStyle = `rgba(255,200,80,${0.14 + 0.05 * Math.sin(t * 5 + p.x)})`; ctx.beginPath(); ctx.arc(sx, sy - 14, 30, 0, 7); ctx.fill(); }
          emojiPieza(p.item, sx, sy - 3, ["estatua", "columna", "corona", "pozo", "paloma"].includes(p.item));
        } });
      }
      for (const gh of ghosts()) {
        const cx = gh.x * TILE + 16, by = gh.y * TILE + 28; if (!visible(cx, by)) continue;
        lista.push({ y: by - 1, d: () => {
          const sx = Math.round(cx - camX), sy = Math.round(by - camY), pulso = 0.5 + 0.25 * Math.sin(t * 3 + gh.x + gh.y);
          ctx.globalAlpha = gh.listo ? 0.35 + pulso * 0.3 : 0.28; ctx.setLineDash([4, 3]); ctx.lineWidth = 2; ctx.strokeStyle = gh.listo ? "#34d399" : "#f87171";
          ctx.strokeRect(sx - 14, sy - 29, 28, 28); ctx.setLineDash([]);
          ctx.fillStyle = "#000"; ctx.font = "20px " + FUENTE_EMOJI; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText(emojiDePieza(gh.item), sx, sy - 8);
          ctx.globalAlpha = 1;
          if (gh.cerca) { ctx.font = "bold 9px system-ui, sans-serif"; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.75)"; const txt = Object.entries(gh.costo).map(([k, n]) => `${n}${EMOJI_RECURSO[k]}`).join(" "); ctx.strokeText(txt, sx, sy - 33); ctx.fillStyle = gh.listo ? "#bbf7d0" : "#fecaca"; ctx.fillText(txt, sx, sy - 33); }
        } });
      }
    },
    efectos(ctx, t, camX, camY, LW, LH) {
      if (estadoObra() !== "terminada") return;
      ctx.font = "16px " + FUENTE_EMOJI; ctx.textAlign = "center";
      for (let i = 0; i < 14; i++) { const x = ((i * 97 + t * 14) % (LW + 40)) - 20, y = ((i * 53 + t * 30 + i * 11) % (LH + 20)); ctx.globalAlpha = 0.85; ctx.fillText(["✨", "🎉", "⭐", "🎊"][i % 4], x, y); }
      ctx.globalAlpha = 1;
    },
  };
}

// ---------- el controlador: estado, panel y acciones ----------
export function montarObra(env) {
  const { op, q, cv, estado, inv, TILE, rng, lienzo, FUENTE_EMOJI, html, toast, snd, exterior, chocaEn, espera, cam, vivo } = env;
  const cfg = op.obra;
  const S = { obra: cfg.estado && cfg.estado.hay ? cfg.estado : null, min: false, tab: "obra", msg: null, reto: null, ocupado: false, enPlaza: false, timer: null, faseVista: null };
  const piezas = new Map();               // "x,y" → { item, x, y, obs }
  const el = q(".m-obra");

  const plano = () => (S.obra && S.obra.plano) || null;
  const faseActual = () => { const p = plano(); return p && S.obra.estado === "construccion" ? p.fases[S.obra.fase] || null : null; };
  const puede = (costo) => Object.entries(costo || {}).every(([k, n]) => ((S.obra.almacen || {})[k] || 0) >= n);
  const ghosts = () => {
    const f = faseActual(); if (!f || !plaza.visible) return [];
    const costos = plano().costos || {}, yo = estado, lista = [];
    for (const pz of f.piezas) {
      if (piezas.has(`${pz.x},${pz.y}`)) continue;
      const costo = costos[pz.item] || PIEZAS_OBRA[pz.item]?.costo || {};
      lista.push({ x: pz.x, y: pz.y, item: pz.item, costo, listo: puede(costo), cerca: Math.hypot(pz.x * TILE + 16 - yo.x, pz.y * TILE + 20 - yo.y) < 90 });
    }
    return lista;
  };

  const obstaculoDe = (p) => ({ x: p.x * TILE + 4, y: p.y * TILE + 14, w: 24, h: 14 });
  const plaza = crearPlazaObra({ lienzo, rng, TILE, FUENTE_EMOJI, estadoObra: () => (S.obra ? S.obra.estado : null), piezas, ghosts });
  plaza.visible = false;
  function ponerPieza(p) { const k = `${p.x},${p.y}`; if (piezas.has(k)) return false; const pz = { item: p.item, x: p.x, y: p.y }; pz.obs = obstaculoDe(pz); piezas.set(k, pz); plaza.obstaculos.push(pz.obs); return true; }
  function sacarTodas() { piezas.clear(); plaza.obstaculos.length = 0; }
  function sincronizarPiezas() {
    if (!S.obra || !S.obra.piezas) return;
    const nuevas = S.obra.piezas;
    if (nuevas.length < piezas.size) sacarTodas();
    let agregadas = 0; for (const p of nuevas) if (ponerPieza(p)) agregadas++;
    if (agregadas && estado.escena === plaza) desatascar();
  }
  // si una pieza nueva cae justo donde estás parado, te movemos a la casilla libre más cercana
  function desatascar() {
    if (!chocaEn(plaza, estado.x, estado.y)) return;
    for (const r of [TILE, TILE * 2, TILE * 3]) for (const [dx, dy] of [[0, r], [0, -r], [r, 0], [-r, 0], [r, r], [-r, r], [r, -r], [-r, -r]]) {
      if (!chocaEn(plaza, estado.x + dx, estado.y + dy)) { estado.x += dx; estado.y += dy; return; }
    }
  }

  // ---- cartel en la aldea ----
  const textoCartel = () => (!S.obra ? "La Gran Obra" : S.obra.estado === "votacion" ? "¡Vota la obra!" : S.obra.estado === "construccion" ? `Obra: ${S.obra.plano ? S.obra.plano.nombre : S.obra.titulo}` : S.obra.estado === "terminada" ? "Obra terminada 🏆" : "La Gran Obra");
  const cand = [[110, 50], [-110, 50], [0, 80], [200, 0], [-200, 0], [150, 80], [-150, 80], [250, 40], [-250, 40]];
  const sp = exterior.spawn;
  const libre = (x, y) => !chocaEn(exterior, x, y) && exterior.npcs.every((n) => Math.hypot(n.x - x, n.y - y) >= 60) && exterior.edificios.every((e) => Math.hypot(e.puerta.x - x, e.puerta.y - y) >= 70);
  const [cdx, cdy] = cand.find(([a, b]) => libre(sp.x + a, sp.y + b)) || cand[0];
  const cartel = { tipo: "obra_puerta", nombre: textoCartel(), emoji: "🏗️", x: sp.x + cdx, y: sp.y + cdy, dir: "south", radio: 46, solido: true };
  exterior.npcs.push(cartel);
  plaza.salidas[0].accion = () => { snd.puerta(); salir(); };
  let salir = () => {};

  // ---- sincronización con el servidor ----
  async function refrescar(silencioso) {
    if (!vivo()) return;
    try {
      const e = await cfg.alRefrescar();
      if (!vivo()) return;
      const antes = S.obra;
      S.obra = e && e.hay ? e : null;
      cartel.nombre = textoCartel();
      if (antes && S.obra && (antes.fase !== S.obra.fase || (antes.estado !== S.obra.estado && S.obra.estado === "construccion")) && S.enPlaza && antes.estado === "construccion" && S.obra.fase > antes.fase) { toast(`🎉 ¡Fase completada! Ahora: ${plano() && plano().fases[S.obra.fase] ? plano().fases[S.obra.fase].nombre : "siguiente fase"}`, 4200); snd.fanfarria && snd.fanfarria(); S.reto = null; }
      if (antes && S.obra && antes.estado !== "terminada" && S.obra.estado === "terminada" && S.enPlaza) { toast("🏆 ¡Terminaron la obra entre todos!", 6000); snd.fanfarria && snd.fanfarria(); }
      sincronizarPiezas();
      if (S.enPlaza && !(silencioso && S.ocupado)) render();
    } catch { /* sin conexión: se intenta de nuevo en el siguiente ciclo */ }
  }
  cfg.alCambioRemoto = () => { if (S.enPlaza) refrescar(true); };

  // ---- panel ----
  const msg = (t, mal) => { S.msg = { t, mal: !!mal }; render(); };
  const rolTxt = (r) => (r === "constructor" ? "🔨 Constructor" : r === "recolector" ? "🎒 Recolector" : "sin rol");
  function render() {
    if (!S.enPlaza) return;
    const o = S.obra;
    el.classList.remove("oculto");
    if (!o) { el.innerHTML = `<div class="ob-cab"><b>🏗️ La Gran Obra</b></div><p class="ob-txt">Tu curso todavía no tiene una obra. Cuando tu docente la prepare, aparecerá aquí.</p>`; return; }
    const cab = `<div class="ob-cab"><b>${plano() ? html(plano().emoji) : "🏗️"} ${html(o.titulo)}</b><span>${ESTADO_TXT[o.estado] || ""}</span><button data-a="min" aria-label="Plegar">${S.min ? "▴" : "▾"}</button></div>`;
    if (S.min) { el.innerHTML = cab; el.onclick = manejar; return; }
    let cuerpo = "";
    if (o.estado === "preparacion") cuerpo = `<p class="ob-txt">Tu docente está preparando la obra del curso. Pronto podrán votar qué construir 🗳️.</p>`;
    else if (o.estado === "votacion") cuerpo = htmlVotacion(o);
    else if (o.estado === "construccion") cuerpo = htmlConstruccion(o);
    else cuerpo = htmlTerminada(o);
    el.innerHTML = cab + cuerpo + (S.msg ? `<div class="ob-msg ${S.msg.mal ? "mal" : ""}">${html(S.msg.t)}</div>` : "");
    el.onclick = manejar;
  }
  function htmlVotacion(o) {
    const total = Object.values(o.votos || {}).reduce((a, b) => a + Number(b), 0);
    return `<p class="ob-txt">¡Entre todos elegimos qué construir! Cada voto cuenta (puedes cambiar el tuyo mientras la votación esté abierta). Votaron <b>${total}</b> de ${o.participantes}.</p>` +
      o.opciones.map((x) => `<div class="ob-op ${o.mi_voto === x.id ? "mi" : ""}"><span class="e">${html(x.emoji)}</span><div style="flex:1"><b>${html(x.nombre)}</b><small>${html(x.desc || "")}</small><small>${x.fases} fases · ${x.piezas} piezas · ${(o.votos || {})[x.id] || 0} voto${((o.votos || {})[x.id] || 0) === 1 ? "" : "s"}</small></div><button class="ob-btn ${o.mi_voto === x.id ? "g" : ""}" data-voto="${html(x.id)}">${o.mi_voto === x.id ? "✔ Tu voto" : "Votar"}</button></div>`).join("");
  }
  function htmlConstruccion(o) {
    const f = faseActual(), total = f ? f.piezas.length : 0, puestas = f ? f.piezas.filter((p) => piezas.has(`${p.x},${p.y}`)).length : 0, meta = f ? f.reto_meta : 0;
    const tabs = [["obra", "🏗️ Obra"], ["aportar", "🎒 Aportar"], ["reto", "❓ Reto"], ["equipo", "👥 Equipo"]];
    let c = `<div class="ob-tabs">${tabs.map(([k, t]) => `<button class="${S.tab === k ? "sel" : ""}" data-tab="${k}">${t}</button>`).join("")}</div>`;
    if (S.tab === "obra") {
      c += `<div class="ob-txt"><b>Fase ${o.fase + 1} de ${plano().fases.length}: ${html(f ? f.nombre : "")}</b></div>
        <div class="ob-txt">Piezas colocadas: ${puestas}/${total}</div><div class="ob-barra"><i style="width:${total ? (puestas / total) * 100 : 0}%"></i></div>
        <div class="ob-txt">Reto del equipo: ${Math.min(o.reto_correctos, meta)}/${meta} aciertos</div><div class="ob-barra"><i style="width:${meta ? (Math.min(o.reto_correctos, meta) / meta) * 100 : 100}%"></i></div>
        <div class="ob-txt"><b>📦 Almacén común</b> (lo llenan los aportes de todos)</div>
        <div class="ob-chips">${RECURSOS_OBRA.map((k) => `<span class="ob-chip">${EMOJI_RECURSO[k]} ${(o.almacen || {})[k] || 0}</span>`).join("")}</div>
        <div class="ob-txt">Tu rol: <b>${rolTxt(o.mi_rol)}</b></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="ob-btn ${o.mi_rol === "recolector" ? "g" : "s"}" data-rol="recolector">🎒 Recolector</button>
          <button class="ob-btn ${o.mi_rol === "constructor" ? "g" : "s"}" data-rol="constructor">🔨 Constructor</button></div>
        <p class="ob-txt">${o.mi_rol === "constructor" ? "Camina hasta las casillas punteadas y <b>tócalas</b> para colocar la pieza. Verde = alcanza el almacén; rojo = faltan recursos." : "Los <b>recolectores</b> juntan recursos y los aportan; los <b>constructores</b> colocan las piezas. ¡Se necesitan entre sí! Puedes cambiar de rol una vez al día."}</p>`;
    } else if (S.tab === "aportar") {
      const quedan = Math.max(0, o.tope_dia - o.mi_hoy);
      c += `<div class="ob-txt">Aporta recursos de tu 🎒 mochila al almacén. Hoy has aportado <b>${o.mi_hoy}/${o.tope_dia}</b>.</div>` +
        RECURSOS_OBRA.map((k) => { const tengo = inv[k] || 0, todo = Math.min(tengo, quedan, 20); return `<div class="ob-fila"><span>${EMOJI_RECURSO[k]}</span><span class="n">${NOMBRE_RECURSO[k]} <small style="color:var(--suave)">(tienes ${tengo})</small></span>
          <button class="ob-btn s" data-ap="${k}:1" ${tengo < 1 || quedan < 1 ? "disabled" : ""}>+1</button><button class="ob-btn s" data-ap="${k}:5" ${tengo < 5 || quedan < 5 ? "disabled" : ""}>+5</button><button class="ob-btn" data-ap="${k}:${todo}" ${todo < 1 ? "disabled" : ""}>Todo</button></div>`; }).join("") +
        `<p class="ob-txt">¿Sin recursos? Recógelos en el Bosque 🪵, la Montaña 🪨 y el Lago 🐟.</p>`;
    } else if (S.tab === "reto") {
      const r = S.reto;
      c += `<div class="ob-txt">Para terminar cada fase, el equipo debe acertar <b>${meta}</b> preguntas entre todos (${Math.min(o.reto_correctos, meta)} hasta ahora). Hoy has respondido ${o.mis_retos_hoy}/${o.reto_tope_dia}.</div>`;
      if (!r) c += `<button class="ob-btn" data-a="reto">❓ Responder una pregunta</button>`;
      else if (r.resultado) c += `<div class="ob-preg">${html(r.texto)}</div>${r.opciones.map((x, i) => `<div class="ob-opc ${i === r.resultado.correcta_idx ? "ok" : i === r.elegida ? "mal" : ""}">${html(x)}</div>`).join("")}<div class="ob-msg ${r.resultado.correcta ? "" : "mal"}">${r.resultado.correcta ? "¡Correcto! Sumas un acierto al equipo 🎉" : "No era esa. ¡Sigue intentando!"}</div><button class="ob-btn" data-a="reto" style="margin-top:6px">Otra pregunta</button>`;
      else c += `<div class="ob-preg">${html(r.texto)}</div>${r.opciones.map((x, i) => `<button class="ob-opc" data-resp="${i}">${html(x)}</button>`).join("")}`;
    } else {
      c += `<div class="ob-txt"><b>🏅 Quienes más aportan</b> · ${o.participantes} estudiantes en el curso</div>` +
        ((o.ranking || []).length ? o.ranking.map((r, i) => `<div class="ob-fila"><span>${["🥇", "🥈", "🥉"][i] || i + 1 + "."}</span><span class="n">${html(r.nombre)}</span><small style="color:var(--suave)">🎒 ${r.recursos} · 🔨 ${r.piezas} · ❓ ${r.retos}</small></div>`).join("") : `<p class="ob-txt">Todavía nadie ha aportado. ¡Sé el primero!</p>`);
    }
    return c;
  }
  function htmlTerminada(o) {
    return `<div style="text-align:center;padding:6px 0"><div style="font-size:44px">🏆</div><b>¡Entre todos terminaron ${plano() ? html(plano().nombre) : "la obra"}!</b><p class="ob-txt">Cada pieza de esta plaza la puso alguien de tu curso. ¡Felicitaciones!</p></div>` +
      ((o.ranking || []).length ? `<div class="ob-txt"><b>🏅 Quienes más aportaron</b></div>` + o.ranking.map((r, i) => `<div class="ob-fila"><span>${["🥇", "🥈", "🥉"][i] || i + 1 + "."}</span><span class="n">${html(r.nombre)}</span><small style="color:var(--suave)">🎒 ${r.recursos} · 🔨 ${r.piezas} · ❓ ${r.retos}</small></div>`).join("") : "");
  }

  async function manejar(e) {
    const b = e.target.closest("button"); if (!b || S.ocupado) return;
    const o = S.obra; if (!o) return;
    const hacer = async (fn) => { S.ocupado = true; try { await fn(); } catch (err) { msg((err && err.message) || "Algo salió mal. Intenta de nuevo.", true); } finally { S.ocupado = false; } };
    if (b.dataset.a === "min") { S.min = !S.min; render(); return; }
    if (b.dataset.tab) { S.tab = b.dataset.tab; S.msg = null; render(); return; }
    if (b.dataset.voto) return hacer(async () => { await cfg.alVotar(b.dataset.voto); snd.bien(); await refrescar(); cfg.avisar(); msg("¡Voto registrado! 🗳️"); });
    if (b.dataset.rol) return hacer(async () => { await cfg.alRol(b.dataset.rol); snd.bien(); await refrescar(); msg(`Ahora eres ${rolTxt(b.dataset.rol)}.`); });
    if (b.dataset.ap) return hacer(async () => {
      const [item, cant] = b.dataset.ap.split(":"); const r = await cfg.alAportar(item, Number(cant));
      if (!r.ok) { msg(MOTIVOS[r.motivo] || "No se pudo aportar.", true); return; }
      if (r.resto > 0) inv[item] = r.resto; else delete inv[item];
      o.almacen = r.almacen; o.mi_hoy = r.mi_hoy; snd.bien(); cfg.avisar(); msg(`+${cant} ${EMOJI_RECURSO[item]} al almacén. ¡Gracias!`); refrescar(true);
    });
    if (b.dataset.a === "reto") return hacer(async () => {
      const r = await cfg.alRetoPregunta();
      if (!r.ok) { S.reto = null; msg(MOTIVOS[r.motivo] || "No hay pregunta ahora.", true); return; }
      S.reto = { id: r.id, texto: r.texto, opciones: r.opciones }; S.msg = null; render();
    });
    if (b.dataset.resp !== undefined && S.reto) return hacer(async () => {
      const i = Number(b.dataset.resp), r = await cfg.alRetoResponder(S.reto.id, i);
      S.reto = { ...S.reto, elegida: i, resultado: r }; r.correcta ? snd.bien() : snd.mal(); cfg.avisar(); S.msg = null; await refrescar(); render();
    });
  }

  // ---- tocar una casilla punteada para construir ----
  async function tocarCelda(tx, ty) {
    if (!S.enPlaza || !S.obra || S.obra.estado !== "construccion" || S.ocupado || estado.dialogo || estado.cambiando) return;
    const gh = ghosts().find((x) => x.x === tx && x.y === ty); if (!gh) return;
    if (S.obra.mi_rol !== "constructor") { S.min = false; S.tab = "obra"; msg(MOTIVOS.no_constructor, true); toast(MOTIVOS.no_constructor, 3200); return; }
    const o = obstaculoDe(gh), bx = estado.x - 6, by = estado.y - 8;
    if (bx < o.x + o.w + 1 && bx + 12 > o.x - 1 && by < o.y + o.h + 1 && by + 8 > o.y - 1) { toast("Estás parado ahí: muévete un poco.", 2200); return; }
    S.ocupado = true;
    try {
      const r = await cfg.alColocar(gh.x, gh.y, gh.item);
      if (!vivo()) return;
      if (r.ok) { ponerPieza(gh); S.obra.almacen = r.almacen; snd.golpe(); toast(`${emojiDePieza(gh.item)} ¡${nombreDePieza(gh.item)} colocada!`, 1600); cfg.avisar(); }
      else { const m = MOTIVOS[r.motivo] || "No se pudo colocar."; toast(m, 3200); if (r.motivo === "ocupada" || r.motivo === "fuera_del_plano") await refrescar(true); }
    } catch (err) { toast((err && err.message) || "No se pudo colocar.", 3200); }
    finally { S.ocupado = false; await refrescar(true); render(); }
  }
  const alClic = (e) => {
    if (!S.enPlaza) return;
    const rc = cv.getBoundingClientRect(); if (!rc.width || !rc.height) return;
    const c = cam();
    tocarCelda(Math.floor(((e.clientX - rc.left) * (c.LW / rc.width) + c.camX) / TILE), Math.floor(((e.clientY - rc.top) * (c.LH / rc.height) + c.camY) / TILE));
  };
  cv.addEventListener("click", alClic);

  // ---- entrar y salir de la plaza ----
  salir = () => env.cambiarEscena(exterior, cartel.x, cartel.y + 36);
  function entrar() {
    snd.puerta(); S.min = false; S.tab = "obra"; S.msg = null; S.reto = null;
    env.cambiarEscena(plaza, plaza.spawn.x, plaza.spawn.y);
  }
  function alCambiarEscena(esc) {
    const dentro = esc === plaza;
    if (dentro === S.enPlaza) return;
    S.enPlaza = dentro; plaza.visible = dentro;
    clearInterval(S.timer); S.timer = null;
    if (dentro) {
      const angosta = cv.getBoundingClientRect().width < 700;
      S.min = !!(angosta && S.obra && S.obra.estado === "construccion" && S.obra.mi_rol === "constructor"); // en el celular, el constructor necesita ver el suelo
      sincronizarPiezas(); render(); refrescar(); S.timer = setInterval(() => refrescar(true), 6000);
      if (S.min) toast("Toca ▴ arriba para abrir el panel de la obra", 3200);
    }
    else { el.classList.add("oculto"); el.innerHTML = ""; }
  }
  function destruir() { clearInterval(S.timer); cv.removeEventListener("click", alClic); }

  sincronizarPiezas();
  return { plaza, cartel, entrar, alCambiarEscena, destruir, refrescar, estado: () => S.obra };
}
