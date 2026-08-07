import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import * as api from "../lib/api";

function AcudienteEditModal({ estudiante, acudiente, onClose, onGuardado }) {
  const [nombrePadre, setNombrePadre] = useState(acudiente?.nombre_padre || "");
  const [telefonoPadre, setTelefonoPadre] = useState(acudiente?.telefono_padre || "");
  const [nombreMadre, setNombreMadre] = useState(acudiente?.nombre_madre || "");
  const [telefonoMadre, setTelefonoMadre] = useState(acudiente?.telefono_madre || "");
  const [emergNombre, setEmergNombre] = useState(acudiente?.contacto_emergencia_nombre || "");
  const [emergTelefono, setEmergTelefono] = useState(acudiente?.contacto_emergencia_telefono || "");
  const [emergRelacion, setEmergRelacion] = useState(acudiente?.contacto_emergencia_relacion || "");
  const [direccion, setDireccion] = useState(acudiente?.direccion || "");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      await api.guardarAcudiente(estudiante.id, {
        nombre_padre: nombrePadre.trim() || null,
        telefono_padre: telefonoPadre.trim() || null,
        nombre_madre: nombreMadre.trim() || null,
        telefono_madre: telefonoMadre.trim() || null,
        contacto_emergencia_nombre: emergNombre.trim() || null,
        contacto_emergencia_telefono: emergTelefono.trim() || null,
        contacto_emergencia_relacion: emergRelacion.trim() || null,
        direccion: direccion.trim() || null,
      });
      onGuardado();
      onClose();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800">👪 Acudientes — {estudiante.nombre}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Nombre del padre</label>
            <input value={nombrePadre} onChange={(e) => setNombrePadre(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Teléfono del padre</label>
            <input value={telefonoPadre} onChange={(e) => setTelefonoPadre(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Nombre de la madre</label>
            <input value={nombreMadre} onChange={(e) => setNombreMadre(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Teléfono de la madre</label>
            <input value={telefonoMadre} onChange={(e) => setTelefonoMadre(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
          </div>
        </div>

        <div className="bg-rose-50 rounded-xl p-3 mb-3">
          <div className="text-xs font-semibold text-rose-600 mb-2">Contacto de emergencia</div>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Nombre</label>
              <input value={emergNombre} onChange={(e) => setEmergNombre(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Teléfono</label>
              <input value={emergTelefono} onChange={(e) => setEmergTelefono(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
            </div>
          </div>
          <label className="text-xs text-slate-500 block mb-1">Parentesco (ej: tía, abuelo, vecino…)</label>
          <input value={emergRelacion} onChange={(e) => setEmergRelacion(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white" />
        </div>

        <label className="text-xs text-slate-500 block mb-1">Dirección (opcional)</label>
        <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-4 border border-slate-200 outline-none" />

        <button disabled={guardando} onClick={guardar} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

export function DirectorioModal({ gradoId, onClose }) {
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(null); // { estudiante, acudiente }

  const cargar = () => {
    setCargando(true);
    api.fetchAcudientesPorGrado(gradoId).then((data) => { setFilas(data); setCargando(false); });
  };
  useEffect(() => { cargar(); }, [gradoId]);

  const exportar = () => {
    const datos = filas.map(({ estudiante: s, acudiente: a }) => ({
      Estudiante: s.nombre, Grupo: s.reino_actual || s.reino_original || "",
      "Nombre padre": a?.nombre_padre || "", "Teléfono padre": a?.telefono_padre || "",
      "Nombre madre": a?.nombre_madre || "", "Teléfono madre": a?.telefono_madre || "",
      "Contacto emergencia": a?.contacto_emergencia_nombre || "", "Teléfono emergencia": a?.contacto_emergencia_telefono || "",
      "Parentesco emergencia": a?.contacto_emergencia_relacion || "", Dirección: a?.direccion || "",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(datos), `Grado ${gradoId}`);
    XLSX.writeFile(wb, `Directorio_acudientes_${gradoId}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-slate-50 rounded-2xl p-5 w-full max-w-4xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800">👪 Directorio de acudientes — Grado {gradoId}</h3>
          <div className="flex items-center gap-3">
            <button onClick={exportar} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">📊 Exportar Excel</button>
            <button onClick={onClose} className="text-slate-400">✕</button>
          </div>
        </div>

        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
            <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th className="text-left px-3 py-2 border-b border-slate-100 bg-slate-50">Estudiante</th>
                  <th className="text-left px-3 py-2 border-b border-slate-100 bg-slate-50">Padre</th>
                  <th className="text-left px-3 py-2 border-b border-slate-100 bg-slate-50">Madre</th>
                  <th className="text-left px-3 py-2 border-b border-slate-100 bg-slate-50">Emergencia</th>
                  <th className="px-3 py-2 border-b border-slate-100 bg-slate-50"></th>
                </tr>
              </thead>
              <tbody>
                {filas.map(({ estudiante: s, acudiente: a }) => (
                  <tr key={s.id} className="odd:bg-white even:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-700 align-top">{s.nombre}</td>
                    <td className="px-3 py-2 align-top text-slate-600">
                      {a?.nombre_padre || a?.telefono_padre ? (
                        <>{a.nombre_padre}{a.nombre_padre && a.telefono_padre && <br />}{a.telefono_padre}</>
                      ) : <span className="text-slate-300">— sin registrar —</span>}
                    </td>
                    <td className="px-3 py-2 align-top text-slate-600">
                      {a?.nombre_madre || a?.telefono_madre ? (
                        <>{a.nombre_madre}{a.nombre_madre && a.telefono_madre && <br />}{a.telefono_madre}</>
                      ) : <span className="text-slate-300">— sin registrar —</span>}
                    </td>
                    <td className="px-3 py-2 align-top text-slate-600">
                      {a?.contacto_emergencia_nombre || a?.contacto_emergencia_telefono ? (
                        <>{a.contacto_emergencia_nombre} {a.contacto_emergencia_relacion && `(${a.contacto_emergencia_relacion})`}{(a.contacto_emergencia_nombre || a.contacto_emergencia_relacion) && a.contacto_emergencia_telefono && <br />}{a.contacto_emergencia_telefono}</>
                      ) : <span className="text-slate-300">— sin registrar —</span>}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <button onClick={() => setEditando({ estudiante: s, acudiente: a })} className="text-violet-500 hover:text-violet-700">✏️</button>
                    </td>
                  </tr>
                ))}
                {filas.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Este grado no tiene estudiantes todavía.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editando && (
        <AcudienteEditModal estudiante={editando.estudiante} acudiente={editando.acudiente} onClose={() => setEditando(null)} onGuardado={cargar} />
      )}
    </div>
  );
}
