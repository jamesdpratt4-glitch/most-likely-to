-- Add host column to rooms table for proper host identification
ALTER TABLE rooms ADD COLUMN host TEXT;

-- Update existing rooms to set the first player as host (fallback)
UPDATE rooms 
SET host = (
  SELECT nickname 
  FROM players 
  WHERE players.room_code = rooms.code 
  ORDER BY created_at ASC 
  LIMIT 1
)
WHERE host IS NULL;
