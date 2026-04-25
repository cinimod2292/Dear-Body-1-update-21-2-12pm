import type { SerializedNode, SerializedNodes } from "@craftjs/core";
import type { BuilderSectionType } from "../../../builder/types";

export type SectionListItem = {
  nodeId: string;
  sectionId: string;
  sectionType: BuilderSectionType;
  enabled: boolean;
};

const RESOLVED_NAME_TO_SECTION_TYPE: Record<string, BuilderSectionType> = {
  HeroCraftSection: "hero_banner",
  FeaturedProductsCraftSection: "featured_products",
  ImageTextCraftSection: "image_text",
  BenefitIconsCraftSection: "benefit_icons",
  PromoBannerCraftSection: "promo_banner",
};

function resolvedName(node: SerializedNode | undefined): string {
  if (!node?.type) return "";
  if (typeof node.type === "string") return node.type;
  return String(node.type.resolvedName ?? "");
}

export function resolveNodeSectionType(node: SerializedNode | undefined): BuilderSectionType | null {
  const customType = String(node?.custom?.sectionType ?? "").trim();
  if (customType === "hero_banner" || customType === "featured_products" || customType === "image_text" || customType === "benefit_icons" || customType === "promo_banner") {
    return customType;
  }

  const mapped = RESOLVED_NAME_TO_SECTION_TYPE[resolvedName(node)];
  return mapped ?? null;
}

export function buildSectionList(nodes: SerializedNodes): SectionListItem[] {
  const root = nodes.ROOT;
  const orderedNodeIds = Array.isArray(root?.nodes) ? root.nodes : [];

  return orderedNodeIds.flatMap((nodeId) => {
    const node = nodes[nodeId];
    const sectionType = resolveNodeSectionType(node);
    if (!sectionType) return [];

    const sectionId = typeof node?.props?.sectionId === "string" && node.props.sectionId.trim()
      ? node.props.sectionId
      : String(nodeId);

    return [{
      nodeId: String(nodeId),
      sectionId,
      sectionType,
      enabled: typeof node?.props?.enabled === "boolean" ? node.props.enabled : true,
    }];
  });
}
