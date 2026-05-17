-- Create questions table for database-driven question management
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'standard', -- 'standard', 'wildcard', 'custom'
  rules JSONB DEFAULT '{"can_vote_self": false}'::jsonb,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on active questions for faster queries
CREATE INDEX IF NOT EXISTS idx_questions_active ON questions(active) WHERE active = true;

-- Create index on question_type for filtering
CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(question_type) WHERE active = true;
