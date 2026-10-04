import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { currentMemberId } from "@/lib/auth/server-session";
import { getCatalogue, getShopProductName } from "@/lib/shop/queries";
import { CATEGORY_TEXT } from "@/lib/shop/labels";
import { AddToCart } from "@/components/shop/add-to-cart";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: (await getShopProductName(slug)) ?? "Shop" };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const catalogue = await getCatalogue(await currentMemberId(), { slug });
  const product = catalogue.products[0];
  if (!product) notFound();
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_22rem]">
      <div>
        <nav aria-label="Breadcrumb" className="mb-4 text-sm">
          <Link href="/shop" className="font-medium text-plate underline underline-offset-2">
            Shop
          </Link>
          <span className="text-ink-soft"> / {CATEGORY_TEXT[product.category]}</span>
        </nav>
        <h1 className="text-4xl">{product.name}</h1>
        {product.description ? <p className="mt-4 max-w-prose whitespace-pre-line text-ink">{product.description}</p> : null}
        {product.category === "SUPPLEMENTS" ? (
          <p className="mt-6 max-w-prose rounded border border-line bg-sunken px-4 py-3 text-sm text-ink-soft">
            Read the label for ingredients, allergens and directions before use. The gym can tell you what&apos;s on the label, but can&apos;t give health advice.
          </p>
        ) : null}
      </div>
      <AddToCart product={product} discountPercent={catalogue.discountPercent} />
    </div>
  );
}
