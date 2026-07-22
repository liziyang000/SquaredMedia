import { z } from "zod";

import { requestJson } from "./http";
import { identifierSchema, parseApiInput, parseEnvelopeData, requireApiEndpoint, withApiParams } from "./schemas";

const categorySchema = z.object({
  id: identifierSchema,
  name: z.string().min(1),
  total: z.coerce.number().int().nonnegative().optional(),
  parentId: identifierSchema.nullable().optional()
});

const episodeSchema = z.object({
  id: identifierSchema,
  no: z.coerce.number().int().positive(),
  name: z.string().min(1),
  sourceId: identifierSchema
});

const playSourceSchema = z.object({
  id: identifierSchema,
  name: z.string().min(1),
  tip: z.string(),
  episodes: z.array(episodeSchema)
});

const contentVideoSchema = z.object({
  id: identifierSchema,
  typeName: z.string().min(1),
  title: z.string().min(1),
  remark: z.string(),
  actor: z.string(),
  director: z.string(),
  year: z.string(),
  area: z.string(),
  class: z.string(),
  lang: z.string(),
  hits: z.coerce.number().int().nonnegative(),
  score: z.coerce.number().nonnegative(),
  updated: z.string().min(1),
  poster: z.string(),
  backdrop: z.string(),
  duration: z.string(),
  summary: z.string(),
  episodes: z.array(episodeSchema),
  playSources: z.array(playSourceSchema),
  scoreCount: z.coerce.number().int().nonnegative(),
  likes: z.coerce.number().int().nonnegative(),
  dislikes: z.coerce.number().int().nonnegative()
});

const contentCardSchema = z.object({
  id: identifierSchema,
  title: z.string().min(1),
  remark: z.string(),
  year: z.string(),
  class: z.string(),
  score: z.coerce.number().nonnegative(),
  poster: z.string(),
  typeName: z.string().min(1).optional(),
  actor: z.string().optional(),
  summary: z.string().optional()
});

const contentDataSchema = z.object({
  siteName: z.string().min(1),
  categories: z.array(categorySchema),
  categoryContext: z.object({
    current: categorySchema.nullable(),
    parent: categorySchema.nullable(),
    children: z.array(categorySchema)
  }),
  facets: z.object({
    areas: z.array(z.string().min(1)),
    years: z.array(z.string().min(1)),
    langs: z.array(z.string().min(1)),
    classes: z.array(z.string().min(1))
  }),
  videos: z.array(contentCardSchema),
  total: z.coerce.number().int().nonnegative(),
  page: z.coerce.number().int().positive(),
  totalPages: z.coerce.number().int().nonnegative()
});

const contentDetailSchema = z.object({
  siteName: z.string().min(1),
  video: contentVideoSchema,
  related: z.array(contentCardSchema)
});

const filterTextSchema = z.string().trim().max(40);
const contentQuerySchema = z.object({
  typeId: identifierSchema.optional(),
  area: filterTextSchema.optional(),
  year: filterTextSchema.optional(),
  class: filterTextSchema.optional(),
  lang: filterTextSchema.optional(),
  letter: filterTextSchema.optional(),
  sort: z.enum(["latest", "hot", "score"]).optional(),
  page: z.number().int().min(1).max(100000).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  keyword: z.string().trim().max(100).optional(),
  scope: z.enum(["library", "yearly"]).optional(),
  includeCategoryTotals: z.boolean().optional(),
  includeFacets: z.boolean().optional()
});

const playbackRequestSchema = z.object({
  vodId: identifierSchema,
  sourceId: identifierSchema,
  episodeId: identifierSchema
});

const detailRequestSchema = z.object({ vodId: identifierSchema });
const accessScopeSchema = z.enum(["detail", "playback", "download", "confirm", "unavailable"]);
const accessRequestSchema = z
  .object({
    vodId: identifierSchema,
    scope: accessScopeSchema,
    sourceId: identifierSchema.optional(),
    episodeId: identifierSchema.optional()
  })
  .refine((request) => Boolean(request.sourceId) === Boolean(request.episodeId), {
    message: "sourceId 和 episodeId 必须同时提供"
  });

