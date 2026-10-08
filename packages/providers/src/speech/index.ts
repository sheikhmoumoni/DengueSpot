import { z } from "zod";
export interface AudioInput {
  bytes: Buffer;
  encoding: "LINEAR16" | "WEBM_OPUS";
  sampleRateHertz: number;
}
export interface SpeechProvider {
  transcribe(
    input: AudioInput,
  ): Promise<{ text: string; locale: "bn-BD"; mock: boolean }>;
}
export class MockSpeechProvider implements SpeechProvider {
  async transcribe() {
    return { text: "", locale: "bn-BD" as const, mock: true };
  }
}
export class GoogleSpeechProvider implements SpeechProvider {
  constructor(private accessToken: () => Promise<string>) {}
  async transcribe(input: AudioInput) {
    if (input.bytes.length > 8 * 1024 * 1024)
      throw new Error("Audio input too large");
    const token = await this.accessToken();
    const response = await fetch(
      "https://speech.googleapis.com/v1/speech:recognize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          config: {
            encoding: input.encoding,
            sampleRateHertz: input.sampleRateHertz,
            languageCode: "bn-BD",
          },
          audio: { content: input.bytes.toString("base64") },
        }),
      },
    );
    if (!response.ok) throw new Error("Optional speech provider failed");
    const result = z
      .object({
        results: z
          .array(
            z
              .object({
                alternatives: z.array(
                  z.object({ transcript: z.string() }).passthrough(),
                ),
              })
              .passthrough(),
          )
          .optional(),
      })
      .parse(await response.json());
    return {
      text: (result.results || [])
        .map((r) => r.alternatives[0]?.transcript || "")
        .join(" "),
      locale: "bn-BD" as const,
      mock: false,
    };
  }
}
export interface VoiceGateway {
  playPrompt(callId: string, promptId: string): Promise<void>;
  acceptRecording(callId: string): Promise<{ privateRecordingKey: string }>;
}
