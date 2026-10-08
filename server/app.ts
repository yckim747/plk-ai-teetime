import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import OpenAI from "openai";
import { z } from "zod";
import { SearchCriteriaSchema, type Alternative, type Clarification, type FeaturedSection, type ModelInfo, type QueryResponse, type SearchCriteria } from "../shared/types";
import { normalizeCriteria, noticesFor, toCatalogInfo } from "./catalog";
import type { QueryParser } from "./nlu/parseQuery";
import { PCM_CONTENT_TYPE, type Speaker } from "./nlu/speak";
import type { Transcriber } from "./nlu/transcribe";
import { buildReply, buildSpeech, forSpeech } from "./reply";
import { featuredSections } from "./search/featured";
import { pickTop, rankTeeTimes } from "./search/recommend";
import { runSearch } from "./search/service";
import type { CatalogData, TeeTimeSource } from "./source/TeeTimeSource";

export interface AppDeps {
  source: TeeTimeSource;
  /** 없으면 AI 기능(자연어·음성) 비활성, 수동 검색만 동작 */
  parser?: QueryParser;
  transcriber?: Transcriber;
  speaker?: Speaker;
  /** 테스트 정보에 표시할 사용 모델 (AI 미설정이면 없음) */
  models?: ModelInfo;
  today: () => string;
}

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

const QueryBody = z.object({
  message: z.string().trim().min(1).max(500),
  prevCriteria: SearchCriteriaSchema.optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(600) }))
    .max(10)
    .optional(),
});
const SearchBody = z.object({ criteria: SearchCriteriaSchema });
const SpeakBody = z.object({ text: z.string().trim().min(1).max(600) });

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const DATE_SUGGESTIONS = ["이번 주말", "다음 주 토요일", "날짜 상관없이 제일 싼 곳"];

