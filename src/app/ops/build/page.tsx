import Link from "next/link";
import { requireOps } from "@/lib/ops-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import BuildForm from "./BuildForm";

export default async function BuildPage() {
  await requireOps();
  const { count } = await supabaseAdmin().from("companies").select("id", { count: "exact", head: true });
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="heading text-sm text-steel">Build a list</h1>
        <Link href="/ops/companies" className="text-sm underline text-brass-deep">{count ?? 0} companies on file</Link>
      </div>
      <BuildForm />
    </div>
  );
}
