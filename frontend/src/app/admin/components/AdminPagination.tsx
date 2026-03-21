export function AdminPagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 mt-4">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="px-3 py-2 rounded-lg border border-gray-200 text-sm disabled:opacity-50"
      >
        Previous
      </button>
      <span className="text-sm text-gray-500">Page {page} of {Math.max(totalPages, 1)}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="px-3 py-2 rounded-lg border border-gray-200 text-sm disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}
