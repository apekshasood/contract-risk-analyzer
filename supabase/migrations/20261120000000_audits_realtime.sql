-- Let the browser subscribe to changes on its own audit rows (Supabase Realtime).
-- Realtime applies the same RLS policies, so a user only receives their own rows.
alter publication supabase_realtime add table public.audits;
