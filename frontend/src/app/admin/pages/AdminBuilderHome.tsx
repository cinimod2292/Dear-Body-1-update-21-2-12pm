import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BuilderPageRenderer } from "../../builder/BuilderPageRenderer";
import { discardBuilderDraft, fetchAdminBuilderPage, publishBuilderDraft, saveBuilderDraft } from "../../builder/api";
import { DEAR_BODY_SECTION_LIBRARY, dearBodySectionRegistry } from "../../builder/registry";
import { BuilderPageContent, BuilderSection, BuilderSectionType } from "../../builder/types";
import { fetchStoreProducts, Product } from "../../data/products";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ErrorState, LoadingState } from "../components/AdminState";

function cloneContent(content: BuilderPageContent): BuilderPageContent {
  return JSON.parse(JSON.stringify(content)) as BuilderPageContent;
}

export default function AdminBuilderHome() {
  const { session } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [draft, setDraft] = useState<BuilderPageContent>({ sections: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedSection = useMemo(
    () => draft.sections.find((section) => section.id === selectedId) ?? null,
    [draft.sections, selectedId],
  );

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
      setDraft(cloneContent(page.draftContent));
      setSelectedId(page.draftContent.sections[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load page builder");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [session?.accessToken]);

  const updateSection = (sectionId: string, updater: (section: BuilderSection) => BuilderSection) => {
    setDraft((previous) => ({
      ...previous,
      sections: previous.sections.map((section) => (section.id === sectionId ? updater(section) : section)),
    }));
  };

  const addSection = (type: BuilderSectionType) => {
    const registry = dearBodySectionRegistry[type];
    const next: BuilderSection = {
      id: `${type}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      enabled: true,
      props: registry.defaultProps,
    };
    setDraft((prev) => ({ ...prev, sections: [...prev.sections, next] }));
    setSelectedId(next.id);
  };

  const saveDraft = async () => {
    if (!session?.accessToken) return;
    try {
      await saveBuilderDraft("home", draft, session.accessToken);
      toast.success("Draft saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save draft");
    }
  };

  const publish = async () => {
    if (!session?.accessToken) return;
    try {
      await saveBuilderDraft("home", draft, session.accessToken);
      await publishBuilderDraft("home", session.accessToken);
      toast.success("Draft published");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to publish draft");
    }
  };

  const discard = async () => {
    if (!session?.accessToken) return;
    try {
      const page = await discardBuilderDraft("home", session.accessToken);
      setDraft(cloneContent(page.draftContent));
      setSelectedId(page.draftContent.sections[0]?.id ?? null);
      toast.success("Draft reverted to published");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to discard draft");
    }
  };

  if (loading) return <LoadingState label="Loading page builder..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-black text-gray-900">Homepage Builder</h2>
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-4 items-start">
        <aside className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="font-bold text-gray-900">Sections</p>
          {draft.sections.map((section, index) => (
            <button key={section.id} onClick={() => setSelectedId(section.id)} className={`w-full text-left border rounded-lg px-3 py-2 ${selectedId === section.id ? "border-pink-400 bg-pink-50" : "border-gray-200"}`}>
              <p className="text-sm font-semibold">{index + 1}. {dearBodySectionRegistry[section.type]?.displayName ?? section.type}</p>
              <p className="text-xs text-gray-500">{section.enabled ? "Enabled" : "Disabled"}</p>
            </button>
          ))}
          <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" defaultValue="" onChange={(e) => e.target.value && addSection(e.target.value as BuilderSectionType)}>
            <option value="">Add section...</option>
            {DEAR_BODY_SECTION_LIBRARY.map((entry) => <option key={entry.type} value={entry.type}>{entry.displayName}</option>)}
          </select>
        </aside>

        <main className="bg-white border border-gray-200 rounded-xl p-3 overflow-hidden">
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <BuilderPageRenderer content={draft} products={products} />
          </div>
        </main>

        <aside className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="font-bold text-gray-900">Section Settings</p>
          {!selectedSection ? <p className="text-sm text-gray-500">Select a section to edit.</p> : (
            <>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedSection.enabled} onChange={() => updateSection(selectedSection.id, (section) => ({ ...section, enabled: !section.enabled }))} /> Enabled</label>
              {Object.entries(dearBodySectionRegistry[selectedSection.type]?.editableSchema ?? {}).map(([key, field]) => {
                const value = selectedSection.props[key];
                if (field.type === "textarea") {
                  return <div key={key}><label className="block text-xs text-gray-500 mb-1">{field.label}</label><textarea className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-20" value={String(value ?? "")} onChange={(e) => updateSection(selectedSection.id, (section) => ({ ...section, props: { ...section.props, [key]: e.target.value } }))} /></div>;
                }
                if (field.type === "select") {
                  return <div key={key}><label className="block text-xs text-gray-500 mb-1">{field.label}</label><select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={String(value ?? field.options?.[0] ?? "")} onChange={(e) => updateSection(selectedSection.id, (section) => ({ ...section, props: { ...section.props, [key]: e.target.value } }))}>{(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}</select></div>;
                }
                if (field.type === "number") {
                  return <div key={key}><label className="block text-xs text-gray-500 mb-1">{field.label}</label><input type="number" min={field.min} max={field.max} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={Number(value ?? 0)} onChange={(e) => updateSection(selectedSection.id, (section) => ({ ...section, props: { ...section.props, [key]: Number(e.target.value) } }))} /></div>;
                }
                return <div key={key}><label className="block text-xs text-gray-500 mb-1">{field.label}</label><input type="text" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={String(value ?? "")} onChange={(e) => updateSection(selectedSection.id, (section) => ({ ...section, props: { ...section.props, [key]: e.target.value } }))} /></div>;
              })}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button onClick={saveDraft} className="px-3 py-2 rounded-lg border border-gray-300 text-sm">Save Draft</button>
                <button onClick={publish} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm">Publish</button>
                <button onClick={discard} className="px-3 py-2 rounded-lg border border-gray-300 text-sm col-span-2">Discard Draft</button>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
