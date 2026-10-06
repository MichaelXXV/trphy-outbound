import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession, type OpsSession } from "./session";

// Every ops page and every server action calls this. The proxy gates the route, but a
// session alone is never trusted from the browser: the cookie is re-verified here.
export async function requireOps(): Promise<OpsSession> {
  const jar = await cookies();
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/ops/login");
  return session;
}

export async function currentOps(): Promise<OpsSession | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}
