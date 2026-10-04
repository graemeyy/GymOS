export interface CatalogueVariant {
  id: string;
  label: string;
  priceCents: number;
  available: boolean;
  lowStock: boolean;
  maxQuantity: number;
}

export interface CatalogueProduct {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: "APPAREL" | "SUPPLEMENTS" | "ACCESSORIES" | "OTHER";
  imageUrl: string | null;
  variants: CatalogueVariant[];
}

export interface Catalogue {
  discountPercent: number;
  signedIn: boolean;
  shipping: { pickupOnly: boolean; flatCents: number; freeOverCents: number | null };
  changeOfMindReturnsDays: number;
  products: CatalogueProduct[];
}
