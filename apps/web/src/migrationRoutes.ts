export type MigrationRouteResult = { status: 301; location: string } | { status: 410 };

const identifierPattern = "([A-Za-z0-9_~%:-]+)";
const retiredReactPrefix = /^\/(?:articles|actors|roles|topics|websites|plots|games|comics)(?:\/|$)/;
const retiredLegacyAction =
  /^\/index\.php\/(?:actor\/(?:detail|index|search|show|type)|art\/(?:confirm|detail|detail_pwd|index|search|show|type)|label\/comics|plot\/(?:udetail|uindex)|role\/(?:detail|index|show)|topic\/(?:detail|index)|user\/(?:findpass|reg)|website\/(?:detail|index|search|show|type)|map\/(?:baidu|google)|rss\/(?:baidu|google))(?:\/.*|\.html)?$/;
const searchParamNames = ["area", "year", "lang", "class", "letter", "page"] as const;

function decodeSegment(value: string) {
  try {
    return decodeURIComponent(value.replace(/\.html$/, ""));
  } catch {
    return value.replace(/\.html$/, "");
  }
}

function encodePathSegment(value: string) {
  return encodeURIComponent(decodeSegment(value));
}

function appendCatalogParams(path: string, source: URLSearchParams) {
  const target = new URLSearchParams();
  for (const name of searchParamNames) {
    const value = source.get(name)?.trim();
    if (value) target.set(name, value);
  }

  const typeId = source.get("typeId") || source.get("type");
  if (typeId) target.set("typeId", typeId);
  const sort = source.get("sort") || source.get("by");
  if (sort) {
    const normalizedSort = { time: "latest", hits: "hot", score: "score" }[sort] || sort;
    if (["latest", "hot", "score"].includes(normalizedSort)) target.set("sort", normalizedSort);
  }

  const query = target.toString();
  return query ? `${path}?${query}` : path;
}

export function resolveMigrationRoute(requestUrl: string, method = "GET"): MigrationRouteResult | null {
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod !== "GET" && normalizedMethod !== "HEAD") return null;

  const url = new URL(requestUrl, "http://react.local");
  const { pathname, searchParams } = url;

  if (
    retiredReactPrefix.test(pathname) ||
    retiredLegacyAction.test(pathname) ||
    ["/register", "/forgot-password", "/baidu.xml", "/google.xml", "/sitemap.xml"].includes(pathname)
  ) {
    return { status: 410 };
  }

  if (pathname === "/index.php/vod/show.html" || pathname === "/index.php/label/videos.html") {
    return { status: 301, location: appendCatalogParams("/videos", searchParams) };
  }
  if (pathname === "/index.php/label/categories.html") return { status: 301, location: "/categories" };
  if (pathname === "/index.php/label/hot.html") return { status: 301, location: appendCatalogParams("/rankings/yearly", searchParams) };
  if (pathname === "/index.php/label/history.html") return { status: 301, location: "/history" };

  const category = pathname.match(new RegExp(`^/index\\.php/vod/type/id/${identifierPattern}(?:\\.html)?$`));
  if (category) return { status: 301, location: appendCatalogParams(`/category/${encodePathSegment(category[1])}`, searchParams) };

  const search = pathname.match(/^\/index\.php\/vod\/search\/wd\/(.+?)(?:\.html)?$/);
  if (search) {
    const target = new URLSearchParams();
    target.set("wd", decodeSegment(search[1]));
    const catalogQuery = new URL(appendCatalogParams("/search", searchParams), "http://react.local").searchParams;
    catalogQuery.forEach((value, name) => target.set(name, value));
    return { status: 301, location: `/search?${target.toString()}` };
  }

  const detail = pathname.match(new RegExp(`^/index\\.php/vod/detail/id/${identifierPattern}(?:\\.html)?$`));
  if (detail) return { status: 301, location: `/vod/${encodePathSegment(detail[1])}` };
  const download = pathname.match(new RegExp(`^/index\\.php/vod/down/id/${identifierPattern}(?:\\.html)?$`));
  if (download) return { status: 301, location: `/vod/${encodePathSegment(download[1])}/download` };
  const plot = pathname.match(new RegExp(`^/index\\.php/vod/plot/id/${identifierPattern}(?:\\.html)?$`));
  if (plot) return { status: 301, location: `/vod/${encodePathSegment(plot[1])}/plot` };
  const play = pathname.match(new RegExp(`^/index\\.php/vod/play/id/${identifierPattern}/sid/${identifierPattern}/nid/${identifierPattern}(?:\\.html)?$`));
  if (play) {
    return {
      status: 301,
      location: `/watch/${encodePathSegment(play[1])}/${encodePathSegment(play[2])}/${encodePathSegment(play[3])}`
    };
  }

  const staticRedirects = new Map<string, string>([
    ["/index.php/user/index.html", "/account"],
    ["/index.php/user/login.html", "/login"],
    ["/index.php/user/favs.html", "/account/favorites"],
    ["/index.php/user/plays.html", "/account/history"],
    ["/index.php/pingfangdevice/index.html", "/account/devices"],
    ["/index.php/gbook/index.html", "/feedback"],
    ["/index.php/book/index.html", "/feedback"],
    ["/index.php/book/report.html", "/report"]
  ]);
  const staticLocation = staticRedirects.get(pathname);
  if (staticLocation) return { status: 301, location: staticLocation };

  const commentId = searchParams.get("id") || searchParams.get("content_id") || searchParams.get("gid");
  if (pathname === "/index.php/comment/index.html" && commentId) {
    const mid = searchParams.get("mid") || "1";
    return { status: 301, location: `/comments/${encodePathSegment(mid)}/${encodePathSegment(commentId)}` };
  }

  return null;
}
