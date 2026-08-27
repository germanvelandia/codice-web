import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { ordenarPorApellido } from "../lib/gamification";

const TIPOS_DIPLOMA = [
  { key: "excelencia", badge: "Excelencia Académica", titulo: "DIPLOMA DE FELICITACIÓN", subtitulo: "MENCIÓN DE HONOR ACADÉMICA", motivo: "Por su destacado desempeño académico y compromiso constante con su proceso de aprendizaje durante el periodo." },
  { key: "mejor_promedio", badge: "Máxima Excelencia Académica", titulo: "DIPLOMA AL MEJOR PROMEDIO", subtitulo: "PRIMER PUESTO DEL CURSO", motivo: "Por haber obtenido el mejor promedio académico del curso durante el periodo, destacándose por su constante dedicación, esfuerzo y responsabilidad." },
  { key: "convivencia", badge: "Mérito Convivencial", titulo: "DIPLOMA AL MÉRITO CONVIVENCIAL", subtitulo: "EJEMPLO DE SANA CONVIVENCIA", motivo: "Por su ejemplar comportamiento, respeto y aporte a la sana convivencia dentro de la comunidad educativa." },
  { key: "asistencia", badge: "Constancia y Puntualidad", titulo: "DIPLOMA A LA ASISTENCIA PERFECTA", subtitulo: "SIN INASISTENCIAS EN EL PERIODO", motivo: "Por su constancia y puntualidad, sin registrar inasistencias durante el periodo evaluado." },
  { key: "liderazgo", badge: "Liderazgo Estudiantil", titulo: "DIPLOMA AL LIDERAZGO", subtitulo: "INICIATIVA Y TRABAJO EN EQUIPO", motivo: "Por demostrar cualidades excepcionales de liderazgo, iniciativa y trabajo en equipo dentro y fuera del aula." },
  { key: "esfuerzo", badge: "Superación Personal", titulo: "DIPLOMA AL ESFUERZO Y LA SUPERACIÓN", subtitulo: "PROGRESO Y DEDICACIÓN", motivo: "Por su notable esfuerzo, dedicación y superación personal a lo largo del periodo." },
  { key: "personalizado", badge: "Reconocimiento Especial", titulo: "DIPLOMA DE RECONOCIMIENTO", subtitulo: "", motivo: "" },
];

// Insignia decorativa de esquina — reemplaza las fotos de personajes del
// diseño original (que no tenemos) por un ícono + texto, con el mismo look.
function iconoEsquina(icono, color) {
  return `<div style="width:56px; height:56px; border-radius:50%; background:${color}15; border:2px solid ${color}; display:flex; align-items:center; justify-content:center; font-size:24px; flex-shrink:0;">${icono}</div>`;
}

