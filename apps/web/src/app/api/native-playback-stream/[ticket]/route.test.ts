// @vitest-environment node

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { createNativePlaybackTicket, resetNativePlaybackTicketsForTest } from "../../../../server/nativePlaybackTickets";
import { GET } from "./route";

const request = new NextRequest("https://react.ping2.my/api/native-playback-stream/test", {
  headers: { Host: "react.ping2.my" }
});

afterEach(() => {
  resetNativePlaybackTicketsForTest();
});

describe("GET /api/native-playback-stream/[ticket]", () => {
  it("redirects a valid cookie-less native player request without exposing the media URL in JSON", async () => {
    const ticket = createNativePlaybackTicket("https://media.example/video/index.m3u8?source=authorized");
    const response = await GET(request, { params: Promise.resolve({ ticket }) });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://media.example/video/index.m3u8?source=authorized");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("fails closed for an unknown ticket", async () => {
    const response = await GET(request, { params: Promise.resolve({ ticket: "f".repeat(64) }) });

    expect(response.status).toBe(403);
    expect(response.headers.get("location")).toBeNull();
  });

  it("is unavailable on any host other than the staging domain", async () => {
    const ticket = createNativePlaybackTicket("https://media.example/video/index.m3u8");
    const otherHostRequest = new NextRequest("https://example.com/api/native-playback-stream/test", {
      headers: { Host: "example.com" }
    });
    const response = await GET(otherHostRequest, { params: Promise.resolve({ ticket }) });

    expect(response.status).toBe(404);
  });
});
