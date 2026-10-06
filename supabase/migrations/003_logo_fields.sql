-- 003: what the logo fetcher learns beyond the grade. Run by hand in the Supabase SQL editor.
-- logo_colors: two or three dominant colours as hex, the patch border colour is chosen from these.
-- logo_kind: mark, wordmark or both.
-- logo_fetched_at: set on every attempt, found or not, so the button moves on to the next company.

alter table companies
  add column logo_colors text[],
  add column logo_kind text,
  add column logo_fetched_at timestamptz;
