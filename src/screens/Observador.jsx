import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
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

const FILAS_POR_PERIODO = 3;      // filas de la matriz de situaciones por periodo
const FILAS_ANOTACIONES = 12;     // filas de la hoja de anotaciones (más altas y anchas que antes)
const B = "1px solid #000";

/* ------------------------------------------------------------------------
   Celdas diligenciables.
   - En modo "editable" (pantalla) son cajas de texto que crecen solas con lo que se escribe.
   - En modo impresión muestran el texto tal cual (o quedan en blanco para llenar a mano).
   ------------------------------------------------------------------------ */
function CajaTexto({ valor, onChange, minHeight, fontSize, centrado }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(minHeight, el.scrollHeight) + "px";
  }, [valor, minHeight]);
  return (
    <textarea
      ref={ref}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      rows={1}
      style={{
        display: "block", width: "100%", boxSizing: "border-box", minHeight, resize: "none", overflow: "hidden",
        border: "none", outline: "none", background: "#F6F9FF", padding: "5px 6px", fontFamily: "inherit",
        fontSize: fontSize || "inherit", lineHeight: 1.35, textAlign: centrado ? "center" : "left", color: "#111",
      }}
      onFocus={(e) => { e.target.style.background = "#EAF1FF"; }}
      onBlur={(e) => { e.target.style.background = "#F6F9FF"; }}
    />
  );
}

function Celda({ k, ctx, minHeight = 34, fontSize, centrado, style, colSpan, rowSpan }) {
  const v = (ctx.valores && ctx.valores[k]) || "";
  return (
    <td colSpan={colSpan} rowSpan={rowSpan} style={{ border: B, padding: 0, verticalAlign: "top", height: minHeight, background: ctx.editable ? "#F6F9FF" : undefined, ...style }}>
      {ctx.editable
        ? <CajaTexto valor={v} onChange={(t) => ctx.setValor(k, t)} minHeight={minHeight} fontSize={fontSize} centrado={centrado} />
        : <div style={{ minHeight, padding: "5px 6px", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize, textAlign: centrado ? "center" : "left", lineHeight: 1.35 }}>{v}</div>}
    </td>
  );
}

// Casilla de marca (X) — para A/C, "reprobó" y nivelaciones. Clic = pone o quita la X.
function Marca({ k, ctx, minHeight = 22, ancho }) {
  const on = ctx.valores && ctx.valores[k] === "X";
  return (
    <td
      onClick={ctx.editable ? () => ctx.setValor(k, on ? "" : "X") : undefined}
      title={ctx.editable ? "Clic para marcar / desmarcar" : undefined}
      style={{ border: B, height: minHeight, width: ancho, textAlign: "center", verticalAlign: "middle", fontWeight: "bold", fontSize: 13,
        cursor: ctx.editable ? "pointer" : "default", background: ctx.editable ? (on ? "#DDEBFF" : "#F6F9FF") : "transparent", userSelect: "none" }}
    >
      {on ? "X" : ""}
    </td>
  );
}

const TH = { border: B, padding: 4, background: "#F1F1F1" };
const TD_LABEL = { border: B, padding: 5, fontWeight: "bold", background: "#FAFAFA" };
const TD_DATO = { border: B, padding: 5 };

