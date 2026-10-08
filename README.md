# PLK AI 티타임 컨시어지 (POC)

고객이 웹에서 **말하거나 입력한 자연어**로 티타임을 문의하면, 실시간 잔여 티타임 데이터에서 **조건에 맞는 티타임 전체**와 **추천 Top 3**를 보여주는 POC입니다. 결과가 없으면 조건을 하나만 바꾼 **대안**을 제안합니다.

```
🎤 음성 ──▶ /api/transcribe (OpenAI 음성 인식) ──▶ 문장
문장 ──▶ /api/query
          1) OpenAI 구조화 출력: 문장 → 검색 조건 JSON (날짜·지역·골프장·시간·예산)
          2) 골프장명 정규화 (써닝포인트 → 써닝포인트컨트리클럽, 웅포 → 베어포트리조트CC(구.웅포))
          3) 데이터 검색 (필수 조건 필터)
          4) 추천 점수 → 서로 다른 골프장 Top 3 + 추천 이유
          5) 0~2건이면 대안 탐색 (날짜 ±1일, 시간대 확장, 인접 지역, 최저 그린피까지 예산)
          6) 실제 결과로 응답 문장 생성 (화면용 + 음성용)
🔊 음성용 문장 ──▶ /api/speak (OpenAI 음성 합성) ──▶ 답변을 읽어 줌
```

화면 기능: 음성 문의(한 번 누르고 말하면 말이 끝날 때 자동 검색, 다시 누르면 즉시 검색)·음성 답변(켜고 끄기, 🔊 다시 듣기), 결과 요약 배너와 바로가기, 전체 목록의 ★ 추천 표시, ↺ 조건 초기화("처음부터 다시"라고 말해도 됨), 조건 칩 개별 해제, 직접 고르기 필터.

**AI는 문장을 검색 조건으로 바꾸는 일만 합니다.** 검색·추천·응답 문구는 서버가 실제 데이터 행으로 만들기 때문에, 없는 티타임을 지어내지 않습니다.

## 빠른 실행

Node.js 22.12 이상(권장 24)이 필요합니다.

```bash
npm install
cp .env.example .env        # OPENAI_API_KEY 입력
npm run dev                 # http://localhost:5173 (API는 3001)
```

빌드본 하나로 실행하려면 `npm run demo`를 실행한 뒤 http://localhost:3001 에 접속합니다.

`OPENAI_API_KEY`가 없으면 자연어·음성 문의는 꺼지고, 화면의 **직접 고르기** 필터로만 검색합니다. 마이크는 `localhost` 또는 HTTPS에서만 동작합니다.

## 공개 주소 (Vercel)

**https://plk-ai-teetime.vercel.app** — 로그인·동의 화면 없이 바로 열리는 시연용 주소입니다.

- 화면은 Vercel CDN에서, `/api/*`는 서버 함수(`server/vercel.ts`) 하나가 처리합니다. 티타임 CSV는 함수와 함께 배포됩니다.
- 배포: `npm run deploy:vercel` (처음 한 번 `npx vercel login`, `npx vercel link` 필요). GitHub에 푸시해도 자동 배포되지 않습니다.
- 환경변수는 Vercel 프로젝트 설정(Production)에 둡니다: `OPENAI_API_KEY`, `OPENAI_MODEL`.
- **데이터(CSV)를 바꾸면 다시 배포해야 반영됩니다.** 서버리스라 파일 자동 재적재는 로컬·Codespaces에서만 동작합니다.

## GitHub에서 테스트하기

| 방법 | 용도 | 준비 |
|---|---|---|
| **Codespaces** | 테스트용 웹 주소로 시연 (HTTPS라 마이크 사용 가능) | 저장소 Settings → Secrets → Codespaces에 `OPENAI_API_KEY` 등록 → Code → Codespaces → Create. 켜지면 앱이 자동으로 빌드·실행됨(로그 `/tmp/app.log`). Ports 탭에서 3001을 Public으로 바꾸면 로그인 없이 URL로 접속 가능 |
| **Actions (CI)** | 푸시할 때마다 타입 검사·단위 테스트·빌드 자동 실행 | 없음. Actions 시크릿에 `OPENAI_API_KEY`를 넣으면 자연어 평가(`eval:nlu`)도 실행 |

GitHub Pages는 정적 파일만 제공하므로 이 앱(서버 + 비밀 키 필요)은 Pages로는 실행할 수 없습니다.

## 명령어

