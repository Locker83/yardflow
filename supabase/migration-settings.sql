-- ============================================================
-- YardFlow Migration: Settings Table
-- Run this in Supabase SQL Editor → New Query → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on settings" ON settings FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE settings;

-- Insert default settings
INSERT INTO settings (id, data) VALUES ('global', '{
  "trailerTypes": ["Dry Van", "Reefer", "Flatbed", "Tanker"],
  "trailerStatuses": ["Empty", "Loaded", "Partial", "Sealed", "Live Load"],
  "siteName": "YardFlow",
  "movesPerHourTarget": 4,
  "maxMoveMinutes": 30,
  "shiftHours": 10,
  "autoCreateSendBack": true
}'::jsonb)
ON CONFLICT (id) DO NOTHING;
