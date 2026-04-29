import { createContext, useContext, useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { Editor, Element, Frame, useEditor, useNode, type SerializedNode, type SerializedNodes } from "@craftjs/core";
import { Link } from "react-router";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Eye, Loader2, Monitor, Redo2, Save, Smartphone, Tablet, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "../api/client";
import { discardBuilderDraft, fetchAdminBuilderPage, publishBuilderDraft, saveBuilderDraft } from "../../builder/api";
import { dearBodySectionRegistry } from "../../builder/registry";
import { BenefitIconsSection } from "../../builder/sections/BenefitIconsSection";
import { FeaturedProductsSection } from "../../builder/sections/FeaturedProductsSection";
import { HeroBannerSection } from "../../builder/sections/HeroBannerSection";
import { ImageTextSection } from "../../builder/sections/ImageTextSection";
import { PromoBannerSection } from "../../builder/sections/PromoBannerSection";
import { BuilderPageContent, BuilderSection, BuilderSectionType, EditableField } from "../../builder/types";
import { fetchStoreProducts, Product } from "../../data/products";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ErrorState, LoadingState } from "../components/AdminState";
import { MediaAsset, PaginatedResult } from "../types/admin";
import { craftNodesToPageContent, pageContentToCraftNodes } from "../../builder/craft-mapper";
import { SECTION_PRESETS } from "../../builder/presets";
import { actionBlockedMessage, isActionAllowed } from "../../builder/action-rules";
import { isSafeImageUrl } from "../../builder/media-url";
import { duplicateSection, moveSection, removeSection } from "./builder/editor-state";
import { buildSectionList } from "./builder/section-tree";
import { inferInspectorGroup, INSPECTOR_GROUP_ORDER } from "./builder/inspector";
import { extractSelectedNodeId, resolveInspectableSection } from "./builder/section-node";
import { isHeroImageField, mapSelectedMediaVariantToFieldValue, resolveHeroImageSelection, resolveNextImageValue } from "./builder/media-picker";
import { variantKeys } from "../lib/media-variants";
import { BUILD_MARKER, logBuildMarker } from "../../lib/build-marker";

type Status = "unsaved" | "saving" | "saved" | "publishing" | "published" | "error";

function isBuilderDebugEnabled() {
  if (import.meta.env.DEV) return true;
  try {
    return localStorage.getItem("builderDebug") === "1";
  } catch {
    return false;
  }
}

function builderDebugLog(message: string, payload: Record<string, unknown>) {
  if (!isBuilderDebugEnabled()) return;
  console.info(`[builder-home] ${message}`, payload);
}


function normalizeList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>) as T[];
  return [];
}

function logBuilderVariantDiagnostic(area: string, variants: unknown) {
  const isArray = Array.isArray(variants);
  const isObject = Boolean(variants && typeof variants === "object" && !isArray);
  const keys = isObject ? Object.keys(variants as Record<string, unknown>) : [];
  console.info("[builder-diagnostic] variant-shape", { area, valueType: typeof variants, isArray, isObject, keys });
}

export function __testOnly__normalizeList<T>(value: unknown): T[] {
  return normalizeList<T>(value);
}

