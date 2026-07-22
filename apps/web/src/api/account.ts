import { z } from "zod";

import { ApiError, requestJson } from "./http";
import type { ApiEnvelopeResult } from "./schemas";
import { identifierSchema, parseApiInput, parseEnvelopeData, requireApiEndpoint, withApiParams } from "./schemas";

const accountUserSchema = z.object({
  id: identifierSchema,
  name: z.string().min(1)
});

const sameOriginPathSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => value.startsWith("/") && !value.startsWith("//") && !value.includes("\\"));

const accountRequirementsSchema = z.object({
  loginCaptcha: z.boolean(),
  feedbackLogin: z.boolean().default(false),
  feedbackEnabled: z.boolean().default(true),
  feedbackAudit: z.boolean().default(false),
  feedbackCaptcha: z.boolean(),
  commentLogin: z.boolean().default(false),
  commentEnabled: z.boolean().default(true),
  commentAudit: z.boolean().default(false),
  commentCaptcha: z.boolean(),
  captchaUrl: sameOriginPathSchema.nullable()
});

export type AccountRequirements = z.infer<typeof accountRequirementsSchema>;
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

const sessionSchema = z
  .object({
    authenticated: z.boolean(),
    csrfToken: z.string().min(1),
    user: accountUserSchema.nullable(),
    requirements: accountRequirementsSchema.default(defaultAccountRequirements)
  })
  .superRefine((session, context) => {
    if (session.authenticated && !session.user) {
      context.addIssue({ code: "custom", message: "已登录会话必须包含用户" });
    }
    if (!session.authenticated && session.user) {
      context.addIssue({ code: "custom", message: "匿名会话不能包含用户" });
    }
    const captchaRequired = session.requirements.loginCaptcha || session.requirements.feedbackCaptcha || session.requirements.commentCaptcha;
    if (captchaRequired && !session.requirements.captchaUrl) {
      context.addIssue({ code: "custom", message: "启用验证码时必须提供站内验证码地址" });
    }
  });

const favoriteSchema = z.object({
  recordIds: z.array(identifierSchema).min(1),
  vodId: identifierSchema,
  title: z.string().min(1),
  poster: z.string(),
  remark: z.string().optional(),
  createdAt: z.string().min(1)
});

const historyEntrySchema = z.object({
  recordIds: z.array(identifierSchema).min(1),
  vodId: identifierSchema,
  sourceId: identifierSchema,
  episodeId: identifierSchema,
  title: z.string().min(1),
  episodeName: z.string().min(1),
  poster: z.string(),
  progress: z.string(),
  watchedAt: z.string().min(1)
});

const deviceSchema = z.object({
  sessionId: z.string().min(1),
  name: z.string().min(1),
  browser: z.string(),
  os: z.string(),
  loginAt: z.string().min(1),
  lastActiveAt: z.string().min(1),
  ipAddress: z.string(),
  userAgent: z.string(),
  status: z.string().min(1),
  revokedAt: z.string().min(1).nullable(),
  current: z.boolean()
});

const favoritesSchema = z.object({ items: z.array(favoriteSchema) });
const historySchema = z.object({ items: z.array(historyEntrySchema) });
const historyLimitSchema = z.number().int().min(1).max(100);
const devicesSchema = z.object({ maxDevices: z.coerce.number().int().positive(), items: z.array(deviceSchema) });

const loginInputSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
  captcha: z.string().trim().min(1).max(100).optional()
});

const contentPasswordInputSchema = z.object({
  vodId: identifierSchema,
  scope: z.enum(["detail", "playback", "download"]),
  password: z.string().min(1).max(200)
});
const contentPasswordResultSchema = z.object({
  vodId: identifierSchema,
  scope: z.enum(["detail", "playback", "download"]),
  authorized: z.literal(true)
});

const favoriteInputSchema = z.object({
  vodId: identifierSchema,
  favorite: z.boolean()
});

