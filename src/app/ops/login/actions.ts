"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_HOURS, freshExpiry, passwordMatches, signSession } from "@/lib/session";
import { safeNext } from "@/lib/next-path";

export interface LoginState {
  error?: string;
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!name) return { error: "Type your name." };
  if (!(await passwordMatches(password))) return { error: "That password is not right." };

  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession({ name, exp: freshExpiry() }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
  redirect(next);
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/ops/login");
}
