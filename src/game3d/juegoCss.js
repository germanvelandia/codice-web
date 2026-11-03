// Estilos de los minijuegos (acertijos) dentro del Mundo 3D. Salen de los del Mundo 2D, con otro nombre de clase.
export const CSS_JUEGO = `.m3d-juego { --panel: #ffffff; --texto: #1e293b; --suave: #64748b; --borde: #e2e8f0; --fondo: #f4f6fb; --acento: #7c3aed; --ok: #059669; --ok-s: #d1fae5; --mal: #e11d48; --mal-s: #ffe4e6; color: var(--texto); }
.m3d-juego .m-texto { font-size: 14px; line-height: 1.5; margin: 6px 0 10px; }
.m3d-juego .m-retro { font-size: 13px; padding: 9px 11px; border-radius: 10px; margin-top: 4px; line-height: 1.45; }
.m3d-juego .m-retro.bien { background: var(--ok-s); color: var(--ok); } .m3d-juego .m-retro.mal { background: var(--mal-s); color: var(--mal); }
.m3d-juego .jg-ayuda { font-size: 12px; color: var(--suave); margin: 4px 0 8px; line-height: 1.35; }
.m3d-juego .jg-pista { font-size: 12px; background: var(--fondo); border: 1px dashed var(--borde); border-radius: 10px; padding: 6px 9px; margin-bottom: 6px; }
.m3d-juego .jg-sopa { display: grid; gap: 2px; max-width: 420px; margin: 0 auto; }
.m3d-juego .jg-s { aspect-ratio: 1; padding: 0; border: 1px solid var(--borde); background: var(--fondo); color: var(--texto); font-weight: 800; font-size: clamp(11px, 3.2vw, 16px); border-radius: 6px; }
.m3d-juego .jg-s.sel { background: var(--acento); color: #fff; } .m3d-juego .jg-s.ok { background: var(--ok-s); border-color: var(--ok); color: var(--ok); }
.m3d-juego .jg-palabras { display: flex; flex-wrap: wrap; gap: 5px; margin: 8px 0; }
.m3d-juego .jg-p { font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 99px; border: 1px solid var(--borde); } .m3d-juego .jg-p.hecha { text-decoration: line-through; background: var(--ok-s); color: var(--ok); border-color: var(--ok); }
.m3d-juego .jg-msg { font-size: 13px; font-weight: 700; text-align: center; margin: 8px 0; }
.m3d-juego .jg-otra { display: block; margin: 6px auto 0; border: 0; border-radius: 99px; padding: 6px 12px; font-size: 12px; font-weight: 700; background: var(--borde); color: var(--texto); }
.m3d-juego .jg-cripto { display: flex; flex-wrap: wrap; gap: 10px 14px; justify-content: center; margin: 8px 0; }
.m3d-juego .jg-pal { display: inline-flex; gap: 3px; align-items: flex-end; }
.m3d-juego .jg-c { width: 26px; border: 2px solid var(--borde); background: var(--fondo); color: var(--texto); border-radius: 7px; padding: 2px 0; display: flex; flex-direction: column; align-items: center; line-height: 1.1; }
.m3d-juego .jg-c .l { font-weight: 800; font-size: 16px; min-height: 19px; } .m3d-juego .jg-c .n { font-size: 10px; color: var(--suave); }
.m3d-juego .jg-c.sel { border-color: var(--acento); box-shadow: 0 0 0 2px var(--acento); } .m3d-juego .jg-c.mal { border-color: var(--mal); background: var(--mal-s); } .m3d-juego .jg-c.dada { background: rgba(245,158,11,.25); border-color: #f59e0b; }
.m3d-juego .jg-sig { font-weight: 800; font-size: 18px; align-self: center; }
.m3d-juego .jg-teclado { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; margin-top: 8px; }
.m3d-juego .jg-k { width: 32px; height: 36px; border-radius: 8px; border: 2px solid var(--borde); background: var(--fondo); color: var(--texto); font-weight: 800; font-size: 14px; padding: 0; } .m3d-juego .jg-k:disabled { opacity: .3; }
.m3d-juego .jg-vidas { text-align: center; font-size: 20px; letter-spacing: 2px; }
.m3d-juego .jg-frase { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; margin: 10px 0; font-size: 20px; font-weight: 800; } .m3d-juego .jg-frase b { min-width: 20px; text-align: center; border-bottom: 3px solid var(--acento); } .m3d-juego .jg-frase .esp { width: 14px; } .m3d-juego .jg-frase.perdio b { color: var(--mal); }
.m3d-juego .jg-rompe { display: grid; gap: 3px; width: min(300px, 100%); aspect-ratio: 1; margin: 8px auto; }
.m3d-juego .jg-f { border: 0; border-radius: 8px; background: var(--acento); color: #fff; font-weight: 800; font-size: 24px; padding: 0; } .m3d-juego .jg-f.hueco { background: var(--fondo); border: 2px dashed var(--borde); } .m3d-juego .jg-f.img { background-color: var(--fondo); }
.m3d-juego .jg-ref { width: 70px; height: 70px; background-size: cover; background-position: center; border-radius: 8px; border: 2px solid var(--borde); margin: 0 auto 4px; }`;
