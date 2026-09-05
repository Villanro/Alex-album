-- Ejecuta esto una vez en el SQL Editor de tu proyecto de Supabase.
-- Réplica de las figuritas de cada usuario. El navegador es la fuente de verdad;
-- esta tabla es sólo la copia de servidor para sincronizar entre dispositivos.

create table stickers (
  user_id    uuid references auth.users on delete cascade,
  team       text not null,
  num        smallint not null,
  count      smallint not null default 0,
  first_at   timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, team, num)
);

alter table stickers enable row level security;

-- Cada usuario sólo puede leer y escribir sus propias filas. Sin políticas públicas.
create policy "select_own_stickers" on stickers
  for select using (auth.uid() = user_id);

create policy "insert_own_stickers" on stickers
  for insert with check (auth.uid() = user_id);

create policy "update_own_stickers" on stickers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "delete_own_stickers" on stickers
  for delete using (auth.uid() = user_id);

-- Nota: la app nunca borra filas, ni siquiera cuando una figurita vuelve a 0
-- (guarda count = 0 con su updated_at). La política de delete existe por si
-- algún día quieres limpiar datos manualmente, pero el cliente no la usa.
