import { FastifyInstance } from "fastify";
import {
  addMyAddress,
  deleteMyAddress,
  getMyProfile,
  listMyAddresses,
  setMyAddressDefault,
  updateMyAddress,
  updateMyProfile,
} from "./store-account.service.js";

export async function storeAccountRoutes(app: FastifyInstance) {
  app.get("/store/account/profile", { preHandler: [app.verifyCustomer] }, async (request, reply) => {
    return reply.send({ data: await getMyProfile(request.customer.id) });
  });

  app.patch("/store/account/profile", { preHandler: [app.verifyCustomer] }, async (request, reply) => {
    return reply.send({ data: await updateMyProfile(request.customer.id, request.body) });
  });

  app.get("/store/account/addresses", { preHandler: [app.verifyCustomer] }, async (request, reply) => {
    return reply.send({ data: await listMyAddresses(request.customer.id) });
  });

  app.post("/store/account/addresses", { preHandler: [app.verifyCustomer] }, async (request, reply) => {
    return reply.status(201).send({ data: await addMyAddress(request.customer.id, request.body) });
  });

  app.patch("/store/account/addresses/:addressId", { preHandler: [app.verifyCustomer] }, async (request, reply) => {
    const { addressId } = request.params as { addressId: string };
    return reply.send({ data: await updateMyAddress(request.customer.id, addressId, request.body) });
  });

  app.post("/store/account/addresses/:addressId/default", { preHandler: [app.verifyCustomer] }, async (request, reply) => {
    const { addressId } = request.params as { addressId: string };
    return reply.send({ data: await setMyAddressDefault(request.customer.id, addressId, request.body) });
  });

  app.delete("/store/account/addresses/:addressId", { preHandler: [app.verifyCustomer] }, async (request, reply) => {
    const { addressId } = request.params as { addressId: string };
    await deleteMyAddress(request.customer.id, addressId);
    return reply.status(204).send();
  });
}
