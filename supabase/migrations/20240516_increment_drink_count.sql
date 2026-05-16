-- Create RPC function to atomically increment drink_count
CREATE OR REPLACE FUNCTION increment_drink_count(
  p_room_code TEXT,
  p_nickname TEXT,
  p_increment INTEGER
)
RETURNS INTEGER AS $$
BEGIN
  UPDATE players
  SET drink_count = drink_count + p_increment
  WHERE room_code = p_room_code AND nickname = p_nickname
  RETURNING drink_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
