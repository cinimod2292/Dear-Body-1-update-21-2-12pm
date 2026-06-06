type GalleryImage = { url: string; alt?: string };

type ImageGalleryProps = {
  title?: string;
  images: GalleryImage[];
  columns?: "2" | "3" | "4";
  tone?: "white" | "muted";
};

export function ImageGallerySection(props: ImageGalleryProps) {
  const images = Array.isArray(props.images) ? props.images : [];
  const cols =
    props.columns === "4"
      ? "md:grid-cols-4"
      : props.columns === "2"
        ? "md:grid-cols-2"
        : "md:grid-cols-3";
  const bg = props.tone === "muted" ? "bg-gray-50" : "bg-white";

  return (
    <section className={`py-14 ${bg}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {props.title ? (
          <h2 className="text-3xl font-black text-gray-900 mb-8 text-center">{props.title}</h2>
        ) : null}
        {images.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-2xl h-48 flex items-center justify-center">
            <p className="text-sm text-gray-400">Add images in the inspector panel</p>
          </div>
        ) : (
          <div className={`grid grid-cols-2 ${cols} gap-3`}>
            {images.map((img, idx) => (
              <div
                key={idx}
                className="relative overflow-hidden rounded-2xl aspect-square bg-gray-100 group"
              >
                {img.url ? (
                  <img
                    src={img.url}
                    alt={img.alt || `Gallery image ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-sm">
                    No image
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
