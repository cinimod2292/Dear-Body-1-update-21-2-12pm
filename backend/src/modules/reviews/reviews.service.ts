import { prisma } from "../../lib/prisma.js";

export interface CreateReviewInput {
  productId: string;
  customerId?: string;
  reviewerName: string;
  reviewerEmail?: string;
  rating: number;
  title?: string;
  body?: string;
}

export interface ReviewsQuery {
  productId: string;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  page?: number;
  perPage?: number;
}

export async function createReview(input: CreateReviewInput) {
  const { productId, customerId, reviewerName, reviewerEmail, rating, title, body } = input;

  if (rating < 1 || rating > 5) throw { statusCode: 400, message: "Rating must be between 1 and 5" };
  if (!reviewerName.trim()) throw { statusCode: 400, message: "Reviewer name is required" };

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw { statusCode: 404, message: "Product not found" };

  let verifiedPurchase = false;
  if (customerId) {
    const order = await prisma.orderItem.findFirst({
      where: {
        productId,
        order: { customerId, status: "DELIVERED" },
      },
      select: { id: true },
    });
    verifiedPurchase = Boolean(order);
  }

  return prisma.productReview.create({
    data: {
      productId,
      customerId,
      reviewerName: reviewerName.trim(),
      reviewerEmail: reviewerEmail?.trim().toLowerCase() || null,
      rating,
      title: title?.trim() || null,
      body: body?.trim() || null,
      verifiedPurchase,
      status: "PENDING",
    },
  });
}

export async function getProductReviews(query: ReviewsQuery) {
  const { productId, status = "APPROVED", page = 1, perPage = 10 } = query;
  const skip = (page - 1) * perPage;

  const [reviews, total, aggregate] = await Promise.all([
    prisma.productReview.findMany({
      where: { productId, status },
      orderBy: [{ helpfulCount: "desc" }, { createdAt: "desc" }],
      skip,
      take: perPage,
      select: {
        id: true,
        reviewerName: true,
        rating: true,
        title: true,
        body: true,
        verifiedPurchase: true,
        helpfulCount: true,
        adminReply: true,
        adminRepliedAt: true,
        createdAt: true,
      },
    }),
    prisma.productReview.count({ where: { productId, status } }),
    prisma.productReview.aggregate({
      where: { productId, status: "APPROVED" },
      _avg: { rating: true },
      _count: { id: true },
    }),
  ]);

  const ratingBreakdown = await prisma.productReview.groupBy({
    by: ["rating"],
    where: { productId, status: "APPROVED" },
    _count: { id: true },
  });

  const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of ratingBreakdown) {
    breakdown[r.rating] = r._count.id;
  }

  return {
    reviews,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
    aggregate: {
      averageRating: aggregate._avg.rating ?? 0,
      totalReviews: aggregate._count.id,
      breakdown,
    },
  };
}

export async function markReviewHelpful(reviewId: string) {
  return prisma.productReview.update({
    where: { id: reviewId },
    data: { helpfulCount: { increment: 1 } },
    select: { id: true, helpfulCount: true },
  });
}

export async function adminListReviews(query: {
  status?: string;
  productId?: string;
  page?: number;
  perPage?: number;
}) {
  const { status, productId, page = 1, perPage = 20 } = query;
  const skip = (page - 1) * perPage;

  const where: any = {};
  if (status) where.status = status;
  if (productId) where.productId = productId;

  const [reviews, total] = await Promise.all([
    prisma.productReview.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
      include: {
        product: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.productReview.count({ where }),
  ]);

  return { reviews, total, page, perPage, totalPages: Math.ceil(total / perPage) };
}

export async function adminModerateReview(reviewId: string, status: "APPROVED" | "REJECTED", adminReply?: string) {
  return prisma.productReview.update({
    where: { id: reviewId },
    data: {
      status,
      adminReply: adminReply?.trim() || null,
      adminRepliedAt: adminReply ? new Date() : null,
    },
  });
}
