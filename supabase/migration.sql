-- ============================================================
-- YardFlow Migration: Move Request Flow Update
-- Run this in Supabase SQL Editor → New Query → Run
-- ============================================================

-- Add cancel_reason for when hostlers cancel moves
ALTER TABLE moves ADD COLUMN IF NOT EXISTS cancel_reason TEXT DEFAULT '';

-- Add requested_trailer_type for "From Dock" moves where warehouse requests a type back
ALTER TABLE moves ADD COLUMN IF NOT EXISTS requested_trailer_type TEXT DEFAULT '';

-- Allow 'to-dock' and 'from-dock' as move types (in addition to existing ones)
ALTER TABLE moves DROP CONSTRAINT IF EXISTS moves_type_check;
ALTER TABLE moves ADD CONSTRAINT moves_type_check 
  CHECK (type IN ('dock', 'pull', 'adjust', 'yard-move', 'gate-in', 'gate-out', 'to-dock', 'from-dock'));

-- Allow 'released' as a status (hostler unclaims)
ALTER TABLE moves DROP CONSTRAINT IF EXISTS moves_status_check;
ALTER TABLE moves ADD CONSTRAINT moves_status_check 
  CHECK (status IN ('pending', 'in-progress', 'completed', 'cancelled', 'released'));

-- Done! Now upload the updated App.jsx to GitHub.
