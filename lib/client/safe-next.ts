// Only same-site relative paths are accepted as a post-login destination.
export function safeNext(value: string | null, fallback: string, prefix: string): string {
  // Backslashes are rejected too: some browsers treat "/\host" like "//host".
  if (!value || !value.startsWith(prefix) || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
