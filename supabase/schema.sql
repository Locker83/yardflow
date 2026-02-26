-- ============================================================
-- YardFlow Database Schema for Supabase
-- Run this ENTIRE file in Supabase SQL Editor → New Query → Run
-- ============================================================

-- ─── USERS TABLE ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'warehouse', 'hostler')),
  active BOOLEAN NOT NULL DEFAULT true,
  color TEXT DEFAULT '#FF6B2C',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── LOCATIONS TABLE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('dock', 'yard', 'gate')),
  zone TEXT -- 'Shipping', 'Receiving', 'Cross-Dock', or NULL
);

-- ─── TRAILERS TABLE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trailers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Dry Van', 'Reefer', 'Flatbed', 'Tanker')),
  status TEXT NOT NULL DEFAULT 'Empty' CHECK (status IN ('Empty', 'Loaded', 'Partial', 'Sealed', 'Live Load')),
  location_id TEXT REFERENCES locations(id),
  carrier TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  last_moved TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── MOVES TABLE ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_number SERIAL,
  type TEXT NOT NULL CHECK (type IN ('dock', 'pull', 'adjust', 'yard-move', 'gate-in', 'gate-out')),
  trailer_number TEXT NOT NULL,
  trailer_type TEXT DEFAULT '',
  from_location TEXT REFERENCES locations(id),
  to_location TEXT REFERENCES locations(id),
  requested_by TEXT DEFAULT '',
  requested_by_user UUID REFERENCES users(id),
  claimed_by UUID REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- ─── INDEXES ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_moves_status ON moves(status);
