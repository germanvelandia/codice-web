import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { ordenarPorApellido } from "../lib/gamification";

const TIPOS_DIPLOMA = [
  { key: "excelencia", titulo: "DIPLOMA DE EXCELENCIA ACADÉMICA", motivo: "Por su destacado desempeño académico y compromiso constante con su proceso de aprendizaje durante el periodo." },
  { key: "mejor_promedio", titulo: "DIPLOMA AL MEJOR PROMEDIO", titulo2: "", motivo: "Por haber obtenido el mejor promedio académico del curso durante el periodo." },
  { key: "convivencia", titulo: "DIPLOMA AL MÉRITO CONVIVENCIAL", motivo: "Por su ejemplar comportamiento, respeto y aporte a la sana convivencia dentro de la comunidad educativa." },
  { key: "asistencia", titulo: "DIPLOMA A LA ASISTENCIA PERFECTA", motivo: "Por su constancia y puntualidad, sin registrar inasistencias durante el periodo evaluado." },
  { key: "liderazgo", titulo: "DIPLOMA AL LIDERAZGO", motivo: "Por demostrar cualidades excepcionales de liderazgo, iniciativa y trabajo en equipo." },
  { key: "esfuerzo", titulo: "DIPLOMA AL ESFUERZO Y LA SUPERACIÓN", motivo: "Por su notable esfuerzo, dedicación y superación personal a lo largo del periodo." },
  { key: "personalizado", titulo: "DIPLOMA DE RECONOCIMIENTO", motivo: "" },
];

function htmlDiploma(estudianteNombre, gradoId, tituloDiploma, motivo, institucion, fecha) {
  return `
    <div style="page-break-after: always; padding: 40px; border: 10px double #7c3aed; margin: 15px; position: relative; min-height: 620px; font-family: Georgia, serif; background: linear-gradient(180deg, #ffffff 0%, #faf5ff 100%);">
      <div style="text-align:center; border-bottom: 2px solid #c4b5fd; padding-bottom: 14px; margin-bottom: 24px;">
        ${institucion?.logo_url ? `<img src="${institucion.logo_url}" style="height:60px; margin-bottom:8px;" />` : ""}
        <div style="font-size: 15px; font-weight: bold; color: #4c1d95; letter-spacing: 2px;">${institucion?.nombre || "INSTITUCIÓN EDUCATIVA"}</div>
      </div>
      <div style="text-align:center; margin-bottom: 8px; font-size: 22px;">🏰</div>
      <div style="text-align:center; font-size: 26px; font-weight: bold; color: #7c3aed; letter-spacing: 3px; margin-bottom: 6px;">${tituloDiploma}</div>
      <div style="text-align:center; font-size: 13px; color: #94a3b8; margin-bottom: 30px;">Se otorga el presente reconocimiento a</div>
      <div style="text-align:center; font-size: 34px; font-weight: bold; color: #1e1b4b; margin-bottom: 30px; border-bottom: 2px solid #c4b5fd; display: inline-block; padding: 0 30px 8px 30px; width: 100%;">${estudianteNombre}</div>
      <div style="text-align:center; font-size: 13px; color: #475569; margin: 0 auto 40px auto; max-width: 480px; line-height: 1.6;">
        Estudiante del curso <b>${gradoId}</b><br/>${motivo}
      </div>
      <div style="text-align:center; font-size: 12px; color: #94a3b8; margin-bottom: 50px;">${fecha}</div>
      <div style="display:flex; justify-content: space-around; margin-top: 40px;">
        <div style="text-align:center; width: 35%;">
          <div style="border-top: 1px solid #1e1b4b; padding-top: 6px; font-size: 12px;">Director(a) de Curso</div>
        </div>
        <div style="text-align:center; width: 35%;">
          <div style="border-top: 1px solid #1e1b4b; padding-top: 6px; font-size: 12px;">Rectoría</div>
        </div>
      </div>
    </div>
  `;
}

