-- Add phase column to rooms table for database-driven transitions
ALTER TABLE rooms ADD COLUMN phase TEXT DEFAULT 'voting';
