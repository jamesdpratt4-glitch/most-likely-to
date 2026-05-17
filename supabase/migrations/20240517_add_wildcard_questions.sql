-- Add wildcard questions with special rules
INSERT INTO questions (question_text, question_type, rules) VALUES
  -- Wildcard: Can vote for yourself
  ('Most likely to vote for themselves (self-vote allowed!)', 'wildcard', '{"can_vote_self": true, "description": "You can vote for yourself this round!"}'::jsonb),
  
  -- Wildcard: Everyone must vote for the same person (if possible)
  ('Most likely to be the group consensus choice', 'wildcard', '{"can_vote_self": false, "consensus_mode": true, "description": "Try to agree on one person!"}'::jsonb),
  
  -- Wildcard: Double points
  ('Most likely to... DOUBLE POINTS ROUND!', 'wildcard', '{"can_vote_self": false, "multiplier": 2, "description": "Drink counts are doubled this round!"}'::jsonb),
  
  -- Wildcard: No voting, random selection
  ('Most likely to be chosen by fate (random selection)', 'wildcard', '{"can_vote_self": false, "random_selection": true, "description": "No voting - random winner!"}'::jsonb),
  
  -- Wildcard: Everyone drinks
  ('Most likely to... EVERYONE DRINKS!', 'wildcard', '{"can_vote_self": false, "everyone_drinks": true, "description": "Everyone takes a drink regardless of votes!"}'::jsonb)
ON CONFLICT DO NOTHING;
