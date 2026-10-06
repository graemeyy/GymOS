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

export interface CatalogueLocation {
  id: string;
  name: string;
  address: string;
}

export interface Catalogue {
  // Where stock is counted and the order is collected from (D-127): the one
  // asked for, else the member's home location, else the main location.
  location: CatalogueLocation;
  locations: CatalogueLocation[];
  discountPercent: number;
  signedIn: boolean;
  shipping: { pickupOnly: boolean; flatCents: number; freeOverCents: number | null };
  changeOfMindReturnsDays: number;
  products: CatalogueProduct[];
}
