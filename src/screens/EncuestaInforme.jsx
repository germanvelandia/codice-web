import React, { useEffect, useMemo, useState } from "react";
import * as enc from "../lib/encuesta";
import { fetchDatosInforme, calcularInforme, informeACSV, informeATexto, descargarArchivo } from "../lib/informeImpacto";
import { fetchMisMaterias } from "../lib/api";

const fmt = (v, d = 1) => (v === null || v === undefined ? "—" : String(Math.round(v * 10 ** d) / 10 ** d).replace(".", ","));
const nombreGrado = (g) => g?.nombre || g?.id;

// ---------- Barras de una pregunta de escala ----------
function BarrasEscala({ item }) {
  const max = Math.max(1, ...item.dist);
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="text-sm font-semibold text-slate-700 mb-2">{item.texto}</div>
      <div className="flex items-end gap-1.5 h-16 mb-1">
        {item.dist.map((n, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
            <div className="text-[10px] text-slate-500">{n}</div>
            <div className="w-full rounded-t bg-violet-400" style={{ height: `${(n / max) * 100}%`, minHeight: n ? 3 : 0 }} />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 text-[10px] text-slate-400 text-center">{[1, 2, 3, 4, 5].map((k) => <div key={k} className="flex-1">{k}</div>)}</div>
      <div className="flex justify-between text-xs mt-2">
        <span>Promedio <b className="text-violet-600">{fmt(item.promedio, 2)}</b></span>
        <span className="text-emerald-600">Favorable {fmt(item.favorable)}%</span>
        <span className="text-rose-500">Desfavorable {fmt(item.desfavorable)}%</span>
      </div>
    </div>
  );
}

function ResultadosEncuesta({ encuesta, estudiantesCurso }) {
  const [filas, setFilas] = useState(null);
  const [participacion, setParticipacion] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let vivo = true;
    Promise.all([enc.fetchRespuestasEncuesta(encuesta.id), enc.fetchParticipacion(encuesta.id)])
      .then(([f, p]) => { if (vivo) { setFilas(f); setParticipacion(p); } })
      .catch((e) => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [encuesta.id]);
  const resumen = useMemo(() => (filas ? enc.resumirEncuesta(encuesta.preguntas, filas) : null), [filas, encuesta]);
  if (error) return <div className="text-xs text-rose-600">{error}</div>;
  if (!resumen) return <div className="text-xs text-slate-400">Cargando resultados…</div>;
  return (
    <div className="mt-3 space-y-2">
      <div className="text-xs text-slate-500">
        Respondieron <b>{participacion}</b>{estudiantesCurso ? <> de {estudiantesCurso}</> : null} · las respuestas son anónimas (no se sabe quién dijo qué).
      </div>
      {resumen.total === 0 && <p className="text-xs text-slate-400">Todavía no hay respuestas.</p>}
      {resumen.total > 0 && (
        <div className="bg-violet-50 rounded-xl p-3 text-center">
          <div className="text-[11px] text-violet-600 font-semibold">Satisfacción global</div>
          <div className="text-3xl font-black text-violet-700">{fmt(resumen.global, 2)}<span className="text-sm font-semibold text-violet-400"> / 5</span></div>
          <div className="text-xs text-slate-500">{fmt(resumen.globalFavorable)}% de valoraciones favorables (4 o 5)</div>
        </div>
      )}
      {resumen.items.filter((i) => i.tipo === "escala").map((i) => <BarrasEscala key={i.id} item={i} />)}
      {resumen.items.filter((i) => i.tipo === "texto").map((i) => (
        <div key={i.id} className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="text-sm font-semibold text-slate-700 mb-1">{i.texto} <span className="text-xs text-slate-400">({i.n})</span></div>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {i.comentarios.map((c, k) => <li key={k} className="text-xs text-slate-600 bg-slate-50 rounded-lg px-2 py-1.5">“{c}”</li>)}
            {i.comentarios.length === 0 && <li className="text-xs text-slate-400">Sin comentarios.</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}

// =====================================================================================
//  DOCENTE: crear y ver encuestas
// =====================================================================================
export function VistaEncuestasDocente({ grados = [] }) {
  const [lista, setLista] = useState([]);
  const [abierta, setAbierta] = useState(null);
  const [creando, setCreando] = useState(false);
  const [titulo, setTitulo] = useState("Encuesta de satisfacción CÓDICE");
  const [gradoId, setGradoId] = useState("");
  const [preguntas, setPreguntas] = useState(enc.PREGUNTAS_BASE.map((p) => ({ ...p })));
  const [guardando, setGuardando] = useState(false);

  const cargar = () => enc.fetchMisEncuestas().then(setLista).catch(() => setLista([]));
  useEffect(() => { cargar(); }, []);

  const crear = async () => {
    setGuardando(true);
    try {
      await enc.crearEncuesta({ titulo, gradoId: gradoId || null, preguntas });
      setCreando(false); await cargar();
    } catch (e) { alert("No se pudo crear: " + e.message); }
    setGuardando(false);
  };
  const gradoDe = (id) => nombreGrado(grados.find((g) => String(g.id) === String(id))) || "Todos los cursos";

  return (
    <div>
      <div className="flex justify-between items-start mb-3 gap-2">
        <div>
          <h3 className="font-bold text-slate-800">📝 Encuesta de satisfacción</h3>
          <p className="text-xs text-slate-400">Anónima: tus estudiantes la contestan desde su portal (menú “Mi cuenta → Encuesta”) y tú ves solo los resultados agrupados.</p>
        </div>
        {!creando && <button onClick={() => setCreando(true)} className="shrink-0 text-xs font-semibold px-3 py-2 rounded-lg bg-violet-500 text-white">+ Nueva</button>}
      </div>

      {creando && (
        <div className="bg-slate-50 rounded-2xl p-3 mb-4 space-y-2">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" placeholder="Título" />
          <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 bg-white outline-none">
            <option value="">Todos los cursos</option>
            {grados.map((g) => <option key={g.id} value={g.id}>{nombreGrado(g)}</option>)}
          </select>
          <div className="text-xs font-semibold text-slate-600">Preguntas (escala 1–5 o respuesta abierta)</div>
          {preguntas.map((p, i) => (
            <div key={i} className="flex gap-1.5 items-center">
              <select value={p.tipo} onChange={(e) => setPreguntas(preguntas.map((x, k) => (k === i ? { ...x, tipo: e.target.value } : x)))} className="text-[11px] rounded-lg px-1.5 py-1.5 border border-slate-200 bg-white">
                <option value="escala">1–5</option><option value="texto">Abierta</option>
              </select>
              <input value={p.texto} onChange={(e) => setPreguntas(preguntas.map((x, k) => (k === i ? { ...x, texto: e.target.value } : x)))} className="flex-1 text-xs rounded-lg px-2 py-1.5 border border-slate-200 bg-white outline-none" />
              <button onClick={() => setPreguntas(preguntas.filter((_, k) => k !== i))} className="text-slate-400 hover:text-rose-500">✕</button>
            </div>
          ))}
          <button onClick={() => setPreguntas([...preguntas, { id: `p${Date.now()}`, tipo: "escala", texto: "" }])} className="text-xs text-violet-600 font-semibold">+ Agregar pregunta</button>
          <div className="flex gap-2 pt-1">
            <button disabled={guardando} onClick={crear} className="flex-1 text-sm font-semibold py-2 rounded-xl bg-emerald-500 text-white disabled:opacity-60">{guardando ? "Creando…" : "Crear y activar"}</button>
            <button onClick={() => setCreando(false)} className="text-sm text-slate-500 px-3">Cancelar</button>
          </div>
        </div>
      )}

      {lista.length === 0 && !creando && <p className="text-xs text-slate-400">Aún no has creado ninguna encuesta.</p>}
      <div className="space-y-2">
        {lista.map((e) => (
          <div key={e.id} className="border border-slate-200 rounded-xl p-3 bg-white">
            <div className="flex justify-between gap-2 items-start">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-700 truncate">{e.titulo}</div>
                <div className="text-[11px] text-slate-400">{gradoDe(e.grado_id)} · {e.activa ? "🟢 abierta" : "⚪ cerrada"} · {new Date(e.creado_en).toLocaleDateString()}</div>
              </div>
              <div className="flex gap-2 shrink-0 items-center">
                <button onClick={async () => { await enc.activarEncuesta(e.id, !e.activa); cargar(); }} className="text-[11px] px-2 py-1 rounded-lg bg-slate-100 text-slate-600">{e.activa ? "Cerrar" : "Reabrir"}</button>
                <button onClick={() => setAbierta(abierta === e.id ? null : e.id)} className="text-[11px] px-2 py-1 rounded-lg bg-violet-500 text-white">{abierta === e.id ? "Ocultar" : "Resultados"}</button>
                <button onClick={async () => { if (!confirm("¿Borrar esta encuesta y todas sus respuestas?")) return; await enc.eliminarEncuesta(e.id); cargar(); }} className="text-slate-400 hover:text-rose-500">🗑</button>
              </div>
            </div>
            {abierta === e.id && <ResultadosEncuesta encuesta={e} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================================================
//  DOCENTE: informe de impacto
// =====================================================================================
const escapar = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function htmlImpresion(inf, resumen, etiqueta) {
  const f = (v, d = 1) => fmt(v, d);
  const filasPer = inf.porPeriodo.map((p) => `<tr><td>${p.periodo}</td><td>${p.n}</td><td>${f(p.promedio, 2)}</td><td>${f(p.pctAprobados)}%</td><td>${p.bandas.bajo}</td><td>${p.bandas.basico}</td><td>${p.bandas.alto}</td><td>${p.bandas.superior}</td></tr>`).join("");
  const filasMat = inf.porMateria.map((m) => `<tr><td>${escapar(m.nombre)}</td><td>${m.n}</td><td>${f(m.promedio, 2)}</td><td>${f(m.pctAprobados)}%</td></tr>`).join("");
  const filasEnc = resumen && resumen.total ? resumen.items.filter((i) => i.tipo === "escala").map((i) => `<tr><td>${escapar(i.texto)}</td><td>${f(i.promedio, 2)}</td><td>${f(i.favorable)}%</td></tr>`).join("") : "";
  const e = inf.evolucion; const a = inf.asistencia;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe de impacto</title>
<style>body{font-family:Arial,sans-serif;color:#222;margin:32px;font-size:13px}h1{font-size:20px;margin:0}h2{font-size:15px;margin:22px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:4px 7px;text-align:left}th{background:#f1f1f1}.n{color:#666;font-size:11px;margin-top:18px}</style></head><body>
<h1>Informe de impacto — ${escapar(etiqueta)}</h1><div class="n">${inf.totalEstudiantes} estudiantes · nota mínima de aprobación ${f(inf.notaMin)} · generado ${new Date().toLocaleDateString()}</div>
<h2>Rendimiento por periodo</h2><table><tr><th>Periodo</th><th>Con nota</th><th>Promedio</th><th>% aprobados</th><th>Bajo</th><th>Básico</th><th>Alto</th><th>Superior</th></tr>${filasPer}</table>
${e ? `<p>Del periodo ${e.desde} al ${e.hasta}: promedio ${e.cambioPromedio > 0 ? "+" : ""}${f(e.cambioPromedio, 2)}, aprobación ${e.cambioAprobados > 0 ? "+" : ""}${f(e.cambioAprobados)} puntos. De ${e.comparados} estudiantes comparados: ${e.mejoran} mejoraron, ${e.igual} igual, ${e.empeoran} bajaron.</p>` : ""}
<h2>Por materia</h2><table><tr><th>Materia</th><th>Notas</th><th>Promedio</th><th>% aprobados</th></tr>${filasMat}</table>
<h2>Asistencia</h2><p>${a.total} registros: ${f(a.pctPresente)}% presente, ${f(a.pctRetardo)}% retardo, ${f(a.pctFI)}% falta injustificada, ${f(a.pctFJ)}% falta justificada.</p>
${filasEnc ? `<h2>Encuesta de satisfacción (${resumen.total} respuestas anónimas)</h2><p>Promedio global ${f(resumen.global, 2)} / 5 · ${f(resumen.globalFavorable)}% favorable</p><table><tr><th>Pregunta</th><th>Promedio</th><th>% favorable</th></tr>${filasEnc}</table>` : ""}
<p class="n">Los cambios entre periodos describen lo observado en el curso; por sí solos no prueban que CÓDICE los haya causado.</p>
<script>window.onload=function(){window.print()}</script></body></html>`;
}

export function VistaInformeImpacto({ grados = [] }) {
  const [gradoId, setGradoId] = useState(grados[0]?.id ?? "");
  const [materias, setMaterias] = useState([]);
  const [materiaId, setMateriaId] = useState("");
  const [notaMin, setNotaMin] = useState(3);
  const [datos, setDatos] = useState(null);
  const [encuestas, setEncuestas] = useState([]);
  const [encuestaId, setEncuestaId] = useState("");
  const [resumenEnc, setResumenEnc] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (!gradoId && grados[0]) setGradoId(grados[0].id); }, [grados]);
  useEffect(() => { fetchMisMaterias().then(setMaterias).catch(() => setMaterias([])); enc.fetchMisEncuestas().then(setEncuestas).catch(() => setEncuestas([])); }, []);

  const generar = async () => {
    if (!gradoId) return;
    setCargando(true); setError(""); setDatos(null); setResumenEnc(null);
    try {
      setDatos(await fetchDatosInforme(gradoId));
      const e = encuestas.find((x) => x.id === encuestaId);
      if (e) setResumenEnc(enc.resumirEncuesta(e.preguntas, await enc.fetchRespuestasEncuesta(e.id)));
    } catch (err) { setError(err.message); }
    setCargando(false);
  };

  const inf = useMemo(() => (datos ? calcularInforme(datos, { notaMin: Number(notaMin) || 3, materiaId: materiaId || null }) : null), [datos, notaMin, materiaId]);
  const grado = grados.find((g) => String(g.id) === String(gradoId));
  const materia = materias.find((m) => String(m.id) === String(materiaId));
  const etiqueta = `${nombreGrado(grado) || ""}${materia ? " · " + materia.nombre : " · todas las materias"}`;

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">📊 Informe de impacto</h3>
      <p className="text-xs text-slate-400 mb-3">Reúne notas por periodo, aprobación, asistencia y la encuesta de satisfacción de un curso. Sirve para tu informe de la maestría.</p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-lg px-2 py-2 border border-slate-200 bg-white outline-none">
          {grados.map((g) => <option key={g.id} value={g.id}>{nombreGrado(g)}</option>)}
        </select>
        <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)} className="text-sm rounded-lg px-2 py-2 border border-slate-200 bg-white outline-none">
          <option value="">Todas las materias</option>
          {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        <select value={encuestaId} onChange={(e) => setEncuestaId(e.target.value)} className="text-sm rounded-lg px-2 py-2 border border-slate-200 bg-white outline-none">
          <option value="">Sin encuesta</option>
          {encuestas.map((e) => <option key={e.id} value={e.id}>{e.titulo}</option>)}
        </select>
        <label className="text-xs text-slate-500 flex items-center gap-2">Nota mínima
          <input type="number" step="0.1" min="1" max="5" value={notaMin} onChange={(e) => setNotaMin(e.target.value)} className="w-16 text-sm rounded-lg px-2 py-1.5 border border-slate-200" />
        </label>
      </div>
      <button disabled={cargando || !gradoId} onClick={generar} className="w-full text-sm font-semibold py-2.5 rounded-xl bg-violet-500 text-white disabled:opacity-60 mb-3">{cargando ? "Calculando…" : "Generar informe"}</button>
      {error && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2 mb-2">{error}</div>}

      {inf && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-violet-50 rounded-xl p-2"><div className="text-[10px] text-violet-600">Estudiantes</div><div className="text-xl font-black text-violet-700">{inf.totalEstudiantes}</div></div>
            <div className="bg-emerald-50 rounded-xl p-2"><div className="text-[10px] text-emerald-600">Asistió (P + R)</div><div className="text-xl font-black text-emerald-700">{fmt(inf.asistencia.pctAsistio)}%</div></div>
            <div className="bg-amber-50 rounded-xl p-2"><div className="text-[10px] text-amber-600">Satisfacción</div><div className="text-xl font-black text-amber-700">{resumenEnc?.total ? fmt(resumenEnc.global, 2) : "—"}</div></div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-600 mb-1">Rendimiento por periodo</div>
            {inf.porPeriodo.length === 0 ? <p className="text-xs text-slate-400">No hay notas finales de periodo guardadas todavía.</p> : (
              <div className="overflow-x-auto"><table className="w-full text-xs">
                <thead><tr className="text-slate-400 text-left"><th className="py-1">Periodo</th><th>Con nota</th><th>Promedio</th><th>% aprob.</th><th>Bajo</th><th>Básico</th><th>Alto</th><th>Superior</th></tr></thead>
                <tbody>{inf.porPeriodo.map((p) => (
                  <tr key={p.periodo} className="border-t border-slate-100"><td className="py-1 font-semibold">{p.periodo}</td><td>{p.n}</td><td className="font-bold text-violet-600">{fmt(p.promedio, 2)}</td><td>{fmt(p.pctAprobados)}%</td><td>{p.bandas.bajo}</td><td>{p.bandas.basico}</td><td>{p.bandas.alto}</td><td>{p.bandas.superior}</td></tr>
                ))}</tbody>
              </table></div>
            )}
            {inf.evolucion && (
              <div className="mt-2 text-xs bg-slate-50 rounded-xl p-2.5 text-slate-600">
                Del periodo {inf.evolucion.desde} al {inf.evolucion.hasta}: promedio <b className={inf.evolucion.cambioPromedio >= 0 ? "text-emerald-600" : "text-rose-600"}>{inf.evolucion.cambioPromedio > 0 ? "+" : ""}{fmt(inf.evolucion.cambioPromedio, 2)}</b>, aprobación <b>{inf.evolucion.cambioAprobados > 0 ? "+" : ""}{fmt(inf.evolucion.cambioAprobados)} pts</b>.
                De {inf.evolucion.comparados} estudiantes comparados: {inf.evolucion.mejoran} mejoraron, {inf.evolucion.igual} igual, {inf.evolucion.empeoran} bajaron.
              </div>
            )}
          </div>

          {inf.porMateria.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-1">Por materia</div>
              {inf.porMateria.map((m) => (
                <div key={m.id} className="flex justify-between text-xs bg-slate-50 rounded-lg px-3 py-1.5 mb-1"><span>{m.nombre}</span><span>prom. <b className="text-violet-600">{fmt(m.promedio, 2)}</b> · aprob. {fmt(m.pctAprobados)}%</span></div>
              ))}
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-slate-600 mb-1">Asistencia ({inf.asistencia.total} registros)</div>
            <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-2.5">
              Presente {fmt(inf.asistencia.pctPresente)}% · Retardo {fmt(inf.asistencia.pctRetardo)}% · Falta injustificada {fmt(inf.asistencia.pctFI)}% · Falta justificada {fmt(inf.asistencia.pctFJ)}%
            </div>
          </div>

          {resumenEnc && resumenEnc.total > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-1">Encuesta ({resumenEnc.total} respuestas anónimas)</div>
              {resumenEnc.items.filter((i) => i.tipo === "escala").map((i) => (
                <div key={i.id} className="flex justify-between gap-2 text-xs bg-slate-50 rounded-lg px-3 py-1.5 mb-1"><span className="truncate">{i.texto}</span><span className="shrink-0 font-bold text-violet-600">{fmt(i.promedio, 2)} · {fmt(i.favorable)}%</span></div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={() => descargarArchivo(`informe_impacto_${String(nombreGrado(grado) || "curso").replace(/\W+/g, "_")}.csv`, informeACSV(inf, resumenEnc, etiqueta))} className="text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-500 text-white">⬇ Descargar Excel (CSV)</button>
            <button onClick={() => { const w = window.open("", "_blank"); if (!w) { alert("Tu navegador bloqueó la ventana. Permite ventanas emergentes e inténtalo de nuevo."); return; } w.document.write(htmlImpresion(inf, resumenEnc, etiqueta)); w.document.close(); }} className="text-xs font-semibold px-3 py-2 rounded-lg bg-slate-700 text-white">🖨 Imprimir / PDF</button>
            <button onClick={async () => { try { await navigator.clipboard.writeText(informeATexto(inf, resumenEnc, etiqueta)); alert("Resumen copiado. Pégalo en tu documento."); } catch { alert("No se pudo copiar automáticamente."); } }} className="text-xs font-semibold px-3 py-2 rounded-lg bg-violet-500 text-white">📋 Copiar resumen</button>
          </div>
          <p className="text-[11px] text-slate-400">Los cambios entre periodos describen lo observado; por sí solos no prueban que CÓDICE los haya causado.</p>
        </div>
      )}
    </div>
  );
}

// =====================================================================================
//  ESTUDIANTE
// =====================================================================================
export function EncuestaEstudiante() {
  const [pendientes, setPendientes] = useState(null);
  const [error, setError] = useState("");
  const [gracias, setGracias] = useState(false);
  const cargar = () => enc.fetchEncuestasPendientes().then((d) => { setPendientes(d); setError(""); }).catch((e) => { setPendientes([]); setError(enc.mensajeEncuesta(e)); });
  useEffect(() => { cargar(); }, []);

  if (pendientes === null) return <div className="text-sm text-slate-400 text-center py-8">Cargando…</div>;
  return (
    <div className="max-w-md mx-auto">
      {error && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2 mb-3">{error}</div>}
      {gracias && <div className="text-center bg-emerald-50 text-emerald-700 rounded-2xl py-4 mb-3 font-semibold">💜 ¡Gracias! Tu opinión ayuda a mejorar las clases.</div>}
      {pendientes.length === 0 && !gracias && (
        <div className="text-center py-10"><div className="text-4xl mb-2">📝</div><p className="text-sm text-slate-500">No tienes encuestas pendientes.</p></div>
      )}
      {pendientes.map((e) => <FormularioEncuesta key={e.id} encuesta={e} onEnviada={() => { setGracias(true); cargar(); }} />)}
    </div>
  );
}

function FormularioEncuesta({ encuesta, onEnviada }) {
  const [resp, setResp] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const enviar = async () => {
    setEnviando(true); setError("");
    try { await enc.responderEncuesta(encuesta.id, resp); onEnviada(); }
    catch (e) { setError(enc.mensajeEncuesta(e)); }
    setEnviando(false);
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
      <div className="font-bold text-slate-800">{encuesta.titulo}</div>
      {encuesta.descripcion && <p className="text-xs text-slate-500 mt-1">{encuesta.descripcion}</p>}
      <p className="text-[11px] text-violet-600 bg-violet-50 rounded-lg px-2 py-1.5 mt-2 mb-3">🔒 Es anónima: tu docente no verá tu nombre junto a tus respuestas.</p>
      <div className="space-y-4">
        {encuesta.preguntas.map((p) => (
          <div key={p.id}>
            <div className="text-sm font-semibold text-slate-700 mb-1.5">{p.texto}</div>
            {p.tipo === "escala" ? (
              <div>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setResp({ ...resp, [p.id]: n })} className={`flex-1 py-2 rounded-xl text-sm font-bold border ${resp[p.id] === n ? "bg-violet-500 text-white border-violet-500" : "bg-white text-slate-600 border-slate-200"}`}>{n}</button>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>Nada de acuerdo</span><span>Totalmente de acuerdo</span></div>
              </div>
            ) : (
              <textarea rows={3} maxLength={1000} value={resp[p.id] || ""} onChange={(e) => setResp({ ...resp, [p.id]: e.target.value })} className="w-full text-sm rounded-xl px-3 py-2 border border-slate-200 outline-none" placeholder="Escribe aquí (opcional)" />
            )}
          </div>
        ))}
      </div>
      {error && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2 mt-3">{error}</div>}
      <button disabled={enviando || Object.keys(resp).length === 0} onClick={enviar} className="w-full mt-4 text-sm font-bold py-3 rounded-xl bg-violet-500 text-white disabled:opacity-50">{enviando ? "Enviando…" : "Enviar mis respuestas"}</button>
    </div>
  );
}
