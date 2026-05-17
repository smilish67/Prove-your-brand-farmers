// 본인이 과거에 쓴 글 N개를 보고 스타일 프롬프트를 자동으로 만들어준다.
// 설정 페이지에서 1회성으로 부르는 용도. 결과를 style_preset.source='analyzed'로 저장.

import { z } from "zod";
import { anthropic, MODEL } from "./client";
import type { AnalyzeStyleInput, AnalyzeStyleOutput } from "./types";

const ResultSchema = z.object({
  name: z.string().min(1).max(40),
  prompt: z.string().min(20),
});

export async function analyzeStyle(
  input: AnalyzeStyleInput,
): Promise<AnalyzeStyleOutput> {
  const samples = input.samples
    .map((s, i) => `[샘플 ${i + 1}]\n${s}`)
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `다음은 한국 농부가 SNS에 쓴 글들이다. 어조·문장 길이·이모지 사용·해시태그 패턴·자주 쓰는 표현·관점을 분석해서, 이 작가의 톤으로 새 글을 쓰기 위한 "스타일 프롬프트"를 만들어라.

${samples}

# 출력 형식
다음 JSON만 출력. 다른 설명 없음:

\`\`\`json
{
  "name": "스타일 이름 (10자 이내, 예: 정직한 농부)",
  "prompt": "이 작가의 톤을 모방하기 위한 지시 (200~400자, 어조·문장 길이·해시태그 빈도·자주 쓰는 표현 명시)"
}
\`\`\``,
      },
    ],
  });

  const text = response.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");

  const fenced = text.match(/```json\s*([\s\S]*?)```/);
  const jsonText = (fenced ? fenced[1] : text).trim();
  return ResultSchema.parse(JSON.parse(jsonText));
}
