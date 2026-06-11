interface CollectionShippingMethod {
  code?: string | null;
  name?: string | null;
}

interface CollectionOrderShape {
  pudoDeliveryType?: string | null;
  shippingMethod?: CollectionShippingMethod | null;
}

const COLLECTION_METHOD_PATTERN = /(^|[^a-z])(collect(?:ion)?|click\s*(?:and|&)\s*collect|pick[\s_-]*up|warehouse)([^a-z]|$)/i;

export function isWarehouseCollectionOrder(order: CollectionOrderShape): boolean {
  if (order.pudoDeliveryType) return false;
  const method = order.shippingMethod;
  if (!method) return false;
  return COLLECTION_METHOD_PATTERN.test(`${method.code ?? ""} ${method.name ?? ""}`);
}

export function shouldSendWarehouseCollectionReadyEmail(input: {
  previousFulfillmentStatus: string;
  nextFulfillmentStatus: string;
  isWarehouseCollection: boolean;
  alreadySent: boolean;
}): boolean {
  return input.nextFulfillmentStatus === "PACKED"
    && input.previousFulfillmentStatus !== "PACKED"
    && input.isWarehouseCollection
    && !input.alreadySent;
}
