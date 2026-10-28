import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Avatares de respaldo: se usan solo si todavía no se corrió el script 118.
const RESPALDO = [
  { id: "r1", nombre_el: "El Vanguardia", nombre_la: "La Vanguardia", rol: "Logístico / Guardián", descripcion: "Protege al grupo y se asegura de que nada falte.", imagen_el: "/avatares/vanguardia-el.webp", imagen_la: "/avatares/vanguardia-la.webp", visible: true, orden: 1 },
  { id: "r2", nombre_el: "El Artífice", nombre_la: "La Artífice", rol: "Investigador / Académico", descripcion: "Construye ideas y las pone a funcionar.", imagen_el: "/avatares/artifice-el.webp", imagen_la: "/avatares/artifice-la.webp", visible: true, orden: 2 },
  { id: "r3", nombre_el: "El Heraldo", nombre_la: "La Heraldo", rol: "Investigador / Académico", descripcion: "Comunica lo aprendido.", imagen_el: "/avatares/heraldo-el.webp", imagen_la: "/avatares/heraldo-la.webp", visible: true, orden: 3 },
  { id: "r4", nombre_el: "El Oráculo", nombre_la: "La Oráculo", rol: "Investigador / Académico", descripcion: "Ve más allá de lo evidente.", imagen_el: "/avatares/oraculo-el.webp", imagen_la: "/avatares/oraculo-la.webp", visible: true, orden: 4 },
  { id: "r5", nombre_el: "El Estratega", nombre_la: "La Estratega", rol: "Líder / Organizador", descripcion: "Planea el camino del equipo.", imagen_el: "/avatares/estratega-el.webp", imagen_la: "/avatares/estratega-la.webp", visible: true, orden: 5 },
  { id: "r6", nombre_el: "El Sanador", nombre_la: "La Sanador", rol: "Líder / Organizador", descripcion: "Cuida el clima del grupo.", imagen_el: "/avatares/sanador-el.webp", imagen_la: "/avatares/sanador-la.webp", visible: true, orden: 6 },
];
const BUCKET = "sala-avatares";

