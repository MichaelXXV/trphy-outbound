// Free fallback: the company's own website usually prints an address on the home or contact page.
// Only addresses on the company's own domain count, and role addresses are kept because at a
// 30 person plumbing company the owner reads info@.

const PAGES = ["", "/contact", "/contact-us", "/about", "/about-us"];
const SKIP_LOCAL = ["noreply", "no-reply", "donotreply", "privacy", "abuse", "webmaster", "example", "sentry", "wixpress"];
const ROLE_ORDER = ["owner", "info", "office", "contact", "hello", "sales", "admin", "service"];

export async function findSiteEmails(website: string, domain: string): Promise<string[]> {
  const found = new Set<string>();
  const re = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  for (const path of PAGES) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(website + path, {
        signal: ctrl.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; TRPHY lead check)" },
        redirect: "follow",
        cache: "no-store",
      });
      clearTimeout(t);
      if (!res.ok) continue;
      const html = (await res.text()).slice(0, 400_000);
      for (const m of html.matchAll(re)) {
        const email = m[0].toLowerCase().replace(/^mailto:/, "");
        const [local, host] = email.split("@");
        if (!host) continue;
        if (host !== domain && !host.endsWith("." + domain)) continue;
        if (SKIP_LOCAL.some((s) => local.includes(s))) continue;
        if (/\.(png|jpg|jpeg|gif|svg|webp)$/.test(email)) continue;
        found.add(email);
      }
    } catch {
      // a slow or broken site is a normal outcome, not an error
    }
    if (found.size >= 3) break;
  }
  return Array.from(found).sort((a, b) => roleScore(a) - roleScore(b));
}

function roleScore(email: string): number {
  const local = email.split("@")[0];
  const i = ROLE_ORDER.findIndex((r) => local.startsWith(r));
  // a named address (not a role) sorts first, then roles in order
  return i === -1 ? -1 : i;
}
