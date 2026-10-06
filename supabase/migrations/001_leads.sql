-- 001: companies, people, leads, mockups, events. Run by hand in the Supabase SQL editor.

create extension if not exists pgcrypto;

create type lead_status as enum (
  'new', 'reviewed', 'approved', 'sent', 'replied', 'quoted', 'won', 'lost', 'suppressed'
);
create type logo_grade as enum ('usable', 'needs_cleanup', 'not_pvc');
create type campaign_kind as enum ('warm', 'cold', 'asapparel');

create table companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  website text,
  phone text,
  address text,
  city text,
  industry text,
  employee_count int,
  google_place_id text unique,
  apollo_org_id text,
  logo_path text,            -- path in the logos bucket, cleaned PNG with transparency
  logo_source_url text,
  logo_grade logo_grade,
  logo_notes text,
  is_existing_customer boolean not null default false,  -- came from Printavo, goes warm
  created_at timestamptz not null default now()
);

create table people (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  first_name text,
  last_name text,
  title text,
  email text not null,
  email_verified boolean not null default false,
  email_verified_at timestamptz,
  apollo_person_id text,
  created_at timestamptz not null default now(),
  unique (company_id, email)
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  campaign campaign_kind not null default 'cold',
  status lead_status not null default 'new',
  ab_arm text,               -- 'image' or 'link', cold only
  instantly_lead_id text,
  page_token text not null unique default encode(gen_random_bytes(12), 'hex'),
  reviewed_by text,
  reviewed_at timestamptz,
  sent_at timestamptz,
  last_reply_at timestamptz,
  reply_class text,          -- interested, not_now, no, unsubscribe
  quoted_tier int,           -- 25, 50, 100
  quoted_colorway text,
  shopify_draft_order_id text,
  won_at timestamptz,
  lost_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_open_lead_per_person on leads (person_id)
  where status not in ('won', 'lost', 'suppressed');

create table mockups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  kind text not null,        -- hero, graphite, white, house_patch, options_grid
  colorway text,
  storage_path text not null,
  public_url text not null,
  created_at timestamptz not null default now()
);

create table suppressions (
  email text primary key,
  reason text not null,      -- unsubscribe, stop, bounce, complaint, customer
  source text,               -- instantly, manual, shopify
  created_at timestamptz not null default now()
);

create table lead_events (
  id bigserial primary key,
  lead_id uuid not null references leads(id) on delete cascade,
  kind text not null,        -- created, reviewed, approved, pushed, sent, opened, replied, quoted, won, lost, suppressed
  detail jsonb,
  actor text,
  created_at timestamptz not null default now()
);

create table quote_requests (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  company_id uuid not null references companies(id) on delete cascade,
  quantity int not null,
  colorway text,
  house_patch text,
  name text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger leads_touch before update on leads for each row execute function touch_updated_at();

-- Storage: two buckets, created in the dashboard. `logos` private, `mockups` public.
