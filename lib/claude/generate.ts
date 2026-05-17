// PYBF 핵심: 사진·영상 프레임·텍스트·스타일·농장 컨텍스트 → 채널별 초안 JSON.
// 한 번의 Claude 호출로 모든 채널 처리 (비용·일관성).
//
// 시스템 프롬프트는 prompt caching으로 마크 — 농장 컨텍스트·스타일·채널 가이드는 재호출 시 캐시 hit.

import { z } from "zod";
import { anthropic, MODEL } from "./client";
import type { Channel } from "@/lib/types/db";
import type { GenerateDraftInput, GenerateDraftOutput } from "./types";

const channelGuides: Record<Channel, string> = {
  instagram:
    "200자 이내, 짧고 임팩트 있게. 해시태그 5~10개 (한국어·영어 섞어서). 이모지 자유롭게.",
  facebook:
    "300~600자, 친근한 어투. 해시태그는 적게(0~3개). 줄바꿈으로 가독성 챙기기.",
  threads:
    "150자 이내, 한 문장~짧은 단락. 해시태그 1~3개. 가벼운 톤.",
  band:
    "400~800자, 친근하고 진솔. 해시태그 없음. 줄바꿈으로 구조화. 농사 동료들과 공유한다는 느낌.",
};

const PerChannelSchema = z.object({
  caption: z.string().min(1),
  hashtags: z.array(z.string()).optional(),
});

const GenerationsSchema = z
  .object({
    instagram: PerChannelSchema.optional(),
    facebook: PerChannelSchema.optional(),
    threads: PerChannelSchema.optional(),
    band: PerChannelSchema.optional(),
  })
  .strict();

export async function generateDraft(
  input: GenerateDraftInput,
): Promise<GenerateDraftOutput> {
  const systemPrompt = buildSystemPrompt(input);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: buildUserContent(input),
      },
    ],
  });

  const text = response.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = parseJsonFromResponse(text);
  const generations = GenerationsSchema.parse(parsed);

  return { generations };
}

function buildSystemPrompt(input: GenerateDraftInput): string {
  const stylePrompt =
    input.style.freestyle ?? input.style.presetPrompt ?? "친근하고 진솔한 톤.";
  const channelGuideText = input.channels
    .map((c) => `- **${c}**: ${channelGuides[c]}`)
    .join("\n");

  const exampleObject = `{\n${input.channels
    .map(
      (c) => `  "${c}": { "caption": "...", "hashtags": ["..."] }`,
    )
    .join(",\n")}\n}`;

  return `너는 한국 농부를 위해 SNS 글을 쓰는 작가다. 사진과 짧은 메모를 보고 채널별 톤에 맞게 게시글을 만든다.

# 농장 컨텍스트
${input.farmContext.contextText || "(컨텍스트 미설정)"}

# 글 스타일
${stylePrompt}

# 채널별 가이드
${channelGuideText}

# 출력 형식
다음 JSON만 출력한다. 다른 설명·서론·결론 없음:

\`\`\`json
${exampleObject}
\`\`\``;
}

type UserContentBlock =
  | { type: "image"; source: { type: "url"; url: string } }
  | { type: "text"; text: string };

function buildUserContent(input: GenerateDraftInput): UserContentBlock[] {
  const blocks: UserContentBlock[] = input.imageUrls.map((url) => ({
    type: "image",
    source: { type: "url", url },
  }));
  blocks.push({
    type: "text",
    text: input.userText.trim() || "(메모 없음 — 사진만 보고 작성)",
  });
  return blocks;
}

function parseJsonFromResponse(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/);
  const jsonText = (fenced ? fenced[1] : text).trim();
  return JSON.parse(jsonText);
}
