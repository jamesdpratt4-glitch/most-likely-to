-- Create a function to update drink counts and optionally show summary atomically
CREATE OR REPLACE FUNCTION update_drinks_and_show_summary(room_code_param TEXT, round_number_param INT, show_summary_param BOOLEAN DEFAULT true)
RETURNS void AS $$
BEGIN
  -- Update drink counts for winners of this round
  UPDATE players p
  SET drink_count = p.drink_count + COALESCE(vote_counts.votes_received, 0)
  FROM (
    SELECT voted_for, COUNT(*) as votes_received
    FROM votes
    WHERE room_code = room_code_param
    AND round_number = round_number_param
    GROUP BY voted_for
  ) vote_counts
  WHERE p.room_code = room_code_param
  AND p.nickname = vote_counts.voted_for;

  -- Set show_summary to true after drink counts are updated (if requested)
  IF show_summary_param THEN
    UPDATE rooms
    SET show_summary = true
    WHERE code = room_code_param;
  END IF;
END;
$$ LANGUAGE plpgsql;
