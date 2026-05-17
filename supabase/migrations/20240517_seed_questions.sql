-- Seed questions table with existing questions from JSON
INSERT INTO questions (question_text, question_type, rules) VALUES
  ('Most likely to wake up with a hangover and not remember the night before', 'standard', '{"can_vote_self": false}'::jsonb),
  ('Most likely to accidentally text their ex while drunk', 'standard', '{"can_vote_self": false}'::jsonb),
  ('Most likely to start a dance floor at a party', 'standard', '{"can_vote_self": false}'::jsonb),
  ('Most likely to lose their phone during a night out', 'standard', '{"can_vote_self": false}'::jsonb),
  ('Most likely to confess their deepest secrets after a few drinks', 'standard', '{"can_vote_self": false}'::jsonb),
  ('Most likely to order pizza at 3 AM', 'standard', '{"can_vote_self": false}'::jsonb),
  ('Most likely to become the designated parent of the friend group', 'standard', '{"can_vote_self": false}'::jsonb),
  ('Most likely to get into a heated debate about something trivial', 'standard', '{"can_vote_self": false}'::jsonb),
  ('Most likely to accidentally send a work email to the wrong person', 'standard', '{"can_vote_self": false}'::jsonb),
  ('Most likely to cry during a movie when no one else is', 'standard', '{"can_vote_self": false}'::jsonb),
  ('Most likely to adopt too many pets', 'standard', '{"can_vote_self": false}'::jsonb),
  ('Most likely to become a meme without knowing it', 'standard', '{"can_vote_self": false}'::jsonb),
  ('Most likely to survive a zombie apocalypse', 'standard', '{"can_vote_self": false}'::jsonb),
  ('Most likely to accidentally join a cult', 'standard', '{"can_vote_self": false}'::jsonb),
  ('Most likely to forget their own birthday', 'standard', '{"can_vote_self": false}'::jsonb),
  ('Most likely to become a conspiracy theorist', 'standard', '{"can_vote_self": false}'::jsonb),
  ('Most likely to accidentally reveal a surprise party', 'standard', '{"can_vote_self": false}'::jsonb),
  ('Most likely to get lost in their own neighborhood', 'standard', '{"can_vote_self": false}'::jsonb),
  ('Most likely to become a TikTok famous overnight', 'standard', '{"can_vote_self": false}'::jsonb),
  ('Most likely to accidentally wear their clothes inside out all day', 'standard', '{"can_vote_self": false}'::jsonb)
ON CONFLICT DO NOTHING;
