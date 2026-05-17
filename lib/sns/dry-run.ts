// DRY_RUN=true 면 실 호출 없이 가짜 postUrl 반환. 메타 심사 통과 전 개발용.

import type { Channel } from "@/lib/types/db";
import type { SNSAdapter } from "./types";

export function createDryRunAdapter(channel: Channel): SNSAdapter {
  return {
    channel,
    async publish() {
      const id = Math.random().toString(36).slice(2, 10);
      // 약간의 인위적 지연 (실 흐름 비슷하게)
      await new Promise((r) => setTimeout(r, 200));
      return {
        ok: true as const,
        postUrl: `https://dry-run.local/${channel}/${id}`,
      };
    },
  };
}
