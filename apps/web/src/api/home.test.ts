import { describe, expect, it } from "vitest";

import { homeV2FixtureResponse, navigationFixtureResponse } from "../test/homeFixture";
import { createHomeApi } from "./home";

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    async json() {
      return body;
    }
  } as Response;
}

describe("createHomeApi", () => {
  it("loads the structured home feed and navigation through separate lightweight actions", async () => {
    const requestUrls: string[] = [];
    const api = createHomeApi({
      endpoint: "/index.php/pingfangapi/index",
      fetchImpl: async (input) => {
        const requestUrl = String(input);
        requestUrls.push(requestUrl);
        const action = new URL(requestUrl, "http://react.test").searchParams.get("action");
        const data = action === "navigation" ? navigationFixtureResponse : homeV2FixtureResponse;
        return jsonResponse({ code: 1, msg: "加载成功", data });
      }
    });

    const data = await api.getHome();
    const navigation = await api.getNavigation();

    expect(requestUrls).toEqual(["/index.php/pingfangapi/index?action=home_v2&compact=1", "/index.php/pingfangapi/index?action=navigation"]);
    expect(data).toMatchObject({
      siteName: "平方影视",
      hero: [{ id: "1", episodes: [{ id: "1", sourceId: "1" }] }],
      ranking: [{ id: "1", score: 8.8 }],
      latestByCategory: [{ categoryId: "42", videos: [{ id: "1" }] }]
    });
    expect(data.hero[0]).not.toHaveProperty("actor");
    expect(data.hero[0]?.episodes[0]).not.toHaveProperty("src");
    expect(data.hero[0]?.episodes[0]).not.toHaveProperty("name");
    expect(data.ranking[0]).not.toHaveProperty("episodes");
    expect(navigation).toEqual(navigationFixtureResponse);
  });

  it("continues to accept a raw local structured response", async () => {
    const api = createHomeApi({
      endpoint: "/preview/data.json",
      fetchImpl: async () => jsonResponse(homeV2FixtureResponse)
    });

    const data = await api.getHome();

    expect(data.siteName).toBe("平方影视");
    expect(data.categories[0]).toEqual({ id: "42", name: "电影" });
  });

  it("rejects missing endpoints, business errors and invalid home responses", async () => {
    await expect(createHomeApi().getHome()).rejects.toMatchObject({ kind: "configuration" });

    const deniedApi = createHomeApi({
      endpoint: "/react-api.php?action=home_v2",
      fetchImpl: async () => jsonResponse({ code: 503, msg: "首页服务暂不可用", data: null })
    });
    await expect(deniedApi.getHome()).rejects.toMatchObject({ kind: "business", code: 503, message: "首页服务暂不可用" });

    const invalidApi = createHomeApi({
      endpoint: "/api/home",
      fetchImpl: async () => jsonResponse({ siteName: "平方影视", videos: "invalid" })
    });
    await expect(invalidApi.getHome()).rejects.toMatchObject({ kind: "invalid-response" });
  });
});
