// Logo candidates for a company, in Michael's order (2026-10-06):
//   1. the site's own logo: an img or inline svg in the header with "logo" in its src, alt or class
//   2. og:image
//   3. apple-touch-icon, or the largest favicon
//   4. Brandfetch or logo.dev by domain (only when the site gave nothing, and only with a key set)
// Format and size preference (SVG, then PNG with transparency, then JPG, largest first) is applied
// after download, in logo-image.ts, because the bytes are what tell us.

import { parse, type HTMLElement } from "node-html-parser";

export type CandidateSource = "site_logo" | "og_image" | "icon" | "brandfetch" | "logo_dev";

export interface Candidate {
  source: CandidateSource;
  url: string;          // where it came from; for an inline svg, the page URL plus #inline-svg-N
  inlineSvg?: string;   // the markup itself, when the logo is drawn in the page
  declaredSize?: number; // from sizes="180x180" on icon links, used only to order icons
}

const UA = "Mozilla/5.0 (compatible; TRPHY logo check)";
const MAX_SITE_LOGOS = 4;

export async function fetchPage(url: string): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": UA }, redirect: "follow", cache: "no-store" });
    clearTimeout(t);
    if (!res.ok) return null;
    return { html: (await res.text()).slice(0, 1_500_000), finalUrl: res.url || url };
  } catch {
    return null;
  }
}

function abs(href: string | undefined, base: string): string | null {
  if (!href) return null;
  const h = href.trim();
  if (!h || h.startsWith("data:") && !h.startsWith("data:image/svg")) return null;
  try {
    return new URL(h, base).toString();
  } catch {
    return null;
  }
}

// The biggest entry in a srcset, else src, else the common lazy-load attributes.
function imgUrl(img: HTMLElement, base: string): string | null {
  const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset");
  if (srcset) {
    const best = srcset.split(",").map((part) => {
      const [u, d] = part.trim().split(/\s+/);
      return { u, w: parseFloat(d ?? "1") || 1 };
    }).sort((a, b) => b.w - a.w)[0];
    const u = abs(best?.u, base);
    if (u) return u;
  }
  for (const attr of ["src", "data-src", "data-lazy-src", "data-original"]) {
    const u = abs(img.getAttribute(attr), base);
    if (u) return u;
  }
  return null;
}

const mentionsLogo = (el: HTMLElement | null, attrs: string[]) =>
  !!el && attrs.some((a) => (el.getAttribute(a) ?? "").toLowerCase().includes("logo"));

// "logo" on the element itself, or on the link or wrapper right around it (<a class="logo"><img>).
function isLogo(el: HTMLElement, attrs: string[]): boolean {
  if (mentionsLogo(el, attrs)) return true;
  let p = el.parentNode as HTMLElement | null;
  for (let i = 0; i < 2 && p; i++, p = p.parentNode as HTMLElement | null) {
    if (mentionsLogo(p, ["class", "id"])) return true;
  }
  return false;
}

export function siteCandidates(html: string, pageUrl: string): Candidate[] {
  const root = parse(html);
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const add = (c: Candidate) => {
    if (seen.has(c.url)) return;
    seen.add(c.url);
    out.push(c);
  };

  // 1. Header first; a page with no header element falls back to the whole document.
  const headers = root.querySelectorAll("header, [role=banner], nav, #header, .header, .site-header");
  const scopes = headers.length ? headers : [root];
  let n = 0;
  for (const scope of scopes) {
    for (const img of scope.querySelectorAll("img")) {
      if (n >= MAX_SITE_LOGOS) break;
      if (!isLogo(img, ["src", "alt", "class", "id", "data-src"])) continue;
      const u = imgUrl(img, pageUrl);
      if (u) { add({ source: "site_logo", url: u }); n++; }
    }
    for (const svg of scope.querySelectorAll("svg")) {
      if (n >= MAX_SITE_LOGOS) break;
      if (!isLogo(svg, ["class", "id", "aria-label"])) continue;
      const markup = svg.toString();
      if (markup.length < 200 || markup.length > 400_000) continue; // icons and sprites
      add({ source: "site_logo", url: `${pageUrl}#inline-svg-${n}`, inlineSvg: markup });
      n++;
    }
  }

  // 2. og:image
  for (const m of root.querySelectorAll('meta[property="og:image"], meta[name="og:image"], meta[property="og:image:url"]')) {
    const u = abs(m.getAttribute("content"), pageUrl);
    if (u) add({ source: "og_image", url: u });
  }

  // 3. apple-touch-icon, then the largest declared favicon
  const icons: Candidate[] = [];
  for (const l of root.querySelectorAll("link[rel]")) {
    const rel = (l.getAttribute("rel") ?? "").toLowerCase();
    if (!rel.includes("icon")) continue;
    const u = abs(l.getAttribute("href"), pageUrl);
    if (!u) continue;
    const sizes = (l.getAttribute("sizes") ?? "").match(/(\d+)x(\d+)/);
    const size = sizes ? parseInt(sizes[1], 10) : rel.includes("apple-touch") ? 180 : 32;
    icons.push({ source: "icon", url: u, declaredSize: rel.includes("apple-touch") ? size + 10_000 : size });
  }
  icons.sort((a, b) => (b.declaredSize ?? 0) - (a.declaredSize ?? 0)).slice(0, 2).forEach(add);

  return out;
}

// 4. Paid fallbacks by domain. Each is skipped when its key is not set.
export async function fallbackCandidates(domain: string): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const brandfetch = process.env.BRANDFETCH_API_KEY;
  if (brandfetch) {
    try {
      const res = await fetch(`https://api.brandfetch.io/v2/brands/${encodeURIComponent(domain)}`, {
        headers: { Authorization: `Bearer ${brandfetch}` }, cache: "no-store",
      });
      if (res.ok) {
        const json = (await res.json()) as { logos?: Array<{ type?: string; formats?: Array<{ src?: string; format?: string; width?: number }> }> };
        const logos = (json.logos ?? []).sort((a, b) => (a.type === "logo" ? 0 : 1) - (b.type === "logo" ? 0 : 1));
        for (const logo of logos.slice(0, 2)) {
          const fmt = (logo.formats ?? []).sort((a, b) => fmtRank(a.format) - fmtRank(b.format) || (b.width ?? 0) - (a.width ?? 0))[0];
          if (fmt?.src) out.push({ source: "brandfetch", url: fmt.src });
        }
      }
    } catch {
      // a fallback that fails is the same as no fallback
    }
  }
  const logoDev = process.env.LOGO_DEV_TOKEN;
  if (logoDev && out.length === 0) {
    out.push({ source: "logo_dev", url: `https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(logoDev)}&size=800&format=png` });
  }
  return out;
}

function fmtRank(f: string | undefined): number {
  return f === "svg" ? 0 : f === "png" ? 1 : 2;
}
