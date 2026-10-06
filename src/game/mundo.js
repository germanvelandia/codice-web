// =====================================================================================
//  MUNDO CÓDICE — motor del juego
//  Un mundo en 2D visto desde arriba: el estudiante camina con su personaje, entra a los
//  edificios, habla con otros personajes y completa misiones. Se dibuja en un <canvas>
//  y no usa librerías externas.
//
//  Uso:  const mundo = await iniciarMundo(contenedor, opciones);   …   mundo.destruir();
// =====================================================================================

import { ZONAS, RETADORES, estadoZonas, misionesDisponibles, zonaDeMision } from "./zonas";
import { armarPool, crearDuelo, esperaRestanteMin, barajar } from "./duelo";
import { montarJuego } from "./juegosUI";
import { TIPOS_ACERTIJO } from "./acertijos";
import { resumenReinos, reinosAtacables, puedeBatallar, nombreCortoProvincia, estaProtegida } from "./comarca";
import { brilloPorDistancia, rumoresPendientes } from "./secretos";
import { ITEMS, RECETAS, RECURSOS_POR_ZONA, MAX_POR_ITEM, PARCELA, celdaValida, esDecoracion, puedeFabricar, faltantes, cantidadPorRecoleccion, esHerramienta } from "./items";

const TILE = 32;
const DIRS8 = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];
const FUENTE_EMOJI = "system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

const rng = (seed) => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
function lienzo(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.imageSmoothingEnabled = false; return [c, g]; }
const direccionDe = (vx, vy) => DIRS8[(Math.round(Math.atan2(vy, vx) / (Math.PI / 4)) + 8) % 8];

// ---------- estilos (todo va dentro de ".mundo" para no chocar con el resto de la app) ----------
const CSS = `
.mundo { position: relative; width: 100%; height: 100%; overflow: hidden; background: #2d5a27; color: #1e293b; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none;
  --panel: #ffffff; --texto: #1e293b; --suave: #64748b; --borde: #e2e8f0; --fondo: #f4f6fb; --acento: #7c3aed; --ok: #059669; --ok-s: #d1fae5; --mal: #e11d48; --mal-s: #ffe4e6; --hud: rgba(23,38,77,.88); }
@media (prefers-color-scheme: dark) { .mundo { --panel: #172140; --texto: #e8edf8; --suave: #9fb0d0; --borde: #2a3a66; --fondo: #0e1526; --acento: #8b5cf6; --ok: #34d399; --ok-s: #0f3a2e; --mal: #fb7185; --mal-s: #4a1a26; --hud: rgba(8,14,32,.9); } }
.mundo * { box-sizing: border-box; }
.mundo button { font-family: inherit; cursor: pointer; }
.mundo .oculto { display: none !important; }
.mundo .m-canvas { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; touch-action: none; display: block; outline: none; }
.mundo .m-hud { position: absolute; top: 8px; left: 8px; right: 8px; display: flex; gap: 6px; align-items: flex-start; justify-content: space-between; pointer-events: none; flex-wrap: wrap; }
.mundo .m-chip { background: var(--hud); color: #fff; border-radius: 999px; padding: 5px 11px; font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
.mundo .m-izq { display: flex; align-items: center; gap: 8px; }
.mundo .m-der { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.mundo .m-foto { width: 30px; height: 30px; image-rendering: pixelated; object-fit: contain; background: rgba(255,255,255,.12); border-radius: 50%; }
.mundo .m-nv { background: #fbbf24; color: #3b2a00; border-radius: 999px; padding: 1px 7px; font-size: 11px; font-weight: 800; }
.mundo .m-boton { pointer-events: auto; background: var(--hud); color: #fff; border: 0; border-radius: 999px; padding: 6px 12px; font-size: 12px; font-weight: 700; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
.mundo .m-mini { position: absolute; right: 8px; top: 92px; border-radius: 10px; border: 2px solid rgba(255,255,255,.7); box-shadow: 0 2px 8px rgba(0,0,0,.3); width: 120px; height: auto; image-rendering: pixelated; pointer-events: none; }
.mundo .m-lugar { position: absolute; left: 50%; top: 96px; transform: translateX(-50%); background: var(--hud); color: #fff; border-radius: 12px; padding: 8px 18px; font-size: 15px; font-weight: 800; pointer-events: none; opacity: 0; transition: opacity .4s; white-space: nowrap; box-shadow: 0 4px 14px rgba(0,0,0,.35); }
.mundo .m-lugar.ver { opacity: 1; }
.mundo .m-aviso { position: absolute; left: 50%; bottom: 150px; transform: translateX(-50%); background: var(--hud); color: #fff; border-radius: 999px; padding: 8px 16px; font-size: 14px; font-weight: 700; pointer-events: none; white-space: nowrap; box-shadow: 0 2px 10px rgba(0,0,0,.3); }
.mundo .m-toast { position: absolute; left: 50%; bottom: 210px; transform: translateX(-50%); background: var(--panel); color: var(--texto); border: 1px solid var(--borde); border-radius: 12px; padding: 9px 14px; font-size: 13px; box-shadow: 0 6px 18px rgba(0,0,0,.3); max-width: 90%; text-align: center; }
.mundo .m-joy { position: absolute; left: 18px; bottom: 22px; width: 124px; height: 124px; border-radius: 50%; background: rgba(255,255,255,.22); border: 2px solid rgba(255,255,255,.55); touch-action: none; display: flex; align-items: center; justify-content: center; }
.mundo .m-knob { width: 54px; height: 54px; border-radius: 50%; background: rgba(255,255,255,.85); box-shadow: 0 2px 8px rgba(0,0,0,.35); pointer-events: none; }
.mundo .m-accion { position: absolute; right: 22px; bottom: 36px; width: 84px; height: 84px; border-radius: 50%; border: 3px solid rgba(255,255,255,.7); background: rgba(124,58,237,.75); color: #fff; font-size: 30px; touch-action: none; box-shadow: 0 3px 12px rgba(0,0,0,.35); }
.mundo .m-accion.listo { background: #f59e0b; animation: m-pulso 1s ease-in-out infinite; }
@keyframes m-pulso { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
@media (prefers-reduced-motion: reduce) { .mundo .m-accion.listo { animation: none; } }
.mundo .m-dialogo { position: absolute; left: 0; right: 0; bottom: 0; display: flex; justify-content: center; padding: 10px 10px 12px; background: linear-gradient(transparent, rgba(0,0,0,.35)); }
.mundo .m-tarjeta { width: 100%; max-width: 560px; background: var(--panel); color: var(--texto); border: 1px solid var(--borde); border-radius: 18px; padding: 14px 16px 16px; box-shadow: 0 10px 30px rgba(0,0,0,.4); max-height: 78%; overflow-y: auto; }
.mundo .m-cab { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.mundo .m-avatar { width: 44px; height: 44px; image-rendering: pixelated; object-fit: contain; flex-shrink: 0; }
.mundo .m-emo { font-size: 32px; line-height: 1; flex-shrink: 0; }
.mundo .m-quien { font-weight: 800; font-size: 15px; }
.mundo .m-titulo { font-size: 12px; color: var(--acento); font-weight: 700; }
.mundo .m-cerrar { margin-left: auto; background: none; border: 0; color: var(--suave); font-size: 20px; }
.mundo .m-texto { font-size: 14px; line-height: 1.5; margin: 6px 0 10px; }
.mundo .m-opcion { display: block; width: 100%; text-align: left; padding: 10px 12px; margin-bottom: 7px; border-radius: 12px; border: 2px solid var(--borde); background: var(--fondo); color: var(--texto); font-size: 14px; }
.mundo .m-opcion:hover:not(:disabled) { border-color: var(--acento); }
.mundo .m-opcion.mal { border-color: var(--mal); background: var(--mal-s); }
.mundo .m-opcion.bien { border-color: var(--ok); background: var(--ok-s); }
.mundo .m-retro { font-size: 13px; padding: 9px 11px; border-radius: 10px; margin-top: 4px; line-height: 1.45; }
.mundo .m-retro.bien { background: var(--ok-s); color: var(--ok); }
.mundo .m-retro.mal { background: var(--mal-s); color: var(--mal); }
.mundo .m-premio { font-weight: 800; margin-top: 6px; font-size: 14px; }
.mundo .m-ok { margin-top: 10px; width: 100%; padding: 11px; border-radius: 12px; border: 0; background: var(--acento); color: #fff; font-weight: 700; font-size: 14px; }
.mundo .m-mapa { position: absolute; inset: 0; background: rgba(8,14,32,.8); display: flex; align-items: center; justify-content: center; padding: 14px; overflow-y: auto; }
.mundo .m-zona { border: 2px solid var(--borde); border-radius: 14px; padding: 10px 12px; margin-bottom: 8px; background: var(--fondo); }
.mundo .m-zona.aqui { border-color: var(--acento); }
.mundo .m-zona .m-z-nombre { font-weight: 800; font-size: 14px; }
.mundo .m-zona .m-z-estado { font-size: 12px; margin-top: 2px; }
.mundo .m-duelo { position: absolute; inset: 0; z-index: 30; background: radial-gradient(ellipse at 50% 15%, #3b2a66 0%, #14102a 72%); color: #fff; display: flex; align-items: flex-start; justify-content: center; padding: 10px; overflow-y: auto; }
.mundo .m-d-caja { width: min(640px, 100%); margin: auto; display: flex; flex-direction: column; gap: 10px; padding: 4px 0 18px; }
.mundo .m-d-arena { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 6px; background: rgba(255,255,255,.06); border: 2px solid rgba(255,255,255,.18); border-radius: 18px; padding: 10px; }
.mundo .m-d-luchador { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; min-width: 0; }
.mundo .m-d-luchador img { width: 76px; height: 76px; image-rendering: pixelated; object-fit: contain; }
.mundo .m-d-nombre { font-weight: 800; font-size: 13px; } .mundo .m-d-sub { font-size: 11px; opacity: .8; } .mundo .m-d-vs { font-size: 26px; }
.mundo .m-d-seg { display: flex; gap: 3px; flex-wrap: wrap; justify-content: center; }
.mundo .m-d-seg i { width: 18px; height: 9px; border-radius: 3px; background: #ef4444; box-shadow: 0 0 6px rgba(239,68,68,.6); }
.mundo .m-d-seg i.vacio { background: rgba(255,255,255,.18); box-shadow: none; }
.mundo .m-d-cor { font-size: 18px; letter-spacing: 2px; }
.mundo .m-d-preg { background: #fff; color: #1e1b2e; border-radius: 16px; padding: 14px; font-size: 15px; font-weight: 700; line-height: 1.4; }
.mundo .m-d-num { font-size: 11px; color: #7c3aed; font-weight: 800; margin-bottom: 4px; }
.mundo .m-d-ops { display: flex; flex-direction: column; gap: 8px; }
.mundo .m-d-op { text-align: left; border: 2px solid rgba(255,255,255,.25); background: rgba(255,255,255,.09); color: #fff; border-radius: 14px; padding: 12px 14px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; }
.mundo .m-d-op:hover:not(:disabled) { background: rgba(255,255,255,.2); }
.mundo .m-d-op.bien { background: #16a34a; border-color: #86efac; } .mundo .m-d-op.mal { background: #dc2626; border-color: #fca5a5; }
.mundo .m-d-fb { min-height: 20px; font-size: 13px; font-weight: 700; padding: 0 4px; }
.mundo .m-d-pie { display: flex; gap: 8px; justify-content: space-between; }
.mundo .m-d-btn { border: 0; border-radius: 99px; padding: 10px 18px; font-weight: 800; font-size: 13px; cursor: pointer; font-family: inherit; background: var(--acento); color: #fff; }
.mundo .m-d-btn.sec { background: rgba(255,255,255,.14); }
@keyframes m-sacudir { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-7px); } 75% { transform: translateX(7px); } }
.mundo .m-d-luchador.golpeado img { animation: m-sacudir .35s; }
.mundo .m-d-fin { text-align: center; background: rgba(255,255,255,.08); border-radius: 20px; padding: 22px 16px; display: flex; flex-direction: column; gap: 10px; align-items: center; }
.mundo .m-d-fin .grande { font-size: 60px; line-height: 1; } .mundo .m-d-fin h3 { margin: 0; font-size: 20px; } .mundo .m-d-fin p { margin: 0; font-size: 14px; line-height: 1.45; }
.mundo .m-vida.baja { color: #fca5a5; }
.mundo .m-d-tiempo { height: 8px; border-radius: 99px; background: rgba(255,255,255,.15); overflow: hidden; }
.mundo .m-d-tiempo i { display: block; height: 100%; width: 100%; background: linear-gradient(90deg, #f59e0b, #ef4444); }
@keyframes m-flash { 0% { opacity: .8; } 100% { opacity: 0; } }
.mundo.danio::after { content: ""; position: absolute; inset: 0; background: rgba(220,38,38,.55); pointer-events: none; z-index: 40; animation: m-flash .7s ease-out forwards; }
.mundo .m-viaje { margin-top: 8px; border: 0; border-radius: 99px; padding: 7px 14px; font-weight: 800; font-size: 12px; background: var(--acento); color: #fff; cursor: pointer; font-family: inherit; }
.mundo .m-barra { height: 9px; border-radius: 99px; background: var(--borde); overflow: hidden; margin: 6px 0 2px; }
.mundo .m-barra > i { display: block; height: 100%; background: var(--acento); }
.mundo .m-mochila { position: absolute; inset: 0; z-index: 25; background: rgba(8,14,32,.8); display: flex; align-items: center; justify-content: center; padding: 14px; overflow-y: auto; }
.mundo .m-juego { position: absolute; inset: 0; z-index: 26; background: rgba(8,14,32,.85); display: flex; align-items: center; justify-content: center; padding: 10px; overflow-y: auto; }
.mundo .m-juego .m-tarjeta { width: min(520px, 100%); max-height: 100%; overflow-y: auto; }
.mundo .jg-ayuda { font-size: 12px; color: var(--suave); margin: 4px 0 8px; line-height: 1.35; }
.mundo .jg-pista { font-size: 12px; background: var(--fondo); border: 1px dashed var(--borde); border-radius: 10px; padding: 6px 9px; margin-bottom: 6px; }
.mundo .jg-sopa { display: grid; gap: 2px; max-width: 420px; margin: 0 auto; }
.mundo .jg-s { aspect-ratio: 1; padding: 0; border: 1px solid var(--borde); background: var(--fondo); color: var(--texto); font-weight: 800; font-size: clamp(11px, 3.2vw, 16px); border-radius: 6px; }
.mundo .jg-s.sel { background: var(--acento); color: #fff; } .mundo .jg-s.ok { background: var(--ok-s); border-color: var(--ok); color: var(--ok); }
.mundo .jg-palabras { display: flex; flex-wrap: wrap; gap: 5px; margin: 8px 0; }
.mundo .jg-p { font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 99px; border: 1px solid var(--borde); } .mundo .jg-p.hecha { text-decoration: line-through; background: var(--ok-s); color: var(--ok); border-color: var(--ok); }
.mundo .jg-msg { font-size: 13px; font-weight: 700; text-align: center; margin: 8px 0; }
.mundo .jg-otra { display: block; margin: 6px auto 0; border: 0; border-radius: 99px; padding: 6px 12px; font-size: 12px; font-weight: 700; background: var(--borde); color: var(--texto); }
.mundo .jg-cripto { display: flex; flex-wrap: wrap; gap: 10px 14px; justify-content: center; margin: 8px 0; }
.mundo .jg-pal { display: inline-flex; gap: 3px; align-items: flex-end; }
.mundo .jg-c { width: 26px; border: 2px solid var(--borde); background: var(--fondo); color: var(--texto); border-radius: 7px; padding: 2px 0; display: flex; flex-direction: column; align-items: center; line-height: 1.1; }
.mundo .jg-c .l { font-weight: 800; font-size: 16px; min-height: 19px; } .mundo .jg-c .n { font-size: 10px; color: var(--suave); }
.mundo .jg-c.sel { border-color: var(--acento); box-shadow: 0 0 0 2px var(--acento); } .mundo .jg-c.mal { border-color: var(--mal); background: var(--mal-s); } .mundo .jg-c.dada { background: rgba(245,158,11,.25); border-color: #f59e0b; }
.mundo .jg-sig { font-weight: 800; font-size: 18px; align-self: center; }
.mundo .jg-teclado { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; margin-top: 8px; }
.mundo .jg-k { width: 32px; height: 36px; border-radius: 8px; border: 2px solid var(--borde); background: var(--fondo); color: var(--texto); font-weight: 800; font-size: 14px; padding: 0; } .mundo .jg-k:disabled { opacity: .3; }
.mundo .jg-vidas { text-align: center; font-size: 20px; letter-spacing: 2px; }
.mundo .jg-frase { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; margin: 10px 0; font-size: 20px; font-weight: 800; } .mundo .jg-frase b { min-width: 20px; text-align: center; border-bottom: 3px solid var(--acento); } .mundo .jg-frase .esp { width: 14px; } .mundo .jg-frase.perdio b { color: var(--mal); }
.mundo .jg-rompe { display: grid; gap: 3px; width: min(300px, 100%); aspect-ratio: 1; margin: 8px auto; }
.mundo .jg-f { border: 0; border-radius: 8px; background: var(--acento); color: #fff; font-weight: 800; font-size: 24px; padding: 0; } .mundo .jg-f.hueco { background: var(--fondo); border: 2px dashed var(--borde); } .mundo .jg-f.img { background-color: var(--fondo); }
.mundo .jg-ref { width: 70px; height: 70px; background-size: cover; background-position: center; border-radius: 8px; border: 2px solid var(--borde); margin: 0 auto 4px; }
.mundo .m-comarca { position: absolute; inset: 0; z-index: 26; background: rgba(8,14,32,.85); display: flex; align-items: center; justify-content: center; padding: 10px; overflow-y: auto; }
.mundo .m-comarca .m-tarjeta { width: min(560px, 100%); max-height: 100%; overflow-y: auto; }
.mundo .cm-reino { border: 2px solid var(--borde); border-radius: 12px; padding: 8px 10px; margin-bottom: 8px; background: var(--fondo); } .mundo .cm-reino.mio { border-color: var(--acento); }
.mundo .cm-cab { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 14px; } .mundo .cm-cab small { margin-left: auto; font-weight: 600; color: var(--suave); font-size: 11px; text-align: right; }
.mundo .cm-provs { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.mundo .cm-prov { font-size: 11px; padding: 2px 8px; border-radius: 99px; border: 1px solid var(--borde); } .mundo .cm-prov.prot { border-color: #f59e0b; }
.mundo .cm-nota { font-size: 12px; color: var(--suave); line-height: 1.4; margin: 6px 0; }
.mundo .m-tabs { display: flex; gap: 6px; margin: 4px 0 10px; }
.mundo .m-tab { flex: 1; padding: 8px; border-radius: 10px; border: 2px solid var(--borde); background: var(--fondo); color: var(--texto); font-weight: 700; font-size: 13px; }
.mundo .m-tab.act { border-color: var(--acento); color: var(--acento); }
.mundo .m-inv { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }
.mundo .m-slot { border: 2px solid var(--borde); border-radius: 12px; background: var(--fondo); padding: 8px 6px; text-align: center; font-size: 12px; display: flex; flex-direction: column; gap: 2px; align-items: center; }
.mundo .m-slot .e { font-size: 26px; line-height: 1.1; } .mundo .m-slot b { font-size: 13px; } .mundo .m-slot small { color: var(--suave); font-size: 11px; line-height: 1.25; }
.mundo .m-chico { margin-top: 4px; border: 0; border-radius: 99px; padding: 5px 10px; font-weight: 800; font-size: 11px; background: var(--acento); color: #fff; }
.mundo .m-chico:disabled { opacity: .4; cursor: default; }
.mundo .m-receta { border: 2px solid var(--borde); border-radius: 12px; background: var(--fondo); padding: 8px 10px; margin-bottom: 7px; display: flex; align-items: center; gap: 10px; }
.mundo .m-receta .e { font-size: 28px; } .mundo .m-receta .t { flex: 1; min-width: 0; font-size: 12px; line-height: 1.4; } .mundo .m-receta .t b { font-size: 14px; }
.mundo .m-ing { display: inline-block; margin-right: 8px; white-space: nowrap; } .mundo .m-ing.falta { color: var(--mal); font-weight: 700; }
.mundo .m-msg { font-size: 13px; padding: 8px 11px; border-radius: 10px; margin-bottom: 8px; background: var(--ok-s); color: var(--ok); font-weight: 700; } .mundo .m-msg.mal { background: var(--mal-s); color: var(--mal); }
.mundo .m-construir { position: absolute; left: 50%; transform: translateX(-50%); bottom: 156px; z-index: 20; width: min(520px, calc(100% - 16px)); background: var(--panel); color: var(--texto); border: 1px solid var(--borde); border-radius: 16px; padding: 10px 12px; box-shadow: 0 6px 20px rgba(0,0,0,.4); }
@media (min-width: 700px) { .mundo .m-construir { bottom: 14px; } }
.mundo .m-construir .m-c-tit { font-weight: 800; font-size: 14px; display: flex; align-items: center; gap: 8px; } .mundo .m-construir .m-c-tit span { margin-left: auto; font-size: 11px; color: var(--suave); font-weight: 600; }
.mundo .m-construir .m-c-ayuda { font-size: 12px; color: var(--suave); margin: 4px 0 8px; line-height: 1.35; }
.mundo .m-c-lista { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.mundo .m-c-item { border: 2px solid var(--borde); background: var(--fondo); color: var(--texto); border-radius: 12px; padding: 5px 10px; font-size: 13px; font-weight: 700; } .mundo .m-c-item.sel { border-color: var(--acento); background: var(--panel); box-shadow: 0 0 0 2px var(--acento); }
.mundo .m-c-msg { font-size: 12px; font-weight: 700; min-height: 16px; color: var(--ok); margin-bottom: 6px; } .mundo .m-c-msg.mal { color: var(--mal); }
.mundo .m-fundido { position: absolute; inset: 0; background: #000; opacity: 0; pointer-events: none; transition: opacity .18s; }
.mundo .m-fundido.ver { opacity: 1; pointer-events: auto; }
.mundo .m-fin { position: absolute; inset: 0; background: rgba(8,14,32,.78); display: flex; align-items: center; justify-content: center; padding: 20px; }
.mundo .m-fin .m-tarjeta { text-align: center; max-width: 380px; padding: 26px 22px; }
.mundo .m-fin .m-grande { font-size: 56px; }
.mundo .m-fin h2 { margin: 6px 0 4px; font-size: 22px; }
.mundo .m-fin p { color: var(--suave); font-size: 14px; line-height: 1.5; margin: 6px 0 14px; }
.mundo .m-fin button { padding: 11px 20px; border-radius: 12px; border: 0; background: var(--acento); color: #fff; font-weight: 700; font-size: 14px; }
@media (max-width: 520px) {
  .mundo .m-chip { font-size: 12px; padding: 4px 9px; gap: 4px; }
  .mundo .m-boton { font-size: 11px; padding: 5px 10px; }
  .mundo .m-hud, .mundo .m-der { gap: 4px; }
  .mundo .m-foto { width: 26px; height: 26px; }
  .mundo .m-lugar { left: 8px; transform: none; max-width: calc(100% - 118px); white-space: normal; font-size: 13px; padding: 6px 12px; }
}`;
function asegurarCss() {
  if (document.getElementById("mundo-css")) return;
  const el = document.createElement("style"); el.id = "mundo-css"; el.textContent = CSS; document.head.appendChild(el);
}

const PLANTILLA = `
<div class="mundo">
  <canvas class="m-canvas" tabindex="0"></canvas>
  <div class="m-hud">
    <div class="m-izq"><span class="m-chip"><img class="m-foto" alt=""><span class="m-nombre">Estudiante</span><span class="m-nv oculto"></span></span></div>
    <div class="m-der">
      <span class="m-chip">✨ <span class="h-xp">0</span> XP</span>
      <span class="m-chip">🪙 <span class="h-oro">0</span></span>
      <span class="m-chip m-vida oculto">❤️ <span class="h-vida">100</span></span>
      <span class="m-chip">🎯 <span class="h-mis">0/0</span></span>
      <span class="m-chip">⭐ <span class="h-est">0/6</span></span>
      <button class="m-boton b-construir oculto" aria-label="Construir">🔨 Construir</button>
      <button class="m-boton b-mochila oculto" aria-label="Mochila">🎒 Mochila</button>
      <button class="m-boton b-mapa" aria-label="Mapa del mundo">🗺️ Mapa</button>
      <button class="m-boton b-sonido" aria-label="Sonido">🔊</button>
      <button class="m-boton b-salir">↩ Salir</button>
    </div>
  </div>
  <canvas class="m-mini" width="168" height="120"></canvas>
  <div class="m-lugar"></div>
  <div class="m-aviso oculto"></div>
  <div class="m-toast oculto"></div>
  <div class="m-joy oculto"><div class="m-knob"></div></div>
  <button class="m-accion oculto" aria-label="Interactuar">💬</button>
  <div class="m-dialogo oculto"></div>
  <div class="m-mapa oculto"></div>
  <div class="m-mochila oculto"></div>
  <div class="m-juego oculto"></div>
  <div class="m-comarca oculto"></div>
  <div class="m-construir oculto"></div>
  <div class="m-duelo oculto"></div>
  <div class="m-fundido"></div>
  <div class="m-fin oculto"><div class="m-tarjeta"><div class="m-grande">🏆</div><h2>¡Completaste todas las misiones!</h2><p class="m-fin-texto"></p><button class="b-seguir">Seguir explorando</button></div></div>
</div>`;

// =====================================================================================
//  SONIDO — todo se genera por código (no hay archivos de audio)
// =====================================================================================
function crearSonido() {
  const mudoTotal = { activo: false, mudo: true, reanudar() {}, alternar() { return true; }, musica() {}, paso() {}, estrella() {}, bien() {}, mal() {}, hablar() {}, puerta() {}, golpe() {}, derrota() {}, fanfarria() {}, destruir() {} };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return mudoTotal;
  let ctx; try { ctx = new AC(); } catch (e) { return mudoTotal; }
  const master = ctx.createGain(), musica = ctx.createGain(), fx = ctx.createGain();
  musica.gain.value = 0.16; fx.gain.value = 0.55; musica.connect(master); fx.connect(master); master.connect(ctx.destination);
  let mudo = false; try { mudo = localStorage.getItem("mundo_mudo") === "1"; } catch (e) { /* sin almacenamiento */ }
  master.gain.value = mudo ? 0 : 0.9;
  const ruidoBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.3), ctx.sampleRate);
  { const d = ruidoBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const ahora = () => ctx.currentTime;
  const tono = (dest, tipo, f, t0, dur, vol, f2) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = tipo; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
  };
  const ruido = (dest, t0, dur, vol, frec, tipo) => {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = ruidoBuf; f.type = tipo || "bandpass"; f.frequency.value = frec;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(f); f.connect(g); g.connect(dest); s.start(t0); s.stop(t0 + dur + 0.02);
  };
  // música: acordes lentos (La menor, Fa, Do, Sol) con un arpegio suave encima
  const ACORDES = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const ACORDES_BOSQUE = [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]]; // Re menor, Si bemol, Fa, Do: más suave y misteriosa
  const ACORDES_DUELO = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]]; // La menor, Fa, Sol, Mi: tensa y enérgica
  const ACORDES_MONTANA = [[52, 55, 59], [48, 52, 55], [45, 48, 52], [47, 51, 54]]; // Mi menor, Do, La menor, Si: amplia y solemne
  const ACORDES_LAGO = [[48, 52, 55], [53, 57, 60], [45, 48, 52], [50, 53, 57]];    // Do, Fa, La menor, Re menor: calma y reflexión
  const TEMAS = { exterior: { dur: 0.36, ac: ACORDES }, bosque: { dur: 0.44, ac: ACORDES_BOSQUE }, montana: { dur: 0.55, ac: ACORDES_MONTANA }, lago: { dur: 0.6, ac: ACORDES_LAGO }, duelo: { dur: 0.26, ac: ACORDES_DUELO } };
  const ARP = [0, 1, 2, 1, 2, 1, 2, 1];
  let tema = "exterior", n = 0, prox = 0, reloj = null;
  function pasoMusica(i, t) {
    const T = TEMAS[tema] || { dur: 0.5, ac: ACORDES }, dur = T.dur, ac = T.ac[Math.floor(i / 8) % 4];
    if (i % 8 === 0) for (const m of ac) tono(musica, "triangle", hz(m - 12), t, dur * 8.2, 0.35);
    if (tema === "exterior") tono(musica, "sine", hz(ac[ARP[i % 8]] + 12), t, dur * 1.4, 0.5);
    else if (tema === "bosque") { if (i % 4 === 0) tono(musica, "sine", hz(ac[ARP[i % 8]] + 12), t, dur * 3, 0.4); }
    else if (tema === "duelo") tono(musica, "square", hz(ac[ARP[i % 8]] + 12), t, dur * 0.8, 0.1);                                  // un pulso constante, como en una batalla
    else if (tema === "montana") { if (i % 6 === 0) tono(musica, "triangle", hz(ac[ARP[i % 8]]), t, dur * 4, 0.3); }          // notas largas y graves
    else if (tema === "lago") { if (i % 8 === 4) tono(musica, "sine", hz(ac[ARP[i % 8]] + 12), t, dur * 5, 0.32); }          // una nota cristalina de vez en cuando
    else if (i % 2 === 0) tono(musica, "sine", hz(ac[ARP[i % 8]] + 12), t, dur * 2.2, 0.35);
    return dur;
  }
  function programar() {
    if (mudo || ctx.state !== "running") return;
    const limite = ahora() + 0.8; if (prox < ahora()) prox = ahora() + 0.05;
    while (prox < limite) prox += pasoMusica(n++, prox);
  }
  const S = {
    activo: true,
    get mudo() { return mudo; },
    reanudar() { if (ctx.state === "suspended") ctx.resume().catch(() => {}); },
    alternar() {
      mudo = !mudo; try { localStorage.setItem("mundo_mudo", mudo ? "1" : "0"); } catch (e) { /* sin almacenamiento */ }
      master.gain.setTargetAtTime(mudo ? 0 : 0.9, ahora(), 0.05); if (!mudo) S.reanudar();
      return mudo;
    },
    musica(t) { tema = t; if (!reloj) reloj = setInterval(programar, 250); programar(); },
    paso(piso) {
      if (mudo) return;
      const c = { pasto: [700, 0.1], tierra: [1100, 0.11], piedra: [2200, 0.13], madera: [1400, 0.15], nieve: [520, 0.09] }[piso] || [900, 0.1];
      ruido(fx, ahora(), 0.05, c[1], c[0]);
    },
    estrella() { if (mudo) return; const t = ahora(); tono(fx, "sine", 880, t, 0.14, 0.5); tono(fx, "sine", 1320, t + 0.09, 0.22, 0.5); },
    bien() { if (mudo) return; const t = ahora(); [72, 76, 79, 84].forEach((m, i) => tono(fx, "triangle", hz(m), t + i * 0.09, 0.3, 0.5)); },
    mal() { if (mudo) return; tono(fx, "sawtooth", 170, ahora(), 0.22, 0.35, 110); },
    golpe() { if (mudo) return; const t = ahora(); ruido(fx, t, 0.12, 0.5, 900, "lowpass"); tono(fx, "square", 220, t, 0.12, 0.3, 120); },
    derrota() { if (mudo) return; const t = ahora(); [64, 60, 57, 52].forEach((m, i) => tono(fx, "sawtooth", hz(m), t + i * 0.16, 0.3, 0.3)); },
    fanfarria() { if (mudo) return; const t = ahora(); [72, 76, 79, 84, 79, 84, 88].forEach((m, i) => tono(fx, "triangle", hz(m), t + i * 0.11, i === 6 ? 0.7 : 0.25, 0.55)); },
    hablar() { if (mudo) return; const t = ahora(); tono(fx, "square", 520, t, 0.06, 0.18); tono(fx, "square", 660, t + 0.06, 0.07, 0.18); },
    puerta() { if (mudo) return; const t = ahora(); ruido(fx, t, 0.35, 0.5, 500, "lowpass"); tono(fx, "sine", 90, t, 0.3, 0.6, 60); },
    destruir() { clearInterval(reloj); reloj = null; try { ctx.close(); } catch (e) { /* ya cerrado */ } },
  };
  return S;
}

