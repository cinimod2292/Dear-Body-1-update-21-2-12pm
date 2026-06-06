type SpacerProps = {
  height?: "sm" | "md" | "lg" | "xl";
  showDivider?: boolean;
  tone?: "white" | "muted";
};

const HEIGHT_MAP: Record<string, string> = {
  sm: "h-8",
  md: "h-16",
  lg: "h-24",
  xl: "h-32",
};

export function SpacerSection(props: SpacerProps) {
  const heightClass = HEIGHT_MAP[props.height ?? "md"];
  const bg = props.tone === "muted" ? "bg-gray-50" : "bg-white";

  return (
    <div className={`${bg} ${heightClass} flex items-center`}>
      {props.showDivider ? (
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6">
          <hr className="border-gray-200" />
        </div>
      ) : null}
    </div>
  );
}
