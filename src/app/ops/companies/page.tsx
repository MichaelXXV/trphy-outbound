import { requireOps } from "@/lib/ops-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Company, Person } from "@/lib/types";
import FindPeople from "./FindPeople";
import CheckEmails from "./CheckEmails";
import FetchLogos from "./FetchLogos";

// Five logos graded side by side can take a minute or two.
export const maxDuration = 300;

const GRADE_TONE: Record<string, string> = { usable: "text-good", needs_cleanup: "text-amber", not_pvc: "text-bad" };

const CHECK_LABEL: Record<string, { text: string; tone: string }> = {
  apollo_verified: { text: "verified (Apollo)", tone: "text-good" },
  ok: { text: "verified", tone: "text-good" },
  catch_all: { text: "catch-all, flagged", tone: "text-amber" },
  unknown: { text: "unknown", tone: "text-amber" },
  invalid: { text: "invalid, suppressed", tone: "text-bad" },
  disposable: { text: "disposable, suppressed", tone: "text-bad" },
};

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ industry?: string }> }) {
  await requireOps();
  const { industry = "" } = await searchParams;
  const db = supabaseAdmin();
  let q = db.from("companies").select("*").order("created_at", { ascending: false }).limit(500);
  if (industry) q = q.eq("industry", industry);
  const { data } = await q;
  const companies = (data ?? []) as Company[];

  const { data: peopleRows } = await db.from("people").select("*").in("company_id", companies.map((c) => c.id));
  const personByCompany = new Map<string, Person>();
  for (const p of (peopleRows ?? []) as Person[]) if (!personByCompany.has(p.company_id)) personByCompany.set(p.company_id, p);

  const { data: indRows } = await db.from("companies").select("industry");
  const industries = Array.from(new Set((indRows ?? []).map((r: { industry: string | null }) => r.industry).filter(Boolean))) as string[];
  const remaining = companies.filter((c) => !personByCompany.has(c.id) && c.website).length;
  const logosRemaining = companies.filter((c) => !c.logo_fetched_at && c.website).length;

  const logoPaths = companies.map((c) => c.logo_path).filter((p): p is string => !!p);
  const { data: signed } = logoPaths.length
    ? await db.storage.from("logos").createSignedUrls(logoPaths, 60 * 60)
    : { data: [] };
  const logoUrl = new Map<string, string>();
  for (const s of signed ?? []) if (s.path && s.signedUrl) logoUrl.set(s.path, s.signedUrl);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="heading text-sm text-steel">Companies</h1>
      <div className="flex flex-wrap gap-2 text-sm">
        <a href="/ops/companies" className={`btn btn-ghost !min-h-9 !px-3 ${!industry ? "border-brass" : ""}`}>All</a>
        {industries.sort().map((i) => (
          <a key={i} href={`/ops/companies?industry=${encodeURIComponent(i)}`} className={`btn btn-ghost !min-h-9 !px-3 ${industry === i ? "border-brass" : ""}`}>{i}</a>
        ))}
      </div>

      <FindPeople industry={industry} remaining={remaining} />
      <CheckEmails />
      <FetchLogos industry={industry} remaining={logosRemaining} />

      <div className="card !p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-steel">
            <tr className="border-b border-line">
              <th className="p-3">Company</th>
              <th className="p-3">Industry</th>
              <th className="p-3">City</th>
              <th className="p-3">Size</th>
              <th className="p-3">Person</th>
              <th className="p-3">Email</th>
              <th className="p-3">Logo</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => {
              const p = personByCompany.get(c.id);
              return (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="p-3">
                    <div className="font-medium">{c.name}</div>
                    {c.website && <a href={c.website} target="_blank" rel="noreferrer" className="text-brass-deep underline text-xs">{c.website.replace(/^https?:\/\/(www\.)?/, "")}</a>}
                  </td>
                  <td className="p-3">{c.industry}</td>
                  <td className="p-3">{c.city}</td>
                  <td className="p-3">{c.employee_count ?? ""}</td>
                  <td className="p-3">
                    {p ? (
                      <>
                        <div>{[p.first_name, p.last_name].filter(Boolean).join(" ") || <span className="text-steel">general inbox</span>}</div>
                        {p.title && <div className="text-xs text-steel">{p.title}</div>}
                      </>
                    ) : (
                      <span className="text-steel">none yet</span>
                    )}
                  </td>
                  <td className="p-3">
                    {p && (
                      <>
                        <div className="font-mono text-xs">{p.email}</div>
                        {(() => {
                          const l = (p.email_check && CHECK_LABEL[p.email_check]) || { text: "not checked", tone: "text-steel" };
                          return <div className={`text-xs ${l.tone}`}>{l.text}</div>;
                        })()}
                      </>
                    )}
                  </td>
                  <td className="p-3">
                    {c.logo_path && logoUrl.get(c.logo_path) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl.get(c.logo_path)} alt={`${c.name} logo`} className="h-12 w-24 object-contain rounded bg-[#808080] p-1" />
                    )}
                    <div className={`text-xs ${c.logo_grade ? GRADE_TONE[c.logo_grade] : "text-steel"}`} title={c.logo_notes ?? undefined}>
                      {c.logo_grade ? c.logo_grade.replace("_", " ") : c.logo_fetched_at ? "no logo found" : "not fetched"}
                    </div>
                  </td>
                </tr>
              );
            })}
            {companies.length === 0 && (
              <tr><td className="p-6 text-steel" colSpan={7}>Nothing yet. Build a list first.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
