export type RestockableOrderItem = { variantId: string | null; quantity: number };

export function summarizeInventoryRestore(items: RestockableOrderItem[]) {
  const quantities = new Map<string, number>();
  for (const item of items) {
    if (!item.variantId || item.quantity <= 0) continue;
    quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.quantity);
  }
  return quantities;
}
