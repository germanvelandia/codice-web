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

const SISTEMAS_PERIODO = {
  bimestre: { nombre: "Bimestre", cantidad: 4 },
  trimestre: { nombre: "Trimestre", cantidad: 3 },
  semestre: { nombre: "Semestre", cantidad: 2 },
};

const NUMEROS_ROMANOS = ["I", "II", "III", "IV", "V", "VI"];

function etiquetaPeriodoConfigurable(sistema, indice) {
  const info = SISTEMAS_PERIODO[sistema] || SISTEMAS_PERIODO.trimestre;
  return `${info.nombre} ${NUMEROS_ROMANOS[indice] || indice + 1}`;
}

// Plan de estudios completo — se usa tal cual, sin depender de qué materias
// estén cargadas en el sistema, para que la hoja salga siempre completa.
const MATERIAS_PLAN_ESTUDIOS = [
  "Artes y Danzas",
  "Ciencias Naturales y Educación Ambiental",
  "Ciencias Sociales (Historia, Geografía y Constitución)",
  "Educación Ética y en Valores Humanos",
  "Educación Física, Recreación y Deportes",
  "Español y PILEO",
  "Inglés",
  "Matemáticas (incluyendo geometría)",
  "Tecnología e Informática",
];

function BloqueObservador({ datos, primero, sistemaPeriodos = "trimestre" }) {
  const { estudiante, acudiente, actas, institucion } = datos;
  const anioActual = new Date().getFullYear();
  const infoSistema = SISTEMAS_PERIODO[sistemaPeriodos] || SISTEMAS_PERIODO.trimestre;
  const periodosLista = Array.from({ length: infoSistema.cantidad }, (_, i) => i);

  return (
    <div className="print-avoid-break" style={{ maxWidth: 800, margin: "0 auto", padding: 24, fontFamily: "Arial, sans-serif", fontSize: 10.5, color: "#111", pageBreakBefore: primero ? "auto" : "always" }}>

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
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        {estudiante.foto_url && (
          <img src={estudiante.foto_url} alt={estudiante.nombre} style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 6, border: "1px solid #000", flexShrink: 0 }} />
        )}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
      </div>

      {/* 2. Matriz de registro — en blanco, para completar a mano. Una sola tabla
          con columna "Periodo" en vez de repetir la tabla por cada uno, para
          que entre todo el documento en 2 páginas. */}
      <div style={{ fontWeight: "bold", marginBottom: 4 }}>2. MATRIZ DE REGISTRO DE SITUACIONES Y SEGUIMIENTO (por completar a mano)</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12, fontSize: 9.5 }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #000", padding: 3, width: "13%" }}>Periodo</th>
            <th style={{ border: "1px solid #000", padding: 3, width: "10%" }}>Fecha</th>
            <th style={{ border: "1px solid #000", padding: 3, width: "14%" }}>Tipo</th>
            <th style={{ border: "1px solid #000", padding: 3 }}>Descripción de la situación</th>
            <th style={{ border: "1px solid #000", padding: 3, width: "18%" }}>Compromiso</th>
            <th style={{ border: "1px solid #000", padding: 3, width: "11%" }}>Firma</th>
          </tr>
        </thead>
        <tbody>
          {periodosLista.map((i) => [0, 1].map((f) => (
            <tr key={`${i}-${f}`}>
              {f === 0 && <td rowSpan={2} style={{ border: "1px solid #000", padding: 3, fontWeight: "bold", textAlign: "center", verticalAlign: "middle" }}>{etiquetaPeriodoConfigurable(sistemaPeriodos, i)}</td>}
              <td style={{ border: "1px solid #000", height: 16 }}></td>
              <td style={{ border: "1px solid #000", height: 16 }}></td>
              <td style={{ border: "1px solid #000", height: 16 }}></td>
              <td style={{ border: "1px solid #000", height: 16 }}></td>
              <td style={{ border: "1px solid #000", height: 16 }}></td>
            </tr>
          )))}
        </tbody>
      </table>

      {/* Hoja nueva y aparte: anotaciones libres de cualquier docente sobre el estudiante — en horizontal */}
      <div className="print-horizontal" style={{ pageBreakBefore: "always", paddingTop: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: "2px solid #000", paddingBottom: 6, marginBottom: 8 }}>
          {institucion?.logo_url && <img src={institucion.logo_url} alt="Logo" style={{ height: 40 }} />}
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontWeight: "bold", fontSize: 12 }}>{institucion?.nombre || "INSTITUCIÓN EDUCATIVA"}</div>
            <div>OBSERVADOR DEL ESTUDIANTE — {estudiante.nombre} · Curso {estudiante.grado_id} · Año lectivo {anioActual}</div>
          </div>
        </div>
        <div style={{ fontWeight: "bold", marginBottom: 4 }}>4. HOJA DE ANOTACIONES DE DOCENTES (por completar a mano)</div>
        <p style={{ fontSize: 8.5, marginBottom: 6, color: "#555" }}>
          Espacio para que cualquier docente que tenga contacto con el estudiante registre observaciones — marcando si es académica (A) o convivencial (C) — sin necesidad de generar un acta formal.
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 8 }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #000", padding: 2, width: "7%" }}>Fecha</th>
              <th style={{ border: "1px solid #000", padding: 2, width: "9%" }}>Materia</th>
              <th style={{ border: "1px solid #000", padding: 2, width: "9%" }}>Docente</th>
              <th style={{ border: "1px solid #000", padding: 2, width: "4%" }}>A</th>
              <th style={{ border: "1px solid #000", padding: 2, width: "4%" }}>C</th>
              <th style={{ border: "1px solid #000", padding: 2 }}>Anotación</th>
              <th style={{ border: "1px solid #000", padding: 2, width: "12%" }}>Firma Docente</th>
              <th style={{ border: "1px solid #000", padding: 2, width: "12%" }}>Firma Estudiante</th>
              <th style={{ border: "1px solid #000", padding: 2, width: "13%" }}>Firma Padre de Familia</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 24 }).map((_, i) => (
              <tr key={i}>
                <td style={{ border: "1px solid #000", height: 20 }}></td>
                <td style={{ border: "1px solid #000", height: 20 }}></td>
                <td style={{ border: "1px solid #000", height: 20 }}></td>
                <td style={{ border: "1px solid #000", height: 20 }}></td>
                <td style={{ border: "1px solid #000", height: 20 }}></td>
                <td style={{ border: "1px solid #000", height: 20 }}></td>
                <td style={{ border: "1px solid #000", height: 20 }}></td>
                <td style={{ border: "1px solid #000", height: 20 }}></td>
                <td style={{ border: "1px solid #000", height: 20 }}></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rendimiento académico */}
      <div style={{ fontWeight: "bold", marginBottom: 4, marginTop: 8, pageBreakBefore: "always", paddingTop: 6 }}>5. RENDIMIENTO ACADÉMICO POR {infoSistema.nombre.toUpperCase()} (marcar con X si reprobó)</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10, fontSize: 9.5 }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #000", padding: 3, textAlign: "left" }}>Asignatura</th>
            {periodosLista.map((i) => (
              <th key={i} style={{ border: "1px solid #000", padding: 3, width: 50 }}>{etiquetaPeriodoConfigurable(sistemaPeriodos, i)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MATERIAS_PLAN_ESTUDIOS.map((m) => (
            <tr key={m}>
              <td style={{ border: "1px solid #000", padding: 3 }}>{m}</td>
              {periodosLista.map((i) => (
                <td key={i} style={{ border: "1px solid #000", padding: 3, height: 16 }}></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Observaciones + firmas, una sola tabla con una fila por periodo */}
      <div style={{ fontWeight: "bold", marginBottom: 4 }}>6. OBSERVACIONES Y FIRMAS POR {infoSistema.nombre.toUpperCase()}</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12, fontSize: 9 }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #000", padding: 3, width: "10%" }}>Periodo</th>
            <th style={{ border: "1px solid #000", padding: 3 }}>Observaciones académicas</th>
            <th style={{ border: "1px solid #000", padding: 3 }}>Observaciones convivenciales</th>
            <th style={{ border: "1px solid #000", padding: 3, width: "13%" }}>Firma Padre</th>
            <th style={{ border: "1px solid #000", padding: 3, width: "13%" }}>Firma Estudiante</th>
            <th style={{ border: "1px solid #000", padding: 3, width: "13%" }}>Firma Director</th>
          </tr>
        </thead>
        <tbody>
          {periodosLista.map((i) => (
            <tr key={i}>
              <td style={{ border: "1px solid #000", padding: 3, fontWeight: "bold", textAlign: "center" }}>{etiquetaPeriodoConfigurable(sistemaPeriodos, i)}</td>
              <td style={{ border: "1px solid #000", height: 30 }}></td>
              <td style={{ border: "1px solid #000", height: 30 }}></td>
              <td style={{ border: "1px solid #000", height: 30 }}></td>
              <td style={{ border: "1px solid #000", height: 30 }}></td>
              <td style={{ border: "1px solid #000", height: 30 }}></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Nivelaciones */}
      <div style={{ pageBreakInside: "avoid" }}>
        <div style={{ fontWeight: "bold", marginBottom: 4 }}>7. ESPACIO PARA NIVELACIONES</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9.5 }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #000", padding: 3, textAlign: "left" }}>Asignatura</th>
              <th style={{ border: "1px solid #000", padding: 3, width: 80 }}>Aprobó</th>
              <th style={{ border: "1px solid #000", padding: 3, width: 80 }}>No aprobó</th>
            </tr>
          </thead>
          <tbody>
            {MATERIAS_PLAN_ESTUDIOS.map((m) => (
              <tr key={m}>
                <td style={{ border: "1px solid #000", padding: 3 }}>{m}</td>
                <td style={{ border: "1px solid #000", padding: 3, textAlign: "center" }}>( &nbsp; )</td>
                <td style={{ border: "1px solid #000", padding: 3, textAlign: "center" }}>( &nbsp; )</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontWeight: "bold", marginBottom: 8, marginTop: 24 }}>FIRMAS DE CIERRE</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 30 }}>
        <div style={{ borderTop: "1px solid #000", width: "30%", textAlign: "center", paddingTop: 4 }}>Firma Director(a) de Curso</div>
        <div style={{ borderTop: "1px solid #000", width: "30%", textAlign: "center", paddingTop: 4 }}>Firma Coordinación Académica</div>
        <div style={{ borderTop: "1px solid #000", width: "30%", textAlign: "center", paddingTop: 4 }}>Firma Coordinación Convivencial</div>
      </div>

      <div style={{ fontSize: 8, borderTop: "1px solid #999", paddingTop: 4, marginTop: 10, color: "#333" }}>
        Este documento tiene fines formativos y de seguimiento integral, en el marco del debido proceso establecido en el Manual de Convivencia y la Ley 1620 de 2013.
      </div>
    </div>
  );
}

function ObservadorPrintView({ datos, sistemaPeriodos, onCerrado }) {
  useEffect(() => {
    const id = setTimeout(() => window.print(), 150);
    const onAfter = () => onCerrado();
    window.addEventListener("afterprint", onAfter);
    return () => { clearTimeout(id); window.removeEventListener("afterprint", onAfter); };
  }, []);

  const contenido = (
    <div className="print-only">
      <BloqueObservador datos={datos} primero={true} sistemaPeriodos={sistemaPeriodos} />
    </div>
  );

  return createPortal(contenido, document.body);
}

function ObservadorMasivoPrintView({ listaDatos, sistemaPeriodos, onCerrado }) {
  useEffect(() => {
    const id = setTimeout(() => window.print(), 200);
    const onAfter = () => onCerrado();
    window.addEventListener("afterprint", onAfter);
    return () => { clearTimeout(id); window.removeEventListener("afterprint", onAfter); };
  }, []);

  const contenido = (
    <div className="print-only">
      {listaDatos.map((datos, i) => (
        <BloqueObservador key={datos.estudiante.id} datos={datos} primero={i === 0} sistemaPeriodos={sistemaPeriodos} />
      ))}
    </div>
  );

  return createPortal(contenido, document.body);
}

function SelectorSistemaPeriodos({ valor, onChange }) {
  return (
    <div className="mb-3">
      <label className="text-xs text-slate-500 block mb-1">Sistema de periodos de la hoja complementaria</label>
      <div className="flex gap-1 rounded-full bg-slate-100 p-1 w-fit">
        {Object.entries(SISTEMAS_PERIODO).map(([key, info]) => (
          <button key={key} onClick={() => onChange(key)} className={`text-xs px-3 py-1.5 rounded-full ${valor === key ? "bg-violet-500 text-white" : "text-slate-600"}`}>
            {info.nombre} ({info.cantidad})
          </button>
        ))}
      </div>
    </div>
  );
}

export function ObservadorPorGradoModal({ gradoId, onClose }) {
  const [cargando, setCargando] = useState(true);
  const [listaDatos, setListaDatos] = useState([]);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [sistemaPeriodos, setSistemaPeriodos] = useState("trimestre");

  useEffect(() => {
    api.fetchObservadorDataGrado(gradoId).then(({ datos }) => { setListaDatos(datos); setCargando(false); });
  }, [gradoId]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 no-print" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">📋 Observadores del curso {gradoId}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        {cargando ? (
          <div className="text-sm text-slate-400">Cargando {listaDatos.length ? `(${listaDatos.length})` : ""}…</div>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-3">
              Genera el Observador completo (identificación, matriz de situaciones, y hoja de rendimiento con firmas) para
              cada uno de los {listaDatos.length} estudiante(s) activos de este curso, uno seguido del otro — cada uno arranca en hoja nueva.
            </p>
            <div className="bg-slate-50 rounded-xl p-3 mb-3 max-h-48 overflow-y-auto">
              {listaDatos.map((d) => (
                <div key={d.estudiante.id} className="text-xs text-slate-600 py-0.5">
                  {d.estudiante.nombre} {d.acudiente ? "" : <span className="text-amber-500">(sin acudiente)</span>}
                </div>
              ))}
            </div>
            <SelectorSistemaPeriodos valor={sistemaPeriodos} onChange={setSistemaPeriodos} />
            <button disabled={listaDatos.length === 0} onClick={() => setImprimiendo(true)} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-50">
              🖨️ Imprimir {listaDatos.length} Observador(es)
            </button>
          </>
        )}
      </div>

      {imprimiendo && <ObservadorMasivoPrintView listaDatos={listaDatos} sistemaPeriodos={sistemaPeriodos} onCerrado={() => setImprimiendo(false)} />}
    </div>
  );
}

export function ObservadorModal({ estudiante, onClose }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [sistemaPeriodos, setSistemaPeriodos] = useState("trimestre");

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
            <SelectorSistemaPeriodos valor={sistemaPeriodos} onChange={setSistemaPeriodos} />
            <button onClick={() => setImprimiendo(true)} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white">
              🖨️ Generar / Imprimir Observador
            </button>
          </>
        )}
      </div>

      {imprimiendo && <ObservadorPrintView datos={datos} sistemaPeriodos={sistemaPeriodos} onCerrado={() => setImprimiendo(false)} />}
    </div>
  );
}
