import { useEffect, useState } from "react";
import { Star, ThumbsUp, CheckCircle2, AlertCircle } from "lucide-react";
import { API_BASE } from "../admin/api/client";

interface Review {
  id: string;
  reviewerName: string;
  rating: number;
  title?: string;
  body?: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
  adminReply?: string;
  adminRepliedAt?: string;
  createdAt: string;
}

interface ReviewAggregate {
  averageRating: number;
  totalReviews: number;
  breakdown: Record<number, number>;
}

interface ReviewsData {
  reviews: Review[];
  total: number;
  aggregate: ReviewAggregate;
}

interface Props {
  productId: string;
  productName: string;
  initialRating?: number;
  initialCount?: number;
}

function StarDisplay({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}
        />
      ))}
    </div>
  );
}

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          className="cursor-pointer"
          aria-label={`Rate ${i} star${i > 1 ? "s" : ""}`}
        >
          <Star
            size={28}
            className={(hovered || value) >= i ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}
          />
        </button>
      ))}
    </div>
  );
}

export function ProductReviews({ productId, productName, initialRating = 0, initialCount = 0 }: Props) {
  const [data, setData] = useState<ReviewsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    reviewerName: "",
    rating: 0,
    title: "",
    body: "",
  });

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/store/products/${productId}/reviews?perPage=10`)
      .then((r) => r.json())
      .catch(() => null)
      .then((payload) => {
        if (payload?.data) setData(payload.data);
      })
      .finally(() => setLoading(false));
  }, [productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.rating) { setError("Please select a star rating."); return; }
    if (!form.reviewerName.trim()) { setError("Please enter your name."); return; }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/store/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error?.message || "Failed to submit review");
      setSubmitted(true);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  const handleHelpful = async (reviewId: string) => {
    await fetch(`${API_BASE}/store/reviews/${reviewId}/helpful`, { method: "POST" }).catch(() => null);
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        reviews: prev.reviews.map((r) => r.id === reviewId ? { ...r, helpfulCount: r.helpfulCount + 1 } : r),
      };
    });
  };

  const agg = data?.aggregate;
  const displayRating = agg?.averageRating || initialRating;
  const displayCount = agg?.totalReviews ?? initialCount;

  return (
    <section className="mt-16 border-t border-gray-100 pt-12" aria-label="Customer reviews">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-gray-900 mb-1">Customer Reviews</h2>
          {displayCount > 0 && (
            <div className="flex items-center gap-3">
              <StarDisplay rating={displayRating} size={20} />
              <span className="font-bold text-gray-800">{displayRating.toFixed(1)}</span>
              <span className="text-gray-400 text-sm">based on {displayCount} review{displayCount !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
        {!submitted && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-5 py-2.5 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold text-sm shrink-0"
          >
            Write a Review
          </button>
        )}
      </div>

      {/* Rating breakdown */}
      {agg && agg.totalReviews > 0 && (
        <div className="bg-gray-50 rounded-2xl p-6 mb-8 max-w-sm">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = agg.breakdown[star] || 0;
            const pct = agg.totalReviews > 0 ? Math.round((count / agg.totalReviews) * 100) : 0;
            return (
              <div key={star} className="flex items-center gap-3 mb-2">
                <span className="text-xs text-gray-600 w-4 text-right">{star}</span>
                <Star size={12} className="text-yellow-400 fill-yellow-400 shrink-0" />
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div className="bg-yellow-400 h-2 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-gray-400 w-6">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Review form */}
      {showForm && !submitted && (
        <form onSubmit={handleSubmit} className="bg-pink-50 rounded-2xl p-6 mb-8 border border-pink-100">
          <h3 className="font-bold text-gray-900 mb-4">Share Your Experience with {productName}</h3>
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Your Rating *</label>
            <StarInput value={form.rating} onChange={(v) => setForm((f) => ({ ...f, rating: v }))} />
          </div>
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Your Name *</label>
            <input
              type="text"
              value={form.reviewerName}
              onChange={(e) => setForm((f) => ({ ...f, reviewerName: e.target.value }))}
              placeholder="Jane D."
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-400"
              maxLength={80}
            />
          </div>
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Review Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Summarise your experience"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-400"
              maxLength={120}
            />
          </div>
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Your Review</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="Tell others what you loved (or didn't love) about this product..."
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-400 resize-none"
              maxLength={1500}
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm mb-4">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold text-sm disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit Review"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-6 py-2.5 rounded-full border border-gray-200 text-gray-600 font-medium text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {submitted && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl p-5 mb-8 text-green-700">
          <CheckCircle2 size={20} />
          <div>
            <p className="font-bold">Thank you for your review!</p>
            <p className="text-sm">It's under review and will be published shortly.</p>
          </div>
        </div>
      )}

      {/* Review list */}
      {loading ? (
        <div className="text-gray-400 text-sm">Loading reviews…</div>
      ) : data && data.reviews.length > 0 ? (
        <div className="space-y-6">
          {data.reviews.map((review) => (
            <div key={review.id} className="border border-gray-100 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <StarDisplay rating={review.rating} size={14} />
                    {review.verifiedPurchase && (
                      <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                        <CheckCircle2 size={12} /> Verified Purchase
                      </span>
                    )}
                  </div>
                  {review.title && <p className="font-bold text-gray-900">{review.title}</p>}
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(review.createdAt).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" })}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-2">{review.reviewerName}</p>
              {review.body && <p className="text-sm text-gray-700 leading-relaxed mb-3">{review.body}</p>}

              {review.adminReply && (
                <div className="bg-pink-50 border-l-4 border-pink-400 pl-4 py-2 mt-3 rounded-r-xl">
                  <p className="text-xs font-bold text-pink-700 mb-1">Response from Dear Body</p>
                  <p className="text-sm text-gray-700">{review.adminReply}</p>
                </div>
              )}

              <button
                onClick={() => handleHelpful(review.id)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-pink-500 transition-colors mt-3"
              >
                <ThumbsUp size={12} />
                Helpful ({review.helpfulCount})
              </button>
            </div>
          ))}
        </div>
      ) : !loading && displayCount === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Star size={32} className="mx-auto mb-3 text-gray-200" />
          <p className="font-medium">No reviews yet</p>
          <p className="text-sm">Be the first to share your experience!</p>
        </div>
      ) : null}
    </section>
  );
}
