// Prompt de IA de fábrica para generar Guías de Estudio con la estructura que CÓDICE importa tal cual
// (botón "📋 Pegar desde IA"). El modelo de formato del final se prueba con el mismo importador.

export const MODELO_FORMATO_GUIA = [
  "GUÍA DE ESTUDIO PEDAGÓGICA",
  "Título de la guía: subtítulo opcional",
  "Presentación de 2 o 3 oraciones: para quién es la guía, qué trabajo se hace y cómo se integra.",
  "",
  "1. DATOS DE IDENTIFICACIÓN",
  "Campo\tInformación",
  "Institución\t[nombre]",
  "Asignatura\t[asignatura o áreas]",
  "Docentes responsables\t[nombres]",
  "Orientaciones para el estudiante",
  "- [Una indicación breve por viñeta]",
  "",
  "2. METAS DE APRENDIZAJE Y COMPETENCIAS",
  "A. Propósito general",
  "[1 o 2 oraciones]",
  "B. Desempeños o aprendizajes esperados",
  "Al finalizar la guía, el estudiante estará en capacidad de:",
  "1. [Verbo de acción + contenido + contexto]",
  "C. Criterios de evaluación",
  "Criterio\tEvidencia observable",
  "[Criterio]\t[Evidencia]",
  "",
  "3. FUNDAMENTACIÓN TEÓRICA Y CONCEPTOS CLAVE",
  "3.1. Matemáticas: [título del tema]",
  "[Párrafos cortos, viñetas y ejemplos]",
  "Subtítulo corto sin punto final",
  "\\[",
  "A = largo × ancho",
  "\\]",
  "3.2. Ciencias Naturales — Biología: [título del tema]",
  "[Contenido]",
  "3.3. Conceptos clave",
  "Concepto\tDefinición sintética\tRelación con el tema",
  "[Concepto]\t[Definición]\t[Relación]",
  "",
  "4. SECUENCIA DE ACTIVIDADES Y PRÁCTICA GUIADA",
  "A. Fase de exploración y comprensión",
  "[Lectura inicial y preguntas para conectar con saberes previos]",
  "B. Fase de aplicación y análisis",
  "[Instrucción general]",
  "Actividad 1. Matemáticas: [título de la actividad]",
  "Situación",
  "[Contexto, caso o texto que da sentido a la actividad]",
  "Punto 1. [Título del punto]",
  "a. [Pregunta o ejercicio]",
  "b. [Pregunta o ejercicio]",
  "Punto 2. [Título del punto]",
  "Completa el siguiente cuadro:",
  "Aspecto\tColumna A\tColumna B",
  "[Fila 1]\t\t",
  "Evidencia que debes entregar: [qué debe presentar el estudiante]",
  "C. Fase de transferencia y creación",
  "Producto final: [nombre]",
  "[Consigna del producto integrador]",
  "",
  "5. RECURSOS DE APOYO Y MATERIAL COMPLEMENTARIO",
  "A. Lecturas principales",
  "Área\tRecurso sugerido\tUtilidad",
  "[Área]\t[Recurso]\t[Para qué sirve]",
  "B. Material multimedia y enlaces",
  "1. [Tipo de recurso y qué buscar, sin inventar enlaces]",
  "C. Herramientas sugeridas",
  "Herramienta\tUso en la guía",
  "[Herramienta]\t[Uso]",
  "",
  "6. RÚBRICA DE AUTOEVALUACIÓN Y METACOGNICIÓN",
  "A. Rúbrica de autoevaluación",
  "Antes de entregar, marca una opción para cada criterio.",
  "Criterio de desempeño\tLogrado\tEn proceso\tPor mejorar",
  "[Criterio]\t☐\t☐\t☐",
  "B. Preguntas de reflexión final",
  "Responde con sinceridad en 4 a 6 líneas por pregunta.",
  "1. [Pregunta de reflexión]",
  "2. [Pregunta de reflexión]",
].join("\n");

export const PROMPT_IA_GUIAS_NUEVO = `Actúa como un diseñador instruccional experto en educación básica y media.
Vas a crear una GUÍA DE ESTUDIO PEDAGÓGICA completa y lista para imprimir, con
la estructura exacta de 6 secciones del MODELO DE FORMATO que aparece al final.
Es importante respetar los títulos y la numeración tal cual, porque el texto se
importa automáticamente a CÓDICE y se separa en secciones, temas por área,
actividades, puntos y evidencias.

DATOS DE ENTRADA
- Institución: [nombre de la institución]
- Asignatura o áreas integradas: [una materia, o varias si la guía es interdisciplinaria]
- Título de la unidad / tema: [tema central]
- Nivel / grado / población: [grado o ciclo]
- Docentes responsables: [nombres]
- Fecha: [dd de mes de aaaa]
- Modalidad: [trabajo individual / en parejas / de nivelación / refuerzo…]
- Contexto o situación que une la guía (opcional): [ej: una salida pedagógica, un proyecto, una lectura]
- Nivel de profundidad: [introductorio / intermedio / avanzado]
- Enfoque o énfasis particular (opcional): [ej: pensamiento crítico, resolución de problemas…]

CÓMO ARMAR LA GUÍA
- Sección 3: un tema por cada área o subtema ("3.1. Área: título del tema"). Dentro de
  cada tema usa párrafos cortos, viñetas, ejemplos y fórmulas. Termina con
  "Conceptos clave" como una tabla de 4 a 8 filas (concepto, definición, relación con el tema).
- Sección 4, fase de aplicación: una ACTIVIDAD por cada área (o 3 a 5 si la guía es de
  una sola materia). Cada actividad lleva: nombre del área y título; una situación,
  caso, texto o lectura que da contexto; de 2 a 4 PUNTOS con enunciados completos
  (preguntas, ejercicios, cuadros para completar con celdas vacías); y al final la
  línea "Evidencia que debes entregar:". Los ejercicios deben venir ya desarrollados
  y listos para resolver, sin pasos adicionales de tu parte.
- Sección 4, fase de transferencia: un producto final que integre los aprendizajes.
- Sección 6: de 3 a 5 criterios de autoevaluación que reflejen lo pedido en la sección 2
  y 2 preguntas de reflexión final.

REGLAS DE FORMATO (muy importantes)
- Responde SOLO con la guía, sin saludos ni comentarios antes o después, y sin bloques de código.
- Escribe las tablas con una fila por línea y las columnas separadas por TABULADOR
  (también sirve el formato de tabla con barras |). La primera fila es el encabezado.
- Las listas van con "- " (viñetas) o con "1." (numeradas); las sub-preguntas con "a.", "b.", "c.".
- Escribe cada fórmula en su propia línea, entre \\[ y \\], en texto plano
  (ej: A = largo × ancho), sin comandos de LaTeX.
- Los precios y cifras se escriben normales ($95.000); no uses signos $ para fórmulas.
- Usa el nombre del área antes de los dos puntos en "3.n." y en "Actividad n." (ej: "Actividad 2. Español: publicidad y argumentación").
- No inventes datos verificables (cifras, límites geográficos, citas, enlaces). Si hace falta
  un dato externo, pide al estudiante consultarlo en una fuente confiable y registrarla.
- Todo el contenido debe ser específico al tema, con lenguaje claro y adecuado al grado;
  sin relleno ni frases genéricas reciclables.

MODELO DE FORMATO (reemplaza lo que está entre corchetes y repite los bloques que hagan falta):

${MODELO_FORMATO_GUIA}`;
