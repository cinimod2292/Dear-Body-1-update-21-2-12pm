import { type ComponentType, createContext, useContext, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Editor, Element, Frame, useEditor, useNode, type SerializedNode, type SerializedNodes } from "@craftjs/core";
import { Link, useNavigate, useParams } from "react-router";
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Award, Check, CheckCircle2, Clock, Copy, CreditCard, Droplets, Eye, FlaskConical, Gift, Globe, Heart, Leaf, Link2, Loader2, Lock, Monitor, Package, Plus, Redo2, RefreshCcw, Save, Smartphone, Sparkles, Shield, Star, Sun, Tablet, Trash2, Truck, Undo2, Wind, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "../api/client";
import { discardBuilderDraft, fetchAdminBuilderPage, fetchBuilderHistory, publishBuilderDraft, restoreBuilderVersion, saveBuilderDraft } from "../../builder/api";
import { dearBodySectionRegistry } from "../../builder/registry";
import { BenefitIconsSection } from "../../builder/sections/BenefitIconsSection";
import { FeaturedProductsSection } from "../../builder/sections/FeaturedProductsSection";
import { HeroBannerSection } from "../../builder/sections/HeroBannerSection";
import { ImageTextSection } from "../../builder/sections/ImageTextSection";
import { PromoBannerSection } from "../../builder/sections/PromoBannerSection";
import { RichTextSection } from "../../builder/sections/RichTextSection";
import { FaqAccordionSection } from "../../builder/sections/FaqAccordionSection";
import { NewsletterSignupSection } from "../../builder/sections/NewsletterSignupSection";
import { TestimonialsSection } from "../../builder/sections/TestimonialsSection";
import { TrustBadgesSection } from "../../builder/sections/TrustBadgesSection";
import { CountdownBannerSection } from "../../builder/sections/CountdownBannerSection";
import { ImageGallerySection } from "../../builder/sections/ImageGallerySection";
import { VideoBannerSection } from "../../builder/sections/VideoBannerSection";
import { IconFeaturesSection } from "../../builder/sections/IconFeaturesSection";
import { ContactCtaSection } from "../../builder/sections/ContactCtaSection";
import { SpacerSection } from "../../builder/sections/SpacerSection";
import { AnnouncementBarSection } from "../../builder/sections/AnnouncementBarSection";
import { StatsBarSection } from "../../builder/sections/StatsBarSection";
import { IngredientHighlightsSection } from "../../builder/sections/IngredientHighlightsSection";
import { BenefitIconName, BenefitItem, FaqItem, TestimonialItem, GalleryImage, TrustBadgeIconName, TrustBadgeItem, FeatureIconName, FeatureItem, StatItem, IngredientIconName, IngredientItem, BuilderHistoryEntry, BuilderPageContent, BuilderPageKey, BuilderSection, BuilderSectionType, EditableField } from "../../builder/types";
import { fetchStoreProducts, Product } from "../../data/products";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ErrorState, LoadingState } from "../components/AdminState";
import { MediaAsset, PaginatedResult } from "../types/admin";
import { craftNodesToPageContent, pageContentToCraftNodes } from "../../builder/craft-mapper";
import { SECTION_PRESETS } from "../../builder/presets";
import { actionBlockedMessage, isActionAllowed } from "../../builder/action-rules";
import { isSafeImageUrl } from "../../builder/media-url";
import { createSection, duplicateSection, moveSection, removeSection } from "./builder/editor-state";
import { buildSectionList } from "./builder/section-tree";
import { inferInspectorGroup, INSPECTOR_GROUP_ORDER } from "./builder/inspector";
import { extractSelectedNodeId, resolveInspectableSection } from "./builder/section-node";
import { isHeroImageField, mapSelectedMediaVariantToFieldValue, resolveNextImageValue } from "./builder/media-picker";
import { variantKeys } from "../lib/media-variants";
import { BUILD_MARKER, logBuildMarker } from "../../lib/build-marker";
import { normalizeArrayOnly, normalizeList, normalizeLoadContent } from "./builder/load-normalize";

type Status = "unsaved" | "saving" | "saved" | "publishing" | "published" | "error";

const BENEFIT_ICON_OPTIONS: BenefitIconName[] = ["sparkles", "shield", "heart", "leaf", "truck"];

const BENEFIT_ICON_LABELS: Record<BenefitIconName, string> = {
  sparkles: "Sparkles",
  shield: "Shield",
  heart: "Heart",
  leaf: "Leaf",
  truck: "Truck",
};

const BENEFIT_ICON_COMPONENTS: Record<BenefitIconName, ComponentType<any>> = {
  sparkles: Sparkles,
  shield: Shield,
  heart: Heart,
  leaf: Leaf,
  truck: Truck,
};

const OPTION_LABEL_MAP: Record<string, string> = {
  image_right: "Image Right",
  image_left: "Image Left",
  centered: "Centered",
  soft: "Soft",
  clean: "Clean",
  warm: "Warm",
  bold: "Bold",
  dark: "Dark",
  muted: "Muted",
  white: "White",
  manual: "Manual",
  latest: "Latest",
  featured: "Featured",
  "2": "2 Columns",
  "3": "3 Columns",
  "4": "4 Columns",
  narrow: "Narrow",
  standard: "Standard",
  wide: "Wide",
  left: "Left",
  center: "Center",
  row: "Row",
  grid: "Grid",
  sm: "Small",
  md: "Medium",
  lg: "Large",
  xl: "Extra Large",
  light: "Light",
  medium: "Medium",
  pink: "Pink",
  leaf: "Leaf",
  droplets: "Droplets",
  sun: "Sun",
  sparkles: "Sparkles",
  flask: "Flask",
  wind: "Wind",
};

