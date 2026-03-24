import { z } from "zod";

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().default(20).transform((perPage) => Math.min(perPage, 100)),
  sortBy: z.string().default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  q: z.string().optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export function toPrismaPagination(query: ListQuery) {
  const skip = (query.page - 1) * query.perPage;
  const take = query.perPage;
  return {
    skip,
    take,
    orderBy: {
      [query.sortBy]: query.sortDir,
    },
  } as const;
}

export function toPaginatedResponse<T>(items: T[], total: number, query: ListQuery) {
  return {
    items,
    page: query.page,
    perPage: query.perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    sortBy: query.sortBy,
    sortDir: query.sortDir,
  };
}
