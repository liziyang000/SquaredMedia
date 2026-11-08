import type { ContentQuery, ContentSort } from "./content";

export function stringParam(params: URLSearchParams, name: string) {
  return params.get(name)?.trim() ?? "";
}

function sortParam(params: URLSearchParams): ContentSort {
  const value = stringParam(params, "sort");
  return value === "hot" || value === "score" ? value : "latest";
}

export function pageParam(params: URLSearchParams) {
  return Math.max(Number.parseInt(stringParam(params, "page"), 10) || 1, 1);
}

export function catalogQuery(typeId: string | undefined, params: URLSearchParams): ContentQuery {
  const requestedTypeId = typeId ?? stringParam(params, "typeId");
  return {
    ...(requestedTypeId && /^\d+$/.test(requestedTypeId) ? { typeId: requestedTypeId } : {}),
    ...(typeId === undefined ? { scope: "library" } : {}),
    area: stringParam(params, "area"),
    year: stringParam(params, "year"),
    class: stringParam(params, "class"),
    lang: stringParam(params, "lang"),
    letter: stringParam(params, "letter"),
    sort: sortParam(params),
    page: pageParam(params),
    pageSize: 24,
    includeFacets: true
  };
}
