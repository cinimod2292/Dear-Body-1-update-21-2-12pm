import { Heart, Leaf, ShieldCheck, Sparkles, Truck } from "lucide-react";

type BenefitItem = { icon: "sparkles" | "shield" | "heart" | "leaf" | "truck"; title: string; text?: string };

type BenefitIconsProps = {
  title: string;
  columns?: "3" | "4";
  items: BenefitItem[];
};

const iconMap = {
  sparkles: Sparkles,
  shield: ShieldCheck,
  heart: Heart,
  leaf: Leaf,
  truck: Truck,
} as const;

export function BenefitIconsSection(props: BenefitIconsProps) {
  const columns = props.columns === "4" ? "md:grid-cols-4" : "md:grid-cols-3";
  return (
    <section className="py-14 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h3 className="text-2xl font-black text-gray-900 text-center mb-8">{props.title}</h3>
        <div className={`grid grid-cols-1 ${columns} gap-4`}>
          {props.items.map((item, idx) => {
            const Icon = iconMap[item.icon] ?? Sparkles;
            return (
              <div key={`${item.title}-${idx}`} className="border border-gray-100 rounded-xl p-5 text-center">
                <Icon className="mx-auto text-pink-500 mb-2" size={20} />
                <p className="font-bold text-gray-900">{item.title}</p>
                {item.text ? <p className="text-sm text-gray-600 mt-1">{item.text}</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
