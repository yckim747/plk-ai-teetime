import type OpenAI from "openai";

export interface Speaker {
  /** 문장 → mp3 */
  speak(text: string): Promise<Buffer>;
}

/** OpenAI 음성 합성. 상담원 말투로 답변을 읽어 준다. */
export class OpenAISpeaker implements Speaker {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
    private readonly voice: string,
  ) {}

  async speak(text: string): Promise<Buffer> {
    const res = await this.client.audio.speech.create({
      model: this.model,
      voice: this.voice,
      input: text,
      instructions: "밝고 친절한 골프장 예약 상담원처럼 자연스러운 한국어로, 약간 빠르고 또박또박 말하세요.",
      response_format: "mp3",
    });
    return Buffer.from(await res.arrayBuffer());
  }
}
