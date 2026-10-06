import { requireOps } from "@/lib/ops-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Company } from "@/lib/types";

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ industry?: string }> }) {
  await requireOps();
  const { industry } = await searchParams;
  const db = supabaseAdmin();
  let q = db.from("companies").select("*").order("created_at", { ascending: false }).limit(500);
  if (industry) q = q.eq("industry", industry);
  const { data } = await q;
  const companies = (data ?? []) as Company[];

  const { data: indRows } = await db.from("companies").select("industry");
  const industries = Array.from(new Set((indRows ?? []).map((r: { industry: string | null }) => r.industry).filter(Boolean))) as string[];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="heading text-sm text-steel">Companies</h1>
      <div className="flex flex-wrap gap-2 text-sm">
        <a href="/ops/companies" className={`btn btn-ghost !min-h-9 !px-3 ${!industry ? "border-brass" : ""}`}>All</a>
        {industries.sort().map((i) => (
          <a key={i} href={`/ops/companies?industry=${encodeURIComponent(i)}`} className={`btn btn-ghost !min-h-9 !px-3 ${industry === i ? "border-brass" : ""}`}>{i}</a>
        ))}
      </div>
      <div className="card !p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-steel">
            <tr className="border-b border-line">
              <th className="p-3">Company</th>
              <th className="p-3">Industry</th>
              <th className="p-3">City</th>
              <th className="p-3">Website</th>
              <th className="p-3">Logo</th>
              <th className="p-3">Page</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.industry}</td>
                <td className="p-3">{c.city}</td>
                <td className="p-3">{c.website ? <a href={c.website} target="_blank" rel="noreferrer" className="underline text-brass-deep">{c.website.replace(/^https?:\/\/(www\.)?/, "")}</a> : ""}</td>
                <td className="p-3 text-steel">{c.logo_grade ?? "not fetched"}</td>
                <td className="p-3 font-mono text-steel">/for/{c.slug}</td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr><td className="p-6 text-steel" colSpan={6}>Nothing yet. Build a list first.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
