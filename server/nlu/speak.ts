import type OpenAI from "openai";

/** 음성 답변 형식: 24kHz·16bit·모노 PCM (브라우저가 받는 즉시 이어서 재생) */
export const PCM_CONTENT_TYPE = "audio/pcm;rate=24000";

export interface Speaker {
  /** 문장 → PCM 음성 스트림. 만드는 대로 조각이 흘러온다. */
  stream(text: string): Promise<ReadableStream<Uint8Array>>;
}

export const SPEAK_INSTRUCTIONS = "밝고 친절한 골프장 예약 상담원처럼 자연스러운 한국어로, 약간 빠르고 또박또박 말하세요.";

/** OpenAI 음성 합성(스트리밍). 전체 파일을 기다리지 않아 첫 소리가 1초 안팎에 나온다. */
export class OpenAISpeaker implements Speaker {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
    private readonly voice: string,
  ) {}

  async stream(text: string): Promise<ReadableStream<Uint8Array>> {
    const res = await this.client.audio.speech.create({
      model: this.model,
      voice: this.voice,
      input: text,
      instructions: SPEAK_INSTRUCTIONS,
      response_format: "pcm",
      stream_format: "audio",
    });
    if (!res.body) throw new Error("음성 스트림이 비어 있습니다.");
    return res.body as ReadableStream<Uint8Array>;
  }
}
