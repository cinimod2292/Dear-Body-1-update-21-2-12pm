import type { BuilderSectionType, EditableField } from "../../../builder/types";

export type BuilderRegistryLike = Record<BuilderSectionType, {
  displayName: string;
  description: string;
  icon: string;
  editableSchema: Record<string, EditableField>;
  removable: boolean;
  movable: boolean;
  duplicatable: boolean;
}>;

export type ResolvedInspectorSection<TRegistry extends BuilderRegistryLike = BuilderRegistryLike> = {
  nodeId: string;
  sectionType: BuilderSectionType;
  registryEntry: TRegistry[BuilderSectionType];
  editableSchema: Record<string, EditableField>;
  nodeProps: Record<string, unknown>;
};

const NAME_TO_SECTION_TYPE: Record<string, BuilderSectionType> = {
  HeroCraftSection: "hero_banner",
  FeaturedProductsCraftSection: "featured_products",
  ImageTextCraftSection: "image_text",
  BenefitIconsCraftSection: "benefit_icons",
  PromoBannerCraftSection: "promo_banner",
  "Hero Banner": "hero_banner",
  "Featured Products": "featured_products",
  "Image + Text": "image_text",
  "Benefit Icons": "benefit_icons",
  "Promo Banner": "promo_banner",
};

function normalizeSectionType(value: unknown): BuilderSectionType | null {
  if (value === "hero_banner" || value === "featured_products" || value === "image_text" || value === "benefit_icons" || value === "promo_banner") {
    return value;
  }
  return null;
}

function getNodeData(node: any) {
  return node?.data ?? node ?? {};
}

function getResolvedName(nodeData: any): string {
  const typeValue = nodeData?.type;
  if (typeof typeValue === "string") return typeValue;
  if (typeof typeValue?.resolvedName === "string") return typeValue.resolvedName;
  if (typeof nodeData?.name === "string") return nodeData.name;
  return "";
}

export function resolveSectionTypeFromNode(node: unknown): BuilderSectionType | null {
  const nodeData = getNodeData(node);

  const customType = normalizeSectionType(nodeData?.custom?.sectionType);
  if (customType) return customType;

  const displayName = String(nodeData?.displayName ?? "").trim();
  if (displayName && NAME_TO_SECTION_TYPE[displayName]) return NAME_TO_SECTION_TYPE[displayName];

  const name = String(nodeData?.name ?? "").trim();
  if (name && NAME_TO_SECTION_TYPE[name]) return NAME_TO_SECTION_TYPE[name];

  const resolved = getResolvedName(nodeData).trim();
  if (resolved && NAME_TO_SECTION_TYPE[resolved]) return NAME_TO_SECTION_TYPE[resolved];

  return null;
}

export function extractSelectedNodeId(selected: unknown): string | null {
  if (typeof selected === "string" && selected.trim()) return selected;

  if (Array.isArray(selected)) {
    const first = selected.find((value) => typeof value === "string" && value.trim());
    return typeof first === "string" ? first : null;
  }

  if (selected && typeof selected === "object") {
    if (typeof (selected as Set<unknown>).values === "function") {
      for (const value of (selected as Set<unknown>).values()) {
        if (typeof value === "string" && value.trim()) return value;
      }
    }

    for (const [key, value] of Object.entries(selected as Record<string, unknown>)) {
      if (value === true && key.trim()) return key;
      if (typeof value === "string" && value.trim()) return value;
    }
  }

  return null;
}

export function resolveInspectableSection<TRegistry extends BuilderRegistryLike>(
  nodeId: string | null,
  node: unknown,
  registry: TRegistry,
): ResolvedInspectorSection<TRegistry> | null {
  if (!nodeId) return null;

  const sectionType = resolveSectionTypeFromNode(node);
  if (!sectionType) return null;

  const registryEntry = registry[sectionType];
  if (!registryEntry) return null;

  const nodeData = getNodeData(node);
  const nodeProps = (nodeData?.props ?? {}) as Record<string, unknown>;

  return {
    nodeId,
    sectionType,
    registryEntry,
    editableSchema: registryEntry.editableSchema,
    nodeProps,
  };
}
