import type { AccountRequirements } from "./account";

export const defaultAccountRequirements: AccountRequirements = {
  loginCaptcha: false,
  feedbackLogin: false,
  feedbackEnabled: true,
  feedbackAudit: false,
  feedbackCaptcha: false,
  commentLogin: false,
  commentEnabled: true,
  commentAudit: false,
  commentCaptcha: false,
  captchaUrl: null
};
