import type { Channel } from "@/lib/types/db";
import type { SNSAdapter } from "./types";
import { createDryRunAdapter } from "./dry-run";
import { instagramAdapter } from "./instagram";
import { facebookAdapter } from "./facebook";
import { threadsAdapter } from "./threads";
import { bandAdapter } from "./band";

const realAdapters: Record<Channel, SNSAdapter> = {
  instagram: instagramAdapter,
  facebook: facebookAdapter,
  threads: threadsAdapter,
  band: bandAdapter,
};

// DRY_RUN=true 환경에서는 모든 채널이 가짜 postUrl 반환 (메타 심사 통과 전 개발용).
export function getAdapter(channel: Channel): SNSAdapter {
  if (process.env.DRY_RUN === "true") {
    return createDryRunAdapter(channel);
  }
  return realAdapters[channel];
}

export type {
  SNSAdapter,
  PublishContent,
  AdapterCredentials,
  PublishResult,
  PublishMedia,
} from "./types";
