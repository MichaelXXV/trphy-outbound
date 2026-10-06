import Link from "next/link";
import { currentOps } from "@/lib/ops-auth";
import { signOut } from "./login/actions";

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const session = await currentOps();
  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
          <Link href="/ops" className="heading">
            TRPHY <span className="text-steel font-normal tracking-normal normal-case">outbound</span>
          </Link>
          {session && (
            <form action={signOut} className="flex items-center gap-3 text-sm">
              <span className="text-steel">{session.name}</span>
              <button className="btn btn-ghost !min-h-9 !px-3">Sign out</button>
            </form>
          )}
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