const contentIdentitySchema = z.object({
  id: identifierSchema,
  title: z.string().min(1)
});

const accessStateSchema = z.enum(["allowed", "trial", "password", "permission", "confirm", "copyright"]);
const accessDataSchema = z.object({
  siteName: z.string().min(1),
  video: contentIdentitySchema,
  scope: accessScopeSchema,
  state: accessStateSchema,
  authorized: z.boolean(),
  passwordRequired: z.boolean(),
  message: z.string().min(1),
  points: z.coerce.number().int().nonnegative(),
  tryseeMinutes: z.coerce.number().int().nonnegative()
});

const downloadItemSchema = z.object({
  id: identifierSchema,
  name: z.string().min(1),
  href: z
    .string()
    .min(1)
    .refine((value) => value.startsWith("/") && !value.startsWith("//") && !value.includes("\\"))
});
const downloadsDataSchema = z.object({
  siteName: z.string().min(1),
  video: contentIdentitySchema,
  access: z.object({
    state: accessStateSchema,
    authorized: z.boolean(),
    passwordRequired: z.boolean(),
    message: z.string().min(1),
    points: z.coerce.number().int().nonnegative()
  }),
  sources: z.array(
    z.object({
      id: identifierSchema,
      name: z.string().min(1),
      tip: z.string(),
      items: z.array(downloadItemSchema)
    })
  )
});

const plotDataSchema = z.object({
  siteName: z.string().min(1),
  video: contentIdentitySchema.extend({ summary: z.string() }),
  items: z.array(z.object({ name: z.string().min(1), detail: z.string().min(1) }))
});

const playbackUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => {
    try {
      const protocol = new URL(value, "https://react-api.local").protocol;
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  });

const playbackSchema = z
  .object({
    siteName: z.string().min(1),
    vodId: identifierSchema,
    sourceId: identifierSchema,
    episodeId: identifierSchema,
    title: z.string().min(1),
    episodeName: z.string().min(1),
    poster: z.string(),
    playSources: z.array(playSourceSchema),
    kind: z.enum(["video", "iframe"]),
    url: playbackUrlSchema,
    mimeType: z.string().min(1).optional(),
    expiresAt: z.string().min(1).optional()
  })
  .superRefine((playback, context) => {
    const sameSitePath = playback.url.startsWith("/") && !playback.url.startsWith("//") && !playback.url.includes("\\");
    if (playback.kind === "iframe" && !sameSitePath) {
      context.addIssue({ code: "custom", path: ["url"], message: "iframe 播放地址必须是当前站点路径" });
    }
    if (process.env.NODE_ENV === "production" && !sameSitePath) {
      context.addIssue({ code: "custom", path: ["url"], message: "生产播放地址必须是当前站点路径" });
    }
  });

export type ContentCategory = z.infer<typeof categorySchema>;
export type ContentEpisode = z.infer<typeof episodeSchema>;
export type ContentVideo = z.infer<typeof contentVideoSchema>;
export type ContentCard = z.infer<typeof contentCardSchema>;
export type ContentData = z.infer<typeof contentDataSchema>;
export type ContentDetailData = z.infer<typeof contentDetailSchema>;
export type PlaybackDescriptor = z.infer<typeof playbackSchema>;
export type ContentAccessScope = z.infer<typeof accessScopeSchema>;
export type ContentAccessData = z.infer<typeof accessDataSchema>;
export type DownloadsData = z.infer<typeof downloadsDataSchema>;
export type PlotData = z.infer<typeof plotDataSchema>;
export type ContentSort = "latest" | "hot" | "score";

export type ContentQuery = {
  typeId?: string | number;
  area?: string;
  year?: string;
  class?: string;
  lang?: string;
  letter?: string;
  sort?: ContentSort;
  page?: number;
  pageSize?: number;
  keyword?: string;
  scope?: "library" | "yearly";
  includeCategoryTotals?: boolean;
  includeFacets?: boolean;
};

