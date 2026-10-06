// Apollo API. People search (mixed_people/api_search, no credits) returns first name, title and a
// has_email flag only: no last name, no email, no company size. The reveal (people/match, 1 credit
// if an email comes back, 0 for a contact this account already unlocked) fills those in.
// Nothing here asks for phone numbers, which cost 8 more.

const BASE = "https://api.apollo.io/api/v1";

export interface ApolloPerson {
  id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  email: string | null;
  email_status: string | null; // verified, likely to engage, unavailable, ...
  employee_count: number | null;
}

// Who buys hats for a crew of 30 to 500. Ordered by how much we want them.
export const TITLE_RANK = [
  "owner", "president", "ceo", "chief executive", "founder", "co-founder", "general manager",
  "managing partner", "partner", "operations manager", "director of operations", "office manager",
  "vice president", "vp", "hr", "human resources", "marketing",
];

function headers(): HeadersInit {
  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new Error("APOLLO_API_KEY is not set");
  return { "Content-Type": "application/json", "Cache-Control": "no-cache", "x-api-key": key };
}

export function titleScore(title: string | null): number {
  if (!title) return TITLE_RANK.length;
  const t = title.toLowerCase();
  const i = TITLE_RANK.findIndex((k) => t.includes(k));
  return i === -1 ? TITLE_RANK.length : i;
}

export interface ApolloCandidate {
  id: string;
  first_name: string | null;
  title: string | null;
  has_email: boolean;
}

export async function searchPeople(domain: string): Promise<ApolloCandidate[]> {
  const res = await fetch(`${BASE}/mixed_people/api_search`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      q_organization_domains_list: [domain],
      person_titles: TITLE_RANK,
      per_page: 10,
      page: 1,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Apollo search ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as {
    people?: Array<{ id: string; first_name?: string; title?: string; has_email?: boolean }>;
  };
  return (json.people ?? []).map((p) => ({
    id: p.id,
    first_name: p.first_name ?? null,
    title: p.title ?? null,
    has_email: p.has_email === true,
  }));
}

export async function revealEmail(personId: string): Promise<ApolloPerson | null> {
  const res = await fetch(`${BASE}/people/match?reveal_personal_emails=false&reveal_phone_number=false`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ id: personId }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Apollo match ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as {
    person?: {
      id: string; first_name?: string; last_name?: string; title?: string; email?: string;
      email_status?: string; organization?: { estimated_num_employees?: number };
    };
  };
  const p = json.person;
  if (!p) return null;
  return {
    id: p.id,
    first_name: p.first_name ?? null,
    last_name: p.last_name ?? null,
    title: p.title ?? null,
    email: p.email && !p.email.includes("email_not_unlocked") ? p.email : null,
    email_status: p.email_status ?? null,
    employee_count: p.organization?.estimated_num_employees ?? null,
  };
}
