import type { SerializedNode, SerializedNodes } from "@craftjs/core";
import { BuilderPageContent, BuilderSection, BuilderSectionType } from "./types";
import { sanitizeBuilderImageUrl } from "./media-url";

const TYPE_TO_RESOLVED_NAME: Record<BuilderSectionType, string> = {
  hero_banner: "HeroCraftSection",
  featured_products: "FeaturedProductsCraftSection",
  image_text: "ImageTextCraftSection",
  benefit_icons: "BenefitIconsCraftSection",
  promo_banner: "PromoBannerCraftSection",
};

const RESOLVED_NAME_TO_TYPE = Object.fromEntries(
  Object.entries(TYPE_TO_RESOLVED_NAME).map(([type, resolvedName]) => [resolvedName, type as BuilderSectionType]),
);

const ROOT_NODE_ID = "ROOT";

export function pageContentToCraftNodes(content: BuilderPageContent): SerializedNodes {
  const sections = Array.isArray(content?.sections) ? content.sections : [];

  const rootNode: SerializedNode = {
    type: { resolvedName: "BuilderCanvas" },
    isCanvas: true,
    props: {},
    displayName: "Builder Canvas",
    custom: {},
    hidden: false,
    nodes: [],
    linkedNodes: {},
    parent: null as unknown as string,
  };

  const nodes: SerializedNodes = { [ROOT_NODE_ID]: rootNode };

  for (const section of sections) {
    const resolvedName = TYPE_TO_RESOLVED_NAME[section.type];
    if (!resolvedName) continue;

    const nodeId = section.id;
    rootNode.nodes?.push(nodeId);

    nodes[nodeId] = {
      type: { resolvedName },
      isCanvas: false,
      props: {
        ...sanitizeSectionPropsForCraft(section),
        sectionId: section.id,
        enabled: section.enabled,
      },
      displayName: resolvedName,
      custom: {
        sectionType: section.type,
      },
      hidden: false,
      parent: ROOT_NODE_ID,
      nodes: [],
      linkedNodes: {},
    };
  }

  return nodes;
}

function sanitizeSectionPropsForCraft(section: BuilderSection): Record<string, unknown> {
  const props = { ...(section.props ?? {}) };
  for (const [key, value] of Object.entries(props)) {
    if (!key.toLowerCase().includes("image")) continue;
    props[key] = sanitizeBuilderImageUrl(value, { isHero: section.type === "hero_banner" || key.toLowerCase().includes("hero") });
  }
  return props;
}

function normalizeSection(section: BuilderSection): BuilderSection {
  return {
    ...section,
    props: JSON.parse(JSON.stringify(section.props ?? {})) as Record<string, unknown>,
  };
}

export function craftNodesToPageContent(serializedNodes: SerializedNodes): BuilderPageContent {
  const rootNode = serializedNodes[ROOT_NODE_ID];
  const orderedNodeIds = Array.isArray(rootNode?.nodes) ? rootNode.nodes : [];

  const sections: BuilderSection[] = orderedNodeIds
    .map((nodeId) => {
      const node = serializedNodes[nodeId];
      if (!node) return null;

      const resolvedName =
        typeof node.type === "string"
          ? node.type
          : node.type?.resolvedName;

      const sectionType = resolvedName ? RESOLVED_NAME_TO_TYPE[String(resolvedName)] : undefined;
      if (!sectionType) return null;

      const props = { ...(node.props ?? {}) } as Record<string, unknown>;
      const sectionId = typeof props.sectionId === "string" && props.sectionId.trim()
        ? props.sectionId
        : String(nodeId);
      const enabled = typeof props.enabled === "boolean" ? props.enabled : true;

      delete props.sectionId;
      delete props.enabled;

      return normalizeSection({
        id: sectionId,
        type: sectionType,
        enabled,
        props,
      });
    })
    .filter((section): section is BuilderSection => Boolean(section));

  return { sections };
}

export function duplicateSectionInContent(content: BuilderPageContent, sectionId: string): BuilderPageContent {
  const sections = [...content.sections];
  const index = sections.findIndex((section) => section.id === sectionId);
  if (index < 0) return content;

  const source = sections[index];
  const clone: BuilderSection = {
    ...normalizeSection(source),
    id: `${source.type}_${Math.random().toString(36).slice(2, 8)}`,
  };

  sections.splice(index + 1, 0, clone);
  return { sections };
}
