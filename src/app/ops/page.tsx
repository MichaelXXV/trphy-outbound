import Link from "next/link";
import { requireOps } from "@/lib/ops-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const STATUSES = ["new", "reviewed", "approved", "sent", "replied", "quoted", "won", "lost"] as const;

const TILES: { href: string; title: string; blurb: string; ready: boolean }[] = [
  { href: "/ops/build", title: "Build a list", blurb: "Industry and area in, companies out.", ready: true },
  { href: "/ops/review", title: "Review queue", blurb: "Mockup, person, email, logo grade. Approve or skip.", ready: false },
  { href: "/ops/leads", title: "Leads", blurb: "Every lead by status. Replies, quotes, outcomes.", ready: false },
  { href: "/ops/campaigns", title: "Campaigns", blurb: "Push approved leads to Instantly.", ready: false },
];

export default async function OpsHome() {
  await requireOps();
  const db = supabaseAdmin();
  const { data } = await db.from("leads").select("status");
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { status: string }[]) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="heading text-sm text-steel mb-3">Pipeline</h1>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {STATUSES.map((s) => (
            <div key={s} className="card text-center !p-3">
              <div className="text-2xl font-semibold">{counts.get(s) ?? 0}</div>
              <div className="text-sm text-steel capitalize">{s}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="heading text-sm text-steel mb-3">Work</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {TILES.map((t) =>
            t.ready ? (
              <Link key={t.href} href={t.href} className="card hover:border-brass transition-colors">
                <div className="font-semibold">{t.title}</div>
                <div className="text-steel text-sm">{t.blurb}</div>
              </Link>
            ) : (
              <div key={t.href} className="card opacity-60">
                <div className="font-semibold">
                  {t.title} <span className="text-sm text-steel font-normal">next</span>
                </div>
                <div className="text-steel text-sm">{t.blurb}</div>
              </div>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
