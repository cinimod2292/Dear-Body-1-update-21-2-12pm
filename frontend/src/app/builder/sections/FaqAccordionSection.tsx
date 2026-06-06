import { useState } from "react";
import { ChevronDown } from "lucide-react";

type FaqItem = { question: string; answer: string };

type FaqAccordionProps = {
  title?: string;
  subtitle?: string;
  items: FaqItem[];
  tone?: "white" | "soft" | "muted";
};

export function FaqAccordionSection(props: FaqAccordionProps) {
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const items = Array.isArray(props.items) ? props.items : [];
  const bg =
    props.tone === "soft"
      ? "bg-pink-50/30"
      : props.tone === "muted"
        ? "bg-gray-50"
        : "bg-white";

  return (
    <section className={`py-16 ${bg}`}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {props.title ? (
          <h2 className="text-3xl font-black text-gray-900 mb-2 text-center">{props.title}</h2>
        ) : null}
        {props.subtitle ? (
          <p className="text-gray-500 mb-8 text-center">{props.subtitle}</p>
        ) : null}
        <div className="space-y-2">
          {items.map((item, idx) => {
            const panelId = `faq-panel-${idx}`;
            const triggerId = `faq-trigger-${idx}`;
            const isOpen = openQuestion === item.question;
            return (
              <div key={item.question || idx} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  id={triggerId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenQuestion(isOpen ? null : item.question)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition"
                >
                  <span className="font-semibold text-gray-900 text-sm pr-4">{item.question}</span>
                  <ChevronDown
                    size={16}
                    className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen ? (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={triggerId}
                    className="px-5 pb-5 text-sm text-gray-600 leading-relaxed border-t border-gray-100"
                  >
                    <div className="pt-4 whitespace-pre-wrap">{item.answer}</div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
