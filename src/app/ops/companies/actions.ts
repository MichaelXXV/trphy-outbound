"use server";

import { revalidatePath } from "next/cache";
import { requireOps } from "@/lib/ops-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revealEmail, searchPeople, titleScore } from "@/lib/apollo";
import { findSiteEmails } from "@/lib/site-email";
import { websiteDomain } from "@/lib/places";
import { checkPerson, peopleDueForCheck, type CheckOutcome } from "@/lib/email-check";
import { fetchLogoFor, type LogoOutcome } from "@/lib/logo-fetch";
import type { Company, Person } from "@/lib/types";

export type FindOutcome =
  | { company: string; result: "person"; who: string; email: string; check: string; credits: number }
  | { company: string; result: "site_email"; email: string; check: string; credits: number }
  | { company: string; result: "nothing"; credits: number }
  | { company: string; result: "skipped"; reason: string }
  | { company: string; result: "error"; message: string };

// One company: Apollo for a named buyer, the website as the fallback. Writes the person and
// opens a lead in `new`. A company that already has a person is left alone.
export async function findPersonFor(company: Company): Promise<FindOutcome> {
  const db = supabaseAdmin();
  const domain = websiteDomain(company.website);
  if (!domain) return { company: company.name, result: "skipped", reason: "no website" };

  const { count } = await db.from("people").select("id", { count: "exact", head: true }).eq("company_id", company.id);
  if ((count ?? 0) > 0) return { company: company.name, result: "skipped", reason: "already has a person" };

  let credits = 0;
  try {
    const candidates = await searchPeople(domain);
    const ranked = candidates
      .filter((c) => c.has_email)
      .sort((a, b) => titleScore(a.title) - titleScore(b.title));

    for (const c of ranked.slice(0, 2)) {
      const p = await revealEmail(c.id);
      if (!p?.email) continue;
      credits += 1;
      if (p.employee_count != null && company.employee_count == null) {
        await db.from("companies").update({ employee_count: p.employee_count }).eq("id", company.id);
      }
      const verified = p.email_status === "verified";
      const person = await savePerson(company, {
        first_name: p.first_name, last_name: p.last_name, title: p.title ?? c.title, email: p.email, verified, apollo_person_id: p.id,
      });
      const check = verified ? "Apollo verified" : checkLabel(await checkPerson(person));
      return { company: company.name, result: "person", who: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed", email: p.email, check, credits };
    }
  } catch (e) {
    console.error("[people] apollo failed for", company.name, e);
  }

  const siteEmails = company.website ? await findSiteEmails(company.website, domain) : [];
  if (siteEmails[0]) {
    const person = await savePerson(company, { first_name: null, last_name: null, title: null, email: siteEmails[0], verified: false, apollo_person_id: null });
    return { company: company.name, result: "site_email", email: siteEmails[0], check: checkLabel(await checkPerson(person)), credits };
  }
  return { company: company.name, result: "nothing", credits };
}

async function savePerson(
  company: Company,
  p: { first_name: string | null; last_name: string | null; title: string | null; email: string; verified: boolean; apollo_person_id: string | null },
): Promise<Person> {
  const db = supabaseAdmin();
  const email = p.email.toLowerCase();
  const { data: suppressed } = await db.from("suppressions").select("email").eq("email", email).maybeSingle();
  const { data: person, error } = await db
    .from("people")
    .insert({
      company_id: company.id,
      first_name: p.first_name,
      last_name: p.last_name,
      title: p.title,
      email,
      email_verified: p.verified,
      email_verified_at: p.verified ? new Date().toISOString() : null,
      email_check: p.verified ? "apollo_verified" : null,
      email_checked_at: p.verified ? new Date().toISOString() : null,
      apollo_person_id: p.apollo_person_id,
    })
    .select("*")
    .single();
  if (error || !person) throw new Error(error?.message ?? "person insert failed");

  const { data: lead } = await db
    .from("leads")
    .insert({
      company_id: company.id,
      person_id: person.id,
      campaign: company.is_existing_customer ? "warm" : "cold",
      status: suppressed ? "suppressed" : "new",
    })
    .select("id")
    .single();
  if (lead) await db.from("lead_events").insert({ lead_id: lead.id, kind: "created", actor: "system", detail: { source: p.apollo_person_id ? "apollo" : "website" } });
  return person as Person;
}

function checkLabel(o: CheckOutcome): string {
  if (o.result === "error") return `not checked, ${o.message}`;
  switch (o.action) {
    case "verified": return "verified";
    case "flagged": return "catch-all, allowed but flagged";
    case "retry_tomorrow": return "unknown, retry tomorrow";
    case "held": return "unknown twice, lead held";
    case "suppressed": return `${o.result}, suppressed, lead lost`;
  }
}

export interface CheckState {
  lines?: string[];
  error?: string;
}

const CHECK_BATCH = 10;

// The Check emails button. Unchecked emails first, then unknowns whose day has passed.
export async function checkEmailsBatch(): Promise<CheckState> {
  await requireOps();
  const due = await peopleDueForCheck(CHECK_BATCH);
  if (due.length === 0) return { lines: [], error: "No emails are due for a check." };
  const lines: string[] = [];
  for (const p of due) lines.push(`${p.email}: ${checkLabel(await checkPerson(p))}`);
  revalidatePath("/ops/companies");
  revalidatePath("/ops");
  return { lines };
}

export interface FindState {
  outcomes?: FindOutcome[];
  credits?: number;
  error?: string;
}

const BATCH = 5;

// The button on the companies screen. Five companies per press, oldest first, so a slow site
// cannot hang the request past what Vercel allows.
export async function findPeopleBatch(_prev: FindState, formData: FormData): Promise<FindState> {
  await requireOps();
  const db = supabaseAdmin();
  const industry = String(formData.get("industry") ?? "");
  const only = String(formData.get("company_id") ?? "");

  let q = db.from("companies").select("*").order("created_at", { ascending: true });
  if (only) q = q.eq("id", only);
  else if (industry) q = q.eq("industry", industry);
  const { data } = await q.limit(200);
  const companies = (data ?? []) as Company[];

  const { data: havePeople } = await db.from("people").select("company_id");
  const done = new Set((havePeople ?? []).map((r: { company_id: string }) => r.company_id));
  const todo = companies.filter((c) => !done.has(c.id)).slice(0, only ? 1 : BATCH);
  if (todo.length === 0) return { outcomes: [], credits: 0, error: "Every company here already has a person." };

  const outcomes: FindOutcome[] = [];
  for (const c of todo) {
    try {
      outcomes.push(await findPersonFor(c));
    } catch (e) {
      outcomes.push({ company: c.name, result: "error", message: e instanceof Error ? e.message : "failed" });
    }
  }
  revalidatePath("/ops/companies");
  revalidatePath("/ops");
  return { outcomes, credits: outcomes.reduce((n, o) => n + ("credits" in o ? o.credits : 0), 0) };
}

export interface LogoState {
  outcomes?: (LogoOutcome | { company: string; result: "error"; message: string })[];
  error?: string;
}

const LOGO_BATCH = 5;

// The Fetch logos button. Five companies per press, side by side, oldest first; a company is
// tried once (logo_fetched_at), found or not.
export async function fetchLogosBatch(_prev: LogoState, formData: FormData): Promise<LogoState> {
  await requireOps();
  const db = supabaseAdmin();
  const industry = String(formData.get("industry") ?? "");
  let q = db.from("companies").select("*").is("logo_fetched_at", null).not("website", "is", null)
    .order("created_at", { ascending: true }).limit(LOGO_BATCH);
  if (industry) q = q.eq("industry", industry);
  const { data } = await q;
  const todo = (data ?? []) as Company[];
  if (todo.length === 0) return { outcomes: [], error: "Every company here has had its logo fetched." };

  const outcomes = await Promise.all(todo.map((c) =>
    fetchLogoFor(c).catch((e) => {
      console.error("[logo] failed for", c.name, e);
      return { company: c.name, result: "error" as const, message: e instanceof Error ? e.message : "failed" };
    })));
  revalidatePath("/ops/companies");
  return { outcomes };
}
