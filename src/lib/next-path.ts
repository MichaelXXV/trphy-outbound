// Where to land after login. An allowlist of path characters, one leading slash, ops only.
// It is an allowlist rather than a strip list because a `next` value arrives in a URL anybody can write.
export function safeNext(raw: string | undefined | null): string {
  if (!raw) return "/ops";
  if (!/^\/ops(\/[A-Za-z0-9_\-\/?=&]*)?$/.test(raw)) return "/ops";
  if (raw.startsWith("//")) return "/ops";
  return raw;
}
