import { Product } from "../data/products";
import { dearBodySectionRegistry } from "./registry";
import { BuilderPageContent, BuilderSection } from "./types";

type BuilderPageRendererProps = {
  content: BuilderPageContent;
  products: Product[];
  onWarning?: (message: string) => void;
  selectedSectionId?: string | null;
  onSectionSelect?: (sectionId: string) => void;
  interactive?: boolean;
};

function renderSection(section: BuilderSection, products: Product[]) {
  const registryEntry = dearBodySectionRegistry[section.type];
  if (!registryEntry) return null;
  const Component = registryEntry.component;
  return <Component {...section.props} products={products} />;
}

export function BuilderPageRenderer({
  content,
  products,
  onWarning,
  selectedSectionId,
  onSectionSelect,
  interactive = false,
}: BuilderPageRendererProps) {
  const sections = Array.isArray(content?.sections) ? content.sections : Object.values((content?.sections ?? {}) as Record<string, BuilderSection>);
  return (
    <>
      {sections.filter((section) => section?.enabled !== false).map((section) => {
        if (!dearBodySectionRegistry[section.type]) {
          onWarning?.(`Unknown section type: ${section.type}`);
          return null;
        }

        const isSelected = selectedSectionId === section.id;
        return (
          <div
            key={section.id}
            onClick={interactive ? () => onSectionSelect?.(section.id) : undefined}
            className={interactive ? `relative cursor-pointer rounded-md transition ring-2 ${isSelected ? "ring-pink-400" : "ring-transparent hover:ring-pink-200"}` : ""}
          >
            {interactive ? (
              <div className="absolute left-2 top-2 z-20 rounded bg-white/95 px-2 py-1 text-[11px] font-semibold text-gray-700 border border-gray-200">
                {dearBodySectionRegistry[section.type].displayName}
              </div>
            ) : null}
            {renderSection(section, products)}
          </div>
        );
      })}
    </>
  );
}