// =====================================================================================
//  EL MUNDO: la aldea por fuera
// =====================================================================================
const MW = 56, MH = 40, PW = MW * TILE, PH = MH * TILE;
const T = { PASTO: 0, CAMINO: 1, AGUA: 2, ARENA: 3, PLAZA: 4 };

// Cada edificio tiene su interior (cols × filas en casillas) y un tema de decoración.
const EDIFICIOS_DEF = [
  { id: "biblioteca", nombre: "Biblioteca", x: 8, y: 5, w: 7, h: 5, pared: "#c9a46a", techo: "#8b3a3a", icono: "📚", interior: { cols: 16, filas: 11, tema: "biblioteca" } },
  { id: "agora", nombre: "Ágora de la Ética", x: 38, y: 26, w: 8, h: 5, pared: "#d8d3c4", techo: "#3b5b92", icono: "⚖️", interior: { cols: 16, filas: 11, tema: "agora" } },
  { id: "templo", nombre: "Templo de la Gratitud", x: 8, y: 27, w: 7, h: 5, pared: "#efe6d2", techo: "#7b4fa3", icono: "🕊️", interior: { cols: 14, filas: 11, tema: "templo" } },
  { id: "mercado", nombre: "Mercado del Códice", x: 24, y: 4, w: 8, h: 4, pared: "#e0b36a", techo: "#c0562b", icono: "🛒", interior: { cols: 16, filas: 11, tema: "mercado" } },
  { id: "acertijos", nombre: "Casa de los Acertijos", x: 31, y: 29, w: 7, h: 5, pared: "#e6dcc0", techo: "#d9822b", icono: "🧩", interior: { cols: 16, filas: 11, tema: "acertijos" } },
  { id: "comarca", nombre: "Sala de la Comarca", x: 19, y: 29, w: 7, h: 5, pared: "#cfd6e6", techo: "#8c2f48", icono: "🏰", interior: { cols: 16, filas: 11, tema: "comarca" } },
  { id: "posada", nombre: "Posada del Descanso", x: 13, y: 16, w: 7, h: 5, pared: "#e8d5b5", techo: "#2f7d6b", icono: "🛏️", interior: { cols: 16, filas: 11, tema: "posada" } },
];

// Los dibujos de árboles y rocas los comparten la aldea y el bosque (se arman una sola vez).
let _graficos = null;
function graficosBase() {
  if (_graficos) return _graficos;
  const crearArbol = (v) => {
    const [c, g] = lienzo(44, 54);
    g.fillStyle = "#6b4423"; g.fillRect(18, 36, 8, 16); g.fillStyle = "#8a5a2f"; g.fillRect(18, 36, 3, 16);
    g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.ellipse(22, 52, 14, 4, 0, 0, 7); g.fill();
    const circ = (x, y, rr, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); };
    if (v === 0) { circ(22, 24, 15, "#2f7d32"); circ(14, 29, 10, "#388e3c"); circ(31, 29, 10, "#388e3c"); circ(22, 17, 11, "#43a047"); circ(17, 15, 4, "#66bb6a"); circ(27, 21, 3, "#66bb6a"); }
    else { const tri = (cy, a, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(22, cy - 17); g.lineTo(22 + a, cy + 8); g.lineTo(22 - a, cy + 8); g.fill(); }; tri(38, 15, "#1f6b3a"); tri(28, 13, "#2a8247"); tri(18, 10, "#37a05a"); }
    return c;
  };
  const arbolImg = [crearArbol(0), crearArbol(1)];
  const rocaImg = (() => { const [c, g] = lienzo(26, 18); g.fillStyle = "rgba(0,0,0,.2)"; g.beginPath(); g.ellipse(13, 15, 11, 3, 0, 0, 7); g.fill(); g.fillStyle = "#8d8d99"; g.beginPath(); g.ellipse(13, 10, 11, 7, 0, 0, 7); g.fill(); g.fillStyle = "#a9a9b6"; g.beginPath(); g.ellipse(10, 8, 6, 4, 0, 0, 7); g.fill(); return c; })();
  _graficos = { arbolImg, rocaImg };
  return _graficos;
}

// ---------- la arena donde espera el Guardián de cada zona ----------
function dibujarArena(g, cx, cy, color) {
  const x = cx * TILE + 16, y = cy * TILE + 16;
  g.save();
  g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.ellipse(x, y + 6, 78, 52, 0, 0, 7); g.fill();
  g.fillStyle = "#8f8fa0"; g.beginPath(); g.ellipse(x, y, 74, 48, 0, 0, 7); g.fill();
  g.fillStyle = "#b3b3c4"; g.beginPath(); g.ellipse(x, y - 2, 68, 43, 0, 0, 7); g.fill();
  g.strokeStyle = color; g.lineWidth = 4; g.beginPath(); g.ellipse(x, y - 2, 58, 35, 0, 0, 7); g.stroke();
  g.strokeStyle = "rgba(0,0,0,.18)"; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y - 2, 44, 26, 0, 0, 7); g.stroke();
  for (let a = 0; a < 6.283; a += 0.785) { g.fillStyle = color; g.fillRect(x + Math.cos(a) * 58 - 2, y - 2 + Math.sin(a) * 35 - 2, 5, 5); }
  [-1, 1].forEach((lado) => { // dos estandartes a los costados
    const bx = x + lado * 82; g.fillStyle = "#5a3a22"; g.fillRect(bx - 2, y - 40, 4, 48);
    g.fillStyle = color; g.beginPath(); g.moveTo(bx + (lado > 0 ? -2 : 2), y - 38); g.lineTo(bx + lado * 22, y - 38); g.lineTo(bx + lado * 22, y - 16); g.lineTo(bx + lado * 10, y - 22); g.lineTo(bx + (lado > 0 ? -2 : 2), y - 16); g.closePath(); g.fill();
    g.fillStyle = "rgba(255,255,255,.55)"; g.fillRect(bx + lado * 8 - 2, y - 33, 4, 8);
  });
  g.restore();
}

// ---------- portones entre zonas (siempre sobre el borde este del mapa) ----------
const _imgsPorton = {};
function imagenesPorton(etiqueta, emoji) {
  const clave = etiqueta + "|" + emoji; if (_imgsPorton[clave]) return _imgsPorton[clave];
  const W = 2 * TILE, H = 4 * TILE;
  const pintar = (abierto) => {
    const [c, g] = lienzo(W + 12, H + 44), ox = 6, oy = 44;
    const tronco = (x, y) => { g.fillStyle = "rgba(0,0,0,.22)"; g.beginPath(); g.ellipse(x + 2, y + 10, 11, 5, 0, 0, 7); g.fill(); g.fillStyle = "#6b4423"; g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill(); g.fillStyle = "#8a5a2f"; g.beginPath(); g.arc(x - 2, y - 2, 6, 0, 7); g.fill(); g.strokeStyle = "#4a2f17"; g.lineWidth = 1; g.beginPath(); g.arc(x - 2, y - 2, 3, 0, 7); g.stroke(); };
    for (let y = oy + 8; y < oy + H; y += 14) { if (abierto && y > oy + 26 && y < oy + H - 28) continue; tronco(ox + 34, y); } // la empalizada
    if (!abierto) { // las hojas del portón, cerradas
      g.fillStyle = "#8a5a2f"; g.fillRect(ox + 8, oy + 34, 52, 60); g.fillStyle = "#a8763e"; g.fillRect(ox + 8, oy + 34, 52, 6);
      g.strokeStyle = "#3d2614"; g.lineWidth = 2; g.strokeRect(ox + 8.5, oy + 34.5, 51, 59); g.beginPath(); g.moveTo(ox + 8, oy + 64); g.lineTo(ox + 60, oy + 64); g.moveTo(ox + 34, oy + 34); g.lineTo(ox + 34, oy + 94); g.stroke();
      g.fillStyle = "#c9a227"; g.fillRect(ox + 28, oy + 58, 12, 12); g.fillStyle = "#3d2614"; g.fillRect(ox + 32, oy + 62, 4, 6);
    } else { // abierto: las hojas quedan recogidas a los lados
      g.fillStyle = "#8a5a2f"; g.fillRect(ox + 10, oy + 28, 48, 6); g.fillRect(ox + 10, oy + 94, 48, 6); g.fillStyle = "#a8763e"; g.fillRect(ox + 10, oy + 28, 48, 2); g.fillRect(ox + 10, oy + 94, 48, 2);
    }
    g.fillStyle = "#5a3a22"; g.fillRect(ox + 2, oy - 36, 64, 26); g.strokeStyle = "#3d2614"; g.lineWidth = 2; g.strokeRect(ox + 2.5, oy - 35.5, 63, 25); // el cartel del camino
    g.fillStyle = "#e8d3a0"; g.fillRect(ox + 5, oy - 33, 58, 20);
    g.font = "13px " + FUENTE_EMOJI; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#000"; g.fillText(emoji, ox + 16, oy - 23);
    g.font = `bold ${etiqueta.length > 6 ? 8 : 9}px system-ui, sans-serif`; g.fillStyle = "#3d2614"; g.fillText(etiqueta, ox + 44, oy - 22);
    return c;
  };
  return (_imgsPorton[clave] = { cerrado: pintar(false), abierto: pintar(true) });
}
// Un portón en el borde este: 4 casillas de alto desde la fila "ty". Cerrado no se puede cruzar; abierto, al pisar la franja se viaja a la zona siguiente.
function crearPortonEste({ ty, zona, nombre, etiqueta, emoji, cols = MW }) {
  const x0 = (cols - 2) * TILE, y0 = ty * TILE;
  return {
    id: zona, zona, nombre, abierto: false, x: x0, y: y0, w: 2 * TILE, h: 4 * TILE, base: y0 + 4 * TILE, imgs: imagenesPorton(etiqueta, emoji),
    bloqueo: { x: x0 + 10, y: y0 + 8, w: 46, h: 4 * TILE - 16 },                       // mientras está cerrado, no se puede pasar
    disparador: { x: (cols - 1) * TILE + 8, y: y0 + 24, w: 32, h: 80 },                         // abierto: al pisar esta franja se viaja
    guardia: { x: (cols - 4) * TILE + 8, y: y0 + 6 },                                            // dónde está el guardia
    retorno: { x: (cols - 4) * TILE + 10, y: (ty + 2) * TILE + 8 },                              // dónde aparece quien vuelve de la zona siguiente
  };
}
const dibujarPorton = (ctx, p, camX, camY) => ctx.drawImage(p.abierto ? p.imgs.abierto : p.imgs.cerrado, p.x - 6 - camX, p.y - 44 - camY);

function crearExterior() {
  const rand = rng(20261005);
  const dentro = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
  const tipo = Array.from({ length: MH }, () => new Uint8Array(MW));
  const ocupado = Array.from({ length: MH }, () => new Uint8Array(MW)); // 1 = no poner árboles ni rocas
  const obstaculos = [], arboles = [], rocas = [];
  const edificios = EDIFICIOS_DEF.map((e) => ({ ...e }));

  const LAGO = { cx: 47, cy: 9, rx: 8, ry: 5 };
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const d = ((x + 0.5 - LAGO.cx) / LAGO.rx) ** 2 + ((y + 0.5 - LAGO.cy) / LAGO.ry) ** 2;
    if (d < 1) tipo[y][x] = T.AGUA; else if (d < 1.4) tipo[y][x] = T.ARENA;
    if (d < 1.9) ocupado[y][x] = 1;
  }
  const PLAZA = { cx: 28, cy: 20, r: 6 };
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const dd = Math.hypot(x + 0.5 - PLAZA.cx, y + 0.5 - PLAZA.cy);
    if (dd <= PLAZA.r && tipo[y][x] !== T.AGUA) tipo[y][x] = T.PLAZA;
    if (dd <= PLAZA.r + 2) ocupado[y][x] = 1;
  }
  function camino(x1, y1, x2, y2) {
    const pintar = (x, y) => {
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const a = x + dx, b = y + dy; if (!dentro(a, b)) continue;
        if (tipo[b][a] === T.PASTO) tipo[b][a] = T.CAMINO; ocupado[b][a] = 1;
      }
    };
    const sx = Math.sign(x2 - x1) || 1, sy = Math.sign(y2 - y1) || 1;
    for (let x = x1; x !== x2; x += sx) pintar(x, y1);
    for (let y = y1; y !== y2; y += sy) pintar(x2, y);
  }
  for (const e of edificios) {
    e.puertaX = e.x + Math.floor(e.w / 2); e.puertaY = e.y + e.h;
    e.puerta = { x: e.x * TILE + (e.w * TILE) / 2, y: (e.y + e.h) * TILE + 8 }; // donde está la puerta que se ve dibujada
    obstaculos.push({ x: e.x * TILE, y: e.y * TILE, w: e.w * TILE, h: e.h * TILE });
    for (let y = e.y - 2; y < e.y + e.h + 2; y++) for (let x = e.x - 2; x < e.x + e.w + 2; x++) if (dentro(x, y)) ocupado[y][x] = 1;
    camino(e.puertaX, e.puertaY, PLAZA.cx - 1, PLAZA.cy - 1);
  }
  // El camino hacia el Bosque: sale de la plaza hacia el este y termina en un portón de madera.
  camino(PLAZA.cx + 5, PLAZA.cy, 53, PLAZA.cy);
  const ARENA = { cx: 41, cy: 17, r: 2.4 };   // la arena de la Guardiana de la Aldea
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (Math.hypot(x + 0.5 - ARENA.cx, y + 0.5 - ARENA.cy) <= ARENA.r + 1.5) ocupado[y][x] = 1;
  const enPorton = (x, y) => x >= 52 && y >= 18 && y <= 23; // sin árboles alrededor del portón
  for (let y = 18; y <= 23; y++) for (let x = 52; x < MW; x++) ocupado[y][x] = 1;
  const spawn = { x: 28 * TILE + 16, y: 24 * TILE };
  const fuente = { x: PLAZA.cx * TILE, y: PLAZA.cy * TILE + 14 };
  obstaculos.push({ x: fuente.x - 26, y: fuente.y - 16, w: 52, h: 30 });

  const esLibre = (x, y) => dentro(x, y) && tipo[y][x] === T.PASTO && !ocupado[y][x];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const borde = Math.min(x, y, MW - 1 - x, MH - 1 - y);
    if (tipo[y][x] === T.AGUA || tipo[y][x] === T.ARENA || enPorton(x, y)) continue;
    if ((borde === 0 && rand() < 0.95) || (borde === 1 && rand() < 0.7) || (borde === 2 && esLibre(x, y) && rand() < 0.3)) {
      arboles.push({ x: x * TILE + 16 + (rand() * 8 - 4), y: y * TILE + 30 + (rand() * 4 - 2), v: rand() < 0.55 ? 0 : 1 });
    }
  }
  for (let y = 3; y < MH - 3; y++) for (let x = 3; x < MW - 3; x++) {
    if (!esLibre(x, y)) continue;
    if (Math.hypot(x * TILE - spawn.x, y * TILE - spawn.y) < 5 * TILE) continue;
    const r = rand();
    if (r < 0.07) arboles.push({ x: x * TILE + 16 + (rand() * 10 - 5), y: y * TILE + 30 + (rand() * 4 - 2), v: rand() < 0.55 ? 0 : 1 });
    else if (r < 0.085) rocas.push({ x: x * TILE + 16, y: y * TILE + 26 });
  }
  for (const t of arboles) obstaculos.push({ x: t.x - 5, y: t.y - 8, w: 10, h: 8 });
  for (const r of rocas) obstaculos.push({ x: r.x - 9, y: r.y - 8, w: 18, h: 8 });

  const esAgua = (px, py) => { const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE); return !dentro(tx, ty) || tipo[ty][tx] === T.AGUA; };

  // estrellas para recoger
  const estrellas = []; {
    const r = rng(99); let intentos = 0;
    while (estrellas.length < 6 && intentos++ < 5000) {
      const x = 3 + Math.floor(r() * (MW - 6)), y = 3 + Math.floor(r() * (MH - 6)), t = tipo[y][x];
      if (t === T.AGUA || t === T.PLAZA) continue;
      const px = x * TILE + 16, py = y * TILE + 16;
      if (Math.hypot(px - spawn.x, py - spawn.y) < 8 * TILE) continue;
      if (obstaculos.some((o) => px > o.x - 14 && px < o.x + o.w + 14 && py > o.y - 14 && py < o.y + o.h + 14)) continue;
      if (estrellas.some((s) => Math.hypot(s.x - px, s.y - py) < 9 * TILE)) continue;
      estrellas.push({ x: px, y: py, tomada: false });
    }
  }

  // ---------- dibujos pre-armados ----------
  const suelo = (() => {
    const [c, g] = lienzo(PW, PH), r = rng(77), pasto = ["#5aa845", "#5eae48", "#56a142"];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const t = tipo[y][x], px = x * TILE, py = y * TILE; let base, claro, oscuro;
      if (t === T.PASTO) { base = pasto[(x * 7 + y * 13) % 3]; claro = "#74c05c"; oscuro = "#478a37"; }
      else if (t === T.CAMINO) { base = "#d6b676"; claro = "#e6cc94"; oscuro = "#b9965a"; }
      else if (t === T.ARENA) { base = "#eadba0"; claro = "#f4e9bd"; oscuro = "#d1bf82"; }
      else if (t === T.PLAZA) { base = "#bcbcc8"; claro = "#cdcdd8"; oscuro = "#a1a1b0"; }
      else { base = "#3f86c9"; claro = "#69a6dc"; oscuro = "#2f6ba8"; }
      g.fillStyle = base; g.fillRect(px, py, TILE, TILE);
      for (let i = 0; i < 7; i++) { g.fillStyle = r() < 0.5 ? claro : oscuro; g.fillRect(px + Math.floor(r() * 30), py + Math.floor(r() * 30), 2, 2); }
      if (t === T.PLAZA) { g.strokeStyle = oscuro; g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1); }
      if (t === T.PASTO && !ocupado[y][x] && r() < 0.07) {
        const col = ["#ffffff", "#ffd54f", "#f48fb1", "#ce93d8"][Math.floor(r() * 4)];
        for (let k = 0; k < 2 + Math.floor(r() * 2); k++) { const fx = px + 4 + Math.floor(r() * 22), fy = py + 4 + Math.floor(r() * 22); g.fillStyle = col; g.fillRect(fx, fy, 3, 3); g.fillStyle = "#ffeb3b"; g.fillRect(fx + 1, fy + 1, 1, 1); }
      }
    }
    return c;
  })();
  const { arbolImg, rocaImg } = graficosBase();
  const crearEdificio = (e) => {
    const W = e.w * TILE, H = e.h * TILE, [c, g] = lienzo(W + 12, H + 4), mx = 6, techoH = Math.round(H * 0.46);
    g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(mx + 4, H - 2, W - 4, 6);
    g.fillStyle = e.pared; g.fillRect(mx + 6, techoH - 4, W - 12, H - techoH + 4);
    g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(mx + 6, H - 8, W - 12, 8);
    g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 2; g.strokeRect(mx + 7, techoH - 3, W - 14, H - techoH + 2);
    g.fillStyle = e.techo; g.beginPath(); g.moveTo(mx - 4, techoH); g.lineTo(mx + W + 4, techoH); g.lineTo(mx + W - 16, 4); g.lineTo(mx + 16, 4); g.closePath(); g.fill();
    g.strokeStyle = "rgba(0,0,0,.22)"; g.lineWidth = 1; for (let y = 12; y < techoH; y += 8) { g.beginPath(); g.moveTo(mx + 10, y); g.lineTo(mx + W - 10, y); g.stroke(); }
    g.fillStyle = "rgba(255,255,255,.18)"; g.beginPath(); g.moveTo(mx + 16, 4); g.lineTo(mx + 60, 4); g.lineTo(mx + 36, techoH); g.lineTo(mx - 4, techoH); g.closePath(); g.fill();
    g.font = "26px " + FUENTE_EMOJI; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff"; g.fillText(e.icono, mx + W / 2, techoH / 2 + 4);
    const dx = mx + W / 2 - 12; g.fillStyle = "#5a3a22"; g.fillRect(dx, H - 32, 24, 32); g.fillStyle = "#3d2614"; g.fillRect(dx + 2, H - 30, 20, 4); g.fillStyle = "#f2c94c"; g.fillRect(dx + 18, H - 16, 3, 3);
    const vent = (x) => { g.fillStyle = "#6a4a2c"; g.fillRect(x - 1, techoH + 10, 22, 22); g.fillStyle = "#a8d8f0"; g.fillRect(x + 1, techoH + 12, 18, 18); g.fillStyle = "rgba(255,255,255,.6)"; g.fillRect(x + 3, techoH + 14, 5, 8); };
    vent(mx + 24); vent(mx + W - 46);
    g.font = "bold 10px system-ui, sans-serif"; const ancho = Math.min(W - 28, g.measureText(e.nombre).width + 14);
    g.fillStyle = "#7a5230"; g.fillRect(mx + W / 2 - ancho / 2, techoH - 2, ancho, 13); g.strokeStyle = "#4a3018"; g.strokeRect(mx + W / 2 - ancho / 2 + 0.5, techoH - 1.5, ancho - 1, 12);
    g.fillStyle = "#fff4d6"; g.textBaseline = "middle"; g.fillText(e.nombre, mx + W / 2, techoH + 5);
    return c;
  };
  const edificioImg = edificios.map(crearEdificio);
  const aguaTiles = []; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (tipo[y][x] === T.AGUA) aguaTiles.push([x, y]);
  const [miniBase, mg] = lienzo(MW * 3, MH * 3);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const t = tipo[y][x]; mg.fillStyle = t === T.AGUA ? "#3f86c9" : t === T.CAMINO ? "#d6b676" : t === T.ARENA ? "#eadba0" : t === T.PLAZA ? "#bcbcc8" : "#5aa845"; mg.fillRect(x * 3, y * 3, 3, 3); }
  for (const t of arboles) { mg.fillStyle = "#2f7d32"; mg.fillRect(Math.floor(t.x / TILE) * 3, Math.floor(t.y / TILE) * 3, 3, 3); }
  for (const e of edificios) { mg.fillStyle = e.techo; mg.fillRect(e.x * 3, e.y * 3, e.w * 3, e.h * 3); }

  const porton = crearPortonEste({ ty: 19, zona: "bosque", nombre: "Camino al Bosque de la Curiosidad", etiqueta: "Bosque", emoji: "🌲" });

  const dibujarFuente = (ctx, camX, camY, t) => {
    const x = fuente.x - camX, y = fuente.y - camY;
    ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(x, y + 6, 30, 11, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#8f8fa0"; ctx.beginPath(); ctx.ellipse(x, y, 28, 12, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#a9a9ba"; ctx.beginPath(); ctx.ellipse(x, y - 3, 28, 11, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#5fb0e8"; ctx.beginPath(); ctx.ellipse(x, y - 3, 22, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#8f8fa0"; ctx.fillRect(x - 4, y - 24, 8, 20); ctx.fillStyle = "#a9a9ba"; ctx.fillRect(x - 4, y - 24, 3, 20);
    ctx.fillStyle = "rgba(255,255,255,.9)";
    for (let i = 0; i < 6; i++) { const f = (t * 1.4 + i / 6) % 1; ctx.fillRect(Math.round(x + (i - 2.5) * 4 * f), Math.round(y - 28 + 26 * f * f), 2, 2); }
  };

  dibujarArena(suelo.getContext("2d"), ARENA.cx, ARENA.cy, ZONAS[0].insignia.color);
  return {
    id: "exterior", nombre: "Aldea del Códice", icono: "🌍", exterior: true,
    ancho: PW, alto: PH, suelo, fondo: "#2d5a27", obstaculos, spawn, edificios, plaza: PLAZA, estrellas, mini: { base: miniBase, k: (MW * 3) / PW },
    npcs: [], puertas: edificios.map((e) => ({ tipo: "puerta", id: e.id, edificio: e, nombre: e.nombre, x: e.puerta.x, y: e.puerta.y, radio: 34 })), salidas: [], portones: [porton], zona: "aldea", guardian: { x: ARENA.cx * TILE + 16, y: ARENA.cy * TILE + 24 },
    bloqueado: esAgua,
    piso: (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); const t = dentro(tx, ty) ? tipo[ty][tx] : 0; return t === T.PLAZA ? "piedra" : t === T.CAMINO || t === T.ARENA ? "tierra" : "pasto"; },
    // puntos libres para colocar personajes (cerca de la plaza y los caminos)
    puntoLibre(r, chocaFn) { for (let i = 0; i < 400; i++) { const x = (8 + r() * 40) * TILE, y = (6 + r() * 28) * TILE; const t = tipo[Math.floor(y / TILE)][Math.floor(x / TILE)]; if ((t === T.PLAZA || t === T.CAMINO || t === T.PASTO) && !chocaFn(x, y) && Math.hypot(x - spawn.x, y - spawn.y) > 70) return { x, y }; } return { x: spawn.x + 60, y: spawn.y }; },
    objetos(lista, ctx, camX, camY, visible, t) {
      for (const a of arboles) if (visible(a.x, a.y)) lista.push({ y: a.y, d: () => ctx.drawImage(arbolImg[a.v], Math.round(a.x - 22 - camX), Math.round(a.y - 52 - camY)) });
      for (const r of rocas) if (visible(r.x, r.y)) lista.push({ y: r.y, d: () => ctx.drawImage(rocaImg, Math.round(r.x - 13 - camX), Math.round(r.y - 14 - camY)) });
      edificios.forEach((e, i) => { const by = (e.y + e.h) * TILE; if (visible(e.x * TILE + e.w * 16, by, 200)) lista.push({ y: by, d: () => ctx.drawImage(edificioImg[i], e.x * TILE - 6 - camX, e.y * TILE - camY) }); });
      lista.push({ y: fuente.y, d: () => dibujarFuente(ctx, camX, camY, t) });
      lista.push({ y: porton.base, d: () => dibujarPorton(ctx, porton, camX, camY) });
    },
    efectos(ctx, t, camX, camY, LW, LH) {
      ctx.fillStyle = "rgba(255,255,255,.35)";
      for (const [x, y] of aguaTiles) {
        const px = x * TILE - camX, py = y * TILE - camY; if (px < -TILE || py < -TILE || px > LW || py > LH) continue;
        const o = Math.sin(t * 1.6 + x * 0.9 + y * 0.6); ctx.fillRect(px + 6 + o * 3, py + 9, 10, 1); ctx.fillRect(px + 15 - o * 3, py + 22, 9, 1);
      }
    },
  };
}

// =====================================================================================
//  LAS ZONAS NATURALES (Bosque, Montaña, Lago…): se arman desde una descripción
//  Cada zona describe su terreno y dónde van sus lugares; el resto (árboles, rocas, estrellas,
//  dibujo, minimapa, portones, personajes) lo resuelve esta función igual para todas.
// =====================================================================================
const K = { PASTO: 0, CAMINO: 1, AGUA: 2, PIEDRA: 3, PUENTE: 4, NIEVE: 5, ARENA: 6, ACANTILADO: 7, ROCOSO: 8 };
const K_LIBRES = new Set([K.PASTO, K.ROCOSO, K.NIEVE, K.ARENA]);     // donde pueden crecer árboles o ponerse rocas
const K_CAMINABLES = new Set([K.PASTO, K.CAMINO, K.PIEDRA, K.PUENTE, K.NIEVE, K.ARENA, K.ROCOSO]);
const PALETA_BASE = {                                                  // [variantes del color base], claro, oscuro
  [K.PASTO]: [["#4c9a3f", "#4f9e42", "#478f3a"], "#62b052", "#37762f"], [K.CAMINO]: [["#9c7c4e"], "#b99b6b", "#7e633b"], [K.AGUA]: [["#3f86c9"], "#69a6dc", "#2f6ba8"],
  [K.PIEDRA]: [["#a4a4b2"], "#bcbcc8", "#8a8a98"], [K.PUENTE]: [["#9a6a35"], "#b8824a", "#6e4a24"], [K.NIEVE]: [["#eef3f8", "#e6edf5"], "#ffffff", "#cfd9e6"],
  [K.ARENA]: [["#eadba0"], "#f4e9bd", "#d1bf82"], [K.ACANTILADO]: [["#6f6a72"], "#8a858f", "#4f4a55"], [K.ROCOSO]: [["#8d8070", "#938676"], "#a99c8b", "#6f6457"],
};
const OFFSETS_BASE = [[74, 12], [-74, 22], [8, -60], [-34, 62], [62, 58]]; // dónde se ubican (en píxeles) las 5 posiciones alrededor del centro de un lugar

