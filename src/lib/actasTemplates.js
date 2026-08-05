// Textos preconfigurados reutilizados por el formulario manual de actas (Actas.jsx)
// y por la generación automática de actas de nivelación (api.js).

export const FALTAS_MANUAL = {
  leve: {
    tipo: "Leve", articulo: "Art. 68", plazoDias: 5,
    implicaciones: "Falta leve (Art. 68). Se registra en el observador del estudiante y no requiere remisión a instancias externas. Ante reincidencia (tres o más faltas leves), el caso se reclasifica como falta grave según el Manual de Convivencia.",
  },
  grave: {
    tipo: "Grave", articulo: "Art. 69", plazoDias: 10,
    implicaciones: "Falta grave (Art. 69). Requiere citación al acudiente, firma de compromiso escrito y puede implicar suspensión de actividades extracurriculares o representación institucional, según lo defina el Comité Escolar de Convivencia. La reincidencia puede derivar en falta gravísima.",
  },
  gravisima: {
    tipo: "Gravísima", articulo: "Art. 70", plazoDias: 15,
    implicaciones: "Falta gravísima (Art. 70). Debe remitirse de inmediato al Comité Escolar de Convivencia y activar la Ruta de Atención Integral (Ley 1620 de 2013 y su Decreto reglamentario 1965 de 2013). Según el caso, implica reporte a la Comisaría de Familia, el ICBF o la Policía de Infancia y Adolescencia, y puede conllevar suspensión temporal o cancelación de matrícula conforme al Manual de Convivencia.",
  },
};

export const NIVELACION_COMPROMISOS_DEFAULT =
  "1. Presentar un plan de recuperación con el docente de la asignatura dentro de los 5 días hábiles siguientes a la firma del acta.\n" +
  "2. Asistir puntualmente a las sesiones de refuerzo académico programadas.\n" +
  "3. Entregar en las fechas acordadas los talleres, trabajos o actividades pendientes del periodo.\n" +
  "4. Sustentar ante el docente los temas no alcanzados antes del cierre del proceso de nivelación.\n" +
  "5. El incumplimiento de estos compromisos será reportado al Consejo Académico para el seguimiento correspondiente.";
