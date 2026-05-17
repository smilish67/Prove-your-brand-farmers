import { describe, it, expect } from "vitest";
import { createDryRunAdapter } from "./dry-run";

describe("dry-run adapter", () => {
  it("returns fake postUrl scoped to the channel", async () => {
    const ig = createDryRunAdapter("instagram");
    const result = await ig.publish(
      {
        caption: "test",
        media: [{ url: "https://x.test/1.jpg", kind: "image" }],
      },
      { accessToken: "fake", accountId: "fake" },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.postUrl).toMatch(/^https:\/\/dry-run\.local\/instagram\//);
    }
  });

  it("works across all four channels", async () => {
    const channels = ["instagram", "facebook", "threads", "band"] as const;
    for (const c of channels) {
      const adapter = createDryRunAdapter(c);
      const r = await adapter.publish(
        { caption: "x", media: [] },
        { accessToken: "f", accountId: "f" },
      );
      expect(adapter.channel).toBe(c);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.postUrl.includes(c)).toBe(true);
    }
  });
});
