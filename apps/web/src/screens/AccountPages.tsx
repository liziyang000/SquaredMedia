"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "../app/routing";

import { useAccount } from "../app/AccountContext";
import { CaptchaField } from "../components/CaptchaField";
import { Artwork, EmptyState, PageHeader, PageStatus } from "../components/PagePrimitives";

function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="react-form-message is-error" role="alert">
      {message}
    </p>
  );
}

function SuccessMessage({ message }: { message: string }) {
  return (
    <p className="react-form-message is-success" role="status">
      {message}
    </p>
  );
}

function AccountGate({ children }: { children: ReactNode }) {
  const account = useAccount();
  const location = useLocation();

  if (account.isPending) return <PageStatus title="正在确认登录状态" description="正在读取本地会话…" />;
  if (account.error) return <PageStatus title="登录状态加载失败" description={account.error.message} error onRetry={() => void account.refreshSession()} />;
  if (!account.session.authenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export function LoginPage() {
  const account = useAccount();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const destination = ((location.state as { from?: string } | null)?.from || "/account").startsWith("/")
    ? (location.state as { from?: string } | null)?.from || "/account"
    : "/account";

  useEffect(() => {
    document.title = "登录 · 平方影视";
  }, []);

  if (account.isPending) return <PageStatus title="正在确认登录状态" description="正在读取本地会话…" />;
  if (account.error) return <PageStatus title="登录状态加载失败" description={account.error.message} error onRetry={() => void account.refreshSession()} />;
  if (account.session.authenticated) return <Navigate to="/account" replace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await account.api.login({ username, password, ...(captcha ? { captcha } : {}) });
      account.adoptSession(result.data);
      await account.invalidateAccountData();
      void navigate(destination, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page" id="mainContent" tabIndex={-1} aria-labelledby="reactLoginTitle">
      <form className="login-panel verify-form" onSubmit={submit}>
        <span className="login-edge-glow" aria-hidden="true" />
        <span className="login-glass-highlight" aria-hidden="true" />
        <div className="login-heading">
          <span className="login-kicker">MEMBER LOGIN</span>
          <h1 id="reactLoginTitle">欢迎回来</h1>
          <p>登录账号以继续管理收藏、记录和登录设备</p>
        </div>
        <div className="login-fields">
          <div className="login-field">
            <label className="login-label" htmlFor="reactLoginAccount">
              账号
            </label>
            <span className="login-control">
              <span className="login-field-icon" aria-hidden="true">
                ◇
              </span>
              <input
                id="reactLoginAccount"
                name="username"
                autoComplete="username"
                placeholder="用户名或邮箱"
                value={username}
                onChange={(event) => setUsername(event.currentTarget.value)}
                required
              />
            </span>
          </div>
          <div className="login-field">
            <label className="login-label" htmlFor="reactLoginPassword">
              密码
            </label>
            <span className="login-control">
              <span className="login-field-icon" aria-hidden="true">
                ◇
              </span>
              <input
                id="reactLoginPassword"
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                placeholder="登录密码"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                required
              />
              <button
                className="login-password-toggle"
                type="button"
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? "隐藏" : "显示"}
              </button>
            </span>
          </div>
        </div>
        {account.session.requirements.loginCaptcha && account.session.requirements.captchaUrl && (
          <CaptchaField url={account.session.requirements.captchaUrl} value={captcha} onChange={setCaptcha} />
        )}
        {process.env.NODE_ENV !== "production" && <SuccessMessage message="本地验收账号：demo / demo123" />}
        {error && <ErrorMessage message={error} />}
        <div className="login-options">
          <span>既有会员登录 · 同源会话与设备保护</span>
        </div>
        <button className="primary-btn login-submit" type="submit" disabled={submitting || account.isPending}>
          {submitting ? "登录中…" : "登录"}
        </button>
      </form>
    </main>
  );
}

export function AccountPage() {
  const account = useAccount();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "用户中心 · 平方影视";
  }, []);

  const logout = async () => {
    setError("");
    try {
      await account.api.logout();
      await account.adoptAnonymousSession();
      await account.invalidateAccountData();
      void navigate("/login", { replace: true });
      void account.refreshSession();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "退出失败");
    }
  };

  return (
    <AccountGate>
      <main id="mainContent" tabIndex={-1}>
        <PageHeader eyebrow="账号" title={`你好，${account.session.user?.name || "会员"}`} description="管理收藏、观看记录和已登录设备。" />
        <section className="wrap account-grid">
          <Link className="system-box account-card" to="/account/favorites">
            <span className="eyebrow">FAVORITES</span>
            <h2>我的收藏</h2>
            <p>查看或移除已收藏的影片。</p>
          </Link>
          <Link className="system-box account-card" to="/account/history">
            <span className="eyebrow">HISTORY</span>
            <h2>播放记录</h2>
            <p>从上次观看的位置继续。</p>
          </Link>
          <Link className="system-box account-card" to="/account/devices">
            <span className="eyebrow">SECURITY</span>
            <h2>登录设备</h2>
            <p>检查并撤销其他设备会话。</p>
          </Link>
        </section>
        <section className="wrap account-actions">
          {error && <ErrorMessage message={error} />}
          <button className="danger-btn" type="button" onClick={() => void logout()}>
            退出登录
          </button>
        </section>
      </main>
    </AccountGate>
  );
}

