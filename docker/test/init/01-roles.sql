-- PostgREST + migration GRANTs expect Supabase-style role names.
create extension if not exists vector;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$roles$;

do $auth$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login password 'postgres' noinherit;
  end if;
end
$auth$;

grant anon to authenticator;
grant authenticated to authenticator;
grant service_role to authenticator;

grant usage on schema public to anon, authenticated, service_role;
