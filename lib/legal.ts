import type { LegalDocument } from "@prisma/client";
import type { Db, Tx } from "@/lib/db";
import { gym } from "@/lib/config";

export function currentVersions(): Record<LegalDocument, string> {
  return { TERMS: gym.legal.termsVersion, PRIVACY: gym.legal.privacyVersion };
}

// Records that the member accepted the current terms and privacy policy.
// One row per document, so a later change to only one of them asks for that
// one again.
export async function recordAcceptance(db: Db | Tx, memberId: string, context: "signup" | "checkout" | "reaccept", documents: LegalDocument[] = ["TERMS", "PRIVACY"]) {
  const versions = currentVersions();
  await db.legalAcceptance.createMany({ data: documents.map((document) => ({ memberId, document, version: versions[document], context })) });
}

// Which current documents the member hasn't accepted yet. Members added by
// staff before online sign-up existed have accepted nothing online; they are
// asked once, the first time they use the member app.
export async function outstandingAcceptances(db: Db | Tx, memberId: string): Promise<LegalDocument[]> {
  const versions = currentVersions();
  const accepted = await db.legalAcceptance.findMany({
    where: { memberId, OR: (Object.keys(versions) as LegalDocument[]).map((document) => ({ document, version: versions[document] })) },
    select: { document: true },
  });
  const done = new Set(accepted.map((a) => a.document));
  return (Object.keys(versions) as LegalDocument[]).filter((d) => !done.has(d));
}
