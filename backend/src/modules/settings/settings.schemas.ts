import { z } from "zod";

export const upsertSettingSchema = z.object({
  scope: z.string().min(1).default("store"),
  key: z.string().min(1),
  value: z.unknown(),
});
