// Facebook Page API. 개인 프로필 publish는 불가 — 페이지에만 가능.
// 단일 미디어 기준 v1; 다중 사진 게시는 별도 attached_media 흐름이 필요해 v2로 미룸.

import type { SNSAdapter, PublishContent, PublishResult } from "./types";
import { metaPost, SNSApiError } from "./utils";

export const facebookAdapter: SNSAdapter = {
  channel: "facebook",
  async publish(content, creds): Promise<PublishResult> {
    try {
      const message = composeMessage(content);
      if (content.media.length === 0) {
        const r = await metaPost<{ id: string }>(
          `/${creds.accountId}/feed`,
          { message },
          creds.accessToken,
        );
        return { ok: true, postUrl: postUrlFromId(r.id) };
      }
      const first = content.media[0];
      if (first.kind === "video") {
        const r = await metaPost<{ id: string }>(
          `/${creds.accountId}/videos`,
          { description: message, file_url: first.url },
          creds.accessToken,
        );
        return { ok: true, postUrl: postUrlFromId(r.id) };
      }
      const r = await metaPost<{ id: string; post_id?: string }>(
        `/${creds.accountId}/photos`,
        { message, url: first.url, published: "true" },
        creds.accessToken,
      );
      return { ok: true, postUrl: postUrlFromId(r.post_id ?? r.id) };
    } catch (e) {
      if (e instanceof SNSApiError) {
        return { ok: false, error: e.message, authExpired: e.authExpired };
      }
      return { ok: false, error: (e as Error).message };
    }
  },
};

function composeMessage(content: PublishContent): string {
  const tags = content.hashtags?.length
    ? "\n\n" +
      content.hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ")
    : "";
  return content.caption + tags;
}

function postUrlFromId(id: string): string {
  // page-id_post-id 형태의 fbid도 가능. UI 페이지 URL 표준.
  return `https://www.facebook.com/${id}`;
}
