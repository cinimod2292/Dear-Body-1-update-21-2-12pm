export const SAVE_PRODUCT_BEFORE_VARIANT_MESSAGE =
  "Save the product first, then add a variant.";

export type VariantAddGate = {
  /** Whether variants can be added/managed (the product is saved and exists). */
  canManageVariants: boolean;
  /** Reason variants cannot be managed yet, or undefined when they can. */
  disabledReason?: string;
};

/**
 * Variants can only be created against a persisted product. A brand-new product
 * (`isNew`) or one without an id has no server record to attach variants to, so
 * the variant controls must be disabled with a clear "save first" message.
 */
export function resolveVariantAddGate(params: { isNew: boolean; productId?: string | null }): VariantAddGate {
  const hasPersistedProduct = !params.isNew && Boolean(params.productId);
  if (hasPersistedProduct) {
    return { canManageVariants: true };
  }
  return {
    canManageVariants: false,
    disabledReason: SAVE_PRODUCT_BEFORE_VARIANT_MESSAGE,
  };
}
