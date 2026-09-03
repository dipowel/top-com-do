-- ============================================================================
--  Top.com.do · Blindaje de seguridad Supabase (Security Advisor)
--  Pegar COMPLETO en: Supabase Dashboard -> SQL Editor -> Run
--
--  Contexto: la app (Express + Firebase Auth) se conecta como el rol `postgres`
--  (dueño de las tablas, BYPASSRLS) y NUNCA usa la API REST de Supabase.
--  => Este script NO afecta a la app. Solo cierra la API REST autogenerada
--     (PostgREST) para los roles `anon` y `authenticated`.
--  Idempotente: se puede volver a ejecutar sin problema.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) Activar Row Level Security en las 16 tablas señaladas por el Advisor.
--    Sin políticas => deny-by-default para anon/authenticated vía PostgREST.
--    El rol `postgres` (la app) las sigue leyendo/escribiendo: es el dueño.
-- ---------------------------------------------------------------------------
alter table public.users               enable row level security;
alter table public.profiles            enable row level security;
alter table public.categories          enable row level security;
alter table public.rounds              enable row level security;
alter table public.bids                enable row level security;
alter table public.favorites           enable row level security;
alter table public.notifications       enable row level security;
alter table public.reviews             enable row level security;
alter table public.referrals           enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.rank_leaders        enable row level security;
alter table public.audit_log           enable row level security;
alter table public.dodo_payments       enable row level security;
alter table public.payment_receipts    enable row level security;
alter table public.paypal_orders       enable row level security;
alter table public.bank_accounts       enable row level security;

-- ---------------------------------------------------------------------------
-- 2) Barrido de seguridad: activar RLS en CUALQUIER otra tabla de `public`
--    que se haya quedado fuera de la lista (evita alertas residuales).
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select format('%I.%I', schemaname, tablename) as tbl
    from pg_tables
    where schemaname = 'public'
  loop
    execute 'alter table ' || r.tbl || ' enable row level security';
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Doble candado: revocar TODO privilegio de tabla a los roles públicos
--    de la API. (Supabase concede grants por defecto a anon/authenticated.)
--    `service_role` y `postgres` conservan sus privilegios.
-- ---------------------------------------------------------------------------
revoke all privileges on all tables    in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;
revoke all privileges on all functions in schema public from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Que las tablas/objetos que se creen en el FUTURO tampoco queden
--    expuestos automáticamente por la API REST.
--    (Si algún día quieres exponer una tabla nueva, deberás concederle
--     grants y políticas de forma explícita.)
-- ---------------------------------------------------------------------------
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

commit;

-- ============================================================================
--  VERIFICACIÓN (ejecutar después; deben cumplirse las 2)
-- ============================================================================

-- 4.1) Todas las tablas de public con rowsecurity = true
select relname as tabla,
       relrowsecurity  as rls_activado,
       relforcerowsecurity as rls_forzado
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;

-- 4.2) anon / authenticated NO deben devolver ninguna fila aquí
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
order by table_name, grantee;

-- ============================================================================
--  DIAGNÓSTICO de las alertas que NO son "RLS Disabled" (por si quedan 1-2)
--  Copia el resultado y compártelo para tratarlas caso por caso.
-- ============================================================================

-- Vistas en public (pueden disparar "security definer view" / "exposed auth users")
select table_name
from information_schema.views
where table_schema = 'public';

-- Funciones con search_path mutable (alerta "function_search_path_mutable")
select p.proname, p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and not exists (
    select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'
  );

-- Extensiones instaladas en public (alerta "extension_in_public")
select extname from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
where n.nspname = 'public';
