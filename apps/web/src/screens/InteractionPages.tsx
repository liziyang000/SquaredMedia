"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "../app/routing";

import { useAccount } from "../app/AccountContext";
import { CaptchaField } from "../components/CaptchaField";
import { PageHeader, PageStatus } from "../components/PagePrimitives";

function FormMessage({ error, children }: { error?: boolean; children: string }) {
  return (
    <p className={`react-form-message ${error ? "is-error" : "is-success"}`} role={error ? "alert" : "status"}>
      {children}
    </p>
  );
}

type SubmissionKind = "feedback" | "report" | "comment";

function submissionMessage(kind: SubmissionKind, status: string | undefined, auditEnabled: boolean, fallback: string) {
  const pending = {
    feedback: "留言已提交，审核通过后显示。",
    report: "报错已提交，正在等待管理员审核。",
    comment: "评论已提交，审核通过后显示。"
  }[kind];
  const published = {
    feedback: "留言已发布。",
    report: "报错已提交。",
    comment: "评论已发布。"
  }[kind];

  if (status === "pending" || (!status && auditEnabled)) return pending;
  if (status === "published") return published;
  return fallback;
}

export function FeedbackPage({ report = false }: { report?: boolean }) {
  const account = useAccount();
  const [params] = useSearchParams();
  const [name, setName] = useState("");
  const [vodId, setVodId] = useState(params.get("vodId")?.trim() || "");
  const sourceId = params.get("sourceId")?.trim() || "";
  const episodeId = params.get("episodeId")?.trim() || "";
  const [reason, setReason] = useState("无法播放");
  const [content, setContent] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const title = report ? "片源报错" : "留言反馈";
  const loginRequired = account.session.requirements.feedbackLogin;
  const enabled = account.session.requirements.feedbackEnabled;
  const auditEnabled = account.session.requirements.feedbackAudit;

  useEffect(() => {
    document.title = `${title} · 平方影视`;
  }, [title]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSubmitting(true);
    try {
      const result = report
        ? await account.api.submitReport({
            ...(vodId ? { vodId } : {}),
            reason,
            details: content,
            ...(vodId && sourceId && episodeId ? { sourceId, episodeId } : {}),
            ...(captcha ? { captcha } : {})
          })
        : await account.api.submitFeedback({ ...(name ? { name } : {}), content, ...(captcha ? { captcha } : {}) });
      setMessage(submissionMessage(report ? "report" : "feedback", result.data.status, auditEnabled, result.message));
      setContent("");
      setCaptcha("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (account.isPending) return <PageStatus title="正在读取反馈设置" description="正在确认后台是否开放提交功能…" />;
  if (account.error) return <PageStatus title="反馈设置加载失败" description={account.error.message} error onRetry={() => void account.refreshSession()} />;

  if (!enabled) {
    return (
      <main id="mainContent" tabIndex={-1}>
        <section className="wrap system-page">
          <div className="system-box" role="status">
            <span className="eyebrow">功能已关闭</span>
            <h1>{report ? "片源报错功能已关闭" : "留言功能已关闭"}</h1>
            <p>后台当前未开放{report ? "片源报错" : "留言"}提交，请稍后再试。</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main id="mainContent" tabIndex={-1}>
      <section className="wrap system-page">
        <form className="system-box verify-form" onSubmit={submit}>
          <span className="eyebrow">{report ? "报错反馈" : "反馈"}</span>
          <h1>{title}</h1>
          <p>{report ? "请说明无法播放、集数错误、画质异常或字幕问题。" : "欢迎提交意见、片源问题或合作信息。"}</p>
          {report ? (
            <>
              <label>
                <span>影片 ID（可选）</span>
                <input inputMode="numeric" value={vodId} onChange={(event) => setVodId(event.currentTarget.value)} />
              </label>
              <label>
                <span>问题类型</span>
                <select value={reason} onChange={(event) => setReason(event.currentTarget.value)}>
                  <option>无法播放</option>
                  <option>集数错误</option>
                  <option>画质异常</option>
                  <option>字幕问题</option>
                  <option>其他</option>
                </select>
              </label>
            </>
          ) : (
            <label>
              <span>称呼（可选）</span>
              <input value={name} onChange={(event) => setName(event.currentTarget.value)} autoComplete="name" />
            </label>
          )}
          <label>
            <span>{report ? "问题详情" : "内容"}</span>
            <textarea rows={6} value={content} onChange={(event) => setContent(event.currentTarget.value)} required />
          </label>
          {account.session.requirements.feedbackCaptcha && account.session.requirements.captchaUrl && (
            <CaptchaField url={account.session.requirements.captchaUrl} value={captcha} onChange={setCaptcha} />
          )}
          <div className="verify-code">{auditEnabled ? "后台已开启审核，提交后需管理员审核通过。" : "写操作使用同源会话、CSRF Token 和服务端校验"}</div>
          {loginRequired && !account.session.authenticated && (
            <p className="react-form-message" role="status">
              后台当前要求先<Link to="/login">登录</Link>再提交。
            </p>
          )}
          {message && <FormMessage>{message}</FormMessage>}
          {error && <FormMessage error>{error}</FormMessage>}
          <button className="primary-btn" type="submit" disabled={submitting || account.isPending || (loginRequired && !account.session.authenticated)}>
            {submitting ? "提交中…" : report ? "提交报错" : "提交留言"}
          </button>
        </form>
      </section>
    </main>
  );
}

export function ReportPage() {
  return <FeedbackPage report />;
}

export function CommentsPage() {
  const account = useAccount();
  const queryClient = useQueryClient();
  const { id = "", mid = "1" } = useParams();
  const [content, setContent] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const loginRequired = account.session.requirements.commentLogin;
  const enabled = account.session.requirements.commentEnabled;
  const auditEnabled = account.session.requirements.commentAudit;
  const query = useQuery({
    queryKey: ["comments", mid, id],
    queryFn: () => account.api.getComments(id, mid),
    enabled: Boolean(id) && !account.isPending && !account.error && enabled
  });
  const reaction = useMutation({
    mutationFn: ({ commentId, value }: { commentId: string; value: "like" | "dislike" }) =>
      account.api.setReaction({ target: "comment", targetId: commentId, value }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comments", mid, id] }),
    onError: (caught) => setError(caught instanceof Error ? caught.message : "互动操作失败")
  });

  useEffect(() => {
    document.title = "评论 · 平方影视";
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSubmitting(true);
    try {
      const result = await account.api.submitComment({ mid, vodId: id, content, ...(captcha ? { captcha } : {}) });
      setMessage(submissionMessage("comment", result.data.status, auditEnabled, result.message));
      setContent("");
      setCaptcha("");
      if (result.data.status === "published") await queryClient.invalidateQueries({ queryKey: ["comments", mid, id] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "评论提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (!id) {
    return (
      <main id="mainContent" tabIndex={-1}>
        <section className="wrap system-page">
          <div className="system-box" role="alert">
            <span className="eyebrow">400</span>
            <h1>缺少评论对象</h1>
            <Link className="primary-btn" to="/videos">
              返回影片库
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (account.isPending) {
    return (
      <main id="mainContent" tabIndex={-1}>
        <PageHeader eyebrow="互动" title="影片评论" description={`内容模块 ${mid} · 对象 ${id}`} />
        <section className="wrap system-page">
          <div className="system-box" role="status">
            <h2>正在读取评论设置</h2>
            <p>正在确认后台是否开放评论功能…</p>
          </div>
        </section>
      </main>
    );
  }

  if (account.error) {
    return (
      <main id="mainContent" tabIndex={-1}>
        <PageHeader eyebrow="互动" title="影片评论" description={`内容模块 ${mid} · 对象 ${id}`} />
        <section className="wrap system-page">
          <div className="system-box" role="alert">
            <h2>评论设置加载失败</h2>
            <p>{account.error.message}</p>
            <button className="ghost-btn" type="button" onClick={() => void account.refreshSession()}>
              重试
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!enabled) {
    return (
      <main id="mainContent" tabIndex={-1}>
        <PageHeader eyebrow="互动" title="影片评论" description={`内容模块 ${mid} · 对象 ${id}`} />
        <section className="wrap system-page">
          <div className="system-box" role="status">
            <h2>评论功能已关闭</h2>
            <p>后台当前未开放评论功能，请稍后再试。</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main id="mainContent" tabIndex={-1}>
      <PageHeader eyebrow="互动" title="影片评论" description={`内容模块 ${mid} · 对象 ${id}`} />
      <section className="wrap comments-layout">
        <form className="system-box verify-form" onSubmit={submit}>
          <h2>发表评论</h2>
          <label>
            <span>评论内容</span>
            <textarea rows={5} value={content} onChange={(event) => setContent(event.currentTarget.value)} required />
          </label>
          {account.session.requirements.commentCaptcha && account.session.requirements.captchaUrl && (
            <CaptchaField url={account.session.requirements.captchaUrl} value={captcha} onChange={setCaptcha} />
          )}
          {auditEnabled && <div className="verify-code">后台已开启审核，评论需管理员审核通过后显示。</div>}
          {message && <FormMessage>{message}</FormMessage>}
          {error && <FormMessage error>{error}</FormMessage>}
          {loginRequired && !account.session.authenticated && (
            <p className="react-form-message" role="status">
              后台当前要求先<Link to="/login">登录</Link>再评论。
            </p>
          )}
          <button className="primary-btn" type="submit" disabled={submitting || (loginRequired && !account.session.authenticated)}>
            {submitting ? "提交中…" : "提交评论"}
          </button>
        </form>
        <section className="comment-list" aria-label="评论列表">
          {query.isPending && <p role="status">正在加载评论…</p>}
          {query.isError && <FormMessage error>{query.error.message}</FormMessage>}
          {query.data?.length === 0 && <p role="status">还没有评论，欢迎发表第一条。</p>}
          {query.data?.map((comment) => (
            <article className="comment-item" key={comment.id}>
              <div className="section-head compact">
                <strong>{comment.author}</strong>
                <span>{comment.createdAt}</span>
              </div>
              <p>{comment.content}</p>
              <div className="comment-actions">
                <button type="button" disabled={reaction.isPending} onClick={() => reaction.mutate({ commentId: comment.id, value: "like" })}>
                  赞 {comment.likes}
                </button>
                <button type="button" disabled={reaction.isPending} onClick={() => reaction.mutate({ commentId: comment.id, value: "dislike" })}>
                  踩 {comment.dislikes}
                </button>
              </div>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}

export function VodInteractions({
  vodId,
  score,
  scoreCount = 0,
  likes = 0,
  dislikes = 0
}: {
  vodId: string;
  score: number;
  scoreCount?: number;
  likes?: number;
  dislikes?: number;
}) {
  const account = useAccount();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [rating, setRating] = useState(String(Math.max(1, Math.round(score))));
  const [displayScore, setDisplayScore] = useState(score);
  const [displayScoreCount, setDisplayScoreCount] = useState(scoreCount);
  const [displayLikes, setDisplayLikes] = useState(likes);
  const [displayDislikes, setDisplayDislikes] = useState(dislikes);
  const [pending, setPending] = useState(false);
  const favorites = useQuery({
    queryKey: ["account", "favorites"],
    queryFn: () => account.api.getFavorites(),
    enabled: account.session.authenticated
  });
  const favorited = favorites.data?.some((item) => item.vodId === vodId) ?? false;

  useEffect(() => {
    setDisplayScore(score);
    setDisplayScoreCount(scoreCount);
    setDisplayLikes(likes);
    setDisplayDislikes(dislikes);
  }, [vodId, score, scoreCount, likes, dislikes]);

  const run = async <T extends { message: string }>(operation: () => Promise<T>, onSuccess?: (result: T) => void) => {
    setMessage("");
    setError("");
    setPending(true);
    try {
      const result = await operation();
      setMessage(result.message);
      onSuccess?.(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "操作失败");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="detail-interactions">
      <div className="interaction-panel score-panel">
        <strong>{displayScore.toFixed(1)}</strong>
        <span>{displayScoreCount > 0 ? `${displayScoreCount} 人评分` : "当前评分"}</span>
        <label className="rating-control">
          <span className="sr-only">我的评分</span>
          <select value={rating} onChange={(event) => setRating(event.currentTarget.value)}>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>
                {value} 分
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              void run(
                () => account.api.submitRating({ vodId, score: Number(rating) }),
                (result) => {
                  setDisplayScore(result.data.average);
                  setDisplayScoreCount(result.data.count);
                }
              )
            }
          >
            评分
          </button>
        </label>
      </div>
      <div className="interaction-panel digg-panel">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            void run(
              () => account.api.setReaction({ target: "vod", targetId: vodId, value: "like" }),
              (result) => {
                setDisplayLikes(result.data.likes);
                setDisplayDislikes(result.data.dislikes);
              }
            )
          }
        >
          点赞 {displayLikes}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            void run(
              () => account.api.setReaction({ target: "vod", targetId: vodId, value: "dislike" }),
              (result) => {
                setDisplayLikes(result.data.likes);
                setDisplayDislikes(result.data.dislikes);
              }
            )
          }
        >
          点踩 {displayDislikes}
        </button>
      </div>
      <div className="interaction-panel favorite-action">
        <button
          className="ghost-btn"
          type="button"
          onClick={() => {
            if (!account.session.authenticated) {
              void navigate("/login", { state: { from: `/vod/${vodId}` } });
              return;
            }
            if (favorited) return;
            void run(async () => {
              const result = await account.api.setFavorite({ vodId, favorite: true });
              await favorites.refetch();
              return result;
            });
          }}
          disabled={pending || favorited}
        >
          {favorited ? "已收藏" : "收藏"}
        </button>
      </div>
      {(message || error) && <FormMessage error={Boolean(error)}>{error || message}</FormMessage>}
    </div>
  );
}
