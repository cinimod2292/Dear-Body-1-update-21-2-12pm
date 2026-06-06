import { useState } from "react";
import { ArrowRight } from "lucide-react";

type NewsletterSignupProps = {
  title?: string;
  subtitle?: string;
  placeholder?: string;
  buttonText?: string;
  buttonHref?: string;
  disclaimer?: string;
  tone?: "soft" | "warm" | "bold" | "muted";
};

export function NewsletterSignupSection(props: NewsletterSignupProps) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const bg =
    props.tone === "warm"
      ? "bg-orange-50"
      : props.tone === "bold"
        ? "bg-gray-900"
        : props.tone === "muted"
          ? "bg-gray-50"
          : "bg-pink-50/50";
  const textClass = props.tone === "bold" ? "text-white" : "text-gray-900";
  const subTextClass = props.tone === "bold" ? "text-gray-300" : "text-gray-500";

  return (
    <section className={`py-16 ${bg}`}>
      <div className="max-w-xl mx-auto px-4 sm:px-6 text-center">
        {props.title ? (
          <h2 className={`text-3xl font-black mb-2 ${textClass}`}>{props.title}</h2>
        ) : null}
        {props.subtitle ? (
          <p className={`mb-6 ${subTextClass}`}>{props.subtitle}</p>
        ) : null}
        {submitted ? (
          <div className="py-4 px-6 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="text-emerald-700 font-semibold">You're on the list!</p>
            <p className="text-emerald-600 text-sm mt-1">Check your inbox for a welcome email.</p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email) setSubmitted(true);
            }}
            className="flex flex-col sm:flex-row gap-2 max-w-sm mx-auto"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={props.placeholder || "Your email address"}
              className="flex-1 px-4 py-3 rounded-full border border-gray-300 text-sm focus:outline-none focus:border-pink-400 bg-white"
              required
            />
            <button
              type="submit"
              className="px-5 py-3 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold text-sm inline-flex items-center justify-center gap-1 hover:opacity-90 transition"
            >
              {props.buttonText || "Subscribe"} <ArrowRight size={14} />
            </button>
          </form>
        )}
        {props.disclaimer && !submitted ? (
          <p className={`text-xs mt-3 ${subTextClass} opacity-70`}>{props.disclaimer}</p>
        ) : null}
      </div>
    </section>
  );
}
