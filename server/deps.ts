import OpenAI from "openai";
import premium from "../data/premium-clubs.json" with { type: "json" };
import type { AppDeps } from "./app";
import { todaySeoul } from "./dates";
import { OpenAIQueryParser } from "./nlu/parseQuery";
import { OpenAISpeaker } from "./nlu/speak";
import { OpenAITranscriber } from "./nlu/transcribe";
import { CsvSource } from "./source/CsvSource";

/** 환경변수로 앱 의존성을 만든다. 일반 서버(index.ts)와 Vercel 함수(vercel.ts)가 함께 쓴다. */
export function createDeps(csvPath: string, dataUpdatedAt?: Date): AppDeps {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const client = apiKey ? new OpenAI({ apiKey, timeout: 30_000, maxRetries: 1 }) : undefined;
  const env = process.env;
  const models = {
    parse: env.OPENAI_MODEL || "gpt-4.1-mini",
    stt: env.OPENAI_STT_MODEL || "gpt-4o-transcribe",
    tts: env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
  };
  return {
    models: client ? models : undefined,
    source: new CsvSource(csvPath, dataUpdatedAt),
    premiumClubs: premium.clubs,
    parser: client && new OpenAIQueryParser(client, models.parse),
    transcriber: client && new OpenAITranscriber(client, models.stt),
    speaker: client && new OpenAISpeaker(client, models.tts, env.OPENAI_TTS_VOICE || "nova"),
    today: () => todaySeoul(),
  };
}