export function FavoritesPage() {
  const account = useAccount();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const query = useQuery({
    queryKey: ["account", "favorites"],
    queryFn: () => account.api.getFavorites(),
    enabled: account.session.authenticated
  });
  const remove = useMutation({
    mutationFn: (input: { recordIds?: string[]; all?: boolean }) => account.api.deleteFavorites(input),
    onSuccess: async () => {
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ["account", "favorites"] });
    }
  });
  const items = query.data ?? [];
  const allRecordIds = items.flatMap((item) => item.recordIds);

  const removeRecords = (recordIds?: string[], all = false) => {
    if (!all && !recordIds?.length) return;
    if (!window.confirm(all ? "确定清空全部收藏记录吗？" : `确定删除选中的 ${recordIds?.length ?? 0} 条收藏记录吗？`)) return;
    remove.mutate(all ? { all: true } : { recordIds });
  };

  useEffect(() => {
    document.title = "我的收藏 · 平方影视";
  }, []);

  return (
    <AccountGate>
      <main id="mainContent" tabIndex={-1}>
        <PageHeader eyebrow="账号" title="我的收藏" description="收藏数据通过当前登录会话读取。" />
        <section className="wrap favorite-page">
          {query.isPending && (
            <p className="react-inline-status" role="status">
              正在加载收藏…
            </p>
          )}
          {query.isError && <ErrorMessage message={query.error.message} />}
          {remove.isError && <ErrorMessage message={remove.error.message} />}
          {items.length > 0 && (
            <div className="record-toolbar favorite-toolbar">
              <label className="record-check">
                <input
                  type="checkbox"
                  checked={allRecordIds.length > 0 && selected.size === allRecordIds.length}
                  onChange={(event) => setSelected(event.currentTarget.checked ? new Set(allRecordIds) : new Set())}
                />
                <span>全选</span>
              </label>
              <div className="record-actions">
                <Link className="ghost-btn" to="/videos">
                  继续发现
                </Link>
                <button className="ghost-btn" type="button" disabled={remove.isPending || selected.size === 0} onClick={() => removeRecords([...selected])}>
                  删除选中
                </button>
                <button className="danger-btn" type="button" disabled={remove.isPending} onClick={() => removeRecords(undefined, true)}>
                  清空收藏
                </button>
              </div>
            </div>
          )}
          {query.isSuccess && items.length === 0 && <EmptyState title="还没有收藏" description="在影片详情页收藏后会显示在这里。" />}
          <div className="record-list favorite-list">
            {items.map((item) => (
              <article className="record-item favorite-card" key={item.recordIds.join("-")}>
                <label className="record-check" aria-label={`选择收藏记录 ${item.title}`}>
                  <input
                    type="checkbox"
                    checked={item.recordIds.every((recordId) => selected.has(recordId))}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      setSelected((current) => {
                        const next = new Set(current);
                        item.recordIds.forEach((recordId) => {
                          if (checked) next.add(recordId);
                          else next.delete(recordId);
                        });
                        return next;
                      });
                    }}
                  />
                </label>
                <Link className="record-poster favorite-cover" to={`/vod/${item.vodId}`} aria-label={`查看 ${item.title}`}>
                  <Artwork containerClassName="poster" className="record-poster-img" src={item.poster} alt={item.title} loading="lazy" />
                </Link>
                <div className="record-main favorite-info">
                  <span className="favorite-status">已收藏</span>
                  <Link className="record-title favorite-title-link" to={`/vod/${item.vodId}`}>
                    {item.title}
                  </Link>
                  <span className="record-meta">{item.remark || "已收藏"}</span>
                  <span className="record-meta">{item.createdAt}</span>
                </div>
                <div className="record-item-actions favorite-card-actions">
                  <Link className="primary-btn" to={`/vod/${item.vodId}`}>
                    查看详情
                  </Link>
                  <button className="ghost-btn" type="button" disabled={remove.isPending} onClick={() => removeRecords(item.recordIds)}>
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </AccountGate>
  );
}

