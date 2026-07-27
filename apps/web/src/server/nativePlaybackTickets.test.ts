// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";

import {
  NATIVE_PLAYBACK_TICKET_TTL_MS,
  createNativePlaybackTicket,
  redeemNativePlaybackTicket,
  resetNativePlaybackTicketsForTest,
  validateProtectedStreamPath
} from "./nativePlaybackTickets";

const token = "a".repeat(64);

afterEach(() => {
  resetNativePlaybackTicketsForTest();
});

describe("native playback tickets", () => {
  it("accepts only the protected MacCMS stream path", () => {
    expect(validateProtectedStreamPath("/index.php/pingfangapi/stream/id/42/sid/2/nid/7.html")).toBe("/index.php/pingfangapi/stream/id/42/sid/2/nid/7.html");
    expect(validateProtectedStreamPath(`/index.php/pingfangapi/stream/id/42/sid/2/nid/7/ticket/${"b".repeat(64)}.html`)).toBe(
      `/index.php/pingfangapi/stream/id/42/sid/2/nid/7/ticket/${"b".repeat(64)}.html`
    );
    expect(validateProtectedStreamPath("https://media.example/video.m3u8")).toBeNull();
    expect(validateProtectedStreamPath("/index.php/pingfangapi/stream/id/42/sid/2/nid/7.html?next=https://media.example")).toBeNull();
    expect(validateProtectedStreamPath("/index.php/pingfangapi/stream/id/42/sid/2/nid/../../admin.html")).toBeNull();
  });

  it("redeems an authorized media location during the 120 second window", () => {
    const now = 1_000_000;
    expect(NATIVE_PLAYBACK_TICKET_TTL_MS).toBe(120_000);

    const issued = createNativePlaybackTicket("https://media.example/video/index.m3u8?source=authorized", {
      now,
      createToken: () => token
    });

    expect(issued).toBe(token);
    expect(redeemNativePlaybackTicket(token, now + 119_999)).toBe("https://media.example/video/index.m3u8?source=authorized");
    expect(redeemNativePlaybackTicket(token, now + 120_000)).toBeNull();
  });

  it("rejects forged tickets and unsafe redirect locations", () => {
    expect(redeemNativePlaybackTicket("f".repeat(64), Date.now())).toBeNull();
    expect(() =>
      createNativePlaybackTicket("javascript:alert(1)", {
        now: Date.now(),
        createToken: () => token
      })
    ).toThrowError("媒体跳转地址不安全");
  });
});
