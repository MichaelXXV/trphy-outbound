// MillionVerifier single-email API. One credit per check. A result of "error" (out of credits,
// timeout, bad key) is not an answer about the email and is never counted as an attempt.

export type MvResult = "ok" | "catch_all" | "unknown" | "invalid" | "disposable";

export interface MvAnswer {
  result: MvResult;
  subresult: string | null;
  role: boolean;
}

const RESULTS: MvResult[] = ["ok", "catch_all", "unknown", "invalid", "disposable"];

export async function verifyEmail(email: string): Promise<MvAnswer> {
  const key = process.env.MILLIONVERIFIER_API_KEY;
  if (!key) throw new Error("MILLIONVERIFIER_API_KEY is not set");
  const url = `https://api.millionverifier.com/api/v3/?api=${encodeURIComponent(key)}&email=${encodeURIComponent(email)}&timeout=20`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`MillionVerifier ${res.status}`);
  const json = (await res.json()) as { result?: string; subresult?: string; role?: boolean; error?: string };
  if (json.error) throw new Error(`MillionVerifier: ${json.error}`);
  const result = RESULTS.find((r) => r === json.result);
  if (!result) throw new Error(`MillionVerifier gave no answer (${json.result ?? "empty"})`);
  return { result, subresult: json.subresult || null, role: json.role === true };
}
