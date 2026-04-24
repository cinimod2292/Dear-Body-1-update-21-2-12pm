import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Editor, Element, Frame, useEditor, useNode, type SerializedNodes } from "@craftjs/core";
import { Link } from "react-router";
import { ArrowLeft, Copy, Eye, Loader2, Monitor, Redo2, Save, Smartphone, Tablet, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { discardBuilderDraft, fetchAdminBuilderPage, publishBuilderDraft, saveBuilderDraft } from "../../builder/api";
import { dearBodySectionRegistry } from "../../builder/registry";
import { BenefitIconsSection } from "../../builder/sections/BenefitIconsSection";
import { FeaturedProductsSection } from "../../builder/sections/FeaturedProductsSection";
import { HeroBannerSection } from "../../builder/sections/HeroBannerSection";
import { ImageTextSection } from "../../builder/sections/ImageTextSection";
import { PromoBannerSection } from "../../builder/sections/PromoBannerSection";
import { BuilderPageContent, BuilderSectionType } from "../../builder/types";
import { fetchStoreProducts, Product } from "../../data/products";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ErrorState, LoadingState } from "../components/AdminState";
import { craftNodesToPageContent, duplicateSectionInContent, pageContentToCraftNodes } from "../../builder/craft-mapper";
import { SECTION_PRESETS } from "../../builder/presets";
import { actionBlockedMessage, isActionAllowed } from "../../builder/action-rules";
import { isSafeImageUrl } from "../../builder/media-url";

type Status = "unsaved" | "saving" | "saved" | "publishing" | "published" | "error";

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

