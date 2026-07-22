import { z } from "zod";

import { ApiError } from "./http";

const envelopeSchema = z.object({
  code: z.union([z.string(), z.number()]),
  msg: z.string().optional(),
  data: z.unknown()
});

export const identifierSchema = z.union([
  z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/),
  z.number().int().nonnegative().transform(String)
]);

export type ApiEnvelopeResult<T> = {
  message: string;
  data: T;
};

export function requireApiEndpoint(endpoint: string) {
  const normalizedEndpoint = endpoint.trim();
  if (!normalizedEndpoint) {
    throw new ApiError("缺少 React API 地址", { kind: "configuration" });
  }
  if (!normalizedEndpoint.startsWith("/") || normalizedEndpoint.startsWith("//") || normalizedEndpoint.includes("\\")) {
    throw new ApiError("React API 地址必须是当前站点的相对路径", { kind: "configuration" });
  }
  return normalizedEndpoint;
}

export function withApiParams(endpoint: string, params: Record<string, string | number | undefined>) {
  const url = new URL(endpoint, "http://react-api.local");
  Object.entries(params).forEach(([name, value]) => {
    if (value !== undefined && value !== "") url.searchParams.set(name, String(value));
  });

  if (/^https?:\/\//.test(endpoint)) return url.toString();
  return `${url.pathname}${url.search}${url.hash}`;
}

export function parseEnvelopeData<T>(payload: unknown, schema: z.ZodType<T>, fallbackMessage: string): ApiEnvelopeResult<T> {
  const envelope = envelopeSchema.safeParse(payload);
  if (!envelope.success) {
    throw new ApiError("接口返回格式不正确", { kind: "invalid-response" });
  }
  if (String(envelope.data.code) !== "1") {
    throw new ApiError(String(envelope.data.msg || fallbackMessage), {
      kind: "business",
      code: envelope.data.code
    });
  }

  const data = schema.safeParse(envelope.data.data);
  if (!data.success) {
    throw new ApiError("接口数据格式不正确", { kind: "invalid-response" });
  }

  return {
    message: String(envelope.data.msg || fallbackMessage),
    data: data.data
  };
}

export function parseApiInput<T>(input: unknown, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError("请求参数不正确", { kind: "validation" });
  }
  return parsed.data;
}
