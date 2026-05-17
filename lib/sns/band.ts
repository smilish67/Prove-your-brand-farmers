// Naver Band Open API. 본인이 관리자인 밴드만 게시.
// 사진 첨부는 별도 endpoint(photo upload) 필요하지만 v1엔 본문 텍스트 위주.
// 사진 URL을 본문 끝에 첨부하면 일부 클라이언트에서 자동 임베드.

import type { SNSAdapter, PublishContent, PublishResult } from "./types";

const BAND_BASE = "https://openapi.band.us";

type BandResponse = {
  result_code: number;
  result_data?: {
    post_key?: string;
    message?: string;
  };
};

export const bandAdapter: SNSAdapter = {
  channel: "band",
  async publish(content, creds): Promise<PublishResult> {
    try {
      const params = new URLSearchParams({
        access_token: creds.accessToken,
        band_key: creds.accountId,
        content: composeContent(content),
        do_push: "false",
      });
      const res = await fetch(`${BAND_BASE}/v2.2/band/post/create`, {
        method: "POST",
        body: params,
      });
      const data = (await res.json().catch(() => ({}))) as BandResponse;
      if (data.result_code !== 1) {
        const message = data.result_data?.message ?? `Band API ${res.status}`;
        const authExpired = data.result_code === 1003; // INVALID_TOKEN 가정
        return { ok: false, error: message, authExpired };
      }
      const postKey = data.result_data?.post_key ?? "";
      return {
        ok: true,
        postUrl: `https://band.us/band/${creds.accountId}/post/${postKey}`,
      };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
};

function composeContent(content: PublishContent): string {
  const media = content.media.map((m) => m.url).join("\n");
  return content.caption + (media ? "\n\n" + media : "");
}
