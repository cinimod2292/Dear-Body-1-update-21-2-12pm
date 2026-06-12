import { prisma } from "../../lib/prisma.js";
import {
  resolveUploadConfig,
  writeStorageObjectBuffer,
  resolvePublicUrlForStorageKey,
} from "../media/upload.service.js";

function colorSlug(primaryColor: string, accentColor: string): string {
  return `${primaryColor.replace("#", "").toLowerCase()}_${accentColor.replace("#", "").toLowerCase()}`;
}

async function buildGradientPng(primaryColor: string, accentColor: string): Promise<Buffer> {
  // Dynamic import so the server starts cleanly when sharp isn't installed.
  const sharpMod = await import("sharp").then((m) => m.default ?? m).catch(() => null);
  if (!sharpMod) throw new Error("sharp not available");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="620" height="80">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${primaryColor}"/>
        <stop offset="100%" stop-color="${accentColor}"/>
      </linearGradient>
    </defs>
    <rect width="620" height="80" fill="url(#g)"/>
  </svg>`;

  return (sharpMod as typeof import("sharp"))(Buffer.from(svg)).png().toBuffer();
}

/**
 * Returns a public URL to a hosted gradient PNG for the given colour pair,
 * generating and uploading the image on first call and caching the URL in
 * a Setting row keyed to those exact colours.
 *
 * Returns null if sharp is unavailable or any step fails — callers fall back
 * to the CSS linear-gradient.
 */
export async function getOrCreateHeaderGradientUrl(
  primaryColor: string,
  accentColor: string,
): Promise<string | null> {
  const cacheKey = `header.gradient.url.${colorSlug(primaryColor, accentColor)}`;

  const cached = await prisma.setting.findUnique({
    where: { scope_key: { scope: "email", key: cacheKey } },
  });
  if (typeof cached?.value === "string" && cached.value) return cached.value;

  try {
    const buffer = await buildGradientPng(primaryColor, accentColor);
    const cfg = await resolveUploadConfig();
    const storageKey = `variants/email-header-gradient-${colorSlug(primaryColor, accentColor)}.png`;
    await writeStorageObjectBuffer(storageKey, buffer, "image/png", cfg);
    const url = resolvePublicUrlForStorageKey(storageKey, cfg);

    await prisma.setting.upsert({
      where: { scope_key: { scope: "email", key: cacheKey } },
      update: { value: url },
      create: { scope: "email", key: cacheKey, value: url },
    });

    return url;
  } catch {
    return null;
  }
}
