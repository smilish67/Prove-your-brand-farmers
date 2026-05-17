// POST /api/drafts
// 입력: media[] + user_text + style + channels[]
// 처리: user_profile/style 조회 → Claude 호출 → draft + generations 저장 → 반환

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateDraft } from "@/lib/claude/generate";
import type { Channel, MediaItem } from "@/lib/types/db";

const BodySchema = z.object({
  media: z.array(
    z.object({
      storage_path: z.string().min(1),
      kind: z.enum(["image", "video"]),
      thumbnail_path: z.string().optional(),
    }),
  ),
  user_text: z.string().default(""),
  style_id: z.string().uuid().nullable().optional(),
  style_freestyle: z.string().nullable().optional(),
  channels: z
    .array(z.enum(["instagram", "facebook", "threads", "band"]))
    .min(1),
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

  const { data: profile } = await supabase
    .from("user_profile")
    .select("context_text, default_style_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const farmContextText = profile?.context_text ?? "";
  const effectiveStyleId = body.style_id ?? profile?.default_style_id ?? null;

  let presetPrompt: string | undefined;
  if (effectiveStyleId) {
    const { data: style } = await supabase
      .from("style_preset")
      .select("prompt")
      .eq("id", effectiveStyleId)
      .maybeSingle();
    presetPrompt = style?.prompt ?? undefined;
  }

  const imageUrls = body.media.map((m) => {
    const path = m.thumbnail_path ?? m.storage_path;
    const { data } = supabase.storage.from("pybf-media").getPublicUrl(path);
    return data.publicUrl;
  });

  const mediaForDb: MediaItem[] = body.media.map((m) => ({
    storage_path: m.storage_path,
    kind: m.kind,
    thumbnail_path: m.thumbnail_path,
  }));

  const { data: draft, error: insertError } = await supabase
    .from("draft")
    .insert({
      user_id: user.id,
      media: mediaForDb,
      user_text: body.user_text,
      style_id: effectiveStyleId,
      style_freestyle: body.style_freestyle ?? null,
      status: "generated",
    })
    .select("id")
    .single();
  if (insertError || !draft) {
    return NextResponse.json(
      { error: insertError?.message ?? "Insert failed" },
      { status: 500 },
    );
  }

  try {
    const result = await generateDraft({
      imageUrls,
      userText: body.user_text,
      style: {
        presetPrompt,
        freestyle: body.style_freestyle ?? undefined,
      },
      farmContext: { contextText: farmContextText },
      channels: body.channels as Channel[],
    });

    await supabase
      .from("draft")
      .update({ generations: result.generations })
      .eq("id", draft.id);

    return NextResponse.json({
      draft_id: draft.id,
      generations: result.generations,
    });
  } catch (e) {
    await supabase
      .from("draft")
      .update({ status: "failed_generation" })
      .eq("id", draft.id);
    return NextResponse.json(
      { error: (e as Error).message, draft_id: draft.id },
      { status: 500 },
    );
  }
}
