"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "../app/routing";

import { contentApi } from "../api/content";
import type {
  ContentAccessData,
  ContentApi,
  ContentDetailData,
  ContentEpisode,
  ContentVideo,
  DownloadsData,
  PlaybackDescriptor,
  PlotData
} from "../api/content";
import { ApiError } from "../api/http";
import { useAccount } from "../app/AccountContext";
import { DetailBoundary } from "../components/ContentBoundary";
import { Artwork, EmptyState, PageHeader, PageStatus, VodCard } from "../components/PagePrimitives";
import { upsertLocalHistory } from "../localHistory";
import { VodInteractions } from "./InteractionPages";

type ContentPageProps = {
  api?: ContentApi;
};

export type ContentChallengeKind = "confirm" | "detail" | "download" | "playback";

type EpisodeGroup = {
  sourceId: string;
  name: string;
  tip: string;
  episodes: ContentEpisode[];
};

function pageTitle(title: string, siteName: string) {
  return `${title} · ${siteName}`;
}

function useDocumentTitle(title: string, siteName: string) {
  useEffect(() => {
    document.title = pageTitle(title, siteName);
  }, [siteName, title]);
}

function groupEpisodes(video: ContentVideo): EpisodeGroup[] {
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

function watchHref(vodId: string, episode: ContentEpisode) {
  return `/watch/${encodeURIComponent(vodId)}/${encodeURIComponent(episode.sourceId)}/${encodeURIComponent(episode.id)}`;
}

function playbackHref(vodId: string, episode: ContentEpisode, trial: boolean) {
  const href = watchHref(vodId, episode);
  return trial ? href.replace(/^\/watch\//, "/trial/") : href;
}

function MissingContentPage({ siteName, kind, value }: { siteName: string; kind: "影片" | "剧集"; value?: string }) {
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

function EpisodeSections({
  vodId,
  groups,
  activeSourceId,
  activeEpisodeId
}: {
  vodId: string;
  groups: EpisodeGroup[];
  activeSourceId?: string;
  activeEpisodeId?: string;
}) {
  if (groups.length === 0) {
    return <EmptyState title="暂无可用剧集" description="站点尚未发布可播放的线路和剧集。" actionHref={`/vod/${vodId}`} actionLabel="返回详情" />;
  }

  return (
    <>
      {groups.map((group, groupIndex) => (
        <section className="episode-box" key={group.sourceId} aria-labelledby={`source-${groupIndex}`}>
          <div className="section-head compact">
            <h2 id={`source-${groupIndex}`}>{group.name}</h2>
            <span>{group.tip || `${group.episodes.length} 集`}</span>
          </div>
          <div className="episode-grid">
            {group.episodes.map((episode) => {
              const active = episode.id === activeEpisodeId && episode.sourceId === activeSourceId;

              return (
                <Link className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined} key={episode.id} to={watchHref(vodId, episode)}>
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

function VodDetailContent({ content }: { content: ContentDetailData }) {
  const video = content.video;
  const groups = groupEpisodes(video);
  const firstEpisode = groups[0]?.episodes[0];
  const related = content.related;

  useDocumentTitle(video.title, content.siteName);

  return (
    <main id="mainContent" tabIndex={-1}>
      <section className="detail-hero">
        <Artwork containerClassName="detail-backdrop" src={video.backdrop || video.poster || undefined} alt="" aria-hidden="true" />
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
              <span className="score-badge" aria-label={`${video.score.toFixed(1)} 分`}>
                {video.score.toFixed(1)}
              </span>
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
              <Link className="ghost-btn" to={`/vod/${video.id}/download`}>
                下载
              </Link>
              <Link className="ghost-btn" to={`/vod/${video.id}/plot`}>
                分集剧情
              </Link>
              <Link className="ghost-btn" to={`/report?vodId=${encodeURIComponent(video.id)}`}>
                片源报错
              </Link>
              <Link className="ghost-btn" to={`/comments/1/${video.id}`}>
                评论
              </Link>
            </div>
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
            <VodInteractions vodId={video.id} score={video.score} scoreCount={video.scoreCount} likes={video.likes} dislikes={video.dislikes} />
          </div>
        </div>
      </section>

      <section className="wrap content-section" aria-label="播放选集">
        <EpisodeSections vodId={video.id} groups={groups} />
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

export function VodDetailPage({ api = contentApi }: ContentPageProps) {
  const { vodId } = useParams();

  return (
    <DetailBoundary
      api={api}
      vodId={vodId}
      notFound={<MissingContentPage siteName="平方影视" kind="影片" value={vodId} />}
      denied={<AccessGatePage api={api} vodId={vodId} kind="detail" />}
    >
      {(content) => <VodDetailContent content={content} />}
    </DetailBoundary>
  );
}

function DownloadsContent({ content }: { content: DownloadsData }) {
  const video = content.video;
  useDocumentTitle(`${video.title}下载`, content.siteName);

  return (
    <main id="mainContent" tabIndex={-1}>
      <PageHeader eyebrow="下载" title={video.title} description="选择下载线路后，由 MacCMS 在当前会话中继续执行下载权限校验。" />
      <section className="wrap content-section" aria-label={`${video.title}可选剧集`}>
        {!content.access.authorized && content.access.state !== "password" && (
          <div className="system-box" role="status">
            <strong>{content.access.state === "confirm" ? "下载前需要确认权限" : "当前无法下载"}</strong>
            <p>{content.access.message}</p>
            {content.access.points > 0 && <p>所需积分：{content.access.points}</p>}
          </div>
        )}
        {content.sources.map((source, sourceIndex) => (
          <section className="episode-box download-box" key={source.id} aria-labelledby={`download-source-${sourceIndex}`}>
            <div className="section-head compact">
              <h2 id={`download-source-${sourceIndex}`}>{source.name}</h2>
              <span>{source.tip || `${source.items.length} 个资源`}</span>
            </div>
            <div className="download-list">
              {source.items.map((item) => {
                const unlockHref = `/vod/${video.id}/download/unlock?sourceId=${encodeURIComponent(source.id)}&episodeId=${encodeURIComponent(item.id)}`;
                return content.access.passwordRequired ? (
                  <Link key={item.id} to={unlockHref}>
                    <strong>{item.name}</strong>
                    <span>验证下载密码</span>
                  </Link>
                ) : (
                  <a key={item.id} href={item.href}>
                    <strong>{item.name}</strong>
                    <span>点击下载</span>
                  </a>
                );
              })}
            </div>
          </section>
        ))}
        {content.sources.length === 0 && content.access.authorized && (
          <EmptyState title="暂无下载资源" description="当前影片尚未发布下载线路。" actionHref={`/vod/${video.id}`} actionLabel="返回详情" />
        )}
        <div className="detail-actions">
          <Link className="primary-btn" to={`/vod/${video.id}`}>
            返回详情
          </Link>
        </div>
      </section>
    </main>
  );
}

export function DownloadsPage({ api = contentApi }: ContentPageProps) {
  const { vodId } = useParams();
  const normalizedVodId = vodId?.trim() ?? "";
  const query = useQuery({
    queryKey: ["downloads", normalizedVodId],
    queryFn: () => api.getDownloads(normalizedVodId),
    enabled: normalizedVodId !== "",
    staleTime: 0
  });

  if (!normalizedVodId) return <MissingContentPage siteName="平方影视" kind="影片" value={vodId} />;
  if (query.isPending) return <PageStatus title="正在加载下载列表" description="正在读取 MacCMS 下载线路…" />;
  if (query.isError) {
    if (query.error instanceof ApiError && (query.error.status === 404 || String(query.error.code) === "404")) {
      return <MissingContentPage siteName="平方影视" kind="影片" value={vodId} />;
    }
    if (query.error instanceof ApiError && (query.error.status === 403 || String(query.error.code) === "403")) {
      return <AccessGatePage api={api} vodId={normalizedVodId} kind="download" />;
    }
    return <PageStatus title="下载列表加载失败" description={query.error.message} error onRetry={() => void query.refetch()} />;
  }
  return <DownloadsContent content={query.data} />;
}

function PlotContent({ content }: { content: PlotData }) {
  const video = content.video;
  useDocumentTitle(`${video.title}分集剧情`, content.siteName);

  return (
    <main id="mainContent" tabIndex={-1}>
      <PageHeader eyebrow="分集剧情" title={video.title} description={video.summary || "查看每一集的剧情概要。"} />
      <section className="wrap content-section" aria-labelledby="plot-list-title">
        <h2 className="sr-only" id="plot-list-title">
          剧情列表
        </h2>
        {content.items.length > 0 ? (
          <div className="plot-list">
            {content.items.map((item, index) => (
              <article className="plot-item" key={`${index}-${item.name}`}>
                <strong>{item.name}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="暂无分集剧情" description="当前影片尚未填写分集剧情。" />
        )}
        <div className="detail-actions">
          <Link className="primary-btn" to={`/vod/${video.id}`}>
            返回详情
          </Link>
        </div>
      </section>
    </main>
  );
}

export function PlotPage({ api = contentApi }: ContentPageProps) {
  const { vodId } = useParams();
  const normalizedVodId = vodId?.trim() ?? "";
  const query = useQuery({
    queryKey: ["plot", normalizedVodId],
    queryFn: () => api.getPlot(normalizedVodId),
    enabled: normalizedVodId !== "",
    staleTime: 60_000
  });

  if (!normalizedVodId) return <MissingContentPage siteName="平方影视" kind="影片" value={vodId} />;
  if (query.isPending) return <PageStatus title="正在加载分集剧情" description="正在读取 MacCMS 分集剧情…" />;
  if (query.isError) {
    if (query.error instanceof ApiError && (query.error.status === 404 || String(query.error.code) === "404")) {
      return <MissingContentPage siteName="平方影视" kind="影片" value={vodId} />;
    }
    if (query.error instanceof ApiError && (query.error.status === 403 || String(query.error.code) === "403")) {
      return <AccessGatePage api={api} vodId={normalizedVodId} kind="detail" />;
    }
    return <PageStatus title="分集剧情加载失败" description={query.error.message} error onRetry={() => void query.refetch()} />;
  }
  return <PlotContent content={query.data} />;
}

function PlayerMedia({
  playback,
  onCheckpoint,
  onComplete
}: {
  playback: PlaybackDescriptor;
  onCheckpoint: (element: HTMLVideoElement) => void;
  onComplete: () => void;
}) {
  if (playback.kind === "iframe") {
    return (
      <iframe
        src={playback.url}
        title={`${playback.title} - ${playback.episodeName} 播放器`}
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-forms allow-popups allow-presentation allow-same-origin allow-scripts"
      />
    );
  }

  return (
    <video
      controls
      playsInline
      preload="metadata"
      poster={playback.poster || undefined}
      onPause={(event) => onCheckpoint(event.currentTarget)}
      onEnded={(event) => {
        onCheckpoint(event.currentTarget);
        onComplete();
      }}
    >
      <source src={playback.url} type={playback.mimeType} />
      你的浏览器不支持 HTML5 视频播放。
    </video>
  );
}

function AuthorizedPlayer({
  playback,
  groups,
  activeGroup,
  activeIndex,
  activeEpisode,
  trial
}: {
  playback: PlaybackDescriptor;
  groups: EpisodeGroup[];
  activeGroup: EpisodeGroup;
  activeIndex: number;
  activeEpisode: ContentEpisode;
  trial: boolean;
}) {
  const video = { id: playback.vodId, title: playback.title, poster: playback.poster };
  const account = useAccount();
  const navigate = useNavigate();
  const [historyMessage, setHistoryMessage] = useState("");
  const [autoAdvance, setAutoAdvance] = useState(true);
  const startedHistoryKey = useRef("");
  const previousEpisode = activeGroup.episodes[activeIndex - 1];
  const nextEpisode = activeGroup.episodes[activeIndex + 1];

  useDocumentTitle(`${trial ? "试看" : "播放"}：${video.title} - ${activeEpisode.name}`, playback.siteName);

  useEffect(() => {
    upsertLocalHistory(window.localStorage, {
      id: video.id,
      name: video.title,
      url: watchHref(video.id, activeEpisode),
      poster: video.poster,
      progress: activeEpisode.name
    });
  }, [activeEpisode, video.id, video.poster, video.title]);

  useEffect(() => {
    if (trial || !account.session.authenticated) return;
    const key = `${video.id}:${activeEpisode.sourceId}:${activeEpisode.id}`;
    if (startedHistoryKey.current === key) return;
    startedHistoryKey.current = key;
    void account.api
      .saveHistory({
        vodId: video.id,
        sourceId: activeEpisode.sourceId,
        episodeId: activeEpisode.id,
        positionSeconds: 0
      })
      .then(() => setHistoryMessage("播放记录已保存"))
      .catch(() => {
        startedHistoryKey.current = "";
        setHistoryMessage("播放记录暂未保存");
      });
  }, [account.api, account.session.authenticated, activeEpisode.id, activeEpisode.sourceId, trial, video.id]);

  const checkpoint = (element: HTMLVideoElement) => {
    if (!Number.isFinite(element.currentTime)) return;
    const minutes = Math.floor(Math.max(element.currentTime, 0) / 60);
    const seconds = Math.floor(Math.max(element.currentTime, 0) % 60);
    upsertLocalHistory(window.localStorage, {
      id: video.id,
      name: video.title,
      url: watchHref(video.id, activeEpisode),
      poster: video.poster,
      progress: `${activeEpisode.name} · 已看到 ${minutes}:${String(seconds).padStart(2, "0")}`
    });
    if (trial || !account.session.authenticated) return;
    void account.api
      .saveHistory({
        vodId: video.id,
        sourceId: activeEpisode.sourceId,
        episodeId: activeEpisode.id,
        positionSeconds: Math.max(element.currentTime, 0),
        ...(Number.isFinite(element.duration) && element.duration > 0 ? { durationSeconds: element.duration } : {})
      })
      .then(() => setHistoryMessage("播放进度已保存"))
      .catch(() => setHistoryMessage("播放进度暂未保存"));
  };

  return (
    <main id="mainContent" tabIndex={-1}>
      <section className="player-page">
        <div className="wrap">
          <div className="player-head">
            <div>
              <span className="eyebrow">{trial ? "试看" : "正在播放"}</span>
              <h1>
                {video.title} - {activeEpisode.name}
              </h1>
            </div>
            <Link className="ghost-btn" to={`/vod/${video.id}`}>
              返回详情
            </Link>
          </div>
          <div className="player-shell" role="region" aria-label={`${video.title} ${activeEpisode.name} 视频播放器`}>
            <PlayerMedia
              playback={playback}
              onCheckpoint={checkpoint}
              onComplete={() => {
                if (autoAdvance && nextEpisode) void navigate(playbackHref(video.id, nextEpisode, trial));
              }}
            />
          </div>
          <div className="player-toolbar" role="group" aria-label="剧集导航">
            <span>
              {video.title} / {activeEpisode.name}
            </span>
            <div className="player-toolbar-actions">
              {previousEpisode && (
                <Link className="ghost-btn player-step-link" rel="prev" to={playbackHref(video.id, previousEpisode, trial)}>
                  上一集
                </Link>
              )}
              <a className="ghost-btn" href="#episodeList">
                选集
              </a>
              {nextEpisode && (
                <Link className="ghost-btn player-step-link" rel="next" to={playbackHref(video.id, nextEpisode, trial)}>
                  下一集
                </Link>
              )}
              <button className="ghost-btn" type="button" aria-pressed={autoAdvance} onClick={() => setAutoAdvance((enabled) => !enabled)}>
                自动连播：{autoAdvance ? "开" : "关"}
              </button>
              <Link
                className="ghost-btn"
                to={`/report?vodId=${encodeURIComponent(video.id)}&sourceId=${encodeURIComponent(activeEpisode.sourceId)}&episodeId=${encodeURIComponent(activeEpisode.id)}`}
              >
                片源报错
              </Link>
            </div>
          </div>
          {historyMessage && (
            <p className="react-form-message" role="status">
              {historyMessage}
            </p>
          )}
        </div>
      </section>

      <section className="wrap content-section" id="episodeList" aria-label="播放选集">
        <EpisodeSections vodId={video.id} groups={groups} activeSourceId={activeEpisode.sourceId} activeEpisodeId={activeEpisode.id} />
      </section>
    </main>
  );
}

export function PlayerPage({ trial = false, api = contentApi }: ContentPageProps & { trial?: boolean }) {
  const { vodId, sourceId, episodeId } = useParams();
  const normalizedVodId = vodId?.trim() ?? "";
  const normalizedSourceId = sourceId?.trim() ?? "";
  const normalizedEpisodeId = episodeId?.trim() ?? "";
  const query = useQuery({
    queryKey: ["playback", normalizedVodId, normalizedSourceId, normalizedEpisodeId],
    queryFn: () => api.getPlayback(normalizedVodId, normalizedSourceId, normalizedEpisodeId),
    enabled: normalizedVodId !== "" && normalizedSourceId !== "" && normalizedEpisodeId !== "",
    staleTime: 0
  });

  if (!normalizedVodId) return <MissingContentPage siteName="平方影视" kind="影片" value={vodId} />;
  if (!normalizedSourceId || !normalizedEpisodeId) return <MissingContentPage siteName="平方影视" kind="剧集" value={episodeId} />;
  if (query.isPending) return <PageStatus title="正在准备播放器" description="正在向 MacCMS 请求当前剧集的授权播放信息…" />;
  if (query.isError) {
    if (query.error instanceof ApiError && (query.error.status === 404 || String(query.error.code) === "404")) {
      return <MissingContentPage siteName="平方影视" kind="剧集" value={episodeId} />;
    }
    if (query.error instanceof ApiError && query.error.status === 403) {
      return <AccessGatePage api={api} vodId={normalizedVodId} kind="playback" sourceId={normalizedSourceId} episodeId={normalizedEpisodeId} />;
    }
    return <PageStatus title="播放信息加载失败" description={query.error.message} error onRetry={() => void query.refetch()} />;
  }

  const playback = query.data;
  if (playback.vodId !== normalizedVodId || playback.sourceId !== normalizedSourceId || playback.episodeId !== normalizedEpisodeId) {
    return <PageStatus title="播放信息不匹配" description="MacCMS 返回了其他内容的播放信息，已停止加载媒体。" error />;
  }
  const groups = playback.playSources.map((source) => ({
    sourceId: source.id,
    name: source.name,
    tip: source.tip,
    episodes: [...source.episodes].sort((left, right) => left.no - right.no)
  }));
  const activeGroup = groups.find((group) => group.sourceId === normalizedSourceId);
  const activeIndex = activeGroup?.episodes.findIndex((episode) => episode.id === normalizedEpisodeId) ?? -1;
  const activeEpisode = activeIndex >= 0 ? activeGroup?.episodes[activeIndex] : undefined;
  if (!activeEpisode || !activeGroup) return <MissingContentPage siteName={playback.siteName} kind="剧集" value={episodeId} />;

  return (
    <AuthorizedPlayer playback={playback} groups={groups} activeGroup={activeGroup} activeIndex={activeIndex} activeEpisode={activeEpisode} trial={trial} />
  );
}

export function TrialPlayerPage(props: ContentPageProps) {
  return <PlayerPage {...props} trial />;
}

function ChallengeContent({
  content,
  kind,
  sourceId,
  episodeId
}: {
  content: ContentAccessData;
  kind: ContentChallengeKind;
  sourceId?: string;
  episodeId?: string;
}) {
  const account = useAccount();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const video = content.video;
  const labels: Record<ContentChallengeKind, { eyebrow: string; title: string }> = {
    confirm: { eyebrow: "点播确认", title: "访问确认" },
    detail: { eyebrow: "访问验证", title: "详情访问验证" },
    download: { eyebrow: "下载验证", title: "下载访问验证" },
    playback: { eyebrow: "播放验证", title: "播放访问验证" }
  };
  const label = labels[kind];

  useDocumentTitle(`${label.title}：${video.title}`, content.siteName);
  const returnHref =
    kind === "playback" && sourceId && episodeId
      ? `/watch/${encodeURIComponent(video.id)}/${encodeURIComponent(sourceId)}/${encodeURIComponent(episodeId)}`
      : kind === "download"
        ? `/vod/${video.id}/download`
        : `/vod/${video.id}`;
  const passwordScope = kind === "playback" ? "playback" : kind === "download" ? "download" : "detail";
  const mutation = useMutation({
    mutationFn: () => account.api.verifyContentPassword({ vodId: video.id, scope: passwordScope, password }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["content-detail", video.id] }),
        queryClient.invalidateQueries({ queryKey: ["access", video.id] }),
        queryClient.invalidateQueries({ queryKey: ["downloads", video.id] }),
        queryClient.invalidateQueries({ queryKey: ["playback", video.id] })
      ]);
      void navigate(returnHref);
    }
  });

  if (kind === "confirm") {
    return (
      <main id="mainContent" tabIndex={-1}>
        <section className="wrap system-page">
          <div className="system-box">
            <span className="eyebrow">{label.eyebrow}</span>
            <h1>确认继续</h1>
            <p>{content.message || `当前内容可能需要积分、权限或会员身份。确认后继续访问 ${video.title}。`}</p>
            {content.points > 0 && <p>所需积分：{content.points}</p>}
            <div className="detail-actions">
              <Link className="primary-btn" to={`/vod/${video.id}`}>
                确认继续
              </Link>
              <Link className="ghost-btn" to="/videos">
                返回影片库
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!content.passwordRequired) {
    return (
      <main id="mainContent" tabIndex={-1}>
        <section className="wrap system-page">
          <div className="system-box" role="status">
            <span className="eyebrow">{label.eyebrow}</span>
            <h1>{video.title}</h1>
            <p>{content.message}</p>
            <div className="detail-actions">
              {content.authorized && (
                <Link className="primary-btn" to={returnHref}>
                  继续访问
                </Link>
              )}
              {!content.authorized && content.state === "permission" && (
                <Link className="primary-btn" to={`/login?from=${encodeURIComponent(returnHref)}`}>
                  登录或升级会员
                </Link>
              )}
              <Link className="ghost-btn" to="/videos">
                浏览影片库
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main id="mainContent" tabIndex={-1}>
      <section className="wrap system-page">
        <form
          className="system-box verify-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!mutation.isPending) mutation.mutate();
          }}
        >
          <span className="eyebrow">{label.eyebrow}</span>
          <h1>
            {label.title}：{video.title}
          </h1>
          <p>{content.message}</p>
          <label>
            <span>{kind === "playback" ? "播放密码" : kind === "download" ? "下载密码" : "访问密码"}</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="输入密码"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
            />
          </label>
          <button className="primary-btn" type="submit" disabled={mutation.isPending || account.isPending || password === ""}>
            {mutation.isPending ? "正在验证…" : "提交验证"}
          </button>
          {mutation.isError && (
            <p className="react-form-message is-error" role="alert">
              {mutation.error.message}
            </p>
          )}
          <div className="detail-actions">
            <Link className="ghost-btn" to={returnHref}>
              返回{kind === "playback" ? "播放页" : kind === "download" ? "下载页" : "详情"}
            </Link>
            <Link className="ghost-btn" to="/videos">
              浏览影片库
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}

function AccessGatePage({
  api,
  vodId,
  kind,
  sourceId,
  episodeId
}: {
  api: ContentApi;
  vodId?: string;
  kind: ContentChallengeKind;
  sourceId?: string;
  episodeId?: string;
}) {
  const normalizedVodId = vodId?.trim() ?? "";
  const scope = kind === "playback" ? "playback" : kind === "download" ? "download" : kind;
  const query = useQuery({
    queryKey: ["access", normalizedVodId, scope, sourceId, episodeId],
    queryFn: () => api.getAccess(normalizedVodId, scope, sourceId, episodeId),
    enabled: normalizedVodId !== "",
    staleTime: 0
  });

  if (!normalizedVodId) return <MissingContentPage siteName="平方影视" kind="影片" value={vodId} />;
  if (query.isPending) return <PageStatus title="正在检查访问权限" description="正在向 MacCMS 读取当前访问状态…" />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return <MissingContentPage siteName="平方影视" kind={sourceId || episodeId ? "剧集" : "影片"} value={episodeId || vodId} />;
    }
    return <PageStatus title="访问状态加载失败" description={query.error.message} error onRetry={() => void query.refetch()} />;
  }
  return <ChallengeContent content={query.data} kind={kind} sourceId={sourceId} episodeId={episodeId} />;
}

export function ContentChallengePage({ kind = "detail", api = contentApi }: ContentPageProps & { kind?: ContentChallengeKind }) {
  const { vodId, sourceId: routeSourceId, episodeId: routeEpisodeId } = useParams();
  const [params] = useSearchParams();
  const sourceId = routeSourceId ?? params.get("sourceId") ?? undefined;
  const episodeId = routeEpisodeId ?? params.get("episodeId") ?? undefined;

  return <AccessGatePage api={api} vodId={vodId} kind={kind} sourceId={sourceId} episodeId={episodeId} />;
}

function UnavailableContent({ content, reason }: { content: ContentAccessData; reason: string }) {
  const video = content.video;
  useDocumentTitle(`${video.title}暂不可用`, content.siteName);

  return (
    <main id="mainContent" tabIndex={-1}>
      <section className="wrap system-page">
        <div className="system-box copyright-box" role="status">
          <span className="eyebrow">内容限制</span>
          <h1>{video.title} 暂不可播放</h1>
          <p>{reason}</p>
          <div className="detail-actions">
            <Link className="primary-btn" to={`/vod/${video.id}`}>
              返回详情
            </Link>
            <Link className="ghost-btn" to="/videos">
              浏览影片库
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export function UnavailablePage({
  api = contentApi,
  reason = "由于版权、地区或当前授权限制，该内容暂时无法提供播放。"
}: ContentPageProps & { reason?: string }) {
  const { vodId } = useParams();
  const normalizedVodId = vodId?.trim() ?? "";
  const query = useQuery({
    queryKey: ["access", normalizedVodId, "unavailable"],
    queryFn: () => api.getAccess(normalizedVodId, "unavailable"),
    enabled: normalizedVodId !== "",
    staleTime: 0
  });

  if (!normalizedVodId) return <MissingContentPage siteName="平方影视" kind="影片" value={vodId} />;
  if (query.isPending) return <PageStatus title="正在检查内容状态" description="正在向 MacCMS 读取当前限制状态…" />;
  if (query.isError) return <PageStatus title="内容状态加载失败" description={query.error.message} error onRetry={() => void query.refetch()} />;
  return <UnavailableContent content={query.data} reason={query.data.message || reason} />;
}
