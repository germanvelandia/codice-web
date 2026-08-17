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
  "Matemáticas (incluyendo geometría)",
  "Español y PILEO",
  "Ciencias Naturales y Educación Ambiental",
  "Ciencias Sociales (Historia, Geografía y Constitución)",
  "Inglés",
  "Educación Ética y en Valores Humanos",
  "Educación Física, Recreación y Deportes",
  "Artes y Danzas",
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

      {/* 2. Matriz de registro — en blanco, para completar a mano */}
      <div style={{ fontWeight: "bold", marginBottom: 4 }}>2. MATRIZ DE REGISTRO DE SITUACIONES Y SEGUIMIENTO (por completar a mano)</div>
      {periodosLista.map((i) => (
        <div key={i} style={{ marginBottom: 10, pageBreakInside: "avoid" }}>
          <div style={{ fontSize: 9.5, fontWeight: "bold", marginBottom: 2, color: "#555" }}>{etiquetaPeriodoConfigurable(sistemaPeriodos, i)}</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #000", padding: 3, fontSize: 9, width: "12%" }}>Fecha</th>
                <th style={{ border: "1px solid #000", padding: 3, fontSize: 9, width: "16%" }}>Tipo</th>
                <th style={{ border: "1px solid #000", padding: 3, fontSize: 9 }}>Descripción de la situación</th>
                <th style={{ border: "1px solid #000", padding: 3, fontSize: 9, width: "20%" }}>Compromiso</th>
                <th style={{ border: "1px solid #000", padding: 3, fontSize: 9, width: "12%" }}>Firma</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2].map((f) => (
                <tr key={f}>
                  <td style={{ border: "1px solid #000", height: 18 }}></td>
                  <td style={{ border: "1px solid #000", height: 18 }}></td>
                  <td style={{ border: "1px solid #000", height: 18 }}></td>
                  <td style={{ border: "1px solid #000", height: 18 }}></td>
                  <td style={{ border: "1px solid #000", height: 18 }}></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* 5. Firmas finales */}
      <div style={{ fontWeight: "bold", marginBottom: 8, marginTop: 20 }}>FIRMAS DE CIERRE DE PERIODO</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 30 }}>
        <div style={{ borderTop: "1px solid #000", width: "40%", textAlign: "center", paddingTop: 4 }}>Firma Director(a) de Grupo</div>
        <div style={{ borderTop: "1px solid #000", width: "40%", textAlign: "center", paddingTop: 4 }}>Firma Coordinador(a)</div>
      </div>

      <div style={{ fontSize: 8.5, borderTop: "1px solid #999", paddingTop: 6, marginTop: 20, color: "#333" }}>
        Este documento tiene fines formativos y de seguimiento integral, en el marco del debido proceso establecido en el Manual de Convivencia y la Ley 1620 de 2013.
      </div>

      {/* Hoja complementaria: seguimiento por periodo, para completar a mano */}
      <div style={{ pageBreakBefore: "always", paddingTop: 20 }}>
        <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 14 }}>
          <div style={{ fontWeight: "bold", fontSize: 13 }}>{institucion?.nombre || "INSTITUCIÓN EDUCATIVA"}</div>
          <div style={{ fontWeight: "bold", marginTop: 4 }}>HOJA COMPLEMENTARIA — SEGUIMIENTO POR {infoSistema.nombre.toUpperCase()}</div>
          <div>{estudiante.nombre} · Curso {estudiante.grado_id} · Año lectivo {anioActual}</div>
        </div>

        <p style={{ fontSize: 9, marginBottom: 6, color: "#555" }}>
          Marque con X la casilla correspondiente si el estudiante <b>reprobó</b> la asignatura en ese {infoSistema.nombre.toLowerCase()}.
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #000", padding: 5, textAlign: "left" }}>Asignatura</th>
              {periodosLista.map((i) => (
                <th key={i} style={{ border: "1px solid #000", padding: 5, width: 60 }}>{etiquetaPeriodoConfigurable(sistemaPeriodos, i)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATERIAS_PLAN_ESTUDIOS.map((m) => (
              <tr key={m}>
                <td style={{ border: "1px solid #000", padding: 5 }}>{m}</td>
                {periodosLista.map((i) => (
                  <td key={i} style={{ border: "1px solid #000", padding: 5, height: 22 }}></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {periodosLista.map((i) => (
          <div key={i} style={{ pageBreakInside: "avoid", marginBottom: 18, border: "1px solid #000", padding: 8 }}>
            <div style={{ fontWeight: "bold", marginBottom: 6 }}>{etiquetaPeriodoConfigurable(sistemaPeriodos, i)}</div>
            <div style={{ fontSize: 9.5, fontWeight: "bold", marginBottom: 2 }}>Observaciones académicas:</div>
            <div style={{ borderBottom: "1px solid #999", height: 16 }}></div>
            <div style={{ borderBottom: "1px solid #999", height: 16 }}></div>
            <div style={{ fontSize: 9.5, fontWeight: "bold", marginTop: 6, marginBottom: 2 }}>Observaciones convivenciales:</div>
            <div style={{ borderBottom: "1px solid #999", height: 16 }}></div>
            <div style={{ borderBottom: "1px solid #999", height: 16 }}></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <div style={{ borderTop: "1px solid #000", width: "30%", textAlign: "center", fontSize: 9, paddingTop: 2 }}>Firma Padre de Familia</div>
              <div style={{ borderTop: "1px solid #000", width: "30%", textAlign: "center", fontSize: 9, paddingTop: 2 }}>Firma Estudiante</div>
              <div style={{ borderTop: "1px solid #000", width: "30%", textAlign: "center", fontSize: 9, paddingTop: 2 }}>Firma Director de Curso</div>
            </div>
          </div>
        ))}

        <div style={{ pageBreakInside: "avoid" }}>
          <div style={{ fontWeight: "bold", marginBottom: 6, marginTop: 10 }}>ESPACIO PARA NIVELACIONES</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #000", padding: 5, textAlign: "left" }}>Asignatura</th>
                <th style={{ border: "1px solid #000", padding: 5, width: 90 }}>Aprobó</th>
                <th style={{ border: "1px solid #000", padding: 5, width: 90 }}>No aprobó</th>
              </tr>
            </thead>
            <tbody>
              {MATERIAS_PLAN_ESTUDIOS.map((m) => (
                <tr key={m}>
                  <td style={{ border: "1px solid #000", padding: 5 }}>{m}</td>
                  <td style={{ border: "1px solid #000", padding: 5, textAlign: "center" }}>( &nbsp; )</td>
                  <td style={{ border: "1px solid #000", padding: 5, textAlign: "center" }}>( &nbsp; )</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
