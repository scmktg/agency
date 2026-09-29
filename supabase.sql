-- Run this once in the Supabase SQL editor.

create extension if not exists pgcrypto;

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

alter table public.clients enable row level security;

-- The browser never reads this table directly.
-- All client/admin reads are performed by authenticated Vercel API routes
-- using the service-role key after validating the Supabase user session.
