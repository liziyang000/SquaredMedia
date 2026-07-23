import { useEffect, useState } from "react";
import type { ImgHTMLAttributes, ReactNode } from "react";
import { Link, useNavigate } from "../app/routing";

type ArtworkProps = ImgHTMLAttributes<HTMLImageElement> & {
  children?: ReactNode;
  containerClassName: string;
};

export type VodCardItem = {
  id: string;
  title: string;
  poster: string;
  remark: string;
  year: string;
  class: string;
  typeName?: string;
  score: number;
};

export function Artwork({ children, containerClassName, src, ...imageProps }: ArtworkProps) {
  const [failed, setFailed] = useState(false);
  const missing = failed || typeof src !== "string" || src.trim() === "";

  useEffect(() => setFailed(false), [src]);

  return (
    <span className={`${containerClassName}${missing ? " is-image-missing" : ""}`}>
      {!missing && <img {...imageProps} src={src} onError={() => setFailed(true)} />}
      {children}
    </span>
  );
}

export function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <section className="wrap page-title">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}

export function PageStatus({
  title,
  description,
  error,
  loading = false,
  ready = false,
  onRetry
}: {
  title: string;
  description: string;
  error?: boolean;
  loading?: boolean;
  ready?: boolean;
  onRetry?: () => void;
}) {
  return (
    <main className={`home-status-shell${loading ? " loading-status-shell" : ""}`} aria-busy={loading && !ready} aria-live="polite">
      <section className={`home-status-panel${loading ? " loading-status-panel" : ""}${ready ? " is-ready" : ""}`} role={error ? "alert" : "status"}>
        {loading ? (
          <span className="loading-status-mark" aria-hidden="true">
            <span className="brand-emblem" />
            <span className="loading-status-orbit">
              <i />
              <i />
              <i />
            </span>
          </span>
        ) : (
          <span className="brand-emblem" aria-hidden="true" />
        )}
        <p className="migration-kicker">SquaredMedia</p>
        <h1>{title}</h1>
        <p>{description}</p>
        {loading && (
          <div className="loading-status-motion" aria-hidden="true">
            <span className="loading-status-track">
              <i className="loading-status-bar" />
            </span>
            <span className="loading-status-stages">
              <i>连接片库</i>
              <i>整理分类</i>
              <i>生成片单</i>
            </span>
          </div>
        )}
        {onRetry && (
          <button type="button" onClick={onRetry}>
            重新加载
          </button>
        )}
      </section>
    </main>
  );
}

export function EmptyState({
  title,
  description,
  actionHref = "/videos",
  actionLabel = "浏览影片库"
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="content-empty-state is-visible" role="status">
      <strong>{title}</strong>
      <span>{description}</span>
      <Link to={actionHref}>{actionLabel}</Link>
    </div>
  );
}

export function VodCard({ video }: { video: VodCardItem }) {
  return (
    <Link className="vod-card" to={`/vod/${video.id}`}>
      <Artwork
        containerClassName="poster"
        src={video.poster}
        alt={video.title}
        loading="lazy"
        decoding="async"
        width={300}
        height={450}
        sizes="(max-width: 760px) 50vw, (max-width: 1020px) 33vw, 180px"
      >
        <em className="quality-badge">{video.remark || "高清"}</em>
        <span className="score-badge">{video.score.toFixed(1)}</span>
      </Artwork>
      <strong>{video.title}</strong>
      <span className="card-meta">
        <span>{video.typeName || video.class}</span>
        <span>{video.year}</span>
      </span>
    </Link>
  );
}

export function Pagination({ page, totalPages, buildHref }: { page: number; totalPages: number; buildHref: (page: number) => string }) {
  const [jumpPage, setJumpPage] = useState(String(page));
  const navigate = useNavigate();

  useEffect(() => setJumpPage(String(page)), [page]);

  if (totalPages <= 1) return null;

  const normalizedPage = Math.min(Math.max(page, 1), totalPages);
  const requestedPage = Math.min(Math.max(Number.parseInt(jumpPage, 10) || normalizedPage, 1), totalPages);

  return (
    <nav className="paging" aria-label="分页">
      <Link className="page-link" to={buildHref(1)}>
        首页
      </Link>
      <Link className="page-link" rel="prev" to={buildHref(Math.max(normalizedPage - 1, 1))}>
        上一页
      </Link>
      <span className="page-state" aria-current="page">
        {normalizedPage} / {totalPages}
      </span>
      <Link className="page-link" rel="next" to={buildHref(Math.min(normalizedPage + 1, totalPages))}>
        下一页
      </Link>
      <Link className="page-link" to={buildHref(totalPages)}>
        尾页
      </Link>
      <form
        className="page-jump"
        onSubmit={(event) => {
          event.preventDefault();
          void navigate(buildHref(requestedPage));
        }}
      >
        <label className="sr-only" htmlFor="reactPageJump">
          跳转页码
        </label>
        <input
          className="page-jump-input"
          id="reactPageJump"
          type="number"
          min="1"
          max={totalPages}
          value={jumpPage}
          onChange={(event) => setJumpPage(event.currentTarget.value)}
        />
        <button className="page-jump-submit" type="submit">
          跳转
        </button>
      </form>
    </nav>
  );
}
