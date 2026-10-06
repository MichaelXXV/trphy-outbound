# TRPHY outbound: project notes for Claude Code

Cold email engine for TRPHY corporate hats, live at go.trphy.co (Vercel, auto-deploys from `main`).
A DFW company gets an email with a mockup of its own logo as a PVC patch on the TR5, three prices,
and a page of its own. A yes becomes a Shopify draft order on the TRPHY store.
The rules live in the project doc `trphy/outbound-spec.md` (Claude project "asapparel.ink").
This file says how the repo is built. The spec says what it does. When they disagree, the spec wins.

## Working style
- ALWAYS run `git pull` before starting any work. Two machines share this repo.
- Michael is the owner, not a developer. Explain in plain terms, one step at a time, short replies.
- Never use em dashes in any copy, UI text, or commit messages.
- Run `npx tsc --noEmit -p .` before committing.
- Commit and push after each working change; Vercel deploys from `main`.
- Never edit an applied migration. New schema changes get a new numbered file in `supabase/migrations/`
  and are run by hand in the Supabase SQL editor until the CLI is linked.

## Stack
Next.js 16 (App Router, `src/`), Tailwind 4, Supabase (Postgres + storage), sharp (mockups), Vercel.
Instantly for sending, Apollo and Google Places for data, Shopify Admin API (TRPHY store) for draft orders.
Own Supabase project, separate from the hub's. TRPHY is its own LLC and may be sold outright, so
nothing here imports from or writes to the hub's database.

## Hard rules (from the spec)
- The offer: TR5 solid, logo PVC patch, one rope. 25 at $40, 50 at $36, 100 at $32. Two-tone adds $2.
  House patch add-on $6 at 25 and 50, FREE at 100. Logo patch reorders $6 each, 25 minimum.
  Prices are flat. Nothing in the code discounts further.
- The real logo file is composited onto the hat render. No generative model ever redraws a logo.
- Nothing sends unreviewed. A lead reaches Instantly only from `approved`.
- Nothing cold ever sends from trphy.co, asapparel.ink, asapparelwholesale.com or shopasapparel.com.
  Cold goes through the shared neutral domains in Instantly. Warm (existing AS Apparel customers) goes
  from the shop's real domain.
- One suppression list across both brands. An unsubscribe or a typed "stop" is honoured everywhere.
- A corporate account never sees $45 retail on its page.
- Delivery promise: about three weeks from the yes (PVC lead time is two weeks). Patch-only reorders
  promise two weeks.

## Routes
- `/for/<slug>`: public lead page, later the account page. Rate limited, no login.
- `/ops`: staff, behind a login. List builder, review queue, mockups, campaign push, replies, outcomes.
- `/api/webhooks/instantly`: reply events written back to the lead.
- `/`: redirects to trphy.co.

## Brand
TRPHY voice: earned, plainspoken, confident, warm. Customer-facing copy signs off as TRPHY, never as a
person, except the cold emails themselves, which come from a named mailbox.
Banned words: grind, hustle, beast, warrior, conquer, no excuses, relentless, savage.
Tagline "It's the journey you wear." is for the hero only, never in subjects or buttons.
Do not claim the hats or patches are made in house.
