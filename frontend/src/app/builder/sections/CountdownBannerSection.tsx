import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";

type CountdownBannerProps = {
  headline?: string;
  subtext?: string;
  endDate?: string;
  buttonText?: string;
  buttonHref?: string;
  tone?: "warm" | "bold" | "soft" | "clean";
};

type TimeLeft = { days: number; hours: number; minutes: number; seconds: number };

function getTimeLeft(endDate: string): TimeLeft | null {
  const end = new Date(endDate).getTime();
  if (isNaN(end)) return null;
  const diff = end - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 min-w-[64px]">
        <span className="text-3xl font-black tabular-nums leading-none">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <p className="text-xs uppercase tracking-widest mt-2 opacity-80 font-medium">{label}</p>
    </div>
  );
}

export function CountdownBannerSection(props: CountdownBannerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(
    props.endDate ? getTimeLeft(props.endDate) : null,
  );

  useEffect(() => {
    if (!props.endDate) return;
    setTimeLeft(getTimeLeft(props.endDate));
    const timer = setInterval(() => setTimeLeft(getTimeLeft(props.endDate!)), 1000);
    return () => clearInterval(timer);
  }, [props.endDate]);

  const toneClass =
    props.tone === "bold"
      ? "bg-gradient-to-r from-purple-700 via-pink-700 to-red-600 text-white"
      : props.tone === "soft"
        ? "bg-gradient-to-r from-fuchsia-400 via-pink-400 to-rose-400 text-white"
        : props.tone === "clean"
          ? "bg-gradient-to-r from-slate-700 to-slate-900 text-white"
          : "bg-gradient-to-r from-pink-500 via-red-500 to-orange-500 text-white";

  return (
    <section className={`py-14 ${toneClass}`}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        {props.headline ? (
          <h2 className="text-3xl font-black mb-2">{props.headline}</h2>
        ) : null}
        {props.subtext ? <p className="mb-6 opacity-90">{props.subtext}</p> : null}
        {timeLeft ? (
          <div className="flex items-end justify-center gap-3 mb-8">
            <CountdownUnit value={timeLeft.days} label="Days" />
            <span className="text-3xl font-black opacity-60 mb-8">:</span>
            <CountdownUnit value={timeLeft.hours} label="Hours" />
            <span className="text-3xl font-black opacity-60 mb-8">:</span>
            <CountdownUnit value={timeLeft.minutes} label="Mins" />
            <span className="text-3xl font-black opacity-60 mb-8">:</span>
            <CountdownUnit value={timeLeft.seconds} label="Secs" />
          </div>
        ) : null}
        {props.buttonText ? (
          <Link
            to={props.buttonHref || "/shop"}
            className="px-8 py-3 rounded-full bg-white text-pink-600 font-bold inline-flex items-center gap-2 hover:opacity-90 transition"
          >
            {props.buttonText} <ArrowRight size={16} />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