export function HistoryPage() {
  const account = useAccount();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const query = useQuery({
    queryKey: ["account", "history"],
    queryFn: () => account.api.getHistory(),
    enabled: account.session.authenticated
  });
  const remove = useMutation({
    mutationFn: (input: { recordIds?: string[]; all?: boolean }) => account.api.deleteHistory(input),
    onSuccess: async () => {
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ["account", "history"] });
    }
  });
  const items = [...(query.data ?? [])]
    .sort((left, right) => right.watchedAt.localeCompare(left.watchedAt))
    .filter((item, index, records) => records.findIndex((candidate) => candidate.vodId === item.vodId) === index);
  const allRecordIds = items.flatMap((item) => item.recordIds);

  const removeRecords = (recordIds?: string[], all = false) => {
    if (!all && !recordIds?.length) return;
    if (!window.confirm(all ? "确定清空全部播放记录吗？" : `确定删除选中的 ${recordIds?.length ?? 0} 条播放记录吗？`)) return;
    remove.mutate(all ? { all: true } : { recordIds });
  };

  useEffect(() => {
    document.title = "播放记录 · 平方影视";
  }, []);

  return (
    <AccountGate>
      <main id="mainContent" tabIndex={-1}>
        <PageHeader eyebrow="账号" title="播放记录" description="按最近观看时间倒序整理。" />
        <section className="wrap user-records">
          {query.isPending && (
            <p className="react-inline-status" role="status">
              正在加载记录…
            </p>
          )}
          {query.isError && <ErrorMessage message={query.error.message} />}
          {remove.isError && <ErrorMessage message={remove.error.message} />}
          {items.length > 0 && (
            <div className="record-toolbar">
              <label className="record-check">
                <input
                  type="checkbox"
                  checked={allRecordIds.length > 0 && selected.size === allRecordIds.length}
                  onChange={(event) => setSelected(event.currentTarget.checked ? new Set(allRecordIds) : new Set())}
                />
                <span>全选</span>
              </label>
              <div className="record-actions">
                <button className="ghost-btn" type="button" disabled={remove.isPending || selected.size === 0} onClick={() => removeRecords([...selected])}>
                  删除选中
                </button>
                <button className="danger-btn" type="button" disabled={remove.isPending} onClick={() => removeRecords(undefined, true)}>
                  清空记录
                </button>
              </div>
            </div>
          )}
          {query.isSuccess && items.length === 0 && <EmptyState title="暂无播放记录" description="开始观看影片后会显示在这里。" />}
          <div className="record-list">
            {items.map((item) => (
              <article className="record-item" key={item.recordIds.join("-")}>
                <label className="record-check" aria-label={`选择播放记录 ${item.title}`}>
                  <input
                    type="checkbox"
                    checked={item.recordIds.every((recordId) => selected.has(recordId))}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      setSelected((current) => {
                        const next = new Set(current);
                        item.recordIds.forEach((recordId) => {
                          if (checked) next.add(recordId);
                          else next.delete(recordId);
                        });
                        return next;
                      });
                    }}
                  />
                </label>
                <Link className="record-poster" to={`/watch/${item.vodId}/${item.sourceId}/${item.episodeId}`} aria-label={`继续观看 ${item.title}`}>
                  <Artwork containerClassName="poster" className="record-poster-img" src={item.poster} alt={item.title} loading="lazy" />
                </Link>
                <div className="record-main">
                  <Link className="record-title" to={`/watch/${item.vodId}/${item.sourceId}/${item.episodeId}`}>
                    {item.title} - {item.episodeName}
                  </Link>
                  <span className="record-progress">{item.progress}</span>
                  <span className="record-meta">{item.watchedAt}</span>
                </div>
                <div className="record-item-actions">
                  <Link className="primary-btn" to={`/watch/${item.vodId}/${item.sourceId}/${item.episodeId}`}>
                    继续观看
                  </Link>
                  <button className="ghost-btn" type="button" disabled={remove.isPending} onClick={() => removeRecords(item.recordIds)}>
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </AccountGate>
  );
}

