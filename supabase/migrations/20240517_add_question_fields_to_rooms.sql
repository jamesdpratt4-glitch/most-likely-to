-- Add question_type and question_rules columns to rooms table
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS question_type TEXT DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS question_rules JSONB DEFAULT '{"can_vote_self": false}'::jsonb;
