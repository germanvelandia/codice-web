import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { VistaPromocion } from "./Promocion";

function MiCuenta({ miPerfil }) {
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const cambiar = async () => {
    setMensaje("");
    if (nueva.length < 6) { setMensaje("La contraseña debe tener al menos 6 caracteres."); return; }
    if (nueva !== confirmar) { setMensaje("Las dos contraseñas no coinciden."); return; }
    setGuardando(true);
    try {
      await api.cambiarMiContrasena(nueva);
      setMensaje("✔️ Contraseña actualizada.");
      setNueva(""); setConfirmar("");
    } catch (e) {
      setMensaje("Error: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
      <h3 className="font-bold text-slate-800 mb-1">Mi cuenta</h3>
      <p className="text-xs text-slate-400 mb-3">{miPerfil?.nombre} · {miPerfil?.email}{miPerfil?.es_admin && " · 👑 Administrador"}</p>

      <label className="text-xs text-slate-500 block mb-1">Nueva contraseña</label>
      <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Mínimo 6 caracteres"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none" />
      <label className="text-xs text-slate-500 block mb-1">Confirmar nueva contraseña</label>
      <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)}
        className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />

      {mensaje && <p className={`text-xs mb-2 ${mensaje.startsWith("✔️") ? "text-emerald-600" : "text-rose-500"}`}>{mensaje}</p>}

      <button disabled={guardando} onClick={cambiar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">
        {guardando ? "Guardando…" : "Cambiar contraseña"}
      </button>
      <p className="text-[11px] text-slate-400 mt-3">
        Por seguridad, nadie (ni un administrador) puede ver o recuperar tu contraseña actual — solo se puede establecer una nueva.
        Si olvidaste la tuya, usa "¿Olvidaste tu contraseña?" en la pantalla de inicio de sesión.
      </p>
    </div>
  );
}

function ListaDocentes({ miPerfil, onCambio }) {
  const [profesores, setProfesores] = useState([]);
  const [cargando, setCargando] = useState(true);

  const cargar = () => {
    setCargando(true);
    api.fetchProfesoresConMaterias().then((data) => { setProfesores(data); setCargando(false); });
  };
  useEffect(() => { cargar(); }, []);

  const toggleAdmin = async (p) => {
    const accion = p.es_admin ? "quitarle" : "darle";
    if (!confirm(`¿Seguro que quieres ${accion} el rol de administrador a ${p.nombre}?`)) return;
    await api.establecerAdmin(p.id, !p.es_admin);
    cargar();
    onCambio?.();
  };

  const eliminar = async (p) => {
    if (!confirm(`¿Quitar a ${p.nombre} del listado de docentes? Esto NO revoca su acceso — si vuelve a iniciar sesión, va a reaparecer automáticamente. Para bloquearlo de verdad, hacelo desde Supabase → Authentication → Users.`)) return;
    await api.eliminarDocente(p.id);
    cargar();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
      <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th className="text-left px-3 py-2 border-b border-slate-100 bg-slate-50">Docente</th>
            <th className="text-left px-3 py-2 border-b border-slate-100 bg-slate-50">Correo</th>
            <th className="text-left px-3 py-2 border-b border-slate-100 bg-slate-50">Materias</th>
            <th className="text-left px-3 py-2 border-b border-slate-100 bg-slate-50">Rol</th>
            {miPerfil?.es_admin && <th className="text-left px-3 py-2 border-b border-slate-100 bg-slate-50"></th>}
          </tr>
        </thead>
        <tbody>
          {cargando ? (
            <tr><td colSpan={5} className="px-3 py-4 text-slate-400">Cargando…</td></tr>
          ) : profesores.length === 0 ? (
            <tr><td colSpan={5} className="px-3 py-4 text-slate-400">No hay docentes registrados todavía.</td></tr>
          ) : (
            profesores.map((p) => (
              <tr key={p.id} className="odd:bg-white even:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-700">{p.nombre}</td>
                <td className="px-3 py-2 text-slate-500">{p.email}</td>
                <td className="px-3 py-2 text-slate-500">{(p.materias || []).map((m) => m.nombre).join(", ") || "—"}</td>
                <td className="px-3 py-2">
                  {p.es_admin ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">👑 Admin</span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Docente</span>
                  )}
                </td>
                {miPerfil?.es_admin && (
                  <td className="px-3 py-2">
                    {p.id !== miPerfil.id && (
                      <div className="flex gap-2">
                        <button onClick={() => toggleAdmin(p)} className="text-[11px] text-violet-600 underline">
                          {p.es_admin ? "Quitar admin" : "Hacer admin"}
                        </button>
                        <button onClick={() => eliminar(p)} className="text-[11px] text-rose-500 underline">
                          Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function AdministracionModal({ onClose }) {
  const [miPerfil, setMiPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargarPerfil = () => api.fetchMiPerfil().then((p) => { setMiPerfil(p); setCargando(false); });
  useEffect(() => { cargarPerfil(); }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-slate-50 rounded-2xl p-5 w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800">Docentes y cuenta</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : (
          <>
            <MiCuenta miPerfil={miPerfil} />
            <h3 className="font-bold text-slate-800 mb-2">Docentes registrados</h3>
            {!miPerfil?.es_admin && (
              <p className="text-xs text-slate-400 mb-2">Solo un administrador puede cambiar el rol de otros docentes. Tú ves este listado en modo lectura.</p>
            )}
            <ListaDocentes miPerfil={miPerfil} onCambio={cargarPerfil} />

            {miPerfil?.es_admin && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mt-4">
                <VistaPromocion />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
