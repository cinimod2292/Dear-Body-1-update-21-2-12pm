export const HERO_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;

export function isHeroUploadTooLarge(fileSize: number) {
  return fileSize > HERO_UPLOAD_MAX_BYTES;
}
