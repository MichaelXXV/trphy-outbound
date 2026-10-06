"use client";

import { useActionState } from "react";
import { checkEmailsBatch, type CheckState } from "./actions";

export default function CheckEmails() {
  const [state, action, pending] = useActionState<CheckState, FormData>(() => checkEmailsBatch(), {});
  return (
    <div className="card flex flex-col gap-3">
      <form action={action} className="flex flex-wrap items-center gap-3">
        <button className="btn btn-ghost" disabled={pending}>{pending ? "Checking" : "Check emails (10 at a time)"}</button>
        <span className="text-sm text-steel">MillionVerifier, one credit each. Apollo verified emails are skipped. Unknowns get one retry a day later.</span>
      </form>
      {state.error && <p className="text-steel">{state.error}</p>}
      {state.lines && state.lines.length > 0 && (
        <ul className="text-sm flex flex-col gap-1">
          {state.lines.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      )}
    </div>
  );
}
