type StatItem = { value: string; label: string };

type StatsBarProps = {
  title?: string;
  items: StatItem[];
  tone?: "white" | "dark" | "soft" | "pink";
};

const BG: Record<NonNullable<StatsBarProps["tone"]>, string> = {
  white: "bg-white",
  dark: "bg-gray-900",
  soft: "bg-pink-50/40",
  pink: "bg-gradient-to-r from-pink-500 to-rose-500",
};

const TEXT: Record<NonNullable<StatsBarProps["tone"]>, { value: string; label: string }> = {
  white: { value: "text-gray-900", label: "text-gray-500" },
  dark: { value: "text-white", label: "text-gray-400" },
  soft: { value: "text-gray-900", label: "text-gray-500" },
  pink: { value: "text-white", label: "text-white/80" },
};

export function StatsBarSection(props: StatsBarProps) {
  const items = Array.isArray(props.items) ? props.items : [];
  const tone = props.tone ?? "white";
  const bg = BG[tone] ?? BG.white;
  const text = TEXT[tone] ?? TEXT.white;

  return (
    <section className={`py-14 ${bg}`}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {props.title ? (
          <p className={`text-xs uppercase tracking-widest font-semibold text-center mb-8 ${text.label}`}>
            {props.title}
          </p>
        ) : null}
        <div className={`grid grid-cols-2 ${items.length <= 2 ? "md:grid-cols-2" : items.length === 3 ? "md:grid-cols-3" : "md:grid-cols-4"} gap-8`}>
          {items.map((item, idx) => (
            <div key={idx} className="text-center">
              <p className={`text-4xl font-black mb-1 ${text.value}`}>{item.value}</p>
              <p className={`text-sm font-medium ${text.label}`}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
