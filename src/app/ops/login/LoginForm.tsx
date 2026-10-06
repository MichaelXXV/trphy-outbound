"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});
  return (
    <form action={action} className="card flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1">
        <span className="text-sm text-steel">Your name</span>
        <input name="name" className="field" autoComplete="given-name" autoFocus required />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-steel">Password</span>
        <input name="password" type="password" className="field" autoComplete="current-password" required />
      </label>
      {state.error && <p className="text-bad text-sm">{state.error}</p>}
      <button className="btn btn-brass" disabled={pending}>
        {pending ? "One moment" : "Sign in"}
      </button>
    </form>
  );
}
