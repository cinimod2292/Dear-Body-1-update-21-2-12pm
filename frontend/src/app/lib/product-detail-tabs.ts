export type ProductDetailTabKey = "description" | "ingredients" | "howToUse";

export type ProductDetailTab = {
  key: ProductDetailTabKey;
  label: string;
  content: string;
};

/**
 * Builds the list of product detail tabs, keeping only those with non-empty
 * content. An incomplete product (e.g. no ingredients or how-to-use) should not
 * render empty tabs/sections on the storefront.
 */
export function resolveProductDetailTabs(source: {
  description?: string | null;
  ingredients?: string | null;
  howToUse?: string | null;
}): ProductDetailTab[] {
  const candidates: Array<{ key: ProductDetailTabKey; label: string; content?: string | null }> = [
    { key: "description", label: "Description", content: source.description },
    { key: "ingredients", label: "Ingredients", content: source.ingredients },
    { key: "howToUse", label: "How To Use", content: source.howToUse },
  ];

  return candidates
    .filter((tab) => typeof tab.content === "string" && tab.content.trim().length > 0)
    .map((tab) => ({ key: tab.key, label: tab.label, content: tab.content as string }));
}
