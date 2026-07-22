const DEFAULT_TIMEOUT_MS = 10000;

export type ApiErrorKind = "unknown" | "configuration" | "http" | "invalid-response" | "timeout" | "aborted" | "network" | "business" | "validation";

type ApiErrorOptions = {
  kind?: ApiErrorKind;
  status?: number;
  code?: unknown;
  cause?: unknown;
};

export interface RequestJsonOptions extends RequestInit {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly code: unknown;

  constructor(message: string, { kind = "unknown", status = 0, code = null, cause }: ApiErrorOptions = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseMessage(payload: unknown, fallback: string) {
  if (!isRecord(payload)) return fallback;
  return String(payload.msg || payload.message || fallback);
}

function responseCode(payload: unknown) {
  if (!isRecord(payload)) return undefined;
  return typeof payload.code === "string" || typeof payload.code === "number" ? payload.code : undefined;
}

export async function requestJson<T>(url: RequestInfo | URL, options: RequestJsonOptions = {}): Promise<T> {
  const { fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS, headers: inputHeaders, signal: externalSignal, ...requestOptions } = options;

  if (typeof fetchImpl !== "function") {
    throw new ApiError("当前环境不支持网络请求", { kind: "configuration" });
  }

  const headers = new Headers(inputHeaders || {});
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (!headers.has("X-Requested-With")) headers.set("X-Requested-With", "XMLHttpRequest");

  const controller = new AbortController();
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const abortFromCaller = () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", abortFromCaller, { once: true });
    }
  }

  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  }

  try {
    const response = await fetchImpl(url, {
      ...requestOptions,
      credentials: "same-origin",
      headers,
      signal: controller.signal
    });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (cause) {
      if (!response.ok) {
        throw new ApiError(`请求失败（HTTP ${response.status}）`, {
          kind: "http",
          status: response.status,
          cause
        });
      }
      throw new ApiError("接口返回了无法解析的数据", {
        kind: "invalid-response",
        status: response.status,
        cause
      });
    }

    if (!response.ok) {
      const code = responseCode(payload);
      throw new ApiError(responseMessage(payload, `请求失败（HTTP ${response.status}）`), {
        kind: code === undefined ? "http" : "business",
        status: response.status,
        code
      });
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (timedOut) {
      throw new ApiError("请求超时，请稍后重试", { kind: "timeout", cause: error });
    }
    if (externalSignal?.aborted) {
      throw new ApiError("请求已取消", { kind: "aborted", cause: error });
    }
    throw new ApiError("网络请求失败，请稍后重试", { kind: "network", cause: error });
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }
}
