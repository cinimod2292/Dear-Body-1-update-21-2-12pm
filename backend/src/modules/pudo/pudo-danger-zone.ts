import { z } from "zod";

export const deleteAllShipmentsSchema = z.object({
  confirmation: z.literal("DELETE ALL SHIPMENTS"),
});