function formatOptionLabel(option: string): string {
  return OPTION_LABEL_MAP[option] ?? option.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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

function BuilderCanvas({ children }: { children?: ReactNode }) {
  const { nodes } = useEditor((state) => ({ nodes: state.nodes }));
  const isEmpty = Object.keys(nodes).length <= 1; // only ROOT node

  if (isEmpty) {
    return (
      <div className="space-y-3 min-h-[400px] flex items-center justify-center">
        <div className="text-center py-16 px-8">
          <div className="text-4xl mb-4">🎨</div>
          <p className="text-gray-700 font-semibold mb-1">Your page is empty</p>
          <p className="text-sm text-gray-400 mb-4">Drag a section preset from the left panel,<br />or click the + button next to any preset.</p>
        </div>
      </div>
    );
  }

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
      <div className="absolute left-2 top-2 z-10 rounded bg-white/95 border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 select-none">
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

function RichTextCraftSection(props: Record<string, unknown>) {
  return <SectionFrame label="Rich Text" enabled={Boolean(props.enabled ?? true)}><RichTextSection {...props as any} /></SectionFrame>;
}
RichTextCraftSection.craft = { displayName: "Rich Text" };

function FaqAccordionCraftSection(props: Record<string, unknown>) {
  return <SectionFrame label="FAQ Accordion" enabled={Boolean(props.enabled ?? true)}><FaqAccordionSection {...props as any} /></SectionFrame>;
}
FaqAccordionCraftSection.craft = { displayName: "FAQ Accordion" };

function NewsletterSignupCraftSection(props: Record<string, unknown>) {
  return <SectionFrame label="Newsletter Signup" enabled={Boolean(props.enabled ?? true)}><NewsletterSignupSection {...props as any} /></SectionFrame>;
}
NewsletterSignupCraftSection.craft = { displayName: "Newsletter Signup" };

function TestimonialsCraftSection(props: Record<string, unknown>) {
  return <SectionFrame label="Testimonials" enabled={Boolean(props.enabled ?? true)}><TestimonialsSection {...props as any} /></SectionFrame>;
}
TestimonialsCraftSection.craft = { displayName: "Testimonials" };

function TrustBadgesCraftSection(props: Record<string, unknown>) {
  return <SectionFrame label="Trust Badges" enabled={Boolean(props.enabled ?? true)}><TrustBadgesSection {...props as any} /></SectionFrame>;
}
TrustBadgesCraftSection.craft = { displayName: "Trust Badges" };

function CountdownBannerCraftSection(props: Record<string, unknown>) {
  return <SectionFrame label="Countdown Timer" enabled={Boolean(props.enabled ?? true)}><CountdownBannerSection {...props as any} /></SectionFrame>;
}
CountdownBannerCraftSection.craft = { displayName: "Countdown Banner" };

function ImageGalleryCraftSection(props: Record<string, unknown>) {
  return <SectionFrame label="Image Gallery" enabled={Boolean(props.enabled ?? true)}><ImageGallerySection {...props as any} /></SectionFrame>;
}
ImageGalleryCraftSection.craft = { displayName: "Image Gallery" };

function VideoBannerCraftSection(props: Record<string, unknown>) {
  return <SectionFrame label="Video Banner" enabled={Boolean(props.enabled ?? true)}><VideoBannerSection {...props as any} /></SectionFrame>;
}
VideoBannerCraftSection.craft = { displayName: "Video Banner" };

function IconFeaturesCraftSection(props: Record<string, unknown>) {
  return <SectionFrame label="Icon Features" enabled={Boolean(props.enabled ?? true)}><IconFeaturesSection {...props as any} /></SectionFrame>;
}
IconFeaturesCraftSection.craft = { displayName: "Icon Features" };

function ContactCtaCraftSection(props: Record<string, unknown>) {
  return <SectionFrame label="Contact CTA" enabled={Boolean(props.enabled ?? true)}><ContactCtaSection {...props as any} /></SectionFrame>;
}
ContactCtaCraftSection.craft = { displayName: "Contact CTA" };

function SpacerCraftSection(props: Record<string, unknown>) {
  return <SectionFrame label="Spacer" enabled={Boolean(props.enabled ?? true)}><SpacerSection {...props as any} /></SectionFrame>;
}
SpacerCraftSection.craft = { displayName: "Spacer" };

function AnnouncementBarCraftSection(props: Record<string, unknown>) {
  return <SectionFrame label="Announcement Bar" enabled={Boolean(props.enabled ?? true)}><AnnouncementBarSection {...props as any} /></SectionFrame>;
}
AnnouncementBarCraftSection.craft = { displayName: "Announcement Bar" };

function StatsBarCraftSection(props: Record<string, unknown>) {
  return <SectionFrame label="Stats Bar" enabled={Boolean(props.enabled ?? true)}><StatsBarSection {...props as any} /></SectionFrame>;
}
StatsBarCraftSection.craft = { displayName: "Stats Bar" };

function IngredientHighlightsCraftSection(props: Record<string, unknown>) {
  return <SectionFrame label="Ingredient Highlights" enabled={Boolean(props.enabled ?? true)}><IngredientHighlightsSection {...props as any} /></SectionFrame>;
}
IngredientHighlightsCraftSection.craft = { displayName: "Ingredient Highlights" };

function resolvedComponent(type: BuilderSectionType) {
  if (type === "hero_banner") return HeroCraftSection;
  if (type === "featured_products") return FeaturedProductsCraftSection;
  if (type === "image_text") return ImageTextCraftSection;
  if (type === "benefit_icons") return BenefitIconsCraftSection;
  if (type === "promo_banner") return PromoBannerCraftSection;
  if (type === "rich_text") return RichTextCraftSection;
  if (type === "faq_accordion") return FaqAccordionCraftSection;
  if (type === "newsletter_signup") return NewsletterSignupCraftSection;
  if (type === "testimonials") return TestimonialsCraftSection;
  if (type === "trust_badges") return TrustBadgesCraftSection;
  if (type === "countdown_banner") return CountdownBannerCraftSection;
  if (type === "image_gallery") return ImageGalleryCraftSection;
  if (type === "video_banner") return VideoBannerCraftSection;
  if (type === "icon_features") return IconFeaturesCraftSection;
  if (type === "contact_cta") return ContactCtaCraftSection;
  if (type === "spacer") return SpacerCraftSection;
  if (type === "announcement_bar") return AnnouncementBarCraftSection;
  if (type === "stats_bar") return StatsBarCraftSection;
  if (type === "ingredient_highlights") return IngredientHighlightsCraftSection;
  throw new Error(`Unknown section type: ${type}`);
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
  const { connectors, actions, query } = useEditor();

  const addPreset = (preset: typeof SECTION_PRESETS[number]) => {
    const content = craftNodesToPageContent(query.getSerializedNodes() as SerializedNodes);
    const newSection = createSection(preset.sectionType, preset.defaultProps);
    const nextSections = [...content.sections, newSection];
    actions.deserialize(pageContentToCraftNodes({ sections: nextSections }));
    setTimeout(() => actions.selectNode(newSection.id), 50);
    toast.success(`${preset.name} added`);
  };

  return (
    <div className="space-y-1.5">
      {SECTION_PRESETS.map((preset) => (
        <div
          key={preset.id}
          className="group flex items-center gap-1 border border-gray-200 rounded-lg bg-white hover:border-pink-300 hover:bg-pink-50/30 transition"
        >
          <div
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
            className="flex-1 cursor-grab active:cursor-grabbing p-2 select-none min-w-0"
          >
            <p className="text-xs font-semibold truncate">{preset.icon} {preset.name}</p>
            <p className="text-[11px] text-gray-400 truncate">{preset.description}</p>
          </div>
          <button
            type="button"
            title="Add to page"
            onClick={() => addPreset(preset)}
            className="flex-shrink-0 p-2 text-gray-400 hover:text-pink-600 transition opacity-0 group-hover:opacity-100"
          ><Plus size={14} /></button>
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
    return (
      <div className="text-xs text-gray-500 border border-dashed border-gray-200 rounded-lg p-3 text-center">
        <p className="mb-1">No sections yet.</p>
        <p>Drag a preset from above into the canvas.</p>
      </div>
    );
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
              <p className="text-[11px] text-gray-400">{section.enabled ? "Visible" : "Hidden"}</p>
            </button>
            <div className="mt-2 grid grid-cols-5 gap-1">
              <button
                type="button"
                title="Move up"
                className="px-1 py-1 rounded border border-gray-200 text-[11px] disabled:opacity-30 hover:border-gray-400 transition"
                disabled={index === 0 || !rules.movable}
                onClick={() => {
                  if (!isActionAllowed(rules, "move")) return toast.error(actionBlockedMessage("move"));
                  applySectionMutation(query, actions, (sectionsData) => moveSection(sectionsData, index, -1), section.nodeId);
                }}
              ><ArrowUp size={12} className="mx-auto" /></button>
              <button
                type="button"
                title="Move down"
                className="px-1 py-1 rounded border border-gray-200 text-[11px] disabled:opacity-30 hover:border-gray-400 transition"
                disabled={index === sections.length - 1 || !rules.movable}
                onClick={() => {
                  if (!isActionAllowed(rules, "move")) return toast.error(actionBlockedMessage("move"));
                  applySectionMutation(query, actions, (sectionsData) => moveSection(sectionsData, index, 1), section.nodeId);
                }}
              ><ArrowDown size={12} className="mx-auto" /></button>
              <button
                type="button"
                title="Duplicate"
                className="px-1 py-1 rounded border border-gray-200 text-[11px] disabled:opacity-30 hover:border-gray-400 transition"
                disabled={!rules.duplicatable}
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
                title={section.enabled ? "Hide section" : "Show section"}
                className="px-1 py-1 rounded border border-gray-200 text-[11px] hover:border-gray-400 transition"
                onClick={() => {
                  actions.setProp(section.nodeId, (props: Record<string, unknown>) => { props.enabled = !Boolean(props.enabled ?? true); });
                }}
              >{section.enabled ? <Eye size={12} className="mx-auto" /> : <Eye size={12} className="mx-auto opacity-40" />}</button>
              <button
                type="button"
                title="Delete section"
                className="px-1 py-1 rounded border border-gray-200 text-[11px] disabled:opacity-30 hover:border-red-300 hover:text-red-600 transition"
                disabled={!rules.removable}
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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadPage = async (pageNum: number, q: string) => {
    if (!accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(pageNum), perPage: "24", kind: "IMAGE", sortBy: "createdAt", sortDir: "desc" });
      if (q.trim()) params.set("q", q.trim());
      const response = await apiRequest<{ data: PaginatedResult<MediaAsset> }>(`/admin/media?${params.toString()}`, {}, accessToken);
      setItems(response.data.items);
      setTotalPages(Math.max(1, Math.ceil((response.data.total ?? response.data.items.length) / 24)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load media");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !accessToken) return;
    setPage(1);
    void loadPage(1, queryText);
  }, [open, accessToken]);

  useEffect(() => {
    if (!open || !accessToken) return;
    const timer = setTimeout(() => {
      setPage(1);
      void loadPage(1, queryText);
    }, 300);
    return () => clearTimeout(timer);
  }, [queryText]);

  const goToPage = (p: number) => {
    setPage(p);
    void loadPage(p, queryText);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Choose image from media library</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100 transition"><X size={16} /></button>
        </div>
        <input
          value={queryText}
          onChange={(event) => setQueryText(event.target.value)}
          placeholder="Search by filename..."
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        {loading ? <div className="text-xs text-gray-500 py-2">Loading...</div> : null}
        {error ? <div className="text-xs text-red-600">{error}</div> : null}
        {!loading && items.length === 0 && !error ? <div className="text-xs text-gray-400 py-4 text-center">No images found.</div> : null}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-[400px] overflow-auto">
          {items.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => onSelect(asset)}
              className="text-left border border-gray-200 rounded-lg p-2 hover:border-pink-400 hover:shadow-sm transition"
            >
              {asset.publicUrl
                ? <img src={asset.publicUrl} alt={asset.altText ?? asset.filename} className="w-full h-24 object-cover rounded mb-1" />
                : <div className="w-full h-24 bg-gray-100 rounded mb-1" />}
              <p className="text-[11px] font-medium truncate">{asset.filename}</p>
            </button>
          ))}
        </div>
        {totalPages > 1 ? (
          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              className="text-xs px-3 py-1.5 rounded border border-gray-200 disabled:opacity-40 hover:border-gray-400 transition"
            >Previous</button>
            <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
              className="text-xs px-3 py-1.5 rounded border border-gray-200 disabled:opacity-40 hover:border-gray-400 transition"
            >Next</button>
          </div>
        ) : null}
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
  const imageValue = toFieldValue(value);
  const isHeroField = isHeroImageField(sectionType, keyName);
  const safe = isSafeImageUrl(imageValue, { isHero: isHeroField });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);

  const setFieldValue = (next: string) => {
    const safeNext = resolveNextImageValue(imageValue, next);
    actions.setProp(selectedNodeId, (props: Record<string, unknown>) => {
      props[keyName] = safeNext;
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
      if (isHeroField) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("alt", file.name);
        const payload = await apiRequest<{ data: any }>("/admin/builder/home/hero-image", { method: "POST", body: fd }, accessToken);
        const data = payload.data as any;
        actions.setProp(selectedNodeId, (props: Record<string, unknown>) => {
          props.imageAssetId = data.imageAssetId;
          props.imageUrl = data.imageUrl;
          props.imageMobileUrl = data.imageMobileUrl;
          props.imageAlt = data.alt || file.name;
        });
        toast.success("Image uploaded");
        return;
      }

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

      let uploadResponse: Response;
      try {
        uploadResponse = await fetch(prep.data.uploadUrl, {
          method: prep.data.method,
          headers: prep.data.headers,
          body: file,
        });
      } catch (error) {
        throw new Error(
          `Upload request failed. Likely a CORS configuration issue. ${error instanceof Error ? error.message : ""}`.trim(),
        );
      }
      if (!uploadResponse.ok) {
        const details = await uploadResponse.text().catch(() => "");
        throw new Error(`Upload failed (${uploadResponse.status})${details ? `: ${details.slice(0, 200)}` : ""}`);
      }

      const finalized = await apiRequest<{ data: MediaAsset; variantsPending?: boolean }>("/admin/media/uploads/finalize", {
        method: "POST",
        body: JSON.stringify({
          storageKey: prep.data.storageKey,
          publicUrl: prep.data.publicUrl,
          kind: "IMAGE",
          metadata: { byteSize: file.size, mimeType: file.type || "application/octet-stream" },
          altText: file.name,
        }),
      }, accessToken);

      const next = mapSelectedMediaVariantToFieldValue(imageValue, finalized.data, ["gallery", "card", "thumbnail"], { allowOriginalFallback: true });
      setFieldValue(next);
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

  const handleLibrarySelect = async (asset: MediaAsset) => {
    void (async () => {
      const preferredKeys = ["gallery", "card", "thumbnail"];
      let resolvedAsset = asset;
      if (accessToken) {
        try {
          const response = await apiRequest<{ data: MediaAsset[] }>("/admin/media/by-ids", {
            method: "POST",
            body: JSON.stringify({ ids: [asset.id], view: "full" }),
          }, accessToken);
          resolvedAsset = response.data[0] ?? asset;
        } catch {
          // fall back to the asset from the list
        }
      }
      builderDebugLog("library selected", { keyName, mediaId: resolvedAsset.id, variantKeys: variantKeys(resolvedAsset.variants) });
      if (isHeroField) {
        actions.setProp(selectedNodeId, (props: Record<string, unknown>) => {
          props.imageAssetId = resolvedAsset.id;
          props.imageUrl = resolvedAsset.publicUrl;
          props.imageMobileUrl = resolvedAsset.publicUrl;
        });
      } else {
        const next = mapSelectedMediaVariantToFieldValue(imageValue, resolvedAsset, preferredKeys, { allowOriginalFallback: true });
        setFieldValue(next);
      }
      setShowLibrary(false);
    })();
  };

  return (
    <div>
      {imageValue
        ? <img src={imageValue} alt={label} className="w-full h-32 rounded-lg border border-gray-200 object-cover mb-2" />
        : <div className="w-full h-20 rounded-lg border border-dashed border-gray-200 mb-2 flex items-center justify-center text-xs text-gray-400">No image selected</div>}
      <input
        type="text"
        className={`w-full rounded-lg border px-3 py-2 text-sm ${safe ? "border-gray-200" : "border-red-400"}`}
        value={imageValue}
        onChange={(event) => setFieldValue(event.target.value)}
        placeholder="https://... or /path/to/image"
      />
      {!safe ? <p className="text-xs text-red-600 mt-1">Use relative or https URLs only.</p> : null}
      {uploadError ? <p className="text-xs text-red-600 mt-1">{uploadError}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <label className="text-xs px-2 py-1.5 rounded border border-gray-300 cursor-pointer hover:border-gray-400 transition">
          {uploading ? <span className="flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Uploading...</span> : "Upload image"}
          <input type="file" accept="image/*" className="hidden" disabled={uploading || !accessToken} onChange={onUploadFile} />
        </label>
        <button
          type="button"
          className="text-xs px-2 py-1.5 rounded border border-gray-300 hover:border-gray-400 transition"
          disabled={!accessToken}
          onClick={() => setShowLibrary(true)}
        >Choose from library</button>
        {imageValue ? (
          <button type="button" className="text-xs px-2 py-1.5 rounded border border-gray-300 hover:border-red-300 hover:text-red-600 transition" onClick={() => setFieldValue("")}>Clear</button>
        ) : null}
      </div>
      <MediaLibraryModal
        open={showLibrary}
        accessToken={accessToken}
        onClose={() => setShowLibrary(false)}
        onSelect={handleLibrarySelect}
      />
    </div>
  );
}

const STOREFRONT_ROUTE_SUGGESTIONS = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Account", href: "/account" },
];

function UrlField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <div className="flex gap-1">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm"
          placeholder="/path or https://..."
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`px-2.5 rounded-lg border text-gray-500 hover:text-gray-800 hover:border-gray-400 transition ${open ? "border-gray-400 bg-gray-50" : "border-gray-200"}`}
          title="Browse pages"
        >
          <Link2 size={14} />
        </button>
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 overflow-hidden">
          <p className="text-[10px] text-gray-400 px-3 pt-2 pb-1 uppercase tracking-wide font-semibold">Storefront pages</p>
          {STOREFRONT_ROUTE_SUGGESTIONS.map((route) => (
            <button
              key={route.href}
              type="button"
              onClick={() => { onChange(route.href); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center justify-between gap-2"
            >
              <span className="text-gray-800">{route.label}</span>
              <span className="text-gray-400 font-mono">{route.href}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BenefitItemsEditor({
  value,
  selectedNodeId,
  actions,
}: {
  value: unknown;
  selectedNodeId: string;
  actions: ReturnType<typeof useEditor>["actions"];
}) {
  const items: BenefitItem[] = Array.isArray(value)
    ? (value as BenefitItem[])
    : [];

  const updateItems = (next: BenefitItem[]) => {
    actions.setProp(selectedNodeId, (props: Record<string, unknown>) => { props.items = next; });
  };

  const updateItem = (index: number, patch: Partial<BenefitItem>) => {
    const next = items.map((item, i) => i === index ? { ...item, ...patch } : item);
    updateItems(next);
  };

  const addItem = () => {
    updateItems([...items, { icon: "sparkles", title: "New benefit", text: "" }]);
  };

  const removeItem = (index: number) => {
    updateItems(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="border border-gray-200 rounded-lg p-2 space-y-2 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-600">Benefit {index + 1}</span>
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="text-gray-400 hover:text-red-500 transition"
              title="Remove"
            ><X size={12} /></button>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Icon</label>
            <div className="grid grid-cols-5 gap-1">
              {BENEFIT_ICON_OPTIONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  title={BENEFIT_ICON_LABELS[icon]}
                  className={`py-1 rounded border flex items-center justify-center ${item.icon === icon ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600"}`}
                  onClick={() => updateItem(index, { icon })}
                >{(() => { const Icon = BENEFIT_ICON_COMPONENTS[icon]; return <Icon size={14} />; })()}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Title</label>
            <input
              type="text"
              value={item.title}
              onChange={(e) => updateItem(index, { title: e.target.value })}
              className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
              placeholder="Benefit title"
            />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Description</label>
            <input
              type="text"
              value={item.text ?? ""}
              onChange={(e) => updateItem(index, { text: e.target.value })}
              className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
              placeholder="Short description"
            />
          </div>
        </div>
      ))}
      {items.length < 8 ? (
        <button
          type="button"
          onClick={addItem}
          className="w-full py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 flex items-center justify-center gap-1 hover:border-pink-400 hover:text-pink-600 transition"
        ><Plus size={12} /> Add benefit</button>
      ) : null}
      {items.length === 0 ? <p className="text-[11px] text-gray-400 text-center py-1">No benefits yet. Click Add benefit.</p> : null}
    </div>
  );
}

function FaqItemsEditor({
  value,
  selectedNodeId,
  actions,
}: {
  value: unknown;
  selectedNodeId: string;
  actions: ReturnType<typeof useEditor>["actions"];
}) {
  const items: FaqItem[] = Array.isArray(value) ? (value as FaqItem[]) : [];

  const updateItems = (next: FaqItem[]) => {
    actions.setProp(selectedNodeId, (props: Record<string, unknown>) => { props.items = next; });
  };

  const updateItem = (index: number, patch: Partial<FaqItem>) => {
    updateItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="border border-gray-200 rounded-lg p-2 space-y-2 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-600">FAQ {index + 1}</span>
            <button type="button" onClick={() => updateItems(items.filter((_, i) => i !== index))} className="text-gray-400 hover:text-red-500 transition"><X size={12} /></button>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Question</label>
            <input type="text" value={item.question} onChange={(e) => updateItem(index, { question: e.target.value })} className="w-full rounded border border-gray-200 px-2 py-1 text-xs" placeholder="FAQ question" />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Answer</label>
            <textarea value={item.answer} onChange={(e) => updateItem(index, { answer: e.target.value })} className="w-full rounded border border-gray-200 px-2 py-1 text-xs min-h-[60px] resize-y" placeholder="FAQ answer" />
          </div>
        </div>
      ))}
      {items.length < 20 ? (
        <button type="button" onClick={() => updateItems([...items, { question: "New question", answer: "Answer here." }])} className="w-full py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 flex items-center justify-center gap-1 hover:border-pink-400 hover:text-pink-600 transition"><Plus size={12} /> Add FAQ item</button>
      ) : null}
      {items.length === 0 ? <p className="text-[11px] text-gray-400 text-center py-1">No FAQ items yet.</p> : null}
    </div>
  );
}

function TestimonialItemsEditor({
  value,
  selectedNodeId,
  actions,
}: {
  value: unknown;
  selectedNodeId: string;
  actions: ReturnType<typeof useEditor>["actions"];
}) {
  const items: TestimonialItem[] = Array.isArray(value) ? (value as TestimonialItem[]) : [];

  const updateItems = (next: TestimonialItem[]) => {
    actions.setProp(selectedNodeId, (props: Record<string, unknown>) => { props.items = next; });
  };

  const updateItem = (index: number, patch: Partial<TestimonialItem>) => {
    updateItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="border border-gray-200 rounded-lg p-2 space-y-2 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-600">Review {index + 1}</span>
            <button type="button" onClick={() => updateItems(items.filter((_, i) => i !== index))} className="text-gray-400 hover:text-red-500 transition"><X size={12} /></button>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Quote</label>
            <textarea value={item.quote} onChange={(e) => updateItem(index, { quote: e.target.value })} className="w-full rounded border border-gray-200 px-2 py-1 text-xs min-h-[60px] resize-y" placeholder="Customer review..." />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Author</label>
            <input type="text" value={item.author} onChange={(e) => updateItem(index, { author: e.target.value })} className="w-full rounded border border-gray-200 px-2 py-1 text-xs" placeholder="Customer name" />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Role / Label</label>
            <input type="text" value={item.role ?? ""} onChange={(e) => updateItem(index, { role: e.target.value })} className="w-full rounded border border-gray-200 px-2 py-1 text-xs" placeholder="e.g. Verified Buyer" />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => updateItem(index, { rating: star })} className="p-0.5">
                  <Star size={16} className={star <= (item.rating ?? 5) ? "text-amber-400 fill-amber-400" : "text-gray-300 fill-gray-300"} />
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
      {items.length < 12 ? (
        <button type="button" onClick={() => updateItems([...items, { quote: "Great product!", author: "Customer Name", role: "Verified Buyer", rating: 5 }])} className="w-full py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 flex items-center justify-center gap-1 hover:border-pink-400 hover:text-pink-600 transition"><Plus size={12} /> Add testimonial</button>
      ) : null}
      {items.length === 0 ? <p className="text-[11px] text-gray-400 text-center py-1">No testimonials yet.</p> : null}
    </div>
  );
}

const TRUST_BADGE_OPTIONS: TrustBadgeIconName[] = ["lock", "credit_card", "money_back", "fast_shipping", "package", "award", "star", "shield"];
const TRUST_BADGE_LABELS: Record<TrustBadgeIconName, string> = { lock: "Lock", credit_card: "Card", money_back: "Return", fast_shipping: "Fast", package: "Package", award: "Award", star: "Star", shield: "Shield" };
const TRUST_BADGE_COMPONENTS: Record<TrustBadgeIconName, ComponentType<any>> = { lock: Lock, credit_card: CreditCard, money_back: RefreshCcw, fast_shipping: Zap, package: Package, award: Award, star: Star, shield: Shield };

function TrustBadgeItemsEditor({
  value,
  selectedNodeId,
  actions,
}: {
  value: unknown;
  selectedNodeId: string;
  actions: ReturnType<typeof useEditor>["actions"];
}) {
  const items: TrustBadgeItem[] = Array.isArray(value) ? (value as TrustBadgeItem[]) : [];

  const updateItems = (next: TrustBadgeItem[]) => {
    actions.setProp(selectedNodeId, (props: Record<string, unknown>) => { props.items = next; });
  };

  const updateItem = (index: number, patch: Partial<TrustBadgeItem>) => {
    updateItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="border border-gray-200 rounded-lg p-2 space-y-2 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-600">Badge {index + 1}</span>
            <button type="button" onClick={() => updateItems(items.filter((_, i) => i !== index))} className="text-gray-400 hover:text-red-500 transition"><X size={12} /></button>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Icon</label>
            <div className="grid grid-cols-4 gap-1">
              {TRUST_BADGE_OPTIONS.map((icon) => (
                <button key={icon} type="button" title={TRUST_BADGE_LABELS[icon]} className={`py-1 rounded border flex items-center justify-center ${item.icon === icon ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600"}`} onClick={() => updateItem(index, { icon })}>
                  {(() => { const Icon = TRUST_BADGE_COMPONENTS[icon]; return <Icon size={14} />; })()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Label</label>
            <input type="text" value={item.label} onChange={(e) => updateItem(index, { label: e.target.value })} className="w-full rounded border border-gray-200 px-2 py-1 text-xs" placeholder="Badge label" />
          </div>
        </div>
      ))}
      {items.length < 8 ? (
        <button type="button" onClick={() => updateItems([...items, { icon: "shield" as TrustBadgeIconName, label: "New badge" }])} className="w-full py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 flex items-center justify-center gap-1 hover:border-pink-400 hover:text-pink-600 transition"><Plus size={12} /> Add badge</button>
      ) : null}
      {items.length === 0 ? <p className="text-[11px] text-gray-400 text-center py-1">No badges yet.</p> : null}
    </div>
  );
}

const FEATURE_ICON_OPTIONS: FeatureIconName[] = ["check", "star", "zap", "gift", "globe", "award", "clock", "sparkles", "shield", "heart", "leaf", "truck"];
const FEATURE_ICON_LABELS: Record<FeatureIconName, string> = { check: "Check", star: "Star", zap: "Zap", gift: "Gift", globe: "Globe", award: "Award", clock: "Clock", sparkles: "Sparkles", shield: "Shield", heart: "Heart", leaf: "Leaf", truck: "Truck" };
const FEATURE_ICON_COMPONENTS: Record<FeatureIconName, ComponentType<any>> = { check: CheckCircle2, star: Star, zap: Zap, gift: Gift, globe: Globe, award: Award, clock: Clock, sparkles: Sparkles, shield: Shield, heart: Heart, leaf: Leaf, truck: Truck };

function FeatureItemsEditor({
  value,
  selectedNodeId,
  actions,
}: {
  value: unknown;
  selectedNodeId: string;
  actions: ReturnType<typeof useEditor>["actions"];
}) {
  const items: FeatureItem[] = Array.isArray(value) ? (value as FeatureItem[]) : [];

  const updateItems = (next: FeatureItem[]) => {
    actions.setProp(selectedNodeId, (props: Record<string, unknown>) => { props.items = next; });
  };

  const updateItem = (index: number, patch: Partial<FeatureItem>) => {
    updateItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="border border-gray-200 rounded-lg p-2 space-y-2 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-600">Feature {index + 1}</span>
            <button type="button" onClick={() => updateItems(items.filter((_, i) => i !== index))} className="text-gray-400 hover:text-red-500 transition"><X size={12} /></button>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Icon</label>
            <div className="grid grid-cols-6 gap-1">
              {FEATURE_ICON_OPTIONS.map((icon) => (
                <button key={icon} type="button" title={FEATURE_ICON_LABELS[icon]} className={`py-1 rounded border flex items-center justify-center ${item.icon === icon ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600"}`} onClick={() => updateItem(index, { icon })}>
                  {(() => { const Icon = FEATURE_ICON_COMPONENTS[icon]; return <Icon size={12} />; })()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Title</label>
            <input type="text" value={item.title} onChange={(e) => updateItem(index, { title: e.target.value })} className="w-full rounded border border-gray-200 px-2 py-1 text-xs" placeholder="Feature title" />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Description</label>
            <textarea value={item.description ?? ""} onChange={(e) => updateItem(index, { description: e.target.value })} className="w-full rounded border border-gray-200 px-2 py-1 text-xs min-h-[48px] resize-y" placeholder="Short description" />
          </div>
        </div>
      ))}
      {items.length < 12 ? (
        <button type="button" onClick={() => updateItems([...items, { icon: "sparkles" as FeatureIconName, title: "New feature", description: "" }])} className="w-full py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 flex items-center justify-center gap-1 hover:border-pink-400 hover:text-pink-600 transition"><Plus size={12} /> Add feature</button>
      ) : null}
      {items.length === 0 ? <p className="text-[11px] text-gray-400 text-center py-1">No features yet.</p> : null}
    </div>
  );
}

function GalleryImagesEditor({
  value,
  selectedNodeId,
  actions,
  accessToken,
}: {
  value: unknown;
  selectedNodeId: string;
  actions: ReturnType<typeof useEditor>["actions"];
  accessToken?: string;
}) {
  const items: GalleryImage[] = Array.isArray(value) ? (value as GalleryImage[]) : [];
  const [showLibrary, setShowLibrary] = useState(false);
  const [addingIndex, setAddingIndex] = useState<number | null>(null);

  const updateItems = (next: GalleryImage[]) => {
    actions.setProp(selectedNodeId, (props: Record<string, unknown>) => { props.images = next; });
  };

  const updateItem = (index: number, patch: Partial<GalleryImage>) => {
    updateItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const handleLibrarySelect = (asset: import("../../types/admin").MediaAsset) => {
    const url = asset.publicUrl ?? "";
    if (addingIndex !== null) {
      updateItem(addingIndex, { url });
    } else {
      updateItems([...items, { url, alt: asset.altText ?? asset.filename }]);
    }
    setAddingIndex(null);
    setShowLibrary(false);
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="border border-gray-200 rounded-lg p-2 space-y-1 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-600">Image {index + 1}</span>
            <button type="button" onClick={() => updateItems(items.filter((_, i) => i !== index))} className="text-gray-400 hover:text-red-500 transition"><X size={12} /></button>
          </div>
          {item.url ? (
            <img src={item.url} alt={item.alt} className="w-full h-20 object-cover rounded border border-gray-200" />
          ) : (
            <div className="w-full h-12 bg-gray-100 rounded border border-dashed border-gray-300 flex items-center justify-center text-[11px] text-gray-400">No image</div>
          )}
          <div className="flex gap-1">
            <button type="button" className="text-xs px-2 py-1 rounded border border-gray-200 hover:border-gray-400 transition flex-1" onClick={() => { setAddingIndex(index); setShowLibrary(true); }}>Change</button>
            <button type="button" className="text-xs px-2 py-1 rounded border border-gray-200 hover:border-red-300 hover:text-red-600 transition" onClick={() => updateItem(index, { url: "" })}>Clear</button>
          </div>
          <input type="text" value={item.alt ?? ""} onChange={(e) => updateItem(index, { alt: e.target.value })} className="w-full rounded border border-gray-200 px-2 py-1 text-xs" placeholder="Alt text" />
        </div>
      ))}
      {items.length < 24 ? (
        <button type="button" onClick={() => { setAddingIndex(null); setShowLibrary(true); }} className="w-full py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 flex items-center justify-center gap-1 hover:border-pink-400 hover:text-pink-600 transition"><Plus size={12} /> Add image</button>
      ) : null}
      {items.length === 0 ? <p className="text-[11px] text-gray-400 text-center py-1">No images yet.</p> : null}
      <MediaLibraryModal open={showLibrary} accessToken={accessToken} onClose={() => { setShowLibrary(false); setAddingIndex(null); }} onSelect={handleLibrarySelect} />
    </div>
  );
}

function StatItemsEditor({ value, selectedNodeId, actions }: { value: unknown; selectedNodeId: string; actions: ReturnType<typeof useEditor>["actions"] }) {
  const items: StatItem[] = Array.isArray(value) ? (value as StatItem[]) : [];
  const updateItems = (next: StatItem[]) => actions.setProp(selectedNodeId, (props: Record<string, unknown>) => { props.items = next; });
  const updateItem = (index: number, patch: Partial<StatItem>) => updateItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="border border-gray-200 rounded-lg p-2 space-y-1.5 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-600">Stat {index + 1}</span>
            <button type="button" onClick={() => updateItems(items.filter((_, i) => i !== index))} className="text-gray-400 hover:text-red-500 transition"><X size={12} /></button>
          </div>
          <input type="text" value={item.value ?? ""} onChange={(e) => updateItem(index, { value: e.target.value })} className="w-full rounded border border-gray-200 px-2 py-1 text-xs font-bold" placeholder="e.g. 10,000+" />
          <input type="text" value={item.label ?? ""} onChange={(e) => updateItem(index, { label: e.target.value })} className="w-full rounded border border-gray-200 px-2 py-1 text-xs" placeholder="Label" />
        </div>
      ))}
      {items.length < 8 ? (
        <button type="button" onClick={() => updateItems([...items, { value: "0+", label: "New stat" }])} className="w-full py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 flex items-center justify-center gap-1 hover:border-pink-400 hover:text-pink-600 transition"><Plus size={12} /> Add stat</button>
      ) : null}
    </div>
  );
}

const INGREDIENT_ICON_OPTIONS: IngredientIconName[] = ["leaf", "droplets", "sun", "sparkles", "flask", "wind"];
const INGREDIENT_ICON_LABELS: Record<IngredientIconName, string> = { leaf: "Leaf", droplets: "Droplets", sun: "Sun", sparkles: "Sparkles", flask: "Flask", wind: "Wind" };
const INGREDIENT_ICON_COMPONENTS: Record<IngredientIconName, ComponentType<any>> = { leaf: Leaf, droplets: Droplets, sun: Sun, sparkles: Sparkles, flask: FlaskConical, wind: Wind };

function IngredientItemsEditor({ value, selectedNodeId, actions }: { value: unknown; selectedNodeId: string; actions: ReturnType<typeof useEditor>["actions"] }) {
  const items: IngredientItem[] = Array.isArray(value) ? (value as IngredientItem[]) : [];
  const updateItems = (next: IngredientItem[]) => actions.setProp(selectedNodeId, (props: Record<string, unknown>) => { props.items = next; });
  const updateItem = (index: number, patch: Partial<IngredientItem>) => updateItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="border border-gray-200 rounded-lg p-2 space-y-1.5 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-600">Ingredient {index + 1}</span>
            <button type="button" onClick={() => updateItems(items.filter((_, i) => i !== index))} className="text-gray-400 hover:text-red-500 transition"><X size={12} /></button>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Icon</label>
            <div className="grid grid-cols-6 gap-1">
              {INGREDIENT_ICON_OPTIONS.map((icon) => (
                <button key={icon} type="button" title={INGREDIENT_ICON_LABELS[icon]} className={`py-1 rounded border flex items-center justify-center ${item.icon === icon ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600"}`} onClick={() => updateItem(index, { icon })}>
                  {(() => { const Icon = INGREDIENT_ICON_COMPONENTS[icon]; return <Icon size={12} />; })()}
                </button>
              ))}
            </div>
          </div>
          <input type="text" value={item.name ?? ""} onChange={(e) => updateItem(index, { name: e.target.value })} className="w-full rounded border border-gray-200 px-2 py-1 text-xs font-semibold" placeholder="Ingredient name" />
          <textarea value={item.benefit ?? ""} onChange={(e) => updateItem(index, { benefit: e.target.value })} className="w-full rounded border border-gray-200 px-2 py-1 text-xs min-h-[40px] resize-y" placeholder="Short benefit" />
        </div>
      ))}
      {items.length < 12 ? (
        <button type="button" onClick={() => updateItems([...items, { icon: "leaf" as IngredientIconName, name: "New ingredient", benefit: "" }])} className="w-full py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 flex items-center justify-center gap-1 hover:border-pink-400 hover:text-pink-600 transition"><Plus size={12} /> Add ingredient</button>
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

  if (field.type === "benefit_items") {
    return <BenefitItemsEditor value={value} selectedNodeId={selectedNodeId} actions={actions} />;
  }

  if (field.type === "faq_items") {
    return <FaqItemsEditor value={value} selectedNodeId={selectedNodeId} actions={actions} />;
  }

  if (field.type === "testimonial_items") {
    return <TestimonialItemsEditor value={value} selectedNodeId={selectedNodeId} actions={actions} />;
  }

  if (field.type === "trust_badge_items") {
    return <TrustBadgeItemsEditor value={value} selectedNodeId={selectedNodeId} actions={actions} />;
  }

  if (field.type === "feature_items") {
    return <FeatureItemsEditor value={value} selectedNodeId={selectedNodeId} actions={actions} />;
  }

  if (field.type === "gallery_images") {
    return <GalleryImagesEditor value={value} selectedNodeId={selectedNodeId} actions={actions} accessToken={accessToken} />;
  }

  if (field.type === "stat_items") {
    return <StatItemsEditor value={value} selectedNodeId={selectedNodeId} actions={actions} />;
  }

  if (field.type === "ingredient_items") {
    return <IngredientItemsEditor value={value} selectedNodeId={selectedNodeId} actions={actions} />;
  }

  if (sectionType === "featured_products" && keyName === "mode") {
    return (
      <div className="grid grid-cols-3 gap-2">
        {(["latest", "featured", "manual"] as const).map((option) => (
          <button key={option} type="button" className={`px-2 py-2 rounded-lg border text-xs ${String(value ?? "latest") === option ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 hover:border-gray-400"} transition`} onClick={() => actions.setProp(selectedNodeId, (props: Record<string, unknown>) => { props.mode = option; })}>{formatOptionLabel(option)}</button>
        ))}
      </div>
    );
  }

  if (sectionType === "featured_products" && keyName === "productIds" && nodeProps.mode === "manual") {
    const selectedIds = Array.isArray(value) ? value.map(String) : [];
    return (
      <div>
        <div className="max-h-40 overflow-auto border border-gray-200 rounded-lg p-2 space-y-1">
          {products.length === 0 ? <p className="text-xs text-gray-400 py-1 text-center">No products available.</p> : null}
          {products.slice(0, 40).map((product) => {
            const checked = selectedIds.includes(product.id);
            return (
              <label key={product.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 px-1 rounded">
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
        <p className="text-[11px] text-gray-400 mt-1">{selectedIds.length} product{selectedIds.length !== 1 ? "s" : ""} selected</p>
      </div>
    );
  }

  if (field.type === "textarea") {
    return <textarea className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-20 resize-y" value={toFieldValue(value)} onChange={(event) => actions.setProp(selectedNodeId, (props: Record<string, unknown>) => { props[keyName] = event.target.value; })} />;
  }

  if (field.type === "select") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {(field.options ?? []).map((option) => (
          <button key={option} type="button" className={`px-2 py-2 rounded-lg border text-xs ${String(value ?? "") === option ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 hover:border-gray-400"} transition`} onClick={() => actions.setProp(selectedNodeId, (props: Record<string, unknown>) => { props[keyName] = option; })}>{formatOptionLabel(option)}</button>
        ))}
      </div>
    );
  }

  if (field.type === "number") {
    return <input type="number" min={field.min} max={field.max} value={Number(value ?? 0)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" onChange={(event) => actions.setProp(selectedNodeId, (props: Record<string, unknown>) => { props[keyName] = Number(event.target.value); })} />;
  }

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => actions.setProp(selectedNodeId, (props: Record<string, unknown>) => { props[keyName] = event.target.checked; })} />
        <span className="text-xs text-gray-600">{field.label}</span>
      </label>
    );
  }

  if (field.type === "image") {
    return <InspectorImageField label={field.label} value={value} selectedNodeId={selectedNodeId} keyName={keyName} sectionType={sectionType} actions={actions} query={query} accessToken={accessToken} />;
  }

  if (field.type === "url") {
    return <UrlField value={toFieldValue(value)} onChange={(v) => actions.setProp(selectedNodeId, (props: Record<string, unknown>) => { props[keyName] = v; })} />;
  }

  return <input type="text" value={toFieldValue(value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" onChange={(event) => actions.setProp(selectedNodeId, (props: Record<string, unknown>) => { props[keyName] = event.target.value; })} />;
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
    return (
      <div className="text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg p-4 text-center">
        <p className="font-medium text-gray-500 mb-1">No section selected</p>
        <p className="text-xs">Click any section in the canvas or section tree to edit its settings.</p>
      </div>
    );
  }

  const resolvedSection = resolveInspectableSection(selectedNodeId, selectedNode, dearBodySectionRegistry);
  if (!resolvedSection) {
    return <div className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg p-3">Selected node is not an editable section.</div>;
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
        <p className="text-sm font-semibold">{registry.icon} {registry.displayName}</p>
        <p className="text-xs text-gray-500 mt-0.5">{registry.description}</p>
      </div>

      <label className="flex items-center justify-between text-sm border border-gray-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50">
        <span className="font-medium">Visible</span>
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
                <label className="block text-xs text-gray-600 mb-1 font-medium">{field.label}{field.required ? <span className="text-red-500 ml-0.5">*</span> : null}</label>
                {renderFieldControl({ keyName, field, value: nodeProps[keyName], selectedNodeId, sectionType, nodeProps, products, actions, query, accessToken })}
              </div>
            ))}
          </section>
        );
      })}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!rules.duplicatable}
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
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm inline-flex items-center justify-center gap-1 disabled:opacity-40 hover:border-gray-400 transition"
        ><Copy size={14} /> Duplicate</button>

        <button
          type="button"
          disabled={!rules.removable}
          onClick={() => {
            if (!isActionAllowed(rules, "remove")) return toast.error(actionBlockedMessage("remove"));
            actions.delete(selectedNodeId);
          }}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm inline-flex items-center justify-center gap-1 disabled:opacity-40 hover:border-red-300 hover:text-red-600 transition"
        ><Trash2 size={14} /> Delete</button>
      </div>
    </div>
  );
}

