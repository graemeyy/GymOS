// What a pass looks like, for the browser's scanner as well as the server.
// No signing code here, so it's safe to import anywhere.
export const PASS_PREFIX = "GYM2.";
export const OLD_PASS_PREFIX = "GYM1.";

/** Whether a scanned or typed value is meant to be a pass, old or new. */
export function looksLikePass(value: string): boolean {
  return value.startsWith(PASS_PREFIX) || value.startsWith(OLD_PASS_PREFIX);
}