function crearZonaNatural(def) {
  const { arbolImg, rocaImg } = graficosBase();
  const rand = rng(def.seed);
  const COLS = def.cols || MW, FILAS = def.filas || MH, PWZ = COLS * TILE, PHZ = FILAS * TILE; // cada zona puede tener su propio tamaño
  const dentro = (x, y) => x >= 0 && y >= 0 && x < COLS && y < FILAS;
  const tipo = Array.from({ length: FILAS }, () => new Uint8Array(COLS));
  const ocupado = Array.from({ length: FILAS }, () => new Uint8Array(COLS)); // 1 = no poner árboles ni rocas
  const obstaculos = [], arboles = [], rocas = [];
  const circulo = (cx, cy, r, fn) => { for (let y = 0; y < FILAS; y++) for (let x = 0; x < COLS; x++) { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d <= r) fn(x, y, d); } };
  const reservar = (cx, cy, r) => circulo(cx, cy, r, (x, y) => (ocupado[y][x] = 1));
  const camino = (x1, y1, x2, y2) => {
    const pintar = (x, y) => { for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const a = x + dx, b = y + dy; if (!dentro(a, b)) continue; if (K_LIBRES.has(tipo[b][a])) tipo[b][a] = K.CAMINO; ocupado[b][a] = 1; } };
    const sx = Math.sign(x2 - x1) || 1, sy = Math.sign(y2 - y1) || 1;
    for (let x = x1; x !== x2; x += sx) pintar(x, y1);
    for (let y = y1; y !== y2; y += sy) pintar(x2, y);
  };
  const meta = def.terreno({ K, tipo, ocupado, dentro, rocas, circulo, reservar, camino, obstaculos, cols: COLS, filas: FILAS });
  const decorados = meta.decorados || [];
  if (def.arena) reservar(def.arena.cx, def.arena.cy, def.arena.r + 1.5);
  (meta.retadores || []).forEach((r) => reservar(r.cx, r.cy, 2.2));                       // sin árboles donde espera cada retador              // sin árboles alrededor de la arena del Guardián

  // entrada (borde oeste) y salida (portón en el borde este)
  const ey = def.entradaTy, sal = def.salida;
  const enEntrada = (x, y) => x <= 5 && y >= ey - 2 && y <= ey + 5;
  const enSalida = (x, y) => !!sal && x >= COLS - 4 && y >= sal.ty - 1 && y <= sal.ty + 4;
  for (let y = 0; y < FILAS; y++) for (let x = 0; x < COLS; x++) if (enEntrada(x, y) || enSalida(x, y)) ocupado[y][x] = 1;
  const spawn = { x: 4 * TILE, y: (ey + 1) * TILE + 26 };

  // el bosque: árboles y rocas
  const esLibre = (x, y) => dentro(x, y) && K_LIBRES.has(tipo[y][x]) && !ocupado[y][x];
  for (let y = 0; y < FILAS; y++) for (let x = 0; x < COLS; x++) {
    const borde = Math.min(x, y, COLS - 1 - x, FILAS - 1 - y);
    if (!K_LIBRES.has(tipo[y][x]) || enEntrada(x, y) || enSalida(x, y)) continue;
    if ((borde === 0 && rand() < 0.95) || (borde === 1 && rand() < 0.75) || (borde === 2 && esLibre(x, y) && rand() < 0.45)) arboles.push({ x: x * TILE + 16 + (rand() * 8 - 4), y: y * TILE + 30 + (rand() * 4 - 2), v: rand() < 0.5 ? 0 : 1 });
  }
  for (let y = 3; y < FILAS - 3; y++) for (let x = 3; x < COLS - 3; x++) {
    if (!esLibre(x, y)) continue;
    const r = rand();
    if (r < def.densidadArboles) arboles.push({ x: x * TILE + 16 + (rand() * 10 - 5), y: y * TILE + 30 + (rand() * 4 - 2), v: rand() < 0.5 ? 0 : 1 });
    else if (r < def.densidadArboles + def.densidadRocas) rocas.push({ x: x * TILE + 16, y: y * TILE + 26 });
  }
  for (const t of arboles) obstaculos.push({ x: t.x - 5, y: t.y - 8, w: 10, h: 8 });
  for (const r of rocas) obstaculos.push({ x: r.x - 9, y: r.y - 8, w: 18, h: 8 });
  const bloqueaTile = (t) => t === K.AGUA || t === K.ACANTILADO;
  const bloqueado = (px, py) => { const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE); return !dentro(tx, ty) || bloqueaTile(tipo[ty][tx]); };

  // dónde se ubican los personajes con misión de cada lugar
  const slotsPorLugar = {};
  for (const [lugar, sp] of Object.entries(meta.spots)) slotsPorLugar[lugar] = (sp.offsets || OFFSETS_BASE).map(([dx, dy]) => ({ x: sp.cx * TILE + 16 + dx, y: sp.cy * TILE + 16 + dy }));

  // estrellas para recoger
  const estrellas = []; { const r = rng(def.seed + 55); let n = 0; while (estrellas.length < (def.estrellas || 4) && n++ < 8000) { const x = 4 + Math.floor(r() * (COLS - 8)), y = 4 + Math.floor(r() * (FILAS - 8)), t = tipo[y][x]; if (!K_CAMINABLES.has(t) || t === K.PUENTE) continue; const px = x * TILE + 16, py = y * TILE + 16; if (Math.hypot(px - spawn.x, py - spawn.y) < 9 * TILE) continue; if (obstaculos.some((o) => px > o.x - 14 && px < o.x + o.w + 14 && py > o.y - 14 && py < o.y + o.h + 14)) continue; if (estrellas.some((s) => Math.hypot(s.x - px, s.y - py) < 10 * TILE)) continue; estrellas.push({ x: px, y: py, tomada: false }); } }

  // ---------- dibujos pre-armados ----------
  const paleta = { ...PALETA_BASE, ...(def.paleta || {}) };
  const suelo = (() => {
    const [cv, g] = lienzo(PWZ, PHZ), r = rng(def.seed + 31);
    for (let y = 0; y < FILAS; y++) for (let x = 0; x < COLS; x++) {
      const t = tipo[y][x], px = x * TILE, py = y * TILE, [variantes, claro, oscuro] = paleta[t];
      g.fillStyle = variantes[(x * 7 + y * 13) % variantes.length]; g.fillRect(px, py, TILE, TILE);
      for (let i = 0; i < 7; i++) { g.fillStyle = r() < 0.5 ? claro : oscuro; g.fillRect(px + Math.floor(r() * 30), py + Math.floor(r() * 30), 2, 2); }
      if (t === K.PUENTE) { g.fillStyle = oscuro; for (let k = 0; k < 4; k++) g.fillRect(px + k * 8, py, 1, TILE); g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(px, py + TILE - 2, TILE, 2); }
      if (t === K.ACANTILADO) { // la pared de roca: vetas horizontales y el borde de arriba más claro
        g.fillStyle = oscuro; for (let k = 0; k < 3; k++) g.fillRect(px, py + 8 + k * 9 + Math.floor(r() * 3), TILE, 2);
        if (!dentro(x, y - 1) || tipo[y - 1][x] !== K.ACANTILADO) { g.fillStyle = claro; g.fillRect(px, py, TILE, 4); }
        if (!dentro(x, y + 1) || tipo[y + 1][x] !== K.ACANTILADO) { g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(px, py + TILE - 5, TILE, 5); }
      }
      if (t === K.PASTO && def.flores) {
        const enZona = (def.flores.zonas || []).some((z) => Math.hypot(x + 0.5 - z.cx, y + 0.5 - z.cy) <= z.r);
        if (enZona ? r() < def.flores.probZona : !ocupado[y][x] && r() < def.flores.prob) {
          const col = ["#ffffff", "#ffd54f", "#f48fb1", "#ce93d8", "#90caf9"][Math.floor(r() * 5)];
          for (let k = 0; k < 2 + Math.floor(r() * 3); k++) { const fx = px + 4 + Math.floor(r() * 22), fy = py + 4 + Math.floor(r() * 22); g.fillStyle = col; g.fillRect(fx, fy, 3, 3); g.fillStyle = "#ffeb3b"; g.fillRect(fx + 1, fy + 1, 1, 1); }
        }
      }
    }
    if (meta.decor) meta.decor(g, r, tipo);
    return cv;
  })();
  const aguaTiles = []; for (let y = 0; y < FILAS; y++) for (let x = 0; x < COLS; x++) if (tipo[y][x] === K.AGUA) aguaTiles.push([x, y]);
  const [miniBase, mg] = lienzo(COLS * 3, FILAS * 3);
  for (let y = 0; y < FILAS; y++) for (let x = 0; x < COLS; x++) { mg.fillStyle = paleta[tipo[y][x]][0][0]; mg.fillRect(x * 3, y * 3, 3, 3); }
  for (const t of arboles) { mg.fillStyle = "#235f27"; mg.fillRect(Math.floor(t.x / TILE) * 3, Math.floor(t.y / TILE) * 3, 3, 3); }

  if (def.arena) dibujarArena(suelo.getContext("2d"), def.arena.cx, def.arena.cy, (ZONAS.find((z) => z.key === def.id) || ZONAS[0]).insignia.color);
  const portones = sal ? [crearPortonEste({ ty: sal.ty, zona: sal.zona, nombre: sal.nombre, etiqueta: sal.etiqueta, emoji: sal.emoji, cols: COLS })] : [];
  const pisoDe = { [K.PUENTE]: "madera", [K.PIEDRA]: "piedra", [K.CAMINO]: "tierra", [K.ARENA]: "tierra", [K.ROCOSO]: "tierra", [K.NIEVE]: "nieve" };
  return {
    id: def.id, zona: def.id, nombre: def.nombre, icono: def.icono, exterior: true, guardian: def.arena ? { x: def.arena.cx * TILE + 16, y: def.arena.cy * TILE + 24 } : null,
    ancho: PWZ, alto: PHZ, suelo, fondo: def.fondo, obstaculos, spawn, edificios: [], portones, estrellas, mini: { base: miniBase, k: (COLS * 3) / PWZ, cols: COLS },
    cols: COLS, filas: FILAS, vecinos: def.vecinos, retadores: (meta.retadores || []).map((r) => ({ x: r.cx * TILE + 16, y: r.cy * TILE + 24 })),
    npcs: [], puertas: [], salidas: [{ x: 0, y: ey * TILE, w: 40, h: 4 * TILE, volver: true }], slotsPorLugar,
    bloqueado,
    tipoEn: (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); return dentro(tx, ty) ? tipo[ty][tx] : -1; },
    aguaCerca: (x, y, r) => { const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dentro(cx + dx, cy + dy) && tipo[cy + dy][cx + dx] === K.AGUA) return true; return false; },
    piso: (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); return dentro(tx, ty) ? pisoDe[tipo[ty][tx]] || "pasto" : "pasto"; },
    puntoLibre(r, chocaFn) { for (let i = 0; i < 600; i++) { const x = (5 + r() * (COLS - 12)) * TILE, y = (5 + r() * (FILAS - 10)) * TILE; if (K_CAMINABLES.has(tipo[Math.floor(y / TILE)][Math.floor(x / TILE)]) && !chocaFn(x, y) && Math.hypot(x - spawn.x, y - spawn.y) > 80) return { x, y }; } return { x: spawn.x + 100, y: spawn.y }; },
    objetos(lista, ctx, camX, camY, visible) {
      for (const a of arboles) if (visible(a.x, a.y)) lista.push({ y: a.y, d: () => ctx.drawImage(arbolImg[a.v], Math.round(a.x - 22 - camX), Math.round(a.y - 52 - camY)) });
      for (const r of rocas) if (visible(r.x, r.y)) lista.push({ y: r.y, d: () => ctx.drawImage(rocaImg, Math.round(r.x - 13 - camX), Math.round(r.y - 14 - camY)) });
      for (const p of portones) lista.push({ y: p.base, d: () => dibujarPorton(ctx, p, camX, camY) });
      for (const d of decorados) if (visible(d.x, d.y)) lista.push({ y: d.y, d: () => d.dibujar(ctx, Math.round(d.x - camX), Math.round(d.y - camY)) }); // carpas, columnas, el gran roble…
    },
    efectos(ctx, t, camX, camY, LW, LH) {
      ctx.fillStyle = "rgba(255,255,255,.35)";
      for (const [x, y] of aguaTiles) { const px = x * TILE - camX, py = y * TILE - camY; if (px < -TILE || py < -TILE || px > LW || py > LH) continue; const o = Math.sin(t * 1.6 + x * 0.9 + y * 0.6); ctx.fillRect(px + 6 + o * 3, py + 9, 10, 1); ctx.fillRect(px + 15 - o * 3, py + 22, 9, 1); }
    },
  };
}