CREATE INDEX IF NOT EXISTS idx_moves_claimed_by ON moves(claimed_by);
CREATE INDEX IF NOT EXISTS idx_moves_created_at ON moves(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trailers_location ON trailers(location_id);
CREATE INDEX IF NOT EXISTS idx_trailers_number ON trailers(number);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ─── UPDATED_AT TRIGGER ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trailers_updated_at ON trailers;
CREATE TRIGGER trailers_updated_at BEFORE UPDATE ON trailers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── ROW LEVEL SECURITY ────────────────────────────────────
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE trailers ENABLE ROW LEVEL SECURITY;
ALTER TABLE moves ENABLE ROW LEVEL SECURITY;

-- For this app, we handle auth at the app level (username/password in our users table)
-- and use the anon key with permissive policies. For production hardening,
-- you'd switch to Supabase Auth with JWT-based RLS.

-- Allow all operations via anon key (app-level auth handles permissions)
CREATE POLICY "Allow all on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on locations" ON locations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on trailers" ON trailers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on moves" ON moves FOR ALL USING (true) WITH CHECK (true);

-- ─── ENABLE REALTIME ────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE moves;
ALTER PUBLICATION supabase_realtime ADD TABLE trailers;
ALTER PUBLICATION supabase_realtime ADD TABLE locations;

-- ─── SEED: LOCATIONS ────────────────────────────────────────
-- Docks 1-24
INSERT INTO locations (id, label, type, zone) VALUES
  ('D01', 'Dock 1', 'dock', 'Shipping'), ('D02', 'Dock 2', 'dock', 'Shipping'),
  ('D03', 'Dock 3', 'dock', 'Shipping'), ('D04', 'Dock 4', 'dock', 'Shipping'),
  ('D05', 'Dock 5', 'dock', 'Shipping'), ('D06', 'Dock 6', 'dock', 'Shipping'),
  ('D07', 'Dock 7', 'dock', 'Shipping'), ('D08', 'Dock 8', 'dock', 'Shipping'),
  ('D09', 'Dock 9', 'dock', 'Receiving'), ('D10', 'Dock 10', 'dock', 'Receiving'),
  ('D11', 'Dock 11', 'dock', 'Receiving'), ('D12', 'Dock 12', 'dock', 'Receiving'),
  ('D13', 'Dock 13', 'dock', 'Receiving'), ('D14', 'Dock 14', 'dock', 'Receiving'),
  ('D15', 'Dock 15', 'dock', 'Receiving'), ('D16', 'Dock 16', 'dock', 'Receiving'),
  ('D17', 'Dock 17', 'dock', 'Cross-Dock'), ('D18', 'Dock 18', 'dock', 'Cross-Dock'),
  ('D19', 'Dock 19', 'dock', 'Cross-Dock'), ('D20', 'Dock 20', 'dock', 'Cross-Dock'),
  ('D21', 'Dock 21', 'dock', 'Cross-Dock'), ('D22', 'Dock 22', 'dock', 'Cross-Dock'),
  ('D23', 'Dock 23', 'dock', 'Cross-Dock'), ('D24', 'Dock 24', 'dock', 'Cross-Dock')
ON CONFLICT (id) DO NOTHING;

-- Yard spots 1-40
INSERT INTO locations (id, label, type, zone)
SELECT
  'Y' || LPAD(n::TEXT, 2, '0'),
  'Yard ' || n,
  'yard',
  NULL
FROM generate_series(1, 40) AS n
ON CONFLICT (id) DO NOTHING;

-- Gates
INSERT INTO locations (id, label, type, zone) VALUES
  ('GATE-IN', 'Gate In', 'gate', NULL),
  ('GATE-OUT', 'Gate Out', 'gate', NULL)
ON CONFLICT (id) DO NOTHING;

-- ─── SEED: ADMIN USER ───────────────────────────────────────
-- Password: admin123 (plaintext for demo — hash in production)
INSERT INTO users (username, password_hash, name, role, active, color) VALUES
  ('admin', 'admin123', 'Admin', 'admin', true, '#EF4444')
ON CONFLICT (username) DO NOTHING;

-- ─── SEED: SAMPLE USERS ─────────────────────────────────────
INSERT INTO users (username, password_hash, name, role, active, color) VALUES
  ('mike.r', 'yard1234', 'Mike R.', 'hostler', true, '#E74C3C'),
  ('james.t', 'yard1234', 'James T.', 'hostler', true, '#3498DB'),
  ('carlos.m', 'yard1234', 'Carlos M.', 'hostler', true, '#2ECC71'),
  ('derek.w', 'yard1234', 'Derek W.', 'hostler', true, '#F39C12'),
  ('tony.p', 'yard1234', 'Tony P.', 'hostler', true, '#9B59B6'),
  ('sam.l', 'yard1234', 'Sam L.', 'hostler', true, '#1ABC9C'),
  ('brian.k', 'yard1234', 'Brian K.', 'hostler', true, '#E67E22'),
  ('ray.h', 'yard1234', 'Ray H.', 'hostler', true, '#34495E'),
  ('sarah.w', 'yard1234', 'Sarah W.', 'warehouse', true, '#60A5FA'),
  ('tom.b', 'yard1234', 'Tom B.', 'warehouse', true, '#818CF8'),
  ('dave.j', 'yard1234', 'Dave J.', 'manager', true, '#FB923C')
ON CONFLICT (username) DO NOTHING;

-- ─── SEED: SAMPLE TRAILERS ──────────────────────────────────
INSERT INTO trailers (number, type, status, location_id, carrier) VALUES
  ('4521', 'Dry Van', 'Empty', 'D01', 'Swift'),
  ('4522', 'Reefer', 'Loaded', 'D02', 'JB Hunt'),
  ('4523', 'Flatbed', 'Partial', 'D03', 'Werner'),
  ('7801', 'Tanker', 'Sealed', 'D04', 'Schneider'),
  ('7802', 'Dry Van', 'Live Load', 'D05', 'XPO'),
  ('7803', 'Reefer', 'Empty', 'D06', 'Swift'),
  ('9100', 'Flatbed', 'Loaded', 'Y01', 'JB Hunt'),
  ('9101', 'Tanker', 'Partial', 'Y02', 'Werner'),
  ('9102', 'Dry Van', 'Sealed', 'Y03', 'Schneider'),
  ('9103', 'Reefer', 'Live Load', 'Y04', 'XPO'),
  ('3300', 'Flatbed', 'Empty', 'Y05', 'Swift'),
  ('3301', 'Tanker', 'Loaded', 'Y06', 'JB Hunt'),
  ('3302', 'Dry Van', 'Partial', 'Y07', 'Werner'),
  ('6610', 'Reefer', 'Sealed', 'Y08', 'Schneider'),
  ('6611', 'Flatbed', 'Live Load', 'Y09', 'XPO'),
  ('6612', 'Tanker', 'Empty', 'Y10', 'Swift'),
  ('6613', 'Dry Van', 'Loaded', 'Y11', 'JB Hunt'),
  ('8800', 'Reefer', 'Partial', 'GATE-IN', 'Werner'),
  ('8801', 'Flatbed', 'Sealed', 'GATE-IN', 'Schneider'),
  ('8802', 'Tanker', 'Live Load', 'GATE-IN', 'XPO')
ON CONFLICT (number) DO NOTHING;

-- ─── DONE ───────────────────────────────────────────────────
-- Your database is ready! All tables, indexes, policies, and sample data are created.
-- Log in to the app with: admin / admin123