function BuilderTopActions({ status, onSave, onPublish, onDiscard, updatedAt, publishedAt, version, unsaved }: {
  status: Status;
  onSave: (nodes: SerializedNodes) => Promise<void>;
  onPublish: (nodes: SerializedNodes) => Promise<void>;
  onDiscard: () => Promise<void>;
  updatedAt?: string | null;
  publishedAt?: string | null;
  version?: number | null;
  unsaved: boolean;
}) {
  const { query, actions, canUndo, canRedo } = useEditor((state) => {
    const s = state as any;
    const past = s.history?.past ?? s.options?.history?.past ?? [];
    const future = s.history?.future ?? s.options?.history?.future ?? [];
    return {
      canUndo: Array.isArray(past) && past.length > 0,
      canRedo: Array.isArray(future) && future.length > 0,
    };
  });
  const [busy, setBusy] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);

  const isBusy = busy || status === "saving" || status === "publishing";

  // Cmd+S / Ctrl+S keyboard shortcut for saving
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        if (isBusy) return;
        setBusy(true);
        onSave(query.getSerializedNodes() as SerializedNodes)
          .finally(() => setBusy(false));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isBusy, onSave, query]);

  const statusLabel =
    status === "saving" ? "Saving..." :
    status === "saved" ? "Draft saved" :
    status === "publishing" ? "Publishing..." :
    status === "published" ? "Published" :
    status === "error" ? "Error" :
    unsaved ? "Unsaved changes" : "Draft saved";

  const statusClass =
    status === "error" ? "bg-red-100 text-red-700" :
    (status === "published" || status === "saved" || !unsaved) ? "bg-emerald-100 text-emerald-700" :
    "bg-amber-100 text-amber-700";

  return (
    <header className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusClass}`}>{statusLabel}</span>
        {version ? <span className="text-xs text-gray-400">v{version}</span> : null}
        {updatedAt ? <span className="text-xs text-gray-400 hidden xl:inline">Saved {new Date(updatedAt).toLocaleString()}</span> : null}
        {publishedAt ? <span className="text-xs text-gray-400 hidden xl:inline">Published {new Date(publishedAt).toLocaleString()}</span> : null}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          disabled={!canUndo}
          onClick={() => actions.history.undo()}
          title="Undo"
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm inline-flex items-center gap-1.5 disabled:opacity-40 hover:border-gray-400 transition"
        ><Undo2 size={14} /> Undo</button>
        <button
          type="button"
          disabled={!canRedo}
          onClick={() => actions.history.redo()}
          title="Redo"
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm inline-flex items-center gap-1.5 disabled:opacity-40 hover:border-gray-400 transition"
        ><Redo2 size={14} /> Redo</button>

        <Link
          to="/?preview=builder"
          target="_blank"
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm inline-flex items-center gap-1.5 hover:border-gray-400 transition"
          title={unsaved ? "Save draft first to see latest changes in preview" : "Preview draft"}
        >
          <Eye size={14} />
          Preview
          {unsaved ? <AlertTriangle size={12} className="text-amber-500" /> : null}
        </Link>

        <button
          type="button"
          disabled={isBusy}
          onClick={async () => {
            setBusy(true);
            try { await onSave(query.getSerializedNodes() as SerializedNodes); }
            finally { setBusy(false); }
          }}
          title="Save draft (Cmd+S)"
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm inline-flex items-center gap-1.5 disabled:opacity-40 hover:border-gray-400 transition"
        ><Save size={14} /> Save Draft</button>

        {publishConfirm ? (
          <div className="flex items-center gap-1.5 bg-gray-900 rounded-lg px-3 py-2">
            <span className="text-white text-xs">Go live?</span>
            <button
              type="button"
              disabled={isBusy}
              onClick={async () => {
                setPublishConfirm(false);
                setBusy(true);
                try { await onPublish(query.getSerializedNodes() as SerializedNodes); }
                finally { setBusy(false); }
              }}
              className="px-2 py-0.5 rounded bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1 hover:bg-emerald-600 transition"
            ><Check size={11} /> Yes</button>
            <button type="button" onClick={() => setPublishConfirm(false)} className="px-2 py-0.5 rounded bg-white/20 text-white text-xs hover:bg-white/30 transition"><X size={11} /></button>
          </div>
        ) : (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => setPublishConfirm(true)}
            className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm inline-flex items-center gap-1.5 disabled:opacity-40 hover:bg-gray-700 transition"
          >
            {status === "publishing" || busy ? <Loader2 className="animate-spin" size={14} /> : null}
            Publish
          </button>
        )}

        {discardConfirm ? (
          <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <span className="text-red-700 text-xs">Discard changes?</span>
            <button
              type="button"
              onClick={async () => {
                setDiscardConfirm(false);
                await onDiscard();
              }}
              className="px-2 py-0.5 rounded bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition"
            >Yes</button>
            <button type="button" onClick={() => setDiscardConfirm(false)} className="px-2 py-0.5 rounded border border-red-200 text-red-600 text-xs hover:bg-red-100 transition">No</button>
          </div>
        ) : (
          <button
            type="button"
            disabled={isBusy}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm hover:border-gray-400 disabled:opacity-40 transition"
            onClick={() => setDiscardConfirm(true)}
          >Discard</button>
        )}
      </div>
    </header>
  );
}

function SeoPanel({ seoData, onSeoChange, accessToken }: { seoData: import("../../builder/types").BuilderSeo; onSeoChange: (next: import("../../builder/types").BuilderSeo) => void; accessToken?: string }) {
  const [open, setOpen] = useState(false);
  const [showOgLibrary, setShowOgLibrary] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition text-left"
      >
        <span className="text-xs font-semibold text-gray-700">SEO Settings</span>
        <span className="text-gray-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div className="p-3 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">Page Title</label>
            <input
              type="text"
              value={seoData.title ?? ""}
              onChange={(e) => onSeoChange({ ...seoData, title: e.target.value })}
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs"
              placeholder="Dear Body — Homepage"
              maxLength={120}
            />
            <p className="text-[10px] text-gray-400 mt-0.5">{(seoData.title ?? "").length}/120 chars</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">Meta Description</label>
            <textarea
              value={seoData.description ?? ""}
              onChange={(e) => onSeoChange({ ...seoData, description: e.target.value })}
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs min-h-16 resize-y"
              placeholder="Discover our bold collection of body sprays and skincare."
              maxLength={320}
            />
            <p className="text-[10px] text-gray-400 mt-0.5">{(seoData.description ?? "").length}/320 chars · Ideal: 120–160</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">OG Image</label>
            {seoData.ogImage ? (
              <div className="mb-1.5 relative rounded border border-gray-200 overflow-hidden bg-gray-50">
                <img src={seoData.ogImage} alt="OG preview" className="w-full h-24 object-cover" />
                <button
                  type="button"
                  onClick={() => onSeoChange({ ...seoData, ogImage: undefined })}
                  className="absolute top-1 right-1 bg-white/90 rounded p-0.5 text-gray-500 hover:text-red-500 transition"
                  title="Remove image"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div className="mb-1.5 w-full h-16 rounded border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-[11px] text-gray-400">
                No OG image set
              </div>
            )}
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={!accessToken}
                onClick={() => setShowOgLibrary(true)}
                className="flex-1 text-xs px-2 py-1.5 rounded border border-gray-300 hover:border-gray-400 transition disabled:opacity-40"
              >
                Choose from library
              </button>
              {seoData.ogImage ? (
                <button
                  type="button"
                  onClick={() => onSeoChange({ ...seoData, ogImage: undefined })}
                  className="text-xs px-2 py-1.5 rounded border border-gray-300 hover:border-red-300 hover:text-red-600 transition"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <input
              type="text"
              value={seoData.ogImage ?? ""}
              onChange={(e) => onSeoChange({ ...seoData, ogImage: e.target.value || undefined })}
              className="mt-1.5 w-full rounded border border-gray-200 px-2 py-1.5 text-xs"
              placeholder="Or paste a URL directly…"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">Shown when shared on social media (1200×630 recommended)</p>
          </div>
        </div>
      ) : null}
      <MediaLibraryModal
        open={showOgLibrary}
        accessToken={accessToken}
        onClose={() => setShowOgLibrary(false)}
        onSelect={(asset) => {
          onSeoChange({ ...seoData, ogImage: asset.publicUrl ?? "" });
          setShowOgLibrary(false);
        }}
      />
    </div>
  );
}

function HistoryPanel({ pageKey, accessToken, onRestore }: {
  pageKey: string;
  accessToken?: string;
  onRestore: (version: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<BuilderHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !accessToken) return;
    setLoadingHistory(true);
    fetchBuilderHistory(pageKey, accessToken)
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [open, accessToken, pageKey]);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition text-left"
      >
        <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"><Clock size={12} /> Publish History</span>
        <span className="text-gray-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div className="p-3">
          {loadingHistory ? (
            <p className="text-xs text-gray-400 py-2 text-center">Loading...</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-gray-400 py-2 text-center">No publish history yet.</p>
          ) : (
            <div className="space-y-1">
              {history.map((entry) => (
                <div key={entry.version} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-100 last:border-0">
                  <div>
                    <span className="text-xs font-medium text-gray-800">v{entry.version}</span>
                    <span className="ml-2 text-[11px] text-gray-400">{new Date(entry.publishedAt).toLocaleString()}</span>
                  </div>
                  <button
                    type="button"
                    disabled={restoring !== null}
                    onClick={async () => {
                      setRestoring(entry.version);
                      try { await onRestore(entry.version); }
                      finally { setRestoring(null); }
                    }}
                    className="text-[11px] px-2 py-0.5 rounded border border-gray-200 text-gray-600 hover:border-gray-400 disabled:opacity-40 transition whitespace-nowrap"
                  >
                    {restoring === entry.version ? "..." : "Restore"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CraftWorkspace({ initialData, viewport, products, onSave, onPublish, onDiscard, onNodesChange, status, updatedAt, publishedAt, version, accessToken, unsaved, seoData, onSeoChange, pageKey, previewContent, onRestore }: {
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
  unsaved: boolean;
  seoData: import("../../builder/types").BuilderSeo;
  onSeoChange: (next: import("../../builder/types").BuilderSeo) => void;
  pageKey: string;
  previewContent: BuilderPageContent;
  onRestore: (version: number) => Promise<void>;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeDocHeight, setIframeDocHeight] = useState(2400);

  // Receive height reports from preview iframe
  useEffect(() => {
    const handler = (ev: MessageEvent) => {
      if (ev.data?.type === "BUILDER_PREVIEW_HEIGHT") {
        setIframeDocHeight(Math.max(Number(ev.data.height) || 2400, 400));
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Push current content into the iframe whenever it changes or viewport switches
  useEffect(() => {
    if (viewport === "desktop") return;
    iframeRef.current?.contentWindow?.postMessage({ type: "BUILDER_PREVIEW_CONTENT", content: previewContent }, "*");
  }, [previewContent, viewport]);

  const targetWidth = viewport === "mobile" ? 390 : 768;

  return (
    <CraftProductsContext.Provider value={products}>
      <Editor
        resolver={{ BuilderCanvas, HeroCraftSection, FeaturedProductsCraftSection, ImageTextCraftSection, BenefitIconsCraftSection, PromoBannerCraftSection, RichTextCraftSection, FaqAccordionCraftSection, NewsletterSignupCraftSection, TestimonialsCraftSection, TrustBadgesCraftSection, CountdownBannerCraftSection, ImageGalleryCraftSection, VideoBannerCraftSection, IconFeaturesCraftSection, ContactCtaCraftSection, SpacerCraftSection, AnnouncementBarCraftSection, StatsBarCraftSection, IngredientHighlightsCraftSection }}
        enabled
        onNodesChange={(query) => {
          const nextNodes = query.getSerializedNodes() as SerializedNodes;
          if (nextNodes) onNodesChange(nextNodes);
        }}
      >
        <BuilderTopActions status={status} onSave={onSave} onPublish={onPublish} onDiscard={onDiscard} updatedAt={updatedAt} publishedAt={publishedAt} version={version} unsaved={unsaved} />
        <div className="min-h-0 flex-1 grid grid-cols-1 lg:grid-cols-[320px_1fr_360px] gap-3">
          <aside className="bg-white border border-gray-200 rounded-xl p-3 overflow-auto space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">Section Library</p>
              <p className="text-[11px] text-gray-400 mb-3">Drag a preset into the canvas, or click + to add.</p>
              <SectionLibrary />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-3">Page Sections</p>
              <SectionList />
            </div>
            <SeoPanel seoData={seoData} onSeoChange={onSeoChange} accessToken={accessToken} />
            <HistoryPanel pageKey={pageKey} accessToken={accessToken} onRestore={onRestore} />
          </aside>
          <main className="bg-gray-100 border border-gray-200 rounded-xl p-4 overflow-auto">
            {/* Craft.js editor canvas — always mounted so editor state is preserved */}
            <div
              className={viewport === "desktop" ? "mx-auto max-w-[1200px] transition-all duration-300" : ""}
              style={viewport !== "desktop" ? { position: "absolute", visibility: "hidden", pointerEvents: "none", width: "1px", height: "1px", overflow: "hidden" } : undefined}
            >
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <Frame data={initialData}><Element is={BuilderCanvas} canvas /></Frame>
              </div>
            </div>

            {/* Scaled iframe for mobile/tablet — shows true responsive breakpoints */}
            {viewport !== "desktop" && (
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="flex items-center gap-2 text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1">
                  {viewport === "mobile" ? <Smartphone size={12} /> : <Tablet size={12} />}
                  <span>{viewport === "mobile" ? "Mobile · 390px" : "Tablet · 768px"} — true responsive preview · edit in Desktop mode</span>
                </div>
                <div className="shadow-xl rounded-xl overflow-hidden border border-gray-300" style={{ width: targetWidth }}>
                  <iframe
                    key={viewport}
                    ref={iframeRef}
                    src="/builder-preview"
                    style={{ width: targetWidth, height: iframeDocHeight, border: "none", display: "block" }}
                    title={`${viewport} preview`}
                    onLoad={() => {
                      iframeRef.current?.contentWindow?.postMessage({ type: "BUILDER_PREVIEW_CONTENT", content: previewContent }, "*");
                    }}
                  />
                </div>
              </div>
            )}
          </main>
          <aside className="bg-white border border-gray-200 rounded-xl p-3 overflow-auto">
            <p className="text-sm font-semibold text-gray-900 mb-3">Inspector</p>
            <SelectedSectionInspector accessToken={accessToken} />
          </aside>
        </div>
      </Editor>
    </CraftProductsContext.Provider>
  );
}

export default function AdminBuilderHome() {
  const { session } = useAdminAuth();
  const navigate = useNavigate();
  const { pageKey: rawPageKey } = useParams<{ pageKey?: string }>();
  const pageKey = (rawPageKey ?? "home") as BuilderPageKey;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [serialized, setSerialized] = useState<SerializedNodes>(pageContentToCraftNodes({ sections: [] }));
  const [editorVersion, setEditorVersion] = useState(0);
  const [savedSnapshot, setSavedSnapshot] = useState<BuilderPageContent>({ sections: [] });
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [status, setStatus] = useState<Status>("saved");
  const [meta, setMeta] = useState<{ updatedAt?: string | null; publishedAt?: string | null; version?: number | null }>({});
  const [seoData, setSeoData] = useState<import("../../builder/types").BuilderSeo>({});
  const previewContent = useMemo(() => craftNodesToPageContent(serialized), [serialized]);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [backConfirm, setBackConfirm] = useState(false);

  const unsaved = useMemo(() => {
    const current: BuilderPageContent = { ...craftNodesToPageContent(serialized), seo: seoData };
    return JSON.stringify(current) !== JSON.stringify(savedSnapshot);
  }, [serialized, savedSnapshot, seoData]);

  useEffect(() => {
    logBuildMarker("AdminBuilderHome:init");
  }, []);

  useEffect(() => {
    if (status === "saving" || status === "publishing") return;
    setStatus(unsaved ? "unsaved" : "saved");
  }, [unsaved]);

  // Guard against accidentally leaving with unsaved changes
  useEffect(() => {
    if (!unsaved) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [unsaved]);

  // Auto-save draft after 30s of inactivity when there are unsaved changes
  useEffect(() => {
    if (!unsaved || !session?.accessToken) return;
    if (status === "saving" || status === "publishing") return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      if (!session?.accessToken) return;
      try {
        const content = { ...craftNodesToPageContent(serialized), seo: seoData };
        const saved = await saveBuilderDraft(pageKey, content, session.accessToken);
        setSavedSnapshot({ ...saved.draftContent, sections: normalizeList<BuilderSection>((saved.draftContent as any)?.sections) });
        setSerialized(pageContentToCraftNodes(saved.draftContent));
        setMeta({ updatedAt: saved.updatedAt ?? null, publishedAt: saved.publishedAt ?? null, version: saved.version ?? null });
        setStatus("saved");
        setEditorVersion((v) => v + 1);
        toast.info("Draft auto-saved", { duration: 2000 });
      } catch {
        // auto-save silently fails; manual save still available
      }
    }, 30000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [serialized, unsaved]);

  const load = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);
      logBuildMarker("AdminBuilderHome:load");

      const page = await fetchAdminBuilderPage(pageKey, session.accessToken);
      const productsResponse = await fetchStoreProducts();

      const draftContent = normalizeLoadContent(page?.draftContent);
      const draftSections = normalizeList<BuilderSection>((draftContent as any)?.sections);

      builderDebugLog("loaded draft", { heroImageUrl: draftSections.find((s) => s?.type === "hero_banner")?.props?.imageUrl ?? null });

      const mappedNodes = pageContentToCraftNodes(draftContent);

      setProducts(normalizeArrayOnly<Product>(productsResponse));
      setSavedSnapshot({ ...draftContent, sections: draftSections });
      setSerialized(mappedNodes);
      setSeoData((draftContent as any)?.seo ?? {});
      setMeta({ updatedAt: page?.updatedAt ?? null, publishedAt: page?.publishedAt ?? null, version: page?.version ?? null });
      setStatus("saved");
      setEditorVersion((v) => v + 1);
    } catch (err) {
      const e = err as any;
      builderDebugLog("load error", { message: e?.message ?? String(e) });
      setError(e instanceof Error ? e.message : "Failed to load page builder");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [session?.accessToken, pageKey]);

  const onSave = async (nodes: SerializedNodes) => {
    if (!session?.accessToken) return;
    try {
      setStatus("saving");
      const content = { ...craftNodesToPageContent(nodes), seo: seoData };
      const saved = await saveBuilderDraft(pageKey, content, session.accessToken);
      const mappedNodes = pageContentToCraftNodes(saved.draftContent);
      setSavedSnapshot({ ...saved.draftContent, sections: normalizeList<BuilderSection>((saved.draftContent as any)?.sections) });
      setSerialized(mappedNodes);
      setSeoData((saved.draftContent as any)?.seo ?? {});
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
      const content = { ...craftNodesToPageContent(nodes), seo: seoData };
      await saveBuilderDraft(pageKey, content, session.accessToken);
      const published = await publishBuilderDraft(pageKey, session.accessToken);
      const mappedNodes = pageContentToCraftNodes(published.draftContent);
      setSavedSnapshot({ ...published.draftContent, sections: normalizeList<BuilderSection>((published.draftContent as any)?.sections) });
      setSerialized(mappedNodes);
      setMeta({ updatedAt: published.updatedAt ?? null, publishedAt: published.publishedAt ?? null, version: published.version ?? null });
      setStatus("published");
      setEditorVersion((v) => v + 1);
      toast.success("Page published and live");
    } catch (err) {
      setStatus("error");
      toast.error(err instanceof Error ? err.message : "Publish failed");
    }
  };

  const onDiscard = async () => {
    if (!session?.accessToken) return;
    try {
      setStatus("saving");
      const page = await discardBuilderDraft(pageKey, session.accessToken);
      const mappedNodes = pageContentToCraftNodes(page.draftContent);
      setSavedSnapshot({ ...page.draftContent, sections: normalizeList<BuilderSection>((page.draftContent as any)?.sections) });
      setSerialized(mappedNodes);
      setSeoData((page.draftContent as any)?.seo ?? {});
      setMeta({ updatedAt: page.updatedAt ?? null, publishedAt: page.publishedAt ?? null, version: page.version ?? null });
      setStatus("saved");
      setEditorVersion((v) => v + 1);
      toast.success("Draft reverted to published version");
    } catch (err) {
      setStatus("error");
      toast.error(err instanceof Error ? err.message : "Discard failed");
    }
  };

  const onRestore = async (version: number) => {
    if (!session?.accessToken) return;
    try {
      const page = await restoreBuilderVersion(pageKey, version, session.accessToken);
      const mappedNodes = pageContentToCraftNodes(page.draftContent);
      setSavedSnapshot({ ...page.draftContent, sections: normalizeList<BuilderSection>((page.draftContent as any)?.sections) });
      setSerialized(mappedNodes);
      setSeoData((page.draftContent as any)?.seo ?? {});
      setMeta({ updatedAt: page.updatedAt ?? null, publishedAt: page.publishedAt ?? null, version: page.version ?? null });
      setStatus("saved");
      setEditorVersion((v) => v + 1);
      toast.success(`Version ${version} restored as draft`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
    }
  };

  if (loading) return <LoadingState label="Loading page builder..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const PAGE_LABELS: Record<string, string> = { home: "Homepage", about: "About Us", contact: "Contact" };

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col gap-3">
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {backConfirm ? (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <span className="text-amber-700 text-xs">Unsaved changes — leave anyway?</span>
              <button
                type="button"
                onClick={() => { setBackConfirm(false); void navigate("/admin/builder"); }}
                className="px-2 py-0.5 rounded bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition"
              >Leave</button>
              <button type="button" onClick={() => setBackConfirm(false)} className="px-2 py-0.5 rounded border border-amber-200 text-amber-700 text-xs hover:bg-amber-100 transition">Stay</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (unsaved) { setBackConfirm(true); return; }
                void navigate("/admin/builder");
              }}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm inline-flex items-center gap-2 hover:border-gray-400 transition"
            >
              <ArrowLeft size={14} />
              All pages
            </button>
          )}
          <span className="text-sm font-semibold text-gray-800">{PAGE_LABELS[pageKey] ?? pageKey}</span>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-gray-500">Viewport:</span>
            <button className={`px-2 py-1 rounded border text-xs ${viewport === "desktop" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 hover:border-gray-400"} transition`} onClick={() => setViewport("desktop")} title="Desktop"><Monitor size={14} /></button>
            <button className={`px-2 py-1 rounded border text-xs ${viewport === "tablet" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 hover:border-gray-400"} transition`} onClick={() => setViewport("tablet")} title="Tablet"><Tablet size={14} /></button>
            <button className={`px-2 py-1 rounded border text-xs ${viewport === "mobile" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 hover:border-gray-400"} transition`} onClick={() => setViewport("mobile")} title="Mobile"><Smartphone size={14} /></button>
          </div>
        </div>
        <span className="text-[10px] text-gray-300">{BUILD_MARKER}</span>
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
        unsaved={unsaved}
        seoData={seoData}
        onSeoChange={setSeoData}
        pageKey={pageKey}
        previewContent={previewContent}
        onRestore={onRestore}
      />
    </div>
  );
}
