import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { aplicarBono } from "../lib/bono";

// Portal del estudiante: cuánto bono de participación lleva en un periodo en curso.
export default function BonoEnCurso({ materiaId, periodo, estudianteId, nota }) {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    let vivo = true;
    if (materiaId == null) return () => { vivo = false; };
    api.fetchBonosPlanilla(materiaId, periodo, [{ id: estudianteId }])
      .then((b) => { if (vivo) setInfo(b); }).catch(() => {});
    return () => { vivo = false; };
  }, [materiaId, periodo, estudianteId]);

  if (!info?.cfg || info.cfg.activo === false) return null;
  const bono = info.bonos?.[estudianteId] || 0;
  const conBono = aplicarBono(nota, bono, 5);
  return (
    <div className="mt-2 text-[11px] rounded-lg border border-violet-200 bg-violet-50 text-violet-700 p-2">
      ⭐ Bono de participación: llevas <b>+{bono}</b> de <b>+{info.cfg.bono_max}</b> posibles. Se suma a tu nota final del periodo
      {nota !== null && nota !== undefined && bono > 0 ? <> (hoy quedarías en <b>{conBono}</b>)</> : null}.
    </div>
  );
}
