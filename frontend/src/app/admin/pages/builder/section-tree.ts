import type { SerializedNode, SerializedNodes } from "@craftjs/core";
import type { BuilderSectionType } from "../../../builder/types";
import { resolveSectionTypeFromNode } from "./section-node";

export type SectionListItem = {
  nodeId: string;
  sectionId: string;
  sectionType: BuilderSectionType;
  enabled: boolean;
};

export function resolveNodeSectionType(node: SerializedNode | undefined): BuilderSectionType | null {
  return resolveSectionTypeFromNode(node);
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
