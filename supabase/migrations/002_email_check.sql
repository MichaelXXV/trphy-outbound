-- 002: email verification (MillionVerifier) and a held status. Run by hand in the Supabase SQL editor.
--
-- people.email_check is the verifier's answer:
--   apollo_verified  Apollo said verified, no second check
--   ok               MillionVerifier ok
--   catch_all        domain accepts everything; allowed through, flagged on screen
--   unknown          retried once a day later, then the lead is held
--   invalid          suppressed, lead lost ("bad email")
--   disposable       suppressed, lead lost ("bad email")
-- people.email_verified stays the gate: true for apollo_verified, ok and catch_all.

alter type lead_status add value if not exists 'held';

alter table people
  add column email_check text,
  add column email_checked_at timestamptz,
  add column email_check_attempts int not null default 0;

alter table leads add column hold_reason text;

update people set email_check = 'apollo_verified', email_checked_at = email_verified_at
  where email_verified and apollo_person_id is not null;
