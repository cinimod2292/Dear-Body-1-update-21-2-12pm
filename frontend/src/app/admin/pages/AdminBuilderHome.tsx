import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Editor, Element, Frame, useEditor, useNode, type SerializedNodes } from "@craftjs/core";
import { Link } from "react-router";
import { ArrowLeft, Eye, Loader2, Monitor, Plus, Save, Smartphone, Tablet, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";
import { discardBuilderDraft, fetchAdminBuilderPage, publishBuilderDraft, saveBuilderDraft } from "../../builder/api";
import { DEAR_BODY_SECTION_LIBRARY, dearBodySectionRegistry } from "../../builder/registry";
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

function SectionToolbox() {
  const { connectors } = useEditor();

  return (
    <div className="space-y-2">
      {DEAR_BODY_SECTION_LIBRARY.map((entry) => (
        <div
          key={entry.type}
          ref={(ref) => {
            if (!ref) return;
            connectors.create(
              ref,
              <Element
                is={resolvedComponent(entry.type)}
                canvas={false}
                {...entry.defaultProps}
                sectionId={`${entry.type}_${Math.random().toString(36).slice(2, 8)}`}
                enabled
              />,
            );
          }}
          className="cursor-grab active:cursor-grabbing border border-gray-200 rounded-lg p-2 bg-white"
        >
          <p className="text-sm font-semibold">{entry.icon} {entry.displayName}</p>
          <p className="text-xs text-gray-500">{entry.description}</p>
        </div>
      ))}
    </div>
  );
}

function resolvedComponent(type: BuilderSectionType) {
  if (type === "hero_banner") return HeroCraftSection;
  if (type === "featured_products") return FeaturedProductsCraftSection;
  if (type === "image_text") return ImageTextCraftSection;
  if (type === "benefit_icons") return BenefitIconsCraftSection;
  return PromoBannerCraftSection;
}

function InspectorPanel() {
  const { selected, actions, query } = useEditor((state) => {
    const currentNodeId = state.events.selected?.[0] ?? null;
    return { selected: currentNodeId };
  });

  if (!selected) {
    return <div className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg p-3">Select a section to edit settings.</div>;
  }

  const node = query.node(selected).get();
  const nodeProps = (node.data.props ?? {}) as Record<string, unknown>;
  const sectionType = String(node.data.custom?.sectionType ?? "") as BuilderSectionType;
  const registry = dearBodySectionRegistry[sectionType];

  if (!registry) return null;

  return (
    <div className="space-y-3">
      <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
        <p className="text-sm font-semibold">{registry.displayName}</p>
        <p className="text-xs text-gray-500">{registry.description}</p>
      </div>

      <label className="flex items-center justify-between text-sm border border-gray-200 rounded-lg px-3 py-2">
        <span>Visible</span>
        <input
          type="checkbox"
          checked={Boolean(nodeProps.enabled ?? true)}
          onChange={(event) => actions.setProp(selected, (props: Record<string, unknown>) => {
            props.enabled = event.target.checked;
          })}
        />
      </label>

      {Object.entries(registry.editableSchema).map(([key, field]) => {
        const value = nodeProps[key];

        if (field.type === "textarea") {
          return <div key={key}><label className="block text-xs text-gray-500 mb-1">{field.label}</label><textarea className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-20" value={String(value ?? "")} onChange={(event) => actions.setProp(selected, (props: Record<string, unknown>) => { props[key] = event.target.value; })} /></div>;
        }

        if (field.type === "select") {
          return (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
              <div className="grid grid-cols-2 gap-2">
                {(field.options ?? []).map((option) => (
                  <button key={option} type="button" className={`px-2 py-2 rounded-lg border text-xs ${String(value ?? "") === option ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200"}`} onClick={() => actions.setProp(selected, (props: Record<string, unknown>) => { props[key] = option; })}>{option}</button>
                ))}
              </div>
            </div>
          );
        }

        if (field.type === "number") {
          return <div key={key}><label className="block text-xs text-gray-500 mb-1">{field.label}</label><input type="number" min={field.min} max={field.max} value={Number(value ?? 0)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" onChange={(event) => actions.setProp(selected, (props: Record<string, unknown>) => { props[key] = Number(event.target.value); })} /></div>;
        }

        if (field.type === "image") {
          return <div key={key}><label className="block text-xs text-gray-500 mb-1">{field.label}</label>{value ? <img src={String(value)} alt={field.label} className="w-full h-24 rounded-lg border border-gray-200 object-cover mb-2" /> : null}<input type="text" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={String(value ?? "")} onChange={(event) => actions.setProp(selected, (props: Record<string, unknown>) => { props[key] = event.target.value; })} /></div>;
        }

        return <div key={key}><label className="block text-xs text-gray-500 mb-1">{field.label}</label><input type="text" value={String(value ?? "")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" onChange={(event) => actions.setProp(selected, (props: Record<string, unknown>) => { props[key] = event.target.value; })} /></div>;
      })}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            const content = craftNodesToPageContent(query.getSerializedNodes() as SerializedNodes);
            const duplicated = duplicateSectionInContent(content, String(node.data.props.sectionId ?? selected));
            actions.deserialize(pageContentToCraftNodes(duplicated));
          }}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm inline-flex items-center justify-center gap-1"
        ><Copy size={14} /> Duplicate</button>

        <button
          type="button"
          disabled={!registry.removable}
          onClick={() => {
            if (!registry.removable) return;
            actions.delete(selected);
          }}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm inline-flex items-center justify-center gap-1 disabled:opacity-40"
        ><Trash2 size={14} /> Delete</button>
      </div>
    </div>
  );
}

function CraftWorkspace({
  initialData,
  viewport,
  products,
  onSave,
  onPublish,
  onDiscard,
  onNodesChange,
  loading,
  publishing,
  unsaved,
}: {
  initialData: SerializedNodes;
  viewport: "desktop" | "tablet" | "mobile";
  products: Product[];
  onSave: (nodes: SerializedNodes) => Promise<void>;
  onPublish: (nodes: SerializedNodes) => Promise<void>;
  onDiscard: () => Promise<void>;
  onNodesChange: (nodes: SerializedNodes) => void;
  loading: boolean;
  publishing: boolean;
  unsaved: boolean;
}) {
  const widthClass = viewport === "mobile" ? "max-w-[390px]" : viewport === "tablet" ? "max-w-[820px]" : "max-w-[1200px]";

  return (
    <CraftProductsContext.Provider value={products}>
    <Editor
      resolver={{
        BuilderCanvas,
        HeroCraftSection,
        FeaturedProductsCraftSection,
        ImageTextCraftSection,
        BenefitIconsCraftSection,
        PromoBannerCraftSection,
      }}
      enabled
      onNodesChange={(query) => {
        const nextNodes = query.getSerializedNodes() as SerializedNodes;
        if (nextNodes) {
          onNodesChange(nextNodes);
        }
      }}
    >
      <BuilderTopActions loading={loading} publishing={publishing} unsaved={unsaved} onSave={onSave} onPublish={onPublish} onDiscard={onDiscard} />
      <div className="min-h-0 flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr_340px] gap-3">
        <aside className="bg-white border border-gray-200 rounded-xl p-3 overflow-auto">
          <p className="text-sm font-semibold text-gray-900 mb-3">Section Toolbox (drag onto canvas)</p>
          <SectionToolbox />
        </aside>

        <main className="bg-gray-100 border border-gray-200 rounded-xl p-4 overflow-auto">
          <div className={`mx-auto ${widthClass}`}>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <Frame data={initialData}>
                <Element is={BuilderCanvas} canvas />
              </Frame>
            </div>
          </div>
        </main>

        <aside className="bg-white border border-gray-200 rounded-xl p-3 overflow-auto">
          <p className="text-sm font-semibold text-gray-900 mb-3">Inspector</p>
          <InspectorPanel />
        </aside>
      </div>
    </Editor>
    </CraftProductsContext.Provider>
  );
}

function BuilderTopActions({
  loading,
  publishing,
  unsaved,
  onSave,
  onPublish,
  onDiscard,
}: {
  loading: boolean;
  publishing: boolean;
  unsaved: boolean;
  onSave: (nodes: SerializedNodes) => Promise<void>;
  onPublish: (nodes: SerializedNodes) => Promise<void>;
  onDiscard: () => Promise<void>;
}) {
  const { query } = useEditor();
  const [busy, setBusy] = useState(false);

  return (
    <header className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Link to="/admin" className="px-3 py-2 rounded-lg border border-gray-200 text-sm inline-flex items-center gap-2"><ArrowLeft size={14} /> Back to admin</Link>
        <span className={`text-xs px-2 py-1 rounded-full ${unsaved ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{unsaved ? "Unsaved changes" : "Draft saved"}</span>
      </div>

      <div className="flex items-center gap-2">
        <Link to="/?preview=builder" target="_blank" className="px-3 py-2 rounded-lg border border-gray-300 text-sm inline-flex items-center gap-2"><Eye size={14} /> Preview draft</Link>
        <button
          type="button"
          disabled={busy || loading || publishing}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(query.getSerializedNodes() as SerializedNodes);
            } finally {
              setBusy(false);
            }
          }}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm inline-flex items-center gap-2 disabled:opacity-40"
        ><Save size={14} /> Save Draft</button>
        <button
          type="button"
          disabled={busy || loading || publishing}
          onClick={async () => {
            setBusy(true);
            try {
              await onPublish(query.getSerializedNodes() as SerializedNodes);
            } finally {
              setBusy(false);
            }
          }}
          className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm inline-flex items-center gap-2 disabled:opacity-40"
        >{publishing || busy ? <Loader2 className="animate-spin" size={14} /> : null} Publish</button>
        <button type="button" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" onClick={() => void onDiscard()}>Discard</button>
      </div>
    </header>
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
  const [publishing, setPublishing] = useState(false);

  const unsaved = useMemo(() => {
    const current = craftNodesToPageContent(serialized);
    return JSON.stringify(current) !== JSON.stringify(savedSnapshot);
  }, [serialized, savedSnapshot]);

  const load = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const [page, productsResponse] = await Promise.all([
        fetchAdminBuilderPage("home", session.accessToken),
        fetchStoreProducts(),
      ]);
      setProducts(productsResponse);
      const initialContent = page.draftContent;
      setSavedSnapshot(initialContent);
      setSerialized(pageContentToCraftNodes(initialContent));
      setEditorVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load page builder");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [session?.accessToken]);

  const onSave = async (nodes: SerializedNodes) => {
    if (!session?.accessToken) return;
    const content = craftNodesToPageContent(nodes);
    const saved = await saveBuilderDraft("home", content, session.accessToken);
    setSavedSnapshot(saved.draftContent);
    setSerialized(pageContentToCraftNodes(saved.draftContent));
      setEditorVersion((v) => v + 1);
    toast.success("Draft saved");
  };

  const onPublish = async (nodes: SerializedNodes) => {
    if (!session?.accessToken) return;
    try {
      setPublishing(true);
      const content = craftNodesToPageContent(nodes);
      await saveBuilderDraft("home", content, session.accessToken);
      const published = await publishBuilderDraft("home", session.accessToken);
      setSavedSnapshot(published.draftContent);
      setSerialized(pageContentToCraftNodes(published.draftContent));
      setEditorVersion((v) => v + 1);
      toast.success("Homepage published");
    } finally {
      setPublishing(false);
    }
  };

  const onDiscard = async () => {
    if (!session?.accessToken) return;
    if (!window.confirm("Discard draft changes and revert to published content?")) return;
    const page = await discardBuilderDraft("home", session.accessToken);
    setSavedSnapshot(page.draftContent);
    setSerialized(pageContentToCraftNodes(page.draftContent));
      setEditorVersion((v) => v + 1);
    toast.success("Draft reverted");
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
        <span className="text-xs text-gray-500 inline-flex items-center gap-1"><Plus size={12} /> Drag sections from toolbox onto canvas</span>
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
        loading={loading}
        publishing={publishing}
        unsaved={unsaved}
      />
    </div>
  );
}
