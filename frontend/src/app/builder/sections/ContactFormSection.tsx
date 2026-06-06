import { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

type ContactFormProps = {
  title?: string;
  subtitle?: string;
  showName?: boolean;
  showSubject?: boolean;
  submitText?: string;
  successTitle?: string;
  successMessage?: string;
  tone?: "white" | "soft" | "muted";
};

export function ContactFormSection(props: ContactFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const showName = props.showName !== false;
  const showSubject = props.showSubject !== false;

  const bg =
    props.tone === "soft"
      ? "bg-pink-50/40"
      : props.tone === "muted"
        ? "bg-gray-50"
        : "bg-white";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <section className={`py-16 ${bg}`}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {props.title ? (
          <h2 className="text-3xl font-black text-gray-900 mb-2 text-center">{props.title}</h2>
        ) : null}
        {props.subtitle ? (
          <p className="text-gray-500 mb-10 text-center">{props.subtitle}</p>
        ) : null}

        {submitted ? (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-10 text-center">
            <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-emerald-800 mb-2">
              {props.successTitle || "Message sent!"}
            </h3>
            <p className="text-emerald-600 text-sm">
              {props.successMessage || "Thanks for reaching out. We'll get back to you within 1–2 business days."}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {showName ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400"
                />
              </div>
            ) : null}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400"
              />
            </div>
            {showSubject ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="How can we help?"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400"
                />
              </div>
            ) : null}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us more..."
                rows={5}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400 resize-y"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold text-sm inline-flex items-center justify-center gap-2 hover:opacity-90 transition"
            >
              {props.submitText || "Send Message"} <ArrowRight size={16} />
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
