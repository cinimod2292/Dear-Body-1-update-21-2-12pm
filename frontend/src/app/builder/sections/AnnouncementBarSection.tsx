import { Link } from "react-router";

type AnnouncementBarProps = {
  text: string;
  linkText?: string;
  linkHref?: string;
  tone?: "pink" | "dark" | "warm" | "light";
};

const BG: Record<NonNullable<AnnouncementBarProps["tone"]>, string> = {
  pink: "bg-gradient-to-r from-pink-500 to-rose-500 text-white",
  dark: "bg-gray-900 text-white",
  warm: "bg-gradient-to-r from-orange-400 to-pink-500 text-white",
  light: "bg-pink-50 text-gray-900 border-b border-pink-100",
};

export function AnnouncementBarSection(props: AnnouncementBarProps) {
  const tone = props.tone ?? "pink";
  const bg = BG[tone] ?? BG.pink;

  return (
    <div className={`w-full py-2.5 px-4 text-center text-sm font-medium ${bg}`}>
      <span>{props.text}</span>
      {props.linkText && props.linkHref ? (
        <Link
          to={props.linkHref}
          className="ml-2 underline underline-offset-2 opacity-90 hover:opacity-100 font-semibold"
        >
          {props.linkText} →
        </Link>
      ) : null}
    </div>
  );
}
