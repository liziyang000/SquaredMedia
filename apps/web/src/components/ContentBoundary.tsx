import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ApiError } from "../api/http";
import { contentApi } from "../api/content";
import type { ContentApi, ContentData, ContentDetailData, ContentQuery } from "../api/content";
import { PageStatus } from "./PagePrimitives";

export function ContentBoundary({
  children,
  api = contentApi,
  request = {}
}: {
  children: (content: ContentData) => ReactNode;
  api?: ContentApi;
  request?: ContentQuery;
}) {
  const query = useQuery({
    queryKey: ["content", request],
    queryFn: () => api.getContent(request),
    staleTime: 60_000
  });

  if (query.isPending) return <PageStatus title="正在加载内容" description="正在读取分类和影片数据…" />;
  if (query.isError) {
    return <PageStatus title="内容加载失败" description={query.error.message} error onRetry={() => void query.refetch()} />;
  }

  return children(query.data);
}

export function DetailBoundary({
  vodId,
  children,
  notFound,
  denied,
  api = contentApi
}: {
  vodId?: string;
  children: (detail: ContentDetailData) => ReactNode;
  notFound: ReactNode;
  denied?: ReactNode;
  api?: ContentApi;
}) {
  const normalizedVodId = vodId?.trim() ?? "";
  const query = useQuery({
    queryKey: ["content-detail", normalizedVodId],
    queryFn: () => api.getDetail(normalizedVodId),
    enabled: normalizedVodId !== "",
    staleTime: 60_000
  });

  if (!normalizedVodId) return notFound;
  if (query.isPending) return <PageStatus title="正在加载详情" description="正在读取影片与剧集数据…" />;
  if (query.isError) {
    if (query.error instanceof ApiError && (query.error.status === 404 || String(query.error.code) === "404")) return notFound;
    if (denied && query.error instanceof ApiError && query.error.status === 403) return denied;
    return <PageStatus title="详情加载失败" description={query.error.message} error onRetry={() => void query.refetch()} />;
  }

  return children(query.data);
}
