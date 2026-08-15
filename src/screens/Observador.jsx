import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import * as api from "../lib/api";

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return "—";
  const hoy = new Date();
  const nac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return isNaN(edad) ? "—" : `${edad} años`;
}

const TIPO_EVENTO_ICONO = {
  "Académico": "📘", "Convivencial": "🤝", "Felicitación": "🌟", "Citación a acudiente": "📞", "Apoyo y orientación": "🧭",
};

const EVALUACION_LABEL = { cumplio: "Cumplió", en_proceso: "En proceso", no_cumplio: "No cumplió" };

function ObservadorPrintView({ datos, onCerrado }) {
  useEffect(() => {
    const id = setTimeout(() => window.print(), 150);
    const onAfter = () => onCerrado();
    window.addEventListener("afterprint", onAfter);
    return () => { clearTimeout(id); window.removeEventListener("afterprint", onAfter); };
  }, []);

  const { estudiante, acudiente, actas, institucion } = datos;
  const anioActual = new Date().getFullYear();

  const contenido = (
    <div className="print-only" style={{ maxWidth: 800, margin: "0 auto", padding: 24, fontFamily: "Arial, sans-serif", fontSize: 10.5, color: "#111" }}>

      {/* 1. Encabezado institucional */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 10 }}>
        {institucion?.logo_url && <img src={institucion.logo_url} alt="Logo" style={{ height: 60 }} />}
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontWeight: "bold", fontSize: 14 }}>{institucion?.nombre || "INSTITUCIÓN EDUCATIVA"}</div>
          {institucion?.direccion && <div>{institucion.direccion}{institucion?.telefono ? ` · Tel: ${institucion.telefono}` : ""}</div>}
          <div style={{ fontWeight: "bold", marginTop: 6, fontSize: 12 }}>OBSERVADOR DEL ESTUDIANTE / REGISTRO DE SEGUIMIENTO INTEGRAL</div>
          <div>Año lectivo {anioActual}</div>
        </div>
      </div>

      {/* 2. Datos de identificación */}
      <div style={{ fontWeight: "bold", marginBottom: 4 }}>1. DATOS DE IDENTIFICACIÓN DEL ESTUDIANTE</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: "1px solid #000", padding: 4, fontWeight: "bold", width: "22%" }}>Nombres y apellidos</td>
            <td style={{ border: "1px solid #000", padding: 4 }} colSpan={3}>{estudiante.nombre}</td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #000", padding: 4, fontWeight: "bold" }}>Documento</td>
            <td style={{ border: "1px solid #000", padding: 4 }}>{estudiante.tipo_documento || "RC"} {estudiante.documento || "—"}</td>
            <td style={{ border: "1px solid #000", padding: 4, fontWeight: "bold" }}>Fecha nac. / Edad</td>
            <td style={{ border: "1px solid #000", padding: 4 }}>{estudiante.fecha_nacimiento || "—"} / {calcularEdad(estudiante.fecha_nacimiento)}</td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #000", padding: 4, fontWeight: "bold" }}>Grado / Curso</td>
            <td style={{ border: "1px solid #000", padding: 4 }}>{estudiante.grado_id}</td>
            <td style={{ border: "1px solid #000", padding: 4, fontWeight: "bold" }}>EPS</td>
            <td style={{ border: "1px solid #000", padding: 4 }}>{estudiante.eps || "—"}</td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #000", padding: 4, fontWeight: "bold" }}>Dirección / Barrio</td>
            <td style={{ border: "1px solid #000", padding: 4 }} colSpan={3}>{acudiente?.direccion || "—"}</td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #000", padding: 4, fontWeight: "bold" }}>Acudiente</td>
            <td style={{ border: "1px solid #000", padding: 4 }} colSpan={3}>
              {acudiente?.nombre_madre && `Madre: ${acudiente.nombre_madre}${acudiente.telefono_madre ? ` (${acudiente.telefono_madre})` : ""}. `}
              {acudiente?.nombre_padre && `Padre: ${acudiente.nombre_padre}${acudiente.telefono_padre ? ` (${acudiente.telefono_padre})` : ""}.`}
              {!acudiente?.nombre_madre && !acudiente?.nombre_padre && "—"}
            </td>
          </tr>
          {acudiente?.contacto_emergencia_nombre && (
            <tr>
              <td style={{ border: "1px solid #000", padding: 4, fontWeight: "bold" }}>Contacto de emergencia</td>
              <td style={{ border: "1px solid #000", padding: 4 }} colSpan={3}>
                {acudiente.contacto_emergencia_nombre} ({acudiente.contacto_emergencia_relacion || "—"}) — {acudiente.contacto_emergencia_telefono || "—"}
              </td>
            </tr>
          )}
          <tr>
            <td style={{ border: "1px solid #000", padding: 4, fontWeight: "bold" }}>Observaciones médicas / PIAR</td>
            <td style={{ border: "1px solid #000", padding: 4 }} colSpan={3}>
              {estudiante.piar ? "Cuenta con PIAR activo. " : ""}{estudiante.dua ? "Cuenta con ajustes DUA. " : ""}{estudiante.ajustes_inclusion || (!estudiante.piar && !estudiante.dua ? "Sin observaciones registradas." : "")}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 3. Matriz de registro */}
      <div style={{ fontWeight: "bold", marginBottom: 4 }}>2. MATRIZ DE REGISTRO DE SITUACIONES Y SEGUIMIENTO</div>
      {actas.length === 0 ? (
        <p style={{ marginBottom: 12 }}>Sin situaciones registradas.</p>
      ) : (
        <div style={{ marginBottom: 12 }}>
          {actas.map((a, i) => (
            <div key={a.id} style={{ border: "1px solid #000", padding: 8, marginBottom: 8, pageBreakInside: "avoid" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", marginBottom: 4 }}>
                <span>#{i + 1} — {a.fecha}</span>
                <span>{TIPO_EVENTO_ICONO[a.tipo_evento] || ""} {a.tipo_evento || a.tipo}{a.tipificacion_falta ? ` · ${a.tipificacion_falta}` : ""}</span>
              </div>
              <div style={{ marginBottom: 3 }}><b>Motivo:</b> {a.motivo}</div>
              {a.descripcion && <div style={{ marginBottom: 3 }}><b>Descripción de los hechos:</b> <span dangerouslySetInnerHTML={{ __html: a.descripcion }} /></div>}
              {a.descargo_estudiante && <div style={{ marginBottom: 3 }}><b>Versión / descargo del estudiante:</b> <span dangerouslySetInnerHTML={{ __html: a.descargo_estudiante }} /></div>}
              {(a.compromisos_academicos || a.compromisos_convivenciales) && (
                <div style={{ marginBottom: 3 }}>
                  <b>Estrategia pedagógica / compromisos:</b>{" "}
                  {a.compromisos_academicos && <span dangerouslySetInnerHTML={{ __html: a.compromisos_academicos }} />}
                  {a.compromisos_academicos && a.compromisos_convivenciales && " — "}
                  {a.compromisos_convivenciales && <span dangerouslySetInnerHTML={{ __html: a.compromisos_convivenciales }} />}
                </div>
              )}
              {a.implicaciones_legales && <div style={{ marginBottom: 3, color: "#7c2d12" }}><b>Implicaciones:</b> <span dangerouslySetInnerHTML={{ __html: a.implicaciones_legales }} /></div>}
              <div style={{ fontSize: 9, color: "#555", marginTop: 4 }}>
                Seguimiento: {a.evaluacion_compromiso ? EVALUACION_LABEL[a.evaluacion_compromiso] : "Sin verificar"}
                {a.remitido_a ? ` · Remitido a: ${a.remitido_a}` : ""}
                {a.profesores?.nombre ? ` · Registrado por: ${a.profesores.nombre}` : ""}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
                <div style={{ borderTop: "1px solid #000", width: "30%", textAlign: "center", fontSize: 9, paddingTop: 2 }}>Firma Estudiante</div>
                <div style={{ borderTop: "1px solid #000", width: "30%", textAlign: "center", fontSize: 9, paddingTop: 2 }}>Firma Docente/Orientador</div>
                <div style={{ borderTop: "1px solid #000", width: "30%", textAlign: "center", fontSize: 9, paddingTop: 2 }}>Firma Acudiente</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5. Firmas finales */}
      <div style={{ fontWeight: "bold", marginBottom: 8, marginTop: 20 }}>FIRMAS DE CIERRE DE PERIODO</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 30 }}>
        <div style={{ borderTop: "1px solid #000", width: "40%", textAlign: "center", paddingTop: 4 }}>Firma Director(a) de Grupo</div>
        <div style={{ borderTop: "1px solid #000", width: "40%", textAlign: "center", paddingTop: 4 }}>Firma Coordinador(a)</div>
      </div>

      <div style={{ fontSize: 8.5, borderTop: "1px solid #999", paddingTop: 6, marginTop: 20, color: "#333" }}>
        Este documento tiene fines formativos y de seguimiento integral, en el marco del debido proceso establecido en el Manual de Convivencia y la Ley 1620 de 2013.
      </div>
    </div>
  );

  return createPortal(contenido, document.body);
}

export function ObservadorModal({ estudiante, onClose }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [imprimiendo, setImprimiendo] = useState(false);

  useEffect(() => { api.fetchObservadorData(estudiante.id).then((d) => { setDatos(d); setCargando(false); }); }, [estudiante.id]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 no-print" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">📋 Observador — {estudiante.nombre}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-3">
              Documento oficial de seguimiento integral: identificación completa del estudiante + todas las situaciones registradas en Actas,
              organizadas cronológicamente, con espacios de firma.
            </p>
            <div className="bg-slate-50 rounded-xl p-3 mb-4">
              <div className="text-xs text-slate-600">Situaciones registradas: <b>{datos.actas.length}</b></div>
              <div className="text-xs text-slate-600 mt-1">Acudiente en el sistema: <b>{datos.acudiente ? "Sí" : "No registrado todavía"}</b></div>
            </div>
            {!datos.acudiente && (
              <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg p-2 mb-3">
                ⚠️ Este estudiante no tiene datos de acudiente cargados — esa sección del documento va a salir vacía. Podés completarlos desde Directorio de acudientes.
              </p>
            )}
            <button onClick={() => setImprimiendo(true)} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white">
              🖨️ Generar / Imprimir Observador
            </button>
          </>
        )}
      </div>

      {imprimiendo && <ObservadorPrintView datos={datos} onCerrado={() => setImprimiendo(false)} />}
    </div>
  );
}
