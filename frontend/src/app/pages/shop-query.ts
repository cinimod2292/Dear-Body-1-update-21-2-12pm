export const ALL_PRODUCTS_CATEGORY = "All";

export function getShopCategory(searchParams: URLSearchParams): string {
  return searchParams.get("category") || ALL_PRODUCTS_CATEGORY;
}

export function setShopCategory(searchParams: URLSearchParams, category: string): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams);

  if (category === ALL_PRODUCTS_CATEGORY) {
    nextSearchParams.delete("category");
  } else {
    nextSearchParams.set("category", category);
  }

  return nextSearchParams;
}
