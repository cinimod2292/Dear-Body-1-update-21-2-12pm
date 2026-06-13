import { FastifyInstance } from "fastify";
import {
  createReview,
  getProductReviews,
  markReviewHelpful,
  adminListReviews,
  adminModerateReview,
} from "./reviews.service.js";

export async function reviewsRoutes(app: FastifyInstance) {
  // Public: get approved reviews for a product
  app.get("/store/products/:productId/reviews", async (request, reply) => {
    const { productId } = request.params as { productId: string };
    const { page, perPage } = request.query as { page?: string; perPage?: string };
    const result = await getProductReviews({
      productId,
      status: "APPROVED",
      page: page ? Number(page) : 1,
      perPage: perPage ? Math.min(Number(perPage), 50) : 10,
    });
    reply.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return reply.send({ data: result });
  });

  // Public: submit a review (requires rate limiting)
  app.post("/store/products/:productId/reviews", {
    config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
  }, async (request, reply) => {
    const { productId } = request.params as { productId: string };
    const body = request.body as any;

    const review = await createReview({
      productId,
      customerId: body.customerId,
      reviewerName: body.reviewerName,
      reviewerEmail: body.reviewerEmail,
      rating: Number(body.rating),
      title: body.title,
      body: body.body,
    });

    return reply.status(201).send({ data: review, message: "Thank you! Your review is awaiting moderation." });
  });

  // Public: mark review as helpful
  app.post("/store/reviews/:reviewId/helpful", {
    config: { rateLimit: { max: 20, timeWindow: "1 hour" } },
  }, async (request, reply) => {
    const { reviewId } = request.params as { reviewId: string };
    const result = await markReviewHelpful(reviewId);
    return reply.send({ data: result });
  });

  // Admin: list all reviews (pending moderation etc.)
  app.get("/admin/reviews", {
    preHandler: [app.verifyAdmin],
  }, async (request, reply) => {
    const { status, productId, page, perPage } = request.query as Record<string, string>;
    const result = await adminListReviews({
      status,
      productId,
      page: page ? Number(page) : 1,
      perPage: perPage ? Math.min(Number(perPage), 100) : 20,
    });
    return reply.send({ data: result });
  });

  // Admin: moderate a review
  app.patch("/admin/reviews/:reviewId", {
    preHandler: [app.verifyAdmin],
  }, async (request, reply) => {
    const { reviewId } = request.params as { reviewId: string };
    const { status, adminReply } = request.body as { status: "APPROVED" | "REJECTED"; adminReply?: string };
    if (!["APPROVED", "REJECTED"].includes(status)) {
      return reply.status(400).send({ error: { message: "Status must be APPROVED or REJECTED" } });
    }
    const review = await adminModerateReview(reviewId, status, adminReply);
    return reply.send({ data: review });
  });
}
