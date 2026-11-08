// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "../proxy";
import { homeV2FixtureResponse } from "../test/homeFixture";
import { establishSession, loadPageBootstrap, PAGE_PATH_HEADER, SESSION_BOOTSTRAP_HEADER } from "./sessionBootstrap";

const session = { authenticated: false, user: null, csrfToken: "csrf-session-a" };
const response = (data: unknown, cookies: string[] = []) =>
  new Response(JSON.stringify({ code: 1, data }), {
    headers: [["Content-Type", "application/json"], ...cookies.map((cookie): [string, string] => ["Set-Cookie", cookie])]
  });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("server session bootstrap", () => {
  it("renders the requested catalog filters with the established PHP session", async () => {
    vi.stubEnv("MACCMS_INTERNAL_ORIGIN", "http://127.0.0.1:8822");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/react-api.php");
    const content = {
      siteName: "平方影视",
      categories: [],
      categoryContext: { current: null, parent: null, children: [] },
      facets: { areas: [], years: [], langs: [], classes: [] },
      videos: [],
      total: 0,
      page: 2,
      totalPages: 1
    };
    const upstream = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("cookie")).toBe("PHPSESSID=viewer");
      return response(new URL(String(input)).searchParams.get("action") === "content" ? content : { siteName: "平方影视", categories: [] });
    });
    vi.stubGlobal("fetch", upstream);
    const bootstrap = await loadPageBootstrap(
      new Headers({
        cookie: "PHPSESSID=viewer",
        [SESSION_BOOTSTRAP_HEADER]: Buffer.from(JSON.stringify(session)).toString("base64url"),
        [PAGE_PATH_HEADER]: "/videos?typeId=42&area=%E4%B8%AD%E5%9B%BD&sort=hot&page=2"
      })
    );
    expect(bootstrap?.content).toMatchObject({
      request: { typeId: "42", area: "中国", sort: "hot", page: 2, pageSize: 24, scope: "library", includeFacets: true },
      data: content
    });
    expect(bootstrap?.navigation?.siteName).toBe("平方影视");
    const url = new URL(String(upstream.mock.calls.find(([input]) => new URL(String(input)).searchParams.get("action") === "content")![0]));
    expect(url.searchParams.get("type_id")).toBe("42");
    expect(url.searchParams.get("include_facets")).toBe("1");
  });

  it("seeds detail through the existing permission-scoped API and strips raw media fields", async () => {
    vi.stubEnv("MACCMS_INTERNAL_ORIGIN", "http://127.0.0.1:8822");
    const detail = {
      siteName: "平方影视",
      related: [],
      video: {
        ...homeV2FixtureResponse.hero[0],
        id: "1",
        typeName: "电影",
        remark: "高清",
        actor: "",
        director: "",
        area: "",
        lang: "",
        hits: 0,
        score: 8,
        updated: "2026-11-04",
        poster: "/poster.jpg",
        episodes: [],
        playSources: [],
        scoreCount: 0,
        likes: 0,
        dislikes: 0,
        vod_play_url: "private-media-url"
      }
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = new URL(String(input));
        if (url.searchParams.get("action") === "detail") {
          expect(url.searchParams.get("vod_id")).toBe("1");
          return response(detail);
        }
        return response({ siteName: "平方影视", categories: [] });
      })
    );
    const bootstrap = await loadPageBootstrap(
      new Headers({
        [SESSION_BOOTSTRAP_HEADER]: Buffer.from(JSON.stringify(session)).toString("base64url"),
        [PAGE_PATH_HEADER]: "/vod/1"
      })
    );
    expect(bootstrap?.detail?.vodId).toBe("1");
    expect(bootstrap?.detail?.data.video.title).toBe(detail.video.title);
    expect(bootstrap?.detail?.data.video).not.toHaveProperty("vod_play_url");
  });

  it("keeps navigation and session when detail is denied", async () => {
    vi.stubEnv("MACCMS_INTERNAL_ORIGIN", "http://127.0.0.1:8822");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) =>
        new URL(String(input)).searchParams.get("action") === "detail"
          ? new Response("denied", { status: 403 })
          : response({ siteName: "平方影视", categories: [] })
      )
    );
    const bootstrap = await loadPageBootstrap(
      new Headers({
        [SESSION_BOOTSTRAP_HEADER]: Buffer.from(JSON.stringify(session)).toString("base64url"),
        [PAGE_PATH_HEADER]: "/vod/1"
      })
    );
    expect(bootstrap?.detail).toBeUndefined();
    expect(bootstrap?.navigation?.siteName).toBe("平方影视");
    expect(bootstrap?.session).toEqual(session);
  });

  it("establishes one session, preserves cookie attributes, and reuses it for permission-scoped home data", async () => {
    vi.stubEnv("MACCMS_INTERNAL_ORIGIN", "http://127.0.0.1:8822");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/react-api.php");
    vi.stubEnv("NEXT_PUBLIC_HOME_API_URL", "/react-api.php");
    const cookies = ["PHPSESSID=new-session; Path=/; HttpOnly; SameSite=Lax", "old_user=; Max-Age=0; Path=/"];
    const upstream = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("x-cinema-client-ip")).toBe("192.0.2.10");
      expect(init?.cache).toBe("no-store");
      expect(init?.redirect).toBe("manual");
      return upstream.mock.calls.length === 1 ? response(session, cookies) : response(homeV2FixtureResponse);
    });
    vi.stubGlobal("fetch", upstream);
    const headers = new Headers({
      cookie: "PHPSESSID=old; other=keep; old_user=expired",
      "user-agent": "browser-agent",
      "x-real-ip": "192.0.2.10",
      "x-cinema-client-ip": "forged"
    });
    const established = await establishSession(headers);
    expect(established.setCookies).toEqual(cookies);
    expect(established.cookie).toBe("PHPSESSID=new-session; other=keep");
    headers.set("cookie", established.cookie);
    headers.set(SESSION_BOOTSTRAP_HEADER, Buffer.from(JSON.stringify(established.session)).toString("base64url"));
    headers.set(PAGE_PATH_HEADER, "/?from=account");
    const bootstrap = await loadPageBootstrap(headers);
    expect(bootstrap?.home?.siteName).toBe(homeV2FixtureResponse.siteName);
    expect(bootstrap?.session.csrfToken).toBe(session.csrfToken);
    expect(upstream).toHaveBeenCalledTimes(2);
    const [url, options] = upstream.mock.calls[1];
    expect(String(url)).toContain("127.0.0.1:8822/server/react-api.php?action=home_v2");
    expect(new Headers(options?.headers).get("cookie")).toBe(established.cookie);
    expect(new Headers(options?.headers).get("user-agent")).toBe("browser-agent");
    expect(new Headers(options?.headers).get("x-real-ip")).toBe("192.0.2.10");
  });

  it("keeps independent requests and CSRF tokens isolated", async () => {
    vi.stubEnv("MACCMS_INTERNAL_ORIGIN", "http://127.0.0.1:8822");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input, init) => response({ ...homeV2FixtureResponse, siteName: new Headers(init.headers).get("cookie") }))
    );
    const read = (id: string) =>
      loadPageBootstrap(
        new Headers({
          cookie: `PHPSESSID=${id}`,
          [SESSION_BOOTSTRAP_HEADER]: Buffer.from(JSON.stringify({ ...session, csrfToken: `csrf-${id}` })).toString("base64url"),
          [PAGE_PATH_HEADER]: "/"
        })
      );
    const [a, b] = await Promise.all([read("a"), read("b")]);
    expect(a?.home?.siteName).toBe("PHPSESSID=a");
    expect(b?.home?.siteName).toBe("PHPSESSID=b");
    expect(a?.session.csrfToken).not.toBe(b?.session.csrfToken);
  });

  it("retains the established session when content fails so client recovery can continue", async () => {
    vi.stubEnv("MACCMS_INTERNAL_ORIGIN", "http://127.0.0.1:8822");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 503 }))
    );
    const result = await loadPageBootstrap(
      new Headers({
        [SESSION_BOOTSTRAP_HEADER]: Buffer.from(JSON.stringify(session)).toString("base64url"),
        [PAGE_PATH_HEADER]: "/"
      })
    );
    expect(result?.session).toEqual(session);
    expect(result?.home).toBeUndefined();
  });

  it("replaces client-supplied bootstrap headers and forwards the new session cookie to rendering", async () => {
    vi.stubEnv("MACCMS_INTERNAL_ORIGIN", "http://127.0.0.1:8822");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response(session, ["PHPSESSID=owned; Path=/; HttpOnly"]))
    );
    const result = await proxy(
      new NextRequest("http://localhost/videos?page=2", { headers: { [SESSION_BOOTSTRAP_HEADER]: "forged-admin", [PAGE_PATH_HEADER]: "/forged" } })
    );
    const encoded = result.headers.get(`x-middleware-request-${SESSION_BOOTSTRAP_HEADER}`)!;
    expect(JSON.parse(Buffer.from(encoded, "base64url").toString())).toMatchObject(session);
    expect(result.headers.get("x-middleware-request-cookie")).toBe("PHPSESSID=owned");
    expect(result.headers.get(`x-middleware-request-${PAGE_PATH_HEADER}`)).toBe("/videos?page=2");
    expect(result.headers.getSetCookie()).toEqual(["PHPSESSID=owned; Path=/; HttpOnly"]);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
  });

  it("does not establish sessions for assets, API calls, RSC navigation, or POST requests", async () => {
    vi.stubEnv("MACCMS_INTERNAL_ORIGIN", "http://127.0.0.1:8822");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const [path, init] of [
      ["/static/app.js", {}],
      ["/react-api.php?action=session", {}],
      ["/videos", { headers: { rsc: "1" } }],
      ["/login", { method: "POST" }]
    ] as const) {
      const result = await proxy(new NextRequest(`http://localhost${path}`, init));
      expect(result.headers.get(`x-middleware-request-${SESSION_BOOTSTRAP_HEADER}`)).toBeNull();
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
