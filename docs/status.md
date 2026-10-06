# TRPHY outbound: build status

## Where it stands, 2026-10-06 (evening)

Built in Cowork with Michael, step by step. From here the build moves to Claude Code in this repo.
The rules are in `docs/outbound-spec.md`. Repo conventions are in `CLAUDE.md`. Read both first.

### Done
- Repo scaffolded (Next.js 16, Tailwind 4, `src/`), pushed to github.com/MichaelXXV/trphy-outbound.
- Supabase project `trphy-outbound` created. Migration `001_leads.sql` applied by hand.
  Buckets `logos` (private) and `mockups` (public) exist.
- `.env.local` on Michael's machine holds Supabase URL, anon key, service role key, OPS_PASSWORD,
  GOOGLE_PLACES_API_KEY and APOLLO_API_KEY (Apollo Professional, monthly). Not yet set: INSTANTLY_*,
  ANTHROPIC_API_KEY, SHOPIFY_ADMIN_TOKEN.
- Ops login (`/ops/login`): name plus the shared OPS_PASSWORD, signed cookie, 12 hour sliding window,
  gated by `src/proxy.ts`. Every ops page and action calls `requireOps()`.
- Ops home (`/ops`): pipeline counts by status and four work tiles.
- List builder (`/ops/build`): Google Places (New) text search, 20 to 60 per run, upserts `companies`
  by place id, skips closed companies and companies with no website of their own. Tested: 20 plumbing
  companies in Dallas added.
- People finder (`/ops/companies`, Find people button): five companies per press. Apollo people search
  on the company domain filtered to buyer titles (1 credit), reveal the best match's email (1 credit if
  found, 0 for a contact already unlocked), fall back to emails printed on the company website. Saves
  `people` and opens a `leads` row in `new` (or `suppressed` if the email is on the suppression list).
  Run live 2026-10-06 on 5 plumbing companies: 3 named buyers (all Apollo verified), 1 website inbox,
  1 nothing, 3 credits (matches the Apollo dashboard). Apollo retired `mixed_people/search` for API
  keys; the finder uses `mixed_people/api_search` (no credits, returns first name, title and has_email
  only) and `people/match` fills in last name, email, email_status and company size.
  Open question: Apollo reports these plumbers at 1 to 4 employees against the spec's 30 to 500.

### Next, in order
1. Email verification. Apollo's `email_status === "verified"` is trusted as verified. Everything else
   needs a verifier before it can be approved (MillionVerifier or Instantly's verifier). Add the call and
   a column.
2. Logo fetcher: og:image, logo img, high res favicon off the company site; Brandfetch or logo.dev as
   fallback. Claude vision grades usable / needs_cleanup / not_pvc. Store in the `logos` bucket, set
   `companies.logo_path`, `logo_source_url`, `logo_grade`, `logo_notes`.
3. Mockup generator with sharp: PVC look (flat fills, bevel, border from the logo, rounded die-cut) on the
   ten TR5 factory renders (2048px, on Michael's machine under C:\Users\Michael\Projects\TRPHY, Headwear
   folder, and in the TRPHY Shopify store). Hero on black, graphite, white, one with a house patch, a 2x2
   of the four house patches. Store in `mockups`, rows in `mockups`. The four house patch PNGs are:
   TRPHY_Fishing_Original_Approved_Master.png, TRPHY_Texas_T_Recovered_Master.png,
   TRPHY-01-Blessedblkwhite.png, Layer_124.png (Dallas D). Michael will drop them into the repo.
4. Review queue (`/ops/review`): mockup, person, email, logo grade; approve, fix logo, skip.
5. Lead page (`/for/<slug>`): mockups, three prices with the free patch at 100, delivery promise, option
   patches, colourways, rope colours, "Send me a quote" form writing `quote_requests`.
6. Instantly push and reply webhook. Then Vercel (go.trphy.co) and Shopify draft orders.

### Rules learned here
- The Cowork link to Michael's machine times out at 180 seconds and git lock files written through it
  cannot be removed from that side. All git and npm from Michael's own terminal or Claude Code.
- `cacheComponents` is OFF in next.config.ts on purpose: every ops screen reads cookies and the DB per
  request.
- `server-only` is not installed; keep service role imports out of client components by convention.