function imprimirDiplomas(estudiantesSeleccionados, gradoId, tituloDiploma, motivo, institucion) {
  if (estudiantesSeleccionados.length === 0) { alert("Elegí al menos un estudiante."); return; }
  const fecha = new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
  const ventana = window.open("", "_blank");
  ventana.document.write(`
    <html><head><title>Diplomas</title></head>
    <body style="margin:0; padding:0;">
      ${estudiantesSeleccionados.map((nombre) => htmlDiploma(nombre, gradoId, tituloDiploma, motivo, institucion, fecha)).join("")}
      <script>window.print();</script>
    </body></html>
  `);
  ventana.document.close();
}

export function VistaDiplomas({ grados }) {
  const [gradoId, setGradoId] = useState(grados[0]?.id || "");
  const [estudiantes, setEstudiantes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [tipoKey, setTipoKey] = useState("excelencia");
  const [tituloEditable, setTituloEditable] = useState(TIPOS_DIPLOMA[0].titulo);
  const [motivoEditable, setMotivoEditable] = useState(TIPOS_DIPLOMA[0].motivo);
  const [institucion, setInstitucion] = useState(null);

  useEffect(() => { if (grados.length && !gradoId) setGradoId(grados[0].id); }, [grados]);
  useEffect(() => { api.fetchInstitucion().then(setInstitucion); }, []);
  useEffect(() => {
    if (!gradoId) return;
    setCargando(true);
    api.fetchEstudiantesPorGrado(gradoId).then((d) => { setEstudiantes(ordenarPorApellido(d)); setSeleccionados(new Set()); setCargando(false); });
  }, [gradoId]);

  const elegirTipo = (key) => {
    setTipoKey(key);
    const t = TIPOS_DIPLOMA.find((x) => x.key === key);
    setTituloEditable(t.titulo);
    setMotivoEditable(t.motivo);
  };

  const toggleUno = (id) => setSeleccionados((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const seleccionarTodo = () => setSeleccionados(new Set(estudiantes.map((s) => s.id)));
  const limpiarSeleccion = () => setSeleccionados(new Set());

  const generar = () => {
    const nombres = estudiantes.filter((s) => seleccionados.has(s.id)).map((s) => s.nombre);
    imprimirDiplomas(nombres, gradoId, tituloEditable, motivoEditable, institucion);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">🏅 Generador de Diplomas</h2>
      <p className="text-sm text-slate-400 mb-4">Elegí a quién reconocer y el tipo de diploma — se genera con el escudo/nombre del colegio, listo para imprimir.</p>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {grados.map((g) => <option key={g.id} value={g.id}>Curso {g.id}</option>)}
        </select>
        <button onClick={seleccionarTodo} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-violet-200 text-violet-600">☑️ Seleccionar todo</button>
        <button onClick={limpiarSeleccion} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-500">✕ Limpiar</button>
      </div>

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-4 max-h-52 overflow-y-auto bg-white rounded-2xl border border-slate-100 p-3">
          {estudiantes.map((s) => (
            <label key={s.id} className={`flex items-center gap-1.5 text-xs rounded-lg px-2 py-1.5 cursor-pointer ${seleccionados.has(s.id) ? "bg-violet-50 text-violet-700" : "text-slate-600"}`}>
              <input type="checkbox" checked={seleccionados.has(s.id)} onChange={() => toggleUno(s.id)} />
              {s.nombre}
            </label>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
        <label className="text-xs text-slate-500 block mb-1">Tipo de diploma</label>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {TIPOS_DIPLOMA.map((t) => (
            <button key={t.key} onClick={() => elegirTipo(t.key)} className={`text-[11px] px-2.5 py-1.5 rounded-full ${tipoKey === t.key ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-600"}`}>
              {t.titulo.replace("DIPLOMA ", "").replace("DE ", "").replace("AL ", "").replace("A LA ", "")}
            </button>
          ))}
        </div>
        <label className="text-xs text-slate-500 block mb-1">Título del diploma</label>
        <input value={tituloEditable} onChange={(e) => setTituloEditable(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none" />
        <label className="text-xs text-slate-500 block mb-1">Motivo (podés editarlo o personalizarlo por completo)</label>
        <textarea value={motivoEditable} onChange={(e) => setMotivoEditable(e.target.value)} rows={2} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
      </div>

      <button onClick={generar} className="w-full text-sm font-semibold py-3 rounded-xl bg-violet-500 text-white">
        🖨️ Generar {seleccionados.size} diploma{seleccionados.size !== 1 ? "s" : ""}
      </button>
    </div>
  );
}
