import { z } from "zod";

import { ApiError, requestJson } from "./http";
import { parseApiInput, parseEnvelopeData, requireApiEndpoint } from "./schemas";

const positiveIntegerSchema = z.coerce.number().int().positive();
const nullablePositiveIntegerSchema = positiveIntegerSchema.nullable();
const sourceStatusSchema = z.enum(["available", "slow", "failed", "timeout", "unsupported", "missing"]);

const sourceQualitySourceSchema = z.object({
  sid: positiveIntegerSchema,
  from: z.string().min(1),
  nid: positiveIntegerSchema,
  episode_name: z.string().min(1),
  status: sourceStatusSchema,
  available: z.boolean(),
  http_code: nullablePositiveIntegerSchema,
  latency_ms: nullablePositiveIntegerSchema,
  speed_kbps: nullablePositiveIntegerSchema,
  sample_count: z.coerce.number().int().nonnegative(),
  tested_width: nullablePositiveIntegerSchema,
  tested_height: nullablePositiveIntegerSchema,
  max_width: nullablePositiveIntegerSchema,
  max_height: nullablePositiveIntegerSchema,
  resolution_basis: z.enum(["manifest", "unknown"]),
  variant_bandwidth_kbps: nullablePositiveIntegerSchema,
  variant_codecs: z.string().nullable(),
  fallback_used: z.boolean(),
  quality_rank: nullablePositiveIntegerSchema,
  recommended: z.boolean(),
  message: z.string()
});

const sourceQualityDataSchema = z.object({
  vod_id: positiveIntegerSchema,
  nid: positiveIntegerSchema,
  checked_at: positiveIntegerSchema,
  cached: z.boolean(),
  recommended_sid: nullablePositiveIntegerSchema,
  sources: z.array(sourceQualitySourceSchema)
});

const sourceQualityRequestSchema = z.object({
  vodId: positiveIntegerSchema,
  episodeNo: positiveIntegerSchema.max(10_000)
});

export type SourceQualitySource = z.infer<typeof sourceQualitySourceSchema>;
export type SourceQualityData = z.infer<typeof sourceQualityDataSchema>;

export type SourceQualityApi = {
  inspect(vodId: string | number, episodeNo: string | number): Promise<SourceQualityData>;
};

type SourceQualityApiOptions = {
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

export function createSourceQualityApi({ endpoint = "/index.php/pingfangdevice/sourceQuality", fetchImpl }: SourceQualityApiOptions = {}): SourceQualityApi {
  const target = requireApiEndpoint(endpoint);

  return Object.freeze({
    async inspect(vodId, episodeNo) {
      const request = parseApiInput({ vodId, episodeNo }, sourceQualityRequestSchema);
      const body = new FormData();
      body.set("vod_id", String(request.vodId));
      body.set("nid", String(request.episodeNo));
      const payload = await requestJson<unknown>(target, {
        method: "POST",
        body,
        fetchImpl,
        timeoutMs: 30_000
      });
      const data = parseEnvelopeData(payload, sourceQualityDataSchema, "线路检测失败").data;
      if (data.vod_id !== request.vodId || data.nid !== request.episodeNo) {
        throw new ApiError("线路检测响应与当前影片或集数不匹配", { kind: "invalid-response" });
      }
      return data;
    }
  });
}

export const sourceQualityApi = createSourceQualityApi();
