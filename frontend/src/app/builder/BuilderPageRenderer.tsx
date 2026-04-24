import { Product } from "../data/products";
import { dearBodySectionRegistry } from "./registry";
import { BuilderPageContent, BuilderSection } from "./types";

type BuilderPageRendererProps = {
  content: BuilderPageContent;
  products: Product[];
  onWarning?: (message: string) => void;
};

function renderSection(section: BuilderSection, products: Product[]) {
  const registryEntry = dearBodySectionRegistry[section.type];
  if (!registryEntry) return null;
  const Component = registryEntry.component;
  return <Component {...section.props} products={products} />;
}

export function BuilderPageRenderer({ content, products, onWarning }: BuilderPageRendererProps) {
  const sections = Array.isArray(content?.sections) ? content.sections : [];
  return (
    <>
      {sections.filter((section) => section?.enabled !== false).map((section) => {
        if (!dearBodySectionRegistry[section.type]) {
          onWarning?.(`Unknown section type: ${section.type}`);
          return null;
        }
        return <div key={section.id}>{renderSection(section, products)}</div>;
      })}
    </>
  );
}
