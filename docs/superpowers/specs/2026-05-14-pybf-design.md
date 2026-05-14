# Prove Your Brand, Farmers (영농일지) — v1 Design Spec

- **Date**: 2026-05-14
- **Status**: Draft (pending user review)
- **Notion**: [Prove Your Brand, Farmers](https://www.notion.so/Prove-Your-Brand-Farmers-360717b90ff180eca646f91bac13b8f7)
- **Related research**: [롱텀 메모리 시스템 비교](https://www.notion.so/Zep-Mem0-Graphiti-360717b90ff181f2ba53f889f862eccb) (v2 입력)

## 1. 동기와 범위

아빠가 짓고 있는 농사를 여러 SNS에 자동으로 정리·게시해서 "보여주기식 농사"를 편하게 자동화한다. 사진·음성·짧은 텍스트 입력 한 번이면 SNS별로 톤이 맞춰진 글이 만들어지고 발행까지 한 화면에서 끝난다.

**범위 (v1)**
- 입력: 사진(여러 장) + 영상(짧은 클립) + 텍스트
- 글 생성: SNS별로 최적화된 4개 초안 (인스타·페북·스레드·밴드)
- 검토 → 자동 게시 (Approve → Post)
- 스타일 시스템: 프리셋 + 프리스타일 + 본인 글 분석으로 프리셋 자동 생성

**범위 밖 (v2 이후)**
- 음성 입력 (STT) — Whisper나 Claude audio modality로 추가 검토
- AI 농작물 생육 관리, 농사 지식 도우미 에이전트
- 멀티 사용자·계정·결제·세션
- 롱텀 메모리 시스템 (Mem0/Graphiti 등) — 별도 자산 연구로 진행 중

## 2. 사용자

- **1차이자 유일한 사용자: 아빠 1인** (개인 도구)
- 인증·멀티유저·배포 부담 없음
- 미래 일반화 가능성은 열어두되 현재 디자인엔 반영 안 함

## 3. 핵심 흐름

```
[아빠] 밭에서 사진·영상 찍기 → PWA 홈화면 아이콘 탭
   ↓
[PWA] 사진/영상 선택 + 텍스트 입력 + 스타일 선택 + 채널 토글
   ↓
[PWA] 영상에서 대표 프레임 1~3장 추출 (canvas)
[PWA] 원본 미디어를 Supabase Storage에 임시 업로드 (public URL)
   ↓
[Backend] Claude API 1회 호출 (멀티모달):
   사진 + 영상 프레임 + 텍스트 + 사용자 농장 컨텍스트 + 스타일 지시
   → 4채널 초안 JSON 반환
   ↓
[PWA] 채널별 카드 4개 표시. 아빠 검토·수정 → "발행"
   ↓
[Backend] SNS 어댑터 4개 병렬 호출 — 각 어댑터가 미디어 타입(image/video) 분기
   SNS가 Supabase Storage URL을 fetch해서 자기 CDN에 복사
   ↓
[Backend] 모든 채널 publish 완료 후 Supabase Storage의 원본 미디어 삭제
   ↓
[PWA] 채널별 결과 (✅ post_url / ❌ error). 실패만 재시도 버튼
```

## 4. 시스템 아키텍처

```
┌─────────────────────────────────────┐
│ PWA (Next.js, 홈화면 설치)            │
│  • 입력 · 영상 프레임 추출            │
│  • 초안 검토·발행                     │
└──────────────┬──────────────────────┘
               │ HTTPS
┌──────────────▼──────────────────────┐
│ Backend (Next.js API routes)         │
│  • draft 생성 (Claude API)           │
│  • SNS 어댑터 (Meta·Band)            │
│  • 게시 후 미디어 정리                 │
└──┬──────────────────────┬────────────┘
   │                      │
┌──▼─────────────────┐  ┌─▼────────┐
│ Supabase           │  │ Claude   │
│  Postgres · Auth   │  │ API      │
│  Storage (임시)    │  │          │
└────────────────────┘  └──────────┘
```

**선정**
- **호스팅**: Vercel Hobby (개인 사용 무료)
- **DB + Auth + 미디어 임시 저장**: Supabase 하나로 통합 (Postgres 500MB · Auth 매직링크 · Storage 1GB · 모두 무료)
- **LLM**: Claude API (Anthropic SDK)

**미디어 수명**: 사진·영상은 publish 동안만 Supabase Storage에 살아 있고, **모든 채널 publish 완료(또는 모두 실패 처리) 후 즉시 삭제**. 24시간 TTL lifecycle을 안전망으로 두어 정리 누락도 자동 회수.

**비용 추정**: 모두 0원. Claude API만 사용량 과금 — 주 5게시 기준 월 $1 미만.

## 5. 데이터 모델 (Supabase Postgres)

```
user_profile          ← 1행
  context_text        # "경남 ○○에서 토마토·고추 재배, 친환경 지향" 같은 자유 텍스트
  default_style_id

style_preset
  id
  name                # "정직한 농부", "교육적", ...
  prompt              # 스타일 지시 자유 텍스트
  source              # 'manual' | 'analyzed'
  created_at

channel_credentials   ← 인증 묶음별 1행 (실제 v1엔 2행)
  provider            # 'meta' (인스타·페북·스레드 공유 토큰) | 'band'
  access_token
  refresh_token
  expires_at
  account_ids         # JSONB { instagram_id, facebook_page_id, threads_id, band_ids[] }

draft
  id
  created_at
  media               # JSONB array [{ storage_path, kind: 'image'|'video', thumbnail_path? }]
                      # storage_path는 Supabase Storage 객체 경로
                      # publish 완료 후 객체 자체는 삭제되지만 메타데이터는 남김
  user_text
  style_id            # nullable — freestyle만 쓸 수도 있음
  style_freestyle     # nullable — 즉석 스타일 텍스트
  generations         # JSONB { instagram: {caption, hashtags}, facebook: {...}, ... }
  status              # 'generated' | 'failed_generation' | 'media_cleaned'
  media_cleaned_at    # timestamp, 미디어 객체 삭제 시점

publication           ← draft 1개당 채널 N개
  id
  draft_id
  channel
  status              # 'pending' | 'success' | 'failed' | 'auth_expired'
  post_url
  error_message
  attempted_at
```

- 작물·구획·일자 같은 미세 엔티티는 정규화하지 않음 (한 명 사용자라 비용 > 가치)
- 모든 시간순 기록은 `draft.created_at` + `publication.attempted_at` 으로 충분 — 게시 이력 자체가 농사 기록

## 6. 입력·초안 생성

**스타일 시스템**
- 프리셋: 사용자가 직접 작성하거나 "분석으로 자동 생성"
- 프리스타일: 입력 화면에서 매번 자유 텍스트 (이번 한 번만 적용)
- 스타일 분석: 설정에서 본인 글 N개 붙여넣으면 Claude가 어조·문장길이·해시태그 패턴을 분석해 프리셋 생성

**Claude API 호출 (한 번에 4채널)**
- 모델: `claude-sonnet-4-6` (멀티모달, 비용·품질 균형)
- 입력: 사진 N장 + 영상 대표 프레임 N장 (모두 vision) + 사용자 텍스트 + 스타일 prompt + user_profile.context_text + 채널별 길이·해시태그 가이드
- 영상 자체는 Claude에 보내지 않음. 클라이언트가 canvas로 1~3장 프레임만 추출해서 vision input으로 전달
- 출력: 구조화된 JSON
  ```json
  {
    "instagram": { "caption": "...", "hashtags": ["#친환경토마토", ...] },
    "facebook": { "caption": "..." },
    "threads": { "caption": "..." },
    "band": { "caption": "..." }
  }
  ```
- prompt caching 적용: user_profile + 스타일 prompt + 채널 가이드 = 고정 prefix → 캐시 hit

**메타 정보 자동 추출**: 작물·작업 종류·계절은 사진+텍스트에서 Claude가 추론. 사용자에게 폼 입력 강요하지 않음.

## 7. SNS 통합

**어댑터 인터페이스**
```ts
interface SNSAdapter {
  channel: Channel
  publish(content: {
    caption: string
    media: { url: string; kind: 'image' | 'video' }[]
    hashtags?: string[]
  }): Promise<{ postUrl: string }>
}
```

**채널별 구현**

| 채널 | API | 인증 | 미디어 |
|---|---|---|---|
| 인스타그램 | Graph API `/media` → `/media_publish` | 비즈니스 계정 + FB 페이지 + Meta 앱 심사 (`instagram_content_publish`) | 이미지: `IMAGE`. 영상: `REELS` (Reels로). 컨테이너 → publish 2-step + 상태 폴링(영상은 5분+) |
| 페이스북 페이지 | 이미지 `/{page-id}/photos`, 영상 `/{page-id}/videos` | 동일 토큰 (`pages_manage_posts`) | 페이지에 게시. 개인 프로필 불가 |
| 스레드 | Threads API `/me/threads` → `/me/threads_publish` | 동일 토큰 (`threads_content_publish`) | 이미지/영상 모두 2-step |
| 밴드 | Naver Band Open API `/v2.2/band/post/create` | Naver 개발자센터 앱 + OAuth | 이미지/영상 첨부 지원, 본인 밴드 ID 필요 |

**메타 토큰 갱신**: 장기 토큰(60일). 만료 7일 전부터 PWA에 재로그인 카드. 만료된 호출은 401 → `publication.status = 'auth_expired'`.

**병렬 게시**: 채널 4개를 `Promise.allSettled`로 동시에. 각 결과는 독립적으로 `publication` 행으로 저장. 부분 실패가 정상 케이스.

## 8. 에러 처리

| 시나리오 | 처리 |
|---|---|
| Claude API 5xx·rate limit | 지수 백오프 재시도 (최대 3회). 실패 시 `draft.status = 'failed_generation'` + PWA 알림 |
| SNS 토큰 만료 | 사전 체크 + 401 시 `auth_expired` 상태로 저장, 재로그인 유도 |
| 채널 일부 실패 | 정상 동작. 성공/실패 분리 기록, 실패 채널만 재시도 버튼 |
| Supabase Storage 업로드 실패 | 클라이언트 재시도 3회. 실패 시 사용자에게 명시 |
| publish 전부 실패 → 미디어 삭제 처리 | publish 결과가 모두 결정될 때까지 미디어 보존. 모든 채널이 실패 처리(재시도 포기 포함)되면 그때 정리. 24시간 lifecycle이 안전망 |
| 메타 publish 비동기 | container 생성 후 `IN_PROGRESS` 상태면 폴링 (이미지 30초, 영상 5분+) |

원칙: **외부 호출은 항상 실패할 수 있다.** draft·publication은 모두 영속화하고 재시도 가능하게.

## 9. 테스트 전략

- **어댑터 단위 테스트**: 외부 호출 mock. 채널별 응답 fixture
- **글 생성**: Claude 호출 stub. 프롬프트 변경 시 스냅샷 회귀
- **dry-run 모드**: `DRY_RUN=true` 시 어댑터가 가짜 post_url 반환 — 전체 흐름 검증
- **E2E (Playwright)**: 사진 선택 → 초안 → 발행(드라이런) → 결과. 릴리즈 전만
- **메타 Sandbox**: 인증 심사 통과 전 Test User 계정으로 실제 publish 검증

## 10. 외부 의존성 트랙 (병렬 진행)

코드 작업과 무관하게 **사람이 처리해야 할 일정 변수**:

| 항목 | 소요 시간 | 비고 |
|---|---|---|
| 인스타그램 비즈니스 계정 전환 | 즉시 | 아빠 계정으로 |
| Facebook 페이지 생성 + 인스타 연결 | 1일 | 인스타 publish의 전제조건 |
| Meta for Developers 앱 등록 + 권한 신청 (`instagram_content_publish`, `pages_manage_posts`, `threads_content_publish`) | 1~수주 | 가장 큰 일정 위험 |
| Naver 개발자센터 앱 등록 (밴드) | 1일 | 심사 가벼움 |
| Anthropic API 키 발급·결제 등록 | 즉시 | |
| Supabase / Vercel 계정 | 즉시 | 무료 가입. Supabase Storage는 계정에 포함 |

릴리즈는 메타 심사 통과를 기다린다. 그 사이 코드는 dry-run + sandbox로 완성도 올림.

## 11. 비-범위 (v2+)

- 롱텀 메모리 시스템 (Mem0/Graphiti) — 별도 자산 연구가 PYBF v2 입력
- 본인 과거 게시물 자동 import (인스타 API로 본인 글 가져와 스타일 분석)
- AI 농작물 생육 관리·농사 지식 도우미
- 멀티 사용자·결제·세션
- 영상(릴스/쇼츠) 자동 편집·업로드
- 네이버 블로그·카카오스토리 등 자동 게시 불가 채널의 "복사 모드"

## 12. 다음 단계

1. **이 스펙 사용자 리뷰** (수정·승인)
2. 노션 프로젝트 페이지에 이 스펙 링크
3. **writing-plans 스킬로 구현 플랜 작성** — 외부 인증 절차와 코드 작업을 병렬 트랙으로 분해
