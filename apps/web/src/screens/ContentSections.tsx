import { lazy, Suspense, useEffect } from "react";

import type { ContentEpisode, ContentVideo } from "../api/content";
import { Link } from "../app/routing";
import { EmptyState } from "../components/PagePrimitives";
import type { SourceQualityView } from "../components/SourceQualityPanel";

const SourceQualityHeading = lazy(() => import("../components/SourceQualityPanel").then((module) => ({ default: module.SourceQualityHeading })));

export type EpisodeGroup = {
  sourceId: string;
  name: string;
  tip: string;
  episodes: ContentEpisode[];
};

function pageTitle(title: string, siteName: string) {
  return `${title} · ${siteName}`;
}

export function useDocumentTitle(title: string, siteName: string) {
  useEffect(() => {
    document.title = pageTitle(title, siteName);
  }, [siteName, title]);
}

export function groupEpisodes(video: ContentVideo): EpisodeGroup[] {
  if (video.playSources.length > 0) {
    return video.playSources.map((source) => ({
      sourceId: source.id,
      name: source.name,
      tip: source.tip,
      episodes: [...source.episodes].sort((left, right) => left.no - right.no)
    }));
  }
  const groups = new Map<string, ContentEpisode[]>();

  video.episodes.forEach((episode) => {
    const episodes = groups.get(episode.sourceId) ?? [];
    episodes.push(episode);
    groups.set(episode.sourceId, episodes);
  });

  return Array.from(groups, ([sourceId, episodes]) => ({
    sourceId,
    name: `播放线路 ${sourceId}`,
    tip: "",
    episodes: [...episodes].sort((left, right) => left.no - right.no)
  }));
}

export function watchHref(vodId: string, episode: ContentEpisode) {
  return `/watch/${encodeURIComponent(vodId)}/${encodeURIComponent(episode.sourceId)}/${encodeURIComponent(episode.id)}`;
}

export function MissingContentPage({ siteName, kind, value }: { siteName: string; kind: "影片" | "剧集"; value?: string }) {
  useDocumentTitle(`${kind}不存在`, siteName);

  return (
    <main id="mainContent" tabIndex={-1}>
      <section className="wrap system-page">
        <div className="system-box" role="alert">
          <span className="eyebrow">404</span>
          <h1>{kind}不存在</h1>
          <p>{value ? `没有找到编号为 ${value} 的${kind}。` : `当前地址没有提供有效的${kind}编号。`}</p>
          <div className="detail-actions">
            <Link className="primary-btn" to="/videos">
              浏览影片库
            </Link>
            <Link className="ghost-btn" to="/">
              返回首页
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export function EpisodeSections({
  vodId,
  groups,
  activeSourceId,
  activeEpisodeId,
  qualityView
}: {
  vodId: string;
  groups: EpisodeGroup[];
  activeSourceId?: string;
  activeEpisodeId?: string;
  qualityView?: SourceQualityView | null;
}) {
  if (groups.length === 0) {
    return <EmptyState title="暂无可用剧集" description="站点尚未发布可播放的线路和剧集。" actionHref={`/vod/${vodId}`} actionLabel="返回详情" />;
  }

  return (
    <>
      {groups.map((group, groupIndex) => (
        <section
          className={`episode-box${
            qualityView?.data?.recommended_sid && String(qualityView.data.recommended_sid) === group.sourceId ? " is-source-recommended" : ""
          }`}
          key={group.sourceId}
          aria-labelledby={`source-${groupIndex}`}
        >
          <div className="section-head compact">
            <h2 id={`source-${groupIndex}`}>{group.name}</h2>
            {qualityView ? (
              <Suspense fallback={<span>{group.tip || `${group.episodes.length} 集`}</span>}>
                <SourceQualityHeading sourceId={group.sourceId} description={group.tip || `${group.episodes.length} 集`} view={qualityView} />
              </Suspense>
            ) : (
              <span>{group.tip || `${group.episodes.length} 集`}</span>
            )}
          </div>
          <div className="episode-grid">
            {group.episodes.map((episode) => {
              const active = episode.id === activeEpisodeId && episode.sourceId === activeSourceId;
              const recommended =
                qualityView?.episodeNo === episode.no &&
                qualityView.data?.recommended_sid !== null &&
                String(qualityView?.data?.recommended_sid) === group.sourceId;

              return (
                <Link
                  className={[active ? "is-active" : "", recommended ? "is-source-recommended" : ""].filter(Boolean).join(" ") || undefined}
                  aria-current={active ? "page" : undefined}
                  key={episode.id}
                  to={watchHref(vodId, episode)}
                >
                  {episode.name}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
