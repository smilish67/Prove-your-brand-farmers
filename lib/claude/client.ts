import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// 멀티모달(이미지·텍스트) + JSON 출력 균형.
// 모델 ID는 Anthropic 콘솔/문서에서 최신 확인.
export const MODEL = "claude-sonnet-4-6";
