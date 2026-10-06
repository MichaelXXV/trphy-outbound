# TRPHY outbound: cold email spec (v1)

Planning record for the TRPHY corporate outbound engine. Everything here was decided with Michael on 2026-10-06. Claude Code builds from this. Rules only, no code. The copy of record also lives in the Claude project "asapparel.ink" as `trphy/outbound-spec.md`; keep the two the same.

## Purpose

Move TRPHY hats in corporate quantities. A company in DFW gets an email with a mockup of its own logo as a PVC patch on the TR5, three prices, and a page of its own. A yes becomes a Shopify draft order on the TRPHY store. The box drives the account back to its page for patches, hat colours and rope colours.

The same engine, domains and list carry AS Apparel uniforms later. TRPHY goes first because the offer is one product at three prices and needs no quoter.

**The numbers that matter are hats shipped per month and margin dollars per order.** Reply rate and inbox placement are diagnostics, not goals.

## The offer (locked)

- TR5 solid hat, the company's logo as a PVC patch, one rope included. Two-tone colourways add $2 at every tier.
- Three price points, flat, no further discounting: **25 at $40, 50 at $36, 100 at $32.**
- Second patch: a house patch is a $6 add-on at 25 and 50. **At 100, one house patch per hat is free.** That is the closer.
- Logo patch reorders: $6 each, 25 minimum.
- Costs used for margin: hat landed $14.71 solid / $16.71 two-tone (rope included); AnyRope royalty $0.55 per hat; logo PVC patch run per design $75 at 25, $90 at 50, $160 at 100; house patches at the 50 to 100 run price ($1.60 to $1.80). No $3 house patch anywhere: every house run is 50 to 100.
- Margin per hat: 25 → $21.74 (54%), $544 an order. 50 → $18.94 (53%), $947 an order. 100 → $13.54 (42%) after the free house patch, $1,354 an order.
- The 100 tier is where the discount lives on purpose: the hats are already paid for and 100 piece orders are what clears a run.

## Delivery promise

- PVC manufacturer lead time is **2 weeks** from proof approval. Hats are in stock.
- The lead page and the quote email promise **in hand about three weeks from your yes**: a few days for the proof, two weeks for the patches, a few days to assemble and ship. The quote email states the actual date. The week of padding is deliberate; Michael can tighten it once the first orders have run.
- A reorder of patches alone promises two weeks.

## Starting house patches (option images)

Four to start, shown on every mockup set. Michael updates the list later.

1. Crossed fishing hooks with the gold T, black field, cream hooks
2. Texas flag with the cream T outline
3. BLESSED arched wordmark with the T and bars, black field
4. Dallas D with star, navy, black, grey and cream

## Where it lives

- `go.trphy.co`, a Next.js app on Vercel, same stack as the hub. A Shopify page cannot run any of this; the subdomain is styled to read as the site.
- Public: `/for/<company-slug>`, the lead page, later the account page. Rate limited, no login.
- Staff: `/ops` behind a login. List builder, review queue, mockups, campaign push, replies and outcomes.
- Its own repo (this one), borrowing the hub's mockup and background removal approach. TRPHY is its own LLC and may be sold outright, so its engine lifts out clean.

## Rollout, three campaigns on one system

1. **Warm.** Existing AS Apparel customers, pulled from Printavo. Sent from the shop's real domain, not the cold domains, because these people know the shop. Mockup inline, no A/B. First orders come from here.
2. **Cold.** The DFW list through the shared sending domains. A/B on image versus link (below).
3. **AS Apparel.** Same domains, same mailboxes, same list, uniform offer, once the quoter exists. Not before.

A company that buys TRPHY is a customer and leaves the cold list for good. Anything further to it is a customer email from the real domain.

## List builder

Staff enters industry terms and an area ("plumbing, DFW"). The pipeline:

