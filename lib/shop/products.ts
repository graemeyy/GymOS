export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

// Phrases the app warns about in supplement descriptions. It doesn't block
// them: claims can be legitimate with the right approvals, and the owner is
// responsible. The note points to TGA and Food Standards rules.
const CLAIM_WORDS = ["cure", "treat", "prevent", "heal", "boost immunity", "burn fat", "fat burner", "detox", "testosterone", "clinically proven", "guaranteed results", "medical", "therapeutic", "weight loss"];

export function claimWarnings(text: string | null | undefined): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  return CLAIM_WORDS.filter((w) => lower.includes(w));
}

// Only supplements fall under the therapeutic-claim rules, so other
// products never carry warnings.
export function withClaimWarnings<P extends { category: string; description: string | null }>(product: P) {
  return { ...product, claimWarnings: product.category === "SUPPLEMENTS" ? claimWarnings(product.description) : [] };
}
