import { Link } from "react-router";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">{label}</div>;
}

export function EmptyState({ label, cta }: { label: string; cta?: { label: string; to: string } }) {
  return (
    <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-500">
      <p className="mb-3">{label}</p>
      {cta && (
        <Link to={cta.to} className="inline-block px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors">
          {cta.label}
        </Link>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700 text-sm">
      <p className="font-semibold mb-2">Something went wrong</p>
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-4 px-3 py-2 rounded-lg bg-red-600 text-white text-xs">Retry</button>
      )}
    </div>
  );
}
