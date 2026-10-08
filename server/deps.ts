import OpenAI from "openai";
import type { AppDeps } from "./app";
import { todaySeoul } from "./dates";
import { OpenAIQueryParser } from "./nlu/parseQuery";
import { OpenAISpeaker } from "./nlu/speak";
import { OpenAITranscriber } from "./nlu/transcribe";
import { CsvSource } from "./source/CsvSource";

/** 환경변수로 앱 의존성을 만든다. 일반 서버(index.ts)와 Vercel 함수(vercel.ts)가 함께 쓴다. */
export function createDeps(csvPath: string): AppDeps {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const client = apiKey ? new OpenAI({ apiKey, timeout: 30_000, maxRetries: 1 }) : undefined;
  const env = process.env;
  return {
    source: new CsvSource(csvPath),
    parser: client && new OpenAIQueryParser(client, env.OPENAI_MODEL || "gpt-4.1-mini"),
    transcriber: client && new OpenAITranscriber(client, env.OPENAI_STT_MODEL || "gpt-4o-transcribe"),
    speaker: client && new OpenAISpeaker(client, env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts", env.OPENAI_TTS_VOICE || "nova"),
    today: () => todaySeoul(),
  };
}
