import { Award, CreditCard, Lock, Package, RefreshCcw, ShieldCheck, Star, Zap, type LucideIcon } from "lucide-react";

export type TrustBadgeIconName =
  | "lock"
  | "credit_card"
  | "money_back"
  | "fast_shipping"
  | "package"
  | "award"
  | "star"
  | "shield";

type TrustBadgeItem = { icon: TrustBadgeIconName; label: string };

type TrustBadgesProps = {
  title?: string;
  items: TrustBadgeItem[];
  layout?: "row" | "grid";
  tone?: "white" | "muted";
};

const TRUST_ICON_MAP = {
  lock: Lock,
  credit_card: CreditCard,
  money_back: RefreshCcw,
  fast_shipping: Zap,
  package: Package,
  award: Award,
  star: Star,
  shield: ShieldCheck,
} satisfies Record<TrustBadgeIconName, LucideIcon>;

export function TrustBadgesSection(props: TrustBadgesProps) {
  const items = Array.isArray(props.items) ? props.items : [];
  const bg = props.tone === "muted" ? "bg-gray-50" : "bg-white";
  const isGrid = props.layout === "grid";

  return (
    <section className={`py-10 ${bg} border-y border-gray-100`}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {props.title ? (
          <p className="text-xs uppercase tracking-widest text-gray-400 text-center mb-5 font-semibold">
            {props.title}
          </p>
        ) : null}
        <div
          className={
            isGrid
              ? "grid grid-cols-2 md:grid-cols-4 gap-4"
              : "flex flex-wrap items-center justify-center gap-6 md:gap-10"
          }
        >
          {items.map((item, idx) => {
            const Icon = TRUST_ICON_MAP[item.icon] ?? ShieldCheck;
            return (
              <div
                key={idx}
                className={
                  isGrid
                    ? "flex flex-col items-center gap-2 py-4 px-3 border border-gray-100 rounded-xl text-center"
                    : "flex items-center gap-2"
                }
              >
                <Icon size={isGrid ? 24 : 18} className="text-pink-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-gray-700">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
