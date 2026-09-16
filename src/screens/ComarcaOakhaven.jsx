import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { agruparPorNivel } from "../lib/gamification";

function SubirImagenReino({ reino, onGuardado }) {
  const [subiendo, setSubiendo] = useState(false);

  const subir = (file) => {
    if (file.size > 800 * 1024) { alert("La imagen es muy grande — usá una de menos de 800 KB."); return; }
    setSubiendo(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        await api.guardarImagenReino(reino.id, e.target.result);
        onGuardado();
      } catch (err) {
        alert("Error al guardar la imagen: " + err.message);
      }
      setSubiendo(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <label className="text-[10px] font-semibold px-2 py-1 rounded-full bg-white/80 text-slate-600 cursor-pointer">
      {subiendo ? "Subiendo…" : reino.imagen_url ? "🖼️ Cambiar imagen" : "🖼️ Subir imagen"}
      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && subir(e.target.files[0])} />
    </label>
  );
}

function AjustarEconomiaModal({ sesion, reino, billetesDeSesion, onClose, onCambio }) {
  const [tipo, setTipo] = useState("gp");
  const [modo, setModo] = useState("rapido"); // "rapido" | "billetes"
  const [cantidad, setCantidad] = useState(5);
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [denominaciones, setDenominaciones] = useState([]);
  const [conteos, setConteos] = useState({}); // { denominacion_id: cantidad }
  const [formDenomAbierto, setFormDenomAbierto] = useState(false);
  const [valorNuevo, setValorNuevo] = useState(10);
  const [emojiNuevo, setEmojiNuevo] = useState("💵");

  useEffect(() => {
    api.fetchComarcaDenominaciones().then((d) => {
      setDenominaciones(d);
      const inicial = {};
      d.forEach((den) => {
        const existente = billetesDeSesion.find((b) => b.reino_id === reino.id && b.denominacion_id === den.id);
        inicial[den.id] = existente?.cantidad || 0;
      });
      setConteos(inicial);
    });
  }, []);

  const totalContado = denominaciones.reduce((sum, d) => sum + d.valor * (conteos[d.id] || 0), 0);

  const cambiarConteo = (denomId, delta) => {
    setConteos((prev) => ({ ...prev, [denomId]: Math.max(0, (prev[denomId] || 0) + delta) }));
  };

  const crearDenominacion = async () => {
    await api.crearComarcaDenominacion(valorNuevo, emojiNuevo, null);
    const actualizadas = await api.fetchComarcaDenominaciones();
    setDenominaciones(actualizadas);
    setFormDenomAbierto(false);
  };

  const guardarConteo = async () => {
    setGuardando(true);
    try {
      const lista = denominaciones.map((d) => ({ denominacion_id: d.id, cantidad: conteos[d.id] || 0 }));
      await api.guardarBilletesReino(sesion.id, reino.id, lista);
      onCambio();
      onClose();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setGuardando(false);
  };

  const aplicar = async (signo) => {
    setGuardando(true);
    try {
      await api.ajustarEconomiaReino(sesion.id, reino.id, tipo, signo * (parseInt(cantidad, 10) || 0), motivo.trim() || null);
      onCambio();
      onClose();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-xs max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-bold text-slate-800">{reino.emoji} {reino.nombre}</h4>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <div className="flex gap-1 rounded-full bg-slate-100 p-1 mb-3">
          <button onClick={() => setTipo("gp")} className={`flex-1 text-xs py-1.5 rounded-full ${tipo === "gp" ? "bg-amber-500 text-white" : "text-slate-600"}`}>🪙 GP</button>
          <button onClick={() => setTipo("fp")} className={`flex-1 text-xs py-1.5 rounded-full ${tipo === "fp" ? "bg-violet-500 text-white" : "text-slate-600"}`}>🕊️ FP</button>
        </div>

        {tipo === "gp" && (
          <div className="flex gap-1 rounded-full bg-amber-50 p-1 mb-3">
            <button onClick={() => setModo("rapido")} className={`flex-1 text-[11px] py-1.5 rounded-full ${modo === "rapido" ? "bg-amber-500 text-white" : "text-slate-500"}`}>Ajuste rápido</button>
            <button onClick={() => setModo("billetes")} className={`flex-1 text-[11px] py-1.5 rounded-full ${modo === "billetes" ? "bg-amber-500 text-white" : "text-slate-500"}`}>💵 Contar billetes</button>
          </div>
        )}

        {tipo === "gp" && modo === "billetes" ? (
          <div>
            <div className="space-y-1.5 mb-3">
              {denominaciones.map((d) => (
                <div key={d.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-sm font-semibold text-slate-700">{d.emoji} {d.valor} GP</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => cambiarConteo(d.id, -1)} className="w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-500">−</button>
                    <span className="text-sm w-5 text-center">{conteos[d.id] || 0}</span>
                    <button onClick={() => cambiarConteo(d.id, 1)} className="w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-500">+</button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setFormDenomAbierto((v) => !v)} className="text-[11px] text-violet-500 mb-2">{formDenomAbierto ? "Cerrar" : "+ Agregar otra denominación"}</button>
            {formDenomAbierto && (
              <div className="flex gap-1.5 mb-3">
                <input value={emojiNuevo} onChange={(e) => setEmojiNuevo(e.target.value)} className="w-10 text-sm rounded-lg px-1 py-1.5 border border-slate-200 outline-none text-center" />
                <input type="number" value={valorNuevo} onChange={(e) => setValorNuevo(e.target.value)} className="flex-1 text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none text-center" />
                <button onClick={crearDenominacion} className="text-xs font-semibold px-2 py-1.5 rounded-lg bg-violet-500 text-white">+</button>
              </div>
            )}
            <div className="text-center text-sm font-bold text-amber-700 mb-3">Total contado: 🪙 {totalContado} GP</div>
            <button disabled={guardando} onClick={guardarConteo} className="w-full text-sm font-semibold py-2 rounded-lg bg-amber-500 text-white disabled:opacity-60">
              {guardando ? "Guardando…" : "Guardar conteo"}
            </button>
          </div>
        ) : (
          <>
            <input type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="Cantidad"
              className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none text-center" />
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional, ej: Peaje cobrado)"
              className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />
            <div className="flex gap-2">
              <button disabled={guardando} onClick={() => aplicar(-1)} className="flex-1 text-sm font-semibold py-2 rounded-lg bg-rose-100 text-rose-700 disabled:opacity-50">− Quitar</button>
              <button disabled={guardando} onClick={() => aplicar(1)} className="flex-1 text-sm font-semibold py-2 rounded-lg bg-emerald-100 text-emerald-700 disabled:opacity-50">+ Dar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TransferirProvinciaModal({ provincia, reinos, onClose, onCambio }) {
  const transferir = async (reinoId) => {
    try {
      await api.transferirProvincia(provincia.id, reinoId);
      onCambio();
      onClose();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-xs shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-bold text-slate-800 text-sm">{provincia.nombre}</h4>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">¿A qué reino pasa esta provincia? (por compra, duelo o juicio)</p>
        <div className="space-y-1.5">
          {reinos.map((r) => (
            <button key={r.id} onClick={() => transferir(r.id)}
              className={`w-full text-left text-sm px-3 py-2 rounded-lg ${provincia.reino_actual_id === r.id ? "bg-violet-100 text-violet-700 font-semibold" : "bg-slate-50 hover:bg-slate-100"}`}>
              {r.emoji} {r.nombre} {provincia.reino_actual_id === r.id && "· Dueño actual"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BancoModal({ sesion, reinos, onClose, onCambio }) {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [reinoElegido, setReinoElegido] = useState(reinos[0]?.id || "");
  const [comprando, setComprando] = useState(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [nombre, setNombre] = useState("");
  const [emoji, setEmoji] = useState("📦");
  const [costoGp, setCostoGp] = useState(5);
  const [reinoDueno, setReinoDueno] = useState("");

  const cargar = () => { setCargando(true); api.fetchComarcaProductos().then((d) => { setProductos(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  const empezarEdicion = (p) => {
    setEditandoId(p.id); setNombre(p.nombre); setEmoji(p.emoji); setCostoGp(p.costo_gp); setReinoDueno(p.reino_dueno_nombre || "");
    setFormAbierto(true);
  };

  const cancelarForm = () => {
    setFormAbierto(false); setEditandoId(null); setNombre(""); setEmoji("📦"); setCostoGp(5); setReinoDueno("");
  };

  const guardarProducto = async () => {
    if (!nombre.trim()) return;
    const campos = { nombre: nombre.trim(), emoji, costo_gp: parseInt(costoGp, 10) || 0, reino_dueno_nombre: reinoDueno || null };
    if (editandoId) {
      await api.editarComarcaProducto(editandoId, campos);
    } else {
      await api.crearComarcaProducto(campos);
    }
    cancelarForm();
    cargar();
  };

  const eliminarProducto = async (p) => {
    if (!confirm(`¿Quitar "${p.nombre}" del catálogo del Banco? El inventario que ya tengan los Reinos no se pierde.`)) return;
    await api.eliminarComarcaProducto(p.id);
    cargar();
  };

  const comprar = async (producto) => {
    if (!reinoElegido) { alert("Elegí primero a qué Reino se le vende."); return; }
    setComprando(producto.id);
    try {
      await api.comprarleAlBanco(sesion.id, reinoElegido, producto);
      onCambio();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setComprando(null);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-md max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">🏦 El Banco Central</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        <label className="text-xs text-slate-500 block mb-1">Vender a qué Reino</label>
        <select value={reinoElegido} onChange={(e) => setReinoElegido(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none">
          {reinos.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.nombre} (🪙 {r.gp})</option>)}
        </select>

        <button onClick={() => (formAbierto ? cancelarForm() : setFormAbierto(true))} className="text-xs font-semibold text-violet-500 mb-2">{formAbierto ? "Cerrar" : "+ Agregar producto al catálogo del Banco"}</button>
        {formAbierto && (
          <div className="bg-violet-50 rounded-xl p-3 mb-3 space-y-1.5">
            <div className="flex gap-1.5 flex-wrap items-end">
              <input value={emoji} onChange={(e) => setEmoji(e.target.value)} className="w-12 text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none text-center" />
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej: Tijeras)" className="flex-1 min-w-[100px] text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none" />
              <input type="number" value={costoGp} onChange={(e) => setCostoGp(e.target.value)} placeholder="GP" className="w-16 text-sm rounded-lg px-2 py-1.5 border border-slate-200 outline-none text-center" />
            </div>
            <select value={reinoDueno} onChange={(e) => setReinoDueno(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
              <option value="">Sin Reino dueño (producto general)</option>
              {reinos.map((r) => <option key={r.id} value={r.nombre}>{r.emoji} Especialidad de {r.nombre}</option>)}
            </select>
            <button onClick={guardarProducto} className="w-full text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-500 text-white">{editandoId ? "Guardar" : "Agregar"}</button>
          </div>
        )}

        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : productos.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-4">El Banco todavía no tiene productos para vender.</div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {productos.map((p) => (
              <div key={p.id} className="border border-slate-100 rounded-xl p-2.5 text-center relative">
                <div className="absolute top-1 right-1 flex gap-1">
                  <button onClick={() => empezarEdicion(p)} className="text-[10px] text-slate-300 hover:text-violet-600">✏️</button>
                  <button onClick={() => eliminarProducto(p)} className="text-[10px] text-slate-300 hover:text-rose-500">🗑</button>
                </div>
                <div className="text-2xl mb-1">{p.emoji}</div>
                <div className="text-xs font-semibold text-slate-700">{p.nombre}</div>
                {p.reino_dueno_nombre && <div className="text-[9px] text-violet-500 mb-1">⭐ {p.reino_dueno_nombre}</div>}
                <button disabled={comprando === p.id} onClick={() => comprar(p)} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-500 text-white mt-1.5 disabled:opacity-60">
                  {comprando === p.id ? "…" : `🪙 ${p.costo_gp}`}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TruequesModal({ sesion, reinos, inventario, onClose, onCambio }) {
  const [trueques, setTrueques] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [reinoOferta, setReinoOferta] = useState(reinos[0]?.id || "");
  const [reinoDestino, setReinoDestino] = useState(reinos[1]?.id || "");
  const [gpOfrecido, setGpOfrecido] = useState(0);
  const [gpPedido, setGpPedido] = useState(0);
  const [productoOfrecidoId, setProductoOfrecidoId] = useState("");
  const [productoPedidoId, setProductoPedidoId] = useState("");

  const cargar = () => { setCargando(true); api.fetchTruequesDeSesion(sesion.id).then((d) => { setTrueques(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  const productosDisponibles = [...new Map(inventario.map((i) => [i.producto_id, i.comarca_productos])).values()];

  const proponer = async () => {
    try {
      await api.proponerTrueque({
        sesion_id: sesion.id, reino_oferta_id: reinoOferta, reino_destino_id: reinoDestino,
        gp_ofrecido: parseInt(gpOfrecido, 10) || 0, gp_pedido: parseInt(gpPedido, 10) || 0,
        producto_ofrecido_id: productoOfrecidoId || null, cantidad_ofrecida: productoOfrecidoId ? 1 : 0,
        producto_pedido_id: productoPedidoId || null, cantidad_pedida: productoPedidoId ? 1 : 0,
      });
      setFormAbierto(false);
      cargar();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const resolver = async (t, aceptar) => {
    try {
      await api.resolverTrueque(t, aceptar);
      cargar();
      onCambio();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-md max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">🤝 Trueques entre Reinos</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        <button onClick={() => setFormAbierto((v) => !v)} className="text-xs font-semibold text-violet-500 mb-2">{formAbierto ? "Cerrar" : "+ Proponer un trueque"}</button>
        {formAbierto && (
          <div className="bg-violet-50 rounded-xl p-3 mb-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Reino que ofrece</label>
                <select value={reinoOferta} onChange={(e) => setReinoOferta(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
                  {reinos.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Reino destino</label>
                <select value={reinoDestino} onChange={(e) => setReinoDestino(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
                  {reinos.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Ofrece GP</label>
                <input type="number" value={gpOfrecido} onChange={(e) => setGpOfrecido(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Pide GP</label>
                <input type="number" value={gpPedido} onChange={(e) => setGpPedido(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Ofrece producto</label>
                <select value={productoOfrecidoId} onChange={(e) => setProductoOfrecidoId(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
                  <option value="">Ninguno</option>
                  {productosDisponibles.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Pide producto</label>
                <select value={productoPedidoId} onChange={(e) => setProductoPedidoId(e.target.value)} className="w-full text-xs rounded-lg px-2 py-1.5 border border-slate-200 outline-none bg-white">
                  <option value="">Ninguno</option>
                  {productosDisponibles.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.nombre}</option>)}
                </select>
              </div>
            </div>
            <button onClick={proponer} className="w-full text-xs font-semibold py-2 rounded-lg bg-violet-500 text-white">Proponer trueque</button>
          </div>
        )}

        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : trueques.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-4">Todavía no se propuso ningún trueque.</div>
        ) : (
          <div className="space-y-2">
            {trueques.map((t) => (
              <div key={t.id} className="border border-slate-100 rounded-xl p-2.5 text-xs">
                <div className="font-semibold text-slate-700">{t.oferta?.emoji} {t.oferta?.nombre} ⇄ {t.destino?.emoji} {t.destino?.nombre}</div>
                <div className="text-slate-500 mt-1">
                  Ofrece: {t.gp_ofrecido > 0 && `🪙${t.gp_ofrecido} `}{t.ofrecido && `${t.ofrecido.emoji} ${t.ofrecido.nombre}`}
                  {!t.gp_ofrecido && !t.ofrecido && "nada"}
                  {" — "}Pide: {t.gp_pedido > 0 && `🪙${t.gp_pedido} `}{t.pedido && `${t.pedido.emoji} ${t.pedido.nombre}`}
                  {!t.gp_pedido && !t.pedido && "nada"}
                </div>
                {t.estado === "pendiente" ? (
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => resolver(t, true)} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">✔ Aceptar</button>
                    <button onClick={() => resolver(t, false)} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-rose-100 text-rose-700">✕ Rechazar</button>
                  </div>
                ) : (
                  <span className={`text-[10px] font-semibold mt-1.5 inline-block px-2 py-0.5 rounded-full ${t.estado === "aceptado" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {t.estado === "aceptado" ? "✔ Aceptado" : "✕ Rechazado"}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InventarioImprimibleModal({ reinos, inventario, onClose }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl print:shadow-none print:max-h-none">
        <div className="flex justify-between items-center mb-4 print:hidden">
          <h3 className="font-bold text-slate-800">📋 Inventario por Reino</h3>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">🖨️ Imprimir</button>
            <button onClick={onClose} className="text-slate-400">✕</button>
          </div>
        </div>
        <div className="space-y-4">
          {reinos.map((r) => {
            const items = inventario.filter((i) => i.reino_id === r.id && i.cantidad > 0);
            return (
              <div key={r.id} className="border border-slate-200 rounded-xl p-3">
                <div className="font-bold text-slate-800 text-sm mb-2">{r.emoji} {r.nombre} — 🪙 {r.gp} GP · 🕊️ {r.fp} FP</div>
                {items.length === 0 ? (
                  <p className="text-xs text-slate-400">Sin productos todavía.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-slate-400"><th className="pb-1">Producto</th><th className="pb-1 text-right">Cantidad</th></tr></thead>
                    <tbody>
                      {items.map((i) => (
                        <tr key={i.id} className="border-t border-slate-100">
                          <td className="py-1">{i.comarca_productos?.emoji} {i.comarca_productos?.nombre}</td>
                          <td className="py-1 text-right font-semibold">{i.cantidad}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TableroSesion({ sesion, onVolver }) {
  const [reinos, setReinos] = useState([]);
  const [provincias, setProvincias] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [billetes, setBilletes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [ajustandoEconomiaDe, setAjustandoEconomiaDe] = useState(null);
  const [transfiriendo, setTransfiriendo] = useState(null);
  const [bancoAbierto, setBancoAbierto] = useState(false);
  const [truequesAbierto, setTruequesAbierto] = useState(false);
  const [inventarioAbierto, setInventarioAbierto] = useState(false);
  const [evento, setEvento] = useState(sesion.evento_actual || "");
  const [guardandoEvento, setGuardandoEvento] = useState(false);

  const cargar = () => {
    setCargando(true);
    Promise.all([api.fetchReinosDeSesion(sesion.id), api.fetchProvinciasDeSesion(sesion.id), api.fetchInventarioDeSesion(sesion.id), api.fetchBilletesDeSesion(sesion.id)]).then(([r, p, inv, bil]) => {
      setReinos(r); setProvincias(p); setInventario(inv); setBilletes(bil); setCargando(false);
    });
  };
  useEffect(() => { cargar(); }, [sesion.id]);

  const guardarEvento = async () => {
    setGuardandoEvento(true);
    try { await api.guardarEventoSesion(sesion.id, evento.trim() || null); } catch (e) { alert(e.message); }
    setGuardandoEvento(false);
  };

  const finalizar = async () => {
    if (!confirm("¿Finalizar esta sesión? El tablero queda guardado como historial, pero no se va a poder seguir jugando en ella.")) return;
    await api.finalizarSesionComarca(sesion.id);
    onVolver();
  };

  if (cargando) return <div className="text-sm text-slate-400">Cargando el tablero…</div>;

  return (
    <div>
      <button onClick={onVolver} className="text-sm text-violet-500 mb-3">← Volver a mis sesiones</button>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🗺️ {sesion.titulo}</h2>
          <p className="text-sm text-slate-400">Curso {sesion.grado_id} · {sesion.fecha} · {sesion.estado === "activa" ? "🟢 En juego" : "⚪ Finalizada"}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setBancoAbierto(true)} className="text-xs font-semibold px-3 py-2 rounded-full bg-amber-100 text-amber-700">🏦 El Banco</button>
          <button onClick={() => setTruequesAbierto(true)} className="text-xs font-semibold px-3 py-2 rounded-full bg-teal-100 text-teal-700">🤝 Trueques</button>
          <button onClick={() => setInventarioAbierto(true)} className="text-xs font-semibold px-3 py-2 rounded-full bg-indigo-100 text-indigo-700">📋 Inventario</button>
          {sesion.estado === "activa" && (
            <button onClick={finalizar} className="text-xs font-semibold px-3 py-2 rounded-full border border-slate-200 text-slate-600">🏁 Finalizar sesión</button>
          )}
        </div>
      </div>

      {/* Carta de Destino actual */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 mb-4">
        <div className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">🎲 Carta de Destino Inesperado (evento actual)</div>
        <div className="flex gap-2">
          <input value={evento} onChange={(e) => setEvento(e.target.value)} placeholder="Ej: Peste Fiscal — el Banco sube todos sus precios esta ronda"
            className="flex-1 text-sm rounded-lg px-3 py-2 border border-amber-200 outline-none bg-white" />
          <button disabled={guardandoEvento} onClick={guardarEvento} className="text-xs font-semibold px-3 py-2 rounded-lg bg-amber-500 text-white disabled:opacity-60">Guardar</button>
        </div>
      </div>

      {/* Los 6 reinos */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {reinos.map((reino) => {
          const susProvincias = provincias.filter((p) => p.reino_actual_id === reino.id);
          return (
            <div key={reino.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="relative h-24 bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center">
                {reino.imagen_url ? (
                  <img src={reino.imagen_url} alt={reino.nombre} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl">{reino.emoji}</span>
                )}
                <div className="absolute bottom-1.5 right-1.5"><SubirImagenReino reino={reino} onGuardado={cargar} /></div>
              </div>
              <div className="p-3">
                <div className="font-bold text-slate-800 text-sm mb-1">{reino.emoji} {reino.nombre}</div>
                <div className="flex gap-2 mb-2">
                  <button onClick={() => setAjustandoEconomiaDe(reino)} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700">🪙 {reino.gp} GP</button>
                  <button onClick={() => setAjustandoEconomiaDe(reino)} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-violet-100 text-violet-700">🕊️ {reino.fp} FP</button>
                </div>
                <div className="text-[10px] text-slate-400 mb-1">Provincias controladas: {susProvincias.length}/24</div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {susProvincias.map((p) => (
                    <button key={p.id} onClick={() => setTransfiriendo(p)} title={p.recurso}
                      className={`text-[9px] px-1.5 py-0.5 rounded ${p.reino_original_id === p.reino_actual_id ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700"}`}>
                      {p.nombre.split("— ")[1]}
                    </button>
                  ))}
                </div>
                {inventario.filter((i) => i.reino_id === reino.id && i.cantidad > 0).length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1.5 border-t border-slate-100">
                    {inventario.filter((i) => i.reino_id === reino.id && i.cantidad > 0).map((i) => (
                      <span key={i.id} title={i.comarca_productos?.nombre} className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded-full">
                        {i.comarca_productos?.emoji} x{i.cantidad}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {ajustandoEconomiaDe && <AjustarEconomiaModal sesion={sesion} reino={ajustandoEconomiaDe} billetesDeSesion={billetes} onClose={() => setAjustandoEconomiaDe(null)} onCambio={cargar} />}
      {transfiriendo && <TransferirProvinciaModal provincia={transfiriendo} reinos={reinos} onClose={() => setTransfiriendo(null)} onCambio={cargar} />}
      {bancoAbierto && <BancoModal sesion={sesion} reinos={reinos} onClose={() => setBancoAbierto(false)} onCambio={cargar} />}
      {truequesAbierto && <TruequesModal sesion={sesion} reinos={reinos} inventario={inventario} onClose={() => setTruequesAbierto(false)} onCambio={cargar} />}
      {inventarioAbierto && <InventarioImprimibleModal reinos={reinos} inventario={inventario} onClose={() => setInventarioAbierto(false)} />}
    </div>
  );
}

export function VistaComarcaOakhaven({ grados, gradoActivo }) {
  const [sesiones, setSesiones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [sesionAbierta, setSesionAbierta] = useState(null);
  const [creandoAbierto, setCreandoAbierto] = useState(false);
  const [editandoSesion, setEditandoSesion] = useState(null);
  const [gradoId, setGradoId] = useState(gradoActivo || grados[0]?.id || "");
  const [titulo, setTitulo] = useState("Comarca de Oakhaven");
  const [catalogoReinos, setCatalogoReinos] = useState([]);
  const [reinosSeleccionados, setReinosSeleccionados] = useState([]);
  const [cargandoReinos, setCargandoReinos] = useState(false);
  const [creando, setCreando] = useState(false);

  const cargar = () => { setCargando(true); api.fetchSesionesComarca().then((d) => { setSesiones(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    if (!gradoId) return;
    setCargandoReinos(true);
    api.fetchReinosDelCurso(gradoId).then((r) => { setCatalogoReinos(r); setReinosSeleccionados(r); setCargandoReinos(false); });
  }, [gradoId]);

  const toggleReino = (nombre) => {
    setReinosSeleccionados((prev) => prev.includes(nombre) ? prev.filter((r) => r !== nombre) : [...prev, nombre]);
  };

  const crear = async () => {
    if (reinosSeleccionados.length < 2) { alert("Elegí al menos 2 Reinos para que jueguen en esta sesión."); return; }
    setCreando(true);
    try {
      const nueva = await api.crearSesionComarca(gradoId, titulo.trim() || "Comarca de Oakhaven", reinosSeleccionados);
      setCreandoAbierto(false);
      setSesionAbierta(nueva);
    } catch (e) {
      alert("Error al crear la sesión: " + e.message);
    }
    setCreando(false);
  };

  const guardarEdicionSesion = async () => {
    try {
      await api.editarSesionComarca(editandoSesion.id, { titulo: editandoSesion.titulo.trim() || "Comarca de Oakhaven" });
      setEditandoSesion(null);
      cargar();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const eliminarSesion = async (s, ev) => {
    ev.stopPropagation();
    if (!confirm(`¿Eliminar por completo la sesión "${s.titulo}"? Se borran también sus reinos, provincias, trueques y todo lo demás. No se puede deshacer.`)) return;
    try {
      await api.eliminarSesionComarca(s.id);
      cargar();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  if (sesionAbierta) return <TableroSesion sesion={sesionAbierta} onVolver={() => { setSesionAbierta(null); cargar(); }} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🏛️ Comarca de Oakhaven</h2>
          <p className="text-sm text-slate-400">6 Reinos rivales, provincias en disputa, y una economía viva — para vivirlo en el aula.</p>
        </div>
        <button onClick={() => setCreandoAbierto((v) => !v)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">
          {creandoAbierto ? "Cerrar" : "+ Nueva sesión"}
        </button>
      </div>

      {creandoAbierto && (
        <div className="bg-violet-50 rounded-2xl p-4 my-4">
          <label className="text-xs text-slate-500 block mb-1">Curso</label>
          <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white">
            {grados.map((g) => <option key={g.id} value={g.id}>Curso {g.id}</option>)}
          </select>
          <label className="text-xs text-slate-500 block mb-1">Título de la sesión</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none bg-white" />

          <label className="text-xs text-slate-500 block mb-1">¿Qué Reinos juegan esta sesión?</label>
          {cargandoReinos ? (
            <p className="text-xs text-slate-400 mb-3">Buscando…</p>
          ) : catalogoReinos.length === 0 ? (
            <p className="text-xs text-rose-500 mb-3">Este curso todavía no tiene Reinos asignados a sus estudiantes — hacelo primero desde Estudiantes → Reinos.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {catalogoReinos.map((r, i) => {
                const marcado = reinosSeleccionados.includes(r);
                return (
                  <button key={r} type="button" onClick={() => toggleReino(r)}
                    className={`text-xs font-semibold px-2 py-1 rounded-full border ${marcado ? "bg-violet-500 text-white border-violet-500" : "bg-white text-slate-400 border-slate-200"}`}>
                    {marcado ? "✓ " : ""}{api.COMARCA_REINOS_BASE[i]?.emoji || "🏰"} {r}
                  </button>
                );
              })}
            </div>
          )}

          <p className="text-[11px] text-slate-400 mb-3">Se va a crear un Reino de la Comarca por cada uno de los marcados, con sus 4 provincias, listos para repartir entre las mesas.</p>
          <button disabled={creando || reinosSeleccionados.length < 2} onClick={crear} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
            {creando ? "Creando el tablero…" : "🏛️ Fundar la Comarca"}
          </button>
        </div>
      )}

      {editandoSesion && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setEditandoSesion(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-xs shadow-xl">
            <h4 className="font-bold text-slate-800 mb-2">Editar sesión</h4>
            <input value={editandoSesion.titulo} onChange={(e) => setEditandoSesion({ ...editandoSesion, titulo: e.target.value })} autoFocus
              className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditandoSesion(null)} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
              <button onClick={guardarEdicionSesion} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {cargando ? (
        <div className="text-sm text-slate-400 mt-4">Cargando…</div>
      ) : sesiones.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200 mt-4">
          Todavía no armaste ninguna sesión. Creá la primera con "+ Nueva sesión".
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          {sesiones.map((s) => (
            <div key={s.id} onClick={() => setSesionAbierta(s)} className="bg-white rounded-2xl border border-slate-100 p-4 text-left hover:border-violet-300 cursor-pointer relative">
              <div className="flex justify-between items-start gap-2">
                <div className="font-bold text-slate-800">{s.titulo}</div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); setEditandoSesion(s); }} className="text-xs text-slate-400 hover:text-violet-600">✏️</button>
                  <button onClick={(e) => eliminarSesion(s, e)} className="text-xs text-slate-400 hover:text-rose-500">🗑</button>
                </div>
              </div>
              <div className="text-xs text-slate-400">Curso {s.grado_id} · {s.fecha}</div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1.5 inline-block ${s.estado === "activa" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {s.estado === "activa" ? "🟢 En juego" : "⚪ Finalizada"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
