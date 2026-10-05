import { after } from "next/server";
import { env } from "@/lib/env";
import { emailConfigured, sendEmail, type EmailMessage } from "./index";

// Whether a link that couldn't be emailed may be shown on screen instead
// (D-115): in development and on previews, so the flows can be tried without
// an email provider; never on production, where showing it would let anyone
// reset anyone's password. A local production build (the end-to-end tests)
// opts in with SHOW_EMAIL_LINKS=true.
export function emailLinksMayShowOnScreen(): boolean {
  const e = env();
  if (e.VERCEL_ENV === "production") return false;
  if (e.VERCEL_ENV) return true;
  if (e.NODE_ENV !== "production") return true;
  return e.SHOW_EMAIL_LINKS === "true";
}

/** True when a link will go on screen rather than by email. */
export function linksGoOnScreen(): boolean {
  return !emailConfigured() && emailLinksMayShowOnScreen();
}

// Runs a task after the response has been sent, where Next supports it, so
// the response time doesn't depend on what the task finds. Outside a request
// (tests, scripts) it runs straight away. Failures are logged, not thrown:
// nobody is waiting for them.
export async function runAfterResponse(task: () => Promise<unknown>) {
  const safe = async () => {
    try {
      await task();
    } catch (error) {
      console.error(`Background task failed: ${error instanceof Error ? error.name : "unknown"}`);
    }
  };
  try {
    after(safe);
  } catch {
    await safe();
  }
}

// Sends an email containing a single-use link. With no email provider, the
// link comes back for the screen where that's allowed, and is otherwise
// dropped (the person can ask again once email is set up).
export async function sendLinkEmail(message: EmailMessage, link: string): Promise<{ previewLink: string | null }> {
  if (emailConfigured()) {
    await sendEmail(message);
    return { previewLink: null };
  }
  console.info(`Email not sent (no RESEND_API_KEY): "${message.subject}"`);
  return { previewLink: emailLinksMayShowOnScreen() ? link : null };
}