export function createApp({ source, parser, transcriber, speaker, models, today }: AppDeps) {
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_AUDIO_BYTES, files: 1 } });

  /**
   * @param nearRegions 말한 골프장이 데이터에 없을 때, 그 골프장과 가까운 지역 (AI가 판단)
   */
  async function searchResponse(criteria: SearchCriteria, catalog: CatalogData, nearRegions: string[] = []): Promise<QueryResponse> {
    const n = normalizeCriteria(criteria, catalog);
    const notices = noticesFor(n, catalog);
    const dataUpdatedAt = catalog.updatedAt.toISOString();
    // 말한 골프장이 하나도 데이터에 없으면 전체를 검색하지 않는다.
    // 가까운 지역을 알면 그 지역 티타임을 대안으로 보여주고(조건은 바꾸지 않음), 모르면 다시 묻는다.
    if (criteria.clubs.length && !n.criteria.clubs.length) {
      const near = nearRegions.filter((r) => catalog.regions.has(r));
      if (near.length) {
        const nearCriteria: SearchCriteria = { ...n.criteria, clubs: [], regions: near };
        const rows = await source.search(nearCriteria);
        if (rows.length) {
          const alt: Alternative = {
            label: `가까운 ${near.join("·")} 지역 골프장`,
            criteria: nearCriteria,
            total: rows.length,
            items: pickTop(rankTeeTimes(rows, nearCriteria), 3),
          };
          const reply = `'${n.unmatchedClubs.join("', '")}'은(는) 지금 조회할 수 없어요. 가까운 ${near.join("·")} 지역 골프장은 이런 시간이 있어요.`;
          return {
            reply,
            speech: forSpeech(reply),
            criteria: n.criteria,
            result: { criteria: n.criteria, total: 0, clubCount: 0, items: [], recommendations: [], alternatives: [alt] },
            notices: noticesFor({ ...n, unmatchedClubs: [] }, catalog),
            dataUpdatedAt,
          };
        }
      }
      const when = n.criteria.dates.length ? "" : "이번 주말 ";
      const clarification: Clarification = {
        question: "말씀하신 골프장은 지금 조회할 수 없어요. 다른 지역으로 찾아드릴까요?",
        suggestions: [...catalog.regions.keys()].slice(0, 4).map((r) => `${when}${r}에서 찾아줘`),
      };
      return { reply: clarification.question, speech: clarification.question, criteria: n.criteria, clarification, notices, dataUpdatedAt };
    }
    const result = await runSearch(source, n.criteria, catalog);
    return { reply: buildReply(result), speech: buildSpeech(result), criteria: n.criteria, result, notices, dataUpdatedAt };
  }

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/catalog", async (_req, res) => {
    res.json(toCatalogInfo(await source.catalog(), parser ? (models ?? null) : null, today()));
  });

  /** 첫 화면 추천 섹션 (데이터 갱신 시각·날짜가 같으면 캐시) */
  let featuredCache: { key: string; sections: FeaturedSection[] } | undefined;
  app.get("/api/featured", async (_req, res) => {
    const catalog = await source.catalog();
    const key = `${catalog.updatedAt.getTime()}|${today()}`;
    if (featuredCache?.key !== key) featuredCache = { key, sections: await featuredSections(source, catalog, today()) };
    res.json(featuredCache.sections);
  });

  /** 조건으로 직접 검색 (조건 칩 해제·대안 선택·수동 필터). AI를 호출하지 않는다. */
  app.post("/api/search", async (req, res) => {
    const { criteria } = SearchBody.parse(req.body);
    res.json(await searchResponse(criteria, await source.catalog()));
  });

  /** 자연어 문의 → 조건 추출 → 검색·추천 */
  app.post("/api/query", async (req, res) => {
    if (!parser) throw new HttpError(503, "AI 기능이 설정되지 않았습니다(OPENAI_API_KEY). 수동 필터로 검색해 주세요.");
    const { message, prevCriteria, history } = QueryBody.parse(req.body);
    const catalog = await source.catalog();
    const parsed = await parser.parse({ message, prev: prevCriteria, history, catalog, today: today() });
    const c = parsed.criteria;
    const noTarget = !c.dates.length && !parsed.anyDate && !c.clubs.length;
    if (parsed.needsClarification || noTarget) {
      const clarification: Clarification = {
        question: parsed.question ?? "언제 라운딩하실 예정인가요?",
        suggestions: parsed.suggestions.length ? parsed.suggestions : DATE_SUGGESTIONS,
      };
      const n = normalizeCriteria(c, catalog);
      res.json({
        reply: clarification.question,
        speech: clarification.question,
        criteria: n.criteria,
        clarification,
        notices: [],
        dataUpdatedAt: catalog.updatedAt.toISOString(),
      } satisfies QueryResponse);
      return;
    }
    res.json(await searchResponse(c, catalog, parsed.nearRegions));
  });

  /** 음성(webm/mp4 등) → 텍스트. 음성은 메모리에서만 처리하고 저장하지 않는다. */
  app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
    if (!transcriber) throw new HttpError(503, "음성 인식이 설정되지 않았습니다(OPENAI_API_KEY).");
    if (!req.file?.buffer.length) throw new HttpError(400, "음성 파일이 비어 있습니다.");
    const catalog = await source.catalog();
    const text = await transcriber.transcribe(req.file.buffer, req.file.mimetype, [...catalog.clubRegion.keys()]);
    res.json({ text });
  });

  /**
   * 답변 문장 → 음성(PCM 스트림). 만드는 대로 흘려보내서 화면이 받는 즉시 재생한다.
   * (전체 음성을 다 만든 뒤 보내면 첫 소리까지 3~6초가 걸린다)
   */
  app.post("/api/speak", async (req, res) => {
    if (!speaker) throw new HttpError(503, "음성 답변이 설정되지 않았습니다(OPENAI_API_KEY).");
    const { text } = SpeakBody.parse(req.body);
    const audio = Readable.fromWeb((await speaker.stream(text)) as NodeReadableStream<Uint8Array>);
    res.set({ "content-type": PCM_CONTENT_TYPE, "cache-control": "no-store", "x-accel-buffering": "no" });
    audio.on("error", (err) => {
      console.error("[speak] 스트림 오류", err);
      res.destroy(err);
    });
    audio.pipe(res);
  });

  app.use("/api", (_req, _res, next) => next(new HttpError(404, "없는 API입니다.")));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
    } else if (err instanceof z.ZodError) {
      res.status(400).json({ error: "요청 형식이 올바르지 않습니다.", details: err.issues });
    } else if (err instanceof multer.MulterError) {
      res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "음성 파일이 너무 큽니다(최대 10MB)." : err.message });
    } else {
      console.error("[api]", err);
      const isOpenAI = err instanceof OpenAI.APIError;
      res.status(isOpenAI ? 502 : 500).json({
        error: isOpenAI ? "AI 서비스 응답에 실패했습니다. 잠시 후 다시 시도하거나 수동 필터를 이용해 주세요." : "서버 오류가 발생했습니다.",
      });
    }
  });

  return app;
}
