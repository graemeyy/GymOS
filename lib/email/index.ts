import { env } from "@/lib/env";
import { getBranding } from "@/lib/branding/service";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  // Extra headers, such as List-Unsubscribe on optional emails (D-118).
  headers?: Record<string, string>;
}

export type SendResult = { sent: true; id: string | null } | { sent: false; reason: "not_configured" | "failed" };

let outboxForTests: (EmailMessage & { from: string })[] | null = null;

export function captureEmailsForTests(enable: boolean) {
  outboxForTests = enable ? [] : null;
}

export function capturedEmails(): (EmailMessage & { from: string })[] {
  return outboxForTests ?? [];
}

// Whether sendEmail will actually deliver (or, in tests, capture) mail.
export function emailConfigured(): boolean {
  return outboxForTests !== null || Boolean(env().RESEND_API_KEY);
}

// Sends through Resend's HTTP API. With no RESEND_API_KEY it does nothing and
// says so: the app works without email, and nothing is silently lost because
// every caller records what it tried to send.
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const from = await sender();
  if (outboxForTests) {
    outboxForTests.push({ ...message, from });
    return { sent: true, id: `test-${outboxForTests.length}` };
  }
  const key = env().RESEND_API_KEY;
  if (!key) {
    console.info(`Email not sent (no RESEND_API_KEY): "${message.subject}"`);
    return { sent: false, reason: "not_configured" };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.headers ? { headers: message.headers } : {}),
      }),
    });
    if (!response.ok) {
      console.error(`Resend rejected an email (${response.status}): "${message.subject}"`);
      return { sent: false, reason: "failed" };
    }
    const data = (await response.json().catch(() => ({}))) as { id?: string };
    return { sent: true, id: data.id ?? null };
  } catch {
    console.error(`Couldn't reach Resend for: "${message.subject}"`);
    return { sent: false, reason: "failed" };
  }
}

// The address in EMAIL_FROM ("Name <hello@gym.example>" or just the
// address), which must be on a domain verified with Resend.
function addressOf(value: string | undefined): string | null {
  if (!value) return null;
  const match = /<([^<>\s]+@[^<>\s]+)>/.exec(value);
  return match ? match[1] : value.includes("@") ? value.trim() : null;
}

// Who emails come from: the sender name on the Branding page (D-124) and the
// address from EMAIL_FROM, or the gym's contact email without one.
export async function sender(): Promise<string> {
  const b = await getBranding();
  return `${b.emailSenderName} <${addressOf(env().EMAIL_FROM) ?? b.contactEmail}>`;
}

// The footer from the Branding page, after every email's message.
export async function signature(): Promise<string> {
  const footer = (await getBranding()).emailFooter.trim();
  return footer ? `\n\n${footer}` : "";
}
