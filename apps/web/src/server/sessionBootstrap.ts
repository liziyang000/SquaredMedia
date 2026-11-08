import { createAccountApi } from "../api/account";
import type { AccountSession } from "../api/account";
import { createHomeApi } from "../api/home";
import type { HomeData, HomeNavigation } from "../api/home";
import { createContentApi } from "../api/content";
import type { ContentData, ContentDetailData, ContentQuery } from "../api/content";
import { catalogQuery } from "../api/catalogQuery";

export const SESSION_BOOTSTRAP_HEADER = "x-pf-session-bootstrap";
export const PAGE_PATH_HEADER = "x-pf-page-path";

export type PageBootstrap = {
  session: AccountSession;
  home?: HomeData;
  navigation?: HomeNavigation;
  content?: { request: ContentQuery; data: ContentData };
  detail?: { vodId: string; data: ContentDetailData };
  updatedAt: number;
};

export function bootstrapOrigin() {
  return process.env.MACCMS_INTERNAL_ORIGIN || process.env.MACCMS_ORIGIN || (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8084" : "");
}

function serverFetch(requestHeaders: Headers, onCookies?: (cookies: string[]) => void): typeof fetch {
  const origin = new URL(bootstrapOrigin());
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password) throw new Error("MacCMS 内部地址无效");

  return async (input, init) => {
    const url = new URL(String(input), origin);
    if (url.pathname === "/react-api.php") url.pathname = "/server/react-api.php";
    const headers = new Headers(init?.headers);
    for (const name of ["cookie", "user-agent", "host", "x-real-ip", "x-forwarded-for", "x-forwarded-proto"]) {
      const value = requestHeaders.get(name);
      if (value) headers.set(name, value);
    }
    const clientIp = requestHeaders.get("x-real-ip");
    if (clientIp) headers.set("x-cinema-client-ip", clientIp);
    const response = await fetch(url, { ...init, headers, cache: "no-store", redirect: "manual" });
    onCookies?.(response.headers.getSetCookie());
    return response;
  };
}

export async function establishSession(requestHeaders: Headers) {
  const setCookies: string[] = [];
  const api = createAccountApi({
    endpoint: process.env.NEXT_PUBLIC_API_BASE_URL || "/react-api.php",
    fetchImpl: serverFetch(requestHeaders, (cookies) => setCookies.push(...cookies))
  });
  const session = await api.getSession();
  const cookies = new Map(
    (requestHeaders.get("cookie") || "")
      .split(";")
      .filter((part) => part.includes("="))
      .map((part): [string, string] => {
        const pair = part.trim();
        const separator = pair.indexOf("=");
        return [pair.slice(0, separator), pair.slice(separator + 1)];
      })
  );
  for (const cookie of setCookies) {
    const pair = cookie.split(";", 1)[0];
    const separator = pair.indexOf("=");
    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    if (value) cookies.set(name, value);
    else cookies.delete(name);
  }
  return { session, setCookies, cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; ") };
}

export async function loadPageBootstrap(requestHeaders: Headers): Promise<PageBootstrap | undefined> {
  const encoded = requestHeaders.get(SESSION_BOOTSTRAP_HEADER);
  if (!encoded) return undefined;
  const session = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as AccountSession;
  const result: PageBootstrap = { session, updatedAt: Date.now() };
  const api = createHomeApi({
    endpoint: process.env.NEXT_PUBLIC_HOME_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "/react-api.php",
    fetchImpl: serverFetch(requestHeaders)
  });
  const url = new URL(requestHeaders.get(PAGE_PATH_HEADER) || "/", "http://next.local");
  const loads: Promise<void>[] = [];
  if (url.pathname === "/") {
    loads.push(
      api.getHome().then((data) => {
        result.home = data;
      })
    );
  } else {
    loads.push(
      api.getNavigation().then((data) => {
        result.navigation = data;
      })
    );
    const contentApi = createContentApi({
      endpoint: process.env.NEXT_PUBLIC_API_BASE_URL || "/react-api.php",
      fetchImpl: serverFetch(requestHeaders)
    });
    if (url.pathname === "/videos") {
      const request = catalogQuery(undefined, url.searchParams);
      loads.push(
        contentApi.getContent(request).then((data) => {
          result.content = { request, data };
        })
      );
    }
    const detail = /^\/vod\/([A-Za-z0-9_.:-]+)\/?$/.exec(url.pathname);
    if (detail) {
      const vodId = detail[1];
      loads.push(
        contentApi.getDetail(vodId).then((data) => {
          result.detail = { vodId, data };
        })
      );
    }
  }
  // Preserve successful data and the session; failed queries recover in the browser.
  await Promise.allSettled(loads);
  return result;
}
