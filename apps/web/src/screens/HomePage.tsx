"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "../app/routing";

import { homeApi } from "../api";
import type { AccountHistoryEntry, HomeApi, HomeCardVideo, HomeCategory, HomeData, HomeHeroVideo } from "../api";
import { useAccount } from "../app/AccountContext";
import { Artwork } from "../components/PagePrimitives";
import { readLocalHistory } from "../localHistory";
import type { LocalHistoryEntry } from "../localHistory";

type BannerStyle = CSSProperties & {
  "--banner-bg": string;
};

const channelDetails = new Map([
  ["42", { code: "FILM", description: "银幕精选" }],
  ["47", { code: "SERIES", description: "追剧现场" }],
  ["48", { code: "SHOW", description: "轻松时刻" }],
  ["57", { code: "ANIME", description: "次元放映" }],
  ["111", { code: "DOC", description: "真实记录" }]
]);

function buildHomeView(data: HomeData) {
  const latestByCategory = new Map(data.latestByCategory.map((group) => [group.categoryId, group.videos]));
  const tabs = [
    { id: "all", label: "推荐", videos: data.latest },
    ...data.categories.map((category) => ({
      id: `category-${category.id}`,
      label: category.name,
      videos: latestByCategory.get(category.id) ?? []
    }))
  ];
  return {
    hero: data.hero,
    rank: data.ranking,
    channels: data.categories.slice(0, 4),
    tabs
  };
}

function HomeStatus({ error, onRetry }: { error?: Error; onRetry?: () => void }) {
  return (
    <main className="home-status-shell" aria-live="polite">
      <section className="home-status-panel" role={error ? "alert" : "status"}>
        <span className="brand-emblem" aria-hidden="true" />
        <p className="migration-kicker">SquaredMedia</p>
        <h1>{error ? "首页加载失败" : "正在准备首页"}</h1>
        <p>{error ? error.message : "正在读取影片、分类和观看记录…"}</p>
        {onRetry && (
          <button type="button" onClick={onRetry}>
            重新加载
          </button>
        )}
      </section>
    </main>
  );
}

