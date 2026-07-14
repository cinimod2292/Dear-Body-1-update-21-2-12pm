import { MessageCircle } from "lucide-react";

export type WhatsAppCtaProps = {
  title?: string;
  subtitle?: string;
  whatsappNumber?: string;
  buttonText?: string;
  message?: string;
  productName?: string;
  tone?: "green" | "soft" | "dark";
  layout?: "section" | "inline";
};

function normalizeWhatsAppNumber(rawNumber: string | undefined) {
  return (rawNumber || import.meta.env.VITE_WHATSAPP_NUMBER || "27000000000").replace(/\D/g, "");
}

function buildWhatsAppMessage(message: string | undefined, productName: string | undefined) {
  if (message?.trim()) return message.trim().replace(/\{productName\}/g, productName || "this product");
  if (productName) return `Hi! I have a question about: ${productName}`;
  return "Hi! I have a question.";
}

export function buildWhatsAppHref(whatsappNumber: string | undefined, message: string | undefined, productName?: string) {
  const normalizedNumber = normalizeWhatsAppNumber(whatsappNumber);
  const text = encodeURIComponent(buildWhatsAppMessage(message, productName));
  return `https://wa.me/${normalizedNumber}?text=${text}`;
}

export function WhatsAppCtaSection({
  title = "Have a question about this product?",
  subtitle = "Our team is ready to help via WhatsApp",
  whatsappNumber,
  buttonText = "Chat Now",
  message,
  productName,
  tone = "green",
  layout = "section",
}: WhatsAppCtaProps) {
  const isDark = tone === "dark";
  const wrapperClass = isDark
    ? "bg-gray-900 border-gray-800 text-white"
    : tone === "soft"
      ? "bg-pink-50 border-pink-100 text-gray-900"
      : "bg-green-50 border-green-100 text-gray-900";
  const subtitleClass = isDark ? "text-gray-300" : "text-gray-500";

  const banner = (
    <div className={`flex items-center gap-3 rounded-2xl border p-4 ${wrapperClass}`}>
      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shrink-0">
        <MessageCircle size={20} className="text-white" />
      </div>
      <div className="flex-1">
        <p className="font-bold text-sm">{title}</p>
        {subtitle ? <p className={`text-xs ${subtitleClass}`}>{subtitle}</p> : null}
      </div>
      <a
        href={buildWhatsAppHref(whatsappNumber, message, productName)}
        target="_blank"
        rel="noopener noreferrer"
        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full text-sm font-bold transition-colors whitespace-nowrap"
      >
        {buttonText}
      </a>
    </div>
  );

  if (layout === "inline") return banner;

  return (
    <section className="py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {banner}
      </div>
    </section>
  );
}
