import { describe, it, expect, vi, beforeEach } from "vitest";
import { bandAdapter } from "./band";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("band adapter", () => {
  it("success → postUrl from band_key + post_key", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        result_code: 1,
        result_data: { post_key: "POST123" },
      }),
    });

    const result = await bandAdapter.publish(
      { caption: "안녕 밴드", media: [] },
      { accessToken: "T", accountId: "BAND_A" },
    );
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.postUrl).toBe("https://band.us/band/BAND_A/post/POST123");
  });

  it("INVALID_TOKEN (result_code 1003) → authExpired", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        result_code: 1003,
        result_data: { message: "INVALID_TOKEN" },
      }),
    });

    const result = await bandAdapter.publish(
      { caption: "x", media: [] },
      { accessToken: "BAD", accountId: "BAND_A" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.authExpired).toBe(true);
      expect(result.error).toBe("INVALID_TOKEN");
    }
  });
});
