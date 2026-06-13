import { FastifyInstance } from "fastify";
import {
  getProductFaqs,
  adminListFaqs,
  adminCreateFaq,
  adminUpdateFaq,
  adminDeleteFaq,
  seedDefaultFaqs,
} from "./faqs.service.js";

export async function faqsRoutes(app: FastifyInstance) {
  // Public: get FAQs for a product (product-specific + global)
  app.get("/store/products/:productId/faqs", async (request, reply) => {
    const { productId } = request.params as { productId: string };
    const faqs = await getProductFaqs(productId);
    reply.header("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    return reply.send({ data: faqs });
  });

  // Admin: list all FAQs
  app.get("/admin/faqs", {
    preHandler: [app.verifyAdmin],
  }, async (request, reply) => {
    const { productId, isGlobal } = request.query as Record<string, string>;
    const faqs = await adminListFaqs({
      productId,
      isGlobal: isGlobal !== undefined ? isGlobal === "true" : undefined,
    });
    return reply.send({ data: faqs });
  });

  // Admin: create FAQ
  app.post("/admin/faqs", {
    preHandler: [app.verifyAdmin],
  }, async (request, reply) => {
    const body = request.body as any;
    const faq = await adminCreateFaq({
      productId: body.productId,
      question: body.question,
      answer: body.answer,
      position: body.position,
      isGlobal: body.isGlobal,
    });
    return reply.status(201).send({ data: faq });
  });

  // Admin: update FAQ
  app.patch("/admin/faqs/:faqId", {
    preHandler: [app.verifyAdmin],
  }, async (request, reply) => {
    const { faqId } = request.params as { faqId: string };
    const body = request.body as any;
    const faq = await adminUpdateFaq(faqId, body);
    return reply.send({ data: faq });
  });

  // Admin: delete FAQ
  app.delete("/admin/faqs/:faqId", {
    preHandler: [app.verifyAdmin],
  }, async (request, reply) => {
    const { faqId } = request.params as { faqId: string };
    await adminDeleteFaq(faqId);
    return reply.status(204).send();
  });

  // Admin: seed default global FAQs
  app.post("/admin/faqs/seed-defaults", {
    preHandler: [app.verifyAdmin],
  }, async (_request, reply) => {
    const result = await seedDefaultFaqs();
    return reply.send({ data: result });
  });
}
