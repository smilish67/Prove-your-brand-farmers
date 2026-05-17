// Instagram Graph API: 비즈니스/크리에이터 계정 + FB 페이지 연결 필요.
// 2-step: container 생성 → 상태 폴링 → media_publish.

import type {
  SNSAdapter,
  PublishContent,
  AdapterCredentials,
  PublishResult,
} from "./types";
import { metaPost, pollContainerStatus, SNSApiError } from "./utils";

export const instagramAdapter: SNSAdapter = {
  channel: "instagram",
  async publish(content, creds): Promise<PublishResult> {
    try {
      const caption = composeCaption(content);
      const containerId = await createContainer(content, caption, creds);
      await pollContainerStatus(containerId, creds.accessToken);
      const published = await metaPost<{ id: string }>(
        `/${creds.accountId}/media_publish`,
        { creation_id: containerId },
        creds.accessToken,
      );
      return {
        ok: true,
        postUrl: `https://www.instagram.com/p/${published.id}`,
      };
    } catch (e) {
      return toFailure(e);
    }
  },
};

function composeCaption(content: PublishContent): string {
  const tags = content.hashtags?.length
    ? "\n\n" + content.hashtags.map(ensureHash).join(" ")
    : "";
  return content.caption + tags;
}

function ensureHash(tag: string): string {
  return tag.startsWith("#") ? tag : `#${tag}`;
}

async function createContainer(
  content: PublishContent,
  caption: string,
  creds: AdapterCredentials,
): Promise<string> {
  if (content.media.length === 0) {
    throw new SNSApiError(400, "Instagram requires at least 1 media");
  }
  if (content.media.length === 1) {
    return createSingleContainer(content.media[0], caption, creds);
  }
  return createCarouselContainer(content.media, caption, creds);
}

async function createSingleContainer(
  m: PublishContent["media"][number],
  caption: string,
  creds: AdapterCredentials,
): Promise<string> {
  const params: Record<string, string> = { caption };
  if (m.kind === "video") {
    params.media_type = "REELS";
    params.video_url = m.url;
  } else {
    params.image_url = m.url;
  }
  const r = await metaPost<{ id: string }>(
    `/${creds.accountId}/media`,
    params,
    creds.accessToken,
  );
  return r.id;
}

async function createCarouselContainer(
  media: PublishContent["media"],
  caption: string,
  creds: AdapterCredentials,
): Promise<string> {
  const childIds: string[] = [];
  for (const m of media) {
    const params: Record<string, string> = { is_carousel_item: "true" };
    if (m.kind === "video") {
      params.media_type = "REELS";
      params.video_url = m.url;
    } else {
      params.image_url = m.url;
    }
    const r = await metaPost<{ id: string }>(
      `/${creds.accountId}/media`,
      params,
      creds.accessToken,
    );
    childIds.push(r.id);
  }
  const carousel = await metaPost<{ id: string }>(
    `/${creds.accountId}/media`,
    {
      caption,
      media_type: "CAROUSEL",
      children: childIds.join(","),
    },
    creds.accessToken,
  );
  return carousel.id;
}

function toFailure(e: unknown): PublishResult {
  if (e instanceof SNSApiError) {
    return { ok: false, error: e.message, authExpired: e.authExpired };
  }
  return { ok: false, error: (e as Error).message };
}
