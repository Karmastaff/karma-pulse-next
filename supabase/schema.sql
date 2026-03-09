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
CREATE POLICY "Allow anon read all sla_rules" ON public.sla_rules FOR SELECT USING (true);
CREATE POLICY "Allow anon insert all sla_rules" ON public.sla_rules FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon read all jobs" ON public.jobs FOR SELECT USING (true);
CREATE POLICY "Allow anon insert all jobs" ON public.jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update all jobs" ON public.jobs FOR UPDATE USING (true);

CREATE POLICY "Allow anon read all commands" ON public.karma_commands FOR SELECT USING (true);
CREATE POLICY "Allow anon insert all commands" ON public.karma_commands FOR INSERT WITH CHECK (true);
