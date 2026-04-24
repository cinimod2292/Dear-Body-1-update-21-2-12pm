import { Link } from "react-router";

type ImageTextProps = {
  title: string;
  body?: string;
  imageUrl?: string;
  imageAlt?: string;
  buttonText?: string;
  buttonHref?: string;
  layout?: "image_left" | "image_right";
};

export function ImageTextSection(props: ImageTextProps) {
  const rowClass = props.layout === "image_left" ? "lg:flex-row-reverse" : "";
  return (
    <section className="py-16 bg-white">
      <div className={`max-w-6xl mx-auto px-4 sm:px-6 flex flex-col ${rowClass} lg:flex-row items-center gap-8`}>
        <div className="flex-1">
          <h3 className="text-3xl font-black text-gray-900 mb-3">{props.title}</h3>
          {props.body ? <p className="text-gray-600 mb-6">{props.body}</p> : null}
          {props.buttonText ? <Link to={props.buttonHref || "/shop"} className="px-7 py-3 rounded-full bg-gray-900 text-white inline-flex">{props.buttonText}</Link> : null}
        </div>
        <div className="flex-1">
          {props.imageUrl
            ? <img src={props.imageUrl} alt={props.imageAlt || props.title} className="w-full rounded-2xl object-cover max-h-[420px]" loading="lazy" decoding="async" />
            : <div className="w-full rounded-2xl bg-gray-100 min-h-[280px]" />}
        </div>
      </div>
    </section>
  );
}
