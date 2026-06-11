export function normalizePudoTrackingStatus(status: string): string {
  return status.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function emailTemplateKeyForPudoStatus(status: string): string {
  return normalizePudoTrackingStatus(status) === "ready_for_collection"
    ? "order_ready_for_collection"
    : "pudo_tracking_update";
}
