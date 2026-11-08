"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useAccount } from "../app/AccountContext";
import { useNavigate } from "../app/routing";

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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [displayLikes, setDisplayLikes] = useState(likes);
  const [displayDislikes, setDisplayDislikes] = useState(dislikes);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    setDisplayLikes(likes);
    setDisplayDislikes(dislikes);
  }, [vodId, likes, dislikes]);

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
    <div className="detail-interactions" aria-label="影片互动">
      <div className="score-summary">
        <span>评分</span>
        <strong>{score.toFixed(1)}</strong>
        <em>{scoreCount > 0 ? `${scoreCount} 人评分` : "暂无评分"}</em>
      </div>
      <div className="digg-panel">
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
      {(message || error) && (
        <p className={`react-form-message ${error ? "is-error" : "is-success"}`} role={error ? "alert" : "status"}>
          {error || message}
        </p>
      )}
    </div>
  );
}

export function VodFavoriteButton({ vodId }: { vodId: string }) {
  const account = useAccount();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const favoriteStatus = useQuery({
    queryKey: ["account", "favorite-status", vodId],
    queryFn: () => account.api.getFavoriteStatus(vodId),
    enabled: account.session.authenticated
  });
  const favorited = favoriteStatus.data?.favorited ?? false;
  const statusError =
    account.session.authenticated && favoriteStatus.error ? (favoriteStatus.error instanceof Error ? favoriteStatus.error.message : "收藏状态加载失败") : "";

  return (
    <div className="detail-favorite-action">
      <button
        className="ghost-btn"
        type="button"
        onClick={() => {
          if (!account.session.authenticated) {
            void navigate("/login", { state: { from: `/vod/${vodId}` } });
            return;
          }
          if (favorited) return;
          setMessage("");
          setError("");
          setPending(true);
          void account.api
            .setFavorite({ vodId, favorite: true })
            .then(async (result) => {
              setMessage(result.message);
              queryClient.setQueryData(["account", "favorite-status", vodId], result.data);
              await queryClient.invalidateQueries({ queryKey: ["account", "favorites"] });
            })
            .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "收藏失败"))
            .finally(() => setPending(false));
        }}
        disabled={pending || (account.session.authenticated && (favoriteStatus.isPending || favoriteStatus.isError)) || favorited}
      >
        {pending ? "收藏中…" : account.session.authenticated && favoriteStatus.isPending ? "检查中…" : favorited ? "已收藏" : "收藏"}
      </button>
      {(message || error || statusError) && (
        <span className={`favorite-feedback${error || statusError ? " is-error" : ""}`} role="status">
          {error || statusError || message}
        </span>
      )}
    </div>
  );
}
