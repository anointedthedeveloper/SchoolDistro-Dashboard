-- ============================================================
-- SchoolDistro Admin — Run this in Supabase SQL Editor
-- Safe to run multiple times (fully idempotent)
-- ============================================================

-- ── 1. PLANS TABLE ──────────────────────────────────────────
create table if not exists plans (
    id            uuid primary key default gen_random_uuid(),
    name          text not null unique,
    label         text not null,
    price         numeric(12,2) not null default 0,
    duration_days integer not null default 3,
    max_users     integer not null default 3,
    is_active     boolean not null default true,
    created_at    timestamptz default now()
);

insert into plans (name, label, price, duration_days, max_users) values
    ('trial',    'Trial',    0,       3,   1),
    ('basic',    'Basic',    50000,   365, 3),
    ('standard', 'Standard', 100000,  365, 10),
    ('premium',  'Premium',  200000,  365, -1)
on conflict (name) do nothing;

-- ── 2. ALTER SCHOOLS TABLE ───────────────────────────────────
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name='schools' and column_name='plan_id') then
        alter table schools add column plan_id uuid references plans(id);
    end if;
    if not exists (select 1 from information_schema.columns where table_name='schools' and column_name='email') then
        alter table schools add column email text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name='schools' and column_name='plan') then
        alter table schools add column plan text default 'trial';
    end if;
    if not exists (select 1 from information_schema.columns where table_name='schools' and column_name='start_date') then
        alter table schools add column start_date date default current_date;
    end if;
    if not exists (select 1 from information_schema.columns where table_name='schools' and column_name='max_users') then
        alter table schools add column max_users integer default 1;
    end if;
end $$;

-- Normalize any existing status values that are outside the new allowed set
-- before adding the constraint (prevents constraint violation on existing rows)
update schools set subscription_status = 'active'    where subscription_status = 'inactive';
update schools set subscription_status = 'trial'     where subscription_status is null;
update schools set subscription_status = 'suspended' where subscription_status not in ('trial','active','expired','suspended');

-- Now safely add the constraint
alter table schools drop constraint if exists schools_subscription_status_check;
alter table schools add constraint schools_subscription_status_check
    check (subscription_status in ('trial', 'active', 'expired', 'suspended'));

-- ── 3. PAYMENTS TABLE ───────────────────────────────────────
create table if not exists payments (
    id          uuid primary key default gen_random_uuid(),
    school_id   uuid not null references schools(id) on delete cascade,
    plan_id     uuid references plans(id),
    amount      numeric(12,2) not null,
    status      text not null default 'paid' check (status in ('paid', 'unpaid', 'refunded')),
    note        text,
    paid_at     timestamptz default now(),
    created_at  timestamptz default now()
);

-- ── 4. AUDIT LOGS TABLE ─────────────────────────────────────
create table if not exists audit_logs (
    id          uuid primary key default gen_random_uuid(),
    action      text not null,
    description text,
    school_name text,
    actor       text,
    created_at  timestamptz default now()
);

-- ── 5. SETTINGS TABLE ───────────────────────────────────────
create table if not exists settings (
    id               integer primary key default 1,
    currency         text default '₦',
    receipt_prefix   text default 'RCP',
    maintenance_mode boolean default false
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- ── 6. USERS TABLE ──────────────────────────────────────────
create table if not exists users (
    id          uuid primary key default gen_random_uuid(),
    school_id   uuid references schools(id) on delete cascade,
    email       text,
    name        text,
    role        text default 'user',
    is_active   boolean default true,
    created_at  timestamptz default now()
);

-- ── 7. DISABLE RLS on admin tables so anon key can read ─────
-- The admin dashboard uses the anon key. These tables are
-- admin-only so RLS can be disabled, OR you can use service role.
alter table plans      disable row level security;
alter table payments   disable row level security;
alter table audit_logs disable row level security;
alter table settings   disable row level security;
alter table users      disable row level security;

-- Also ensure schools and receipts are accessible
-- (they likely already have RLS policies, but if not:)
-- alter table schools  disable row level security;
-- alter table receipts disable row level security;

-- ── 8. REFRESH schema cache ─────────────────────────────────
-- Supabase PostgREST caches the schema. After running this,
-- go to: Supabase Dashboard → API → click "Reload schema"
-- OR wait ~30 seconds for auto-refresh.

select 'Migration complete. Tables created: plans, payments, audit_logs, settings, users' as status;
