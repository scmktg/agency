-- Applied to the 458 Supabase project.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  email text not null unique,
  google_ads_customer_id text,
  meta_ad_account_id text,
  commission_rate numeric(7,2),
  reporting_note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.clients enable row level security;

create policy "admins_can_read_self"
on public.admin_users
for select
to authenticated
using (lower(email) = lower(auth.jwt()->>'email'));

create policy "clients_can_read_own_or_admin"
on public.clients
for select
to authenticated
using (
  lower(email) = lower(auth.jwt()->>'email')
  or exists (
    select 1 from public.admin_users a
    where lower(a.email) = lower(auth.jwt()->>'email')
  )
);

create policy "admins_can_insert_clients"
on public.clients
for insert
to authenticated
with check (
  exists (
    select 1 from public.admin_users a
    where lower(a.email) = lower(auth.jwt()->>'email')
  )
);

create policy "admins_can_update_clients"
on public.clients
for update
to authenticated
using (
  exists (
    select 1 from public.admin_users a
    where lower(a.email) = lower(auth.jwt()->>'email')
  )
)
with check (
  exists (
    select 1 from public.admin_users a
    where lower(a.email) = lower(auth.jwt()->>'email')
  )
);

create policy "admins_can_delete_clients"
on public.clients
for delete
to authenticated
using (
  exists (
    select 1 from public.admin_users a
    where lower(a.email) = lower(auth.jwt()->>'email')
  )
);