export type ContentApi = {
  getContent(query?: ContentQuery): Promise<ContentData>;
  getDetail(vodId: string | number): Promise<ContentDetailData>;
  getAccess(vodId: string | number, scope: ContentAccessScope, sourceId?: string | number, episodeId?: string | number): Promise<ContentAccessData>;
  getDownloads(vodId: string | number): Promise<DownloadsData>;
  getPlot(vodId: string | number): Promise<PlotData>;
  getPlayback(vodId: string | number, sourceId: string | number, episodeId: string | number): Promise<PlaybackDescriptor>;
};

type ContentApiOptions = {
  endpoint?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

function setEmptyParameter(url: string, name: string) {
  const parsed = new URL(url, "http://react-api.local");
  parsed.searchParams.set(name, "");
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function createContentApi({ endpoint = "", fetchImpl, timeoutMs }: ContentApiOptions = {}): ContentApi {
  async function fetchEnvelope(action: string, params: Record<string, string | number | undefined> = {}, emptyParameters: string[] = []) {
    let url = withApiParams(requireApiEndpoint(endpoint), { action, ...params });
    emptyParameters.forEach((name) => {
      if (params[name] === "") url = setEmptyParameter(url, name);
    });
    return requestJson<unknown>(url, { method: "GET", fetchImpl, timeoutMs });
  }

  return Object.freeze({
    async getContent(query = {}) {
      const request = parseApiInput(query, contentQuerySchema);
      const payload = await fetchEnvelope(
        "content",
        {
          type_id: request.typeId,
          area: request.area,
          year: request.year,
          class: request.class,
          lang: request.lang,
          letter: request.letter,
          sort: request.sort,
          page: request.page,
          page_size: request.pageSize,
          keyword: request.keyword,
          scope: request.scope,
          compact: 1,
          include_category_totals: request.includeCategoryTotals ? 1 : undefined,
          include_facets: request.includeFacets ? 1 : undefined
        },
        request.keyword === "" ? ["keyword"] : []
      );
      return parseEnvelopeData(payload, contentDataSchema, "内容加载失败").data;
    },

    async getDetail(vodId) {
      const request = parseApiInput({ vodId }, detailRequestSchema);
      const payload = await fetchEnvelope("detail", { vod_id: request.vodId, compact: 1 });
      return parseEnvelopeData(payload, contentDetailSchema, "影片详情加载失败").data;
    },

    async getAccess(vodId, scope, sourceId, episodeId) {
      const request = parseApiInput({ vodId, scope, sourceId, episodeId }, accessRequestSchema);
      const payload = await fetchEnvelope("access", {
        vod_id: request.vodId,
        scope: request.scope,
        source_id: request.sourceId,
        episode_id: request.episodeId
      });
      return parseEnvelopeData(payload, accessDataSchema, "访问状态加载失败").data;
    },

    async getDownloads(vodId) {
      const request = parseApiInput({ vodId }, detailRequestSchema);
      const payload = await fetchEnvelope("downloads", { vod_id: request.vodId });
      return parseEnvelopeData(payload, downloadsDataSchema, "下载列表加载失败").data;
    },

    async getPlot(vodId) {
      const request = parseApiInput({ vodId }, detailRequestSchema);
      const payload = await fetchEnvelope("plot", { vod_id: request.vodId });
      return parseEnvelopeData(payload, plotDataSchema, "分集剧情加载失败").data;
    },

    async getPlayback(vodId, sourceId, episodeId) {
      const request = parseApiInput({ vodId, sourceId, episodeId }, playbackRequestSchema);
      const payload = await fetchEnvelope("playback", {
        vod_id: request.vodId,
        source_id: request.sourceId,
        episode_id: request.episodeId
      });
      return parseEnvelopeData(payload, playbackSchema, "播放信息加载失败").data;
    }
  });
}

const contentEndpoint = process.env.NEXT_PUBLIC_API_BASE_URL || (process.env.NODE_ENV === "production" ? "" : "/react-api.php");

export const contentApi = createContentApi({ endpoint: contentEndpoint });
