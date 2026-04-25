export type MissingProductUploadPhase = "idle" | "uploading" | "processing" | "attaching" | "success" | "error";

export type MissingProductUploadState = {
  phase: MissingProductUploadPhase;
  message?: string;
};

export type VariantBatchResultRow = {
  mediaId: string;
  status: "ok" | "failed" | "noop";
  generated: number;
  skipped: number;
  failed: number;
  error?: string;
};

export function setMissingProductRowState(
  current: Record<string, MissingProductUploadState>,
  productId: string,
  state: MissingProductUploadState,
): Record<string, MissingProductUploadState> {
  return {
    ...current,
    [productId]: state,
  };
}

export function isMissingProductRowBusy(state: MissingProductUploadState | undefined): boolean {
  return state?.phase === "uploading" || state?.phase === "processing" || state?.phase === "attaching";
}

export function validateVariantBatchBeforeAttach(results: VariantBatchResultRow[]): { ok: true } | { ok: false; message: string } {
  const failed = results.find((entry) => entry.status !== "ok");
  if (!failed) return { ok: true };
  return {
    ok: false,
    message: failed.error ?? "Variant generation did not complete for all images",
  };
}