function SectionToolbox() {
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

function InspectorPanel() {
  const products = useContext(CraftProductsContext);
  const { selected, actions, query } = useEditor((state) => ({ selected: state.events.selected?.[0] ?? null }));

  if (!selected) {
    return <div className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg p-3">Select a section to edit settings.</div>;
  }

  const node = query.node(selected).get();
  const nodeProps = (node.data.props ?? {}) as Record<string, unknown>;
  const sectionType = String(node.data.custom?.sectionType ?? "") as BuilderSectionType;
  const registry = dearBodySectionRegistry[sectionType];

  if (!registry) return null;

  const rules = {
    removable: registry.removable,
    movable: registry.movable,
    duplicatable: registry.duplicatable,
  };

  return (
    <div className="space-y-3">
      <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
        <p className="text-sm font-semibold">{registry.displayName}</p>
        <p className="text-xs text-gray-500">{registry.description}</p>
      </div>

      <label className="flex items-center justify-between text-sm border border-gray-200 rounded-lg px-3 py-2">
        <span>Visible</span>
        <input type="checkbox" checked={Boolean(nodeProps.enabled ?? true)} onChange={(event) => actions.setProp(selected, (props: Record<string, unknown>) => { props.enabled = event.target.checked; })} />
      </label>

      {Object.entries(registry.editableSchema).map(([key, field]) => {
        const value = nodeProps[key];

        if (sectionType === "featured_products" && key === "mode") {
          return (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-1">Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {(["latest", "featured", "manual"] as const).map((option) => (
                  <button key={option} type="button" className={`px-2 py-2 rounded-lg border text-xs ${String(value ?? "latest") === option ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200"}`} onClick={() => actions.setProp(selected, (props: Record<string, unknown>) => { props.mode = option; })}>{option}</button>
                ))}
              </div>
            </div>
          );
        }

        if (sectionType === "featured_products" && key === "productIds" && nodeProps.mode === "manual") {
          const selectedIds = Array.isArray(value) ? value.map(String) : [];
          return (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-1">Manual products</label>
              <div className="max-h-36 overflow-auto border border-gray-200 rounded-lg p-2 space-y-1">
                {products.slice(0, 40).map((product) => {
                  const checked = selectedIds.includes(product.id);
                  return (
                    <label key={product.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => actions.setProp(selected, (props: Record<string, unknown>) => {
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
          return <div key={key}><label className="block text-xs text-gray-500 mb-1">{field.label}</label><textarea className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-20" value={String(value ?? "")} onChange={(event) => actions.setProp(selected, (props: Record<string, unknown>) => { props[key] = event.target.value; })} /></div>;
        }

        if (field.type === "select") {
          return <div key={key}><label className="block text-xs text-gray-500 mb-1">{field.label}</label><div className="grid grid-cols-2 gap-2">{(field.options ?? []).map((option) => <button key={option} type="button" className={`px-2 py-2 rounded-lg border text-xs ${String(value ?? "") === option ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200"}`} onClick={() => actions.setProp(selected, (props: Record<string, unknown>) => { props[key] = option; })}>{option}</button>)}</div></div>;
        }

        if (field.type === "number") {
          return <div key={key}><label className="block text-xs text-gray-500 mb-1">{field.label}</label><input type="number" min={field.min} max={field.max} value={Number(value ?? 0)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" onChange={(event) => actions.setProp(selected, (props: Record<string, unknown>) => { props[key] = Number(event.target.value); })} /></div>;
        }

        if (field.type === "image") {
          const imageValue = String(value ?? "");
          const safe = isSafeImageUrl(imageValue);
          return (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
              {imageValue ? <img src={imageValue} alt={field.label} className="w-full h-24 rounded-lg border border-gray-200 object-cover mb-2" /> : <div className="w-full h-20 rounded-lg border border-dashed border-gray-200 mb-2 flex items-center justify-center text-xs text-gray-400">No image selected</div>}
              <input type="text" className={`w-full rounded-lg border px-3 py-2 text-sm ${safe ? "border-gray-200" : "border-red-400"}`} value={imageValue} onChange={(event) => actions.setProp(selected, (props: Record<string, unknown>) => { props[key] = event.target.value; })} />
              {!safe ? <p className="text-xs text-red-600 mt-1">Use only relative or https image URLs.</p> : null}
              <button type="button" className="mt-2 text-xs px-2 py-1 rounded border border-gray-300" onClick={() => actions.setProp(selected, (props: Record<string, unknown>) => { props[key] = ""; })}>Clear image</button>
            </div>
          );
        }

        return <div key={key}><label className="block text-xs text-gray-500 mb-1">{field.label}</label><input type="text" value={String(value ?? "")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" onChange={(event) => actions.setProp(selected, (props: Record<string, unknown>) => { props[key] = event.target.value; })} /></div>;
      })}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => {
          if (!isActionAllowed(rules, "duplicate")) return toast.error(actionBlockedMessage("duplicate"));
          const content = craftNodesToPageContent(query.getSerializedNodes() as SerializedNodes);
          const duplicated = duplicateSectionInContent(content, String(node.data.props.sectionId ?? selected));
          actions.deserialize(pageContentToCraftNodes(duplicated));
        }} className="px-3 py-2 rounded-lg border border-gray-300 text-sm inline-flex items-center justify-center gap-1"><Copy size={14} /> Duplicate</button>

        <button type="button" onClick={() => {
          if (!isActionAllowed(rules, "remove")) return toast.error(actionBlockedMessage("remove"));
          actions.delete(selected);
        }} className="px-3 py-2 rounded-lg border border-gray-300 text-sm inline-flex items-center justify-center gap-1"><Trash2 size={14} /> Delete</button>
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

function CraftWorkspace({ initialData, viewport, products, onSave, onPublish, onDiscard, onNodesChange, status, updatedAt, publishedAt, version }: {
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
        <div className="min-h-0 flex-1 grid grid-cols-1 lg:grid-cols-[300px_1fr_340px] gap-3">
          <aside className="bg-white border border-gray-200 rounded-xl p-3 overflow-auto"><p className="text-sm font-semibold text-gray-900 mb-3">Section Presets (drag onto canvas)</p><SectionToolbox /></aside>
          <main className="bg-gray-100 border border-gray-200 rounded-xl p-4 overflow-auto"><div className={`mx-auto ${widthClass}`}><div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"><Frame data={initialData}><Element is={BuilderCanvas} canvas /></Frame></div></div></main>
          <aside className="bg-white border border-gray-200 rounded-xl p-3 overflow-auto"><p className="text-sm font-semibold text-gray-900 mb-3">Inspector</p><InspectorPanel /></aside>
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
    if (status === "saved" || status === "published" || status === "saving" || status === "publishing") return;
    setStatus(unsaved ? "unsaved" : "saved");
  }, [unsaved]);

  const load = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const [page, productsResponse] = await Promise.all([fetchAdminBuilderPage("home", session.accessToken), fetchStoreProducts()]);
      setProducts(productsResponse);
      setSavedSnapshot(page.draftContent);
      setSerialized(pageContentToCraftNodes(page.draftContent));
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
      const saved = await saveBuilderDraft("home", content, session.accessToken);
      setSavedSnapshot(saved.draftContent);
      setSerialized(pageContentToCraftNodes(saved.draftContent));
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
      await saveBuilderDraft("home", content, session.accessToken);
      const published = await publishBuilderDraft("home", session.accessToken);
      setSavedSnapshot(published.draftContent);
      setSerialized(pageContentToCraftNodes(published.draftContent));
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
      setSavedSnapshot(page.draftContent);
      setSerialized(pageContentToCraftNodes(page.draftContent));
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
        <span className="text-xs text-gray-500">Drag presets from toolbox onto the canvas.</span>
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
      />
    </div>
  );
}
