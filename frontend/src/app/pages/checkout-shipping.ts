export type CheckoutDeliveryType = "home" | "collection" | "pudo-locker" | "pudo-door";

export type TypedShippingMethod = {
  id: string;
  type: "DELIVERY" | "COLLECTION";
};

export function methodsForDeliveryType<T extends TypedShippingMethod>(
  methods: T[],
  deliveryType: CheckoutDeliveryType,
): T[] {
  if (deliveryType === "collection") return methods.filter((method) => method.type === "COLLECTION");
  if (deliveryType === "home") return methods.filter((method) => method.type === "DELIVERY");
  return [];
}

export function firstMethodIdForDeliveryType<T extends TypedShippingMethod>(
  methods: T[],
  deliveryType: CheckoutDeliveryType,
): string {
  return methodsForDeliveryType(methods, deliveryType)[0]?.id ?? "";
}
