// POST /api/publications
// 입력: draft_id + channels[] + 채널별 overrides (수정된 caption/hashtags)
// 처리: 자격증명 조회 → 어댑터 병렬 호출 → 결과 저장 → 미디어 cleanup

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdapter } from "@/lib/sns";
import type {
  Channel,
  ChannelAccountIds,
  ChannelCredentials,
  Draft,
  Generations,
  MediaItem,
  PublicationStatus,
} from "@/lib/types/db";

const OverrideSchema = z.object({
  caption: z.string(),
  hashtags: z.array(z.string()).optional(),
});

const BodySchema = z.object({
  draft_id: z.string().uuid(),
  channels: z
    .array(z.enum(["instagram", "facebook", "threads", "band"]))
    .min(1),
  overrides: z
    .record(
      z.enum(["instagram", "facebook", "threads", "band"]),
      OverrideSchema,
    )
    .optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const { data: draft } = await supabase
    .from("draft")
    .select("*")
    .eq("id", body.draft_id)
    .eq("user_id", user.id)
    .maybeSingle<Draft>();
  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  const { data: credsRows } = await supabase
    .from("channel_credentials")
    .select("*")
    .eq("user_id", user.id)
    .returns<ChannelCredentials[]>();
  const credsByProvider = new Map<string, ChannelCredentials>(
    (credsRows ?? []).map((c) => [c.provider, c]),
  );

  const mediaWithUrls = (draft.media as MediaItem[]).map((m) => {
    const { data } = supabase.storage
      .from("pybf-media")
      .getPublicUrl(m.storage_path);
    return { url: data.publicUrl, kind: m.kind };
  });

  const results = await Promise.allSettled(
    body.channels.map(async (channel) => {
      const override = body.overrides?.[channel];
      const generation = (draft.generations as Generations | null)?.[channel];
      const content = override ?? generation;
      if (!content) {
        return {
          channel,
          status: "failed" as PublicationStatus,
          error_message: `No content for ${channel}`,
        };
      }

      const providerKey = channel === "band" ? "band" : "meta";
      const cred = credsByProvider.get(providerKey);
      if (!cred) {
        return {
          channel,
          status: "auth_expired" as PublicationStatus,
          error_message: `No credentials registered for ${providerKey}`,
        };
      }

      const accountId = pickAccountId(channel, cred.account_ids);
      if (!accountId) {
        return {
          channel,
          status: "failed" as PublicationStatus,
          error_message: `No accountId for ${channel}`,
        };
      }

      const adapter = getAdapter(channel);
      const r = await adapter.publish(
        {
          caption: content.caption,
          hashtags: content.hashtags,
          media: mediaWithUrls,
        },
        { accessToken: cred.access_token, accountId },
      );
      if (r.ok) {
        return {
          channel,
          status: "success" as PublicationStatus,
          post_url: r.postUrl,
        };
      }
      return {
        channel,
        status: (r.authExpired
          ? "auth_expired"
          : "failed") as PublicationStatus,
        error_message: r.error,
      };
    }),
  );

  const pubInserts = results.map((r, i) => {
    const channel = body.channels[i];
    if (r.status === "fulfilled") return { draft_id: body.draft_id, ...r.value };
    return {
      draft_id: body.draft_id,
      channel,
      status: "failed" as PublicationStatus,
      error_message: (r.reason as Error)?.message ?? "Unknown error",
    };
  });

  await supabase.from("publication").insert(pubInserts);

  // 발행 결과 모두 결정 후 미디어 cleanup (성공/실패 무관).
  // retry 흐름은 v1 범위 밖 — 사용자가 다시 입력하는 식.
  const admin = createAdminClient();
  const paths = (draft.media as MediaItem[])
    .flatMap((m) => [m.storage_path, m.thumbnail_path].filter(Boolean) as string[]);
  if (paths.length > 0) {
    await admin.storage.from("pybf-media").remove(paths);
  }
  await supabase
    .from("draft")
    .update({
      status: "media_cleaned",
      media_cleaned_at: new Date().toISOString(),
    })
    .eq("id", body.draft_id);

  return NextResponse.json({ results: pubInserts });
}

function pickAccountId(
  channel: Channel,
  ids: ChannelAccountIds,
): string | undefined {
  switch (channel) {
    case "instagram":
      return ids.instagram_id;
    case "facebook":
      return ids.facebook_page_id;
    case "threads":
      return ids.threads_id;
    case "band":
      return ids.band_ids?.[0];
  }
}
