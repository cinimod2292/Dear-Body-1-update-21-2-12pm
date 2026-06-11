import {
  Droplets,
  FlaskConical,
  Leaf,
  Sparkles,
  Sun,
  Wind,
  type LucideIcon,
} from "lucide-react";

export type IngredientIconName = "leaf" | "droplets" | "sun" | "sparkles" | "flask" | "wind";

type IngredientItem = {
  icon: IngredientIconName;
  name: string;
  benefit: string;
};

type IngredientHighlightsProps = {
  title?: string;
  subtitle?: string;
  items: IngredientItem[];
  tone?: "white" | "soft" | "dark";
};

const ICON_MAP = {
  leaf: Leaf,
  droplets: Droplets,
  sun: Sun,
  sparkles: Sparkles,
  flask: FlaskConical,
  wind: Wind,
} satisfies Record<IngredientIconName, LucideIcon>;

const CARD_BG: Record<IngredientIconName, string> = {
  leaf: "bg-emerald-50",
  droplets: "bg-blue-50",
  sun: "bg-yellow-50",
  sparkles: "bg-pink-50",
  flask: "bg-violet-50",
  wind: "bg-cyan-50",
};

const CARD_TEXT: Record<IngredientIconName, string> = {
  leaf: "text-emerald-600",
  droplets: "text-blue-500",
  sun: "text-yellow-500",
  sparkles: "text-pink-500",
  flask: "text-violet-500",
  wind: "text-cyan-500",
};

export function IngredientHighlightsSection(props: IngredientHighlightsProps) {
  const items = Array.isArray(props.items) ? props.items : [];
  const bg =
    props.tone === "dark"
      ? "bg-gray-900"
      : props.tone === "soft"
        ? "bg-pink-50/30"
        : "bg-white";
  const headingColor = props.tone === "dark" ? "text-white" : "text-gray-900";
  const subtitleColor = props.tone === "dark" ? "text-gray-400" : "text-gray-500";
  const nameColor = props.tone === "dark" ? "text-white" : "text-gray-900";
  const benefitColor = props.tone === "dark" ? "text-gray-400" : "text-gray-500";

  return (
    <section className={`py-16 ${bg}`}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {props.title ? (
          <h2 className={`text-3xl font-black text-center mb-2 ${headingColor}`}>{props.title}</h2>
        ) : null}
        {props.subtitle ? (
          <p className={`text-center mb-10 ${subtitleColor}`}>{props.subtitle}</p>
        ) : null}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
          {items.map((item, idx) => {
            const Icon = ICON_MAP[item.icon] ?? Leaf;
            const cardBg = CARD_BG[item.icon] ?? "bg-pink-50";
            const cardText = CARD_TEXT[item.icon] ?? "text-pink-500";
            return (
              <div key={idx} className="flex flex-col items-center text-center p-6">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${cardBg}`}>
                  <Icon size={28} className={cardText} />
                </div>
                <h3 className={`font-bold text-sm mb-1 ${nameColor}`}>{item.name}</h3>
                <p className={`text-xs leading-relaxed ${benefitColor}`}>{item.benefit}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
