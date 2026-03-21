import { z } from "zod";

export const webhookParamsSchema = z.object({
  source: z.string().min(1),
});
