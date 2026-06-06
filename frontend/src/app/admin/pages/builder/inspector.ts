import { EditableField } from "../../../builder/types";

export type InspectorGroup = "Content" | "Media" | "Buttons/Links" | "Layout" | "Style";

export const INSPECTOR_GROUP_ORDER: InspectorGroup[] = ["Content", "Media", "Buttons/Links", "Layout", "Style"];

export function inferInspectorGroup(fieldKey: string, field: EditableField): InspectorGroup {
  const key = fieldKey.toLowerCase();
  if (field.type === "image" || key.includes("image") || key.includes("alt") || key.includes("video") || key.includes("poster")) return "Media";
  if (key.includes("button") || field.type === "url" || key.includes("href") || key.includes("link")) return "Buttons/Links";
  if (key.includes("layout") || key.includes("columns") || key.includes("mode") || key.includes("height") || key.includes("divider") || key.includes("maxwidth") || key.includes("alignment") || key.includes("overlay")) return "Layout";
  if (key.includes("tone") || key.includes("style") || key.includes("color")) return "Style";
  return "Content";
}
