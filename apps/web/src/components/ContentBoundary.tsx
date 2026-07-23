import { useGSAP } from "@gsap/react";
import { useQuery } from "@tanstack/react-query";
import { gsap } from "gsap";
import { useRef, useState } from "react";
import type { ReactNode } from "react";

import { ApiError } from "../api/http";
import { contentApi } from "../api/content";
import type { ContentApi, ContentData, ContentDetailData, ContentQuery } from "../api/content";
import { PageStatus } from "./PagePrimitives";

if (typeof window !== "undefined") gsap.registerPlugin(useGSAP);

function ContentReveal({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (typeof window.matchMedia !== "function") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !scope.current) return;

      const title = scope.current.querySelectorAll<HTMLElement>(".page-title > *");
      const filterPanel = scope.current.querySelectorAll<HTMLElement>(".category-filter");
      const cards = scope.current.querySelectorAll<HTMLElement>(".vod-grid > .vod-card, .vod-list > .list-item, .category-index > .category-tile");
      const pagination = scope.current.querySelectorAll<HTMLElement>(".paging");
      const animated = [...title, ...filterPanel, ...cards, ...pagination];

      if (animated.length === 0) return;

      gsap.set(animated, { willChange: "transform,opacity" });
      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

      if (title.length > 0) {
        timeline.from(title, {
          autoAlpha: 0,
          y: 12,
          duration: 0.28,
          stagger: 0.04,
          clearProps: "transform,opacity,visibility,willChange"
        });
      }
      if (filterPanel.length > 0) {
        timeline.from(
          filterPanel,
          {
            autoAlpha: 0,
            y: 14,
            duration: 0.3,
            clearProps: "transform,opacity,visibility,willChange"
          },
          title.length > 0 ? "<0.08" : 0
        );
      }
      if (cards.length > 0) {
        timeline.from(
          cards,
          {
            autoAlpha: 0,
            y: 18,
            duration: 0.3,
            stagger: { amount: Math.min(0.2, Math.max(0, (cards.length - 1) * 0.035)), from: "start" },
            clearProps: "transform,opacity,visibility,willChange"
          },
          filterPanel.length > 0 || title.length > 0 ? "<0.12" : 0
        );
      }
      if (pagination.length > 0) {
        timeline.from(
          pagination,
          {
            autoAlpha: 0,
            y: 8,
            duration: 0.22,
            clearProps: "transform,opacity,visibility,willChange"
          },
          "<0.08"
        );
      }
    },
    { scope }
  );

  return (
    <div className="content-boundary-result" ref={scope}>
      {children}
    </div>
  );
}

function AnimatedContent({
  data,
  children,
  readyTitle,
  readyDescription
}: {
  data?: ContentData;
  children: (content: ContentData) => ReactNode;
  readyTitle: string;
  readyDescription: string;
}) {
  const scope = useRef<HTMLDivElement>(null);
  const [showContent, setShowContent] = useState(() => data !== undefined);
  const ready = data !== undefined;

  useGSAP(
    (_context, contextSafe) => {
      if (!ready || showContent) return;
      if (!contextSafe) return;

      const finish = contextSafe(() => setShowContent(true));
      if (typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        finish();
        return;
      }

      gsap
        .timeline({
          defaults: { ease: "power2.out" },
          onComplete: finish
        })
        .to(".loading-status-bar", { scaleX: 1, xPercent: 0, duration: 0.18 })
        .to(".loading-status-orbit i", { scale: 1.3, autoAlpha: 0, duration: 0.16, stagger: 0.035 }, "<")
        .to(".loading-status-mark", { scale: 1.08, duration: 0.16 }, "<")
        .to(".loading-status-panel > :not(.loading-status-motion)", { y: -5, autoAlpha: 0, duration: 0.15, stagger: 0.018 }, ">-0.02")
        .to(".loading-status-panel", { y: -10, scale: 0.97, autoAlpha: 0, duration: 0.22, ease: "power2.in" }, "<0.04")
        .to(".loading-status-shell", { autoAlpha: 0, duration: 0.16 }, "<0.08");
    },
    { dependencies: [ready], revertOnUpdate: true, scope }
  );

  return (
    <div className="content-boundary-transition" ref={scope}>
      {showContent && data ? (
        <ContentReveal>{children(data)}</ContentReveal>
      ) : (
        <PageStatus title={ready ? readyTitle : "正在加载内容"} description={ready ? readyDescription : "正在读取分类和影片数据…"} loading ready={ready} />
      )}
    </div>
  );
}

export function ContentBoundary({
  children,
  api = contentApi,
  request = {},
  readyTitle = "内容已准备好",
  readyDescription = "正在整理页面，即将为你呈现…"
}: {
  children: (content: ContentData) => ReactNode;
  api?: ContentApi;
  request?: ContentQuery;
  readyTitle?: string;
  readyDescription?: string;
}) {
  const query = useQuery({
    queryKey: ["content", request],
    queryFn: () => api.getContent(request),
    staleTime: 60_000
  });

  if (query.isError) {
    return <PageStatus title="内容加载失败" description={query.error.message} error onRetry={() => void query.refetch()} />;
  }

  return (
    <AnimatedContent key={JSON.stringify(request)} data={query.data} readyTitle={readyTitle} readyDescription={readyDescription}>
      {children}
    </AnimatedContent>
  );
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
