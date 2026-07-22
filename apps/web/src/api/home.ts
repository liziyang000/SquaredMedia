import { z } from "zod";

import { ApiError, requestJson } from "./http";
import { identifierSchema, requireApiEndpoint, withApiParams } from "./schemas";

const categorySchema = z.object({
  id: identifierSchema,
  name: z.string().min(1)
});

const episodeSchema = z.object({
  id: identifierSchema,
  sourceId: identifierSchema
});

const heroVideoSchema = z.object({
  id: identifierSchema,
  title: z.string().min(1),
  year: z.string().min(1),
  class: z.string().min(1),
  backdrop: z.string().min(1),
  duration: z.string().min(1),
  version: z.string().min(1),
  summary: z.string(),
  episodes: z.array(episodeSchema).min(1)
});

const cardVideoSchema = z.object({
  id: identifierSchema,
  title: z.string().min(1),
  remark: z.string().min(1),
  year: z.string().min(1),
  class: z.string().min(1),
  score: z.coerce.number().nonnegative(),
  poster: z.string().min(1)
});

const navigationSchema = z.object({
  siteName: z.string().min(1),
  categories: z.array(categorySchema)
});

const homeResponseSchema = navigationSchema.extend({
  todayUpdated: z.coerce.number().int().nonnegative(),
  hero: z.array(heroVideoSchema).max(5),
  ranking: z.array(cardVideoSchema).max(5),
  latest: z.array(cardVideoSchema).max(6),
  latestByCategory: z.array(
    z.object({
      categoryId: identifierSchema,
      videos: z.array(cardVideoSchema).max(6)
    })
  )
});

const envelopeSchema = z.object({
  code: z.union([z.string(), z.number()]),
  msg: z.string().optional(),
  data: z.unknown()
});

export type HomeCategory = z.infer<typeof categorySchema>;
export type HomeHeroVideo = z.infer<typeof heroVideoSchema>;
export type HomeCardVideo = z.infer<typeof cardVideoSchema>;
export type HomeNavigation = z.infer<typeof navigationSchema>;
export type HomeData = z.infer<typeof homeResponseSchema>;

export type HomeApi = {
  getHome(): Promise<HomeData>;
  getNavigation(): Promise<HomeNavigation>;
};

type HomeApiOptions = {
  endpoint?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export function createHomeApi({ endpoint = "", fetchImpl, timeoutMs }: HomeApiOptions = {}): HomeApi {
  async function fetchAction<T>(action: string, schema: z.ZodType<T>, fallbackMessage: string, params: Record<string, string | number> = {}) {
    const url = withApiParams(requireApiEndpoint(endpoint), { action, ...params });
    const payload = await requestJson<unknown>(url, { method: "GET", fetchImpl, timeoutMs });
    const envelope = envelopeSchema.safeParse(payload);

    if (!envelope.success && process.env.NODE_ENV === "production") {
      throw new ApiError(`${fallbackMessage}接口返回格式不正确`, { kind: "invalid-response" });
    }
    if (envelope.success && String(envelope.data.code) !== "1") {
      throw new ApiError(envelope.data.msg || `${fallbackMessage}失败`, {
        kind: "business",
        code: envelope.data.code
      });
    }

    const parsed = schema.safeParse(envelope.success ? envelope.data.data : payload);
    if (!parsed.success) {
      throw new ApiError(`${fallbackMessage}接口返回格式不正确`, { kind: "invalid-response" });
    }
    return parsed.data;
  }

  return Object.freeze({
    getHome() {
      return fetchAction("home_v2", homeResponseSchema, "首页", { compact: 1 });
    },
    getNavigation() {
      return fetchAction("navigation", navigationSchema, "导航");
    }
  });
}

const homeEndpoint =
  process.env.NEXT_PUBLIC_HOME_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (process.env.NODE_ENV === "production" ? "" : "/react-api.php?action=home_v2");

export const homeApi = createHomeApi({ endpoint: homeEndpoint });
