-- Ejecuta esto una vez en el SQL Editor de tu proyecto de Supabase.
-- Réplica de las figuritas de cada usuario. El navegador es la fuente de verdad;
-- esta tabla es sólo la copia de servidor para sincronizar entre dispositivos.
--
-- Sin login ni email: cada dispositivo genera un "código de sincronización"
-- aleatorio la primera vez (ver js/sync.js) y lo manda en la cabecera HTTP
-- x-sync-code en cada petición. Para vincular dos dispositivos, se copia el
-- código de uno y se pega en el otro. La política RLS sólo deja tocar las
-- filas cuyo sync_code coincide con esa cabecera — sin la cabecera correcta,
-- no se puede leer ni escribir nada.

create table stickers (
  sync_code  text not null,
  team       text not null,
  num        smallint not null,
  count      smallint not null default 0,
  first_at   timestamptz,
  updated_at timestamptz not null default now(),
  primary key (sync_code, team, num)
);

alter table stickers enable row level security;

create policy "access_via_sync_code" on stickers
  for all
  using (sync_code = current_setting('request.headers', true)::json->>'x-sync-code')
  with check (sync_code = current_setting('request.headers', true)::json->>'x-sync-code');

-- Nota: la app nunca borra filas, ni siquiera cuando una figurita vuelve a 0
-- (guarda count = 0 con su updated_at). Los ceros son información para el
-- algoritmo de fusión (evitan que un dispositivo "resucite" una figurita que
-- otro ya vació).