function HeroCarousel({ todayUpdated, videos }: { todayUpdated: number; videos: HomeHeroVideo[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setPaused(true);
  }, []);

  useEffect(() => {
    if (paused || videos.length < 2) return;
    const interval = window.setInterval(() => setActiveIndex((index) => (index + 1) % videos.length), 6500);
    return () => window.clearInterval(interval);
  }, [paused, videos.length]);

  if (videos.length === 0) {
    return (
      <section className="hero-carousel home-hero-empty" aria-label="首页热播轮播">
        <div className="home-empty-state" role="status">
          <strong>暂无热播内容</strong>
          <span>后台添加影片后会显示在这里。</span>
        </div>
      </section>
    );
  }

  return (
    <section className="hero-carousel" aria-label="首页热播轮播">
      <div className="banner-track">
        {videos.map((video, index) => {
          const firstEpisode = video.episodes[0];
          const bannerStyle: BannerStyle = {
            "--banner-bg": `url("${video.backdrop}"), radial-gradient(circle at 74% 24%, rgba(139, 124, 255, 0.42), transparent 30%), linear-gradient(135deg, #161a32, #07131c)`
          };

          return (
            <article
              className={`hero-slide${index === activeIndex ? " is-active" : ""}`}
              key={video.id}
              style={bannerStyle}
              aria-hidden={index !== activeIndex}
              inert={index !== activeIndex}
            >
              <span className="banner-bg" />
              <span className="banner-content">
                <span className="banner-copy">
                  <em className="eyebrow">热播推荐 · 今日更新 {todayUpdated} 部</em>
                  <strong>{video.title}</strong>
                  <span className="banner-meta">
                    <i>{video.year}</i>
                    <i>{video.class}</i>
                    <i>{video.duration}</i>
                    <i>{video.version}</i>
                  </span>
                  <small>{video.summary}</small>
                </span>
                <span className="banner-actions">
                  <Link className="primary-btn" to={`/watch/${video.id}/${firstEpisode.sourceId}/${firstEpisode.id}`}>
                    立即播放
                  </Link>
                  <Link className="ghost-btn" to={`/vod/${video.id}`}>
                    详情介绍
                  </Link>
                </span>
              </span>
            </article>
          );
        })}
      </div>
      <div className="banner-controls">
        <button
          className={`banner-autoplay-toggle${paused ? " is-paused" : ""}`}
          type="button"
          aria-pressed={paused}
          aria-label={paused ? "继续自动轮播" : "暂停自动轮播"}
          onClick={() => setPaused((value) => !value)}
        >
          <span aria-hidden="true" />
        </button>
        <div className="banner-dots" role="tablist" aria-label="轮播分页">
          {videos.map((video, index) => (
            <button
              className={`banner-dot${index === activeIndex ? " is-active" : ""}`}
              key={video.id}
              type="button"
              role="tab"
              aria-label={`查看 ${video.title}`}
              aria-selected={index === activeIndex}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function RankList({ videos }: { videos: HomeCardVideo[] }) {
  return (
    <div className="hero-rank">
      <div className="section-head compact">
        <span className="rank-heading">
          <small>TOP 05</small>
          <h2>年度热度榜</h2>
        </span>
        <Link className="rank-refresh" to="/rankings/yearly">
          查看更多
        </Link>
      </div>
      <div className={`rank-list${videos.length === 0 ? " is-empty" : ""}`}>
        {videos.map((video, index) => (
          <Link className="rank-item" key={video.id} to={`/vod/${video.id}`}>
            <Artwork containerClassName="rank-thumb" src={video.poster} alt={video.title} width={112} height={84} loading="lazy" decoding="async" sizes="72px">
              <span className="rank-index">{index + 1}</span>
            </Artwork>
            <span className="rank-body">
              <strong>{video.title}</strong>
              <em className="rank-meta">
                {video.year} · {video.class}
              </em>
            </span>
            <span className="rank-score">{video.score.toFixed(1)}</span>
          </Link>
        ))}
        {videos.length === 0 && (
          <div className="home-empty-state home-rank-empty" role="status">
            <strong>本年度暂无上榜内容</strong>
            <span>新内容产生热度后会显示在这里。</span>
            <Link to="/videos">浏览全部影片</Link>
          </div>
        )}
      </div>
    </div>
  );
}

function GenreDock({ categories }: { categories: HomeCategory[] }) {
  return (
    <nav className="wrap genre-dock" aria-label="频道快捷入口">
      <Link className="genre-chip genre-chip-featured" data-channel="TOP" to="/rankings/yearly">
        <span>热播榜</span>
        <small>全站热度</small>
      </Link>
      {categories.map((category) => {
        const detail = channelDetails.get(category.id) ?? { code: "TYPE", description: "频道精选" };
        return (
          <Link className="genre-chip" data-channel={detail.code} key={category.id} to={`/category/${category.id}`}>
            <span>{category.name}</span>
            <small>{detail.description}</small>
          </Link>
        );
      })}
      <Link className="genre-chip" data-channel="NEW" to="/videos?sort=latest">
        <span>今日更新</span>
        <small>刚刚上线</small>
      </Link>
    </nav>
  );
}

type ContinueItem = {
  key: string;
  name: string;
  url: string;
  poster?: string;
  meta: string;
  progress: string;
};

function localContinueItem(entry: LocalHistoryEntry): ContinueItem {
  return {
    key: `local-${entry.id}-${entry.url}`,
    name: entry.name,
    url: entry.url,
    poster: entry.poster,
    meta: entry.watchedAt || "当前浏览器",
    progress: entry.progress
  };
}

function accountContinueItem(entry: AccountHistoryEntry): ContinueItem {
  return {
    key: `account-${entry.vodId}-${entry.sourceId}-${entry.episodeId}`,
    name: entry.title,
    url: `/watch/${entry.vodId}/${entry.sourceId}/${entry.episodeId}`,
    poster: entry.poster,
    meta: `${entry.episodeName} · ${entry.watchedAt}`,
    progress: entry.progress
  };
}

function ContinueWatching({ items, historyHref }: { items: ContinueItem[]; historyHref: string }) {
  if (items.length === 0) return null;

  return (
    <section className="wrap home-shelf home-continue" aria-labelledby="homeContinueTitle">
      <div className="home-shelf-head">
        <span className="shelf-title">
          <small>KEEP WATCHING</small>
          <h2 id="homeContinueTitle">继续观看</h2>
        </span>
        <Link className="home-shelf-more" to={historyHref}>
          全部记录
        </Link>
      </div>
      <div className="home-continue-rail" aria-live="polite">
        {items.map((item) => (
          <Link className="home-continue-card" key={item.key} to={item.url}>
            <Artwork containerClassName="home-continue-poster" src={item.poster} alt={item.name} loading="lazy" />
            <span className="home-continue-body">
              <strong>{item.name}</strong>
              <small>{item.meta}</small>
              <em>{item.progress}</em>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ShelfCard({ video }: { video: HomeCardVideo }) {
  return (
    <Link className="home-shelf-card" to={`/vod/${video.id}`} title={video.title}>
      <Artwork
        containerClassName="home-shelf-poster"
        src={video.poster}
        alt={video.title}
        loading="lazy"
        decoding="async"
        width={300}
        height={450}
        sizes="(max-width: 760px) 50vw, (max-width: 1020px) 33vw, 180px"
      >
        <em>{video.remark}</em>
      </Artwork>
      <span className="home-shelf-body">
        <strong>{video.title}</strong>
        <small>
          {video.year} · {video.class}
        </small>
      </span>
      <span className="home-shelf-score">{video.score.toFixed(1)}</span>
    </Link>
  );
}

function LatestShelf({ tabs }: { tabs: ReturnType<typeof buildHomeView>["tabs"] }) {
  const [activeTab, setActiveTab] = useState("all");
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const currentTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  const selectTab = (index: number) => {
    const tab = tabs[(index + tabs.length) % tabs.length];
    setActiveTab(tab.id);
    tabRefs.current.get(tab.id)?.focus();
  };

  return (
    <section className="wrap home-shelf home-shelf-latest" aria-label="本年最新上线">
      <div className="home-shelf-head">
        <span className="shelf-title">
          <small>NEW THIS YEAR</small>
          <h2>本年最新上线</h2>
        </span>
        <nav className="home-shelf-tabs" role="tablist" aria-label="最新分类">
          {tabs.map((tab) => (
            <button
              className={tab.id === currentTab.id ? "is-active" : undefined}
              key={tab.id}
              id={`latest-tab-${tab.id}`}
              ref={(node) => {
                if (node) tabRefs.current.set(tab.id, node);
                else tabRefs.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              aria-selected={tab.id === currentTab.id}
              aria-controls={`latest-panel-${tab.id}`}
              tabIndex={tab.id === currentTab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => {
                const currentIndex = tabs.findIndex((item) => item.id === tab.id);
                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  selectTab(currentIndex + 1);
                } else if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  selectTab(currentIndex - 1);
                } else if (event.key === "Home") {
                  event.preventDefault();
                  selectTab(0);
                } else if (event.key === "End") {
                  event.preventDefault();
                  selectTab(tabs.length - 1);
                }
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <Link className="home-shelf-more" to="/videos">
          全部影片
        </Link>
      </div>
      {tabs.map((tab) => (
        <div
          className={`home-shelf-rail${tab.videos.length === 0 ? " is-empty" : ""}`}
          id={`latest-panel-${tab.id}`}
          key={tab.id}
          role="tabpanel"
          aria-labelledby={`latest-tab-${tab.id}`}
          hidden={tab.id !== currentTab.id}
        >
          {tab.videos.map((video) => (
            <ShelfCard key={video.id} video={video} />
          ))}
          {tab.videos.length === 0 && (
            <div className="home-empty-state" role="status">
              <strong>本年度暂无新上线内容</strong>
              <span>{tab.id === "all" ? "有新影片上线后会显示在这里。" : "此频道有新内容后会显示在这里。"}</span>
              <Link to="/videos">浏览全部影片</Link>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

export function HomePage({ api = homeApi }: { api?: Pick<HomeApi, "getHome"> }) {
  const account = useAccount();
  const [localHistory, setLocalHistory] = useState<ReturnType<typeof readLocalHistory>>([]);
  const query = useQuery({
    queryKey: ["home", "v2"],
    queryFn: () => api.getHome(),
    staleTime: 60_000
  });
  const accountHistoryQuery = useQuery({
    queryKey: ["account", "history", "home"],
    queryFn: () => account.api.getHistory(4),
    enabled: account.session.authenticated
  });
  const view = useMemo(() => (query.data ? buildHomeView(query.data) : null), [query.data]);
  const continueItems = useMemo(() => {
    const candidates = [
      ...localHistory.map(localContinueItem),
      ...(account.session.authenticated ? (accountHistoryQuery.data ?? []).map(accountContinueItem) : [])
    ];
    const seen = new Set<string>();
    return candidates
      .filter((item) => {
        if (seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
      })
      .slice(0, 4);
  }, [account.session.authenticated, accountHistoryQuery.data, localHistory]);

  useEffect(() => {
    if (query.data) document.title = `${query.data.siteName} · 首页`;
  }, [query.data]);

  useEffect(() => {
    setLocalHistory(readLocalHistory(window.localStorage));
    const refresh = (event: StorageEvent) => {
      if (!event.key || event.key === "pingfang_history" || event.key === "mac_history") setLocalHistory(readLocalHistory(window.localStorage));
    };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  if (query.isPending) return <HomeStatus />;
  if (query.isError) return <HomeStatus error={query.error} onRetry={() => void query.refetch()} />;
  if (!view) return <HomeStatus error={new Error("首页数据不可用")} onRetry={() => void query.refetch()} />;

  return (
    <div className="react-home">
      <main id="mainContent" tabIndex={-1}>
        <h1 className="sr-only">{query.data.siteName}首页</h1>
        <section className="hero">
          <div className="wrap hero-grid">
            <HeroCarousel todayUpdated={query.data.todayUpdated} videos={view.hero} />
            <RankList videos={view.rank} />
          </div>
        </section>
        <GenreDock categories={view.channels} />
        <ContinueWatching items={continueItems} historyHref={account.session.authenticated ? "/account/history" : "/history"} />
        <LatestShelf tabs={view.tabs} />
      </main>
    </div>
  );
}
