import type { Channel, Generations } from "@/lib/types/db";

export type StyleInput = {
  presetPrompt?: string;
  // 이번 한 번만 적용되는 자유 스타일 지시 (프리스타일 모드)
  freestyle?: string;
};

export type FarmContext = {
  contextText: string;
};

export type GenerateDraftInput = {
  // 사진 URL + 영상 대표 프레임 URL 모두 vision으로 보냄.
  // 영상 자체는 보내지 않음 — 클라이언트가 canvas로 추출한 프레임 URL.
  imageUrls: string[];
  userText: string;
  style: StyleInput;
  farmContext: FarmContext;
  channels: Channel[];
};

export type GenerateDraftOutput = {
  generations: Generations;
};

export type AnalyzeStyleInput = {
  // 본인이 과거에 쓴 글 N개 (붙여넣기)
  samples: string[];
};

export type AnalyzeStyleOutput = {
  name: string;
  prompt: string;
};