// Frase corta para recordar cada rol (se busca por el comienzo del nombre del rol)
const FRASES = [
  ["maestro", "Dirige al gremio y reparte las tareas"], ["consejero", "Cuida el tiempo y la calidad del trabajo"],
  ["defensor", "Cuida el respeto y la convivencia"], ["guardi", "Diseña el símbolo y cuida los materiales"],
  ["heraldo", "Habla por el gremio ante otros gremios"], ["peregrino", "Investiga y pregunta el porqué"],
  ["cronista", "Escribe y guarda los acuerdos"],
];
const norm = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const fraseDe = (rolNombre) => (FRASES.find(([k]) => norm(rolNombre).startsWith(k)) || [])[1] || "";
// "Rol · Función" → { nombre, funcion }; descripción → { hace, poder }
function partesDe(a) {
  const [nombre, ...resto] = String(a.rol || "").split(" · ");
  const partes = String(a.descripcion || "").split(/Poder c[ií]vico:\s*/i);
  return { nombre: nombre || a.nombre_el, funcion: resto.join(" · "), hace: (partes[0] || "").trim(), poder: (partes[1] || "").trim() };
}
const tituloRol = (a) => (String(a.rol || "").includes(" · ") ? partesDe(a).nombre : String(a.nombre_el || ""));
const nomAvatar = (a) => String(a.nombre_el || "").replace(/^El\s+/i, "");
const esc = (t) => String(t || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
function imprimirTabla(lista) {
  const filas = lista.map((a) => { const p = partesDe(a); return `<tr>
    <td class="av">${a.imagen_el ? `<img src="${new URL(a.imagen_el, location.origin).href}">` : ""}${a.imagen_la ? `<img src="${new URL(a.imagen_la, location.origin).href}">` : ""}</td>
    <td><b style="font-size:12.5px">${esc(tituloRol(a))}</b><br><span class="f">${esc(p.funcion)}</span></td><td class="eq">=</td>
    <td class="n">${esc(nomAvatar(a))}<br><span class="f">${esc(a.nombre_la || "")}</span></td><td class="k">${esc(fraseDe(p.nombre))}</td><td>${esc(p.hace)}</td><td>${esc(p.poder)}</td></tr>`; }).join("");
  const w = window.open("", "_blank");
  if (!w) { alert("El navegador bloqueó la ventana. Permite las ventanas emergentes para imprimir."); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Roles del gremio</title><style>
    @page{size:landscape;margin:12mm} body{font-family:Georgia,serif;color:#17264D} h1{font-size:20px;margin:0 0 4px} p{font-size:11px;margin:0 0 10px;color:#555}
    table{border-collapse:collapse;width:100%;font-size:10.5px} th{background:#17264D;color:#fff;padding:6px;text-align:left} td{border:1px solid #cdd3e0;padding:6px;vertical-align:top}
    td.n{font-weight:bold;font-size:12px;width:90px} td.eq{font-size:18px;color:#B8892B;text-align:center;width:24px} td.av{width:110px;white-space:nowrap} td.av img{height:92px;margin-right:3px;border-radius:5px} .f{color:#B8892B;font-size:10px} .k{font-weight:bold;color:#2F55A4} tr{page-break-inside:avoid}
  </style></head><body><h1>Roles del gremio — ¿quién hace qué?</h1><p>Cada rol del gremio tiene su avatar. El nombre que se usa en el trabajo es el del rol; el nombre del avatar es solo el del personaje de la carta.</p>
  <table><thead><tr><th>Carta</th><th>Rol en el gremio</th><th></th><th>Nombre del avatar</th><th>Se resume en</th><th>Qué hace en el aula</th><th>Poder cívico</th></tr></thead><tbody>${filas}</tbody></table>
  <script>window.onload=()=>setTimeout(()=>window.print(),500)</script></body></html>`);
  w.document.close();
}

function TablaRoles({ lista }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs text-slate-500">Se usa el nombre del <b>rol</b> (Maestro del Gremio, Consejero Real…). El nombre del <b>avatar</b> es solo el personaje de la carta.</p>
        <button onClick={() => imprimirTabla(lista)} className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">🖨️ Imprimir</button>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {lista.map((a) => { const p = partesDe(a); return (
          <div key={a.id} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white pl-3 pr-3.5 py-1.5 text-xs">
            <span className="font-bold text-[#2F55A4]">{tituloRol(a)}</span><span className="text-[#B8892B] font-extrabold">=</span><span className="text-slate-500">avatar {nomAvatar(a)}</span>
          </div>); })}
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs min-w-[760px]">
          <thead><tr className="text-left text-white" style={{ background: "#17264D" }}>
            <th className="p-2 w-28">Carta</th><th className="p-2 w-44">Rol en el gremio</th><th className="p-2 w-32">Nombre del avatar</th><th className="p-2 w-40">Se resume en</th><th className="p-2">Qué hace en el aula</th><th className="p-2">Poder cívico</th>
          </tr></thead>
          <tbody>
            {lista.map((a, i) => { const p = partesDe(a); return (
              <tr key={a.id} className={i % 2 ? "bg-slate-50" : "bg-white"}>
                <td className="p-2 align-top"><div className="flex gap-1">{[a.imagen_el, a.imagen_la].filter(Boolean).map((u) => <img key={u} src={u} alt="" loading="lazy" className="h-20 w-auto rounded" />)}</div></td>
                <td className="p-2 align-top"><div className="font-extrabold text-[#2F55A4] text-sm">{tituloRol(a)}</div><div className="text-[10px] font-semibold text-[#B8892B]">{p.funcion}</div></td>
                <td className="p-2 align-top"><div className="font-bold text-slate-600">= {nomAvatar(a)}</div><div className="text-[10px] text-slate-400">{a.nombre_la}</div></td>
                <td className="p-2 align-top font-bold text-[#2F55A4]">{fraseDe(p.nombre)}</td>
                <td className="p-2 align-top text-slate-700">{p.hace}</td>
                <td className="p-2 align-top text-slate-700">{p.poder || <span className="text-slate-300">—</span>}</td>
              </tr>); })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Reduce la imagen (máx. 700 px de alto) y la convierte a webp antes de subirla
function reducirImagen(archivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo); const img = new Image();
    img.onload = () => {
      const esc = Math.min(1, 700 / img.height, 560 / img.width);
      const c = document.createElement("canvas"); c.width = Math.round(img.width * esc); c.height = Math.round(img.height * esc);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen"))), "image/webp", 0.86);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("El archivo no es una imagen válida")); };
    img.src = url;
  });
}
async function subirImagen(archivo) {
  const blob = await reducirImagen(archivo);
  const ruta = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, blob, { contentType: "image/webp", upsert: false });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
}
const rutaEnBucket = (url) => { const m = String(url || "").match(new RegExp(`/${BUCKET}/(.+)$`)); return m ? m[1] : null; };

function FormAvatar({ avatar, roles, siguienteOrden, onClose, onGuardado }) {
  const [f, setF] = useState({
    nombre_el: avatar?.nombre_el || "", nombre_la: avatar?.nombre_la || "", rol: avatar?.rol || "", descripcion: avatar?.descripcion || "",
    imagen_el: avatar?.imagen_el || "", imagen_la: avatar?.imagen_la || "", visible: avatar?.visible ?? true,
  });
  const [subiendo, setSubiendo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const elegirImagen = async (campo, archivo) => {
    if (!archivo) return;
    setSubiendo(campo);
    try { set(campo, await subirImagen(archivo)); } catch (e) { alert("No se pudo subir la imagen: " + e.message); }
    setSubiendo("");
  };
  const guardar = async () => {
    if (!f.nombre_el.trim()) { alert("Escribe al menos el nombre del avatar."); return; }
    setGuardando(true);
    try {
      const campos = { nombre_el: f.nombre_el.trim(), nombre_la: f.nombre_la.trim() || null, rol: f.rol.trim() || null, descripcion: f.descripcion.trim() || null, imagen_el: f.imagen_el || null, imagen_la: f.imagen_la || null, visible: f.visible };
      if (avatar?.id) { const { error } = await supabase.from("sala_avatares").update(campos).eq("id", avatar.id); if (error) throw error; }
      else { const { error } = await supabase.from("sala_avatares").insert({ ...campos, orden: siguienteOrden }); if (error) throw error; }
      onGuardado();
    } catch (e) { alert("No se pudo guardar: " + e.message); }
    setGuardando(false);
  };
  const cls = "w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white";
  const Imagen = ({ campo, titulo }) => (
    <div>
      <div className="text-[11px] font-semibold text-slate-500 mb-1">{titulo}</div>
      <div className="aspect-[2/3] rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden mb-1.5">
        {f[campo] ? <img src={f[campo]} alt="" className="w-full h-full object-contain" /> : <span className="text-xs text-slate-400 px-2 text-center">{subiendo === campo ? "Subiendo…" : "Sin imagen"}</span>}
      </div>
      <label className="block text-center text-xs font-semibold text-violet-600 cursor-pointer">
        {subiendo === campo ? "Subiendo…" : f[campo] ? "Cambiar imagen" : "Subir imagen"}
        <input type="file" accept="image/*" className="hidden" disabled={!!subiendo} onChange={(e) => { elegirImagen(campo, e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {f[campo] && <button onClick={() => set(campo, "")} className="block mx-auto text-[10px] text-slate-400 mt-0.5">Quitar</button>}
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-4 shadow-xl">
        <h3 className="font-bold text-slate-800 mb-3">{avatar?.id ? "✏️ Modificar avatar" : "➕ Agregar avatar"}</h3>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input value={f.nombre_el} onChange={(e) => set("nombre_el", e.target.value)} placeholder="Nombre (ej: El Sanador)" className={cls} />
          <input value={f.nombre_la} onChange={(e) => set("nombre_la", e.target.value)} placeholder="Versión femenina (ej: La Sanadora)" className={cls} />
        </div>
        <input value={f.rol} onChange={(e) => set("rol", e.target.value)} list="roles-avatar" placeholder="Rol (ej: Líder / Organizador)" className={cls + " mb-2"} />
        <datalist id="roles-avatar">{roles.map((r) => <option key={r} value={r} />)}</datalist>
        <textarea value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} rows={2} placeholder="Descripción breve" className={cls + " mb-3"} />
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Imagen campo="imagen_el" titulo="Carta masculina" />
          <Imagen campo="imagen_la" titulo="Carta femenina" />
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600 mb-3"><input type="checkbox" checked={f.visible} onChange={(e) => set("visible", e.target.checked)} /> Visible para los estudiantes</label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
          <button disabled={guardando || !!subiendo} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

export function SalaAvatares({ esDocente = false }) {
  const [avatares, setAvatares] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [sinTabla, setSinTabla] = useState(false);
  const [vista, setVista] = useState("cartas");
  const [filtro, setFiltro] = useState("todos");
  const [abierto, setAbierto] = useState(null);
  const [editando, setEditando] = useState(null); // objeto avatar, o {} para nuevo
  const [seleccionando, setSeleccionando] = useState(false);
  const [sel, setSel] = useState([]);
  const [trabajando, setTrabajando] = useState(false);

  const cargar = async () => {
    const { data, error } = await supabase.from("sala_avatares").select("*").order("orden").order("id");
    if (error) { setSinTabla(true); setAvatares(RESPALDO); } else { setSinTabla(false); setAvatares(data || []); }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const visibles = useMemo(() => (esDocente ? avatares : avatares.filter((a) => a.visible)), [avatares, esDocente]);
  const roles = useMemo(() => Array.from(new Set(avatares.map((a) => a.rol).filter(Boolean))), [avatares]);
  const lista = filtro === "todos" ? visibles : visibles.filter((a) => String(a.id) === filtro);
  const puedeEditar = esDocente && !sinTabla;

  const toggleSel = (id) => setSel((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const cambiarVisible = async (ids, v) => {
    setTrabajando(true);
    const { error } = await supabase.from("sala_avatares").update({ visible: v }).in("id", ids);
    if (error) alert("Error: " + error.message);
    setSel([]); await cargar(); setTrabajando(false);
  };
  const eliminar = async (ids) => {
    if (!confirm(`¿Eliminar ${ids.length === 1 ? "este avatar" : `estos ${ids.length} avatares`}? No se puede deshacer.`)) return;
    setTrabajando(true);
    try {
      const rutas = avatares.filter((a) => ids.includes(a.id)).flatMap((a) => [rutaEnBucket(a.imagen_el), rutaEnBucket(a.imagen_la)]).filter(Boolean);
      const { error } = await supabase.from("sala_avatares").delete().in("id", ids);
      if (error) throw error;
      if (rutas.length) await supabase.storage.from(BUCKET).remove(rutas).catch(() => {});
    } catch (e) { alert("Error: " + e.message); }
    setSel([]); await cargar(); setTrabajando(false);
  };
  const mover = async (a, dir) => {
    const orden = [...avatares].sort((x, y) => x.orden - y.orden || x.id - y.id);
    const i = orden.findIndex((x) => x.id === a.id), j = i + dir;
    if (j < 0 || j >= orden.length) return;
    [orden[i], orden[j]] = [orden[j], orden[i]];
    setTrabajando(true);
    await Promise.all(orden.map((x, k) => supabase.from("sala_avatares").update({ orden: k + 1 }).eq("id", x.id)));
    await cargar(); setTrabajando(false);
  };
  const siguienteOrden = (avatares.reduce((m, a) => Math.max(m, a.orden || 0), 0) || 0) + 1;


  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
        <h2 className="text-lg font-extrabold text-slate-800">🎭 Sala de avatares</h2>
        {puedeEditar && (
          <div className="flex gap-1.5">
            <button onClick={() => setEditando({})} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">➕ Agregar</button>
            <button onClick={() => { setSeleccionando((v) => !v); setSel([]); }} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${seleccionando ? "bg-slate-700 text-white border-slate-700" : "border-slate-200 text-slate-600"}`}>{seleccionando ? "✕ Cancelar" : "☑️ Seleccionar"}</button>
          </div>
        )}
      </div>
      <div className="flex gap-1.5 mb-3">
        {[["cartas", "🎴 Cartas"], ["tabla", "📋 Tabla comparativa de roles"]].map(([k, l]) => (
          <button key={k} onClick={() => setVista(k)} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${vista === k ? "bg-[#17264D] text-white border-[#17264D]" : "bg-white text-slate-600 border-slate-200"}`}>{l}</button>
        ))}
      </div>
      {vista === "tabla" ? (cargando ? <p className="text-sm text-slate-400">Cargando…</p> : <TablaRoles lista={visibles} />) : (<>
      <p className="text-xs text-slate-500 mb-3">Cada rol del gremio tiene su avatar, con versión masculina y femenina. Toca una carta para verla en grande.</p>

      {esDocente && sinTabla && <p className="text-xs bg-amber-50 text-amber-700 rounded-lg p-2.5 mb-3">Para poder agregar, modificar o eliminar avatares falta correr el script <b>118_sala_avatares.sql</b> en Supabase. Mientras tanto se muestran los 6 avatares iniciales.</p>}

      {seleccionando && puedeEditar && (
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 rounded-xl p-2.5 mb-3">
          <span className="text-xs text-slate-500">{sel.length} seleccionado(s)</span>
          <button onClick={() => setSel(lista.map((a) => a.id))} className="text-xs text-violet-500">Todos</button>
          <button onClick={() => setSel([])} className="text-xs text-slate-400">Ninguno</button>
          <div className="flex-1" />
          <button disabled={!sel.length || trabajando} onClick={() => cambiarVisible(sel, true)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-500 text-white disabled:opacity-40">👁 Mostrar</button>
          <button disabled={!sel.length || trabajando} onClick={() => cambiarVisible(sel, false)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-500 text-white disabled:opacity-40">🙈 Ocultar</button>
          <button disabled={!sel.length || trabajando} onClick={() => eliminar(sel)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-rose-500 text-white disabled:opacity-40">🗑 Eliminar</button>
        </div>
      )}

      {visibles.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {[{ key: "todos", label: "Todos" }, ...visibles.map((a) => ({ key: String(a.id), label: tituloRol(a) }))].map((f) => (
            <button key={f.key} onClick={() => setFiltro(f.key)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${filtro === f.key ? "bg-[#2F55A4] text-white border-[#2F55A4]" : "bg-white text-slate-600 border-slate-200"}`}>{f.label}</button>
          ))}
        </div>
      )}

      {cargando ? <p className="text-sm text-slate-400">Cargando…</p> : lista.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">{esDocente ? "No hay avatares todavía. Pulsa «➕ Agregar» para crear el primero." : "Pronto habrá avatares aquí."}</p>
      ) : (
        <div className="space-y-5">
          {lista.map((a) => (
            <div key={a.id} className={`rounded-2xl border p-3 ${seleccionando && sel.includes(a.id) ? "border-violet-400" : "border-slate-200"} ${!a.visible ? "opacity-60" : ""}`} style={{ background: "#fbf8ef" }}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
                {seleccionando && puedeEditar && <input type="checkbox" checked={sel.includes(a.id)} onChange={() => toggleSel(a.id)} />}
                <span className="font-extrabold text-[#17264D] text-base">{tituloRol(a)}</span>
                {String(a.rol || "").includes(" · ") ? <span className="text-[11px] font-semibold text-[#B8892B]">{partesDe(a).funcion}</span> : a.rol && <span className="text-[11px] font-semibold text-[#B8892B]">{a.rol}</span>}
                <span className="text-[10px] text-slate-400 w-full sm:w-auto">Avatar de la carta: {nomAvatar(a)}{a.nombre_la ? ` / ${a.nombre_la}` : ""}</span>
                {esDocente && !a.visible && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">Oculto</span>}
                <div className="flex-1" />
                {puedeEditar && !seleccionando && (
                  <div className="flex items-center gap-1">
                    <button disabled={trabajando} onClick={() => mover(a, -1)} title="Subir" className="text-xs text-slate-400 hover:text-slate-700 px-1">↑</button>
                    <button disabled={trabajando} onClick={() => mover(a, 1)} title="Bajar" className="text-xs text-slate-400 hover:text-slate-700 px-1">↓</button>
                    <button onClick={() => setEditando(a)} title="Modificar" className="text-sm px-1">✏️</button>
                    <button onClick={() => eliminar([a.id])} title="Eliminar" className="text-sm px-1">🗑</button>
                  </div>
                )}
              </div>
              {a.descripcion && <p className="text-xs text-slate-600 mb-3">{a.descripcion}</p>}
              <div className="grid grid-cols-2 gap-3 max-w-md">
                {[["imagen_el", a.nombre_el], ["imagen_la", a.nombre_la]].filter(([c]) => a[c]).map(([c, nombre]) => (
                  <button key={c} onClick={() => setAbierto({ src: a[c], nombre: nombre || a.nombre_el })} className="group text-left" aria-label={nombre}>
                    <img src={a[c]} alt={`${nombre || ""}${a.rol ? " — " + a.rol : ""}`} loading="lazy" className="w-full h-auto rounded-xl shadow-md transition-transform group-hover:-translate-y-1 group-hover:shadow-xl" />
                  </button>
                ))}
                {!a.imagen_el && !a.imagen_la && <p className="text-xs text-slate-400 col-span-2">Sin imágenes todavía.</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      </>)}

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(10,16,35,0.85)" }} onClick={() => setAbierto(null)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-full flex flex-col items-center">
            <img src={abierto.src} alt={abierto.nombre} className="max-h-[78vh] w-auto rounded-2xl shadow-2xl" />
            <div className="mt-3 flex items-center gap-2">
              <a href={abierto.src} download target="_blank" rel="noreferrer" className="text-xs font-semibold px-3 py-2 rounded-full bg-white text-slate-700">⬇️ Descargar</a>
              <button onClick={() => setAbierto(null)} className="text-xs font-semibold px-3 py-2 rounded-full bg-[#B8892B] text-white">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {editando && <FormAvatar avatar={editando.id ? editando : null} roles={roles} siguienteOrden={siguienteOrden} onClose={() => setEditando(null)} onGuardado={() => { setEditando(null); cargar(); }} />}
    </div>
  );
}

export default SalaAvatares;
