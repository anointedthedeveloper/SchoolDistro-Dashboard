-- ============================================================
-- SchoolDistro — Users & License Activation Tables
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. school_users — staff accounts per school ─────────────
-- Drop and recreate cleanly (rename from 'users' if it exists)
do $$
begin
    -- rename if old 'users' table still exists
    if exists (select 1 from information_schema.tables where table_name = 'users' and table_schema = 'public') then
        alter table users rename to school_users;
    end if;
end $$;

create table if not exists school_users (
    id            uuid primary key default gen_random_uuid(),
    school_id     uuid not null references schools(id) on delete cascade,
    name          text not null,
    username      text not null unique,
    password_hash text not null,          -- hashed by admin dashboard, verified by desktop app
    role          text not null default 'staff' check (role in ('ceo', 'staff')),
    is_active     boolean not null default true,
    created_at    timestamptz default now()
);

alter table school_users disable row level security;
grant select, insert, update, delete on school_users to anon, authenticated;

-- ── 2. license_activations — device activation tracking ─────
create table if not exists license_activations (
    id           uuid primary key default gen_random_uuid(),
    school_id    uuid not null references schools(id) on delete cascade,
    license_key  text not null,
    device_id    text not null,           -- unique hardware/install ID from desktop app
    activated_at timestamptz default now(),
    last_seen    timestamptz default now(),
    is_active    boolean not null default true,
    unique (school_id, device_id)         -- one activation per device per school
);

alter table license_activations disable row level security;
grant select, insert, update, delete on license_activations to anon, authenticated;

-- Create view for easier querying
create or replace view activations as select * from license_activations;

grant select, insert, update, delete on activations to anon, authenticated;

-- ── 3. License verification function ────────────────────────
-- Called by the desktop app on first launch:
-- 1. Checks license key is valid and school is active
-- 2. Checks device hasn't exceeded max_users slot limit
-- 3. Registers the device if new
-- Returns: { valid, school_id, school_name, max_users, slots_used, message }

create or replace function verify_license(
    p_license_key text,
    p_device_id   text
)
returns json
language plpgsql
security definer
as $$
declare
    v_school        record;
    v_slots_used    integer;
    v_already_active boolean;
begin
    -- Find school by license key
    select * into v_school
    from schools
    where license_key = p_license_key
    limit 1;

    if not found then
        return json_build_object('valid', false, 'message', 'Invalid license key.');
    end if;

    -- Check school is active
    if v_school.subscription_status not in ('active', 'trial') then
        return json_build_object('valid', false, 'message', 'License is ' || v_school.subscription_status || '. Contact your administrator.');
    end if;

    -- Check expiry
    if v_school.expires_at is not null and v_school.expires_at < now() then
        return json_build_object('valid', false, 'message', 'License has expired. Please renew.');
    end if;

    -- Check if this device is already activated
    select exists(
        select 1 from license_activations
        where school_id = v_school.id and device_id = p_device_id
    ) into v_already_active;

    if v_already_active then
        -- Update last_seen and return success
        update license_activations
        set last_seen = now()
        where school_id = v_school.id and device_id = p_device_id;

        return json_build_object(
            'valid',       true,
            'school_id',   v_school.id,
            'school_name', v_school.name,
            'max_users',   v_school.max_users,
            'message',     'Device already activated.'
        );
    end if;

    -- Count current activations
    select count(*) into v_slots_used
    from license_activations
    where school_id = v_school.id;

    -- Check slot limit (max_users = -1 means unlimited)
    if v_school.max_users != -1 and v_slots_used >= v_school.max_users then
        return json_build_object(
            'valid',   false,
            'message', 'Device limit reached (' || v_slots_used || '/' || v_school.max_users || '). Revoke a device from the admin portal.'
        );
    end if;

    -- Register new device
    insert into license_activations (school_id, license_key, device_id)
    values (v_school.id, p_license_key, p_device_id);

    return json_build_object(
        'valid',       true,
        'school_id',   v_school.id,
        'school_name', v_school.name,
        'max_users',   v_school.max_users,
        'slots_used',  v_slots_used + 1,
        'message',     'Activation successful.'
    );
end;
$$;

-- Grant execute to anon so desktop app can call it without auth
grant execute on function verify_license(text, text) to anon;

-- ── 4. User login verification function ─────────────────────
-- Desktop app calls this after activation to verify username/password
-- Returns: { valid, user_id, name, role, school_id, message }

create or replace function verify_school_user(
    p_username      text,
    p_password_hash text
)
returns json
language plpgsql
security definer
as $$
declare
    v_user record;
    v_school record;
begin
    select * into v_user
    from school_users
    where username = p_username and password_hash = p_password_hash and is_active = true
    limit 1;

    if not found then
        return json_build_object('valid', false, 'message', 'Invalid username or password.');
    end if;

    select subscription_status, expires_at, name into v_school
    from schools where id = v_user.school_id;

    if v_school.subscription_status not in ('active', 'trial') then
        return json_build_object('valid', false, 'message', 'School account is ' || v_school.subscription_status || '.');
    end if;

    return json_build_object(
        'valid',     true,
        'user_id',   v_user.id,
        'name',      v_user.name,
        'role',      v_user.role,
        'school_id', v_user.school_id,
        'message',   'Login successful.'
    );
end;
$$;

grant execute on function verify_school_user(text, text) to anon;

-- Reload schema cache
notify pgrst, 'reload schema';

select 'Done — school_users, license_activations, activations view, verify_license(), verify_school_user() created.' as status;
