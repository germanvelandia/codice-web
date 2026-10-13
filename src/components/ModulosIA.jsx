import React, { useState } from "react";
import * as api from "../lib/modulosApi";
import { instruccionesIA, leerRespuestaIA, TIPOS_ACTIVIDAD } from "../lib/modulos";
import { instruccionesIA as instruccionesLeccion, leerRespuestaIA as leerLeccionIA, normalizarLeccion, TIPOS_BLOQUE, resumenLeccion } from "../lib/leccion";
import { nivelesDe, esNivel, claveNivel, nombreNivel, etiquetaPara } from "../lib/gradosMundo";

const input = "w-full text-sm rounded-lg px-2.5 py-1.5 border border-slate-200 outline-none bg-white";
const copiar = async (texto) => {
  try { await navigator.clipboard.writeText(texto); return true; } catch { /* sin permiso del portapapeles: se usa el método antiguo */ }
  try { const t = document.createElement("textarea"); t.value = texto; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); const ok = document.execCommand("copy"); document.body.removeChild(t); return ok; } catch { return false; }
};

// Asistente: la IA (ChatGPT, Claude, Gemini, Copilot…) prepara el módulo con el formato de la plataforma y la docente lo revisa antes de crearlo.
export function CrearModuloIA({ materias = [], cursos = [], modulos = [], onCerrar, onCreado }) {
  const [materiaId, setMateriaId] = useState("");
  const [grado, setGrado] = useState("");
  const [tema, setTema] = useState("");
  const [ver, setVer] = useState(false);
  const [copiado, setCopiado] = useState("");
  const [pegado, setPegado] = useState("");
  const [rev, setRev] = useState(null);            // { modulos, avisos }
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const niveles = nivelesDe(cursos);
  const materia = materias.find((m) => String(m.id) === String(materiaId));
  const texto = instruccionesIA({ materia: materia?.nombre || "", curso: grado ? etiquetaPara(grado).toLowerCase() : "", tema: tema.trim() });

  const copiarInstrucciones = async () => { setCopiado((await copiar(texto)) ? "ok" : "fallo"); setVer(true); setTimeout(() => setCopiado(""), 3000); };
  const revisar = () => {
    setError(""); const r = leerRespuestaIA(pegado);
    if (r.error) { setRev(null); setError(r.error); return; }
    setRev(r);
  };
  const setMod = (i, k, v) => setRev((r) => ({ ...r, modulos: r.modulos.map((m, j) => (j === i ? { ...m, [k]: v } : m)) }));
  const quitarAct = (i, k) => setRev((r) => { const modulos = r.modulos.map((m, j) => { if (j !== i) return m; const actividades = m.actividades.filter((_, x) => x !== k); const buenas = actividades.filter((a) => !a.error).length; return { ...m, actividades, buenas, malas: actividades.length - buenas }; }); return { ...r, modulos }; });
  const crear = async () => {
    if (rev.modulos.some((m) => !m.nombre.trim())) { setError("Ponle nombre a todos los módulos antes de crearlos."); return; }
    setGuardando(true); setError("");
    try { const r = await api.crearModulosDesdeIA(rev.modulos, { materia_id: materiaId ? Number(materiaId) : null, grado_id: grado }, modulos); onCreado(r); }
    catch (e) { setError((e.message || "No se pudo crear.") + (e.creados && e.creados.length ? ` Ya se crearon ${e.creados.length} módulo(s) antes del problema; revísalos en la lista.` : "")); }
    setGuardando(false);
  };
  const paso = (n, t) => <div className="flex items-center gap-2 mb-2"><span className="w-6 h-6 rounded-full bg-violet-500 text-white text-xs font-bold flex items-center justify-center">{n}</span><h4 className="text-sm font-bold text-slate-800">{t}</h4></div>;

  return (
    <div data-testid="crear-con-ia">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-bold text-slate-800">✨ Crear la lección con ayuda de una IA</h3>
        <button onClick={onCerrar} className="text-xs text-slate-500 px-2 py-1" data-testid="cerrar-ia">Cerrar</button>
      </div>
      <p className="text-xs text-slate-500 mb-4">Funciona con ChatGPT, Claude, Gemini o Copilot. La IA prepara el contenido con el formato de la plataforma; tú lo revisas antes de publicarlo.</p>
      {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 mb-3" data-testid="error-ia">{error}</div>}

      <section className="mb-5">
        {paso(1, "Copia las instrucciones")}
        <div className="grid sm:grid-cols-3 gap-2 mb-2">
          <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)} className={input} aria-label="Materia del módulo"><option value="">Materia (general)</option>{materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
          <select value={grado} onChange={(e) => setGrado(e.target.value)} className={input} aria-label="Curso del módulo">
            <option value="">🌐 Todos los cursos</option>
            {niveles.map((n) => <option key={n} value={claveNivel(n)}>📚 Todo {nombreNivel(n).toLowerCase()}</option>)}
            {cursos.map((c) => <option key={c} value={c}>🏫 Solo el curso {c}</option>)}
          </select>
          <input value={tema} onChange={(e) => setTema(e.target.value)} maxLength={120} placeholder="Tema (opcional)" className={input} aria-label="Tema del módulo" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={copiarInstrucciones} className="text-xs font-semibold px-3 py-2 rounded-lg bg-violet-500 text-white" data-testid="copiar-instrucciones">📋 Copiar instrucciones para la IA</button>
          <button onClick={() => setVer((v) => !v)} className="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600" data-testid="ver-instrucciones">{ver ? "Ocultar las instrucciones" : "Ver las instrucciones"}</button>
          {copiado === "ok" && <span className="text-xs text-emerald-600 self-center" data-testid="copiado">¡Copiadas! ✓</span>}
          {copiado === "fallo" && <span className="text-xs text-amber-700 self-center">No pude copiar solo: selecciona el texto de abajo y cópialo.</span>}
        </div>
        {ver && <textarea readOnly rows={10} value={texto} onFocus={(e) => e.target.select()} className={input + " mt-2 font-mono text-[11px]"} aria-label="Instrucciones para la IA" data-testid="texto-instrucciones" />}
      </section>

      <section className="mb-5">
        {paso(2, "Pégalas en la IA junto con el material")}
        <p className="text-xs text-slate-500">Abre la IA, pega las instrucciones y, al final, donde dice «MATERIAL DEL MÓDULO», pega el texto del tema: tus apuntes, un resumen o el contenido del módulo. Envía el mensaje y espera la respuesta.</p>
      </section>

      <section className="mb-4">
        {paso(3, "Pega aquí la respuesta completa de la IA")}
        <textarea rows={7} value={pegado} onChange={(e) => { setPegado(e.target.value); setRev(null); }} placeholder="Pega la respuesta de la IA (el bloque que empieza con { y termina con })" className={input + " mb-2"} aria-label="Respuesta de la IA" data-testid="respuesta-ia" />
        <button onClick={revisar} disabled={!pegado.trim()} className="text-xs font-semibold px-3 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50" data-testid="revisar-ia">Revisar la respuesta</button>
      </section>

      {rev && (
        <section className="border-t border-slate-200 pt-4" data-testid="revision-ia">
          <h4 className="text-sm font-bold text-slate-800 mb-2">Revisa antes de crear</h4>
          {rev.avisos.length > 0 && <ul className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-3 list-disc list-inside">{rev.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>}
          {rev.modulos.map((m, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-3 mb-3" data-testid={`rev-mod-${i}`}>
              <div className="grid grid-cols-[1fr_70px_70px] gap-2 mb-2">
                <input value={m.nombre} maxLength={120} onChange={(e) => setMod(i, "nombre", e.target.value)} className={input} aria-label={`Nombre del módulo ${i + 1}`} placeholder="Nombre del módulo" />
                <input type="number" min="0" max="500" value={m.xp} onChange={(e) => setMod(i, "xp", e.target.value)} className={input} aria-label={`XP del módulo ${i + 1}`} title="XP" />
                <input type="number" min="0" max="500" value={m.oro} onChange={(e) => setMod(i, "oro", e.target.value)} className={input} aria-label={`Oro del módulo ${i + 1}`} title="Oro" />
              </div>
              {m.descripcion && <p className="text-xs text-slate-500 mb-2">{m.emoji} {m.descripcion}</p>}
              <p className="text-[11px] text-slate-500 mb-1">{m.buenas} {m.buenas === 1 ? "actividad lista" : "actividades listas"}{m.malas ? ` · ${m.malas} con problema (no se guardarán)` : ""}</p>
              <ul className="space-y-1">
                {m.actividades.map((a, k) => (
                  <li key={k} className={`text-xs rounded-lg px-2 py-1.5 flex items-start gap-2 ${a.error ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-700"}`}>
                    <span>{a.error ? "⚠️" : TIPOS_ACTIVIDAD[a.tipo]?.emoji}</span>
                    <span className="flex-1 min-w-0"><b>{a.titulo || "(sin título)"}</b>{a.tipo ? ` · ${TIPOS_ACTIVIDAD[a.tipo]?.nombre}` : ""}{a.tipo === "pregunta" && !a.error ? ` · correcta: ${String.fromCharCode(65 + a.correcta)}` : ""}{a.tipo === "leccion" && !a.error ? ` · ${a.bloques.length} bloques${a.omitidos ? ` (${a.omitidos} no se pudieron leer)` : ""}` : ""}{a.error && <div className="text-[11px]">Fila {a.fila}: {a.error}</div>}{!a.error && a.detalle && a.detalle.length > 0 && <div className="text-[11px] text-amber-700">{a.detalle.slice(0, 3).join(" · ")}</div>}</span>
                    <button onClick={() => quitarAct(i, k)} className="text-slate-400 hover:text-rose-500" aria-label="Quitar actividad">✕</button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-[11px] text-slate-500 mb-2">Se crearán {rev.modulos.length === 1 ? "como el siguiente módulo" : `como los siguientes ${rev.modulos.length} módulos`} de {materia?.nombre || "General"}, para {etiquetaPara(grado).toLowerCase()}. Después puedes editarlos como cualquier otro.</p>
          <div className="flex justify-end gap-2">
            <button onClick={onCerrar} disabled={guardando} className="text-xs text-slate-500 px-3 py-1.5">Cancelar</button>
            <button onClick={crear} disabled={guardando || rev.modulos.every((m) => !m.buenas)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-50" data-testid="crear-modulos-ia">{guardando ? "Creando…" : rev.modulos.length === 1 ? "Crear el módulo" : `Crear ${rev.modulos.length} módulos`}</button>
          </div>
        </section>
      )}
    </div>
  );
}


// Asistente para UNA lección dentro de un módulo que ya existe: la IA devuelve los bloques y la docente los revisa antes de crearla.
export function CrearLeccionIA({ modulo, siguienteOrden = 1, onCerrar, onCreada }) {
  const [para, setPara] = useState("");
  const [ver, setVer] = useState(false);
  const [copiado, setCopiado] = useState("");
  const [pegado, setPegado] = useState("");
  const [rev, setRev] = useState(null);            // { titulo, leccion, errores, avisos }
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const texto = instruccionesLeccion({ para: para.trim() });
  const copiarInstrucciones = async () => { setCopiado((await copiar(texto)) ? "ok" : "fallo"); setVer(true); setTimeout(() => setCopiado(""), 3000); };
  const revisar = () => {
    setError(""); const r = leerLeccionIA(pegado);
    if (r.error) { setRev(null); setError(r.error); return; }
    const n = normalizarLeccion(r.datos);
    if (!n.leccion.bloques.length) { setRev(null); setError("Ningún bloque de la respuesta se pudo leer" + (n.errores[0] ? `: ${n.errores[0].mensaje}` : ".")); return; }
    setRev({ titulo: n.leccion.titulo || (modulo ? `Lección de ${modulo.nombre}` : "Lección"), bloques: n.leccion.bloques, errores: n.errores, avisos: n.avisos });
  };
  const quitar = (i) => setRev((r) => ({ ...r, bloques: r.bloques.filter((_, k) => k !== i) }));
  const crear = async () => {
    if (!rev.titulo.trim()) { setError("Ponle un título a la lección."); return; }
    setGuardando(true); setError("");
    try { const id = await api.guardarActividad(modulo.id, { tipo: "leccion", titulo: rev.titulo, bloques: rev.bloques }, siguienteOrden); onCreada(id); }
    catch (e) { setError(e.message || "No se pudo crear la lección."); }
    setGuardando(false);
  };
  const paso = (n, t) => <div className="flex items-center gap-2 mb-2"><span className="w-6 h-6 rounded-full bg-violet-500 text-white text-xs font-bold flex items-center justify-center">{n}</span><h4 className="text-sm font-bold text-slate-800">{t}</h4></div>;
  const resumen = rev ? resumenLeccion(rev.bloques) : {};
  return (
    <div data-testid="asistente-leccion-ia">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-bold text-slate-800">✨ Crear la lección con ayuda de una IA</h3>
        <button onClick={onCerrar} className="text-xs text-slate-500 px-2 py-1" data-testid="cerrar-leccion-ia">Cerrar</button>
      </div>
      <p className="text-xs text-slate-500 mb-4">Funciona con ChatGPT, Claude, Gemini o Copilot. La IA prepara el contenido con el formato de la plataforma; tú lo revisas antes de publicarlo. {modulo && <>Se agregará al módulo <b>{modulo.nombre}</b>.</>}</p>
      {error && <div className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 mb-3" data-testid="error-leccion-ia">{error}</div>}
      <section className="mb-5">
        {paso(1, "Copia las instrucciones")}
        <input value={para} onChange={(e) => setPara(e.target.value)} maxLength={100} placeholder="¿Para quién es? (opcional, ej.: octavo, 13 a 14 años)" className={input + " mb-2"} aria-label="Para quién es la lección" />
        <div className="flex flex-wrap gap-2">
          <button onClick={copiarInstrucciones} className="text-xs font-semibold px-3 py-2 rounded-lg bg-violet-500 text-white" data-testid="copiar-instrucciones-leccion">📋 Copiar instrucciones para la IA</button>
          <button onClick={() => setVer((v) => !v)} className="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600">{ver ? "Ocultar las instrucciones" : "Ver las instrucciones"}</button>
          {copiado === "ok" && <span className="text-xs text-emerald-600 self-center" data-testid="copiado-leccion">¡Copiadas! ✓</span>}
          {copiado === "fallo" && <span className="text-xs text-amber-700 self-center">No pude copiar solo: selecciona el texto de abajo y cópialo.</span>}
        </div>
        {ver && <textarea readOnly rows={10} value={texto} onFocus={(e) => e.target.select()} className={input + " mt-2 font-mono text-[11px]"} aria-label="Instrucciones para la IA" data-testid="texto-instrucciones-leccion" />}
      </section>
      <section className="mb-5">
        {paso(2, "Pégalas en la IA junto con el material")}
        <p className="text-xs text-slate-500">Abre la IA, pega las instrucciones y, al final, donde dice «MATERIAL DEL MÓDULO», pega el texto del tema: tus apuntes, un resumen o el contenido del módulo. Envía el mensaje y espera la respuesta.</p>
      </section>
      <section className="mb-4">
        {paso(3, "Pega aquí la respuesta completa de la IA")}
        <textarea rows={7} value={pegado} onChange={(e) => { setPegado(e.target.value); setRev(null); }} placeholder="Pega la respuesta de la IA (el bloque que empieza con { y termina con })" className={input + " mb-2"} aria-label="Respuesta de la IA para la lección" data-testid="respuesta-leccion-ia" />
        <button onClick={revisar} disabled={!pegado.trim()} className="text-xs font-semibold px-3 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50" data-testid="revisar-leccion-ia">Revisar la respuesta</button>
      </section>
      {rev && (
        <section className="border-t border-slate-200 pt-4" data-testid="revision-leccion-ia">
          <h4 className="text-sm font-bold text-slate-800 mb-2">Revisa antes de crear</h4>
          <input value={rev.titulo} maxLength={160} onChange={(e) => setRev((r) => ({ ...r, titulo: e.target.value }))} className={input + " mb-2"} aria-label="Título de la lección" />
          <p className="text-[11px] text-slate-500 mb-2" data-testid="resumen-leccion-ia">{rev.bloques.length} bloques: {Object.entries(resumen).map(([k, v]) => `${v} ${TIPOS_BLOQUE[k].nombre.toLowerCase()}`).join(", ")}.</p>
          {rev.errores.length > 0 && <ul className="text-[11px] text-rose-700 bg-rose-50 rounded-lg px-3 py-2 mb-2 list-disc list-inside" data-testid="errores-leccion-ia">{rev.errores.map((e, i) => <li key={i}>Bloque {e.n} (no se guardará): {e.mensaje}</li>)}</ul>}
          {rev.avisos.length > 0 && <ul className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-2 list-disc list-inside">{rev.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>}
          <ul className="space-y-1 mb-3 max-h-64 overflow-y-auto">
            {rev.bloques.map((b, i) => (
              <li key={b.id} className="text-xs rounded-lg px-2 py-1.5 bg-slate-50 text-slate-700 flex items-start gap-2"><span>{TIPOS_BLOQUE[b.tipo].emoji}</span><span className="flex-1 min-w-0 truncate"><b>{TIPOS_BLOQUE[b.tipo].nombre}</b> · {String(b.titulo || b.contenido || b.pregunta || b.consigna || b.texto || b.descripcion || b.frase || (b.palabras || []).join(", ") || "").replace(/\s+/g, " ").slice(0, 60)}</span><button onClick={() => quitar(i)} className="text-slate-400 hover:text-rose-500" aria-label={`Quitar bloque ${i + 1}`}>✕</button></li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-500 mb-2">Después de crearla puedes abrirla y ajustar lo que quieras (por ejemplo, agregar las imágenes y videos).</p>
          <div className="flex justify-end gap-2">
            <button onClick={onCerrar} disabled={guardando} className="text-xs text-slate-500 px-3 py-1.5">Cancelar</button>
            <button onClick={crear} disabled={guardando || !rev.bloques.length} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-50" data-testid="crear-leccion-ia">{guardando ? "Creando…" : "Crear la lección"}</button>
          </div>
        </section>
      )}
    </div>
  );
}
