import type { ComponentType } from "react";
import {
  Award,
  CheckCircle2,
  Clock,
  Gift,
  Globe,
  Heart,
  Leaf,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  Zap,
} from "lucide-react";

export type FeatureIconName =
  | "check"
  | "star"
  | "zap"
  | "gift"
  | "globe"
  | "award"
  | "clock"
  | "sparkles"
  | "shield"
  | "heart"
  | "leaf"
  | "truck";

type FeatureItem = { icon: FeatureIconName; title: string; description?: string };

type IconFeaturesProps = {
  title?: string;
  subtitle?: string;
  columns?: "2" | "3" | "4";
  items: FeatureItem[];
  tone?: "white" | "soft" | "muted";
};

const FEATURE_ICON_MAP = {
  check: CheckCircle2,
  star: Star,
  zap: Zap,
  gift: Gift,
  globe: Globe,
  award: Award,
  clock: Clock,
  sparkles: Sparkles,
  shield: ShieldCheck,
  heart: Heart,
  leaf: Leaf,
  truck: Truck,
} satisfies Record<FeatureIconName, ComponentType<{ size?: number; className?: string }>>;

export function IconFeaturesSection(props: IconFeaturesProps) {
  const items = Array.isArray(props.items) ? props.items : [];
  const cols =
    props.columns === "4"
      ? "md:grid-cols-4"
      : props.columns === "2"
        ? "md:grid-cols-2"
        : "md:grid-cols-3";
  const bg =
    props.tone === "soft"
      ? "bg-pink-50/40"
      : props.tone === "muted"
        ? "bg-gray-50"
        : "bg-white";

  return (
    <section className={`py-16 ${bg}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {props.title ? (
          <h2 className="text-3xl font-black text-gray-900 text-center mb-2">{props.title}</h2>
        ) : null}
        {props.subtitle ? (
          <p className="text-gray-500 text-center mb-10">{props.subtitle}</p>
        ) : null}
        <div className={`grid grid-cols-1 ${cols} gap-8`}>
          {items.map((item, idx) => {
            const Icon = FEATURE_ICON_MAP[item.icon] ?? CheckCircle2;
            return (
              <div key={idx} className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-pink-50 flex items-center justify-center">
                  <Icon size={22} className="text-pink-500" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">{item.title}</h3>
                  {item.description ? (
                    <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
