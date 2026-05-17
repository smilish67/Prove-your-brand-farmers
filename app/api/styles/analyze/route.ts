// POST /api/styles/analyze
// 입력: samples[] (본인이 과거 쓴 글 N개)
// 처리: Claude로 어조·해시태그·문장 패턴 분석 → 프리셋 생성 (source='analyzed')

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { analyzeStyle } from "@/lib/claude/analyze-style";

const BodySchema = z.object({
  samples: z.array(z.string().min(10)).min(1).max(20),
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

  let analyzed: { name: string; prompt: string };
  try {
    analyzed = await analyzeStyle({ samples: parsed.data.samples });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from("style_preset")
    .insert({
      user_id: user.id,
      name: analyzed.name,
      prompt: analyzed.prompt,
      source: "analyzed",
    })
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ style: data });
}
