import type { Channel } from "@/lib/types/db";

export type PublishMedia = {
  url: string;
  kind: "image" | "video";
};

export type PublishContent = {
  caption: string;
  media: PublishMedia[];
  hashtags?: string[];
};

export type AdapterCredentials = {
  accessToken: string;
  // 채널별 식별자:
  // - instagram: IG user ID (비즈니스 계정)
  // - facebook: Page ID
  // - threads: Threads user ID
  // - band: band_key (밴드 고유 ID)
  accountId: string;
};

export type PublishResult =
  | { ok: true; postUrl: string }
  | { ok: false; error: string; authExpired?: boolean };

export interface SNSAdapter {
  channel: Channel;
  publish(
    content: PublishContent,
    creds: AdapterCredentials,
  ): Promise<PublishResult>;
}
