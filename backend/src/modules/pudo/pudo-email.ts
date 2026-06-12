export function normalizePudoTrackingStatus(status: string): string {
  return status.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function emailTemplateKeyForPudoStatus(status: string): string {
  const normalized = normalizePudoTrackingStatus(status);
  if (normalized === "delivered") return "order_delivered";
  if (normalized === "ready_for_collection") return "order_ready_for_collection";
  return "pudo_tracking_update";
}
