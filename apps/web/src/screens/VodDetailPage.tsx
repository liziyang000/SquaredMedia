"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { contentApi, sourceQualityApi } from "../api/deferred";
import type { ContentApi, ContentDetailData } from "../api/content";
import type { SourceQualityApi } from "../api/sourceQuality";
import { Link, useParams } from "../app/routing";
import { DetailBoundary } from "../components/ContentBoundary";
import { Artwork, EmptyState, PageStatus, VodCard } from "../components/PagePrimitives";
import type { SourceQualityView } from "../components/SourceQualityPanel";
import type { SourceQualityPreference } from "../sourceQualityPreference";
import { EpisodeSections, MissingContentPage, groupEpisodes, useDocumentTitle, watchHref } from "./ContentSections";
import { VodFavoriteButton, VodInteractions } from "./VodActions";

const SourceQualityPanel = lazy(() => import("../components/SourceQualityPanel").then((module) => ({ default: module.SourceQualityPanel })));
const AccessGatePage = lazy(() => import("./ContentPages").then((module) => ({ default: module.AccessGatePage })));
type ContentPageProps = { api?: ContentApi };

function VodDetailContent({ content, qualityApi }: { content: ContentDetailData; qualityApi: SourceQualityApi }) {
  const video = content.video;
  const groups = useMemo(() => groupEpisodes(video), [video]);
  const qualitySection = useRef<HTMLElement>(null);
  const [qualityVisible, setQualityVisible] = useState(false);
  useEffect(() => {
    setQualityVisible(false);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setQualityVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" }
    );
    observer.observe(qualitySection.current!);
    return () => observer.disconnect();
  }, [video.id]);
  const [qualityView, setQualityView] = useState<SourceQualityView | null>(null);
  const [recommendation, setRecommendation] = useState<{ sourceId: string; episodeNo: number } | null>(null);
  const onRecommendation = useCallback((preference: SourceQualityPreference | null, episodeNo: number) => {
    setRecommendation(preference ? { sourceId: preference.recommendedSourceId, episodeNo } : null);
  }, []);
  const recommendedEpisode = recommendation
    ? groups.find((group) => group.sourceId === recommendation.sourceId)?.episodes.find((episode) => episode.no === recommendation.episodeNo)
    : undefined;
  const firstEpisode = recommendedEpisode ?? groups[0]?.episodes[0];
  const related = content.related;

  const previewEpisode = groups.find((group) => group.episodes.length > 0)?.episodes[0];
  const qualityPlaceholder = (
    <div className="source-quality-panel" aria-busy="true">
      <div className="source-quality-copy">
        <strong>播放线路测速</strong>
        <span>{previewEpisode ? "进入此区域后会自动检测所选集数，并推荐当前可用且测速更优的播放线路。" : "当前视频没有可检测的集数。"}</span>
      </div>
      {previewEpisode && (
        <>
          <div className="source-quality-controls">
            <label htmlFor="reactSourceQualityEpisode">测速集数</label>
            <select id="reactSourceQualityEpisode" disabled>
              <option>{previewEpisode.name}</option>
            </select>
            <button className="ghost-btn" type="button" disabled>
              重新检测
            </button>
          </div>
          <p className="source-quality-summary" role="status" aria-live="polite">
            即将自动检测；结果代表站点服务器到播放源的当前连接状况。
          </p>
        </>
      )}
    </div>
  );

  useDocumentTitle(video.title, content.siteName);

  return (
    <main id="mainContent" tabIndex={-1}>
      <section className="detail-hero">
        <Artwork
          containerClassName="detail-backdrop"
          src={video.backdrop || video.poster || undefined}
          alt=""
          aria-hidden="true"
          loading="eager"
          fetchPriority="high"
        />
        <div className="wrap detail-grid">
          <Artwork
            containerClassName="detail-poster"
            src={video.poster || undefined}
            alt={video.title}
            width={380}
            height={570}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            sizes="(max-width: 760px) 44vw, 250px"
          >
            <span>{video.remark || "高清"}</span>
          </Artwork>
          <div className="detail-main detail-panel">
            <span className="eyebrow">{video.typeName}</span>
            <div className="detail-title-row">
              <h1>{video.title}</h1>
            </div>
            <p className="meta">
              {video.year || "年份未知"} / {video.area || "地区未知"} / {video.class || "类型待更新"}
            </p>
            <p className="summary">{video.summary || "内容简介待更新。"}</p>
            <div className="detail-actions" aria-label="影片操作">
              {firstEpisode && (
                <Link className="primary-btn" to={watchHref(video.id, firstEpisode)}>
                  立即播放
                </Link>
              )}
              <VodFavoriteButton vodId={video.id} />
              <Link className="ghost-btn" to={`/vod/${video.id}/plot`}>
                分集剧情
              </Link>
              <Link className="ghost-btn" to={`/report?vodId=${encodeURIComponent(video.id)}`}>
                片源报错
              </Link>
            </div>
            <VodInteractions vodId={video.id} score={video.score} scoreCount={video.scoreCount} likes={video.likes} dislikes={video.dislikes} />
            <dl className="detail-data">
              <div>
                <dt>导演</dt>
                <dd>{video.director || "待更新"}</dd>
              </div>
              <div>
                <dt>主演</dt>
                <dd>{video.actor || "待更新"}</dd>
              </div>
              <div>
                <dt>热度</dt>
                <dd>{video.hits} 次</dd>
              </div>
              <div>
                <dt>更新</dt>
                <dd>{video.updated}</dd>
              </div>
              <div>
                <dt>语言</dt>
                <dd>{video.lang || "待更新"}</dd>
              </div>
              <div>
                <dt>片长</dt>
                <dd>{video.duration || "待更新"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="wrap content-section" aria-label="播放选集" ref={qualitySection}>
        {qualityVisible ? (
          <Suspense fallback={qualityPlaceholder}>
            <SourceQualityPanel vodId={video.id} groups={groups} api={qualityApi} onViewChange={setQualityView} onRecommendation={onRecommendation} />
          </Suspense>
        ) : (
          qualityPlaceholder
        )}
        <EpisodeSections vodId={video.id} groups={groups} qualityView={qualityView} />
      </section>

      <section className="wrap content-section" aria-labelledby="related-videos-title">
        <div className="section-head">
          <h2 id="related-videos-title">猜你喜欢</h2>
        </div>
        {related.length > 0 ? (
          <div className="vod-grid compact-grid">
            {related.map((item) => (
              <VodCard key={item.id} video={item} />
            ))}
          </div>
        ) : (
          <EmptyState title="暂无同类推荐" description="可以继续浏览影片库发现更多内容。" />
        )}
      </section>
    </main>
  );
}

export function VodDetailPage({ api = contentApi, qualityApi = sourceQualityApi }: ContentPageProps & { qualityApi?: SourceQualityApi }) {
  const { vodId } = useParams();

  return (
    <DetailBoundary
      api={api}
      vodId={vodId}
      notFound={<MissingContentPage siteName="平方影视" kind="影片" value={vodId} />}
      denied={
        <Suspense fallback={<PageStatus title="正在检查访问权限" description="正在读取影片访问状态…" />}>
          <AccessGatePage api={api} vodId={vodId} kind="detail" />
        </Suspense>
      }
    >
      {(content) => <VodDetailContent content={content} qualityApi={qualityApi} />}
    </DetailBoundary>
  );
}
