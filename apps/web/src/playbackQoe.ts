const playbackQoePrefix = "pingfang_playback_qoe_v1_";
const playbackQoeMaxAgeMs = 30 * 60_000;
const pendingPlaybackSwitchKey = "pingfang_pending_playback_switch_v1";

export type PlaybackQoeStatus = "starting" | "playing" | "buffering" | "recovering" | "failed";

export type PlaybackQoeContext = {
  vodId: string | number;
  episodeNo: string | number;
  sourceId: string | number;
};

export type PlaybackQoePayload = {
  sessionId: string;
  status: PlaybackQoeStatus;
  firstFrameMs: number;
  bufferingCount: number;
  bufferingMs: number;
  playedMs: number;
  bandwidthEstimate: number;
  currentLevel: number;
  currentWidth: number;
  currentHeight: number;
  errorType?: string;
};

export type PlaybackQoeRecord = PlaybackQoePayload & {
  version: 1;
  vodId: string;
  episodeNo: number;
  sourceId: string;
  switchAttempts: number;
  switchSuccesses: number;
  lastFailureAt?: number;
  updatedAt: number;
  expiresAt: number;
};

function positiveIntegerString(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? String(number) : "";
}

function normalizeContext(context: PlaybackQoeContext) {
  const vodId = positiveIntegerString(context.vodId);
  const episodeNo = Number(context.episodeNo);
  const sourceId = positiveIntegerString(context.sourceId);
  return vodId && Number.isInteger(episodeNo) && episodeNo > 0 && sourceId ? { vodId, episodeNo, sourceId } : null;
}

function playbackQoeKey(context: PlaybackQoeContext) {
  const normalized = normalizeContext(context);
  return normalized ? `${playbackQoePrefix}${normalized.vodId}_${normalized.episodeNo}_${normalized.sourceId}` : "";
}

function readJson(storage: Storage, key: string) {
  try {
    return JSON.parse(storage.getItem(key) || "null") as unknown;
  } catch {
    return null;
  }
}

function remove(storage: Storage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // Playback QoE is a local optimization and must never block playback.
  }
}

function write(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Playback QoE is a local optimization and must never block playback.
  }
}

function boundedMetric(value: unknown, minimum: number, maximum: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(Math.min(maximum, Math.max(minimum, number))) : 0;
}

function sessionId(value: unknown) {
  return String(value || "")
    .replace(/[^a-z0-9_-]/gi, "")
    .slice(0, 64);
}

function errorType(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 64);
}

export function readPlaybackQoe(storage: Storage, context: PlaybackQoeContext, now = Date.now()): PlaybackQoeRecord | null {
  const key = playbackQoeKey(context);
  const normalized = normalizeContext(context);
  if (!key || !normalized) return null;
  const value = readJson(storage, key);
  if (
    typeof value !== "object" ||
    value === null ||
    (value as { version?: unknown }).version !== 1 ||
    (value as { vodId?: unknown }).vodId !== normalized.vodId ||
    Number((value as { episodeNo?: unknown }).episodeNo) !== normalized.episodeNo ||
    (value as { sourceId?: unknown }).sourceId !== normalized.sourceId ||
    Number((value as { expiresAt?: unknown }).expiresAt) <= now
  ) {
    remove(storage, key);
    return null;
  }
  return value as PlaybackQoeRecord;
}

function completePendingSwitch(storage: Storage, record: PlaybackQoeRecord, now: number) {
  const pending = readJson(storage, pendingPlaybackSwitchKey) as {
    version?: unknown;
    vodId?: unknown;
    episodeNo?: unknown;
    targetSourceId?: unknown;
    expiresAt?: unknown;
  } | null;
  if (
    !pending ||
    pending.version !== 1 ||
    Number(pending.expiresAt) <= now ||
    pending.vodId !== record.vodId ||
    Number(pending.episodeNo) !== record.episodeNo ||
    pending.targetSourceId !== record.sourceId
  ) {
    if (pending && Number(pending.expiresAt) <= now) remove(storage, pendingPlaybackSwitchKey);
    return record;
  }
  record.switchSuccesses = Math.min(1000, record.switchSuccesses + 1);
  remove(storage, pendingPlaybackSwitchKey);
  return record;
}

