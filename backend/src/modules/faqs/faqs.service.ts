import { prisma } from "../../lib/prisma.js";

export async function getProductFaqs(productId: string) {
  const [productFaqs, globalFaqs] = await Promise.all([
    prisma.productFaq.findMany({
      where: { productId, isPublished: true },
      orderBy: { position: "asc" },
      select: { id: true, question: true, answer: true, position: true },
    }),
    prisma.productFaq.findMany({
      where: { isGlobal: true, isPublished: true },
      orderBy: { position: "asc" },
      select: { id: true, question: true, answer: true, position: true },
    }),
  ]);

  // Product-specific FAQs take priority; append global ones after
  const productFaqIds = new Set(productFaqs.map((f) => f.id));
  const combined = [
    ...productFaqs,
    ...globalFaqs.filter((f) => !productFaqIds.has(f.id)),
  ];

  return combined;
}

export async function adminListFaqs(query: { productId?: string; isGlobal?: boolean }) {
  const where: any = {};
  if (query.productId !== undefined) where.productId = query.productId;
  if (query.isGlobal !== undefined) where.isGlobal = query.isGlobal;
  return prisma.productFaq.findMany({
    where,
    orderBy: [{ productId: "asc" }, { position: "asc" }],
  });
}

export async function adminCreateFaq(data: {
  productId?: string;
  question: string;
  answer: string;
  position?: number;
  isGlobal?: boolean;
}) {
  return prisma.productFaq.create({
    data: {
      productId: data.productId || null,
      question: data.question.trim(),
      answer: data.answer.trim(),
      position: data.position ?? 0,
      isGlobal: data.isGlobal ?? !data.productId,
      isPublished: true,
    },
  });
}

export async function adminUpdateFaq(id: string, data: Partial<{
  question: string;
  answer: string;
  position: number;
  isPublished: boolean;
}>) {
  return prisma.productFaq.update({ where: { id }, data });
}

export async function adminDeleteFaq(id: string) {
  return prisma.productFaq.delete({ where: { id } });
}

// Seed default global FAQs for beauty/fragrance products
export async function seedDefaultFaqs() {
  const existingCount = await prisma.productFaq.count({ where: { isGlobal: true } });
  if (existingCount > 0) return { seeded: false };

  const defaults = [
    { question: "How long does the fragrance last?", answer: "Our fragrances are carefully crafted for long-lasting wear. Body sprays typically last 4–6 hours, while our perfumed body lotions provide all-day scent. Applying to pulse points and moisturised skin enhances longevity.", position: 0 },
    { question: "Is this suitable for sensitive skin?", answer: "All Dear Body products are dermatologically tested and free from harsh irritants. However, if you have a known skin condition or allergy, we recommend doing a patch test on the inner wrist 24 hours before full application.", position: 1 },
    { question: "Is it cruelty-free?", answer: "Yes — Dear Body is proudly cruelty-free. We never test on animals and work exclusively with suppliers who share our commitment to ethical beauty.", position: 2 },
    { question: "Is it suitable as a gift?", answer: "Absolutely! Our products come in beautiful packaging making them perfect for birthdays, anniversaries, or any celebration. We also offer gift wrapping at checkout.", position: 3 },
    { question: "How should it be stored?", answer: "Store in a cool, dry place away from direct sunlight and heat. Keep the cap tightly closed when not in use. Proper storage ensures the fragrance and formula stay fresh for up to 24 months.", position: 4 },
    { question: "What are the delivery options?", answer: "We offer fast nationwide delivery across South Africa. Standard delivery typically takes 3–5 business days. Express options are available at checkout. Free delivery on qualifying orders.", position: 5 },
    { question: "What is your return policy?", answer: "We offer a 30-day hassle-free return policy. If you are not completely satisfied with your purchase, contact our support team and we will arrange a return or exchange.", position: 6 },
  ];

  await prisma.productFaq.createMany({ data: defaults.map((d) => ({ ...d, isGlobal: true, isPublished: true })) });
  return { seeded: true, count: defaults.length };
}
