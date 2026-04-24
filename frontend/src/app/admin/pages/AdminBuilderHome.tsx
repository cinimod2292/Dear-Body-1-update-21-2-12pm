import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, ChevronDown, ChevronUp, Eye, EyeOff, LayoutTemplate, Monitor, Plus, Save, Smartphone, Tablet, Trash2, Copy, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BuilderPageRenderer } from "../../builder/BuilderPageRenderer";
import { discardBuilderDraft, fetchAdminBuilderPage, publishBuilderDraft, saveBuilderDraft } from "../../builder/api";
import { DEAR_BODY_SECTION_LIBRARY, dearBodySectionRegistry } from "../../builder/registry";
import { BuilderPageContent, BuilderSection, BuilderSectionType } from "../../builder/types";
import { fetchStoreProducts, Product } from "../../data/products";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ErrorState, LoadingState } from "../components/AdminState";
import {
  createSection,
  deepCloneContent,
  duplicateSection,
  getCanvasClass,
  groupForSectionType,
  hasUnsavedChanges,
  moveSection,
  removeSection,
  updateSection,
  type PreviewViewport,
} from "./builder/editor-state";

import { INSPECTOR_GROUP_ORDER, inferInspectorGroup, type InspectorGroup } from "./builder/inspector";

export default function AdminBuilderHome() {
  const { session } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [draft, setDraft] = useState<BuilderPageContent>({ sections: [] });
  const [lastSavedDraft, setLastSavedDraft] = useState<BuilderPageContent>({ sections: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<PreviewViewport>("desktop");
  const [showLibrary, setShowLibrary] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<InspectorGroup, boolean>>({
    Content: true,
    Media: true,
    "Buttons/Links": true,
    Layout: true,
    Style: true,
  });
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const selectedSection = useMemo(
    () => draft.sections.find((section) => section.id === selectedId) ?? null,
    [draft.sections, selectedId],
  );

  const unsaved = useMemo(() => hasUnsavedChanges(draft, lastSavedDraft), [draft, lastSavedDraft]);

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
      const loadedDraft = deepCloneContent(page.draftContent);
      setDraft(loadedDraft);
      setLastSavedDraft(deepCloneContent(loadedDraft));
      setSelectedId(loadedDraft.sections[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load page builder");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [session?.accessToken]);

  const setSections = (nextSections: BuilderSection[]) => {
    setDraft((previous) => ({ ...previous, sections: nextSections }));
  };

  const updateSelectedSectionField = (key: string, value: unknown) => {
    if (!selectedSection) return;
    setSections(updateSection(draft.sections, selectedSection.id, (section) => ({
      ...section,
      props: { ...section.props, [key]: value },
    })));
  };

  const onAddSection = (type: BuilderSectionType) => {
    const registry = dearBodySectionRegistry[type];
    const next = createSection(type, registry.defaultProps);
    setSections([...draft.sections, next]);
    setSelectedId(next.id);
    setShowLibrary(false);
  };

  const onMoveSection = (sectionId: string, direction: -1 | 1) => {
    const index = draft.sections.findIndex((item) => item.id === sectionId);
    if (index < 0) return;
    setSections(moveSection(draft.sections, index, direction));
  };

  const onDuplicateSection = (sectionId: string) => {
    const next = duplicateSection(draft.sections, sectionId);
    setSections(next);
    const sourceIndex = draft.sections.findIndex((section) => section.id === sectionId);
    if (sourceIndex >= 0) {
      setSelectedId(next[sourceIndex + 1]?.id ?? sectionId);
    }
  };

  const onToggleSection = (sectionId: string) => {
    setSections(updateSection(draft.sections, sectionId, (section) => ({ ...section, enabled: !section.enabled })));
  };

  const onDeleteSection = (sectionId: string) => {
    const target = draft.sections.find((section) => section.id === sectionId);
    if (!target) return;
    const registry = dearBodySectionRegistry[target.type];
    if (!registry.removable) {
      toast.error("This section is required and cannot be removed.");
      return;
    }
    const next = removeSection(draft.sections, sectionId);
    setSections(next);
    if (selectedId === sectionId) {
      setSelectedId(next[0]?.id ?? null);
    }
  };

  const onSaveDraft = async () => {
    if (!session?.accessToken || saving || publishing) return;
    try {
      setSaving(true);
      const saved = await saveBuilderDraft("home", draft, session.accessToken);
      const nextDraft = deepCloneContent(saved.draftContent);
      setLastSavedDraft(nextDraft);
      setDraft(nextDraft);
      toast.success("Draft saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const onPublish = async () => {
    if (!session?.accessToken || saving || publishing) return;
    try {
      setPublishing(true);
      if (unsaved) {
        await saveBuilderDraft("home", draft, session.accessToken);
      }
      const published = await publishBuilderDraft("home", session.accessToken);
      const nextDraft = deepCloneContent(published.draftContent);
      setDraft(nextDraft);
      setLastSavedDraft(deepCloneContent(nextDraft));
      toast.success("Homepage published");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to publish draft");
    } finally {
      setPublishing(false);
    }
  };

  const onDiscard = async () => {
    if (!session?.accessToken || saving || publishing) return;
    if (!window.confirm("Discard draft changes and revert to published content?")) return;
    try {
      setSaving(true);
      const page = await discardBuilderDraft("home", session.accessToken);
      const reverted = deepCloneContent(page.draftContent);
      setDraft(reverted);
      setLastSavedDraft(deepCloneContent(reverted));
      setSelectedId(reverted.sections[0]?.id ?? null);
      toast.success("Draft reverted to published");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to discard draft");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading page builder..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const statusLabel = publishing
    ? "Publishing..."
    : saving
      ? "Saving..."
      : unsaved
        ? "Unsaved changes"
        : "Draft saved";

  const fields = selectedSection ? Object.entries(dearBodySectionRegistry[selectedSection.type]?.editableSchema ?? {}) : [];

  const fieldsByGroup = INSPECTOR_GROUP_ORDER.map((group) => ({
    group,
    items: fields.filter(([fieldKey, field]) => inferInspectorGroup(fieldKey, field) === group),
  })).filter((entry) => entry.items.length > 0);

  const groupedLibrary = DEAR_BODY_SECTION_LIBRARY.reduce<Record<string, typeof DEAR_BODY_SECTION_LIBRARY>>((acc, item) => {
    const key = item.group || groupForSectionType(item.type);
    acc[key] = [...(acc[key] ?? []), item];
    return acc;
  }, {});

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col gap-3">
      <header className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/admin" className="px-3 py-2 rounded-lg border border-gray-200 text-sm inline-flex items-center gap-2"><ArrowLeft size={14} /> Back to admin</Link>
          <div>
            <p className="text-xs text-gray-500">Page</p>
            <div className="flex items-center gap-2">
              <select className="rounded-lg border border-gray-200 px-2 py-1 text-sm" value="home" onChange={() => undefined}>
                <option value="home">Home</option>
              </select>
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${unsaved ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                <CheckCircle2 size={12} /> {statusLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-gray-200 p-1 flex items-center gap-1">
            <button onClick={() => setViewport("desktop")} className={`px-2 py-1 rounded text-xs inline-flex items-center gap-1 ${viewport === "desktop" ? "bg-gray-900 text-white" : "text-gray-600"}`}><Monitor size={14} /> Desktop</button>
            <button onClick={() => setViewport("tablet")} className={`px-2 py-1 rounded text-xs inline-flex items-center gap-1 ${viewport === "tablet" ? "bg-gray-900 text-white" : "text-gray-600"}`}><Tablet size={14} /> Tablet</button>
            <button onClick={() => setViewport("mobile")} className={`px-2 py-1 rounded text-xs inline-flex items-center gap-1 ${viewport === "mobile" ? "bg-gray-900 text-white" : "text-gray-600"}`}><Smartphone size={14} /> Mobile</button>
          </div>
          <Link to="/?preview=builder" target="_blank" className="px-3 py-2 rounded-lg border border-gray-300 text-sm inline-flex items-center gap-2"><Eye size={14} /> Preview draft</Link>
          <button onClick={onSaveDraft} disabled={!unsaved || saving || publishing} className="px-3 py-2 rounded-lg border border-gray-300 text-sm inline-flex items-center gap-2 disabled:opacity-50"><Save size={14} /> Save Draft</button>
          <button onClick={onPublish} disabled={saving || publishing} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm inline-flex items-center gap-2 disabled:opacity-50">{publishing ? <Loader2 className="animate-spin" size={14} /> : null} Publish</button>
        </div>
      </header>

      <div className="min-h-0 flex-1 grid grid-cols-1 lg:grid-cols-[300px_1fr_350px] gap-3">
        <aside className="bg-white border border-gray-200 rounded-xl p-3 overflow-auto">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-gray-900">Sections</p>
            <button onClick={() => setShowLibrary(true)} className="px-2 py-1 rounded-lg bg-gray-900 text-white text-xs inline-flex items-center gap-1"><Plus size={12} /> Add section</button>
          </div>

          <div className="space-y-2">
            {draft.sections.map((section, index) => {
              const entry = dearBodySectionRegistry[section.type];
              return (
                <div key={section.id} className={`border rounded-lg p-2 ${selectedId === section.id ? "border-pink-400 bg-pink-50" : "border-gray-200"}`}>
                  <button onClick={() => setSelectedId(section.id)} className="w-full text-left flex items-start gap-2">
                    <span className="text-base leading-none mt-0.5">{entry.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{entry.displayName}</p>
                      <p className="text-xs text-gray-500">{section.enabled ? "Visible" : "Hidden"}</p>
                    </div>
                  </button>

                  <div className="mt-2 flex items-center gap-1">
                    <button onClick={() => onMoveSection(section.id, -1)} disabled={index === 0} className="p-1 rounded border border-gray-200 disabled:opacity-40" title="Move up"><ChevronUp size={14} /></button>
                    <button onClick={() => onMoveSection(section.id, 1)} disabled={index === draft.sections.length - 1} className="p-1 rounded border border-gray-200 disabled:opacity-40" title="Move down"><ChevronDown size={14} /></button>
                    <button onClick={() => onDuplicateSection(section.id)} className="p-1 rounded border border-gray-200" title="Duplicate"><Copy size={14} /></button>
                    <button onClick={() => onToggleSection(section.id)} className="p-1 rounded border border-gray-200" title={section.enabled ? "Hide" : "Show"}>{section.enabled ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                    <button onClick={() => onDeleteSection(section.id)} disabled={!entry.removable} className="p-1 rounded border border-gray-200 disabled:opacity-40" title={entry.removable ? "Delete" : "Locked section"}><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="bg-gray-100 border border-gray-200 rounded-xl p-4 overflow-auto">
          <div className={`mx-auto transition-all duration-200 ${getCanvasClass(viewport)}`}>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <BuilderPageRenderer
                content={draft}
                products={products}
                interactive
                selectedSectionId={selectedId}
                onSectionSelect={setSelectedId}
              />
            </div>
          </div>
        </main>

        <aside className="bg-white border border-gray-200 rounded-xl p-3 overflow-auto">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-gray-900">Inspector</p>
            <button onClick={onDiscard} disabled={saving || publishing} className="text-xs px-2 py-1 rounded border border-gray-300 disabled:opacity-40">Discard draft</button>
          </div>

          {!selectedSection ? (
            <div className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg p-4">Select a section in the preview or section list.</div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                <p className="text-sm font-semibold text-gray-900">{dearBodySectionRegistry[selectedSection.type].displayName}</p>
                <p className="text-xs text-gray-500">{dearBodySectionRegistry[selectedSection.type].description}</p>
              </div>

              {fieldsByGroup.map(({ group, items }) => (
                <div key={group} className="border border-gray-200 rounded-lg">
                  <button className="w-full px-3 py-2 flex items-center justify-between bg-gray-50" onClick={() => setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }))}>
                    <span className="text-sm font-semibold text-gray-800">{group}</span>
                    <span className="text-xs text-gray-500">{expandedGroups[group] ? "Hide" : "Show"}</span>
                  </button>

                  {expandedGroups[group] ? (
                    <div className="p-3 space-y-3">
                      {items.map(([key, field]) => {
                        const value = selectedSection.props[key];

                        if (field.type === "boolean") {
                          return (
                            <label key={key} className="flex items-center justify-between text-sm">
                              <span>{field.label}</span>
                              <input
                                type="checkbox"
                                checked={Boolean(value)}
                                onChange={(event) => updateSelectedSectionField(key, event.target.checked)}
                              />
                            </label>
                          );
                        }

                        if (field.type === "textarea") {
                          return (
                            <div key={key}>
                              <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                              <textarea className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-20" value={String(value ?? "")} onChange={(event) => updateSelectedSectionField(key, event.target.value)} />
                            </div>
                          );
                        }

                        if (field.type === "select") {
                          return (
                            <div key={key}>
                              <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                              <div className="grid grid-cols-2 gap-2">
                                {(field.options ?? []).map((option) => (
                                  <button
                                    key={option}
                                    type="button"
                                    onClick={() => updateSelectedSectionField(key, option)}
                                    className={`px-2 py-2 rounded-lg border text-xs ${String(value ?? "") === option ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-700"}`}
                                  >
                                    {option}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        if (field.type === "number") {
                          return (
                            <div key={key}>
                              <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                              <input type="number" min={field.min} max={field.max} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={Number(value ?? 0)} onChange={(event) => updateSelectedSectionField(key, Number(event.target.value))} />
                            </div>
                          );
                        }

                        if (field.type === "image") {
                          const imageValue = String(value ?? "");
                          return (
                            <div key={key}>
                              <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                              {imageValue ? <img src={imageValue} alt={field.label} className="w-full h-28 rounded-lg object-cover border border-gray-200 mb-2" /> : <div className="w-full h-20 rounded-lg border border-dashed border-gray-200 mb-2 flex items-center justify-center text-xs text-gray-400">No image selected</div>}
                              <input type="text" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Paste image URL" value={imageValue} onChange={(event) => updateSelectedSectionField(key, event.target.value)} />
                            </div>
                          );
                        }

                        return (
                          <div key={key}>
                            <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                            <input type="text" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={String(value ?? "")} onChange={(event) => updateSelectedSectionField(key, event.target.value)} />
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {showLibrary ? (
        <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-4xl max-h-[85vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LayoutTemplate size={16} className="text-gray-600" />
                <h3 className="font-semibold text-gray-900">Section library</h3>
              </div>
              <button onClick={() => setShowLibrary(false)} className="text-sm px-2 py-1 rounded border border-gray-200">Close</button>
            </div>

            <div className="p-4 space-y-5">
              {Object.entries(groupedLibrary).map(([group, items]) => (
                <div key={group}>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">{group}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {items.map((item) => (
                      <div key={item.type} className="border border-gray-200 rounded-lg p-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-gray-900 flex items-center gap-2"><span>{item.icon}</span> {item.displayName}</p>
                          <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                          <div className="mt-2 h-16 rounded-md bg-gray-50 border border-gray-100 flex items-center justify-center text-xs text-gray-400">Preview placeholder</div>
                        </div>
                        <button onClick={() => onAddSection(item.type)} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-xs">Add</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
