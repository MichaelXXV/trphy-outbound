"use server";

import { requireOps } from "@/lib/ops-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isOwnWebsite, searchPlaces, type PlaceRow } from "@/lib/places";
import { slugify } from "@/lib/slug";

export interface BuildResultRow {
  name: string;
  city: string | null;
  website: string | null;
  phone: string | null;
  outcome: "added" | "already" | "no_site" | "closed";
}

export interface BuildState {
  query?: string;
  rows?: BuildResultRow[];
  added?: number;
  already?: number;
  skipped?: number;
  error?: string;
}

const AREA_DEFAULT = "Dallas, TX";

export async function runBuild(_prev: BuildState, formData: FormData): Promise<BuildState> {
  await requireOps();
  const industry = String(formData.get("industry") ?? "").trim().slice(0, 80);
  const area = (String(formData.get("area") ?? "").trim() || AREA_DEFAULT).slice(0, 80);
  const max = Math.min(60, Math.max(20, Number(formData.get("max") ?? 20) || 20));
  if (!industry) return { error: "Type an industry, like plumbing or HVAC." };

  const query = `${industry} companies in ${area}`;
  let places: PlaceRow[];
  try {
    places = await searchPlaces(query, max);
  } catch (e) {
    return { query, error: e instanceof Error ? e.message : "Places search failed" };
  }

  const db = supabaseAdmin();
  const ids = places.map((p) => p.placeId);
  const { data: existing } = await db.from("companies").select("google_place_id").in("google_place_id", ids);
  const known = new Set((existing ?? []).map((r: { google_place_id: string }) => r.google_place_id));

  const rows: BuildResultRow[] = [];
  let added = 0, already = 0, skipped = 0;

  for (const p of places) {
    const base = { name: p.name, city: p.city, website: p.website, phone: p.phone };
    if (known.has(p.placeId)) { rows.push({ ...base, outcome: "already" }); already++; continue; }
    if (p.businessStatus && p.businessStatus !== "OPERATIONAL") { rows.push({ ...base, outcome: "closed" }); skipped++; continue; }
    if (!isOwnWebsite(p.website)) { rows.push({ ...base, outcome: "no_site" }); skipped++; continue; }

    const slug = await uniqueSlug(p.name, p.city);
    const { error } = await db.from("companies").insert({
      slug,
      name: p.name,
      website: p.website,
      phone: p.phone,
      address: p.address,
      city: p.city,
      industry: industry.toLowerCase(),
      google_place_id: p.placeId,
    });
    if (error) {
      console.error("[build] insert failed", p.name, error.message);
      rows.push({ ...base, outcome: "no_site" }); skipped++;
      continue;
    }
    rows.push({ ...base, outcome: "added" }); added++;
  }

  return { query, rows, added, already, skipped };
}

// Slug is the public page address, so it has to be unique and readable. Name first, then name
// and city, then a counter. Checked against the table rather than guessed.
async function uniqueSlug(name: string, city: string | null): Promise<string> {
  const db = supabaseAdmin();
  const base = slugify(name);
  const candidates = [base, city ? `${base}-${slugify(city)}` : null, ...[2, 3, 4, 5].map((n) => `${base}-${n}`)].filter(
    (s): s is string => !!s,
  );
  const { data } = await db.from("companies").select("slug").in("slug", candidates);
  const taken = new Set((data ?? []).map((r: { slug: string }) => r.slug));
  for (const c of candidates) if (!taken.has(c)) return c;
  return `${base}-${Date.now().toString(36)}`;
}
