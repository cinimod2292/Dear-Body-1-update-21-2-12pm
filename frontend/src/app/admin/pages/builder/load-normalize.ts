import { BuilderPageContent, BuilderSection } from "../../../builder/types";

export function normalizeList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>) as T[];
  return [];
}

export function normalizeArrayOnly<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function normalizeLoadContent(content: unknown): BuilderPageContent {
  const normalized = content && typeof content === "object" ? { ...(content as Record<string, unknown>) } : {};
  return { ...(normalized as BuilderPageContent), sections: normalizeList<BuilderSection>((normalized as any)?.sections) };
}