const favoriteResultSchema = z.object({
  vodId: identifierSchema,
  favorited: z.boolean()
});

const recordDeleteInputSchema = z
  .object({
    recordIds: z.array(identifierSchema).min(1).max(100).optional(),
    all: z.boolean().optional()
  })
  .refine((input) => (input.all === true ? !input.recordIds?.length : Boolean(input.recordIds?.length)), {
    message: "all 与 recordIds 必须且只能选择一种"
  });
const recordDeleteResultSchema = z.object({ removed: z.number().int().nonnegative() });

const historyInputSchema = z.object({
  vodId: identifierSchema,
  sourceId: identifierSchema,
  episodeId: identifierSchema,
  positionSeconds: z.number().finite().nonnegative(),
  durationSeconds: z.number().finite().positive().optional()
});

const historyResultSchema = z.object({ saved: z.boolean() });
const logoutResultSchema = z.object({ authenticated: z.literal(false) });

const revokeInputSchema = z.object({ sessionId: z.string().trim().min(1).max(200) });
const revokeResultSchema = z.object({
  sessionId: z.string().min(1),
  revoked: z.boolean()
});

const feedbackInputSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  content: z.string().trim().min(1).max(5000),
  captcha: z.string().trim().min(1).optional()
});

const reportInputSchema = z
  .object({
    vodId: identifierSchema.optional(),
    sourceId: identifierSchema.optional(),
    episodeId: identifierSchema.optional(),
    reason: z.string().trim().min(1).max(200),
    details: z.string().trim().max(5000).optional(),
    captcha: z.string().trim().min(1).optional()
  })
  .superRefine((input, context) => {
    if (Boolean(input.sourceId) !== Boolean(input.episodeId)) {
      context.addIssue({ code: "custom", message: "sourceId 和 episodeId 必须同时提供" });
    }
    if ((input.sourceId || input.episodeId) && !input.vodId) {
      context.addIssue({ code: "custom", message: "分集报错必须提供 vodId" });
    }
  });

const commentInputSchema = z.object({
  mid: identifierSchema.optional(),
  vodId: identifierSchema,
  parentId: identifierSchema.optional(),
  content: z.string().trim().min(1).max(5000),
  captcha: z.string().trim().min(1).optional()
});

const commentEntrySchema = z.object({
  id: identifierSchema,
  parentId: identifierSchema.nullable().optional(),
  author: z.string().min(1),
  content: z.string(),
  createdAt: z.string().min(1),
  likes: z.coerce.number().int().nonnegative(),
  dislikes: z.coerce.number().int().nonnegative()
});

const commentsSchema = z.object({ items: z.array(commentEntrySchema) });

const submissionResultSchema = z.object({
  id: identifierSchema,
  status: z.string().min(1).optional()
});

const reactionInputSchema = z.object({
  target: z.enum(["vod", "comment"]),
  targetId: identifierSchema,
  value: z.enum(["like", "dislike", "none"])
});

const reactionResultSchema = z.object({
  target: z.enum(["vod", "comment"]),
  targetId: identifierSchema,
  value: z.enum(["like", "dislike", "none"]),
  likes: z.coerce.number().int().nonnegative(),
  dislikes: z.coerce.number().int().nonnegative()
});

const ratingInputSchema = z.object({
  vodId: identifierSchema,
  score: z.number().min(1).max(10)
});

const ratingResultSchema = z.object({
  vodId: identifierSchema,
  score: z.number().min(1).max(10),
  average: z.coerce.number().nonnegative(),
  count: z.coerce.number().int().nonnegative()
});

