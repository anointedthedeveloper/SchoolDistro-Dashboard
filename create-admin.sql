-- Run this in Supabase SQL Editor
SELECT supabase_admin.create_user(
    email := 'admin@portal.schooldistro.anobyte.online',
    password := 'anointed',
    email_confirmed := true
);
