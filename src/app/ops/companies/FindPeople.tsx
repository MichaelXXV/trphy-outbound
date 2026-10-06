"use client";

import { useActionState } from "react";
import { findPeopleBatch, type FindState } from "./actions";

export default function FindPeople({ industry, remaining }: { industry: string; remaining: number }) {
  const [state, action, pending] = useActionState<FindState, FormData>(findPeopleBatch, {});
  return (
    <div className="card flex flex-col gap-3">
      <form action={action} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="industry" value={industry} />
        <button className="btn btn-brass" disabled={pending || remaining === 0}>
          {pending ? "Finding" : `Find people (5 at a time, ${remaining} to go)`}
        </button>
        <span className="text-sm text-steel">Apollo first for a named buyer, the company website as the fallback. About two credits per company.</span>
      </form>
      {state.error && <p className="text-steel">{state.error}</p>}
      {state.outcomes && state.outcomes.length > 0 && (
        <ul className="text-sm flex flex-col gap-1">
          {state.outcomes.map((o, i) => (
            <li key={i}>
              <span className="font-medium">{o.company}:</span>{" "}
              {o.result === "person" && <span className="text-good">{o.who}, {o.email} ({o.check})</span>}
              {o.result === "site_email" && <span>{o.email} from the website ({o.check})</span>}
              {o.result === "nothing" && <span className="text-steel">nobody found</span>}
              {o.result === "skipped" && <span className="text-steel">skipped, {o.reason}</span>}
              {o.result === "error" && <span className="text-bad">{o.message}</span>}
            </li>
          ))}
          <li className="text-steel">Credits used this run: {state.credits}</li>
        </ul>
      )}
    </div>
  );
}