export function DevicesPage() {
  const account = useAccount();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["account", "devices"],
    queryFn: () => account.api.getDevices(),
    enabled: account.session.authenticated
  });
  const revoke = useMutation({
    mutationFn: (sessionId: string) => account.api.revokeDevice(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["account", "devices"] })
  });

  useEffect(() => {
    document.title = "登录设备 · 平方影视";
  }, []);

  return (
    <AccountGate>
      <main id="mainContent" tabIndex={-1}>
        <PageHeader eyebrow="安全" title="登录设备" description="撤销陌生设备后，该会话会立即失效。" />
        <section className="wrap device-panel">
          {query.data && (
            <p className="react-inline-status" role="status">
              当前账号最多允许 {query.data.maxDevices} 台设备同时登录
            </p>
          )}
          {query.isPending && (
            <p className="react-inline-status" role="status">
              正在加载设备…
            </p>
          )}
          {query.isError && <ErrorMessage message={query.error.message} />}
          {revoke.isError && <ErrorMessage message={revoke.error.message} />}
          <div className="account-device-list">
            {query.data?.items.map((device) => (
              <article className="device-card" key={device.sessionId}>
                <div>
                  <h2>
                    {device.name}
                    {device.current && <span className="device-current">当前设备</span>}
                  </h2>
                  <div className="device-meta">
                    <span>
                      {device.os} · {device.browser}
                    </span>
                    <span>IP：{device.ipAddress || "未知"}</span>
                    <span>登录时间：{device.loginAt}</span>
                    <span>最近活跃：{device.lastActiveAt}</span>
                    <span>状态：{device.status}</span>
                    <span>客户端：{device.userAgent || "未知"}</span>
                    {device.revokedAt && <span>撤销时间：{device.revokedAt}</span>}
                  </div>
                </div>
                {device.current ? (
                  <span className="device-status">在线</span>
                ) : device.revokedAt ? (
                  <span className="device-status">已撤销</span>
                ) : (
                  <button
                    className="danger-btn"
                    type="button"
                    disabled={revoke.isPending}
                    onClick={() => {
                      if (window.confirm(`确定撤销“${device.name}”的登录会话吗？`)) revoke.mutate(device.sessionId);
                    }}
                  >
                    撤销
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      </main>
    </AccountGate>
  );
}
