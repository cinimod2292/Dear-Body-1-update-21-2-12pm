import { Star } from "lucide-react";

type TestimonialItem = {
  quote: string;
  author: string;
  role?: string;
  rating?: number;
};

type TestimonialsProps = {
  title?: string;
  items: TestimonialItem[];
  tone?: "white" | "soft" | "muted";
};

export function TestimonialsSection(props: TestimonialsProps) {
  const items = Array.isArray(props.items) ? props.items : [];
  const bg =
    props.tone === "soft"
      ? "bg-pink-50/30"
      : props.tone === "muted"
        ? "bg-gray-50"
        : "bg-white";

  return (
    <section className={`py-16 ${bg}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {props.title ? (
          <h2 className="text-3xl font-black text-gray-900 text-center mb-10">{props.title}</h2>
        ) : null}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, idx) => (
            <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="flex gap-1 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={14}
                    className={
                      i < (item.rating ?? 5)
                        ? "text-amber-400 fill-amber-400"
                        : "text-gray-200 fill-gray-200"
                    }
                  />
                ))}
              </div>
              <p className="text-gray-700 text-sm leading-relaxed mb-4">"{item.quote}"</p>
              <div>
                <p className="font-bold text-gray-900 text-sm">{item.author}</p>
                {item.role ? <p className="text-xs text-gray-500 mt-0.5">{item.role}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