export type AccountUser = z.infer<typeof accountUserSchema>;
export type AccountSession = z.infer<typeof sessionSchema>;
export type FavoriteEntry = z.infer<typeof favoriteSchema>;
export type AccountHistoryEntry = z.infer<typeof historyEntrySchema>;
export type AccountDevice = z.infer<typeof deviceSchema>;
export type AccountDevices = z.infer<typeof devicesSchema>;
export type LoginInput = z.input<typeof loginInputSchema>;
export type ContentPasswordInput = z.input<typeof contentPasswordInputSchema>;
export type FavoriteInput = z.input<typeof favoriteInputSchema>;
export type RecordDeleteInput = z.input<typeof recordDeleteInputSchema>;
export type HistoryInput = z.input<typeof historyInputSchema>;
export type FeedbackInput = z.input<typeof feedbackInputSchema>;
export type ReportInput = z.input<typeof reportInputSchema>;
export type CommentInput = z.input<typeof commentInputSchema>;
export type CommentEntry = z.infer<typeof commentEntrySchema>;
export type ReactionInput = z.input<typeof reactionInputSchema>;
export type RatingInput = z.input<typeof ratingInputSchema>;

type CsrfTokenSource = string | (() => string | null | undefined);

type AccountApiOptions = {
  endpoint?: string;
  csrfToken?: CsrfTokenSource;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type AccountApi = {
  getSession(): Promise<AccountSession>;
  login(input: LoginInput): Promise<ApiEnvelopeResult<AccountSession>>;
  verifyContentPassword(input: ContentPasswordInput): Promise<ApiEnvelopeResult<z.infer<typeof contentPasswordResultSchema>>>;
  logout(): Promise<ApiEnvelopeResult<z.infer<typeof logoutResultSchema>>>;
  getFavorites(): Promise<FavoriteEntry[]>;
  setFavorite(input: FavoriteInput): Promise<ApiEnvelopeResult<z.infer<typeof favoriteResultSchema>>>;
  deleteFavorites(input: RecordDeleteInput): Promise<ApiEnvelopeResult<z.infer<typeof recordDeleteResultSchema>>>;
  getHistory(limit?: number): Promise<AccountHistoryEntry[]>;
  saveHistory(input: HistoryInput): Promise<ApiEnvelopeResult<z.infer<typeof historyResultSchema>>>;
  deleteHistory(input: RecordDeleteInput): Promise<ApiEnvelopeResult<z.infer<typeof recordDeleteResultSchema>>>;
  getDevices(): Promise<AccountDevices>;
  revokeDevice(sessionId: string): Promise<ApiEnvelopeResult<z.infer<typeof revokeResultSchema>>>;
  submitFeedback(input: FeedbackInput): Promise<ApiEnvelopeResult<z.infer<typeof submissionResultSchema>>>;
  submitReport(input: ReportInput): Promise<ApiEnvelopeResult<z.infer<typeof submissionResultSchema>>>;
  getComments(vodId: string | number, mid?: string | number): Promise<CommentEntry[]>;
  submitComment(input: CommentInput): Promise<ApiEnvelopeResult<z.infer<typeof submissionResultSchema>>>;
  setReaction(input: ReactionInput): Promise<ApiEnvelopeResult<z.infer<typeof reactionResultSchema>>>;
  submitRating(input: RatingInput): Promise<ApiEnvelopeResult<z.infer<typeof ratingResultSchema>>>;
};

function resolveCsrfToken(source: CsrfTokenSource | undefined) {
  const value = typeof source === "function" ? source() : source;
  const token = value?.trim() ?? "";
  if (!token) {
    throw new ApiError("缺少 CSRF Token", { kind: "configuration" });
  }
  return token;
}

export function createAccountApi({ endpoint = "", csrfToken, fetchImpl, timeoutMs }: AccountApiOptions = {}): AccountApi {
  let sessionCsrfToken = "";

  async function read<T>(action: string, schema: z.ZodType<T>, fallbackMessage: string, params: Record<string, string> = {}) {
    const url = withApiParams(requireApiEndpoint(endpoint), { action, ...params });
    const payload = await requestJson<unknown>(url, { method: "GET", fetchImpl, timeoutMs });
    return parseEnvelopeData(payload, schema, fallbackMessage).data;
  }

  async function write<T>(action: string, body: unknown, schema: z.ZodType<T>, fallbackMessage: string) {
    const token = resolveCsrfToken(csrfToken ?? sessionCsrfToken);
    const url = withApiParams(requireApiEndpoint(endpoint), { action });
    const payload = await requestJson<unknown>(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": token
      },
      fetchImpl,
      timeoutMs
    });
    return parseEnvelopeData(payload, schema, fallbackMessage);
  }

  return Object.freeze({
    async getSession() {
      const session = await read("session", sessionSchema, "登录状态加载失败");
      sessionCsrfToken = session.csrfToken ?? sessionCsrfToken;
      return session;
    },

    async login(input) {
      const result = await write("login", parseApiInput(input, loginInputSchema), sessionSchema, "登录失败");
      sessionCsrfToken = result.data.csrfToken ?? sessionCsrfToken;
      return result;
    },

    async verifyContentPassword(input) {
      return write("password.verify", parseApiInput(input, contentPasswordInputSchema), contentPasswordResultSchema, "密码验证失败");
    },

    async logout() {
      const result = await write("logout", {}, logoutResultSchema, "退出失败");
      sessionCsrfToken = "";
      return result;
    },

    async getFavorites() {
      return (await read("favorites", favoritesSchema, "收藏加载失败")).items;
    },

    async setFavorite(input) {
      return write("favorite", parseApiInput(input, favoriteInputSchema), favoriteResultSchema, "收藏操作失败");
    },

    async deleteFavorites(input) {
      return write("favorites.delete", parseApiInput(input, recordDeleteInputSchema), recordDeleteResultSchema, "收藏记录删除失败");
    },

    async getHistory(limit) {
      const params: Record<string, string> = {};
      if (limit !== undefined) params.limit = String(parseApiInput(limit, historyLimitSchema));
      return (await read("history", historySchema, "播放记录加载失败", params)).items;
    },

    async saveHistory(input) {
      return write("history.save", parseApiInput(input, historyInputSchema), historyResultSchema, "播放记录保存失败");
    },

    async deleteHistory(input) {
      return write("history.delete", parseApiInput(input, recordDeleteInputSchema), recordDeleteResultSchema, "播放记录删除失败");
    },

    async getDevices() {
      return read("devices", devicesSchema, "登录设备加载失败");
    },

    async revokeDevice(sessionId) {
      const input = parseApiInput({ sessionId }, revokeInputSchema);
      return write("device.revoke", input, revokeResultSchema, "设备撤销失败");
    },

    async submitFeedback(input) {
      return write("feedback", parseApiInput(input, feedbackInputSchema), submissionResultSchema, "留言提交失败");
    },

    async submitReport(input) {
      return write("report", parseApiInput(input, reportInputSchema), submissionResultSchema, "报错提交失败");
    },

    async getComments(vodId, mid = "1") {
      const id = parseApiInput(vodId, identifierSchema);
      const moduleId = parseApiInput(mid, identifierSchema);
      return (await read("comments", commentsSchema, "评论加载失败", { mid: moduleId, content_id: id })).items;
    },

    async submitComment(input) {
      return write("comment", parseApiInput(input, commentInputSchema), submissionResultSchema, "评论提交失败");
    },

    async setReaction(input) {
      return write("reaction", parseApiInput(input, reactionInputSchema), reactionResultSchema, "互动操作失败");
    },

    async submitRating(input) {
      return write("rating", parseApiInput(input, ratingInputSchema), ratingResultSchema, "评分提交失败");
    }
  });
}

const accountEndpoint = process.env.NEXT_PUBLIC_API_BASE_URL || (process.env.NODE_ENV === "production" ? "" : "/react-api.php");

export const accountApi = createAccountApi({ endpoint: accountEndpoint });
