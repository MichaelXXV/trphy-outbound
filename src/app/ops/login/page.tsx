import { redirect } from "next/navigation";
import { currentOps } from "@/lib/ops-auth";
import { safeNext } from "@/lib/next-path";
import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await currentOps()) redirect(safeNext(next));
  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <p className="heading text-2xl">TRPHY</p>
          <p className="text-steel">Outbound</p>
        </div>
        <LoginForm next={safeNext(next)} />
      </div>
    </main>
  );
}
