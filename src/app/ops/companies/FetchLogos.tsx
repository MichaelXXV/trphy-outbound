"use client";

import { useActionState } from "react";
import { fetchLogosBatch, type LogoState } from "./actions";

const TONE = { usable: "text-good", needs_cleanup: "text-amber", not_pvc: "text-bad" } as const;

export default function FetchLogos({ industry, remaining }: { industry: string; remaining: number }) {
  const [state, action, pending] = useActionState<LogoState, FormData>(fetchLogosBatch, {});
  return (
    <div className="card flex flex-col gap-3">
      <form action={action} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="industry" value={industry} />
        <button className="btn btn-ghost" disabled={pending || remaining === 0}>
          {pending ? "Fetching" : `Fetch logos (5 at a time, ${remaining} to go)`}
        </button>
        <span className="text-sm text-steel">Off the company website, graded for PVC by Claude. The real file is kept, never redrawn.</span>
      </form>
      {state.error && <p className="text-steel">{state.error}</p>}
      {state.outcomes && state.outcomes.length > 0 && (
        <ul className="text-sm flex flex-col gap-1">
          {state.outcomes.map((o, i) => (
            <li key={i}>
              <span className="font-medium">{o.company}:</span>{" "}
              {o.result === "graded" && <><span className={TONE[o.grade]}>{o.grade.replace("_", " ")}</span>. {o.notes}</>}
              {o.result === "none" && <span className="text-steel">{o.notes}</span>}
              {o.result === "error" && <span className="text-bad">{o.message}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
