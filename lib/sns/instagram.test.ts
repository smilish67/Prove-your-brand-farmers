import { describe, it, expect, vi, beforeEach } from "vitest";
import { instagramAdapter } from "./instagram";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function ok<T>(body: T) {
  return { ok: true, status: 200, json: async () => body };
}
function fail(status: number, errorMessage: string) {
  return {
    ok: false,
    status,
    json: async () => ({ error: { message: errorMessage } }),
  };
}

describe("instagram adapter", () => {
  it("single image: container → FINISHED → publish", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ id: "container1" }))
      .mockResolvedValueOnce(ok({ status_code: "FINISHED" }))
      .mockResolvedValueOnce(ok({ id: "post1" }));

    const result = await instagramAdapter.publish(
      {
        caption: "테스트",
        hashtags: ["테스트", "농부"],
        media: [{ url: "https://x.test/1.jpg", kind: "image" }],
      },
      { accessToken: "TOKEN", accountId: "USER1" },
    );

    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.postUrl).toBe("https://www.instagram.com/p/post1");
  });

  it("auth expired (401) returns authExpired", async () => {
    fetchMock.mockResolvedValueOnce(fail(401, "Invalid token"));

    const result = await instagramAdapter.publish(
      {
        caption: "x",
        media: [{ url: "https://x.test/1.jpg", kind: "image" }],
      },
      { accessToken: "BAD", accountId: "USER1" },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.authExpired).toBe(true);
      expect(result.error).toBe("Invalid token");
    }
  });

  it("rejects empty media", async () => {
    const result = await instagramAdapter.publish(
      { caption: "x", media: [] },
      { accessToken: "T", accountId: "U" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/at least 1 media/);
  });
});
