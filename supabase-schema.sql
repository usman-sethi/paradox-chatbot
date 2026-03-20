-- Run this in your Supabase SQL Editor to create the necessary table for chat history

CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL
);

-- Add an index for faster queries by session_id
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);

-- Set up Row Level Security (RLS) to allow anonymous inserts/selects for the prototype
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access"
ON messages FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow anonymous insert access"
ON messages FOR INSERT
TO anon
WITH CHECK (true);