// ---- EL BOSQUE DE LA CURIOSIDAD: grande, con un arroyo que se cruza por dos puentes y 7 lugares repartidos por todo el mapa ----
// Para llegar a los rincones lejanos hay que recorrer senderos que se ramifican (y hay un circuito que vuelve al sendero principal).
const DEF_BOSQUE = {
  id: "bosque", nombre: "Bosque de la Curiosidad", icono: "🌲", seed: 777, fondo: "#17391c", cols: 84, filas: 60, entradaTy: 29, vecinos: 9, estrellas: 7,
  salida: { ty: 29, zona: "montana", nombre: "Camino a la Montaña del Esfuerzo", etiqueta: "Montaña", emoji: "🏔️" },
  densidadArboles: 0.17, densidadRocas: 0.015, arena: { cx: 75, cy: 22, r: 2.4 },
  paleta: { [K.PASTO]: [["#3f8a3c", "#438f40", "#3a8137"], "#58a64f", "#2f6e2e"] },
  flores: { prob: 0.05, probZona: 0.28, zonas: [{ cx: 24, cy: 30, r: 5 }, { cx: 10, cy: 50, r: 3 }] },
  terreno({ K, tipo, ocupado, dentro, rocas, circulo, reservar, camino, obstaculos, filas }) {
    const rio = (y) => 58 + Math.round(4 * Math.sin(y / 6));                                 // el arroyo baja de norte a sur con curvas
    for (let y = 0; y < filas; y++) { for (let dx = -1; dx <= 1; dx++) if (dentro(rio(y) + dx, y)) tipo[y][rio(y) + dx] = K.AGUA; for (let k = -3; k <= 3; k++) if (dentro(rio(y) + k, y)) ocupado[y][rio(y) + k] = 1; }
    for (const y of [30, 31, 52, 53]) for (let x = rio(y) - 2; x <= rio(y) + 2; x++) if (dentro(x, y)) tipo[y][x] = K.PUENTE; // dos puentes
    const CLARO = { cx: 24, cy: 30 }, ARROYO = { cx: 70, cy: 38 }, MIRADOR = { cx: 10, cy: 10, r: 3.6 }, CAMPA = { cx: 10, cy: 50 }, CASCADA = { cx: 68, cy: 11 }, ROBLE = { cx: 36, cy: 52 }, RUINAS = { cx: 74, cy: 50 };
    reservar(CLARO.cx, CLARO.cy, 8); [ARROYO, CAMPA, CASCADA, ROBLE, RUINAS].forEach((p) => reservar(p.cx, p.cy, 5.7)); reservar(MIRADOR.cx, MIRADOR.cy, MIRADOR.r + 3);
    circulo(MIRADOR.cx, MIRADOR.cy, MIRADOR.r, (x, y) => { if (tipo[y][x] === K.PASTO) tipo[y][x] = K.PIEDRA; });
    circulo(RUINAS.cx, RUINAS.cy, 3.4, (x, y) => { if (tipo[y][x] === K.PASTO) tipo[y][x] = K.PIEDRA; });                   // el suelo de las ruinas
    for (let y = 3; y <= 6; y++) for (let x = 66; x <= 70; x++) tipo[y][x] = K.ACANTILADO;                                 // la pared de la cascada
    for (let y = 7; y <= 8; y++) for (let x = 66; x <= 70; x++) tipo[y][x] = K.AGUA;                                       // y la laguna a sus pies
    camino(1, 30, 81, 30);                                                                                                  // el sendero principal, hasta el portón
    camino(20, 29, 10, 29); camino(10, 29, 10, 14);                                                                         // al noroeste: el Mirador
    camino(10, 31, 10, 46);                                                                                                 // al suroeste: el Campamento
    camino(24, 32, 24, 52); camino(24, 52, 34, 52); camino(34, 52, 65, 52);                                                 // al sur: el Gran Roble y el segundo puente
    camino(66, 32, 66, 52);                                                                                                 // por la orilla este hacia el sur…
    camino(66, 48, 72, 48); camino(66, 38, 69, 38);                                                                         // …a las Ruinas y al Arroyo
    camino(66, 29, 66, 12);                                                                                                 // al noreste: la Cascada
    camino(76, 30, 76, 25);                                                                                                 // a la arena del Guardián
    for (let a = 0; a < 6.283; a += 0.62) { if (Math.abs(a - Math.PI / 2) < 0.7) continue; rocas.push({ x: (MIRADOR.cx + Math.cos(a) * (MIRADOR.r + 1.1)) * TILE, y: (MIRADOR.cy + Math.sin(a) * (MIRADOR.r + 1.1)) * TILE }); }
    // ---- objetos con volumen (se dibujan con profundidad y bloquean el paso) ----
    const decorados = [];
    const carpa = (a, b) => { const [c, g] = lienzo(70, 56); g.fillStyle = "rgba(0,0,0,.2)"; g.beginPath(); g.ellipse(35, 52, 32, 5, 0, 0, 7); g.fill(); g.fillStyle = a; g.beginPath(); g.moveTo(4, 50); g.lineTo(35, 6); g.lineTo(66, 50); g.closePath(); g.fill(); g.fillStyle = b; g.beginPath(); g.moveTo(35, 6); g.lineTo(66, 50); g.lineTo(44, 50); g.closePath(); g.fill(); g.fillStyle = "#2a1a10"; g.beginPath(); g.moveTo(29, 50); g.lineTo(35, 26); g.lineTo(41, 50); g.closePath(); g.fill(); return c; };
    const carpas = [carpa("#c0562b", "#9a3f1c"), carpa("#3a6ea5", "#2a5483")];
    [[-62, -66], [62, -66]].forEach(([dx, dy], i) => { const x = CAMPA.cx * TILE + 16 + dx, y = CAMPA.cy * TILE + 16 + dy; decorados.push({ x, y, dibujar: (ctx, px, py) => ctx.drawImage(carpas[i], px - 35, py - 54) }); obstaculos.push({ x: x - 24, y: y - 8, w: 48, h: 8 }); });
    const columna = (alto) => { const [c, g] = lienzo(26, 72); g.fillStyle = "rgba(0,0,0,.2)"; g.beginPath(); g.ellipse(13, 68, 12, 4, 0, 0, 7); g.fill(); g.fillStyle = "#b7b2a3"; g.fillRect(4, 72 - alto, 18, alto - 6); g.fillStyle = "#d4cfc0"; g.fillRect(4, 72 - alto, 6, alto - 6); g.fillStyle = "#9a9586"; g.fillRect(2, 62, 22, 8); g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(7, 72 - alto + 10, 2, 14); g.fillRect(14, 72 - alto + 22, 2, 12); for (let i = 0; i < 4; i++) g.fillRect(4 + i * 5, 72 - alto - 2 + (i % 2) * 3, 5, 4); return c; };
    const columnas = [columna(60), columna(44), columna(54)];
    [[-92, -52], [-18, -92], [86, -60]].forEach(([dx, dy], i) => { const x = RUINAS.cx * TILE + 16 + dx, y = RUINAS.cy * TILE + 16 + dy; decorados.push({ x, y, dibujar: (ctx, px, py) => ctx.drawImage(columnas[i], px - 13, py - 68) }); obstaculos.push({ x: x - 10, y: y - 8, w: 20, h: 8 }); });
    const roble = graficosBase().arbolImg[0], rx = ROBLE.cx * TILE + 16, ry = ROBLE.cy * TILE + 16 - 18;
    decorados.push({ x: rx, y: ry, dibujar: (ctx, px, py) => ctx.drawImage(roble, px - 54, py - 128, 108, 136) }); obstaculos.push({ x: rx - 13, y: ry - 10, w: 26, h: 10 });  // el Gran Roble: un árbol enorme
    return {
      spots: {
        claro: { cx: CLARO.cx, cy: CLARO.cy, offsets: [[74, 12], [-74, 22], [8, -70], [-36, 84], [64, 76]] },
        arroyo: { cx: ARROYO.cx, cy: ARROYO.cy, offsets: [[54, -30], [-40, 14], [14, 58], [-20, -56], [62, 34]] },
        mirador: { cx: MIRADOR.cx, cy: MIRADOR.cy, offsets: [[52, 22], [-52, 22], [2, -36], [34, 62], [-34, 62]] },
        campamento: { cx: CAMPA.cx, cy: CAMPA.cy, offsets: [[74, 14], [-74, 24], [8, -20], [-34, 66], [62, 62]] },
        cascada: { cx: CASCADA.cx, cy: CASCADA.cy },
        roble: { cx: ROBLE.cx, cy: ROBLE.cy, offsets: [[78, 14], [-78, 24], [66, 62], [-34, 66], [-76, -44]] },
        ruinas: { cx: RUINAS.cx, cy: RUINAS.cy, offsets: [[40, 18], [-40, 28], [8, -14], [-20, 66], [58, 62]] },
      },
      retadores: [{ cx: 27, cy: 42 }, { cx: 69, cy: 20 }, { cx: 13, cy: 22 }, { cx: 48, cy: 50 }],
      decorados,
      decor(g, r) {
        for (let i = 0; i < 90; i++) { const x = 66 * TILE + 4 + Math.floor(r() * 5 * TILE - 8); g.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.4})`; g.fillRect(x, 3 * TILE + Math.floor(r() * 4 * TILE), 2, 6 + Math.floor(r() * 18)); } // la cascada cae por la pared
        g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.ellipse(68 * TILE + 16, 7 * TILE + 4, 70, 12, 0, 0, 7); g.fill();                                                        // la espuma de la laguna
        const fx = CAMPA.cx * TILE + 16, fy = CAMPA.cy * TILE + 30; g.fillStyle = "rgba(255,160,50,.22)"; g.beginPath(); g.ellipse(fx, fy, 48, 28, 0, 0, 7); g.fill();                  // la fogata del campamento
        for (let a = 0; a < 6.283; a += 0.7) { g.fillStyle = "#7c7c88"; g.beginPath(); g.ellipse(fx + Math.cos(a) * 15, fy + Math.sin(a) * 8, 4, 3, 0, 0, 7); g.fill(); }
        g.fillStyle = "#4a2f17"; g.fillRect(fx - 9, fy - 2, 18, 4); g.fillStyle = "#ff8a1f"; g.beginPath(); g.ellipse(fx, fy - 4, 6, 8, 0, 0, 7); g.fill(); g.fillStyle = "#ffd94a"; g.beginPath(); g.ellipse(fx, fy - 2, 3, 5, 0, 0, 7); g.fill();
      },
    };
  },
};

// ---- LA MONTAÑA DEL ESFUERZO: un sendero en zigzag que sube entre acantilados hasta una cumbre nevada ----
const DEF_MONTANA = {
  id: "montana", nombre: "Montaña del Esfuerzo", icono: "🏔️", seed: 888, fondo: "#2a2f3a", entradaTy: 31,
  salida: { ty: 7, zona: "lago", nombre: "Camino al Lago de la Reflexión", etiqueta: "Lago", emoji: "🏞️" },
  densidadArboles: 0.03, densidadRocas: 0.05, arena: { cx: 44, cy: 5, r: 2.4 },
  paleta: { [K.PASTO]: [["#5a8f45", "#5e944a", "#547f3f"], "#6fa65a", "#3f6b33"] },
  terreno({ K, tipo, reservar, camino }) {
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      let t = K.ROCOSO;
      if (y <= 11) t = K.NIEVE; else if (y <= 13 && (x * 7 + y * 3) % 3 === 0) t = K.NIEVE;
      if (y >= 28 && x <= 21) t = K.PASTO;
      tipo[y][x] = t;
    }
    for (let x = 0; x < MW; x++) { // dos paredes de acantilado con un paso en cada una (en zigzag)
      for (const y of [14, 15]) if (!(x >= 8 && x <= 11)) tipo[y][x] = K.ACANTILADO;
      for (const y of [26, 27]) if (!(x >= 46 && x <= 49)) tipo[y][x] = K.ACANTILADO;
    }
    reservar(24, 35, 4.5); reservar(23, 18, 4.5); reservar(30, 6, 4.5);
    camino(1, 32, 47, 32); camino(47, 32, 47, 22); camino(47, 22, 9, 22); camino(9, 22, 9, 9); camino(9, 9, 53, 9); camino(44, 9, 44, 7);
    return { spots: {
      sendero: { cx: 24, cy: 35, offsets: [[74, 10], [-74, 18], [8, -34], [-30, 52], [60, 50]] },
      cueva: { cx: 23, cy: 18, offsets: [[64, 8], [-64, 14], [0, -14], [34, 46], [-34, 50]] },
      cumbre: { cx: 30, cy: 6, offsets: [[70, 6], [-70, 14], [0, -50], [-28, 46], [34, 46]] },
    },
    retadores: [{ cx: 38, cy: 35 }, { cx: 30, cy: 19 }],
    decor(g) { // la boca de la cueva en la pared y la bandera de la cumbre
      const cx = 23 * TILE, cy = 14 * TILE; g.fillStyle = "#15121a"; g.beginPath(); g.moveTo(cx - 38, cy + 2 * TILE - 2); g.quadraticCurveTo(cx - 38, cy + 4, cx, cy + 4); g.quadraticCurveTo(cx + 38, cy + 4, cx + 38, cy + 2 * TILE - 2); g.closePath(); g.fill();
      g.fillStyle = "#2a2430"; g.beginPath(); g.ellipse(cx, cy + 2 * TILE - 2, 30, 8, 0, 0, 7); g.fill(); g.strokeStyle = "#8a858f"; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 38, cy + 2 * TILE - 2); g.quadraticCurveTo(cx - 38, cy + 4, cx, cy + 4); g.quadraticCurveTo(cx + 38, cy + 4, cx + 38, cy + 2 * TILE - 2); g.stroke();
      g.font = "26px " + FUENTE_EMOJI; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#000"; g.fillText("🚩", 30 * TILE + 16, 4 * TILE + 8);
    } };
  },
};

// ---- EL LAGO DE LA REFLEXIÓN: un gran lago con un muelle de madera que lleva a una isla ----
const DEF_LAGO = {
  id: "lago", nombre: "Lago de la Reflexión", icono: "🏞️", seed: 999, fondo: "#1b4a3a", entradaTy: 19, salida: null,
  densidadArboles: 0.06, densidadRocas: 0.012, arena: { cx: 39, cy: 20, r: 1.6 },
  paleta: { [K.PASTO]: [["#58a64a", "#5cab4e", "#519c44"], "#70bd60", "#3f8636"], [K.AGUA]: [["#3b8fd1"], "#74b6e8", "#2a74b3"] },
  flores: { prob: 0.06, probZona: 0.2, zonas: [{ cx: 8, cy: 26, r: 4 }] },
  terreno({ K, tipo, dentro, reservar, circulo, camino }) {
    const LAGO = { cx: 31, cy: 21, rx: 19, ry: 12 }, ISLA = { cx: 39, cy: 20, r: 4.3 };
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const d = ((x + 0.5 - LAGO.cx) / LAGO.rx) ** 2 + ((y + 0.5 - LAGO.cy) / LAGO.ry) ** 2; if (d < 1) tipo[y][x] = K.AGUA; else if (d < 1.22 && tipo[y][x] === K.PASTO) tipo[y][x] = K.ARENA; }
    circulo(ISLA.cx, ISLA.cy, ISLA.r + 1, (x, y, d) => { tipo[y][x] = d <= ISLA.r ? K.PASTO : K.ARENA; });                // la isla, con su playa
    for (let x = 10; x <= 34; x++) { tipo[20][x] = K.PUENTE; tipo[21][x] = K.PUENTE; }                                       // el muelle hasta la isla
    for (let x = 20; x <= 25; x++) for (let y = 19; y <= 22; y++) tipo[y][x] = K.PUENTE;                                     // la plataforma del muelle
    reservar(8, 26, 4.5); reservar(ISLA.cx, ISLA.cy, ISLA.r + 2);
    camino(1, 20, 9, 20); camino(6, 20, 6, 26);
    return { spots: {
      orilla: { cx: 8, cy: 26 },
      muelle: { cx: 23, cy: 21, offsets: [[-64, -54], [16, -54], [-64, 36], [16, 36], [-24, -54]] },
      isla: { cx: 39, cy: 20 },
    },
    retadores: [{ cx: 6, cy: 18 }, { cx: 30, cy: 6 }],
    decor(g, r, tipoG) { // nenúfares sobre el agua
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (tipoG[y][x] === K.AGUA && r() < 0.025) { const px = x * TILE + 6 + r() * 20, py = y * TILE + 6 + r() * 20; g.fillStyle = "#3f9b4a"; g.beginPath(); g.ellipse(px, py, 7, 4, 0, 0, 7); g.fill(); if (r() < 0.4) { g.fillStyle = "#f8bbd0"; g.fillRect(px - 1, py - 1, 3, 3); } }
    } };
  },
};

// =====================================================================================
//  LA PARCELA: un terreno cercado donde el estudiante coloca los objetos que fabricó
// =====================================================================================
function crearParcela() {
  const COLS = PARCELA.cols, FILAS = PARCELA.filas, W = COLS * TILE, H = FILAS * TILE, mitad = COLS / 2, r = rng(5150);
  const esCerca = (tx, ty) => tx === 0 || ty === 0 || tx === COLS - 1 || (ty === FILAS - 1 && tx !== mitad - 1 && tx !== mitad);
  const [suelo, g] = lienzo(W, H);
  for (let ty = 0; ty < FILAS; ty++) for (let tx = 0; tx < COLS; tx++) {
    const px = tx * TILE, py = ty * TILE, camino = (tx === mitad - 1 || tx === mitad) && ty >= FILAS - 4;
    g.fillStyle = camino ? ((tx + ty) % 2 ? "#b79a6a" : "#ae9061") : ((tx + ty) % 2 ? "#4c9a45" : "#478f40"); g.fillRect(px, py, TILE, TILE);
    for (let i = 0; i < 6; i++) { g.fillStyle = camino ? "#9c8052" : (r() < 0.5 ? "#5fb057" : "#3b7d35"); g.fillRect(px + Math.floor(r() * 30), py + Math.floor(r() * 30), 2, 2); }
    if (!camino && r() < 0.05) { g.fillStyle = ["#ffffff", "#ffd54f", "#f48fb1"][Math.floor(r() * 3)]; g.fillRect(px + 6 + Math.floor(r() * 18), py + 6 + Math.floor(r() * 18), 3, 3); }
  }
  for (let ty = 0; ty < FILAS; ty++) for (let tx = 0; tx < COLS; tx++) if (esCerca(tx, ty)) { // la cerca: postes y dos travesaños
    const px = tx * TILE, py = ty * TILE;
    g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(px, py + 24, TILE, 5);
    g.fillStyle = "#8a5a2b"; g.fillRect(px, py + 12, TILE, 4); g.fillRect(px, py + 20, TILE, 4);
    g.fillStyle = "#6b4220"; g.fillRect(px + 4, py + 6, 5, 22); g.fillRect(px + 23, py + 6, 5, 22); g.fillStyle = "#a67340"; g.fillRect(px + 4, py + 6, 5, 2); g.fillRect(px + 23, py + 6, 5, 2);
  }
  const obstaculos = []; // las piezas colocadas bloquean el paso
  return {
    id: "parcela", zona: "parcela", nombre: "Mi parcela", icono: "🏡", exterior: false, musica: "exterior", parcela: true,
    ancho: W, alto: H, suelo, fondo: "#17391c", obstaculos, spawn: { x: W / 2, y: H - TILE - 6 }, mini: null, estrellas: [], edificios: [], portones: [],
    npcs: [], puertas: [], salidas: [{ x: W / 2 - TILE + 6, y: H - TILE + 12, w: 2 * TILE - 12, h: TILE + 20 }], slotsPorLugar: {},
    bloqueado: (px, py) => { const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE); return tx < 0 || ty < 0 || tx >= COLS || ty >= FILAS ? true : esCerca(tx, ty); },
    piso: () => "pasto", puntoLibre: () => ({ x: W / 2, y: H - 80 }), piezas: new Map(),
    objetos(lista, ctx, camX, camY, visible, t) {
      for (const [k, p] of this.piezas) {
        const cx = p.x * TILE + 16, by = p.y * TILE + 28; if (!visible(cx, by)) continue;
        lista.push({ y: by, d: () => {
          const sx = Math.round(cx - camX), sy = Math.round(by - camY);
          ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(sx, sy - 2, 11, 4, 0, 0, 7); ctx.fill();
          if (p.item === "farol") { ctx.fillStyle = `rgba(255,200,80,${0.14 + 0.05 * Math.sin(t * 5 + p.x)})`; ctx.beginPath(); ctx.arc(sx, sy - 14, 30, 0, 7); ctx.fill(); }
          ctx.globalAlpha = 1; ctx.fillStyle = "#000"; ctx.font = "24px " + FUENTE_EMOJI; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText(ITEMS[p.item].emoji, sx, sy - 3);
        } });
      }
    },
    efectos: null,
  };
}

// =====================================================================================
//  EL MUNDO POR DENTRO: los interiores de los edificios
// =====================================================================================
const TEMAS = {
  biblioteca: { piso: ["#b98a55", "#b0814d"], linea: "#8f6838", pared: "#7a4f2d", zocalo: "#5a3a1e", sonido: "madera", fondo: "#150f0a" },
  agora: { piso: ["#ebe7dc", "#ddd8c8"], linea: "#c4bda8", pared: "#cfc8b4", zocalo: "#a99f86", sonido: "piedra", fondo: "#14161c" },
  templo: { piso: ["#cfc8dc", "#c4bdd2"], linea: "#a79fba", pared: "#9b8fb5", zocalo: "#6f6390", sonido: "piedra", fondo: "#120f1a" },
  mercado: { piso: ["#a77b4a", "#9d7243"], linea: "#7e5a33", pared: "#c98f4a", zocalo: "#8a5a2b", sonido: "madera", fondo: "#150f0a" },
  comarca: { piso: ["#c7ccd9", "#bcc2d1"], linea: "#9aa1b8", pared: "#8c2f48", zocalo: "#5c1e30", sonido: "piedra", fondo: "#140c10" },
  acertijos: { piso: ["#8a76b8", "#7f6bae"], linea: "#65529a", pared: "#4c3b82", zocalo: "#2f2457", sonido: "piedra", fondo: "#100c1c" },
  posada: { piso: ["#c49a6c", "#bb9163"], linea: "#8f6d44", pared: "#e3cfa6", zocalo: "#8a5a2b", sonido: "madera", fondo: "#150f0a" },
};
const rr = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

// Muebles: cada uno se dibuja una sola vez en un lienzo chico.
function fabricarMueble(tipo, r) {
  const colores = ["#b23a48", "#3a6ea5", "#4f8a4b", "#c9a227", "#7b4fa3", "#d9822b", "#2f6f73"];
  const pick = () => colores[Math.floor(r() * colores.length)];
  if (tipo === "estante") {
    const [c, g] = lienzo(64, 72); rr(g, 0, 4, 64, 68, "#4a2f17"); rr(g, 3, 7, 58, 62, "#7a5230");
    for (let f = 0; f < 3; f++) { const y = 10 + f * 20; rr(g, 3, y + 16, 58, 4, "#3f2712"); let x = 5; while (x < 56) { const w = 3 + Math.floor(r() * 4), h = 10 + Math.floor(r() * 6); rr(g, x, y + 16 - h, w, h, pick()); x += w + 1; } }
    return { img: c, w: 64, h: 72, pared: true };
  }
  if (tipo === "mesa") {
    const [c, g] = lienzo(72, 46); g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(6, 38, 62, 6);
    rr(g, 6, 24, 6, 18, "#5a3a1e"); rr(g, 60, 24, 6, 18, "#5a3a1e"); rr(g, 2, 10, 68, 18, "#b0773c"); rr(g, 2, 10, 68, 4, "#c98d4d"); rr(g, 2, 26, 68, 3, "#8a5a2b");
    rr(g, 12, 6, 12, 5, pick()); rr(g, 14, 3, 12, 4, pick()); rr(g, 40, 7, 14, 4, pick()); g.fillStyle = "#fff4d6"; g.fillRect(52, 4, 10, 7);
    return { img: c, w: 72, h: 46, ob: 16 };
  }
  if (tipo === "banco") {
    const [c, g] = lienzo(60, 28); g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(4, 24, 54, 4);
    rr(g, 4, 14, 5, 12, "#5a3a1e"); rr(g, 51, 14, 5, 12, "#5a3a1e"); rr(g, 2, 8, 56, 9, "#9a6a35"); rr(g, 2, 8, 56, 3, "#b8824a"); rr(g, 2, 0, 56, 6, "#8a5a2b");
    return { img: c, w: 60, h: 28, ob: 12 };
  }
  if (tipo === "columna") {
    const [c, g] = lienzo(26, 76); g.fillStyle = "rgba(0,0,0,.2)"; g.beginPath(); g.ellipse(13, 72, 12, 4, 0, 0, 7); g.fill();
    rr(g, 2, 62, 22, 10, "#cfcabb"); rr(g, 5, 8, 16, 56, "#e8e4d8"); rr(g, 5, 8, 5, 56, "#f6f3ea"); rr(g, 18, 8, 3, 56, "#c9c3b0"); rr(g, 2, 0, 22, 10, "#d8d3c4"); rr(g, 2, 8, 22, 3, "#b9b3a0");
    for (let y = 14; y < 60; y += 12) rr(g, 5, y, 16, 1, "rgba(0,0,0,.08)");
    return { img: c, w: 26, h: 76, ob: 10, anchoOb: 18 };
  }
  if (tipo === "altar") {
    const [c, g] = lienzo(76, 56); g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(4, 50, 68, 5);
    rr(g, 4, 26, 68, 26, "#b9b2cc"); rr(g, 4, 26, 68, 5, "#d4cee4"); rr(g, 10, 12, 56, 16, "#8c2f48"); rr(g, 10, 12, 56, 3, "#b4445f");
    g.fillStyle = "#ffe08a"; g.beginPath(); g.arc(38, 8, 6, 0, 7); g.fill(); g.fillStyle = "rgba(255,224,138,.35)"; g.beginPath(); g.arc(38, 8, 11, 0, 7); g.fill();
    return { img: c, w: 76, h: 56, ob: 18 };
  }
  if (tipo === "atril") {
    const [c, g] = lienzo(30, 46); g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(3, 42, 24, 4);
    rr(g, 12, 18, 6, 26, "#5a3a1e"); rr(g, 4, 40, 22, 5, "#4a2f17"); rr(g, 2, 6, 26, 14, "#a8763e"); rr(g, 2, 6, 26, 4, "#c98d4d"); rr(g, 6, 3, 18, 5, "#fff4d6");
    return { img: c, w: 30, h: 46, ob: 10 };
  }
  if (tipo === "puesto") {
    const [c, g] = lienzo(84, 70); g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(6, 64, 74, 5);
    rr(g, 8, 24, 5, 42, "#5a3a1e"); rr(g, 71, 24, 5, 42, "#5a3a1e"); rr(g, 6, 40, 72, 22, "#b0773c"); rr(g, 6, 40, 72, 4, "#c98d4d");
    const a = pick(), b = "#fff4d6"; for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(2 + i * 13, 6, 13, 22); g.beginPath(); g.arc(8.5 + i * 13, 28, 6.5, 0, Math.PI); g.fill(); }
    g.font = "16px " + FUENTE_EMOJI; g.textBaseline = "alphabetic"; g.textAlign = "center"; const bienes = ["🍎", "🧥", "⚔️", "🛡️", "📜", "🎒", "🪙", "🧪"]; for (let i = 0; i < 4; i++) g.fillText(bienes[Math.floor(r() * bienes.length)], 16 + i * 17, 40);
    return { img: c, w: 84, h: 70, ob: 22 };
  }
  if (tipo === "cama") {
    const [c, g] = lienzo(46, 60); g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(3, 56, 40, 4);
    rr(g, 2, 4, 42, 52, "#6e4a24"); rr(g, 2, 4, 42, 5, "#8a5a2b"); rr(g, 5, 9, 36, 44, "#efe7d6"); rr(g, 8, 12, 30, 10, "#ffffff"); rr(g, 8, 20, 30, 2, "#d9d0bd");
    const manta = pick(); rr(g, 5, 26, 36, 27, manta); rr(g, 5, 26, 36, 4, "rgba(255,255,255,.25)"); rr(g, 5, 49, 36, 4, "rgba(0,0,0,.18)");
    return { img: c, w: 46, h: 60, pared: true };
  }
  if (tipo === "chimenea") {
    const [c, g] = lienzo(80, 76); rr(g, 0, 70, 80, 6, "rgba(0,0,0,.2)"); rr(g, 2, 8, 76, 64, "#8a8a98"); rr(g, 2, 8, 76, 6, "#b4b4c2"); rr(g, 2, 8, 6, 64, "#a0a0ae");
    for (let y = 18; y < 70; y += 11) rr(g, 2, y, 76, 1, "rgba(0,0,0,.15)"); rr(g, 18, 26, 44, 46, "#1a1214"); rr(g, 14, 22, 52, 6, "#6f6f7d");
    rr(g, 24, 62, 32, 7, "#4a2f17"); rr(g, 28, 58, 24, 6, "#6b4423"); g.fillStyle = "#ff9d2e"; g.beginPath(); g.ellipse(40, 54, 11, 12, 0, 0, 7); g.fill(); g.fillStyle = "#ffd94a"; g.beginPath(); g.ellipse(40, 56, 6, 8, 0, 0, 7); g.fill();
    g.fillStyle = "#d9822b"; g.beginPath(); g.ellipse(31, 59, 5, 6, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(50, 59, 5, 6, 0, 0, 7); g.fill();
    return { img: c, w: 80, h: 76, pared: true };
  }
  if (tipo === "mostrador") {
    const [c, g] = lienzo(124, 50); g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(4, 46, 116, 4);
    rr(g, 2, 14, 120, 32, "#8a5a2b"); for (let x = 8; x < 118; x += 22) rr(g, x, 18, 1, 26, "rgba(0,0,0,.2)"); rr(g, 0, 8, 124, 10, "#c98d4d"); rr(g, 0, 8, 124, 3, "#e0a866"); rr(g, 2, 38, 120, 5, "#6e4a24");
    g.fillStyle = "#e8d3a0"; g.fillRect(14, 2, 8, 8); g.fillRect(16, 0, 4, 3); g.fillStyle = "#c9a227"; g.fillRect(52, 3, 9, 6); g.fillRect(55, 0, 3, 4); g.fillStyle = "#b23a48"; g.fillRect(92, 3, 9, 7); g.fillRect(100, 5, 3, 3);
    return { img: c, w: 124, h: 50, ob: 22, anchoOb: 130 };
  }
  if (tipo === "taburete") { const [c, g] = lienzo(24, 28); g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.ellipse(12, 25, 9, 3, 0, 0, 7); g.fill(); rr(g, 5, 14, 3, 11, "#5a3a1e"); rr(g, 16, 14, 3, 11, "#5a3a1e"); g.fillStyle = "#a8763e"; g.beginPath(); g.ellipse(12, 12, 10, 6, 0, 0, 7); g.fill(); g.fillStyle = "#c98d4d"; g.beginPath(); g.ellipse(12, 10, 10, 5, 0, 0, 7); g.fill(); return { img: c, w: 24, h: 28, ob: 8 }; }
  if (tipo === "caja") { const [c, g] = lienzo(28, 28); g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(2, 24, 24, 4); rr(g, 2, 6, 24, 20, "#9a6a35"); rr(g, 2, 6, 24, 4, "#b8824a"); rr(g, 2, 14, 24, 2, "#6e4a24"); rr(g, 12, 6, 4, 20, "#6e4a24"); return { img: c, w: 28, h: 28, ob: 12 }; }
  if (tipo === "barril") { const [c, g] = lienzo(24, 32); g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.ellipse(12, 29, 10, 3, 0, 0, 7); g.fill(); rr(g, 3, 4, 18, 24, "#8a5a2b"); rr(g, 3, 4, 5, 24, "#a8763e"); rr(g, 3, 9, 18, 2, "#3f2712"); rr(g, 3, 21, 18, 2, "#3f2712"); g.fillStyle = "#6e4a24"; g.beginPath(); g.ellipse(12, 5, 9, 3, 0, 0, 7); g.fill(); return { img: c, w: 24, h: 32, ob: 10 }; }
  // planta
  const [c, g] = lienzo(26, 36); g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.ellipse(13, 33, 9, 3, 0, 0, 7); g.fill();
  rr(g, 6, 22, 14, 11, "#b5653a"); rr(g, 5, 20, 16, 4, "#c97a4a");
  [["#3f8f43", 13, 12, 9], ["#4fae55", 8, 15, 7], ["#4fae55", 18, 15, 7], ["#66bb6a", 13, 7, 6]].forEach(([col, x, y, rad]) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rad, rad + 2, 0, 0, 7); g.fill(); });
  return { img: c, w: 26, h: 36, ob: 8 };
}

// La disposición de cada interior: muebles, huecos para personajes de misión y decorado del suelo/paredes.
function disenoInterior(tema, W, H) {
  const cx = W / 2;
  const base = { muebles: [], velas: [], slots: [] };
  if (tema === "biblioteca") {
    base.muebles = [["estante", 80, 86], ["estante", 160, 86], ["estante", W - 160, 86], ["estante", W - 80, 86], ["mesa", cx, 214], ["planta", 52, 300], ["planta", W - 52, 300], ["banco", 110, 262], ["banco", W - 110, 262]];
    base.slots = [{ x: cx + 58, y: 222 }, { x: cx - 66, y: 232 }, { x: cx, y: 150 }, { x: 150, y: 302 }, { x: W - 150, y: 302 }];
  } else if (tema === "agora") {
    base.muebles = [["columna", 96, 150], ["columna", W - 96, 150], ["columna", 96, 270], ["columna", W - 96, 270], ["atril", cx, 118], ["banco", cx - 100, 214], ["banco", cx + 100, 214], ["banco", cx - 100, 256], ["banco", cx + 100, 256]];
    base.slots = [{ x: cx + 38, y: 126 }, { x: cx, y: 188 }, { x: cx - 40, y: 296 }, { x: cx + 40, y: 296 }, { x: 170, y: 150 }];
  } else if (tema === "templo") {
    base.muebles = [["altar", cx, 118], ["banco", 92, 190], ["banco", 92, 236], ["banco", W - 92, 190], ["banco", W - 92, 236], ["planta", 50, 120], ["planta", W - 50, 120]];
    base.velas = [{ x: cx - 66, y: 124 }, { x: cx + 66, y: 124 }, { x: 54, y: 290 }, { x: W - 54, y: 290 }];
    base.slots = [{ x: cx + 62, y: 150 }, { x: cx - 62, y: 150 }, { x: cx, y: 200 }, { x: 130, y: 290 }, { x: W - 130, y: 290 }];
  } else if (tema === "posada") {
    base.muebles = [["cama", 70, 134], ["cama", 130, 134], ["chimenea", cx, 124], ["cama", W - 130, 134], ["cama", W - 70, 134], ["mesa", 150, 262], ["taburete", 118, 284], ["taburete", 184, 284], ["mostrador", W - 106, 262], ["barril", 50, 232], ["planta", 52, 324], ["planta", W - 50, 324]];
    base.slots = [{ x: 222, y: 214 }, { x: 300, y: 214 }, { x: 250, y: 300 }, { x: 330, y: 304 }, { x: 112, y: 210 }];
    base.posadero = { x: W - 106, y: 236 };
    base.llamas = [{ x: cx, y: 120 }];
  } else if (tema === "comarca") {
    base.muebles = [["estante", 80, 86], ["estante", W - 80, 86], ["columna", 96, 150], ["columna", W - 96, 150], ["columna", 96, 270], ["columna", W - 96, 270], ["mesa", cx, 214], ["planta", 52, 324], ["planta", W - 52, 324]];
    base.comarca = { mapa: { x: cx, y: 214 }, heraldo: { x: cx + 80, y: 140 } };
    base.slots = [{ x: cx - 100, y: 130 }, { x: cx - 30, y: 292 }, { x: 150, y: 306 }, { x: W - 150, y: 306 }, { x: cx + 40, y: 300 }];
  } else if (tema === "acertijos") {
    base.muebles = [["estante", 80, 86], ["estante", W - 80, 86], ["mesa", 100, 214], ["mesa", 204, 214], ["mesa", 308, 214], ["mesa", 412, 214], ["planta", 52, 324], ["planta", W - 52, 324]];
    base.mesas = [{ juego: "sopa", x: 100, y: 214 }, { juego: "cripto", x: 204, y: 214 }, { juego: "ahorcado", x: 308, y: 214 }, { juego: "rompe", x: 412, y: 214 }];
    base.slots = [{ x: cx - 34, y: 126 }, { x: cx + 34, y: 126 }, { x: 150, y: 300 }, { x: W - 150, y: 300 }, { x: cx, y: 300 }];
  } else { // mercado
    base.muebles = [["puesto", 100, 128], ["puesto", cx, 128], ["puesto", W - 100, 128], ["caja", W - 52, 236], ["caja", W - 52, 266], ["barril", 52, 240], ["barril", 52, 274], ["planta", W - 50, 306]];
    base.slots = [{ x: (100 + cx) / 2, y: 156 }, { x: (cx + W - 100) / 2, y: 156 }, { x: cx, y: 230 }, { x: 150, y: 290 }, { x: W - 150, y: 290 }];
  }
  return base;
}

function crearInterior(def, edificio) {
  const tm = TEMAS[def.tema], cols = def.cols, filas = def.filas, W = cols * TILE, H = filas * TILE, r = rng(1000 + cols * 7 + def.tema.length * 31);
  const [suelo, g] = lienzo(W, H);
  rr(g, 0, 0, W, H, tm.fondo);
  // piso
  for (let y = 2; y < filas; y++) for (let x = 1; x < cols - 1; x++) {
    const px = x * TILE, py = y * TILE; rr(g, px, py, TILE, TILE, tm.piso[(x + y) % 2]);
    g.strokeStyle = tm.linea; g.lineWidth = 1;
    if (def.tema === "biblioteca" || def.tema === "mercado" || def.tema === "posada") { g.beginPath(); g.moveTo(px, py + 0.5); g.lineTo(px + TILE, py + 0.5); g.moveTo(px + (y % 2 ? 11 : 21), py); g.lineTo(px + (y % 2 ? 11 : 21), py + TILE); g.stroke(); }
    else g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
    for (let i = 0; i < 3; i++) { g.fillStyle = "rgba(0,0,0,.05)"; g.fillRect(px + Math.floor(r() * 28), py + Math.floor(r() * 28), 2, 2); }
  }
  // pared de arriba (2 casillas) + paredes de los costados + pared de abajo con la puerta
  rr(g, 0, 0, W, 2 * TILE, tm.pared); rr(g, 0, 2 * TILE - 14, W, 14, tm.zocalo);
  for (let x = 0; x < W; x += 16) rr(g, x, 0, 1, 2 * TILE - 14, "rgba(0,0,0,.08)");
  rr(g, 0, 2 * TILE, TILE, H - 2 * TILE, tm.pared); rr(g, W - TILE, 2 * TILE, TILE, H - 2 * TILE, tm.pared);
  rr(g, 0, H - TILE, W / 2 - TILE, TILE, tm.pared); rr(g, W / 2 + TILE, H - TILE, W / 2 - TILE, TILE, tm.pared);
  rr(g, TILE - 4, 2 * TILE, 4, H - 3 * TILE, "rgba(0,0,0,.18)"); rr(g, W - TILE, 2 * TILE, 4, H - 3 * TILE, "rgba(0,0,0,.18)");
  rr(g, 0, H - TILE, W / 2 - TILE, 5, tm.zocalo); rr(g, W / 2 + TILE, H - TILE, W / 2 - TILE, 5, tm.zocalo);
  // alfombrilla de la puerta
  rr(g, W / 2 - TILE, H - TILE, 2 * TILE, TILE, "#6e4a24"); rr(g, W / 2 - TILE + 4, H - TILE + 4, 2 * TILE - 8, TILE - 4, "#8c2f48"); rr(g, W / 2 - TILE + 8, H - TILE + 8, 2 * TILE - 16, TILE - 12, "#a63a56");
  // ventanas
  const vent = (x, col) => { rr(g, x - 1, 10, 26, 30, "#4a3018"); rr(g, x + 2, 13, 20, 24, col || "#a8d8f0"); rr(g, x + 11, 13, 2, 24, "#4a3018"); rr(g, x + 2, 24, 20, 2, "#4a3018"); rr(g, x + 4, 15, 5, 8, "rgba(255,255,255,.55)"); };
  const xs = def.tema === "mercado" || def.tema === "biblioteca" ? [W / 2 - 13] : [96, W - 96 - 22];
  xs.forEach((x, i) => vent(x, def.tema === "templo" ? ["#e08aa0", "#8ab4e0", "#e0c88a"][i % 3] : null));
  if (def.tema === "agora") { [W / 2 - 60, W / 2 + 36].forEach((x) => { rr(g, x, 8, 24, 34, "#27508a"); rr(g, x + 2, 10, 20, 30, "#3b6cb0"); g.font = "14px " + FUENTE_EMOJI; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff"; g.fillText("⚖️", x + 12, 26); }); }
  if (def.tema === "templo") { g.font = "22px " + FUENTE_EMOJI; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff"; g.fillText("🕊️", W / 2, 26); }
  // alfombras decorativas
  if (def.tema === "biblioteca") { g.fillStyle = "#7a2230"; g.beginPath(); g.ellipse(W / 2, 236, 112, 52, 0, 0, 7); g.fill(); g.strokeStyle = "#e8c36a"; g.lineWidth = 3; g.beginPath(); g.ellipse(W / 2, 236, 104, 46, 0, 0, 7); g.stroke(); }
  if (def.tema === "templo") { rr(g, W / 2 - 34, 2 * TILE, 68, H - 3 * TILE, "#8c2f48"); rr(g, W / 2 - 30, 2 * TILE, 4, H - 3 * TILE, "#e8c36a"); rr(g, W / 2 + 26, 2 * TILE, 4, H - 3 * TILE, "#e8c36a"); }
  if (def.tema === "agora") { g.fillStyle = "#27508a"; g.fillRect(W / 2 - 70, 2 * TILE + 8, 140, 6); g.fillStyle = "#e8c36a"; g.fillRect(W / 2 - 70, 2 * TILE + 14, 140, 2); }
  if (def.tema === "mercado") { rr(g, W / 2 - 60, 190, 120, 70, "#c0562b"); rr(g, W / 2 - 54, 196, 108, 58, "#e0b36a"); }
  if (def.tema === "comarca") { rr(g, W / 2 - 34, 2 * TILE, 68, H - 3 * TILE, "#27508a"); rr(g, W / 2 - 30, 2 * TILE, 4, H - 3 * TILE, "#e8c36a"); rr(g, W / 2 + 26, 2 * TILE, 4, H - 3 * TILE, "#e8c36a"); g.font = "22px " + FUENTE_EMOJI; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff"; g.fillText("🏰", W / 2, 26); }
  if (def.tema === "acertijos") { g.fillStyle = "#3a2c6e"; g.beginPath(); g.ellipse(W / 2, 268, 190, 46, 0, 0, 7); g.fill(); g.strokeStyle = "#e8c36a"; g.lineWidth = 3; g.beginPath(); g.ellipse(W / 2, 268, 182, 40, 0, 0, 7); g.stroke(); }
  if (def.tema === "posada") { g.fillStyle = "#8c2f48"; g.beginPath(); g.ellipse(W / 2 - 70, 268, 96, 40, 0, 0, 7); g.fill(); g.strokeStyle = "#e8c36a"; g.lineWidth = 3; g.beginPath(); g.ellipse(W / 2 - 70, 268, 88, 34, 0, 0, 7); g.stroke(); }

  const dis = disenoInterior(def.tema, W, H), muebles = [], obstaculos = [];
  const wallBottom = 2 * TILE - 6;
  obstaculos.push({ x: 0, y: 0, w: W, h: wallBottom }, { x: 0, y: 0, w: TILE - 4, h: H }, { x: W - TILE + 4, y: 0, w: TILE - 4, h: H });
  obstaculos.push({ x: 0, y: H - TILE + 6, w: W / 2 - TILE, h: TILE }, { x: W / 2 + TILE, y: H - TILE + 6, w: W / 2 - TILE, h: TILE }, { x: 0, y: H + 2, w: W, h: TILE * 2 });
  for (const [t, x, y] of dis.muebles) {
    const m = fabricarMueble(t, r); muebles.push({ ...m, x, y });
    const ancho = (m.anchoOb || m.w) - 6, alto = m.pared ? Math.max(8, y - wallBottom) : m.ob;
    obstaculos.push({ x: x - ancho / 2, y: y - alto, w: ancho, h: alto });
  }
  const salidas = [{ x: W / 2 - TILE + 6, y: H - TILE + 12, w: 2 * TILE - 12, h: TILE + 20 }];
  return {
    id: "int_" + edificio.id, nombre: edificio.nombre, icono: edificio.icono, exterior: false, edificioId: edificio.id,
    ancho: W, alto: H, suelo, fondo: tm.fondo, obstaculos, spawn: { x: W / 2, y: H - TILE - 6 }, mini: null, estrellas: [],
    npcs: [], puertas: [], salidas, slots: dis.slots, mesas: dis.mesas || null, comarca: dis.comarca || null, velas: dis.velas, posadero: dis.posadero || null, bloqueado: () => false, piso: () => tm.sonido,
    puntoLibre(rand, chocaFn) { for (let i = 0; i < 300; i++) { const x = TILE * 2 + rand() * (W - TILE * 4), y = TILE * 4 + rand() * (H - TILE * 6); if (!chocaFn(x, y)) return { x, y }; } return { x: W / 2, y: H - 80 }; },
    objetos(lista, ctx, camX, camY, visible, t) {
      for (const m of muebles) lista.push({ y: m.y, d: () => ctx.drawImage(m.img, Math.round(m.x - m.w / 2 - camX), Math.round(m.y - m.h - camY)) });
      for (const l of dis.llamas || []) lista.push({ y: l.y + 2, d: () => { // las llamas de la chimenea parpadean
        const x = Math.round(l.x - camX), y = Math.round(l.y - camY), f = Math.sin(t * 11 + 1.3) * 2, f2 = Math.sin(t * 7) * 1.5;
        ctx.fillStyle = "rgba(255,170,60,.16)"; ctx.beginPath(); ctx.arc(x, y - 8, 46 + f, 0, 7); ctx.fill();
        ctx.fillStyle = "#ff8a1f"; ctx.beginPath(); ctx.ellipse(x - 5, y - 4 + f2 * 0.3, 5, 8 + f * 0.6, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(x + 6, y - 3 - f2 * 0.3, 4, 6 + f2, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#ffd94a"; ctx.beginPath(); ctx.ellipse(x, y - 2, 4, 6 + f * 0.5, 0, 0, 7); ctx.fill();
      } });
      for (const v of dis.velas) lista.push({ y: v.y, d: () => {
        const x = Math.round(v.x - camX), y = Math.round(v.y - camY), f = Math.sin(t * 9 + v.x) * 1.5;
        ctx.fillStyle = "rgba(255,200,80,.18)"; ctx.beginPath(); ctx.arc(x, y - 22, 16 + f, 0, 7); ctx.fill();
        ctx.fillStyle = "#e8e0c8"; ctx.fillRect(x - 3, y - 14, 6, 14); ctx.fillStyle = "#ffb83d"; ctx.beginPath(); ctx.ellipse(x, y - 19 + f * 0.3, 3, 5 + f * 0.4, 0, 0, 7); ctx.fill(); ctx.fillStyle = "#fff2a8"; ctx.fillRect(x - 1, y - 20, 2, 4);
      } });
    },
    efectos: null,
  };
}

// =====================================================================================
//  EL MOTOR
// =====================================================================================
const NOMBRES_ALDEANOS = ["Mara", "Tomás", "Lucía", "Bruno", "Inés", "Mateo", "Elena", "Pablo", "Rosa", "Hugo", "Clara", "Andrés", "Sofía", "Julián"];
const FRASES = [
  "¡Buen día! Dicen que ayudar a un compañero vale más que cualquier XP.",
  "Ayer vi una estrella ⭐ brillando cerca del lago. ¡Corre a buscarla!",
  "La Biblioteca guarda más secretos de los que parece.",
  "En el Mercado puedes ver las piezas que mejoran a tu personaje.",
  "El sabio de la fuente adora los acertijos. ¡Habla con él!",
  "Si te pierdes, mira el mapa en la esquina de la pantalla.",
  "La gratitud es la única moneda que nunca se acaba.",
  "Por aquí todos nos conocemos. ¿Ya conociste al Guardián del Ágora?",
  "Me encanta venir a la plaza: siempre pasa algo nuevo.",
  "Dicen que en la Comarca los reinos compiten por ser los mejores. ¡Qué emoción!",
  "Hoy no he aprendido nada nuevo… ¡todavía! El día es largo.",
  "El respeto empieza con escuchar. Es un buen consejo, ¿verdad?",
  "¿Entraste a los edificios? Cada uno tiene a alguien esperándote.",
  "Camina con calma: la aldea es grande y hay mucho por descubrir.",
];
const SPRITE_POR_LUGAR = { biblioteca: "cronista_femenino", agora: "defensor_masculino", templo: "peregrino_femenino", mercado: "consejero_masculino", plaza: "maestro_gremio_masculino", guardia: "defensor_masculino" };
// ---------- caminata por código ----------
// A partir de la pose quieta de cada dirección se arman 4 cuadros de caminata: se levanta una pierna
// (la mitad izquierda o derecha de la parte de abajo), contacto con el cuerpo 1 px más abajo, se levanta
// la otra pierna y otra vez contacto. Así los personajes caminan sin tener que dibujar nada más.
function fabricarPasos(im) {
  const W = im.naturalWidth || im.width, H = im.naturalHeight || im.height;
  if (!W || !H) return null;
  const [, g0] = lienzo(W, H); g0.drawImage(im, 0, 0);
  const d = g0.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  x1++; y1++; // los bordes de la caja son exclusivos
  const cx = (x0 + x1) >> 1, alto = Math.max(6, Math.round(0.3 * (y1 - y0))), tope = y1 - alto;
  const hacer = (lado, lev, rebote) => {
    const [c, g] = lienzo(W, H), out = g.createImageData(W, H), o = out.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4; if (d[i + 3] === 0) continue;
      let ny = y;
      if (y < tope) ny = y + rebote;                                                           // el cuerpo baja un poco en el contacto (los pies quedan quietos)
      else if ((lado === 1 && x < cx) || (lado === 2 && x >= cx)) ny = y - lev;                // la pierna que da el paso se levanta
      if (ny < 0 || ny >= H) continue;
      const j = (ny * W + x) * 4;
      if (ny !== y || o[j + 3] === 0) { o[j] = d[i]; o[j + 1] = d[i + 1]; o[j + 2] = d[i + 2]; o[j + 3] = d[i + 3]; }
    }
    g.putImageData(out, 0, 0); return c;
  };
  return [hacer(1, 2, 0), hacer(0, 0, 1), hacer(2, 2, 0), hacer(0, 0, 1)];
}
const LARGO_PASO = 10.5; // píxeles que hay que avanzar para pasar al siguiente cuadro de la caminata

const html = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function iniciarMundo(raiz, op) {
  asegurarCss();
  raiz.innerHTML = PLANTILLA;
  const q = (s) => raiz.querySelector(s);
  const cv = q(".m-canvas"), ctx = cv.getContext("2d"), mini = q(".m-mini"), mctx = mini.getContext("2d");
  const sprites = { ...op.sprites }, claves = Object.keys(op.sprites), J = op.jugador; // copia local: los sprites oscurecidos de los retadores no tocan los originales
  const claveJugador = sprites[J.clave] ? J.clave : claves[0];
  const otras = claves.filter((k) => k !== claveJugador);
  const temporizadores = new Set(); const espera = (fn, ms) => { const t = setTimeout(() => { temporizadores.delete(t); fn(); }, ms); temporizadores.add(t); };
  let vivo = true, rafId = 0, ultimo = 0, SCALE = 2, LW = 320, LH = 200, camX = 0, camY = 0;

  // ---- imágenes de todos los personajes (8 direcciones cada uno) ----
  const imgs = {};
  await Promise.all(claves.map((k) => { imgs[k] = {}; return Promise.all(DIRS8.map((d) => new Promise((ok) => { const im = new Image(); im.onload = ok; im.onerror = ok; im.src = sprites[k].dirs[d]; imgs[k][d] = im; }))); }));

  // ---- cuadros de caminata de todos los personajes y direcciones ----
  const pasos = {};
  claves.forEach((k) => { pasos[k] = {}; DIRS8.forEach((dd) => { pasos[k][dd] = fabricarPasos(imgs[k][dd]); }); });

  // ---- los retadores se ven oscurecidos y rojizos: se arma una copia teñida de cada sprite que usan ----
  const spriteRetador = (def, i) => (sprites[def.sprite] && def.sprite !== claveJugador ? def.sprite : otras[i % otras.length]);
  const claveSombra = (k) => k + "@sombra";
  const teñir = (im) => { const W = im.naturalWidth || im.width, H = im.naturalHeight || im.height, [c, g] = lienzo(W, H); g.drawImage(im, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = "rgba(140,0,40,.52)"; g.fillRect(0, 0, W, H); g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(0, 0, W, H); return c; };
  new Set(RETADORES.map((r, i) => spriteRetador(r, i))).forEach((k) => {
    const kT = claveSombra(k); imgs[kT] = {}; pasos[kT] = {}; sprites[kT] = { ancla: sprites[k].ancla, dirs: {} };
    DIRS8.forEach((d) => { imgs[kT][d] = teñir(imgs[k][d]); sprites[kT].dirs[d] = imgs[kT][d].toDataURL("image/png"); pasos[kT][d] = fabricarPasos(imgs[kT][d]); });
  });

  // ---- escenas ----
  const exterior = crearExterior();
  const interiores = {}; for (const e of exterior.edificios) interiores[e.id] = crearInterior(e.interior, e);
  const naturales = [crearZonaNatural(DEF_BOSQUE), crearZonaNatural(DEF_MONTANA), crearZonaNatural(DEF_LAGO)];
  const escenaDeZona = { aldea: exterior }; naturales.forEach((n) => (escenaDeZona[n.zona] = n));
  const conPortones = [exterior, ...naturales];                    // las escenas que tienen un portón hacia la zona siguiente
  const parcela = crearParcela();
  const escenas = { exterior, parcela }; naturales.forEach((n) => (escenas[n.id] = n)); Object.values(interiores).forEach((s) => (escenas[s.id] = s));
  const rand = rng(4242);

  // ---- colisiones (sirven para el jugador y para los aldeanos) ----
  function chocaEn(esc, x, y) {
    const bx = x - 6, by = y - 8, bw = 12, bh = 8;
    if (esc.bloqueado(bx, by) || esc.bloqueado(bx + bw, by) || esc.bloqueado(bx, by + bh) || esc.bloqueado(bx + bw, by + bh)) return true;
    for (const o of esc.obstaculos) if (bx < o.x + o.w && bx + bw > o.x && by < o.y + o.h && by + bh > o.y) return true;
    for (const p of esc.portones || []) if (!p.abierto && bx < p.bloqueo.x + p.bloqueo.w && bx + bw > p.bloqueo.x && by < p.bloqueo.y + p.bloqueo.h && by + bh > p.bloqueo.y) return true; // portón cerrado
    for (const n of esc.npcs) if (n.solido && bx < n.x + 13 && bx + bw > n.x - 13 && by < n.y + 3 && by + bh > n.y - 12) return true; // zona sólida de los personajes de misión: los vecinos no se les encimen
    return false;
  }

  // ---- misiones: cada una la da un personaje, dentro de un edificio o en la plaza ----
  const misiones = op.misiones || [];
  const hechas = new Set(op.hechas || []);
  const SLOTS_PLAZA = [{ x: exterior.plaza.cx * TILE + 74, y: exterior.plaza.cy * TILE + 18 }, { x: exterior.plaza.cx * TILE - 74, y: exterior.plaza.cy * TILE + 34 }, { x: exterior.plaza.cx * TILE + 14, y: exterior.plaza.cy * TILE - 70 }, { x: exterior.plaza.cx * TILE - 40, y: exterior.plaza.cy * TILE + 90 }, { x: exterior.plaza.cx * TILE + 96, y: exterior.plaza.cy * TILE + 80 }];
  function spriteParaMision(m, i) { let k = m.npc_sprite && sprites[m.npc_sprite] ? m.npc_sprite : SPRITE_POR_LUGAR[m.lugar] || SPRITE_POR_LUGAR.plaza; if (!sprites[k] || k === claveJugador) k = otras[i % otras.length]; return k; }
  const cuenta = {};
  misiones.forEach((m, i) => {
    let lugar, esc, slots;
    const zm = zonaDeMision(m);
    if (zm !== "aldea" && escenaDeZona[zm]) { esc = escenaDeZona[zm]; lugar = esc.slotsPorLugar[m.lugar] ? m.lugar : Object.keys(esc.slotsPorLugar)[0]; slots = esc.slotsPorLugar[lugar]; }
    else { lugar = interiores[m.lugar] ? m.lugar : "plaza"; esc = lugar === "plaza" ? exterior : interiores[lugar]; slots = lugar === "plaza" ? SLOTS_PLAZA : esc.slots; }
    const n = (cuenta[lugar] = (cuenta[lugar] ?? -1) + 1), s = slots[n % slots.length];
    esc.npcs.push({ tipo: "mision", mision: m, lugar, zona: zonaDeMision(m), nombre: m.npc_nombre || "Aldeano", emoji: m.npc_emoji || "💬", clave: spriteParaMision(m, i), x: s.x, y: s.y, dir: "south", solido: true });
  });

  // la posadera de la Posada del Descanso
  if (interiores.posada && interiores.posada.posadero) {
    const spritePosadera = sprites.heraldo_femenino && claveJugador !== "heraldo_femenino" ? "heraldo_femenino" : otras[1 % otras.length], pn = interiores.posada.posadero;
    interiores.posada.npcs.push({ tipo: "posadero", nombre: "La posadera", clave: spritePosadera, x: pn.x, y: pn.y, dir: "south", solido: true });
  }

  // las mesas de juego de la Casa de los Acertijos
  const AC = op.acertijos && op.acertijos.activo ? op.acertijos : null;
  const hechosAc = new Set((AC && AC.hechos) || []);
  if (interiores.acertijos && interiores.acertijos.mesas) for (const m of interiores.acertijos.mesas) {
    const T0 = TIPOS_ACERTIJO[m.juego]; interiores.acertijos.npcs.push({ tipo: "juego_mesa", juego: m.juego, nombre: T0.nombre, emoji: T0.emoji, x: m.x, y: m.y + 14, solido: false, radio: 58, dir: "south" });
  }

  // la Sala de la Comarca: el mapa de reinos y el Heraldo de las batallas
  const COM = op.comarca && op.comarca.activo ? op.comarca : null;      // { hay, miReinoId, reinos, provincias, batallas, aportes, batallasHoy }
  if (interiores.comarca && interiores.comarca.comarca) {
    const ci = interiores.comarca.comarca, spriteH = sprites.heraldo_masculino && claveJugador !== "heraldo_masculino" ? "heraldo_masculino" : otras[2 % otras.length];
    interiores.comarca.npcs.push({ tipo: "comarca_mapa", nombre: "Mapa de la Comarca", emoji: "🗺️", x: ci.mapa.x, y: ci.mapa.y + 14, solido: false, radio: 58, dir: "south" });
    interiores.comarca.npcs.push({ tipo: "comarca_heraldo", nombre: "Heraldo de la Comarca", clave: spriteH, x: ci.heraldo.x, y: ci.heraldo.y, dir: "south", solido: true });
  }

  // las misiones ocultas: objetos brillantes escondidos (se ven solo de cerca); la posición es fija para cada secreto
  const SEC = op.secretos && op.secretos.activo ? op.secretos : null;
  const hallados = new Set((SEC && SEC.hallados) || []);
  if (SEC) for (const sc of SEC.lista) {
    const esc = sc.escena === "plaza" ? exterior : interiores[sc.escena] || escenaDeZona[sc.escena];
    if (!esc || esc === parcela) continue;
    const pt = esc.puntoLibre(rng(7000 + (Number(sc.id) || 0) * 31), (x, y) => chocaEn(esc, x, y));
    esc.npcs.push({ tipo: "secreto", secreto: sc, nombre: sc.nombre, emoji: sc.emoji, x: pt.x, y: pt.y, solido: false, radio: 46, dir: "south", hallado: hallados.has(sc.id) });
  }

  // ---- zonas: la docente abre la zona para el curso, y el estudiante cumple el requisito ----
  const zonasAbiertas = new Set(op.zonasAbiertas || []);
  // duelos con los Guardianes (si no están activos, no hay guardianes ni se exige ninguna insignia)
  const D = op.duelos && op.duelos.activo ? op.duelos : null;
  const insignias = new Set((op.duelos && op.duelos.insignias) || []);
  const esperaHasta = { ...((op.duelos && op.duelos.esperaHasta) || {}) };
  const exigen = D ? D.exige || {} : {};
  let zonas = estadoZonas({ misiones, hechas, abiertas: zonasAbiertas, requisitos: op.zonasRequisitos || {}, insignias, exigen });
  const disponibles = () => misionesDisponibles(misiones, zonas);
  // el guardia del portón: explica qué falta para pasar
  const spriteGuardia = sprites[SPRITE_POR_LUGAR.guardia] && SPRITE_POR_LUGAR.guardia !== claveJugador ? SPRITE_POR_LUGAR.guardia : otras[0];
  conPortones.forEach((esc) => esc.portones.forEach((p) => {
    p.abierto = !!(zonas[p.zona] && zonas[p.zona].desbloqueada);
    esc.npcs.push({ tipo: "guardia", porton: p, nombre: "El guardia del portón", clave: spriteGuardia, x: p.guardia.x, y: p.guardia.y, dir: "east", solido: true });
  }));
  // el Guardián de cada zona espera en su arena
  if (D) conPortones.forEach((esc) => {
    const z = ZONAS.find((zz) => zz.key === esc.zona); if (!z || !esc.guardian) return;
    const sp = sprites[z.guardian.sprite] && z.guardian.sprite !== claveJugador ? z.guardian.sprite : otras[ZONAS.indexOf(z) % otras.length];
    esc.npcs.push({ tipo: "guardian", zona: z.key, nombre: z.guardian.nombre, titulo: z.guardian.titulo, clave: sp, x: esc.guardian.x, y: esc.guardian.y, dir: "south", solido: true });
  });
  // ---- los retadores: personajes hostiles con retos difíciles (la docente los configura zona por zona) ----
  const R = op.retos && op.retos.activo ? op.retos : null;
  const retosGanados = new Set((op.retos && op.retos.ganados) || []);
  const esperaReto = { ...((op.retos && op.retos.esperaHasta) || {}) };
  if (R) naturales.forEach((esc) => {
    if (!(R.zonas && R.zonas[esc.zona])) return;
    const lista = ZONAS.find((zz) => zz.key === esc.zona).retadores || [];
    lista.forEach((def, idx) => {
      const p = esc.retadores && esc.retadores[idx]; if (!p || retosGanados.has(def.id)) return;
      esc.npcs.push({ tipo: "retador", id: def.id, zona: esc.zona, nombre: def.nombre, frase: def.frase, clave: claveSombra(spriteRetador(def, RETADORES.findIndex((r) => r.id === def.id))), x: p.x, y: p.y, dir: "south", solido: true });
    });
  });

  // ---- recursos: puntos para recoger madera, piedra, peces y hierba (cada uno pide acertar una pregunta) ----
  const RC = op.recolecta && op.recolecta.activo ? op.recolecta : null;
  const inv = { ...((RC && RC.inventario) || {}) };
  let recogidoHoy = (RC && RC.hoy) || 0;
  if (RC) naturales.forEach((esc, zi) => {
    const lista = RECURSOS_POR_ZONA[esc.zona] || [], r = rng(9100 + zi * 17), puestos = [];
    const fijos = esc.npcs.filter((n) => n.tipo !== "aldeano");
    for (const [item, cuantos] of lista) {
      let hechos = 0, intentos = 0;
      while (hechos < cuantos && intentos++ < 4000) {
        const x = (4 + r() * (esc.cols - 8)) * TILE, y = (4 + r() * (esc.filas - 8)) * TILE, t = esc.tipoEn(x, y);
        if (!K_CAMINABLES.has(t) || t === K.CAMINO || t === K.PUENTE || t === K.PIEDRA) continue;           // fuera de los senderos y de los lugares de misión
        const agua = esc.aguaCerca(x, y, 2);
        if (item === "pez" ? !agua : agua) continue;                                                       // los peces, junto al agua; lo demás, lejos de ella
        if (chocaEn(esc, x, y)) continue;
        if (Math.hypot(x - esc.spawn.x, y - esc.spawn.y) < 170) continue;
        if (esc.guardian && Math.hypot(x - esc.guardian.x, y - esc.guardian.y) < 150) continue;
        if (fijos.some((n) => Math.hypot(n.x - x, n.y - y) < 80) || puestos.some((p) => Math.hypot(p.x - x, p.y - y) < 90)) continue;
        const nodo = { tipo: "recurso", item, zona: esc.zona, nombre: ITEMS[item].nombre, x, y, dir: "south", radio: 38, solido: true, hastaMs: 0 };
        puestos.push(nodo); esc.npcs.push(nodo); hechos++;
      }
    }
  });

  // ---- la parcela: un terreno propio al que se entra por un cartel cerca de donde se aparece en la aldea ----
  const PC = RC && op.parcela && op.parcela.activo ? op.parcela : null;
  let cartel = null;
  const obstaculoDe = (p) => ({ x: p.x * TILE + 4, y: p.y * TILE + 14, w: 24, h: 14 });
  function ponerPieza(p) { const pz = { item: p.item, x: p.x, y: p.y }; pz.obs = obstaculoDe(pz); parcela.piezas.set(`${p.x},${p.y}`, pz); parcela.obstaculos.push(pz.obs); }
  function sacarPieza(x, y) { const k = `${x},${y}`, pz = parcela.piezas.get(k); if (!pz) return; parcela.piezas.delete(k); const i = parcela.obstaculos.indexOf(pz.obs); if (i >= 0) parcela.obstaculos.splice(i, 1); }
  if (PC) {
    (PC.piezas || []).filter((p) => esDecoracion(p.item) && celdaValida(p.x, p.y) && !parcela.piezas.has(`${p.x},${p.y}`)).forEach(ponerPieza);
    const sp = exterior.spawn, cand = [[-110, -10], [110, -10], [-150, 30], [150, 30], [-70, -60], [70, -60], [-190, -10], [190, -10]];
    const libre = (x, y) => !chocaEn(exterior, x, y) && exterior.npcs.every((n) => Math.hypot(n.x - x, n.y - y) >= 60) && exterior.edificios.every((e) => Math.hypot(e.puerta.x - x, e.puerta.y - y) >= 70);
    const [dx, dy] = cand.find(([a, b]) => libre(sp.x + a, sp.y + b)) || cand[0];
    cartel = { tipo: "parcela_puerta", nombre: "Mi parcela", x: sp.x + dx, y: sp.y + dy, dir: "south", radio: 46, solido: true };
    exterior.npcs.push(cartel);
    parcela.salidas[0].accion = () => { snd.puerta(); cambiarEscena(exterior, cartel.x, cartel.y + 36); };
  }

  // ---- aldeanos: muchos personajes caminando por ahí ----
  let contadorAldeanos = 0;
  function poblar(esc, cantidad) {
    for (let i = 0; i < cantidad; i++) {
      const p = esc.puntoLibre(rand, (x, y) => chocaEn(esc, x, y)), k = contadorAldeanos++;
      esc.npcs.push({ tipo: "aldeano", nombre: NOMBRES_ALDEANOS[k % NOMBRES_ALDEANOS.length], clave: otras[k % otras.length], frase: FRASES[(k * 5 + 1) % FRASES.length], x: p.x, y: p.y, dir: "south", meta: null, pausa: rand() * 2, caminando: false });
    }
  }
  poblar(exterior, op.aldeanos ?? 9); Object.values(interiores).forEach((s) => poblar(s, op.aldeanosDentro ?? 2)); naturales.forEach((n) => poblar(n, op.aldeanosZonas ?? op.aldeanosBosque ?? n.vecinos ?? 5));

  // ---- sonido ----
  const snd = op.sonido === false ? crearSonido.apagado || { reanudar() {}, alternar() { return true; }, musica() {}, paso() {}, estrella() {}, bien() {}, mal() {}, hablar() {}, puerta() {}, golpe() {}, derrota() {}, fanfarria() {}, destruir() {}, mudo: true } : crearSonido();

  // ---- estado ----
  const estado = {
    activo: true, escena: exterior, clave: claveJugador, nombre: J.nombre || "Estudiante", x: exterior.spawn.x, y: exterior.spawn.y, dir: "south", caminando: false,
    xp: J.xp || 0, oro: J.oro || 0, vida: typeof J.vida === "number" ? J.vida : null, descansando: false, ganado: { xp: 0, oro: 0 }, est: 0, cercano: null, dialogo: null, avisos: [], fase: 0, terminado: false, cambiando: false, pasoT: 0.3,
    comp: { x: exterior.spawn.x, y: exterior.spawn.y }, hechas, fasePaso: 0, movio: false, mapaAbierto: false, duelo: null, mochilaAbierta: false, construyendo: false,
  };
  const teclas = new Set(), joy = { x: 0, y: 0 };

  // ---- HUD ----
  const pendientesEn = (lugar) => misiones.filter((m) => (interiores[m.lugar] ? m.lugar : "plaza") === lugar && !hechas.has(m.id)).length;
  function toast(texto, ms = 2800) { const t = q(".m-toast"); t.textContent = texto; t.classList.remove("oculto"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add("oculto"), ms); temporizadores.add(toast.h); }
  function mostrarLugar(esc) { const l = q(".m-lugar"); l.textContent = `${esc.icono} ${esc.nombre}`; l.classList.add("ver"); clearTimeout(mostrarLugar.h); mostrarLugar.h = setTimeout(() => l.classList.remove("ver"), 2400); temporizadores.add(mostrarLugar.h); }
  function posicionarMini() { const h = q(".m-hud").getBoundingClientRect(); mini.style.top = Math.round(h.bottom - raiz.getBoundingClientRect().top + 6) + "px"; q(".m-lugar").style.top = Math.round(h.bottom - raiz.getBoundingClientRect().top + (estado.escena.exterior ? 6 : 6)) + "px"; }
  const temaMusical = (esc) => (esc.musica ? esc.musica : naturales.includes(esc) ? esc.id : esc.exterior ? "exterior" : "interior");
  const totalEstrellas = () => exterior.estrellas.length + naturales.filter((n) => zonas[n.zona] && zonas[n.zona].desbloqueada).reduce((a, n) => a + n.estrellas.length, 0);
  function actualizarHud() {
    q(".h-xp").textContent = estado.xp; q(".h-oro").textContent = estado.oro; { const cv = q(".m-vida"); if (estado.vida == null) cv.classList.add("oculto"); else { cv.classList.remove("oculto"); q(".h-vida").textContent = estado.vida; cv.classList.toggle("baja", estado.vida <= 30); } } const disp = disponibles(); q(".h-mis").textContent = `${disp.filter((m) => hechas.has(m.id)).length}/${disp.length}`; q(".h-est").textContent = `${estado.est}/${totalEstrellas()}`;
    posicionarMini();
  }
  function ajustarLienzo() {
    const r = raiz.getBoundingClientRect();
    SCALE = Math.max(1, Math.round(Math.min(r.width, r.height) / 360)); LW = Math.max(160, Math.ceil(r.width / SCALE)); LH = Math.max(120, Math.ceil(r.height / SCALE));
    cv.width = LW; cv.height = LH; ctx.imageSmoothingEnabled = false; mini.style.width = r.width < 520 ? "92px" : "128px"; posicionarMini();
  }
  const aviso = (texto, color) => estado.avisos.push({ texto, color: color || "#fff", t: 0 });

  // ---- cambio de escena (entrar y salir de los edificios) ----
  function cambiarEscena(esc, x, y) {
    if (estado.cambiando) return; estado.cambiando = true; teclas.clear(); joy.x = joy.y = 0;
    const f = q(".m-fundido"); f.classList.add("ver");
    espera(() => {
      estado.escena = esc; estado.x = x; estado.y = y; estado.comp = { x, y };
      mini.classList.toggle("oculto", !esc.exterior); q(".b-construir").classList.toggle("oculto", !(PC && esc === parcela)); if (estado.construyendo) cerrarConstruir(); mostrarLugar(esc); snd.musica(temaMusical(esc)); posicionarMini();
      f.classList.remove("ver"); espera(() => { estado.cambiando = false; }, 200);
    }, 200);
  }
  const entrarEdificio = (e) => { snd.puerta(); cambiarEscena(interiores[e.id], interiores[e.id].spawn.x, interiores[e.id].spawn.y); };
  const irAZona = (esc) => { snd.puerta(); cambiarEscena(esc, esc.spawn.x, esc.spawn.y); };
  // cada zona se conecta con la anterior: el portón de la anterior lleva a esta, y la salida oeste de esta vuelve al portón
  naturales.forEach((nat) => {
    const previa = escenaDeZona[ZONAS.find((z) => z.key === nat.zona).previa], p = previa.portones.find((g) => g.zona === nat.zona);
    previa.salidas.push({ x: p.disparador.x, y: p.disparador.y, w: p.disparador.w, h: p.disparador.h, activa: () => p.abierto, accion: () => irAZona(nat) });
    nat.salidas.find((s) => s.volver).accion = () => { snd.puerta(); cambiarEscena(previa, p.retorno.x, p.retorno.y); };
  });
  const salirDeEdificio = () => { const e = exterior.edificios.find((b) => b.id === estado.escena.edificioId); snd.puerta(); cambiarEscena(exterior, e.puerta.x, e.puerta.y + 26); };

  // ---- diálogos ----
  function cabecera(n, titulo) {
    const foto = n.clave && sprites[n.clave] ? `<img class="m-avatar" src="${sprites[n.clave].dirs.south}" alt="">` : `<span class="m-emo">${html(n.emoji || "💬")}</span>`;
    return `<div class="m-cab">${foto}<div><div class="m-quien">${html(n.nombre)}</div>${titulo ? `<div class="m-titulo">${html(titulo)}</div>` : ""}</div><button class="m-cerrar" data-a="cerrar" aria-label="Cerrar">✕</button></div>`;
  }
  function abrirTarjeta(htmlInterno) {
    const d = q(".m-dialogo"); d.classList.remove("oculto"); teclas.clear(); joy.x = joy.y = 0;
    d.innerHTML = `<div class="m-tarjeta">${htmlInterno}</div>`;
    // Evita el "clic fantasma": el botón 💬 actúa al apoyar el dedo, y el clic que sigue caería sobre el primer botón del diálogo
    // (que aparece en el mismo lugar). Durante 0,4 s el diálogo ignora toques; el teclado no se ve afectado.
    d.style.pointerEvents = "none"; clearTimeout(d._relojToque); d._relojToque = setTimeout(() => { d.style.pointerEvents = ""; }, 400);
    d.querySelectorAll('[data-a="cerrar"]').forEach((b) => (b.onclick = cerrarDialogo));
    return d;
  }
  function cerrarDialogo() {
    if (estado.dialogo && estado.dialogo.hablando) estado.dialogo.hablando = false;
    estado.dialogo = null; estado.respondiendo = false; q(".m-dialogo").classList.add("oculto"); cv.focus();
    if (disponibles().length && disponibles().every((m) => hechas.has(m.id)) && !estado.terminado) {
      estado.terminado = true; q(".m-fin-texto").textContent = (Object.values(zonas).some((z) => !z.desbloqueada) ? "Completaste todas las misiones disponibles por ahora; irán apareciendo más cuando se abran nuevas zonas. " : "") + `En esta visita ganaste ${estado.ganado.xp} XP y ${estado.ganado.oro} monedas.` + (op.modoPrueba ? " (Modo prueba: no se guardó nada.)" : " Todo ya quedó sumado a tu progreso de CÓDICE."); q(".m-fin").classList.remove("oculto"); snd.bien();
    }
  }
  function abrirCharla(n) {
    estado.dialogo = n; n.hablando = true; snd.hablar();
    const rum = SEC ? rumoresPendientes(SEC.lista, [...hallados]) : [], rr0 = op.rngDuelo || Math.random, rumor = rum.length && rr0() < 0.6 ? rum[Math.floor(rr0() * rum.length)] : null;
    const d = abrirTarjeta(`${cabecera(n, "Vecino de la aldea")}<p class="m-texto">${html(n.frase)}</p>${rumor ? `<p class="m-texto" data-rumor="${html(String(rumor.id))}">🕵️ <i>Rumor:</i> ${html(rumor.texto)}</p>` : ""}<button class="m-ok" data-a="cerrar">¡Gracias!</button>`);
    d.querySelectorAll('[data-a="cerrar"]').forEach((b) => (b.onclick = cerrarDialogo));
  }
  // ---- duelos con los Guardianes: batalla de preguntas; al ganar por primera vez, se gana la insignia de la zona ----
  const dueloEl = q(".m-duelo");
  const zonaDe = (clave) => ZONAS.find((z) => z.key === clave);
  const poolDeZona = (clave) => armarPool(misiones.filter((m) => zonaDeMision(m) === clave), (D && D.bancos && D.bancos[clave]) || []);
  const ocultarDialogo = () => { if (estado.dialogo && estado.dialogo.hablando) estado.dialogo.hablando = false; estado.dialogo = null; q(".m-dialogo").classList.add("oculto"); };
  function abrirGuardian(n) {
    estado.dialogo = n; n.hablando = true; snd.hablar();
    const z = zonaDe(n.zona), tiene = insignias.has(n.zona), pool = poolDeZona(n.zona), espera = tiene ? 0 : esperaRestanteMin(esperaHasta[n.zona]);
    let cuerpo, botones = "";
    if (pool.length < D.aciertos) cuerpo = "Todavía no estoy preparado para un duelo. ¡Vuelve más adelante!";
    else if (tiene) { cuerpo = `¡Ya tienes mi ${z.insignia.emoji} <b>${html(z.insignia.nombre)}</b>! ¿Quieres practicar? (no da premio)`; botones = '<button class="m-ok" data-a="duelo-practica">🏋️ Practicar</button>'; }
    else if (espera > 0) cuerpo = `Aún estás recuperando fuerzas. Vuelve a retarme en <b>${espera} min</b>.`;
    else {
      cuerpo = `${html(z.guardian.reto)}<br><br>Para vencerme debes acertar <b>${D.aciertos}</b> preguntas antes de perder tus <b>${D.vidas}</b> corazones ❤️.<br>Premio: ${z.insignia.emoji} <b>${html(z.insignia.nombre)}</b>${D.premio.xp || D.premio.oro ? ` · +${D.premio.xp} XP · +${D.premio.oro} 🪙` : ""}`;
      botones = '<button class="m-ok" data-a="duelo">⚔️ ¡Aceptar el duelo!</button>';
    }
    const d = abrirTarjeta(`${cabecera(n, n.titulo)}<p class="m-texto">${cuerpo}</p>${botones}<button class="m-ok" data-a="cerrar" style="${botones ? "background:var(--borde);color:inherit;margin-top:6px" : ""}">${botones ? "Ahora no" : "Entendido"}</button>`);
    d.querySelectorAll('[data-a="cerrar"]').forEach((b) => (b.onclick = cerrarDialogo));
    const bd = d.querySelector('[data-a="duelo"]'); if (bd) bd.onclick = () => iniciarDuelo(n, false);
    const bp = d.querySelector('[data-a="duelo-practica"]'); if (bp) bp.onclick = () => iniciarDuelo(n, true);
  }
  function iniciarDuelo(n, practica) {
    const d = crearDuelo({ pool: poolDeZona(n.zona), aciertos: D.aciertos, vidas: D.vidas, rand: op.rngDuelo || Math.random });
    if (d.imposible) { toast("Todavía no hay preguntas suficientes para este duelo.", 3200); return; }
    ocultarDialogo(); estado.duelo = { n, d, practica, bloqueado: false }; teclas.clear(); joy.x = joy.y = 0;
    snd.musica("duelo"); renderDuelo();
  }
  function barrasDuelo() {
    const E = estado.duelo, pr = E.d.progreso();
    const seg = dueloEl.querySelector(".m-d-seg"), cor = dueloEl.querySelector(".m-d-cor");
    if (seg) seg.innerHTML = Array.from({ length: pr.necesarios }, (_, i) => `<i class="${i < pr.necesarios - pr.aciertos ? "" : "vacio"}"></i>`).join("");
    if (cor) cor.textContent = "❤️".repeat(pr.vidasRestantes) + "🖤".repeat(pr.corazones - pr.vidasRestantes);
  }
  function renderDuelo() {
    const E = estado.duelo, d = E.d, z = zonaDe(E.n.zona), pr = d.progreso(), p = d.actual();
    const ops = p.opciones.map((o, i) => `<button class="m-d-op" data-i="${i}">${i + 1}. ${html(o)}</button>`).join("");
    dueloEl.innerHTML = `<div class="m-d-caja">
      <div class="m-d-arena">
        <div class="m-d-luchador" data-lado="yo"><img src="${sprites[claveJugador].dirs.north}" alt=""><div class="m-d-nombre">${html(estado.nombre)}</div><div class="m-d-cor"></div></div>
        <div class="m-d-vs">⚔️</div>
        <div class="m-d-luchador" data-lado="rival"><img src="${sprites[E.n.clave].dirs.south}" alt=""><div class="m-d-nombre">${html(E.n.nombre)}</div><div class="m-d-sub">${E.batalla ? `🏰 ${html(E.batalla.reino.nombre)} · ${html(nombreCortoProvincia(E.batalla.prov))}` : E.reto ? `☠️ Retador · si pierdes: −${danioPrevisto()} ❤️` : `${z.insignia.emoji} ${html(z.insignia.nombre)}${E.practica ? " · práctica" : ""}`}</div><div class="m-d-seg" title="Maestría del guardián"></div></div>
      </div>
      <div class="m-d-preg"><div class="m-d-num">Pregunta ${pr.numero}</div>${html(p.texto)}</div>
      ${E.reto && R.tiempo > 0 ? '<div class="m-d-tiempo"><i></i></div>' : ""}
      <div class="m-d-ops">${ops}</div><div class="m-d-fb"></div>
      <div class="m-d-pie"><button class="m-d-btn sec" data-a="rendirse">🏳️ Rendirme</button><button class="m-d-btn oculto" data-a="siguiente">Siguiente ▶</button></div></div>`;
    dueloEl.classList.remove("oculto"); barrasDuelo();
    clearTimeout(E.reloj);
    if (E.reto && R.tiempo > 0) {                                                       // cuenta regresiva: si se acaba, cuenta como error
      const barra = dueloEl.querySelector(".m-d-tiempo i"); barra.getBoundingClientRect(); barra.style.transition = `width ${R.tiempo}s linear`; barra.style.width = "0%";
      E.reloj = setTimeout(() => { if (estado.duelo === E && !E.bloqueado) contestarDuelo(-1); }, R.tiempo * 1000); temporizadores.add(E.reloj);
    }
    dueloEl.querySelectorAll(".m-d-op").forEach((b) => (b.onclick = () => contestarDuelo(Number(b.dataset.i))));
    dueloEl.querySelector('[data-a="rendirse"]').onclick = () => { if (E.bloqueado) return; E.d.rendirse(); terminarDuelo(); };
    dueloEl.querySelector('[data-a="siguiente"]').onclick = siguienteDuelo;
  }
  function contestarDuelo(i) {
    const E = estado.duelo; if (!E || E.bloqueado || E.d.progreso().fin) return;
    clearTimeout(E.reloj); E.bloqueado = true; const r = E.d.responder(i);
    dueloEl.querySelectorAll(".m-d-op").forEach((b, k) => { b.disabled = true; if (k === r.correcta) b.classList.add("bien"); else if (k === i) b.classList.add("mal"); });
    const fb = dueloEl.querySelector(".m-d-fb"), lado = dueloEl.querySelector(`[data-lado="${r.acierto ? "rival" : "yo"}"]`);
    if (r.acierto) { snd.golpe(); fb.textContent = "💥 ¡Golpe certero!" + (r.retro ? " " + r.retro : ""); }
    else { snd.mal(); fb.textContent = (i === -1 ? "⏱️ ¡Se acabó el tiempo!" : "💔 Fallaste.") + (r.pista && !E.reto ? " " + r.pista : ""); }   // los retos no dan pistas
    if (lado) lado.classList.add("golpeado"); barrasDuelo();
    const sig = dueloEl.querySelector('[data-a="siguiente"]'); sig.textContent = r.fin ? "Ver el resultado ▶" : "Siguiente ▶"; sig.classList.remove("oculto"); sig.focus();
  }
  function siguienteDuelo() { const E = estado.duelo; if (!E) return; if (E.d.progreso().fin) terminarDuelo(); else { E.bloqueado = false; renderDuelo(); } }
  function pantallaFinalDuelo(icono, titulo, texto) {
    dueloEl.innerHTML = `<div class="m-d-caja"><div class="m-d-fin"><div class="grande">${icono}</div><h3>${html(titulo)}</h3><p>${texto}</p><button class="m-d-btn" data-a="cerrar-duelo">Volver al juego</button></div></div>`;
    const b = dueloEl.querySelector('[data-a="cerrar-duelo"]'); b.onclick = cerrarDuelo; b.focus();
  }
  async function terminarDuelo() {
    const E = estado.duelo; if (!E) return; clearTimeout(E.reloj); E.bloqueado = true;
    if (E.reto) return terminarReto(E);
    if (E.batalla) return terminarBatalla(E);
    const pr = E.d.progreso(), gano = pr.fin === "gana", z = zonaDe(E.n.zona);
    pantallaFinalDuelo("⏳", "Un momento…", "Guardando el resultado del duelo…");
    let r = null, fallo = false;
    if (!E.practica) {
      try { r = op.modoPrueba || !op.alDuelo ? { ok: true, local: true, xp: D.premio.xp, oro: D.premio.oro } : await op.alDuelo({ zona: E.n.zona, ganado: gano, aciertos: pr.aciertos, errores: pr.errores }); }
      catch (e) { fallo = true; }
    }
    if (estado.duelo !== E) return;                       // se salió del juego mientras tanto
    const marcador = `Acertaste ${pr.aciertos} de ${pr.necesarios} y te quedaron ${pr.vidasRestantes} ❤️.`;
    if (fallo) { snd.mal(); pantallaFinalDuelo("⚠️", "No se pudo guardar", `${gano ? "¡Le ganaste al guardián, pero" : "El duelo terminó y"} no se pudo guardar el resultado${gano ? ": la insignia no se otorgó" : ""}. Inténtalo de nuevo en un momento.`); return; }
    if (gano && (E.practica || (r && r.yaTenia))) { snd.bien(); pantallaFinalDuelo("🏆", "¡Victoria!", `${marcador}<br>${E.practica ? "Fue una práctica: no hay premio nuevo." : "Ya tenías esta insignia: no hay premio nuevo."}`); return; }
    if (gano) {
      const abiertosAntes = new Set(conPortones.flatMap((e) => e.portones).filter((p) => p.abierto).map((p) => p.zona));
      insignias.add(E.n.zona); estado.xp += r.xp || 0; estado.oro += r.oro || 0; estado.ganado.xp += r.xp || 0; estado.ganado.oro += r.oro || 0; aporteComarca(r.comarca);
      recalcularZonas(); actualizarHud(); snd.fanfarria();
      const nuevos = conPortones.flatMap((e) => e.portones).filter((p) => p.abierto && !abiertosAntes.has(p.zona)).map((p) => p.nombre.charAt(0).toLowerCase() + p.nombre.slice(1));
      pantallaFinalDuelo(z.insignia.emoji, `¡Ganaste la ${z.insignia.nombre}!`, `${marcador}<br>🎁 +${r.xp || 0} XP · +${r.oro || 0} 🪙${op.modoPrueba ? " · 🧪 modo prueba (no se guarda)" : ""}${nuevos.length ? `<br>🔓 ¡Se abrió el ${html(nuevos.join(" y el "))}!` : ""}`);
      return;
    }
    snd.derrota(); if (!E.practica && D.esperaMin > 0) esperaHasta[E.n.zona] = Date.now() + D.esperaMin * 60000;
    pantallaFinalDuelo("💔", `${E.n.nombre} resistió`, `${marcador}<br>${!E.practica && D.esperaMin > 0 ? `Puedes volver a intentarlo en ${D.esperaMin} min. ` : "¡Puedes volver a intentarlo cuando quieras! "}Repasa las misiones de la zona: ahí está lo que te pregunto.`);
  }
  function cerrarDuelo() { if (estado.duelo) clearTimeout(estado.duelo.reloj); estado.duelo = null; dueloEl.classList.add("oculto"); dueloEl.innerHTML = ""; snd.musica(temaMusical(estado.escena)); cv.focus(); }
  function manejarTeclaDuelo(k) {
    const n = Number(k); if (n >= 1 && n <= 6) { const b = dueloEl.querySelector(`.m-d-op[data-i="${n - 1}"]`); if (b && !b.disabled) b.click(); return; }
    if (k === "Enter" || k === " ") { const sig = dueloEl.querySelector('[data-a="siguiente"]:not(.oculto)'), fin = dueloEl.querySelector('[data-a="cerrar-duelo"]'); if (sig) sig.click(); else if (fin) fin.click(); }
  }

  // ---- retadores: te cortan el paso, te retan a un duelo difícil y, si pierdes, te quitan vida ----
  const ahoraMs = () => Date.now();
  const _poolReto = {};
  const poolDeZonaReto = (clave) => _poolReto[clave] || (_poolReto[clave] = (() => { const banco = (R && R.bancos && R.bancos[clave]) || []; return armarPool(banco.length ? [] : misiones.filter((m) => zonaDeMision(m) === clave), banco); })()); // con banco propio, solo salen sus preguntas
  const danioPrevisto = () => Math.min(R.danio, Math.max(0, (estado.vida == null ? R.danio + R.vidaMin : estado.vida) - R.vidaMin)); // nunca por debajo de la vida mínima
  const heridoParaRetos = () => estado.vida != null && estado.vida <= R.vidaMin;
  const puedeRetar = (n) => !!R && poolDeZonaReto(n.zona).length >= R.aciertos && !heridoParaRetos() && ahoraMs() >= (esperaReto[n.id] || 0);
  function flashDanio() { raiz.classList.remove("danio"); void raiz.offsetWidth; raiz.classList.add("danio"); espera(() => raiz.classList.remove("danio"), 800); }
  function abrirRetador(n, emboscada) {
    estado.dialogo = n; n.hablando = true; n.ignorarHasta = ahoraMs() + 25000; if (emboscada) snd.mal(); else snd.hablar(); // si lo cierra, no vuelve a cortarle el paso por un rato
    const esp = esperaRestanteMin(esperaReto[n.id]);
    let cuerpo, botones = "";
    if (poolDeZonaReto(n.zona).length < R.aciertos) cuerpo = `${html(n.frase)}<br><br>…pero hoy no tengo preguntas preparadas. ¡Sigue tu camino!`;
    else if (heridoParaRetos()) cuerpo = "Te ves muy herido… no es honor pelear así. Descansa en la 🛏️ Posada y vuelve cuando estés mejor.";
    else if (esp > 0) cuerpo = `Aún me estoy recuperando de tu última visita. Vuelve en <b>${esp} min</b>.`;
    else {
      cuerpo = `${html(n.frase)}<br><br>Debes acertar <b>${R.aciertos}</b> preguntas${R.tiempo ? ` (¡<b>${R.tiempo} s</b> por pregunta, sin pistas!)` : " (sin pistas)"} y solo puedes fallar <b>${R.vidas - 1}</b>.<br>☠️ Si pierdes: <b>−${danioPrevisto()} ❤️</b>. Si ganas: +${R.premio.xp} XP · +${R.premio.oro} 🪙 y me voy.`;
      botones = '<button class="m-ok" data-a="reto">⚔️ ¡Aceptar el reto!</button>';
    }
    const d = abrirTarjeta(`${cabecera(n, "☠️ Retador")}<p class="m-texto">${cuerpo}</p>${botones}<button class="m-ok" data-a="cerrar" style="${botones ? "background:var(--borde);color:inherit;margin-top:6px" : ""}">${botones ? "🏃 Huir" : "Entendido"}</button>`);
    d.querySelectorAll('[data-a="cerrar"]').forEach((b) => (b.onclick = cerrarDialogo));
    const br = d.querySelector('[data-a="reto"]'); if (br) br.onclick = () => iniciarReto(n);
  }
  function iniciarReto(n) {
    const d = crearDuelo({ pool: poolDeZonaReto(n.zona), aciertos: R.aciertos, vidas: R.vidas, rand: op.rngDuelo || Math.random });
    if (d.imposible) { toast("Este retador todavía no tiene preguntas.", 3200); return; }
    ocultarDialogo(); estado.duelo = { n, d, practica: false, reto: true, bloqueado: false }; teclas.clear(); joy.x = joy.y = 0;
    snd.musica("duelo"); renderDuelo();
  }
  async function terminarReto(E) {
    const n = E.n, pr = E.d.progreso(), gano = pr.fin === "gana", esc = estado.escena;
    pantallaFinalDuelo("⏳", "Un momento…", "Guardando el resultado…");
    let r = null, fallo = false;
    try {
      if (op.modoPrueba || !op.alReto) { const dn = gano ? 0 : danioPrevisto(); r = { ok: true, local: true, danio: dn, vida: estado.vida == null ? null : estado.vida - dn, xp: R.premio.xp, oro: R.premio.oro }; }
      else r = await op.alReto({ enemigo: n.id, zona: n.zona, ganado: gano, aciertos: pr.aciertos, errores: pr.errores });
    } catch (e) { fallo = true; }
    if (estado.duelo !== E) return;
    const marcador = `Acertaste ${pr.aciertos} de ${pr.necesarios}.`;
    if (fallo) { snd.mal(); pantallaFinalDuelo("⚠️", "No se pudo guardar", `No se pudo guardar el resultado${gano ? ": no se entregó el premio" : ", pero tu vida NO cambió"}. Inténtalo de nuevo en un momento.`); return; }
    if (gano) {
      if (r.yaTenia) { snd.bien(); pantallaFinalDuelo("🏆", "¡Victoria!", `${marcador}<br>Ya habías derrotado a este retador: no hay premio nuevo.`); }
      else {
        estado.xp += r.xp || 0; estado.oro += r.oro || 0; estado.ganado.xp += r.xp || 0; estado.ganado.oro += r.oro || 0; retosGanados.add(n.id); aporteComarca(r.comarca);
        const i = esc.npcs.indexOf(n); if (i >= 0) esc.npcs.splice(i, 1); snd.fanfarria();
        pantallaFinalDuelo("🏆", `¡Derrotaste a ${n.nombre}!`, `${marcador}<br>🎁 +${r.xp || 0} XP · +${r.oro || 0} 🪙${op.modoPrueba ? " · 🧪 modo prueba (no se guarda)" : ""}<br>El retador huye del sendero.`);
      }
    } else {
      esperaReto[n.id] = ahoraMs() + (R.espera || 0) * 60000;
      if (typeof r.vida === "number") estado.vida = r.vida;
      if (r.danio > 0) { flashDanio(); aviso(`−${r.danio} ❤️`, "#fca5a5"); }
      snd.derrota();
      pantallaFinalDuelo("💔", `${n.nombre} te venció`, `${marcador}<br>${r.danio > 0 ? `☠️ Perdiste <b>${r.danio} ❤️</b>.` : "Esta vez no te quitó vida."} ${estado.vida != null ? `Tu vida: <b>${estado.vida}/${VIDA_MAX}</b>. ` : ""}Puedes recuperarla en la 🛏️ Posada.${R.espera ? ` Vuelve a intentarlo en ${R.espera} min.` : ""}${op.modoPrueba ? " 🧪 modo prueba (no se guarda)" : ""}`);
    }
    actualizarHud();
  }

  // ---- la posada: se recupera vida a cambio de oro (la docente decide si está abierta, cuánto cuesta y cuánta vida da) ----
  const VIDA_MAX = op.vidaMax ?? 100;
  function planDescanso() {
    const cfg = op.posada || {};
    if (!cfg.activa) return { estado: "cerrada" };
    if (estado.vida == null) return { estado: "sin_datos" };
    const falta = Math.max(0, VIDA_MAX - estado.vida);
    if (falta === 0) return { estado: "completa" };
    const porUso = Math.max(1, cfg.vida || 1), restaura = Math.min(porUso, falta), costo = Math.ceil(((cfg.costo || 0) * restaura) / porUso); // si le falta poco, paga proporcional
    return { estado: estado.oro >= costo ? "puede" : "sin_oro", falta, restaura, costo };
  }
  function abrirPosada(n, resultado) {
    estado.dialogo = n; n.hablando = true; if (!resultado) snd.hablar();
    const pl = planDescanso(), vidaTxt = estado.vida != null ? `❤️ ${estado.vida}/${VIDA_MAX} · ` : "";
    let cuerpo, boton = "";
    if (pl.estado === "cerrada") cuerpo = "La posada está cerrada por ahora. ¡Vuelve pronto, viajero!";
    else if (pl.estado === "completa") cuerpo = `¡Te ves en plena forma! (❤️ ${estado.vida}/${VIDA_MAX}). No necesitas descansar.`;
    else if (pl.estado === "sin_oro") cuerpo = `${vidaTxt}🪙 ${estado.oro}<br>Descansar cuesta <b>${pl.costo} 🪙</b> y te devuelve <b>+${pl.restaura} ❤️</b>, pero no te alcanza el oro. ¡Completa misiones para ganar más!`;
    else if (pl.estado === "sin_datos") { cuerpo = `🪙 ${estado.oro}<br>Aquí se recupera la vida a cambio de oro. ¿Quieres descansar un rato?`; boton = '<button class="m-ok" data-a="descansar">🛏️ Descansar</button>'; }
    else { cuerpo = `${vidaTxt}🪙 ${estado.oro}<br>Descansar te devuelve <b>+${pl.restaura} ❤️</b> ${pl.costo ? `por <b>${pl.costo} 🪙</b>` : "<b>¡gratis!</b>"}.`; boton = `<button class="m-ok" data-a="descansar">🛏️ Descansar (+${pl.restaura} ❤️${pl.costo ? ` · −${pl.costo} 🪙` : " · gratis"})</button>`; }
    const res = resultado ? `<div class="m-retro ${resultado.ok ? "bien" : "mal"}">${html(resultado.texto)}</div>` : "";
    const d = abrirTarjeta(`${cabecera(n, "Posadera")}<p class="m-texto">${resultado ? "" : "¡Bienvenido a la Posada del Descanso! "}${cuerpo}</p>${res}${boton}<button class="m-ok" data-a="cerrar" style="${boton ? "background:var(--borde);color:inherit;margin-top:6px" : ""}">${boton ? "Ahora no" : "Entendido"}</button>`);
    d.querySelectorAll('[data-a="cerrar"]').forEach((b) => (b.onclick = cerrarDialogo));
    const bd = d.querySelector('[data-a="descansar"]'); if (bd) bd.onclick = () => descansar(n, bd);
  }
  async function descansar(n, boton) {
    if (estado.descansando) return;
    estado.descansando = true; boton.disabled = true; boton.textContent = "Descansando…";
    let resultado;
    try {
      let r;
      if (op.modoPrueba || !op.alDescansar) { const pl = planDescanso(); r = { ok: true, prueba: true, restaurado: pl.restaura || 0, costo: pl.costo || 0, vida: Math.min(VIDA_MAX, (estado.vida ?? 0) + (pl.restaura || 0)), monedas: estado.oro - (pl.costo || 0) }; }
      else r = await op.alDescansar();
      if (typeof r.vida === "number") estado.vida = r.vida;
      if (typeof r.monedas === "number") estado.oro = r.monedas;
      actualizarHud();
      if (r.ok) { snd.bien(); resultado = { ok: true, texto: `😴 ¡Descansaste! Recuperaste ${r.restaurado} ❤️ ${r.costo ? `(−${r.costo} 🪙)` : "(gratis)"}. Ahora tienes ${r.vida}/${VIDA_MAX}.${r.prueba ? " · 🧪 modo prueba (no se guarda)" : ""}` }; }
      else { snd.mal(); resultado = { ok: false, texto: r.mensaje || "No se pudo descansar ahora." }; }
    } catch (e) { snd.mal(); resultado = { ok: false, texto: "No se pudo guardar el descanso. Inténtalo de nuevo en un momento." }; }
    estado.descansando = false;
    if (estado.dialogo === n) abrirPosada(n, resultado); else toast(resultado.texto, 3600); // si cerró la ventana mientras tanto, solo se avisa
  }
  function abrirGuardia(n) {
    estado.dialogo = n; n.hablando = true; snd.hablar();
    const z = zonas[n.porton.zona], zd = ZONAS.find((x) => x.key === n.porton.zona), zp = ZONAS.find((x) => x.key === zd.previa), lineas = [];
    const FRASE_PASO = { bosque: "Cuidado con las ramas bajas… y no pierdas la curiosidad.", montana: "El sendero es empinado: ve con calma y no te rindas.", lago: "Allá el agua está en calma… respira y reflexiona." };
    if (z.desbloqueada) lineas.push(`¡Adelante! El ${n.porton.nombre.charAt(0).toLowerCase() + n.porton.nombre.slice(1)} está abierto. ${FRASE_PASO[zd.key] || ""}`.trim());
    else {
      if (!z.abierta) lineas.push("Tu docente todavía no abrió este camino para tu curso.");
      if (!z.cumplido) lineas.push(`Para pasar necesitas completar ${z.requeridas} ${z.requeridas === 1 ? "misión" : "misiones"} ${zp.de}. Llevas ${z.hechasPrevia} de ${z.requeridas}.`);

      if (z.exigeInsignia && !z.insigniaOk) lineas.push(`Necesitas la ${zp.insignia.emoji} ${zp.insignia.nombre}: derrota a ${zp.guardian.nombre}, ${zp.guardian.titulo}.`);
      if (z.cumplido && z.insigniaOk && !z.abierta) lineas.push("¡Ya cumpliste lo que se pide! Solo falta que tu docente abra el camino.");
    }
    const barra = !z.desbloqueada && !z.cumplido && z.requeridas > 0 ? `<div class="m-barra"><i style="width:${Math.round((z.hechasPrevia / z.requeridas) * 100)}%"></i></div>` : "";
    const d = abrirTarjeta(`${cabecera(n, zd.guardia)}<p class="m-texto">${lineas.map(html).join(" ")}</p>${barra}<button class="m-ok" data-a="cerrar">Entendido</button>`);
    d.querySelectorAll('[data-a="cerrar"]').forEach((b) => (b.onclick = cerrarDialogo));
  }
  function abrirMision(n) {
    const m = n.mision, hecha = hechas.has(m.id); estado.dialogo = n; n.hablando = true; snd.hablar();
    if (hecha) {
      abrirTarjeta(`${cabecera(n, m.titulo + " · ✅ completada")}<p class="m-texto">¡Ya completaste esta misión! Gracias por tu ayuda. Sigue explorando: todavía hay más por descubrir.</p><button class="m-ok" data-a="cerrar">Seguir</button>`);
      return;
    }
    const d = abrirTarjeta(`${cabecera(n, "🎯 " + m.titulo)}<p class="m-texto">${html(m.texto)}</p><div class="m-ops">${barajar((m.opciones || []).map((o, i) => i), op.rngDuelo || Math.random).map((i, pos) => `<button class="m-opcion" data-i="${i}">${pos + 1}. ${html(m.opciones[i])}</button>`).join("")}</div><div class="m-retro-caja"></div>`);
    d.querySelectorAll(".m-opcion").forEach((b) => (b.onclick = () => responder(n, Number(b.dataset.i), b)));
  }
  async function responder(n, i, boton) {
    const m = n.mision, caja = q(".m-retro-caja"); if (estado.respondiendo) return;
    if (i !== m.correcta) { boton.classList.add("mal"); boton.disabled = true; caja.innerHTML = `<div class="m-retro mal">No es esa 🤔 ${html(m.pista || "Piénsalo otra vez.")}</div>`; snd.mal(); return; }
    estado.respondiendo = true; q(".m-ops").querySelectorAll(".m-opcion").forEach((b) => (b.disabled = true)); boton.classList.add("bien");
    caja.innerHTML = `<div class="m-retro bien">⏳ Guardando tu respuesta…</div>`;
    let r; try { r = await op.alCompletar(m); } catch (e) { r = { ok: false, mensaje: e && e.message }; }
    estado.respondiendo = false; if (!vivo) return;
    if (!r || r.ok === false) { // no se pudo guardar: se puede intentar de nuevo, y NO se marca como hecha
      q(".m-ops").querySelectorAll(".m-opcion").forEach((b) => { b.disabled = false; b.classList.remove("bien"); });
      caja.innerHTML = `<div class="m-retro mal">No se pudo guardar tu premio: ${html((r && r.mensaje) || "intenta de nuevo")}. Puedes volver a tocar la respuesta.</div>`; snd.mal(); return;
    }
    hechas.add(m.id); recalcularZonas();
    if (!r.yaEstaba) {
      if (r.xp != null) estado.xp = r.xp; else estado.xp += m.xp || 0;
      if (r.oro != null) estado.oro = r.oro; else estado.oro += m.oro || 0;
      estado.ganado.xp += m.xp || 0; estado.ganado.oro += m.oro || 0; aviso(`+${m.xp || 0} XP`, "#fde68a"); aporteComarca(r.comarca);
    }
    actualizarHud(); snd.bien();
    caja.innerHTML = `<div class="m-retro bien">${html(m.retro || "¡Muy bien!")}</div><div class="m-premio">${r.yaEstaba ? "Ya tenías esta misión registrada ✅" : `🎁 +${m.xp || 0} XP · +${m.oro || 0} 🪙`}${op.modoPrueba ? " · 🧪 modo prueba (no se guarda)" : ""}</div><button class="m-ok" data-a="cerrar">¡Genial!</button>`;
    caja.querySelector('[data-a="cerrar"]').onclick = cerrarDialogo;
  }
  // Si al completar una misión se cumple el requisito (y la docente ya abrió la zona), el portón se abre en el acto.
  function recalcularZonas() {
    zonas = estadoZonas({ misiones, hechas, abiertas: zonasAbiertas, requisitos: op.zonasRequisitos || {}, insignias, exigen });
    conPortones.forEach((esc) => esc.portones.forEach((p) => {
      const estaba = p.abierto; p.abierto = !!zonas[p.zona].desbloqueada;
      if (!estaba && p.abierto) { estado.terminado = false; espera(() => { aviso("🔓", "#bbf7d0"); toast(`🔓 ¡Se abrió el ${p.nombre.charAt(0).toLowerCase() + p.nombre.slice(1)}!`, 4600); snd.estrella(); }, 350); }
    }));
  }
  // ---- el mapa del mundo: las zonas, cuáles están abiertas y qué falta para entrar ----
  function abrirMapa() {
    if (estado.dialogo || estado.cambiando || estado.duelo || estado.mochilaAbierta) return;
    estado.mapaAbierto = true; teclas.clear(); joy.x = joy.y = 0;
    const aqui = estado.escena.zona || "aldea", mapa = q(".m-mapa");
    const tarjetas = ZONAS.map((z) => {
      const e = zonas[z.key], pv = ZONAS.find((x) => x.key === z.previa) || z, total = misiones.filter((m) => zonaDeMision(m) === z.key).length, hechasZ = misiones.filter((m) => zonaDeMision(m) === z.key && hechas.has(m.id)).length;
      let estadoTxt;
      if (e.desbloqueada) estadoTxt = `🔓 Abierta · ${total ? `🎯 ${hechasZ}/${total} misiones` : "sin misiones todavía"}`;
      else if (z.previa && !zonas[z.previa].desbloqueada) estadoTxt = `🔒 Se desbloquea después de llegar ${pv.a}`;
      else if (e.abierta && e.cumplido && !e.insigniaOk) estadoTxt = `🔒 Te falta la ${pv.insignia.emoji} ${pv.insignia.nombre}: derrota a ${pv.guardian.nombre} en ${pv.corto === "la Aldea" ? "la Aldea" : pv.corto}`;
      else if (!e.abierta && e.cumplido && e.insigniaOk) estadoTxt = "🔒 Ya cumpliste el requisito · falta que tu docente abra el camino";
      else if (!e.abierta) estadoTxt = `🔒 Tu docente todavía no la abrió${e.requeridas ? ` · además, completa ${e.requeridas} misiones ${pv.de} (llevas ${e.hechasPrevia})` : ""}`;
      else estadoTxt = `🔒 Completa ${e.requeridas} ${e.requeridas === 1 ? "misión" : "misiones"} ${pv.de} para entrar (llevas ${e.hechasPrevia})`;
      if (!e.desbloqueada && e.exigeInsignia && !e.insigniaOk && !estadoTxt.includes("Te falta la")) estadoTxt += ` · y gana la ${pv.insignia.nombre} (derrota a ${pv.guardian.nombre})`;
      const insTxt = D && e.desbloqueada ? `<div class="m-z-estado">${z.insignia.emoji} ${html(z.insignia.nombre)}: ${insignias.has(z.key) ? "<b>ganada ✔</b>" : `⚔️ derrota a ${html(z.guardian.nombre)} para ganarla`}</div>` : "";
      const barra = !e.desbloqueada && e.abierta && !e.cumplido && e.requeridas > 0 ? `<div class="m-barra"><i style="width:${Math.round((e.hechasPrevia / e.requeridas) * 100)}%"></i></div>` : "";
      const viaje = e.desbloqueada && (z.key !== aqui || (z.key === "aldea" && estado.escena.edificioId)) ? `<button class="m-viaje" data-viaje="${z.key}">🧭 Viajar aquí</button>` : "";
      return `<div class="m-zona ${z.key === aqui ? "aqui" : ""}"><div class="m-z-nombre">${z.emoji} ${html(z.nombre)}${z.key === aqui ? ' <span style="color:var(--acento)">· 📍 estás aquí</span>' : ""}</div><div class="m-z-estado">${html(estadoTxt)}</div>${insTxt}${barra}${viaje}</div>`;
    }).join("");
    mapa.innerHTML = `<div class="m-tarjeta"><div class="m-cab"><span class="m-emo">🗺️</span><div><div class="m-quien">Mapa del mundo</div><div class="m-titulo">Las zonas que puedes explorar</div></div><button class="m-cerrar" data-a="cerrar" aria-label="Cerrar">✕</button></div>${tarjetas}<button class="m-ok" data-a="cerrar">Volver al juego</button></div>`;
    mapa.classList.remove("oculto"); mapa.querySelectorAll('[data-a="cerrar"]').forEach((b) => (b.onclick = cerrarMapa));
    mapa.querySelectorAll("[data-viaje]").forEach((b) => (b.onclick = () => viajarRapido(b.dataset.viaje)));
  }
  // Viaje rápido: a cualquier zona que ya esté desbloqueada (aparece en la entrada de la zona, o en la plaza si es la aldea)
  function viajarRapido(clave) {
    if (estado.cambiando || !zonas[clave] || !zonas[clave].desbloqueada) return;
    const esc = escenaDeZona[clave]; cerrarMapa(); snd.puerta(); cambiarEscena(esc, esc.spawn.x, esc.spawn.y);
  }
  function cerrarMapa() { estado.mapaAbierto = false; q(".m-mapa").classList.add("oculto"); cv.focus(); }
  function interactuar() {
    if (estado.dialogo || estado.mapaAbierto || estado.mochilaAbierta || estado.juegoAbierto || estado.comarcaAbierto || estado.duelo || estado.cambiando || !estado.activo || !estado.cercano) return;
    const n = estado.cercano;
    if (n.tipo === "puerta") entrarEdificio(n.edificio); else if (n.tipo === "guardia") abrirGuardia(n); else if (n.tipo === "posadero") abrirPosada(n); else if (n.tipo === "guardian") abrirGuardian(n); else if (n.tipo === "retador") abrirRetador(n, false); else if (n.tipo === "mision") abrirMision(n); else if (n.tipo === "aldeano") abrirCharla(n); else if (n.tipo === "recurso") abrirRecurso(n); else if (n.tipo === "juego_mesa") abrirMesa(n); else if (n.tipo === "secreto") abrirSecreto(n); else if (n.tipo === "comarca_mapa") abrirMapaComarca(); else if (n.tipo === "comarca_heraldo") abrirHeraldo(n); else if (n.tipo === "parcela_puerta") { snd.puerta(); cambiarEscena(parcela, parcela.spawn.x, parcela.spawn.y); }
  }

  // ---- recoger recursos: cada punto hace una pregunta; si se acierta, se recoge (hay un límite por día) ----
  const poolRecurso = (zona) => { const p = poolDeZona(zona); return p.length ? p : armarPool(misiones, []); };
  function tarjetaRecurso(n, cuerpo, botones) {
    const d = abrirTarjeta(`<div class="m-cab"><span class="m-emo">${ITEMS[n.item].emoji}</span><div><div class="m-quien">${html(n.nombre)}</div><div class="m-titulo">Recurso · hoy ${recogidoHoy}${RC.limite > 0 ? "/" + RC.limite : ""}</div></div><button class="m-cerrar" data-a="cerrar" aria-label="Cerrar">✕</button></div>${cuerpo}${botones || ""}`);
    d.querySelectorAll('[data-a="cerrar"]').forEach((b) => (b.onclick = cerrarDialogo)); return d;
  }
  function abrirRecurso(n) {
    if (!RC) return;
    estado.dialogo = n; n.hablando = true; snd.hablar();
    const cerrar = '<button class="m-ok" data-a="cerrar">Entendido</button>';
    if (RC.limite > 0 && recogidoHoy >= RC.limite) { tarjetaRecurso(n, `<p class="m-texto">Hoy ya recogiste todo lo que podías (<b>${RC.limite}</b>). ¡Vuelve mañana! 🌙</p>`, cerrar); return; }
    if ((inv[n.item] || 0) >= MAX_POR_ITEM) { tarjetaRecurso(n, `<p class="m-texto">Tu mochila ya tiene el máximo de ${ITEMS[n.item].nombre.toLowerCase()} (${MAX_POR_ITEM}). Fabrica algo para hacer espacio.</p>`, cerrar); return; }
    const pool = poolRecurso(n.zona);
    if (!pool.length) { tarjetaRecurso(n, '<p class="m-texto">Todavía no hay preguntas preparadas para recoger aquí.</p>', cerrar); return; }
    const rand = op.rngDuelo || Math.random, p = pool[Math.floor(rand() * pool.length)];
    const dd = crearDuelo({ pool: [p], aciertos: 1, vidas: 1, rand }), q1 = dd.actual();
    const ops = q1.opciones.map((o, i) => `<button class="m-opcion" data-i="${i}">${i + 1}. ${html(o)}</button>`).join("");
    const d = tarjetaRecurso(n, `<p class="m-texto">Para recoger ${ITEMS[n.item].emoji} responde bien esta pregunta:<br><b>${html(q1.texto)}</b></p><div class="m-caja">${ops}</div>`);
    let listo = false;
    d.querySelectorAll(".m-opcion").forEach((b) => (b.onclick = () => { if (listo) return; listo = true; responderRecurso(n, dd, Number(b.dataset.i), d); }));
  }
  async function responderRecurso(n, dd, i, d) {
    const r = dd.responder(i), caja = d.querySelector(".m-caja");
    d.querySelectorAll(".m-opcion").forEach((b, k) => { b.disabled = true; if (k === r.correcta) b.classList.add("bien"); else if (k === i) b.classList.add("mal"); });
    const fin = (clase, texto, extra) => { if (estado.dialogo !== n) return; caja.insertAdjacentHTML("beforeend", `<div class="m-retro ${clase}">${texto}</div>${extra || ""}<button class="m-ok" data-a="cerrar">Entendido</button>`); caja.querySelectorAll('[data-a="cerrar"]').forEach((b) => (b.onclick = cerrarDialogo)); };
    if (!r.acierto) {
      snd.mal(); if (RC.espera > 0) n.hastaMs = ahoraMs() + RC.espera * 60000;
      fin("mal", `Esa no era. ${r.retro ? html(r.retro) + "<br>" : ""}${RC.espera > 0 ? `El punto queda agotado <b>${RC.espera} min</b>; busca otro o vuelve luego.` : "Puedes intentarlo de nuevo."}`); return;
    }
    snd.bien();
    caja.insertAdjacentHTML("beforeend", '<div class="m-retro bien" data-c="esp">⏳ Recogiendo…</div>');
    let res;
    try {
      if (op.alRecolectar) res = await op.alRecolectar({ item: n.item, zona: n.zona });
      else { // sin base de datos (demo): se simula con las mismas reglas
        if (RC.limite > 0 && recogidoHoy >= RC.limite) res = { ok: false, limite: true };
        else { let dar = cantidadPorRecoleccion(n.item, inv, RC.cantidad); if (RC.limite > 0) dar = Math.min(dar, RC.limite - recogidoHoy); dar = Math.min(dar, MAX_POR_ITEM - (inv[n.item] || 0)); res = { ok: true, cantidad: dar, inventario: { ...inv, [n.item]: (inv[n.item] || 0) + dar }, hoy: recogidoHoy + dar }; }
      }
    } catch (e) { res = { ok: false, error: (e && e.message) || "No se pudo guardar." }; }
    const esp = caja.querySelector('[data-c="esp"]'); if (esp) esp.remove();
    if (!vivo) return;
    if (res && res.ok) {
      Object.keys(inv).forEach((k) => delete inv[k]); Object.assign(inv, res.inventario || {}); recogidoHoy = res.hoy ?? recogidoHoy + (res.cantidad || 0);
      if (RC.respawn > 0) n.hastaMs = ahoraMs() + RC.respawn * 60000;
      aviso(`+${res.cantidad} ${ITEMS[n.item].emoji}`, "#bbf7d0"); snd.estrella(); { const tt = d.querySelector(".m-titulo"); if (tt) tt.textContent = `Recurso · hoy ${recogidoHoy}${RC.limite > 0 ? "/" + RC.limite : ""}`; }
      fin("bien", `¡Correcto! Recogiste <b>+${res.cantidad} ${ITEMS[n.item].emoji} ${ITEMS[n.item].nombre.toLowerCase()}</b>.${RC.limite > 0 ? `<br>Hoy: ${recogidoHoy}/${RC.limite}` : ""}`);
    } else if (res && res.limite) { if (res.hoy != null) recogidoHoy = res.hoy; fin("mal", "¡Correcto! Pero hoy ya llegaste al límite de recolección. ¡Vuelve mañana!"); }
    else if (res && res.lleno) fin("mal", "Tu mochila ya tiene el máximo de ese recurso.");
    else fin("mal", `No se pudo recoger: ${html((res && (res.error || res.mensaje)) || "intenta de nuevo")}. No se gastó nada; responde otra vez.`);
  }

  // ---- la Comarca de Oakhaven: mapa de reinos, aportes y batallas ----
  const comarcaEl = q(".m-comarca"); let cargandoComarca = false;
  function aporteComarca(c) {
    if (!c || !COM || !(c.gp || c.fp)) return;
    const r = (COM.reinos || []).find((x) => x.id === COM.miReinoId); if (r) { r.gp = (r.gp || 0) + (c.gp || 0); r.fp = (r.fp || 0) + (c.fp || 0); }
    toast(`🏰 Tu reino recibe ${[c.gp ? `+${c.gp} GP` : "", c.fp ? `+${c.fp} FP` : ""].filter(Boolean).join(" y ")}`, 3400);
  }
  async function refrescarComarca() {
    if (!COM || !op.alComarca || op.modoPrueba) return;
    try { const nuevo = await op.alComarca(); if (nuevo && vivo) Object.assign(COM, nuevo); } catch (e) { /* se queda con lo que ya tenía */ }
  }
  function cerrarComarca() { estado.comarcaAbierto = false; comarcaEl.classList.add("oculto"); comarcaEl.innerHTML = ""; cv.focus(); }
  const miReinoCom = () => (COM && COM.reinos ? COM.reinos.find((r) => r.id === COM.miReinoId) : null);
  function htmlMapaComarca() {
    if (!COM) return '<p class="m-texto">La Sala de la Comarca está cerrada por ahora.</p>';
    if (!COM.hay) return '<p class="m-texto">Tu curso todavía no tiene una Comarca activa (o aún no tienes reino). Cuando tu docente la abra, aquí verás el mapa de los reinos. 🏰</p>';
    const ahora = ahoraMs();
    const tarjetas = resumenReinos(COM.reinos, COM.provincias, ahora).map((r) => `<div class="cm-reino ${r.id === COM.miReinoId ? "mio" : ""}" data-reino="${html(String(r.id))}"><div class="cm-cab"><span>${html(r.emoji || "🏰")}</span><span>${html(r.nombre)}${r.id === COM.miReinoId ? " · tu reino" : ""}</span><small>🏘️ ${r.provincias.length} · 🪙 ${r.gp ?? 0} GP · ⛪ ${r.fp ?? 0} FP${r.nivel_villa ? ` · Villa nv ${r.nivel_villa}` : ""}</small></div><div class="cm-provs">${r.provincias.map((p) => `<span class="cm-prov ${estaProtegida(p, ahora) ? "prot" : ""}">${p.nivel === "ciudad" ? "🏙️" : "🏘️"} ${html(nombreCortoProvincia(p))}${estaProtegida(p, ahora) ? " 🛡️" : ""}</span>`).join("") || '<span class="cm-nota">Sin provincias</span>'}</div></div>`).join("");
    const A = COM.aportes, nota = A && A.activo ? `<p class="cm-nota">⚒️ Lo que ganas en el mundo suma a tu reino: cada <b>${A.oroPorGp}</b> 🪙 = 1 GP y cada <b>${A.xpPorFp}</b> XP = 1 FP (hasta ${A.topeGp} GP y ${A.topeFp} FP al día por persona).</p>` : "";
    return `${tarjetas}${nota}`;
  }
  async function abrirMapaComarca() {
    if (estado.comarcaAbierto || cargandoComarca) return;
    cargandoComarca = true; estado.comarcaAbierto = true; teclas.clear(); joy.x = joy.y = 0;
    const marco = (cuerpo) => `<div class="m-tarjeta"><div class="m-cab"><span class="m-emo">🗺️</span><div><div class="m-quien">Mapa de la Comarca</div><div class="m-titulo">Reinos y provincias</div></div><button class="m-cerrar" data-a="cerrar" aria-label="Cerrar">✕</button></div>${cuerpo}<button class="m-ok" data-a="cerrar">Cerrar</button></div>`;
    const poner = (cuerpo) => { comarcaEl.innerHTML = marco(cuerpo); comarcaEl.classList.remove("oculto"); comarcaEl.querySelectorAll('[data-a="cerrar"]').forEach((b) => (b.onclick = cerrarComarca)); };
    poner('<p class="m-texto">⏳ Cargando el mapa…</p>');
    await refrescarComarca(); cargandoComarca = false;
    if (!vivo || !estado.comarcaAbierto) return;
    poner(htmlMapaComarca());
  }
  async function abrirHeraldo(n) {
    estado.dialogo = n; n.hablando = true; snd.hablar();
    const cab = `${cabecera(n, "Heraldo de la Comarca")}`;
    const d0 = abrirTarjeta(`${cab}<p class="m-texto">⏳ Un momento…</p>`); d0.querySelectorAll('[data-a="cerrar"]').forEach((b) => (b.onclick = cerrarDialogo));
    await refrescarComarca(); if (!vivo || estado.dialogo !== n) return;
    vistaHeraldo(n, "inicio");
  }
  function vistaHeraldo(n, vista, reino, prov) {
    const cab = cabecera(n, "Heraldo de la Comarca"), cerrar = '<button class="m-ok" data-a="cerrar" style="background:var(--borde);color:inherit;margin-top:6px">Cerrar</button>';
    let cuerpo = "", botones = "";
    const ahora = ahoraMs(), B = COM && COM.batallas;
    if (!COM) cuerpo = "La Sala de la Comarca está cerrada por ahora. ¡Vuelve pronto!";
    else if (!COM.hay) cuerpo = "Tu curso todavía no tiene una Comarca activa, o aún no tienes reino. Cuando tu docente la abra, aquí podrás ver el mapa y librar batallas.";
    else if (vista === "inicio") {
      const mi = miReinoCom(), pb = puedeBatallar({ activo: B.activo, miReinoId: COM.miReinoId, batallasHoy: COM.batallasHoy, limite: B.dia }), objetivos = reinosAtacables(COM.reinos, COM.provincias, COM.miReinoId, ahora);
      cuerpo = `¡Saludos, ${html(estado.nombre)}! Vienes de ${mi ? `${html(mi.emoji || "🏰")} <b>${html(mi.nombre)}</b>` : "tu reino"}.`;
      botones = '<button class="m-ok" data-a="mapa">🗺️ Ver el mapa de la Comarca</button>';
      if (!pb.ok) cuerpo += `<br><br>${pb.motivo === "cerrado" ? "Las batallas entre reinos están <b>cerradas</b> por ahora. Tu docente las abrirá cuando sea el momento." : pb.motivo === "limite" ? `Hoy ya libraste tus <b>${B.dia}</b> batallas. ¡Vuelve mañana!` : "Todavía no tienes reino."}`;
      else if (!objetivos.length) cuerpo += "<br><br>Por ahora no hay provincias que puedas atacar (están protegidas o los reinos no pueden quedarse sin ninguna). ¡Vuelve en un rato!";
      else { cuerpo += `<br><br>Puedes <b>atacar una provincia</b> de otro reino: responde <b>${B.aciertos}</b> preguntas antes de perder tus <b>${B.vidas}</b> corazones ❤️ y se la quitas.${B.dia > 0 ? ` Batallas hoy: ${COM.batallasHoy}/${B.dia}.` : ""}`; botones += '<button class="m-ok" data-a="retar" style="background:var(--mal)">⚔️ Retar a un reino</button>'; }
    } else if (vista === "reinos") {
      cuerpo = "¿A qué reino quieres atacar?";
      botones = reinosAtacables(COM.reinos, COM.provincias, COM.miReinoId, ahora).map((x) => `<button class="m-opcion" data-reino="${html(String(x.reino.id))}">${html(x.reino.emoji || "🏰")} ${html(x.reino.nombre)} <small>· ${x.provincias.length} provincia${x.provincias.length === 1 ? "" : "s"} atacable${x.provincias.length === 1 ? "" : "s"}</small></button>`).join("") + '<button class="m-ok" data-a="volver" style="background:var(--borde);color:inherit;margin-top:6px">◀ Volver</button>';
    } else if (vista === "provincias") {
      cuerpo = `¿Qué provincia de ${html(reino.emoji || "🏰")} <b>${html(reino.nombre)}</b> quieres conquistar?`;
      botones = reinosAtacables(COM.reinos, COM.provincias, COM.miReinoId, ahora).filter((x) => x.reino.id === reino.id).flatMap((x) => x.provincias).map((p) => `<button class="m-opcion" data-prov="${html(String(p.id))}">${p.nivel === "ciudad" ? "🏙️" : "🏘️"} ${html(nombreCortoProvincia(p))}${p.recurso ? ` <small>· ${html(p.recurso)}</small>` : ""}</button>`).join("") + '<button class="m-ok" data-a="reinos" style="background:var(--borde);color:inherit;margin-top:6px">◀ Volver</button>';
    } else if (vista === "confirmar") {
      cuerpo = `¡A la batalla! Atacas <b>${html(nombreCortoProvincia(prov))}</b>, que defiende el reino <b>${html(reino.nombre)}</b>.<br>Acierta <b>${B.aciertos}</b> preguntas antes de perder <b>${B.vidas}</b> ❤️. Si ganas, la provincia pasa a tu reino. Si pierdes, la conserva su reino (y cuenta como una de tus batallas de hoy).`;
      botones = '<button class="m-ok" data-a="pelear" style="background:var(--mal)">⚔️ ¡Atacar!</button><button class="m-ok" data-a="volver" style="background:var(--borde);color:inherit;margin-top:6px">◀ Volver</button>';
    }
    const d = abrirTarjeta(`${cab}<p class="m-texto">${cuerpo}</p>${botones}${vista === "inicio" || !COM || !COM.hay ? cerrar : ""}`);
    d.querySelectorAll('[data-a="cerrar"]').forEach((b) => (b.onclick = cerrarDialogo));
    const on = (a, f) => { const b = d.querySelector(`[data-a="${a}"]`); if (b) b.onclick = f; };
    on("mapa", () => { cerrarDialogo(); abrirMapaComarca(); }); on("retar", () => vistaHeraldo(n, "reinos")); on("volver", () => vistaHeraldo(n, "inicio")); on("reinos", () => vistaHeraldo(n, "reinos"));
    on("pelear", () => iniciarBatalla(n, reino, prov));
    d.querySelectorAll("[data-reino]").forEach((b) => (b.onclick = () => { const r = COM.reinos.find((x) => String(x.id) === b.dataset.reino); if (r) vistaHeraldo(n, "provincias", r); }));
    d.querySelectorAll("[data-prov]").forEach((b) => (b.onclick = () => { const p = COM.provincias.find((x) => String(x.id) === b.dataset.prov); if (p) vistaHeraldo(n, "confirmar", reino, p); }));
  }
  function iniciarBatalla(n, reino, prov) {
    const B = COM.batallas, d = crearDuelo({ pool: armarPool(misiones, []), aciertos: B.aciertos, vidas: B.vidas, rand: op.rngDuelo || Math.random });
    if (d.imposible) { toast("Todavía no hay preguntas suficientes para una batalla.", 3200); return; }
    ocultarDialogo(); estado.duelo = { n: { nombre: `Defensor de ${reino.nombre}`, clave: n.clave, zona: "aldea" }, d, practica: false, bloqueado: false, batalla: { reino, prov } }; teclas.clear(); joy.x = joy.y = 0;
    snd.musica("duelo"); renderDuelo();
  }
  async function terminarBatalla(E) {
    const pr = E.d.progreso(), gano = pr.fin === "gana", { reino, prov } = E.batalla, corto = nombreCortoProvincia(prov);
    pantallaFinalDuelo("⏳", "Un momento…", "Registrando la batalla…");
    let r = null, fallo = false;
    try { r = op.modoPrueba || !op.alBatalla ? { ok: true, local: true, tomada: gano } : await op.alBatalla({ provinciaId: prov.id, ganado: gano, aciertos: pr.aciertos, errores: pr.errores }); } catch (e) { fallo = true; }
    if (estado.duelo !== E) return;
    const marcador = `Acertaste ${pr.aciertos} de ${pr.necesarios} y te quedaron ${pr.vidasRestantes} ❤️.`;
    if (fallo || !r || r.ok === false) { snd.mal(); pantallaFinalDuelo("⚠️", "No se pudo registrar", `${gano ? "¡Ganaste la batalla, pero el resultado no se guardó" : "El resultado no se guardó"} (${html(String((r && r.mensaje) || "sin conexión").replace(/[.\s]+$/, ""))}). Inténtalo de nuevo en un momento.`); refrescarComarca(); return; }
    COM.batallasHoy = (COM.batallasHoy || 0) + 1;
    const mio = miReinoCom();
    if (r.tomada) {
      prov.reino_actual_id = COM.miReinoId; prov.protegida_hasta = new Date(ahoraMs() + (B0().proteccionMin || 0) * 60000).toISOString(); snd.fanfarria();
      pantallaFinalDuelo("🏰", `¡Conquistaste ${corto}!`, `${marcador}<br>Esa provincia ahora es de ${mio ? `${html(mio.emoji || "🏰")} <b>${html(mio.nombre)}</b>` : "tu reino"}.${op.modoPrueba ? " · 🧪 modo prueba (no se guarda)" : ""}`);
    } else { snd.derrota(); pantallaFinalDuelo("🛡️", `${reino.nombre} defendió su provincia`, `${marcador}<br>${html(corto)} sigue siendo de ${html(reino.nombre)}. ¡Repasa las misiones y vuelve a intentarlo!`); }
  }
  const B0 = () => (COM && COM.batallas) || {};

  // ---- misiones ocultas: se examina el objeto, se responde una pregunta y se gana el premio una vez ----
  function abrirSecreto(n) {
    const sc = n.secreto; estado.dialogo = n; n.hablando = true; snd.hablar();
    const total = SEC ? SEC.lista.length : 0;
    const d = abrirTarjeta(`<div class="m-cab"><span class="m-emo">${html(n.emoji)}</span><div><div class="m-quien">${html(sc.nombre)}</div><div class="m-titulo">🔎 Secreto · ${hallados.size}/${total} encontrados</div></div><button class="m-cerrar" data-a="cerrar" aria-label="Cerrar">✕</button></div><p class="m-texto">¡Encontraste algo escondido! Para quedártelo, responde:<br><b>${html(sc.texto)}</b></p><div class="m-ops">${barajar(sc.opciones.map((o, i) => i), op.rngDuelo || Math.random).map((i, pos) => `<button class="m-opcion" data-i="${i}">${pos + 1}. ${html(sc.opciones[i])}</button>`).join("")}</div><div class="m-retro-caja"></div>`);
    d.querySelectorAll(".m-opcion").forEach((b) => (b.onclick = () => responderSecreto(n, Number(b.dataset.i), b)));
  }
  async function responderSecreto(n, i, boton) {
    const sc = n.secreto, caja = q(".m-retro-caja"); if (estado.respondiendo || hallados.has(sc.id)) return;
    if (i !== sc.correcta) { boton.classList.add("mal"); boton.disabled = true; caja.innerHTML = '<div class="m-retro mal">No es esa 🤔 Piénsalo otra vez; el objeto sigue aquí.</div>'; snd.mal(); return; }
    estado.respondiendo = true; q(".m-ops").querySelectorAll(".m-opcion").forEach((b) => (b.disabled = true)); boton.classList.add("bien");
    caja.innerHTML = '<div class="m-retro bien">⏳ Guardando tu hallazgo…</div>';
    let r; try { r = op.modoPrueba || !op.alSecreto ? { ok: true, local: true } : await op.alSecreto({ id: sc.id }); } catch (e) { r = { ok: false, mensaje: e && e.message }; }
    estado.respondiendo = false; if (!vivo) return;
    if (!r || r.ok === false) { q(".m-ops").querySelectorAll(".m-opcion").forEach((b) => { b.disabled = false; b.classList.remove("bien"); }); caja.innerHTML = `<div class="m-retro mal">No se pudo guardar tu premio: ${html((r && r.mensaje) || "intenta de nuevo")}. Puedes volver a tocar la respuesta.</div>`; snd.mal(); return; }
    hallados.add(sc.id); n.hallado = true;
    if (!r.yaEstaba) {
      if (r.xp != null) estado.xp = r.xp; else estado.xp += sc.xp || 0;
      if (r.oro != null) estado.oro = r.oro; else estado.oro += sc.oro || 0;
      estado.ganado.xp += sc.xp || 0; estado.ganado.oro += sc.oro || 0; aviso(`+${sc.xp || 0} XP`, "#fde68a"); aporteComarca(r.comarca);
    }
    actualizarHud(); snd.fanfarria();
    caja.innerHTML = `<div class="m-retro bien">${html(sc.retro || "¡Lo encontraste!")}</div><div class="m-premio">${r.yaEstaba ? "Ya habías encontrado este secreto ✅" : `🎁 +${sc.xp || 0} XP · +${sc.oro || 0} 🪙`}${op.modoPrueba ? " · 🧪 modo prueba (no se guarda)" : ""}</div><button class="m-ok" data-a="cerrar">¡Genial!</button>`;
    caja.querySelector('[data-a="cerrar"]').onclick = cerrarDialogo;
  }

  // ---- la Casa de los Acertijos: cada mesa lista los acertijos de su tipo; al resolver uno se gana el premio (una vez) ----
  const juegoEl = q(".m-juego"); let juegoActual = null;
  function abrirMesa(n) {
    estado.dialogo = n; n.hablando = true; snd.hablar();
    const T0 = TIPOS_ACERTIJO[n.juego], lista = AC ? AC.lista.filter((a) => a.tipo === n.juego) : [];
    const cab = `<div class="m-cab"><span class="m-emo">${T0.emoji}</span><div><div class="m-quien">${html(T0.nombre)}</div><div class="m-titulo">Casa de los Acertijos</div></div><button class="m-cerrar" data-a="cerrar" aria-label="Cerrar">✕</button></div>`;
    let cuerpo;
    if (!AC) cuerpo = '<p class="m-texto">Las mesas de juego todavía no están disponibles. Pídele a tu docente que las active.</p>';
    else if (!lista.length) cuerpo = `<p class="m-texto">Aún no hay acertijos de ${html(T0.nombre.toLowerCase())} para tu curso. Tu docente los irá preparando. 🧩</p>`;
    else cuerpo = `<p class="m-texto">Elige un acertijo. Ganas premio la primera vez que lo resuelves; después puedes repetirlo por diversión.</p><div class="m-caja">${lista.map((a, i) => `<button class="m-opcion" data-id="${html(a.id)}">${hechosAc.has(a.id) ? "✅" : T0.emoji} ${html(a.titulo || T0.nombre)} <small>${hechosAc.has(a.id) ? "resuelto" : `+${a.xp || 0} XP · +${a.oro || 0} 🪙`}</small></button>`).join("")}</div>`;
    const d = abrirTarjeta(cab + cuerpo + '<button class="m-ok" data-a="cerrar" style="background:var(--borde);color:inherit">Cerrar</button>');
    d.querySelectorAll('[data-a="cerrar"]').forEach((b) => (b.onclick = cerrarDialogo));
    d.querySelectorAll("[data-id]").forEach((b) => (b.onclick = () => { const a = lista.find((x) => String(x.id) === b.dataset.id); if (a) { ocultarDialogo(); abrirJuego(a, n); } }));
  }
  function abrirJuego(a, mesa) {
    const T0 = TIPOS_ACERTIJO[a.tipo] || { nombre: "Acertijo", emoji: "🧩" };
    estado.juegoAbierto = true; teclas.clear(); joy.x = joy.y = 0;
    juegoEl.innerHTML = `<div class="m-tarjeta"><div class="m-cab"><span class="m-emo">${T0.emoji}</span><div><div class="m-quien">${html(a.titulo || T0.nombre)}</div><div class="m-titulo">${html(T0.nombre)} · ${hechosAc.has(a.id) ? "ya resuelto ✅" : `🎁 +${a.xp || 0} XP · +${a.oro || 0} 🪙`}</div></div><button class="m-cerrar" data-a="cerrar" aria-label="Cerrar">✕</button></div><div class="jg-host"></div><div class="jg-premio"></div><button class="m-ok" data-a="cerrar" style="background:var(--borde);color:inherit">Volver a la mesa</button></div>`;
    juegoEl.classList.remove("oculto");
    juegoEl.querySelectorAll('[data-a="cerrar"]').forEach((b) => (b.onclick = () => cerrarJuego(mesa)));
    juegoActual = montarJuego(juegoEl.querySelector(".jg-host"), a, { rand: op.rngDuelo || Math.random, alGanar: () => ganarAcertijo(a) });
  }
  function cerrarJuego(mesa) {
    if (juegoActual) { juegoActual.destruir(); juegoActual = null; }
    estado.juegoAbierto = false; juegoEl.classList.add("oculto"); juegoEl.innerHTML = ""; cv.focus();
    if (mesa && mesa.tipo === "juego_mesa") abrirMesa(mesa);
  }
  async function ganarAcertijo(a) {
    const nota = (txt, mal) => { const p = juegoEl.querySelector(".jg-premio"); if (p) p.innerHTML = `<div class="m-retro ${mal ? "mal" : "bien"}">${txt}</div>`; };
    snd.bien();
    if (hechosAc.has(a.id)) { nota("¡Bien hecho! Ya habías ganado el premio de este acertijo."); return; }
    nota("⏳ Guardando tu premio…");
    let r; try { r = op.modoPrueba || !op.alAcertijo ? { ok: true, local: true, xp: null, oro: null } : await op.alAcertijo({ id: a.id }); } catch (e) { r = { ok: false, mensaje: e && e.message }; }
    if (!vivo) return;
    if (!r || r.ok === false) { snd.mal(); nota(`Lo resolviste, pero no se pudo guardar el premio: ${html((r && r.mensaje) || "intenta de nuevo")}. Pulsa «Otra vez» para reintentar.`, true); return; }
    hechosAc.add(a.id);
    if (!r.yaEstaba) {
      if (r.xp != null) estado.xp = r.xp; else estado.xp += a.xp || 0;
      if (r.oro != null) estado.oro = r.oro; else estado.oro += a.oro || 0;
      estado.ganado.xp += a.xp || 0; estado.ganado.oro += a.oro || 0; aviso(`+${a.xp || 0} XP`, "#fde68a"); aporteComarca(r.comarca); actualizarHud(); snd.estrella();
    }
    nota(r.yaEstaba ? "Ya tenías este acertijo registrado ✅" : `🎁 +${a.xp || 0} XP · +${a.oro || 0} 🪙${op.modoPrueba ? " · 🧪 modo prueba (no se guarda)" : ""}`);
  }

  // ---- la mochila: lo que llevas y lo que puedes fabricar ----
  const mochilaEl = q(".m-mochila"); let ocupadoMochila = false;
  function abrirMochila() {
    if (!RC || estado.dialogo || estado.cambiando || estado.duelo || estado.mapaAbierto) return;
    estado.mochilaAbierta = true; teclas.clear(); joy.x = joy.y = 0; renderMochila("mochila");
  }
  function cerrarMochila() { estado.mochilaAbierta = false; mochilaEl.classList.add("oculto"); mochilaEl.innerHTML = ""; cv.focus(); }
  function renderMochila(tab, msg) {
    const items = Object.keys(ITEMS).filter((k) => (inv[k] || 0) > 0 && ITEMS[k].tipo !== "decoracion" || (inv[k] || 0) > 0);
    let cuerpo;
    if (tab === "mochila") {
      cuerpo = items.length ? `<div class="m-inv">${items.map((k) => { const it = ITEMS[k]; return `<div class="m-slot" data-item="${k}"><span class="e">${it.emoji}</span><b>${html(it.nombre)}</b><small>× ${inv[k]}${it.desc ? "<br>" + html(it.desc) : ""}</small>${it.tipo === "consumible" ? `<button class="m-chico" data-usar="${k}">Usar</button>` : it.tipo === "decoracion" ? "<small>🏡 para tu parcela</small>" : ""}</div>`; }).join("")}</div>` : '<p class="m-texto">Tu mochila está vacía. Busca ✨ recursos en el Bosque, la Montaña y el Lago.</p>';
    } else {
      cuerpo = Object.keys(RECETAS).map((id) => {
        const it = ITEMS[id], p = puedeFabricar(id, inv), f = faltantes(id, inv);
        const ing = Object.entries(RECETAS[id].ingredientes).map(([k, n]) => `<span class="m-ing ${f[k] ? "falta" : ""}">${ITEMS[k].emoji} ${Math.min(inv[k] || 0, 99)}/${n}</span>`).join("");
        const nota = p.motivo === "ya_tiene" ? " · ya la tienes ✔" : p.motivo === "lleno" ? " · mochila llena" : (inv[id] ? ` · tienes ${inv[id]}` : "");
        return `<div class="m-receta"><span class="e">${it.emoji}</span><div class="t"><b>${html(it.nombre)}</b>${nota}<br>${it.desc ? html(it.desc) + "<br>" : ""}${ing}</div><button class="m-chico" data-fab="${id}" ${p.ok ? "" : "disabled"}>Fabricar</button></div>`;
      }).join("");
    }
    mochilaEl.innerHTML = `<div class="m-tarjeta"><div class="m-cab"><span class="m-emo">🎒</span><div><div class="m-quien">Mi mochila</div><div class="m-titulo">Hoy recogiste ${recogidoHoy}${RC.limite > 0 ? "/" + RC.limite : ""}</div></div><button class="m-cerrar" data-a="cerrar" aria-label="Cerrar">✕</button></div><div class="m-tabs"><button class="m-tab ${tab === "mochila" ? "act" : ""}" data-tab="mochila">🎒 Mochila</button><button class="m-tab ${tab === "fabricar" ? "act" : ""}" data-tab="fabricar">🔨 Fabricar</button></div>${msg ? `<div class="m-msg ${msg.mal ? "mal" : ""}">${html(msg.texto)}</div>` : ""}${cuerpo}<button class="m-ok" data-a="cerrar">Cerrar</button></div>`;
    mochilaEl.classList.remove("oculto");
    mochilaEl.querySelectorAll('[data-a="cerrar"]').forEach((b) => (b.onclick = cerrarMochila));
    mochilaEl.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => renderMochila(b.dataset.tab)));
    mochilaEl.querySelectorAll("[data-fab]").forEach((b) => (b.onclick = () => fabricarItem(b.dataset.fab)));
    mochilaEl.querySelectorAll("[data-usar]").forEach((b) => (b.onclick = () => usarItem(b.dataset.usar)));
  }
  async function fabricarItem(id) {
    if (ocupadoMochila || !RC) return; ocupadoMochila = true;
    try {
      let r;
      try {
        if (op.alFabricar) r = await op.alFabricar({ receta: id });
        else { const p = puedeFabricar(id, inv); if (!p.ok) r = { ok: false, motivo: p.motivo, inventario: { ...inv } }; else { const n = { ...inv }; for (const [k, c] of Object.entries(RECETAS[id].ingredientes)) n[k] = (n[k] || 0) - c; n[id] = (n[id] || 0) + 1; Object.keys(n).forEach((k) => { if (!n[k]) delete n[k]; }); r = { ok: true, inventario: n }; } }
      } catch (e) { r = { ok: false, error: (e && e.message) || "No se pudo fabricar." }; }
      if (!vivo || !estado.mochilaAbierta) return;
      if (r && r.inventario) { Object.keys(inv).forEach((k) => delete inv[k]); Object.assign(inv, r.inventario); }
      if (r && r.ok) { snd.estrella(); renderMochila("fabricar", { texto: `¡Fabricaste ${ITEMS[id].emoji} ${ITEMS[id].nombre}!` }); }
      else renderMochila("fabricar", { mal: true, texto: r && r.error ? `No se pudo fabricar: ${r.error}` : "No se pudo fabricar: revisa los ingredientes." });
    } finally { ocupadoMochila = false; }
  }
  async function usarItem(id) {
    if (ocupadoMochila || !RC) return; ocupadoMochila = true;
    try {
      let r;
      try {
        if (op.alUsar) r = await op.alUsar({ item: id });
        else { const vida = estado.vida == null ? VIDA_MAX : estado.vida, cura = Math.min(ITEMS[id].cura || 0, VIDA_MAX - vida); if ((inv[id] || 0) < 1) r = { ok: false, mensaje: "No tienes ese objeto." }; else if (cura <= 0) r = { ok: false, lleno: true, mensaje: "Ya tienes la vida llena: no se gastó." }; else { const n = { ...inv, [id]: inv[id] - 1 }; if (!n[id]) delete n[id]; r = { ok: true, curado: cura, vida: vida + cura, inventario: n }; } }
      } catch (e) { r = { ok: false, mensaje: (e && e.message) || "No se pudo usar." }; }
      if (!vivo || !estado.mochilaAbierta) return;
      if (r && r.inventario) { Object.keys(inv).forEach((k) => delete inv[k]); Object.assign(inv, r.inventario); }
      if (r && r.ok) { if (typeof r.vida === "number") estado.vida = r.vida; actualizarHud(); snd.estrella(); renderMochila("mochila", { texto: `${ITEMS[id].emoji} +${r.curado} ❤️ · vida ${estado.vida}` }); }
      else renderMochila("mochila", { mal: true, texto: (r && r.mensaje) || "No se pudo usar." });
    } finally { ocupadoMochila = false; }
  }

  // ---- construir en la parcela: se elige una pieza de la mochila y se toca una casilla; tocar una pieza la recoge ----
  const construirEl = q(".m-construir"); let selDeco = null, msgC = null, ocupadoC = false;
  function renderConstruir() {
    const lista = Object.keys(ITEMS).filter((k) => esDecoracion(k) && (inv[k] || 0) > 0);
    if (!selDeco || !(inv[selDeco] > 0)) selDeco = lista[0] || null;
    construirEl.innerHTML = `<div class="m-c-tit">🔨 Construir<span>${parcela.piezas.size}/${PARCELA.maxPiezas} piezas</span></div>
      <div class="m-c-ayuda">${lista.length ? "Elige una pieza y toca una casilla del suelo para colocarla. Toca una pieza puesta para recogerla." : "No tienes objetos para colocar. Fabrícalos en la 🎒 Mochila → 🔨 Fabricar (silla, mesa, farol y maceta)."}</div>
      ${lista.length ? `<div class="m-c-lista">${lista.map((k) => `<button class="m-c-item ${k === selDeco ? "sel" : ""}" data-sel="${k}">${ITEMS[k].emoji} ${html(ITEMS[k].nombre)} × ${inv[k]}</button>`).join("")}</div>` : ""}
      <div class="m-c-msg ${msgC && msgC.mal ? "mal" : ""}">${msgC ? html(msgC.texto) : ""}</div><button class="m-ok" data-a="listo" style="margin-top:0">Listo</button>`;
    construirEl.classList.remove("oculto");
    construirEl.querySelectorAll("[data-sel]").forEach((b) => (b.onclick = () => { selDeco = b.dataset.sel; msgC = null; renderConstruir(); }));
    construirEl.querySelector('[data-a="listo"]').onclick = cerrarConstruir;
  }
  function abrirConstruir() { if (!PC || estado.escena !== parcela || estado.dialogo || estado.mapaAbierto || estado.cambiando) return; estado.construyendo = true; msgC = null; renderConstruir(); }
  function cerrarConstruir() { estado.construyendo = false; construirEl.classList.add("oculto"); construirEl.innerHTML = ""; cv.focus(); }
  const alternarConstruir = () => (estado.construyendo ? cerrarConstruir() : abrirConstruir());
  function mensajeC(texto, mal) { msgC = { texto, mal: !!mal }; if (estado.construyendo) renderConstruir(); }
  const aplicarInv = (nuevo) => { if (!nuevo) return; Object.keys(inv).forEach((k) => delete inv[k]); Object.assign(inv, nuevo); };
  async function tocarCelda(tx, ty) {
    if (!PC || ocupadoC) return;
    const hay = parcela.piezas.get(`${tx},${ty}`);
    if (hay) return quitarPieza(tx, ty);
    if (!celdaValida(tx, ty)) { mensajeC(tx === 0 || ty === 0 || tx === PARCELA.cols - 1 || ty === PARCELA.filas - 1 ? "Eso es la cerca." : "Deja libre el paso de la entrada.", true); return; }
    if (!selDeco || !(inv[selDeco] > 0)) { mensajeC("Elige una pieza de tu mochila primero.", true); return; }
    if (parcela.piezas.size >= PARCELA.maxPiezas) { mensajeC(`Tu parcela ya tiene el máximo de ${PARCELA.maxPiezas} piezas.`, true); return; }
    const o = obstaculoDe({ x: tx, y: ty }), bx = estado.x - 6, by = estado.y - 8;
    if (bx < o.x + o.w + 1 && bx + 12 > o.x - 1 && by < o.y + o.h + 1 && by + 8 > o.y - 1) { mensajeC("Estás parado ahí: muévete un poco.", true); return; }
    ocupadoC = true; const item = selDeco;
    try {
      let r;
      try {
        if (op.alColocar) r = await op.alColocar({ item, x: tx, y: ty });
        else { const n = { ...inv, [item]: inv[item] - 1 }; if (!n[item]) delete n[item]; r = { ok: true, inventario: n }; }
      } catch (e) { r = { ok: false, mensaje: (e && e.message) || "No se pudo colocar." }; }
      if (!vivo) return;
      if (r && r.ok) { aplicarInv(r.inventario); ponerPieza({ item, x: tx, y: ty }); snd.golpe(); mensajeC(`${ITEMS[item].emoji} ¡Colocado!`); }
      else { if (r && r.inventario) aplicarInv(r.inventario); mensajeC((r && r.mensaje) || "No se pudo colocar.", true); }
    } finally { ocupadoC = false; }
  }
  async function quitarPieza(tx, ty) {
    const pz = parcela.piezas.get(`${tx},${ty}`); if (!pz || ocupadoC) return;
    ocupadoC = true;
    try {
      let r;
      try {
        if (op.alQuitar) r = await op.alQuitar({ x: tx, y: ty });
        else if ((inv[pz.item] || 0) >= MAX_POR_ITEM) r = { ok: false, lleno: true, mensaje: "Tu mochila ya tiene el máximo de ese objeto." };
        else r = { ok: true, item: pz.item, inventario: { ...inv, [pz.item]: (inv[pz.item] || 0) + 1 } };
      } catch (e) { r = { ok: false, mensaje: (e && e.message) || "No se pudo recoger." }; }
      if (!vivo) return;
      if (r && r.ok) { aplicarInv(r.inventario); sacarPieza(tx, ty); snd.paso("tierra"); mensajeC(`${ITEMS[pz.item].emoji} Recogido: vuelve a tu mochila.`); }
      else if (r && r.vacia) { sacarPieza(tx, ty); mensajeC(r.mensaje, true); }
      else mensajeC((r && r.mensaje) || "No se pudo recoger.", true);
    } finally { ocupadoC = false; }
  }
  cv.addEventListener("click", (e) => {
    if (!estado.construyendo || estado.escena !== parcela || estado.dialogo || estado.mochilaAbierta || estado.mapaAbierto || estado.cambiando) return;
    const rc = cv.getBoundingClientRect(); if (!rc.width || !rc.height) return;
    tocarCelda(Math.floor(((e.clientX - rc.left) * (LW / rc.width) + camX) / TILE), Math.floor(((e.clientY - rc.top) * (LH / rc.height) + camY) / TILE));
  });

  // ---- movimiento ----
  function leerEntrada() {
    let ax = (teclas.has("ArrowRight") || teclas.has("d") ? 1 : 0) - (teclas.has("ArrowLeft") || teclas.has("a") ? 1 : 0);
    let ay = (teclas.has("ArrowDown") || teclas.has("s") ? 1 : 0) - (teclas.has("ArrowUp") || teclas.has("w") ? 1 : 0);
    if (!ax && !ay) { const m = Math.hypot(joy.x, joy.y); if (m > 0.22) { ax = joy.x; ay = joy.y; } }
    const m = Math.hypot(ax, ay); if (m > 1) { ax /= m; ay /= m; }
    return [ax, ay];
  }
  function mover(dx, dy) {
    if (dx && !chocaEn(estado.escena, estado.x + dx, estado.y)) estado.x += dx;
    if (dy && !chocaEn(estado.escena, estado.x, estado.y + dy)) estado.y += dy;
  }
  function moverAldeano(v, esc, dt) {
    if (v.hablando) { v.caminando = false; return; }
    if (v.pausa > 0) { v.pausa -= dt; v.caminando = false; return; }
    if (!v.meta) { const a = rand() * 6.283, d = 40 + rand() * 120; v.meta = { x: v.x + Math.cos(a) * d, y: v.y + Math.sin(a) * d }; }
    const vx = v.meta.x - v.x, vy = v.meta.y - v.y, dist = Math.hypot(vx, vy);
    if (dist < 4) { v.meta = null; v.pausa = 1 + rand() * 3; v.caminando = false; return; }
    const paso = 38 * dt, dx = (vx / dist) * paso, dy = (vy / dist) * paso, px = v.x, py = v.y; let movio = false;
    if (!chocaEn(esc, v.x + dx, v.y)) { v.x += dx; movio = true; }
    if (!chocaEn(esc, v.x, v.y + dy)) { v.y += dy; movio = true; }
    v.caminando = movio; v.dir = direccionDe(vx, vy); v.fasePaso = (v.fasePaso || 0) + Math.hypot(v.x - px, v.y - py) / LARGO_PASO;
    if (!movio) { v.meta = null; v.pausa = 0.4 + rand(); }
  }

  function actualizar(dt) {
    estado.fase += dt;
    const esc = estado.escena;
    const bloqueada = estado.dialogo || estado.mapaAbierto || estado.mochilaAbierta || estado.duelo || estado.cambiando || !q(".m-fin").classList.contains("oculto");
    const [ax, ay] = bloqueada ? [0, 0] : leerEntrada();
    estado.caminando = !!(ax || ay);
    if (estado.caminando) {
      const px = estado.x, py = estado.y;
      mover(ax * 96 * dt, ay * 96 * dt); estado.dir = direccionDe(ax, ay);
      const recorrido = Math.hypot(estado.x - px, estado.y - py);       // si choca contra algo, no avanza: no mueve las piernas ni suena
      estado.movio = recorrido > 0.01; estado.fasePaso += recorrido / LARGO_PASO;
      if (estado.movio) { estado.pasoT += dt; if (estado.pasoT > 0.34) { estado.pasoT = 0; snd.paso(esc.piso(estado.x, estado.y)); } } else estado.pasoT = 0.3;
    } else { estado.movio = false; estado.pasoT = 0.3; }
    // el compañero (si tiene uno) camina detrás
    const ox = estado.x - { east: 22, "south-east": 16, south: 0, "south-west": -16, west: -22, "north-west": -16, north: 0, "north-east": 16 }[estado.dir], oy = estado.y - { east: 0, "south-east": 12, south: 22, "south-west": 12, west: 0, "north-west": -12, north: -22, "north-east": -12 }[estado.dir] + 6;
    estado.comp.x += (ox - estado.comp.x) * Math.min(1, dt * 5); estado.comp.y += (oy - estado.comp.y) * Math.min(1, dt * 5);
    // estrellas
    for (const s of esc.estrellas) if (!s.tomada && Math.hypot(s.x - estado.x, s.y - 6 - estado.y) < 16) { s.tomada = true; estado.est++; actualizarHud(); aviso("⭐", "#fde68a"); snd.estrella(); }
    // salida de los edificios (caminar hacia la puerta)
    if (!estado.cambiando) { const sal = esc.salidas.find((s) => estado.x > s.x && estado.x < s.x + s.w && estado.y > s.y && estado.y < s.y + s.h && (!s.activa || s.activa())); if (sal) (sal.accion || salirDeEdificio)(); }
    // personajes
    for (const n of esc.npcs) if (n.tipo === "aldeano") moverAldeano(n, esc, dt);
    for (const n of esc.npcs) if ((n.hablando || Math.hypot(n.x - estado.x, n.y - estado.y) < 90) && n.tipo !== "puerta") { if (n.tipo === "mision" || n.tipo === "guardia" || n.tipo === "comarca_heraldo" || n.tipo === "posadero" || n.tipo === "guardian" || n.tipo === "retador" || n.hablando) n.dir = direccionDe(estado.x - n.x, estado.y - n.y); }
    // emboscada: un retador te corta el paso si te acercas demasiado (si lo cierras o huyes, te deja en paz un rato)
    if (R && !bloqueada) for (const n of esc.npcs) {
      if (n.tipo === "retador" && ahoraMs() > (n.ignorarHasta || 0) && Math.hypot(n.x - estado.x, n.y - estado.y) < 84 && puedeRetar(n)) { abrirRetador(n, true); break; }
    }
    // el más cercano con quien se puede interactuar
    let mejor = null, md = 1e9;
    for (const n of [...esc.npcs, ...esc.puertas]) { if ((n.tipo === "recurso" && ahoraMs() < (n.hastaMs || 0)) || (n.tipo === "secreto" && n.hallado)) continue; const rad = n.radio || 40, d = Math.hypot(n.x - estado.x, n.y - estado.y); if (d < rad && d < md) { md = d; mejor = n; } }
    estado.cercano = mejor;
    const av = q(".m-aviso"), ba = q(".m-accion");
    if (mejor && !estado.dialogo && !estado.cambiando) {
      av.textContent = (mejor.tipo === "puerta" ? `🚪 Entrar a ${mejor.nombre}` : mejor.tipo === "parcela_puerta" ? "🏡 Entrar a mi parcela" : mejor.tipo === "recurso" ? `${ITEMS[mejor.item].emoji} Recoger ${mejor.nombre.toLowerCase()}` : mejor.tipo === "juego_mesa" ? `${mejor.emoji} Jugar: ${mejor.nombre}` : mejor.tipo === "secreto" ? "🔎 Examinar algo que brilla" : mejor.tipo === "comarca_mapa" ? "🗺️ Ver el mapa de la Comarca" : `💬 Hablar con ${mejor.nombre}`) + (tactil ? "" : " (E)"); av.classList.remove("oculto"); ba.classList.add("listo"); ba.textContent = mejor.tipo === "puerta" ? "🚪" : mejor.tipo === "parcela_puerta" ? "🏡" : mejor.tipo === "recurso" ? ITEMS[mejor.item].emoji : mejor.tipo === "juego_mesa" ? mejor.emoji : mejor.tipo === "secreto" ? "🔎" : mejor.tipo === "comarca_mapa" ? "🗺️" : "💬";
    } else { av.classList.add("oculto"); ba.classList.remove("listo"); }
    for (const a of estado.avisos) a.t += dt; estado.avisos = estado.avisos.filter((a) => a.t < 1.3);
  }

  // ---- dibujo ----
  const sombra = (x, y, rx, ry) => { ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(x - camX, y - camY, rx, ry, 0, 0, 7); ctx.fill(); };
  function dibujarPersonaje(clave, dir, x, y, caminando, fase) {
    const an = sprites[clave].ancla, cuadros = pasos[clave] && pasos[clave][dir];
    const im = caminando && cuadros ? cuadros[Math.floor(fase) % 4] : (imgs[clave][dir] || imgs[clave].south); // en movimiento: cuadros de caminata; quieto: la pose de siempre
    ctx.drawImage(im, Math.round(x - an.cx - camX), Math.round(y - an.by - camY));
  }
  function etiqueta(texto, x, y, color) { ctx.font = "bold 9px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.75)"; ctx.strokeText(texto, x, y); ctx.fillStyle = color || "#fff"; ctx.fillText(texto, x, y); }
  const emoji = (txt, x, y, px) => { ctx.globalAlpha = 1; ctx.fillStyle = "#000"; ctx.font = px + "px " + FUENTE_EMOJI; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText(txt, Math.round(x - camX), Math.round(y - camY)); };
  function dibujarCartel(n, t) {
    const sx = Math.round(n.x - camX), sy = Math.round(n.y - camY);
    sombra(n.x, n.y, 10, 4);
    ctx.fillStyle = "#6b4220"; ctx.fillRect(sx - 2, sy - 18, 4, 18); ctx.fillStyle = "#a67340"; ctx.fillRect(sx - 14, sy - 32, 28, 16); ctx.fillStyle = "#c58f55"; ctx.fillRect(sx - 14, sy - 32, 28, 3);
    ctx.globalAlpha = 1; ctx.fillStyle = "#000"; ctx.font = "13px " + FUENTE_EMOJI; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText("🏡", sx, sy - 19);
    if (Math.hypot(n.x - estado.x, n.y - estado.y) < 90) etiqueta(n.nombre, sx, sy - 36, "#fde68a");
  }
  function dibujarSecreto(n, t) {
    if (n.hallado) return;
    const a = brilloPorDistancia(Math.hypot(n.x - estado.x, n.y - estado.y)); if (a <= 0) return;   // solo se ve cuando te acercas
    const sx = Math.round(n.x - camX), sy = Math.round(n.y - camY), p = 0.6 + 0.4 * Math.sin(t * 4 + n.x);
    ctx.globalAlpha = a * 0.5 * p; ctx.fillStyle = "#fde68a"; ctx.beginPath(); ctx.ellipse(sx, sy - 6, 22, 11, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = a; ctx.fillStyle = "#000"; ctx.font = "20px " + FUENTE_EMOJI; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText(n.emoji, sx, sy - 2 + Math.sin(t * 3 + n.y) * 1.5);
    ctx.font = "10px " + FUENTE_EMOJI; ctx.fillText("✨", sx + 12 * Math.cos(t * 2 + n.x), sy - 20 + 4 * Math.sin(t * 3 + n.x)); ctx.fillText("✨", sx - 11 * Math.sin(t * 2.4 + n.y), sy - 12 + 3 * Math.cos(t * 3.3)); ctx.globalAlpha = 1;
  }
  function dibujarMesaJuego(n, t) {
    const sx = Math.round(n.x - camX), sy = Math.round(n.y - 40 - camY), lista = AC ? AC.lista.filter((a) => a.tipo === n.juego) : [], pend = lista.filter((a) => !hechosAc.has(a.id)).length;
    ctx.globalAlpha = 1; ctx.fillStyle = "#000"; ctx.font = "22px " + FUENTE_EMOJI; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText(n.emoji, sx, sy + Math.sin(t * 3 + n.x) * 2);
    if (lista.length) emoji(pend ? "❗" : "✅", n.x + 14, n.y - 62 + Math.sin(t * 5 + n.x) * 2, 14);
    if (Math.hypot(n.x - estado.x, n.y - estado.y) < 90) etiqueta(n.nombre + (lista.length ? ` · ${lista.length - pend}/${lista.length}` : ""), sx, sy - 22, "#fde68a");
  }
  function dibujarRecurso(n, t) {
    const listo = ahoraMs() >= (n.hastaMs || 0), sx = Math.round(n.x - camX), sy = Math.round(n.y - camY);
    sombra(n.x, n.y, 11, 4);
    ctx.globalAlpha = listo ? 1 : 0.28; ctx.fillStyle = "#000"; ctx.font = (listo ? 24 : 16) + "px " + FUENTE_EMOJI; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText(ITEMS[n.item].emoji, sx, sy - 2); ctx.globalAlpha = 1;
    if (listo) { ctx.font = "9px " + FUENTE_EMOJI; ctx.fillText("✨", sx + 11, sy - 20 + Math.sin(t * 4 + n.x) * 2); }
  }
  function dibujar() {
    const esc = estado.escena, t = estado.fase;
    camX = Math.round(Math.min(Math.max(estado.x - LW / 2, 0), Math.max(0, esc.ancho - LW))); camY = Math.round(Math.min(Math.max(estado.y - 12 - LH / 2, 0), Math.max(0, esc.alto - LH)));
    if (esc.ancho < LW) camX = -Math.round((LW - esc.ancho) / 2); if (esc.alto < LH) camY = -Math.round((LH - esc.alto) / 2);
    ctx.globalAlpha = 1; ctx.fillStyle = esc.fondo; ctx.fillRect(0, 0, LW, LH);
    const sx = Math.max(0, camX), sy = Math.max(0, camY), dx = sx - camX, dy = sy - camY, sw = Math.min(LW - dx, esc.ancho - sx), sh = Math.min(LH - dy, esc.alto - sy);
    if (sw > 0 && sh > 0) ctx.drawImage(esc.suelo, sx, sy, sw, sh, dx, dy, sw, sh);
    if (esc.efectos) esc.efectos(ctx, t, camX, camY, LW, LH);
    const lista = [], visible = (x, y, m = 70) => x - camX > -m && x - camX < LW + m && y - camY > -m && y - camY < LH + m;
    esc.objetos(lista, ctx, camX, camY, visible, t);
    for (const s of esc.estrellas) if (!s.tomada && visible(s.x, s.y)) lista.push({ y: s.y, d: () => emoji("⭐", s.x, s.y - 8 + Math.sin(t * 4 + s.x) * 2, 16) });
    for (const n of esc.npcs) lista.push({ y: n.y, d: () => {
      if (n.tipo === "recurso") { dibujarRecurso(n, t); return; }
      if (n.tipo === "parcela_puerta") { dibujarCartel(n, t); return; }
      if (n.tipo === "juego_mesa") { dibujarMesaJuego(n, t); return; }
      if (n.tipo === "secreto") { dibujarSecreto(n, t); return; }
      if (n.tipo === "comarca_mapa") { ctx.globalAlpha = 1; ctx.fillStyle = "#000"; ctx.font = "22px " + FUENTE_EMOJI; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText(n.emoji, Math.round(n.x - camX), Math.round(n.y - 40 - camY) + Math.sin(t * 3 + n.x) * 2); if (Math.hypot(n.x - estado.x, n.y - estado.y) < 90) etiqueta(n.nombre, Math.round(n.x - camX), Math.round(n.y - 66 - camY), "#fde68a"); return; }
      sombra(n.x, n.y, 9, 3.5);
      if (n.tipo === "retador") { const sx = Math.round(n.x - camX), sy = Math.round(n.y - camY); ctx.fillStyle = `rgba(220,38,38,${(puedeRetar(n) ? 0.3 : 0.1) + 0.12 * Math.sin(t * 4)})`; ctx.beginPath(); ctx.ellipse(sx, sy, 17, 7, 0, 0, 7); ctx.fill(); } // aura roja: se nota que es peligroso
      dibujarPersonaje(n.clave, n.dir, n.x, n.y, n.caminando, n.fasePaso || 0);
      if (n.tipo === "mision") { const hecha = hechas.has(n.mision.id), b = hecha ? 0 : Math.sin(t * 5 + n.x) * 3, an = sprites[n.clave].ancla; emoji(hecha ? "✅" : "❗", n.x, n.y - an.by - 4 + b, 18); }
      else if (n.tipo === "guardia") emoji(n.porton.abierto ? "🔓" : "🔒", n.x, n.y - sprites[n.clave].ancla.by - 4, 18);
      else if (n.tipo === "comarca_heraldo") { emoji(COM && COM.hay && COM.batallas.activo ? "⚔️" : "🏰", n.x, n.y - sprites[n.clave].ancla.by - 4, 18); if (Math.hypot(n.x - estado.x, n.y - estado.y) < 60) etiqueta(n.nombre, Math.round(n.x - camX), Math.round(n.y - sprites[n.clave].ancla.by - camY - 24), "#e8edf8"); }
      else if (n.tipo === "posadero") emoji("🛏️", n.x, n.y - sprites[n.clave].ancla.by - 4, 18);
      else if (n.tipo === "retador") emoji(puedeRetar(n) ? "☠️" : "💤", n.x, n.y - sprites[n.clave].ancla.by - 4 + Math.sin(t * 5 + n.x) * 2, 18);
      else if (n.tipo === "guardian") emoji(insignias.has(n.zona) ? ZONAS.find((zz) => zz.key === n.zona).insignia.emoji : "⚔️", n.x, n.y - sprites[n.clave].ancla.by - 4, 18);
      else if (Math.hypot(n.x - estado.x, n.y - estado.y) < 60) etiqueta(n.nombre, Math.round(n.x - camX), Math.round(n.y - sprites[n.clave].ancla.by - camY - 3), "#e8edf8");
    } });
    if (esc.exterior) for (const e of esc.edificios) { const p = pendientesEn(e.id); if (p > 0 && visible(e.puerta.x, e.puerta.y)) lista.push({ y: e.puerta.y + 40, d: () => emoji("❗", e.puerta.x, e.puerta.y - 58 + Math.sin(t * 5 + e.x) * 3, 20) }); }
    if (J.companero) lista.push({ y: estado.comp.y, d: () => { sombra(estado.comp.x, estado.comp.y, 6, 2.5); emoji(J.companero, estado.comp.x, estado.comp.y - 2 - Math.abs(Math.sin(t * 9)) * (estado.caminando ? 2 : 0), 18); } });
    lista.push({ y: estado.y, d: () => {
      const an = sprites[estado.clave].ancla;
      if (J.nivel && J.nivel.color) { const a = 0.35 + Math.sin(t * 3) * 0.08, gx = Math.round(estado.x - camX), gy = Math.round(estado.y - camY), gr = ctx.createRadialGradient(gx, gy, 2, gx, gy, 24); gr.addColorStop(0, J.nivel.color + "cc"); gr.addColorStop(1, J.nivel.color + "00"); ctx.globalAlpha = a + 0.4; ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(gx, gy, 26, 11, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      sombra(estado.x, estado.y, 10, 4); dibujarPersonaje(estado.clave, estado.dir, estado.x, estado.y, estado.movio, estado.fasePaso);
      etiqueta(estado.nombre, Math.round(estado.x - camX), Math.round(estado.y - an.by - camY - 3));
    } });
    lista.sort((a, b) => a.y - b.y); for (const o of lista) o.d();
    ctx.font = "bold 11px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    for (const a of estado.avisos) { const yy = estado.y - 56 - a.t * 22 - camY, xx = estado.x - camX; ctx.globalAlpha = Math.max(0, 1 - a.t / 1.3); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.7)"; ctx.strokeText(a.texto, xx, yy); ctx.fillStyle = a.color; ctx.fillText(a.texto, xx, yy); ctx.globalAlpha = 1; }
    if (esc.exterior) dibujarMini(esc);
  }
  function dibujarMini(esc) {
    const m = esc.mini, k = m.k * (mini.width / ((m.cols || MW) * 3));
    mctx.clearRect(0, 0, mini.width, mini.height); mctx.drawImage(m.base, 0, 0, mini.width, mini.height);
    const punto = (x, y, col, r) => { mctx.fillStyle = col; mctx.beginPath(); mctx.arc(x * k, y * k, r, 0, 7); mctx.fill(); mctx.strokeStyle = "#000"; mctx.lineWidth = 0.8; mctx.stroke(); };
    for (const e of esc.edificios) { const total = misiones.filter((mm) => mm.lugar === e.id).length; if (total) punto(e.puerta.x, e.puerta.y, pendientesEn(e.id) ? "#fbbf24" : "#34d399", 3.4); }
    for (const n of esc.npcs) if (n.tipo === "mision") punto(n.x, n.y, hechas.has(n.mision.id) ? "#34d399" : "#fbbf24", 3.2);
    for (const n of esc.npcs) if (n.tipo === "retador") punto(n.x, n.y, "#dc2626", 3);                       // los retadores, en rojo
    for (const p of esc.portones) punto(p.disparador.x, p.disparador.y + 40, p.abierto ? "#34d399" : "#ef4444", 3.4); // el portón: rojo cerrado, verde abierto
    { const v = esc.salidas.find((s) => s.volver); if (v) punto(v.x + 20, v.y + 64, "#34d399", 3.4); }                // la vuelta a la zona anterior
    for (const s of esc.estrellas) if (!s.tomada) { mctx.fillStyle = "#fff"; mctx.fillRect(s.x * k - 1, s.y * k - 1, 2, 2); }
    mctx.fillStyle = "#7c3aed"; mctx.beginPath(); mctx.arc(estado.x * k, estado.y * k, 3.8, 0, 7); mctx.fill(); mctx.strokeStyle = "#fff"; mctx.lineWidth = 1.5; mctx.stroke();
  }
  function cuadro(ahora) {
    if (!vivo) return;
    const dt = Math.min(0.05, (ahora - ultimo) / 1000 || 0); ultimo = ahora;
    actualizar(dt); dibujar(); rafId = requestAnimationFrame(cuadro);
  }

  // ---- entrada: teclado, círculo táctil y botón de acción ----
  const tactil = "ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0 || op.forzarTactil === true;
  function alTeclaAbajo(e) {
    snd.reanudar(); const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
    if (estado.comarcaAbierto) { if (e.key === "Escape") cerrarComarca(); return; }
    if (estado.juegoAbierto) { if (e.key === "Escape") cerrarJuego(); else if (juegoActual && juegoActual.tecla(e.key.length === 1 ? e.key.toUpperCase() : e.key)) e.preventDefault(); return; }
    if (k === "m") { alternarSonido(); return; }
    if (estado.duelo) { manejarTeclaDuelo(k); return; }
    if (estado.mochilaAbierta) { if (e.key === "Escape" || k === "i") cerrarMochila(); return; }
    if (k === "b" && PC && estado.escena === parcela && !estado.dialogo && !estado.mapaAbierto && !estado.cambiando) { alternarConstruir(); return; }
    if (k === "i" && RC && !estado.juegoAbierto && !estado.comarcaAbierto && !estado.dialogo && !estado.mapaAbierto && !estado.cambiando) { abrirMochila(); return; }
    if (k === "p") { if (estado.mapaAbierto) cerrarMapa(); else abrirMapa(); return; }
    if (estado.mapaAbierto) { if (e.key === "Escape") cerrarMapa(); return; }
    if (estado.dialogo) {
      if (e.key === "Escape") cerrarDialogo();
      const n = Number(k), btn = n >= 1 && n <= 6 ? raiz.querySelectorAll(".m-dialogo .m-opcion")[n - 1] : null; if (btn && !btn.disabled) btn.click(); return;
    }
    teclas.add(k); if (k === "e" || k === " " || k === "Enter") interactuar();
  }
  const alTeclaArriba = (e) => teclas.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  const alPerderFoco = () => teclas.clear();
  const alRedimensionar = () => ajustarLienzo();
  window.addEventListener("keydown", alTeclaAbajo); window.addEventListener("keyup", alTeclaArriba); window.addEventListener("blur", alPerderFoco); window.addEventListener("resize", alRedimensionar);
  const jb = q(".m-joy"), jk = q(".m-knob"); let joyActivo = false;
  function joyMover(e) { const r = jb.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const d = Math.hypot(dx, dy), R = 46; if (d > R) { dx = dx / d * R; dy = dy / d * R; } joy.x = dx / R; joy.y = dy / R; jk.style.transform = `translate(${dx}px, ${dy}px)`; }
  const joyFin = () => { joyActivo = false; joy.x = joy.y = 0; jk.style.transform = "translate(0,0)"; };
  jb.addEventListener("pointerdown", (e) => { snd.reanudar(); jb.setPointerCapture(e.pointerId); joyActivo = true; joyMover(e); e.preventDefault(); });
  jb.addEventListener("pointermove", (e) => { if (joyActivo) joyMover(e); });
  jb.addEventListener("pointerup", joyFin); jb.addEventListener("pointercancel", joyFin);
  q(".m-accion").addEventListener("pointerdown", (e) => { e.preventDefault(); snd.reanudar(); interactuar(); });
  cv.addEventListener("pointerdown", () => { snd.reanudar(); cv.focus(); });
  function alternarSonido() { const mudo = snd.alternar(); q(".b-sonido").textContent = mudo ? "🔇" : "🔊"; toast(mudo ? "Sonido apagado" : "Sonido encendido", 1200); }
  q(".b-sonido").onclick = alternarSonido;
  q(".b-mapa").onclick = () => (estado.mapaAbierto ? cerrarMapa() : abrirMapa());
  if (PC) q(".b-construir").onclick = alternarConstruir;
  if (RC) { q(".b-mochila").classList.remove("oculto"); q(".b-mochila").onclick = () => (estado.mochilaAbierta ? cerrarMochila() : abrirMochila()); }
  q(".b-salir").onclick = () => op.alSalir && op.alSalir();
  q(".b-seguir").onclick = () => { q(".m-fin").classList.add("oculto"); cv.focus(); };

  // ---- arranque ----
  q(".m-foto").src = sprites[claveJugador].dirs.south; q(".m-nombre").textContent = estado.nombre;
  if (J.nivel) { const nv = q(".m-nv"); nv.textContent = `Nv ${J.nivel.nivel}`; nv.classList.remove("oculto"); nv.title = J.nivel.nombre || ""; }
  if (snd.mudo) q(".b-sonido").textContent = "🔇";
  const mostrarControles = tactil || raiz.getBoundingClientRect().width < 700; q(".m-joy").classList.toggle("oculto", !mostrarControles); q(".m-accion").classList.toggle("oculto", !mostrarControles);
  ajustarLienzo(); actualizarHud(); mostrarLugar(exterior); snd.musica("exterior"); cv.focus();
  toast(op.modoPrueba ? "🧪 Modo prueba: las misiones NO se guardan" : (tactil ? "Mueve el círculo para caminar · busca los ❗ y las 🚪" : "Flechas o WASD para caminar · E para hablar o entrar · M silencia"), 4200);
  ultimo = performance.now(); rafId = requestAnimationFrame(cuadro);

  const api = {
    estado, escenas, exterior, interiores, misiones, hechas, snd, chocaEn, interactuar, cambiarEscena, pasos, bosque: escenaDeZona.bosque, naturales, escenaDeZona, zonas: () => zonas, recalcularZonas, abrirMapa, cerrarMapa, viajarRapido, insignias, esperaHasta, poolDeZona, R, retosGanados, esperaReto, abrirRetador, iniciarReto, poolDeZonaReto, puedeRetar, abrirGuardian, iniciarDuelo, contestarDuelo, terminarDuelo, cerrarDuelo, RC, AC, hechosAc, COM, abrirMapaComarca, cerrarComarca, abrirHeraldo, vistaHeraldo, iniciarBatalla, SEC, hallados, abrirSecreto, abrirMesa, abrirJuego, cerrarJuego, juego: () => juegoActual, inv, abrirRecurso, abrirMochila, cerrarMochila, fabricarItem, usarItem, recogidoHoy: () => recogidoHoy, PC, parcela, cartel: () => cartel, abrirConstruir, cerrarConstruir, tocarCelda,
    destruir() {
      if (!vivo) return; // por si se llama dos veces
      vivo = false; estado.activo = false; cancelAnimationFrame(rafId); temporizadores.forEach(clearTimeout); temporizadores.clear();
      window.removeEventListener("keydown", alTeclaAbajo); window.removeEventListener("keyup", alTeclaArriba); window.removeEventListener("blur", alPerderFoco); window.removeEventListener("resize", alRedimensionar);
      try { snd.destruir(); } catch (e) { /* ya cerrado */ } raiz.innerHTML = "";
    },
  };
  raiz.__mundo = api;
  return api;
}
