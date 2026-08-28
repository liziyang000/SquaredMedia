// @vitest-environment node

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../server/nativePlaybackTickets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../server/nativePlaybackTickets")>();
  return {
    ...actual,
    authorizeProtectedStream: vi.fn()
  };
});

import { authorizeProtectedStream, resetNativePlaybackTicketsForTest } from "../../../server/nativePlaybackTickets";
import { POST } from "./route";

const streamUrl = "/index.php/pingfangapi/stream/id/42/sid/2/nid/7.html";
const authorizeMock = vi.mocked(authorizeProtectedStream);

function ticketRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("https://www.ping2.my/api/native-playback-ticket", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: "PHPSESSID=test-session",
      Host: "www.ping2.my",
      Origin: "https://www.ping2.my",
      "Sec-Fetch-Site": "same-origin",
      "User-Agent": "Quark/10.13.0",
      "X-Real-IP": "203.0.113.9",
      ...headers
    },
    body: JSON.stringify(body)
  });
}

afterEach(() => {
  authorizeMock.mockReset();
  resetNativePlaybackTicketsForTest();
});

describe("POST /api/native-playback-ticket", () => {
  it("authorizes the protected stream with the browser session before issuing an opaque URL", async () => {
    authorizeMock.mockResolvedValue("https://media.example/video/index.m3u8?source=authorized");

    const response = await POST(ticketRequest({ streamUrl }));
    const payload = (await response.json()) as { url: string };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(payload.url).toMatch(/^\/api\/native-playback-stream\/[a-f0-9]{64}$/);
    expect(authorizeMock).toHaveBeenCalledWith({
      streamPath: streamUrl,
      cookie: "PHPSESSID=test-session",
      clientIp: "203.0.113.9",
      userAgent: "Quark/10.13.0"
    });
  });

  it("rejects cross-origin requests before contacting MacCMS", async () => {
    const response = await POST(ticketRequest({ streamUrl }, { Origin: "https://attacker.example", "Sec-Fetch-Site": "cross-site" }));

    expect(response.status).toBe(403);
    expect(authorizeMock).not.toHaveBeenCalled();
  });

  it("rejects requests for the former staging host", async () => {
    const response = await POST(
      ticketRequest(
        { streamUrl },
        {
          Host: "react.ping2.my",
          Origin: "https://react.ping2.my"
        }
      )
    );

    expect(response.status).toBe(403);
    expect(authorizeMock).not.toHaveBeenCalled();
  });

  it("rejects arbitrary URLs instead of acting as an SSRF proxy", async () => {
    const response = await POST(ticketRequest({ streamUrl: "https://media.example/video.m3u8" }));

    expect(response.status).toBe(422);
    expect(authorizeMock).not.toHaveBeenCalled();
  });
});
