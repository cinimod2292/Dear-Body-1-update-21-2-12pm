type RichTextProps = {
  title?: string;
  content?: string;
  alignment?: "left" | "center";
  maxWidth?: "narrow" | "standard" | "wide";
  tone?: "white" | "soft" | "warm" | "muted";
};

export function RichTextSection(props: RichTextProps) {
  const align = props.alignment === "center" ? "text-center mx-auto" : "";
  const maxW = props.maxWidth === "narrow" ? "max-w-2xl" : props.maxWidth === "wide" ? "max-w-5xl" : "max-w-3xl";
  const bg =
    props.tone === "soft"
      ? "bg-pink-50/40"
      : props.tone === "warm"
        ? "bg-orange-50"
        : props.tone === "muted"
          ? "bg-gray-50"
          : "bg-white";
  return (
    <section className={`py-16 ${bg}`}>
      <div className={`${maxW} mx-auto px-4 sm:px-6 ${align}`}>
        {props.title ? <h2 className="text-3xl font-black text-gray-900 mb-6">{props.title}</h2> : null}
        {props.content ? (
          <div className="text-gray-600 leading-relaxed whitespace-pre-wrap text-base">{props.content}</div>
        ) : null}
      </div>
    </section>
  );
}
