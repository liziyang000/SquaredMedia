import { useEffect, useState } from "react";

type CaptchaFieldProps = {
  url: string;
  value: string;
  onChange: (value: string) => void;
  variant?: "default" | "login";
};

export function CaptchaField({ url, value, onChange, variant = "default" }: CaptchaFieldProps) {
  const [revision, setRevision] = useState(0);
  const separator = url.includes("?") ? "&" : "?";
  const imageUrl = `${url}${separator}_=${revision}`;

  useEffect(() => setRevision(Date.now()), []);

  if (variant === "login") {
    return (
      <div className="login-field">
        <label className="login-label" htmlFor="reactLoginVerify">
          验证码
        </label>
        <div className="login-captcha-row">
          <span className="login-control">
            <svg className="login-field-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m12 3 7 3v5c0 4.6-2.9 8-7 10-4.1-2-7-5.4-7-10V6l7-3Zm0 6v4m0 3h.01" />
            </svg>
            <input
              id="reactLoginVerify"
              value={value}
              onChange={(event) => onChange(event.currentTarget.value)}
              autoComplete="off"
              inputMode="text"
              placeholder="输入验证码"
              required
            />
          </span>
          <span className="login-captcha-image">
            <img src={imageUrl} alt="点击刷新验证码" />
          </span>
          <button type="button" className="login-captcha-refresh" aria-label="换一张验证码" onClick={() => setRevision(Date.now())}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 7v5h-5M4 17v-5h5m9.2-3A7 7 0 0 0 6.7 6.4L4 9m16 6-2.7 2.6A7 7 0 0 1 5.8 15" />
            </svg>
            <span>换一张</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="react-captcha-field">
      <label>
        <span>图形验证码</span>
        <input value={value} onChange={(event) => onChange(event.currentTarget.value)} autoComplete="off" inputMode="text" required />
      </label>
      <div className="react-captcha-preview">
        <img src={imageUrl} alt="图形验证码" />
        <button type="button" className="ghost-btn" onClick={() => setRevision(Date.now())}>
          换一张
        </button>
      </div>
    </div>
  );
}
