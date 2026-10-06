-- MUNDO CÓDICE: las misiones del mundo virtual y el registro de cuáles completó cada estudiante.
-- Las 5 misiones de ejemplo quedan cargadas (de valores y de cuentas); se pueden editar, ocultar
-- (activo = false) o agregar más desde el editor de tablas de Supabase.

create table if not exists mundo_misiones (
  id serial primary key,
  docente_id uuid,
  lugar text not null default 'plaza',      -- dónde está: 'biblioteca' | 'agora' | 'templo' | 'mercado' | 'plaza'
  npc_nombre text not null default 'Aldeano', -- el personaje que da la misión
  npc_emoji text,
  npc_sprite text,                          -- opcional: qué personaje es (ej: 'cronista_femenino'); si se deja vacío, se elige uno
  titulo text not null,
  texto text not null,                      -- lo que pregunta o plantea
  opciones jsonb not null default '[]'::jsonb, -- las respuestas posibles, ej: ["Una", "Otra", "Otra más"]
  correcta integer not null default 0,      -- cuál es la correcta: 0 es la primera, 1 la segunda…
  pista text,                               -- se muestra si se equivocan
  retro text,                               -- se muestra al acertar
  xp integer not null default 0,
  oro integer not null default 0,
  orden integer not null default 0,
  activo boolean not null default true,
  creado_en timestamptz default now()
);

create table if not exists mundo_misiones_hechas (
  id serial primary key,
  estudiante_id integer not null,
  mision_id integer not null references mundo_misiones(id) on delete cascade,
  hecha_en timestamptz default now(),
  unique (estudiante_id, mision_id)          -- cada misión se completa una sola vez por estudiante
);
create index if not exists idx_mundo_hechas_est on mundo_misiones_hechas(estudiante_id);

-- Seguridad: los estudiantes entran con un código (sin sesión real de Supabase), así que leer y
-- registrar tiene que estar abierto, igual que el resto de las tablas del juego. Editar las misiones
-- es solo de docentes. (Endurecer esto queda para el trabajo de RLS de toda la app.)
alter table mundo_misiones enable row level security;
alter table mundo_misiones_hechas enable row level security;
drop policy if exists "leer misiones del mundo" on mundo_misiones;
create policy "leer misiones del mundo" on mundo_misiones for select using (true);
drop policy if exists "docentes editan misiones del mundo" on mundo_misiones;
create policy "docentes editan misiones del mundo" on mundo_misiones for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "leer misiones hechas" on mundo_misiones_hechas;
create policy "leer misiones hechas" on mundo_misiones_hechas for select using (true);
drop policy if exists "registrar misiones hechas" on mundo_misiones_hechas;
create policy "registrar misiones hechas" on mundo_misiones_hechas for insert with check (true);
drop policy if exists "deshacer registro si falla el premio" on mundo_misiones_hechas;
create policy "deshacer registro si falla el premio" on mundo_misiones_hechas for delete using (true);

-- Las 5 misiones de ejemplo (solo si todavía no hay ninguna)
insert into mundo_misiones (lugar, npc_nombre, titulo, texto, opciones, correcta, pista, retro, xp, oro, orden)
select * from (values
  ('biblioteca', 'La bibliotecaria', 'La regla de oro',
   'Muchas tradiciones comparten una idea: tratar a los demás como querríamos que nos traten. ¿Cuál de estas acciones la practica?',
   '["Burlarme del compañero que se equivocó", "Ayudar al compañero que no entendió el tema", "Copiarme de otro y no decir nada"]'::jsonb, 1,
   'Piensa: ¿cómo te gustaría que te trataran si fueras tú el que no entendió?', '¡Exacto! Ayudar a otros es poner en práctica la regla de oro.', 20, 5, 1),
  ('agora', 'El guardián del Ágora', 'El dilema del patio',
   'En el descanso ves que un compañero nuevo está comiendo solo, sin nadie con quien hablar. ¿Qué haces?',
   '["Lo invito a sentarse con mi grupo", "Hago como que no lo vi", "Les cuento a todos que está solo"]'::jsonb, 0,
   'Un gesto pequeño puede cambiarle el día a alguien.', '¡Muy bien! La empatía empieza con un gesto sencillo.', 20, 5, 2),
  ('templo', 'La guía del Templo', 'La fuente de la gratitud',
   'Hoy hablamos de gratitud. ¿Cuál de estas frases la expresa mejor?',
   '["Gracias por ayudarme con la tarea, me sirvió mucho", "Siempre quiero más de lo que tengo", "No me debían nada, así que no hay nada que agradecer"]'::jsonb, 0,
   'Gratitud es reconocer lo que otros hacen por ti.', '¡Así es! Agradecer fortalece los vínculos.', 15, 5, 3),
  ('mercado', 'El mercader', 'Las cuentas del Códice',
   'En la tienda de piezas, una Capa cuesta 40 monedas y tú tienes 28. ¿Cuántas monedas te faltan para comprarla?',
   '["18", "12", "8"]'::jsonb, 1,
   'Resta: 40 − 28.', '¡Correcto! Te faltan 12 monedas.', 15, 10, 4),
  ('plaza', 'El sabio de la fuente', 'El acertijo del sabio',
   '«Entre más lo compartes, más grande se hace. ¿Qué es?»',
   '["Una moneda", "El conocimiento", "Un pastel"]'::jsonb, 1,
   'Si lo enseñas, tú también lo sigues teniendo.', '¡Sabia respuesta! El conocimiento crece al compartirlo.', 20, 5, 5)
) as v(lugar, npc_nombre, titulo, texto, opciones, correcta, pista, retro, xp, oro, orden)
where not exists (select 1 from mundo_misiones);

notify pgrst, 'reload schema';
