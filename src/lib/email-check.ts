// Michael's verification rules, 2026-10-06:
// - Apollo's own "verified" counts as verified, no second check.
// - ok: verified.
// - catch_all: allowed through (most small trade companies run catch-all mailboxes) but flagged.
// - unknown: one retry a day later, then the lead is held.
// - invalid or disposable: the email goes on the suppression list, the lead is lost, "bad email".

import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyEmail, type MvResult } from "@/lib/millionverifier";
import type { Person } from "@/lib/types";

const RETRY_AFTER_MS = 24 * 60 * 60 * 1000;
const OPEN = ["new", "reviewed", "held"];

export type CheckOutcome =
  | { email: string; result: MvResult; action: "verified" | "flagged" | "retry_tomorrow" | "held" | "suppressed" }
  | { email: string; result: "error"; message: string };

// People who need a check now: never checked, or unknown once and a day has passed.
export async function peopleDueForCheck(limit: number): Promise<Person[]> {
  const db = supabaseAdmin();
  const { data: fresh } = await db
    .from("people").select("*")
    .is("email_check", null).eq("email_verified", false)
    .order("created_at", { ascending: true }).limit(limit);
  const cutoff = new Date(Date.now() - RETRY_AFTER_MS).toISOString();
  const { data: retries } = await db
    .from("people").select("*")
    .eq("email_check", "unknown").eq("email_check_attempts", 1).lt("email_checked_at", cutoff)
    .order("email_checked_at", { ascending: true }).limit(limit);
  return [...((fresh ?? []) as Person[]), ...((retries ?? []) as Person[])].slice(0, limit);
}

export async function checkPerson(person: Person): Promise<CheckOutcome> {
  const db = supabaseAdmin();
  let result: MvResult;
  try {
    result = (await verifyEmail(person.email)).result;
  } catch (e) {
    return { email: person.email, result: "error", message: e instanceof Error ? e.message : "failed" };
  }

  const now = new Date().toISOString();
  const attempts = person.email_check_attempts + 1;
  const passes = result === "ok" || result === "catch_all";
  await db.from("people").update({
    email_check: result,
    email_checked_at: now,
    email_check_attempts: attempts,
    email_verified: passes,
    email_verified_at: passes ? now : null,
  }).eq("id", person.id);

  const { data: leadRows } = await db.from("leads").select("id, status, hold_reason").eq("person_id", person.id).in("status", OPEN);
  const leads = (leadRows ?? []) as { id: string; status: string; hold_reason: string | null }[];
  const log = (kind: string, detail: Record<string, unknown>) =>
    leads.length ? db.from("lead_events").insert(leads.map((l) => ({ lead_id: l.id, kind, actor: "system", detail }))) : null;

  if (passes) {
    // A retry that came back good releases a lead held for its email.
    const held = leads.filter((l) => l.status === "held" && l.hold_reason === "email unknown");
    if (held.length) await db.from("leads").update({ status: "new", hold_reason: null }).in("id", held.map((l) => l.id));
    await log("email_checked", { result });
    return { email: person.email, result, action: result === "ok" ? "verified" : "flagged" };
  }

  if (result === "unknown") {
    if (attempts < 2) {
      await log("email_checked", { result, retry: "tomorrow" });
      return { email: person.email, result, action: "retry_tomorrow" };
    }
    if (leads.length) await db.from("leads").update({ status: "held", hold_reason: "email unknown" }).in("id", leads.map((l) => l.id));
    await log("held", { reason: "email unknown", attempts });
    return { email: person.email, result, action: "held" };
  }

  // invalid or disposable
  const email = person.email.toLowerCase();
  await db.from("suppressions").upsert({ email, reason: "bad_email", source: "millionverifier" }, { onConflict: "email", ignoreDuplicates: true });
  const { data: same } = await db.from("people").select("id").eq("email", email);
  const ids = (same ?? []).map((r: { id: string }) => r.id);
  const { data: lost } = await db.from("leads").update({ status: "lost", lost_reason: "bad email" })
    .in("person_id", ids).in("status", OPEN).select("id");
  if (lost?.length) await db.from("lead_events").insert(lost.map((l: { id: string }) => ({ lead_id: l.id, kind: "lost", actor: "system", detail: { reason: "bad email", result } })));
  return { email: person.email, result, action: "suppressed" };
}
