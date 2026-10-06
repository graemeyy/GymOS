// What each kind of import reads (D-130). No imports, so the column-mapping
// screen in the browser uses the same list as the server.

export const IMPORT_KINDS = ["members", "plans", "memberships"] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export interface ImportField {
  key: string;
  label: string;
  required: boolean;
  /** What a value looks like, for the mapping screen. */
  hint: string;
  /** Column headings that probably mean this field, lowercased, without punctuation. */
  aliases: string[];
}

export const IMPORT_KIND_TEXT: Record<ImportKind, { title: string; description: string }> = {
  members: { title: "Members", description: "People, with their contact details. Each gets an email to set their password." },
  plans: { title: "Plans", description: "Membership plans, with prices and what's included." },
  memberships: { title: "Memberships", description: "Who is on which plan, and what they've paid up to. Import members and plans first." },
};

export const IMPORT_FIELDS: Record<ImportKind, ImportField[]> = {
  members: [
    { key: "email", label: "Email", required: true, hint: "Each member's own address. One row per member.", aliases: ["email", "email address", "e mail", "emailaddress", "contact email"] },
    { key: "name", label: "Full name", required: false, hint: "Or map first and last name instead.", aliases: ["name", "full name", "member name", "member", "fullname"] },
    { key: "firstName", label: "First name", required: false, hint: "Used with last name when there's no full name.", aliases: ["first name", "firstname", "given name", "first"] },
    { key: "lastName", label: "Last name", required: false, hint: "Used with first name when there's no full name.", aliases: ["last name", "lastname", "surname", "family name", "last"] },
    { key: "homeLocation", label: "Home location", required: false, hint: "A location's name or code. Empty means the main location.", aliases: ["home location", "location", "home club", "club", "site", "branch"] },
    { key: "joinedOn", label: "Member since", required: false, hint: "A date such as 2024-03-01 or 01/03/2024.", aliases: ["joined", "join date", "joined on", "member since", "start date", "created", "created at", "signup date"] },
    { key: "notes", label: "Staff note", required: false, hint: "Saved as a note on the member. Leave out anything about health or payment cards.", aliases: ["notes", "note", "comments", "comment"] },
  ],
  plans: [
    { key: "name", label: "Plan name", required: true, hint: "Plans with a name already in use are skipped.", aliases: ["name", "plan", "plan name", "membership", "membership type", "tier"] },
    { key: "price", label: "Price incl. GST", required: true, hint: "In dollars, such as 29.95.", aliases: ["price", "amount", "cost", "fee", "price incl gst", "price aud"] },
    { key: "interval", label: "Billed every", required: true, hint: "Week, fortnight, month or year.", aliases: ["interval", "billing", "billed", "frequency", "period", "billing period", "billing frequency"] },
    { key: "description", label: "What's included", required: false, hint: "A sentence for the plan list.", aliases: ["description", "details", "includes", "whats included"] },
    { key: "classCredits", label: "Classes per cycle", required: false, hint: "A number, or 'unlimited'. Empty means none.", aliases: ["classes", "class credits", "classes per cycle", "class allowance"] },
    { key: "guestPasses", label: "Guest passes per cycle", required: false, hint: "A number. Empty means none.", aliases: ["guest passes", "guests", "guest pass"] },
    { key: "shopDiscount", label: "Shop discount (%)", required: false, hint: "A whole number from 0 to 100.", aliases: ["shop discount", "discount", "discount percent", "member discount"] },
    { key: "guestRate", label: "Guest visit rate", required: false, hint: "In dollars. What a guest pays without a pass.", aliases: ["guest rate", "guest fee", "casual rate", "guest price"] },
    { key: "locations", label: "Locations covered", required: false, hint: "'all', 'home', or location names separated by semicolons. Empty means all.", aliases: ["locations", "location access", "access", "sites", "clubs"] },
  ],
  memberships: [
    { key: "email", label: "Member's email", required: true, hint: "Must match a member already in GymOS.", aliases: ["email", "email address", "member email", "e mail"] },
    { key: "plan", label: "Plan", required: true, hint: "A plan's name, as on the Plans page.", aliases: ["plan", "plan name", "membership", "membership type", "tier"] },
    { key: "paidUntil", label: "Paid until", required: true, hint: "The last day already paid for. Billing through Stripe starts the day after.", aliases: ["paid until", "paid to", "paid through", "next billing date", "next payment", "next payment date", "expiry", "expires", "renewal date", "end date"] },
    { key: "startedOn", label: "Membership started", required: false, hint: "A date. Empty means today. Minimum terms count from here.", aliases: ["started", "start date", "started on", "membership start", "joined", "join date"] },
    { key: "status", label: "Status", required: false, hint: "'active' or 'paused'. Empty means active.", aliases: ["status", "membership status", "state"] },
    { key: "pausedUntil", label: "Paused until", required: false, hint: "Needed for paused memberships.", aliases: ["paused until", "pause end", "pause until", "resume date", "resumes"] },
  ],
};

const normalise = (heading: string) =>
  heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// A first guess at which column holds each field, from the headings. The
// person checks and corrects it on the mapping screen.
export function suggestMapping(kind: ImportKind, headers: string[]): Record<string, number | null> {
  const taken = new Set<number>();
  const normalised = headers.map(normalise);
  const mapping: Record<string, number | null> = {};
  for (const field of IMPORT_FIELDS[kind]) {
    const exact = normalised.findIndex((h, i) => !taken.has(i) && (h === normalise(field.label) || field.aliases.includes(h)));
    mapping[field.key] = exact >= 0 ? exact : null;
    if (exact >= 0) taken.add(exact);
  }
  return mapping;
}