function BloqueObservador({ datos, primero, sistemaPeriodos = "trimestre", ctx }) {
  const { estudiante, acudiente, actas, institucion } = datos;
  const anioActual = new Date().getFullYear();
  const infoSistema = SISTEMAS_PERIODO[sistemaPeriodos] || SISTEMAS_PERIODO.trimestre;
  const periodosLista = Array.from({ length: infoSistema.cantidad }, (_, i) => i);
  const filasMatriz = Array.from({ length: FILAS_POR_PERIODO }, (_, i) => i);
  const sinFoto = !estudiante.foto_url;
  const contexto = ctx || { editable: false, valores: datos.valores || {}, setValor: () => {} };

  return (
    <div className="print-avoid-break" style={{ maxWidth: 840, margin: "0 auto", padding: 24, fontFamily: "Arial, sans-serif", fontSize: 11, color: "#111", pageBreakBefore: primero ? "auto" : "always" }}>

      {/* Encabezado institucional */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 10 }}>
        {institucion?.logo_url && <img src={institucion.logo_url} alt="Logo" style={{ height: 60 }} />}
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontWeight: "bold", fontSize: 14 }}>{institucion?.nombre || "INSTITUCIÓN EDUCATIVA"}</div>
          {institucion?.direccion && <div>{institucion.direccion}{institucion?.telefono ? ` · Tel: ${institucion.telefono}` : ""}</div>}
          <div style={{ fontWeight: "bold", marginTop: 6, fontSize: 12 }}>OBSERVADOR DEL ESTUDIANTE / REGISTRO DE SEGUIMIENTO INTEGRAL</div>
          <div>Año lectivo {anioActual}</div>
        </div>
      </div>

      {/* 1. Datos de identificación — con la foto del estudiante */}
      <div style={{ fontWeight: "bold", marginBottom: 4 }}>1. DATOS DE IDENTIFICACIÓN DEL ESTUDIANTE</div>
      <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "stretch" }}>
        <div style={{ width: 104, flexShrink: 0, border: B, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#FAFAFA", minHeight: 130 }}>
          {sinFoto
            ? <span style={{ fontSize: 10, color: "#777", textAlign: "center", padding: 6 }}>FOTO<br />(pegar aquí)</span>
            : <img src={estudiante.foto_url} alt={estudiante.nombre} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ ...TD_LABEL, width: "22%" }}>Nombres y apellidos</td>
              <td style={TD_DATO} colSpan={3}>{estudiante.nombre}</td>
            </tr>
            <tr>
              <td style={TD_LABEL}>Documento</td>
              <td style={TD_DATO}>{estudiante.tipo_documento || "RC"} {estudiante.documento || "—"}</td>
              <td style={TD_LABEL}>Fecha nac. / Edad</td>
              <td style={TD_DATO}>{estudiante.fecha_nacimiento || "—"} / {calcularEdad(estudiante.fecha_nacimiento)}</td>
            </tr>
            <tr>
              <td style={TD_LABEL}>Grado / Curso</td>
              <td style={TD_DATO}>{estudiante.grado_id}</td>
              <td style={TD_LABEL}>EPS</td>
              <td style={TD_DATO}>{estudiante.eps || "—"}</td>
            </tr>
            <tr>
              <td style={TD_LABEL}>Dirección / Barrio</td>
              <td style={TD_DATO} colSpan={3}>{acudiente?.direccion || "—"}</td>
            </tr>
            <tr>
              <td style={TD_LABEL}>Acudiente</td>
              <td style={TD_DATO} colSpan={3}>
                {acudiente?.nombre_madre && `Madre: ${acudiente.nombre_madre}${acudiente.telefono_madre ? ` (${acudiente.telefono_madre})` : ""}. `}
                {acudiente?.nombre_padre && `Padre: ${acudiente.nombre_padre}${acudiente.telefono_padre ? ` (${acudiente.telefono_padre})` : ""}.`}
                {!acudiente?.nombre_madre && !acudiente?.nombre_padre && "—"}
              </td>
            </tr>
            {acudiente?.contacto_emergencia_nombre && (
              <tr>
                <td style={TD_LABEL}>Contacto de emergencia</td>
                <td style={TD_DATO} colSpan={3}>
                  {acudiente.contacto_emergencia_nombre} ({acudiente.contacto_emergencia_relacion || "—"}) — {acudiente.contacto_emergencia_telefono || "—"}
                </td>
              </tr>
            )}
            <tr>
              <td style={TD_LABEL}>Observaciones médicas / PIAR</td>
              <td style={TD_DATO} colSpan={3}>
                {estudiante.piar ? "Cuenta con PIAR activo. " : ""}{estudiante.dua ? "Cuenta con ajustes DUA. " : ""}{estudiante.ajustes_inclusion || (!estudiante.piar && !estudiante.dua ? "Sin observaciones registradas." : "")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 2. Matriz de registro — diligenciable, con cajas amplias */}
      <div style={{ fontWeight: "bold", marginBottom: 4 }}>
        2. MATRIZ DE REGISTRO DE SITUACIONES Y SEGUIMIENTO{contexto.editable ? " (escribe en las cajas azules)" : ""}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14, fontSize: 10.5, tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th style={{ ...TH, width: "10%" }}>Periodo</th>
            <th style={{ ...TH, width: "11%" }}>Fecha</th>
            <th style={{ ...TH, width: "13%" }}>Tipo</th>
            <th style={TH}>Descripción de la situación</th>
            <th style={{ ...TH, width: "22%" }}>Compromiso</th>
            <th style={{ ...TH, width: "12%" }}>Firma</th>
          </tr>
        </thead>
        <tbody>
          {periodosLista.map((i) => filasMatriz.map((f) => (
            <tr key={`${i}-${f}`} style={{ pageBreakInside: "avoid" }}>
              {f === 0 && (
                <td rowSpan={FILAS_POR_PERIODO} style={{ border: B, padding: 3, fontWeight: "bold", textAlign: "center", verticalAlign: "middle", background: "#FAFAFA" }}>
                  {etiquetaPeriodoConfigurable(sistemaPeriodos, i)}
                </td>
              )}
              <Celda ctx={contexto} k={`m-${i}-${f}-fecha`} minHeight={40} />
              <Celda ctx={contexto} k={`m-${i}-${f}-tipo`} minHeight={40} />
              <Celda ctx={contexto} k={`m-${i}-${f}-desc`} minHeight={40} />
              <Celda ctx={contexto} k={`m-${i}-${f}-comp`} minHeight={40} />
              <Celda ctx={contexto} k={`m-${i}-${f}-firma`} minHeight={40} />
            </tr>
          )))}
        </tbody>
      </table>

      {/* 3. Situaciones que ya están registradas en el sistema (Actas) */}
      <div style={{ fontWeight: "bold", marginBottom: 4 }}>3. SITUACIONES REGISTRADAS EN EL SISTEMA (ACTAS)</div>
      {actas && actas.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12, fontSize: 10, tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: "11%" }}>Fecha</th>
              <th style={{ ...TH, width: "16%" }}>Tipo</th>
              <th style={TH}>Motivo / descripción</th>
              <th style={{ ...TH, width: "28%" }}>Compromisos</th>
            </tr>
          </thead>
          <tbody>
            {actas.map((a) => (
              <tr key={a.id} style={{ pageBreakInside: "avoid" }}>
                <td style={{ ...TD_DATO, verticalAlign: "top" }}>{a.fecha || ""}</td>
                <td style={{ ...TD_DATO, verticalAlign: "top" }}>{a.tipo || a.tipo_evento || ""}</td>
                <td style={{ ...TD_DATO, verticalAlign: "top", whiteSpace: "pre-wrap" }}><b>{a.motivo || ""}</b>{a.descripcion ? `\n${a.descripcion}` : ""}</td>
                <td style={{ ...TD_DATO, verticalAlign: "top", whiteSpace: "pre-wrap" }}>{[a.compromisos_academicos, a.compromisos_convivenciales, a.compromisos].filter(Boolean).join("\n")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ border: B, padding: 8, marginBottom: 12, color: "#555", fontSize: 10 }}>Sin situaciones registradas en el sistema.</div>
      )}

      {/* 4. Hoja de anotaciones de docentes — HORIZONTAL, filas altas y columna de anotación ancha */}
      <div className="print-horizontal" style={{ pageBreakBefore: "always", paddingTop: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: "2px solid #000", paddingBottom: 6, marginBottom: 8 }}>
          {institucion?.logo_url && <img src={institucion.logo_url} alt="Logo" style={{ height: 40 }} />}
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontWeight: "bold", fontSize: 12 }}>{institucion?.nombre || "INSTITUCIÓN EDUCATIVA"}</div>
            <div>OBSERVADOR DEL ESTUDIANTE — {estudiante.nombre} · Curso {estudiante.grado_id} · Año lectivo {anioActual}</div>
          </div>
        </div>
        <div style={{ fontWeight: "bold", marginBottom: 4 }}>4. HOJA DE ANOTACIONES DE DOCENTES{contexto.editable ? " (escribe en las cajas azules; en A / C haz clic para marcar)" : ""}</div>
        <p style={{ fontSize: 9, marginBottom: 6, color: "#555" }}>
          Espacio para que cualquier docente que tenga contacto con el estudiante registre observaciones — marcando si es académica (A) o convivencial (C) — sin necesidad de generar un acta formal.
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9.5, tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: "8%" }}>Fecha</th>
              <th style={{ ...TH, width: "11%" }}>Materia</th>
              <th style={{ ...TH, width: "11%" }}>Docente</th>
              <th style={{ ...TH, width: "3.5%" }}>A</th>
              <th style={{ ...TH, width: "3.5%" }}>C</th>
              <th style={TH}>Anotación</th>
              <th style={{ ...TH, width: "10%" }}>Firma Docente</th>
              <th style={{ ...TH, width: "10%" }}>Firma Estudiante</th>
              <th style={{ ...TH, width: "11%" }}>Firma Padre de Familia</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: FILAS_ANOTACIONES }).map((_, r) => (
              <tr key={r} style={{ pageBreakInside: "avoid" }}>
                <Celda ctx={contexto} k={`a-${r}-fecha`} minHeight={34} fontSize={9.5} />
                <Celda ctx={contexto} k={`a-${r}-materia`} minHeight={34} fontSize={9.5} />
                <Celda ctx={contexto} k={`a-${r}-docente`} minHeight={34} fontSize={9.5} />
                <Marca ctx={contexto} k={`a-${r}-A`} minHeight={34} />
                <Marca ctx={contexto} k={`a-${r}-C`} minHeight={34} />
                <Celda ctx={contexto} k={`a-${r}-nota`} minHeight={34} fontSize={10} />
                <Celda ctx={contexto} k={`a-${r}-fd`} minHeight={34} fontSize={9} />
                <Celda ctx={contexto} k={`a-${r}-fe`} minHeight={34} fontSize={9} />
                <Celda ctx={contexto} k={`a-${r}-fp`} minHeight={34} fontSize={9} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 5. Rendimiento académico */}
      <div style={{ fontWeight: "bold", marginBottom: 4, marginTop: 8, pageBreakBefore: "always", paddingTop: 6 }}>
        5. RENDIMIENTO ACADÉMICO POR {infoSistema.nombre.toUpperCase()} (marcar con X si reprobó){contexto.editable ? " — haz clic en la casilla" : ""}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12, fontSize: 10.5 }}>
        <thead>
          <tr>
            <th style={{ ...TH, textAlign: "left" }}>Asignatura</th>
            {periodosLista.map((i) => (
              <th key={i} style={{ ...TH, width: 70 }}>{etiquetaPeriodoConfigurable(sistemaPeriodos, i)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MATERIAS_PLAN_ESTUDIOS.map((m, mi) => (
            <tr key={m}>
              <td style={{ border: B, padding: 5 }}>{m}</td>
              {periodosLista.map((i) => <Marca key={i} ctx={contexto} k={`r-${mi}-${i}`} minHeight={26} />)}
            </tr>
          ))}
        </tbody>
      </table>

      {/* 6. Observaciones + firmas, una fila (amplia) por periodo */}
      <div style={{ fontWeight: "bold", marginBottom: 4 }}>6. OBSERVACIONES Y FIRMAS POR {infoSistema.nombre.toUpperCase()}</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14, fontSize: 10, tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th style={{ ...TH, width: "9%" }}>Periodo</th>
            <th style={TH}>Observaciones académicas</th>
            <th style={TH}>Observaciones convivenciales</th>
            <th style={{ ...TH, width: "11%" }}>Firma Padre</th>
            <th style={{ ...TH, width: "11%" }}>Firma Estudiante</th>
            <th style={{ ...TH, width: "11%" }}>Firma Director</th>
          </tr>
        </thead>
        <tbody>
          {periodosLista.map((i) => (
            <tr key={i} style={{ pageBreakInside: "avoid" }}>
              <td style={{ border: B, padding: 3, fontWeight: "bold", textAlign: "center", verticalAlign: "middle", background: "#FAFAFA" }}>{etiquetaPeriodoConfigurable(sistemaPeriodos, i)}</td>
              <Celda ctx={contexto} k={`o-${i}-ac`} minHeight={90} />
              <Celda ctx={contexto} k={`o-${i}-co`} minHeight={90} />
              <Celda ctx={contexto} k={`o-${i}-fp`} minHeight={90} fontSize={9} />
              <Celda ctx={contexto} k={`o-${i}-fe`} minHeight={90} fontSize={9} />
              <Celda ctx={contexto} k={`o-${i}-fd`} minHeight={90} fontSize={9} />
            </tr>
          ))}
        </tbody>
      </table>

      {/* 7. Nivelaciones */}
      <div style={{ pageBreakInside: "avoid" }}>
        <div style={{ fontWeight: "bold", marginBottom: 4 }}>7. ESPACIO PARA NIVELACIONES{contexto.editable ? " — haz clic en la casilla" : ""}</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
          <thead>
            <tr>
              <th style={{ ...TH, textAlign: "left" }}>Asignatura</th>
              <th style={{ ...TH, width: 90 }}>Aprobó</th>
              <th style={{ ...TH, width: 90 }}>No aprobó</th>
            </tr>
          </thead>
          <tbody>
            {MATERIAS_PLAN_ESTUDIOS.map((m, mi) => (
              <tr key={m}>
                <td style={{ border: B, padding: 5 }}>{m}</td>
                <Marca ctx={contexto} k={`n-${mi}-ap`} minHeight={26} />
                <Marca ctx={contexto} k={`n-${mi}-no`} minHeight={26} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontWeight: "bold", marginBottom: 8, marginTop: 24 }}>FIRMAS DE CIERRE</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40 }}>
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

// Espera a que carguen las imágenes (escudo y foto) antes de abrir el diálogo de impresión;
// antes se imprimía a los 150 ms y la foto todavía no había llegado.
function esperarImagenesYImprimir(contenedorSelector) {
  const imgs = Array.from(document.querySelectorAll(`${contenedorSelector} img`));
  const pendientes = imgs.filter((im) => !im.complete).map((im) => new Promise((res) => { im.onload = res; im.onerror = res; }));
  const tope = new Promise((res) => setTimeout(res, 5000));
  Promise.race([Promise.all(pendientes), tope]).then(() => setTimeout(() => window.print(), 120));
}

function ObservadorPrintView({ datos, sistemaPeriodos, onCerrado }) {
  useEffect(() => {
    const onAfter = () => onCerrado();
    window.addEventListener("afterprint", onAfter);
    esperarImagenesYImprimir(".print-only");
    return () => window.removeEventListener("afterprint", onAfter);
  }, []);
  return createPortal(<div className="print-only"><BloqueObservador datos={datos} primero={true} sistemaPeriodos={sistemaPeriodos} /></div>, document.body);
}

function ObservadorMasivoPrintView({ listaDatos, sistemaPeriodos, onCerrado }) {
  useEffect(() => {
    const onAfter = () => onCerrado();
    window.addEventListener("afterprint", onAfter);
    esperarImagenesYImprimir(".print-only");
    return () => window.removeEventListener("afterprint", onAfter);
  }, []);
  return createPortal(
    <div className="print-only">
      {listaDatos.map((datos, i) => (
        <BloqueObservador key={datos.estudiante.id} datos={datos} primero={i === 0} sistemaPeriodos={sistemaPeriodos} />
      ))}
    </div>, document.body);
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

/* ------------------------------------------------------------------------
   Editor a pantalla completa: el Observador se llena aquí, se guarda en la
   base de datos (con el botón Guardar) y luego se imprime con lo escrito.
   ------------------------------------------------------------------------ */
function ObservadorEditor({ datos, sistemaPeriodos: sistemaInicial, onClose, onGuardado }) {
  const [sistemaPeriodos, setSistemaPeriodos] = useState(sistemaInicial);
  const [valores, setValores] = useState(datos.valores || {});
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [imprimiendo, setImprimiendo] = useState(false);

  const setValor = (k, v) => { setValores((x) => ({ ...x, [k]: v })); setSucio(true); setMsg(""); };
  const guardar = async () => {
    setGuardando(true); setError(""); setMsg("");
    try {
      await api.guardarObservadorDiligenciado(datos.estudiante.id, valores);
      setSucio(false); setMsg("✔ Guardado");
      onGuardado && onGuardado(valores);
    } catch (e) {
      const t = String(e?.message || e);
      setError(t.includes("observador_diligenciado") ? "Falta ejecutar el SQL 158 en Supabase para poder guardar." : "No se pudo guardar: " + t);
    }
    setGuardando(false);
  };
  const cerrar = () => {
    if (sucio && !window.confirm("Tienes cambios sin guardar. ¿Cerrar sin guardar?")) return;
    onClose();
  };
  const datosConValores = { ...datos, valores };
  const ctx = { editable: true, valores, setValor };

  return createPortal(
    <div className="no-print" style={{ position: "fixed", inset: 0, zIndex: 60, background: "#CBD5E1", overflowY: "auto" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "#17489C", color: "#fff", padding: "10px 16px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 800, fontSize: 15, flex: "1 1 220px" }}>✍️ Observador — {datos.estudiante.nombre}</div>
        <div style={{ display: "flex", gap: 4, background: "#ffffff22", borderRadius: 999, padding: 3 }}>
          {Object.entries(SISTEMAS_PERIODO).map(([key, info]) => (
            <button key={key} onClick={() => setSistemaPeriodos(key)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, border: "none", cursor: "pointer", background: sistemaPeriodos === key ? "#fff" : "transparent", color: sistemaPeriodos === key ? "#17489C" : "#fff", fontWeight: 700 }}>
              {info.nombre} ({info.cantidad})
            </button>
          ))}
        </div>
        {msg && <span style={{ fontSize: 12, color: "#BBF7D0", fontWeight: 700 }}>{msg}</span>}
        {sucio && !msg && <span style={{ fontSize: 12, color: "#FDE68A", fontWeight: 700 }}>● Cambios sin guardar</span>}
        <button onClick={guardar} disabled={guardando || !sucio} style={{ fontSize: 13, fontWeight: 800, padding: "7px 14px", borderRadius: 10, border: "none", cursor: "pointer", background: "#22C55E", color: "#fff", opacity: guardando || !sucio ? 0.55 : 1 }}>
          {guardando ? "Guardando…" : "💾 Guardar"}
        </button>
        <button onClick={() => setImprimiendo(true)} style={{ fontSize: 13, fontWeight: 800, padding: "7px 14px", borderRadius: 10, border: "none", cursor: "pointer", background: "#fff", color: "#17489C" }}>🖨️ Imprimir / PDF</button>
        <button onClick={cerrar} style={{ fontSize: 13, fontWeight: 700, padding: "7px 12px", borderRadius: 10, border: "1px solid #ffffff66", cursor: "pointer", background: "transparent", color: "#fff" }}>✕ Cerrar</button>
      </div>
      {error && <div role="alert" style={{ background: "#FEE2E2", color: "#B91C1C", padding: "8px 16px", fontSize: 13, fontWeight: 600 }}>{error}</div>}
      <div style={{ padding: "16px 8px 40px" }}>
        <div style={{ background: "#fff", boxShadow: "0 4px 24px #0003", borderRadius: 4, maxWidth: 900, margin: "0 auto" }}>
          <BloqueObservador datos={datosConValores} primero={true} sistemaPeriodos={sistemaPeriodos} ctx={ctx} />
        </div>
      </div>
      {imprimiendo && <ObservadorPrintView datos={datosConValores} sistemaPeriodos={sistemaPeriodos} onCerrado={() => setImprimiendo(false)} />}
    </div>,
    document.body
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
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-3">
              Genera el Observador completo (con foto, identificación, matriz de situaciones y hoja de rendimiento con firmas) para
              cada uno de los {listaDatos.length} estudiante(s) activos de este curso, uno seguido del otro — cada uno arranca en hoja nueva.
              Si ya diligenciaste el observador de alguien, sale impreso con lo que escribiste.
            </p>
            <div className="bg-slate-50 rounded-xl p-3 mb-3 max-h-48 overflow-y-auto">
              {listaDatos.map((d) => (
                <div key={d.estudiante.id} className="text-xs text-slate-600 py-0.5 flex items-center gap-2">
                  {d.estudiante.foto_url ? <img src={d.estudiante.foto_url} alt="" className="w-5 h-5 rounded-full object-cover" /> : <span className="w-5 h-5 rounded-full bg-slate-200 inline-block" />}
                  <span>{d.estudiante.nombre}</span>
                  {!d.acudiente && <span className="text-amber-500">(sin acudiente)</span>}
                  {d.valores && Object.keys(d.valores).length > 0 && <span className="text-emerald-600">✍️ diligenciado</span>}
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
  const [editando, setEditando] = useState(false);
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
            <div className="flex items-center gap-3 mb-3">
              {datos.estudiante.foto_url
                ? <img src={datos.estudiante.foto_url} alt="" className="w-16 h-20 rounded-lg object-cover border border-slate-200" />
                : <div className="w-16 h-20 rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-400 flex items-center justify-center text-center">Sin foto</div>}
              <p className="text-xs text-slate-500">
                Documento oficial de seguimiento integral: identificación con foto, situaciones registradas en Actas,
                y hojas para diligenciar con cajas amplias. Puedes <b>escribir en pantalla</b>, guardar y luego imprimir.
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 mb-4">
              <div className="text-xs text-slate-600">Situaciones registradas: <b>{datos.actas.length}</b></div>
              <div className="text-xs text-slate-600 mt-1">Acudiente en el sistema: <b>{datos.acudiente ? "Sí" : "No registrado todavía"}</b></div>
              <div className="text-xs text-slate-600 mt-1">Diligenciado: <b>{datos.valores && Object.keys(datos.valores).length ? "Sí, hay información guardada" : "Aún en blanco"}</b></div>
            </div>
            {!datos.acudiente && (
              <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg p-2 mb-3">
                ⚠️ Este estudiante no tiene datos de acudiente cargados — esa sección del documento va a salir vacía. Puedes completarlos desde Directorio de acudientes.
              </p>
            )}
            <SelectorSistemaPeriodos valor={sistemaPeriodos} onChange={setSistemaPeriodos} />
            <button onClick={() => setEditando(true)} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-blue-700 text-white mb-2">
              ✍️ Diligenciar en pantalla
            </button>
            <button onClick={() => setImprimiendo(true)} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white">
              🖨️ Generar / Imprimir Observador
            </button>
          </>
        )}
      </div>

      {editando && datos && (
        <ObservadorEditor datos={datos} sistemaPeriodos={sistemaPeriodos}
          onClose={() => setEditando(false)} onGuardado={(valores) => setDatos((d) => ({ ...d, valores }))} />
      )}
      {imprimiendo && <ObservadorPrintView datos={datos} sistemaPeriodos={sistemaPeriodos} onCerrado={() => setImprimiendo(false)} />}
    </div>
  );
}
