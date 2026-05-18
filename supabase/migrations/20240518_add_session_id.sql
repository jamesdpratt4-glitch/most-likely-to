-- Add session_id column to players table for persistent session tracking
ALTER TABLE players ADD COLUMN IF NOT EXISTS session_id TEXT;

-- Add index on session_id for fast lookups during session checks
CREATE INDEX IF NOT EXISTS idx_players_session_id ON players(session_id);

-- Add composite index for session_id + room_code for room-specific session checks
CREATE INDEX IF NOT EXISTS idx_players_session_room ON players(session_id, room_code);
