-- ============================================================
-- YardFlow Migration: In/Out of Service toggle
-- Run in Supabase SQL Editor
-- ============================================================

-- Add active column to locations (default to true so existing records stay in service)
ALTER TABLE locations ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS inactive_reason TEXT;

-- Add active column to trailers
ALTER TABLE trailers ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE trailers ADD COLUMN IF NOT EXISTS inactive_reason TEXT;

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(active);
CREATE INDEX IF NOT EXISTS idx_trailers_active ON trailers(active);
