import { z } from "zod";

import { ApiError, requestJson } from "./http";

const envelopeSchema = z
  .object({
    code: z.union([z.string(), z.number()]),
    msg: z.string().optional(),
    data: z.unknown().optional()
  })
  .passthrough();

const filterOptionSchema = z.object({
  value: z.string(),
  total: z.number().int().nonnegative()
});

const filterDataSchema = z.object({
  filters: z.record(z.string(), z.array(filterOptionSchema))
});

type EndpointName = "login" | "logout" | "vodFilters" | "revokeDevice";
type MacCmsEnvelope = z.infer<typeof envelopeSchema>;

export type MacCmsEndpoints = Partial<Record<EndpointName, string>>;
export type VodFilterOption = z.infer<typeof filterOptionSchema>;
export type VodFilters = Record<string, VodFilterOption[]>;

export type MacCmsResult<T = unknown> = {
  message: string;
  data: T | null;
};

export type MacCmsApiOptions = {
  endpoints?: MacCmsEndpoints;
  csrfToken?: string | (() => string | undefined);
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

function requireEndpoint(endpoints: MacCmsEndpoints, name: EndpointName) {
  const endpoint = String(endpoints[name] || "").trim();
  if (!endpoint) {
    throw new ApiError(`缺少 ${name} API 地址`, { kind: "configuration" });
  }
  return endpoint;
}

function appendSearchParams(endpoint: string, params: Record<string, unknown>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([name, value]) => {
    const values = Array.isArray(value) ? value : [value];
    values.forEach((item) => {
      if (item !== undefined && item !== null && item !== "") {
        search.append(name, String(item));
      }
    });
  });

  const query = search.toString();
  if (!query) return endpoint;

  const hashIndex = endpoint.indexOf("#");
  const hash = hashIndex >= 0 ? endpoint.slice(hashIndex) : "";
  const base = hashIndex >= 0 ? endpoint.slice(0, hashIndex) : endpoint;
  return `${base}${base.includes("?") ? "&" : "?"}${query}${hash}`;
}

function parseEnvelope(payload: unknown): MacCmsEnvelope {
  const parsed = envelopeSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError("接口返回格式不正确", { kind: "invalid-response" });
  }
  return parsed.data;
}

function unwrapMacCmsResult(envelope: MacCmsEnvelope, fallbackMessage: string): MacCmsResult {
  if (String(envelope.code) !== "1") {
    throw new ApiError(String(envelope.msg || fallbackMessage), {
      kind: "business",
      code: envelope.code
    });
  }

  return {
    message: String(envelope.msg || fallbackMessage),
    data: envelope.data ?? null
  };
}

function requireCsrfToken(source: MacCmsApiOptions["csrfToken"]) {
  const value = typeof source === "function" ? source() : source;
  const token = value?.trim() ?? "";
  if (!token) throw new ApiError("缺少 CSRF Token", { kind: "configuration" });
  return token;
}

export function createMacCmsApi({ endpoints = {}, csrfToken, fetchImpl, timeoutMs }: MacCmsApiOptions = {}) {
  async function request(name: EndpointName, options: RequestInit, mutation = false): Promise<MacCmsResult> {
    const endpoint = requireEndpoint(endpoints, name);
    const headers = new Headers(options.headers);
    if (mutation) headers.set("X-CSRF-Token", requireCsrfToken(csrfToken));
    const payload = await requestJson<unknown>(endpoint, {
      ...options,
      headers,
      fetchImpl,
      timeoutMs
    });
    return unwrapMacCmsResult(parseEnvelope(payload), "操作成功");
  }

  return Object.freeze({
    login(formData: FormData) {
      return request("login", { method: "POST", body: formData }, true);
    },

    logout() {
      return request("logout", { method: "POST" }, true);
    },

    async getVodFilters(params: Record<string, unknown> = {}): Promise<VodFilters> {
      const endpoint = appendSearchParams(requireEndpoint(endpoints, "vodFilters"), params);
      const payload = await requestJson<unknown>(endpoint, {
        method: "GET",
        fetchImpl,
        timeoutMs
      });
      const result = unwrapMacCmsResult(parseEnvelope(payload), "筛选项加载成功");
      const parsed = filterDataSchema.safeParse(result.data);
      if (!parsed.success) {
        throw new ApiError("筛选接口返回格式不正确", { kind: "invalid-response" });
      }
      return parsed.data.filters;
    },

    revokeDevice(sessionId: string) {
      const normalizedSessionId = sessionId.trim();
      if (!normalizedSessionId) {
        return Promise.reject(new ApiError("缺少设备会话 ID", { kind: "validation" }));
      }

      const formData = new FormData();
      formData.append("session_id", normalizedSessionId);
      return request("revokeDevice", { method: "POST", body: formData }, true);
    }
  });
}
