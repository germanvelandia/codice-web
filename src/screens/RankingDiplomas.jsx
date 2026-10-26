import React, { useEffect, useMemo, useState } from "react";
import * as api from "../lib/api";
import * as dp from "../lib/diplomasApi";
import { ordenarPorApellido } from "../lib/gamification";
import { TIPOS_DIPLOMA, ASIGNATURAS, htmlDiploma } from "./Diplomas";

const sinTildes = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function asignaturaPorNombre(nombre) {
  const n = sinTildes(nombre);
  if (/etica|religi/.test(n)) return "etica_religion"; if (/filosof/.test(n)) return "sociales";
  if (/mat/.test(n)) return "matematicas"; if (/cienc.*nat|biolog|quimic|fisic/.test(n)) return "ciencias";
  if (/lengu|liter|castell/.test(n)) return "lenguaje"; if (/social/.test(n)) return "sociales";
  if (/fisica|deporte/.test(n)) return "educacion_fisica"; if (/ingl/.test(n)) return "ingles"; if (/art/.test(n)) return "artistica";
  return "general";
}
const PUESTOS = ["", "PRIMER PUESTO", "SEGUNDO PUESTO", "TERCER PUESTO"];
const fechaHoy = () => new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" }) + " · Bogotá D.C., Colombia";

// Documento completo (para ventana de impresión o vista previa en iframe)
export function documentoDiplomas(lista, { barra = true } = {}) {
  const opciones = lista.map((d, i) => `<option value="dip${i}">${d.gradoId} - ${d.estudianteNombre}</option>`).join("");
  const slides = lista.map((d, i) => `<div id="dip${i}">${htmlDiploma(d)}</div>`).join("");
  return `<html><head><meta charset="utf-8"><title>Diploma</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet">
    <style>*{box-sizing:border-box;margin:0;padding:0}body{background:${barra ? "#0b132b" : "#fff"};font-family:'Montserrat',sans-serif;display:flex;flex-direction:column;align-items:center;padding:${barra ? "20px 0 60px" : "0"}}
    .bar{position:sticky;top:15px;z-index:1000;background:rgba(15,23,42,.92);padding:12px 24px;border-radius:50px;border:1px solid rgba(217,119,6,.4);display:flex;gap:15px;align-items:center;margin-bottom:25px;color:#f1f5f9;font-size:13px}
    .bar select{background:#1e293b;color:#fbbf24;border:1px solid #d97706;padding:6px 14px;border-radius:20px}
    .bar button{background:linear-gradient(135deg,#d97706,#b45309);color:#fff;border:none;padding:8px 18px;border-radius:20px;font-weight:700;cursor:pointer}
    @page{size:1280px 720px;margin:0}
    @media print{body{background:#fff;padding:0}.bar{display:none!important}.slide{box-shadow:none!important;margin:0!important;border-radius:0!important}}</style></head><body>
    ${barra ? `<div class="bar"><span>🎓</span>${lista.length > 1 ? `<select onchange="document.getElementById(this.value).scrollIntoView({behavior:'smooth',block:'center'})">${opciones}</select>` : ""}<button onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button></div>` : ""}
    ${slides}</body></html>`;
}
export function abrirDiplomas(lista) {
  const w = window.open("", "_blank");
  if (!w) { alert("El navegador bloqueó la ventana. Permite ventanas emergentes para esta página."); return; }
  w.document.write(documentoDiplomas(lista)); w.document.close();
}

