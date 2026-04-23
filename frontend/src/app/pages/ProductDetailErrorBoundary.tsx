import { Link, isRouteErrorResponse, useRouteError } from "react-router";

export default function ProductDetailErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "Something went wrong while loading this product.";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl">🛍️</p>
      <h2 className="text-2xl font-bold text-gray-800">We couldn&apos;t open this product page</h2>
      <p className="text-sm text-gray-500 max-w-md">{message}</p>
      <Link to="/shop" className="px-6 py-3 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-full font-bold">
        Back to Shop
      </Link>
    </div>
  );
}