function BuilderCanvas({ children }: { children?: ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}

const SectionFrame = ({ label, enabled, children }: { label: string; enabled: boolean; children: ReactNode }) => {
  const {
    connectors: { connect, drag },
    selected,
  } = useNode((node) => ({ selected: node.events.selected }));

  return (
    <div
      ref={(ref) => {
        if (!ref) return;
        connect(drag(ref));
      }}
      className={`relative rounded-md border-2 transition ${selected ? "border-pink-400" : "border-transparent hover:border-pink-200"} ${enabled ? "" : "opacity-50"}`}
    >
      <div className="absolute left-2 top-2 z-10 rounded bg-white/95 border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700">
        {label} {enabled ? "" : "(Hidden)"}
      </div>
      {children}
    </div>
  );
};

const CraftProductsContext = createContext<Product[]>([]);

function HeroCraftSection(props: Record<string, unknown>) {
  return <SectionFrame label="Hero Banner" enabled={Boolean(props.enabled ?? true)}><HeroBannerSection {...props as any} /></SectionFrame>;
}
HeroCraftSection.craft = { displayName: "Hero Banner" };

function FeaturedProductsCraftSection(props: Record<string, unknown>) {
  const products = useContext(CraftProductsContext);
  return <SectionFrame label="Featured Products" enabled={Boolean(props.enabled ?? true)}><FeaturedProductsSection {...props as any} products={products} /></SectionFrame>;
}
FeaturedProductsCraftSection.craft = { displayName: "Featured Products" };

function ImageTextCraftSection(props: Record<string, unknown>) {
  return <SectionFrame label="Image + Text" enabled={Boolean(props.enabled ?? true)}><ImageTextSection {...props as any} /></SectionFrame>;
}
ImageTextCraftSection.craft = { displayName: "Image + Text" };

function BenefitIconsCraftSection(props: Record<string, unknown>) {
  return <SectionFrame label="Benefit Icons" enabled={Boolean(props.enabled ?? true)}><BenefitIconsSection {...props as any} /></SectionFrame>;
}
BenefitIconsCraftSection.craft = { displayName: "Benefit Icons" };

function PromoBannerCraftSection(props: Record<string, unknown>) {
  return <SectionFrame label="Promo Banner" enabled={Boolean(props.enabled ?? true)}><PromoBannerSection {...props as any} /></SectionFrame>;
}
PromoBannerCraftSection.craft = { displayName: "Promo Banner" };

function resolvedComponent(type: BuilderSectionType) {
  if (type === "hero_banner") return HeroCraftSection;
  if (type === "featured_products") return FeaturedProductsCraftSection;
  if (type === "image_text") return ImageTextCraftSection;
  if (type === "benefit_icons") return BenefitIconsCraftSection;
  return PromoBannerCraftSection;
}

function toFieldValue(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return "";
}

function applySectionMutation(
  query: ReturnType<typeof useEditor>["query"],
  actions: ReturnType<typeof useEditor>["actions"],
  mutate: (sections: BuilderSection[]) => BuilderSection[],
  nextSelectedNodeId?: string,
) {
  const content = craftNodesToPageContent(query.getSerializedNodes() as SerializedNodes);
  const nextContent = { sections: mutate(content.sections) };
  actions.deserialize(pageContentToCraftNodes(nextContent));
  if (nextSelectedNodeId) {
    actions.selectNode(nextSelectedNodeId);
  }
}

function SectionLibrary() {
  const { connectors } = useEditor();

  return (
    <div className="space-y-2">
      {SECTION_PRESETS.map((preset) => (
        <div
          key={preset.id}
          ref={(ref) => {
            if (!ref) return;
            connectors.create(
              ref,
              <Element
                is={resolvedComponent(preset.sectionType)}
                canvas={false}
                custom={{ sectionType: preset.sectionType }}
                {...preset.defaultProps}
                sectionId={`${preset.sectionType}_${Math.random().toString(36).slice(2, 8)}`}
                enabled
              />,
            );
          }}
          className="cursor-grab active:cursor-grabbing border border-gray-200 rounded-lg p-2 bg-white"
        >
          <p className="text-sm font-semibold">{preset.icon} {preset.name}</p>
          <p className="text-xs text-gray-500">{preset.description}</p>
        </div>
      ))}
    </div>
  );
}

function SectionList() {
  const { selectedNodeId, actions, query, stateNodes } = useEditor((state) => ({
    selectedNodeId: extractSelectedNodeId(state.events.selected),
    stateNodes: state.nodes,
  }));

  const sections = buildSectionList(query.getSerializedNodes() as SerializedNodes);
  void stateNodes;

  if (sections.length === 0) {
    return <div className="text-xs text-gray-500 border border-dashed border-gray-200 rounded-lg p-2">No sections yet. Drag a preset into the canvas.</div>;
  }

  const getRules = (sectionType: BuilderSectionType) => ({
    removable: dearBodySectionRegistry[sectionType].removable,
    movable: dearBodySectionRegistry[sectionType].movable,
    duplicatable: dearBodySectionRegistry[sectionType].duplicatable,
  });

  return (
    <div className="space-y-2">
      {sections.map((section, index) => {
        const registry = dearBodySectionRegistry[section.sectionType];
        const rules = getRules(section.sectionType);
        const selected = selectedNodeId === section.nodeId;

        return (
          <div key={section.nodeId} className={`border rounded-lg p-2 ${selected ? "border-pink-400 bg-pink-50/40" : "border-gray-200 bg-white"}`}>
            <button type="button" onClick={() => actions.selectNode(section.nodeId)} className="w-full text-left">
              <p className="text-xs font-semibold">{registry.icon} {registry.displayName}</p>
              <p className="text-[11px] text-gray-500">{section.sectionId}{section.enabled ? "" : " · hidden"}</p>
            </button>
            <div className="mt-2 grid grid-cols-5 gap-1">
              <button
                type="button"
                title="Move up"
                className="px-1 py-1 rounded border border-gray-200 text-[11px] disabled:opacity-40"
                disabled={index === 0}
                onClick={() => {
                  if (!isActionAllowed(rules, "move")) return toast.error(actionBlockedMessage("move"));
                  applySectionMutation(query, actions, (sectionsData) => moveSection(sectionsData, index, -1), section.nodeId);
                }}
              ><ArrowUp size={12} className="mx-auto" /></button>
              <button
                type="button"
                title="Move down"
                className="px-1 py-1 rounded border border-gray-200 text-[11px] disabled:opacity-40"
                disabled={index === sections.length - 1}
                onClick={() => {
                  if (!isActionAllowed(rules, "move")) return toast.error(actionBlockedMessage("move"));
                  applySectionMutation(query, actions, (sectionsData) => moveSection(sectionsData, index, 1), section.nodeId);
                }}
              ><ArrowDown size={12} className="mx-auto" /></button>
              <button
                type="button"
                title="Duplicate"
                className="px-1 py-1 rounded border border-gray-200 text-[11px]"
                onClick={() => {
                  if (!isActionAllowed(rules, "duplicate")) return toast.error(actionBlockedMessage("duplicate"));
                  const content = craftNodesToPageContent(query.getSerializedNodes() as SerializedNodes);
                  const nextSections = duplicateSection(content.sections, section.sectionId);
                  const newSection = nextSections.find((entry, entryIndex) => entryIndex > index && entry.type === section.sectionType && entry.id !== section.sectionId);
                  actions.deserialize(pageContentToCraftNodes({ sections: nextSections }));
                  if (newSection) actions.selectNode(newSection.id);
                }}
              ><Copy size={12} className="mx-auto" /></button>
              <button
                type="button"
                title={section.enabled ? "Hide" : "Show"}
                className="px-1 py-1 rounded border border-gray-200 text-[11px]"
                onClick={() => {
                  actions.setProp(section.nodeId, (props: Record<string, unknown>) => { props.enabled = !Boolean(props.enabled ?? true); });
                }}
              >{section.enabled ? "Hide" : "Show"}</button>
              <button
                type="button"
                title="Delete"
                className="px-1 py-1 rounded border border-gray-200 text-[11px]"
                onClick={() => {
                  if (!isActionAllowed(rules, "remove")) return toast.error(actionBlockedMessage("remove"));
                  const content = craftNodesToPageContent(query.getSerializedNodes() as SerializedNodes);
                  const nextSections = removeSection(content.sections, section.sectionId);
                  actions.deserialize(pageContentToCraftNodes({ sections: nextSections }));
                  const fallback = nextSections[index] ?? nextSections[index - 1];
                  if (fallback) actions.selectNode(fallback.id);
                }}
              ><Trash2 size={12} className="mx-auto" /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MediaLibraryModal({
  open,
  accessToken,
  onClose,
  onSelect,
}: {
  open: boolean;
  accessToken?: string;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryText, setQueryText] = useState("");
  const [items, setItems] = useState<MediaAsset[]>([]);

  useEffect(() => {
    if (!open || !accessToken) return;
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({ page: "1", perPage: "24", kind: "IMAGE", sortBy: "createdAt", sortDir: "desc" });
        if (queryText.trim()) params.set("q", queryText.trim());
        const response = await apiRequest<{ data: PaginatedResult<MediaAsset> }>(`/admin/media?${params.toString()}`, {}, accessToken);
        if (!cancelled) setItems(response.data.items);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load media");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [open, accessToken, queryText]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Choose image from media library</h3>
          <button type="button" onClick={onClose} className="px-2 py-1 rounded border border-gray-200 text-xs">Close</button>
        </div>
        <input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Search by filename..." className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        {loading ? <div className="text-xs text-gray-500">Loading media...</div> : null}
        {error ? <div className="text-xs text-red-600">{error}</div> : null}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-[420px] overflow-auto">
          {items.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => onSelect(asset)}
              className="text-left border border-gray-200 rounded-lg p-2 hover:border-gray-400"
            >
              {asset.publicUrl ? <img src={asset.publicUrl} alt={asset.altText ?? asset.filename} className="w-full h-24 object-cover rounded mb-2" /> : <div className="w-full h-24 bg-gray-100 rounded mb-2" />}
              <p className="text-[11px] font-medium truncate">{asset.filename}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function InspectorImageField({
  label,
  value,
  selectedNodeId,
  keyName,
  sectionType,
  actions,
  query,
  accessToken,
}: {
  label: string;
  value: unknown;
  selectedNodeId: string;
  keyName: string;
  sectionType: BuilderSectionType;
  actions: ReturnType<typeof useEditor>["actions"];
  query: ReturnType<typeof useEditor>["query"];
  accessToken?: string;
}) {
  type HeroDebugInfo = {
    selectedAssetId: string;
    sourceEndpoint: string;
    storageKey: string;
    mimeType: string;
    kind: string;
    variantKeys: string[];
    variantsCount: number;
    chosenHeroUrl: string;
    reason: string;
  };

  const imageValue = toFieldValue(value);
  const isHeroField = isHeroImageField(sectionType, keyName);
  const safe = isSafeImageUrl(imageValue, { isHero: isHeroField });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [heroDebug, setHeroDebug] = useState<HeroDebugInfo | null>(null);

  const setHeroDebugInfo = (params: {
    asset: MediaAsset;
    sourceEndpoint: string;
    chosenHeroUrl?: string;
    reason: string;
  }) => {
    logBuilderVariantDiagnostic("InspectorImageField.setHeroDebugInfo", params.asset.variants);
    const variants = variantKeys(params.asset.variants);
    setHeroDebug({
      selectedAssetId: params.asset.id,
      sourceEndpoint: params.sourceEndpoint,
      storageKey: String(params.asset.storageKey ?? ""),
      mimeType: String(params.asset.mimeType ?? ""),
      kind: String(params.asset.kind ?? ""),
      variantKeys: variants,
      variantsCount: variants.length,
      chosenHeroUrl: String(params.chosenHeroUrl ?? ""),
      reason: params.reason,
    });
  };

  const loadFullAssetById = async (assetId: string, sourceEndpoint: string) => {
    if (!accessToken) return null;
    const response = await apiRequest<{ data: MediaAsset[] }>("/admin/media/by-ids", {
      method: "POST",
      body: JSON.stringify({ ids: [assetId], view: "full" }),
    }, accessToken);
    const fullAsset = response.data[0] ?? null;
    if (fullAsset) {
      setHeroDebugInfo({ asset: fullAsset, sourceEndpoint, reason: "loaded_full_asset" });
    }
    return fullAsset;
  };

  const ensureHeroOptimizedAsset = async (asset: MediaAsset, sourceEndpoint: string, preferredKeys: string[]) => {
    const selection = resolveHeroImageSelection(imageValue, asset, preferredKeys);
    if (!selection.shouldUpdate) {
      setHeroDebugInfo({ asset, sourceEndpoint, reason: "missing_cloudflare_variant" });
      return selection;
    }
    setHeroDebugInfo({ asset, sourceEndpoint, chosenHeroUrl: selection.nextValue, reason: "cloudflare_variant_available" });
    return selection;
  };

  const setFieldValue = (next: string) => {
    const safeNext = resolveNextImageValue(imageValue, next);
    actions.setProp(selectedNodeId, (props: Record<string, unknown>) => {
      props[keyName] = safeNext;
      builderDebugLog("setProp image field", {
        selectedNodeId,
        sectionType,
        keyName,
        imageUrl: String(props.imageUrl ?? ""),
        imageAlt: String(props.imageAlt ?? ""),
      });
    });
    queueMicrotask(() => {
      const node = query.getSerializedNodes()[selectedNodeId] as SerializedNode | undefined;
      const props = (node?.props ?? {}) as Record<string, unknown>;
      builderDebugLog("setProp post-state snapshot", {
        selectedNodeId,
        sectionType,
        keyName,
        imageUrl: String(props.imageUrl ?? ""),
        imageAlt: String(props.imageAlt ?? ""),
      });
    });
  };

  const onUploadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !accessToken) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Only image files are allowed.");
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      const prep = await apiRequest<{ data: { uploadUrl: string; publicUrl: string; storageKey: string; method: "PUT"; headers: Record<string, string> } }>(
        "/admin/media/uploads/prepare",
        {
          method: "POST",
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            byteSize: file.size,
            kind: "IMAGE",
          }),
        },
        accessToken,
      );
      builderDebugLog("prepare upload response", {
        keyName,
        storageKey: prep.data.storageKey,
        publicUrl: prep.data.publicUrl,
      });

      let uploadResponse: Response;
      try {
        uploadResponse = await fetch(prep.data.uploadUrl, {
          method: prep.data.method,
          headers: prep.data.headers,
          body: file,
        });
      } catch (error) {
        throw new Error(
          `Browser upload request failed before reaching storage. Likely bucket CORS issue for admin origin. ${error instanceof Error ? error.message : ""}`.trim(),
        );
      }
      if (!uploadResponse.ok) {
        const details = await uploadResponse.text().catch(() => "");
        throw new Error(`Upload failed (${uploadResponse.status})${details ? `: ${details.slice(0, 200)}` : ""}`);
      }

      const finalized = await apiRequest<{ data: MediaAsset; variantsPending?: boolean; variantErrors?: string[] }>("/admin/media/uploads/finalize", {
        method: "POST",
        body: JSON.stringify({
          storageKey: prep.data.storageKey,
          publicUrl: prep.data.publicUrl,
          kind: "IMAGE",
          metadata: { byteSize: file.size, mimeType: file.type || "application/octet-stream" },
          altText: file.name,
        }),
      }, accessToken);
      builderDebugLog("finalize upload response", {
        keyName,
        mediaId: finalized.data.id,
        publicUrl: finalized.data.publicUrl,
        variants: variantKeys(finalized.data.variants),
        variantShape: (Array.isArray(finalized.data.variants) ? "array" : typeof finalized.data.variants),
        variantsPending: finalized.variantsPending ?? false,
        variantErrors: finalized.variantErrors ?? [],
      });

      const preferredKeys = isHeroField
        ? ["heroDesktop", "heroMobile", "card", "gallery", "thumbnail"]
        : ["gallery", "card", "thumbnail"];
      const allowOriginalFallback = !isHeroField;
      const next = mapSelectedMediaVariantToFieldValue(imageValue, finalized.data, preferredKeys, { allowOriginalFallback });
      builderDebugLog("upload selected image URL", {
        keyName,
        mediaId: finalized.data.id,
        chosenImageUrl: next,
        previousImageUrl: imageValue,
        variantsPending: finalized.variantsPending ?? false,
      });
      if (isHeroField) {
        const heroSelection = await ensureHeroOptimizedAsset(finalized.data, "/admin/media/uploads/finalize", preferredKeys);
        if (!heroSelection.shouldUpdate) {
          toast.warning(heroSelection.warning);
          return;
        }
        setFieldValue(heroSelection.nextValue);
      } else {
        setFieldValue(next);
      }
      if (!allowOriginalFallback && next === imageValue) {
        toast.info("Optimizing image… hero variant not ready yet.");
      }
      toast.success("Image uploaded");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div>
      {imageValue ? <img src={imageValue} alt={label} className="w-full h-24 rounded-lg border border-gray-200 object-cover mb-2" /> : <div className="w-full h-20 rounded-lg border border-dashed border-gray-200 mb-2 flex items-center justify-center text-xs text-gray-400">No image selected</div>}
      <input type="text" className={`w-full rounded-lg border px-3 py-2 text-sm ${safe ? "border-gray-200" : "border-red-400"}`} value={imageValue} onChange={(event) => setFieldValue(event.target.value)} />
      {!safe ? <p className="text-xs text-red-600 mt-1">Use only relative or https image URLs.</p> : null}
      {uploadError ? <p className="text-xs text-red-600 mt-1">{uploadError}</p> : null}
      <p className="text-[11px] text-gray-500 mt-1 truncate">{imageValue || "No image URL"}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <label className="text-xs px-2 py-1 rounded border border-gray-300 cursor-pointer">
          {uploading ? "Uploading..." : "Upload image"}
          <input type="file" accept="image/*" className="hidden" disabled={uploading || !accessToken} onChange={onUploadFile} />
        </label>
        <button type="button" className="text-xs px-2 py-1 rounded border border-gray-300" disabled={!accessToken} onClick={() => setShowLibrary(true)}>Choose from media</button>
        <button type="button" className="text-xs px-2 py-1 rounded border border-gray-300" onClick={() => setFieldValue("")}>Clear image</button>
      </div>
      <MediaLibraryModal
        open={showLibrary}
        accessToken={accessToken}
        onClose={() => setShowLibrary(false)}
        onSelect={(asset) => {
          void (async () => {
          const preferredKeys = isHeroField
            ? ["heroDesktop", "heroMobile", "card", "gallery", "thumbnail"]
            : ["gallery", "card", "thumbnail"];
          const fullAssetPromise = accessToken ? loadFullAssetById(asset.id, "/admin/media/by-ids?view=full") : Promise.resolve(null);
          const fullAsset = await fullAssetPromise;
          const resolvedAsset = fullAsset ?? asset;
          const next = mapSelectedMediaVariantToFieldValue(imageValue, resolvedAsset, preferredKeys, {
            allowOriginalFallback: !isHeroField,
          });
          builderDebugLog("library selected image URL", {
            keyName,
            mediaId: resolvedAsset.id,
            mediaPublicUrl: resolvedAsset.publicUrl,
            variantKeys: variantKeys(resolvedAsset.variants),
            variantShape: (Array.isArray(resolvedAsset.variants) ? "array" : typeof resolvedAsset.variants),
            chosenImageUrl: next,
          });
          if (isHeroField) {
            const heroSelection = await ensureHeroOptimizedAsset(resolvedAsset, "/admin/media/by-ids?view=full", preferredKeys);
            if (!heroSelection.shouldUpdate) {
              toast.warning(heroSelection.warning);
              return;
            }
            setFieldValue(heroSelection.nextValue);
          } else {
            setFieldValue(next);
          }
          setShowLibrary(false);
          })();
        }}
      />
      {isHeroField && heroDebug ? (
        <div className="mt-2 rounded border border-blue-200 bg-blue-50 p-2 text-[11px] text-blue-900 space-y-0.5">
          <p><strong>Hero image debug</strong></p>
          <p>selected asset id: {heroDebug.selectedAssetId}</p>
          <p>source endpoint: {heroDebug.sourceEndpoint}</p>
          <p>storageKey: {heroDebug.storageKey || "n/a"}</p>
          <p>mimeType: {heroDebug.mimeType || "n/a"}</p>
          <p>kind: {heroDebug.kind || "n/a"}</p>
          <p>variants count: {heroDebug.variantsCount}</p>
          <p>variant keys: {heroDebug.variantKeys.join(", ") || "none"}</p>
          <p>chosen hero URL: {heroDebug.chosenHeroUrl || "none"}</p>
          <p>reason: {heroDebug.reason}</p>
        </div>
      ) : null}
    </div>
  );
}

function renderFieldControl(args: {
  keyName: string;
  field: EditableField;
  value: unknown;
  selectedNodeId: string;
  sectionType: BuilderSectionType;
  nodeProps: Record<string, unknown>;
  products: Product[];
  actions: ReturnType<typeof useEditor>["actions"];
  query: ReturnType<typeof useEditor>["query"];
  accessToken?: string;
}) {
  const { keyName, field, value, selectedNodeId, sectionType, nodeProps, products, actions, query, accessToken } = args;

  if (sectionType === "featured_products" && keyName === "mode") {
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">Mode</label>
        <div className="grid grid-cols-3 gap-2">
          {(["latest", "featured", "manual"] as const).map((option) => (
            <button key={option} type="button" className={`px-2 py-2 rounded-lg border text-xs ${String(value ?? "latest") === option ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200"}`} onClick={() => actions.setProp(selectedNodeId, (props: Record<string, unknown>) => { props.mode = option; })}>{option}</button>
          ))}
        </div>
      </div>
    );
  }

  if (sectionType === "featured_products" && keyName === "productIds" && nodeProps.mode === "manual") {
    const selectedIds = Array.isArray(value) ? value.map(String) : [];
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">Manual products</label>
        <div className="max-h-36 overflow-auto border border-gray-200 rounded-lg p-2 space-y-1">
          {products.slice(0, 40).map((product) => {
            const checked = selectedIds.includes(product.id);
            return (
              <label key={product.id} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => actions.setProp(selectedNodeId, (props: Record<string, unknown>) => {
                    const next = new Set(Array.isArray(props.productIds) ? props.productIds.map(String) : []);
                    if (event.target.checked) next.add(product.id); else next.delete(product.id);
                    props.productIds = [...next];
                  })}
                />
                <span>{product.name}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === "textarea") {
    return <textarea className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-20" value={toFieldValue(value)} onChange={(event) => actions.setProp(selectedNodeId, (props: Record<string, unknown>) => { props[keyName] = event.target.value; })} />;
  }

  if (field.type === "select") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {(field.options ?? []).map((option) => (
          <button key={option} type="button" className={`px-2 py-2 rounded-lg border text-xs ${String(value ?? "") === option ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200"}`} onClick={() => actions.setProp(selectedNodeId, (props: Record<string, unknown>) => { props[keyName] = option; })}>{option}</button>
        ))}
      </div>
    );
  }

  if (field.type === "number") {
    return <input type="number" min={field.min} max={field.max} value={Number(value ?? 0)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" onChange={(event) => actions.setProp(selectedNodeId, (props: Record<string, unknown>) => { props[keyName] = Number(event.target.value); })} />;
  }

  if (field.type === "boolean") {
    return <input type="checkbox" checked={Boolean(value)} onChange={(event) => actions.setProp(selectedNodeId, (props: Record<string, unknown>) => { props[keyName] = event.target.checked; })} />;
  }

  if (field.type === "image") {
    return <InspectorImageField label={field.label} value={value} selectedNodeId={selectedNodeId} keyName={keyName} sectionType={sectionType} actions={actions} query={query} accessToken={accessToken} />;
  }

  return <input type="text" value={toFieldValue(value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" onChange={(event) => actions.setProp(selectedNodeId, (props: Record<string, unknown>) => { props[keyName] = event.target.value; })} />;
}

function extractHeroImageUrlFromContent(content: BuilderPageContent) {
  const sections = normalizeList<BuilderSection>((content as any)?.sections);
  const hero = sections.find((section) => section?.type === "hero_banner");
  return String(hero?.props?.imageUrl ?? "");
}

function extractHeroImageUrlFromNodes(nodes: SerializedNodes) {
  const heroNode = Object.values(nodes).find((node) => {
    if (!node || typeof node !== "object") return false;
    const resolvedName = typeof node.type === "string" ? node.type : node.type?.resolvedName;
    return resolvedName === "HeroCraftSection";
  });
  const props = (heroNode?.props ?? {}) as Record<string, unknown>;
  return String(props.imageUrl ?? "");
}

function SelectedSectionInspector({ accessToken }: { accessToken?: string }) {
  const products = useContext(CraftProductsContext);
  const { selectedNodeId, selectedNode, actions, query } = useEditor((state) => {
    const selectedId = extractSelectedNodeId(state.events.selected);
    return {
      selectedNodeId: selectedId,
      selectedNode: selectedId ? state.nodes[selectedId] : null,
    };
  });

  if (!selectedNodeId || !selectedNode) {
    return <div className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg p-3">Select a section to edit settings.</div>;
  }

  const resolvedSection = resolveInspectableSection(selectedNodeId, selectedNode, dearBodySectionRegistry);
  if (!resolvedSection) {
    return <div className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg p-3">Selected node is not an editable storefront section.</div>;
  }

  const { sectionType, registryEntry: registry, editableSchema, nodeProps } = resolvedSection;
  const rules = {
    removable: registry.removable,
    movable: registry.movable,
    duplicatable: registry.duplicatable,
  };

  const groupedFields = new Map<string, Array<[string, EditableField]>>();
  for (const entry of Object.entries(editableSchema)) {
    const [keyName, field] = entry;
    const groupName = inferInspectorGroup(keyName, field);
    const groupItems = groupedFields.get(groupName) ?? [];
    groupItems.push(entry);
    groupedFields.set(groupName, groupItems);
  }

  return (
    <div className="space-y-3">
      <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
        <p className="text-sm font-semibold">{registry.displayName}</p>
        <p className="text-xs text-gray-500">{registry.description}</p>
      </div>

      <label className="flex items-center justify-between text-sm border border-gray-200 rounded-lg px-3 py-2">
        <span>Visible</span>
        <input type="checkbox" checked={Boolean(nodeProps.enabled ?? true)} onChange={(event) => actions.setProp(selectedNodeId, (props: Record<string, unknown>) => { props.enabled = event.target.checked; })} />
      </label>

      {INSPECTOR_GROUP_ORDER.map((groupName) => {
        const fields = groupedFields.get(groupName) ?? [];
        if (fields.length === 0) return null;

        return (
          <section key={groupName} className="border border-gray-200 rounded-lg p-3 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{groupName}</h4>
            {fields.map(([keyName, field]) => (
              <div key={keyName}>
                <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                {renderFieldControl({ keyName, field, value: nodeProps[keyName], selectedNodeId, sectionType, nodeProps, products, actions, query, accessToken })}
              </div>
            ))}
          </section>
        );
      })}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            if (!isActionAllowed(rules, "duplicate")) return toast.error(actionBlockedMessage("duplicate"));
            const content = craftNodesToPageContent(query.getSerializedNodes() as SerializedNodes);
            const sourceSectionId = String(nodeProps.sectionId ?? selectedNodeId);
            const index = content.sections.findIndex((section) => section.id === sourceSectionId);
            const nextSections = duplicateSection(content.sections, sourceSectionId);
            const cloned = index >= 0 ? nextSections[index + 1] : null;
            actions.deserialize(pageContentToCraftNodes({ sections: nextSections }));
            if (cloned) actions.selectNode(cloned.id);
          }}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm inline-flex items-center justify-center gap-1"
        ><Copy size={14} /> Duplicate</button>

        <button
          type="button"
          onClick={() => {
            if (!isActionAllowed(rules, "remove")) return toast.error(actionBlockedMessage("remove"));
            actions.delete(selectedNodeId);
          }}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm inline-flex items-center justify-center gap-1"
        ><Trash2 size={14} /> Delete</button>
      </div>
    </div>
  );
}

function BuilderTopActions({ status, onSave, onPublish, onDiscard, updatedAt, publishedAt, version }: {
  status: Status;
  onSave: (nodes: SerializedNodes) => Promise<void>;
  onPublish: (nodes: SerializedNodes) => Promise<void>;
  onDiscard: () => Promise<void>;
  updatedAt?: string | null;
  publishedAt?: string | null;
  version?: number | null;
}) {
  const { query, actions } = useEditor();
  const [busy, setBusy] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);

  const canUndo = historyTick > 0;
  const canRedo = historyTick > 0;

  const statusLabel = status === "saving" ? "Saving..." : status === "saved" ? "Saved draft" : status === "publishing" ? "Publishing..." : status === "published" ? "Published" : status === "error" ? "Error" : "Unsaved changes";

  return (
    <header className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Link to="/admin" className="px-3 py-2 rounded-lg border border-gray-200 text-sm inline-flex items-center gap-2"><ArrowLeft size={14} /> Back to admin</Link>
        <span className={`text-xs px-2 py-1 rounded-full ${status === "error" ? "bg-red-100 text-red-700" : status === "published" || status === "saved" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{statusLabel}</span>
        <span className="text-xs text-gray-500">Version: {version ?? "—"}</span>
        <span className="text-xs text-gray-500">Draft updated: {updatedAt ? new Date(updatedAt).toLocaleString() : "—"}</span>
        <span className="text-xs text-gray-500">Published: {publishedAt ? new Date(publishedAt).toLocaleString() : "—"}</span>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" disabled={!canUndo} onClick={() => { actions.history.undo(); setHistoryTick((x) => Math.max(0, x - 1)); }} className="px-3 py-2 rounded-lg border border-gray-300 text-sm inline-flex items-center gap-2 disabled:opacity-40"><Undo2 size={14} /> Undo</button>
        <button type="button" disabled={!canRedo} onClick={() => { actions.history.redo(); setHistoryTick((x) => x + 1); }} className="px-3 py-2 rounded-lg border border-gray-300 text-sm inline-flex items-center gap-2 disabled:opacity-40"><Redo2 size={14} /> Redo</button>
        <Link to="/?preview=builder" target="_blank" className="px-3 py-2 rounded-lg border border-gray-300 text-sm inline-flex items-center gap-2"><Eye size={14} /> Preview draft</Link>
        <button type="button" disabled={busy || status === "saving" || status === "publishing"} onClick={async () => { setBusy(true); try { await onSave(query.getSerializedNodes() as SerializedNodes); } finally { setBusy(false); } }} className="px-3 py-2 rounded-lg border border-gray-300 text-sm inline-flex items-center gap-2 disabled:opacity-40"><Save size={14} /> Save Draft</button>
        <button type="button" disabled={busy || status === "saving" || status === "publishing"} onClick={async () => { setBusy(true); try { await onPublish(query.getSerializedNodes() as SerializedNodes); } finally { setBusy(false); } }} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm inline-flex items-center gap-2 disabled:opacity-40">{status === "publishing" || busy ? <Loader2 className="animate-spin" size={14} /> : null} Publish</button>
        <button type="button" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" onClick={() => void onDiscard()}>Discard</button>
      </div>
    </header>
  );
}

function CraftWorkspace({ initialData, viewport, products, onSave, onPublish, onDiscard, onNodesChange, status, updatedAt, publishedAt, version, accessToken }: {
  initialData: SerializedNodes;
  viewport: "desktop" | "tablet" | "mobile";
  products: Product[];
  onSave: (nodes: SerializedNodes) => Promise<void>;
  onPublish: (nodes: SerializedNodes) => Promise<void>;
  onDiscard: () => Promise<void>;
  onNodesChange: (nodes: SerializedNodes) => void;
  status: Status;
  updatedAt?: string | null;
  publishedAt?: string | null;
  version?: number | null;
  accessToken?: string;
}) {
  const widthClass = viewport === "mobile" ? "max-w-[390px]" : viewport === "tablet" ? "max-w-[820px]" : "max-w-[1200px]";

  return (
    <CraftProductsContext.Provider value={products}>
      <Editor
        resolver={{ BuilderCanvas, HeroCraftSection, FeaturedProductsCraftSection, ImageTextCraftSection, BenefitIconsCraftSection, PromoBannerCraftSection }}
        enabled
        onNodesChange={(query) => {
          const nextNodes = query.getSerializedNodes() as SerializedNodes;
          if (nextNodes) onNodesChange(nextNodes);
        }}
      >
        <BuilderTopActions status={status} onSave={onSave} onPublish={onPublish} onDiscard={onDiscard} updatedAt={updatedAt} publishedAt={publishedAt} version={version} />
        <div className="min-h-0 flex-1 grid grid-cols-1 lg:grid-cols-[320px_1fr_360px] gap-3">
          <aside className="bg-white border border-gray-200 rounded-xl p-3 overflow-auto space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-3">Section / Preset Library</p>
              <SectionLibrary />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-3">Section Tree</p>
              <SectionList />
            </div>
          </aside>
          <main className="bg-gray-100 border border-gray-200 rounded-xl p-4 overflow-auto"><div className={`mx-auto ${widthClass}`}><div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"><Frame data={initialData}><Element is={BuilderCanvas} canvas /></Frame></div></div></main>
          <aside className="bg-white border border-gray-200 rounded-xl p-3 overflow-auto"><p className="text-sm font-semibold text-gray-900 mb-3">Inspector</p><SelectedSectionInspector accessToken={accessToken} /></aside>
        </div>
      </Editor>
    </CraftProductsContext.Provider>
  );
}

export default function AdminBuilderHome() {
  const { session } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [serialized, setSerialized] = useState<SerializedNodes>(pageContentToCraftNodes({ sections: [] }));
  const [editorVersion, setEditorVersion] = useState(0);
  const [savedSnapshot, setSavedSnapshot] = useState<BuilderPageContent>({ sections: [] });
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [status, setStatus] = useState<Status>("saved");
  const [meta, setMeta] = useState<{ updatedAt?: string | null; publishedAt?: string | null; version?: number | null }>({});

  const unsaved = useMemo(() => JSON.stringify(craftNodesToPageContent(serialized)) !== JSON.stringify(savedSnapshot), [serialized, savedSnapshot]);

  useEffect(() => {
    logBuildMarker("AdminBuilderHome:init");
  }, []);

  useEffect(() => {
    if (status === "saved" || status === "published" || status === "saving" || status === "publishing") return;
    setStatus(unsaved ? "unsaved" : "saved");
  }, [unsaved]);
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const message = String(event.error?.message ?? event.message ?? "");
      if (!/filter is not a function/i.test(message)) return;
      const snapshot = craftNodesToPageContent(serialized);
      const sections = normalizeList<BuilderSection>((snapshot as any)?.sections);
      const hero = sections.find((section) => section?.type === "hero_banner");
      console.error("[builder-diagnostic] runtime-filter-crash", {
        area: "AdminBuilderHome",
        message,
        sectionsType: typeof (snapshot as any)?.sections,
        sectionsIsArray: Array.isArray((snapshot as any)?.sections),
        sectionKeys: Object.keys(((snapshot as any)?.sections ?? {}) as Record<string, unknown>),
        heroPropsKeys: Object.keys((hero?.props ?? {}) as Record<string, unknown>),
      });
    };
    window.addEventListener("error", onError);
    return () => window.removeEventListener("error", onError);
  }, [serialized]);


  const load = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);
      logBuildMarker("AdminBuilderHome:load");
      const [page, productsResponse] = await Promise.all([fetchAdminBuilderPage("home", session.accessToken), fetchStoreProducts()]);
      builderDebugLog("loaded draft content", {
        heroImageUrl: normalizeList<BuilderSection>((page.draftContent as any)?.sections).find((section) => section?.type === "hero_banner")?.props?.imageUrl ?? null,
      });
      builderDebugLog("before pageContentToCraftNodes", {
        heroImageUrl: extractHeroImageUrlFromContent(page.draftContent),
      });
      const mappedNodes = pageContentToCraftNodes(page.draftContent);
      builderDebugLog("after pageContentToCraftNodes", {
        heroImageUrl: extractHeroImageUrlFromNodes(mappedNodes),
      });
      setProducts(productsResponse);
      setSavedSnapshot({ ...page.draftContent, sections: normalizeList<BuilderSection>((page.draftContent as any)?.sections) });
      setSerialized(mappedNodes);
      setMeta({ updatedAt: page.updatedAt ?? null, publishedAt: page.publishedAt ?? null, version: page.version ?? null });
      setStatus("saved");
      setEditorVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load page builder");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [session?.accessToken]);

  const onSave = async (nodes: SerializedNodes) => {
    if (!session?.accessToken) return;
    try {
      setStatus("saving");
      const content = craftNodesToPageContent(nodes);
      builderDebugLog("saving draft content", {
        heroImageUrl: normalizeList<BuilderSection>((content as any)?.sections).find((section) => section?.type === "hero_banner")?.props?.imageUrl ?? null,
      });
      const saved = await saveBuilderDraft("home", content, session.accessToken);
      builderDebugLog("save draft response content", {
        heroImageUrl: extractHeroImageUrlFromContent(saved.draftContent),
      });
      builderDebugLog("before pageContentToCraftNodes", {
        heroImageUrl: extractHeroImageUrlFromContent(saved.draftContent),
      });
      const mappedNodes = pageContentToCraftNodes(saved.draftContent);
      builderDebugLog("after pageContentToCraftNodes", {
        heroImageUrl: extractHeroImageUrlFromNodes(mappedNodes),
      });
      setSavedSnapshot({ ...saved.draftContent, sections: normalizeList<BuilderSection>((saved.draftContent as any)?.sections) });
      setSerialized(mappedNodes);
      setMeta({ updatedAt: saved.updatedAt ?? null, publishedAt: saved.publishedAt ?? null, version: saved.version ?? null });
      setStatus("saved");
      setEditorVersion((v) => v + 1);
      toast.success("Draft saved");
    } catch (err) {
      setStatus("error");
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  };

  const onPublish = async (nodes: SerializedNodes) => {
    if (!session?.accessToken) return;
    try {
      setStatus("publishing");
      const content = craftNodesToPageContent(nodes);
      builderDebugLog("publish save payload content", {
        heroImageUrl: extractHeroImageUrlFromContent(content),
      });
      await saveBuilderDraft("home", content, session.accessToken);
      const published = await publishBuilderDraft("home", session.accessToken);
      builderDebugLog("publish response draft/published content", {
        draftHeroImageUrl: extractHeroImageUrlFromContent(published.draftContent),
        publishedHeroImageUrl: extractHeroImageUrlFromContent(published.publishedContent),
      });
      const mappedNodes = pageContentToCraftNodes(published.draftContent);
      builderDebugLog("after pageContentToCraftNodes", {
        heroImageUrl: extractHeroImageUrlFromNodes(mappedNodes),
      });
      setSavedSnapshot({ ...published.draftContent, sections: normalizeList<BuilderSection>((published.draftContent as any)?.sections) });
      setSerialized(mappedNodes);
      setMeta({ updatedAt: published.updatedAt ?? null, publishedAt: published.publishedAt ?? null, version: published.version ?? null });
      setStatus("published");
      setEditorVersion((v) => v + 1);
      toast.success("Homepage published");
    } catch (err) {
      setStatus("error");
      toast.error(err instanceof Error ? err.message : "Publish failed");
    }
  };

  const onDiscard = async () => {
    if (!session?.accessToken) return;
    if (!window.confirm("Discard draft changes and revert to published content?")) return;
    try {
      setStatus("saving");
      const page = await discardBuilderDraft("home", session.accessToken);
      builderDebugLog("discard response content", {
        heroImageUrl: extractHeroImageUrlFromContent(page.draftContent),
      });
      const mappedNodes = pageContentToCraftNodes(page.draftContent);
      builderDebugLog("after pageContentToCraftNodes", {
        heroImageUrl: extractHeroImageUrlFromNodes(mappedNodes),
      });
      setSavedSnapshot({ ...page.draftContent, sections: normalizeList<BuilderSection>((page.draftContent as any)?.sections) });
      setSerialized(mappedNodes);
      setMeta({ updatedAt: page.updatedAt ?? null, publishedAt: page.publishedAt ?? null, version: page.version ?? null });
      setStatus("saved");
      setEditorVersion((v) => v + 1);
      toast.success("Draft reverted");
    } catch (err) {
      setStatus("error");
      toast.error(err instanceof Error ? err.message : "Discard failed");
    }
  };

  if (loading) return <LoadingState label="Loading page builder..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col gap-3">
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Viewport:</span>
          <button className={`px-2 py-1 rounded border ${viewport === "desktop" ? "bg-gray-900 text-white" : "border-gray-300"}`} onClick={() => setViewport("desktop")}><Monitor size={14} /></button>
          <button className={`px-2 py-1 rounded border ${viewport === "tablet" ? "bg-gray-900 text-white" : "border-gray-300"}`} onClick={() => setViewport("tablet")}><Tablet size={14} /></button>
          <button className={`px-2 py-1 rounded border ${viewport === "mobile" ? "bg-gray-900 text-white" : "border-gray-300"}`} onClick={() => setViewport("mobile")}><Smartphone size={14} /></button>
        </div>
        <div className="text-right">
          <span className="block text-xs text-gray-500">Drag presets into canvas, manage sections from the tree, then edit fields in Inspector.</span>
          <span className="block text-[10px] text-gray-400">{BUILD_MARKER}</span>
        </div>
      </div>

      <CraftWorkspace
        key={editorVersion}
        initialData={serialized}
        viewport={viewport}
        products={products}
        onSave={onSave}
        onPublish={onPublish}
        onDiscard={onDiscard}
        onNodesChange={setSerialized}
        status={status}
        updatedAt={meta.updatedAt}
        publishedAt={meta.publishedAt}
        version={meta.version}
        accessToken={session?.accessToken}
      />
    </div>
  );
}
