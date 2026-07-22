import { useEffect, useState } from "react";

type CaptchaFieldProps = {
  url: string;
  value: string;
  onChange: (value: string) => void;
};

export function CaptchaField({ url, value, onChange }: CaptchaFieldProps) {
  const [revision, setRevision] = useState(0);
  const separator = url.includes("?") ? "&" : "?";

  useEffect(() => setRevision(Date.now()), []);

  return (
    <div className="react-captcha-field">
      <label>
        <span>图形验证码</span>
        <input value={value} onChange={(event) => onChange(event.currentTarget.value)} autoComplete="off" inputMode="text" required />
      </label>
      <div className="react-captcha-preview">
        <img src={`${url}${separator}_=${revision}`} alt="图形验证码" />
        <button type="button" className="ghost-btn" onClick={() => setRevision(Date.now())}>
          换一张
        </button>
      </div>
    </div>
  );
}
