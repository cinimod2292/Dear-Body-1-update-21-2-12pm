import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { API_BASE } from "../admin/api/client";

interface Faq {
  id: string;
  question: string;
  answer: string;
}

interface Props {
  productId: string;
}

export function ProductFaqSection({ productId }: Props) {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/store/products/${productId}/faqs`)
      .then((r) => r.json())
      .catch(() => null)
      .then((payload) => {
        if (Array.isArray(payload?.data)) setFaqs(payload.data);
      });
  }, [productId]);

  if (!faqs.length) return null;

  return (
    <section className="mt-12 border-t border-gray-100 pt-10" aria-label="Frequently asked questions">
      <h2 className="text-2xl font-black text-gray-900 mb-6">Frequently Asked Questions</h2>
      <div className="divide-y divide-gray-100">
        {faqs.map((faq) => {
          const isOpen = openId === faq.id;
          return (
            <div key={faq.id}>
              <button
                onClick={() => setOpenId(isOpen ? null : faq.id)}
                className="w-full flex items-center justify-between py-4 text-left gap-4 hover:text-pink-500 transition-colors"
                aria-expanded={isOpen}
              >
                <span className="font-semibold text-gray-900 text-sm leading-snug">{faq.question}</span>
                {isOpen ? <ChevronUp size={18} className="shrink-0 text-pink-500" /> : <ChevronDown size={18} className="shrink-0 text-gray-400" />}
              </button>
              {isOpen && (
                <div className="pb-5">
                  <p className="text-gray-600 text-sm leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
