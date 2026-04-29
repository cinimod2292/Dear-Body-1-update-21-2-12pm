const SHA = String(import.meta.env.VITE_APP_BUILD_SHA ?? "dev");
const TS = String(import.meta.env.VITE_APP_BUILD_TS ?? "dev-time");

export const BUILD_MARKER = `[PAGE_BUILDER_BUILD_MARKER] sha=${SHA} ts=${TS}`;

export function logBuildMarker(area: string) {
  console.info(BUILD_MARKER, { area });
}