- Companies from the Google Places API: name, website, phone, address, category. Not scraped from Maps HTML, which breaks and gets blocked.
- Size and the person from Apollo: owner, president, office manager, operations manager; HR or marketing only at larger companies. Size filter 30 to 500 to start.
- Every email verified before it is saved (Instantly's verifier or MillionVerifier). Nothing unverified ever reaches a campaign.
- Logo fetched from the company website (og:image, logo img, high res favicon), Brandfetch or logo.dev as fallback. Claude vision picks the best candidate and grades it: usable, needs cleanup, or not PVC-able (gradients, photos, fine text).
- Lead statuses: new → reviewed → approved → sent → replied → quoted → won or lost. **Nothing sends unreviewed.** The review queue shows the mockup, the person, the email and the logo grade, with approve, fix logo, skip.
- Existing Printavo customers are routed to the warm campaign, never the cold one.

## Mockup generator

- Source renders: the ten factory TR5 mockups at 2048px. Default hero is black.
- Patch render: a PVC look, not a sticker. Flat colour fills (the logo simplified to flat colours where needed), raised bevel, a border colour pulled from the logo, die-cut rectangle with rounded corners in the TRPHY patch proportions. Composited on the front panel at the real patch size.
- One set per lead: hero (logo on black), the logo on graphite and white, the hat wearing a house patch, and a 2x2 of the four starting house patches. Stored, URLs saved on the lead. Generated in batch before a campaign loads.
- **The real logo file is composited. No generative model ever redraws a logo.** A logo graded not PVC-able gets no mockup and the lead is held for a hand decision.
- The mockup is a first look. The manufacturer's proof is the proof, and the email and page both say so.

## Lead page, then account page

`go.trphy.co/for/<slug>` shows the mockup set, the three prices with the free patch at 100, the delivery promise, the option patches, colourways, rope colours, and one button: "Send me a quote" (quantity, colourway, name, email, phone). Submitting creates a quote request on the lead and notifies Angelica. No price is hidden.

After the first order the same URL is the account page: reorder the logo patch at 25 for $6 each, new house patches, hat and rope colours, all under a per-account corporate code that prices hats at the tier they bought at and patches at $6. A corporate account never sees $45 retail. The box insert carries a QR to this page and the line on where to buy more patches.

## Sending

- **Instantly.** Shared domains (next section), Google Workspace mailboxes named for people, two or three per domain. Warmup two to three weeks inside the tool, then 20 to 30 a day per mailbox. Four domains is about 300 a day.
- Variables pushed per lead: first name, company, hero URL, page URL, the three prices.
- Sequence, four emails over fourteen days: (1) the offer with the hero; (2) a bump on the swap, house patch image; (3) the 100 tier with the free second patch; (4) a short close.
- A/B on cold only: half get the hero image inline, half get plain text with one link to the page. After 300 sends per arm the arm with more replies takes 100%.
- Replies land in Instantly's inbox for Angelica. A webhook writes every reply back to the lead with a classification (interested, not now, no, unsubscribe) so price, industry and tier can be read against outcomes.
- Angelica's work is a daily block: replies, quotes, outcomes. Not an inbox she watches.

Compliance, built in and not optional: the real mailing address in every email; the unsubscribe link honoured within ten days and a manual "stop" treated the same; one suppression list across both brands and every campaign; SPF, DKIM and DMARC on every sending domain; bounces under 3% and complaints under 0.3% per domain or that domain pauses. **Nothing cold ever sends from trphy.co, asapparel.ink, asapparelwholesale.com or shopasapparel.com.**

## Shared sending domains

- Neutral names that fit both brands. Never trphy-anything or asapparel-anything.
- The root of every domain redirects to a one-page "who is emailing you" that names both brands.
- Same mailboxes for both brands; the signature changes per campaign.
- One Instantly workspace, one suppression list, nobody in two active sequences at once.
- Buy one spare. A domain that gets burned is retired, never handed to the next brand.

## Orders

A yes is confirmed by Angelica (quantity, colourway, option patch), the logo goes to the PVC manufacturer for proof, and the order is written as a **Shopify draft order on the TRPHY store** at the corporate price, so the money and the customer live in TRPHY's books. Hat SKUs keep the `TRPHY-TR5-` prefix and patches the `TRPHY-PCH-` prefix so the Klaviyo segments stay true. Payment through Shopify. The logo patch run is ordered after proof approval and lands in two weeks. The insert goes in every box.

## Metrics on the staff screen

Sends, reply rate by domain (the inbox placement proxy), positive rate, quotes, orders, hats per order, margin per order, hats per month. Cut by industry and by tier.

## Not decided yet

- The domain names (Michael is buying)
- Whether corporate buyers are kept out of the consumer Klaviyo flows (welcome, post purchase)
- House patches beyond the starting four
- TRPHY patch standard dimensions, needed for the mockup proportions