export function reportPlaybackQoe(storage: Storage, context: PlaybackQoeContext, payload: PlaybackQoePayload, now = Date.now()): PlaybackQoeRecord | null {
  const normalized = normalizeContext(context);
  if (!normalized) return null;
  const previous = readPlaybackQoe(storage, context, now);
  const nextSessionId = sessionId(payload.sessionId);
  const sameSession = previous?.sessionId === nextSessionId;
  const record: PlaybackQoeRecord = {
    version: 1,
    ...normalized,
    sessionId: nextSessionId,
    status: payload.status,
    firstFrameMs: boundedMetric(payload.firstFrameMs, 0, 120_000),
    bufferingCount: boundedMetric(payload.bufferingCount, 0, 1000),
    bufferingMs: boundedMetric(payload.bufferingMs, 0, 86_400_000),
    playedMs: boundedMetric(payload.playedMs, 0, 86_400_000),
    bandwidthEstimate: boundedMetric(payload.bandwidthEstimate, 0, 100_000_000_000),
    currentLevel: boundedMetric(payload.currentLevel, -1, 1000),
    currentWidth: boundedMetric(payload.currentWidth, 0, 16_384),
    currentHeight: boundedMetric(payload.currentHeight, 0, 16_384),
    errorType: errorType(payload.errorType || (sameSession ? previous?.errorType : "")),
    switchAttempts: previous?.switchAttempts ?? 0,
    switchSuccesses: previous?.switchSuccesses ?? 0,
    ...(previous?.lastFailureAt ? { lastFailureAt: previous.lastFailureAt } : {}),
    updatedAt: now,
    expiresAt: now + playbackQoeMaxAgeMs
  };
  if (record.status === "failed") record.lastFailureAt = now;
  if (record.status === "playing" && record.firstFrameMs > 0) completePendingSwitch(storage, record, now);
  write(storage, playbackQoeKey(record), record);
  return record;
}

export function markPlaybackLineSwitch(storage: Storage, target: PlaybackQoeContext, now = Date.now()) {
  const normalized = normalizeContext(target);
  if (!normalized) return;
  const previous = readPlaybackQoe(storage, target, now);
  const record: PlaybackQoeRecord = previous ?? {
    version: 1,
    ...normalized,
    sessionId: "",
    status: "starting",
    firstFrameMs: 0,
    bufferingCount: 0,
    bufferingMs: 0,
    playedMs: 0,
    bandwidthEstimate: 0,
    currentLevel: -1,
    currentWidth: 0,
    currentHeight: 0,
    errorType: "",
    switchAttempts: 0,
    switchSuccesses: 0,
    updatedAt: now,
    expiresAt: now + playbackQoeMaxAgeMs
  };
  record.switchAttempts = Math.min(1000, record.switchAttempts + 1);
  record.updatedAt = now;
  record.expiresAt = now + playbackQoeMaxAgeMs;
  write(storage, playbackQoeKey(record), record);
  write(storage, pendingPlaybackSwitchKey, {
    version: 1,
    vodId: normalized.vodId,
    episodeNo: normalized.episodeNo,
    targetSourceId: normalized.sourceId,
    expiresAt: now + playbackQoeMaxAgeMs
  });
}

export function comparePlaybackQoe(
  storage: Storage,
  vodId: string | number,
  episodeNo: string | number,
  leftSourceId: string | number,
  rightSourceId: string | number,
  now = Date.now()
) {
  const left = readPlaybackQoe(storage, { vodId, episodeNo, sourceId: leftSourceId }, now);
  const right = readPlaybackQoe(storage, { vodId, episodeNo, sourceId: rightSourceId }, now);
  if (!left && !right) return 0;

  const leftPlayable = left && (left.status === "playing" || left.status === "buffering" || left.firstFrameMs > 0) ? 1 : 0;
  const rightPlayable = right && (right.status === "playing" || right.status === "buffering" || right.firstFrameMs > 0) ? 1 : 0;
  const leftFailed = left && (left.status === "failed" || (!leftPlayable && Boolean(left.lastFailureAt))) ? 1 : 0;
  const rightFailed = right && (right.status === "failed" || (!rightPlayable && Boolean(right.lastFailureAt))) ? 1 : 0;
  if (leftFailed !== rightFailed) return leftFailed - rightFailed;
  if (leftPlayable !== rightPlayable) return rightPlayable - leftPlayable;

  const leftAttempts = left?.switchAttempts ?? 0;
  const rightAttempts = right?.switchAttempts ?? 0;
  if (leftAttempts || rightAttempts) {
    const leftRate = leftAttempts ? (left?.switchSuccesses ?? 0) / leftAttempts : 0.5;
    const rightRate = rightAttempts ? (right?.switchSuccesses ?? 0) / rightAttempts : 0.5;
    if (leftRate !== rightRate) return rightRate - leftRate;
  }

  if (leftPlayable && rightPlayable) {
    const leftBufferRatio = (left?.bufferingMs ?? 0) / Math.max(1, (left?.playedMs ?? 0) + (left?.bufferingMs ?? 0));
    const rightBufferRatio = (right?.bufferingMs ?? 0) / Math.max(1, (right?.playedMs ?? 0) + (right?.bufferingMs ?? 0));
    if (leftBufferRatio !== rightBufferRatio) return leftBufferRatio - rightBufferRatio;
    const leftFirstFrame = left?.firstFrameMs ? left.firstFrameMs : Number.MAX_SAFE_INTEGER;
    const rightFirstFrame = right?.firstFrameMs ? right.firstFrameMs : Number.MAX_SAFE_INTEGER;
    if (leftFirstFrame !== rightFirstFrame) return leftFirstFrame - rightFirstFrame;
    if ((left?.currentHeight ?? 0) !== (right?.currentHeight ?? 0)) return (right?.currentHeight ?? 0) - (left?.currentHeight ?? 0);
    if ((left?.bandwidthEstimate ?? 0) !== (right?.bandwidthEstimate ?? 0)) return (right?.bandwidthEstimate ?? 0) - (left?.bandwidthEstimate ?? 0);
  }
  return 0;
}
