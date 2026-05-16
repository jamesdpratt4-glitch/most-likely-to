-- Add column to track whether detailed votes are revealed
ALTER TABLE rooms ADD COLUMN show_detailed_votes BOOLEAN DEFAULT false;