function htmlDiploma({ institucion, estudianteNombre, gradoId, tituloDiploma, subtitulo, badge, motivo, puntajes, fecha, docenteNombre, docenteRol }) {
  const puntajesHtml = (puntajes || []).filter((p) => p.label.trim() && p.valor.trim())
    .map((p, i) => `
      <div style="background:#fff; border:1.5px solid ${i === (puntajes.length - 1) ? "#93c5fd" : "#cbd5e1"}; ${i === (puntajes.length - 1) ? "background:#eff6ff;" : ""} border-radius:8px; padding:6px 16px; display:flex; align-items:center; gap:10px; box-shadow:0 2px 6px rgba(0,0,0,0.04);">
        <span style="font-size:11px; font-weight:700; color:#475569; text-transform:uppercase;">${p.label}:</span>
        <span style="font-size:16px; font-weight:800; color:${i === (puntajes.length - 1) ? "#d97706" : "#1e3a8a"};">${p.valor}</span>
      </div>
    `).join("");

  return `
    <div class="slide" style="width:1280px; height:720px; background:linear-gradient(135deg,#ffffff 0%,#fdfbf7 50%,#f7f2e4 100%); border-radius:12px; box-shadow:0 25px 50px rgba(0,0,0,0.5); position:relative; overflow:hidden; padding:25px 40px; display:flex; flex-direction:column; justify-content:space-between; border:6px solid #b45309; page-break-after: always; margin: 0 auto 30px auto; box-sizing:border-box;">
      <div style="position:absolute; top:14px; left:14px; right:14px; bottom:14px; border:3px solid #1e3a8a; border-radius:8px; pointer-events:none;"></div>
      <div style="position:absolute; top:20px; left:20px; right:20px; bottom:20px; border:1px dashed #d97706; border-radius:6px; pointer-events:none;"></div>

      <div style="position:absolute; top:28px; left:32px; z-index:10; display:flex; align-items:center; gap:12px; background:rgba(255,255,255,0.9); padding:8px 16px 8px 10px; border-radius:50px; border:1.5px solid #d97706; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
        ${institucion?.logo_url ? `<img src="${institucion.logo_url}" style="height:56px; width:auto; object-fit:contain;" />` : iconoEsquina("🏛️", "#1e3a8a")}
        <div style="display:flex; flex-direction:column;">
          <span style="font-family:'Cinzel',serif; font-weight:800; font-size:12px; color:#1e3a8a; letter-spacing:0.5px; line-height:1.2;">${(institucion?.nombre || "INSTITUCIÓN EDUCATIVA").toUpperCase()}</span>
          <span style="font-size:9.5px; color:#b45309; font-weight:600;">Formación con Excelencia</span>
        </div>
      </div>

      <div style="position:absolute; top:28px; right:32px; z-index:10; display:flex; align-items:center; gap:10px; background:rgba(255,255,255,0.92); padding:8px 16px; border-radius:40px; border:1.5px solid #1e3a8a; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
        ${iconoEsquina("⚖️", "#d97706")}
        <div style="text-align:right;">
          <div style="font-family:'Cinzel',serif; font-size:10.5px; font-weight:800; color:#d97706; text-transform:uppercase;">Ética y Liderazgo</div>
          <div style="font-size:9px; color:#475569; font-weight:600;">Pilares de Excelencia</div>
        </div>
      </div>

      <div style="position:absolute; bottom:28px; left:32px; z-index:10; display:flex; align-items:center; gap:10px; background:rgba(255,255,255,0.92); padding:8px 16px; border-radius:40px; border:1.5px solid #d97706; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
        ${iconoEsquina("🕊️", "#1e3a8a")}
        <div style="text-align:left;">
          <div style="font-family:'Cinzel',serif; font-size:10px; font-weight:800; color:#1e3a8a; text-transform:uppercase;">Respeto y Virtud</div>
          <div style="font-size:8.5px; color:#b45309; font-weight:600;">Formación Integral</div>
        </div>
      </div>

      <div style="position:absolute; bottom:28px; right:32px; z-index:10; display:flex; align-items:center; gap:10px; background:rgba(255,255,255,0.92); padding:8px 16px; border-radius:40px; border:1.5px solid #1e3a8a; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
        <div style="text-align:right;">
          <div style="font-family:'Cinzel',serif; font-size:10px; font-weight:800; color:#d97706; text-transform:uppercase;">Convivencia y Paz</div>
          <div style="font-size:8.5px; color:#1e3a8a; font-weight:600;">Compromiso Social</div>
        </div>
        ${iconoEsquina("🤝", "#d97706")}
      </div>

      <div style="text-align:center; margin-top:15px; position:relative; z-index:2;">
        <div style="font-family:'Cinzel',serif; font-size:21px; font-weight:800; color:#1e3a8a; letter-spacing:2px; text-transform:uppercase;">${institucion?.nombre || "Institución Educativa"}</div>
        <div style="font-size:12px; font-weight:700; color:#d97706; letter-spacing:2.5px; text-transform:uppercase; margin-top:3px;">Curso ${gradoId}</div>
      </div>

      <div style="text-align:center; position:relative; z-index:2;">
        <div style="display:inline-block; background:linear-gradient(135deg,#1e3a8a 0%,#0f172a 100%); color:#fbbf24; padding:5px 22px; border-radius:20px; border:1.5px solid #fbbf24; font-family:'Cinzel',serif; font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase; margin-bottom:8px;">🏆 ${badge}</div>
        <div style="font-family:'Cinzel',serif; font-size:28px; font-weight:800; color:#0f172a; letter-spacing:3px; text-transform:uppercase;">${tituloDiploma}</div>
        ${subtitulo ? `<div style="font-size:13.5px; color:#d97706; font-weight:700; letter-spacing:1.5px; margin-top:2px; text-transform:uppercase;">${subtitulo}</div>` : ""}

        <div style="margin:14px auto 6px auto; display:inline-block; padding:2px 20px;">
          <div style="font-family:'Cinzel',serif; font-size:29px; font-weight:800; color:#1e3a8a; letter-spacing:1.5px; text-transform:uppercase; border-bottom:3px double #d97706; padding-bottom:4px;">${estudianteNombre}</div>
        </div>
        <div><span style="display:inline-block; background:#fef3c7; color:#b45309; font-weight:700; font-size:12.5px; padding:3px 14px; border-radius:12px; border:1px solid #fde68a; margin-top:6px;">🎓 ESTUDIANTE DEL CURSO ${gradoId}</span></div>

        <p style="font-size:13.5px; color:#334155; line-height:1.45; max-width:820px; margin:14px auto;">${motivo}</p>

        ${puntajesHtml ? `<div style="display:flex; justify-content:center; gap:18px; margin:10px auto 5px auto;">${puntajesHtml}</div>` : ""}
      </div>

      <div>
        <div style="text-align:center; font-size:11px; font-weight:700; color:#b45309; letter-spacing:1px; text-transform:uppercase; margin-bottom:14px;">📜 ${fecha}</div>
        <div style="display:flex; justify-content:space-around; align-items:flex-end; width:70%; margin:0 auto;">
          <div style="text-align:center; width:260px;">
            <div style="border-top:1.5px solid #475569; margin-bottom:4px;"></div>
            <div style="font-size:12px; font-weight:700; color:#1e293b;">${docenteNombre || "Director(a) de Curso"}</div>
            <div style="font-size:10.5px; color:#64748b;">${docenteRol || "Docente"}</div>
          </div>
          <div style="text-align:center; width:260px;">
            <div style="border-top:1.5px solid #475569; margin-bottom:4px;"></div>
            <div style="font-size:12px; font-weight:700; color:#1e293b;">Coordinación Académica</div>
            <div style="font-size:10.5px; color:#64748b;">Rectoría</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function imprimirDiplomas(seleccionados, gradoId, config, institucion, docenteNombre) {
  if (seleccionados.length === 0) { alert("Elegí al menos un estudiante."); return; }
  const fecha = new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" }) + " · Bogotá D.C., Colombia";
  const opciones = seleccionados.map((nombre, i) => `<option value="dip${i}">${gradoId} - ${nombre}</option>`).join("");
  const slides = seleccionados.map((nombre, i) => `<div id="dip${i}">${htmlDiploma({ institucion, estudianteNombre: nombre, gradoId, ...config, fecha, docenteNombre })}</div>`).join("");

  const ventana = window.open("", "_blank");
  ventana.document.write(`
    <html><head><title>Diplomas</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin:0; padding:0; }
        body { background:#0b132b; font-family:'Montserrat',sans-serif; display:flex; flex-direction:column; align-items:center; padding:20px 0 60px 0; gap:0; }
        .controls-bar { position:sticky; top:15px; z-index:1000; background:rgba(15,23,42,0.92); backdrop-filter:blur(8px); padding:12px 24px; border-radius:50px; border:1px solid rgba(217,119,6,0.4); box-shadow:0 10px 25px rgba(0,0,0,0.5); display:flex; gap:15px; align-items:center; margin-bottom:25px; }
        .controls-bar label { color:#f1f5f9; font-size:13px; font-weight:600; }
        .controls-bar select { background:#1e293b; color:#fbbf24; border:1px solid #d97706; padding:6px 14px; border-radius:20px; font-weight:600; font-size:13px; cursor:pointer; outline:none; }
        .btn-action { background:linear-gradient(135deg,#d97706 0%,#b45309 100%); color:#fff; border:none; padding:8px 18px; border-radius:20px; font-weight:700; font-size:13px; cursor:pointer; }
        @media print {
          body { background:#fff; padding:0; }
          .controls-bar { display:none !important; }
          .slide { box-shadow:none !important; page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="controls-bar">
        <label>🎓 Ir a:</label>
        <select onchange="document.getElementById(this.value).scrollIntoView({behavior:'smooth', block:'center'})">${opciones}</select>
        <button class="btn-action" onclick="window.print()">🖨️ Imprimir Diplomas</button>
      </div>
      ${slides}
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
  const [subtituloEditable, setSubtituloEditable] = useState(TIPOS_DIPLOMA[0].subtitulo);
  const [badgeEditable, setBadgeEditable] = useState(TIPOS_DIPLOMA[0].badge);
  const [motivoEditable, setMotivoEditable] = useState(TIPOS_DIPLOMA[0].motivo);
  const [puntajes, setPuntajes] = useState([{ label: "", valor: "" }]);
  const [docenteNombre, setDocenteNombre] = useState("");
  const [docenteRolEditable, setDocenteRolEditable] = useState("Director(a) de Curso");
  const [institucion, setInstitucion] = useState(null);

  useEffect(() => { if (grados.length && !gradoId) setGradoId(grados[0].id); }, [grados]);
  useEffect(() => {
    api.fetchInstitucion().then(setInstitucion);
    api.fetchMiPerfil().then((p) => setDocenteNombre(p?.nombre || ""));
  }, []);
  useEffect(() => {
    if (!gradoId) return;
    setCargando(true);
    api.fetchEstudiantesPorGrado(gradoId).then((d) => { setEstudiantes(ordenarPorApellido(d)); setSeleccionados(new Set()); setCargando(false); });
  }, [gradoId]);

  const elegirTipo = (key) => {
    setTipoKey(key);
    const t = TIPOS_DIPLOMA.find((x) => x.key === key);
    setTituloEditable(t.titulo);
    setSubtituloEditable(t.subtitulo);
    setBadgeEditable(t.badge);
    setMotivoEditable(t.motivo);
  };

  const toggleUno = (id) => setSeleccionados((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const seleccionarTodo = () => setSeleccionados(new Set(estudiantes.map((s) => s.id)));
  const limpiarSeleccion = () => setSeleccionados(new Set());

  const actualizarPuntaje = (i, campo, valor) => setPuntajes((prev) => prev.map((p, idx) => idx === i ? { ...p, [campo]: valor } : p));
  const agregarPuntaje = () => setPuntajes((prev) => [...prev, { label: "", valor: "" }]);
  const quitarPuntaje = (i) => setPuntajes((prev) => prev.filter((_, idx) => idx !== i));

  const generar = () => {
    const nombres = estudiantes.filter((s) => seleccionados.has(s.id)).map((s) => s.nombre);
    imprimirDiplomas(nombres, gradoId, {
      tituloDiploma: tituloEditable, subtitulo: subtituloEditable, badge: badgeEditable, motivo: motivoEditable,
      puntajes, docenteRol: docenteRolEditable,
    }, institucion, docenteNombre);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">🏅 Generador de Diplomas</h2>
      <p className="text-sm text-slate-400 mb-4">Elegí a quién reconocer y el tipo de diploma — se genera con el estilo elegante de siempre, listo para imprimir.</p>

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
        <div className="grid sm:grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Insignia superior (badge)</label>
            <input value={badgeEditable} onChange={(e) => setBadgeEditable(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Subtítulo (opcional)</label>
            <input value={subtituloEditable} onChange={(e) => setSubtituloEditable(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
          </div>
        </div>
        <label className="text-xs text-slate-500 block mb-1">Título del diploma</label>
        <input value={tituloEditable} onChange={(e) => setTituloEditable(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none" />
        <label className="text-xs text-slate-500 block mb-1">Motivo</label>
        <textarea value={motivoEditable} onChange={(e) => setMotivoEditable(e.target.value)} rows={2} className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />

        <div className="grid sm:grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Nombre en la firma</label>
            <input value={docenteNombre} onChange={(e) => setDocenteNombre(e.target.value)} placeholder="Ej: Lic. Germán Andrés Velandia D."
              className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Cargo (debajo del nombre)</label>
            <input value={docenteRolEditable} onChange={(e) => setDocenteRolEditable(e.target.value)} placeholder="Ej: Docente de Ética y Valores Humanos"
              className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
          </div>
        </div>

        <label className="text-xs text-slate-500 block mb-1">Puntajes destacados (opcional — se muestran como "pastillas" al final)</label>
        {puntajes.map((p, i) => (
          <div key={i} className="flex gap-1.5 mb-1.5">
            <input value={p.label} onChange={(e) => actualizarPuntaje(i, "label", e.target.value)} placeholder="Ej: Ética P2" className="flex-1 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
            <input value={p.valor} onChange={(e) => actualizarPuntaje(i, "valor", e.target.value)} placeholder="Ej: 4.7" className="w-24 text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
            <button onClick={() => quitarPuntaje(i)} className="text-slate-400 hover:text-rose-500 text-xs px-1">✕</button>
          </div>
        ))}
        <button onClick={agregarPuntaje} className="text-xs text-violet-500">+ Agregar puntaje</button>
      </div>

      <button onClick={generar} className="w-full text-sm font-semibold py-3 rounded-xl bg-violet-500 text-white">
        🖨️ Generar {seleccionados.size} diploma{seleccionados.size !== 1 ? "s" : ""}
      </button>
    </div>
  );
}
