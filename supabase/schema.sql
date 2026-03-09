-- KarmaPulse SLA Dashboard Database Schema
-- Run this in your Supabase SQL Editor to initialize the database

-- 1. SLA Rules Table
CREATE TABLE IF NOT EXISTS public.sla_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carrier_name TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    description TEXT,
    deadline_minutes INTEGER NOT NULL, -- The time allowed before breach (e.g., 4h = 240m)
    gravity_score TEXT NOT NULL CHECK (gravity_score IN ('Critical', 'Contractual', 'Best Practice')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Active Jobs Table
CREATE TABLE IF NOT EXISTS public.jobs (
    id TEXT PRIMARY KEY, -- e.g. 'JOB-402'
    carrier_name TEXT NOT NULL,
    location TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Weightless', 'Neutral', 'Heavy', 'Breached')),
    time_to_breach_minutes INTEGER,
    next_action TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Karma Commands (Audit Actions) Table
CREATE TABLE IF NOT EXISTS public.karma_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id TEXT NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    alert_message TEXT NOT NULL,
    solution_message TEXT NOT NULL,
    va_action TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security) - Optional but recommended for production
ALTER TABLE public.sla_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.karma_commands ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read/write for demo purposes (In production, restrict to authenticated users)
DROP POLICY IF EXISTS "Allow anon read all sla_rules" ON public.sla_rules;
CREATE POLICY "Allow anon read all sla_rules" ON public.sla_rules FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon insert all sla_rules" ON public.sla_rules;
CREATE POLICY "Allow anon insert all sla_rules" ON public.sla_rules FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read all jobs" ON public.jobs;
CREATE POLICY "Allow anon read all jobs" ON public.jobs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon insert all jobs" ON public.jobs;
CREATE POLICY "Allow anon insert all jobs" ON public.jobs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update all jobs" ON public.jobs;
CREATE POLICY "Allow anon update all jobs" ON public.jobs FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow anon read all commands" ON public.karma_commands;
CREATE POLICY "Allow anon read all commands" ON public.karma_commands FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon insert all commands" ON public.karma_commands;
CREATE POLICY "Allow anon insert all commands" ON public.karma_commands FOR INSERT WITH CHECK (true);

-- 4. Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    company TEXT,
    role TEXT NOT NULL CHECK (role IN ('superadmin', 'admin')),
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policies for users table
DROP POLICY IF EXISTS "Allow public read for users" ON public.users;
CREATE POLICY "Allow public read for users" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert for users" ON public.users;
CREATE POLICY "Allow public insert for users" ON public.users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update for users" ON public.users;
CREATE POLICY "Allow public update for users" ON public.users FOR UPDATE USING (true);

-- 5. Vault Folders Table
CREATE TABLE IF NOT EXISTS public.vault_folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    company TEXT,
    document_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Vault Files Table
CREATE TABLE IF NOT EXISTS public.vault_files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    size INTEGER,
    last_modified BIGINT,
    folder_id TEXT REFERENCES public.vault_folders(id) ON DELETE CASCADE,
    data_url TEXT, -- Base64 content
    company TEXT,
    document_type TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for Vault
ALTER TABLE public.vault_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_files ENABLE ROW LEVEL SECURITY;

-- Policies for Vault (Allow public read/write for demo/assignment)
DROP POLICY IF EXISTS "Allow public read for folders" ON public.vault_folders;
CREATE POLICY "Allow public read for folders" ON public.vault_folders FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert for folders" ON public.vault_folders;
CREATE POLICY "Allow public insert for folders" ON public.vault_folders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update for folders" ON public.vault_folders;
CREATE POLICY "Allow public update for folders" ON public.vault_folders FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete for folders" ON public.vault_folders;
CREATE POLICY "Allow public delete for folders" ON public.vault_folders FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read for files" ON public.vault_files;
CREATE POLICY "Allow public read for files" ON public.vault_files FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert for files" ON public.vault_files;
CREATE POLICY "Allow public insert for files" ON public.vault_files FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update for files" ON public.vault_files;
CREATE POLICY "Allow public update for files" ON public.vault_files FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete for files" ON public.vault_files;
CREATE POLICY "Allow public delete for files" ON public.vault_files FOR DELETE USING (true);


