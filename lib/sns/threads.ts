// Threads API. Instagram과 유사한 2-step (container → publish), base URL은 graph.threads.net.

import type {
  SNSAdapter,
  PublishContent,
  AdapterCredentials,
  PublishResult,
} from "./types";
import {
  metaPost,
  pollContainerStatus,
  SNSApiError,
  THREADS_BASE,
} from "./utils";

export const threadsAdapter: SNSAdapter = {
  channel: "threads",
  async publish(content, creds): Promise<PublishResult> {
    try {
      const text = composeText(content);
      const containerId = await createContainer(content, text, creds);
      await pollContainerStatus(containerId, creds.accessToken, THREADS_BASE);
      const r = await metaPost<{ id: string }>(
        `/${creds.accountId}/threads_publish`,
        { creation_id: containerId },
        creds.accessToken,
        THREADS_BASE,
      );
      return { ok: true, postUrl: `https://www.threads.net/post/${r.id}` };
    } catch (e) {
      if (e instanceof SNSApiError) {
        return { ok: false, error: e.message, authExpired: e.authExpired };
      }
      return { ok: false, error: (e as Error).message };
    }
  },
};

function composeText(content: PublishContent): string {
  const tags = content.hashtags?.length
    ? " " +
      content.hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ")
    : "";
  return content.caption + tags;
}

async function createContainer(
  content: PublishContent,
  text: string,
  creds: AdapterCredentials,
): Promise<string> {
  if (content.media.length === 0) {
    const r = await metaPost<{ id: string }>(
      `/${creds.accountId}/threads`,
      { media_type: "TEXT", text },
      creds.accessToken,
      THREADS_BASE,
    );
    return r.id;
  }
  const first = content.media[0];
  const params: Record<string, string> = { text };
  if (first.kind === "video") {
    params.media_type = "VIDEO";
    params.video_url = first.url;
  } else {
    params.media_type = "IMAGE";
    params.image_url = first.url;
  }
  const r = await metaPost<{ id: string }>(
    `/${creds.accountId}/threads`,
    params,
    creds.accessToken,
    THREADS_BASE,
  );
  return r.id;
}
