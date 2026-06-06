export type SocialPlatform = "instagram" | "tiktok" | "facebook" | "pinterest" | "twitter" | "youtube" | "whatsapp";

type SocialLinksProps = {
  title?: string;
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  pinterest?: string;
  twitter?: string;
  youtube?: string;
  whatsapp?: string;
  style?: "pills" | "icons";
  tone?: "white" | "dark" | "soft";
};

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  pinterest: "Pinterest",
  twitter: "X (Twitter)",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
};

const PLATFORM_COLOR: Record<SocialPlatform, string> = {
  instagram: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white",
  tiktok: "bg-gray-900 text-white",
  facebook: "bg-blue-600 text-white",
  pinterest: "bg-red-500 text-white",
  twitter: "bg-black text-white",
  youtube: "bg-red-600 text-white",
  whatsapp: "bg-green-500 text-white",
};

const ALL_PLATFORMS: SocialPlatform[] = ["instagram", "tiktok", "facebook", "pinterest", "twitter", "youtube", "whatsapp"];

export function SocialLinksSection(props: SocialLinksProps) {
  const bg =
    props.tone === "dark"
      ? "bg-gray-900"
      : props.tone === "soft"
        ? "bg-pink-50/30"
        : "bg-white";
  const titleColor = props.tone === "dark" ? "text-white" : "text-gray-900";

  const activeLinks = ALL_PLATFORMS.filter(
    (p) => typeof (props as Record<string, unknown>)[p] === "string" && (props as Record<string, unknown>)[p],
  );

  if (activeLinks.length === 0) return null;

  return (
    <section className={`py-14 ${bg}`}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        {props.title ? (
          <p className={`text-xs uppercase tracking-widest font-semibold mb-6 ${titleColor}`}>
            {props.title}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {activeLinks.map((platform) => {
            const href = (props as Record<string, unknown>)[platform] as string;
            const isExternal = href.startsWith("http");
            const colorClass = PLATFORM_COLOR[platform];
            const label = PLATFORM_LABEL[platform];
            return (
              <a
                key={platform}
                href={href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className={`inline-flex items-center px-5 py-2.5 rounded-full text-sm font-semibold transition hover:opacity-85 ${colorClass}`}
              >
                {label}
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