/* ======================= DOCENTE ======================= */
export function VistaRankingDiplomas({ grados, gradoActivo }) {
  const [materias, setMaterias] = useState([]);
  const [materiaId, setMateriaId] = useState("");
  const [gradoId, setGradoId] = useState(gradoActivo || grados[0]?.id || "");
  const [estudiantes, setEstudiantes] = useState([]);
  const [periodosSel, setPeriodosSel] = useState(null); // null = todos los cerrados
  const [rank, setRank] = useState({ lista: [], periodosExistentes: [] });
  const [sel, setSel] = useState(new Set());
  const [tipoKey, setTipoKey] = useState("mejor_promedio");
  const [asigKey, setAsigKey] = useState("etica_religion");
  const [firma, setFirma] = useState(""); const [cargo, setCargo] = useState("Docente");
  const [institucion, setInstitucion] = useState(null);
  const [otorgados, setOtorgados] = useState([]);
  const [msg, setMsg] = useState(""); const [error, setError] = useState(""); const [cargando, setCargando] = useState(false);
  const [topN, setTopN] = useState(3);

  useEffect(() => {
    api.fetchMisMaterias().then((m) => { setMaterias(m); if (m[0]) setMateriaId(String(m[0].id)); });
    api.fetchInstitucion().then(setInstitucion);
    api.fetchMiPerfil().then((p) => setFirma(p?.nombre || ""));
  }, []);
  useEffect(() => { if (gradoActivo) setGradoId(gradoActivo); }, [gradoActivo]);
  useEffect(() => { if (!gradoId) return; api.fetchEstudiantesPorGrado(gradoId).then((d) => setEstudiantes(ordenarPorApellido(d))); }, [gradoId]);
  const materia = materias.find((m) => String(m.id) === String(materiaId));
  useEffect(() => { if (materia) setAsigKey(asignaturaPorNombre(materia.nombre)); }, [materiaId, materias.length]);

  const recargarOtorgados = () => dp.fetchDiplomasOtorgados(gradoId, materiaId).then(setOtorgados).catch(() => {});
  useEffect(() => {
    if (!materiaId || !estudiantes.length) { setRank({ lista: [], periodosExistentes: [] }); return; }
    setCargando(true); setError("");
    dp.calcularRanking(materiaId, estudiantes, periodosSel).then((r) => {
      setRank(r); setSel(new Set(r.lista.filter((x) => x.puesto <= topN).map((x) => String(x.id)))); setCargando(false);
    }).catch((e) => { setError(e.message); setCargando(false); });
    recargarOtorgados();
  }, [materiaId, estudiantes, periodosSel, topN]);

  const tipo = TIPOS_DIPLOMA.find((t) => t.key === tipoKey);
  const nombrePeriodos = (periodosSel || rank.periodosExistentes).map((p) => `P${p}`).join(" + ") || "";
  const periodoClave = (periodosSel || rank.periodosExistentes).join("+");

  const armar = (r) => {
    const esPuesto = tipoKey === "mejor_promedio" && r.puesto <= 3;
    return {
      institucion, estudianteNombre: r.nombre, gradoId,
      tituloDiploma: tipoKey === "mejor_promedio" ? (r.puesto === 1 ? tipo.titulo : `DIPLOMA AL ${PUESTOS[r.puesto] || "DESEMPEÑO DESTACADO"}`) : tipo.titulo,
      subtitulo: tipoKey === "mejor_promedio" ? `${PUESTOS[r.puesto] || "DESEMPEÑO DESTACADO"} · ${materia?.nombre || ""}`.toUpperCase() : tipo.subtitulo,
      badge: tipo.badge,
      motivo: `Por su excelente desempeño en ${materia?.nombre || "la asignatura"}${nombrePeriodos ? ` (${nombrePeriodos})` : ""}, ocupando el puesto ${r.puesto} del curso ${gradoId} con un promedio de ${r.promedio.toFixed(1)}.`,
      puntajes: [{ label: materia?.nombre || "Promedio", valor: r.promedio.toFixed(1) }],
      fecha: fechaHoy(), docenteNombre: firma, docenteRol: cargo,
      asignatura: ASIGNATURAS[asigKey] || ASIGNATURAS.general, _esPuesto: esPuesto,
    };
  };
  const elegidos = rank.lista.filter((r) => sel.has(String(r.id)));
  const alt = (id) => setSel((s) => { const n = new Set(s); n.has(String(id)) ? n.delete(String(id)) : n.add(String(id)); return n; });

  const vistaPrevia = () => elegidos.length ? abrirDiplomas(elegidos.map(armar)) : setMsg("Marca al menos un estudiante.");
  const otorgar = async () => {
    if (!elegidos.length) { setMsg("Marca al menos un estudiante."); return; }
    setError(""); setMsg("Guardando…");
    try {
      await dp.otorgarDiplomas(elegidos.map((r) => {
        const { institucion: inst, ...datos } = armar(r);
        return { estudiante_id: r.id, grado_id: gradoId, materia_id: String(materiaId), materia_nombre: materia?.nombre || "", periodo: periodoClave, puesto: r.puesto, promedio: Math.round(r.promedio * 10) / 10, tipo: tipoKey, datos: { ...datos, institucion: { nombre: inst?.nombre, logo_url: inst?.logo_url || null } } };
      }));
      setMsg(`✔ ${elegidos.length} diploma(s) otorgado(s): ya aparecen en «Mis diplomas» de cada estudiante.`); recargarOtorgados();
    } catch (e) { setError(e.message); setMsg(""); }
  };
  const retirar = async (id) => { if (!confirm("¿Retirar este diploma? El estudiante dejará de verlo.")) return; await dp.retirarDiploma(id); recargarOtorgados(); };
  const nombreDe = (id) => estudiantes.find((e) => String(e.id) === String(id))?.nombre || id;

  return (
    <div className="space-y-4 w-full max-w-5xl">
      <div>
        <h2 className="text-xl font-bold text-slate-800">🏆 Ranking y diplomas por asignatura</h2>
        <p className="text-sm text-slate-400">Toma las notas finales de periodo ya <b>cerradas</b>. Marca a quién premiar y otórgale el diploma: queda en su usuario para ver, imprimir o guardar en PDF.</p>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 bg-white">
          {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 bg-white">
          {grados.map((g) => <option key={g.id} value={g.id}>Curso {g.nombre || g.id}</option>)}
        </select>
        {rank.periodosExistentes.map((p) => {
          const act = (periodosSel || rank.periodosExistentes).includes(p);
          return <button key={p} onClick={() => { const base = periodosSel || rank.periodosExistentes; setPeriodosSel(act ? base.filter((x) => x !== p) : [...base, p].sort()); }}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${act ? "bg-violet-500 text-white border-violet-500" : "bg-white text-slate-500 border-slate-200"}`}>Periodo {p}</button>;
        })}
        <label className="text-xs text-slate-500">Marcar los primeros <input type="number" min={1} max={10} value={topN} onChange={(e) => setTopN(Math.max(1, Number(e.target.value) || 1))} className="w-14 border rounded-lg px-2 py-1 ml-1" /></label>
      </div>

      {error && <div className="text-xs bg-rose-50 text-rose-700 rounded-lg px-3 py-2">{error}</div>}
      {cargando ? <div className="text-sm text-slate-400">Calculando…</div> : rank.lista.length === 0 ? (
        <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4">No hay notas finales cerradas de esta materia en este curso. Cierra el periodo en la Planilla y vuelve.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-slate-400 border-b"><th className="p-2 w-8"></th><th className="p-2">Puesto</th><th className="p-2">Estudiante</th>
              {(periodosSel || rank.periodosExistentes).map((p) => <th key={p} className="p-2 text-center">P{p}</th>)}<th className="p-2 text-center">Promedio</th></tr></thead>
            <tbody>
              {rank.lista.map((r) => (
                <tr key={r.id} className={`border-b border-slate-50 ${sel.has(String(r.id)) ? "bg-violet-50" : ""}`}>
                  <td className="p-2"><input type="checkbox" checked={sel.has(String(r.id))} onChange={() => alt(r.id)} /></td>
                  <td className="p-2 font-bold text-slate-700">{r.puesto <= 3 ? ["🥇", "🥈", "🥉"][r.puesto - 1] : r.puesto}</td>
                  <td className="p-2 text-slate-700">{r.nombre}</td>
                  {(periodosSel || rank.periodosExistentes).map((p) => <td key={p} className="p-2 text-center text-slate-500">{r.porPeriodo[p] != null ? Number(r.porPeriodo[p]).toFixed(1) : "–"}</td>)}
                  <td className="p-2 text-center font-bold text-violet-700">{r.promedio.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {TIPOS_DIPLOMA.filter((t) => ["mejor_promedio", "excelencia", "esfuerzo", "personalizado"].includes(t.key)).map((t) => (
            <button key={t.key} onClick={() => setTipoKey(t.key)} className={`text-[11px] px-2.5 py-1.5 rounded-full ${tipoKey === t.key ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-600"}`}>{t.titulo.replace("DIPLOMA ", "")}</button>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <label className="text-xs text-slate-500">Diseño de asignatura
            <select value={asigKey} onChange={(e) => setAsigKey(e.target.value)} className="w-full text-sm rounded-lg px-2 py-2 border border-slate-200 mt-1">
              {Object.entries(ASIGNATURAS).map(([k, a]) => <option key={k} value={k}>{a.label}</option>)}
            </select></label>
          <label className="text-xs text-slate-500">Nombre en la firma<input value={firma} onChange={(e) => setFirma(e.target.value)} className="w-full text-sm rounded-lg px-2 py-2 border border-slate-200 mt-1" /></label>
          <label className="text-xs text-slate-500">Cargo<input value={cargo} onChange={(e) => setCargo(e.target.value)} className="w-full text-sm rounded-lg px-2 py-2 border border-slate-200 mt-1" /></label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={vistaPrevia} className="text-xs font-semibold px-4 py-2 rounded-xl border border-violet-300 text-violet-700">👁️ Ver / imprimir {elegidos.length}</button>
          <button onClick={otorgar} className="text-xs font-semibold px-4 py-2 rounded-xl bg-violet-500 text-white">🎖️ Otorgar a {elegidos.length} estudiante{elegidos.length !== 1 ? "s" : ""}</button>
        </div>
        {msg && <div className="text-xs text-emerald-700">{msg}</div>}
        <p className="text-[11px] text-slate-400">Si otorgas de nuevo el mismo tipo en la misma materia y periodos, el diploma se actualiza (no se duplica).</p>
      </div>

      {otorgados.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-600 mb-2">🎖️ Ya otorgados en esta materia y curso</div>
          <div className="space-y-1">
            {otorgados.map((o) => (
              <div key={o.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-1.5">
                <span>{nombreDe(o.estudiante_id)} · {o.datos?.tituloDiploma} · puesto {o.puesto} · {Number(o.promedio).toFixed(1)}</span>
                <button onClick={() => retirar(o.id)} className="text-rose-500">Retirar</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ======================= ESTUDIANTE ======================= */
function datosParaHtml(d, nombreEst) {
  const x = d.datos || {};
  return { ...x, estudianteNombre: x.estudianteNombre || nombreEst || "", gradoId: x.gradoId, institucion: x.institucion, asignatura: x.asignatura || ASIGNATURAS.general };
}

export function DiplomasEstudiante({ nombre }) {
  const [lista, setLista] = useState(null); const [error, setError] = useState("");
  useEffect(() => { dp.fetchMisDiplomas().then(setLista).catch((e) => { setError(e.message); setLista([]); }); }, []);
  if (lista === null) return <div className="text-sm text-slate-400">Cargando…</div>;
  return (
    <div className="w-full max-w-5xl space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-800">🎖️ Mis diplomas</h2>
        <p className="text-sm text-slate-400">Los reconocimientos que tus docentes te han otorgado. Puedes imprimirlos o guardarlos en PDF.</p>
      </div>
      {error && <div className="text-xs bg-rose-50 text-rose-700 rounded-lg px-3 py-2">{error}</div>}
      {lista.length === 0 && !error && <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4">Aún no tienes diplomas. ¡Sigue esforzándote! 🌟</div>}
      <div className="grid sm:grid-cols-2 gap-4">
        {lista.map((d) => {
          const datos = datosParaHtml(d, nombre);
          const doc = documentoDiplomas([datos], { barra: false });
          return (
            <div key={d.id} className="bg-white rounded-2xl border border-slate-200 p-3">
              <div style={{ width: "100%", aspectRatio: "16/9", overflow: "hidden", position: "relative" }} className="rounded-xl border border-amber-200 bg-amber-50">
                <iframe title={`diploma-${d.id}`} srcDoc={doc} scrolling="no" style={{ width: 1280, height: 720, border: 0, transformOrigin: "0 0", transform: "scale(var(--s))", pointerEvents: "none" }}
                  ref={(el) => { if (el && el.parentElement) el.style.setProperty("--s", String(el.parentElement.clientWidth / 1280)); }} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="text-xs text-slate-600"><b>{d.materia || "Diploma"}</b>{d.puesto ? ` · puesto ${d.puesto}` : ""}<div className="text-[10px] text-slate-400">{new Date(d.creado_en).toLocaleDateString("es-CO")}</div></div>
                <button onClick={() => abrirDiplomas([datos])} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white">🖨️ Imprimir / PDF</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