| 명령 | 설명 |
|---|---|
| `npm run dev` | API(3001) + 웹(5173) 개발 서버 |
| `npm run demo` | 웹 빌드 후 3001 포트 하나로 실행 |
| `npm run deploy:vercel` | Vercel 운영 주소로 배포 |
| `npm test` | 단위·HTTP 통합 테스트 (OpenAI 호출 없음) |
| `npm run eval:nlu [모델]` | 실제 OpenAI로 문장 24개를 조건으로 변환해 정확도·지연 측정 (기준일 2026-10-08 고정) |
| `npm run typecheck` | 타입 검사 |

## 환경변수 (.env)

| 이름 | 기본값 | 설명 |
|---|---|---|
| `OPENAI_API_KEY` | – | 서버에서만 사용, 브라우저로 전달되지 않음 |
| `OPENAI_MODEL` | `gpt-4.1-mini` | 문장 → 조건 변환 모델 |
| `OPENAI_STT_MODEL` | `gpt-4o-transcribe` | 음성 인식 모델 |
| `OPENAI_TTS_MODEL` / `OPENAI_TTS_VOICE` | `gpt-4o-mini-tts` / `nova` | 음성 답변 모델·목소리 |
| `TEETIME_CSV` | `data/teetimes.csv` | 티타임 데이터. **파일이 바뀌면 다음 요청 때 자동으로 다시 읽음** |
| `PORT` / `HOST` | `3001` / `127.0.0.1` | 서버 주소 |
| `TODAY` | 서울 기준 오늘 | "이번 주말" 등 상대 날짜의 기준일 고정 (시연용) |

## 데이터

`data/teetimes.csv` — 컬럼 `날짜,지역,골프장,티타임,코스,그린피` (UTF-8, BOM 허용).

- 그린피 `"270,000"` → 270000. **0원·빈 값은 "그린피 문의"** 로 표시하고, 예산 조건이 있으면 결과에서 뺍니다.
- 시간 `6:24` → `06:24`. 형식이 잘못된 행은 건너뛰고 로그에 개수를 남깁니다.
- 현재 데이터: 28,758행, 골프장 79곳, 지역 7개, 2026-10-10 ~ 10-31.

## 추천 기준

점수(0~100) = 시간 적합도 + 가격 점수

- **시간 적합도:** 희망 시간(없으면 요청 시간대의 중앙)에 가까울수록 높고, 4시간 이상 벌어지면 0점입니다.
- **가격 점수:** 같은 결과 안에서 쌀수록 높습니다. 그린피 미정은 0점입니다.
- **가중치(시간 : 가격):** 추천순 55:45, 가격순 25:75, 시간순 75:25입니다.
- **Top 3:** 서로 다른 골프장을 먼저 고르고, 점수가 같으면 날짜 → 시간 → 골프장명 순으로 고정합니다.

## 구조

```
shared/types.ts            검색 조건(zod)·응답 타입
shared/format.ts           날짜·금액 표시
server/source/             TeeTimeSource 인터페이스, CsvSource(파일 변경 감지 재적재)
server/catalog.ts          골프장명 매칭·조건 정규화
server/nlu/parseQuery.ts   OpenAI Responses API 구조화 출력, 프롬프트(오늘·달력·골프장 목록 포함)
server/nlu/transcribe.ts   OpenAI 음성 인식(골프장명 힌트)
server/nlu/speak.ts        OpenAI 음성 합성(답변 읽기)
server/search/             filter · recommend · relax(대안) · service
server/reply.ts            결과 기반 응답 문장
server/app.ts              API (/api/catalog, /api/query, /api/search, /api/transcribe, /api/speak)
src/                       React 화면 (채팅·음성·조건 칩·추천 카드·대안·전체 목록·수동 필터)
tests/                     node:test 테스트
scripts/eval-nlu.ts        자연어 평가셋
```

## DB / PLK API로 바꿀 때

`server/source/TeeTimeSource.ts`의 인터페이스 두 개만 구현하면 됩니다.

```ts
search(criteria): Promise<TeeTime[]>   // 날짜·지역·골프장·시간·예산 필터 (DB WHERE 절 / API 파라미터)
catalog(): Promise<CatalogData>        // 지역별 골프장 목록, 데이터 기간, 갱신 시각
```

그다음 `server/index.ts`에서 `new CsvSource(...)`를 새 구현으로 바꿉니다. 추천·대안·AI 해석 코드는 그대로 둡니다.

## 개인정보·보안

- 음성은 서버 메모리에서만 처리하고 저장하지 않습니다.
- 문장과 음성은 OpenAI API로 전송되며, 응답 저장 옵션은 `store: false`로 설정했습니다.
- API 키는 서버 환경변수에만 둡니다. `.env`는 git에서 제외됩니다.
