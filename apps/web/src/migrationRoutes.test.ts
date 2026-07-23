import { describe, expect, it } from "vitest";

import { resolveMigrationRoute } from "./migrationRoutes";

describe("local migration route policy", () => {
  it.each([
    ["/index.php/vod/show.html?area=大陆&by=hits&page=2", "/videos?area=%E5%A4%A7%E9%99%86&page=2&sort=hot"],
    ["/index.php/label/categories.html", "/categories"],
    ["/index.php/vod/type/id/42.html?year=2026", "/category/42?year=2026"],
    ["/index.php/vod/search/wd/云端.html?type=42&page=3", "/search?wd=%E4%BA%91%E7%AB%AF&page=3&typeId=42"],
    ["/index.php/vod/detail/id/1.html", "/vod/1"],
    ["/index.php/vod/down/id/1.html", "/vod/1/download"],
    ["/index.php/vod/plot/id/1.html", "/vod/1/plot"],
    ["/index.php/vod/play/id/1/sid/2/nid/3.html", "/watch/1/2/3"],
    ["/index.php/label/history.html", "/history"],
    ["/index.php/user/favs.html", "/account/favorites"],
    ["/index.php/comment/index.html?mid=1&id=9", "/comments/1/9"]
  ])("redirects %s to one clean URL", (source, location) => {
    expect(resolveMigrationRoute(source)).toEqual({ status: 301, location });
  });

  it.each([
    "/index.php/actor/detail/id/1.html",
    "/index.php/art/index.html",
    "/index.php/label/comics.html",
    "/index.php/user/reg.html",
    "/index.php/user/reg",
    "/index.php/user/reg/step",
    "/index.php/user/findpass.html",
    "/index.php/user/findpass",
    "/index.php/map/baidu.html",
    "/index.php/rss/google.html",
    "/actors/1",
    "/articles",
    "/register",
    "/forgot-password",
    "/baidu.xml"
  ])("returns 410 for retired output %s", (source) => {
    expect(resolveMigrationRoute(source)).toEqual({ status: 410 });
  });

  it("leaves APIs, RSS candidates and the MacCMS player backend untouched", () => {
    expect(resolveMigrationRoute("/react-api.php?action=home")).toBeNull();
    expect(resolveMigrationRoute("/api.php/provide/vod")).toBeNull();
    expect(resolveMigrationRoute("/index.php/vod/player/id/1.html")).toBeNull();
    expect(resolveMigrationRoute("/index.php/map/rss.html")).toBeNull();
    expect(resolveMigrationRoute("/index.php/rss/rss.html")).toBeNull();
  });

  it("only applies redirects and retirement responses to GET or HEAD", () => {
    const legacyPage = "/index.php/vod/detail/id/1.html";
    expect(resolveMigrationRoute(legacyPage, "HEAD")).toEqual({ status: 301, location: "/vod/1" });
    expect(resolveMigrationRoute(legacyPage, "POST")).toBeNull();
    expect(resolveMigrationRoute("/articles", "PUT")).toBeNull();
  });
});
