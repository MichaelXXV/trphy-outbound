// One company's logo, start to finish: candidates off the site, cleaned with sharp, graded by
// Claude, the pick stored in the logos bucket and on the company row.

import { supabaseAdmin } from "@/lib/supabase/admin";
import { fallbackCandidates, fetchPage, siteCandidates, type CandidateSource } from "@/lib/logo-candidates";
import { formatRank, loadCandidate, type LogoImage } from "@/lib/logo-image";
import { gradeCandidates, type Grade } from "@/lib/logo-grade";
import { websiteDomain } from "@/lib/places";
import type { Company } from "@/lib/types";

const MIN_LONG_SIDE = 300;  // under this a raster is needs_cleanup at best
const MAX_TO_GRADE = 6;
const SOURCE_RANK: Record<CandidateSource, number> = { site_logo: 0, og_image: 1, icon: 2, brandfetch: 3, logo_dev: 4 };

export type LogoOutcome =
  | { company: string; result: "graded"; grade: Grade; notes: string }
  | { company: string; result: "none"; notes: string };

const small = (l: LogoImage) => l.longSide != null && l.longSide < MIN_LONG_SIDE;

export async function fetchLogoFor(company: Company): Promise<LogoOutcome> {
  const db = supabaseAdmin();
  const domain = websiteDomain(company.website);
  const finish = async (fields: Record<string, unknown>) =>
    db.from("companies").update({ ...fields, logo_fetched_at: new Date().toISOString() }).eq("id", company.id);

  if (!company.website || !domain) {
    await finish({ logo_notes: "No website." });
    return { company: company.name, result: "none", notes: "No website." };
  }

  const page = await fetchPage(company.website);
  const found = page ? siteCandidates(page.html, page.finalUrl) : [];
  let images = await loadAll(found);

  // The paid fallbacks only when the site gave nothing at full size.
  if (images.length === 0 || images.every(small)) {
    images = dedupe([...images, ...(await loadAll(await fallbackCandidates(domain)))]);
  }

  images.sort((a, b) =>
    SOURCE_RANK[a.candidate.source] - SOURCE_RANK[b.candidate.source] ||
    formatRank(a) - formatRank(b) ||
    (b.longSide ?? 1e9) - (a.longSide ?? 1e9));
  images = images.slice(0, MAX_TO_GRADE);

  if (images.length === 0) {
    const notes = page ? "No logo image found on the site." : "The website did not load.";
    await finish({ logo_notes: notes });
    return { company: company.name, result: "none", notes };
  }

  const g = await gradeCandidates(company.name, images);
  if (!g) {
    await finish({ logo_notes: "The grader gave no answer. Try again or pick the logo by hand." });
    return { company: company.name, result: "none", notes: "The grader gave no answer." };
  }
  if (g.pick < 0) {
    const notes = `None of the ${images.length} images is the logo. ${g.notes}`;
    await finish({ logo_notes: notes });
    return { company: company.name, result: "none", notes };
  }

  const chosen = images[g.pick];
  let grade: Grade = g.grade;
  const notes = [g.notes];
  // Michael's hard limits, applied after the grader whatever it said.
  if (small(chosen) && grade === "usable") {
    grade = "needs_cleanup";
    notes.push(`Only ${chosen.longSide}px on the long side, needs a bigger file.`);
  }
  if (chosen.background === "complex" && grade === "usable") {
    grade = "needs_cleanup";
    notes.push("The background is not one flat colour, a person needs to remove it.");
  }

  const path = `${company.id}/logo.png`;
  const { error } = await db.storage.from("logos").upload(path, chosen.png, { contentType: "image/png", upsert: true });
  if (error) throw new Error(`logo upload: ${error.message}`);

  await finish({
    logo_path: path,
    logo_source_url: chosen.candidate.inlineSvg ? page?.finalUrl ?? company.website : chosen.candidate.url,
    logo_grade: grade,
    logo_notes: notes.join(" "),
    logo_colors: g.colors,
    logo_kind: g.kind,
  });
  return { company: company.name, result: "graded", grade, notes: notes.join(" ") };
}

async function loadAll(cands: Parameters<typeof loadCandidate>[0][]): Promise<LogoImage[]> {
  const loaded = await Promise.all(cands.map((c) => loadCandidate(c).catch(() => null)));
  return dedupe(loaded.filter((l): l is LogoImage => l != null));
}

function dedupe(images: LogoImage[]): LogoImage[] {
  const seen = new Set<string>();
  return images.filter((l) => (seen.has(l.hash) ? false : (seen.add(l.hash), true)));
}
