# CÓDICE — versión web real (Supabase)

Este es el punto de partida para que CÓDICE viva en internet, con una base de
datos de verdad, sin depender de Claude. Ya funciona de punta a punta: login
real de docentes, un listado de estudiantes compartido, y un ejemplo de
gamificación — todo guardado en tu propia base de datos.

## Paso 1 — Crear tu proyecto de Supabase (gratis)

1. Ve a https://supabase.com y crea una cuenta (con GitHub o correo).
2. Crea un **New project**. Elige una contraseña para la base de datos y
   guárdala en un lugar seguro (no la necesitarás para esto, pero por si
   acaso).
3. Espera 1-2 minutos a que el proyecto termine de crearse.

## Paso 2 — Crear las tablas

1. En el menú de la izquierda, entra a **SQL Editor**.
2. Abre el archivo `sql/schema.sql` de esta carpeta, copia **todo** su
   contenido, y pégalo en el editor de Supabase.
3. Dale clic a **Run**. Deberías ver "Success" — ya tienes las ~20 tablas
   creadas con sus reglas de seguridad.

## Paso 3 — Activar el registro por correo (si quieres confirmación)

Por defecto Supabase pide confirmar el correo al crear una cuenta. Si estás
probando y quieres que sea inmediato:

- Ve a **Authentication → Providers → Email** y desactiva
  "Confirm email" mientras pruebas (puedes reactivarlo después).

## Paso 4 — Conectar el proyecto a tu Supabase

1. En Supabase, ve a **Project Settings → API**.
2. Copia el **Project URL** y la clave **anon public**.
3. En esta carpeta, copia `.env.example` a un archivo nuevo llamado `.env`
   y pega ahí esos dos valores:

   ```
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-larga-aqui
   ```

## Paso 5 — Instalar y correr en tu computador

Necesitas tener [Node.js](https://nodejs.org) instalado (cualquier versión
reciente). Luego, en esta carpeta:

```bash
npm install
npm run dev
```

Abre la URL que te muestra la terminal (normalmente `http://localhost:5173`).
Crea tu primera cuenta de docente, agrega un estudiante, dale +10 XP, y
revisa en Supabase (**Table Editor**) que aparezca guardado de verdad.

## Paso 6 — Publicarlo en internet (gratis)

La forma más simple es [Vercel](https://vercel.com):

1. Sube esta carpeta a un repositorio de GitHub.
2. En Vercel, "Add New Project" → importa ese repositorio.
3. En "Environment Variables", agrega las mismas dos variables del `.env`.
4. Deploy. En 1-2 minutos tienes una URL pública real (algo como
   `codice-tu-nombre.vercel.app`) que funciona sin pasar por Claude.

## ¿Qué sigue?

`src/App.jsx` de este proyecto es solo el **punto de partida** — demuestra
que login, lectura y escritura ya funcionan de verdad. El prototipo completo
(gamificación con íconos, ruleta, temporizador, asistencia con
observaciones, planilla de notas con materias independientes por docente,
boletín, nivelación, estadísticas, actas con sustento, roles, reportes) vive
en el archivo `.jsx` que hemos construido en la conversación con Claude.

El trabajo que sigue es traer cada pantalla de ese archivo a este proyecto,
cambiando cada llamada a `window.storage.get(...)` / `window.storage.set(...)`
por una consulta equivalente a `supabase.from("tabla").select(...)` /
`.insert(...)` / `.upsert(...)`. La tabla de abajo es el mapa exacto de qué
clave de guardado corresponde a qué tabla de la base de datos, para hacerlo
ordenadamente, módulo por módulo:

| Dato en el prototipo de Claude   | Tabla en Supabase                          |
|-----------------------------------|---------------------------------------------|
| Progreso (XP, vida, monedas)      | `progreso` + `historial_gamificacion`      |
| Equipos / reinos                  | `estudiantes.reino_actual`                 |
| Actas                             | `actas`                                     |
| Grados y grupos personalizados    | `grados`, `estudiantes.grado_id`           |
| Estudiantes agregados/quitados    | `estudiantes` (`activo = false` al quitar) |
| Institución                       | `institucion`                               |
| Condicionantes de gamificación    | `condicionantes`                            |
| Asistencia                        | `asistencia`                                |
| Roles de clase                    | `roles_clase`, `roles_asignados`           |
| Datos del estudiante / acudientes | `estudiantes`, `acudientes`                 |
| Materias del docente              | `materias` (con `docente_id`)              |
| Categorías / actividades / notas  | `notas_categorias`, `notas_actividades`, `notas_valores` |
| Escala y periodos                 | `notas_config`                              |
| Boletín (notas cerradas)          | `notas_finales_periodo`                     |
| Nivelación                        | `nivelacion`                                |
| Perfil y contraseña del docente   | Supabase Auth + tabla `profesores`         |

Podemos ir trayendo estas pantallas una por una, en el orden que prefieras
(sugerencia: primero estudiantes y gamificación, porque son la base de todo
lo demás).
