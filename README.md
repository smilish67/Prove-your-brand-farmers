# Prove Your Brand, Farmers (PYBF)

농사 활동을 한 번 입력하면 인스타그램·페이스북·스레드·밴드에 자동 게시하는 PWA.
아빠 1인 개인 도구로 시작.

## 스택

- **Next.js 16** (App Router · TypeScript · Tailwind v4)
- **Supabase** — Postgres · Auth(매직링크) · Storage (publish 동안만 임시 보관)
- **Claude API** — 사진·영상 프레임·텍스트 → 4채널 초안 (멀티모달, 단일 호출)

## 문서

- 설계 스펙: [`docs/superpowers/specs/2026-05-14-pybf-design.md`](docs/superpowers/specs/2026-05-14-pybf-design.md)
- Notion: https://www.notion.so/Prove-Your-Brand-Farmers-360717b90ff1800e8a80ef7650cd1aa4
- Linear Project: https://linear.app/3year/project/prove-your-brand-farmers-pybf-64c23cb4634e

## 개발

```bash
npm install
npm run dev
```

http://localhost:3000

## v1 범위

- 사진·영상·텍스트 입력 → Claude API 단일 호출 → 4채널 초안
- 채널별 검토·인라인 수정 → "발행" 한 번에 자동 게시 (Approve → Post)
- 스타일 시스템: 프리셋 + 프리스타일 + 본인 글 분석으로 자동 생성
- Stateless 미디어: Supabase Storage에 publish 동안만 임시 보관, 게시 후 즉시 삭제

자세한 흐름·데이터 모델·에러 처리는 스펙 문서 참고.
