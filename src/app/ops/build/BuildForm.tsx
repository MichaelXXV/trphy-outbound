"use client";

import { useActionState } from "react";
import { runBuild, type BuildState } from "./actions";

const PRESETS = [
  "plumbing", "HVAC", "electrical", "roofing", "landscaping", "concrete", "general contractor",
  "fencing", "pool", "pest control", "insurance agency", "auto repair", "moving", "tree service",
];

const OUTCOME_LABEL: Record<string, string> = {
  added: "Added",
  already: "Already on file",
  no_site: "No website of its own",
  closed: "Closed",
};

export default function BuildForm() {
  const [state, action, pending] = useActionState<BuildState, FormData>(runBuild, {});
  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="card flex flex-col gap-4">
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-steel">Industry</span>
            <input name="industry" className="field" list="industries" placeholder="plumbing" required autoFocus />
            <datalist id="industries">
              {PRESETS.map((p) => <option key={p} value={p} />)}
            </datalist>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-steel">Area</span>
            <input name="area" className="field" defaultValue="Dallas, TX" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-steel">How many</span>
            <select name="max" className="field" defaultValue="20">
              <option value="20">20</option>
              <option value="40">40</option>
              <option value="60">60</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="submit"
              name="industry"
              value={p}
              className="btn btn-ghost !min-h-9 !px-3 text-sm"
              disabled={pending}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-brass" disabled={pending}>{pending ? "Searching" : "Find companies"}</button>
          <span className="text-sm text-steel">Each run is one to three Google calls. Companies without a website of their own are skipped.</span>
        </div>
        {state.error && <p className="text-bad">{state.error}</p>}
      </form>

      {state.rows && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="font-semibold">{state.query}</h2>
            <span className="text-good">{state.added} added</span>
            <span className="text-steel">{state.already} already on file</span>
            <span className="text-steel">{state.skipped} skipped</span>
          </div>
          <div className="card !p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-steel">
                <tr className="border-b border-line">
                  <th className="p-3">Company</th>
                  <th className="p-3">City</th>
                  <th className="p-3">Website</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Result</th>
                </tr>
              </thead>
              <tbody>
                {state.rows.map((r, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3">{r.city ?? ""}</td>
                    <td className="p-3">
                      {r.website ? <a href={r.website} target="_blank" rel="noreferrer" className="text-brass-deep underline">{r.website.replace(/^https?:\/\/(www\.)?/, "")}</a> : <span className="text-steel">none</span>}
                    </td>
                    <td className="p-3">{r.phone ?? ""}</td>
                    <td className={`p-3 ${r.outcome === "added" ? "text-good" : "text-steel"}`}>{OUTCOME_LABEL[r.outcome]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
