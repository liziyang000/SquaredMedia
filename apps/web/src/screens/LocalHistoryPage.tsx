"use client";

import { useEffect, useState } from "react";
import { Link } from "../app/routing";

import { clearLocalHistory, readLocalHistory } from "../localHistory";
import { Artwork, EmptyState, PageHeader } from "../components/PagePrimitives";

export function LocalHistoryPage() {
  const [entries, setEntries] = useState<ReturnType<typeof readLocalHistory>>([]);

  useEffect(() => {
    document.title = "本地观看记录 · 平方影视";
    setEntries(readLocalHistory(window.localStorage));
    const refresh = (event: StorageEvent) => {
      if (!event.key || event.key === "pingfang_history" || event.key === "mac_history") setEntries(readLocalHistory(window.localStorage));
    };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  return (
    <main id="mainContent" tabIndex={-1}>
      <PageHeader eyebrow="观看记录" title="本地时间轴" description="仅保存在当前浏览器中，不会与登录账号的播放记录混合。" />
      <section className="wrap local-history-actions" aria-label="观看记录操作">
        <Link className="ghost-btn" to="/account/history">
          查看账号记录
        </Link>
        {entries.length > 0 && (
          <button
            className="danger-btn"
            type="button"
            onClick={() => {
              if (!window.confirm("确定清空当前浏览器中的观看记录吗？")) return;
              if (clearLocalHistory(window.localStorage)) setEntries([]);
            }}
          >
            清空本地记录
          </button>
        )}
      </section>
      <section className="wrap history-timeline" aria-label="本地观看记录">
        {entries.length === 0 ? (
          <EmptyState title="暂无本地观看记录" description="开始播放影片后，记录会按最近观看时间显示在这里。" />
        ) : (
          entries.map((entry) => (
            <div className="local-history-entry" key={`${entry.id}-${entry.url}`}>
              <div className="timeline-date">{entry.dateLabel}</div>
              <article className="timeline-item">
                <span className="timeline-dot" />
                <div className="timeline-time">{entry.timeLabel}</div>
                <Link className="timeline-card" to={entry.url}>
                  <Artwork containerClassName="poster record-poster" className="record-poster-img" src={entry.poster} alt={entry.name} loading="lazy" />
                  <span>
                    <strong>{entry.name}</strong>
                    <small>{entry.progress}</small>
                    <em>继续观看</em>
                  </span>
                </Link>
              </article>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
