-- ============================================================
-- YardFlow Migration: Guard Shack & Gate Log
-- Run this in Supabase SQL Editor → New Query → Run
-- ============================================================

-- Allow 'guard' as a user role
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'manager', 'warehouse', 'hostler', 'guard'));

-- Gate log table
CREATE TABLE IF NOT EXISTS gate_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  load_id TEXT NOT NULL DEFAULT '',
  trailer_number TEXT NOT NULL DEFAULT '',
  carrier TEXT NOT NULL DEFAULT '',
  load_type TEXT NOT NULL DEFAULT '',
  notes TEXT DEFAULT '',
  logged_by UUID REFERENCES users(id),
  logged_by_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gate_log_created ON gate_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gate_log_direction ON gate_log(direction);
CREATE INDEX IF NOT EXISTS idx_gate_log_trailer ON gate_log(trailer_number);

ALTER TABLE gate_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on gate_log" ON gate_log FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE gate_log;

-- Add carriers and load types to settings
UPDATE settings SET data = data || '{"carriers":["PepsiCo","Frito-Lay","Swift","JB Hunt","Werner","Schneider","XPO","FedEx","UPS"],"loadTypes":["Drop","Pick","Live Unload","Live Load"]}'::jsonb WHERE id = 'global';
